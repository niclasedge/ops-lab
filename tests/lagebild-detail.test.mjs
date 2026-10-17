// Was eine Change-Karte ueber ihren Change sagt: Vorhaben, Anforderungen, Dateien.
//
// Zwei Seiten, zwei Wege. Die Nutzlast laeuft ueber `ops.py --web --trocken` gegen ein
// Wegwerf-Repo, das dieser Test sich selbst baut -- ohne Server, ohne FastAPI, ohne Netz.
// Die Klapplogik der Seite laeuft ueber das Skript aus `WEB_SEITE`, in Node ausgewertet
// mit Attrappen fuer Dokument und Netz.
//
// Kein Name aus diesem Repo taucht hier als Erwartung auf: kein Arbeitsraum, kein Change,
// kein Branch. Was der Ablauf spaeter planmaessig abraeumt, darf keinen Test faellen --
// der Grund steht in docs/beobachtungen.md.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

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
  if (lauf.status !== 0) {
    throw new Error(`git ${argumente.join(" ")} in ${ordner}: ${lauf.stderr}`);
  }
  return lauf.stdout ?? "";
}

function schreibe(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

const PROPOSAL_VOLL = `# probe-detail

## Warum

Der Bedarf in zwei Zeilen.
Mehr steht hier nicht.

## Was aendert sich

Etwas wird anders.

## Was ausdruecklich nicht

Das Archiv bleibt unberuehrt.

## Beruehrte Dateien

- \`werkzeug.py\`
- \`nie-angefasst.md\` (neu)
`;

const PROPOSAL_OHNE_ABGRENZUNG = `# probe-knapp

## Warum

Nur das Warum steht hier.

## Beruehrte Dateien

- \`werkzeug.py\`
`;

const SPEC_ZWEI_BLOECKE = `# probe

## ADDED Requirements

### Requirement: Erste Regel

Das System SHALL das eine tun.

#### Scenario: Erster Fall

- **Given** etwas
- **When** etwas geschieht
- **Then** folgt etwas

#### Scenario: Zweiter Fall

- **Given** etwas anderes
- **When** etwas geschieht
- **Then** folgt etwas anderes

### Requirement: Zweite Regel

Das System SHALL das andere tun.

#### Scenario: Dritter Fall

- **Given** etwas
- **When** etwas geschieht
- **Then** folgt etwas

## MODIFIED Requirements

### Requirement: Alte Regel

Das System SHALL es nun anders tun.

#### Scenario: Vierter Fall

- **Given** etwas
- **When** etwas geschieht
- **Then** folgt etwas
`;

/**
 * Ein Wegwerf-Repo, dessen Nutzlast der Test vorher kennt.
 *
 * Hauptbaum `probe-repo` auf `main` mit `werkzeug.py`; darunter ein Arbeitsbaum, der den
 * Change `probe-detail` traegt. Dessen Zusage nennt zwei Dateien, angefasst sind eine
 * davon (committet geaendert) und eine weitere, die niemand zugesagt hat (unverfolgt) --
 * damit steht jede der drei Lagen genau einmal da.
 *
 * Ein zweiter Change `probe-knapp` liegt ohne Abgrenzung im Hauptbaum: der Fall, in dem
 * die Karte einen Hinweis geben muss statt eines leeren Kastens.
 */
function probeRepo() {
  const huelle = mkdtempSync(join(tmpdir(), "ops-detail-"));
  const wurzel = join(huelle, "probe-repo");
  mkdirSync(wurzel, { recursive: true });

  git(wurzel, "init", "-q", "-b", "main");
  git(wurzel, "config", "user.email", "probe@ops-lab.invalid");
  git(wurzel, "config", "user.name", "Probe");
  schreibe(join(wurzel, ".gitignore"), ".claude/\n");
  schreibe(join(wurzel, "werkzeug.py"), "# Stand im Hauptbaum\n");

  const knapp = join(wurzel, "openspec", "changes", "probe-knapp");
  schreibe(join(knapp, "proposal.md"), PROPOSAL_OHNE_ABGRENZUNG);
  schreibe(join(knapp, "specs", "probe", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: Knappe Regel\n\nDas System SHALL knapp sein.\n\n"
    + "#### Scenario: Knapper Fall\n\n- **Given** wenig\n- **When** wenig geschieht\n- **Then** folgt wenig\n");
  schreibe(join(knapp, "tasks.md"), "# Aufgaben\n\n## Abschnitt\n\n- [ ] 1.1 Etwas tun\n");
  git(wurzel, "add", "-A");
  git(wurzel, "commit", "-qm", "Probe: Hauptbaum");

  const zweig = join(wurzel, ".claude", "worktrees", "probe-detail");
  git(wurzel, "worktree", "add", "-q", zweig, "-b", "change/probe-detail");
  const change = join(zweig, "openspec", "changes", "probe-detail");
  schreibe(join(change, "proposal.md"), PROPOSAL_VOLL);
  schreibe(join(change, "specs", "probe", "spec.md"), SPEC_ZWEI_BLOECKE);
  schreibe(join(change, "tasks.md"),
    "# Aufgaben\n\n## Abschnitt\n\n- [x] 1.1 Test schreiben\n- [ ] 1.2 Umsetzen\n");
  // Zugesagt und angefasst: die Datei steht in der Zusage und weicht von main ab.
  schreibe(join(zweig, "werkzeug.py"), "# Im Arbeitsbaum geaendert\n");
  git(zweig, "add", "-A");
  git(zweig, "commit", "-qm", "Probe: Arbeitsbaum");
  // Angefasst ohne Zusage: nicht committet, aber angefasst ist angefasst.
  schreibe(join(zweig, "ohne-zusage.md"), "Steht in keiner Zusage.\n");

  return { wurzel, zweig, aufraeumen: () => rmSync(huelle, { recursive: true, force: true }) };
}

let probe;
let probelast;

before(() => {
  probe = probeRepo();
  const lauf = ops("--root", probe.wurzel, "--web", "--trocken");
  assert.equal(lauf.code, 0, `Trockenlauf fehlgeschlagen: ${lauf.fehler}`);
  probelast = JSON.parse(lauf.aus);
});

after(() => probe?.aufraeumen());

function probeChange(name) {
  const gefunden = probelast.changes.find((ch) => ch.name === name);
  assert.ok(gefunden, `Change ${name} fehlt in der Nutzlast`);
  return gefunden;
}

describe("Worum es bei einem Change geht", () => {
  it("fuehrt Warum und Abgrenzung im Wortlaut, ohne die Ueberschrift", () => {
    const worum = probeChange("probe-detail").worum;
    assert.equal(worum.warum, "Der Bedarf in zwei Zeilen.\nMehr steht hier nicht.");
    assert.equal(worum.abgrenzung, "Das Archiv bleibt unberuehrt.");
  });

  it("nimmt den Abschnitt in beiden Schreibweisen der Ueberschrift", () => {
    const mitUmlaut = probelast.changes.map((ch) => ch.worum.warum);
    assert.ok(mitUmlaut.every((text) => typeof text === "string"),
      "jeder Change fuehrt ein Warum als Text");
    assert.ok(probeChange("probe-knapp").worum.warum.includes("Nur das Warum"),
      "die Umlautfreie Vorlage wird ebenso gelesen wie die mit Umlaut");
  });

  it("laesst einen fehlenden Abschnitt leer, statt ihn zu erfinden", () => {
    assert.equal(probeChange("probe-knapp").worum.abgrenzung, "");
  });
});

describe("Anforderungen als Titel mit Szenarienzahl", () => {
  it("nennt Capability, Art, Titel und die Zahl der Szenarien", () => {
    assert.deepEqual(probeChange("probe-detail").anforderungen, [
      { capability: "probe", art: "ADDED", titel: "Erste Regel", szenarien: 2 },
      { capability: "probe", art: "ADDED", titel: "Zweite Regel", szenarien: 1 },
      { capability: "probe", art: "MODIFIED", titel: "Alte Regel", szenarien: 1 },
    ]);
  });

  it("fuehrt keinen Fliesstext der Requirements mit", () => {
    const alsText = JSON.stringify(probeChange("probe-detail").anforderungen);
    assert.ok(!alsText.includes("SHALL"), "der Requirement-Text gehoert nicht in die Nutzlast");
    assert.ok(!alsText.includes("Given"), "die Szenarien stehen als Zahl, nicht als Text");
  });
});

describe("Zusage und Diff nebeneinander", () => {
  it("fuehrt die zugesagten Pfade aus Beruehrte Dateien", () => {
    assert.deepEqual(probeChange("probe-detail").dateien.zugesagt,
      ["nie-angefasst.md", "werkzeug.py"]);
  });

  it("fuehrt die angefassten Pfade des Arbeitsbaums, committet wie nicht", () => {
    const angefasst = probeChange("probe-detail").dateien.angefasst;
    assert.ok(angefasst.includes("werkzeug.py"), "die committete Aenderung zaehlt");
    assert.ok(angefasst.includes("ohne-zusage.md"), "die nicht committete Datei zaehlt ebenso");
  });

  it("ordnet jeden Pfad einer der drei Lagen zu", () => {
    const lagen = new Map(
      probeChange("probe-detail").dateien.abgleich.map((e) => [e.pfad, e.lage]));
    assert.equal(lagen.get("werkzeug.py"), "beides");
    assert.equal(lagen.get("nie-angefasst.md"), "nur_zugesagt");
    assert.equal(lagen.get("ohne-zusage.md"), "nur_angefasst");
  });

  it("meldet Deckung als Deckung, statt sie zu verschweigen", () => {
    const abgleich = probeChange("probe-detail").dateien.abgleich;
    assert.ok(abgleich.some((e) => e.lage === "beides"),
      "eine gedeckte Datei muss als gedeckt in der Nutzlast stehen");
  });
});

// --- Die Seite: der Klappstand ---------------------------------------------------

/**
 * Das Skript der Web-Seite, in Node ausgewertet.
 *
 * `WEB_SEITE` ist eine Zeichenkette in ops.py; ausgeliefert wird sie nur mit FastAPI.
 * Fuer die Klapplogik braucht es davon nichts weiter als das Skript selbst -- also wird
 * es geschnitten und mit Attrappen fuer Dokument, Netz und Takt ausgefuehrt. Damit
 * laeuft diese Pruefung in derselben Umgebung wie alle anderen: ohne Browser, ohne
 * Server, ohne Fremdcode.
 */
function seitenSkript() {
  const quelle = readFileSync(join(WURZEL, "ops.py"), "utf8");
  const seite = quelle.match(/WEB_SEITE = """([\s\S]*?)\n"""/);
  assert.ok(seite, "WEB_SEITE nicht in ops.py gefunden");
  const skript = seite[1].match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(skript, "kein Skript in WEB_SEITE gefunden");

  const zuhoerer = [];
  const dokument = {
    addEventListener: (art, fn) => zuhoerer.push({ art, fn }),
    getElementById: () => ({ textContent: "", innerHTML: "" }),
  };
  const bauen = new Function(
    "document", "window", "fetch", "setInterval", "setTimeout",
    `${skript[1]}\nreturn { changeKarte, aufklappbar };`);
  const teile = bauen(dokument, {}, async () => { throw new Error("kein Netz im Test"); },
    () => 0, () => 0);
  return {
    ...teile,
    /** Ein Mensch klappt eine Klappe auf oder zu -- so, wie es der Browser meldet. */
    schalte: (id, offen) => {
      for (const { art, fn } of zuhoerer) {
        if (art === "toggle") fn({ target: { tagName: "DETAILS", dataset: { id }, open: offen } });
      }
    },
  };
}

/** Die Klappen einer gezeichneten Karte: Reihenfolge, Titel, Zustand, Kennung. */
function klappen(html) {
  return [...html.matchAll(/<details data-id="([^"]+)"( open)?><summary>([^<]*)<\/summary>/g)]
    .map((treffer) => ({ id: treffer[1], offen: Boolean(treffer[2]), titel: treffer[3] }));
}

function klappe(html, muster) {
  const gefunden = klappen(html).find((k) => muster.test(k.titel));
  assert.ok(gefunden, `keine Klappe mit Titel nach ${muster} in der Karte`);
  return gefunden;
}

/**
 * Was zwischen Titel und Ende einer Klappe steht.
 *
 * Zugeklappt heisst nicht leer: eine Klappe ohne `open` liefert ihren Inhalt
 * trotzdem mit, der Browser zeigt ihn nur nicht. Wer das pruefen will, muss in die
 * Klappe hineinsehen und darf sich nicht damit begnuegen, dass ein Wort irgendwo in
 * der Karte vorkommt.
 */
function klappenInhalt(html, muster) {
  const treffer = [...html.matchAll(
    /<details data-id="[^"]+"(?: open)?><summary>([^<]*)<\/summary>([\s\S]*?)<\/details>/g)]
    .find((t) => muster.test(t[1]));
  assert.ok(treffer, `keine Klappe mit Titel nach ${muster} in der Karte`);
  return treffer[2];
}

const KARTE_ATTRAPPE = {
  name: "attrappe", worktree: "wt", weicht_ab: true, auch_in: [],
  bereitschaft: "laeuft", status: "in Arbeit", erledigt: 1, gesamt: 2, prozent: 50.0,
  gates: ["gate1"], naechste: { number: "1.2", text: "Umsetzen" }, zuletzt: null,
  blockiert_durch: [], im_pr: false, capabilities: ["probe"], artefakte: [],
  abschnitte: [], geaendert_am: 1_700_000_000, belege: [],
  aufgaben: [{ nummer: "1.1", text: "Test schreiben", erledigt: true, abschnitt: "A" },
             { nummer: "1.2", text: "Umsetzen", erledigt: false, abschnitt: "A" }],
  worum: { warum: "Der Bedarf.", abgrenzung: "Die Abgrenzung." },
  anforderungen: [{ capability: "probe", art: "ADDED", titel: "Erste Regel", szenarien: 2 }],
  dateien: {
    zugesagt: ["werkzeug.py"], angefasst: ["werkzeug.py", "ohne-zusage.md"],
    abgleich: [{ pfad: "ohne-zusage.md", lage: "nur_angefasst" },
               { pfad: "werkzeug.py", lage: "beides" }],
  },
};

describe("Die Change-Karte traegt vier Klappen", () => {
  it("zeigt Worum es geht, Anforderungen, Dateien und Aufgaben in dieser Reihenfolge", () => {
    const { changeKarte } = seitenSkript();
    const titel = klappen(changeKarte(KARTE_ATTRAPPE)).map((k) => k.titel);
    assert.equal(titel.length, 4, `vier Klappen erwartet, bekommen: ${titel.join(" | ")}`);
    assert.match(titel[0], /Worum/);
    assert.match(titel[1], /Anforderung/);
    assert.match(titel[2], /Dateien/);
    assert.match(titel[3], /Aufgaben/);
  });

  it("nennt in der Klappe Anforderungen Titel und Szenarienzahl", () => {
    const { changeKarte } = seitenSkript();
    const html = changeKarte(KARTE_ATTRAPPE);
    assert.ok(html.includes("Erste Regel"), "der Requirement-Titel steht in der Karte");
    assert.match(html, /2 Szenarien/);
  });

  it("benennt beide Richtungen des Dateiabgleichs", () => {
    const { changeKarte } = seitenSkript();
    const html = changeKarte(KARTE_ATTRAPPE);
    assert.ok(html.includes("ohne-zusage.md"), "die Datei ohne Zusage steht in der Karte");
    assert.ok(html.includes("werkzeug.py"), "die gedeckte Datei steht ebenfalls in der Karte");
  });

  it("weist einen fehlenden Abschnitt als fehlend aus", () => {
    const { changeKarte } = seitenSkript();
    const ohne = { ...KARTE_ATTRAPPE, worum: { warum: "Der Bedarf.", abgrenzung: "" } };
    const html = changeKarte(ohne);
    assert.match(html, /kein Abschnitt/, "der leere Kasten wird zum Hinweis");
    assert.match(html, /Was ausdr(ue|ü)cklich nicht/,
      "der Hinweis nennt die fehlende Ueberschrift beim Namen");
    assert.ok(!changeKarte(KARTE_ATTRAPPE).includes("kein Abschnitt"),
      "wo nichts fehlt, steht auch kein Hinweis");
  });
});

describe("Die Change-Karte beginnt kompakt", () => {
  it("liefert keine ihrer vier Klappen aufgeklappt aus", () => {
    const { changeKarte } = seitenSkript();
    const offene = klappen(changeKarte(KARTE_ATTRAPPE)).filter((k) => k.offen);
    assert.deepEqual(offene.map((k) => k.titel), [],
      "eine unangetastete Karte zeigt ihren Kopf, nicht ihren Inhalt");
  });

  it("traegt den Inhalt jeder Klappe trotzdem aus", () => {
    const { changeKarte } = seitenSkript();
    const html = changeKarte(KARTE_ATTRAPPE);
    const worum = klappenInhalt(html, /Worum/);
    assert.ok(worum.includes("Der Bedarf."), "das Warum steht in der zugeklappten Klappe");
    assert.ok(worum.includes("Die Abgrenzung."), "die Abgrenzung ebenso");
    const anforderungen = klappenInhalt(html, /Anforderung/);
    assert.ok(anforderungen.includes("Erste Regel"), "der Requirement-Titel steht darin");
    assert.match(anforderungen, /2 Szenarien/);
    const dateien = klappenInhalt(html, /Dateien/);
    assert.ok(dateien.includes("werkzeug.py"), "die gedeckte Datei steht darin");
    assert.ok(dateien.includes("ohne-zusage.md"), "die Datei ohne Zusage ebenso");
    const aufgaben = klappenInhalt(html, /Aufgaben/);
    assert.ok(aufgaben.includes("Test schreiben"), "die erledigte Aufgabe steht darin");
    assert.ok(aufgaben.includes("Umsetzen"), "die offene Aufgabe ebenso");
  });

  it("nennt den Aufgabenstand schon im Titel der zugeklappten Klappe", () => {
    const { changeKarte } = seitenSkript();
    const aufgaben = klappe(changeKarte(KARTE_ATTRAPPE), /Aufgaben/);
    assert.equal(aufgaben.offen, false);
    assert.match(aufgaben.titel, /1 von 2 Aufgaben/,
      "wer nicht aufklappt, soll den Stand dennoch lesen koennen");
  });
});

describe("Der Klappstand des Menschen gewinnt", () => {
  it("haelt die Anfangszustaende, solange niemand daran ruehrt", () => {
    const { changeKarte } = seitenSkript();
    const html = changeKarte(KARTE_ATTRAPPE);
    assert.equal(klappe(html, /Worum/).offen, false);
    assert.equal(klappe(html, /Anforderung/).offen, false);
    assert.equal(klappe(html, /Dateien/).offen, false);
    assert.equal(klappe(html, /Aufgaben/).offen, false);
  });

  // Keine Klappe der Change-Karte traegt die Vorgabe offen mehr. Die Mechanik dahinter
  // kann sie trotzdem, und das bleibt geprueft -- hier an `aufklappbar` selbst, damit
  // die Pruefung nicht davon abhaengt, wer die Vorgabe gerade nutzt.
  it("haelt eine zugeklappte Klappe zu, auch wenn die Vorgabe offen lautet", () => {
    const { aufklappbar, schalte } = seitenSkript();
    const vorgabeOffen = () => aufklappbar("probe:offen", "Probe", "<p>Inhalt</p>", true);
    assert.equal(klappe(vorgabeOffen(), /Probe/).offen, true,
      "ohne Entscheidung gilt die Vorgabe");
    schalte("probe:offen", false);
    assert.equal(klappe(vorgabeOffen(), /Probe/).offen, false,
      "wer zuklappt, muss es zugeklappt wiederfinden");
  });

  it("haelt eine aufgeklappte Klappe offen, auch wenn die Vorgabe zu lautet", () => {
    const { changeKarte, schalte } = seitenSkript();
    const vorher = klappe(changeKarte(KARTE_ATTRAPPE), /Anforderung/);
    schalte(vorher.id, true);
    assert.equal(klappe(changeKarte(KARTE_ATTRAPPE), /Anforderung/).offen, true);
  });

  it("laesst die Entscheidung an einer Klappe die anderen unberuehrt", () => {
    const { changeKarte, schalte } = seitenSkript();
    schalte(klappe(changeKarte(KARTE_ATTRAPPE), /Dateien/).id, true);
    const html = changeKarte(KARTE_ATTRAPPE);
    assert.equal(klappe(html, /Dateien/).offen, true);
    assert.equal(klappe(html, /Worum/).offen, false);
    assert.equal(klappe(html, /Aufgaben/).offen, false);
  });
});
