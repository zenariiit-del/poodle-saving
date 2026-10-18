const cfg=window.POODLE_CONFIG||{};
const $=id=>document.getElementById(id);
let sb,viewDate=new Date();viewDate.setDate(1);
let editState={date:null,currentTotal:0};
let currentRateInfo={rate:null,date:null};
let latestRows=[];
let latestExchanges=[];
let exchangeMode="usd";

function configured(){
  return cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("PASTE_")&&!cfg.SUPABASE_ANON_KEY.includes("PASTE_");
}
function localDateString(d=new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthPrefix(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function showLogin(msg=""){ $("app").classList.add("hidden");$("loginScreen").classList.remove("hidden");$("loginError").textContent=msg }
function showApp(){ $("loginScreen").classList.add("hidden");$("app").classList.remove("hidden") }

async function init(){
  if(!configured()){
    showLogin("config.js にSupabaseの設定を入れてください。");
    $("loginForm").querySelector("button").disabled=true;
    return;
  }
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await sb.auth.getSession();
  if(!session){showLogin();return}
  showApp();await refreshAll();
}

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginError").textContent="";
  const {error}=await sb.auth.signInWithPassword({email:cfg.LOGIN_EMAIL,password:$("passwordInput").value});
  if(error){$("loginError").textContent="パスワードが違います。";return}
  $("passwordInput").value="";showApp();await refreshAll();
});
$("logoutButton").addEventListener("click",async()=>{await sb.auth.signOut();showLogin("この端末の認証を解除しました。")});

$("addButton").addEventListener("click",async()=>{
  const now=new Date();
  const {error}=await sb.from("farts").insert({created_at:now.toISOString(),local_date:localDateString(now),amount_usd:10,source:"live"});
  if(error){alert("記録できませんでした: "+error.message);return}
  await refreshAll();
});
$("undoButton").addEventListener("click",async()=>{
  const today=localDateString();
  const {data,error}=await sb.from("farts").select("id").eq("local_date",today).eq("source","live").order("created_at",{ascending:false}).limit(1);
  if(error){alert("戻せませんでした: "+error.message);return}
  if(!data?.length)return;
  const {error:delErr}=await sb.from("farts").delete().eq("id",data[0].id);
  if(delErr){alert("戻せませんでした: "+delErr.message);return}
  await refreshAll();
});
$("prevMonth").addEventListener("click",()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);renderCalendar(latestRows);renderChart(latestRows)});
$("nextMonth").addEventListener("click",()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);renderCalendar(latestRows);renderChart(latestRows)});

async function fetchRows(){
  const {data,error}=await sb.from("farts").select("id,created_at,local_date,amount_usd,source").order("created_at",{ascending:true});
  if(error)throw error;return data||[];
}
async function fetchExchanges(){
  const {data,error}=await sb.from("exchanges").select("id,created_at,local_date,usd_amount,rate,jpy_amount").order("created_at",{ascending:false});
  if(error)throw error;return data||[];
}
async function getRate(){
  const key="poodle_last_rate";
  const endpoints=[
    {url:"https://api.frankfurter.dev/v2/rate/usd/jpy",parse:j=>({rate:Number(j.rate),date:j.date})},
    {url:"https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY",parse:j=>({rate:Number(j.rates.JPY),date:j.date})}
  ];
  for(const ep of endpoints){
    try{
      const r=await fetch(ep.url,{cache:"no-store"});
      if(!r.ok)continue;
      const j=await r.json(),v=ep.parse(j);
      if(!Number.isFinite(v.rate))continue;
      localStorage.setItem(key,JSON.stringify(v));return v;
    }catch(e){console.warn(e)}
  }
  try{const c=JSON.parse(localStorage.getItem(key));if(c?.rate)return c}catch(e){}
  return {rate:null,date:null};
}
function yenText(usd,rate){return rate?`約 ¥${Math.round(usd*rate).toLocaleString("ja-JP")}`:"約 ¥—"}
function sumRows(rows){return rows.reduce((s,r)=>s+Number(r.amount_usd||0),0)}
function sumExchanges(exchanges,key){return exchanges.reduce((s,r)=>s+Number(r[key]||0),0)}
function formatUsd(v){const n=Number(v||0);return Number.isInteger(n)?n.toLocaleString("en-US"):n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}

async function refreshAll(){
  try{
    const [rows,exchanges,rate]=await Promise.all([fetchRows(),fetchExchanges(),getRate()]);
    latestRows=rows;latestExchanges=exchanges;currentRateInfo=rate;
    renderRate(rate);renderSummary(rows,exchanges,rate);renderCalendar(rows);renderChart(rows);renderExchangeHistory(exchanges);
  }catch(e){console.error(e);alert("データを読み込めませんでした: "+(e.message||e))}
}
function renderRate(v){
  $("rateMain").textContent=v.rate?`$1 = ¥${v.rate.toFixed(2)}`:"$1 = ¥—";
  $("rateDate").textContent=v.date?v.date:"取得できません";
}
function renderSummary(rows,exchanges,rate){
  const today=localDateString(),prefix=monthPrefix(new Date());
  const todayTotal=sumRows(rows.filter(r=>r.local_date===today));
  const monthTotal=sumRows(rows.filter(r=>(r.local_date||"").startsWith(prefix)));
  const lifetime=sumRows(rows);
  const convertedUsd=sumExchanges(exchanges,"usd_amount");
  const convertedJpy=sumExchanges(exchanges,"jpy_amount");
  const remaining=lifetime-convertedUsd;
  $("todayTotal").textContent=`$${formatUsd(todayTotal)}`;$("todayYen").textContent=yenText(todayTotal,rate.rate);
  $("monthTotal").textContent=`$${formatUsd(monthTotal)}`;$("monthYen").textContent=yenText(monthTotal,rate.rate);
  $("lifetimeUsd").textContent=`$${formatUsd(lifetime)}`;$("convertedUsd").textContent=`$${formatUsd(convertedUsd)}`;$("convertedUsdSmall").textContent=`$${formatUsd(convertedUsd)}`;
  $("remainingUsd").textContent=`$${formatUsd(remaining)}`;$("remainingYenEstimate").textContent=yenText(remaining,rate.rate);
  $("convertedYen").textContent=`¥${Math.round(convertedJpy).toLocaleString("ja-JP")}`;$("exchangeCount").textContent=exchanges.length;
}

function openEditModal(dateStr,currentTotal){
  editState={date:dateStr,currentTotal:Number(currentTotal||0)};
  const [y,m,d]=dateStr.split("-").map(Number);$("editDate").textContent=`${y}年${m}月${d}日`;
  $("editCurrentTotal").textContent=`$${formatUsd(editState.currentTotal)}`;$("editAmount").value=editState.currentTotal;$("editModal").classList.remove("hidden");
}
function closeEditModal(){$("editModal").classList.add("hidden")}
$("minus10Button").addEventListener("click",()=>{$("editAmount").value=Math.max(0,Number($("editAmount").value||0)-10)});
$("plus10Button").addEventListener("click",()=>{$("editAmount").value=Math.max(0,Number($("editAmount").value||0)+10)});
$("cancelEditButton").addEventListener("click",closeEditModal);$("editBackdrop").addEventListener("click",closeEditModal);
$("saveEditButton").addEventListener("click",async()=>{
  const desired=Math.max(0,Math.round(Number($("editAmount").value||0))),diff=desired-editState.currentTotal;
  if(diff===0){closeEditModal();return}
  const {error}=await sb.from("farts").insert({created_at:new Date().toISOString(),local_date:editState.date,amount_usd:diff,source:"adjustment"});
  if(error){alert("修正を保存できませんでした: "+error.message);return}
  closeEditModal();await refreshAll();
});

function remainingUsd(){return sumRows(latestRows)-sumExchanges(latestExchanges,"usd_amount")}

function setExchangeMode(mode){
  exchangeMode=mode;
  const usdMode=mode==="usd";
  $("modeUsdButton").classList.toggle("active",usdMode);
  $("modeJpyButton").classList.toggle("active",!usdMode);
  $("exchangeInputPrefix").textContent=usdMode?"$":"¥";
  $("exchangeInputLabel").textContent=usdMode?"交換するドル":"受け取りたい円";
  $("exchangeResultLabel").textContent=usdMode?"受け取る円":"差し引くドル";
  $("exchangeAmountInput").placeholder=usdMode?"500":"50000";
  $("exchangeAmountInput").value="";
  $("exchangeResultPreview").textContent=usdMode?"¥0":"$0";
}

function openExchangeModal(){
  if(!currentRateInfo.rate){alert("為替レートを取得できていないため交換できません。");return}
  const remaining=remainingUsd();
  $("exchangeAvailable").textContent=`$${formatUsd(remaining)}`;
  $("exchangeRate").textContent=`¥${currentRateInfo.rate.toFixed(2)}`;
  setExchangeMode("usd");
  $("exchangeModal").classList.remove("hidden");
}
function closeExchangeModal(){$("exchangeModal").classList.add("hidden")}

function exchangeValues(){
  const amount=Math.max(0,Number($("exchangeAmountInput").value||0));
  const rate=currentRateInfo.rate||0;
  if(exchangeMode==="usd"){
    const usd=Math.round(amount*100)/100;
    const jpy=Math.round(usd*rate);
    return {usd,jpy};
  }
  const jpy=Math.round(amount);
  const usd=Math.round((jpy/rate)*100)/100;
  return {usd,jpy};
}

function updateExchangePreview(){
  const {usd,jpy}=exchangeValues();
  $("exchangeResultPreview").textContent=exchangeMode==="usd"
    ?`¥${jpy.toLocaleString("ja-JP")}`
    :`$${formatUsd(usd)}`;
}

$("openExchangeButton").addEventListener("click",openExchangeModal);
$("cancelExchangeButton").addEventListener("click",closeExchangeModal);
$("exchangeBackdrop").addEventListener("click",closeExchangeModal);
$("modeUsdButton").addEventListener("click",()=>setExchangeMode("usd"));
$("modeJpyButton").addEventListener("click",()=>setExchangeMode("jpy"));
$("exchangeAmountInput").addEventListener("input",updateExchangePreview);

$("confirmExchangeButton").addEventListener("click",async()=>{
  const amount=Number($("exchangeAmountInput").value||0);
  const available=remainingUsd(),rate=currentRateInfo.rate;
  if(!rate){alert("レートを取得できていません。");return}
  if(!Number.isFinite(amount)||amount<=0){alert(exchangeMode==="usd"?"交換するドル金額を入力してください。":"受け取りたい円金額を入力してください。");return}
  const {usd,jpy}=exchangeValues();
  if(usd>available){alert(`残高は $${formatUsd(available)} です。`);return}
  const now=new Date();
  const {error}=await sb.from("exchanges").insert({created_at:now.toISOString(),local_date:localDateString(now),usd_amount:usd,rate:rate,jpy_amount:jpy});
  if(error){alert("交換を保存できませんでした: "+error.message);return}
  closeExchangeModal();await refreshAll();
});

function renderCalendar(rows){
  const y=viewDate.getFullYear(),m=viewDate.getMonth(),now=new Date();$("monthTitle").textContent=`${y}年 ${m+1}月`;
  const current=now.getFullYear()===y&&now.getMonth()===m;$("monthSub").textContent=current?"今月":"";
  const totals={},prefix=`${y}-${String(m+1).padStart(2,"0")}`;
  rows.filter(r=>(r.local_date||"").startsWith(prefix)).forEach(r=>{const d=Number(r.local_date.slice(-2));totals[d]=(totals[d]||0)+Number(r.amount_usd||0)});
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),lead=(first.getDay()+6)%7,grid=$("calendarGrid");grid.innerHTML="";
  for(let i=0;i<lead;i++){const x=document.createElement("div");x.className="day empty";grid.appendChild(x)}
  for(let d=1;d<=days;d++){
    const x=document.createElement("div");x.className=`day${current&&now.getDate()===d?" today":""}`;x.innerHTML=`<div class="day-num">${d}</div>`;
    if(totals[d])x.innerHTML+=`<div class="pill${Math.abs(totals[d])>=100?" large":""}">$${formatUsd(totals[d])}</div>`;else x.innerHTML+=`<div class="dash">·</div>`;
    const dateStr=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;x.addEventListener("click",()=>openEditModal(dateStr,totals[d]||0));grid.appendChild(x)
  }
  const trail=(7-((lead+days)%7))%7;for(let i=0;i<trail;i++){const x=document.createElement("div");x.className="day empty";grid.appendChild(x)}
}
function renderChart(rows){
  const y=viewDate.getFullYear(),totals=Array(12).fill(0);$("chartTitle").textContent=`${y}年の月別合計`;
  rows.forEach(r=>{const d=r.local_date||"";if(!d.startsWith(`${y}-`))return;const m=Number(d.slice(5,7));if(m>=1&&m<=12)totals[m-1]+=Number(r.amount_usd||0)});
  const max=Math.max(...totals.map(v=>Math.max(0,v)),10),chart=$("yearChart");chart.innerHTML="";
  totals.forEach((total,i)=>{const w=document.createElement("div");w.className="bar-wrap";const pct=total>0?Math.max(4,Math.round(total/max*100)):0;w.innerHTML=`<div class="bar-value">${formatUsd(total)}</div><div class="bar-slot"><div class="bar" style="height:${pct}%"></div></div><div class="bar-label">${i+1}</div>`;chart.appendChild(w)});
}
function renderExchangeHistory(exchanges){
  const el=$("exchangeHistory");el.innerHTML="";if(!exchanges.length){el.innerHTML='<div class="history-empty">まだ円への交換はありません。</div>';return}
  exchanges.forEach(x=>{const row=document.createElement("div");row.className="history-row";row.innerHTML=`<div><div class="history-date">${x.local_date}</div><div class="history-main">$${formatUsd(x.usd_amount)} を交換</div></div><div><div class="history-yen">¥${Math.round(Number(x.jpy_amount||0)).toLocaleString("ja-JP")}</div><div class="history-rate">$1 = ¥${Number(x.rate||0).toFixed(2)}</div></div>`;el.appendChild(row)});
}

window.addEventListener("load",init);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
