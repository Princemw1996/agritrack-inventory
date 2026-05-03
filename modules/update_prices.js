async function renderUpdatePrices(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Update Selling Prices</h2>
            <div id="priceList"></div>
            <div id="priceMessage" class="message" style="display:none;"></div>
        </div>
    `;
    const products = await getProducts();
    const listDiv = document.getElementById('priceList');
    if (!products.length) {
        listDiv.innerHTML = '<p>No products found.</p>';
        return;
    }
    let html = '<table><thead><tr><th>Product</th><th>Current Price (MWK)</th><th>New Price</th><th></th></tr></thead><tbody>';
    products.forEach(p => {
        html += `<tr>
            <td>${p.name} - ${p.pack_size}</td>
            <td>${(p.current_price || 0).toFixed(2)}</td>
            <td><input type="number" id="price_${p.id}" step="100" value="${p.current_price || 0}"></td>
            <td><button class="update-price-btn" data-id="${p.id}">Update</button></td>
        </tr>`;
    });
    html += '</tbody></table>';
    listDiv.innerHTML = html;
    document.querySelectorAll('.update-price-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const prodId = parseInt(btn.dataset.id);
            const newPrice = parseFloat(document.getElementById(`price_${prodId}`).value);
            if (isNaN(newPrice) || newPrice <= 0) {
                showMessage(containerId, 'Invalid price.', 'error');
                return;
            }
            await supabase.from('products').update({ current_price: newPrice }).eq('id', prodId);
            showMessage(containerId, 'Price updated successfully.', 'success');
            renderUpdatePrices(containerId); // refresh
        });
    });
}