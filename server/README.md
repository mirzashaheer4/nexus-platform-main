# Nexus Platform — Server

Node.js + Express backend for the Nexus Investor & Entrepreneur Collaboration Platform.

---

## Getting Started

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 3. Run the development server

```bash
npm run dev
```

The server starts on `http://localhost:5000` (or your configured `PORT`).

---

## Environment Variables

### Core

| Variable              | Description                                           |
|-----------------------|-------------------------------------------------------|
| `PORT`                | Port the server listens on (default: 5000)            |
| `MONGO_URI`           | MongoDB Atlas connection string                       |
| `JWT_SECRET`          | Secret key for signing access tokens                  |
| `JWT_REFRESH_SECRET`  | Secret key for signing refresh tokens                 |
| `CLIENT_URL`          | Frontend URL for CORS (e.g. `http://localhost:3000`)  |
| `NODE_ENV`            | `development` or `production`                         |

### Week 2 — Document Storage (AWS S3 or Local)

If these four AWS variables are **all present**, documents are stored in S3.  
If any are missing, the server falls back to **local `/uploads`** folder.

| Variable            | Description                                          |
|---------------------|------------------------------------------------------|
| `AWS_ACCESS_KEY`    | AWS IAM Access Key ID                                |
| `AWS_SECRET_KEY`    | AWS IAM Secret Access Key                            |
| `AWS_BUCKET_NAME`   | S3 Bucket name for document storage                  |
| `AWS_REGION`        | S3 Bucket region (e.g. `us-east-1`)                  |
| `UPLOAD_PATH`       | Local fallback upload directory (default: `uploads`) |

### Week 3 — Payments

| Variable                | Description                                      |
|-------------------------|--------------------------------------------------|
| `STRIPE_SECRET_KEY`     | Stripe secret key                                |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret                    |
| `CLOUDINARY_URL`        | Cloudinary URL for cloud image storage (optional)|

---

## Auth Architecture

- **Access Token**: 15-minute JWT stored in an `httpOnly` cookie (`accessToken`)
- **Refresh Token**: 7-day JWT stored in an `httpOnly` cookie (`refreshToken`)
- **JWT Payload Cookie**: Non-httpOnly cookie (`jwtPayload`) — base64 `{ id, name, role }` — readable by frontend JS for role-based routing
- **Socket Token**: Non-httpOnly cookie (`_st`) — same JWT as `accessToken`, readable by the VideoCall page for Socket.IO handshake auth
- **Refresh Rotation**: Every `/api/auth/refresh` issues new access + refresh tokens
- **No localStorage**: All token storage is cookie-based

---

## API Reference

### Health
| Method | Route       | Auth | Description         |
|--------|-------------|------|---------------------|
| GET    | /api/health | ❌   | Server health check |

### Auth
| Method | Route               | Auth | Description                          |
|--------|---------------------|------|--------------------------------------|
| POST   | /api/auth/register  | ❌   | Register + auto-login (sets cookies) |
| POST   | /api/auth/login     | ❌   | Login (sets cookies)                 |
| POST   | /api/auth/logout    | ❌   | Logout (clears cookies)              |
| POST   | /api/auth/refresh   | ❌   | Refresh token rotation               |

### Profile
| Method | Route                | Auth | Description                  |
|--------|----------------------|------|------------------------------|
| GET    | /api/profile/me      | ✅   | Get own profile              |
| PUT    | /api/profile/me      | ✅   | Update own profile           |
| GET    | /api/profile/:userId | ✅   | View another user's profile  |
| POST   | /api/profile/picture | ✅   | Upload profile picture       |

### Dashboards
| Method | Route                       | Auth | Role         | Description             |
|--------|-----------------------------|------|--------------|-------------------------|
| GET    | /api/investor/dashboard     | ✅   | investor     | Investor dashboard data |
| GET    | /api/entrepreneur/dashboard | ✅   | entrepreneur | Entrepreneur dashboard  |

### Meetings (Week 2)
| Method | Route                        | Auth | Description                                           |
|--------|------------------------------|------|-------------------------------------------------------|
| POST   | /api/meetings/schedule       | ✅   | Organizer schedules with multiple proposed times      |
| GET    | /api/meetings/my             | ✅   | All meetings where user is organizer or invitee       |
| GET    | /api/meetings/calendar       | ✅   | Meetings in date range `?start=&end=`                 |
| GET    | /api/meetings/:id            | ✅   | Single meeting (must be participant)                  |
| PUT    | /api/meetings/:id/accept     | ✅   | Invitee accepts — picks a proposedTime, conflict-checks, generates meetingLink |
| PUT    | /api/meetings/:id/reject     | ✅   | Invitee rejects (optional reason in body)             |
| PUT    | /api/meetings/:id/cancel     | ✅   | Organizer cancels                                     |

### Documents (Week 2)
| Method | Route                        | Auth | Description                                         |
|--------|------------------------------|------|-----------------------------------------------------|
| POST   | /api/documents/upload        | ✅   | Upload file (PDF, DOCX, PNG, JPG, max 10MB)         |
| GET    | /api/documents/my            | ✅   | Documents uploaded by or shared with user           |
| GET    | /api/documents/:id           | ✅   | Single document (must have access)                  |
| PUT    | /api/documents/:id/share     | ✅   | Add userId to sharedWith (owner only)               |
| PUT    | /api/documents/:id/status    | ✅   | Update status enum                                  |
| POST   | /api/documents/:id/sign      | ✅   | Submit base64 PNG signature, set status=signed      |
| DELETE | /api/documents/:id           | ✅   | Soft delete — sets status=archived (owner only)     |
| GET    | /api/documents/:id/download  | ✅   | Stream file (local res.download or S3 pre-signed URL, 60s) |

### Payments (Week 3)
| Method | Route                             | Auth | Description                                                |
|--------|-----------------------------------|------|------------------------------------------------------------|
| POST   | /api/payments/create-intent       | ✅   | Create Stripe PaymentIntent, returns clientSecret          |
| POST   | /api/payments/confirm/:intentId   | ✅   | Returns transaction status by intent ID                    |
| POST   | /api/payments/withdraw            | ✅   | Deducts balance from wallet (insufficient checks)          |
| POST   | /api/payments/transfer            | ✅   | Instantly transfer balance to another user by email        |
| GET    | /api/payments/balance             | ✅   | Returns current wallet balance                             |
| GET    | /api/payments/history             | ✅   | Returns transaction history sorted by newest               |
| POST   | /api/payments/webhook             | ❌   | Stripe Webhook, handles intent success/failure             |

---

## Stripe Sandbox Credentials

For testing payment flows in Sandbox Mode, use the following Stripe test card details:

- **Card Number**: `4242 4242 4242 4242`
- **Expiration Date**: Any future date (e.g. `12/30`)
- **CVC**: Any 3 digits (e.g. `123`)
- **Postal Code**: Any ZIP code (e.g. `90210`)

---

## Socket.IO — `/video` Namespace (Week 2)

### Connection
Connect to `http://localhost:5000/video` with:
```js
const socket = io('http://localhost:5000/video', {
  auth: { token: '<_st cookie value>' },  // non-httpOnly JWT cookie
  withCredentials: true,
  transports: ['websocket'],
});
```

The server middleware verifies `handshake.auth.token` (with cookie fallback) against `JWT_SECRET`. Invalid tokens reject the connection.

### Events — Client → Server

| Event          | Payload                        | Description                                      |
|----------------|--------------------------------|--------------------------------------------------|
| `join-room`    | `(roomId: string, userId: string)` | Join a room. Emits `room-full` if already 2 participants |
| `offer`        | `(offer: RTCSessionDescription, roomId: string)` | Forward SDP offer to peer |
| `answer`       | `(answer: RTCSessionDescription, roomId: string)` | Forward SDP answer to peer |
| `ice-candidate`| `(candidate: RTCIceCandidate, roomId: string)` | Forward ICE candidate to peer |
| `leave-room`   | `(roomId: string)`             | Leave room, notifies peer with `peer-disconnected` |

### Events — Server → Client

| Event             | Payload                  | Description                                        |
|-------------------|--------------------------|----------------------------------------------------|
| `user-connected`  | `(socketId: string)`     | A peer joined your room (create and emit offer)    |
| `offer`           | `(offer, fromSocketId)`  | Incoming SDP offer from peer                       |
| `answer`          | `(answer, fromSocketId)` | Incoming SDP answer from peer                      |
| `ice-candidate`   | `(candidate, fromSocketId)` | Incoming ICE candidate from peer                |
| `room-full`       | (none)                   | Room has 2 participants — connection denied         |
| `peer-disconnected`| `(socketId: string)`    | The other participant left or disconnected          |

### Room state
Rooms are tracked in an **in-memory `Map<roomId, Set<socketId>>`**. State is not persisted to the database. Maximum 2 participants per room.

---

## Folder Structure

```
server/
├── middleware/
│   ├── auth.js               # verifyToken (reads req.cookies.accessToken)
│   ├── role.js               # requireRole('investor' | 'entrepreneur')
│   ├── verifyOwnership.js    # verifyOwnership middleware helper (Week 3)
│   └── errorHandler.js       # Centralized error handler
├── models/
│   ├── User.js               # User schema (bcrypt 12 rounds, 2FA, Reset token fields)
│   ├── Profile.js            # Profile schema (investor + entrepreneur fields)
│   ├── Meeting.js            # Week 2 — full scheduling schema
│   ├── Document.js           # Week 2 — full document schema
│   ├── Wallet.js             # Week 3 — Wallet model (cents balance)
│   ├── OTP.js                # Week 3 — OTP code store model
│   └── Transaction.js        # Week 3 — Transaction logs model
├── routes/
│   ├── auth.js               # Register, Login, Logout, Refresh, 2FA OTP, Password Reset
│   ├── profile.js            # Profile CRUD + picture upload
│   ├── dashboard.js          # Investor & Entrepreneur dashboards
│   ├── meetings.js           # Week 2 — full meeting scheduling
│   ├── documents.js          # Week 2 — full document chamber
│   └── payments.js           # Week 3 — Stripe intents, withdraw, transfer, history, balance
├── utils/
│   └── email.js              # Week 3 — Nodemailer Ethereal & Production helper
├── socket/
│   └── videoSignaling.js     # Socket.IO /video namespace, WebRTC signaling
├── scratch/
│   ├── test_endpoints.js     # Manual API verification script (Week 2)
│   └── verify_security_payments.js # Automated payments/security script (Week 3)
├── uploads/                  # Local file storage (gitignored)
├── .env                      # Local environment variables (gitignored)
├── .env.example              # Template with all required keys (updated Week 3)
├── .gitignore
├── package.json
├── README.md
└── server.js                 # Entry point (configured with Webhook, rate-limits, Helmet, CSP, Swagger)
```
