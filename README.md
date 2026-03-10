# YNAB Partner Split

A Chrome extension (Manifest V3) that integrates with the [YNAB API](https://api.ynab.com) to split selected transactions 50/50 between your category and a configurable partner reimbursement category.

**Example:** A $40 grocery purchase becomes:
- $20 → Groceries (your half)
- $20 → Partner reimbursement category (e.g. "Nick Split Spending")

The extension runs on [app.ynab.com](https://app.ynab.com). You select one or more transactions in the YNAB UI, then choose the **Partner reimbursement category** in the popup and click **Split Selected Transactions**.

**Configuration** is on a separate options page: right‑click the extension icon → **Options**, or click **Configure extension…** in the popup.

---

## Install locally (unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the folder that contains this extension (the folder with `manifest.json`, `popup.html`, `popup.js`, `options.html`, `options.js`, `content.js`, and `style.css`).

The extension icon will appear in the toolbar. Click it to open the popup.

---

## Configuration

Open the extension **Options** (right‑click the extension icon → **Options**, or **Configure extension…** in the popup). Set:


- **Personal Access Token** — From YNAB: Account Settings → Developer Settings → New Token. Keep it private.
- **Budget** — Select from the dropdown (loaded from YNAB).
- **Partner name** — e.g. Nick (used in the default memo).
- **Default memo** — e.g. `Split with {partner_name}`.
- **Partner reimbursement category** — Category for the partner’s half (dropdown from YNAB).
- **Reload YNAB tab after split** — When enabled, the extension reloads the YNAB page after splitting so you see updated transactions without refreshing manually.

The **Category for your half** is chosen in the popup each time you split.

---

## Usage

1. Configure the extension once in **Options** (token, budget, partner name, default memo, partner reimbursement category).
2. In YNAB, select the transaction(s) you want to split.
3. Open the extension popup, choose **Category for your half** (and optional memo), then click **Split Selected Transactions**.

The extension will, for each selected transaction:

- Fetch the transaction from the API.
- Skip it if it already has subtransactions or amount is zero.
- Split the amount in half (handling odd milliunits so the two halves sum to the original).
- Update the transaction to a split: your half to the chosen category, the other half to the partner reimbursement category, with the memo you set.

### Split by flag

You can also split transactions by YNAB flag (e.g. purple “Split with Nick” = flag #6):

1. In YNAB, assign a category to each transaction and add the chosen flag (e.g. purple).
2. In the popup, open the **Split by flag** section, choose **Flag to split** (e.g. Purple (6)), then click **Split Flagged Transactions**.

The extension finds all transactions in the current month with that flag that are not already split and have a category. Each is split 50/50 between that **existing category** and the partner reimbursement category, the flag is removed, and the memo is applied.

---

## Requirements

- Chrome (Manifest V3).
- A YNAB account and a Personal Access Token.
- The YNAB web app open at `https://app.ynab.com` with transactions selected.

---

## Development

- **Lint:** `npm install` then `npm run lint`. Use `npm run lint:fix` to auto-fix where possible.
- Code follows ESLint with `strict` mode, `eqeqeq`, `prefer-const`, and browser/webextensions env.

---

## Disclaimer

This project is not affiliated with, associated with, or officially connected with YNAB or any of its subsidiaries or affiliates. The official YNAB website is [https://www.ynab.com](https://www.ynab.com). The names YNAB and You Need A Budget, and related names and marks, are trademarks of YNAB.
