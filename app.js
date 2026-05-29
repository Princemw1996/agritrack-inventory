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

function buildSidebar(role) {
    const container = document.getElementById('dynamicButtons');
    container.innerHTML = '';
    if (role === 'admin') {
        const buttons = [
            { id: 'btnAdmin', text: '👥 Admin Panel', module: 'admin' },
            { id: 'btnProductManagement', text: '📦 Manage Products', module: 'productManagement' },
            { id: 'btnCancelSale', text: '❌ Cancel Sale', module: 'cancelSale' },
            { id: 'btnStockAdjust', text: '📦 Stock Adjustment', module: 'stockAdjust' },
            { id: 'btnExpenses', text: '💸 Expenses', module: 'expenses' },
            { id: 'btnReports', text: '📊 Reports', module: 'reports' },
            { id: 'btnAuditTrail', text: '📜 Audit Trail', module: 'auditTrail' },
            { id: 'btnMainReceive', text: '📦 Main WH – Receive', module: 'mainReceive' },
            { id: 'btnMainStock', text: '📊 Main WH – Stock', module: 'mainStock' },
            { id: 'btnMainTransfer', text: '🚚 Main → Min WH', module: 'mainTransfer' },
            { id: 'btnMainToShops', text: '🚚 Main → Lilongwe/Blantyre', module: 'mainToShops' },
            { id: 'btnMinReceive', text: '✅ Min WH – Receive', module: 'minReceive' },
            { id: 'btnMinStock', text: '📊 Min WH – Stock', module: 'minStock' },
            { id: 'btnMinSend', text: '🛒 Min → Northern Shops', module: 'minSend' },
            { id: 'btnShop', text: '🏪 Shop Module', module: 'shop' }
        ];
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.id = btn.id;
            button.textContent = btn.text;
            button.addEventListener('click', () => loadModule(btn.module));
            container.appendChild(button);
        });
    } else if (role === 'shopkeeper') {
        const button = document.createElement('button');
        button.id = 'btnShop';
        button.textContent = '🏪 Shop Module';
        button.addEventListener('click', () => loadModule('shop'));
        container.appendChild(button);
    }
}

function loadModule(moduleName) {
    if (currentUserRole === 'shopkeeper' && moduleName !== 'shop') {
        showMessage("Access denied: You are only allowed to access the Shop Module.", true);
        return;
    }
    const allBtns = document.querySelectorAll('#dynamicButtons button');
    allBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (moduleName === 'admin') renderAdminPanel();
    else if (moduleName === 'auditTrail') renderAuditTrail();
    else if (moduleName === 'productManagement') renderProductManagement();
    else if (moduleName === 'cancelSale') renderCancelSale();
    else if (moduleName === 'stockAdjust') renderStockAdjustment();
    else if (moduleName === 'expenses') renderExpenses();
    else if (moduleName === 'reports') renderReports();
    else if (moduleName === 'mainReceive') renderMainReceive();
    else if (moduleName === 'mainStock') renderMainStock();
    else if (moduleName === 'mainTransfer') renderMainTransfer();
    else if (moduleName === 'mainToShops') renderMainToShops();
    else if (moduleName === 'minReceive') renderMinReceive();
    else if (moduleName === 'minStock') renderMinStock();
    else if (moduleName === 'minSend') renderMinSend();
    else if (moduleName === 'shop') renderShop();
}
function initializeApp(role) {
    buildSidebar(role);
    if (role === 'admin') loadModule('admin');
    else loadModule('shop');
}

checkSession();