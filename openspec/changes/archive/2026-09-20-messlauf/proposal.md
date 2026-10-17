# messlauf

## Warum

Das Labor misst nach eigener Zusage drei Dinge: Token je Lauf, saubere Abarbeitung,
Parallelbetrieb. Keine dieser Zahlen liegt bislang fuer einen einzigen Durchlauf vor.
Der erste Durchlauf im Testrepo ist in `docs/beobachtungen.md` mit sechs Befunden
beschrieben, aber seine Tokenzahl existiert nirgends: unter den Mitschriften gibt es
keinen Ordner fuer das Testrepo, der Lauf fand also nie in einer Sitzung statt, die
dort ihr Arbeitsverzeichnis hatte. Dazu traegt das Testrepo eine Fassung von
`tokens.mjs` von vor der Reparatur des Pfadfehlers; selbst eine vorhandene Mitschrift
haette sie nicht gefunden. Die Messung war damit doppelt blind, und niemand hat es
bemerkt, weil nichts sie einfordert. Eine Zahl, die beilaeufig entstehen soll,
entsteht nicht. Solange der Messwert fehlt, ist jede Aussage ueber eine Verbesserung
des Ablaufs eine Meinung — und genau diese Aussage ist der Zweck des Labors. Hinzu
kommt, dass inzwischen zwei Agenten-Werkzeuge zur Verfuegung stehen, deren Aufwand
und Ergebnis sich vergleichen liessen, wenn es einen gemeinsamen Massstab gaebe.

## Was aendert sich

Ein Messlauf wird ein Befehl. `just test-claude` setzt das Testrepo auf einen
definierten Stand zurueck, uebergibt einem Agenten einen woertlich festgelegten
Auftrag, wartet auf dessen Ende und legt das Ergebnis als Messung ab. Der Auftrag
steht als Datei im Repo und ist zwischen zwei Laeufen unveraendert; was sich
unterscheiden darf, ist allein die Werkzeugfassung.

Jede Messung nennt fuenf Groessen: verbrauchte Token, Zahl der abgesetzten Befehle,
Dauer des Laufs, Kosten in Euro und den Erfuellungsgrad. Der Erfuellungsgrad ist
keine Einschaetzung, sondern eine Liste maschinell gepruefter Kriterien: liegen die
drei Gate-Nachweise vor, ist ein sichtbarer Beleg der Stufe `nachher` da, sind alle
Aufgaben abgehakt, haelt der Diff die Zusage der beruehrten Dateien ein, ist der
Testlauf gruen, wurde ein Pull Request gestellt und gemergt.

Der Harness ist austauschbar. `just test-claude` und ein spaeteres `just test-pi`
rufen denselben Messrahmen mit einem anderen Adapter auf; der Adapter weiss, wie sein
Werkzeug gestartet wird und wo es seine Mitschrift ablegt. Alles danach — zaehlen,
bewerten, ablegen, vergleichen — ist gemeinsam, damit zwei Harnesses an derselben
Elle gemessen werden.

Zwei Messungen lassen sich gegenueberstellen. `just vergleich` stellt zwei abgelegte
Messungen nebeneinander und weist die Veraenderung je Groesse aus. Eine Fassung gilt
erst dann als besser, wenn der Aufwand faellt und der Erfuellungsgrad nicht.

## Was ausdruecklich nicht

Keine Optimierung des Ablaufs. Dieser Change baut die Elle, nicht das, was an ihr
gemessen wird. Welche Vereinfachung sich lohnt, entscheidet die erste Messreihe, und
jede davon wird ein eigener Change.

Kein Starten eines Agenten durch dieses Repo im Hintergrund. `just test-claude` wird
von einem Menschen aufgerufen und laeuft im Vordergrund. Es gibt keinen Dienst, keinen
Zeitplan und keinen Aufruf, der sich selbst wiederholt.

Kein Pi-Adapter in diesem Change. Die Schnittstelle wird so geschnitten, dass er ohne
Aenderung am Rahmen danebentritt, und ein Platzhalter-Adapter belegt das im Test.
Gebaut wird er erst, wenn die Claude-Messreihe steht und zeigt, dass der Rahmen
taugt.

Keine Bewertung von Qualitaet jenseits der gepruefte Kriterien. Ob der Code schoen
ist, misst dieser Rahmen nicht und behauptet es auch nicht.

Keine Aenderung am Messstueck. Der Auftrag `amortisation` wird beschrieben, aber sein
Ergebnis entsteht im Testrepo, nicht hier.

## Beruehrte Dateien

- `tools/messung.mjs` — neu: Token, Befehle, Dauer und Kosten aus einer Mitschrift
- `tools/erfuellung.mjs` — neu: die Kriterien des Erfuellungsgrads, rein und getestet
- `tools/messlauf.mjs` — neu: Ruecksetzen, Harness starten, auswerten, ablegen
- `tools/preise.json` — neu: Preis je Modell und Token-Art, von Hand gepflegt
- `tests/messung.test.mjs` — neu
- `tests/erfuellung.test.mjs` — neu
- `justfile` — Ziele `test-claude`, `messung`, `vergleich`
- `docs/messungen/` — neu: der Auftrag und die abgelegten Messungen
- `openspec/changes/messlauf/` — die Artefakte dieses Changes

Dieser Change laeuft **nicht** parallel zu `beleg-bild`: beide fassen `justfile` an,
und der Erfuellungsgrad prueft den Beleg, den `beleg-bild` erst einfuehrt. Die
Reihenfolge ist `beleg-bild`, dann `messlauf`.

Nicht beruehrt: `ops.py`, `tools/gate.mjs`, `tools/pruefungen.mjs`, `tools/neu.mjs`,
`tools/sync.mjs`, `tools/tokens.mjs`. `tokens.mjs` bleibt, was es ist — die Uebersicht
ueber Sitzungen; `messung.mjs` beantwortet die andere Frage, naemlich die nach einem
einzelnen Lauf.
