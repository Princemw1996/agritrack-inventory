// modules/shop.js – Till interface with 2‑column product grid, search, and shop selector
async function renderShop() {
    const container = document.getElementById('moduleContainer');
    let shops;
    if (currentUserRole === 'admin') {
        const { data } = await sb.from('locations').select('id, name').eq('type', 'shop');
        shops = data || [];
    } else {
        if (currentUserShops.length === 0) {
            container.innerHTML = '<div class="error">You are not assigned to any shop. Contact admin.</div>';
            return;
        }
        const { data } = await sb.from('locations').select('id, name').eq('type', 'shop').in('id', currentUserShops);
        shops = data || [];
    }
    if (!shops || shops.length === 0) {
        container.innerHTML = '<div class="error">No shops available.</div>';
        return;
    }

    let selectedShopId = shops[0].id;
    let products = [];
    let cart = [];
    let discountType = 'fixed';
    let discountValue = 0;
    let amountPaid = 0;

    const loadProducts = async () => {
        const { data } = await sb.from('products').select('id, name, pack_size, unit, current_price');
        products = data || [];
    };

    const refreshStockMap = async () => {
        const { data } = await sb.from('inventory')
            .select('product_id, quantity')
            .eq('location_id', selectedShopId);
        const map = new Map();
        data?.forEach(item => map.set(item.product_id, item.quantity));
        return map;
    };

    let stockMap = new Map();

    function updateCartDisplay() {
        const cartItemsDiv = document.getElementById('cartItems');
        let subtotal = 0;
        cartItemsDiv.innerHTML = '';
        cart.forEach((item, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name} - ${item.packSize}</td>
                <td>x ${item.quantity}</td>
                <td>MWK ${formatNumber(item.price)}</td>
                <td>MWK ${formatNumber(item.subtotal)}</td>
                <td><button class="removeItemBtn" data-idx="${idx}" style="background:#dc3545; color:white; border:none; border-radius:4px; padding:2px 8px;">✖</button></td>
            `;
            cartItemsDiv.appendChild(row);
            subtotal += item.subtotal;
        });
        document.getElementById('cartSubtotal').innerText = formatNumber(subtotal);
        recalcTotals();
        return subtotal;
    }

    function recalcTotals() {
        const subtotal = parseFloat(document.getElementById('cartSubtotal').innerText.replace(/,/g, '')) || 0;
        let discountAmount = 0;
        if (discountType === 'fixed') discountAmount = discountValue;
        else if (discountType === 'percent') discountAmount = subtotal * (discountValue / 100);
        discountAmount = Math.min(discountAmount, subtotal);
        const total = subtotal - discountAmount;
        document.getElementById('discountDisplay').innerText = formatNumber(discountAmount);
        document.getElementById('totalDisplay').innerText = formatNumber(total);
        updateChangeDisplay();
        return total;
    }

    function updateChangeDisplay() {
        const total = parseFloat(document.getElementById('totalDisplay').innerText.replace(/,/g, '')) || 0;
        const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
        const change = paid - total;
        const changeSpan = document.getElementById('changeDisplay');
        changeSpan.innerText = formatNumber(change);
        changeSpan.style.color = change >= 0 ? '#155724' : '#721c24';
        document.getElementById('recordSaleBtn').disabled = change < 0;
    }

    async function addToCart(productId, quantity) {
        const product = products.find(p => p.id == productId);
        if (!product) return;
        const stock = stockMap.get(productId) || 0;
        if (stock < quantity) {
            showMessage(`Insufficient stock. Only ${stock} available.`, true);
            return false;
        }
        const existing = cart.find(item => item.productId === productId);
        if (existing) {
            existing.quantity += quantity;
            existing.subtotal = existing.quantity * existing.price;
        } else {
            cart.push({
                productId: product.id,
                name: product.name,
                packSize: product.pack_size,
                unit: product.unit,
                price: product.current_price,
                quantity: quantity,
                subtotal: quantity * product.current_price
            });
        }
        updateCartDisplay();
        return true;
    }

    async function removeFromCart(idx) {
        cart.splice(idx, 1);
        updateCartDisplay();
    }

    async function clearCart() {
        cart = [];
        updateCartDisplay();
    }

    async function recordSale() {
        if (cart.length === 0) {
            showMessage('Cart is empty.', true);
            return;
        }
        const subtotal = parseFloat(document.getElementById('cartSubtotal').innerText.replace(/,/g, '')) || 0;
        const discountAmount = parseFloat(document.getElementById('discountDisplay').innerText.replace(/,/g, '')) || 0;
        const total = parseFloat(document.getElementById('totalDisplay').innerText.replace(/,/g, '')) || 0;
        const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
        const change = paid - total;
        if (paid < total) {
            showMessage('Insufficient payment.', true);
            return;
        }

        const freshStockMap = await refreshStockMap();
        for (const item of cart) {
            const stock = freshStockMap.get(item.productId) || 0;
            if (stock < item.quantity) {
                showMessage(`Insufficient stock for ${item.name}. Only ${stock} left.`, true);
                return;
            }
        }

        const saleDate = new Date().toISOString().split('T')[0];
        const paymentMethod = document.getElementById('paymentMethod').value;

        try {
            for (const item of cart) {
                const itemDiscount = (item.subtotal / subtotal) * discountAmount;
                const itemRevenue = item.subtotal - itemDiscount;
                await sb.from('daily_sales').insert({
                    location_id: selectedShopId,
                    product_id: item.productId,
                    sale_date: saleDate,
                    quantity_sold: item.quantity,
                    unit_price: item.price,
                    revenue: itemRevenue,
                    payment_method: paymentMethod,
                    discount_type: discountType,
                    discount_value: discountValue,
                    discount_amount: itemDiscount
                });
                const { data: inv } = await sb.from('inventory')
                    .select('id, quantity')
                    .eq('location_id', selectedShopId)
                    .eq('product_id', item.productId)
                    .maybeSingle();
                if (inv) {
                    await sb.from('inventory')
                        .update({ quantity: inv.quantity - item.quantity, last_updated: new Date().toISOString() })
                        .eq('id', inv.id);
                }
            }
            await logAction('record_sale', 'daily_sales', null, `Sold ${cart.length} item(s) at shop ${shops.find(s => s.id == selectedShopId)?.name} for MWK ${total}. Paid: ${paid}, Change: ${change}`);
            showMessage(`Sale recorded successfully. Change: MWK ${formatNumber(change)}`, false);
            printReceipt({
                shopName: shops.find(s => s.id == selectedShopId)?.name || 'Shop',
                items: cart,
                subtotal: subtotal,
                discountAmount: discountAmount,
                total: total,
                discountType: discountType,
                discountValue: discountValue,
                paymentMethod: paymentMethod,
                date: new Date().toLocaleString(),
                amountPaid: paid,
                change: change
            });
            cart = [];
            discountValue = 0;
            discountType = 'fixed';
            document.getElementById('discountType').value = 'fixed';
            document.getElementById('discountValue').value = 0;
            document.getElementById('amountPaid').value = 0;
            updateCartDisplay();
            recalcTotals();
            stockMap = await refreshStockMap();
            renderProductGrid(); // refresh product grid with new stock
        } catch (err) {
            showMessage(err.message, true);
        }
    }

    function printReceipt(data) {
        const itemsHtml = data.items.map(item => `
            <tr>
                <td>${item.name} - ${item.packSize}</td>
                <td>${item.quantity}</td>
                <td>MWK ${formatNumber(item.price)}</td>
                <td>MWK ${formatNumber(item.subtotal)}</td>
            </tr>
        `).join('');
        const discountLine = data.discountAmount > 0 
            ? `<p><strong>Discount (${data.discountType === 'fixed' ? 'MWK' : '%'} ${data.discountValue}):</strong> MWK ${formatNumber(data.discountAmount)}</p>` 
            : '';
        const receiptContent = `
            <!DOCTYPE html>
            <html>
            <head><title>Sale Receipt</title>
            <style>
                body { font-family: monospace; padding: 20px; }
                .receipt { max-width: 300px; margin: auto; border: 1px solid #ccc; padding: 15px; }
                .company { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 5px; }
                hr { margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                th, td { text-align: left; padding: 4px; }
                .footer { text-align: center; font-size: 12px; margin-top: 15px; }
            </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="company">Rose Harris Investments</div>
                    <p><strong>Shop:</strong> ${data.shopName}</p>
                    <p><strong>Date:</strong> ${data.date}</p>
                    <hr>
                    <table>
                        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <p><strong>Subtotal:</strong> MWK ${formatNumber(data.subtotal)}</p>
                    ${discountLine}
                    <p><strong>Total:</strong> MWK ${formatNumber(data.total)}</p>
                    <p><strong>Amount Paid:</strong> MWK ${formatNumber(data.amountPaid)}</p>
                    <p><strong>Change:</strong> MWK ${formatNumber(data.change)}</p>
                    <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
                    <hr>
                    <p class="footer">Thank you for your purchase!</p>
                </div>
                <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };<\/script>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(receiptContent);
        printWindow.document.close();
    }

    // Render product grid (two columns) with search filter
    function renderProductGrid(searchTerm = '') {
        const gridContainer = document.getElementById('productGrid');
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        const term = searchTerm.toLowerCase();
        products.forEach(product => {
            const stock = stockMap.get(product.id) || 0;
            // Check if product matches search term
            if (term) {
                const nameMatch = product.name.toLowerCase().includes(term);
                const packMatch = product.pack_size.toLowerCase().includes(term);
                if (!nameMatch && !packMatch) return;
            }
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.border = '1px solid #ddd';
            card.style.borderRadius = '8px';
            card.style.padding = '10px';
            card.style.cursor = stock > 0 ? 'pointer' : 'default';
            card.style.backgroundColor = stock === 0 ? '#f9f9f9' : 'white';
            card.style.opacity = stock === 0 ? '0.6' : '1';
            card.innerHTML = `
                <div><strong>${product.name}</strong></div>
                <div style="font-size:12px;">${product.pack_size} (${product.unit})</div>
                <div style="color:green;">MWK ${formatNumber(product.current_price)}</div>
                <div style="font-size:12px;">Stock: ${stock}</div>
            `;
            if (stock > 0) {
                card.addEventListener('click', async () => {
                    const qty = parseFloat(prompt('Enter quantity:', '1'));
                    if (!isNaN(qty) && qty > 0) {
                        await addToCart(product.id, qty);
                    }
                });
            } else {
                card.title = 'Out of stock';
            }
            gridContainer.appendChild(card);
        });
    }

    // Render the till UI (includes shop selector, search bar)
    async function renderTill() {
        await loadProducts();
        stockMap = await refreshStockMap();
        container.innerHTML = `
            <style>
                .till-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .product-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-height: 400px; overflow-y: auto; padding: 5px; }
                .product-card { transition: 0.2s; }
                .product-card:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                .cart-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .cart-table th, .cart-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                .total-row { margin-top: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px; }
                .search-bar { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px; }
            </style>
            <div class="form-group">
                <label>Select Shop:</label>
                <select id="shopSelector">${shops.map(s => `<option value="${s.id}" ${s.id == selectedShopId ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </div>
            <h2>🏪 Point of Sale – <span id="shopNameDisplay">${shops.find(s => s.id == selectedShopId)?.name}</span></h2>
            <div class="till-grid">
                <!-- Left column: Product grid with search -->
                <div>
                    <input type="text" id="productSearch" class="search-bar" placeholder="Search products (name or pack size)..." autocomplete="off">
                    <div class="product-grid" id="productGrid"></div>
                </div>
                <!-- Right column: Cart -->
                <div>
                    <div style="max-height: 350px; overflow-y: auto;">
                        <table class="cart-table">
                            <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
                            <tbody id="cartItems"></tbody>
                        </table>
                    </div>
                    <div class="total-row">
                        <div><strong>Subtotal:</strong> MWK <span id="cartSubtotal">0.00</span></div>
                        <div style="margin-top:5px;">
                            <label>Discount: </label>
                            <select id="discountType" style="width:80px;">
                                <option value="fixed">Fixed</option>
                                <option value="percent">%</option>
                            </select>
                            <input type="number" id="discountValue" step="0.01" value="0" style="width:100px;">
                            <span>MWK <span id="discountDisplay">0.00</span></span>
                        </div>
                        <div><strong>Total to Pay:</strong> MWK <span id="totalDisplay">0.00</span></div>
                        <div style="margin-top:10px;">
                            <label>Amount Paid:</label>
                            <input type="number" id="amountPaid" step="100" value="0" style="width:150px;">
                            <span>Change: MWK <span id="changeDisplay">0.00</span></span>
                        </div>
                        <div style="margin-top:10px;">
                            <label>Payment Method:</label>
                            <select id="paymentMethod">
                                <option>cash</option>
                                <option>mobile_money</option>
                                <option>credit</option>
                            </select>
                        </div>
                        <div style="margin-top:15px;">
                            <button id="recordSaleBtn" style="background:#2C5F2D; color:white; border:none; padding:10px 20px; border-radius:6px;">Complete Sale</button>
                            <button id="clearCartBtn" style="background:#6c757d; color:white; border:none; padding:10px 20px; border-radius:6px;">Clear Cart</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card" style="margin-top:20px;">
                <h3>✅ Receive Pending Transfers</h3>
                <div id="shopPendingTransfers">Loading...</div>
            </div>
        `;

        // Render product grid initially
        renderProductGrid();

        // Search event listener
        const searchInput = document.getElementById('productSearch');
        searchInput.addEventListener('input', function() {
            const term = this.value;
            renderProductGrid(term);
        });

        // Shop selector change event
        document.getElementById('shopSelector').addEventListener('change', async (e) => {
            selectedShopId = parseInt(e.target.value);
            cart = [];
            discountValue = 0;
            discountType = 'fixed';
            await renderTill();
        });

        // Cart event listeners
        document.getElementById('cartItems').addEventListener('click', (e) => {
            if (e.target.classList.contains('removeItemBtn')) {
                const idx = parseInt(e.target.dataset.idx);
                removeFromCart(idx);
            }
        });

        const discountTypeSelect = document.getElementById('discountType');
        const discountValueInput = document.getElementById('discountValue');
        const amountPaidInput = document.getElementById('amountPaid');
        discountTypeSelect.addEventListener('change', () => {
            discountType = discountTypeSelect.value;
            recalcTotals();
        });
        discountValueInput.addEventListener('input', () => {
            discountValue = parseFloat(discountValueInput.value) || 0;
            recalcTotals();
        });
        amountPaidInput.addEventListener('input', updateChangeDisplay);

        document.getElementById('recordSaleBtn').onclick = recordSale;
        document.getElementById('clearCartBtn').onclick = clearCart;

        await loadPendingTransfers();
    }

    async function loadPendingTransfers() {
        const pendingDiv = document.getElementById('shopPendingTransfers');
        const { data: transfers, error } = await sb.from('transfers')
            .select('*')
            .eq('to_location_id', selectedShopId)
            .eq('status', 'pending');
        if (error) { pendingDiv.innerHTML = `<div class="error">${error.message}</div>`; return; }
        if (!transfers || transfers.length === 0) {
            pendingDiv.innerHTML = '<p>📭 No pending transfers for this shop.</p>';
            return;
        }
        const { data: allProducts, error: prodErr } = await sb.from('products').select('id, name, pack_size, unit');
        if (prodErr) { pendingDiv.innerHTML = `<div class="error">${prodErr.message}</div>`; return; }
        const productMap = new Map(allProducts.map(p => [p.id, p]));
        const pending = transfers.map(t => ({ ...t, products: productMap.get(t.product_id) || { name: 'Unknown', pack_size: '', unit: '' } }));
        let html = '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr><th>Product</th><th>Quantity</th><th>Action</th></tr></thead><tbody>';
        for (const t of pending) {
            html += `<tr>
                <td>${t.products.name} - ${t.products.pack_size} (${t.products.unit})</td>
                <td>${t.quantity}</td>
                <td><button class="confirmReceive" data-id="${t.id}">Confirm Receipt</button></td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        pendingDiv.innerHTML = html;
        document.querySelectorAll('.confirmReceive').forEach(btn => {
            btn.addEventListener('click', async () => {
                const transferId = parseInt(btn.dataset.id);
                const { data: t } = await sb.from('transfers').select('*').eq('id', transferId).single();
                if (!t) return;
                const { data: inv } = await sb.from('inventory')
                    .select('id, quantity')
                    .eq('location_id', selectedShopId)
                    .eq('product_id', t.product_id)
                    .maybeSingle();
                if (inv) {
                    await sb.from('inventory')
                        .update({ quantity: inv.quantity + t.quantity, last_updated: new Date().toISOString() })
                        .eq('id', inv.id);
                } else {
                    await sb.from('inventory')
                        .insert({ location_id: selectedShopId, product_id: t.product_id, quantity: t.quantity, last_updated: new Date().toISOString() });
                }
                await sb.from('transfers')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', transferId);
                showMessage(`✅ Received ${t.quantity} units.`, false);
                await loadPendingTransfers();
                stockMap = await refreshStockMap();
                renderProductGrid(document.getElementById('productSearch')?.value || '');
            });
        });
    }

    // Start the till
    await renderTill();
}