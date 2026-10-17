# Aufgaben — lagebild-test-eigenstand

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdatei steht in Backticks,
damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [x] `tests/lagebild-web.test.mjs` bekommt den Prüfstand als Erwartung: ein temporäres
      Repo mit Hauptbaum, Arbeitsbaum und einem dort abweichend bearbeiteten Change, und
      alle Aussagen laufen gegen dessen Nutzlast statt gegen die des laufenden Repos.
      Danach `just gate2 lagebild-test-eigenstand` für den roten Lauf

## Umsetzung (grün)

- [x] Prüfstand bauen: `git init`, Change-Ordner mit `proposal.md` und `tasks.md`,
      Commit, `git worktree add`, dann im Arbeitsbaum eine Aufgabe abhaken und committen —
      so weicht der Change dort ab
- [x] Prüfstand einmal je Datei anlegen und am Ende wieder entfernen; die sieben
      Beschreibungsblöcke teilen ihn, statt je einen eigenen zu bauen
- [x] Die festen Namen `lagebild-web` und `change/lagebild-web` durch die des Prüfstands
      ersetzen; der Hauptbaum wird über sein Merkmal `haupt` gefunden, nicht über seinen
      Namen, weil der vom temporären Verzeichnis kommt
- [x] Die Aussagen über Zeitleiste, geänderte Dateien und Aufgaben auf die Inhalte des
      Prüfstands beziehen, ohne eine davon fallen zu lassen
- [x] `just test` grün, danach `just lint` und `just validate`

Der Abschluss steht bewusst nicht als Aufgabe: `just fertig` verlangt, dass keine Aufgabe
mehr offen ist. Ein Kästchen „just fertig läuft durch" müsste man abhaken, bevor es laufen
darf — und ein Haken, den man vorab setzt, entwertet die ganze Liste. Den Abschluss
belegen gate1.md, gate2.md und fertig.md.
