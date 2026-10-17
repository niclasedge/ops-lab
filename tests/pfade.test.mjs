// Der Mitschriftenordner einer Sitzung.
//
// Regression: die Messung lief ins Leere, weil der Unterstrich nicht ersetzt
// wurde. Fuer /Users/alice/GITHUB_REPOS/ops-lab-test entstand die Marke
// '-Users-alice-GITHUB_REPOS-ops-lab-test'; der Ordner heisst aber
// '-Users-alice-GITHUB-REPOS-ops-lab-test'. Ergebnis: "keine Mitschriften",
// obwohl Sitzungen vorlagen.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { arbeitsraumPfad, istArbeitsraum, juengstesArchiv, mitschriftenOrdner, projektmarke, vorgangsOrte } from "../tools/pfade.mjs";

describe("Marke des Mitschriftenordners", () => {
  it("ersetzt Schraegstriche durch Bindestriche", () => {
    assert.equal(projektmarke("/Users/x/GITHUB/c4-diagrams"), "-Users-x-GITHUB-c4-diagrams");
  });

  it("ersetzt auch Unterstriche — daran ist die Messung gescheitert", () => {
    assert.equal(
      projektmarke("/Users/alice/GITHUB_REPOS/ops-lab-test"),
      "-Users-alice-GITHUB-REPOS-ops-lab-test",
    );
  });

  it("ersetzt Punkte, statt sie zu entfernen", () => {
    // Beleg aus dem Bestand: /Users/alice/.agent/... wird zu '--agent'.
    assert.equal(projektmarke("/Users/alice/.agent"), "-Users-alice--agent");
    assert.equal(projektmarke("/Users/x/hackathon_g_5/v2.1"), "-Users-x-hackathon-g-5-v2-1");
  });
});

describe("Pfad eines Arbeitsraums", () => {
  it("haengt Kennung an .claude/worktrees des Hauptordners", () => {
    assert.equal(
      arbeitsraumPfad("/Users/x/GITHUB_REPOS/ops-lab", "beispiel"),
      "/Users/x/GITHUB_REPOS/ops-lab/.claude/worktrees/beispiel",
    );
  });

  it("laesst den Hauptordner unveraendert, auch mit Schraegstrich am Ende", () => {
    assert.equal(
      arbeitsraumPfad("/Users/x/ops-lab/", "zwei"),
      "/Users/x/ops-lab/.claude/worktrees/zwei",
    );
  });
});

describe("Erkennung eines Arbeitsraums", () => {
  it("erkennt ein Verzeichnis unterhalb von .claude/worktrees", () => {
    assert.equal(istArbeitsraum("/Users/x/ops-lab/.claude/worktrees/beispiel"), true);
  });

  it("erkennt auch ein Unterverzeichnis darin", () => {
    assert.equal(istArbeitsraum("/Users/x/ops-lab/.claude/worktrees/beispiel/tools"), true);
  });

  it("der Hauptordner selbst ist keiner", () => {
    assert.equal(istArbeitsraum("/Users/x/ops-lab"), false);
  });

  it("der leere Sammelordner ist noch keiner", () => {
    // Ohne Kennung dahinter ist es nur der Ort, an dem Arbeitsraeume liegen.
    assert.equal(istArbeitsraum("/Users/x/ops-lab/.claude/worktrees"), false);
  });

  it("ein aehnlich benannter Ordner taeuscht nicht", () => {
    assert.equal(istArbeitsraum("/Users/x/ops-lab/claude/worktrees/beispiel"), false);
    assert.equal(istArbeitsraum("/Users/x/meine-worktrees/beispiel"), false);
  });
});

describe("Mitschriftenordner eines Repos", () => {
  const konfig = "/Users/x/.claude";
  const repo = "/Users/x/GITHUB_REPOS/ops-lab-test";
  const alle = () => true;

  it("nennt den Ordner des Hauptordners", () => {
    assert.deepEqual(mitschriftenOrdner(repo, konfig, [], alle), [
      "/Users/x/.claude/projects/-Users-x-GITHUB-REPOS-ops-lab-test",
    ]);
  });

  // Der Ablauf schreibt vor, dass jeder Change in seinem Arbeitsraum laeuft.
  // Claude Code legt die Mitschrift je Arbeitsverzeichnis ab -- wer nur den
  // Hauptordner abfragt, misst genau den Lauf nicht, der dem Ablauf folgt.
  it("nennt zusaetzlich den Ordner jedes Arbeitsraums", () => {
    assert.deepEqual(mitschriftenOrdner(repo, konfig, ["beleg-typ", "messlauf"], alle), [
      "/Users/x/.claude/projects/-Users-x-GITHUB-REPOS-ops-lab-test",
      "/Users/x/.claude/projects/-Users-x-GITHUB-REPOS-ops-lab-test--claude-worktrees-beleg-typ",
      "/Users/x/.claude/projects/-Users-x-GITHUB-REPOS-ops-lab-test--claude-worktrees-messlauf",
    ]);
  });

  // Ein Arbeitsraum ohne Mitschrift ist der Normalfall, kein Fehler.
  it("laesst Ordner weg, die es nicht gibt", () => {
    const vorhanden = (pfad) => !pfad.endsWith("worktrees-ohne-sitzung");
    const ordner = mitschriftenOrdner(repo, konfig, ["mit-sitzung", "ohne-sitzung"], vorhanden);

    assert.equal(ordner.length, 2);
    assert.ok(ordner.every((o) => !o.endsWith("ohne-sitzung")), "ein leerer Arbeitsraum steht in der Liste");
  });

  it("meldet eine leere Liste, wenn es keinen einzigen Ordner gibt", () => {
    assert.deepEqual(mitschriftenOrdner(repo, konfig, ["eins"], () => false), []);
  });
});

// Die Messung las den Change-Ordner im Hauptordner des Zielrepos, obwohl der
// Ablauf im Arbeitsraum laeuft. Beide Laeufe 89401f6c und 40d36a23 wurden so mit
// "gates fehlt" und "kein Beleg" bewertet -- die Nachweise lagen nebenan.
describe("Orte eines Vorgangs", () => {
  const repo = "/Users/x/GITHUB_REPOS/ops-lab-test";

  it("nennt den Arbeitsraum zuerst, den Hauptordner danach", () => {
    assert.deepEqual(vorgangsOrte(repo, "amortisation"), [
      {
        wurzel: "/Users/x/GITHUB_REPOS/ops-lab-test/.claude/worktrees/amortisation",
        vorgang: "/Users/x/GITHUB_REPOS/ops-lab-test/.claude/worktrees/amortisation/openspec/changes/amortisation",
      },
      {
        wurzel: "/Users/x/GITHUB_REPOS/ops-lab-test",
        vorgang: "/Users/x/GITHUB_REPOS/ops-lab-test/openspec/changes/amortisation",
      },
    ]);
  });

  it("haelt Wurzel und Vorgang je Ort zusammen -- Diff und Testlauf gehoeren dorthin, wo die Nachweise liegen", () => {
    for (const ort of vorgangsOrte(repo, "beispiel")) {
      assert.ok(ort.vorgang.startsWith(ort.wurzel), `${ort.vorgang} liegt nicht unter ${ort.wurzel}`);
    }
  });
});

describe("Juengstes Archiv", () => {
  // Die Eintraege tragen das Datum vorn; der Name ordnet sie damit zeitlich.
  it("waehlt den Eintrag mit dem juengsten Datum", () => {
    assert.equal(juengstesArchiv(["2026-01-01-alt", "2026-03-01-neu", "2026-02-15-mitte"]), "2026-03-01-neu");
  });

  it("meldet null, wenn das Archiv leer ist", () => {
    assert.equal(juengstesArchiv([]), null);
  });

  it("uebergeht, was kein Archiveintrag ist", () => {
    assert.equal(juengstesArchiv([".gitkeep", "2026-01-01-alt"]), "2026-01-01-alt");
  });
});
