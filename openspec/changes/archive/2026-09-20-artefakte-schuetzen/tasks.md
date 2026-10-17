# Aufgaben — artefakte-schuetzen

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] Test `tests/neu.test.mjs` legt einen Change an, dessen Artefakte schon im
      Hauptbranch liegen, und erwartet Abbruch plus unveraenderten Inhalt
- [x] Derselbe Test erwartet, dass nach der Ablehnung kein Arbeitsverzeichnis bleibt
- [x] `just gate2 artefakte-schuetzen` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [x] `tools/neu.mjs` fragt vor dem Anlegen den versionierten Stand, ob es den
      Change-Ordner zu dieser Kennung schon gibt, und bricht dann ab
- [x] Die Meldung nennt den Pfad der vorhandenen Artefakte
- [x] Beleg der Stufe `nachher` einliefern: die Gegenprobe im Wegwerf-Repo als
      sichtbares Artefakt

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig artefakte-schuetzen` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
