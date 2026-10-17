# arbeitsraum

## ADDED Requirements

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
