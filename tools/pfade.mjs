// Pfade, die Claude Code selbst bildet.
//
// Eigene Datei, weil die Regel nicht ableitbar ist: sie steht nirgends
// geschrieben und laesst sich nur am Bestand der Mitschriftenordner ablesen.
// Getestet in tests/pfade.test.mjs.

import { join, sep } from "node:path";

/**
 * Bildet aus einem Arbeitsverzeichnis den Namen seines Mitschriftenordners
 * unter `<config>/projects/`.
 *
 * Schraegstrich, Punkt und Unterstrich werden gleichermassen zu Bindestrichen.
 * Belege aus dem Bestand: `/Users/x/.agent` wird zu `-Users-x--agent`,
 * `hackathon_g_5/v2.1` zu `hackathon-g-5-v2-1`.
 */
export function projektmarke(arbeitsverzeichnis) {
  return arbeitsverzeichnis.replace(/[/._]/g, "-");
}

/** Der Sammelordner, unter dem alle Arbeitsraeume eines Repos liegen. */
const SAMMELORDNER = [".claude", "worktrees"];

/**
 * Der Pfad des Arbeitsraums eines Changes.
 *
 * Der Ort ist Konvention, keine Erfindung: `ops.py` sucht die Arbeitsraeume
 * bereits hier, und dieselbe Ablage gilt in den uebrigen Repos.
 */
export function arbeitsraumPfad(hauptordner, kennung) {
  return join(hauptordner, ...SAMMELORDNER, kennung);
}

/**
 * Liegt dieser Pfad in einem Arbeitsraum?
 *
 * Der Sammelordner selbst zaehlt nicht: dort liegen Arbeitsraeume, er ist
 * keiner. Erst ein Verzeichnis darunter ist einer.
 */
/**
 * Alle Mitschriftenordner eines Repos: der des Hauptordners und der jedes
 * Arbeitsraums.
 *
 * Der Ablauf schreibt vor, dass jeder Change in seinem eigenen Arbeitsraum
 * laeuft. Claude Code legt seine Mitschrift aber je Arbeitsverzeichnis ab --
 * wer nur den Hauptordner abfragt, misst genau den Lauf nicht, der dem Ablauf
 * folgt. Der Bestand zeigt es: acht Mitschriftenordner zu Arbeitsraeumen dieses
 * Repos, von der Messung nie gelesen.
 *
 * Das Dateisystem wird hier nicht befragt. Welche Arbeitsraeume es gibt und
 * welcher Ordner wirklich vorliegt, weiss der Aufrufer -- er reicht die
 * Kennungen und ein Praedikat herein. Damit bleibt diese Datei, was sie ist:
 * die Regeln, nach denen Pfade gebildet werden, und nichts weiter.
 */
export function mitschriftenOrdner(repo, konfig, arbeitsraeume, vorhanden) {
  const wurzel = join(konfig, "projects");
  return [repo, ...arbeitsraeume.map((kennung) => arbeitsraumPfad(repo, kennung))]
    .map((pfad) => join(wurzel, projektmarke(pfad)))
    .filter(vorhanden);
}

/**
 * Wo der Vorgang eines Changes liegen kann, in der Reihenfolge, in der gesucht
 * wird: erst der Arbeitsraum der Kennung, dann der Hauptordner.
 *
 * Jeder Ort traegt seine Wurzel mit, weil Diff und Testlauf dorthin gehoeren,
 * wo die Nachweise liegen. Die Messung las den Hauptordner, waehrend der Ablauf
 * im Arbeitsraum lief -- und bewertete zwei vollstaendige Laeufe mit "gates
 * fehlt". Das Archiv steht nicht hier: es braucht einen Blick ins Dateisystem,
 * und den macht der Aufrufer.
 */
export function vorgangsOrte(repo, kennung) {
  return [arbeitsraumPfad(repo, kennung), repo].map((wurzel) => ({
    wurzel,
    vorgang: join(wurzel, "openspec", "changes", kennung),
  }));
}

/**
 * Der juengste Eintrag eines Archivs -- das Muster fuer einen neuen Change.
 *
 * Die Eintraege tragen das Datum vorn (`2026-09-20-kennung`); der Name ordnet sie
 * damit zeitlich. Was nicht so beginnt, ist kein Eintrag.
 */
export function juengstesArchiv(eintraege) {
  const passend = eintraege.filter((e) => /^\d{4}-\d{2}-\d{2}-/.test(e)).sort();
  return passend.at(-1) ?? null;
}

export function istArbeitsraum(pfad) {
  const teile = pfad.split(sep === "\\" ? /[\\/]/ : "/");
  const stelle = teile.indexOf(SAMMELORDNER[0]);
  if (stelle < 0 || teile[stelle + 1] !== SAMMELORDNER[1]) return false;
  return teile.length > stelle + 2 && teile[stelle + 2] !== "";
}
