# Cruscotto concessionaria

> **⚠ NON VALIDATO:** le 12 regole della sezione "Dove stai lasciando margine", le loro soglie, il test statistico e i comportamenti inseriti nei dati demo (20/10/2026) non sono ancora validati formalmente da Luca.

Demo di una webapp per concessionari multimarca: ogni sera i contratti della giornata arrivano dal gestionale e il cruscotto mostra vendite, margini, F&I e usato da permute.

I dati sono **fittizi ma verosimili**: 674 contratti Jeep, BYD e Volkswagen, dal 1° giugno al 13 ottobre 2026, con le ferie di agosto e i picchi a fine trimestre. Tutti gli importi sono IVA esclusa. Contengono anche alcuni comportamenti che l'analisi del periodo deve saper trovare: un venditore Volkswagen che concede più sconto, uno che propone meno finanziamenti, e un calo dei finanziamenti BYD da metà settembre.

## Cosa mostra

Versione executive per il titolare (decisa da Luca il 20/10/2026): **una schermata da 30 secondi**, con circa 10 numeri, che risponde a tre domande. Sto guadagnando abbastanza questo mese? Dove perdo soldi? Cosa faccio questa settimana? Si legge per mese: in alto si scelgono il mese e il marchio. Tutto il dettaglio sta in "Approfondisci", chiuso finché non serve.

1. **Margine del mese contro l'obiettivo**: il margine da inizio mese, una barra verso l'obiettivo con il segno di dove dovresti essere oggi (in base ai giorni di apertura, dal lunedì al sabato) e una frase: avanti, in linea o indietro, e quanto serve al giorno da qui a fine mese. L'obiettivo lo mette il titolare ("Imposta l'obiettivo") e resta salvato nel browser. Non c'è un obiettivo suggerito, per decisione di Luca del 20/10/2026: la stagionalità cambia troppo da una concessionaria all'altra. Finché l'obiettivo non c'è, si vede solo il margine del mese.
2. **Tre numeri**: auto vendute, margine per auto, quota di auto con finanziamento, ognuno confrontato con il mese prima allo stesso giorno.
3. **Cosa fare questa settimana**: le tre azioni che valgono di più nel mese, calcolate da sole (vedi le regole sotto). Una riga ciascuna: cosa fare e quanto vale in euro al mese, arrotondato a due cifre significative perché è una stima. Toccando la voce si aprono il perché, cosa fare, il pulsante "Simula questa azione", la regola e l'affidabilità. Se i segnali sono più di tre, un collegamento porta a tutti i segnali e ai rischi.
4. **Approfondisci**, chiuso finché non serve, con sei schede:
   - *Il mese in numeri*: i quattro riquadri (auto, finanziamenti, assicurazioni, margine totale) e il confronto tra brand.
   - *Contratti*: per giorno o dall'inizio del mese fino al giorno scelto, con tutte le voci al clic.
   - *Finanziamenti e assicurazioni*: per tipo, e i risultati per venditore.
   - *Usato*: in piazzale per anzianità, con valore e interessi pagati.
   - *Simula*: cinque leve sull'ultimo mese completo (vedi sotto).
   - *Tutti i segnali*: l'analisi di qualunque periodo (un mese, un trimestre completo, gli ultimi 30 giorni), con il confronto con il periodo precedente della stessa lunghezza, gli altri segnali, i rischi e cosa i dati non permettono di dire.

   Un indirizzo che finisce con `#segnali`, `#vendite`, `#fi`, `#usato` o `#simula` apre direttamente quella scheda (`#analisi` funziona ancora e apre i segnali).

   Le regole (soglie di esempio, da tarare sui dati reali):

   | Codice | Tipo | Quando scatta |
   |---|---|---|
   | SCO-01 | Fuori dalla norma | Un venditore concede almeno 1,2 punti di sconto in più dei colleghi dello stesso marchio |
   | FIN-02, ASS-02 | Fuori dalla norma | Un venditore ha almeno 12 punti in meno di finanziamenti (o polizze) dei colleghi dello stesso marchio |
   | MOD-01 | Fuori dalla norma | Un modello lascia meno della metà del margine, in percentuale del listino, degli altri modelli del marchio |
   | SCO-02 | Peggioramento | Lo sconto medio di un marchio sale di almeno mezzo punto rispetto al periodo precedente |
   | FIN-01, ASS-01 | Peggioramento | La quota di auto con finanziamento (o polizza) di un marchio cala di almeno 4 punti |
   | FIN-03 | Peggioramento | Il margine medio per finanziamento di un marchio cala di almeno il 10% |
   | VEN-01 | Regola violata | Auto vendute sotto costo |
   | COM-01 | Combinazione che costa | Almeno 3 auto con sconto nel quarto più alto e senza finanziamento |
   | USA-01 | Accumulo | Usati in piazzale da più di 60 giorni (situazione ad oggi) |
   | CON-01, 02, 03 | Rischio | Contributi del brand oltre il 60% del margine sulle auto; un marchio oltre il 55% del margine; un venditore oltre il 40% |

   Tre principi valgono per tutte le regole:
   - **Confronti dentro lo stesso marchio**: marchi diversi hanno sconti e finanziarie diversi, e un confronto tra marchi scambierebbe il mix per un comportamento.
   - **Margini in percentuale del listino quando si confrontano modelli**: in euro un'auto più economica rende sempre meno.
   - **Niente rumore**: una differenza diventa un segnale solo se è troppo grande per essere un caso (test statistico a una coda al 95%). L'affidabilità cresce con la nettezza della differenza e con il numero di auto.

   Il valore in euro al mese è una stima del massimo recuperabile, e i valori in parte si sovrappongono.

**Il simulatore**: il concessionario parte dall'ultimo mese completo (per il brand scelto) e muove cinque cursori: auto vendute al mese, sconto medio sul listino, quota di auto con finanziamento, quota con assicurazione, giorni dell'usato in piazzale. Vede subito quanto gli resterebbe in un mese (margine meno interessi sull'usato), la differenza al mese e in un anno, quanto vale ogni leva da sola, la leva che vale di più e il confronto con l'obiettivo del mese. Ci sono quattro scenari pronti (meno sconti, più finanziamenti, più assicurazioni, usato più veloce) e "Riparti da capo".
   Come calcola: margine sulle auto = auto × (margine per auto prima dello sconto − sconto × listino medio); finanziamenti e assicurazioni = auto × quota × margine medio per contratto; interessi sull'usato = auto × permute per auto × giorni × interessi per usato al giorno (media su tutte le permute del brand). Ogni cursore cambia solo il suo numero: non stima, per esempio, le vendite perse con meno sconto.

## Come aprirla

- **Online**: con GitHub Pages attivo, all'indirizzo `https://<utente>.github.io/cruscotto-concessionaria/`.
- **In locale**: doppio clic su `index.html`. Serve la connessione a internet per i font e per la libreria dei grafici (d3).

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
