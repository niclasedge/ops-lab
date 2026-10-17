# vorrat-angleichen

## Warum

Das Werkzeug dieses Repos wird in andere Repos ausgerollt, und dort ist es weitergewachsen. In
einem Abnehmer-Repo (`consumer-repo`) tragen `tools/neu.mjs`, `tools/gate.mjs`, `tools/lage.mjs` und
`tools/pruefungen.mjs` inzwischen drei Regeln, die es hier nicht gibt: ein Change entsteht nur
mit eigenem GitHub-Issue, der Testbefehl der Gates ist je Projekt bestimmbar, und das Lagebild
weist aus, welcher Change ohne Issue dasteht.

Damit steht die Quelle hinter ihren Abnehmern. Das ist nicht bloß unschön, sondern schädlich:
`node tools/install.mjs` kopiert von hier nach dort, und jeder Lauf würde die drei Regeln in
den Zielrepos wieder herausnehmen. Zwei Repos tragen dieselben Dateinamen mit verschiedenem
Inhalt, und welcher Stand gilt, entscheidet zufällig die Richtung des letzten Kopiervorgangs.

Die zweite Fassung hat dabei keinen Sonderfall gelöst, sondern eine Lücke geschlossen, die hier
genauso klafft. Ein Change ohne Issue ist ein Vorhaben, das außerhalb des Arbeitsraums niemand
sieht; ein fest verdrahteter Testbefehl misst in einem Projekt mit anderer Sprache eine
Testmenge, die der Change gar nicht anfasst, und meldet grün, ohne etwas gesehen zu haben.

## Was aendert sich

`tools/neu.mjs` verweigert einen Change ohne Issue-Nummer und legt in diesem Fall nichts an.
Mit Nummer trägt das `proposal.md` die Zeile, die Change und Issue verbindet.

`tools/gate.mjs` liest den Testbefehl aus `tools/gate.projekt.json`, wenn diese Datei daneben
liegt, und bleibt ohne sie beim bisherigen Node-Lauf. Ein fremder Läufer wird an seinem
Exit-Code gemessen, nicht an einer erfundenen Fehlerzahl.

`tools/lage.mjs` führt die neuen Listen: `ohne_issue` nennt jeden offenen Change ohne
verbundenes Issue samt Grund, `geclaimt` und `ohne_raum` trennen, was jemand schon genommen hat,
von dem, was noch in keinem Arbeitsraum liegt.

Die Anleitungen unter `.claude/` ziehen nach: der Arbeiter verlangt die Issue-Nummer im Auftrag,
und sein hart geschriebener Pfad einer fremden Maschine weicht der Wurzel aus `git rev-parse`.

## Was ausdruecklich nicht

`ops.py` bleibt, wie es hier liegt. Diese Fassung ist die neuere — sie trägt `--web-host` und
die Portprüfung —, und der Abnehmer bekommt sie beim nächsten Ausrollen.

Das `justfile` wird nicht angefasst. Das Rezept `neu` reicht die Nummer bereits durch, wenn sie
angegeben ist; ohne sie hält künftig das Werkzeug, nicht das Rezept.

Kein Automatismus, der Issues anlegt. Wer ein Issue braucht, legt es an — das Werkzeug sagt nur,
dass eines fehlt, und nennt den Befehl dafür.

## Beruehrte Dateien

- `tools/neu.mjs`
- `tools/gate.mjs`
- `tools/lage.mjs`
- `tools/pruefungen.mjs`
- `tests/neu.test.mjs`
- `tests/lage.test.mjs`
- `tests/gate-projekt.test.mjs`
- `docs/vorrat-angleichen.dot`
- `docs/vorrat-angleichen.svg`
- `.claude/agents/change-arbeiter.md`
- `.claude/skills/leitstand/SKILL.md`
- `openspec/changes/vorrat-angleichen/proposal.md`
- `openspec/changes/vorrat-angleichen/specs/arbeitsraum/spec.md`
- `openspec/changes/vorrat-angleichen/specs/lagebild/spec.md`
- `openspec/changes/vorrat-angleichen/tasks.md`
