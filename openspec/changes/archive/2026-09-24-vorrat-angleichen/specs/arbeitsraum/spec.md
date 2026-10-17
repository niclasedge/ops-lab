# arbeitsraum

## ADDED Requirements

### Requirement: Ein Change entsteht nur mit eigenem Issue

Das System SHALL die Anlage eines Changes ohne Issue-Nummer ablehnen, SHALL in diesem Fall
weder Ordner noch Branch noch Arbeitsraum anlegen, und SHALL bei genannter Nummer im
`proposal.md` eine Zeile hinterlassen, die den Change mit seinem Issue verbindet.

#### Scenario: Aufruf ohne Nummer

- **Given** ein Aufruf von `tools/neu.mjs` mit Kennung und Capability, aber ohne `--issue`
- **When** die Anlage beginnt
- **Then** endet der Aufruf mit einem von Null verschiedenen Exit-Code, die Meldung nennt den
  Befehl zum Anlegen eines Issues, und unter `openspec/changes/` ist kein Ordner der Kennung
  entstanden

#### Scenario: Aufruf mit Nummer

- **Given** ein Aufruf mit `--issue 42`
- **When** die Artefakte geschrieben werden
- **Then** enthält das `proposal.md` die Zeile `Geht zurueck auf GitHub-Issue #42.`

### Requirement: Der Testbefehl der Gates ist je Projekt bestimmbar

Das System SHALL den Testbefehl, mit dem Gate 2 und der Abschluss messen, aus
`tools/gate.projekt.json` lesen, wenn diese Datei vorliegt und Befehl samt Argumenten nennt,
und SHALL ohne diese Datei beim eingebauten Node-Testlauf bleiben. Das System SHALL einen
fremden Läufer allein an seinem Exit-Code messen.

#### Scenario: Projekt nennt seinen eigenen Läufer

- **Given** `tools/gate.projekt.json` mit einem Befehl, der mit einem von Null verschiedenen
  Code endet
- **When** Gate 2 den Testlauf ausführt
- **Then** gilt der Lauf als rot, und die Meldung nennt den ausgeführten Befehl

#### Scenario: Keine Projektdatei

- **Given** `tools/gate.projekt.json` liegt nicht vor
- **When** der Testbefehl bestimmt wird
- **Then** ist es der eingebaute Node-Testlauf über `tests/*.test.mjs`
