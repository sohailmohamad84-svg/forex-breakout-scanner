# Railway Deployment & GitHub Guide

This guide walks you through pushing the **Forex Breakout Probability Scanner** to GitHub and hosting it on [Railway.app](https://railway.app) so you and your friends can access the live dashboard from any smartphone, tablet, or laptop worldwide.

---

## Architecture Overview

The repository is structured as a full-stack monorepo:
- **`backend/`**: FastAPI REST API, quantitative calculation engine, market data adapters, background scanner worker, and SQLite/PostgreSQL persistence.
- **`frontend/`**: Next.js 14 reactive dashboard with Tailwind CSS, custom HTML5 canvas candlestick charts, and live Server-Sent Events (SSE).

Railway will host both services under one project, giving you a shareable `https://*.up.railway.app` URL.

---

## Part 1: Push Code to GitHub

### Step 1.1: Create a New GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. Set **Repository name**: e.g., `forex-breakout-scanner`.
3. Choose **Public** or **Private**.
4. **Do NOT** initialize with a README, .gitignore, or license (we already have them configured).
5. Click **Create repository**.
6. Copy the repository URL (e.g., `https://github.com/<your-username>/forex-breakout-scanner.git`).

### Step 1.2: Push Your Local Code
In your project directory terminal (PowerShell or Command Prompt), run:

```bash
# Ensure branch is main
git branch -M main

# Add your GitHub remote (replace with your actual GitHub URL)
git remote add origin https://github.com/<your-username>/forex-breakout-scanner.git

# Push all files to GitHub
git push -u origin main
```

---

## Part 2: Deploy on Railway.app

### Step 2.1: Sign up & Create Project
1. Go to [railway.app](https://railway.app) and sign in with your GitHub account.
2. Click **+ New Project**.
3. Select **Deploy from GitHub repo**.
4. Choose your `forex-breakout-scanner` repository.

---

### Step 2.2: Configure Backend Service
Railway will create the first service. Let's configure it as the **Backend**:

1. Click on the newly created service card, then go to **Settings**:
   - **Service Name**: Change to `backend` (optional, for clarity).
   - **Root Directory**: Set to `/backend`.
2. Go to **Networking** tab:
   - Under **Public Networking**, click **Generate Domain**.
   - Railway will provide a public URL like:
     `https://backend-production-xxxx.up.railway.app`
   - **Copy this backend URL** (you'll need it for the frontend in the next step).
3. (Optional) In **Variables**, you can customize:
   - `DEFAULT_PROVIDER`: `yahoo` (default, free live forex data)
   - `DEFAULT_THRESHOLD`: `70.0`
   - `SCAN_INTERVAL_SECONDS`: `60`
   - `TELEGRAM_ENABLED`: `false` (set to `true` if you configure bot token)

Railway will automatically build and start the backend using `uvicorn` and Python 3.11.

---

### Step 2.3: Configure Frontend Service
Now, let's deploy the Next.js **Frontend** from the same repository:

1. In the same Railway project canvas, click **+ New** (top right) -> **GitHub Repo**.
2. Select the same `forex-breakout-scanner` repository.
3. Click on the new service card, then go to **Settings**:
   - **Service Name**: Change to `frontend`.
   - **Root Directory**: Set to `/frontend`.
4. Go to the **Variables** tab and add:
   - `NEXT_PUBLIC_API_URL`: Paste your backend URL from Step 2.2 (e.g. `https://backend-production-xxxx.up.railway.app`).
   - `BACKEND_URL`: Paste the same backend URL.
5. Go to the **Networking** tab:
   - Under **Public Networking**, click **Generate Domain**.
   - Railway will provide a public URL like:
     `https://frontend-production-yyyy.up.railway.app`

---

## Part 3: Share with Your Friend!

Your dashboard is now live on the internet!

1. Copy your frontend URL:
   `https://frontend-production-yyyy.up.railway.app`
2. Send this link to your friend via WhatsApp, Telegram, or Email.
3. They can open it on:
   - **iPhone / iPad** (Safari, Chrome)
   - **Android phones** (Chrome, Firefox)
   - **Laptops / Mac / Windows**

The dashboard is fully responsive, dark-themed, and updates in real time.

---

## Part 4: (Optional) Adding a Managed PostgreSQL Database

By default, the backend uses SQLite (`forex_scanner.db`), which persists across scans during the container run. If you want permanent database persistence across container redeployments:

1. In Railway project canvas, click **+ New** -> **Database** -> **Add PostgreSQL**.
2. Railway creates a Postgres service and exposes `DATABASE_URL`.
3. In your `backend` service -> **Variables**, add:
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
4. The backend will automatically connect to PostgreSQL and create the tables.

---

## Troubleshooting

- **CORS Errors**: The backend CORS middleware is configured to accept requests from any origin (`*`), eliminating cross-domain blocks between your Railway domains.
- **Port Binding**: Both services read Railway's assigned `$PORT` variable automatically.
- **Data Not Refreshing**: Check backend logs in Railway to confirm Yahoo Finance connectivity. The background scanner runs continuously every 60 seconds.
