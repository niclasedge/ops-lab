# lagebild — Delta

## ADDED Requirements

### Requirement: Die Nutzlast ist gegen ein hergestelltes Repo prüfbar

Das System SHALL die Nutzlast für das mit `--root` benannte Repo bilden und dabei
dessen Arbeitsbäume, Changes und Aufgaben lesen, nicht die des Verzeichnisses, aus dem
der Aufruf stammt. Eine Prüfung der Nutzlast SHALL ihr Repo selbst herstellen dürfen und
SHALL NOT davon abhängen, welche Changes im laufenden Repo gerade offen sind.

Der Grund steht im Bestand: eine Prüfung, die auf einen Arbeitsbaum mit festem Namen
filterte, wurde rot, als der zugehörige Change gemergt und archiviert war — sechzehn
Prüfungen fielen auf einmal, und mit ihnen F-4 für jeden weiteren Change. Eine Prüfung,
die der Abschluss eines fremden Changes umwirft, prüft den Zufall mit.

#### Scenario: Ein hergestelltes Repo liefert seine eigene Nutzlast

- **Given** ein frisch angelegtes Repo mit einem Hauptbaum, einem Arbeitsbaum und einem
  Change, der im Arbeitsbaum abweichend bearbeitet wurde
- **When** `ops.py --root PFAD --web --trocken` aufgerufen wird
- **Then** nennt die Nutzlast beide Arbeitsbäume und führt den Change bei dem Baum, der
  ihn bearbeitet, mit `weicht_ab` gleich `true`

#### Scenario: Der Zustand des laufenden Repos verschiebt das Ergebnis nicht

- **Given** dieselbe Prüfung und ein laufendes Repo, in dem kein einziger Change offen ist
- **When** die Prüfung ausgeführt wird
- **Then** fällt keine ihrer Aussagen aus, weil die Nutzlast aus dem hergestellten Repo
  stammt und nicht aus dem laufenden

#### Scenario: Ein archivierter Change macht die Prüfung nicht rot

- **Given** eine Prüfung, die zuvor gegen einen offenen Change des laufenden Repos lief
- **When** dieser Change gemergt und archiviert wird
- **Then** bleibt die Prüfung grün, weil sie ihren eigenen Change im hergestellten Repo
  anlegt
