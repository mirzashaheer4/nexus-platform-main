# <p align="center"><img src="https://img.icons8.com/color/120/000000/connect.png" alt="Nexus Logo" /><br>Nexus Platform</p>

<p align="center">
  <strong>An elite collaboration ecosystem connecting Investors and Entrepreneurs with integrated document signing, real-time video conferencing, and automated Stripe financial ledgers.</strong>
</p>

<p align="center">
  <a href="https://github.com/mirzashaheer4/nexus-platform-main"><img src="https://img.shields.io/github/repo-size/mirzashaheer4/nexus-platform-main?style=for-the-badge&color=8A2BE2" alt="Repo Size"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.2.7-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-4.19-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express"></a>
  <a href="https://www.mongodb.com/"><img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"></a>
  <br>
  <a href="https://stripe.com/"><img src="https://img.shields.io/badge/Stripe-14.0.0-008cdd?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.io-4.7.5-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel"></a>
  <a href="https://render.com/"><img src="https://img.shields.io/badge/Render-Deploy-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Render"></a>
</p>

---

## 📖 Table of Contents
- [🎯 Vision & Purpose](#-vision--purpose)
- [✨ Key Features](#-key-features)
  - [🔐 Security & Authentication](#-security--authentication)
  - [💼 Dashboards & Roles](#-dashboards--roles)
  - [📅 Meetings & WebRTC Video Calls](#-meetings--webrtc-video-calls)
  - [📄 Secure Document & Signature Management](#-secure-document--signature-management)
  - [💳 Payment Gateway & Internal Ledger](#-payment-gateway--internal-ledger)
- [🛠️ Tech Stack & Key Libraries](#️-tech-stack--key-libraries)
- [📁 Project Architecture](#-project-architecture)
- [⚙️ Environment Settings](#️-environment-settings)
- [🚀 Local Setup & Installation](#-local-setup--installation)
- [📡 API Routes & Reference](#-api-routes--reference)
- [🔒 Enterprise-Grade Security Controls](#-enterprise-grade-security-controls)
- [🌐 Deployment Blueprints](#-deployment-blueprints)
  - [Frontend (Vercel)](#frontend-vercel)
  - [Backend (Render)](#backend-render)

---

## 🎯 Vision & Purpose
Nexus Platform bridges the gap between venture capital and entrepreneurial execution. The platform replaces disjointed communications (emails, calendars, DocuSign, Zoom, and bank transfers) with an **all-in-one secured portal**. Entrepreneurs can pitch ideas, share NDA-protected documents, hop on instant video calls, sign agreements, and receive milestones/investments in a single friction-free workspace.

---

## ✨ Key Features

### 🔐 Security & Authentication
*   **Dual-Token Auth**: Session validation via JWT access tokens and secure HTTPOnly cookie refresh tokens to mitigate XSS attacks.
*   **Two-Factor Authentication (2FA)**: Opt-in 2FA sending secure 6-digit OTP codes via Nodemailer (with Ethereal local test logging and Gmail fallback).
*   **Advanced Encryption**: Hashed passwords using `bcryptjs` with **12 salt rounds** and SHA-256 encrypted forgot/reset password links.
*   **Role Isolation**: Strict middleware verification ensuring Investors only access investor-specific dashboard analytics and data, and vice versa.

### 💼 Dashboards & Roles
*   **Entrepreneur Hub**: Track overall meetings, active/signed documentation, wallet funding, and transaction ledgers.
*   **Investor Suite**: Aggregate portfolio insights, audit proposal agreements, schedule video conferences, and execute balance transfers.

### 📅 Meetings & WebRTC Video Calls
*   **Interactive Scheduler**: Propose multiple slots, accept/decline, and automatically monitor meeting states.
*   **Peer-to-Peer Video**: Fully integrated client WebRTC connections powered by room-orchestrating `Socket.io` signals. Launch video/audio streams instantly inside the web portal.

### 📄 Secure Document & Signature Management
*   **Multi-Storage Support**: Upload PDFs and agreements to **Amazon AWS S3** with local directory uploads as fallback.
*   **Digital E-Signatures**: Sign shared agreements directly in-browser using a custom signature pad. Track signature logs and status badges (e.g., `Pending`, `Signed`).
*   **Strict Access Control**: `verifyOwnership` middleware blocks third parties from reading, downloading, or altering private user agreements.

### 💳 Payment Gateway & Internal Ledger
*   **Stripe Integration**: Load funds securely with the Stripe payment intent engine using a card input form.
*   **Multi-User Ledger**: Real-time internal balance transfers between Investor and Entrepreneur wallets with zero latency.
*   **Ledger Security**: Transactions stored with high precision (calculated in cents to avoid float point errors) and audit-trail logging (`Deposit`, `Withdraw`, `Transfer`).
*   **Webhook Resilience**: Stripe webhook handler dynamically catches direct events (`payment_intent.succeeded` & `payment_intent.payment_failed`) to update ledger status asynchronously.

---

## 🛠️ Tech Stack & Key Libraries

### Frontend (`/client`)
*   **Core**: React 19, Axios, React Router Dom v7, Context APIs
*   **Payments**: `@stripe/react-stripe-js` & `@stripe/stripe-js`
*   **Real-time & Media**: `socket.io-client`, WebRTC API, `react-signature-canvas` & `signature_pad`
*   **Styling**: TailwindCSS, PostCSS, Autoprefixer

### Backend (`/server`)
*   **Core**: Node.js, Express, MongoDB + Mongoose ODM, JWT authentication
*   **Security & Sanitizers**: `helmet` (with Stripe CSP policies), `express-rate-limit`, `xss-clean`, `express-mongo-sanitize`, `hpp` (HTTP Parameter Pollution defense)
*   **File Storage**: `aws-sdk`, `multer`, `multer-s3`
*   **APIs & Docs**: `swagger-ui-express`, `swagger-jsdoc`

---

## 📁 Project Architecture

```
nexus-platform-main/
├── client/                     # React Single Page Application (Vite/CRA style)
│   ├── src/
│   │   ├── components/         # Shared UI (Navbar, ProtectedRoutes, etc.)
│   │   ├── contexts/           # AuthContext (JWT, OTP, & user profile states)
│   │   ├── pages/              # Dashboards, Document Management, Meetings, WebRTC video
│   │   ├── App.jsx             # React Routes config
│   │   └── index.js            # App Bootstrapper
│   ├── public/                 # Static assets
│   └── vercel.json             # Vercel SPA routing fallback directives
├── server/                     # Express API Server
│   ├── middleware/             # auth, rateLimiter, validator, verifyOwnership
│   ├── models/                 # MongoDB schemas (User, Profile, Wallet, Transaction, Document, Meeting)
│   ├── routes/                 # Express REST routers (auth, payments, meetings, documents, profile, dashboard)
│   ├── utils/                  # email.js (Nodemailer config)
│   ├── server.js               # Express application and Socket.io bootstrapper
│   └── .env.example            # Backend environmental template
├── docs/                       # Swagger metadata and Postman collections
└── package.json                # Root concurrently development runner
```

---

## ⚙️ Environment Settings

### Backend Environments (`server/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | API listening port | `5000` |
| `NODE_ENV` | Environment context | `development` / `production` |
| `MONGO_URI` | MongoDB Connection URI | `mongodb+srv://...` or local host |
| `JWT_SECRET` | Secret key used to sign Access Tokens | *cryptographic key* |
| `JWT_REFRESH_SECRET` | Secret key used to sign Refresh Tokens | *cryptographic key* |
| `CLIENT_URL` | Frontend URL for CORS configuration | `http://localhost:3000` |
| `STRIPE_PUBLIC_KEY` | Stripe Sandboxed Public Key | `pk_test_...` |
| `STRIPE_SECRET_KEY` | Stripe Sandboxed Secret Key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Signing Webhook Signature | `whsec_...` |
| `EMAIL_SERVICE` | Nodemailer SMTP Provider | `gmail` or `ethereal` |
| `EMAIL_USER` | Email username for email notifications | `example@gmail.com` |
| `EMAIL_PASS` | App password for SMTP auth | `xxxx xxxx xxxx xxxx` |
| `AWS_ACCESS_KEY` | S3 Access Credentials | *your aws key* (optional fallback) |
| `AWS_SECRET_KEY` | S3 Secret Credentials | *your aws secret* (optional fallback) |
| `AWS_BUCKET_NAME` | AWS Storage Bucket ID | `nexus-bucket-prod` |
| `AWS_REGION` | AWS Data Region | `us-east-1` |
| `UPLOAD_PATH` | Local file uploads folder fallback | `uploads` |

### Frontend Environments (`client/.env`)
| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `REACT_APP_API_URL` | Absolute URL of the Express API service | `http://localhost:5000/api` |
| `REACT_APP_STRIPE_PUBLIC_KEY` | Client-side Stripe tokenization key | `pk_test_...` |

---

## 🚀 Local Setup & Installation

Follow these steps to run Nexus on your local machine:

### 1. Prerequisite Checks
Ensure you have **Node.js 18+** and a running instance of **MongoDB** (local or Atlas cloud cluster).

### 2. Clone and Install Root Modules
```bash
git clone https://github.com/mirzashaheer4/nexus-platform-main.git
cd nexus-platform-main
npm install
```

### 3. Install Client & Server Dependencies
```bash
# Install server modules
cd server
npm install

# Install client modules
cd ../client
npm install
```

### 4. Set Up Environment Files
Create configuration files using the examples:
*   In `/server`, copy `.env.example` to `.env` and fill in credentials.
*   In `/client`, create a `.env` file specifying `REACT_APP_API_URL` and `REACT_APP_STRIPE_PUBLIC_KEY`.

### 5. Launch Development Servers Concurrently
Go back to the root folder and run:
```bash
cd ..
npm run dev
```
This triggers the root command `npx concurrently` to fire up:
*   **Backend Server** at `http://localhost:5000` (monitored with Nodemon)
*   **Frontend client** at `http://localhost:3000` (React Webpack Dev Server)

---

## 📡 API Routes & Reference

The API endpoints are documented interactively with Swagger at `http://localhost:5000/api/docs`. Below is a quick overview of primary service groupings:

### 🔐 Authentication Module (`/api/auth`)
| HTTP Method | Route | Auth Required? | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | No | Create user profile as investor/entrepreneur |
| `POST` | `/login` | No | Performs sign-in, returns JWT, triggers 2FA if active |
| `POST` | `/logout` | Yes | Clears session cookies |
| `POST` | `/refresh` | No | Uses HTTPOnly refresh cookie to grant new access token |
| `POST` | `/request-otp`| Yes | Sends a 2FA OTP code via user's email |
| `POST` | `/verify-otp` | No | Validates 6-digit OTP code to complete login |
| `POST` | `/enable-2fa` | Yes | Enable Two-Factor Auth on account |
| `POST` | `/disable-2fa`| Yes | Disable Two-Factor Auth |
| `POST` | `/forgot-password` | No | Generates email password reset request link |
| `POST` | `/reset-password/:token`| No | Updates password using SHA-256 reset token |

### 💼 Portfolio Profiles & Dashboards
| HTTP Method | Route | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile` | Auth Required | View user profile details |
| `PUT` | `/api/profile` | Auth Required | Edit profile data and bio |
| `GET` | `/api/dashboard/investor` | Investor Role | Read investor KPIs, deal sizes, documents |
| `GET` | `/api/dashboard/entrepreneur`| Entrepreneur | Read startup KPIs, documents, wallet status |

### 📅 Collaboration Meetings (`/api/meetings`)
*Protected by `verifyToken` & `verifyOwnership`*
| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Retrieve all meetings where user is organizer or invitee |
| `POST` | `/` | Create a new scheduled meeting proposal |
| `PUT` | `/:id` | Update meeting details |
| `DELETE` | `/:id` | Cancel/remove scheduled meeting |
| `PUT` | `/:id/accept` | Accept a meeting slot |
| `PUT` | `/:id/decline` | Decline a meeting proposal |

### 📄 Digital Document Vault (`/api/documents`)
*Protected by `verifyToken` & `verifyOwnership`*
| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Fetch documents owned or shared with the user |
| `POST` | `/` | Upload new PDF/DOCX agreement (AWS S3 or Local) |
| `PUT` | `/:id/sign` | Digitally sign document via canvas base64 image data |
| `GET` | `/:id/download`| Securely retrieve document file streams |
| `DELETE` | `/:id` | Revoke/delete uploaded document |

### 💳 Stripe & Wallet Ledger (`/api/payments`)
*Protected by `verifyToken`*
| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/create-intent` | Get Stripe clientSecret for input amount |
| `POST` | `/deposit` | Confirm payment success and credit wallet balance |
| `POST` | `/confirm/:intentId`| Server-side Stripe API sync & reconciliation fallback |
| `POST` | `/withdraw` | Transfer wallet balance back to bank account (in cents) |
| `POST` | `/transfer` | Direct wallet-to-wallet transfer using recipient email |
| `GET` | `/balance` | Check user wallet balance |
| `GET` | `/history` | Fetch ledger audit trail sorted newest first |
| `POST` | `/webhook` | Raw body Stripe webhook listener (skips rate limiting) |

---

## 🔒 Enterprise-Grade Security Controls

Nexus maintains robust safety defenses protecting data and communication:
1.  **Rate Limiting Policies**:
    *   *Global API Level*: 100 requests per 15 minutes.
    *   *Auth Gateway*: Limit of 10 requests per 15 minutes (prevents brute forcing).
    *   *Payments Suite*: Limit of 20 requests per hour (mitigates carding/credit fraud).
2.  **Payload Protection**:
    *   `express-mongo-sanitize` filters nested operators to block NoSQL query injections.
    *   `xss-clean` strips tags from input arguments.
    *   `hpp` removes duplicate query parameters to stop HTTP Parameter Pollution.
3.  **Strict Resource Access**:
    *   The `verifyOwnership` middleware matches database document owner IDs against client JWT payloads. This stops users from downloading files or modifying meetings using random Mongo IDs.
4.  **CSP Headers**:
    *   `helmet` configures HTTP response headers including Strict-Transport-Security (HSTS), X-Frame-Options, and custom Content Security Policies whitelist allowing script loads from `https://js.stripe.com`.

---

## 🌐 Deployment Blueprints

### Frontend (Vercel)
The React application contains a routing fallback profile (`client/vercel.json`) to allow React Router to manage paths on reload without producing a `404` error:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
1.  Connect your repository branch to the Vercel dashboard.
2.  Set the **Root Directory** as `client`.
3.  Set the **Build Command** as `npm run build` and **Output Directory** as `build`.
4.  Configure environment variables: `REACT_APP_API_URL` pointing to backend Render service, and `REACT_APP_STRIPE_PUBLIC_KEY`.

### Backend (Render)
1.  Create a Web Service on Render, connect your Git repository.
2.  Set the **Root Directory** as `server`.
3.  Specify the **Start Command** as `npm start`.
4.  Set all standard environment variables matching the env specifications.
5.  Set `NODE_ENV=production` to enforce HTTPOnly secure cookie configurations.
6.  Set Render's Health Check Path to `/api/health`.
7.  Copy the backend domain URL and paste it into the Stripe developer dashboard webhooks tab (e.g., `https://nexus-api.onrender.com/api/payments/webhook`), registering `payment_intent.succeeded` and `payment_intent.payment_failed` triggers. Add the generated `whsec_...` key back to the Render dashboard config environment.

---

<p align="center">
  <sub>Developed with 💜 for secure investor relations.</sub>
</p>
