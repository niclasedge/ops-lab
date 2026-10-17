// Der Testbefehl der Gates ist je Projekt bestimmbar.
//
// Ein fest verdrahteter Node-Lauf misst in einem Repo, dessen Fachtests in einer
// anderen Sprache liegen, eine Testmenge, die der Change gar nicht anfasst -- und
// meldet gruen, ohne etwas gesehen zu haben. Geprueft wird deshalb, welcher Befehl
// tatsaechlich lief: `gate.mjs` schreibt ihn in seine Nachweiszeile.
//
// Der Lauf geht gegen ein Wegwerf-Repo im Temporaerverzeichnis. `gate.mjs` nimmt
// das Arbeitsverzeichnis als Wurzel (`process.cwd()`), also genuegt es, den Aufruf
// dort zu starten; das ops-lab selbst bleibt unberuehrt.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));
const GATE = join(WURZEL, "tools", "gate.mjs");

let repo;

function schreibe(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt, "utf8");
}

function git(...argumente) {
  const lauf = spawnSync("git", argumente, { cwd: repo, encoding: "utf8" });
  if (lauf.status !== 0) throw new Error(`git ${argumente.join(" ")}: ${lauf.stderr}`);
  return lauf.stdout ?? "";
}

/**
 * Gate 2 im Wegwerf-Repo. Die Aussage steht im Nachweis, nicht im Exit-Code.
 *
 * `NODE_TEST_CONTEXT` muss aus der Umgebung: dieser Test laeuft selbst unter
 * `node --test`, und ein geerbtes Kennzeichen laesst den eingebauten Testlauf des
 * Gates im Kindprozess nichts ausfuehren -- er meldete gruen, ohne gelaufen zu sein.
 */
function gate2() {
  const umgebung = { ...process.env };
  delete umgebung.NODE_TEST_CONTEXT;
  delete umgebung.NODE_OPTIONS;
  const lauf = spawnSync(process.execPath, [GATE, "gate2", "probe"],
    { cwd: repo, encoding: "utf8", timeout: 120_000, env: umgebung });
  const nachweis = join(repo, "openspec", "changes", "probe", "gate2.md");
  const geschrieben = existsSync(nachweis) ? readFileSync(nachweis, "utf8") : "";
  return `${lauf.stdout ?? ""}${lauf.stderr ?? ""}${geschrieben}`;
}

describe("Der Testbefehl der Gates ist je Projekt bestimmbar", () => {
  before(() => {
    repo = mkdtempSync(join(tmpdir(), "ops-lab-gate-projekt-"));
    git("init", "--initial-branch=main");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Test");
    schreibe(join(repo, "openspec", "changes", "probe", "tasks.md"),
      "# Aufgaben — probe\n\n## Abschnitt\n\n- [ ] 1.1 Test `tests/probe.test.mjs` schreiben\n");
    schreibe(join(repo, "openspec", "changes", "probe", "gate1.md"), "# Gate 1 — probe\n");
    git("add", "openspec");
    git("commit", "-qm", "Start");
    // Unverfolgt und rot: nur so bestehen G2-3 (neue Testdatei) und G2-4 (roter Lauf),
    // und erst ein bestandenes Gate schreibt die Nachweiszeile mit dem Testbefehl.
    schreibe(join(repo, "tests", "probe.test.mjs"),
      'import { strict as assert } from "node:assert";\n'
      + 'import { it } from "node:test";\n'
      + 'it("rot", () => assert.equal(1, 2));\n');
  });

  after(() => repo && rmSync(repo, { recursive: true, force: true }));

  it("nimmt Befehl und Argumente aus tools/gate.projekt.json", () => {
    schreibe(join(repo, "tools", "gate.projekt.json"), JSON.stringify({
      befehl: process.execPath,
      argumente: ["-e", "process.exit(3)"],
    }));
    const ausgabe = gate2();
    assert.match(ausgabe, /-e process\.exit\(3\)/,
      "die Nachweiszeile nennt nicht den Befehl aus tools/gate.projekt.json");
    assert.match(ausgabe, /Exit 3/, "der Exit-Code des fremden Laeufers fehlt");
  });

  it("bleibt ohne die Datei beim eingebauten Node-Testlauf", () => {
    rmSync(join(repo, "tools", "gate.projekt.json"), { force: true });
    rmSync(join(repo, "openspec", "changes", "probe", "gate2.md"), { force: true });
    const ausgabe = gate2();
    assert.match(ausgabe, /--test/, "ohne Projektdatei muss der eingebaute Node-Lauf greifen");
    assert.doesNotMatch(ausgabe, /process\.exit\(3\)/,
      "der Befehl der geloeschten Projektdatei wirkt nach");
  });
});
