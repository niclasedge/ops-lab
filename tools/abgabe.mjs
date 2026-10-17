// Abgabe eines Changes in einem Aufruf: committen, pushen, Pull Request.
//
// Bisher waren das drei bis fuenf Aufrufe des Agenten -- status, add, commit,
// push, gh pr create -- und in den Laeufen 89401f6c und 40d36a23 jeweils ein
// halbes Dutzend Runden. Hier steht die Reihenfolge einmal fest, mit dem
// Nachweis davor: ohne fertig.md wird nichts committet und nichts gepusht.
//
// Was zu tun ist, entscheidet `abgabeSchritte` als reine Funktion; sie wird in
// tests/abgabe.test.mjs geprueft. Der Einstieg unten stellt nur fest, was im
// Arbeitsraum steht, und fuehrt die Schritte der Reihe nach aus.
//
// Aufruf, im Arbeitsraum des Changes:
//   node tools/abgabe.mjs <kennung>

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { liesJournal } from "./beleg.mjs";

/**
 * Die Schritte der Abgabe -- oder der Grund, warum es keine gibt.
 *
 * `offen` ist die Ausgabe von `git status --porcelain`; ist sie leer, entfaellt
 * der Commit, weil ein leerer Commit scheitern wuerde. Gepusht und der Pull
 * Request gestellt wird dann trotzdem.
 */
export function abgabeSchritte({ kennung, fertigVorhanden, zweig, offen, titel, textDatei }) {
  const erwartet = `change/${kennung}`;
  if (!fertigVorhanden) {
    return { fehler: `openspec/changes/${kennung}/fertig.md fehlt. Erst 'node tools/gate.mjs fertig ${kennung}'.`, schritte: [] };
  }
  if (zweig !== erwartet) {
    return { fehler: `Der Arbeitsraum steht auf '${zweig}', erwartet wird ${erwartet}.`, schritte: [] };
  }
  const schritte = [];
  if (offen.trim()) {
    schritte.push(["git", "add", "-A"]);
    schritte.push(["git", "commit", "-m", `${kennung}: Umsetzung mit Nachweisen und Beleg`]);
  }
  schritte.push(["git", "push", "-u", "origin", erwartet]);
  // Basis master: dieses Repo hat keinen Zweig 'main'. Der Text kommt aus einer Datei,
  // die `haupt` erst nach dem Commit schreibt -- er verlinkt den Bildbeleg auf den Commit
  // (Change 02-bildbeleg-sichtbar, #909).
  schritte.push(["gh", "pr", "create", "--base", "master", "--head", erwartet, "--title", titel, "--body-file", textDatei]);
  return { fehler: null, schritte };
}

/** `EIGENTUEMER/REPO` aus einer Remote-URL, oder `null`. Traegt auch die Proxy-Form `…/git/o/r`. */
export function repoAusRemote(url) {
  const treffer = (url ?? "").trim().match(/(?:github\.com[:/]|\/git\/)([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  return treffer ? `${treffer[1]}/${treffer[2]}` : null;
}

/**
 * Der Text des Pull Requests: jeder abgelegte Bildbeleg als Markdown-Bild, dazu der
 * Abschlussnachweis. Die Bilder zeigen auf den Commit, nicht auf den Branch -- der
 * Branch faellt beim Merge weg, der Commit bleibt.
 */
export function prText({ kennung, repo, sha, belege, fertig }) {
  const basis = `https://github.com/${repo}/blob/${sha}/openspec/changes/${kennung}`;
  const bilder = belege.filter((z) => !z.fehlt && z.art === "bild" && z.pfad);
  const zeilen = ["## Bildbeleg", ""];
  if (!bilder.length) zeilen.push("Kein Bildbeleg im Journal.", "");
  for (const z of bilder) {
    zeilen.push(`![${z.stufe}](${basis}/${z.pfad}?raw=true)`, "");
    if (z.beschreibung) zeilen.push(`Beschreibung: [${z.beschreibung}](${basis}/${z.beschreibung})`, "");
  }
  if (fertig?.trim()) zeilen.push(fertig.trim(), "");
  return zeilen.join("\n");
}

/** Einen Schritt ausfuehren; bricht mit dessen Ausgabe ab, wenn er scheitert. */
export function ausfuehren(schritte, cwd) {
  for (const [befehl, ...argumente] of schritte) {
    console.log(`  ${[befehl, ...argumente].join(" ")}`);
    const lauf = spawnSync(befehl, argumente, { cwd, encoding: "utf8" });
    if (lauf.stdout?.trim()) console.log(lauf.stdout.trim().replace(/^/gm, "    "));
    if (lauf.status !== 0) {
      console.error(`\nSchritt gescheitert (Exit ${lauf.status}): ${befehl} ${argumente.join(" ")}`);
      if (lauf.stderr?.trim()) console.error(lauf.stderr.trim().replace(/^/gm, "    "));
      return false;
    }
  }
  return true;
}

const git = (cwd, ...argumente) => spawnSync("git", argumente, { cwd, encoding: "utf8" }).stdout?.trim() ?? "";

function haupt() {
  const kennung = process.argv[2];
  if (!kennung) {
    console.error("Aufruf: node tools/abgabe.mjs <kennung>");
    process.exit(1);
  }
  const cwd = process.cwd();
  const ordner = join(cwd, "openspec", "changes", kennung);
  const textDatei = join(tmpdir(), `pr-${kennung}.md`);
  const { fehler, schritte } = abgabeSchritte({
    kennung,
    fertigVorhanden: existsSync(join(ordner, "fertig.md")),
    zweig: git(cwd, "branch", "--show-current"),
    offen: git(cwd, "status", "--porcelain"),
    titel: `change(${kennung})`,
    textDatei,
  });
  if (fehler) {
    console.error(`Abgabe ${kennung} unterbleibt: ${fehler}`);
    process.exit(1);
  }
  console.log(`\nAbgabe ${kennung}\n`);
  // Erst committen und pushen, dann den Text mit dem Commit schreiben, dann den PR stellen.
  if (!ausfuehren(schritte.slice(0, -1), cwd)) process.exit(1);
  writeFileSync(textDatei, prText({
    kennung,
    repo: repoAusRemote(git(cwd, "remote", "get-url", "origin")) ?? "OWNER/REPO",
    sha: git(cwd, "rev-parse", "HEAD"),
    belege: liesJournal(ordner),
    fertig: readFileSync(join(ordner, "fertig.md"), "utf8"),
  }), "utf8");
  if (!ausfuehren(schritte.slice(-1), cwd)) process.exit(1);
  console.log(`\nPull Request steht. Merge: node tools/merge.mjs ${kennung}\n`);
}

// Beim Import aus einem Test darf der Einstieg nicht laufen -- er wuerde pushen.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  haupt();
}
