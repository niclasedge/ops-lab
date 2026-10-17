# messung Specification

## Purpose

Was ein Lauf gekostet und was er erreicht hat — und unter welchen Bedingungen zwei
Läufe überhaupt vergleichbar sind.

Ohne die letzte Hälfte ist die erste wertlos: eine Zahl, die fällt, weil die Umgebung
sich verschoben hat, sieht aus wie eine Verbesserung. Deshalb steht neben jedem Aufwand
der Erfüllungsgrad, und neben jedem Vergleich der Startkontext beider Läufe.

## Requirements

### Requirement: Ein Messlauf startet von einem definierten Stand

Das System SHALL vor jedem Messlauf das Zielrepo auf einen benannten Commit
zuruecksetzen und SHALL den Auftrag woertlich aus einer Datei im Repo uebergeben.
Der Auftrag SHALL zwischen zwei Laeufen unveraendert bleiben.

Ist das Zielrepo nicht sauber, SHALL das System den Lauf verweigern, statt
Aenderungen zu verwerfen.

#### Scenario: Ungesicherte Aenderungen halten den Lauf auf

- **Given** ein Zielrepo mit einer geaenderten, nicht eingecheckten Datei
- **When** ein Messlauf gestartet wird
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** die Meldung nennt die betroffene Datei
- **And** das Zielrepo bleibt unveraendert

#### Scenario: Derselbe Auftrag zweimal

- **Given** eine abgelegte Messung, die den Pruefwert ihres Auftragstextes nennt
- **When** ein zweiter Messlauf mit einem geaenderten Auftragstext laeuft
- **Then** weist die zweite Messung einen anderen Pruefwert aus
- **And** der Vergleich beider Messungen kennzeichnet sie als nicht vergleichbar

### Requirement: Eine Messung nennt Aufwand und Ergebnis

Das System SHALL je Messlauf festhalten: verbrauchte Token getrennt nach Art, Zahl
der abgesetzten Befehle, Dauer in Sekunden, Kosten in Euro, den Startkontext und den
Erfuellungsgrad.

Den Startkontext SHALL das System aus der ersten Nachricht der Mitschrift ablesen und
als eigene Groesse ausweisen. Es SHALL ihn nicht aus dem Aufwand herausrechnen.

Die Kosten SHALL das System aus der Token-Zahl je Modell und einer im Repo gepflegten
Preistabelle errechnen. Fehlt zu einem verwendeten Modell ein Preis, SHALL das System
die Kosten als unbekannt ausweisen und nicht als null.

#### Scenario: Der Startkontext steht als eigene Groesse in der Messung

- **Given** eine Mitschrift, deren erste Nachricht den Startkontext nennt
- **When** die Messung errechnet wird
- **Then** weist sie den Startkontext getrennt vom uebrigen Aufwand aus
- **And** die ausgewiesene Gesamtsumme enthaelt ihn weiterhin

#### Scenario: Unbekanntes Modell macht die Kosten nicht zu null

- **Given** eine Mitschrift, die ein Modell nennt, das die Preistabelle nicht kennt
- **When** die Messung errechnet wird
- **Then** weist sie die Kosten dieses Modells als unbekannt aus
- **And** die Meldung nennt den Namen des fehlenden Modells

#### Scenario: Befehle werden aus der Mitschrift gezaehlt

- **Given** eine Mitschrift mit sieben Werkzeugaufrufen, davon vier auf der Schale
- **When** die Messung errechnet wird
- **Then** nennt sie sieben Werkzeugaufrufe und davon vier Schalenbefehle

### Requirement: Der Erfuellungsgrad wird maschinell ermittelt

Das System SHALL den Erfuellungsgrad als Liste gepruefter Kriterien ausweisen, nicht
als Einschaetzung. Geprueft SHALL werden: die drei Gate-Nachweise liegen vor, ein
sichtbarer Beleg der Stufe `nachher` liegt vor, keine Aufgabe ist offen, der Diff
gegen den Ausgangsstand haelt die im Vorschlag zugesagten Dateien ein, der Testlauf
ist gruen, ein Pull Request wurde gestellt, der Pull Request wurde gemergt.

Jedes Kriterium SHALL einzeln als erfuellt oder nicht erfuellt ausgewiesen werden.

#### Scenario: Ein Lauf ohne Beleg erreicht nicht die volle Punktzahl

- **Given** ein Lauf, der alle Gates bestanden und den PR gemergt hat
- **And** keinen sichtbaren Beleg der Stufe `nachher`
- **When** der Erfuellungsgrad ermittelt wird
- **Then** ist das Kriterium fuer den Beleg als nicht erfuellt ausgewiesen
- **And** die uebrigen Kriterien bleiben davon unberuehrt

#### Scenario: Eine angefasste Datei ausserhalb der Zusage faellt auf

- **Given** ein Lauf, dessen Vorschlag drei Dateien als beruehrt nennt
- **And** ein Diff, der eine vierte Datei aendert
- **When** der Erfuellungsgrad ermittelt wird
- **Then** ist das Kriterium fuer die beruehrten Dateien als nicht erfuellt ausgewiesen
- **And** die Meldung nennt die vierte Datei

### Requirement: Der Harness ist austauschbar

Das System SHALL den Messrahmen unabhaengig vom eingesetzten Agenten-Werkzeug halten.
Ein Adapter SHALL genau zwei Dinge beantworten: wie das Werkzeug mit einem Auftrag
gestartet wird, und wo es seine Mitschrift ablegt. Zaehlen, Bewerten, Ablegen und
Vergleichen SHALL fuer alle Adapter derselbe Code leisten.

#### Scenario: Ein zweiter Adapter kommt ohne Aenderung am Rahmen dazu

- **Given** ein Adapter, der einen Auftrag entgegennimmt und eine Mitschrift zurueckgibt
- **When** ein Messlauf mit diesem Adapter laeuft
- **Then** entsteht eine Messung mit denselben Groessen wie bei jedem anderen Adapter
- **And** am Messrahmen wurde keine Zeile geaendert

### Requirement: Zwei Messungen lassen sich vergleichen

Das System SHALL zwei abgelegte Messungen gegenueberstellen und je Groesse die
Veraenderung ausweisen. Es SHALL eine Fassung nur dann als Verbesserung kennzeichnen,
wenn der Aufwand faellt und der Erfuellungsgrad nicht sinkt.

Weichen die Startkontexte beider Messungen um mehr als zehn Prozent voneinander ab,
SHALL das System den Vergleich als nicht belastbar kennzeichnen. Es SHALL ihn
trotzdem ausgeben und die Abweichung benennen.

#### Scenario: Weniger Token bei geringerem Erfuellungsgrad ist keine Verbesserung

- **Given** zwei Messungen desselben Auftrags
- **And** die zweite verbraucht weniger Token, erfuellt aber ein Kriterium weniger
- **When** die beiden verglichen werden
- **Then** wird die zweite nicht als Verbesserung gekennzeichnet
- **And** der Vergleich nennt das verlorene Kriterium

#### Scenario: Ein verschobener Startkontext macht den Vergleich nicht belastbar

- **Given** zwei Messungen desselben Auftrags
- **And** ihre Startkontexte unterscheiden sich um mehr als zehn Prozent
- **When** die beiden verglichen werden
- **Then** kennzeichnet der Vergleich sich selbst als nicht belastbar
- **And** er nennt beide Startkontexte und ihre Abweichung
- **And** die uebrigen Groessen werden weiterhin gegenuebergestellt

### Requirement: Eine Messung ohne Sitzungszuordnung wird zurueckgewiesen

Das System SHALL zu jedem Messlauf die Kennung der ausgewerteten Sitzung festhalten.
Findet es keine Mitschrift zu einem Lauf, SHALL es den Lauf als ungemessen melden und
SHALL keine Messung mit Nullwerten ablegen.

#### Scenario: Fehlende Mitschrift erzeugt keine Nullmessung

- **Given** ein beendeter Lauf, zu dem keine Mitschrift auffindbar ist
- **When** die Messung errechnet werden soll
- **Then** endet der Befehl mit einem Exit-Code ungleich null
- **And** es entsteht keine Datei unter den abgelegten Messungen
- **And** die Meldung nennt den Ordner, in dem gesucht wurde

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
