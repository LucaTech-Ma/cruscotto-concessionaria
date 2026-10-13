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
        pen_fin: quota(somma(rs, (r) => (r.finanziamento === 'Sì' ? 1 : 0)), v),
        pen_ass: quota(somma(rs, (r) => (r.assicurazione === 'Sì' ? 1 : 0)), v),
        permute: somma(rs, (r) => (r.permuta === 'Sì' ? 1 : 0)),
        neg_veicolo: somma(rs, (r) => (r.margine_veicolo < 0 ? 1 : 0)),
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
  giorni: (v) => (vuoto(v) ? '—' : `${fNum.format(Math.round(v))} gg`),
  dint: (v) => segno(v, fNum.format),
  dpct: (v) => segno(v, fPct.format),
  deur: (v) => segno(v, fEur.format),
  dpt: (v) => `${segno(Math.round(v * 1000) / 10, fNum.format)} pt`,
};
const aData = (s) => new Date(`${s}T12:00:00Z`);
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
const fallito = (box) => { box.classList.remove('dash-skeleton'); box.replaceChildren(el('div', 'cv-fail', 'Failed to load')); };

/* ---------- Stato della pagina ---------- */
const stato = { tab: 'vendite', misura: 'margine_totale', scelto: null, ordina: { k: 'contratto', dir: 1 }, cerca: '' };
const params = () => { const p = dash.params(); return { giorno: p.giorno || null, vista: p.vista || 'giorno', brand: p.brand || 'Tutti' }; };
let GIORNI = [];
const giornoAttivo = () => { const g = params().giorno; return GIORNI.includes(g) ? g : GIORNI[GIORNI.length - 1]; };

$$('#seg-brand button[data-brand]').forEach((b) => { const sw = b.querySelector('.cv-sw'); if (sw) sw.style.background = colore(b.dataset.brand); });

/* ---------- Controlli ---------- */
$('#sel-giorno').addEventListener('change', (e) => { stato.scelto = null; dash.setParams({ giorno: e.target.value }); });
$('#btn-prev').addEventListener('click', () => { const i = GIORNI.indexOf(giornoAttivo()); if (i > 0) { stato.scelto = null; dash.setParams({ giorno: GIORNI[i - 1] }); } });
$('#btn-next').addEventListener('click', () => { const i = GIORNI.indexOf(giornoAttivo()); if (i < GIORNI.length - 1) { stato.scelto = null; dash.setParams({ giorno: GIORNI[i + 1] }); } });
$$('#seg-vista button').forEach((b) => b.addEventListener('click', () => { stato.scelto = null; dash.setParams({ vista: b.dataset.vista }); }));
$$('#seg-brand button').forEach((b) => b.addEventListener('click', () => { stato.scelto = null; dash.setParams({ brand: b.dataset.brand }); }));
$$('#seg-misura button').forEach((b) => b.addEventListener('click', () => { stato.misura = b.dataset.misura; disegna(); }));
$('#cerca-contratti').addEventListener('input', (e) => { stato.cerca = e.target.value.trim().toLowerCase(); disegna(); });
$$('#tab-contratti th button[data-sort]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.sort;
  stato.ordina = stato.ordina.k === k ? { k, dir: -stato.ordina.dir } : { k, dir: 1 };
  disegna();
}));
$('#tab-brand').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-brand]');
  if (tr) { stato.scelto = null; dash.setParams({ brand: params().brand === tr.dataset.brand ? 'Tutti' : tr.dataset.brand }); }
});
const scegliContratto = (id) => { stato.scelto = stato.scelto === id ? null : id; disegna(); if (stato.scelto) $('#dettaglio').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
$('#tab-contratti').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr) scegliContratto(tr.dataset.key); });
$('#tab-contratti').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); scegliContratto(tr.dataset.key); } });

const mostraTab = (tab) => {
  stato.tab = tab;
  $$('.cv-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('.cv-page').forEach((p) => { p.hidden = p.id !== `pagina-${tab}`; });
  dash.setLink(tab);
  disegna();
};
$$('.cv-tabs button').forEach((b) => b.addEventListener('click', () => mostraTab(b.dataset.tab)));

/* ---------- Tooltip ---------- */
const tooltip = (box) => { let t = box.querySelector('.cv-tip'); if (!t) { t = el('div', 'cv-tip'); t.hidden = true; box.append(t); } return t; };
const mostraTip = (box, tip, x, y) => {
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight, W = box.clientWidth;
  let left = x + 12; if (left + w > W) left = Math.max(0, x - w - 12);
  tip.style.left = `${left}px`; tip.style.top = `${Math.max(0, y - h - 8)}px`;
};
const rigaTip = (colore, nome, valore) => {
  const r = el('div', 'cv-tip-row');
  if (colore) { const s = el('i', 'cv-sw'); s.style.background = colore; r.append(s); }
  r.append(el('span', '', nome), el('span', '', valore));
  return r;
};

/* ---------- Cascata del margine ---------- */
function cascata(box, k) {
  box.querySelectorAll('svg').forEach((s) => s.remove());
  const W = box.clientWidth; if (!W || !k) return;
  const passi = [
    { nome: 'Margine da listino', v: k.margine_listino, campo: 'margine_listino', spiega: "Prezzo di listino meno costo d'acquisto dal brand" },
    { nome: 'Sconti cliente', v: -k.sconti, campo: 'sconti', spiega: 'Sconti concessi in trattativa' },
    { nome: 'Campagne brand', v: k.campagne, campo: 'campagne', spiega: 'Contributi del brand sulle campagne in corso' },
    { nome: 'Altri bonus brand', v: k.bonus, campo: 'bonus', spiega: 'Bonus a target e altri premi del brand' },
    { nome: 'Preparazione e trasporto', v: -k.costi, campo: 'costi', spiega: 'Costo preparazione vettura e costo trasporto' },
    { nome: 'Margine veicolo', tot: k.margine_veicolo, campo: 'margine_veicolo' },
    { nome: 'Finanziamenti', v: k.margine_fin, campo: 'margine_fin', spiega: 'Provvigione e rappel meno provvigione venditore' },
    { nome: 'Assicurazioni', v: k.margine_ass, campo: 'margine_ass', spiega: 'Provvigione e rappel meno provvigione venditore' },
    { nome: 'Margine totale', tot: k.margine_totale, campo: 'margine_totale' },
  ];
  let corsa = 0;
  passi.forEach((p) => {
    if (p.tot !== undefined) { p.a = 0; p.b = p.tot; corsa = p.tot; } else { p.a = corsa; p.b = corsa + p.v; corsa = p.b; }
  });
  const rh = 31, H = passi.length * rh + 6;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const misura = (testi, peso) => {
    const t = svg.append('g').style('font-size', 'var(--cds-font-size-caption)').style('font-weight', peso || null);
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
    const y = i * rh + 4, bh = 19;
    const g = svg.append('g');
    const tot = p.tot !== undefined;
    g.append('text').attr('x', 0).attr('y', y + bh / 2).attr('dy', '0.35em').style('font-size', 'var(--cds-font-size-caption)')
      .style('font-weight', tot ? 600 : null).style('fill', tot ? 'var(--color-fg)' : 'var(--color-fg-muted)').text(p.nome);
    const fill = tot ? 'var(--color-fg)' : p.v >= 0 ? 'color-mix(in srgb, var(--color-ok) 72%, var(--color-panel))' : 'color-mix(in srgb, var(--color-bad) 72%, var(--color-panel))';
    const x0 = x(Math.min(p.a, p.b)), x1 = x(Math.max(p.a, p.b));
    g.append('rect').attr('x', x0).attr('y', y).attr('width', Math.max(1.5, x1 - x0)).attr('height', bh).attr('rx', 3).style('fill', fill);
    g.append('text').attr('x', x1 + 6).attr('y', y + bh / 2).attr('dy', '0.35em').style('font-size', 'var(--cds-font-size-caption)')
      .style('font-weight', tot ? 600 : null).style('fill', 'var(--color-fg)').text(etichetta(p));
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

/* ---------- Andamento giornaliero ---------- */
function andamento(box, righe, giorno, brand, misura) {
  box.querySelectorAll('svg').forEach((s) => s.remove());
  const W = box.clientWidth; if (!W) return;
  const serie = brand === 'Tutti' ? BRANDS : [brand];
  const fine = GIORNI.indexOf(giorno);
  const finestra = GIORNI.slice(Math.max(0, fine - 35), fine + 1);
  const per = new Map(righe.filter((r) => r.vista === 'giorno').map((r) => [`${r.periodo}|${r.brand}`, r]));
  const dati = finestra.map((d) => { const o = { d }; serie.forEach((b) => { o[b] = Number(per.get(`${d}|${b}`)?.[misura]) || 0; }); return o; });
  const pile = d3.stack().keys(serie).offset(d3.stackOffsetDiverging)(dati);
  const H = 250, m = { t: 10, r: 4, b: 26 };
  const lo = Math.min(0, d3.min(pile, (s) => d3.min(s, (p) => p[0])));
  const hi = Math.max(1, d3.max(pile, (s) => d3.max(s, (p) => p[1])));
  const y0 = d3.scaleLinear([lo, hi], [H - m.b, m.t]).nice();
  const ticks = y0.ticks(4);
  const fy = misura === 'vetture' ? (v) => fNum.format(v) : (v) => fEur.format(v);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const prova = svg.append('g').style('font-size', 'var(--cds-font-size-caption)');
  const lw = d3.max(ticks, (t) => prova.append('text').text(fy(t)).node().getComputedTextLength()) + 10;
  const dw = prova.append('text').text('30 set').node().getComputedTextLength();
  prova.remove();
  const x = d3.scaleBand(finestra, [lw, W - m.r]).paddingInner(0.22).paddingOuter(0.05);
  const y = y0;
  const ga = svg.append('g').style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg-muted)');
  ticks.forEach((t) => {
    svg.append('line').attr('x1', lw).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).style('stroke', t === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)');
    ga.append('text').attr('x', lw - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fy(t));
  });
  const ogni = Math.max(1, Math.ceil((dw + 10) / x.step()));
  finestra.forEach((d, i) => {
    const sel = d === giorno;
    if (sel) svg.append('rect').attr('x', x(d) - x.step() * 0.11).attr('y', m.t).attr('width', x.step()).attr('height', H - m.b - m.t).attr('rx', 3).style('fill', 'var(--cds-chart-grid)');
    if ((finestra.length - 1 - i) % ogni === 0) {
      ga.append('text').attr('x', x(d) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle')
        .style('fill', sel ? 'var(--color-fg)' : null).style('font-weight', sel ? 600 : null).text(fBreve.format(aData(d)).replace('.', ''));
    }
  });
  pile.forEach((s) => {
    svg.append('g').style('fill', colore(s.key)).selectAll('rect').data(s).join('rect')
      .attr('x', (p) => x(p.data.d)).attr('width', x.bandwidth())
      .attr('y', (p) => y(Math.max(p[0], p[1]))).attr('height', (p) => Math.max(0, Math.abs(y(p[0]) - y(p[1])) - (Math.abs(y(p[0]) - y(p[1])) > 3 ? 1.5 : 0)))
      .attr('rx', 2);
  });
  const tip = tooltip(box);
  svg.append('g').selectAll('rect').data(dati).join('rect')
    .attr('x', (d) => x(d.d) - x.step() * 0.11).attr('width', x.step()).attr('y', m.t).attr('height', H - m.b - m.t)
    .style('fill', 'transparent').style('cursor', 'pointer')
    .on('mousemove', (ev, d) => {
      tip.replaceChildren(el('div', 'cv-tip-h', maiusc(fLunga.format(aData(d.d)))));
      serie.forEach((b) => tip.append(rigaTip(serie.length > 1 ? colore(b) : null, b, fy(d[b]))));
      if (serie.length > 1) tip.append(rigaTip(null, 'Totale', fy(d3.sum(serie, (b) => d[b]))));
      const [mx, my] = d3.pointer(ev, box); mostraTip(box, tip, mx, my);
    })
    .on('mouseleave', () => { tip.hidden = true; })
    .on('click', (ev, d) => { stato.scelto = null; dash.setParams({ giorno: d.d }); });
}

/* ---------- Dettaglio contratto ---------- */
const GRUPPI = [
  { titolo: 'Vendita', voci: [['Data', 'data', 'data'], ['Brand', 'brand'], ['Modello', 'modello'], ['Alimentazione', 'alimentazione'], ['Venditore', 'venditore'], ['Prezzo di listino', 'prezzo_listino', 'eur'], ['Sconto', 'sconto', 'eur'], ['Campagna brand', 'campagna_brand', 'eur'], ['Altri bonus brand', 'altri_bonus_brand', 'eur'], ["Costo d'acquisto", 'costo_acquisto', 'eur']] },
  { titolo: 'Costi vettura', voci: [['Costo preparazione vettura', 'costo_preparazione', 'eur'], ['Costo trasporto', 'costo_trasporto', 'eur']] },
  { titolo: 'Permuta', se: 'permuta', voci: [['Modello', 'permuta_modello'], ['Data giacenza', 'permuta_data_giacenza', 'data'], ['Giorni in giacenza', 'permuta_giorni_giacenza', 'int'], ['Valutazione', 'permuta_valutazione', 'eur'], ['Costo stock', 'permuta_costo_stock', 'eur'], ['Interessi passivi', 'permuta_interessi_passivi', 'eur2'], ['Stato', 'permuta_stato']] },
  { titolo: 'Finanziamento', se: 'finanziamento', voci: [['Tipo finanziamento', 'fin_tipo'], ['Importo finanziato', 'fin_importo', 'eur'], ['Tasso (TAN)', 'fin_tasso', 'tan'], ['Provvigione', 'fin_provvigione', 'eur'], ['Rappel', 'fin_rappel', 'eur'], ['Provvigione venditore', 'fin_provvigione_venditore', 'eur']] },
  { titolo: 'Assicurazione', se: 'assicurazione', voci: [['Tipo', 'ass_tipo'], ['Importo (premio)', 'ass_importo', 'eur'], ['Provvigione', 'ass_provvigione', 'eur'], ['Rappel', 'ass_rappel', 'eur'], ['Provvigione venditore', 'ass_provvigione_venditore', 'eur']] },
];
const formatta = (v, f) => (f === 'data' ? (v ? fNumData.format(aData(v)) : '—') : f === 'tan' ? (vuoto(v) ? 'n.d.' : `${fNum.format(Number(v))}%`) : f ? FMT[f](v) : v || '—');
function dettaglio(c, m) {
  const box = $('#dettaglio');
  if (!c || !m) { box.hidden = true; box.replaceChildren(); return; }
  box.hidden = false;
  const testa = el('div', 'cv-detail-head');
  testa.append(el('h3', '', `${c.contratto} · ${c.brand} ${c.modello}`));
  const chiudi = el('button', 'cv-ghost', 'Chiudi dettaglio');
  chiudi.addEventListener('click', () => { stato.scelto = null; disegna(); });
  testa.append(chiudi);
  const griglia = el('div', 'cv-detail-grid');
  const where = `contratto=${enc(c.contratto)}`;
  GRUPPI.forEach((g) => {
    const sez = el('div', 'cv-group');
    sez.append(el('h4', '', g.titolo));
    if (g.se && c[g.se] !== 'Sì') { sez.append(el('p', '', g.se === 'permuta' ? 'Nessuna permuta' : g.se === 'finanziamento' ? 'Pagamento senza finanziamento' : 'Nessuna polizza collocata')); griglia.append(sez); return; }
    const dl = el('dl');
    g.voci.forEach(([etich, campo, f]) => {
      const dd = el('dd', '', formatta(c[campo], f));
      dd.dataset.source = 'contratti'; dd.dataset.field = campo; dd.dataset.where = where;
      dl.append(el('dt', '', etich), dd);
    });
    sez.append(dl); griglia.append(sez);
  });
  const sm = el('div', 'cv-group');
  sm.append(el('h4', '', 'Margine del contratto'));
  const dl = el('dl', 'cv-tot');
  [['Ricavo netto vettura', 'ricavo_netto'], ['Margine veicolo', 'margine_veicolo'], ['Margine finanziamento', 'margine_fin'], ['Margine assicurazione', 'margine_ass'], ['Margine totale', 'margine_totale']].forEach(([etich, campo]) => {
    const dd = el('dd', Number(m[campo]) < 0 ? 'cv-neg' : '', eur(m[campo]));
    dd.dataset.source = 'margini'; dd.dataset.field = campo; dd.dataset.where = where;
    dl.append(el('dt', '', etich), dd);
  });
  sm.append(dl); griglia.append(sm);
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
    const delta = n.dataset.fmt.startsWith('d');
    if (delta) {
      n.textContent = vuoto(v) ? '' : FMT[n.dataset.fmt](Number(v));
      n.classList.toggle('cv-up', !vuoto(v) && v > 0);
      n.classList.toggle('cv-down', !vuoto(v) && v < 0);
    } else {
      n.textContent = FMT[n.dataset.fmt](v);
    }
  });
};

function tabella(tbody, righe, colonne, chiave, opzioni = {}) {
  if (!righe.length) {
    const tr = el('tr'); const td = el('td', 'cv-empty', opzioni.vuota || 'Nessun dato nel periodo selezionato');
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

  $$('#seg-vista button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === p.vista)));
  $$('#seg-brand button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.brand === p.brand)));
  $$('#seg-misura button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.misura === stato.misura)));
  $$('.cv-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === stato.tab)));

  if (C.status === 'error') { ['#chart-cascata', '#chart-andamento'].forEach((s) => fallito($(s))); return; }
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
  const etichettaPeriodo = p.vista === 'giorno' ? maiusc(fLunga.format(aData(giorno))) : `${maiusc(fMese.format(aData(giorno)))} fino al ${fBreve.format(aData(giorno)).replace('.', '')}`;
  $$('.cv-periodo').forEach((n) => { n.textContent = p.vista === 'giorno' ? fNumData.format(aData(giorno)) : etichettaPeriodo; });
  const rifTesto = p.vista === 'giorno' ? 'vs media 4 settimane' : 'vs stesso periodo mese prec.';
  $$('.cv-reflabel').forEach((n) => { n.textContent = rifTesto; });

  const chiavi = { kpi: `${p.vista}|${giorno}|${p.brand}`, fi: `${p.vista}|${giorno}|${p.brand}`, usato: p.brand };
  const mappe = {
    kpi: K.status === 'ok' ? new Map(K.data.map((r) => [r.chiave, r])) : new Map(),
    fi_mix: FI.status === 'ok' ? new Map(FI.data.map((r) => [r.chiave, r])) : new Map(),
    usato: U.status === 'ok' ? new Map(U.data.map((r) => [r.chiave, r])) : new Map(),
  };
  const k = mappe.kpi.get(chiavi.kpi);

  // Sintesi
  const sintesi = $('#takeaway');
  if (k) {
    const span = (campo, f) => { const s = el('b', '', FMT[f](k[campo])); s.dataset.source = 'kpi'; s.dataset.field = campo; s.dataset.where = `chiave=${enc(chiavi.kpi)}`; return s; };
    const chi = p.brand === 'Tutti' ? '' : ` ${p.brand}`;
    if (!k.vetture) {
      sintesi.replaceChildren(document.createTextNode(`${etichettaPeriodo}: nessun contratto${chi} registrato.`));
    } else {
      const parti = [document.createTextNode(`${etichettaPeriodo}: `), span('vetture', 'int'), document.createTextNode(k.vetture === 1 ? ` vettura${chi} venduta, ` : ` vetture${chi} vendute, `),
        span('margine_totale', 'eur'), document.createTextNode(' di margine totale ('), span('margine_medio', 'eur'), document.createTextNode(' a vettura).')];
      if (!vuoto(k.quota_fi)) parti.push(document.createTextNode(' Finanziamenti e assicurazioni portano il '), span('quota_fi', 'pct'), document.createTextNode(' del margine.'));
      if (k.neg_veicolo > 0) parti.push(document.createTextNode(' Contratti con margine veicolo negativo: '), span('neg_veicolo', 'int'), document.createTextNode('.'));
      sintesi.replaceChildren(...parti);
    }
  }

  // Tile
  riempiTile(document, mappe, chiavi);

  // VENDITE
  if (stato.tab === 'vendite') {
    if (K.status === 'error') { fallito($('#chart-cascata')); fallito($('#chart-andamento')); }
    if (k) {
      const wf = $('#chart-cascata'); wf.classList.remove('dash-skeleton'); cascata(wf, k);
      const tr = $('#chart-andamento'); tr.classList.remove('dash-skeleton'); andamento(tr, K.data, giorno, p.brand, stato.misura);
      const leg = $('#legenda-andamento');
      leg.replaceChildren(...(p.brand === 'Tutti' ? BRANDS : [p.brand]).map((b) => { const s = el('span'); const sw = el('i', 'cv-sw'); sw.style.background = colore(b); s.append(sw, document.createTextNode(b)); return s; }));

      const righeBrand = BRANDS.map((b) => mappe.kpi.get(`${p.vista}|${giorno}|${b}`)).filter(Boolean);
      const maxMedio = d3.max(righeBrand, (r) => Math.max(0, r.margine_medio || 0)) || 1;
      tabella($('#tab-brand tbody'), righeBrand, [
        { f: 'brand', render: (td, r) => { const sw = el('i', 'cv-sw'); sw.style.background = colore(r.brand); td.append(sw, document.createTextNode(` ${r.brand}`)); } },
        { f: 'vetture', num: true, fmt: num },
        { f: 'margine_veicolo', num: true, fmt: eur, cls: (r) => (r.margine_veicolo < 0 ? 'cv-neg' : '') },
        { f: 'margine_fi', num: true, fmt: eur },
        { f: 'margine_totale', num: true, fmt: eur },
        { f: 'margine_medio', num: true, render: (td, r) => { const w = el('div', 'cv-bar'); const bar = el('i'); bar.style.width = `${Math.round((Math.max(0, r.margine_medio || 0) / maxMedio) * 48)}px`; bar.style.background = colore(r.brand); w.append(bar, el('span', '', eur(r.margine_medio))); td.append(w); } },
      ], (r) => r.chiave, { classe: () => 'cv-click', dopo: (tr, r) => { tr.dataset.brand = r.brand; tr.setAttribute('aria-selected', String(p.brand === r.brand)); } });
      $('#nota-sconto').textContent = vuoto(k.sconto_medio_pct) ? '' : `Sconto medio sul listino nel periodo: ${fPct1.format(k.sconto_medio_pct)}. Permute ritirate: ${num(k.permute)}.`;

      const chip = $('#chip-negativi');
      chip.hidden = !(k.neg_veicolo > 0);
      chip.querySelector('[data-field]').textContent = num(k.neg_veicolo);
      chip.querySelector('[data-field]').dataset.where = `chiave=${enc(chiavi.kpi)}`;
      $('#chip-negativi-txt').textContent = k.neg_veicolo === 1 ? 'contratto a margine veicolo negativo' : 'contratti a margine veicolo negativo';
    }

    // Contratti
    const marg = M.status === 'ok' ? new Map(M.data.map((r) => [r.contratto, r])) : new Map();
    let righe = contratti.filter((r) => nelPeriodo(r) && (p.brand === 'Tutti' || r.brand === p.brand)).map((r) => ({ ...r, ...(marg.get(r.contratto) || {}) }));
    $('#titolo-contratti').textContent = `Contratti · ${righe.length}`;
    if (stato.cerca) righe = righe.filter((r) => [r.contratto, r.modello, r.brand, r.venditore, r.permuta_modello, r.fin_tipo, r.ass_tipo].join(' ').toLowerCase().includes(stato.cerca));
    const { k: ok, dir } = stato.ordina;
    const numerico = !['contratto', 'modello', 'venditore', 'permuta_modello', 'fin_tipo', 'ass_tipo'].includes(ok);
    righe.sort((a, b) => (numerico ? (Number(a[ok]) || 0) - (Number(b[ok]) || 0) : String(a[ok] || '').localeCompare(String(b[ok] || ''), 'it')) * dir);
    $$('#tab-contratti th').forEach((th) => { const b = th.querySelector('button'); th.setAttribute('aria-sort', b && b.dataset.sort === ok ? (dir > 0 ? 'ascending' : 'descending') : 'none'); });
    const negCls = (f) => (r) => (Number(r[f]) < 0 ? 'cv-neg' : '');
    tabella($('#tab-contratti tbody'), righe, [
      { f: 'contratto', render: (td, r) => { td.append(document.createTextNode(r.contratto)); if (p.vista === 'mtd') td.append(el('span', 'cv-sub', fNumData.format(aData(r.data)))); } },
      { f: 'modello', render: (td, r) => { td.append(document.createTextNode(r.modello), el('span', 'cv-sub', `${r.brand} · ${r.alimentazione}`)); } },
      { f: 'venditore', hide: true },
      { f: 'prezzo_listino', num: true, hide: true, fmt: eur },
      { f: 'sconto', num: true, hide: true, render: (td, r) => { td.append(document.createTextNode(eur(r.sconto)), el('span', 'cv-sub', fPct1.format(Number(r.sconto) / Number(r.prezzo_listino)))); } },
      { f: 'campagna_brand', num: true, hide: true, fmt: eur },
      { f: 'permuta_modello', hide: true },
      { f: 'fin_tipo', hide: true },
      { f: 'ass_tipo', hide: true },
      { f: 'margine_veicolo', num: true, fmt: eur, cls: negCls('margine_veicolo') },
      { f: 'margine_fi', num: true, fmt: eur },
      { f: 'margine_totale', num: true, fmt: eur, cls: negCls('margine_totale') },
    ], (r) => r.contratto, {
      vuota: stato.cerca ? 'Nessun contratto corrisponde alla ricerca' : 'Nessun contratto nel periodo selezionato',
      classe: () => 'cv-click',
      dopo: (tr, r) => { tr.tabIndex = 0; tr.setAttribute('aria-selected', String(stato.scelto === r.contratto)); },
    });
    const scelto = stato.scelto && contratti.find((r) => r.contratto === stato.scelto);
    dettaglio(scelto, scelto && marg.get(scelto.contratto));
  }

  // F&I
  if (stato.tab === 'fi') {
    const fiRighe = (ambito) => (FI.status === 'ok' ? FI.data.filter((r) => r.vista === p.vista && r.periodo === giorno && r.brand === p.brand && r.ambito === ambito && (r.contratti > 0 || r.tipo === 'Totale')) : []);
    const tot = (r) => (r.tipo === 'Totale' ? 'cv-totrow' : '');
    const fin = fiRighe('Finanziamento');
    tabella($('#tab-fin tbody'), fin.length > 1 ? fin : [], [
      { f: 'tipo' }, { f: 'contratti', num: true, fmt: num }, { f: 'importo', num: true, fmt: eur },
      { f: 'tasso_medio', num: true, fmt: (v) => (vuoto(v) ? 'n.d.' : `${fNum.format(v)}%`) },
      { f: 'provvigioni_rappel', num: true, fmt: eur }, { f: 'provvigioni_venditore', num: true, hide: true, fmt: eur },
    ], (r) => r.chiave, { classe: tot, vuota: 'Nessun finanziamento nel periodo selezionato' });
    const ass = fiRighe('Assicurazione');
    tabella($('#tab-ass tbody'), ass.length > 1 ? ass : [], [
      { f: 'tipo' }, { f: 'contratti', num: true, fmt: num }, { f: 'importo', num: true, fmt: eur },
      { f: 'provvigioni_rappel', num: true, fmt: eur }, { f: 'provvigioni_venditore', num: true, hide: true, fmt: eur },
    ], (r) => r.chiave, { classe: tot, vuota: 'Nessuna polizza nel periodo selezionato' });
    const vend = V.status === 'ok' ? V.data.filter((r) => r.vista === p.vista && r.periodo === giorno && r.brand === p.brand).sort((a, b) => b.margine_totale - a.margine_totale) : [];
    tabella($('#tab-venditori tbody'), vend, [
      { f: 'venditore' }, { f: 'vetture', num: true, fmt: num }, { f: 'margine_totale', num: true, fmt: eur },
      { f: 'margine_medio', num: true, fmt: eur, cls: (r) => (r.margine_medio < 0 ? 'cv-neg' : '') },
      { f: 'pen_fin', num: true, fmt: pct }, { f: 'pen_ass', num: true, fmt: pct }, { f: 'provvigioni_venditore', num: true, fmt: eur },
    ], (r) => r.chiave, { vuota: 'Nessun contratto nel periodo selezionato' });
  }

  // USATO
  if (stato.tab === 'usato') {
    $('#chip-situazione').textContent = `Situazione al ${fNumData.format(aData(GIORNI[GIORNI.length - 1]))}`;
    const fasce = ['0–30 giorni', '31–60 giorni', '61–90 giorni', 'Oltre 90 giorni'];
    const tinte = [18, 42, 70, 100].map((q) => `color-mix(in srgb, var(--color-bad) ${q}%, var(--color-panel))`);
    const righeF = fasce.map((f) => mappe.usato.get(`${p.brand}|${f}`)).filter(Boolean);
    const barra = $('#barra-aging');
    barra.replaceChildren(...righeF.filter((r) => r.permute > 0).map((r) => { const s = el('span'); s.style.flex = `${r.permute} 1 0`; s.style.background = tinte[fasce.indexOf(r.fascia)]; return s; }));
    $('#legenda-aging').replaceChildren(...righeF.map((r, i) => {
      const s = el('span'); const sw = el('i', 'cv-sw'); sw.style.background = tinte[i];
      const v = el('b', '', `${num(r.permute)}`); v.dataset.source = 'usato'; v.dataset.field = 'permute'; v.dataset.where = `chiave=${enc(r.chiave)}`;
      const ii = el('span', '', ` · ${eur(r.interessi_passivi)} di interessi`); ii.dataset.source = 'usato'; ii.dataset.field = 'interessi_passivi'; ii.dataset.where = `chiave=${enc(r.chiave)}`;
      s.append(sw, document.createTextNode(`${r.fascia}: `), v, ii); return s;
    }));
    const stock = contratti.filter((r) => r.permuta_stato === 'In stock' && (p.brand === 'Tutti' || r.brand === p.brand))
      .sort((a, b) => Number(b.permuta_giorni_giacenza) - Number(a.permuta_giorni_giacenza));
    tabella($('#tab-stock tbody'), stock, [
      { f: 'permuta_modello' },
      { f: 'permuta_data_giacenza', fmt: (v) => fNumData.format(aData(v)) },
      { f: 'permuta_giorni_giacenza', num: true, render: (td, r) => { const g = Number(r.permuta_giorni_giacenza); td.append(el('span', `cv-chip ${g > 90 ? 'cv-bad' : g > 60 ? 'cv-warn' : g <= 30 ? 'cv-ok' : ''}`, `${g} gg`)); } },
      { f: 'permuta_valutazione', num: true, hide: true, fmt: eur },
      { f: 'permuta_costo_stock', num: true, fmt: eur },
      { f: 'permuta_interessi_passivi', num: true, fmt: eur2 },
      { f: 'modello', hide: true, render: (td, r) => { td.append(document.createTextNode(`${r.brand} ${r.modello}`), el('span', 'cv-sub', r.contratto)); } },
    ], (r) => r.contratto, { vuota: 'Nessuna permuta in giacenza' });
  }
}

dash.onData(disegna);

const iniziale = location.hash.slice(1);
mostraTab(['vendite', 'fi', 'usato'].includes(iniziale) ? iniziale : 'vendite');
