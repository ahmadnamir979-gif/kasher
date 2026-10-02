# العرّاب (Al-Arraab) — PRD

## Problem Statement
A comprehensive Arabic POS + Accounting SaaS for supermarkets, inspired by Al-Arabi.
Multi-tenant (Super Admin + Shop Owners/Cashiers), offline-first, with complex
inventory, AI assistance, Excel migration, Stripe renewals, WhatsApp receipts,
and an Electron desktop wrapper.

## Users
- Super Admin — manages shops, subscriptions.
- Shop Owner — full access to shop data, accounting, reports.
- Cashier / Accountant / Manager (role-based).

## Current State (Feb 2026)

### Core
- Auth (JWT), multi-tenant shop isolation.
- POS (offline queueing), Sales, Purchases, Customers, Suppliers, Warehouses.
- Transfers, Barcode labels, Shifts, Expenses, Employees.
- Products with: name, barcode, category, warehouse, **supplier**, cost/sale/**wholesale** prices,
  stock, min_stock, unit, tax, **location**, expiry.
- Purchases with: discount, **extra_charges**, **payment_method** (cash/card/credit), returns.

### Accounting (P0 + P1)
- Chart of Accounts, Journal entries, Ledger, Vouchers (receipt/payment).
- Banks & Checks, Fixed Assets, Cost Centers, Currencies.
- VAT report, Financial reports (Trial balance, P&L), Closed periods.
- Pricing tiers, Installments, Orders, Manufacturing formulas, Expiry alerts.
- **Customer/Supplier statements** with running balance.
- **Customer payment collection** + **Supplier payment** (updates balances).
- **Balance Sheet** (assets / liabilities / equity).
- **Cashbox** (cash + bank balance, movements).

### Inventory
- Numbering rules, bulk price adjustments, inventory adjustments, alternatives.
- Excel import/export + Excel Live sync (Power Query).
- **Product movement (Kardex)** — per-product in/out log with running balance.
- **Dead stock** report (no sales in X days).

### Reports (Enhanced)
- Daily sales, Top products, Sales by cashier, Sales by category,
  Purchases summary by supplier, Profit & Loss.
- Dashboard KPIs.

### AI
- AI Assistant chat (GPT-4o-mini via Emergent Universal Key).
- Proactive smart insights (low cash, out of stock, returned checks).

### Integrations
- Stripe (subscription renewal) — pre-injected test key.
- Emergent LLM key — AI Assistant.
- MongoDB (local preview).
- Electron desktop wrapper (silent printing).

### UI
- Classic Al-Arabi-style sidebar (gradient blue + gold accents).
- RTL Arabic throughout.
- Shadcn UI components + TailwindCSS.

## Backlog (P1 / P2)
- Twilio WhatsApp **automated** daily alerts (playbook fetched; integration pending).
- MongoDB Atlas production migration.
- Scanner archiving (الأرشفة الإلكترونية).
- RFID / check reader integration.
- Gas pump integration.
- Multi-language reports (EN / HE).
- Promotions & special pricing offers UI.
- Dedicated near-expiry report page (data exists in `/expiry/near`).

## Test Credentials
See `/app/memory/test_credentials.md`.

## Known Issues
- Testing agent not yet run after latest additions (reports module, new UIs).
