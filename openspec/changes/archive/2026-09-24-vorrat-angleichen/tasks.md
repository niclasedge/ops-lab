# Aufgaben — vorrat-angleichen

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/neu.test.mjs` erwartet die Ablehnung ohne Issue-Nummer und die Herkunftszeile
      im `proposal.md`
- [x] Test `tests/gate-projekt.test.mjs` erwartet den Testbefehl aus `tools/gate.projekt.json`
      und den Rückfall ohne diese Datei
- [x] Test `tests/lage.test.mjs` erwartet `ohne_issue` mit Grund
- [x] `just gate2 vorrat-angleichen` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `tools/neu.mjs`, `tools/gate.mjs`, `tools/lage.mjs` und `tools/pruefungen.mjs` auf den
      Stand aus `consumer-repo` ziehen
- [x] Bestehende Tests, die den alten Stand festhalten, auf das neue Verhalten nachziehen
- [x] `.claude/agents/change-arbeiter.md` und `.claude/skills/leitstand/SKILL.md` nachziehen:
      Issue-Nummer im Auftrag, Wurzel aus `git rev-parse` statt hart geschriebenem Pfad

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig vorrat-angleichen` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
