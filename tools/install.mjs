#!/usr/bin/env node
// Rollt den Ablauf in zwei Stufen aus: einmal global, einmal je Projekt.
//
// Stufe 1 schreibt Skill und Arbeiterbeschreibung in den Konfigurationsordner
// von Claude Code und legt dort zugleich einen Vorrat an -- den Installer selbst
// samt allem, was seine zweite Stufe ausrollt. Der Vorrat spiegelt den Aufbau
// dieses Repos, deshalb laeuft derselbe Code aus dem Vorrat heraus unveraendert
// weiter: seine Quelle ist immer der Ordner ueber ihm. Damit braucht Stufe 2
// dieses Repo nicht mehr.
//
// Stufe 2 schreibt Werkzeuge, Lagebild, openspec-Geruest und Tests in ein
// Projekt und haengt die Rezepte des Ablaufs in einen markierten Block ans Ende
// seines justfile. Ein erneuter Lauf tauscht genau diesen Block aus.
//
// Die CLAUDE.md des Projekts bleibt unangetastet. Sie traegt dessen Ton und
// dessen Regeln; ein Werkzeug, das dort schreibt, ueberschreibt fremde
// Entscheidungen. Der Installer gibt stattdessen einen Uebergabetext aus.
//
//   node tools/install.mjs [zielprojekt]

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, "..");

/** Der Ordner im Konfigurationsordner, den der Installer allein verwaltet. */
const VORRAT = "ops-lab";

// sync.mjs rollt ins Testrepo aus, install.mjs rollt ueberhaupt erst aus --
// beide sind Sache des Ursprungs und haben in einem Projekt nichts zu suchen.
const NUR_IM_URSPRUNG = new Set(["sync.mjs", "install.mjs"]);

const ANFANG = "# >>> ops-lab";
const SCHLUSS = "# <<< ops-lab";

// --- Orte -------------------------------------------------------------------

/**
 * Wo Claude Code seine Konfiguration fuehrt.
 *
 * Aus der Umgebung, nicht aus dem Code: der Ort ist verschiebbar, und ein
 * ausgeschriebener Pfad wuerde bei jedem anderen Menschen ins Leere zeigen.
 */
function konfigurationsordner() {
  const ausUmgebung = process.env.CLAUDE_CONFIG_DIR?.trim();
  return ausUmgebung ? resolve(ausUmgebung) : join(homedir(), ".claude");
}

// --- Handgriffe -------------------------------------------------------------

function kopiere(von, nach) {
  mkdirSync(dirname(nach), { recursive: true });
  cpSync(von, nach, { recursive: true });
}

/**
 * Ein Ziel restlos durch die Quelle ersetzen.
 *
 * Erst entfernen, dann kopieren: sonst bliebe liegen, was eine aeltere Fassung
 * mitgebracht und die neue nicht mehr hat. Ersetzt werden ausschliesslich Orte,
 * die der Installer selbst angelegt hat.
 */
function ersetze(von, nach) {
  rmSync(nach, { recursive: true, force: true });
  kopiere(von, nach);
}

function schreibeWennFehlt(pfad, inhalt) {
  if (existsSync(pfad)) return false;
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt, "utf8");
  return true;
}

/** Die Node-Werkzeuge der Quelle. Ohne die, die dem Ursprung gehoeren. */
function werkzeuge({ vollstaendig = false } = {}) {
  const ordner = join(QUELLE, "tools");
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner)
    .filter((d) => d.endsWith(".mjs"))
    .filter((d) => vollstaendig ? d !== "sync.mjs" : !NUR_IM_URSPRUNG.has(d))
    .sort();
}

/**
 * Die Skills der Quelle -- gelesen, nicht aufgezaehlt.
 *
 * Ein Name im Code waere dieselbe Arbeit noch einmal, jedes Mal, wenn ein Skill
 * dazukommt, und der Skill, den jemand zu ergaenzen vergisst, fehlt still. Was
 * unter .claude/skills/ liegt, ist die Definition davon, welche es gibt.
 */
function skills() {
  const ordner = join(QUELLE, ".claude", "skills");
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

function testdateien() {
  const ordner = join(QUELLE, "tests");
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner).filter((d) => d.endsWith(".test.mjs")).sort();
}

// --- Der Markierblock im justfile -------------------------------------------

/**
 * Den Block in ein vorhandenes justfile setzen oder ihn ersetzen.
 *
 * Reine Textfunktion, damit die Zusage pruefbar bleibt: ausserhalb der beiden
 * Markierungen wird nichts angefasst, und der Block kommt genau einmal vor.
 */
export function setzeBlock(vorhanden, rezepte) {
  const block = `${ANFANG}\n${rezepte.trim()}\n${SCHLUSS}\n`;
  const anfang = vorhanden.indexOf(ANFANG);
  const schluss = vorhanden.indexOf(SCHLUSS);

  if (anfang >= 0 && schluss > anfang) {
    const davor = vorhanden.slice(0, anfang);
    const danach = vorhanden.slice(schluss + SCHLUSS.length).replace(/^\r?\n/, "");
    return `${davor}${block}${danach}`;
  }

  const rumpf = vorhanden.trim();
  return rumpf ? `${rumpf}\n\n${block}` : block;
}

// --- Stufe 1: der Konfigurationsordner --------------------------------------

function stufe1(konfig) {
  const meldungen = [];

  // Je Skill ersetzt, nicht der ganze Ordner: unter skills/ liegen auch die
  // eigenen Skills der Person, und die gehoeren nicht dem Installer.
  for (const name of skills()) {
    ersetze(join(QUELLE, ".claude", "skills", name), join(konfig, "skills", name));
  }
  meldungen.push(`skills/ — ${skills().join(", ") || "keiner"}`);

  ersetze(
    join(QUELLE, ".claude", "agents", "change-arbeiter.md"),
    join(konfig, "agents", "change-arbeiter.md"),
  );
  meldungen.push("agents/change-arbeiter.md");

  const vorrat = join(konfig, VORRAT);

  // Laeuft der Installer bereits aus dem Vorrat, sind Quelle und Ziel dieselbe
  // Stelle. Sie zu ersetzen hiesse, sich selbst zu entfernen und danach aus dem
  // Nichts zu kopieren.
  if (resolve(vorrat) === QUELLE) {
    meldungen.push(`${VORRAT}/ — unveraendert, der Installer laeuft schon von dort`);
    return { vorrat, meldungen };
  }

  rmSync(vorrat, { recursive: true, force: true });
  for (const name of werkzeuge({ vollstaendig: true })) {
    kopiere(join(QUELLE, "tools", name), join(vorrat, "tools", name));
  }
  kopiere(join(QUELLE, "ops.py"), join(vorrat, "ops.py"));
  for (const name of testdateien()) {
    kopiere(join(QUELLE, "tests", name), join(vorrat, "tests", name));
  }
  for (const name of skills()) {
    kopiere(join(QUELLE, ".claude", "skills", name), join(vorrat, ".claude", "skills", name));
  }
  kopiere(
    join(QUELLE, ".claude", "agents", "change-arbeiter.md"),
    join(vorrat, ".claude", "agents", "change-arbeiter.md"),
  );
  meldungen.push(`${VORRAT}/ — Installer, Werkzeuge, Lagebild, Tests`);

  return { vorrat, meldungen };
}

// --- Stufe 2: das Projekt ---------------------------------------------------

function stufe2(ziel) {
  const meldungen = [];

  for (const name of werkzeuge()) kopiere(join(QUELLE, "tools", name), join(ziel, "tools", name));
  kopiere(join(QUELLE, "ops.py"), join(ziel, "ops.py"));
  meldungen.push(`tools/ — ${werkzeuge().length} Werkzeuge, dazu ops.py`);

  const tests = testdateien();
  for (const name of tests) kopiere(join(QUELLE, "tests", name), join(ziel, "tests", name));
  meldungen.push(`tests/ — ${tests.length} Testdateien`);

  schreibeWennFehlt(join(ziel, "openspec", "changes", ".gitkeep"), "");
  schreibeWennFehlt(join(ziel, "openspec", "specs", ".gitkeep"), "");
  const neueConfig = schreibeWennFehlt(join(ziel, "openspec", "config.yaml"), CONFIG_VORLAGE);
  meldungen.push(
    `openspec/ — Geruest${neueConfig ? " samt config.yaml" : ", die vorhandene config.yaml blieb stehen"}`,
  );

  const justfile = join(ziel, "justfile");
  const vorhanden = existsSync(justfile) ? readFileSync(justfile, "utf8") : "";
  writeFileSync(justfile, setzeBlock(vorhanden, REZEPTE), "utf8");
  meldungen.push(`justfile — Block zwischen ${ANFANG} und ${SCHLUSS} ${vorhanden ? "ersetzt" : "angelegt"}`);

  return meldungen;
}

// --- Vorlagen ---------------------------------------------------------------

const CONFIG_VORLAGE = `schema: spec-driven

context: |
  Hier steht, was ein Mensch ueber dieses Projekt wissen muss, bevor er eine Spec
  liest: Fachlichkeit, Technik, Ablauf. Der Text wandert in jeden Kontext, in dem
  eine Spec geprueft wird -- er ersetzt kein README, aber er beantwortet die
  Fragen, die sonst jedes Mal neu gestellt werden.

rules:
  proposal:
    - Der Abschnitt Warum umfasst fuenf bis zehn Saetze und nennt keine Loesung.
    - Der Abschnitt Beruehrte Dateien listet jede Datei, die der Change anfasst.
      Diese Liste ist die Zusage fuer den Parallelbetrieb und wird eingehalten.
    - Der Abschnitt Was ausdruecklich nicht haelt den Change klein.
  spec:
    - Jedes Requirement hat mindestens ein Scenario in Given/When/Then.
    - Ein Requirement beschreibt beobachtbares Verhalten, keine Implementierung.
    - Jedes Requirement nutzt SHALL, nicht SOLL. OpenSpec prueft auf RFC-2119.
  tasks:
    - Jede Testdatei steht als Pfad in Backticks. Gate 1 und Gate 2 lesen genau
      diese Pfade.
    - Die erste Aufgabe schreibt den Test, nicht die Umsetzung.
    - Hoechstens acht Aufgaben. Mehr heisst, der Change ist zu gross geschnitten.
  design:
    - Nur anlegen, wenn eine Entscheidung zwischen echten Alternativen ansteht.
    - Jede Alternative mit Tradeoff und Begruendung der Wahl.

operations:
  apply:
    guidance:
      - Nach jeder abgeschlossenen Aufgabe die Checkbox in tasks.md setzen.
      - Keine Datei anfassen, die nicht unter Beruehrte Dateien steht.
  archive:
    guidance:
      - Erst nach dem Merge des PR archivieren.
      - gate1.md, gate2.md und fertig.md wandern mit ins Archiv; sie sind der
        Nachweis, dass der Ablauf gehalten hat.
`;

const REZEPTE = `# Von 'node tools/install.mjs' geschrieben. Aenderungen in diesem Block gehen
# beim naechsten Lauf verloren -- eigene Rezepte gehoeren ausserhalb der Markierungen.

# ops.py braucht nur die Standardbibliothek. Wo 'uv' da ist, laeuft es darueber --
# manche Umgebungen lassen einen nackten python3-Aufruf nicht zu.
py := \`command -v uv >/dev/null 2>&1 && echo "uv run python3" || echo "python3"\`

# Change anlegen: Arbeitsraum, Branch, Ordner, drei Artefakte
neu id capability issue="":
    @node tools/neu.mjs {{id}} {{capability}} {{ if issue == "" { "" } else { "--issue " + issue } }}

# Gate 1 — der Plan ist vollstaendig und pruefbar
gate1 id:
    @node tools/gate.mjs gate1 {{id}}

# Gate 2 — die Tests existieren und sind rot
gate2 id basis="main":
    @node tools/gate.mjs gate2 {{id}} --basis={{basis}}

# Abschluss — die Tests sind gruen und die Aufgaben abgehakt
fertig id:
    @node tools/gate.mjs fertig {{id}}

# Beleg einliefern: Bild oder Artefakt als Nachweis an den Change haengen
beleg id stufe pfad:
    @node tools/beleg.mjs openspec/changes/{{id}} {{stufe}} {{pfad}}

# Zusage aus dem Vorschlag gegen den Diff halten. Kein Gate: berichtet, blockiert nicht.
abgleich id basis="main":
    @node tools/abgleich.mjs {{id}} --basis={{basis}}

# Pull Request gegen main stellen (setzt 'just fertig' voraus)
pr id:
    @test -f openspec/changes/{{id}}/fertig.md || (echo "Kein fertig.md — erst 'just fertig {{id}}'." && exit 1)
    git push -u origin change/{{id}}
    gh pr create --base main --head change/{{id}} --fill

# Pull Request mergen
merge nummer:
    @gh pr merge {{nummer}} --merge --admin

# Change nach dem Merge ins Archiv ueberfuehren
archiv id:
    openspec archive {{id}} --yes
    @just validate

# Syntaxpruefung aller Node-Skripte
lint:
    @for f in tools/*.mjs tests/*.test.mjs; do node --check "$f" || exit 1; done
    @echo "lint: alle Skripte syntaktisch in Ordnung"

# Testlauf (Fachtests und Selbsttest des Lagebilds)
test:
    @node --test --test-reporter=spec "tests/*.test.mjs"
    @{{py}} ops.py --selftest

# Alle Changes gegen das OpenSpec-Schema pruefen
validate:
    @openspec validate --all --strict

# Lint, Tests und Schemapruefung in einem
alles: lint test validate

# Lagebild: Stand, Fortschritt, naechste freie Changes, Verbindungen
ops:
    @{{py}} ops.py --once --graph

# Stand des Repos als JSON: zuletzt fertig, aktiv, frei, blockiert, verwaist, Ideen
lage:
    @node tools/lage.mjs --json

# Derselbe Stand als eine Zeile
lage-kurz:
    @node tools/lage.mjs --kurz`;

/**
 * Der Uebergabetext.
 *
 * Er geht nach stdout und ist als Auftrag an ein Sprachmodell geschrieben, nicht
 * als Merkzettel fuer einen Menschen: wer ihn unveraendert weiterreicht,
 * bekommt den Ablauf in Ton und Technik des Zielprojekts eingearbeitet, statt
 * einen Fremdkoerper hineinkopiert.
 */
const UEBERGABE = `Auftrag: Arbeiten Sie die folgende Standardvorgehensweise in die CLAUDE.md dieses
Projekts ein. Passen Sie Wortwahl, Technik und Beispiele an das an, was Sie im Projekt
vorfinden — Sprache, Testrahmen, Paketmanager, Verzeichnisaufbau. Uebernehmen Sie die
Regeln inhaltlich unveraendert, aber schreiben Sie sie so, als haetten sie von Anfang an
in dieser Datei gestanden. Legen Sie die Datei an, falls es sie nicht gibt.

--- Standardvorgehensweise ---

Jede Aenderung laeuft als Change durch dieselbe Kette: anlegen, Plan schreiben, Gate 1,
roten Test schreiben, Gate 2, umsetzen, Beleg, Abschluss, Pull Request, Merge, Archiv.

Die Gates sind Befehle mit Exit-Code, keine Bestaetigungen. Kein Gate fragt einen
Menschen, keines laesst sich ueberspringen, ein rotes Gate schreibt keine Datei.

  Gate 1 — der Plan. Vorschlag, Delta-Spec und Aufgabenliste sind vollstaendig und
  frei von Platzhaltern; jedes Requirement hat ein Szenario; die Aufgabenliste nennt
  die Testdateien als Pfad. Aufruf: just gate1 KENNUNG

  Gate 2 — der rote Test. Die zugesagten Testdateien existieren, mindestens eine ist
  neu oder geaendert, und der Testlauf schlaegt fehl. Wird er hier gruen, prueft der
  Test nichts — dann wird angehalten, nicht die Erwartung abgeschwaecht.
  Aufruf: just gate2 KENNUNG

  Abschluss — gruen. Beide Gates liegen vor, keine Aufgabe ist offen, der Testlauf ist
  gruen, und ein sichtbarer Beleg der Stufe nachher ist eingeliefert.
  Aufruf: just fertig KENNUNG

Zwischen Gate 1 und Gate 2 wird ausschliesslich der Test geschrieben: keine
Implementierung, keine Hilfsfunktion, kein vorgezogener Handgriff.

Jeder Change hat seinen eigenen Arbeitsraum. 'just neu' wechselt den Branch des
Hauptordners nicht, sondern legt unter .claude/worktrees/KENNUNG ein eigenes
git-Arbeitsverzeichnis an und checkt change/KENNUNG dort aus. Gearbeitet wird dort.
Arbeitsraeume werden nicht automatisch entfernt: sie tragen alles, was nicht committet
wurde. Aufraeumen ist ein bewusster Handgriff.

Zwei Changes laufen nur parallel, wenn ihre Dateimengen disjunkt sind. Die Liste der
beruehrten Dateien im Vorschlag ist die Zusage dafuer und wird eingehalten. Das justfile
ist die benannte Ausnahme: dort darf ein Change anhaengen, aber keine Zeile entfernen
oder aendern.

Gemergt wird nicht nebenbei. Kein Push und kein Merge ohne ausdrueckliche Anweisung —
mit einer benannten Ausnahme: liegen gate1.md, gate2.md und fertig.md im Change und hat
der Pull Request seine Pruefungen bestanden, wird ohne weitere Rueckfrage gemergt.
Meldet der Pull Request keine Pruefungen, tritt ein gruener Lauf von 'just alles' an
ihre Stelle. Ein unbekannter Zustand gilt nicht als bestanden.

Geloescht wird nichts: Changes werden nach dem Merge archiviert, nicht entfernt.

Neues Verhalten und Bugfixes kommen mit Tests; ein Bugfix beginnt mit dem
Regressionstest. Tests werden nicht abgeschwaecht, geskippt oder geloescht, um gruen zu
werden.

--- Ende der Standardvorgehensweise ---`;

// --- Einstieg ---------------------------------------------------------------

const [zielArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ziel = resolve(zielArg ?? process.cwd());
const konfig = konfigurationsordner();

console.log(`\nStufe 1 — global: ${konfig}\n`);
for (const zeile of stufe1(konfig).meldungen) console.log(`  ${zeile}`);

console.log(`\nStufe 2 — Projekt: ${ziel}\n`);
if (ziel === QUELLE) {
  console.log("  uebersprungen: Ziel und Quelle sind derselbe Ordner.");
} else {
  for (const zeile of stufe2(ziel)) console.log(`  ${zeile}`);
}

console.log(`\nDie CLAUDE.md wurde nicht angefasst. Reichen Sie den folgenden Text weiter:\n`);
console.log(UEBERGABE);
console.log("");
