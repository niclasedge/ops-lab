# change-detail

## Warum

Die Web-Ansicht zeigt zu einem Change heute eine einzige Klappe: seine Aufgabenliste.
Alles andere, was der Change über sich selbst weiß, bleibt in Dateien liegen, die nur
sieht, wer sie im Editor öffnet. Wer die Karte aufschlägt, erfährt den Stand — nicht das
Vorhaben.

Damit fehlt der Ansicht genau das, was ein Dritter zuerst wissen will. Warum wurde dieser
Change überhaupt aufgesetzt? Was hat sein Autor ausdrücklich ausgeklammert? Welche
Anforderungen hat er zugesagt, und wie viele Fälle beschreibt jede davon? Und vor allem:
deckt sich der Dateiumfang, den `proposal.md` zusagt, mit dem, was der Arbeitsbaum
tatsächlich angefasst hat?

Die letzte Frage ist nicht kosmetisch. Der Parallelbetrieb dieses Repos steht auf der
Zusage im Abschnitt *Berührte Dateien*: zwei Changes laufen nebeneinander, solange ihre
Dateimengen disjunkt sind. Heute prüft diese Zusage niemand gegen die Wirklichkeit. Ein
Change, der still eine vierte Datei anfasst, fällt erst beim Merge auf — dann, wenn der
Konflikt schon da ist.

Alles dafür liegt bereits im Repo. `proposal.md` und die Delta-Spec stehen in jedem
Change-Ordner, die Ansicht hat mit `aufklappbar` eine Klappe, und `geaenderte_dateien`
fragt Git ohnehin schon je Arbeitsbaum. Was fehlt, ist die Zusammenführung.

## Was ändert sich

Ein aufgeklappter Change beantwortet drei Fragen mehr. *Worum es geht* zeigt das Warum und
die Abgrenzung aus `proposal.md`. *Anforderungen* zeigt die Requirement-Titel der
Delta-Spec, jeden mit der Zahl seiner Szenarien. *Dateien* stellt die Zusage aus *Berührte
Dateien* dem gegenüber, was der Arbeitsbaum gegenüber `main` wirklich anfasst — in beide
Richtungen: angefasst ohne Zusage, zugesagt ohne Anfassen, und Deckung als Deckung.

Die Klappen *Worum es geht*, *Dateien* und *Aufgaben* stehen anfangs offen,
*Anforderungen* steht anfangs zu. Anfangs heißt: bis ein Mensch daran rührt. Wer eine
Klappe zuklappt, findet sie nach dem nächsten Takt der Ansicht zugeklappt wieder; die
Vorgabe greift nur dort, wo noch niemand entschieden hat.

Fehlt ein Abschnitt in `proposal.md`, sagt die Karte das. Ein Change ohne Abgrenzung
bekommt einen Hinweis, keinen leeren Kasten.

## Was ausdrücklich nicht

Der Wortlaut von `gate1.md`, `gate2.md` und `fertig.md` kommt nicht auf die Karte — die
Gate-Marken stehen dort bereits, und der Nachweistext wiederholte nur, was die Marke schon
sagt. `design.md` bleibt ebenfalls draußen: es liegt in vier von siebzehn Changes und ist
damit keine Größe, auf die sich eine Ansicht stützen kann.

Die Anforderungen kommen als Titel, nicht im Volltext. `openspec validate` warnt in diesem
Repo schon heute über Requirements jenseits von 500 Zeichen; der Volltext machte die Karte
unlesbar, und die Datei steht jedem offen, der mehr braucht.

Das Archiv bekommt keine neuen Klappen. Ein abgeschlossener Lauf ist eine Zeile über sein
Ergebnis, nicht über sein Vorhaben.

Das Terminal-Lagebild bleibt unberührt, ebenso Kennzahlen, Bereitschaft, Zeitleiste und
die Belegsektion. `ops.py` bleibt ohne Fremdbibliothek: die neuen Leser sind reine
Textfunktionen der Standardbibliothek, der Diff kommt über den Git-Aufruf, den die
Erhebung ohnehin je Arbeitsbaum führt.

## Berührte Dateien

- `ops.py`
- `tests/lagebild-detail.test.mjs` (neu)
- `openspec/changes/change-detail/` (Artefakte und Nachweise dieses Changes)
