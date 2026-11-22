# Batch 12 — Product exchange research

Research date: **22 November 2026, Asia/Manila**. **RESEARCH AND DESIGN ONLY.** No exchange functionality, executable migration or activation is delivered by this batch.

Read with the [technical specification](BATCH12_EXCHANGE_TECHNICAL_SPEC.md) and [validation checklist](BATCH12_EXCHANGE_VALIDATION_CHECKLIST.md). This is an engineering assessment of identified primary sources, not legal certification, an approved branch policy, tax advice or pharmacy acceptance.

## 1. Evidence and scope

| Label | Meaning |
| --- | --- |
| VERIFIED | Repository contents inspected, or the cited operative/official text was readable. This does not establish branch compliance. |
| CONFIRMED CLIENT DECISION | An express project-owner instruction, including “No refund, change product lang.” It cannot displace applicable law. |
| PROPOSED POLICY / DESIGN | A recommendation requiring review; not an existing client requirement or implemented feature. |
| UNSPECIFIED | The owner has not supplied a necessary operational decision. |
| BLOCKED | Posting/activation must remain unavailable until the identified evidence, decision or implementation exists. |
| PARTIAL | A source, operational applicability or complete official text could not be fully verified. |

The working tree was clean at the start; local HEAD was `d4c289edabb553ed54dfde507dc84af479cc99d8`. GitHub synchronization is the supplied baseline; no remote operation was needed for this design. The historical matrix still contains pre-checkpoint Git wording; it is preserved rather than mistaken for the current repository state.

### Repository evidence reviewed

- [Batch 11 results](BATCH11_RESULTS.md), its 63-row [requirements matrix](FINAL_REQUIREMENTS_MATRIX.md), UAT/release guidance, Batch 1–10 completion/design evidence and the three Batch 9 documents. R38–R43 describe returns/disposition; **R63 remains MISSING**. A design does not change that implementation status.
- Phase 1 System Request Form, requirements on pages 2–4; Phase 2 ERD, DFD and use-case diagram; Phase 3 SQL, ERD, architecture and supporting diagrams; Phase 4 operational/release material. The full Feasibility Report and additional textual use-case narratives remain absent. Its §2.1 web-app decision is supplied owner evidence, not an independently inspected report.
- All nine clickable references: `Access.png`, `OVERVIEW.png`, `OPERATIONS.png`, `INVENTORY.png`, `MANAGEMENT.png`, `ADMINISTRATION.png`, `cards.png`, `Dialogs.png`, `TGP Clickable Wireframe.png`. They establish visual vocabulary and receipt/return/approval placement, not exchange settlement, clinical equivalence or fiscal authority.
- Actual return, disposition, authentication, POS, FEFO, benefit-calculation/verification, payment, reporting/export and schema-compatibility contracts listed in §4 and the technical specification.

Original documents describe accountability, receipt-linked returns, inventory and estimates, but do not define a complete replacement/settlement ledger. Original SQL comments about automatic approved-return restocking and approved-only sales reporting are superseded by later owner decisions. The original role name “Manager/Pharmacist” is not professional qualification evidence.

### Confirmed boundary

One English, desktop-oriented React/Express/PostgreSQL application; existing roles and cash-only MVP; no automatic refund or automatic medicine restocking; original paid sales remain recognizable without routine approval. Existing new return/adjustment workflows have independent Manager/Admin review. This task asks for an exchange design using independent authorization; its exact no-self-review, reservation and posting rules below are proposals for approval. Clinical decisions require actual verified qualifications. Existing PO/Stock-In permissions are not revised. Senior/PWD production activation and fiscal invoicing remain subject to Batch 9 branch gates. No exchange implementation, migration execution, database connection, feature activation, commit, push or deployment is authorized here.

## 2. Primary-source findings and applicability

Sources below were accessed during this review. Approval/signature dates are not substituted for publication-based effectivity dates. Search results do not prove there are no subsequent issuances; currentness and branch applicability must be rechecked before implementation approval/activation.

### L01 — Consumer remedies are distinct from voluntary exchange

**VERIFIED.** RA 7394, particularly Arts. 6, 10, 68, 96–101, establishes consumer protection, warranty/product-imperfection remedies and agency responsibilities. Art. 100 includes replacement, reimbursement and price reduction under its conditions; its correction periods and exceptions are not a universal medicine-return deadline or permission to dispense unsafe goods. Its different-kind replacement provision addresses the value difference. Art. 101 separately addresses quantity imperfections. DOH has specified food/drug safety responsibilities; not every medicine concern belongs exclusively to DTI.

**Implication:** identify defect, dispensing error, recall/safety concern and voluntary change-of-mind separately. Do not force a paid upgrade as the only remedy for a defective medicine, automatically charge the customer every price increase, or treat an internal approval rejection as extinction of a legal claim. Exact remedy and responsible-party allocation need qualified assessment. [RA 7394, original statute, approved 13 April 1992](https://lawphil.net/statutes/repacts/ra1992/ra_7394_1992.html).

### L02 — DTI expressly addresses exchange-only policies and repeat replacements

**VERIFIED.** DTI's August 2022 services FAQ, printed pages 74–76 (PDF pages 75–77), explains that defect remedies can include exchange or refund, whereas ordinary change of mind is different. Purchase can sometimes be proved without the original receipt. It rejects a universal one-exchange-only limit for replacement remedies and describes return timing contextually. These are official explanations, not a branch-specific adjudication.

**Implication:** the client's no-refund preference can govern a reviewed voluntary exchange offer, but needs an exception/escalation procedure for statutory remedies. A missing system receipt prevents automatic ledger posting, not staff consideration of alternative proof. Prevent duplicate consumption of the same returned quantity; allow a legitimately defective replacement to start its own linked claim. Do not print blanket no-refund/no-exchange disclaimers. [DTI official FAQ, section K](https://dtiwebfiles.s3-ap-southeast-1.amazonaws.com/FAQs%20on%20DTI%20Services%20as%20of%20Aug%202022.pdf).

DTI's current complaints page identifies product liability, warranties and misleading return notices as complaint subjects. Determine the appropriate DTI/FDA/DOH or judicial referral for the actual issue. [DTI-FTEB complaints handling](https://fairtrade.dti.gov.ph/services/complaints-handling/).

### L03 — Philippine adoption of storage/distribution standards

**VERIFIED.** DOH AO 2013-0027 covers drug establishments and retailers and adopts the named WHO GDP/GSP standards, including supplements/revisions. FDA Advisory 2022-1895 expressly directs compliance and points to the consolidated WHO TRS 1025 Annex 7 (2020). Thus the updated source, not an isolated old annex paragraph or a commercial pharmacy policy, is relevant to this design. No later nationwide exchange-specific replacement rule was established by this search.

[DOH AO 2013-0027, Supreme Court official repository](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/67646); [FDA Advisory 2022-1895 and adoption explanation](https://www.fda.gov.ph/fda-advisory-no-2022-1895-compliance-to-administrative-order-no-2013-0027-or-the-rules-on-the-adoption-and-implementation-of-the-world-health-organization-annex-5-guide-to-good-distributi/).

### L04 — Quarantine, assessment and medicine disposition

**VERIFIED.** WHO TRS 1025 Annex 7 §§9.1–9.8 requires controlled return procedures, quarantine, quality assessment, suitable authorized personnel, recorded disposition and appropriate destruction/retention. Doubtful quality is unsuitable for reissue. §§1.6–1.9 explain national adaptation and that patient dispensing is addressed elsewhere. This is not unrestricted permission to resell a patient-returned medicine after a visual inspection.

**PROPOSED SAFETY POLICY:** exchange settlement never releases returned stock. Keep patient-returned medicines unavailable for sellable restocking unless the pharmacist obtains an applicable authorized SOP/legal basis and adequate custody/storage evidence. Professional authorization alone is necessary where applicable but does not prove suitability. The existing local restock capability remains a technically tested feature, not regulatory approval for every patient return. [WHO official publication and downloadable Annex 7](https://www.who.int/publications/m/item/trs-1025-annex-7).

DOH hospital citizen charters describe particular institutions' return procedures; they are not nationwide authorization for this private branch. This review did not adopt a hospital's time limit, refund voucher or resale practice as TGP policy. The FDA-hosted WHO attachment page returned an access error in one retrieval; the full corresponding text was read from WHO's official PDF.

### L05 — Replacement selection is a dispensing decision

**VERIFIED.** RA 10918 §§30–33, 35–37 governs licensed outlets, pharmacist involvement, prescription filling, substitution, labels and records. §35 requires prior consultation/written prescriber consent for substitution except the stated Generics Act/other-law cases. An app role or a matching selling price does not establish clinical equivalence.

**Implication:** separate independent commercial review from clinical verification. Record product identity/form/strength, prescription/OTC category and the applicable authorization evidence. Do not infer strength or equivalence from free-text names. Prescription-only or pharmacist-only replacement cannot bypass dispensing duties. Unknown clinical suitability stays unavailable. Controlled drugs, cold-chain, opened/compounded products and recalls need appropriate specialist SOPs; no generic override is proposed. [RA 10918, Supreme Court official text](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/70354).

### L06 — Exchange value and tax are not determined by extra cash alone

**VERIFIED.** RA 11976 §16, amended NIRC §106(A)/(D), addresses sales/barter/exchange consideration and the timing/documentation of sales-return deductions. §21 amends invoice requirements; §33 addresses accounting-record preservation. A physical return row alone is not a credit memorandum, refund or automatic tax deduction. Zero additional cash does not establish zero replacement consideration or VAT.

**BLOCKED:** accountant-approved treatment of original return documents, replacement issuance, differences, VAT/benefit adjustments and reporting periods. No automatic revenue reversal, credit note, tax filing or journal entry is inferred. Original payments remain immutable. [RA 11976, amended NIRC provisions](https://lawphil.net/statutes/repacts/ra2024/ra_11976_2024.html).

**Historical context only:** BIR RR 16-2005 §4.106-9 discusses proper sales-return credits/refunds. Its original rates and older terminology are not current defaults; later legislation prevails. [BIR official consolidated 2005 regulations](https://bir-cdn.bir.gov.ph/BIR/pdf/26116rr16-2005.pdf).

### L07 — Internal confirmations are not authorized fiscal invoices

**VERIFIED / PARTIAL FORM REVIEW.** BIR's official RR 7-2024/11-2024 digests and RMC 77-2024 identify the invoice framework and changes to former receipt practice. The full RMC PDF was image-only through text retrieval. Batch 9's unresolved legible-template, registration, electronic-invoicing and later-amendment checks remain. No printed exchange confirmation becomes a registered invoice merely by changing its title.

[RR 7-2024 official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%207-2024.pdf), [RR 11-2024 official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2011-2024.pdf), [RMC 77-2024 official full document](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf). Actual approved branch document types, series, original-reference fields and correction procedure require accountant/RDO review where applicable. Reuse Batch 9 R09–R12 for the identified later invoice changes; they are not newly certified by this exchange review.

### L08 — Senior and PWD benefits require independent replacement assessment

**VERIFIED.** RA 9994 §4 and RA 10754 §1 establish their respective medicine benefits for qualifying exclusive use. BIR RR 5-2017 §§3–7 explains PWD VAT/discount calculations, records and non-stacking. These provisions do not establish a complete universal exchange valuation algorithm.

**PROPOSED DESIGN:** preserve original discount/tax components as actually recorded; independently validate the replacement under its transaction-effective classification and scheme evidence. Do not refund/reuse gross prediscount price as if cash paid, remove VAT twice, apply Senior and PWD successively, or discount only the cash difference by default. A same-kind defect replacement and a voluntary different-product purchase may require different documentary treatment. Exact exchange adjustments, prescription corrections and discount-burden accounting remain unresolved.

[RA 9994](https://lawphil.net/statutes/repacts/ra2010/ra_9994_2010.html), [RA 10754, NCDA official republication](https://ncda.gov.ph/disability-laws/republic-acts/republic-act-no-10754-an-act-expanding-the-benefits-and-privileges-of-persons-with-disability-pwd/), [RR 5-2017, NCDA official republication](https://ncda.gov.ph/disability-laws/implementing-rules-and-regulations-irr/revenue-regulations-no-5-2017-rules-and-regulations-implementing-republic-act-no-10754/).

The [Batch 9 research R01–R14](BATCH9_SENIOR_PWD_RESEARCH.md) remains the detailed source register for Senior no-booklet amendments, distinct PWD documentation, current SKU-specific intrinsic VAT evidence, rounding, supplier sharing and invoice updates. Batch 10 implements **test-only** versioned policies; it supplies no real branch VAT status, medicine classification or external entitlement verification. All applicable [B01–B16 gates](BATCH9_VALIDATION_CHECKLIST.md) carry forward, including subsequent-source/currentness checks.

### L09 — Protect beneficiary and clinical evidence

**VERIFIED.** RA 10173 §§3, 11–13, 16 and 20 govern personal/sensitive information and safeguards. Capture only justified evidence; distinguish lawful retention from public disclosure. Operational transaction references do not authorize broad identification exports. [National Privacy Commission official Act](https://privacy.gov.ph/data-privacy-act/).

**PROPOSED DESIGN:** exchange confirmations/history mask identity except an authorized purpose-specific view; ordinary reports/XLSX/PDF omit beneficiary/representative IDs, prescriptions and clinical notes. Preserve protected references rather than copying personal data into audit action strings, URLs or browser recovery. Approve retention and legal-hold rules alongside the accounting schedule.

## 3. Recommended business rules for review

| ID | Rule / classification | Recommendation and unresolved boundary |
| --- | --- | --- |
| E01 | CONFIRMED: exchange requirement; no automatic refund | Deliver a linked replacement workflow. Do not approximate it with an unrelated fully paid sale. Lawful statutory remedies need a separate reviewed exception procedure. |
| E02 | PROPOSED: remedy classification | Record `voluntary_exchange`, `same_kind_defect_replacement`, or `statutory_remedy_review`, supporting evidence and customer-selected remedy. Do not hardcode a universal 7/30-day return limit. |
| E03 | CONFIRMED scope + PROPOSED implementation | Start with an approved return tied to the actual sale item and batch, physically received under existing full-receipt rules. Partial exchange claims can consume part of that received quantity. Pending/rejected/unreceived returns cannot post. Missing receipt/alternative proof goes to reviewed case handling, never a fabricated sale. |
| E04 | PROPOSED exchange authorization, matching existing independent return review | Exchange initiator/cashier cannot review their own request under the proposed policy. Final posting by the original initiator after approval uses two distinct staff accounts, not an invented third-person requirement. Existing PO/Stock-In permissions remain. |
| E05 | CONFIRMED: quarantine, no automatic restock | Acceptance, physical disposition and financial settlement are separate. Destroying/supplier-returning quarantined goods does not automatically cancel the customer's claim. Replacing goods does not consume physical quarantine. |
| E06 | PROPOSED: eligible replacement | Server-selected FEFO from known, unexpired, sellable batches only; expiry today excluded per existing Manila rule. Clinical/prescription suitability independently verified, not price equivalence. Supplier deliveries still use Stock-In. |
| E07 | PROPOSED: equal-price voluntary exchange | Compare supported net consideration, not catalog gross alone. Equal applied return value/replacement payable needs no additional cash. Record a zero-additional-cash settlement, not a fake cash sale/payment. |
| E08 | PROPOSED: higher-price voluntary choice | With informed consent and approved valuation policy, collect only the positive cash difference. Record tender/change and full replacement value separately. A statutory same-kind replacement is not automatically repriced as a paid upgrade. |
| E09 | UNSPECIFIED / BLOCKED: lower-price difference | Never silently forfeit it, call it profit, force a purchase, issue invented store credit or auto-refund. Hold settlement for an approved lawful remedy. Owner/legal/accountant must decide; customer may choose another suitable equal/higher basket voluntarily. Preserve legal refund rights outside the unimplemented automatic-refund path. |
| E10 | PROPOSED: quantities | Positive integer supported base units; multiple original lines and replacements allowed within one receipt/root transaction. No fractional-tablet conversion, cross-receipt pooling or transferable credit. Whether to add these later is unspecified. |
| E11 | PROPOSED: value basis | For voluntary exchange, use bounded actual historical net consideration of the consumed units, never today's original-product price. This is a proposed settlement basis, not a universal legal valuation rule. Same-kind warranties and statutory price differences have a separate reviewed policy. |
| E12 | CONFIRMED privacy/benefit principles; exchange policy UNSPECIFIED | Reassess replacement eligibility independently; preserve beneficiary linkage securely, no stacking or unknown-classification fallback. Gate discounted exchanges until approved exchange-specific accounting/dispensing vectors exist. Do not convert them silently to Regular. |
| E13 | PROPOSED: duplicate versus repeat replacement | Reserve approved claim quantities; consume once on posting. A new defective replacement is a new source with its own limits/history, not reuse of the old return. No blanket lifetime one-exchange rule. |
| E14 | CONFIRMED integrity; PROPOSED mechanism | One transaction for final claim consumption, FEFO deductions, replacement snapshots, additional-cash settlement and audit. Stable UUID/digest replay; lost acknowledgement resolves to the original confirmation. |
| E15 | CONFIRMED reporting preservation | Original paid sale/payment/benefit snapshots stay unchanged; pending, rejected or approved return/exchange states never erase cash history. Replacement consideration, applied return value and extra cash are distinct measures. |

No values in this table constitute an approved branch refund/exchange policy. The checklist records decisions still needed before coding/activation.

## 4. Reusable functionality and exact limitations

| Existing source | Reuse | Limitation requiring additive work |
| --- | --- | --- |
| `server/src/services/prepared-workflows.js` | Original paid-sale reconciliation; return quantity/decision/receipt checks; independent approval; transaction and audit patterns | No exchange entitlement, replacement allocation or settlement service; pending returns do not reserve original quantities. Do not invoke a service that opens a second transaction from exchange posting. |
| `server/src/repositories/workflows.repository.js` | Receipt/item lookup, own-versus-management history, quarantine/disposition projection, canonical 007/008 readiness | `quarantined_remaining` is a physical balance, not exchange credit. Cannot directly reference replacement outbound lines as original `sale_items`. |
| `server/src/repositories/pos.repository.js`; `services/pos-quotes.js` | Product-price authority, Manila FEFO, signed review, atomic stock, cash and closed-attempt recovery patterns | Current POS creates an ordinary sale and cash payment. Reuse transaction-safe helpers, not a fabricated fully paid sale for replacement value. |
| `server/src/repositories/auth.repository.js`; auth/CSRF middleware | Active actor/role checks, advisory-lock convention, atomic audit | Staff role is not clinical authorization; recheck after locks and session changes. |
| `services/local-benefit-calculation.js`; `repositories/local-benefits.repository.js` | BigInt cents, logical-line/FEFO allocation, immutable v2 snapshots, test-only policy/evidence and document verification | Existing prescription fills and sale-specific triggers reference `sales`; exchange fills/adjustments need explicit compatible design. Production policy remains unavailable. |
| `repositories/reports.repository.js`; `services/report-exports.js`; `routes/reports.routes.js` | Reconciled cash-sale cohort, immutable supported benefit totals, server filters, Admin exports, formula escaping and PII allowlists | No exchange cohort, extra-cash ledger or approved tax/revenue/COGS adjustment model. Existing estimates do not establish historical exchange margins. |
| `client/src/pages/ControlledWorkflows.jsx`; `workflows/WorkflowDetails.jsx`; `pages/Approvals.jsx` | Returns search, details, quarantine actions, actionable queue/history and gated states | No replacement selector, settlement review, chain-return handling or exchange history. |
| `client/src/pages/Pos.jsx`; `workflows/BenefitCheckout.jsx` | Product search/cart patterns, cash summary, protected beneficiary form and transaction confirmation | Do not route exchange posting through ordinary checkout or advertise an internal confirmation as a fiscal invoice. |

### Schema findings

The original 15-table SQL/ERDs contain no exchange entity. `payments.sale_id` is mandatory. Existing 003 ties `sale_returns` to an actual `(sale_id, sale_item_id)`; 007 adds protected decisions; 008 adds physical receipt, pharmacist authorizations and dispositions. 009 supplies financial snapshots; 011 adds **local/test-only** effective benefit evidence and immutable v2 reconciliation. 010 is independent notification design and remains unapplied under the supplied baseline.

Original 001/002/004 and all existing migration files remain untouched. A new provisional **012** specification is contained only in the companion Markdown; no SQL file is produced. A complete design needs an additive replacement-return source because an outbound exchange item is not an ordinary `sale_item`. Relaxing the original FK or inserting a fictional sale would weaken traceability.

## 5. Reporting and accounting boundaries

Report three independent movements: original paid sale history; actual replacement outbound quantities/value; actual additional cash collected. Also expose physically received/quarantined/disposed units and approved/posted claim quantities without joining them into multiplied totals. Financial consideration applied from a return is not itself new cash, a registered credit note, a revenue reversal or a reusable store balance.

The specification also proposes an evidence-only external-remedy terminal record for independently verified lawful resolutions. It must consume the exact resolved source units so they cannot later be exchanged again, without pretending that the app issued cash, stock or tax documents. This reconciliation safeguard is not an implemented refund feature or an approved privilege; it remains blocked pending the owner/legal/accountant procedure.

Keep original ordinary/discounted paid-sales rankings comparable. Present replacement units separately, with an explicitly labeled combined outbound view if approved. A returned original unit and a replacement outbound unit are not two new paid sales. Distinguish original gross/discount/VAT records from new replacement records; never reprice either from current metadata. Cash collected is not accounting net revenue or taxable turnover. Exchange tax schedules and estimated margins remain unavailable where their documentary/cost basis is unapproved or unknown.

Excel/PDF and screen filters must use the same posted-exchange cohort and decimal components. Additional-cash totals must reconcile to their settlement ledger; source-sale totals remain reconciled to existing payments. Do not subtract a return merely because it exists. A future fiscal document pair needs accountant-approved original reference, amount, tax, date/period, numbering and replacement treatment; no tax journal is designed by inference.

## 6. Remaining decisions and verdict

The [checklist](BATCH12_EXCHANGE_VALIDATION_CHECKLIST.md) assigns owners to remedy exceptions, valuation, lower-value settlement, discounted replacements, prescriptions, professional staffing, physical medicine handling, historical sources, accounting documents, report definitions, privacy, migration and acceptance.

**Ready for project-owner/pharmacist/accountant/legal review of a concrete design. Not ready for exchange implementation approval or production activation.** Equal-value and higher-value voluntary scenarios can be implemented locally after their proposed rules are expressly approved. Statutory, lower-value and discounted cases need their specified policy/evidence closure; unsupported cases must remain controlled unavailable with an effective human remedy path. No software limitation is represented as limiting consumer rights.

Batch 11's **122 frontend tests, 209 backend reported entries and separate 17 + 9 Chrome journey groups** are historical baseline evidence, not fresh Batch 12 results. No regression, browser, database test or migration was run for these documentation-only changes. Documentation links, unchanged tracked files and protected migration hashes were checked; the checklist records a separate bounded in-memory arithmetic sanity check, not implemented workflow acceptance. No production Neon connection or mutation occurred.
