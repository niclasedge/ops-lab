#!/usr/bin/env node
// Ein Messlauf von Hand: vorbereiten, auswerten, vergleichen.
//
// Gemessen wird nicht hier, sondern nebenan im Zielrepo -- ein Agent bekommt
// dort einen woertlichen Auftrag und arbeitet ihn durch den Ablauf. Dieses
// Werkzeug stellt sicher, dass beide Laeufe unter denselben Bedingungen
// starten, und liest hinterher aus, was der Lauf gekostet und erreicht hat.
//
//   node tools/messlauf.mjs starte <kennung> [--ziel=..] [--basis=main] [--adapter=claude]
//   node tools/messlauf.mjs messe  <kennung> [--ziel=..] [--basis=main] [--sitzung=<id>]
//   node tools/messlauf.mjs vergleiche <messung-a.json> <messung-b.json>
//
// Warum der Mensch den Agenten startet und nicht dieses Werkzeug: ein Start aus
// dem Skript heraus braucht einen kopflosen Modus, und der ist nicht derselbe
// Ablauf, der im Alltag gemessen werden soll. Gemessen wird, was tatsaechlich
// benutzt wird -- der Preis dafuer ist ein Handgriff je Lauf.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

import { liesJournal } from "./beleg.mjs";
import { bewerte, zugesagteDateien } from "./erfuellung.mjs";
import { auftragstext, dauer, kosten, startkontext, summiere, vergleiche, zaehleAufrufe } from "./messung.mjs";
import { mitschriftenOrdner, vorgangsOrte } from "./pfade.mjs";

const ZIEL_VORGABE = "../ops-lab-test";
const ABLAGE = join("docs", "messungen");
const PREISE = join("tools", "preise.json");

// Wortgleich mit TESTBEFEHL in gate.mjs. Weicht er ab, faellt das Kriterium
// 'tests' hier durch, waehrend der Abschluss im Zielrepo gruen ist -- und die
// Messung wuerfe dem Ablauf einen Fehler vor, den er nicht gemacht hat.
const TESTBEFEHL = ["--test", "--test-reporter=tap", "tests/*.test.mjs"];

/**
 * Was ein Harness von einem anderen unterscheidet: wie er gestartet wird und wo
 * er seine Mitschrift ablegt. Mehr braucht die Messung nicht zu wissen -- damit
 * bleibt ein zweiter Harness ein Eintrag in dieser Tabelle und keine zweite
 * Fassung des Werkzeugs.
 */
const ADAPTER = {
  claude: {
    start: (ziel) => `cd ${ziel} && claude`,
    // Mehrere Ordner, nicht einer: der Ablauf schreibt vor, dass ein Change in
    // seinem Arbeitsraum laeuft, und Claude Code legt die Mitschrift je
    // Arbeitsverzeichnis ab. Wer nur den Hauptordner abfragt, misst genau den
    // Lauf nicht, der dem Ablauf folgt.
    mitschriften: (ziel) =>
      mitschriftenOrdner(ziel, process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), arbeitsraeume(ziel), existsSync),
  },
  pi: {
    start: (ziel) => `cd ${ziel} && pi`,
    // Wo Pi seine Mitschriften ablegt, ist hier noch nicht belegt. Geraten
    // waere schlimmer als leer: ein falscher Pfad liefert stillschweigend die
    // Mitschrift eines anderen Laufs. Bis das feststeht: --mitschriften=<ordner>.
    mitschriften: () => [],
  },
};

/** Die Kennungen der Arbeitsraeume eines Repos. Keine ist der Normalfall. */
function arbeitsraeume(repo) {
  const sammel = join(repo, ".claude", "worktrees");
  if (!existsSync(sammel)) return [];
  return readdirSync(sammel, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

// --- Schale -----------------------------------------------------------------

function lauf(befehl, argumente, verzeichnis) {
  const e = spawnSync(befehl, argumente, { cwd: verzeichnis, encoding: "utf8" });
  return { code: e.status ?? 1, aus: `${e.stdout ?? ""}${e.stderr ?? ""}` };
}

const git = (verzeichnis, ...argumente) => lauf("git", argumente, verzeichnis);

function abbruch(...zeilen) {
  for (const z of zeilen) console.error(z);
  process.exit(2);
}

// --- Vorbereiten ------------------------------------------------------------

/**
 * Zwei Laeufe sind nur vergleichbar, wenn sie vom selben Stand ausgehen. Diese
 * Funktion stellt ihn her -- und verweigert, sobald dabei etwas verlorenginge.
 */
function bereite(ziel, basis, verwerfen) {
  if (!existsSync(join(ziel, ".git"))) abbruch(`Kein git-Repo: ${ziel}`);

  const offen = git(ziel, "status", "--porcelain").aus.trim();
  if (offen) {
    abbruch(
      `Das Zielrepo ist nicht sauber: ${ziel}`,
      offen.split("\n").slice(0, 10).map((z) => `  ${z}`).join("\n"),
      "Ein Lauf auf einem unsauberen Stand misst den Stand mit, nicht den Ablauf.",
    );
  }

  const voraus = git(ziel, "log", "--oneline", `${basis}..HEAD`).aus.trim();
  if (voraus && !verwerfen) {
    abbruch(
      `HEAD liegt vor ${basis}; ein Zuruecksetzen wuerde diese Commits verwerfen:`,
      voraus.split("\n").map((z) => `  ${z}`).join("\n"),
      "Wenn das gewollt ist: erneut mit --verwerfen aufrufen. Es wurde nichts geaendert.",
    );
  }

  const zurueck = git(ziel, "reset", "--hard", basis);
  if (zurueck.code !== 0) abbruch(`Zuruecksetzen auf ${basis} schlug fehl:`, zurueck.aus.trim());

  return git(ziel, "rev-parse", "HEAD").aus.trim();
}

function starte(kennung, o) {
  const auftragPfad = join(ABLAGE, `auftrag-${kennung}.md`);
  if (!existsSync(auftragPfad)) abbruch(`Kein Auftrag zu '${kennung}': ${auftragPfad} fehlt.`);

  const auftrag = auftragstext(readFileSync(auftragPfad, "utf8"));
  if (!auftrag) {
    abbruch(
      `${auftragPfad} trennt das Messstueck nicht ab.`,
      "Erwartet werden die Zeilen '## Der Auftrag ab hier' und '## Der Auftrag bis hier'.",
    );
  }

  const adapter = ADAPTER[o.adapter];
  if (!adapter) abbruch(`Unbekannter Adapter '${o.adapter}'. Bekannt: ${Object.keys(ADAPTER).join(", ")}.`);

  const stand = bereite(o.ziel, o.basis, o.verwerfen);
  const pruefwert = createHash("sha256").update(auftrag).digest("hex").slice(0, 12);

  console.log(`\nMesslauf '${kennung}' — Adapter ${o.adapter}\n`);
  console.log(`  Zielrepo   ${o.ziel}`);
  console.log(`  Stand      ${stand.slice(0, 8)} (zurueckgesetzt auf ${o.basis})`);
  console.log(`  Auftrag    ${auftragPfad}, Pruefwert ${pruefwert}`);
  console.log(`\n  Starten:   ${adapter.start(o.ziel)}`);
  console.log(`  Danach:    node tools/messlauf.mjs messe ${kennung} --adapter=${o.adapter}\n`);
  console.log("--- Auftrag woertlich ab hier ---\n");
  console.log(auftrag);
  console.log("\n--- Auftrag bis hier ---\n");
}

// --- Auswerten --------------------------------------------------------------

/** Die juengste Mitschrift des Zielrepos, oder die benannte. */
function mitschrift(ordner, id) {
  if (!ordner?.length) {
    abbruch(
      "Zu diesem Zielrepo gibt es keinen Mitschriftenordner -- weder zum Hauptordner noch zu einem Arbeitsraum.",
      "Wurde die Sitzung im Zielrepo gefuehrt? Sonst mit --mitschriften=ORDNER angeben.",
    );
  }

  const dateien = [];
  for (const o of ordner) {
    for (const d of readdirSync(o)) {
      if (!d.endsWith(".jsonl")) continue;
      const pfad = join(o, d);
      dateien.push({ pfad, id: basename(d, ".jsonl"), zeit: statSync(pfad).mtimeMs });
    }
  }
  dateien.sort((a, b) => b.zeit - a.zeit);

  if (!dateien.length) {
    abbruch(`Keine Mitschrift in:\n  ${ordner.join("\n  ")}`, "Wurde die Sitzung im Zielrepo gefuehrt?");
  }

  const treffer = id ? dateien.find((d) => d.id.startsWith(id)) : dateien[0];
  if (!treffer) abbruch(`Keine Sitzung beginnt mit '${id}'.`);
  return treffer;
}

/**
 * Eine Mitschrift als Saetze.
 *
 * Eine leere Liste waere die gefaehrlichste Antwort: sie ergaebe eine Messung
 * ueber null Token, und null ist der beste Wert, den es gibt. Darum bricht das
 * Lesen ab, statt eine Nullmessung abzulegen.
 */
function saetze(pfad) {
  const gelesen = [];
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    if (!zeile.trim()) continue;
    try {
      gelesen.push(JSON.parse(zeile));
    } catch {
      continue; // abgeschnittene letzte Zeile einer laufenden Sitzung
    }
  }
  if (!gelesen.length) abbruch(`Die Mitschrift ${pfad} enthaelt keinen lesbaren Satz.`);
  return gelesen;
}

/**
 * Wo der Vorgang liegt und von wo aus Diff und Testlauf laufen.
 *
 * Erst der Arbeitsraum der Kennung, dann der Hauptordner, dann das Archiv. Der
 * Ablauf schreibt vor, dass im Arbeitsraum gearbeitet wird -- wer nur den
 * Hauptordner liest, findet dort weder Nachweise noch Belege und bewertet einen
 * vollstaendigen Lauf mit "gates fehlt". So geschehen bei 89401f6c und 40d36a23.
 */
function vorgangOrt(ziel, kennung) {
  const orte = vorgangsOrte(ziel, kennung);
  const offen = orte.find((o) => existsSync(o.vorgang));
  if (offen) return offen;

  const haupt = orte.at(-1);
  const archiv = join(ziel, "openspec", "changes", "archive");
  if (!existsSync(archiv)) return haupt;
  const abgelegt = readdirSync(archiv).find((d) => d.endsWith(`-${kennung}`));
  return abgelegt ? { wurzel: ziel, vorgang: join(archiv, abgelegt) } : haupt;
}

const liesOder = (pfad, ersatz = "") => (existsSync(pfad) ? readFileSync(pfad, "utf8") : ersatz);

/**
 * Die Lage im Zielrepo einsammeln, damit erfuellung.mjs urteilen kann.
 *
 * Alles Befragen steht hier, alles Urteilen dort. Ohne die Trennung liesse sich
 * der Erfuellungsgrad nur pruefen, indem man ein ganzes Repo herstellt.
 */
function lage(ziel, kennung, basis, testbefehl) {
  const { wurzel, vorgang } = vorgangOrt(ziel, kennung);
  const test = lauf(process.execPath, testbefehl, wurzel);

  const pr = lauf("gh", ["pr", "list", "--state", "all", "--head", `change/${kennung}`, "--json", "number,state,mergedAt"], ziel);
  let prs = [];
  try {
    prs = JSON.parse(pr.aus.trim() || "[]");
  } catch {
    prs = []; // kein gh, kein Netz, kein Remote -- dann gilt: nicht belegt
  }

  const geaendert = git(wurzel, "diff", "--name-only", `${basis}...HEAD`).aus.trim();

  return {
    gate1: existsSync(join(vorgang, "gate1.md")),
    gate2: existsSync(join(vorgang, "gate2.md")),
    fertig: existsSync(join(vorgang, "fertig.md")),
    belege: existsSync(vorgang) ? liesJournal(vorgang) : [],
    tasksText: liesOder(join(vorgang, "tasks.md")),
    zugesagt: zugesagteDateien(liesOder(join(vorgang, "proposal.md"))),
    geaendert: geaendert ? geaendert.split("\n") : [],
    testsGruen: test.code === 0,
    prGestellt: prs.length > 0,
    gemergt: prs.some((p) => p.mergedAt),
    _vorgang: vorgang,
    _wurzel: wurzel,
  };
}

function messe(kennung, o) {
  const adapter = ADAPTER[o.adapter];
  if (!adapter) abbruch(`Unbekannter Adapter '${o.adapter}'. Bekannt: ${Object.keys(ADAPTER).join(", ")}.`);

  const quelle = mitschrift(o.mitschriften ? [o.mitschriften] : adapter.mitschriften(o.ziel), o.sitzung);
  const gelesen = saetze(quelle.pfad);

  const aufwand = summiere(gelesen);
  const aufrufe = zaehleAufrufe(gelesen);
  const preise = JSON.parse(readFileSync(PREISE, "utf8")).modelle;
  const k = kosten(aufwand.jeModell, preise);

  const stand = lage(o.ziel, kennung, o.basis, o.test);
  const grad = bewerte(stand);

  const messung = {
    kennung,
    adapter: o.adapter,
    zeitpunkt: new Date().toISOString(),
    sitzung: quelle.id,
    ziel: { repo: o.ziel, basis: o.basis, stand: git(o.ziel, "rev-parse", "HEAD").aus.trim() },
    werkzeugstand: git(process.cwd(), "rev-parse", "HEAD").aus.trim(),
    token: {
      ein: aufwand.ein,
      aus: aufwand.aus,
      cacheLesen: aufwand.cacheLesen,
      cacheSchreiben: aufwand.cacheSchreiben,
    },
    gesamt: aufwand.ein + aufwand.aus + aufwand.cacheLesen + aufwand.cacheSchreiben,
    nachrichten: aufwand.nachrichten,
    // Zwei Groessen, nicht eine: die Spanne sagt, wie lange der Lauf im Kalender
    // stand, die aktive Zeit, wie lange daran gearbeitet wurde. Fehlen die
    // Zeitstempel, bleibt die Dauer unbekannt -- null saehe aus wie kein Aufwand.
    dauer: dauer(gelesen),
    startkontext: startkontext(gelesen),
    befehle: aufrufe.werkzeug,
    schalenbefehle: aufrufe.schale,
    kosten: { euro: Number(k.euro.toFixed(4)), vollstaendig: k.vollstaendig, unbekannt: k.unbekannt },
    erfuellung: {
      erfuellt: grad.kriterien.filter((x) => x.erfuellt).map((x) => x.id),
      offen: grad.kriterien.filter((x) => !x.erfuellt).map((x) => ({ id: x.id, meldung: x.meldung })),
      stand: `${grad.erfuellt}/${grad.gesamt}`,
    },
    // vergleiche() erwartet die erfuellten Kriterien flach -- hier einmal
    // gespiegelt, damit eine abgelegte Messung ohne Umbau vergleichbar ist.
    erfuellt: grad.kriterien.filter((x) => x.erfuellt).map((x) => x.id),
  };

  mkdirSync(ABLAGE, { recursive: true });
  const ziel = join(ABLAGE, `${messung.zeitpunkt.slice(0, 10)}-${kennung}-${o.adapter}-${quelle.id.slice(0, 8)}.json`);
  writeFileSync(ziel, `${JSON.stringify(messung, null, 2)}\n`, "utf8");

  const zahl = (n) => n.toLocaleString("de-DE");
  console.log(`\nMessung '${kennung}' — Adapter ${o.adapter}, Sitzung ${quelle.id.slice(0, 8)}\n`);
  console.log(`  Token        ${zahl(messung.gesamt)} in ${messung.nachrichten} Nachrichten`);
  console.log(`  davon Cache  ${zahl(messung.token.cacheLesen + messung.token.cacheSchreiben)}`);
  const min = (sekunden) => `${Math.round(sekunden / 60)} min`;
  console.log(
    `  Dauer        ${messung.dauer === null ? "unbekannt — die Mitschrift traegt keine zwei Zeitstempel" : `${min(messung.dauer.spanne)} Spanne, davon ${min(messung.dauer.aktiv)} aktiv`}`,
  );
  console.log(`  Startkontext ${messung.startkontext === null ? "unbekannt" : zahl(messung.startkontext)}`);
  console.log(`  Befehle      ${messung.befehle}, davon Schale ${messung.schalenbefehle}`);
  console.log(`  Kosten       ${messung.kosten.euro.toFixed(2)} EUR${k.vollstaendig ? "" : ` (ohne ${k.unbekannt.join(", ")} — kein Preis hinterlegt)`}`);
  console.log(`  Erfuellung   ${messung.erfuellung.stand}  (gelesen in ${stand._wurzel})`);
  for (const x of messung.erfuellung.offen) console.log(`               offen: ${x.id}${x.meldung ? ` — ${x.meldung}` : ""}`);
  console.log(`\n  Abgelegt: ${ziel}\n`);
}

// --- Vergleichen ------------------------------------------------------------

function stelleGegenueber(a, b) {
  for (const p of [a, b]) if (!existsSync(p)) abbruch(`Keine Messung: ${p}`);
  const vorher = JSON.parse(readFileSync(a, "utf8"));
  const nachher = JSON.parse(readFileSync(b, "utf8"));
  const v = vergleiche(vorher, nachher);

  const zahl = (n) => (n ?? 0).toLocaleString("de-DE");
  const delta = (d) => (d > 0 ? `+${zahl(d)}` : zahl(d));
  const prozent = (x) => `${(x * 100).toFixed(1)} %`;

  console.log(`\n${basename(a)}  →  ${basename(b)}\n`);
  console.log(`  Token         ${zahl(v.token.vorher)}  →  ${zahl(v.token.nachher)}   (${delta(v.token.differenz)})`);
  console.log(`  Befehle       ${zahl(v.befehle.vorher)}  →  ${zahl(v.befehle.nachher)}   (${delta(v.befehle.differenz)})`);
  console.log(`  Startkontext  ${zahl(v.startkontext.vorher)}  →  ${zahl(v.startkontext.nachher)}   (${prozent(v.startkontext.abweichung)} Abweichung)`);
  console.log(`\n  Erfuellung    ${vorher.erfuellung?.stand ?? "?"}  →  ${nachher.erfuellung?.stand ?? "?"}`);
  if (v.verloren.length) console.log(`  verloren:     ${v.verloren.join(", ")}`);

  if (!v.belastbar) {
    console.log("\n  Nicht belastbar: der Startkontext weicht um mehr als zehn Prozent ab.");
    console.log("  Verglichen wuerden zwei Umgebungen, nicht zwei Fassungen des Ablaufs.\n");
    process.exit(1);
  }
  console.log(`\n  ${v.verbesserung ? "Verbesserung: weniger Aufwand bei gleichem Erfuellungsgrad." : "Keine Verbesserung."}\n`);
}

// --- Einstieg ---------------------------------------------------------------

const argumente = process.argv.slice(2);
const [befehl, ...rest] = argumente;
const wert = (name, vorgabe) => {
  const treffer = rest.find((a) => a.startsWith(`--${name}=`));
  return treffer ? treffer.slice(name.length + 3) : vorgabe;
};

const zielPfad = wert("ziel", ZIEL_VORGABE);
const o = {
  ziel: isAbsolute(zielPfad) ? zielPfad : resolve(process.cwd(), zielPfad),
  basis: wert("basis", "main"),
  adapter: wert("adapter", "claude"),
  sitzung: wert("sitzung", null),
  mitschriften: wert("mitschriften", null),
  test: wert("test", null)?.split(" ") ?? TESTBEFEHL,
  verwerfen: rest.includes("--verwerfen"),
};

const kennung = rest.find((a) => !a.startsWith("--"));

if (befehl === "starte") {
  if (!kennung) abbruch("Aufruf: node tools/messlauf.mjs starte <kennung> [--ziel=..] [--basis=main]");
  starte(kennung, o);
} else if (befehl === "messe") {
  if (!kennung) abbruch("Aufruf: node tools/messlauf.mjs messe <kennung> [--adapter=claude] [--sitzung=<id>]");
  messe(kennung, o);
} else if (befehl === "vergleiche") {
  const [a, b] = rest.filter((x) => !x.startsWith("--"));
  if (!a || !b) abbruch("Aufruf: node tools/messlauf.mjs vergleiche <messung-a.json> <messung-b.json>");
  stelleGegenueber(a, b);
} else {
  abbruch(
    "Aufruf: node tools/messlauf.mjs <starte|messe|vergleiche> ...",
    "  starte <kennung>      Zielrepo zuruecksetzen und den Auftrag ausgeben",
    "  messe <kennung>       Mitschrift auswerten und die Messung ablegen",
    "  vergleiche <a> <b>    zwei abgelegte Messungen gegenueberstellen",
  );
}
