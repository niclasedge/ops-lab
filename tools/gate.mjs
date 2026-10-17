#!/usr/bin/env node
// Gates des ops-lab: maschinelle Halte im Ablauf eines Changes.
//
// Ein Gate ist hier kein Vermerk, den jemand setzt, sondern ein Befehl, der
// prueft und bei Fehlschlag mit Exit != 0 endet. Keine menschliche Bestaetigung,
// kein Ventil, kein Ueberspringen -- ein rotes Gate schreibt keine Datei.
//
//   gate1 <change>   Plan vollstaendig und pruefbar
//   gate2 <change>   Tests existieren und sind rot (TDD-Beleg)
//   fertig <change>  Tests gruen, Aufgaben abgehakt
//
// Was ein Gate ueber einen Text entscheidet, steht in tools/pruefungen.mjs und ist
// dort getestet. Hier stehen Dateizugriff, Kindprozesse und der Nachweis.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { liesJournal } from "./beleg.mjs";
import { arbeitsstand } from "./nachweis.mjs";
import {
  aufgaben,
  belegLage,
  journalLage,
  istTestpfad,
  nurAngehaengt,
  platzhalter,
  proposalAbschnitte,
  specGeruest,
  tapFehler,
  zugesagteTests,
} from "./pruefungen.mjs";

const WURZEL = process.cwd();
const CHANGES = join(WURZEL, "openspec", "changes");
const AUFGABEN_HOECHSTZAHL = 8; // mehr heisst, der Change ist zu gross geschnitten
const NACHWEISE = ["gate1.md", "gate2.md", "fertig.md"];

/**
 * Der Testlauf, den Gate 2 rot und der Abschluss gruen sehen will.
 *
 * Voreinstellung ist der Node-Selbsttest des Vorrats. Ein Projekt, dessen
 * Fachtests in einer anderen Sprache liegen, legt `tools/gate.projekt.json` mit
 * `{"befehl": "...", "argumente": ["..."]}` daneben — sonst prueften die Gates an
 * einem Python-Change eine Testmenge, die der Change gar nicht anfasst, und
 * meldeten gruen, ohne etwas gesehen zu haben.
 * ANGEPASST gegenueber dem ops-lab-Vorrat — ein erneutes `install.mjs` setzt das
 * zurueck.
 */
function testbefehl() {
  const pfad = join(WURZEL, "tools", "gate.projekt.json");
  if (existsSync(pfad)) {
    try {
      const k = JSON.parse(readFileSync(pfad, "utf8"));
      if (k.befehl && Array.isArray(k.argumente)) {
        return { befehl: k.befehl, argumente: k.argumente, tap: k.tap === true };
      }
      console.error(rot(`tools/gate.projekt.json unbrauchbar (befehl/argumente fehlen) — Voreinstellung greift.`));
    } catch (e) {
      console.error(rot(`tools/gate.projekt.json nicht lesbar: ${e.message} — Voreinstellung greift.`));
    }
  }
  return {
    befehl: process.execPath,
    argumente: ["--test", "--test-reporter=tap", "tests/*.test.mjs"],
    tap: true,
  };
}

/**
 * Ein Lauf des Testbefehls samt Fehlerzahl.
 *
 * Nur ein TAP-Lauf kann seine Fehlschlaege zaehlen. Ein fremder Laeufer wird
 * allein an seinem Exit-Code gemessen: ungleich null heisst rot, und rot heisst
 * mindestens ein Fehlschlag. Das ist weniger Auskunft, aber keine erfundene Zahl.
 */
function testlauf() {
  const t = testbefehl();
  const r = schale(t.befehl, t.argumente);
  const fehler = t.tap ? tapFehler(r.aus) : (r.code === 0 ? 0 : 1);
  return { ...r, fehler, anzeige: `${t.befehl} ${t.argumente.join(" ")}` };
}

// --- kleine Helfer ----------------------------------------------------------

const rot = (s) => `\x1b[31m${s}\x1b[0m`;
const gruen = (s) => `\x1b[32m${s}\x1b[0m`;
const grau = (s) => `\x1b[90m${s}\x1b[0m`;

function schale(befehl, argumente) {
  const r = spawnSync(befehl, argumente, { cwd: WURZEL, encoding: "utf8" });
  return { code: r.status ?? 1, aus: (r.stdout ?? "") + (r.stderr ?? "") };
}

function gitWert(...argumente) {
  try {
    return execFileSync("git", argumente, { cwd: WURZEL, encoding: "utf8" }).trim();
  } catch {
    return "unbekannt";
  }
}

function lies(pfad) {
  return existsSync(pfad) ? readFileSync(pfad, "utf8") : "";
}

function changeOrdner(change) {
  const pfad = join(CHANGES, change);
  if (!existsSync(pfad)) {
    console.error(rot(`Change '${change}' existiert nicht unter openspec/changes/.`));
    const vorhanden = existsSync(CHANGES)
      ? readdirSync(CHANGES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [];
    if (vorhanden.length) console.error(grau(`Vorhanden: ${vorhanden.join(", ")}`));
    process.exit(2);
  }
  return pfad;
}

/** Sammelt alle spec.md eines Changes, unabhaengig von der Capability. */
function specDateien(ordner) {
  const wurzel = join(ordner, "specs");
  if (!existsSync(wurzel)) return [];
  const treffer = [];
  for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
    if (!eintrag.isDirectory()) continue;
    const datei = join(wurzel, eintrag.name, "spec.md");
    if (existsSync(datei)) treffer.push({ capability: eintrag.name, datei });
  }
  return treffer;
}

/** Testdateien, die sich gegenueber der Basis unterscheiden -- committet oder nicht. */
function geaenderteTests(basis) {
  const quellen = [
    schale("git", ["diff", "--name-only", `${basis}...HEAD`]).aus,
    schale("git", ["diff", "--name-only"]).aus,
    schale("git", ["ls-files", "--others", "--exclude-standard"]).aus,
  ];
  return [...new Set(
    quellen.join("\n").split("\n").map((z) => z.trim())
      .filter(istTestpfad),
  )];
}

/**
 * Was der Change am justfile getan hat, gegen die Basis gerechnet.
 *
 * Das justfile ist eine Liste von Zielen; zwei Changes koennen daran
 * gleichzeitig anhaengen, ohne sich zu widersprechen. Es zaehlt fuer die
 * Ueberschneidung zweier Changes deshalb nur dann mit, wenn einer von ihnen
 * dort eine Zeile entfernt oder aendert.
 *
 * Gerechnet wird gegen den gemeinsamen Vorfahren und einschliesslich des
 * Arbeitsbaums: was noch nicht committet ist, zaehlt genauso.
 */
function justfileAenderung(basis) {
  const vorfahr = schale("git", ["merge-base", basis, "HEAD"]).aus.trim();
  if (!vorfahr) {
    // Ohne Vergleichsstand ist die Regel nicht pruefbar. Sie gilt dann als
    // nicht bestanden -- ein Gate ohne Grundlage winkt nicht durch.
    return { hinzu: 0, entfernt: 0, bestanden: false, ohneBasis: true };
  }
  return nurAngehaengt(schale("git", ["diff", "--numstat", vorfahr, "--", "justfile"]).aus);
}

// --- Nachweis ---------------------------------------------------------------

/**
 * Alles, was den Arbeitsbaum vom Commit unterscheidet: getrackte Aenderungen und
 * der Inhalt ungetrackter Dateien. Die Nachweise selbst bleiben aussen vor --
 * sonst aenderte schon das Schreiben von gate1.md den Stand, den gate2.md nennt.
 */
function arbeitsbaumDiff() {
  const teile = [schale("git", ["diff", "HEAD"]).aus];
  const ungetrackt = schale("git", ["ls-files", "--others", "--exclude-standard"]).aus
    .split("\n").map((z) => z.trim())
    .filter((z) => z && !NACHWEISE.some((n) => z.endsWith(`/${n}`)))
    .sort();
  for (const pfad of ungetrackt) teile.push(`--- ungetrackt ${pfad}\n${lies(join(WURZEL, pfad))}`);
  return teile.join("\n");
}

function schreibeNachweis(ordner, name, titel, pruefungen, zusatz) {
  const zeilen = [
    `# ${titel}`,
    "",
    `- Datum: ${new Date().toISOString()}`,
    `- Person: ${gitWert("config", "user.name")}`,
    `- Branch: ${gitWert("rev-parse", "--abbrev-ref", "HEAD")}`,
    `- Commit: ${gitWert("rev-parse", "HEAD")}`,
    `- Arbeitsstand: ${arbeitsstand(gitWert("rev-parse", "HEAD"), arbeitsbaumDiff())}`,
    "",
    "## Pruefungen",
    "",
    ...pruefungen.map((p) => `- bestanden — ${p.id}: ${p.text}`),
    "",
    "## Belege",
    "",
    ...zusatz.map((z) => `- ${z}`),
    "",
  ];
  writeFileSync(join(ordner, name), zeilen.join("\n"), "utf8");
}

function auswerten(titel, pruefungen, ordner, datei, zusatz, hinweise = []) {
  console.log(`\n${titel}\n`);
  for (const p of pruefungen) {
    console.log(`  ${p.ok ? gruen("bestanden") : rot("offen    ")}  ${p.id}  ${p.text}`);
  }
  for (const hinweis of hinweise) console.log(grau(`      ${hinweis}`));

  const offen = pruefungen.filter((p) => !p.ok);
  if (offen.length) {
    console.log(`\n${rot(`${offen.length} von ${pruefungen.length} Pruefungen offen.`)} Kein Nachweis geschrieben.\n`);
    process.exit(1);
  }
  schreibeNachweis(ordner, datei, titel, pruefungen, zusatz);
  console.log(`\n${gruen("Alle Pruefungen bestanden.")} Nachweis: ${datei}\n`);
}

// --- Gate 1: der Plan -------------------------------------------------------

function gate1(change) {
  const ordner = changeOrdner(change);
  const proposal = lies(join(ordner, "proposal.md"));
  const tasksText = lies(join(ordner, "tasks.md"));
  const design = lies(join(ordner, "design.md"));
  const specs = specDateien(ordner);
  const specText = specs.map((s) => readFileSync(s.datei, "utf8")).join("\n");

  const abschnitte = proposalAbschnitte(proposal);
  const geruest = specGeruest(specText);
  const zaehlung = aufgaben(tasksText);
  const tests = zugesagteTests(tasksText);

  // Der entscheidende Punkt: eine frisch angelegte Vorlage traegt die richtigen
  // Ueberschriften und ist lang genug -- nur die Platzhalter verraten sie.
  const offeneStellen = [
    ...platzhalter(proposal).map((t) => `proposal.md — ${t}`),
    ...platzhalter(specText).map((t) => `spec.md — ${t}`),
    ...platzhalter(tasksText).map((t) => `tasks.md — ${t}`),
    ...platzhalter(design).map((t) => `design.md — ${t}`),
  ];

  const validate = schale("openspec", ["validate", change, "--strict"]);
  const jf = justfileAenderung(basis);

  const pruefungen = [
    { id: "G1-1", text: "keine Platzhalter der Vorlage mehr im Change", ok: offeneStellen.length === 0 },
    { id: "G1-2", text: "proposal.md hat Warum, Aenderung, Abgrenzung und Beruehrte Dateien", ok: Object.values(abschnitte).every(Boolean) },
    { id: "G1-3", text: "mindestens eine Delta-Spec mit Delta-Block", ok: specs.length > 0 && geruest.deltaBloecke > 0 },
    { id: "G1-4", text: "jedes Requirement hat mindestens ein Szenario", ok: geruest.requirements > 0 && geruest.szenarien >= geruest.requirements },
    { id: "G1-5", text: `tasks.md enthaelt 1 bis ${AUFGABEN_HOECHSTZAHL} Aufgaben`, ok: zaehlung.gesamt > 0 && zaehlung.gesamt <= AUFGABEN_HOECHSTZAHL },
    { id: "G1-6", text: "tasks.md nennt die Testdateien (Pfad in Backticks)", ok: tests.length > 0 },
    { id: "G1-7", text: "openspec validate --strict laeuft durch", ok: validate.code === 0 },
    { id: "G1-8", text: `am justfile wurde nur angehaengt (${jf.hinzu} Zeilen hinzu, ${jf.entfernt} entfernt)`, ok: jf.bestanden },
  ];

  const hinweise = [];
  if (offeneStellen.length) hinweise.push(...offeneStellen.slice(0, 6));
  if (jf.ohneBasis) hinweise.push(`kein gemeinsamer Vorfahr mit '${basis}' -- die Anhaenge-Regel ist so nicht pruefbar`);
  else if (!jf.bestanden) {
    hinweise.push(`justfile: ${jf.entfernt} Zeile(n) entfernt oder geaendert. Nur Anhaengen haelt zwei Changes disjunkt.`);
  }
  if (!Object.values(abschnitte).every(Boolean)) {
    hinweise.push(`fehlende Abschnitte: ${Object.entries(abschnitte).filter(([, da]) => !da).map(([n]) => n).join(", ")}`);
  }
  if (validate.code !== 0) hinweise.push(...validate.aus.trim().split("\n").slice(0, 8));

  auswerten(`Gate 1 — ${change}`, pruefungen, ordner, "gate1.md", [
    `Requirements ${geruest.requirements}, Szenarien ${geruest.szenarien}, Delta-Bloecke ${geruest.deltaBloecke}`,
    `Aufgaben ${zaehlung.gesamt}, davon offen ${zaehlung.offen}`,
    `Zugesagte Testdateien: ${tests.join(", ") || "keine"}`,
    `Capabilities: ${specs.map((s) => s.capability).join(", ") || "keine"}`,
  ], hinweise);
}

// --- Gate 2: der rote Test --------------------------------------------------

function gate2(change, basis) {
  const ordner = changeOrdner(change);
  const tasksText = lies(join(ordner, "tasks.md"));
  const zugesagt = zugesagteTests(tasksText);
  const veraendert = geaenderteTests(basis);
  const vorhanden = zugesagt.filter((t) => existsSync(join(WURZEL, t)));

  const lauf = testlauf();
  const fehler = lauf.fehler;

  const pruefungen = [
    { id: "G2-1", text: "Gate 1 ist bestanden (gate1.md liegt vor)", ok: existsSync(join(ordner, "gate1.md")) },
    { id: "G2-2", text: "die in tasks.md zugesagten Testdateien existieren", ok: zugesagt.length > 0 && vorhanden.length === zugesagt.length },
    { id: "G2-3", text: `mindestens eine Testdatei ist neu oder geaendert gegenueber ${basis}`, ok: veraendert.length > 0 },
    { id: "G2-4", text: "der Testlauf schlaegt fehl (roter Test vor der Umsetzung)", ok: lauf.code !== 0 && fehler > 0 },
  ];

  const hinweise = [];
  const fehlend = zugesagt.filter((t) => !vorhanden.includes(t));
  if (fehlend.length) hinweise.push(`fehlende Testdateien: ${fehlend.join(", ")}`);
  if (lauf.code === 0) hinweise.push("der Testlauf ist gruen — entweder ist nichts Neues getestet oder schon implementiert");

  auswerten(`Gate 2 — ${change}`, pruefungen, ordner, "gate2.md", [
    `Testlauf: ${lauf.anzeige} — Exit ${lauf.code}, ${fehler} Fehlschlaege`,
    `Geaenderte Testdateien: ${veraendert.join(", ") || "keine"}`,
  ], hinweise);
}

// --- Abschluss: gruen -------------------------------------------------------

function fertig(change) {
  const ordner = changeOrdner(change);
  const zaehlung = aufgaben(lies(join(ordner, "tasks.md")));

  const lauf = testlauf();
  const fehler = lauf.fehler;

  // F-5 liest nur das Journal, nie die Platte: das Urteil ueber jeden Beleg fiel
  // beim Einliefern. Ein gruener Testlauf ist eine Zahl -- ein Bild zeigt, was
  // nach der Aenderung tatsaechlich zu sehen ist.
  const belege = liesJournal(ordner);
  const lage = belegLage(belege);
  // F-6: `git check-ignore -q` endet mit 0, wenn git den Pfad ausschliesst.
  const journal = journalLage({
    ignoriert: schale("git", ["check-ignore", "-q", join(ordner, "belege", "belege.jsonl")]).code === 0,
  });

  const pruefungen = [
    { id: "F-1", text: "gate1.md liegt vor", ok: existsSync(join(ordner, "gate1.md")) },
    { id: "F-2", text: "gate2.md liegt vor", ok: existsSync(join(ordner, "gate2.md")) },
    { id: "F-3", text: "keine offene Aufgabe in tasks.md", ok: zaehlung.gesamt > 0 && zaehlung.offen === 0 },
    { id: "F-4", text: "der Testlauf ist gruen", ok: lauf.code === 0 && fehler === 0 },
    { id: "F-5", text: "ein Bildbeleg der Stufe nachher aus der Prozessschmiede liegt vor", ok: lage.sichtbar },
    { id: "F-6", text: "das Belegjournal wird von git getragen", ok: journal.getragen },
  ];

  const hinweise = [];
  if (zaehlung.offen) hinweise.push(`${zaehlung.offen} Aufgabe(n) noch offen`);
  if (!lage.sichtbar) {
    hinweise.push(lage.meldung);
    hinweise.push("einliefern mit: just beleg <change> nachher <pfad>");
  }
  if (!journal.getragen) hinweise.push(journal.meldung);
  if (lauf.code !== 0) {
    hinweise.push(...lauf.aus.split("\n")
      .filter((z) => /^not ok |^\s+(error|expected|actual):/.test(z))
      .slice(0, 10).map((z) => z.trim()));
  }

  auswerten(`Abschluss — ${change}`, pruefungen, ordner, "fertig.md", [
    `Testlauf: ${lauf.anzeige} — Exit ${lauf.code}, ${fehler} Fehlschlaege`,
    `Aufgaben ${zaehlung.gesamt}, davon offen ${zaehlung.offen}`,
    `Belege: ${belege.filter((z) => !z.fehlt).map((z) => `${z.stufe} ${z.art} ${z.pfad}`).join(", ") || "keine"}`,
  ], hinweise);
}

// --- Einstieg ---------------------------------------------------------------

const [stufe, change, ...rest] = process.argv.slice(2);
const basis = (rest.find((a) => a.startsWith("--basis=")) ?? "--basis=main").slice(8);

if (!stufe || !change) {
  console.error("Aufruf: node tools/gate.mjs <gate1|gate2|fertig> <change> [--basis=main]");
  process.exit(2);
}

if (stufe === "gate1") gate1(change);
else if (stufe === "gate2") gate2(change, basis);
else if (stufe === "fertig") fertig(change);
else {
  console.error(`Unbekannte Stufe '${stufe}'. Erlaubt: gate1, gate2, fertig.`);
  process.exit(2);
}
