# SunPower Frontend - Solar CRM (Phase 1)

Frontend client for the Hackathon Phase 1 pipeline:
**Lead → Qualify → Survey → Approval → Quote**

Built with **React + Vite + Tailwind CSS + React Router + Axios**.

---

## ⚡ Quick Start

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

---

## 👥 Demo Logins & Roles

The login screen includes **1-click quick-fill buttons** for testing and judging:

| Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@sunpower.com` | `password123` | Full CRM access, Review & Approve/Reject Surveys |
| **Sales Staff** | `staff@sunpower.com` | `password123` | Lead Inbox, Qualify Leads, Schedule Surveys, Generate Quotes |
| **Technician** | `tech@sunpower.com` | `password123` | Mobile Field Survey Portal, Photo Uploads, Feasibility Reports |

---

## 🔄 Live Backend vs Offline Mock Mode (Person A & B Sync)

In the top right navigation bar, there is a **toggle button**:
- **Mock DB (Offline Demo)**: Works 100% standalone out-of-the-box with persistent seed data (users, products, 10 package templates, sample leads across all lifecycle stages).
- **Live Backend (PostgreSQL)**: Sends actual HTTP requests to Person A's Express server at `http://localhost:5000/api` with Bearer JWT tokens attached.

You can toggle between them instantly without restarting the server!

---

## 🚀 Features Implemented (Person B Deliverables)

- **B1 (API & Contract)**: Axios client configured with Bearer token interceptor, standard `{ success, data }` response envelope, and mock data matching `02_seed.sql`.
- **B2 (Authentication & RBAC)**: AuthContext with JWT storage, role-based route guards (`admin`, `staff`, `technician`), and role-based redirects.
- **B3 (Public Customer Enquiry)**: Accessible at `/enquiry`. Instant system kW calculator from monthly electricity bill, address validation, and auto-assignment to sales staff.
- **B4 (Lead Inbox)**: Accessible at `/leads`. Search by customer/phone/city, status filter pills, high-level metrics cards, and manual lead creation modal.
- **B5 (Lead Detail Dossier)**: Accessible at `/leads/:id`.
  - Visual 7-step pipeline stepper.
  - Customer site parameters and qualification data.
  - Activity audit timeline with timestamps and actors.
  - **Qualify Lead modal** (capacity estimation).
  - **Schedule Survey modal** (fetches technicians from `/api/users?role=TECHNICIAN`).
  - **Review Survey modal** (displays photos and technical findings; Admin approves to `SURVEY_APPROVED` or rejects back to `QUALIFIED`).
- **B6 (Technician Field App)**: Accessible at `/surveys`. Mobile-optimized view of assigned surveys, one-tap calling, and comprehensive site feasibility form with multiple photo upload previews.
- **B7 (Quotation & Automated BOM)**: Accessible at `/leads/:id/quote` and `/quotes/:id`.
  - Enforces **Survey Gate** (HTTP 409 unless `SURVEY_APPROVED`).
  - Selects from 10 package templates (1–5 kW On/Off-Grid).
  - Automatically generates line-item Bill of Materials (BOM) with quantities and prices.
  - Interactive discount slider, 18% GST calculation, and grand total.
  - Printable official Solar Proposal with PDF export and Accept/Reject buttons.
