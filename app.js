const $ = id => document.getElementById(id);
const CATS = { "อาหาร": "🍲", "เดินทาง": "🚗", "ช็อปปิ้ง": "🛍️", "บิล/สาธารณูปโภค": "💡", "บ้าน": "🏠", "สุขภาพ": "💊", "บันเทิง": "🎮", "การศึกษา": "🎓", "น้ำมัน": "⛽", "งาน": "💼", "เงินเดือน": "💰", "อื่นๆ": "📦" };
const DB = 'money-manager-v5', STORE = 'transactions';
let db, data = [], type = 'expense', filter = 'all', reportMode = 'month', deferredInstall = null;

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const monthKey = d => String(d || today()).slice(0, 7);
const money = n => '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('show'); clearTimeout(window._toast); window._toast = setTimeout(() => t.classList.remove('show'), 2400); }

function openDB() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function tx(mode) { return db.transaction(STORE, mode).objectStore(STORE); }
function getAll() { return new Promise((res, rej) => { const r = tx('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
function put(x) { return new Promise((res, rej) => { const r = tx('readwrite').put(x); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
function del(id) { return new Promise((res, rej) => { const r = tx('readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

function sum(arr, t) { return arr.filter(x => x.type === t).reduce((a, x) => a + Number(x.amount || 0), 0); }

function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (page === 'history') renderHistory();
  if (page === 'reports') renderReports();
}

function setupNav() {
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => nav(b.dataset.page)));
}

function setType(t) {
  type = t;
  $('incomeTab').classList.toggle('active', t === 'income');$('expenseTab').classList.toggle('active', t === 'expense');
}

function renderHome() {
  const m = monthKey();
  const md = data.filter(x => monthKey(x.date) === m);
  const inc = sum(md, 'income'), exp = sum(md, 'expense'), allInc = sum(data, 'income'), allExp = sum(data, 'expense');
  $('balance').textContent = money(allInc - allExp);
  $('mIncome').textContent = money(inc);$('mExpense').textContent = money(exp);
}

// ลบรายการ
async function deleteItem(id) {
  if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
    await del(id);
    data = await getAll();
    renderHome();
    renderHistory();
    toast('ลบรายการเรียบร้อยแล้ว');
  }
}

function renderHistory() {
  let arr = [...data].sort((a, b) => (b.date + " " + b.time).localeCompare(a.date + " " + a.time));
  if (filter !== 'all') arr = arr.filter(x => x.type === filter);
  
  const html = arr.map(x => `
    <div class="item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="icon">${CATS[x.category] || '📦'}</div>
        <div>
          <div class="main" style="font-weight: bold;">${esc(x.category)} ${x.note ? `<span style="font-weight:normal; opacity:0.7;">(${esc(x.note)})</span>` : ''}</div>
          <div class="sub" style="font-size: 12px; opacity: 0.6;">${x.bank ? esc(x.bank) + ' • ' : ''}${x.date} ${x.time}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="${x.type}" style="font-weight: bold; color: ${x.type === 'income' ? '#2ecc71' : '#e74c3c'};">
          ${x.type === 'income' ? '+' : '-'}${money(x.amount)}
        </span>
        <button onclick="deleteItem('${x.id}')" style="background: none; border: none; color: #ff5252; cursor: pointer; font-size: 16px; padding: 4px 8px;" title="ลบรายการ">🗑️</button>
      </div>
    </div>
  `).join('');

  $('hList').innerHTML = html || '<div style="text-align:center; padding: 20px; opacity:0.5;">ไม่มีรายการ</div>';
}

function bind() {
  $('expenseTab').onclick = () => setType('expense');$('incomeTab').onclick = () => setType('income');

  $('saveBtn').onclick = async () => {
    const amt = parseFloat($('amount').value);
    if (!amt || amt <= 0) return toast('กรุณาระบุจำนวนเงิน');
    const item = {
      id: crypto.randomUUID(),
      type,
      amount: amt,
      date: $('date').value || today(),
      time: $('time').value || nowTime(),
      category: $('category').value,
      bank: $('bank').value,
      person: $('person').value,
      note: $('note').value
    };
    await put(item);
    data = await getAll();
    renderHome();
    $('amount').value = '';$('note').value = '';
    toast('บันทึกเรียบร้อย');
    nav('home');
  };

  $('filterAll').onclick = () => { filter = 'all'; renderHistory(); };
  $('filterInc').onclick = () => { filter = 'income'; renderHistory(); };$('filterExp').onclick = () => { filter = 'expense'; renderHistory(); };
}

(async () => {
  setupNav();
  db = await openDB();
  data = await getAll();
  $('date').value = today();$('time').value = nowTime();
  bind();
  renderHome();
})();
