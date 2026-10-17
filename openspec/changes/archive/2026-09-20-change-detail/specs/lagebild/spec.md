# lagebild

## ADDED Requirements

### Requirement: Worum es bei einem Change geht

Die Nutzlast SHALL zu jedem laufenden Change den Abschnitt *Warum* und den Abschnitt
*Was ausdrücklich nicht* aus seiner `proposal.md` führen, im Wortlaut der Datei und in
beiden Schreibweisen der Überschrift, mit und ohne Umlaut. Ein Abschnitt, den die Datei
nicht enthält, SHALL als leer geführt werden. Die Ansicht SHALL beide unter einer eigenen
Klappe zeigen und für einen leeren Abschnitt einen Hinweis ausgeben, der die fehlende
Überschrift benennt.

#### Scenario: Change mit beiden Abschnitten

- **Given** ein Change, dessen `proposal.md` die Überschriften `## Warum` und
  `## Was ausdrücklich nicht` trägt
- **When** die Nutzlast erzeugt wird
- **Then** führt sein Eintrag beide Abschnitte im Wortlaut der Datei, ohne die
  Überschriftenzeile selbst

#### Scenario: Change ohne Abgrenzung

- **Given** ein Change, dessen `proposal.md` keine Überschrift `## Was ausdrücklich nicht`
  trägt
- **When** die Nutzlast erzeugt wird
- **Then** steht die Abgrenzung als leerer Text, und die Ansicht gibt dafür einen Hinweis
  auf den fehlenden Abschnitt aus statt eines leeren Kastens

### Requirement: Anforderungen als Titel mit Szenarienzahl

Die Nutzlast SHALL zu jedem laufenden Change die Requirements seiner Delta-Specs führen,
je Eintrag mit der Capability, der Art des Delta-Blocks, dem Titel des Requirements und
der Zahl seiner Szenarien. Der Fließtext eines Requirements SHALL nicht geführt werden.
Die Ansicht SHALL diese Einträge unter einer eigenen Klappe zeigen, die anfangs
geschlossen ist.

#### Scenario: Delta-Spec mit zwei Requirements

- **Given** eine Delta-Spec mit einem Block `## ADDED Requirements`, darin ein Requirement
  mit zwei Szenarien und eines mit einem Szenario
- **When** die Nutzlast erzeugt wird
- **Then** führt der Change zwei Einträge in der Reihenfolge der Datei, mit den
  Szenarienzahlen 2 und 1, der Art `ADDED` und ohne den Fließtext der Requirements

### Requirement: Zusage und Diff nebeneinander

Die Nutzlast SHALL zu jedem laufenden Change die im Abschnitt *Berührte Dateien* der
`proposal.md` zugesagten Pfade führen, daneben die Pfade, die sein Arbeitsbaum gegenüber
`main` anfasst — committet wie nicht committet — und dazu einen Abgleich, der jeden Pfad
einer von drei Lagen zuordnet: zugesagt und angefasst, nur zugesagt, nur angefasst. Die
Ansicht SHALL den Abgleich unter einer eigenen Klappe zeigen und dabei Deckung als Deckung
melden statt sie zu verschweigen.

Eine Zusage, die auf einen Schrägstrich endet, SHALL als Ordner gelten und jeden
angefassten Pfad unterhalb dieses Ordners decken. Der gedeckte Pfad SHALL dann nicht
zusätzlich einzeln aufgeführt werden.

#### Scenario: Angefasst ohne Zusage

- **Given** ein Change, der `ops.py` zusagt und in seinem Arbeitsbaum `ops.py` sowie
  `justfile` angefasst hat
- **When** die Nutzlast erzeugt wird
- **Then** steht `ops.py` in der Lage *zugesagt und angefasst* und `justfile` in der Lage
  *nur angefasst*

#### Scenario: Zugesagt ohne Anfassen

- **Given** ein Change, der `ops.py` und `docs/plan.md` zusagt und nur `ops.py` angefasst
  hat
- **When** die Nutzlast erzeugt wird
- **Then** steht `docs/plan.md` in der Lage *nur zugesagt*

#### Scenario: Ordnerzusage deckt ihren Inhalt

- **Given** ein Change, der den Ordner `openspec/changes/beispiel/` zusagt und darin
  `tasks.md` angefasst hat
- **When** die Nutzlast erzeugt wird
- **Then** steht der Ordner in der Lage *zugesagt und angefasst*, und `tasks.md` steht
  nicht zusätzlich als eigener Eintrag

### Requirement: Der Klappstand des Menschen gewinnt

Jede Klappe der Ansicht SHALL einen Anfangszustand haben, und die Ansicht SHALL diesen
Anfangszustand nur so lange verwenden, wie niemand die Klappe angefasst hat. Sobald ein
Mensch eine Klappe öffnet oder schließt, SHALL die Ansicht seine Entscheidung über jedes
Neuzeichnen hinweg halten, auch wenn sie dem Anfangszustand widerspricht. Die Entscheidung
SHALL im Browser gehalten werden und keinen Zustand auf dem Server erzeugen.

#### Scenario: Anfangs offene Klappe wird zugeklappt

- **Given** eine Klappe mit dem Anfangszustand offen, die ein Mensch zuklappt
- **When** die Ansicht sich neu zeichnet
- **Then** bleibt die Klappe zugeklappt

#### Scenario: Anfangs geschlossene Klappe wird aufgeklappt

- **Given** eine Klappe mit dem Anfangszustand geschlossen, die ein Mensch aufklappt
- **When** die Ansicht sich neu zeichnet
- **Then** bleibt die Klappe offen

#### Scenario: Unangetastete Klappe folgt der Vorgabe

- **Given** eine Klappe, die niemand angefasst hat
- **When** die Ansicht sich neu zeichnet
- **Then** steht sie in ihrem Anfangszustand

## MODIFIED Requirements

### Requirement: Aufgaben eines Changes aufklappbar

Die Nutzlast SHALL zu jedem Change seine Aufgaben mit Nummer, Text, Abschnitt und dem
Merkmal erledigt führen, in der Reihenfolge der `tasks.md`. Die Ansicht SHALL diese
Aufgaben unter einer eigenen Klappe zeigen, deren Anfangszustand offen ist: der
Aufgabenstand ist die Frage, die am häufigsten gestellt wird, und ein Klick weniger ist
ein Klick weniger. Wer sie zuklappt, findet sie zugeklappt wieder.

#### Scenario: Change mit erledigten und offenen Aufgaben

- **Given** ein Change, dessen erste zwei von acht Aufgaben abgehakt sind
- **When** die Nutzlast erzeugt wird
- **Then** führt sein Eintrag acht Aufgaben in der Reihenfolge der Datei, davon die
  ersten zwei als erledigt

#### Scenario: Aufgabenklappe steht anfangs offen

- **Given** eine Change-Karte, deren Aufgabenklappe niemand angefasst hat
- **When** die Ansicht sie zeichnet
- **Then** steht die Aufgabenliste offen da
