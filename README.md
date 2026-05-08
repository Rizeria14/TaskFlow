# TaskFlow — Smart Task Management System

A production-ready Flask web application featuring REST APIs, PostgreSQL, Pandas/NumPy analytics, and WebSocket live updates.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, Flask 3 |
| Database | PostgreSQL (SQLite fallback) |
| ORM | SQLAlchemy via Flask-SQLAlchemy |
| Auth | Flask-Login + Flask-Bcrypt |
| Analytics | Pandas + NumPy |
| Real-time | Flask-SocketIO (WebSockets) |
| Frontend | HTML5, CSS3, Vanilla JS |

---

## Project Structure

```
task_manager/
├── app.py                  # Main Flask app — models, routes, WebSocket events
├── requirements.txt
├── .env.example
├── templates/
│   ├── auth.html           # Login / Register page
│   └── dashboard.html      # Main dashboard
└── static/
    ├── css/style.css       # Full stylesheet
    └── js/dashboard.js     # WebSocket + REST API client logic
```

---

## Quick Start (SQLite — no Postgres needed)

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy env file (SQLite is the default — no changes needed)
cp .env.example .env

# 4. Run
python app.py
```

Open **http://localhost:5000** in your browser.

---

## PostgreSQL Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE taskflow;
\q

# Update .env — uncomment and fill in:
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/taskflow

# Run — tables are created automatically on first start
python app.py
```

---

## REST API Reference

### Auth

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | `{username, email, password}` | Register new user |
| POST | `/api/auth/login` | `{username, password}` | Login |
| POST | `/api/auth/logout` | — | Logout |

### Tasks

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks` | — | Get all tasks (supports `?status=` `?priority=`) |
| POST | `/api/tasks` | `{title, description, priority, status}` | Create task |
| PUT | `/api/tasks/<id>` | `{title?, description?, priority?, status?}` | Update task |
| DELETE | `/api/tasks/<id>` | — | Delete task |
| GET | `/api/analytics` | — | Get Pandas/NumPy analytics |

**Priority values:** `low` | `medium` | `high`  
**Status values:** `pending` | `in_progress` | `completed`

---

## Features

### 1 — Authentication
- Secure password hashing with bcrypt
- Session-based login via Flask-Login
- Register, Login, Logout flows

### 2 — REST API
- Full CRUD for tasks
- Filter by status and priority
- JSON responses throughout

### 3 — PostgreSQL / SQLite
- Auto-created schema on startup
- `users` and `tasks` tables with FK constraint
- Falls back to SQLite automatically when `DATABASE_URL` is not set

### 4 — Analytics (Pandas + NumPy)
- Total / completed / pending / in-progress counts
- Completion percentage via NumPy
- Average tasks per day
- Priority breakdown bar chart
- Status donut chart (SVG)

### 5 — WebSockets
- Every task add/update/delete broadcasts a `task_*` event to the user's private room
- Frontend reacts instantly — no page refresh needed
- Live connection indicator in the UI

### 6 — Frontend
- Dark industrial aesthetic, responsive layout
- Sidebar navigation, filter bar, modal form
- Toast notifications for all actions

---

## Database Schema

```sql
-- users
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(80)  UNIQUE NOT NULL,
    email         VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- tasks
CREATE TABLE tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    priority    VARCHAR(20)  DEFAULT 'medium',
    status      VARCHAR(20)  DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Running in Production

```bash
# Use gunicorn with eventlet worker for WebSocket support
pip install gunicorn
gunicorn --worker-class eventlet -w 1 app:app --bind 0.0.0.0:5000
```

> **Note:** Only 1 worker is supported with eventlet WebSockets.
