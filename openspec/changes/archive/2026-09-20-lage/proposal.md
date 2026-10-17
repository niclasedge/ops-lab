# lage

## Warum

Wer den Stand des Labors wissen will, muss heute mehrere Quellen befragen. Das Lagebild
`ops.py` kennt die Arbeitsräume, die Changes und ihre Überschneidungen, aber es weiß nichts von
den offenen Ideen: die liegen als GitHub-Issues daneben und tauchen in keiner seiner Ausgaben
auf. Ob ein Arbeitsraum noch gebraucht wird oder nach dem Merge nur noch herumsteht, sagt
ebenfalls keine der beiden Quellen — im Bestand steht genau ein solcher Arbeitsraum, und nichts
weist ihn als überflüssig aus. Was zuletzt abgeschlossen wurde, liegt im Archivordner und muss
von Hand gelesen werden.

Für einen Menschen ist dieses Zusammensuchen lästig. Für einen Agenten, der den nächsten
Schritt vorschlagen soll, ist es teuer: jede Quelle kostet einen eigenen Aufruf und eigene
Token, und wer eine davon vergisst, schlägt Arbeit vor, die schon getan ist. Genau das ist
bereits eingetreten — zwei Sitzungen haben denselben Fehler am selben Nachmittag zweimal
repariert, weil der eine Lauf für den anderen unsichtbar blieb.

Gebraucht wird ein Aufruf, der die vier Fragen beantwortet, aus denen sich der nächste Schritt
ergibt: Was wurde zuletzt fertig, was läuft gerade, was ließe sich ohne Konflikt beginnen, und
was steht nur noch im Weg.

## Was aendert sich

Nach diesem Change beantwortet ein einziger Aufruf den Stand des Repos. `just lage` gibt ein
JSON aus, das die zuletzt archivierten Changes, die aktiven Arbeitsräume, die konfliktfrei
startbaren und die blockierten Changes, die verwaisten Arbeitsräume und die offenen
GitHub-Issues in einer Struktur führt.

Verwaiste Arbeitsräume werden dabei zum ersten Mal überhaupt sichtbar. Ein Arbeitsraum gilt als
verwaist, wenn sein Branch bereits in `main` enthalten ist und unter `openspec/changes` kein
gleichnamiger Ordner mehr liegt — dann ist seine Arbeit gemergt und archiviert, und er steht
nur noch da. Das Aufräumen bleibt ein bewusster Handgriff; das Lagebild sagt künftig nur, dass
einer nötig wäre.

`just lage-kurz` gibt dieselbe Erhebung als eine einzige Zeile aus, knapp genug, um ohne
spürbare Kosten am Anfang einer Sitzung zu stehen.

Bleibt eine Quelle stumm — kein `gh` im Pfad, keine Anmeldung, kein Netz —, so liefert der
Aufruf trotzdem ein Lagebild und vermerkt die ausgefallene Quelle, statt abzubrechen.

## Was ausdruecklich nicht

Kein neues Gate. Dieser Change erhebt einen Stand, er entscheidet nichts und verweigert nichts.

Keine Änderung an `ops.py`. Das Lagebild bleibt, wie es ist, und bleibt abhängigkeitsfrei; das
neue Werkzeug ruft es auf und liest sein JSON, statt es umzubauen.

Kein Aufräumen. Verwaiste Arbeitsräume werden ausgewiesen, nicht entfernt. `git worktree
remove` bleibt ein Handgriff des Menschen, wie es im Bestand gilt.

Keine Agent-Dateien und kein Verteilen von Aufgaben an Subagenten. Der Leitstand, der diese
Erhebung nutzen soll, ist ein eigener Change und setzt diesen hier voraus.

Kein Push, kein Pull Request, kein Merge durch das Werkzeug.

## Beruehrte Dateien

- `tools/lage.mjs` — neu
- `tests/lage.test.mjs` — neu
- `justfile` — nur angehängt, zwei Rezepte am Ende
