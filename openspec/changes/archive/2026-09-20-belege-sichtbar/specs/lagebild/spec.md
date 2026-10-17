# lagebild

## MODIFIED Requirements

### Requirement: Platz für Belege

Die Nutzlast SHALL zu jedem Change die Belege führen, die sein Journal
`belege/belege.jsonl` ausweist. Jeder Eintrag SHALL die Stufe, die Art, den Zeitpunkt
des Einlieferns und eine Adresse nennen, unter der die Datei abrufbar ist. Ein Change
ohne Journal SHALL eine leere Liste führen. Ein Eintrag, den das Journal als fehlend
vermerkt hat, SHALL nicht in der Nutzlast stehen: was beim Einliefern nicht ankam, ist
kein Beleg.

#### Scenario: Ein Change mit eingeliefertem Beleg

- **Given** ein Change, dessen Journal einen Beleg der Stufe `nachher` mit der Art
  `bild` führt
- **When** die Nutzlast erzeugt wird
- **Then** trägt dieser Change genau einen Beleg mit der Stufe `nachher`, der Art
  `bild`, einem Zeitpunkt und einer Adresse

#### Scenario: Change ohne Belege

- **Given** ein Change, dessen Ordner keinen Unterordner `belege` enthält
- **When** die Nutzlast erzeugt wird
- **Then** trägt der Eintrag das Feld `belege` als leere Liste, und im Change-Ordner
  wurde nichts angelegt

#### Scenario: Ein Eintrag, der beim Einliefern fehlschlug

- **Given** ein Journal mit einer Zeile, die `fehlt` auf wahr setzt
- **When** die Nutzlast erzeugt wird
- **Then** steht diese Zeile nicht in der Belegliste des Changes

## ADDED Requirements

### Requirement: Belege über alle Changes, auch archivierte

Die Nutzlast SHALL eine Sektion `belege` führen, die alle Belege aller Changes eines
Arbeitsbaums zusammenfasst, einschließlich der archivierten. Jeder Eintrag SHALL den
Namen seines Changes nennen und ausweisen, ob dieser archiviert ist. Die Sektion SHALL
absteigend nach dem Zeitpunkt des Einlieferns geordnet sein.

Jeder Beleg SHALL genau einmal stehen. Jeder Arbeitsbaum trägt dieselbe Historie und
damit dasselbe Archiv; ein Beleg, den mehrere Bäume führen, ist derselbe und SHALL nur
mit dem Baum genannt werden, aus dem das Lagebild gestartet wurde.

#### Scenario: Ein Beleg aus dem Archiv

- **Given** ein archivierter Change unter `openspec/changes/archive/`, dessen Journal
  einen Beleg führt
- **When** die Nutzlast erzeugt wird
- **Then** steht dieser Beleg in der Sektion `belege`, nennt den Namen seines Changes
  und ist als archiviert gekennzeichnet

#### Scenario: Jüngster Beleg zuerst

- **Given** zwei Belege, die zu verschiedenen Zeitpunkten eingeliefert wurden
- **When** die Nutzlast erzeugt wird
- **Then** steht der jüngere in der Sektion `belege` vor dem älteren

#### Scenario: Derselbe Beleg in mehreren Arbeitsbäumen

- **Given** zwei Arbeitsbäume, die denselben Change mit demselben Beleg führen
- **When** die Nutzlast erzeugt wird
- **Then** steht dieser Beleg nur einmal in der Sektion `belege`, mit dem Baum, aus dem
  das Lagebild gestartet wurde

### Requirement: Belege werden lesend ausgeliefert

Die Web-Ansicht SHALL eine nur lesende Route anbieten, die die Datei eines Belegs
ausliefert. Sie SHALL ausschließlich Adressen bedienen, die in der erhobenen Nutzlast
stehen, und jede andere Anfrage mit 404 beantworten — auch eine, die über
Verzeichniswechsel aus dem Repo herausführt. Sie SHALL keinen Schreibzugriff anbieten.

#### Scenario: Ein bekannter Beleg wird abgerufen

- **Given** ein Beleg, dessen Adresse in der Nutzlast steht
- **When** diese Adresse abgerufen wird
- **Then** kommt der Inhalt der Datei zurück

#### Scenario: Eine Adresse, die aus dem Repo führt

- **Given** eine Adresse, die über `..` auf eine Datei außerhalb der Belegordner zeigt
- **When** sie abgerufen wird
- **Then** antwortet die Ansicht mit 404 und liefert keinen Inhalt
