# messung

## ADDED Requirements

### Requirement: Eine API-Antwort zaehlt einmal

Das System SHALL beim Summieren der Token jede API-Antwort genau einmal zaehlen, auch
wenn die Mitschrift sie als mehrere Zeilen mit derselben Nachrichtenkennung fuehrt.
Zeilen ohne Nachrichtenkennung SHALL das System weiterhin einzeln zaehlen.

#### Scenario: Drei Zeilen, eine Antwort

- **Given** eine Mitschrift mit drei Zeilen derselben `message.id` und identischer `usage`
- **When** die Token summiert werden
- **Then** zaehlt die Summe die Nutzung dieser Antwort einmal
- **And** die Zahl der Nachrichten ist eins

#### Scenario: Zeilen ohne Kennung bleiben einzeln

- **Given** zwei Zeilen mit Nutzungsangabe, aber ohne `message.id`
- **When** die Token summiert werden
- **Then** zaehlt die Summe beide

### Requirement: Die Lage wird dort gelesen, wo gearbeitet wurde

Das System SHALL die Lage eines Laufs im Arbeitsraum der Kennung lesen, wenn dieser im
Zielrepo vorliegt; sonst im Hauptordner; sonst im Archiv. Nachweise, Belege, Aufgaben,
Diff und Testlauf SHALL aus demselben Ort stammen.

#### Scenario: Der Arbeitsraum geht vor

- **Given** ein Zielrepo mit einem Arbeitsraum `.claude/worktrees/KENNUNG`
- **When** die Orte des Vorgangs bestimmt werden
- **Then** steht der Arbeitsraum an erster Stelle
- **And** der Hauptordner an zweiter

### Requirement: Altlast einer Kennung haelt den Lauf auf

Das System SHALL den selbstaendigen Lauf verweigern, solange im Zielrepo ein Arbeitsraum,
ein lokaler Branch, ein ferner Branch oder ein offener Pull Request zur Kennung vorliegt
oder das Werkstueck auf `origin/main` von Stand 0 abweicht. Es SHALL je Fund den
Handgriff nennen, der ihn raeumt, und SHALL selbst nichts entfernen.

#### Scenario: Ferner Branch aus dem vorigen Lauf

- **Given** ein Zielrepo, in dem `origin/change/KENNUNG` noch steht
- **When** der Lauf starten soll
- **Then** startet er nicht
- **And** der Rat nennt `git push origin --delete change/KENNUNG`

#### Scenario: Kein Fund, der Lauf startet

- **Given** ein Zielrepo ohne Arbeitsraum, Branch, Pull Request oder Abweichung zur Kennung
- **When** der Lauf starten soll
- **Then** startet er

### Requirement: Der Rahmen erspart die Umwege des Belegs und der Abgabe

Das System SHALL im Rahmen um den Auftrag nennen: dass `belegbild.mjs` die Kurve ueber
den letzten Parameter zieht und `--argument` die Parameter davor belegt; dass das Bild
nicht geoeffnet wird; dass die frisch angelegten Artefakte Vorlagen sind und nicht
gelesen werden; dass Abgabe und Merge je ein Aufruf von `abgabe.mjs` und `merge.mjs`
sind; und dass der Auftrag vollstaendig ist und kein Issue nachgeschlagen wird.

#### Scenario: Der Rahmen nennt die fuenf Hinweise

- **Given** der Rahmen um einen Auftrag
- **When** er dem Agenten uebergeben wird
- **Then** nennt er `letzten Parameter`, `abgabe.mjs`, `merge.mjs`
- **And** er sagt, dass das Bild nicht geoeffnet und die Vorlagen nicht gelesen werden
- **And** er sagt, dass kein Issue nachgeschlagen wird
