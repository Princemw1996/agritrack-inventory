async function renderReceiveProducts(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Receive Products at Main Warehouse</h2>
            <p>Select product, enter quantity received and selling price. Total value auto‑calculates.</p>
            <div style="overflow-x: auto;">
                <table id="receiveTable">
                    <thead><tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Selling Price (MWK)</th><th>Total Value (MWK)</th></tr></thead>
                    <tbody id="receiveTableBody"></tbody>
                </table>
            </div>
            <button id="addReceiveRowBtn">+ Add Row</button>
            <button id="saveReceiveBtn">Save All to Main Warehouse</button>
            <div id="receiveMessage" class="message" style="display:none;"></div>
        </div>
    `;

    let products = await getProducts();
    if (!products.length) {
        showMessage(containerId, 'No product catalog. Insert master products first.', 'error');
        return;
    }

    let rows = [];

    function addRow() {
        rows.push({ productId: null, unit: '', packSize: '', qty: 0, price: 0, total: 0 });
        renderTable();
    }

    function renderTable() {
        const tbody = document.getElementById('receiveTableBody');
        tbody.innerHTML = '';
        rows.forEach((row, idx) => {
            const tr = document.createElement('tr');
            // Product dropdown
            const tdProd = document.createElement('td');
            const select = document.createElement('select');
            select.className = 'product-select';
            select.dataset.idx = idx;
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '-- Select Product --';
            select.appendChild(emptyOpt);
            products.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} - ${p.pack_size} (${p.unit})`;
                if (p.id == row.productId) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => onProductChange(idx, e.target.value));
            tdProd.appendChild(select);

            // Unit (readonly)
            const tdUnit = document.createElement('td');
            tdUnit.textContent = row.unit || '—';
            tdUnit.style.backgroundColor = '#f9f9f9';
            // Packing size
            const tdPack = document.createElement('td');
            tdPack.textContent = row.packSize || '—';
            tdPack.style.backgroundColor = '#f9f9f9';
            // Quantity
            const tdQty = document.createElement('td');
            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.step = '0.5';
            qtyInput.value = row.qty;
            qtyInput.addEventListener('input', (e) => {
                row.qty = parseFloat(e.target.value) || 0;
                updateTotal(idx);
            });
            tdQty.appendChild(qtyInput);
            // Price
            const tdPrice = document.createElement('td');
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.step = '100';
            priceInput.value = row.price;
            priceInput.addEventListener('input', (e) => {
                row.price = parseFloat(e.target.value) || 0;
                updateTotal(idx);
            });
            tdPrice.appendChild(priceInput);
            // Total
            const tdTotal = document.createElement('td');
            tdTotal.textContent = row.total.toFixed(2);
            tdTotal.style.backgroundColor = '#f9f9f9';

            tr.appendChild(tdProd);
            tr.appendChild(tdUnit);
            tr.appendChild(tdPack);
            tr.appendChild(tdQty);
            tr.appendChild(tdPrice);
            tr.appendChild(tdTotal);
            tbody.appendChild(tr);
        });
    }

    function updateTotal(idx) {
        const row = rows[idx];
        row.total = row.qty * row.price;
        const tbody = document.getElementById('receiveTableBody');
        const tr = tbody.children[idx];
        if (tr) tr.cells[5].textContent = row.total.toFixed(2);
    }

    function onProductChange(idx, productId) {
        const product = products.find(p => p.id == productId);
        if (product) {
            rows[idx].productId = product.id;
            rows[idx].unit = product.unit;
            rows[idx].packSize = product.pack_size;
        } else {
            rows[idx].productId = null;
            rows[idx].unit = '';
            rows[idx].packSize = '';
        }
        renderTable();
    }

    async function saveAll() {
        const validRows = rows.filter(r => r.productId && r.qty > 0 && r.price > 0);
        if (!validRows.length) {
            showMessage(containerId, 'No valid rows to save.', 'error');
            return;
        }
        let success = 0, errors = [];
        for (const row of validRows) {
            try {
                // Update current_price
                await supabase.from('products').update({ current_price: row.price }).eq('id', row.productId);
                // Update inventory at Main Warehouse (location_id = 1)
                const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('location_id', 1).eq('product_id', row.productId);
                if (inv && inv.length) {
                    const newQty = inv[0].quantity + row.qty;
                    await supabase.from('inventory').update({ quantity: newQty, last_updated: new Date() }).eq('id', inv[0].id);
                } else {
                    await supabase.from('inventory').insert({ location_id: 1, product_id: row.productId, quantity: row.qty, last_updated: new Date() });
                }
                success++;
            } catch (err) { errors.push(err.message); }
        }
        if (success) showMessage(containerId, `Saved ${success} product(s) to Main Warehouse.`, 'success');
        if (errors.length) showMessage(containerId, `Errors: ${errors.join('; ')}`, 'error');
        // Reset qty/price
        rows.forEach(r => { if (r.productId) { r.qty = 0; r.price = 0; r.total = 0; } });
        renderTable();
    }

    document.getElementById('addReceiveRowBtn').addEventListener('click', addRow);
    document.getElementById('saveReceiveBtn').addEventListener('click', saveAll);
    for (let i = 0; i < 3; i++) addRow();
}