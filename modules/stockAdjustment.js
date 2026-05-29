// modules/stockAdjustment.js – with audit logging
async function renderStockAdjustment() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading locations and products...</div>';
    try {
        const { data: locations } = await sb.from('locations').select('id, name').order('id');
        const { data: products } = await sb.from('products').select('id, name, pack_size, unit');
        if (!locations?.length || !products?.length) throw new Error('No locations or products found.');

        container.innerHTML = `
            <h2>📦 Stock Adjustment (Admin Only)</h2>
            <div class="card">
                <div class="form-group"><label>Location:</label><select id="adjLocation"></select></div>
                <div class="form-group"><label>Product:</label><select id="adjProduct"></select></div>
                <div class="form-group" style="background:#f5f5f5; padding:10px; border-radius:6px;">
                    <strong>Current Stock:</strong> <span id="currentStockValue">--</span>
                </div>
                <div class="form-group"><label>New Quantity (absolute):</label><input type="number" id="newQuantity" step="0.5" value="0"></div>
                <button id="applyAdjustmentBtn">Apply Adjustment</button>
                <div id="adjMessage" style="margin-top:15px;"></div>
            </div>
        `;
        const locationSelect = document.getElementById('adjLocation');
        const productSelect = document.getElementById('adjProduct');
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            locationSelect.appendChild(opt);
        });
        products.forEach(prod => {
            const opt = document.createElement('option');
            opt.value = prod.id;
            opt.textContent = `${prod.name} - ${prod.pack_size} (${prod.unit})`;
            productSelect.appendChild(opt);
        });

        async function loadCurrentStock() {
            const locationId = locationSelect.value;
            const productId = productSelect.value;
            if (!locationId || !productId) {
                document.getElementById('currentStockValue').innerText = '--';
                return;
            }
            const { data } = await sb.from('inventory')
                .select('id, quantity')
                .eq('location_id', locationId)
                .eq('product_id', productId)
                .maybeSingle();
            const qty = data?.quantity || 0;
            // Store inventory id for later use
            window._currentStockId = data?.id;
            window._currentStockQty = qty;
            document.getElementById('currentStockValue').innerText = formatNumber(qty, 0);
        }
        
        locationSelect.addEventListener('change', loadCurrentStock);
        productSelect.addEventListener('change', loadCurrentStock);
        
        document.getElementById('applyAdjustmentBtn').onclick = async () => {
            const locationId = parseInt(locationSelect.value);
            const productId = parseInt(productSelect.value);
            const newQty = parseFloat(document.getElementById('newQuantity').value);
            const msgDiv = document.getElementById('adjMessage');
            if (!locationId || !productId) { msgDiv.innerHTML = '<div class="error">Select location and product.</div>'; return; }
            if (isNaN(newQty) || newQty < 0) { msgDiv.innerHTML = '<div class="error">Invalid quantity.</div>'; return; }
            try {
                // Re-fetch current stock to get accurate old quantity
                const { data: existing, error: fetchErr } = await sb.from('inventory')
                    .select('id, quantity')
                    .eq('location_id', locationId)
                    .eq('product_id', productId)
                    .maybeSingle();
                if (fetchErr) throw fetchErr;
                const oldQty = existing?.quantity || 0;
                let inventoryId = existing?.id;
                
                if (existing) {
                    await sb.from('inventory').update({ quantity: newQty, last_updated: new Date().toISOString() }).eq('id', existing.id);
                } else {
                    // Create new inventory record
                    const { data: newInv, error: insErr } = await sb.from('inventory')
                        .insert({ location_id: locationId, product_id: productId, quantity: newQty, last_updated: new Date().toISOString() })
                        .select()
                        .single();
                    if (insErr) throw insErr;
                    inventoryId = newInv.id;
                }
                // Audit log
                await logAction('stock_adjustment', 'inventory', inventoryId, 
                    `Adjusted stock at location ${locationId} (${locationSelect.options[locationSelect.selectedIndex]?.text}) for product ${productId} (${productSelect.options[productSelect.selectedIndex]?.text}) from ${oldQty} to ${newQty}`);
                
                msgDiv.innerHTML = `<div class="success">✅ Stock adjusted to ${formatNumber(newQty, 0)} units.</div>`;
                await loadCurrentStock(); // refresh display
                document.getElementById('newQuantity').value = '';
            } catch (err) { 
                msgDiv.innerHTML = `<div class="error">Error: ${err.message}</div>`;
                console.error(err);
            }
        };
        loadCurrentStock();
    } catch (err) {
        container.innerHTML = `<div class="error">${err.message}</div>`;
    }
}