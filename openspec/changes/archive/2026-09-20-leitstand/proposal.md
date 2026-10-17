# leitstand

## Warum

Ein Change durchläuft im Labor immer dieselbe Kette: anlegen, Artefakte schreiben, Gate 1,
roten Test schreiben, Gate 2, umsetzen, Abschluss, Pull Request, Merge, Archiv. Jeder Schritt
ist geregelt und jeder ist prüfbar. Jeder wird auch von Hand angestoßen.

Bei einem Change ist das richtig. Bei fünf konfliktfrei startbaren Changes ist es Fleißarbeit:
dieselbe Kette fünfmal, nacheinander, obwohl die Arbeitsräume genau dafür gebaut wurden, dass
sie nebeneinander stehen können. Die Person am Rechner wird zum Taktgeber für etwas, das keinen
Takt braucht, und ihre Aufmerksamkeit geht für das Abtippen von Rezeptnamen drauf statt für die
Entscheidungen, die tatsächlich eine brauchen.

Was fehlt, ist kein weiteres Werkzeug in der Kette. Es fehlt jemand, der die Kette führt: der
weiß, was frei und was blockiert ist, der Arbeit auf getrennte Arbeitsräume verteilt, der
wartet, bis ein Gate geantwortet hat, und der den Menschen dann fragt, wenn wirklich etwas zu
entscheiden ist.

Dem steht heute eine Regel im Weg. Merge und Push verlangen eine ausdrückliche Anweisung in der
jeweiligen Aufgabe. Diese Vorsicht ist richtig, solange ein Mensch die Gates selbst liest. Wenn
aber drei Gates nacheinander grün gemeldet haben, ihre Nachweise als Dateien im Change liegen
und der Pull Request seine eigenen Prüfungen bestanden hat, verlangt diese Regel eine Zusage zu
etwas, das bereits bewiesen ist. Sie fragt nicht mehr nach Urteil, sondern nach einem Klick.

## Was aendert sich

Nach diesem Change genügt in einer Sitzung ein Aufruf des Leitstands. Er erhebt die Lage, meldet
sie in wenigen Zeilen und schlägt vor, welche Changes jetzt laufen könnten. Nimmt die Person am
Rechner den Vorschlag an, beauftragt der Leitstand für jeden angenommenen Change einen eigenen
Arbeiter: eigener Arbeitsraum, eigener Kontext, ein Change, kein zweiter.

Der Arbeiter ist auf die Kette festgelegt. Er legt den Change an, schreibt die Artefakte, holt
Gate 1, schreibt danach ausschließlich den Test und hält an, bis Gate 2 den roten Lauf bestätigt
hat, setzt erst dann um, holt den Abschluss und stellt den Pull Request. Kommt ein Gate nicht
durch, hält er an und meldet den Stand, statt das Gate zu umgehen.

Gemergt wird nicht vom Arbeiter, sondern vom Leitstand — und dafür bekommt er eine benannte
Befugnis. Liegen gate1.md, gate2.md und fertig.md im Change und ist der Pull Request grün, so
merged der Leitstand ohne weitere Rückfrage. Fehlt einer der Nachweise oder ist der Pull Request
nicht grün, fragt er. Die bisherige Regel bleibt für alles andere bestehen; sie bekommt eine
Ausnahme mit Namen und Bedingung, keine Aufweichung.

## Was ausdruecklich nicht

Kein Dauerlauf, kein Dienst, kein Nachtlauf. Der Leitstand lebt in der Sitzung, in der er
aufgerufen wurde; wird sie geschlossen, endet er. Unbeaufsichtigtes Arbeiten über Stunden bleibt
außerhalb dieses Changes.

Kein Umgehen und kein Aufweichen der Gates. Der Arbeiter durchläuft dieselben drei Stufen wie
ein Mensch und darf sie weder überspringen noch nachträglich anpassen.

Kein Merge durch den Arbeiter. Er endet beim Pull Request; die Entscheidung darüber bleibt beim
Leitstand.

Kein Aufräumen verwaister Arbeitsräume. Der Leitstand weist sie aus und schlägt den Handgriff
vor; ausgeführt wird er vom Menschen.

Keine Änderung an der Lageerhebung selbst. Der Leitstand ruft sie auf und liest ihr JSON.

Keine Änderung an den Gates, am `justfile` und an `ops.py`.

## Beruehrte Dateien

- `.claude/agents/change-arbeiter.md` — neu
- `.claude/skills/leitstand/SKILL.md` — neu
- `tools/leitstand.mjs` — neu
- `tests/leitstand.test.mjs` — neu
- `CLAUDE.md` — die Merge-Regel erhält eine benannte Ausnahme
