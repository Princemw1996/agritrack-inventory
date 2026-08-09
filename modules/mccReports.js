// modules/mccReports.js – MCC Road User Fee Reports
async function renderMCCReports() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading reports...</div>';

    // Load Chart.js from CDN (if not already loaded)
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => renderReports();
        document.head.appendChild(script);
    } else {
        renderReports();
    }

    async function renderReports() {
        try {
            const { data: collections, error } = await sb
                .from('road_user_fee_collections')
                .select('*')
                .order('payment_date', { ascending: false });

            if (error) throw error;
            if (!collections || collections.length === 0) {
                container.innerHTML = '<p>No collections yet.</p>';
                return;
            }

            // Date filter
            let startDate = '';
            let endDate = '';
            let filteredData = collections;

            function applyFilter() {
                const start = document.getElementById('reportStartDate').value;
                const end = document.getElementById('reportEndDate').value;
                if (start && end) {
                    filteredData = collections.filter(c => c.payment_date >= start && c.payment_date <= end);
                } else {
                    filteredData = collections;
                }
                renderCharts(filteredData);
            }

            const html = `
                <h2>📊 MCC Road User Fee Reports</h2>
                <div class="card">
                    <div class="flex-row" style="gap:15px; align-items: flex-end;">
                        <div style="flex:1">
                            <label>Start Date:</label>
                            <input type="date" id="reportStartDate">
                        </div>
                        <div style="flex:1">
                            <label>End Date:</label>
                            <input type="date" id="reportEndDate">
                        </div>
                        <div>
                            <button id="applyDateFilter">Apply Filter</button>
                            <button id="resetDateFilter">Reset</button>
                        </div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <div class="card">
                        <h3>🏷️ Collections by Road Block</h3>
                        <canvas id="pieChart" height="250"></canvas>
                    </div>
                    <div class="card">
                        <h3>👤 Collections by User</h3>
                        <canvas id="barChart" height="250"></canvas>
                    </div>
                </div>
                <div class="card">
                    <h3>📋 Detailed Transactions</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;">
                            <thead>
                                <tr><th>Date</th><th>Receipt #</th><th>Location</th><th>Category</th><th>Amount (MWK)</th><th>Plate</th><th>Method</th><th>Collected By</th></tr>
                            </thead>
                            <tbody id="reportTableBody"></tbody>
                        </table>
                    </div>
                </div>
            `;
            container.innerHTML = html;

            function renderCharts(data) {
                // Pie chart: location distribution
                const locationMap = {};
                data.forEach(c => {
                    locationMap[c.location] = (locationMap[c.location] || 0) + c.amount;
                });
                const locationLabels = Object.keys(locationMap);
                const locationValues = Object.values(locationMap);

                // Bar chart: user collections
                const userMap = {};
                data.forEach(c => {
                    const user = c.collected_by || 'Unknown';
                    userMap[user] = (userMap[user] || 0) + c.amount;
                });
                const userLabels = Object.keys(userMap);
                const userValues = Object.values(userMap);

                // Destroy existing charts if any
                if (window.pieChartInstance) window.pieChartInstance.destroy();
                if (window.barChartInstance) window.barChartInstance.destroy();

                // Pie chart
                const pieCtx = document.getElementById('pieChart').getContext('2d');
                window.pieChartInstance = new Chart(pieCtx, {
                    type: 'pie',
                    data: {
                        labels: locationLabels,
                        datasets: [{
                            data: locationValues,
                            backgroundColor: ['#2C5F2D', '#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });

                // Bar chart
                const barCtx = document.getElementById('barChart').getContext('2d');
                window.barChartInstance = new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: userLabels,
                        datasets: [{
                            label: 'Amount Collected (MWK)',
                            data: userValues,
                            backgroundColor: '#2C5F2D'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) { return value.toLocaleString(); }
                                }
                            }
                        }
                    }
                });

                // Table
                const tbody = document.getElementById('reportTableBody');
                tbody.innerHTML = '';
                data.slice(0, 100).forEach(c => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${new Date(c.payment_date).toLocaleDateString()}</td>
                        <td>${c.receipt_number}</td>
                        <td>${c.location}</td>
                        <td>${c.vehicle_category}</td>
                        <td>${formatNumber(c.amount)}</td>
                        <td>${c.licence_plate}</td>
                        <td>${c.payment_method}</td>
                        <td>${c.collected_by || '—'}</td>
                    `;
                });
            }

            // Date filter handlers
            document.getElementById('applyDateFilter').addEventListener('click', applyFilter);
            document.getElementById('resetDateFilter').addEventListener('click', () => {
                document.getElementById('reportStartDate').value = '';
                document.getElementById('reportEndDate').value = '';
                filteredData = collections;
                renderCharts(filteredData);
            });

            // Initial render (no filter)
            renderCharts(collections);
        } catch (err) {
            container.innerHTML = `<div class="error">Error: ${err.message}</div>`;
        }
    }
}