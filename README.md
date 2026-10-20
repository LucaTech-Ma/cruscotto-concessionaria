# Cruscotto concessionaria

> **⚠ NON VALIDATO:** le 12 regole della sezione "Dove stai lasciando margine", le loro soglie, il test statistico e i comportamenti inseriti nei dati demo (20/10/2026) non sono ancora validati formalmente da Luca.

Demo di una webapp per concessionari multimarca: ogni sera i contratti della giornata arrivano dal gestionale e il cruscotto mostra vendite, margini, F&I e usato da permute.

I dati sono **fittizi ma verosimili**: 674 contratti Jeep, BYD e Volkswagen, dal 1° giugno al 13 ottobre 2026, con le ferie di agosto e i picchi a fine trimestre. Tutti gli importi sono IVA esclusa. Contengono anche alcuni comportamenti che l'analisi del periodo deve saper trovare: un venditore Volkswagen che concede più sconto, uno che propone meno finanziamenti, e un calo dei finanziamenti BYD da metà settembre.

## Cosa mostra

È pensato per il titolare, non per un analista: si legge dall'alto in basso, una domanda per sezione, con parole di tutti i giorni (niente "penetrazione", "F&I" o "rappel" in primo piano). In alto si sceglie il giorno, il periodo (**Giorno** o **Mese**) e il brand.

1. **Com'è andata**: prima cosa è stato venduto, poi il margine che ne deriva. Una frase con le quantità colorate (auto vendute, finanziamenti, assicurazioni, margine totale) e il confronto con le ultime 4 settimane o con il mese prima. Sotto, quattro riquadri: auto vendute (incassato, sconto medio, margine), finanziamenti (quanti su quante auto, importo, margine per finanziamento e totale), assicurazioni (polizze, premi, margine per polizza e totale) e, su fondo scuro, il margine totale con la barra divisa nelle tre parti. "Vedi tutti i passaggi" apre la cascata dal listino al margine.
2. **Obiettivo del mese e Da controllare**, affiancati. L'obiettivo mostra quanto margine (o quante auto) è stato fatto da inizio mese, una barra verso l'obiettivo con il segno di dove dovresti essere oggi (in base ai giorni di apertura, dal lunedì al sabato), un messaggio semplice (avanti, in linea, indietro) e quanto manca, i giorni rimasti e quanto serve al giorno. L'obiettivo suggerito è il risultato del mese prima più il 5%; con "Cambia obiettivo" il concessionario mette il suo, che resta salvato nel browser. Accanto, le cose su cui agire, ognuna con un pulsante che porta al dettaglio.
   Le voci da controllare:
   - Auto vendute sotto costo e quanto hanno perso (il pulsante filtra la tabella dei contratti).
   - Usati fermi da più di 3 mesi (o 2) e interessi già pagati.
   - Finanziamenti o assicurazioni sotto il solito (compaiono solo in quel caso).
3. **Dove stai lasciando margine**: la prima versione dell'agente, con calcoli e regole fissi e nessuna AI. Il titolare sceglie un periodo (un mese, un trimestre completo, gli ultimi 30 giorni) e preme "Analizza". Il confronto è con il periodo precedente della stessa lunghezza, quando è nei dati. Il cruscotto cerca gli schemi che tolgono margine e mostra le tre proposte che valgono di più. Ognuna ha il valore stimato in euro al mese, il perché, cosa fare, la regola da cui nasce, l'affidabilità e, quando c'è una leva, il pulsante "Apri nel simulatore". Sotto ci sono gli altri segnali, i rischi (che non tolgono margine oggi ma lo rendono fragile) e cosa i dati non permettono di dire. Con `#analisi` in fondo all'indirizzo la pagina si apre con l'analisi già fatta.
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
4. **Prova a simulare**: il concessionario parte dall'ultimo mese completo (per il brand scelto) e muove cinque cursori: auto vendute al mese, sconto medio sul listino, quota di auto con finanziamento, quota con assicurazione, giorni dell'usato in piazzale. Vede subito quanto gli resterebbe in un mese (margine meno interessi sull'usato), la differenza al mese e in un anno, quanto vale ogni leva da sola, la leva che vale di più e il confronto con l'obiettivo del mese. Ci sono quattro scenari pronti (meno sconti, più finanziamenti, più assicurazioni, usato più veloce) e "Riparti da capo".
   Come calcola: margine sulle auto = auto × (margine per auto prima dello sconto − sconto × listino medio); finanziamenti e assicurazioni = auto × quota × margine medio per contratto; interessi sull'usato = auto × permute per auto × giorni × interessi per usato al giorno (media su tutte le permute del brand). Ogni cursore cambia solo il suo numero: non stima, per esempio, le vendite perse con meno sconto.
5. **Approfondisci**: le tabelle per chi vuole il dettaglio.
   - Contratti, con tutte le voci al clic, e confronto tra brand.
   - Finanziamenti e assicurazioni per tipo, e risultati per venditore.
   - Usato in piazzale per anzianità, con valore e interessi pagati.

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
