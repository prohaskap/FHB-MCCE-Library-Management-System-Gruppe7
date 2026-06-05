# Library Management System

System under test for the **FHB MCCE Test Automation** course.

---

## What the app does

The system models the operations of a public lending library:

- Members borrow and return books
- Late fees accrue at €0.50/day, capped at €20.00
- Books that are fully borrowed out can be reserved; the first reservation in the queue is automatically promoted when a copy is returned
- A documented REST API covers all operations
- A web UI provides access to all features

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org/) | 18 or newer |
| npm | included with Node.js |

No database server, no Docker, no Python required.

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/horvathkevin/FHB-MCCE-Library-Management-System-Student.git
cd FHB-MCCE-Library-Management-System-Student

# 2. Install dependencies
npm install

# 3. Seed the database with example data
npm run seed

# 4. Start the server
npm start
```

The server starts on **http://localhost:3000**.

---

## URLs

| URL | What's there |
|-----|-------------|
| `http://localhost:3000` | Web UI |
| `http://localhost:3000/api-docs` | Swagger UI — interactive API documentation |
| `http://localhost:3000/api-docs.json` | Raw OpenAPI spec (importable into Postman etc.) |

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-restart on file changes |
| `npm run seed` | Wipe the database and re-seed with example data |

> Run `npm run seed` before each testing session to reset the database to a known, clean state.

---

## Seed data

The seed script populates the database with realistic example data:

| Entity | Count |
|--------|-------|
| Books | 61 |
| Members | 55 (50 active, 5 inactive) |
| Loans | 55 (active, returned on time, returned late, overdue) |
| Reservations | 55 (pending, ready, cancelled) |

---

## API overview

| Base path | Domain |
|-----------|--------|
| `GET/POST /api/books` | Book catalog |
| `GET/PUT/DELETE /api/books/:id` | Single book |
| `GET/POST /api/members` | Members |
| `GET/PUT/DELETE /api/members/:id` | Single member |
| `POST /api/members/:id/activate` | Reactivate a member |
| `POST /api/members/:id/deactivate` | Deactivate a member |
| `GET/POST /api/loans` | Loans (borrow) |
| `GET /api/loans/:id` | Single loan |
| `POST /api/loans/:id/return` | Return a book |
| `GET /api/loans/:id/fee` | Calculate current fee |
| `GET/POST /api/reservations` | Reservations |
| `POST /api/reservations/:id/cancel` | Cancel a reservation |
| `GET /api/search/books` | Search books by title, author, ISBN, genre |
| `GET /api/search/members` | Search members by name or email |
| `GET /api/reports/members/:id/history` | Loan history for a member |
| `GET /api/reports/members/:id/stats` | Loan statistics for a member |
| `GET /api/reports/books/top` | Most borrowed books |
| `GET /api/reports/loans/overdue` | All currently overdue loans |

Full request/response documentation is available in the Swagger UI.

---

## Business rules

### Books
- ISBN must be a valid 10- or 13-digit number and is unique
- Publication year cannot be in the future
- A book with active loans cannot be deleted

### Members
- Email address is unique per member
- Members can be deactivated — inactive members cannot borrow or reserve
- A member with active loans cannot be deleted

### Borrowing
- A book can only be borrowed if at least one copy is available
- A member may not borrow the same book twice simultaneously
- A member may hold at most **5 active loans**
- Loans are due **14 days** after the borrow date

### Late fees
- Fee: **€0.50 per day** overdue
- Maximum fee: **€20.00** per loan
- Fee is calculated and frozen at the moment of return

### Reservations
- A book can only be reserved when all copies are currently on loan
- A member may hold at most **3 active reservations**
- Reservations are fulfilled in **FIFO order**
- When a book is returned, the oldest pending reservation is automatically promoted to "ready"

---

## Assignment

The group assignment document is available in [`docs/FHB-MCCE-Group-Assignment.docx`](docs/FHB-MCCE-Group-Assignment.docx).

It describes your group's assigned domain, the business rules you must cover, and all submission requirements.

---

## Project structure

```
├── src/
│   ├── server.js           # Entry point
│   ├── app.js              # Express app + Swagger setup
│   ├── db.js               # SQLite database wrapper
│   ├── fees.js             # Late fee calculation logic
│   └── routes/
│       ├── books.js
│       ├── members.js
│       ├── loans.js
│       ├── reservations.js
│       ├── search.js
│       └── reports.js
├── public/
│   ├── index.html          # Single-page web UI
│   └── app.js              # Frontend JavaScript
├── docs/
│   └── FHB-MCCE-Group-Assignment.docx
├── seed.js                 # Database seeding script
└── package.json
```
