const cfg=window.POODLE_CONFIG||{};
const $=id=>document.getElementById(id);
let sb,viewDate=new Date();viewDate.setDate(1);
let editState={date:null,currentTotal:0};

function configured(){
  return cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_URL.includes("PASTE_")&&!cfg.SUPABASE_ANON_KEY.includes("PASTE_");
}
function localDateString(d=new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthPrefix(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function showLogin(msg=""){ $("app").classList.add("hidden");$("loginScreen").classList.remove("hidden");$("loginError").textContent=msg }
function showApp(){ $("loginScreen").classList.add("hidden");$("app").classList.remove("hidden") }


const CUSTOM_ICON_KEY="poodle_custom_icon";

function applyCustomIcon(){
  const custom=localStorage.getItem(CUSTOM_ICON_KEY);
  const src=custom||"./icons/poodle.svg";
  ["headerPoodle","loginPoodle","settingsPoodle"].forEach(id=>{
    const el=$(id);
    if(el)el.src=src;
  });
}

function saveCustomIcon(file){
  if(!file)return;
  if(!file.type.startsWith("image/")){
    alert("画像ファイルを選んでください。");
    return;
  }
  if(file.size>3*1024*1024){
    alert("画像は3MB以下がおすすめです。");
    return;
  }

  const reader=new FileReader();
  reader.onload=()=>{
    try{
      localStorage.setItem(CUSTOM_ICON_KEY,reader.result);
      applyCustomIcon();
    }catch(e){
      alert("画像を保存できませんでした。もう少し小さい画像を選んでください。");
    }
  };
  reader.readAsDataURL(file);
}

async function init(){
  applyCustomIcon();
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

$("iconFileInput").addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if(file)saveCustomIcon(file);
  e.target.value="";
});

$("resetIconButton").addEventListener("click",()=>{
  localStorage.removeItem(CUSTOM_ICON_KEY);
  applyCustomIcon();
});


function getSelectedIconSource(){
  return localStorage.getItem(CUSTOM_ICON_KEY) || "./icons/poodle.svg";
}

function imageToSquarePngDataUrl(src,size){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement("canvas");
      canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext("2d");

      // background
      ctx.fillStyle="#f8e5ed";
      ctx.fillRect(0,0,size,size);

      const scale=Math.max(size/img.width,size/img.height);
      const w=img.width*scale;
      const h=img.height*scale;
      const x=(size-w)/2;
      const y=(size-h)/2;

      ctx.drawImage(img,x,y,w,h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror=reject;
    img.src=src;
  });
}

$("generateHomeIconsButton").addEventListener("click",async()=>{
  try{
    const src=getSelectedIconSource();
    const d180=await imageToSquarePngDataUrl(src,180);
    const d192=await imageToSquarePngDataUrl(src,192);
    const d512=await imageToSquarePngDataUrl(src,512);

    $("download180").href=d180;
    $("download192").href=d192;
    $("download512").href=d512;
    $("iconDownloadArea").classList.remove("hidden");
  }catch(e){
    console.error(e);
    alert("ホーム画面用アイコンを作成できませんでした。");
  }
});


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
  const endpoints=[
    {
      url:"https://api.frankfurter.dev/v2/rate/usd/jpy",
      parse:j=>({rate:Number(j.rate),date:j.date})
    },
    {
      url:"https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY",
      parse:j=>({rate:Number(j.rates.JPY),date:j.date})
    }
  ];

  for(const ep of endpoints){
    try{
      const r=await fetch(ep.url,{cache:"no-store"});
      if(!r.ok)continue;
      const j=await r.json();
      const v=ep.parse(j);
      if(!Number.isFinite(v.rate))continue;
      localStorage.setItem(key,JSON.stringify(v));
      return v;
    }catch(e){
      console.warn("rate fetch failed",ep.url,e);
    }
  }

  try{
    const cached=JSON.parse(localStorage.getItem(key));
    if(cached?.rate)return cached;
  }catch(e){}

  return {rate:null,date:null};
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

function openEditModal(dateStr,currentTotal){
  editState={date:dateStr,currentTotal:Number(currentTotal||0)};
  const [y,m,d]=dateStr.split("-").map(Number);
  $("editDate").textContent=`${y}年${m}月${d}日`;
  $("editCurrentTotal").textContent=`$${editState.currentTotal}`;
  $("editAmount").value=editState.currentTotal;
  $("editModal").classList.remove("hidden");
  $("editModal").setAttribute("aria-hidden","false");
  setTimeout(()=>$("editAmount").focus(),80);
}
function closeEditModal(){
  $("editModal").classList.add("hidden");
  $("editModal").setAttribute("aria-hidden","true");
}
function adjustEditAmount(delta){
  const current=Math.max(0,Number($("editAmount").value||0));
  $("editAmount").value=Math.max(0,current+delta);
}

$("minus10Button").addEventListener("click",()=>adjustEditAmount(-10));
$("plus10Button").addEventListener("click",()=>adjustEditAmount(10));
$("cancelEditButton").addEventListener("click",closeEditModal);
$("modalBackdrop").addEventListener("click",closeEditModal);

$("saveEditButton").addEventListener("click",async()=>{
  if(!editState.date)return;
  const desired=Math.max(0,Math.round(Number($("editAmount").value||0)));
  const diff=desired-editState.currentTotal;

  if(diff===0){
    closeEditModal();
    return;
  }

  const now=new Date();
  const {error}=await sb.from("farts").insert({
    created_at:now.toISOString(),
    local_date:editState.date,
    amount_usd:diff,
    source:"adjustment"
  });

  if(error){
    alert("修正を保存できませんでした: "+error.message);
    return;
  }

  closeEditModal();
  await refreshAll();
});

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
    const dateStr=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    x.addEventListener("click",()=>openEditModal(dateStr,totals[d]||0));
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
