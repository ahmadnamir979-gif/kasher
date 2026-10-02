# العرّاب (Al-Arraab) — PRD

Arabic POS + Accounting SaaS for supermarkets. Multi-tenant, offline-first,
full accounting, inventory, promotions, loyalty, AI assistance, Electron wrapper.

## Users
Super Admin · Shop Owner · Cashier · Accountant · Manager.

## Current State (Feb 2026)

### Dashboard
- **Customizable module launcher**: 16 colored module cards; owner picks which are
  visible via "خصّص الوحدات" modal, saved in localStorage.
- Clickable KPI grid (today, yesterday, month, cash in drawer, debts, etc.),
  14-day sales chart, MoM comparison, Top 10 / Least active products.

### Universal Search
`<SearchSelect />` component replaces every lookup dropdown across the app
(products, suppliers, customers, warehouses, categories, roles, promo types).

### POS
Offline-first; barcode + search + quick-add; **scale barcode support**;
mixed payments; discounts; held invoices; returns; **auto-apply promotions**
(debounced /promotions/apply with banner); opens Customer Display window.

### Customer Display (`/customer-display`)
Separate windowed screen for the shopper. **Beep sound + yellow screen flash**
on every scan. Shows last item hero, full cart list, applied promotions,
totals strip. Realtime via BroadcastChannel.

### Sales & Customers
Sales list + returns, customer CRUD, **statement with date-range filter + print**,
payment collection, debt reminders, installments, **promotions engine**
(percent/fixed/BOGO/bundle + date/time/day constraints), loyalty points.

### Purchases & Suppliers
Purchases with payment_method/discount/extra_charges/returns, orders, supplier
CRUD, **statement with date-range filter + print**, payment to supplier.

### Inventory
Products with full fields (wholesale price, supplier, location). Numbering,
bulk price, alternatives, adjustments, warehouses, transfers, Kardex, dead
stock, expiry alerts, barcode labels, manufacturing.

### Accounting
Chart of Accounts, Journal, Ledger, Vouchers, Cashbox, Banks & Checks,
Fixed Assets, Cost Centers, Currencies, Closed Periods.

### Reports (own section)
Daily sales, Top products, By category, By cashier, Purchases, P&L,
Balance Sheet, VAT, Excel Live.

### Admin
- **Employees (new)**: name, phone, position, hire_date, salary_type
  (monthly/daily/hourly), salary_amount, role, active. Edit action, **loans
  (سلف) dialog** per employee with amount/reason/date.
- Expenses with user-chosen date.
- Shifts.
- Audit Log.

### System
Settings (printer, backup, desktop installer), Migration.

### AI
Chat assistant + proactive insights.

### Integrations
Stripe test key · Emergent Universal LLM Key · MongoDB · Electron.

## Backlog
- Multiple units per product (crate ↔ piece).
- Twilio automated WhatsApp daily alerts.
- ESL · RFID · Check reader integrations.
- Granular per-button permissions UI.
- Price change history view.
- MongoDB Atlas production migration.
- Advertisement slideshow on Customer Display when idle.

## Test Credentials
See `/app/memory/test_credentials.md`.
