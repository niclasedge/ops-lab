// Die Nutzlast der Web-Ansicht, geprueft durch `ops.py --web --trocken`.
//
// Der Trockenlauf gibt genau das JSON aus, das die HTTP-Ansicht ausliefert, startet
// aber keinen Server und laedt keine Fremdbibliothek. Deshalb laeuft dieser Test in
// jeder Umgebung, in der `just test` heute schon laeuft -- ohne FastAPI, ohne Netz.
// Geprueft wird damit die Logik der Nutzlast, nicht die Verdrahtung von HTTP.
//
// Jeder Aufruf von ops.py laeuft mit `--root` gegen ein Wegwerf-Repo, das dieser Test
// sich selbst baut (`probeRepo`). Frueher liefen die Invarianten am Arbeits-Clone und
// wurden rot, sobald parallele Arbeitsraeume dort standen, oder brachen an der
// 1-MiB-Grenze von spawnSync ab (Issue #722). Beides nimmt `tests/lagebild-fixture.mjs`
// heraus: eigene Repos und eine Ausgabe ohne Puffergrenze.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  GROSS_AUFGABEN, MIB, WURZEL, git, grossesRepo, legeChange, ops, pythonAufruf, schreibe,
} from "./lagebild-fixture.mjs";

/**
 * Ein Wegwerf-Repo im Temporaerverzeichnis, dessen Nutzlast der Test vorher kennt:
 * Hauptbaum `probe-repo` mit dem Change `probe-haupt` (Gate 1 belegt, sauberer Baum),
 * Arbeitsbaum `probe-zweig` unter `.claude/worktrees/` auf `change/probe-zweig`, der den
 * gleichnamigen Change traegt, eine abgehakte und committete Aufgabe vorweist und je eine
 * vorgemerkte, geaenderte, unverfolgte und geloeschte Datei stehen hat.
 *
 * Der Aufwand hat einen Grund: ein Test, der sich auf einen Arbeitsraum dieses Repos
 * stuetzt, faellt, sobald der Ablauf ihn planmaessig abraeumt. Was der Test selbst baut,
 * kann ihm der Ablauf nicht nehmen.
 *
 * Jeder Zustand hier ist hergestellt, nicht angefallen. Am laufenden Repo lag zuletzt
 * genau eine Datei einer einzigen Art vor -- die drei uebrigen Arten waeren damit
 * ungeprueft geblieben, und ein sauberer Arbeitsbaum haette den ganzen Abschnitt
 * gegenstandslos gemacht, ohne dass eine Pruefung rot geworden waere.
 */
function probeRepo() {
  const huelle = mkdtempSync(join(tmpdir(), "ops-probe-"));
  const wurzel = join(huelle, "probe-repo");
  mkdirSync(wurzel, { recursive: true });

  git(wurzel, "init", "-q", "-b", "main");
  git(wurzel, "config", "user.email", "probe@ops-lab.invalid");
  git(wurzel, "config", "user.name", "Probe");
  schreibe(join(wurzel, ".gitignore"), ".claude/\n");
  schreibe(join(wurzel, "README.md"), "Wegwerf-Repo für den Trockenlauf.\n");
  // Muss im Hauptbaum committet sein, damit ihr Entfernen im Arbeitsbaum als
  // geloescht zaehlt und nicht bloss als nie vorhanden.
  schreibe(join(wurzel, "altlast.md"), "Wird im Arbeitsbaum entfernt.\n");
  legeChange(wurzel, "probe-haupt", [[true, "1.1", "Plan schreiben"], [false, "1.2", "Umsetzen"]]);
  schreibe(join(wurzel, "openspec", "changes", "probe-haupt", "gate1.md"), "# Gate 1 — probe-haupt\n");
  git(wurzel, "add", "-A");
  git(wurzel, "commit", "-qm", "Probe: Hauptbaum");

  const zweig = join(wurzel, ".claude", "worktrees", "probe-zweig");
  git(wurzel, "worktree", "add", "-q", zweig, "-b", "change/probe-zweig");
  legeChange(zweig, "probe-zweig", [
    [true, "1.1", "Test schreiben"], [false, "1.2", "Modul anlegen"], [false, "1.3", "Aufräumen"]]);
  git(zweig, "add", "-A");
  git(zweig, "commit", "-qm", "Probe: Arbeitsbaum");

  // Eine Aufgabe abhaken und einzeln committen: daraus entsteht die Fertigstellung,
  // die die Zeitleiste fuehren muss. Ohne diesen Schritt ist sie am Probe-Repo leer,
  // und jede Aussage ueber ihre Eintraege laeuft ueber nichts.
  const aufgabenPfad = join(zweig, "openspec", "changes", "probe-zweig", "tasks.md");
  schreibe(aufgabenPfad,
    readFileSync(aufgabenPfad, "utf8").replace("- [ ] 1.2 Modul anlegen", "- [x] 1.2 Modul anlegen"));
  git(zweig, "add", "-A");
  git(zweig, "commit", "-qm", "Probe: 1.2 Modul anlegen erledigt");

  // Ein Arbeitsstand, den die Nutzlast als Zaehler und Dateiliste ausweisen muss --
  // je einmal pro Art, damit keine davon ungeprueft bleibt.
  schreibe(join(zweig, "README.md"), "Im Arbeitsbaum geändert.\n");   // geaendert
  schreibe(join(zweig, "notiz.txt"), "unverfolgt\n");                 // unverfolgt
  schreibe(join(zweig, "merkzettel.md"), "vorgemerkt\n");
  git(zweig, "add", "merkzettel.md");                                 // vorgemerkt
  rmSync(join(zweig, "altlast.md"));                                  // geloescht

  return { wurzel, zweig, aufraeumen: () => rmSync(huelle, { recursive: true, force: true }) };
}

// Einmal gebaut, von allen Abschnitten genutzt: das Repo anzulegen kostet mehrere
// git-Aufrufe, und keiner der Tests veraendert es.
let probe;
let probelast;

before(() => {
  probe = probeRepo();
  const lauf = ops("--root", probe.wurzel, "--web", "--trocken");
  assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  probelast = JSON.parse(lauf.aus);
});

after(() => probe?.aufraeumen());

/** Der Change des Arbeitsbaums im Wegwerf-Repo -- der Fall, der frueher `lagebild-web` war. */
function probeChange() {
  return probelast.changes.find((ch) => ch.name === "probe-zweig");
}

describe("Trockenlauf gibt die Nutzlast aus", () => {
  let lauf;
  let nutzlast;

  before(() => {
    lauf = ops("--root", probe.wurzel, "--web", "--trocken");
    if (lauf.code === 0) nutzlast = JSON.parse(lauf.aus);
  });

  it("endet mit Exit 0", () => {
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  });

  it("schreibt ein JSON-Objekt mit worktrees, changes und zeitleiste", () => {
    assert.ok(nutzlast, "keine Nutzlast geparst");
    assert.ok(Array.isArray(nutzlast.worktrees), "worktrees fehlt oder ist keine Liste");
    assert.ok(Array.isArray(nutzlast.changes), "changes fehlt oder ist keine Liste");
    assert.ok(Array.isArray(nutzlast.zeitleiste), "zeitleiste fehlt oder ist keine Liste");
  });

  it("nennt den Zeitpunkt der Erhebung und die Repo-Wurzel", () => {
    assert.match(nutzlast.generated, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(nutzlast.root.length > 0);
  });
});

describe("Jeder Worktree traegt Stand und Zeitpunkt", () => {
  let wt;

  before(() => {
    wt = probelast.worktrees.find((eintrag) => eintrag.name === "probe-zweig");
  });

  it("findet den Arbeitsbaum des beobachteten Repos", () => {
    assert.ok(wt, "der Arbeitsbaum probe-zweig fehlt in der Nutzlast");
  });

  it("nennt Pfad, Name, Branch und Kopfstand mit Betreff", () => {
    assert.equal(wt.pfad, realpathSync(probe.zweig));
    assert.equal(wt.name, "probe-zweig");
    assert.equal(wt.branch, "change/probe-zweig");
    assert.match(wt.kopf, /^[0-9a-f]{7,}$/);
    assert.equal(wt.betreff, "Probe: 1.2 Modul anlegen erledigt");
  });

  it("nennt den Zeitpunkt des Kopfcommits und die juengste Aenderung", () => {
    assert.match(wt.kopf_zeit, /^\d{4}-\d{2}-\d{2}/);
    assert.equal(typeof wt.geaendert_am, "number");
    assert.ok(wt.geaendert_am > 0, "Zeitpunkt der juengsten Aenderung fehlt");
  });

  it("nennt den Arbeitsstand als drei Zaehler", () => {
    // Das Wegwerf-Repo laesst hier je einen Fall pro Art stehen: an festen Zahlen
    // faellt auf, was `typeof number` durchliesse. Die geloeschte Datei hat keinen
    // eigenen Zaehler und laeuft unter geaendert mit -- daher dort zwei.
    assert.equal(wt.vorgemerkt, 1);
    assert.equal(wt.geaendert, 2);
    assert.equal(wt.unverfolgt, 1);
    assert.equal(wt.haupt, false, "der Arbeitsbaum ist nicht der Hauptbaum");
  });

  it("weist den Hauptbaum als solchen aus und laesst ihn sauber", () => {
    const haupt = probelast.worktrees.find((eintrag) => eintrag.haupt);
    assert.equal(haupt.name, "probe-repo");
    assert.equal(haupt.vorgemerkt + haupt.geaendert + haupt.unverfolgt, 0);
  });
});

describe("Jeder Change traegt Bereitschaft, Stand und Belegplatz", () => {
  let change;

  before(() => {
    change = probeChange();
  });

  it("findet den Change dieses Worktrees", () => {
    assert.ok(change, "Change probe-zweig nicht in der Nutzlast");
  });

  it("nennt eine der fuenf Bereitschaften", () => {
    assert.ok(["frei", "laeuft", "fertig", "im PR", "blockiert"].includes(change.bereitschaft),
      `unbekannte Bereitschaft: ${change.bereitschaft}`);
  });

  it("nennt Worktree, Aufgabenstand und bestandene Gates", () => {
    assert.equal(change.worktree, "probe-zweig");
    assert.equal(change.erledigt, 2);
    assert.equal(change.gesamt, 3);
    assert.deepEqual(change.gates, [], "ohne Nachweis im Ordner steht hier kein Gate");
    const mitGate = probelast.changes.find((ch) => ch.name === "probe-haupt");
    assert.ok(mitGate.gates.includes("gate1"), "ein vorliegendes gate1.md muss dastehen");
  });

  it("nennt die naechste offene Aufgabe, solange es eine gibt", () => {
    assert.ok(change.naechste, "naechste offene Aufgabe fehlt");
    assert.equal(change.naechste.text, "Aufräumen");
  });

  it("nennt, worauf ein blockierter Change wartet", () => {
    assert.ok(Array.isArray(change.blockiert_durch));
    if (change.bereitschaft === "blockiert") {
      assert.ok(change.blockiert_durch.length > 0, "blockiert ohne Grund");
    }
  });

  it("haelt das Feld belege als leere Liste frei", () => {
    assert.ok(Array.isArray(change.belege), "Feld belege fehlt oder ist keine Liste");
    assert.equal(change.belege.length, 0, "dieser Change liefert keine Belege ein");
  });

  it("nennt den Zeitpunkt der juengsten Aenderung", () => {
    assert.equal(typeof change.geaendert_am, "number");
    assert.ok(change.geaendert_am > 0);
  });
});

describe("Die Zeitleiste steht absteigend und ungekuerzt", () => {
  let zeitleiste;

  before(() => {
    const lauf = ops("--root", probe.wurzel, "--web", "--trocken");
    zeitleiste = lauf.code === 0 ? JSON.parse(lauf.aus).zeitleiste : null;
  });

  it("ist eine Liste", () => {
    assert.ok(Array.isArray(zeitleiste));
  });

  it("fuehrt am Probe-Repo die Fertigstellung, die der Aufbau angelegt hat", () => {
    // Die 15 Eintraege des laufenden Repos sind angefallen, nicht zugesichert: sie
    // stammen aus den Changes, die gerade offen sind. Faellt ihre Zahl auf null,
    // iterieren die Pruefungen darunter ueber nichts und bleiben trotzdem gruen.
    // Deshalb hier ein Gegenstand, den der Aufbau selbst hergestellt hat.
    assert.ok(probelast.zeitleiste.length > 0,
      "die Zeitleiste des Probe-Repos ist leer, obwohl dort eine Aufgabe abgehakt wurde");
    assert.ok(probelast.zeitleiste.some((e) => e.change === "probe-zweig"),
      "keine Fertigstellung von probe-zweig in der Zeitleiste des Probe-Repos");
  });

  it("nennt je Eintrag Zeitpunkt, Change, Worktree, Nummer, Text und Herkunft", () => {
    for (const eintrag of zeitleiste) {
      for (const feld of ["at", "change", "worktree", "number", "text", "source"]) {
        assert.ok(feld in eintrag, `Feld ${feld} fehlt in einem Eintrag der Zeitleiste`);
      }
    }
  });

  it("steht absteigend nach Zeitpunkt", () => {
    const zeiten = zeitleiste.map((e) => e.at);
    const sortiert = [...zeiten].sort().reverse();
    assert.deepEqual(zeiten, sortiert, "Zeitleiste ist nicht absteigend sortiert");
  });

  it("ist nicht auf zwanzig Eintraege gekuerzt", () => {
    // Die Terminal-Ansicht schneidet bei 20 ab. Die Nutzlast darf das nicht: sie
    // fuehrt jede nachweisbare Fertigstellung der Changes, die sie zeigt. Gezaehlt
    // wird gegen --json, also gegen eine Quelle ausserhalb der geprueften Nutzlast --
    // beide am Wegwerf-Repo, damit Zaehler und Nenner denselben Stand sehen.
    const nutzlast = JSON.parse(ops("--root", probe.wurzel, "--web", "--trocken").aus);
    const gefuehrt = new Set(nutzlast.changes.map((ch) => `${ch.worktree}|${ch.name}`));
    const erwartet = JSON.parse(ops("--root", probe.wurzel, "--json").aus).worktrees
      .flatMap((wt) => wt.changes.map((ch) => ({ wt, ch })))
      .filter(({ wt, ch }) => gefuehrt.has(`${wt.name}|${ch.name}`))
      .reduce((summe, { ch }) => summe + ch.completions.length, 0);
    assert.equal(zeitleiste.length, erwartet,
      `Zeitleiste hat ${zeitleiste.length} von ${erwartet} nachweisbaren Fertigstellungen`);
  });
});

describe("Ein Change gehoert dem Arbeitsbaum, der ihn bearbeitet", () => {
  let changes;
  let worktrees;

  before(() => {
    // Ungefiltert: erst mit allen Arbeitsbaeumen entsteht die Frage nach Dubletten.
    const lauf = ops("--root", probe.wurzel, "--web", "--trocken");
    const nutzlast = lauf.code === 0 ? JSON.parse(lauf.aus) : { changes: [], worktrees: [] };
    changes = nutzlast.changes;
    worktrees = nutzlast.worktrees;
  });

  it("fuehrt jeden Change genau einmal", () => {
    const namen = changes.map((ch) => ch.name);
    const doppelt = namen.filter((name, i) => namen.indexOf(name) !== i);
    assert.deepEqual([...new Set(doppelt)], [], "diese Changes stehen mehrfach in der Nutzlast");
  });

  it("weist zu jedem Change aus, ob er vom Hauptbaum abweicht", () => {
    for (const ch of changes) {
      assert.equal(typeof ch.weicht_ab, "boolean", `Merkmal weicht_ab fehlt bei ${ch.name}`);
    }
  });

  // Die Zuordnung eines nur im Arbeitsbaum liegenden Changes steht weiter unten, im
  // Abschnitt ueber das beobachtete Repo: sie braucht einen Namen, und der gehoert ins
  // Wegwerf-Repo. Hier bleibt, was ueber alle Arbeitsbaeume gilt, ohne einen zu nennen.

  it("laesst einen unveraenderten Change beim Hauptbaum", () => {
    const haupt = worktrees.find((wt) => wt.haupt);
    assert.ok(haupt, "kein Hauptbaum in der Nutzlast");
    for (const ch of changes.filter((c) => c.worktree === haupt.name)) {
      assert.equal(ch.weicht_ab, false,
        `${ch.name} steht beim Hauptbaum und darf dort nicht als abweichend gelten`);
    }
  });

  it("nennt weitere Arbeitsbaeume, die denselben Change tragen", () => {
    // Genau einmal heisst nicht verschweigen: liegt ein Change abweichend in zwei
    // Baeumen, gewinnt der juengere und der andere steht im selben Eintrag.
    for (const ch of changes) {
      assert.ok(Array.isArray(ch.auch_in), `Feld auch_in fehlt bei ${ch.name}`);
      assert.ok(!ch.auch_in.includes(ch.worktree),
        `${ch.name} nennt seinen eigenen Arbeitsbaum als weiteren Ort`);
    }
  });

  it("nennt je Arbeitsbaum nur die ihm zugeordneten Changes", () => {
    for (const wt of worktrees) {
      const zugeordnet = changes.filter((ch) => ch.worktree === wt.name).map((ch) => ch.name).sort();
      assert.deepEqual([...wt.changes].sort(), zugeordnet,
        `die Changeliste von ${wt.name} passt nicht zur Zuordnung`);
    }
  });
});

describe("Geaenderte Dateien stehen beim Namen", () => {
  let worktrees;

  before(() => {
    const lauf = ops("--root", probe.wurzel, "--web", "--trocken");
    worktrees = lauf.code === 0 ? JSON.parse(lauf.aus).worktrees : [];
  });

  it("fuehrt zu jedem Arbeitsbaum eine Dateiliste", () => {
    for (const wt of worktrees) {
      assert.ok(Array.isArray(wt.dateien), `Dateiliste fehlt bei ${wt.name}`);
    }
  });

  it("nennt je Datei Pfad und eine der vier Arten", () => {
    const arten = ["vorgemerkt", "geaendert", "unverfolgt", "geloescht"];
    for (const wt of worktrees) {
      for (const datei of wt.dateien ?? []) {
        assert.ok(datei.pfad?.length > 0, `Eintrag ohne Pfad bei ${wt.name}`);
        assert.ok(arten.includes(datei.art), `unbekannte Art ${datei.art} bei ${wt.name}`);
      }
    }
  });

  it("belegt am Probe-Repo jede der vier Arten", () => {
    // Die Pruefung darueber zaehlt vier Arten auf, am laufenden Repo lag zuletzt eine
    // einzige vor. Welche Arten dort vorkommen, entscheidet der Zufall des Arbeitsstands;
    // ein sauberes Repo macht den ganzen Abschnitt gegenstandslos, ohne rot zu werden.
    const baum = probelast.worktrees.find((wt) => wt.name === "probe-zweig");
    assert.ok(baum, "Arbeitsbaum probe-zweig fehlt in der Nutzlast des Probe-Repos");
    const gefunden = new Set((baum.dateien ?? []).map((d) => d.art));
    for (const art of ["vorgemerkt", "geaendert", "unverfolgt", "geloescht"]) {
      assert.ok(gefunden.has(art),
        `keine Datei der Art ${art} — belegt sind: ${[...gefunden].join(", ") || "keine"}`);
    }
  });

  it("sortiert die Dateiliste nach Pfad", () => {
    for (const wt of worktrees) {
      const pfade = (wt.dateien ?? []).map((d) => d.pfad);
      assert.deepEqual(pfade, [...pfade].sort(), `Dateiliste von ${wt.name} ist unsortiert`);
    }
  });

  it("haelt die Liste leer, wenn der Arbeitsbaum sauber ist", () => {
    for (const wt of worktrees) {
      const sauber = wt.vorgemerkt + wt.geaendert + wt.unverfolgt === 0;
      assert.equal((wt.dateien ?? []).length === 0, sauber,
        `Dateiliste und Zaehler widersprechen sich bei ${wt.name}`);
    }
  });
});

describe("Die Aufgaben eines Changes stehen zum Aufklappen bereit", () => {
  let change;

  before(() => {
    change = probeChange();
  });

  it("fuehrt so viele Aufgaben, wie der Change zaehlt", () => {
    assert.ok(Array.isArray(change?.aufgaben), "Aufgabenliste fehlt");
    assert.equal(change.aufgaben.length, change.gesamt);
  });

  it("nennt je Aufgabe Nummer, Text, Abschnitt und das Merkmal erledigt", () => {
    for (const aufgabe of change.aufgaben) {
      assert.equal(typeof aufgabe.nummer, "string");
      assert.ok(aufgabe.text.length > 0, "Aufgabe ohne Text");
      assert.ok(aufgabe.abschnitt.length > 0, "Aufgabe ohne Abschnitt");
      assert.equal(typeof aufgabe.erledigt, "boolean");
    }
  });

  it("zaehlt genauso viele erledigte wie der Stand des Changes", () => {
    assert.equal(change.aufgaben.filter((a) => a.erledigt).length, change.erledigt);
  });

  it("haelt die Reihenfolge der tasks.md", () => {
    const quelle = readFileSync(
      join(probe.zweig, "openspec", "changes", "probe-zweig", "tasks.md"), "utf8");
    const stellen = change.aufgaben.map((a) => quelle.indexOf(a.text.split(":")[0].slice(0, 40)));
    assert.ok(stellen.every((stelle) => stelle >= 0), "eine Aufgabe steht so nicht in der tasks.md");
    assert.deepEqual(stellen, [...stellen].sort((a, b) => a - b),
      "die Aufgaben stehen nicht in der Reihenfolge der Datei");
  });
});

describe("Das Lagebild bleibt ohne Fremdbibliothek lauffaehig", () => {
  it("--once laeuft durch", () => {
    const lauf = ops("--root", probe.wurzel, "--once");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  });

  it("--json laeuft durch", () => {
    const lauf = ops("--root", probe.wurzel, "--json");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
    assert.ok(JSON.parse(lauf.aus).totals);
  });

  it("--selftest laeuft durch", () => {
    const lauf = ops("--selftest");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
  });

  it("importiert FastAPI nicht auf Modulebene", () => {
    // Der Import gehoert in die Funktion, die --web bedient. Steht er oben, faellt
    // jeder abhaengigkeitsfreie Aufruf mit, sobald die Bibliothek fehlt.
    const quelle = readFileSync(join(WURZEL, "ops.py"), "utf8");
    const oben = quelle.split("\n").filter((zeile) => /^(import|from)\s+(fastapi|uvicorn)\b/.test(zeile));
    assert.deepEqual(oben, [], "fastapi oder uvicorn steht auf Modulebene in ops.py");
  });
});

describe("Das Lagebild beobachtet ein fremdes Repo", () => {
  it("nennt das beobachtete Repo als Wurzel und fuehrt dessen Hauptbaum", () => {
    assert.equal(realpathSync(probelast.root), realpathSync(probe.wurzel));
    const haupt = probelast.worktrees.find((wt) => wt.haupt);
    assert.equal(haupt.name, "probe-repo");
    assert.ok(probelast.changes.some((ch) => ch.name === "probe-haupt"),
      "der Change des Hauptbaums fehlt in der Nutzlast");
  });

  it("fuehrt den Arbeitsbaum des beobachteten Repos mit Branch und Kopfstand", () => {
    assert.equal(probelast.worktrees.length, 2, "genau zwei Arbeitsbaeume erwartet");
    const zweig = probelast.worktrees.find((wt) => wt.name === "probe-zweig");
    assert.ok(zweig, "der Arbeitsbaum probe-zweig fehlt");
    assert.equal(zweig.branch, "change/probe-zweig");
    assert.equal(zweig.haupt, false);
    assert.match(zweig.kopf, /^[0-9a-f]{7,}$/);
    assert.ok(zweig.betreff.length > 0, "Betreff des Kopfcommits fehlt");
  });

  it("ordnet einen nur im Arbeitsbaum liegenden Change diesem Baum zu", () => {
    const eigene = probelast.changes.filter((ch) => ch.name === "probe-zweig");
    assert.equal(eigene.length, 1, "probe-zweig steht nicht genau einmal in der Nutzlast");
    assert.equal(eigene[0].worktree, "probe-zweig");
    assert.equal(eigene[0].weicht_ab, true, "ein nur dort liegender Change weicht ab");
  });

  it("laesst das aufrufende Repo vollstaendig draussen", () => {
    // Der Lauf startet im ops-lab. Taucht davon irgendetwas auf, hat --root nicht
    // getrennt -- und genau daran hingen die Tests, die das Aufraeumen umgeworfen hat.
    const fremd = [
      ...probelast.worktrees.map((wt) => wt.name),
      ...probelast.changes.map((ch) => ch.name),
    ].filter((name) => !name.startsWith("probe-"));
    assert.deepEqual(fremd, [], "diese Eintraege stammen nicht aus dem beobachteten Repo");
  });
});

// --- Erreichbarkeit der Ansicht ---------------------------------------------
//
// Der Host der VM soll das Lagebild sehen koennen, und ein belegter Port soll sich
// als Satz melden statt als Traceback. Beide Pruefungen kommen ohne FastAPI aus:
// die Startmeldung ist eine reine Funktion, und der belegte Port faellt auf, bevor
// die Fremdbibliothek ueberhaupt geladen wird.

/** Ein Ausdruck gegen das importierte Modul -- fuer die reinen Funktionen. */
function pythonWert(ausdruck) {
  const { befehl, vorab } = pythonAufruf();
  const lauf = spawnSync(befehl, [...vorab, "-c", `import ops; print(${ausdruck})`],
    { cwd: WURZEL, encoding: "utf8", timeout: 120_000 });
  return { code: lauf.status, aus: (lauf.stdout ?? "").trim(), fehler: lauf.stderr ?? "" };
}

/** Haelt einen Port besetzt, solange die Rueckgabe nicht aufgerufen wird. */
function besetzterPort() {
  return new Promise((fertig) => {
    const dienst = createServer();
    dienst.listen(0, "127.0.0.1", () => {
      const port = dienst.address().port;
      fertig({ port, freigeben: () => new Promise((zu) => dienst.close(zu)) });
    });
  });
}

describe("Die Ansicht ist ueber ihre Bindeadresse erreichbar", () => {
  it("nimmt --web-host entgegen", () => {
    const lauf = ops("--root", probe.wurzel, "--web", "--trocken", "--web-host", "0.0.0.0");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
    assert.equal(JSON.parse(lauf.aus).root !== undefined, true, "die Nutzlast fehlt");
  });

  it("bindet ohne Angabe auf 127.0.0.1", () => {
    const vorgabe = pythonWert("ops.WEB_HOST");
    assert.equal(vorgabe.code, 0, `stderr: ${vorgabe.fehler}`);
    assert.equal(vorgabe.aus, "127.0.0.1");
  });

  it("nennt in der Startmeldung die lokale Adresse ohne Netz-Hinweis", () => {
    const meldung = pythonWert('ops.web_meldung("127.0.0.1", 8765)');
    assert.equal(meldung.code, 0, `stderr: ${meldung.fehler}`);
    assert.match(meldung.aus, /http:\/\/127\.0\.0\.1:8765/);
    assert.doesNotMatch(meldung.aus, /lokalen Netz/);
  });

  it("weist bei offener Bindung auf das lokale Netz hin", () => {
    const meldung = pythonWert('ops.web_meldung("0.0.0.0", 8790)');
    assert.equal(meldung.code, 0, `stderr: ${meldung.fehler}`);
    assert.match(meldung.aus, /8790/);
    assert.match(meldung.aus, /lokalen Netz/);
  });
});

describe("Ein belegter Port meldet sich als Satz", () => {
  it("nennt Port und Schalter und behauptet keinen Start", async () => {
    const { port, freigeben } = await besetzterPort();
    try {
      const lauf = ops("--root", probe.wurzel, "--web", "--web-port", String(port));
      const text = `${lauf.aus}${lauf.fehler}`;
      assert.notEqual(lauf.code, 0, "ein belegter Port darf nicht mit Null enden");
      assert.match(text, new RegExp(String(port)), "der belegte Port wird nicht genannt");
      assert.match(text, /--web-port/, "der Ausweg wird nicht genannt");
      assert.doesNotMatch(lauf.aus, /Lagebild: http/,
        "die Ansicht behauptet einen Start, den es nicht gab");
    } finally {
      await freigeben();
    }
  });
});

// --- Grosse Nutzlast ------------------------------------------------------------
//
// Am Arbeits-Clone war die Nutzlast groesser als 1 MiB, und spawnSync schnitt sie in
// der Vorgabe genau dort ab: `JSON.parse` meldete einen Fehler mitten im Text, nicht
// das Ende. Dieser Fall stellt eine solche Nutzlast her, statt auf einen vollen Clone
// zu warten.

const GROSS_CHANGES = 4;

describe("Eine Nutzlast ueber 1 MiB kommt ganz an", () => {
  let gross;

  before(() => {
    gross = grossesRepo(GROSS_CHANGES);
  });

  after(() => gross?.aufraeumen());

  it("liest --web --trocken vollstaendig", () => {
    const lauf = ops("--root", gross.wurzel, "--web", "--trocken");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
    assert.ok(Buffer.byteLength(lauf.aus) > MIB,
      `die Nutzlast ist nur ${Buffer.byteLength(lauf.aus)} Bytes gross -- der Fall prueft nichts`);
    const changes = JSON.parse(lauf.aus).changes;
    assert.equal(changes.length, GROSS_CHANGES);
    for (const change of changes) {
      assert.equal(change.aufgaben.length, GROSS_AUFGABEN, `${change.name} fuehrt nicht jede Aufgabe`);
    }
  });

  it("liest --json vollstaendig", () => {
    const lauf = ops("--root", gross.wurzel, "--json");
    assert.equal(lauf.code, 0, `stderr: ${lauf.fehler}`);
    assert.ok(Buffer.byteLength(lauf.aus) > MIB,
      `die Ausgabe ist nur ${Buffer.byteLength(lauf.aus)} Bytes gross -- der Fall prueft nichts`);
    assert.ok(JSON.parse(lauf.aus).totals);
  });
});
