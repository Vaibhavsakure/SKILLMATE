# 🚀 Skillmate AI

**AI-Powered Career Intelligence Platform** — Rewrite resumes, score ATS compatibility, generate cover letters, prepare for interviews, and optimize LinkedIn profiles — all powered by multi-model AI (Claude + Ollama fallback).

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## 🏛 Architecture

```
┌───────────────────────────────────┐
│   Next.js Frontend (:3000)        │
│   React 19 + Tailwind CSS v4      │
│   Supabase Auth (JWT)             │
│                                   │
│   /api/python/* →  rewrites to ──►│──┐
└───────────────────────────────────┘  │
                                       │
          ┌────────────────────────────┘
          ▼
┌───────────────────────────────────┐
│   FastAPI Backend (:8000)         │
│   21 API Modules                  │
│   SQLAlchemy ORM + Alembic        │
│                                   │
│   ┌──────────┐  ┌──────────────┐  │
│   │  Claude   │  │  Ollama      │  │
│   │ (Primary) │→ │ (Fallback)   │  │
│   └──────────┘  └──────────────┘  │
│                                   │
│   ┌──────────┐  ┌──────────────┐  │
│   │ Supabase │  │   Stripe     │  │
│   │  Auth    │  │  Payments    │  │
│   └──────────┘  └──────────────┘  │
└───────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer      | Technology                                      |
|------------|------------------------------------------------|
| Frontend   | Next.js 16, React 19, Tailwind CSS v4, Zustand |
| Backend    | FastAPI, SQLAlchemy, Alembic, Pydantic          |
| AI Models  | Anthropic Claude (primary), Ollama (fallback)   |
| Auth       | Supabase Auth (JWT-based)                       |
| Database   | SQLite (dev) / PostgreSQL (prod)                |
| Payments   | Stripe Checkout + Webhooks                      |
| File Parse | PyPDF2, python-docx                             |

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **Supabase** project with Auth enabled
- **Anthropic** API key (for Claude)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd skillmate
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Create .env file (see Environment Variables below)
cp .env.example .env

# Run database migrations
python -m alembic upgrade head

# Start the backend
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd skillmate-frontend
npm install

# Create .env.local file
cp .env.local.example .env.local

# Start the dev server
npm run dev
```

### 4. Access the app

Open `http://localhost:3000` in your browser.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# AI
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434

# Database
DATABASE_URL=sqlite:///./dev.db   # Use postgres:// for production

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Security
SECRET_KEY=your-random-secret-key
```

### Frontend (`skillmate-frontend/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

> ⚠️ **Never commit `.env` files to git.** The `.gitignore` is already configured.

---

## 🗃 Database Migrations

This project uses **Alembic** for database migrations.

```bash
cd backend

# Generate a new migration after model changes
python -m alembic revision --autogenerate -m "describe_changes"

# Apply all pending migrations
python -m alembic upgrade head

# Rollback one migration
python -m alembic downgrade -1

# View migration history
python -m alembic history
```

---

## 📁 Project Structure

```
skillmate/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── alembic/                 # Database migrations
│   ├── app/
│   │   ├── api/                 # 21 API route modules
│   │   │   ├── deps.py          # Auth dependencies (single source of truth)
│   │   │   ├── ats_score.py     # ATS compatibility scoring
│   │   │   ├── resume_rewrite.py # Resume rewrite with streaming
│   │   │   ├── cover_letter.py  # Cover letter generation
│   │   │   ├── interview_simulator.py
│   │   │   ├── payments.py      # Stripe integration
│   │   │   └── ...
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic Settings
│   │   │   ├── database.py      # SQLAlchemy engine + session
│   │   │   └── exceptions.py    # Custom exception classes
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── services/
│   │   │   ├── ai_service.py    # Claude + Ollama failover
│   │   │   └── ats_engine.py    # Weighted keyword scoring
│   │   └── utils/
│   │       ├── file_parser.py   # PDF/DOCX text extraction
│   │       └── sanitize.py      # Input sanitization
│   └── requirements.txt
│
├── skillmate-frontend/
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── auth/                # Login/Signup pages
│   │   ├── dashboard/           # Protected dashboard pages
│   │   │   ├── layout.tsx       # Server-side auth guard
│   │   │   ├── page.tsx         # Dashboard overview
│   │   │   ├── ats/             # ATS Scanner
│   │   │   ├── resumes/         # Resume Rewriter
│   │   │   ├── cover-letter/    # Cover Letter Generator
│   │   │   ├── interview/       # Interview Coach
│   │   │   ├── linkedin/        # LinkedIn Optimizer
│   │   │   ├── jobs/            # Job Match Analyzer
│   │   │   ├── roadmap/         # Career Roadmap
│   │   │   ├── projects/        # Project Recommendations
│   │   │   ├── credits/         # Credit Management
│   │   │   └── history/         # Analysis History
│   │   └── rewrite/             # Standalone streaming rewrite
│   ├── components/
│   │   ├── ui/                  # Reusable UI primitives
│   │   ├── DashboardShell.tsx   # Sidebar + topbar layout
│   │   ├── ChatWidget.tsx       # AI assistant widget
│   │   └── ResumeUploader.tsx   # Drag-and-drop file uploader
│   └── lib/
│       ├── api.ts               # API client functions
│       ├── useAuth.ts           # Centralized auth hook (getUser)
│       └── supabaseClient.ts    # Browser Supabase client
│
└── .gitignore
```

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run the backend tests: `cd backend && pytest`
4. Verify the frontend builds: `cd skillmate-frontend && npm run build`
5. Open a Pull Request

---

## 📄 License

This project is proprietary. All rights reserved.
