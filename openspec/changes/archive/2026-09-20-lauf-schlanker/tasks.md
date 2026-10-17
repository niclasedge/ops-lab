# Aufgaben — lauf-schlanker

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/messung.test.mjs` verlangt, dass drei Zeilen derselben `message.id` einmal zaehlen
- [x] Tests `tests/pfade.test.mjs`, `tests/testlauf.test.mjs`, `tests/abgabe.test.mjs` und `tests/neu.test.mjs` verlangen Vorgangsorte, juengstes Archiv, Altlast-Verweigerung, Rahmen-Anteile, Abgabe- und Merge-Schritte und den Muster-Hinweis
- [x] `just gate2 lauf-schlanker` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `tools/messung.mjs` zaehlt je `message.id` einmal
- [x] `tools/pfade.mjs` und `tools/messlauf.mjs` lesen die Lage im Arbeitsraum
- [x] `tools/testlauf.mjs` verweigert bei Altlast und traegt die neuen Rahmen-Anteile
- [x] `tools/abgabe.mjs` und `tools/merge.mjs` angelegt, `justfile` um `abgabe` ergaenzt
- [x] `tools/neu.mjs` nennt das Muster und warnt vor den Vorlagen
