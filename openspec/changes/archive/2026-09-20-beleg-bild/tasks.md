# Aufgaben — beleg-bild

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/beleg.test.mjs` schreibt die sieben Szenarien der Spec als Erwartung:
      Annahme eines Bildes, Zurueckweisung einer unbekannten Stufe im Modul und am
      Kommandozeilenaufruf, Vermerk einer fehlenden Quelldatei, Ueberleben nach dem
      Loeschen der Quelle, Schreiben nur unterhalb von `belege/`, Ablehnung eines
      Belegs aus Befehl und Ausgabe
- [x] `tests/pruefungen.test.mjs` um die neuen Textregeln ergaenzen und mit
      `just gate2 beleg-bild` den roten Lauf bestaetigen

## Umsetzung (gruen)

- [x] `tools/pruefungen.mjs`: reine Funktionen ueber Belegzeilen — hat der Vorgang
      einen sichtbaren Beleg der Stufe `nachher`, ist ein vorhandener Beleg als
      fehlend vermerkt, welcher Grund steht dabei
- [x] `tools/beleg.mjs`: Vorgangsordner und Stufe entgegennehmen, Quelldatei auf
      regulaere Datei, Groesse und Magic Bytes pruefen, nach `belege/assets/` bzw.
      `belege/artefacts/` kopieren, Zeile an `belege/belege.jsonl` anhaengen
- [x] `tools/gate.mjs`: Pruefung F-5 im Abschluss verdrahten, mit getrennter Meldung
      fuer "kein Beleg" und "Beleg nicht lesbar"
- [x] `justfile`: Ziel `beleg` mit Vorgang, Stufe und Pfad als Argumenten

## Abschluss

- [x] `docs/beleg-pfad.dot` zeichnet den Weg eines Belegs durch dieses Repo, nach
      `docs/beleg-pfad.svg` gerendert und als Beleg der Stufe `nachher` eingeliefert

`just fertig beleg-bild` und `just pr beleg-bild` folgen auf diese Liste und stehen
bewusst nicht darin: F-3 verlangt, dass keine Aufgabe mehr offen ist, und eine
Aufgabe "der Abschluss laeuft durch" waere abgehakt, bevor sie zutrifft.
