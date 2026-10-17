# Aufgaben — messlauf

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/messung.test.mjs` schreibt die Szenarien zu Aufwand und Kosten als
      Erwartung: Token je Art, Zaehlung der Werkzeugaufrufe und Schalenbefehle,
      unbekanntes Modell macht die Kosten nicht zu null, fehlende Mitschrift erzeugt
      keine Nullmessung
- [x] `tests/erfuellung.test.mjs` schreibt die sieben Kriterien und die beiden
      Szenarien dazu als Erwartung, dann `just gate2 messlauf` fuer den roten Lauf

## Umsetzung (gruen)

- [x] `tools/messung.mjs`: aus einer Mitschrift Token je Art und Modell, Zahl der
      Werkzeugaufrufe, Zahl der Schalenbefehle, Dauer, Startkontext aus der ersten
      Nachricht und Kosten gegen `preise.json`
- [x] `tools/erfuellung.mjs`: die sieben Kriterien als reine Funktionen ueber Pfade
      und Texte, jedes einzeln als erfuellt oder nicht ausgewiesen
- [x] `tools/messlauf.mjs`: Zielrepo pruefen und zuruecksetzen, Adapter starten,
      Mitschrift finden, Messung ablegen unter `docs/messungen/`; Vergleich zweier
      abgelegter Messungen samt Zehn-Prozent-Schwelle auf den Startkontext
- [x] `tools/preise.json` und `justfile`: Ziele `test-claude`, `messung`, `vergleich`,
      `merge` -- letzteres mit `--admin`, weil die Umgebung den Merge sonst ablehnt
- [x] `docs/messungen/auftrag-amortisation.md` haelt den woertlichen Auftrag zum
      Messstueck fest; `docs/messrahmen.dot` zeichnet den Weg eines Messlaufs und
      wird als Beleg der Stufe `nachher` eingeliefert

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig messlauf` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
