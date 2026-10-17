# beleg-typ

## Warum

Die Belegroute liefert einen Graphen als `application/msword` aus. Nicht, weil jemand das
so wollte, sondern weil die Endung `.dot` doppelt belegt ist: Pythons `mimetypes` führt
sie als Word-Vorlage, und das ist dort ein fester Eintrag, kein Zufall und keine
Näherung. Für Graphviz ist dieselbe Endung eine Textdatei. Der Browser zeigt den Graphen
deshalb nicht an, sondern lädt ihn als vermeintliches Word-Dokument herunter. Von den elf
Belegen im Repo sind zwei `.dot`.

Dieselbe Bibliothek liefert für `belege/belege.jsonl` und für Dateien ohne Endung gar
nichts, also `None`. Was die Auslieferung daraus macht, entscheidet dann eine
Fremdbibliothek statt dieses Programms — und das ist bei einer Route, die das Lagebild
selbst anbietet, die falsche Zuständigkeit.

Der vorige Change hat die Belege sichtbar gemacht. Ein Beleg, den der Browser
herunterlädt statt ihn zu zeigen, ist wieder einer, den niemand ansieht.

## Was ändert sich

Die Belegroute bestimmt den Inhaltstyp selbst statt ihn raten zu lassen. Für die
Endungen, die das Lagebild selbst erzeugt, steht er fest; für alles Übrige gilt weiter
das Raten der Standardbibliothek, und wo auch das nichts liefert, wird Text
ausgeliefert. Ein Beleg ist Bild oder Text — etwas Drittes liefert `tools/beleg.mjs`
nicht ab.

## Was ausdrücklich nicht

Es wird keine Bibliothek zur Typerkennung hinzugefügt und kein Dateiinhalt geprüft: die
Regel liest die Endung, nicht die Bytes. `tools/beleg.mjs` bleibt unberührt — was ein
Beleg ist, entscheidet weiterhin das Einliefern, nicht das Ausliefern. Die Regel, welche
Adresse überhaupt bedient wird, ändert sich nicht; dieser Change betrifft allein den
Inhaltstyp einer Antwort, die ohnehin schon erlaubt war.

## Berührte Dateien

- `ops.py`
- `tests/lagebild-belege.test.mjs`
- `openspec/changes/beleg-typ/` (Artefakte und Nachweise dieses Changes)
