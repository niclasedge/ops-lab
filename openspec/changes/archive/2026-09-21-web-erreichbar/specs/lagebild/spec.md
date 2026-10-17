# lagebild

## ADDED Requirements

### Requirement: Bindeadresse der Web-Ansicht

Das System SHALL die Adresse, auf der die Web-Ansicht hört, über `--web-host` entgegennehmen
und ohne diese Angabe auf `127.0.0.1` binden.

#### Scenario: Ohne Angabe bleibt die Ansicht lokal

- **Given** das Lagebild wird mit `--web` ohne `--web-host` gestartet
- **When** die Bindeadresse bestimmt wird
- **Then** ist sie `127.0.0.1` und die Ansicht ist von außerhalb des Rechners nicht erreichbar

#### Scenario: Angegebene Adresse wird übernommen

- **Given** das Lagebild wird mit `--web --web-host 0.0.0.0` aufgerufen
- **When** der Aufruf die Bindeadresse bestimmt
- **Then** ist sie `0.0.0.0` und der Aufruf wird ohne Fehler über die Argumentprüfung
  angenommen

### Requirement: Startmeldung nennt die Erreichbarkeit

Das System SHALL beim Start der Web-Ansicht eine Zeile ausgeben, die die aufrufbare Adresse
samt Port nennt, und SHALL dieser Zeile einen Hinweis auf das lokale Netz beifügen, wenn die
Bindeadresse über den eigenen Rechner hinausreicht.

#### Scenario: Lokale Bindung meldet keine Netzreichweite

- **Given** die Bindeadresse ist `127.0.0.1` und der Port `8765`
- **When** die Startmeldung gebildet wird
- **Then** enthält sie `http://127.0.0.1:8765` und keinen Hinweis auf das lokale Netz

#### Scenario: Offene Bindung weist auf das lokale Netz hin

- **Given** die Bindeadresse ist `0.0.0.0` und der Port `8790`
- **When** die Startmeldung gebildet wird
- **Then** enthält sie den Port `8790` und den Hinweis, dass die Ansicht im lokalen Netz
  erreichbar ist

### Requirement: Belegter Port meldet sich als Satz

Das System SHALL vor dem Laden der Web-Bibliotheken prüfen, ob die gewünschte Adresse samt
Port frei ist, und SHALL bei einem belegten Port mit einer Meldung enden, die den Port nennt
und auf `--web-port` verweist, statt einen Traceback der Fremdbibliothek auszugeben.

#### Scenario: Der Port ist vergeben

- **Given** auf `127.0.0.1` hört bereits ein anderer Dienst auf dem gewählten Port
- **When** das Lagebild mit `--web` auf genau diesen Port gestartet wird
- **Then** endet der Aufruf mit einem von Null verschiedenen Exit-Code, die Meldung nennt den
  belegten Port und den Schalter `--web-port`, und es erscheint keine Zeile, die den Start der
  Ansicht behauptet
