/* ============ HARD CRYPTO — общая логика ============ */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

/* ---------- форматирование ---------- */
const fmtUSD = v => new Intl.NumberFormat('ru-RU', {
  style:'currency', currency:'USD', minimumFractionDigits:0,
  maximumFractionDigits: v < 1 ? 4 : v < 1000 ? 2 : 0
}).format(v);

const fmtFiat = (v, cur) => new Intl.NumberFormat('ru-RU', {
  style:'currency', currency: cur === 'eur' ? 'EUR' : 'RUB', minimumFractionDigits:0,
  maximumFractionDigits: v < 1 ? 6 : v < 1000 ? 2 : 0
}).format(v);

const fmtCap = v => new Intl.NumberFormat('ru-RU', {
  style:'currency', currency:'USD', notation:'compact', maximumFractionDigits:2
}).format(v);

const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const moodClass = p => p > 0.05 ? 'up' : p < -0.05 ? 'down' : 'flat';
const moodArrow = p => p > 0.05 ? '▲' : p < -0.05 ? '▼' : '◆';
const num = (v, d = 2) => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:d}).format(v);

/* ---------- резервные данные ---------- */
const FALLBACK = [
  {sym:'BTC', name:'Bitcoin', price:118000, pct:1.2, cap:2.33e12},
  {sym:'ETH', name:'Ethereum', price:4150, pct:0.9, cap:5.0e11},
  {sym:'USDT', name:'Tether', price:1.0, pct:0.01, cap:1.8e11},
  {sym:'XRP', name:'XRP', price:2.65, pct:-0.6, cap:1.55e11},
  {sym:'BNB', name:'BNB', price:720, pct:0.4, cap:1.0e11},
  {sym:'SOL', name:'Solana', price:215, pct:2.1, cap:1.12e11},
  {sym:'USDC', name:'USD Coin', price:1.0, pct:0.0, cap:7.5e10},
  {sym:'DOGE', name:'Dogecoin', price:0.24, pct:1.5, cap:3.6e10},
  {sym:'ADA', name:'Cardano', price:0.85, pct:0.7, cap:3.1e10},
  {sym:'TRX', name:'TRON', price:0.28, pct:-0.3, cap:2.6e10},
  {sym:'LINK', name:'Chainlink', price:18.5, pct:1.8, cap:1.3e10},
  {sym:'AVAX', name:'Avalanche', price:24.0, pct:-0.5, cap:1.0e10},
  {sym:'TON', name:'Toncoin', price:3.4, pct:-1.2, cap:8.7e9},
  {sym:'DOT', name:'Polkadot', price:4.6, pct:0.2, cap:7.0e9}
];

/* ---------- единая загрузка курсов ---------- */
let marketsPromise = null;
function loadMarkets(){
  if(marketsPromise) return marketsPromise;
  marketsPromise = (async () => {
    try{
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=14&page=1&sparkline=false&price_change_percentage=24h';
      const res = await fetch(url, {signal: ctrl.signal});
      clearTimeout(t);
      if(!res.ok) throw new Error('status ' + res.status);
      const coins = (await res.json())
        .map(c => ({sym:(c.symbol || '').toUpperCase(), name:c.name, price:c.current_price,
                    pct:c.price_change_percentage_24h ?? 0, cap:c.market_cap, img:c.image}))
        .filter(c => c.price != null);
      if(!coins.length) throw new Error('empty');
      return {coins, demo:false};
    }catch{
      return {coins: FALLBACK, demo:true};
    }
  })();
  return marketsPromise;
}

/* ---------- бегущая строка ---------- */
function renderTicker(coins){
  const track = $('#tickerTrack');
  if(!track) return;
  const html = coins.map(c =>
    `<span class="tick"><span class="sym">${esc(c.sym)}</span><b>${fmtUSD(c.price)}</b>` +
    `<span class="tp ${moodClass(c.pct)}">${moodArrow(c.pct)} ${Math.abs(c.pct).toFixed(1).replace('.', ',')}%</span></span>`
  ).join('');
  track.innerHTML = html + html;
}

/* ---------- топ монет (главная) ---------- */
function coinIcon(c){
  if(c.img) return `<img class="coin-ic" src="${c.img}" alt="" loading="lazy">`;
  const hue = [...c.sym].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return `<div class="coin-ic badge" style="background:hsl(${hue} 70% 45% / .22);color:hsl(${hue} 80% 72%);border:1px solid hsl(${hue} 80% 60% / .35)">${esc(c.sym[0])}</div>`;
}

function rowHTML(c, i){
  return `<div class="coin-row" style="animation-delay:${i * 35}ms">
    <div class="rank">${i + 1}</div>
    <div class="coin-id">${coinIcon(c)}
      <div class="coin-names"><div class="coin-name">${esc(c.name)}</div><div class="coin-sym">${esc(c.sym)}</div></div>
    </div>
    <div class="r"><span class="price">${fmtUSD(c.price)}</span></div>
    <div class="r"><span class="chg ${moodClass(c.pct)}">${moodArrow(c.pct)} ${c.pct.toFixed(2).replace('.', ',')}%</span></div>
    <div class="r cap cap-col"><span class="capv">${c.cap ? fmtCap(c.cap) : '—'}</span></div>
  </div>`;
}

function renderCoinsList(coins, demo){
  const body = $('#coinsBody');
  if(!body) return;
  body.innerHTML = coins.slice(0, 10).map(rowHTML).join('');
  const note = $('#srcNote');
  if(note){
    const time = new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    note.textContent = demo ? 'Показаны демо-данные: источник курсов сейчас недоступен' : `Обновлено в ${time} · данные CoinGecko`;
  }
}

/* ---------- загрузка живой цены для страницы графиков ---------- */
function renderLiveCoin(coins, sym){
  const el = $('#liveCoin');
  if(!el) return;
  const c = coins.find(x => x.sym === sym);
  if(!c){ el.innerHTML = ''; return; }
  el.innerHTML = `${coinIcon(c)}
    <div><div class="lv-name">${esc(c.name)}</div><div class="lv-sym">${esc(c.sym)}</div></div>
    <span class="lv-price">${fmtUSD(c.price)}</span>
    <span class="chg ${moodClass(c.pct)}">${moodArrow(c.pct)} ${c.pct.toFixed(2).replace('.', ',')}%</span>`;
}

/* ---------- страница графиков ---------- */
function initChart(){
  const canvas = $('#priceChart');
  if(!canvas || !window.Chart) return;

  Chart.defaults.color = '#93a0b5';
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.borderColor = 'rgba(255,255,255,.06)';

  const IDS = {
    BTC:'bitcoin', ETH:'ethereum', SOL:'solana', XRP:'ripple', BNB:'binancecoin',
    TON:'the-open-network', ADA:'cardano', DOGE:'dogecoin', TRX:'tron',
    LINK:'chainlink', DOT:'polkadot', AVAX:'avalanche-2'
  };
  const NAMES = {
    BTC:'Bitcoin', ETH:'Ethereum', SOL:'Solana', XRP:'XRP', BNB:'BNB',
    TON:'Toncoin', ADA:'Cardano', DOGE:'Dogecoin', TRX:'TRON',
    LINK:'Chainlink', DOT:'Polkadot', AVAX:'Avalanche'
  };
  const dayLabel = d => d === 365 ? '1 год' : d === 90 ? '90 дней' : d === 30 ? '30 дней' : '7 дней';

  let curCoin = 'BTC', curDays = 30, chart = null;
  const cache = {};

  const sel = $('#chartCoin');
  sel.innerHTML = Object.keys(IDS).map(k => `<option value="${k}">${NAMES[k]}</option>`).join('');
  sel.value = curCoin;

  async function draw(){
    const noteEl = $('#chartNote');
    noteEl.textContent = 'Загружаем график…';
    try{
      const key = IDS[curCoin] + '_' + curDays;
      let pts = cache[key];
      if(!pts){
        const url = `https://api.coingecko.com/api/v3/coins/${IDS[curCoin]}/market_chart?vs_currency=usd&days=${curDays}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error('status ' + res.status);
        const j = await res.json();
        pts = (j.prices || []).map(([t, p]) => ({t, p}));
        if(pts.length < 2) throw new Error('empty');
        cache[key] = pts;
      }
      renderChart(pts);
      renderStats(pts);
      noteEl.textContent = `Источник данных: CoinGecko · период: ${dayLabel(curDays)}`;
    }catch{
      noteEl.textContent = 'Не удалось загрузить график — сервис данных недоступен. Попробуйте позже.';
    }
  }

  function renderChart(pts){
    if(chart){ chart.destroy(); chart = null; }
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 420);
    grad.addColorStop(0, 'rgba(34,211,238,.30)');
    grad.addColorStop(1, 'rgba(34,211,238,0)');
    chart = new Chart(ctx, {
      type:'line',
      data:{
        labels: pts.map(p => new Date(p.t).toLocaleDateString('ru-RU', {day:'2-digit', month:'short'})),
        datasets:[{
          data: pts.map(p => p.p),
          borderColor:'#22d3ee', borderWidth:2,
          fill:true, backgroundColor:grad,
          pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:'#22d3ee',
          tension:.35
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index', intersect:false},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:'#0d1420', borderColor:'rgba(255,255,255,.12)', borderWidth:1,
            padding:12, titleColor:'#e8ecf4', bodyColor:'#e8ecf4', displayColors:false,
            callbacks:{
              title: items => new Date(pts[items[0].dataIndex].t).toLocaleDateString('ru-RU', {day:'2-digit', month:'long', year:'numeric'}),
              label: it => 'Цена: ' + fmtUSD(it.parsed.y)
            }
          }
        },
        scales:{
          x:{grid:{display:false}, ticks:{maxTicksLimit:8, maxRotation:0}},
          y:{grid:{color:'rgba(255,255,255,.06)'}, ticks:{callback: v => num(v, 1) + ' $'}}
        }
      }
    });
  }

  function renderStats(pts){
    const box = $('#chartStats');
    const first = pts[0].p, last = pts[pts.length - 1].p;
    const chg = (last - first) / first * 100;
    const min = Math.min(...pts.map(p => p.p));
    const max = Math.max(...pts.map(p => p.p));
    box.innerHTML = `
      <div><span>Изменение за период</span><b style="color:${chg >= 0 ? 'var(--up)' : 'var(--down)'}">${moodArrow(chg)} ${num(Math.abs(chg))}%</b></div>
      <div><span>Минимум</span><b>${fmtUSD(min)}</b></div>
      <div><span>Максимум</span><b>${fmtUSD(max)}</b></div>
      <div><span>Средняя цена</span><b>${fmtUSD(pts.reduce((s, p) => s + p.p, 0) / pts.length)}</b></div>`;
  }

  sel.addEventListener('change', e => {
    curCoin = e.target.value;
    loadMarkets().then(({coins}) => renderLiveCoin(coins, curCoin));
    draw();
  });
  $$('#rangePills .pill').forEach(b => b.addEventListener('click', () => {
    $$('#rangePills .pill').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    curDays = +b.dataset.days;
    draw();
  }));

  loadMarkets().then(({coins}) => renderLiveCoin(coins, curCoin));
  draw();
}

/* ---------- конвертер валют ---------- */
function initConverter(){
  const amountEl = $('#convAmount');
  if(!amountEl) return;
  const fromEl = $('#convFrom'), toEl = $('#convTo'), outEl = $('#convResult'), noteEl = $('#convHint');
  const bigEl = $('#convResultBig');

  const CRYPTO = [
    ['BTC','Bitcoin'], ['ETH','Ethereum'], ['USDT','Tether USDT'], ['BNB','BNB'],
    ['SOL','Solana'], ['XRP','XRP'], ['TON','Toncoin'], ['ADA','Cardano'],
    ['DOGE','Dogecoin'], ['TRX','TRON'], ['LINK','Chainlink'], ['DOT','Polkadot']
  ];
  const FIAT = [['usd','Доллар США ($)'], ['eur','Евро (€)'], ['rub','Рубль (₽)']];
  const opts = CRYPTO.map(([s, n]) => `<option value="${s}">${n} (${s})</option>`).join('') +
               FIAT.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  fromEl.innerHTML = opts;
  toEl.innerHTML = opts;
  fromEl.value = 'BTC';
  toEl.value = 'usd';

  const CG_IDS = {
    BTC:'bitcoin', ETH:'ethereum', USDT:'tether', BNB:'binancecoin', SOL:'solana',
    XRP:'ripple', TON:'the-open-network', ADA:'cardano', DOGE:'dogecoin',
    TRX:'tron', LINK:'chainlink', DOT:'polkadot'
  };
  /* usdPer: сколько долларов стоит 1 единица актива */
  let usdPer = null, demo = false;

  const FALLBACK_USD_PER = {
    BTC:118000, ETH:4150, USDT:1, BNB:720, SOL:215, XRP:2.65, TON:3.4,
    ADA:0.85, DOGE:0.24, TRX:0.28, LINK:18.5, DOT:4.6,
    usd:1, eur:1.09, rub:0.0109
  };

  async function loadRates(){
    try{
      const ids = Object.values(CG_IDS).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,rub,eur`;
      const res = await fetch(url);
      if(!res.ok) throw 0;
      const raw = await res.json();
      const byId = {};
      for(const [sym, id] of Object.entries(CG_IDS)){
        if(raw[id] && raw[id].usd) byId[sym] = raw[id];
      }
      if(!byId.BTC) throw 0;
      /* курс доллара к EUR/RUB вычисляем из котировок биткоина */
      const implied = {};
      if(byId.BTC.eur) implied.eur = byId.BTC.usd / byId.BTC.eur;
      if(byId.BTC.rub) implied.rub = byId.BTC.usd / byId.BTC.rub;
      usdPer = {usd:1};
      for(const [sym, o] of Object.entries(byId)) usdPer[sym] = o.usd;
      if(implied.eur) usdPer.eur = implied.eur;
      if(implied.rub) usdPer.rub = implied.rub;
      if(!usdPer.eur || !usdPer.rub) throw 0;
      updateHint(false);
    }catch{
      usdPer = FALLBACK_USD_PER;
      demo = true;
      updateHint(true);
    }
    convert();
  }

  function toUsd(key){ return usdPer[key]; }
  function fmtAsset(v, key){
    if(key === 'usd') return fmtUSD(v);
    if(key === 'eur' || key === 'rub') return fmtFiat(v, key);
    return num(v, 8) + ' ' + key;
  }

  function convert(){
    if(!usdPer) return;
    const from = fromEl.value, to = toEl.value;
    const parsed = parseFloat(String(amountEl.value).replace(',', '.'));
    if(!(parsed > 0)){
      outEl.value = '—';
      if(bigEl) bigEl.textContent = '—';
      return;
    }
    const usdVal = parsed * toUsd(from);
    const result = fmtAsset(usdVal / toUsd(to), to);
    outEl.value = result;
    if(bigEl) bigEl.textContent = result;
  }

  function updateHint(isDemo){
    const rubPerUsd = 1 / usdPer.rub;
    noteEl.textContent = isDemo
      ? `Курсы приблизительные (демо). 1 BTC ≈ ${fmtUSD(usdPer.BTC)} · 1 $ ≈ ${num(rubPerUsd)} ₽`
      : `Онлайн-курсы CoinGecko: 1 BTC ≈ ${fmtUSD(usdPer.BTC)} · 1 $ ≈ ${num(rubPerUsd)} ₽`;
  }

  amountEl.addEventListener('input', convert);
  fromEl.addEventListener('change', convert);
  toEl.addEventListener('change', convert);
  $('#swapBtn').addEventListener('click', () => {
    const f = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = f;
    convert();
  });
  $$('.quick-chips .chip').forEach(ch => ch.addEventListener('click', () => {
    amountEl.value = ch.dataset.a;
    convert();
  }));

  loadRates();
}

/* ---------- квиз ---------- */
function initQuiz(){
  const card = $('#quizCard');
  if(!card) return;

  const QUESTIONS = [
    {q:'Сколько биткоинов будет существовать в итоге?', opts:['21 миллион', 'Неограниченно', '1 миллиард', '100 тысяч'], a:0},
    {q:'Что такое блокчейн?', opts:['Вид криптобиржи', 'Распределённый реестр транзакций', 'Программа для майнинга', 'Тип кошелька'], a:1},
    {q:'Что такое сид-фраза?', opts:['Пароль от биржи', 'Название монеты', 'Мастер-ключ к кошельку из 12–24 слов', 'Код для 2FA'], a:2},
    {q:'Как называется сильное изменение цены за короткое время?', opts:['Диверсификация', 'Волатильность', 'Эмиссия', 'Децентрализация'], a:1},
    {q:'С чего разумно начать знакомство с криптой?', opts:['Вложить все сбережения', 'Купить монету по совету из чата', 'Изучить основы и начать с малой суммы', 'Взять кредит на покупку BTC'], a:2}
  ];

  let i = 0, score = 0, locked = false;

  function bodyHTML(){
    return `<div class="quiz-progress" id="quizProgress"></div>
      <h3 id="quizQ"></h3>
      <div class="quiz-opts" id="quizOpts"></div>`;
  }
  card.innerHTML = bodyHTML();

  function show(){
    const item = QUESTIONS[i];
    $('#quizProgress').textContent = `Вопрос ${i + 1} из ${QUESTIONS.length}`;
    $('#quizQ').textContent = item.q;
    $('#quizOpts').innerHTML = item.opts.map((o, idx) => `<button class="q-opt" data-i="${idx}">${o}</button>`).join('');
    $$('#quizOpts .q-opt').forEach(btn => btn.addEventListener('click', () => answer(+btn.dataset.i, btn)));
  }

  function answer(idx, btn){
    if(locked) return;
    locked = true;
    const correct = QUESTIONS[i].a;
    if(idx === correct){ score++; btn.classList.add('correct'); }
    else{ btn.classList.add('wrong'); $$('#quizOpts .q-opt')[correct].classList.add('correct'); }
    setTimeout(() => {
      i++; locked = false;
      if(i < QUESTIONS.length) show(); else finish();
    }, 950);
  }

  function finish(){
    let msg;
    if(score === 5) msg = 'Отлично! Ты готов погружаться глубже 🚀';
    else if(score >= 3) msg = 'Хороший результат — загляни в гайд, чтобы закрыть пробелы.';
    else msg = 'Ничего страшного — начни с раздела «Гайд» и попробуй ещё раз.';
    card.innerHTML = `<div class="quiz-result">
      <span class="score">${score} / 5</span>
      <p>${msg}</p>
      <button class="btn btn-primary" id="quizRestart">Пройти ещё раз</button>
    </div>`;
    $('#quizRestart').addEventListener('click', () => {
      i = 0; score = 0; locked = false;
      card.innerHTML = bodyHTML();
      show();
    });
  }

  show();
}

/* ---------- подсветка активного пункта меню ---------- */
function markActiveNav(){
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    if(a.getAttribute('href') === page) a.classList.add('active');
  });
}

/* ---------- создание страницы ---------- */
(async () => {
  markActiveNav();
  if($('#tickerTrack') || $('#coinsBody')){
    const {coins, demo} = await loadMarkets();
    renderTicker(coins);
    renderCoinsList(coins, demo);
  }
  initChart();
  initConverter();
  initQuiz();

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, {threshold:.12});
  $$('.reveal').forEach(el => io.observe(el));
})();
