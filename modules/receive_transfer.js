async function renderReceiveTransfer(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Complete Transfer Receipt</h2>
            <div id="pendingList"></div>
            <div id="receiveTransferMessage" class="message" style="display:none;"></div>
        </div>
    `;
    async function loadPending() {
        const { data: pending, error } = await supabase
            .from('transfers')
            .select('*, from_location_id(name), to_location_id(name), products(name, pack_size)')
            .eq('status', 'pending');
        if (error) {
            showMessage(containerId, error.message, 'error');
            return;
        }
        const listDiv = document.getElementById('pendingList');
        if (!pending.length) {
            listDiv.innerHTML = '<p>No pending transfers.</p>';
            return;
        }
        let html = '<table><thead><tr><th>Product</th><th>From</th><th>To</th><th>Quantity</th><th></th></tr></thead><tbody>';
        pending.forEach(t => {
            html += `<tr>
                <td>${t.products.name} - ${t.products.pack_size}</td>
                <td>${t.from_location_id.name}</td>
                <td>${t.to_location_id.name}</td>
                <td>${t.quantity}</td>
                <td><button class="complete-transfer" data-id="${t.id}">Confirm Receipt</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        listDiv.innerHTML = html;
        document.querySelectorAll('.complete-transfer').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const transferId = parseInt(btn.dataset.id);
                try {
                    // Get transfer details
                    const { data: tData } = await supabase.from('transfers').select('*').eq('id', transferId).single();
                    if (!tData) throw new Error('Transfer not found');
                    // Add stock to destination
                    const { data: invDest } = await supabase.from('inventory').select('id, quantity').eq('location_id', tData.to_location_id).eq('product_id', tData.product_id);
                    if (invDest && invDest.length) {
                        const newQty = invDest[0].quantity + tData.quantity;
                        await supabase.from('inventory').update({ quantity: newQty }).eq('id', invDest[0].id);
                    } else {
                        await supabase.from('inventory').insert({ location_id: tData.to_location_id, product_id: tData.product_id, quantity: tData.quantity });
                    }
                    // Mark transfer as completed
                    await supabase.from('transfers').update({ status: 'completed', completed_at: new Date() }).eq('id', transferId);
                    showMessage(containerId, 'Transfer completed and stock added.', 'success');
                    loadPending(); // refresh list
                } catch (err) {
                    showMessage(containerId, err.message, 'error');
                }
            });
        });
    }
    loadPending();
}