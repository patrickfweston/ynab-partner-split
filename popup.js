/**
 * YNAB Partner Split - Popup script
 * Shows category for your half + memo + Split button. Partner reimbursement category comes from options (storage).
 */
'use strict';

const YNAB_BASE = 'https://api.ynab.com/v1';

const STORAGE_KEYS = {
  ynabToken: 'ynabToken',
  budgetId: 'budgetId',
  partnerName: 'partnerName',
  partnerCategoryId: 'partnerCategoryId',
  defaultMemo: 'defaultMemo',
  userCategoryId: 'userCategoryId',
  reloadAfterSplit: 'reloadAfterSplit',
  splitFlagColor: 'splitFlagColor',
};

/** YNAB flag colors (API values). Flag #6 = purple. */
const FLAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

let els = {};

function initElements() {
  els = {
    userCategory: document.getElementById('user-category'),
    memo: document.getElementById('memo'),
    splitBtn: document.getElementById('split-btn'),
    flagColor: document.getElementById('flag-color'),
    splitFlaggedBtn: document.getElementById('split-flagged-btn'),
    status: document.getElementById('status'),
    loading: document.getElementById('loading'),
    openOptions: document.getElementById('open-options'),
  };
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(Object.values(STORAGE_KEYS));
  return {
    ynabToken: result[STORAGE_KEYS.ynabToken] ?? '',
    budgetId: result[STORAGE_KEYS.budgetId] ?? '',
    partnerName: result[STORAGE_KEYS.partnerName] ?? '',
    partnerCategoryId: result[STORAGE_KEYS.partnerCategoryId] ?? '',
    defaultMemo: result[STORAGE_KEYS.defaultMemo] ?? 'Split with {partner_name}',
    userCategoryId: result[STORAGE_KEYS.userCategoryId] ?? '',
    reloadAfterSplit: result[STORAGE_KEYS.reloadAfterSplit] !== false,
    splitFlagColor: result[STORAGE_KEYS.splitFlagColor] ?? 'purple',
  };
}

async function saveSettings(settings) {
  const toSet = {};
  for (const [key, value] of Object.entries(settings)) {
    if (Object.prototype.hasOwnProperty.call(STORAGE_KEYS, key)) toSet[STORAGE_KEYS[key]] = value;
  }
  await chrome.storage.sync.set(toSet);
}

async function fetchCategories(budgetId, token) {
  const url = `${YNAB_BASE}/budgets/${encodeURIComponent(budgetId)}/categories`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.detail || `Categories: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const groups = data.data?.category_groups ?? [];
  const categories = [];
  for (const group of groups) {
    for (const cat of group.categories ?? []) {
      if (cat.id && cat.name !== undefined && cat.name !== null) {
        categories.push({ id: cat.id, name: cat.name, groupName: group.name });
      }
    }
  }
  return categories;
}

async function fetchTransaction(budgetId, transactionId, token) {
  const url = `${YNAB_BASE}/budgets/${encodeURIComponent(budgetId)}/transactions/${encodeURIComponent(transactionId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.detail || `Transaction: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.data?.transaction ?? null;
}

async function updateTransaction(budgetId, transactionId, body, token) {
  const url = `${YNAB_BASE}/budgets/${encodeURIComponent(budgetId)}/transactions`;
  const payload = {
    transactions: [{ id: transactionId, ...body }],
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.detail || `Update: ${res.status} ${res.statusText}`);
  }
}

/**
 * Fetch transactions since a date (YYYY-MM-DD). Returns flat array of transaction objects.
 */
async function fetchTransactionsSince(budgetId, sinceDate, token) {
  const url = `${YNAB_BASE}/budgets/${encodeURIComponent(budgetId)}/transactions?since_date=${encodeURIComponent(sinceDate)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.detail || `Transactions: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const raw = data.data?.transactions ?? [];
  return Array.isArray(raw) ? raw : [];
}

function showStatus(message, isError = false) {
  if (els.status) {
    els.status.textContent = message;
    els.status.className = 'status ' + (isError ? 'error' : '');
  }
}

function showLoading(show) {
  if (els.loading) els.loading.classList.toggle('hidden', !show);
}

function setSplitButtonEnabled(enabled) {
  if (els.splitBtn) els.splitBtn.disabled = !enabled;
}

function fillFlagSelect(selectEl, selectedValue = 'purple') {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  for (const color of FLAG_COLORS) {
    const opt = document.createElement('option');
    opt.value = color;
    opt.textContent = color.charAt(0).toUpperCase() + color.slice(1);
    if (color === selectedValue) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function fillCategorySelect(selectEl, categories, selectedId = '', placeholder = '— Select category —') {
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.groupName ? `${cat.name} (${cat.groupName})` : cat.name;
    if (cat.id === selectedId) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

async function getSelectedTransactionIds() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: 'No active tab' };
  if (!tab.url || !tab.url.startsWith('https://app.ynab.com/')) {
    return { ok: false, error: 'Open YNAB (app.ynab.com) and select transactions' };
  }
  try {
    const ids = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedTransactionIds' });
    return { ok: true, ids: ids ?? [], tabId: tab.id };
  } catch (e) {
    return { ok: false, error: 'Could not read selection. Reload the YNAB page and try again.' };
  }
}

function formatMemo(template, partnerName) {
  return (template || '').replace(/\{partner_name\}/gi, partnerName || '');
}

function splitAmount(amount) {
  const userHalf = Math.floor(amount / 2);
  const partnerHalf = amount - userHalf;
  return { userHalf, partnerHalf };
}

/** First day of current month in YYYY-MM-DD for fetching transactions. */
function getSinceDateFirstOfMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

async function splitFlaggedTransactions() {
  initElements();
  const settings = await loadSettings();
  const flagColor = els.flagColor ? els.flagColor.value.trim() : (settings.splitFlagColor || 'purple');

  if (!settings.ynabToken || !settings.budgetId) {
    showStatus('Configure the extension first (click "Configure extension…").', true);
    return;
  }
  if (!settings.partnerCategoryId) {
    showStatus('Set "Partner reimbursement category" in the extension options.', true);
    return;
  }
  if (!flagColor || !FLAG_COLORS.includes(flagColor)) {
    showStatus('Select a flag to split.', true);
    return;
  }

  showStatus('');
  showLoading(true);
  if (els.splitFlaggedBtn) els.splitFlaggedBtn.disabled = true;
  if (els.splitBtn) els.splitBtn.disabled = true;

  try {
    const sinceDate = getSinceDateFirstOfMonth();
    const transactions = await fetchTransactionsSince(settings.budgetId, sinceDate, settings.ynabToken);

    const toSplit = transactions.filter((tx) => {
      if (!tx.id || tx.deleted) return false;
      if (tx.flag_color !== flagColor) return false;
      if (tx.subtransactions && tx.subtransactions.length > 0) return false;
      if (tx.amount === 0) return false;
      if (!tx.category_id) return false;
      return true;
    });

    if (toSplit.length === 0) {
      showStatus(`No transactions with the "${flagColor}" flag found (since ${sinceDate}), or they are already split / uncategorized.`, true);
      return;
    }

    const defaultMemoFormatted = formatMemo(settings.defaultMemo, settings.partnerName);
    const memo = els.memo && els.memo.value.trim() ? els.memo.value.trim() : defaultMemoFormatted;
    let successCount = 0;
    const splitIds = [];
    let firstError = null;

    for (const tx of toSplit) {
      try {
        const amount = tx.amount;
        const { userHalf, partnerHalf } = splitAmount(amount);
        const body = {
          category_id: null,
          memo,
          approved: true,
          flag_color: null,
          subtransactions: [
            { amount: userHalf, category_id: tx.category_id },
            { amount: partnerHalf, category_id: settings.partnerCategoryId },
          ],
        };
        await updateTransaction(settings.budgetId, tx.id, body, settings.ynabToken);
        successCount++;
        splitIds.push(tx.id);
      } catch (err) {
        firstError = firstError || err;
        break;
      }
    }

    if (firstError && successCount === 0) {
      showStatus(firstError.message || 'An error occurred.', true);
    } else if (firstError) {
      showStatus(`Split ${successCount} transaction(s). Then: ${firstError.message}`, true);
    } else {
      showStatus(`Successfully split ${successCount} flagged transaction(s). Flag removed.`);
    }

    if (successCount > 0) {
      saveSettings({ splitFlagColor: flagColor });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.url && tab.url.startsWith('https://app.ynab.com/')) {
        if (settings.reloadAfterSplit) {
          chrome.tabs.reload(tab.id);
        } else {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'highlightSplitTransactions', transactionIds: splitIds });
          } catch (_) {
            // Tab or content script may be unavailable
          }
        }
      }
    }
  } finally {
    showLoading(false);
    if (els.splitFlaggedBtn) els.splitFlaggedBtn.disabled = false;
    if (els.splitBtn) els.splitBtn.disabled = false;
  }
}

async function splitSelectedTransactions() {
  initElements();
  const settings = await loadSettings();
  const userCategoryId = els.userCategory.value.trim();

  if (!settings.ynabToken || !settings.budgetId) {
    showStatus('Configure the extension first (click “Configure extension…”).', true);
    return;
  }
  if (!settings.partnerCategoryId) {
    showStatus('Set "Partner reimbursement category" in the extension options.', true);
    return;
  }
  if (!userCategoryId) {
    showStatus('Select the category for your half.', true);
    return;
  }

  showStatus('');
  showLoading(true);
  setSplitButtonEnabled(false);

  try {
    const result = await getSelectedTransactionIds();
    if (!result.ok) {
      showStatus(result.error, true);
      return;
    }
    const ids = result.ids.filter(Boolean);
    if (ids.length === 0) {
      showStatus('No transactions selected. Select rows in YNAB first.', true);
      return;
    }

    const defaultMemoFormatted = formatMemo(settings.defaultMemo, settings.partnerName);
    const memo = els.memo.value.trim() || defaultMemoFormatted;
    let successCount = 0;
    const splitIds = [];
    let firstError = null;

    for (const transactionId of ids) {
      try {
        const transaction = await fetchTransaction(settings.budgetId, transactionId, settings.ynabToken);
        if (!transaction) {
          firstError = firstError || new Error(`Transaction ${transactionId} not found`);
          continue;
        }
        if (transaction.subtransactions?.length > 0) continue;
        if (transaction.amount === 0) continue;

        const amount = transaction.amount;
        const { userHalf, partnerHalf } = splitAmount(amount);

        const body = {
          category_id: null,
          memo,
          approved: true,
          subtransactions: [
            { amount: userHalf, category_id: userCategoryId },
            { amount: partnerHalf, category_id: settings.partnerCategoryId },
          ],
        };
        await updateTransaction(settings.budgetId, transactionId, body, settings.ynabToken);
        successCount++;
        splitIds.push(transactionId);
      } catch (err) {
        firstError = firstError || err;
        break;
      }
    }

    if (firstError && successCount === 0) {
      showStatus(firstError.message || 'An error occurred.', true);
    } else if (firstError) {
      showStatus(`Split ${successCount} transaction(s). Then: ${firstError.message}`, true);
    } else {
      showStatus(`Successfully split ${successCount} transaction(s).`);
    }

    if (successCount > 0 && result.tabId) {
      if (settings.reloadAfterSplit) {
        chrome.tabs.reload(result.tabId);
      } else {
        try {
          await chrome.tabs.sendMessage(result.tabId, { action: 'highlightSplitTransactions', transactionIds: splitIds });
        } catch (_) {
          // Tab or content script may be unavailable
        }
      }
    }
  } finally {
    showLoading(false);
    setSplitButtonEnabled(true);
  }
}

async function init() {
  initElements();
  if (!els.userCategory || !els.splitBtn || !els.status) return;

  if (els.openOptions) {
    els.openOptions.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  const settings = await loadSettings();

  els.userCategory.addEventListener('change', () => {
    saveSettings({ userCategoryId: els.userCategory.value });
  });

  if (!settings.ynabToken || !settings.budgetId) {
    fillCategorySelect(els.userCategory, [], '', '— Configure extension first —');
    fillFlagSelect(els.flagColor, settings.splitFlagColor || 'purple');
    showStatus('Open Options to set your token and budget.', true);
    return;
  }

  try {
    const categories = await fetchCategories(settings.budgetId, settings.ynabToken);
    fillCategorySelect(els.userCategory, categories, settings.userCategoryId, '— Select category —');
    els.memo.value = formatMemo(settings.defaultMemo, settings.partnerName);
    setSplitButtonEnabled(!!settings.partnerCategoryId);
    if (!settings.partnerCategoryId) {
      showStatus('Set "Partner reimbursement category" in Options.', true);
    }
  } catch (e) {
    fillCategorySelect(els.userCategory, [], '', '— Error loading categories —');
    showStatus(e instanceof Error ? e.message : 'Failed to load categories', true);
  }

  if (els.splitFlaggedBtn) els.splitFlaggedBtn.disabled = !settings.partnerCategoryId;

  if (els.flagColor) {
    fillFlagSelect(els.flagColor, settings.splitFlagColor || 'purple');
    els.flagColor.addEventListener('change', () => saveSettings({ splitFlagColor: els.flagColor.value }));
  }
  if (els.splitFlaggedBtn) {
    els.splitFlaggedBtn.disabled = !settings.partnerCategoryId;
    els.splitFlaggedBtn.addEventListener('click', splitFlaggedTransactions);
  }

  if (els.splitBtn) els.splitBtn.addEventListener('click', splitSelectedTransactions);
}

document.addEventListener('DOMContentLoaded', init);
