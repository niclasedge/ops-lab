// Der naechste Schritt je Arbeitsbaum, geprueft durch `ops.py --web --trocken`.
//
// Die Regel selbst ist rein und wird im Selbsttest Fall fuer Fall geprueft. Hier geht
// es um das, was ankommt: traegt jeder Arbeitsbaum einen Schritt, ist die Lage eine der
// drei, und steht jeder Change in der Gruppe genau eines Baums. Wie beim vorigen Change
// laeuft das ohne FastAPI und ohne Netz.
//
// Jeder Aufruf geht mit `--root` auf ein Wegwerf-Repo, das dieser Test selbst baut: je
// Stufe des Ablaufs ein Arbeitsbaum. Frueher lief er gegen den Arbeits-Clone und wurde
// rot, sobald ein paralleler Arbeitsraum mitten in der Umsetzung stand (Issue #722) --
// ein Befund ueber den Zufall des Arbeitsstands, nicht ueber das Werkzeug.

import { strict as assert } from "node:assert";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  arbeitsbaum, commitAlles, legeChange, neuesRepo, ops, schreibe,
} from "./lagebild-fixture.mjs";

const LAGEN = ["tun", "warten", "ruhe"];

/**
 * Ein Wegwerf-Repo mit einem Arbeitsbaum je Stufe. Die Namen tragen die Stufe, damit
 * eine Meldung sofort sagt, welcher Fall gebrochen ist.
 */
function stufenRepo() {
  const repo = neuesRepo("ops-stufen-");
  legeChange(repo.wurzel, "probe-haupt", [[false, "1.1", "Liegt im Hauptbaum"]]);
  commitAlles(repo.wurzel, "Probe: Hauptbaum");

  const baeume = {};
  const mitChange = (name, aufgaben, gates) => {
    const baum = arbeitsbaum(repo.wurzel, name);
    legeChange(baum, name, aufgaben, { gates });
    commitAlles(baum, `Probe: ${name}`);
    baeume[name] = baum;
    return baum;
  };

  mitChange("probe-plan", [[false, "1.1", "Planen"]], []);
  mitChange("probe-test", [[false, "1.1", "Testen"]], ["gate1"]);
  mitChange("probe-arbeit", [[true, "1.1", "Test schreiben"], [false, "1.2", "Modul anlegen"]],
    ["gate1", "gate2"]);
  mitChange("probe-abschluss", [[true, "1.1", "Alles erledigt"]], ["gate1", "gate2"]);
  mitChange("probe-pr", [[true, "1.1", "Alles erledigt"]], ["gate1", "gate2", "fertig"]);

  // Uncommittet geht allem anderen vor: derselbe Stand wie probe-abschluss, dazu eine Datei.
  const offen = mitChange("probe-offen", [[true, "1.1", "Alles erledigt"]], ["gate1", "gate2"]);
  schreibe(join(offen, "notiz.txt"), "noch nicht committet\n");

  // Ein Arbeitsbaum ohne eigenen Change: seine Auskunft ist, dass er frei ist.
  baeume["probe-leer"] = arbeitsbaum(repo.wurzel, "probe-leer");

  return { ...repo, baeume };
}

let repo;
let nutzlast;

before(() => {
  repo = stufenRepo();
  const lauf = ops("--root", repo.wurzel, "--web", "--trocken");
  assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  nutzlast = JSON.parse(lauf.aus);
});

after(() => repo?.aufraeumen());

function baum(name) {
  const wt = nutzlast.worktrees.find((eintrag) => eintrag.name === name);
  assert.ok(wt, `Arbeitsbaum ${name} fehlt in der Nutzlast`);
  return wt;
}

describe("Das Lagebild bleibt beim Wegwerf-Repo", () => {
  it("fuehrt genau den Hauptbaum und die gebauten Arbeitsbaeume", () => {
    const namen = nutzlast.worktrees.map((wt) => wt.name).sort();
    assert.deepEqual(namen, [...Object.keys(repo.baeume), "probe-repo"].sort());
  });

  it("fuehrt keinen Change aus dem aufrufenden Clone", () => {
    const fremd = nutzlast.changes.map((ch) => ch.name).filter((name) => !name.startsWith("probe-"));
    assert.deepEqual(fremd, [], "diese Changes stammen nicht aus dem Wegwerf-Repo");
  });
});

describe("Jeder Arbeitsbaum nennt seinen naechsten Schritt", () => {
  it("traegt zu jedem Baum einen Schritt mit Text, Lage und Befehlsfeld", () => {
    for (const wt of nutzlast.worktrees) {
      assert.ok(wt.schritt, `Schritt fehlt bei ${wt.name}`);
      assert.ok(wt.schritt.text?.length > 0, `Schritt ohne Text bei ${wt.name}`);
      assert.ok(LAGEN.includes(wt.schritt.lage),
        `unbekannte Lage ${wt.schritt.lage} bei ${wt.name}`);
      assert.equal(typeof wt.schritt.befehl, "string",
        `Befehlsfeld fehlt bei ${wt.name} -- leer ist erlaubt, fehlen nicht`);
    }
  });

  it("nennt das Committen, solange Dateien offen sind", () => {
    // Uncommittete Aenderungen gehen allem anderen vor: was nicht committet ist,
    // steht in keinem Pull Request und in keinem Nachweis.
    const wt = baum("probe-offen");
    assert.ok(wt.dateien.length > 0, "der Aufbau hat probe-offen keine offene Datei gelassen");
    assert.equal(wt.schritt.lage, "tun");
    assert.match(wt.schritt.befehl, /git\s+(add|commit)/);
  });

  it("verlangt Gate 1, solange der Plan fehlt", () => {
    assert.equal(baum("probe-plan").schritt.befehl, "just gate1 probe-plan");
  });

  it("verlangt Gate 2, sobald der Plan steht", () => {
    assert.match(baum("probe-test").schritt.befehl, /^just gate2 probe-test\b/);
  });

  it("nennt die offene Aufgabe und laesst den Befehl leer", () => {
    // Das ist der Fall, an dem der alte Test am Arbeits-Clone rot wurde: ein sauberer
    // Baum mitten in der Umsetzung soll etwas tun, aber es gibt keinen Befehl dafuer.
    const { schritt } = baum("probe-arbeit");
    assert.equal(schritt.lage, "tun");
    assert.match(schritt.text, /Modul anlegen/);
    assert.equal(schritt.befehl, "");
  });

  it("verlangt den Abschluss, wenn alle Aufgaben erledigt sind", () => {
    assert.equal(baum("probe-abschluss").schritt.befehl, "just fertig probe-abschluss");
  });

  it("verlangt den Pull Request, wenn ein sauberer Baum fertig ist", () => {
    const { schritt } = baum("probe-pr");
    assert.equal(schritt.lage, "tun");
    assert.match(schritt.befehl, /^just (change-)?pr probe-pr$/);
  });

  it("laesst einen Baum ohne Change ruhen und sagt, dass er frei ist", () => {
    const { schritt } = baum("probe-leer");
    assert.equal(schritt.lage, "ruhe");
    assert.ok(schritt.text.length > 0);
  });

  it("laesst den sauberen Hauptbaum ruhen", () => {
    const haupt = nutzlast.worktrees.find((wt) => wt.haupt);
    assert.equal(haupt.name, "probe-repo");
    assert.equal(haupt.schritt.lage, "ruhe");
  });
});

describe("Changes stehen bei genau einem Arbeitsbaum", () => {
  it("ordnet jeden Change genau einer Gruppe zu", () => {
    const gruppen = nutzlast.worktrees.flatMap((wt) => wt.changes);
    assert.deepEqual([...new Set(gruppen)].sort(), [...gruppen].sort(),
      "ein Change steht in mehr als einer Gruppe");
  });

  it("laesst keinen Change ausserhalb einer Gruppe stehen", () => {
    const gruppen = new Set(nutzlast.worktrees.flatMap((wt) => wt.changes));
    assert.ok(nutzlast.changes.length > 0, "die Nutzlast fuehrt keinen Change");
    for (const ch of nutzlast.changes) {
      assert.ok(gruppen.has(ch.name), `${ch.name} steht in keiner Gruppe`);
    }
  });

  it("ordnet jeden Stufen-Change seinem eigenen Baum zu", () => {
    for (const name of Object.keys(repo.baeume).filter((n) => n !== "probe-leer")) {
      assert.deepEqual(baum(name).changes, [name], `${name} traegt nicht genau seinen Change`);
    }
    assert.deepEqual(baum("probe-repo").changes, ["probe-haupt"]);
  });

  it("fuehrt einen Arbeitsbaum ohne Change trotzdem", () => {
    // Ein leerer Baum verschwindet nicht: sein Schritt ist die Auskunft, dass er frei ist.
    const leer = baum("probe-leer");
    assert.deepEqual(leer.changes, []);
    assert.ok(leer.schritt.text.length > 0, "leerer Baum ohne Auskunft");
  });
});

describe("Die Regel bleibt im Selbsttest geprueft", () => {
  it("--selftest laeuft durch", () => {
    const lauf = ops("--selftest");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  });

  it("--once bleibt unberuehrt und laeuft ohne Fremdbibliothek", () => {
    const lauf = ops("--root", repo.wurzel, "--once");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  });
});
