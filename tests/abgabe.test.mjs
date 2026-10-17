// Abgabe und Merge als je ein Aufruf -- geprueft an den reinen Regeln.
//
// Was die beiden Werkzeuge tun, steht als Liste von Schritten fest, bevor ein
// Kindprozess laeuft. Genau diese Liste wird hier geprueft; git und gh selbst
// gehoeren nicht in einen Test.
//
// Der Anlass: in den Laeufen 89401f6c und 40d36a23 brauchte die Abgabe fuenf bis
// acht Aufrufe, und `gh pr merge --delete-branch` scheiterte im Arbeitsraum an
// "'main' is already used by worktree", `git pull --ff-only` danach ebenso.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { abgabeSchritte, prText, repoAusRemote } from "../tools/abgabe.mjs";
import { mergeSchritte } from "../tools/merge.mjs";

const zeile = (schritt) => schritt.join(" ");

describe("Schritte der Abgabe", () => {
  const bereit = {
    kennung: "beispiel",
    fertigVorhanden: true,
    zweig: "change/beispiel",
    offen: " M src/x.mjs",
    titel: "change(beispiel)",
    textDatei: "/tmp/pr-beispiel.md",
  };

  it("tut ohne fertig.md nichts und nennt den Nachweis", () => {
    const a = abgabeSchritte({ ...bereit, fertigVorhanden: false });
    assert.match(a.fehler, /fertig/);
    assert.deepEqual(a.schritte, []);
  });

  it("weigert sich auf dem falschen Branch", () => {
    const a = abgabeSchritte({ ...bereit, zweig: "main" });
    assert.match(a.fehler, /change\/beispiel/);
    assert.deepEqual(a.schritte, []);
  });

  it("committet, pusht und stellt den Pull Request -- in dieser Reihenfolge", () => {
    const zeilen = abgabeSchritte(bereit).schritte.map(zeile);
    assert.equal(zeilen.length, 4);
    assert.match(zeilen[0], /^git add -A$/);
    assert.match(zeilen[1], /^git commit -m /);
    assert.match(zeilen[2], /^git push -u origin change\/beispiel$/);
    // Change 02-bildbeleg-sichtbar (#909): dieses Repo hat keinen Zweig 'main', und der
    // PR-Text kommt aus einer Datei, damit der Bildbeleg darin steht.
    assert.match(zeilen[3], /^gh pr create --base master --head change\/beispiel --title change\(beispiel\) --body-file \/tmp\/pr-beispiel\.md$/);
  });

  it("laesst den Commit aus, wenn nichts offen ist", () => {
    const zeilen = abgabeSchritte({ ...bereit, offen: "" }).schritte.map(zeile);
    assert.equal(zeilen.length, 2);
    assert.ok(!zeilen.some((z) => z.startsWith("git commit")), "ein leerer Commit wuerde scheitern");
  });

  it("nennt die Kennung in der Commit-Nachricht", () => {
    const commit = abgabeSchritte(bereit).schritte.find((s) => s[1] === "commit");
    assert.match(commit.at(-1), /beispiel/);
  });
});

describe("PR-Text mit Bildbeleg", () => {
  const bild = {
    stufe: "nachher", art: "bild", pfad: "belege/assets/1-prozess.png", fehlt: false,
    quelle: "prozessschmiede", beschreibung: "belege/artefacts/1-prozess.yaml",
  };
  const basis = "https://github.com/o/r/blob/abc123/openspec/changes/beispiel";

  it("zeigt jeden Bildbeleg als Markdown-Bild auf dem Commit", () => {
    const text = prText({ kennung: "beispiel", repo: "o/r", sha: "abc123", belege: [bild], fertig: "" });
    assert.ok(text.includes(`![nachher](${basis}/belege/assets/1-prozess.png?raw=true)`), text);
    assert.ok(text.includes(`${basis}/belege/artefacts/1-prozess.yaml`), "die Beschreibung ist verlinkt");
  });

  it("laesst fehlende Belege und Artefakte ohne Bild weg", () => {
    const text = prText({
      kennung: "beispiel", repo: "o/r", sha: "abc123", fertig: "",
      belege: [
        { ...bild, fehlt: true, pfad: "" },
        { stufe: "nachher", art: "graph", pfad: "belege/artefacts/0-x.svg", fehlt: false },
      ],
    });
    assert.ok(!text.includes("!["), text);
    assert.match(text, /kein Bildbeleg/i);
  });

  it("haengt den Abschlussnachweis an", () => {
    const text = prText({ kennung: "beispiel", repo: "o/r", sha: "abc123", belege: [bild], fertig: "# Abschluss — beispiel" });
    assert.match(text, /# Abschluss — beispiel/);
  });

  it("liest Eigentuemer und Repo aus den ueblichen Remote-Formen", () => {
    assert.equal(repoAusRemote("https://github.com/example-org/example-repo"), "example-org/example-repo");
    assert.equal(repoAusRemote("https://github.com/o/r.git"), "o/r");
    assert.equal(repoAusRemote("git@github.com:o/r.git"), "o/r");
    assert.equal(repoAusRemote("http://proxy@127.0.0.1:1234/git/o/r"), "o/r");
    assert.equal(repoAusRemote(""), null);
  });
});

describe("Schritte des Merges", () => {
  const bereit = {
    kennung: "beispiel",
    hauptordner: "/Users/x/ops-lab-test",
    nachweise: { gate1: true, gate2: true, fertig: true },
  };

  it("mergt, entfernt den fernen Branch und zieht den Hauptordner nach", () => {
    const zeilen = mergeSchritte(bereit).schritte.map(zeile);
    assert.equal(zeilen.length, 3);
    assert.match(zeilen[0], /^gh pr merge change\/beispiel /);
    assert.match(zeilen[1], /^git push origin --delete change\/beispiel$/);
    assert.match(zeilen[2], /^git -C \/Users\/x\/ops-lab-test pull --ff-only$/);
  });

  // Beides scheitert aus einem Arbeitsraum heraus: 'main' ist dort schon
  // ausgecheckt, und gh wie git wollen ihn wechseln.
  it("checkt nirgends main aus und loescht den Branch nicht ueber gh", () => {
    for (const z of mergeSchritte(bereit).schritte.map(zeile)) {
      assert.ok(!z.includes("--delete-branch"), `${z} wechselt lokal auf main`);
      assert.ok(!z.includes("checkout"), `${z} wechselt den Branch`);
    }
  });

  it("mergt nur mit vollstaendigem Nachweis", () => {
    const m = mergeSchritte({ ...bereit, nachweise: { gate1: true, gate2: true, fertig: false } });
    assert.match(m.fehler, /fertig/);
    assert.deepEqual(m.schritte, []);
  });
});
