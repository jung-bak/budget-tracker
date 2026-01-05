// State
let transactions = [];
let apiKey = localStorage.getItem('apiKey') || '';
let pendingDeleteId = null;

// DOM Elements
const transactionsBody = document.getElementById('transactionsBody');
const syncBtn = document.getElementById('syncBtn');
const backfillBtn = document.getElementById('backfillBtn');
const statsBar = document.getElementById('statsBar');

// Stats elements
const statTotal = document.getElementById('statTotal');
const statUSD = document.getElementById('statUSD');
const statCRC = document.getElementById('statCRC');

// Modal elements
const editModal = document.getElementById('editModal');
const backfillModal = document.getElementById('backfillModal');
const deleteModal = document.getElementById('deleteModal');
const apiKeyModal = document.getElementById('apiKeyModal');

// Forms
const editForm = document.getElementById('editForm');
const backfillForm = document.getElementById('backfillForm');
const apiKeyForm = document.getElementById('apiKeyForm');

// Toast container
const toastContainer = document.getElementById('toastContainer');

// API Helper
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(endpoint, {
        ...options,
        headers,
    });

    if (response.status === 403) {
        showApiKeyModal();
        throw new Error('Invalid API key');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
    }

    return response.json();
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.25s ease forwards';
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}

// Modal Helpers
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function showApiKeyModal() {
    openModal(apiKeyModal);
}

// Format Helpers
function formatAmount(amount, currency) {
    const value = amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${currency} ${value}`;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getInstitutionClass(institution) {
    const lower = institution.toLowerCase();
    if (lower.includes('bac')) return 'institution-bac';
    if (lower.includes('davi')) return 'institution-davibank';
    return 'institution-default';
}

// Render Functions
function renderTransactions() {
    if (transactions.length === 0) {
        transactionsBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6">No transactions loaded. Click "Sync" to fetch.</td>
            </tr>
        `;
        return;
    }

    // Sort by timestamp descending
    const sorted = [...transactions].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    transactionsBody.innerHTML = sorted.map(txn => `
        <tr data-id="${txn.global_id}">
            <td>${formatDate(txn.timestamp)}</td>
            <td>${escapeHtml(txn.merchant)}</td>
            <td class="amount-cell amount-${txn.currency.toLowerCase()}">${formatAmount(txn.amount, txn.currency)}</td>
            <td><span class="institution-badge ${getInstitutionClass(txn.institution)}">${escapeHtml(txn.institution)}</span></td>
            <td class="card-number">****${escapeHtml(txn.payment_instrument)}</td>
            <td class="action-btns">
                <button class="btn btn-ghost btn-sm" onclick="openEditModal('${txn.global_id}')">Edit</button>
                <button class="btn btn-ghost btn-sm" onclick="openDeleteModal('${txn.global_id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderStats() {
    statTotal.textContent = transactions.length.toString();

    const usdTotal = transactions
        .filter(t => t.currency === 'USD')
        .reduce((sum, t) => sum + t.amount, 0);

    const crcTotal = transactions
        .filter(t => t.currency === 'CRC')
        .reduce((sum, t) => sum + t.amount, 0);

    statUSD.textContent = formatAmount(usdTotal, 'USD');
    statCRC.textContent = formatAmount(crcTotal, 'CRC');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Actions
async function loadTransactions() {
    try {
        transactions = await apiRequest('/transactions');
        renderTransactions();
        renderStats();
    } catch (error) {
        if (error.message !== 'Invalid API key') {
            showToast(error.message, 'error');
        }
    }
}

async function syncEmails() {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span class="btn-icon">&#x21bb;</span> Syncing...';

    try {
        const result = await apiRequest('/sync', { method: 'POST' });
        showToast(`Synced: ${result.processed} new, ${result.skipped} skipped, ${result.errors} errors`,
            result.errors > 0 ? 'error' : 'success');
        await loadTransactions();
    } catch (error) {
        if (error.message !== 'Invalid API key') {
            showToast(error.message, 'error');
        }
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<span class="btn-icon">&#x21bb;</span> Sync';
    }
}

async function backfillEmails(startDate, endDate) {
    try {
        const result = await apiRequest('/backfill', {
            method: 'POST',
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
            }),
        });
        showToast(`Backfill: ${result.processed} new, ${result.skipped} skipped, ${result.errors} errors`,
            result.errors > 0 ? 'error' : 'success');
        await loadTransactions();
    } catch (error) {
        if (error.message !== 'Invalid API key') {
            showToast(error.message, 'error');
        }
    }
}

async function updateTransaction(globalId, data) {
    try {
        await apiRequest(`/transactions/${globalId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        showToast('Transaction updated', 'success');
        await loadTransactions();
        closeModal(editModal);
    } catch (error) {
        if (error.message !== 'Invalid API key') {
            showToast(error.message, 'error');
        }
    }
}

async function deleteTransaction(globalId) {
    try {
        await apiRequest(`/transactions/${globalId}`, {
            method: 'DELETE',
        });
        showToast('Transaction deleted', 'success');
        await loadTransactions();
        closeModal(deleteModal);
    } catch (error) {
        if (error.message !== 'Invalid API key') {
            showToast(error.message, 'error');
        }
    }
}

// Modal Actions
function openEditModal(globalId) {
    const txn = transactions.find(t => t.global_id === globalId);
    if (!txn) return;

    document.getElementById('editGlobalId').value = globalId;
    document.getElementById('editMerchant').value = txn.merchant;
    document.getElementById('editAmount').value = txn.amount;
    document.getElementById('editCurrency').value = txn.currency;
    document.getElementById('editInstitution').value = txn.institution;
    document.getElementById('editPaymentInstrument').value = txn.payment_instrument;
    document.getElementById('editNotes').value = txn.notes || '';

    // Format timestamp for datetime-local input
    const date = new Date(txn.timestamp);
    const formatted = date.toISOString().slice(0, 16);
    document.getElementById('editTimestamp').value = formatted;

    openModal(editModal);
}

function openDeleteModal(globalId) {
    const txn = transactions.find(t => t.global_id === globalId);
    if (!txn) return;

    pendingDeleteId = globalId;
    document.getElementById('deleteInfo').textContent =
        `${txn.merchant} - ${formatAmount(txn.amount, txn.currency)}`;
    openModal(deleteModal);
}

// Event Listeners
syncBtn.addEventListener('click', syncEmails);

backfillBtn.addEventListener('click', () => {
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    document.getElementById('backfillEnd').value = today.toISOString().split('T')[0];
    document.getElementById('backfillStart').value = thirtyDaysAgo.toISOString().split('T')[0];

    openModal(backfillModal);
});

// Edit Modal
document.getElementById('editModalClose').addEventListener('click', () => closeModal(editModal));
document.getElementById('editCancelBtn').addEventListener('click', () => closeModal(editModal));
editModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(editModal));

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const globalId = document.getElementById('editGlobalId').value;

    const data = {
        merchant: document.getElementById('editMerchant').value,
        amount: parseFloat(document.getElementById('editAmount').value),
        currency: document.getElementById('editCurrency').value,
        institution: document.getElementById('editInstitution').value,
        payment_instrument: document.getElementById('editPaymentInstrument').value,
        notes: document.getElementById('editNotes').value,
        timestamp: new Date(document.getElementById('editTimestamp').value).toISOString(),
    };

    await updateTransaction(globalId, data);
});

// Backfill Modal
document.getElementById('backfillModalClose').addEventListener('click', () => closeModal(backfillModal));
document.getElementById('backfillCancelBtn').addEventListener('click', () => closeModal(backfillModal));
backfillModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(backfillModal));

backfillForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const startDate = document.getElementById('backfillStart').value;
    const endDate = document.getElementById('backfillEnd').value;
    closeModal(backfillModal);
    await backfillEmails(startDate, endDate);
});

// Delete Modal
document.getElementById('deleteModalClose').addEventListener('click', () => closeModal(deleteModal));
document.getElementById('deleteCancelBtn').addEventListener('click', () => closeModal(deleteModal));
deleteModal.querySelector('.modal-backdrop').addEventListener('click', () => closeModal(deleteModal));

document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
    if (pendingDeleteId) {
        await deleteTransaction(pendingDeleteId);
        pendingDeleteId = null;
    }
});

// API Key Modal
apiKeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    apiKey = document.getElementById('apiKeyInput').value;
    localStorage.setItem('apiKey', apiKey);
    closeModal(apiKeyModal);
    showToast('API key saved', 'success');
    loadTransactions();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!apiKey) {
        showApiKeyModal();
    } else {
        loadTransactions();
    }
});
