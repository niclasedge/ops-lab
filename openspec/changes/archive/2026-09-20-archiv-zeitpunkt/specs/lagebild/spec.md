# lagebild

## MODIFIED Requirements

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
sich aufklappen lässt. Zugeklappt SHALL sie Kennung, Zeitpunkt, Aufgabenstand und die
Vorschau nennen; aufgeklappt SHALL sie den Beleg größer, die einzelnen Aufgaben und die
übrigen Belege zeigen.

Jeder Eintrag SHALL seinen Abschlusszeitpunkt nennen, gelesen aus dem Gate-Nachweis
`fertig.md`, hilfsweise aus `gate2.md` oder `gate1.md`. Die Liste SHALL danach geordnet
sein, jüngster Lauf zuerst; wo kein Nachweis einen Zeitpunkt trägt, SHALL weiter der
Ordnername ordnen. Die Ansicht SHALL neben dem Datum die Uhrzeit auf die Minute zeigen.

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

#### Scenario: Zwei Läufe am selben Tag

- **Given** zwei archivierte Changes mit demselben Archivdatum, deren `fertig.md`
  verschiedene Uhrzeiten nennen
- **When** die Nutzlast erhoben wird
- **Then** steht der später abgeschlossene vor dem früheren, unabhängig davon, wie die
  Ordnernamen alphabetisch stehen

#### Scenario: Ein Archivordner ohne Abschlussnachweis

- **Given** ein archivierter Change ohne `fertig.md`, aber mit `gate1.md`
- **When** die Nutzlast erhoben wird
- **Then** nennt sein Eintrag den Zeitpunkt aus `gate1.md`

#### Scenario: Ein Archivordner ganz ohne Nachweis

- **Given** ein archivierter Change, in dem kein Gate-Nachweis liegt
- **When** die Nutzlast erhoben wird
- **Then** bleibt sein Zeitpunkt leer, und er steht nach den Einträgen mit Zeitpunkt
