# Forex Breakout Probability Scanner

A professional, full-stack quantitative Forex Market Scanner web application based on the **Breakout Probability (Expo) indicator by Zeiierman on TradingView**, inspired by institutional conditional momentum strategies.

The system continuously scans the forex universe, evaluates historical transition distributions, and surfaces high-conviction **BUY** and **SELL** opportunities that meet or exceed a configurable probability threshold (default $\ge 70\%$).

---

## 1. Core Trading Strategy & Methodology

### Indicator Verification & Traceability
- **Reference Indicator**: Breakout Probability (Expo) by Zeiierman on TradingView ([Script Link](https://www.tradingview.com/script/Qt7fqntR-Breakout-Probability-Expo/)).
- **Methodology Classification**: *Conditional Transition Probability Model (Zeiierman Published Model)*.
- **Traceability Notice**: Because the original Pine Script bytecode on TradingView is closed/protected, this application implements Zeiierman's verified published methodology:
  1. **Conditional Partitioning**: Separates historical completed candles based on whether the preceding candle was Bullish (`Close > Open`) or Bearish (`Close < Open`).
  2. **Level 0 (Base High/Low Breakout)**:
     - Bullish Base Level: High of the benchmark candle ($\text{High}_{t-1}$).
     - Bearish Base Level: Low of the benchmark candle ($\text{Low}_{t-1}$).
  3. **Tiered Percentage Steps (Levels 1..4)**:
     - Upper step levels: $\text{Level}_{up, k} = \text{High}_{t-1} \times (1 + k \times \text{step})$
     - Lower step levels: $\text{Level}_{down, k} = \text{Low}_{t-1} \times (1 - k \times \text{step})$
  4. **Empirical Probability Score**:
     Calculates historical conditional frequencies over the lookback window:
     $$P(\text{Bullish Breakout}) = \frac{\sum \mathbb{I}(\text{High}_i > \text{High}_{i-1} \mid \text{Condition})}{\sum \mathbb{I}(\text{Condition})} \times 100\%$$
     $$P(\text{Bearish Breakout}) = \frac{\sum \mathbb{I}(\text{Low}_i < \text{Low}_{i-1} \mid \text{Condition})}{\sum \mathbb{I}(\text{Condition})} \times 100\%$$
  5. **Winning Direction Estimate**: Labeled clearly across the dashboard as an empirical statistical estimate, not a guaranteed win rate.

### Directional Decision Rules
- **BUY Qualification**: Bullish probability $\ge \text{threshold}$ AND Bearish probability $< \text{threshold}$.
- **SELL Qualification**: Bearish probability $\ge \text{threshold}$ AND Bullish probability $< \text{threshold}$.
- **CONFLICT**: Both probabilities $\ge \text{threshold}$ (excluded from signals until resolved).
- **NO SIGNAL**: Neither probability meets threshold (filters out 50–60% chop).
- **INSUFFICIENT DATA**: Sample size below minimum or incomplete historical data.
- **Candle Completion Rule**: Only completed candles generate signals; active unclosed bars are not evaluated to eliminate repainting.
- **Signal Stale Filter**: Signals older than `max_signal_age_minutes` are marked STALE and rejected.

---

## 2. Architecture & Technology Stack

```
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI REST endpoints & Server-Sent Events (SSE)
│   │   ├── engine/          # Breakout Probability indicator & background scanner
│   │   ├── market_data/     # Provider adapters: Yahoo, Twelve Data, OANDA, Mock
│   │   ├── backtesting/     # Walk-forward backtester (zero lookahead)
│   │   ├── alerts/          # Telegram alert dispatcher & deduplicator
│   │   ├── models.py        # SQLAlchemy models (SQLite & PostgreSQL)
│   │   └── database.py      # Database session & engine
│   ├── tests/               # 22 automated unit and integration tests
│   └── run.py               # Uvicorn entrypoint
├── frontend/
│   ├── src/app/             # Next.js 14 App Router
│   ├── src/components/      # Interactive financial dashboard components
│   └── src/lib/             # Typed API client & SSE connector
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── .env.example
└── README.md
```

### Technology Highlights
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Pydantic v2, APScheduler, httpx, yfinance.
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Lucide Icons, Custom High-Performance Canvas Candlestick Chart.
- **Database**: SQLite for immediate zero-config local run; PostgreSQL ready for production via `DATABASE_URL`.
- **Live Updates**: Server-Sent Events (SSE) push live scan notifications directly to connected browsers.

---

## 3. Quickstart & Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Step 1: Clone & Configure Environment
```bash
cp .env.example .env
```

### Step 2: Set Up Backend
```bash
cd backend
pip install -r requirements.txt
python run.py
```
Backend will start on `http://localhost:8000`.
- API Health: `http://localhost:8000/api/health`
- Swagger Docs: `http://localhost:8000/docs`

### Step 3: Run Backend Tests
From the project root:
```bash
python -m pytest backend/tests -v
```
All 22 unit and integration tests will execute.

### Step 4: Set Up Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to access the financial dashboard.

---

## 4. Dashboard Pages Walkthrough

1. **Page A: Market Overview**:
   - 8 summary cards: Total Pairs Enabled, Pairs Scanned, Qualified BUY Candidates, Qualified SELL Candidates, No Valid Signal, Data Provider Health & Latency, Last Successful Scan, and Scanner Engine Status.
   - Distinct notification for genuine zero-signal scan results vs incomplete/failed scans.
   - Live "Scan Now" trigger button.

2. **Page B: Qualified Signals**:
   - Sortable, searchable table displaying only instruments meeting the probability threshold.
   - Shows currency pair, direction, estimated winning probability, bull/bear split, signal price, breakout level, timeframe, and signal age.
   - Clicking any row opens the detailed analysis view.

3. **Page C: Signal Details**:
   - High-performance Candlestick Chart with interactive crosshair, price axis, and overlaid breakout levels.
   - Projected Levels 1..4 with individual empirical hit probabilities.
   - Traceable methodology badge and full qualification decision audit.
   - Direct action to backtest the selected pair.

4. **Page D: All-Pairs Scanner**:
   - Full matrix of every enabled currency pair and timeframe.
   - Explains the exact rejection reason for excluded pairs (e.g. *"Bullish prob 58.2% < 70% threshold"*).

5. **Page E: Historical Signals**:
   - Persistent archive of generated signals that persists across scanner restarts.

6. **Page F: Settings**:
   - Switch market data providers (Yahoo Finance [Free Live], Twelve Data, OANDA, Mock Simulator).
   - Configure probability threshold, lookback candles, percentage step, and scan interval.
   - Manage enabled forex pairs universe and add custom pairs.
   - Configure Telegram notifications.

7. **Backtest Lab**:
   - Walk-forward simulator with strict zero lookahead bias.
   - Simulates fills at bar $t+1$ Open with spread and slippage friction.
   - Generates win rate, profit factor, max drawdown, expectancy, gross vs net PnL, and an equity curve chart.

---

## 5. Docker Deployment

To launch the full stack with Managed PostgreSQL:
```bash
docker-compose up --build -d
```
Services started:
- PostgreSQL on `localhost:5432`
- FastAPI Scanner Backend on `http://localhost:8000`
- Next.js Dashboard Frontend on `http://localhost:3000`


---

## 6. One-Click Cloud Hosting on Vercel (Recommended)

Want to share the scanner dashboard with a friend so they can open it from their smartphone or laptop anywhere for free?

See the 3-minute guide in [DEPLOYMENT_VERCEL.md](DEPLOYMENT_VERCEL.md):
1. **Import on Vercel**: Connect your GitHub repo `sohailmohamad84-svg/forex-breakout-scanner` at [vercel.com/new](https://vercel.com/new).
2. **Set Root Directory**: Select `frontend`.
3. **Deploy**: In 60 seconds, you get a live `https://*.vercel.app` URL.
4. **Share**: Works on iPhone, Android, tablets, and laptops worldwide with native Next.js serverless API routes and live Yahoo Finance forex data.

*(Alternatively, full multi-service deployment with persistent Python workers on Railway is documented in [DEPLOYMENT_RAILWAY.md](DEPLOYMENT_RAILWAY.md)).*

---


## 6. Telegram Alert Integration

To receive instant notifications on Telegram:
1. Message `@BotFather` on Telegram and create a new bot to get a `TELEGRAM_BOT_TOKEN`.
2. Get your numeric ID from `@userinfobot` or create a public channel and obtain `TELEGRAM_CHAT_ID`.
3. Enter both in the **Settings** view of the dashboard or set them in `.env`.
4. Enable the Telegram toggle.
5. Formatted alerts matching the exact user specification will be automatically dispatched upon discovering new qualified signals:

```text
FOREX SIGNAL DETECTED

Pair: GBP/USD
Direction: BUY
Timeframe: 1H
Bullish probability: 74.20%
Bearish probability: 26.50%
Signal price: 1.27500
Breakout level: 1.27620
Signal candle: 2026-10-14 19:00:00 UTC
Data provider: Yahoo Finance
Reason: BUY qualified: Bullish breakout probability >= 70%
```

---

## 7. Compliance & Disclaimer

The calculations and projections provided by this application are for statistical modeling and educational research purposes only. This is an analytical signal-discovery scanner, not an automated trade execution robot. Trading forex involves substantial risk of loss. Past empirical transition frequencies do not guarantee future market results.
