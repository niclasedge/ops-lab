#!/usr/bin/env node
// Token-Verbrauch je Lauf.
//
// Claude Code schreibt jede Sitzung als JSONL-Mitschrift; jede Assistenz-Nachricht
// traegt ihre `usage`, jeder Satz seinen `timestamp`. Dieses Werkzeug summiert sie
// je Sitzung, damit sich zwei Laeufe desselben Changes vergleichen lassen — das ist
// der Messwert, an dem sich eine Aenderung am Ablauf als Verbesserung oder
// Verschlechterung zeigt.
//
// Gelesen wird ein ganzes Repo, nicht ein Verzeichnis: der Hauptordner und jeder
// seiner Arbeitsraeume. Der Ablauf schreibt vor, dass ein Change in seinem
// Arbeitsraum laeuft, und dort faellt dann auch seine Mitschrift an.
//
//   node tools/tokens.mjs                   Laeufe dieses Repos
//   node tools/tokens.mjs --repo=../ops-lab-test   Laeufe eines anderen Repos
//   node tools/tokens.mjs --alle            auch Sitzungen unterhalb der Laufschwelle
//   node tools/tokens.mjs --json            maschinenlesbar
//   node tools/tokens.mjs --sitzung=<id>    eine Sitzung im Detail (je Modell)

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

import { dauer, istLauf, MINDEST_NACHRICHTEN, summiere } from "./messung.mjs";
import { mitschriftenOrdner } from "./pfade.mjs";

const SAMMELORDNER = join(".claude", "worktrees");

function konfigOrdner() {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}

/** Die Kennungen der Arbeitsraeume eines Repos. Keine ist der Normalfall. */
function arbeitsraeume(repo) {
  const sammel = join(repo, SAMMELORDNER);
  if (!existsSync(sammel)) return [];
  return readdirSync(sammel, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** Alle Mitschriften eines Repos, juengste zuerst. */
function sitzungen(repo) {
  const ordner = mitschriftenOrdner(repo, konfigOrdner(), arbeitsraeume(repo), existsSync);
  const gefunden = [];
  for (const o of ordner) {
    for (const d of readdirSync(o)) {
      if (!d.endsWith(".jsonl")) continue;
      const pfad = join(o, d);
      gefunden.push({ datei: pfad, id: basename(d, ".jsonl"), raum: basename(o), zeit: statSync(pfad).mtimeMs });
    }
  }
  return { ordner, sitzungen: gefunden.sort((a, b) => b.zeit - a.zeit) };
}

/**
 * Eine Mitschrift als Saetze.
 *
 * Die letzte Zeile einer laufenden Sitzung ist oft abgeschnitten — sie wird
 * uebergangen, nicht zum Fehler gemacht.
 */
function saetze(datei) {
  const gelesen = [];
  for (const zeile of readFileSync(datei, "utf8").split("\n")) {
    if (!zeile.trim()) continue;
    try {
      gelesen.push(JSON.parse(zeile));
    } catch {
      continue;
    }
  }
  return gelesen;
}

/** Was eine Sitzung fuer die Uebersicht hergibt. */
function auswerte(sitzung) {
  const gelesen = saetze(sitzung.datei);
  const w = summiere(gelesen);
  const d = dauer(gelesen);
  const zeiten = gelesen.map((s) => s.timestamp).filter(Boolean).sort();

  return {
    sitzung: sitzung.id,
    raum: sitzung.raum,
    beginn: zeiten[0] ?? null,
    spanne: d?.spanne ?? null,
    aktiv: d?.aktiv ?? null,
    ein: w.ein,
    aus: w.aus,
    cacheLesen: w.cacheLesen,
    cacheSchreiben: w.cacheSchreiben,
    gesamt: w.ein + w.aus + w.cacheLesen + w.cacheSchreiben,
    nachrichten: w.nachrichten,
    jeModell: w.jeModell,
  };
}

const zahl = (n) => n.toLocaleString("de-DE");
const kurz = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

/** Sekunden als Minuten oder Stunden, je nachdem was sich lesen laesst. */
function spanneKurz(sekunden) {
  if (sekunden === null) return "—";
  const minuten = Math.round(sekunden / 60);
  return minuten >= 90 ? `${(minuten / 60).toFixed(1)}h` : `${minuten}min`;
}

/**
 * Die Kennung des Arbeitsraums aus dem Namen seines Mitschriftenordners.
 *
 * Der Ordner traegt den ganzen Pfad als Marke; gesucht ist der Teil dahinter,
 * der den Change benennt. Der Hauptordner traegt ihn nicht -- er heisst hier
 * '(haupt)'.
 */
function raumKurz(ordnername) {
  return ordnername.split("--claude-worktrees-")[1] ?? "(haupt)";
}

/** Der Beginn aus der Mitschrift, in Ortszeit und ohne Sekunden. */
function beginnKurz(iso) {
  if (!iso) return "—".padEnd(16);
  const d = new Date(iso);
  const zwei = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())} ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

// --- Einstieg ---------------------------------------------------------------

const argumente = process.argv.slice(2);
const wert = (name) => {
  const mitGleich = argumente.find((a) => a.startsWith(`--${name}=`));
  if (mitGleich) return mitGleich.slice(name.length + 3);
  const stelle = argumente.indexOf(`--${name}`);
  return stelle >= 0 ? argumente[stelle + 1] : null;
};

const alsJson = argumente.includes("--json");
const alle = argumente.includes("--alle");
const eine = wert("sitzung");
const repoArgument = wert("repo") ?? ".";
const repo = isAbsolute(repoArgument) ? repoArgument : resolve(process.cwd(), repoArgument);

if (!existsSync(repo)) {
  console.error(`Kein Repo unter ${repo}.`);
  process.exit(1);
}

const { ordner, sitzungen: liste } = sitzungen(repo);

if (!liste.length) {
  console.error(`Keine Mitschriften zu ${repo}.`);
  console.error(ordner.length ? `Gesucht in:\n  ${ordner.join("\n  ")}` : "Zu diesem Repo gibt es keinen Mitschriftenordner.");
  console.error("Ein Lauf ist nur messbar, wenn die Sitzung in diesem Repo gefuehrt wurde.");
  process.exit(1);
}

if (eine) {
  const treffer = liste.find((s) => s.id.startsWith(eine));
  if (!treffer) {
    console.error(`Keine Sitzung beginnt mit '${eine}'.`);
    process.exit(1);
  }
  const e = auswerte(treffer);
  if (alsJson) {
    console.log(JSON.stringify(e, null, 2));
    process.exit(0);
  }
  console.log(`\nSitzung ${e.sitzung}  —  Arbeitsraum ${raumKurz(e.raum)}\n`);
  console.log(`  Beginn ${beginnKurz(e.beginn)}   Spanne ${spanneKurz(e.spanne)}   davon aktiv ${spanneKurz(e.aktiv)}\n`);
  for (const [modell, w] of Object.entries(e.jeModell)) {
    console.log(`  ${modell}`);
    console.log(`    ein ${zahl(w.ein)}  aus ${zahl(w.aus)}  Cache gelesen ${zahl(w.cacheLesen)}  Cache geschrieben ${zahl(w.cacheSchreiben)}`);
  }
  console.log(`\n  Summe: ${zahl(e.gesamt)} Token aus ${e.nachrichten} Nachrichten\n`);
  process.exit(0);
}

const ausgewertet = liste.map(auswerte);
// Hooks und Werkzeuge fuehren eigene Sitzungen mit einer einzigen Nachricht. Sie
// stehen in der Tabelle nur auf Wunsch und gehen nie in die Kennzahl ein.
const laeufe = ausgewertet.filter(istLauf);
const verborgen = ausgewertet.length - laeufe.length;
const gezeigt = alle ? ausgewertet : laeufe;

if (alsJson) {
  console.log(JSON.stringify({ repo, ordner, laeufe: gezeigt, verborgen }, null, 2));
  process.exit(0);
}

console.log(`\nToken je Lauf — ${repo}\n`);
console.log("  Sitzung   Beginn             Spanne   aktiv  Nachr.      aus   Cache   gesamt  Arbeitsraum");
for (const e of gezeigt) {
  console.log(
    `  ${e.sitzung.slice(0, 8)}  ${beginnKurz(e.beginn)}  ${spanneKurz(e.spanne).padStart(7)}  ${spanneKurz(e.aktiv).padStart(6)}  ${String(e.nachrichten).padStart(6)}  ${kurz(e.aus).padStart(7)}  ${kurz(e.cacheLesen + e.cacheSchreiben).padStart(6)}  ${kurz(e.gesamt).padStart(7)}  ${raumKurz(e.raum)}`,
  );
}

if (!laeufe.length) {
  console.log(`\n  Kein Lauf: keine Sitzung erreicht ${MINDEST_NACHRICHTEN} Nachrichten.\n`);
  process.exit(0);
}

const summe = laeufe.reduce((a, e) => a + e.gesamt, 0);
const median = (werte) => werte.slice().sort((a, b) => a - b)[Math.floor(werte.length / 2)] ?? 0;
const aktivSumme = laeufe.reduce((a, e) => a + (e.aktiv ?? 0), 0);

console.log(`\n  ${laeufe.length} Laeufe, ${zahl(summe)} Token, Median ${kurz(median(laeufe.map((e) => e.gesamt)))} je Lauf`);
console.log(`  Median der aktiven Zeit ${spanneKurz(median(laeufe.map((e) => e.aktiv ?? 0)))}, zusammen ${spanneKurz(aktivSumme)}`);
if (verborgen) {
  console.log(`  ${verborgen} Sitzungen unter ${MINDEST_NACHRICHTEN} Nachrichten ausgeblendet (--alle zeigt sie)`);
}
console.log();
