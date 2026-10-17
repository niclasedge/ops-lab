# lagebild

## ADDED Requirements

### Requirement: Ansicht auf Abruf

Das System SHALL mit dem Parameter `--web` eine nur lesende HTTP-Ansicht des Lagebilds
starten und dabei auf `127.0.0.1` binden. Der Port SHALL über `--web-port` wählbar sein
und ohne Angabe 8765 betragen. Das System SHALL die gewählte Adresse beim Start
ausgeben, damit sie sich ohne Raten öffnen lässt.

#### Scenario: Ansicht startet auf dem Vorgabeport

- **Given** ein Repo mit mindestens einem Worktree
- **When** `ops.py --web` aufgerufen wird
- **Then** meldet das System die Adresse `http://127.0.0.1:8765` und beantwortet dort
  eine Anfrage auf `/` mit einer HTML-Seite

#### Scenario: Port wird vorgegeben

- **Given** Port 8765 ist bereits belegt
- **When** `ops.py --web --web-port 8790` aufgerufen wird
- **Then** meldet das System die Adresse mit Port 8790 und bedient Anfragen dort

### Requirement: Nutzlast ohne Server prüfbar

Das System SHALL mit `--web --trocken` genau die Nutzlast als JSON auf die
Standardausgabe schreiben, die die HTTP-Ansicht ausliefert, und dabei keinen Server
starten und keine Fremdbibliothek laden. Der Aufruf SHALL mit Exit-Code 0 enden.

#### Scenario: Trockenlauf gibt die Nutzlast aus

- **Given** ein Repo mit offenen Changes
- **When** `ops.py --web --trocken` aufgerufen wird
- **Then** steht auf der Standardausgabe ein JSON-Objekt mit den Schlüsseln
  `worktrees`, `changes` und `zeitleiste`, kein Server horcht auf einem Port, und der
  Exit-Code ist 0

### Requirement: Worktrees mit Stand und Zeitpunkt

Die Nutzlast SHALL zu jedem Worktree den Pfad, den Namen, den Branch, den Kopfstand mit
Betreff, den Zeitpunkt des Kopfcommits sowie den Arbeitsstand aus vorgemerkten,
geänderten und unverfolgten Dateien nennen. Sie SHALL ausweisen, welcher Worktree der
Hauptbaum ist, und SHALL den Zeitpunkt der jüngsten Änderung je Worktree als
vergleichbaren Wert führen.

#### Scenario: Worktree mit offenen Änderungen

- **Given** ein Worktree mit zwei geänderten und einer unverfolgten Datei
- **When** die Nutzlast erzeugt wird
- **Then** trägt der Eintrag dieses Worktrees Branch, Kopfstand, Commitzeitpunkt und die
  Zähler 0 vorgemerkt, 2 geändert, 1 unverfolgt

### Requirement: Changes nach Bereitschaft

Die Nutzlast SHALL jeden Change mit seiner Bereitschaft führen — `frei`, `laeuft`,
`fertig`, `im PR` oder `blockiert` — und SHALL zu jedem Change den Worktree, den Stand
der Aufgaben als erledigt und gesamt, die bestandenen Gates und die nächste offene
Aufgabe nennen. Ein blockierter Change SHALL nennen, worauf er wartet.

#### Scenario: Blockierter Change nennt seinen Blocker

- **Given** zwei Changes berühren dieselbe Capability und einer davon ist begonnen
- **When** die Nutzlast erzeugt wird
- **Then** trägt der noch nicht begonnene Change die Bereitschaft `blockiert` und nennt
  den begonnenen Change als Grund

#### Scenario: Offener Change nennt seine nächste Aufgabe

- **Given** ein Change mit drei von acht erledigten Aufgaben
- **When** die Nutzlast erzeugt wird
- **Then** trägt der Eintrag die Bereitschaft `laeuft`, den Stand 3 von 8 und den Text
  der ersten noch offenen Aufgabe

### Requirement: Zeitleiste über alle Worktrees

Die Nutzlast SHALL eine Zeitleiste führen, die jede nachweisbare Fertigstellung einer
Aufgabe über alle Worktrees hinweg mit Zeitpunkt, Change, Aufgabennummer, Text und
Herkunft des Nachweises enthält, absteigend nach Zeitpunkt sortiert. Die Zeitleiste
SHALL nicht gekürzt werden.

#### Scenario: Fertigstellungen zweier Worktrees stehen gemischt

- **Given** zwei Worktrees mit Fertigstellungen zu verschiedenen Zeitpunkten
- **When** die Nutzlast erzeugt wird
- **Then** stehen die Einträge beider Worktrees in einer gemeinsamen Liste, die jüngste
  zuerst, und jeder Eintrag nennt seinen Change

### Requirement: Ein Change gehört dem Arbeitsbaum, der ihn bearbeitet

Liegt derselbe Change in mehreren Arbeitsbäumen, SHALL die Nutzlast ihn genau einmal
führen. Das System SHALL dafür den Inhalt des Change-Ordners mit dem des Hauptbaums
vergleichen und den Change dem Arbeitsbaum zuordnen, dessen Ordner abweicht. Weicht
kein Arbeitsbaum ab, SHALL der Change dem Hauptbaum zugeordnet werden. Weicht mehr als
einer ab, SHALL das System den Arbeitsbaum mit der jüngsten Änderung wählen und die
übrigen abweichenden Bäume namentlich nennen. Ein Change, den der Hauptbaum nicht kennt,
SHALL dem Arbeitsbaum zugeordnet werden, in dem er liegt. Jeder Eintrag SHALL ausweisen,
ob er gegenüber dem Hauptbaum abweicht.

#### Scenario: Unveränderte Kopie im Arbeitsbaum

- **Given** ein Change liegt im Hauptbaum und inhaltsgleich in einem Arbeitsbaum
- **When** die Nutzlast erzeugt wird
- **Then** steht der Change genau einmal, zugeordnet zum Hauptbaum, und ist als nicht
  abweichend ausgewiesen

#### Scenario: Bearbeitete Kopie im Arbeitsbaum

- **Given** ein Change liegt im Hauptbaum und in einem Arbeitsbaum mit geänderter
  `tasks.md`
- **When** die Nutzlast erzeugt wird
- **Then** steht der Change genau einmal, zugeordnet zu diesem Arbeitsbaum, und ist als
  abweichend ausgewiesen

#### Scenario: Change nur im Arbeitsbaum

- **Given** ein Change, den der Hauptbaum nicht kennt
- **When** die Nutzlast erzeugt wird
- **Then** steht er bei dem Arbeitsbaum, in dem er liegt, und ist als abweichend
  ausgewiesen

#### Scenario: Derselbe Change in zwei Arbeitsbäumen

- **Given** ein Change liegt in zwei Arbeitsbäumen mit unterschiedlichem Inhalt
- **When** die Nutzlast erzeugt wird
- **Then** steht er genau einmal, beim Arbeitsbaum mit der jüngsten Änderung, und sein
  Eintrag nennt den zweiten Arbeitsbaum als weiteren Ort

### Requirement: Geänderte Dateien beim Namen

Die Nutzlast SHALL zu jedem Arbeitsbaum die geänderten Dateien einzeln mit Pfad und Art
der Änderung nennen. Als Art SHALL sie `vorgemerkt`, `geaendert`, `unverfolgt` oder
`geloescht` ausweisen. Die Liste SHALL nach Pfad sortiert sein. Ein sauberer Arbeitsbaum
SHALL eine leere Liste führen.

#### Scenario: Arbeitsbaum mit gemischten Änderungen

- **Given** ein Arbeitsbaum mit einer vorgemerkten, einer geänderten und einer
  unverfolgten Datei
- **When** die Nutzlast erzeugt wird
- **Then** nennt seine Dateiliste drei Einträge mit Pfad und jeweiliger Art, nach Pfad
  sortiert

#### Scenario: Sauberer Arbeitsbaum

- **Given** ein Arbeitsbaum ohne Änderung gegenüber seinem Kopfcommit
- **When** die Nutzlast erzeugt wird
- **Then** ist seine Dateiliste leer

### Requirement: Aufgaben eines Changes aufklappbar

Die Nutzlast SHALL zu jedem Change seine Aufgaben mit Nummer, Text, Abschnitt und dem
Merkmal erledigt führen, in der Reihenfolge der `tasks.md`. Die Ansicht SHALL diese
Aufgaben eingeklappt halten und auf Klick zeigen, damit der Überblick nicht von den
Einzelheiten verdrängt wird.

#### Scenario: Change mit erledigten und offenen Aufgaben

- **Given** ein Change, dessen erste zwei von acht Aufgaben abgehakt sind
- **When** die Nutzlast erzeugt wird
- **Then** führt sein Eintrag acht Aufgaben in der Reihenfolge der Datei, davon die
  ersten zwei als erledigt

### Requirement: Platz für Belege

Die Nutzlast SHALL zu jedem Change ein Feld `belege` führen. Das Feld SHALL eine Liste
sein und SHALL leer bleiben, solange kein Beleg vorliegt. Das System SHALL zum Füllen
dieses Feldes keine Bilddateien lesen und keinen Belegordner anlegen.

#### Scenario: Change ohne Belege

- **Given** ein Change, dessen Ordner keinen Unterordner `belege` enthält
- **When** die Nutzlast erzeugt wird
- **Then** trägt der Eintrag das Feld `belege` als leere Liste, und im Change-Ordner
  wurde nichts angelegt

### Requirement: Fehlende Bibliothek meldet sich

Fehlt beim Aufruf von `--web` die Bibliothek FastAPI oder uvicorn, SHALL das System eine
deutsche Meldung ausgeben, die den Befehl nennt, der sie mitbringt, und SHALL mit einem
Exit-Code ungleich 0 enden. Das System SHALL dabei keinen Stacktrace zeigen.

#### Scenario: FastAPI ist nicht installiert

- **Given** eine Umgebung ohne FastAPI
- **When** `ops.py --web` aufgerufen wird
- **Then** erscheint eine Meldung, die `just web` als Weg nennt, der Exit-Code ist
  ungleich 0, und es erscheint kein Stacktrace

### Requirement: Terminal-Ansicht bleibt unberührt

Das System SHALL die Ausgabe von `--once`, `--graph`, `--json` und `--count` durch diesen
Change nicht verändern. Diese Aufrufe SHALL ohne FastAPI und ohne uvicorn laufen.

#### Scenario: Lagebild ohne Fremdbibliothek

- **Given** eine Umgebung ohne FastAPI
- **When** `ops.py --once` aufgerufen wird
- **Then** erscheint das Lagebild wie zuvor und der Exit-Code ist 0
