// Die Lage in einem Aufruf.
//
// Die vier Requirements der Delta-Spec `lagebild`, in derselben Reihenfolge. Die reinen
// Funktionen werden direkt gerufen -- sie sollen ohne Platte und ohne Prozess auskommen,
// und ein Test, der sie ueber die Kommandozeile prueft, koennte das nicht zeigen. Der
// Aufruf selbst laeuft danach einmal gegen ein Wegwerf-Repo im Temporaerverzeichnis:
// nur so stehen Branches, Archivordner und Arbeitsraeume fest, und kein Change im
// ops-lab kann den Lauf umwerfen.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  claims, fuegeZusammen, kurzfassung, ohneArbeitsraum, verwaisteRaeume,
} from "../tools/lage.mjs";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

function git(ordner, ...argumente) {
  const lauf = spawnSync("git", argumente, { cwd: ordner, encoding: "utf8" });
  if (lauf.status !== 0) throw new Error(`git ${argumente.join(" ")}: ${lauf.stderr}`);
  return lauf.stdout ?? "";
}

function schreibe(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

function aufgabenliste(name, aufgaben) {
  const zeilen = aufgaben.map(([text, erledigt]) => `- [${erledigt ? "x" : " "}] ${text}`);
  return `# Aufgaben — ${name}\n\n## Abschnitt\n\n${zeilen.join("\n")}\n`;
}

/**
 * Ein Wegwerf-Repo mit zwei Arbeitsraeumen: einer traegt einen laufenden Change, der
 * andere einen, der gemergt und archiviert wurde. Der zweite ist der verwaiste Raum --
 * sein Branch steckt in `main`, und unter `openspec/changes` steht er nicht mehr.
 *
 * Ein Remote hat das Repo bewusst nicht. Die Abfrage der offenen Ideen muss daran
 * scheitern, und der Aufruf muss das aushalten, statt abzubrechen.
 */
function probeRepo() {
  const huelle = mkdtempSync(join(tmpdir(), "ops-lage-"));
  const wurzel = join(huelle, "probe-repo");
  mkdirSync(wurzel, { recursive: true });

  git(wurzel, "init", "-q", "-b", "main");
  git(wurzel, "config", "user.email", "probe@ops-lab.invalid");
  git(wurzel, "config", "user.name", "Probe");
  schreibe(join(wurzel, ".gitignore"), ".claude/worktrees/\n");
  schreibe(join(wurzel, "README.md"), "# probe\n");
  git(wurzel, "add", "-A");
  git(wurzel, "commit", "-qm", "Probe: Grundstand");

  // Der gemergte Change: angelegt, committet, nach main geholt, dann archiviert.
  git(wurzel, "worktree", "add", "-q",
    join(wurzel, ".claude", "worktrees", "probe-alt"), "-b", "change/probe-alt");
  const alt = join(wurzel, ".claude", "worktrees", "probe-alt");
  schreibe(join(alt, "openspec", "changes", "probe-alt", "proposal.md"),
    "# probe-alt\n\n## Warum\n\nEine Probe.\n");
  schreibe(join(alt, "openspec", "changes", "probe-alt", "tasks.md"),
    aufgabenliste("probe-alt", [["Eins", true]]));
  git(alt, "add", "-A");
  git(alt, "commit", "-qm", "probe-alt");
  git(wurzel, "merge", "-q", "--no-ff", "-m", "merge probe-alt", "change/probe-alt");

  // Archivieren heisst verschieben, nicht loeschen -- danach liegt unter
  // `openspec/changes` kein Ordner `probe-alt` mehr.
  mkdirSync(join(wurzel, "openspec", "changes", "archive"), { recursive: true });
  git(wurzel, "mv", join("openspec", "changes", "probe-alt"),
    join("openspec", "changes", "archive", "2026-01-01-probe-alt"));
  git(wurzel, "commit", "-qm", "archiv probe-alt");

  // Der laufende Change: eigener Arbeitsraum, Branch nicht in main.
  git(wurzel, "worktree", "add", "-q",
    join(wurzel, ".claude", "worktrees", "probe-neu"), "-b", "change/probe-neu");
  const neu = join(wurzel, ".claude", "worktrees", "probe-neu");
  schreibe(join(neu, "openspec", "changes", "probe-neu", "proposal.md"),
    "# probe-neu\n\n## Warum\n\nEine Probe.\n");
  schreibe(join(neu, "openspec", "changes", "probe-neu", "tasks.md"),
    aufgabenliste("probe-neu", [["Eins", true], ["Zwei", false]]));
  git(neu, "add", "-A");
  git(neu, "commit", "-qm", "probe-neu");

  // Damit der laufende Change auch im Hauptbaum sichtbar ist: ops.py liest jeden
  // Arbeitsbaum, die Verwaisung aber entscheidet sich an main.
  return { wurzel, aufraeumen: () => rmSync(huelle, { recursive: true, force: true }) };
}

function lage(...argumente) {
  const lauf = spawnSync("node", [join(WURZEL, "tools", "lage.mjs"), ...argumente],
    { cwd: WURZEL, encoding: "utf8", timeout: 120_000 });
  return { code: lauf.status, aus: lauf.stdout ?? "", fehler: lauf.stderr ?? "" };
}

let probe;
let erhoben;

before(() => {
  probe = probeRepo();
  const lauf = lage("--root", probe.wurzel, "--json");
  assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  erhoben = JSON.parse(lauf.aus);
});

after(() => probe?.aufraeumen());

describe("Der Stand in einem Aufruf", () => {
  it("fuehrt alle sieben Schluessel als Liste", () => {
    for (const schluessel of ["zuletzt", "aktiv", "ohne_raum", "frei", "blockiert",
      "verwaist", "ideen"]) {
      assert.ok(Array.isArray(erhoben[schluessel]),
        `${schluessel} fehlt oder ist keine Liste`);
    }
  });

  it("nennt den zuletzt archivierten Change", () => {
    assert.deepEqual(erhoben.zuletzt.map((e) => e.kennung), ["probe-alt"]);
    assert.equal(erhoben.zuletzt[0].datum, "2026-01-01");
  });

  it("fuehrt den laufenden Change als aktiv", () => {
    assert.deepEqual(erhoben.aktiv.map((e) => e.kennung), ["probe-neu"]);
  });
});

describe("Offene Changes ohne Arbeitsraum", () => {
  it("laesst den Change weg, den ein Arbeitsraum traegt", () => {
    const haupt = [
      { kennung: "a", offen: 2, gesamt: 3 },
      { kennung: "b", offen: 1, gesamt: 4 },
    ];
    const aktiv = [{ kennung: "b", raum: "probe-b" }];
    assert.deepEqual(ohneArbeitsraum(haupt, aktiv),
      [{ kennung: "a", offen: 2, gesamt: 3 }]);
  });

  it("laesst den fertigen Change weg, den ungeplanten aber nicht", () => {
    // gesamt === 0 heisst „noch keine tasks.md" -- nicht geplant, nicht erledigt.
    // Ihn als fertig zu fuehren waere eine erfundene 0.
    const haupt = [
      { kennung: "fertig", offen: 0, gesamt: 5 },
      { kennung: "ungeplant", offen: 0, gesamt: 0 },
    ];
    assert.deepEqual(ohneArbeitsraum(haupt, []).map((e) => e.kennung), ["ungeplant"]);
  });

  it("sortiert das Kleinste zuerst, bei Gleichstand nach Kennung", () => {
    const haupt = [
      { kennung: "c", offen: 5, gesamt: 5 },
      { kennung: "b", offen: 1, gesamt: 2 },
      { kennung: "a", offen: 1, gesamt: 9 },
    ];
    assert.deepEqual(ohneArbeitsraum(haupt, []).map((e) => e.kennung), ["a", "b", "c"]);
  });

  it("fuehrt den Change im Arbeitsraum nicht als ohne Raum", () => {
    assert.ok(!erhoben.ohne_raum.some((e) => e.kennung === "probe-neu"),
      "ein Change mit eigenem Arbeitsraum wurde als ohne Raum gefuehrt");
  });
});

describe("Verwaiste Arbeitsraeume werden ausgewiesen", () => {
  it("fuehrt den gemergten und archivierten Raum als verwaist", () => {
    assert.deepEqual(erhoben.verwaist.map((e) => e.raum), ["probe-alt"]);
    assert.equal(erhoben.verwaist[0].branch, "change/probe-alt");
  });

  it("fuehrt den Raum mit laufendem Change nicht als verwaist", () => {
    assert.ok(!erhoben.verwaist.some((e) => e.raum === "probe-neu"),
      "ein Raum mit laufendem Change wurde als verwaist gefuehrt");
  });

  it("laesst den verwaisten Raum auf der Platte stehen", () => {
    const raeume = git(probe.wurzel, "worktree", "list");
    assert.ok(raeume.includes("probe-alt"), "der verwaiste Arbeitsraum wurde entfernt");
  });

  it("fuehrt einen frisch angelegten Raum nicht als verwaist", () => {
    // Der Fall, den erst ein Lauf gegen echte Daten zeigte: `just neu` legt einen Branch
    // ohne eigenen Commit an. Er zeigt auf dieselbe Spitze wie main und gilt damit fuer
    // `git branch --merged` als enthalten -- obwohl nie etwas gemergt wurde. Ohne die
    // Pruefung der Spitze meldet das Lagebild jeden neuen Arbeitsraum als verwaist.
    const raeume = [
      { name: "haupt", branch: "main", spitze: "aaa", hauptbaum: true },
      { name: "frisch", branch: "change/frisch", spitze: "aaa", hauptbaum: false },
    ];
    assert.deepEqual(verwaisteRaeume(raeume, ["change/frisch"], [], "aaa"), []);
  });

  it("entscheidet ohne Platte und ohne Prozess", () => {
    const raeume = [
      { name: "haupt", branch: "main", spitze: "aaa", hauptbaum: true },
      { name: "alt", branch: "change/alt", spitze: "bbb", hauptbaum: false },
      { name: "neu", branch: "change/neu", spitze: "ccc", hauptbaum: false },
      { name: "offen", branch: "change/offen", spitze: "ddd", hauptbaum: false },
    ];
    const gemergte = ["change/alt", "change/offen"];
    const laufende = ["neu", "offen"];
    // `alt` ist gemergt, steht nicht auf der Spitze und hat keinen Change mehr -- verwaist.
    // `neu` ist nicht gemergt -- laeuft noch.
    // `offen` ist gemergt, aber sein Change liegt noch da -- also nicht verwaist.
    // Der Hauptbaum ist nie verwaist, auch wenn sein Branch in sich selbst steckt.
    assert.deepEqual(verwaisteRaeume(raeume, gemergte, laufende, "aaa"),
      [{ raum: "alt", branch: "change/alt" }]);
  });
});

describe("Kurzfassung fuer den Sitzungsbeginn", () => {
  it("gibt genau eine Zeile aus", () => {
    const lauf = lage("--root", probe.wurzel, "--kurz");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
    assert.equal(lauf.aus.trimEnd().split("\n").length, 1,
      `mehr als eine Zeile: ${lauf.aus}`);
  });

  it("nennt die sechs Anzahlen", () => {
    const zeile = kurzfassung({
      zuletzt: [], aktiv: [1, 2], ohne_raum: [1, 2, 3, 4, 5], frei: [1], blockiert: [],
      verwaist: [1, 2, 3], ideen: [1, 2, 3, 4], stumm: [],
    });
    assert.ok(!zeile.includes("\n"), "die Kurzfassung enthaelt einen Zeilenumbruch");
    assert.match(zeile, /2 aktiv/);
    assert.match(zeile, /5 ohne Raum/);
    assert.match(zeile, /1 frei/);
    assert.match(zeile, /0 blockiert/);
    assert.match(zeile, /3 verwaist/);
    assert.match(zeile, /4 Ideen/);
  });
});

describe("Eine stumme Quelle bricht die Erhebung nicht ab", () => {
  it("endet ohne Fehler, wenn die Ideenquelle nicht antwortet", () => {
    // Das Wegwerf-Repo hat kein Remote: `gh issue list` kann dort nichts finden.
    assert.deepEqual(erhoben.ideen, []);
    assert.ok(erhoben.stumm.includes("ideen"),
      `die ausgefallene Quelle wurde nicht benannt: ${JSON.stringify(erhoben.stumm)}`);
  });

  it("vermerkt die Quelle, statt zu werfen", () => {
    const zusammen = fuegeZusammen({
      archiv: [], raeume: [], lagebild: null, ideen: null, gemergte: [], laufende: [],
    });
    assert.deepEqual(zusammen.ideen, []);
    assert.ok(zusammen.stumm.includes("ideen"));
    assert.ok(zusammen.stumm.includes("lagebild"));
  });
});

describe("Ein geclaimter Change ist nicht frei", () => {
  const HAUPT = [
    { kennung: "02-beispiel", offen: 3, gesamt: 4 },
    { kennung: "02-anderes", offen: 2, gesamt: 2 },
  ];

  it("liest den Claim aus einem Branch im Remote", () => {
    const stand = claims({
      kennungen: ["02-beispiel", "02-anderes"],
      branches: ["master", "change/02-beispiel"],
      issues: [],
    });
    assert.deepEqual(stand, [{ kennung: "02-beispiel", grund: "branch: change/02-beispiel" }]);
  });

  it("liest den Claim aus dem Label in-arbeit am gespiegelten Issue", () => {
    const stand = claims({
      kennungen: ["02-beispiel", "02-anderes"],
      branches: [],
      issues: [
        { nummer: 12, titel: "02-beispiel: Beispiel", labels: ["change", "in-arbeit"] },
        { nummer: 13, titel: "02-anderes: Anderes", labels: ["change"] },
      ],
    });
    assert.deepEqual(stand, [{ kennung: "02-beispiel", grund: "label: in-arbeit (#12)" }]);
  });

  it("leitet aus einer stummen Quelle keinen Claim ab", () => {
    assert.deepEqual(claims({ kennungen: ["02-beispiel"], branches: null, issues: null }), []);
  });

  it("nimmt den geclaimten Change aus ohne_raum und das Issue aus ideen", () => {
    const zusammen = fuegeZusammen({
      archiv: [],
      raeume: [{ name: "haupt", branch: "master", spitze: "aaa", hauptbaum: true, changes: HAUPT }],
      lagebild: null,
      ideen: [
        { number: 12, title: "02-beispiel: Beispiel", labels: ["change", "in-arbeit"] },
        { number: 13, title: "02-anderes: Anderes", labels: ["change"] },
      ],
      branches: ["master"],
      gemergte: [],
      laufende: [],
    });
    assert.deepEqual(zusammen.geclaimt, [{ kennung: "02-beispiel", grund: "label: in-arbeit (#12)" }]);
    assert.deepEqual(zusammen.ohne_raum.map((e) => e.kennung), ["02-anderes"]);
    assert.deepEqual(zusammen.ideen.map((e) => e.nummer), [13]);
  });

  it("benennt die stumme Branch-Quelle und gibt darum nichts frei", () => {
    const zusammen = fuegeZusammen({
      archiv: [],
      raeume: [{ name: "haupt", branch: "master", spitze: "aaa", hauptbaum: true, changes: HAUPT }],
      lagebild: null,
      ideen: [],
      branches: null,
      gemergte: [],
      laufende: [],
    });
    assert.ok(zusammen.stumm.includes("branches"),
      `die ausgefallene Quelle wurde nicht benannt: ${JSON.stringify(zusammen.stumm)}`);
    assert.deepEqual(zusammen.geclaimt, []);
    assert.equal(zusammen.ohne_raum.length, 2);
  });

  it("weist die geclaimten Changes in der Kurzfassung aus", () => {
    const zeile = kurzfassung({
      zuletzt: [], aktiv: [], ohne_raum: [1, 2], frei: [], blockiert: [],
      verwaist: [], ideen: [], geclaimt: [1], stumm: [],
    });
    assert.match(zeile, /1 geclaimt/);
  });
});
