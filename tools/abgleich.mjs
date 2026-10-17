#!/usr/bin/env node
// Die Zusage aus dem Vorschlag gegen den Diff des Changes.
//
// "Beruehrte Dateien" ist die Liste, auf der der Parallelbetrieb ruht: das
// Lagebild stellt zwei Changes nebeneinander, wenn ihre Zusagen disjunkt sind.
// Ob der Diff sich daran haelt, hat bisher niemand nachgehalten -- und genau
// daraus entstehen die Merge-Konflikte, die dieses Labor vermeiden will.
//
// Dieser Befehl ist kein Gate. Er endet mit Exit 0, auch wenn er etwas findet.
// Eine Zusage kann sich im Lauf eines Changes berechtigt aendern; ein Gate, das
// daran scheitert, erzeugt Druck, die Zusage nachtraeglich passend zu schreiben,
// statt sie ernst zu nehmen. Gates pruefen, was sich ohne Urteil entscheiden
// laesst -- das hier laesst sich das nicht.
//
// Was entschieden wird, steht in tools/pruefungen.mjs und ist dort getestet.
// Hier steht nur, woher der Diff kommt und wie der Bericht aussieht.
//
//   node tools/abgleich.mjs <kennung> [--basis=main]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { dateiAbgleich, zugesagteDateien } from "./pruefungen.mjs";

const WURZEL = process.cwd();

const rot = (s) => `\x1b[31m${s}\x1b[0m`;
const gruen = (s) => `\x1b[32m${s}\x1b[0m`;
const grau = (s) => `\x1b[90m${s}\x1b[0m`;

/** git im Arbeitsverzeichnis. Gibt die leere Zeichenkette zurueck, statt zu werfen. */
function git(...argumente) {
  try {
    return execFileSync("git", argumente, { cwd: WURZEL, encoding: "utf8" });
  } catch {
    return "";
  }
}

/**
 * Jede Datei, die dieser Change gegenueber der Basis anfasst.
 *
 * Gerechnet wird gegen den gemeinsamen Vorfahren und einschliesslich des
 * Arbeitsbaums: der Abgleich laeuft vor 'just pr', und zaehlte nur, was schon
 * committet ist, saehe er beim ersten Lauf eines Changes gar nichts.
 * `git diff <commit>` deckt dabei Vorgemerktes und Ungespeichertes gleichermassen
 * ab; ungetrackte Dateien nennt git nur auf Nachfrage.
 */
function geaenderteDateien(basis) {
  const vorfahr = git("merge-base", basis, "HEAD").trim() || "HEAD";
  const quellen = [
    git("diff", "--name-only", vorfahr),
    git("ls-files", "--others", "--exclude-standard"),
  ];
  return [...new Set(
    quellen.join("\n").split("\n").map((z) => z.trim()).filter(Boolean),
  )].sort();
}

/** Der Bericht als Text. Eine Richtung je Block, damit die Diagnose nicht verschwimmt. */
function bericht(kennung, basis, zusagen, diff, befund) {
  const zeilen = [
    "",
    `Abgleich — ${kennung}`,
    "",
    grau(`  Basis ${basis} · ${zusagen.length} zugesagt · ${diff.length} im Diff`),
    "",
  ];

  if (befund.deckungsgleich) {
    zeilen.push(`  ${gruen("deckungsgleich")}  der Diff haelt sich an die Zusage`, "");
    return zeilen.join("\n");
  }

  zeilen.push(`  ${rot("Zusatz")}      angefasst, aber nicht zugesagt (${befund.zusatz.length})`);
  for (const pfad of befund.zusatz) zeilen.push(`              ${pfad}`);
  if (!befund.zusatz.length) zeilen.push(grau("              keine"));
  zeilen.push("");

  zeilen.push(`  ${rot("Auslassung")}  zugesagt, aber nicht angefasst (${befund.auslassung.length})`);
  for (const pfad of befund.auslassung) zeilen.push(`              ${pfad}`);
  if (!befund.auslassung.length) zeilen.push(grau("              keine"));
  zeilen.push("");

  // Kein Exit-Code, also muss der Text sagen, was zu tun ist. Beide Richtungen
  // haben verschiedene Folgen, und die Entscheidung bleibt beim Menschen.
  if (befund.zusatz.length) {
    zeilen.push(grau("  Zusatz heisst: entweder in den Vorschlag aufnehmen, oder aus dem Change"));
    zeilen.push(grau("  heraushalten. Das Lagebild hat diesen Change anhand der Zusage neben"));
    zeilen.push(grau("  andere gestellt."));
  }
  if (befund.auslassung.length) {
    zeilen.push(grau("  Auslassung heisst meist: der Zuschnitt hat sich verschoben. Kein Risiko"));
    zeilen.push(grau("  fuer den Parallelbetrieb, aber der Vorschlag stimmt nicht mehr."));
  }
  zeilen.push("");

  return zeilen.join("\n");
}

// --- Einstieg ---------------------------------------------------------------

const argumente = process.argv.slice(2);
const kennung = argumente.find((a) => !a.startsWith("--"));
const basis = (argumente.find((a) => a.startsWith("--basis=")) ?? "--basis=main").slice(8);

if (!kennung) {
  console.error("Aufruf: node tools/abgleich.mjs <kennung> [--basis=main]");
  console.error("Beispiel: node tools/abgleich.mjs diff-reviewer");
  process.exit(2);
}

const ordner = join(WURZEL, "openspec", "changes", kennung);
const vorschlag = join(ordner, "proposal.md");
if (!existsSync(vorschlag)) {
  // Ohne Vorschlag gibt es keine Zusage. Das als Deckungsgleichheit zu melden
  // waere die gefaehrlichste Antwort von allen: nichts gefunden, weil nichts
  // gesucht wurde.
  console.error(`Kein Vorschlag zu '${kennung}': ${join("openspec", "changes", kennung, "proposal.md")} fehlt.`);
  process.exit(2);
}

const zusagen = zugesagteDateien(readFileSync(vorschlag, "utf8"));
const diff = geaenderteDateien(basis);
console.log(bericht(kennung, basis, zusagen, diff, dateiAbgleich(zusagen, diff)));
