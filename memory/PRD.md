# PRD — L&R Accelerator (Leakage & Recovery)

## Original problem statement
"I have this leakage and recovery webapp built already "https://recovery.iksulalive.com/". I am attaching it's github repo/code zip as well. Want i want is that this was just a start and basic version of it basically for demo and planning. I want to scale this product now. It is a leakage and recovery accelerator which I want to build for finance and CFOs or accounting teams of organizations. It should help those team to find their financial leakages and be able to recover it as well. For example if the company is an amazon vendor and they are selling their product on amazon so amazon does cut some commission or fees to be on platform as well as from the profit margin of the product. The fee can be fixed or dynamic doesnt matter but what I want is that if someday amazon deducts extra fees from what was signed in the contract or TnC they this platform should detect and highlight that. It should be able to also help the teams to recover it by maybe drafting and able to send mails to the amazon team from this platform it self. If a junior account is accessing this platform and he sees this leakage and he/she does not have the authority to escalte this then that user should be able to assign this issue to a higher authority such as a senior memeber of finance team. So there must be user based controls and access. So look at the githud code and current live version think and research on this thoroughly and then build an amazing finished version of this leakage and recovery platform with a better and improved UI/UX too. See and cover all the scenarios that we can build and provide to users from this platform"

Follow-up (2026-10-23): "The UI should look like a modern accelerator product and also not a dark theme please. Also add some more ways to find these leakages ... b2b ... vendor only pays some or partial amount then the pending amount needs to be detected ... look broader ... not just partners"

User choices: Email/password login (Emergent-managed Clerk), Emergent managed email (Resend), Claude Opus 5.5, CSV/Excel upload + sample data, roles Analyst, Approver, Assurance, Rule Author, Admin, Viewer/CFO. Owner/admin emails: ronaklodhaps110@gmail.com, ronak.l@iksula.com.

## Architecture
- FastAPI + MongoDB: core.py (roles/caps, Clerk member, pending→admin re-check, audit, notify), engine.py (10 deterministic evaluators + duplicates), services.py (detection, ingest, email), routes_*.py, seed.py (idempotent per-counterparty sample seed tracked in settings doc "seed"; samples flagged sample:true).
- React: light "modern accelerator" theme (Outfit/Manrope/JetBrains Mono, emerald primary), utility classes .btn-*, .field, .panel, .th/.tr in index.css.
- AI: claude-opus-5-5 (claim/collection email draft SSE, Copilot SSE, contract term extraction).

## Personas
Analyst, Approver, Assurance, Rule Author, Viewer/CFO (read + approve/dismiss), Admin. New sign-ups = Pending.

## Implemented
- 2026-10-23: Core platform — truth layer rules (versioned), detection, CSV/XLSX ingest, case workflow (escalate/assign/approve/dual control/send claim/follow-up/recovery/deny/write-off/reopen), AI drafts, comments, audit, notifications, dashboard, pipeline, assurance, copilot, admin.
- 2026-10-23: Pending-access fix (owner emails, Check again promotes, sign-out button).
- 2026-10-23: Light redesign of all screens + Scenario Library page; 5 new scenarios: B2B receivables (short payment, unpaid overdue after 30d grace, unearned early-pay discount, late interest on late/outstanding amounts), AP overpayments & duplicate payments, SaaS seat/price overbilling, payment processing fees, royalty underpayment (incl. minimum guarantee); sample customers/vendors/processor/licensee.
- 2026-10-23: User preferred the original design; restored the original layout and styling (sharp corners, mono labels, grid texture, left-bar nav, ticker landing) in LIGHT mode. Features unchanged.

## Backlog
- P1: Scheduled reminders for expiring windows / overdue receivables (cron); AR aging buckets view; PDF evidence pack
- P1: Live connectors (Amazon SP-API, ERP/AR ledger, bank feeds)
- P2: shadcn date picker in rule editor; instalment-aware AP matching; bulk ingestion writes; multi-currency; multi-tenant

## Next tasks
- Replace example.com dispute/AP contact emails with real ones
