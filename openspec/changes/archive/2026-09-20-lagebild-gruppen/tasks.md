# Aufgaben — lagebild-gruppen

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

Der Test geht wie beim vorigen Change durch `--web --trocken` und braucht deshalb kein
FastAPI.

## Vor der Umsetzung (rot)

- [x] `tests/lagebild-gruppen.test.mjs` schreibt die Szenarien der Spec als Erwartung:
      jeder Arbeitsbaum trägt einen Schritt mit Text, Lage aus `tun`, `warten` oder
      `ruhe` und einem Befehlsfeld; uncommittete Änderungen gehen dem Pull Request vor;
      ein abgeschlossener Change verlangt `just pr`; ein gestellter Pull Request wartet;
      ein leerer sauberer Arbeitsbaum ist frei; jeder Change steht in der Gruppe genau
      eines Arbeitsbaums
- [x] `just gate2 lagebild-gruppen` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] `ops.py`: reine Funktion `naechster_schritt` leitet aus Arbeitsstand und Changes
      Text, Lage und Befehl ab, in der Reihenfolge des Ablaufs
- [x] `ops.py`: die Nutzlast führt den Schritt je Arbeitsbaum; die Terminal-Ansicht
      bleibt unverändert
- [x] `ops.py`: die Seite gruppiert — der Arbeitsbaum an der Seite, seine Changes
      daneben auf voller Höhe der Gruppe, ein leerer Baum mit Hinweis
- [x] `ops.py`: die Lage färbt die Gruppe, damit sich beim Blick über alle Bäume das
      Erledigte vom Offenen trennt, ohne zu lesen
- [x] `ops.py --selftest` prüft die Regel Fall für Fall ohne Git und ohne Dateisystem
- [x] Beleg der Stufe `nachher`: ein Bild der gruppierten Ansicht mit sichtbaren
      Schritten einliefern
