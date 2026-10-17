// Belegbild: der sichtbare Beleg wird gerechnet, nicht getippt.
//
// Geprueft wird zweierlei. Einmal die reine Rechnung -- Proben, Achsen, Text --
// und einmal der ganze Weg von der Kommandozeile bis ins Journal des Vorgangs.
// Der zweite Teil ist der eigentliche Punkt: er belegt, dass ein gerendertes
// Bild die Pruefung des Abschlusses besteht, ohne dass jemand die Quelle
// anfasst.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { einliefern, liesJournal } from "../tools/beleg.mjs";
import { aufrufer, faelleRechnen, kurvenbild, marken, proben, schrittweite, spanne, zahlText } from "../tools/belegbild.mjs";
import { belegLage } from "../tools/pruefungen.mjs";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

/** Ein Ordner, den der Test sich selbst baut, und den er wieder wegraeumt. */
function ordner(name) {
  return mkdtempSync(join(tmpdir(), `${name}-`));
}

// --- Proben -----------------------------------------------------------------

describe("Proben einer Funktion", () => {
  it("holt jeden Wert aus der Funktion selbst", () => {
    const p = proben((x) => x * x, { von: 0, bis: 4, schritte: 4 });

    assert.deepEqual(p.werte.map((w) => w.x), [0, 1, 2, 3, 4]);
    assert.deepEqual(p.werte.map((w) => w.y), [0, 1, 4, 9, 16]);
  });

  it("macht aus Unendlichem eine Luecke, nicht eine Zahl", () => {
    const p = proben((x) => 100 / x, { von: -1, bis: 1, schritte: 2 });

    assert.deepEqual(p.werte.map((w) => w.y), [-100, null, 100]);
  });

  it("haelt die festen Argumente vor dem Kurvenwert", () => {
    const f = aufrufer((investition, rueckfluss) => investition / rueckfluss, [10000]);

    assert.equal(f(2500), 4);
    assert.equal(aufrufer((x) => x * 2)(21), 42, "ohne feste Argumente bleibt es einstellig");
  });
});

// --- Achsen -----------------------------------------------------------------

describe("Achsen einer Kurve", () => {
  it("nimmt die Spanne aus den endlichen Werten", () => {
    assert.deepEqual(spanne([3, null, 7]), { von: 3, bis: 7 });
  });

  it("haelt eine vorgegebene Grenze ein", () => {
    assert.deepEqual(spanne([3, 7, 20], { bis: 12 }), { von: 3, bis: 12 });
    assert.deepEqual(spanne([3, 7, 20], { von: 0 }), { von: 0, bis: 20 });
  });

  it("findet ohne einen einzigen Wert eine Flaeche statt null", () => {
    assert.deepEqual(spanne([null, Infinity, NaN]), { von: 0, bis: 1 });
  });

  it("weitet eine flache Spanne, statt sie auf null zu ziehen", () => {
    assert.deepEqual(spanne([5, 5]), { von: 4, bis: 6 });
  });

  it("rundet die Schrittweite auf eins, zwei oder fuenf mal eine Zehnerpotenz", () => {
    assert.equal(schrittweite(0, 10, 5), 2);
    assert.equal(schrittweite(0, 100, 5), 20);
    assert.equal(schrittweite(0, 1, 5), 0.2);
  });

  it("setzt die Marken auf die Schrittweite, nicht auf die Null", () => {
    assert.deepEqual(marken({ von: 0, bis: 10 }, 2), [0, 2, 4, 6, 8, 10]);
    assert.deepEqual(marken({ von: 1, bis: 9 }, 2), [2, 4, 6, 8]);
  });
});

// --- Zahlen im Bild ---------------------------------------------------------

describe("Zahlen im Bild", () => {
  it("schreibt ganze Zahlen ohne Nachkommastellen", () => {
    assert.equal(zahlText(4), "4");
    assert.equal(zahlText(0), "0");
  });

  it("schneidet eine lange Dezimalzahl ab, statt sie zu runden", () => {
    assert.equal(zahlText(10000 / 3000), "3.333333");
  });

  it("nennt Unendlich beim Namen -- es ist ein Ergebnis, kein Fehler", () => {
    assert.equal(zahlText(Infinity), "Infinity");
    assert.equal(zahlText(-Infinity), "-Infinity");
  });

  it("laesst eine Luecke als Luecke stehen", () => {
    assert.equal(zahlText(null), "—");
  });
});

// --- Das Bild ---------------------------------------------------------------

describe("Kurvenbild", () => {
  const flaeche = { titel: "Testkurve", unter: "Aus der Funktion selbst gerechnet." };

  it("traegt Titel, Achsen und die Kurve", () => {
    const bild = kurvenbild({ ...flaeche, proben: proben((x) => x * x, { von: 0, bis: 10, schritte: 10 }) });

    assert.match(bild, /^<svg /);
    assert.ok(bild.includes("Testkurve"), "der Titel steht im Bild");
    assert.match(bild, /<polyline /);
    assert.ok(!bild.includes("NaN"), "ein NaN im Bild waere kein Beleg");
    assert.ok(!bild.includes("undefined"), "ein undefined im Bild waere kein Beleg");
    assert.ok(bild.endsWith("</svg>\n"), "das Bild ist geschlossen");
  });

  it("laesst Luecken stehen, statt ueber sie hinweg zu verbinden", () => {
    const mitLuecke = kurvenbild({ ...flaeche, proben: proben((x) => 1 / x, { von: -2, bis: 2, schritte: 4 }) });
    const ohneLuecke = kurvenbild({ ...flaeche, proben: proben((x) => x, { von: -2, bis: 2, schritte: 4 }) });

    const striche = (bild) => (bild.match(/<polyline /g) ?? []).length;
    assert.equal(striche(mitLuecke), 2, "zwei Aestchen, kein Strich durch die Unendlichkeit");
    assert.equal(striche(ohneLuecke), 1);
  });

  it("schneidet an einer vorgegebenen Grenze ab, statt daneben zu zeichnen", () => {
    const bild = kurvenbild({
      ...flaeche,
      proben: proben((x) => x * 10, { von: 0, bis: 10, schritte: 10 }),
      ySpanne: { von: 0, bis: 25 },
      faelle: [{ x: 10, wert: 100 }],
    });

    assert.match(bild, />20<\/text>/, "die Marke 20 liegt noch im Bild");
    assert.ok(!/100/.test(bild), "was ausserhalb liegt, wird nicht gezeichnet");
  });

  it("nennt einen geworfenen Fehler beim Namen, statt ihn zu verschweigen", () => {
    const bild = kurvenbild({
      ...flaeche,
      proben: proben((x) => x, { von: 0, bis: 4, schritte: 4 }),
      faelle: [{ x: -1, wert: null, fehler: "RangeError" }],
    });

    assert.match(bild, /RangeError/);
  });

  it("schreibt die Herkunft ins Bild -- ein Beleg ohne Datum ist keiner", () => {
    const bild = kurvenbild({
      ...flaeche,
      proben: proben((x) => x, { von: 0, bis: 4, schritte: 4 }),
      herkunft: "src/rechenbasis.mjs#personentage",
    });

    assert.match(bild, /src\/rechenbasis\.mjs#personentage/);
  });
});

// --- Faelle -----------------------------------------------------------------

describe("Faelle neben der Kurve", () => {
  it("rechnet jeden Fall wirklich aus", () => {
    const faelle = faelleRechnen(aufrufer((i, x) => i / x, [10000]), [2500, 3000]);

    assert.deepEqual(faelle, [{ x: 2500, wert: 4 }, { x: 3000, wert: 10000 / 3000 }]);
  });

  it("haelt einen Fehler fest, statt den Lauf abzubrechen", () => {
    const faelle = faelleRechnen(
      aufrufer((investition, x) => {
        if (investition < 0) throw new RangeError("negative Investition");
        return x;
      }, [-1]),
      [2500],
    );

    assert.equal(faelle[0].wert, null);
    assert.equal(faelle[0].fehler, "RangeError");
  });
});

// --- Von der Kommandozeile ins Journal --------------------------------------

/** Das Beispielmodul, an dem Test und Beleg rechnen -- eine echte Datei, kein Temp. */
const BEISPIEL = join(WURZEL, "tests", "belegbild-beispiel.mjs");

function rufe(...argumente) {
  return spawnSync(process.execPath, [join(WURZEL, "tools", "belegbild.mjs"), ...argumente], {
    cwd: WURZEL,
    encoding: "utf8",
  });
}

describe("Belegbild von der Kommandozeile", () => {
  it("rendert aus dem Modul und was daraus wird, nimmt der Abschluss an", () => {
    const vorgang = ordner("belegbild-vorgang");
    const ziel = join(vorgang, "kurve.svg");

    try {
      const lauf = rufe(
        ziel,
        `--modul=${BEISPIEL}`,
        "--funktion=amortisationsdauer",
        "--argument=10000",
        "--von=1000",
        "--bis=5000",
        "--schritte=8",
        "--fall=2500",
        "--fall=0",
        "--titel=Amortisationsdauer",
      );

      assert.equal(lauf.status, 0, lauf.stderr);
      assert.ok(existsSync(ziel), "das Bild liegt auf der Platte");

      const bild = readFileSync(ziel, "utf8");
      assert.match(bild, /^<svg /);
      assert.match(bild, /Amortisationsdauer/);
      assert.ok(bild.includes("amortisationsdauer(10000, 2500)"), "der Fall steht mit seinen Argumenten im Bild");
      assert.ok(bild.includes(">4</text>"), "der gerechnete Wert steht im Bild");
      assert.ok(bild.includes("Infinity"), "ein Grenzfall ohne Rueckfluss wird als Infinity ausgewiesen");
      assert.ok(!bild.includes("NaN"), "kein NaN im Bild");
      assert.match(lauf.stdout, /kurve\.svg/, "der Aufruf nennt das geschriebene Bild");

      // Seit Change 02-bildbeleg-sichtbar (#909) ist die Kurve ein Artefakt, aber kein
      // Bildbeleg: den Abschluss traegt nur ein PNG aus der Prozessschmiede.
      const zeile = einliefern(vorgang, "nachher", ziel);
      assert.equal(zeile.art, "graph");
      assert.equal(zeile.fehlt, false);
      const lage = belegLage(liesJournal(vorgang));
      assert.equal(lage.sichtbar, false, "ein SVG allein traegt den Abschluss nicht");
      assert.match(lage.meldung, /prozessschmiede/i);
    } finally {
      rmSync(vorgang, { recursive: true, force: true });
    }
  });

  it("bricht ab, statt ein leeres Bild zu schreiben", () => {
    const leer = ordner("belegbild-leer");

    try {
      const ohneModul = rufe(join(leer, "a.svg"), "--funktion=amortisationsdauer", "--von=1", "--bis=2");
      assert.notEqual(ohneModul.status, 0);
      assert.match(ohneModul.stderr, /--modul/);
      assert.ok(!existsSync(join(leer, "a.svg")), "ohne Modul entsteht kein Bild");

      const falscheFunktion = rufe(
        join(leer, "b.svg"),
        `--modul=${BEISPIEL}`,
        "--funktion=gibtesnicht",
        "--von=1",
        "--bis=2",
      );
      assert.notEqual(falscheFunktion.status, 0);
      assert.match(falscheFunktion.stderr, /gibtesnicht/);
      assert.ok(!existsSync(join(leer, "b.svg")), "ohne Funktion entsteht kein Bild");
    } finally {
      rmSync(leer, { recursive: true, force: true });
    }
  });
});
