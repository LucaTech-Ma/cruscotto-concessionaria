/* ---------- Calcoli (visibili in Sources) ---------- */
dash.calc('margini', {
  title: 'Margini per contratto',
  description: 'Margine veicolo, finanziamento e assicurazione di ogni contratto, IVA esclusa.',
  inputs: ['contratti'],
  fn: (contratti) => contratti.map((c) => {
    const n = (k) => Number(c[k]) || 0;
    const ricavo_netto = n('prezzo_listino') - n('sconto');
    const margine_veicolo = ricavo_netto - n('costo_acquisto') + n('campagna_brand') + n('altri_bonus_brand') - n('costo_preparazione') - n('costo_trasporto');
    const margine_fin = n('fin_provvigione') + n('fin_rappel') - n('fin_provvigione_venditore');
    const margine_ass = n('ass_provvigione') + n('ass_rappel') - n('ass_provvigione_venditore');
    return { contratto: c.contratto, ricavo_netto, margine_veicolo, margine_fin, margine_ass, margine_fi: margine_fin + margine_ass, margine_totale: margine_veicolo + margine_fin + margine_ass };
  }),
});

dash.calc('kpi', {
  title: 'Indicatori per periodo e brand',
  description: 'Totali, margini e penetrazioni per giornata e per mese a data; la giornata si confronta con la media delle 20 giornate precedenti, il mese con lo stesso periodo del mese prima.',
  inputs: ['contratti', 'margini'],
  fn: (contratti, margini) => {
    const marg = new Map(margini.map((r) => [r.contratto, r]));
    const righe = contratti.map((c) => ({ ...c, ...marg.get(c.contratto) }));
    const giorni = [...new Set(righe.map((r) => r.data))].sort();
    const n = (r, k) => Number(r[k]) || 0;
    const somma = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
    const quota = (a, b) => (b ? Math.round((a / b) * 10000) / 10000 : null);
    const tot = (rs) => {
      const v = rs.length;
      const mt = somma(rs, (r) => r.margine_totale);
      const mfi = somma(rs, (r) => r.margine_fi);
      return {
        vetture: v,
        fatturato_netto: somma(rs, (r) => r.ricavo_netto),
        margine_totale: mt,
        margine_veicolo: somma(rs, (r) => r.margine_veicolo),
        margine_fin: somma(rs, (r) => r.margine_fin),
        margine_ass: somma(rs, (r) => r.margine_ass),
        margine_fi: mfi,
        margine_medio: v ? Math.round(mt / v) : null,
        fi_per_vettura: v ? Math.round(mfi / v) : null,
        quota_fi: mt > 0 ? quota(mfi, mt) : null,
        fin_n: somma(rs, (r) => (r.finanziamento === 'Sì' ? 1 : 0)),
        ass_n: somma(rs, (r) => (r.assicurazione === 'Sì' ? 1 : 0)),
        fin_importo: somma(rs, (r) => n(r, 'fin_importo')),
        ass_importo: somma(rs, (r) => n(r, 'ass_importo')),
        pen_fin: quota(somma(rs, (r) => (r.finanziamento === 'Sì' ? 1 : 0)), v),
        pen_ass: quota(somma(rs, (r) => (r.assicurazione === 'Sì' ? 1 : 0)), v),
        permute: somma(rs, (r) => (r.permuta === 'Sì' ? 1 : 0)),
        neg_veicolo: somma(rs, (r) => (r.margine_veicolo < 0 ? 1 : 0)),
        perdita_neg: somma(rs, (r) => Math.min(0, r.margine_veicolo)),
        sconto_medio_pct: quota(somma(rs, (r) => n(r, 'sconto')), somma(rs, (r) => n(r, 'prezzo_listino'))),
        margine_listino: somma(rs, (r) => n(r, 'prezzo_listino') - n(r, 'costo_acquisto')),
        sconti: somma(rs, (r) => n(r, 'sconto')),
        campagne: somma(rs, (r) => n(r, 'campagna_brand')),
        bonus: somma(rs, (r) => n(r, 'altri_bonus_brand')),
        costi: somma(rs, (r) => n(r, 'costo_preparazione') + n(r, 'costo_trasporto')),
      };
    };
    const out = [];
    giorni.forEach((d, i) => {
      const [y, mo] = d.split('-').map(Number);
      const mesePrec = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
      const viste = {
        giorno: { cur: (r) => r.data === d, ref: (r) => r.data >= giorni[Math.max(0, i - 20)] && r.data < d, div: Math.min(i, 20) },
        mtd: { cur: (r) => r.data.slice(0, 7) === d.slice(0, 7) && r.data <= d, ref: (r) => r.data.slice(0, 7) === mesePrec && r.data.slice(8) <= d.slice(8), div: 1 },
      };
      for (const [vista, v] of Object.entries(viste)) {
        for (const brand of ['Tutti', 'Jeep', 'BYD', 'Volkswagen']) {
          const delBrand = (r) => brand === 'Tutti' || r.brand === brand;
          const a = tot(righe.filter((r) => delBrand(r) && v.cur(r)));
          const b = tot(righe.filter((r) => delBrand(r) && v.ref(r)));
          const ok = v.div > 0 && b.vetture > 0;
          const rif = (x) => x / v.div;
          out.push({
            chiave: `${vista}|${d}|${brand}`, vista, periodo: d, brand, ...a,
            ref_vetture: ok ? Math.round(rif(b.vetture) * 10) / 10 : null,
            ref_margine_totale: ok ? Math.round(rif(b.margine_totale)) : null,
            ref_fatturato_netto: ok ? Math.round(rif(b.fatturato_netto)) : null,
            ref_margine_veicolo: ok ? Math.round(rif(b.margine_veicolo)) : null,
            ref_margine_fin: ok ? Math.round(rif(b.margine_fin)) : null,
            ref_margine_ass: ok ? Math.round(rif(b.margine_ass)) : null,
            ref_margine_medio: ok ? b.margine_medio : null,
            ref_pen_fin: ok ? b.pen_fin : null,
            ref_pen_ass: ok ? b.pen_ass : null,
            d_vetture: ok ? Math.round((a.vetture - rif(b.vetture)) * 10) / 10 : null,
            d_fatturato_pct: ok ? quota(a.fatturato_netto - rif(b.fatturato_netto), rif(b.fatturato_netto)) : null,
            d_margine_totale_pct: ok && b.margine_totale > 0 ? quota(a.margine_totale - rif(b.margine_totale), rif(b.margine_totale)) : null,
            d_margine_medio: ok && a.vetture ? a.margine_medio - b.margine_medio : null,
            d_pen_fin: ok && a.vetture ? Math.round((a.pen_fin - b.pen_fin) * 10000) / 10000 : null,
            d_pen_ass: ok && a.vetture ? Math.round((a.pen_ass - b.pen_ass) * 10000) / 10000 : null,
          });
        }
      }
    });
    return out;
  },
});

dash.calc('venditori', {
  title: 'Risultati per venditore',
  description: 'Vetture, margine, penetrazione F&I e provvigioni maturate per venditore, per giornata e mese a data.',
  inputs: ['contratti', 'margini'],
  fn: (contratti, margini) => {
    const marg = new Map(margini.map((r) => [r.contratto, r]));
    const righe = contratti.map((c) => ({ ...c, ...marg.get(c.contratto) }));
    const giorni = [...new Set(righe.map((r) => r.data))].sort();
    const n = (r, k) => Number(r[k]) || 0;
    const somma = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
    const quota = (a, b) => (b ? Math.round((a / b) * 10000) / 10000 : null);
    const out = [];
    for (const d of giorni) {
      const viste = {
        giorno: righe.filter((r) => r.data === d),
        mtd: righe.filter((r) => r.data.slice(0, 7) === d.slice(0, 7) && r.data <= d),
      };
      for (const [vista, tutti] of Object.entries(viste)) {
        for (const brand of ['Tutti', 'Jeep', 'BYD', 'Volkswagen']) {
          const rs = tutti.filter((r) => brand === 'Tutti' || r.brand === brand);
          for (const venditore of [...new Set(rs.map((r) => r.venditore))].sort()) {
            const g = rs.filter((r) => r.venditore === venditore);
            const mt = somma(g, (r) => r.margine_totale);
            out.push({
              chiave: `${vista}|${d}|${brand}|${venditore}`, vista, periodo: d, brand, venditore,
              vetture: g.length,
              fatturato_netto: somma(g, (r) => r.ricavo_netto),
              sconto_medio_pct: quota(somma(g, (r) => n(r, 'sconto')), somma(g, (r) => n(r, 'prezzo_listino'))),
              margine_totale: mt,
              margine_medio: Math.round(mt / g.length),
              pen_fin: quota(somma(g, (r) => (r.finanziamento === 'Sì' ? 1 : 0)), g.length),
              pen_ass: quota(somma(g, (r) => (r.assicurazione === 'Sì' ? 1 : 0)), g.length),
              provvigioni_venditore: somma(g, (r) => n(r, 'fin_provvigione_venditore') + n(r, 'ass_provvigione_venditore')),
            });
          }
        }
      }
    }
    return out;
  },
});

/* ---------- Formati ---------- */
const BRANDS = ['Jeep', 'BYD', 'Volkswagen'];
const colore = (b) => dash.colors[BRANDS.indexOf(b)];
const fEur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
const fEur2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const fNum = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1, useGrouping: 'always' });
const fPct = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 0 });
const fPct1 = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 1 });
const vuoto = (v) => v === null || v === undefined || v === '' || Number.isNaN(Number(v));
const eur = (v) => (vuoto(v) ? '—' : fEur.format(Number(v)));
const eur2 = (v) => (vuoto(v) ? '—' : fEur2.format(Number(v)));
const num = (v) => (vuoto(v) ? '—' : fNum.format(Number(v)));
const pct = (v) => (vuoto(v) ? '—' : fPct.format(Number(v)));
const segno = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));
const FMT = {
  int: num, eur, eur2, pct,
  giorni: (v) => (vuoto(v) ? '—' : `${fNum.format(Math.round(v))} giorni`),
};
const aData = (s) => new Date(`${s}T12:00:00Z`);
const fGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fLunga = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fMese = new Intl.DateTimeFormat('it-IT', { month: 'long', timeZone: 'UTC' });
const fBreve = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fNumData = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const fSel = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const maiusc = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const enc = (v) => String(v).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D');
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const txt = (s) => document.createTextNode(s);
const b = (s, cls) => el('b', cls || '', s);
const RIDOTTO = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mesePrima = (giorno) => { const [y, m] = giorno.split('-').map(Number); return fMese.format(new Date(Date.UTC(y, m - 2, 1, 12))); };

// Numero che sale dal valore precedente al nuovo (al primo caricamento parte da zero).
const conta = (n, v, f) => {
  const da = n._v === undefined ? 0 : n._v;
  n._v = v;
  cancelAnimationFrame(n._raf);
  if (RIDOTTO || da === v) { n.textContent = f(v); return; }
  const t0 = performance.now(), durata = 600;
  const passo = (t) => {
    const q = Math.min(1, (t - t0) / durata), e = 1 - Math.pow(1 - q, 3);
    n.textContent = f(da + (v - da) * e);
    if (q < 1) n._raf = requestAnimationFrame(passo);
  };
  n._raf = requestAnimationFrame(passo);
};

/* ---------- Stato della pagina ---------- */
// La pagina ragiona per mese (in alto) e, solo nel dettaglio dei contratti, per giorno.
const stato = { tab: 'mese', misura: 'margine_totale', scelto: null, ordina: { k: 'contratto', dir: 1 }, cerca: '', soloNeg: false };
const params = () => { const p = dash.params(); return { mese: p.mese || null, giorno: p.giorno || null, vista: p.vista || 'giorno', brand: p.brand || 'Tutti' }; };
let GIORNI = [];
const meseAttivo = () => { const m = params().mese; const mesi = [...new Set(GIORNI.map((d) => d.slice(0, 7)))]; return mesi.includes(m) ? m : mesi[mesi.length - 1]; };
const fineMeseDati = (mese) => GIORNI.filter((d) => d.startsWith(mese)).pop();
const giornoAttivo = () => { const g = params().giorno; return GIORNI.includes(g) ? g : fineMeseDati(meseAttivo()); };

/* ---------- Tooltip ---------- */
const tooltip = (box) => { let t = box.querySelector('.cv-tip'); if (!t) { t = el('div', 'cv-tip'); t.hidden = true; box.append(t); } return t; };
const mostraTip = (box, tip, x, y) => {
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight, W = box.clientWidth;
  let left = x + 12; if (left + w > W) left = Math.max(0, x - w - 12);
  tip.style.left = `${left}px`; tip.style.top = `${Math.max(0, y - h - 8)}px`;
};
const rigaTip = (col, nome, valore) => {
  const r = el('div', 'cv-tip-row');
  if (col) { const s = el('i', 'cv-sw'); s.style.background = col; r.append(s); }
  r.append(el('span', '', nome), el('span', '', valore));
  return r;
};

/* ---------- 1. Com'è andata: cosa è stato venduto, poi il margine ---------- */
const freccia = (v, rif) => {
  if (vuoto(v) || vuoto(rif)) return null;
  const [cls, f] = v > rif * 1.03 ? ['cv-up', '↑'] : v < rif * 0.97 ? ['cv-down', '↓'] : ['cv-flat', '='];
  return el('span', `cv-trend ${cls}`, f);
};
const righe = (dl, voci) => dl.replaceChildren(...voci.flatMap(([t, v, cls]) => [el('dt', cls || '', t), el('dd', cls || '', v)]));
const rif = (box, parti) => box.replaceChildren(...parti.filter(Boolean).map((x) => (typeof x === 'string' ? txt(x) : x)));

/* ---------- Simulatore: cosa cambia in un mese se muovo una leva ---------- */
// Base: l'ultimo mese completo nei dati, per il brand scelto. Gli altri numeri restano fermi.
function baseSimulazione(contratti, marg, brand) {
  const ultimo = GIORNI[GIORNI.length - 1];
  const [y, m] = ultimo.split('-').map(Number);
  const pref = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const delBrand = (r) => brand === 'Tutti' || r.brand === brand;
  const rs = contratti.filter((r) => r.data.startsWith(pref) && delBrand(r)).map((r) => ({ ...r, ...(marg.get(r.contratto) || {}) }));
  if (!rs.length) return null;
  const n = (r, k) => Number(r[k]) || 0;
  const somma = (xs, f) => xs.reduce((s, r) => s + f(r), 0);
  const N = rs.length;
  const listino = somma(rs, (r) => n(r, 'prezzo_listino'));
  const sconti = somma(rs, (r) => n(r, 'sconto'));
  const fin = rs.filter((r) => r.finanziamento === 'Sì');
  const ass = rs.filter((r) => r.assicurazione === 'Sì');
  const per = rs.filter((r) => r.permuta === 'Sì');
  // Interessi per usato al giorno, su tutte le permute del brand: il dato più stabile che abbiamo.
  const tutte = contratti.filter((r) => r.permuta === 'Sì' && delBrand(r));
  const gg = somma(tutte, (r) => n(r, 'permuta_giorni_giacenza'));
  return {
    chiave: `${pref}|${brand}`,
    mese: fMese.format(aData(`${pref}-15`)),
    N,
    L: listino / N,                                             // listino medio
    m0: (somma(rs, (r) => r.margine_veicolo) + sconti) / N,     // margine per auto prima dello sconto
    f: fin.length ? somma(fin, (r) => r.margine_fin) / fin.length : 0,
    a: ass.length ? somma(ass, (r) => r.margine_ass) / ass.length : 0,
    p: per.length / N,                                          // permute per auto venduta
    i: gg ? somma(tutte, (r) => n(r, 'permuta_interessi_passivi')) / gg : 0,
    v: {
      N,
      sconto: listino ? sconti / listino : 0,
      pf: fin.length / N,
      pa: ass.length / N,
      g: per.length ? somma(per, (r) => n(r, 'permuta_giorni_giacenza')) / per.length : 30,
    },
  };
}
const simula = (B, v) => {
  const veicolo = v.N * (B.m0 - v.sconto * B.L);
  const fin = v.N * v.pf * B.f;
  const ass = v.N * v.pa * B.a;
  const usato = v.N * B.p * v.g * B.i;
  return { veicolo, fin, ass, usato, margine: veicolo + fin + ass, resta: veicolo + fin + ass - usato };
};

// Le cinque leve, in unità che il titolare usa: auto, percentuali, giorni.
const LEVE = [
  { k: 'N', nome: 'Auto vendute al mese', range: (B) => [Math.max(1, Math.round(B.v.N * 0.5)), Math.round(B.v.N * 1.5), 1],
    da: (x) => x, a: (x) => x, testo: (x) => `${num(Math.round(x))} auto` },
  { k: 'sconto', nome: 'Sconto medio sul listino', range: (B) => [0, Math.max(12, Math.ceil(B.v.sconto * 200)), 0.1],
    da: (x) => x * 100, a: (x) => x / 100, testo: (x) => fPct1.format(x) },
  { k: 'pf', nome: 'Auto vendute con un finanziamento', range: () => [0, 100, 1],
    da: (x) => x * 100, a: (x) => x / 100, testo: (x) => `${pct(x)} delle auto` },
  { k: 'pa', nome: 'Auto vendute con un\'assicurazione', range: () => [0, 100, 1],
    da: (x) => x * 100, a: (x) => x / 100, testo: (x) => `${pct(x)} delle auto` },
  { k: 'g', nome: 'Giorni dell\'usato in piazzale', range: () => [5, 120, 1],
    da: (x) => x, a: (x) => x, testo: (x) => `${num(Math.round(x))} giorni` },
];
const SCENARI = [
  { nome: 'Meno sconti', fa: (B, v) => ({ ...v, sconto: Math.max(0, B.v.sconto - 0.01) }), spiega: 'sconto medio −1 punto' },
  { nome: 'Più finanziamenti', fa: (B, v) => ({ ...v, pf: Math.min(1, B.v.pf + 0.1) }), spiega: '+1 auto su 10 con finanziamento' },
  { nome: 'Più assicurazioni', fa: (B, v) => ({ ...v, pa: Math.min(1, B.v.pa + 0.1) }), spiega: '+1 auto su 10 con assicurazione' },
  { nome: 'Usato più veloce', fa: (B, v) => ({ ...v, g: Math.max(5, B.v.g - 15) }), spiega: 'usato venduto 15 giorni prima' },
];

const sim = { base: null, v: null };

function costruisciLeve() {
  const box = $('#sim-leve');
  box.replaceChildren(...LEVE.map((l) => {
    const d = el('div', 'cv-lever');
    const testa = el('div', 'cv-lever-head');
    const lab = el('label', '', l.nome); lab.htmlFor = `sim-${l.k}`;
    const out = el('output', 'cv-lever-val'); out.id = `sim-${l.k}-val`; out.htmlFor = `sim-${l.k}`;
    testa.append(lab, out);
    const input = el('input'); input.type = 'range'; input.id = `sim-${l.k}`;
    input.addEventListener('input', () => { sim.v = { ...sim.v, [l.k]: l.a(Number(input.value)) }; mostraSimulazione(); });
    const piede = el('div', 'cv-lever-foot');
    const oggi = el('span'); oggi.id = `sim-${l.k}-oggi`;
    const eff = el('span', 'cv-lever-eff'); eff.id = `sim-${l.k}-eff`;
    piede.append(oggi, eff);
    d.append(testa, input, piede);
    return d;
  }));
  $('#sim-scenari').replaceChildren(...[...SCENARI.map((sc) => {
    const bt = el('button', 'cv-chip-sc', sc.nome); bt.type = 'button'; bt.title = sc.spiega;
    bt.addEventListener('click', () => { sim.v = sc.fa(sim.base, sim.v); mostraSimulazione(true); });
    return bt;
  }), (() => {
    const bt = el('button', 'cv-chip-sc cv-chip-reset', 'Riparti da capo'); bt.type = 'button'; bt.id = 'sim-reset';
    bt.addEventListener('click', () => { sim.v = { ...sim.base.v }; mostraSimulazione(true); });
    return bt;
  })()]);
}

function simulatore(contratti, marg, mappaKpi, giorno, brand) {
  const B = baseSimulazione(contratti, marg, brand);
  const sez = $('#sez-simula');
  sez.hidden = !B;
  if (!B) return;
  if (!$('#sim-leve').children.length) costruisciLeve();
  const nuovaBase = !sim.base || sim.base.chiave !== B.chiave;
  sim.base = B;
  if (nuovaBase) sim.v = { ...B.v };
  mostraSimulazione(nuovaBase);
}

function mostraSimulazione(aggiornaCursori) {
  const B = sim.base, v = sim.v; if (!B) return;
  const base = simula(B, B.v), r = simula(B, v);
  $('#sim-intro').replaceChildren(txt(`Parti da ${B.mese}: `), b(`${num(B.N)} auto vendute`), txt(' e '), b(eur(base.margine)), txt(' di margine. Sposta i cursori e guarda cosa cambia in un mese.'));

  // Cursori: valore, riferimento e quanto vale la singola leva
  LEVE.forEach((l) => {
    const input = $(`#sim-${l.k}`);
    const [min, max, step] = l.range(B);
    input.min = min; input.max = max; input.step = step;
    if (aggiornaCursori) input.value = l.da(v[l.k]);
    $(`#sim-${l.k}-val`).textContent = l.testo(v[l.k]);
    $(`#sim-${l.k}-oggi`).textContent = `a ${B.mese}: ${l.testo(B.v[l.k])}`;
    const eff = simula(B, { ...B.v, [l.k]: v[l.k] }).resta - base.resta;
    const e = $(`#sim-${l.k}-eff`);
    e.textContent = Math.abs(eff) < 1 ? '' : `${segno(Math.round(eff), fEur.format)} al mese`;
    e.className = `cv-lever-eff ${eff > 0 ? 'cv-up' : eff < 0 ? 'cv-down' : ''}`;
    input.style.setProperty('--pos', `${((Number(input.value) - min) / (max - min || 1)) * 100}%`);
  });

  // Risultato
  const delta = r.resta - base.resta;
  $('#sim-resta').textContent = eur(r.resta);
  $('#sim-oggi').textContent = `a ${B.mese}: ${eur(base.resta)}`;
  const d = $('#sim-delta');
  if (Math.abs(delta) < 1) { d.className = 'cv-sim-delta'; d.replaceChildren(txt('Muovi un cursore o scegli uno scenario.')); }
  else {
    d.className = `cv-sim-delta ${delta > 0 ? 'cv-sim-piu' : 'cv-sim-meno'}`;
    d.replaceChildren(b(`${segno(Math.round(delta), fEur.format)} al mese`), txt(` · ${segno(Math.round(delta * 12), fEur.format)} in un anno`));
  }
  righe($('#sim-righe'), [
    ['Dalle auto', eur(r.veicolo), r.veicolo < 0 ? 'cv-neg' : ''],
    ['Dai finanziamenti', eur(r.fin)],
    ['Dalle assicurazioni', eur(r.ass)],
    ['Margine totale', eur(r.margine), 'cv-sub-tot'],
    ['Interessi sull\'usato fermo', `−${fEur.format(Math.round(r.usato))}`],
    ['Ti resta', eur(r.resta), 'cv-tot'],
  ]);

  // La leva che vale di più, e il confronto con l'obiettivo
  const effetti = LEVE.map((l) => ({ l, e: simula(B, { ...B.v, [l.k]: v[l.k] }).resta - base.resta })).filter((x) => x.e > 1).sort((a, c) => c.e - a.e);
  const note = [];
  if (effetti.length > 1) note.push(el('p', '', `La leva che vale di più: ${effetti[0].l.nome.toLowerCase()} (${segno(Math.round(effetti[0].e), fEur.format)} al mese).`));
  if (sim.meta) {
    const q = r.margine / sim.meta;
    const p = el('p');
    p.append(txt(`Con questi numeri il margine di un mese sarebbe il `), b(pct(q)), txt(` dell'obiettivo di ${sim.meseMeta} (${eur(sim.meta)})`), txt(q >= 1 ? ': obiettivo raggiunto.' : '.'));
    note.push(p);
  }
  $('#sim-note').replaceChildren(...note);
}

/* ---------- 3. Dove stai lasciando margine: analisi di un periodo ---------- */
// Le stime si mostrano con due cifre significative: 19.737 diventa 20.000. Più cifre darebbero una precisione che non c'è.
const stima = (v) => { const x = Math.abs(v); if (x < 10) return Math.round(v); const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(v / p) * p; };
const piuEuro = (v) => `+${fEur.format(stima(v))}`;
// Prima versione dell'agente: calcoli e regole fissi, nessuna AI. Ogni segnale ha un codice di regola, un valore stimato
// in euro al mese (quando si può stimare), il perché, cosa fare e quanto fidarsi. Le soglie sono un primo esempio.
const an = { attiva: false, periodo: null };
const isoDi = (d) => d.toISOString().slice(0, 10);
const giorniTra = (da, a) => Math.round((aData(a) - aData(da)) / 86400000) + 1;
const spostaGiorni = (s, n) => { const d = aData(s); d.setUTCDate(d.getUTCDate() + n); return isoDi(d); };
const fineMese = (pref) => { const [y, m] = pref.split('-').map(Number); return isoDi(new Date(Date.UTC(y, m, 0, 12))); };
const meseDi = (pref) => fMese.format(aData(`${pref}-15`));
const mesePrec = (pref) => { const [y, m] = pref.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

// Periodi analizzabili: i mesi nei dati, i trimestri completi e gli ultimi 30 giorni.
// Il confronto è con il periodo precedente della stessa lunghezza, solo se è tutto dentro i dati.
function periodiDisponibili() {
  const primo = GIORNI[0], ultimo = GIORNI[GIORNI.length - 1];
  const mesi = [...new Set(GIORNI.map((d) => d.slice(0, 7)))];
  const out = mesi.slice().reverse().map((pref) => {
    const fine = fineMese(pref), a = fine > ultimo ? ultimo : fine, parziale = a < fine;
    const prec = mesePrec(pref);
    const gg = Math.min(Number(a.slice(8)), Number(fineMese(prec).slice(8)));
    const nomeRef = parziale ? `${meseDi(prec)} allo stesso giorno` : meseDi(prec);
    const ref = `${prec}-01` >= primo ? { da: `${prec}-01`, a: parziale ? `${prec}-${String(gg).padStart(2, '0')}` : fineMese(prec), nome: nomeRef, rispetto: `rispetto ${/^[aeiou]/.test(nomeRef) ? 'ad' : 'a'} ${nomeRef}` } : null;
    return { id: `m|${pref}`, nome: `${maiusc(meseDi(pref))} ${pref.slice(0, 4)}${parziale ? ` (fino al ${Number(a.slice(8))})` : ''}`, da: `${pref}-01`, a, parziale, ref };
  });
  const trimestri = [];
  mesi.forEach((pref) => {
    const [y, m] = pref.split('-').map(Number);
    if ((m - 1) % 3) return;
    const ultimoMese = `${y}-${String(m + 2).padStart(2, '0')}`;
    if (`${pref}-01` < primo || fineMese(ultimoMese) > ultimo) return;
    const inizioPrec = mesePrec(mesePrec(mesePrec(pref)));
    const ref = `${inizioPrec}-01` >= primo ? { da: `${inizioPrec}-01`, a: fineMese(mesePrec(pref)), nome: 'il trimestre prima', rispetto: 'rispetto al trimestre prima' } : null;
    trimestri.push({ id: `t|${pref}`, nome: `Trimestre ${meseDi(pref)}–${meseDi(ultimoMese)} ${y}`, da: `${pref}-01`, a: fineMese(ultimoMese), parziale: false, ref });
  });
  const da30 = spostaGiorni(ultimo, -29);
  const ref30 = spostaGiorni(da30, -30) >= primo ? { da: spostaGiorni(da30, -30), a: spostaGiorni(da30, -1), nome: 'i 30 giorni prima', rispetto: 'rispetto ai 30 giorni prima' } : null;
  return [...out, ...trimestri.reverse(), { id: 'u30', nome: 'Ultimi 30 giorni', da: da30, a: ultimo, parziale: false, ref: ref30 }];
}

function analizzaPeriodo(righe, per, brand) {
  const n = (r, k) => Number(r[k]) || 0;
  const somma = (xs, f) => xs.reduce((s, r) => s + f(r), 0);
  const delBrand = (r) => brand === 'Tutti' || r.brand === brand;
  const cur = righe.filter((r) => delBrand(r) && r.data >= per.da && r.data <= per.a);
  const ref = per.ref ? righe.filter((r) => delBrand(r) && r.data >= per.ref.da && r.data <= per.ref.a) : [];
  const alMese = 30.4 / giorniTra(per.da, per.a);
  // Niente rumore: una differenza diventa un segnale solo se è troppo grande per essere un caso (test a una coda al 95%).
  // L'affidabilità dipende da quanto la differenza è netta e da quante auto la sostengono.
  const Z_MIN = 1.64;
  const zMedie = (xs, ys, f) => {
    const a = xs.map(f), c = ys.map(f);
    const se = Math.sqrt((d3.variance(a) || 0) / a.length + (d3.variance(c) || 0) / c.length);
    return se ? (d3.mean(a) - d3.mean(c)) / se : 0;
  };
  const zQuote = (k1, n1, k2, n2) => {
    const q = (k1 + k2) / (n1 + n2), se = Math.sqrt(q * (1 - q) * (1 / n1 + 1 / n2));
    return se ? (k1 / n1 - k2 / n2) / se : 0;
  };
  const affid = (z, x) => (z >= 2.33 && x >= 20 ? 'alta' : z >= 1.96 ? 'media' : 'bassa');
  const quotaSconto = (r) => n(r, 'sconto') / (n(r, 'prezzo_listino') || 1);
  const pp = (x) => fPct1.format(x);
  const conti = (xs) => {
    const L = somma(xs, (r) => n(r, 'prezzo_listino')), S = somma(xs, (r) => n(r, 'sconto'));
    const F = xs.filter((r) => r.finanziamento === 'Sì'), A = xs.filter((r) => r.assicurazione === 'Sì');
    return {
      N: xs.length, L, sc: L ? S / L : 0, nf: F.length,
      pf: xs.length ? F.length / xs.length : 0, pa: xs.length ? A.length / xs.length : 0,
      mf: F.length ? somma(F, (r) => r.margine_fin) / F.length : 0, ma: A.length ? somma(A, (r) => r.margine_ass) / A.length : 0,
      mt: somma(xs, (r) => r.margine_totale), mv: somma(xs, (r) => r.margine_veicolo),
      brandPaga: somma(xs, (r) => n(r, 'campagna_brand') + n(r, 'altri_bonus_brand')),
    };
  };
  const C = conti(cur), R = ref.length >= 10 ? conti(ref) : null;
  const segnali = [], rischi = [];
  if (!C.N) return { C, R, segnali, rischi, limiti: [] };

  // I confronti si fanno sempre dentro lo stesso marchio: marchi diversi hanno sconti, margini e finanziarie diversi,
  // e un confronto tra marchi scambierebbe un effetto del mix per un comportamento.
  const marchi = brand === 'Tutti' ? BRANDS : [brand];
  const su = (br) => (brand === 'Tutti' ? ` (${br})` : '');

  // Fuori dalla norma: un venditore rispetto ai colleghi dello stesso marchio (almeno 5 auto per parte)
  marchi.forEach((br) => {
    const qui = cur.filter((r) => r.brand === br), Q = conti(qui);
    [...new Set(qui.map((r) => r.venditore))].sort().forEach((v) => {
      const mie = qui.filter((r) => r.venditore === v), altri = qui.filter((r) => r.venditore !== v);
      if (mie.length < 5 || altri.length < 5) return;
      const M = conti(mie), A = conti(altri);
      const zSc = zMedie(mie, altri, quotaSconto);
      const zFin = zQuote(A.pf * A.N, A.N, M.pf * M.N, M.N), zAss = zQuote(A.pa * A.N, A.N, M.pa * M.N, M.N);
      if (M.sc - A.sc >= 0.012 && zSc >= Z_MIN) segnali.push({
        codice: 'SCO-01', chi: v, tipo: 'Fuori dalla norma', titolo: `${v} concede più sconto dei colleghi${su(br)}`,
        valore: (M.sc - A.sc) * M.L * alMese, fid: affid(zSc, mie.length),
        perche: [txt('In media il '), b(pp(M.sc)), txt(` del listino, contro il ${pp(A.sc)} degli altri venditori ${br}, su ${num(mie.length)} auto. Ogni punto di sconto in più esce direttamente dal margine.`)],
        azione: `Rivedi con ${v} le ultime trattative e fissa un tetto di sconto oltre il quale serve la tua approvazione.`,
        leva: { k: 'sconto', d: -(M.sc - A.sc) * (M.L / C.L) },
      });
      if (A.pf - M.pf >= 0.12 && zFin >= Z_MIN && Q.mf > 0) segnali.push({
        codice: 'FIN-02', chi: v, tipo: 'Fuori dalla norma', titolo: `${v} propone meno finanziamenti${su(br)}`,
        valore: mie.length * (A.pf - M.pf) * Q.mf * alMese, fid: affid(zFin, mie.length),
        perche: [txt('Il '), b(pct(M.pf)), txt(` delle sue auto ${br} ha un finanziamento, contro il ${pct(A.pf)} dei colleghi. Ogni finanziamento vale in media ${eur(Q.mf)} di margine.`)],
        azione: `Affianca ${v} in qualche trattativa: il finanziamento va proposto prima di chiudere sul prezzo, non dopo.`,
        leva: { k: 'pf', d: (A.pf - M.pf) * (mie.length / C.N) },
      });
      if (A.pa - M.pa >= 0.12 && zAss >= Z_MIN && Q.ma > 0) segnali.push({
        codice: 'ASS-02', chi: v, tipo: 'Fuori dalla norma', titolo: `${v} propone meno assicurazioni${su(br)}`,
        valore: mie.length * (A.pa - M.pa) * Q.ma * alMese, fid: affid(zAss, mie.length),
        perche: [txt('Il '), b(pct(M.pa)), txt(` delle sue auto ${br} esce con una polizza, contro il ${pct(A.pa)} dei colleghi. Ogni polizza vale in media ${eur(Q.ma)} di margine.`)],
        azione: `Controlla con ${v} come presenta le polizze: meglio dentro la rata che come voce a parte.`,
        leva: { k: 'pa', d: (A.pa - M.pa) * (mie.length / C.N) },
      });
    });
  });

  // Poche vendite: un venditore che chiude molti meno contratti dei colleghi dello stesso marchio.
  // Scatta sotto il 60% della media dei colleghi, solo se i colleghi ne chiudono almeno 5 (soglie di esempio, non validate).
  marchi.forEach((br) => {
    const qui = cur.filter((r) => r.brand === br), Q = conti(qui);
    const nomi = [...new Set(qui.map((r) => r.venditore))].sort();
    if (nomi.length < 2 || !Q.N) return;
    nomi.forEach((v) => {
      const mie = qui.filter((r) => r.venditore === v).length;
      const media = (qui.length - mie) / (nomi.length - 1);
      if (media >= 5 && mie <= media * 0.6) segnali.push({
        codice: 'VOL-01', chi: v, tipo: 'Fuori dalla norma', titolo: `${v} vende meno dei colleghi${su(br)}`,
        valore: (media - mie) * (Q.mt / Q.N) * alMese, fid: mie <= media * 0.4 ? 'media' : 'bassa',
        perche: [txt('Ha chiuso '), b(`${num(mie)} ${mie === 1 ? 'contratto' : 'contratti'} ${br}`), txt(`, contro una media di ${num(Math.round(media * 10) / 10)} degli altri venditori del marchio. Ogni contratto ${br} vale in media ${eur(Q.mt / Q.N)} di margine.`)],
        azione: `Guarda con ${v} trattative aperte e contatti ricevuti: se ne riceve meno degli altri è un tema di distribuzione dei contatti, se li riceve ma non chiude è un tema di vendita.`,
      });
    });
  });

  // Regole violate: auto vendute sotto costo
  const sotto = cur.filter((r) => r.margine_veicolo < 0);
  if (sotto.length) {
    const persi = -somma(sotto, (r) => r.margine_veicolo), ripresi = somma(sotto, (r) => r.margine_fi);
    segnali.push({
      codice: 'VEN-01', tipo: 'Regola violata', titolo: `${num(sotto.length)} ${sotto.length === 1 ? 'auto venduta' : 'auto vendute'} sotto costo`,
      valore: persi * alMese, fid: 'alta',
      perche: [txt('Hanno perso '), b(eur(persi)), txt(' sulla vendita'), txt(ripresi > 0 ? `; finanziamenti e assicurazioni ne hanno recuperati ${eur(ripresi)}.` : '.')],
      azione: 'Nessuna auto sotto costo senza la tua firma. Per ognuna guarda la causa: sconto, valutazione della permuta o costi di preparazione.',
    });
  }

  const limiti = [
    'Non ho i dati delle auto nuove in piazzale: il loro costo di giacenza non è incluso.',
    'Non conosco i costi fissi (personale, affitto, energia): parlo di margine, non di utile.',
    'I valori sono stime al mese e in parte si sovrappongono: non vanno sommati come se fossero indipendenti.',
    'Segnalo solo le differenze troppo grandi per essere un caso: con poche auto, una differenza reale può non comparire.',
  ];
  if (!R) limiti.unshift('Non ci sono dati sul periodo precedente: il margine per auto non ha un confronto.');
  if (giorniTra(per.da, per.a) < 25) limiti.unshift('Il periodo è breve: le stime al mese sono meno affidabili.');

  segnali.sort((a, c) => c.valore - a.valore);
  return { C, R, segnali, rischi, limiti };
}

// Porta il simulatore sulla leva della proposta: il titolare vede l'effetto e decide.
function apriNelSimulatore(leva) {
  const B = sim.base; if (!B) return;
  const x = B.v[leva.k] + leva.d;
  sim.v = { ...B.v, [leva.k]: leva.k === 'g' ? Math.max(5, x) : Math.min(1, Math.max(0, x)) };
  mostraSimulazione(true);
  $('#sez-simula').scrollIntoView({ block: 'start', behavior: RIDOTTO ? 'auto' : 'smooth' });
}

// Titoli brevi da titolare: cosa fare, non cosa è successo. Il dettaglio resta nel "perché".
const AZIONE_BREVE = {
  'SCO-01': (s) => `Riporta gli sconti di ${s.chi} nella media`,
  'FIN-02': (s) => `Fai proporre più finanziamenti a ${s.chi}`,
  'ASS-02': (s) => `Fai proporre più polizze a ${s.chi}`,
  'VEN-01': () => 'Ferma le vendite sotto costo',
  'VOL-01': (s) => `Segui da vicino ${s.chi}`,
};

// In alto: le tre azioni che valgono di più nel mese scelto, una riga ciascuna. Il resto si apre con un tocco.
/* ---------- Tabelle ---------- */
function tabella(tbody, righe, colonne, chiave, opzioni = {}) {
  if (!righe.length) {
    const tr = el('tr'); const td = el('td', 'cv-empty', opzioni.vuota || 'Nessun dato nel periodo scelto');
    td.colSpan = colonne.length; tr.append(td); tbody.replaceChildren(tr); return;
  }
  tbody.replaceChildren(...righe.map((r) => {
    const tr = el('tr', opzioni.classe ? opzioni.classe(r) : '');
    tr.dataset.key = chiave(r);
    colonne.forEach((c) => {
      const td = el('td', [c.num ? 'num' : '', c.hide ? 'cv-hide-sm' : '', c.cls ? c.cls(r) : ''].join(' ').trim());
      if (c.render) c.render(td, r); else td.textContent = c.fmt ? c.fmt(r[c.f], r) : r[c.f] || '—';
      tr.append(td);
    });
    return tr;
  }));
}

/* ---------- Controlli ---------- */
// La pagina ragiona per mese e per marchio. Il resto è fisso: un executive vuole meno rumore possibile.
const vista = { trend: 'margine_totale' };
$('#sel-mese').addEventListener('change', (e) => dash.setParams({ mese: e.target.value }));
$$('#seg-brand button').forEach((x) => x.addEventListener('click', () => dash.setParams({ brand: x.dataset.brand })));
$$('#seg-trend button').forEach((x) => x.addEventListener('click', () => { vista.trend = x.dataset.misura; disegna(); }));
$('#btn-pdf').addEventListener('click', () => scaricaReport());

/* ---------- 1. I numeri chiave ---------- */
const confronto = (box, v, r, f, prima) => {
  box.replaceChildren(...(vuoto(v) || vuoto(r) ? [] : [freccia(v, r), txt(` ${prima.slice(0, 3)}: ${f(r)}`)].filter(Boolean)));
  box.title = vuoto(v) || vuoto(r) ? '' : `${maiusc(prima)} allo stesso giorno: ${f(r)}`;
};
const NUMERI = [
  ['#n-fatt', 'fatturato_netto', 'ref_fatturato_netto', eur, 'Fatturato'],
  ['#n-marg', 'margine_totale', 'ref_margine_totale', eur, 'Margine'],
  ['#n-medio', 'margine_medio', 'ref_margine_medio', eur, 'Margine per contratto'],
  ['#n-auto', 'vetture', 'ref_vetture', num, 'Contratti'],
];
function numeri(k, fine) {
  const prima = mesePrima(fine), ok = k && k.vetture;
  NUMERI.forEach(([sel, c, r, f]) => {
    $(sel).textContent = ok ? f(k[c]) : '—';
    confronto($(`${sel}-ref`), ok ? k[c] : null, ok ? k[r] : null, f, prima);
  });
}

/* ---------- 2. Cosa ha portato margine ---------- */
// Tre fonti di margine: vendita delle auto, finanziamenti, assicurazioni. Ognuna con quota, valore per contratto e confronto.
const FONTI = [
  { k: 'margine_veicolo', nome: 'Vendita delle auto', col: 'var(--mix-auto)', pdf: [59, 91, 143], n: 'vetture', per: 'Margine per auto', ref: 'ref_margine_veicolo' },
  { k: 'margine_fin', nome: 'Finanziamenti', col: 'var(--mix-fin)', pdf: [227, 155, 46], n: 'fin_n', per: 'Margine per finanziamento', pen: 'pen_fin', ref: 'ref_margine_fin' },
  { k: 'margine_ass', nome: 'Assicurazioni', col: 'var(--mix-ass)', pdf: [42, 157, 143], n: 'ass_n', per: 'Margine per polizza', pen: 'pen_ass', ref: 'ref_margine_ass' },
];
function fonti(k, fine) {
  const box = $('#fonti'), barra = $('#fonti-barra');
  if (!k || !k.vetture) { box.replaceChildren(el('p', 'cv-note', 'Nessuna auto venduta nel mese.')); barra.replaceChildren(); return; }
  const prima = mesePrima(fine), tot = k.margine_totale;
  barra.replaceChildren(...FONTI.filter((f) => k[f.k] > 0).map((f) => {
    const s = el('span'); s.style.flex = `${k[f.k]} 1 0`; s.style.background = f.col; s.title = `${f.nome}: ${pct(k[f.k] / tot)} del margine`; return s;
  }));
  box.replaceChildren(...FONTI.map((f) => {
    const c = el('article', 'cv-qcard cv-fonte'); c.style.setProperty('--dot', f.col);
    const lab = el('div', 'cv-qlabel'); lab.append(el('i', 'cv-dot'), txt(f.nome));
    const val = el('div', `cv-fonte-val${k[f.k] < 0 ? ' cv-neg' : ''}`, eur(k[f.k]));
    const quota = el('div', 'cv-fonte-quota'); quota.append(b(tot > 0 ? pct(k[f.k] / tot) : '—'), txt(' del margine totale'));
    const ref = el('div', 'cv-qref'); confronto(ref, k[f.k], k[f.ref], eur, prima);
    const dl = el('dl', 'cv-qrows');
    righe(dl, [
      [f.per, k[f.n] ? eur(k[f.k] / k[f.n]) : '—'],
      f.pen ? ['Contratti con ' + (f.k === 'margine_fin' ? 'finanziamento' : 'polizza'), `${num(k[f.n])} su ${num(k.vetture)} · ${pct(k[f.pen])}`] : ['Contratti', num(k.vetture)],
    ]);
    c.append(lab, val, quota, ref, dl);
    return c;
  }));
}

// Ripartizioni del margine totale: per marchio, modello e venditore, con una frase di lettura in cima.
function aggrega(righe, chiave) {
  const m = new Map();
  righe.forEach((r) => {
    const k = chiave(r);
    const x = m.get(k) || { nome: k, brand: r.brand, n: 0, mt: 0, fin: 0, ass: 0 };
    x.n++; x.mt += r.margine_totale;
    if (r.finanziamento === 'Sì') x.fin++;
    if (r.assicurazione === 'Sì') x.ass++;
    m.set(k, x);
  });
  return [...m.values()].map((x) => ({ ...x, medio: x.mt / x.n })).sort((a, c) => c.mt - a.mt);
}
function barre(box, voci, totale, scelto) {
  const max = Math.max(1, ...voci.map((v) => Math.abs(v.mt)));
  box.replaceChildren(...voci.map((v) => {
    const r = el('div', `cv-barra${scelto && v.nome === scelto ? ' cv-barra-scelta' : ''}`);
    const testa = el('div', 'cv-barra-testa');
    testa.append(el('span', 'cv-barra-nome', v.nome), el('span', `cv-barra-val${v.mt < 0 ? ' cv-neg' : ''}`, eur(v.mt)));
    const traccia = el('div', 'cv-barra-traccia');
    const riemp = el('i'); riemp.style.width = `${(Math.max(0, v.mt) / max) * 100}%`; riemp.style.background = colore(v.brand);
    traccia.append(riemp);
    const quota = totale > 0 ? ` · ${pct(v.mt / totale)} del margine` : '';
    r.append(testa, traccia, el('div', 'cv-barra-sub', `${num(v.n)} ${v.n === 1 ? 'contratto' : 'contratti'} · ${eur(v.medio)} a contratto${quota}`));
    return r;
  }));
}
const MAX_MODELLI = 6;
function ripartizioni(contratti, marg, mese, brand) {
  const delMese = contratti.filter((r) => r.data.startsWith(mese)).map((r) => ({ ...r, ...(marg.get(r.contratto) || {}) }));
  const sel = delMese.filter((r) => brand === 'Tutti' || r.brand === brand);
  const out = { marchi: [], modelli: [], venditori: [], letture: {} };
  const vuoto = (id) => { $(`#split-${id}`).replaceChildren(el('p', 'cv-note', 'Nessuna auto venduta nel mese.')); $(`#ins-${id}`).replaceChildren(); };
  if (!sel.length) { ['marchi', 'modelli', 'venditori'].forEach(vuoto); $('#altri-modelli').textContent = ''; return out; }

  // Marchi: sempre tutti e tre, per vedere quanto pesa ognuno. Il marchio scelto è evidenziato.
  const marchi = aggrega(delMese, (r) => r.brand);
  const totM = d3.sum(marchi, (x) => x.mt), nM = delMese.length, medioM = totM / nM;
  barre($('#split-marchi'), marchi, totM, brand === 'Tutti' ? null : brand);
  const primo = marchi[0];
  const perResa = marchi.slice().sort((a, c) => c.medio - a.medio);
  out.letture.marchi = [
    [b(primo.nome), txt(` porta il ${pct(primo.mt / totM)} del margine con il ${pct(primo.n / nM)} dei contratti.`)],
    perResa.length > 1 ? [txt('Rende di più a contratto '), b(perResa[0].nome), txt(` (${eur(perResa[0].medio)}), di meno `), b(perResa[perResa.length - 1].nome), txt(` (${eur(perResa[perResa.length - 1].medio)}); la media è ${eur(medioM)}.`)] : null,
  ].filter(Boolean);

  // Modelli del marchio scelto: i primi per margine; la lettura confronta la resa a contratto.
  const totS = d3.sum(sel, (r) => r.margine_totale), medioS = totS / sel.length;
  const modelli = aggrega(sel, (r) => r.modello);
  barre($('#split-modelli'), modelli.slice(0, MAX_MODELLI), totS);
  const resto = modelli.slice(MAX_MODELLI);
  $('#altri-modelli').textContent = resto.length ? `Altri ${num(resto.length)} modelli: ${eur(d3.sum(resto, (x) => x.mt))} di margine (${pct(d3.sum(resto, (x) => x.mt) / totS)}).` : '';
  const solidi = modelli.filter((x) => x.n >= 3).sort((a, c) => c.medio - a.medio);
  out.letture.modelli = [
    [b(modelli[0].nome), txt(` è il modello che porta più margine: ${eur(modelli[0].mt)}, il ${pct(modelli[0].mt / totS)} del totale.`)],
    solidi.length > 1 ? [txt('A contratto rende di più '), b(solidi[0].nome), txt(` (${eur(solidi[0].medio)}), di meno `), b(solidi[solidi.length - 1].nome), txt(` (${eur(solidi[solidi.length - 1].medio)}), contro una media di ${eur(medioS)}.`)] : null,
  ].filter(Boolean);

  // Venditori del marchio scelto
  const vend = aggrega(sel, (r) => r.venditore);
  barre($('#split-venditori'), vend, totS);
  const primi2 = vend.slice(0, 2), quotaPrimi = d3.sum(primi2, (x) => x.mt) / totS;
  const basso = vend.filter((x) => x.n >= 3).sort((a, c) => a.medio - c.medio)[0];
  out.letture.venditori = [
    vend.length > 2 ? [txt('I primi due venditori, '), b(primi2.map((x) => x.nome).join(' e ')), txt(`, portano il ${pct(quotaPrimi)} del margine.`)] : null,
    basso && basso.medio < medioS ? [b(basso.nome), txt(` rende ${eur(basso.medio)} a contratto, il ${pct(1 - basso.medio / medioS)} in meno della media (${eur(medioS)}).`)] : null,
  ].filter(Boolean);

  ['marchi', 'modelli', 'venditori'].forEach((id) => {
    $(`#ins-${id}`).replaceChildren(...out.letture[id].map((parti) => { const p = el('p'); p.append(...parti); return p; }));
  });
  Object.assign(out, { marchi, modelli, venditori: vend, totM, totS });
  return out;
}

// Le due domande. "Dove potevi vendere di più" raccoglie gli alert sui venditori: pochi finanziamenti, poche polizze, poche vendite.
const PER_DOMANDA = { margine: ['SCO-01', 'VEN-01'], vendite: ['FIN-02', 'ASS-02', 'VOL-01'] };
const MOTIVI = { 'FIN-02': 'pochi finanziamenti', 'ASS-02': 'poche polizze', 'VOL-01': 'poche vendite' };
const ORD_FID = { alta: 3, media: 2, bassa: 1 };
function alertVenditori(segnali) {
  const per = new Map();
  segnali.forEach((s) => per.set(s.chi, [...(per.get(s.chi) || []), s]));
  return [...per.entries()].map(([chi, ss]) => ({
    alert: true, chi, codice: ss.map((s) => s.codice).join(', '),
    motivi: ss.map((s) => MOTIVI[s.codice]),
    titolo: `Alert su ${chi}`,
    valore: d3.sum(ss, (s) => s.valore),
    perche: ss.flatMap((s, i) => (i ? [txt(' '), ...s.perche] : s.perche)),
    azione: ss.map((s) => s.azione).join(' '),
    leva: (ss.find((s) => s.leva) || {}).leva,
    fid: ss.map((s) => s.fid).sort((a, c) => ORD_FID[c] - ORD_FID[a])[0],
  })).sort((a, c) => c.valore - a.valore);
}
const titoloAzione = (s) => (s.alert ? `Segui ${s.chi}: ${s.motivi.join(' e ')}` : AZIONE_BREVE[s.codice](s));
const testoDi = (nodi) => nodi.map((n) => (typeof n === 'string' ? n : n.textContent)).join('');
function listaAzioni(lista, segnali, n, vuota) {
  if (!n) { lista.replaceChildren(el('li', 'cv-an-vuoto', 'Nessuna auto venduta nel mese.')); return; }
  if (!segnali.length) { lista.replaceChildren(el('li', 'cv-an-vuoto', vuota)); return; }
  lista.replaceChildren(...segnali.map((s, i) => {
    const li = el('li');
    const box = el('details', `cv-az${s.alert ? ' cv-az-alert' : ''}`);
    const sum = el('summary');
    const testa = el('span', 'cv-az-titolo');
    if (s.alert) testa.append(el('span', 'cv-alert-chip', 'Alert'), txt(' '));
    testa.append(txt(titoloAzione(s)));
    sum.append(el('span', 'cv-an-rank', String(i + 1)), testa, el('span', 'cv-az-valore', piuEuro(s.valore)));
    const corpo = el('div', 'cv-az-corpo');
    const perche = el('p'); perche.append(...(s.alert ? [] : [b(`${s.titolo}. `)]), ...s.perche);
    const fare = el('p'); fare.append(b('Cosa cambiare: '), txt(s.azione));
    corpo.append(perche, fare);
    if (s.leva && sim.base) { const bt = el('button', 'cv-todo-btn', 'Simula questa azione'); bt.type = 'button'; bt.addEventListener('click', () => apriNelSimulatore(s.leva)); corpo.append(bt); }
    corpo.append(el('p', 'cv-az-fonte', `${s.alert ? 'Regole' : 'Regola'} ${s.codice} · affidabilità ${s.fid}`));
    box.append(sum, corpo);
    li.append(box);
    return li;
  }));
}
function domande(contratti, marg, brand, mese) {
  const per = periodiDisponibili().find((x) => x.id === `m|${mese}`);
  const righeTutte = contratti.map((r) => ({ ...r, ...(marg.get(r.contratto) || {}) }));
  const A = per ? analizzaPeriodo(righeTutte, per, brand) : { C: { N: 0 }, segnali: [] };
  const gruppi = {
    tutti: A.segnali,
    margine: A.segnali.filter((s) => PER_DOMANDA.margine.includes(s.codice)),
    vendite: alertVenditori(A.segnali.filter((s) => PER_DOMANDA.vendite.includes(s.codice))),
  };
  listaAzioni($('#d-margine'), gruppi.margine, A.C.N, 'Niente da segnalare: sconti in linea tra i venditori e nessuna auto venduta sotto costo.');
  listaAzioni($('#d-vendite'), gruppi.vendite, A.C.N, 'Nessun alert: ogni venditore propone finanziamenti e polizze e vende quanto i colleghi.');
  return gruppi;
}

/* ---------- 3. Per approfondire: andamento per mese e venditori ---------- */
const TREND = {
  fatturato_netto: { nome: 'Fatturato', f: eur, breve: (v) => `${fNum.format(Math.round(v / 1000))}k €` },
  margine_totale: { nome: 'Margine', f: eur, breve: (v) => `${fNum.format(Math.round(v / 1000))}k €` },
  margine_medio: { nome: 'Margine per contratto', f: eur, breve: eur },
  vetture: { nome: 'Contratti', f: num, breve: num },
};
function datiTrend(mappaKpi, brand, misura) {
  const mesi = [...new Set(GIORNI.map((d) => d.slice(0, 7)))];
  return mesi.map((m) => {
    const f = fineMeseDati(m), r = mappaKpi.get(`mtd|${f}|${brand}`);
    return { m, parziale: f < fineMese(m), fino: Number(f.slice(8)), v: r ? Number(r[misura]) || 0 : 0 };
  });
}
function trend(mappaKpi, brand, meseScelto) {
  const box = $('#trend'), T = TREND[vista.trend];
  const dati = datiTrend(mappaKpi, brand, vista.trend);
  const W = Math.max(280, box.clientWidth), H = 220, top = 26, bottom = 40;
  const max = Math.max(1, ...dati.map((d) => d.v));
  const slot = W / dati.length, bw = Math.min(64, slot * 0.56);
  const y = (v) => top + (1 - v / max) * (H - top - bottom);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${T.nome} per mese`);
  const add = (tag, attr, testo) => { const n = document.createElementNS(ns, tag); Object.entries(attr).forEach(([a, v]) => n.setAttribute(a, v)); if (testo !== undefined) n.textContent = testo; svg.append(n); return n; };
  add('line', { x1: 0, x2: W, y1: y(0), y2: y(0), stroke: 'var(--cds-chart-axis)', 'stroke-width': 1 });
  dati.forEach((d, i) => {
    const cx = slot * (i + 0.5), scelto = d.m === meseScelto;
    const r = add('rect', { x: cx - bw / 2, y: y(d.v), width: bw, height: Math.max(1, y(0) - y(d.v)), rx: 4,
      fill: scelto ? 'var(--mix-auto)' : 'var(--bar)', 'fill-opacity': d.parziale ? 0.55 : 1 });
    const tip = document.createElementNS(ns, 'title');
    tip.textContent = `${maiusc(meseDi(d.m))}${d.parziale ? ` fino al ${d.fino}` : ''}: ${T.f(d.v)}`;
    r.append(tip);
    add('text', { x: cx, y: y(d.v) - 8, 'text-anchor': 'middle', class: scelto ? 'cv-trend-val cv-trend-scelto' : 'cv-trend-val' }, T.breve(d.v));
    add('text', { x: cx, y: H - bottom + 18, 'text-anchor': 'middle', class: scelto ? 'cv-trend-scelto' : '' }, maiusc(meseDi(d.m)).slice(0, 3));
    if (d.parziale) add('text', { x: cx, y: H - bottom + 33, 'text-anchor': 'middle', class: 'cv-trend-nota' }, `fino al ${d.fino}`);
  });
  box.replaceChildren(svg);
  const parz = dati.find((d) => d.parziale);
  $('#trend-nota').textContent = parz ? `${maiusc(meseDi(parz.m))} è in corso: il dato arriva fino al ${parz.fino}.` : '';
}

const SEGNI_VENDITORE = { 'SCO-01': 'sconta più dei colleghi', 'FIN-02': 'meno finanziamenti', 'ASS-02': 'meno polizze', 'VOL-01': 'poche vendite' };
function segniPerVenditore(segnali) {
  const m = new Map();
  segnali.forEach((s) => { if (s.chi && SEGNI_VENDITORE[s.codice]) m.set(s.chi, [...(m.get(s.chi) || []), s.codice]); });
  return m;
}
function venditori(righeV, segni) {
  const ha = (r, c) => (segni.get(r.venditore) || []).includes(c);
  tabella($('#tab-venditori tbody'), righeV, [
    { f: 'venditore', render: (td, r) => { td.append(txt(r.venditore)); const s = segni.get(r.venditore); if (s) td.append(el('span', 'cv-sub', s.map((c) => SEGNI_VENDITORE[c]).join(' · '))); } },
    { f: 'vetture', num: true, fmt: num, cls: (r) => (ha(r, 'VOL-01') ? 'cv-neg' : '') },
    { f: 'fatturato_netto', num: true, hide: true, fmt: eur },
    { f: 'margine_totale', num: true, fmt: eur, cls: (r) => (r.margine_totale < 0 ? 'cv-neg' : '') },
    { f: 'margine_medio', num: true, hide: true, fmt: eur, cls: (r) => (r.margine_medio < 0 ? 'cv-neg' : '') },
    { f: 'sconto_medio_pct', num: true, hide: true, fmt: (v) => (vuoto(v) ? '—' : fPct1.format(v)), cls: (r) => (ha(r, 'SCO-01') ? 'cv-neg' : '') },
    { f: 'pen_fin', num: true, hide: true, fmt: pct, cls: (r) => (ha(r, 'FIN-02') ? 'cv-neg' : '') },
    { f: 'pen_ass', num: true, hide: true, fmt: pct, cls: (r) => (ha(r, 'ASS-02') ? 'cv-neg' : '') },
  ], (r) => r.chiave, { vuota: 'Nessun contratto nel mese' });
}

/* ---------- Disegno ---------- */
let REPORT = null;
function disegna() {
  const C = dash.data('contratti'), M = dash.data('margini'), K = dash.data('kpi'), V = dash.data('venditori');
  const p = params();
  $$('#seg-brand button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.brand === p.brand)));
  $$('#seg-trend button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.misura === vista.trend)));
  if (C.status !== 'ok') return;

  const contratti = C.data;
  GIORNI = [...new Set(contratti.map((r) => r.data))].sort();
  const mese = meseAttivo(), fine = fineMeseDati(mese);
  const mesi = [...new Set(GIORNI.map((d) => d.slice(0, 7)))];
  const etichettaMese = (m) => `${maiusc(meseDi(m))} ${m.slice(0, 4)}${m === mesi[mesi.length - 1] && fineMeseDati(m) < fineMese(m) ? ` (fino al ${Number(fineMeseDati(m).slice(8))})` : ''}`;
  const selM = $('#sel-mese');
  if (selM.options.length !== mesi.length) selM.replaceChildren(...mesi.slice().reverse().map((m) => new Option(etichettaMese(m), m)));
  selM.value = mese;
  const marchio = p.brand === 'Tutti' ? 'tutti i marchi' : p.brand;
  $('#titolo-numeri').textContent = `${etichettaMese(mese)} · ${marchio}`;

  const mappaKpi = K.status === 'ok' ? new Map(K.data.map((r) => [r.chiave, r])) : new Map();
  const k = mappaKpi.get(`mtd|${fine}|${p.brand}`);
  numeri(k, fine);
  fonti(k, fine);

  let gruppi = { tutti: [], margine: [], vendite: [] }, parti = { letture: {} };
  if (M.status === 'ok') {
    const margMap = new Map(M.data.map((r) => [r.contratto, r]));
    parti = ripartizioni(contratti, margMap, mese, p.brand);
    simulatore(contratti, margMap, mappaKpi, fine, p.brand);
    gruppi = domande(contratti, margMap, p.brand, mese);
  }
  trend(mappaKpi, p.brand, mese);

  const segni = segniPerVenditore(gruppi.tutti);
  const righeV = V.status === 'ok' ? V.data.filter((r) => r.vista === 'mtd' && r.periodo === fine && r.brand === p.brand).sort((a, c) => c.margine_totale - a.margine_totale) : [];
  $('#titolo-venditori').textContent = `Venditori · ${etichettaMese(mese)}`;
  venditori(righeV, segni);

  REPORT = { mese, fine, etichetta: etichettaMese(mese), marchio, brand: p.brand, k, gruppi, parti, righeV, segni };
}

/* ---------- Report PDF ---------- */
// Lo stesso contenuto della schermata, per chi non apre il cruscotto: numeri, cosa ha portato margine, le due domande, i venditori.
const pdfTxt = (s) => String(s).replace(/−/g, '-').replace(/[   ]/g, ' ');
const RGB_MARCHI = { Jeep: [10, 138, 102], BYD: [192, 102, 155], Volkswagen: [0, 114, 178] };
function scaricaReport() {
  const nota = $('#pdf-nota');
  if (!REPORT || !REPORT.k) { nota.textContent = 'I dati non sono ancora pronti.'; return; }
  if (!window.jspdf) { nota.textContent = 'Serve la connessione a internet per creare il PDF.'; return; }
  nota.textContent = '';
  const { k, gruppi, parti, righeV, segni, etichetta, marchio, fine, mese } = REPORT;
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const M = 16, CW = 210 - 2 * M, FONDO = 278;
  const INK = [18, 33, 58], MUTED = [90, 101, 119], LINE = [232, 234, 239], OK = [29, 122, 76], BAD = [184, 53, 43], WARN = [163, 95, 0];
  let y = 18;
  const font = (size, stile = 'normal', col = INK) => { doc.setFont('helvetica', stile); doc.setFontSize(size); doc.setTextColor(...col); };
  const spazio = (h) => { if (y + h > FONDO) { doc.addPage(); y = 18; } };
  const scrivi = (s, x, yy, opt) => doc.text(pdfTxt(s), x, yy, opt);
  const paragrafo = (s, x, w, size = 9.5, col = MUTED, stile = 'normal') => {
    font(size, stile, col);
    const righeT = doc.splitTextToSize(pdfTxt(s), w);
    const h = righeT.length * size * 0.42;
    spazio(h + 1);
    doc.text(righeT, x, y + size * 0.3);
    y += h + 1.5;
  };
  const titolo = (s, size = 12.5) => { spazio(22); y += 7; font(size, 'bold'); scrivi(s, M, y); y += 2.5; doc.setDrawColor(...LINE); doc.line(M, y, M + CW, y); y += 5.5; };
  // Il sottotitolo non resta mai da solo in fondo alla pagina: con lui vanno almeno la lettura e due barre
  const sottotitolo = (s) => { spazio(34); y += 5; font(10.5, 'bold'); scrivi(s, M, y); y += 5; };
  const altezza = (s, w, size) => doc.splitTextToSize(pdfTxt(s), w).length * size * 0.42 + 1.5;
  const prima = mesePrima(fine);
  // Barre orizzontali su due righe: sopra nome, barra e valore; sotto, in piccolo, il dettaglio
  const BARRA_X = M + 58, BARRA_W = 82;
  const barrePdf = (voci, totale, coloreDi) => {
    const max = Math.max(1, ...voci.map((v) => Math.abs(v.valore)));
    voci.forEach((v) => {
      spazio(11);
      font(9.5, 'normal', INK); scrivi(v.nome, M, y + 3.4);
      doc.setFillColor(...coloreDi(v));
      doc.rect(BARRA_X, y + 0.6, Math.max(0.6, (Math.max(0, v.valore) / max) * BARRA_W), 3.8, 'F');
      font(9.5, 'bold', v.valore < 0 ? BAD : INK); scrivi(eur(v.valore), M + CW, y + 3.4, { align: 'right' });
      font(8, 'normal', MUTED); scrivi(v.dettaglio, M, y + 7.6);
      y += 10.8;
    });
  };
  const lettura = (righeL) => (righeL || []).forEach((parti) => paragrafo(testoDi(parti), M, CW, 9, INK));

  // Testata
  font(18, 'bold'); scrivi('Report del mese', M, y); y += 7;
  font(10, 'normal', MUTED);
  scrivi(`Concessionaria Demo · ${etichetta} · ${marchio} · creato il ${fNumData.format(new Date())}`, M, y); y += 4.5;
  scrivi(`Confronto con ${prima} allo stesso giorno. Importi IVA esclusa. Dati di esempio.`, M, y); y += 8;

  // 1. I numeri chiave
  const bw = (CW - 9) / 4;
  NUMERI.forEach(([, c, r, f, nome], i) => {
    const x = M + i * (bw + 3);
    doc.setDrawColor(...LINE); doc.roundedRect(x, y, bw, 22, 2, 2);
    font(8, 'normal', MUTED); scrivi(nome, x + 3, y + 5.5);
    font(13, 'bold'); scrivi(f(k[c]), x + 3, y + 13);
    font(8, 'normal', MUTED); scrivi(vuoto(k[r]) ? '' : `${prima.slice(0, 3)}: ${f(k[r])}`, x + 3, y + 18.5);
  });
  y += 28;

  // 2. Cosa ha portato margine
  titolo('Cosa ha portato margine');
  barrePdf(FONTI.map((f) => ({
    nome: f.nome, valore: k[f.k], col: f.pdf,
    dettaglio: `${k.margine_totale > 0 ? pct(k[f.k] / k.margine_totale) : '—'} del margine · ${k[f.n] ? eur(k[f.k] / k[f.n]) : '—'} ${f.k === 'margine_veicolo' ? 'per auto' : f.k === 'margine_fin' ? 'per pratica' : 'per polizza'}${f.pen ? ` · ${pct(k[f.pen])} dei contratti` : ''}`,
  })), k.margine_totale, (v) => v.col);
  const daParti = (voci, totale) => voci.map((x) => ({ nome: x.nome, valore: x.mt, brand: x.brand, dettaglio: `${num(x.n)} contr. · ${eur(x.medio)} a contratto · ${totale > 0 ? pct(x.mt / totale) : '—'}` }));
  const coloreMarchio = (v) => RGB_MARCHI[v.brand] || INK;
  if (parti.marchi && parti.marchi.length) {
    sottotitolo('Per marchio'); lettura(parti.letture.marchi); barrePdf(daParti(parti.marchi, parti.totM), parti.totM, coloreMarchio);
    sottotitolo('Per modello'); lettura(parti.letture.modelli); barrePdf(daParti(parti.modelli.slice(0, MAX_MODELLI), parti.totS), parti.totS, coloreMarchio);
    if (parti.modelli.length > MAX_MODELLI) { y += 0.5; paragrafo($('#altri-modelli').textContent, M, CW, 8); }
    sottotitolo('Per venditore'); lettura(parti.letture.venditori); barrePdf(daParti(parti.venditori, parti.totS), parti.totS, coloreMarchio);
  }

  // Le due domande
  const domanda = (nome, lista, vuota) => {
    titolo(nome);
    if (!lista.length) { paragrafo(vuota, M, CW); return; }
    lista.forEach((s, i) => {
      // Ogni voce resta intera sulla stessa pagina
      spazio(8 + altezza(`${s.alert ? '' : `${s.titolo}. `}${testoDi(s.perche)}`, CW - 5, 9.5) + altezza(`Cosa cambiare: ${s.azione}`, CW - 5, 9.5) + altezza('Regola', CW - 5, 8) + 2);
      font(10.5, 'bold', s.alert ? WARN : INK); scrivi(`${i + 1}. ${s.alert ? 'ALERT · ' : ''}${titoloAzione(s)}`, M, y + 3.5);
      font(10.5, 'bold', OK); scrivi(`${piuEuro(s.valore)} al mese`, M + CW, y + 3.5, { align: 'right' });
      y += 6.5;
      paragrafo(`${s.alert ? '' : `${s.titolo}. `}${testoDi(s.perche)}`, M + 5, CW - 5);
      paragrafo(`Cosa cambiare: ${s.azione}`, M + 5, CW - 5, 9.5, INK);
      paragrafo(`${s.alert ? 'Regole' : 'Regola'} ${s.codice} · affidabilità ${s.fid}`, M + 5, CW - 5, 8);
      y += 1.5;
    });
  };
  domanda('Dove potevi guadagnare di più', gruppi.margine, 'Niente da segnalare: sconti in linea tra i venditori e nessuna auto venduta sotto costo.');
  domanda('Dove potevi vendere di più', gruppi.vendite, 'Nessun alert: ogni venditore propone finanziamenti e polizze e vende quanto i colleghi.');
  paragrafo('Stime al mese, arrotondate: i valori in parte si sovrappongono. Regole di esempio, con soglie da tarare sui dati della concessionaria.', M, CW, 8);

  // Venditori: la tabella resta tutta sulla stessa pagina
  spazio(26 + righeV.length * 5.5);
  titolo('Venditori');
  const col = [
    ['Venditore', M, 'left'], ['Contratti', M + 62, 'right'], ['Fatturato', M + 88, 'right'], ['Margine', M + 110, 'right'],
    ['Per contr.', M + 130, 'right'], ['Sconto', M + 146, 'right'], ['Finanz.', M + 162, 'right'], ['Polizza', M + CW, 'right'],
  ];
  font(8, 'bold', MUTED); col.forEach(([t, x, a]) => scrivi(t, x, y, { align: a })); y += 2; doc.line(M, y, M + CW, y); y += 4.5;
  righeV.forEach((r) => {
    spazio(6);
    const s = segni.get(r.venditore) || [];
    const val = [r.venditore, num(r.vetture), eur(r.fatturato_netto), eur(r.margine_totale), eur(r.margine_medio),
      vuoto(r.sconto_medio_pct) ? '—' : fPct1.format(r.sconto_medio_pct), pct(r.pen_fin), pct(r.pen_ass)];
    const rosso = [false, s.includes('VOL-01'), false, r.margine_totale < 0, r.margine_medio < 0, s.includes('SCO-01'), s.includes('FIN-02'), s.includes('ASS-02')];
    col.forEach(([, x, a], i) => { font(9, rosso[i] ? 'bold' : 'normal', rosso[i] ? BAD : INK); scrivi(val[i], x, y, { align: a }); });
    y += 5.5;
  });
  if (!righeV.length) paragrafo('Nessun contratto nel mese.', M, CW);

  // Piede su ogni pagina
  const pagine = doc.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i);
    font(8, 'normal', MUTED);
    scrivi('Cruscotto concessionaria · dati di esempio · importi IVA esclusa', M, 290);
    scrivi(`${i} di ${pagine}`, M + CW, 290, { align: 'right' });
  }
  doc.save(`report-${mese}-${marchio.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

dash.onData(disegna);
