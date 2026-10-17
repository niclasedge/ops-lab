# Aufgaben — lagebild-web

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

Der Test geht durch `--web --trocken` und braucht deshalb kein FastAPI. Er läuft in
jeder Umgebung, in der `just test` schon heute läuft.

## Vor der Umsetzung (rot)

- [x] `tests/lagebild-web.test.mjs` schreibt die Szenarien der Spec als Erwartung:
      Trockenlauf liefert `worktrees`, `changes` und `zeitleiste` mit Exit 0; jeder
      Arbeitsbaum trägt Branch, Kopfstand, Zeitpunkt und seine geänderten Dateien
      einzeln mit Art; jeder Change trägt Bereitschaft, Aufgabenliste, Gates,
      Zuordnung und ein leeres Feld `belege`; ein Change steht genau einmal, beim
      Baum der ihn ändert; die Zeitleiste steht absteigend und ungekürzt
- [x] `just gate2 lagebild-web` bestätigt den roten Lauf

## Umsetzung (grün)

- [x] `ops.py`: reine Funktion `web_nutzlast` baut aus dem Stand die drei Teile
      `worktrees`, `changes` und `zeitleiste`, jeder Change mit seinen Aufgaben und
      leerem Feld `belege`
- [x] `ops.py`: `--web`, `--web-port` und `--web --trocken` verdrahten; `starte_web`
      importiert FastAPI erst innerhalb der Funktion und meldet bei fehlender
      Bibliothek den Weg über `just web` statt eines Stacktrace
- [x] `ops.py`: `change_signatur` und `ordne_changes_zu` — der Inhalt des
      Change-Ordners entscheidet, welcher Arbeitsbaum einen Change bearbeitet; jeder
      Change steht danach genau einmal und weist aus, ob er abweicht
- [x] `ops.py`: `geaenderte_dateien` liest `git status --porcelain` je Arbeitsbaum und
      gibt Pfad und Art einzeln aus, nach Pfad sortiert
- [x] `ops.py`: die Seite als eine ausgelieferte Datei — Arbeitsbäume mit Dateiliste,
      Changes als Karten mit Bereitschaft und Zeitpunkt, auf Klick die Aufgaben mit
      Haken, Zeitleiste darunter, Belegplatz angelegt und leer
- [x] `ops.py --selftest` prüft Nutzlast, Zuordnung und Dateiliste mit; `justfile`
      bekommt `web` und `web-trocken`, `CLAUDE.md` nennt die Ausnahme für `--web`

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig lagebild-web` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen "just fertig läuft durch" müsste man abhaken,
bevor es laufen darf — und ein Haken, den man vorab setzt, entwertet die ganze Liste.
Den Abschluss belegen gate1.md, gate2.md und fertig.md.
