# lagebild

## ADDED Requirements

### Requirement: Archivierte Changes erscheinen in der Web-Ansicht

Die Erhebung für die Web-Ansicht SHALL die archivierten Changes jedes Arbeitsbaums
erfassen und in der Nutzlast als eigene Liste führen, getrennt von den laufenden
Changes. Jeder Eintrag SHALL seine Kennung, sein Archivdatum, seinen Aufgabenstand
einschließlich der einzelnen Aufgaben mit ihrem Status und seine Belege nennen. Jeder
archivierte Change SHALL einmal stehen, auch wenn mehrere Arbeitsbäume dieselbe
Historie und damit dasselbe Archiv tragen.

Die Liste der laufenden Changes SHALL unverändert bleiben: ein archivierter Change
SHALL dort nicht erscheinen, und die Kennzahlen SHALL ihn nicht als laufenden Change
zählen.

#### Scenario: Ein archivierter Change mit Belegen

- **Given** ein Change im Archiv, dessen Journal einen Beleg ausweist
- **When** die Nutzlast erhoben wird
- **Then** steht er in der Archivliste mit Kennung, Datum, Aufgabenstand und diesem Beleg

#### Scenario: Ein archivierter Change bleibt aus der Changeliste heraus

- **Given** ein Change im Archiv
- **When** die Nutzlast erhoben wird
- **Then** führt ihn die Liste der laufenden Changes nicht, und die Kennzahlen zählen
  ihn nicht mit

#### Scenario: Mehrere Arbeitsbäume tragen dasselbe Archiv

- **Given** zwei Arbeitsbäume desselben Repos mit derselben Historie
- **When** die Nutzlast erhoben wird
- **Then** steht jeder archivierte Change genau einmal in der Archivliste

#### Scenario: Ein Archivordner ohne Aufgabenliste

- **Given** ein archivierter Change, dessen `tasks.md` fehlt
- **When** die Nutzlast erhoben wird
- **Then** steht er mit leerem Aufgabenstand in der Liste, und die Erhebung bricht nicht ab
