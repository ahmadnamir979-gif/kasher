# العرّاب (Al-Arraab) — PRD

## Problem Statement
Arabic POS + Accounting SaaS for supermarkets. Multi-tenant, offline-first,
full accounting, inventory, promotions, loyalty, AI assistance, Electron wrapper.

## Users
Super Admin · Shop Owner · Cashier · Accountant · Manager.

## Current State (Feb 2026)

### Universal Search
`<SearchSelect />` component replaces every lookup dropdown across the app
(products, suppliers, customers, warehouses, categories, roles, payment
methods, promotion types). Keyboard navigation, Arabic placeholder, result
count, X to clear, Escape to close.

### Dashboard
Clickable KPI grid (14 cards): Today/Yesterday sales, profit, invoice count &
avg, customers, debts, cash-in-drawer, cash/card today, purchases today,
low-stock, near-expiry, alerts. 14-day sales chart, MoM comparison,
Top 10 products this month, Least active products.

### POS
Offline-first, barcode + search + quick-add, **scale barcode support**
(EAN-13 prefix 2 → auto weight parse), mixed payments, discounts, held
invoices, returns.

### Sales & Customers
Sales list + returns, customer CRUD, statement + payment collection, debt
reminders, installments, **promotions engine** (percent/fixed/BOGO/bundle
with date/time/day constraints), **loyalty points** (earn, redeem, tiers),
pricing tiers.

### Purchases & Suppliers
Purchases with payment_method/discount/extra_charges/returns, orders,
supplier CRUD, statement + payment to supplier.

### Inventory
Products with full fields (wholesale price, supplier, location). Numbering
rules, bulk price, alternatives, adjustments, warehouses, transfers,
**product movement (Kardex)**, **dead stock**, expiry alerts, barcode labels,
manufacturing.

### Accounting
Chart of Accounts, Journal, Ledger, Vouchers, **Cashbox**, Banks & Checks,
Fixed Assets, Cost Centers, Currencies, Closed Periods.

### Reports (own section)
Reports center (daily, top products, by category, by cashier, purchases, P&L),
Financial reports, **Balance Sheet**, VAT, Excel Live.

### Admin
Employees & roles, Expenses, Shifts, **Audit Log**.

### System
Settings, Migration, Backup.

### AI
Chat assistant + proactive insights.

### Integrations
Stripe test key · Emergent Universal LLM Key · MongoDB · Electron.

## Backlog (P1 / P2)
- Twilio automated WhatsApp daily alerts.
- Multiple units per product (crate ↔ piece).
- Customer Display screen.
- ESL integration · RFID · Check reader.
- Granular per-button permissions UI.
- Price change history view.
- MongoDB Atlas production migration.

## Test Credentials
See `/app/memory/test_credentials.md`.
