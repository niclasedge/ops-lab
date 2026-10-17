# lagebild

## ADDED Requirements

### Requirement: Die Change-Karte beginnt kompakt

Die Ansicht SHALL jede Klappe einer Change-Karte — *Worum es geht*, *Anforderungen*,
*Dateien* und *Aufgaben* — mit dem Anfangszustand geschlossen zeichnen. Eine Karte, die
niemand angefasst hat, SHALL damit nur Kopf, Marken, Fortschritt, Gates, die vier
Klappentitel und die Belege zeigen.

Eine zugeklappte Klappe SHALL ihren Inhalt dennoch ausliefern. Der Anfangszustand
betrifft allein, was sich beim ersten Zeichnen zeigt; welche Angaben eine Klappe trägt,
SHALL davon unberührt bleiben.

Der Anfangszustand SHALL nur gelten, solange niemand die Klappe angefasst hat. Wer sie
öffnet, SHALL sie über jedes Neuzeichnen hinweg offen wiederfinden.

#### Scenario: Eine unangetastete Karte zeigt vier geschlossene Klappen

- **Given** eine Change-Karte mit Worum, Anforderungen, Dateien und Aufgaben, deren
  Klappen niemand angefasst hat
- **When** die Ansicht sie zeichnet
- **Then** trägt keine der vier Klappen das Attribut `open`

#### Scenario: Zugeklappt heißt nicht leer

- **Given** dieselbe unangetastete Change-Karte
- **When** die Ansicht sie zeichnet
- **Then** stehen beide Abschnitte aus der `proposal.md`, die Anforderungen mit ihrer
  Szenarienzahl, die Einträge des Dateiabgleichs und die einzelnen Aufgaben im
  ausgelieferten Text der Karte

#### Scenario: Eine geöffnete Klappe bleibt offen

- **Given** eine Change-Karte, deren Klappe *Dateien* ein Mensch aufgeklappt hat
- **When** die Ansicht sich neu zeichnet
- **Then** steht die Klappe *Dateien* offen
- **And** die übrigen drei Klappen stehen weiterhin geschlossen

### Requirement: Aufgaben eines Changes unter einer Klappe

Die Nutzlast SHALL zu jedem Change seine Aufgaben mit Nummer, Text, Abschnitt und dem
Merkmal erledigt führen, in der Reihenfolge der `tasks.md`. Die Ansicht SHALL diese
Aufgaben unter einer eigenen Klappe zeigen, deren Titel die Zahl der erledigten und der
gesamten Aufgaben nennt. Damit steht der Aufgabenstand da, ohne dass die Klappe offen
sein muss.

Dieses Requirement tritt an die Stelle von *Aufgaben eines Changes aufklappbar*. Es sagt
über die Aufgaben dasselbe; den Anfangszustand der Klappe regelt nicht mehr es, sondern
*Die Change-Karte beginnt kompakt*.

#### Scenario: Change mit erledigten und offenen Aufgaben

- **Given** ein Change, dessen erste zwei von acht Aufgaben abgehakt sind
- **When** die Nutzlast erzeugt wird
- **Then** führt sein Eintrag acht Aufgaben in der Reihenfolge der Datei, davon die
  ersten zwei als erledigt

#### Scenario: Der Klappentitel nennt den Aufgabenstand

- **Given** eine Change-Karte zu einem Change mit einer von zwei erledigten Aufgaben
- **When** die Ansicht sie zeichnet
- **Then** nennt der Titel der Aufgabenklappe eine von zwei Aufgaben, auch solange die
  Klappe zugeklappt ist

## REMOVED Requirements

### Requirement: Aufgaben eines Changes aufklappbar

Entfällt zugunsten von *Aufgaben eines Changes unter einer Klappe* und *Die Change-Karte
beginnt kompakt*. Der bisherige Wortlaut schrieb der Aufgabenklappe den Anfangszustand
offen vor und belegte ihn mit dem Szenario *Aufgabenklappe steht anfangs offen*; beides
gilt nicht mehr. Die Aussage über die Nutzlast — Aufgaben mit Nummer, Text, Abschnitt
und Merkmal erledigt in der Reihenfolge der `tasks.md` — geht unverändert in das neue
Requirement über, samt seinem Szenario *Change mit erledigten und offenen Aufgaben*.
