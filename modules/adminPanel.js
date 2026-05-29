// modules/adminPanel.js – Full admin panel with shop filter
async function renderAdminPanel() {
    const container = document.getElementById('moduleContainer');
    
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
        container.innerHTML = `
            <div class="card">
                <h2>👥 Admin Panel</h2>
                <div class="error">
                    <strong>Admin panel is only available on the deployed version.</strong><br><br>
                    Please use the Supabase Dashboard to manage users:<br>
                    <a href="https://supabase.com/dashboard/project/njzjazzpmeaoufrqqldm/auth/users" target="_blank">
                        https://supabase.com/dashboard/project/njzjazzpmeaoufrqqldm/auth/users
                    </a>
                </div>
            </div>
        `;
        return;
    }

    const EDGE_FUNCTION_URL = "https://njzjazzpmeaoufrqqldm.supabase.co/functions/v1/admin";

    container.innerHTML = '<div class="loading">Loading admin panel...</div>';
    try {
        const token = (await sb.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error('No session token. Please log in again.');
        
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'list' })
        });
        
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch(e) {
            throw new Error(`Server returned invalid JSON: ${rawText.substring(0, 200)}`);
        }
        if (!response.ok) throw new Error(data.error || 'Failed to fetch users');
        
        const users = data.users;
        const { data: shops } = await sb.from('locations').select('id, name').eq('type', 'shop');
        const shopList = shops || [];
        
        // Build the UI with a filter dropdown
        let html = `
            <h2>👥 Admin Panel – Manage Users & Permissions</h2>
            <div class="card">
                <div class="flex-row" style="margin-bottom:15px;">
                    <div style="flex:1">
                        <label>Filter by Shop:</label>
                        <select id="shopFilter">
                            <option value="all">All Shops</option>
                            ${shopList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="align-self:flex-end;">
                        <button id="applyFilterBtn">Apply Filter</button>
                    </div>
                </div>
                <h3>➕ Create New User</h3>
                <div class="flex-row">
                    <div style="flex:1"><label>Email</label><input type="email" id="newEmail" placeholder="user@example.com"></div>
                    <div style="flex:1"><label>Password</label><input type="password" id="newPassword"></div>
                    <div style="flex:1"><label>Role</label>
                        <select id="newRole">
                            <option value="shopkeeper">Shopkeeper</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div style="flex:1"><label>Assign Shops (for shopkeeper)</label>
                        <select id="newShops" multiple size="3">
                            ${shopList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="align-self:flex-end"><button id="createUserBtn">Create User</button></div>
                </div>
            </div>
            <div class="card">
                <h3>📋 Existing Users</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr><th>Email</th><th>Role</th><th>Assigned Shops</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="userTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
        
        // Function to render the user table with filtering
        function renderUserTable(usersToRender) {
            const tbody = document.getElementById('userTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            for (const user of usersToRender) {
                const isSelf = user.id === currentUserId;
                const row = tbody.insertRow();
                
                const emailCell = row.insertCell();
                emailCell.textContent = user.email;
                
                const roleCell = row.insertCell();
                const roleSelect = document.createElement('select');
                roleSelect.innerHTML = `
                    <option value="shopkeeper" ${user.role === 'shopkeeper' ? 'selected' : ''}>Shopkeeper</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                `;
                roleCell.appendChild(roleSelect);
                
                const shopsCell = row.insertCell();
                const shopsDiv = document.createElement('div');
                shopsDiv.style.display = 'flex';
                shopsDiv.style.flexDirection = 'column';
                shopsDiv.style.gap = '5px';
                for (const shop of shopList) {
                    const label = document.createElement('label');
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = shop.id;
                    cb.checked = user.shopIds.includes(shop.id);
                    label.appendChild(cb);
                    label.appendChild(document.createTextNode(` ${shop.name}`));
                    shopsDiv.appendChild(label);
                }
                shopsCell.appendChild(shopsDiv);
                
                const actionsCell = row.insertCell();
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Save Changes';
                saveBtn.style.backgroundColor = '#2C5F2D';
                saveBtn.style.marginRight = '10px';
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete User';
                deleteBtn.style.backgroundColor = '#dc3545';
                if (isSelf) {
                    deleteBtn.disabled = true;
                    deleteBtn.title = 'Cannot delete yourself';
                }
                actionsCell.appendChild(saveBtn);
                actionsCell.appendChild(deleteBtn);
                
                saveBtn.onclick = async () => {
                    const newRole = roleSelect.value;
                    const selectedShops = Array.from(shopsDiv.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
                    const token = (await sb.auth.getSession()).data.session?.access_token;
                    const res = await fetch(EDGE_FUNCTION_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ action: 'updateUser', userId: user.id, role: newRole, shopIds: selectedShops })
                    });
                    const result = await res.json();
                    if (res.ok) {
                        showMessage(`User ${user.email} updated successfully.`, false);
                        renderAdminPanel();
                    } else {
                        showMessage(`Error: ${result.error}`, true);
                    }
                };
                
                deleteBtn.onclick = async () => {
                    if (!confirm(`Delete user ${user.email} permanently?`)) return;
                    const token = (await sb.auth.getSession()).data.session?.access_token;
                    const res = await fetch(EDGE_FUNCTION_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ action: 'delete', userId: user.id })
                    });
                    const result = await res.json();
                    if (res.ok) {
                        showMessage(`User ${user.email} deleted.`, false);
                        renderAdminPanel();
                    } else {
                        showMessage(`Error: ${result.error}`, true);
                    }
                };
            }
        }
        
        // Initial render without filter
        renderUserTable(users);
        
        // Filtering logic
        const filterSelect = document.getElementById('shopFilter');
        const applyBtn = document.getElementById('applyFilterBtn');
        
        applyBtn.onclick = () => {
            const selectedShopId = parseInt(filterSelect.value);
            if (selectedShopId === 'all' || isNaN(selectedShopId)) {
                renderUserTable(users);
            } else {
                const filtered = users.filter(user => user.shopIds.includes(selectedShopId));
                renderUserTable(filtered);
            }
        };
        
        // Create user button
        document.getElementById('createUserBtn').onclick = async () => {
            const email = document.getElementById('newEmail').value.trim();
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;
            const shopSelect = document.getElementById('newShops');
            const shopIds = Array.from(shopSelect.selectedOptions).map(opt => parseInt(opt.value));
            if (!email || !password) { showMessage('Email and password required.', true); return; }
            const token = (await sb.auth.getSession()).data.session?.access_token;
            const res = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'create', email, password, role, shopIds })
            });
            const result = await res.json();
            if (res.ok) { showMessage(`User ${email} created successfully.`); renderAdminPanel(); }
            else { showMessage(`Error: ${result.error}`, true); }
        };
        
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="error">Admin panel error: ${err.message}</div>`;
    }
}