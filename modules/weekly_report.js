async function renderWeeklyReport(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Weekly Summary</h2>
            <label>Week ending (Sunday):</label>
            <input type="date" id="weekEnd" value="${new Date().toISOString().split('T')[0]}">
            <button id="loadReportBtn">Load Report</button>
            <div id="reportOutput"></div>
        </div>
    `;
    document.getElementById('loadReportBtn').addEventListener('click', async () => {
        const endDate = document.getElementById('weekEnd').value;
        const start = new Date(endDate);
        start.setDate(start.getDate() - 6);
        const startStr = start.toISOString().split('T')[0];
        const output = document.getElementById('reportOutput');
        output.innerHTML = '<h3>Sales by Location</h3>';
        // Sales
        const { data: sales } = await supabase
            .from('daily_sales')
            .select('location_id, locations(name), revenue, quantity_sold')
            .gte('sale_date', startStr).lte('sale_date', endDate);
        if (sales && sales.length) {
            const group = sales.reduce((acc, s) => {
                const name = s.locations.name;
                if (!acc[name]) acc[name] = { revenue: 0, units: 0 };
                acc[name].revenue += s.revenue;
                acc[name].units += s.quantity_sold;
                return acc;
            }, {});
            let table = '<table><thead><tr><th>Location</th><th>Revenue (MWK)</th><th>Units Sold</th></tr></thead><tbody>';
            for (const [loc, vals] of Object.entries(group)) {
                table += `<tr><td>${loc}</td><td>${vals.revenue.toFixed(2)}</td><td>${vals.units}</td></tr>`;
            }
            table += '</tbody></table>';
            output.innerHTML += table;
        } else {
            output.innerHTML += '<p>No sales in this period.</p>';
        }
        // Cash summary
        output.innerHTML += '<h3>Cash Reconciliation</h3>';
        const { data: cash } = await supabase
            .from('daily_cash')
            .select('locations(name), cash_date, opening_balance, closing_balance, difference')
            .gte('cash_date', startStr).lte('cash_date', endDate);
        if (cash && cash.length) {
            let table = '<table><thead><tr><th>Location</th><th>Date</th><th>Opening</th><th>Closing</th><th>Difference</th></tr></thead><tbody>';
            cash.forEach(c => {
                table += `<tr><td>${c.locations.name}</td><td>${c.cash_date}</td><td>${c.opening_balance}</td><td>${c.closing_balance}</td><td>${c.difference}</td></tr>`;
            });
            table += '</tbody></table>';
            output.innerHTML += table;
        } else {
            output.innerHTML += '<p>No cash records in this period.</p>';
        }
        // Transfers
        output.innerHTML += '<h3>Stock Transfers</h3>';
        const { data: transfers } = await supabase
            .from('transfers')
            .select('from_location_id(name), to_location_id(name), products(name), quantity, status')
            .gte('initiated_at', startStr).lte('initiated_at', endDate);
        if (transfers && transfers.length) {
            let table = '<table><thead><tr><th>From</th><th>To</th><th>Product</th><th>Quantity</th><th>Status</th></tr></thead><tbody>';
            transfers.forEach(t => {
                table += `<tr><td>${t.from_location_id.name}</td><td>${t.to_location_id.name}</td><td>${t.products.name}</td><td>${t.quantity}</td><td>${t.status}</td></tr>`;
            });
            table += '</tbody></table>';
            output.innerHTML += table;
        } else {
            output.innerHTML += '<p>No transfers in this period.</p>';
        }
    });
}