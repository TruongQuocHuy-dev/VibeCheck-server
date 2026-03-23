# VibeCheck Backend

VibeCheck is a social discovery platform backend built with Node.js, Express, and MongoDB.
It powers the mobile app with authentication, profile management, vibe selection, and media upload APIs.

This project is organized with a modular API structure for scalability, maintainability, and production readiness.

---

## Tech Stack

* Node.js
* Express.js
* MongoDB + Mongoose
* Firebase Admin SDK (OTP/Firebase token verification)
* JWT (access/refresh tokens)
* Cloudinary + Multer (avatar uploads)

---

## Project Structure

```text
vibecheck-backend
|
|- src/
|  |- app.js                    # Express app setup (middlewares, routes, error handler)
|  |- server.js                 # Server bootstrap (env, DB, Firebase, seed)
|  |
|  |- config/                   # Database, Firebase, upload, seed configs
|  |- controllers/              # Route handlers (auth, user, vibes)
|  |- middlewares/              # Auth and global error middleware
|  |- models/                   # Mongoose models
|  |- routes/                   # API route definitions
|  |- services/                 # Business services (if needed)
|  |- utils/                    # Shared utilities (token, response, errors)
|  |- validators/               # Request validators
|
|- tests/                       # Unit and integration tests
|- docs/                        # Project documentation
|- .env.example                 # Environment template
|- package.json
```

---

## Getting Started

### 1 Install dependencies

```bash
npm install
```

---

### 2 Create environment file

Create `.env` from `.env.example` and fill all required values:

```bash
cp .env.example .env
```

Main environment groups:

* Server: `PORT`, `HOST`, `NODE_ENV`
* Database: `MONGODB_URI` or `MONGO_URI`
* JWT: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_EXPIRY`, `REFRESH_TOKEN_EXPIRY`
* Firebase Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
* Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
* CORS: `CORS_ORIGINS`

---

### 3 Run development server

```bash
npm run dev
```

For production mode:

```bash
npm start
```

Health check endpoint:

* `GET /api/health`

---

## API Overview

### Auth

* `POST /api/auth/check-phone`
* `POST /api/auth/register`
* `POST /api/auth/set-password` (protected)
* `POST /api/auth/login`
* `POST /api/auth/google-login`

### Users (Protected)

* `GET /api/users/profile`
* `PATCH /api/users/profile`
* `POST /api/users/vibes`
* `POST /api/users/avatar`

### Vibes

* `GET /api/vibes`

---

## Security Notes

* Never commit `.env` or service account JSON files.
* Rotate secrets immediately if they are exposed.
* Use strong and different secrets across environments.
* Restrict CORS to trusted client domains in production.
* Add secret scanning in CI (for example: Gitleaks, TruffleHog, GitHub Advanced Security).

---

## Test

```bash
npm test
```

---

## 👤 Author
* GitHub: https://github.com/TruongQuocHuy-dev
* Email: tqhuy.dev.frontend@gmail.com
