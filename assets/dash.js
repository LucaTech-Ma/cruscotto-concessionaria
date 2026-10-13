/*
 * Mini runtime della dashboard: carica i dati, esegue i calcoli dichiarati con dash.calc,
 * gestisce i filtri e ridisegna la pagina quando cambiano dati, filtri o larghezza.
 * Espone la stessa interfaccia `dash` usata da assets/app.js.
 */
(function () {
  const SORGENTI = {
    contratti: { csv: 'data/contratti_gestionale.csv', inline: () => window.DATI_CONTRATTI },
  };
  const PARAMETRI_INIZIALI = { giorno: null, vista: 'giorno', brand: 'Tutti' };

  const dataset = {};
  const calcoli = {};
  const cache = {};
  const ascoltatori = [];
  let parametri = { ...PARAMETRI_INIZIALI };
  let inAttesa = false;

  const notifica = () => {
    if (inAttesa) return;
    inAttesa = true;
    requestAnimationFrame(() => {
      inAttesa = false;
      ascoltatori.forEach((fn) => {
        try { fn(); } catch (e) { console.error(e); }
      });
    });
  };

  const risultatoCalcolo = (id) => {
    if (cache[id]) return cache[id];
    const def = calcoli[id];
    const ingressi = def.inputs.map((i) => window.dash.data(i));
    const ko = ingressi.find((r) => r.status !== 'ok');
    if (ko) return { status: ko.status, data: [], message: ko.message };
    try {
      const dati = def.fn(...ingressi.map((r) => r.data));
      cache[id] = { status: 'ok', data: dati, columns: dati.length ? Object.keys(dati[0]) : [], meta: [] };
    } catch (e) {
      console.error(`Calcolo "${id}" non riuscito`, e);
      cache[id] = { status: 'error', data: [], message: String(e) };
    }
    return cache[id];
  };

  const carica = async (id, sorgente) => {
    dataset[id] = { status: 'loading', data: [] };
    try {
      let testo = sorgente.inline && sorgente.inline();
      if (!testo) {
        const r = await fetch(sorgente.csv, { cache: 'no-cache' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        testo = await r.text();
      }
      const righe = d3.csvParse(testo);
      dataset[id] = { status: 'ok', data: righe, columns: righe.columns, meta: [] };
    } catch (e) {
      console.error(`Impossibile caricare "${id}"`, e);
      dataset[id] = { status: 'error', data: [], message: String(e) };
      const root = document.getElementById('dash-root');
      const avviso = document.createElement('div');
      avviso.className = 'cv-errore';
      avviso.textContent = 'Non riesco a leggere i dati dei contratti. Apri la pagina da un server web (per esempio GitHub Pages) oppure rigenera data/contratti.js con tools/genera_dati.py.';
      root.prepend(avviso);
    }
    Object.keys(cache).forEach((k) => delete cache[k]);
    notifica();
  };

  window.dash = {
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'],
    data(id) {
      if (dataset[id]) return dataset[id];
      if (calcoli[id]) return risultatoCalcolo(id);
      return { status: 'missing', data: [] };
    },
    calc(id, def) { calcoli[id] = def; },
    loader() {},
    onData(fn) { ascoltatori.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params() { return { ...parametri }; },
    setParams(p) { parametri = { ...parametri, ...p }; notifica(); },
    resetParams() { parametri = { ...PARAMETRI_INIZIALI }; notifica(); },
    setLink(nome) { try { history.replaceState(null, '', `#${nome}`); } catch (e) { /* file:// */ } },
    refresh() {},
  };

  let larghezza = 0;
  new ResizeObserver((voci) => {
    const w = Math.round(voci[0].contentRect.width);
    if (w !== larghezza) { larghezza = w; notifica(); }
  }).observe(document.getElementById('dash-root'));

  Object.entries(SORGENTI).forEach(([id, s]) => carica(id, s));
})();
