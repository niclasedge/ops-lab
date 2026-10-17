// Ein Arbeitsraum macht nur seinen eigenen Change aktiv (Change 31, Issue #762).
//
// Jeder Arbeitsraum ist ein Checkout des Hauptzweigs und traegt damit alle Change-Ordner,
// die dort liegen. Das Lagebild darf daraus nicht schliessen, dass alle diese Changes in
// jedem Raum laufen -- im echten Clone ergab das 822 Eintraege unter `aktiv` und 0 unter
// `ohne_raum`. Das Wegwerf-Repo hier baut genau diese Lage nach: drei offene Changes im
// Hauptbaum, zwei Arbeitsraeume fuer zwei davon, einer fuer keinen, und einer fuer einen
// Change, der bisher nur in seinem eigenen Raum liegt.

import { strict as assert } from "node:assert";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { erhebe } from "../tools/lage.mjs";
import {
  arbeitsbaum, commitAlles, git, legeChange, neuesRepo,
} from "./lagebild-fixture.mjs";

const OFFEN = [[false, "1.1", "Eine offene Aufgabe"]];

let repo;
let lage;

before(() => {
  repo = neuesRepo("ops-lage-aktiv-");
  for (const name of ["probe-a", "probe-b", "probe-c"]) legeChange(repo.wurzel, name, OFFEN);
  commitAlles(repo.wurzel, "Probe: drei offene Changes");

  // Beide Raeume sind Checkouts von main und tragen damit alle drei Change-Ordner.
  arbeitsbaum(repo.wurzel, "probe-a");
  arbeitsbaum(repo.wurzel, "probe-b");

  // Ein Raum, der keinem Change gehoert.
  git(repo.wurzel, "worktree", "add", "-q",
    join(repo.wurzel, ".claude", "worktrees", "sonstwas"), "-b", "claude/sonstwas");

  // Ein Change, der bisher nur in seinem eigenen Raum liegt.
  const neu = arbeitsbaum(repo.wurzel, "probe-neu");
  legeChange(neu, "probe-neu", OFFEN);

  lage = erhebe(repo.wurzel);
});

after(() => repo?.aufraeumen());

const paare = () => lage.aktiv.map((eintrag) => `${eintrag.kennung}@${eintrag.raum}`).sort();

describe("Ein Arbeitsraum macht nur seinen eigenen Change aktiv", () => {
  it("fuehrt je Raum nur den Change, dem der Raum gehoert", () => {
    assert.deepEqual(paare(), ["probe-a@probe-a", "probe-b@probe-b", "probe-neu@probe-neu"]);
  });

  it("fuehrt den Change ohne eigenen Raum unter ohne_raum", () => {
    assert.deepEqual(lage.ohne_raum.map((eintrag) => eintrag.kennung), ["probe-c"]);
  });

  it("fuehrt aus einem Raum ohne eigenen Change nichts als aktiv", () => {
    assert.equal(lage.aktiv.filter((eintrag) => eintrag.raum === "sonstwas").length, 0);
  });

  it("fuehrt den Change, der nur im eigenen Raum liegt, als aktiv", () => {
    const eintrag = lage.aktiv.find((posten) => posten.kennung === "probe-neu");
    assert.equal(eintrag?.raum, "probe-neu");
    assert.equal(eintrag?.branch, "change/probe-neu");
  });
});
