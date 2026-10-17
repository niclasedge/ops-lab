#!/usr/bin/env node
// Rollt das Tooling in ein Zielrepo aus.
//
// ops-lab entwickelt das Werkzeug, ops-lab-test wendet es an. Der Abgleich ist
// bewusst ein eigener Befehl und kein Symlink: ein Labor will wissen, welche
// Fassung des Werkzeugs einen Lauf erzeugt hat -- und das steht dann im Commit
// des Zielrepos.
//
//   node tools/sync.mjs ../ops-lab-test [--trocken]

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const [zielArg, ...rest] = process.argv.slice(2);
const trocken = rest.includes("--trocken");

if (!zielArg) {
  console.error("Aufruf: node tools/sync.mjs <zielrepo> [--trocken]");
  process.exit(2);
}

const quelle = process.cwd();
const ziel = resolve(quelle, zielArg);

if (!existsSync(join(ziel, ".git"))) {
  console.error(`'${ziel}' ist kein Git-Repo. Abbruch, damit nichts an der falschen Stelle landet.`);
  process.exit(2);
}
if (ziel === quelle) {
  console.error("Quelle und Ziel sind dasselbe Repo.");
  process.exit(2);
}

// Was ausgerollt wird. Alles andere gehoert dem Zielrepo und wird nicht angefasst --
// insbesondere justfile, CLAUDE.md und openspec/config.yaml, die dort eigene Inhalte tragen.
// sync.mjs bleibt hier: das Ausrollen ist Sache des Tooling-Repos, nicht des Testrepos.
const NUR_HIER = new Set(["sync.mjs"]);
const dateien = [
  ...readdirSync(join(quelle, "tools"))
    .filter((d) => d.endsWith(".mjs") && !NUR_HIER.has(d))
    .map((d) => `tools/${d}`),
  "ops.py",
];

function gleich(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

const fassung = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: quelle, encoding: "utf8" }).trim();
  } catch {
    return "unbekannt";
  }
})();

let geaendert = 0;
for (const rel of dateien) {
  const von = join(quelle, rel);
  const nach = join(ziel, rel);
  if (gleich(von, nach)) {
    console.log(`  unveraendert  ${rel}`);
    continue;
  }
  geaendert += 1;
  const zustand = existsSync(nach) ? "ersetzt     " : "neu         ";
  console.log(`  ${zustand}  ${rel}`);
  if (!trocken) {
    mkdirSync(dirname(nach), { recursive: true });
    copyFileSync(von, nach);
  }
}

console.log(
  `\n${geaendert} von ${dateien.length} Dateien ${trocken ? "wuerden sich aendern" : "ausgerollt"}`
  + ` — ops-lab ${fassung} → ${ziel}\n`,
);
if (!trocken && geaendert > 0) {
  console.log(`Im Zielrepo committen, damit der Lauf einer Werkzeugfassung zuzuordnen ist:`);
  console.log(`  git -C ${zielArg} commit -am "Tooling aus ops-lab ${fassung}"\n`);
}
