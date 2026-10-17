// Die Textpruefungen der Gates, frei von Dateizugriff und Kindprozessen.
//
// Hier steht, was ein Gate ueber einen Text entscheidet -- und nur das. Getrennt
// von tools/gate.mjs, damit jede Regel einen Test hat: ein Gate, das sich nicht
// pruefen laesst, ist selbst nur eine Behauptung.

/**
 * Platzhalter aus der Vorlage, die kein Mensch angefasst hat.
 *
 * Ohne diese Pruefung besteht ein frisch angelegter Change alle Textpruefungen,
 * weil die Vorlage lang genug ist und die richtigen Ueberschriften traegt. Der
 * Anleitungskommentar und die spitzen Klammern sind das verlaessliche Kennzeichen.
 */
export function platzhalter(text) {
  const treffer = [];
  for (const [, inhalt] of text.matchAll(/<!--([\s\S]*?)-->/g)) {
    treffer.push(`Anleitungskommentar: ${kurz(inhalt)}`);
  }
  // Spitze Klammern um Fliesstext; HTML-Tags und Vergleiche schliesst das aus.
  for (const [, inhalt] of text.matchAll(/<([A-Za-zÄÖÜäöü][^<>\n]{3,})>/g)) {
    treffer.push(`Platzhalter: <${kurz(inhalt)}>`);
  }
  return treffer;
}

function kurz(text) {
  const eine = text.replace(/\s+/g, " ").trim();
  return eine.length > 48 ? `${eine.slice(0, 45)}…` : eine;
}

/**
 * Die in tasks.md zugesagten Testdateien. Gate 1 und Gate 2 lesen genau diese Pfade.
 *
 * Zwei Gestalten, weil dieses Repo zwei Testsprachen fuehrt: die Node-Selbsttests
 * der Werkzeuge (`tests/*.test.mjs`) und die pytest-Baeume der Fachlogik
 * (`<ordner>/test_*.py`). Ohne die zweite Gestalt sieht Gate 2 an einem
 * Python-Change gar keine zugesagte Datei und haelt ihn fuer unbelegt.
 * ANGEPASST gegenueber dem ops-lab-Vorrat — ein erneutes `install.mjs` setzt das
 * zurueck.
 */
export function zugesagteTests(tasksText) {
  const mjs = [...tasksText.matchAll(/`(tests\/[^`]+\.test\.mjs)`/g)].map((m) => m[1]);
  const py = [...tasksText.matchAll(/`([\w./-]+\/test_[\w.-]+\.py)`/g)].map((m) => m[1]);
  return [...new Set([...mjs, ...py])];
}

/**
 * Traegt dieser Pfad eine Testdatei?
 *
 * Dieselben zwei Gestalten wie in `zugesagteTests`, damit Gate 2 nicht an der
 * einen Stelle eine Datei zusagt, die es an der anderen nicht wiedererkennt.
 */
export function istTestpfad(pfad) {
  return /^tests\/.*\.test\.mjs$/.test(pfad) || /(^|\/)test_[\w.-]+\.py$/.test(pfad);
}

/**
 * Die zugesagten Dateien aus dem Abschnitt "Beruehrte Dateien" des Vorschlags.
 *
 * Diese Liste ist die Zusage, auf der der Parallelbetrieb ruht: zwei Changes
 * laufen gleichzeitig, wenn ihre Dateimengen disjunkt sind.
 *
 * Gelesen wird nur dieser eine Abschnitt und darin nur, was in einem
 * Listeneintrag steht. Im Warum stehen oft Dateien, die der Change gerade nicht
 * anfasst, und unter der Liste steht in mehreren Vorschlaegen ein Satz "Nicht
 * beruehrt: ..." -- beides zaehlte sonst als Zusage mit und stellte die Aussage
 * auf den Kopf.
 *
 * Was kein Pfad sein kann, faellt heraus: ein Pfad traegt kein Leerzeichen, und
 * keiner faengt mit einem Strich an. Damit bleiben die Aufrufe draussen, die in
 * den Erlaeuterungen der Liste stehen.
 */
export function zugesagteDateien(proposalText) {
  const ab = proposalText.search(/^##\s*Ber(ue|ü)hrte\s+Dateien\b/im);
  if (ab < 0) return [];
  const rest = proposalText.slice(ab);
  const bis = rest.slice(1).search(/^##\s/m);
  const abschnitt = bis < 0 ? rest : rest.slice(0, bis + 1);

  const pfade = [];
  // Ein Eintrag beginnt mit seinem Aufzaehlungszeichen und reicht ueber jede
  // eingerueckte Folgezeile. Ohne diese Fortsetzung entginge jeder Pfad, der
  // erst in der zweiten Zeile eines Eintrags steht.
  let imEintrag = false;
  for (const zeile of abschnitt.split("\n")) {
    if (/^\s*[-*]\s/.test(zeile)) imEintrag = true;
    else if (!/^\s+\S/.test(zeile)) imEintrag = false;
    if (!imEintrag) continue;
    for (const [, inhalt] of zeile.matchAll(/`([^`\n]+)`/g)) {
      if (/\s/.test(inhalt) || inhalt.startsWith("-")) continue;
      pfade.push(inhalt);
    }
  }
  return [...new Set(pfade)];
}

/**
 * Entsteht diese Datei durch den Ablauf und nicht durch die Aufgabe?
 *
 * Der Change-Ordner, sein Archiv und die Spec-Ablage fallen in jedem Lauf an --
 * niemand sagt sie im Vorschlag zu, und niemand sollte es muessen. Zaehlten sie
 * mit, faende der Abgleich in jedem Lauf einen Befund und nie einen echten.
 */
function istAblaufartefakt(pfad) {
  return pfad.startsWith("openspec/changes/") || pfad.startsWith("openspec/specs/");
}

/** Deckt eine Zusage diesen Pfad? Eine Zusage auf einen Ordner deckt alles darunter. */
function deckt(zusage, pfad) {
  return zusage.endsWith("/") ? pfad.startsWith(zusage) : pfad === zusage;
}

/**
 * Zusage und Diff gegeneinander gehalten -- in beiden Richtungen.
 *
 * `zusatz` ist angefasst ohne Zusage: ein Risiko fuer den Parallelbetrieb, denn
 * das Lagebild hat diesen Change anhand der Zusage neben einen anderen gestellt.
 * `auslassung` ist zugesagt ohne Anfassen: kein Risiko, aber meist ein Hinweis,
 * dass der Zuschnitt sich unterwegs verschoben hat. Wer beides zusammenfasst,
 * verliert die Diagnose.
 *
 * Die Artefakte des Ablaufs zaehlen nicht als Zusatz -- eine Zusage auf ihren
 * Ordner duerfen sie trotzdem einloesen, sonst stuende sie in jedem Lauf als
 * Auslassung da.
 */
export function dateiAbgleich(zugesagt, geaendert) {
  const zusatz = geaendert
    .filter((pfad) => !istAblaufartefakt(pfad))
    .filter((pfad) => !zugesagt.some((zusage) => deckt(zusage, pfad)));
  const auslassung = zugesagt.filter((zusage) => !geaendert.some((pfad) => deckt(zusage, pfad)));

  return { zusatz, auslassung, deckungsgleich: zusatz.length === 0 && auslassung.length === 0 };
}

/** Anzahl der Aufgaben insgesamt und der noch offenen. */
export function aufgaben(tasksText) {
  return {
    gesamt: (tasksText.match(/^\s*- \[[ xX]\]/gm) ?? []).length,
    offen: (tasksText.match(/^\s*- \[ \]/gm) ?? []).length,
  };
}

/** Requirements und Szenarien einer Delta-Spec. Jedes Requirement braucht ein Szenario. */
export function specGeruest(specText) {
  return {
    requirements: (specText.match(/^###\s+Requirement:/gm) ?? []).length,
    szenarien: (specText.match(/^####\s+Scenario:/gm) ?? []).length,
    deltaBloecke: (specText.match(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/gm) ?? []).length,
  };
}

/** Fehlgeschlagene Testfaelle aus einer TAP-Ausgabe. */
export function tapFehler(ausgabe) {
  const zusammenfassung = ausgabe.match(/^# fail (\d+)$/m);
  if (zusammenfassung) return Number(zusammenfassung[1]);
  return (ausgabe.match(/^not ok \d+/gm) ?? []).length;
}

/**
 * Haengt ein Change an einer Datei nur an, statt sie zu aendern?
 *
 * Eingabe ist die Ausgabe von `git diff --numstat` fuer eine Datei: Zahl der
 * hinzugefuegten Zeilen, Zahl der entfernten, Pfad. Die Regel gilt dem
 * `justfile`: eine Liste von Zielen, an die zwei Changes gleichzeitig anhaengen
 * koennen, ohne sich zu widersprechen. Wer dort eine Zeile entfernt oder
 * aendert, tut das nicht mehr -- git meldet eine Aenderung als je eine
 * hinzugefuegte und eine entfernte Zeile.
 *
 * Eine Binaeraenderung schreibt git als '-' statt als Zahl. Was sich nicht
 * zeilenweise vergleichen laesst, kann auch nicht als reine Anhaengung gelten.
 */
export function nurAngehaengt(numstat) {
  let hinzu = 0;
  let entfernt = 0;
  let binaer = false;

  for (const zeile of numstat.split("\n")) {
    if (!zeile.trim()) continue;
    const [a, b] = zeile.split("\t");
    if (a === "-" || b === "-") {
      binaer = true;
      continue;
    }
    hinzu += Number(a) || 0;
    entfernt += Number(b) || 0;
  }

  return { hinzu, entfernt, bestanden: !binaer && entfernt === 0 };
}

/** Hat proposal.md die Abschnitte, an denen Gate 1 den Inhalt festmacht? */
export function proposalAbschnitte(text) {
  return {
    warum: /^##\s*Warum\b/im.test(text),
    aenderung: /^##\s*Was\s+(aendert|ändert)\s+sich\b/im.test(text),
    abgrenzung: /^##\s*Was\s+ausdr(ue|ü)cklich\s+nicht\b/im.test(text),
    dateien: /^##\s*Ber(ue|ü)hrte\s+Dateien\b/im.test(text),
  };
}

/** Der Weg zum Bildbeleg, wie ihn jede Ablehnung nennt. */
export const BILDBELEG_WEG =
  "Bildbeleg mit /prozessschmiede bauen: prozess.py neu beleg --art stufen --ziel DIR, " +
  "prozess.py bauen DIR/prozess.yaml, dann just beleg <change> nachher DIR/prozess.png";

/**
 * Ist eine Journalzeile ein sichtbarer Beleg?
 *
 * Sichtbar heisst seit Change 02-bildbeleg-sichtbar (#909): ein PNG aus der
 * Prozessschmiede, das beim Einliefern nicht als fehlend vermerkt wurde. Ein SVG
 * oder DOT liegt in `belege/artefacts/` und erscheint in keiner Ansicht; ein
 * Screenshot ohne Beschreibung ist nicht nachbaubar. Befehl und Ausgabe zaehlen
 * ohnehin nicht -- sie sind derselbe Text, den auch schreiben koennte, wer den
 * Lauf nie gefahren hat.
 *
 * Das Dateisystem wird hier nicht befragt. Das Urteil fiel beim Einliefern und
 * steht in der Zeile; ein abgeschlossener Vorgang soll seinen Nachweis nicht
 * verlieren, weil jemand spaeter einen Ordner umbenennt.
 */
export function istSichtbar(zeile) {
  return !zeile.fehlt && zeile.art === "bild" && zeile.quelle === "prozessschmiede";
}

/**
 * Urteil des Abschlusses ueber die Belegzeilen eines Vorgangs.
 *
 * Vier Ablehnungsgruende, die auseinandergehalten werden muessen: es wurde
 * nichts eingeliefert, es wurde etwas Unlesbares eingeliefert, es liegt ein Bild
 * oder Graph ohne Prozessschmiede-Herkunft vor, oder es liegt nur Befehl und
 * Ausgabe vor. Wer sie zusammenfasst, schickt den Nutzenden suchen.
 */
export function belegLage(zeilen) {
  const nachher = zeilen.filter((z) => z.stufe === "nachher");
  if (nachher.some(istSichtbar)) return { sichtbar: true, meldung: "" };

  if (!nachher.length) {
    return { sichtbar: false, meldung: `kein Beleg der Stufe nachher eingeliefert. ${BILDBELEG_WEG}` };
  }
  const gescheitert = nachher.find((z) => z.fehlt);
  const ohneHerkunft = nachher.find((z) => !z.fehlt && (z.art === "bild" || z.art === "graph"));
  if (ohneHerkunft) {
    const grund = ohneHerkunft.grund ? ` (${ohneHerkunft.grund})` : "";
    return {
      sichtbar: false,
      meldung: `${ohneHerkunft.art === "bild" ? "Bild" : "Graph-Artefakt"} ohne Herkunft aus der Prozessschmiede${grund}. ${BILDBELEG_WEG}`,
    };
  }
  if (gescheitert) {
    return {
      sichtbar: false,
      meldung: `Beleg eingeliefert, aber beim Einliefern als fehlend vermerkt: ${gescheitert.grund}`,
    };
  }
  return {
    sichtbar: false,
    meldung: `nichts Sichtbares: es liegt nur Befehl und Ausgabe vor, kein Bild. ${BILDBELEG_WEG}`,
  };
}

/**
 * Traegt git das Belegjournal (F-6)? Ein ausgeschlossenes Journal laesst F-5 im
 * Arbeitsraum gruen werden und kommt doch nie auf master an (#909).
 */
export function journalLage({ ignoriert }) {
  if (ignoriert) {
    return {
      getragen: false,
      meldung: "belege/belege.jsonl ist von git ausgeschlossen -- .gitignore braucht !openspec/changes/**/belege/belege.jsonl",
    };
  }
  return { getragen: true, meldung: "" };
}
