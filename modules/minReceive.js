async function renderMinReceive() {
    const container = document.getElementById('moduleContainer');
    const { data: pending, error } = await sb.from('transfers')
        .select('*, products(name, pack_size, unit)')
        .eq('to_location_id', 2)
        .eq('status', 'pending');
    if (error) {
        container.innerHTML = `<div class="error">${error.message}</div>`;
        return;
    }
    if (!pending || pending.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center;">📭 No pending transfers from Main Warehouse.</p>';
        return;
    }
    let html = '<h2>✅ Receive Transfers from Main Warehouse</h2><div style="overflow-x:auto;">';
    html += '<table style="width:100%; border-collapse:collapse;"><thead><tr><th>Product</th><th>Quantity</th><th>Action</th></tr></thead><tbody>';
    for (const t of pending) {
        html += `<tr>
            <td>${t.products.name} - ${t.products.pack_size} (${t.products.unit})</td>
            <td>${t.quantity}</td>
            <td><button class="confirmReceiveMin" data-id="${t.id}">Confirm Receipt</button></td>
        </tr>`;
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
    document.querySelectorAll('.confirmReceiveMin').forEach(btn => {
        btn.addEventListener('click', async () => {
            const transferId = parseInt(btn.dataset.id);
            const { data: t } = await sb.from('transfers').select('*').eq('id', transferId).single();
            if (!t) return;
            const { data: inv } = await sb.from('inventory')
                .select('id, quantity')
                .eq('location_id', 2)
                .eq('product_id', t.product_id)
                .maybeSingle();
            if (inv) {
                await sb.from('inventory').update({ quantity: inv.quantity + t.quantity, last_updated: new Date().toISOString() }).eq('id', inv.id);
            } else {
                await sb.from('inventory').insert({ location_id: 2, product_id: t.product_id, quantity: t.quantity, last_updated: new Date().toISOString() });
            }
            await sb.from('transfers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', transferId);
            showMessage(`✅ Received ${t.quantity} units. Min Warehouse stock updated.`);
            renderMinReceive();
        });
    });
}