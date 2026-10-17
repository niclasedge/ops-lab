# lagebild

## ADDED Requirements

### Requirement: Der Stand in einem Aufruf

Das System SHALL den Stand des Repos in einem einzigen Aufruf als JSON ausgeben und darin die
zuletzt archivierten Changes, die aktiven Arbeitsräume, die konfliktfrei startbaren Changes,
die blockierten Changes, die verwaisten Arbeitsräume und die offenen Ideen führen.

#### Scenario: Ein Aufruf beantwortet alle Fragen

- **Given** ein Repo mit mindestens einem Arbeitsraum und mindestens einem archivierten Change
- **When** die Lage erhoben wird
- **Then** trägt die Ausgabe die Schlüssel `zuletzt`, `aktiv`, `frei`, `blockiert`, `verwaist`
  und `ideen`, und jeder davon ist eine Liste

### Requirement: Verwaiste Arbeitsräume werden ausgewiesen

Das System SHALL einen Arbeitsraum als verwaist führen, wenn alle drei Bedingungen zutreffen:
sein Branch ist bereits in `main` enthalten, seine Spitze ist nicht zugleich die Spitze von
`main`, und unter `openspec/changes` des Hauptbaums liegt kein gleichnamiger Ordner mehr. Das
System SHALL einen solchen Arbeitsraum nicht entfernen.

Die zweite Bedingung trennt den verwaisten Raum vom frisch angelegten: ein Branch ohne eigenen
Commit zeigt auf dieselbe Spitze wie `main` und ist damit rechnerisch in `main` enthalten, ohne
dass je etwas gemergt wurde.

#### Scenario: Arbeitsraum nach Merge und Archivierung

- **Given** ein Arbeitsraum, dessen Branch in `main` gemergt und dessen Change archiviert wurde
- **When** die Lage erhoben wird
- **Then** steht dieser Arbeitsraum unter `verwaist` und nicht unter `aktiv`, und der
  Arbeitsraum liegt danach unverändert auf der Platte

#### Scenario: Arbeitsraum mit laufendem Change

- **Given** ein Arbeitsraum, dessen Change noch unter `openspec/changes` liegt
- **When** die Lage erhoben wird
- **Then** steht dieser Arbeitsraum unter `aktiv` und nicht unter `verwaist`

#### Scenario: Frisch angelegter Arbeitsraum ohne eigenen Commit

- **Given** ein eben angelegter Arbeitsraum, dessen Branch noch auf der Spitze von `main` steht
- **When** die Lage erhoben wird
- **Then** steht dieser Arbeitsraum nicht unter `verwaist`

### Requirement: Kurzfassung für den Sitzungsbeginn

Das System SHALL auf Verlangen statt des JSON eine einzelne Zeile ausgeben, die die Anzahl der
aktiven, freien, blockierten und verwaisten Posten sowie der offenen Ideen nennt.

#### Scenario: Kurzfassung statt JSON

- **Given** eine erhobene Lage
- **When** die Kurzfassung verlangt wird
- **Then** besteht die Ausgabe aus genau einer Zeile und nennt die fünf Anzahlen

### Requirement: Eine stumme Quelle bricht die Erhebung nicht ab

Das System SHALL ein Lagebild auch dann ausgeben, wenn eine der befragten Quellen nicht
antwortet, und SHALL die ausgefallene Quelle in der Ausgabe benennen.

#### Scenario: Die Ideenquelle antwortet nicht

- **Given** eine Umgebung, in der die Abfrage der offenen Ideen fehlschlägt
- **When** die Lage erhoben wird
- **Then** endet der Aufruf ohne Fehler, `ideen` ist eine leere Liste, und die Ausgabe nennt
  die ausgefallene Quelle unter `stumm`
