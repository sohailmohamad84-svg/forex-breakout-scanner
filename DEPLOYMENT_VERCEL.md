# Deploying Forex Breakout Scanner on Vercel

You can host the **Forex Breakout Probability Scanner** directly on [Vercel](https://vercel.com) for free with zero maintenance.

Your friend will be able to open the resulting `https://*.vercel.app` link on any smartphone (iPhone / Android) or laptop.

---

## 🚀 3-Minute Deployment Steps

### Step 1: Open Vercel Import
1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **+ Add New...** (top right) $\rightarrow$ Select **Project**.
3. Under "Import Git Repository", find:
   `sohailmohamad84-svg/forex-breakout-scanner`
   and click **Import**.

---

### Step 2: Set Root Directory (Important!)
On the "Configure Project" screen:
1. Beside **Root Directory**, click **Edit**.
2. Select or type:
   ```
   frontend
   ```
   *(This tells Vercel to build the Next.js app inside the `frontend/` folder)*.
3. Click **Continue**.
4. Leave **Framework Preset** as **Next.js** (detected automatically).
5. No environment variables are required! The application is self-contained and fetches live market data directly from Yahoo Finance.

---

### Step 3: Click Deploy!
1. Click the blue **Deploy** button.
2. Vercel will build the app in about 45–60 seconds.
3. Once finished, you will see confetti and your live link:
   ```
   https://forex-breakout-scanner-xxxx.vercel.app
   ```

---

## 📱 Share with Your Friend

Send the `https://*.vercel.app` link to your friend!
- **Mobile Phones**: Looks and functions like a native mobile trading app on iPhone Safari or Android Chrome.
- **Laptops / Tablets**: Full wide-screen quantitative dashboard with custom candlestick charts and walk-forward backtest lab.
- **Fast Global CDN**: Vercel serves the dashboard across global edge servers with sub-second response times.

---

## 🔧 Optional: Connecting External Python Backend

If you also wish to connect an external FastAPI backend (e.g. running on Render or Railway):
1. In your Vercel project $\rightarrow$ Go to **Settings** $\rightarrow$ **Environment Variables**.
2. Add:
   - `BACKEND_URL`: `https://your-backend-service.up.railway.app`
3. Redeploy. Next.js will automatically proxy all `/api/*` traffic to your external backend.
