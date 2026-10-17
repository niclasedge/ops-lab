#!/usr/bin/env node
// Der Torwaechter des selbstaendigen Laufs.
//
// Warum es ihn gibt: in einem Lauf mit `claude -p` greifen die allow-Listen aus
// den Einstellungen nicht. Fuenf Laeufe haben das gezeigt -- `git ls-files`
// wurde abgelehnt, obwohl `Bash(git:*)` global freigegeben ist, und
// `node tools/neu.mjs` blieb in jedem Lauf haengen. Entschieden hat jedes Mal
// der Classifier, und der laesst einen Interpreter mit Skript nicht durch.
//
// Was nachweislich durchkommt, ist ein PreToolUse-Hook mit
// `permissionDecision: allow` -- der rtk-Hook arbeitet so, und seine Befehle
// liefen in denselben Laeufen anstandslos. Dieser Hook macht dasselbe, aber nur
// fuer die Befehle des Ablaufs.
//
// Der Rahmen ist eng gezogen:
//   - nur die Werkzeuge dieses Repos, `git`, `gh pr`/`gh issue`, `openspec`, `just`
//   - kein zusammengesetzter Befehl (&&, ||, ;, |) -- was verkettet ist, wird
//     nicht entschieden, sonst haengt hinter einem erlaubten Kopf beliebiges an
//   - kein erzwungener Push, kein harter Reset, kein `clean`
// Alles, was hier nicht zusagt, bleibt unentschieden: dann urteilt wie bisher
// die normale Pruefung. Der Hook erlaubt, er verbietet nichts.
//
//   node tools/freigabe.mjs      (liest den Hook-Satz von stdin)

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Verkettungen bleiben aussen vor: der Kopf sagt nichts ueber den Rest. */
export const VERKETTET = /&&|\|\||;|\||\$\(|`/;

/** Was der Lauf braucht. Jede Zeile ist ein Schritt des Ablaufs. */
export const MUSTER = [
  /^node\s+(\.\/)?tools\/[a-z]+\.mjs(\s|$)/, // neu, gate, beleg, ops
  /^node\s+--test(\s|$)/, // der Testlauf
  /^node\s+--check\s/, // die Syntaxpruefung
  /^just(\s|$)/,
  /^openspec\s/,
  /^gh\s+(pr|issue)\s/,
  /^git\s/,
];

/** Was auch im Testrepo nicht von selbst laufen soll. */
export const NIEMALS = [
  /^git\s+push\s+.*(--force|-f)(\s|$)/,
  /^git\s+reset\s+--hard/,
  /^git\s+clean/,
  /^gh\s+repo\s+delete/,
];

/**
 * Das Urteil ueber einen Befehl: "allow" oder null.
 *
 * null heisst nicht "verboten", sondern "nicht meine Sache" -- der Hook
 * schweigt, und die normale Pruefung entscheidet.
 */
export function entscheide(befehl) {
  if (typeof befehl !== "string") return null;
  const b = befehl.trim();
  if (!b || VERKETTET.test(b)) return null;
  if (NIEMALS.some((m) => m.test(b))) return null;
  return MUSTER.some((m) => m.test(b)) ? "allow" : null;
}

/** Die Antwort, die Claude Code von einem PreToolUse-Hook erwartet. */
export function antwort(befehl) {
  if (entscheide(befehl) !== "allow") return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "Befehl des ops-lab-Ablaufs",
    },
  };
}

function haupt() {
  let satz;
  try {
    satz = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return; // Kein lesbarer Satz: schweigen ist richtiger als raten.
  }
  if (satz?.tool_name !== "Bash") return;
  const a = antwort(satz?.tool_input?.command);
  if (a) process.stdout.write(JSON.stringify(a));
}

// Beim Import aus einem Test darf der Einstieg nicht laufen -- er liest stdin.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  haupt();
}
