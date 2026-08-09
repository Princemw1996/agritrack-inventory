// modules/roadUserFee.js – Mzuzu City Council Road User Fee Collection
async function renderRoadUserFee() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading...</div>';

    const LOCATIONS = ['Dunduzu Road Block', 'Joel Road Block', 'Lusangazi Road Block'];
    const CATEGORIES = {
        'Light vehicles': 1000,
        '2 to 4 tons': 3000,
        'Big vehicles': 5000
    };

    // Helper: generate receipt number (YYMMDD-XXXX)
    function generateReceiptNumber() {
        const now = new Date();
        const datePart = now.getFullYear().toString().slice(2) +
                         String(now.getMonth() + 1).padStart(2, '0') +
                         String(now.getDate()).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        return `${datePart}-${random}`;
    }

    // Print receipt
    function printReceipt(data) {
        const receiptContent = `
        <!DOCTYPE html>
        <html>
        <head><title>MCC Road User Fee Receipt</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
            .receipt { max-width: 400px; margin: auto; border: 2px solid #2C5F2D; padding: 20px; border-radius: 12px; }
            .header { text-align: center; border-bottom: 2px solid #2C5F2D; padding-bottom: 10px; }
            .header h1 { color: #2C5F2D; margin: 0; font-size: 22px; }
            .header p { margin: 2px 0; color: #555; }
            .details { margin: 15px 0; }
            .details table { width: 100%; }
            .details td { padding: 5px 0; }
            .footer { text-align: center; font-size: 12px; color: #777; margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h1> MZUZU CITY COUNCIL</h1>
                    <p>Road User Fee Collection</p>
                    <p><strong>Receipt #:</strong> ${data.receipt_number}</p>
                </div>
                <div class="details">
                    <table>
                        <tr><td><strong>Location:</strong></td><td>${data.location}</td></tr>
                        <tr><td><strong>Vehicle Category:</strong></td><td>${data.category}</td></tr>
                        <tr><td><strong>Amount (MWK):</strong></td><td>${data.amount}</td></tr>
                        <tr><td><strong>Licence Plate:</strong></td><td>${data.licence_plate}</td></tr>
                        <tr><td><strong>Payment Method:</strong></td><td>${data.method}</td></tr>
                        <tr><td><strong>Collected By:</strong></td><td>${data.collected_by}</td></tr>
                        <tr><td><strong>Date:</strong></td><td>${new Date(data.date).toLocaleString()}</td></tr>
                        <tr><td><strong>Tax Type:</strong></td><td>MCC Road User Fee</td></tr>
                    </table>
                </div>
                <div class="footer">
                    <p>Thank you for contributing to Mzuzu City development.</p>
                    <p>This is a computer-generated receipt.</p>
                </div>
            </div>
            <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };</script>
        </body>
        </html>
        `;
        const win = window.open('', '_blank', 'width=500,height=700');
        win.document.write(receiptContent);
        win.document.close();
    }

    // Render the UI
    async function renderForm() {
        // Fetch current user to get name
        let collectorName = '';
        try {
            const { data: { user }, error } = await sb.auth.getUser();
            if (!error && user) {
                // Use user_metadata.name if available, else email
                collectorName = user.user_metadata?.name || user.email || '';
            }
        } catch (e) {
            console.warn('Could not get user info:', e);
        }

        // Fetch existing collections
        const { data: collections, error } = await sb
            .from('road_user_fee_collections')
            .select('*')
            .order('payment_date', { ascending: false });
        if (error) {
            container.innerHTML = `<div class="error">Error loading records: ${error.message}</div>`;
            return;
        }

        let html = `
            <h2>🚗 Mzuzu City Council – Road User Fee</h2>
            <div class="card">
                <h3>📝 New Collection</h3>
                <div class="flex-row">
                    <div style="flex:1">
                        <label>Location:</label>
                        <select id="feeLocation">
                            ${LOCATIONS.map(l => `<option value="${l}">${l}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Vehicle Category:</label>
                        <select id="feeCategory">
                            ${Object.keys(CATEGORIES).map(c => `<option value="${c}">${c} (MWK ${CATEGORIES[c]})</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Licence Plate:</label>
                        <input type="text" id="feePlate" placeholder="e.g., MZ 1234">
                    </div>
                    <div style="flex:1">
                        <label>Payment Method:</label>
                        <select id="feeMethod">
                            <option value="cash">Cash</option>
                            <option value="mobile_money">Mobile Money</option>
                            <option value="bank">Bank</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Collected By:</label>
                        <input type="text" id="feeCollector" value="${collectorName}" readonly style="background:#f5f5f5;">
                    </div>
                </div>
                <div style="margin-top:15px;">
                    <button id="saveFeeBtn" style="background:#2C5F2D;">Collect & Print Receipt</button>
                </div>
            </div>
            <div class="card">
                <h3>📋 Collection History</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;">
                        <thead>
                            <tr><th>Date</th><th>Receipt #</th><th>Location</th><th>Category</th><th>Amount (MWK)</th><th>Plate</th><th>Method</th><th>Collected By</th></tr>
                        </thead>
                        <tbody id="feeTableBody">
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const tbody = document.getElementById('feeTableBody');
        tbody.innerHTML = '';
        for (const rec of collections) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${new Date(rec.payment_date).toLocaleDateString()}</td>
                <td>${rec.receipt_number}</td>
                <td>${rec.location}</td>
                <td>${rec.vehicle_category}</td>
                <td>${formatNumber(rec.amount)}</td>
                <td>${rec.licence_plate}</td>
                <td>${rec.payment_method}</td>
                <td>${rec.collected_by || '—'}</td>
            `;
        }

        // Save handler
        document.getElementById('saveFeeBtn').onclick = async () => {
            const location = document.getElementById('feeLocation').value;
            const category = document.getElementById('feeCategory').value;
            const plate = document.getElementById('feePlate').value.trim();
            const method = document.getElementById('feeMethod').value;
            const collector = document.getElementById('feeCollector').value.trim() || null;
            const amount = CATEGORIES[category];
            const receiptNumber = generateReceiptNumber();

            if (!plate) {
                showMessage('Licence plate is required.', true);
                return;
            }

            const data = {
                location,
                vehicle_category: category,
                amount,
                licence_plate: plate,
                payment_method: method,
                collected_by: collector,
                receipt_number: receiptNumber,
                payment_date: new Date().toISOString(),
                tax_type: 'MCC road user fee'
            };

            try {
                const { error } = await sb.from('road_user_fee_collections').insert(data);
                if (error) throw error;
                showMessage(`✅ Collection recorded. Receipt #${receiptNumber}`, false);
                // Print receipt
                printReceipt({
                    receipt_number: receiptNumber,
                    location: location,
                    category: category,
                    amount: amount,
                    licence_plate: plate,
                    method: method,
                    collected_by: collector,
                    date: new Date().toISOString()
                });
                // Refresh form
                renderForm();
            } catch (err) {
                showMessage(`Error: ${err.message}`, true);
            }
        };
    }
// modules/roadUserFee.js – Mzuzu City Council Road User Fee Collection
async function renderRoadUserFee() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading...</div>';

    const LOCATIONS = ['Dunduzu Road Block', 'Joel Road Block', 'Lusangazi Road Block'];
    const CATEGORIES = {
        'Light vehicles': 1000,
        '2 to 4 tons': 3000,
        'Big vehicles': 5000
    };

    function generateReceiptNumber() {
        const now = new Date();
        const datePart = now.getFullYear().toString().slice(2) +
                         String(now.getMonth() + 1).padStart(2, '0') +
                         String(now.getDate()).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        return `${datePart}-${random}`;
    }

    // Print receipt – shows "Collected By: MCC" regardless of actual collector
    function printReceipt(data) {
        const receiptContent = `
        <!DOCTYPE html>
        <html>
        <head><title>MCC Road User Fee Receipt</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
            .receipt { max-width: 400px; margin: auto; border: 2px solid #2C5F2D; padding: 20px; border-radius: 12px; }
            .header { text-align: center; border-bottom: 2px solid #2C5F2D; padding-bottom: 10px; }
            .header h1 { color: #2C5F2D; margin: 0; font-size: 22px; }
            .header p { margin: 2px 0; color: #555; }
            .details { margin: 15px 0; }
            .details table { width: 100%; }
            .details td { padding: 5px 0; }
            .footer { text-align: center; font-size: 12px; color: #777; margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h1> MZUZU CITY COUNCIL</h1>
                    <p>Road User Fee Collection</p>
                    <p><strong>Receipt #:</strong> ${data.receipt_number}</p>
                </div>
                <div class="details">
                    <table>
                        <tr><td><strong>Location:</strong></td><td>${data.location}</td></tr>
                        <tr><td><strong>Vehicle Category:</strong></td><td>${data.category}</td></tr>
                        <tr><td><strong>Amount (MWK):</strong></td><td>${data.amount}</td></tr>
                        <tr><td><strong>Licence Plate:</strong></td><td>${data.licence_plate}</td></tr>
                        <tr><td><strong>Payment Method:</strong></td><td>${data.method}</td></tr>
                        <tr><td><strong>Collected By:</strong></td><td>MCC</td></tr>
                        <tr><td><strong>Date:</strong></td><td>${new Date(data.date).toLocaleString()}</td></tr>
                        <tr><td><strong>Tax Type:</strong></td><td>MCC Road User Fee</td></tr>
                    </table>
                </div>
                <div class="footer">
                    <p>Thank you for contributing to Mzuzu City development.</p>
                    <p>This is a computer-generated receipt.</p>
                </div>
            </div>
            <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };</script>
        </body>
        </html>
        `;
        const win = window.open('', '_blank', 'width=500,height=700');
        win.document.write(receiptContent);
        win.document.close();
    }

    async function renderForm() {
        // Get logged‑in user
        let collectorName = '';
        try {
            const { data: { user }, error } = await sb.auth.getUser();
            if (!error && user) {
                collectorName = user.user_metadata?.name || user.email || '';
            }
        } catch (e) {
            console.warn('Could not get user info:', e);
        }

        const { data: collections, error } = await sb
            .from('road_user_fee_collections')
            .select('*')
            .order('payment_date', { ascending: false });
        if (error) {
            container.innerHTML = `<div class="error">Error loading records: ${error.message}</div>`;
            return;
        }

        let html = `
            <h2>🚗 Mzuzu City Council – Road User Fee</h2>
            <div class="card">
                <h3>📝 New Collection</h3>
                <div class="flex-row">
                    <div style="flex:1">
                        <label>Location:</label>
                        <select id="feeLocation">
                            ${LOCATIONS.map(l => `<option value="${l}">${l}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Vehicle Category:</label>
                        <select id="feeCategory">
                            ${Object.keys(CATEGORIES).map(c => `<option value="${c}">${c} (MWK ${CATEGORIES[c]})</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Licence Plate:</label>
                        <input type="text" id="feePlate" placeholder="e.g., MZ 1234">
                    </div>
                    <div style="flex:1">
                        <label>Payment Method:</label>
                        <select id="feeMethod">
                            <option value="cash">Cash</option>
                            <option value="mobile_money">Mobile Money</option>
                            <option value="bank">Bank</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Collected By:</label>
                        <input type="text" id="feeCollector" value="${collectorName}" readonly style="background:#f5f5f5;">
                    </div>
                </div>
                <div style="margin-top:15px;">
                    <button id="saveFeeBtn" style="background:#2C5F2D;">Collect & Print Receipt</button>
                </div>
            </div>
            <div class="card">
                <h3>📋 Collection History</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;">
                        <thead>
                            <tr><th>Date</th><th>Receipt #</th><th>Location</th><th>Category</th><th>Amount (MWK)</th><th>Plate</th><th>Method</th><th>Collected By</th></tr>
                        </thead>
                        <tbody id="feeTableBody">
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const tbody = document.getElementById('feeTableBody');
        tbody.innerHTML = '';
        for (const rec of collections) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${new Date(rec.payment_date).toLocaleDateString()}</td>
                <td>${rec.receipt_number}</td>
                <td>${rec.location}</td>
                <td>${rec.vehicle_category}</td>
                <td>${formatNumber(rec.amount)}</td>
                <td>${rec.licence_plate}</td>
                <td>${rec.payment_method}</td>
                <td>${rec.collected_by || '—'}</td>
            `;
        }

        document.getElementById('saveFeeBtn').onclick = async () => {
            const location = document.getElementById('feeLocation').value;
            const category = document.getElementById('feeCategory').value;
            const plate = document.getElementById('feePlate').value.trim();
            const method = document.getElementById('feeMethod').value;
            const collector = document.getElementById('feeCollector').value.trim() || null;
            const amount = CATEGORIES[category];
            const receiptNumber = generateReceiptNumber();

            if (!plate) {
                showMessage('Licence plate is required.', true);
                return;
            }

            const data = {
                location,
                vehicle_category: category,
                amount,
                licence_plate: plate,
                payment_method: method,
                collected_by: collector,
                receipt_number: receiptNumber,
                payment_date: new Date().toISOString(),
                tax_type: 'MCC road user fee'
            };

            try {
                const { error } = await sb.from('road_user_fee_collections').insert(data);
                if (error) throw error;
                showMessage(`✅ Collection recorded. Receipt #${receiptNumber}`, false);
                printReceipt({
                    receipt_number: receiptNumber,
                    location: location,
                    category: category,
                    amount: amount,
                    licence_plate: plate,
                    method: method,
                    date: new Date().toISOString()
                });
                renderForm();
            } catch (err) {
                showMessage(`Error: ${err.message}`, true);
            }
        };
    }

    renderForm();
}
    renderForm();
}