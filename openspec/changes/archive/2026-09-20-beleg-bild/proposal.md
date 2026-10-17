# beleg-bild

## Warum

Die drei Gates belegen heute ausschliesslich mit Text. `gate1.md`, `gate2.md` und
`fertig.md` sind Checklisten aus Haken und Kreuzen, dazu ein Testlauf mit Exit-Code.
Wer nach dem Merge wissen will, was der Change eigentlich bewirkt hat, findet eine
Zusage darueber, dass Tests gelaufen sind — aber nichts, woran sich der Zustand
vorher und nachher ansehen laesst. Genau an dieser Stelle endet die maschinelle
Pruefung und beginnt das Vertrauen: Exit 0 heisst, dass etwas gelaufen ist, nicht,
dass das Richtige dabei herauskam. Ein Text-Nachweis wird ausserdem von derselben
Instanz geschrieben, die behauptet, fertig zu sein, und nichts unterscheidet ihn von
einer plausibel klingenden Umschreibung eines Laufs, den es nie gab. Das Nachbarprojekt
`git-planner-go` hat dieselbe Luecke gefunden und geschlossen: dort schliesst
seit `internal/closeops` kein Vorgang mehr ohne etwas Sichtbares, und die Begruendung
dafuer steht ausformuliert in `internal/reports/evidence.go` sowie als Diagramm in
`docs/beleg-bildpfad.dot`. Ein Bild oder ein gerendertes Diagramm muss aus dem
tatsaechlichen Zustand entstehen; es ist die eine Art Nachweis, die teuer zu faelschen
und billig zu pruefen ist. Dem Labor fehlt diese Stufe, und ohne sie bleibt die
Messgroesse "sauber abgearbeitet" eine Aussage ueber den Ablauf statt ueber sein
Ergebnis.

## Was aendert sich

Jeder Change kann Belege einliefern: `just beleg` nimmt einen Pfad auf ein Bild oder
ein Graph-Artefakt entgegen, prueft ihn, kopiert ihn in den Change-Ordner und haengt
eine Zeile an ein append-only Journal. Jeder Beleg traegt eine Stufe — `vorher` fuer
den Zustand bei Gate 2, `nachher` fuer den Zustand beim Abschluss — sodass der
Unterschied zwischen beiden Aufnahmen die Wirkung des Changes zeigt.

Der Abschluss bekommt eine fuenfte Pruefung: `just fertig` schreibt kein `fertig.md`
mehr, solange kein sichtbarer Beleg der Stufe `nachher` vorliegt. Ein Testlauf mit
Exit 0 allein genuegt nicht. Die Ablehnung unterscheidet dabei zwei Faelle mit
verschiedenen Abhilfen: es wurde gar kein Beleg eingeliefert, oder der eingelieferte
Beleg war beim Schreiben nicht lesbar.

Das Urteil ueber einen Beleg faellt genau einmal, beim Einliefern. Wer das Journal
spaeter liest, fasst das Dateisystem nicht wieder an. Ein abgeschlossener Change
verliert seinen Nachweis also nicht, wenn jemand spaeter einen Ordner umbenennt.

Das Modul kennt keine OpenSpec-Begriffe. Es bekommt einen Vorgangsordner und arbeitet
darin; damit traegt derselbe Code auch einen beads-Vorgang oder ein GitHub-Issue,
sobald man ihm einen anderen Wurzelpfad uebergibt.

## Was ausdruecklich nicht

Keine Web-Ansicht. Das Anzeigen der Belege nebeneinander ist Change `lagebild-web`
und fasst `ops.py` an; dieser Change fasst `ops.py` nicht an.

Kein MCP-Endpunkt, kein HTTP-Upload, kein Browser-Dialog. Die einzige Tuer ist der
Befehl auf der Kommandozeile mit einem Pfad als Argument.

Kein Erzeugen von Bildern. Screenshot und Diagramm-Rendering bleiben ausserhalb;
dieser Change nimmt entgegen, prueft und legt ab.

Keine Pflicht an Gate 1 und Gate 2. Nur der Abschluss fordert den Beleg ein. Gate 2
nimmt eine Aufnahme der Stufe `vorher` an, verlangt sie aber nicht — sonst waere jeder
bestehende Change im Bestand rueckwirkend rot.

Keine Aenderung an bereits geschriebenen Nachweisen. Was als `fertig.md` existiert,
bleibt gueltig.

## Beruehrte Dateien

- `tools/beleg.mjs` — neu: Einliefern, Pruefen, Kopieren, Journal fortschreiben
- `tools/pruefungen.mjs` — ergaenzt um die Textregeln ueber Belegzeilen
- `tools/gate.mjs` — Pruefung F-5 im Abschluss verdrahtet
- `tests/beleg.test.mjs` — neu: Tests des Einlieferns
- `tests/pruefungen.test.mjs` — ergaenzt um die Tests der neuen Textregeln
- `justfile` — Ziel `beleg`
- `docs/beleg-pfad.dot` und `docs/beleg-pfad.svg` — neu: der Weg eines Belegs durch
  dieses Repo. Zugleich der Beleg dieses Changes: er weist seine eigene Faehigkeit
  an sich selbst nach.
- `openspec/changes/beleg-bild/` — die Artefakte dieses Changes samt `belege/`

Nicht beruehrt: `ops.py`, `tools/sync.mjs`, `tools/neu.mjs`, `tools/tokens.mjs`.
`sync.mjs` rollt alle Dateien unter `tools/` mit der Endung `.mjs` aus und nimmt
`beleg.mjs` ohne Aenderung mit.
