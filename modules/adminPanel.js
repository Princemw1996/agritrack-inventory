async function renderAdminPanel() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading admin panel...</div>';
    try {
        const token = (await sb.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error('No session token. Please log in again.');
        const response = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action: 'list' })
        });
        const rawText = await response.text();
        let data;
        try { data = JSON.parse(rawText); } catch(e) { throw new Error(`Invalid JSON from server: ${rawText.substring(0,200)}`); }
        if (!response.ok) throw new Error(data.error || 'Failed to fetch users');
        const users = data.users;
        const { data: shops } = await sb.from('locations').select('id, name').eq('type', 'shop');
        const shopList = shops || [];
        let html = `
            <h2>👥 Admin Panel – Manage Users & Permissions</h2>
            <div class="card">
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
                    <table style="width:100%;">
                        <thead><tr><th>Email</th><th>Role</th><th>Assigned Shops</th><th>Actions</th></tr></thead>
                        <tbody id="userTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
        const tbody = document.getElementById('userTableBody');
        for (const user of users) {
            const isSelf = user.id === currentUserId;
            const assignedShopNames = user.shopIds.map(sid => shopList.find(s => s.id === sid)?.name || sid).join(', ');
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${assignedShopNames || '—'}</td>
                <td>
                    ${!isSelf ? `<button class="deleteUserBtn" data-id="${user.id}">Delete</button>` : '—'}
                    ${user.role === 'shopkeeper' ? `<button class="editShopsBtn" data-id="${user.id}" data-shops='${JSON.stringify(user.shopIds)}'>Edit Shops</button>` : ''}
                </td>
            `;
        }
        // Create user
        document.getElementById('createUserBtn').onclick = async () => {
            const email = document.getElementById('newEmail').value.trim();
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;
            const shopSelect = document.getElementById('newShops');
            const shopIds = Array.from(shopSelect.selectedOptions).map(opt => parseInt(opt.value));
            if (!email || !password) { showMessage('Email and password required.', true); return; }
            const token = (await sb.auth.getSession()).data.session?.access_token;
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'create', email, password, role, shopIds })
            });
            const result = await res.json();
            if (res.ok) { showMessage(`User ${email} created successfully.`); renderAdminPanel(); }
            else { showMessage(`Error: ${result.error}`, true); }
        };
        // Delete user
        document.querySelectorAll('.deleteUserBtn').forEach(btn => {
            btn.onclick = async () => {
                const userId = btn.dataset.id;
                if (!confirm('Delete this user permanently?')) return;
                const token = (await sb.auth.getSession()).data.session?.access_token;
                const res = await fetch('/api/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ action: 'delete', userId })
                });
                const result = await res.json();
                if (res.ok) { showMessage('User deleted.'); renderAdminPanel(); }
                else { showMessage(`Error: ${result.error}`, true); }
            };
        });
        // Edit shops
        document.querySelectorAll('.editShopsBtn').forEach(btn => {
            btn.onclick = async () => {
                const userId = btn.dataset.id;
                const currentShops = JSON.parse(btn.dataset.shops);
                const shopListHtml = shopList.map(s => `<label><input type="checkbox" value="${s.id}" ${currentShops.includes(s.id) ? 'checked' : ''}> ${s.name}</label><br>`).join('');
                const newShops = await new Promise((resolve) => {
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed'; modal.style.top = '20%'; modal.style.left = '30%'; modal.style.width = '40%';
                    modal.style.background = 'white'; modal.style.padding = '20px'; modal.style.borderRadius = '12px';
                    modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; modal.style.zIndex = '1000';
                    modal.innerHTML = `<h3>Assign Shops</h3><div id="shopCheckboxes">${shopListHtml}</div><button id="modalSave">Save</button><button id="modalCancel">Cancel</button>`;
                    document.body.appendChild(modal);
                    modal.querySelector('#modalSave').onclick = () => {
                        const selected = Array.from(modal.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
                        document.body.removeChild(modal);
                        resolve(selected);
                    };
                    modal.querySelector('#modalCancel').onclick = () => { document.body.removeChild(modal); resolve(null); };
                });
                if (newShops !== null) {
                    const token = (await sb.auth.getSession()).data.session?.access_token;
                    const res = await fetch('/api/admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ action: 'updateShops', userId, shopIds: newShops })
                    });
                    const result = await res.json();
                    if (res.ok) { showMessage('Shop permissions updated.'); renderAdminPanel(); }
                    else { showMessage(`Error: ${result.error}`, true); }
                }
            };
        });
    } catch (err) {
        container.innerHTML = `<div class="error">Admin panel error: ${err.message}</div>`;
    }
}