// modules/expenses.js – with full audit logging
async function renderExpenses() {
    const container = document.getElementById('moduleContainer');
    container.innerHTML = '<div class="loading">Loading expenses...</div>';
    try {
        const [locationsRes, categoriesRes, expensesRes] = await Promise.all([
            sb.from('locations').select('id, name'),
            sb.from('expense_categories').select('*').order('name'),
            sb.from('expenses').select('*, expense_categories(name)').order('expense_date', { ascending: false })
        ]);
        const locations = locationsRes.data || [];
        const allCategories = categoriesRes.data || [];
        const expenses = expensesRes.data || [];
        const mainCategories = allCategories.filter(c => !c.parent_id);
        const subCategories = allCategories.filter(c => c.parent_id);

        container.innerHTML = `
            <h2>💸 Expenses Management</h2>
            <div style="margin-bottom:20px;">
                <button id="addExpenseBtn">➕ Add Expense</button>
                <button id="addCategoryBtn">📂 Add Category</button>
            </div>
            <div class="card">
                <h3>📋 Expense List</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr><th>Date</th><th>Reference</th><th>Category</th><th>Description</th><th>Amount (MWK)</th><th>Actions</th></tr>
                        </thead>
                        <tbody id="expenseTableBody"></tbody>
                    </table>
                </div>
            </div>
        `;

        const tbody = document.getElementById('expenseTableBody');
        tbody.innerHTML = '';
        for (const exp of expenses) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${exp.expense_date}</td>
                <td>${exp.reference_no || '—'}</td>
                <td>${exp.expense_categories?.name || 'Uncategorized'}</td>
                <td>${exp.description || '—'}</td>
                <td>${formatNumber(exp.amount)}</td>
                <td><button class="editExpenseBtn" data-id="${exp.id}">✏️ Edit</button> <button class="deleteExpenseBtn" data-id="${exp.id}">🗑️ Delete</button> ‐
            `;
        }

        // Modal (simplified, same UI as before – keep existing modal code)
        // For brevity, I assume the modal HTML is as before. I'll only include the save logic with audit.
        // But to keep the answer complete, I'll provide the full working modal + audit.

        const modal = document.createElement('div');
        modal.id = 'expenseModal';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.top = '10%';
        modal.style.left = '15%';
        modal.style.width = '70%';
        modal.style.maxHeight = '80%';
        modal.style.overflowY = 'auto';
        modal.style.backgroundColor = 'white';
        modal.style.padding = '20px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        modal.style.zIndex = '1000';
        modal.innerHTML = `
            <h3 id="modalTitle">Add Expense</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div>
                    <div class="form-group"><label>Business Location:</label><select id="expLocation"><option value="">Please Select</option>${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Reference No:</label><input type="text" id="expRef" placeholder="Leave empty to autogenerate"></div>
                    <div class="form-group"><label>Date:</label><input type="date" id="expDate" value="${new Date().toISOString().slice(0,10)}"></div>
                    <div class="form-group"><label>Expense Category:</label><select id="expCategoryMain"><option value="">Please Select</option>${mainCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Sub category:</label><select id="expCategorySub"><option value="">Please Select</option>${subCategories.map(c => `<option value="${c.id}" data-parent="${c.parent_id}">${c.name}</option>`).join('')}</select></div>
                    <div class="form-group"><label>Expense for contact:</label><input type="text" id="expContact" placeholder="Optional"></div>
                </div>
                <div>
                    <div class="form-group"><label>Total amount:</label><input type="number" id="expAmount" step="0.01" placeholder="0.00"></div>
                    <div class="form-group"><label>Is refund?</label><input type="checkbox" id="expIsRefund"></div>
                    <div class="form-group"><label>Is Recurring?</label><input type="checkbox" id="expRecurring"><div id="recurringOptions" style="display:none;"><label>Interval: <select id="recInterval"><option>days</option><option>weeks</option><option>months</option><option>years</option></select></label><label>Repetitions: <input type="number" id="recRepetitions"></label></div></div>
                    <hr><label>Payments (optional)</label>
                    <div><input type="number" id="paymentAmount" step="0.01" placeholder="Amount"><input type="date" id="paymentDate"><select id="paymentMethod"><option>cash</option><option>bank_transfer</option><option>mobile_money</option></select><button id="addPaymentBtn">Add</button></div>
                    <div id="paymentsList"></div>
                    <div>Payment due: <span id="paymentDue">0.00</span></div>
                </div>
            </div>
            <div style="margin-top:20px;"><button id="saveExpenseBtn">Save</button><button id="closeModalBtn">Cancel</button></div>
        `;
        document.body.appendChild(modal);

        // Populate subcategory filter (simple)
        const mainSelect = document.getElementById('expCategoryMain');
        const subSelect = document.getElementById('expCategorySub');
        function filterSubcats() {
            const parent = parseInt(mainSelect.value);
            for (let i = 0; i < subSelect.options.length; i++) {
                const opt = subSelect.options[i];
                if (opt.value === '') continue;
                const parentId = parseInt(opt.getAttribute('data-parent'));
                opt.style.display = (parentId === parent) ? 'block' : 'none';
            }
        }
        mainSelect.addEventListener('change', filterSubcats);
        filterSubcats();

        // Payment logic (unchanged)
        let payments = [];
        const updateDue = () => {
            const total = parseFloat(document.getElementById('expAmount').value) || 0;
            const paid = payments.reduce((s, p) => s + p.amount, 0);
            document.getElementById('paymentDue').innerText = formatNumber(total - paid);
        };
        const renderPayments = () => {
            const div = document.getElementById('paymentsList');
            div.innerHTML = '';
            payments.forEach((p, i) => {
                const row = document.createElement('div');
                row.innerHTML = `${formatNumber(p.amount)} on ${p.date} via ${p.method} <button class="rmPay" data-i="${i}">✖</button>`;
                div.appendChild(row);
            });
            document.querySelectorAll('.rmPay').forEach(btn => {
                btn.onclick = () => {
                    payments.splice(parseInt(btn.dataset.i), 1);
                    renderPayments();
                    updateDue();
                };
            });
        };
        document.getElementById('addPaymentBtn').onclick = () => {
            const amt = parseFloat(document.getElementById('paymentAmount').value);
            if (isNaN(amt) || amt <= 0) return alert('Valid amount');
            const date = document.getElementById('paymentDate').value;
            const method = document.getElementById('paymentMethod').value;
            if (!date) return alert('Select payment date');
            payments.push({ amount: amt, date, method });
            renderPayments();
            document.getElementById('paymentAmount').value = '';
            updateDue();
        };
        document.getElementById('expAmount').addEventListener('input', updateDue);

        let currentId = null;
        const openModal = async (exp = null) => {
            if (exp) {
                currentId = exp.id;
                document.getElementById('modalTitle').innerText = 'Edit Expense';
                document.getElementById('expLocation').value = exp.location_id || '';
                document.getElementById('expRef').value = exp.reference_no || '';
                document.getElementById('expDate').value = exp.expense_date;
                if (exp.category_id) {
                    const { data: cat } = await sb.from('expense_categories').select('id, parent_id').eq('id', exp.category_id).single();
                    if (cat) {
                        if (cat.parent_id) {
                            mainSelect.value = cat.parent_id;
                            filterSubcats();
                            subSelect.value = cat.id;
                        } else {
                            mainSelect.value = cat.id;
                            filterSubcats();
                            subSelect.value = '';
                        }
                    }
                }
                document.getElementById('expContact').value = exp.description || '';
                document.getElementById('expAmount').value = exp.amount;
                document.getElementById('expIsRefund').checked = exp.is_refund || false;
                const recCheck = document.getElementById('expRecurring');
                recCheck.checked = exp.is_recurring || false;
                document.getElementById('recurringOptions').style.display = recCheck.checked ? 'block' : 'none';
                if (exp.is_recurring) {
                    document.getElementById('recInterval').value = exp.recurring_interval || 'days';
                    document.getElementById('recRepetitions').value = exp.recurring_repetitions || '';
                }
                const { data: payData } = await sb.from('expense_payments').select('*').eq('expense_id', exp.id);
                payments = payData.map(p => ({ amount: p.amount, date: p.payment_date, method: p.payment_method }));
                renderPayments();
                updateDue();
            } else {
                currentId = null;
                document.getElementById('modalTitle').innerText = 'Add Expense';
                document.getElementById('expLocation').value = '';
                document.getElementById('expRef').value = '';
                document.getElementById('expDate').value = new Date().toISOString().slice(0,10);
                mainSelect.value = '';
                filterSubcats();
                subSelect.value = '';
                document.getElementById('expContact').value = '';
                document.getElementById('expAmount').value = '';
                document.getElementById('expIsRefund').checked = false;
                const recCheck = document.getElementById('expRecurring');
                recCheck.checked = false;
                document.getElementById('recurringOptions').style.display = 'none';
                payments = [];
                renderPayments();
                updateDue();
            }
            modal.style.display = 'block';
        };
        document.getElementById('addExpenseBtn').onclick = () => openModal();
        document.getElementById('closeModalBtn').onclick = () => modal.style.display = 'none';

        // Save expense with audit logging
        document.getElementById('saveExpenseBtn').onclick = async () => {
            const locId = document.getElementById('expLocation').value ? parseInt(document.getElementById('expLocation').value) : null;
            const ref = document.getElementById('expRef').value.trim() || null;
            const expDate = document.getElementById('expDate').value;
            const catId = parseInt(document.getElementById('expCategorySub').value) || parseInt(document.getElementById('expCategoryMain').value) || null;
            const contact = document.getElementById('expContact').value.trim() || null;
            const amount = parseFloat(document.getElementById('expAmount').value);
            const isRefund = document.getElementById('expIsRefund').checked;
            const recCheck = document.getElementById('expRecurring');
            const isRecurring = recCheck.checked;
            const recInt = isRecurring ? document.getElementById('recInterval').value : null;
            const recRep = isRecurring && document.getElementById('recRepetitions').value ? parseInt(document.getElementById('recRepetitions').value) : null;
            if (!expDate || !catId || isNaN(amount) || amount <= 0) {
                alert('Date, Category, and positive amount required.');
                return;
            }
            try {
                let expenseId = currentId;
                if (currentId) {
                    await sb.from('expenses').update({
                        location_id: locId, reference_no: ref, expense_date: expDate,
                        category_id: catId, amount, description: contact,
                        is_refund: isRefund, is_recurring: isRecurring,
                        recurring_interval: recInt, recurring_repetitions: recRep,
                        updated_at: new Date().toISOString()
                    }).eq('id', currentId);
                    await logAction('expense_update', 'expenses', currentId,
                        `Updated expense ID ${currentId}: Amount ${amount}, Category ${catId}, Description ${contact}, Refund ${isRefund}, Recurring ${isRecurring}`);
                    await sb.from('expense_payments').delete().eq('expense_id', currentId);
                } else {
                    const { data: newExp, error } = await sb.from('expenses').insert({
                        location_id: locId, reference_no: ref, expense_date: expDate,
                        category_id: catId, amount, description: contact,
                        is_refund: isRefund, is_recurring: isRecurring,
                        recurring_interval: recInt, recurring_repetitions: recRep
                    }).select().single();
                    if (error) throw error;
                    expenseId = newExp.id;
                    await logAction('expense_create', 'expenses', expenseId,
                        `Created expense: Amount ${amount}, Category ${catId}, Description ${contact}, Refund ${isRefund}, Recurring ${isRecurring}`);
                }
                // Insert payments
                for (const pay of payments) {
                    const { data: paymentRec, error: payErr } = await sb.from('expense_payments').insert({
                        expense_id: expenseId, amount: pay.amount,
                        payment_date: pay.date, payment_method: pay.method
                    }).select().single();
                    if (payErr) throw payErr;
                    await logAction('expense_payment', 'expense_payments', paymentRec.id,
                        `Added payment of ${pay.amount} on ${pay.date} via ${pay.method} to expense ID ${expenseId}`);
                }
                alert('Expense saved!');
                modal.style.display = 'none';
                renderExpenses();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        };

        // Edit/Delete from list
        document.querySelectorAll('.editExpenseBtn').forEach(btn => {
            btn.onclick = async () => {
                const id = parseInt(btn.dataset.id);
                const { data: exp } = await sb.from('expenses').select('*').eq('id', id).single();
                openModal(exp);
            };
        });
        document.querySelectorAll('.deleteExpenseBtn').forEach(btn => {
            btn.onclick = async () => {
                const id = parseInt(btn.dataset.id);
                if (confirm('Delete this expense permanently?')) {
                    await sb.from('expense_payments').delete().eq('expense_id', id);
                    await sb.from('expenses').delete().eq('id', id);
                    await logAction('expense_delete', 'expenses', id, `Deleted expense ID ${id}`);
                    renderExpenses();
                }
            };
        });

        // Add Category Modal (unchanged, but can log category creation if desired)
        const catModal = document.createElement('div');
        catModal.id = 'categoryModal';
        catModal.style.display = 'none';
        catModal.style.position = 'fixed';
        catModal.style.top = '30%';
        catModal.style.left = '35%';
        catModal.style.width = '30%';
        catModal.style.background = 'white';
        catModal.style.padding = '20px';
        catModal.style.borderRadius = '12px';
        catModal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        catModal.style.zIndex = '1001';
        catModal.innerHTML = `
            <h3>Add Category</h3>
            <div><label>Name:</label><input type="text" id="catName"></div>
            <div><label>Parent:</label><select id="parentCat"><option value="">None</option>${mainCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
            <button id="saveCatBtn">Save</button>
            <button id="closeCatBtn">Cancel</button>
        `;
        document.body.appendChild(catModal);
        document.getElementById('addCategoryBtn').onclick = () => catModal.style.display = 'block';
        document.getElementById('closeCatBtn').onclick = () => catModal.style.display = 'none';
        document.getElementById('saveCatBtn').onclick = async () => {
            const name = document.getElementById('catName').value.trim();
            const parent = document.getElementById('parentCat').value;
            if (!name) return alert('Name required');
            const { data: newCat, error } = await sb.from('expense_categories').insert({ name, parent_id: parent ? parseInt(parent) : null }).select().single();
            if (error) { alert('Error: ' + error.message); return; }
            await logAction('category_create', 'expense_categories', newCat.id, `Created category ${name} with parent ${parent || 'none'}`);
            alert('Category added');
            catModal.style.display = 'none';
            renderExpenses();
        };
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}