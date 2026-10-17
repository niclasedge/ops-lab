# Aufgaben — lage

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/lage.test.mjs` hält die vier Requirements als Erwartung fest
- [x] `just gate2 lage` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `tools/lage.mjs`: reine Funktionen für verwaiste Arbeitsräume und für die Kurzfassung,
      beide ohne Zugriff auf Platte oder Prozess
- [x] `tools/lage.mjs`: Erhebung aus dem Lagebild, aus den offenen Ideen und aus dem Archiv,
      eine stumme Quelle wird vermerkt statt geworfen
- [x] `tools/lage.mjs`: Ausgabe als JSON, auf Verlangen als einzelne Zeile
- [x] Rezepte `lage` und `lage-kurz` ans Ende des `justfile` anhängen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig lage` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
