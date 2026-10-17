// Was der selbstaendige Lauf entscheidet, bevor er etwas startet.
//
// Geprueft wird nur, was rein ist: die Aufrufzeile, das Auslesen der
// Sitzungskennung und die Fortschrittszeile. Der Start selbst gehoert nicht
// hierher -- ein Test, der einen Agenten startet, ist kein Test mehr.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { claudeArgumente, ERLAUBT, fortschritt, mitRahmen, RAHMEN, sitzungAus, startfreigabe, WERKSTUECK } from "../tools/testlauf.mjs";

describe("Startfreigabe eines Laufs", () => {
  const bereit = { tagVorhanden: true, offen: "", werkstueckAbweichung: [] };

  it("laesst den Lauf auf Stand 0 durch", () => {
    assert.equal(startfreigabe(bereit).start, true);
  });

  it("haelt an, solange kein Stand 0 markiert ist", () => {
    const u = startfreigabe({ ...bereit, tagVorhanden: false });
    assert.equal(u.start, false);
    assert.match(u.rat, /git tag stand-0/, "der Rat muss den Handgriff nennen");
  });

  it("haelt bei offenen Aenderungen an, weil der Agent sie als seine Arbeit zaehlt", () => {
    const u = startfreigabe({ ...bereit, offen: " M src/rechenbasis.mjs" });
    assert.equal(u.start, false);
  });

  it("haelt an, wenn das Werkstueck vom Ausgangsstand abweicht", () => {
    const u = startfreigabe({ ...bereit, werkstueckAbweichung: ["src/amortisation.mjs"] });
    assert.equal(u.start, false);
    assert.match(u.grund, /src\/amortisation\.mjs/, "die abweichende Datei gehoert in die Meldung");
    assert.match(u.rat, /just stand-0/);
  });

  it("zaehlt das Geruest nicht zum Werkstueck -- es soll gerade nicht zurueck", () => {
    for (const geruest of ["tools", "ops.py", "justfile"]) {
      assert.ok(!WERKSTUECK.includes(geruest), `${geruest} wuerde sonst auf den alten Stand zurueckfallen`);
    }
    assert.deepEqual(WERKSTUECK, ["src", "tests", "openspec"]);
  });
});

// Lauf 40d36a23 verlor zehn Aufrufe an den Remote-Branch des vorigen Laufs: der
// Push wurde abgewiesen, der Agent suchte einen Weg daran vorbei. Was vom letzten
// Lauf steht, gehoert vor dem naechsten geraeumt -- vom Menschen, nicht vom Werkzeug.
describe("Altlast einer Kennung", () => {
  const bereit = { tagVorhanden: true, offen: "", werkstueckAbweichung: [], kennung: "amortisation" };
  const nichts = { arbeitsraum: false, zweigLokal: false, zweigFern: false, prOffen: null, fernAbweichung: [] };

  it("laesst den Lauf ohne Fund durch", () => {
    assert.equal(startfreigabe({ ...bereit, altlast: nichts }).start, true);
  });

  it("haelt am fernen Branch an und nennt den Handgriff", () => {
    const u = startfreigabe({ ...bereit, altlast: { ...nichts, zweigFern: true } });
    assert.equal(u.start, false);
    assert.match(u.rat, /git push origin --delete change\/amortisation/);
  });

  it("haelt am Arbeitsraum und am lokalen Branch an", () => {
    const u = startfreigabe({ ...bereit, altlast: { ...nichts, arbeitsraum: true, zweigLokal: true } });
    assert.equal(u.start, false);
    assert.match(u.rat, /git worktree remove/);
    assert.match(u.rat, /change\/amortisation/);
  });

  it("haelt am offenen Pull Request an", () => {
    const u = startfreigabe({ ...bereit, altlast: { ...nichts, prOffen: 7 } });
    assert.equal(u.start, false);
    assert.match(u.grund, /#7/);
  });

  // Enthaelt origin/main das Werkstueck schon, kollidiert der Pull Request des
  // Laufs mit ihm -- der Merge scheitert, und zwei Kriterien fallen zu Unrecht.
  it("haelt an, wenn das Werkstueck auf origin/main von Stand 0 abweicht", () => {
    const u = startfreigabe({ ...bereit, altlast: { ...nichts, fernAbweichung: ["src/amortisation.mjs"] } });
    assert.equal(u.start, false);
    assert.match(u.grund, /src\/amortisation\.mjs/);
    assert.match(u.rat, /origin main/);
  });

  it("nennt jeden Fund, nicht nur den ersten", () => {
    const u = startfreigabe({ ...bereit, altlast: { ...nichts, zweigFern: true, arbeitsraum: true } });
    assert.match(u.rat, /worktree remove/);
    assert.match(u.rat, /push origin --delete/);
  });
});

describe("Aufrufzeile des selbstaendigen Laufs", () => {
  it("uebergibt den Auftrag im Druckmodus", () => {
    const a = claudeArgumente("Tun Sie dies.");
    assert.equal(a[0], "-p");
    assert.equal(a[1], "Tun Sie dies.");
  });

  it("waehlt acceptEdits -- der auto-Modus verwirft genau die noetigen Regeln", () => {
    const a = claudeArgumente("x");
    assert.equal(a[a.indexOf("--permission-mode") + 1], "acceptEdits");
  });

  it("bleibt auf acceptEdits stehen, der Lauf 784326bc scheiterte an auto", () => {
    // Regressionsschutz. Im auto-Modus werden breite Regeln beim Eintritt
    // verworfen -- "wildcarded interpreters" und "package-manager run commands",
    // also 'just:*' und 'node:*'. Danach entscheidet der Classifier, und ein
    // '-p'-Lauf hat keine Rueckfrage, auf die er zurueckfallen koennte.
    assert.ok(!claudeArgumente("x").includes("auto"), "auto laesst 'just neu' nicht durch");
  });

  it("erlaubt jeden Schritt des Ablaufs, sonst bleibt der Lauf stehen", () => {
    const a = claudeArgumente("x");
    assert.ok(a.includes("--allowedTools"), "ohne Freigabeliste fragt jeder Befehl nach");
    for (const noetig of ["Bash(just:*)", "Bash(node:*)", "Bash(git:*)", "Bash(gh:*)"]) {
      assert.ok(ERLAUBT.includes(noetig), `ohne ${noetig} kommt der Ablauf nicht durch`);
      assert.ok(a.includes(noetig), `${noetig} fehlt in der Aufrufzeile`);
    }
  });

  it("bleibt begrenzt -- kein Freibrief, die Liste ist der Rahmen", () => {
    const a = claudeArgumente("x");
    assert.ok(!a.includes("--dangerously-skip-permissions"), "der Lauf soll im Rahmen der Liste bleiben");
    assert.ok(!ERLAUBT.includes("Bash"), "Bash ohne Klammern waere jeder Befehl");
    assert.ok(!ERLAUBT.includes("Bash(*)"), "Bash(*) waere dasselbe in Gruen");
  });

  it("verlangt den Strom, weil nur er die Sitzungskennung nennt", () => {
    const a = claudeArgumente("x");
    assert.equal(a[a.indexOf("--output-format") + 1], "stream-json");
    assert.ok(a.includes("--verbose"), "der Strom bleibt ohne --verbose stumm");
  });

  it("nennt ein Modell nur, wenn eines gewuenscht ist", () => {
    assert.ok(!claudeArgumente("x").includes("--model"));
    const a = claudeArgumente("x", { modell: "opus" });
    assert.equal(a[a.indexOf("--model") + 1], "opus");
  });
});

describe("Rahmen um den Auftrag", () => {
  it("laesst den Auftrag woertlich stehen -- er ist das Messstueck", () => {
    const auftrag = "Ergaenzen Sie die Amortisationsdauer.";
    assert.ok(mitRahmen(auftrag).endsWith(auftrag), "der Auftrag steht am Ende, unveraendert");
  });

  it("nennt die Ersetzung fuer jeden Schritt, an dem ein Lauf haengenblieb", () => {
    // 63d7382f und 651d6f26 brachen bei 'just neu' ab. Fehlt hier eine Zeile,
    // sucht der naechste Lauf wieder selbst -- und bricht wieder ab.
    // belegbild.mjs steht seit Lauf bd8914a3 hier: der Lauf schrieb sich seinen
    // Renderer selbst und blieb am Torwaechter stehen, der nur tools/*.mjs kennt.
    for (const schritt of ["neu.mjs", "gate.mjs gate1", "gate.mjs gate2", "gate.mjs fertig", "belegbild.mjs", "gh pr create", "gh pr merge"]) {
      assert.ok(RAHMEN.includes(schritt), `ohne ${schritt} fehlt dem Agenten der Weg`);
    }
  });

  it("sagt, was nicht geht, und nennt den Grund nicht als Raetsel", () => {
    assert.match(RAHMEN, /just.*openspec.*nicht freigegeben|nicht freigegeben/s);
  });

  it("schickt den Agenten in den Arbeitsraum, nicht in den Hauptordner", () => {
    assert.match(RAHMEN, /Arbeitsraum/);
  });
});

describe("Rahmen spart Orientierung", () => {
  it("verbietet Verkettungen, statt den Agenten sie ausprobieren zu lassen", () => {
    assert.match(RAHMEN, /genau ein Befehl/);
    for (const zeichen of [";", "|"]) {
      assert.ok(RAHMEN.includes(zeichen), `ohne ${zeichen} fehlt das Verbot`);
    }
  });

  it("nennt den Vertrag der Werkzeuge, damit ihre Quellen ungelesen bleiben", () => {
    // Lauf 89401f6c las neu.mjs, gate.mjs, pruefungen.mjs und beleg.mjs --
    // alles, was der Rahmen mit einem Satz vorwegnehmen kann.
    const vertraege = ["legt Arbeitsraum", "roten Testlauf", "gruene Tests", "liefert ein Bild"];
    for (const vertrag of vertraege) {
      assert.ok(RAHMEN.includes(vertrag), `ohne '${vertrag}' liest der Agent die Quelle`);
    }
  });

  it("zeigt das Muster im Archiv, statt den Agenten suchen zu lassen", () => {
    assert.match(RAHMEN, /openspec\/changes\/archive/);
    assert.match(RAHMEN, /juengste archivierte/);
    for (const artefakt of ["proposal", "spec", "tasks"]) {
      assert.ok(RAHMEN.includes(artefakt), `ohne ${artefakt} bleibt das Muster unvollstaendig`);
    }
  });
});

// Die Laeufe 89401f6c und 40d36a23: Bild oeffnen (nicht freigegeben), Argument-
// reihenfolge von belegbild raten, frische Vorlagen lesen, Issues nachschlagen,
// Abgabe in fuenf Aufrufen mit Fehlschlag am Ende. Jeder Satz hier spart Zuege.
describe("Rahmen erspart Beleg- und Abgabe-Umwege", () => {
  it("erklaert, wie belegbild seine Argumente liest", () => {
    assert.match(RAHMEN, /letzten Parameter/);
    assert.match(RAHMEN, /--argument/);
  });

  it("sagt, dass das Bild nicht geoeffnet wird", () => {
    assert.match(RAHMEN, /Oeffnen Sie das Bild nicht/);
  });

  it("nennt die frischen Artefakte Vorlagen, die nicht gelesen werden", () => {
    assert.match(RAHMEN, /Vorlagen mit Platzhaltern/);
    assert.match(RAHMEN, /nicht lesen/);
  });

  it("nennt Abgabe und Merge als je einen Aufruf", () => {
    assert.match(RAHMEN, /node tools\/abgabe\.mjs/);
    assert.match(RAHMEN, /node tools\/merge\.mjs/);
  });

  it("erklaert den Auftrag fuer vollstaendig -- kein Issue wird nachgeschlagen", () => {
    assert.match(RAHMEN, /kein Issue/);
  });
});

describe("Sitzungskennung aus dem Strom", () => {
  it("liest sie aus einem Satz, der sie traegt", () => {
    assert.equal(sitzungAus({ type: "system", session_id: "abc-123" }), "abc-123");
  });

  it("meldet nichts, wo keine steht", () => {
    assert.equal(sitzungAus({ type: "assistant" }), null);
    assert.equal(sitzungAus({ session_id: 7 }), null, "eine Zahl ist keine Kennung");
    assert.equal(sitzungAus(null), null);
  });
});

describe("Fortschritt je Satz", () => {
  it("meldet die Sitzung beim Eroeffnungssatz", () => {
    const z = fortschritt({ type: "system", subtype: "init", session_id: "abc-123" });
    assert.match(z, /abc-123/);
  });

  it("nennt die benutzten Werkzeuge", () => {
    const z = fortschritt({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Bash" }, { type: "tool_use", name: "Edit" }] },
    });
    assert.match(z, /Bash, Edit/);
  });

  it("nimmt sonst die erste Textzeile", () => {
    const z = fortschritt({ type: "assistant", message: { content: [{ type: "text", text: "Gate 1 ist gruen.\nWeiter." }] } });
    assert.match(z, /Gate 1 ist gruen\./);
    assert.ok(!z.includes("Weiter."), "nur die erste Zeile");
  });

  it("fasst den Schlusssatz zusammen", () => {
    const z = fortschritt({ type: "result", subtype: "success", num_turns: 42, duration_ms: 125000 });
    assert.match(z, /success/);
    assert.match(z, /42 Zuege/);
    assert.match(z, /125s/);
  });

  it("schweigt zu Saetzen ohne Aussage", () => {
    assert.equal(fortschritt({ type: "assistant", message: { content: [] } }), null);
    assert.equal(fortschritt({ type: "user" }), null);
  });
});
