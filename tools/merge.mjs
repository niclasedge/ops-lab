// Merge eines Changes in einem Aufruf -- aus dem Arbeitsraum heraus.
//
// `gh pr merge --delete-branch` und `git checkout main` scheitern im Arbeitsraum
// beide an "'main' is already used by worktree": der Hauptordner hat main
// ausgecheckt, und ein zweiter Arbeitsbaum darf ihn nicht nehmen. Die Laeufe
// 89401f6c und 40d36a23 liefen genau dort auf und suchten Umwege. Hier wird
// darum nichts ausgecheckt: gemergt wird ueber gh, der ferne Branch geht mit
// `git push --delete`, und den Hauptordner zieht `git -C <haupt> pull` nach.
//
// Gemergt wird nur mit allen drei Nachweisen -- dieselbe Regel, die der
// Leitstand anwendet. Die Schritte bestimmt `mergeSchritte` als reine Funktion,
// geprueft in tests/abgabe.test.mjs.
//
// Aufruf, im Arbeitsraum des Changes:
//   node tools/merge.mjs <kennung>

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ausfuehren } from "./abgabe.mjs";

/** Die Schritte des Merges -- oder der Grund, warum es keine gibt. */
export function mergeSchritte({ kennung, hauptordner, nachweise }) {
  const fehlend = ["gate1", "gate2", "fertig"].filter((n) => !nachweise?.[n]);
  if (fehlend.length) {
    return { fehler: `Nachweis fehlt: ${fehlend.map((n) => `${n}.md`).join(", ")}. Gemergt wird nur vollstaendig belegt.`, schritte: [] };
  }
  const zweig = `change/${kennung}`;
  return {
    fehler: null,
    schritte: [
      // --admin: das Laborrepo hat keine Pruefungen, auf die zu warten waere.
      // Kein --delete-branch: das checkt main aus und scheitert im Arbeitsraum.
      ["gh", "pr", "merge", zweig, "--merge", "--admin"],
      ["git", "push", "origin", "--delete", zweig],
      ["git", "-C", hauptordner, "pull", "--ff-only"],
    ],
  };
}

const git = (cwd, ...argumente) => spawnSync("git", argumente, { cwd, encoding: "utf8" }).stdout?.trim() ?? "";

/** Der Hauptordner: der erste Arbeitsbaum, den git fuehrt. */
function hauptordnerVon(cwd) {
  const erste = git(cwd, "worktree", "list", "--porcelain").split("\n")[0] ?? "";
  return erste.startsWith("worktree ") ? erste.slice("worktree ".length) : cwd;
}

function haupt() {
  const kennung = process.argv[2];
  if (!kennung) {
    console.error("Aufruf: node tools/merge.mjs <kennung>");
    process.exit(1);
  }
  const cwd = process.cwd();
  const vorgang = join(cwd, "openspec", "changes", kennung);
  const { fehler, schritte } = mergeSchritte({
    kennung,
    hauptordner: hauptordnerVon(cwd),
    nachweise: Object.fromEntries(["gate1", "gate2", "fertig"].map((n) => [n, existsSync(join(vorgang, `${n}.md`))])),
  });
  if (fehler) {
    console.error(`Merge ${kennung} unterbleibt: ${fehler}`);
    process.exit(1);
  }
  console.log(`\nMerge ${kennung}\n`);
  if (!ausfuehren(schritte, cwd)) process.exit(1);
  console.log(`\nGemergt. Der Hauptordner steht auf main; der Arbeitsraum bleibt liegen, bis Sie ihn entfernen.\n`);
}

// Beim Import aus einem Test darf der Einstieg nicht laufen -- er wuerde mergen.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  haupt();
}
