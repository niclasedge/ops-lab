// Der Arbeitsstand im Nachweis.
//
// Befund aus dem ersten Durchlauf: gate1.md, gate2.md und fertig.md nannten alle
// denselben Commit -- den Stand vor der Arbeit, weil die Gates vor dem Commit
// laufen. Damit war der rote Stand von Gate 2 nicht vom gruenen Stand des
// Abschlusses zu unterscheiden, und kein Nachweis sagte, welcher Code geprueft
// wurde.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { arbeitsstand } from "../tools/nachweis.mjs";

describe("Arbeitsstand eines Nachweises", () => {
  it("nennt den Commit, wenn nichts Uncommittetes vorliegt", () => {
    assert.equal(arbeitsstand("abc1234567890", ""), "abc1234 (nichts Uncommittetes)");
  });

  it("haengt eine Marke des Arbeitsbaums an, wenn es Aenderungen gibt", () => {
    const marke = arbeitsstand("abc1234567890", "diff --git a/src/x.mjs ...");
    assert.match(marke, /^abc1234\+[0-9a-f]{12}$/);
  });

  it("unterscheidet den roten vom gruenen Stand — das war der ganze Befund", () => {
    const rot = arbeitsstand("abc1234567890", "nur der Test");
    const gruen = arbeitsstand("abc1234567890", "der Test und die Umsetzung");
    assert.notEqual(rot, gruen);
  });

  it("liefert fuer denselben Stand dieselbe Marke", () => {
    assert.equal(arbeitsstand("abc1234567890", "x"), arbeitsstand("abc1234567890", "x"));
  });
});
