# Offline-First Registration & Payment System

## Detailed Phase-by-Phase Implementation Plan

This document outlines the complete phase-by-phase plan for building a modern offline-first registration & payment system for businesses like gyms, schools, or courses.

**Project Timeline:** 8-10 weeks
**Start Date:** October 16, 2025

---

## PHASE 0: Project Setup & Environment (Week 1, Days 1-2)

### Tasks:
1. **Initialize Project Structure**
   - Create root directory: `registration-management-system/`
   - Create subdirectories:
     ```
     backend/
     frontend/
     docs/
     tests/
     scripts/
     ```

2. **Backend Setup**
   - Initialize Python virtual environment (Python 3.12+)
   - Create `requirements.txt`:
     ```
     fastapi==0.104.1
     uvicorn[standard]==0.24.0
     sqlalchemy==2.0.23
     alembic==1.12.1
     pydantic==2.5.0
     python-multipart==0.0.6
     weasyprint==60.1
     reportlab==4.0.7
     python-dotenv==1.0.0
     pytest==7.4.3
     httpx==0.25.1
     ```
   - Create `.env.example` for configuration
   - Create `backend/main.py` with basic FastAPI app
   - Create `backend/config.py` for settings management

3. **Frontend Setup**
   - Initialize React project with Vite:
     ```bash
     npm create vite@latest frontend -- --template react
     ```
   - Install dependencies:
     ```bash
     npm install tailwindcss postcss autoprefixer
     npm install recharts react-router-dom axios
     npm install lucide-react date-fns
     ```
   - Configure Tailwind CSS
   - Setup folder structure:
     ```
     src/
       components/
       pages/
       services/
       utils/
       hooks/
       context/
     ```

4. **Version Control**
   - Initialize Git repository
   - Create `.gitignore` (Python, Node, SQLite, PDFs)
   - Create initial commit
   - Setup GitHub/GitLab repository (optional)

### Deliverables:
- ✅ Project structure created
- ✅ Backend runs with "Hello World" endpoint
- ✅ Frontend serves development page
- ✅ Git repository initialized

---

## PHASE 1: Database Architecture & Models (Week 1, Days 3-7)

### Tasks:
1. **SQLAlchemy Base Setup**
   - Create `backend/database.py`:
     - Database connection manager
     - Session factory
     - Base model class with common fields (created_at, updated_at)
   - Create `backend/models/` directory

2. **Define Core Models**
   - `models/business.py`:
     - Business entity with branding fields
     - Validation for color hex codes
   - `models/class_course.py`:
     - Class/Course/Program entity
     - Relationship to Business
   - `models/group.py`:
     - Group entity
     - Relationship to Class
   - `models/member.py`:
     - Member entity with status enum
     - Relationships to Business and Group
     - Phone/email validation
   - `models/payment.py`:
     - Payment entity with status enum
     - Auto-calculated fields
     - Relationship to Member
   - `models/receipt.py`:
     - Receipt entity
     - File path storage
   - `models/staff.py` (future-ready):
     - Staff entity with role enum
     - Password hashing setup

3. **Alembic Migration Setup**
   - Initialize Alembic: `alembic init alembic`
   - Configure `alembic.ini` for SQLite
   - Create initial migration with all tables
   - Test migration up/down

4. **Create Seed Data Script**
   - `scripts/seed_data.py`:
     - Sample business
     - 3 classes with groups
     - 20 sample members
     - 50 sample payments
   - Make it idempotent (can run multiple times)

5. **Database Utilities**
   - Create `backend/database_utils.py`:
     - Connection testing
     - Backup function skeleton
     - Foreign key enforcement

### Deliverables:
- ✅ All SQLAlchemy models defined with relationships
- ✅ Alembic migrations working
- ✅ SQLite database created with schema
- ✅ Seed data script populates test data
- ✅ Unit tests for model validation

---

## PHASE 2: Core Backend API - Part 1 (Week 2)

### Tasks:
1. **Pydantic Schemas Setup**
   - Create `backend/schemas/` directory
   - Define request/response schemas for each model:
     - `MemberCreate`, `MemberUpdate`, `MemberResponse`
     - `PaymentCreate`, `PaymentResponse`
     - `ClassCreate`, `ClassResponse`
     - `GroupCreate`, `GroupResponse`
   - Include validation rules

2. **CRUD Operations**
   - Create `backend/crud/` directory
   - Implement CRUD functions:
     - `crud/member.py`: get, get_all, create, update, delete
     - `crud/class_course.py`: get, get_all, create, update
     - `crud/group.py`: get, get_all, create, update
     - `crud/payment.py`: get, get_all, create, update

3. **API Routes - Members**
   - Create `backend/routers/members.py`:
     - `GET /api/members` with filters:
       - status (active/inactive)
       - group_id
       - class_id
       - search query (name)
       - pagination
     - `POST /api/members` (create)
     - `PUT /api/members/{id}` (update)
     - `PATCH /api/members/{id}/status` (quick status change)
     - `DELETE /api/members/{id}` (soft delete)

4. **API Routes - Classes & Groups**
   - Create `backend/routers/classes.py`:
     - `GET /api/classes` (list with groups)
     - `POST /api/classes` (create)
     - `PUT /api/classes/{id}` (update)
     - `GET /api/classes/{id}/members` (members in class)
   - Create `backend/routers/groups.py`:
     - `GET /api/groups` (list)
     - `POST /api/groups` (create under class)
     - `PUT /api/groups/{id}` (update)
     - `GET /api/groups/{id}/members` (members in group)

5. **Error Handling & Validation**
   - Create custom exception handlers
   - Add validation middleware
   - Setup logging configuration

### Deliverables:
- ✅ All CRUD operations implemented
- ✅ Member API endpoints working
- ✅ Classes & Groups API endpoints working
- ✅ Request validation working
- ✅ API tests passing (pytest)

**Progress Save – Oct 17, 2025 (morning):** Member/class/group APIs are live with structured logging, custom error handlers, soft-delete support for members, and green pytest coverage. Payment and receipt services are next.

**Progress Save – Oct 17, 2025 (evening):** Payment schemas and CRUD helpers are implemented with fresh unit coverage. Phase 2 deliverables are officially complete and the codebase is prepped to kick off Phase 3 payment services.

**Progress Save – Oct 17, 2025 (late evening):** Phase 3 foundations delivered—payment service logic, receipt templating, payment/receipt APIs, and comprehensive tests, including PDF generation stubs.

---

## PHASE 3: Payment System & Receipt Generation (Week 3)

### Tasks:
1. **Payment Business Logic**
   - Create `backend/services/payment_service.py`:
     - Calculate `next_due_date` based on payment date
     - Validate payment amounts
     - Handle payment status transitions
     - Auto-generate receipt numbers:
       - Format: `receipt-<MemberName>-<ClassName>-YYMMDD-XXXX`
       - Sequential numbering per day

2. **Receipt PDF Generation**
   - Create `backend/services/receipt_service.py`:
     - HTML template for receipt
     - WeasyPrint integration
     - Include business logo
     - Customizable branding (colors)
   - Create `backend/templates/receipt_template.html`
   - Setup receipt storage directory

3. **Payment API Routes**
   - Create `backend/routers/payments.py`:
     - `GET /api/payments` (list with filters)
     - `POST /api/payments` (record payment, generate receipt)
     - `PUT /api/payments/{id}` (update/refund)
     - `GET /api/payments/{id}/receipt` (download PDF)
     - `GET /api/payments/overdue` (overdue payments)
     - `GET /api/payments/due-today` (due today)

4. **Receipt Management**
   - Create `backend/routers/receipts.py`:
     - `GET /api/receipts` (list all)
     - `GET /api/receipts/{id}` (download specific)
     - `POST /api/receipts/{payment_id}/regenerate` (regenerate PDF)

5. **Payment Validation & Tests**
   - Test receipt number uniqueness
   - Test PDF generation with sample data
   - Test payment status calculations
   - Test due date calculations

### Deliverables:
- ✅ Payment recording working
- ✅ Receipt PDF generation working
- ✅ Receipt auto-numbering implemented
- ✅ Payment API endpoints complete
- ✅ Sample receipts generated and stored
- ✅ Unit tests for payment logic

---

## PHASE 4: Dashboard Backend & Analytics (Week 4)

### Tasks:
1. **Dashboard Data Service**
   - Create `backend/services/dashboard_service.py`:
     - Calculate active/inactive member counts
     - Calculate due today count
     - Calculate overdue count
     - Calculate overdue inactive count
     - Get recent payments
     - Get upcoming due dates

2. **Dashboard API Routes**
   - Create `backend/routers/dashboard.py`:
     - `GET /api/dashboard/widgets` (all widget data)
     - `GET /api/dashboard/alerts` (overdue/due today)
     - `GET /api/dashboard/recent-activity` (recent payments/registrations)
     - `GET /api/dashboard/quick-stats` (summary numbers)

3. **Analytics Service**
   - Create `backend/services/analytics_service.py`:
     - Revenue per month (last 12 months)
     - Revenue per year (last 5 years)
     - New members per month
     - Payment trends
     - Class/Group popularity
     - Overdue payment trends

4. **Analytics API Routes**
   - Create `backend/routers/analytics.py`:
     - `GET /api/analytics/revenue-monthly` (monthly revenue data)
     - `GET /api/analytics/revenue-yearly` (yearly revenue data)
     - `GET /api/analytics/members-growth` (new members over time)
     - `GET /api/analytics/payment-trends` (payment patterns)
     - `GET /api/analytics/export` (export to CSV)

5. **Settings Management**
   - Create `backend/routers/settings.py`:
     - `GET /api/settings` (get business settings)
     - `PUT /api/settings` (update business settings)
     - `POST /api/settings/logo` (upload logo)
     - `GET /api/settings/backup-config` (backup settings)

### Deliverables:
- ✅ Dashboard data endpoints working
- ✅ Analytics calculations accurate
- ✅ Revenue charts data available
- ✅ Settings API complete
- ✅ Alert system working

**Progress Save – Oct 17, 2025 (night):** Settings service + router landed with hex-color validation, logo upload persistence, backup-config export, and companion unit/API tests. Dashboard + analytics suites re-run (27 tests) now include settings coverage.

---

## PHASE 5: Frontend Foundation (Week 5)

### Tasks:
1. **Setup Core Frontend Architecture**
   - Create API service layer (`src/services/api.js`):
     - Axios configuration
     - Base URL management
     - Error interceptors
   - Create context providers:
     - `AuthContext` (admin login)
     - `ThemeContext` (colors, language)
     - `BusinessContext` (business settings)

2. **Routing & Navigation**
   - Setup React Router:
     - `/` - Dashboard
     - `/members` - Members list
     - `/classes` - Classes & Groups
     - `/payments` - Payments & Receipts
     - `/analytics` - Analytics page
     - `/settings` - Settings page
   - Create `Layout` component:
     - Sidebar navigation
     - Top bar with logo
     - Breadcrumbs

3. **Reusable Components**
   - Create component library:
     - `Button` (primary, secondary, danger)
     - `Card` (dashboard widgets)
     - `Table` (sortable, filterable)
     - `Modal` (confirmations, forms)
     - `Input` (text, select, date)
     - `Alert` (success, error, warning)
     - `Badge` (status indicators)
     - `LoadingSpinner`

4. **Design System**
   - Define Tailwind color scheme:
     - Primary: configurable from settings
     - Secondary: configurable
     - Success: green
     - Warning: yellow
     - Danger: red
     - Gray scale
   - Create utility classes
   - Setup responsive breakpoints

5. **State Management**
   - Setup custom hooks:
     - `useMembers` (fetch, filter, update)
     - `usePayments` (fetch, create)
     - `useDashboard` (widget data)
     - `useAnalytics` (chart data)

### Deliverables:
- ✅ Frontend routing working
- ✅ Layout with navigation complete
- ✅ Component library created
- ✅ API service layer functional
- ✅ Design system implemented

---

## PHASE 6: Dashboard & Member Management UI (Week 6)

### Tasks:
1. **Dashboard Page**
   - Create `pages/Dashboard.jsx`:
     - Widget cards:
       - Active members
       - Inactive members
       - Due today
       - Overdue payments
       - Overdue inactive
     - Quick actions section:
       - Record payment button
       - Add member button
       - Generate receipt button
     - Recent activity feed
     - Alerts popup on load (overdue/due today)

2. **Dashboard Widgets**
   - Create `components/widgets/`:
     - `MemberCountWidget.jsx`
     - `PaymentStatusWidget.jsx`
     - `QuickActionsWidget.jsx`
     - `AlertsModal.jsx`
   - Auto-refresh every hour
   - Click-through to filtered views

3. **Members List Page**
   - Create `pages/Members.jsx`:
     - Filterable table:
       - Search by name
       - Filter by status
       - Filter by group
       - Filter by class
     - Pagination
     - Bulk actions
     - Row color coding (red=overdue, gray=inactive)
   - Create `components/MemberTable.jsx`
   - Create `components/MemberFilters.jsx`

4. **Member Forms**
   - Create `components/forms/MemberForm.jsx`:
     - Add new member modal
     - Edit member modal
     - Form validation
     - Group/Class selection
   - Create `components/MemberDetails.jsx`:
     - View member details
     - Payment history
     - Quick actions

5. **Member Actions**
   - Implement quick actions:
     - Mark inactive
     - Record payment (inline)
     - Edit details
     - Delete (soft delete with confirmation)

### Deliverables:
- ✅ Dashboard page fully functional
- ✅ Widget data displaying correctly
- ✅ Members list with filters working
- ✅ Add/Edit member forms working
- ✅ Color coding implemented
- ✅ Alerts showing on dashboard load

---

## PHASE 7: Classes, Payments & Receipts UI (Week 7)

### Tasks:
1. **Classes & Groups Page**
   - Create `pages/Classes.jsx`:
     - Hierarchical view: Class → Groups → Members
     - Flat list toggle option
     - Expandable/collapsible sections
   - Create `components/ClassCard.jsx`
   - Create `components/GroupList.jsx`

2. **Class Management**
   - Create `components/forms/ClassForm.jsx`:
     - Add class modal
     - Edit class modal
     - Date pickers for start/end
   - Create `components/forms/GroupForm.jsx`:
     - Add group under class
     - Edit group

3. **Payments & Receipts Page**
   - Create `pages/Payments.jsx`:
     - Payment list with filters
     - Status badges (paid/unpaid/overdue)
     - Search by member name
     - Date range filter
   - Create `components/PaymentTable.jsx`

4. **Payment Recording**
   - Create `components/forms/PaymentForm.jsx`:
     - Record payment modal
     - Member selection (searchable dropdown)
     - Amount input
     - Payment method selection
     - Auto-calculate next due date
     - Generate receipt checkbox (default: true)
   - Success notification with receipt download link

5. **Receipt Management**
   - Create `components/ReceiptList.jsx`:
     - List all receipts
     - Download button
     - Print button
     - Regenerate option
   - Handle PDF downloads
   - Print preview option

### Deliverables:
- ✅ Classes page with hierarchy working
- ✅ Class/Group forms functional
- ✅ Payment recording working end-to-end
- ✅ Receipt generation and download working
- ✅ Payment filters implemented

---

## PHASE 8: Analytics & Settings UI (Week 8, Days 1-3)

### Tasks:
1. **Analytics Page**
   - Create `pages/Analytics.jsx`:
     - Revenue charts section
     - Member growth section
     - Payment trends section
     - Export buttons
   - Create `components/charts/`:
     - `RevenueChart.jsx` (line chart with Recharts)
     - `MemberGrowthChart.jsx` (bar chart)
     - `PaymentTrendsChart.jsx` (area chart)

2. **Chart Configuration**
   - Setup Recharts components:
     - Responsive containers
     - Tooltips
     - Legends
     - Custom colors from theme
   - Date range selectors
   - Toggle between monthly/yearly views

3. **Settings Page**
   - Create `pages/Settings.jsx`:
     - Business information section
     - Branding section (logo, colors)
     - Language selector (EN/FR)
     - Currency selector
     - Backup configuration
   - Create `components/forms/SettingsForm.jsx`

4. **Settings Features**
   - Logo upload with preview
   - Color pickers for primary/secondary
   - Live preview of changes
   - Save/Reset buttons
   - Backup folder path selector

### Deliverables:
- ✅ Analytics charts displaying correctly
- ✅ Chart data from API integrated
- ✅ Settings page functional
- ✅ Logo upload working
- ✅ Theme changes apply in real-time

---

## PHASE 9: Backup System & Data Management (Week 8, Days 4-7)

### Tasks:
1. **Backup Service**
   - Create `backend/services/backup_service.py`:
     - SQLite database backup function
     - Receipts folder backup
     - Configurable backup location
     - Timestamp-based backup naming
     - Cleanup old backups (keep last 30 days)

2. **Backup API Routes**
   - Create `backend/routers/backup.py`:
     - `POST /api/backup/manual` (trigger manual backup)
     - `GET /api/backup/list` (list available backups)
     - `POST /api/backup/restore/{backup_id}` (restore from backup)
     - `DELETE /api/backup/{backup_id}` (delete backup)
     - `GET /api/backup/status` (last backup info)

3. **Scheduled Backup**
   - Create `scripts/backup_scheduler.py`:
     - Daily automated backup (configurable time)
     - Use APScheduler or Windows Task Scheduler
     - Email notifications (optional)

4. **Backup UI**
   - Add to Settings page:
     - Manual backup button
     - Last backup timestamp
     - Backup history list
     - Restore functionality with confirmation
     - Configure backup schedule

5. **Export Functionality**
   - Create export utilities:
     - Export members to CSV
     - Export payments to CSV
     - Export analytics data
     - Bulk receipt download (ZIP)

### Deliverables:
- ✅ Backup system working
- ✅ Manual backup from UI functional
- ✅ Scheduled daily backup configured
- ✅ Restore functionality working
- ✅ Export features implemented

---

## PHASE 10: Testing & Quality Assurance (Week 9)

### Tasks:
1. **Backend Unit Tests**
   - Test all CRUD operations
   - Test payment calculations
   - Test receipt generation
   - Test next_due_date logic
   - Test validation rules
   - Target: 80%+ code coverage

2. **Backend Integration Tests**
   - Test API endpoints end-to-end
   - Test database transactions
   - Test PDF generation pipeline
   - Test backup/restore process
   - Test error handling

3. **Frontend Component Tests**
   - Test form submissions
   - Test filter logic
   - Test table sorting/pagination
   - Test API integration
   - Use React Testing Library

4. **End-to-End Testing**
   - Test complete user workflows:
     - Add member → Record payment → Generate receipt
     - View dashboard → Navigate to overdue → Record payment
     - Create class → Add groups → Assign members
     - Export data → Backup → Restore
   - Use Playwright or Cypress

5. **Manual QA Testing**
   - Create QA checklist
   - Test all UI interactions
   - Test responsive design
   - Test error scenarios
   - Browser compatibility testing

### Deliverables:
- ✅ 80%+ test coverage on backend
- ✅ All critical paths tested
- ✅ Bug tracking document
- ✅ QA sign-off checklist complete

---

## PHASE 11: Offline Packaging & Deployment (Week 10)

### Tasks:
1. **Desktop Wrapper Setup**
   - Create `scripts/start_app.py`:
     - Start FastAPI server on localhost
     - Open default browser automatically
     - Handle port conflicts
     - Graceful shutdown

2. **Windows Installer**
   - Use PyInstaller or cx_Freeze:
     - Bundle Python runtime
     - Include all dependencies
     - Include frontend build
     - Include SQLite database
   - Create installer with Inno Setup or NSIS:
     - Desktop shortcut
     - Start menu entry
     - Configurable installation directory
     - Auto-start option

3. **Configuration Management**
   - Create `config.ini` file:
     - Server port
     - Backup folder path
     - Receipt storage path
     - Database path
     - Auto-open browser setting
   - Create settings UI for configuration

4. **Production Build**
   - Optimize frontend:
     - Build production bundle
     - Minify assets
     - Optimize images
   - Optimize backend:
     - Remove debug code
     - Configure production logging

5. **Documentation**
   - Create user manual:
     - Installation guide
     - Quick start guide
     - Feature documentation
     - Troubleshooting section
   - Create admin guide:
     - Configuration options
     - Backup/restore procedures
     - Migration to online system

### Deliverables:
- ✅ Windows installer created
- ✅ Application runs offline
- ✅ Configuration management working
- ✅ User documentation complete
- ✅ Installation tested on clean machine

---

## PHASE 12: Polish & Future-Ready Features (Week 11 - Optional)

### Tasks:
1. **UI/UX Refinement**
   - Add loading states everywhere
   - Add success/error animations
   - Improve error messages
   - Add keyboard shortcuts
   - Accessibility improvements (ARIA labels)

2. **Performance Optimization**
   - Optimize database queries
   - Add database indexing
   - Implement pagination everywhere
   - Lazy loading for images
   - Debounce search inputs

3. **Staff Authentication (Future-Ready)**
   - Implement staff login system
   - Role-based access control (view/request)
   - JWT token authentication
   - Session management
   - Password reset functionality

4. **Multi-Language Support**
   - Setup i18n library (react-i18next)
   - Create translation files (EN/FR)
   - Translate all UI strings
   - Language switcher in settings
   - Date/currency formatting per locale

5. **Migration Preparation**
   - Create migration script:
     - SQLite → PostgreSQL
     - Preserve all data
     - Update relationships
   - Document online deployment process
   - Create API documentation for external tools

### Deliverables:
- ✅ Polished UI with smooth interactions
- ✅ Performance optimizations applied
- ✅ Authentication system ready
- ✅ Multi-language support working
- ✅ Migration path documented

---

## SUCCESS CRITERIA

### By End of Each Phase:
- **Phase 0:** Development environment ready, can run "Hello World"
- **Phase 1:** Database schema complete with test data
- **Phase 2:** Core CRUD APIs working and tested
- **Phase 3:** Can record payment and generate PDF receipt
- **Phase 4:** Dashboard data endpoints return accurate metrics
- **Phase 5:** Frontend navigation and components library ready
- **Phase 6:** Can view dashboard and manage members through UI
- **Phase 7:** Can manage classes and record payments through UI
- **Phase 8:** Analytics charts display and settings are editable
- **Phase 9:** Backup/restore and export features working
- **Phase 10:** All tests passing, bugs documented
- **Phase 11:** Installable offline application ready
- **Phase 12:** Polished product with future-ready features

---

## APPENDIX: Original Technical Architecture

### High-Level Architecture

**Goals:**
- Offline-first, admin-centric
- Optional online migration
- Clean modern UI, responsive, professional

**Technology Stack:**
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend API | FastAPI (Python 3.12+) | Lightweight, async-ready, auto-docs (Swagger) |
| Offline DB | SQLite | Portable, zero-config, easy migration |
| Online DB | PostgreSQL | Scalable, industry standard |
| ORM | SQLAlchemy + Alembic | Structured models, migrations, supports SQLite/Postgres |
| Frontend | React 18 + Tailwind CSS | Component-driven, responsive, modern UI |
| Dashboard Charts | Recharts | Lightweight, clean visuals |
| PDF Generation | WeasyPrint / ReportLab | Python HTML → PDF support |
| Desktop Wrapper | Local web server + browser | Simple offline deployment |
| Backup System | Python scripts | Scheduled daily backups, configurable folder |
| Optional Online | FastAPI endpoints, staff login | Future multi-branch support |

---

### Database Schema

### Entities

**Business**
- id (PK)
- name
- logo_path
- primary_color
- secondary_color
- language (EN/FR)
- currency
- created_at

**Class/Course/Program**
- id (PK)
- business_id (FK)
- name
- description
- start_date
- end_date
- grouping_type
- created_at

**Group**
- id (PK)
- class_id (FK)
- name
- description
- created_at

**Member**
- id (PK)
- first_name
- last_name
- phone_number (optional)
- email (optional)
- status (active/inactive)
- joined_at
- business_id (FK)
- group_id (FK, optional)

**Payment**
- id (PK)
- member_id (FK)
- amount
- payment_date
- next_due_date
- status (paid/unpaid/overdue)
- method (cash/other)
- receipt_number
- created_at

**Receipt**
- id (PK)
- payment_id (FK)
- file_path (PDF)
- created_at

**Staff** *(future online)*
- id
- username
- password_hash
- role (view/request)
- business_id

**Notes:** All tables have `created_at` + `updated_at` timestamps. SQLite foreign keys enabled.

---

### Backend Design (FastAPI)

### Key Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/members | GET | List all members (filters: status, group, class, search by name) |
| /api/members | POST | Add new member |
| /api/members/{id} | PUT | Update member info/status |
| /api/classes | GET | List classes with groups and members |
| /api/classes | POST | Add class/course |
| /api/groups | POST | Add group under class |
| /api/payments | POST | Record payment, generate receipt |
| /api/payments/{id} | PUT | Update payment / mark refund |
| /api/receipts/{id} | GET | Download PDF |
| /api/dashboard | GET | Widget data (active/inactive, due/overdue, revenue) |
| /api/analytics | GET | Revenue charts, new members charts |
| /api/backup | POST | Trigger backup to configured folder |
| /api/settings | GET/PUT | Business settings, language, colors, currency |

**Backend Features:**
- Auto-calculate `next_due_date`
- Auto-number receipts: `receipt-<MemberName>-<ClassName>-YYMMDD-0001.pdf`
- Alerts: overdue / due today
- PDF generation on payment
- Backup script: SQLite + receipts daily

---

### Frontend / Dashboard (React + Tailwind)

### Pages & Components
1. Login Page (admin only)
2. Dashboard
   - Widgets: active/inactive, due today, overdue, overdue inactive
   - Quick actions: mark payment, generate receipt, mark inactive
   - Alerts/popups: overdue/due today on load
3. Members Page
   - Filters: status, group, class
   - Search bar (live)
   - Bulk updates
4. Classes & Groups Page
   - Hierarchical: Class → Group → Members
   - Flat list option
5. Payments & Receipts Page
   - Record payment / refund
   - Download/print receipts
   - Auto-numbering
6. Analytics Page
   - Charts: revenue per month/year, new members, overdue stats
   - Export PDF/CSV
7. Settings Page
   - Language switch (EN/FR)
   - Theme colors, logo
   - Backup folder path

**UX Notes:**
- Responsive layout, desktop-first
- Color-coded rows: red overdue, gray inactive
- Auto-refresh on open + hourly

---

### Backup & Migration
- Daily auto SQLite backup to folder (overwrite)
- Manual backup/export button
- Migration: single SQLite DB export → import to online system
- Receipts stored in subfolder

---

### PDF Receipts
- Generated from HTML template
- Includes: business logo, name, member name, class/group, payment date, amount, method, receipt number
- File name: `receipt-<MemberName>-<ClassName>-YYMMDD-0001.pdf`

---

### Offline Packaging
- Local web server starts on app launch
- Opens default browser at `http://localhost:8000`
- Windows installer bundles Python + dependencies + frontend build
- Admin configurable: port, backup folder, receipt folder

---

### Testing / QA
- Unit tests: models, payment logic, next_due_date, receipt generation
- Integration tests: endpoints + PDF generation + DB writes
- Seed data included (demo purposes)

---

### Future Expansion
- Optional online: multi-branch, staff roles (view/request)
- Multi-language ready (EN/FR)
- Analytics charts ready for more KPIs
- API endpoints for mobile PWA or external tools
- Migration path: offline → online

---

## 10. Optional Features
- WhatsApp bot / alerts for payment reminders
- AI logic for overdue prediction
- Inventory management for classrooms/gyms
- Multi-business SaaS platform

---

**Next Step:** Build **starter code scaffold** with backend models, FastAPI endpoints, React frontend, PDF receipt generation, backup scripts, and seed data for demo.

