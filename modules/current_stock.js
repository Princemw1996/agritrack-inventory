async function renderCurrentStock(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Current Stock Levels</h2>
            <div id="stockLocations"></div>
        </div>
    `;
    const locations = await getLocations();
    const stockDiv = document.getElementById('stockLocations');
    stockDiv.innerHTML = '';
    for (const loc of locations) {
        const { data: inv } = await supabase
            .from('inventory')
            .select('products(name, unit, pack_size, current_price), quantity')
            .eq('location_id', loc.id);
        const details = document.createElement('details');
        details.innerHTML = `<summary><strong>${loc.name}</strong></summary>`;
        if (!inv || inv.length === 0) {
            details.innerHTML += '<p>No stock recorded.</p>';
        } else {
            let table = '<table><thead><tr><th>Product</th><th>Unit</th><th>Packing Size</th><th>Quantity</th><th>Selling Price (MWK)</th><th>Total Value (MWK)</th></tr></thead><tbody>';
            inv.forEach(item => {
                const p = item.products;
                const qty = item.quantity;
                const price = p.current_price || 0;
                const total = qty * price;
                table += `<tr>
                    <td>${p.name}</td>
                    <td>${p.unit}</td>
                    <td>${p.pack_size}</td>
                    <td>${qty}</td>
                    <td>${price.toFixed(2)}</td>
                    <td>${total.toFixed(2)}</td>
                </tr>`;
            });
            table += '</tbody></table>';
            details.innerHTML += table;
        }
        stockDiv.appendChild(details);
    }
}