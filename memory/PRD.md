# PRD — L&R Accelerator (Leakage & Recovery)

## Original problem statement
"I have this leakage and recovery webapp built already "https://recovery.iksulalive.com/". I am attaching it's github repo/code zip as well. Want i want is that this was just a start and basic version of it basically for demo and planning. I want to scale this product now. It is a leakage and recovery accelerator which I want to build for finance and CFOs or accounting teams of organizations. It should help those team to find their financial leakages and be able to recover it as well. For example if the company is an amazon vendor and they are selling their product on amazon so amazon does cut some commission or fees to be on platform as well as from the profit margin of the product. The fee can be fixed or dynamic doesnt matter but what I want is that if someday amazon deducts extra fees from what was signed in the contract or TnC they this platform should detect and highlight that. It should be able to also help the teams to recover it by maybe drafting and able to send mails to the amazon team from this platform it self. If a junior account is accessing this platform and he sees this leakage and he/she does not have the authority to escalte this then that user should be able to assign this issue to a higher authority such as a senior memeber of finance team. So there must be user based controls and access. So look at the githud code and current live version think and research on this thoroughly and then build an amazing finished version of this leakage and recovery platform with a better and improved UI/UX too. See and cover all the scenarios that we can build and provide to users from this platform"

User choices: Email/password login (Emergent-managed Clerk), Emergent managed email (Resend), Claude Opus 5.5, CSV/Excel upload + sample data, roles Analyst, Approver, Assurance, Rule Author, Admin, Viewer/CFO.

## Architecture
- FastAPI + MongoDB backend: core.py (roles/caps, Clerk member, audit, notify), engine.py (deterministic detection for 5 domains + duplicates), services.py (detection run, ingest, Emergent email), routes_cases/data/admin/ai.py, seed.py (sample data, flagged `sample: true`).
- React (CRA) frontend, dark "obsidian/emerald" design, Clerk <SignIn/>/<SignUp/>.
- AI: claude-opus-5-5 via emergentintegrations (claim draft SSE, Copilot SSE, contract term extraction).

## Personas
Analyst (junior), Approver (senior), Assurance reviewer, Rule Author, Viewer/CFO (read + approve), Admin. New sign-ups = Pending (no access).

## Implemented (2026-10-23)
- Truth layer: versioned contract rules (draft → publish → retire), effective dating, AI extract terms from pasted contract text
- Detection: Marketplace fees (Amazon referral/FBA/closing), Retail OTIF deductions, Supplier price variance, Rebate tiers, Freight rate card, duplicate billing; confidence, severity, dispute window
- CSV/XLSX ingest with templates, dedupe on re-upload, auto-detect
- Case workflow: review, escalate/assign (in-app + email notification), approve (dual control ≥ threshold needs Assurance), dismiss, send claim / follow-up email, record (partial) recovery, denied, write-off, reopen
- AI-drafted recovery emails (streaming, editable), comments, audit trail, notifications bell
- Control Tower dashboard, Leakages table + CSV export, Recovery pipeline kanban, Assurance page, Copilot, Audit log, Admin (roles, counterparties, settings, remove sample data)

## Backlog
- P1: Scheduled reminders for expiring dispute windows / follow-ups (cron); PDF evidence pack export; bulk actions
- P1: Live Amazon SP-API / ERP connectors
- P2: Bulk-write ingestion for very large files; inbound email reply tracking; multi-currency FX; multi-tenant orgs

## Next tasks
- Replace placeholder counterparty dispute emails (example.com) with real ones
