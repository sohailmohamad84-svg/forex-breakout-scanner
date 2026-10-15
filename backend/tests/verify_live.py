import requests
import json

base = "http://127.0.0.1:8000"

print("--- 1. Health check ---")
h = requests.get(f"{base}/api/health").json()
print("Health:", h)
assert h["status"] in ["online", "degraded"]
assert h["database_connected"] is True

print("\n--- 2. Pairs count ---")
pairs = requests.get(f"{base}/api/pairs").json()
print(f"Pairs loaded: {len(pairs)}, first: {pairs[0]}")
assert len(pairs) >= 20

print("\n--- 3. Settings ---")
sett = requests.get(f"{base}/api/settings").json()
print(f"Active Provider: {sett['active_provider']}, Threshold: {sett['probability_threshold']}%")

print("\n--- 4. Trigger Scan ---")
scan_res = requests.post(f"{base}/api/scanner/trigger").json()
print("Scan Result:", scan_res)
assert scan_res["status"] == "success"

print("\n--- 5. Scanner Status ---")
st = requests.get(f"{base}/api/scanner/status").json()
print(json.dumps(st, indent=2))
assert st["pairs_scanned_count"] > 0

print("\n--- 6. Scanner Matrix ---")
mat = requests.get(f"{base}/api/scanner/results").json()
print(f"Total pairs evaluated: {mat['total_evaluated']}")
for r in mat["results"][:3]:
    print(f"  {r['pair']} ({r['timeframe']}): {r['direction']} - Bull:{r['bullish_probability']}% Bear:{r['bearish_probability']}% - Reason: {r['qualification_reason']}")

print("\n--- 7. Market Candles ---")
mc = requests.get(f"{base}/api/market/candles/EUR/USD?timeframe=1h&count=10").json()
print(f"Candles returned: {len(mc.get('candles', []))}")
print(f"Indicator Methodology: {mc.get('indicator', {}).get('methodology')}")

print("\n--- 8. Run Backtest ---")
bt_payload = {
    "pair": "EUR/USD",
    "timeframe": "1h",
    "probability_threshold": 65.0,
    "lookback_candles": 80,
    "percentage_step": 0.002,
    "risk_reward_ratio": 1.5,
    "spread_pips": 1.5,
    "slippage_pips": 0.5,
    "max_holding_bars": 12
}
bt = requests.post(f"{base}/api/backtest/run", json=bt_payload).json()
print(f"Backtest trades: {bt.get('total_trades_executed')}, WinRate: {bt.get('win_rate_percent')}%, Profit Factor: {bt.get('profit_factor')}, Net PnL: {bt.get('net_pnl_pips')} pips")

print("\n>>> ALL LIVE ENDPOINTS VERIFIED SUCCESSFULLY! <<<")
