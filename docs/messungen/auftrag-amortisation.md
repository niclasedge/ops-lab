# Auftrag: Amortisationsdauer

Der Abschnitt zwischen den beiden Markern unten wird in jedem Messlauf **wörtlich und
unverändert** übergeben. Er ist das Messstück. Ändert er sich, sind die Läufe davor und
danach nicht mehr vergleichbar — `just messlauf` weist deshalb bei jedem Start seinen
Prüfwert aus; zwei Messungen mit verschiedenem Prüfwert messen zwei verschiedene Aufgaben.

Der Prüfwert deckt nur den Abschnitt ab, nicht diese Datei. Sonst entwertete jede
Ergänzung an dieser Begründung die ganze Messreihe, ohne dass sich am Messstück etwas
geändert hätte.

Warum diese Aufgabe: sie hat eine einzige richtige Antwort, prüfbar an einer Handvoll
Zahlen, und sie berührt genau zwei Dateien. Eine größere Aufgabe streut stärker über die
Läufe als die Änderung am Ablauf, die gemessen werden soll.

## Der Auftrag ab hier

Ergänzen Sie im Wirtschaftlichkeitsrechner die Amortisationsdauer.

Die Funktion `amortisationsdauer(investition, jahresrueckfluss)` in `src/amortisation.mjs`
gibt zurück, nach wie vielen Jahren sich eine Investition bezahlt macht: die Investition
geteilt durch den jährlichen Rückfluss, als Dezimalzahl in Jahren.

Diese Fälle gehören dazu:

- 10000 Investition, 2500 Rückfluss im Jahr, ergibt 4
- 10000 Investition, 3000 Rückfluss im Jahr, ergibt 3,333… (die volle Dezimalzahl, nicht gerundet)
- Ein Rückfluss von 0 oder darunter amortisiert nie: das Ergebnis ist `Infinity`
- Eine Investition von 0 ist sofort amortisiert: das Ergebnis ist 0
- Eine negative Investition ist kein gültiger Fall und wirft einen Fehler

Die Tests liegen in `tests/amortisation.test.mjs`.

Arbeiten Sie den vollständigen Ablauf dieses Repos ab: `just neu amortisation`, Gate 1, der
rote Test, Gate 2, die Umsetzung, `just fertig`, `just pr`, Merge. Legen Sie den Change
unter der Kennung `amortisation` an. Liefern Sie einen sichtbaren Beleg der Stufe `nachher`
ein.

## Der Auftrag bis hier

Alles darunter gehört nicht mehr zum Messstück und wird nicht mit übergeben.
