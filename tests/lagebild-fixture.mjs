// Gemeinsamer Aufbau der Lagebild-Tests: Wegwerf-Repos und ein Aufruf von ops.py,
// der nichts abschneidet.
//
// Die Tests liefen frueher gegen den Arbeits-Clone und wurden rot, sobald parallele
// Arbeitsraeume unter `.claude/worktrees/` in einem bestimmten Zustand standen, oder
// brachen an der 1-MiB-Vorgabe von spawnSync ab (Issue #722). Was hier gebaut wird,
// liegt im Temporaerverzeichnis und traegt genau den Zustand, den der Test herstellt.
//
// Kein Test: der Name endet nicht auf `.test.mjs`, damit `node --test "tests/*.test.mjs"`
// ihn nicht selbst ausfuehrt.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Die Wurzel des Checkouts, in dem ops.py liegt -- nur fuer den Aufruf, nie als --root. */
export const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

export const MIB = 1024 * 1024;

// Die Vorgabe von spawnSync ist 1 MiB; darueber wird die Ausgabe still gekappt und das
// Kind beendet. Die Grenze hier liegt weit ueber jeder Nutzlast, die ein Repo erzeugt.
const PUFFER = 512 * MIB;

/** Wie im justfile: wo `uv` da ist, laeuft python3 darueber -- mit --no-sync, sonst biegt uv den Editable-Install der geteilten .venv auf diesen Worktree um (#812). */
export function pythonAufruf() {
  const uv = spawnSync("uv", ["--version"], { encoding: "utf8" });
  return uv.status === 0 ? { befehl: "uv", vorab: ["run", "--no-sync", "python3"] } : { befehl: "python3", vorab: [] };
}

/** ops.py mit den gegebenen Argumenten; die Ausgabe kommt ungekuerzt zurueck. */
export function ops(...argumente) {
  const { befehl, vorab } = pythonAufruf();
  const lauf = spawnSync(befehl, [...vorab, "ops.py", ...argumente],
    { cwd: WURZEL, encoding: "utf8", timeout: 120_000, maxBuffer: PUFFER });
  const fehler = lauf.error ? `${lauf.error.message}\n${lauf.stderr ?? ""}` : (lauf.stderr ?? "");
  return { code: lauf.status, aus: lauf.stdout ?? "", fehler };
}

export function git(ordner, ...argumente) {
  const lauf = spawnSync("git", argumente, { cwd: ordner, encoding: "utf8", maxBuffer: PUFFER });
  if (lauf.status !== 0) {
    throw new Error(`git ${argumente.join(" ")} in ${ordner}: ${lauf.stderr}`);
  }
  return lauf.stdout ?? "";
}

export function schreibe(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, inhalt);
}

/**
 * Ein Change, wie ihn `read_worktree` erwartet: Vorhaben, Aufgabenliste, Delta-Spec.
 * `gates` legt die Nachweise an (`gate1`, `gate2`, `fertig`), nach denen ops.py die
 * Stufe im Ablauf bestimmt.
 */
export function legeChange(baum, name, aufgaben, { gates = [] } = {}) {
  const ordner = join(baum, "openspec", "changes", name);
  schreibe(join(ordner, "proposal.md"), `# ${name}\n\n## Warum\n\nEine Probe.\n`);
  schreibe(join(ordner, "specs", "probe", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: Probe\n\nDas System SHALL etwas tun.\n");
  const zeilen = aufgaben.map(([erledigt, nummer, text]) =>
    `- [${erledigt ? "x" : " "}] ${nummer} ${text}`);
  schreibe(join(ordner, "tasks.md"), `# Aufgaben — ${name}\n\n## Abschnitt\n\n${zeilen.join("\n")}\n`);
  for (const gate of gates) {
    schreibe(join(ordner, `${gate}.md`), `# ${gate} — ${name}\n`);
  }
  return ordner;
}

/** Alles im Baum vormerken und committen. */
export function commitAlles(ordner, betreff) {
  git(ordner, "add", "-A");
  git(ordner, "commit", "-qm", betreff);
}

/**
 * Ein leeres Wegwerf-Repo `probe-repo` mit einem ersten Commit. `.claude/` ist ignoriert,
 * wie im echten Repo, damit die Arbeitsbaeume darunter den Hauptbaum nicht verschmutzen.
 */
export function neuesRepo(praefix = "ops-probe-") {
  const huelle = mkdtempSync(join(tmpdir(), praefix));
  const wurzel = join(huelle, "probe-repo");
  mkdirSync(wurzel, { recursive: true });
  git(wurzel, "init", "-q", "-b", "main");
  git(wurzel, "config", "user.email", "probe@example.invalid");
  git(wurzel, "config", "user.name", "Probe");
  git(wurzel, "config", "commit.gpgsign", "false");
  schreibe(join(wurzel, ".gitignore"), ".claude/\n");
  schreibe(join(wurzel, "README.md"), "Wegwerf-Repo für den Trockenlauf.\n");
  commitAlles(wurzel, "Probe: Anfang");
  return { huelle, wurzel, aufraeumen: () => rmSync(huelle, { recursive: true, force: true }) };
}

/** Ein Arbeitsbaum unter `.claude/worktrees/NAME` auf dem Branch `change/NAME`. */
export function arbeitsbaum(wurzel, name) {
  const pfad = join(wurzel, ".claude", "worktrees", name);
  git(wurzel, "worktree", "add", "-q", pfad, "-b", `change/${name}`);
  return pfad;
}

// ops.py liest eine tasks.md nur bis 400 000 Zeichen; eine grosse Nutzlast waechst
// deshalb ueber mehrere Changes, von denen jeder unter dieser Grenze bleibt.
export const GROSS_AUFGABEN = 800;

/** Ein Wegwerf-Repo mit `changes` Changes zu je GROSS_AUFGABEN langen Aufgaben. */
export function grossesRepo(changes) {
  const repo = neuesRepo("ops-gross-");
  const fuellung = "Eine lange Aufgabe, die die Nutzlast wachsen laesst. ".repeat(8);
  const aufgaben = Array.from({ length: GROSS_AUFGABEN },
    (_, i) => [false, `1.${i + 1}`, `Aufgabe ${i + 1}: ${fuellung}`]);
  for (let n = 1; n <= changes; n += 1) legeChange(repo.wurzel, `probe-gross-${n}`, aufgaben);
  commitAlles(repo.wurzel, "Probe: grosse Changes");
  return repo;
}

/**
 * Wie viel MiB Nutzlast von `--web --trocken` bei `changes` grossen Changes ankommen --
 * NaN, wenn die Ausgabe nicht als JSON parst oder nicht jede Aufgabe fuehrt. Die Kurve
 * im Beleg des Changes 16-lagebild-tests-hermetisch ist diese Funktion.
 */
export function nutzlastMiB(changes) {
  const repo = grossesRepo(Math.round(changes));
  try {
    const lauf = ops("--root", repo.wurzel, "--web", "--trocken");
    if (lauf.code !== 0) return Number.NaN;
    const vollstaendig = JSON.parse(lauf.aus).changes
      .every((ch) => ch.aufgaben.length === GROSS_AUFGABEN);
    return vollstaendig ? Buffer.byteLength(lauf.aus) / MIB : Number.NaN;
  } catch {
    return Number.NaN;
  } finally {
    repo.aufraeumen();
  }
}
