// Was eine Mitschrift ueber einen Lauf verraet -- rein gerechnet.
//
// Hier steht keine Datei-Operation. Die Funktionen bekommen geparste Saetze und
// geben Zahlen zurueck; das Lesen und Ablegen gehoert nach messlauf.mjs. Der
// Grund ist derselbe wie bei pruefungen.mjs: was sich als reine Funktion
// hinschreiben laesst, laesst sich auch pruefen.
//
// Warum ueberhaupt neben tokens.mjs: das dort zeigt Sitzungen als Uebersicht,
// eine Sitzung ist seine Einheit. Ein Messlauf ist weder eine Sitzung noch
// zuverlaessig ein Teil davon -- er hat einen Auftrag, ein Zielrepo und ein
// Ergebnis, das zu ihm gehoert.

const LEER = { ein: 0, aus: 0, cacheLesen: 0, cacheSchreiben: 0, nachrichten: 0 };

/** Die Nutzungsangabe eines Satzes, oder nichts. */
function nutzung(satz) {
  return satz?.message?.usage ?? null;
}

/**
 * Token je Art und je Modell ueber alle Saetze mit Nutzungsangabe.
 *
 * Eine API-Antwort zaehlt einmal. Claude Code schreibt sie als mehrere Zeilen --
 * eine je Inhaltsblock: Denken, Text, Werkzeugaufruf -- mit derselben
 * `message.id` und identischer `usage`. Wer jede Zeile summiert, weist die Token
 * doppelt bis dreifach aus; Lauf 89401f6c stand so bei 5,4 statt 2,57 Millionen.
 * Zeilen ohne Kennung bleiben einzeln: dort gibt es nichts zu entdoppeln.
 */
export function summiere(saetze) {
  const gesamt = { ...LEER, jeModell: {} };
  const gesehen = new Set();
  for (const satz of saetze) {
    const n = nutzung(satz);
    if (!n) continue;
    const id = satz.message.id;
    if (id) {
      if (gesehen.has(id)) continue;
      gesehen.add(id);
    }
    const modell = satz.message.model ?? "unbekannt";
    gesamt.jeModell[modell] ??= { ...LEER };
    for (const ziel of [gesamt, gesamt.jeModell[modell]]) {
      ziel.ein += n.input_tokens ?? 0;
      ziel.aus += n.output_tokens ?? 0;
      ziel.cacheLesen += n.cache_read_input_tokens ?? 0;
      ziel.cacheSchreiben += n.cache_creation_input_tokens ?? 0;
      ziel.nachrichten += 1;
    }
  }
  return gesamt;
}

/** Die Marker, zwischen denen das Messstueck steht. */
const AB_HIER = /^##\s*Der Auftrag ab hier\s*$/m;
const BIS_HIER = /^##\s*Der Auftrag bis hier\s*$/m;

/**
 * Das Messstueck aus einer Auftragsdatei -- nur der Abschnitt, nicht die Datei.
 *
 * Der Pruefwert ueber diesen Text entscheidet, ob zwei Messungen dieselbe
 * Aufgabe gemessen haben. Deckte er die ganze Datei ab, entwertete jeder
 * ergaenzte Satz Begruendung rueckwirkend die ganze Messreihe.
 */
export function auftragstext(datei) {
  const anfang = datei.match(AB_HIER);
  const ende = datei.match(BIS_HIER);
  if (!anfang || !ende || ende.index < anfang.index) return null;
  return datei.slice(anfang.index + anfang[0].length, ende.index).trim();
}

/** Ab hier gilt ein Abstand zwischen zwei Eintraegen als Pause, nicht als Arbeit. */
export const PAUSE_SEKUNDEN = 10 * 60;

/**
 * Wie lange ein Lauf gedauert hat -- zwei Groessen, die auseinandergehalten
 * gehoeren.
 *
 * Die Spanne ist die Zeit vom ersten bis zum letzten Eintrag. Sie zaehlt jede
 * Mittagspause mit und taugt darum nicht als Aufwandsmass; sie sagt aber, wie
 * lange der Lauf im Kalender stand, und das laesst sich sonst nirgends ablesen.
 * Die aktive Zeit summiert nur die Abstaende unterhalb der Pausenschwelle.
 *
 * Gerechnet wird aus den Zeitstempeln der Mitschrift, nicht aus dem
 * Aenderungsdatum ihrer Datei: dieses verschiebt sich, sobald ein Hook die Datei
 * anfasst, und wies im Bestand mehrere Sitzungen auf denselben Zeitpunkt aus,
 * Stunden nach ihrem tatsaechlichen Ende.
 *
 * Weniger als zwei Zeitstempel ergeben keine Dauer. Null waere hier die
 * gefaehrlichste Antwort -- sie sieht aus wie ein Lauf ohne Aufwand.
 */
export function dauer(saetze, pauseSekunden = PAUSE_SEKUNDEN) {
  const zeiten = [];
  for (const satz of saetze) {
    const wert = Date.parse(satz?.timestamp ?? "");
    if (!Number.isNaN(wert)) zeiten.push(wert);
  }
  if (zeiten.length < 2) return null;

  // Die Mitschrift ist der Reihe nach geschrieben, aber nichts erzwingt das.
  zeiten.sort((a, b) => a - b);

  let aktiv = 0;
  for (let i = 1; i < zeiten.length; i += 1) {
    const abstand = (zeiten[i] - zeiten[i - 1]) / 1000;
    if (abstand <= pauseSekunden) aktiv += abstand;
  }

  return { spanne: (zeiten.at(-1) - zeiten[0]) / 1000, aktiv };
}

/** Ab so vielen Nachrichten gilt eine Sitzung als Lauf. */
export const MINDEST_NACHRICHTEN = 5;

/**
 * Ist diese Sitzung ein Lauf -- oder nur ein Aufruf?
 *
 * Hooks und Werkzeuge fuehren eigene Sitzungen mit genau einer Nachricht. Im
 * Bestand stellten sie zehn von dreizehn Eintraegen und zogen den Median auf
 * achtundvierzigtausend Token, waehrend jeder wirkliche Lauf ueber neunzig
 * Millionen lag. Eine Kennzahl, die das mitzaehlt, beschreibt keinen Lauf.
 */
export function istLauf(zusammenfassung) {
  return (zusammenfassung?.nachrichten ?? 0) >= MINDEST_NACHRICHTEN;
}

/**
 * Der Kontext, den das Modell bei seiner ersten Antwort vor sich hatte.
 *
 * Er wird in jeder weiteren Runde erneut abgerechnet und geht damit linear mit
 * der Rundenzahl in den Aufwand ein -- bei vierzig Tausend Token und fuenfzig
 * Runden sind das zwei Millionen, bevor irgendetwas getan wurde. Darum eine
 * eigene Groesse: herausrechnen laesst er sich daraus jederzeit, zurueckholen
 * nicht.
 */
export function startkontext(saetze) {
  for (const satz of saetze) {
    const n = nutzung(satz);
    if (!n) continue;
    return (n.input_tokens ?? 0) + (n.cache_read_input_tokens ?? 0) + (n.cache_creation_input_tokens ?? 0);
  }
  return null;
}

/**
 * Werkzeugaufrufe und davon Schalenbefehle.
 *
 * Die Zahl steht gleichberechtigt neben den Token, weil die Rundenzahl
 * quadratisch in den Aufwand eingeht: eine Optimierung, die einen Befehl
 * einspart, wirkt stark; eine, die einen Befehl schneller macht, gar nicht.
 */
export function zaehleAufrufe(saetze) {
  let werkzeug = 0;
  let schale = 0;
  for (const satz of saetze) {
    const inhalt = satz?.message?.content;
    if (!Array.isArray(inhalt)) continue;
    for (const teil of inhalt) {
      if (teil?.type !== "tool_use") continue;
      werkzeug += 1;
      if (teil.name === "Bash") schale += 1;
    }
  }
  return { werkzeug, schale };
}

/**
 * Kosten in Euro gegen eine gepflegte Preistabelle, je Million Token.
 *
 * Ein fehlender Preis wird ausgewiesen, nicht als null verbucht. Sonst saehe
 * eine Messung umso guenstiger aus, je weniger sie weiss -- der teuerste Fehler,
 * den eine Kostenrechnung machen kann.
 */
export function kosten(jeModell, preise) {
  let euro = 0;
  const unbekannt = [];
  for (const [modell, w] of Object.entries(jeModell)) {
    const p = preise[modell];
    if (!p) {
      unbekannt.push(modell);
      continue;
    }
    euro +=
      (w.ein / 1e6) * p.ein +
      (w.aus / 1e6) * p.aus +
      (w.cacheLesen / 1e6) * p.cacheLesen +
      (w.cacheSchreiben / 1e6) * p.cacheSchreiben;
  }
  return { euro, unbekannt, vollstaendig: unbekannt.length === 0 };
}

/** Ab hier gelten zwei Startkontexte als zu verschieden zum Vergleichen. */
const SCHWELLE = 0.1;

/**
 * Zwei abgelegte Messungen gegenueberstellen.
 *
 * Zwei Urteile, die auseinandergehalten werden: ist die zweite Fassung besser
 * (weniger Aufwand bei gleichem Erfuellungsgrad), und ist der Vergleich
 * ueberhaupt belastbar. Ein verschobener Startkontext macht das zweite falsch,
 * ohne das erste zu beruehren -- verglichen werden dann zwei Umgebungen statt
 * zweier Fassungen.
 */
export function vergleiche(vorher, nachher) {
  const verloren = (vorher.erfuellt ?? []).filter((k) => !(nachher.erfuellt ?? []).includes(k));

  const a = vorher.startkontext ?? 0;
  const b = nachher.startkontext ?? 0;
  const abweichung = a === 0 ? 0 : Math.abs(b - a) / a;

  return {
    token: { vorher: vorher.gesamt, nachher: nachher.gesamt, differenz: nachher.gesamt - vorher.gesamt },
    befehle: { vorher: vorher.befehle, nachher: nachher.befehle, differenz: nachher.befehle - vorher.befehle },
    startkontext: { vorher: a, nachher: b, abweichung },
    verloren,
    verbesserung: nachher.gesamt < vorher.gesamt && verloren.length === 0,
    belastbar: abweichung <= SCHWELLE,
  };
}
