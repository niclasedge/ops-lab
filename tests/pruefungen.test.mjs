import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  aufgaben,
  belegLage,
  dateiAbgleich,
  istSichtbar,
  journalLage,
  nurAngehaengt,
  platzhalter,
  proposalAbschnitte,
  specGeruest,
  tapFehler,
  zugesagteDateien,
  zugesagteTests,
} from "../tools/pruefungen.mjs";

describe("Platzhalter der Vorlage werden erkannt", () => {
  it("findet den Anleitungskommentar", () => {
    const treffer = platzhalter("## Warum\n\n<!-- Fuenf bis zehn Saetze: welcher Bedarf. -->\n");
    assert.equal(treffer.length, 1);
    assert.match(treffer[0], /Anleitungskommentar/);
  });

  it("findet spitze Klammern um Fliesstext", () => {
    const treffer = platzhalter("### Requirement: <Kurzname der Regel>\n");
    assert.equal(treffer.length, 1);
    assert.match(treffer[0], /Kurzname der Regel/);
  });

  it("meldet einen gefuellten Text als sauber", () => {
    const text = [
      "## Warum",
      "",
      "Die Wirtschaftlichkeit einer Massnahme wird heute in einer Tabelle geschaetzt.",
      "",
      "## Was aendert sich",
      "",
      "Der Rechner weist das Einsparpotenzial in Euro und Personentagen aus.",
    ].join("\n");
    assert.deepEqual(platzhalter(text), []);
  });

  it("haelt HTML-Tags und Vergleiche nicht faelschlich fuer Platzhalter", () => {
    assert.deepEqual(platzhalter("Der Wert ist <b>fett</b> und a<b gilt.\n"), []);
    assert.deepEqual(platzhalter("Amortisation < 24 Monate.\n"), []);
  });
});

describe("Zugesagte Testdateien", () => {
  it("liest die Pfade aus den Backticks", () => {
    const text = "- [ ] Test `tests/nutzen.test.mjs` schreiben\n- [ ] auch `tests/rechenbasis.test.mjs`\n";
    assert.deepEqual(zugesagteTests(text), ["tests/nutzen.test.mjs", "tests/rechenbasis.test.mjs"]);
  });

  it("nennt jede Datei nur einmal", () => {
    const text = "`tests/a.test.mjs` und nochmal `tests/a.test.mjs`";
    assert.deepEqual(zugesagteTests(text), ["tests/a.test.mjs"]);
  });

  it("ignoriert Pfade ausserhalb von tests/", () => {
    assert.deepEqual(zugesagteTests("`src/nutzen.mjs` und `nutzen.test.mjs`"), []);
  });
});

describe("Aufgaben in tasks.md", () => {
  it("zaehlt erledigte und offene Kaestchen", () => {
    const text = "- [x] eins\n- [ ] zwei\n  - [X] drei\n";
    assert.deepEqual(aufgaben(text), { gesamt: 3, offen: 1 });
  });

  it("zaehlt eine Datei ohne Kaestchen als leer", () => {
    assert.deepEqual(aufgaben("# Aufgaben\n\nnoch nichts\n"), { gesamt: 0, offen: 0 });
  });
});

describe("Geruest der Delta-Spec", () => {
  it("zaehlt Delta-Bloecke, Requirements und Szenarien", () => {
    const text = [
      "## ADDED Requirements",
      "### Requirement: Einsparpotenzial",
      "Das System SHALL das Einsparpotenzial ausweisen.",
      "#### Scenario: Mit Stundensatz",
      "#### Scenario: Ohne Stundensatz",
    ].join("\n");
    assert.deepEqual(specGeruest(text), { requirements: 1, szenarien: 2, deltaBloecke: 1 });
  });

  it("erkennt ein Requirement ohne Szenario", () => {
    const geruest = specGeruest("## MODIFIED Requirements\n### Requirement: X\n");
    assert.equal(geruest.requirements, 1);
    assert.equal(geruest.szenarien, 0);
  });
});

describe("TAP-Auswertung", () => {
  it("liest die Zusammenfassung", () => {
    assert.equal(tapFehler("ok 1 a\nnot ok 2 b\n1..2\n# pass 1\n# fail 1\n"), 1);
  });

  it("zaehlt ersatzweise die Zeilen", () => {
    assert.equal(tapFehler("not ok 1 a\nnot ok 2 b\n"), 2);
  });

  it("meldet einen gruenen Lauf als null", () => {
    assert.equal(tapFehler("ok 1 a\n1..1\n# pass 1\n# fail 0\n"), 0);
  });
});

describe("Abschnitte in proposal.md", () => {
  it("findet alle vier Pflichtabschnitte", () => {
    const text = "## Warum\n## Was aendert sich\n## Was ausdruecklich nicht\n## Beruehrte Dateien\n";
    assert.deepEqual(proposalAbschnitte(text), {
      warum: true, aenderung: true, abgrenzung: true, dateien: true,
    });
  });

  it("akzeptiert die Umlautschreibung", () => {
    const text = "## Warum\n## Was ändert sich\n## Was ausdrücklich nicht\n## Berührte Dateien\n";
    assert.deepEqual(proposalAbschnitte(text), {
      warum: true, aenderung: true, abgrenzung: true, dateien: true,
    });
  });

  it("meldet einen fehlenden Abschnitt", () => {
    assert.equal(proposalAbschnitte("## Warum\n").dateien, false);
  });
});

// --- Die Zusage aus dem Vorschlag -------------------------------------------
//
// "Beruehrte Dateien" ist die Zusage, auf der der Parallelbetrieb ruht. Gelesen
// wird sie aus den Listeneintraegen dieses einen Abschnitts: im Warum stehen oft
// Dateien, die der Change gerade nicht anfasst, und unter der Liste steht in
// mehreren Vorschlaegen ein Satz "Nicht beruehrt: ..." -- beides zaehlte sonst
// als Zusage mit und stellte die Aussage auf den Kopf.

describe("Die Zusage aus dem Abschnitt Beruehrte Dateien", () => {
  const VORSCHLAG = `# beispiel

## Warum

Wir fassen \`tools/gate.mjs\` heute nicht an.

## Beruehrte Dateien

- \`tools/abgleich.mjs\` — neu
- \`docs/abgleich.dot\` und \`docs/abgleich.svg\` — neu: der Weg eines Abgleichs durch
  dieses Repo, dazu \`tests/abgleich.test.mjs\`

Nicht beruehrt: \`ops.py\`, \`tools/neu.mjs\`.

## Naechster Abschnitt

Hier steht \`tools/sync.mjs\`.
`;

  it("liest die Pfade aus den Listeneintraegen des Abschnitts", () => {
    assert.deepEqual(zugesagteDateien(VORSCHLAG), [
      "tools/abgleich.mjs",
      "docs/abgleich.dot",
      "docs/abgleich.svg",
      "tests/abgleich.test.mjs",
    ]);
  });

  it("nimmt nichts aus einem anderen Abschnitt", () => {
    const zusage = zugesagteDateien(VORSCHLAG);
    assert.ok(!zusage.includes("tools/gate.mjs"), "das Warum zaehlt als Zusage mit");
    assert.ok(!zusage.includes("tools/sync.mjs"), "der naechste Abschnitt zaehlt als Zusage mit");
  });

  it("zaehlt die Prosa unter der Liste nicht mit", () => {
    // "Nicht beruehrt: `ops.py`" ist das Gegenteil einer Zusage.
    assert.ok(!zugesagteDateien(VORSCHLAG).includes("ops.py"), "'Nicht beruehrt' zaehlt als Zusage mit");
  });

  it("nennt jeden Pfad nur einmal", () => {
    const text = "## Beruehrte Dateien\n\n- `a.mjs`\n- `a.mjs` und `b.mjs`\n";
    assert.deepEqual(zugesagteDateien(text), ["a.mjs", "b.mjs"]);
  });

  it("akzeptiert die Umlautschreibung der Ueberschrift", () => {
    assert.deepEqual(zugesagteDateien("## Berührte Dateien\n\n- `ops.py`\n"), ["ops.py"]);
  });

  it("gibt eine leere Zusage, wenn der Abschnitt fehlt", () => {
    assert.deepEqual(zugesagteDateien("# beispiel\n\n## Warum\n\nNichts.\n"), []);
  });

  it("haelt einen Aufruf in Backticks nicht fuer einen Pfad", () => {
    // In den Erlaeuterungen der Liste stehen Aufrufe: `--web --trocken`, `just web`.
    // Ein Pfad traegt kein Leerzeichen, und keiner faengt mit einem Strich an.
    // Ein einzelnes Wort wie `web` bleibt drin: es ist von `justfile` textlich
    // nicht zu unterscheiden. Es taucht dann als unberuehrte Zusage auf -- eine
    // Zeile im Bericht, kein falsches Urteil ueber den Diff.
    const text = "## Beruehrte Dateien\n\n- `ops.py` — die Ansicht hinter `--web --trocken`\n- `justfile` — Ziel `web`, aufgerufen als `just web`\n";
    assert.deepEqual(zugesagteDateien(text), ["ops.py", "justfile", "web"]);
  });
});

// --- Zusage gegen Diff ------------------------------------------------------
//
// Zwei Richtungen, die auseinandergehalten werden muessen: angefasst ohne Zusage
// ist ein Risiko fuer den Parallelbetrieb, zugesagt ohne Anfassen ein Hinweis auf
// einen verschobenen Zuschnitt. Wer sie zusammenfasst, verliert die Diagnose.

describe("Abgleich von Zusage und Diff", () => {
  it("weist eine Datei ohne Zusage als Zusatz aus", () => {
    const befund = dateiAbgleich(["tools/abgleich.mjs"], ["tools/abgleich.mjs", "tools/gate.mjs"]);
    assert.deepEqual(befund.zusatz, ["tools/gate.mjs"]);
    assert.deepEqual(befund.auslassung, []);
    assert.equal(befund.deckungsgleich, false);
  });

  it("weist eine unberuehrte Zusage als Auslassung aus", () => {
    const befund = dateiAbgleich(["tools/abgleich.mjs", "docs/abgleich.svg"], ["tools/abgleich.mjs"]);
    assert.deepEqual(befund.auslassung, ["docs/abgleich.svg"]);
    assert.deepEqual(befund.zusatz, []);
    assert.equal(befund.deckungsgleich, false);
  });

  it("meldet Deckungsgleichheit als eigenen Befund", () => {
    const dateien = ["tools/abgleich.mjs", "tests/abgleich.test.mjs"];
    const befund = dateiAbgleich(dateien, [...dateien].reverse());
    assert.deepEqual(befund.zusatz, []);
    assert.deepEqual(befund.auslassung, []);
    assert.equal(befund.deckungsgleich, true);
  });

  it("haelt beide Richtungen auseinander, wenn beide auftreten", () => {
    const befund = dateiAbgleich(["a.mjs", "b.mjs"], ["a.mjs", "c.mjs"]);
    assert.deepEqual(befund.zusatz, ["c.mjs"]);
    assert.deepEqual(befund.auslassung, ["b.mjs"]);
  });

  it("loest eine Zusage auf einen Ordner auf", () => {
    // `openspec/changes/diff-reviewer/` sagt den ganzen Ordner zu; jede Datei
    // darunter einzeln aufzuzaehlen waere eine Liste, die niemand pflegt.
    const befund = dateiAbgleich(
      ["openspec/changes/diff-reviewer/"],
      ["openspec/changes/diff-reviewer/tasks.md", "openspec/changes/diff-reviewer/gate1.md"],
    );
    assert.deepEqual(befund.zusatz, []);
    assert.deepEqual(befund.auslassung, []);
    assert.equal(befund.deckungsgleich, true);
  });

  it("zaehlt die Artefakte des Ablaufs nicht als Zusatz", () => {
    // Change-Ordner und Spec-Ablage fallen in jedem Lauf an. Zaehlten sie mit,
    // faende der Abgleich in jedem Lauf einen Befund und nie einen echten.
    const befund = dateiAbgleich(
      ["tools/abgleich.mjs"],
      [
        "tools/abgleich.mjs",
        "openspec/changes/diff-reviewer/gate1.md",
        "openspec/specs/abgleich/spec.md",
        "openspec/changes/archive/2026-09-20-diff-reviewer/fertig.md",
      ],
    );
    assert.deepEqual(befund.zusatz, []);
  });

  it("uebersieht daneben keinen echten Zusatz", () => {
    const befund = dateiAbgleich(
      ["tools/abgleich.mjs"],
      ["tools/abgleich.mjs", "openspec/changes/diff-reviewer/tasks.md", "tools/gate.mjs"],
    );
    assert.deepEqual(befund.zusatz, ["tools/gate.mjs"]);
  });

  it("loest eine Zusage auch durch ein Ablaufartefakt ein", () => {
    // Die Artefakte zaehlen nicht als Zusatz -- eine Zusage auf ihren Ordner
    // duerfen sie trotzdem einloesen, sonst stuende sie in jedem Lauf als
    // Auslassung da.
    const befund = dateiAbgleich(
      ["openspec/changes/diff-reviewer/"],
      ["openspec/changes/diff-reviewer/proposal.md"],
    );
    assert.deepEqual(befund.auslassung, []);
  });

  it("meldet einen leeren Diff gegen eine leere Zusage als deckungsgleich", () => {
    assert.equal(dateiAbgleich([], []).deckungsgleich, true);
  });
});

// --- Belegzeilen ------------------------------------------------------------
//
// Diese Regeln lesen nur das Journal. Ob die Datei hinter dem Pfad noch da ist,
// steht hier nicht zur Debatte: das Urteil fiel beim Einliefern und steht als
// Merkmal in der Zeile (design.md, "Wann faellt das Urteil ueber einen Beleg").

/** Eine Journalzeile, wie tools/beleg.mjs sie schreibt. */
function belegzeile(abweichung = {}) {
  return {
    zeit: "2026-09-20T09:00:00.000Z",
    stufe: "nachher",
    art: "bild",
    pfad: "belege/assets/0-ansicht.png",
    fehlt: false,
    grund: "",
    quelle: "prozessschmiede",
    ...abweichung,
  };
}

describe("Sichtbarkeit einer Belegzeile", () => {
  it("haelt ein vorhandenes Bild fuer sichtbar", () => {
    assert.equal(istSichtbar(belegzeile()), true);
  });

  // Change 02-bildbeleg-sichtbar (#909): ein SVG liegt in artefacts/ und erscheint in keiner
  // Ansicht; sichtbar ist nur ein PNG aus der Prozessschmiede.
  it("haelt ein Graph-Artefakt nicht mehr fuer sichtbar", () => {
    assert.equal(istSichtbar(belegzeile({ art: "graph", pfad: "belege/artefacts/0-pfad.svg", quelle: "" })), false);
  });

  it("haelt ein Bild ohne Prozessschmiede-Herkunft nicht fuer sichtbar", () => {
    assert.equal(istSichtbar(belegzeile({ quelle: "" })), false);
    assert.equal(istSichtbar(belegzeile({ quelle: undefined })), false);
  });

  it("haelt Befehl und Ausgabe nicht fuer sichtbar", () => {
    assert.equal(istSichtbar(belegzeile({ art: "ausgabe", pfad: "belege/artefacts/0-lauf.log" })), false);
  });

  it("haelt einen als fehlend vermerkten Beleg nicht fuer sichtbar", () => {
    assert.equal(istSichtbar(belegzeile({ fehlt: true, pfad: "", grund: "Quelldatei nicht gefunden" })), false);
  });
});

describe("Urteil des Abschlusses ueber die Belege eines Vorgangs", () => {
  it("laesst einen sichtbaren Beleg der Stufe nachher durch", () => {
    assert.equal(belegLage([belegzeile()]).sichtbar, true);
  });

  it("zaehlt einen Beleg der Stufe vorher nicht mit", () => {
    const lage = belegLage([belegzeile({ stufe: "vorher" })]);
    assert.equal(lage.sichtbar, false);
    assert.match(lage.meldung, /kein Beleg/i);
  });

  it("unterscheidet den gar nicht eingelieferten vom unlesbaren Beleg", () => {
    const keiner = belegLage([]);
    const unlesbar = belegLage([belegzeile({ fehlt: true, pfad: "", grund: "Datei ist leer" })]);

    assert.equal(keiner.sichtbar, false);
    assert.equal(unlesbar.sichtbar, false);
    assert.notEqual(keiner.meldung, unlesbar.meldung);
  });

  it("nennt den beim Einliefern gespeicherten Grund", () => {
    const lage = belegLage([belegzeile({ fehlt: true, pfad: "", grund: "groesser als die Grenze" })]);
    assert.match(lage.meldung, /groesser als die Grenze/);
  });

  it("meldet bei Befehl und Ausgabe, dass nichts Sichtbares vorliegt", () => {
    const lage = belegLage([belegzeile({ art: "ausgabe", pfad: "belege/artefacts/0-lauf.log" })]);
    assert.equal(lage.sichtbar, false);
    assert.match(lage.meldung, /nichts Sichtbares/i);
  });

  it("nennt bei einem SVG allein die Prozessschmiede", () => {
    const lage = belegLage([belegzeile({ art: "graph", pfad: "belege/artefacts/0-pfad.svg", quelle: "" })]);
    assert.equal(lage.sichtbar, false);
    assert.match(lage.meldung, /prozessschmiede/i);
  });

  it("nennt bei einem Bild ohne Herkunft die Prozessschmiede und den Grund", () => {
    const lage = belegLage([belegzeile({ quelle: "", grund: "prozess.png ist aelter als prozess.yaml" })]);
    assert.equal(lage.sichtbar, false);
    assert.match(lage.meldung, /prozessschmiede/i);
    assert.match(lage.meldung, /aelter als/);
  });

  it("genuegt ein sichtbarer Beleg neben fehlgeschlagenen", () => {
    const lage = belegLage([belegzeile({ fehlt: true, pfad: "", grund: "weg" }), belegzeile()]);
    assert.equal(lage.sichtbar, true);
  });
});

describe("Das Belegjournal wird von git getragen (F-6)", () => {
  it("scheitert, wenn git das Journal ausschliesst", () => {
    const lage = journalLage({ ignoriert: true });
    assert.equal(lage.getragen, false);
    assert.match(lage.meldung, /\.gitignore/);
  });

  it("besteht, wenn das Journal nicht ausgeschlossen ist", () => {
    assert.equal(journalLage({ ignoriert: false }).getragen, true);
  });
});

describe("Anhaenge-Regel am justfile", () => {
  // Eingabe ist die Ausgabe von 'git diff --numstat' fuer genau eine Datei:
  // Spalte 1 hinzugefuegte, Spalte 2 entfernte Zeilen, Spalte 3 der Pfad.

  it("besteht bei reinen Hinzufuegungen", () => {
    const ergebnis = nurAngehaengt("4\t0\tjustfile\n");
    assert.equal(ergebnis.bestanden, true);
    assert.equal(ergebnis.hinzu, 4);
    assert.equal(ergebnis.entfernt, 0);
  });

  it("faellt bei einer einzigen entfernten Zeile", () => {
    const ergebnis = nurAngehaengt("2\t1\tjustfile\n");
    assert.equal(ergebnis.bestanden, false);
    assert.equal(ergebnis.entfernt, 1);
  });

  it("besteht, wenn die Datei gar nicht angefasst wurde", () => {
    // Kein Diff heisst keine Ueberschneidung -- der haeufigste Fall.
    const ergebnis = nurAngehaengt("");
    assert.equal(ergebnis.bestanden, true);
    assert.equal(ergebnis.hinzu, 0);
    assert.equal(ergebnis.entfernt, 0);
  });

  it("wertet eine Binaeraenderung als nicht bestanden", () => {
    // git schreibt '-' statt Zahlen. Was sich nicht zeilenweise vergleichen
    // laesst, kann auch nicht als reine Anhaengung gelten.
    const ergebnis = nurAngehaengt("-\t-\tjustfile\n");
    assert.equal(ergebnis.bestanden, false);
  });

  it("summiert mehrere Zeilen, falls git sie getrennt ausweist", () => {
    const ergebnis = nurAngehaengt("3\t0\tjustfile\n2\t0\tjustfile\n");
    assert.equal(ergebnis.hinzu, 5);
    assert.equal(ergebnis.bestanden, true);
  });
});
