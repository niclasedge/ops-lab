# Aufgaben — pruefstand-tiefe

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in Backticks,
damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/lagebild-web.test.mjs` bekommt zwei Prüfungen gegen das hergestellte Repo:
      die Dateiliste des Arbeitsbaums belegt alle vier Arten, und die Zeitleiste führt die
      Fertigstellung dieses Arbeitsbaums namentlich. Beide sind gegen den heutigen Aufbau
      rot. Danach `just gate2 pruefstand-tiefe` für den roten Lauf

## Umsetzung (grün)

- [x] Im Prüfstand nach dem ersten Commit des Arbeitsbaums eine Aufgabe abhaken und diesen
      Schritt einzeln committen — daraus entsteht die Fertigstellung, die die Zeitleiste
      führen muss
- [x] Den Arbeitsbaum um eine vorgemerkte und eine gelöschte Datei ergänzen; die zu
      löschende Datei muss dafür schon im Commit des Hauptbaums stehen
- [x] Prüfen, dass die vorhandenen Prüfungen am laufenden Repo unverändert grün bleiben —
      dieser Change ergänzt und stellt nichts um
- [x] `just test` grün, danach `just lint` und `just validate`
- [x] `docs/pruefstand.dot` als sichtbaren Beleg schreiben und mit `just beleg` einliefern

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig` verlangt, dass keine Aufgabe
mehr offen ist. Ein Kästchen „just fertig läuft durch" müsste man abhaken, bevor es laufen
darf — und ein Haken, den man vorab setzt, entwertet die ganze Liste. Den Abschluss
belegen gate1.md, gate2.md und fertig.md.
