// Belege in der Nutzlast und ihre Auslieferung.
//
// Die sieben Szenarien der Delta-Spec `lagebild`, in derselben Reihenfolge. Geprueft
// wird gegen ein Wegwerf-Repo im Temporaerverzeichnis: nur so stehen Journalzeilen,
// Zeitpunkte und Dateien fest, und kein Aufraeumen im ops-lab kann den Lauf umwerfen.
//
// Der Trockenlauf `--web --trocken` laedt keine Fremdbibliothek. Die Regel, welche
// Adresse die Ansicht bedient, ist eine Funktion in ops.py und wird als solche
// gerufen -- ohne Server, ohne FastAPI, ohne Port.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

/** Ein gueltiges 1x1-PNG -- klein genug fuer den Test, echt genug fuer die Auslieferung. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

/** Wie im justfile: wo `uv` da ist, laeuft python3 darueber -- mit --no-sync, sonst biegt uv den Editable-Install der geteilten .venv auf diesen Worktree um (#812). */
function pythonAufruf() {
  const uv = spawnSync("uv", ["--version"], { encoding: "utf8" });
  return uv.status === 0 ? { befehl: "uv", vorab: ["run", "--no-sync", "python3"] } : { befehl: "python3", vorab: [] };
}

function ops(...argumente) {
  const { befehl, vorab } = pythonAufruf();
  const lauf = spawnSync(befehl, [...vorab, "ops.py", ...argumente],
    { cwd: WURZEL, encoding: "utf8", timeout: 120_000 });
  return { code: lauf.status, aus: lauf.stdout ?? "", fehler: lauf.stderr ?? "" };
}

/**
 * Die Auflösungsregel der Ansicht, direkt gerufen: welche Datei eine Adresse meint.
 * Gibt den Pfad zurueck oder die leere Zeichenkette, wenn die Ansicht 404 antwortet.
 */
function aufloesen(adresse) {
  const { befehl, vorab } = pythonAufruf();
  const code = [
    "import sys, pathlib",
    `sys.path.insert(0, ${JSON.stringify(WURZEL)})`,
    "import ops",
    `ziel = ops.beleg_aufloesen(pathlib.Path(${JSON.stringify(probe.wurzel)}), ${JSON.stringify(adresse)})`,
    'print(ziel if ziel else "")',
  ].join("\n");
  const lauf = spawnSync(befehl, [...vorab, "-c", code], { encoding: "utf8", timeout: 120_000 });
  assert.equal(lauf.status, 0, `python: ${lauf.stderr}`);
  return (lauf.stdout ?? "").trim();
}

/** Welchen Inhaltstyp die Ansicht zu einer Belegdatei nennt. */
function inhaltstyp(datei) {
  const { befehl, vorab } = pythonAufruf();
  const code = [
    "import sys, pathlib",
    `sys.path.insert(0, ${JSON.stringify(WURZEL)})`,
    "import ops",
    `print(ops.beleg_typ(pathlib.Path(${JSON.stringify(datei)})))`,
  ].join("\n");
  const lauf = spawnSync(befehl, [...vorab, "-c", code], { encoding: "utf8", timeout: 120_000 });
  assert.equal(lauf.status, 0, `python: ${lauf.stderr}`);
  return (lauf.stdout ?? "").trim();
}

function git(ordner, ...argumente) {
  const lauf = spawnSync("git", argumente, { cwd: ordner, encoding: "utf8" });
  if (lauf.status !== 0) throw new Error(`git ${argumente.join(" ")}: ${lauf.stderr}`);
  return lauf.stdout ?? "";
}

function schreibe(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

function legeChange(ordner, name) {
  schreibe(join(ordner, "proposal.md"), `# ${name}\n\n## Warum\n\nEine Probe.\n`);
  schreibe(join(ordner, "tasks.md"), `# Aufgaben — ${name}\n\n## Abschnitt\n\n- [ ] 1.1 Etwas tun\n`);
}

/** Eine Journalzeile in der Form, die `tools/beleg.mjs` schreibt. */
function journalzeile(zeit, stufe, art, pfad, fehlt = false, grund = "") {
  return JSON.stringify({ zeit, stufe, art, pfad, fehlt, grund });
}

/**
 * Ein Wegwerf-Repo mit vier Faellen: ein offener Change mit Journal (zwei gueltige
 * Belege, einer beim Einliefern gescheitert), ein offener Change ganz ohne Belegordner,
 * ein archivierter Change mit dem juengsten Beleg von allen -- und ein zweiter
 * Arbeitsbaum, der dieselbe Historie traegt und damit jeden Beleg ein zweites Mal.
 */
function probeRepo() {
  const huelle = mkdtempSync(join(tmpdir(), "ops-belege-"));
  const wurzel = join(huelle, "probe-repo");
  mkdirSync(wurzel, { recursive: true });

  git(wurzel, "init", "-q", "-b", "main");
  git(wurzel, "config", "user.email", "probe@ops-lab.invalid");
  git(wurzel, "config", "user.name", "Probe");
  schreibe(join(wurzel, ".gitignore"), ".claude/\n");

  const mit = join(wurzel, "openspec", "changes", "probe-mit-beleg");
  legeChange(mit, "probe-mit-beleg");
  schreibe(join(mit, "belege", "assets", "0-ansicht.png"), PNG);
  schreibe(join(mit, "belege", "artefacts", "0-lauf.log"), "Testlauf: 12 von 12 gruen\n");
  schreibe(join(mit, "belege", "belege.jsonl"), [
    journalzeile("2026-01-02T10:00:00.000Z", "nachher", "bild", "belege/assets/0-ansicht.png"),
    journalzeile("2026-01-02T09:00:00.000Z", "vorher", "ausgabe", "belege/artefacts/0-lauf.log"),
    journalzeile("2026-01-02T08:00:00.000Z", "nachher", "bild", "belege/assets/1-weg.png",
      true, "Datei fehlt"),
  ].join("\n") + "\n");

  const ohne = join(wurzel, "openspec", "changes", "probe-ohne-beleg");
  legeChange(ohne, "probe-ohne-beleg");

  const archiv = join(wurzel, "openspec", "changes", "archive", "2026-01-01-probe-archiv");
  legeChange(archiv, "2026-01-01-probe-archiv");
  schreibe(join(archiv, "belege", "artefacts", "0-plan.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>\n");
  schreibe(join(archiv, "belege", "belege.jsonl"),
    journalzeile("2026-01-03T11:00:00.000Z", "vorher", "graph", "belege/artefacts/0-plan.svg") + "\n");

  git(wurzel, "add", "-A");
  git(wurzel, "commit", "-qm", "Probe: Belege");

  // Ein zweiter Arbeitsbaum aus demselben Commit: er traegt dieselben Changes und
  // dasselbe Archiv. Jeder Beleg liegt damit zweimal auf der Platte -- und muss
  // trotzdem einmal in der Nutzlast stehen.
  git(wurzel, "worktree", "add", "-q", join(wurzel, ".claude", "worktrees", "probe-zwilling"),
    "-b", "change/probe-zwilling");

  return { wurzel, ohne, aufraeumen: () => rmSync(huelle, { recursive: true, force: true }) };
}

let probe;
let nutzlast;

before(() => {
  probe = probeRepo();
  const lauf = ops("--root", probe.wurzel, "--web", "--trocken");
  assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  nutzlast = JSON.parse(lauf.aus);
});

after(() => probe?.aufraeumen());

function change(name) {
  return nutzlast.changes.find((ch) => ch.name === name);
}

describe("Die Nutzlast fuehrt die Belege eines Changes", () => {
  it("nennt Stufe, Art, Zeitpunkt und Adresse eines eingelieferten Belegs", () => {
    const belege = change("probe-mit-beleg").belege;
    const bild = belege.find((b) => b.stufe === "nachher");
    assert.ok(bild, "der Beleg der Stufe nachher fehlt");
    assert.equal(bild.art, "bild");
    assert.equal(bild.zeit, "2026-01-02T10:00:00.000Z");
    assert.ok(bild.adresse.endsWith("belege/assets/0-ansicht.png"),
      `unerwartete Adresse: ${bild.adresse}`);
  });

  it("haelt die Liste leer, wo kein Belegordner liegt, und legt nichts an", () => {
    assert.deepEqual(change("probe-ohne-beleg").belege, []);
    assert.deepEqual(readdirSync(probe.ohne).sort(), ["proposal.md", "tasks.md"],
      "im Change-Ordner wurde etwas angelegt");
  });

  it("laesst weg, was das Journal als fehlend vermerkt hat", () => {
    const pfade = change("probe-mit-beleg").belege.map((b) => b.adresse);
    assert.equal(pfade.filter((p) => p.includes("1-weg.png")).length, 0,
      "ein beim Einliefern gescheiterter Beleg steht in der Nutzlast");
    assert.equal(change("probe-mit-beleg").belege.length, 2);
  });
});

describe("Die Sektion belege fasst alle Changes zusammen", () => {
  it("fuehrt auch den Beleg eines archivierten Changes", () => {
    const ausArchiv = nutzlast.belege.find((b) => b.change === "2026-01-01-probe-archiv");
    assert.ok(ausArchiv, "der Beleg aus dem Archiv fehlt in der Sektion");
    assert.equal(ausArchiv.archiviert, true);
    assert.equal(ausArchiv.art, "graph");
  });

  it("stellt den juengsten Beleg nach vorn", () => {
    const zeiten = nutzlast.belege.map((b) => b.zeit);
    assert.deepEqual(zeiten, [...zeiten].sort().reverse(), "die Sektion ist nicht absteigend");
    assert.equal(nutzlast.belege[0].change, "2026-01-01-probe-archiv");
    assert.equal(nutzlast.belege.length, 3, "drei gueltige Belege erwartet");
  });

  it("nennt einen Beleg aus zwei Arbeitsbaeumen nur einmal", () => {
    const adressen = nutzlast.belege.map((b) => b.adresse);
    assert.deepEqual([...new Set(adressen)].length, adressen.length, "eine Adresse doppelt");
    assert.deepEqual(nutzlast.belege.map((b) => b.worktree), ["probe-repo", "probe-repo",
      "probe-repo"], "genannt wird ein anderer Baum als der, aus dem gestartet wurde");
  });
});

describe("Die Ansicht liefert Belege lesend aus", () => {
  it("findet die Datei zu einer erhobenen Adresse", () => {
    const bild = nutzlast.belege.find((b) => b.adresse.endsWith("0-ansicht.png"));
    const ziel = aufloesen(bild.adresse);
    assert.ok(ziel.length > 0, "die Adresse wurde nicht aufgeloest");
    assert.deepEqual(readFileSync(ziel), PNG, "ausgeliefert wurde eine andere Datei");
  });

  it("antwortet nicht auf eine Adresse, die aus den Belegordnern fuehrt", () => {
    const hinaus = "/beleg/probe-repo/openspec/changes/probe-mit-beleg/belege/../../../../.gitignore";
    assert.equal(aufloesen(hinaus), "", "eine Adresse ausserhalb der Belege wurde bedient");
    assert.equal(aufloesen("/beleg/probe-repo/ops.py"), "", "eine fremde Datei wurde bedient");
  });
});

describe("Die Ansicht bestimmt den Inhaltstyp selbst", () => {
  it("nennt einen Graphen in der Form .dot als Text", () => {
    const typ = inhaltstyp("belege/artefacts/0-plan.dot");
    assert.match(typ, /^text\//, `Inhaltstyp ist kein Texttyp: ${typ}`);
    assert.ok(!typ.includes("msword"),
      "der Graph wird als Textverarbeitungsdokument ausgeliefert");
  });

  it("laesst einem Bild seinen Typ", () => {
    assert.match(inhaltstyp("belege/assets/0-ansicht.png"), /^image\/png/);
    assert.match(inhaltstyp("belege/artefacts/0-plan.svg"), /^image\/svg\+xml/);
  });

  it("faellt auf Text zurueck, wo die Standardbibliothek nichts weiss", () => {
    assert.match(inhaltstyp("belege/belege.jsonl"), /^text\//);
    assert.match(inhaltstyp("belege/artefacts/0-ohne-endung"), /^text\//);
  });
});
