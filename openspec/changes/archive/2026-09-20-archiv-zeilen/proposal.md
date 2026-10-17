# archiv-zeilen

## Warum

Das Archiv steht seit `archiv-karten` in der Ansicht, aber als zwölf gleich große
Karten mit offener Aufgabenliste. Zusammen sind das 83 Aufgabenzeilen, die jeder sieht,
der die Seite öffnet — auch wer nur wissen will, welche Läufe es gab. Das Archiv
verdrängt damit die Sektionen, um die es im Alltag geht: die laufenden Changes.

Eine Übersicht braucht je Lauf eine Zeile, nicht eine Kachel. Die Einzelheiten — die
abgehakten Aufgaben, der Beleg in Originalgröße — sind das, was man auf Verlangen
aufschlägt, nicht das, was man ungefragt vorgesetzt bekommt.

Dazu fehlt der Nutzlast eine Angabe: welcher Beleg eines Changes die Vorschau stellt.
Heute entscheidet das die Seite in JavaScript, mit einer Regel über Dateiendungen, die
dort weder geprüft noch von außen einsehbar ist. Diese Entscheidung gehört dorthin, wo
alle anderen auch fallen.

## Was ändert sich

Jeder Beleg der Nutzlast sagt, ob er sich als Bild darstellen lässt. Jeder Eintrag der
Archivliste nennt zusätzlich seinen Vorschaubeleg: den sichtbaren Beleg der Stufe
`nachher`, hilfsweise irgendeinen sichtbaren, und nichts, wo es keinen gibt.

Die Seite zeigt daraufhin je archiviertem Change **eine Zeile**: Kennung, Datum,
Aufgabenstand, Gates, Belegzahl und rechts die Vorschau als kleines Bild. Ein Klick auf
die Zeile klappt sie auf — dann stehen der Beleg in großer Ansicht, die Aufgaben mit
ihrem Haken und die übrigen Belege da. Zugeklappt ist die Vorgabe.

## Was ausdrücklich nicht

Die Erhebung ändert sich nicht: es wird kein Beleg zusätzlich gelesen und keine Datei
angefasst. Welche Changes im Archiv stehen und wie sie sortiert sind, bleibt wie es ist,
ebenso die flache Sektion *Belegt* und die Karten der laufenden Changes. Es wird kein
Bild skaliert, beschnitten oder umgewandelt — groß heißt: mit mehr Platz gezeigt.

## Berührte Dateien

- `ops.py`
- `tests/lagebild-archiv.test.mjs`
- `openspec/changes/archiv-zeilen/` (Artefakte und Nachweise dieses Changes)
