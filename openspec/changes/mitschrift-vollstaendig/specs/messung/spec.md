# messung

## ADDED Requirements

### Requirement: Die Mitschriften eines Repos umfassen seine Arbeitsraeume

Das System SHALL zu einem Repo alle Mitschriftenordner ermitteln: den des
Hauptordners und den jedes Arbeitsraums unterhalb von `.claude/worktrees/`.

Der Grund liegt im Ablauf selbst. Jeder Change bekommt einen eigenen Arbeitsraum, und
gearbeitet wird dort. Claude Code legt seine Mitschrift je Arbeitsverzeichnis ab —
fragt der Messrahmen nur den Hauptordner ab, bleibt genau der Lauf ungemessen, der dem
Ablauf folgt.

Ein Ordner, den es nicht gibt, SHALL uebersprungen werden und nicht zum Abbruch
fuehren. Ein Arbeitsraum ohne Mitschrift ist der Normalfall, kein Fehler.

#### Scenario: Ein Lauf im Arbeitsraum wird gefunden

- **Given** ein Repo mit einem Arbeitsraum `.claude/worktrees/beispiel`
- **And** eine Mitschrift, die zu diesem Arbeitsverzeichnis gehoert
- **When** die Mitschriftenordner des Repos ermittelt werden
- **Then** ist der Ordner des Arbeitsraums darunter
- **And** der Ordner des Hauptordners ebenfalls

#### Scenario: Ein Arbeitsraum ohne Mitschrift haelt die Messung nicht auf

- **Given** ein Repo mit zwei Arbeitsraeumen, von denen nur einer je eine Sitzung sah
- **When** die Mitschriftenordner des Repos ermittelt werden
- **Then** endet die Ermittlung ohne Fehler
- **And** der Ordner ohne Mitschrift ist nicht in der Liste

### Requirement: Die Token-Uebersicht misst ein benanntes Repo

Das System SHALL die Token-Uebersicht auf ein anderes Repo als das eigene
Arbeitsverzeichnis richten lassen. Gemessen SHALL dabei dasselbe werden wie beim
eigenen: alle Mitschriften des Repos einschliesslich seiner Arbeitsraeume.

Die Uebersicht SHALL je Sitzung den Beginn aus der Mitschrift ausweisen, nicht das
Aenderungsdatum der Datei. Das Aenderungsdatum verschiebt sich, sobald ein Hook die
Datei anfasst, und wies im Bestand mehrere Sitzungen auf denselben Zeitpunkt aus,
Stunden nach ihrem tatsaechlichen Ende.

Die Kennzahl ueber alle Sitzungen SHALL Sitzungen unterhalb von fuenf Nachrichten
ausschliessen und ihre Zahl nennen. Diese Sitzungen sind Aufrufe von Hooks und
Werkzeugen, keine Laeufe.

#### Scenario: Der Beginn stammt aus der Mitschrift

- **Given** eine Mitschrift, deren erster Eintrag 09:12 nennt
- **And** eine Datei, deren Aenderungsdatum auf 14:12 steht
- **When** die Uebersicht erstellt wird
- **Then** weist sie 09:12 als Beginn aus

#### Scenario: Hook-Sitzungen verfaelschen die Kennzahl nicht

- **Given** zehn Sitzungen mit je einer Nachricht und drei Sitzungen mit je ueber
  hundert Nachrichten
- **When** die Kennzahl ueber alle Sitzungen errechnet wird
- **Then** beruht sie allein auf den drei Sitzungen mit ueber hundert Nachrichten
- **And** die Ausgabe nennt die Zahl der ausgeblendeten Sitzungen

## MODIFIED Requirements

### Requirement: Eine Messung nennt Aufwand und Ergebnis

Das System SHALL je Messlauf festhalten: verbrauchte Token getrennt nach Art, Zahl
der abgesetzten Befehle, Dauer in Sekunden, Kosten in Euro, den Startkontext und den
Erfuellungsgrad.

Die Dauer SHALL das System aus den Zeitstempeln der Mitschrift ermitteln, nicht aus
dem Aenderungsdatum ihrer Datei. Es SHALL zwei Groessen getrennt ausweisen: die Spanne
vom ersten bis zum letzten Eintrag, und die Summe der Abstaende, die unter einer
Pausenschwelle liegen. Die Spanne allein taugt nicht als Aufwandsmass — sie zaehlt
jede Mittagspause mit; die Summe allein verschweigt, wie lange ein Lauf im Kalender
stand.

Findet das System in einer Mitschrift weniger als zwei Zeitstempel, SHALL es die Dauer
als unbekannt ausweisen und nicht als null.

Den Startkontext SHALL das System aus der ersten Nachricht der Mitschrift ablesen und
als eigene Groesse ausweisen. Es SHALL ihn nicht aus dem Aufwand herausrechnen.

Die Kosten SHALL das System aus der Token-Zahl je Modell und einer im Repo gepflegten
Preistabelle errechnen. Fehlt zu einem verwendeten Modell ein Preis, SHALL das System
die Kosten als unbekannt ausweisen und nicht als null.

#### Scenario: Die Dauer trennt Spanne und Arbeitszeit

- **Given** eine Mitschrift ueber acht Stunden mit einer Unterbrechung von drei Stunden
- **When** die Messung errechnet wird
- **Then** weist sie eine Spanne von acht Stunden aus
- **And** eine Zeit ohne Pausen von fuenf Stunden

#### Scenario: Eine Mitschrift ohne zweiten Zeitstempel hat keine Dauer null

- **Given** eine Mitschrift mit genau einem Eintrag
- **When** die Messung errechnet wird
- **Then** weist sie die Dauer als unbekannt aus
- **And** nicht als null Sekunden

#### Scenario: Der Startkontext steht als eigene Groesse in der Messung

- **Given** eine Mitschrift, deren erste Nachricht den Startkontext nennt
- **When** die Messung errechnet wird
- **Then** weist sie den Startkontext getrennt vom uebrigen Aufwand aus
- **And** die ausgewiesene Gesamtsumme enthaelt ihn weiterhin

#### Scenario: Unbekanntes Modell macht die Kosten nicht zu null

- **Given** eine Mitschrift, die ein Modell nennt, das die Preistabelle nicht kennt
- **When** die Messung errechnet wird
- **Then** weist sie die Kosten dieses Modells als unbekannt aus
- **And** die Meldung nennt den Namen des fehlenden Modells

#### Scenario: Befehle werden aus der Mitschrift gezaehlt

- **Given** eine Mitschrift mit sieben Werkzeugaufrufen, davon vier auf der Schale
- **When** die Messung errechnet wird
- **Then** nennt sie sieben Werkzeugaufrufe und davon vier Schalenbefehle
