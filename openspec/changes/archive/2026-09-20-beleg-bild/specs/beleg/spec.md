# beleg

## ADDED Requirements

### Requirement: Beleg einliefern

Das System SHALL einen Beleg zu einem Vorgang entgegennehmen, der aus einer Stufe,
einer Art und einem Pfad besteht, und SHALL ihn als Zeile an ein append-only Journal
im Vorgangsordner anhaengen.

Die Stufe ist `vorher` oder `nachher`. Eine andere Stufe SHALL das System zurueckweisen,
ohne das Journal zu veraendern.

#### Scenario: Bild zur Stufe nachher wird angenommen

- **Given** ein Vorgang `beleg-bild` und eine lesbare PNG-Datei auf der Platte
- **When** der Beleg mit der Stufe `nachher` eingeliefert wird
- **Then** liegt eine Kopie der Datei unter `belege/assets/` im Vorgangsordner
- **And** das Journal `belege/belege.jsonl` enthaelt eine Zeile mehr als zuvor
- **And** diese Zeile nennt die Stufe `nachher` und den Pfad der Kopie, nicht den
  Pfad der Quelle

#### Scenario: Unbekannte Stufe wird zurueckgewiesen

- **Given** ein Vorgang `beleg-bild` und eine lesbare PNG-Datei
- **When** der Beleg mit der Stufe `zwischendurch` eingeliefert wird
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** das Journal hat unveraendert viele Zeilen

### Requirement: Das Urteil faellt beim Schreiben

Das System SHALL beim Einliefern pruefen, ob die Quelldatei eine regulaere, nicht
leere Datei innerhalb der Groessengrenze ist und ob ihre ersten Bytes zu einem
anerkannten Bildformat passen. Das Ergebnis dieser Pruefung SHALL als Merkmal in der
Journalzeile stehen.

Beim Lesen des Journals SHALL das System das Dateisystem nicht erneut befragen,
sondern allein das gespeicherte Merkmal auswerten.

#### Scenario: Fehlende Quelldatei wird als gescheiterter Beleg vermerkt

- **Given** ein Vorgang `beleg-bild` und ein Pfad, unter dem keine Datei liegt
- **When** der Beleg eingeliefert wird
- **Then** enthaelt die neue Journalzeile das Merkmal `fehlt` mit dem Wert wahr
- **And** die Zeile nennt einen Grund im Klartext

#### Scenario: Ein abgelegter Beleg ueberlebt das Umbenennen der Quelle

- **Given** ein Vorgang `beleg-bild` mit einem angenommenen Beleg der Stufe `nachher`
- **When** die urspruengliche Quelldatei geloescht wird
- **Then** gilt der Beleg beim Lesen des Journals weiterhin als sichtbar

### Requirement: Der Abschluss fordert einen sichtbaren Beleg

Das System SHALL im Abschluss pruefen, ob zum Vorgang ein Beleg der Stufe `nachher`
vorliegt, der sichtbar ist. Sichtbar SHALL ein Beleg genau dann sein, wenn er ein Bild
oder ein Graph-Artefakt mit der Endung `.dot` oder `.svg` bezeichnet und beim
Einliefern nicht als fehlend vermerkt wurde.

Ein Beleg aus Befehl und Ausgabe SHALL nicht als sichtbar gelten. Schlaegt die Pruefung
fehl, SHALL das System kein `fertig.md` schreiben.

#### Scenario: Abschluss ohne Beleg wird verweigert

- **Given** ein Vorgang, dessen Aufgaben abgehakt sind und dessen Testlauf gruen ist
- **And** kein Beleg der Stufe `nachher` im Journal
- **When** der Abschluss aufgerufen wird
- **Then** endet er mit einem Exit-Code ungleich null
- **And** es entsteht kein `fertig.md`

#### Scenario: Ein Beleg aus Befehl und Ausgabe genuegt nicht

- **Given** ein Vorgang mit gruenem Testlauf und abgehakten Aufgaben
- **And** ein Beleg der Stufe `nachher`, der nur Befehl und Ausgabe traegt
- **When** der Abschluss aufgerufen wird
- **Then** meldet er, dass nichts Sichtbares vorliegt
- **And** es entsteht kein `fertig.md`

### Requirement: Fehlender und unlesbarer Beleg werden unterschieden

Das System SHALL in der Ablehnung des Abschlusses zwei Faelle unterscheiden: es liegt
kein Beleg der Stufe `nachher` vor, oder es liegt einer vor, der beim Einliefern als
fehlend vermerkt wurde. Im zweiten Fall SHALL die Meldung den gespeicherten Grund
nennen.

#### Scenario: Unlesbarer Beleg nennt seinen Grund

- **Given** ein Vorgang mit gruenem Testlauf und abgehakten Aufgaben
- **And** ein Beleg der Stufe `nachher`, der beim Einliefern als fehlend vermerkt wurde
- **When** der Abschluss aufgerufen wird
- **Then** unterscheidet die Meldung diesen Fall von einem gar nicht eingelieferten Beleg
- **And** die Meldung nennt den beim Einliefern gespeicherten Grund

### Requirement: Der Belegpfad ist unabhaengig vom Vorgangsformat

Das System SHALL den Vorgangsordner als Parameter entgegennehmen und SHALL innerhalb
dieses Ordners ausschliesslich unterhalb von `belege/` schreiben. Es SHALL keine
Annahme darueber treffen, dass der Vorgang ein OpenSpec-Change ist.

#### Scenario: Ein beliebiger Ordner traegt Belege

- **Given** ein leerer Ordner, der kein OpenSpec-Change ist
- **When** ein Beleg mit diesem Ordner als Vorgangsordner eingeliefert wird
- **Then** entsteht darin `belege/belege.jsonl` mit einer Zeile
- **And** ausserhalb von `belege/` wird nichts geschrieben
