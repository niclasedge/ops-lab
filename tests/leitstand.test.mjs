// Der Leitstand und sein Arbeiter.
//
// Die fuenf Requirements der Delta-Spec `arbeitsraum`, in derselben Reihenfolge.
// Geprueft wird zweierlei: die Entscheidungen als reine Funktionen -- wer gleichzeitig
// beauftragt werden darf und wann gemergt werden darf -- und die beiden Beschreibungen
// selbst. Eine Agentenbeschreibung ist Text, und Text verrutscht: wer dem Arbeiter
// versehentlich das Werkzeug zum Starten weiterer Agenten gibt, baut sich eine Kette
// von Enkeln, die niemand mehr ueberblickt. Das faellt nur auf, wenn es jemand prueft.

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { auftraege, mergeErlaubt, schrittfolge, werkzeugsatz } from "../tools/leitstand.mjs";

const WURZEL = dirname(dirname(fileURLToPath(import.meta.url)));

const ARBEITER = readFileSync(join(WURZEL, ".claude", "agents", "change-arbeiter.md"), "utf8");
const SKILL = readFileSync(join(WURZEL, ".claude", "skills", "leitstand", "SKILL.md"), "utf8");

describe("Ein Arbeiter, ein Change, ein Arbeitsraum", () => {
  it("beauftragt zwei Changes ohne Ueberschneidung gleichzeitig", () => {
    const verteilt = auftraege(["a", "b"], []);
    assert.deepEqual(verteilt, [
      { kennung: "a", raum: "a" },
      { kennung: "b", raum: "b" },
    ]);
  });

  it("stellt den zweiten von zwei ueberschneidenden Changes zurueck", () => {
    const verteilt = auftraege(["a", "b", "c"], [["a", "b"]]);
    assert.deepEqual(verteilt.map((auftrag) => auftrag.kennung), ["a", "c"]);
  });

  it("gibt keinen Arbeitsraum zweimal aus", () => {
    const raeume = auftraege(["a", "b", "c"], []).map((auftrag) => auftrag.raum);
    assert.equal(new Set(raeume).size, raeume.length, "ein Arbeitsraum steht doppelt");
  });
});

describe("Der Arbeiter startet keine weiteren Arbeiter", () => {
  it("liest den Werkzeugsatz aus der Beschreibung", () => {
    const werkzeuge = werkzeugsatz(ARBEITER);
    assert.ok(werkzeuge.length > 0, "der Werkzeugsatz ist leer");
    assert.ok(werkzeuge.includes("Bash"), "der Arbeiter kann keine Rezepte aufrufen");
  });

  it("gibt dem Arbeiter kein Werkzeug zum Starten von Agenten", () => {
    const werkzeuge = werkzeugsatz(ARBEITER).map((name) => name.toLowerCase());
    for (const verboten of ["agent", "task"]) {
      assert.ok(!werkzeuge.includes(verboten),
        `der Arbeiter darf Agenten starten: ${verboten}`);
    }
  });

  it("laesst das Verteilen beim Leitstand", () => {
    assert.match(SKILL, /Agent/, "der Leitstand kann keine Arbeiter beauftragen");
  });
});

describe("Die Kette wird in fester Reihenfolge durchlaufen", () => {
  it("nennt die Rezepte in der Reihenfolge der Kette", () => {
    // `beleg` steht mit in der Kette: der Abschluss verlangt einen sichtbaren Nachweis
    // der Stufe nachher, und ohne ihn kommt `just fertig` nicht durch.
    assert.deepEqual(schrittfolge(ARBEITER),
      ["neu", "gate1", "gate2", "beleg", "fertig", "pr"]);
  });

  it("haelt an, wenn ein Gate nicht bestanden ist", () => {
    assert.match(ARBEITER, /halten Sie an/i,
      "die Beschreibung nennt die Halteregel nicht");
  });

  it("verbietet die Umsetzung vor dem bestaetigten roten Lauf", () => {
    assert.match(ARBEITER, /rot/i, "die Beschreibung nennt den roten Lauf nicht");
  });
});

describe("Merge nur bei vollstaendigem Nachweis", () => {
  it("erlaubt den Merge bei drei Nachweisen, Bildbeleg und gruenem Pull Request", () => {
    const urteil = mergeErlaubt({ gate1: true, gate2: true, fertig: true, pruefungen: "gruen", bild: true });
    assert.equal(urteil.erlaubt, true, urteil.grund);
  });

  it("verweigert den Merge, wenn ein Nachweis fehlt", () => {
    const urteil = mergeErlaubt({ gate1: true, gate2: true, fertig: false, pruefungen: "gruen" });
    assert.equal(urteil.erlaubt, false);
    assert.match(urteil.grund, /fertig\.md/);
  });

  it("verweigert den Merge, wenn der Pull Request nicht gruen ist", () => {
    const urteil = mergeErlaubt({ gate1: true, gate2: true, fertig: true, pruefungen: "rot" });
    assert.equal(urteil.erlaubt, false);
    assert.match(urteil.grund, /Pr(ue|ü)fung/i);
  });

  it("verweigert den Merge, solange der Zustand des Pull Requests unbekannt ist", () => {
    // Kein Urteil ist kein gutes Urteil: `gh` meldet auch dann nichts, wenn es gar nicht
    // erst gefragt hat. Wer das als gruen liest, merged auf Verdacht.
    const urteil = mergeErlaubt({ gate1: true, gate2: true, fertig: true, pruefungen: "" });
    assert.equal(urteil.erlaubt, false);
  });
});

describe("Der Arbeiter mergt nicht", () => {
  it("nennt in seiner Beschreibung keinen Merge-Befehl", () => {
    assert.ok(!/just merge|gh pr merge/.test(ARBEITER),
      "die Beschreibung des Arbeiters nennt einen Merge-Befehl");
  });

  it("endet beim Pull Request", () => {
    assert.equal(schrittfolge(ARBEITER).at(-1), "pr");
  });

  it("behaelt den Merge dem Leitstand vor", () => {
    assert.match(SKILL, /just merge|gh pr merge/,
      "der Leitstand kennt keinen Merge-Befehl");
  });
});
