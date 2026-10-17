# ops-lab

Das **Tooling-Repo** für den spec-getriebenen Ablauf. Hier wird das Werkzeug gebaut und
geprüft: die Gates, `just neu`, das Lagebild `ops.py`, die Token-Messung.

Angewendet wird der Ablauf nebenan in **`../ops-lab-test`** — an einem
Wirtschaftlichkeitsrechner, mit echten Issues, Branches, Pull Requests und Merges.

| Repo | Rolle |
|---|---|
| `ops-lab` (hier) | das Werkzeug. Gates, Vorlagen, Lagebild, Messung. Hier wird geschraubt. |
| `ops-lab-test` | der Ablauf im Einsatz. Hier wird gearbeitet, und hier fallen die Befunde an. |

**Die Trennung ist der Grund dieses Aufbaus.** Beim ersten Durchlauf musste Gate 1 mitten im
laufenden Test-Change repariert werden — Werkzeug und Werkstück im selben Branch. Getrennt
bleibt der Testlauf sauber, und jeder Lauf ist einer Werkzeugfassung zuzuordnen.

## Ausrollen

```bash
just sync-trocken    # zeigen, was sich ändern würde
just sync            # tools/*.mjs und ops.py nach ../ops-lab-test kopieren
just ops-test        # Lagebild des Testrepos von hier aus
```

`just sync` überschreibt im Zielrepo. Was dort eigene Inhalte trägt — `justfile`, `CLAUDE.md`,
`openspec/config.yaml`, `.github/` — wird nicht angefasst. `sync.mjs` selbst bleibt hier.

Nach dem Ausrollen im Zielrepo committen, damit ein Lauf einer Werkzeugfassung zuzuordnen ist:
`git -C ../ops-lab-test commit -am "Tooling aus ops-lab <hash>"`.

## Das Werkzeug

| Datei | Wofür |
|---|---|
| `tools/gate.mjs` | die drei Gates: Dateizugriff, Kindprozesse, Nachweis |
| `tools/pruefungen.mjs` | was ein Gate über einen Text entscheidet — rein und getestet |
| `tools/neu.mjs` | Change anlegen: Arbeitsraum, Branch, Ordner, vier Artefakte |
| `tools/pfade.mjs` | Pfade, die Claude Code und die Arbeitsräume bilden |
| `tools/tokens.mjs` | Token je Lauf aus den Sitzungsmitschriften |
| `tools/sync.mjs` | Ausrollen ins Testrepo |
| `ops.py` | Lagebild: Stand, Fortschritt, nächste freie Changes, Verbindungen |

### Die Gates halten maschinell

Ein Gate ist ein Befehl mit Exit-Code, keine Bestätigung. **Kein Gate fragt einen Menschen,
keines lässt sich überspringen, ein rotes Gate schreibt keine Datei.** Es gibt kein Ventil
und keine Umgehungsvariable — wer das Gate umgehen will, muss den Code ändern, und das steht
im Diff.

**Gate 1 — der Plan** (8 Prüfungen). G1-1 keine Platzhalter der Vorlage mehr · G1-2
`proposal.md` hat Warum, Änderung, Abgrenzung und Berührte Dateien · G1-3 mindestens eine
Delta-Spec mit Delta-Block · G1-4 jedes Requirement hat ein Szenario · G1-5 eine bis acht
Aufgaben · G1-6 `tasks.md` nennt die Testdateien · G1-7 `openspec validate --strict` ·
G1-8 am `justfile` wurde nur angehängt.

G1-1 ist nachgerüstet: ohne sie bestand ein frisch angelegter Change sechs von sieben
Prüfungen, weil die Vorlage die richtigen Überschriften trägt und lang genug ist.
G1-6 ist der Punkt, an dem „keine Tests" auffliegt.

G1-8 macht eine Ausnahme prüfbar. Zwei Changes laufen nur parallel, wenn ihre Dateimengen
disjunkt sind — das `justfile` fasst aber fast jeder an, und ohne Ausnahme wäre
Parallelbetrieb faktisch nie möglich. Die Ausnahme gilt, solange ein Change dort **nur
anhängt**: `git diff --numstat` gegen den gemeinsamen Vorfahren muss null entfernte Zeilen
ausweisen. Sie gilt für diese eine Datei, nicht für `CLAUDE.md` oder `tools/`.

**Gate 2 — der rote Test** (4 Prüfungen). G2-1 `gate1.md` liegt vor · G2-2 die zugesagten
Testdateien existieren · G2-3 mindestens eine ist gegenüber `main` neu oder geändert ·
G2-4 der Testlauf schlägt fehl (Exit ≠ 0).

**Abschluss** (4 Prüfungen). F-1/F-2 beide Gates liegen vor · F-3 keine offene Aufgabe ·
F-4 der Testlauf ist grün. Ohne `fertig.md` verweigert `just pr` den Push.

**Was die Gates nicht können:** ob der rote Test die richtige Sache prüft. Das bleibt am
Menschen — eine Frage der Qualität, keine des Ablaufs.

### Jede Gate-Regel hat einen Test

`tools/pruefungen.mjs` enthält nur reine Textfunktionen; `tests/pruefungen.test.mjs` prüft
jede davon. Ein Gate, das sich nicht prüfen lässt, ist selbst nur eine Behauptung.

Neue Gate-Regel heißt: Funktion in `pruefungen.mjs`, Test in `pruefungen.test.mjs`,
Verdrahtung in `gate.mjs`. In dieser Reihenfolge.

### Jeder Change hat seinen eigenen Arbeitsraum

**Der Hauptordner bleibt auf `main`.** `just neu` wechselt den Branch nicht, sondern legt
unter `.claude/worktrees/<kennung>` einen eigenen git-Arbeitsbaum an und checkt
`change/<kennung>` dort aus. Gearbeitet wird in diesem Verzeichnis, nicht hier.

```bash
just neu beispiel arbeitsraum     # legt .claude/worktrees/beispiel an
cd .claude/worktrees/beispiel     # dort wird gearbeitet
git worktree list                 # zeigt alle Arbeitsräume
```

Der Grund steht im Bestand: vier Commits lagen auf `change/beleg-bild`, obwohl nur zwei zu
einem Change gehörten — zwei davon mischten Werkzeugreparatur und Change-Artefakte im
selben Commit, weil der Hauptordner nach `just neu` auf dem falschen Branch stand. Mit
getrennten Arbeitsräumen kann das nicht mehr passieren, und mehrere Agenten arbeiten
gleichzeitig, ohne einander zu überschreiben.

Arbeitsräume sind in `.gitignore` ausgenommen und werden **nicht automatisch entfernt**:
sie enthalten alles, was nicht committet wurde, und das wäre nicht wiederherstellbar.
Aufräumen ist ein bewusster Handgriff — `git worktree remove <pfad>`.

## Befehle

| Zweck | Befehl |
|---|---|
| Ausrollen | `just sync`, `just sync-trocken` |
| Lagebild hier / im Testrepo | `just ops`, `just ops-test` |
| Lagebild im Browser | `just web`, `just web-trocken` |
| Lint und Tests | `just lint`, `just test`, `just alles` |
| Token je Lauf | `just tokens`, `just tokens-json` |

Der Ablauf selbst (`just neu`, `gate1`, `gate2`, `fertig`, `pr`) steht hier ebenfalls zur
Verfügung — Änderungen am Werkzeug laufen durch denselben Ablauf, den sie durchsetzen.

## Was im Labor gemessen wird

1. **Token je Lauf** — `just tokens`. Eine Änderung am Ablauf gilt erst als Verbesserung,
   wenn die Zahl fällt **und** die Gates weiter halten.
   Die Messung liest die Mitschriften des **Arbeitsverzeichnisses**. Ein Lauf ist also nur
   messbar, wenn die Sitzung im gemessenen Repo gestartet wurde; wer von außen darauf
   zugreift, taucht in dessen Zahlen nicht auf. Eine Sitzung, ein Repo, ein Lauf.
2. **Sauber abgearbeitet** — `fertig.md` je Change ist der Beleg. Fehlt er, war der Lauf
   nicht vollständig, egal was im Verlauf steht.
3. **Parallelbetrieb** — `just ops-test` zeigt unter *Nächste freie Changes*, was sich ohne
   Merge-Konflikt starten lässt. Ein Konflikt, der dort vorher sichtbar war, ist ein Fehler
   im Zuschnitt, nicht im Werkzeug.

Befunde aus dem Einsatz stehen in `../ops-lab-test/docs/beobachtungen.md`; offene Punkte am
Werkzeug in `docs/beobachtungen.md`.

## Arbeitsweise

- Vorsichtig und konservativ; im Zweifel fragen.
- Maximal drei Anläufe für dasselbe Problem; danach anhalten und den Stand berichten.
- Kein `git push` und kein Merge ohne ausdrückliche Anweisung in der aktuellen Aufgabe.
  **Eine benannte Ausnahme: der Leitstand.** Liegen gate1.md, gate2.md und fertig.md im
  Change und hat der Pull Request seine Prüfungen bestanden, merged er ohne weitere
  Rückfrage. Meldet der Pull Request keine Prüfungen, tritt ein grüner Lauf von
  `just alles` an ihre Stelle; ein unbekannter Zustand gilt nicht als bestanden. Fehlt
  ein Nachweis oder ist der Zustand nicht grün, fragt er nach. Das Urteil fällt
  `mergeErlaubt` in `tools/leitstand.mjs`, nicht die Einschätzung im Verlauf. Für alles
  andere — und für jeden, der nicht der Leitstand ist — bleibt die Regel wie sie steht.
- Nichts löschen: Changes werden archiviert, nicht entfernt.
- Neues Verhalten und Bugfixes kommen mit Tests. Bugfix heißt: erst der Regressionstest.
- Tests werden nicht abgeschwächt, geskippt oder gelöscht, um grün zu werden.

## Sprache

Prosa, Meldungen und Nachweise deutsch, in der Sie-Form. Bezeichner im Code deutsch wie im
Bestand.

## Technik

Reines Node (≥ 22) mit `node --test`, Python aus der Standardbibliothek für `ops.py`.
Kein `package.json`, kein Build, kein Paketmanager, keine Abhängigkeit.

**Eine Ausnahme: `ops.py --web`.** Die Web-Ansicht braucht FastAPI und uvicorn und holt
sie über `uv run --with` zur Laufzeit — `just web`. Das Repo bleibt trotzdem ohne
Abhängigkeitsdatei, ohne Lock und ohne venv, und der Import steht innerhalb der Funktion,
die `--web` bedient. Damit laufen `--once`, `--graph`, `--json`, `--count` und
`--selftest` nachweisbar weiter mit der Standardbibliothek allein; `tests/lagebild-web.test.mjs`
prüft genau das und geht selbst durch `--web --trocken`, also ohne Fremdcode.

Der Grundsatz ist damit präzisiert, nicht aufgegeben: **das Lagebild bleibt
abhängigkeitsfrei, ein zusätzlicher optionaler Befehl ist es nicht.** Kein Gate hängt an
`--web`. Wer eine weitere Bibliothek will, braucht dafür denselben Weg — Aufruf über
`uv run --with`, Import in der Funktion — oder einen Change, der diesen Satz ändert.
