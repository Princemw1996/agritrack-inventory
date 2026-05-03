async function renderRecordSale(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Record Sale</h2>
            <div id="saleForm"></div>
            <div id="saleMessage" class="message" style="display:none;"></div>
        </div>
    `;
    const locations = await getLocations();
    const products = await getProducts();
    if (!products.length) {
        showMessage(containerId, 'No products. Receive stock first.', 'error');
        return;
    }
    const formDiv = document.getElementById('saleForm');
    formDiv.innerHTML = `
        <label>Location:</label>
        <select id="saleLocation">${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select><br/><br/>
        <label>Product:</label>
        <select id="saleProduct"></select><br/><br/>
        <label>Quantity:</label>
        <input type="number" id="saleQty" step="0.5" min="0"><br/><br/>
        <label>Unit Selling Price (MWK):</label>
        <input type="number" id="salePrice" step="100" min="0"><br/><br/>
        <label>Payment Method:</label>
        <select id="saleMethod"><option>cash</option><option>mobile_money</option><option>credit</option></select><br/><br/>
        <button id="saveSaleBtn">Save Sale</button>
    `;
    const productSelect = document.getElementById('saleProduct');
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} - ${p.pack_size} (${p.unit})`;
        productSelect.appendChild(opt);
    });
    // When product changes, set default price from current_price
    productSelect.addEventListener('change', () => {
        const pid = parseInt(productSelect.value);
        const prod = products.find(p => p.id === pid);
        if (prod && prod.current_price) {
            document.getElementById('salePrice').value = prod.current_price;
        }
    });
    document.getElementById('saveSaleBtn').addEventListener('click', async () => {
        const locId = parseInt(document.getElementById('saleLocation').value);
        const prodId = parseInt(productSelect.value);
        const qty = parseFloat(document.getElementById('saleQty').value);
        let price = parseFloat(document.getElementById('salePrice').value);
        const method = document.getElementById('saleMethod').value;
        if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
            showMessage(containerId, 'Quantity and price must be positive.', 'error');
            return;
        }
        const revenue = qty * price;
        try {
            // Insert sale
            await supabase.from('daily_sales').insert({
                location_id: locId, product_id: prodId, sale_date: new Date().toISOString().split('T')[0],
                quantity_sold: qty, unit_price: price, revenue: revenue, payment_method: method
            });
            // Reduce inventory
            const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('location_id', locId).eq('product_id', prodId);
            if (!inv || inv.length === 0) throw new Error('No stock at this location');
            const newQty = inv[0].quantity - qty;
            if (newQty < 0) throw new Error('Insufficient stock');
            await supabase.from('inventory').update({ quantity: newQty, last_updated: new Date() }).eq('id', inv[0].id);
            showMessage(containerId, `Sale recorded. New stock: ${newQty}`, 'success');
            document.getElementById('saleQty').value = '';
        } catch (err) {
            showMessage(containerId, err.message, 'error');
        }
    });
}