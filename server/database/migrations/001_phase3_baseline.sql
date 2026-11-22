-- TGP Lawang Bato - Inventory and Sales Management System
-- schema for our branch app + owner dashboard (PostgreSQL)
-- based on our Phase 2 ERD, checked against the Phase 1 docs
-- ids are given by the app, not auto-increment

-- staff accounts. roles: admin = owner/pharmacist, manager = pharmacist,
-- employee = pharmacy assistant. individual logins are required so every
-- transaction can be traced to a specific person (the old shared logbook
-- had no accountability). deactivated accounts stay in the table so
-- transaction history is never orphaned.
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL, -- hash only, never plain text
    full_name VARCHAR,
    role VARCHAR NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
    status VARCHAR -- active / inactive
);

-- audit trail. logs every important action (who, what, when)
CREATE TABLE activity_logs (
    log_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    action VARCHAR,
    module VARCHAR, -- POS, stock-in, approvals, etc
    logged_at TIMESTAMP
);

-- branch suppliers. deliveries happen only when a shipment arrives, not daily
CREATE TABLE suppliers (
    supplier_id INTEGER PRIMARY KEY,
    name VARCHAR,
    contact_no VARCHAR,
    address VARCHAR
);

-- the catalog, around 1,500 items (generic + branded + OTC).
-- category is just an attribute here, no separate categories table (none in
-- the ERD). no barcode column on purpose - no scanner at the branch, the POS
-- is manual search
CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    name VARCHAR,
    generic_name VARCHAR, -- POS also searches by generic name
    category VARCHAR, -- category names still to be confirmed with the client
    unit_price NUMERIC,
    reorder_level INTEGER -- low stock alert threshold, set by admin
);

-- batch level inventory. this is the biggest fix vs the index card system.
-- one row = one physical batch, with its own expiry date and cost.
-- created by stock-in, deducted by sales, restored by approved returns.
-- FEFO: always sell the batch with the earliest expiry_date that still has stock
CREATE TABLE batches (
    batch_id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    batch_no VARCHAR,
    expiry_date DATE,
    qty_on_hand INTEGER,
    cost_price NUMERIC, -- buying cost from the supplier
    selling_price NUMERIC
);

-- purchase order to a supplier (this is NOT a customer order). manager
-- creates it, manager/admin approves. pending -> approved -> received
CREATE TABLE purchase_orders (
    po_id INTEGER PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
    created_by INTEGER NOT NULL REFERENCES users(user_id),
    approved_by INTEGER REFERENCES users(user_id), -- null = still pending
    order_date TIMESTAMP,
    status VARCHAR
);

-- the products inside one PO. separate table because it's one-to-many
-- (one order, many items), so supplier/approval info is written only once
CREATE TABLE purchase_order_items (
    po_item_id INTEGER PRIMARY KEY,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(po_id),
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    quantity INTEGER,
    unit_cost NUMERIC
);

-- one row = one delivery received. the assistant receives/inspects the
-- boxes, manager/admin approves the entry. delivery_ref points to the
-- supplier's delivery paper/waybill so past shipment costs are searchable
-- (impossible with the old logbooks)
CREATE TABLE stock_ins (
    stock_in_id INTEGER PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(supplier_id),
    received_by INTEGER NOT NULL REFERENCES users(user_id),
    approved_by INTEGER REFERENCES users(user_id),
    delivery_ref VARCHAR,
    date_received TIMESTAMP
);

-- each delivery line becomes one batch. this is what creates the batch
-- record (qty, cost, expiry) based on the stock-in
CREATE TABLE stock_in_items (
    item_id INTEGER PRIMARY KEY,
    stock_in_id INTEGER NOT NULL REFERENCES stock_ins(stock_in_id),
    batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
    quantity INTEGER,
    unit_cost NUMERIC
);

-- discount rules, ex. senior/pwd 20%. admin sets these
-- (used to be manual calculator + a separate logbook)
CREATE TABLE discounts (
    discount_id INTEGER PRIMARY KEY,
    type VARCHAR, -- senior / pwd
    rate NUMERIC -- 0.20
);

-- one row = one POS transaction.
-- user_id = the cashier who processed it, approved_by = who reviewed it
-- (null = pending, not counted in owner reports until approved)
-- discount_id + senior_pwd_id + vat_exempt = the senior/pwd discount record
CREATE TABLE sales (
    sale_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    discount_id INTEGER REFERENCES discounts(discount_id), -- null = regular sale
    receipt_no VARCHAR,
    sale_date TIMESTAMP,
    total_amount NUMERIC, -- final amount after discount
    approved_by INTEGER REFERENCES users(user_id),
    senior_pwd_id VARCHAR, -- ID presented at the counter
    vat_exempt BOOLEAN
);

-- what was sold and which batch it came from (this carries FEFO and profit:
-- unit_price minus the batch cost_price = margin)
CREATE TABLE sale_items (
    sale_item_id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(sale_id),
    batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
    quantity INTEGER, -- sale is blocked if the batch has insufficient stock
    unit_price NUMERIC -- selling price at the time of sale
);

-- payment. cash only for the MVP (no card reader at the branch),
-- includes the change computation
CREATE TABLE payments (
    payment_id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(sale_id),
    method VARCHAR, -- 'cash'
    amount_paid NUMERIC,
    change_due NUMERIC
);

-- stock corrections (damage, expired pull-out, recount discrepancy).
-- a reason is required, and it needs approval because none of this was
-- tracked before - anyone could change stock without a trace
CREATE TABLE stock_adjustments (
    adjustment_id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES batches(batch_id),
    adjusted_by INTEGER NOT NULL REFERENCES users(user_id),
    approved_by INTEGER REFERENCES users(user_id),
    quantity INTEGER, -- positive = add, negative = deduct
    reason VARCHAR,
    adjustment_date TIMESTAMP
);

-- customer returns, linked to the actual sale (not just the product)
-- so we know which receipt it came from. an approved return adds the
-- quantity back to the batch it was sold from
CREATE TABLE sale_returns (
    return_id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(sale_id),
    processed_by INTEGER NOT NULL REFERENCES users(user_id),
    approved_by INTEGER REFERENCES users(user_id),
    quantity INTEGER,
    reason VARCHAR,
    return_date DATE
);

-- notes:
-- FEFO: pick the batch with the earliest expiry_date that has stock left
-- low stock: total qty_on_hand of a product <= reorder_level
-- expiry alert: batches.expiry_date nearing or past
-- profit: (sale_items.unit_price - batch cost_price) * quantity
-- pending records (no approved_by) are excluded from owner reports
-- no customer/prescription profile here - that's only a Should Have in the
--   SRF, can be added later if there's time
