/**
 * YNAB Partner Split - Options page
 * Persists token, budget ID, partner name, default memo, and partner reimbursement category.
 */
'use strict';

const YNAB_BASE = 'https://api.ynab.com/v1';

const STORAGE_KEYS = {
  ynabToken: 'ynabToken',
  budgetId: 'budgetId',
  partnerName: 'partnerName',
  defaultMemo: 'defaultMemo',
  partnerCategoryId: 'partnerCategoryId',
  reloadAfterSplit: 'reloadAfterSplit',
  splitFlagColor: 'splitFlagColor',
};

const FLAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

let els = {};

function initElements() {
  els = {
    ynabToken: document.getElementById('ynab-token'),
    budgetId: document.getElementById('budget-id'),
    partnerName: document.getElementById('partner-name'),
    defaultMemo: document.getElementById('default-memo'),
    partnerCategory: document.getElementById('partner-category'),
    defaultFlag: document.getElementById('default-flag'),
    reloadAfterSplit: document.getElementById('reload-after-split'),
    optionsStatus: document.getElementById('options-status'),
    optionsSaved: document.getElementById('options-saved'),
  };
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(Object.values(STORAGE_KEYS));
  return {
    ynabToken: result[STORAGE_KEYS.ynabToken] ?? '',
    budgetId: result[STORAGE_KEYS.budgetId] ?? '',
    partnerName: result[STORAGE_KEYS.partnerName] ?? '',
    defaultMemo: result[STORAGE_KEYS.defaultMemo] ?? 'Split with {partner_name}',
    partnerCategoryId: result[STORAGE_KEYS.partnerCategoryId] ?? '',
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

async function fetchBudgets(token) {
  const url = `${YNAB_BASE}/budgets`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.detail || `Budgets: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const budgets = (data.data?.budgets ?? []).map((b) => ({ id: b.id, name: b.name || b.id }));
  return budgets;
}

function fillBudgetSelect(selectEl, budgets, selectedId = '', placeholder = '— Select budget —') {
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);
  for (const budget of budgets) {
    const opt = document.createElement('option');
    opt.value = budget.id;
    opt.textContent = budget.name;
    if (budget.id === selectedId) opt.selected = true;
    selectEl.appendChild(opt);
  }
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

function showStatus(message, isError = false) {
  els.optionsStatus.textContent = message;
  els.optionsStatus.className = 'status ' + (isError ? 'error' : '');
}

function showSaved(show) {
  els.optionsSaved.classList.toggle('hidden', !show);
  if (show) setTimeout(() => els.optionsSaved.classList.add('hidden'), 2000);
}

async function loadBudgets() {
  const token = els.ynabToken.value.trim();
  const selectedId = els.budgetId.value || (await loadSettings()).budgetId;
  if (!token) {
    fillBudgetSelect(els.budgetId, [], '', '— Set token, then load —');
    return;
  }
  showStatus('Loading budgets…');
  try {
    const budgets = await fetchBudgets(token);
    fillBudgetSelect(els.budgetId, budgets, selectedId, '— Select budget —');
    showStatus('');
  } catch (e) {
    fillBudgetSelect(els.budgetId, [], '', '— Error loading budgets —');
    showStatus(e instanceof Error ? e.message : 'Failed to load budgets', true);
  }
}

async function loadCategories() {
  const token = els.ynabToken.value.trim();
  const budgetId = els.budgetId.value.trim();
  const selectedId = els.partnerCategory.value || (await loadSettings()).partnerCategoryId;
  if (!token || !budgetId) {
    fillCategorySelect(els.partnerCategory, [], '', '— Set token & budget, then load —');
    return;
  }
  showStatus('Loading categories…');
  try {
    const categories = await fetchCategories(budgetId, token);
    fillCategorySelect(els.partnerCategory, categories, selectedId, '— Select partner category —');
    showStatus('');
  } catch (e) {
    fillCategorySelect(els.partnerCategory, [], '', '— Error loading categories —');
    showStatus(e instanceof Error ? e.message : 'Failed to load categories', true);
  }
}

async function init() {
  initElements();
  const settings = await loadSettings();
  if (!els.ynabToken || !els.budgetId || !els.partnerCategory) return;

  els.ynabToken.value = settings.ynabToken;
  els.partnerName.value = settings.partnerName;
  els.defaultMemo.value = settings.defaultMemo;
  if (els.reloadAfterSplit)   els.reloadAfterSplit.checked = settings.reloadAfterSplit !== false;
  if (els.defaultFlag) els.defaultFlag.value = FLAG_COLORS.includes(settings.splitFlagColor) ? settings.splitFlagColor : 'purple';

  els.ynabToken.addEventListener('change', async () => {
    await saveSettings({ ynabToken: els.ynabToken.value });
    showSaved(true);
    loadBudgets();
  });
  els.budgetId.addEventListener('change', async () => {
    await saveSettings({ budgetId: els.budgetId.value });
    showSaved(true);
    loadCategories();
  });
  els.partnerName.addEventListener('change', async () => {
    await saveSettings({ partnerName: els.partnerName.value });
    showSaved(true);
  });
  els.defaultMemo.addEventListener('change', async () => {
    await saveSettings({ defaultMemo: els.defaultMemo.value });
    showSaved(true);
  });
  els.partnerCategory.addEventListener('change', async () => {
    await saveSettings({ partnerCategoryId: els.partnerCategory.value });
    showSaved(true);
  });
  if (els.defaultFlag) {
    els.defaultFlag.value = FLAG_COLORS.includes(settings.splitFlagColor) ? settings.splitFlagColor : 'purple';
    els.defaultFlag.addEventListener('change', async () => {
      await saveSettings({ splitFlagColor: els.defaultFlag.value });
      showSaved(true);
    });
  }
  els.reloadAfterSplit.addEventListener('change', async () => {
    await saveSettings({ reloadAfterSplit: els.reloadAfterSplit.checked });
    showSaved(true);
  });

  if (settings.ynabToken) {
    try {
      const budgets = await fetchBudgets(settings.ynabToken);
      fillBudgetSelect(els.budgetId, budgets, settings.budgetId, '— Select budget —');
    } catch (_) {
      fillBudgetSelect(els.budgetId, [], '', '— Error loading budgets —');
    }
  }
  if (settings.ynabToken && settings.budgetId) {
    try {
      const categories = await fetchCategories(settings.budgetId, settings.ynabToken);
      fillCategorySelect(els.partnerCategory, categories, settings.partnerCategoryId, '— Select partner category —');
    } catch (_) {
      fillCategorySelect(els.partnerCategory, [], '', '— Error loading categories —');
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
