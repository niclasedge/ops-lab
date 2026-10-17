# arbeitsraum

## ADDED Requirements

### Requirement: Ein Change entsteht in einem eigenen Arbeitsverzeichnis

Das System SHALL beim Anlegen eines Changes ein git-Arbeitsverzeichnis unter
`.claude/worktrees/` erzeugen, dessen Name die Change-Kennung ist, und SHALL den
zugehoerigen Branch dort auschecken.

Die vier Artefakte des Changes SHALL im neuen Arbeitsverzeichnis entstehen, nicht im
Hauptordner. Die Meldung SHALL den Pfad nennen, unter dem gearbeitet wird.

#### Scenario: Ein neuer Change bekommt sein eigenes Verzeichnis

- **Given** ein Hauptordner auf dem Branch `main`
- **When** ein Change mit der Kennung `beispiel` angelegt wird
- **Then** existiert das Verzeichnis `.claude/worktrees/beispiel`
- **And** dort ist der Branch `change/beispiel` ausgecheckt
- **And** die Artefakte liegen unter `.claude/worktrees/beispiel/openspec/changes/beispiel`
- **And** die Meldung nennt diesen Pfad

#### Scenario: Eine belegte Kennung legt nichts an

- **Given** ein bereits vorhandenes Arbeitsverzeichnis zur Kennung `beispiel`
- **When** ein Change mit derselben Kennung angelegt werden soll
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** das vorhandene Arbeitsverzeichnis bleibt unveraendert

### Requirement: Der Hauptordner behaelt seinen Branch

Das System SHALL beim Anlegen eines Changes den Branch des Hauptordners nicht
wechseln und SHALL dort keine Datei anlegen oder aendern.

#### Scenario: Der Hauptordner steht nach dem Anlegen unveraendert da

- **Given** ein Hauptordner auf dem Branch `main` ohne ungesicherte Aenderungen
- **When** ein Change angelegt wird
- **Then** steht der Hauptordner weiterhin auf `main`
- **And** er hat keine ungesicherten Aenderungen

### Requirement: Ein Aufruf aus einem Arbeitsverzeichnis wird abgelehnt

Das System SHALL erkennen, ob es aus einem Arbeitsverzeichnis heraus gerufen wird,
und SHALL in diesem Fall keinen Change anlegen. Die Meldung SHALL den Hauptordner
nennen, aus dem der Aufruf zu wiederholen ist.

#### Scenario: Geschachtelte Arbeitsverzeichnisse entstehen nicht

- **Given** ein Arbeitsverzeichnis unter `.claude/worktrees/beispiel`
- **When** dort ein weiterer Change angelegt werden soll
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** die Meldung nennt den Pfad des Hauptordners
- **And** es entsteht kein weiteres Arbeitsverzeichnis

### Requirement: Das justfile zaehlt nur als Ueberschneidung, wenn es geaendert wird

Das System SHALL einen Change, der am `justfile` ausschliesslich Zeilen anhaengt, in
Bezug auf diese Datei nicht als ueberschneidend behandeln. Entfernt oder aendert ein
Change dort eine bestehende Zeile, SHALL die Pruefung fehlschlagen.

Massgeblich SHALL der Diff des Changes gegen den Hauptbranch sein, nicht eine Zusage
im Vorschlag.

#### Scenario: Ein angehaengtes Ziel ist kein Konflikt

- **Given** ein Change, dessen Diff am `justfile` vier Zeilen hinzufuegt und keine entfernt
- **When** Gate 1 laeuft
- **Then** besteht die Pruefung zur Anhaenge-Regel
- **And** das `justfile` zaehlt fuer die Ueberschneidung mit anderen Changes nicht mit

#### Scenario: Eine geaenderte Zeile faellt auf

- **Given** ein Change, dessen Diff am `justfile` zwei Zeilen hinzufuegt und eine entfernt
- **When** Gate 1 laeuft
- **Then** schlaegt die Pruefung zur Anhaenge-Regel fehl
- **And** die Meldung nennt die Zahl der entfernten Zeilen
- **And** es entsteht keine Datei `gate1.md`
