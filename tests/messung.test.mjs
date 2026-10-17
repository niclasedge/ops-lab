// Was eine Mitschrift ueber einen Lauf verraet.
//
// Die Funktionen in messung.mjs sind rein: sie bekommen geparste Saetze und
// geben Zahlen zurueck. Das Lesen der Datei gehoert nach messlauf.mjs -- hier
// laesst sich damit jeder Sonderfall hinschreiben, ohne eine Datei anzulegen.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { auftragstext, dauer, istLauf, kosten, startkontext, summiere, vergleiche, zaehleAufrufe } from "../tools/messung.mjs";

/** Eine Assistenz-Nachricht, wie Claude Code sie in die JSONL schreibt. */
const nachricht = (modell, nutzung, inhalt = []) => ({
  type: "assistant",
  message: { model: modell, usage: nutzung, content: inhalt },
});

const werkzeug = (name) => ({ type: "tool_use", name, id: `t${Math.random()}`, input: {} });

describe("Aufwand aus der Mitschrift", () => {
  it("summiert Token getrennt nach Art und Modell", () => {
    const saetze = [
      nachricht("claude-opus-5", { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 39000, cache_creation_input_tokens: 500 }),
      nachricht("claude-opus-5", { input_tokens: 5, output_tokens: 300, cache_read_input_tokens: 40000, cache_creation_input_tokens: 0 }),
      nachricht("claude-haiku-4-5-20251001", { input_tokens: 2, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 }),
    ];
    const w = summiere(saetze);

    assert.equal(w.ein, 17);
    assert.equal(w.aus, 550);
    assert.equal(w.cacheLesen, 80000);
    assert.equal(w.cacheSchreiben, 500);
    assert.equal(w.nachrichten, 3);
    assert.deepEqual(Object.keys(w.jeModell).sort(), ["claude-haiku-4-5-20251001", "claude-opus-5"]);
    assert.equal(w.jeModell["claude-opus-5"].nachrichten, 2);
  });

  it("uebergeht Saetze ohne Nutzungsangabe", () => {
    const saetze = [{ type: "user", message: { content: "Auftrag" } }, nachricht("claude-opus-5", { input_tokens: 1, output_tokens: 1 })];
    assert.equal(summiere(saetze).nachrichten, 1);
  });

  // Regression. Claude Code schreibt eine API-Antwort als mehrere Zeilen -- eine
  // je Inhaltsblock -- mit derselben message.id und identischer usage. Wer jede
  // Zeile zaehlt, weist die Token doppelt bis dreifach aus: Lauf 89401f6c stand
  // so bei 5,4 Millionen statt 2,57.
  it("zaehlt drei Zeilen derselben message.id als eine Antwort", () => {
    const nutzung = { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 39000, cache_creation_input_tokens: 500 };
    const zeile = (inhalt) => ({ ...nachricht("claude-opus-5", nutzung, inhalt), message: { ...nachricht("claude-opus-5", nutzung, inhalt).message, id: "msg_01" } });
    const saetze = [
      zeile([{ type: "thinking", thinking: "..." }]),
      zeile([{ type: "text", text: "Ich lege den Change an." }]),
      zeile([werkzeug("Bash")]),
    ];
    const w = summiere(saetze);

    assert.equal(w.nachrichten, 1);
    assert.equal(w.aus, 200);
    assert.equal(w.cacheLesen, 39000);
    assert.equal(w.jeModell["claude-opus-5"].nachrichten, 1);
  });

  it("zaehlt Zeilen ohne message.id weiterhin einzeln", () => {
    const saetze = [nachricht("claude-opus-5", { input_tokens: 1 }), nachricht("claude-opus-5", { input_tokens: 1 })];
    assert.equal(summiere(saetze).nachrichten, 2);
  });
});

describe("Das Messstueck aus der Auftragsdatei", () => {
  const datei = `# Auftrag

Begruendung, die nicht zum Messstueck gehoert.

## Der Auftrag ab hier

Ergaenzen Sie die Amortisationsdauer.

## Der Auftrag bis hier

Nachwort, das ebenfalls nicht dazugehoert.
`;

  it("nimmt nur den Abschnitt zwischen den beiden Markern", () => {
    assert.equal(auftragstext(datei), "Ergaenzen Sie die Amortisationsdauer.");
  });

  // Der Pruefwert entscheidet, ob zwei Messungen dieselbe Aufgabe messen. Deckte
  // er die ganze Datei ab, entwertete jeder Satz Begruendung die Messreihe.
  it("bleibt gleich, wenn sich nur die Begruendung drumherum aendert", () => {
    const geaendert = datei.replace("Begruendung, die nicht zum Messstueck gehoert.", "Ein ganz anderer Satz.");
    assert.equal(auftragstext(geaendert), auftragstext(datei));
  });

  it("aendert sich, sobald sich der Abschnitt selbst aendert", () => {
    const geaendert = datei.replace("Amortisationsdauer", "Kapitalwertmethode");
    assert.notEqual(auftragstext(geaendert), auftragstext(datei));
  });

  it("meldet null, wenn ein Marker fehlt", () => {
    assert.equal(auftragstext("# Auftrag\n\nNur Prosa, keine Marker.\n"), null);
    assert.equal(auftragstext("## Der Auftrag ab hier\n\nAnfang ohne Ende.\n"), null);
  });
});

describe("Startkontext", () => {
  // Er ist der Preis, den jede Runde erneut zahlt -- darum eine eigene Groesse
  // und nicht ein Teil der Summe, der sich nicht mehr herausloesen laesst.
  it("liest ihn aus der ersten Nachricht mit Nutzungsangabe", () => {
    const saetze = [
      { type: "user", message: { content: "Auftrag" } },
      nachricht("claude-opus-5", { input_tokens: 12, output_tokens: 200, cache_read_input_tokens: 38000, cache_creation_input_tokens: 1194 }),
      nachricht("claude-opus-5", { input_tokens: 4, output_tokens: 300, cache_read_input_tokens: 99999, cache_creation_input_tokens: 0 }),
    ];
    assert.equal(startkontext(saetze), 12 + 38000 + 1194);
  });

  it("meldet null, wenn keine Nachricht eine Nutzungsangabe traegt", () => {
    assert.equal(startkontext([{ type: "user", message: { content: "Auftrag" } }]), null);
  });

  it("bleibt getrennt vom uebrigen Aufwand, geht aber in die Summe ein", () => {
    const saetze = [
      nachricht("claude-opus-5", { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 39000, cache_creation_input_tokens: 0 }),
      nachricht("claude-opus-5", { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 41000, cache_creation_input_tokens: 0 }),
    ];
    const w = summiere(saetze);
    const gesamt = w.ein + w.aus + w.cacheLesen + w.cacheSchreiben;
    assert.equal(startkontext(saetze), 39010);
    assert.ok(gesamt > startkontext(saetze), "der Startkontext fehlt in der Summe");
  });
});

describe("Befehle zaehlen", () => {
  it("nennt sieben Werkzeugaufrufe und davon vier Schalenbefehle", () => {
    const saetze = [
      nachricht("claude-opus-5", { input_tokens: 1 }, [werkzeug("Bash"), werkzeug("Read"), werkzeug("Bash")]),
      nachricht("claude-opus-5", { input_tokens: 1 }, [werkzeug("Bash"), werkzeug("Edit")]),
      nachricht("claude-opus-5", { input_tokens: 1 }, [werkzeug("Bash"), werkzeug("Write")]),
    ];
    assert.deepEqual(zaehleAufrufe(saetze), { werkzeug: 7, schale: 4 });
  });

  it("zaehlt eine Mitschrift ohne Werkzeuge als null", () => {
    assert.deepEqual(zaehleAufrufe([nachricht("claude-opus-5", { input_tokens: 1 })]), { werkzeug: 0, schale: 0 });
  });
});

describe("Kosten", () => {
  const preise = {
    "claude-opus-5": { ein: 15, aus: 75, cacheLesen: 1.5, cacheSchreiben: 18.75, stand: "2026-09-20" },
  };

  it("rechnet je Modell gegen die Preistabelle", () => {
    const jeModell = {
      "claude-opus-5": { ein: 1e6, aus: 1e6, cacheLesen: 1e6, cacheSchreiben: 1e6, nachrichten: 1 },
    };
    const k = kosten(jeModell, preise);
    // Je eine Million Token in jeder Art: 15 + 75 + 1,50 + 18,75
    assert.equal(k.euro.toFixed(2), "110.25");
    assert.deepEqual(k.unbekannt, []);
  });

  // Ein fehlender Preis als null auszuweisen waere die teuerste Sorte Fehler:
  // die Messung saehe guenstiger aus, je weniger sie weiss.
  it("weist ein unbekanntes Modell als unbekannt aus, nicht als null", () => {
    const jeModell = {
      "claude-opus-5": { ein: 1e6, aus: 0, cacheLesen: 0, cacheSchreiben: 0, nachrichten: 1 },
      "modell-ohne-eintrag": { ein: 1e6, aus: 1e6, cacheLesen: 0, cacheSchreiben: 0, nachrichten: 1 },
    };
    const k = kosten(jeModell, preise);
    assert.deepEqual(k.unbekannt, ["modell-ohne-eintrag"]);
    assert.notEqual(k.euro, null, "bekannte Modelle werden trotzdem gerechnet");
    assert.equal(k.vollstaendig, false);
  });

  it("nennt sich vollstaendig, wenn jedes Modell einen Preis hat", () => {
    const k = kosten({ "claude-opus-5": { ein: 0, aus: 0, cacheLesen: 0, cacheSchreiben: 0, nachrichten: 1 } }, preise);
    assert.equal(k.vollstaendig, true);
  });
});

describe("Zwei Messungen vergleichen", () => {
  const messung = (felder) => ({
    gesamt: 3_500_000,
    befehle: 51,
    startkontext: 39_206,
    erfuellt: ["gate1", "gate2", "fertig", "beleg", "aufgaben", "dateien", "pr", "merge"],
    ...felder,
  });

  it("nennt weniger Aufwand bei gleichem Erfuellungsgrad eine Verbesserung", () => {
    const v = vergleiche(messung(), messung({ gesamt: 2_000_000, befehle: 30 }));
    assert.equal(v.verbesserung, true);
    assert.equal(v.belastbar, true);
  });

  it("nennt weniger Token bei geringerem Erfuellungsgrad keine Verbesserung", () => {
    const zweite = messung({ gesamt: 2_000_000, erfuellt: ["gate1", "gate2", "fertig", "aufgaben", "dateien", "pr", "merge"] });
    const v = vergleiche(messung(), zweite);
    assert.equal(v.verbesserung, false);
    assert.deepEqual(v.verloren, ["beleg"]);
  });

  // Der Startkontext wird vom Harness bestimmt, nicht vom Ablauf. Verschiebt er
  // sich zwischen zwei Laeufen, vergleicht man zwei Umgebungen statt zwei Fassungen.
  it("kennzeichnet einen Vergleich als nicht belastbar, wenn der Startkontext um mehr als zehn Prozent abweicht", () => {
    const v = vergleiche(messung({ startkontext: 39_000 }), messung({ startkontext: 48_000, gesamt: 2_000_000 }));
    assert.equal(v.belastbar, false);
    assert.equal(v.startkontext.vorher, 39_000);
    assert.equal(v.startkontext.nachher, 48_000);
    assert.ok(v.startkontext.abweichung > 0.1, "die Abweichung wird nicht benannt");
    assert.ok(v.token !== undefined, "die uebrigen Groessen fehlen im Vergleich");
  });

  it("bleibt belastbar, solange die Abweichung unter zehn Prozent liegt", () => {
    const v = vergleiche(messung({ startkontext: 40_000 }), messung({ startkontext: 42_000, gesamt: 2_000_000 }));
    assert.equal(v.belastbar, true);
  });
});

describe("Dauer eines Laufs", () => {
  /** Ein Satz der Mitschrift, auf den es hier nur wegen seines Zeitstempels ankommt. */
  const um = (uhrzeit) => ({ timestamp: `2026-09-20T${uhrzeit}:00.000Z` });

  // Die Spanne allein zaehlt jede Mittagspause mit; die aktive Zeit allein
  // verschweigt, wie lange ein Lauf im Kalender stand. Darum beide.
  it("weist Spanne und Zeit ohne Pausen getrennt aus", () => {
    // Zwei Arbeitsphasen von je fuenf Minuten, dazwischen knapp drei Stunden Pause.
    const saetze = [um("06:00"), um("06:02"), um("06:05"), um("09:00"), um("09:02"), um("09:05")];
    const d = dauer(saetze);

    assert.equal(d.spanne, 185 * 60, "erster bis letzter Eintrag");
    assert.equal(d.aktiv, 10 * 60, "die Pause von 175 Minuten zaehlt nicht mit");
  });

  it("zaehlt Abstaende unterhalb der Pausenschwelle voll mit", () => {
    const saetze = [um("06:00"), um("06:05"), um("06:09")];
    const d = dauer(saetze);

    assert.equal(d.spanne, 9 * 60);
    assert.equal(d.aktiv, 9 * 60, "kein Abstand liegt ueber der Schwelle");
  });

  // Null waere die gefaehrlichste Antwort: sie sieht aus wie ein Lauf ohne Aufwand.
  it("weist die Dauer als unbekannt aus, wenn nur ein Zeitstempel vorliegt", () => {
    assert.equal(dauer([um("06:00")]), null);
  });

  it("weist die Dauer als unbekannt aus, wenn kein Zeitstempel vorliegt", () => {
    assert.equal(dauer([{ type: "assistant" }, {}]), null);
  });

  it("uebergeht Saetze ohne Zeitstempel, statt an ihnen zu scheitern", () => {
    const saetze = [{ type: "summary" }, um("06:00"), { type: "summary" }, um("06:30")];
    assert.equal(dauer(saetze).spanne, 30 * 60);
  });

  // Die Mitschrift ist nach Zeit geordnet, aber nichts erzwingt das.
  it("kommt mit unsortierten Zeitstempeln zurecht", () => {
    const d = dauer([um("08:00"), um("06:00"), um("07:00")]);
    assert.equal(d.spanne, 2 * 3600);
  });
});

describe("Was als Lauf zaehlt", () => {
  // Im Bestand stellten Hook-Sitzungen mit je einer Nachricht zehn von dreizehn
  // Eintraegen und zogen den Median auf einen Wert, den kein Lauf je hatte.
  it("erkennt eine Sitzung ab fuenf Nachrichten als Lauf", () => {
    assert.equal(istLauf({ nachrichten: 5 }), true);
    assert.equal(istLauf({ nachrichten: 911 }), true);
  });

  it("verwirft eine Sitzung mit weniger als fuenf Nachrichten", () => {
    assert.equal(istLauf({ nachrichten: 4 }), false);
    assert.equal(istLauf({ nachrichten: 1 }), false);
    assert.equal(istLauf({ nachrichten: 0 }), false);
  });
});
