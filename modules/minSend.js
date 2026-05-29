// modules/minSend.js – Dynamic shop list (includes any new shop)
async function renderMinSend() {
    const container = document.getElementById('moduleContainer');
    const { data: products } = await sb.from('products').select('id, name, pack_size, unit');
    const { data: stock } = await sb.from('inventory').select('product_id, quantity').eq('location_id', 2);
    const stockMap = new Map(); stock?.forEach(s => { if(s.quantity>0) stockMap.set(s.product_id, s.quantity); });
    const availableProducts = products.filter(p => stockMap.has(p.id));
    if (availableProducts.length === 0) {
        container.innerHTML = '<p>No products with stock in Min Warehouse to transfer.</p>';
        return;
    }
    // Fetch all shops (exclude Lilongwe and Blantyre if they have fixed IDs)
    const { data: allShops } = await sb.from('locations').select('id, name').eq('type', 'shop');
    // Exclude Lilongwe (id=4) and Blantyre (id=3) if they are not intended for this module
    const targetShops = allShops.filter(s => ![3, 4].includes(s.id));
    if (targetShops.length === 0) {
        container.innerHTML = '<p>No destination shops found.</p>';
        return;
    }
    let rows = [];
    function renderTable() {
        const tbody = document.getElementById('sendTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        rows.forEach((row, idx) => {
            const tr = tbody.insertRow();
            const tdProd = tr.insertCell();
            const selectProd = document.createElement('select');
            selectProd.innerHTML = '<option value="">-- Product --</option>';
            availableProducts.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.name} - ${p.pack_size} (${p.unit})`;
                if (p.id == row.productId) opt.selected = true;
                selectProd.appendChild(opt);
            });
            selectProd.addEventListener('change', (e) => { row.productId = e.target.value; });
            tdProd.appendChild(selectProd);
            const tdShop = tr.insertCell();
            const selectShop = document.createElement('select');
            selectShop.innerHTML = '<option value="">-- Shop --</option>';
            targetShops.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                if (s.id == row.shopId) opt.selected = true;
                selectShop.appendChild(opt);
            });
            selectShop.addEventListener('change', (e) => { row.shopId = parseInt(e.target.value); });
            tdShop.appendChild(selectShop);
            const tdQty = tr.insertCell();
            const qtyInp = document.createElement('input'); qtyInp.type = 'number'; qtyInp.step = '0.5'; qtyInp.value = row.qty; qtyInp.style.width = '100px';
            qtyInp.addEventListener('input', () => { row.qty = parseFloat(qtyInp.value) || 0; });
            tdQty.appendChild(qtyInp);
            const tdRemove = tr.insertCell();
            const rmBtn = document.createElement('button'); rmBtn.textContent = '✖'; rmBtn.className = 'remove-row';
            rmBtn.onclick = () => { rows.splice(idx, 1); renderTable(); };
            tdRemove.appendChild(rmBtn);
        });
    }
    function addRow() { rows.push({ productId: null, shopId: null, qty: 0 }); renderTable(); }
    async function saveAll() {
        const valid = rows.filter(r => r.productId && r.shopId && r.qty > 0);
        if (valid.length === 0) { showMessage('No valid rows.', true); return; }
        if (!confirm(`Send ${valid.length} product(s) to shops?`)) return;
        const btn = document.getElementById('sendSaveBtn');
        btn.disabled = true; btn.textContent = '⏳ Sending...';
        let success = 0, errors = [];
        for (const row of valid) {
            try {
                const { data: invFrom } = await sb.from('inventory')
                    .select('id, quantity')
                    .eq('location_id', 2)
                    .eq('product_id', row.productId)
                    .maybeSingle();
                if (!invFrom || invFrom.quantity < row.qty) throw new Error(`Insufficient stock in Min Warehouse`);
                const oldQty = invFrom.quantity;
                await sb.from('inventory')
                    .update({ quantity: invFrom.quantity - row.qty, last_updated: new Date().toISOString() })
                    .eq('id', invFrom.id);
                await logAction('reduce_stock', 'inventory', invFrom.id,
                    `Reduced stock at Min Warehouse (location 2) for product ${row.productId} from ${oldQty} to ${oldQty - row.qty} due to transfer to shop ${row.shopId}`);
                const { data: transfer, error: insertErr } = await sb.from('transfers')
                    .insert({
                        from_location_id: 2,
                        to_location_id: row.shopId,
                        product_id: row.productId,
                        quantity: row.qty,
                        status: 'pending',
                        initiated_at: new Date().toISOString()
                    })
                    .select().single();
                if (insertErr) throw new Error(`Insert transfer error: ${insertErr.message}`);
                await logAction('create_transfer', 'transfers', transfer.id,
                    `Transferred ${row.qty} units of product ${row.productId} from Min Warehouse to shop ${row.shopId} (${targetShops.find(s => s.id == row.shopId)?.name})`);
                success++;
            } catch (err) { errors.push(err.message); }
        }
        btn.disabled = false; btn.textContent = '💾 Send All';
        if (success) showMessage(`✅ Sent ${success} item(s) to shops. Min stock reduced.`);
        if (errors.length) showMessage(`Errors: ${errors.join('; ')}`, true);
        rows = [];
        renderTable();
    }
    container.innerHTML = `
        <h2>🛒 Send Stock from Min Warehouse to Shops (Batch)</h2>
        <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product (only in stock)</th><th>Shop</th><th>Quantity</th><th></th></tr></thead><tbody id="sendTableBody"></tbody></tr></div>
        <button id="addSendRowBtn">+ Add Row</button>
        <button id="sendSaveBtn">💾 Send All</button>
    `;
    document.getElementById('addSendRowBtn').onclick = addRow;
    document.getElementById('sendSaveBtn').onclick = saveAll;
    addRow(); addRow();
}