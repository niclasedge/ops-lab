// Die Messpunkte des Changes lauf-sparsamer: Befehle je Lauf, gelesen aus
// docs/messungen/2026-09-20-amortisation-claude-*.json.
//
//   Lauf 2 (bd8914a3)  44 Befehle -- abgebrochen am Torwaechter
//   Lauf 3 (89401f6c)  46 Befehle -- 7/7, vor der Rahmen-Ergaenzung
//   Lauf 4 (40d36a23)  43 Befehle -- nach der Rahmen-Ergaenzung
//
// Der Beleg des Changes rendert diese Punkte mit tools/belegbild.mjs; jede Zahl
// im Bild ist ein echter Zugriff auf diese Funktion, kein abgetippter Wert.

export function befehle(lauf) {
  const messung = { 2: 44, 3: 46, 4: 43 };
  return messung[lauf] ?? null;
}
