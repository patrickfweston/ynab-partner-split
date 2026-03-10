# YNAB Partner Split

A Chrome extension (Manifest V3) that integrates with the [YNAB API](https://api.ynab.com) to split selected transactions 50/50 between your category and a configurable partner reimbursement category.

**Example:** A $40 grocery purchase becomes:
- $20 → Groceries (your half)
- $20 → Partner reimbursement category (e.g. "Nick Split Spending")

The extension runs on [app.ynab.com](https://app.ynab.com). You select one or more transactions in the YNAB UI, then choose the **Partner reimbursement category** in the popup and click **Split Selected Transactions**.

**Configuration** is on a separate options page: right‑click the extension icon → **Options**, or click **Configure extension…** in the popup.

---

## Install (no Chrome Web Store)

You can install the extension in a few steps without publishing it to the Chrome Web Store.

### Step 1: Get the extension files

- **From GitHub:** Open the repo, click the green **Code** button, then **Download ZIP**. Unzip the file somewhere on your computer (e.g. Desktop or Documents).
- **From a release:** If someone shared a ZIP of the extension, unzip it to a folder.

You need the **folder** that contains `manifest.json`, `popup.html`, `content.js`, and the other extension files (not the ZIP itself). If you downloaded from GitHub, the folder is usually named `ynab-partner-split` or `ynab-partner-split-main`.

### Step 2: Load the extension in Chrome

1. Open Chrome and in the address bar type: `chrome://extensions`
2. Turn **Developer mode** on (toggle in the top-right corner).
3. Click **Load unpacked**.
4. In the file picker, select the **unzipped folder** that contains `manifest.json` (the extension root).
5. Click **Select Folder** (or **Open** on Mac).

The extension should appear in your list and its icon will show in the Chrome toolbar. You can pin it via the puzzle piece icon if you like.

### Step 3: Configure once

**Get your YNAB key first:** Sign in at [app.ynab.com](https://app.ynab.com) → **Account Settings** (gear icon) → **Developer Settings** → under **Personal Access Tokens**, click **New Token**, enter your password, and copy the token. Treat it like a password and keep it private.

Then right‑click the extension icon → **Options**, and enter that token plus your budget, partner details, and categories (see [Configuration](#configuration) for the full list).

### Updating the extension

There is no auto-update when you install this way. To get a new version: download the latest ZIP (or pull the latest code), replace the folder you used in Step 2 with the new one, then go to `chrome://extensions` and click the **Reload** button on the YNAB Partner Split card.

---

## Configuration

Open the extension **Options** (right‑click the extension icon → **Options**, or **Configure extension…** in the popup). Set:

**YNAB API**
- **Personal Access Token** — From YNAB: Account Settings → Developer Settings → New Token. Keep it private.
- **Budget** — Select from the dropdown (loaded from YNAB).

**Partner & memo**
- **Partner name** — e.g. Nick (used in the default memo and in the `{partner_name}` placeholder).
- **Default memo** — e.g. `Split with {partner_name}`. Used for all split transactions unless you override it in the popup.

**Categories**
- **Partner reimbursement category** — Category for the partner’s half (dropdown from YNAB). Required for both “split selected rows” and “split by flag.”

**Behavior**
- **Default flag (for split by flag)** — Which YNAB flag color to look for when you use “Split by flag” (Red, Orange, Yellow, Green, Blue, or Purple). This is the option preselected in the popup; you can change it in the popup for a one-off run.
- **Reload YNAB tab after split** — When enabled, the extension reloads the YNAB page after splitting so you see updated transactions without refreshing manually.

The **Category for your half** is chosen in the popup each time you split (for “split selected rows”). For “split by flag,” the extension uses each transaction’s existing category as your half.

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

You can also split transactions by YNAB flag (e.g. purple for “Split with Nick”):

1. In **Options**, set **Default flag (for split by flag)** to the color you use (e.g. Purple).
2. In YNAB, assign a category to each transaction and add that flag.
3. In the popup, open the **Split by flag** section. The **Flag to split** dropdown is preselected from your default; change it if you want a different color for this run. Click **Split Flagged Transactions**.

The extension finds all transactions in the **current month** with the chosen flag that are not already split and have a category. Each is split 50/50 between that **existing category** and the partner reimbursement category, the flag is removed, and the memo is applied.

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

## Distributing / Releasing

**Building a .crx (optional)**  
You may build and host a `.crx` for distribution or for your own releases:

1. In Chrome, go to `chrome://extensions`.
2. Turn on **Developer mode**, then click **Pack extension**.
3. Choose the **Extension root directory** (this project folder). Leave **Private key file** blank the first time; Chrome will create a `.pem` and a `.crx`.
4. The new `.crx` is the packaged extension. To **update** the .crx after code changes, run **Pack extension** again and point to the same `.pem` when prompted so the extension ID stays the same.

**Notes**

- **Do not** commit or publish the `.pem` file; it is your private signing key. The repo `.gitignore` already excludes `*.pem` and `*.crx`.
- Packing a new `.crx` with the same key does **not** auto-update users who already have the extension installed. Auto-update only happens for extensions installed from the Chrome Web Store. For installs via “Load unpacked” or a .crx you host, users need to manually update (re-download and reload, or pull latest and reload).
- Chrome often blocks or warns when users install a `.crx` downloaded from a website. The easiest path without using the Store is to point people to this repo (or a ZIP of it) and the [Install](#install-no-chrome-web-store) steps above.

---

## Disclaimer

This project is not affiliated with, associated with, or officially connected with YNAB or any of its subsidiaries or affiliates. The official YNAB website is [https://www.ynab.com](https://www.ynab.com). The names YNAB and You Need A Budget, and related names and marks, are trademarks of YNAB.
