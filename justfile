# ops-lab — alle Ablaeufe an einer Stelle.
# Reines Node und Python aus der Standardbibliothek; kein Paketmanager, kein Build.

# ops.py braucht nur die Standardbibliothek. Wo `uv` da ist, laeuft es darueber --
# manche Umgebungen lassen einen nackten python3-Aufruf nicht zu.
py := `command -v uv >/dev/null 2>&1 && echo "uv run python3" || echo "python3"`

_default:
    @just --list --unsorted

# --- Der Weg eines Changes --------------------------------------------------

# Change anlegen: Branch, Ordner, vier Artefakte
neu id capability issue="":
    @node tools/neu.mjs {{id}} {{capability}} {{ if issue == "" { "" } else { "--issue " + issue } }}

# Gate 1 — der Plan ist vollstaendig und pruefbar
gate1 id:
    @node tools/gate.mjs gate1 {{id}}

# Gate 2 — die Tests existieren und sind rot
gate2 id basis="main":
    @node tools/gate.mjs gate2 {{id}} --basis={{basis}}

# Abschluss — die Tests sind gruen und die Aufgaben abgehakt
fertig id:
    @node tools/gate.mjs fertig {{id}}

# Beleg einliefern: Bild oder Artefakt als Nachweis an den Change haengen
# Die Change-ID wird erst hier zum Ordner. tools/beleg.mjs kennt nur einen
# Vorgangsordner -- damit traegt dasselbe Werkzeug spaeter auch ein Issue.
beleg id stufe pfad:
    @node tools/beleg.mjs openspec/changes/{{id}} {{stufe}} {{pfad}}

# Pull Request gegen main stellen (setzt 'just fertig' voraus)
pr id:
    @test -f openspec/changes/{{id}}/fertig.md || (echo "Kein fertig.md — erst 'just fertig {{id}}'." && exit 1)
    git push -u origin change/{{id}}
    gh pr create --base main --head change/{{id}} --fill

# Change nach dem Merge ins Archiv ueberfuehren
# --yes: openspec fragt vor dem Schreiben der Specs am Terminal nach. In einem
# Rezept liest niemand von stdin -- der Aufruf brach mit Fehler ab, statt zu
# archivieren. Die Rueckfrage ist hier ohnehin beantwortet: archiviert wird erst
# nach dem Merge, und was uebernommen wird, stand im PR.
archiv id:
    openspec archive {{id}} --yes
    @echo "Archiviert. Neue Capability? Dann traegt ihre Spec jetzt einen Platzhalter-Purpose — den schreiben, sonst bleibt validate rot."
    @just validate

# --- Pruefen ----------------------------------------------------------------

# Syntaxpruefung aller Node-Skripte
lint:
    @for f in tools/*.mjs tests/*.test.mjs; do node --check "$f" || exit 1; done
    @echo "lint: alle Skripte syntaktisch in Ordnung"

# Testlauf (Fachtests und Selbsttest des Lagebilds)
test:
    @node --test --test-reporter=spec "tests/*.test.mjs"
    @{{py}} ops.py --selftest

# Alle Changes gegen das OpenSpec-Schema pruefen
validate:
    @openspec validate --all --strict

# Lint, Tests und Schemapruefung in einem
alles: lint test validate

# --- Ausrollen ins Testrepo -------------------------------------------------

# Tooling nach ops-lab-test ausrollen (tools/*.mjs und ops.py)
sync ziel="../ops-lab-test":
    @node tools/sync.mjs {{ziel}}

# Zeigen, was sich aendern wuerde, ohne zu schreiben
sync-trocken ziel="../ops-lab-test":
    @node tools/sync.mjs {{ziel}} --trocken

# Lagebild des Testrepos von hier aus
ops-test ziel="../ops-lab-test":
    @{{py}} ops.py --root {{ziel}} --once --graph

# --- Lage ------------------------------------------------------------------

# Lagebild: Stand, Fortschritt, naechste freie Changes, Verbindungen
ops:
    @{{py}} ops.py

ops-once:
    @{{py}} ops.py --once

ops-graph:
    @{{py}} ops.py --once --graph

ops-json:
    @{{py}} ops.py --json

# Token je Lauf
tokens:
    @node tools/tokens.mjs

tokens-json:
    @node tools/tokens.mjs --json

# --- Web-Ansicht -----------------------------------------------------------

# FastAPI und uvicorn kommen zur Laufzeit ueber `uv run --with` dazu. Das Repo
# selbst bleibt ohne Abhaengigkeitsdatei, ohne Lock und ohne venv; jeder andere
# Aufruf von ops.py laeuft weiter mit der Standardbibliothek allein.

# Lagebild im Browser, nur lesend (Vorgabe: http://127.0.0.1:8765)
web port="8765":
    @uv run --with fastapi --with uvicorn python3 ops.py --web --web-port {{port}}

# Die Nutzlast der Ansicht als JSON, ohne Server und ohne Fremdbibliothek
web-trocken:
    @{{py}} ops.py --web --trocken
# --- Messreihe -------------------------------------------------------------

# Messlauf vorbereiten: Zielrepo zuruecksetzen, Auftrag woertlich ausgeben
messlauf kennung adapter="claude" ziel="../ops-lab-test":
    @node tools/messlauf.mjs starte {{kennung}} --adapter={{adapter}} --ziel={{ziel}}

# Einen vollen Lauf im Zielrepo fahren -- der Agent arbeitet selbstaendig
test-claude kennung="amortisation" ziel="../ops-lab-test":
    @node tools/testlauf.mjs {{kennung}} --ziel={{ziel}}

# Denselben Lauf nur zeigen, nicht fahren
test-claude-trocken kennung="amortisation" ziel="../ops-lab-test":
    @node tools/testlauf.mjs {{kennung}} --ziel={{ziel}} --trocken

# Dasselbe fuer den zweiten Harness
test-pi ziel="../ops-lab-test":
    @echo "Sitzung im Zielrepo fuehren:"
    @echo "  cd {{ziel}} && pi"
    @echo "Mitschriftenordner mit --mitschriften=<ordner> an 'just messung' uebergeben."

# Mitschrift auswerten und die Messung unter docs/messungen/ ablegen
messung kennung adapter="claude" ziel="../ops-lab-test":
    @node tools/messlauf.mjs messe {{kennung}} --adapter={{adapter}} --ziel={{ziel}}

# Zwei abgelegte Messungen gegenueberstellen
vergleich vorher nachher:
    @node tools/messlauf.mjs vergleiche {{vorher}} {{nachher}}

# Pull Request mergen. --admin, weil die Umgebung den Merge sonst ablehnt:
# der Ablauf hat keinen zweiten Menschen, der ihn freigibt.
merge nummer:
    @gh pr merge {{nummer}} --merge --admin

# --- Lage in einem Aufruf ---------------------------------------------------

# Stand des Repos als JSON: zuletzt fertig, aktiv, frei, blockiert, verwaist, Ideen
lage:
    @node tools/lage.mjs --json

# Derselbe Stand als eine Zeile -- knapp genug fuer den Beginn einer Sitzung
lage-kurz:
    @node tools/lage.mjs --kurz

# --- Ausrollen in ein Projekt ----------------------------------------------

# Den Ablauf ausrollen: Skill und Arbeiter global, Werkzeuge und Rezepte ins Ziel.
# Ohne Ziel wird das Arbeitsverzeichnis genommen. Die CLAUDE.md bleibt unangetastet --
# der Installer gibt dafuer einen Uebergabetext aus.
install ziel=".":
    @node tools/install.mjs {{ziel}}

# Belegbild: ein SVG aus einer Funktion des Werkstuecks -- jede Zahl darin ist
# ein echter Aufruf der Umsetzung. Die Grundlage fuer den sichtbaren Beleg, den
# der Abschluss verlangt (F-5).
belegbild ziel modul funktion von bis:
    @node tools/belegbild.mjs {{ziel}} --modul={{modul}} --funktion={{funktion}} --von={{von}} --bis={{bis}}

# Token je Lauf im Testrepo, von hier aus -- Hauptordner und Arbeitsraeume
tokens-test ziel="../ops-lab-test":
    @node tools/tokens.mjs --repo={{ziel}}

# Das Werkstueck auf Stand 0 zuruecksetzen -- das Geruest bleibt, wo es ist.
#
# Chirurgisch statt 'git reset --hard': der naechste Lauf soll dasselbe
# Werkstueck vorfinden wie der vorige, aber das neueste Werkzeug. Beides mit
# einem Reset zu wollen geht nicht -- er zieht auch tools/ und ops.py zurueck.
# Der Tag stand-0 markiert den Ausgangsstand; einmalig im Zielrepo setzen.
stand-0 ziel="../ops-lab-test":
    git -C {{ziel}} checkout stand-0 -- src tests openspec
    git -C {{ziel}} clean -fd src tests openspec
    @echo "Werkstueck steht auf stand-0. Das Geruest ist unberuehrt."

# --- Abgleich ---------------------------------------------------------------

# Zusage aus dem Vorschlag gegen den Diff halten. Kein Gate: der Abgleich
# berichtet und blockiert nicht -- eine Zusage kann sich berechtigt aendern.
abgleich id basis="main":
    @node tools/abgleich.mjs {{id}} --basis={{basis}}

# --- Abgabe und Merge in je einem Aufruf ------------------------------------

# Abgabe: committen, pushen, Pull Request stellen. Setzt 'just fertig' voraus --
# ohne fertig.md unterbleibt alles. Ersetzt die Handgriffe hinter 'just pr'.
abgabe id:
    @node tools/abgabe.mjs {{id}}
