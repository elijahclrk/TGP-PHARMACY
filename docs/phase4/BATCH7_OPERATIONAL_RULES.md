# Batch 7 operational rules — proposed owner/pharmacist acceptance

Date: 2026-11-21 Asia/Manila. These rules document the existing protected flows and
the owner-authorized safe implementation direction. **Business acceptance remains
pending.** No production record, account, privilege or feature flag was changed.

## Adjustment initiation versus authority to change stock

Proposed operating policy: Employees may **submit a discrepancy request** against
an original batch. This does not grant product/price editing, supplier receiving,
approval or direct quantity mutation.

- Request records original batch, signed nonzero quantity, nonblank reason,
  authenticated actor and stable request key.
- Only a **different active Manager/Admin** may approve or reject.
- Approval locks/rechecks current records and posts stock, terminal decision and
  audit atomically, exactly once. Rejection records a reason and never posts.
- Initiators cannot approve their own requests, including Manager/Admin initiators.
- Use Stock-In for supplier deliveries. Do not disguise a delivery as an adjustment.
- Current PO/Stock-In approval and self-approval permissions remain unchanged.
- The searchable batch picker is a convenience over the same authoritative batch
  ID. It shows product, batch, expiry and recorded quantity; approval rechecks
  current stock. Numeric-ID entry remains supported.
- Unknown/uncertain request outcomes retain their request key; retry/query that
  reference rather than submitting a replacement.

This separates initiation from posting, but differs from SRF §6's broad Employee
inventory-adjustment exclusion. The owner must accept this interpretation or
authorize a stricter request role. QA did not weaken permissions.

## Recorded physical stock versus expiry-based availability

Compatible current-schema policy: a physical supplier delivery may be recorded
through approved Stock-In, including its actual expiry date. **Expired and
expiring-today quantities are excluded from sellable POS inventory.** They remain
in recorded physical quantities until an authorized correction/disposition.

The application now distinguishes:

| Measure | Meaning |
|---|---|
| Recorded stock / qty_on_hand | All recorded batches, including expired/today quantities; original low-stock/reorder comparison is unchanged |
| Within-date / within_date_qty | Batches with expiry strictly after the Asia/Manila business date, as an **expiry-only** quantity measure |
| Expired / today / expired_or_today_qty | Recorded quantities with expiry on or before the business date |
| Unknown | Missing quantities or positive stock with unknown expiry prevent a confident within-date total |

Within-date quantity is not a certification of overall saleability, storage
suitability, tax eligibility or quarantine status. POS still performs its own
authoritative price/FEFO/quantity checks; unknown expiry cannot enter allocation.

No quarantine rows are fabricated for supplier deliveries. Return quarantine
remains the separate approved-return/physical-receipt/disposition workflow. The
existing schema has no supplier-receipt quarantine/disposition lifecycle. Do not
label a delivery as professionally quarantined based only on its expiry date.

Wireframe receiving text says expired stock cannot be received. Batch 7's safe
compatible behavior explicitly records physical stock separately from POS
eligibility, rather than adding an unapproved rejection/quarantine mechanism.
Owner/pharmacist must accept the receiving SOP, or approve future reject/controlled
receipt handling. Physical segregation, supplier resolution, disposal and actual
suitability assessment remain professional operating decisions.

Automated example: recorded stock **68**, within-date **62**, expired/today **6**.
Original cash sale remains PHP 224.00; these inventory measures do not reverse
revenue or invent refunds.

## Notifications and durable settings

Admin display preferences currently control only optional dashboard low-stock and
upcoming-expiry reminders for that Admin account **on this browser**. Defaults
preserve enabled reminders. Clearing storage resets them. Manager/Employee views,
all Alerts tabs, stock rules, approvals and report access are unaffected.

No SMS, email, push, scheduled digest, read/dismiss state or pharmacy-wide setting
was introduced. Proposed migration
010_in_app_notification_preferences.sql is **design only**, not installed even in
the local UAT schema. Any durable API must bind the active Admin to self, enforce
trusted requests, compare revision, lock against role/status changes, and update
settings/audit in one transaction. Global-versus-personal ownership and other
notification types need separate review.

## Required acceptance records

Owner decision on Employee request-only adjustment access: **Pending**

Pharmacist/owner receiving and physical segregation SOP: **Pending**

Pharmacist qualification onboarding and disposition SOP: **Pending**

Acceptance of browser-local reminder scope / durable preference design: **Pending**

No signed field is inferred from automated tests or synthetic professional fixtures.

