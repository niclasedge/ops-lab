# abgleich

Der Abgleich hält die Zusage aus dem Vorschlag gegen den Diff eines Changes und benennt beide
Richtungen der Abweichung — angefasst ohne Zusage, zugesagt ohne Anfassen. Er berichtet und
blockiert nicht: die Zusage ist die Grundlage des Parallelbetriebs, ihre Verletzung aber ein
Fall für ein Urteil, nicht für einen Exit-Code.

## ADDED Requirements

### Requirement: Die Zusage steht in den Listeneinträgen des Abschnitts

Das System SHALL die zugesagten Dateien allein aus dem Abschnitt „Berührte Dateien" des
Vorschlags lesen und dort allein aus dessen Listeneinträgen. Prosa außerhalb der Liste SHALL
nicht als Zusage zählen. Fehlt der Abschnitt, SHALL das System eine leere Zusage melden,
statt den Aufruf abzubrechen.

#### Scenario: Eine Liste mit Pfaden in Backticks

- **Given** ein Vorschlag mit dem Abschnitt „Berührte Dateien" und zwei Listeneinträgen, von
  denen einer zwei Pfade in Backticks nennt und in der nächsten Zeile weitergeht
- **When** die Zusage gelesen wird
- **Then** enthält sie alle drei Pfade, jeden genau einmal und in der Reihenfolge des Textes

#### Scenario: Prosa unter der Liste zählt nicht mit

- **Given** ein Vorschlag, dessen Abschnitt „Berührte Dateien" unter der Liste den Satz
  „Nicht berührt: `ops.py`" trägt
- **When** die Zusage gelesen wird
- **Then** enthält sie `ops.py` nicht

#### Scenario: Der Abschnitt fehlt

- **Given** ein Vorschlag ohne den Abschnitt „Berührte Dateien"
- **When** die Zusage gelesen wird
- **Then** ist sie leer und es wird kein Fehler geworfen

### Requirement: Der Abgleich benennt beide Richtungen getrennt

Das System SHALL zwei Mengen getrennt ausweisen: den Zusatz — angefasst, aber nicht zugesagt —
und die Auslassung — zugesagt, aber nicht angefasst. Decken sich beide Mengen, SHALL das
System das als eigenen Befund melden, statt zu schweigen. Eine Zusage, die auf einen Ordner
lautet, SHALL jede Datei darunter decken. Die Artefakte des Ablaufs unter `openspec/changes/`
und `openspec/specs/` SHALL das System nicht als Zusatz führen, weil sie in jedem Lauf
anfallen und niemand sie zusagen muss.

#### Scenario: Eine Datei ohne Zusage

- **Given** eine Zusage über `tools/abgleich.mjs` und ein Diff über `tools/abgleich.mjs` und
  `tools/gate.mjs`
- **When** verglichen wird
- **Then** steht `tools/gate.mjs` im Zusatz, die Auslassung ist leer und der Befund ist nicht
  deckungsgleich

#### Scenario: Eine zugesagte Datei blieb unberührt

- **Given** eine Zusage über `tools/abgleich.mjs` und `docs/abgleich.svg` und ein Diff allein
  über `tools/abgleich.mjs`
- **When** verglichen wird
- **Then** steht `docs/abgleich.svg` in der Auslassung und der Zusatz ist leer

#### Scenario: Zusage und Diff decken sich

- **Given** eine Zusage und ein Diff über dieselben zwei Dateien
- **When** verglichen wird
- **Then** sind Zusatz und Auslassung leer und der Befund weist Deckungsgleichheit aus

#### Scenario: Eine Zusage auf einen Ordner

- **Given** eine Zusage über `openspec/changes/diff-reviewer/` und ein Diff über
  `openspec/changes/diff-reviewer/tasks.md`
- **When** verglichen wird
- **Then** ist der Zusatz leer und die Zusage gilt als eingelöst

#### Scenario: Artefakte des Ablaufs zählen nicht als Zusatz

- **Given** eine Zusage allein über `tools/abgleich.mjs` und ein Diff, der zusätzlich
  `openspec/changes/diff-reviewer/gate1.md` und `openspec/specs/abgleich/spec.md` nennt
- **When** verglichen wird
- **Then** ist der Zusatz leer

### Requirement: Der Abgleich berichtet und blockiert nicht

Das System SHALL den Aufruf mit Exit-Code 0 beenden, auch wenn Zusatz oder Auslassung nicht
leer sind. Der Bericht SHALL beide Richtungen benennen und die Basis nennen, gegen die
gerechnet wurde.

#### Scenario: Ein Befund beendet den Aufruf nicht mit Fehler

- **Given** ein Change, dessen Diff eine nicht zugesagte Datei enthält
- **When** der Abgleich läuft
- **Then** endet der Aufruf mit Exit-Code 0 und der Bericht nennt die Datei unter dem Zusatz

#### Scenario: Ein unbekannter Change

- **Given** eine Kennung, zu der kein Change-Ordner existiert
- **When** der Abgleich läuft
- **Then** endet der Aufruf mit einem Fehler, weil hier nichts zu berichten ist, statt
  Deckungsgleichheit zu melden

### Requirement: Jeder Skill des Ursprungs wird mit ausgerollt

Das System SHALL beim Ausrollen jeden Ordner unter `.claude/skills/` in den
Konfigurationsordner und in den Vorrat schreiben, ohne einen Skill namentlich zu führen. Ein
neu hinzugekommener Skill SHALL damit ohne Änderung am Installer mitkommen.

#### Scenario: Zwei Skills liegen im Ursprung

- **Given** ein Ursprung mit den Skills `leitstand` und `diff-reviewer`
- **When** der Installer läuft
- **Then** liegen beide Skills im Konfigurationsordner und beide im Vorrat

#### Scenario: Kein Skill nennt einen ausgeschriebenen Pfad

- **Given** die ausgerollten Skills im Konfigurationsordner
- **When** ihr Text gelesen wird
- **Then** nennt keiner von ihnen einen absoluten Pfad in ein bestimmtes Projekt
