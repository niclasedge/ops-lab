# Aufgaben — mitschrift-vollstaendig

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/messung.test.mjs` erwartet Spanne, Zeit ohne Pausen und
      unbekannte Dauer bei weniger als zwei Zeitstempeln; dazu die Auswahl echter
      Laeufe ab fuenf Nachrichten
- [x] Test `tests/pfade.test.mjs` erwartet zu einem Repo den Ordner des
      Hauptordners und den jedes Arbeitsraums, fehlende uebersprungen
- [x] `just gate2 mitschrift-vollstaendig` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `tools/messung.mjs`: `dauer(saetze)` und `istLauf(zusammenfassung)` als reine
      Funktionen
- [x] `tools/pfade.mjs`: `mitschriftenOrdner(repo, konfig)` liefert Haupt- und
      Arbeitsraumordner
- [x] `tools/tokens.mjs`: Ziel-Repo als Argument, Beginn aus der Mitschrift, Spalte
      Dauer, Kennzahl ohne Hook-Sitzungen
- [x] `tools/messlauf.mjs`: Dauer in die abgelegte Messung, Arbeitsraeume des
      Zielrepos mitlesen
- [x] `justfile`: Ziel `tokens-test` anhaengen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig mitschrift-vollstaendig`
verlangt, dass keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch"
muesste man abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt,
entwertet die ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
