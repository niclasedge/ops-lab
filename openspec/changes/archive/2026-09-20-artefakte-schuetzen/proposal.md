# artefakte-schuetzen

## Warum

Der Change `worktrees` hat `just neu` auf Arbeitsraeume umgestellt und dabei eine
Pruefung verloren. Frueher brach der Befehl ab, wenn es den Ordner
`openspec/changes` plus Kennung schon gab; danach prueft er nur noch, ob der
Arbeitsraum belegt ist. Beides ist nicht dasselbe: ein frischer Arbeitsraum wird von
`main` abgezweigt und enthaelt daher alle Changes, die dort liegen.

Wer also einen Change anlegt, dessen Artefakte schon auf `main` liegen, bekommt einen
neuen Arbeitsraum -- und die Vorlage schreibt `proposal.md`, `tasks.md` und die
Delta-Spec kommentarlos ueber den vorhandenen Inhalt. Eine Gegenprobe in einem
Wegwerf-Repo hat das bestaetigt: eine Datei mit eigenem Text las hinterher wieder die
Vorlage.

Der Verlust faellt nicht auf. `git status` im Arbeitsraum zeigt geaenderte Dateien,
was nach dem Anlegen eines Changes erwartbar aussieht, und die Meldung des Befehls
nennt die drei Pfade so, als waeren sie eben entstanden. Erst beim Lesen des Vorschlags
merkt jemand, dass die Arbeit von gestern fehlt.

Betroffen ist jeder, der einen Change ein zweites Mal anlegt -- nach einem
entfernten Arbeitsraum, nach einem Tippfehler in der Kennung, oder weil der Change
schon geplant und noch nicht umgesetzt war. Der naechste Change dieses Repos,
`messlauf`, ist genau dieser Fall: seine Artefakte liegen auf `main`.

## Was aendert sich

`just neu` fragt den versionierten Stand, bevor es etwas anlegt: fuehrt der Branch,
von dem abgezweigt wird, unter `openspec/changes` schon einen Ordner zu dieser
Kennung, bricht der Befehl ab. Es entsteht dann weder ein Arbeitsraum noch ein
Branch noch eine Datei.

Die Pruefung laeuft vor dem Anlegen und nicht danach. Ein Rueckbau waere die
naheliegende Alternative -- anlegen, nachsehen, wieder entfernen --, aber er kann
selbst fehlschlagen und laesst dann einen halben Zustand zurueck, den niemand
erwartet. Eine Frage an den Stand kostet einen Aufruf und kann nichts kaputt machen.

Die Meldung nennt den Grund und den Pfad, unter dem die vorhandenen Artefakte liegen.
Wer den Change wirklich neu aufsetzen will, legt den Arbeitsraum von Hand an --
bewusst, mit einem sichtbaren Befehl, statt aus Versehen.

## Was ausdruecklich nicht

Kein Zusammenfuehren, kein Sichern, kein Ueberschreiben mit Rueckfrage. Der Befehl
bricht ab, mehr nicht. Eine Rueckfrage waere hier falsch: die Vorlagen entstehen in
einem Rezept, das niemand am Terminal begleitet.

Auch keine Aenderung an den Gates, am Archivieren oder am Loeschen von Arbeitsraeumen.
Das `justfile` wird nicht angefasst.

## Beruehrte Dateien

- `tools/neu.mjs`
- `tests/neu.test.mjs`
