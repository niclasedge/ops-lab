# Aufgaben — belege-sichtbar

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] 1.1 `tests/lagebild-belege.test.mjs` schreibt die sieben Szenarien der Delta-Spec
      als Erwartung, gegen ein Wegwerf-Repo mit Journal, Bild und Archiv
- [x] 1.2 `just gate2 belege-sichtbar` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] 2.1 Journal je Change lesen: eine unreine Erhebung, die `belege/belege.jsonl` aus
      offenen und archivierten Change-Ordnern einsammelt
- [x] 2.2 `web_nutzlast` füllt das Feld `belege` je Change und die neue Sektion `belege`
      über alle Changes, jüngster zuerst
- [x] 2.3 Die Web-Ansicht liefert Belege unter einer nur lesenden Route aus, die
      ausschließlich erhobene Adressen bedient
- [x] 2.4 Die Seite zeigt die Belege: Galerie über alle, Vorschau an der Change-Karte
- [x] 2.5 `just alles` läuft grün durch
- [x] 2.6 Beleg der Stufe `nachher` einliefern: die Galerie im Browser

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig belege-sichtbar` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
