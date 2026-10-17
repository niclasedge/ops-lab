// Woran ein Nachweis haengt.
//
// Ein Gate laeuft vor dem Commit. `git rev-parse HEAD` nennt deshalb den Stand
// *vor* der Arbeit -- fuer alle drei Gates denselben. Ohne eine Marke des
// Arbeitsbaums behauptet gate2.md (rot) und fertig.md (gruen) denselben Code
// geprueft zu haben, was nicht sein kann.
//
// Getestet in tests/nachweis.test.mjs.

import { createHash } from "node:crypto";

/**
 * Bildet die Kennung des geprueften Stands aus Commit und Arbeitsbaum.
 *
 * @param {string} headHash  Ausgabe von `git rev-parse HEAD`
 * @param {string} diffText  Ausgabe von `git diff HEAD` samt ungetrackter Dateien
 * @returns {string} `<kurz>` mit Hinweis, oder `<kurz>+<12 Zeichen Baummarke>`
 */
export function arbeitsstand(headHash, diffText) {
  const kurz = headHash.slice(0, 7);
  if (!diffText.trim()) return `${kurz} (nichts Uncommittetes)`;
  const marke = createHash("sha256").update(diffText).digest("hex").slice(0, 12);
  return `${kurz}+${marke}`;
}
