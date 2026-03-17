# Privacy Policy – YNAB Partner Split

**Last updated:** March 2025

YNAB Partner Split is a Chrome extension that helps you split YNAB transactions between your category and a partner reimbursement category. This policy describes what data the extension uses and where it goes.

## Data the extension uses

The extension stores the following in **Chrome’s local storage** (on your device, or synced via your Chrome account if you use Chrome sync):

- **YNAB Personal Access Token** – Used only to call the YNAB API on your behalf.
- **Budget and category choices** – The budget you select and the partner reimbursement category (and, if you use the popup, the last “category for your half” you chose).
- **Partner name and default memo** – So the extension can fill in memos (e.g. “Split with Nick”).
- **Other preferences** – Default flag for “split by flag,” and whether to reload the YNAB tab after splitting.

This data stays in your browser. The extension does not send it to the developer or to any server other than YNAB’s when you use the extension.

## Where data is sent

- **YNAB API (api.ynab.com)** – When you split transactions, the extension sends requests to YNAB using your token. Those requests include things like transaction IDs, category IDs, amounts, and memo text. This is the same kind of data YNAB already has; the extension only updates it according to your actions.
- **Google Fonts (fonts.googleapis.com / fonts.gstatic.com)** – The popup and options pages may load the Poppins font from Google. Only font and CSS files are loaded; no JavaScript or other code is executed from Google. Google’s own privacy policy applies to that request.

The extension does **not** send your data to the developer of YNAB Partner Split or to any other third party for analytics, advertising, or any other purpose.

## What the extension does not do

- It does **not** collect your name, email, or other personally identifiable information for the developer.
- It does **not** read your web history, track your browsing, or log keystrokes.
- It does **not** use any analytics or tracking scripts.
- It does **not** sell or share your data with anyone.

## Your control

- You can remove the extension at any time from Chrome (chrome://extensions). That stops any further use of your data by the extension.
- Data stored in Chrome (your token, settings) is controlled by Chrome’s storage. You can clear extension data via Chrome’s settings or by removing the extension.

## Changes to this policy

If this privacy policy changes, the “Last updated” date at the top will be revised. Continued use of the extension after changes means you accept the updated policy.

## Contact

This extension is an independent, open-source project and is not affiliated with YNAB. For questions about this privacy policy or the extension, please open an issue or use the contact details in the project’s GitHub repository.

**Repository:** [github.com/patrickfweston/ynab-partner-split](https://github.com/patrickfweston/ynab-partner-split)
