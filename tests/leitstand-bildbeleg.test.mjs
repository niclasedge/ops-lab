// Der Merge verlangt den Bildbeleg (Change 02-bildbeleg-sichtbar, #909).
//
// Vorher entschied `mergeErlaubt` nur ueber die drei Nachweise und die Pruefungen des
// Pull Requests -- ein Change ohne sichtbares Bild ging durch, weil das Journal auf
// master gar nicht ankam.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { bildBelegt, mergeErlaubt } from "../tools/leitstand.mjs";

const voll = { gate1: true, gate2: true, fertig: true, pruefungen: "gruen" };

describe("Merge und Bildbeleg", () => {
  it("verweigert den Merge ohne Bildbeleg und nennt ihn", () => {
    const urteil = mergeErlaubt({ ...voll, bild: false });
    assert.equal(urteil.erlaubt, false);
    assert.match(urteil.grund, /Bildbeleg/);
  });

  it("verweigert den Merge, wenn nach dem Bildbeleg nicht gefragt wurde", () => {
    assert.equal(mergeErlaubt(voll).erlaubt, false);
  });

  it("erlaubt den Merge mit Bildbeleg", () => {
    assert.equal(mergeErlaubt({ ...voll, bild: true }).erlaubt, true);
  });

  it("liest den Bildbeleg aus dem Journal des Changes", () => {
    const ordner = mkdtempSync(join(tmpdir(), "leitstand-bild-"));
    try {
      assert.equal(bildBelegt(ordner), false, "ohne Journal kein Bildbeleg");
      mkdirSync(join(ordner, "belege"), { recursive: true });
      const zeile = { stufe: "nachher", art: "bild", pfad: "belege/assets/0-prozess.png", fehlt: false, grund: "", quelle: "prozessschmiede" };
      writeFileSync(join(ordner, "belege", "belege.jsonl"), `${JSON.stringify(zeile)}\n`, "utf8");
      assert.equal(bildBelegt(ordner), true);
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  });
});
