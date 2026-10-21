# Cruscotto concessionaria

> **Validazione parziale.**
> - ✅ **Validato** (2026-10-20): versione executive, nessun obiettivo suggerito, e i principi delle regole (stesso marchio, niente rumore).
> - ✅ **Deciso da Luca** (2026-10-21): restano solo tre regole di esempio (SCO-01, FIN-02/ASS-02, VEN-01); le altre sono tolte.
> - **⚠ NON VALIDATO:** le soglie delle tre regole (1,2 punti di sconto, 12 punti di finanziamenti o polizze, almeno 5 auto, test al 95%), la definizione di "sotto costo" (oggi comprende i bonus del brand legati agli obiettivi) e i comportamenti inseriti nei dati demo.

Demo di una webapp per concessionari multimarca: ogni sera i contratti della giornata arrivano dal gestionale e il cruscotto mostra vendite, margini, F&I e usato da permute.

I dati sono **fittizi ma verosimili**: 674 contratti Jeep, BYD e Volkswagen, dal 1° giugno al 13 ottobre 2026, con le ferie di agosto e i picchi a fine trimestre. Tutti gli importi sono IVA esclusa. Contengono anche alcuni comportamenti che l'analisi del periodo deve saper trovare: un venditore Volkswagen che concede più sconto e uno che propone meno finanziamenti. Nei dati c'è anche un calo dei finanziamenti BYD da metà settembre, che dal 21/10 nessuna regola segnala più.

## Cosa mostra

Versione executive in tre sezioni (decisa da Luca il 21/10/2026). Regola: **per un executive meno rumore è meglio**. Quattro numeri, due domande con cosa cambiare, il resto in fondo. Si legge per mese e per marchio, scelti in alto.

1. **I numeri chiave**: fatturato, margine, margine per contratto e numero di contratti, ognuno confrontato con il mese prima allo stesso giorno.
2. **Cosa ha portato margine e cosa no**:
   - *dal listino al margine del mese*: un grafico a ponte, dal margine di listino (listino meno costo d'acquisto) al margine totale, passando per sconti, contributi e bonus del brand, preparazione e trasporto, finanziamenti e polizze;
   - *quota di auto con finanziamento e con polizza*, con il margine per pratica;
   - *le due domande*: **dove potevi guadagnare di più** (regole SCO-01 e VEN-01) e **dove potevi vendere di più** (regole FIN-02 e ASS-02). Ogni voce dice quanto vale in euro al mese, arrotondato a due cifre significative perché è una stima; toccandola si aprono il perché, cosa cambiare, il pulsante "Simula questa azione", la regola e l'affidabilità.
3. **Per approfondire**: il simulatore, l'andamento per mese (fatturato, margine, margine per contratto o contratti; il mese scelto è evidenziato, quello in corso è più chiaro) e il report sui venditori, con in rosso i numeri che hanno fatto scattare una regola.

**Report PDF**: il pulsante "Scarica il report PDF" crea un file di due pagine con gli stessi contenuti delle prime due sezioni e la tabella dei venditori, per il mese e il marchio scelti. Serve la connessione a internet (libreria jsPDF).

Fino al 20/10/2026 c'erano anche la barra dell'obiettivo del mese, la sezione "Approfondisci" con sei schede (contratti, finanziamenti e assicurazioni per tipo, usato, tutti i segnali) e i collegamenti `#segnali`, `#vendite` ecc.: sono stati tolti il 21/10 e restano nella storia del repository.

   Le regole sono tre, di esempio (decisione di Luca del 21/10/2026), con soglie da tarare sui dati reali:

   | Codice | Tipo | Quando scatta |
   |---|---|---|
   | SCO-01 | Fuori dalla norma | Un venditore concede almeno 1,2 punti di sconto in più dei colleghi dello stesso marchio |
   | FIN-02, ASS-02 | Fuori dalla norma | Un venditore ha almeno 12 punti in meno di finanziamenti (o polizze) dei colleghi dello stesso marchio |
   | VEN-01 | Regola violata | Auto vendute sotto costo |

   Fino al 20/10 c'erano anche regole su peggioramenti rispetto al periodo precedente, modelli poco redditizi, sconti alti senza finanziamento, usato fermo e rischi di concentrazione: sono state tolte il 21/10 e restano nella storia del repository.

   Due principi valgono per tutte le regole:
   - **Confronti dentro lo stesso marchio**: marchi diversi hanno sconti e finanziarie diversi, e un confronto tra marchi scambierebbe il mix per un comportamento.
   - **Niente rumore**: una differenza diventa un segnale solo se è troppo grande per essere un caso (test statistico a una coda al 95%). L'affidabilità cresce con la nettezza della differenza e con il numero di auto.

   Il valore in euro al mese è una stima del massimo recuperabile, e i valori in parte si sovrappongono.

**Il simulatore**: il concessionario parte dall'ultimo mese completo (per il brand scelto) e muove cinque cursori: auto vendute al mese, sconto medio sul listino, quota di auto con finanziamento, quota con assicurazione, giorni dell'usato in piazzale. Vede subito quanto gli resterebbe in un mese (margine meno interessi sull'usato), la differenza al mese e in un anno, quanto vale ogni leva da sola e la leva che vale di più. Ci sono quattro scenari pronti (meno sconti, più finanziamenti, più assicurazioni, usato più veloce) e "Riparti da capo".
   Come calcola: margine sulle auto = auto × (margine per auto prima dello sconto − sconto × listino medio); finanziamenti e assicurazioni = auto × quota × margine medio per contratto; interessi sull'usato = auto × permute per auto × giorni × interessi per usato al giorno (media su tutte le permute del brand). Ogni cursore cambia solo il suo numero: non stima, per esempio, le vendite perse con meno sconto.

## Come aprirla

- **Online**: con GitHub Pages attivo, all'indirizzo `https://<utente>.github.io/cruscotto-concessionaria/`.
- **In locale**: doppio clic su `index.html`. Serve la connessione a internet per i font, per la libreria dei grafici (d3) e per creare il PDF (jsPDF).

## Struttura

```
index.html                     pagina
assets/style.css               colori (chiaro e scuro), tipografia, layout
assets/app.js                  calcoli dei margini e disegno del cruscotto
assets/dash.js                 caricamento dati, filtri, aggiornamento della pagina
data/contratti_gestionale.csv  export fittizio dal gestionale, un contratto per riga
data/contratti.js              stessa tabella, per aprire la pagina senza server
tools/genera_dati.py           genera i dati fittizi
```

## Dati in ingresso

Ogni riga è un contratto, con le variabili raccolte nella survey ai concessionari:

| Blocco | Colonne |
|---|---|
| Vendita | `contratto`, `data`, `brand`, `modello`, `alimentazione`, `venditore`, `prezzo_listino`, `sconto`, `campagna_brand`, `altri_bonus_brand`, `costo_acquisto` |
| Costi vettura | `costo_preparazione`, `costo_trasporto` |
| Permuta | `permuta`, `permuta_modello`, `permuta_data_giacenza`, `permuta_giorni_giacenza`, `permuta_valutazione`, `permuta_costo_stock`, `permuta_interessi_passivi`, `permuta_stato` |
| Finanziamento | `finanziamento`, `fin_tipo`, `fin_importo`, `fin_tasso`, `fin_provvigione`, `fin_rappel`, `fin_provvigione_venditore` |
| Assicurazione | `assicurazione`, `ass_tipo`, `ass_importo`, `ass_provvigione`, `ass_rappel`, `ass_provvigione_venditore` |

`costo_acquisto` e `fin_importo` non erano nella survey: servono per calcolare il margine e dare senso a tasso e provvigione.

Per collegare un gestionale reale basta produrre ogni sera un file con queste colonne e sostituire `data/contratti_gestionale.csv`.

## Come si calcola il margine

- **Margine veicolo** = listino − sconto − costo d'acquisto + campagna brand + altri bonus brand − preparazione − trasporto
- **Margine finanziamento** = provvigione + rappel − provvigione venditore
- **Margine assicurazione** = provvigione + rappel − provvigione venditore
- **Margine totale** = veicolo + finanziamento + assicurazione

Gli interessi passivi delle permute restano fuori dal margine del contratto: sono un costo dell'usato e compaiono nella sua scheda.

## Pubblicare una nuova versione

In `index.html` i file di stile, script e dati hanno un numero di versione (`?v=…`). A ogni pubblicazione va cambiato in tutti e quattro i link, sempre lo stesso valore. Altrimenti il browser di chi ha già aperto la pagina può mescolare file vecchi e nuovi e non mostrare i dati.

## Rigenerare i dati

```
python tools/genera_dati.py
```

Il generatore usa un seme fisso, quindi produce sempre gli stessi contratti. Profili di sconto, campagne, mix dei modelli e penetrazione F&I per brand si modificano in testa allo script.
