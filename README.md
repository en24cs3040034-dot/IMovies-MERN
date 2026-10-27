# IMovies — MERN Cinema Booking System

A full-stack starter project using MongoDB, Express, React (Vite), and Node.js.

## Features
- Register/login with JWT and bcrypt password hashing
- Browse and search movies
- Movie detail and showtime selection
- Live seat availability updates with Socket.IO
- Book seats with duplicate-seat protection
- View booking history and cancel bookings
- Admin-only movie and show creation endpoints
- Centralized error handling and basic API rate limiting
- Responsive React UI

> This is a development-ready educational MVP, not a production payment system. Payment is simulated; do not enter real payment details. Before production, add a real payment provider, stronger validation, audit logging, HTTPS, and production secrets.

## Requirements
- Node.js 18+ recommended
- MongoDB Community Server or MongoDB Atlas
- npm

## Run locally

### 1. Backend
```bash
cd server
cp .env.example .env
# Set MONGO_URI and JWT_SECRET in .env
npm install
npm run seed
npm run dev
```
API runs at http://localhost:5000

Seeded admin:
- Email: admin@imovies.local
- Password: Admin123!

Seeded user:
- Email: user@imovies.local
- Password: User123!

Change these credentials before sharing or deploying.

### 2. Frontend
In a second terminal:
```bash
cd client
npm install
npm run dev
```
Open the URL Vite prints (normally http://localhost:5173).

## API overview
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/movies`
- `GET /api/movies/:id`
- `GET /api/shows?movieId=...`
- `GET /api/shows/:id/seats`
- `POST /api/bookings` (auth required)
- `GET /api/bookings/my` (auth required)
- `PATCH /api/bookings/:id/cancel` (auth required)
- `POST /api/admin/movies` (admin)
- `POST /api/admin/shows` (admin)

## Notes
The app stores seat numbers as strings (e.g. A1, A2). Booking uses a MongoDB transaction where supported (replica set / Atlas); for a local standalone MongoDB server, use the fallback atomic update path. Socket.IO emits seat updates after a successful booking/cancellation.
