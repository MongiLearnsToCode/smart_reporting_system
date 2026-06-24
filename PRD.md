# Product Requirements Document: Codex — Smart Reporting System

## Target Users
- Small-to-medium business owners, operations managers, and analysts who need to log daily business updates and generate structured reports
- Users who want AI-powered extraction of entities (amounts, currencies, sentiment, urgency) from free-text notes
- Teams that need conflict detection for duplicate or contradictory entries

## Core Features

### 1. Business Logging
- Free-text input of business updates (sales, expenses, notes, observations)
- File upload support (PDF, XLSX, CSV, TXT) with automatic text extraction
- AI-powered category assignment and entity extraction via Groq LLM

### 2. Dashboard & Widgets
- Real-time dashboard with configurable widgets (metric cards, charts, lists)
- Widget sorting by title, creation date, or recent activity
- Drag-and-drop widget layout (via @dnd-kit)
- Log feed with color-coded categories and sentiment indicators

### 3. Conflict Detection
- Automatic comparison of new entries against recent entries (same category)
- AI-based duplicate/similarity detection
- Conflict review UI with revert capability

### 4. Reporting & Export
- Export dashboard data as HTML reports
- Template-based report generation (Executive Summary)
- Report email delivery (planned)

### 5. User Management
- Email/password authentication via Supabase Auth (Better Auth)
- Session management with Supabase SSR
- User settings (currency, timezone, AI language, widget preferences)

## Success Criteria
- Users can log a business update in < 30 seconds
- AI entity extraction accuracy > 85%
- Dashboard loads in < 2 seconds (cached queries)
- Zero security vulnerabilities (CSRF, XSS, rate limiting enforced)
- All API routes return proper error responses with appropriate HTTP status codes

## Non-Goals (v1)
- Multi-tenant organizations
- Role-based access control
- Real-time collaboration
- Mobile native apps (responsive web only)
