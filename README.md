# StockPilot AI — Browser edition (integrated deployment)

This is one application: **investment planner + US/EU stock/ETF scanner + historical charts + historical scenarios + research links, event context and experimental hypotheses**.

## Deploy publicly (one developer setup, zero investor setup)

1. Create a free Cloudflare account and open **Workers & Pages**.
2. Select **Create Worker**, then **Edit code**.
3. Replace the starter Worker code with the entire contents of `stockpilot-worker.js`.
4. Click **Deploy**. Open the resulting `https://...workers.dev` address.
5. Share that address with users. They enter **only budget, currency, duration and investment preferences**.

Do **not** upload `index.html` alone to GitHub Pages: automatic data calls require the same-origin Worker. The Worker hosts both UI and data proxy. No keys or CSV are required from end users. The provider may block or throttle Yahoo's unofficial chart endpoint, so test it live before publishing.

## Local UI preview
Open `index.html` to inspect layout; market data requires the deployed Worker.

## Limitations
Uses a curated subset of US and European tickers, not a full-market search. Trend-screening rankings are NOT financial advice or personalized suitability assessments. Historical scenario percentiles are NOT predicted future profits. No trading, brokerage connection, or guaranteed outcomes. Data is from Yahoo's unofficial chart endpoint and may be delayed or unavailable. Cross-currency conversions use recent FX quotes and exclude fees, taxes, dividends and FX changes. European investors may be unable to purchase US-domiciled ETFs. News and earnings research opens a third-party source; the app does not automatically interpret full articles. Experimental cultural references are explicitly non-predictive.


## Revised beginner recommendation
The top card now presents one screened investment candidate, purchase quantity, currency conversion and a single illustrative compounded value. The 7% assumption is not a market forecast. Selection is trend-based, not a full valuation or personal-suitability assessment.


2026-10-25 update: all BUY CANDIDATES now show an investment comparison table with dynamically selected duration, converted unit prices, affordable quantities, spent, cash and illustrative value. FX conversion includes quoted rate, source and date. Conversion fails closed when the quote is stale or unavailable.


## Historical-price-specific assumptions
Each instrument now receives a different history-informed annual assumption using up to five years of prices, its latest one-year return, and volatility. This is not a fundamental or geopolitical forecast: no earnings, valuations, or current news feeds are integrated. Do not describe the projections as predicted returns.
