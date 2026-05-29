// modules/minStock.js
async function renderMinStock() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading Min Warehouse stock...</div>';
    try {
        const { data, error } = await sb.from('inventory')
            .select('quantity, products(name, unit, pack_size, current_price)')
            .eq('location_id', 2);
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = '<p>No stock in Min Warehouse.</p>';
            return;
        }
        let html = '<h2>📊 Min Warehouse Stock</h2><div style="overflow-x:auto;">';
        html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Selling Price (MWK)</th><th>Total Value (MWK)</th></tr></thead><tbody>';
        let grand = 0;
        for (const row of data) {
            const p = row.products;
            const qty = row.quantity;
            const price = p.current_price || 0;
            const total = qty * price;
            grand += total;
            html += `<tr>
                <td>${p.name}</td>
                <td>${p.unit}</td>
                <td>${p.pack_size}</td>
                <td>${qty}</td>
                <td>${formatNumber(price)}</td>
                <td>${formatNumber(total)}</td>
            </tr>`;
        }
        html += `<tr style="background:#e9f5e9;"><td colspan="5"><strong>GRAND TOTAL</strong></td>
                <td><strong>${formatNumber(grand)} MWK</strong></td>
               </tr>`;
        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class="error">${err.message}</div>`;
    }
}