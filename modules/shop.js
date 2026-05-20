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
    let currentStock = [];
    let products = [];

    const refreshStock = async () => {
        const { data } = await sb.from('inventory')
            .select('quantity, products(name, unit, pack_size, current_price)')
            .eq('location_id', selectedShopId);
        currentStock = data || [];
    };
    const loadProducts = async () => {
        const { data } = await sb.from('products').select('id, name, pack_size, unit, current_price');
        products = data || [];
    };
    const renderShopUI = async () => {
        await refreshStock();
        await loadProducts();
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
                <div class="flex-row">
                    <div style="flex:1"><label>Product</label><select id="saleProduct"></select></div>
                    <div style="flex:1"><label>Quantity</label><input type="number" id="saleQty" step="0.5"></div>
                    <div style="flex:1"><label>Unit Price (MWK)</label><input type="number" id="salePrice" step="100"></div>
                    <div style="flex:1"><label>Payment Method</label><select id="paymentMethod"><option>cash</option><option>mobile_money</option><option>credit</option></select></div>
                    <div style="align-self:flex-end"><button id="recordSaleBtn" style="margin-top: 20px;">Record Sale</button></div>
                </div>
            </div>
            <div class="card">
                <h3>📊 Current Stock (${shops.find(s => s.id == selectedShopId)?.name})</h3>
                <div id="shopStockTable"></div>
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
        const saleProdSelect = document.getElementById('saleProduct');
        saleProdSelect.innerHTML = '<option value="">-- Select --</option>';
        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} - ${p.pack_size} (${p.unit})`;
            opt.setAttribute('data-price', p.current_price || 0);
            saleProdSelect.appendChild(opt);
        });
        saleProdSelect.addEventListener('change', () => {
            const price = saleProdSelect.selectedOptions[0]?.getAttribute('data-price') || 0;
            document.getElementById('salePrice').value = price;
        });
        const stockDiv = document.getElementById('shopStockTable');
        if (currentStock.length === 0) {
            stockDiv.innerHTML = '<p>No stock in this shop.</p>';
        } else {
            let html = '<div style="overflow-x:auto;">';
            html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Selling Price (MWK)</th><th>Total Value (MWK)</th></tr></thead><tbody>';
            let grand = 0;
            for (const item of currentStock) {
                const p = item.products;
                const qty = item.quantity;
                const price = p.current_price || 0;
                const total = qty * price;
                grand += total;
                html += `<tr>
                    <td>${p.name}</td>
                    <td>${p.unit}</td>
                    <td>${p.pack_size}</td>
                    <td>${qty}</td>
                    <td>${price.toFixed(2)}</td>
                    <td>${total.toFixed(2)}</td>
                </tr>`;
            }
            html += `<tr style="background:#e9f5e9;"><td colspan="5"><strong>GRAND TOTAL</strong></td><td><strong>${grand.toFixed(2)} MWK</strong></td></tr>`;
            html += '</tbody></table></div>';
            stockDiv.innerHTML = html;
        }
        document.getElementById('recordSaleBtn').onclick = async () => {
            const productId = saleProdSelect.value;
            const qty = parseFloat(document.getElementById('saleQty').value);
            let price = parseFloat(document.getElementById('salePrice').value);
            const method = document.getElementById('paymentMethod').value;
            if (!productId || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
                showMessage('All fields required and positive.', true);
                return;
            }
            const revenue = qty * price;
            try {
                await sb.from('daily_sales').insert({
                    location_id: selectedShopId, product_id: productId,
                    sale_date: new Date().toISOString().split('T')[0],
                    quantity_sold: qty, unit_price: price, revenue: revenue, payment_method: method
                });
                const { data: inv } = await sb.from('inventory').select('id, quantity').eq('location_id', selectedShopId).eq('product_id', productId).maybeSingle();
                if (!inv || inv.quantity < qty) throw new Error('Insufficient stock');
                await sb.from('inventory').update({ quantity: inv.quantity - qty, last_updated: new Date().toISOString() }).eq('id', inv.id);
                showMessage(`Sale recorded: ${qty} units sold. Stock updated.`);
                document.getElementById('saleQty').value = '';
                renderShopUI();
            } catch (err) { showMessage(err.message, true); }
        };
        document.getElementById('loadReportBtn').onclick = async () => {
            const period = document.getElementById('reportPeriod').value;
            const today = new Date().toISOString().split('T')[0];
            let startDate = today;
            if (period === 'week') {
                const start = new Date();
                start.setDate(start.getDate() - 7);
                startDate = start.toISOString().split('T')[0];
            } else if (period === 'month') {
                const start = new Date();
                start.setDate(1);
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
            let table = '<div style="overflow-x:auto;">';
            table += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Unit Price (MWK)</th><th>Total (MWK)</th><th>Payment</th></tr></thead><tbody>';
            for (const sale of sales) {
                totalRev += sale.revenue;
                table += `<tr>
                    <td>${sale.sale_date}</td>
                    <td>${sale.products.name} - ${sale.products.pack_size}</td>
                    <td>${sale.quantity_sold}</td>
                    <td>${sale.unit_price.toFixed(2)}</td>
                    <td>${sale.revenue.toFixed(2)}</td>
                    <td>${sale.payment_method}</td>
                </tr>`;
            }
            table += `<tr style="background:#e9f5e9;"><td colspan="4"><strong>TOTAL REVENUE</strong></td><td colspan="2"><strong>${totalRev.toFixed(2)} MWK</strong></td></tr>`;
            table += '</tbody></table></div>';
            reportDiv.innerHTML = table;
        };
    };
    async function loadShopPendingTransfers() {
        const pendingDiv = document.getElementById('shopPendingTransfers');
        const { data: pending, error } = await sb.from('transfers')
            .select('*, products(name, pack_size, unit)')
            .eq('to_location_id', selectedShopId)
            .eq('status', 'pending');
        if (error) { pendingDiv.innerHTML = `<div class="error">${error.message}</div>`; return; }
        if (!pending || pending.length === 0) {
            pendingDiv.innerHTML = '<p>📭 No pending transfers for this shop.</p>';
            return;
        }
        let html = '<div style="overflow-x:auto;">';
        html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product</th><th>Quantity</th><th>Action</th></tr></thead><tbody>';
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
                renderShopUI();
            });
        });
    }
    container.innerHTML = `<div class="loading">Loading shop data...</div>`;
    await renderShopUI();
    document.getElementById('shopSelector')?.addEventListener('change', async (e) => {
        selectedShopId = parseInt(e.target.value);
        await renderShopUI();
    });
}