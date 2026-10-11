/* ===== Núcleo: datas, feriados, dados, regras de escala ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const dowMon = s => (parse(s).getDay() + 6) % 7;           // 0 = segunda … 6 = domingo
const weekStartOf = s => addDays(s, -dowMon(s));
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS_L = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const dm = s => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
const dmy = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const todayISO = () => iso(new Date());
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = p => p + Math.random().toString(36).slice(2, 9);
const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const hrs = (ini, fim) => {
  if (!ini || !fim) return 0;
  const [a, b] = ini.split(':').map(Number), [c, d] = fim.split(':').map(Number);
  let m = (c * 60 + d) - (a * 60 + b); if (m <= 0) m += 1440; return m / 60;
};
const fmtH = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h${m % 60 ? pad(m % 60) : ''}`; };

const TIPOS = { fixo: 'Fixo', diarista: 'Diarista', intermitente: 'Intermitente' };

/* feriados nacionais (fixos + móveis a partir da Páscoa) e personalizados */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
const _hc = {};
function holidaysOfYear(y) {
  if (_hc[y]) return _hc[y];
  const m = {}, e = easter(y), sh = n => { const d = new Date(e); d.setDate(d.getDate() + n); return iso(d); };
  [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'],
   ['10-12', 'N. Sra. Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'],
   ['12-25', 'Natal']].forEach(([k, n]) => m[`${y}-${k}`] = n);
  m[sh(-2)] = 'Sexta-feira Santa'; m[sh(60)] = 'Corpus Christi';
  return _hc[y] = m;
}
function holidayName(d) {
  const y = +d.slice(0, 4), n = holidaysOfYear(y)[d];
  if (n) return n;
  for (const h of (S.config.feriadosExtra || [])) {
    if (h.data === d || (h.anual && h.data.slice(5) === d.slice(5))) return h.nome;
  }
  return null;
}

/* ===== estado ===== */
const S = {
  staff: {}, special: {}, extras: {}, checkins: {}, baixas: {}, faltas: {},
  config: { adicionalFeriado: 100, manterProximos: true, baseAte: null, feriadosExtra: [] },
  ui: { tab: 'hoje', date: todayISO(), week: weekStartOf(todayISO()), gridMode: 'semana', fEquipe: 'todos', fExtras: 'todos',
        mes: todayISO().slice(0, 7), fdsMes: todayISO().slice(0, 7), base: 'escalados' },
  ready: false, cloud: false
};
const COLS = ['staff', 'special', 'extras', 'checkins', 'baixas', 'faltas'];
const LS = 'gestao-escalas-v1';
let DB = null;

function saveLocal() {
  try { localStorage.setItem(LS, JSON.stringify(COLS.reduce((o, c) => (o[c] = S[c], o), { config: S.config }))); } catch (e) { }
}
function loadLocal() {
  try {
    const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (!j) return;
    COLS.forEach(c => S[c] = j[c] || {}); S.config = Object.assign(S.config, j.config || {});
  } catch (e) { }
}
function setSync(cloud) {
  S.cloud = cloud;
  $('#sync-dot').classList.toggle('off', !cloud);
  $('#sync-txt').textContent = cloud ? 'Salvo na nuvem' : 'Salvo só neste navegador';
}

async function initStore(onChange) {
  try { DB = await claude.use('db'); } catch (e) { DB = null; }
  if (!DB) { loadLocal(); setSync(false); S.ready = true; onChange(); return; }
  setSync(true);
  let pending = COLS.length + 1;
  const done = () => { if (--pending === 0) S.ready = true; onChange(); };
  COLS.forEach(c => {
    let first = true;
    DB.collection(c).onSnapshot(snap => {
      const o = {}; snap.docs.forEach(d => { o[d.id] = Object.assign({}, d.data(), { id: d.id }); });
      S[c] = o; if (first) { first = false; done(); } else onChange();
    }, () => { setSync(false); });
  });
  let firstC = true;
  DB.doc('config/main').onSnapshot(s => {
    if (s.exists) S.config = Object.assign({ adicionalFeriado: 100, manterProximos: true, baseAte: null, feriadosExtra: [] }, s.data());
    if (firstC) { firstC = false; done(); } else onChange();
  }, () => { setSync(false); });
}

let _chg = () => { };
async function put(col, id, data) {
  data = Object.assign({}, data, { id });
  S[col][id] = data; _chg();
  if (!DB) return saveLocal();
  try { await DB.doc(`${col}/${id}`).set(data); } catch (e) { toast('Não foi possível salvar. Verifique sua permissão de edição.'); }
}
async function drop(col, id) {
  delete S[col][id]; _chg();
  if (!DB) return saveLocal();
  try { await DB.doc(`${col}/${id}`).delete(); } catch (e) { toast('Não foi possível excluir.'); }
}
async function putConfig(patch) {
  S.config = Object.assign({}, S.config, patch); _chg();
  if (!DB) return saveLocal();
  try { await DB.doc('config/main').set(S.config); } catch (e) { toast('Não foi possível salvar a configuração.'); }
}

/* ===== regras de escala ===== */
/* ordem da lista: primeiro a ordem de cadastro (campo ordem), depois o nome */
const byOrdem = (a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999) || (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
const staffList = (tipos) => Object.values(S.staff).filter(p => p.ativo !== false && !p.vaga && (!tipos || tipos.includes(p.tipo))).sort(byOrdem);
const subStaff = p => [p.setor, p.funcao].filter(Boolean).map(esc).join(' · ');
/* afastamento: licença médica ou férias, sem prazo definido ou até a data informada */
const SIT = { licenca: 'Licença médica', ferias: 'Férias' };
const afastadoEm = (p, d) => (p.situacao && SIT[p.situacao] && (!p.afastadoAte || d <= p.afastadoAte)) ? SIT[p.situacao] : null;
const fixos = () => staffList(['fixo']);
const extrasStaff = () => staffList(['diarista', 'intermitente']);

function baseValid(d) {
  if (S.config.manterProximos !== false) return true;
  return S.config.baseAte ? d <= S.config.baseAte : true;
}
/* folga fixa: dia da semana (0 = segunda … 6 = domingo) em que a pessoa sempre folga */
const isFolgaFixa = (p, k) => Array.isArray(p.folgaFixa) && p.folgaFixa.includes(k);
/* horário de um colaborador fixo em uma data. Prioridade: escala especial > folga fixa > escala geral */
function shiftFor(p, d) {
  const af = afastadoEm(p, d); if (af) return { folga: true, afastado: af, src: 'afastamento' };
  const ws = weekStartOf(d), k = dowMon(d), sp = S.special[`${ws}_${p.id}`];
  if (sp && sp.dias && Object.prototype.hasOwnProperty.call(sp.dias, String(k))) {
    const v = sp.dias[k]; return v && v.ini ? { ini: v.ini, fim: v.fim, src: 'especial' } : { folga: true, src: 'especial' };
  }
  if (!baseValid(d)) return { semEscala: true };
  if (isFolgaFixa(p, k)) return { folga: true, fixa: true, src: 'geral' };
  const v = p.padrao && p.padrao[k];
  return v ? { ini: v.ini, fim: v.fim, src: 'geral' } : { folga: true, src: 'geral' };
}
const extrasOn = d => Object.values(S.extras).filter(x => x.data === d && S.staff[x.staffId])
  .sort((a, b) => (a.ini || '').localeCompare(b.ini || ''));
const checkinOf = (d, sid) => S.checkins[`${d}_${sid}`];
const specialWeekCount = ws => Object.values(S.special).filter(s => s.semana === ws).length;

/* ===== interface comum ===== */
function toast(msg) {
  const r = $('#toast-root'); r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toast._t); toast._t = setTimeout(() => r.innerHTML = '', 3200);
}
function openSheet(html, mount) {
  closeSheet();
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheet';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('mousedown', e => { if (e.target === bg) closeSheet(); });
  $('#modal-root').appendChild(bg);
  mount && mount(bg.firstElementChild);
  const f = $('input,select,button.primary', bg); f && f.focus && f.focus({ preventScroll: true });
  return bg;
}
function closeSheet() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ===== Telas: Hoje e Escala ===== */
const V = {};
const empty = (t, s) => `<div class="empty"><b>${t}</b>${s}</div>`;
const navD = (id, lbl) => `<div class="nav-d"><button class="btn sm" data-nav="${id}:-1" aria-label="Anterior">‹</button>
  <span class="lbl">${lbl}</span><button class="btn sm" data-nav="${id}:1" aria-label="Próximo">›</button></div>`;
const fmtLongDate = d => `${DIAS_L[dowMon(d)]}, ${dm(d)}`;

/* ---------- HOJE ---------- */
V.hoje = () => {
  const d = S.ui.date, fer = holidayName(d), fx = fixos();
  const trab = [], folga = [];
  fx.forEach(p => { const s = shiftFor(p, d); (s.ini ? trab : folga).push({ p, s }); });
  trab.sort((a, b) => a.s.ini.localeCompare(b.s.ini));
  const ex = extrasOn(d);
  let h = `<div class="bar"><h2>${d === todayISO() ? 'Hoje' : 'Dia'} · ${fmtLongDate(d)}</h2>
    <div class="row">${navD('dia', dmy(d))}<button class="btn sm" data-act="hoje-d">Hoje</button></div></div>`;
  if (fer) h += `<div class="banner feriado">Feriado: ${esc(fer)}</div>`;
  if (!fx.length && !ex.length && !Object.keys(S.staff).length)
    return h + empty('Nenhum colaborador cadastrado', 'Abra a aba <b style="display:inline">Equipe</b> e cadastre o primeiro colaborador para montar a escala.');
  h += `<div class="stats"><div class="stat"><b>${trab.length}</b><span>Fixos trabalhando</span></div>
    <div class="stat"><b>${folga.length}</b><span>Fixos de folga</span></div>
    <div class="stat"><b>${ex.length}</b><span>Extras escalados</span></div></div>`;
  h += `<div class="cards"><section class="card"><h3>Trabalhando</h3><div class="list">` +
    (trab.length ? trab.map(({ p, s }) => `<div class="item"><div class="avatar">${esc(initials(p.nome))}</div>
      <div class="who"><b>${esc(p.nome)}</b><span>${subStaff(p)}${s.src === 'especial' ? ' · escala especial' : ''}</span></div>
      <div class="time">${s.ini}–${s.fim}</div></div>`).join('') : '<div class="hint" style="padding:10px 0">Ninguém escalado neste dia.</div>') +
    `</div></section><section class="card"><h3>De folga</h3><div class="list">` +
    (folga.length ? folga.map(({ p, s }) => `<div class="item"><div class="avatar" style="background:var(--off);color:var(--off-ink)">${esc(initials(p.nome))}</div>
      <div class="who"><b>${esc(p.nome)}</b><span>${subStaff(p)}</span></div>
      <span class="chip mute">${s.semEscala ? 'Sem escala' : s.afastado ? s.afastado : s.fixa ? 'Folga fixa' : 'Folga'}</span></div>`).join('') : '<div class="hint" style="padding:10px 0">Ninguém de folga.</div>') +
    `</div></section><section class="card"><h3>Extras do dia</h3><div class="list">` +
    (ex.length ? ex.map(x => extraRow(x, true)).join('') : '<div class="hint" style="padding:10px 0">Nenhum diarista ou intermitente escalado.</div>') +
    `</div><div class="acts"><button class="btn sm" data-act="add-extra" data-d="${d}">+ Escalar extra</button>
    <button class="btn sm primary" data-act="checkin" data-d="${d}">Check-in</button></div></section></div>`;
  return h;
};

function extraRow(x, showDate) {
  const p = S.staff[x.staffId], c = checkinOf(x.data, x.staffId), hoje = x.data === todayISO();
  const st = c ? `<button class="chip ok" style="border:0;cursor:pointer" data-act="checkin" data-id="${p.id}" aria-label="Ver ou corrigir o check-in de ${esc(p.nome)}">${c.saida ? `Saiu ${c.saida}` : `Entrou ${c.entrada}`}</button>`
    : (x.data <= todayISO() ? `<span class="chip warn">Sem check-in</span>` : `<span class="chip mute">Agendado</span>`);
  const acao = hoje && !(c && c.saida) ? `<button class="btn sm primary" data-act="quick-in" data-id="${p.id}">${c ? 'Saída' : 'Entrada'}</button>` : '';
  return `<div class="item"><div class="avatar">${esc(initials(p.nome))}</div>
    <div class="who"><b>${esc(p.nome)}</b><span>${TIPOS[p.tipo]} · ${esc(p.funcao || '')}${showDate === 'data' ? ' · ' + dm(x.data) : ''}${x.obs ? ' · ' + esc(x.obs) : ''}${pgTxt(x)}</span></div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px"><div class="time">${x.ini}–${x.fim}</div>${st}${acao}</div>
    <button class="btn sm ghost" data-act="edit-extra" data-id="${x.id}" aria-label="Editar">✎</button></div>`;
}

/* ---------- ESCALA ---------- */
V.escala = () => {
  if (S.ui.gridMode === 'fds') return escalaFds();
  const ws = S.ui.week, base = S.ui.gridMode === 'geral', fx = fixos();
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));
  const nEsp = specialWeekCount(ws);
  let h = `<div class="bar"><h2>Escala dos fixos</h2>${modeSeg()}</div>`;
  if (!base) {
    h += `<div class="bar" style="margin-top:0"><div class="row">${navD('sem', `${dm(days[0])} a ${dm(days[6])}`)}
      <button class="btn sm" data-act="hoje-w">Esta semana</button></div>
      <div class="row"><button class="btn sm wa" data-act="wa-todos">Enviar por WhatsApp</button></div></div>`;
    if (nEsp) h += `<div class="banner especial">Escala especial ativa nesta semana (${nEsp} ${nEsp > 1 ? 'colaboradores' : 'colaborador'}). A escala geral não foi alterada.
      <button class="btn sm" style="margin-left:8px" data-act="reset-week">Voltar ao padrão</button></div>`;
  } else {
    h += `<p class="hint" style="margin:0 0 12px">A escala geral se repete toda semana, de segunda a sexta (azul) e no fim de semana (vermelho). Toque em um dia para mudar.</p>`;
  }
  if (!fx.length) return h + empty('Nenhum colaborador fixo', 'Cadastre os fixos na aba Equipe (nome e função) para montar a escala.');

  const cols = days.map((d, i) => {
    const fer = !base && holidayName(d);
    const cls = fer ? 'fer' : (i > 4 ? 'fds' : '');
    return `<th class="${cls}">${DIAS[i]}${base ? (i > 4 ? '<small>fim de semana</small>' : '') : `<small>${dm(d)}${fer ? ' · feriado' : ''}</small>`}</th>`;
  }).join('');
  h += `<div class="scroll"><table class="grid"><thead><tr><th class="name">Colaborador</th>${cols}</tr></thead><tbody>`;
  fx.forEach(p => {
    h += `<tr><td class="name"><b>${esc(p.nome)}</b><span>${subStaff(p)}</span>
      ${!base && p.whatsapp ? `<div><button class="btn sm wa" style="margin-top:5px" data-act="wa-one" data-id="${p.id}">WhatsApp</button></div>` : ''}</td>`;
    days.forEach((d, i) => {
      let s, fer = false;
      if (base) {
        if (isFolgaFixa(p, i)) s = { folga: true, fixa: true };
        else { const v = p.padrao && p.padrao[i]; s = v ? { ini: v.ini, fim: v.fim } : { folga: true }; }
      }
      else { s = shiftFor(p, d); fer = !!holidayName(d); }
      const c = ['cell', s.folga || s.semEscala ? 'folga' : '', fer ? 'fer' : '', i > 4 ? 'fdsc' : ''].filter(Boolean).join(' ');
      const tag = s.afastado ? `<span class="tag">${s.afastado.toLowerCase()}</span>` : s.src === 'especial' ? '<span class="tag">especial</span>' : s.fixa ? '<span class="tag">folga fixa</span>' : (fer && s.ini ? '<span class="tag">feriado</span>' : '');
      h += `<td><button class="${c}" data-act="cell" data-id="${p.id}" data-i="${i}" data-d="${d}">
        ${s.semEscala ? 'Sem escala' : s.afastado ? 'Afastado' : s.folga ? 'Folga' : `${s.ini}<br>${s.fim}`}${tag}</button></td>`;
    });
    h += `</tr>`;
  });
  h += `</tbody></table></div><div class="legend"><span><i style="background:var(--accent)"></i>Segunda a sexta</span>
    <span><i style="background:var(--fds)"></i>Fim de semana</span><span><i style="background:var(--feriado-bg);border:1px solid var(--feriado-ink)"></i>Feriado</span>
    <span><i style="background:var(--off)"></i>Folga</span></div>`;
  if (!base) {
    const exs = days.flatMap(d => extrasOn(d));
    if (exs.length) h += `<div class="sect">Extras na semana</div><section class="card"><div class="list">${exs.map(x => extraRow(x, 'data')).join('')}</div></section>`;
  }
  return h;
};

/* ===== Telas: Extras, Equipe e Relatório ===== */

/* ---------- EXTRAS ---------- */
V.extras = () => {
  if (S.ui.exView === 'pag') return pagamentosView();
  const ws = S.ui.week, f = S.ui.fExtras;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));
  let h = exSeg() + `<div class="bar"><h2>Escala de extras</h2><div class="seg" role="group" aria-label="Filtro">
    ${[['todos', 'Todos'], ['diarista', 'Diaristas'], ['intermitente', 'Intermitentes']].map(([k, l]) => `<button data-fex="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div></div>
    <div class="bar" style="margin-top:0"><div class="row">${navD('sem', `${dm(days[0])} a ${dm(days[6])}`)}<button class="btn sm" data-act="hoje-w">Esta semana</button></div>
    <div class="row"><button class="btn sm" data-act="repeat-month">Manter para o próximo mês</button></div></div>`;
  if (!extrasStaff().length)
    return h + empty('Nenhum diarista ou intermitente', 'Cadastre diaristas e intermitentes na aba Equipe, com o valor da diária, para escalar extras.');
  h += `<div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">`;
  days.forEach((d, i) => {
    const fer = holidayName(d), list = extrasOn(d).filter(x => f === 'todos' || S.staff[x.staffId].tipo === f);
    h += `<section class="card" style="${fer ? 'background:var(--feriado-bg);border-color:var(--feriado-ink)' : i > 4 ? 'background:var(--fds-bg)' : ''}">
      <div class="row" style="justify-content:space-between;margin-bottom:6px"><h3 style="${i > 4 ? 'color:var(--fds)' : ''}">${DIAS[i]} ${dm(d)}</h3>
      ${fer ? `<span class="chip red">${esc(fer)}</span>` : ''}</div>
      <div class="list">${list.length ? list.map(x => extraRow(x)).join('') : '<div class="hint" style="padding:6px 0">Sem extras.</div>'}</div>
      <div class="acts"><button class="btn sm" data-act="add-extra" data-d="${d}">+ Escalar</button>
      ${d <= todayISO() && d >= addDays(todayISO(), -2) ? `<button class="btn sm primary" data-act="checkin" data-d="${d}">Check-in</button>` : ''}</div></section>`;
  });
  return h + '</div>';
};

/* ---------- EXTRAS: PAGAMENTOS (situação de pagamento das diárias) ---------- */
/* Cada extra pode ter  pg = { st: 'pago' | 'agendado', data, valor }.  Sem pg = pendente. */
const exSeg = () => `<div class="seg" role="group" aria-label="Seção dos extras" style="margin-bottom:12px">
  <button data-exv="escala" aria-pressed="${S.ui.exView !== 'pag'}">Escala</button>
  <button data-exv="pag" aria-pressed="${S.ui.exView === 'pag'}">Pagamentos</button></div>`;
const valorDia = x => { const p = S.staff[x.staffId] || {}, di = p.diaria || 0; return di + (holidayName(x.data) ? di * (S.config.adicionalFeriado ?? 100) / 100 : 0); };
const temFalta = x => Object.values(S.faltas).some(f => f.staffId === x.staffId && f.data === x.data);
/* situação de pagamento de um extra: pago | agend | pend | futuro (ainda não trabalhou) | falta (não paga) */
function pgInfo(x) {
  const hoje = todayISO();
  if (x.pg && x.pg.st === 'pago') return { st: 'pago', data: x.pg.data, valor: x.pg.valor ?? valorDia(x) };
  if (temFalta(x)) return { st: 'falta', valor: 0 };
  const valor = valorDia(x);
  if (x.pg && x.pg.st === 'agendado') return { st: 'agend', data: x.pg.data, valor, atrasado: !!x.pg.data && x.pg.data < hoje };
  return { st: x.data > hoje ? 'futuro' : 'pend', valor };
}
const PG = { pend: ['warn', 'A pagar'], agend: ['mute', 'Agendado'], pago: ['ok', 'Pago'], futuro: ['mute', 'Ainda não trabalhou'], falta: ['red', 'Falta · sem pagamento'] };
const pgTxt = x => !x.pg ? '' : x.pg.st === 'pago' ? ` · Pago${x.pg.data ? ' em ' + dm(x.pg.data) : ''}` : ` · Pgto agendado${x.pg.data ? ' p/ ' + dm(x.pg.data) : ''}`;

function pagamentosView() {
  const mes = S.ui.mes, [y, m] = mes.split('-').map(Number), f = S.ui.fPag || 'todos', por = {};
  Object.values(S.extras).filter(x => x.data.startsWith(mes) && S.staff[x.staffId] && S.staff[x.staffId].tipo !== 'fixo').forEach(x => {
    const g = por[x.staffId] = por[x.staffId] || { p: S.staff[x.staffId], l: [] }; g.l.push({ x, i: pgInfo(x) });
  });
  const grupos = Object.values(por).sort((a, b) => byOrdem(a.p, b.p));
  const soma = st => grupos.reduce((s, g) => s + g.l.filter(q => q.i.st === st).reduce((t, q) => t + q.i.valor, 0), 0);
  const cont = st => grupos.reduce((s, g) => s + g.l.filter(q => q.i.st === st).length, 0);
  const mostrar = g => f === 'todos' || g.l.some(q => q.i.st === ({ pend: 'pend', agend: 'agend', pago: 'pago' })[f]);
  let h = exSeg() + `<div class="bar"><h2>Pagamentos dos extras</h2>${navD('mes', `${MESES[m - 1]} ${y}`)}</div>
    <div class="stats"><div class="stat"><b>${brl(soma('pend'))}</b><span>A pagar · ${cont('pend')} ${cont('pend') === 1 ? 'dia' : 'dias'}</span></div>
    <div class="stat"><b>${brl(soma('agend'))}</b><span>Agendado · ${cont('agend')} ${cont('agend') === 1 ? 'dia' : 'dias'}</span></div>
    <div class="stat"><b>${brl(soma('pago'))}</b><span>Pago · ${cont('pago')} ${cont('pago') === 1 ? 'dia' : 'dias'}</span></div></div>
    <div class="seg" role="group" aria-label="Filtro de pagamento" style="margin-bottom:12px">
    ${[['todos', 'Todos'], ['pend', 'A pagar'], ['agend', 'Agendados'], ['pago', 'Pagos']].map(([k, l]) => `<button data-pgf="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>`;
  if (!grupos.length) return h + empty('Sem extras em ' + MESES[m - 1], 'Quando houver diaristas ou intermitentes escalados no mês, a situação de pagamento aparece aqui.');
  const lista = grupos.filter(mostrar);
  if (!lista.length) return h + empty('Nada nesta situação', 'Troque o filtro para ver os outros pagamentos do mês.');
  h += `<section class="card"><div class="list">` + lista.map(g => {
    const c = st => g.l.filter(q => q.i.st === st), pe = c('pend'), ag = c('agend'), pa = c('pago'), fu = c('futuro'), fa = c('falta'), val = a => a.reduce((s, q) => s + q.i.valor, 0);
    const datas = [...new Set(ag.map(q => q.i.data).filter(Boolean))].sort().map(dm).join(', '), atras = ag.some(q => q.i.atrasado);
    return `<div class="item"><div class="avatar">${esc(initials(g.p.nome))}</div>
      <div class="who"><b>${esc(g.p.nome)}</b><span>${TIPOS[g.p.tipo]} · ${brl(g.p.diaria)} por diária · ${g.l.length} ${g.l.length === 1 ? 'dia' : 'dias'} no mês</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">
        ${pe.length ? `<span class="chip warn">${pe.length} a pagar · ${brl(val(pe))}</span>` : ''}
        ${ag.length ? `<span class="chip ${atras ? 'red' : 'mute'}">${ag.length} agendado${ag.length > 1 ? 's' : ''}${datas ? ' p/ ' + datas : ''} · ${brl(val(ag))}${atras ? ' · atrasado' : ''}</span>` : ''}
        ${pa.length ? `<span class="chip ok">${pa.length} ${pa.length > 1 ? 'pagos' : 'pago'} · ${brl(val(pa))}</span>` : ''}
        ${fu.length ? `<span class="chip mute">${fu.length} a trabalhar</span>` : ''}${fa.length ? `<span class="chip red">${fa.length} falta${fa.length > 1 ? 's' : ''}</span>` : ''}</div></div>
      <button class="btn sm ${pe.length ? 'primary' : ''}" data-act="pagar" data-id="${g.p.id}">Pagamento</button></div>`;
  }).join('') + `</div></section>
    <p class="hint" style="margin-top:10px">Valor do dia = diária + adicional de feriado (${S.config.adicionalFeriado ?? 100}%). Dias com falta registrada não são pagos.</p>`;
  return h;
}

function pagForm(sid) {
  const p = S.staff[sid], mes = S.ui.mes, hoje = todayISO();
  const itens = Object.values(S.extras).filter(x => x.staffId === sid && x.data.startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data) || (a.ini || '').localeCompare(b.ini || ''));
  if (!p || !itens.length) { toast('Nenhum extra deste colaborador no mês.'); return; }
  const padrao = itens.some(x => pgInfo(x).st === 'pend') ? 'pend' : 'agend';   // já vem marcado o que falta pagar (ou, se nada falta, o agendado)
  const linha = x => {
    const i = pgInfo(x), [cls, lbl] = PG[i.st], fer = holidayName(x.data);
    const det = i.st === 'pago' ? `Pago${i.data ? ' em ' + dmy(i.data) : ''}` : i.st === 'agend' ? `Agendado${i.data ? ' para ' + dmy(i.data) : ''}${i.atrasado ? ' · atrasado' : ''}` : '';
    return `<label class="opt" style="${i.st === 'falta' ? 'opacity:.6' : ''}"><input type="checkbox" name="pg-x" value="${x.id}" ${i.st === padrao ? 'checked' : ''} ${i.st === 'falta' ? 'disabled' : ''}>
      <div style="flex:1"><b>${DIAS[dowMon(x.data)]} ${dm(x.data)} · ${x.ini}–${x.fim}</b><span>${[i.st === 'falta' ? 'Não é pago' : brl(i.valor) + (fer ? ' (feriado: ' + esc(fer) + ')' : ''), det].filter(Boolean).join(' · ')}</span></div>
      <span class="chip ${cls}">${lbl}</span></label>`;
  };
  openSheet(`<h3>Pagamento · ${esc(p.nome)}</h3>
    <p class="hint" style="margin:0 0 10px">${TIPOS[p.tipo]} · ${brl(p.diaria)} por diária</p>
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="hint" style="margin:0">Marque os dias</span><button class="btn sm" type="button" id="pg-all">Marcar todos</button></div>
    <div class="opts" style="max-height:260px;overflow:auto;margin-bottom:12px">${itens.map(linha).join('')}</div>
    <div class="f"><span class="l">O que fazer com os dias marcados</span><div class="opts">
      <label class="opt"><input type="radio" name="pg-a" value="pago" checked><div><b>Marcar como pago</b><span>Registra a data do pagamento e o valor.</span></div></label>
      <label class="opt"><input type="radio" name="pg-a" value="agendado"><div><b>Agendar o pagamento</b><span>Escolha o dia em que vai pagar.</span></div></label>
      <label class="opt"><input type="radio" name="pg-a" value="limpar"><div><b>Voltar para “a pagar”</b><span>Desfaz o pagamento ou o agendamento.</span></div></label></div></div>
    <div class="f" id="pg-df"><label for="pg-d" id="pg-dl">Data do pagamento</label><input id="pg-d" type="date" value="${hoje}"></div>
    <div id="pg-res" class="banner especial"></div>
    <div class="acts"><button class="btn" id="pg-x">Fechar</button><button class="btn primary" id="pg-ok">Aplicar</button></div>`,
  r => {
    const sel = () => $$('input[name=pg-x]:checked', r).map(c => S.extras[c.value]).filter(Boolean), acao = () => $('input[name=pg-a]:checked', r).value;
    const resumo = () => {
      const l = sel(), a = acao(), tot = l.reduce((s, x) => s + valorDia(x), 0);
      $('#pg-df', r).hidden = a === 'limpar';
      $('#pg-dl', r).textContent = a === 'pago' ? 'Data do pagamento' : 'Pagar no dia';
      $('#pg-res', r).textContent = l.length ? `${l.length} ${l.length > 1 ? 'dias marcados' : 'dia marcado'} · ${brl(tot)}` : 'Nenhum dia marcado.';
      $('#pg-ok', r).disabled = !l.length;
    };
    $$('input', r).forEach(i => i.onchange = resumo);
    $('#pg-all', r).onclick = () => {
      const cs = $$('input[name=pg-x]:not(:disabled)', r), todos = cs.every(c => c.checked);
      cs.forEach(c => c.checked = !todos); $('#pg-all', r).textContent = todos ? 'Marcar todos' : 'Limpar'; resumo();
    };
    $('#pg-x', r).onclick = closeSheet;
    $('#pg-ok', r).onclick = async () => {
      const l = sel(), a = acao(), d = $('#pg-d', r).value;
      if (!l.length) return;
      if (a !== 'limpar' && !d) { toast('Informe a data.'); return; }
      for (const x of l) {
        const o = Object.assign({}, x); delete o.pg;
        if (a === 'pago') o.pg = { st: 'pago', data: d, valor: valorDia(x) };
        else if (a === 'agendado') o.pg = { st: 'agendado', data: d };
        await put('extras', x.id, o);
      }
      closeSheet(); toast(a === 'pago' ? `${l.length} ${l.length > 1 ? 'dias marcados' : 'dia marcado'} como pago.` : a === 'agendado' ? `Pagamento agendado para ${dm(d)}.` : 'Voltou para “a pagar”.');
    };
    resumo();
  });
}

/* ---------- EQUIPE ---------- */
V.equipe = () => {
  const f = S.ui.fEquipe;
  const all = Object.values(S.staff).sort(byOrdem), nv = all.filter(p => p.vaga).length;
  const list = all.filter(p => f === 'todos' || (f === 'vaga' ? p.vaga : p.tipo === f && !p.vaga));
  let h = `<div class="bar"><h2>Equipe</h2><button class="btn primary" data-act="add-staff">+ Cadastrar</button></div>
    <div class="seg" role="group" aria-label="Filtro" style="margin-bottom:12px">
    ${[['todos', 'Todos'], ['fixo', 'Fixos'], ['diarista', 'Diaristas'], ['intermitente', 'Intermitentes'], ['vaga', nv ? `Vagas (${nv})` : 'Vagas']].map(([k, l]) => `<button data-feq="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>`;
  if (!list.length) return h + empty('Ninguém por aqui ainda', 'Use “Cadastrar” para incluir colaboradores fixos, diaristas e intermitentes.');
  h += `<section class="card"><div class="list">` + list.map(p => `<div class="item" style="${p.ativo === false ? 'opacity:.55' : ''}">
    <div class="avatar">${esc(initials(p.nome))}</div>
    <div class="who"><b>${esc(p.nome)}</b><span>${p.setor ? esc(p.setor) + ' · ' : ''}${esc(p.funcao || (p.vaga ? 'A contratar' : 'Sem função'))} · ${TIPOS[p.tipo]}${p.tipo !== 'fixo' ? ' · ' + brl(p.diaria) + ' por diária' : (p.folgaFixa && p.folgaFixa.length ? ' · folga fixa: ' + p.folgaFixa.map(i => DIAS[i]).join(', ') : '')}${p.whatsapp ? ' · ' + esc(p.whatsapp) : ''}</span></div>
    ${p.vaga ? '<span class="chip warn">Vaga aberta</span>' : ''}${p.situacao && SIT[p.situacao] ? `<span class="chip warn">${SIT[p.situacao]}</span>` : ''}
    ${p.ativo === false ? '<span class="chip mute">Inativo</span>' : ''}
    <button class="btn sm" data-act="edit-staff" data-id="${p.id}">Editar</button></div>`).join('') + `</div></section>`;
  return h;
};

/* ---------- RELATÓRIO ---------- */
function reportRows(mes, base) {
  const adic = (S.config.adicionalFeriado ?? 100) / 100, rows = [];
  Object.values(S.staff).filter(p => p.tipo !== 'fixo').forEach(p => {
    const esc_ = {}, chk = {};
    Object.values(S.extras).forEach(x => { if (x.staffId === p.id && x.data.startsWith(mes)) esc_[x.data] = (esc_[x.data] || 0) + hrs(x.ini, x.fim); });
    Object.values(S.checkins).forEach(c => { if (c.staffId === p.id && c.data.startsWith(mes)) chk[c.data] = c.saida ? hrs(c.entrada, c.saida) : 0; });
    const src = base === 'checkin' ? chk : esc_, dias = Object.keys(src);
    if (!dias.length && !Object.keys(esc_).length && !Object.keys(chk).length) return;
    const fer = dias.filter(d => holidayName(d)).length, horas = dias.reduce((s, d) => s + src[d], 0);
    rows.push({ p, esc: Object.keys(esc_).length, chk: Object.keys(chk).length, dias: dias.length, fer, horas,
      valor: dias.length * (p.diaria || 0) + fer * (p.diaria || 0) * adic });
  });
  return rows.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
}
const relExtras = () => {
  const mes = S.ui.mes, [y, m] = mes.split('-').map(Number), base = S.ui.base, rows = reportRows(mes, base);
  const tot = rows.reduce((t, r) => ({ dias: t.dias + r.dias, fer: t.fer + r.fer, horas: t.horas + r.horas, valor: t.valor + r.valor }), { dias: 0, fer: 0, horas: 0, valor: 0 });
  const fer = Object.entries(holidaysOfYear(y)).filter(([d]) => d.startsWith(mes)).map(([d, n]) => [d, n])
    .concat((S.config.feriadosExtra || []).map(h => [h.anual ? `${y}-${h.data.slice(5)}` : h.data, h.nome]).filter(([d]) => d.startsWith(mes)))
    .sort((a, b) => a[0].localeCompare(b[0]));
  let h = `<div class="bar"><h2>Relatório de extras</h2>${navD('mes', `${MESES[m - 1]} ${y}`)}</div>
    <div class="bar" style="margin-top:0"><div class="seg" role="group" aria-label="Base de contagem">
      <button data-base="escalados" aria-pressed="${base === 'escalados'}">Dias escalados</button>
      <button data-base="checkin" aria-pressed="${base === 'checkin'}">Check-ins feitos</button></div>
      <div class="row"><button class="btn sm" data-act="config">Feriados e adicional</button></div></div>`;
  if (fer.length) h += `<div class="banner feriado">Feriados em ${MESES[m - 1]}: ${fer.map(([d, n]) => `${dm(d)} ${esc(n)}`).join(' · ')}</div>`;
  if (!rows.length) return h + empty('Sem movimento neste mês', 'Quando houver extras escalados ou check-ins, os dias e o valor a receber aparecem aqui.');
  h += `<div class="scroll"><table class="rep"><thead><tr><th>Nome</th><th>Tipo</th><th>Diária</th><th>Escalados</th><th>Check-ins</th><th>Horas</th><th>Em feriado</th><th>A receber</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td><b>${esc(r.p.nome)}</b><div class="hint">${esc(r.p.funcao || '')}</div></td><td>${TIPOS[r.p.tipo]}</td><td>${brl(r.p.diaria)}</td>
      <td>${r.esc}</td><td>${r.chk}</td><td>${r.horas ? fmtH(r.horas) : '–'}</td><td>${r.fer}</td><td><b>${brl(r.valor)}</b></td></tr>`).join('') +
    `</tbody><tfoot><tr><td colspan="3">Total</td><td colspan="2">${tot.dias} dias</td><td>${tot.horas ? fmtH(tot.horas) : '–'}</td><td>${tot.fer}</td><td>${brl(tot.valor)}</td></tr></tfoot></table></div>
    <p class="hint" style="margin-top:10px">Valor = dias × diária + dias em feriado × diária × ${S.config.adicionalFeriado ?? 100}% de adicional. Contagem por ${base === 'checkin' ? 'check-ins feitos' : 'dias escalados'}.</p>`;
  return h;
};

/* ===== Relatório: aba Banco de feriados (feriados trabalhados pelos fixos) ===== */
const holidaysBetween = (a, b) => {
  const out = [];
  for (let d = a; d <= b; d = addDays(d, 1)) { const n = holidayName(d); if (n) out.push([d, n]); }
  return out;
};
const feriadosDesde = () => S.config.feriadosDesde || `${todayISO().slice(0, 4)}-01-01`;

/* Saldo = saldo anterior ao app (campo feriadosIniciais, menos as baixas dadas contra ele)
   + feriados trabalhados a partir da data de início ainda sem baixa. */
function bancoFeriados() {
  const hoje = todayISO(), hol = holidaysBetween(feriadosDesde(), `${hoje.slice(0, 4)}-12-31`), todas = Object.values(S.baixas);
  return fixos().map(p => {
    const itens = [];
    hol.forEach(([d, n]) => {
      const trabalha = !!shiftFor(p, d).ini, b = S.baixas[`${p.id}_${d}`];
      if (!trabalha && !b) return;
      itens.push({ d, n, b, st: b ? b.tipo : (d > hoje ? 'prog' : 'pend') });
    });
    const c = k => itens.filter(i => i.st === k).length, pend = c('pend'), folga = c('folga'), pago = c('pago');
    const ini = p.feriadosIniciais || 0, ant = todas.filter(b => b.staffId === p.id && b.origem === 'saldo').sort((a, b) => (a.em || '').localeCompare(b.em || ''));
    const antRest = Math.max(0, ini - ant.length);
    return { p, itens, ini, ant, antRest, pend, saldo: antRest + pend,
      trab: ini + pend + folga + pago,
      folga: folga + ant.filter(b => b.tipo === 'folga').length, pago: pago + ant.filter(b => b.tipo === 'pago').length,
      valor: itens.filter(i => i.st === 'pago').reduce((s, i) => s + (i.b.valor || 0), 0) + ant.filter(b => b.tipo === 'pago').reduce((s, b) => s + (b.valor || 0), 0) };
  });
}

const STATUS = { pend: ['warn', 'Pendente'], folga: ['ok', 'Folga extra'], pago: ['ok', 'Pago'], prog: ['mute', 'Programado'] };
const baixaDet = b => b.tipo === 'folga' ? `Folga extra em ${dmy(b.dataFolga)}${b.naEscala ? ' (já na escala)' : ''}`
  : `${brl(b.valor)}${b.dataPagamento ? ' em ' + dmy(b.dataPagamento) : ''}`;
function feriadoItem(p, i) {
  const b = i.b, [cls, lbl] = STATUS[i.st];
  const det = i.st === 'pend' ? 'Trabalhou, ainda a compensar' : i.st === 'prog' ? 'Escalado para trabalhar' : baixaDet(b);
  const btn = i.st === 'pend' ? `<button class="btn sm primary" data-act="baixa" data-id="${p.id}" data-d="${i.d}">Dar baixa</button>`
    : (i.st === 'folga' || i.st === 'pago') ? `<button class="btn sm ghost" data-act="baixa-undo" data-id="${p.id}" data-d="${i.d}">Desfazer</button>` : '';
  return `<div class="item"><div class="who"><b>${dm(i.d)} · ${esc(i.n)}</b><span>${det}${b && b.obs ? ' · ' + esc(b.obs) : ''}</span></div>
    <span class="chip ${cls}">${lbl}</span>${btn}</div>`;
}
function saldoItem(p, b) {
  const [cls, lbl] = STATUS[b.tipo];
  return `<div class="item"><div class="who"><b>Saldo anterior · 1 dia</b><span>${baixaDet(b)}${b.obs ? ' · ' + esc(b.obs) : ''}</span></div>
    <span class="chip ${cls}">${lbl}</span><button class="btn sm ghost" data-act="baixa-undo" data-id="${p.id}" data-bid="${b.id}">Desfazer</button></div>`;
}

function relFeriados() {
  const rows = bancoFeriados(), desde = feriadosDesde();
  const tot = rows.reduce((t, r) => ({ pend: t.pend + r.saldo, folga: t.folga + r.folga, pago: t.pago + r.pago, valor: t.valor + r.valor }), { pend: 0, folga: 0, pago: 0, valor: 0 });
  let h = `<div class="bar"><h2>Banco de feriados</h2>
    <div class="f" style="margin:0"><label for="f-desde">Contar feriados novos a partir de</label><input id="f-desde" type="date" value="${desde}"></div></div>
    <p class="hint" style="margin:0 0 12px">O saldo de cada colaborador soma os feriados de antes do app (campo “Feriados acumulados” no cadastro) com os que ele trabalhar a partir da data acima. Dê baixa quando receber uma folga extra ou o pagamento.</p>
    <div class="stats"><div class="stat"><b>${tot.pend}</b><span>A compensar</span></div><div class="stat"><b>${tot.folga}</b><span>Folgas extras dadas</span></div>
    <div class="stat"><b>${tot.pago}</b><span>Feriados pagos</span></div><div class="stat"><b style="font-size:21px">${brl(tot.valor)}</b><span>Total pago</span></div></div>`;
  if (!rows.length) return h + empty('Nenhum colaborador fixo', 'Cadastre os fixos na aba Equipe para acompanhar os feriados trabalhados.');
  h += `<section class="card"><div class="list">` + rows.map(r => `<div class="item"><div class="avatar">${esc(initials(r.p.nome))}</div>
    <div class="who"><b>${esc(r.p.nome)}</b><span>${subStaff(r.p)}</span></div>
    <span class="chip ${r.saldo ? 'warn' : 'ok'}">${r.saldo ? r.saldo + ' a compensar' : 'Em dia'}</span>
    <button class="btn sm" data-act="fer-det" data-id="${r.p.id}">Detalhes</button></div>`).join('') + '</div></section>';
  return h;
}

/* janela com os feriados de um colaborador */
function detalhesFeriados(sid) {
  const r = bancoFeriados().find(x => x.p.id === sid); if (!r) { closeSheet(); return; }
  const ant = (r.ini || r.ant.length) ? `<div class="sect" style="margin-top:12px">Antes do app</div><div class="list">
    <div class="item"><div class="who"><b>${r.antRest} de ${r.ini} ${r.ini === 1 ? 'dia' : 'dias'} a compensar</b><span>Feriados trabalhados antes de usar o app.</span></div>
    ${r.antRest ? `<button class="btn sm primary" data-act="baixa" data-id="${r.p.id}" data-d="">Dar baixa</button>` : '<span class="chip ok">Em dia</span>'}</div>
    ${r.ant.map(b => saldoItem(r.p, b)).join('')}</div>` : '';
  openSheet(`<h3>${esc(r.p.nome)}</h3><p class="hint" style="margin:-6px 0 12px">${subStaff(r.p)}</p>
    <div class="stats mini"><div class="stat"><b>${r.trab}</b><span>Feriados</span></div><div class="stat"><b>${r.folga}</b><span>Folgas</span></div>
    <div class="stat"><b>${r.pago}</b><span>Pagos</span></div><div class="stat"><b>${r.saldo}</b><span>Saldo</span></div></div>
    ${r.pago ? `<p class="hint" style="margin:0 0 6px">Total pago em feriados: <b>${brl(r.valor)}</b></p>` : ''}
    ${ant}
    <div class="sect" style="margin-top:12px">Feriados desde ${dmy(feriadosDesde())}</div>
    <div class="list">${r.itens.length ? r.itens.map(i => feriadoItem(r.p, i)).join('') : '<div class="hint" style="padding:8px 0">Nenhum feriado trabalhado neste período.</div>'}</div>
    <div class="acts"><button class="btn" id="fd-x">Fechar</button></div>`, m => { $('#fd-x', m).onclick = closeSheet; });
}

V.relatorio = () => `<div class="bar" style="margin-bottom:14px"><div class="seg" role="group" aria-label="Tipo de relatório">
  <button data-rel="extras" aria-pressed="${!['feriados', 'faltas'].includes(S.ui.relTab)}">Extras</button>
  <button data-rel="feriados" aria-pressed="${S.ui.relTab === 'feriados'}">Feriados</button>
  <button data-rel="faltas" aria-pressed="${S.ui.relTab === 'faltas'}">Faltas</button></div>
  <button class="btn sm primary" data-act="export">Exportar relatório</button></div>` +
  (S.ui.relTab === 'feriados' ? relFeriados() : S.ui.relTab === 'faltas' ? relFaltas() : relExtras());

/* ---------- dar baixa / desfazer (d = data do feriado; null = contra o saldo anterior) ---------- */
function baixaForm(sid, d) {
  const p = S.staff[sid], hoje = todayISO();
  openSheet(`<h3>Baixa de feriado · ${esc(p.nome)}</h3>
    <div class="banner feriado">${d ? `${dmy(d)} · ${esc(holidayName(d) || 'Feriado')}` : 'Saldo anterior ao app · 1 dia'}</div>
    <div class="f"><span class="l">Como foi compensado</span><div class="opts">
      <label class="opt"><input type="radio" name="bx" value="folga" checked><div><b>Folga extra</b><span>A folga entra na escala especial da data escolhida.</span></div></label>
      <label class="opt"><input type="radio" name="bx" value="pago"><div><b>Pago em dinheiro</b><span>Registra o valor e a data do pagamento.</span></div></label></div></div>
    <div class="f" id="bx-f"><label for="bx-df">Data da folga</label><input id="bx-df" type="date" value="${addDays(hoje, 1)}"></div>
    <div class="f2" id="bx-p" hidden><div class="f"><label for="bx-v">Valor pago (R$)</label><input id="bx-v" type="number" min="0" step="0.01" inputmode="decimal"></div>
      <div class="f"><label for="bx-dp">Data do pagamento</label><input id="bx-dp" type="date" value="${hoje}"></div></div>
    <div class="f"><label for="bx-o">Observação</label><input id="bx-o" placeholder="Opcional"></div>
    <div class="acts"><button class="btn" id="bx-x">Cancelar</button><button class="btn primary" id="bx-ok">Salvar baixa</button></div>`,
  r => {
    const sync = () => { const f = $('input[name=bx]:checked', r).value === 'folga'; $('#bx-f', r).hidden = !f; $('#bx-p', r).hidden = f; };
    $$('input[name=bx]', r).forEach(e => e.onchange = sync);
    $('#bx-x', r).onclick = () => detalhesFeriados(sid);
    $('#bx-ok', r).onclick = () => {
      const tipo = $('input[name=bx]:checked', r).value, o = { staffId: sid, feriado: d || null, origem: d ? 'data' : 'saldo', tipo, obs: val(r, 'bx-o'), em: hoje };
      if (tipo === 'folga') {
        const df = val(r, 'bx-df'); if (!df) { toast('Informe a data da folga.'); return; }
        o.dataFolga = df;
        if (shiftFor(p, df).ini) { writeSpecial(sid, weekStartOf(df), dowMon(df), { folga: true }); o.naEscala = true; }
      } else {
        o.valor = parseFloat(val(r, 'bx-v')) || 0; o.dataPagamento = val(r, 'bx-dp');
        if (!o.valor) { toast('Informe o valor pago.'); return; }
      }
      put('baixas', d ? `${sid}_${d}` : `${sid}_saldo_${uid('')}`, o); detalhesFeriados(sid);
      toast(tipo === 'folga' ? (o.naEscala ? 'Folga extra registrada e colocada na escala.' : 'Folga extra registrada.') : 'Pagamento registrado.');
    };
  });
}
function baixaUndo(sid, d, bid) {
  const key = bid || `${sid}_${d}`, b = S.baixas[key]; if (!b) return;
  if (b.naEscala && b.dataFolga) {      // tira a folga da escala especial, só se ainda for a folga que foi criada aqui
    const ws = weekStartOf(b.dataFolga), k = dowMon(b.dataFolga), sp = S.special[`${ws}_${sid}`], v = sp && sp.dias && sp.dias[k];
    if (v && !v.ini) writeSpecial(sid, ws, k, undefined);
  }
  drop('baixas', key); detalhesFeriados(sid); toast('Baixa desfeita.');
}

/* ===== Escala: visão de fins de semana do mês ===== */
const modeSeg = () => `<div class="seg" role="group" aria-label="Modo">
  <button data-mode="semana" aria-pressed="${S.ui.gridMode === 'semana'}">Semana</button>
  <button data-mode="fds" aria-pressed="${S.ui.gridMode === 'fds'}">Fim de semana</button>
  <button data-mode="geral" aria-pressed="${S.ui.gridMode === 'geral'}">Escala geral</button></div>`;

function fdsDates(mes) {
  const [y, m] = mes.split('-').map(Number), n = new Date(y, m, 0).getDate(), out = [];
  for (let d = 1; d <= n; d++) { const s = `${mes}-${pad(d)}`; if (dowMon(s) >= 5) out.push(s); }
  return out;
}

function escalaFds() {
  const mes = S.ui.fdsMes, [y, m] = mes.split('-').map(Number), ds = fdsDates(mes), fx = fixos();
  let h = `<div class="bar"><h2>Escala dos fixos</h2>${modeSeg()}</div>
    <div class="bar" style="margin-top:0"><div class="row">${navD('fmes', `${MESES[m - 1]} ${y}`)}<button class="btn sm" data-act="hoje-fm">Este mês</button></div>
    <span class="sub">${ds.filter(d => dowMon(d) === 5).length} sábados · ${ds.filter(d => dowMon(d) === 6).length} domingos</span></div>`;
  if (!fx.length) return h + empty('Nenhum colaborador fixo', 'Cadastre os fixos na aba Equipe para montar a escala do fim de semana.');
  h += `<div class="scroll"><table class="grid"><thead><tr><th class="name">Colaborador</th>` + ds.map(d => {
    const f = holidayName(d), k = dowMon(d);
    return `<th class="${f ? 'fer' : 'fds'}" style="${k === 5 ? 'border-left:2px solid var(--surface)' : ''}">${DIAS[k]}<small>${dm(d)}${f ? ' · feriado' : ''}</small></th>`;
  }).join('') + `</tr></thead><tbody>`;
  fx.forEach(p => {
    h += `<tr><td class="name"><b>${esc(p.nome)}</b><span>${subStaff(p)}</span>
      <div><button class="btn sm" style="margin-top:5px" data-act="fds-bulk" data-id="${p.id}">Preencher o mês</button></div></td>`;
    ds.forEach(d => {
      const k = dowMon(d), s = shiftFor(p, d), fer = !!holidayName(d);
      const c = ['cell', s.folga || s.semEscala ? 'folga' : '', fer ? 'fer' : '', 'fdsc'].filter(Boolean).join(' ');
      const tag = s.afastado ? `<span class="tag">${s.afastado.toLowerCase()}</span>` : s.src === 'especial' ? '<span class="tag">especial</span>' : s.fixa ? '<span class="tag">folga fixa</span>' : (fer && s.ini ? '<span class="tag">feriado</span>' : '');
      h += `<td style="${k === 5 ? 'border-left:2px solid var(--line)' : ''}"><button class="${c}" data-act="cell" data-id="${p.id}" data-i="${k}" data-d="${d}">
        ${s.semEscala ? 'Sem escala' : s.afastado ? 'Afastado' : s.folga ? 'Folga' : `${s.ini}<br>${s.fim}`}${tag}</button></td>`;
    });
    h += `</tr>`;
  });
  h += `<tr class="sep"><td class="name" style="background:var(--surface-2)"><b>Fixos trabalhando</b></td>` + ds.map(d => {
    const n = fx.filter(p => shiftFor(p, d).ini).length;
    return `<td style="text-align:center;font-weight:800;padding:8px 4px;background:var(--surface-2);color:${n ? 'var(--accent-2)' : 'var(--ink-2)'}">${n}</td>`;
  }).join('') + `</tr></tbody></table></div>
    <div class="legend"><span><i style="background:var(--fds)"></i>Sábado e domingo</span><span><i style="background:var(--feriado-bg);border:1px solid var(--feriado-ink)"></i>Feriado</span>
    <span><i style="background:var(--off)"></i>Folga</span><span>Toque em um dia para mudar só aquela data.</span></div>`;
  const exs = ds.flatMap(d => extrasOn(d));
  if (exs.length) h += `<div class="sect">Extras nos fins de semana</div><section class="card"><div class="list">${exs.map(x => extraRow(x, 'data')).join('')}</div></section>`;
  return h;
}

/* preencher todos os sábados e domingos do mês para um colaborador */
function fdsBulk(sid) {
  const p = S.staff[sid], mes = S.ui.fdsMes, [y, m] = mes.split('-').map(Number), ds = fdsDates(mes);
  const pd = k => (p.padrao && p.padrao[k]) || null;
  const bloco = (k, nome, pre) => {
    const v = pd(k);
    return `<div class="f"><label for="b${k}-m">${nome}</label><select id="b${k}-m">
      <option value="t" ${v ? 'selected' : ''}>Trabalha</option><option value="f" ${v ? '' : 'selected'}>Folga</option>
      <option value="g">Voltar ao padrão</option><option value="n">Não alterar</option></select></div>
      <div class="f2" id="b${k}-h"><div class="f"><label for="b${k}-i">Entrada</label><input id="b${k}-i" type="time" value="${v ? v.ini : '08:00'}"></div>
      <div class="f"><label for="b${k}-f">Saída</label><input id="b${k}-f" type="time" value="${v ? v.fim : '17:00'}"></div></div>`;
  };
  openSheet(`<h3>${esc(p.nome)} · ${MESES[m - 1]} ${y}</h3>
    <p class="hint" style="margin-top:-6px">Vale para os ${ds.length} dias de fim de semana do mês. Substitui o que já estiver nesses dias. Dias de folga fixa ficam como estão.</p>
    ${bloco(5, 'Todos os sábados')}${bloco(6, 'Todos os domingos')}
    <div class="acts"><button class="btn" id="bk-x">Cancelar</button><button class="btn primary" id="bk-ok">Aplicar ao mês</button></div>`,
  r => {
    [5, 6].forEach(k => {
      const sy = () => { $(`#b${k}-h`, r).hidden = $(`#b${k}-m`, r).value !== 't'; };
      $(`#b${k}-m`, r).onchange = sy; sy();
    });
    $('#bk-x', r).onclick = closeSheet;
    $('#bk-ok', r).onclick = async () => {
      const cfg = {};
      for (const k of [5, 6]) {
        const mo = $(`#b${k}-m`, r).value;
        cfg[k] = mo === 't' ? { ini: val(r, `b${k}-i`), fim: val(r, `b${k}-f`) } : mo === 'f' ? { folga: true } : mo === 'g' ? 'padrao' : null;
        if (mo === 't' && (!cfg[k].ini || !cfg[k].fim)) { toast('Informe entrada e saída.'); return; }
      }
      const semanas = {};
      ds.forEach(d => {
        const k = dowMon(d), v = cfg[k]; if (!v || isFolgaFixa(p, k)) return;
        (semanas[weekStartOf(d)] = semanas[weekStartOf(d)] || {})[k] = v === 'padrao' ? undefined : v;
      });
      closeSheet();
      for (const [ws, mud] of Object.entries(semanas)) {
        const key = `${ws}_${sid}`, cur = S.special[key], dias = Object.assign({}, cur && cur.dias);
        Object.entries(mud).forEach(([k, v]) => { if (v === undefined) delete dias[k]; else dias[k] = v; });
        if (Object.keys(dias).length) await put('special', key, { semana: ws, staffId: sid, dias });
        else if (cur) await drop('special', key);
      }
      toast('Fins de semana do mês atualizados.');
    };
  });
}

/* ===== Relatório: aba Faltas ===== */
const FALTA_TIPOS = {
  injustificada: ['red', 'Injustificada'],
  atestado: ['warn', 'Atestado'],
  justificada: ['ok', 'Justificada']
};

function relFaltas() {
  const mes = S.ui.mes, [y, m] = mes.split('-').map(Number);
  const lista = Object.values(S.faltas).filter(f => f.data && f.data.startsWith(mes) && S.staff[f.staffId])
    .sort((a, b) => a.data.localeCompare(b.data) || S.staff[a.staffId].nome.localeCompare(S.staff[b.staffId].nome, 'pt-BR'));
  const por = {};
  lista.forEach(f => { const r = por[f.staffId] = por[f.staffId] || { p: S.staff[f.staffId], inj: 0, ate: 0, jus: 0, n: 0 }; r.n++; if (f.tipo === 'atestado') r.ate++; else if (f.tipo === 'justificada') r.jus++; else r.inj++; });
  const resumo = Object.values(por).sort((a, b) => b.n - a.n || a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  const cont = t => lista.filter(f => (f.tipo || 'injustificada') === t).length;

  let h = `<div class="bar"><h2>Faltas</h2>${navD('mes', `${MESES[m - 1]} ${y}`)}</div>
    <div class="bar" style="margin-top:0"><span class="sub">Registre a falta de qualquer colaborador: fixo, diarista ou intermitente.</span>
    <button class="btn primary" data-act="add-falta">+ Registrar falta</button></div>
    <div class="stats"><div class="stat"><b>${lista.length}</b><span>Faltas no mês</span></div><div class="stat"><b>${cont('injustificada')}</b><span>Injustificadas</span></div>
    <div class="stat"><b>${cont('atestado')}</b><span>Atestados</span></div><div class="stat"><b>${cont('justificada')}</b><span>Justificadas</span></div></div>`;
  if (!lista.length) return h + empty('Nenhuma falta em ' + MESES[m - 1], 'Use “Registrar falta” para anotar quando alguém faltar. O resumo por colaborador aparece aqui.');

  h += `<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <section class="card"><h3 style="margin-bottom:4px">Por colaborador</h3><div class="list">` + resumo.map(r => `<div class="item"><div class="avatar">${esc(initials(r.p.nome))}</div>
      <div class="who"><b>${esc(r.p.nome)}</b><span>${esc(r.p.funcao || '')} · ${TIPOS[r.p.tipo]}</span></div>
      <div style="text-align:right;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
      ${r.inj ? `<span class="chip red">${r.inj} injust.</span>` : ''}${r.ate ? `<span class="chip warn">${r.ate} atest.</span>` : ''}${r.jus ? `<span class="chip ok">${r.jus} justif.</span>` : ''}</div></div>`).join('') + `</div></section>
    <section class="card"><h3 style="margin-bottom:4px">Registros do mês</h3><div class="list">` + lista.map(f => {
      const t = FALTA_TIPOS[f.tipo] || FALTA_TIPOS.injustificada;
      return `<div class="item"><div class="who"><b>${esc(S.staff[f.staffId].nome)}</b><span>${DIAS[dowMon(f.data)]} ${dm(f.data)}${f.obs ? ' · ' + esc(f.obs) : ''}</span></div>
        <span class="chip ${t[0]}">${t[1]}</span><button class="btn sm ghost" data-act="edit-falta" data-id="${f.id}" aria-label="Editar">✎</button></div>`;
    }).join('') + `</div></section></div>`;
  return h;
}

function faltaForm(id) {
  const lst = Object.values(S.staff).filter(p => p.ativo !== false && !p.vaga).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!lst.length) { toast('Cadastre os colaboradores na aba Equipe primeiro.'); return; }
  const hoje = todayISO(), mes = S.ui.mes;
  const f = id ? S.faltas[id] : { staffId: lst[0].id, data: hoje.startsWith(mes) ? hoje : `${mes}-01`, tipo: 'injustificada' };
  openSheet(`<h3>${id ? 'Editar falta' : 'Registrar falta'}</h3>
    <div class="f"><label for="fl-p">Colaborador</label><select id="fl-p">${lst.map(p => `<option value="${p.id}" ${p.id === f.staffId ? 'selected' : ''}>${esc(p.nome)} · ${TIPOS[p.tipo]}${p.funcao ? ' · ' + esc(p.funcao) : ''}</option>`).join('')}</select></div>
    <div class="f"><label for="fl-d">Data da falta</label><input id="fl-d" type="date" value="${f.data}"></div>
    <div class="f"><span class="l">Tipo</span><div class="opts">
      ${Object.entries(FALTA_TIPOS).map(([k, v]) => `<label class="opt"><input type="radio" name="fl-t" value="${k}" ${(f.tipo || 'injustificada') === k ? 'checked' : ''}><div><b>${v[1]}</b><span>${k === 'injustificada' ? 'Faltou sem aviso ou sem justificativa.' : k === 'atestado' ? 'Apresentou atestado.' : 'Avisou e foi aceito pela gestão.'}</span></div></label>`).join('')}</div></div>
    <div class="f"><label for="fl-o">Observação</label><input id="fl-o" value="${esc(f.obs || '')}" placeholder="Opcional"></div>
    <div id="fl-info"></div>
    <div class="acts">${id ? '<button class="btn danger sp" id="fl-del">Excluir</button>' : ''}<button class="btn" id="fl-x">Cancelar</button><button class="btn primary" id="fl-ok">Salvar</button></div>`,
  r => {
    const info = () => {
      const d = $('#fl-d', r).value, p = S.staff[$('#fl-p', r).value];
      let msg = '';
      if (d && p) {
        if (p.tipo === 'fixo') { const s = shiftFor(p, d); msg = s.ini ? '' : `<div class="banner especial">${esc(p.nome.split(' ')[0])} não estava escalado neste dia (${s.fixa ? 'folga fixa' : 'folga'}).</div>`; }
        else { const e = extrasOn(d).some(x => x.staffId === p.id); msg = e ? '' : `<div class="banner especial">${esc(p.nome.split(' ')[0])} não estava escalado como extra neste dia.</div>`; }
      }
      $('#fl-info', r).innerHTML = msg;
    };
    $('#fl-d', r).onchange = info; $('#fl-p', r).onchange = info; info();
    $('#fl-x', r).onclick = closeSheet;
    $('#fl-ok', r).onclick = () => {
      const o = { staffId: val(r, 'fl-p'), data: val(r, 'fl-d'), tipo: $('input[name=fl-t]:checked', r).value, obs: val(r, 'fl-o') };
      if (!o.data) { toast('Informe a data da falta.'); return; }
      const nid = `${o.staffId}_${o.data}`;
      if (nid !== id && S.faltas[nid]) { toast('Já existe uma falta registrada para essa pessoa nesse dia. Edite o registro existente.'); return; }
      if (id && id !== nid) drop('faltas', id);
      put('faltas', nid, o); closeSheet(); toast('Falta registrada.');
    };
    const del = $('#fl-del', r);
    if (del) del.onclick = () => { drop('faltas', id); closeSheet(); toast('Falta excluída.'); };
  });
}

/* ===== Relatório: exportar com filtros (período, vínculo e o que incluir) ===== */
const monthBounds = mes => { const [y, m] = mes.split('-').map(Number); return [`${mes}-01`, iso(new Date(y, m, 0))]; };

/* Monta as colunas e as linhas do relatório conforme os filtros.
   o = { de, ate, tipos: ['fixo', ...], dias, fer, falt, base: 'escalados' | 'checkin' } */
function buildExport(o) {
  const hoje = todayISO(), adic = (S.config.adicionalFeriado ?? 100) / 100, ordemTipo = ['fixo', 'diarista', 'intermitente'];
  const faltasDe = {};
  Object.values(S.faltas).forEach(f => { if (f.data >= o.de && f.data <= o.ate && S.staff[f.staffId]) (faltasDe[f.staffId] = faltasDe[f.staffId] || []).push(f); });
  const banco = {}; if (o.fer) bancoFeriados().forEach(r => { banco[r.p.id] = r.saldo; });
  const recs = [];
  Object.values(S.staff).filter(p => !p.vaga && o.tipos.includes(p.tipo))
    .sort((a, b) => ordemTipo.indexOf(a.tipo) - ordemTipo.indexOf(b.tipo) || byOrdem(a, b)).forEach(p => {
      const fl = (faltasDe[p.id] || []).slice().sort((a, b) => a.data.localeCompare(b.data)), faltaDias = new Set(fl.map(f => f.data));
      let dias = [], horas = 0;
      if (p.tipo === 'fixo') {                                    // dias de escala até hoje, sem os dias de falta
        const fim = o.ate < hoje ? o.ate : hoje;
        for (let d = o.de; d <= fim; d = addDays(d, 1)) { const s = shiftFor(p, d); if (s.ini && !faltaDias.has(d)) { dias.push(d); horas += hrs(s.ini, s.fim); } }
      } else if (o.base === 'checkin') {                          // check-ins feitos
        Object.values(S.checkins).filter(c => c.staffId === p.id && c.data >= o.de && c.data <= o.ate)
          .forEach(c => { dias.push(c.data); horas += c.saida ? hrs(c.entrada, c.saida) : 0; });
      } else {                                                    // dias escalados, sem os dias de falta
        const m = {};
        Object.values(S.extras).filter(x => x.staffId === p.id && x.data >= o.de && x.data <= o.ate && !faltaDias.has(x.data))
          .forEach(x => { m[x.data] = (m[x.data] || 0) + hrs(x.ini, x.fim); });
        Object.keys(m).forEach(d => { dias.push(d); horas += m[d]; });
      }
      dias.sort();
      const fer = dias.filter(d => holidayName(d)), diaria = p.diaria || 0;
      const cnt = t => fl.filter(f => (f.tipo || 'injustificada') === t).length;
      const ativo = p.ativo !== false || dias.length || fl.length;
      if (!ativo) return;
      recs.push({ p, dias, horas, fer, fl, inj: cnt('injustificada'), ate: cnt('atestado'), jus: cnt('justificada'),
        valor: p.tipo === 'fixo' ? 0 : dias.length * diaria + fer.length * diaria * adic, saldo: p.tipo === 'fixo' ? banco[p.id] : undefined });
    });

  const cols = [
    { h: 'Nome', f: r => r.p.nome }, { h: 'Setor', f: r => r.p.setor || '' }, { h: 'Função', f: r => r.p.funcao || '' }, { h: 'Vínculo', f: r => TIPOS[r.p.tipo] }];
  if (o.dias) cols.push({ h: 'Dias trabalhados', num: 1, f: r => r.dias.length }, { h: 'Horas', num: 1, f: r => r.horas });
  if (o.fer) cols.push({ h: 'Feriados trabalhados', num: 1, f: r => r.fer.length },
    { h: 'Datas dos feriados', f: r => r.fer.map(d => `${dm(d)} ${holidayName(d)}`).join(', ') },
    { h: 'Saldo atual do banco de feriados', num: 1, f: r => r.saldo });
  if (o.falt) cols.push({ h: 'Faltas', num: 1, f: r => r.fl.length }, { h: 'Injustificadas', num: 1, f: r => r.inj },
    { h: 'Atestados', num: 1, f: r => r.ate }, { h: 'Justificadas', num: 1, f: r => r.jus },
    { h: 'Datas das faltas', f: r => r.fl.map(f => dm(f.data)).join(', ') });
  if (o.dias && recs.some(r => r.p.tipo !== 'fixo')) cols.push({ h: 'Diária', f: r => r.p.tipo === 'fixo' ? undefined : (r.p.diaria || 0) },
    { h: 'A receber', num: 1, f: r => r.p.tipo === 'fixo' ? undefined : r.valor });
  return { cols, recs };
}

const exNum = v => typeof v !== 'number' ? (v ?? '') : String(Number.isInteger(v) ? v : v.toFixed(2)).replace('.', ',');

function exportLinhas(o) {
  const { cols, recs } = buildExport(o);
  const linhas = recs.map(r => cols.map(c => exNum(c.f(r))));
  const tot = cols.map((c, i) => i === 0 ? 'TOTAL' : c.num ? exNum(recs.reduce((s, r) => s + (+c.f(r) || 0), 0)) : '');
  return { head: cols.map(c => c.h), linhas, tot, recs };
}

function exportForm() {
  const [de0, ate0] = monthBounds(S.ui.mes);
  const chk = (id, tit, sub, on = true) => `<label class="opt"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><div><b>${tit}</b><span>${sub}</span></div></label>`;
  openSheet(`<h3>Exportar relatório</h3>
    <div class="f2"><div class="f"><label for="ex-de">Data inicial</label><input id="ex-de" type="date" value="${de0}"></div>
    <div class="f"><label for="ex-ate">Data final</label><input id="ex-ate" type="date" value="${ate0}"></div></div>
    <div class="f"><span class="l">Vínculo</span><div class="opts">
      ${['fixo', 'diarista', 'intermitente'].map(k => `<label class="opt"><input type="checkbox" name="ex-t" value="${k}" checked><div><b>${TIPOS[k]}</b></div></label>`).join('')}</div></div>
    <div class="f"><span class="l">Incluir no relatório</span><div class="opts">
      ${chk('ex-dias', 'Dias trabalhados', 'Dias e horas. Nos diaristas e intermitentes, também a diária e o valor a receber.')}
      ${chk('ex-fer', 'Feriados', 'Feriados trabalhados no período e saldo atual do banco de feriados.')}
      ${chk('ex-falt', 'Faltas', 'Quantidade por tipo e as datas.')}</div></div>
    <div class="f" id="ex-base-f"><span class="l">Diaristas e intermitentes: contar por</span><div class="opts">
      <label class="opt"><input type="radio" name="ex-b" value="escalados" ${S.ui.base !== 'checkin' ? 'checked' : ''}><div><b>Dias escalados</b></div></label>
      <label class="opt"><input type="radio" name="ex-b" value="checkin" ${S.ui.base === 'checkin' ? 'checked' : ''}><div><b>Check-ins feitos</b></div></label></div></div>
    <div id="ex-res" class="banner especial"></div>
    <p class="hint">Fixos: contam os dias de escala até hoje. Dias com falta registrada não contam como trabalhados.</p>
    <div class="acts"><button class="btn" id="ex-x">Cancelar</button><button class="btn primary" id="ex-ok">Baixar CSV</button></div>`,
  r => {
    const ler = () => ({ de: $('#ex-de', r).value, ate: $('#ex-ate', r).value, tipos: $$('input[name=ex-t]:checked', r).map(i => i.value),
      dias: $('#ex-dias', r).checked, fer: $('#ex-fer', r).checked, falt: $('#ex-falt', r).checked, base: $('input[name=ex-b]:checked', r).value });
    const erro = o => !o.de || !o.ate ? 'Informe a data inicial e a final.' : o.de > o.ate ? 'A data inicial é depois da final.'
      : (parse(o.ate) - parse(o.de)) / 864e5 > 400 ? 'Escolha um período de até 400 dias.' : !o.tipos.length ? 'Marque pelo menos um vínculo.'
      : !(o.dias || o.fer || o.falt) ? 'Marque pelo menos uma opção para incluir.' : '';
    const resumo = () => {
      const o = ler(), e = erro(o), box = $('#ex-res', r); $('#ex-ok', r).disabled = !!e;
      $('#ex-base-f', r).hidden = !o.tipos.some(t => t !== 'fixo');
      if (e) { box.textContent = e; return; }
      const { recs } = buildExport(o), soma = f => recs.reduce((s, x) => s + f(x), 0);
      box.textContent = `${recs.length} ${recs.length === 1 ? 'pessoa' : 'pessoas'}` + (o.dias ? ` · ${soma(x => x.dias.length)} ${soma(x => x.dias.length) === 1 ? 'dia trabalhado' : 'dias trabalhados'}` : '') + (o.fer ? ` · ${soma(x => x.fer.length)} em feriado` : '')
        + (o.falt ? ` · ${soma(x => x.fl.length)} faltas` : '') + (o.dias && recs.some(x => x.p.tipo !== 'fixo') ? ` · ${brl(soma(x => x.valor))} a receber` : '');
    };
    $$('input', r).forEach(i => i.onchange = resumo);
    $('#ex-x', r).onclick = closeSheet;
    $('#ex-ok', r).onclick = async () => {
      const o = ler(); if (erro(o)) return;
      const { head, linhas, tot } = exportLinhas(o);
      const csv = '﻿' + [head].concat(linhas, [tot]).map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      let dl = null; try { dl = await claude.use('downloads'); } catch (e) { }
      if (!dl) { toast('O download não está disponível nesta visualização.'); return; }
      try { await dl.save({ filename: `relatorio-${o.de}-a-${o.ate}.csv`, data: csv }); closeSheet(); toast('Relatório baixado.'); } catch (e) { toast('Download cancelado.'); }
    };
    resumo();
  });
}


/* ===== Formulários: colaborador, horário, extras, configuração ===== */
const val = (r, id) => { const e = $('#' + id, r); return e ? e.value.trim() : ''; };
const tipoOpts = t => Object.entries(TIPOS).map(([k, l]) => `<option value="${k}" ${t === k ? 'selected' : ''}>${l}</option>`).join('');

/* ---------- colaborador ---------- */
function staffForm(id) {
  const p = id ? S.staff[id] : { tipo: ['fixo', 'diarista', 'intermitente'].includes(S.ui.fEquipe) ? S.ui.fEquipe : 'fixo', ativo: true, vaga: S.ui.fEquipe === 'vaga' };
  openSheet(`<h3>${id ? 'Editar colaborador' : 'Novo colaborador'}</h3>
    <div class="f"><label for="s-nome">Nome</label><input id="s-nome" value="${esc(p.nome || '')}" autocomplete="off"></div>
    <div class="f2"><div class="f"><label for="s-set">Setor</label><input id="s-set" value="${esc(p.setor || '')}" placeholder="Ex.: Fogão 1"></div>
    <div class="f"><label for="s-func">Função</label><input id="s-func" value="${esc(p.funcao || '')}" placeholder="Ex.: Cozinheiro"></div></div>
    <div class="f"><label for="s-tipo">Vínculo</label><select id="s-tipo">${tipoOpts(p.tipo)}</select></div>
    <label class="opt" id="g-vaga" style="margin-bottom:12px"><input type="checkbox" id="s-vaga" ${p.vaga ? 'checked' : ''}><div><b>Vaga em aberto (a contratar)</b><span>Fica na lista da equipe, fora da escala, até você cadastrar a pessoa.</span></div></label>
    <div class="f2" id="g-sit"><div class="f"><label for="s-sit">Situação</label><select id="s-sit"><option value="">Trabalhando</option>
      <option value="licenca" ${p.situacao === 'licenca' ? 'selected' : ''}>Licença médica</option><option value="ferias" ${p.situacao === 'ferias' ? 'selected' : ''}>Férias</option></select></div>
    <div class="f"><label for="s-volta">Afastado até (opcional)</label><input id="s-volta" type="date" value="${p.afastadoAte || ''}"></div></div>
    <div class="f" id="g-diaria"><label for="s-diaria">Valor da diária (R$)</label><input id="s-diaria" type="number" min="0" step="0.01" inputmode="decimal" value="${p.diaria ?? ''}"></div>
    <div class="f" id="g-folga"><span class="l">Folga fixa (toda semana)</span>
      <div class="dias">${DIAS.map((n, i) => `<label class="dia"><input type="checkbox" value="${i}" aria-label="${DIAS_L[i]}" ${(p.folgaFixa || []).includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      <span class="hint">Marque os dias em que a pessoa sempre folga. A escala deixa esses dias como folga em todas as semanas e meses.</span></div>
    <div class="f" id="g-fin"><label for="s-fin">Feriados acumulados (saldo anterior)</label><input id="s-fin" type="number" min="0" step="1" inputmode="numeric" value="${p.feriadosIniciais ?? ''}" placeholder="0">
      <span class="hint">Dias de feriado que a pessoa tem direito de antes de usar o app, ainda sem folga nem pagamento. As baixas são feitas em Relatório, Feriados.</span></div>
    <div class="f"><label for="s-wa">WhatsApp (com DDD)</label><input id="s-wa" type="tel" inputmode="tel" value="${esc(p.whatsapp || '')}" placeholder="85 99999-0000"></div>
    <div class="f" id="g-pin"><label for="s-pin">Código para check-in (4 dígitos)</label><input id="s-pin" inputmode="numeric" maxlength="4" value="${esc(p.pin || '')}" placeholder="Opcional">
      <span class="hint">O diarista digita este código ao registrar o ponto. Serve para evitar engano, não é uma senha segura.</span></div>
    <label class="opt" style="margin-bottom:12px"><input type="checkbox" id="s-ativo" ${p.ativo === false ? '' : 'checked'}><div><b>Ativo</b><span>Desmarque para tirar da escala sem apagar o histórico.</span></div></label>
    <div class="acts">${id ? '<button class="btn danger sp" id="s-del">Excluir</button>' : ''}<button class="btn" id="s-x">Cancelar</button><button class="btn primary" id="s-ok">Salvar</button></div>`,
  r => {
    const sync = () => { const t = $('#s-tipo', r).value; $('#g-diaria', r).hidden = t === 'fixo'; $('#g-pin', r).hidden = t === 'fixo'; $('#g-folga', r).hidden = t !== 'fixo'; $('#g-vaga', r).hidden = t !== 'fixo'; $('#g-sit', r).hidden = t !== 'fixo'; $('#g-fin', r).hidden = t !== 'fixo'; };
    $('#s-tipo', r).onchange = sync; sync();
    $('#s-x', r).onclick = closeSheet;
    $('#s-ok', r).onclick = () => {
      const tipo = val(r, 's-tipo'), vaga = tipo === 'fixo' && $('#s-vaga', r).checked, nome = val(r, 's-nome') || (vaga ? 'A contratar' : '');
      if (!nome) { toast('Informe o nome.'); return; }
      const o = Object.assign({}, p, { nome, setor: val(r, 's-set'), funcao: val(r, 's-func'), tipo, vaga, whatsapp: val(r, 's-wa'),
        feriadosIniciais: tipo === 'fixo' ? Math.max(0, parseInt(val(r, 's-fin'), 10) || 0) : 0,
        situacao: tipo === 'fixo' ? val(r, 's-sit') : '', afastadoAte: tipo === 'fixo' && val(r, 's-sit') ? val(r, 's-volta') : '',
        ativo: $('#s-ativo', r).checked, folgaFixa: tipo === 'fixo' ? $$('#g-folga input:checked', r).map(e => +e.value) : [], diaria: tipo === 'fixo' ? null : parseFloat(val(r, 's-diaria')) || 0, pin: tipo === 'fixo' ? '' : val(r, 's-pin').replace(/\D/g, '') });
      if (tipo === 'fixo' && !o.padrao) o.padrao = { 0: { ini: '08:00', fim: '17:00' }, 1: { ini: '08:00', fim: '17:00' }, 2: { ini: '08:00', fim: '17:00' },
        3: { ini: '08:00', fim: '17:00' }, 4: { ini: '08:00', fim: '17:00' }, 5: null, 6: null };
      put('staff', id || uid('p_'), o); closeSheet(); toast('Colaborador salvo.');
    };
    const del = $('#s-del', r);
    if (del) del.onclick = () => {
      del.outerHTML = '<button class="btn danger sp" id="s-del2">Confirmar exclusão</button>';
      $('#s-del2', r).onclick = () => { drop('staff', id); closeSheet(); toast('Colaborador excluído.'); };
    };
  });
}

/* ---------- horário de um dia (fixos) ---------- */
function cellForm(id, i, d) {
  const p = S.staff[id], base = S.ui.gridMode === 'geral', ws = base ? S.ui.week : weekStartOf(d), fixa = isFolgaFixa(p, i), todo = i < 5 ? 'toda' : 'todo';
  if (!base) {                 // afastamento vale sobre qualquer escala; muda-se no cadastro
    const sx = shiftFor(p, d);
    if (sx.afastado) {
      openSheet(`<h3>${esc(p.nome)} · ${fmtLongDate(d)}</h3><div class="banner especial">${esc(sx.afastado)}${p.afastadoAte ? ' até ' + dmy(p.afastadoAte) : ', sem data de volta'}.</div>
        <p class="hint">Enquanto estiver afastado, o colaborador fica fora da escala. Para mudar, edite a situação em Equipe.</p><div class="acts"><button class="btn" id="c-x">Fechar</button></div>`,
      r => { $('#c-x', r).onclick = closeSheet; });
      return;
    }
  }
  if (base && fixa) {          // folga fixa só se altera aqui para ser removida
    openSheet(`<h3>${esc(p.nome)} · ${DIAS_L[i]}</h3>
      <div class="banner especial">Folga fixa ${todo} ${DIAS_L[i].toLowerCase()}. Todas as semanas e meses saem como folga.</div>
      <p class="hint">Para mudar só uma semana, use a aba “Semana” e toque no dia. Para trabalhar sempre neste dia, remova a folga fixa.</p>
      <div class="acts"><button class="btn danger sp" id="c-rmf">Remover folga fixa</button><button class="btn" id="c-x">Fechar</button></div>`,
    r => {
      $('#c-x', r).onclick = closeSheet;
      $('#c-rmf', r).onclick = () => { put('staff', id, Object.assign({}, p, { folgaFixa: p.folgaFixa.filter(k => k !== i) })); closeSheet(); toast('Folga fixa removida.'); };
    });
    return;
  }
  const cur = base ? (() => { const v = p.padrao && p.padrao[i]; return v ? { ini: v.ini, fim: v.fim } : { folga: true }; })() : shiftFor(p, d);
  const trab = !!cur.ini, fer = !base && holidayName(d), sp = S.special[`${ws}_${id}`];
  const temEsp = !base && sp && sp.dias && Object.prototype.hasOwnProperty.call(sp.dias, String(i));
  openSheet(`<h3>${esc(p.nome)} · ${base ? DIAS_L[i] : fmtLongDate(d)}</h3>${fer ? `<div class="banner feriado">Feriado: ${esc(fer)}</div>` : ''}
    <div class="opts" style="margin-bottom:12px"><label class="opt"><input type="radio" name="sit" value="t" ${trab ? 'checked' : ''}><div><b>Trabalha</b></div></label>
    <label class="opt"><input type="radio" name="sit" value="f" ${trab ? '' : 'checked'}><div><b>Folga</b></div></label></div>
    <div class="f2" id="g-h"><div class="f"><label for="c-ini">Entrada</label><input id="c-ini" type="time" value="${cur.ini || '08:00'}"></div>
    <div class="f"><label for="c-fim">Saída</label><input id="c-fim" type="time" value="${cur.fim || '17:00'}"></div></div>
    ${fixa ? `<div class="banner especial">Folga fixa ${todo} ${DIAS_L[i].toLowerCase()}. Aqui você muda só este dia.</div>` : ''}
    ${base ? '' : `<div class="f"><span class="l">Aplicar em</span><div class="opts">
      <label class="opt"><input type="radio" name="esc" value="e" checked><div><b>Só este dia</b><span>Escala especial. A escala geral continua igual.</span></div></label>
      ${fixa ? '' : `<label class="opt"><input type="radio" name="esc" value="g"><div><b>Escala geral</b><span>Vale para todas as semanas (${DIAS_L[i].toLowerCase()}).</span></div></label>`}</div></div>`}
    <div class="acts">${temEsp ? '<button class="btn sp" id="c-rm">Remover alteração</button>' : ''}<button class="btn" id="c-x">Cancelar</button><button class="btn primary" id="c-ok">Salvar</button></div>`,
  r => {
    const sync = () => { $('#g-h', r).hidden = $('input[name=sit]:checked', r).value === 'f'; };
    $$('input[name=sit]', r).forEach(e => e.onchange = sync); sync();
    $('#c-x', r).onclick = closeSheet;
    const rm = $('#c-rm', r);
    if (rm) rm.onclick = () => { writeSpecial(id, ws, i, undefined); closeSheet(); toast('Alteração removida.'); };
    $('#c-ok', r).onclick = () => {
      const t = $('input[name=sit]:checked', r).value === 't', v = t ? { ini: val(r, 'c-ini'), fim: val(r, 'c-fim') } : null;
      if (t && (!v.ini || !v.fim)) { toast('Informe entrada e saída.'); return; }
      const escopo = base ? 'g' : $('input[name=esc]:checked', r).value;
      if (escopo === 'e') writeSpecial(id, ws, i, v || { folga: true });
      else {
        const padrao = Object.assign({}, p.padrao || {}); padrao[i] = v;
        put('staff', id, Object.assign({}, p, { padrao }));
        if (temEsp) writeSpecial(id, ws, i, undefined);
      }
      closeSheet(); toast(escopo === 'e' ? 'Escala especial salva para este dia.' : 'Escala geral atualizada.');
    };
  });
}
function writeSpecial(sid, ws, i, v) {      // v undefined = remove o dia da escala especial
  const key = `${ws}_${sid}`, cur = S.special[key], dias = Object.assign({}, cur && cur.dias);
  if (v === undefined) delete dias[i]; else dias[i] = v;
  if (!Object.keys(dias).length) { if (cur) drop('special', key); return; }
  put('special', key, { semana: ws, staffId: sid, dias });
}

/* ---------- extras ---------- */
function extraForm(id, date) {
  const lst = extrasStaff();
  if (!lst.length) { toast('Cadastre um diarista ou intermitente primeiro.'); return; }
  const x = id ? S.extras[id] : { data: date || todayISO(), staffId: lst[0].id, ini: '08:00', fim: '17:00' };
  const quem = `<div class="f"><label for="x-p">Quem</label><select id="x-p">${lst.map(p => `<option value="${p.id}" ${p.id === x.staffId ? 'selected' : ''}>${esc(p.nome)} · ${TIPOS[p.tipo]}${p.funcao ? ' · ' + esc(p.funcao) : ''}</option>`).join('')}</select></div>`;
  const horas = `<div class="f2"><div class="f"><label for="x-i">Entrada</label><input id="x-i" type="time" value="${x.ini}"></div>
    <div class="f"><label for="x-f">Saída</label><input id="x-f" type="time" value="${x.fim}"></div></div>
    <div class="f"><label for="x-o">Observação</label><input id="x-o" value="${esc(x.obs || '')}" placeholder="Ex.: evento, cobrir folga"></div>`;

  /* ----- editar um extra já escalado: um dia só ----- */
  if (id) {
    openSheet(`<h3>Editar extra</h3>${quem}
      <div class="f"><label for="x-d">Data</label><input id="x-d" type="date" value="${x.data}"></div>${horas}
      <div class="f2"><div class="f"><label for="x-pg">Pagamento</label><select id="x-pg"><option value="">A pagar</option><option value="agendado" ${x.pg && x.pg.st === 'agendado' ? 'selected' : ''}>Agendado</option><option value="pago" ${x.pg && x.pg.st === 'pago' ? 'selected' : ''}>Pago</option></select></div>
      <div class="f" id="x-pgf" hidden><label for="x-pgd" id="x-pgl">Data</label><input id="x-pgd" type="date" value="${(x.pg && x.pg.data) || todayISO()}"></div></div>
      <div id="x-fer"></div>
      <div class="acts"><button class="btn danger sp" id="x-del">Excluir</button><button class="btn" id="x-x">Cancelar</button><button class="btn primary" id="x-ok">Salvar</button></div>`,
    r => {
      const fer = () => { const n = holidayName($('#x-d', r).value); $('#x-fer', r).innerHTML = n ? `<div class="banner feriado">Feriado: ${esc(n)}. O adicional de feriado entra no relatório.</div>` : ''; };
      $('#x-d', r).onchange = fer; fer();
      const pgsync = () => { const v = $('#x-pg', r).value; $('#x-pgf', r).hidden = !v; $('#x-pgl', r).textContent = v === 'pago' ? 'Pago em' : 'Pagar no dia'; };
      $('#x-pg', r).onchange = pgsync; pgsync();
      $('#x-x', r).onclick = closeSheet;
      $('#x-ok', r).onclick = () => {
        const o = Object.assign({}, x, { staffId: val(r, 'x-p'), data: val(r, 'x-d'), ini: val(r, 'x-i'), fim: val(r, 'x-f'), obs: val(r, 'x-o') });
        if (!o.data || !o.ini || !o.fim) { toast('Preencha data e horários.'); return; }
        const pg = $('#x-pg', r).value, pgd = $('#x-pgd', r).value; delete o.pg;
        if (pg && !pgd) { toast('Informe a data do pagamento.'); return; }
        if (pg === 'pago') o.pg = { st: 'pago', data: pgd, valor: valorDia(o) }; else if (pg === 'agendado') o.pg = { st: 'agendado', data: pgd };
        put('extras', id, o); closeSheet(); toast('Extra salvo.');
      };
      $('#x-del', r).onclick = () => { drop('extras', id); closeSheet(); toast('Extra excluído.'); };
    });
    return;
  }

  /* ----- escalar: marca os dias da semana; o ponto é feito no dia, pelo check-in ----- */
  const quemMulti = `<div class="f"><label>Quem <small style="font-weight:500;color:var(--ink-2)">(marque uma ou mais pessoas)</small></label>
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="hint" id="x-np" style="margin:0"></span><button class="btn sm" type="button" id="x-all">Marcar todos</button></div>
    <div class="opts" id="x-ps" style="max-height:230px;overflow:auto">${lst.map(p => `<label class="opt"><input type="checkbox" value="${p.id}"><div><b>${esc(p.nome)}</b><span>${TIPOS[p.tipo]}${p.funcao ? ' · ' + esc(p.funcao) : ''}</span></div></label>`).join('')}</div></div>`;
  let ws = weekStartOf(x.data);
  const sel = new Set([dowMon(x.data)]);
  const jaTem = (sid, d) => Object.values(S.extras).some(e => e.staffId === sid && e.data === d);
  openSheet(`<h3>Escalar extra</h3>${quemMulti}
    <div class="f"><label>Dias da semana</label>
      <div class="row" style="justify-content:space-between;margin-bottom:8px"><button class="btn sm" type="button" id="x-prev" aria-label="Semana anterior">‹</button><b id="x-sem"></b><button class="btn sm" type="button" id="x-next" aria-label="Próxima semana">›</button></div>
      <div class="dias" id="x-dias"></div>
      <span class="hint">Marque os dias em que as pessoas vão trabalhar. No dia, é só fazer o check-in. Dias em que todas as marcadas já estão escaladas aparecem travados; quem já tem o dia não é duplicado.</span></div>
    <label class="opt" style="margin-bottom:12px"><input type="checkbox" id="x-rep"><div><b>Repetir nas semanas seguintes do mês</b><span>Escala os mesmos dias da semana até o fim do mês.</span></div></label>
    ${horas}
    <div id="x-fer"></div>
    <div class="acts"><button class="btn" id="x-x">Cancelar</button><button class="btn primary" id="x-ok">Escalar</button></div>`,
  r => {
    const sids = () => $$('#x-ps input:checked', r).map(c => c.value);
    const pares = () => {            // todas as escalas que serão criadas: [pessoa, data]
      const out = [], rep = $('#x-rep', r).checked;
      sids().forEach(sid => [...sel].forEach(i => {
        let d = addDays(ws, i); const mes = d.slice(0, 7);
        do { if (!jaTem(sid, d)) out.push([sid, d]); d = addDays(d, 7); } while (rep && d.startsWith(mes));
      }));
      return out;
    };
    const resumo = () => {
      const ps = sids(), pr = pares(), ds = [...new Set(pr.map(q => q[1]))].sort(), fer = ds.filter(d => holidayName(d));
      $('#x-np', r).textContent = ps.length ? `${ps.length} ${ps.length > 1 ? 'pessoas marcadas' : 'pessoa marcada'}` : 'Nenhuma pessoa marcada';
      $('#x-all', r).textContent = ps.length === lst.length ? 'Limpar' : 'Marcar todos';
      $('#x-ok', r).textContent = !pr.length ? 'Escalar' : (ps.length > 1 ? `Escalar ${ps.length} pessoas · ${ds.length} ${ds.length > 1 ? 'dias' : 'dia'}` : `Escalar ${ds.length} ${ds.length > 1 ? 'dias' : 'dia'}`);
      $('#x-fer', r).innerHTML = fer.length ? `<div class="banner feriado">Feriado em ${fer.map(d => `${dm(d)} (${esc(holidayName(d))})`).join(', ')}. O adicional de feriado entra no relatório.</div>` : '';
    };
    const chips = () => {
      $('#x-sem', r).textContent = `${dm(ws)} a ${dm(addDays(ws, 6))}`;
      const ps = sids();
      $('#x-dias', r).innerHTML = DIAS.map((n, i) => {
        const d = addDays(ws, i), ja = ps.length > 0 && ps.every(q => jaTem(q, d)), parc = !ja && ps.some(q => jaTem(q, d)), fer = holidayName(d);
        return `<label class="dia ${ja ? 'ja' : ''} ${fer ? 'fer' : ''}" title="${ja ? 'Já escalado' : (parc ? 'Algumas pessoas marcadas já estão escaladas neste dia' : (fer ? esc(fer) : DIAS_L[i]))}"><input type="checkbox" value="${i}" aria-label="${DIAS_L[i]} ${dm(d)}" ${ja || sel.has(i) ? 'checked' : ''} ${ja ? 'disabled' : ''}><span>${n}<small>${dm(d)}</small></span></label>`;
      }).join('');
      $$('#x-dias input', r).forEach(c => c.onchange = () => { c.checked ? sel.add(+c.value) : sel.delete(+c.value); resumo(); });
      resumo();
    };
    $$('#x-ps input', r).forEach(c => c.onchange = chips);
    $('#x-all', r).onclick = () => { const todos = sids().length === lst.length; $$('#x-ps input', r).forEach(c => { c.checked = !todos; }); chips(); };
    $('#x-rep', r).onchange = resumo;
    $('#x-prev', r).onclick = () => { ws = addDays(ws, -7); chips(); };
    $('#x-next', r).onclick = () => { ws = addDays(ws, 7); chips(); };
    $('#x-x', r).onclick = closeSheet;
    $('#x-ok', r).onclick = async () => {
      const ini = val(r, 'x-i'), fim = val(r, 'x-f'), obs = val(r, 'x-o'), ps = sids(), pr = pares();
      if (!ps.length) { toast('Marque pelo menos uma pessoa.'); return; }
      if (!ini || !fim) { toast('Preencha os horários.'); return; }
      if (!pr.length) { toast('Marque pelo menos um dia que ainda não esteja escalado.'); return; }
      for (const [sid, d] of pr) await put('extras', uid('x_'), { staffId: sid, data: d, ini, fim, obs });
      closeSheet(); toast(ps.length > 1 ? `${ps.length} pessoas escaladas (${pr.length} escalas).` : (pr.length > 1 ? `${pr.length} dias escalados.` : 'Extra escalado.'));
    };
    chips();
  });
}

/* manter extras para o próximo mês (mesmo dia da semana, mesma semana do mês) */
function repeatMonth() {
  const mes = S.ui.week.slice(0, 7), [y, m] = mes.split('-').map(Number), nx = new Date(y, m, 1), nmes = iso(nx).slice(0, 7);
  const exist = new Set(Object.values(S.extras).map(e => `${e.staffId}|${e.data}|${e.ini}|${e.fim}`));
  const novos = [];
  Object.values(S.extras).filter(e => e.data.startsWith(mes) && S.staff[e.staffId]).forEach(e => {
    const dia = +e.data.slice(8), nth = Math.floor((dia - 1) / 7), dw = dowMon(e.data);
    const first = new Date(nx.getFullYear(), nx.getMonth(), 1), off = (dw - ((first.getDay() + 6) % 7) + 7) % 7;
    const alvo = new Date(first.getFullYear(), first.getMonth(), 1 + off + nth * 7);
    if (alvo.getMonth() !== first.getMonth()) return;
    const o = Object.assign({}, e, { data: iso(alvo) });
    if (!exist.has(`${o.staffId}|${o.data}|${o.ini}|${o.fim}`)) novos.push(o);
  });
  openSheet(`<h3>Manter para o próximo mês</h3>
    <p>A escala geral dos fixos já se repete sozinha todo mês${S.config.manterProximos === false ? ' (hoje está limitada, veja “Feriados e adicional” no Relatório)' : ''}.</p>
    <p>${novos.length ? `Copiar <b>${novos.length}</b> ${novos.length > 1 ? 'extras' : 'extra'} de <b>${MESES[m - 1]}</b> para <b>${MESES[nx.getMonth()]}</b>, no mesmo dia da semana e na mesma semana do mês.`
      : `Não há extras de ${MESES[m - 1]} para copiar, ou eles já existem em ${MESES[nx.getMonth()]}.`}</p>
    <div class="acts"><button class="btn" id="r-x">Fechar</button>${novos.length ? '<button class="btn primary" id="r-ok">Copiar extras</button>' : ''}</div>`,
  r => {
    $('#r-x', r).onclick = closeSheet;
    const ok = $('#r-ok', r);
    if (ok) ok.onclick = async () => { for (const o of novos) await put('extras', uid('x_'), o); closeSheet(); toast(`${novos.length} extras copiados para ${nmes.slice(5)}/${nmes.slice(0, 4)}.`); };
  });
}

/* ---------- feriados e configuração ---------- */
function configForm() {
  const c = S.config, fe = c.feriadosExtra || [];
  const row = (h, k) => `<div class="item"><div class="who"><b>${esc(h.nome)}</b><span>${h.anual ? dm(h.data) + ' · todo ano' : dmy(h.data)}</span></div><button class="btn sm ghost" data-rm="${k}" aria-label="Remover">✕</button></div>`;
  openSheet(`<h3>Feriados e adicional</h3>
    <div class="f"><label for="k-ad">Adicional por dia trabalhado em feriado (%)</label><input id="k-ad" type="number" min="0" step="5" inputmode="numeric" value="${c.adicionalFeriado ?? 100}">
      <span class="hint">Soma-se à diária. 100% paga a diária em dobro no feriado.</span></div>
    <label class="opt" style="margin-bottom:12px"><input type="checkbox" id="k-man" ${c.manterProximos === false ? '' : 'checked'}><div><b>Manter a escala geral nos próximos meses</b><span>Desmarcado, a escala geral vale só até o fim do mês atual.</span></div></label>
    <div class="sect" style="margin-top:6px">Feriados locais</div>
    <p class="hint" style="margin:0 0 8px">Os nacionais já estão incluídos. Cadastre aqui os estaduais e municipais.</p>
    <div class="list">${fe.map(row).join('') || '<div class="hint">Nenhum feriado local.</div>'}</div>
    <div class="f2" style="margin-top:10px"><div class="f"><label for="k-d">Data</label><input id="k-d" type="date"></div><div class="f"><label for="k-n">Nome</label><input id="k-n" placeholder="Ex.: Data Magna"></div></div>
    <label class="opt" style="margin-bottom:12px"><input type="checkbox" id="k-a" checked><div><b>Repete todo ano</b></div></label>
    <div class="acts"><button class="btn" id="k-add">Adicionar feriado</button><button class="btn primary" id="k-ok">Salvar</button></div>`,
  r => {
    $$('[data-rm]', r).forEach(b => b.onclick = () => { const l = fe.slice(); l.splice(+b.dataset.rm, 1); putConfig({ feriadosExtra: l }); configForm(); });
    $('#k-add', r).onclick = () => {
      const d = val(r, 'k-d'), n = val(r, 'k-n'); if (!d || !n) { toast('Informe data e nome.'); return; }
      putConfig({ feriadosExtra: fe.concat([{ data: d, nome: n, anual: $('#k-a', r).checked }]) }); configForm();
    };
    $('#k-ok', r).onclick = () => {
      const man = $('#k-man', r).checked, now = new Date();
      putConfig({ adicionalFeriado: Math.max(0, parseFloat(val(r, 'k-ad')) || 0), manterProximos: man,
        baseAte: man ? null : (c.baseAte || iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))) });
      closeSheet(); toast('Configuração salva.');
    };
  });
}

/* ===== WhatsApp, check-in, CSV, eventos e inicialização ===== */
function waText(p, ws) {
  const l = [`Olá, ${(p.nome || '').split(' ')[0]}! Sua escala de ${dm(ws)} a ${dm(addDays(ws, 6))}:`];
  let esp = false;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), s = shiftFor(p, d), f = holidayName(d); if (s.src === 'especial') esp = true;
    l.push(`${DIAS[i]} ${dm(d)}: ${s.ini ? `${s.ini} às ${s.fim}` : s.semEscala ? 'Sem escala' : s.afastado ? s.afastado : 'Folga'}${f ? ` (feriado: ${f})` : ''}`);
  }
  if (esp) l.push('Atenção: há alteração de escala nesta semana.');
  return l.join('\n');
}
const waPhone = t => { const n = (t || '').replace(/\D/g, ''); return !n ? '' : n.length <= 11 ? '55' + n : n; };
const waHref = (p, t) => `https://wa.me/${waPhone(p.whatsapp)}?text=${encodeURIComponent(t)}`;
async function copyFrom(ta) {
  try { await navigator.clipboard.writeText(ta.value); toast('Mensagem copiada.'); }
  catch (e) { ta.focus(); ta.select(); toast('Selecione e copie a mensagem.'); }
}
function waOne(id) {
  const p = S.staff[id], t = waText(p, S.ui.week), ok = !!waPhone(p.whatsapp);
  openSheet(`<h3>Escala de ${esc(p.nome)}</h3><div class="f"><label for="w-t">Mensagem</label><textarea id="w-t" rows="9" readonly>${esc(t)}</textarea></div>
    ${ok ? '' : '<p class="hint">Este colaborador não tem WhatsApp cadastrado. Informe o número em Equipe.</p>'}
    <div class="acts"><button class="btn" id="w-c">Copiar</button>${ok ? `<a class="btn wa" href="${waHref(p, t)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` : ''}</div>`,
  r => { $('#w-c', r).onclick = () => copyFrom($('#w-t', r)); });
}
function waTodos() {
  const ws = S.ui.week;
  openSheet(`<h3>Enviar escala ${dm(ws)} a ${dm(addDays(ws, 6))}</h3><p class="hint" style="margin-top:-6px">Cada botão abre o WhatsApp com a mensagem pronta para a pessoa.</p>
    <div class="list wa-list">${fixos().map(p => `<div class="item"><div class="who"><b>${esc(p.nome)}</b><span>${esc(p.whatsapp || 'Sem número')}</span></div>
    ${waPhone(p.whatsapp) ? `<a class="btn sm wa" href="${waHref(p, waText(p, ws))}" target="_blank" rel="noopener noreferrer">Enviar</a>` : '<span class="chip mute">Sem número</span>'}</div>`).join('') || '<div class="hint">Nenhum fixo cadastrado.</div>'}</div>
    <div class="acts"><button class="btn" id="w-x">Fechar</button></div>`, r => { $('#w-x', r).onclick = closeSheet; });
}

/* ---------- check-in do diarista / intermitente ---------- */
async function thumb(file) {
  const url = URL.createObjectURL(file), img = new Image();
  await new Promise((ok, er) => { img.onload = ok; img.onerror = er; img.src = url; });
  const s = 200 / Math.max(img.width, img.height), c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', .6);
}
/* check-in com um toque: entrada ou saída agora, ponto eletrônico. Quem tem código usa o formulário completo. */
function quickCheckin(sid) {
  const p = S.staff[sid], d = todayISO(); if (!p) return;
  const c = checkinOf(d, sid);
  if (c && c.saida) { toast(`${p.nome.split(' ')[0]} já concluiu o dia.`); return; }
  if (p.pin) { checkinForm(sid); return; }
  const t = nowHM(), o = c ? Object.assign({}, c, { saida: t, metodoSaida: 'ponto' }) : { staffId: sid, data: d, entrada: t, metodo: 'ponto' };
  put('checkins', `${d}_${sid}`, o); toast(`${c ? 'Saída' : 'Entrada'} de ${p.nome.split(' ')[0]} registrada às ${t}.`);
}
function checkinForm(pref) {
  const d = todayISO(), lst = extrasStaff();
  if (!lst.length) { toast('Cadastre um diarista ou intermitente primeiro.'); return; }
  const hoje = new Set(extrasOn(d).map(x => x.staffId));
  const ord = lst.slice().sort((a, b) => (hoje.has(b.id) - hoje.has(a.id)) || a.nome.localeCompare(b.nome, 'pt-BR'));
  let foto = null;
  openSheet(`<h3>Check-in · ${fmtLongDate(d)}</h3>
    <div class="f"><label for="k-p">Quem está chegando</label><select id="k-p">${ord.map(p => `<option value="${p.id}">${esc(p.nome)}${hoje.has(p.id) ? ' · escalado hoje' : ''}</option>`).join('')}</select></div>
    <div id="k-st" style="margin-bottom:12px"></div>
    <div class="f" id="k-pinw"><label for="k-pin">Código do colaborador</label><input id="k-pin" inputmode="numeric" maxlength="4" autocomplete="off"></div>
    <div class="f"><span class="l">Como registrar</span><div class="opts">
      <label class="opt"><input type="radio" name="met" value="ponto" checked><div><b>Ponto eletrônico</b><span>Grava o horário deste aparelho.</span></div></label>
      <label class="opt"><input type="radio" name="met" value="foto"><div><b>Ponto com foto</b><span>Tira uma selfie e guarda junto com o horário.</span></div></label></div></div>
    <div class="f" id="k-fw" hidden><label for="k-f">Foto do rosto</label><input id="k-f" type="file" accept="image/*" capture="user"><div id="k-prev"></div></div>
    <div class="acts"><button class="btn danger sp" id="k-del" hidden>Apagar registro</button><button class="btn" id="k-x">Fechar</button><button class="btn primary" id="k-ok">Registrar</button></div>`,
  r => {
    const cur = () => S.staff[$('#k-p', r).value], rec = () => checkinOf(d, cur().id);
    const sync = () => {
      const p = cur(), c = rec();
      $('#k-pinw', r).hidden = !p.pin;
      $('#k-st', r).innerHTML = !c ? '<span class="chip warn">Ainda sem entrada hoje</span>' : c.saida ? `<span class="chip ok">Entrada ${c.entrada} · saída ${c.saida}</span>` : `<span class="chip ok">Entrou às ${c.entrada}</span>`;
      const ok = $('#k-ok', r); ok.textContent = !c ? 'Registrar entrada' : c.saida ? 'Já concluído hoje' : 'Registrar saída'; ok.disabled = !!(c && c.saida);
      $('#k-del', r).hidden = !c;
    };
    $('#k-p', r).onchange = sync;
    if (pref && S.staff[pref]) $('#k-p', r).value = pref; sync();
    $$('input[name=met]', r).forEach(e => e.onchange = () => { $('#k-fw', r).hidden = $('input[name=met]:checked', r).value !== 'foto'; });
    $('#k-f', r).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { foto = await thumb(f); $('#k-prev', r).innerHTML = `<img class="photo" alt="Foto do check-in" src="${foto}">`; } catch (er) { toast('Não foi possível ler a foto.'); }
    };
    $('#k-x', r).onclick = closeSheet;
    $('#k-ok', r).onclick = () => {
      const p = cur(), c = rec(), met = $('input[name=met]:checked', r).value;
      if (p.pin && val(r, 'k-pin') !== p.pin) { toast('Código incorreto.'); return; }
      if (met === 'foto' && !foto) { toast('Tire a foto para registrar.'); return; }
      const t = nowHM();
      const o = c ? Object.assign({}, c, { saida: t, metodoSaida: met }) : { staffId: p.id, data: d, entrada: t, metodo: met };
      if (met === 'foto') o[c ? 'fotoSaida' : 'foto'] = foto;
      put('checkins', `${d}_${p.id}`, o); closeSheet(); toast(`${c ? 'Saída' : 'Entrada'} de ${p.nome.split(' ')[0]} registrada às ${t}.`);
    };
    $('#k-del', r).onclick = () => { const p = cur(); drop('checkins', `${d}_${p.id}`); closeSheet(); toast('Registro apagado.'); };
  });
}

/* ---------- CSV ---------- */
async function exportCsv() {
  const rows = reportRows(S.ui.mes, S.ui.base), n = v => String(v).replace('.', ',');
  const csv = '﻿' + [['Nome', 'Função', 'Vínculo', 'Diária', 'Dias escalados', 'Check-ins', 'Dias contados', 'Horas', 'Dias em feriado', 'A receber']]
    .concat(rows.map(r => [r.p.nome, r.p.funcao || '', TIPOS[r.p.tipo], n(r.p.diaria || 0), r.esc, r.chk, r.dias, n(r.horas.toFixed(2)), r.fer, n(r.valor.toFixed(2))]))
    .map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  let dl = null; try { dl = await claude.use('downloads'); } catch (e) { }
  if (!dl) { toast('O download não está disponível nesta visualização.'); return; }
  try { await dl.save({ filename: `relatorio-extras-${S.ui.mes}.csv`, data: csv }); } catch (e) { toast('Download cancelado.'); }
}

/* ---------- renderização e eventos ---------- */
function render() {
  const tab = S.ui.tab;
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('#hoje-lbl').textContent = fmtLongDate(todayISO());
  const v = $('#view'), sc = $('.scroll', v), x = sc ? sc.scrollLeft : 0;
  v.innerHTML = S.ready ? V[tab]() : '<div class="empty"><b>Carregando</b>Buscando a escala salva…</div>';
  const n = $('.scroll', v); if (n && x) n.scrollLeft = x;
}
function shiftMonth(m, k) { const [y, mo] = m.split('-').map(Number); return iso(new Date(y, mo - 1 + k, 1)).slice(0, 7); }

document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-nav]'); if (!t) return;
  if (t.dataset.tab) { S.ui.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.nav) {
    const [k, n] = t.dataset.nav.split(':'), s = +n;
    if (k === 'dia') S.ui.date = addDays(S.ui.date, s); else if (k === 'sem') S.ui.week = addDays(S.ui.week, 7 * s); else if (k === 'fmes') S.ui.fdsMes = shiftMonth(S.ui.fdsMes, s); else S.ui.mes = shiftMonth(S.ui.mes, s);
    render(); return;
  }
  if (t.dataset.mode) { S.ui.gridMode = t.dataset.mode; render(); return; }
  if (t.dataset.fex) { S.ui.fExtras = t.dataset.fex; render(); return; }
  if (t.dataset.exv) { S.ui.exView = t.dataset.exv; render(); return; }
  if (t.dataset.pgf) { S.ui.fPag = t.dataset.pgf; render(); return; }
  if (t.dataset.feq) { S.ui.fEquipe = t.dataset.feq; render(); return; }
  if (t.dataset.base) { S.ui.base = t.dataset.base; render(); return; }
  if (t.dataset.rel) { S.ui.relTab = t.dataset.rel; render(); return; }
  const a = t.dataset.act; if (!a) return;
  const ds = t.dataset;
  if (a === 'hoje-d') { S.ui.date = todayISO(); render(); }
  else if (a === 'hoje-w') { S.ui.week = weekStartOf(todayISO()); render(); }
  else if (a === 'add-staff') staffForm();
  else if (a === 'edit-staff') staffForm(ds.id);
  else if (a === 'cell') cellForm(ds.id, +ds.i, ds.d);
  else if (a === 'add-extra') extraForm(null, ds.d);
  else if (a === 'edit-extra') extraForm(ds.id);
  else if (a === 'checkin') checkinForm(ds.id);
  else if (a === 'quick-in') quickCheckin(ds.id);
  else if (a === 'pagar') pagForm(ds.id);
  else if (a === 'wa-one') waOne(ds.id);
  else if (a === 'wa-todos') waTodos();
  else if (a === 'repeat-month') repeatMonth();
  else if (a === 'config') configForm();
  else if (a === 'csv') exportCsv();
  else if (a === 'export') exportForm();
  else if (a === 'hoje-fm') { S.ui.fdsMes = todayISO().slice(0, 7); render(); }
  else if (a === 'fds-bulk') fdsBulk(ds.id);
  else if (a === 'add-falta') faltaForm();
  else if (a === 'edit-falta') faltaForm(ds.id);
  else if (a === 'fer-det') detalhesFeriados(ds.id);
  else if (a === 'baixa') baixaForm(ds.id, ds.d || null);
  else if (a === 'baixa-undo') baixaUndo(ds.id, ds.d, ds.bid);
  else if (a === 'reset-week') {
    const ws = S.ui.week; Object.values(S.special).filter(s => s.semana === ws).forEach(s => drop('special', s.id));
    toast('Semana voltou à escala geral.');
  }
});

document.addEventListener('change', e => { if (e.target.id === 'f-desde' && e.target.value) putConfig({ feriadosDesde: e.target.value }); });

_chg = render;
render();
initStore(render);
