# mitschrift-vollstaendig

## Warum

Die Messung soll belegen, ob eine Änderung am Ablauf den Aufwand senkt. Zwei Lücken
verhindern das heute.

Erstens die Dauer. Die Capability `messung` verlangt sie seit ihrem ersten Requirement
ausdrücklich: „Dauer in Sekunden". Kein Werkzeug im Repo liest jemals das Feld
`timestamp` aus einer Mitschrift — weder `tools/messung.mjs` noch `tools/tokens.mjs`.
Die Spec behauptet damit eine Größe, die der Code nicht liefert, und die Frage „wie
lange hat ein Lauf gedauert" ist aus dem Bestand nicht zu beantworten.

Zweitens die Arbeitsräume. Der Ablauf schreibt vor, dass jeder Change in
`.claude/worktrees/` seinen eigenen Arbeitsraum bekommt und dort gearbeitet wird.
Claude Code legt seine Mitschrift aber je Arbeitsverzeichnis ab — ein Lauf im
Arbeitsraum landet also in einem anderen Ordner als ein Lauf im Hauptordner. Der
Messrahmen fragt nur den Hauptordner ab. Wer den Ablauf befolgt, wird nicht gemessen;
wer ihn umgeht, schon. Der Bestand zeigt das: acht Mitschriftenordner zu Arbeitsräumen
dieses Repos enthalten ausschließlich Sitzungen mit einer einzigen Nachricht.

Dazu kommt, dass `tools/tokens.mjs` nur das eigene Arbeitsverzeichnis auswerten kann.
Das Lagebild kennt mit `just ops-test` längst den Blick ins Testrepo; die Token-Messung
kennt ihn nicht. Gemessen werden soll aber dort, wo der Ablauf angewendet wird.

## Was ändert sich

Eine Messung weist die Dauer eines Laufs aus, und zwar zwei Größen getrennt: die Spanne
vom ersten bis zum letzten Eintrag, und die Zeit ohne Pausen. Beides wird aus den
Zeitstempeln der Mitschrift gerechnet, nicht aus dem Änderungsdatum der Datei — dieses
verschiebt sich, sobald ein Hook die Datei anfasst.

Der Messrahmen findet die Mitschriften eines Repos vollständig: den Hauptordner und
jeden seiner Arbeitsräume. Ein Lauf, der dem Ablauf folgt, ist damit messbar.

`just tokens-test` zeigt die Token je Lauf für das Testrepo, aufgerufen von hier aus.
Die Übersicht nennt den Beginn aus der Mitschrift statt des Dateidatums, weist die
Dauer aus und blendet Sitzungen unterhalb von fünf Nachrichten aus der Kennzahl aus.
Diese Sitzungen sind Hook-Aufrufe, keine Läufe; im Bestand stellen sie zehn von
dreizehn Einträgen und ziehen den Median auf einen Wert, der keinen Lauf beschreibt.

## Was ausdrücklich nicht

Die Einheit bleibt die Sitzung. Eine Zuordnung von Lauf zu Change findet nicht statt —
dafür bräuchte es eine belastbare Regel, welche Sitzung zu welchem Change gehört, und
die ist ein eigener Change wert.

`tools/tokens.mjs` bekommt keine Kostenspalte. Kosten rechnet `tools/messung.mjs` gegen
`tools/preise.json`, und das bleibt die einzige Stelle im Repo, die Preise kennt.

Die Preistabelle, der Erfüllungsgrad, der Vergleich zweier Messungen und die Adapter
bleiben unberührt. `ops.py` wird nicht angefasst.

## Berührte Dateien

- `tools/messung.mjs` — reine Funktionen für Dauer und für die Auswahl echter Läufe
- `tools/pfade.mjs` — reine Funktion für die Mitschriftenordner eines Repos
- `tools/tokens.mjs` — Ziel-Repo, Beginn, Dauer, Rauschfilter
- `tools/messlauf.mjs` — Dauer in die abgelegte Messung, Arbeitsräume mitlesen
- `tests/messung.test.mjs` — Tests der neuen reinen Funktionen
- `tests/pfade.test.mjs` — Tests der Ordner-Auflösung
- `justfile` — ein Ziel `tokens-test`, nur angehängt
