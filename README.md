# MarketPulse AI — Stock Predictor

A beginner-friendly Vercel website for NSE stock analysis.

## Run locally
Requires Node.js.
1. Put this folder on your computer.
2. Install Vercel CLI: `npm i -g vercel`
3. Run: `vercel dev`
4. Open the local URL shown by Vercel.

## Deploy
1. Create a free Vercel account.
2. Import this project/repository.
3. Deploy. No environment variables are required.

## What it does
- Fetches NSE-symbol historical prices through Yahoo Finance's chart endpoint.
- Calculates RSI, moving averages, momentum and volume signals.
- Produces Bullish / Bearish / Neutral classification.
- Produces a simple 20-session regression forecast.
- Shows a price chart and signal breakdown.

## Important
This is an educational quantitative tool, not investment advice. The forecast is not guaranteed and should be backtested and validated before real-money use. Data availability and third-party API access can change.
