# arbeitsraum

## ADDED Requirements

### Requirement: Der neue Change nennt sein Muster

Das System SHALL beim Anlegen eines Changes die drei Dateien des juengsten archivierten
Changes als Muster nennen, wenn ein Archiv vorliegt, und SHALL sagen, dass die frisch
angelegten Artefakte Vorlagen mit Platzhaltern sind, die ueberschrieben und nicht gelesen
werden.

#### Scenario: Ein Archiv liegt vor

- **Given** ein Repo mit `openspec/changes/archive/2026-01-01-alt/`
- **When** ein Change angelegt wird
- **Then** nennt die Meldung `archive/2026-01-01-alt/proposal.md`
- **And** sie nennt die Artefakte Vorlagen

#### Scenario: Das juengste Archiv gewinnt

- **Given** die Archiveintraege `2026-01-01-alt` und `2026-03-01-neu`
- **When** das Muster bestimmt wird
- **Then** ist es `2026-03-01-neu`

### Requirement: Abgabe und Merge sind je ein Aufruf

Das System SHALL die Abgabe eines Changes — committen, pushen, Pull Request stellen — als
einen Aufruf anbieten, der `fertig.md` verlangt und ohne diesen Nachweis nichts tut. Es
SHALL den Merge als einen Aufruf anbieten, der aus dem Arbeitsraum heraus funktioniert:
Pull Request mergen, fernen Branch entfernen, Hauptordner nachziehen, ohne `main`
auszuchecken.

#### Scenario: Abgabe ohne fertig.md

- **Given** ein Change ohne `fertig.md`
- **When** die Abgabe gerufen wird
- **Then** wird kein Schritt ausgefuehrt
- **And** die Meldung nennt `fertig`

#### Scenario: Merge aus dem Arbeitsraum

- **Given** ein Change in seinem Arbeitsraum mit gemergtem oder mergbarem Pull Request
- **When** der Merge gerufen wird
- **Then** enthaelt kein Schritt `--delete-branch` und keiner `checkout main`
- **And** der Hauptordner wird per `pull --ff-only` nachgezogen
