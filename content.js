/**
 * YNAB Partner Split - Content script
 * Injected on https://app.ynab.com/*. Listens for messages from the popup,
 * finds selected transaction rows and returns their transaction IDs.
 *
 * YNAB register (transaction list) uses:
 * - .is-checked on the row when the checkbox is selected
 * - data-row-id on the row for the transaction ID
 * We also support legacy .is-selected + data-entity-id if used elsewhere.
 */
'use strict';

/** Class and style for rows that were split and need a visual refresh in the UI. */
const HIGHLIGHT_CLASS = 'ynab-partner-split-needs-update';

/** Persisted set of transaction IDs that should stay highlighted (survives re-renders/unselect). */
const highlightedSplitIds = new Set();

function ensureHighlightStyle() {
  if (document.getElementById('ynab-partner-split-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'ynab-partner-split-highlight-style';
  style.textContent = `.${HIGHLIGHT_CLASS} { background-color: #fffde7 !important; }`;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Apply the highlight class to any row in the DOM whose ID is in highlightedSplitIds.
 * Called when new IDs are added and when the DOM changes (e.g. rows re-rendered on unselect).
 */
function applyHighlightToRows() {
  if (highlightedSplitIds.size === 0) return;
  ensureHighlightStyle();
  const rows = document.querySelectorAll('.ynab-grid-body-row[data-row-id]');
  for (const row of rows) {
    const id = row.getAttribute('data-row-id');
    if (id && highlightedSplitIds.has(id)) {
      row.classList.add(HIGHLIGHT_CLASS);
    }
  }
  const legacyRows = document.querySelectorAll('.ynab-grid-body-row[data-entity-id]');
  for (const row of legacyRows) {
    const id = row.dataset.entityId;
    if (id && highlightedSplitIds.has(id)) {
      row.classList.add(HIGHLIGHT_CLASS);
    }
  }
}

let highlightDebounceTimer = null;
function scheduleApplyHighlight() {
  if (highlightDebounceTimer) clearTimeout(highlightDebounceTimer);
  highlightDebounceTimer = setTimeout(() => {
    highlightDebounceTimer = null;
    applyHighlightToRows();
  }, 100);
}

/**
 * Add these transaction IDs to the highlighted set and apply (or re-apply) the yellow background.
 * A MutationObserver re-applies the highlight when the DOM changes so it persists after unselect.
 */
function highlightSplitTransactions(transactionIds) {
  if (!transactionIds.length) return;
  for (const id of transactionIds) {
    highlightedSplitIds.add(id);
  }
  applyHighlightToRows();
}

function startHighlightObserver() {
  if (window.__ynabPartnerSplitHighlightObserver) return;
  const observer = new MutationObserver(() => scheduleApplyHighlight());
  observer.observe(document.body, { childList: true, subtree: true });
  window.__ynabPartnerSplitHighlightObserver = observer;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const action = message && typeof message.action === 'string' ? message.action : '';
  if (action === 'getSelectedTransactionIds') {
    const ids = getSelectedTransactionIds();
    sendResponse(ids);
  } else if (action === 'highlightSplitTransactions') {
    const ids = Array.isArray(message.transactionIds) ? message.transactionIds : [];
    highlightSplitTransactions(ids);
    startHighlightObserver();
    sendResponse({ ok: true });
  }
  return true; // keep channel open for async sendResponse
});

/**
 * Query DOM for selected transaction rows and read their IDs.
 * YNAB uses .is-checked + data-row-id on ynab-grid-body-row elements.
 * Returns array of unique transaction IDs (strings).
 */
function getSelectedTransactionIds() {
  const ids = new Set();

  // Primary: rows with .is-checked and data-row-id (current YNAB register)
  const checkedRows = document.querySelectorAll('.ynab-grid-body-row.is-checked[data-row-id]');
  for (const el of checkedRows) {
    const id = el.getAttribute('data-row-id');
    if (id) ids.add(id);
  }

  // Fallback: .is-selected + data-entity-id (legacy or other views)
  const selectedWithEntityId = document.querySelectorAll('.is-selected[data-entity-id]');
  for (const el of selectedWithEntityId) {
    const id = el.dataset.entityId;
    if (id) ids.add(id);
  }
  const selectedAny = document.querySelectorAll('.is-selected');
  for (const el of selectedAny) {
    const withId = el.closest('[data-entity-id]') || el.querySelector('[data-entity-id]');
    if (withId?.dataset?.entityId) ids.add(withId.dataset.entityId);
  }

  return [...ids];
}
