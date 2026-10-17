# messung

## ADDED Requirements

### Requirement: Der Rahmen verbietet Verkettungen

Das System SHALL dem Agenten vor dem Auftrag mitteilen, dass ein Bash-Aufruf genau
einen Befehl traegt und dass Verkettungen mit `&&`, `;` oder `|` nicht freigegeben
werden. Es SHALL die drei Zeichen beim Namen nennen, damit der Agent sie meidet statt
sie auszuprobieren.

#### Scenario: Der Rahmen nennt die abgelehnten Zeichen

- **Given** der Rahmen um einen Auftrag
- **When** er dem Agenten uebergeben wird
- **Then** enthaelt er `&&`, `;` und `|` in der Warnung
- **And** er sagt, dass ein Aufruf genau ein Befehl ist

### Requirement: Der Rahmen nennt den Vertrag der Werkzeuge

Das System SHALL die Werkzeuge des Ablaufs samt ihrem Vertrag im Rahmen nennen, damit
der Agent ihre Quellen nicht lesen muss. Fuer `neu`, die drei Gate-Stufen und `beleg`
SHALL je stehen, was der Aufruf tut und was er verlangt.

#### Scenario: Jeder Schritt hat seinen Vertrag im Rahmen

- **Given** der Rahmen um einen Auftrag
- **When** er dem Agenten uebergeben wird
- **Then** nennt er fuer `neu.mjs`, `gate.mjs gate1`, `gate.mjs gate2`, `gate.mjs fertig` und `beleg.mjs` je einen Vertrag

### Requirement: Der Rahmen zeigt das Muster

Das System SHALL im Rahmen auf die juengste archivierte Aenderung unter
`openspec/changes/archive/` als Muster fuer `proposal.md`, `spec.md` und `tasks.md`
verweisen. Es SHALL die Suche auf diese drei Dateien eingrenzen, statt den Agenten
das ganze Archiv lesen zu lassen.

#### Scenario: Das Muster steht mit Pfad im Rahmen

- **Given** der Rahmen um einen Auftrag
- **When** er dem Agenten uebergeben wird
- **Then** nennt er den Pfad `openspec/changes/archive/`
- **And** er grenzt die Lektuere auf proposal, spec und tasks ein
