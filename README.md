# InceptaX — Full Stack Platform

A developer challenge platform with AI evaluation, leaderboards, team collaboration, and an admin portal.

## Project Structure

```
inceptax/
├── backend/          ← Express + MongoDB + Socket.io API
└── frontend/         ← React + Vite + Tailwind UI
```

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — set MONGO_URI and JWT secrets

# Start development server
npm run dev
# → Running on http://localhost:5000

# (Optional) Seed the database with sample data
npm run seed
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
# → Running on http://localhost:3000
```

The frontend Vite config proxies all `/api` requests to `http://localhost:5000` automatically — no CORS issues in development.

---

## Environment Variables (backend/.env)

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/inceptax
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |

### Users
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/users/me` | ✓ |
| PUT | `/api/users/me/profile` | ✓ |
| GET | `/api/users/:username` | ✓ |
| GET | `/api/users/:username/submissions` | ✓ |

### Assignments (Challenges)
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/assignments` | ✓ |
| GET | `/api/assignments/:id` | ✓ |

### Submissions
| Method | Path | Auth |
|--------|------|------|
| POST | `/api/submissions` | ✓ |
| GET | `/api/submissions/:id` | ✓ |
| GET | `/api/submissions/assignment/:id` | ✓ |

### Leaderboard
| Method | Path |
|--------|------|
| GET | `/api/leaderboard` |
| GET | `/api/leaderboard/assignment/:id` |

### Admin (requires admin role)
| Method | Path |
|--------|------|
| GET | `/api/admin/stats` |
| GET/PATCH | `/api/admin/users` |
| POST/PUT/DELETE | `/api/admin/assignments` |
| GET/PATCH | `/api/admin/submissions` |
| POST | `/api/admin/submissions/:id/ai-evaluate` |
| POST | `/api/admin/email/blast` |

### Chat
| Method | Path | Auth |
|--------|------|------|
| GET | `/api/chat/:submissionId` | ✓ |
| POST | `/api/chat/:submissionId` | ✓ |

---

## Creating an Admin User

Use MongoDB shell or the seed script:

```js
// In MongoDB shell
db.users.updateOne(
  { email: "admin@inceptax.io" },
  { $set: { role: "admin" } }
)
```

Or register normally then update role in DB. The admin portal is at `/admin-portal`.

---

## Key Architecture Decisions

- **JWT Auth**: Short-lived access tokens (15m) + long-lived refresh tokens (7d) stored in httpOnly cookies. Frontend stores access token in localStorage and auto-refreshes on 401.
- **Plan system**: `free`, `ten_day`, `monthly` — plans expire automatically via `planExpiresAt`. Backend checks on every authenticated request.
- **Scoring**: AI gives a score (60–100), admin gives a score (0–100). Final = 40% AI + 60% Admin.
- **Real-time chat**: Socket.io — join/leave `submission:{id}` rooms. Messages also persisted in MongoDB.
