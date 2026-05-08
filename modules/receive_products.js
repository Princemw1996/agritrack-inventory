async function renderReceiveProducts(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading">Loading product catalog...</div>';

    // Direct Supabase query (no external helpers)
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, unit, pack_size');
    if (prodErr) {
        container.innerHTML = `<div class="error-message">Error loading products: ${prodErr.message}</div>`;
        return;
    }
    if (!products.length) {
        container.innerHTML = `<div class="error-message">No products found. Insert master products via Supabase SQL.</div>`;
        return;
    }

    // Build UI
    container.innerHTML = `
        <div class="card">
            <h2>📦 Receive Products at Main Warehouse</h2>
            <p>Add rows. Select product, enter quantity & price. Total auto‑calculates.</p>
            <div style="overflow-x: auto;">
                <table id="receiveTable">
                    <thead>
                        <tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Selling Price (MWK)</th><th>Total Value (MWK)</th><th style="width:60px"></th></tr>
                    </thead>
                    <tbody id="receiveTableBody"></tbody>
                </table>
            </div>
            <div style="margin-top:15px;">
                <button id="addReceiveRowBtn">+ Add Row</button>
                <button id="saveReceiveBtn">💾 Save All to Main Warehouse</button>
            </div>
            <div id="receiveMessage" class="message" style="display:none;"></div>
        </div>
    `;

    let rows = [];

    function renderTable() {
        const tbody = document.getElementById('receiveTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        rows.forEach((row, idx) => {
            const tr = tbody.insertRow();
            // Product dropdown
            const tdProd = tr.insertCell();
            const select = document.createElement('select');
            select.style.width = '100%';
            select.innerHTML = '<option value="">-- Select --</option>';
            products.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} - ${p.pack_size} (${p.unit})`;
                if (p.id == row.productId) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => {
                const prod = products.find(p => p.id == e.target.value);
                if (prod) {
                    rows[idx].productId = prod.id;
                    rows[idx].unit = prod.unit;
                    rows[idx].packSize = prod.pack_size;
                } else {
                    rows[idx].productId = null;
                    rows[idx].unit = '';
                    rows[idx].packSize = '';
                }
                renderTable();
            });
            tdProd.appendChild(select);

            // Unit (readonly)
            const tdUnit = tr.insertCell();
            tdUnit.textContent = row.unit || '—';
            tdUnit.style.backgroundColor = '#f9f9f9';
            // Packing size
            const tdPack = tr.insertCell();
            tdPack.textContent = row.packSize || '—';
            tdPack.style.backgroundColor = '#f9f9f9';
            // Quantity
            const tdQty = tr.insertCell();
            const qtyInp = document.createElement('input');
            qtyInp.type = 'number';
            qtyInp.step = '0.5';
            qtyInp.value = row.qty;
            qtyInp.style.width = '100px';
            qtyInp.addEventListener('input', () => {
                row.qty = parseFloat(qtyInp.value) || 0;
                updateTotal(idx);
            });
            tdQty.appendChild(qtyInp);
            // Price
            const tdPrice = tr.insertCell();
            const priceInp = document.createElement('input');
            priceInp.type = 'number';
            priceInp.step = '100';
            priceInp.value = row.price;
            priceInp.style.width = '120px';
            priceInp.addEventListener('input', () => {
                row.price = parseFloat(priceInp.value) || 0;
                updateTotal(idx);
            });
            tdPrice.appendChild(priceInp);
            // Total
            const tdTotal = tr.insertCell();
            tdTotal.textContent = row.total.toFixed(2);
            tdTotal.style.backgroundColor = '#f9f9f9';
            // Remove button
            const tdRemove = tr.insertCell();
            const rmBtn = document.createElement('button');
            rmBtn.textContent = '✖';
            rmBtn.style.backgroundColor = '#dc3545';
            rmBtn.style.padding = '4px 8px';
            rmBtn.style.fontSize = '12px';
            rmBtn.onclick = () => {
                rows.splice(idx, 1);
                renderTable();
            };
            tdRemove.appendChild(rmBtn);
        });
    }

    function updateTotal(idx) {
        const row = rows[idx];
        row.total = row.qty * row.price;
        const tbody = document.getElementById('receiveTableBody');
        const tr = tbody?.children[idx];
        if (tr) tr.cells[5].textContent = row.total.toFixed(2);
    }

    function addRow() {
        rows.push({ productId: null, unit: '', packSize: '', qty: 0, price: 0, total: 0 });
        renderTable();
    }

    function showMessage(text, isError = false) {
        const msgDiv = document.getElementById('receiveMessage');
        if (!msgDiv) return;
        msgDiv.textContent = text;
        msgDiv.className = `message ${isError ? 'error' : 'success'}`;
        msgDiv.style.display = 'block';
        setTimeout(() => { msgDiv.style.display = 'none'; }, 5000);
    }

    async function saveAll() {
        const validRows = rows.filter(r => r.productId && r.qty > 0 && r.price > 0);
        if (validRows.length === 0) {
            showMessage('No valid rows to save.', true);
            return;
        }
        if (!confirm(`Save ${validRows.length} product row(s) to Main Warehouse?`)) return;

        const saveBtn = document.getElementById('saveReceiveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving...';
        let success = 0, errors = [];
        for (const row of validRows) {
            try {
                // Update product price
                await supabase.from('products').update({ current_price: row.price }).eq('id', row.productId);
                // Update inventory at Main Warehouse (location_id = 1)
                const { data: inv } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('location_id', 1)
                    .eq('product_id', row.productId)
                    .maybeSingle();
                if (inv) {
                    const newQty = inv.quantity + row.qty;
                    await supabase.from('inventory').update({ quantity: newQty }).eq('id', inv.id);
                } else {
                    await supabase.from('inventory').insert({ location_id: 1, product_id: row.productId, quantity: row.qty });
                }
                success++;
            } catch (err) {
                errors.push(err.message);
            }
        }
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save All to Main Warehouse';
        if (success) showMessage(`✅ Saved ${success} product(s) to Main Warehouse.`);
        if (errors.length) showMessage(`⚠️ Errors: ${errors.join('; ')}`, true);
        rows.forEach(r => { if (r.productId) { r.qty = 0; r.price = 0; r.total = 0; } });
        renderTable();
    }

    document.getElementById('addReceiveRowBtn').addEventListener('click', addRow);
    document.getElementById('saveReceiveBtn').addEventListener('click', saveAll);
    // Initial rows
    for (let i = 0; i < 3; i++) addRow();
}