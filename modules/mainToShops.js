// modules/mainToShops.js – with audit logging
async function renderMainToShops() {
    const container = document.getElementById('moduleContainer');
    const { data: products } = await sb.from('products').select('id, name, pack_size, unit');
    const { data: stock } = await sb.from('inventory').select('product_id, quantity').eq('location_id', 1);
    const stockMap = new Map(); stock?.forEach(s => { if(s.quantity>0) stockMap.set(s.product_id, s.quantity); });
    const availableProducts = products.filter(p => stockMap.has(p.id));
    if (!availableProducts.length) {
        container.innerHTML = '<p>No products with stock in Main Warehouse to transfer.</p>';
        return;
    }
    const allowedShops = [
        { id: 3, name: 'Lilongwe Shop' },
        { id: 4, name: 'Blantyre Shop' }
    ];
    let rows = [];
    function renderTable() {
        const tbody = document.getElementById('mainToShopsTableBody');
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
            allowedShops.forEach(s => {
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
        if (!valid.length) { showMessage('No valid rows.', true); return; }
        if (!confirm(`Transfer ${valid.length} product(s) to shops?`)) return;
        const btn = document.getElementById('mainToShopsSaveBtn');
        btn.disabled = true; btn.textContent = '⏳ Transferring...';
        let success = 0, errors = [];
        for (const row of valid) {
            try {
                // Check stock
                const { data: inv, error: invErr } = await sb.from('inventory')
                    .select('id, quantity')
                    .eq('location_id', 1)
                    .eq('product_id', row.productId)
                    .maybeSingle();
                if (invErr) throw new Error(`Stock check error: ${invErr.message}`);
                if (!inv || inv.quantity < row.qty) throw new Error(`Insufficient stock (available: ${inv?.quantity || 0})`);
                const oldQty = inv.quantity;
                // Reduce Main stock
                await sb.from('inventory')
                    .update({ quantity: inv.quantity - row.qty, last_updated: new Date().toISOString() })
                    .eq('id', inv.id);
                await logAction('reduce_stock', 'inventory', inv.id,
                    `Reduced stock at Main Warehouse (location 1) for product ${row.productId} from ${oldQty} to ${oldQty - row.qty} due to transfer to shop ${row.shopId}`);
                // Create transfer
                const { data: transfer, error: insertErr } = await sb.from('transfers')
                    .insert({
                        from_location_id: 1,
                        to_location_id: row.shopId,
                        product_id: row.productId,
                        quantity: row.qty,
                        status: 'pending',
                        initiated_at: new Date().toISOString()
                    })
                    .select().single();
                if (insertErr) throw new Error(`Insert transfer error: ${insertErr.message}`);
                await logAction('create_transfer', 'transfers', transfer.id,
                    `Transferred ${row.qty} units of product ${row.productId} from Main Warehouse to shop ID ${row.shopId}`);
                success++;
            } catch (err) { errors.push(err.message); }
        }
        btn.disabled = false; btn.textContent = '💾 Transfer All';
        if (success) showMessage(`✅ ${success} transfer(s) created. Main stock reduced.`);
        if (errors.length) showMessage(`Errors: ${errors.join('; ')}`, true);
        rows = [];
        renderTable();
    }
    container.innerHTML = `
        <h2> Transfer Main → Lilongwe / Blantyre</h2>
        <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product (only in stock)</th><th>Shop</th><th>Quantity</th><th></th></tr></thead><tbody id="mainToShopsTableBody"></tbody></table></div>
        <button id="addMainToShopsRowBtn">+ Add Row</button>
        <button id="mainToShopsSaveBtn">💾 Transfer All</button>
    `;
    document.getElementById('addMainToShopsRowBtn').onclick = addRow;
    document.getElementById('mainToShopsSaveBtn').onclick = saveAll;
    addRow(); addRow();
}