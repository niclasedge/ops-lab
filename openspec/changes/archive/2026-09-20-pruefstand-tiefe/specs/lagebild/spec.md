# lagebild — Delta

## ADDED Requirements

### Requirement: Jede Art und jede Fertigstellung ist am hergestellten Repo belegt

Die Prüfung der Nutzlast SHALL zu jeder Dateiart, die sie unterscheidet, mindestens einen
Fall am hergestellten Repo vorliegen haben, und SHALL die Zeitleiste gegen eine
Fertigstellung prüfen, die sie selbst angelegt hat. Eine Aussage über eine Liste SHALL
NOT allein am laufenden Repo hängen, wenn deren Inhalt dort nicht zugesichert ist.

Der Grund steht im Bestand: am laufenden Repo lagen zum Zeitpunkt der Messung Dateien
einer einzigen Art vor (`{"unverfolgt": 1}`), obwohl die Prüfung vier Arten aufzählt. Die
übrigen drei waren damit ungeprüft, und bei sauberem Arbeitsbaum wären alle vier Prüfungen
des Abschnitts gegenstandslos gewesen, ohne rot zu werden. Die Zeitleiste trug 15 Einträge
— angefallen aus den offenen Changes, nicht hergestellt.

#### Scenario: Die Dateiliste belegt alle vier Arten

- **Given** einen hergestellten Arbeitsbaum mit je einer vorgemerkten, geänderten,
  unverfolgten und gelöschten Datei
- **When** die Nutzlast dieses Repos gebildet wird
- **Then** enthält die Dateiliste dieses Arbeitsbaums zu jeder der vier Arten mindestens
  einen Eintrag

#### Scenario: Die Zeitleiste führt eine hergestellte Fertigstellung

- **Given** ein hergestelltes Repo, in dessen Arbeitsbaum eine Aufgabe abgehakt und dieser
  Schritt einzeln committet wurde
- **When** die Nutzlast dieses Repos gebildet wird
- **Then** führt `zeitleiste` mindestens einen Eintrag, und einer davon nennt den Change
  des Arbeitsbaums

#### Scenario: Ein sauberes Repo entwertet die Aussage nicht

- **Given** ein laufendes Repo ohne eine einzige geänderte Datei
- **When** die Prüfung ausgeführt wird
- **Then** bleibt die Aussage über die vier Arten belegt, weil sie am hergestellten Repo
  geprüft wird und nicht am laufenden
