// Deploy this file as a Cloudflare Worker. No API key required for Yahoo's public chart endpoint.
// Market data access is subject to Yahoo availability and terms; this is not a guaranteed service.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'public,max-age=300'};
    if (request.method === 'OPTIONS') return new Response('',{headers});
    if (request.method !== 'GET') return new Response('Method not allowed',{status:405,headers});
    let target;
    if(url.pathname==='/price') {
      const symbol=url.searchParams.get('symbol')||'';
      if(!/^[A-Za-z0-9.^=-]{1,24}$/.test(symbol)) return new Response('Invalid symbol',{status:400,headers});
      target=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;
    } else if(url.pathname==='/fx') {
      const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
      if(!/^(EUR|USD|PKR)$/.test(from)||!/^(EUR|USD|PKR)$/.test(to))return new Response('Invalid currency',{status:400,headers});
      target=`https://query1.finance.yahoo.com/v8/finance/chart/${from}${to}%3DX?range=5d&interval=1d`;
    } else return new Response('StockPilot data worker. Use /price?symbol=AAPL or /fx?from=EUR&to=USD',{headers});
    try {const r=await fetch(target,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});const body=await r.text();return new Response(body,{status:r.status,headers:{...headers,'Content-Type':'application/json'}})}catch(e){return new Response(JSON.stringify({error:'Upstream market data unavailable'}),{status:502,headers:{...headers,'Content-Type':'application/json'}})}
  }
};
