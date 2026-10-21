# CareRoute — Smart Emergency Hospital Finder & Bed Availability System

A full-stack prototype for discovering hospital options, reviewing administrator-reported bed availability, and navigating to a selected facility. The stack is React + Vite, Node.js + Express, Firebase Authentication, and Cloud Firestore.

> **Safety and data-integrity notice:** Local demo mode uses fictional facilities, coordinates, contact information, and bed counts. It is not suitable for real emergency decisions. In Firebase mode, availability is only as accurate as the latest authorized hospital update; users should contact the hospital to confirm before travelling. This project does not diagnose conditions or perform clinical triage.

## Features in this repository

- Search facilities by name, address, city, or service.
- Filter by general, ICU, oxygen-supported, or ventilator beds and by service.
- Request browser location permission and sort results by Haversine straight-line distance.
- Open directions to a selected facility in Google Maps.
- Display per-bed counts, operating status, and `updatedAt` timestamps.
- Admin sign-in and protected create, update, and delete hospital operations.
- Local in-memory demo data for first-run testing; Firestore persistence when `DATA_MODE=firebase` is configured.
- 15-second browser refresh interval for the hospital list. This is near-live polling, not a continuous push channel.
- Express request validation, Firebase ID-token verification, an environment-configured administrator email allowlist, Helmet security headers, and a GitHub Actions test/build workflow.

## Repository structure

```text
smart-emergency-hospital-finder/
├── client/                 # React/Vite frontend
│   ├── src/App.jsx          # Finder and administrator UI
│   ├── src/api.js           # API client
│   └── src/utils/           # Distance calculation and tests
├── server/                 # Express API
│   ├── src/routes/          # Public, auth, and admin routes
│   ├── src/lib/store.js     # Demo/Firestore data access + validation
│   ├── src/middleware/      # Admin authorization
│   └── test/                # API validation tests
├── firebase/firestore.rules
└── .github/workflows/ci.yml
```

## Requirements

- Node.js 22.12 or newer. Current Vite and Firebase Admin SDK releases require a modern Node runtime.
- npm.
- A modern browser. Browser location requires permission and usually a secure context (localhost is treated as secure for development).

## Run locally in demo mode

Demo mode is the default and does not require Firebase credentials. Records are stored in memory; any admin changes disappear when the server restarts.

### 1. Configure the API

```bash
cd server
cp .env.example .env
```

Open `server/.env`. Keep `DATA_MODE=demo`, and change `DEMO_ADMIN_PASSWORD` and `JWT_SECRET` to values for your local environment. Do not commit `.env`.

Install and start the API:

```bash
npm install
npm run dev
```

The API listens at `http://localhost:4000`. Test its health check at `http://localhost:4000/api/health`.

### 2. Configure the frontend

In another terminal:

```bash
cd client
cp .env.example .env
```

Keep `VITE_DATA_MODE=demo` and `VITE_API_BASE_URL=http://localhost:4000`. Then run:

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

For administrator testing, open **Admin sign in**. Use the email and password set by `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` in `server/.env`. The default local email is `admin@careroute.local`; set your own password before use. The demo login is intentionally disabled from Firebase mode and must never be treated as production authentication.

## Configure Firebase for persistent data

### 1. Create Firebase resources

1. Create a Firebase project in the Firebase console.
2. Under **Authentication → Sign-in method**, enable **Email/Password**.
3. Under **Authentication → Users**, create the administrator account(s).
4. Create a Cloud Firestore database in production mode.
5. Register a Web App in **Project settings** and copy its web configuration.
6. In **Project settings → Service accounts**, generate a private key for the server. Store it securely; never commit the JSON file.

### 2. Configure the server

Copy `server/.env.example` to `server/.env`, then set:

```dotenv
DATA_MODE=firebase
CORS_ORIGIN=http://localhost:5173
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

`FIREBASE_PRIVATE_KEY` must be the service-account private key with line breaks encoded as `\n`. Use a secrets manager or your host's secret environment variables in deployment. The server only authorizes Firebase ID tokens whose verified email matches an email in `ADMIN_EMAILS`; add/remove admins by changing that server environment variable. Avoid using a broad or personal email allowlist.

### 3. Configure the frontend

Copy `client/.env.example` to `client/.env`, then set:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
VITE_DATA_MODE=firebase
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-web-app-id
```

Restart both development servers after changing environment variables. Sign in with the Firebase email/password account created earlier. The API checks the ID token and the administrator allowlist before accepting changes.

### 4. Firestore access rules

Publish `firebase/firestore.rules`. Direct browser reads and writes are denied; the application accesses Firestore through the Express server using the Firebase Admin SDK, which uses its service account. Ensure the server is deployed only over HTTPS and its service-account private key is never exposed to the browser.

The `hospitals` collection and its documents are created on the first successful hospital registration. A document includes identity/contact fields, coordinates, services, `beds` counts, `operatingStatus`, and `updatedAt`.

## API endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check and data mode |
| GET | `/api/auth/session` | Public | Report configured authentication mode |
| POST | `/api/auth/demo-login` | Demo mode only | Local demo admin login |
| GET | `/api/hospitals` | Public | Search/filter hospital records |
| GET | `/api/hospitals/:id` | Public | One hospital record |
| GET | `/api/admin/hospitals` | Admin | List all records, including closed facilities |
| POST | `/api/admin/hospitals` | Admin | Register a hospital |
| PATCH | `/api/admin/hospitals/:id` | Admin | Update hospital fields/bed counts/status |
| DELETE | `/api/admin/hospitals/:id` | Admin | Delete a hospital record |

Admin requests require `Authorization: Bearer <token>`. In demo mode that is a short-lived local JWT. In Firebase mode it must be a Firebase ID token from a user on the configured admin email allowlist.

## Tests and build

```bash
# API validation/auth/data-layer tests
cd server
npm install
npm test

# Frontend distance tests (Node's built-in test runner)
cd ../client
npm install
node --test src/utils/distance.test.js

# Production frontend build
npm run build
```

GitHub Actions also runs the API tests and frontend build on pushes and pull requests to `main`/`master`.

## Deployment outline

Recommended deployment split:

- **Frontend:** Vercel, with `client` as the project root, build command `npm run build`, and output directory `dist`.
- **API:** Render, with `server` as the root directory and start command `npm start`.
- **Persistent database/auth:** Firebase Authentication + Cloud Firestore.

For production, set `DATA_MODE=firebase`, configure all server Firebase secrets as Render environment variables, set `ADMIN_EMAILS` narrowly, and set `CORS_ORIGIN` to the exact Vercel origin. Configure `VITE_API_BASE_URL` to the deployed API URL and set the `VITE_FIREBASE_*` web values in Vercel. These `VITE_` web config values are intentionally client-visible; the service-account private key is not. Never deploy demo mode or fictional demo data as if it were live availability.

## Known limitations / next milestones

- The demo data store is in memory and resets on restart; use Firebase mode for persistence.
- The 15-second refresh is polling, not push-based synchronization. Firestore listeners or Server-Sent Events can be added as a later milestone.
- No hospital-system integration or verification workflow is included yet; data freshness depends on authorized human updates.
- Distance sorting uses straight-line distance, not road distance. Google Maps handles the directions view.
- Hospital data should be verified, contact details confirmed, update timestamps monitored, and access/security reviewed before a real deployment.

## Publish to GitHub

1. Create a **new empty repository** named `smart-emergency-hospital-finder` on GitHub. Do not add a README, license, or `.gitignore` there because this folder already contains them.
2. Open a terminal in this project folder and run:

   ```bash
   git init -b main
   git add .
   git status
   git commit -m "feat: build CareRoute hospital finder MVP"
   git remote add origin https://github.com/YOUR_USERNAME/smart-emergency-hospital-finder.git
   git push -u origin main
   ```

3. Replace `YOUR_USERNAME` with your GitHub username. Use GitHub's browser/device authentication or Git Credential Manager; do not put a personal access token in source code, shell history, or this chat.
4. Open the repository's **Actions** tab and check that the `CI` workflow completes. A successful check is useful build evidence, but it does not prove the real-world accuracy of hospital availability.

Before committing, run `git status` and confirm no `.env`, service-account JSON, credentials, or private keys are staged. The `.gitignore` excludes them, but always inspect the staged file list before pushing.
