# Aufgaben — archiv-zeilen

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] 1.1 `tests/lagebild-archiv.test.mjs` um die drei neuen Szenarien erweitern:
      darstellbar oder nicht, Vorschau der Stufe `nachher`, Vorschau leer
- [x] 1.2 `just gate2 archiv-zeilen` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] 2.1 Zwei reine Funktionen in `ops.py`: ob ein Beleg darstellbar ist und welcher
      die Vorschau stellt
- [x] 2.2 Die Nutzlast führt beides: `zeigbar` je Beleg, `vorschau` je Archiveintrag
- [x] 2.3 Die Seite zeigt je archiviertem Change eine zugeklappte Zeile mit Vorschau
      und klappt Beleg, Aufgaben und weitere Belege auf Klick auf
- [x] 2.4 `just alles` läuft grün durch
- [x] 2.5 Beleg der Stufe `nachher` einliefern: die Archivsektion in beiden Zuständen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig archiv-zeilen` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
