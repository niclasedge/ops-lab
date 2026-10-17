# arbeitsraum Specification

## Purpose

Wo ein Change gebaut wird, und wie zwei Changes einander dabei nicht in die Quere
kommen.

Jeder Change bekommt ein eigenes Arbeitsverzeichnis unter `.claude/worktrees/`; der
Hauptordner bleibt auf seinem Branch stehen. Der Anlass steht im Bestand: solange
`just neu` den Branch wechselte, landeten Werkzeugreparatur und Change-Artefakte im
selben Commit, weil niemand den Wechsel zurücknahm. Mit getrennten Arbeitsräumen kann
das nicht mehr passieren, und mehrere Agenten arbeiten gleichzeitig an derselben
Historie.

Dazu gehört die Regel, wann zwei Changes als überschneidend gelten. Sie entscheidet,
was parallel laufen darf — und sie ist maschinell geprüft, damit sie eine Bedingung
bleibt und keine Absprache wird.

## Requirements

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

### Requirement: Vorhandene Artefakte werden nicht ueberschrieben

Das System SHALL vor dem Anlegen des Arbeitsverzeichnisses pruefen, ob der Stand, von
dem abgezweigt wird, unter `openspec/changes` bereits einen Ordner zu dieser Kennung
fuehrt. Ist das der Fall, SHALL es den Change ablehnen und mit einem Exit-Code
ungleich null enden.

Massgeblich SHALL der versionierte Stand sein und nicht das Dateisystem des
Hauptordners. Ein frisch abgezweigtes Arbeitsverzeichnis traegt genau diesen Stand --
was dort liegt, wuerde von den Vorlagen ueberschrieben.

Die Meldung SHALL den Pfad nennen, unter dem die vorhandenen Artefakte liegen.

#### Scenario: Ein Change, dessen Artefakte schon im Hauptbranch liegen

- **Given** ein Hauptbranch, der `openspec/changes/vorhanden/proposal.md` mit eigenem
  Inhalt traegt
- **And** kein Arbeitsverzeichnis zur Kennung `vorhanden`
- **When** ein Change mit der Kennung `vorhanden` angelegt wird
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** die Meldung nennt den Pfad der vorhandenen Artefakte
- **And** `proposal.md` traegt unveraendert seinen eigenen Inhalt

### Requirement: Ein abgelehnter Aufruf legt nichts an

Das System SHALL bei einer Ablehnung wegen vorhandener Artefakte weder ein
Arbeitsverzeichnis noch einen Branch anlegen. Nach einem abgelehnten Aufruf SHALL die
Kennung unbelegt sein.

Die Pruefung SHALL deshalb vor dem Anlegen laufen und nicht danach: ein Rueckbau
koennte selbst fehlschlagen und liesse dann einen halben Zustand zurueck.

#### Scenario: Nach der Ablehnung ist die Kennung wieder frei

- **Given** ein Hauptbranch, der Artefakte zur Kennung `vorhanden` traegt
- **When** ein Change mit dieser Kennung angelegt und abgelehnt wird
- **Then** existiert kein Verzeichnis `.claude/worktrees/vorhanden`
- **And** `git worktree list` fuehrt kein Arbeitsverzeichnis zu dieser Kennung
- **And** es gibt keinen Branch `change/vorhanden`

### Requirement: Ein Arbeiter, ein Change, ein Arbeitsraum

Das System SHALL jedem beauftragten Arbeiter genau einen Change und genau einen Arbeitsraum
zuweisen. Das System SHALL nicht zwei Arbeiter gleichzeitig auf denselben Arbeitsraum setzen und
SHALL zwei Changes, die als überschneidend gelten, nacheinander beauftragen.

#### Scenario: Zwei freie Changes ohne Überschneidung

- **Given** zwei Changes, deren Dateiumfänge sich nicht überschneiden
- **When** beide beauftragt werden
- **Then** arbeitet jeder in seinem eigenen Arbeitsraum, und kein Arbeitsraum trägt zwei
  Aufträge

#### Scenario: Zwei Changes mit Überschneidung

- **Given** zwei Changes, deren Dateiumfänge sich überschneiden
- **When** beide beauftragt werden sollen
- **Then** wird nur der erste beauftragt, und der zweite bleibt bis zu dessen Abschluss
  zurückgestellt

### Requirement: Der Arbeiter startet keine weiteren Arbeiter

Das System SHALL dem Arbeiter keinen Werkzeugsatz geben, der das Starten weiterer Agenten
erlaubt. Das Verteilen von Aufträgen SHALL allein beim Leitstand liegen.

#### Scenario: Werkzeugsatz des Arbeiters

- **Given** die Beschreibung des Arbeiters
- **When** ihr Werkzeugsatz gelesen wird
- **Then** enthält er kein Werkzeug zum Starten von Agenten

### Requirement: Die Kette wird in fester Reihenfolge durchlaufen

Das System SHALL den Arbeiter die Schritte anlegen, Artefakte, Gate 1, roter Test, Gate 2,
Umsetzung, Beleg, Abschluss und Pull Request in genau dieser Reihenfolge durchlaufen lassen. Das
System SHALL vor dem bestätigten roten Lauf keine Umsetzung zulassen und SHALL anhalten, sobald
ein Gate nicht bestanden ist.

#### Scenario: Gate 1 wird nicht bestanden

- **Given** ein Arbeiter, dessen Change Gate 1 nicht besteht
- **When** das Gate antwortet
- **Then** hält der Arbeiter an und meldet den Stand, ohne den Test zu schreiben oder umzusetzen

#### Scenario: Gate 2 meldet einen grünen Lauf

- **Given** ein Arbeiter, dessen Test bei Gate 2 nicht rot wird
- **When** das Gate antwortet
- **Then** hält der Arbeiter an und meldet den Stand, ohne mit der Umsetzung zu beginnen

### Requirement: Merge nur bei vollständigem Nachweis

Das System SHALL einen Change ohne weitere Rückfrage mergen dürfen, wenn gate1.md, gate2.md und
fertig.md im Change liegen und der zugehörige Pull Request seine Prüfungen bestanden hat. In
jedem anderen Fall SHALL das System vor dem Merge nachfragen. Einen unbekannten Zustand SHALL
das System nicht als bestanden werten.

Meldet der Pull Request keine Prüfungen — das Repo führt keine —, so SHALL ein grüner Lauf von
`just alles` im Arbeitsraum an ihre Stelle treten. Ein Zustand ist damit nie einfach abwesend:
entweder es gibt eine Aussage, oder es wird nachgefragt.

#### Scenario: Vollständiger Nachweis bei grünem Pull Request

- **Given** ein Change mit gate1.md, gate2.md und fertig.md und ein Pull Request, dessen
  Prüfungen bestanden sind
- **When** über den Merge entschieden wird
- **Then** ist der Merge erlaubt

#### Scenario: Ein Nachweis fehlt

- **Given** ein Change, in dem fertig.md fehlt
- **When** über den Merge entschieden wird
- **Then** ist der Merge nicht erlaubt und der Grund wird benannt

#### Scenario: Pull Request nicht grün

- **Given** ein Change mit allen drei Nachweisen und ein Pull Request, dessen Prüfungen nicht
  bestanden sind
- **When** über den Merge entschieden wird
- **Then** ist der Merge nicht erlaubt und der Grund wird benannt

### Requirement: Der Arbeiter mergt nicht

Das System SHALL den Auftrag des Arbeiters mit dem Pull Request enden lassen. Der Merge SHALL
dem Leitstand vorbehalten bleiben.

#### Scenario: Arbeiter ist fertig

- **Given** ein Arbeiter, dessen Pull Request steht
- **When** sein Auftrag endet
- **Then** ist der Change nicht gemergt, und die Entscheidung liegt beim Leitstand

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

### Requirement: Ein Change entsteht nur mit eigenem Issue

Das System SHALL die Anlage eines Changes ohne Issue-Nummer ablehnen, SHALL in diesem Fall
weder Ordner noch Branch noch Arbeitsraum anlegen, und SHALL bei genannter Nummer im
`proposal.md` eine Zeile hinterlassen, die den Change mit seinem Issue verbindet.

#### Scenario: Aufruf ohne Nummer

- **Given** ein Aufruf von `tools/neu.mjs` mit Kennung und Capability, aber ohne `--issue`
- **When** die Anlage beginnt
- **Then** endet der Aufruf mit einem von Null verschiedenen Exit-Code, die Meldung nennt den
  Befehl zum Anlegen eines Issues, und unter `openspec/changes/` ist kein Ordner der Kennung
  entstanden

#### Scenario: Aufruf mit Nummer

- **Given** ein Aufruf mit `--issue 42`
- **When** die Artefakte geschrieben werden
- **Then** enthält das `proposal.md` die Zeile `Geht zurueck auf GitHub-Issue #42.`

### Requirement: Der Testbefehl der Gates ist je Projekt bestimmbar

Das System SHALL den Testbefehl, mit dem Gate 2 und der Abschluss messen, aus
`tools/gate.projekt.json` lesen, wenn diese Datei vorliegt und Befehl samt Argumenten nennt,
und SHALL ohne diese Datei beim eingebauten Node-Testlauf bleiben. Das System SHALL einen
fremden Läufer allein an seinem Exit-Code messen.

#### Scenario: Projekt nennt seinen eigenen Läufer

- **Given** `tools/gate.projekt.json` mit einem Befehl, der mit einem von Null verschiedenen
  Code endet
- **When** Gate 2 den Testlauf ausführt
- **Then** gilt der Lauf als rot, und die Meldung nennt den ausgeführten Befehl

#### Scenario: Keine Projektdatei

- **Given** `tools/gate.projekt.json` liegt nicht vor
- **When** der Testbefehl bestimmt wird
- **Then** ist es der eingebaute Node-Testlauf über `tests/*.test.mjs`
