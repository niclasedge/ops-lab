// Die Lage in einem Aufruf: was zuletzt fertig wurde, was laeuft, was sich ohne
// Konflikt beginnen liesse, was blockiert ist und was nur noch im Weg steht.
//
// Vier Quellen, eine Ausgabe. Faellt eine davon aus -- kein `gh` im Pfad, keine
// Anmeldung, kein Netz --, wird sie unter `stumm` vermerkt und der Aufruf endet
// trotzdem mit 0. Ein Lagebild, das beim ersten stummen Werkzeug abbricht, ist keines:
// es soll den Stand melden, auch wenn ein Teil des Standes gerade unbekannt ist.
//
// Aufruf:
//   node tools/lage.mjs [--root PFAD] [--json | --kurz]

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { aufgaben } from "./pruefungen.mjs";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

/** Wie viele abgeschlossene Changes die Ausgabe zurueckblickt. */
const RUECKBLICK = 5;

/** Das Label, mit dem ein Issue seinen Change ausdruecklich claimt. */
const CLAIM_LABEL = "in-arbeit";

/** Wie viele offene Issues `ideen` zeigt -- die Verknuepfung sieht alle. */
const IDEEN_GRENZE = 20;

/** Wie viele offene Issues die Issue-Quelle hoechstens holt. */
const ISSUE_GRENZE = 500;

// --- Reine Funktionen: ohne Platte, ohne Prozess -----------------------------

/**
 * Welche Arbeitsraeume nur noch dastehen.
 *
 * Verwaist heisst: der Branch steckt bereits in `main`, seine Spitze ist nicht zugleich
 * die Spitze von `main`, und unter `openspec/changes` des Hauptbaums liegt kein
 * gleichnamiger Ordner mehr. Dann ist die Arbeit gemergt und archiviert.
 *
 * Die mittlere Bedingung ist die, die man beim ersten Anlauf vergisst. Ein eben
 * angelegter Branch hat noch keinen eigenen Commit; er zeigt auf dieselbe Spitze wie
 * `main` und ist damit rechnerisch in `main` enthalten, ohne dass je etwas gemergt
 * wurde. Ohne diese Bedingung meldet das Lagebild jeden frisch angelegten Arbeitsraum
 * als verwaist -- genau verkehrt herum.
 *
 * Der Hauptbaum selbst ist nie verwaist, und ein Raum, dessen Change im Hauptbaum noch
 * offen daliegt, ebenso wenig: dort wurde zwischendurch geholt, nicht abgeschlossen.
 */
export function verwaisteRaeume(raeume, gemergte, laufende, hauptSpitze) {
  const istGemergt = new Set(gemergte);
  const laeuftNoch = new Set(laufende);
  return raeume
    .filter((raum) => !raum.hauptbaum
      && istGemergt.has(raum.branch)
      && raum.spitze !== hauptSpitze
      && !laeuftNoch.has(raum.name))
    .map((raum) => ({ raum: raum.name, branch: raum.branch }));
}

/**
 * Offene Changes, die kein Arbeitsraum traegt -- das, was man jetzt anfassen koennte.
 *
 * Abgrenzung zu `frei`: `frei` kommt aus dem Lagebild und heisst „keine unerfuellte
 * Abhaengigkeit". Das sagt nichts darueber, ob schon jemand daran sitzt. `ohne_raum`
 * sagt genau das: der Change liegt im Hauptbaum, hat offene Aufgaben, und es gibt
 * keinen Arbeitsraum dafuer. Beides zusammen ist die Frage „was kann ich jetzt
 * anfangen, ohne jemandem den Boden wegzuziehen".
 *
 * Ein Change ganz OHNE `tasks.md` (`gesamt === 0`) zaehlt als offen: er ist nicht
 * fertig, sondern noch nicht geplant -- ihn als erledigt zu fuehren waere eine
 * erfundene 0.
 *
 * Sortiert nach offenen Aufgaben aufsteigend (das Kleinste zuerst), bei Gleichstand
 * nach Kennung -- damit die Reihenfolge zwischen zwei Aufrufen steht.
 */
/**
 * Welche Changes schon jemand genommen hat -- und woran man das sieht.
 *
 * Der lokale Arbeitsraum beantwortet das nur fuer den eigenen Rechner: er liegt unter
 * `.claude/worktrees/` und ist gitignored. Eine zweite Sitzung in einem eigenen Container
 * sieht ihn nie und greift nach demselben Change. Geclaimt wird deshalb dort, wo beide
 * Seiten hinsehen koennen:
 *
 *   - ein Branch im Remote traegt die Kennung -- der Claim entsteht beim ersten Push,
 *     ohne zusaetzlichen Handgriff;
 *   - ein offenes Issue traegt das Label `in-arbeit` und nennt die Kennung am
 *     Titelanfang -- das greift auch vor dem ersten Push.
 *
 * Eine Quelle, die `null` liefert, hat nicht geantwortet. Aus ihrem Schweigen wird kein
 * Claim abgeleitet -- aber auch keine Freigabe: die Quelle wird stumm gemeldet, und wer
 * die Liste liest, weiss, dass sie unvollstaendig sein kann (Entscheid #36).
 */
export function claims({ kennungen, branches, issues }) {
  const gefunden = [];
  for (const kennung of kennungen ?? []) {
    const branch = (branches ?? []).find((name) => name.includes(kennung));
    if (branch) {
      gefunden.push({ kennung, grund: `branch: ${branch}` });
      continue;
    }
    const issue = (issues ?? []).find((posten) =>
      (posten.titel ?? "").startsWith(`${kennung}:`)
      && (posten.labels ?? []).includes(CLAIM_LABEL));
    if (issue) gefunden.push({ kennung, grund: `label: ${CLAIM_LABEL} (#${issue.nummer})` });
  }
  return gefunden.sort((a, b) => a.kennung.localeCompare(b.kennung));
}

/**
 * Die Issue-Nummer, auf die ein `proposal.md` zurueckgeht -- oder null.
 *
 * Gelesen wird nur die eigenstaendige Zeile, die `neu.mjs` schreibt
 * (`Geht zurueck auf GitHub-Issue #N.`), am Zeilenanfang; ein Zusatz dahinter ist erlaubt.
 * Eine lose erwaehnte Nummer -- „vgl. PR #450" oder die Abgrenzung „(GitHub-Issue #694),
 * nicht unter diesen Change" -- ist keine Verknuepfung: sie nennt, woher etwas kommt oder
 * wohin es gehoert, nicht, wo der Change gefuehrt wird (#930).
 */
export function issueNummerAus(text) {
  const treffer = (text ?? "").match(/^Geht zurueck auf GitHub-Issue #(\d+)\b/m);
  return treffer ? Number(treffer[1]) : null;
}

/**
 * Welche offenen Changes kein eigenes Issue haben -- und was dagegen zu tun ist.
 *
 * Verknuepft ist ein Change, dessen `proposal.md` die Zeile `GitHub-Issue #N` traegt, oder
 * zu dem ein offenes Issue mit dem Titel `kennung: …` existiert. `issues` = null heisst:
 * die Issue-Quelle hat nicht geantwortet. Dann laesst sich nur die Zeile im proposal.md
 * belegen; jeder Change ohne sie bleibt `unbewertet` -- nie „verknuepft" (Entscheid #36).
 */
export function ohneIssue({ changes, issues }) {
  const titel = issues === null || issues === undefined
    ? null
    : issues.map((posten) => posten.titel ?? posten.title ?? "");
  return (changes ?? [])
    .filter((change) => !change.issue)
    .filter((change) => titel === null
      || !titel.some((text) => text.startsWith(`${change.kennung}:`)))
    .map((change) => (titel === null
      ? {
        kennung: change.kennung,
        grund: "unbewertet: Issue-Quelle stumm",
        folgebefehl: "gh api user   # Issue-Quelle pruefen, dann just lage",
      }
      : {
        kennung: change.kennung,
        grund: "kein Issue",
        folgebefehl: `gh issue create --title "${change.kennung}: …" --label ready-for-agent`
          + ` --body-file openspec/changes/${change.kennung}/proposal.md`,
      }))
    .sort((a, b) => a.kennung.localeCompare(b.kennung));
}

/**
 * Ob ein Arbeitsraum dem Change `kennung` gehoert.
 *
 * `just neu` legt den Raum unter `.claude/worktrees/KENNUNG` auf dem Branch
 * `change/KENNUNG` an; eines von beiden genuegt. Dass der Change-Ordner im Raum liegt,
 * genuegt nicht: jeder Checkout des Hauptzweigs traegt alle Change-Ordner von dort.
 */
export function gehoertZu(raum, kennung) {
  return raum.branch === `change/${kennung}` || raum.name === kennung;
}

export function ohneArbeitsraum(hauptChanges, aktiv) {
  const belegt = new Set((aktiv ?? []).map((eintrag) => eintrag.kennung));
  return (hauptChanges ?? [])
    .filter((change) => !belegt.has(change.kennung))
    .filter((change) => change.gesamt === 0 || change.offen > 0)
    .sort((a, b) => (a.offen - b.offen) || a.kennung.localeCompare(b.kennung))
    .map((change) => ({ kennung: change.kennung, offen: change.offen, gesamt: change.gesamt }));
}

/**
 * Der Hauptzweig, gegen den `verwaist` rechnet: `master`, sonst `main`, sonst keiner.
 *
 * Fest `main` scheiterte in diesem Repo still, `verwaist` war immer 0 (#765). Aus
 * `origin/HEAD` laesst er sich nicht verlaesslich lesen: in frischen Clones ist das kein
 * symbolischer Ref. `main` bleibt als Rueckfall fuer Wegwerf-Repos und andere Clones.
 */
export function hauptzweig(vorhandene) {
  const namen = new Set(vorhandene ?? []);
  if (namen.has("master")) return "master";
  if (namen.has("main")) return "main";
  return null;
}

/** Die Rollen, die ein Issue in eine Hand legen -- die des Agenten und die des Menschen. */
const ROLLE_AGENT = "ready-for-agent";
const ROLLEN_MENSCH = ["ready-for-human", "needs-info", "needs-triage", "s15-approval",
  "human-verify"];

/**
 * Welche Seite der blocked-by-Kanten sich mit weniger Aufrufen holen laesst.
 *
 * Die Issue-Liste traegt je Issue `issue_dependencies_summary`: `blocked_by` = offene
 * Blocker, `blocking` = offene blockierte Issues. Jede Kante zwischen zwei offenen Issues
 * sieht man von beiden Enden; es genuegt also, die kleinere Menge zu befragen -- heute
 * rund zehn Blocker statt rund dreissig Blockierter.
 */
export function detailPlan(issues) {
  const mit = (feld) => (issues ?? [])
    .filter((posten) => (posten.deps?.[feld] ?? 0) > 0)
    .map((posten) => posten.number)
    .sort((a, b) => a - b);
  const blocker = mit("blocking");
  const blockierte = mit("blocked_by");
  return blocker.length <= blockierte.length
    ? { seite: "blocking", nummern: blocker }
    : { seite: "blocked_by", nummern: blockierte };
}

/** Wie viele offene Issues `start` direkt oder mittelbar entsperrt. */
function entsperrtVon(start, nachfolger) {
  const gesehen = new Set();
  const offen = [...(nachfolger.get(start) ?? [])];
  while (offen.length) {
    const naechstes = offen.pop();
    if (gesehen.has(naechstes) || naechstes === start) continue;
    gesehen.add(naechstes);
    offen.push(...(nachfolger.get(naechstes) ?? []));
  }
  return gesehen.size;
}

/**
 * Die offenen Issues in Abarbeitungsreihenfolge (#939).
 *
 * Jedes Issue landet in genau einem Zustand, in dieser Vorrangfolge:
 *   - `blockiert`: mindestens ein offener Blocker -- gleich, welche Rolle es traegt;
 *   - `wartet_auf_mensch`: eine Rolle des Menschen (auch neben `ready-for-agent`);
 *   - `frei`: `ready-for-agent`, nicht `in-arbeit` -- sortiert nach „entsperrt die meisten";
 *   - sonst nur unter `hygiene` (Rolle fehlt).
 * `hygiene` steht quer dazu: Parent nicht offen, Rolle fehlt, mehrere Rollen.
 *
 * `kanten` = null heisst: die Detail-Aufrufe haben nicht geantwortet. Ein Issue, dessen
 * Zusammenfassung einen offenen Blocker meldet, bleibt dann trotzdem blockiert -- nur der
 * Name des Blockers fehlt (Entscheid #36). Fehlt einem Issue die Zusammenfassung ganz,
 * ist es nicht frei, sondern ein Hygienefall.
 */
export function issueKette({ issues, kanten }) {
  const liste = issues ?? [];
  const offen = new Set(liste.map((posten) => posten.number));
  const blockerVon = new Map();
  const nachfolger = new Map();
  for (const kante of kanten ?? []) {
    if (!offen.has(kante.blocker) || !offen.has(kante.blockiert)) continue;
    const bisher = blockerVon.get(kante.blockiert) ?? new Set();
    bisher.add(kante.blocker);
    blockerVon.set(kante.blockiert, bisher);
    const weiter = nachfolger.get(kante.blocker) ?? new Set();
    weiter.add(kante.blockiert);
    nachfolger.set(kante.blocker, weiter);
  }

  const kette = { frei: [], blockiert: [], wartet_auf_mensch: [], hygiene: [] };
  for (const posten of liste) {
    const labels = posten.labels ?? [];
    const kopf = { nummer: posten.number, titel: posten.title };
    const agent = labels.includes(ROLLE_AGENT);
    const mensch = ROLLEN_MENSCH.filter((rolle) => labels.includes(rolle));

    const gruende = [];
    if (posten.parent && !offen.has(posten.parent)) gruende.push(`Parent #${posten.parent} nicht offen`);
    if (!agent && !mensch.length) gruende.push("Rolle fehlt");
    if (agent && labels.includes("ready-for-human")) gruende.push("mehrere Rollen: ready-for-agent + ready-for-human");
    if (!posten.deps) gruende.push("Abhaengigkeiten unbewertet");
    if (gruende.length) kette.hygiene.push({ ...kopf, grund: gruende });

    const bekannt = [...(blockerVon.get(posten.number) ?? [])].sort((a, b) => a - b);
    const gemeldet = posten.deps?.blocked_by ?? 0;
    if (bekannt.length || gemeldet > 0) {
      const wegen = bekannt.map((nummer) => `#${nummer}`);
      if (gemeldet > bekannt.length) {
        wegen.push(kanten === null || kanten === undefined
          ? "offener Blocker (Detail stumm)"
          : "offener Blocker ausserhalb der offenen Liste");
      }
      kette.blockiert.push({ ...kopf, wegen });
    } else if (mensch.length) {
      kette.wartet_auf_mensch.push({ ...kopf, rolle: mensch });
    } else if (agent && posten.deps && !labels.includes(CLAIM_LABEL)) {
      const entsperrt = Math.max(entsperrtVon(posten.number, nachfolger), posten.deps.blocking ?? 0);
      kette.frei.push({ ...kopf, entsperrt });
    }
  }
  kette.frei.sort((a, b) => (b.entsperrt - a.entsperrt) || (a.nummer - b.nummer));
  for (const schluessel of ["blockiert", "wartet_auf_mensch", "hygiene"]) {
    kette[schluessel].sort((a, b) => a.nummer - b.nummer);
  }
  return kette;
}

/** „N ohne Issue", und wie viele davon nur unbewertet sind, weil die Quelle schwieg. */
function ohneIssueZahl(liste) {
  const unbewertet = liste.filter((eintrag) => eintrag.grund.startsWith("unbewertet")).length;
  return `${liste.length} ohne Issue${unbewertet ? ` (${unbewertet} unbewertet)` : ""}`;
}

/** Die Lage als eine Zeile -- knapp genug fuer den Beginn einer Sitzung. */
export function kurzfassung(lage) {
  const zahlen = [
    `${lage.aktiv.length} aktiv`,
    `${(lage.ohne_raum ?? []).length} ohne Raum`,
    `${lage.frei.length} frei`,
    `${lage.blockiert.length} blockiert`,
    `${lage.verwaist.length} verwaist`,
    `${(lage.archivreif ?? []).length} archivreif`,
    `${(lage.geclaimt ?? []).length} geclaimt`,
    ohneIssueZahl(lage.ohne_issue ?? []),
    `${lage.ideen.length} Ideen`,
  ].join(" · ");
  const kette = lage.issue_kette;
  const issueZahlen = kette
    ? ` · Issues: ${kette.frei.length} frei · ${kette.blockiert.length} blockiert`
      + ` · ${kette.wartet_auf_mensch.length} Mensch · ${kette.hygiene.length} Hygiene`
    : "";
  const zuletzt = lage.zuletzt[0] ? ` · zuletzt ${lage.zuletzt[0].kennung}` : "";
  const stumm = lage.stumm.length ? ` · stumm: ${lage.stumm.join(", ")}` : "";
  return `Lage: ${zahlen}${issueZahlen}${zuletzt}${stumm}`;
}

/**
 * Die Erhebungen der einzelnen Quellen zu einer Lage zusammenfuehren.
 *
 * `lagebild`, `ideen`, `issues` und `branches` duerfen null sein: das ist die Antwort einer
 * Quelle, die nicht geantwortet hat. Sie wird unter `stumm` benannt, und ihr Beitrag bleibt
 * leer. `issues` sind alle offenen Issues (fuer die Verknuepfung); fehlt der Schluessel
 * ganz, gilt die Ideenliste als Issue-Quelle.
 */
export function fuegeZusammen({
  archiv, raeume, lagebild, ideen, issues, kanten, branches, gemergte, laufende,
}) {
  const issueQuelle = issues === undefined ? ideen : issues;
  const stumm = [];
  if (lagebild === null || lagebild === undefined) stumm.push("lagebild");
  if (ideen === null || ideen === undefined) stumm.push("ideen");
  if (issueQuelle === null || issueQuelle === undefined) stumm.push("issues");
  if (branches === null || branches === undefined) stumm.push("branches");
  if (gemergte === null) stumm.push("gemergte");
  if (kanten === null && issueQuelle) stumm.push("abhaengigkeiten");

  const hauptSpitze = raeume.find((raum) => raum.hauptbaum)?.spitze;
  const verwaist = verwaisteRaeume(raeume, gemergte ?? [], laufende, hauptSpitze);
  const istVerwaist = new Set(verwaist.map((eintrag) => eintrag.raum));

  // Jeder Arbeitsraum ist ein Checkout des Hauptzweigs und traegt damit alle
  // Change-Ordner, die dort liegen. Aktiv ist in ihm nur der Change, dem er gehoert
  // (Issue #762: sonst 822 Eintraege unter `aktiv` und keiner unter `ohne_raum`).
  const aktiv = raeume
    .filter((raum) => !raum.hauptbaum && !istVerwaist.has(raum.name))
    .flatMap((raum) => (raum.changes ?? [])
      .filter((change) => gehoertZu(raum, change.kennung))
      .map((change) => ({
        kennung: change.kennung,
        raum: raum.name,
        branch: raum.branch,
        offen: change.offen,
        gesamt: change.gesamt,
      })));

  // Der Hauptbaum traegt alle Changes, die im Repo liegen -- die Arbeitsraeume
  // tragen jeweils ihre eigene Auswahl. Fuer „ohne Arbeitsraum" ist also der
  // Hauptbaum die Grundmenge, nicht die Summe der Raeume.
  const hauptChanges = raeume.find((raum) => raum.hauptbaum)?.changes ?? [];

  const offeneIdeen = (ideen ?? []).map((posten) => ({
    nummer: posten.number,
    titel: posten.title,
    labels: posten.labels ?? [],
  }));

  // Ein Change, den schon jemand genommen hat, gehoert nicht in die Liste, aus der
  // sich die naechste Sitzung bedient -- und sein Issue nicht unter die offenen.
  const geclaimt = claims({
    kennungen: hauptChanges.map((change) => change.kennung),
    branches,
    issues: offeneIdeen,
  });
  const istGeclaimt = new Set(geclaimt.map((eintrag) => eintrag.kennung));

  // Jeder offene Change zaehlt: die des Hauptbaums und die, die bisher nur in einem
  // Arbeitsraum liegen. Traegt eine der Kopien die Zeile im proposal.md, gilt sie.
  const alleChanges = new Map();
  for (const change of [
    ...hauptChanges,
    ...raeume.filter((raum) => !raum.hauptbaum && !istVerwaist.has(raum.name))
      .flatMap((raum) => raum.changes ?? []),
  ]) {
    const bisher = alleChanges.get(change.kennung);
    if (!bisher || (!bisher.issue && change.issue)) {
      alleChanges.set(change.kennung, { kennung: change.kennung, issue: change.issue ?? null });
    }
  }
  const ohneIssueListe = ohneIssue({
    changes: [...alleChanges.values()],
    issues: issueQuelle ?? null,
  });

  // Die Issue-Kette ueber alle offenen Issues; ohne Issue-Quelle gibt es keine.
  const kette = issueQuelle ? issueKette({ issues: issueQuelle, kanten }) : null;

  // Das Issue eines Changes: aus der Herkunftszeile, sonst ueber das Titelpraefix. Ist es
  // blockiert, ist der Change es auch -- gleich, was das Lagebild ueber seine Changes weiss.
  const titelNummer = (kennung) => (issueQuelle ?? [])
    .find((posten) => (posten.title ?? "").startsWith(`${kennung}:`))?.number ?? null;
  const blockiertesIssue = new Map((kette?.blockiert ?? []).map((posten) => [posten.nummer, posten]));
  const issueBlocker = (kennung) => {
    const nummer = alleChanges.get(kennung)?.issue ?? titelNummer(kennung);
    return nummer ? blockiertesIssue.get(nummer) ?? null : null;
  };
  // Das Lagebild fuehrt einen Change je Arbeitsbaum, der ihn traegt -- hier zaehlt er einmal.
  const freiVorher = [...new Set(lagebild?.ready ?? [])];
  const durchIssue = freiVorher
    .map((kennung) => ({ kennung, posten: issueBlocker(kennung) }))
    .filter((eintrag) => eintrag.posten)
    .map(({ kennung, posten }) => ({ kennung, wegen: posten.wegen, issue: posten.nummer }));
  const istDurchIssue = new Set(durchIssue.map((eintrag) => eintrag.kennung));

  // Fertig, aber nicht archiviert: alle Aufgaben erledigt, kein aktiver Arbeitsraum.
  const istAktiv = new Set(aktiv.map((eintrag) => eintrag.kennung));
  const archivreif = hauptChanges
    .filter((change) => change.gesamt > 0 && change.offen === 0 && !istAktiv.has(change.kennung))
    .map((change) => ({ kennung: change.kennung, gesamt: change.gesamt }))
    .sort((a, b) => a.kennung.localeCompare(b.kennung));

  return {
    erhoben: new Date().toISOString(),
    zuletzt: (archiv ?? []).slice(0, RUECKBLICK),
    aktiv,
    ohne_raum: ohneArbeitsraum(hauptChanges, aktiv)
      .filter((change) => !istGeclaimt.has(change.kennung)),
    geclaimt,
    ohne_issue: ohneIssueListe,
    frei: freiVorher.filter((kennung) => !istDurchIssue.has(kennung)),
    blockiert: [
      ...[...new Map((lagebild?.blocked ?? []).map((eintrag) => [eintrag.name, {
        kennung: eintrag.name,
        wegen: eintrag.blocked_by ?? [],
      }])).values()],
      ...durchIssue,
    ],
    verwaist,
    archivreif,
    issue_kette: kette,
    ideen: offeneIdeen
      .filter((posten) => !posten.labels.includes(CLAIM_LABEL))
      .map((posten) => ({ nummer: posten.nummer, titel: posten.titel })),
    stumm,
  };
}

// --- Quellen -----------------------------------------------------------------

/** Ein Aufruf, dessen Scheitern erlaubt ist: er meldet es, statt zu werfen. */
function ruf(befehl, argumente, ordner, frist = 120_000) {
  const lauf = spawnSync(befehl, argumente, { cwd: ordner, encoding: "utf8", timeout: frist });
  return { gut: lauf.status === 0, aus: lauf.stdout ?? "" };
}

/** Wie im justfile: wo `uv` da ist, laeuft python3 darueber -- mit --no-sync, sonst biegt uv den Editable-Install der geteilten .venv auf diesen Worktree um (#812). */
function pythonAufruf() {
  const uv = spawnSync("uv", ["--version"], { encoding: "utf8" });
  return uv.status === 0
    ? { befehl: "uv", vorab: ["run", "--no-sync", "python3"] }
    : { befehl: "python3", vorab: [] };
}

function zeilen(text) {
  return text.split("\n").map((zeile) => zeile.trim()).filter(Boolean);
}

/** Die Arbeitsraeume samt der Changes, die in ihnen liegen. */
function arbeitsraeume(wurzel) {
  const lauf = ruf("git", ["worktree", "list", "--porcelain"], wurzel, 20_000);
  if (!lauf.gut) return [];
  const raeume = [];
  let laufend = null;
  for (const zeile of lauf.aus.split("\n")) {
    if (zeile.startsWith("worktree ")) {
      laufend = { pfad: zeile.slice("worktree ".length).trim(), branch: "", spitze: "" };
      raeume.push(laufend);
    } else if (zeile.startsWith("branch ") && laufend) {
      laufend.branch = zeile.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
    } else if (zeile.startsWith("HEAD ") && laufend) {
      laufend.spitze = zeile.slice("HEAD ".length).trim();
    }
  }
  const haupt = raeume[0]?.pfad;
  return raeume.map((raum) => ({
    name: raum.pfad.split("/").pop(),
    pfad: raum.pfad,
    branch: raum.branch,
    spitze: raum.spitze,
    hauptbaum: raum.pfad === haupt,
    changes: changesIn(raum.pfad),
  }));
}

/** Die offenen Changes eines Baums, mit ihrem Aufgabenstand. */
function changesIn(baum) {
  const ordner = join(baum, "openspec", "changes");
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner, { withFileTypes: true })
    .filter((eintrag) => eintrag.isDirectory() && eintrag.name !== "archive")
    .map((eintrag) => {
      const tasks = join(ordner, eintrag.name, "tasks.md");
      const stand = existsSync(tasks)
        ? aufgaben(readFileSync(tasks, "utf8"))
        : { gesamt: 0, offen: 0 };
      const proposal = join(ordner, eintrag.name, "proposal.md");
      const issue = existsSync(proposal) ? issueNummerAus(readFileSync(proposal, "utf8")) : null;
      return { kennung: eintrag.name, offen: stand.offen, gesamt: stand.gesamt, issue };
    });
}

/** Die Branches, die bereits im Hauptzweig stecken -- oder null, wenn es keinen gibt. */
function gemergteBranches(wurzel) {
  const alle = ruf("git", ["branch", "--format=%(refname:short)"], wurzel, 20_000);
  const zweig = alle.gut ? hauptzweig(zeilen(alle.aus)) : null;
  if (!zweig) return null;
  const lauf = ruf("git", ["branch", "--merged", zweig, "--format=%(refname:short)"],
    wurzel, 20_000);
  return lauf.gut ? zeilen(lauf.aus) : null;
}

/** Die zuletzt archivierten Changes, juengster zuerst. */
function archivierte(wurzel) {
  const ordner = join(wurzel, "openspec", "changes", "archive");
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner, { withFileTypes: true })
    .filter((eintrag) => eintrag.isDirectory())
    .map((eintrag) => eintrag.name)
    .sort()
    .reverse()
    .map((name) => {
      const teile = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      return { name, datum: teile?.[1] ?? "", kennung: teile?.[2] ?? name };
    });
}

/** Das Lagebild -- oder null, wenn es nicht antwortet. */
function lagebildVon(wurzel) {
  const { befehl, vorab } = pythonAufruf();
  const lauf = ruf(befehl, [...vorab, join(REPO, "ops.py"), "--root", wurzel, "--json"], REPO);
  if (!lauf.gut) return null;
  try {
    return JSON.parse(lauf.aus);
  } catch {
    return null;
  }
}

/** Die Branches im Remote -- oder null, wenn es nicht antwortet. */
function remoteBranchesVon(wurzel) {
  const lauf = ruf("git", ["ls-remote", "--heads", "origin"], wurzel, 30_000);
  if (!lauf.gut) return null;
  return zeilen(lauf.aus)
    .map((zeile) => zeile.split("\t")[1] ?? "")
    .map((ref) => ref.replace(/^refs\/heads\//, ""))
    .filter(Boolean);
}

/** Aus `git remote get-url origin` das Paar Eigner/Repo -- oder null. */
function herkunft(wurzel) {
  const lauf = ruf("git", ["remote", "get-url", "origin"], wurzel, 20_000);
  if (!lauf.gut) return null;
  const treffer = lauf.aus.trim().match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/);
  return treffer ? `${treffer[1]}/${treffer[2]}` : null;
}

/**
 * Ein GET auf die REST-API des Repos -- erst ueber `gh api`, sonst direkt per `curl`.
 *
 * Nur REST: im Web-Container ist GraphQL geblockt (Entscheid #139), `gh issue list` laeuft
 * darueber und scheitert dort. `gh api` bringt die Anmeldung mit; `curl` schickt keine mit
 * und traegt nur, wenn das Repo oeffentlich ist oder die Umgebung sie stellt. Antwortet
 * keiner der beiden Wege, ist das Ergebnis null.
 */
function restGet(wurzel, pfad) {
  const lesen = (lauf) => {
    if (!lauf.gut) return null;
    try {
      return JSON.parse(lauf.aus);
    } catch {
      return null;
    }
  };
  const ueberGh = lesen(ruf("gh", ["api", `repos/{owner}/{repo}/${pfad}`], wurzel, 30_000));
  if (ueberGh !== null) return ueberGh;
  const repo = herkunft(wurzel);
  if (!repo) return null;
  return lesen(ruf("curl", ["-sf", "--max-time", "30",
    `https://api.github.com/repos/${repo}/${pfad}`], wurzel, 40_000));
}

/** Die Nummer am Ende einer Issue-URL -- oder null. */
function nummerAusUrl(url) {
  const treffer = (url ?? "").match(/\/issues\/(\d+)$/);
  return treffer ? Number(treffer[1]) : null;
}

/**
 * Alle offenen Issues -- oder null, wenn GitHub auf keinem Weg antwortet.
 *
 * Geholt wird die volle Liste, nicht nur die zwanzig fuer `ideen`: die Verknuepfung
 * Change -> Issue muesste sonst jedes Issue jenseits der zwanzig als fehlend melden. Die
 * Liste traegt je Issue schon die Zusammenfassung der Abhaengigkeiten und den Parent;
 * ein Aufruf je hundert Issues. Pull Requests fallen raus: die API fuehrt sie mit.
 */
function issuesVon(wurzel) {
  const alle = [];
  for (let seite = 1; seite <= ISSUE_GRENZE / 100; seite += 1) {
    const posten = restGet(wurzel, `issues?state=open&per_page=100&page=${seite}`);
    if (!Array.isArray(posten)) return null;
    alle.push(...posten);
    if (posten.length < 100) break;
  }
  return alle
    .filter((posten) => !posten.pull_request)
    .map((posten) => ({
      number: posten.number,
      title: posten.title,
      labels: (posten.labels ?? []).map((label) => label.name ?? label),
      deps: posten.issue_dependencies_summary
        ? {
          blocked_by: posten.issue_dependencies_summary.blocked_by ?? 0,
          blocking: posten.issue_dependencies_summary.blocking ?? 0,
        }
        : null,
      parent: nummerAusUrl(posten.parent_issue_url),
    }));
}

/**
 * Die blocked-by-Kanten zwischen offenen Issues -- oder null, wenn ein Aufruf schweigt.
 *
 * Befragt wird nur die kleinere Seite (`detailPlan`). Ein einziger stummer Aufruf macht
 * die ganze Quelle stumm: eine halbe Kantenliste liesse ein blockiertes Issue frei
 * aussehen, sobald es nicht ueber die Zusammenfassung auffaellt.
 */
function kantenVon(wurzel, issues) {
  if (!issues) return null;
  const plan = detailPlan(issues);
  const kanten = [];
  for (const nummer of plan.nummern) {
    const antwort = restGet(wurzel, `issues/${nummer}/dependencies/${plan.seite}?per_page=100`);
    if (!Array.isArray(antwort)) return null;
    for (const gegenueber of antwort) {
      if (gegenueber.state && gegenueber.state !== "open") continue;
      kanten.push(plan.seite === "blocking"
        ? { blocker: nummer, blockiert: gegenueber.number }
        : { blocker: gegenueber.number, blockiert: nummer });
    }
  }
  return kanten;
}

/** Alle Quellen befragen und zu einer Lage zusammenfuehren. */
export function erhebe(wurzel) {
  const raeume = arbeitsraeume(wurzel);
  const issues = issuesVon(wurzel);
  return fuegeZusammen({
    archiv: archivierte(wurzel),
    raeume,
    lagebild: lagebildVon(wurzel),
    ideen: issues === null ? null : issues.slice(0, IDEEN_GRENZE),
    issues,
    kanten: kantenVon(wurzel, issues),
    branches: remoteBranchesVon(wurzel),
    gemergte: gemergteBranches(wurzel),
    laufende: (raeume.find((raum) => raum.hauptbaum)?.changes ?? [])
      .map((change) => change.kennung),
  });
}

// --- Kommandozeile -----------------------------------------------------------

function haupt(argumente) {
  const stelle = argumente.indexOf("--root");
  const wurzel = stelle >= 0 ? argumente[stelle + 1] : REPO;
  const lage = erhebe(wurzel);
  console.log(argumente.includes("--kurz") ? kurzfassung(lage) : JSON.stringify(lage, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("lage.mjs")) {
  haupt(process.argv.slice(2));
}
