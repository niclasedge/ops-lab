// Ob ein Lauf sauber abgearbeitet wurde -- sieben Kriterien, einzeln geprueft.
//
// Eine Punktzahl waere handlicher: sie liesse sich in einer Spalte fuehren und
// ueber Laeufe mitteln. Sie verdeckt aber, welches Kriterium gefallen ist, und
// die sieben sind nicht gleich viel wert -- ein fehlender Beleg und ein nicht
// gemergter Pull Request sind verschiedene Zustaende, die derselbe Bruchteil
// beschreibt. Die Zusammenfassung als Bruch steht daneben, nicht anstelle.

import { aufgaben, belegLage, dateiAbgleich } from "./pruefungen.mjs";

// Die Zusage zu lesen ist eine reine Textfrage und steht deshalb bei den
// uebrigen Textregeln. Von hier aus weitergereicht, weil tools/messlauf.mjs sie
// als Teil der Messung kennt.
export { zugesagteDateien } from "./pruefungen.mjs";

/**
 * Der Erfuellungsgrad eines Laufs.
 *
 * Erwartet eine Lage, die anderswo eingesammelt wurde: Nachweise, Belegzeilen,
 * Aufgabentext, zugesagte und tatsaechlich geaenderte Dateien, Testlauf und der
 * Stand des Pull Requests. Diese Funktion befragt nichts -- sie urteilt.
 */
export function bewerte(lage) {
  const fehlendeNachweise = ["gate1", "gate2", "fertig"].filter((n) => !lage[n]);
  const beleg = belegLage(lage.belege ?? []);
  const offen = aufgaben(lage.tasksText ?? "").offen;

  // Eine zugesagte Datei, die unberuehrt blieb, ist kein Verstoss -- die Liste
  // ist eine Obergrenze fuer den Dateiumfang, keine Pflicht zum Anfassen. Von
  // den beiden Richtungen des Abgleichs zaehlt hier deshalb nur der Zusatz.
  const ungesagt = dateiAbgleich(lage.zugesagt ?? [], lage.geaendert ?? []).zusatz;

  const kriterien = [
    {
      id: "gates",
      text: "alle drei Gate-Nachweise liegen vor",
      erfuellt: fehlendeNachweise.length === 0,
      meldung: fehlendeNachweise.length ? `fehlt: ${fehlendeNachweise.join(", ")}` : "",
    },
    {
      id: "beleg",
      text: "ein sichtbarer Beleg der Stufe nachher liegt vor",
      erfuellt: beleg.sichtbar,
      meldung: beleg.meldung,
    },
    {
      id: "aufgaben",
      text: "keine Aufgabe ist offen",
      erfuellt: offen === 0,
      meldung: offen ? `${offen} Aufgabe(n) offen` : "",
    },
    {
      id: "dateien",
      text: "der Diff haelt die zugesagten Dateien ein",
      erfuellt: ungesagt.length === 0,
      meldung: ungesagt.length ? `nicht zugesagt: ${ungesagt.join(", ")}` : "",
    },
    { id: "tests", text: "der Testlauf ist gruen", erfuellt: Boolean(lage.testsGruen), meldung: "" },
    { id: "pr", text: "ein Pull Request wurde gestellt", erfuellt: Boolean(lage.prGestellt), meldung: "" },
    { id: "merge", text: "der Pull Request wurde gemergt", erfuellt: Boolean(lage.gemergt), meldung: "" },
  ];

  return {
    kriterien,
    erfuellt: kriterien.filter((k) => k.erfuellt).length,
    gesamt: kriterien.length,
  };
}
