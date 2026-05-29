// modules/productManagement.js – Admin only: add, edit, delete products
async function renderProductManagement() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading products...</div>';
    try {
        // Fetch existing products
        const { data: products, error } = await sb.from('products').select('id, name, unit, pack_size, current_price').order('name');
        if (error) throw error;

        // Build UI
        container.innerHTML = `
            <h2>📦 Product Management (Admin Only)</h2>
            <div class="card">
                <h3>➕ Add New Product</h3>
                <div class="flex-row">
                    <div style="flex:1"><label>Product Name</label><input type="text" id="prodName" placeholder="e.g., ROCYCLONE"></div>
                    <div style="flex:1"><label>Unit</label><select id="prodUnit"><option value="L">L</option><option value="KG">KG</option></select></div>
                    <div style="flex:1"><label>Packing Size</label><input type="text" id="prodPackSize" placeholder="e.g., 200ML Bottle, 200MLX50/CTN"></div>
                    <div style="flex:1"><label>Selling Price (MWK)</label><input type="number" id="prodPrice" step="100" value="0"></div>
                    <div style="align-self:flex-end"><button id="addProductBtn">Add Product</button></div>
                </div>
            </div>
            <div class="card">
                <h3>📋 Existing Products</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr><th>Name</th><th>Unit</th><th>Packing Size</th><th>Selling Price (MWK)</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="productTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;

        const tbody = document.getElementById('productTableBody');
        
        function renderProducts() {
            tbody.innerHTML = '';
            for (const p of products) {
                const row = tbody.insertRow();
                row.insertCell().textContent = p.name;
                row.insertCell().textContent = p.unit;
                row.insertCell().textContent = p.pack_size;
                row.insertCell().textContent = formatNumber(p.current_price || 0);
                const actionsCell = row.insertCell();
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.style.backgroundColor = '#2C5F2D';
                editBtn.style.marginRight = '10px';
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.style.backgroundColor = '#dc3545';
                actionsCell.appendChild(editBtn);
                actionsCell.appendChild(deleteBtn);

                editBtn.onclick = () => openEditModal(p);
                deleteBtn.onclick = async () => {
                    if (!confirm(`Delete product "${p.name} - ${p.pack_size}"? This will NOT delete existing inventory records.`)) return;
                    await sb.from('products').delete().eq('id', p.id);
                    if (typeof logAction === 'function') {
                        await logAction('delete_product', 'products', p.id, `Deleted product ${p.name} - ${p.pack_size}`);
                    }
                    showMessage(`Product "${p.name}" deleted.`, false);
                    renderProductManagement(); // refresh
                };
            }
        }
        renderProducts();

        // Add new product
        document.getElementById('addProductBtn').onclick = async () => {
            const name = document.getElementById('prodName').value.trim();
            const unit = document.getElementById('prodUnit').value;
            const packSize = document.getElementById('prodPackSize').value.trim();
            const price = parseFloat(document.getElementById('prodPrice').value);
            if (!name || !packSize || isNaN(price) || price <= 0) {
                showMessage('Please fill all fields with valid data.', true);
                return;
            }
            // Generate simple SKU
            const sku = name.substring(0,4).toUpperCase() + '-' + packSize.substring(0,4).toUpperCase().replace(/[^A-Z0-9]/g,'');
            const { error: insertErr } = await sb.from('products').insert({
                sku, name, unit, pack_size: packSize, current_price: price
            });
            if (insertErr) {
                showMessage(`Error: ${insertErr.message}`, true);
                return;
            }
            if (typeof logAction === 'function') {
                await logAction('create_product', 'products', null, `Created product ${name} - ${packSize} at price ${price}`);
            }
            showMessage(`Product "${name}" added successfully.`, false);
            renderProductManagement(); // refresh
        };

        // Edit modal
        function openEditModal(product) {
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '20%';
            modal.style.left = '30%';
            modal.style.width = '40%';
            modal.style.backgroundColor = 'white';
            modal.style.padding = '20px';
            modal.style.borderRadius = '12px';
            modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            modal.style.zIndex = '1000';
            modal.innerHTML = `
                <h3>Edit Product</h3>
                <div class="form-group"><label>Name</label><input type="text" id="editName" value="${product.name.replace(/"/g, '&quot;')}"></div>
                <div class="form-group"><label>Unit</label><select id="editUnit"><option value="L" ${product.unit === 'L' ? 'selected' : ''}>L</option><option value="KG" ${product.unit === 'KG' ? 'selected' : ''}>KG</option></select></div>
                <div class="form-group"><label>Packing Size</label><input type="text" id="editPackSize" value="${product.pack_size.replace(/"/g, '&quot;')}"></div>
                <div class="form-group"><label>Selling Price (MWK)</label><input type="number" id="editPrice" value="${product.current_price || 0}" step="100"></div>
                <button id="saveEditBtn">Save Changes</button>
                <button id="cancelEditBtn">Cancel</button>
            `;
            document.body.appendChild(modal);
            document.getElementById('saveEditBtn').onclick = async () => {
                const newName = document.getElementById('editName').value.trim();
                const newUnit = document.getElementById('editUnit').value;
                const newPackSize = document.getElementById('editPackSize').value.trim();
                const newPrice = parseFloat(document.getElementById('editPrice').value);
                if (!newName || !newPackSize || isNaN(newPrice) || newPrice <= 0) {
                    alert('Invalid data');
                    return;
                }
                const newSku = newName.substring(0,4).toUpperCase() + '-' + newPackSize.substring(0,4).toUpperCase().replace(/[^A-Z0-9]/g,'');
                await sb.from('products').update({
                    sku: newSku, name: newName, unit: newUnit, pack_size: newPackSize, current_price: newPrice
                }).eq('id', product.id);
                if (typeof logAction === 'function') {
                    await logAction('update_product', 'products', product.id, `Updated product from "${product.name} - ${product.pack_size}" to "${newName} - ${newPackSize}" price ${newPrice}`);
                }
                showMessage('Product updated.', false);
                document.body.removeChild(modal);
                renderProductManagement();
            };
            document.getElementById('cancelEditBtn').onclick = () => document.body.removeChild(modal);
        }
    } catch (err) {
        container.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}