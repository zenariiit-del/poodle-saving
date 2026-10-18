const cfg=window.POODLE_CONFIG||{};
const $=id=>document.getElementById(id);
let sb,viewDate=new Date();viewDate.setDate(1);

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
  sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
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
$("prevMonth").addEventListener("click",async()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);await refreshCalendarAndChart()});
$("nextMonth").addEventListener("click",async()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);await refreshCalendarAndChart()});

async function fetchRows(){
  const {data,error}=await sb.from("farts").select("id,created_at,local_date,amount_usd,source").order("created_at",{ascending:true});
  if(error)throw error;return data||[];
}
async function getRate(){
  const key="poodle_last_rate";
  try{
    const r=await fetch("https://api.frankfurter.app/latest?from=USD&to=JPY",{cache:"no-store"});
    if(!r.ok)throw new Error("rate");
    const j=await r.json(),v={rate:Number(j.rates.JPY),date:j.date};
    localStorage.setItem(key,JSON.stringify(v));return v;
  }catch{
    try{return JSON.parse(localStorage.getItem(key))||{rate:null,date:null}}catch{return{rate:null,date:null}}
  }
}
function yenText(usd,rate){return rate?`約 ¥${Math.round(usd*rate).toLocaleString("ja-JP")}`:"約 ¥—"}

async function refreshAll(){
  try{
    const [rows,rate]=await Promise.all([fetchRows(),getRate()]);
    renderSummary(rows,rate);renderRate(rate);renderCalendar(rows);renderChart(rows);
  }catch(e){console.error(e)}
}
async function refreshCalendarAndChart(){try{const rows=await fetchRows();renderCalendar(rows);renderChart(rows)}catch(e){console.error(e)}}

function renderSummary(rows,rate){
  const today=localDateString(),prefix=monthPrefix(new Date());
  const td=rows.filter(r=>r.local_date===today).reduce((s,r)=>s+Number(r.amount_usd||0),0);
  const mt=rows.filter(r=>(r.local_date||"").startsWith(prefix)).reduce((s,r)=>s+Number(r.amount_usd||0),0);
  $("todayTotal").textContent=`$${td}`;$("monthTotal").textContent=`$${mt}`;
  $("todayYen").textContent=`(${yenText(td,rate.rate)})`;$("monthYen").textContent=`(${yenText(mt,rate.rate)})`;
}
function renderRate(v){
  if(v.rate){$("rateMain").textContent=`$1 = ¥${v.rate.toFixed(2)}`;$("rateDate").textContent=`取得レート日：${v.date||"—"}`}
  else{$("rateMain").textContent="$1 = ¥—";$("rateDate").textContent="レート取得できません"}
}
function renderCalendar(rows){
  const y=viewDate.getFullYear(),m=viewDate.getMonth(),now=new Date();
  $("monthTitle").textContent=`${y}年 ${m+1}月`;
  const current=now.getFullYear()===y&&now.getMonth()===m;
  $("monthSub").textContent=current?"📍 今月を表示中":"📆 過去・未来の月を表示中";
  const totals={},prefix=`${y}-${String(m+1).padStart(2,"0")}`;
  rows.filter(r=>(r.local_date||"").startsWith(prefix)).forEach(r=>{
    const d=Number(r.local_date.slice(-2));totals[d]=(totals[d]||0)+Number(r.amount_usd||0)
  });
  const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),lead=(first.getDay()+6)%7;
  const grid=$("calendarGrid");grid.innerHTML="";
  for(let i=0;i<lead;i++){const x=document.createElement("div");x.className="day empty";grid.appendChild(x)}
  for(let d=1;d<=days;d++){
    const x=document.createElement("div");x.className=`day${current&&now.getDate()===d?" today":""}`;
    x.innerHTML=`<div class="day-num">${d}</div>`;
    if(totals[d])x.innerHTML+=`<div class="pill${totals[d]>=100?" large":""}">$${totals[d]}</div>`;
    else x.innerHTML+=`<div class="dash">ー</div>`;
    grid.appendChild(x)
  }
  const trail=(7-((lead+days)%7))%7;
  for(let i=0;i<trail;i++){const x=document.createElement("div");x.className="day empty";grid.appendChild(x)}
}
function renderChart(rows){
  const y=viewDate.getFullYear(),totals=Array(12).fill(0);$("chartTitle").textContent=`${y}年の月別合計`;
  rows.forEach(r=>{const d=r.local_date||"";if(!d.startsWith(`${y}-`))return;const m=Number(d.slice(5,7));if(m>=1&&m<=12)totals[m-1]+=Number(r.amount_usd||0)});
  const max=Math.max(...totals,10),chart=$("yearChart");chart.innerHTML="";
  totals.forEach((total,i)=>{
    const w=document.createElement("div");w.className=`bar-wrap${i===viewDate.getMonth()?" current":""}`;
    w.innerHTML=`<div class="bar-value">${total}</div><div class="bar-slot"><div class="bar" style="height:${total?Math.max(5,Math.round(total/max*100)):0}%"></div></div><div class="bar-label">${i+1}月</div>`;
    chart.appendChild(w)
  });
}
window.addEventListener("load",init);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
