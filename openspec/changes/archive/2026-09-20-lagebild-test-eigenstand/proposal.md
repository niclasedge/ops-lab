# lagebild-test-eigenstand

## Warum

`tests/lagebild-web.test.mjs` prüft die Nutzlast der Web-Ansicht gegen **das Repo, in dem
der Test gerade läuft**. Seine zentrale Hilfsfunktion filtert auf einen Arbeitsbaum mit
festem Namen:

```js
// Ein Worktree genuegt und macht den Lauf deterministisch: dieser hier traegt den
// Change lagebild-web, und kein anderer Worktree kann das Ergebnis verschieben.
function trockenlauf() {
  return ops("--web", "--trocken", "--worktree", "lagebild-web");
}
```

Die Annahme galt, solange `lagebild-web` ein offener Change in einem eigenen Arbeitsbaum
war. Seit er gemergt und archiviert ist, findet der Filter nichts — **16 der 140 Tests
sind rot, und zwar auf `main`.**

Das ist keine Kleinigkeit über einen Test. F-4 des Abschlusses verlangt einen grünen
Testlauf. Solange `main` rot ist, kommt **kein** Change mehr durch `just fertig`, egal wie
gut er ist. Der Ablauf hat sich selbst blockiert.

Der Kommentar nennt sogar den Grund, aus dem es schiefging: „macht den Lauf
deterministisch". Determinismus über einen Zustand, den der Ablauf selbst auflöst, ist
keiner — er ist nur eine Wette darauf, dass niemand fertig wird.

Es ist derselbe Fehlertyp wie der Datenverlust in `just neu`, der heute früh auffiel: eine
Prüfung, die an Umständen hängt statt an dem, was sie behauptet.

## Was ändert sich

Der Test stellt sich sein Repo selbst her, statt das laufende zu lesen: ein temporäres
git-Repo mit einem Hauptbaum, einem Arbeitsbaum und einem Change, der dort abweichend
bearbeitet wurde. `ops.py --root PFAD --web --trocken` liest es — der Weg existiert
bereits und ist am Prüfstand belegt.

Damit prüft die Datei weiterhin dieselben Aussagen über dieselbe Nutzlast, aber gegen
einen Zustand, den sie kennt, weil sie ihn gebaut hat. Sie kann nicht mehr dadurch rot
werden, dass jemand seinen Change fertigstellt.

`ops.py` wird nicht angefasst. Der Fehler liegt im Test, nicht im Lagebild.

## Was ausdrücklich nicht

Der Prüfstand bleibt in dieser Testdatei. Ihn gleich als eigenes Modul für künftige Tests
zu bauen wäre naheliegend — aber ein zweiter Nutzer existiert noch nicht, und ein Helfer
ohne zweiten Nutzer ist geraten, nicht entworfen. Sobald der nächste Change ihn braucht,
wandert er heraus; dann steht fest, was er können muss.

Die Anzeige archivierter Changes und der GitHub-Issues gehört **nicht** hierher, obwohl
beides gewünscht ist und dieselbe Capability betrifft. Dieser Change macht `main` grün;
alles andere danach. Ein Fix ist ein Fix.

Ebenfalls nicht hier: die übrigen Testdateien. Sie stellen ihren Stand bereits selbst her
(`tests/neu.test.mjs` legt sein Repo mit `mkdtempSync` an) oder prüfen reine Funktionen.

## Berührte Dateien

- `tests/lagebild-web.test.mjs`
- `docs/pruefstand.dot` — der sichtbare Beleg: der Aufbau, den der Test herstellt
