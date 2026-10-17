# lauf-schlanker

## Warum

Die Laeufe 3 (`89401f6c`) und 4 (`40d36a23`) des Auftrags `amortisation` liegen als
Mitschrift vor. Lauf 3 brauchte 34 API-Antworten und 2,57 Millionen Token, Lauf 4 32
Antworten und 1,79 Millionen — und in beiden entfaellt mehr als die Haelfte der Aufrufe auf
Dinge, die nichts mit dem Auftrag zu tun haben. In Lauf 4 kosteten Reste des vorigen
Laufs zehn Aufrufe: der Remote-Branch `change/amortisation` stand noch, der Push wurde
abgewiesen, und der Agent suchte einen Weg daran vorbei. Die Abgabe brauchte in beiden
Laeufen fuenf bis acht Aufrufe, weil `gh pr merge --delete-branch` im Arbeitsraum an
`main` scheitert und `git pull --ff-only` danach ebenso. Der Beleg kostete Aufrufe, weil
der Agent das gerenderte SVG oeffnen wollte, was nicht freigegeben ist, und weil er die
Argumentreihenfolge von `belegbild.mjs` erst raten musste. Dazu las er die frisch
angelegten Vorlagen, obwohl sie nur Platzhalter tragen, und suchte das Muster im Archiv
mit `ls` und `find`.

Die Messung selbst hat zwei Fehler, die einen Vergleich verzerren. Claude Code schreibt
eine API-Antwort als mehrere Zeilen mit derselben `message.id` und identischer `usage`;
`summiere` zaehlt jede Zeile, und die Token erscheinen doppelt bis dreifach. Und `lage`
liest den Change-Ordner im Hauptordner des Zielrepos, obwohl der Ablauf im Arbeitsraum
laeuft — beide Laeufe wurden deshalb mit „gates fehlt“ und „kein Beleg“ bewertet, obwohl
alle drei Nachweise im Arbeitsraum lagen.

## Was aendert sich

Eine Messung zaehlt jede API-Antwort einmal, gleich auf wie viele Zeilen sie verteilt
ist, und liest die Lage dort, wo gearbeitet wurde: im Arbeitsraum der Kennung, sonst im
Hauptordner, sonst im Archiv.

Der selbstaendige Lauf startet nicht, solange eine Altlast der Kennung im Zielrepo
liegt — ein Arbeitsraum, ein lokaler oder ferner Branch, ein offener Pull Request, oder
ein `origin/main`, dessen Werkstueck von Stand 0 abweicht. Er nennt je Fund den Handgriff,
der ihn raeumt, und raeumt selbst nichts.

Abgabe und Merge sind je ein Aufruf: `tools/abgabe.mjs` committet, pusht und stellt den
Pull Request, sobald `fertig.md` vorliegt; `tools/merge.mjs` mergt ihn, entfernt den
fernen Branch und zieht den Hauptordner nach — aus dem Arbeitsraum heraus, ohne an `main`
zu scheitern.

Der Rahmen um den Auftrag sagt dem Agenten, wie `belegbild.mjs` seine Argumente liest,
dass das Bild nicht geoeffnet wird, dass die frisch angelegten Artefakte Vorlagen sind
und nicht gelesen werden, und dass der Auftrag vollstaendig ist — kein Blick in Issues.
`neu.mjs` nennt beim Anlegen die drei Dateien des juengsten archivierten Changes als
Muster, damit niemand danach sucht.

## Was ausdruecklich nicht

Der Auftrag `amortisation` bleibt woertlich; sein Pruefwert aendert sich nicht. Die
Einstellungsquellen des Agenten (`--setting-sources`) bleiben, wie sie sind — der
Startkontext soll zwischen den Laeufen vergleichbar bleiben. Die Gates, der Torwaechter
und die Freigabeliste werden nicht angefasst. Nichts wird automatisch geloescht: die
Altlast wird gemeldet, nicht geraeumt. Die Preistabelle bleibt unveraendert.

## Beruehrte Dateien

- `tools/messung.mjs` — eine API-Antwort zaehlt einmal
- `tools/pfade.mjs` — reine Regeln: Orte eines Vorgangs, juengstes Archiv
- `tools/messlauf.mjs` — die Lage aus dem Arbeitsraum lesen
- `tools/testlauf.mjs` — Altlast-Pruefung vor dem Start, Rahmen ergaenzt
- `tools/neu.mjs` — nennt das Muster und warnt vor den Vorlagen
- `tools/abgabe.mjs` — neu: committen, pushen, Pull Request in einem Aufruf
- `tools/merge.mjs` — neu: mergen, fernen Branch entfernen, Hauptordner nachziehen
- `tests/messung.test.mjs` — Regressionstest der Doppelzaehlung
- `tests/pfade.test.mjs` — Tests der neuen reinen Pfadregeln
- `tests/testlauf.test.mjs` — Tests der Altlast-Pruefung und der Rahmen-Anteile
- `tests/neu.test.mjs` — Test des Muster-Hinweises
- `tests/abgabe.test.mjs` — Tests der reinen Regeln von Abgabe und Merge
- `tests/lauf-schlanker-daten.mjs` — die Messpunkte, an denen der Beleg rechnet
- `justfile` — ein Ziel namens abgabe, nur angehaengt
