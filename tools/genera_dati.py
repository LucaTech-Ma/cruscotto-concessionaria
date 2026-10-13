"""Genera un export fittizio dal gestionale: un contratto di vendita per riga (importi IVA esclusa).

Uso (dalla cartella del progetto):  python tools/genera_dati.py
Scrive data/contratti_gestionale.csv e data/contratti.js (la stessa tabella, per aprire index.html senza server).
"""
import csv
import io
import json
import pathlib
import random
from datetime import date, timedelta

random.seed(2026)
OGGI = date(2026, 10, 13)
INIZIO = date(2026, 6, 1)
CHIUSURA = (date(2026, 8, 10), date(2026, 8, 22))  # ferie estive
FESTIVI = {date(2026, 6, 2), date(2026, 8, 15)}
IVA = 1.22
TASSO_FLOOR = 0.062  # tasso annuo sul finanziamento dello stock usato

# modello, alimentazione, listino pubblico IVA inclusa, peso nel mix
MODELLI = {
    "Jeep": [
        ("Avenger 1.2 e-Hybrid", "Mild hybrid", 27900, 30),
        ("Avenger Elettrica", "Elettrica", 37900, 8),
        ("Renegade e-Hybrid", "Mild hybrid", 33500, 12),
        ("Renegade 4xe", "Plug-in", 41000, 6),
        ("Compass e-Hybrid", "Mild hybrid", 38900, 16),
        ("Compass Elettrica", "Elettrica", 46900, 5),
        ("Wrangler 4xe", "Plug-in", 72000, 3),
        ("Grand Cherokee 4xe", "Plug-in", 86000, 1),
    ],
    "BYD": [
        ("Dolphin Surf", "Elettrica", 22990, 20),
        ("Dolphin", "Elettrica", 31990, 10),
        ("Atto 2", "Elettrica", 31990, 12),
        ("Atto 2 DM-i", "Plug-in", 31990, 10),
        ("Atto 3", "Elettrica", 39990, 7),
        ("Seal U DM-i", "Plug-in", 39990, 16),
        ("Seal 6 DM-i Touring", "Plug-in", 40990, 6),
        ("Seal", "Elettrica", 46990, 4),
        ("Sealion 7", "Elettrica", 49990, 5),
    ],
    "Volkswagen": [
        ("Polo 1.0 TSI", "Benzina", 22500, 14),
        ("T-Cross 1.0 TSI", "Benzina", 26800, 14),
        ("Taigo 1.0 TSI", "Benzina", 27500, 6),
        ("T-Roc 1.5 eTSI", "Mild hybrid", 33000, 18),
        ("Golf 1.5 eTSI", "Mild hybrid", 32500, 14),
        ("Tiguan 1.5 eTSI", "Mild hybrid", 41500, 12),
        ("Tiguan eHybrid", "Plug-in", 48000, 4),
        ("ID.3 Pure", "Elettrica", 36900, 6),
        ("ID.4 Pro", "Elettrica", 46900, 5),
        ("Passat Variant 1.5 eTSI", "Mild hybrid", 47000, 4),
    ],
}

# margine contrattuale sul listino, sconto cliente, campagna brand, quota contratti con bonus, prob. finanziamento
PROFILO = {
    "Jeep": dict(margine=0.115, sconto=(0.05, 0.12), campagna=(0.02, 0.06), bonus=0.45, fin=0.66, peso=0.36),
    "BYD": dict(margine=0.085, sconto=(0.02, 0.09), campagna=(0.01, 0.05), bonus=0.30, fin=0.52, peso=0.27),
    "Volkswagen": dict(margine=0.095, sconto=(0.03, 0.09), campagna=(0.01, 0.04), bonus=0.40, fin=0.60, peso=0.37),
}

VENDITORI = {
    "Jeep": ["M. Ferri", "G. Colombo", "S. Rinaldi"],
    "BYD": ["L. Bianchi", "S. Rinaldi"],
    "Volkswagen": ["A. Greco", "F. Moretti", "G. Colombo"],
}

PERMUTE = [
    ("Fiat Panda 1.2 (2017)", 4200, 6200),
    ("Fiat 500X 1.3 Mjt (2018)", 8800, 11800),
    ("Fiat Tipo SW 1.6 Mjt (2019)", 8500, 11000),
    ("Jeep Renegade 1.6 Mjt (2019)", 11800, 15200),
    ("Jeep Compass 2.0 Mjt (2018)", 14500, 18500),
    ("VW Golf 1.6 TDI (2017)", 8800, 12000),
    ("VW Polo 1.0 TSI (2018)", 7200, 9800),
    ("VW Tiguan 2.0 TDI (2018)", 16500, 21000),
    ("Toyota Yaris Hybrid (2019)", 10200, 13200),
    ("Renault Clio 0.9 TCe (2016)", 4800, 6900),
    ("Ford Kuga 1.5 EcoBlue (2018)", 12000, 15500),
    ("Peugeot 2008 1.2 PureTech (2020)", 11000, 14200),
    ("Opel Corsa 1.2 (2017)", 4900, 6800),
    ("Audi A3 Sportback 30 TDI (2018)", 15000, 19000),
    ("Lancia Ypsilon 1.0 Hybrid (2021)", 8500, 10500),
    ("Dacia Duster 1.5 dCi (2020)", 10500, 13500),
    ("Nissan Qashqai 1.3 DIG-T (2019)", 12500, 16000),
    ("Citroen C3 1.2 (2018)", 5800, 7900),
]

FIN_TIPI = [("Balloon (PCP)", 45), ("Rateale classico", 30), ("Leasing", 12), ("Noleggio lungo termine", 13)]
ASS_TIPI = {  # premio min, max
    "Furto e incendio": (550, 1400),
    "Kasko": (900, 2300),
    "CPI credito protetto": (400, 1200),
    "GAP": (300, 750),
    "Pacchetto F&I": (1500, 3100),
}


def pick(pairs):
    return random.choices([p[0] for p in pairs], weights=[p[-1] for p in pairs])[0]


def arr(x, step=10):
    return int(round(x / step) * step)


def giorni_lavorativi():
    d = INIZIO
    while d <= OGGI:
        if d.weekday() < 6 and d not in FESTIVI and not (CHIUSURA[0] <= d <= CHIUSURA[1]):
            yield d
        d += timedelta(days=1)


def volume(d):
    if d == OGGI:
        return 9
    base = 6.5
    if d.weekday() == 5:
        base = 8.5  # sabato in salone
    if d.weekday() == 0:
        base = 5.0
    if d.month == 8:
        base *= 0.6
    if d.month == 6 and d.day >= 22 or d.month == 9 and d.day >= 22:
        base *= 1.35  # chiusura trimestre e target brand
    return max(1, int(round(random.gauss(base, 1.8))))


righe = []
progressivo = 4120
for d in giorni_lavorativi():
    for _ in range(volume(d)):
        progressivo += 1
        brand = random.choices(list(PROFILO), weights=[p["peso"] for p in PROFILO.values()])[0]
        prof = PROFILO[brand]
        nome, alim, pubblico, _peso = random.choices(MODELLI[brand], weights=[m[3] for m in MODELLI[brand]])[0]
        listino = arr(pubblico * random.uniform(1.0, 1.14) / IVA, 50)  # allestimento e optional
        costo_acquisto = arr(listino * (1 - prof["margine"] + random.uniform(-0.006, 0.006)))
        sconto = arr(listino * random.uniform(*prof["sconto"]))
        campagna = arr(listino * random.uniform(*prof["campagna"])) if random.random() < 0.8 else 0
        bonus = arr(listino * random.uniform(0.003, 0.015)) if random.random() < prof["bonus"] else 0
        prep = arr(random.uniform(220, 460))
        trasporto = arr(random.uniform(430, 820))
        ricavo = listino - sconto

        r = dict(
            contratto=f"CV26-{progressivo:05d}", data=d.isoformat(), brand=brand, modello=nome,
            alimentazione=alim, venditore=random.choice(VENDITORI[brand]),
            prezzo_listino=listino, sconto=sconto, campagna_brand=campagna, altri_bonus_brand=bonus,
            costo_acquisto=costo_acquisto, costo_preparazione=prep, costo_trasporto=trasporto,
        )

        # permuta
        if random.random() < 0.42:
            mod, vmin, vmax = random.choice(PERMUTE)
            valutazione = arr(random.uniform(vmin, vmax), 100)
            costo_stock = valutazione + arr(random.uniform(250, 1600))  # valutazione + ripristino
            giorni_vendita = int(random.lognormvariate(3.75, 0.55))  # tempo per rivenderla
            eta = (OGGI - d).days
            rivenduta = giorni_vendita < eta
            giorni = giorni_vendita if rivenduta else eta
            r.update(
                permuta="Sì", permuta_modello=mod, permuta_data_giacenza=d.isoformat(),
                permuta_giorni_giacenza=giorni, permuta_valutazione=valutazione,
                permuta_costo_stock=costo_stock,
                permuta_interessi_passivi=round(costo_stock * TASSO_FLOOR * giorni / 365, 2),
                permuta_stato="Rivenduta" if rivenduta else "In stock",
            )
        else:
            r.update(permuta="No", permuta_modello="", permuta_data_giacenza="", permuta_giorni_giacenza="",
                     permuta_valutazione="", permuta_costo_stock="", permuta_interessi_passivi="", permuta_stato="")

        # finanziamento
        finanziato = random.random() < prof["fin"]
        if finanziato:
            tipo = pick(FIN_TIPI)
            anticipo = r.get("permuta_valutazione") or 0
            importo = arr(max(5000, ricavo * IVA * random.uniform(0.6, 0.9) - (anticipo or 0) * 0.5), 100)
            if tipo == "Balloon (PCP)":
                tasso = random.choice([1.99, 2.99, 3.99]) if random.random() < 0.35 else round(random.uniform(4.99, 6.99), 2)
                provv = importo * random.uniform(0.03, 0.045)
            elif tipo == "Rateale classico":
                tasso = round(random.uniform(6.49, 8.99), 2)
                provv = importo * random.uniform(0.02, 0.035)
            elif tipo == "Leasing":
                tasso = round(random.uniform(5.49, 7.49), 2)
                provv = importo * random.uniform(0.015, 0.025)
            else:
                tasso = ""
                provv = random.uniform(600, 1200)
            rappel = importo * random.uniform(0.005, 0.01) if tipo != "Noleggio lungo termine" else random.uniform(150, 300)
            provv = arr(provv)
            r.update(finanziamento="Sì", fin_tipo=tipo, fin_importo=importo, fin_tasso=tasso,
                     fin_provvigione=provv, fin_rappel=arr(rappel), fin_provvigione_venditore=arr(provv * 0.12))
        else:
            r.update(finanziamento="No", fin_tipo="", fin_importo="", fin_tasso="", fin_provvigione="",
                     fin_rappel="", fin_provvigione_venditore="")

        # assicurazione
        if random.random() < (0.72 if finanziato else 0.24):
            tipi = list(ASS_TIPI) if finanziato else [t for t in ASS_TIPI if t != "CPI credito protetto"]
            pesi = {"Furto e incendio": 38, "Kasko": 16, "CPI credito protetto": 22, "GAP": 9, "Pacchetto F&I": 15}
            tipo = random.choices(tipi, weights=[pesi[t] for t in tipi])[0]
            premio = arr(random.uniform(*ASS_TIPI[tipo]))
            provv = arr(premio * random.uniform(0.18, 0.30))
            r.update(assicurazione="Sì", ass_tipo=tipo, ass_importo=premio, ass_provvigione=provv,
                     ass_rappel=arr(premio * random.uniform(0.02, 0.05)), ass_provvigione_venditore=arr(provv * 0.10))
        else:
            r.update(assicurazione="No", ass_tipo="", ass_importo="", ass_provvigione="", ass_rappel="",
                     ass_provvigione_venditore="")
        righe.append(r)

DATI = pathlib.Path(__file__).resolve().parent.parent / "data"
buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=list(righe[0]), lineterminator="\n")
w.writeheader()
w.writerows(righe)
(DATI / "contratti_gestionale.csv").write_text(buf.getvalue(), encoding="utf-8", newline="\n")
(DATI / "contratti.js").write_text(
    "// Generato da tools/genera_dati.py: copia di contratti_gestionale.csv per aprire la demo senza server.\n"
    f"window.DATI_CONTRATTI = {json.dumps(buf.getvalue(), ensure_ascii=False)};\n",
    encoding="utf-8",
    newline="\n",
)
oggi = [r for r in righe if r["data"] == OGGI.isoformat()]
print(len(righe), "contratti;", len(oggi), "oggi")
