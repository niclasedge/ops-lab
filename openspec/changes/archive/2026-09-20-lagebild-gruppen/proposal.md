# lagebild-gruppen

## Warum

Die Web-Ansicht zeigt heute zwei Listen nebeneinander: links die Arbeitsbäume, rechts die
Changes. Die Zuordnung zwischen beiden steht nur als Wort in der Change-Karte — „lagebild-web"
als Textzeile unter dem Namen. Wer wissen will, was in einem bestimmten Baum läuft, muss die
rechte Liste durchgehen und die Namen abgleichen. Bei drei Bäumen geht das noch; bei sechs
liest man dieselbe Zeile sechsmal und zählt mit dem Finger mit.

Das ist die eine Hälfte. Die andere ist, dass keiner der Bäume sagt, was mit ihm zu tun wäre.
Die Ansicht nennt Zähler und Haken — sieben geändert, zwei unverfolgt, 8 von 8 Aufgaben — aber
nicht die Handlung, die daraus folgt. Genau die ist im Parallelbetrieb die eigentliche Frage:
Dieser Baum ist fertig, gehört er in einen Pull Request? Jener hat uncommittete Änderungen,
sind die gemeint oder vergessen? Der Hauptbaum liegt zwei Commits zurück, muss ich ziehen?

Heute beantwortet man das, indem man die Zahlen selbst liest und die Regel im Kopf hat. Die
Regel steht aber bereits im Repo: `just neu`, `gate1`, `gate2`, `fertig`, `pr` sind eine feste
Folge, und an welcher Stelle ein Change steht, ist aus seinen Nachweisen ablesbar. Was die
Ansicht nicht tut, ist diese Folge auszusprechen. Sie zeigt den Stand und überlässt den Schluss
dem Betrachter — bei jedem Blick neu.

## Was ändert sich

Die Ansicht gruppiert. Statt zweier getrennter Listen steht je Arbeitsbaum eine Zeile: links
der Baum, rechts daneben seine Changes, auf voller Höhe der Gruppe. Wer auf `lagebild-web`
schaut, sieht ohne Namensabgleich, welche Changes dort liegen; wer auf den Hauptbaum schaut,
sieht die Changes, die auf `main` stehen. Die Zuordnung aus dem vorigen Change wird damit
sichtbar statt nur zutreffend.

Jeder Arbeitsbaum bekommt seinen **nächsten Schritt** — einen Satz und, wo es einen gibt, den
Befehl dazu. Die Regel ist die Folge, die das Repo ohnehin durchsetzt: uncommittete Änderungen
wollen committet werden; ein Change ohne `gate1.md` braucht den Plan; mit `gate1.md` und ohne
`gate2.md` den roten Test; mit beiden die nächste offene Aufgabe; alle Aufgaben abgehakt und
kein `fertig.md` den Abschluss; `fertig.md` und noch kein Pull Request den Pull Request; ein
gestellter Pull Request den Merge. Ein sauberer Baum ohne Change ist frei.

Der Schritt trägt eine von drei Lagen: **tun** (etwas liegt an), **warten** (etwas liegt
woanders an, etwa ein Review) und **ruhe** (nichts zu tun). Die Lage färbt die Karte, damit
sich beim Blick über sechs Bäume die beantwortete Frage von der offenen trennt, ohne zu lesen.

Die Regel steht als reine Funktion neben den übrigen und wird einzeln geprüft. Sie liest
nichts nach: sie entscheidet allein aus dem Stand, den die Nutzlast ohnehin führt.

## Was ausdrücklich nicht

Kein Ausführen. Der Schritt wird genannt, nicht angeboten. Es gibt keinen Knopf, der `just pr`
auslöst, und keine Route, die einen Befehl entgegennimmt. Die Ansicht bleibt nur lesend — sonst
wandert Ablaufsteuerung in ein Fenster, das kein Gate prüft.

Keine Änderung an der Zuordnung. Welcher Change zu welchem Baum gehört, hat `lagebild-web`
entschieden und bleibt unberührt. Dieser Change ordnet nicht neu, er stellt anders dar.

Kein Netzzugriff. Ob ein Pull Request offen ist, wird aus dem gelesen, was das Lagebild schon
führt — dem Merkmal `im PR`, das aus den Remote-Branches stammt. Es wird dafür kein `gh`
aufgerufen und keine API befragt.

Keine neue Kennzahl und keine Historie des Schritts. Der Schritt beschreibt den Augenblick;
er wird nicht abgelegt, nicht gezählt und nicht mit dem vorigen verglichen.

Keine Änderung an der Terminal-Ansicht. `--once`, `--graph`, `--json` und `--count` verhalten
sich danach exakt wie vorher.

## Berührte Dateien

- `ops.py` — neu: die Regel für den nächsten Schritt, ihr Platz in der Nutzlast und die
  gruppierte Darstellung; dazu der Selbsttest der Regel
- `tests/lagebild-gruppen.test.mjs` — neu: die Regel über `--web --trocken` geprüft, also
  ohne FastAPI
- `openspec/changes/lagebild-gruppen/` — die Artefakte dieses Changes

Nicht berührt: `tools/gate.mjs`, `tools/pruefungen.mjs`, `tools/neu.mjs`, `tools/pfade.mjs`,
`tools/beleg.mjs`, `tools/tokens.mjs`, `tools/sync.mjs`, `justfile`, `CLAUDE.md`. Das Ziel
`just web` steht bereits und braucht keine Änderung.

Überschneidung mit `lagebild-web`: beide fassen `ops.py` an und dieselbe Capability. Sie
laufen deshalb nacheinander, nicht parallel — dieser Change baut auf dem Stand des vorigen
auf und liegt im selben Arbeitsbaum. Ein eigener Arbeitsraum von `main` aus hätte `ops.py`
ein zweites Mal geöffnet und wäre genau der Konflikt, den das Lagebild sichtbar machen soll.
