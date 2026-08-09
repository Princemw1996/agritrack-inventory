// ========== AUTHENTICATION ==========
async function checkSession() {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) {
        showLoginScreen();
        return;
    }
    currentUserId = session.user.id;
    const role = await fetchUserRole(currentUserId);
    if (!role) {
        showLoginScreen();
        document.getElementById('loginError').textContent = "User role not configured. Contact admin.";
        return;
    }
    currentUserRole = role;
    currentUserShops = await fetchUserShops(currentUserId);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    initializeApp(role);
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
}

document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    if (!email || !password) {
        errorDiv.textContent = 'Email and password required.';
        return;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
        errorDiv.textContent = error.message;
        return;
    }
    currentUserId = data.user.id;
    const role = await fetchUserRole(currentUserId);
    if (!role) {
        errorDiv.textContent = "User role not configured. Contact admin.";
        await sb.auth.signOut();
        return;
    }
    currentUserRole = role;
    currentUserShops = await fetchUserShops(currentUserId);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    initializeApp(role);
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    showLoginScreen();
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Please log in again.</div>';
});

// ========== SIDEBAR BUILDER ==========
function buildSidebar(role) {
    const container = document.getElementById('dynamicButtons');
    container.innerHTML = '';
    if (role === 'admin') {
        const buttons = [
            { id: 'btnAdmin', text: '👥 Admin Panel', module: 'admin' },
            { id: 'btnRoadUserFee', text: '🚗 Collect Fee', module: 'roadUserFee' },
            { id: 'btnRoadUserFeeReport', text: '📊 MCC Report', module: 'roadUserFeeReport' }
        ];
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.id = btn.id;
            button.textContent = btn.text;
            button.addEventListener('click', () => loadModule(btn.module));
            container.appendChild(button);
        });
    } else if (role === 'shopkeeper' || role === 'revenue_collector') {
        // For shopkeepers and revenue collectors, only show road user fee modules
        const buttons = [
            { id: 'btnRoadUserFee', text: '🚗 Collect Fee', module: 'roadUserFee' },
            { id: 'btnRoadUserFeeReport', text: '📊 MCC Report', module: 'roadUserFeeReport' }
        ];
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.id = btn.id;
            button.textContent = btn.text;
            button.addEventListener('click', () => loadModule(btn.module));
            container.appendChild(button);
        });
    }
}

// Sidebar toggle for mobile
function setupSidebarToggle() {
    const toggleBtn = document.getElementById('menuToggle');
    const dynamicBtns = document.getElementById('dynamicButtons');
    if (toggleBtn && dynamicBtns) {
        toggleBtn.addEventListener('click', () => {
            dynamicBtns.classList.toggle('open');
        });
        document.querySelectorAll('#dynamicButtons button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    dynamicBtns.classList.remove('open');
                }
            });
        });
    }
}

function initializeApp(role) {
    buildSidebar(role);
    setupSidebarToggle();
    // Default module: roadUserFee for all users
    loadModule('roadUserFee');
}

// ========== MODULE LOADER ==========
function loadModule(moduleName) {
    const allBtns = document.querySelectorAll('#dynamicButtons button');
    allBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (moduleName === 'admin') renderAdminPanel();
    else if (moduleName === 'roadUserFee') renderRoadUserFee();
    else if (moduleName === 'roadUserFeeReport') renderRoadUserFeeReport();
    else {
        showMessage('Module not available.', true);
        loadModule('roadUserFee');
    }
}

checkSession();