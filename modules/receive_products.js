console.log("Supabase client:", supabase);
async function renderReceiveProducts(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Container not found:", containerId);
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <h2>Receive Products at Main Warehouse</h2>
            <div id="receiveStatus">Checking Supabase connection...</div>
        </div>
    `;
    
    // Ensure supabase is defined
    if (typeof supabase === 'undefined') {
        document.getElementById('receiveStatus').innerHTML = "Error: Supabase client not loaded. Check config.js and network.";
        return;
    }
    
    // Test connection
    document.getElementById('receiveStatus').innerHTML = "Loading products...";
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, unit, pack_size, current_price');
        
        if (error) throw error;
        
        if (!products || products.length === 0) {
            document.getElementById('receiveStatus').innerHTML = "No products found. Please insert master products via Supabase SQL.";
            return;
        }
        
        // Build form
        document.getElementById('receiveStatus').innerHTML = `
            <p>✅ Found ${products.length} products. Ready to receive.</p>
            <label>Select Product:</label>
            <select id="productSelect">
                <option value="">-- Choose --</option>
                ${products.map(p => `<option value="${p.id}">${p.name} - ${p.pack_size} (${p.unit})</option>`).join('')}
            </select>
            <br/><br/>
            <label>Quantity Received:</label>
            <input type="number" id="qtyReceived" step="0.5" min="0" value="0">
            <br/><br/>
            <label>Selling Price per Unit (MWK):</label>
            <input type="number" id="pricePerUnit" step="100" min="0" value="0">
            <br/><br/>
            <button id="addToWarehouseBtn">Add to Main Warehouse</button>
            <div id="previewArea" style="margin-top:15px;"></div>
        `;
        
        // Preview current stock
        const productSelect = document.getElementById('productSelect');
        const preview = document.getElementById('previewArea');
        
        productSelect.addEventListener('change', async () => {
            const productId = parseInt(productSelect.value);
            if (!productId) {
                preview.innerHTML = '';
                return;
            }
            const { data: inv } = await supabase
                .from('inventory')
                .select('quantity')
                .eq('location_id', 1)
                .eq('product_id', productId)
                .maybeSingle();
            const qtyNow = inv ? inv.quantity : 0;
            preview.innerHTML = `<p>Current stock at Main Warehouse: <strong>${qtyNow}</strong></p>`;
        });
        
        // Add button
        document.getElementById('addToWarehouseBtn').addEventListener('click', async () => {
            const productId = parseInt(productSelect.value);
            const qty = parseFloat(document.getElementById('qtyReceived').value);
            const price = parseFloat(document.getElementById('pricePerUnit').value);
            
            if (!productId) {
                alert("Please select a product.");
                return;
            }
            if (isNaN(qty) || qty <= 0) {
                alert("Quantity must be positive.");
                return;
            }
            if (isNaN(price) || price <= 0) {
                alert("Price must be positive.");
                return;
            }
            
            try {
                // Update current price
                await supabase.from('products').update({ current_price: price }).eq('id', productId);
                
                // Update inventory
                const { data: inv } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('location_id', 1)
                    .eq('product_id', productId)
                    .maybeSingle();
                
                if (inv) {
                    const newQty = inv.quantity + qty;
                    await supabase.from('inventory').update({ quantity: newQty }).eq('id', inv.id);
                } else {
                    await supabase.from('inventory').insert({ location_id: 1, product_id: productId, quantity: qty });
                }
                
                alert(`Success! Added ${qty} units to Main Warehouse.`);
                document.getElementById('qtyReceived').value = '0';
                document.getElementById('pricePerUnit').value = '0';
                productSelect.dispatchEvent(new Event('change'));
            } catch (err) {
                alert("Error: " + err.message);
                console.error(err);
            }
        });
        
    } catch (err) {
        console.error("Failed to load products:", err);
        document.getElementById('receiveStatus').innerHTML = `<p class="error">Error loading products: ${err.message}</p>`;
    }
}