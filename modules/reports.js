// modules/reports.js – Full working version with manual joins for stock movement
async function renderReports() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading reports...</div>';
    try {
        // Helper
        const formatDate = (date) => date ? new Date(date).toISOString().split('T')[0] : '';

        // Build UI
        container.innerHTML = `
            <h2>📊 Reports Dashboard</h2>
            <div class="card" style="margin-bottom:20px;">
                <div class="flex-row" style="gap:15px; align-items: flex-end;">
                    <div style="flex:1">
                        <label>Report Type:</label>
                        <select id="reportType">
                            <option value="salesSummary">Sales Summary</option>
                            <option value="productSales">Product Sales Report</option>
                            <option value="trendingProducts">Trending Products</option>
                            <option value="expenseReport">Expense Report</option>
                            <option value="currentStock">Current Stock Report</option>
                            <option value="stockMovement">Stock Movement Report</option>
                            <option value="profitLoss">Profit / Loss Summary</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Start Date (optional):</label>
                        <input type="date" id="startDate">
                    </div>
                    <div style="flex:1">
                        <label>End Date (optional):</label>
                        <input type="date" id="endDate">
                    </div>
                    <div style="flex:1" id="locationFilterContainer">
                        <label>Location (shop/warehouse):</label>
                        <select id="locationFilter">
                            <option value="all">All Locations</option>
                        </select>
                    </div>
                    <div>
                        <button id="applyFilterBtn">Apply Filters</button>
                        <button id="exportCSVBtn">📄 CSV</button>
                        <button id="exportExcelBtn">📊 Excel</button>
                        <button id="printReportBtn">🖨️ PDF / Print</button>
                    </div>
                </div>
            </div>
            <div class="card">
                <div id="reportContent">
                    <p>Select a report type and click Apply Filters.</p>
                </div>
            </div>
        `;

        // Populate location dropdown
        const { data: locations } = await sb.from('locations').select('id, name');
        const locationSelect = document.getElementById('locationFilter');
        locationSelect.innerHTML = '<option value="all">All Locations</option>' + (locations || []).map(l => `<option value="${l.id}">${l.name}</option>`).join('');

        function showLocationFilter(show) {
            document.getElementById('locationFilterContainer').style.display = show ? 'block' : 'none';
        }

        // Helper to extract table data for export (unchanged)
        function getTableData() {
            const table = document.querySelector('#reportContent table');
            if (!table) return null;
            const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            });
            return { headers, rows };
        }

        function exportToCSV() {
            const data = getTableData();
            if (!data || data.rows.length === 0) { alert('No data to export.'); return; }
            const csvRows = [data.headers.join(','), ...data.rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))];
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${document.getElementById('reportType').options[document.getElementById('reportType').selectedIndex].text}_${new Date().toISOString().slice(0,19)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function exportToExcel() {
            const data = getTableData();
            if (!data || data.rows.length === 0) { alert('No data to export.'); return; }
            const sheetData = [data.headers, ...data.rows];
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report');
            XLSX.writeFile(wb, `${document.getElementById('reportType').options[document.getElementById('reportType').selectedIndex].text}_${new Date().toISOString().slice(0,19)}.xlsx`);
        }

        function exportToPDF() {
            const reportContent = document.getElementById('reportContent');
            if (!reportContent || !reportContent.innerHTML.trim() || reportContent.innerText.includes('No sales data')) {
                alert('No report data to print.');
                return;
            }
            const printContent = reportContent.cloneNode(true);
            const styles = `
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .card { border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px; }
                    .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 15px; margin-bottom: 20px; }
                </style>
            `;
            const printWindow = window.open('', '_blank');
            printWindow.document.write('<!DOCTYPE html><html><head><title>AgriTrack Report</title>' + styles + '</head><body>');
            printWindow.document.write(printContent.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }

        async function loadReport() {
            const reportType = document.getElementById('reportType').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const locationId = document.getElementById('locationFilter').value;
            const reportsWithLocation = ['salesSummary', 'productSales', 'trendingProducts', 'currentStock', 'stockMovement'];
            showLocationFilter(reportsWithLocation.includes(reportType));
            const contentDiv = document.getElementById('reportContent');
            contentDiv.innerHTML = '<div class="loading">Loading report...</div>';
            try {
                if (reportType === 'salesSummary') await renderSalesSummary(startDate, endDate, locationId, contentDiv);
                else if (reportType === 'productSales') await renderProductSales(startDate, endDate, locationId, contentDiv);
                else if (reportType === 'trendingProducts') await renderTrendingProducts(startDate, endDate, locationId, contentDiv);
                else if (reportType === 'expenseReport') await renderExpenseReport(startDate, endDate, contentDiv);
                else if (reportType === 'currentStock') await renderCurrentStock(locationId, contentDiv);
                else if (reportType === 'stockMovement') await renderStockMovement(startDate, endDate, locationId, contentDiv);
                else if (reportType === 'profitLoss') await renderProfitLoss(startDate, endDate, contentDiv);
                else contentDiv.innerHTML = '<p>Report not implemented yet.</p>';
            } catch (err) {
                contentDiv.innerHTML = `<div class="error">Error: ${err.message}</div>`;
            }
        }

        // ========== Report rendering functions (some unchanged, some fixed) ==========
        async function renderSalesSummary(startDate, endDate, locationId, container) {
            let query = sb.from('daily_sales').select('sale_date, revenue, discount_amount, payment_method, location_id');
            if (startDate) query = query.gte('sale_date', startDate);
            if (endDate) query = query.lte('sale_date', endDate);
            if (locationId !== 'all') query = query.eq('location_id', parseInt(locationId));
            const { data, error } = await query.order('sale_date', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { container.innerHTML = '<p>No sales data.</p>'; return; }
            const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
            const totalDiscount = data.reduce((s, r) => s + (r.discount_amount || 0), 0);
            const netSales = totalRevenue - totalDiscount;
            let html = '<h3>Sales Summary</h3>' +
                '<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:15px; margin-bottom:20px;">' +
                '<div class="card"><strong>Total Revenue</strong><br>MWK ' + formatNumber(totalRevenue) + '</div>' +
                '<div class="card"><strong>Total Discount</strong><br>MWK ' + formatNumber(totalDiscount) + '</div>' +
                '<div class="card"><strong>Net Sales</strong><br>MWK ' + formatNumber(netSales) + '</div>' +
                '</div>' +
                '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead>' +
                '<tr><th>Date</th><th>Revenue (MWK)</th><th>Discount (MWK)</th><th>Net (MWK)</th><th>Payment Method</th></tr>' +
                '</thead><tbody>';
            for (const row of data) {
                html += '<tr>' +
                    '<td>' + row.sale_date + '</td>' +
                    '<td>' + formatNumber(row.revenue) + '</td>' +
                    '<td>' + formatNumber(row.discount_amount || 0) + '</td>' +
                    '<td>' + formatNumber(row.revenue - (row.discount_amount || 0)) + '</td>' +
                    '<td>' + row.payment_method + '</td>' +
                    '</tr>';
            }
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        async function renderProductSales(startDate, endDate, locationId, container) {
            let query = sb.from('daily_sales').select('product_id, quantity_sold, revenue, discount_amount, products(name, pack_size)');
            if (startDate) query = query.gte('sale_date', startDate);
            if (endDate) query = query.lte('sale_date', endDate);
            if (locationId !== 'all') query = query.eq('location_id', parseInt(locationId));
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) { container.innerHTML = '<p>No sales data.</p>'; return; }
            const productMap = new Map();
            for (const sale of data) {
                const name = sale.products?.name || 'Unknown';
                const pack = sale.products?.pack_size || '';
                const key = name + ' - ' + pack;
                if (!productMap.has(key)) productMap.set(key, { qty: 0, revenue: 0, discount: 0 });
                const entry = productMap.get(key);
                entry.qty += sale.quantity_sold;
                entry.revenue += sale.revenue;
                entry.discount += sale.discount_amount || 0;
            }
            const rows = Array.from(productMap.entries()).map(([product, d]) => ({ product, ...d }));
            rows.sort((a,b) => b.revenue - a.revenue);
            let html = '<h3>Product Sales Report</h3><div style="overflow-x:auto;"><table style="width:100%;"><thead>' +
                '<tr><th>Product</th><th>Quantity Sold</th><th>Revenue (MWK)</th><th>Discount (MWK)</th><th>Net (MWK)</th></tr>' +
                '</thead><tbody>';
            for (const row of rows) {
                const net = row.revenue - row.discount;
                html += '<tr>' +
                    '<td>' + row.product + '</td>' +
                    '<td>' + row.qty + '</td>' +
                    '<td>' + formatNumber(row.revenue) + '</td>' +
                    '<td>' + formatNumber(row.discount) + '</td>' +
                    '<td>' + formatNumber(net) + '</td>' +
                    '</tr>';
            }
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        async function renderTrendingProducts(startDate, endDate, locationId, container) {
            let query = sb.from('daily_sales').select('product_id, quantity_sold, revenue, products(name, pack_size)');
            if (startDate) query = query.gte('sale_date', startDate);
            if (endDate) query = query.lte('sale_date', endDate);
            if (locationId !== 'all') query = query.eq('location_id', parseInt(locationId));
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) { container.innerHTML = '<p>No sales data.</p>'; return; }
            const productMap = new Map();
            for (const sale of data) {
                const name = sale.products?.name || 'Unknown';
                const pack = sale.products?.pack_size || '';
                const key = name + ' - ' + pack;
                if (!productMap.has(key)) productMap.set(key, { qty: 0, revenue: 0 });
                const entry = productMap.get(key);
                entry.qty += sale.quantity_sold;
                entry.revenue += sale.revenue;
            }
            const rows = Array.from(productMap.entries()).map(([product, d]) => ({ product, ...d }));
            rows.sort((a,b) => b.qty - a.qty);
            const top10 = rows.slice(0,10);
            let html = '<h3>Trending Products (Top 10 by Quantity)</h3><div style="overflow-x:auto;"><table style="width:100%;"><thead>' +
                '<tr><th>Rank</th><th>Product</th><th>Quantity Sold</th><th>Revenue (MWK)</th></tr>' +
                '</thead><tbody>';
            top10.forEach((row, idx) => {
                html += '<td>' +
                    '<td>' + (idx+1) + '</td>' +
                    '<td>' + row.product + '</td>' +
                    '<td>' + row.qty + '</td>' +
                    '<td>' + formatNumber(row.revenue) + '</td>' +
                    '<tr>';
            });
            html += '</tbody></tr></div>';
            container.innerHTML = html;
        }

        async function renderExpenseReport(startDate, endDate, container) {
            let query = sb.from('expenses').select('expense_date, amount, description, expense_categories(name)');
            if (startDate) query = query.gte('expense_date', startDate);
            if (endDate) query = query.lte('expense_date', endDate);
            const { data, error } = await query.order('expense_date', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { container.innerHTML = '<p>No expenses.</p>'; return; }
            const total = data.reduce((s, e) => s + e.amount, 0);
            let html = '<h3>Expense Report</h3>' +
                '<div class="card" style="margin-bottom:15px;"><strong>Total Expenses:</strong> MWK ' + formatNumber(total) + '</div>' +
                '<div style="overflow-x:auto;"><table style="width:100%;"><thead>' +
                '<tr><th>Date</th><th>Category</th><th>Description</th><th>Amount (MWK)</th></tr>' +
                '</thead><tbody>';
            for (const exp of data) {
                html += '<td>' +
                    '<td>' + exp.expense_date + '</td>' +
                    '<td>' + (exp.expense_categories?.name || 'Uncategorized') + '</td>' +
                    '<td>' + (exp.description || '—') + '</td>' +
                    '<td>' + formatNumber(exp.amount) + '</td>' +
                    '</tr>';
            }
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        async function renderCurrentStock(locationId, container) {
            let query = sb.from('inventory').select('location_id, product_id, quantity, products(name, unit, pack_size, current_price), locations(name)');
            if (locationId !== 'all') query = query.eq('location_id', parseInt(locationId));
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) { container.innerHTML = '<p>No stock.</p>'; return; }
            const locationMap = new Map();
            for (const item of data) {
                const locName = item.locations?.name || 'Unknown';
                if (!locationMap.has(locName)) locationMap.set(locName, []);
                locationMap.get(locName).push(item);
            }
            let html = '<h3>Current Stock Report</h3>';
            for (const [locName, items] of locationMap.entries()) {
                html += '<details><summary><strong>' + locName + '</strong></summary>' +
                    '<table style="width:100%;"><thead>' +
                    '<tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Selling Price (MWK)</th><th>Total Value (MWK)</th></tr>' +
                    '</thead><tbody>';
                let grand = 0;
                for (const item of items) {
                    const p = item.products;
                    const qty = item.quantity;
                    const price = p.current_price || 0;
                    const total = qty * price;
                    grand += total;
                    html += '<tr>' +
                        '<td>' + p.name + '</td>' +
                        '<td>' + p.unit + '</td>' +
                        '<td>' + p.pack_size + '</td>' +
                        '<td>' + qty + '</td>' +
                        '<td>' + formatNumber(price) + '</td>' +
                        '<td>' + formatNumber(total) + '</td>' +
                        '</tr>';
                }
                html += '<tr style="background:#e9f5e9;"><td colspan="5"><strong>GRAND TOTAL</strong></td>' +
                    '<td><strong>' + formatNumber(grand) + ' MWK</strong></td>' +
                    '</tbody></table></details><br>';
            }
            container.innerHTML = html;
        }

        // ========== FIXED STOCK MOVEMENT REPORT (manual joins) ==========
        async function renderStockMovement(startDate, endDate, locationId, container) {
            // Step 1: fetch transfers
            let query = sb.from('transfers').select('*');
            if (startDate) query = query.gte('initiated_at', startDate);
            if (endDate) query = query.lte('initiated_at', endDate);
            if (locationId !== 'all') {
                query = query.or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`);
            }
            const { data: transfers, error } = await query.order('initiated_at', { ascending: false });
            if (error) throw error;
            if (!transfers || transfers.length === 0) {
                container.innerHTML = '<p>No stock movements for the selected period/location.</p>';
                return;
            }
            // Step 2: fetch all locations for mapping
            const { data: allLocations } = await sb.from('locations').select('id, name');
            const locationMap = new Map(allLocations.map(l => [l.id, l.name]));
            // Step 3: fetch all products for mapping
            const { data: allProducts } = await sb.from('products').select('id, name, pack_size, unit');
            const productMap = new Map(allProducts.map(p => [p.id, p]));
            // Build table
            let html = '<h3>Stock Movement Report (Transfers)</h3><div style="overflow-x:auto;"><table style="width:100%;"><thead>' +
                '<tr><th>Date</th><th>Product</th><th>From</th><th>To</th><th>Quantity</th><th>Status</th></tr>' +
                '</thead><tbody>';
            for (const t of transfers) {
                const product = productMap.get(t.product_id);
                const productName = product ? `${product.name} - ${product.pack_size}` : 'Unknown';
                const fromName = locationMap.get(t.from_location_id) || '?';
                const toName = locationMap.get(t.to_location_id) || '?';
                html += '<tr>' +
                    '<td>' + (t.initiated_at ? t.initiated_at.split('T')[0] : '') + '</td>' +
                    '<td>' + productName + '</td>' +
                    '<td>' + fromName + '</td>' +
                    '<td>' + toName + '</td>' +
                    '<td>' + t.quantity + '</td>' +
                    '<td>' + t.status + '</td>' +
                    '</tr>';
            }
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        async function renderProfitLoss(startDate, endDate, container) {
            let salesQuery = sb.from('daily_sales').select('revenue, discount_amount, quantity_sold, product_id');
            if (startDate) salesQuery = salesQuery.gte('sale_date', startDate);
            if (endDate) salesQuery = salesQuery.lte('sale_date', endDate);
            const { data: sales, error: sErr } = await salesQuery;
            if (sErr) throw sErr;
            const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0);
            const totalDiscount = sales.reduce((s, r) => s + (r.discount_amount || 0), 0);
            const productIds = [...new Set(sales.map(s => s.product_id))];
            let costMap = new Map();
            if (productIds.length) {
                const { data: costs } = await sb.from('products').select('id, cost_price').in('id', productIds);
                costs?.forEach(c => costMap.set(c.id, c.cost_price || 0));
            }
            let totalCost = 0;
            for (const sale of sales) {
                const cost = costMap.get(sale.product_id) || 0;
                totalCost += sale.quantity_sold * cost;
            }
            let expQuery = sb.from('expenses').select('amount');
            if (startDate) expQuery = expQuery.gte('expense_date', startDate);
            if (endDate) expQuery = expQuery.lte('expense_date', endDate);
            const { data: expenses } = await expQuery;
            const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) || 0;
            const grossProfit = totalRevenue - totalCost;
            const netProfit = grossProfit - totalExpenses;
            container.innerHTML = 
                '<h3>Profit / Loss Summary</h3>' +
                '<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:15px;">' +
                '<div class="card"><strong>Total Sales Revenue</strong><br>MWK ' + formatNumber(totalRevenue) + '</div>' +
                '<div class="card"><strong>Total Discounts</strong><br>MWK ' + formatNumber(totalDiscount) + '</div>' +
                '<div class="card"><strong>Cost of Goods Sold</strong><br>MWK ' + formatNumber(totalCost) + '</div>' +
                '<div class="card"><strong>Total Expenses</strong><br>MWK ' + formatNumber(totalExpenses) + '</div>' +
                '</div>' +
                '<div style="background:#e9f5e9; padding:15px; border-radius:12px; margin-top:15px;">' +
                '<strong>Gross Profit:</strong> MWK ' + formatNumber(grossProfit) + '<br>' +
                '<small>(Total Revenue - COGS)</small>' +
                '</div>' +
                '<div style="background:#e9f5e9; padding:15px; border-radius:12px; margin-top:15px;">' +
                '<strong>Net Profit:</strong> MWK ' + formatNumber(netProfit) + '<br>' +
                '<small>(Gross Profit - Total Expenses)</small>' +
                '</div>';
        }

        // Attach event listeners
        document.getElementById('applyFilterBtn').addEventListener('click', loadReport);
        document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
        document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
        document.getElementById('printReportBtn').addEventListener('click', exportToPDF);
        loadReport();
    } catch (err) {
        container.innerHTML = `<div class="error">Error loading reports: ${err.message}</div>`;
    }
}