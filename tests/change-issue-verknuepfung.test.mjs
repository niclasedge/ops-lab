// Jeder Change hat sein Issue -- und die Lage sagt, wo nicht.
//
// Die Szenarien der Delta-Spec `change-issue-verknuepfung`. Die Lage wird ueber ihre
// reinen Funktionen gegen feste Fixtures geprueft, nie gegen den echten Clone: dessen
// Stand aendert sich mit jedem Merge (Befund #722). `neu.mjs` laeuft gegen ein
// Wegwerf-Repo im Temporaerverzeichnis.

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import * as lage from "../tools/lage.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const NEU = join(HIER, "..", "tools", "neu.mjs");

const MIT_ZEILE = "# 15-beispiel\n\n## Warum\n\nGeht zurueck auf GitHub-Issue #12.\n\nText.\n";
const OHNE_ZEILE = "# 15-anderes\n\n## Warum\n\nNur Text, kein Verweis (vgl. PR #450).\n";

/** Ein Hauptbaum mit zwei offenen Changes; `issue` wie changesIn es aus proposal.md liest. */
function raeume(issueBeispiel, issueAnderes) {
  return [{
    name: "haupt",
    branch: "master",
    spitze: "aaa",
    hauptbaum: true,
    changes: [
      { kennung: "15-beispiel", offen: 2, gesamt: 3, issue: issueBeispiel },
      { kennung: "15-anderes", offen: 1, gesamt: 1, issue: issueAnderes },
    ],
  }];
}

function zusammen({ issueBeispiel = null, issueAnderes = null, issues }) {
  return lage.fuegeZusammen({
    archiv: [],
    raeume: raeume(issueBeispiel, issueAnderes),
    lagebild: null,
    ideen: [],
    issues,
    branches: [],
    gemergte: [],
    laufende: [],
  });
}

describe("Die Issue-Nummer steht im proposal.md", () => {
  it("liest die Zeile GitHub-Issue #N", () => {
    assert.equal(lage.issueNummerAus(MIT_ZEILE), 12);
  });

  it("liest aus einem Text ohne die Zeile keine Nummer", () => {
    assert.equal(lage.issueNummerAus(OHNE_ZEILE), null);
  });
});

describe("Die Lage weist Changes ohne Issue aus", () => {
  it("die Zeile im proposal.md verknuepft", () => {
    const stand = zusammen({ issueBeispiel: 12, issues: [] });
    const kennungen = stand.ohne_issue.map((e) => e.kennung);
    assert.ok(!kennungen.includes("15-beispiel"), JSON.stringify(stand.ohne_issue));
  });

  it("das Titelpraefix eines offenen Issues verknuepft", () => {
    const stand = zusammen({ issues: [{ number: 40, title: "15-beispiel: Beispiel" }] });
    const kennungen = stand.ohne_issue.map((e) => e.kennung);
    assert.ok(!kennungen.includes("15-beispiel"), JSON.stringify(stand.ohne_issue));
  });

  it("fuehrt einen Change ohne jede Verknuepfung mit Grund und Folgebefehl", () => {
    const stand = zusammen({
      issueBeispiel: 12,
      issues: [{ number: 41, title: "15-anderes-mehr: nur aehnlich" }],
    });
    assert.deepEqual(stand.ohne_issue.map((e) => e.kennung), ["15-anderes"]);
    const [eintrag] = stand.ohne_issue;
    assert.equal(eintrag.grund, "kein Issue");
    assert.match(eintrag.folgebefehl, /gh issue create/);
    assert.match(eintrag.folgebefehl, /--title "15-anderes: …"/);
    assert.ok(!stand.stumm.includes("issues"));
    assert.match(lage.kurzfassung(stand), /1 ohne Issue/);
  });

  it("zaehlt auch Changes, die nur in einem Arbeitsraum liegen", () => {
    const stand = lage.fuegeZusammen({
      archiv: [],
      raeume: [
        ...raeume(12, 13),
        { name: "15-neu", branch: "change/15-neu", spitze: "bbb", hauptbaum: false,
          changes: [{ kennung: "15-neu", offen: 3, gesamt: 3, issue: null }] },
      ],
      lagebild: null, ideen: [], issues: [], branches: [], gemergte: [], laufende: [],
    });
    assert.deepEqual(stand.ohne_issue.map((e) => e.kennung), ["15-neu"]);
  });
});

describe("Eine stumme Issue-Quelle meldet nie alle verknuepft", () => {
  it("benennt die Quelle und fuehrt die Changes ohne Zeile als unbewertet", () => {
    const stand = zusammen({ issueBeispiel: 12, issues: null });
    assert.ok(stand.stumm.includes("issues"), JSON.stringify(stand.stumm));
    assert.deepEqual(stand.ohne_issue.map((e) => e.kennung), ["15-anderes"]);
    assert.match(stand.ohne_issue[0].grund, /^unbewertet/);
    assert.match(lage.kurzfassung(stand), /1 ohne Issue \(1 unbewertet\)/);
  });

  it("gilt auch, wenn nur die Ideenquelle geliefert wird und schweigt", () => {
    const stand = lage.fuegeZusammen({
      archiv: [], raeume: raeume(null, null), lagebild: null, ideen: null,
      branches: [], gemergte: [], laufende: [],
    });
    assert.ok(stand.stumm.includes("issues"));
    assert.equal(stand.ohne_issue.length, 2);
    assert.ok(stand.ohne_issue.every((e) => e.grund.startsWith("unbewertet")));
  });
});

describe("Ein neuer Change braucht seine Issue-Nummer", () => {
  let repo;
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();

  before(() => {
    repo = mkdtempSync(join(tmpdir(), "ops-lab-issuepflicht-"));
    git(repo, "init", "--initial-branch=main");
    git(repo, "config", "user.email", "probe@example.invalid");
    git(repo, "config", "user.name", "Probe");
    writeFileSync(join(repo, ".gitignore"), ".claude/worktrees/\n", "utf8");
    git(repo, "add", ".gitignore");
    git(repo, "commit", "-m", "Start");
  });

  after(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it("endet ohne --issue mit Exit 2 und legt nichts an", () => {
    let code = 0;
    let ausgabe = "";
    try {
      ausgabe = execFileSync("node", [NEU, "ohne-nummer", "beispiel"],
        { cwd: repo, encoding: "utf8", stdio: "pipe" });
    } catch (fehler) {
      code = fehler.status ?? 1;
      ausgabe = `${fehler.stdout ?? ""}${fehler.stderr ?? ""}`;
    }
    assert.equal(code, 2, ausgabe);
    assert.match(ausgabe, /--issue/);
    assert.match(ausgabe, /gh issue create/);
    assert.ok(!existsSync(join(repo, ".claude", "worktrees", "ohne-nummer")), "Arbeitsraum angelegt");
    assert.equal(git(repo, "branch", "--list", "change/ohne-nummer"), "", "Branch angelegt");
  });
});
