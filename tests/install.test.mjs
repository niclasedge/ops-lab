// Der Installer rollt den Ablauf in zwei Stufen aus.
//
// Geprueft wird gegen Wegwerf-Verzeichnisse aus mkdtemp: ein Ordner spielt den
// Konfigurationsordner von Claude Code, ein zweiter das Zielprojekt. Das echte
// ~/.claude und ein echtes Nachbarrepo bleiben aussen vor -- ein Test, der dort
// schreibt, ist kein Test mehr, sondern ein Eingriff.

import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { dirname, join, relative } from "node:path";

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = join(HIER, "..");
const INSTALL = join(QUELLE, "tools", "install.mjs");

const ANFANG = "# >>> ops-lab";
const SCHLUSS = "# <<< ops-lab";

/** Ein Wegwerf-Verzeichnis. Alle werden am Ende des Laufs entfernt. */
const papierkorb = [];
function wegwerfordner(marke) {
  const pfad = mkdtempSync(join(tmpdir(), `ops-lab-install-${marke}-`));
  papierkorb.push(pfad);
  return pfad;
}

/**
 * Den Installer aufrufen. Der Konfigurationsordner kommt aus der Umgebung --
 * genau der Weg, den auch Claude Code selbst geht.
 */
function installiere(konfig, ziel, { cwd = QUELLE } = {}) {
  const argumente = ziel === undefined ? [INSTALL] : [INSTALL, ziel];
  try {
    const ausgabe = execFileSync("node", argumente, {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, CLAUDE_CONFIG_DIR: konfig },
    });
    return { code: 0, ausgabe };
  } catch (fehler) {
    return { code: fehler.status ?? 1, ausgabe: `${fehler.stdout ?? ""}${fehler.stderr ?? ""}` };
  }
}

/** Alle Dateien unterhalb eines Ordners, relativ und sortiert. */
function dateien(wurzel) {
  const treffer = [];
  const gehe = (ordner) => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = join(ordner, eintrag.name);
      if (eintrag.isDirectory()) gehe(pfad);
      else treffer.push(relative(wurzel, pfad));
    }
  };
  if (existsSync(wurzel)) gehe(wurzel);
  return treffer.sort();
}

/** Pfad und Inhalt jeder Datei -- die Momentaufnahme eines Ordners. */
function momentaufnahme(wurzel) {
  return dateien(wurzel).map((rel) => `${rel}\n${readFileSync(join(wurzel, rel), "utf8")}`).join("\n\u0000\n");
}

const zaehle = (text, stueck) => text.split(stueck).length - 1;

after(() => {
  for (const pfad of papierkorb) rmSync(pfad, { recursive: true, force: true });
});

// --- Stufe 1: global --------------------------------------------------------

describe("Erste Stufe — der Konfigurationsordner", () => {
  let konfig;
  let projekt;
  let lauf;

  before(() => {
    konfig = wegwerfordner("konfig");
    projekt = wegwerfordner("projekt");
    lauf = installiere(konfig, projekt);
  });

  it("laeuft durch", () => {
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);
  });

  it("legt Skill und Arbeiterbeschreibung ab", () => {
    assert.ok(existsSync(join(konfig, "skills", "leitstand", "SKILL.md")), "SKILL.md fehlt");
    assert.ok(existsSync(join(konfig, "agents", "change-arbeiter.md")), "change-arbeiter.md fehlt");
  });

  it("legt den Installer und seine Nutzlast mit ab, damit Stufe 2 ohne dieses Repo laeuft", () => {
    const abgelegt = dateien(konfig);
    for (const name of ["install.mjs", "gate.mjs", "pruefungen.mjs", "ops.py"]) {
      assert.ok(
        abgelegt.some((rel) => rel.endsWith(name)),
        `${name} liegt nicht im Konfigurationsordner — Stufe 2 braucht dort das Repo`,
      );
    }
  });

  it("legt keinen Skill ab, der auf ein bestimmtes Repo zeigt", () => {
    // Ein Skill gilt global. Ein ausgeschriebener Pfad darin zeigt aus jedem
    // Projekt in dasselbe fremde Verzeichnis -- gemeint ist immer das
    // Arbeitsverzeichnis, aus dem er gerufen wurde.
    for (const rel of dateien(join(konfig, "skills"))) {
      assert.doesNotMatch(
        readFileSync(join(konfig, "skills", rel), "utf8"),
        /\/(Users|home)\/[A-Za-z0-9._-]+\//,
        `${rel} nennt einen absoluten Pfad und zeigt damit aus jedem Projekt dorthin`,
      );
    }
  });
});

// --- Die Skills -------------------------------------------------------------
//
// Der Installer fuehrt keinen Skill namentlich: was unter .claude/skills/ liegt,
// rollt aus. Ein zweiter Name im Code waere dieselbe Arbeit noch einmal, jedes
// Mal, wenn ein Skill dazukommt -- und der Skill, den jemand zu ergaenzen
// vergisst, fehlt still.

/** Die Skillordner unterhalb einer Wurzel -- gelesen, nicht aufgezaehlt. */
function skills(wurzel) {
  if (!existsSync(wurzel)) return [];
  return readdirSync(wurzel, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

describe("Jeder Skill des Ursprungs rollt aus", () => {
  let konfig;

  before(() => {
    konfig = wegwerfordner("konfig-skills");
    const lauf = installiere(konfig, wegwerfordner("projekt-skills"));
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);
  });

  it("legt jeden von ihnen im Konfigurationsordner ab", () => {
    const vorhanden = skills(join(QUELLE, ".claude", "skills"));
    assert.ok(vorhanden.length > 0, "der Ursprung fuehrt keinen Skill");
    assert.deepEqual(skills(join(konfig, "skills")), vorhanden);
  });

  it("legt jeden von ihnen auch in den Vorrat", () => {
    // Aus dem Vorrat heraus laeuft der Installer weiter, ohne dieses Repo. Was
    // dort fehlt, fehlt ab dem zweiten Ausrollen ueberall.
    assert.deepEqual(
      skills(join(konfig, "ops-lab", ".claude", "skills")),
      skills(join(QUELLE, ".claude", "skills")),
    );
  });

  it("nimmt einen Skill mit, den dieses Repo nicht kennt", () => {
    // Der Beweis, dass kein Name im Installer steht: ein Ursprung aus dem
    // Wegwerf-Ordner mit zwei frei erfundenen Skills. Waere einer von ihnen im
    // Code eingetragen, liefe dieser Test nicht.
    const ursprung = wegwerfordner("ursprung-frei");
    for (const rel of [join("tools", "install.mjs"), "ops.py", join(".claude", "agents", "change-arbeiter.md")]) {
      mkdirSync(dirname(join(ursprung, rel)), { recursive: true });
      cpSync(join(QUELLE, rel), join(ursprung, rel));
    }
    const erfunden = ["erster-skill", "zweiter-skill"];
    for (const name of erfunden) {
      const ordner = join(ursprung, ".claude", "skills", name);
      mkdirSync(ordner, { recursive: true });
      writeFileSync(join(ordner, "SKILL.md"), `---\nname: ${name}\n---\n\n# ${name}\n`, "utf8");
    }

    const konfigFrei = wegwerfordner("konfig-frei");
    const lauf = execFileSync("node", [join(ursprung, "tools", "install.mjs"), wegwerfordner("projekt-frei")], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, CLAUDE_CONFIG_DIR: konfigFrei },
    });

    assert.deepEqual(skills(join(konfigFrei, "skills")), erfunden, `Ausgabe: ${lauf}`);
    assert.deepEqual(skills(join(konfigFrei, "ops-lab", ".claude", "skills")), erfunden);
  });
});

// --- Stufe 2: das Projekt ---------------------------------------------------

describe("Zweite Stufe — das Zielprojekt", () => {
  let konfig;
  let projekt;

  before(() => {
    konfig = wegwerfordner("konfig2");
    projekt = wegwerfordner("projekt2");
    const lauf = installiere(konfig, projekt);
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);
  });

  it("legt Werkzeuge und Lagebild ab", () => {
    for (const rel of [join("tools", "gate.mjs"), join("tools", "pruefungen.mjs"), "ops.py"]) {
      assert.ok(existsSync(join(projekt, rel)), `${rel} fehlt im Zielprojekt`);
    }
  });

  it("laesst aus, was dem Ursprung gehoert", () => {
    for (const name of ["sync.mjs", "install.mjs"]) {
      assert.ok(
        !existsSync(join(projekt, "tools", name)),
        `${name} gehoert nicht ins Zielprojekt`,
      );
    }
  });

  it("legt das openspec-Geruest an", () => {
    for (const rel of [
      join("openspec", "changes", ".gitkeep"),
      join("openspec", "specs", ".gitkeep"),
      join("openspec", "config.yaml"),
    ]) {
      assert.ok(existsSync(join(projekt, rel)), `${rel} fehlt im Zielprojekt`);
    }
  });

  it("legt die Gate-Tests mit ab", () => {
    const tests = dateien(join(projekt, "tests"));
    assert.ok(tests.length > 0, "keine Testdatei im Zielprojekt");
    assert.ok(
      tests.includes("pruefungen.test.mjs"),
      `die Tests der Gate-Regeln fehlen: ${tests.join(", ") || "nichts"}`,
    );
  });

  it("laesst eine vorhandene config.yaml unangetastet", () => {
    const eigenes = wegwerfordner("projekt-config");
    const pfad = join(eigenes, "openspec", "config.yaml");
    const inhalt = "schema: spec-driven\n\ncontext: |\n  Eigener Kontext dieses Projekts.\n";
    mkdirSync(dirname(pfad), { recursive: true });
    writeFileSync(pfad, inhalt, "utf8");

    const lauf = installiere(wegwerfordner("konfig-config"), eigenes);
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);
    assert.equal(readFileSync(pfad, "utf8"), inhalt, "die eigene config.yaml wurde ueberschrieben");
  });

  it("nimmt ohne Argument das Arbeitsverzeichnis", () => {
    const ohneArgument = wegwerfordner("projekt-cwd");
    const lauf = installiere(wegwerfordner("konfig-cwd"), undefined, { cwd: ohneArgument });
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);
    assert.ok(existsSync(join(ohneArgument, "ops.py")), "im Arbeitsverzeichnis entstand nichts");
  });
});

// --- Das justfile -----------------------------------------------------------

describe("Der Markierblock im justfile", () => {
  it("legt ein justfile an, wenn keines da ist", () => {
    const projekt = wegwerfordner("projekt-jf-neu");
    const lauf = installiere(wegwerfordner("konfig-jf-neu"), projekt);
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);

    const text = readFileSync(join(projekt, "justfile"), "utf8");
    assert.equal(zaehle(text, ANFANG), 1, "die Anfangsmarkierung steht nicht genau einmal da");
    assert.equal(zaehle(text, SCHLUSS), 1, "die Schlussmarkierung steht nicht genau einmal da");
    assert.match(text, /^gate1 /m, "das Rezept gate1 fehlt im Block");
  });

  it("ersetzt nur den Block und laesst fremde Rezepte stehen", () => {
    const projekt = wegwerfordner("projekt-jf-alt");
    const konfig = wegwerfordner("konfig-jf-alt");
    const eigenes = "# Rezepte dieses Projekts\n\nbauen:\n    @echo gebaut\n";
    writeFileSync(join(projekt, "justfile"), eigenes, "utf8");

    assert.equal(installiere(konfig, projekt).code, 0);
    assert.equal(installiere(konfig, projekt).code, 0);

    const text = readFileSync(join(projekt, "justfile"), "utf8");
    assert.ok(text.includes(eigenes.trim()), "das eigene Rezept ist verschwunden");
    assert.equal(zaehle(text, ANFANG), 1, "der Block wurde verdoppelt");
    assert.equal(zaehle(text, SCHLUSS), 1, "die Schlussmarkierung wurde verdoppelt");
    assert.equal((text.match(/^gate1 /gm) ?? []).length, 1, "das Rezept gate1 steht doppelt da");
  });
});

// --- Der zweite Lauf --------------------------------------------------------

describe("Ein zweiter Lauf stellt denselben Zustand her", () => {
  it("ersetzt eine vorhandene globale Fassung restlos", () => {
    const konfig = wegwerfordner("konfig-alt");
    const skillOrdner = join(konfig, "skills", "leitstand");
    mkdirSync(skillOrdner, { recursive: true });
    writeFileSync(join(skillOrdner, "SKILL.md"), "# alte Fassung\n", "utf8");
    writeFileSync(join(skillOrdner, "uebrig.md"), "Rest einer aelteren Fassung\n", "utf8");

    const lauf = installiere(konfig, wegwerfordner("projekt-alt"));
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);

    assert.equal(
      readFileSync(join(skillOrdner, "SKILL.md"), "utf8"),
      readFileSync(join(QUELLE, ".claude", "skills", "leitstand", "SKILL.md"), "utf8"),
      "die alte Fassung steht noch da",
    );
    assert.ok(
      !existsSync(join(skillOrdner, "uebrig.md")),
      "eine Datei der alten Fassung blieb liegen",
    );
  });

  it("hinterlaesst nach zwei Laeufen denselben Stand wie nach einem", () => {
    const konfig = wegwerfordner("konfig-zwei");
    const projekt = wegwerfordner("projekt-zwei");

    assert.equal(installiere(konfig, projekt).code, 0);
    const nachEinem = [momentaufnahme(konfig), momentaufnahme(projekt)];

    assert.equal(installiere(konfig, projekt).code, 0);
    const nachZweien = [momentaufnahme(konfig), momentaufnahme(projekt)];

    assert.deepEqual(nachZweien, nachEinem, "der zweite Lauf hat einen anderen Zustand erzeugt");
  });
});

// --- Der Uebergabetext ------------------------------------------------------

describe("Der Uebergabetext fuer die CLAUDE.md", () => {
  let projekt;
  let ausgabe;

  before(() => {
    projekt = wegwerfordner("projekt-text");
    const lauf = installiere(wegwerfordner("konfig-text"), projekt);
    assert.equal(lauf.code, 0, `Installer schlug fehl: ${lauf.ausgabe}`);
    ausgabe = lauf.ausgabe;
  });

  it("nennt Gates, Arbeitsraeume und die Merge-Regel", () => {
    assert.match(ausgabe, /CLAUDE\.md/, "der Text nennt die Datei nicht, um die es geht");
    assert.match(ausgabe, /Gate 1/, "die Gates fehlen");
    assert.match(ausgabe, /Gate 2/, "die Gates fehlen");
    assert.match(ausgabe, /Arbeitsr(ae|äu)/i, "die Arbeitsraeume fehlen");
    assert.match(ausgabe, /Merge/i, "die Merge-Regel fehlt");
  });

  it("schreibt keine CLAUDE.md ins Zielprojekt", () => {
    assert.ok(
      !existsSync(join(projekt, "CLAUDE.md")),
      "der Installer hat die CLAUDE.md angefasst",
    );
  });
});
