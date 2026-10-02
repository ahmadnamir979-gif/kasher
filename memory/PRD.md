# العرّاب (Al-Arraab) — PRD

Arabic POS + Accounting SaaS for supermarkets. Multi-tenant, offline-first.

## Current State (Feb 2026)

### Dashboard
Customizable 16-module launcher (localStorage) + KPIs + charts.

### POS
Offline-first; barcode (incl. scale EAN-13); search; mixed payments;
auto-apply promotions; Customer Display window with beep + yellow flash.

### Customers
Full CRUD page (name/phone/address/email/opening_balance) with search,
**pencil edit icon**, trash delete, FileText → statement, 3 KPI cards.

### Suppliers
Full CRUD page identical structure, **pencil edit icon**, trash delete,
FileText → statement, 3 KPI cards. New `PATCH /api/suppliers/{id}`.

### Debts (Reminders)
Already full: debtors cards with pencil edit, add debtor, reminders with
repeat/WhatsApp.

### Employees
Full form: name, phone, position, hire_date, salary_type (monthly/daily/
hourly), salary_amount, role, active. Pencil edit, loans dialog
(amount/reason/date).

### Payroll Report (NEW)
`/api/reports/payroll?days=N` computes gross by salary_type × days −
loans in the period = net. Period picker 7/15/30/90, print, 3 KPIs
(gross/loans/net).

### Statements
Customer/Supplier statements with **date-from/date-to filter**, period
totals, print.

### Reports / Accounting / Inventory
As before (balance-sheet, daily/top/by-cashier/by-category, Kardex,
dead-stock, cashbox).

### Audit Log · Promotions · Loyalty · Shifts · Backup

## Backlog
- Multiple units per product.
- Twilio automated WhatsApp.
- ESL · RFID · Check reader.
- Price change history view on product detail.
- MongoDB Atlas production migration.
- Advertisement slideshow on Customer Display when idle.
- Loss/anomaly detection (unusual voids / price changes).

## Test Credentials
See `/app/memory/test_credentials.md`.
