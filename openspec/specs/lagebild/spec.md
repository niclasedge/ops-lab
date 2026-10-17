# lagebild Specification

## Purpose

Das Lagebild beantwortet im Browser, was die Kommandozeile nur zeilenweise hergibt: wo
gearbeitet wird, was dort läuft, wann es zuletzt geschah — und was als Nächstes zu tun
wäre. Es gruppiert nach Arbeitsbaum, führt jeden Change genau einmal bei dem Baum, der
ihn wirklich bearbeitet, und nennt je Baum einen Schritt aus der Folge, die das Repo
ohnehin durchsetzt.

Die Ansicht ist **nur lesend**. Sie löst kein Gate aus, führt keinen Befehl aus und nimmt
keinen entgegen; sie nennt ihn. Ablaufsteuerung gehört an die Stelle, an der ein
Exit-Code darüber entscheidet, nicht in ein Fenster.

Sie ist außerdem **optional**. `--once`, `--graph`, `--json`, `--count` und `--selftest`
laufen mit der Standardbibliothek allein; FastAPI und uvicorn holt allein `--web` zur
Laufzeit. Der Grundsatz des Repos — kein Build, keine Abhängigkeitsdatei — bleibt damit
für alles gültig, was ein Gate braucht.

## Requirements

### Requirement: Ansicht auf Abruf

Das System SHALL mit dem Parameter `--web` eine nur lesende HTTP-Ansicht des Lagebilds
starten und dabei auf `127.0.0.1` binden. Der Port SHALL über `--web-port` wählbar sein
und ohne Angabe 8765 betragen. Das System SHALL die gewählte Adresse beim Start
ausgeben, damit sie sich ohne Raten öffnen lässt.

#### Scenario: Ansicht startet auf dem Vorgabeport

- **Given** ein Repo mit mindestens einem Worktree
- **When** `ops.py --web` aufgerufen wird
- **Then** meldet das System die Adresse `http://127.0.0.1:8765` und beantwortet dort
  eine Anfrage auf `/` mit einer HTML-Seite

#### Scenario: Port wird vorgegeben

- **Given** Port 8765 ist bereits belegt
- **When** `ops.py --web --web-port 8790` aufgerufen wird
- **Then** meldet das System die Adresse mit Port 8790 und bedient Anfragen dort

### Requirement: Nutzlast ohne Server prüfbar

Das System SHALL mit `--web --trocken` genau die Nutzlast als JSON auf die
Standardausgabe schreiben, die die HTTP-Ansicht ausliefert, und dabei keinen Server
starten und keine Fremdbibliothek laden. Der Aufruf SHALL mit Exit-Code 0 enden.

#### Scenario: Trockenlauf gibt die Nutzlast aus

- **Given** ein Repo mit offenen Changes
- **When** `ops.py --web --trocken` aufgerufen wird
- **Then** steht auf der Standardausgabe ein JSON-Objekt mit den Schlüsseln
  `worktrees`, `changes` und `zeitleiste`, kein Server horcht auf einem Port, und der
  Exit-Code ist 0

### Requirement: Worktrees mit Stand und Zeitpunkt

Die Nutzlast SHALL zu jedem Worktree den Pfad, den Namen, den Branch, den Kopfstand mit
Betreff, den Zeitpunkt des Kopfcommits sowie den Arbeitsstand aus vorgemerkten,
geänderten und unverfolgten Dateien nennen. Sie SHALL ausweisen, welcher Worktree der
Hauptbaum ist, und SHALL den Zeitpunkt der jüngsten Änderung je Worktree als
vergleichbaren Wert führen.

#### Scenario: Worktree mit offenen Änderungen

- **Given** ein Worktree mit zwei geänderten und einer unverfolgten Datei
- **When** die Nutzlast erzeugt wird
- **Then** trägt der Eintrag dieses Worktrees Branch, Kopfstand, Commitzeitpunkt und die
  Zähler 0 vorgemerkt, 2 geändert, 1 unverfolgt

### Requirement: Changes nach Bereitschaft

Die Nutzlast SHALL jeden Change mit seiner Bereitschaft führen — `frei`, `laeuft`,
`fertig`, `im PR` oder `blockiert` — und SHALL zu jedem Change den Worktree, den Stand
der Aufgaben als erledigt und gesamt, die bestandenen Gates und die nächste offene
Aufgabe nennen. Ein blockierter Change SHALL nennen, worauf er wartet.

#### Scenario: Blockierter Change nennt seinen Blocker

- **Given** zwei Changes berühren dieselbe Capability und einer davon ist begonnen
- **When** die Nutzlast erzeugt wird
- **Then** trägt der noch nicht begonnene Change die Bereitschaft `blockiert` und nennt
  den begonnenen Change als Grund

#### Scenario: Offener Change nennt seine nächste Aufgabe

- **Given** ein Change mit drei von acht erledigten Aufgaben
- **When** die Nutzlast erzeugt wird
- **Then** trägt der Eintrag die Bereitschaft `laeuft`, den Stand 3 von 8 und den Text
  der ersten noch offenen Aufgabe

### Requirement: Zeitleiste über alle Worktrees

Die Nutzlast SHALL eine Zeitleiste führen, die jede nachweisbare Fertigstellung einer
Aufgabe über alle Worktrees hinweg mit Zeitpunkt, Change, Aufgabennummer, Text und
Herkunft des Nachweises enthält, absteigend nach Zeitpunkt sortiert. Die Zeitleiste
SHALL nicht gekürzt werden.

#### Scenario: Fertigstellungen zweier Worktrees stehen gemischt

- **Given** zwei Worktrees mit Fertigstellungen zu verschiedenen Zeitpunkten
- **When** die Nutzlast erzeugt wird
- **Then** stehen die Einträge beider Worktrees in einer gemeinsamen Liste, die jüngste
  zuerst, und jeder Eintrag nennt seinen Change

### Requirement: Ein Change gehört dem Arbeitsbaum, der ihn bearbeitet

Liegt derselbe Change in mehreren Arbeitsbäumen, SHALL die Nutzlast ihn genau einmal
führen. Das System SHALL dafür den Inhalt des Change-Ordners mit dem des Hauptbaums
vergleichen und den Change dem Arbeitsbaum zuordnen, dessen Ordner abweicht. Weicht
kein Arbeitsbaum ab, SHALL der Change dem Hauptbaum zugeordnet werden. Weicht mehr als
einer ab, SHALL das System den Arbeitsbaum mit der jüngsten Änderung wählen und die
übrigen abweichenden Bäume namentlich nennen. Ein Change, den der Hauptbaum nicht kennt,
SHALL dem Arbeitsbaum zugeordnet werden, in dem er liegt. Jeder Eintrag SHALL ausweisen,
ob er gegenüber dem Hauptbaum abweicht.

#### Scenario: Unveränderte Kopie im Arbeitsbaum

- **Given** ein Change liegt im Hauptbaum und inhaltsgleich in einem Arbeitsbaum
- **When** die Nutzlast erzeugt wird
- **Then** steht der Change genau einmal, zugeordnet zum Hauptbaum, und ist als nicht
  abweichend ausgewiesen

#### Scenario: Bearbeitete Kopie im Arbeitsbaum

- **Given** ein Change liegt im Hauptbaum und in einem Arbeitsbaum mit geänderter
  `tasks.md`
- **When** die Nutzlast erzeugt wird
- **Then** steht der Change genau einmal, zugeordnet zu diesem Arbeitsbaum, und ist als
  abweichend ausgewiesen

#### Scenario: Change nur im Arbeitsbaum

- **Given** ein Change, den der Hauptbaum nicht kennt
- **When** die Nutzlast erzeugt wird
- **Then** steht er bei dem Arbeitsbaum, in dem er liegt, und ist als abweichend
  ausgewiesen

#### Scenario: Derselbe Change in zwei Arbeitsbäumen

- **Given** ein Change liegt in zwei Arbeitsbäumen mit unterschiedlichem Inhalt
- **When** die Nutzlast erzeugt wird
- **Then** steht er genau einmal, beim Arbeitsbaum mit der jüngsten Änderung, und sein
  Eintrag nennt den zweiten Arbeitsbaum als weiteren Ort

### Requirement: Geänderte Dateien beim Namen

Die Nutzlast SHALL zu jedem Arbeitsbaum die geänderten Dateien einzeln mit Pfad und Art
der Änderung nennen. Als Art SHALL sie `vorgemerkt`, `geaendert`, `unverfolgt` oder
`geloescht` ausweisen. Die Liste SHALL nach Pfad sortiert sein. Ein sauberer Arbeitsbaum
SHALL eine leere Liste führen.

#### Scenario: Arbeitsbaum mit gemischten Änderungen

- **Given** ein Arbeitsbaum mit einer vorgemerkten, einer geänderten und einer
  unverfolgten Datei
- **When** die Nutzlast erzeugt wird
- **Then** nennt seine Dateiliste drei Einträge mit Pfad und jeweiliger Art, nach Pfad
  sortiert

#### Scenario: Sauberer Arbeitsbaum

- **Given** ein Arbeitsbaum ohne Änderung gegenüber seinem Kopfcommit
- **When** die Nutzlast erzeugt wird
- **Then** ist seine Dateiliste leer

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

### Requirement: Fehlende Bibliothek meldet sich

Fehlt beim Aufruf von `--web` die Bibliothek FastAPI oder uvicorn, SHALL das System eine
deutsche Meldung ausgeben, die den Befehl nennt, der sie mitbringt, und SHALL mit einem
Exit-Code ungleich 0 enden. Das System SHALL dabei keinen Stacktrace zeigen.

#### Scenario: FastAPI ist nicht installiert

- **Given** eine Umgebung ohne FastAPI
- **When** `ops.py --web` aufgerufen wird
- **Then** erscheint eine Meldung, die `just web` als Weg nennt, der Exit-Code ist
  ungleich 0, und es erscheint kein Stacktrace

### Requirement: Terminal-Ansicht bleibt unberührt

Das System SHALL die Ausgabe von `--once`, `--graph`, `--json` und `--count` durch diesen
Change nicht verändern. Diese Aufrufe SHALL ohne FastAPI und ohne uvicorn laufen.

#### Scenario: Lagebild ohne Fremdbibliothek

- **Given** eine Umgebung ohne FastAPI
- **When** `ops.py --once` aufgerufen wird
- **Then** erscheint das Lagebild wie zuvor und der Exit-Code ist 0

### Requirement: Jeder Arbeitsbaum nennt seinen nächsten Schritt

Die Nutzlast SHALL zu jedem Arbeitsbaum einen nächsten Schritt führen. Der Schritt SHALL
einen Satz in der Sie-Form tragen, SHALL eine von drei Lagen ausweisen — `tun`, `warten`
oder `ruhe` — und SHALL den auszuführenden Befehl nennen, sofern es einen gibt. Gibt es
keinen Befehl, SHALL das Feld leer sein und nicht fehlen.

#### Scenario: Jeder Arbeitsbaum trägt einen Schritt

- **Given** ein Repo mit mehreren Arbeitsbäumen
- **When** die Nutzlast erzeugt wird
- **Then** trägt jeder Arbeitsbaum einen Schritt mit Text, Lage und Befehlsfeld, und die
  Lage ist eine von `tun`, `warten` oder `ruhe`

### Requirement: Der Schritt folgt der Reihenfolge des Ablaufs

Das System SHALL den nächsten Schritt aus dem Stand des Arbeitsbaums und seiner Changes
ableiten und dabei die Reihenfolge des Ablaufs einhalten. Uncommittete Änderungen SHALL
Vorrang vor allem anderen haben. Danach SHALL gelten: ein Change ohne `gate1.md` verlangt
Gate 1, ein Change mit `gate1.md` und ohne `gate2.md` verlangt Gate 2, ein begonnener
Change verlangt seine nächste offene Aufgabe, ein Change ohne offene Aufgabe und ohne
`fertig.md` verlangt den Abschluss, ein abgeschlossener Change ohne Pull Request verlangt
den Pull Request. Ein Arbeitsbaum ohne Change und ohne Änderung SHALL als frei gelten.

#### Scenario: Uncommittete Änderungen gehen vor

- **Given** ein Arbeitsbaum mit geänderten Dateien und einem abgeschlossenen Change
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er das Committen und nicht den Pull Request, und seine Lage ist `tun`

#### Scenario: Abgeschlossener Change will in den Pull Request

- **Given** ein sauberer Arbeitsbaum, dessen Change `fertig.md` trägt und nicht im Pull
  Request steht
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er `just pr` mit der Kennung des Changes, und seine Lage ist `tun`

#### Scenario: Gestellter Pull Request wartet auf den Merge

- **Given** ein sauberer Arbeitsbaum, dessen Change abgeschlossen ist und im Pull Request
  steht
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er den Merge, und seine Lage ist `warten`

#### Scenario: Begonnener Change nennt seine Aufgabe

- **Given** ein sauberer Arbeitsbaum, dessen Change beide Gates trägt und offene Aufgaben hat
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er die nächste offene Aufgabe, und seine Lage ist `tun`

#### Scenario: Leerer Arbeitsbaum ist frei

- **Given** ein sauberer Arbeitsbaum ohne Change und ohne Versatz zum Hauptbranch
- **When** der nächste Schritt bestimmt wird
- **Then** weist er den Baum als frei aus, und seine Lage ist `ruhe`

### Requirement: Der Hauptbaum holt, was ihm fehlt

Liegt der Hauptbaum hinter seinem Hauptbranch zurück, SHALL sein nächster Schritt das Holen
verlangen und den Befehl dazu nennen. Ein sauberer Hauptbaum ohne Rückstand SHALL die Lage
`ruhe` tragen.

#### Scenario: Hauptbaum liegt zurück

- **Given** ein sauberer Hauptbaum, der zwei Commits hinter seinem Hauptbranch liegt
- **When** der nächste Schritt bestimmt wird
- **Then** nennt er `git pull`, und seine Lage ist `tun`

### Requirement: Changes stehen bei ihrem Arbeitsbaum

Die Ansicht SHALL die Changes je Arbeitsbaum gruppieren und die Gruppe eines Arbeitsbaums
als Einheit darstellen: den Arbeitsbaum an der Seite, seine Changes daneben. Ein
Arbeitsbaum ohne Change SHALL seine Gruppe trotzdem führen und als leer ausweisen.

#### Scenario: Arbeitsbaum mit zwei Changes

- **Given** ein Arbeitsbaum, dem zwei Changes zugeordnet sind
- **When** die Ansicht gezeichnet wird
- **Then** stehen beide Changes in der Gruppe dieses Arbeitsbaums und in keiner anderen

#### Scenario: Arbeitsbaum ohne Change

- **Given** ein Arbeitsbaum, dem kein Change zugeordnet ist
- **When** die Ansicht gezeichnet wird
- **Then** steht seine Gruppe mit einem Hinweis, dass dort kein Change liegt

### Requirement: Ein fremdes Repo vollständig beobachten

Das System SHALL mit `--root` auf einen Pfad gerichtet das dort liegende Repo beobachten und dessen
Arbeitsbäume, Changes und Zuordnungen in der Nutzlast führen. Es SHALL dabei kein
Merkmal des eigenen Arbeitsverzeichnisses in die Nutzlast übernehmen: das Feld `root`,
die Liste der Arbeitsbäume und die Liste der Changes SHALL ausschließlich das
beobachtete Repo beschreiben. Das Ergebnis SHALL allein vom Zustand des beobachteten
Repos abhängen.

#### Scenario: Ein fremdes Repo statt des eigenen

- **Given** ein Repo unter einem Pfad, der nicht das Arbeitsverzeichnis ist, mit einem
  Change `probe-haupt` im Hauptbaum
- **When** `ops.py` mit `--root` auf diesen Pfad und mit `--web --trocken` aufgerufen wird
- **Then** nennt das Feld `root` diesen Pfad, der Hauptbaum trägt den Namen des dortigen
  Verzeichnisses, und `probe-haupt` steht in der Liste der Changes

#### Scenario: Arbeitsbaum des beobachteten Repos

- **Given** ein beobachtetes Repo mit einem zweiten Arbeitsbaum unter
  `.claude/worktrees/probe-zweig` auf dem Branch `change/probe-zweig`
- **When** die Nutzlast erzeugt wird
- **Then** führt sie genau zwei Arbeitsbäume, der zweite trägt den Namen `probe-zweig`,
  den Branch `change/probe-zweig` und einen Kopfstand mit Betreff

#### Scenario: Ein Change, den nur der Arbeitsbaum trägt

- **Given** ein Change `probe-zweig`, der im Arbeitsbaum `probe-zweig` liegt und nicht
  im Hauptbaum des beobachteten Repos
- **When** die Nutzlast erzeugt wird
- **Then** steht `probe-zweig` genau einmal in der Liste der Changes, ist dem Arbeitsbaum
  `probe-zweig` zugeordnet und als abweichend ausgewiesen

#### Scenario: Das eigene Arbeitsverzeichnis bleibt draußen

- **Given** ein beobachtetes Repo, dessen Arbeitsbäume und Changes andere Namen tragen
  als die des aufrufenden Repos
- **When** die Nutzlast erzeugt wird
- **Then** enthält weder die Liste der Arbeitsbäume noch die Liste der Changes einen
  Eintrag des aufrufenden Repos

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

### Requirement: Belege werden lesend ausgeliefert

Die Web-Ansicht SHALL eine nur lesende Route anbieten, die die Datei eines Belegs
ausliefert. Sie SHALL ausschließlich Adressen bedienen, die in der erhobenen Nutzlast
stehen, und jede andere Anfrage mit 404 beantworten — auch eine, die über
Verzeichniswechsel aus dem Repo herausführt. Sie SHALL keinen Schreibzugriff anbieten.

Die Antwort SHALL einen Inhaltstyp nennen, den dieses Programm bestimmt. Für die
Endungen, die das Lagebild selbst erzeugt, SHALL er festliegen; ein Graph in der Form
`.dot` SHALL als Text ausgeliefert werden und nicht als Textverarbeitungsdokument. Wo
keine Regel greift, SHALL Text ausgeliefert werden: ein Beleg ist Bild oder Text.

#### Scenario: Ein bekannter Beleg wird abgerufen

- **Given** ein Beleg, dessen Adresse in der Nutzlast steht
- **When** diese Adresse abgerufen wird
- **Then** kommt der Inhalt der Datei zurück

#### Scenario: Eine Adresse, die aus dem Repo führt

- **Given** eine Adresse, die über `..` auf eine Datei außerhalb der Belegordner zeigt
- **When** sie abgerufen wird
- **Then** antwortet die Ansicht mit 404 und liefert keinen Inhalt

#### Scenario: Ein Graph in der Form `.dot`

- **Given** ein Beleg mit der Endung `.dot`
- **When** sein Inhaltstyp bestimmt wird
- **Then** ist es ein Texttyp und kein Textverarbeitungsdokument

#### Scenario: Ein Bild behält seinen Typ

- **Given** ein Beleg mit der Endung `.png` und einer mit der Endung `.svg`
- **When** ihr Inhaltstyp bestimmt wird
- **Then** ist es `image/png` beziehungsweise `image/svg+xml`

#### Scenario: Eine Endung, zu der es nichts zu wissen gibt

- **Given** ein Beleg ohne Endung oder mit einer, die die Standardbibliothek nicht kennt
- **When** sein Inhaltstyp bestimmt wird
- **Then** ist es ein Texttyp, und die Antwort bleibt ohne Fremdentscheidung

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

### Requirement: Der Stand in einem Aufruf

Das System SHALL den Stand des Repos in einem einzigen Aufruf als JSON ausgeben und darin die
zuletzt archivierten Changes, die aktiven Arbeitsräume, die konfliktfrei startbaren Changes,
die blockierten Changes, die verwaisten Arbeitsräume und die offenen Ideen führen.

#### Scenario: Ein Aufruf beantwortet alle Fragen

- **Given** ein Repo mit mindestens einem Arbeitsraum und mindestens einem archivierten Change
- **When** die Lage erhoben wird
- **Then** trägt die Ausgabe die Schlüssel `zuletzt`, `aktiv`, `frei`, `blockiert`, `verwaist`
  und `ideen`, und jeder davon ist eine Liste

### Requirement: Verwaiste Arbeitsräume werden ausgewiesen

Das System SHALL einen Arbeitsraum als verwaist führen, wenn alle drei Bedingungen zutreffen:
sein Branch ist bereits in `main` enthalten, seine Spitze ist nicht zugleich die Spitze von
`main`, und unter `openspec/changes` des Hauptbaums liegt kein gleichnamiger Ordner mehr. Das
System SHALL einen solchen Arbeitsraum nicht entfernen.

Die zweite Bedingung trennt den verwaisten Raum vom frisch angelegten: ein Branch ohne eigenen
Commit zeigt auf dieselbe Spitze wie `main` und ist damit rechnerisch in `main` enthalten, ohne
dass je etwas gemergt wurde.

#### Scenario: Arbeitsraum nach Merge und Archivierung

- **Given** ein Arbeitsraum, dessen Branch in `main` gemergt und dessen Change archiviert wurde
- **When** die Lage erhoben wird
- **Then** steht dieser Arbeitsraum unter `verwaist` und nicht unter `aktiv`, und der
  Arbeitsraum liegt danach unverändert auf der Platte

#### Scenario: Arbeitsraum mit laufendem Change

- **Given** ein Arbeitsraum, dessen Change noch unter `openspec/changes` liegt
- **When** die Lage erhoben wird
- **Then** steht dieser Arbeitsraum unter `aktiv` und nicht unter `verwaist`

#### Scenario: Frisch angelegter Arbeitsraum ohne eigenen Commit

- **Given** ein eben angelegter Arbeitsraum, dessen Branch noch auf der Spitze von `main` steht
- **When** die Lage erhoben wird
- **Then** steht dieser Arbeitsraum nicht unter `verwaist`

### Requirement: Kurzfassung für den Sitzungsbeginn

Das System SHALL auf Verlangen statt des JSON eine einzelne Zeile ausgeben, die die Anzahl der
aktiven, freien, blockierten und verwaisten Posten sowie der offenen Ideen nennt.

#### Scenario: Kurzfassung statt JSON

- **Given** eine erhobene Lage
- **When** die Kurzfassung verlangt wird
- **Then** besteht die Ausgabe aus genau einer Zeile und nennt die fünf Anzahlen

### Requirement: Eine stumme Quelle bricht die Erhebung nicht ab

Das System SHALL ein Lagebild auch dann ausgeben, wenn eine der befragten Quellen nicht
antwortet, und SHALL die ausgefallene Quelle in der Ausgabe benennen.

#### Scenario: Die Ideenquelle antwortet nicht

- **Given** eine Umgebung, in der die Abfrage der offenen Ideen fehlschlägt
- **When** die Lage erhoben wird
- **Then** endet der Aufruf ohne Fehler, `ideen` ist eine leere Liste, und die Ausgabe nennt
  die ausgefallene Quelle unter `stumm`

### Requirement: Worum es bei einem Change geht

Die Nutzlast SHALL zu jedem laufenden Change den Abschnitt *Warum* und den Abschnitt
*Was ausdrücklich nicht* aus seiner `proposal.md` führen, im Wortlaut der Datei und in
beiden Schreibweisen der Überschrift, mit und ohne Umlaut. Ein Abschnitt, den die Datei
nicht enthält, SHALL als leer geführt werden. Die Ansicht SHALL beide unter einer eigenen
Klappe zeigen und für einen leeren Abschnitt einen Hinweis ausgeben, der die fehlende
Überschrift benennt.

#### Scenario: Change mit beiden Abschnitten

- **Given** ein Change, dessen `proposal.md` die Überschriften `## Warum` und
  `## Was ausdrücklich nicht` trägt
- **When** die Nutzlast erzeugt wird
- **Then** führt sein Eintrag beide Abschnitte im Wortlaut der Datei, ohne die
  Überschriftenzeile selbst

#### Scenario: Change ohne Abgrenzung

- **Given** ein Change, dessen `proposal.md` keine Überschrift `## Was ausdrücklich nicht`
  trägt
- **When** die Nutzlast erzeugt wird
- **Then** steht die Abgrenzung als leerer Text, und die Ansicht gibt dafür einen Hinweis
  auf den fehlenden Abschnitt aus statt eines leeren Kastens

### Requirement: Anforderungen als Titel mit Szenarienzahl

Die Nutzlast SHALL zu jedem laufenden Change die Requirements seiner Delta-Specs führen,
je Eintrag mit der Capability, der Art des Delta-Blocks, dem Titel des Requirements und
der Zahl seiner Szenarien. Der Fließtext eines Requirements SHALL nicht geführt werden.
Die Ansicht SHALL diese Einträge unter einer eigenen Klappe zeigen, die anfangs
geschlossen ist.

#### Scenario: Delta-Spec mit zwei Requirements

- **Given** eine Delta-Spec mit einem Block `## ADDED Requirements`, darin ein Requirement
  mit zwei Szenarien und eines mit einem Szenario
- **When** die Nutzlast erzeugt wird
- **Then** führt der Change zwei Einträge in der Reihenfolge der Datei, mit den
  Szenarienzahlen 2 und 1, der Art `ADDED` und ohne den Fließtext der Requirements

### Requirement: Zusage und Diff nebeneinander

Die Nutzlast SHALL zu jedem laufenden Change die im Abschnitt *Berührte Dateien* der
`proposal.md` zugesagten Pfade führen, daneben die Pfade, die sein Arbeitsbaum gegenüber
`main` anfasst — committet wie nicht committet — und dazu einen Abgleich, der jeden Pfad
einer von drei Lagen zuordnet: zugesagt und angefasst, nur zugesagt, nur angefasst. Die
Ansicht SHALL den Abgleich unter einer eigenen Klappe zeigen und dabei Deckung als Deckung
melden statt sie zu verschweigen.

Eine Zusage, die auf einen Schrägstrich endet, SHALL als Ordner gelten und jeden
angefassten Pfad unterhalb dieses Ordners decken. Der gedeckte Pfad SHALL dann nicht
zusätzlich einzeln aufgeführt werden.

#### Scenario: Angefasst ohne Zusage

- **Given** ein Change, der `ops.py` zusagt und in seinem Arbeitsbaum `ops.py` sowie
  `justfile` angefasst hat
- **When** die Nutzlast erzeugt wird
- **Then** steht `ops.py` in der Lage *zugesagt und angefasst* und `justfile` in der Lage
  *nur angefasst*

#### Scenario: Zugesagt ohne Anfassen

- **Given** ein Change, der `ops.py` und `docs/plan.md` zusagt und nur `ops.py` angefasst
  hat
- **When** die Nutzlast erzeugt wird
- **Then** steht `docs/plan.md` in der Lage *nur zugesagt*

#### Scenario: Ordnerzusage deckt ihren Inhalt

- **Given** ein Change, der den Ordner `openspec/changes/beispiel/` zusagt und darin
  `tasks.md` angefasst hat
- **When** die Nutzlast erzeugt wird
- **Then** steht der Ordner in der Lage *zugesagt und angefasst*, und `tasks.md` steht
  nicht zusätzlich als eigener Eintrag

### Requirement: Der Klappstand des Menschen gewinnt

Jede Klappe der Ansicht SHALL einen Anfangszustand haben, und die Ansicht SHALL diesen
Anfangszustand nur so lange verwenden, wie niemand die Klappe angefasst hat. Sobald ein
Mensch eine Klappe öffnet oder schließt, SHALL die Ansicht seine Entscheidung über jedes
Neuzeichnen hinweg halten, auch wenn sie dem Anfangszustand widerspricht. Die Entscheidung
SHALL im Browser gehalten werden und keinen Zustand auf dem Server erzeugen.

#### Scenario: Anfangs offene Klappe wird zugeklappt

- **Given** eine Klappe mit dem Anfangszustand offen, die ein Mensch zuklappt
- **When** die Ansicht sich neu zeichnet
- **Then** bleibt die Klappe zugeklappt

#### Scenario: Anfangs geschlossene Klappe wird aufgeklappt

- **Given** eine Klappe mit dem Anfangszustand geschlossen, die ein Mensch aufklappt
- **When** die Ansicht sich neu zeichnet
- **Then** bleibt die Klappe offen

#### Scenario: Unangetastete Klappe folgt der Vorgabe

- **Given** eine Klappe, die niemand angefasst hat
- **When** die Ansicht sich neu zeichnet
- **Then** steht sie in ihrem Anfangszustand

### Requirement: Die Change-Karte beginnt kompakt

Die Ansicht SHALL jede Klappe einer Change-Karte — *Worum es geht*, *Anforderungen*,
*Dateien* und *Aufgaben* — mit dem Anfangszustand geschlossen zeichnen. Eine Karte, die
niemand angefasst hat, SHALL damit nur Kopf, Marken, Fortschritt, Gates, die vier
Klappentitel und die Belege zeigen.

Eine zugeklappte Klappe SHALL ihren Inhalt dennoch ausliefern. Der Anfangszustand
betrifft allein, was sich beim ersten Zeichnen zeigt; welche Angaben eine Klappe trägt,
SHALL davon unberührt bleiben.

Der Anfangszustand SHALL nur gelten, solange niemand die Klappe angefasst hat. Wer sie
öffnet, SHALL sie über jedes Neuzeichnen hinweg offen wiederfinden.

#### Scenario: Eine unangetastete Karte zeigt vier geschlossene Klappen

- **Given** eine Change-Karte mit Worum, Anforderungen, Dateien und Aufgaben, deren
  Klappen niemand angefasst hat
- **When** die Ansicht sie zeichnet
- **Then** trägt keine der vier Klappen das Attribut `open`

#### Scenario: Zugeklappt heißt nicht leer

- **Given** dieselbe unangetastete Change-Karte
- **When** die Ansicht sie zeichnet
- **Then** stehen beide Abschnitte aus der `proposal.md`, die Anforderungen mit ihrer
  Szenarienzahl, die Einträge des Dateiabgleichs und die einzelnen Aufgaben im
  ausgelieferten Text der Karte

#### Scenario: Eine geöffnete Klappe bleibt offen

- **Given** eine Change-Karte, deren Klappe *Dateien* ein Mensch aufgeklappt hat
- **When** die Ansicht sich neu zeichnet
- **Then** steht die Klappe *Dateien* offen
- **And** die übrigen drei Klappen stehen weiterhin geschlossen

### Requirement: Aufgaben eines Changes unter einer Klappe

Die Nutzlast SHALL zu jedem Change seine Aufgaben mit Nummer, Text, Abschnitt und dem
Merkmal erledigt führen, in der Reihenfolge der `tasks.md`. Die Ansicht SHALL diese
Aufgaben unter einer eigenen Klappe zeigen, deren Titel die Zahl der erledigten und der
gesamten Aufgaben nennt. Damit steht der Aufgabenstand da, ohne dass die Klappe offen
sein muss.

Dieses Requirement tritt an die Stelle von *Aufgaben eines Changes aufklappbar*. Es sagt
über die Aufgaben dasselbe; den Anfangszustand der Klappe regelt nicht mehr es, sondern
*Die Change-Karte beginnt kompakt*.

#### Scenario: Change mit erledigten und offenen Aufgaben

- **Given** ein Change, dessen erste zwei von acht Aufgaben abgehakt sind
- **When** die Nutzlast erzeugt wird
- **Then** führt sein Eintrag acht Aufgaben in der Reihenfolge der Datei, davon die
  ersten zwei als erledigt

#### Scenario: Der Klappentitel nennt den Aufgabenstand

- **Given** eine Change-Karte zu einem Change mit einer von zwei erledigten Aufgaben
- **When** die Ansicht sie zeichnet
- **Then** nennt der Titel der Aufgabenklappe eine von zwei Aufgaben, auch solange die
  Klappe zugeklappt ist

### Requirement: Bindeadresse der Web-Ansicht

Das System SHALL die Adresse, auf der die Web-Ansicht hört, über `--web-host` entgegennehmen
und ohne diese Angabe auf `127.0.0.1` binden.

#### Scenario: Ohne Angabe bleibt die Ansicht lokal

- **Given** das Lagebild wird mit `--web` ohne `--web-host` gestartet
- **When** die Bindeadresse bestimmt wird
- **Then** ist sie `127.0.0.1` und die Ansicht ist von außerhalb des Rechners nicht erreichbar

#### Scenario: Angegebene Adresse wird übernommen

- **Given** das Lagebild wird mit `--web --web-host 0.0.0.0` aufgerufen
- **When** der Aufruf die Bindeadresse bestimmt
- **Then** ist sie `0.0.0.0` und der Aufruf wird ohne Fehler über die Argumentprüfung
  angenommen

### Requirement: Startmeldung nennt die Erreichbarkeit

Das System SHALL beim Start der Web-Ansicht eine Zeile ausgeben, die die aufrufbare Adresse
samt Port nennt, und SHALL dieser Zeile einen Hinweis auf das lokale Netz beifügen, wenn die
Bindeadresse über den eigenen Rechner hinausreicht.

#### Scenario: Lokale Bindung meldet keine Netzreichweite

- **Given** die Bindeadresse ist `127.0.0.1` und der Port `8765`
- **When** die Startmeldung gebildet wird
- **Then** enthält sie `http://127.0.0.1:8765` und keinen Hinweis auf das lokale Netz

#### Scenario: Offene Bindung weist auf das lokale Netz hin

- **Given** die Bindeadresse ist `0.0.0.0` und der Port `8790`
- **When** die Startmeldung gebildet wird
- **Then** enthält sie den Port `8790` und den Hinweis, dass die Ansicht im lokalen Netz
  erreichbar ist

### Requirement: Belegter Port meldet sich als Satz

Das System SHALL vor dem Laden der Web-Bibliotheken prüfen, ob die gewünschte Adresse samt
Port frei ist, und SHALL bei einem belegten Port mit einer Meldung enden, die den Port nennt
und auf `--web-port` verweist, statt einen Traceback der Fremdbibliothek auszugeben.

#### Scenario: Der Port ist vergeben

- **Given** auf `127.0.0.1` hört bereits ein anderer Dienst auf dem gewählten Port
- **When** das Lagebild mit `--web` auf genau diesen Port gestartet wird
- **Then** endet der Aufruf mit einem von Null verschiedenen Exit-Code, die Meldung nennt den
  belegten Port und den Schalter `--web-port`, und es erscheint keine Zeile, die den Start der
  Ansicht behauptet

### Requirement: Changes ohne eigenes Issue werden ausgewiesen

Das System SHALL in der Lage jeden offenen Change nennen, dessen `proposal.md` keine Zeile
`GitHub-Issue #N` trägt, SHALL zu jedem dieser Einträge einen Grund führen, und SHALL den Grund
`unbewertet` verwenden, wenn die Issue-Quelle nicht geantwortet hat.

#### Scenario: Change ohne Verbindung

- **Given** ein offener Change, dessen `proposal.md` keine Issue-Zeile trägt
- **When** die Lage erhoben wird
- **Then** steht seine Kennung unter `ohne_issue`

#### Scenario: Change mit Verbindung

- **Given** ein offener Change, dessen `proposal.md` die Zeile `Geht zurueck auf GitHub-Issue #7.`
  trägt
- **When** die Lage erhoben wird
- **Then** steht seine Kennung nicht unter `ohne_issue`
