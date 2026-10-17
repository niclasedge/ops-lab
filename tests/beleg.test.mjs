// Das Einliefern eines Belegs.
//
// Die sechs Szenarien der Delta-Spec `beleg`, in derselben Reihenfolge. Jeder
// Test arbeitet in einem eigenen Ordner unter dem Temporaerverzeichnis: das
// Modul schreibt auf die Platte, und ein Test, der sich den Ordner mit einem
// anderen teilt, prueft am Ende die Reihenfolge statt das Verhalten.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { einliefern, liesJournal, UnbekannteStufe } from "../tools/beleg.mjs";

// --- Factories --------------------------------------------------------------

/** Ein Vorgangsordner, wie ihn das Modul erwartet: leer, ohne OpenSpec-Bezug. */
function vorgang() {
  return mkdtempSync(join(tmpdir(), "beleg-vorgang-"));
}

const PNG_KOPF = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Eine Datei mit PNG-Signatur. Der Inhalt dahinter spielt keine Rolle: das
 *  Modul fragt nach den ersten Bytes, nicht nach Dekodierbarkeit. */
function bilddatei(ordner, name = "ansicht.png") {
  const pfad = join(ordner, name);
  writeFileSync(pfad, Buffer.concat([PNG_KOPF, Buffer.alloc(64, 7)]));
  return pfad;
}

/** Eine Textdatei, wie sie aus Befehl und Ausgabe entsteht. */
function ausgabedatei(ordner, name = "lauf.log") {
  const pfad = join(ordner, name);
  writeFileSync(pfad, "$ just test\nℹ pass 24\nℹ fail 0\n", "utf8");
  return pfad;
}

function aufraeumen(...ordner) {
  for (const o of ordner) rmSync(o, { recursive: true, force: true });
}

// --- Szenarien --------------------------------------------------------------

describe("Beleg einliefern", () => {
  it("nimmt ein Bild zur Stufe nachher an und nennt den Pfad der Kopie", () => {
    const ordner = vorgang();
    const quelle = bilddatei(ordner);
    try {
      const vorher = liesJournal(ordner).length;
      const zeile = einliefern(ordner, "nachher", quelle);

      assert.equal(liesJournal(ordner).length, vorher + 1);
      assert.equal(zeile.stufe, "nachher");
      assert.equal(zeile.fehlt, false);
      assert.match(zeile.pfad, /^belege\/assets\//);
      assert.ok(!zeile.pfad.includes(quelle), "die Zeile nennt die Kopie, nicht die Quelle");
      assert.ok(existsSync(join(ordner, zeile.pfad)), "die Kopie liegt im Vorgangsordner");
    } finally {
      aufraeumen(ordner);
    }
  });

  it("weist eine unbekannte Stufe zurueck, ohne das Journal zu veraendern", () => {
    const ordner = vorgang();
    const quelle = bilddatei(ordner);
    try {
      einliefern(ordner, "vorher", quelle);
      const vorher = liesJournal(ordner).length;

      assert.throws(() => einliefern(ordner, "zwischendurch", quelle), UnbekannteStufe);
      assert.equal(liesJournal(ordner).length, vorher, "das Journal bleibt unveraendert");
    } finally {
      aufraeumen(ordner);
    }
  });

  it("endet mit Exit ungleich null, wenn die Stufe unbekannt ist", () => {
    const ordner = vorgang();
    const quelle = bilddatei(ordner);
    try {
      assert.throws(
        () => execFileSync(process.execPath, ["tools/beleg.mjs", ordner, "zwischendurch", quelle], { stdio: "pipe" }),
        (fehler) => fehler.status !== 0,
      );
      assert.equal(liesJournal(ordner).length, 0);
    } finally {
      aufraeumen(ordner);
    }
  });

  it("vermerkt eine fehlende Quelldatei mit Grund im Klartext", () => {
    const ordner = vorgang();
    try {
      const zeile = einliefern(ordner, "nachher", join(ordner, "gibt-es-nicht.png"));

      assert.equal(zeile.fehlt, true);
      assert.ok(zeile.grund.length > 0, "die Zeile nennt einen Grund");
      assert.match(zeile.grund, /nicht/i);
      assert.equal(liesJournal(ordner).length, 1);
    } finally {
      aufraeumen(ordner);
    }
  });

  it("laesst einen abgelegten Beleg das Loeschen der Quelle ueberleben", () => {
    const ordner = vorgang();
    const quelle = bilddatei(ordner);
    try {
      einliefern(ordner, "nachher", quelle);
      rmSync(quelle);

      const [zeile] = liesJournal(ordner);
      assert.equal(zeile.fehlt, false, "das Urteil fiel beim Schreiben und bleibt stehen");
      assert.ok(existsSync(join(ordner, zeile.pfad)), "die Kopie ist unabhaengig von der Quelle");
    } finally {
      aufraeumen(ordner);
    }
  });

  it("schreibt ausschliesslich unterhalb von belege/, auch in einem fremden Ordner", () => {
    const ordner = vorgang();
    const quellordner = vorgang();
    const quelle = bilddatei(quellordner);
    try {
      einliefern(ordner, "nachher", quelle);

      assert.deepEqual(readdirSync(ordner), ["belege"]);
      assert.ok(existsSync(join(ordner, "belege", "belege.jsonl")));
      assert.equal(liesJournal(ordner).length, 1);
    } finally {
      aufraeumen(ordner, quellordner);
    }
  });

  it("legt einen Beleg aus Befehl und Ausgabe ab, aber nicht als Bild", () => {
    const ordner = vorgang();
    const quelle = ausgabedatei(ordner);
    try {
      const zeile = einliefern(ordner, "nachher", quelle);

      assert.equal(zeile.fehlt, false, "die Datei ist vorhanden und lesbar");
      assert.equal(zeile.art, "ausgabe");
      assert.ok(!zeile.pfad.startsWith("belege/assets/"), "nur Bilder liegen unter assets/");
    } finally {
      aufraeumen(ordner);
    }
  });
});

// --- Herkunft Prozessschmiede (Change 02-bildbeleg-sichtbar, #909) -----------

/** Ein Bau der Prozessschmiede: Beschreibung und PNG nebeneinander, das PNG
 *  `abstand` Sekunden nach der Beschreibung geschrieben (negativ = davor). */
function schmiedebau(ordner, stamm = "prozess", abstand = 10) {
  const beschreibung = join(ordner, `${stamm}.yaml`);
  writeFileSync(beschreibung, "titel: Ein Beleg zeigt den Stand nach dem Change\nelemente: []\n", "utf8");
  const bild = bilddatei(ordner, `${stamm}.png`);
  const t = Date.now() / 1000 - 100;
  utimesSync(beschreibung, t, t);
  utimesSync(bild, t + abstand, t + abstand);
  return { beschreibung, bild };
}

describe("Herkunft eines Bildbelegs", () => {
  it("vermerkt ein PNG mit frischer Beschreibung als Prozessschmiede und legt die Beschreibung ab", () => {
    const ordner = vorgang();
    const quelle = vorgang();
    try {
      const { bild } = schmiedebau(quelle);
      const zeile = einliefern(ordner, "nachher", bild);

      assert.equal(zeile.art, "bild");
      assert.equal(zeile.quelle, "prozessschmiede");
      assert.match(zeile.beschreibung, /^belege\/artefacts\/\d+-prozess\.yaml$/);
      assert.ok(existsSync(join(ordner, zeile.beschreibung)), "die Beschreibung liegt im Vorgang");
      assert.equal(liesJournal(ordner).at(-1).quelle, "prozessschmiede", "das Journal traegt die Herkunft");
    } finally {
      aufraeumen(ordner, quelle);
    }
  });

  it("erkennt auch einen Teilprozess (X.prozess.png neben X.prozess.yaml)", () => {
    const ordner = vorgang();
    const quelle = vorgang();
    try {
      const { bild } = schmiedebau(quelle, "kalkulation.prozess");
      assert.equal(einliefern(ordner, "nachher", bild).quelle, "prozessschmiede");
    } finally {
      aufraeumen(ordner, quelle);
    }
  });

  it("vermerkt ein PNG ohne Beschreibung ohne Herkunft", () => {
    const ordner = vorgang();
    const quelle = vorgang();
    try {
      const zeile = einliefern(ordner, "nachher", bilddatei(quelle, "screenshot.png"));
      assert.equal(zeile.art, "bild");
      assert.equal(zeile.quelle, "");
      assert.equal(zeile.fehlt, false);
    } finally {
      aufraeumen(ordner, quelle);
    }
  });

  it("vermerkt ein PNG, das aelter ist als seine Beschreibung, ohne Herkunft und nennt den Grund", () => {
    const ordner = vorgang();
    const quelle = vorgang();
    try {
      const { bild } = schmiedebau(quelle, "prozess", -10);
      const zeile = einliefern(ordner, "nachher", bild);
      assert.equal(zeile.quelle, "");
      assert.match(zeile.grund, /aelter/);
    } finally {
      aufraeumen(ordner, quelle);
    }
  });
});
