// Ein Change entsteht in einem eigenen Arbeitsraum.
//
// Dieser Test laeuft gegen ein echtes, temporaeres git-Repo statt gegen eine
// Attrappe. Der Grund ist die Zusage selbst: "der Hauptordner behaelt seinen
// Branch" ist eine Aussage ueber git, und eine Attrappe koennte sie nicht
// widerlegen. Angefasst wird nur ein Verzeichnis unter dem Temp-Ordner.

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { dirname, join } from "node:path";

const HIER = dirname(fileURLToPath(import.meta.url));
const NEU = join(HIER, "..", "tools", "neu.mjs");

let repo;

/** git im Testrepo. Wirft bei Exit ungleich null. */
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** neu.mjs aufrufen. Gibt Exit-Code und Ausgabe zurueck, statt zu werfen. */
function neu(cwd, ...args) {
  try {
    const ausgabe = execFileSync("node", [NEU, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return { code: 0, ausgabe };
  } catch (fehler) {
    return { code: fehler.status ?? 1, ausgabe: `${fehler.stdout ?? ""}${fehler.stderr ?? ""}` };
  }
}

describe("Change anlegen", () => {
  before(() => {
    repo = mkdtempSync(join(tmpdir(), "ops-lab-neu-"));
    git(repo, "init", "--initial-branch=main");
    git(repo, "config", "user.email", "test@example.invalid");
    git(repo, "config", "user.name", "Test");
    // Wie im eingerichteten Repo: Arbeitsraeume werden nicht mitversioniert.
    // Ohne diesen Eintrag meldet git den neuen Arbeitsraum als '?? .claude/'
    // -- eine Tatsache ueber git, nicht ueber diesen Befehl.
    writeFileSync(join(repo, ".gitignore"), ".claude/worktrees/\n", "utf8");
    git(repo, "add", ".gitignore");
    git(repo, "commit", "-m", "Start");
  });

  after(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it("legt einen Arbeitsraum unter .claude/worktrees an", () => {
    const { code, ausgabe } = neu(repo, "beispiel", "arbeitsraum", "--issue", "1");
    assert.equal(code, 0, `neu.mjs schlug fehl: ${ausgabe}`);

    const raum = join(repo, ".claude", "worktrees", "beispiel");
    assert.ok(existsSync(raum), "Arbeitsraum fehlt");
    assert.equal(git(raum, "rev-parse", "--abbrev-ref", "HEAD"), "change/beispiel");
    assert.match(ausgabe, /\.claude\/worktrees\/beispiel/, "Meldung nennt den Pfad nicht");
  });

  it("legt die Artefakte im Arbeitsraum ab, nicht im Hauptordner", () => {
    const imRaum = join(repo, ".claude", "worktrees", "beispiel", "openspec", "changes", "beispiel");
    for (const datei of ["proposal.md", "tasks.md", join("specs", "arbeitsraum", "spec.md")]) {
      assert.ok(existsSync(join(imRaum, datei)), `${datei} fehlt im Arbeitsraum`);
    }
    assert.ok(
      !existsSync(join(repo, "openspec", "changes", "beispiel")),
      "der Hauptordner hat Artefakte bekommen",
    );
  });

  it("laesst den Branch des Hauptordners stehen", () => {
    assert.equal(git(repo, "rev-parse", "--abbrev-ref", "HEAD"), "main");
    assert.equal(git(repo, "status", "--porcelain"), "", "der Hauptordner ist nicht mehr sauber");
  });

  it("lehnt eine belegte Kennung ab", () => {
    const { code } = neu(repo, "beispiel", "arbeitsraum", "--issue", "1");
    assert.notEqual(code, 0);
    assert.equal(git(join(repo, ".claude", "worktrees", "beispiel"), "rev-parse", "--abbrev-ref", "HEAD"), "change/beispiel");
  });

  it("lehnt den Aufruf aus einem Arbeitsraum heraus ab", () => {
    const raum = join(repo, ".claude", "worktrees", "beispiel");
    const { code, ausgabe } = neu(raum, "zweiter", "arbeitsraum", "--issue", "2");
    assert.notEqual(code, 0, "geschachtelter Arbeitsraum wurde angelegt");
    assert.match(ausgabe, /Hauptordner/i, "Meldung nennt den Hauptordner nicht");
    assert.ok(
      !existsSync(join(raum, ".claude", "worktrees", "zweiter")),
      "es entstand ein Arbeitsraum im Arbeitsraum",
    );
  });
});

// Regression. Ein frischer Arbeitsraum wird vom Hauptbranch abgezweigt und traegt
// daher alles, was dort liegt -- auch einen Change-Ordner gleicher Kennung. Wer nur
// prueft, ob der Arbeitsraum frei ist, schreibt die Vorlage ueber vorhandene
// Artefakte. Genau das ist passiert.
describe("Vorhandene Artefakte", () => {
  const INHALT = "# vorhanden\n\nDieser Text stammt von Hand und darf nicht verschwinden.\n";
  let bestand;

  before(() => {
    bestand = mkdtempSync(join(tmpdir(), "ops-lab-bestand-"));
    git(bestand, "init", "--initial-branch=main");
    git(bestand, "config", "user.email", "test@example.invalid");
    git(bestand, "config", "user.name", "Test");
    writeFileSync(join(bestand, ".gitignore"), ".claude/worktrees/\n", "utf8");
    mkdirSync(join(bestand, "openspec", "changes", "vorhanden"), { recursive: true });
    writeFileSync(join(bestand, "openspec", "changes", "vorhanden", "proposal.md"), INHALT, "utf8");
    git(bestand, "add", "-A");
    git(bestand, "commit", "-m", "Change 'vorhanden' liegt schon im Hauptbranch");
  });

  after(() => {
    if (bestand) rmSync(bestand, { recursive: true, force: true });
  });

  it("lehnt eine Kennung ab, deren Artefakte schon im Hauptbranch liegen", () => {
    const { code, ausgabe } = neu(bestand, "vorhanden", "arbeitsraum", "--issue", "5");
    assert.notEqual(code, 0, "der Change wurde angelegt, obwohl es ihn schon gibt");
    assert.match(ausgabe, /openspec\/changes\/vorhanden/, "Meldung nennt den Pfad nicht");
  });

  // Geschrieben wird im Arbeitsraum, nicht im Hauptordner -- dort entsteht der
  // Schaden. Beide Orte werden geprueft: was es gibt, muss den Bestand tragen.
  it("laesst den vorhandenen Inhalt unangetastet", () => {
    for (const wurzel of [bestand, join(bestand, ".claude", "worktrees", "vorhanden")]) {
      const pfad = join(wurzel, "openspec", "changes", "vorhanden", "proposal.md");
      if (!existsSync(pfad)) continue;
      assert.equal(readFileSync(pfad, "utf8"), INHALT, `die Vorlage hat den Bestand ueberschrieben: ${pfad}`);
    }
  });

  it("hinterlaesst nach der Ablehnung kein Arbeitsverzeichnis", () => {
    assert.ok(
      !existsSync(join(bestand, ".claude", "worktrees", "vorhanden")),
      "der Arbeitsraum des abgelehnten Aufrufs blieb liegen",
    );
    assert.doesNotMatch(
      git(bestand, "worktree", "list"),
      /vorhanden/,
      "git fuehrt den Arbeitsraum des abgelehnten Aufrufs noch",
    );
    assert.doesNotMatch(
      git(bestand, "branch", "--list", "change/vorhanden"),
      /change\/vorhanden/,
      "der Branch des abgelehnten Aufrufs blieb stehen",
    );
  });
});

// Die Laeufe 89401f6c und 40d36a23 suchten das Muster mit ls und find im Archiv
// und lasen die frisch angelegten Vorlagen, die nur Platzhalter tragen. Beides
// kann die Meldung von neu.mjs vorwegnehmen.
describe("Muster beim Anlegen", () => {
  let repo;

  before(() => {
    repo = mkdtempSync(join(tmpdir(), "ops-lab-muster-"));
    git(repo, "init", "--initial-branch=main");
    git(repo, "config", "user.email", "test@example.invalid");
    git(repo, "config", "user.name", "Test");
    writeFileSync(join(repo, ".gitignore"), ".claude/worktrees/\n", "utf8");
    for (const eintrag of ["2026-01-01-alt", "2026-03-01-neu"]) {
      const ordner = join(repo, "openspec", "changes", "archive", eintrag);
      mkdirSync(join(ordner, "specs", "rechnung"), { recursive: true });
      writeFileSync(join(ordner, "proposal.md"), "# alt\n", "utf8");
      writeFileSync(join(ordner, "tasks.md"), "# Aufgaben\n", "utf8");
      writeFileSync(join(ordner, "specs", "rechnung", "spec.md"), "# rechnung\n", "utf8");
    }
    git(repo, "add", "-A");
    git(repo, "commit", "-m", "Zwei archivierte Changes");
  });

  after(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it("nennt die drei Dateien des juengsten archivierten Changes", () => {
    const { code, ausgabe } = neu(repo, "dritter", "rechnung", "--issue", "3");
    assert.equal(code, 0, `neu.mjs schlug fehl: ${ausgabe}`);
    assert.match(ausgabe, /archive\/2026-03-01-neu\/proposal\.md/);
    assert.match(ausgabe, /archive\/2026-03-01-neu\/tasks\.md/);
    assert.match(ausgabe, /archive\/2026-03-01-neu\/specs\/rechnung\/spec\.md/);
    assert.doesNotMatch(ausgabe, /2026-01-01-alt/, "der aeltere Eintrag ist kein Muster");
  });

  it("nennt die angelegten Artefakte Vorlagen, die nicht gelesen werden", () => {
    const { ausgabe } = neu(repo, "vierter", "rechnung", "--issue", "4");
    assert.match(ausgabe, /Vorlagen/);
    assert.match(ausgabe, /nicht lesen/);
  });
});

// --- Jeder Change hat sein eigenes Issue -------------------------------------
//
// Ein Change ohne Issue ist ein Vorhaben, das ausserhalb seines Arbeitsraums
// niemand sieht. Verweigert wird deshalb, bevor etwas angelegt ist -- ein halb
// entstandener Change waere schlimmer als gar keiner.

describe("Ein Change entsteht nur mit eigenem Issue", () => {
  let eigenes;

  before(() => {
    eigenes = mkdtempSync(join(tmpdir(), "ops-lab-issue-"));
    git(eigenes, "init", "--initial-branch=main");
    git(eigenes, "config", "user.email", "test@example.invalid");
    git(eigenes, "config", "user.name", "Test");
    writeFileSync(join(eigenes, ".gitignore"), ".claude/worktrees/\n", "utf8");
    git(eigenes, "add", ".gitignore");
    git(eigenes, "commit", "-m", "Start");
  });

  after(() => eigenes && rmSync(eigenes, { recursive: true, force: true }));

  it("lehnt den Aufruf ohne Issue-Nummer ab und legt nichts an", () => {
    const lauf = neu(eigenes, "ohne-nummer", "probe");
    assert.notEqual(lauf.code, 0, "ohne Issue-Nummer darf kein Change entstehen");
    assert.match(lauf.ausgabe, /issue/i, "die Meldung nennt das fehlende Issue nicht");
    assert.equal(existsSync(join(eigenes, "openspec", "changes", "ohne-nummer")), false,
      "der Ordner des abgelehnten Changes steht da");
  });

  it("verbindet den Change mit seinem Issue", () => {
    const lauf = neu(eigenes, "mit-nummer", "probe", "--issue", "42");
    assert.equal(lauf.code, 0, lauf.ausgabe);
    const vorschlag = readFileSync(
      join(eigenes, ".claude", "worktrees", "mit-nummer", "openspec", "changes", "mit-nummer", "proposal.md"),
      "utf8");
    assert.match(vorschlag, /GitHub-Issue #42/, "die Herkunftszeile fehlt im proposal.md");
  });
});
