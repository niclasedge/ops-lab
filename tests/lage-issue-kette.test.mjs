// Die offenen Issues in Abarbeitungsreihenfolge -- und die drei Befunde in tools/lage.mjs.
//
// Die Szenarien der Delta-Spec `lagebild` aus Change 49 (#939, #930, #765), in derselben
// Reihenfolge. Die reinen Funktionen laufen gegen feste Fixtures, nie gegen den echten
// Tracker: dessen Stand aendert sich mit jedem Issue. Nur der Hauptzweig wird an einem
// Wegwerf-Repo geprueft, weil sich `git branch --merged` nur an echten Branches zeigt.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import * as lage from "../tools/lage.mjs";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

/** Ein offenes Issue, wie die Issue-Quelle es liefert. */
function issue(nummer, labels, { blockedBy = 0, blocking = 0, parent = null, titel } = {}) {
  return {
    number: nummer,
    title: titel ?? `Issue ${nummer}`,
    labels,
    deps: { blocked_by: blockedBy, blocking },
    parent,
  };
}

const nummern = (liste) => liste.map((eintrag) => eintrag.nummer);
const eintrag = (liste, nummer) => liste.find((posten) => posten.nummer === nummer);

describe("Die offenen Issues stehen in Abarbeitungsreihenfolge", () => {
  it("ordnet die Kette A -> B -> C: C frei, B durch C, A durch B", () => {
    const A = 1;
    const B = 2;
    const C = 3;
    const kette = lage.issueKette({
      issues: [
        issue(A, ["ready-for-agent"], { blockedBy: 1 }),
        issue(B, ["ready-for-agent"], { blockedBy: 1, blocking: 1 }),
        issue(C, ["ready-for-agent"], { blocking: 1 }),
      ],
      kanten: [{ blocker: B, blockiert: A }, { blocker: C, blockiert: B }],
    });
    assert.deepEqual(nummern(kette.frei), [C]);
    assert.equal(eintrag(kette.frei, C).entsperrt, 2);
    assert.deepEqual(eintrag(kette.blockiert, B).wegen, [`#${C}`]);
    assert.deepEqual(eintrag(kette.blockiert, A).wegen, [`#${B}`]);
    assert.deepEqual(kette.wartet_auf_mensch, []);
  });

  it("sortiert frei nach entsperrten Issues absteigend, bei Gleichstand nach Nummer", () => {
    const kette = lage.issueKette({
      issues: [
        issue(10, ["ready-for-agent"]),
        issue(11, ["ready-for-agent"], { blocking: 1 }),
        issue(12, ["ready-for-agent"]),
        issue(13, ["needs-info"], { blockedBy: 1 }),
      ],
      kanten: [{ blocker: 11, blockiert: 13 }],
    });
    assert.deepEqual(nummern(kette.frei), [11, 10, 12]);
  });

  it("fuehrt ein geclaimtes Issue nicht unter frei", () => {
    const kette = lage.issueKette({
      issues: [issue(20, ["ready-for-agent", "in-arbeit"])],
      kanten: [],
    });
    assert.deepEqual(kette.frei, []);
  });

  it("stellt ein Gate des Menschen unter wartet_auf_mensch, ein blockiertes unter blockiert", () => {
    const kette = lage.issueKette({
      issues: [
        issue(490, ["s15-approval"]),
        issue(892, ["s15-approval"], { blockedBy: 1 }),
        issue(614, ["ready-for-human"], { blocking: 1 }),
      ],
      kanten: [{ blocker: 614, blockiert: 892 }],
    });
    assert.deepEqual(nummern(kette.wartet_auf_mensch).sort((a, b) => a - b), [490, 614]);
    assert.deepEqual(nummern(kette.blockiert), [892]);
    assert.deepEqual(eintrag(kette.blockiert, 892).wegen, ["#614"]);
  });
});

describe("Hygiene der Issue-Verwaltung wird ausgewiesen", () => {
  it("nennt Parent nicht offen und Rolle fehlt mit Grund", () => {
    const kette = lage.issueKette({
      issues: [
        issue(30, ["ready-for-agent"], { parent: 7 }),
        issue(31, ["change"]),
        issue(32, ["ready-for-agent", "ready-for-human"]),
        issue(33, ["ready-for-agent"], { parent: 30 }),
      ],
      kanten: [],
    });
    assert.deepEqual(eintrag(kette.hygiene, 30).grund, ["Parent #7 nicht offen"]);
    assert.deepEqual(eintrag(kette.hygiene, 31).grund, ["Rolle fehlt"]);
    assert.ok(eintrag(kette.hygiene, 32).grund.some((grund) => grund.startsWith("mehrere Rollen")));
    assert.equal(eintrag(kette.hygiene, 33), undefined, "offener Parent ist kein Hygienefall");
    assert.ok(!nummern(kette.frei).includes(31), "ohne Rolle ist ein Issue nicht frei");
  });
});

describe("Abhaengigkeiten kommen sparsam und nur ueber REST", () => {
  it("fragt die kleinere Seite ab: zwei Blocker statt fuenf Blockierte", () => {
    const plan = lage.detailPlan([
      issue(1, ["ready-for-agent"], { blocking: 3 }),
      issue(2, ["ready-for-agent"], { blocking: 2 }),
      ...[3, 4, 5, 6, 7].map((nummer) => issue(nummer, ["ready-for-agent"], { blockedBy: 1 })),
      issue(8, ["ready-for-agent"]),
    ]);
    assert.equal(plan.seite, "blocking");
    assert.deepEqual(plan.nummern, [1, 2]);
  });

  it("fragt die Blockierten ab, wenn sie die kleinere Seite sind", () => {
    const plan = lage.detailPlan([
      issue(1, [], { blocking: 1 }),
      issue(2, [], { blocking: 1 }),
      issue(3, [], { blockedBy: 2 }),
    ]);
    assert.equal(plan.seite, "blocked_by");
    assert.deepEqual(plan.nummern, [3]);
  });

  it("haelt ein Issue mit offenem Blocker blockiert, wenn die Detail-Aufrufe schweigen", () => {
    const zusammen = lage.fuegeZusammen({
      archiv: [],
      raeume: [{ name: "haupt", branch: "master", spitze: "aaa", hauptbaum: true, changes: [] }],
      lagebild: { ready: [], blocked: [] },
      ideen: [],
      issues: [issue(40, ["ready-for-agent"], { blockedBy: 1 })],
      kanten: null,
      branches: [],
      gemergte: [],
      laufende: [],
    });
    assert.deepEqual(zusammen.issue_kette.frei, []);
    assert.deepEqual(nummern(zusammen.issue_kette.blockiert), [40]);
    assert.ok(zusammen.stumm.includes("abhaengigkeiten"),
      `die schweigende Quelle wurde nicht benannt: ${JSON.stringify(zusammen.stumm)}`);
  });
});

describe("Ein Change mit blockiertem Issue ist nicht frei", () => {
  it("stellt 13-beispiel wegen #931 -> #922 unter blockiert", () => {
    const zusammen = lage.fuegeZusammen({
      archiv: [],
      raeume: [{
        name: "haupt",
        branch: "master",
        spitze: "aaa",
        hauptbaum: true,
        changes: [{ kennung: "13-beispiel", offen: 7, gesamt: 7, issue: null }],
      }],
      lagebild: { ready: ["13-beispiel"], blocked: [] },
      ideen: [],
      issues: [
        issue(931, ["change"], { blockedBy: 1, titel: "13-beispiel: Probe" }),
        issue(922, ["ready-for-agent"], { blocking: 1 }),
      ],
      kanten: [{ blocker: 922, blockiert: 931 }],
      branches: [],
      gemergte: [],
      laufende: [],
    });
    assert.ok(!zusammen.frei.includes("13-beispiel"), `noch frei: ${JSON.stringify(zusammen.frei)}`);
    const blockiert = zusammen.blockiert.find((posten) => posten.kennung === "13-beispiel");
    assert.ok(blockiert, `nicht blockiert: ${JSON.stringify(zusammen.blockiert)}`);
    assert.deepEqual(blockiert.wegen, ["#922"]);
  });
});

describe("Nur die eigenstaendige Herkunftszeile verknuepft", () => {
  it("liest die Zeile, die neu.mjs schreibt, auch mit Zusatz dahinter", () => {
    assert.equal(lage.issueNummerAus("# x\n\n## Warum\n\nGeht zurueck auf GitHub-Issue #12.\n"), 12);
    assert.equal(lage.issueNummerAus("Geht zurueck auf GitHub-Issue #899 (U3 aus dem Plan).\n"), 899);
  });

  it("nimmt eine Erwaehnung im Fliesstext nicht als Verknuepfung", () => {
    const text = "# 13\n\n## Was ausdruecklich nicht\n\n- Der Rueckbau gehoert Change 04\n"
      + "  (GitHub-Issue #694), nicht unter diesen Change.\n";
    assert.equal(lage.issueNummerAus(text), null);
    const liste = lage.ohneIssue({
      changes: [{ kennung: "13-beispiel", issue: lage.issueNummerAus(text) }],
      issues: [{ title: "04-anderes: Rueckbau" }],
    });
    assert.deepEqual(liste.map((posten) => posten.kennung), ["13-beispiel"]);
  });
});

describe("Verwaist rechnet gegen den Hauptzweig", () => {
  it("waehlt master, sonst main, sonst keinen", () => {
    assert.equal(lage.hauptzweig(["main", "master", "change/x"]), "master");
    assert.equal(lage.hauptzweig(["main", "change/x"]), "main");
    assert.equal(lage.hauptzweig(["change/x"]), null);
  });

  let huelle;
  let erhoben;

  before(() => {
    huelle = mkdtempSync(join(tmpdir(), "ops-lage-master-"));
    const wurzel = join(huelle, "probe-repo");
    mkdirSync(wurzel, { recursive: true });
    const git = (ordner, ...argumente) => {
      const lauf = spawnSync("git", argumente, { cwd: ordner, encoding: "utf8" });
      if (lauf.status !== 0) throw new Error(`git ${argumente.join(" ")}: ${lauf.stderr}`);
    };
    const schreibe = (pfad, inhalt) => {
      mkdirSync(dirname(pfad), { recursive: true });
      writeFileSync(pfad, inhalt);
    };
    git(wurzel, "init", "-q", "-b", "master");
    git(wurzel, "config", "user.email", "probe@example.invalid");
    git(wurzel, "config", "user.name", "Probe");
    schreibe(join(wurzel, ".gitignore"), ".claude/worktrees/\n");
    schreibe(join(wurzel, "README.md"), "# probe\n");
    git(wurzel, "add", "-A");
    git(wurzel, "commit", "-qm", "Grundstand");
    const alt = join(wurzel, ".claude", "worktrees", "probe-alt");
    git(wurzel, "worktree", "add", "-q", alt, "-b", "change/probe-alt");
    schreibe(join(alt, "openspec", "changes", "probe-alt", "tasks.md"),
      "# Aufgaben\n\n## A\n\n- [x] Eins\n");
    git(alt, "add", "-A");
    git(alt, "commit", "-qm", "probe-alt");
    git(wurzel, "merge", "-q", "--no-ff", "-m", "merge probe-alt", "change/probe-alt");
    mkdirSync(join(wurzel, "openspec", "changes", "archive"), { recursive: true });
    git(wurzel, "mv", join("openspec", "changes", "probe-alt"),
      join("openspec", "changes", "archive", "2026-01-01-probe-alt"));
    git(wurzel, "commit", "-qm", "archiv probe-alt");

    const lauf = spawnSync("node", [join(WURZEL, "tools", "lage.mjs"), "--root", wurzel, "--json"],
      { cwd: WURZEL, encoding: "utf8", timeout: 120_000 });
    assert.equal(lauf.status, 0, `stderr: ${lauf.stderr}`);
    erhoben = JSON.parse(lauf.stdout);
  });

  after(() => huelle && rmSync(huelle, { recursive: true, force: true }));

  it("fuehrt den gemergten Raum in einem master-Repo als verwaist", () => {
    assert.deepEqual(erhoben.verwaist.map((posten) => posten.raum), ["probe-alt"]);
    assert.ok(!erhoben.stumm.includes("gemergte"));
  });
});

describe("Fertige, nicht archivierte Changes sind archivreif", () => {
  it("fuehrt den fertigen Change, nicht den ungeplanten, und nennt die Zahl", () => {
    const zusammen = lage.fuegeZusammen({
      archiv: [],
      raeume: [{
        name: "haupt",
        branch: "master",
        spitze: "aaa",
        hauptbaum: true,
        changes: [
          { kennung: "40-fertig", offen: 0, gesamt: 5, issue: 1 },
          { kennung: "41-ungeplant", offen: 0, gesamt: 0, issue: 2 },
        ],
      }],
      lagebild: { ready: [], blocked: [] },
      ideen: [],
      issues: [],
      kanten: [],
      branches: [],
      gemergte: [],
      laufende: [],
    });
    assert.deepEqual(zusammen.archivreif.map((posten) => posten.kennung), ["40-fertig"]);
    assert.match(lage.kurzfassung(zusammen), /1 archivreif/);
  });
});
