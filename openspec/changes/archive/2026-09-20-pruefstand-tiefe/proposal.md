# pruefstand-tiefe

## Warum

`tests/lagebild-web.test.mjs` baut sich seit `tests-eigenes-repo` ein Wegwerf-Repo unter
`mkdtemp`. Der Entwurf dort ist bewusst zweigeteilt: was einen Namen oder eine Zahl
braucht, läuft gegen das hergestellte Repo; was eine Invariante über alle Arbeitsbäume
ist, bleibt am laufenden. Diese Teilung ist richtig.

Zwei Abschnitte stehen aber auf der falschen Seite davon. *Geänderte Dateien stehen beim
Namen* und *Die Zeitleiste steht absteigend und ungekürzt* lesen beide das laufende Repo —
und dort ist der Gegenstand nicht Invariante, sondern Zufall.

**Die vier Dateiarten sind faktisch eine.** Die Prüfung *nennt je Datei Pfad und eine der
vier Arten* zählt `vorgemerkt`, `geaendert`, `unverfolgt` und `geloescht` auf. Am laufenden
Repo nachgemessen liegt vor: `{"unverfolgt": 1}`. Eine einzige Datei, eine einzige Art.
Ob `ops.py` die anderen drei richtig einordnet, prüft niemand — und ob überhaupt eine
Datei vorliegt, hängt davon ab, was gerade herumliegt. Ein sauberes Repo macht alle vier
Prüfungen dieses Abschnitts gegenstandslos, ohne dass eine davon rot würde.

**Die Zeitleiste steht auf demselben Grund.** Aktuell führt sie 15 Einträge, die drei
Prüfungen darüber greifen also. Aber die 15 sind nicht hergestellt, sondern angefallen:
sie stammen aus den Changes, die dieses Repo gerade offen hat. Nach dem nächsten
Archivieren kann die Zahl anders aussehen, und bei null iterieren *nennt je Eintrag …* und
*steht absteigend …* über nichts.

Es ist derselbe Fehlertyp, den `tests-eigenes-repo` behoben hat — nur nicht mehr über
einen Namen, den der Ablauf abräumt, sondern über einen Zustand, den niemand zusichert.
Der Prüfstand steht bereits daneben; diese beiden Abschnitte nutzen ihn nur nicht.

## Was ändert sich

Der Prüfstand stellt beide Zustände her. Im Arbeitsbaum wird nach dem ersten Commit eine
Aufgabe abgehakt und dieser Schritt einzeln committet — daraus entsteht eine
Fertigstellung, die die Zeitleiste führen muss. Dazu kommen eine vorgemerkte und eine
gelöschte Datei, sodass alle vier Arten vorliegen.

Dazu zwei Prüfungen, die diesen hergestellten Zustand auch abfragen: die Dateiliste des
Arbeitsbaums belegt alle vier Arten, und die Zeitleiste des hergestellten Repos führt die
angelegte Fertigstellung namentlich.

## Was ausdrücklich nicht

**Die vorhandenen Prüfungen werden nicht umgestellt.** Sie bleiben am laufenden Repo, weil
sie dort Invarianten prüfen, die für jedes Repo gelten müssen — dass jede Datei einen Pfad
und eine bekannte Art trägt, dass die Liste sortiert ist, dass Zähler und Liste sich nicht
widersprechen. Der Entwurf aus `tests-eigenes-repo` ist an dieser Stelle richtig; er ist
nur unvollständig abgesichert. Dieser Change ergänzt, er räumt nicht um.

`ops.py` wird nicht angefasst. Es gibt keinen Hinweis auf einen Fehler im Lagebild — die
Lücke liegt im hergestellten Zustand, nicht in dessen Auswertung. Zeigt der rote Lauf, dass
eine der vier Arten trotz hergestelltem Zustand fehlt, ist das ein eigener Befund und ein
eigener Change.

Der Prüfstand bleibt in dieser Testdatei und wird nicht zum Modul. Ein zweiter Nutzer
existiert nicht, und ein Helfer ohne zweiten Nutzer ist geraten, nicht entworfen.

## Berührte Dateien

- `tests/lagebild-web.test.mjs`
- `docs/pruefstand.dot` — der sichtbare Beleg: was der Prüfstand herstellt und was daraus folgt
