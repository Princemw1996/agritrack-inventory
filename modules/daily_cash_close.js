async function renderDailyCashClose(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="card">
            <h2>Daily Cash Reconciliation</h2>
            <div id="cashForm"></div>
            <div id="cashMessage" class="message" style="display:none;"></div>
        </div>
    `;
    const locations = await getLocations();
    const formDiv = document.getElementById('cashForm');
    formDiv.innerHTML = `
        <label>Location:</label>
        <select id="cashLocation">${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}</select><br/><br/>
        <label>Date:</label>
        <input type="date" id="cashDate" value="${new Date().toISOString().split('T')[0]}"><br/><br/>
        <label>Opening Cash Balance (MWK):</label>
        <input type="number" id="openingBalance" step="100" value="0"><br/><br/>
        <label>Expenses / Cash Out (MWK):</label>
        <input type="number" id="expenses" step="100" value="0"><br/><br/>
        <label>Actual Closing Cash Balance (MWK):</label>
        <input type="number" id="closingBalance" step="100"><br/><br/>
        <button id="calculateSaveBtn">Calculate and Save</button>
    `;
    document.getElementById('calculateSaveBtn').addEventListener('click', async () => {
        const locId = parseInt(document.getElementById('cashLocation').value);
        const cashDate = document.getElementById('cashDate').value;
        const opening = parseFloat(document.getElementById('openingBalance').value);
        const expenses = parseFloat(document.getElementById('expenses').value);
        const closing = parseFloat(document.getElementById('closingBalance').value);
        // Get total sales revenue for that location and date
        const { data: sales } = await supabase
            .from('daily_sales')
            .select('revenue')
            .eq('location_id', locId)
            .eq('sale_date', cashDate);
        const totalRevenue = sales ? sales.reduce((sum, s) => sum + s.revenue, 0) : 0;
        const expected = opening + totalRevenue - expenses;
        const diff = closing - expected;
        const message = `Sales revenue: MWK ${totalRevenue.toFixed(2)}\nExpected closing: MWK ${expected.toFixed(2)}\nDifference: ${diff.toFixed(2)}`;
        if (confirm(`${message}\n\nSave this record?`)) {
            await supabase.from('daily_cash').upsert({
                location_id: locId, cash_date: cashDate, opening_balance: opening,
                closing_balance: closing, expected_balance: expected, difference: diff,
                expenses: expenses, notes: ''
            }, { onConflict: 'location_id,cash_date' });
            showMessage(containerId, 'Cash record saved.', 'success');
        }
    });
}