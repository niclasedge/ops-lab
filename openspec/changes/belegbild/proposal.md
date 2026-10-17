# belegbild

## Warum

Der Abschluss fordert einen Beleg der Stufe `nachher`, der ein Bild oder ein
Graph-Artefakt ist. Woher das Bild kommt, sagt der Ablauf nicht — `tools/beleg.mjs`
nimmt eine fertige Datei entgegen, erzeugt sie aber nicht. Im Lauf bd8914a3 schrieb
sich der Agent deshalb selbst einen Renderer, legte ihn ausserhalb von `tools/` ab
und blieb am Torwaechter stehen, der nur `node tools/*.mjs` durchlaesst. Der Lauf
kam nie bis `fertig`.

Wer das Bild stattdessen von Hand schreibt, rechnet ein zweites Mal neben der
Umsetzung. Ein Bild, dessen Zahlen niemand gerechnet hat, belegt nichts — es ist
dieselbe Behauptung wie im Verlauf, nur bunter.

## Was aendert sich

`node tools/belegbild.mjs` rendert aus einer Funktion des Werkstuecks ein SVG: der
Aufrufer nennt Modulpfad und Funktionsnamen, Achsengrenzen und einzelne Faelle, das
Werkzeug ruft die Funktion auf und zeichnet, was zurueckkommt. Jede Zahl im Bild ist
ein echter Aufruf. Danach wird das Bild wie jeder andere Beleg eingeliefert.

## Was ausdruecklich nicht

Kein Einliefern — das bleibt `tools/beleg.mjs`. Kein anderes Diagramm als die Kurve
einer Funktion, kein anderes Format als SVG. Keine Interaktion, keine Abhaengigkeit:
gezeichnet wird mit einer SVG-Zeichenkette aus der Standardbibliothek. `src/` des
Zielrepos wird nur gelesen, nie veraendert.

## Beruehrte Dateien

- `tools/belegbild.mjs` (neu) — reine Funktionen fuer Proben, Achsen und Bild
- `tests/belegbild.test.mjs` (neu) — Tests der reinen Funktionen und der Kommandozeile
- `tests/belegbild-beispiel.mjs` (neu) — Fixture, an der Test und Beleg rechnen
- `justfile` — ein Ziel `belegbild`, nur angehaengt
