# Cruscotto concessionaria

Demo di una webapp per concessionari multimarca: ogni sera i contratti della giornata arrivano dal gestionale e il cruscotto mostra vendite, margini, F&I e usato da permute.

I dati sono **fittizi ma verosimili**: 658 contratti Jeep, BYD e Volkswagen, dal 1° giugno al 13 ottobre 2026, con le ferie di agosto e i picchi a fine trimestre. Tutti gli importi sono IVA esclusa.

## Cosa mostra

In alto si sceglie la giornata, il periodo (**Giornata** o **Mese a data**) e il brand.

- **Vendite e margini**
  - Vetture vendute, fatturato netto, margine totale e margine medio, penetrazione di finanziamenti e assicurazioni, ciascuno confrontato con le 4 settimane precedenti.
  - Un grafico a cascata che va dal margine sul listino al margine totale.
  - Il confronto tra brand e l'andamento delle ultime 36 giornate.
  - L'elenco dei contratti, con il dettaglio di ogni voce al clic.
- **Finanziamenti e assicurazioni**: prodotti per tipo, importi, tasso medio, provvigioni e rappel, risultati per venditore.
- **Usato da permute**: permute ancora in stock per anzianità, costo stock e interessi passivi maturati.

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

## Rigenerare i dati

```
python tools/genera_dati.py
```

Il generatore usa un seme fisso, quindi produce sempre gli stessi contratti. Profili di sconto, campagne, mix dei modelli e penetrazione F&I per brand si modificano in testa allo script.
