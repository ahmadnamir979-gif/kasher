# العرّاب (Al-Arraab) — PRD

Arabic POS + Accounting SaaS. Multi-tenant, offline-first.

## Current State (Feb 2026)

### Customers (updated)
3 KPI cards + search + columns: name/phone/address/**opening_balance/current_balance** +
actions: **سداد (payment)**, statement, pencil edit, delete.

### Suppliers (updated)
Same structure as Customers + **تسديد (payment)** action +
opening_balance + current_balance columns.

### Reminders / Debts (updated)
"Add debtor" dialog now has a **dropdown of existing customers** at top so
the debts page is **linked** to the Customers page — no manual retyping.

### Payroll (upgraded)
- Report: gross by salary_type × days − **unsettled loans** = net
- **Pay action per row** → confirmation dialog showing gross/loans/net breakdown
- `POST /api/payroll/pay` → (1) marks all unsettled loans as settled,
  (2) creates a payroll_payments record, (3) auto-registers an expense
  in cashbox/accounting with category `راتب — {name}`
- **Payment history dialog** + **PDF export** (via browser print)
- Loans now have `settled` flag so paid loans don't double-count

### Dashboard · POS · CustomerDisplay · Inventory · Accounting · Reports
As before.

## Backlog
- Scale barcode (done) · Multiple units per product
- Twilio automated WhatsApp
- ESL · RFID
- Price change history view
- MongoDB Atlas production migration
- Loss/anomaly detection

## Test Credentials
See `/app/memory/test_credentials.md`.
