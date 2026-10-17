# lauf-sparsamer

## Warum

Der durchgelaufene Lauf `amortisation` (Sitzung `89401f6c`) brauchte 46 Befehle,
davon 27 Schalenbefehle — die Haelfte davon reine Orientierung: `ls`, `find`, `cat`
und Reads der Werkzeugquellen und der Beispiel-Aenderung. Der Rahmen um den Auftrag
nennt den Ablauf, aber nicht das, was den Agenten diese Erkundung erspart.

Drei Luecken kosten jeden Lauf Aufrufe. Erstens probiert der Agent verkettete Befehle
(`&&`, `|`), die der Torwaechter nicht entscheidet — der Aufruf laeuft ins Leere und
wird einzeln wiederholt. Zweitens liest er `neu.mjs`, `gate.mjs`, `pruefungen.mjs`
und `beleg.mjs`, obwohl jedes Werkzeug selbst prueft und meldet, was fehlt — sein
Vertrag genuegte. Drittens sucht er sich das Muster fuer proposal, spec und tasks
selbst, obwohl es mit der juengsten archivierten Aenderung feststeht.

Issue #17 hält den Auftrag fest: gleiche Erfuellung mit weniger Aufrufen.

## Was aendert sich

Der Rahmen sagt dem Agenten vor dem Auftrag drei Dinge: ein Bash-Aufruf traegt genau
einen Befehl (keine Verkettung mit `&&`, `;` oder `|`), die Werkzeuge des Ablaufs samt
ihrem Vertrag, und wo das Muster fuer die drei Artefakte liegt. Mehr Orientierung
steht nicht mehr im Repo — sie steht im Rahmen.

## Was ausdruecklich nicht

Kein neues Werkzeug, keine Aenderung an den Gates, der Freigabeliste oder dem
Torwaechter. Der Auftrag selbst bleibt unberuehrt — er ist das Messstueck, sein
Pruefwert bleibt. Der Rahmen waechst um wenige Zeilen; der Startkontext bleibt damit
innerhalb der Vergleichbarkeitsgrenze.

## Beruehrte Dateien

- `tools/testlauf.mjs` — der Rahmen um den Auftrag
- `tests/testlauf.test.mjs` — Tests der neuen Rahmen-Anteile
- `tests/lauf-sparsamer-daten.mjs` — die Messpunkte, an denen der Beleg rechnet
