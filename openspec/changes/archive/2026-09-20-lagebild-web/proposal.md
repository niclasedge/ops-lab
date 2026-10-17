# lagebild-web

## Warum

Das Lagebild `ops.py` ist heute an ein Terminal gebunden. Es zeichnet den Stand über
alle Worktrees, die Bereitschaft jedes Changes und die Zeitfolge der Fertigstellungen —
aber nur dort, wo es gerade läuft, und nur so lange, wie die Sitzung offen ist. Wer den
Stand jemandem zeigen will, der nicht an derselben Tastatur sitzt, muss ein Terminal
teilen oder abtippen. Die Ausgabe ist zudem auf Terminalbreite beschnitten: die
Zeitfolge bricht nach zwanzig Zeilen ab, lange Aufgabentexte werden gekürzt, und was
nicht auf den Schirm passt, ist nicht da. Beides trifft genau die Frage, die im
Parallelbetrieb ständig gestellt wird — in welchem Worktree wurde wann zuletzt was
geändert, was läuft gerade, was wartet noch auf den Start.

Dazu kommt eine Lücke, die sich absehbar öffnet. Der Change `beleg-bild` bringt Belege
als Bilder und gerenderte Diagramme in die Change-Ordner; seine Abgrenzung verweist
dafür ausdrücklich auf diesen Change hier. Ein Terminal kann ein Bild nicht zeigen. Der
Nachweis, der teuer zu fälschen und billig zu prüfen sein soll, hätte damit kein
Fenster, durch das man ihn prüfen könnte. Solange das fehlt, bleibt das Lagebild eine
Aussage über Zähler und Haken statt über Ergebnisse.

## Was ändert sich

`ops.py` bekommt den Parameter `--web`. Damit startet dasselbe Lagebild, das heute ins
Terminal geht, als HTTP-Ansicht im Browser — auf Port 8765, änderbar über `--web-port`.
Die Ansicht ist nur lesend und bedient sich aus demselben Stand, den `--json` bereits
liefert.

Die Ansicht beantwortet drei Fragen nebeneinander statt untereinander. **Wo** — jeder
Arbeitsbaum mit Branch, Kopfstand, dem Zeitpunkt seiner letzten Änderung und den
geänderten Dateien namentlich, nicht nur als Zähler. **Was läuft** — jeder Change mit
seiner Bereitschaft: frei, läuft, fertig, im PR, blockiert, dazu die bestandenen Gates
und die nächste offene Aufgabe; aufgeklappt zeigt er seine Aufgaben mit Haken.
**Wann** — eine Zeitleiste der Fertigstellungen über alle Arbeitsbäume hinweg, ungekürzt.

Jeder Change steht dabei genau einmal, und zwar bei dem Arbeitsbaum, der ihn bearbeitet.
Seit `just neu` eigene Arbeitsbäume anlegt, liegt derselbe Change-Ordner in mehreren
Bäumen gleichzeitig: einmal im Hauptbaum, wie er dort committet ist, und einmal je Baum,
der ihn gerade ändert. Die Terminal-Ansicht zeigt ihn dann mehrfach, und wer draufsieht,
muss die Kopien von Hand auseinanderhalten. Die Web-Ansicht vergleicht stattdessen den
Inhalt: weicht der Change-Ordner eines Arbeitsbaums vom Hauptbaum ab, gehört der Change
diesem Baum; weicht keiner ab, steht er beim Hauptbaum. Weichen zwei ab, gewinnt der mit
der jüngsten Änderung, und der andere wird im selben Eintrag namentlich genannt — eine
Karte, aber keine verschwiegene Dublette. So zeigt eine Karte pro Change, wo daran
gearbeitet wird, und die Dateiliste daneben zeigt, woran.

Die Nutzlast dieser Ansicht lässt sich ohne Server abrufen: `--web --trocken` gibt genau
das JSON aus, das die Ansicht bekommt, und startet nichts. Das ist die Tür, durch die
der Test geht, und sie braucht keine Fremdbibliothek.

FastAPI und uvicorn kommen ausschließlich über `uv run --with` dazu, also erst beim
Aufruf von `just web`. Das Repo bekommt keine Abhängigkeitsdatei, kein Lock und keine
venv; `ops.py --once`, `--graph` und `--json` laufen unverändert mit der
Standardbibliothek allein. Der Import von FastAPI steht deshalb innerhalb der Funktion,
die `--web` bedient, und nirgends sonst. Fehlt die Bibliothek, sagt das Programm, welcher
Befehl sie mitbringt, statt mit einem Stacktrace abzubrechen.

Jeder Change bekommt in der Nutzlast einen benannten Platz für seine Belege. Dieser
Change füllt ihn nicht — er hält ihn frei. Das Journal aus `beleg-bild` zu lesen und die
Bilder auszuliefern ist Change `lagebild-belege`; es braucht eine eigene Route mit
Pfadprüfung und damit einen eigenen roten Test.

## Was ausdrücklich nicht

Kein Schreiben. Die Ansicht liest den Stand und zeigt ihn. Kein Gate lässt sich von dort
auslösen, keine Aufgabe abhaken, kein Change anlegen. Wer etwas ändern will, nimmt die
Kommandozeile — sonst wandert Ablaufsteuerung in ein Fenster, das niemand prüft.

Kein Belegbild. Weder wird `belege.jsonl` gelesen noch ein Bild ausgeliefert. Das ist
Change `lagebild-belege`: er braucht eine Route, die Bytes aus dem Dateisystem
herausgibt, und deren Pfadprüfung gehört in einen eigenen roten Test, nicht als
Beifang in einen Change über Darstellung. Hier entsteht nur der Platz in der Nutzlast.
Das Einliefern selbst bleibt `beleg-bild` und fasst `tools/` an; dieser Change fasst
`tools/` nicht an.

Kein Dateiinhalt. Die Ansicht nennt die geänderten Dateien beim Namen und sagt, wie sie
geändert sind. Sie zeigt keinen Diff und keinen Dateiinhalt — dafür gibt es `git`, und
eine Ansicht, die Inhalte ausliefert, ist eine andere Art Programm als eine, die zählt.

Keine Zuordnung über Git-Historie. Ob ein Arbeitsbaum einen Change bearbeitet, wird am
Inhalt seines Change-Ordners entschieden, nicht an Branch, Merge-Basis oder Commit-Graph.
Der Inhalt ist das, was man sieht; die Historie erklärt nur, wie er zustande kam.

Keine Authentifizierung, kein Fremdzugriff. Der Server bindet auf `127.0.0.1`. Es gibt
keinen Anmeldedialog, weil es nichts zu schützen gibt, was nicht ohnehin im Repo steht.

Kein Build und kein Paketmanager im Repo. Kein `requirements.txt`, kein `package.json`,
kein Bundler, kein JavaScript-Framework. Die Seite ist eine Datei, die `ops.py` selbst
ausliefert.

Keine Änderung an der Terminal-Ansicht. `--once`, `--graph`, `--json` und `--count`
verhalten sich danach exakt wie vorher; ihre Ausgabe wird nicht umgebaut, um dem Browser
entgegenzukommen.

Kein Dauerbetrieb und kein Dienst. Der Server läuft, solange der Befehl läuft. Keine
Unit-Datei, kein Neustart, keine Ablage von Zuständen zwischen zwei Läufen.

## Berührte Dateien

- `ops.py` — neu: die Nutzlast der Ansicht, die Seite, der Parameter `--web`,
  `--web-port` und `--web --trocken`; dazu der Selbsttest der Nutzlast
- `tests/lagebild-web.test.mjs` — neu: Tests der Nutzlast über `--web --trocken`, also
  ohne FastAPI
- `justfile` — Ziel `web`, das `ops.py --web` über `uv run --with` startet
- `CLAUDE.md` — der Satz über Abhängigkeitsfreiheit nennt die Ausnahme `--web`
- `openspec/changes/lagebild-web/` — die Artefakte dieses Changes

Nicht berührt: `tools/gate.mjs`, `tools/pruefungen.mjs`, `tools/neu.mjs`,
`tools/tokens.mjs`, `tools/sync.mjs`. `sync.mjs` rollt `ops.py` ohnehin mit aus und
braucht dafür keine Änderung.

Überschneidung mit `beleg-bild`: beide Changes hängen ein Ziel an den `justfile`. Die
Ziele stehen in verschiedenen Abschnitten und sind inhaltlich unabhängig; wer zuletzt
merged, trägt sein Ziel neben das andere. Sonst ist der Dateiumfang disjunkt —
`beleg-bild` fasst `ops.py` nicht an, dieser Change fasst `tools/` nicht an.
