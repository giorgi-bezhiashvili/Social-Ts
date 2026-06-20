# Social TS

A social media REST API built from scratch with **TypeScript**, **Express**, and **MongoDB** — featuring JWT authentication with refresh token rotation, Google OAuth, real-time notifications, and a follow/post/comment system.

> 🚧 **Status: Work in progress.** Core features are functional; the follow system and test coverage are still being hardened.

---

## Features

- **Authentication**
  - Email/password registration & login with `bcrypt` password hashing
  - Google OAuth2 login via Passport
  - Short-lived JWT access tokens + long-lived refresh tokens with rotation
  - Server-side refresh token revocation (`jti` tracking) for logout/rotation
  - Rate limiting on auth routes

- **Posts**
  - Create, list, and delete posts
  - Like / unlike posts
  - Per-user post feeds via populated relations

- **Comments**
  - Add comments to posts
  - Fetch comments with populated author info

- **Follow System**
  - Follow / unfollow users
  - Follower and following counts

- **Real-time Notifications**
  - Like and comment events trigger a persisted `Notification` document
  - Notifications pushed instantly to the relevant user via **Socket.io** rooms
  - REST endpoint to fetch a user's notification history

- **Profiles**
  - Upload/update profile picture (`multer`, with automatic cleanup of the old file)
  - Update profile description
  - Fetch public profile data

- **Security**
  - `helmet` (HSTS, Content-Security-Policy)
  - XSS sanitization on incoming request bodies
  - HttpOnly, SameSite cookies for refresh tokens
  - Per-route rate limiting

---

## Tech Stack

| Layer          | Technology                          |
|----------------|--------------------------------------|
| Language       | TypeScript                          |
| Runtime        | Node.js                             |
| Framework      | Express 5                           |
| Database       | MongoDB + Mongoose                  |
| Auth           | JWT (`jsonwebtoken`), Passport (Google OAuth2), bcrypt |
| Real-time      | Socket.io                           |
| File uploads   | Multer                              |
| Security       | Helmet, express-rate-limit, express-xss-sanitizer |
| Dev tooling    | nodemon, tsx, ts-node               |

---

## Project Structure

```
social-ts/
├── src/
│   ├── index.ts                 # App entry point — middleware, routes, server bootstrap
│   ├── models/
│   │   ├── userSchema.ts        # User model (profile, followers, refresh tokens)
│   │   ├── postSchema.ts        # Post model (with embedded comments)
│   │   └── notificationScema.ts # Notification model
│   ├── routes/
│   │   ├── authRoutes.ts        # Register, login, Google OAuth, refresh, logout
│   │   ├── postRoutes.ts        # CRUD + like/unlike for posts
│   │   ├── commentRoutes.ts     # Add/fetch comments
│   │   ├── followingRouters.ts  # Follow/unfollow, follower counts
│   │   ├── notificationRoutes.ts# Fetch user notifications
│   │   └── profileRoutes.ts     # Profile picture upload, description, public profile
│   ├── utils/
│   │   ├── jwt.ts               # Token signing, verification, rotation, revocation
│   │   ├── postService.ts       # Post business logic (used by postRoutes)
│   │   └── socket.ts            # Socket.io server init + room management
│   └── types/
│       └── express.d.ts         # Express type augmentations
├── test.rest                    # REST Client requests for manual API testing
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A running MongoDB instance (local or Atlas)
- A Google OAuth2 client ID/secret (only required if you want Google login)

### Installation

```bash
git clone <repo-url>
cd social-ts
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Run in development

```bash
npm run devStart
```

The server starts on `http://localhost:3000`.

### Build & run in production

```bash
npm run build
npm start
```

---

## API Overview

All routes are unprefixed (mounted at root). Authenticated routes require an `Authorization: Bearer <accessToken>` header.

### Auth
| Method | Endpoint          | Description                       | Auth |
|--------|-------------------|------------------------------------|------|
| POST   | `/register`       | Create a new account               | —    |
| POST   | `/login`           | Log in with email/username + password | — |
| GET    | `/auth/google`     | Start Google OAuth flow            | —    |
| GET    | `/google/callback` | Google OAuth callback              | —    |
| POST   | `/auth/refresh`    | Rotate access/refresh tokens       | Cookie |
| POST   | `/auth/logout`     | Revoke refresh token                | Cookie |

### Posts
| Method | Endpoint                  | Description              | Auth |
|--------|----------------------------|---------------------------|------|
| POST   | `/:_id/posts`               | Create a post              | ✅ |
| GET    | `/:_id/posts`               | Get a user's posts         | —  |
| GET    | `/posts`                    | List all posts             | —  |
| POST   | `/like/:_postId/:_id`        | Like a post                | ✅ |
| POST   | `/downlike/:_postId/:_id`    | Unlike a post               | ✅ |
| DELETE | `/:_id/posts/:postId`        | Delete a post               | ✅ |

### Comments
| Method | Endpoint                     | Description           | Auth |
|--------|-------------------------------|-------------------------|------|
| POST   | `/posts/:postId/comment`       | Add a comment            | ✅ |
| GET    | `/posts/:postId/comments`      | Get a post's comments    | —  |

### Follow
| Method | Endpoint                | Description              | Auth |
|--------|---------------------------|----------------------------|------|
| POST   | `/follow/:_id`             | Follow a user               | ✅ |
| DELETE | `/unfollow/:id`            | Unfollow a user             | ✅ |
| GET    | `/followersCount/:_id`     | Get a user's follower count | ✅ |

### Notifications
| Method | Endpoint         | Description                  | Auth |
|--------|-------------------|--------------------------------|------|
| GET    | `/notifications`   | Get the current user's notifications | ✅ |

### Profile
| Method | Endpoint                   | Description              | Auth |
|--------|------------------------------|----------------------------|------|
| GET    | `/:id`                       | Get public profile data    | —  |
| POST   | `/:id/profilePicture`        | Upload/update profile picture | ✅ |
| POST   | `/:id/description`           | Update profile description | ✅ |


---

## Real-time Notifications

When a user likes a post or comments on it:
1. A `Notification` document is persisted in MongoDB.
2. The event is emitted over Socket.io to a room named after the recipient's user ID.
3. Connected clients that have joined their own room (`socket.emit("join", userId)`) receive the notification instantly.

---

## Roadmap

- [ ] Fix and harden the follow/unfollow data model
- [ ] Add automated tests
- [ ] Pagination for posts, comments, and notifications
- [ ] Input validation layer (e.g. Joi/Zod) across all routes
- [ ] Dockerize for easier local setup

---

## License

ISC
