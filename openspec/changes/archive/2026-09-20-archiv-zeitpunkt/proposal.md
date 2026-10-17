# archiv-zeitpunkt

## Warum

Dreizehn archivierte Changes stehen in der Liste, und alle dreizehn tragen dasselbe
Datum: `2026-09-20`. Sortiert wird nach dem Ordnernamen absteigend — bei gleichem Datum
entscheidet also der Buchstabe. Oben steht `worktrees`, der älteste Lauf des Tages; der
eben abgeschlossene steht irgendwo in der Mitte. Die Überschrift verspricht „jüngster
zuerst", die Liste hält es nicht.

Die genaue Zeit liegt vor und wird nur nicht gelesen: jeder Gate-Nachweis trägt eine
Zeile `- Datum: <ISO>`, und `fertig.md` ist damit der Zeitpunkt, zu dem der Lauf
abgeschlossen wurde. An einem Tag mit dreizehn Läufen ist das die einzige Angabe, die
sie auseinanderhält.

## Was ändert sich

Jeder Archiveintrag nennt seinen Abschlusszeitpunkt aus `fertig.md`, hilfsweise aus
`gate2.md` oder `gate1.md`. Danach wird sortiert, jüngster zuerst; wo kein Nachweis
einen Zeitpunkt trägt, ordnet weiter der Ordnername. Die Zeile zeigt statt des reinen
Datums Datum und Uhrzeit auf die Minute, in der Zeitzone des Betrachters — so wie die
Karten der Arbeitsbäume ihren Zeitpunkt auch schon zeigen.

## Was ausdrücklich nicht

Es wird kein Git bemüht: gelesen wird eine Datei, die ohnehin im Ordner liegt. Welche
Changes im Archiv stehen, ändert sich nicht, ebenso wenig die Vorschau, die Aufgaben,
die Belege, die Sektion *Belegt* und die Karten der laufenden Changes. Die Nutzlast
führt den Zeitpunkt unverändert so, wie der Nachweis ihn nennt; umgerechnet wird erst
in der Anzeige.

## Berührte Dateien

- `ops.py`
- `tests/lagebild-archiv.test.mjs`
- `openspec/changes/archiv-zeitpunkt/` (Artefakte und Nachweise dieses Changes)
