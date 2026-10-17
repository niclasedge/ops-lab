# lagebild

## ADDED Requirements

### Requirement: Changes ohne eigenes Issue werden ausgewiesen

Das System SHALL in der Lage jeden offenen Change nennen, dessen `proposal.md` keine Zeile
`GitHub-Issue #N` trägt, SHALL zu jedem dieser Einträge einen Grund führen, und SHALL den Grund
`unbewertet` verwenden, wenn die Issue-Quelle nicht geantwortet hat.

#### Scenario: Change ohne Verbindung

- **Given** ein offener Change, dessen `proposal.md` keine Issue-Zeile trägt
- **When** die Lage erhoben wird
- **Then** steht seine Kennung unter `ohne_issue`

#### Scenario: Change mit Verbindung

- **Given** ein offener Change, dessen `proposal.md` die Zeile `Geht zurueck auf GitHub-Issue #7.`
  trägt
- **When** die Lage erhoben wird
- **Then** steht seine Kennung nicht unter `ohne_issue`
