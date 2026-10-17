# Aufgaben — archiv-zeitpunkt

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] 1.1 `tests/lagebild-archiv.test.mjs` um die drei neuen Szenarien erweitern: zwei
      Läufe am selben Tag, Zeitpunkt aus `gate1.md`, Ordner ganz ohne Nachweis
- [x] 1.2 `just gate2 archiv-zeitpunkt` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] 2.1 Eine reine Funktion in `ops.py`, die den Zeitpunkt aus einem Gate-Nachweis
      liest, und eine, die den Nachweis dafür auswählt
- [x] 2.2 `sammle_archiv` ordnet nach diesem Zeitpunkt, jüngster zuerst; die Nutzlast
      führt ihn je Archiveintrag
- [x] 2.3 Die Zeile zeigt Datum und Uhrzeit auf die Minute statt nur des Datums
- [x] 2.4 `just alles` läuft grün durch
- [x] 2.5 Beleg der Stufe `nachher` einliefern: die Archivliste in neuer Ordnung

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig archiv-zeitpunkt` verlangt,
dass keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
