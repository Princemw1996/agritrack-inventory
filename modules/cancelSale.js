// modules/cancelSale.js
async function renderCancelSale() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading sales...</div>';
    try {
        const { data: shops } = await sb.from('locations').select('id, name').eq('type', 'shop');
        if (!shops || shops.length === 0) {
            container.innerHTML = '<div class="error">No shops found.</div>';
            return;
        }
        const filterHtml = `
            <h2>❌ Cancel Sale (Admin Only)</h2>
            <div class="card" style="margin-bottom:20px;">
                <div class="flex-row">
                    <div style="flex:1">
                        <label>Shop:</label>
                        <select id="filterShop">
                            <option value="all">All Shops</option>
                            ${shops.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label>Date Range:</label>
                        <select id="filterDateRange">
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div id="customDateRange" style="display:none; flex:2;">
                        <label>From:</label><input type="date" id="startDate">
                        <label>To:</label><input type="date" id="endDate">
                    </div>
                    <div style="align-self:flex-end;"><button id="applyFilterBtn">Apply Filter</button></div>
                </div>
            </div>
            <div id="salesTableContainer">Loading sales...</div>
        `;
        container.innerHTML = filterHtml;

        const dateRangeSelect = document.getElementById('filterDateRange');
        const customDiv = document.getElementById('customDateRange');
        dateRangeSelect.addEventListener('change', () => {
            customDiv.style.display = dateRangeSelect.value === 'custom' ? 'flex' : 'none';
        });
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = todayStr;
        document.getElementById('endDate').value = todayStr;

        async function loadSales() {
            const shopId = document.getElementById('filterShop').value;
            const dateOption = document.getElementById('filterDateRange').value;
            let startDate, endDate;
            if (dateOption === 'custom') {
                startDate = document.getElementById('startDate').value;
                endDate = document.getElementById('endDate').value;
                if (!startDate || !endDate) {
                    document.getElementById('salesTableContainer').innerHTML = '<p>Please select both dates.</p>';
                    return;
                }
            } else {
                const today = new Date().toISOString().split('T')[0];
                if (dateOption === 'today') { startDate = endDate = today; }
                else if (dateOption === 'yesterday') {
                    const y = new Date(); y.setDate(y.getDate() - 1);
                    const yStr = y.toISOString().split('T')[0];
                    startDate = endDate = yStr;
                }
            }
            let query = sb.from('daily_sales')
                .select('*, products(name, pack_size, unit), locations(name)')
                .eq('cancelled', false)
                .gte('sale_date', startDate)
                .lte('sale_date', endDate);
            if (shopId !== 'all') query = query.eq('location_id', parseInt(shopId));
            const { data: sales, error } = await query.order('sale_date', { ascending: false });
            if (error) throw error;
            const tableDiv = document.getElementById('salesTableContainer');
            if (!sales || sales.length === 0) {
                tableDiv.innerHTML = '<p>No sales found.</p>';
                return;
            }
            let html = '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;"><thead><tr><th>Date</th><th>Shop</th><th>Product</th><th>Quantity</th><th>Unit Price (MWK)</th><th>Total (MWK)</th><th>Payment</th><th>Action</th></tr></thead><tbody>';
            for (const sale of sales) {
                html += `<tr>
                    <td>${sale.sale_date}</td>
                    <td>${sale.locations?.name || 'Unknown'}</td>
                    <td>${sale.products?.name || 'Unknown'} - ${sale.products?.pack_size || ''}</td>
                    <td>${sale.quantity_sold}</td>
                    <td>${formatNumber(sale.unit_price)}</td>
                    <td>${formatNumber(sale.revenue)}</td>
                    <td>${sale.payment_method}</td>
                    <td><button class="cancelSaleBtn" data-id="${sale.id}" data-location="${sale.location_id}" data-product="${sale.product_id}" data-qty="${sale.quantity_sold}">Cancel Sale</button></td>
                </tr>`;
            }
            html += '</tbody></table></div>';
            tableDiv.innerHTML = html;

            // Cancel button handler with audit logging
            document.querySelectorAll('.cancelSaleBtn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const saleId = parseInt(btn.dataset.id);
                    const locationId = parseInt(btn.dataset.location);
                    const productId = parseInt(btn.dataset.product);
                    const qty = parseFloat(btn.dataset.qty);
                    if (!confirm(`Cancel this sale? ${qty} units will be returned to stock.`)) return;
                    try {
                        // Mark sale as cancelled
                        await sb.from('daily_sales').update({ cancelled: true }).eq('id', saleId);
                        await logAction('cancel_sale', 'daily_sales', saleId, `Cancelled sale ID ${saleId}, returned ${qty} units of product ${productId} to location ${locationId}`);

                        // Return stock to inventory
                        const { data: inv } = await sb.from('inventory')
                            .select('id, quantity')
                            .eq('location_id', locationId)
                            .eq('product_id', productId)
                            .maybeSingle();
                        if (inv) {
                            await sb.from('inventory')
                                .update({ quantity: inv.quantity + qty, last_updated: new Date().toISOString() })
                                .eq('id', inv.id);
                            await logAction('return_stock', 'inventory', inv.id, `Returned ${qty} units to location ${locationId} for product ${productId}. New stock: ${inv.quantity + qty}`);
                        } else {
                            const { data: newInv } = await sb.from('inventory')
                                .insert({ location_id: locationId, product_id: productId, quantity: qty, last_updated: new Date().toISOString() })
                                .select()
                                .single();
                            await logAction('return_stock', 'inventory', newInv.id, `Created new inventory record with ${qty} units at location ${locationId} for product ${productId} (sale cancellation)`);
                        }
                        showMessage(`Sale cancelled. ${qty} units returned to stock.`, false);
                        loadSales(); // refresh list
                    } catch (err) {
                        showMessage(`Error: ${err.message}`, true);
                    }
                });
            });
        }

        document.getElementById('applyFilterBtn').addEventListener('click', loadSales);
        loadSales();
    } catch (err) {
        container.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}