// Die Messpunkte des Changes lauf-schlanker: Nachrichten je Lauf, einmal wie
// die Mitschrift sie schreibt (Zeilen mit usage), einmal wie die API sie
// abrechnet (je message.id einmal). Gelesen aus den Mitschriften
// 89401f6c (Lauf 3) und 40d36a23 (Lauf 4) mit tools/messung.mjs.
//
//   Lauf 3   76 Zeilen   34 API-Antworten   2,59 Mio Token
//   Lauf 4   72 Zeilen   32 API-Antworten   1,81 Mio Token
//
// Die alte Zaehlung wies das 2,2-fache aus. Der Beleg des Changes rendert diese
// Punkte mit tools/belegbild.mjs; jede Zahl im Bild ist ein Zugriff auf diese
// Funktion, kein abgetippter Wert.

const MESSUNG = {
  3: { zeilen: 76, antworten: 34 },
  4: { zeilen: 72, antworten: 32 },
};

/**
 * Nachrichten eines Laufs. `zaehlung` 0 = Zeilen der Mitschrift (alte Zaehlung),
 * 1 = API-Antworten (neue Zaehlung). Der Lauf steht zuletzt, weil die Kurve
 * ueber den letzten Parameter laeuft.
 */
export function nachrichten(zaehlung, lauf) {
  const m = MESSUNG[Math.round(lauf)];
  if (!m) return null;
  return zaehlung >= 1 ? m.antworten : m.zeilen;
}
