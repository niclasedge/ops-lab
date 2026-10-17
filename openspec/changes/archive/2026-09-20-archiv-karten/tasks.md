# Aufgaben — archiv-karten

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] 1.1 `tests/lagebild-archiv.test.mjs` anlegen: die vier Szenarien der Delta-Spec
      an einem Wegwerf-Repo mit Archiv und zweitem Arbeitsbaum
- [x] 1.2 `just gate2 archiv-karten` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] 2.1 Die Erhebung sammelt archivierte Changes je Arbeitsbaum, entdoppelt, ohne
      Historienabfrage
- [x] 2.2 Die Nutzlast führt sie als eigene Liste mit Datum, Aufgaben und Belegen
- [x] 2.3 Die Seite zeigt je archiviertem Change eine Karte mit Aufgabenliste und Bild
- [x] 2.4 `just alles` läuft grün durch
- [x] 2.5 Beleg der Stufe `nachher` einliefern: die Archivsektion der Ansicht

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig archiv-karten` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
