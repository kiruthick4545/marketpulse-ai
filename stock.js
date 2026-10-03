const https = require("https");

function getJSON(url){
  return new Promise((resolve,reject)=>{
    https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},res=>{
      let body="";
      res.on("data",d=>body+=d);
      res.on("end",()=>{try{resolve(JSON.parse(body))}catch(e){reject(new Error("Market data response could not be read."))}});
    }).on("error",reject);
  });
}
function sma(a,n){return a.slice(-n).reduce((x,y)=>x+y,0)/n}
function rsi(a,n=14){
  if(a.length<n+1)return 50;
  let gains=0,losses=0;
  for(let i=a.length-n;i<a.length;i++){let d=a[i]-a[i-1];if(d>0)gains+=d;else losses-=d}
  if(losses===0)return 100;
  return 100-(100/(1+gains/losses));
}
function regressionForecast(a,n=20){
  const x=[],y=[]; const start=Math.max(0,a.length-n);
  for(let i=start;i<a.length;i++){x.push(i-start);y.push(a[i])}
  const mx=x.reduce((p,c)=>p+c,0)/x.length,my=y.reduce((p,c)=>p+c,0)/y.length;
  let num=0,den=0;for(let i=0;i<x.length;i++){num+=(x[i]-mx)*(y[i]-my);den+=(x[i]-mx)**2}
  const slope=den?num/den:0; return y[y.length-1]+slope;
}
module.exports=async(req,res)=>{
  try{
    const symbol=String(req.query.symbol||"RELIANCE").toUpperCase().replace(/[^A-Z0-9&-]/g,"");
    const range=["6mo","1y","2y"].includes(req.query.range)?req.query.range:"1y";
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?range=${range}&interval=1d&events=history`;
    const j=await getJSON(url), result=j.chart&&j.chart.result&&j.chart.result[0];
    if(!result)throw new Error("Stock not found. Try an NSE symbol such as RELIANCE, TCS, INFY or SBIN.");
    const q=result.indicators.quote[0], closes=[],vols=[],history=[];
    for(let i=0;i<result.timestamp.length;i++){
      if(q.close[i]!=null){closes.push(q.close[i]);vols.push(q.volume[i]||0);history.push({date:new Date(result.timestamp[i]*1000).toISOString().slice(0,10),close:q.close[i]})}
    }
    if(closes.length<30)throw new Error("Not enough historical data for analysis.");
    const last=closes.at(-1),prev=closes.at(-2),change=(last-prev)/prev*100;
    const r=rsi(closes),s20=sma(closes,20),s50=sma(closes,Math.min(50,closes.length));
    const trend=(last>s20?1:0)+(last>s50?1:0);
    const momentum=r>=55?1:r<=45?-1:0;
    const slope=regressionForecast(closes,20)-last;
    const trendSlope=slope>0?1:slope<0?-1:0;
    const avgVol=sma(vols.slice(0,-1),20),volume=(vols.at(-1)>avgVol*1.2)?1:0;
    let raw=50+trend*12+momentum*12+trendSlope*10+volume*4;
    raw=Math.max(0,Math.min(100,raw));
    const signal=raw>=62?"BULLISH":raw<=38?"BEARISH":"NEUTRAL";
    const forecast=Math.max(0,regressionForecast(closes,20));
    const confidence=Math.round(Math.min(92,52+Math.abs(raw-50)*0.75));
    const explanation=signal==="BULLISH"?"Trend and momentum signals are currently positive.":signal==="BEARISH"?"Trend and momentum signals are currently negative.":"Signals are mixed; the model does not show a strong directional edge.";
    res.setHeader("Content-Type","application/json");res.status(200).json({
      symbol,last,change,rsi:r,score:Math.round(raw),signal,forecast,confidence,explanation,
      components:{trend:trend===2?"Strong positive":trend===1?"Positive":"Negative",momentum:momentum===1?"Positive":momentum===-1?"Negative":"Neutral",volume:volume?"High volume":"Normal",volatility:"Not scored"},
      history:history.slice(-120)
    });
  }catch(e){res.status(400).json({error:e.message||"Unexpected error"})}
};