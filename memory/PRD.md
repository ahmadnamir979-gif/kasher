# العرّاب (Al-Arraab) — PRD

## Problem Statement
Arabic POS + Accounting SaaS for supermarkets, inspired by Al-Arabi. Multi-tenant
(Super Admin + Shop Owners/Cashiers), offline-first, with full accounting,
inventory, promotions, loyalty, AI assistance, and Electron desktop wrapper.

## Users
Super Admin · Shop Owner · Cashier · Accountant · Manager.

## Current State (Feb 2026)

### Dashboard
Clickable KPI grid: Today/Yesterday sales, Today profit & invoice count,
customers count, debts, cash-in-drawer, cash/card sales today, purchases today,
low-stock count, near-expiry count, important alerts. 14-day sales chart,
month-over-month comparison, Top 10 products this month, least active products.

### POS
- Offline-first (sync queue).
- Barcode scan + search by name/code + quick-add unknown barcode.
- **Scale barcode support** (EAN-13 prefix 2, 5-digit code + 5-digit grams).
- Multiple payment methods (cash/card/credit/mixed).
- Discounts, held invoices, returns, held/resumed carts.

### Sales & Customers
Sales list + returns, customer CRUD, **statement + payment collection**,
debt reminders, installments, **promotions engine** (percent / fixed / BOGO
/ bundle, with date / time / day-of-week constraints), **loyalty points**
(earn per currency, redeem, tiers Silver/Gold/VIP), pricing tiers.

### Purchases & Suppliers
Purchases with payment_method, discount, extra_charges, returns.
Supplier CRUD + **statement + payment to supplier**, orders.

### Inventory
Products with name, barcode, category, warehouse, **supplier**,
cost/sale/**wholesale** price, stock, min_stock, unit, tax, **location**,
expiry. Numbering rules, bulk price edit, alternatives, adjustments,
warehouses, transfers, **product movement (Kardex)**, **dead stock**,
expiry alerts, barcode labels, manufacturing.

### Accounting
Chart of Accounts, Journal, Ledger, Vouchers, Cashbox, Banks & Checks,
Fixed Assets, Cost Centers, Currencies, Closed Periods.

### Reports (own section)
Reports center with tabs (daily sales, top products, by category, by cashier,
purchases summary, P&L), Financial reports, **Balance Sheet**, VAT, Excel Live.

### Admin
Employees & permissions, Expenses, Shifts, **Audit Log** (price changes,
promo CRUD, invoice voids, etc.).

### System
Settings, Migration from legacy systems, Backup.

### AI
Chat assistant + proactive smart insights (low cash, out of stock,
returned checks).

### Integrations
Stripe (test key injected) · Emergent Universal LLM Key · MongoDB · Electron.

## Backlog (P1 / P2)
- Twilio WhatsApp automated daily alerts (playbook fetched).
- Multiple units per product (crate ↔ piece conversion).
- Customer Display screen (secondary monitor).
- ESL (Electronic Shelf Labels) integration.
- RFID / check reader integrations.
- Granular per-button permissions UI.
- Price change history view on product detail.
- MongoDB Atlas production migration.

## Test Credentials
See `/app/memory/test_credentials.md`.
