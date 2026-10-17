#!/usr/bin/env node
// Der sichtbare Beleg wird gerechnet, nicht getippt.
//
// Warum es dieses Werkzeug gibt: der Abschluss fordert einen Beleg der Stufe
// `nachher`, der ein Bild oder ein Graph-Artefakt ist. Wer ihn von Hand
// schreibt, schreibt eine zweite Rechnung neben die erste -- und was ein Bild
// zeigt, das niemand gerechnet hat, belegt nichts. Wer ihn sich im Change
// selbst programmiert, legt dafuer ein Skript ausserhalb von `tools/` an; genau
// daran blieb der Lauf 70839ac5 stehen, weil der Torwaechter nur
// `node tools/*.mjs` durchlaesst.
//
// Die Arbeitsteilung ist deshalb: dieses Werkzeug kennt das Zeichnen, der
// Change kennt die Funktion. Der Aufrufer nennt Modul und Funktionsnamen, das
// Werkzeug ruft die Funktion auf und zeichnet, was zurueckkommt. Jede Zahl im
// Bild ist ein echter Aufruf.
//
//   node tools/belegbild.mjs <ziel.svg> --modul=src/x.mjs --funktion=y \
//     --von=0 --bis=10 [--schritte=200] [--argument=10000] [--fall=2500] \
//     [--titel=..] [--unter=..] [--x-titel=..] [--y-titel=..] [--y-von=..] [--y-bis=..]
//
// Eingeliefert wird das Bild danach wie jeder andere Beleg:
//   node tools/beleg.mjs openspec/changes/<id> nachher <ziel.svg>

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Die Zeichenflaeche. Feste Masse: ein Beleg braucht keine Auswahl. */
export const BLATT = { breite: 820, hoehe: 470, links: 80, oben: 70, rechts: 470, unten: 330 };

/** Spalte rechts neben der Kurve, in der die einzelnen Faelle stehen. */
const SPALTE = { links: 500, rechts: 790 };

// --- Reine Rechnung ---------------------------------------------------------

/**
 * Die Funktion, wie die Kurve sie sieht: die festen Argumente zuerst, der
 * Kurvenwert zuletzt.
 *
 * Damit traegt derselbe Aufruf beide Faelle des Repos -- `f(x)` fuer eine
 * Funktion mit einem Argument und `f(10000, x)` fuer eine mit zwei.
 */
export function aufrufer(f, feste = []) {
  return (x) => f(...feste, x);
}

/** Punkte der Kurve: die Werte holt jeder Punkt aus der Funktion selbst. */
export function proben(f, { von, bis, schritte = 200 }) {
  const zahl = Math.max(1, Math.trunc(schritte));
  const werte = [];
  for (let i = 0; i <= zahl; i += 1) {
    const x = von + ((bis - von) * i) / zahl;
    const y = f(x);
    werte.push({ x, y: Number.isFinite(y) ? y : null });
  }
  return { von, bis, schritte: zahl, werte };
}

/**
 * Die Spanne einer Achse.
 *
 * Sie kommt aus den endlichen Werten, nicht aus einer Vorgabe des Aufrufers --
 * eine Achse, die nicht zur Kurve passt, schneidet sie ab oder laesst sie in
 * einer Ecke kleben. Was der Aufrufer vorgibt, gilt trotzdem: eine Grenze wie
 * `--y-bis` ist die einzige Moeglichkeit, einen Ausreisser aus dem Bild zu
 * halten. Eine flache Spanne wird geweitet, weil eine Achse ohne Ausdehnung
 * keine ist.
 */
export function spanne(werte, vorgabe = null) {
  const endlich = werte.filter(Number.isFinite);
  const ausWerten = endlich.length ? { von: Math.min(...endlich), bis: Math.max(...endlich) } : { von: 0, bis: 1 };

  const von = Number.isFinite(vorgabe?.von) ? vorgabe.von : ausWerten.von;
  const bis = Number.isFinite(vorgabe?.bis) ? vorgabe.bis : ausWerten.bis;

  if (von === bis) return { von: von - 1, bis: bis + 1 };
  return von < bis ? { von, bis } : { von: bis, bis: von };
}

/**
 * Die Schrittweite der Achsenbeschriftung, auf 1, 2 oder 5 mal eine
 * Zehnerpotenz gerundet.
 *
 * Unrunde Schritte erzeugen Beschriftungen wie 3,333 und 6,667 -- sie sagen
 * ueber die Kurve weniger als vier lesbare Marken.
 */
export function schrittweite(von, bis, ziel = 6) {
  const roh = Math.abs(bis - von) / Math.max(1, ziel);
  if (!Number.isFinite(roh) || roh <= 0) return 1;
  const zehner = 10 ** Math.floor(Math.log10(roh));
  for (const vielfaches of [1, 2, 5, 10]) {
    if (vielfaches * zehner >= roh) return vielfaches * zehner;
  }
  return 10 * zehner;
}

/** Die beschrifteten Stellen einer Achse: Vielfache der Schrittweite. */
export function marken(spanne, schritt) {
  if (!Number.isFinite(schritt) || schritt <= 0) return [];
  const treffer = [];
  let i = Math.ceil(spanne.von / schritt);
  while (i * schritt <= spanne.bis + schritt * 1e-9 && treffer.length < 40) {
    treffer.push(Number((i * schritt).toPrecision(12)));
    i += 1;
  }
  return treffer;
}

/**
 * Eine Zahl so, wie der Beleg sie ausweisen soll.
 *
 * Nicht gerundet, sondern abgeschnitten: aus 3.3333333333 wird 3.333333. Eine
 * gerundete Zahl im Beleg waere eine zweite Aussage neben der Rechnung.
 * `Infinity` ist ein Ergebnis und wird als solches genannt -- `null` dagegen ist
 * eine Luecke und bekommt kein Zeichen, das wie eine Zahl aussieht.
 */
export function zahlText(wert) {
  if (wert === null || wert === undefined || Number.isNaN(wert)) return "—";
  if (!Number.isFinite(wert)) return wert > 0 ? "Infinity" : "-Infinity";
  if (Number.isInteger(wert)) return String(wert);
  return String(Number(wert.toFixed(6)));
}

/**
 * Die einzelnen Faelle neben der Kurve.
 *
 * Jeder Fall ist ein echter Aufruf. Ein Fehler wird festgehalten, nicht
 * geworfen: ein Fall, der einen Fehler wirft, ist ein Ergebnis des Auftrags --
 * die negative Investition gehoert ins Bild, nicht in den Abbruch.
 */
export function faelleRechnen(f, xs, feste = []) {
  return xs.map((x) => {
    try {
      return { x, wert: f(...feste, x) };
    } catch (fehler) {
      return { x, wert: null, fehler: fehler.name };
    }
  });
}

// --- Das Bild ---------------------------------------------------------------

const xml = (text) =>
  String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Wo ein Wert auf der Achse liegt, als Anteil zwischen 0 und 1. */
function anteil(wert, spanne) {
  const breite = spanne.bis - spanne.von;
  return breite === 0 ? 0.5 : (wert - spanne.von) / breite;
}

/** Was die Achse fasst. Alles andere wird nicht gezeichnet. */
const zeichenbar = (wert, spanne) => Number.isFinite(wert) && wert >= spanne.von && wert <= spanne.bis;

/**
 * Zusammenhängende Stuecke der Kurve.
 *
 * Eine Luecke bleibt eine Luecke: wo die Funktion keinen endlichen Wert
 * liefert, wird nicht verbunden. Ein Strich durch eine Unendlichkeit hindurch
 * behauptete Verlaeufe, die es nicht gibt -- dieselbe Regel gilt an einer
 * vorgegebenen Achsengrenze.
 */
function striche(punkte) {
  const fertig = [];
  let offen = [];
  for (const p of punkte) {
    if (p.punkt) offen.push(p.punkt);
    else if (offen.length) {
      fertig.push(offen.join(" "));
      offen = [];
    }
  }
  if (offen.length) fertig.push(offen.join(" "));
  // Ein einzelner Punkt ist keine Linie. Ihn zu zeichnen waere ein Punkt ohne
  // Aussage -- und die Kurve saehe aus, als haette sie dort eine Richtung.
  return fertig.filter((strich) => strich.includes(" "));
}

/**
 * Das vollstaendige Bild als SVG.
 *
 * Alles, was im Bild steht, kommt aus den uebergebenen Zahlen und Texten --
 * hier wird nichts gemessen und nichts importiert. Damit ist diese Funktion
 * pruefbar, ohne dass ein Modul existiert.
 */
export function kurvenbild({
  titel,
  unter = "",
  xTitel = "",
  yTitel = "",
  proben: kurve,
  faelle = [],
  ySpanne = null,
  herkunft = "",
}) {
  const xS = { von: kurve.von, bis: kurve.bis };
  const yS = spanne(kurve.werte.map((w) => w.y), ySpanne);

  const xPix = (x) => BLATT.links + anteil(x, xS) * (BLATT.rechts - BLATT.links);
  const yPix = (y) => BLATT.unten - anteil(y, yS) * (BLATT.unten - BLATT.oben);
  const imX = (x) => x >= xS.von && x <= xS.bis;

  const gitter = [];
  for (const marke of marken(yS, schrittweite(yS.von, yS.bis, 5))) {
    gitter.push(`<line x1="${BLATT.links}" y1="${yPix(marke).toFixed(1)}" x2="${BLATT.rechts}" y2="${yPix(marke).toFixed(1)}" class="gitter"/>`);
    gitter.push(`<text x="${BLATT.links - 10}" y="${(yPix(marke) + 4).toFixed(1)}" class="tick" text-anchor="end">${xml(zahlText(marke))}</text>`);
  }
  for (const marke of marken(xS, schrittweite(xS.von, xS.bis, 5))) {
    gitter.push(`<line x1="${xPix(marke).toFixed(1)}" y1="${BLATT.oben}" x2="${xPix(marke).toFixed(1)}" y2="${BLATT.unten}" class="gitter"/>`);
    gitter.push(`<text x="${xPix(marke).toFixed(1)}" y="${BLATT.unten + 22}" class="tick" text-anchor="middle">${xml(zahlText(marke))}</text>`);
  }

  const kurvenStriche = striche(
    kurve.werte.map((w) => ({
      wert: w.y,
      punkt: zeichenbar(w.y, yS) ? `${xPix(w.x).toFixed(1)},${yPix(w.y).toFixed(1)}` : null,
    })),
  );

  // Ein Fall, den die Achse nicht fasst, steht nicht in der Tabelle: die Achse
  // ist die Aussage des Bildes, und was daneben liegt, gehoert in ein eigenes
  // Bild. Nicht endliche Werte und Fehler stehen trotzdem da -- sie brauchen
  // keine Position, sie sind das Ergebnis.
  const gezeigt = faelle.filter(
    (f) => f.fehler || !Number.isFinite(f.wert) || (imX(f.x) && zeichenbar(f.wert, yS)),
  );

  const markierung = gezeigt
    .filter((f) => Number.isFinite(f.wert) && imX(f.x) && zeichenbar(f.wert, yS))
    .map(
      (f) =>
        `<circle cx="${xPix(f.x).toFixed(1)}" cy="${yPix(f.wert).toFixed(1)}" r="4.5" class="marke"/>`
        + `<text x="${(xPix(f.x) + 9).toFixed(1)}" y="${(yPix(f.wert) - 8).toFixed(1)}" class="markentext">${xml(zahlText(f.x))} → ${xml(zahlText(f.wert))}</text>`,
    );

  const tabellenkopf = BLATT.oben + 4;
  const zeilen = gezeigt.map((f, i) => {
    const y = tabellenkopf + 30 + i * 26;
    const aufruf = f.text ?? `x = ${zahlText(f.x)}`;
    const ergebnis = f.fehler ?? zahlText(f.wert);
    return `<text x="${SPALTE.links}" y="${y}" class="zelle">${xml(aufruf)}</text>`
      + `<text x="${SPALTE.rechts}" y="${y}" class="wert" text-anchor="end">${xml(ergebnis)}</text>`;
  });

  const achsenName = [
    xTitel ? `<text x="${BLATT.rechts}" y="${BLATT.unten + 40}" class="tick" text-anchor="end">${xml(xTitel)}</text>` : "",
    yTitel ? `<text x="${BLATT.links - 10}" y="${BLATT.oben - 14}" class="tick" text-anchor="end">${xml(yTitel)}</text>` : "",
  ].filter(Boolean);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BLATT.breite}" height="${BLATT.hoehe}" viewBox="0 0 ${BLATT.breite} ${BLATT.hoehe}" font-family="Helvetica, Arial, sans-serif">
  <style>
    .flaeche { fill: #ffffff; }
    .titel { font-size: 19px; font-weight: 600; fill: #16202b; }
    .unter { font-size: 12.5px; fill: #5b6b7c; }
    .achse { stroke: #16202b; stroke-width: 1.4; }
    .gitter { stroke: #dfe6ec; stroke-width: 1; }
    .tick { font-size: 11px; fill: #5b6b7c; }
    .kurve { fill: none; stroke: #1f6feb; stroke-width: 2.4; }
    .marke { fill: #1f6feb; }
    .markentext { font-size: 12px; fill: #16202b; }
    .kopf { font-size: 13px; font-weight: 600; fill: #16202b; }
    .zelle { font-size: 12.5px; fill: #16202b; }
    .wert { font-size: 12.5px; font-weight: 600; fill: #1f6feb; }
    .fuss { font-size: 11px; fill: #8a97a3; }
  </style>

  <rect width="${BLATT.breite}" height="${BLATT.hoehe}" class="flaeche"/>

  <text x="40" y="36" class="titel">${xml(titel)}</text>
  ${unter ? `<text x="40" y="54" class="unter">${xml(unter)}</text>` : ""}

  ${gitter.join("\n  ")}

  <line x1="${BLATT.links}" y1="${BLATT.oben}" x2="${BLATT.links}" y2="${BLATT.unten}" class="achse"/>
  <line x1="${BLATT.links}" y1="${BLATT.unten}" x2="${BLATT.rechts}" y2="${BLATT.unten}" class="achse"/>
  ${achsenName.join("\n  ")}

  ${kurvenStriche.map((strich) => `<polyline points="${strich}" class="kurve"/>`).join("\n  ")}

  ${markierung.join("\n  ")}

  <text x="${SPALTE.links}" y="${tabellenkopf}" class="kopf">Einzelne Faelle, frisch gerechnet</text>
  ${zeilen.join("\n  ")}

  <text x="40" y="${BLATT.hoehe - 36}" class="unter">Jede Zahl im Bild stammt aus ${xml(herkunft || "dem genannten Modul")} -- ein zweiter Rechenweg steht nirgends.</text>
  <text x="40" y="${BLATT.hoehe - 18}" class="fuss">Erzeugt am ${new Date().toISOString()} von tools/belegbild.mjs</text>
</svg>
`;
}

// --- Einstieg ---------------------------------------------------------------

function abbruch(...zeilen) {
  for (const z of zeilen) console.error(z);
  process.exit(2);
}

const AUFRUF = [
  "Aufruf: node tools/belegbild.mjs <ziel.svg> --modul=<pfad> --funktion=<name> --von=<zahl> --bis=<zahl>",
  "  --schritte=<n>      Punkte der Kurve (Vorgabe 200)",
  "  --argument=<zahl>   festes Argument vor dem Kurvenwert, mehrfach moeglich",
  "  --fall=<zahl>       einzelner Fall neben der Kurve, mehrfach moeglich",
  "  --y-von/--y-bis     Grenzen der Werteachse, sonst aus der Kurve",
  "  --titel/--unter/--x-titel/--y-titel   Beschriftung des Bildes",
];

/** Ein Argument der Form `--name=wert`, mehrfach erlaubt. */
function mehrfach(rest, name) {
  return rest.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
}

async function haupt() {
  const [ziel, ...rest] = process.argv.slice(2);
  const wert = (name, ersatz = null) => {
    const treffer = rest.find((a) => a.startsWith(`--${name}=`));
    return treffer ? treffer.slice(name.length + 3) : ersatz;
  };
  const zahl = (name) => {
    const roh = wert(name);
    if (roh === null) return null;
    const n = Number(roh);
    if (!Number.isFinite(n)) abbruch(`--${name}=${roh} ist keine Zahl.`, "", ...AUFRUF);
    return n;
  };

  if (!ziel || !ziel.endsWith(".svg")) abbruch("Ohne Zielpfad auf .svg entsteht kein Beleg.", "", ...AUFRUF);

  const modulPfad = wert("modul");
  if (!modulPfad) abbruch("Ohne --modul ist das Bild eine Behauptung: die Zahlen kaemen von nirgends.", "", ...AUFRUF);

  const name = wert("funktion");
  if (!name) abbruch("Ohne --funktion ist nicht bestimmt, was gerechnet wird.", "", ...AUFRUF);

  const von = zahl("von");
  const bis = zahl("bis");
  if (von === null || bis === null) abbruch("Ohne --von und --bis hat die Kurve keine Achse.", "", ...AUFRUF);

  const modul = await import(pathToFileURL(resolve(modulPfad)).href).catch((fehler) =>
    abbruch(`Das Modul ${modulPfad} liess sich nicht laden:`, `  ${fehler.message}`),
  );
  if (typeof modul[name] !== "function") {
    abbruch(`${modulPfad} exportiert keine Funktion '${name}'.`, `Vorhanden: ${Object.keys(modul).join(", ") || "nichts"}`);
  }

  const f = modul[name];
  const feste = mehrfach(rest, "argument").map(Number);
  const faelle = mehrfach(rest, "fall").map(Number);
  const kurve = proben(aufrufer(f, feste), { von, bis, schritte: zahl("schritte") ?? 200 });
  const gerechnet = faelleRechnen(f, faelle, feste).map((fall) => ({
    ...fall,
    text: `${name}(${[...feste, fall.x].join(", ")})`,
  }));

  const bild = kurvenbild({
    titel: wert("titel", `Kurve von ${name}`),
    unter: wert("unter", `${name} ueber x, aufgerufen mit den Argumenten des Auftrags`),
    xTitel: wert("x-titel", "x"),
    yTitel: wert("y-titel", name),
    proben: kurve,
    faelle: gerechnet,
    ySpanne: { von: zahl("y-von"), bis: zahl("y-bis") },
    herkunft: `${modulPfad}#${name}`,
  });

  writeFileSync(ziel, bild, "utf8");
  console.log(`Belegbild geschrieben: ${ziel}`);
  for (const fall of gerechnet) {
    console.log(`  ${fall.text} = ${fall.fehler ?? zahlText(fall.wert)}`);
  }
}

// Beim Import aus einem Test darf der Einstieg nicht laufen -- er liest argv.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await haupt();
}
