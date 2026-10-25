# StockPilot AI v1.3 — Open-Source TensorFlow.js Research Assistant

**Live demo:** https://stockpilot-ai.sandeela.workers.dev/  
**License:** MIT (project code); TensorFlow.js is Apache-2.0.

## Hacktoberfest Week 3 — Slow and Steady

StockPilot automates repetitive historical market screening. Enter a budget and timeframe; it gathers historical data for selected US and European stocks and ETFs, trains a local ML classifier for each instrument, and produces an AI-ranked research shortlist with transparent validation, affordable whole-share quantities, FX conversions, and illustrative scenarios. It never executes trades.

## Open-source AI at the core

The application loads **TensorFlow.js 4.22.0** (Apache-2.0) from jsDelivr. A local KNN classifier learns from labeled historical 20-day momentum, 50-day momentum and volatility features; its tensor distance calculations and nearest-neighbor inference run in the **browser** using TensorFlow.js. The app performs a chronological 80/20 holdout, reports directional accuracy and a majority-class baseline, then refits on eligible historical examples. **AI scores determine candidate rankings and shortlist eligibility**. No AI API keys, paid AI services, or personal budget data sent to an AI provider.

TensorFlow.js downloads from a CDN on first load, so **the app is not fully offline**. Historical prices and FX require network access. The Cloudflare Worker serves the interface and proxies Yahoo Finance chart data; no laptop is needed to keep the deployed site running. Market data access may be unreliable or restricted by upstream providers.

## Why open innovation matters

The ML feature engineering, labels, training split, inference method and validation are all inspectable. TensorFlow.js is a replaceable open-source runtime, and local inference reduces dependency on proprietary prediction APIs. Users can reproduce or challenge the model rather than trust an opaque investment score.

## How to deploy

Paste the entire `stockpilot-worker.js` file into a Cloudflare Worker editor and deploy. The Worker serves the embedded HTML/CSS/JS, proxies market data, and loads TensorFlow.js in the visitor's browser from a public CDN. `index.html`, `style.css` and `app.js` are separately readable source files. The Worker URL will stay the same when updated.

## Tests

`node --check app.js`, `node --check stockpilot-worker.js`, and `node tests/ai.test.js`. Unit tests use a deterministic pure-JS reference distance implementation in Node.js; the deployed browser uses TensorFlow.js. Browser integration and live upstream feeds must be tested after deployment.

## Limitations

Educational historical research **not financial advice**. KNN historical neighbor frequency is **not** a calibrated probability of profit. Backtest uses a simple chronological holdout and is not robust out-of-sample trading validation. No valuation, company fundamentals, fees, taxes, dividends, or real-time geopolitical analysis. Historical returns and illustrative growth assumptions are not forecasts. The tool does not place orders. It may show no candidates when model and trend filters disagree.

## Hacktoberfest submission

Project and repository must be created within October 19–25, 2026. Publish a DEV post using the official Week 3 template and `#hf26challenge`, explain saved effort and open innovation, and include the working demo and GitHub code. Do not claim partner prize categories without genuinely integrating their technology. Eligibility is decided by the organizers.
