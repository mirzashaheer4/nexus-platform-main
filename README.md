# Nexus Platform

Nexus is an Investor & Entrepreneur Collaboration Platform built with a React frontend and a Node.js/Express/Socket.IO backend.

## Workspace Layout
*   [`/client`](file:///c:/Users/Shahe/OneDrive/Documents/Projects/In_Progress/nexus-platform-main/client): React frontend application
*   [`/server`](file:///c:/Users/Shahe/OneDrive/Documents/Projects/In_Progress/nexus-platform-main/server): Node.js / Express backend server

---

## Local Setup & Run

### 1. Pre-requisites & Copy Assets
Ensure Node.js is installed. Copy original static assets to client public folder:
```bash
Copy-Item -Path "nexus-platform-main/frontend/public/favicon.ico", "nexus-platform-main/frontend/public/logo192.png", "nexus-platform-main/frontend/public/logo512.png" -Destination "client/public/"
```

### 2. Configure Environments
*   **Backend (`/server/.env`)**: Set `PORT=5000`, your MongoDB `MONGO_URI`, and random secret keys for `JWT_SECRET`/`JWT_REFRESH_SECRET`.
*   **Frontend (`/client/.env`)**: Set `REACT_APP_API_URL=http://localhost:5000/api`.

### 3. Concurrent Startup
To start both the backend server and frontend client concurrently:
```bash
# In the root workspace folder
npm run dev
```

This will run:
*   Backend nodemon server on port `5000`
*   Frontend development server on port `3000`
