# TGP Pharmacy user manual

Academic submission edition, 2026-11-20. Covers the implemented React/Express interface. This is not approval for live pharmacy use.

**Current verification boundary:** after finalization, the owner explicitly authorized one Admin and one Employee in existing Neon. Both now have verified actual local login/dashboard/role access (18 HTTP checks). Business records remain empty, so no receiving, sale or populated report walkthrough is claimed. Earlier finalization tests used fixtures/read-only queries. No screenshots are fabricated; actual browser screenshots and user acceptance remain outstanding. See [account setup record](phase4/ACADEMIC_ACCOUNT_SETUP.md) for private credential access.

## 1. Access and sign-in

Open the approved application address. For existing local development use `http://localhost:5173/`. Enter your assigned username and password and select **Sign in**. There is no public registration or password-reset screen. Ask the authorized administrator/operator for an assigned account; do not share credentials, use defaults, or put passwords in screenshots.

The system checks account status and current role on protected requests. Incorrect credentials or an inactive account are rejected without explaining which field matched. Your role determines the workspace after sign-in. Use **Sign out** when finished. Sessions expire; an API restart also requires signing in again. Reopen a saved checkout using the original cashier account.

The authorized academic Admin and Employee credentials are stored in ignored `server/.env.academic-accounts`; retrieve them privately. No Manager account was created. Do not rerun bootstrap or create business records beyond the owner's account-only authorization.

## 2. Roles and navigation

| Role | Implemented access |
| --- | --- |
| Employee | Cashier Overview/POS, product search, inventory quantities/expiry/selling prices. No suppliers, purchase orders, stock receiving management, financial reports, pricing edits or user management. Batch cost is excluded by the server. |
| Manager | Employee access plus product/batch metadata, suppliers, purchase orders, stock-in and approvals, daily/weekly reports. Reorder thresholds are administrator-controlled. |
| Admin | Existing management functions plus monthly/product/valuation/profit report views, User accounts management, and read-only Audit Logs. |

Use the workspace navigation: **Overview**, **POS**, **Products**, **Inventory**, and (Manager/Admin) **Reports**, **Suppliers**, **Purchase orders**, **Stock-in**. Employee Overview is a cashier workspace rather than a financial dashboard. Manager/Admin Overview summarizes permitted sales/inventory information.

General settings, returns and inventory-adjustment posting are not implemented. The manual does not claim all approved SRF functions are complete.

## Admin Audit Logs

Only Admin can open **Administration > Audit Logs** (`/audit-logs`). The table
shows **User, Action, Module, Reference and Time**, with most recent recorded
timestamps first and log ID as the tie-breaker. Use **Search audit logs** to
search stored usernames, current full names, actions or modules. IDs embedded
in stored action text are searchable; generated labels such as `Sale #25` are
not separate searchable fields. Choose a module from the values already present
in the log records, then select **Search**. An empty module selection means all
modules. Previous/Next navigate the filtered results; searching starts at page 1.

Action and module text are shown as recorded. User names are joined from current
accounts, not immutable historical name snapshots. The Reference column extracts
IDs only from recognized existing action formats. It does not create a new
database relationship, receipt number or approval state. A dash means the
reference cannot be derived by the supported parser.

Time displays the stored timestamp, including available precision. The original
column contains no timezone; the page does not infer one or convert historical
times. Null values are shown as **Not recorded**, not replaced with the current
time. Loading, error/retry and empty states are provided.

This page cannot edit/delete logs, export them, set retention, or create events.
Viewing/searching does not write an audit event. Employee and Manager accounts
cannot access the page or API. Browser screenshots and visual acceptance remain
unverified; automated tests and a separate real read-only SQL check passed.

## Admin User accounts

Only Admin can open **Administration > User accounts** (`/users`). Search by
name or username, use Previous/Next for more records, and select a user's name
to view its supported details. The table shows User, Username, Role and Status.

Select **Add user** to create an Employee or Manager using an assigned username,
optional full name and an initial password of 12–128 characters. The password
is cleared from the form after submission and is never displayed in the list
or details. Do not put credentials in screenshots or share them publicly.
Creating actual academic accounts still requires the appropriate authorization;
this feature's implementation tests created only in-memory fixtures.

For an active Employee/Manager, open details, select **Deactivate account**, then
review and choose **Confirm deactivation** or **Keep account active**. Successful
deactivation prevents login and revokes the user's active sessions while keeping
existing history. Administrator accounts are read-only here. Inactive accounts
can be viewed but cannot be reactivated through this interface.

If a connection fails during creation or deactivation, use **Refresh accounts**
or **Refresh details** and review the record before trying again. The system does
not automatically retry an uncertain account mutation. Password reset, role
changes, reactivation and deletion are unavailable.

## 3. Products

Use **Products** to search by product/generic name, filter by a confirmed category or low stock, and change pages. No category names are prescribed by the software. **View batches** opens that product's inventory information.

Managers/Admins can **Add product** or **Edit** name, generic name, category and unit price. Administrators can set the reorder threshold. Leave unconfirmed optional values unset. Correct validation errors before saving. New product records do not create stock.

Images currently show an unavailable/empty state. Cloudinary is disabled and its migration is unapplied; do not attempt image management for this submission. Image availability is independent of product/stock workflows.

## 4. Inventory and batch information

Search batches by product/generic name or batch number and filter by product, expiry state and day window. Review batch number, expiry, recorded quantity and selling price; authorized management users can also see cost. Unknown values are shown as unknown rather than assumed zero.

Product totals include all recorded batches, including expired stock. POS available stock is narrower: batches must have positive known stock and expiry strictly later than today's Asia/Manila date. Batches expiring today are not sale-eligible. A difference between recorded and eligible stock is not permission to change quantities manually.

Managers/Admins may create a zero-stock batch and edit permitted metadata. Direct quantity editing is rejected, including attempts to set zero through metadata editing. Receiving approval and sales own the implemented quantity changes. Recorded cost/batch identity can be locked once referenced by transactions. Contact the authorized manager rather than rewriting historical information.

Low stock means recorded stock is at or below the configured reorder threshold. Near-expiry uses the selected day window; an editable UI default is not a permanent notification policy.

## 5. Suppliers and purchase orders

Managers/Admins can add, search, view and edit suppliers. Supplier deletion is unavailable. Use actual approved details; do not invent supplier contact information.

For a purchase order, choose the supplier and products, enter positive integer quantities and nonnegative decimal unit costs, then save. It begins pending; the authorized Manager/Admin can review and approve it. Review the record/history before repeating an action after an error.

Purchase orders and stock-in are independent in the approved schema. Receiving does not automatically mark a PO received or establish an undocumented link. Partial-delivery and supplier-return rules are not implemented.

## 6. Stock receiving

In **Stock-in**, record supplier, delivery reference and each product's batch number, expiry, quantity, cost and selling price. Saving produces a pending record and zero-stock batch rows; it does not increase available inventory.

The authorized Manager/Admin reviews the detail/history and selects **Approve** once. Successful approval posts stock transactionally and records the actor. Reapproving the same stock-in is rejected and must not increase stock again. After a network error, view/refresh the existing record and its approval history before trying again; do not create a replacement delivery merely because a response was lost.

Manager/Admin self-approval is permitted by the accepted provisional MVP scope; it is not a confirmed permanent pharmacy policy. Delivery-reference uniqueness is not guaranteed. Verify the real delivery paperwork to avoid entering the same physical delivery as separate records.

## 7. Regular-price cash sale

1. Open **POS**, search for a product and select **Add**.
2. Enter positive whole-number quantities; remove unwanted items.
3. Select **Review total**. The server checks official product prices and eligible stock; a review does not reserve stock.
4. Enter sufficient **Cash received (PHP)** using at most two decimal places.
5. Select **Complete cash sale** once and wait. Price, payment and stock are checked again server-side.
6. On **Transaction complete**, review stored reference, batch lines, total, tender and change. One product may appear on several batch lines because FEFO can fulfil it from multiple batches.

The server uses exact PostgreSQL decimal calculations and earliest eligible expiry first. Sale, payment, batch deductions and successful-sale audit commit together. A displayed MVP confirmation is not a validated fiscal receipt. Only full cash payment is supported; no partial payments, card settlement, refunds, returns, voids, Senior/PWD discount or discount-approval workflow is supplied.

### Correct rejected or uncertain checkout safely

- **Confirmed insufficient cash/stock rejection:** the server rolls back the attempted sale and durably closes its request reference. The cart becomes editable, the quote is cleared, and the page tells you the reference closed without a sale. Correct quantity/cash and select **Review total** again. Only a subsequent submission gets a new reference; delayed requests using the closed reference cannot post a sale.
- **Network timeout/5xx or unconfirmed error:** the saved cart/payment remains locked. Do not collect another payment or start a replacement transaction. Select **Check transaction status** or **Retry saved checkout** to use exactly the stored reference and payload.
- **Need to change an uncertain saved cart:** select **Resolve for editing**. The server serializes resolution with checkout. If the sale already completed, it shows the existing receipt. Otherwise it closes the unused reference before unlocking the cart. This is not a refund or sale cancellation.
- **Status says no committed sale found:** that response alone does not prove a delayed request cannot arrive. Use explicit resolution before editing; do not clear storage manually.
- **Refresh or session expiry:** return in the same browser/profile, sign in as the original cashier, and resolve the saved checkout. Keep one cashier POS tab open.
- **Storage or resolution failure:** retain the saved reference and contact the authorized operator. Do not erase site data or invent a replacement transaction while the outcome is uncertain. Another saved reference must not be overwritten/removed as part of clearing the current one.

## 8. Reports

Managers may view daily/weekly sales and permitted low-stock/expiry information. Admins also access monthly sales, product performance, valuation and supported profit estimates. Select valid inclusive dates within the bounded range (at most 366 days). Date grouping uses Asia/Manila and currency is PHP.

Only completed, fully paid regular-price POS records meeting reconciliation checks are counted. Approval status is shown separately: a NULL `approved_by` is unreviewed, not approved, and does not by itself exclude a completed paid sale under the provisional reporting policy. Incomplete/unpaid or unsupported records are excluded rather than fabricated into totals.

Profit/margin figures are estimates and can be unavailable when approved cost evidence is insufficient. Empty reports reflect no qualifying data; they are not evidence of successful transactions. Do not interpret an unverified/unknown amount as zero revenue or confirmed profit. Reporting is read-only.

## 9. Common problems and escalation

| Symptom | Action |
| --- | --- |
| Cannot log in | Confirm the assigned account/status with the authorized operator and use the private academic credential file. Do not rerun bootstrap or create duplicate accounts. |
| Session expired after API restart | Sign in again; recover any saved checkout as its original cashier. |
| Access denied | Use your permitted role; UI changes or direct URLs do not grant server permissions. |
| No products/stock/reports | Check approved records and filters. Current database is empty; do not seed it for appearances. |
| Checkout uncertain | Keep its reference; check status/retry the same request or use server-confirmed resolution. |
| Provider/image unavailable | Expected while Cloudinary is disabled. Product and stock functions remain independent. |
| Service/database unavailable | Stop mutations and contact the operator; avoid repeated replacement documents or sales. |

Record the page, time, role, non-sensitive reference, steps and visible error for the bug log. Never include passwords, session cookies, database URLs, customer IDs or secret-containing screenshots. Operator deployment instructions and current evidence are in [DEPLOYMENT.md](DEPLOYMENT.md), [BUG_LOG.md](BUG_LOG.md) and the [final presentation checklist](phase4/FINAL_PRESENTATION_CHECKLIST.md).
