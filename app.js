'use strict';
const universe=[
['AAPL','Apple','Shares','USA','USD'],['MSFT','Microsoft','Shares','USA','USD'],['NVDA','NVIDIA','Shares','USA','USD'],['GOOGL','Alphabet','Shares','USA','USD'],['AMZN','Amazon','Shares','USA','USD'],['META','Meta','Shares','USA','USD'],['JPM','JPMorgan','Shares','USA','USD'],['KO','Coca-Cola','Shares','USA','USD'],['ASML.AS','ASML','Shares','Europe','EUR'],['SAP.DE','SAP','Shares','Europe','EUR'],['SIE.DE','Siemens','Shares','Europe','EUR'],['INGA.AS','ING','Shares','Europe','EUR'],['MC.PA','LVMH','Shares','Europe','EUR'],['AIR.PA','Airbus','Shares','Europe','EUR'],
['SPY','SPDR S&P 500 ETF','ETFs','USA','USD'],['QQQ','Invesco QQQ ETF','ETFs','USA','USD'],['VTI','Vanguard Total Stock Market ETF','ETFs','USA','USD'],['IWM','iShares Russell 2000 ETF','ETFs','USA','USD'],['VUSA.AS','Vanguard S&P 500 UCITS ETF','ETFs','Europe','EUR'],['IWDA.AS','iShares MSCI World UCITS ETF','ETFs','Europe','EUR'],['VWRL.AS','Vanguard FTSE All-World UCITS ETF','ETFs','Europe','EUR'],['EUNL.DE','iShares MSCI World UCITS ETF Xetra','ETFs','Europe','EUR'],['SXR8.DE','iShares S&P 500 UCITS ETF Xetra','ETFs','Europe','EUR']
].map(([symbol,name,kind,market,currency])=>({symbol,name,kind,market,currency}));
const $=id=>document.getElementById(id), money=(x,c)=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,maximumFractionDigits:2}).format(x);
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
function analyze(prices,horizon){
 const n=prices.length;if(n<210)throw Error('Requires at least 210 daily closing prices');
 const last=prices[n-1],m20=avg(prices.slice(-20)),m50=avg(prices.slice(-50)),m200=avg(prices.slice(-200));
 const short=horizon<=63;
 const tests=short?[last>m20,m20>m50,last>prices[n-21],last>prices[n-21]*1.04]:[last>m200,m50>m200,last>prices[n-64],last>Math.max(...prices.slice(-Math.min(n,504)))*.75];
 const score=tests.filter(Boolean).length*25;
 return {score,reason:`${tests.filter(Boolean).length} of 4 ${short?'short-term':'long-term'} trend checks passed.`,action:score>=75?'BUY CANDIDATE':score>=50?'WAIT':'AVOID NEW BUY'};
}
function scenarios(prices,horizon,invested,budget){
 if(horizon>=prices.length-20)throw Error('Not enough price history for this investment duration');
 const values=[];for(let i=0;i+horizon<prices.length;i++)values.push(prices[i+horizon]/prices[i]-1);
 if(values.length<20)throw Error('Too few historical comparison periods');values.sort((a,b)=>a-b);
 const q=p=>{const at=(values.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return values[lo]+(values[hi]-values[lo])*(at-lo)};
 return [q(.1),q(.5),q(.9)].map(ret=>({ret,profit:invested*ret,total:budget+invested*ret,observations:values.length}));
}
const days=(num,unit)=>Math.max(1,Math.round(num*({Days:1,Weeks:5,Months:21,Years:252})[unit]));
async function chart(symbol){
 const r=await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}`);
 if(!r.ok)throw Error(`Market data unavailable (${r.status})`);
 const data=await r.json(),result=data.chart?.result?.[0];
 if(!result)throw Error('No price history returned');
 const times=result.timestamp||[],closes=result.indicators?.quote?.[0]?.close||[],rows=[];
 for(let i=0;i<times.length;i++)if(Number.isFinite(closes[i])&&closes[i]>0)rows.push({date:new Date(times[i]*1000).toISOString().slice(0,10),price:closes[i]});
 return {rows,currency:result.meta?.currency};
}
async function fx(from,to){
 if(from===to)return {rate:1,date:null,source:'Same currency'};
 const r=await fetch(`/api/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
 if(!r.ok)throw Error('Live exchange rate unavailable');
 const data=await r.json();
 const result=data.chart?.result?.[0],closes=result?.indicators?.quote?.[0]?.close||[],times=result?.timestamp||[];
 let idx=-1;for(let i=closes.length-1;i>=0;i--)if(Number.isFinite(closes[i])&&closes[i]>0){idx=i;break;}
 if(idx<0)throw Error('Exchange rate unavailable');
 const date=times[idx]?new Date(times[idx]*1000).toISOString().slice(0,10):null;
 if(!date||Date.now()-Date.parse(date+'T00:00:00Z')>8*86400000)throw Error('Exchange rate is outdated');
 return {rate:closes[idx],date,source:'Yahoo Finance FX daily close'};
}
function historyOutlook(prices){
 // This is a historical-price-only planning model, not an earnings/news forecast.
 const n=prices.length, last=prices[n-1];
 if(n<210)throw Error('Insufficient price history for a stock-specific estimate');
 const years=Math.min(5,(n-1)/252), first=prices[Math.max(0,n-1-Math.round(years*252))];
 const longCagr=Math.pow(last/first,1/years)-1;
 const y1=n>253?last/prices[n-253]-1:longCagr;
 const daily=[];for(let i=Math.max(1,n-253);i<n;i++)daily.push(Math.log(prices[i]/prices[i-1]));
 const mean=avg(daily),vol=Math.sqrt(avg(daily.map(x=>(x-mean)**2)))*Math.sqrt(252);
 // Temper backward-looking returns; penalize volatility and avoid extrapolating extreme winners.
 const raw=0.65*longCagr+0.35*y1;
 const annual=Math.max(-0.20,Math.min(0.25,raw*0.50-Math.max(0,vol-0.20)*0.10));
 return {annual,longCagr,y1,vol,years};
}
function investmentCalc(r,budget,currency,fxQuote,num,unit){const rate=fxQuote.rate; if(!(rate>0))throw Error('Invalid exchange rate');const price=r.last/rate;const qty=Math.floor((budget+1e-8)/price);const spent=qty*price;const cash=Math.max(0,budget-spent);const years=num*({Days:1/365.25,Weeks:7/365.25,Months:1/12,Years:1})[unit];const value=spent*Math.pow(r.outlook.annual+1,years)+cash;return {price,qty,spent,cash,value,fxQuote,annual:r.outlook.annual}}
function fxInfo(r,currency,quote){return r.quoteCurrency===currency?`Price quoted in ${currency}; no FX conversion needed.`:`FX: 1 ${currency} = ${quote.rate.toFixed(6)} ${r.quoteCurrency} (${quote.date||'date unavailable'}, ${quote.source}). Quote ${money(r.last,r.quoteCurrency)} converted to your ${currency} budget.`}
function lineChart(canvas,prices){const ctx=canvas.getContext('2d'),w=canvas.width=620,h=canvas.height=140;ctx.clearRect(0,0,w,h);const lo=Math.min(...prices),hi=Math.max(...prices),span=hi-lo||1;ctx.strokeStyle='#1473b8';ctx.lineWidth=2.5;ctx.beginPath();prices.forEach((p,i)=>{const x=5+i*(w-10)/(prices.length-1),y=h-8-(p-lo)/span*(h-16);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n};
function row(parent,label,value,cls){const d=el('div',undefined,'scenario');d.append(el('span',label),el('strong',value,cls));parent.append(d)}

// Open-source machine learning: TensorFlow.js (Apache-2.0) local KNN classifier.
// Trains on past 20/50-day momentum and daily volatility, with the next 21 trading days as label.
// Chronological holdout is used; no future price observations enter training features.
function mlFeatures(prices,end){
 if(end<51)return null;
 const p=prices[end],p20=prices[end-20],p50=prices[end-50];
 const returns=[];for(let i=end-19;i<=end;i++)returns.push(Math.log(prices[i]/prices[i-1]));
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const vol=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length);
 return [Math.max(-2,Math.min(2,Math.log(p/p20)*5)),Math.max(-2,Math.min(2,Math.log(p/p50)*3)),Math.min(2,vol*20)];
}
function mlSamples(prices){const samples=[];for(let i=70;i+21<prices.length;i+=5){const x=mlFeatures(prices,i);if(x)samples.push({x,y:prices[i+21]>prices[i]?1:0,at:i})}return samples}
function knnProbability(train,x,k=9){
 // TensorFlow.js (Apache-2.0): inference distances are computed by the open-source tensor engine.
 // No stock data or user budget is sent to an AI API. All ML computation runs locally in the browser.
 let distances;
 if(typeof tf!=='undefined' && tf.tensor2d && tf.tidy){
  distances=tf.tidy(()=>{
   const examples=tf.tensor2d(train.map(r=>r.x));
   const query=tf.tensor1d(x);
   return examples.sub(query).square().sum(1).dataSync();
  });
 }else if(typeof document==='undefined'){
  // Pure-JS reference for deterministic Node.js unit tests only; never used in deployed browser.
  distances=train.map(r=>r.x.reduce((v,a,j)=>v+(a-x[j])**2,0));
 }else throw Error('TensorFlow.js failed to load. AI analysis cannot run.');
 const nearest=train.map((r,i)=>({d:distances[i],y:r.y})).sort((a,b)=>a.d-b.d).slice(0,k);
 return nearest.reduce((v,r)=>v+r.y,0)/nearest.length;
}
function trainOpenSourceML(prices){
 const rows=mlSamples(prices);if(rows.length<60)return {available:false,reason:'Insufficient training history'};
 const split=Math.floor(prices.length*.8),train=rows.filter(r=>r.at+21<split),test=rows.filter(r=>r.at>=split&&r.at+21<prices.length);
 if(train.length<35||test.length<8)return {available:false,reason:'Insufficient chronological holdout'};
 const accuracy=test.filter(r=>(knnProbability(train,r.x)>=.5?1:0)===r.y).length/test.length;
 const baseline=Math.max(test.filter(r=>r.y===1).length,test.filter(r=>r.y===0).length)/test.length;
 const x=mlFeatures(prices,prices.length-1);
 // Final model refit on all fully observed historical examples after validation.
 const probability=knnProbability(rows,x);
 return {available:true,probability,accuracy,baseline,trainCount:train.length,testCount:test.length,model:'TensorFlow.js local KNN classifier (k=9)',horizon:'21 trading days'};
}

async function run(){if(typeof tf==='undefined'||!tf.tensor2d){$('status').textContent='TensorFlow.js could not load. Check internet access and try again.';return;}const button=$('go');button.disabled=true;$('results').hidden=true;$('cards').replaceChildren();$('all').replaceChildren();
try{const budget=Number($('budget').value),num=Number($('duration').value),currency=$('currency').value;if(!(budget>0&&Number.isFinite(budget))||!Number.isInteger(num)||num<1)throw Error('Enter a positive budget and a whole-number investment duration.');const horizon=days(num,$('unit').value),mode=$('market').value,kind=$('kind').value;const selected=universe.filter(x=>(mode==='Both'||x.market===mode)&&(kind==='Both'||x.kind===kind));
const results=[],errors=[];for(let i=0;i<selected.length;i++){const item=selected[i];$('status').textContent=`Checking ${i+1} of ${selected.length}: ${item.name}...`;try{const data=await chart(item.symbol);const actualCurrency=data.currency||item.currency;if(!['EUR','USD','PKR'].includes(actualCurrency))throw Error(`Unsupported quote currency: ${actualCurrency}`);const prices=data.rows.map(x=>x.price),last=prices.at(-1),signal=analyze(prices,horizon),outlook=historyOutlook(prices);results.push({...item,quoteCurrency:actualCurrency,prices,last,date:data.rows.at(-1).date,outlook,...signal,ml:trainOpenSourceML(prices)})}catch(e){errors.push(`${item.symbol}: ${e.message}`)}}
results.sort((a,b)=>(b.ml.available?b.ml.probability:-1)-(a.ml.available?a.ml.probability:-1)||b.score-a.score||a.symbol.localeCompare(b.symbol));if(!results.length)throw Error('No valid historical data could be loaded. '+errors.slice(0,2).join(' | '));const qualifying=results.filter(x=>x.ml.available&&x.ml.probability>=.5&&x.score>=50),etf=qualifying.find(x=>x.kind==='ETFs'),share=qualifying.find(x=>x.kind==='Shares'),picks=(kind==='ETFs'?[etf]:kind==='Shares'?[share]:[etf,share]).filter(Boolean);
$('advice').replaceChildren();
if(picks.length){
 const top=etf||share||picks[0],box=$('advice');
 box.append(el('div','STOCKPILOT RECOMMENDS','tag'),el('h2',`Buy ${top.name}`),el('p',`Our leading ${top.kind==='ETFs'?'diversified fund':'company share'} candidate, ranked first by the browser-trained open-source machine-learning classifier and checked against historical price trends. This is a research shortlist, not a verified fair-value assessment.`));
 try{
  const fxQuote=await fx(currency,top.quoteCurrency),calc=investmentCalc(top,budget,currency,fxQuote,num,$('unit').value),{price:unitPrice,qty,spent,cash:remaining,value:exampleValue}=calc;
  row(box,'Your investment budget',money(budget,currency));
  row(box,'Estimated price per unit',money(unitPrice,currency));
  row(box,'Units you could buy',qty.toLocaleString());
  row(box,'Total spent',money(spent,currency));
  row(box,'Cash remaining',money(remaining,currency));
  box.append(el('p',fxInfo(top,currency,fxQuote),'muted'));
  const h=el('h3',`Illustrative value after ${num} ${$('unit').value.toLowerCase()}: ${money(exampleValue,currency)}`);box.append(h);
  box.append(el('p',`Illustrative gain: ${money(exampleValue-budget,currency)}, using a stock-specific history-informed annual assumption of ${(top.outlook.annual*100).toFixed(1)}%. This is NOT a forecast or promised return. The investment may lose value, including falling below ${money(budget,currency)}.`,'muted'));
  box.append(el('p',`Why this choice: ${top.reason} ${top.kind==='ETFs'?'An ETF spreads exposure across multiple holdings rather than a single company.':'A single share carries company-specific risk.'} The ML ranking uses historical momentum and volatility, not earnings, valuation, geopolitical news, personal suitability, costs or tax.`));
  if(top.ml.available){
   box.append(el('h3','Open-source AI Trend Analyst — trained in your browser'));
   box.append(el('p',`ML model: ${top.ml.model}. ${Math.round(top.ml.probability*100)}% of nearest historical patterns were followed by a positive 21-trading-day return. This is a historical neighbor frequency, NOT the probability of future gains.`));
   box.append(el('p',`Chronological holdout: ${(top.ml.accuracy*100).toFixed(1)}% directional accuracy on ${top.ml.testCount} historical samples; ${top.ml.trainCount} earlier training samples. Majority-class baseline: ${(top.ml.baseline*100).toFixed(1)}%. Limited validation, not proof of predictive performance.`,'muted'));
  }
  if(qty<1)box.append(el('p','Your budget is below the price of one whole unit. Consider a lower-priced eligible fund or a broker offering fractional shares.','warn'));
  if(top.market==='USA'&&top.kind==='ETFs')box.append(el('p','If you live in the EU, US-domiciled ETFs may not be available to retail investors. Check for a suitable UCITS alternative.','warn'));
 }catch(e){box.append(el('p',`A purchase quantity cannot be calculated because currency conversion failed: ${e.message}`,'warn'))}
}else $('advice').replaceChildren(el('h3','No suitable buy candidate found'),el('p','The screened investments did not meet the current trend criteria. Do not force a purchase.'));

for(const [index,r] of picks.entries()){const card=el('article',undefined,'card');if(r.ml.available)card.append(el('p',`Open-source ML: ${Math.round(r.ml.probability*100)}% positive historical neighbors · holdout accuracy ${(r.ml.accuracy*100).toFixed(1)}% (${r.ml.testCount} samples). Not a forecast.`,'muted'));card.append(el('div',r.kind==='ETFs'?'TOP ETF':'TOP SHARE','tag'),el('h3',r.name),el('div',`${money(r.last,r.quoteCurrency)} · ${r.date}`,'price'),el('p',r.action+' · '+r.reason));try{const quote=await fx(currency,r.quoteCurrency),c=investmentCalc(r,budget,currency,quote,num,$('unit').value);row(card,'Whole units affordable',c.qty.toLocaleString());row(card,'Amount invested',money(c.spent,currency));row(card,'Unspent cash',money(c.cash,currency));
row(card,`Illustrative value after ${num} ${$('unit').value.toLowerCase()}`,money(c.value,currency));
row(card,'Illustrative gain',money(c.value-budget,currency));
card.append(el('p',fxInfo(r,currency,quote),'muted'));
card.append(el('p',`Uses a history-informed annual assumption of ${(r.outlook.annual*100).toFixed(1)}% (historical annualized return ${(r.outlook.longCagr*100).toFixed(1)}%, recent 1-year return ${(r.outlook.y1*100).toFixed(1)}%). This is NOT a forecast: company financials, valuations, news and geopolitics are not yet integrated into this model. FX held constant; fees, taxes and dividends excluded.`,`muted`));
}catch(e){card.append(el('p','Profit and quantity unavailable: '+e.message,'warn'))}const cv=el('canvas');card.append(cv,el('p','Historical closing-price trend · '+r.quoteCurrency,'muted'));$('cards').append(card);lineChart(cv,r.prices.slice(-504))}
const candidates=results.filter(r=>r.ml.available&&r.ml.probability>=.5&&r.score>=50);
const table=el('table');table.className='comparison';const thead=el('thead'),head=el('tr');for(const h of ['Buy candidate','Estimated price per unit','Units you could buy','Total spent','Cash remaining','History-informed annual assumption',`Illustrative value after ${num} ${$('unit').value.toLowerCase()}`,'FX rate / date','AI-ranked historical neighbors'])head.append(el('th',h));thead.append(head);table.append(thead);const tbody=el('tbody');
const quotes=new Map();async function quoteFor(c){if(!quotes.has(c))quotes.set(c,await fx(currency,c));return quotes.get(c)}
for(const r of candidates){const tr=el('tr');const vals=[`${r.name} (${r.symbol})`];try{const quote=await quoteFor(r.quoteCurrency),c=investmentCalc(r,budget,currency,quote,num,$('unit').value);vals.push(money(c.price,currency),c.qty.toLocaleString(),money(c.spent,currency),money(c.cash,currency),`${(r.outlook.annual*100).toFixed(1)}%`,money(c.value,currency),r.quoteCurrency===currency?'No conversion':`1 ${currency} = ${quote.rate.toFixed(6)} ${r.quoteCurrency} · ${quote.date||'n/a'}`,r.ml.available?`${Math.round(r.ml.probability*100)}% positive neighbors`:'Unavailable')}catch(e){vals.push('Unavailable','—','—','—','—','—',e.message)}for(const v of vals)tr.append(el('td',v));tbody.append(tr)}table.append(tbody);$('all').append(el('p',`Comparison uses your ${money(budget,currency)} budget and ${num} ${$('unit').value.toLowerCase()}. All values are in ${currency}. Each candidate uses a different historical-price-informed annual assumption (5-year and recent 1-year price returns, tempered for volatility). These are planning illustrations, NOT forecasts. Company fundamentals, valuation and geopolitical events are NOT yet incorporated.`,'muted'));const wrap=el('div');wrap.className='table-scroll';wrap.append(table);$('all').append(wrap);
const other=results.filter(r=>r.action!=='BUY CANDIDATE');if(other.length){$('all').append(el('h3','Other screened investments (Wait / Avoid new buy)'));for(const r of other){const d=el('div',undefined,'line');d.append(el('span',`${r.name} (${r.symbol})`),el('span',`${money(r.last,r.quoteCurrency)} · ${r.action}`));$('all').append(d)}}const research=$('researchContent');research.replaceChildren();
for(const r of results.slice(0,6)){
 const section=el('div',undefined,'card');section.append(el('h3',r.name));
 const n=r.prices.length;
 for(const [label,k] of [['1 month',21],['3 months',63],['1 year',252]])if(n>k){
  const change=(r.last/r.prices[n-1-k]-1)*100;
  row(section,`Observed change over ${label}`,`${change>=0?'+':''}${change.toFixed(1)}%`,change<0?'negative':'positive');
 }
 const link=el('a','View company news, earnings and upcoming events ↗');
 link.href=`https://finance.yahoo.com/quote/${encodeURIComponent(r.symbol)}/news/`;
 link.target='_blank';link.rel='noopener noreferrer';section.append(link);
 const calendar=el('p',`Market catalysts to watch: earnings releases, central-bank interest-rate decisions, inflation reports, company guidance, and geopolitical developments. These events do not imply a predictable direction.`,'muted');section.append(calendar);
 const note=el('p',`Target-price question: the application cannot know when a price will reach a particular level. Compare the historical scenarios above rather than relying on a fabricated target date.`,'muted');section.append(note);
 research.append(section);
}
const experimental=el('details');experimental.append(el('summary','Experimental: books, films and cultural hypotheses'));
experimental.append(el('p','Entertainment references, including fictional predictions, are not reliable market signals and never affect StockPilot rankings. Treat them as ideas to investigate, not reasons to trade.'));
research.append(experimental);
if(errors.length)$('all').append(el('p',`${errors.length} symbols unavailable. ${errors.slice(0,3).join(' | ')}`,'muted'));$('results').hidden=false;$('status').textContent=`Checked ${results.length} instruments. Source: automatic online market data. Historical closing prices are not live execution quotes.`;
}catch(e){$('status').textContent='Unable to complete analysis: '+e.message}finally{button.disabled=false}}
if(typeof document!=='undefined')$('go').addEventListener('click',run);
if(typeof module!=='undefined')module.exports={analyze,scenarios,days,universe,historyOutlook,investmentCalc,mlFeatures,mlSamples,knnProbability,trainOpenSourceML};
