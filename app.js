document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('module-container');
    const navBtns = document.querySelectorAll('.nav-btn');

    async function loadModule(moduleName) {
        container.innerHTML = '<p>Loading...</p>';
        switch(moduleName) {
            case 'receive': await renderReceiveProducts(container.id); break;
            case 'sale': await renderRecordSale(container.id); break;
            case 'newTransfer': await renderNewTransfer(container.id); break;
            case 'receiveTransfer': await renderReceiveTransfer(container.id); break;
            case 'stock': await renderCurrentStock(container.id); break;
            case 'cashClose': await renderDailyCashClose(container.id); break;
            case 'weekly': await renderWeeklyReport(container.id); break;
            case 'updatePrices': await renderUpdatePrices(container.id); break;
            default: await renderReceiveProducts(container.id);
        }
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadModule(btn.dataset.module);
        });
    });
    loadModule('receive');
});