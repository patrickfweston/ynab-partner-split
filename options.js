/**
 * YNAB Partner Split - Options page
 * Persists token, budget ID, splits (name + category per partner), default memo, and behavior options.
 */
'use strict';

const YNAB_BASE = 'https://api.ynab.com/v1';

const STORAGE_KEYS = {
  ynabToken: 'ynabToken',
  budgetId: 'budgetId',
  partnerName: 'partnerName',
  defaultMemo: 'defaultMemo',
  partnerCategoryId: 'partnerCategoryId',
  splits: 'splits',
  reloadAfterSplit: 'reloadAfterSplit',
  splitFlagColor: 'splitFlagColor',
};

const FLAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

let els = {};
/** @type {{ id: string, name: string, groupName?: string }[]} */
let categoriesCache = [];

function initElements() {
  els = {
    ynabToken: document.getElementById('ynab-token'),
    budgetId: document.getElementById('budget-id'),
    defaultMemo: document.getElementById('default-memo'),
    defaultFlag: document.getElementById('default-flag'),
    reloadAfterSplit: document.getElementById('reload-after-split'),
    splitsList: document.getElementById('splits-list'),
    addSplitBtn: document.getElementById('add-split-btn'),
    optionsStatus: document.getElementById('options-status'),
    optionsSaved: document.getElementById('options-saved'),
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

/** In-memory splits array; single source of truth for the UI. */
let splitsData = [];

function getSplitsFromDOM() {
  const rows = els.splitsList.querySelectorAll('.split-row');
  const result = [];
  for (const row of rows) {
    const nameEl = row.querySelector('.split-name');
    const categoryEl = row.querySelector('.split-category');
    if (nameEl && categoryEl) {
      result.push({ name: nameEl.value.trim(), categoryId: categoryEl.value.trim() });
    }
  }
  return result;
}

function renderSplitsList() {
  if (!els.splitsList) return;
  els.splitsList.innerHTML = '';
  const placeholder = categoriesCache.length > 0 ? '— Select category —' : '— Set token & budget, then load —';
  for (let i = 0; i < splitsData.length; i++) {
    const split = splitsData[i];
    const row = document.createElement('div');
    row.className = 'split-row';
    row.dataset.index = String(i);
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'split-name';
    nameInput.placeholder = 'e.g. Partner A';
    nameInput.value = split.name;
    const catLabel = document.createElement('label');
    catLabel.textContent = 'Reimbursement category';
    const catSelect = document.createElement('select');
    catSelect.className = 'split-category';
    fillCategorySelect(catSelect, categoriesCache, split.categoryId, placeholder);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.dataset.index = String(i);
    const nameField = document.createElement('div');
    nameField.className = 'field';
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    const catField = document.createElement('div');
    catField.className = 'field';
    catField.appendChild(catLabel);
    catField.appendChild(catSelect);
    row.appendChild(nameField);
    row.appendChild(catField);
    row.appendChild(removeBtn);
    els.splitsList.appendChild(row);
  }
  els.splitsList.querySelectorAll('.split-name').forEach((el) => {
    el.addEventListener('change', persistSplitsFromDOM);
    el.addEventListener('input', persistSplitsFromDOM);
  });
  els.splitsList.querySelectorAll('.split-category').forEach((el) => {
    el.addEventListener('change', persistSplitsFromDOM);
  });
  els.splitsList.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      if (!Number.isNaN(index) && index >= 0 && index < splitsData.length) {
        splitsData.splice(index, 1);
        saveSettings({ splits: splitsData }).then(() => showSaved(true));
        renderSplitsList();
      }
    });
  });
}

async function persistSplitsFromDOM() {
  splitsData = getSplitsFromDOM();
  await saveSettings({ splits: splitsData });
  showSaved(true);
}

async function loadCategories() {
  const token = els.ynabToken.value.trim();
  const budgetId = els.budgetId.value.trim();
  if (!token || !budgetId) {
    categoriesCache = [];
    renderSplitsList();
    return;
  }
  showStatus('Loading categories…');
  try {
    categoriesCache = await fetchCategories(budgetId, token);
    showStatus('');
    renderSplitsList();
  } catch (e) {
    categoriesCache = [];
    showStatus(e instanceof Error ? e.message : 'Failed to load categories', true);
    renderSplitsList();
  }
}

async function init() {
  initElements();
  const settings = await loadSettings();
  if (!els.ynabToken || !els.budgetId || !els.splitsList || !els.addSplitBtn) return;

  els.ynabToken.value = settings.ynabToken;
  els.defaultMemo.value = settings.defaultMemo;
  if (els.reloadAfterSplit) els.reloadAfterSplit.checked = settings.reloadAfterSplit !== false;
  if (els.defaultFlag) els.defaultFlag.value = FLAG_COLORS.includes(settings.splitFlagColor) ? settings.splitFlagColor : 'purple';

  splitsData = settings.splits.length > 0 ? [...settings.splits] : [];

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
  els.defaultMemo.addEventListener('change', async () => {
    await saveSettings({ defaultMemo: els.defaultMemo.value });
    showSaved(true);
  });
  if (els.defaultFlag) {
    els.defaultFlag.addEventListener('change', async () => {
      await saveSettings({ splitFlagColor: els.defaultFlag.value });
      showSaved(true);
    });
  }
  els.reloadAfterSplit.addEventListener('change', async () => {
    await saveSettings({ reloadAfterSplit: els.reloadAfterSplit.checked });
    showSaved(true);
  });

  els.addSplitBtn.addEventListener('click', () => {
    splitsData.push({ name: '', categoryId: '' });
    saveSettings({ splits: splitsData }).then(() => showSaved(true));
    renderSplitsList();
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
      categoriesCache = await fetchCategories(settings.budgetId, settings.ynabToken);
    } catch (_) {
      categoriesCache = [];
    }
    renderSplitsList();
  } else {
    renderSplitsList();
  }
}

document.addEventListener('DOMContentLoaded', init);
