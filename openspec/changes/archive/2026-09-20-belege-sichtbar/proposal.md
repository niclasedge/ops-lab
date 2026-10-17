# belege-sichtbar

## Warum

Wer `just web` startet, sieht keinen einzigen Beleg — obwohl sechs im Repo liegen, zwei davon
als PNG. Drei Stellen verhindern das unabhängig voneinander. Erstens setzt `web_nutzlast` das
Feld `belege` jedes Changes fest auf die leere Liste; das Journal `belege/belege.jsonl`, das
`tools/beleg.mjs` bei jedem Einliefern fortschreibt, wird nirgends gelesen. Zweitens kennt die
Web-Ansicht nur zwei Routen, `/` und `/api/stand`: die Seite baut zwar ein `img`-Element, aber
niemand liefert die Bilddatei aus, und der Browser bekommt eine 404. Drittens gehören alle
sechs Belege zu archivierten Changes, und archivierte Changes stehen gar nicht in der Nutzlast.
Damit ist der Beleg genau das, was er nicht sein sollte: ein Nachweis, den der Abschluss
erzwingt und den danach niemand ansieht. Der Abschluss prüft ihn über das Journal, F-5 ist
grün, und das Ergebnis verschwindet im Ordner. Ein Bild, das keiner sieht, misst nichts.

## Was ändert sich

Die Nutzlast führt zu jedem Change seine Belege aus dem Journal, mit Stufe, Art, Zeitpunkt und
einer Adresse, unter der die Datei abrufbar ist. Zusätzlich führt sie eine Sektion `belege`:
alle Belege über alle Changes, auch die archivierter, jüngste zuerst. Die Web-Ansicht bekommt
eine dritte, nur lesende Route, die genau diese Dateien ausliefert — und nichts sonst. Im
Browser erscheinen die Belege als Galerie, und an der Change-Karte steht, was zu diesem Change
eingeliefert wurde. Damit wird aus dem Nachweis wieder etwas, das man ansieht.

## Was ausdrücklich nicht

Es werden keine Belege nachträglich erzeugt. Die sechs vorhandenen werden sichtbar; ein Beleg,
der beim Abschluss nicht entstanden ist, entsteht auch nicht rückwirkend. Archivierte Changes
werden nicht in die Liste `changes` aufgenommen: sie hätten weder Arbeitsbaum noch Zuordnung
noch Abweichung, und jede dieser Regeln müsste einen Sonderfall bekommen. Sie erscheinen nur
in der Belegsektion, mit Namen und Kennzeichen. Die Auslieferung liest ausschließlich, kennt
keinen Upload und keine Löschung. `tools/beleg.mjs` und die Gates bleiben unberührt — was ein
Beleg ist und wann er zählt, entscheidet weiterhin das Journal.

## Berührte Dateien

- `ops.py`
- `tests/lagebild-belege.test.mjs` (neu)
- `.gitignore` (eine Zeile angehängt: der Test importiert `ops.py`, dabei fällt Bytecode an)
- `openspec/changes/belege-sichtbar/` (Artefakte und Nachweise dieses Changes)
