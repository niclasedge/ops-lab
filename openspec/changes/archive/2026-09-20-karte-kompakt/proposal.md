# karte-kompakt

## Warum

Die Change-Karte der Web-Ansicht trägt vier Klappen: Worum es geht, Anforderungen,
Dateien, Aufgaben. Drei davon stehen anfangs offen. Eine einzelne Karte ist damit
mehrere Bildschirmhöhen hoch — und die Ansicht zeigt nicht eine Karte, sondern alle
Changes aller Arbeitsbäume nebeneinander.

Genau das nimmt der Ansicht ihren Zweck. Sie ist das Lagebild: Wer steht wo, was ist
frei, was blockiert. Diese Frage beantwortet ein Überblick, kein Fließtext. Wer heute
`just web` öffnet, sieht zuerst das Warum eines einzelnen Changes im Wortlaut und muss
scrollen, um überhaupt zu erfahren, wie viele Changes es gibt.

Die Begründung für die offenen Klappen stammt aus der Zeit, als jede für sich
eingebaut wurde: ein Klick weniger für die Frage, die am häufigsten gestellt wird.
Das stimmt je Klappe und fällt in der Summe auseinander. Drei Klappen, die einzeln je
einen Klick sparen, kosten gemeinsam die Übersicht.

Die Entscheidung ist reversibel und kostet den Menschen nichts: Der Klappstand-Speicher
merkt sich, was er aufklappt, und hält es über jeden Takt. Wer seine Karte weit haben
will, klappt sie einmal auf und findet sie so wieder.

## Was ändert sich

Alle vier Klappen der Change-Karte beginnen zugeklappt. Die drei Aufrufe von
`aufklappbar`, die heute die Vorgabe `true` mitgeben — Worum es geht, Dateien,
Aufgaben — geben sie nicht mehr mit; die Anforderungsklappe steht bereits so. Damit
zeigt eine Karte beim ersten Zeichnen ihren Kopf, die Marken, den Balken, die Gates,
die vier Klappentitel und die Belege.

Die Klappentitel bleiben aussagekräftig: Sie tragen die Zahlen. „3 Anforderungen",
„Dateien: 2 gedeckt · 1 ohne Zusage · 0 ohne Änderung", „4 von 7 Aufgaben" —
zugeklappt steht der Stand da, aufgeklappt die Einzelheiten.

Die Kommentare über den drei Aufrufen werden mitgezogen. Sie begründen heute die alte
Vorgabe wörtlich mit „wer eine Karte aufschlägt, fragt zuerst danach"; bliebe der Satz
stehen, widerspräche der Text dem Code, den er erklärt.

Die Capability `lagebild` wird nachgezogen. Neu ist das Requirement *Die Change-Karte
beginnt kompakt*: Es hält den Anfangszustand aller vier Klappen an einer Stelle fest,
dazu, dass eine zugeklappte Klappe ihren Inhalt trotzdem mitliefert, und dass die
Entscheidung eines Menschen die Vorgabe schlägt.

Das bestehende Requirement *Aufgaben eines Changes aufklappbar* verlangt heute
ausdrücklich den Anfangszustand offen und belegt ihn mit dem Szenario *Aufgabenklappe
steht anfangs offen*. Es wird entfernt und durch *Aufgaben eines Changes unter einer
Klappe* ersetzt, das über die Nutzlast dasselbe sagt und den Anfangszustand dem neuen
Requirement überlässt. Der Weg über REMOVED und ADDED statt über MODIFIED ist keine
Geschmacksfrage: `openspec validate --strict` verlangt, dass ein MODIFIED-Block jedes
Szenario des bestehenden Requirements namentlich wiederholt, damit beim Archivieren
keines still verlorengeht. Ein Szenario, dessen Name die alte Zusage trägt, lässt sich
darüber nicht ablegen — nur mitschleppen.

## Was ausdrücklich nicht

Kein Eingriff in den Klappstand-Speicher. `istOffen(id, vorgabe)` und der
Toggle-Zuhörer bleiben Zeile für Zeile, wie sie sind. Die Vorgabe greift weiterhin
nur, solange niemand entschieden hat; was ein Mensch aufklappt, bleibt offen. Das
Requirement *Der Klappstand des Menschen gewinnt* wird nicht angefasst.

Keine Änderung am Inhalt einer Klappe. Was `change-detail` eingebaut hat — die beiden
Abschnitte aus der `proposal.md`, die Anforderungen mit Szenarienzahl, der Abgleich
von Zusage und Diff — erscheint beim Aufklappen unverändert. Zugeklappt heißt nicht
weggelassen: das HTML enthält den Inhalt, nur das Attribut `open` fehlt.

Keine Änderung am Parameter `vorgabe` von `aufklappbar`. Er bleibt mit seinem
Standardwert bestehen, und eine Klappe mit der Vorgabe offen bleibt weiterhin
möglich — nur nutzt sie in der Change-Karte keine mehr.

Keine Änderung an der Worktree-Karte, an der Archivzeile und an der Terminal-Ansicht.
Die Worktree-Karte klappt ihre geänderten Dateien schon heute zugeklappt auf, die
Archivzeile ebenso; beide bleiben unberührt.

Keine Anpassung der Klappentitel. Sie tragen die Zahlen bereits und brauchen dafür
keine Änderung.

## Berührte Dateien

- `ops.py` — drei Aufrufe von `aufklappbar` ohne die Vorgabe offen, samt ihrer Kommentare
- `tests/lagebild-detail.test.mjs` — erweitert um den kompakten Anfangszustand der Karte
- `openspec/changes/karte-kompakt/` — die Artefakte dieses Changes

Nicht berührt: `justfile`, `tools/`, `CLAUDE.md`, `openspec/specs/`. Die Delta-Spec
dieses Changes liegt unter `openspec/changes/karte-kompakt/specs/lagebild/spec.md`;
die Capability selbst wird erst beim Archivieren fortgeschrieben.

Die Liste ist die Zusage. Die Änderung an `ops.py` umfasst drei Argumente und drei
Kommentare und fasst keine andere Funktion an. Nebenher laufende Changes berühren
`ops.py` nicht: `mitschrift-vollstaendig` nennt die Datei ausdrücklich in seiner
Abgrenzung.
