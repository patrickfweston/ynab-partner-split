/**
 * YNAB Partner Split - Popup script
 * Shows category for your share + memo + Split button. Splits (name + category per partner) come from options (storage).
 * Transaction is split equally among your category and each partner's reimbursement category.
 */
'use strict';

const YNAB_BASE = 'https://api.ynab.com/v1';

const STORAGE_KEYS = {
  ynabToken: 'ynabToken',
  budgetId: 'budgetId',
  partnerName: 'partnerName',
  partnerCategoryId: 'partnerCategoryId',
  splits: 'splits',
  defaultMemo: 'defaultMemo',
  appendToMemo: 'appendToMemo',
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
  let splits = result[STORAGE_KEYS.splits];
  if (Array.isArray(splits)) {
    splits = splits.map((s) => ({ name: (s && s.name) || '', categoryId: (s && s.categoryId) || '' }));
  } else {
    splits = [];
  }
  if (splits.length === 0 && result[STORAGE_KEYS.partnerCategoryId]) {
    splits = [{ name: result[STORAGE_KEYS.partnerName] || 'Partner', categoryId: result[STORAGE_KEYS.partnerCategoryId] }];
  }
  return {
    ynabToken: result[STORAGE_KEYS.ynabToken] ?? '',
    budgetId: result[STORAGE_KEYS.budgetId] ?? '',
    defaultMemo: result[STORAGE_KEYS.defaultMemo] ?? 'Split with {partner_names}',
    splits,
    appendToMemo: result[STORAGE_KEYS.appendToMemo] !== false,
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

/**
 * @param {string} template
 * @param {{ name: string, categoryId: string }[]} splits
 */
function formatMemo(template, splits) {
  if (!template) return '';
  const partnerNames = Array.isArray(splits) && splits.length > 0
    ? splits.map((s) => s.name).filter(Boolean).join(', ') || ''
    : '';
  const partnerName = Array.isArray(splits) && splits.length > 0 ? (splits[0].name || '') : '';
  return template
    .replace(/\{partner_names\}/gi, partnerNames)
    .replace(/\{partner_name\}/gi, partnerName);
}

/**
 * Apply memo behavior: append to existing or overwrite.
 * @param {string} ourMemo - The split memo from the popup/default.
 * @param {string|null|undefined} existingMemo - The transaction's current memo.
 * @param {boolean} appendToMemo - If true, prepend existing memo + ", " when non-empty.
 * @returns {string}
 */
function applyMemoBehavior(ourMemo, existingMemo, appendToMemo) {
  if (appendToMemo && existingMemo !== null && existingMemo !== undefined && String(existingMemo).trim() !== '') {
    return String(existingMemo).trim() + ', ' + ourMemo;
  }
  return ourMemo;
}

/**
 * Split amount into numParties equal parts (YNAB milliunits). Sum of returned array equals amount.
 * @param {number} amount
 * @param {number} numParties
 * @returns {number[]}
 */
function splitAmount(amount, numParties) {
  if (numParties <= 0) return [];
  if (numParties === 1) return [amount];
  const base = Math.floor(amount / numParties);
  const remainder = amount - base * numParties;
  const amounts = [];
  for (let i = 0; i < numParties; i++) {
    amounts.push(base + (i < remainder ? 1 : 0));
  }
  return amounts;
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

  const validSplits = (settings.splits || []).filter((s) => s.categoryId);
  if (!settings.ynabToken || !settings.budgetId) {
    showStatus('Configure the extension first (click "Configure extension…").', true);
    return;
  }
  if (validSplits.length === 0) {
    showStatus('Add at least one split with a category in the extension options.', true);
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

    const toSplitSingle = transactions.filter((tx) => {
      if (!tx.id || tx.deleted) return false;
      if (tx.flag_color !== flagColor) return false;
      if (tx.subtransactions && tx.subtransactions.length > 0) return false;
      if (tx.amount === 0) return false;
      if (!tx.category_id) return false;
      return true;
    });

    const toSplitAlreadySplit = transactions.filter((tx) => {
      if (!tx.id || tx.deleted) return false;
      if (tx.flag_color !== flagColor) return false;
      const subs = tx.subtransactions;
      if (!subs || subs.length === 0) return false;
      if (tx.amount === 0) return false;
      const allCategorized = subs.every((sub) => sub.category_id);
      if (!allCategorized) return false;
      return true;
    });

    const toSplitCount = toSplitSingle.length + toSplitAlreadySplit.length;
    if (toSplitCount === 0) {
      showStatus(`No transactions with the "${flagColor}" flag found (since ${sinceDate}), or they are already split / uncategorized.`, true);
      return;
    }

    const numParties = validSplits.length + 1;
    const defaultMemoFormatted = formatMemo(settings.defaultMemo, validSplits);
    const ourMemo = els.memo && els.memo.value.trim() ? els.memo.value.trim() : defaultMemoFormatted;
    let successCount = 0;
    const splitIds = [];
    let firstError = null;

    for (const tx of toSplitSingle) {
      try {
        const memo = applyMemoBehavior(ourMemo, tx.memo, settings.appendToMemo);
        const amount = tx.amount;
        const amounts = splitAmount(amount, numParties);
        const subtransactions = [
          { amount: amounts[0], category_id: tx.category_id },
          ...validSplits.map((s, i) => ({ amount: amounts[i + 1], category_id: s.categoryId })),
        ];
        const body = {
          category_id: null,
          memo,
          approved: true,
          flag_color: null,
          subtransactions,
        };
        await updateTransaction(settings.budgetId, tx.id, body, settings.ynabToken);
        successCount++;
        splitIds.push(tx.id);
      } catch (err) {
        firstError = firstError || err;
        break;
      }
    }

    for (const tx of toSplitAlreadySplit) {
      try {
        const memo = applyMemoBehavior(ourMemo, tx.memo, settings.appendToMemo);
        const yourSubs = [];
        const partnerSums = new Array(validSplits.length).fill(0);
        for (const sub of tx.subtransactions) {
          const parts = splitAmount(sub.amount, numParties);
          yourSubs.push({ amount: parts[0], category_id: sub.category_id });
          for (let i = 0; i < validSplits.length; i++) {
            partnerSums[i] += parts[i + 1];
          }
        }
        const partnerSubs = validSplits.map((s, i) => ({
          amount: partnerSums[i],
          category_id: s.categoryId,
        }));
        const subtransactions = [...yourSubs, ...partnerSubs];
        const body = {
          category_id: null,
          memo,
          approved: true,
          flag_color: null,
          subtransactions,
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
  const validSplits = (settings.splits || []).filter((s) => s.categoryId);
  if (validSplits.length === 0) {
    showStatus('Add at least one split with a category in the extension options.', true);
    return;
  }
  if (!userCategoryId) {
    showStatus('Select the category for your share.', true);
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

    const numParties = validSplits.length + 1;
    const defaultMemoFormatted = formatMemo(settings.defaultMemo, validSplits);
    const ourMemo = els.memo.value.trim() || defaultMemoFormatted;
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

        const memo = applyMemoBehavior(ourMemo, transaction.memo, settings.appendToMemo);
        const amount = transaction.amount;
        const amounts = splitAmount(amount, numParties);
        const subtransactions = [
          { amount: amounts[0], category_id: userCategoryId },
          ...validSplits.map((s, i) => ({ amount: amounts[i + 1], category_id: s.categoryId })),
        ];
        const body = {
          category_id: null,
          memo,
          approved: true,
          subtransactions,
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

  const hasValidSplits = (settings.splits || []).some((s) => s.categoryId);
  try {
    const categories = await fetchCategories(settings.budgetId, settings.ynabToken);
    fillCategorySelect(els.userCategory, categories, settings.userCategoryId, '— Select category —');
    els.memo.value = formatMemo(settings.defaultMemo, settings.splits || []);
    setSplitButtonEnabled(hasValidSplits);
    if (!hasValidSplits) {
      showStatus('Add at least one split in Options.', true);
    }
  } catch (e) {
    fillCategorySelect(els.userCategory, [], '', '— Error loading categories —');
    showStatus(e instanceof Error ? e.message : 'Failed to load categories', true);
  }

  if (els.splitFlaggedBtn) els.splitFlaggedBtn.disabled = !hasValidSplits;

  if (els.flagColor) {
    fillFlagSelect(els.flagColor, settings.splitFlagColor || 'purple');
    els.flagColor.addEventListener('change', () => saveSettings({ splitFlagColor: els.flagColor.value }));
  }
  if (els.splitFlaggedBtn) {
    els.splitFlaggedBtn.disabled = !hasValidSplits;
    els.splitFlaggedBtn.addEventListener('click', splitFlaggedTransactions);
  }

  if (els.splitBtn) els.splitBtn.addEventListener('click', splitSelectedTransactions);
}

document.addEventListener('DOMContentLoaded', init);
