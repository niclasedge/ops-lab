// Die Entscheidungen des Leitstands, herausgeloest aus seiner Beschreibung.
//
// Ein Skill ist Prosa, und Prosa laesst sich nicht pruefen. Die beiden Entscheidungen,
// bei denen ein Irrtum teuer ist -- wen darf ich gleichzeitig beauftragen, und darf ich
// mergen --, stehen deshalb hier als reine Funktionen: ohne Platte, ohne Prozess, mit
// einem Test dahinter. Die Beschreibung ruft sie auf, statt sie nachzuerzaehlen.
//
// Dazu zwei Lesehilfen, mit denen der Test die Beschreibungen selbst prueft. Wer dem
// Arbeiter versehentlich das Werkzeug zum Starten weiterer Agenten gibt, baut eine Kette
// von Enkeln, die niemand mehr ueberblickt -- das faellt nur auf, wenn es jemand liest.
//
// Einzige Ausnahme von "ohne Platte": `bildBelegt` liest das Belegjournal eines Changes,
// damit die Beschreibung den Wert fuer `mergeErlaubt` nicht selbst zusammensuchen muss.

import { liesJournal } from "./beleg.mjs";
import { belegLage } from "./pruefungen.mjs";

/** Welcher Zustand eines Pull Requests als gruen gilt. Alles andere ist es nicht. */
const GRUEN = new Set(["gruen", "SUCCESS", "success"]);

/**
 * Welche der freien Changes gleichzeitig beauftragt werden koennen.
 *
 * Der Reihe nach, und wer sich mit einem schon Vergebenen ueberschneidet, wartet. Die
 * Reihenfolge ist die der Liste: das Lagebild sortiert bereits, und wer hier neu
 * sortiert, macht die Abfolge unvorhersehbar.
 *
 * `ueberschneidungen` ist eine Liste von Paaren. Ein Paar heisst: diese beiden Changes
 * fassen dieselben Dateien an und laufen daher nacheinander.
 */
export function auftraege(frei, ueberschneidungen) {
  const vergeben = [];
  for (const kennung of frei) {
    const kollidiert = ueberschneidungen.some(([a, b]) =>
      (a === kennung && vergeben.includes(b)) || (b === kennung && vergeben.includes(a)));
    if (!kollidiert) vergeben.push(kennung);
  }
  // Raum und Change tragen denselben Namen: `just neu` legt beide unter der Kennung an.
  return vergeben.map((kennung) => ({ kennung, raum: kennung }));
}

/**
 * Darf dieser Change gemergt werden?
 *
 * Erlaubt ist es nur, wenn alle drei Nachweise im Change liegen und der Pull Request
 * seine Pruefungen bestanden hat. Ein unbekannter Zustand gilt als nicht gruen: `gh`
 * meldet auch dann nichts, wenn es gar nicht erst gefragt hat, und wer das als Zusage
 * liest, merged auf Verdacht.
 *
 * Seit Change 02-bildbeleg-sichtbar (#909) verlangt der Merge zusaetzlich den
 * Bildbeleg aus der Prozessschmiede (`bild`, aus `bildBelegt`). Wer nicht danach
 * fragt, bekommt kein `erlaubt`.
 */
export function mergeErlaubt({ gate1, gate2, fertig, pruefungen, bild }) {
  const fehlend = [
    [gate1, "gate1.md"],
    [gate2, "gate2.md"],
    [fertig, "fertig.md"],
  ].filter(([liegtVor]) => !liegtVor).map(([, name]) => name);

  if (fehlend.length > 0) {
    return { erlaubt: false, grund: `Nachweis fehlt: ${fehlend.join(", ")}` };
  }
  if (!GRUEN.has(pruefungen)) {
    const zustand = pruefungen ? pruefungen : "unbekannt";
    return { erlaubt: false, grund: `Pruefungen des Pull Requests nicht gruen: ${zustand}` };
  }
  if (bild !== true) {
    return { erlaubt: false, grund: "Bildbeleg aus der Prozessschmiede fehlt im Journal des Changes" };
  }
  return { erlaubt: true, grund: "drei Nachweise, Bildbeleg und gruene Pruefungen" };
}

/** Liegt im Journal des Change-Ordners ein Bildbeleg, der den Abschluss traegt? */
export function bildBelegt(ordner) {
  return belegLage(liesJournal(ordner)).sichtbar;
}

/** Der Werkzeugsatz aus dem Frontmatter einer Agenten- oder Skill-Beschreibung. */
export function werkzeugsatz(text) {
  const zeile = text.match(/^tools:\s*(.+)$/m);
  if (!zeile) return [];
  return zeile[1].split(",").map((name) => name.trim()).filter(Boolean);
}

/**
 * Die Rezepte, die eine Beschreibung in ihren nummerierten Schritten aufruft -- in der
 * Reihenfolge, in der sie dort stehen. Daran laesst sich pruefen, dass die Kette nicht
 * verrutscht ist: ein Arbeiter, der `gate2` vor `gate1` nennt, faellt sofort auf.
 */
export function schrittfolge(text) {
  const rezepte = [];
  // Ein Schritt beginnt mit seiner Ziffer und reicht bis zur naechsten unein-
  // gerueckten Zeile. Ohne diese Fortsetzung entginge jedes Rezept, das erst in der
  // zweiten Zeile eines Schritts steht -- und die Kette saehe kuerzer aus, als sie ist.
  let imSchritt = false;
  for (const zeile of text.split("\n")) {
    if (/^\s*\d+\.\s/.test(zeile)) imSchritt = true;
    else if (!/^\s+\S/.test(zeile)) imSchritt = false;
    if (!imSchritt) continue;
    for (const [, rezept] of zeile.matchAll(/just\s+([a-z0-9-]+)/g)) {
      rezepte.push(rezept);
    }
  }
  return rezepte;
}
