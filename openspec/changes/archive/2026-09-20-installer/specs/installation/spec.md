# installation

## ADDED Requirements

### Requirement: Die erste Stufe legt Skill und Arbeiter im Konfigurationsordner ab

Das System SHALL den Leitstand-Skill und die Beschreibung des Change-Arbeiters in den
Konfigurationsordner von Claude Code schreiben. Den Ort dieses Ordners SHALL das System der
Umgebungsvariablen `CLAUDE_CONFIG_DIR` entnehmen und nur ersatzweise `.claude` im
Benutzerverzeichnis verwenden; ein ausgeschriebener Pfad im Code SHALL dafür nicht maßgeblich
sein.

Das System SHALL in derselben Stufe den Installer und die Dateien, die seine zweite Stufe
ausrollt, unterhalb desselben Konfigurationsordners ablegen. Die zweite Stufe SHALL danach
ohne das Repository ops-lab lauffähig sein.

#### Scenario: Erste Stufe in einem leeren Konfigurationsordner

- **Given** ein leerer Ordner, auf den `CLAUDE_CONFIG_DIR` zeigt
- **When** der Installer läuft
- **Then** liegt dort die Skill-Beschreibung unter `skills/leitstand/SKILL.md`
- **And** dort liegt die Arbeiterbeschreibung unter `agents/change-arbeiter.md`
- **And** dort liegt der Installer selbst, zusammen mit den Werkzeugen und dem Lagebild

### Requirement: Die erste Stufe ersetzt eine vorhandene Fassung

Das System SHALL eine im Konfigurationsordner bereits liegende Fassung ersetzen, ohne
Rückfrage. Nach dem Lauf SHALL kein Bestandteil einer früheren Fassung zurückbleiben, der
nicht mehr zur ausgerollten gehört.

Ein zweiter Lauf SHALL denselben Zustand herstellen wie der erste.

#### Scenario: Eine ältere Fassung liegt schon dort

- **Given** ein Konfigurationsordner, dessen Skill-Beschreibung einen fremden Inhalt trägt
- **And** eine überzählige Datei im selben Skill-Ordner
- **When** der Installer läuft
- **Then** trägt die Skill-Beschreibung den Inhalt aus der Quelle
- **And** die überzählige Datei ist nicht mehr vorhanden

#### Scenario: Zweiter Lauf hintereinander

- **Given** ein Konfigurationsordner nach einem vollständigen Lauf des Installers
- **When** der Installer ein zweites Mal läuft
- **Then** endet er mit Exit-Code null
- **And** der Ordner trägt dieselben Dateien mit demselben Inhalt wie nach dem ersten Lauf

### Requirement: Die zweite Stufe legt Werkzeuge, Gerüst und Tests im Zielprojekt ab

Das System SHALL in das angegebene Zielprojekt die Werkzeuge unter `tools/` und das Lagebild
`ops.py` schreiben. Dabei SHALL es dieselbe Auswahl treffen wie das Ausrollen ins Testrepo:
alle Node-Werkzeuge außer `sync.mjs`, und zusätzlich SHALL es `install.mjs` auslassen — beide
sind Sache des Ursprungs, nicht des Projekts.

Das System SHALL unter `openspec/` ein Gerüst anlegen: die Ordner `changes` und `specs`, jeder
mit einer leeren Datei `.gitkeep`, sowie eine Datei `config.yaml`. Eine bereits vorhandene
`config.yaml` SHALL das System unangetastet lassen, weil sie den Kontext des Projekts trägt.

Das System SHALL die Tests unter `tests/` mitschreiben; ohne sie ist eine Gate-Regel nur eine
Behauptung.

Ohne Argument SHALL das Arbeitsverzeichnis das Zielprojekt sein.

#### Scenario: Zweite Stufe in einem leeren Projektordner

- **Given** ein leerer Ordner als Zielprojekt
- **When** der Installer mit diesem Ordner als Argument läuft
- **Then** liegen dort `tools/gate.mjs`, `tools/pruefungen.mjs` und `ops.py`
- **And** dort liegen weder `tools/sync.mjs` noch `tools/install.mjs`
- **And** dort liegen `openspec/changes/.gitkeep`, `openspec/specs/.gitkeep` und `openspec/config.yaml`
- **And** dort liegt mindestens eine Testdatei unter `tests/`

#### Scenario: Das Projekt führt schon eine eigene config.yaml

- **Given** ein Zielprojekt mit einer `openspec/config.yaml` eigenen Inhalts
- **When** der Installer läuft
- **Then** trägt diese Datei unverändert ihren eigenen Inhalt

### Requirement: Die Rezepte stehen in einem markierten Block des justfile

Das System SHALL die Rezepte des Ablaufs an das Ende des `justfile` im Zielprojekt schreiben,
eingefasst in eine Anfangs- und eine Schlusszeile, die den Block als vom Installer verwaltet
ausweisen. Gibt es dort kein `justfile`, SHALL das System eines anlegen, das nur diesen Block
enthält.

Bei einem erneuten Lauf SHALL das System ausschließlich diesen Block ersetzen. Jeder Text
außerhalb der beiden Markierungen SHALL unverändert bleiben, und der Block SHALL genau einmal
vorkommen.

#### Scenario: Ein Projekt ohne justfile

- **Given** ein Zielprojekt ohne `justfile`
- **When** der Installer läuft
- **Then** gibt es dort ein `justfile`
- **And** es enthält genau eine Anfangs- und eine Schlussmarkierung
- **And** zwischen ihnen steht das Rezept `gate1`

#### Scenario: Ein Projekt mit eigenen Rezepten

- **Given** ein Zielprojekt, dessen `justfile` ein eigenes Rezept führt
- **When** der Installer zweimal hintereinander läuft
- **Then** steht das eigene Rezept unverändert weiterhin darin
- **And** die Anfangsmarkierung kommt genau einmal vor
- **And** das Rezept `gate1` kommt genau einmal vor

### Requirement: Der Installer schreibt keine CLAUDE.md, sondern gibt einen Uebergabetext aus

Das System SHALL die `CLAUDE.md` des Zielprojekts weder anlegen noch ändern.

Das System SHALL am Ende seines Laufs auf der Standardausgabe einen Text ausgeben, der die
Standardvorgehensweise — Gates, Arbeitsräume, Merges — als Auftrag an ein Sprachmodell
formuliert, sie in die `CLAUDE.md` des Zielprojekts einzuarbeiten und dabei an dessen Technik
und Ton anzupassen. Der Text SHALL so geschrieben sein, dass er sich unverändert weiterreichen
lässt.

#### Scenario: Ausgabe nach einem vollständigen Lauf

- **Given** ein Zielprojekt ohne `CLAUDE.md`
- **When** der Installer läuft
- **Then** nennt die Standardausgabe die drei Gates, die Arbeitsräume und die Merge-Regel
- **And** im Zielprojekt ist keine `CLAUDE.md` entstanden

### Requirement: Der Leitstand-Skill nennt keinen ausgeschriebenen Pfad

Die Beschreibung des Leitstand-Skills SHALL keinen absoluten Pfad eines bestimmten Repositorys
enthalten. Als Projektwurzel SHALL das Arbeitsverzeichnis gelten, in dem der Skill gerufen
wurde.

#### Scenario: Der global abgelegte Skill zeigt auf kein bestimmtes Repo

- **Given** ein Konfigurationsordner nach dem Lauf des Installers
- **When** die dort abgelegte Skill-Beschreibung gelesen wird
- **Then** enthält sie keinen absoluten Pfad in ein Benutzerverzeichnis
