# tests-eigenes-repo

## Warum

`tests/lagebild-web.test.mjs` filtert fast jeden Lauf mit `--worktree lagebild-web` und liest
an einer Stelle `openspec/changes/lagebild-web/tasks.md`. Das machte den Lauf deterministisch,
solange dieser Arbeitsraum existierte. Nach dem Merge und dem vorgesehenen `git worktree remove`
waren 16 von 20 Tests dieser Datei rot, ohne dass sich eine Zeile Produktionscode geändert hatte.
Ein weiterer Test derselben Datei war schon vorher gefallen: er erwartet den Change `lagebild-web`
beim gleichnamigen Baum, nach dem Merge liegt er aber inhaltsgleich auf `main` und gehört damit
korrekt dem Hauptbaum. Kein Gate kann das fangen, denn zum Zeitpunkt von Gate 2 und Abschluss ist
der Zustand noch da und die Tests sind grün. Der Preis trifft den, der sich an die Anleitung hält:
Aufräumen macht die Testsuite rot. Wer die Tests danach wieder grün bekommen will, hat die Wahl
zwischen einem Arbeitsraum, der nur noch für den Test weiterlebt, und einer Änderung an den Tests
selbst — beides zur falschen Zeit. Dahinter steht außerdem eine ungeprüfte Zusage: `ops.py --root`
verspricht, ein fremdes Repo zu beobachten, und keine Zeile hält das heute fest.

## Was ändert sich

`tests/lagebild-web.test.mjs` baut sich sein Repo künftig selbst: ein Wegwerf-Repo im
Temporärverzeichnis mit einem Hauptbaum, einem Arbeitsraum unter `.claude/worktrees/` und zwei
Changes mit bekannten Aufgabenlisten. Geprüft wird `ops.py --root` auf dieses Repo, mit `--web --trocken`.
Damit stehen die Erwartungen auf Werten, die der Test selbst gesetzt hat — „genau ein Worktree"
wird zu „dieser Worktree mit diesem Namen, diesem Branch, diesen Zählern". Der Lauf ist unabhängig
davon, was im ops-lab gerade offen, gemerged oder aufgeräumt ist, und das Aufräumen eines
Arbeitsraums ist wieder ein Handgriff ohne Nebenwirkung. Nebenbei wird `--root` zum ersten Mal
spezifiziert und nachgewiesen.

## Was ausdrücklich nicht

Kein neues Gate. Kein Gate kann diesen Fehler sehen, und eine Prüfung, die andere Testdateien auf
dieses Muster hin absucht, wäre eine Textheuristik mit Falschtreffern — `worktrees` ist im Bestand
sowohl ein Change-Name als auch ein Feld der Nutzlast. An `ops.py` wird nichts geändert; der Change
prüft vorhandenes Verhalten, er baut keines. `tests/lagebild-gruppen.test.mjs` bleibt unberührt: es
läuft ungefiltert über Invarianten und ist beim Aufräumen grün geblieben. Die vier Tests unter
*Die Zeitleiste steht absteigend und ungekürzt* und die Abschnitte, die schon heute ungefiltert
über alle Arbeitsbäume prüfen, bleiben am echten Repo — sie prüfen Invarianten, nicht Namen.

## Berührte Dateien

- `tests/lagebild-web.test.mjs`
- `openspec/changes/tests-eigenes-repo/` (Artefakte und Nachweise dieses Changes)
