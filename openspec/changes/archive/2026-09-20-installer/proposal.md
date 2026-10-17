# installer

## Warum

Der Ablauf dieses Labors — Gates, Arbeitsräume, Leitstand, Arbeiter — ist inzwischen so weit
gediehen, dass er auch außerhalb von ops-lab trägt. Er liegt aber ausschließlich hier. Wer ihn
in einem anderen Projekt haben will, kopiert heute von Hand: die Werkzeuge unter `tools/`, das
Lagebild, die Gate-Tests, das Gerüst unter `openspec/`, dazu die Rezepte im `justfile` und die
Beschreibungen von Skill und Arbeiter unter `.claude/`.

Das ist nicht nur mühsam, es ist auch unzuverlässig. Eine solche Kopie ist nach zwei Wochen
veraltet, und niemand weiß mehr, welche Fassung in welchem Projekt liegt. Ein zweiter Durchgang
verschlimmert es: wer die Rezepte erneut an ein `justfile` hängt, hat sie danach doppelt, und
just quittiert doppelte Ziele mit einem Fehler. Für den globalen Teil gilt dasselbe in
schärferer Form, denn Skill und Agent gehören nach `~/.claude` und damit an eine Stelle, die
allen Projekten gemeinsam ist.

Ein Fund kommt hinzu, der diesen Schritt bisher ohnehin verhindert. Die Beschreibung des
Leitstands nennt den Pfad dieses Repos mehrfach ausgeschrieben. Global installiert würde der
Skill damit aus jedem fremden Projekt heraus auf ops-lab zeigen und dort Befehle ausführen —
eine Lage, die niemand bemerkt, bis der erste Commit an der falschen Stelle landet.

Was fehlt, ist kein weiteres Werkzeug im Ablauf. Es fehlt der Weg vom Labor in ein Projekt,
und zwar einer, der ein zweites Mal genauso ausgeht wie beim ersten Mal.

## Was aendert sich

Nach diesem Change trägt ein Befehl den Ablauf in ein Projekt. Er arbeitet in zwei Stufen.

Die erste Stufe ist einmalig und gilt allen Projekten: Skill und Arbeiterbeschreibung landen im
Konfigurationsordner von Claude Code, dessen Ort aus der Umgebung stammt und nicht im Code
steht. Der Installer legt sich dort zusammen mit den Dateien ab, die er ausrollt — damit läuft
die zweite Stufe später in einem beliebigen Projekt, ohne dass ops-lab daneben liegen muss.
Liegt schon eine Fassung dort, wird sie ersetzt. Ein zweiter Lauf stellt denselben Zustand her
wie der erste.

Die zweite Stufe gilt einem Projekt: Werkzeuge, Lagebild, Gate-Tests und das Gerüst unter
`openspec/` entstehen dort, und die Rezepte des Ablaufs kommen in einen eigens markierten Block
am Ende des `justfile`. Ein erneuter Lauf tauscht genau diesen Block aus; was das Projekt selbst
an Rezepten führt, bleibt unberührt. Gibt es kein `justfile`, entsteht eines mit diesem Block.

Die `CLAUDE.md` des Projekts fasst der Installer nicht an. Er gibt stattdessen einen Text aus,
der die Standardvorgehensweise als Auftrag an ein Sprachmodell formuliert. Wer ihn unverändert
weiterreicht, bekommt sie in der Sprache und im Ton des Zielprojekts eingearbeitet, statt einen
Fremdkörper hineinkopiert.

Der Leitstand-Skill nennt danach keinen ausgeschriebenen Pfad mehr. Seine Projektwurzel ist das
Arbeitsverzeichnis, in dem er gerufen wurde.

## Was ausdruecklich nicht

Keine Deinstallation und kein Rückbau. Was der Installer schreibt, bleibt stehen, bis jemand es
von Hand entfernt.

Kein Anfassen der `CLAUDE.md` im Zielprojekt. Sie trägt den Ton und die Regeln des Projekts;
ein Werkzeug, das dort schreibt, überschreibt fremde Entscheidungen. Der Installer liefert Text
und keine Datei.

Keine Versionsprüfung, kein Abgleich von Fassungen, keine Rückfrage vor dem Ersetzen. Die
Zusage ist Idempotenz, nicht Verhandlung.

Keine Änderung an `tools/sync.mjs`. Das Ausrollen ins Testrepo bleibt, wie es ist; der
Installer ist ein zweiter Weg, kein Ersatz.

Keine Änderung an den Gates, an `ops.py` und an `tools/neu.mjs`.

Am Leitstand-Skill wird ausschließlich der ausgeschriebene Pfad behandelt. Sein Ablauf, seine
Schritte und seine Grenzen bleiben Wort für Wort stehen.

## Beruehrte Dateien

- `tools/install.mjs` — neu
- `tests/install.test.mjs` — neu
- `.claude/skills/leitstand/SKILL.md` — der ausgeschriebene Pfad weicht dem Arbeitsverzeichnis
- `justfile` — das Ziel `install` wird angehängt
- `openspec/changes/installer/proposal.md` — dieser Vorschlag
- `openspec/changes/installer/specs/installation/spec.md` — die Delta-Spec
- `openspec/changes/installer/tasks.md` — die Aufgaben
