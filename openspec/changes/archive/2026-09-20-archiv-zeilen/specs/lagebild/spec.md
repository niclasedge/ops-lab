# lagebild

## MODIFIED Requirements

### Requirement: Belege über alle Changes, auch archivierte

Die Nutzlast SHALL eine Sektion `belege` führen, die alle Belege aller Changes eines
Arbeitsbaums zusammenfasst, einschließlich der archivierten. Jeder Eintrag SHALL den
Namen seines Changes nennen und ausweisen, ob dieser archiviert ist. Die Sektion SHALL
absteigend nach dem Zeitpunkt des Einlieferns geordnet sein.

Jeder Beleg SHALL genau einmal stehen. Jeder Arbeitsbaum trägt dieselbe Historie und
damit dasselbe Archiv; ein Beleg, den mehrere Bäume führen, ist derselbe und SHALL nur
mit dem Baum genannt werden, aus dem das Lagebild gestartet wurde.

Jeder Beleg SHALL ausweisen, ob er sich als Bild darstellen lässt. Diese Entscheidung
SHALL in der Nutzlast fallen und nicht in der Seite: ein Graph in der Form `.dot` ist
eine Textdatei, die man öffnen, aber nicht betrachten kann.

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

#### Scenario: Ein Bild und ein Graph in der Form `.dot`

- **Given** ein Beleg der Art `bild` und einer der Art `graph` mit der Endung `.dot`
- **When** die Nutzlast erzeugt wird
- **Then** ist der erste als darstellbar ausgewiesen und der zweite nicht

### Requirement: Archivierte Changes erscheinen in der Web-Ansicht

Die Erhebung für die Web-Ansicht SHALL die archivierten Changes jedes Arbeitsbaums
erfassen und in der Nutzlast als eigene Liste führen, getrennt von den laufenden
Changes. Jeder Eintrag SHALL seine Kennung, sein Archivdatum, seinen Aufgabenstand
einschließlich der einzelnen Aufgaben mit ihrem Status und seine Belege nennen. Jeder
archivierte Change SHALL einmal stehen, auch wenn mehrere Arbeitsbäume dieselbe
Historie und damit dasselbe Archiv tragen.

Die Liste der laufenden Changes SHALL unverändert bleiben: ein archivierter Change
SHALL dort nicht erscheinen, und die Kennzahlen SHALL ihn nicht als laufenden Change
zählen.

Jeder Eintrag SHALL seinen Vorschaubeleg nennen: den darstellbaren Beleg der Stufe
`nachher`, hilfsweise den ersten darstellbaren überhaupt. Wo kein Beleg darstellbar
ist, SHALL die Vorschau leer bleiben.

Die Ansicht SHALL je archiviertem Change eine Zeile zeigen, die zugeklappt beginnt und
sich aufklappen lässt. Zugeklappt SHALL sie Kennung, Datum, Aufgabenstand und die
Vorschau nennen; aufgeklappt SHALL sie den Beleg größer, die einzelnen Aufgaben und die
übrigen Belege zeigen.

#### Scenario: Ein archivierter Change mit Belegen

- **Given** ein Change im Archiv, dessen Journal einen Beleg ausweist
- **When** die Nutzlast erhoben wird
- **Then** steht er in der Archivliste mit Kennung, Datum, Aufgabenstand und diesem Beleg

#### Scenario: Ein archivierter Change bleibt aus der Changeliste heraus

- **Given** ein Change im Archiv
- **When** die Nutzlast erhoben wird
- **Then** führt ihn die Liste der laufenden Changes nicht, und die Kennzahlen zählen
  ihn nicht mit

#### Scenario: Mehrere Arbeitsbäume tragen dasselbe Archiv

- **Given** zwei Arbeitsbäume desselben Repos mit derselben Historie
- **When** die Nutzlast erhoben wird
- **Then** steht jeder archivierte Change genau einmal in der Archivliste

#### Scenario: Ein Archivordner ohne Aufgabenliste

- **Given** ein archivierter Change, dessen `tasks.md` fehlt
- **When** die Nutzlast erhoben wird
- **Then** steht er mit leerem Aufgabenstand in der Liste, und die Erhebung bricht nicht ab

#### Scenario: Die Vorschau bevorzugt den Beleg der Stufe `nachher`

- **Given** ein archivierter Change mit einem darstellbaren Beleg der Stufe `vorher` und
  einem der Stufe `nachher`
- **When** die Nutzlast erhoben wird
- **Then** nennt die Vorschau den Beleg der Stufe `nachher`

#### Scenario: Ein archivierter Change ohne darstellbaren Beleg

- **Given** ein archivierter Change, dessen einziger Beleg eine Textdatei ist
- **When** die Nutzlast erhoben wird
- **Then** bleibt seine Vorschau leer, und der Beleg steht weiter in seiner Belegliste
