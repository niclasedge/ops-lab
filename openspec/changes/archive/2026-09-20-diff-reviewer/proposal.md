# diff-reviewer

## Warum

Jeder Vorschlag nennt unter **Berührte Dateien** die Dateien, die der Change anfasst. Diese
Liste ist die Zusage, auf der der Parallelbetrieb ruht: zwei Changes laufen gleichzeitig,
wenn ihre Dateimengen disjunkt sind, und das Lagebild entscheidet genau danach. Nachgehalten
wird die Zusage bisher an keiner Stelle. `docs/beobachtungen.md` hält das seit dem ersten
Durchlauf fest — kein Gate vergleicht den Diff mit der Liste, und niemand sieht, wenn ein
Change still eine Datei mitnimmt, die er nicht angekündigt hat.

Der Schaden ist nicht theoretisch. Genau daraus entstehen die Merge-Konflikte, die dieses
Labor vermeiden will: das Lagebild hat zwei Changes nebeneinander freigegeben, weil ihre
Zusagen disjunkt aussahen, und beim Pull Request kollidierten sie an einer Datei, die einer
von beiden nie genannt hatte. Die umgekehrte Richtung ist ebenso wenig sichtbar — eine Datei,
die zugesagt wurde und unberührt blieb, heißt meist, dass der Zuschnitt sich unterwegs
verschoben hat, ohne dass der Vorschlag es mitbekommen hat.

Wer das heute wissen will, tippt `git diff --name-only` und liest die Liste im Vorschlag
daneben. Das ist Handarbeit an der Stelle, an der man ohnehin schon fertig ist, und sie
unterbleibt.

## Was ändert sich

Ein Aufruf beantwortet die Frage: `just abgleich KENNUNG`. Er liest die Zusage aus dem
Vorschlag, holt den Diff des Changes gegen die Basis und stellt beides gegenüber. Der Bericht
benennt beide Richtungen getrennt — angefasst ohne Zusage, zugesagt ohne Anfassen — und sagt
Deckungsgleichheit als solche, statt zu schweigen.

Ein Skill `diff-reviewer` beschreibt, wann der Abgleich gefahren wird (vor `just pr`) und wie
ein Befund zu lesen ist: die eine Richtung ist ein Risiko für den Parallelbetrieb, die andere
ein Hinweis auf einen verschobenen Zuschnitt. Beide sind Anlass für ein Urteil, keines ist ein
Fehler mit Exit-Code.

Die Zusage aus dem Vorschlag zu lesen war bisher Sache von `tools/erfuellung.mjs`, für die
Messung des Erfüllungsgrads. Diese Regel zieht in `tools/pruefungen.mjs` um, wo die reinen
Textregeln dieses Repos stehen, und `erfuellung.mjs` ruft sie von dort auf. Dabei wird sie
genauer: gelesen werden nur die Listeneinträge des Abschnitts, nicht mehr jedes Wort in
Backticks. In der Prosa darunter steht in mehreren Vorschlägen ein Satz „Nicht berührt: …",
dessen Dateien bisher als Zusage mitzählten.

## Was ausdrücklich nicht

**Kein neues Gate.** Der Abgleich berichtet, er blockiert nicht, und er hat keinen Exit-Code
für einen Befund. Eine Zusage kann sich im Lauf eines Changes berechtigt ändern; ein Gate,
das daran scheitert, erzeugt Druck, die Zusage nachträglich passend zu schreiben, statt sie
ernst zu nehmen. Gates prüfen, was sich ohne Urteil entscheiden lässt — das hier lässt sich
das nicht. Ob daraus später ein Gate wird, entscheidet der Bestand, nicht dieser Change.

Keine Änderung an den sieben Kriterien des Erfüllungsgrads und an ihrer Ausgabe. `bewerte`
urteilt weiter wie bisher; nur die Herkunft der beiden Regeln ändert sich.

Kein Eingriff ins Lagebild. `ops.py` bleibt unberührt, obwohl es dieselbe Zusage liest — eine
zweite Baustelle in einer zweiten Sprache gehört nicht in diesen Change.

## Berührte Dateien

- `tools/pruefungen.mjs` — die beiden reinen Regeln: Zusage lesen, Mengen vergleichen
- `tools/erfuellung.mjs` — ruft sie von dort auf, statt sie ein zweites Mal zu führen
- `tools/abgleich.mjs` — neu: Diff beschaffen, Regeln anwenden, Bericht ausgeben
- `tools/install.mjs` — rollt alle Skills aus statt eines namentlich genannten
- `tests/pruefungen.test.mjs` — die Tests der beiden Regeln
- `tests/abgleich.test.mjs` — neu: Bericht und Exit-Code gegen ein Wegwerf-Repo
- `tests/install.test.mjs` — der Test des verallgemeinerten Ausrollens
- `.claude/skills/diff-reviewer/SKILL.md` — neu
- `docs/abgleich.svg` — neu: der Bericht dieses Changes über sich selbst, als sichtbarer Beleg
- `justfile` — nur angehängt: ein Ziel für den Abgleich
- `openspec/changes/diff-reviewer/` — die Artefakte und Nachweise dieses Changes

Nicht berührt: `ops.py`, `tools/gate.mjs`, `tools/neu.mjs`, `tools/lage.mjs`,
`tools/leitstand.mjs`, `tools/beleg.mjs`, `CLAUDE.md`.
