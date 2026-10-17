# Aufgaben — leitstand

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/leitstand.test.mjs` hält die fünf Requirements als Erwartung fest
- [x] `just gate2 leitstand` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `tools/leitstand.mjs`: reine Funktion, die aus den drei Nachweisen und dem Zustand des
      Pull Requests entscheidet, ob gemergt werden darf, und den Grund einer Ablehnung nennt
- [x] `tools/leitstand.mjs`: reine Funktionen, die Werkzeugsatz und Schrittfolge aus einer
      Agent- oder Skill-Beschreibung lesen
- [x] `.claude/agents/change-arbeiter.md`: Werkzeugsatz ohne Agentenstart, Auftrag als feste
      Schrittfolge bis zum Pull Request
- [x] `.claude/skills/leitstand/SKILL.md`: Lage erheben, Vorschlag machen, Arbeiter beauftragen,
      über den Merge entscheiden
- [x] `CLAUDE.md`: die Merge-Regel um die benannte Ausnahme mit ihrer Bedingung ergänzen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig leitstand` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
