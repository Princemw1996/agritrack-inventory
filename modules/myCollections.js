// modules/myCollections.js – Revenue Collector's own collections (filtered by name)
async function renderMyCollections() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = `
        <h2>📊 My Collections</h2>
        <div class="card">
            <div class="flex-row" style="margin-bottom:15px;">
                <div style="flex:1">
                    <label>Start Date:</label>
                    <input type="date" id="myStart" value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}">
                </div>
                <div style="flex:1">
                    <label>End Date:</label>
                    <input type="date" id="myEnd" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div>
                    <button id="applyMyBtn">Generate Report</button>
                    <button id="myExportCSV">📄 CSV</button>
                    <button id="myExportExcel">📊 Excel</button>
                    <button id="myExportPDF">🖨️ PDF</button>
                </div>
            </div>
            <div id="myReportContent">
                <p>Select date range and click Generate Report.</p>
            </div>
        </div>
    `;

    // Get current user's display name (fallback to email)
    let collectorName = '';
    try {
        const { data: { user } } = await sb.auth.getUser();
        collectorName = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || '';
    } catch (e) { console.warn(e); }

    // Load Chart.js if needed
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => {
            script.onload = resolve;
            setTimeout(resolve, 3000);
        });
    }
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => {
            script.onload = resolve;
            setTimeout(resolve, 3000);
        });
    }

    let currentRecords = [];

    async function generateReport() {
        const start = document.getElementById('myStart').value;
        const end = document.getElementById('myEnd').value;
        if (!start || !end) { alert('Select both dates.'); return; }
        if (start > end) { alert('Start date must be before end date.'); return; }

        const contentDiv = document.getElementById('myReportContent');
        contentDiv.innerHTML = '<div class="loading">Loading...</div>';

        const { data: records, error } = await sb
            .from('road_user_fee_collections')
            .select('*')
            .eq('collected_by', collectorName)
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

        let totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

        let html = `
            <div style="display:grid; grid-template-columns: repeat(2,1fr); gap:15px; margin-bottom:20px;">
                <div class="card"><strong>Total Collected</strong><br>MWK ${formatNumber(totalAmount)}</div>
                <div class="card"><strong>Total Transactions</strong><br>${records.length}</div>
            </div>
            <div class="card">
                <h3>📋 My Collections</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;" id="myTable">
                        <thead>
                            <tr><th>Date</th><th>Receipt #</th><th>Location</th><th>Category</th><th>Amount (MWK)</th><th>Plate</th><th>Method</th></tr>
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
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        contentDiv.innerHTML = html;
    }

    function getTableData() {
        const table = document.querySelector('#myTable');
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
        a.download = `My_Collections_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportExcel() {
        const data = getTableData();
        if (!data || data.rows.length === 0) { alert('No data to export.'); return; }
        const sheetData = [data.headers, ...data.rows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'My Collections');
        XLSX.writeFile(wb, `My_Collections_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    function exportPDF() {
        const content = document.getElementById('myReportContent');
        if (!content || !content.innerHTML.trim()) { alert('No report data to print.'); return; }
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const styles = `
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .card { border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .summary-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 15px; }
            </style>
        `;
        printWindow.document.write('<!DOCTYPE html><html><head><title>My Collections</title>' + styles + '</head><body>');
        printWindow.document.write('<h2>My Collections</h2>');
        const clone = content.cloneNode(true);
        const charts = clone.querySelectorAll('canvas');
        charts.forEach(c => c.parentElement.remove());
        printWindow.document.write(clone.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    document.getElementById('applyMyBtn').addEventListener('click', generateReport);
    document.getElementById('myExportCSV').addEventListener('click', exportCSV);
    document.getElementById('myExportExcel').addEventListener('click', exportExcel);
    document.getElementById('myExportPDF').addEventListener('click', exportPDF);

    generateReport();
}