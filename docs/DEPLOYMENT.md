# CareRoute — College Demonstration Deployment Guide

**Document version:** 1.0
**Target release:** Milestone 6 Deployment Readiness
**Target platforms:** Vercel (Frontend Single Page Application) & Render (Backend Web Service)
**Status:** Pre-deployment validated specification (No live resources created yet)

---

## 1. Deployment Architecture

CareRoute employs a decoupled, cloud-native architecture optimized for reliable demonstration, responsive mobile performance, and strict separation of concerns.

```
                              ┌──────────────────────────────────────────────────┐
                              │                 Public End Users                 │
                              │           (Browser / Mobile Web App)             │
                              └────────────────────────┬─────────────────────────┘
                                                       │
                                                       ▼
                              ┌──────────────────────────────────────────────────┐
                              │                 Vercel Edge CDN                  │
                              │       - React 19 Single Page Application         │
                              │       - Vite 8 Production Bundle (`client/dist`) │
                              │       - SPA Rewrites via `client/vercel.json`   │
                              └────────────────────────┬─────────────────────────┘
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           │ API Requests via CORS                                 │ External Routing
                           ▼                                                       ▼
┌──────────────────────────────────────────────────┐   ┌──────────────────────────────────────────────────┐
│             Render Web Service (API)             │   │             Public Geodata Providers             │
│   - Express 5.3 + Node.js 22 runtime             │   │   - OpenStreetMap Tile Server (Visual Map)       │
│   - In-memory Authoritative Domain Store         │   │   - OSRM Public Routing Server (Road Matrix)     │
│   - Tiruchirappalli Pilot Seed Data (4 Facs)     │   └──────────────────────────────────────────────────┘
│   - Health Probes (`/health`, `/api/health`)     │
└──────────────────────────────────────────────────┘
```

### Component Roles & Responsibilities

| Tier | Provider | Service Type | Responsibilities |
|---|---|---|---|
| **Frontend** | Vercel | Static SPA Hosting | Delivers responsive React bundle, handles client-side routing, renders Leaflet maps, coordinates OSRM route queries, enforces read-only public views. |
| **Backend** | Render | Managed Web Service | Validates API payloads, enforces cryptographic JWT authentication and role authorization, executes atomic availability transitions, maintains audit logs. |
| **Map Tiles** | OpenStreetMap | Tile CDN (`tile.openstreetmap.org`) | Provides base map cartography for Tiruchirappalli coordinates without requiring API keys. |
| **Routing** | OSRM | Public Routing Engine (`router.project-osrm.org`) | Calculates turn-by-turn driving distance and estimated travel durations between patient location and shortlist hospitals. |

---

## 2. Security Prerequisites & Invariants

Before initiating any deployment, verify the following non-negotiable security controls:

1. **No Credentials in Bundles or Git**:
   - Production Vite client bundles (`client/dist`) must never contain passwords, private keys, service account credentials, or real personal telephone numbers.
   - All `.env` files must remain strictly excluded via `.gitignore`.
2. **Elimination of Hardcoded Demo Passwords**:
   - The client application (`StaffLoginPage.jsx`) must **never** pre-fill demonstration passwords in state or HTML attributes.
   - Staff login presets populate the **email address only**. The presenter or evaluator must manually supply the secret configured in the backend environment.
3. **Cryptographic Secret Strength**:
   - `JWT_SECRET` must be generated randomly and contain **at least 32 characters** (e.g. 64-character hexadecimal string).
   - `DEMO_ADMIN_PASSWORD` must be a high-entropy string known only to the demonstration administrator.
4. **Emergency Actions Preservation**:
   - Official emergency actions (`tel:112` and `tel:108`) remain active and visible on all pages without authentication.
   - The local testing telephone override (`VITE_SOS_TEST_NUMBER`) is **strictly disabled** in production builds via `import.meta.env.DEV` compiler checks.

---

## 3. Environment Variable Specifications

### A. Frontend Environment Variables (Vercel)

Configure these in the **Vercel Project Settings → Environment Variables** (Environment: Production & Preview):

| Variable Name | Required | Default / Placeholder | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | **Yes** | `https://careroute-api.onrender.com` | Full HTTPS URL of the deployed Render backend (omit trailing slash). |
| `VITE_DATA_MODE` | **Yes** | `demo` | Sets client mode. Must be set to `demo` for college demonstration. |
| `VITE_OSM_TILE_URL` | Optional | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | OpenStreetMap tile template URL. |
| `VITE_OSRM_BASE_URL` | Optional | `https://router.project-osrm.org` | OpenStreetMap road routing engine API URL. |
| `VITE_SOS_TEST_NUMBER` | **No** | *(Leave empty)* | Development-only phone test override. Automatically ignored in production builds. |

> [!IMPORTANT]
> Because Vite injects environment variables with the `VITE_` prefix at compile time, you must trigger a redeploy on Vercel whenever `VITE_API_BASE_URL` is updated.

---

### B. Backend Environment Variables (Render)

Configure these in the **Render Web Service → Environment Variables**:

| Variable Name | Required | Default / Placeholder | Description |
|---|---|---|---|
| `NODE_VERSION` | **Yes** | `22.12.0` | Enforces modern Node.js runtime. |
| `DATA_MODE` | **Yes** | `demo` | Activates in-memory store and Tiruchirappalli pilot seed data. |
| `CORS_ORIGIN` | **Yes** | `https://careroute.vercel.app` | Comma-separated list of allowed frontend origins. Must match your Vercel deployment URL exactly (no trailing slash). |
| `JWT_SECRET` | **Yes** | `[REPLACE_WITH_MIN_32_CHAR_RANDOM_SECRET]` | Cryptographic signing secret for demo staff session tokens (min 32 characters). |
| `DEMO_ADMIN_EMAIL` | **Yes** | `admin@careroute.local` | Platform administrator account email for demonstration sign-in. |
| `DEMO_ADMIN_PASSWORD` | **Yes** | `[REPLACE_WITH_SECURE_PRESENTATION_PASSWORD]` | Secret demonstration password used to authenticate all seeded demo staff roles. |
| `PORT` | Auto | *(Injected by Render)* | Render assigns dynamic port (typically `10000`). |
| `ENABLE_DEMO_LOGIN` | Optional | `false` | Gate for demo login routes (`/api/auth/demo-login`). Must remain `false` (default) in production. |
| `DATABASE_URL` | For Postgres | *(Managed DB URL)* | PostgreSQL connection string (`postgres://user:pass@host:5432/dbname`). |
| `DATABASE_SSL` | For Postgres | `true` | Enables TLS for PostgreSQL connections. Set to `true` on managed cloud providers. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | For Postgres | `true` | Enforces TLS certificate validation. Defaults to `true`. Never set to `false` in production. |
| `DATABASE_SSL_CA` | For Postgres | *(Optional)* | Custom CA certificate string or path if the database provider requires a custom root CA. |

> [!CAUTION]
> Never use placeholder values such as `password123` or copy default strings from `.env.example` in a public deployment. Generate a fresh secret using:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
> In production environments utilizing PostgreSQL (`DATA_MODE=postgres`), ensure `ENABLE_DEMO_LOGIN=false` is enforced so that unauthenticated actors cannot access staff routes using shared demo presets.

---

## 4. Step-by-Step Hosting Setup

### Step 1: Deploy Backend to Render First

Because the frontend requires the backend URL at build time, deploy the backend service first.

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository: `https://github.com/nishanthpn006/CareRoute.git`.
4. Configure service parameters:
   - **Name**: `careroute-api`
   - **Region**: Singapore (`singapore`) or Frankfurt (choose closest to India for minimal latency)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (or Starter for persistent zero-sleep performance)
5. Expand **Advanced** settings:
   - **Health Check Path**: `/health` (or `/api/health`)
   - **Auto-Deploy**: `Yes`
6. Under **Environment Variables**, add the backend variables listed in Section 3B.
7. Click **Create Web Service**.
8. Wait for deployment to complete. Copy your allocated service URL (e.g., `https://careroute-api.onrender.com`).

---

### Step 2: Deploy Frontend to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/).
2. Click **Add New…** → **Project**.
3. Import the `nishanthpn006/CareRoute` repository.
4. In the project configuration modal:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`client`**.
5. In **Build and Output Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
6. In **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://careroute-api.onrender.com` (use your actual Render URL from Step 1)
   - `VITE_DATA_MODE`: `demo`
7. Click **Deploy**.
8. When the deployment finishes, copy your production domain (e.g. `https://careroute-alpha.vercel.app`).
9. **Return to Render**: Update the `CORS_ORIGIN` variable with your actual Vercel domain to permit cross-origin requests.

---

### Step 3: SPA Deep-Linking Verification (`client/vercel.json`)

Vercel static hosting requires rewrite rules so that direct browser navigation or page refreshes on sub-routes (such as `/find-hospitals`, `/emergency`, or `/staff`) do not return 404 errors.

CareRoute includes [`client/vercel.json`](file:///d:/Coding/smart-emergency-hospital-finder/client/vercel.json):

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures Vercel routes all client requests to `index.html` where React Router handles route matching.

---

## 5. Post-Deployment Smoke Test & Verification

Execute this sequence immediately following deployment:

### 1. Backend Health Check
In a browser or terminal:
```bash
curl -i https://your-backend.onrender.com/health
```
Expected response:
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "ok",
  "service": "careroute-api",
  "dataMode": "demo",
  "timestamp": "2026-10-21T..."
}
```

### 2. Public Directory Projection Check
```bash
curl -i https://your-backend.onrender.com/api/hospitals
```
- Verify status 200 OK.
- Verify array contains 4 facilities (MGMGH, Srirangam, Manapparai, Apollo).
- Verify private verification fields are strictly omitted.

### 3. Frontend Web Workflow Check
1. Open `https://your-frontend.vercel.app/` in your browser.
2. Click **Find Nearby Hospitals** to load `/find-hospitals`.
3. Verify that facility bed availability tiles display **`Not reported`** (never numeric 0).
4. Refresh the page at `/find-hospitals` — confirm it loads without a 404 error.
5. Open `/emergency` — verify official `112` and `108` links are present and tap-to-call works.

### 4. Staff Portal Demo Flow
1. Navigate to `https://your-frontend.vercel.app/staff/login`.
2. Click the preset **Facility Reporter (MGM GH)** (`reporter@mgmgh.local`).
3. Enter your secret `DEMO_ADMIN_PASSWORD`.
4. Submit report: update ICU bed count (e.g. 5 available out of 20 total).
5. Switch back to `/find-hospitals`: confirm MGMGH now displays 5 / 20 confirmed ICU beds with a **Confirmed (≤15m)** freshness badge.

---

## 6. Known Limitations for College Demonstration

| Limitation | Impact | Mitigation / Talking Point |
|---|---|---|
| **Render Free Tier Spin-Down** | If inactive for 15+ minutes, Render spins down the backend container. The next HTTP request will experience a 30–50 second cold-start delay. | Trigger a ping (`/health`) 5 minutes prior to the presentation to warm up the instance. |
| **In-Memory Volatility** | In `demo` mode, all bed updates and registered draft facilities are stored in RAM. Any server restart or redeploy resets state to the default seed data. | Emphasize that the demonstration intentionally showcases atomic state updates and audit logging without leaving test data in production databases. |
| **Public OSRM SLA** | The demo server (`router.project-osrm.org`) is a shared community service without an uptime SLA. It may occasionally rate-limit or fail under heavy burst traffic. | CareRoute automatically falls back to straight-line Euclidean distance if road routing times out or fails. |
| **OpenStreetMap Tile Policy** | `tile.openstreetmap.org` is a free public tile cache subject to usage policies. High-volume scraping or heavy continuous zooming is prohibited. | Browser caches map raster tiles locally; zooming within Tiruchirappalli coordinates stays well within fair usage limits. |

---

## 7. Rollback Guidance

In the event of an unexpected runtime failure or demonstration glitch:

1. **Vercel Instant Rollback**:
   - Go to **Vercel Dashboard → Project → Deployments**.
   - Select the previous stable deployment and click **Promote to Production**. Instant rollback takes effect in < 5 seconds.
2. **Render Redeploy**:
   - Go to **Render Dashboard → Web Service → Events**.
   - Click **Rollback** to the preceding build, or select **Manual Deploy → Deploy latest commit**.
3. **Local Fallback (Zero Risk)**:
   - If hosting networks fail during evaluation, run the tested local environment:
     ```bash
     # Terminal 1 (Backend)
     cd server && npm start

     # Terminal 2 (Frontend)
     cd client && npm run dev
     ```
   - Connect via `http://localhost:5173`. Local operation uses identical components and requires zero internet connectivity for local mock tiles or offline testing.

---

## 8. PostgreSQL Backup, Protection, and Recovery Procedures

When CareRoute is deployed with persistent PostgreSQL storage (`DATA_MODE=postgres`), operational availability reports, facility registry states, and audit trails must be reliably backed up and safeguarded against disaster or data loss.

### A. Backup Generation (`pg_dump`)

Database backups should be taken automatically on a scheduled basis (e.g., daily full snapshot, with WAL archiving for point-in-time recovery on managed providers):

```bash
# Generate custom compressed archive
pg_dump -Fc --no-acl --no-owner \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f "/tmp/careroute_backup_$(date +%Y%m%d_%H%M%S).dump"
```

> [!WARNING]
> **Compression Is Not Encryption!**
> A compressed PostgreSQL dump file (`pg_dump -Fc` or `.sql.gz`) only reduces file size. **It is NOT encrypted.** All hospital metadata, verification logs, staff emails, and availability reports remain readable in plaintext to anyone who gains access to the dump file. Unencrypted backup dumps must never be transmitted over public networks or stored in unencrypted storage buckets.

---

### B. Protecting and Encrypting Backups at Rest

To comply with health data protection standards and operational security best practices:

1. **Encrypt Before Storage or Egress**:
   Encrypt backup archives immediately following dump completion using strong symmetric encryption (AES-256) before uploading to object storage:
   ```bash
   # Example: Encrypting backup with OpenSSL AES-256-CBC
   openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
     -in /tmp/careroute_backup_20261027.dump \
     -out /tmp/careroute_backup_20261027.dump.enc \
     -pass env:BACKUP_ENCRYPTION_KEY

   # Securely shred the temporary plaintext dump immediately
   shred -u /tmp/careroute_backup_20261027.dump
   ```
   *(Alternatively, use `gpg --symmetric --cipher-algo AES256` or `age -r <public-key>` for public-key encryption.)*

2. **Encryption Key Isolation**:
   - The backup encryption key (`BACKUP_ENCRYPTION_KEY`) must **never** be stored on the database server itself or co-located with the backup archive.
   - Store keys in a dedicated Cloud KMS, HashiCorp Vault, or offline secrets manager.

3. **Storage Immutability and Access Control**:
   - Store encrypted backups in dedicated object storage (e.g., AWS S3 with Object Lock or GCP Cloud Storage Bucket Lock) enforcing WORM (Write-Once-Read-Many) policies.
   - Enforce least-privilege IAM policies: the backup runner role should possess write-only permissions (`s3:PutObject`), preventing a compromised runner from deleting or reading existing archives.
   - Enforce server-side encryption with KMS customer-managed keys (dual-layer defense).

4. **File Permissions & Retention**:
   - Restrict local staging file permissions to `chmod 600`.
   - Implement automated lifecycle deletion policies (e.g., 30-day daily retention, 12-month monthly retention).

---

### C. Restoration Verification Procedure

An unverified backup is not a valid backup. Restoration procedures must be periodically tested in an isolated sandbox environment without impacting live operations.

> [!CAUTION]
> **Never test restoration on a production database.** Always restore to a temporary or staging instance.

#### Periodic Verification Drill:

1. **Provision Staging Database**:
   Create an isolated verification database:
   ```bash
   createdb -h localhost -U postgres careroute_restore_test
   ```

2. **Decrypt Archive in Memory / Secure Directory**:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
     -in /tmp/careroute_backup_20261027.dump.enc \
     -out /tmp/careroute_restoring.dump \
     -pass env:BACKUP_ENCRYPTION_KEY
   ```

3. **Execute Clean Restore**:
   ```bash
   pg_restore -v --clean --no-acl --no-owner \
     -h localhost -U postgres -d careroute_restore_test \
     /tmp/careroute_restoring.dump

   # Immediately remove decrypted dump file
   shred -u /tmp/careroute_restoring.dump
   ```

4. **Validate Data Integrity & Health**:
   Execute programmatic checks against `careroute_restore_test`:
   ```sql
   -- Verify core tables and records exist
   SELECT COUNT(*) AS total_facilities FROM facilities;
   SELECT COUNT(*) AS total_reports FROM availability_reports;
   SELECT COUNT(*) AS total_snapshots FROM availability_current;
   SELECT COUNT(*) AS total_audit_entries FROM audit_events;

   -- Verify latest migration applied
   SELECT MAX(name) FROM schema_migrations;
   ```

5. **Application Health Verification**:
   Run the test suite or launch a temporary backend pointing to `careroute_restore_test`:
   ```bash
   DATABASE_URL="postgres://user:pass@localhost:5432/careroute_restore_test" npm test
   ```
   Confirm that all domain read/write operations pass.

6. **Tear Down**:
   Drop the test database once verification completes:
   ```bash
   dropdb -h localhost -U postgres careroute_restore_test
   ```

---

## 9. Individual Staff Authentication & Secure Account Provisioning

CareRoute supports persistent individual staff authentication backed by PostgreSQL. Shared demo credentials and universal passwords are strictly prohibited in production.

### A. Authentication Architecture

- **Password Hashing Algorithm**: Argon2id (`argon2id`, memory: 64 MB, iterations: 3, parallelism: 4).
- **Schema**: PostgreSQL migration `002_add_user_password_hash.sql` provides the `password_hash` column on `users`.
- **Zero Plaintext Storage**: Plaintext passwords are never persisted to disk, written to logs, or included in API responses.
- **Unprovisioned Account Default Denial**: Pre-seeded staff accounts have `password_hash = NULL` by default. They cannot log in via `/api/auth/login` until an individual password has been explicitly provisioned.
- **User Enumeration Defense**: Invalid passwords, unprovisioned accounts, and non-existent emails return an identical generic response:
  ```json
  HTTP/1.1 401 Unauthorized
  { "error": "Invalid email or password." }
  ```
  Constant-time dummy hashing is executed when an email is unknown, neutralizing timing-based user enumeration.
- **Brute-Force Rate Limiting**: The login endpoint enforces rate limiting (5 failed attempts per 15-minute window per IP and email combination). Excess requests are rejected with:
  ```json
  HTTP/1.1 429 Too Many Requests
  Retry-After: 900
  { "error": "Too many login attempts. Please try again later." }
  ```

---

### B. Safe Account Provisioning Procedure

Staff credentials must be provisioned locally or via a secure administrative session using the `set-password` CLI script.

> [!IMPORTANT]
> **No Universal Default Passwords**:
> CareRoute does not create default administrator passwords. Every operational staff member and platform administrator must have a unique password explicitly set.

#### Provisioning Steps:

1. **Verify Target User Exists in Database**:
   The staff member must already be registered in the `users` table with their assigned role and facility/organization relations.

2. **Execute Interactive Password Tool**:
   From the server directory (or production container shell):
   ```bash
   # Syntax: npm run set-password -- <staff-email>
   npm run set-password -- admin@careroute.local
   ```

3. **Provide Password Interactively**:
   The tool prompts for the password without echoing keystrokes to the terminal screen:
   ```text
   Enter new password for admin@careroute.local (organization_admin): [hidden]
   Confirm password: [hidden]
   ```
   - **Minimum Length**: 10 characters.
   - **Shell Safety**: The password never appears in shell history (`.bash_history`), process listings (`ps aux`), or command-line arguments.

4. **Verify Provisioning Result**:
   The tool will output:
   ```text
   [CareRoute Admin] Success: Password set for "admin@careroute.local" (organization_admin).
   [CareRoute Admin] Existing role, organization, and facility assignments preserved.
   [CareRoute Admin] Account is now ready for individual login.
   ```
   An audit log record is automatically written to `audit_events` (`action: user.password_provisioned`).

---

### C. Design Decisions & Security Controls

1. **No Public Registration**:
   Public registration endpoints are intentionally not implemented. Hospital staff and facility reporters are provisioned by organization administrators or authorized deployment operators.
2. **No Unauthenticated Password Reset**:
   CareRoute does not expose unauthenticated email password-reset links (which introduce account takeover vectors without corporate email integration). Password resets require administrative provisioning through the CLI or authorized internal ticketing.
3. **Account Deactivation Immediate Enforcement**:
   Setting a user's status to `inactive` or `suspended` immediately revokes login permissions (`403 Forbidden`) and invalidates active session tokens upon the next request.
4. **Deleted User Immediate Rejection**:
   Tokens presenting a user ID or email that has been deleted from PostgreSQL are rejected with `401 Unauthorized` without synthesizing fallback records.
