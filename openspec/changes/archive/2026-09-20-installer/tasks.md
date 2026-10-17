# Aufgaben — installer

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/install.test.mjs`: die erste Stufe legt Skill und Arbeiter im
      Konfigurationsordner ab, die zweite Werkzeuge, openspec-Gerüst und Tests im Zielprojekt
- [x] Test `tests/install.test.mjs`: ein zweiter Lauf ersetzt die vorhandene globale Fassung
      und lässt den Markierblock im `justfile` genau einmal stehen

## Umsetzung (gruen)

- [x] `tools/install.mjs`: erste Stufe in den Konfigurationsordner aus der Umgebung,
      einschließlich Ersetzen einer vorhandenen Fassung
- [x] `tools/install.mjs`: zweite Stufe in das Zielprojekt — Werkzeuge, Lagebild,
      openspec-Gerüst, Tests
- [x] `tools/install.mjs`: den Markierblock im `justfile` anlegen und bei erneutem Lauf
      ersetzen
- [x] `tools/install.mjs`: den Übergabetext für die `CLAUDE.md` des Zielprojekts ausgeben
- [x] `.claude/skills/leitstand/SKILL.md`: der ausgeschriebene Pfad weicht dem
      Arbeitsverzeichnis
- [x] `justfile`: das Ziel `install` anhängen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig installer` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
