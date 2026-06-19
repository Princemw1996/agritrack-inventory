// modules/archive.js – Fixed version (manual joins)
async function renderArchive() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = `
        <h2>📦 Archive Data (Admin Only)</h2>
        <div class="card">
            <div class="flex-row" style="gap:15px; align-items: flex-end;">
                <div style="flex:1">
                    <label>Start Date:</label>
                    <input type="date" id="archiveStart" value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}">
                </div>
                <div style="flex:1">
                    <label>End Date:</label>
                    <input type="date" id="archiveEnd" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div style="flex:1">
                    <label>Archive Options:</label>
                    <div>
                        <label><input type="checkbox" id="archiveSales" checked> Sales</label>
                        <label><input type="checkbox" id="archiveTransfers" checked> Transfers</label>
                        <label><input type="checkbox" id="archiveExpenses" checked> Expenses</label>
                        <label><input type="checkbox" id="archiveCash" checked> Cash Records</label>
                    </div>
                </div>
                <div>
                    <button id="previewBtn">Preview</button>
                    <button id="archiveBtn" style="background:#dc3545;">Archive & Download</button>
                </div>
            </div>
            <div id="archivePreview" style="margin-top:20px; display:none;">
                <h3>Preview</h3>
                <div id="previewContent"></div>
            </div>
        </div>
    `;

    const startDate = document.getElementById('archiveStart');
    const endDate = document.getElementById('archiveEnd');
    const previewBtn = document.getElementById('previewBtn');
    const archiveBtn = document.getElementById('archiveBtn');
    const previewDiv = document.getElementById('archivePreview');
    const previewContent = document.getElementById('previewContent');

    async function fetchData() {
        const start = startDate.value;
        const end = endDate.value;
        if (!start || !end) { alert('Please select both dates.'); return null; }
        if (start > end) { alert('Start date must be before end date.'); return null; }

        const includeSales = document.getElementById('archiveSales').checked;
        const includeTransfers = document.getElementById('archiveTransfers').checked;
        const includeExpenses = document.getElementById('archiveExpenses').checked;
        const includeCash = document.getElementById('archiveCash').checked;

        const result = { start, end, sales: [], transfers: [], expenses: [], cash: [] };

        // Sales with product & location names
        if (includeSales) {
            const { data: sales, error } = await sb
                .from('daily_sales')
                .select('*')
                .gte('sale_date', start)
                .lte('sale_date', end);
            if (error) throw error;
            if (sales && sales.length) {
                // Enrich with product and location names
                const productIds = [...new Set(sales.map(s => s.product_id))];
                const locationIds = [...new Set(sales.map(s => s.location_id))];
                const { data: products } = await sb.from('products').select('id, name, pack_size').in('id', productIds);
                const { data: locations } = await sb.from('locations').select('id, name').in('id', locationIds);
                const productMap = new Map(products.map(p => [p.id, p]));
                const locationMap = new Map(locations.map(l => [l.id, l]));
                result.sales = sales.map(s => ({
                    ...s,
                    product: productMap.get(s.product_id),
                    location: locationMap.get(s.location_id)
                }));
            }
        }

        // Transfers with product and location names
        if (includeTransfers) {
            const { data: transfers, error } = await sb
                .from('transfers')
                .select('*')
                .gte('initiated_at', start)
                .lte('initiated_at', end);
            if (error) throw error;
            if (transfers && transfers.length) {
                const productIds = [...new Set(transfers.map(t => t.product_id))];
                const fromIds = [...new Set(transfers.map(t => t.from_location_id))];
                const toIds = [...new Set(transfers.map(t => t.to_location_id))];
                const { data: products } = await sb.from('products').select('id, name, pack_size, unit').in('id', productIds);
                const { data: locations } = await sb.from('locations').select('id, name').in('id', [...fromIds, ...toIds]);
                const productMap = new Map(products.map(p => [p.id, p]));
                const locationMap = new Map(locations.map(l => [l.id, l]));
                result.transfers = transfers.map(t => ({
                    ...t,
                    product: productMap.get(t.product_id),
                    from_location: locationMap.get(t.from_location_id),
                    to_location: locationMap.get(t.to_location_id)
                }));
            }
        }

        // Expenses with category names
        if (includeExpenses) {
            const { data: expenses, error } = await sb
                .from('expenses')
                .select('*')
                .gte('expense_date', start)
                .lte('expense_date', end);
            if (error) throw error;
            if (expenses && expenses.length) {
                const catIds = [...new Set(expenses.map(e => e.category_id))];
                const { data: categories } = await sb.from('expense_categories').select('id, name').in('id', catIds);
                const catMap = new Map(categories.map(c => [c.id, c]));
                result.expenses = expenses.map(e => ({
                    ...e,
                    category: catMap.get(e.category_id)
                }));
            }
        }

        // Cash records with location names
        if (includeCash) {
            const { data: cash, error } = await sb
                .from('daily_cash')
                .select('*')
                .gte('cash_date', start)
                .lte('cash_date', end);
            if (error) throw error;
            if (cash && cash.length) {
                const locIds = [...new Set(cash.map(c => c.location_id))];
                const { data: locations } = await sb.from('locations').select('id, name').in('id', locIds);
                const locMap = new Map(locations.map(l => [l.id, l]));
                result.cash = cash.map(c => ({
                    ...c,
                    location: locMap.get(c.location_id)
                }));
            }
        }

        return result;
    }

    function showPreview(data) {
        previewDiv.style.display = 'block';
        let html = '';
        if (data.sales.length) html += `<p><strong>Sales:</strong> ${data.sales.length} records</p>`;
        if (data.transfers.length) html += `<p><strong>Transfers:</strong> ${data.transfers.length} records</p>`;
        if (data.expenses.length) html += `<p><strong>Expenses:</strong> ${data.expenses.length} records</p>`;
        if (data.cash.length) html += `<p><strong>Cash Records:</strong> ${data.cash.length} records</p>`;
        if (!data.sales.length && !data.transfers.length && !data.expenses.length && !data.cash.length) {
            html = '<p>No data found for the selected date range.</p>';
        }
        previewContent.innerHTML = html;
        window._archiveData = data;
    }

    previewBtn.onclick = async () => {
        try {
            const data = await fetchData();
            if (data) showPreview(data);
        } catch (err) {
            alert('Error previewing: ' + err.message);
        }
    };

    archiveBtn.onclick = async () => {
        const data = window._archiveData;
        if (!data) {
            alert('Please preview first to ensure data is available.');
            return;
        }
        const totalRecords = data.sales.length + data.transfers.length + data.expenses.length + data.cash.length;
        if (totalRecords === 0) {
            alert('No data to archive.');
            return;
        }
        if (!confirm(`Archive ${totalRecords} records? This will download a JSON file and then delete the records from the database.`)) return;

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `archive_${data.start}_to_${data.end}.json`;
        a.click();
        URL.revokeObjectURL(url);

        if (confirm('Records downloaded. Delete them from database to free space?')) {
            try {
                // Delete sales
                if (data.sales.length) {
                    const ids = data.sales.map(s => s.id);
                    await sb.from('daily_sales').delete().in('id', ids);
                }
                // Delete transfers
                if (data.transfers.length) {
                    const ids = data.transfers.map(t => t.id);
                    await sb.from('transfers').delete().in('id', ids);
                }
                // Delete expenses (and their payments)
                if (data.expenses.length) {
                    const expIds = data.expenses.map(e => e.id);
                    await sb.from('expense_payments').delete().in('expense_id', expIds);
                    await sb.from('expenses').delete().in('id', expIds);
                }
                // Delete cash records
                if (data.cash.length) {
                    const ids = data.cash.map(c => c.id);
                    await sb.from('daily_cash').delete().in('id', ids);
                }
                alert(`Successfully archived and deleted ${totalRecords} records.`);
                window._archiveData = null;
                previewDiv.style.display = 'none';
                previewContent.innerHTML = '';
            } catch (err) {
                alert('Error deleting records: ' + err.message);
            }
        }
    };
}