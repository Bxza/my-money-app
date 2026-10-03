const $=id=>document.getElementById(id);
const CATS={อาหาร:"🍜",เดินทาง:"🚗",ช้อปปิ้ง:"🛍️️","บิล/สาธารณูปโภค":"💡",บ้าน:"🏠",สุขภาพ:"💊",บันเทิง:"🎮",การศึกษา:"🎓",น้ำมัน:"⛽",งาน:"💼",เงินเดือน:"💰",อื่นๆ:"📦"};
const DB='money-manager-v5', STORE='transactions';
let db, data=[], type='expense', filter='all', reportMode='month', deferredInstall=null;

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const nowTime=()=>{const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const monthKey=d=>String(d||today()).slice(0,7);
const money=n=>'฿'+Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove('show'),2400)}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id'});s.createIndex('date','date')} };r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
function tx(mode){return db.transaction(STORE,mode).objectStore(STORE)}
function getAll(){return new Promise((res,rej)=>{const r=tx('readonly').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
function put(x){return new Promise((res,rej)=>{const r=tx('readwrite').put(x);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearDB(){return new Promise((res,rej)=>{const r=tx('readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function sum(arr,t){return arr.filter(x=>x.type===t).reduce((a,x)=>a+Number(x.amount||0),0)}
function monthLabel(k){const [y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'})}

function nav(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===page));
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const titles={home:['ภาพรวมการเงิน','หน้าหลัก'],add:['บันทึกข้อมูล','เพิ่มรายการ'],history:['รายการทั้งหมด','ประวัติรายการ'],reports:['ภาพรวมการเงิน','รายงาน'],settings:['ปรับแต่งแอป','ตั้งค่า']};
  $('pageKicker').textContent=titles[page][0];$('pageTitle').textContent=titles[page][1];
  window.scrollTo({top:0,behavior:'smooth'});
  if(page==='history')renderHistory();
  if(page==='reports')renderReports();
}

function setupNav(){document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.type)setType(b.dataset.type);nav(b.dataset.page)}))}
function setType(t){type=t;$('incomeTab').classList.toggle('active',t==='income');$('expenseTab').classList.toggle('active',t==='expense')}
function resetForm(){type='expense';setType(type);$('amount').value='';$('date').value=today();$('time').value=nowTime();$('category').value='อื่นๆ';$('bank').value='';$('person').value='';$('note').value=''}

function renderHome(){
  const m=monthKey();
  const md=data.filter(x=>monthKey(x.date)===m);
  const inc=sum(md,'income'),exp=sum(md,'expense'),allInc=sum(data,'income'),allExp=sum(data,'expense');
  $('balance').textContent=money(allInc-allExp);
  $('income').textContent=money(inc);$('expense').textContent=money(exp);
  $('sumIncome').textContent=money(inc);$('sumExpense').textContent=money(exp);
  $('sumNet').textContent=money(inc-exp);$('monthLabel').textContent=monthLabel(m);
  $('catTotal').textContent=money(exp);$('donutValue').textContent=money(exp).replace('.00','');

  const cats={};md.filter(x=>x.type==='expense').forEach(x=>cats[x.category||'อื่นๆ']=(cats[x.category||'อื่นๆ']||0)+Number(x.amount||0));
  const entries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const total=exp||1;let acc=0,parts=[];
  const colors=['#16d989','#3194ff','#a76cff','#ffad4a','#ff5363','#32c6c9','#ff76c8'];
  entries.forEach(([k,v],i)=>{const p=v/total*100;parts.push(`${colors[i%colors.length]} ${acc}% ${acc+p}%`);acc+=p});
  $('donut').style.background=entries.length?`conic-gradient(${parts.join(',')})`:'conic-gradient(#183453 0 100%)';
  $('catLegend').innerHTML=entries.slice(0,6).map(([k,v],i)=>`<div class="legendRow"><span class="legendName"><i class="dot" style="background:${colors[i%colors.length]}"></i>${esc(k)}</span><b>${money(v)}</b></div>`).join('')||'<span style="color:#6f88a8;font-size:12px">ยังไม่มีรายจ่ายเดือนนี้</span>';

  const recent=[...data].sort((a,b)=>((b.date+' '+b.time).localeCompare(a.date+' '+a.time))).slice(0,8);
  $('recentList').innerHTML=recent.length?recent.map(txHTML).join(''):'<div class="tx"><div class="txMain"><b>ยังไม่มีรายการ</b><span>เริ่มจากเพิ่มรายรับ รายจ่าย หรือสแกนสลิป</span></div></div>';
}

// โครงสร้าง HTML แสดงรายการ + เพิ่มปุ่มถังขยะลบรายการ
function txHTML(x){
  const icon=CATS[x.category]||'📦';
  return `
    <div class="tx" data-id="${x.id}">
      <div class="txIcon ${x.type==='income'?'in':'out'}">${icon}</div>
      <div class="txMain">
        <b>${esc(x.person||x.note||x.category||'รายการ')}</b>
        <span>${esc(x.category||'อื่นๆ')} · ${esc(x.date||'')} ${esc(x.time||'')}</span>
      </div>
      <div class="txAmount ${x.type==='income'?'in':'out'}">
        ${x.type==='income'?'+':'-'}${money(x.amount)}
      </div>
      <button onclick="deleteTransaction('${x.id}')" title="ลบรายการ" style="background:none;border:none;color:#ff5363;font-size:16px;cursor:pointer;padding:4px 6px;margin-left:6px;">🗑️</button>
    </div>
  `;
}

// ฟังก์ชันสำหรับลบรายการจาก IndexedDB และรีเฟรชหน้าจอ
async function deleteTransaction(id){
  if(confirm('ต้องการลบรายการนี้ออกใช่ไหม?')){
    try{
      await new Promise((res,rej)=>{
        const r=tx('readwrite').delete(id);
        r.onsuccess=()=>res();
        r.onerror=()=>rej(r.error);
      });
      data=await getAll();
      renderHome();
      renderHistory();
      renderReports();
      toast('ลบรายการเรียบร้อยแล้ว');
    }catch(e){
      toast('ลบรายการไม่สำเร็จ');
    }
  }
}

function renderHistory(){
  let q=($('search').value||'').toLowerCase().trim();
  let arr=[...data].sort((a,b)=>((b.date+' '+b.time).localeCompare(a.date+' '+a.time)));
  if(filter!=='all')arr=arr.filter(x=>x.type===filter);
  if(q)arr=arr.filter(x=>`${x.amount} ${x.category} ${x.bank} ${x.person} ${x.note} ${x.date}`.toLowerCase().includes(q));
  $('historyList').innerHTML=arr.length?arr.map(x=>txHTML(x)).join(''):'<div class="tx"><div class="txMain"><b>ไม่พบรายการ</b><span>ลองเปลี่ยนคำค้นหาหรือเพิ่มรายการใหม่</span></div></div>';
}

function renderReports(){
  const arr=reportMode==='month'?data.filter(x=>monthKey(x.date)===monthKey()):data;
  const inc=sum(arr,'income'),exp=sum(arr,'expense');
  $('reportIncome').textContent=money(inc);
  $('reportExpense').textContent=money(exp);$('reportNet').textContent=money(inc-exp);
  const days=Array.from({length:Math.min(new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate(),31)},(_,i)=>i+1);
  const vals=days.map(d=>arr.filter(x=>x.type==='expense'&&Number((x.date||'').slice(8,10))===d).reduce((a,x)=>a+Number(x.amount||0),0));
  const max=Math.max(...vals,1);
  $('barChart').innerHTML=vals.map((v,i)=>`<div class="bar" style="height:${Math.max(4,v/max*145)}px"><span>${i+1}</span></div>`).join('');
  const c={};arr.filter(x=>x.type==='expense').forEach(x=>c[x.category||'อื่นๆ']=(c[x.category||'อื่นๆ']||0)+Number(x.amount||0));
  $('reportCategories').innerHTML=Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="reportCat"><span>${CATS[k]||'📦'} ${esc(k)}</span><b>${money(v)}</b></div>`).join('')||'<span style="color:#6f88a8;font-size:12px">ยังไม่มีข้อมูล</span>';
}

function exportBackup(){
  const payload={version:5,exportedAt:new Date().toISOString(),owner:localStorage.getItem('mmOwner')||'',data};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`money-manager-backup-${today()}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('สร้างไฟล์สำรองแล้ว');
}

async function importBackup(file){
  try{
    const j=JSON.parse(await file.text());
    const arr=Array.isArray(j)?j:j.data;
    if(!Array.isArray(arr))throw Error();
    await clearDB();
    for(const x of arr)await put({...x,id:x.id||crypto.randomUUID()});
    data=await getAll();
    if(j.owner){localStorage.setItem('mmOwner',j.owner);$('owner').value=j.owner}
    renderHome();renderHistory();toast('นำเข้าข้อมูลแล้ว');
  }catch(e){toast('ไฟล์สำรองไม่ถูกต้อง')}
}

function normalizeDigits(s){const th='๐๑๒๓๔๕๖๗๘๙';return String(s).replace(/[๐-๙]/g,c=>th.indexOf(c))}
function cleanOCR(t){return normalizeDigits(t).replace(/\u200b/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}
function parseDateTime(text){
  const s=normalizeDigits(text);let date=null;
  for(const re of [/(?:วันที่|date)\s*[:.]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/]){
    const m=s.match(re);
    if(m){let d=+m[1],mo=+m[2],y=+m[3];if(y<100)y+=2000;if(y>2400)y-=543;if(d<=31&&mo<=12){date=`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;break}}
  }
  const tm=s.match(/(?:เวลา|time)?\s*([01]?\d|2[0-3])[:.]([0-5]\d)/i);
  return {date,time:tm?`${String(+tm[1]).padStart(2,'0')}:${tm[2]}`:null};
}

function amountCandidates(text){
  const s=normalizeDigits(text).replace(/,/g,'');let out=[];
  const label=/(?:จำนวนเงิน|ยอดเงิน|ยอดรวม|รวมทั้งสิ้น|amount|total|payment|ชำระ|โอนสำเร็จ|บาท|฿|THB)\s*[:=]?\s*(\d+(?:\.\d{1,2})?)/gi;
  for(const m of s.matchAll(label)){const n=+m[1];if(n>0&&n<100000000)out.push({n,score:10})}
  for(const m of s.matchAll(/(?<![\d])\d+\.\d{2}(?!\d)/g)){const n=+m[0];if(n>0&&n<100000000)out.push({n,score:3})}
  return [...new Map(out.map(x=>[x.n,x])).values()].sort((a,b)=>b.score-a.score||b.n-a.n);
}

function bankOf(text){
  const s=text.toLowerCase();
  const list=[['กสิกร','K PLUS / KBank'],['kbank','K PLUS / KBank'],['k plus','K PLUS / KBank'],['scb','SCB'],['ไทยพาณิชย์','SCB'],['กรุงไทย','Krungthai'],['krungthai','Krungthai'],['กรุงเทพ','Bangkok Bank'],['bangkok bank','Bangkok Bank'],['bbl','Bangkok Bank'],['กรุงศรี','Krungsri'],['krungsri','Krungsri'],['ttb','ttb'],['ทหารไทยธนชาต','ttb'],['ออมสิน','GSB'],['gsb','GSB'],['พร้อมเพย์','PromptPay'],['promptpay','PromptPay'],['ทรูมันนี่','TrueMoney'],['true money','TrueMoney']];
  return list.find(([a])=>s.includes(a))?.[1]||'';
}

function typeOf(text){const s=text.toLowerCase();if(/รับเงิน|ได้รับเงิน|เงินเข้า|ยอดเข้า|credit|received|income|รับโอน|เข้าบัญชี/.test(s))return'income';return'expense'}
function categoryOf(text,t){
  const s=text.toLowerCase();
  if(t==='income'&&/เงินเดือน|salary/.test(s))return'เงินเดือน';
  if(/อาหาร|restaurant|food|coffee|กาแฟ|cafe|7-eleven|เซเว่น|makro|โลตัส|big c/.test(s))return'อาหาร';
  if(/grab|bolt|taxi|แท็กซี่|เดินทาง|transport|รถ/.test(s))return'เดินทาง';
  if(/shopee|lazada|ช้อป|shopping|สินค้า/.test(s))return'ช้อปปิ้ง';
  if(/ค่าไฟ|ค่าน้ำ|internet|อินเทอร์เน็ต|โทรศัพท์/.test(s))return'บิล/สาธารณูปโภค';
  if(/น้ำมัน|gas station|ptt|shell|บางจาก/.test(s))return'น้ำมัน';
  return t==='income'?'งาน':'อื่นๆ';
}

function personOf(text){
  const lines=cleanOCR(text).split(/\n/).map(x=>x.trim()).filter(Boolean);
  for(const line of lines){
    if(/ผู้รับ|ผู้โอน|จาก|ถึง|receiver|recipient|from|to/i.test(line)){
      const v=line.replace(/^(.*?)(ผู้รับเงิน|ผู้รับ|ผู้โอน|จาก|ถึง|receiver|recipient|from|to)\s*[:：\-]?\s*/i,'').trim();
      if(v&&v.length>1&&!/^\d+$/.test(v))return v;
    }
  }
  return '';
}

async function imageData(file){
  return await new Promise((resolve,reject)=>{
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{
      const max=1800,s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
      c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(u);
      resolve(c.toDataURL('image/jpeg',.82));
    };
    img.onerror=reject;
    img.src=u;
  });
}

async function scanSlip(file){
  $('scanModal').classList.remove('hidden');$('modalText').textContent='กำลังเตรียมภาพสลิป';
  $('progressBar').style.width='4%';
  try{
    const img=await imageData(file);
    $('modalText').textContent='กำลังอ่านตัวอักษรจากสลิป';
    const r=await Tesseract.recognize(img,'tha+eng',{logger:m=>{if(m.status==='recognizing text'){$('progressBar').style.width=Math.max(5,Math.round(m.progress*100))+'\%';$('modalText').textContent=`กำลังอ่านสลิป ${Math.round(m.progress*100)}%`}}});
    const raw=cleanOCR(r.data.text);
    const dt=parseDateTime(raw),am=amountCandidates(raw)[0]?.n||0,t=typeOf(raw);
    const item={id:crypto.randomUUID(),type:t,amount:am,date:dt.date||today(),time:dt.time||nowTime(),category:categoryOf(raw,t),bank:bankOf(raw),person:personOf(raw),note:'บันทึกจากสลิปอัตโนมัติ',rawOCR:raw,created:Date.now(),source:'slip'};
    await put(item);
    data=await getAll();
    $('progressBar').style.width='100\%';$('modalText').textContent='บันทึกเรียบร้อย';
    await new Promise(r=>setTimeout(r,350));
    $('scanModal').classList.add('hidden');
    renderHome();renderHistory();nav('home');
    toast(item.amount?`บันทึกสลิปแล้ว ${money(item.amount)}`:'บันทึกสลิปแล้ว แต่ไม่พบยอดเงิน');
  }catch(e){
    console.error(e);
    $('scanModal').classList.add('hidden');
    toast('อ่านสลิปไม่สำเร็จ ลองใช้ภาพที่คมชัดขึ้น');
  }
  $('slipInput').value='';
}

async function manualSave(){
  const n=parseFloat(($('amount').value||'').replace(/,/g,''));
  if(!n||n<=0){toast('กรุณาใส่จำนวนเงิน');return}
  const x={id:crypto.randomUUID(),type,amount:n,date:$('date').value\vert{}\vert{}today(),time:$('time').value||nowTime(),category:$('category').value\vert{}\vert{}'อื่นๆ',bank:$('bank').value||'',person:$('person').value\vert{}\vert{}'',note:$('note').value||'',created:Date.now(),source:'manual'};
  await put(x);
  data=await getAll();
  resetForm();
  renderHome();
  toast('บันทึกรายการแล้ว');
  nav('home');
}

function bind(){
  setupNav();
  $('incomeTab').onclick=()=>setType('income');
  $('expenseTab').onclick=()=>setType('expense');$('manualSave').onclick=manualSave;
  $('scanDrop').onclick=()=>{if(window.innerWidth>800)toast('เลือกรูปสลิปได้เลยครับ');$('slipInput').click()};
  $('slipInput').onchange=e=>{if(e.target.files[0])scanSlip(e.target.files[0])};$('quickScan').onclick=()=>{$('slipInput').click()};$('search').oninput=renderHistory;
  $('clearSearch').onclick=()=>{$('search').value='';renderHistory()};
  document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{document.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;renderHistory()});
  $('backupTop').onclick=exportBackup;
  $('reportBackup').onclick=exportBackup;
  $('backupRow').onclick=exportBackup;
  $('importRow').onclick=()=>$('importInput').click();$('importInput').onchange=e=>e.target.files[0]&&importBackup(e.target.files[0]);
  $('owner').value=localStorage.getItem('mmOwner')\vert{}\vert{}'';$('owner').onchange=e=>{localStorage.setItem('mmOwner',e.target.value);toast('บันทึกชื่อแล้ว')};
  $('wipeRow').onclick=async()=>{if(confirm('ยืนยันลบข้อมูลทั้งหมด? การลบย้อนกลับไม่ได้')){await clearDB();data=[];renderHome();renderHistory();toast('ลบข้อมูลทั้งหมดแล้ว')}};
  
  // ปุ่มสลับโหมดมืด (Dark) / สว่าง (Light)
  $('themeBtn').onclick=()=>{
    document.body.classList.toggle('light');
    const isLight=document.body.classList.contains('light');
    localStorage.setItem('mmTheme',isLight?'light':'dark');
    toast(isLight?'เปลี่ยนเป็นโหมดสว่าง ☀️':'เปลี่ยนเป็นโหมดมืด ☾');
  };
  
  $('installRow').onclick=installApp;
  $('installBtn').onclick=installApp;
  document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-report]').forEach(x=>x.classList.remove('active'));b.classList.add('active');reportMode=b.dataset.report;renderReports()});
}

async function installApp(){
  if(deferredInstall){
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall=null;
    $('installBtn').classList.add('hidden');
  }else toast('Chrome: เมนู ⋮ → ติดตั้งแอป / เพิ่มไปยังหน้าจอหลัก');
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hidden')});
window.addEventListener('appinstalled',()=>toast('ติดตั้งแอปแล้ว'));
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

(async()=>{
  document.querySelectorAll('#category').forEach(s=>s.innerHTML=Object.keys(CATS).map(x=>`<option>${x}</option>`).join(''));
  $('date').value=today();$('time').value=nowTime();
  if(localStorage.getItem('mmTheme')==='light')document.body.classList.add('light');
  bind();
  await openDB();
  data=await getAll();
  renderHome();
  renderHistory();
  renderReports();
})();
