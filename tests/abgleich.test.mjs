// Der Abgleich haelt die Zusage aus dem Vorschlag gegen den Diff.
//
// Geprueft wird gegen ein echtes, temporaeres git-Repo statt gegen eine
// Attrappe: "was der Change tatsaechlich anfasst" ist eine Aussage ueber git,
// und dazu gehoert der noch nicht committete Stand. Eine Attrappe koennte
// gerade das nicht widerlegen. Angefasst wird nur ein Verzeichnis unter dem
// Temp-Ordner; kein Test bindet sich an einen Arbeitsraum dieses Repos.

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { dirname, join } from "node:path";

const HIER = dirname(fileURLToPath(import.meta.url));
const ABGLEICH = join(HIER, "..", "tools", "abgleich.mjs");

/** git im Testrepo. Wirft bei Exit ungleich null. */
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** abgleich.mjs aufrufen. Gibt Exit-Code und Ausgabe zurueck, statt zu werfen. */
function abgleich(cwd, ...args) {
  try {
    const ausgabe = execFileSync("node", [ABGLEICH, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return { code: 0, ausgabe };
  } catch (fehler) {
    return { code: fehler.status ?? 1, ausgabe: `${fehler.stdout ?? ""}${fehler.stderr ?? ""}` };
  }
}

/** Eine Datei samt ihrer Ordner schreiben. */
function schreibe(wurzel, rel, inhalt) {
  const pfad = join(wurzel, rel);
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt, "utf8");
}

/** Ein Vorschlag mit dem Abschnitt, aus dem die Zusage gelesen wird. */
function vorschlag(...pfade) {
  return `# beispiel\n\n## Beruehrte Dateien\n\n${pfade.map((p) => `- \`${p}\``).join("\n")}\n`;
}

/**
 * Ein Wegwerf-Repo mit einem Change darin.
 *
 * `zusage` steht im Vorschlag, `angefasst` wird tatsaechlich geschrieben --
 * beides getrennt uebergeben, damit ein Test die Abweichung herstellen kann,
 * um die es ihm geht.
 */
function repoMitChange({ zusage, angefasst }) {
  const repo = mkdtempSync(join(tmpdir(), "ops-lab-abgleich-"));
  git(repo, "init", "--initial-branch=main");
  git(repo, "config", "user.email", "test@example.invalid");
  git(repo, "config", "user.name", "Test");

  // Der Bestand: alles, was der Change spaeter anfassen koennte, liegt schon da.
  for (const rel of ["tools/abgleich.mjs", "tools/gate.mjs", "docs/abgleich.svg"]) {
    schreibe(repo, rel, "// Stand vor dem Change\n");
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-m", "Start");

  git(repo, "checkout", "-b", "change/beispiel");
  schreibe(repo, "openspec/changes/beispiel/proposal.md", vorschlag(...zusage));
  for (const rel of angefasst) schreibe(repo, rel, "// vom Change geaendert\n");

  return repo;
}

const papierkorb = [];
const wegwerfrepo = (aufbau) => {
  const repo = repoMitChange(aufbau);
  papierkorb.push(repo);
  return repo;
};

after(() => {
  for (const pfad of papierkorb) rmSync(pfad, { recursive: true, force: true });
});

describe("Ein Diff, der von der Zusage abweicht", () => {
  let lauf;

  before(() => {
    const repo = wegwerfrepo({
      zusage: ["tools/abgleich.mjs", "docs/abgleich.svg", "openspec/changes/beispiel/"],
      angefasst: ["tools/abgleich.mjs", "tools/gate.mjs"],
    });
    lauf = abgleich(repo, "beispiel");
  });

  it("endet mit Exit 0 — der Abgleich berichtet, er blockiert nicht", () => {
    assert.equal(lauf.code, 0, `der Abgleich endete mit einem Fehler: ${lauf.ausgabe}`);
  });

  it("nennt die angefasste Datei ohne Zusage", () => {
    assert.match(lauf.ausgabe, /tools\/gate\.mjs/, "die nicht zugesagte Datei fehlt im Bericht");
  });

  it("nennt die zugesagte Datei ohne Anfassen", () => {
    assert.match(lauf.ausgabe, /docs\/abgleich\.svg/, "die unberuehrte Zusage fehlt im Bericht");
  });

  it("haelt beide Richtungen im Bericht auseinander", () => {
    const zusatz = lauf.ausgabe.search(/Zusatz/i);
    const auslassung = lauf.ausgabe.search(/Auslassung/i);
    assert.ok(zusatz >= 0, "der Bericht nennt den Zusatz nicht als eigene Richtung");
    assert.ok(auslassung >= 0, "der Bericht nennt die Auslassung nicht als eigene Richtung");
    assert.notEqual(zusatz, auslassung);
  });

  it("nennt die Basis, gegen die gerechnet wurde", () => {
    assert.match(lauf.ausgabe, /main/, "der Bericht nennt die Basis nicht");
  });

  it("zaehlt den noch nicht committeten Stand mit", () => {
    // Der Abgleich laeuft vor 'just pr'. Zaehlte nur, was schon committet ist,
    // saehe er beim ersten Lauf eines Changes gar nichts.
    assert.match(lauf.ausgabe, /tools\/gate\.mjs/);
  });
});

describe("Ein Diff, der die Zusage einhaelt", () => {
  it("meldet Deckungsgleichheit, statt zu schweigen", () => {
    const repo = wegwerfrepo({
      zusage: ["tools/abgleich.mjs", "openspec/changes/beispiel/"],
      angefasst: ["tools/abgleich.mjs"],
    });
    const lauf = abgleich(repo, "beispiel");
    assert.equal(lauf.code, 0, lauf.ausgabe);
    assert.match(lauf.ausgabe, /deckungsgleich/i, "der Bericht sagt nichts zur Deckungsgleichheit");
  });

  it("fuehrt die Artefakte des Changes nicht als Zusatz", () => {
    // Der Change-Ordner faellt in jedem Lauf an. Hier ist er nicht einmal
    // zugesagt -- und darf trotzdem keinen Befund ausloesen.
    const repo = wegwerfrepo({
      zusage: ["tools/abgleich.mjs"],
      angefasst: ["tools/abgleich.mjs"],
    });
    const lauf = abgleich(repo, "beispiel");
    assert.equal(lauf.code, 0, lauf.ausgabe);
    assert.doesNotMatch(lauf.ausgabe, /openspec\/changes\/beispiel\/proposal\.md/);
  });
});

describe("Was der Abgleich nicht beantworten kann", () => {
  it("lehnt eine unbekannte Kennung ab, statt Deckungsgleichheit zu melden", () => {
    const repo = wegwerfrepo({ zusage: ["tools/abgleich.mjs"], angefasst: ["tools/abgleich.mjs"] });
    const lauf = abgleich(repo, "gibtesnicht");
    assert.notEqual(lauf.code, 0, "eine unbekannte Kennung lief als Befund durch");
    assert.match(lauf.ausgabe, /gibtesnicht/, "die Meldung nennt die Kennung nicht");
  });

  it("verlangt eine Kennung", () => {
    const repo = wegwerfrepo({ zusage: ["tools/abgleich.mjs"], angefasst: ["tools/abgleich.mjs"] });
    const lauf = abgleich(repo);
    assert.notEqual(lauf.code, 0);
    assert.match(lauf.ausgabe, /Aufruf/i, "ohne Kennung fehlt der Hinweis auf den Aufruf");
  });
});
