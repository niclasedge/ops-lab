# Aufgaben — tests-eigenes-repo

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] 1.1 In `tests/lagebild-web.test.mjs` die vier Szenarien der Delta-Spec als eigener
      Abschnitt niederschreiben, gegen ein Wegwerf-Repo, das es noch nicht baut
- [x] 1.2 `just gate2 tests-eigenes-repo` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] 2.1 Den Bau des Wegwerf-Repos in `tests/lagebild-web.test.mjs` ergänzen: Hauptbaum,
      Arbeitsbaum unter `.claude/worktrees/`, zwei Changes mit bekannten Aufgabenlisten
- [x] 2.2 Die auf `--worktree lagebild-web` gefilterten Abschnitte auf das Wegwerf-Repo
      umstellen und ihre Erwartungen auf die dort gesetzten Werte heben
- [x] 2.3 Den Zuordnungstest, der den Change `lagebild-web` beim gleichnamigen Baum
      erwartet, auf das Wegwerf-Repo umstellen
- [x] 2.4 `just alles` läuft grün durch
- [x] 2.5 Beleg der Stufe `nachher` einliefern: die grüne Ausgabe von `just test`

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig tests-eigenes-repo` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
