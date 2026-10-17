# Aufgaben — karte-kompakt

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/lagebild-detail.test.mjs` erweitern: eine unangetastete Change-Karte
      liefert keine ihrer vier Klappen mit `open` aus, und der Inhalt aller vier —
      beide Abschnitte der `proposal.md`, die Anforderung mit Szenarienzahl, die
      Einträge des Dateiabgleichs, die einzelnen Aufgaben — steht trotzdem im
      ausgelieferten Text
- [x] `tests/lagebild-detail.test.mjs`: die bestehenden Prüfungen zum Klappstand auf
      den neuen Anfangszustand ziehen, ohne die Mechanik selbst abzuschwächen — eine
      aufgeklappte Klappe bleibt offen, die übrigen bleiben zu, und eine Klappe mit
      der Vorgabe offen bleibt über `aufklappbar` weiterhin geprüft; danach
      `just gate2 karte-kompakt` für den roten Lauf

## Umsetzung (grün)

- [x] `ops.py`: die drei Aufrufe von `aufklappbar` in `worumKlappe`, `dateienKlappe`
      und der Aufgabenklappe von `changeKarte` ohne die Vorgabe offen
- [x] `ops.py`: die Kommentare über diesen drei Aufrufen auf den neuen Anfangszustand
      umschreiben, damit der Text den Code nicht länger widerlegt
- [x] `just alles` grün, und ein Beleg der Stufe nachher zeigt die kompakte Karte

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig karte-kompakt` verlangt,
dass keine Aufgabe mehr offen ist. Den Abschluss belegen gate1.md, gate2.md und
fertig.md.
