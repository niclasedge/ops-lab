# Aufgaben — beleg-typ

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] 1.1 `tests/lagebild-belege.test.mjs` um die drei Szenarien der Delta-Spec
      erweitern, mit einem `.dot` im Wegwerf-Repo als Gegenstand
- [x] 1.2 `just gate2 beleg-typ` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] 2.1 Eine reine Funktion in `ops.py` bestimmt den Inhaltstyp einer Belegdatei:
      feste Tabelle, sonst Standardbibliothek, sonst Text
- [x] 2.2 Die Belegroute nennt diesen Typ, statt ihn der Fremdbibliothek zu überlassen
- [x] 2.3 `just alles` läuft grün durch
- [x] 2.4 Beleg der Stufe `nachher` einliefern: die Antwortköpfe der Route

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig beleg-typ` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
