# Entscheidungen — worktrees

## Wo die Arbeitsverzeichnisse liegen

**Gewaehlt: `.claude/worktrees/` innerhalb des Repos, nicht mitversioniert.**

Alternative: ein Geschwisterordner neben dem Repo, etwa `../ops-lab-worktrees/`.

Der Tradeoff ist Sauberkeit gegen Auffindbarkeit. Ein Geschwisterordner haelt das
Repo frei von allem, was nicht dazugehoert; er liegt aber ausserhalb dessen, was ein
Werkzeug beim Blick ins Repo sieht. Ein Agent, der den Stand aller Changes ermitteln
soll, muesste dann raten, wo er suchen darf.

Der Ausschlag kommt aus dem Bestand. `ops.py` sucht die Arbeitsverzeichnisse bereits
unter `.claude/worktrees/` — die Zeile steht dort seit dem Aufbau des Lagebilds, nur
hat sie bisher nie etwas gefunden. Dieselbe Konvention gilt in elf weiteren Repos
dieses Rechners. Ein zweiter Ort waere eine Erfindung ohne Not.

Der Preis ist, dass `.gitignore` die Verzeichnisse ausnehmen muss, sonst zeigt jedes
`git status` im Hauptordner fremde Arbeitsstaende als unversioniert an.

## Warum nichts automatisch aufgeraeumt wird

**Gewaehlt: ein Arbeitsverzeichnis bleibt stehen, bis jemand es entfernt.**

Alternative: nach dem Merge des Pull Requests raeumt `just archiv` auch das
Arbeitsverzeichnis weg.

Der Tradeoff ist Ordnung gegen Wiederherstellbarkeit. Ein Arbeitsverzeichnis enthaelt
alles, was nicht committet wurde: halbfertige Notizen, ein Testskript, eine Datei, die
jemand angelegt und vergessen hat. Beim Entfernen ist das weg, und zwar endgueltig —
git kennt es nicht, es gibt keinen Reflog dafuer.

Das Labor hat ausserdem eine ausdrueckliche Regel: nichts loeschen, Changes werden
archiviert. Ein Befehl, der unversionierte Arbeit ohne Rueckfrage entfernt, waere die
erste Ausnahme davon, und sie stuende ausgerechnet am Ende eines Laufs, wenn niemand
mehr hinsieht.

Der Preis ist, dass sich Arbeitsverzeichnisse ansammeln. `git worktree list` zeigt
sie, und `git worktree remove` entfernt eines bewusst. Ob daraus ein eigener Befehl
wird, entscheidet die Erfahrung nach einigen Changes, nicht die Vermutung jetzt.

## Warum der Diff entscheidet und nicht die Zusage

**Gewaehlt: die Anhaenge-Regel prueft `git diff` gegen den Hauptbranch.**

Alternative: der Vorschlag sagt zu, am `justfile` nur anzuhaengen, und Gate 1 glaubt
ihm.

Der Tradeoff ist Aufwand gegen Verbindlichkeit. Eine Zusage im Text ist billig zu
pruefen und genauso billig zu brechen: sie beschreibt eine Absicht, und zwischen
Absicht und Diff liegen zwanzig Arbeitsschritte, in denen sich etwas anderes ergibt.
Der Diff beschreibt, was wirklich geschehen ist.

Das ist dieselbe Begruendung, aus der Gate 2 einen roten Testlauf verlangt statt der
Behauptung, es gebe einen Test. Ein Gate, das einer Zusage glaubt, prueft den Text und
nicht die Arbeit.

Der Preis ist, dass die Pruefung einen Vergleichsstand braucht und damit fehlschlaegt,
wenn der Hauptbranch nicht erreichbar ist. Das ist hinnehmbar: ohne Hauptbranch
schlaegt Gate 2 ohnehin fehl, denn auch die Pruefung auf eine geaenderte Testdatei
vergleicht dagegen.

## Warum die Artefakte gleich im Arbeitsverzeichnis entstehen

**Gewaehlt: der Befehl legt Verzeichnis und Artefakte in einem Zug an.**

Alternative: die Artefakte entstehen wie bisher im Hauptordner und werden anschliessend
verschoben.

Der Tradeoff ist Einfachheit des Codes gegen Einfachheit des Zustands. Verschieben
waere ein kleinerer Eingriff in `neu.mjs`; dafuer gaebe es einen Moment, in dem
dieselben Dateien an zwei Orten existieren und der Hauptordner unversionierte Reste
traegt. Bricht der Befehl in diesem Moment ab, bleibt beides halb.

Ein Arbeitsverzeichnis anzulegen und dann darin zu schreiben hat diesen Zwischenstand
nicht. Schlaegt `git worktree add` fehl, ist nichts geschehen; gelingt es, schreibt der
Befehl nur noch in einen Ordner, den niemand sonst benutzt.

## Anmerkung zum ersten Lauf

Dieser Change kann sich nicht selbst in ein Arbeitsverzeichnis legen — das Werkzeug,
das es tun wuerde, entsteht ja erst in ihm. Das Verzeichnis
`.claude/worktrees/worktrees` wurde deshalb einmalig von Hand angelegt:

    git worktree add .claude/worktrees/worktrees -b change/worktrees

Ab dem naechsten Change uebernimmt das `just neu`. Der Handgriff steht hier, damit
nachvollziehbar bleibt, warum genau dieses eine Verzeichnis anders entstanden ist.
