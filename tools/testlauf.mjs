#!/usr/bin/env node
// Ein Lauf ohne Handgriff: Auftrag rein, Agent arbeitet, Sitzung benannt.
//
// Der Unterschied zu messlauf.mjs ist der Start. Dort startet ein Mensch den
// Agenten, hier tut es dieses Werkzeug -- damit ein Lauf wiederholbar wird und
// sich zwei Werkzeugfassungen unter demselben Auftrag vergleichen lassen. Der
// Preis ist bekannt: ein Agent im Druckmodus ist nicht derselbe Ablauf wie eine
// Sitzung am Bildschirm. Gemessen wird hier also die Untergrenze, nicht der
// Alltag.
//
// Der Gewinn nebenbei: der Druckmodus nennt seine Sitzungskennung. Damit ist
// erstmals ein Lauf einem Change eindeutig zuzuordnen, statt ihn aus dem
// Zeitstempel zu erraten.
//
//   node tools/testlauf.mjs <kennung> [--ziel=..] [--modell=..] [--trocken]

import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { auftragstext } from "./messung.mjs";

const ZIEL_VORGABE = "../ops-lab-test";
const ABLAGE = join("docs", "messungen");

/** Der Tag im Zielrepo, der den Ausgangsstand des Werkstuecks markiert. */
export const STAND_0 = "stand-0";

/**
 * Was der Lauf bearbeitet -- und darum vor jedem Lauf auf Stand 0 gehoert.
 *
 * Der Rest des Zielrepos ist Geruest: `tools/`, `ops.py`, `justfile`. Das soll
 * gerade nicht zurueck, sondern nach vorn -- auf die Fassung, die hier gerade
 * gebaut wird. Zwei Dateimengen, zwei Richtungen; `git reset --hard` kann das
 * nicht, weil er beide zurueckzieht.
 */
export const WERKSTUECK = ["src", "tests", "openspec"];

/**
 * Was der Agent ueber seine Umgebung wissen muss, bevor der Auftrag kommt.
 *
 * Kein Teil des Messstuecks. Der Pruefwert deckt den Auftrag ab, nicht diesen
 * Rahmen -- sonst entwertete jede Anpassung an der Umgebung die ganze Messreihe,
 * ohne dass sich an der Aufgabe etwas geaendert haette.
 *
 * Warum er noetig ist: ein Lauf im Druckmodus gibt `just` und `openspec` nicht
 * frei, `node`, `git` und `gh` dagegen schon. Die Laeufe 63d7382f und 651d6f26
 * blieben genau daran haengen -- zusammen rund 60 Zuege fuer nichts. Verloren
 * geht dabei nichts: jedes just-Target ist ein Einzeiler um `node tools/*.mjs`,
 * und `openspec validate` ruft Gate 1 ohnehin als eigenen Kindprozess auf.
 */
export const RAHMEN = `In diesem Lauf sind \`just\` und \`openspec\` nicht freigegeben. Rufen Sie die
Werkzeuge direkt auf -- jedes just-Target ist genau ein Aufruf:

  just neu <id> <capability>  ->  node tools/neu.mjs <id> <capability>
  just gate1 <id>             ->  node tools/gate.mjs gate1 <id>
  just gate2 <id>             ->  node tools/gate.mjs gate2 <id>
  just fertig <id>            ->  node tools/gate.mjs fertig <id>
  just beleg <id> <stufe> <p> ->  node tools/beleg.mjs openspec/changes/<id> <stufe> <p>
  just belegbild <ziel> <modul> <funktion> <von> <bis>  ->  node tools/belegbild.mjs <ziel> --modul=<modul> --funktion=<funktion> --von=<von> --bis=<bis>
  just test                   ->  node --test --test-reporter=spec "tests/*.test.mjs"
  just abgabe <id>            ->  node tools/abgabe.mjs <id>
                                  (committet, pusht, stellt den Pull Request: gh pr create)
  Merge                       ->  node tools/merge.mjs <id>
                                  (gh pr merge, ferner Branch weg, Hauptordner nachziehen)

Die Gates rufen \`openspec validate\` selbst auf; Sie brauchen es nicht direkt.
Gearbeitet wird im Arbeitsraum, den \`neu.mjs\` anlegt, nicht im Hauptordner.
Der Auftrag ist vollstaendig; kein Issue wird nachgeschlagen.

Den sichtbaren Beleg rendern Sie nicht selbst -- dafuer gibt es ein Werkzeug. Es ruft
eine Funktion Ihrer Umsetzung auf und zeichnet, was zurueckkommt:

  node tools/belegbild.mjs /tmp/beleg.svg --modul=src/<modul>.mjs --funktion=<name> --von=<x von> --bis=<x bis> --argument=<festes Argument> --fall=<x> --titel="<Titel>"

Die Kurve laeuft ueber den letzten Parameter Ihrer Funktion. --argument belegt die
Parameter davor, in Reihenfolge, einmal je Parameter; --fall nennt einzelne Werte, die
als Punkte erscheinen. Oeffnen Sie das Bild nicht -- liefern Sie es gleich ein.

Ein eigenes Render-Skript ausserhalb von tools/ wird nicht freigegeben. Das Bild kommt
aus dem Modul, damit jede Zahl darin ein echter Aufruf ist. Danach einliefern wie oben.

Jeder Bash-Aufruf ist genau ein Befehl -- keine Verkettung mit \`&&\`, \`;\` oder \`|\`.
Verkettete Befehle werden nicht freigegeben; schreiben Sie stattdessen zwei Aufrufe.

Die Werkzeuge pruefen selbst und melden, was fehlt. Lesen Sie ihre Quellen nicht,
nur ihren Vertrag:

  neu.mjs <id> <capability>         legt Arbeitsraum, Branch und vier Artefakte an
  gate.mjs gate1 <id>               prueft proposal, spec und tasks; meldet, was fehlt
  gate.mjs gate2 <id>               verlangt den roten Testlauf
  gate.mjs fertig <id>              verlangt gruene Tests und einen sichtbaren Beleg
  beleg.mjs <vorgang> <stufe> <p>   liefert ein Bild oder einen Graphen ein
  belegbild.mjs <ziel.svg> ...      rendert das Bild aus Ihrer Funktion
  abgabe.mjs <id>                   committet, pusht und stellt den Pull Request
  merge.mjs <id>                    mergt den Pull Request und zieht den Hauptordner nach

Das Muster fuer proposal.md, spec.md und tasks.md ist die juengste archivierte
Aenderung unter openspec/changes/archive/ -- lesen Sie davon nur diese drei Dateien;
neu.mjs nennt ihre Pfade. Die drei angelegten Artefakte sind Vorlagen mit Platzhaltern:
nicht lesen, sondern nach dem Muster ueberschreiben.

--- Der Auftrag:

`;

/** Auftrag mit dem Umgebungsrahmen davor. Der Pruefwert bleibt am Auftrag. */
export function mitRahmen(auftrag) {
  return RAHMEN + auftrag;
}

/**
 * Darf der Lauf starten?
 *
 * Getrennt von jedem Dateizugriff, damit die Regel selbst pruefbar bleibt. Was
 * im Zielrepo tatsaechlich steht, stellt der Aufrufer fest.
 */
/**
 * Was ein frueherer Lauf derselben Kennung hinterlassen haben kann -- und der
 * Handgriff, der es wegraeumt. Geraeumt wird hier nichts: jeder Fund kann
 * Arbeit enthalten, die nirgends sonst liegt.
 *
 * Der Anlass: Lauf 40d36a23 fand Arbeitsraum, Branch und Werkstueck aus Lauf
 * 89401f6c vor und verbrachte rund ein Drittel seiner Aufrufe damit, das zu
 * verstehen und zu umgehen -- gemessen wurde dann die Altlast, nicht der Ablauf.
 */
function altlastBefund({ arbeitsraum, zweigLokal, zweigFern, prOffen, fernAbweichung }, kennung) {
  const funde = [];
  const zweig = `change/${kennung}`;
  if (arbeitsraum) {
    funde.push({
      was: `Arbeitsraum .claude/worktrees/${kennung} liegt noch vor.`,
      handgriff: `git worktree remove .claude/worktrees/${kennung}`,
    });
  }
  if (zweigLokal) {
    funde.push({
      was: `Lokaler Branch ${zweig} steht noch.`,
      handgriff: `git branch -m ${zweig} alt/${kennung}   (oder: git branch -D ${zweig})`,
    });
  }
  if (zweigFern) {
    funde.push({
      was: `Ferner Branch ${zweig} steht noch.`,
      handgriff: `git push origin --delete ${zweig}`,
    });
  }
  if (prOffen != null) {
    funde.push({
      was: `Pull Request #${prOffen} zu ${zweig} ist noch offen.`,
      handgriff: `gh pr close ${prOffen}`,
    });
  }
  if (fernAbweichung?.length) {
    funde.push({
      was: `origin/main traegt das Werkstueck eines frueheren Laufs:\n    ${fernAbweichung.join("\n    ")}`,
      handgriff: `git push --force-with-lease origin main   (nach 'just stand-0' und Commit)`,
    });
  }
  return funde;
}

export function startfreigabe({ tagVorhanden, offen, werkstueckAbweichung, kennung, altlast }) {
  if (!tagVorhanden) {
    return {
      start: false,
      grund: `Kein Tag '${STAND_0}' im Zielrepo.`,
      rat: `Einmalig setzen, wo der Ausgangsstand steht:\n  git tag ${STAND_0}`,
    };
  }
  if (offen) {
    return {
      start: false,
      grund: "Das Zielrepo traegt offene Aenderungen.",
      rat: "Ein Lauf braucht einen definierten Ausgangsstand.\nAufraeumen oder wegsichern, dann erneut starten.",
    };
  }
  if (werkstueckAbweichung.length) {
    return {
      start: false,
      grund: `Das Werkstueck weicht von ${STAND_0} ab:\n  ${werkstueckAbweichung.join("\n  ")}`,
      // Chirurgisch statt 'reset --hard': das Geruest bleibt, wo es ist.
      rat: `Zuruecksetzen -- nur das Werkstueck, das Geruest bleibt aktuell:\n  just stand-0`,
    };
  }
  const funde = altlast ? altlastBefund(altlast, kennung) : [];
  if (funde.length) {
    return {
      start: false,
      grund: `Altlast der Kennung ${kennung} aus einem frueheren Lauf:\n  ${funde.map((f) => f.was).join("\n  ")}`,
      // Nichts davon wird hier entfernt: jeder Fund kann Arbeit tragen, die
      // nirgends sonst liegt. Der Handgriff bleibt am Menschen.
      rat: `Wegraeumen -- im Zielrepo, von Hand:\n  ${funde.map((f) => f.handgriff).join("\n  ")}`,
    };
  }
  return { start: true };
}

/**
 * Die Aufrufzeile fuer den Agenten.
 *
 * Zwei Fassungen sind hier gescheitert, beide belegt:
 *
 *   `--permission-mode bypassPermissions` (Lauf 784326bc) -- wirkungslos, weil
 *   der Modus ohne --allow-dangerously-skip-permissions nicht freigeschaltet
 *   ist. `--allowedTools` mit siebzehn Mustern (Lauf f5c6cbb8) -- ebenfalls
 *   wirkungslos, weil `defaultMode: "auto"` in den Benutzereinstellungen jeden
 *   Befehl nochmals einem Classifier vorlegt, und der entscheidet ueber der
 *   Liste. Beide Laeufe endeten nach rund dreissig Aufrufen Orientierung mit
 *   'This command requires approval' bei `just neu` und schrieben keine Zeile.
 *
 * Bleibt der harte Weg. Er ist hier vertretbar und nirgends sonst: das Zielrepo
 * ist ein Laborwerkstueck, sein Ausgangsstand steht als Tag fest, und was der
 * Lauf anstellt, ist danach im git-Log zu sehen. Ein unbeaufsichtigter Lauf
 * *ist* der Zweck dieses Werkzeugs -- wer ihn nicht will, startet den Agenten
 * von Hand, wofuer messlauf.mjs da ist.
 *
 * `--output-format stream-json` liefert die Sitzungskennung im ersten Satz;
 * `--verbose` ist dafuer Voraussetzung.
 */
/**
 * Die Befehle, die der Ablauf braucht -- und keinen mehr.
 *
 * Jede Zeile steht fuer einen Schritt: anlegen und Gates (just), die Werkzeuge
 * direkt (node), der Zweig samt Push (git), der Pull Request (gh), die Specs
 * (openspec), das Lagebild (python3, uv). Wer eine Zeile streicht, sieht im
 * naechsten Lauf, wo der Ablauf stehenbleibt.
 */
export const ERLAUBT = [
  "Bash(just:*)",
  "Bash(node:*)",
  "Bash(git:*)",
  "Bash(gh:*)",
  "Bash(openspec:*)",
  "Bash(python3:*)",
  "Bash(uv:*)",
  "Bash(cd:*)",
  "Write",
  "Edit",
];

export function claudeArgumente(auftrag, { modell } = {}) {
  const argumente = [
    "-p",
    auftrag,
    // acceptEdits, nicht auto. Der auto-Modus verwirft beim Eintritt genau die
    // Regeln, die dieser Ablauf braucht -- "wildcarded interpreters" und
    // "package-manager run commands", also 'just:*' und 'node:*'. Was er
    // verwirft, landet beim Classifier, und ein '-p'-Lauf hat keine Rueckfrage,
    // auf die der zurueckfallen koennte: der Befehl laeuft einfach nicht.
    // So geschehen in den Laeufen 784326bc und f5c6cbb8, beide bei 'just neu'.
    // In acceptEdits bleiben die Regeln stehen und greifen sofort.
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    ...ERLAUBT,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  if (modell) argumente.push("--model", modell);
  return argumente;
}

/**
 * Die Sitzungskennung aus einem Satz des Stroms, sonst null.
 *
 * Sie steht im Eroeffnungssatz und wiederholt sich danach; der erste Treffer
 * gilt.
 */
export function sitzungAus(satz) {
  return typeof satz?.session_id === "string" ? satz.session_id : null;
}

/** Ein Satz des Stroms als knappe Zeile, oder null wenn er nichts hergibt. */
export function fortschritt(satz) {
  if (satz?.type === "system" && satz.subtype === "init") return `Sitzung ${satz.session_id}`;
  if (satz?.type === "assistant") {
    const teile = satz.message?.content ?? [];
    const werkzeuge = teile.filter((t) => t.type === "tool_use").map((t) => t.name);
    if (werkzeuge.length) return `  ${werkzeuge.join(", ")}`;
    const text = teile.find((t) => t.type === "text")?.text?.trim();
    if (text) return `  ${text.split("\n")[0].slice(0, 100)}`;
  }
  if (satz?.type === "result") {
    return `Ende: ${satz.subtype}, ${satz.num_turns} Zuege, ${Math.round((satz.duration_ms ?? 0) / 1000)}s`;
  }
  return null;
}

function abbruch(...zeilen) {
  for (const z of zeilen) console.error(z);
  process.exit(1);
}

const git = (verzeichnis, ...argumente) => spawnSync("git", argumente, { cwd: verzeichnis, encoding: "utf8" });

/**
 * Was im Zielrepo von einem frueheren Lauf derselben Kennung liegt.
 *
 * Fern wird einmal geholt, damit origin/main und der ferne Branch den Stand von
 * jetzt zeigen. Ohne Netz oder gh bleibt der Befund an dieser Stelle leer --
 * dann prueft die Freigabe nur, was lokal zu sehen ist.
 */
function altlastLesen(ziel, kennung) {
  const zweig = `change/${kennung}`;
  git(ziel, "fetch", "origin", "--prune");

  let prOffen = null;
  const pr = spawnSync("gh", ["pr", "list", "--state", "open", "--head", zweig, "--json", "number"], { cwd: ziel, encoding: "utf8" });
  try {
    prOffen = JSON.parse(pr.stdout?.trim() || "[]")[0]?.number ?? null;
  } catch {
    prOffen = null;
  }

  const fernMain = git(ziel, "rev-parse", "--verify", "refs/remotes/origin/main").status === 0;
  return {
    arbeitsraum: existsSync(join(ziel, ".claude", "worktrees", kennung)),
    zweigLokal: git(ziel, "rev-parse", "--verify", `refs/heads/${zweig}`).status === 0,
    zweigFern: git(ziel, "rev-parse", "--verify", `refs/remotes/origin/${zweig}`).status === 0,
    prOffen,
    fernAbweichung: fernMain
      ? (git(ziel, "diff", "--name-only", STAND_0, "origin/main", "--", ...WERKSTUECK).stdout ?? "").split("\n").filter(Boolean)
      : [],
  };
}

// --- Einstieg ---------------------------------------------------------------

function haupt() {
const argumente = process.argv.slice(2);
const wert = (name, ersatz = null) => {
  const mitGleich = argumente.find((a) => a.startsWith(`--${name}=`));
  if (mitGleich) return mitGleich.slice(name.length + 3);
  const stelle = argumente.indexOf(`--${name}`);
  return stelle >= 0 ? argumente[stelle + 1] : ersatz;
};

const kennung = argumente.find((a) => !a.startsWith("--"));
if (!kennung) abbruch("Aufruf: node tools/testlauf.mjs <kennung> [--ziel=..] [--modell=..] [--trocken]");

const zielArgument = wert("ziel", ZIEL_VORGABE);
const ziel = isAbsolute(zielArgument) ? zielArgument : resolve(process.cwd(), zielArgument);
const modell = wert("modell");
const trocken = argumente.includes("--trocken");

if (!existsSync(ziel)) abbruch(`Kein Zielrepo unter ${ziel}.`);

const auftragPfad = join(ABLAGE, `auftrag-${kennung}.md`);
if (!existsSync(auftragPfad)) abbruch(`Kein Auftrag unter ${auftragPfad}.`);

const auftrag = auftragstext(readFileSync(auftragPfad, "utf8"));
if (!auftrag) {
  abbruch(`${auftragPfad} enthaelt keinen Auftragsblock.`, "Erwartet: '## Der Auftrag ab hier' und '## Der Auftrag bis hier'.");
}
const pruefwert = createHash("sha256").update(auftrag).digest("hex").slice(0, 12);

// Ein Lauf auf unsauberem Stand ist nicht vergleichbar: was schon da lag,
// zaehlt der Agent als seine Arbeit. Zurueckgesetzt wird hier nichts -- das
// bliebe unwiederbringlich und ist ein Handgriff des Menschen.
const freigabe = startfreigabe({
  tagVorhanden: git(ziel, "rev-parse", "--verify", `refs/tags/${STAND_0}`).status === 0,
  offen: git(ziel, "status", "--porcelain").stdout?.trim() || "",
  werkstueckAbweichung: (git(ziel, "diff", "--name-only", STAND_0, "HEAD", "--", ...WERKSTUECK).stdout ?? "")
    .split("\n")
    .filter(Boolean),
  kennung,
  altlast: altlastLesen(ziel, kennung),
});
if (!freigabe.start) abbruch(`Lauf ${kennung} startet nicht.`, "", freigabe.grund, "", freigabe.rat);

// Das Geruest dagegen soll nach vorn: der Lauf misst die Fassung, die hier
// gerade gebaut wird, nicht die vom letzten Mal. Ausgerollt wird immer, und was
// sich dabei aendert, bekommt einen eigenen Commit -- damit steht im Log des
// Zielrepos, unter welcher Werkzeugfassung der Lauf gefahren ist.
//
// Nicht im Trockenlauf: der zeigt den Aufruf und schreibt nichts, auch nicht
// ins Zielrepo.
const werkzeugfassung = git(process.cwd(), "rev-parse", "--short", "HEAD").stdout?.trim() ?? "unbekannt";
if (!trocken) {
  const ausgerollt = spawnSync(process.execPath, [join("tools", "sync.mjs"), ziel], { encoding: "utf8" });
  if (ausgerollt.status !== 0) abbruch("Das Geruest liess sich nicht ausrollen:", ausgerollt.stdout ?? "", ausgerollt.stderr ?? "");

  const nachSync = git(ziel, "status", "--porcelain").stdout?.trim();
  if (nachSync) {
    git(ziel, "add", "-A");
    git(ziel, "commit", "-m", `Geruest aus ops-lab ${werkzeugfassung}`);
    console.log(`  Geruest    aktualisiert auf ops-lab ${werkzeugfassung}`);
  }
}

const stand = git(ziel, "rev-parse", "--short", "HEAD").stdout?.trim();
const zweig = git(ziel, "branch", "--show-current").stdout?.trim();
const aufrufArgumente = claudeArgumente(mitRahmen(auftrag), { modell });

console.log(`\nLauf ${kennung}`);
console.log(`  Ziel       ${ziel}  (${zweig} ${stand})`);
console.log(`  Auftrag    ${auftragPfad}, Pruefwert ${pruefwert}`);
console.log(`  Modell     ${modell ?? "(Vorgabe der Sitzung)"}`);

if (trocken) {
  const gerahmt = mitRahmen(auftrag);
  console.log(`\n  Aufruf:    claude ${aufrufArgumente.map((a) => (a === gerahmt ? "<rahmen+auftrag>" : a)).join(" ")}\n`);
  process.exit(0);
}

console.log(`\n  Der Agent laeuft jetzt selbstaendig. Abbruch mit Strg-C.\n`);

const beginn = Date.now();
const kind = spawn("claude", aufrufArgumente, { cwd: ziel, stdio: ["ignore", "pipe", "inherit"] });

let sitzung = null;
let ergebnis = null;
let rest = "";

kind.stdout.on("data", (haufen) => {
  rest += haufen.toString();
  const zeilen = rest.split("\n");
  rest = zeilen.pop() ?? "";
  for (const zeile of zeilen) {
    if (!zeile.trim()) continue;
    let satz;
    try {
      satz = JSON.parse(zeile);
    } catch {
      continue;
    }
    sitzung ??= sitzungAus(satz);
    if (satz.type === "result") ergebnis = satz;
    const zeigbar = fortschritt(satz);
    if (zeigbar) console.log(zeigbar);
  }
});

kind.on("close", (code) => {
  const sekunden = Math.round((Date.now() - beginn) / 1000);
  const notiz = {
    kennung,
    ziel,
    pruefwert,
    modell: modell ?? null,
    sitzung,
    werkzeugfassung,
    standVorher: stand,
    beginn: new Date(beginn).toISOString(),
    sekunden,
    code,
    ergebnis: ergebnis ? { subtype: ergebnis.subtype, zuege: ergebnis.num_turns, kosten: ergebnis.total_cost_usd ?? null } : null,
  };

  mkdirSync(ABLAGE, { recursive: true });
  const pfad = join(ABLAGE, `lauf-${kennung}-${new Date(beginn).toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`);
  writeFileSync(pfad, `${JSON.stringify(notiz, null, 2)}\n`);

  console.log(`\n  Dauer      ${Math.floor(sekunden / 60)}min ${sekunden % 60}s`);
  console.log(`  Sitzung    ${sitzung ?? "(keine gemeldet)"}`);
  console.log(`  Abgelegt   ${pfad}`);
  console.log(`\n  Messen:    node tools/messlauf.mjs messe ${kennung} --ziel=${ziel}${sitzung ? ` --sitzung=${sitzung}` : ""}\n`);
  process.exit(code ?? 1);
});
}

// Die Funktionen oben sind rein und werden geprueft; beim Import aus einem Test
// darf der Einstieg nicht laufen -- er wuerde einen Agenten starten.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  haupt();
}
