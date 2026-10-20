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

dash.calc('fi_mix', {
  title: 'F&I per tipo di prodotto',
  description: 'Contratti, importi e provvigioni di finanziamenti e assicurazioni per tipo, per giornata e mese a data.',
  inputs: ['contratti'],
  fn: (contratti) => {
    const giorni = [...new Set(contratti.map((c) => c.data))].sort();
    const n = (r, k) => Number(r[k]) || 0;
    const somma = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
    const ambiti = [
      { ambito: 'Finanziamento', flag: 'finanziamento', tipo: 'fin_tipo', importo: 'fin_importo', provv: 'fin_provvigione', rappel: 'fin_rappel', vend: 'fin_provvigione_venditore', tipi: ['Balloon (PCP)', 'Rateale classico', 'Leasing', 'Noleggio lungo termine'] },
      { ambito: 'Assicurazione', flag: 'assicurazione', tipo: 'ass_tipo', importo: 'ass_importo', provv: 'ass_provvigione', rappel: 'ass_rappel', vend: 'ass_provvigione_venditore', tipi: ['Furto e incendio', 'Kasko', 'CPI credito protetto', 'GAP', 'Pacchetto F&I'] },
    ];
    const out = [];
    for (const d of giorni) {
      const viste = {
        giorno: contratti.filter((c) => c.data === d),
        mtd: contratti.filter((c) => c.data.slice(0, 7) === d.slice(0, 7) && c.data <= d),
      };
      for (const [vista, tutti] of Object.entries(viste)) {
        for (const brand of ['Tutti', 'Jeep', 'BYD', 'Volkswagen']) {
          const rs = tutti.filter((r) => brand === 'Tutti' || r.brand === brand);
          for (const a of ambiti) {
            const con = rs.filter((r) => r[a.flag] === 'Sì');
            for (const tipo of [...a.tipi, 'Totale']) {
              const g = tipo === 'Totale' ? con : con.filter((r) => r[a.tipo] === tipo);
              const conTan = g.filter((r) => a.ambito === 'Finanziamento' && r.fin_tasso !== '');
              const pesoTan = somma(conTan, (r) => n(r, 'fin_importo'));
              out.push({
                chiave: `${vista}|${d}|${brand}|${a.ambito}|${tipo}`, vista, periodo: d, brand, ambito: a.ambito, tipo,
                contratti: g.length,
                importo: somma(g, (r) => n(r, a.importo)),
                provvigioni_rappel: somma(g, (r) => n(r, a.provv) + n(r, a.rappel)),
                provvigioni_venditore: somma(g, (r) => n(r, a.vend)),
                tasso_medio: pesoTan ? Math.round((somma(conTan, (r) => n(r, 'fin_tasso') * n(r, 'fin_importo')) / pesoTan) * 100) / 100 : null,
              });
            }
          }
        }
      }
    }
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

dash.calc('usato', {
  title: 'Giacenza usato da permute',
  description: 'Permute ancora in stock per brand e fascia di giorni in giacenza, con costo stock e interessi passivi maturati.',
  inputs: ['contratti'],
  fn: (contratti) => {
    const stock = contratti.filter((c) => c.permuta_stato === 'In stock');
    const n = (r, k) => Number(r[k]) || 0;
    const somma = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
    const fasce = [['0–30 giorni', 0, 30], ['31–60 giorni', 31, 60], ['61–90 giorni', 61, 90], ['Oltre 90 giorni', 91, 100000], ['Totale', 0, 100000]];
    const out = [];
    for (const brand of ['Tutti', 'Jeep', 'BYD', 'Volkswagen']) {
      for (const [fascia, da, a] of fasce) {
        const g = stock.filter((r) => (brand === 'Tutti' || r.brand === brand) && n(r, 'permuta_giorni_giacenza') >= da && n(r, 'permuta_giorni_giacenza') <= a);
        out.push({
          chiave: `${brand}|${fascia}`, brand, fascia,
          permute: g.length,
          valutazione: somma(g, (r) => n(r, 'permuta_valutazione')),
          costo_stock: somma(g, (r) => n(r, 'permuta_costo_stock')),
          interessi_passivi: Math.round(somma(g, (r) => n(r, 'permuta_interessi_passivi')) * 100) / 100,
          giorni_medi: g.length ? Math.round((somma(g, (r) => n(r, 'permuta_giorni_giacenza')) / g.length) * 10) / 10 : null,
        });
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
const stato = { tab: 'vendite', misura: 'margine_totale', scelto: null, ordina: { k: 'contratto', dir: 1 }, cerca: '', soloNeg: false };
const params = () => { const p = dash.params(); return { giorno: p.giorno || null, vista: p.vista || 'giorno', brand: p.brand || 'Tutti' }; };
let GIORNI = [];
let ultimaCascata = null;
const giornoAttivo = () => { const g = params().giorno; return GIORNI.includes(g) ? g : GIORNI[GIORNI.length - 1]; };

/* ---------- Controlli ---------- */
$('#sel-giorno').addEventListener('change', (e) => { stato.scelto = null; dash.setParams({ giorno: e.target.value }); });
$('#btn-prev').addEventListener('click', () => { const i = GIORNI.indexOf(giornoAttivo()); if (i > 0) { stato.scelto = null; dash.setParams({ giorno: GIORNI[i - 1] }); } });
$('#btn-next').addEventListener('click', () => { const i = GIORNI.indexOf(giornoAttivo()); if (i < GIORNI.length - 1) { stato.scelto = null; dash.setParams({ giorno: GIORNI[i + 1] }); } });
$$('#seg-vista button').forEach((x) => x.addEventListener('click', () => { stato.scelto = null; dash.setParams({ vista: x.dataset.vista }); }));
$$('#seg-brand button').forEach((x) => x.addEventListener('click', () => { stato.scelto = null; dash.setParams({ brand: x.dataset.brand }); }));
$$('#seg-misura button').forEach((x) => x.addEventListener('click', () => { stato.misura = x.dataset.misura; disegna(); }));
$('#cerca-contratti').addEventListener('input', (e) => { stato.cerca = e.target.value.trim().toLowerCase(); disegna(); });
$('#chip-negativi').addEventListener('click', () => { stato.soloNeg = !stato.soloNeg; disegna(); });
$('#piu-cascata').addEventListener('toggle', () => { ultimaCascata = null; disegna(); });
$$('#tab-contratti th button[data-sort]').forEach((x) => x.addEventListener('click', () => {
  const k = x.dataset.sort;
  stato.ordina = stato.ordina.k === k ? { k, dir: -stato.ordina.dir } : { k, dir: 1 };
  disegna();
}));
$('#tab-brand').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-brand]');
  if (tr) { stato.scelto = null; dash.setParams({ brand: params().brand === tr.dataset.brand ? 'Tutti' : tr.dataset.brand }); }
});
const scegliContratto = (id) => { stato.scelto = stato.scelto === id ? null : id; disegna(); if (stato.scelto) $('#dettaglio').scrollIntoView({ block: 'nearest', behavior: RIDOTTO ? 'auto' : 'smooth' }); };
$('#tab-contratti').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr) scegliContratto(tr.dataset.key); });
$('#tab-contratti').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); scegliContratto(tr.dataset.key); } });

const mostraTab = (tab) => {
  stato.tab = tab;
  $$('.cv-tabs button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === tab)));
  $$('.cv-page').forEach((p) => { p.hidden = p.id !== `pagina-${tab}`; });
  dash.setLink(tab);
  disegna();
};
$$('.cv-tabs button').forEach((x) => x.addEventListener('click', () => mostraTab(x.dataset.tab)));
const vai = (tab, sel) => { mostraTab(tab); const n = $(sel); if (n) n.scrollIntoView({ block: 'start', behavior: RIDOTTO ? 'auto' : 'smooth' }); };

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

function riepilogo(k, p, giorno) {
  const h = $('#headline'), sub = $('#subline');
  const chi = p.brand === 'Tutti' ? '' : ` ${p.brand}`;
  const quando = p.vista === 'giorno' ? maiusc(fGiorno.format(aData(giorno))) : `${maiusc(fMese.format(aData(giorno)))} fino al ${Number(giorno.slice(8))}`;
  const etichetta = p.vista === 'giorno' ? 'di solito' : `a ${mesePrima(giorno)}`;
  const vuotoK = !k || !k.vetture;

  // Frase d'apertura con le quantità colorate come i riquadri
  if (vuotoK) {
    h.textContent = `${quando}: nessuna auto${chi} venduta.`;
    sub.replaceChildren();
  } else {
    const parola = (s, c) => el('span', `cv-k cv-k-${c}`, s);
    h.replaceChildren(
      txt(`${quando}: `),
      parola(`${num(k.vetture)} ${k.vetture === 1 ? `auto${chi} venduta` : `auto${chi} vendute`}`, 'auto'), txt(', '),
      parola(`${num(k.fin_n)} ${k.fin_n === 1 ? 'finanziamento' : 'finanziamenti'}`, 'fin'), txt(' e '),
      parola(`${num(k.ass_n)} ${k.ass_n === 1 ? 'assicurazione' : 'assicurazioni'}`, 'ass'),
      txt('. Margine totale: '), parola(eur(k.margine_totale), 'tot'), txt('.'));
    const d = k.d_margine_totale_pct;
    const rispetto = p.vista === 'giorno' ? 'rispetto alla media delle ultime 4 settimane' : `rispetto a ${mesePrima(giorno)} allo stesso giorno`;
    const cosa = p.vista === 'giorno' ? 'Una giornata' : 'Un mese';
    if (vuoto(d)) sub.replaceChildren();
    else if (d > 0.05) sub.replaceChildren(txt(`${cosa} migliore del solito: margine `), b(segno(d, fPct.format), 'cv-up'), txt(` ${rispetto}.`));
    else if (d < -0.05) sub.replaceChildren(txt(`${cosa} sotto la media: margine `), b(segno(d, fPct.format), 'cv-down'), txt(` ${rispetto}.`));
    else sub.replaceChildren(txt(`${cosa} in linea con il solito, ${rispetto}.`));
  }

  const trattino = '—';
  const perUno = (tot, n) => (n ? eur(tot / n) : trattino);

  // Auto vendute
  rif($('#q-auto-ref'), vuotoK ? [] : [freccia(k.vetture, k.ref_vetture), vuoto(k.ref_vetture) ? '' : `${etichetta} ${num(k.ref_vetture)}`]);
  righe($('#q-auto-rows'), vuotoK ? [] : [
    ['Incassato', eur(k.fatturato_netto)],
    ['Sconto medio', vuoto(k.sconto_medio_pct) ? trattino : fPct1.format(k.sconto_medio_pct)],
    ['Margine', eur(k.margine_veicolo), k.margine_veicolo < 0 ? 'cv-tot cv-neg' : 'cv-tot'],
  ]);

  // Finanziamenti
  $('#q-fin-unit').textContent = vuotoK ? '' : `su ${num(k.vetture)} auto`;
  rif($('#q-fin-ref'), vuotoK ? [] : [freccia(k.pen_fin, k.ref_pen_fin), `${pct(k.pen_fin)} delle auto`, vuoto(k.ref_pen_fin) ? '' : ` · ${etichetta} ${pct(k.ref_pen_fin)}`]);
  righe($('#q-fin-rows'), vuotoK ? [] : [
    ['Importo finanziato', eur(k.fin_importo)],
    ['Per finanziamento', perUno(k.margine_fin, k.fin_n)],
    ['Margine', eur(k.margine_fin), 'cv-tot'],
  ]);

  // Assicurazioni
  $('#q-ass-unit').textContent = vuotoK ? '' : `su ${num(k.vetture)} auto`;
  rif($('#q-ass-ref'), vuotoK ? [] : [freccia(k.pen_ass, k.ref_pen_ass), `${pct(k.pen_ass)} delle auto`, vuoto(k.ref_pen_ass) ? '' : ` · ${etichetta} ${pct(k.ref_pen_ass)}`]);
  righe($('#q-ass-rows'), vuotoK ? [] : [
    ['Premi', eur(k.ass_importo)],
    ['Per polizza', perUno(k.margine_ass, k.ass_n)],
    ['Margine', eur(k.margine_ass), 'cv-tot'],
  ]);

  // Margine totale: la somma delle tre parti
  rif($('#q-tot-ref'), vuotoK ? [] : [freccia(k.margine_totale, k.ref_margine_totale), vuoto(k.ref_margine_totale) ? '' : `${etichetta} ${eur(k.ref_margine_totale)}`]);
  const parti = [['margine_veicolo', 'var(--mix-auto)'], ['margine_fin', 'var(--mix-fin)'], ['margine_ass', 'var(--mix-ass)']];
  $('#q-tot-bar').replaceChildren(...(vuotoK ? [] : parti.filter(([c]) => k[c] > 0).map(([c, col]) => { const s = el('span'); s.style.flex = `${k[c]} 1 0`; s.style.background = col; return s; })));
  righe($('#q-tot-rows'), vuotoK ? [] : [
    ['Dalle auto', eur(k.margine_veicolo), k.margine_veicolo < 0 ? 'cv-neg' : ''],
    ['Dai finanziamenti', eur(k.margine_fin)],
    ['Dalle assicurazioni', eur(k.margine_ass)],
    ['Per auto venduta', eur(k.margine_medio), 'cv-tot'],
  ]);
}

/* ---------- 2. Da controllare ---------- */
function avvisi(k, mappe, p) {
  const voci = [];
  const voce = (liv, titolo, testo, azione, fn) => voci.push({ liv, titolo, testo, azione, fn });
  const etichetta = p.vista === 'giorno' ? 'Di solito sono il ' : `A ${mesePrima(params().giorno || GIORNI[GIORNI.length - 1])} erano il `;

  // Auto vendute sotto costo
  if (k && k.vetture && k.neg_veicolo > 0) {
    voce('bad', `${num(k.neg_veicolo)} ${k.neg_veicolo === 1 ? 'auto venduta' : 'auto vendute'} sotto costo`,
      [txt(k.neg_veicolo === 1 ? 'Ha perso ' : 'Insieme hanno perso '), b(eur(Math.abs(k.perdita_neg))), txt(', prima di finanziamenti e assicurazioni.')],
      'Vedi quali', () => { stato.soloNeg = true; vai('vendite', '#card-contratti'); });
  } else if (k && k.vetture) {
    voce('ok', 'Nessuna auto venduta sotto costo', [txt('Tutte le auto del periodo hanno un margine positivo.')], 'Vedi i contratti', () => vai('vendite', '#card-contratti'));
  }

  // Usato fermo (situazione ad oggi)
  const o90 = mappe.usato.get(`${p.brand}|Oltre 90 giorni`), o60 = mappe.usato.get(`${p.brand}|61–90 giorni`);
  if (o90 && o90.permute > 0) {
    const testo = [txt(o90.permute === 1 ? 'Ti è già costato ' : 'Ti sono già costati '), b(eur(o90.interessi_passivi)), txt(' di interessi.')];
    if (o60 && o60.permute) testo.push(txt(' Altri '), b(num(o60.permute)), txt(' sono fermi da più di 2 mesi.'));
    voce('bad', `${num(o90.permute)} ${o90.permute === 1 ? 'usato fermo' : 'usati fermi'} da più di 3 mesi`, testo, 'Vedi l\'usato', () => vai('usato', '#card-stock'));
  } else if (o60 && o60.permute > 0) {
    voce('warn', `${num(o60.permute)} ${o60.permute === 1 ? 'usato fermo' : 'usati fermi'} da più di 2 mesi`,
      [txt('Interessi già pagati: '), b(eur(o60.interessi_passivi)), txt('. Meglio venderli prima dei 3 mesi.')], 'Vedi l\'usato', () => vai('usato', '#card-stock'));
  } else {
    voce('ok', 'Nessun usato fermo da più di 2 mesi', [txt('Il piazzale gira bene.')], 'Vedi l\'usato', () => vai('usato', '#card-stock'));
  }

  // Finanziamenti e assicurazioni: solo se sotto il solito
  if (k && k.vetture && !vuoto(k.ref_pen_fin) && k.pen_fin < k.ref_pen_fin - 0.03) {
    voce('warn', 'Meno finanziamenti del solito', [txt(`${num(k.fin_n)} auto su ${num(k.vetture)}. ${etichetta}`), b(pct(k.ref_pen_fin)), txt('.')], 'Vedi i finanziamenti', () => vai('fi', '#card-finanziamenti'));
  }
  if (k && k.vetture && !vuoto(k.ref_pen_ass) && k.pen_ass < k.ref_pen_ass - 0.03) {
    voce('warn', 'Meno assicurazioni del solito', [txt(`${num(k.ass_n)} auto su ${num(k.vetture)}. ${etichetta}`), b(pct(k.ref_pen_ass)), txt('.')], 'Vedi le assicurazioni', () => vai('fi', '#card-assicurazioni'));
  }

  const icone = { bad: '!', warn: '!', ok: '✓', neutro: '–' };
  $('#avvisi').replaceChildren(...voci.map((v) => {
    const li = el('li', `cv-todo-item cv-liv-${v.liv}`);
    const corpo = el('div');
    corpo.append(el('p', 'cv-todo-title', v.titolo));
    if (v.testo.length) { const t = el('p', 'cv-todo-text'); t.append(...v.testo); corpo.append(t); }
    const bt = el('button', 'cv-todo-btn', v.azione); bt.type = 'button'; bt.addEventListener('click', v.fn);
    corpo.append(bt);
    li.append(el('span', 'cv-todo-icon', icone[v.liv]), corpo);
    return li;
  }));
}

/* ---------- Tutti i passaggi del margine ---------- */
function cascata(box, k, anima) {
  box.querySelectorAll('svg').forEach((s) => s.remove());
  const W = box.clientWidth; if (!W || !k) return;
  const passi = [
    { nome: "Listino meno costo d'acquisto", v: k.margine_listino, spiega: "Prezzo di listino meno quello che paghi al brand" },
    { nome: 'Sconti ai clienti', v: -k.sconti, spiega: 'Sconti concessi in trattativa' },
    { nome: 'Contributi del brand', v: k.campagne, spiega: 'Quello che il brand ti riconosce sulle campagne' },
    { nome: 'Bonus del brand', v: k.bonus, spiega: 'Premi a obiettivo e altri bonus' },
    { nome: 'Preparazione e trasporto', v: -k.costi, spiega: "Costi per rendere l'auto pronta alla consegna" },
    { nome: 'Margine sulle auto', tot: k.margine_veicolo },
    { nome: 'Finanziamenti', v: k.margine_fin, spiega: 'Provvigioni e premi della finanziaria, meno la parte del venditore' },
    { nome: 'Assicurazioni', v: k.margine_ass, spiega: 'Provvigioni e premi della compagnia, meno la parte del venditore' },
    { nome: 'Margine totale', tot: k.margine_totale },
  ];
  let corsa = 0;
  passi.forEach((p) => {
    if (p.tot !== undefined) { p.a = 0; p.b = p.tot; corsa = p.tot; } else { p.a = corsa; p.b = corsa + p.v; corsa = p.b; }
  });
  const rh = 32, H = passi.length * rh + 6;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const misura = (testi, peso) => {
    const t = svg.append('g').style('font-size', '13px').style('font-weight', peso || null);
    const w = d3.max(testi, (s) => t.append('text').text(s).node().getComputedTextLength());
    t.remove(); return w;
  };
  const etichetta = (p) => (p.tot !== undefined ? eur(p.tot) : segno(p.v, fEur.format));
  const lw = Math.min(W * 0.42, misura(passi.map((p) => p.nome), 600) + 12);
  const vw = misura(passi.map(etichetta), 600) + 10;
  const lo = Math.min(0, d3.min(passi, (p) => Math.min(p.a, p.b)));
  const hi = Math.max(0, d3.max(passi, (p) => Math.max(p.a, p.b)));
  const x = d3.scaleLinear([lo, hi || 1], [lw, Math.max(lw + 40, W - vw)]);
  svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', H).style('stroke', 'var(--cds-chart-axis)');
  const tip = tooltip(box);
  passi.forEach((p, i) => {
    const y = i * rh + 4, bh = 20;
    const g = svg.append('g');
    const tot = p.tot !== undefined;
    g.append('text').attr('x', 0).attr('y', y + bh / 2).attr('dy', '0.35em').style('font-size', '13px')
      .style('font-weight', tot ? 600 : null).style('fill', tot ? 'var(--color-fg)' : 'var(--color-fg-muted)').text(p.nome);
    const fill = tot ? 'var(--color-fg)' : p.v >= 0 ? 'color-mix(in srgb, var(--color-ok) 72%, var(--color-panel))' : 'color-mix(in srgb, var(--color-bad) 72%, var(--color-panel))';
    const x0 = x(Math.min(p.a, p.b)), x1 = x(Math.max(p.a, p.b));
    const barra = g.append('rect').attr('y', y).attr('height', bh).attr('rx', 4).style('fill', fill);
    const valore = g.append('text').attr('x', x1 + 6).attr('y', y + bh / 2).attr('dy', '0.35em').style('font-size', '13px')
      .style('font-weight', tot ? 600 : null).style('fill', 'var(--color-fg)').text(etichetta(p));
    const larga = Math.max(1.5, x1 - x0);
    if (anima) {
      const parteDa = p.v !== undefined && p.v < 0 ? x1 : x0;
      barra.attr('x', parteDa).attr('width', 0).transition().delay(i * 70).duration(380).ease(d3.easeCubicOut).attr('x', x0).attr('width', larga);
      valore.style('opacity', 0).transition().delay(i * 70 + 240).duration(220).style('opacity', 1);
    } else {
      barra.attr('x', x0).attr('width', larga);
    }
    if (i < passi.length - 1 && !(passi[i + 1].tot !== undefined)) {
      svg.append('line').attr('x1', x(p.b)).attr('x2', x(p.b)).attr('y1', y + bh).attr('y2', y + rh).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '2 2');
    }
    g.append('rect').attr('x', 0).attr('y', y - 5).attr('width', W).attr('height', rh).style('fill', 'transparent')
      .on('mousemove', (ev) => {
        tip.replaceChildren(el('div', 'cv-tip-h', p.nome), rigaTip(null, tot ? 'Totale' : 'Effetto', etichetta(p)));
        if (p.spiega) tip.append(el('div', 'cv-tip-h', p.spiega));
        const [mx, my] = d3.pointer(ev, box); mostraTip(box, tip, mx, my);
      })
      .on('mouseleave', () => { tip.hidden = true; });
  });
}

/* ---------- Obiettivo del mese ---------- */
// Giorni di apertura: dal lunedì al sabato.
const aperto = (d) => d.getUTCDay() !== 0;
const giorniApertura = (giorno) => {
  const [y, m, g] = giorno.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let fatti = 0, totali = 0;
  for (let i = 1; i <= ultimo; i++) {
    if (!aperto(new Date(Date.UTC(y, m - 1, i, 12)))) continue;
    totali++;
    if (i <= g) fatti++;
  }
  return { fatti, totali, restanti: totali - fatti };
};
const chiaveObiettivo = (giorno, brand, misura) => `cruscotto-obiettivo|${giorno.slice(0, 7)}|${brand}|${misura}`;
const leggiObiettivo = (k) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : null; } catch (e) { return null; } };
const scriviObiettivo = (k, v) => { try { if (v) localStorage.setItem(k, String(v)); else localStorage.removeItem(k); } catch (e) { /* archivio non disponibile */ } };

// Obiettivo del mese del giorno scelto: quello impostato dal concessionario, altrimenti il mese prima più il 5%.
function metaDelMese(mappaKpi, giorno, brand, misura) {
  const auto = misura === 'vetture';
  const [y, m] = giorno.split('-').map(Number);
  const prefPrec = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const ultimoPrec = GIORNI.filter((d) => d.startsWith(prefPrec)).pop();
  const fatto = Number(mappaKpi.get(`mtd|${giorno}|${brand}`)?.[misura]) || 0;
  const prec = ultimoPrec ? Number(mappaKpi.get(`mtd|${ultimoPrec}|${brand}`)?.[misura]) || 0 : 0;
  const suggerito = prec > 0 ? (auto ? Math.ceil(prec * 1.05) : Math.round((prec * 1.05) / 1000) * 1000) : null;
  const chiave = chiaveObiettivo(giorno, brand, misura);
  const scelto = leggiObiettivo(chiave);
  return { fatto, suggerito, chiave, scelto, meta: scelto || suggerito };
}

function obiettivo(mappaKpi, giorno, brand, misura) {
  const auto = misura === 'vetture';
  const f = auto ? (v) => `${num(Math.round(v))} auto` : eur;
  const mese = fMese.format(aData(giorno));
  const { fatto, suggerito, chiave, scelto, meta } = metaDelMese(mappaKpi, giorno, brand, misura);

  $('#titolo-obiettivo').textContent = `Obiettivo di ${mese}${brand === 'Tutti' ? '' : ` · ${brand}`}`;
  $('#goal-input-label').textContent = `Obiettivo di ${mese} (${auto ? 'auto vendute' : 'margine in euro'})`;
  $('#goal-nota').textContent = scelto ? 'Obiettivo impostato da te.'
    : suggerito ? `Obiettivo suggerito: ${auto ? 'auto vendute' : 'margine'} di ${mesePrima(giorno)} più il 5%.` : '';
  $('#goal-reset').hidden = !scelto;
  const form = $('#goal-form');
  form.dataset.chiave = chiave;
  if (form.hidden) $('#goal-input').value = meta || '';

  if (!meta) {
    $('#goal-fatto').textContent = f(fatto);
    $('#goal-su').textContent = `da inizio ${mese}`;
    $('#goal-fill').style.width = '0%';
    $('#goal-mark').hidden = true;
    $('#goal-msg').replaceChildren(txt('Imposta un obiettivo per vedere a che punto sei.'));
    $('#goal-msg').className = 'cv-goal-msg';
    $('#goal-stats').replaceChildren();
    return;
  }

  const g = giorniApertura(giorno);
  const atteso = g.totali ? g.fatti / g.totali : 0;
  const quota = fatto / meta;
  const mancano = Math.max(0, meta - fatto);

  $('#goal-fatto').textContent = f(fatto);
  $('#goal-su').textContent = `su ${f(meta)} · ${pct(quota)}`;
  const fill = $('#goal-fill');
  const larg = `${Math.min(100, quota * 100).toFixed(1)}%`;
  if (!fill.style.width && !RIDOTTO) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = larg; }));
  else fill.style.width = larg;
  const mark = $('#goal-mark');
  mark.hidden = false;
  mark.style.left = `${Math.min(100, atteso * 100).toFixed(1)}%`;
  mark.classList.toggle('cv-goal-mark-fine', atteso > 0.75);
  mark.classList.toggle('cv-goal-mark-inizio', atteso < 0.25);

  // Messaggio: avanti, in linea o indietro rispetto a dove dovresti essere oggi
  const msg = $('#goal-msg');
  const qui = [txt(', a questo punto del mese serviva il '), b(pct(atteso)), txt('.')];
  if (quota >= 1) {
    msg.className = 'cv-goal-msg cv-goal-ok';
    msg.replaceChildren(b('Obiettivo raggiunto'), txt(`: ${f(fatto - meta)} oltre l'obiettivo.`));
  } else if (quota >= atteso + 0.03) {
    msg.className = 'cv-goal-msg cv-goal-ok';
    msg.replaceChildren(b('Sei avanti.'), txt(' Hai fatto il '), b(pct(quota)), txt(" dell'obiettivo"), ...qui);
  } else if (quota >= atteso - 0.03) {
    msg.className = 'cv-goal-msg';
    msg.replaceChildren(b('Sei in linea.'), txt(' Hai fatto il '), b(pct(quota)), txt(" dell'obiettivo"), ...qui);
  } else {
    msg.className = 'cv-goal-msg cv-goal-warn';
    msg.replaceChildren(b('Sei indietro.'), txt(' Hai fatto il '), b(pct(quota)), txt(" dell'obiettivo"), ...qui);
  }

  const alGiorno = g.restanti ? mancano / g.restanti : null;
  $('#goal-stats').replaceChildren(...[
    ['Fatto', f(fatto)],
    ['Mancano', quota >= 1 ? '—' : f(mancano)],
    ['Giorni di apertura rimasti', num(g.restanti)],
    ['Servono al giorno', quota >= 1 || vuoto(alGiorno) ? '—' : auto ? `${fNum.format(Math.round(alGiorno * 10) / 10)} auto` : eur(alGiorno)],
  ].map(([t, v]) => { const d = el('div'); d.append(el('dt', '', t), el('dd', '', v)); return d; }));
}

// Cambia obiettivo
$('#goal-modifica').addEventListener('click', () => {
  const form = $('#goal-form');
  form.hidden = !form.hidden;
  $('#goal-modifica').setAttribute('aria-expanded', String(!form.hidden));
  if (!form.hidden) $('#goal-input').focus();
});
$('#goal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = Math.round(Number($('#goal-input').value));
  if (!(v > 0)) { $('#goal-input').setCustomValidity('Scrivi un numero maggiore di zero'); $('#goal-input').reportValidity(); return; }
  scriviObiettivo(e.target.dataset.chiave, v);
  e.target.hidden = true;
  $('#goal-modifica').setAttribute('aria-expanded', 'false');
  disegna();
});
$('#goal-input').addEventListener('input', (e) => e.target.setCustomValidity(''));
$('#goal-reset').addEventListener('click', () => {
  scriviObiettivo($('#goal-form').dataset.chiave, null);
  $('#goal-form').hidden = true;
  $('#goal-modifica').setAttribute('aria-expanded', 'false');
  disegna();
});

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
  // Collegamento con l'obiettivo del mese scelto
  sim.meta = metaDelMese(mappaKpi, giorno, brand, 'margine_totale').meta;
  sim.meseMeta = fMese.format(aData(giorno));
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
  const fid = (x) => (x >= 30 ? 'alta' : x >= 10 ? 'media' : 'bassa');
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
  const quotaMargine = (r) => r.margine_veicolo / (n(r, 'prezzo_listino') || 1);
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
        codice: 'SCO-01', tipo: 'Fuori dalla norma', titolo: `${v} concede più sconto dei colleghi${su(br)}`,
        valore: (M.sc - A.sc) * M.L * alMese, fid: affid(zSc, mie.length),
        perche: [txt('In media il '), b(pp(M.sc)), txt(` del listino, contro il ${pp(A.sc)} degli altri venditori ${br}, su ${num(mie.length)} auto. Ogni punto di sconto in più esce direttamente dal margine.`)],
        azione: `Rivedi con ${v} le ultime trattative e fissa un tetto di sconto oltre il quale serve la tua approvazione.`,
        leva: { k: 'sconto', d: -(M.sc - A.sc) * (M.L / C.L) },
      });
      if (A.pf - M.pf >= 0.12 && zFin >= Z_MIN && Q.mf > 0) segnali.push({
        codice: 'FIN-02', tipo: 'Fuori dalla norma', titolo: `${v} propone meno finanziamenti${su(br)}`,
        valore: mie.length * (A.pf - M.pf) * Q.mf * alMese, fid: affid(zFin, mie.length),
        perche: [txt('Il '), b(pct(M.pf)), txt(` delle sue auto ${br} ha un finanziamento, contro il ${pct(A.pf)} dei colleghi. Ogni finanziamento vale in media ${eur(Q.mf)} di margine.`)],
        azione: `Affianca ${v} in qualche trattativa: il finanziamento va proposto prima di chiudere sul prezzo, non dopo.`,
        leva: { k: 'pf', d: (A.pf - M.pf) * (mie.length / C.N) },
      });
      if (A.pa - M.pa >= 0.12 && zAss >= Z_MIN && Q.ma > 0) segnali.push({
        codice: 'ASS-02', tipo: 'Fuori dalla norma', titolo: `${v} propone meno assicurazioni${su(br)}`,
        valore: mie.length * (A.pa - M.pa) * Q.ma * alMese, fid: affid(zAss, mie.length),
        perche: [txt('Il '), b(pct(M.pa)), txt(` delle sue auto ${br} esce con una polizza, contro il ${pct(A.pa)} dei colleghi. Ogni polizza vale in media ${eur(Q.ma)} di margine.`)],
        azione: `Controlla con ${v} come presenta le polizze: meglio dentro la rata che come voce a parte.`,
        leva: { k: 'pa', d: (A.pa - M.pa) * (mie.length / C.N) },
      });
    });
  });

  // Peggioramenti rispetto al periodo precedente, marchio per marchio (almeno 10 auto in entrambi i periodi)
  if (per.ref) marchi.forEach((br) => {
    const qui = cur.filter((r) => r.brand === br), prima = ref.filter((r) => r.brand === br);
    if (qui.length < 10 || prima.length < 10) return;
    const Q = conti(qui), P = conti(prima);
    const zSc = zMedie(qui, prima, quotaSconto);
    const zFin = zQuote(P.pf * P.N, P.N, Q.pf * Q.N, Q.N), zAss = zQuote(P.pa * P.N, P.N, Q.pa * Q.N, Q.N);
    const zResa = zMedie(prima.filter((r) => r.finanziamento === 'Sì'), qui.filter((r) => r.finanziamento === 'Sì'), (r) => r.margine_fin);
    if (Q.sc - P.sc >= 0.005 && zSc >= Z_MIN) segnali.push({
      codice: 'SCO-02', tipo: 'Peggioramento', titolo: `Lo sconto medio è salito${su(br)}`,
      valore: (Q.sc - P.sc) * Q.L * alMese, fid: affid(zSc, Q.N),
      perche: [txt('Dal '), b(pp(P.sc)), txt(' al '), b(pp(Q.sc)), txt(` del listino ${per.ref.rispetto}, su ${num(Q.N)} auto ${br}.`)],
      azione: 'Guarda se è salito su pochi modelli o su tutti: nel primo caso è un problema di stock da smaltire, nel secondo di trattativa.',
      leva: { k: 'sconto', d: -(Q.sc - P.sc) * (Q.L / C.L) },
    });
    if (P.pf - Q.pf >= 0.04 && zFin >= Z_MIN && Q.mf > 0) segnali.push({
      codice: 'FIN-01', tipo: 'Peggioramento', titolo: `Meno auto vendute con un finanziamento${su(br)}`,
      valore: Q.N * (P.pf - Q.pf) * Q.mf * alMese, fid: affid(zFin, Q.N),
      perche: [txt('Dal '), b(pct(P.pf)), txt(' al '), b(pct(Q.pf)), txt(` delle auto ${br} ${per.ref.rispetto}. Ogni finanziamento vale in media ${eur(Q.mf)} di margine.`)],
      azione: 'Verifica se sono cambiate le condizioni della finanziaria del marchio (tassi, campagne) o il modo in cui il team propone il finanziamento.',
      leva: { k: 'pf', d: (P.pf - Q.pf) * (Q.N / C.N) },
    });
    if (P.pa - Q.pa >= 0.04 && zAss >= Z_MIN && Q.ma > 0) segnali.push({
      codice: 'ASS-01', tipo: 'Peggioramento', titolo: `Meno auto vendute con una polizza${su(br)}`,
      valore: Q.N * (P.pa - Q.pa) * Q.ma * alMese, fid: affid(zAss, Q.N),
      perche: [txt('Dal '), b(pct(P.pa)), txt(' al '), b(pct(Q.pa)), txt(` delle auto ${br} ${per.ref.rispetto}. Ogni polizza vale in media ${eur(Q.ma)} di margine.`)],
      azione: 'Spesso le polizze calano insieme ai finanziamenti: controlla prima quelli.',
      leva: { k: 'pa', d: (P.pa - Q.pa) * (Q.N / C.N) },
    });
    if (Q.nf >= 10 && P.nf >= 10 && P.mf - Q.mf >= P.mf * 0.1 && zResa >= Z_MIN) segnali.push({
      codice: 'FIN-03', tipo: 'Peggioramento', titolo: `Ogni finanziamento rende meno${su(br)}`,
      valore: (P.mf - Q.mf) * Q.nf * alMese, fid: affid(zResa, Q.nf),
      perche: [txt('In media '), b(eur(Q.mf)), txt(` di margine per finanziamento, contro ${eur(P.mf)} nel periodo di confronto (${per.ref.nome}).`)],
      azione: 'Confronta provvigioni e premi delle finanziarie con cui lavori: conviene spostare i volumi su quella che rende di più a parità di tasso per il cliente.',
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

  // Combinazione che costa: sconto tra i più alti e nessun finanziamento a recuperarlo
  if (cur.length >= 12) {
    const quote = cur.map((r) => n(r, 'sconto') / (n(r, 'prezzo_listino') || 1)).sort((a, c) => a - c);
    const q75 = d3.quantile(quote, 0.75), med = d3.quantile(quote, 0.5);
    const combo = cur.filter((r) => n(r, 'sconto') / (n(r, 'prezzo_listino') || 1) > q75 && r.finanziamento !== 'Sì');
    if (combo.length >= 3) {
      const extra = somma(combo, (r) => n(r, 'sconto') - n(r, 'prezzo_listino') * med);
      segnali.push({
        codice: 'COM-01', tipo: 'Combinazione che costa', titolo: 'Sconti alti senza finanziamento',
        valore: extra * alMese, fid: fid(combo.length),
        perche: [b(`${num(combo.length)} auto`), txt(` hanno avuto uno sconto tra i più alti (oltre il ${pp(q75)} del listino) senza un finanziamento che lo recuperasse. Lo sconto in più rispetto alla media vale ${eur(extra)}.`)],
        azione: 'Lega lo sconto extra al finanziamento: sopra una soglia, lo sconto si concede solo con una pratica.',
        leva: { k: 'pf', d: combo.length / C.N },
      });
    }
  }

  // Fuori dalla norma: un modello che rende molto meno del resto del suo marchio.
  // Il confronto è in percentuale del listino: in euro un'auto più economica rende sempre meno, anche quando va bene.
  [...new Set(cur.map((r) => `${r.brand}|${r.modello}`))].forEach((chiave) => {
    const [br, mod] = chiave.split('|');
    const qui = cur.filter((r) => r.brand === br && r.modello === mod), resto = cur.filter((r) => r.brand === br && r.modello !== mod);
    if (qui.length < 6 || resto.length < 8) return;
    const sulListino = (xs) => somma(xs, (r) => r.margine_veicolo) / (somma(xs, (r) => n(r, 'prezzo_listino')) || 1);
    const qQui = sulListino(qui), qResto = sulListino(resto);
    const zMod = zMedie(resto, qui, quotaMargine);
    if (qResto > 0 && qQui < qResto * 0.5 && zMod >= Z_MIN) segnali.push({
      codice: 'MOD-01', tipo: 'Fuori dalla norma', titolo: `${mod}: margine molto sotto il resto di ${br}`,
      valore: (qResto - qQui) * somma(qui, (r) => n(r, 'prezzo_listino')) * alMese, fid: affid(zMod, qui.length),
      perche: [txt('Sulla vendita resta il '), b(pp(qQui)), txt(` del listino, contro il ${pp(qResto)} degli altri modelli ${br}, su ${num(qui.length)} auto.`)],
      azione: "Controlla prezzo d'acquisto, campagne del brand e sconti su questo modello. Se il margine non torna, spingi i modelli che rendono di più.",
    });
  });

  // Accumulo: usato fermo da più di 2 mesi (situazione ad oggi, non dipende dal periodo)
  const fermi = righe.filter((r) => delBrand(r) && r.permuta_stato === 'In stock' && n(r, 'permuta_giorni_giacenza') > 60);
  if (fermi.length) {
    const alGiorno = somma(fermi, (r) => n(r, 'permuta_interessi_passivi') / (n(r, 'permuta_giorni_giacenza') || 1));
    segnali.push({
      codice: 'USA-01', tipo: 'Accumulo', titolo: `${num(fermi.length)} ${fermi.length === 1 ? 'usato fermo' : 'usati fermi'} da più di 2 mesi`,
      valore: alGiorno * 30.4, fid: fid(fermi.length),
      perche: [txt('Ogni mese costano circa '), b(eur(alGiorno * 30.4)), txt(' di interessi, e intanto perdono valore. Situazione ad oggi, qualunque sia il periodo scelto.')],
      azione: 'Dai a ciascuno una data limite: se a 90 giorni non è venduto, va a un commerciante anche a un prezzo più basso.',
      leva: { k: 'g', d: -15 },
    });
  }

  // Rischi: non tolgono margine oggi, ma lo rendono fragile
  if (C.brandPaga > 0 && C.brandPaga >= C.mv) rischi.push({ codice: 'CON-01', testo: [txt('Senza contributi e bonus del brand, la vendita delle auto sarebbe in perdita: valgono '), b(eur(C.brandPaga)), txt(`, più di tutto il margine sulle auto (${eur(C.mv)}). Se la casa riduce le campagne, il margine sparisce.`)] });
  else if (C.mv > 0 && C.brandPaga / C.mv > 0.6) rischi.push({ codice: 'CON-01', testo: [txt('Il '), b(pct(C.brandPaga / C.mv)), txt(' del margine sulle auto viene da contributi e bonus del brand: se la casa riduce le campagne, il margine si assottiglia subito.')] });
  if (brand === 'Tutti' && C.mt > 0) BRANDS.forEach((br) => {
    const q = somma(cur.filter((r) => r.brand === br), (r) => r.margine_totale) / C.mt;
    if (q > 0.55) rischi.push({ codice: 'CON-02', testo: [txt('Il '), b(pct(q)), txt(` del margine viene da ${br}: un cambio di condizioni di un solo marchio pesa su tutto.`)] });
  });
  if (C.mt > 0) [...new Set(cur.map((r) => r.venditore))].forEach((v) => {
    const q = somma(cur.filter((r) => r.venditore === v), (r) => r.margine_totale) / C.mt;
    if (q > 0.4) rischi.push({ codice: 'CON-03', testo: [txt('Il '), b(pct(q)), txt(` del margine passa da ${v}: se manca, manca una parte importante del mese.`)] });
  });

  const limiti = [
    'Non ho i dati delle auto nuove in piazzale: il loro costo di giacenza non è incluso.',
    'Non conosco i costi fissi (personale, affitto, energia): parlo di margine, non di utile.',
    'I valori sono stime al mese e in parte si sovrappongono: non vanno sommati come se fossero indipendenti.',
    'Segnalo solo le differenze troppo grandi per essere un caso: con poche auto, una differenza reale può non comparire.',
  ];
  if (!R) limiti.unshift('Non ci sono dati sul periodo precedente: ho confrontato solo venditori e modelli tra loro.');
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

function analisi(contratti, marg, brand) {
  const periodi = periodiDisponibili();
  const sel = $('#an-periodo');
  if (sel.options.length !== periodi.length) sel.replaceChildren(...periodi.map((x) => new Option(x.nome, x.id)));
  if (!periodi.some((x) => x.id === an.periodo)) an.periodo = (periodi.find((x) => x.id.startsWith('m|') && !x.parziale) || periodi[0]).id;
  sel.value = an.periodo;
  const per = periodi.find((x) => x.id === an.periodo);
  $('#an-confronto').textContent = per.ref ? `Confronto con ${per.ref.nome}.` : 'Nessun periodo precedente nei dati da confrontare.';
  $('#an-esito').hidden = !an.attiva;
  if (!an.attiva) return;

  const righeTutte = contratti.map((r) => ({ ...r, ...(marg.get(r.contratto) || {}) }));
  const { C, R, segnali, rischi, limiti } = analizzaPeriodo(righeTutte, per, brand);
  const chi = brand === 'Tutti' ? '' : ` · ${brand}`;
  const sint = $('#an-sintesi');
  if (!C.N) {
    sint.replaceChildren(txt(`${per.nome}${chi}: nessuna auto venduta.`));
  } else {
    const top = segnali.slice(0, 3);
    sint.replaceChildren(
      b(`${per.nome}${chi}: `), txt(`${num(C.N)} auto vendute, ${eur(C.mt)} di margine, `), b(`${eur(C.mt / C.N)} per auto`),
      txt(R ? ` (${per.ref.nome}: ${eur(R.mt / R.N)}). ` : '. '),
      ...(segnali.length
        ? [txt(`Ho trovato ${num(segnali.length)} ${segnali.length === 1 ? 'segnale' : 'segnali'} che tolgono margine: ${top.length === 1 ? 'il più importante vale' : `i ${top.length} più importanti valgono`} fino a `), b(`${eur(d3.sum(top, (s) => s.valore))} al mese`), txt('.')]
        : [txt('Nessuno schema supera le soglie: prova un periodo più lungo o un altro marchio.')]));
  }

  // Le tre proposte che valgono di più
  $('#an-proposte').replaceChildren(...(segnali.length ? segnali.slice(0, 3).map((s, i) => {
    const card = el('article', 'cv-qcard cv-an-card');
    const testa = el('div', 'cv-an-testa');
    testa.append(el('span', 'cv-an-rank', String(i + 1)), el('span', 'cv-qlabel', s.tipo));
    const valore = el('div', 'cv-an-valore', `+${fEur.format(Math.round(s.valore))}`);
    valore.append(el('small', '', ' al mese'));
    const perche = el('p'); perche.append(...s.perche);
    const azione = el('p'); azione.append(b('Cosa fare: '), txt(s.azione));
    card.append(testa, el('h3', 'cv-an-titolo', s.titolo), valore, perche, azione);
    if (s.leva && sim.base) {
      const bt = el('button', 'cv-todo-btn cv-an-sim', 'Apri nel simulatore'); bt.type = 'button';
      bt.addEventListener('click', () => apriNelSimulatore(s.leva));
      card.append(bt);
    }
    const piede = el('div', 'cv-an-piede');
    piede.append(el('span', '', `Regola ${s.codice}`), el('span', `cv-chip cv-fid-${s.fid}`, `Affidabilità ${s.fid}`));
    card.append(piede);
    return card;
  }) : [el('p', 'cv-an-vuoto', 'Nessuna proposta per questo periodo.')]));

  // Gli altri segnali e i rischi
  const altri = segnali.slice(3);
  $('#an-altri').hidden = !altri.length;
  $('#an-altri-titolo').textContent = `Altri segnali (${num(altri.length)})`;
  $('#an-altri-lista').replaceChildren(...altri.map((s) => {
    const li = el('li'); const sx = el('div');
    sx.append(txt(s.titolo), el('span', 'cv-sub', `${s.tipo} · regola ${s.codice} · affidabilità ${s.fid}`));
    li.append(sx, b(`+${fEur.format(Math.round(s.valore))} al mese`));
    return li;
  }));
  $('#an-rischi').hidden = !rischi.length;
  $('#an-rischi-titolo').textContent = `Rischi da tenere d'occhio (${num(rischi.length)})`;
  $('#an-rischi-lista').replaceChildren(...rischi.map((r) => {
    const li = el('li'); const sx = el('div');
    sx.append(...r.testo, el('span', 'cv-sub', `Regola ${r.codice}`));
    li.append(sx);
    return li;
  }));
  $('#an-limiti').replaceChildren(...limiti.map((t) => el('li', '', t)));
}
$('#an-periodo').addEventListener('change', (e) => { an.periodo = e.target.value; disegna(); });
$('#an-vai').addEventListener('click', () => { an.attiva = true; disegna(); });

/* ---------- Dettaglio contratto ---------- */
const GRUPPI = [
  { titolo: 'Vendita', voci: [['Data', 'data', 'data'], ['Brand', 'brand'], ['Modello', 'modello'], ['Alimentazione', 'alimentazione'], ['Venditore', 'venditore'], ['Prezzo di listino', 'prezzo_listino', 'eur'], ['Sconto', 'sconto', 'eur'], ['Contributo del brand', 'campagna_brand', 'eur'], ['Bonus del brand', 'altri_bonus_brand', 'eur'], ["Costo d'acquisto", 'costo_acquisto', 'eur']] },
  { titolo: "Costi dell'auto", voci: [['Preparazione', 'costo_preparazione', 'eur'], ['Trasporto', 'costo_trasporto', 'eur']] },
  { titolo: 'Permuta', se: 'permuta', voci: [['Auto', 'permuta_modello'], ['Entrata il', 'permuta_data_giacenza', 'data'], ['Ferma da', 'permuta_giorni_giacenza', 'giorni'], ['Valutazione', 'permuta_valutazione', 'eur'], ['Valore in piazzale', 'permuta_costo_stock', 'eur'], ['Interessi pagati', 'permuta_interessi_passivi', 'eur2'], ['Stato', 'permuta_stato']] },
  { titolo: 'Finanziamento', se: 'finanziamento', voci: [['Tipo', 'fin_tipo'], ['Importo finanziato', 'fin_importo', 'eur'], ['Tasso (TAN)', 'fin_tasso', 'tan'], ['Provvigione', 'fin_provvigione', 'eur'], ['Premio della finanziaria', 'fin_rappel', 'eur'], ['Al venditore', 'fin_provvigione_venditore', 'eur']] },
  { titolo: 'Assicurazione', se: 'assicurazione', voci: [['Tipo', 'ass_tipo'], ['Premio', 'ass_importo', 'eur'], ['Provvigione', 'ass_provvigione', 'eur'], ['Premio della compagnia', 'ass_rappel', 'eur'], ['Al venditore', 'ass_provvigione_venditore', 'eur']] },
];
const formatta = (v, f) => (f === 'data' ? (v ? fNumData.format(aData(v)) : '—') : f === 'tan' ? (vuoto(v) ? 'n.d.' : `${fNum.format(Number(v))}%`) : f ? FMT[f](v) : v || '—');
function dettaglio(c, m) {
  const box = $('#dettaglio');
  if (!c || !m) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  const testa = el('div', 'cv-detail-head');
  testa.append(el('h4', '', `${c.contratto} · ${c.brand} ${c.modello}`));
  const chiudi = el('button', 'cv-ghost', 'Chiudi');
  chiudi.addEventListener('click', () => { stato.scelto = null; disegna(); });
  testa.append(chiudi);
  const griglia = el('div', 'cv-detail-grid');
  const where = `contratto=${enc(c.contratto)}`;
  const sm = el('div', 'cv-group');
  sm.append(el('h5', '', 'Margine del contratto'));
  const dlm = el('dl', 'cv-tot');
  [['Incasso auto (IVA esclusa)', 'ricavo_netto'], ['Margine sulla vendita', 'margine_veicolo'], ['Margine finanziamento', 'margine_fin'], ['Margine assicurazione', 'margine_ass'], ['Margine totale', 'margine_totale']].forEach(([etich, campo]) => {
    const dd = el('dd', Number(m[campo]) < 0 ? 'cv-neg' : '', eur(m[campo]));
    dd.dataset.source = 'margini'; dd.dataset.field = campo; dd.dataset.where = where;
    dlm.append(el('dt', '', etich), dd);
  });
  sm.append(dlm); griglia.append(sm);
  GRUPPI.forEach((g) => {
    const sez = el('div', 'cv-group');
    sez.append(el('h5', '', g.titolo));
    if (g.se && c[g.se] !== 'Sì') { sez.append(el('p', '', g.se === 'permuta' ? 'Nessuna permuta' : g.se === 'finanziamento' ? 'Pagata senza finanziamento' : 'Nessuna polizza')); griglia.append(sez); return; }
    const dl = el('dl');
    g.voci.forEach(([etich, campo, f]) => {
      const dd = el('dd', '', formatta(c[campo], f));
      dd.dataset.source = 'contratti'; dd.dataset.field = campo; dd.dataset.where = where;
      dl.append(el('dt', '', etich), dd);
    });
    sez.append(dl); griglia.append(sez);
  });
  box.replaceChildren(testa, griglia);
}

/* ---------- Disegno ---------- */
const riempiTile = (root, mappe, chiavi) => {
  root.querySelectorAll('[data-fmt]').forEach((n) => {
    const src = n.dataset.source;
    const chiave = src === 'kpi' ? chiavi.kpi : src === 'fi_mix' ? `${chiavi.fi}|${n.dataset.ambito}|Totale` : `${chiavi.usato}|${n.dataset.fascia}`;
    const riga = mappe[src]?.get(chiave);
    n.dataset.where = `chiave=${enc(chiave)}`;
    if (!riga) { n.textContent = '—'; return; }
    n.classList.remove('dash-skeleton');
    const v = riga[n.dataset.field];
    if (vuoto(v)) { n._v = undefined; n.textContent = FMT[n.dataset.fmt](v); return; }
    const f = n.dataset.fmt === 'int' ? (x) => FMT.int(Math.round(x)) : FMT[n.dataset.fmt];
    conta(n, Number(v), f);
  });
};

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
    if (opzioni.dopo) opzioni.dopo(tr, r);
    return tr;
  }));
}

function disegna() {
  const C = dash.data('contratti'), M = dash.data('margini'), K = dash.data('kpi');
  const FI = dash.data('fi_mix'), V = dash.data('venditori'), U = dash.data('usato');
  const p = params();

  $$('#seg-vista button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vista === p.vista)));
  $$('#seg-brand button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.brand === p.brand)));
  $$('#seg-misura button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.misura === stato.misura)));
  $$('.cv-tabs button').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === stato.tab)));

  if (C.status === 'error') return;
  if (C.status !== 'ok') return;
  const contratti = C.data;
  GIORNI = [...new Set(contratti.map((r) => r.data))].sort();
  const giorno = giornoAttivo();
  const iG = GIORNI.indexOf(giorno);
  const selG = $('#sel-giorno');
  if (selG.options.length !== GIORNI.length) selG.replaceChildren(...GIORNI.slice().reverse().map((d) => new Option(maiusc(fSel.format(aData(d)).replace(/\./g, '')), d)));
  selG.value = giorno;
  $('#btn-prev').disabled = iG <= 0;
  $('#btn-next').disabled = iG >= GIORNI.length - 1;

  const nelPeriodo = (r) => (p.vista === 'giorno' ? r.data === giorno : r.data.slice(0, 7) === giorno.slice(0, 7) && r.data <= giorno);
  const chiavi = { kpi: `${p.vista}|${giorno}|${p.brand}`, fi: `${p.vista}|${giorno}|${p.brand}`, usato: p.brand };
  const mappe = {
    kpi: K.status === 'ok' ? new Map(K.data.map((r) => [r.chiave, r])) : new Map(),
    fi_mix: FI.status === 'ok' ? new Map(FI.data.map((r) => [r.chiave, r])) : new Map(),
    usato: U.status === 'ok' ? new Map(U.data.map((r) => [r.chiave, r])) : new Map(),
  };
  const k = mappe.kpi.get(chiavi.kpi);
  if (!(k && k.neg_veicolo > 0)) stato.soloNeg = false;

  // 1–3: risposta, cose da controllare, composizione del margine
  riempiTile(document, mappe, chiavi);
  if (K.status === 'ok') {
    riepilogo(k, p, giorno);
    if (U.status === 'ok') avvisi(k, mappe, p);
    const wf = $('#chart-cascata');
    if ($('#piu-cascata').open && k) { wf.classList.remove('dash-skeleton'); cascata(wf, k, !RIDOTTO && k.chiave !== ultimaCascata); ultimaCascata = k.chiave; }
    obiettivo(mappe.kpi, giorno, p.brand, stato.misura);
    if (M.status === 'ok') {
      const margMap = new Map(M.data.map((r) => [r.contratto, r]));
      simulatore(contratti, margMap, mappe.kpi, giorno, p.brand);
      analisi(contratti, margMap, p.brand);
    }
  }

  // 5: Approfondisci
  if (stato.tab === 'vendite') {
    if (k) {
      const righeBrand = BRANDS.map((x) => mappe.kpi.get(`${p.vista}|${giorno}|${x}`)).filter(Boolean);
      const maxMedio = d3.max(righeBrand, (r) => Math.max(0, r.margine_medio || 0)) || 1;
      tabella($('#tab-brand tbody'), righeBrand, [
        { f: 'brand', render: (td, r) => { const sw = el('i', 'cv-sw'); sw.style.background = colore(r.brand); td.append(sw, txt(` ${r.brand}`)); } },
        { f: 'vetture', num: true, fmt: num },
        { f: 'margine_veicolo', num: true, hide: true, fmt: eur, cls: (r) => (r.margine_veicolo < 0 ? 'cv-neg' : '') },
        { f: 'margine_fi', num: true, hide: true, fmt: eur },
        { f: 'margine_totale', num: true, fmt: eur },
        { f: 'margine_medio', num: true, render: (td, r) => { const w = el('div', 'cv-bar'); const bar = el('i'); bar.style.width = `${Math.round((Math.max(0, r.margine_medio || 0) / maxMedio) * 48)}px`; bar.style.background = colore(r.brand); w.append(bar, el('span', '', eur(r.margine_medio))); td.append(w); } },
      ], (r) => r.chiave, { classe: () => 'cv-click', dopo: (tr, r) => { tr.dataset.brand = r.brand; tr.setAttribute('aria-selected', String(p.brand === r.brand)); } });
      $('#nota-sconto').textContent = vuoto(k.sconto_medio_pct) ? '' : `Sconto medio sul listino: ${fPct1.format(k.sconto_medio_pct)}. Auto ritirate in permuta: ${num(k.permute)}.`;

      const chip = $('#chip-negativi');
      chip.hidden = !(k.neg_veicolo > 0);
      chip.querySelector('[data-field]').textContent = num(k.neg_veicolo);
      $('#chip-negativi-txt').textContent = (k.neg_veicolo === 1 ? 'venduta sotto costo' : 'vendute sotto costo') + (stato.soloNeg ? ' · mostra tutti' : ' · mostra solo queste');
      chip.setAttribute('aria-pressed', String(stato.soloNeg));
    }

    const marg = M.status === 'ok' ? new Map(M.data.map((r) => [r.contratto, r])) : new Map();
    let righe = contratti.filter((r) => nelPeriodo(r) && (p.brand === 'Tutti' || r.brand === p.brand)).map((r) => ({ ...r, ...(marg.get(r.contratto) || {}) }));
    $('#titolo-contratti').textContent = `Contratti · ${righe.length}`;
    if (stato.soloNeg) righe = righe.filter((r) => r.margine_veicolo < 0);
    if (stato.cerca) righe = righe.filter((r) => [r.contratto, r.modello, r.brand, r.venditore, r.permuta_modello, r.fin_tipo, r.ass_tipo].join(' ').toLowerCase().includes(stato.cerca));
    const { k: ok, dir } = stato.ordina;
    const numerico = !['contratto', 'modello', 'venditore'].includes(ok);
    righe.sort((a, c) => (numerico ? (Number(a[ok]) || 0) - (Number(c[ok]) || 0) : String(a[ok] || '').localeCompare(String(c[ok] || ''), 'it')) * dir);
    $$('#tab-contratti th').forEach((th) => { const x = th.querySelector('button'); th.setAttribute('aria-sort', x && x.dataset.sort === ok ? (dir > 0 ? 'ascending' : 'descending') : 'none'); });
    const negCls = (f) => (r) => (Number(r[f]) < 0 ? 'cv-neg' : '');
    tabella($('#tab-contratti tbody'), righe, [
      { f: 'contratto', hide: true, render: (td, r) => { td.append(txt(r.contratto)); if (p.vista === 'mtd') td.append(el('span', 'cv-sub', fNumData.format(aData(r.data)))); } },
      { f: 'modello', render: (td, r) => { td.append(txt(r.modello), el('span', 'cv-sub', `${r.brand} · ${r.alimentazione}`)); } },
      { f: 'venditore', hide: true },
      { f: 'prezzo_listino', num: true, hide: true, fmt: eur },
      { f: 'sconto', num: true, hide: true, render: (td, r) => { td.append(txt(eur(r.sconto)), el('span', 'cv-sub', fPct1.format(Number(r.sconto) / Number(r.prezzo_listino)))); } },
      { f: 'margine_veicolo', num: true, fmt: eur, cls: negCls('margine_veicolo') },
      { f: 'margine_fi', num: true, hide: true, fmt: eur },
      { f: 'margine_totale', num: true, fmt: eur, cls: negCls('margine_totale') },
    ], (r) => r.contratto, {
      vuota: stato.cerca ? 'Nessun contratto corrisponde alla ricerca' : stato.soloNeg ? 'Nessuna auto venduta sotto costo' : 'Nessun contratto nel periodo scelto',
      classe: () => 'cv-click',
      dopo: (tr, r) => { tr.tabIndex = 0; tr.setAttribute('aria-selected', String(stato.scelto === r.contratto)); },
    });
    const scelto = stato.scelto && contratti.find((r) => r.contratto === stato.scelto);
    dettaglio(scelto, scelto && marg.get(scelto.contratto));
  }

  if (stato.tab === 'fi') {
    const fiRighe = (ambito) => (FI.status === 'ok' ? FI.data.filter((r) => r.vista === p.vista && r.periodo === giorno && r.brand === p.brand && r.ambito === ambito && (r.contratti > 0 || r.tipo === 'Totale')) : []);
    const tot = (r) => (r.tipo === 'Totale' ? 'cv-totrow' : '');
    const fin = fiRighe('Finanziamento');
    tabella($('#tab-fin tbody'), fin.length > 1 ? fin : [], [
      { f: 'tipo' }, { f: 'contratti', num: true, fmt: num }, { f: 'importo', num: true, hide: true, fmt: eur },
      { f: 'tasso_medio', num: true, hide: true, fmt: (v) => (vuoto(v) ? 'n.d.' : `${fNum.format(v)}%`) },
      { f: 'provvigioni_rappel', num: true, fmt: eur },
    ], (r) => r.chiave, { classe: tot, vuota: 'Nessun finanziamento nel periodo scelto' });
    const ass = fiRighe('Assicurazione');
    tabella($('#tab-ass tbody'), ass.length > 1 ? ass : [], [
      { f: 'tipo' }, { f: 'contratti', num: true, fmt: num }, { f: 'importo', num: true, hide: true, fmt: eur },
      { f: 'provvigioni_rappel', num: true, fmt: eur },
    ], (r) => r.chiave, { classe: tot, vuota: 'Nessuna polizza nel periodo scelto' });
    const vend = V.status === 'ok' ? V.data.filter((r) => r.vista === p.vista && r.periodo === giorno && r.brand === p.brand).sort((a, c) => c.margine_totale - a.margine_totale) : [];
    tabella($('#tab-venditori tbody'), vend, [
      { f: 'venditore' }, { f: 'vetture', num: true, fmt: num }, { f: 'margine_totale', num: true, fmt: eur },
      { f: 'margine_medio', num: true, hide: true, fmt: eur, cls: (r) => (r.margine_medio < 0 ? 'cv-neg' : '') },
      { f: 'pen_fin', num: true, hide: true, fmt: pct }, { f: 'pen_ass', num: true, hide: true, fmt: pct },
    ], (r) => r.chiave, { vuota: 'Nessun contratto nel periodo scelto' });
  }

  if (stato.tab === 'usato') {
    $('#chip-situazione').textContent = `Situazione al ${fNumData.format(aData(GIORNI[GIORNI.length - 1]))}`;
    const fasce = ['0–30 giorni', '31–60 giorni', '61–90 giorni', 'Oltre 90 giorni'];
    const nomi = ['Meno di 1 mese', '1–2 mesi', '2–3 mesi', 'Più di 3 mesi'];
    const tinte = [18, 42, 70, 100].map((q) => `color-mix(in srgb, var(--color-bad) ${q}%, var(--color-panel))`);
    const righeF = fasce.map((f) => mappe.usato.get(`${p.brand}|${f}`)).filter(Boolean);
    $('#barra-aging').replaceChildren(...righeF.filter((r) => r.permute > 0).map((r) => { const s = el('span'); s.style.flex = `${r.permute} 1 0`; s.style.background = tinte[fasce.indexOf(r.fascia)]; return s; }));
    $('#legenda-aging').replaceChildren(...righeF.map((r) => {
      const i = fasce.indexOf(r.fascia);
      const s = el('span'); const sw = el('i', 'cv-sw'); sw.style.background = tinte[i];
      s.append(sw, txt(`${nomi[i]}: `), b(num(r.permute)), txt(r.interessi_passivi > 0 ? ` · ${eur(r.interessi_passivi)} di interessi` : ''));
      return s;
    }));
    const stock = contratti.filter((r) => r.permuta_stato === 'In stock' && (p.brand === 'Tutti' || r.brand === p.brand))
      .sort((a, c) => Number(c.permuta_giorni_giacenza) - Number(a.permuta_giorni_giacenza));
    tabella($('#tab-stock tbody'), stock, [
      { f: 'permuta_modello', render: (td, r) => { td.append(txt(r.permuta_modello), el('span', 'cv-sub', `permuta di ${r.contratto}`)); } },
      { f: 'permuta_data_giacenza', hide: true, fmt: (v) => fNumData.format(aData(v)) },
      { f: 'permuta_giorni_giacenza', num: true, render: (td, r) => { const g = Number(r.permuta_giorni_giacenza); td.append(el('span', `cv-chip ${g > 90 ? 'cv-bad' : g > 60 ? 'cv-warn' : g <= 30 ? 'cv-ok' : ''}`, `${g} giorni`)); } },
      { f: 'permuta_costo_stock', num: true, hide: true, fmt: eur },
      { f: 'permuta_interessi_passivi', num: true, fmt: eur },
    ], (r) => r.contratto, { vuota: 'Nessun usato in piazzale' });
  }
}

dash.onData(disegna);

const iniziale = location.hash.slice(1);
// #analisi apre la pagina con l'analisi del periodo già fatta: utile da mandare a un titolare dopo il check-up.
if (iniziale === 'analisi') an.attiva = true;
mostraTab(['vendite', 'fi', 'usato'].includes(iniziale) ? iniziale : 'vendite');
