// modules/roadUserFeeReport.js – MCC Road User Fee Report with Export
async function renderRoadUserFeeReport() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = `
        <h2>🚗 MCC Road User Fee Report</h2>
        <div class="card">
            <div class="flex-row" style="margin-bottom:15px;">
                <div style="flex:1">
                    <label>Start Date:</label>
                    <input type="date" id="reportStart" value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}">
                </div>
                <div style="flex:1">
                    <label>End Date:</label>
                    <input type="date" id="reportEnd" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div style="flex:1">
                    <button id="applyReportBtn">Generate Report</button>
                    <button id="exportCSVBtn">📄 CSV</button>
                    <button id="exportExcelBtn">📊 Excel</button>
                    <button id="exportPDFBtn">🖨️ PDF</button>
                </div>
            </div>
            <div id="reportContent">
                <p>Select date range and click Generate Report.</p>
            </div>
        </div>
    `;

    // Load Chart.js from CDN (if not already loaded)
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = () => console.log('Chart.js loaded');
        document.head.appendChild(script);
        await new Promise(resolve => {
            script.onload = resolve;
            setTimeout(resolve, 3000);
        });
    }

    // Load SheetJS for Excel export (if not already loaded)
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
        script.onload = () => console.log('SheetJS loaded');
        document.head.appendChild(script);
        await new Promise(resolve => {
            script.onload = resolve;
            setTimeout(resolve, 3000);
        });
    }

    let currentRecords = [];

    async function generateReport() {
        const start = document.getElementById('reportStart').value;
        const end = document.getElementById('reportEnd').value;
        if (!start || !end) { alert('Select both dates.'); return; }
        if (start > end) { alert('Start date must be before end date.'); return; }

        const contentDiv = document.getElementById('reportContent');
        contentDiv.innerHTML = '<div class="loading">Loading report...</div>';

        const { data: records, error } = await sb
            .from('road_user_fee_collections')
            .select('*')
            .gte('payment_date', start)
            .lte('payment_date', end + 'T23:59:59')
            .order('payment_date', { ascending: false });

        if (error) {
            contentDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            return;
        }

        if (!records || records.length === 0) {
            contentDiv.innerHTML = '<p>No records found for the selected period.</p>';
            currentRecords = [];
            return;
        }

        currentRecords = records;

        // Calculate totals
        let totalAmount = 0;
        const locationTotals = {};
        const userTotals = {};
        const locationColors = {
            'Dunduzu Road Block': '#2C5F2D',
            'Joel Road Block': '#1F4A1F',
            'Lusangazi Road Block': '#3A6B3D'
        };

        records.forEach(r => {
            totalAmount += r.amount;
            locationTotals[r.location] = (locationTotals[r.location] || 0) + r.amount;
            const user = r.collected_by || 'Unknown';
            userTotals[user] = (userTotals[user] || 0) + r.amount;
        });

        // Build HTML
        let html = `
            <div style="display:grid; grid-template-columns: repeat(3,1fr); gap:15px; margin-bottom:20px;">
                <div class="card"><strong>Total Collected</strong><br>MWK ${formatNumber(totalAmount)}</div>
                <div class="card"><strong>Total Transactions</strong><br>${records.length}</div>
                <div class="card"><strong>Road Blocks</strong><br>${Object.keys(locationTotals).length}</div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                <div class="card">
                    <h3>📊 Distribution by Road Block</h3>
                    <canvas id="pieChart" height="200"></canvas>
                </div>
                <div class="card">
                    <h3>📊 Collected by Collector</h3>
                    <canvas id="barChart" height="200"></canvas>
                </div>
            </div>
            <div class="card">
                <h3>📋 Transaction Details</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;" id="reportTable">
                        <thead>
                            <tr><th>Date</th><th>Receipt #</th><th>Location</th><th>Category</th><th>Amount (MWK)</th><th>Plate</th><th>Method</th><th>Collected By</th></tr>
                        </thead>
                        <tbody>
                            ${records.map(r => `
                                <tr>
                                    <td>${new Date(r.payment_date).toLocaleDateString()}</td>
                                    <td>${r.receipt_number}</td>
                                    <td>${r.location}</td>
                                    <td>${r.vehicle_category}</td>
                                    <td>${formatNumber(r.amount)}</td>
                                    <td>${r.licence_plate}</td>
                                    <td>${r.payment_method}</td>
                                    <td>${r.collected_by || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        contentDiv.innerHTML = html;

        // Destroy existing charts if any
        if (window._pieChart) { window._pieChart.destroy(); }
        if (window._barChart) { window._barChart.destroy(); }

        // Pie Chart
        const pieCtx = document.getElementById('pieChart').getContext('2d');
        const pieData = {
            labels: Object.keys(locationTotals),
            datasets: [{
                data: Object.values(locationTotals),
                backgroundColor: ['#2C5F2D', '#4A8B4B', '#6AAB6B'],
                borderWidth: 1
            }]
        };
        window._pieChart = new Chart(pieCtx, {
            type: 'pie',
            data: pieData,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (ctx) => `MWK ${formatNumber(ctx.raw)}` } }
                }
            }
        });

        // Bar Chart (users)
        const barCtx = document.getElementById('barChart').getContext('2d');
        const sortedUsers = Object.entries(userTotals).sort((a,b) => b[1] - a[1]);
        const barData = {
            labels: sortedUsers.map(u => u[0]),
            datasets: [{
                label: 'Amount Collected (MWK)',
                data: sortedUsers.map(u => u[1]),
                backgroundColor: '#2C5F2D',
                borderColor: '#1F4A1F',
                borderWidth: 1
            }]
        };
        window._barChart = new Chart(barCtx, {
            type: 'bar',
            data: barData,
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `MWK ${formatNumber(ctx.raw)}` } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: (v) => formatNumber(v) } }
                }
            }
        });
    }

    // Export functions
    function getTableData() {
        const table = document.querySelector('#reportTable');
        if (!table) return null;
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
            return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        });
        return { headers, rows };
    }

    function exportCSV() {
        const data = getTableData();
        if (!data || data.rows.length === 0) { alert('No data to export.'); return; }
        const csvRows = [data.headers.join(','), ...data.rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MCC_Road_User_Fee_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportExcel() {
        const data = getTableData();
        if (!data || data.rows.length === 0) { alert('No data to export.'); return; }
        const sheetData = [data.headers, ...data.rows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'MCC Report');
        XLSX.writeFile(wb, `MCC_Road_User_Fee_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    function exportPDF() {
        const content = document.getElementById('reportContent');
        if (!content || !content.innerHTML.trim()) { alert('No report data to print.'); return; }
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const styles = `
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .card { border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 15px; }
                .chart-container { display: none; }
            </style>
        `;
        printWindow.document.write('<!DOCTYPE html><html><head><title>MCC Road User Fee Report</title>' + styles + '</head><body>');
        printWindow.document.write('<h2>MCC Road User Fee Report</h2>');
        // Clone content and remove charts (canvas elements)
        const clone = content.cloneNode(true);
        const charts = clone.querySelectorAll('canvas');
        charts.forEach(c => c.parentElement.remove());
        printWindow.document.write(clone.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    // Event listeners
    document.getElementById('applyReportBtn').addEventListener('click', generateReport);
    document.getElementById('exportCSVBtn').addEventListener('click', exportCSV);
    document.getElementById('exportExcelBtn').addEventListener('click', exportExcel);
    document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);

    generateReport(); // Auto‑load on initial render
}