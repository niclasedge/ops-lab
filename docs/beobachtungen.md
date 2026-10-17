# Beobachtungen zum Ablauf

Was beim Arbeiten auffällt, aber nicht zur laufenden Aufgabe gehört. Kein Change greift von
hier aus durch — wird eine Beobachtung zur Arbeit, wird sie erst ein GitHub-Issue.

Format je Eintrag: **Datum · Beobachtung · Was das für den Ablauf bedeutet**.

---

## 2026-09-20 · Es gibt kein Gate vor Gate 1

Zwischen Issue und `just neu` prüft nichts. `/grill-me` ist eine Zusage, kein Befehl mit
Exit-Code: wer das Verhör auslässt, merkt es an keiner Stelle. Ein falsch verstandener
Bedarf passiert danach jedes Gate, weil alle späteren Prüfungen nur noch die innere
Stimmigkeit des Plans prüfen, nicht seinen Bezug zur Wirklichkeit.

*Für den Ablauf:* Die vier Pflichtfelder der Issue-Vorlage sind der Ersatz — sie erzwingen
dieselben Antworten an der Stelle, an der ein Formular noch wirkt. Ob das reicht, ist eine
der Fragen, die dieses Labor beantworten soll.

## 2026-09-20 · Gate 2 kann die Güte des roten Tests nicht prüfen

G2-4 verlangt einen fehlschlagenden Testlauf. Ob der Test die richtige Sache prüft, sieht
die Maschine nicht: `assert.fail()` besteht Gate 2 genauso wie ein sauberes Szenario.

*Für den Ablauf:* Ein möglicher nächster Schritt wäre, die roten Tests gegen die
Szenariennamen aus der Delta-Spec zu halten — dann müsste mindestens ein fehlschlagender
Test den Namen eines `#### Scenario:` tragen. Noch nicht gebaut; erst messen, ob es fehlt.

## 2026-09-20 · Die Zusage „Berührte Dateien" wird nicht nachgehalten

`proposal.md` nennt die Dateien, die ein Change anfasst. Dass der Diff sich daran hält,
prüft kein Gate. Genau daraus entstehen aber die Merge-Konflikte, die dieses Labor
vermeiden will.

*Für den Ablauf:* Ein Check im Abschluss wäre billig — `git diff --name-only main...HEAD`
gegen die Liste. Bewusst nicht gebaut, bis der erste Konflikt zeigt, ob das Problem real ist.

## 2026-09-20 · Der Nachweisschreiber stolpert über ungetrackte Verzeichnisse

`just gate1 lagebild-web` bestand alle sieben Prüfungen und brach danach mit
`EISDIR` ab, beim Schreiben von `gate1.md`. Ursache: `arbeitsbaumDiff()` in
`tools/gate.mjs` liest jeden Pfad aus `git ls-files --others` als Datei. Verschachtelte
Worktrees unter `.claude/worktrees/` sind eigene Repos; Git steigt nicht hinein und
listet sie als Verzeichnis mit Schrägstrich. `readFileSync` auf ein Verzeichnis wirft.

Bemerkenswert ist die Reihenfolge: das Gate war inhaltlich grün, der Nachweis kam
trotzdem nicht zustande. Ein rotes Gate schreibt keine Datei — hier schrieb ein grünes
Gate auch keine, aus einem Grund, der mit der Prüfung nichts zu tun hat. Von außen sieht
beides gleich aus: kein `gate1.md`.

Behoben wurde vorerst nur die Ursache am Ort: `.claude/` steht jetzt in `.gitignore`.
Der Lesefehler selbst steht weiter im Code und trifft jeden, der ein ungetracktes
Verzeichnis im Baum hat.

*Für den Ablauf:* `lies()` müsste vor dem Lesen auf eine reguläre Datei prüfen und
Verzeichnisse als solche vermerken, statt zu werfen — mit Regressionstest in
`tests/pruefungen.test.mjs`. Eigener Change, nicht nebenbei. Allgemeiner: das Schreiben
des Nachweises ist ein ungeprüfter Schritt nach der Prüfung. Er sollte entweder so
einfach sein, dass er nicht fehlschlagen kann, oder selbst eine Prüfung sein.

## 2026-09-20 · Ein Change kann eine ungetestete Prüfung still mitnehmen

`worktrees` stellte `just neu` auf Arbeitsräume um und ersetzte dabei die Prüfung „gibt es
den Change-Ordner schon?" durch „gibt es den Arbeitsraum schon?". Beides klingt gleich und
ist es nicht: ein frisch abgezweigter Arbeitsraum trägt den Stand des Hauptbranches, also
lag der alte Change-Ordner darin — und die Vorlagen schrieben kommentarlos darüber. Alle
Gates standen dabei auf grün, 8/8, 4/4, 4/4.

Der Grund ist einfach: die alte Prüfung hatte keinen Test. Was kein Test festhält, kann ein
Refactoring mitnehmen, ohne dass irgendetwas rot wird. `tests/neu.test.mjs` entstand erst
mit demselben Change, der die Prüfung entfernte — es gab schlicht nichts, was hätte
widersprechen können.

Aufgefallen ist es erst bei einer Gegenprobe von Hand, nach dem Merge. Behoben in
`artefakte-schuetzen`, mit drei Regressionstests.

*Für den Ablauf:* Der Fall ist kein Argument für ein weiteres Gate, sondern für die Regel,
die schon dasteht — jede maschinelle Prüfung braucht einen Test, sonst ist sie nur eine
Behauptung mit Exit-Code. Offen bleibt, ob sich das prüfen lässt: eine Prüfung im Code ohne
zugehörigen Test zu finden, ist keine Textfrage mehr.

## 2026-09-20 · G1-8 macht das `justfile` unkorrigierbar

Die Anhänge-Regel lässt am `justfile` nur Zeilen hinzufügen, keine ändern. Das hält den
Parallelbetrieb offen, hat aber eine Nebenwirkung: der Kommentar über dem Rezept `neu`
lautet weiterhin „Change anlegen: Branch, Ordner, vier Artefakte" und ist seit `worktrees`
falsch — es ist Arbeitsraum, Branch, Ordner. Wer ihn richtigstellt, entfernt eine Zeile und
lässt Gate 1 fallen.

*Für den Ablauf:* Die Regel wirkt wie beabsichtigt, aber sie trennt nicht zwischen Rezept
und Kommentar. Ein Change, dessen einziger Zweck die Korrektur des `justfile` ist, kommt an
G1-8 vorbei, weil er dann die einzige Datei des Changes ist und keine Überschneidung
entstehen kann — nur weiß G1-8 das nicht. Noch nichts gebaut; erst sammeln, wie oft es
auftritt.

## 2026-09-20 · openspec erwartet englische Überschriften

Bei jedem `just archiv` meldet openspec: *Change must have a Why section. Expected headers:
„## Why" und „## What Changes"*. Die Meldung ist folgenlos — archiviert wird trotzdem, und
`validate --strict` läuft durch —, aber sie steht bei jedem Lauf in der Ausgabe.

Der Grund ist die Sprachwahl dieses Repos: die Vorlagen schreiben „## Warum" und „## Was
ändert sich", Gate 1 prüft genau diese deutschen Überschriften (G1-2). openspec kennt nur
die englischen.

*Für den Ablauf:* Eine folgenlose Warnung bei jedem Lauf ist teurer als sie aussieht — sie
gewöhnt daran, Ausgaben zu überfliegen, und die nächste Meldung an derselben Stelle ist
dann auch nur Rauschen. Zwei Wege: die Überschriften zweisprachig führen, oder die Meldung
im Rezept herausfiltern. Der zweite wäre eine Unterdrückung und damit dieselbe Sorte
Abkürzung, die dieses Labor sonst ablehnt.

## 2026-09-20 · Ein Integrationstest kann am Repo festwachsen

`tests/lagebild-web.test.mjs` filtert alle Läufe mit `--worktree lagebild-web`, „damit kein
anderer Worktree das Ergebnis verschieben kann". Das machte den Lauf deterministisch — solange
dieser Arbeitsraum existierte. Nach dem Merge und dem vorgesehenen `git worktree remove` waren
16 von 20 Tests rot, ohne dass sich eine Zeile Produktionscode geändert hatte. Ein weiterer
Test derselben Datei war schon vorher rot geworden: er erwartet den Change `lagebild-web` beim
gleichnamigen Baum, nach dem Merge liegt er aber inhaltsgleich auf `main` und gehört damit
korrekt dem Hauptbaum.

Das Muster ist in beiden Fällen dasselbe: der Test prüft die richtige Regel, bindet sie aber
an einen Zustand, den der normale Ablauf planmäßig auflöst. Aufräumen wird dadurch teuer —
wer den Arbeitsraum entfernt, wie es die Anleitung vorsieht, macht die Testsuite rot.

*Für den Ablauf:* Kein Gate kann das fangen; zum Zeitpunkt von Gate 2 und Abschluss ist der
Zustand noch da und die Tests sind grün. Die Regel dahinter ist älter als dieses Repo: ein
Test darf sich seine Umgebung selbst bauen oder gegen eine Invariante prüfen, aber nicht gegen
einen Namen, den der Ablauf später abräumt. `tests/lagebild-gruppen.test.mjs` läuft ungefiltert
und über Invarianten — dieselbe Nutzlast, derselbe Aufruf, und beim Aufräumen grün geblieben.

## 2026-09-20 · Zwei Sitzungen haben denselben Fehler zweimal repariert

Der Befund darüber wurde am selben Nachmittag zweimal behoben. `tests-eigenes-repo` wurde um
14:42 gemergt; `lagebild-test-eigenstand` lief zur selben Zeit in einem anderen Arbeitsraum und
kam mit 8/8, 4/4 und 5/5 durch, bevor beim Anlegen des Pull Requests der Konflikt auffiel.
Beide Fassungen bauen ein Wegwerf-Repo unter `mkdtemp`, beide zählen 40 Prüfungen, beide sind
grün. Die zweite war vollständig umsonst.

Das Lagebild hätte es nicht verhindern können. *Nächste freie Changes* vergleicht die Zusagen
unter „Berührte Dateien" — aber nur von Changes, die als Ordner schon existieren. Eine
Reparatur, die jemand spontan beginnt, ist bis zum ersten Commit für jeden anderen unsichtbar,
und genau in diesem Fenster lief beides an. Hinzu kommt, dass beide Läufe aus demselben Anlass
starteten: `main` war rot, und wer das sieht, fängt an.

*Für den Ablauf:* Der Parallelbetrieb ist gewollt und funktioniert — die Arbeitsräume haben
sauber getrennt, kein Commit ging verloren, der Konflikt beschränkte sich auf eine Datei. Was
fehlt, ist Sichtbarkeit **vor** dem ersten Commit. Ein Kandidat wäre, gepushte Branches und
angelegte Arbeitsräume im Lagebild zu führen, auch ohne Change-Ordner. Noch ist das ein Fall
und kein Muster; erst ein zweiter Vorfall rechtfertigt Werkzeug dagegen.

## 2026-09-20 · G2-4 zählt Fehlschläge, nicht Exit-Codes — und das ist richtig so

Beim Nachziehen des roten Schritts stand die neue Erwartung, aber die Aufbaufunktion fehlte
noch. Der `before`-Hook warf, node brach daraufhin alle 40 Prüfungen der Datei ab: `# fail 0`,
`# cancelled 40`, Exit 1. Gate 2 lehnte das ab, weil G2-4 `lauf.code !== 0 && fehler > 0`
verlangt.

Das ist die schärfere und die richtige Regel. Ein Lauf, in dem nichts fehlschlägt, sondern
alles abbricht, belegt nichts über die Prüfung — er belegt nur, dass der Aufbau kaputt ist.
Ein roter Test muss *rot* sein, nicht *ausgefallen*. Die Formulierung in `CLAUDE.md`
(„der Testlauf schlägt fehl (Exit ≠ 0)") ist an dieser Stelle ungenauer als der Code.

*Für den Ablauf:* Bei einem Change, der nur eine Testdatei repariert, fallen Erwartung und
Umsetzung in dieselbe Datei. Der rote Schritt ist trotzdem herstellbar, und zwar ehrlich: die
neue Infrastruktur steht, die Aufrufe greifen noch an die alte Stelle. Genau so schlagen die
Prüfungen aus dem echten Grund fehl. Wer stattdessen den Aufbau entfernt, bekommt Abbrüche und
kommt an Gate 2 nicht vorbei.

## 2026-09-20 · Nur anhängen heißt nicht konfliktfrei

G1-8 lässt am `justfile` ausschließlich Anhänge zu, damit zwei Changes parallel laufen können,
obwohl beide diese Datei anfassen. `diff-reviewer` und ein Change aus einer zweiten Sitzung
hielten sich beide daran — und der Pull Request ließ sich trotzdem nicht mergen. Beide hatten
am Dateiende angehängt, git legt zwei Einfügungen an derselben Position nicht automatisch
zusammen.

Die Auflösung war mechanisch eindeutig und in zwei Minuten erledigt: beide Blöcke behalten,
Reihenfolge beliebig, keine Zeile fällt weg. Genau deshalb ist der Fall bemerkenswert — die
Regel hatte recht, die Zusammenführung war trivial, und automatisch ging sie trotzdem nicht.

*Für den Ablauf:* Die Ausnahme in G1-8 verspricht nicht, was man ihr zuschreibt. Sie hält die
Änderungen **inhaltlich** disjunkt, nicht **textlich** — ein Konflikt am selben Dateiende bleibt
möglich. Das Lagebild nennt unter *Nächste freie Changes* solche Paare weiter zu Recht als
parallel startbar; wer sie startet, sollte nur mit einem Handgriff beim Merge rechnen. Ein
Werkzeug dagegen wäre denkbar (Rezepte je Change in eigene Dateien, die `just` einliest), ist
aber für einen Handgriff pro Merge zu teuer. Erst zählen, wie oft es auftritt.

## 2026-09-20 · G1-8 misst falsch, sobald `main` eingemischt wurde

Die Regel vergleicht gegen den gemeinsamen Vorfahren: `git diff --numstat` muss null entfernte
Zeilen ausweisen. Nachdem `main` in den Branch gemischt war, meldete die Kennzahl vier entfernte
Zeilen — sie stammten aus `main`, wo eine andere Sitzung das Rezept `test-claude` gestrichen
hatte. Der Change selbst hatte nichts entfernt; gegen `origin/main` gerechnet kam ausschließlich
sein eigener Block hinzu.

*Für den Ablauf:* Gate 1 läuft normalerweise früh, vor jedem Einmischen, und trifft das Problem
deshalb selten. Wer es aber nach einem Merge von `main` erneut fährt — etwa weil ein Befund
nachgezogen wurde —, bekommt ein rotes Gate für fremde Arbeit. Die saubere Bezugsgröße ist nicht
der gemeinsame Vorfahre, sondern der Stand von `main` selbst: was der Change gegenüber dem
aktuellen `main` entfernt, ist seine Entfernung. Noch nicht geändert, weil die Regel im
Normalfall trägt und eine Änderung an einem Gate ihren eigenen Change verdient.

## 2026-09-21 · Port 8765 gehört auf dieser Maschine dem Report-Store

`ops.py --web` gibt als Vorgabe `8765` aus — denselben Port, auf dem der Dienst
`git-planner-go` den Report-Store für `report-tool` hält (`~/.claude.json`,
`http://127.0.0.1:8765/mcp`). Der Zusammenstoß meldete sich als Traceback der
Fremdbibliothek, **nachdem** die Startzeile bereits „Lagebild: http://127.0.0.1:8765"
ausgegeben hatte: die Ansicht behauptete einen Start, den es nicht gab.

*Für den Ablauf:* Der Change `web-erreichbar` prüft den Port jetzt vor dem Import von
FastAPI und endet mit Exit 4 und einem Satz, der `--web-port` nennt. Die Vorgabe selbst
bleibt `8765`. Sie zu ändern hieße, die Zeile `web port="8765"` im `justfile` zu ersetzen —
eine entfernte Zeile, an der G1-8 zu Recht hält. Wer beide Dienste gleichzeitig braucht,
nimmt `--web-port`; wem die Vorgabe dauerhaft im Weg steht, der ändert sie zusammen mit dem
Rezept in einem Change, der das `justfile` bewusst anfasst.

## 2026-09-20 · MODIFIED kann ein Szenario mitschleppen, aber nicht ablegen

Der Change `karte-kompakt` sollte die Aufgabenklappe der Change-Karte von „anfangs offen" auf
„anfangs zu" drehen. Das bestehende Requirement *Aufgaben eines Changes aufklappbar* trug genau
dafür ein eigenes Szenario: *Aufgabenklappe steht anfangs offen*. Der naheliegende Weg wäre ein
MODIFIED-Block gewesen — er scheiterte an `openspec validate --strict` (1.13.1), das von einem
MODIFIED verlangt, jedes Szenario des bestehenden Requirements namentlich zu wiederholen. Die
Regel schützt davor, dass beim Archivieren still ein Szenario verlorengeht; sie macht damit aber
auch unmöglich, eines absichtlich abzulegen.

Der Arbeiter hat das Requirement stattdessen per REMOVED entfernt und unter *Aufgaben eines
Changes unter einer Klappe* fortgeführt — gleiche Aussage über die Nutzlast, gleiches
verbleibendes Szenario, der Anfangszustand jetzt in einem neuen Requirement, das alle vier
Klappen gemeinsam regelt. Beim Archivieren wirkten drei Operationen auf dieselbe Spec-Datei;
`openspec validate --all --strict` blieb grün.

*Für den Ablauf:* Wer eine Zusage zurücknimmt statt sie zu erweitern, braucht REMOVED plus ADDED,
nicht MODIFIED. Das ist kein Mangel des Werkzeugs, sondern seine Konsequenz — aber es kostet
einen Anlauf, wenn man es nicht weiß. Der REMOVED-Block sollte dann ausdrücklich benennen, was
entfällt und wohin der Rest geht, sonst liest sich ein Rückbau später wie ein Verlust.
