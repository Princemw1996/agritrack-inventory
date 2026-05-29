// modules/shop.js – Search suggestions faded out‑of‑stock + price autofill fixed
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
    let selectedProductId = null;
    let selectedProductName = '';
    let currentStock = 0;
    let currentPrice = 0;
    let products = [];

    // Discount variables
    let discountType = 'fixed';
    let discountValue = 0;

    // Map to hold stock quantities for the selected shop (product_id -> stock)
    let productStockMap = new Map();

    const loadProducts = async () => {
        const { data } = await sb.from('products').select('id, name, pack_size, unit, current_price');
        products = data || [];
        console.log('Products loaded:', products.length); // debug
    };

    const refreshStockForProduct = async (productId) => {
        if (!productId) return 0;
        const { data } = await sb.from('inventory')
            .select('quantity')
            .eq('location_id', selectedShopId)
            .eq('product_id', productId)
            .maybeSingle();
        return data?.quantity || 0;
    };

    const loadStockMap = async () => {
        const { data, error } = await sb.from('inventory')
            .select('product_id, quantity')
            .eq('location_id', selectedShopId);
        if (error) {
            console.error('Error loading stock map:', error);
            return;
        }
        productStockMap.clear();
        data.forEach(item => {
            productStockMap.set(item.product_id, item.quantity);
        });
    };

    function calculateDiscountedTotal(quantity, unitPrice) {
        let subtotal = quantity * unitPrice;
        let discountAmount = 0;
        if (discountType === 'fixed') {
            discountAmount = discountValue;
        } else if (discountType === 'percent' && discountValue > 0) {
            discountAmount = subtotal * (discountValue / 100);
        }
        discountAmount = Math.min(discountAmount, subtotal);
        return { subtotal, discountAmount, total: subtotal - discountAmount };
    }

    function updateDiscountDisplay() {
        const qty = parseFloat(document.getElementById('saleQty').value) || 0;
        const price = parseFloat(document.getElementById('salePrice').value) || 0;
        const { subtotal, discountAmount, total } = calculateDiscountedTotal(qty, price);
        document.getElementById('subtotalDisplay').innerText = formatNumber(subtotal);
        document.getElementById('discountDisplay').innerText = formatNumber(discountAmount);
        document.getElementById('totalDisplay').innerText = formatNumber(total);
        return total;
    }

    const updateProductSelection = async () => {
        if (!selectedProductId) {
            document.getElementById('productStockDisplay').innerHTML = '';
            document.getElementById('salePrice').value = '';
            document.getElementById('saleQty').disabled = true;
            document.getElementById('recordSaleBtn').disabled = true;
            return;
        }
        // Get the product from the loaded products array
        const product = products.find(p => p.id == selectedProductId);
        if (!product) {
            console.error('Product not found in products array:', selectedProductId);
            return;
        }
        currentPrice = product.current_price || 0;
        currentStock = await refreshStockForProduct(selectedProductId);
        document.getElementById('productStockDisplay').innerHTML = currentStock > 0 
            ? `<span style="color:green; font-weight:bold;">✅ In stock: ${currentStock} units</span>` 
            : `<span style="color:red; font-weight:bold;">❌ Out of stock</span>`;
        // Set the unit price field (auto‑fill)
        document.getElementById('salePrice').value = currentPrice;
        updateDiscountDisplay();
        if (currentStock > 0) {
            document.getElementById('saleQty').disabled = false;
            document.getElementById('recordSaleBtn').disabled = false;
        } else {
            document.getElementById('saleQty').disabled = true;
            document.getElementById('recordSaleBtn').disabled = true;
        }
    };

    const renderShopUI = async () => {
        await loadProducts();
        await loadStockMap();

        container.innerHTML = `
            <h2>🏪 Shop Management</h2>
            <div class="form-group">
                <label>Select Shop:</label>
                <select id="shopSelector">${shops.map(s => `<option value="${s.id}" ${s.id == selectedShopId ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
            </div>
            <div class="card" id="receiveTransfersCard">
                <h3>✅ Receive Pending Transfers</h3>
                <div id="shopPendingTransfers">Loading...</div>
            </div>
            <div class="card">
                <h3>💰 Record Sale</h3>
                <div class="form-group">
                    <label>Search Product:</label>
                    <input type="text" id="productSearch" placeholder="Type product name or pack size..." autocomplete="off" style="width:100%;">
                    <div id="productSuggestions" style="border:1px solid #ccc; max-height:200px; overflow-y:auto; display:none; background:white;"></div>
                </div>
                <div id="productStockDisplay" style="margin-bottom: 15px;"></div>
                <div class="flex-row">
                    <div style="flex:1"><label>Quantity</label><input type="number" id="saleQty" step="0.5" min="0" disabled></div>
                    <div style="flex:1"><label>Unit Price (MWK)</label><input type="number" id="salePrice" step="100" readonly style="background:#f5f5f5;"></div>
                </div>
                <div class="flex-row" style="margin-top: 15px; align-items: flex-end;">
                    <div style="flex:1">
                        <label>Discount Type:</label>
                        <select id="discountType">
                            <option value="fixed">Fixed Amount (MWK)</option>
                            <option value="percent">Percentage (%)</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Discount Value:</label>
                        <input type="number" id="discountValue" step="0.01" min="0" value="0">
                    </div>
                    <div style="flex:1">
                        <label>Payment Method:</label>
                        <select id="paymentMethod">
                            <option>cash</option>
                            <option>mobile_money</option>
                            <option>credit</option>
                        </select>
                    </div>
                    <div style="align-self:flex-end"><button id="recordSaleBtn" disabled>Record Sale</button></div>
                </div>
                <div style="margin-top: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px;">
                    <div><strong>Subtotal:</strong> MWK <span id="subtotalDisplay">0.00</span></div>
                    <div><strong>Discount:</strong> MWK <span id="discountDisplay">0.00</span></div>
                    <div><strong>Total to Pay:</strong> MWK <span id="totalDisplay">0.00</span></div>
                </div>
            </div>
            <div class="card">
                <h3>📈 Sales Report</h3>
                <div class="report-filters">
                    <label>Filter by:</label>
                    <select id="reportPeriod">
                        <option value="day">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                    <button id="loadReportBtn">Load Report</button>
                </div>
                <div id="reportResult"></div>
            </div>
        `;

        await loadShopPendingTransfers();

        // Searchable product dropdown with stock awareness
        const searchInput = document.getElementById('productSearch');
        const suggestionsDiv = document.getElementById('productSuggestions');
        const filterProducts = (searchTerm) => {
            const term = searchTerm.toLowerCase();
            return products.filter(p => p.name.toLowerCase().includes(term) || p.pack_size.toLowerCase().includes(term));
        };

        const showSuggestions = (filtered) => {
            suggestionsDiv.innerHTML = '';
            if (filtered.length === 0) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            filtered.slice(0,10).forEach(prod => {
                const stock = productStockMap.get(prod.id) || 0;
                const isOutOfStock = stock === 0;
                const div = document.createElement('div');
                div.textContent = `${prod.name} - ${prod.pack_size} (${prod.unit})`;
                div.style.padding = '8px';
                div.style.cursor = 'pointer';
                if (isOutOfStock) {
                    div.style.opacity = '0.5';
                    div.style.backgroundColor = '#f5f5f5';
                    div.style.textDecoration = 'line-through';
                    div.title = 'Out of stock';
                } else {
                    div.style.backgroundColor = 'white';
                }
                div.addEventListener('click', () => {
                    if (isOutOfStock) {
                        showMessage('This product is currently out of stock.', true);
                        return;
                    }
                    selectedProductId = prod.id;
                    selectedProductName = prod.name;
                    searchInput.value = `${prod.name} - ${prod.pack_size} (${prod.unit})`;
                    suggestionsDiv.style.display = 'none';
                    updateProductSelection(); // this will set the price and stock
                });
                suggestionsDiv.appendChild(div);
            });
            suggestionsDiv.style.display = 'block';
        };

        searchInput.addEventListener('input', () => {
            const term = searchInput.value;
            if (term.length < 2) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            showSuggestions(filterProducts(term));
        });
        document.addEventListener('click', (e) => {
            if (e.target !== searchInput && !suggestionsDiv.contains(e.target)) {
                suggestionsDiv.style.display = 'none';
            }
        });

        // Discount event listeners
        const discountTypeSelect = document.getElementById('discountType');
        const discountValueInput = document.getElementById('discountValue');
        const saleQtyInput = document.getElementById('saleQty');
        const salePriceInput = document.getElementById('salePrice');
        function recalcAndUpdate() {
            discountType = discountTypeSelect.value;
            discountValue = parseFloat(discountValueInput.value) || 0;
            const qty = parseFloat(saleQtyInput.value) || 0;
            const price = parseFloat(salePriceInput.value) || 0;
            const { subtotal, discountAmount, total } = calculateDiscountedTotal(qty, price);
            document.getElementById('subtotalDisplay').innerText = formatNumber(subtotal);
            document.getElementById('discountDisplay').innerText = formatNumber(discountAmount);
            document.getElementById('totalDisplay').innerText = formatNumber(total);
        }
        discountTypeSelect.addEventListener('change', recalcAndUpdate);
        discountValueInput.addEventListener('input', recalcAndUpdate);
        saleQtyInput.addEventListener('input', recalcAndUpdate);
        salePriceInput.addEventListener('input', recalcAndUpdate);

// Record sale button (updated with audit logging)
document.getElementById('recordSaleBtn').onclick = async () => {
    const qty = parseFloat(saleQtyInput.value);
    const price = parseFloat(salePriceInput.value);
    const method = document.getElementById('paymentMethod').value;
    const discountTypeVal = discountTypeSelect.value;
    const discountVal = parseFloat(discountValueInput.value) || 0;
    if (!selectedProductId || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
        showMessage('Please select a product and enter valid quantity.', true);
        return;
    }
    if (currentStock < qty) { showMessage('Insufficient stock!', true); return; }
    const subtotal = qty * price;
    let discountAmount = 0;
    if (discountTypeVal === 'fixed') {
        discountAmount = discountVal;
    } else if (discountTypeVal === 'percent') {
        discountAmount = subtotal * (discountVal / 100);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    const revenue = subtotal - discountAmount;
    try {
        // Insert sale and capture the inserted record ID
        const { data: saleRecord, error: saleError } = await sb.from('daily_sales').insert({
            location_id: selectedShopId, product_id: selectedProductId,
            sale_date: new Date().toISOString().split('T')[0],
            quantity_sold: qty, unit_price: price, revenue: revenue, payment_method: method,
            discount_type: discountTypeVal, discount_value: discountVal, discount_amount: discountAmount
        }).select().single();
        if (saleError) throw saleError;
        
        // Log the sale
        await logAction('record_sale', 'daily_sales', saleRecord.id, 
            `Sold ${qty} units of product ${selectedProductName} (ID: ${selectedProductId}) at shop ${shops.find(s => s.id == selectedShopId)?.name} for MWK ${revenue}. Discount: ${discountAmount} MWK (${discountTypeVal}: ${discountVal})`);
        
        // Update inventory
        const { data: inv, error: invError } = await sb.from('inventory')
            .select('id, quantity')
            .eq('location_id', selectedShopId)
            .eq('product_id', selectedProductId)
            .maybeSingle();
        if (invError) throw invError;
        if (!inv || inv.quantity < qty) throw new Error('Stock mismatch');
        await sb.from('inventory')
            .update({ quantity: inv.quantity - qty, last_updated: new Date().toISOString() })
            .eq('id', inv.id);
        
        // Log stock reduction
        await logAction('reduce_stock', 'inventory', inv.id, 
            `Reduced stock by ${qty} units at location ${selectedShopId} (${shops.find(s => s.id == selectedShopId)?.name}) for product ${selectedProductName} (ID: ${selectedProductId}). New stock: ${inv.quantity - qty}`);
        
        showMessage(`Sale recorded: ${qty} units sold. Total: MWK ${formatNumber(revenue)}`);
        printReceipt({
            shopName: shops.find(s => s.id == selectedShopId)?.name || 'Shop',
            productName: selectedProductName,
            quantity: qty,
            unitPrice: price,
            subtotal: subtotal,
            discountAmount: discountAmount,
            total: revenue,
            discountType: discountTypeVal,
            discountValue: discountVal,
            paymentMethod: method,
            date: new Date().toLocaleString()
        });
        await updateProductSelection();
        saleQtyInput.value = '';
        discountValueInput.value = '0';
        recalcAndUpdate();
        await loadShopPendingTransfers();
    } catch (err) { showMessage(err.message, true); }
};

        // Sales report (unchanged)
        document.getElementById('loadReportBtn').onclick = async () => {
            const period = document.getElementById('reportPeriod').value;
            const today = new Date().toISOString().split('T')[0];
            let startDate = today;
            if (period === 'week') {
                const start = new Date(); start.setDate(start.getDate() - 7);
                startDate = start.toISOString().split('T')[0];
            } else if (period === 'month') {
                const start = new Date(); start.setDate(1);
                startDate = start.toISOString().split('T')[0];
            }
            const { data: sales, error } = await sb.from('daily_sales')
                .select('*, products(name, pack_size)')
                .eq('location_id', selectedShopId)
                .gte('sale_date', startDate)
                .lte('sale_date', today);
            if (error) { showMessage(error.message, true); return; }
            const reportDiv = document.getElementById('reportResult');
            if (!sales || sales.length === 0) { reportDiv.innerHTML = '<p>No sales in this period.</p>'; return; }
            let totalRev = 0;
            let table = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Unit Price (MWK)</th><th>Discount</th><th>Total (MWK)</th><th>Payment</th></tr></thead><tbody>';
            for (const sale of sales) {
                totalRev += sale.revenue;
                table += `<tr>
                    <td>${sale.sale_date}</td>
                    <td>${sale.products.name} - ${sale.products.pack_size}</td>
                    <td>${sale.quantity_sold}</td>
                    <td>${formatNumber(sale.unit_price)}</td>
                    <td>${sale.discount_amount ? formatNumber(sale.discount_amount) : '0.00'}</td>
                    <td>${formatNumber(sale.revenue)}</td>
                    <td>${sale.payment_method}</td>
                </tr>`;
            }
            table += `<tr style="background:#e9f5e9;"><td colspan="5"><strong>TOTAL REVENUE</strong></td><td colspan="2"><strong>${formatNumber(totalRev)} MWK</strong><tr></tr>`;
            table += '</tbody></table></div>';
            reportDiv.innerHTML = table;
        };
    };

    // Print receipt (unchanged)
    function printReceipt(data) {
        const discountLine = data.discountAmount > 0 
            ? `<p><strong>Discount (${data.discountType === 'fixed' ? 'MWK' : '%'} ${data.discountValue}):</strong> - MWK ${formatNumber(data.discountAmount)}</p>` 
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
                .footer { text-align: center; font-size: 12px; margin-top: 15px; }
            </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="company">Rose Harris Investments</div>
                    <p><strong>Shop:</strong> ${data.shopName}</p>
                    <p><strong>Date:</strong> ${data.date}</p>
                    <hr>
                    <p><strong>Product:</strong> ${data.productName}</p>
                    <p><strong>Quantity:</strong> ${data.quantity}</p>
                    <p><strong>Unit Price:</strong> MWK ${formatNumber(data.unitPrice)}</p>
                    <p><strong>Subtotal:</strong> MWK ${formatNumber(data.subtotal)}</p>
                    ${discountLine}
                    <p><strong>Total Paid:</strong> MWK ${formatNumber(data.total)}</p>
                    <p><strong>Payment:</strong> ${data.paymentMethod}</p>
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

    // Load pending transfers (unchanged)
    async function loadShopPendingTransfers() {
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
        let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product</th><th>Quantity</th><th>Action</th></tr></thead><tbody>';
        for (const t of pending) {
            html += `<tr>
                <td>${t.products.name} - ${t.products.pack_size} (${t.products.unit})</td>
                <td>${t.quantity}</td>
                <td><button class="confirmShopReceive" data-id="${t.id}">Confirm Receipt</button></td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        pendingDiv.innerHTML = html;
        document.querySelectorAll('.confirmShopReceive').forEach(btn => {
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
                    await sb.from('inventory').update({ quantity: inv.quantity + t.quantity, last_updated: new Date().toISOString() }).eq('id', inv.id);
                } else {
                    await sb.from('inventory').insert({ location_id: selectedShopId, product_id: t.product_id, quantity: t.quantity, last_updated: new Date().toISOString() });
                }
                await sb.from('transfers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', transferId);
                showMessage(`✅ Received ${t.quantity} units. Shop stock updated.`);
                await loadShopPendingTransfers();
                if (selectedProductId) await updateProductSelection();
            });
        });
    }

    container.innerHTML = `<div class="loading">Loading shop data...</div>`;
    await renderShopUI();
    document.getElementById('shopSelector').addEventListener('change', async (e) => {
        selectedShopId = parseInt(e.target.value);
        selectedProductId = null;
        currentStock = 0;
        document.getElementById('productSearch').value = '';
        document.getElementById('productSuggestions').style.display = 'none';
        await renderShopUI();
    });
}