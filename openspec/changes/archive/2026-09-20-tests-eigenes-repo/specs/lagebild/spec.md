# lagebild

## ADDED Requirements

### Requirement: Ein fremdes Repo vollständig beobachten

Das System SHALL mit `--root` auf einen Pfad gerichtet das dort liegende Repo beobachten und dessen
Arbeitsbäume, Changes und Zuordnungen in der Nutzlast führen. Es SHALL dabei kein
Merkmal des eigenen Arbeitsverzeichnisses in die Nutzlast übernehmen: das Feld `root`,
die Liste der Arbeitsbäume und die Liste der Changes SHALL ausschließlich das
beobachtete Repo beschreiben. Das Ergebnis SHALL allein vom Zustand des beobachteten
Repos abhängen.

#### Scenario: Ein fremdes Repo statt des eigenen

- **Given** ein Repo unter einem Pfad, der nicht das Arbeitsverzeichnis ist, mit einem
  Change `probe-haupt` im Hauptbaum
- **When** `ops.py` mit `--root` auf diesen Pfad und mit `--web --trocken` aufgerufen wird
- **Then** nennt das Feld `root` diesen Pfad, der Hauptbaum trägt den Namen des dortigen
  Verzeichnisses, und `probe-haupt` steht in der Liste der Changes

#### Scenario: Arbeitsbaum des beobachteten Repos

- **Given** ein beobachtetes Repo mit einem zweiten Arbeitsbaum unter
  `.claude/worktrees/probe-zweig` auf dem Branch `change/probe-zweig`
- **When** die Nutzlast erzeugt wird
- **Then** führt sie genau zwei Arbeitsbäume, der zweite trägt den Namen `probe-zweig`,
  den Branch `change/probe-zweig` und einen Kopfstand mit Betreff

#### Scenario: Ein Change, den nur der Arbeitsbaum trägt

- **Given** ein Change `probe-zweig`, der im Arbeitsbaum `probe-zweig` liegt und nicht
  im Hauptbaum des beobachteten Repos
- **When** die Nutzlast erzeugt wird
- **Then** steht `probe-zweig` genau einmal in der Liste der Changes, ist dem Arbeitsbaum
  `probe-zweig` zugeordnet und als abweichend ausgewiesen

#### Scenario: Das eigene Arbeitsverzeichnis bleibt draußen

- **Given** ein beobachtetes Repo, dessen Arbeitsbäume und Changes andere Namen tragen
  als die des aufrufenden Repos
- **When** die Nutzlast erzeugt wird
- **Then** enthält weder die Liste der Arbeitsbäume noch die Liste der Changes einen
  Eintrag des aufrufenden Repos
