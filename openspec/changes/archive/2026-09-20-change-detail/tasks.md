# Aufgaben — change-detail

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

Die Wahl der Testdatei: die Prüfungen kommen in die **neue** Datei
`tests/lagebild-detail.test.mjs`, nicht in `tests/lagebild-web.test.mjs`. Die vorhandene
Datei ist mit 514 Zeilen und einem eigenen Wegwerf-Repo bereits voll; eine zweite Datei
neben `tests/lagebild-archiv.test.mjs` und `tests/lagebild-belege.test.mjs` folgt dem
Bestand und hält den Change von einer Datei fern, an der ein anderer Lauf gleichzeitig
arbeiten könnte. Die reinen Leser prüft zusätzlich `ops.py --selftest`, der über
`just test` mitläuft.

## Vor der Umsetzung (rot)

- [x] 1.1 Test `tests/lagebild-detail.test.mjs` schreibt die Szenarien der Spec als
      Erwartung: Nutzlast am selbst gebauten Wegwerf-Repo, Klappstand am Skript der Seite
- [x] 1.2 Erwartungen an die reinen Leser in den Selbsttest von `ops.py` aufnehmen
- [x] 1.3 `just gate2 change-detail` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] 2.1 Reine Leser in `ops.py`: Abschnitte der `proposal.md`, zugesagte Dateien,
      Requirement-Titel mit Szenarienzahl, Abgleich Zusage gegen Diff
- [x] 2.2 Erhebung: Change-Detail je laufendem Change und Diff je Arbeitsbaum gegen `main`
      in `web_erhebung`, ohne das Terminal-Lagebild zu belasten
- [x] 2.3 Nutzlast: `worum`, `anforderungen` und `dateien` je Change in `web_nutzlast`
- [x] 2.4 Seite: vier Klappen mit Anfangszustand, Klappstand des Menschen gewinnt

## Beleg

- [x] 3.1 Beleg der Stufe nachher einliefern: die Nutzlast eines Changes mit allen vier
      Klappen

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig change-detail` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
