// Beispielmodul fuer Belegbild: die Funktion, an der Test und Beleg rechnen.
//
// Sie steht hier als echte Datei statt in einem Temp-Verzeichnis, damit derselbe
// Aufruf zweimal gilt -- einmal fuer den Testlauf, einmal fuer den sichtbaren
// Beleg des Changes. Wer die Kurve nachziehen will, ruft auf:
//
//   node tools/belegbild.mjs /tmp/belegbild.svg --modul=tests/belegbild-beispiel.mjs \
//     --funktion=amortisationsdauer --argument=10000 --von=1000 --bis=5000 --fall=2500 --fall=0

export function amortisationsdauer(investition, jahresrueckfluss) {
  if (investition < 0) throw new RangeError("negative Investition");
  if (jahresrueckfluss <= 0) return Infinity;
  return investition / jahresrueckfluss;
}
