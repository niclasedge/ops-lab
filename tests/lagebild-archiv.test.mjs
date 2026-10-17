// Archivierte Changes in der Nutzlast der Web-Ansicht.
//
// Die vier Szenarien der Delta-Spec `lagebild`, in derselben Reihenfolge. Geprueft wird
// gegen ein Wegwerf-Repo im Temporaerverzeichnis: nur so stehen Archivordner, Haken und
// Journalzeilen fest, und kein Archivieren im ops-lab kann den Lauf umwerfen.
//
// Der Trockenlauf `--web --trocken` laedt keine Fremdbibliothek: geprueft wird die
// Erhebung, nicht der Server.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

/** Ein gueltiges 1x1-PNG -- klein genug fuer den Test, echt genug fuer die Ansicht. */
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

function git(ordner, ...argumente) {
  const lauf = spawnSync("git", argumente, { cwd: ordner, encoding: "utf8" });
  if (lauf.status !== 0) throw new Error(`git ${argumente.join(" ")}: ${lauf.stderr}`);
  return lauf.stdout ?? "";
}

function schreibe(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

/** Eine Aufgabenliste in der Form, die `tools/neu.mjs` anlegt. */
function aufgabenliste(name, aufgaben) {
  const zeilen = aufgaben.map(([nummer, text, erledigt]) =>
    `- [${erledigt ? "x" : " "}] ${nummer} ${text}`);
  return `# Aufgaben — ${name}\n\n## Abschnitt\n\n${zeilen.join("\n")}\n`;
}

/** Eine Journalzeile in der Form, die `tools/beleg.mjs` schreibt. */
function journalzeile(zeit, stufe, art, pfad) {
  return JSON.stringify({ zeit, stufe, art, pfad, fehlt: false, grund: "" });
}

/** Ein Gate-Nachweis in der Form, die `tools/gate.mjs` schreibt. */
function nachweis(titel, name, zeit) {
  return `# ${titel} — ${name}\n\n- Datum: ${zeit}\n- Person: probe\n\n`
    + "| Pruefung | Ergebnis |\n|---|---|\n| P-1 | bestanden |\n";
}

/**
 * Ein Wegwerf-Repo mit einem laufenden Change und sechs archivierten: einer mit voller
 * Liste und zwei Belegen, einer mit einem Beleg, den man nicht zeigen kann, einer ganz
 * ohne `tasks.md` und Nachweis, zwei vom selben Tag, deren Uhrzeit der alphabetischen
 * Ordnung widerspricht, und einer, der es nur bis `gate1.md` gebracht hat -- dazu ein
 * zweiter Arbeitsbaum, der dieselbe Historie und damit dasselbe Archiv traegt.
 */
function probeRepo() {
  const huelle = mkdtempSync(join(tmpdir(), "ops-archiv-"));
  const wurzel = join(huelle, "probe-repo");
  mkdirSync(wurzel, { recursive: true });

  git(wurzel, "init", "-q", "-b", "main");
  git(wurzel, "config", "user.email", "probe@ops-lab.invalid");
  git(wurzel, "config", "user.name", "Probe");
  schreibe(join(wurzel, ".gitignore"), ".claude/\n");

  const laeuft = join(wurzel, "openspec", "changes", "probe-laeuft");
  schreibe(join(laeuft, "proposal.md"), "# probe-laeuft\n\n## Warum\n\nEine Probe.\n");
  schreibe(join(laeuft, "tasks.md"), aufgabenliste("probe-laeuft", [
    ["1.1", "Etwas tun", true],
    ["1.2", "Etwas anderes tun", false],
  ]));

  const fertig = join(wurzel, "openspec", "changes", "archive", "2026-01-01-probe-fertig");
  schreibe(join(fertig, "proposal.md"), "# probe-fertig\n\n## Warum\n\nEine Probe.\n");
  schreibe(join(fertig, "tasks.md"), aufgabenliste("probe-fertig", [
    ["1.1", "Den roten Test schreiben", true],
    ["2.1", "Die Umsetzung nachziehen", true],
  ]));
  // Zwei darstellbare Belege, der aeltere `vorher`, der juengere `nachher` -- die
  // Vorschau muss den zweiten nehmen, nicht den ersten der Liste.
  schreibe(join(fertig, "belege", "assets", "0-ansicht.png"), PNG);
  schreibe(join(fertig, "belege", "artefacts", "0-plan.svg"),
    "<svg xmlns='http://www.w3.org/2000/svg'/>\n");
  schreibe(join(fertig, "belege", "belege.jsonl"), [
    journalzeile("2026-01-01T12:00:00.000Z", "nachher", "bild", "belege/assets/0-ansicht.png"),
    journalzeile("2026-01-01T09:00:00.000Z", "vorher", "graph", "belege/artefacts/0-plan.svg"),
  ].join("\n") + "\n");
  schreibe(join(fertig, "fertig.md"),
    nachweis("Abschluss", "probe-fertig", "2026-01-01T13:30:00.000Z"));

  const kahl = join(wurzel, "openspec", "changes", "archive", "2026-02-02-probe-kahl");
  schreibe(join(kahl, "proposal.md"), "# probe-kahl\n\n## Warum\n\nEine Probe ohne Aufgaben.\n");

  // Ein Change, dessen einziger Beleg sich nicht betrachten laesst: ein Graph in der
  // Form `.dot` ist Text.
  const stumm = join(wurzel, "openspec", "changes", "archive", "2026-01-05-probe-stumm");
  schreibe(join(stumm, "proposal.md"), "# probe-stumm\n\n## Warum\n\nEine Probe ohne Bild.\n");
  schreibe(join(stumm, "tasks.md"), aufgabenliste("probe-stumm", [["1.1", "Eins", true]]));
  schreibe(join(stumm, "belege", "artefacts", "0-graph.dot"), "digraph { a -> b }\n");
  schreibe(join(stumm, "belege", "belege.jsonl"),
    journalzeile("2026-01-05T10:00:00.000Z", "nachher", "graph", "belege/artefacts/0-graph.dot") + "\n");
  schreibe(join(stumm, "fertig.md"),
    nachweis("Abschluss", "probe-stumm", "2026-01-05T11:00:00.000Z"));

  // Zwei Laeufe desselben Tages, deren Reihenfolge der alphabetischen widerspricht:
  // `aaa` steht im Namen vorn und wurde zuletzt fertig. Sortiert der Ordnername, steht
  // `bbb` oben -- sortiert die Uhrzeit, steht `aaa` oben.
  const archiv = join(wurzel, "openspec", "changes", "archive");
  for (const [kennung, zeit] of [["aaa", "20:00:00"], ["bbb", "08:00:00"]]) {
    const ordner = join(archiv, `2026-03-03-probe-${kennung}`);
    schreibe(join(ordner, "proposal.md"), `# probe-${kennung}\n\n## Warum\n\nEine Probe.\n`);
    schreibe(join(ordner, "tasks.md"), aufgabenliste(`probe-${kennung}`, [["1.1", "Eins", true]]));
    schreibe(join(ordner, "fertig.md"),
      nachweis("Abschluss", `probe-${kennung}`, `2026-03-03T${zeit}.000Z`));
  }

  // Ein Lauf, der es nicht bis zum Abschluss gebracht hat: sein Zeitpunkt steht in
  // `gate1.md`.
  const halb = join(archiv, "2026-03-04-probe-halb");
  schreibe(join(halb, "proposal.md"), "# probe-halb\n\n## Warum\n\nEine Probe.\n");
  schreibe(join(halb, "gate1.md"), nachweis("Gate 1", "probe-halb", "2026-03-04T07:00:00.000Z"));

  git(wurzel, "add", "-A");
  git(wurzel, "commit", "-qm", "Probe: Archiv");

  // Derselbe Commit ein zweites Mal auf der Platte. Das Archiv liegt damit doppelt --
  // und muss trotzdem einmal in der Nutzlast stehen.
  git(wurzel, "worktree", "add", "-q", join(wurzel, ".claude", "worktrees", "probe-zwilling"),
    "-b", "change/probe-zwilling");

  return { wurzel, aufraeumen: () => rmSync(huelle, { recursive: true, force: true }) };
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

function archiviert(name) {
  return nutzlast.archiv.find((eintrag) => eintrag.name === name);
}

describe("Die Nutzlast fuehrt die archivierten Changes", () => {
  it("nennt Kennung, Datum und Aufgabenstand", () => {
    const eintrag = archiviert("2026-01-01-probe-fertig");
    assert.ok(eintrag, "der archivierte Change fehlt in der Liste");
    assert.equal(eintrag.kennung, "probe-fertig");
    assert.equal(eintrag.datum, "2026-01-01");
    assert.equal(eintrag.erledigt, 2);
    assert.equal(eintrag.gesamt, 2);
    assert.equal(eintrag.status, "fertig");
  });

  it("nennt die einzelnen Aufgaben mit ihrem Status", () => {
    const aufgaben = archiviert("2026-01-01-probe-fertig").aufgaben;
    assert.deepEqual(aufgaben.map((a) => a.nummer), ["1.1", "2.1"]);
    assert.deepEqual(aufgaben.map((a) => a.erledigt), [true, true]);
    assert.equal(aufgaben[0].text, "Den roten Test schreiben");
  });

  it("stellt den juengsten Lauf nach vorn", () => {
    // Nach dem Abschlusszeitpunkt, nicht nach dem Ordnernamen: `probe-kahl` traegt das
    // spaeteste Datum im Namen und steht trotzdem hinten, weil ihm der Nachweis fehlt.
    assert.deepEqual(nutzlast.archiv.map((eintrag) => eintrag.name), [
      "2026-03-04-probe-halb",
      "2026-03-03-probe-aaa",
      "2026-03-03-probe-bbb",
      "2026-01-05-probe-stumm",
      "2026-01-01-probe-fertig",
      "2026-02-02-probe-kahl",
    ]);
  });
});

describe("Der Zeitpunkt kommt aus dem Gate-Nachweis", () => {
  it("nennt den Abschlusszeitpunkt aus fertig.md", () => {
    assert.equal(archiviert("2026-01-01-probe-fertig").zeitpunkt, "2026-01-01T13:30:00.000Z");
  });

  it("nimmt gate1.md, wo der Abschluss fehlt", () => {
    assert.equal(archiviert("2026-03-04-probe-halb").zeitpunkt, "2026-03-04T07:00:00.000Z");
  });

  it("bleibt leer, wo kein Nachweis liegt", () => {
    assert.equal(archiviert("2026-02-02-probe-kahl").zeitpunkt, "");
  });
});

describe("Ein archivierter Change traegt seine Belege", () => {
  it("haengt den Beleg an den Change, nicht nur an die Sektion", () => {
    const belege = archiviert("2026-01-01-probe-fertig").belege;
    assert.equal(belege.length, 2, "ein Beleg des archivierten Changes fehlt");
    assert.equal(belege[0].art, "bild");
    assert.equal(belege[0].stufe, "nachher");
    assert.ok(belege[0].adresse.endsWith("belege/assets/0-ansicht.png"),
      `unerwartete Adresse: ${belege[0].adresse}`);
  });
});

describe("Die laufenden Changes bleiben unberuehrt", () => {
  it("fuehrt keinen archivierten Change in der Changeliste", () => {
    const namen = nutzlast.changes.map((ch) => ch.name);
    assert.deepEqual(namen, ["probe-laeuft"]);
  });

  it("zaehlt archivierte Changes nicht in den Kennzahlen", () => {
    // Zwei, nicht eins: `probe-laeuft` liegt in beiden Arbeitsbaeumen, und die
    // Kennzahlen entdoppeln ueber Baeume hinweg nicht -- das ist Bestand und nicht
    // Gegenstand dieses Changes. Entscheidend ist, was das Archiv beitraegt: nichts.
    // Zaehlten die sechs Archivordner mit -- je Arbeitsbaum einmal --, stuenden hier
    // vierzehn Changes und vierzehn Aufgaben.
    assert.equal(nutzlast.kennzahlen.changes, 2, "die Archivordner wurden mitgezaehlt");
    assert.equal(nutzlast.kennzahlen.tasks_total, 4, "die Archivaufgaben wurden mitgezaehlt");
  });

  it("nennt einen archivierten Change aus zwei Arbeitsbaeumen nur einmal", () => {
    const namen = nutzlast.archiv.map((eintrag) => eintrag.name);
    assert.equal([...new Set(namen)].length, namen.length, "ein Archiveintrag steht doppelt");
  });
});

describe("Die Zeile kennt ihre Vorschau", () => {
  it("weist je Beleg aus, ob er sich darstellen laesst", () => {
    const bild = nutzlast.belege.find((b) => b.adresse.endsWith("0-ansicht.png"));
    const graph = nutzlast.belege.find((b) => b.adresse.endsWith("0-graph.dot"));
    const svg = nutzlast.belege.find((b) => b.adresse.endsWith("0-plan.svg"));
    assert.equal(bild.zeigbar, true, "ein PNG gilt als nicht darstellbar");
    assert.equal(svg.zeigbar, true, "ein SVG gilt als nicht darstellbar");
    assert.equal(graph.zeigbar, false, "ein .dot gilt als darstellbar");
  });

  it("nimmt den darstellbaren Beleg der Stufe nachher", () => {
    const vorschau = archiviert("2026-01-01-probe-fertig").vorschau;
    assert.ok(vorschau, "die Vorschau fehlt");
    assert.equal(vorschau.stufe, "nachher");
    assert.ok(vorschau.adresse.endsWith("0-ansicht.png"),
      `unerwartete Vorschau: ${vorschau.adresse}`);
  });

  it("bleibt leer, wo kein Beleg darstellbar ist", () => {
    const eintrag = archiviert("2026-01-05-probe-stumm");
    assert.equal(eintrag.vorschau, null, "eine Textdatei wurde als Vorschau genommen");
    assert.equal(eintrag.belege.length, 1, "der Beleg fehlt in der Belegliste");
  });
});

describe("Ein Archivordner ohne Aufgabenliste", () => {
  it("steht mit leerem Aufgabenstand in der Liste", () => {
    const eintrag = archiviert("2026-02-02-probe-kahl");
    assert.ok(eintrag, "der Archivordner ohne tasks.md fehlt");
    assert.equal(eintrag.gesamt, 0);
    assert.deepEqual(eintrag.aufgaben, []);
    assert.deepEqual(eintrag.belege, []);
  });
});
