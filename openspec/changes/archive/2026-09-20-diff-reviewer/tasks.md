# Aufgaben — diff-reviewer

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/pruefungen.test.mjs`: die Zusage wird aus den Listeneinträgen des Abschnitts
      „Berührte Dateien" gelesen — mehrere Pfade je Eintrag, Fortsetzungszeile, Prosa
      darunter zählt nicht, fehlender Abschnitt ergibt eine leere Zusage
- [x] `tests/pruefungen.test.mjs`: der Vergleich weist Zusatz und Auslassung getrennt aus,
      meldet Deckungsgleichheit als solche, löst eine Ordnerzusage auf und übergeht die
      Artefakte des Ablaufs
- [x] `tests/abgleich.test.mjs`: der Aufruf gegen ein Wegwerf-Repo nennt beide Richtungen,
      endet bei einem Befund mit Exit 0 und bei unbekannter Kennung mit Fehler
- [x] `tests/install.test.mjs`: jeder Ordner unter `.claude/skills/` landet im
      Konfigurationsordner und im Vorrat, ohne sich an einen Skillnamen dieses Repos zu
      binden

## Umsetzung (grün)

- [x] `tools/pruefungen.mjs` bekommt beide reinen Regeln; `tools/erfuellung.mjs` ruft sie
      von dort auf, statt sie ein zweites Mal zu führen
- [x] `tools/abgleich.mjs`: Diff gegen die Basis beschaffen, beide Regeln anwenden, Bericht
      ausgeben; Ziel `abgleich` ans `justfile` angehängt
- [x] `.claude/skills/diff-reviewer/SKILL.md`: wann der Abgleich läuft und wie ein Befund zu
      lesen ist, ohne ausgeschriebenen Pfad
- [x] `tools/install.mjs` rollt jeden Skill unter `.claude/skills/` aus, keinen namentlich

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig diff-reviewer` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kästchen „just fertig läuft durch" müsste man abhaken,
bevor es laufen darf — und ein Haken, den man vorab setzt, entwertet die ganze Liste. Den
Abschluss belegen gate1.md, gate2.md und fertig.md.
