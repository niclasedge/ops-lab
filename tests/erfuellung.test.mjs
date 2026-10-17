// Der Erfuellungsgrad eines Laufs -- eine Liste, keine Einschaetzung.
//
// Sieben Kriterien, jedes einzeln ausgewiesen. Eine Punktzahl waere handlicher,
// verdeckt aber, welches Kriterium gefallen ist; ein fehlender Beleg und ein
// nicht gemergter Pull Request sind verschiedene Zustaende.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { bewerte, zugesagteDateien } from "../tools/erfuellung.mjs";

const VOLLSTAENDIG = {
  gate1: true,
  gate2: true,
  fertig: true,
  belege: [{ stufe: "nachher", art: "bild", fehlt: false, quelle: "prozessschmiede" }],
  tasksText: "- [x] eins\n- [x] zwei\n",
  zugesagt: ["src/amortisation.mjs", "tests/amortisation.test.mjs"],
  geaendert: ["src/amortisation.mjs", "tests/amortisation.test.mjs"],
  testsGruen: true,
  prGestellt: true,
  gemergt: true,
};

const lage = (felder) => ({ ...VOLLSTAENDIG, ...felder });
const kriterium = (ergebnis, id) => ergebnis.kriterien.find((k) => k.id === id);

describe("Beruehrte Dateien aus dem Vorschlag lesen", () => {
  it("nimmt die Pfade aus dem Abschnitt, nicht aus dem ganzen Text", () => {
    const text = `# beispiel

## Warum

Wir fassen \`tools/gate.mjs\` heute nicht an.

## Beruehrte Dateien

- \`src/amortisation.mjs\`
- \`tests/amortisation.test.mjs\`
`;
    assert.deepEqual(zugesagteDateien(text), ["src/amortisation.mjs", "tests/amortisation.test.mjs"]);
  });

  it("gibt eine leere Liste, wenn der Abschnitt fehlt", () => {
    assert.deepEqual(zugesagteDateien("# beispiel\n\n## Warum\n\nNichts.\n"), []);
  });
});

describe("Die sieben Kriterien", () => {
  it("weist bei einem vollstaendigen Lauf alle sieben als erfuellt aus", () => {
    const e = bewerte(lage());
    assert.equal(e.kriterien.length, 7);
    assert.equal(e.erfuellt, 7);
    assert.ok(e.kriterien.every((k) => k.erfuellt), "ein Kriterium fiel ohne Grund");
  });

  it("nennt jedes Kriterium einzeln statt einer Punktzahl", () => {
    const e = bewerte(lage());
    assert.deepEqual(
      e.kriterien.map((k) => k.id).sort(),
      ["aufgaben", "beleg", "dateien", "gates", "merge", "pr", "tests"],
    );
  });
});

describe("Ein Lauf ohne Beleg", () => {
  // Der haeufigste unvollstaendige Lauf: alles gruen, nur nichts zu sehen.
  const ergebnis = bewerte(lage({ belege: [] }));

  it("weist das Beleg-Kriterium als nicht erfuellt aus", () => {
    assert.equal(kriterium(ergebnis, "beleg").erfuellt, false);
    assert.match(kriterium(ergebnis, "beleg").meldung, /kein Beleg/i);
  });

  it("laesst die uebrigen Kriterien unberuehrt", () => {
    const uebrige = ergebnis.kriterien.filter((k) => k.id !== "beleg");
    assert.ok(uebrige.every((k) => k.erfuellt), "ein anderes Kriterium fiel mit");
    assert.equal(ergebnis.erfuellt, 6);
  });

  it("zaehlt einen Beleg aus Befehl und Ausgabe nicht als sichtbar", () => {
    const e = bewerte(lage({ belege: [{ stufe: "nachher", art: "befehl", fehlt: false }] }));
    assert.equal(kriterium(e, "beleg").erfuellt, false);
  });
});

describe("Eine Datei ausserhalb der Zusage", () => {
  const ergebnis = bewerte(
    lage({
      zugesagt: ["src/amortisation.mjs", "tests/amortisation.test.mjs", "justfile"],
      geaendert: ["src/amortisation.mjs", "tests/amortisation.test.mjs", "justfile", "tools/gate.mjs"],
    }),
  );

  it("weist das Kriterium fuer die beruehrten Dateien als nicht erfuellt aus", () => {
    assert.equal(kriterium(ergebnis, "dateien").erfuellt, false);
  });

  it("nennt die Datei, die nicht zugesagt war", () => {
    assert.match(kriterium(ergebnis, "dateien").meldung, /tools\/gate\.mjs/);
  });

  it("stoert sich nicht daran, dass eine zugesagte Datei unberuehrt blieb", () => {
    const e = bewerte(lage({ zugesagt: ["a.mjs", "b.mjs"], geaendert: ["a.mjs"] }));
    assert.equal(kriterium(e, "dateien").erfuellt, true);
  });

  // Der Change-Ordner und die Spec-Ablage entstehen durch den Ablauf selbst.
  // Zaehlten sie mit, fiele das Kriterium bei jedem Lauf -- eine Messung, die
  // immer dasselbe sagt, misst nichts. Am ersten Probelauf aufgefallen.
  it("zaehlt die Artefakte des Ablaufs nicht als unzugesagte Dateien", () => {
    const e = bewerte(
      lage({
        zugesagt: ["src/amortisation.mjs"],
        geaendert: [
          "src/amortisation.mjs",
          "openspec/changes/amortisation/proposal.md",
          "openspec/changes/amortisation/gate1.md",
          "openspec/changes/amortisation/specs/rechner/spec.md",
          "openspec/changes/archive/2026-09-20-amortisation/fertig.md",
          "openspec/specs/rechner/spec.md",
        ],
      }),
    );
    assert.equal(kriterium(e, "dateien").erfuellt, true, kriterium(e, "dateien").meldung);
  });

  it("uebersieht daneben keine echte Ueberschreitung", () => {
    const e = bewerte(
      lage({
        zugesagt: ["src/amortisation.mjs"],
        geaendert: ["src/amortisation.mjs", "openspec/changes/amortisation/tasks.md", "tools/gate.mjs"],
      }),
    );
    assert.equal(kriterium(e, "dateien").erfuellt, false);
    assert.match(kriterium(e, "dateien").meldung, /tools\/gate\.mjs/);
    assert.doesNotMatch(kriterium(e, "dateien").meldung, /tasks\.md/);
  });
});

describe("Die uebrigen Kriterien fallen einzeln", () => {
  it("faellt bei einer offenen Aufgabe", () => {
    const e = bewerte(lage({ tasksText: "- [x] eins\n- [ ] zwei\n" }));
    assert.equal(kriterium(e, "aufgaben").erfuellt, false);
    assert.equal(e.erfuellt, 6);
  });

  it("faellt, wenn ein Gate-Nachweis fehlt", () => {
    const e = bewerte(lage({ gate2: false }));
    assert.equal(kriterium(e, "gates").erfuellt, false);
    assert.match(kriterium(e, "gates").meldung, /gate2/i);
  });

  it("unterscheidet einen nicht gestellten von einem nicht gemergten Pull Request", () => {
    const ohnePr = bewerte(lage({ prGestellt: false, gemergt: false }));
    assert.equal(kriterium(ohnePr, "pr").erfuellt, false);
    assert.equal(kriterium(ohnePr, "merge").erfuellt, false);

    const offen = bewerte(lage({ gemergt: false }));
    assert.equal(kriterium(offen, "pr").erfuellt, true);
    assert.equal(kriterium(offen, "merge").erfuellt, false);
  });

  it("faellt bei rotem Testlauf", () => {
    assert.equal(kriterium(bewerte(lage({ testsGruen: false })), "tests").erfuellt, false);
  });
});
