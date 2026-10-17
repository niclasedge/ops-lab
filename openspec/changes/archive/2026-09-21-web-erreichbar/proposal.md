# web-erreichbar

## Warum

Das Lagebild läuft in einer virtuellen Maschine, gearbeitet wird am Host davor. Wer die
Ansicht sehen will, sitzt also nicht auf demselben Rechner, auf dem sie läuft. Heute bindet
`ops.py --web` fest auf `127.0.0.1`; die Adresse ist damit ausschließlich innerhalb der VM
erreichbar, und vom Host aus antwortet nichts. Es gibt keinen Schalter, der das ändert — die
Adresse steht als Zeichenkette im Aufruf von `uvicorn.run`.

Dazu kommt ein zweiter Stolperstein am selben Befehl. Die Vorgabe `8765` ist auf dieser
Maschine bereits vergeben: dort hört der Dienst `git-planner-go`, der den Report-Store
für `report-tool` hält. Der Zusammenstoß meldet sich heute als Traceback aus der Fremdbibliothek
— `[Errno 98] error while attempting to bind on address` —, nachdem die Startzeile bereits
„Lagebild: http://127.0.0.1:8765" ausgegeben hat. Die Ansicht behauptet also zu laufen, und
erst die Zeile darunter widerspricht.

Beides trifft denselben Menschen an derselben Stelle: er ruft die Ansicht auf und bekommt
entweder nichts zu sehen oder eine Fehlermeldung, die nicht sagt, was zu tun ist.

## Was aendert sich

Die Bindeadresse wird angebbar: `--web-host` nimmt die Adresse entgegen, auf der die Ansicht
hört, und behält `127.0.0.1` als Vorgabe. Wer `--web-host 0.0.0.0` setzt, erreicht das
Lagebild vom Host der VM aus.

Die Startzeile nennt, was gilt: bei einer Bindung, die über den eigenen Rechner hinausgeht,
steht der Hinweis auf das lokale Netz dabei — sichtbar, bevor jemand sich wundert, wer alles
mitlesen kann.

Ein belegter Port meldet sich als Satz statt als Traceback, nennt den Port und den Schalter,
mit dem ein anderer zu wählen ist, und beendet den Aufruf mit einem eigenen Exit-Code. Geprüft
wird das, bevor FastAPI überhaupt geladen wird — die Meldung kommt damit auch in einer
Umgebung ohne Fremdbibliothek.

## Was ausdruecklich nicht

Keine Authentifizierung, keine Rechteprüfung, kein TLS. Die Ansicht bleibt nur lesend und für
das vertraute lokale Netz gedacht; wer sie weiter öffnet, entscheidet das mit `--web-host`
bewusst und sieht es in der Startzeile.

Die Vorgabe des Ports bleibt `8765`, und das `justfile` wird nicht angefasst. Ein anderer
Standard wäre eine Änderung an einer bestehenden Zeile des `justfile` und damit ein Verstoß
gegen G1-8; die Kollision wird stattdessen gemeldet und ist mit `--web-port` in einem Wort
gelöst.

Keine automatische Suche nach einem freien Port. Ein Dienst, der sich seinen Port selbst
sucht, ist später nicht mehr zu finden.

## Beruehrte Dateien

- `ops.py`
- `tests/lagebild-web.test.mjs`
- `docs/beobachtungen.md`
- `docs/web-erreichbar.dot`
- `docs/web-erreichbar.svg`
- `openspec/changes/web-erreichbar/proposal.md`
- `openspec/changes/web-erreichbar/specs/lagebild/spec.md`
- `openspec/changes/web-erreichbar/tasks.md`
