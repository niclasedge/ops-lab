# arbeitsraum

## ADDED Requirements

### Requirement: Vorhandene Artefakte werden nicht ueberschrieben

Das System SHALL vor dem Anlegen des Arbeitsverzeichnisses pruefen, ob der Stand, von
dem abgezweigt wird, unter `openspec/changes` bereits einen Ordner zu dieser Kennung
fuehrt. Ist das der Fall, SHALL es den Change ablehnen und mit einem Exit-Code
ungleich null enden.

Massgeblich SHALL der versionierte Stand sein und nicht das Dateisystem des
Hauptordners. Ein frisch abgezweigtes Arbeitsverzeichnis traegt genau diesen Stand --
was dort liegt, wuerde von den Vorlagen ueberschrieben.

Die Meldung SHALL den Pfad nennen, unter dem die vorhandenen Artefakte liegen.

#### Scenario: Ein Change, dessen Artefakte schon im Hauptbranch liegen

- **Given** ein Hauptbranch, der `openspec/changes/vorhanden/proposal.md` mit eigenem
  Inhalt traegt
- **And** kein Arbeitsverzeichnis zur Kennung `vorhanden`
- **When** ein Change mit der Kennung `vorhanden` angelegt wird
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** die Meldung nennt den Pfad der vorhandenen Artefakte
- **And** `proposal.md` traegt unveraendert seinen eigenen Inhalt

### Requirement: Ein abgelehnter Aufruf legt nichts an

Das System SHALL bei einer Ablehnung wegen vorhandener Artefakte weder ein
Arbeitsverzeichnis noch einen Branch anlegen. Nach einem abgelehnten Aufruf SHALL die
Kennung unbelegt sein.

Die Pruefung SHALL deshalb vor dem Anlegen laufen und nicht danach: ein Rueckbau
koennte selbst fehlschlagen und liesse dann einen halben Zustand zurueck.

#### Scenario: Nach der Ablehnung ist die Kennung wieder frei

- **Given** ein Hauptbranch, der Artefakte zur Kennung `vorhanden` traegt
- **When** ein Change mit dieser Kennung angelegt und abgelehnt wird
- **Then** existiert kein Verzeichnis `.claude/worktrees/vorhanden`
- **And** `git worktree list` fuehrt kein Arbeitsverzeichnis zu dieser Kennung
- **And** es gibt keinen Branch `change/vorhanden`
