#!/usr/bin/env node
// Belege einliefern: aus einer Datei auf der Platte wird ein Eintrag im Vorgang.
//
// Ein Gate belegt heute mit Text, und Text schreibt sich leicht, auch ueber
// einen Lauf, den es nie gab. Ein Bild oder ein gerendertes Diagramm entsteht
// aus dem tatsaechlichen Zustand: teuer zu faelschen, billig zu pruefen.
//
// Das Modul kennt keine OpenSpec-Begriffe. Es bekommt einen Vorgangsordner und
// arbeitet darin -- damit traegt derselbe Code auch ein GitHub-Issue oder einen
// beads-Vorgang, sobald man ihm einen anderen Wurzelpfad uebergibt.
//
//   node tools/beleg.mjs <vorgangsordner> <vorher|nachher> <pfad>

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { BILDBELEG_WEG, istSichtbar } from "./pruefungen.mjs";

const STUFEN = ["vorher", "nachher"];

// Der Beleg wandert mit dem Change durch den PR und ins Archiv. Was groesser ist,
// gehoert nicht in die Akte -- es wird vermerkt, aber nicht kopiert.
const GROESSENGRENZE = 4 * 1024 * 1024;

// Die ersten Bytes bekannter Bildformate. Bewusst keine Bibliothek: die Frage ist
// nicht, ob die Datei vollstaendig dekodierbar ist, sondern ob jemand statt eines
// Bildes einen Textblock eingeliefert hat.
const SIGNATUREN = [
  { name: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { name: "jpeg", bytes: [0xff, 0xd8, 0xff] },
  { name: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: "webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF-Container, WEBP ab Byte 8
];

const GRAPH_ENDUNGEN = [".dot", ".svg"];

export class UnbekannteStufe extends Error {
  constructor(stufe) {
    super(`Unbekannte Stufe '${stufe}'. Erlaubt: ${STUFEN.join(", ")}.`);
    this.name = "UnbekannteStufe";
  }
}

// --- Ablageorte -------------------------------------------------------------

const belegOrdner = (vorgang) => join(vorgang, "belege");
const journalPfad = (vorgang) => join(belegOrdner(vorgang), "belege.jsonl");

/**
 * Bilder liegen getrennt von allem anderen, weil eine spaetere Web-Ansicht
 * `belege/assets/` als Bytes ausliefert. Was dort nicht hineingehoert, liegt von
 * vornherein woanders -- die Trennung haengt so an keiner Filterregel, die
 * jemand aendern kann.
 */
function zielordner(art) {
  return art === "bild" ? join("belege", "assets") : join("belege", "artefacts");
}

// --- Urteil ueber die Quelldatei --------------------------------------------

/** Passen die ersten Bytes zu einem anerkannten Bildformat? */
function istBild(pfad) {
  let kopf;
  try {
    const inhalt = readFileSync(pfad);
    kopf = inhalt.subarray(0, 12);
  } catch {
    return false;
  }
  return SIGNATUREN.some((s) => s.bytes.every((b, i) => kopf[i] === b));
}

/**
 * Prueft die Quelldatei einmal und gibt das Urteil zurueck. Jede spaetere Frage
 * liest nur noch das gespeicherte Merkmal, nie wieder die Platte.
 */
function begutachten(quellpfad) {
  if (!existsSync(quellpfad)) {
    return { fehlt: true, grund: `Quelldatei nicht gefunden: ${quellpfad}` };
  }
  const daten = statSync(quellpfad);
  if (!daten.isFile()) {
    return { fehlt: true, grund: `Quelle ist keine regulaere Datei: ${quellpfad}` };
  }
  if (daten.size === 0) {
    return { fehlt: true, grund: `Quelldatei ist leer: ${quellpfad}` };
  }
  if (daten.size > GROESSENGRENZE) {
    const mib = (daten.size / 1024 / 1024).toFixed(1);
    return { fehlt: true, grund: `Quelldatei ist mit ${mib} MiB groesser als die Grenze von ${GROESSENGRENZE / 1024 / 1024} MiB` };
  }

  const endung = quellpfad.slice(quellpfad.lastIndexOf(".")).toLowerCase();
  if (GRAPH_ENDUNGEN.includes(endung)) return { fehlt: false, art: "graph" };
  if (istBild(quellpfad)) return { fehlt: false, art: "bild" };
  return { fehlt: false, art: "ausgabe" };
}

// --- Herkunft eines Bildes ----------------------------------------------------

/**
 * Stammt ein PNG aus der Prozessschmiede? (Change 02-bildbeleg-sichtbar, #909)
 *
 * Die Prozessschmiede schreibt `prozess.png` neben `prozess.yaml` und fuer einen
 * Teilprozess `X.prozess.png` neben `X.prozess.yaml`. Genau dieser Nachbar ist das
 * Merkmal: ein Bild mit Beschreibung ist nachbaubar, ein Screenshot nicht. Ist das
 * PNG aelter als die Beschreibung, wurde es vor deren letzter Aenderung gebaut und
 * zeigt nicht, was sie sagt.
 *
 * @returns {{quelle: string, beschreibung: string|null, grund: string}}
 */
export function herkunft(quellpfad) {
  const name = basename(quellpfad);
  if (!name.toLowerCase().endsWith(".png")) return { quelle: "", beschreibung: null, grund: "" };
  const stamm = name.slice(0, -4);
  if (stamm !== "prozess" && !stamm.endsWith(".prozess")) return { quelle: "", beschreibung: null, grund: "" };

  const beschreibung = join(dirname(quellpfad), `${stamm}.yaml`);
  if (!existsSync(beschreibung)) {
    return { quelle: "", beschreibung: null, grund: `keine Beschreibung ${stamm}.yaml neben ${name}` };
  }
  if (statSync(quellpfad).mtimeMs < statSync(beschreibung).mtimeMs) {
    return {
      quelle: "",
      beschreibung: null,
      grund: `${name} ist aelter als ${stamm}.yaml -- nach der letzten Aenderung neu bauen (prozess.py bauen)`,
    };
  }
  return { quelle: "prozessschmiede", beschreibung, grund: "" };
}

// --- Journal ----------------------------------------------------------------

/** Alle Belegzeilen eines Vorgangs. Kaputte Zeilen werden uebergangen, nicht geworfen. */
export function liesJournal(vorgang) {
  const pfad = journalPfad(vorgang);
  if (!existsSync(pfad)) return [];
  const zeilen = [];
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    if (!zeile.trim()) continue;
    try {
      zeilen.push(JSON.parse(zeile));
    } catch {
      continue; // append-only: die letzte Zeile kann abgeschnitten sein
    }
  }
  return zeilen;
}

/**
 * Liefert einen Beleg ein: prueft, kopiert und haengt eine Zeile an das Journal.
 *
 * @param {string} vorgang    Ordner des Vorgangs; es wird ausschliesslich unter
 *                            `belege/` darin geschrieben
 * @param {string} stufe      `vorher` oder `nachher`
 * @param {string} quellpfad  Datei auf der Platte
 * @returns {object} die geschriebene Journalzeile
 * @throws {UnbekannteStufe} bei jeder anderen Stufe; das Journal bleibt dann unberuehrt
 */
export function einliefern(vorgang, stufe, quellpfad) {
  if (!STUFEN.includes(stufe)) throw new UnbekannteStufe(stufe);

  const urteil = begutachten(quellpfad);
  const nummer = liesJournal(vorgang).length;

  let pfad = "";
  let herkunftUrteil = { quelle: "", beschreibung: null, grund: "" };
  let beschreibung = "";
  if (!urteil.fehlt) {
    const ordner = zielordner(urteil.art);
    mkdirSync(join(vorgang, ordner), { recursive: true });
    pfad = join(ordner, `${nummer}-${basename(quellpfad)}`);
    copyFileSync(quellpfad, join(vorgang, pfad));

    if (urteil.art === "bild") herkunftUrteil = herkunft(quellpfad);
    if (herkunftUrteil.beschreibung) {
      const artefakte = zielordner("ausgabe");
      mkdirSync(join(vorgang, artefakte), { recursive: true });
      beschreibung = join(artefakte, `${nummer}-${basename(herkunftUrteil.beschreibung)}`);
      copyFileSync(herkunftUrteil.beschreibung, join(vorgang, beschreibung));
    }
  }

  const zeile = {
    zeit: new Date().toISOString(),
    stufe,
    art: urteil.art ?? "unbekannt",
    pfad,
    fehlt: urteil.fehlt,
    grund: urteil.grund ?? herkunftUrteil.grund,
    quelle: herkunftUrteil.quelle,
  };
  if (beschreibung) zeile.beschreibung = beschreibung;

  mkdirSync(belegOrdner(vorgang), { recursive: true });
  appendFileSync(journalPfad(vorgang), `${JSON.stringify(zeile)}\n`, "utf8");
  return zeile;
}

// --- Einstieg ---------------------------------------------------------------

// Nur wenn die Datei selbst aufgerufen wurde -- beim Import aus gate.mjs oder
// aus einem Test darf der Einstieg nicht laufen.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [vorgang, stufe, quellpfad] = process.argv.slice(2);

  if (!vorgang || !stufe || !quellpfad) {
    console.error("Aufruf: node tools/beleg.mjs <vorgangsordner> <vorher|nachher> <pfad>");
    console.error("Beispiel: node tools/beleg.mjs openspec/changes/beleg-bild nachher docs/beleg-pfad.svg");
    process.exit(2);
  }

  try {
    const zeile = einliefern(vorgang, stufe, quellpfad);
    if (zeile.fehlt) {
      console.error(`Beleg vermerkt, aber nicht abgelegt: ${zeile.grund}`);
      process.exit(1);
    }
    const herkunftText = zeile.quelle ? `, ${zeile.quelle}` : "";
    console.log(`Beleg ${zeile.stufe} (${zeile.art}${herkunftText}) abgelegt: ${zeile.pfad}`);
    if (zeile.beschreibung) console.log(`Beschreibung abgelegt: ${zeile.beschreibung}`);
    if (zeile.stufe === "nachher" && !istSichtbar(zeile)) console.log(`Hinweis: dieser Beleg traegt den Abschluss nicht. ${BILDBELEG_WEG}`);
    if (zeile.grund) console.log(`Grund: ${zeile.grund}`);
  } catch (fehler) {
    console.error(fehler.message);
    process.exit(2);
  }
}
