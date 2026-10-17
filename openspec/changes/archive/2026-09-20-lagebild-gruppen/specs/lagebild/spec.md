# lagebild

## ADDED Requirements

### Requirement: Jeder Arbeitsbaum nennt seinen nächsten Schritt

Die Nutzlast SHALL zu jedem Arbeitsbaum einen nächsten Schritt führen. Der Schritt SHALL
einen Satz in der Sie-Form tragen, SHALL eine von drei Lagen ausweisen — `tun`, `warten`
oder `ruhe` — und SHALL den auszuführenden Befehl nennen, sofern es einen gibt. Gibt es
keinen Befehl, SHALL das Feld leer sein und nicht fehlen.

#### Scenario: Jeder Arbeitsbaum trägt einen Schritt

- **Given** ein Repo mit mehreren Arbeitsbäumen
- **When** die Nutzlast erzeugt wird
- **Then** trägt jeder Arbeitsbaum einen Schritt mit Text, Lage und Befehlsfeld, und die
  Lage ist eine von `tun`, `warten` oder `ruhe`

### Requirement: Der Schritt folgt der Reihenfolge des Ablaufs

Das System SHALL den nächsten Schritt aus dem Stand des Arbeitsbaums und seiner Changes
ableiten und dabei die Reihenfolge des Ablaufs einhalten. Uncommittete Änderungen SHALL
Vorrang vor allem anderen haben. Danach SHALL gelten: ein Change ohne `gate1.md` verlangt
Gate 1, ein Change mit `gate1.md` und ohne `gate2.md` verlangt Gate 2, ein begonnener
Change verlangt seine nächste offene Aufgabe, ein Change ohne offene Aufgabe und ohne
`fertig.md` verlangt den Abschluss, ein abgeschlossener Change ohne Pull Request verlangt
den Pull Request. Ein Arbeitsbaum ohne Change und ohne Änderung SHALL als frei gelten.

#### Scenario: Uncommittete Änderungen gehen vor

- **Given** ein Arbeitsbaum mit geänderten Dateien und einem abgeschlossenen Change
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er das Committen und nicht den Pull Request, und seine Lage ist `tun`

#### Scenario: Abgeschlossener Change will in den Pull Request

- **Given** ein sauberer Arbeitsbaum, dessen Change `fertig.md` trägt und nicht im Pull
  Request steht
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er `just pr` mit der Kennung des Changes, und seine Lage ist `tun`

#### Scenario: Gestellter Pull Request wartet auf den Merge

- **Given** ein sauberer Arbeitsbaum, dessen Change abgeschlossen ist und im Pull Request
  steht
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er den Merge, und seine Lage ist `warten`

#### Scenario: Begonnener Change nennt seine Aufgabe

- **Given** ein sauberer Arbeitsbaum, dessen Change beide Gates trägt und offene Aufgaben hat
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er die nächste offene Aufgabe, und seine Lage ist `tun`

#### Scenario: Leerer Arbeitsbaum ist frei

- **Given** ein sauberer Arbeitsbaum ohne Change und ohne Versatz zum Hauptbranch
- **When** der nächste Schritt bestimmt wird
- **Then** weist er den Baum als frei aus, und seine Lage ist `ruhe`

### Requirement: Der Hauptbaum holt, was ihm fehlt

Liegt der Hauptbaum hinter seinem Hauptbranch zurück, SHALL sein nächster Schritt das Holen
verlangen und den Befehl dazu nennen. Ein sauberer Hauptbaum ohne Rückstand SHALL die Lage
`ruhe` tragen.

#### Scenario: Hauptbaum liegt zurück

- **Given** ein sauberer Hauptbaum, der zwei Commits hinter seinem Hauptbranch liegt
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er `git pull`, und seine Lage ist `tun`

### Requirement: Changes stehen bei ihrem Arbeitsbaum

Die Ansicht SHALL die Changes je Arbeitsbaum gruppieren und die Gruppe eines Arbeitsbaums
als Einheit darstellen: den Arbeitsbaum an der Seite, seine Changes daneben. Ein
Arbeitsbaum ohne Change SHALL seine Gruppe trotzdem führen und als leer ausweisen.

#### Scenario: Arbeitsbaum mit zwei Changes

- **Given** ein Arbeitsbaum, dem zwei Changes zugeordnet sind
- **When** die Ansicht gezeichnet wird
- **Then** stehen beide Changes in der Gruppe dieses Arbeitsbaums und in keiner anderen

#### Scenario: Arbeitsbaum ohne Change

- **Given** ein Arbeitsbaum, dem kein Change zugeordnet ist
- **When** die Ansicht gezeichnet wird
- **Then** steht seine Gruppe mit einem Hinweis, dass dort kein Change liegt
