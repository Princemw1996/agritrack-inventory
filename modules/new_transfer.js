async function renderNewTransfer(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Initiate Stock Transfer</h2>
            <div id="transferForm"></div>
            <div id="transferMessage" class="message" style="display:none;"></div>
        </div>
    `;
    const locations = await getLocations();
    const products = await getProducts();
    if (!products.length) {
        showMessage(containerId, 'No products.', 'error');
        return;
    }
    const formDiv = document.getElementById('transferForm');
    formDiv.innerHTML = `
        <label>From Location:</label>
        <select id="fromLoc"></select><br/><br/>
        <label>To Location:</label>
        <select id="toLoc"></select><br/><br/>
        <label>Product:</label>
        <select id="transferProduct"></select><br/><br/>
        <label>Quantity:</label>
        <input type="number" id="transferQty" step="0.5" min="0"><br/><br/>
        <label>Notes:</label>
        <textarea id="transferNotes" rows="2"></textarea><br/><br/>
        <button id="createTransferBtn">Create Transfer</button>
    `;
    const fromSelect = document.getElementById('fromLoc');
    const toSelect = document.getElementById('toLoc');
    locations.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.id;
        opt.textContent = loc.name;
        fromSelect.appendChild(opt);
        const opt2 = document.createElement('option');
        opt2.value = loc.id;
        opt2.textContent = loc.name;
        toSelect.appendChild(opt2);
    });
    const prodSelect = document.getElementById('transferProduct');
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} - ${p.pack_size}`;
        prodSelect.appendChild(opt);
    });
    document.getElementById('createTransferBtn').addEventListener('click', async () => {
        const fromId = parseInt(fromSelect.value);
        const toId = parseInt(toSelect.value);
        const prodId = parseInt(prodSelect.value);
        const qty = parseFloat(document.getElementById('transferQty').value);
        const notes = document.getElementById('transferNotes').value;
        if (fromId === toId) {
            showMessage(containerId, 'From and To locations must be different.', 'error');
            return;
        }
        if (isNaN(qty) || qty <= 0) {
            showMessage(containerId, 'Quantity must be positive.', 'error');
            return;
        }
        try {
            // Check stock at source
            const { data: inv } = await supabase.from('inventory').select('id, quantity').eq('location_id', fromId).eq('product_id', prodId);
            if (!inv || inv.length === 0 || inv[0].quantity < qty) throw new Error('Insufficient stock at source');
            // Create transfer record
            await supabase.from('transfers').insert({
                from_location_id: fromId, to_location_id: toId, product_id: prodId,
                quantity: qty, status: 'pending', notes: notes, initiated_at: new Date()
            });
            // Reduce stock from source
            const newQty = inv[0].quantity - qty;
            await supabase.from('inventory').update({ quantity: newQty, last_updated: new Date() }).eq('id', inv[0].id);
            showMessage(containerId, `Transfer created. Stock reduced at ${fromSelect.options[fromSelect.selectedIndex].text}.`, 'success');
            document.getElementById('transferQty').value = '';
        } catch (err) {
            showMessage(containerId, err.message, 'error');
        }
    });
}