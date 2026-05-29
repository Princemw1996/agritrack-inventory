// modules/mainReceive.js – corrected with safe audit logging
async function renderMainReceive() {
    const container = document.getElementById('moduleContainer');
    const { data: products } = await sb.from('products').select('id, name, pack_size, unit');
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="error">No products. Insert master products first.</div>';
        return;
    }
    let rows = [];
    function renderTable() {
        const tbody = document.getElementById('receiveTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        rows.forEach((row, idx) => {
            const tr = tbody.insertRow();
            const tdProd = tr.insertCell();
            const select = document.createElement('select');
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
                if (prod) { row.productId = prod.id; row.unit = prod.unit; row.packSize = prod.pack_size; }
                else { row.productId = null; row.unit = ''; row.packSize = ''; }
                renderTable();
            });
            tdProd.appendChild(select);
            const tdUnit = tr.insertCell(); tdUnit.textContent = row.unit || '—'; tdUnit.style.background = '#f9f9f9';
            const tdPack = tr.insertCell(); tdPack.textContent = row.packSize || '—'; tdPack.style.background = '#f9f9f9';
            const tdQty = tr.insertCell();
            const qtyInp = document.createElement('input'); qtyInp.type = 'number'; qtyInp.step = '0.5'; qtyInp.value = row.qty; qtyInp.style.width = '100px';
            qtyInp.addEventListener('input', () => { row.qty = parseFloat(qtyInp.value) || 0; updateTotal(idx); });
            tdQty.appendChild(qtyInp);
            const tdPrice = tr.insertCell();
            const priceInp = document.createElement('input'); priceInp.type = 'number'; priceInp.step = '100'; priceInp.value = row.price; priceInp.style.width = '120px';
            priceInp.addEventListener('input', () => { row.price = parseFloat(priceInp.value) || 0; updateTotal(idx); });
            tdPrice.appendChild(priceInp);
            const tdTotal = tr.insertCell(); tdTotal.textContent = formatNumber(row.total); tdTotal.style.background = '#f9f9f9';
            const tdRemove = tr.insertCell();
            const rmBtn = document.createElement('button'); rmBtn.textContent = '✖'; rmBtn.className = 'remove-row';
            rmBtn.onclick = () => { rows.splice(idx, 1); renderTable(); };
            tdRemove.appendChild(rmBtn);
        });
    }
    function updateTotal(idx) {
        const row = rows[idx];
        row.total = row.qty * row.price;
        const tbody = document.getElementById('receiveTableBody');
        if (tbody && tbody.rows[idx]) tbody.rows[idx].cells[5].textContent = formatNumber(row.total);
    }
    function addRow() { rows.push({ productId: null, unit: '', packSize: '', qty: 0, price: 0, total: 0 }); renderTable(); }
    
    async function saveAll() {
        const valid = rows.filter(r => r.productId && r.qty > 0 && r.price > 0);
        if (!valid.length) { showMessage('No valid rows.', true); return; }
        if (!confirm(`Save ${valid.length} product(s) to Main Warehouse?`)) return;
        const btn = document.getElementById('saveReceiveBtn');
        btn.disabled = true;
        btn.textContent = '⏳ Saving...';
        let success = 0, errors = [];
        for (const row of valid) {
            try {
                // Update product selling price
                await sb.from('products').update({ current_price: row.price }).eq('id', row.productId);
                // Safe audit logging
                if (typeof logAction === 'function') {
                    await logAction('receive_product', 'products', row.productId, `Updated selling price to ${row.price}`);
                }
                // Update or create inventory
                const { data: inv } = await sb.from('inventory').select('id, quantity').eq('location_id', 1).eq('product_id', row.productId).maybeSingle();
                if (inv) {
                    const newQty = inv.quantity + row.qty;
                    await sb.from('inventory').update({ quantity: newQty, last_updated: new Date().toISOString() }).eq('id', inv.id);
                    if (typeof logAction === 'function') {
                        await logAction('receive_product', 'inventory', inv.id, `Added ${row.qty} units to Main Warehouse, new total ${newQty}`);
                    }
                } else {
                    const { data: newInv, error: insErr } = await sb.from('inventory')
                        .insert({ location_id: 1, product_id: row.productId, quantity: row.qty, last_updated: new Date().toISOString() })
                        .select().single();
                    if (insErr) throw insErr;
                    if (typeof logAction === 'function') {
                        await logAction('receive_product', 'inventory', newInv.id, `Created stock record with ${row.qty} units at Main Warehouse`);
                    }
                }
                success++;
            } catch (err) {
                errors.push(err.message);
                console.error(err);
            }
        }
        btn.disabled = false;
        btn.textContent = '💾 Save All';
        if (success) showMessage(`✅ Added ${success} product(s).`);
        if (errors.length) showMessage(`Errors: ${errors.join('; ')}`, true);
        rows = rows.filter(r => !(r.productId && r.qty > 0 && r.price > 0));
        renderTable();
    }
    
    container.innerHTML = `
        <h2> Receive Products into Main Warehouse (Batch)</h2>
        <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Price (MWK)</th><th>Total</th><th></th></tr></thead><tbody id="receiveTableBody"></tbody></table></div>
        <button id="addRowBtn">+ Add Row</button>
        <button id="saveReceiveBtn"> Save All</button>
    `;
    document.getElementById('addRowBtn').onclick = addRow;
    document.getElementById('saveReceiveBtn').onclick = saveAll;
    for (let i = 0; i < 3; i++) addRow();
}