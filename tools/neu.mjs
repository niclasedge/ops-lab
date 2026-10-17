#!/usr/bin/env node
// Legt einen Change an: eigener Arbeitsraum, Branch, vier Artefakte.
//
// Jeder Change entsteht ueber diesen Befehl, damit alle Changes dieselbe Form
// haben. Gleiche Form heisst: Gate 1 findet, was es sucht, und zwei parallele
// Changes beruehren beim Mergen nur ihre eigenen Ordner.
//
// Der Hauptordner wechselt dabei den Branch nicht. Er stand frueher nach jedem
// Aufruf auf dem Branch des neuen Changes, und wer den Wechsel vergass,
// committete in den falschen -- vier Commits im Bestand belegen das, zwei davon
// mit Werkzeug und Change-Artefakten im selben Commit.
//
//   node tools/neu.mjs <change-id> <capability> --issue 12

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { arbeitsraumPfad, istArbeitsraum, juengstesArchiv } from "./pfade.mjs";

const [id, capability, ...rest] = process.argv.slice(2);
const stelle = rest.indexOf("--issue");
const issue = stelle >= 0 ? rest[stelle + 1] : undefined;

if (!id || !capability) {
  console.error("Aufruf: node tools/neu.mjs <change-id> <capability> --issue <nummer>");
  console.error("Beispiel: node tools/neu.mjs einsparpotenzial-rechnen wirtschaftlichkeit --issue 3");
  process.exit(2);
}

// Jeder Change hat sein eigenes Issue (GitHub-Issue #726): der Change nennt es, das Issue
// zeigt auf den Change. Ohne Nummer entstuende ein Change, den die Lage sofort unter
// `ohne_issue` fuehrt -- verweigert wird deshalb schon hier, bevor etwas angelegt ist.
if (!issue || !/^\d+$/.test(issue)) {
  console.error("Ohne Issue-Nummer wird kein Change angelegt: jeder Change hat sein eigenes Issue.");
  console.error("Aufruf: node tools/neu.mjs <change-id> <capability> --issue <nummer>  (just neu <id> <cap> <nr>)");
  console.error(`Issue anlegen: gh issue create --title "${id ?? "kennung"}: …" --label ready-for-agent`);
  process.exit(2);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !/^[a-z0-9][a-z0-9-]*$/.test(capability)) {
  console.error("Change-ID und Capability: nur Kleinbuchstaben, Ziffern und Bindestriche.");
  process.exit(2);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

/** Der Hauptordner des Repos. git nennt ihn in der ersten Zeile seiner Liste. */
function hauptordner() {
  const erste = git("worktree", "list", "--porcelain").split("\n")[0] ?? "";
  return erste.replace(/^worktree\s+/, "");
}

// Ein Arbeitsraum im Arbeitsraum waere geschachtelt und beim Aufraeumen nicht
// mehr eindeutig zuzuordnen. Der Aufruf gehoert in den Hauptordner.
if (istArbeitsraum(process.cwd())) {
  console.error("Dieser Befehl laeuft nur im Hauptordner, nicht in einem Arbeitsraum.");
  console.error(`Hauptordner: ${hauptordner()}`);
  process.exit(2);
}

// Ein Arbeitsraum und ein Branch je Change. Der Branch faellt beim Merge des PR
// weg, Arbeitsraum und Ordner bleiben stehen.
const raum = arbeitsraumPfad(process.cwd(), id);
if (existsSync(raum)) {
  console.error(`Change '${id}' hat schon einen Arbeitsraum: ${raum}`);
  process.exit(2);
}

// Der Arbeitsraum zweigt von HEAD ab und traegt damit alles, was dort liegt --
// auch einen Change-Ordner gleicher Kennung. Ohne diese Frage schrieben die
// Vorlagen unten kommentarlos darueber, und der Verlust fiel niemandem auf: der
// Arbeitsraum sah nach dem Anlegen genauso aus wie ein frischer.
//
// Gefragt wird vor dem Anlegen. Anlegen und wieder zurueckbauen waere die
// Alternative, aber der Rueckbau kann selbst fehlschlagen und laesst dann einen
// halben Zustand zurueck.
const imBestand = `openspec/changes/${id}`;
if (git("ls-tree", "--name-only", "HEAD", `${imBestand}/`)) {
  console.error(`Change '${id}' gibt es schon: ${imBestand}`);
  console.error("Seine Artefakte liegen im Branch, von dem abgezweigt wuerde -- die");
  console.error("Vorlagen wuerden sie ueberschreiben. Es wurde nichts angelegt.");
  process.exit(2);
}

const branch = `change/${id}`;
try {
  git("worktree", "add", raum, "-b", branch);
} catch (fehler) {
  console.error(`Arbeitsraum liess sich nicht anlegen: ${fehler.stderr?.trim() || fehler.message}`);
  process.exit(2);
}

const ordner = join(raum, "openspec", "changes", id);
mkdirSync(join(ordner, "specs", capability), { recursive: true });

const herkunft = `\nGeht zurueck auf GitHub-Issue #${issue}.\n`;

writeFileSync(
  join(ordner, "proposal.md"),
  `# ${id}

## Warum
${herkunft}
<!-- Fuenf bis zehn Saetze: welcher Bedarf, wessen Bedarf, was heute daran fehlt.
     Keine Loesung in diesem Abschnitt. -->

## Was aendert sich

<!-- Was der Nutzende danach tun kann, was er vorher nicht konnte. -->

## Was ausdruecklich nicht

<!-- Die Abgrenzung, damit der Change klein bleibt und sein Dateiumfang disjunkt. -->

## Beruehrte Dateien

<!-- Eine Liste. Sie ist die Zusage, dass dieser Change parallel zu anderen
     laufen kann: zwei Changes mit Ueberschneidung laufen nacheinander. -->
`,
  "utf8",
);

writeFileSync(
  join(ordner, "specs", capability, "spec.md"),
  `# ${capability}

## ADDED Requirements

### Requirement: <Kurzname der Regel>

Das System SHALL <beobachtbares Verhalten>.
<!-- SHALL statt SOLL: OpenSpec prueft --strict auf RFC-2119-Schluesselwoerter. -->


#### Scenario: <Name des Falls>

- **Given** <Ausgangslage>
- **When** <Ereignis>
- **Then** <erwartetes Ergebnis>
`,
  "utf8",
);

writeFileSync(
  join(ordner, "tasks.md"),
  `# Aufgaben — ${id}

Jede Aufgabe ist ein Handgriff mit sichtbarem Ergebnis. Die Testdateien stehen in
Backticks, damit Gate 1 und Gate 2 sie finden.

## Vor der Umsetzung (rot)

- [ ] Test \`tests/${capability}.test.mjs\` schreibt das Szenario als Erwartung
- [ ] \`just gate2 ${id}\` bestaetigt den roten Lauf

## Umsetzung (gruen)

- [ ] <Modul unter src/ anlegen oder erweitern>
- [ ] <naechster Handgriff>

Der Abschluss steht bewusst nicht als Aufgabe: \`just fertig ${id}\` verlangt, dass
keine Aufgabe mehr offen ist. Ein Kaestchen "just fertig laeuft durch" muesste man
abhaken, bevor es laufen darf -- und ein Haken, den man vorab setzt, entwertet die
ganze Liste. Den Abschluss belegen gate1.md, gate2.md und fertig.md.
`,
  "utf8",
);

console.log(`
Change angelegt. Gearbeitet wird ab jetzt hier:

  ${raum}

  openspec/changes/${id}/proposal.md
  openspec/changes/${id}/specs/${capability}/spec.md
  openspec/changes/${id}/tasks.md

Die drei angelegten Dateien sind Vorlagen mit Platzhaltern -- nicht lesen, sondern
nach dem Muster ueberschreiben.
${musterHinweis(raum)}
Branch ${branch}. Der Hauptordner bleibt, wo er ist.

Naechster Schritt: in den Arbeitsraum wechseln, proposal.md fuellen,
dann 'just gate1 ${id}'.
`);

/**
 * Die drei Dateien des juengsten archivierten Changes -- das Muster.
 *
 * Die Laeufe 89401f6c und 40d36a23 suchten es mit ls und find, je drei bis vier
 * Aufrufe. Der Pfad steht hier fest; wer ihn liest, braucht nicht zu suchen.
 */
function musterHinweis(wurzel) {
  const archiv = join(wurzel, "openspec", "changes", "archive");
  if (!existsSync(archiv)) return "";
  const eintrag = juengstesArchiv(readdirSync(archiv));
  if (!eintrag) return "";
  const specs = join(archiv, eintrag, "specs");
  const cap = existsSync(specs) ? readdirSync(specs).find((d) => existsSync(join(specs, d, "spec.md"))) : null;
  const dateien = ["proposal.md", "tasks.md", ...(cap ? [join("specs", cap, "spec.md")] : [])];
  return `
Muster (nur diese drei Dateien lesen):

${dateien.map((d) => `  openspec/changes/archive/${eintrag}/${d}`).join("\n")}
`;
}
