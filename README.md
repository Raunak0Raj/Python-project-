# Expense Tracker Web (Python Full-Stack)

**Backend:** Python (standard library `http.server` + `sqlite3`) REST API
**Frontend:** HTML + CSS + JavaScript (served by the Python server)
No pip install, no internet needed.

## Run
1. Python 3.8+ install karo (`python --version` se check)
2. Is folder me terminal kholo
3. `python app.py`   (Linux/Mac: `python3 app.py`)
4. Browser me http://localhost:8000 khul jayega

Data `expenses.db` me save hota hai. Band karne ke liye terminal me Ctrl+C.

## Features
Dashboard stats, donut chart, 6-month trend, budgets with alerts, add/edit/delete,
live search + category filter, month picker, CSV export, dark mode.

## Structure
```
app.py            # backend: server + REST API + SQLite
static/index.html # page
static/style.css  # design
static/app.js     # frontend logic (fetch API calls)
```
