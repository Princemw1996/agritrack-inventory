async function renderMainTransfer() {
    const container = document.getElementById('moduleContainer');
    const { data: products } = await sb.from('products').select('id, name, pack_size, unit');
    if (!products || !products.length) {
        container.innerHTML = '<div class="error">No products.</div>';
        return;
    }
    const { data: stock } = await sb.from('inventory').select('product_id, quantity').eq('location_id', 1);
    const stockMap = new Map();
    stock?.forEach(s => { if (s.quantity > 0) stockMap.set(s.product_id, s.quantity); });
    const availableProducts = products.filter(p => stockMap.has(p.id));
    if (availableProducts.length === 0) {
        container.innerHTML = '<p>No products with stock in Main Warehouse to transfer.</p>';
        return;
    }
    let rows = [];
    function renderTable() {
        const tbody = document.getElementById('transferTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        rows.forEach((row, idx) => {
            const tr = tbody.insertRow();
            const tdProd = tr.insertCell();
            const select = document.createElement('select');
            select.innerHTML = '<option value="">-- Select --</option>';
            availableProducts.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} - ${p.pack_size} (${p.unit})`;
                if (p.id == row.productId) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', (e) => { row.productId = e.target.value; });
            tdProd.appendChild(select);
            const tdQty = tr.insertCell();
            const qtyInp = document.createElement('input');
            qtyInp.type = 'number'; qtyInp.step = '0.5'; qtyInp.value = row.qty; qtyInp.style.width = '100px';
            qtyInp.addEventListener('input', () => { row.qty = parseFloat(qtyInp.value) || 0; });
            tdQty.appendChild(qtyInp);
            const tdRemove = tr.insertCell();
            const rmBtn = document.createElement('button'); rmBtn.textContent = '✖'; rmBtn.className = 'remove-row';
            rmBtn.onclick = () => { rows.splice(idx, 1); renderTable(); };
            tdRemove.appendChild(rmBtn);
        });
    }
    function addRow() { rows.push({ productId: null, qty: 0 }); renderTable(); }
    async function saveAll() {
        const valid = rows.filter(r => r.productId && r.qty > 0);
        if (!valid.length) { showMessage('No valid rows.', true); return; }
        if (!confirm(`Transfer ${valid.length} product(s) to Min Warehouse?`)) return;
        const btn = document.getElementById('transferSaveBtn');
        btn.disabled = true; btn.textContent = '⏳ Transferring...';
        let success = 0, errors = [];
        for (const row of valid) {
            try {
                const { data: inv, error: invErr } = await sb.from('inventory')
                    .select('id, quantity')
                    .eq('location_id', 1)
                    .eq('product_id', row.productId)
                    .maybeSingle();
                if (invErr) throw new Error(`Stock check error: ${invErr.message}`);
                if (!inv || inv.quantity < row.qty) throw new Error(`Insufficient stock (available: ${inv?.quantity || 0})`);
                const { error: updateErr } = await sb.from('inventory')
                    .update({ quantity: inv.quantity - row.qty, last_updated: new Date().toISOString() })
                    .eq('id', inv.id);
                if (updateErr) throw new Error(`Update error: ${updateErr.message}`);
                const { error: insertErr } = await sb.from('transfers')
                    .insert({
                        from_location_id: 1,
                        to_location_id: 2,
                        product_id: row.productId,
                        quantity: row.qty,
                        status: 'pending',
                        initiated_at: new Date().toISOString()
                    });
                if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);
                success++;
            } catch (err) { errors.push(err.message); }
        }
        btn.disabled = false; btn.textContent = ' Transfer All';
        if (success) showMessage(`✅ ${success} transfer(s) created. Main stock reduced.`);
        if (errors.length) showMessage(`Errors: ${errors.join('; ')}`, true);
        rows = [];
        renderTable();
    }
    container.innerHTML = `
        <h2> Transfer Main → Min Warehouse</h2>
        <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product (only in stock)</th><th>Quantity</th><th></th></tr></thead><tbody id="transferTableBody"></tbody></table></div>
        <button id="addTransferRowBtn">+ Add Row</button>
        <button id="transferSaveBtn">💾 Transfer All</button>
    `;
    document.getElementById('addTransferRowBtn').onclick = addRow;
    document.getElementById('transferSaveBtn').onclick = saveAll;
    addRow(); addRow();
}