// modules/auditTrail.js
async function renderAuditTrail() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading audit trail...</div>';
    try {
        // Fetch logs with user email
        let query = sb.from('audit_logs').select('*').order('created_at', { ascending: false });
        const { data: logs, error } = await query;
        if (error) throw error;
        if (!logs || logs.length === 0) {
            container.innerHTML = '<p>No audit logs found.</p>';
            return;
        }
        // Build filter UI
        const users = [...new Set(logs.map(l => l.user_email))].filter(Boolean);
        const actions = [...new Set(logs.map(l => l.action))];
        container.innerHTML = `
            <h2>📜 Audit Trail</h2>
            <div class="card" style="margin-bottom:20px;">
                <div class="flex-row">
                    <div style="flex:1"><label>User:</label><select id="filterUser"><option value="all">All</option>${users.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div>
                    <div style="flex:1"><label>Action:</label><select id="filterAction"><option value="all">All</option>${actions.map(a => `<option value="${a}">${a}</option>`).join('')}</select></div>
                    <div style="flex:1"><label>Start Date:</label><input type="date" id="startDate"></div>
                    <div style="flex:1"><label>End Date:</label><input type="date" id="endDate"></div>
                    <div><button id="applyFilterBtn">Apply Filters</button></div>
                </div>
            </div>
            <div class="card">
                <div id="logsContainer"></div>
            </div>
        `;
        function renderLogs() {
            let filtered = [...logs];
            const userFilter = document.getElementById('filterUser').value;
            const actionFilter = document.getElementById('filterAction').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (userFilter !== 'all') filtered = filtered.filter(l => l.user_email === userFilter);
            if (actionFilter !== 'all') filtered = filtered.filter(l => l.action === actionFilter);
            if (startDate) filtered = filtered.filter(l => l.created_at.split('T')[0] >= startDate);
            if (endDate) filtered = filtered.filter(l => l.created_at.split('T')[0] <= endDate);
            const logsDiv = document.getElementById('logsContainer');
            if (filtered.length === 0) {
                logsDiv.innerHTML = '<p>No logs match the filters.</p>';
                return;
            }
            let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Table</th><th>Record ID</th><th>Details</th></tr></thead><tbody>';
            filtered.forEach(log => {
                html += `<tr>
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.user_email || 'System'}</td>
                    <td>${log.action}</td>
                    <td>${log.table_name || '-'}</td>
                    <td>${log.record_id || '-'}</td>
                    <td>${log.details || ''}</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            logsDiv.innerHTML = html;
        }
        document.getElementById('applyFilterBtn').addEventListener('click', renderLogs);
        renderLogs();
    } catch (err) {
        container.innerHTML = `<div class="error">Error loading audit trail: ${err.message}</div>`;
    }
}