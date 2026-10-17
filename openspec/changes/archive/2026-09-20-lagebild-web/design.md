# Entwurf — lagebild-web

## Entscheidung 1: Woher der Webserver kommt

`CLAUDE.md` sagt für dieses Repo: Python aus der Standardbibliothek, kein Paketmanager,
keine Abhängigkeit. FastAPI und uvicorn sind Fremdbibliotheken. Die Entscheidung ist
also nicht, ob ein Webserver entsteht, sondern was der Grundsatz danach noch wert ist.

**Gewählt: FastAPI und uvicorn über `uv run --with`, geladen erst im Aufruf.**

Das Repo bekommt keine Abhängigkeitsdatei, kein Lock, keine venv. `uv` steht im
`justfile` bereits als Aufrufweg für `ops.py` und löst die Bibliotheken zur Laufzeit auf.
Der Import steht innerhalb der Funktion, die `--web` bedient — damit bleiben `--once`,
`--graph`, `--json` und `--count` nachweisbar abhängigkeitsfrei, und der Selbsttest läuft
in einer Umgebung ohne FastAPI durch. Der Grundsatz wird nicht gebrochen, sondern
präzisiert: das Lagebild bleibt abhängigkeitsfrei, ein zusätzlicher optionaler Befehl ist
es nicht. Genau dieser Satz kommt in `CLAUDE.md`.

Der Preis: `--web` läuft nicht in jeder Umgebung, sondern nur dort, wo `uv` und ein Netz
zum Auflösen da sind. Das ist tragbar, weil `--web` bequem ist und nichts trägt, was der
Ablauf braucht. Kein Gate hängt daran.

**Verworfen: `http.server` aus der Standardbibliothek.** Null Abhängigkeit, der
Grundsatz bliebe wörtlich stehen, und die Daten liefert `to_json` ohnehin fertig — der
Server wäre etwa sechzig Zeilen. Verworfen, weil die Ansicht absehbar wachsen soll:
`beleg-bild` wird Bilder ausliefern wollen, und Dateiauslieferung mit Pfadprüfung von
Hand zu schreiben ist genau die Sorte Arbeit, bei der man sich eine Lücke einbaut. Die
Wahl ist damit eine Wette auf den nächsten Change, nicht auf diesen.

**Verworfen: FastAPI mit `requirements.txt` im Repo.** Der übliche Python-Weg, und für
späteres Wachstum am tragfähigsten. Verworfen, weil eine Abhängigkeitsdatei den
Grundsatz nicht präzisiert, sondern ersetzt: sie lädt dazu ein, die nächste Bibliothek
einfach anzuhängen. Der Unterschied zwischen "eine Datei mit zwei Zeilen" und "ein Repo
mit Abhängigkeiten" ist keiner der Technik, sondern der Gewohnheit.

## Entscheidung 2: Wie die Ansicht prüfbar wird

Gate 1 verlangt eine Testdatei unter `tests/` mit der Endung `.test.mjs`, Gate 2
verlangt, dass sie rot läuft. Dieser Change fasst aber Python an. Ein Test, der den
Server startet, bräuchte FastAPI — und wäre in einer Umgebung ohne uv rot aus dem
falschen Grund.

**Gewählt: `--web --trocken` als geprüfte Tür.** Der Aufruf gibt genau die Nutzlast aus,
die die Ansicht bekommt, startet nichts und lädt nichts nach. Der Node-Test ruft `ops.py`
als Kindprozess auf und prüft das JSON. Getestet wird damit die Logik — was in der
Nutzlast steht, wie sortiert, welche Bereitschaft — und nicht die Verdrahtung von HTTP.

Der Preis: die Route selbst, also FastAPI zwischen Nutzlast und Browser, ist nicht
automatisch geprüft. Das ist hinnehmbar, solange diese Schicht dünn bleibt: sie reicht
die Nutzlast durch und liefert eine Datei aus. Wächst dort Logik, gehört sie in die
Nutzlast, nicht in die Route.

**Verworfen: Test startet den Server und fragt ihn ab.** Prüft mehr, kostet einen
Portbereich, eine Wartezeit und eine Abhängigkeit im Testlauf. Ein Test, der ohne Netz
rot wird, verliert seine Aussage: man gewöhnt sich an, sein Rot zu deuten statt zu
glauben.

## Entscheidung 3: Was der Belegplatz jetzt schon tut

`beleg-bild` liefert Belege ein, dieser Change zeigt sie. Beide sollen parallel laufen,
ohne sich in dieselben Zeilen zu greifen.

**Gewählt: das Feld `belege` entsteht hier, bleibt aber leer.** Jeder Change trägt in
der Nutzlast eine Liste `belege`, und die Ansicht hält je Karte den Platz dafür frei.
Gefüllt wird nichts: kein Ordner wird gelesen, keiner angelegt. `beleg-bild` schreibt
später das Journal, aus dem die Liste kommt, und muss dafür weder die Nutzlast noch die
Seite aufschneiden.

Der Preis: ein Feld ohne Inhalt ist bis dahin totes Gewicht, und wenn `beleg-bild`
anders ausfällt als geplant, passt die Form nicht. Der Schaden wäre klein — eine Liste
umbenennen. Der Nutzen ist, dass die Reihenfolge der beiden Changes offen bleibt.
