# worktrees

## Warum

`just neu` zweigt heute mit `git checkout -b` ab und laesst den Hauptordner auf dem
Branch des neuen Changes stehen. Wer danach an zwei Changes arbeiten will, wechselt
den Branch hin und her; wer den Wechsel vergisst, committet in den falschen.

Genau das ist geschehen und laesst sich beziffern. Vier Commits lagen auf
`change/beleg-bild`, obwohl nur zwei von ihnen zu einem Change gehoerten: `6195ea0`
mischt die Reparatur der Token-Messung mit den Artefakten von `beleg-bild`, `9c11931`
mischt eine Aenderung an `CLAUDE.md` mit den Artefakten von `messlauf`. Ein sauberer
Schnittpunkt existierte hinterher nicht mehr — schon der erste Commit nach `main` war
gemischt, und die Trennung war nur noch durch Chirurgie an der Historie zu haben.

Das Labor misst Parallelbetrieb als eine seiner drei Groessen. Solange ein Ordner
immer nur einen Branch tragen kann, ist Parallelbetrieb aber gar nicht herstellbar:
zwei Agenten im selben Ordner ueberschreiben einander, zwei Agenten in zwei Klonen
teilen keine Historie. Die Zahl, die das Labor erheben will, hat bislang kein Objekt.

Hinzu kommt, dass die Disjunktheit zweier Changes an einer Datei scheitert, die fast
jeder anfasst: dem `justfile`. Nach heutiger Regel schliesst jede Ueberschneidung
Parallelbetrieb aus, und damit schliesst das `justfile` ihn faktisch immer aus. Die
Regel ist zu grob: ein Change, der nur ein Ziel anhaengt, kollidiert mit keinem
anderen, der dasselbe tut.

## Was aendert sich

`just neu` legt den Change nicht mehr im Hauptordner an, sondern in einem eigenen
Arbeitsverzeichnis unter `.claude/worktrees/` plus Change-Kennung. Der Hauptordner
bleibt dabei unveraendert auf seinem Branch stehen. Die Meldung nennt den Pfad, unter
dem gearbeitet wird.

Damit koennen mehrere Changes gleichzeitig ausgecheckt sein, jeder mit eigenem
Arbeitsstand, alle auf derselben Historie. Ein Agent je Verzeichnis arbeitet, ohne
einem anderen den Boden unter den Fuessen wegzuziehen.

Der Aufruf aus einem bestehenden Arbeitsverzeichnis heraus wird abgelehnt. Ein
Arbeitsverzeichnis im Arbeitsverzeichnis waere geschachtelt und beim Aufraeumen nicht
mehr eindeutig zuzuordnen.

Die Regel zur Disjunktheit wird praezisiert und maschinell geprueft. Das `justfile`
zaehlt fuer die Ueberschneidung zweier Changes nicht mit, solange ein Change dort nur
anhaengt und keine Zeile entfernt oder aendert. Gate 1 prueft das: weist der Diff des
Changes gegen `main` fuer das `justfile` auch nur eine geloeschte Zeile aus, faellt
die Pruefung. Damit ist die Ausnahme keine Absprache, sondern eine Bedingung.

## Was ausdruecklich nicht

Kein Aufraeumen bestehender Branches. `change/einsparpotenzial` und
`change/beleg-bild` bleiben, wo sie sind; dieser Change legt nur fest, wie kuenftige
Changes entstehen.

Keine Aenderung an den Gates 2 und Abschluss. Sie arbeiten bereits im
Arbeitsverzeichnis, aus dem sie gerufen werden, und brauchen nichts davon zu wissen.

Kein automatisches Entfernen eines Arbeitsverzeichnisses nach dem Merge. Was dabei
verloren ginge, waere nicht wiederherstellbar; das Aufraeumen bleibt ein eigener,
bewusster Handgriff und damit Sache eines spaeteren Changes.

Keine Ausweitung der `justfile`-Ausnahme auf andere Dateien. Sie gilt fuer diese eine
Datei, weil sie eine Liste von Zielen ist und Listen sich anhaengen lassen. Fuer
`CLAUDE.md` oder `tools/gate.mjs` gilt sie nicht.

## Beruehrte Dateien

- `tools/neu.mjs` — legt ein Arbeitsverzeichnis an statt den Branch zu wechseln
- `tools/pfade.mjs` — ergaenzt um Pfadbildung und Erkennung eines Arbeitsverzeichnisses
- `tools/pruefungen.mjs` — neue reine Funktion fuer die Anhaenge-Regel
- `tools/gate.mjs` — Verdrahtung der neuen Pruefung in Gate 1
- `tests/neu.test.mjs` — neu
- `tests/pfade.test.mjs` — ergaenzt um die beiden neuen Funktionen
- `tests/pruefungen.test.mjs` — ergaenzt um die Anhaenge-Regel
- `.gitignore` — `.claude/worktrees/` wird nicht mitversioniert
- `CLAUDE.md` — der Ablauf beschreibt Arbeitsverzeichnisse statt Branchwechsel
- `openspec/changes/worktrees/` — die Artefakte dieses Changes

Nicht beruehrt: `justfile`, `ops.py`, `tools/tokens.mjs`, `tools/sync.mjs`,
`tools/nachweis.mjs`. `ops.py` kennt den Pfad `.claude/worktrees/` bereits und findet
die neuen Arbeitsverzeichnisse ohne Aenderung.

Dieser Change laeuft **vor** `beleg-bild` und `messlauf`. Nicht wegen einer
Ueberschneidung — die Dateimengen sind disjunkt — sondern weil beide von ihm
profitieren: sie sollen als erste in einem Arbeitsverzeichnis entstehen.
