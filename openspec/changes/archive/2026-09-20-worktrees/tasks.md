# Aufgaben — worktrees

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/pfade.test.mjs` ergaenzen: der Pfad eines Arbeitsverzeichnisses wird aus
      Hauptordner und Change-Kennung gebildet, und ein Pfad innerhalb von
      `.claude/worktrees/` wird als Arbeitsverzeichnis erkannt
- [x] `tests/pruefungen.test.mjs` ergaenzen: die Anhaenge-Regel besteht bei reinen
      Hinzufuegungen und faellt bei einer entfernten Zeile, mit Nennung der Zahl
- [x] `tests/neu.test.mjs` neu: in einem temporaeren Repo legt der Befehl ein
      Arbeitsverzeichnis an, der Hauptordner behaelt Branch und Arbeitsstand, und ein
      Aufruf aus einem Arbeitsverzeichnis heraus wird abgelehnt; danach
      `just gate2 worktrees` fuer den roten Lauf

## Umsetzung (gruen)

- [x] `tools/pfade.mjs`: die beiden reinen Funktionen fuer Pfadbildung und Erkennung
- [x] `tools/pruefungen.mjs` und `tools/gate.mjs`: die Anhaenge-Regel als achte
      Pruefung in Gate 1, mit dem Diff gegen den Hauptbranch als Grundlage
- [x] `tools/neu.mjs`: Arbeitsverzeichnis anlegen statt Branch wechseln, Artefakte
      dort ablegen, Aufruf aus einem Arbeitsverzeichnis ablehnen
- [x] `.gitignore` um `.claude/worktrees/` ergaenzen und `CLAUDE.md` auf den neuen
      Ablauf umstellen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig worktrees` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf — und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
