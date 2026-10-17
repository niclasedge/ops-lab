#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ops.py — Live-Statusboard der OpenSpec-Changes ueber alle Git-Worktrees.

Das Werkzeug beantwortet auf einen Blick:

  * Welcher Change steht in welchem Worktree, auf welchem Branch, wie weit ist er?
  * Welche Aufgabe wurde zuletzt bearbeitet, welche kommt als naechste?
  * Welche Artefakte des OpenSpec-Schemas fehlen noch (proposal -> specs/design -> tasks)?
  * Welche Specs (Capabilities) beruehren sich zwischen den Worktrees?
  * Was hat sich waehrend des Zusehens geaendert (Aufgabe abgeschlossen, Change fertig)?

Es liest ausschliesslich — Worktrees, `git status`, `git log`, `openspec/` — und schreibt nie
in das Repository. Laeuft ohne Fremdbibliotheken (nur Python-Standardbibliothek, 3.10+).

Aufrufe:

    python3 ops.py                 Live-Ansicht, Aktualisierung jede Sekunde
    python3 ops.py --once          ein Stand, dann Ende (für Skripte und Abnahmen)
    python3 ops.py --graph         Aufgaben-Graph: Changes zeitlich einsortiert samt Kanten
    python3 ops.py --json          derselbe Stand maschinenlesbar
    python3 ops.py --count         nur die Kennzahlen als JSON
    python3 ops.py --interval 0.5  Aktualisierungstakt in Sekunden
    python3 ops.py --root /pfad    ein anderes Repo beobachten
    python3 ops.py --worktree wt-  nur Worktrees, deren Pfad passt
    python3 ops.py --no-color      ohne Farben
    python3 ops.py --selftest      deterministische Parser-Tests ausführen

In der Live-Ansicht: `g` wechselt zwischen Board und Aufgaben-Graph, `r` liest neu ein,
`q` beendet. `Ctrl+C` jederzeit.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import mimetypes
import os
import re
import select
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

# ----------------------------------------------------------------------------- Farben

RESET = "\x1b[0m"
BOLD = "1"
DIM = "2"
# Red accent color for the live view.
ACCENT_RED = "38;2;227;0;15"
GREEN = "32"
YELLOW = "33"
CYAN = "36"
GREY = "90"
WHITE = "97"
RED = "31"

_color_on = True


def c(text: str, *codes: str) -> str:
    """Faerbt Text, sofern Farben aktiv sind. Ohne Farben bleibt der Text nackt."""
    if not _color_on or not codes:
        return text
    return "".join(f"\x1b[{code}m" for code in codes) + text + RESET


_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
# Zeichen ohne eigene Breite: Verbinder, Variation Selectors.
_ZERO_WIDTH = {"\u200b", "\u200c", "\u200d", "\ufe0e", "\ufe0f"}


def _char_width(ch: str) -> int:
    if ch in _ZERO_WIDTH or unicodedata.combining(ch):
        return 0
    # Volle und breite Zeichen belegen in der Regel zwei Spalten; die Oberfläche vermeidet
    # Zeichen mit Emoji-Presentation, weil deren Breite je Terminal abweicht.
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def visible_width(text: str) -> int:
    return sum(_char_width(ch) for ch in _ANSI_RE.sub("", text))


def cut_visible(text: str, width: int) -> str:
    """Kuerzt auf sichtbare Breite und laesst ANSI-Sequenzen unangetastet."""
    if visible_width(text) <= width:
        return text
    out = []
    used = 0
    i = 0
    while i < len(text):
        if text[i] == "\x1b":
            match = _ANSI_RE.match(text, i)
            if match:
                out.append(match.group(0))
                i = match.end()
                continue
        step = _char_width(text[i])
        if used + step > width:
            break
        out.append(text[i])
        used += step
        i += 1
    return "".join(out) + RESET


# ----------------------------------------------------------------------------- Shell

@dataclass
class Result:
    rc: int
    out: str
    err: str


def run(cmd: list[str], cwd: Path | str, timeout: float = 10.0) -> Result:
    """Fuehrt ein Kommando aus und faengt Fehler ab statt sie zu werfen.

    `GIT_OPTIONAL_LOCKS=0` haelt `git status` davon ab, den Index nebenbei zu erneuern: das
    Werkzeug soll die Worktrees beobachten, nicht in ihr `.git` schreiben.
    """
    env = {**os.environ, "GIT_OPTIONAL_LOCKS": "0"}
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
            errors="replace",
            env=env,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return Result(1, "", str(exc))
    return Result(proc.returncode, proc.stdout, proc.stderr)


def git(cwd: Path | str, args: list[str], timeout: float = 10.0) -> Result:
    return run(["git", "-C", str(cwd), *args], cwd, timeout)


# ----------------------------------------------------------------------------- Datenmodell
#
# Die Artefakt-Abhaengigkeiten des OpenSpec-Schemas `spec-driven`. `openspec status --all
# --json` liefert genau diesen Baum; er ist hier hinterlegt, damit ops.py auch ohne die
# openspec-CLI laeuft und nicht bei jeder Aktualisierung einen Node-Prozess starten muss.
SCHEMA_SPEC_DRIVEN: dict[str, list[str]] = {
    "proposal": [],
    "specs": ["proposal"],
    "design": ["proposal"],
    "tasks": ["specs", "design"],
}

# Zwischenspeicher: Dateistand -> zuletzt abgeschlossener Task (spart `git log -p` je Takt).
_COMPLETION_CACHE: dict[tuple, dict | None] = {}

INPUT_MARKER = re.compile(r"^\s*[-*]\s*\[([ xX])\]\s*(.*)$")
NUMBER_MARKER = re.compile(r"^(\d+(?:\.\d+)*)[.)]?\s+(.*)$")
SECTION_MARKER = re.compile(r"^#{1,4}\s+(.*\S)\s*$")
CONTINUATION = re.compile(r"^[ \t]+\S")


@dataclass
class Task:
    key: str
    number: str
    text: str
    done: bool
    section: str
    line: int


@dataclass
class Change:
    name: str
    path: Path
    worktree_path: str
    worktree_name: str
    schema: str
    done: int
    total: int
    status: str
    sections: list[tuple[str, int, int]]
    tasks: list[Task]
    artifacts: list[dict]
    touched_specs: list[str]
    new_caps: list[str]
    modified_caps: list[str]
    references: list[str]
    shared_specs: list[str]
    mtime: float
    completions: list[dict]
    last_completed: dict | None
    next_task: dict | None
    gates: list[str] = field(default_factory=list)
    blocked_by: list[str] = field(default_factory=list)
    im_pr: bool = False

    @property
    def percent(self) -> float:
        return (100.0 * self.done / self.total) if self.total else 100.0

    @property
    def readiness(self) -> str:
        """Wie ein Change zum Parallelbetrieb steht.

        `frei` heisst: noch nicht begonnen und keine Capability, an der gerade jemand
        anders arbeitet. Das ist die Menge, die sich ohne Merge-Konflikt starten laesst.

        `im PR` steht zwischen fertig und archiviert: die Aufgaben sind erledigt, der
        Branch liegt auf dem Remote, es fehlt der Merge. Ohne diesen Zustand sieht ein
        Change, der seit Tagen auf Review wartet, aus wie einer, der eben fertig wurde.
        """
        if self.total and self.done == self.total:
            return "im PR" if self.im_pr else "fertig"
        if self.done > 0:
            return "laeuft"
        return "blockiert" if self.blocked_by else "frei"


@dataclass
class Worktree:
    path: Path
    name: str
    branch: str
    head: str
    subject: str
    commit_time: str
    is_main: bool
    detached: bool
    ahead: int
    behind: int
    staged: int
    modified: int
    untracked: int
    changes: list[Change] = field(default_factory=list)
    archived_count: int = 0
    archived_last: str = ""
    error: str = ""

    @property
    def dirty(self) -> int:
        return self.staged + self.modified + self.untracked


# ----------------------------------------------------------------------------- Parser

def read_text(path: Path, limit: int = 400_000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[:limit]
    except OSError:
        return ""


def parse_tasks(text: str) -> list[Task]:
    """Liest die Kontrollkaestchen aus `tasks.md` samt Abschnitt und Nummer.

    Fortsetzungszeilen (eingerueckte Zeilen ohne Aufzaehlungszeichen) werden an den Text der
    vorigen Aufgabe gehaengt, damit eine umbrochene Aufgabe nicht zerschnitten wird.
    """
    tasks: list[Task] = []
    section = "(ohne Abschnitt)"
    current: Task | None = None
    for index, raw in enumerate(text.splitlines()):
        stripped = raw.strip()
        if not stripped:
            current = None
            continue
        section_match = SECTION_MARKER.match(raw)
        if section_match:
            section = section_match.group(1)
            current = None
            continue
        if stripped.startswith(">"):
            current = None
            continue
        marker = INPUT_MARKER.match(raw)
        if marker:
            number = ""
            label = marker.group(2).strip()
            number_match = NUMBER_MARKER.match(label)
            if number_match:
                number, label = number_match.group(1), number_match.group(2)
            task = Task(
                key=f"{section}|{number or '@' + str(index)}",
                number=number,
                text=label,
                done=marker.group(1).lower() == "x",
                section=section,
                line=index,
            )
            tasks.append(task)
            current = task
            continue
        if current is not None and CONTINUATION.match(raw):
            current.text = f"{current.text} {stripped}"
    return tasks


CAP_SECTION = re.compile(r"^#{2,4}\s+(New Capabilities|Modified Capabilities)\s*$")
CAP_ITEM = re.compile(r"^\s*[-*]\s+`?([a-z0-9][a-z0-9-]+)`?")


def parse_capabilities(text: str) -> tuple[list[str], list[str]]:
    new_caps: list[str] = []
    modified: list[str] = []
    bucket: list[str] | None = None
    for line in text.splitlines():
        section = CAP_SECTION.match(line)
        if section:
            bucket = new_caps if section.group(1) == "New Capabilities" else modified
            continue
        if line.startswith("##") and not CAP_SECTION.match(line):
            bucket = None
            continue
        if bucket is not None:
            item = CAP_ITEM.match(line)
            if item:
                bucket.append(item.group(1))
    return new_caps, modified


def parse_schema(config_text: str) -> str:
    match = re.search(r"^schema:\s*(\S+)", config_text, re.MULTILINE)
    return match.group(1) if match else "spec-driven"


# Wie proposal.md seine Abschnitte ueberschreibt. Beide Schreibweisen gelten: der
# Bestand traegt die Ueberschriften mit und ohne Umlaut, und eine Ansicht, die nur
# eine davon liest, faende bei der Haelfte der Changes nichts.
PROPOSAL_MUSTER = {
    "warum": r"Warum",
    "abgrenzung": r"Was\s+ausdr(?:ue|ü)cklich\s+nicht",
    "dateien": r"Ber(?:ue|ü)hrte\s+Dateien",
}

LISTENPUNKT = re.compile(r"^\s*[-*]\s+(.+?)\s*$")
IN_BACKTICKS = re.compile(r"`([^`]+)`")
DELTA_BLOCK = re.compile(r"^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$")
REQ_TITEL = re.compile(r"^###\s+Requirement:\s*(.+?)\s*$")
SZENARIO = re.compile(r"^####\s+Scenario:")


def proposal_teile(text: str) -> dict:
    """Die Abschnitte einer `proposal.md` als Fliesstext, ohne ihre Ueberschriftenzeile.

    Rein und ohne Dateizugriff. Ein Abschnitt, den die Datei nicht enthaelt, kommt als
    leerer Text zurueck -- das Fehlen ist eine Auskunft und wird nicht zur Ausnahme.
    """
    teile: dict[str, str] = {}
    for name, muster in PROPOSAL_MUSTER.items():
        treffer = re.search(rf"^##\s*{muster}\b[^\n]*\n(.*?)(?=^##\s|\Z)", text,
                            re.MULTILINE | re.DOTALL)
        teile[name] = treffer.group(1).strip() if treffer else ""
    return teile


def zugesagte_dateien(text: str) -> list[str]:
    """Die Pfade, die `## Berührte Dateien` zusagt -- sortiert und ohne Dopplung.

    Der Bestand schreibt sie in Backticks, oft mit einem Zusatz in Klammern dahinter.
    Ohne Backticks gilt das erste Wort der Aufzaehlungszeile; eine Zusage soll nicht
    stillschweigend verschwinden, nur weil jemand die Backticks vergessen hat.
    """
    pfade = []
    for zeile in proposal_teile(text)["dateien"].splitlines():
        punkt = LISTENPUNKT.match(zeile)
        if not punkt:
            continue
        inhalt = punkt.group(1)
        backtick = IN_BACKTICKS.search(inhalt)
        pfad = (backtick.group(1) if backtick else inhalt.split(" ")[0]).strip()
        if pfad:
            pfade.append(pfad)
    return sorted(set(pfade))


def requirement_titel(text: str) -> list[dict]:
    """Die Requirements einer Delta-Spec als Art, Titel und Zahl ihrer Szenarien.

    Der Fliesstext bleibt draussen, und zwar mit Absicht: `openspec validate` warnt in
    diesem Repo schon heute ueber Requirements jenseits von 500 Zeichen. Der Titel und
    die Zahl der Faelle sagen, worum es geht; die Datei sagt den Rest.

    Gezaehlt wird nur innerhalb eines Delta-Blocks. Ein Requirement ausserhalb gehoert
    keinem Delta an -- die Spec einer Capability traegt dieselben Ueberschriften.
    """
    eintraege: list[dict] = []
    art = ""
    for zeile in text.splitlines():
        block = DELTA_BLOCK.match(zeile)
        if block:
            art = block.group(1)
            continue
        if zeile.startswith("## "):
            art = ""
            continue
        if not art:
            continue
        titel = REQ_TITEL.match(zeile)
        if titel:
            eintraege.append({"art": art, "titel": titel.group(1), "szenarien": 0})
            continue
        if SZENARIO.match(zeile) and eintraege:
            eintraege[-1]["szenarien"] += 1
    return eintraege


def deckt(zusage: str, pfad: str) -> bool:
    """Deckt eine Zusage diesen Pfad? Ein Eintrag mit Schrägstrich am Ende meint den Ordner.

    Jedes Vorhaben sagt seinen eigenen Change-Ordner zu -- ohne diese Regel stuende er
    als *nur zugesagt* da und jede Datei darin als *nur angefasst*. Das waere Rauschen
    an genau der Stelle, an der jeder Change gleich aussieht.
    """
    return pfad == zusage or (zusage.endswith("/") and pfad.startswith(zusage))


def dateien_abgleich(zugesagt: list[str], angefasst: list[str]) -> list[dict]:
    """Zusage gegen Diff, nach Pfad sortiert, in drei Lagen.

    `beides` heisst zugesagt und angefasst, `nur_zugesagt` angekuendigt und nicht
    angefasst, `nur_angefasst` angefasst ohne Zusage. Die Deckung steht ausdruecklich
    dabei: sie ist das Ergebnis, nach dem der Parallelbetrieb fragt, und nichts, was
    man weglaesst, weil es unauffaellig ist.
    """
    zusage = sorted(set(zugesagt))
    diff = sorted(set(angefasst))
    eintraege = [
        {"pfad": pfad,
         "lage": "beides" if any(deckt(pfad, anderer) for anderer in diff) else "nur_zugesagt"}
        for pfad in zusage
    ]
    eintraege += [
        {"pfad": pfad, "lage": "nur_angefasst"}
        for pfad in diff if not any(deckt(z, pfad) for z in zusage)
    ]
    return sorted(eintraege, key=lambda eintrag: eintrag["pfad"])


def newest_mtime(path: Path) -> float:
    """Jüngste Änderungszeit unterhalb eines Verzeichnisses (ohne `.git`)."""
    newest = 0.0
    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if d != ".git"]
            for name in files:
                try:
                    newest = max(newest, os.path.getmtime(os.path.join(root, name)))
                except OSError:
                    pass
    except OSError:
        pass
    if newest:
        return newest
    try:
        return path.stat().st_mtime
    except OSError:
        return 0.0


def artifact_states(change_dir: Path, schema: str) -> list[dict]:
    """Status der Schema-Artefakte samt ihrer Abhaengigkeiten (`requires`).

    Nur das Schema `spec-driven` ist hinterlegt; ein anderes Schema wuerde hier stillschweigend
    wie dieses behandelt, deshalb faellt die Auswahl ausdruecklich darauf zurueck.
    """
    graph = SCHEMA_SPEC_DRIVEN  # nur dieses Schema ist hinterlegt; Abweichung wird angezeigt
    states: list[dict] = []
    for artifact_id, requires in graph.items():
        present = False
        try:
            if artifact_id == "specs":
                specs_dir = change_dir / "specs"
                present = specs_dir.is_dir() and any(specs_dir.glob("**/spec.md"))
            else:
                candidate = change_dir / f"{artifact_id}.md"
                present = candidate.is_file() and candidate.stat().st_size > 0
        except OSError:
            present = False
        states.append({"id": artifact_id, "status": "done" if present else "missing", "requires": list(requires)})
    return states


GATE_DATEIEN = ("gate1", "gate2", "fertig")


def gate_states(change_dir: Path) -> list[str]:
    """Welche Gate-Nachweise im Change-Ordner liegen.

    Ein Gate schreibt seine Datei nur, wenn alle Pruefungen bestanden sind; ihr
    Vorhandensein ist damit der Fortschritt im Ablauf. Repos ohne Gates liefern eine
    leere Liste und zeigen die Zeile gar nicht erst an.
    """
    vorhanden = []
    for name in GATE_DATEIEN:
        datei = change_dir / f"{name}.md"
        try:
            if datei.is_file() and datei.stat().st_size > 0:
                vorhanden.append(name)
        except OSError:
            pass
    return vorhanden


# Welcher Nachweis den Zeitpunkt eines Laufs nennt. Der Abschluss steht vorn; wo er
# fehlt, ruecken die frueheren nach -- ein Lauf, der es nur bis Gate 1 gebracht hat, hat
# wenigstens diesen Zeitpunkt.
NACHWEIS_ORDNUNG = ("fertig", "gate2", "gate1")


def nachweis_datum(text: str) -> str:
    """Den Zeitpunkt aus einem Gate-Nachweis -- oder nichts.

    Jeder Nachweis traegt eine Zeile `- Datum: <ISO>`; gelesen wird die erste davon.
    Rein und ohne Dateizugriff, damit die Regel ohne Dateisystem pruefbar bleibt.
    """
    treffer = re.search(r"^- Datum:\s*(\S+)", text, re.MULTILINE)
    return treffer.group(1) if treffer else ""


def abschluss_zeit(change_dir: Path) -> str:
    """Wann ein Change abgeschlossen wurde, laut seinen Nachweisen -- oder nichts.

    Der Ordnername im Archiv traegt zwar ein Datum, aber nur ein Datum. An einem Tag mit
    dreizehn Laeufen sagt er nichts darueber, welcher zuerst kam; die Nachweise sagen es
    auf die Millisekunde.
    """
    for name in NACHWEIS_ORDNUNG:
        zeit = nachweis_datum(read_text(change_dir / f"{name}.md"))
        if zeit:
            return zeit
    return ""


def touched_specs(change_dir: Path) -> list[str]:
    specs_dir = change_dir / "specs"
    try:
        if not specs_dir.is_dir():
            return []
        return sorted(entry.name for entry in specs_dir.iterdir() if (entry / "spec.md").exists())
    except OSError:
        return []


def git_completions(worktree: Path, rel: str, head: str = "") -> list[dict]:
    """Alle im Verlauf nachweisbaren Fertigstellungen einer `tasks.md`, jüngste zuerst.

    Eine Fertigstellung liegt vor, wenn in einem Hunk `- [ ] 2.3 …` verschwindet und dieselbe
    Nummer als `+ [x] 2.3 …` erscheint. Ein blosses Anlegen der Datei mit fertigen Kaestchen
    zaehlt damit nicht als Fertigstellung. Der Schluessel enthaelt HEAD, damit ein Commit —
    der die Arbeitsdatei nicht anfasst — das Ergebnis nicht veralten laesst.
    """
    tasks_md = worktree / rel
    try:
        stat = tasks_md.stat()
        cache_key = (str(tasks_md), stat.st_mtime_ns, stat.st_size, head)
    except OSError:
        cache_key = (str(tasks_md), 0, 0, head)
    if cache_key in _COMPLETION_CACHE:
        return _COMPLETION_CACHE[cache_key]

    result = git(
        worktree,
        ["log", "-p", "--unified=0", "-n", "200", "--format=@@@%h%x1f%cI%x1f%s", "--", rel],
        timeout=15,
    )
    # Ohne Historie (z. B. noch nicht committet) ist das Ergebnis endgueltig; mitgespeichert
    # wird es trotzdem, HEAD und Dateistand im Schluessel brechen den Cache bei Aenderung.
    if result.rc != 0 or not result.out.strip():
        _COMPLETION_CACHE[cache_key] = []
        return []

    flips: list[dict] = []
    commit = stamp = subject = ""
    removed: dict[str, str] = {}
    added: dict[str, str] = {}

    def finish() -> None:
        # Mehrere Aufgaben in einem Commit: die hoechste Nummer ist die zuletzt erledigte.
        for number in sorted(set(added) & set(removed), key=_task_order, reverse=True):
            flips.append({"number": number, "text": added[number], "at": stamp,
                          "commit": commit, "commit_subject": subject, "source": "git"})

    for line in result.out.splitlines():
        if line.startswith("@@@"):
            finish()
            commit, stamp, subject = (line[3:].split("\x1f") + ["", "", ""])[:3]
            removed, added = {}, {}
            continue
        if line.startswith("@@"):
            finish()
            removed, added = {}, {}
            continue
        # Eine entfernte Diff-Zeile lautet `-- [ ] 2.3 …`, eine hinzugefuegte `+- [x] 2.3 …`:
        # das erste Zeichen ist das Diff-Zeichen, `line[1:]` die eigentliche Zeile.
        if line[:1] in ("+", "-") and not line.startswith(("+++", "---")):
            marker = INPUT_MARKER.match(line[1:])
            if not marker:
                continue
            label = marker.group(2).strip()
            number_match = NUMBER_MARKER.match(label)
            number = number_match.group(1) if number_match else "?"
            if line[0] == "-" and marker.group(1) == " ":
                removed[number] = label
            elif line[0] == "+" and marker.group(1).lower() == "x":
                added[number] = label
    finish()
    if len(_COMPLETION_CACHE) > 500:
        _COMPLETION_CACHE.clear()
    _COMPLETION_CACHE[cache_key] = flips
    return flips


def build_change(change_dir: Path, worktree: Worktree, archived: bool) -> Change:
    tasks_text = read_text(change_dir / "tasks.md")
    tasks = parse_tasks(tasks_text)
    done = sum(1 for task in tasks if task.done)
    total = len(tasks)

    sections: list[tuple[str, int, int]] = []
    for task in tasks:
        for index, (name, d, t) in enumerate(sections):
            if name == task.section:
                sections[index] = (name, d + (1 if task.done else 0), t + 1)
                break
        else:
            sections.append((task.section, 1 if task.done else 0, 1))

    if total == 0:
        status = "ohne Aufgaben"
    elif done == total:
        status = "fertig"
    elif done == 0:
        status = "offen"
    else:
        status = "in Arbeit"

    mtime = newest_mtime(change_dir)
    completions: list[dict] = []
    if not archived:
        rel = os.path.relpath(change_dir / "tasks.md", worktree.path)
        completions = git_completions(worktree.path, rel, worktree.head)
    last_completed = completions[0] if completions else None
    if last_completed is None and tasks:
        completed = [task for task in tasks if task.done]
        if completed:
            last = completed[-1]
            last_completed = {
                "number": last.number,
                "text": last.text,
                "at": dt.datetime.fromtimestamp(mtime).astimezone().isoformat(timespec="seconds") if mtime else "",
                "commit": "",
                "commit_subject": "",
                "source": "Datei",
            }
    next_task = None
    for task in tasks:
        if not task.done:
            next_task = {"number": task.number, "text": task.text}
            break

    proposal = read_text(change_dir / "proposal.md")
    new_caps, modified_caps = parse_capabilities(proposal)
    schema = parse_schema(read_text(worktree.path / "openspec" / "config.yaml"))

    return Change(
        name=change_dir.name,
        path=change_dir,
        worktree_path=str(worktree.path),
        worktree_name=worktree.name,
        schema=schema,
        done=done,
        total=total,
        status=status,
        sections=sections,
        tasks=tasks,
        artifacts=artifact_states(change_dir, schema),
        touched_specs=touched_specs(change_dir),
        new_caps=new_caps,
        modified_caps=modified_caps,
        references=[],
        shared_specs=[],
        mtime=mtime,
        completions=completions,
        last_completed=last_completed,
        next_task=next_task,
        gates=gate_states(change_dir),
    )


def parse_status(output: str) -> tuple[str, bool, int, int, int, int, int]:
    """Liest `git status --porcelain=v1 -b`: Branch, abgesetzt, Kopf-Tracking, Zaehler."""
    branch = "(unbekannt)"
    detached = False
    ahead = behind = 0
    staged = modified = untracked = 0
    for line in output.splitlines():
        if line.startswith("## "):
            header = line[3:].strip()
            if header.startswith("HEAD (no branch)"):
                detached = True
                branch = "(abgesetzt)"
            elif "..." in header:
                branch = header.split("...")[0]
            elif header.startswith("No commits yet on "):
                branch = header[len("No commits yet on "):]
            else:
                branch = header.split(" ")[0]
            ahead_match = re.search(r"ahead (\d+)", header)
            behind_match = re.search(r"behind (\d+)", header)
            ahead = int(ahead_match.group(1)) if ahead_match else 0
            behind = int(behind_match.group(1)) if behind_match else 0
            continue
        if len(line) < 3:
            continue
        index_state, work_state = line[0], line[1]
        if index_state == "?":
            untracked += 1
        else:
            if index_state not in (" ",):
                staged += 1
            if work_state not in (" ",):
                modified += 1
    return branch, detached, ahead, behind, staged, modified, untracked


def discover_worktrees(root: Path) -> list[Path]:
    """Alle Worktrees des Repos: aus `git worktree list` plus benachbarte, nicht eingetragene."""
    paths: list[Path] = []
    result = git(root, ["worktree", "list", "--porcelain"])
    if result.rc == 0:
        for line in result.out.splitlines():
            if line.startswith("worktree "):
                paths.append(Path(line[len("worktree "):].strip()))
    known = {p.resolve() for p in paths}

    # Ergaenzung: benachbarte `*-wt-*` und `.claude/worktrees/*`, falls nicht eingetragen.
    candidates: list[Path] = []
    try:
        candidates += sorted(root.parent.glob(f"{root.name}-wt-*"))
    except OSError:
        pass
    try:
        candidates += sorted((root / ".claude" / "worktrees").glob("*"))
    except OSError:
        pass
    for candidate in candidates:
        if candidate.is_dir() and (candidate / ".git").exists() and candidate.resolve() not in known:
            paths.append(candidate)
            known.add(candidate.resolve())

    def order(path: Path) -> tuple[int, str]:
        return (0 if path.resolve() == root.resolve() else 1, str(path))

    return sorted({p.resolve() for p in paths}, key=order)


def read_worktree(path: Path, root: Path) -> Worktree:
    name = path.name
    wt = Worktree(
        path=path, name=name, branch="(unbekannt)", head="", subject="", commit_time="",
        is_main=path.resolve() == root.resolve(), detached=False,
        ahead=0, behind=0, staged=0, modified=0, untracked=0,
    )
    if not path.exists():
        wt.error = "Pfad fehlt"
        return wt

    status = git(path, ["status", "--porcelain=v1", "-b"])
    if status.rc == 0:
        (wt.branch, wt.detached, wt.ahead, wt.behind,
         wt.staged, wt.modified, wt.untracked) = parse_status(status.out)

    log = git(path, ["log", "-1", "--format=%h%x1f%cI%x1f%s"])
    if log.rc == 0 and log.out.strip():
        parts = (log.out.strip().split("\x1f") + ["", "", ""])[:3]
        wt.head, wt.commit_time, wt.subject = parts

    changes_dir = path / "openspec" / "changes"
    if changes_dir.is_dir():
        for entry in sorted(changes_dir.iterdir()):
            if not entry.is_dir() or entry.name == "archive":
                continue
            if not (entry / "tasks.md").exists() and not (entry / "proposal.md").exists():
                continue
            wt.changes.append(build_change(entry, wt, archived=False))
        archive_dir = changes_dir / "archive"
        if archive_dir.is_dir():
            archived = sorted(e for e in archive_dir.iterdir() if e.is_dir())
            wt.archived_count = len(archived)
            wt.archived_last = archived[-1].name if archived else ""
    elif not (path / ".git").exists():
        wt.error = "kein Repository"
    return wt


# ----------------------------------------------------------------------------- Einsammeln

def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def stamp(epoch: float) -> str:
    if not epoch:
        return "—"
    return dt.datetime.fromtimestamp(epoch).astimezone().strftime("%H:%M:%S")


def short(text: str, length: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= length else text[: length - 1] + "…"


def mentions(text: str, name: str) -> bool:
    """Nennt der Text den Namen als ganzes Wort? `add-karte` darf `add-karte-filter` nicht treffen."""
    return bool(re.search(rf"(?<![A-Za-z0-9-]){re.escape(name)}(?![A-Za-z0-9-])", text))


def link_references(all_changes: list[Change]) -> None:
    """Querverweise und gemeinsame Specs zwischen den Changes der Worktrees eintragen."""
    by_spec: dict[str, list[Change]] = {}
    for change in all_changes:
        for spec in change.touched_specs:
            by_spec.setdefault(spec, []).append(change)

    names = {change.name for change in all_changes}
    for change in all_changes:
        text = read_text(change.path / "proposal.md") + "\n" + read_text(change.path / "design.md")
        found = []
        for other in sorted(names):
            if other == change.name:
                continue
            # Wortgrenze statt Substring: `add-karte` darf `add-karte-filter` nicht treffen.
            if not mentions(text, other):
                continue
            found.append(other)
        change.references = found
        shared = []
        for spec in change.touched_specs:
            others = sorted({o.name for o in by_spec.get(spec, []) if o.name != change.name})
            if others:
                shared.append(f"{spec} ↔ {', '.join(others)}")
        change.shared_specs = shared


def mark_readiness(all_changes: list[Change]) -> None:
    """Traegt ein, welcher laufende Change einen noch nicht begonnenen blockiert.

    Blockiert heisst hier genau eins: zwei Changes greifen dieselbe Capability an.
    Wer sie parallel startet, erzeugt den Merge-Konflikt, den dieses Feld vorher sichtbar
    macht. Ein Change blockiert sich nicht selbst und nicht seinen Namensvetter aus einem
    zweiten Worktree -- das ist derselbe Change, keine Kollision.
    """
    belegt: dict[str, set[str]] = {}
    for change in all_changes:
        if change.done > 0 and change.done != change.total:
            for spec in change.touched_specs:
                belegt.setdefault(spec, set()).add(change.name)

    for change in all_changes:
        if change.done > 0:
            change.blocked_by = []
            continue
        hindernisse = sorted({
            name
            for spec in change.touched_specs
            for name in belegt.get(spec, set())
            if name != change.name
        })
        change.blocked_by = hindernisse


def remote_change_branches(root: Path) -> set[str]:
    """Change-Namen, zu denen ein Branch auf dem Remote liegt.

    Gelesen wird aus den lokalen Remote-Refs, ohne Netz: was `git fetch` zuletzt geholt
    hat, reicht. Ein Change, dessen Branch dort liegt und dessen Aufgaben erledigt sind,
    wartet auf den Merge -- der Zustand, in dem ein Change am ehesten liegen bleibt.
    """
    result = git(root, ["for-each-ref", "--format=%(refname:short)", "refs/remotes/*/change/*"])
    namen = set()
    for zeile in result.out.splitlines():
        teile = zeile.strip().split("/change/", 1)
        if len(teile) == 2 and teile[1]:
            namen.add(teile[1])
    return namen


def mark_pull_requests(all_changes: list[Change], offen: set[str]) -> None:
    """Setzt `im_pr`, wo ein Remote-Branch zum Change gehoert."""
    for change in all_changes:
        change.im_pr = change.name in offen


def collect(root: Path, worktree_filter: str | None) -> dict:
    worktrees = discover_worktrees(root)
    if worktree_filter:
        worktrees = [p for p in worktrees if worktree_filter in str(p)]
    snapshot_wts = [read_worktree(path, root) for path in worktrees]
    all_changes = [change for wt in snapshot_wts for change in wt.changes]
    link_references(all_changes)
    mark_readiness(all_changes)
    mark_pull_requests(all_changes, remote_change_branches(root))
    return {"generated": now_iso(), "root": str(root), "worktrees": snapshot_wts,
            "changes": all_changes}


def to_json(snapshot: dict) -> dict:
    def worktree_dict(wt: Worktree) -> dict:
        return {
            "path": str(wt.path), "name": wt.name, "branch": wt.branch, "head": wt.head,
            "subject": wt.subject, "commit_time": wt.commit_time, "is_main": wt.is_main,
            "detached": wt.detached, "ahead": wt.ahead, "behind": wt.behind,
            "staged": wt.staged, "modified": wt.modified, "untracked": wt.untracked,
            "archived_count": wt.archived_count, "archived_last": wt.archived_last,
            "error": wt.error,
            "changes": [change_dict(ch) for ch in wt.changes],
        }

    def change_dict(ch: Change) -> dict:
        return {
            "name": ch.name, "path": str(ch.path), "status": ch.status,
            "done": ch.done, "total": ch.total, "percent": round(ch.percent, 1),
            "schema": ch.schema, "artifacts": ch.artifacts,
            "sections": [{"name": n, "done": d, "total": t} for n, d, t in ch.sections],
            "last_completed": ch.last_completed, "next_task": ch.next_task,
            "completions": ch.completions,
            "touched_specs": ch.touched_specs, "new_caps": ch.new_caps,
            "modified_caps": ch.modified_caps, "references": ch.references,
            "shared_specs": ch.shared_specs, "mtime": ch.mtime,
            "gates": ch.gates, "readiness": ch.readiness, "blocked_by": ch.blocked_by,
            "im_pr": ch.im_pr,
            "tasks": [{"number": t.number, "text": t.text, "done": t.done,
                       "section": t.section, "line": t.line} for t in ch.tasks],
        }

    return {
        "generated": snapshot["generated"],
        "root": snapshot["root"],
        "totals": totals(snapshot),
        "ready": [ch.name for ch in snapshot["changes"] if ch.readiness == "frei"],
        "blocked": [
            {"name": ch.name, "blocked_by": ch.blocked_by}
            for ch in snapshot["changes"] if ch.readiness == "blockiert"
        ],
        "in_pr": [ch.name for ch in snapshot["changes"] if ch.readiness == "im PR"],
        "edges": [
            {"a": snapshot["changes"][edge["a"]].name,
             "b": snapshot["changes"][edge["b"]].name,
             "kind": edge["kind"], "labels": edge["labels"]}
            for edge in build_edges(snapshot["changes"])
        ],
        "worktrees": [worktree_dict(wt) for wt in snapshot["worktrees"]],
    }


def totals(snapshot: dict) -> dict:
    changes: list[Change] = snapshot["changes"]
    done = sum(ch.done for ch in changes)
    total = sum(ch.total for ch in changes)
    return {
        "worktrees": len(snapshot["worktrees"]),
        "changes": len(changes),
        "complete": sum(1 for ch in changes if ch.total and ch.done == ch.total),
        "in_progress": sum(1 for ch in changes if ch.total and 0 < ch.done < ch.total),
        "open": sum(1 for ch in changes if ch.done == 0),
        "tasks_done": done,
        "tasks_total": total,
    }


# ----------------------------------------------------------------------------- Darstellung

def bar(fraction: float, width: int, color: str) -> str:
    filled = 0 if width <= 0 else max(0, min(width, round(fraction * width)))
    return c("█" * filled, color) + c("░" * (width - filled), GREY)


def status_badge(status: str) -> str:
    if status == "fertig":
        return c(" FERTIG ", "1", GREEN)
    if status == "in Arbeit":
        return c(" IN ARBEIT ", "1", CYAN)
    if status == "offen":
        return c(" OFFEN ", "1", YELLOW)
    return c(f" {status.upper()} ", "1", GREY)


def dirty_badge(wt: Worktree) -> str:
    if wt.error:
        return c(f"⚠ {wt.error}", RED)
    if wt.dirty == 0:
        return c("sauber", GREEN)
    parts = []
    if wt.staged:
        parts.append(f"{wt.staged} bereit")
    if wt.modified:
        parts.append(f"{wt.modified} geändert")
    if wt.untracked:
        parts.append(f"{wt.untracked} neu")
    return c(" · ".join(parts), YELLOW)


def artifact_line(artifacts: list[dict]) -> str:
    """Der Abhaengigkeitsbaum des Schemas in einer Zeile: proposal -> [specs · design] -> tasks."""
    status = {a["id"]: a["status"] for a in artifacts}
    icon = lambda aid: (c("✓", GREEN) if status.get(aid) == "done" else c("·", RED))
    return (
        f"{c('proposal', WHITE)} {icon('proposal')}  "
        f"{c('→', GREY)}  [{c('specs', WHITE)} {icon('specs')} {c('·', GREY)} "
        f"{c('design', WHITE)} {icon('design')}]  "
        f"{c('→', GREY)}  {c('tasks', WHITE)} {icon('tasks')}"
    )


def schema_text(change: Change) -> str:
    """Artefaktkette samt Hinweis, wenn der Change ein nicht hinterlegtes Schema nennt."""
    text = artifact_line(change.artifacts)
    if change.schema != "spec-driven":
        text += "  " + c(f"(Schema '{change.schema}' nicht hinterlegt)", YELLOW)
    return text


def label_line(label: str, text: str, label_width: int = 15) -> str:
    return f"  │   {c(label.ljust(label_width), GREY)} {text}"


def wrap_lines(label: str, text: str, width: int, label_width: int = 15) -> list[str]:
    """Label links, Fliesstext rechts, bei Bedarf mehrzeilig eingerueckt."""
    prefix = f"  │   {c(label.ljust(label_width), GREY)} "
    indent_width = visible_width(prefix)
    room = max(20, width - indent_width - 2)
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or visible_width(candidate) <= room:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if not lines:
        return [prefix.rstrip()]
    indent = " " * indent_width
    return [prefix + lines[0]] + [indent + line for line in lines[1:]]


def activity_epoch(change: Change) -> float:
    """Zeitpunkt der jüngsten Aktivität: Dateiänderung oder letzte Fertigstellung."""
    epoch = change.mtime or 0.0
    if change.last_completed and change.last_completed.get("at"):
        try:
            epoch = max(epoch, dt.datetime.fromisoformat(change.last_completed["at"]).timestamp())
        except ValueError:
            pass
    return epoch


def task_chain(change: Change) -> list[str]:
    """Die Aufgaben eines Changes als Kette aus Segmenten: Abschnittsname, dann erledigt ✓,
    naechste ▸, offen ○. Die Segmente werden erst beim Umbruch zusammengesetzt, damit ein
    Abschnittsname mit Leerzeichen nicht zerrissen wird."""
    next_number = change.next_task["number"] if change.next_task else None
    tokens: list[str] = []
    current_section = None
    for task in change.tasks:
        if task.section != current_section:
            if tokens:
                tokens.append(c("│", GREY))
            tokens.append(c(task.section, BOLD, CYAN))
            current_section = task.section
        number = task.number or "?"
        if task.done:
            tokens.append(c(f"✓{number}", GREEN))
        elif number == next_number:
            tokens.append(c(f"▸{number}", YELLOW, BOLD))
        else:
            tokens.append(c(f"○{number}", GREY))
    return tokens


def wrap_tokens(tokens: list[str], room: int) -> list[str]:
    """Setzt farbige Segmente mit Leerzeichen zusammen und bricht nur zwischen Segmenten um."""
    lines: list[str] = []
    current: list[str] = []
    width = 0
    for token in tokens:
        token_width = visible_width(token)
        addition = token_width if not current else token_width + 1
        if current and width + addition > room:
            lines.append(" ".join(current))
            current, width = [token], token_width
        else:
            current.append(token)
            width += addition
    if current:
        lines.append(" ".join(current))
    return lines


def build_edges(changes: list[Change]) -> list[dict]:
    """Kanten zwischen Changes: gemeinsame Specs (Capability) und ausdrueckliche Verweise."""
    by_spec: dict[str, list[int]] = {}
    for index, change in enumerate(changes):
        for spec in change.touched_specs:
            by_spec.setdefault(spec, []).append(index)

    grouped: dict[tuple[int, int], dict] = {}

    def add(a: int, b: int, kind: str, label: str) -> None:
        if changes[a].name == changes[b].name:
            return  # derselbe Change in zwei Worktrees ist Identitaet, kein Zusammenhang
        key = (min(a, b), max(a, b))
        entry = grouped.setdefault(key, {"labels": [], "kinds": set()})
        if label not in entry["labels"]:
            entry["labels"].append(label)
        entry["kinds"].add(kind)

    for spec, indexes in by_spec.items():
        for first in range(len(indexes)):
            for second in range(first + 1, len(indexes)):
                add(indexes[first], indexes[second], "spec", f"gemeinsame Spec `{spec}`")

    for index, change in enumerate(changes):
        for name in change.references:
            other = next((i for i, ch in enumerate(changes) if ch.name == name), None)
            if other is not None and other != index:
                add(index, other, "ref", "Verweis")

    edges = []
    for (a, b), entry in sorted(grouped.items()):
        edges.append({"a": a, "b": b, "labels": entry["labels"],
                      "kind": "spec" if "spec" in entry["kinds"] else "ref"})
    return edges


def render_header(snapshot: dict, width: int, interval: float, started: float, view: str) -> list[str]:
    totals_now = totals(snapshot)
    clock = dt.datetime.now().strftime("%H:%M:%S")
    elapsed = int(time.time() - started)
    view_name = "Aufgaben-Graph" if view == "graph" else "Live-Status der Changes"

    lines: list[str] = []
    lines.append(c("╭" + "─" * (width - 2) + "╮", ACCENT_RED))
    title = f" {c('OpenSpec Ops', BOLD, ACCENT_RED)} {c('·', GREY)} {view_name} "
    right = (f" {c('●', GREEN)} {clock}  {c('↻', CYAN)} {interval:g}s  "
             f"{c('⧗', GREY)} {elapsed}s  {c('g', BOLD, ACCENT_RED)} wechseln ")
    gap = max(1, width - 2 - visible_width(title) - visible_width(right))
    lines.append(cut_visible(c("│", ACCENT_RED) + title + " " * gap + right + c("│", ACCENT_RED), width))
    summary = (
        f" {c(str(totals_now['worktrees']), WHITE)} Worktrees · "
        f"{c(str(totals_now['changes']), WHITE)} offene Changes "
        f"({c(str(totals_now['in_progress']), CYAN)} in Arbeit, {c(str(totals_now['open']), YELLOW)} offen, "
        f"{c(str(totals_now['complete']), GREEN)} fertig) · "
        f"{c(str(totals_now['tasks_done']), WHITE)}/{totals_now['tasks_total']} Aufgaben "
    )
    lines.append(cut_visible(c("│", ACCENT_RED) + summary + " " * max(0, width - 2 - visible_width(summary)) + c("│", ACCENT_RED), width))
    basis = f" Basis {c(snapshot['root'], GREY)} "
    lines.append(cut_visible(c("│", ACCENT_RED) + basis + " " * max(0, width - 2 - visible_width(basis)) + c("│", ACCENT_RED), width))
    lines.append(c("╰" + "─" * (width - 2) + "╯", ACCENT_RED))
    return lines


def render_events(events: list[dict], width: int) -> list[str]:
    if not events:
        return []
    lines = ["", c(" EREIGNISSE", BOLD, ACCENT_RED)]
    for event in events[-8:]:
        icon = {"done": c("✓", GREEN), "complete": c("★", GREEN, BOLD),
                "new": c("+", CYAN), "back": c("↺", YELLOW)}.get(event["kind"], c("·", GREY))
        lines.append(cut_visible(
            f"  {c(event['time'], GREY)}  {icon}  {c(event['worktree'], GREY)}  "
            f"{c(event['change'], WHITE)}  {event['text']}", width))
    return lines


def render_footer() -> list[str]:
    hint = (f" {c('g', BOLD)} Graph/Board · {c('q', BOLD)} beenden · {c('r', BOLD)} neu lesen · "
            f"{c('python3 ops.py --help', GREY)} für Optionen")
    return ["", hint]


def render_board(snapshot: dict, width: int) -> list[str]:
    lines: list[str] = []
    for wt in snapshot["worktrees"]:
        marker = c("▌", ACCENT_RED if wt.is_main else (RED if wt.error else CYAN))
        branch = c(wt.branch, WHITE, BOLD)
        head = f"{c(wt.head or '—', GREY)} {c(short(wt.subject, max(20, width - 60)), GREY)}"
        tail = f"{wt.commit_time[:16].replace('T', ' ')}" if wt.commit_time else ""
        lines.append("")
        lines.append(cut_visible(
            f"{marker} {c(wt.name, BOLD)}{c(' (Haupt)', GREY) if wt.is_main else ''}   "
            f"{c('⑂', GREY)} {branch}"
            f"{c(' ● ' + str(wt.ahead) + '↑ ' + str(wt.behind) + '↓', GREY) if (wt.ahead or wt.behind) else ''}"
            f"   {dirty_badge(wt)}", width))
        lines.append(cut_visible(f"  {head}   {c('·', GREY)} {tail}", width))

        if not wt.changes:
            lines.append(f"  {c('keine offenen Changes', GREY)}"
                         + (f" {c('·', GREY)} {wt.archived_count} archiviert"
                            if wt.archived_count else ""))
        for change in wt.changes:
            lines.extend(render_change(change, width))
            lines.append(c("  └" + "─" * min(24, width - 6), GREY))
    return lines


def gate_text(change: Change) -> str:
    """Welche Gates ein Change erreicht hat und welche noch fehlen.

    Befund aus dem ersten Durchlauf: ohne diese Zeile sieht ein Change, bei dem jemand
    nur die Kaestchen abgehakt hat, im Lagebild genauso aus wie einer, der durch alle
    drei Gates gegangen ist.
    """
    if not change.gates:
        return ""  # Repos ohne Gate-Nachweise zeigen die Zeile gar nicht erst.
    erreicht = " → ".join(c(name, GREEN) for name in change.gates)
    offen = [name for name in GATE_DATEIEN if name not in change.gates]
    if offen:
        erreicht += c(" · offen: " + ", ".join(offen), GREY)
    return erreicht


def render_graph(snapshot: dict, width: int) -> list[str]:
    """Knoten zeitlich einsortiert, Kanten als Verbindungen, Aufgaben als Kette."""
    changes = sorted(snapshot["changes"],
                     key=lambda ch: (activity_epoch(ch), ch.name), reverse=True)
    edges = build_edges(changes)
    number = {id(ch): i + 1 for i, ch in enumerate(changes)}
    activity = {id(ch): activity_epoch(ch) for ch in changes}

    lines: list[str] = [""]
    lines.append(c(" VERBINDUNGSGRAPH", BOLD, ACCENT_RED)
                 + c("   Knoten = Change, zeitlich einsortiert (jüngste Aktivität zuerst)", GREY))
    if not changes:
        lines.append(c("  keine offenen Changes in den Worktrees", GREY))

    name_width = max((len(ch.name) for ch in changes), default=20)
    for change in changes:
        mark = c(f"[{number[id(change)]}]", BOLD, ACCENT_RED)
        when = c(dt.datetime.fromtimestamp(activity[id(change)]).strftime("%d.%m. %H:%M:%S")
                 if activity[id(change)] else "—", GREY)
        counts = f"{change.done:>3}/{change.total:<3}"
        wartet = c("  ← im PR, wartet auf Merge", YELLOW) if change.readiness == "im PR" else ""
        line = (f"  {mark}  {when}  {c(change.name.ljust(name_width), BOLD)}  "
                f"{c(counts, WHITE)} {status_badge(change.status)}  "
                f"{c(change.worktree_name, GREY)}{wartet}")
        lines.append(cut_visible(line, width))
        lines.append(cut_visible(label_line("Schema", schema_text(change)), width))
        if change.gates:
            lines.append(cut_visible(label_line("Gates", gate_text(change)), width))
        wrapped = wrap_tokens(task_chain(change), max(20, width - 22))
        for offset, piece in enumerate(wrapped):
            label = label_line("Aufgaben", piece) if offset == 0 else " " * 22 + piece
            lines.append(cut_visible(label, width))

    lines.append("")
    lines.append(c(" NÄCHSTE FREIE CHANGES", BOLD, ACCENT_RED)
                 + c("   was sich jetzt starten lässt, ohne einem laufenden Change in die Dateien zu greifen", GREY))
    frei = [ch for ch in changes if ch.readiness == "frei"]
    blockiert = [ch for ch in changes if ch.readiness == "blockiert"]
    if not frei and not blockiert:
        lines.append(c("  kein Change wartet auf den Start", GREY))
    for change in frei:
        caps = ", ".join(change.touched_specs) or "keine Capability"
        lines.append(cut_visible(
            f"  {c('[' + str(number[id(change)]) + ']', BOLD, ACCENT_RED)} {c('frei', GREEN)}       "
            f"{c(change.name.ljust(name_width), BOLD)}  {c(caps, GREY)}", width))
    for change in blockiert:
        caps = ", ".join(change.touched_specs) or "keine Capability"
        lines.append(cut_visible(
            f"  {c('[' + str(number[id(change)]) + ']', BOLD, ACCENT_RED)} {c('blockiert', YELLOW)}  "
            f"{c(change.name.ljust(name_width), BOLD)}  {c(caps, GREY)} "
            f"{c('← wartet auf ' + ', '.join(change.blocked_by), YELLOW)}", width))

    lines.append("")
    lines.append(c(" KANTEN", BOLD, ACCENT_RED)
                 + c("   was womit zusammenhängt: gemeinsame Specs (Capability) und Verweise", GREY))
    if not edges:
        lines.append(c("  keine Verbindungen zwischen den offenen Changes", GREY))
    for edge in edges:
        a, b = edge["a"], edge["b"]
        connector = c("══", ACCENT_RED) if edge["kind"] == "spec" else c("──", GREY)
        label = " · ".join(edge["labels"])
        lines.append(cut_visible(
            f"  {c('[' + str(number[id(changes[a])]) + ']', BOLD, ACCENT_RED)} "
            f"{c(changes[a].name, WHITE)} {c('(' + changes[a].worktree_name + ')', GREY)} {connector} "
            f"{c(label, WHITE)} {connector} "
            f"{c('[' + str(number[id(changes[b])]) + ']', BOLD, ACCENT_RED)} "
            f"{c(changes[b].name, WHITE)} {c('(' + changes[b].worktree_name + ')', GREY)}", width))

    lines.append("")
    lines.append(c(" ZEITFOLGE DER AUFGABEN", BOLD, ACCENT_RED)
                 + c("   wenn nachweisbar: jede Fertigstellung aus der Git-Historie, jüngste zuerst", GREY))
    timeline: list[tuple[str, Change, dict]] = []
    for change in changes:
        numbered = {entry["number"] for entry in change.completions}
        for entry in change.completions:
            timeline.append((entry["at"], change, entry))
        # Ohne Historie zaehlt die letzte erledigte Zeile als Naeherung.
        if change.last_completed and change.last_completed["number"] not in numbered:
            timeline.append((change.last_completed["at"], change, change.last_completed))
    timeline.sort(key=lambda entry: entry[0], reverse=True)
    if not timeline:
        lines.append(c("  keine Fertigstellung nachweisbar", GREY))
    for at, change, entry in timeline[:20]:
        mark = c(f"[{number[id(change)]}]", BOLD, ACCENT_RED)
        when = at[11:19] if len(at) >= 19 else (at or "—")
        body = (f"  {c(when, GREEN)}  {mark} {c(change.name.ljust(name_width), BOLD)}  "
                f"{c(entry['number'], GREEN)} {short(entry['text'], width)}  "
                f"{c('[' + entry['source'] + ']', GREY)}")
        lines.append(cut_visible(body, width))
    return lines


def render_view(snapshot: dict, events: list[dict], interval: float, started: float, view: str) -> list[str]:
    width = max(80, shutil.get_terminal_size((110, 30)).columns) - 1
    lines = render_header(snapshot, width, interval, started, view)
    if view == "graph":
        lines.extend(render_graph(snapshot, width))
    else:
        lines.extend(render_board(snapshot, width))
    lines.extend(render_events(events, width))
    lines.extend(render_footer())
    return lines


def render_change(change: Change, width: int) -> list[str]:
    lines: list[str] = []
    head = (
        f"  {c('├─', GREY)} {c(change.name, BOLD)}   "
        f"{status_badge(change.status)}   "
        f"{c(f'{change.done}/{change.total}', WHITE)} {c(f'{change.percent:.0f}%', GREY)}"
    )
    lines.append(cut_visible(head, width))
    inner = max(10, width - 16)
    lines.append(f"  │   {bar(change.percent / 100.0, min(inner, 40), GREEN if change.percent >= 100 else CYAN)}   "
                 + c(f"geändert {stamp(change.mtime)}", GREY))
    lines.append(cut_visible(label_line("Schema", schema_text(change)), width))

    # Gates zeigt nur, wer welche hat -- Repos ohne Gate-Nachweise bleiben unveraendert.
    if change.gates:
        lines.append(cut_visible(label_line("Gates", gate_text(change)), width))
    if change.readiness == "blockiert":
        lines.append(cut_visible(label_line(
            "Parallelbetrieb", c("blockiert durch " + ", ".join(change.blocked_by), YELLOW)), width))
    elif change.readiness == "frei":
        lines.append(cut_visible(label_line("Parallelbetrieb", c("frei — startbar", GREEN)), width))

    if change.next_task:
        text = f"{c(change.next_task['number'], CYAN)} {short(change.next_task['text'], width)}"
    else:
        text = c("— alle Aufgaben erledigt", GREEN)
    lines.extend(wrap_lines("Nächste Aufgabe", text, width))

    if change.last_completed:
        lc = change.last_completed
        when = lc["at"][11:19] if len(lc["at"]) >= 19 else (lc["at"] or "—")
        source = c(f"[{lc['source']}]", GREY)
        commit = c(f" {lc['commit']}", GREY) if lc.get("commit") else ""
        text = f"{c(lc['number'], GREEN)} {short(lc['text'], width)}  {c('·', GREY)} {when} {source}{commit}"
    else:
        text = c("— kein Nachweis gefunden", GREY)
    lines.extend(wrap_lines("Zuletzt fertig", text, width))
    lines.append(cut_visible(label_line(
        "Abschnitte", " · ".join(f"{c(name, WHITE)} {d}/{t}" for name, d, t in change.sections)), width))
    if change.touched_specs:
        lines.append(cut_visible(label_line("Specs", ", ".join(change.touched_specs)), width))
    if change.shared_specs:
        lines.append(cut_visible(label_line("Berührt", " · ".join(change.shared_specs)), width))
    caps = []
    if change.new_caps:
        caps.append(c("neu: ", GREY) + ", ".join(change.new_caps))
    if change.modified_caps:
        caps.append(c("geändert: ", GREY) + ", ".join(change.modified_caps))
    if caps:
        lines.append(cut_visible(label_line("Fähigkeiten", " · ".join(caps)), width))
    if change.references:
        lines.append(cut_visible(label_line("Verweise", ", ".join(change.references)), width))
    return lines


# ----------------------------------------------------------------------------- Live-Schleife

def snapshot_events(previous: dict, current: dict, events: list[dict]) -> None:
    """Vergleicht zwei Staende und protokolliert Fertigstellungen und neue Changes."""
    now = dt.datetime.now().strftime("%H:%M:%S")
    old_changes = {f"{ch.worktree_name}/{ch.name}": ch for ch in previous["changes"]}
    new_changes = {f"{ch.worktree_name}/{ch.name}": ch for ch in current["changes"]}

    for key, change in new_changes.items():
        before = old_changes.get(key)
        if before is None:
            events.append({"time": now, "kind": "new", "worktree": change.worktree_name,
                           "change": change.name, "text": f"Change erkannt ({change.done}/{change.total})"})
            continue
        was = {t.key: t for t in before.tasks if t.done}
        now_done = {t.key: t for t in change.tasks if t.done}
        for key in sorted(now_done.keys() - was.keys(), key=lambda k: _task_order(now_done[k].number)):
            task = now_done[key]
            events.append({"time": now, "kind": "done", "worktree": change.worktree_name,
                           "change": change.name,
                           "text": f"Aufgabe {task.number or '—'} abgeschlossen — {short(task.text, 60)}"})
        if before.total and before.done < before.total and change.total and change.done == change.total:
            events.append({"time": now, "kind": "complete", "worktree": change.worktree_name,
                           "change": change.name, "text": "Change vollständig abgearbeitet"})
        for key in sorted(was.keys() - now_done.keys(), key=lambda k: _task_order(was[k].number)):
            task = was[key]
            events.append({"time": now, "kind": "back", "worktree": change.worktree_name,
                           "change": change.name, "text": f"Aufgabe {task.number or '—'} wieder offen"})

    for key, change in old_changes.items():
        if key not in new_changes:
            events.append({"time": now, "kind": "new", "worktree": change.worktree_name,
                           "change": change.name, "text": "Change nicht mehr gefunden"})


def _task_order(number: str) -> tuple:
    return tuple(int(part) for part in re.findall(r"\d+", number)) or (0,)


def acquire_keyboard() -> Callable[[], None] | None:
    """Schaltet die Terminal-Eingabe auf zeichenweise und liefert die Wiederherstellung zurueck."""
    if not sys.stdin.isatty():
        return None
    try:
        import termios
        import tty

        fd = sys.stdin.fileno()
        settings = termios.tcgetattr(fd)

        def restore() -> None:
            try:
                termios.tcsetattr(fd, termios.TCSADRAIN, settings)
            except Exception:
                pass

        tty.setcbreak(fd)
        return restore
    except Exception:
        return None


def keyboard_hit() -> str | None:
    if not sys.stdin.isatty():
        return None
    ready, _, _ = select.select([sys.stdin], [], [], 0)
    if ready:
        try:
            return sys.stdin.read(1)
        except Exception:
            return None
    return None


def live_loop(root: Path, worktree_filter: str | None, interval: float, view: str = "board") -> int:
    interactive = sys.stdout.isatty()
    can_read_keys = sys.stdin.isatty()
    restore = acquire_keyboard()
    started = time.time()
    events: list[dict] = []
    previous = {"changes": []}
    signature = None
    last_draw = 0.0
    first = True
    if interactive:
        sys.stdout.write("\x1b[?25l")  # Cursor ausblenden
        sys.stdout.flush()
    try:
        while True:
            try:
                snapshot = collect(root, worktree_filter)
            except Exception as exc:  # ein Worktree kann sich waehrend des Lesens aendern
                events.append({"time": dt.datetime.now().strftime("%H:%M:%S"), "kind": "back",
                               "worktree": "—", "change": "ops.py", "text": f"Lesefehler: {exc}"})
                if can_read_keys:
                    select.select([sys.stdin], [], [], interval)
                else:
                    time.sleep(interval)
                continue
            if first:
                first = False  # der erste Stand ist kein Ereignis
            else:
                snapshot_events(previous, snapshot, events)
            previous = snapshot
            payload = to_json(snapshot)
            payload.pop("generated", None)  # der Zeitstempel soll keinen Neuaufbau vortaeuschen
            new_signature = view + json.dumps(payload, sort_keys=True, ensure_ascii=False)
            changed = new_signature != signature
            due = interactive and time.time() - last_draw >= 2.0
            if changed or due:
                lines = render_view(snapshot, events, interval, started, view)
                if interactive:
                    sys.stdout.write("\x1b[H\x1b[J" + "\n".join(lines) + "\n")
                else:
                    # Ohne TTY kein Steuerzeichenzauber: ein Stand je Aenderung.
                    print("\n".join(_ANSI_RE.sub("", line) for line in lines), flush=True)
                sys.stdout.flush()
                signature = new_signature
                last_draw = time.time()
            key = keyboard_hit()
            if key in ("q", "Q", "\x03", "\x04"):
                break
            if key in ("g", "G"):
                view = "graph" if view == "board" else "board"
                signature = None
                continue
            if key in ("r", "R"):
                signature = None
                continue
            if can_read_keys:
                # Statt blind zu schlafen auf Eingabe warten, damit Tasten sofort greifen.
                select.select([sys.stdin], [], [], interval)
            else:
                time.sleep(interval)
    finally:
        if interactive:
            sys.stdout.write("\x1b[?25h\x1b[J")
            sys.stdout.flush()
        if restore:
            restore()
    return 0


# ----------------------------------------------------------------------------- Selbsttest

def selftest() -> int:
    """Deterministische Parser-Tests mit Fixtures — ohne echtes Repo, in `just test` eingehaengt.

    Deckt die fehleranfaelligen Stellen ab: Aufgaben lesen, Git-Diff-Flips, Status-Auswertung,
    Kanten und Wortgrenzen von Verweisen sowie sichtbare Breite.
    """
    problems: list[str] = []

    def expect(name: str, got, want) -> None:
        if got != want:
            problems.append(f"{name}: erwartet {want!r}, bekommen {got!r}")

    tasks = parse_tasks("- [x] 1.1 eins\n      fort\n- [ ] 1.2 zwei\n## 2 X\n- [X] 2.1 drei\n")
    expect("parse_tasks/Anzahl", len(tasks), 3)
    expect("parse_tasks/Fortsetzung", tasks[0].text, "eins fort")
    expect("parse_tasks/erledigt", [t.done for t in tasks], [True, False, True])
    expect("parse_tasks/Abschnitt", tasks[2].section, "2 X")

    expect("parse_status/ahead+behind", parse_status("## b...o/b [ahead 2, behind 1]\n"),
           ("b", False, 2, 1, 0, 0, 0))
    expect("parse_status/nur behind", parse_status("## b...o/b [behind 3]\n"),
           ("b", False, 0, 3, 0, 0, 0))
    expect("parse_status/abgesetzt", parse_status("## HEAD (no branch)\n"),
           ("(abgesetzt)", True, 0, 0, 0, 0, 0))
    expect("parse_status/Zaehler", parse_status("## b\n M a\n?? c\nR  d -> e\n"),
           ("b", False, 0, 0, 1, 1, 1))

    expect("parse_capabilities", parse_capabilities(
        "### New Capabilities\n- `a-b`: x\n### Modified Capabilities\n- `c-d`: y\n"), (["a-b"], ["c-d"]))

    expect("mentions/Wortgrenze", mentions("nennt add-karte-filter hier", "add-karte"), False)
    expect("mentions/Treffer", mentions("nennt add-karte hier", "add-karte"), True)

    # Was ein Change ueber sich selbst sagt: die Leser sind reine Textfunktionen und
    # werden hier Fall fuer Fall geprueft -- ohne Dateisystem, ohne Git.
    vorhaben = ("# probe\n\n## Warum\n\nZwei Zeilen.\nUnd noch eine.\n\n"
                "## Was ändert sich\n\nEtwas.\n\n"
                "## Was ausdrücklich nicht\n\nDas Archiv.\n\n"
                "## Berührte Dateien\n\n- `ops.py`\n- `tests/a.test.mjs` (neu)\n")
    expect("proposal_teile/Warum ohne Ueberschrift",
           proposal_teile(vorhaben)["warum"], "Zwei Zeilen.\nUnd noch eine.")
    expect("proposal_teile/Abgrenzung", proposal_teile(vorhaben)["abgrenzung"], "Das Archiv.")
    expect("proposal_teile/ohne Umlaut gelesen",
           proposal_teile("## Warum\n\nA.\n\n## Was ausdruecklich nicht\n\nB.\n")["abgrenzung"], "B.")
    expect("proposal_teile/fehlender Abschnitt bleibt leer",
           proposal_teile("## Warum\n\nA.\n")["abgrenzung"], "")
    expect("proposal_teile/ohne Vorhaben nur leere Abschnitte",
           proposal_teile(""), {"warum": "", "abgrenzung": "", "dateien": ""})

    expect("zugesagte_dateien/Pfade ohne Klammerzusatz",
           zugesagte_dateien(vorhaben), ["ops.py", "tests/a.test.mjs"])
    expect("zugesagte_dateien/auch ohne Backticks",
           zugesagte_dateien("## Berührte Dateien\n\n- ops.py (unverändert)\n"), ["ops.py"])
    expect("zugesagte_dateien/ohne Abschnitt nichts", zugesagte_dateien("## Warum\n\nA.\n"), [])

    delta = ("# cap\n\n## ADDED Requirements\n\n### Requirement: Erste Regel\n\n"
             "Das System SHALL etwas tun.\n\n#### Scenario: A\n\n- **Given** x\n\n"
             "#### Scenario: B\n\n- **Given** y\n\n### Requirement: Zweite Regel\n\n"
             "Das System SHALL mehr tun.\n\n#### Scenario: C\n\n- **Given** z\n\n"
             "## MODIFIED Requirements\n\n### Requirement: Alte Regel\n\n"
             "Das System SHALL es anders tun.\n\n#### Scenario: D\n\n- **Given** w\n")
    expect("requirement_titel/Art, Titel und Szenarienzahl", requirement_titel(delta),
           [{"art": "ADDED", "titel": "Erste Regel", "szenarien": 2},
            {"art": "ADDED", "titel": "Zweite Regel", "szenarien": 1},
            {"art": "MODIFIED", "titel": "Alte Regel", "szenarien": 1}])
    expect("requirement_titel/ohne Delta-Block nichts",
           requirement_titel("### Requirement: Ohne Block\n\n#### Scenario: A\n"), [])
    expect("requirement_titel/leerer Text", requirement_titel(""), [])

    expect("dateien_abgleich/drei Lagen",
           dateien_abgleich(["a.py", "b.md"], ["a.py", "c.txt"]),
           [{"pfad": "a.py", "lage": "beides"}, {"pfad": "b.md", "lage": "nur_zugesagt"},
            {"pfad": "c.txt", "lage": "nur_angefasst"}])
    expect("dateien_abgleich/Deckung wird gemeldet",
           dateien_abgleich(["a.py"], ["a.py"]), [{"pfad": "a.py", "lage": "beides"}])
    expect("dateien_abgleich/ohne Zusage und ohne Diff leer", dateien_abgleich([], []), [])
    # Jeder Change sagt seinen eigenen Ordner zu; ohne diese Regel stuende er als offen
    # da und jede Datei darin als ungeplant -- an jedem Change gleichermassen.
    expect("dateien_abgleich/Ordnerzusage deckt, was darunter liegt",
           dateien_abgleich(["openspec/changes/x/"], ["openspec/changes/x/tasks.md"]),
           [{"pfad": "openspec/changes/x/", "lage": "beides"}])
    expect("dateien_abgleich/Ordnerzusage ohne Aenderung bleibt offen",
           dateien_abgleich(["openspec/changes/x/"], []),
           [{"pfad": "openspec/changes/x/", "lage": "nur_zugesagt"}])

    def fake_change(name: str, worktree: str, specs: list[str],
                    done: int = 0, total: int = 0) -> Change:
        return Change(name=name, path=Path("."), worktree_path="", worktree_name=worktree,
                      schema="spec-driven", done=done, total=total, status="offen", sections=[], tasks=[],
                      artifacts=[], touched_specs=list(specs), new_caps=[], modified_caps=[],
                      references=[], shared_specs=[], mtime=0.0, completions=[],
                      last_completed=None, next_task=None)

    edges = build_edges([fake_change("a", "wt1", ["datenbank"]),
                         fake_change("b", "wt2", ["datenbank"]),
                         fake_change("a", "wt3", ["datenbank"])])
    expect("build_edges/ohne Identitaet", {(e["a"], e["b"]) for e in edges}, {(0, 1), (1, 2)})

    # Freie und blockierte Changes: ein laufender Change belegt seine Capability.
    laufend = fake_change("laeuft", "wt1", ["nutzen"], done=1, total=3)
    wartend = fake_change("wartet", "wt1", ["nutzen"])
    unabhaengig = fake_change("frei", "wt1", ["amortisation"])
    fertig = fake_change("fertig", "wt1", ["nutzen"], done=2, total=2)
    mark_readiness([laufend, wartend, unabhaengig, fertig])
    expect("mark_readiness/laufend", laufend.readiness, "laeuft")
    expect("mark_readiness/blockiert", wartend.readiness, "blockiert")
    expect("mark_readiness/Hindernis", wartend.blocked_by, ["laeuft"])
    expect("mark_readiness/frei", unabhaengig.readiness, "frei")
    expect("mark_readiness/fertig blockiert nicht", fertig.readiness, "fertig")

    # Derselbe Change in zwei Worktrees ist Identitaet, kein Hindernis.
    zwilling_a = fake_change("gleich", "wt1", ["nutzen"], done=1, total=3)
    zwilling_b = fake_change("gleich", "wt2", ["nutzen"])
    mark_readiness([zwilling_a, zwilling_b])
    expect("mark_readiness/Zwilling", zwilling_b.blocked_by, [])

    # Zwischen fertig und archiviert: der Branch liegt auf dem Remote, der Merge fehlt.
    wartet_auf_merge = fake_change("im-pr", "wt1", ["nutzen"], done=2, total=2)
    angefangen = fake_change("laeuft-noch", "wt1", ["nutzen"], done=1, total=2)
    mark_pull_requests([wartet_auf_merge, angefangen, fertig], {"im-pr", "laeuft-noch"})
    expect("mark_pull_requests/wartet auf Merge", wartet_auf_merge.readiness, "im PR")
    expect("mark_pull_requests/unfertig bleibt laufend", angefangen.readiness, "laeuft")
    expect("mark_pull_requests/ohne Branch bleibt fertig", fertig.readiness, "fertig")

    # Die Gate-Zeile trennt 'durch alle Gates' von 'nur abgehakt'.
    mit_gates = fake_change("mit-gates", "wt1", ["nutzen"], done=2, total=2)
    mit_gates.gates = ["gate1", "gate2"]
    expect("gate_text/erreicht", "gate1" in gate_text(mit_gates), True)
    expect("gate_text/offen benannt", "fertig" in gate_text(mit_gates), True)
    expect("gate_text/ohne Gates leer", gate_text(fake_change("ohne", "wt1", [])), "")

    expect("visible_width/breit", visible_width("⌛"), 2)
    expect("visible_width/schmal", visible_width("a"), 1)
    expect("cut_visible/Breite", visible_width(cut_visible("abcd", 2)), 2)

    with tempfile.TemporaryDirectory() as tmp:
        repo = Path(tmp)
        git(repo, ["init", "-q"])
        git(repo, ["config", "user.email", "test@example.invalid"])
        git(repo, ["config", "user.name", "Test"])
        rel = "tasks.md"
        (repo / rel).write_text("- [ ] 1.1 a\n- [ ] 1.2 b\n", encoding="utf-8")
        git(repo, ["add", "-A"])
        git(repo, ["commit", "-qm", "anlegen"])
        (repo / rel).write_text("- [x] 1.1 a\n- [ ] 1.2 b\n", encoding="utf-8")
        git(repo, ["commit", "-qam", "1.1"])
        (repo / rel).write_text("- [x] 1.1 a\n- [x] 1.2 b\n", encoding="utf-8")
        git(repo, ["commit", "-qam", "1.2"])
        flips = git_completions(repo, rel, "")
        expect("git_completions/Anzahl", len(flips), 2)
        expect("git_completions/zuletzt", flips[0]["number"] if flips else None, "1.2")

    # Die Nutzlast der Web-Ansicht: Form, Ordnung und Belegplatz -- ohne Git und
    # ohne Dateisystem, damit sie auch ohne FastAPI nachweisbar bleibt.
    baum = Worktree(path=Path("/tmp/wt"), name="wt", branch="change/x", head="abc1234",
                    subject="Betreff", commit_time="2026-09-20T10:00:00+02:00",
                    is_main=False, detached=False, ahead=0, behind=0,
                    staged=1, modified=2, untracked=3)
    aelter = fake_change("aelter", "wt", ["a"], done=1, total=2)
    aelter.mtime = 1_000.0
    aelter.completions = [{"at": "2026-09-19T08:00:00", "number": "1.1",
                           "text": "eins", "source": "git"}]
    juenger = fake_change("juenger", "wt", ["a"], done=0, total=2)
    juenger.mtime = 2_000.0
    juenger.completions = [{"at": "2026-09-20T08:00:00", "number": "2.1",
                            "text": "zwei", "source": "git"}]
    # Eine Naeherung aus dem Arbeitsbaum -- sie gehoert nicht in die Zeitleiste.
    juenger.last_completed = {"at": "2026-09-20T09:00:00", "number": "2.2",
                              "text": "drei", "source": "datei"}
    # Gleiche Capability: der begonnene Change belegt sie, der andere wartet.
    mark_readiness([aelter, juenger])
    baum.changes = [aelter, juenger]
    nutzlast = web_nutzlast({
        "generated": "2026-09-20T12:00:00+02:00", "root": "/tmp",
        "worktrees": [baum], "changes": [aelter, juenger],
        "haupt": "", "dateien": {"/tmp/wt": parse_dateien("M  a.py\n?? b.py\n")},
        "zuordnung": ordne_changes_zu([baum], None, signatur=lambda p: ""),
    })
    expect("web_nutzlast/Schluessel", sorted(nutzlast.keys()),
           ["archiv", "belege", "changes", "generated", "kennzahlen", "root", "worktrees",
            "zeitleiste"])
    expect("web_nutzlast/ohne Erhebung kein Archiv", nutzlast["archiv"], [])
    expect("archiv_teile/mit Datum", list(archiv_teile("2026-09-20-beleg-typ")),
           ["2026-09-20", "beleg-typ"])
    expect("archiv_teile/ohne Datum", list(archiv_teile("beleg-typ")), ["", "beleg-typ"])
    expect("beleg_zeigbar/Bild und Graph",
           [beleg_zeigbar("/beleg/wt/a.png"), beleg_zeigbar("/beleg/wt/a.svg"),
            beleg_zeigbar("/beleg/wt/a.dot"), beleg_zeigbar("/beleg/wt/a.txt")],
           [True, True, False, False])
    # Die Vorschau nimmt das Ergebnis, nicht den Ausgangszustand -- und nichts, wo sich
    # nichts zeigen laesst.
    vorher_nachher = [{"stufe": "vorher", "zeigbar": True, "adresse": "v.png"},
                      {"stufe": "nachher", "zeigbar": True, "adresse": "n.png"}]
    expect("vorschau_beleg/nachher geht vor",
           vorschau_beleg(vorher_nachher)["adresse"], "n.png")
    expect("vorschau_beleg/hilfsweise der erste darstellbare",
           vorschau_beleg([{"stufe": "waehrend", "zeigbar": False, "adresse": "g.dot"},
                           {"stufe": "vorher", "zeigbar": True, "adresse": "v.png"}])["adresse"],
           "v.png")
    expect("vorschau_beleg/ohne darstellbaren Beleg nichts",
           vorschau_beleg([{"stufe": "nachher", "zeigbar": False, "adresse": "g.dot"}]), None)
    expect("vorschau_beleg/ohne Beleg nichts", vorschau_beleg([]), None)
    expect("web_nutzlast/Arbeitsstand",
           [nutzlast["worktrees"][0][k] for k in ("vorgemerkt", "geaendert", "unverfolgt")],
           [1, 2, 3])
    expect("web_nutzlast/Zeitpunkt des Baums",
           nutzlast["worktrees"][0]["geaendert_am"] > 0, True)
    expect("web_nutzlast/juengste zuerst",
           [ch["name"] for ch in nutzlast["changes"]], ["juenger", "aelter"])
    expect("web_nutzlast/Bereitschaft",
           [ch["bereitschaft"] for ch in nutzlast["changes"]], ["blockiert", "laeuft"])
    expect("web_nutzlast/Zeitleiste absteigend",
           [e["number"] for e in nutzlast["zeitleiste"]], ["2.1", "1.1"])
    expect("web_nutzlast/Zeitleiste nennt den Change",
           nutzlast["zeitleiste"][0]["change"], "juenger")
    expect("web_nutzlast/ohne Erhebung keine Belege",
           [nutzlast["belege"], *(ch["belege"] for ch in nutzlast["changes"])], [[], [], []])

    # Dieselbe Nutzlast, diesmal mit erhobenen Belegen: die Sektion fuehrt alle, die
    # Karte nur die ihren. Der Beleg des archivierten Changes hat keine Karte -- er
    # steht allein in der Sektion, und genau dafuer gibt es sie.
    def beleg(change: str, stufe: str, art: str, zeit: str, archiviert: bool = False,
              endung: str = ".png") -> dict:
        return {"stufe": stufe, "art": art, "zeit": zeit, "change": change, "worktree": "wt",
                "adresse": f"/beleg/wt/{change}{endung}", "archiviert": archiviert,
                "zeigbar": beleg_zeigbar(f"/beleg/wt/{change}{endung}"),
                "quelle": f"/tmp/wt/{change}{endung}"}

    mit_belegen = web_nutzlast({
        "generated": "2026-09-20T12:00:00+02:00", "root": "/tmp",
        "worktrees": [baum], "changes": [aelter, juenger],
        "haupt": "", "dateien": {}, "zuordnung": ordne_changes_zu([baum], None,
                                                                  signatur=lambda p: ""),
        "belege": [beleg("juenger", "nachher", "bild", "2026-09-20T11:00:00.000Z"),
                   beleg("alt-und-weg", "vorher", "graph", "2026-09-19T11:00:00.000Z", True)],
    })
    expect("web_nutzlast/Sektion fuehrt alle Belege",
           [b["change"] for b in mit_belegen["belege"]], ["juenger", "alt-und-weg"])
    expect("web_nutzlast/Beleg ohne Pfad auf der Platte",
           sorted(mit_belegen["belege"][0].keys()), sorted(BELEG_FELDER))
    expect("web_nutzlast/Karte fuehrt nur ihre Belege",
           [[b["stufe"] for b in ch["belege"]] for ch in mit_belegen["changes"]],
           [["nachher"], []])

    # Dateien beim Namen: Art je Zeichenpaar, Umbenennung auf den neuen Pfad, sortiert.
    expect("parse_dateien/Art und Pfad",
           parse_dateien("M  a.py\n M b.py\nA  c.py\n?? d.py\n D e.py\n"),
           [{"pfad": "a.py", "art": "vorgemerkt"}, {"pfad": "b.py", "art": "geaendert"},
            {"pfad": "c.py", "art": "vorgemerkt"}, {"pfad": "d.py", "art": "unverfolgt"},
            {"pfad": "e.py", "art": "geloescht"}])
    expect("parse_dateien/Umbenennung nennt den neuen Pfad",
           parse_dateien("R  alt.py -> neu.py\n"), [{"pfad": "neu.py", "art": "vorgemerkt"}])
    expect("parse_dateien/sauber ist leer", parse_dateien(""), [])
    expect("web_nutzlast/Dateien am Arbeitsbaum",
           nutzlast["worktrees"][0]["dateien"],
           [{"pfad": "a.py", "art": "vorgemerkt"}, {"pfad": "b.py", "art": "unverfolgt"}])

    # Zuordnung: der Inhalt entscheidet. Die Signatur ist hier eine Attrappe, damit die
    # Regel ohne Dateisystem prueftbar bleibt -- geprueft wird die Regel, nicht sha256.
    haupt_baum = Worktree(path=Path("/tmp/haupt"), name="haupt", branch="main", head="h",
                          subject="", commit_time="", is_main=True, detached=False,
                          ahead=0, behind=0, staged=0, modified=0, untracked=0)
    gleich = Worktree(path=Path("/tmp/gleich"), name="gleich", branch="change/x", head="g",
                      subject="", commit_time="", is_main=False, detached=False,
                      ahead=0, behind=0, staged=0, modified=0, untracked=0)
    anders = Worktree(path=Path("/tmp/anders"), name="anders", branch="change/x", head="a",
                      subject="", commit_time="", is_main=False, detached=False,
                      ahead=0, behind=0, staged=0, modified=0, untracked=0)
    for wt, mtime in ((haupt_baum, 1_000.0), (gleich, 1_000.0), (anders, 3_000.0)):
        kopie = fake_change("x", wt.name, ["a"], done=0, total=2)
        kopie.path = wt.path / "x"
        kopie.worktree_path = str(wt.path)
        kopie.mtime = mtime
        wt.changes = [kopie]
    nur_hier = fake_change("y", "anders", ["b"], done=0, total=1)
    nur_hier.path = anders.path / "y"
    nur_hier.worktree_path = str(anders.path)
    anders.changes.append(nur_hier)

    # Fingerabdruck am Pfad: /tmp/gleich/x zaehlt als inhaltsgleich zum Hauptbaum.
    fingerabdruck = {Path("/tmp/haupt/x"): "A", Path("/tmp/gleich/x"): "A",
                     Path("/tmp/anders/x"): "B", Path("/tmp/anders/y"): "C"}
    zuordnung = ordne_changes_zu([haupt_baum, gleich, anders], haupt_baum,
                                 signatur=lambda p: fingerabdruck[p])
    gewaehlt = {e["change"].name: e for e in zuordnung}
    expect("ordne_changes_zu/jeder Change einmal", sorted(gewaehlt), ["x", "y"])
    expect("ordne_changes_zu/bearbeiteter Change beim Arbeitsbaum",
           (gewaehlt["x"]["change"].worktree_name, gewaehlt["x"]["weicht_ab"]), ("anders", True))
    expect("ordne_changes_zu/gleicher Baum bleibt unerwaehnt", gewaehlt["x"]["auch_in"], [])
    expect("ordne_changes_zu/unbekannter Change beim Arbeitsbaum",
           (gewaehlt["y"]["change"].worktree_name, gewaehlt["y"]["weicht_ab"]), ("anders", True))

    # Weicht keiner ab, bleibt der Change beim Hauptbaum.
    fingerabdruck[Path("/tmp/anders/x")] = "A"
    ruhig = {e["change"].name: e for e in
             ordne_changes_zu([haupt_baum, gleich, anders], haupt_baum,
                              signatur=lambda p: fingerabdruck[p])}
    expect("ordne_changes_zu/unveraendert bleibt beim Hauptbaum",
           (ruhig["x"]["change"].worktree_name, ruhig["x"]["weicht_ab"]), ("haupt", False))

    # Weichen zwei ab, gewinnt der juengere -- der andere wird genannt, nicht verschwiegen.
    fingerabdruck[Path("/tmp/gleich/x")] = "C"
    fingerabdruck[Path("/tmp/anders/x")] = "B"
    geteilt = {e["change"].name: e for e in
               ordne_changes_zu([haupt_baum, gleich, anders], haupt_baum,
                                signatur=lambda p: fingerabdruck[p])}
    expect("ordne_changes_zu/juengerer Baum gewinnt",
           geteilt["x"]["change"].worktree_name, "anders")
    expect("ordne_changes_zu/der andere steht unter auch_in",
           geteilt["x"]["auch_in"], ["gleich"])

    # Der naechste Schritt: die Regel nimmt nur Dicts und entscheidet allein daraus.
    # Deshalb steht hier kein Repo, kein Git und keine Datei -- nur der Stand.
    def baum(haupt=False, vorgemerkt=0, geaendert=0, unverfolgt=0, zurueck=0):
        return {"haupt": haupt, "vorgemerkt": vorgemerkt, "geaendert": geaendert,
                "unverfolgt": unverfolgt, "zurueck": zurueck}

    def change(name="x", gates=(), naechste=None, im_pr=False):
        return {"name": name, "gates": list(gates), "naechste": naechste, "im_pr": im_pr}

    aufgabe = {"number": "2.1", "text": "Regel schreiben"}
    fertig_change = change(gates=("gate1", "gate2", "fertig"))
    schmutzig = naechster_schritt(baum(geaendert=2), [fertig_change])
    expect("naechster_schritt/uncommittet geht dem Pull Request vor",
           (schmutzig["lage"], schmutzig["befehl"]), ("tun", "git add -A && git commit"))
    expect("naechster_schritt/leerer sauberer Baum ist frei",
           naechster_schritt(baum(), [])["lage"], "ruhe")
    expect("naechster_schritt/ohne Plan verlangt Gate 1",
           naechster_schritt(baum(), [change()])["befehl"], "just gate1 x")
    expect("naechster_schritt/mit Plan verlangt den roten Test",
           naechster_schritt(baum(), [change(gates=("gate1",))])["befehl"], "just gate2 x")
    offene = naechster_schritt(baum(), [change(gates=("gate1", "gate2"), naechste=aufgabe)])
    expect("naechster_schritt/offene Aufgabe wird genannt",
           (offene["lage"], offene["befehl"], "2.1 Regel schreiben" in offene["text"]),
           ("tun", "", True))
    expect("naechster_schritt/alles erledigt verlangt den Abschluss",
           naechster_schritt(baum(), [change(gates=("gate1", "gate2"))])["befehl"],
           "just fertig x")
    expect("naechster_schritt/abgeschlossen verlangt den Pull Request",
           naechster_schritt(baum(), [fertig_change])["befehl"], "just pr x")
    gestellt = naechster_schritt(
        baum(), [change(gates=("gate1", "gate2", "fertig"), im_pr=True)])
    expect("naechster_schritt/gestellter Pull Request wartet",
           (gestellt["lage"], gestellt["befehl"]), ("warten", ""))
    expect("naechster_schritt/Hauptbaum mit Rueckstand holt",
           naechster_schritt(baum(haupt=True, zurueck=2), [])["befehl"], "git pull")
    expect("naechster_schritt/sauberer Hauptbaum ruht",
           naechster_schritt(baum(haupt=True), [])["lage"], "ruhe")
    # Traegt ein Baum mehrere Changes, nennt der Schritt den, der am weitesten zurueckliegt.
    expect("naechster_schritt/der zurueckliegende Change gewinnt",
           naechster_schritt(baum(), [fertig_change, change(name="a")])["befehl"],
           "just gate1 a")

    # Die Startzeile der Web-Ansicht: eine offene Bindung nennt keine Adresse, die im
    # Browser ins Leere fuehrt, und sagt dafuer, wie weit sie reicht.
    expect("web_meldung/lokal nennt die Adresse",
           "http://127.0.0.1:8765" in web_meldung("127.0.0.1", 8765), True)
    expect("web_meldung/lokal ohne Netz-Hinweis",
           "lokalen Netz" in web_meldung("127.0.0.1", 8765), False)
    expect("web_meldung/offen weist auf das Netz hin",
           "lokalen Netz" in web_meldung("0.0.0.0", 8790), True)
    expect("web_meldung/offen nennt den Port", "8790" in web_meldung("0.0.0.0", 8790), True)

    if problems:
        for problem in problems:
            print(c("FEHLER", RED), problem)
        return 1
    print(c("OK", GREEN), "Parser-Tests bestanden")
    return 0


# ----------------------------------------------------------------------------- Web-Ansicht

WEB_PORT = 8765

# Die Vorgabe bleibt der eigene Rechner. Wer die Ansicht im lokalen Netz braucht --
# etwa vom Host einer VM aus --, sagt das mit `--web-host` und sieht es danach in der
# Startzeile. Eine offene Bindung ist eine Entscheidung, kein Nebeneffekt.
WEB_HOST = "127.0.0.1"

# Adressen, die ueber den eigenen Rechner hinausreichen, sobald sie gebunden sind.
WEB_OFFEN = frozenset({"0.0.0.0", "::", ""})


def worktree_epoch(wt: Worktree) -> float:
    """Wann in diesem Arbeitsbaum zuletzt etwas geschah.

    Der Kopfcommit ist die untere Schranke; eine noch nicht committete Änderung an
    einem Change liegt darüber. Beides zusammen beantwortet die Frage, die im
    Parallelbetrieb gestellt wird: wo wurde zuletzt gearbeitet.
    """
    epoch = 0.0
    if wt.commit_time:
        try:
            epoch = dt.datetime.fromisoformat(wt.commit_time).timestamp()
        except ValueError:
            pass
    for change in wt.changes:
        epoch = max(epoch, activity_epoch(change))
    return epoch


def parse_dateien(ausgabe: str) -> list[dict]:
    """Liest `git status --porcelain=v1` zu Pfad und Art, nach Pfad sortiert.

    `parse_status` zählt dieselbe Ausgabe zu drei Zahlen zusammen. Zahlen sagen, dass
    etwas offen ist; Namen sagen, was. Im Parallelbetrieb ist das der Unterschied
    zwischen „dort läuft etwas" und „dort läuft dieser Change".

    Eine Datei steht einmal. Ist sie vorgemerkt *und* darüber hinaus geändert, gilt
    die Änderung im Arbeitsbaum -- das ist der Stand, den man vor sich hat.
    """
    dateien: list[dict] = []
    for zeile in ausgabe.splitlines():
        if len(zeile) < 4:
            continue
        index_zeichen, baum_zeichen, name = zeile[0], zeile[1], zeile[3:].strip()
        # Die Spalte sagt wo, der Buchstabe sagt was. `M ` ist vorgemerkt, ` M`
        # geaendert -- derselbe Buchstabe, zwei verschiedene Stände.
        if index_zeichen == "?":
            art = "unverfolgt"
        elif baum_zeichen != " ":
            art = "geloescht" if baum_zeichen == "D" else "geaendert"
        else:
            art = "geloescht" if index_zeichen == "D" else "vorgemerkt"
        # Umbenennungen stehen als `alt -> neu`; gemeint ist der neue Pfad.
        if " -> " in name:
            name = name.split(" -> ", 1)[1]
        dateien.append({"pfad": name.strip('"'), "art": art})
    dateien.sort(key=lambda datei: datei["pfad"])
    return dateien


def geaenderte_dateien(pfad: Path) -> list[dict]:
    """Die geänderten Dateien eines Arbeitsbaums. Fragt Git, entscheidet nichts."""
    status = git(pfad, ["status", "--porcelain=v1"])
    return parse_dateien(status.out) if status.rc == 0 else []


def diff_dateien(pfad: Path, basis: str = "main") -> list[str]:
    """Die Dateien, die dieser Arbeitsbaum gegenüber der Basis committet hat.

    Drei Punkte, also gegen den gemeinsamen Vorfahren: was auf der Basis passiert ist,
    seit der Branch abzweigte, hat dieser Change nicht angefasst. Was noch nicht
    committet ist, steht in `geaenderte_dateien` und wird dort gelesen -- zusammen
    ergibt beides, was angefasst wurde.

    Ohne Basis -- ein frisches Repo, ein anderer Hauptbranch -- bleibt die Liste leer.
    Eine Ansicht soll an einer fehlenden Referenz nichts behaupten.
    """
    diff = git(pfad, ["diff", "--name-only", f"{basis}...HEAD"])
    if diff.rc != 0:
        return []
    return sorted({zeile.strip() for zeile in diff.out.splitlines() if zeile.strip()})


def change_detail(change_dir: Path) -> dict:
    """Was ein Change über sich selbst sagt: Vorhaben, Anforderungen, Zusage.

    Liest die Dateien, entscheidet nichts -- geurteilt wird in den reinen Funktionen
    darüber. Steht hier in der Erhebung und nicht in `collect`, weil das Terminal-
    Lagebild diese Lesezugriffe nicht braucht und im Sekundentakt bezahlen müsste.
    """
    vorhaben = read_text(change_dir / "proposal.md")
    teile = proposal_teile(vorhaben)
    specs_dir = change_dir / "specs"
    anforderungen: list[dict] = []
    try:
        capabilities = sorted(e for e in specs_dir.iterdir() if (e / "spec.md").exists()) \
            if specs_dir.is_dir() else []
    except OSError:
        capabilities = []
    for capability in capabilities:
        for eintrag in requirement_titel(read_text(capability / "spec.md")):
            anforderungen.append({"capability": capability.name, **eintrag})
    return {
        "worum": {"warum": teile["warum"], "abgrenzung": teile["abgrenzung"]},
        "anforderungen": anforderungen,
        "zugesagt": zugesagte_dateien(vorhaben),
    }


def change_signatur(ordner: Path) -> str:
    """Fingerabdruck eines Change-Ordners aus Pfaden und Inhalten.

    Der Inhalt entscheidet über die Zuordnung, nicht Branch oder Merge-Basis: was man
    sieht, ist der Stand; die Historie erklärt nur, wie er zustande kam. Ein Ordner,
    den zwei Arbeitsbäume Byte für Byte gleich tragen, wird in keinem davon bearbeitet.
    """
    hasher = hashlib.sha256()
    try:
        dateien = sorted(p for p in ordner.rglob("*") if p.is_file())
    except OSError:
        return ""
    for datei in dateien:
        hasher.update(str(datei.relative_to(ordner)).encode("utf-8"))
        hasher.update(b"\0")
        try:
            hasher.update(datei.read_bytes())
        except OSError:
            hasher.update(b"?")
        hasher.update(b"\0")
    return hasher.hexdigest()


def haupt_arbeitsbaum(worktrees: list[Worktree]) -> Worktree | None:
    """Der git-Hauptarbeitsbaum unter den erhobenen Bäumen, oder keiner.

    `Worktree.is_main` heisst „von hier aus gestartet". Läuft `ops.py` in einem
    Arbeitsbaum, trägt dieser das Merkmal -- und wäre als Referenz wertlos, weil er
    sich mit sich selbst vergliche. Referenz ist der Baum, in dem `.git` wirklich
    liegt: was dort steht, ist committet, und Abweichung davon heisst Arbeit.

    Fehlt er in der Liste -- etwa weil `--worktree` gefiltert hat -- gibt es keine
    Referenz. Dann gehört jeder Change dem Baum, in dem er liegt.
    """
    for wt in worktrees:
        ergebnis = git(wt.path, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
        if ergebnis.rc != 0 or not ergebnis.out.strip():
            continue
        gesucht = Path(ergebnis.out.strip()).parent.resolve()
        return next((w for w in worktrees if w.path.resolve() == gesucht), None)
    return None


def ordne_changes_zu(worktrees: list[Worktree], haupt: Worktree | None,
                     signatur: Callable[[Path], str] = change_signatur) -> list[dict]:
    """Jeder Change genau einmal, beim Arbeitsbaum, der ihn bearbeitet.

    Seit `just neu` eigene Arbeitsbäume anlegt, liegt derselbe Change-Ordner mehrfach:
    im Hauptbaum, wie er dort committet ist, und je einmal in jedem Baum, der ihn
    ausgecheckt hat. Wer alle zeigt, zeigt dieselbe Sache dreimal.

    Die Regel: weicht der Ordner eines Arbeitsbaums vom Hauptbaum ab, gehört der Change
    diesem Baum. Weicht keiner ab, bleibt er beim Hauptbaum. Weichen mehrere ab, gewinnt
    der mit der jüngsten Änderung -- die übrigen stehen unter `auch_in`, damit aus
    „genau einmal" kein Verschweigen wird. Ohne Hauptbaum gibt es keine Referenz; dann
    gehört jeder Change dem Baum, in dem er liegt.

    `signatur` ist austauschbar, damit der Selbsttest die Regel ohne Dateisystem prüft.
    """
    merker: dict[Path, str] = {}

    def fingerabdruck(ordner: Path) -> str:
        if ordner not in merker:
            merker[ordner] = signatur(ordner)
        return merker[ordner]

    referenz = {ch.name: fingerabdruck(ch.path) for ch in haupt.changes} if haupt else {}

    kopien: dict[str, list[Change]] = {}
    for wt in worktrees:
        for ch in wt.changes:
            kopien.setdefault(ch.name, []).append(ch)

    zuordnung: list[dict] = []
    for name, liste in sorted(kopien.items()):
        nebenbaeume = [ch for ch in liste
                       if not haupt or ch.worktree_path != str(haupt.path)]
        if name in referenz:
            abweichend = [ch for ch in nebenbaeume if fingerabdruck(ch.path) != referenz[name]]
        else:
            abweichend = nebenbaeume

        if not abweichend:
            gewaehlt = next(ch for ch in liste if haupt and ch.worktree_path == str(haupt.path))
            weicht_ab = False
            auch_in: list[str] = []
        else:
            abweichend.sort(key=lambda ch: (-activity_epoch(ch), ch.worktree_name))
            gewaehlt, weicht_ab = abweichend[0], True
            auch_in = [ch.worktree_name for ch in abweichend[1:]]
        zuordnung.append({"change": gewaehlt, "weicht_ab": weicht_ab, "auch_in": auch_in})
    return zuordnung


def belege_eines_changes(ordner: Path) -> list[dict]:
    """Was das Journal eines Changes an Belegen ausweist.

    Gelesen wird `belege/belege.jsonl`, das `tools/beleg.mjs` bei jedem Einliefern
    fortschreibt. Eine Zeile, die sich nicht deuten lässt, wird übergangen statt zu
    werfen: das Lagebild beobachtet, es urteilt nicht über fremde Dateien. Ein Eintrag
    mit `fehlt` fällt heraus -- was beim Einliefern nicht ankam, ist kein Beleg.
    """
    journal = ordner / "belege" / "belege.jsonl"
    try:
        zeilen = journal.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return []

    eintraege: list[dict] = []
    for zeile in zeilen:
        if not zeile.strip():
            continue
        try:
            daten = json.loads(zeile)
        except json.JSONDecodeError:
            continue
        if not isinstance(daten, dict) or daten.get("fehlt"):
            continue
        datei = str(daten.get("pfad", "")).strip()
        if not datei:
            continue
        eintraege.append({
            "stufe": str(daten.get("stufe", "")),
            "art": str(daten.get("art", "")),
            "zeit": str(daten.get("zeit", "")),
            "datei": datei,
        })
    return eintraege


def sammle_belege(root: Path) -> list[dict]:
    """Alle Belege aller Changes aller Arbeitsbäume, jüngster zuerst.

    Auch die archivierter Changes: ein Beleg überdauert seinen Change, und gerade der
    abgeschlossene Lauf ist der, dessen Ergebnis man sehen will. Archivierte Changes
    stehen deshalb hier -- und nur hier, nicht in der Liste `changes`, die Arbeitsbaum
    und Zuordnung voraussetzt.

    Die Adresse ist zweierlei zugleich: der Schlüssel, unter dem die Web-Ansicht die
    Datei ausliefert, und die Erlaubnis dazu. Was hier nicht steht, wird nicht bedient.

    Jeder Beleg steht einmal. Jeder Arbeitsbaum trägt dieselbe Historie und damit
    dasselbe Archiv; ohne Entdopplung stünde derselbe Beleg so oft, wie es Bäume gibt.
    `discover_worktrees` nennt den Startbaum zuerst, und der erste Fund gewinnt.
    """
    belege: list[dict] = []
    gesehen: set[tuple[str, str, str]] = set()
    for baum in discover_worktrees(root):
        changes_dir = baum / "openspec" / "changes"
        if not changes_dir.is_dir():
            continue
        ordner: list[tuple[Path, bool]] = []
        try:
            ordner += [(e, False) for e in sorted(changes_dir.iterdir())
                       if e.is_dir() and e.name != "archive"]
            archiv = changes_dir / "archive"
            if archiv.is_dir():
                ordner += [(e, True) for e in sorted(archiv.iterdir()) if e.is_dir()]
        except OSError:
            continue

        for change_ordner, archiviert in ordner:
            for eintrag in belege_eines_changes(change_ordner):
                kennung = (change_ordner.name, eintrag["datei"], eintrag["zeit"])
                if kennung in gesehen:
                    continue
                gesehen.add(kennung)
                quelle = (change_ordner / eintrag["datei"]).resolve()
                try:
                    relativ = quelle.relative_to(baum)
                except ValueError:
                    # Ein Journaleintrag, der aus seinem Arbeitsbaum herausfuehrt, bekommt
                    # keine Adresse -- und ist damit auch nicht abrufbar.
                    continue
                adresse = "/beleg/" + "/".join((baum.name, *relativ.parts))
                belege.append({
                    **eintrag,
                    "change": change_ordner.name,
                    "worktree": baum.name,
                    "archiviert": archiviert,
                    "adresse": adresse,
                    "zeigbar": beleg_zeigbar(adresse),
                    "quelle": str(quelle),
                })
    belege.sort(key=lambda b: (b["zeit"], b["change"], b["datei"]), reverse=True)
    return belege


def beleg_aufloesen(root: Path, adresse: str) -> Path | None:
    """Welche Datei eine Adresse meint -- oder nichts.

    Es wird kein Pfad zusammengesetzt und keiner bereinigt: bedient wird allein eine
    Adresse, die in der Erhebung steht. Eine Anfrage kann damit nicht aus dem Repo
    führen, weil sie gar nicht erst als Pfad gedeutet wird -- sie trifft die Liste
    oder sie trifft nichts.
    """
    for beleg in sammle_belege(root):
        if beleg["adresse"] == adresse:
            ziel = Path(beleg["quelle"])
            return ziel if ziel.is_file() else None
    return None


# Was ein Beleg ist, wenn er kein Bild ist: Text. Die Tabelle nennt nur die Endungen,
# bei denen die Standardbibliothek etwas anderes sagt oder gar nichts.
TYP_TEXT = "text/plain; charset=utf-8"
BELEG_TYPEN = {".dot": TYP_TEXT, ".jsonl": TYP_TEXT}


def beleg_typ(pfad: Path) -> str:
    """Welchen Inhaltstyp die Ansicht zu einer Belegdatei nennt.

    Für die Endungen, die das Lagebild selbst erzeugt, steht der Typ fest. `.dot` ist
    der Grund: `mimetypes` führt die Endung als Word-Vorlage -- ein fester Eintrag,
    keine Näherung -- und der Browser lädt den Graphen dann herunter, statt ihn zu
    zeigen. Für alles Übrige gilt weiter die Standardbibliothek, und wo auch die nichts
    weiß, wird Text ausgeliefert: ein Beleg ist Bild oder Text, etwas Drittes liefert
    `tools/beleg.mjs` nicht ab.

    Gelesen wird allein die Endung, nicht der Inhalt.
    """
    endung = pfad.suffix.lower()
    if endung in BELEG_TYPEN:
        return BELEG_TYPEN[endung]
    geraten, _ = mimetypes.guess_type(pfad.name)
    return geraten or TYP_TEXT


def beleg_zeigbar(adresse: str) -> bool:
    """Ob sich ein Beleg als Bild darstellen lässt.

    Entschieden wird über denselben Inhaltstyp, mit dem die Route die Datei ausliefert:
    was als `image/...` herausgeht, zeigt der Browser, alles andere lädt er herunter.
    Eine zweite Regel über Dateiendungen in der Seite könnte davon abweichen -- diese
    hier kann es nicht.
    """
    return beleg_typ(Path(adresse)).startswith("image/")


def vorschau_beleg(belege: list[dict]) -> dict | None:
    """Welcher Beleg eines Changes die Vorschau stellt -- oder keiner.

    Die Stufe `nachher` geht vor: gezeigt werden soll das Ergebnis, nicht der
    Ausgangszustand. Hilfsweise der erste darstellbare überhaupt, damit auch ein Lauf
    ohne Vorher-Nachher-Paar ein Bild bekommt. Wo nichts darstellbar ist -- ein Graph in
    der Form `.dot` etwa -- bleibt die Vorschau leer; der Beleg selbst bleibt in der
    Liste.

    Die Belegliste kommt jüngster Eintrag zuerst, innerhalb einer Stufe gewinnt also der
    jüngste.
    """
    darstellbar = [beleg for beleg in belege if beleg.get("zeigbar")]
    for beleg in darstellbar:
        if beleg.get("stufe") == "nachher":
            return beleg
    return darstellbar[0] if darstellbar else None


def sammle_archiv(worktrees: list[Worktree]) -> list[tuple[Change, str]]:
    """Die archivierten Changes aller Arbeitsbäume mit ihrem Zeitpunkt, jüngster zuerst.

    Jeder steht einmal. Jeder Arbeitsbaum trägt dieselbe Historie und damit dasselbe
    Archiv; ohne Entdopplung stünde derselbe abgeschlossene Change so oft, wie es Bäume
    gibt. Der erste Fund gewinnt.

    `archived=True` spart die Historienabfrage je Aufgabenliste -- der teuerste Teil der
    Erhebung, und für einen abgeschlossenen Change ohne Wert: dort wird kein Kästchen
    mehr gesetzt.

    Der Zeitpunkt wird hier gelesen und mitgegeben, nicht später noch einmal: `web_nutzlast`
    fasst kein Dateisystem an.
    """
    gefunden: dict[str, Change] = {}
    for wt in worktrees:
        archiv_dir = wt.path / "openspec" / "changes" / "archive"
        if not archiv_dir.is_dir():
            continue
        try:
            ordner = sorted(e for e in archiv_dir.iterdir() if e.is_dir())
        except OSError:
            continue
        for eintrag in ordner:
            if eintrag.name not in gefunden:
                gefunden[eintrag.name] = build_change(eintrag, wt, archived=True)

    zeiten = {name: abschluss_zeit(ch.path) for name, ch in gefunden.items()}
    # Geordnet wird nach dem Abschlusszeitpunkt, jüngster zuerst. Der Ordnername trägt
    # zwar ein Datum, aber nur ein Datum -- an einem Tag mit dreizehn Läufen sagt er
    # nichts über die Reihenfolge. Wo kein Nachweis einen Zeitpunkt nennt, ordnet weiter
    # der Name; solche Einträge stehen hinten, weil sie sich nicht einreihen lassen.
    mit_zeit = sorted((n for n in gefunden if zeiten[n]),
                      key=lambda n: (zeiten[n], n), reverse=True)
    ohne_zeit = sorted((n for n in gefunden if not zeiten[n]), reverse=True)
    return [(gefunden[name], zeiten[name]) for name in mit_zeit + ohne_zeit]


def archiv_teile(name: str) -> tuple[str, str]:
    """Datum und Kennung eines Archivordners, so wie `openspec archive` ihn benennt.

    Ohne Datumspräfix bleibt das Datum leer und der Ordnername ist die Kennung.
    """
    treffer = re.match(r"^(\d{4}-\d{2}-\d{2})-(.+)$", name)
    return (treffer.group(1), treffer.group(2)) if treffer else ("", name)


def web_erhebung(snapshot: dict) -> dict:
    """Was die Web-Ansicht zusätzlich braucht -- und das Terminal nicht bezahlen soll.

    Dateinamen, Ordnersignaturen und Belegjournale kosten Git-Aufrufe und Lesezugriffe.
    `--once` erneuert sich im Sekundentakt und braucht nichts davon; also wird es hier
    erhoben, nicht in `collect`. Danach ist `web_nutzlast` wieder reine Umformung.
    """
    worktrees = snapshot["worktrees"]
    haupt = haupt_arbeitsbaum(worktrees)
    return {
        **snapshot,
        "haupt": str(haupt.path) if haupt else "",
        "zuordnung": ordne_changes_zu(worktrees, haupt),
        "dateien": {str(wt.path): geaenderte_dateien(wt.path) for wt in worktrees},
        "diff": {str(wt.path): diff_dateien(wt.path) for wt in worktrees},
        "detail": {(ch.worktree_name, ch.name): change_detail(ch.path)
                   for ch in snapshot["changes"]},
        "belege": sammle_belege(Path(snapshot["root"])),
        "archiv": sammle_archiv(worktrees),
    }


def ablaufstufe(ch: dict) -> int:
    """Wie weit ein Change im Ablauf steht -- kleiner heisst frueher.

    Die Stufen sind die Folge, die das Repo ohnehin durchsetzt. Sie dient hier nur der
    Auswahl: traegt ein Arbeitsbaum mehrere Changes, nennt der Schritt den, der am
    weitesten zurueckliegt.
    """
    gates = ch.get("gates", [])
    if "gate1" not in gates:
        return 0
    if "gate2" not in gates:
        return 1
    if ch.get("naechste"):
        return 2
    if "fertig" not in gates:
        return 3
    return 5 if ch.get("im_pr") else 4


def naechster_schritt(baum: dict, changes: list[dict]) -> dict:
    """Was an diesem Arbeitsbaum als Naechstes zu tun ist: Satz, Lage, Befehl.

    Rein: die Funktion liest nichts nach, sondern entscheidet allein aus dem Stand, den
    die Nutzlast ohnehin fuehrt. Deshalb laesst sie sich im Selbsttest Fall fuer Fall
    pruefen, ohne Git und ohne Dateisystem.

    Die Reihenfolge ist die des Ablaufs, mit einer Vorfahrt: uncommittete Aenderungen
    gehen allem anderen vor. Was nicht committet ist, steht in keinem Pull Request und
    in keinem Nachweis -- jeder spaetere Schritt wuerde daran vorbeilaufen.
    """
    def schritt(text: str, lage: str, befehl: str = "") -> dict:
        return {"text": text, "lage": lage, "befehl": befehl}

    schmutz = baum.get("vorgemerkt", 0) + baum.get("geaendert", 0) + baum.get("unverfolgt", 0)
    if schmutz:
        wort = "Änderung ist" if schmutz == 1 else "Änderungen sind"
        return schritt(f"{schmutz} {wort} nicht committet. Committen Sie, bevor es weitergeht.",
                       "tun", "git add -A && git commit")

    # Der Hauptbaum bearbeitet keinen Change; er haelt den Stand, von dem die anderen
    # abzweigen. Fuer ihn ist die einzige Frage, ob dieser Stand aktuell ist.
    if baum.get("haupt"):
        if baum.get("zurueck", 0):
            zurueck = baum["zurueck"]
            return schritt(f"Der Hauptbaum liegt {zurueck} Commit"
                           f"{'s' if zurueck > 1 else ''} zurück. Holen Sie den Stand.",
                           "tun", "git pull")
        return schritt("Nichts zu tun. Der Hauptbaum ist sauber und auf Stand.", "ruhe")

    if not changes:
        return schritt("Frei. Hier liegt kein Change — der Arbeitsbaum ist zu haben.", "ruhe")

    ch = min(changes, key=lambda eintrag: (ablaufstufe(eintrag), eintrag["name"]))
    name, stufe = ch["name"], ablaufstufe(ch)
    if stufe == 0:
        return schritt(f"{name} braucht den Plan. Lassen Sie Gate 1 laufen.",
                       "tun", f"just gate1 {name}")
    if stufe == 1:
        return schritt(f"Der Plan von {name} steht. Jetzt fehlt der rote Test.",
                       "tun", f"just gate2 {name}")
    if stufe == 2:
        aufgabe = ch["naechste"]
        nummer = (aufgabe.get("number") or "").strip()
        return schritt(f"Als Nächstes in {name}: "
                       f"{(nummer + ' ') if nummer else ''}{aufgabe.get('text', '')}", "tun")
    if stufe == 3:
        return schritt(f"Alle Aufgaben in {name} sind erledigt. Schließen Sie ab.",
                       "tun", f"just fertig {name}")
    if stufe == 4:
        return schritt(f"{name} ist abgeschlossen. Stellen Sie den Pull Request.",
                       "tun", f"just pr {name}")
    return schritt(f"{name} steht im Pull Request und wartet auf Review und Merge.", "warten")


# Was zu tun ist, steht oben. Innerhalb einer Lage gewinnt die juengste Aktivitaet.
LAGE_ORDNUNG = {"tun": 0, "warten": 1, "ruhe": 2}

# Was ein Beleg im Browser ist. `quelle` bleibt bewusst draussen: der Pfad auf der
# Platte geht die Seite nichts an, sie kennt nur die Adresse.
BELEG_FELDER = ("stufe", "art", "zeit", "adresse", "change", "worktree", "archiviert",
                "zeigbar")


def web_nutzlast(snapshot: dict) -> dict:
    """Der Stand als Nutzlast der Web-Ansicht: wo, was läuft, wann.

    Rein und ohne Seiteneffekt: baut nur um, was `collect` und `web_erhebung` bereits
    erhoben haben, und fasst weder Dateisystem noch Git an. Deshalb lässt sich die
    Ansicht über `--web --trocken` prüfen, ohne einen Server zu starten und ohne
    FastAPI zu laden. Die Route zwischen hier und dem Browser bleibt dünn; wächst dort
    Logik, gehört sie hierher, nicht dorthin.
    """
    haupt_pfad = snapshot.get("haupt", "")
    dateien_je_baum = snapshot.get("dateien", {})
    diff_je_baum = snapshot.get("diff", {})
    detail_je_change = snapshot.get("detail", {})
    zuordnung = snapshot.get("zuordnung", [])
    beiwerk = {eintrag["change"].name: eintrag for eintrag in zuordnung}
    gewaehlte = [eintrag["change"] for eintrag in zuordnung]
    je_baum: dict[str, list[str]] = {}
    for ch in gewaehlte:
        je_baum.setdefault(ch.worktree_name, []).append(ch.name)

    # Die Sektion führt alle Belege, auch die archivierter Changes. Dieselben Einträge
    # hängen zusätzlich an ihrer Change-Karte -- eine Erhebung, zwei Ansichten.
    alle_belege = [{feld: beleg[feld] for feld in BELEG_FELDER}
                   for beleg in snapshot.get("belege", [])]
    belege_je_change: dict[tuple[str, str], list[dict]] = {}
    for beleg in alle_belege:
        belege_je_change.setdefault((beleg["worktree"], beleg["change"]), []).append(beleg)

    worktrees = [
        {
            "pfad": str(wt.path), "name": wt.name, "branch": wt.branch,
            "kopf": wt.head, "betreff": wt.subject, "kopf_zeit": wt.commit_time,
            "geaendert_am": worktree_epoch(wt),
            # `haupt` meint hier den git-Hauptarbeitsbaum, nicht das Verzeichnis, aus
            # dem ops.py gestartet wurde -- danach richtet sich die Zuordnung.
            "haupt": str(wt.path) == haupt_pfad,
            "abgesetzt": wt.detached,
            "voraus": wt.ahead, "zurueck": wt.behind,
            "vorgemerkt": wt.staged, "geaendert": wt.modified, "unverfolgt": wt.untracked,
            "archiviert": wt.archived_count, "fehler": wt.error,
            "dateien": dateien_je_baum.get(str(wt.path), []),
            "changes": sorted(je_baum.get(wt.name, [])),
        }
        for wt in snapshot["worktrees"]
    ]

    def dateilage(ch: Change) -> dict:
        """Zusage und Diff eines Changes nebeneinander.

        Angefasst heisst: committet gegenüber `main` **oder** im Arbeitsbaum geändert.
        Beides zusammen ist der Stand, den man vor sich hat; nur eines davon liesse die
        Hälfte der Arbeit unsichtbar. Der Bezug ist der Arbeitsbaum -- trägt einer
        ausnahmsweise zwei Changes, sieht jeder die Dateien des anderen als ungeplant.
        """
        detail = detail_je_change.get((ch.worktree_name, ch.name), {})
        zugesagt = list(detail.get("zugesagt", []))
        angefasst = sorted(set(diff_je_baum.get(ch.worktree_path, []))
                           | {datei["pfad"] for datei in dateien_je_baum.get(ch.worktree_path, [])})
        return {"zugesagt": zugesagt, "angefasst": angefasst,
                "abgleich": dateien_abgleich(zugesagt, angefasst)}

    def vorhaben(ch: Change) -> dict:
        detail = detail_je_change.get((ch.worktree_name, ch.name), {})
        return detail.get("worum", {"warum": "", "abgrenzung": ""})

    def anforderungen(ch: Change) -> list[dict]:
        return list(detail_je_change.get((ch.worktree_name, ch.name), {}).get("anforderungen", []))

    # Jüngste Aktivität zuerst -- dieselbe Ordnung wie im Verbindungsgraphen.
    changes = [
        {
            "name": ch.name, "worktree": ch.worktree_name,
            "weicht_ab": beiwerk[ch.name]["weicht_ab"],
            "auch_in": list(beiwerk[ch.name]["auch_in"]),
            "bereitschaft": ch.readiness, "status": ch.status,
            "erledigt": ch.done, "gesamt": ch.total, "prozent": round(ch.percent, 1),
            "gates": list(ch.gates), "naechste": ch.next_task, "zuletzt": ch.last_completed,
            "blockiert_durch": list(ch.blocked_by), "im_pr": ch.im_pr,
            "capabilities": list(ch.touched_specs),
            "artefakte": [a["id"] for a in ch.artifacts if a["status"] == "done"],
            "abschnitte": [{"name": n, "erledigt": d, "gesamt": t} for n, d, t in ch.sections],
            "aufgaben": [{"nummer": t.number, "text": t.text, "erledigt": t.done,
                          "abschnitt": t.section} for t in ch.tasks],
            "geaendert_am": activity_epoch(ch),
            "belege": belege_je_change.get((ch.worktree_name, ch.name), []),
            # Was der Change über sich selbst sagt: Vorhaben, Anforderungen, Zusage
            # gegen Diff. Gelesen hat das die Erhebung; hier wird nur zugeordnet.
            "worum": vorhaben(ch),
            "anforderungen": anforderungen(ch),
            "dateien": dateilage(ch),
        }
        for ch in sorted(gewaehlte, key=lambda c: (-activity_epoch(c), c.name))
    ]

    # Archivierte Changes stehen getrennt. Sie haben keinen Arbeitsraum, keine Zuweisung
    # und keinen nächsten Schritt -- in `changes` müsste jede Regel darauf einen
    # Sonderfall bekommen. Was sie haben, ist ein Ergebnis: abgehakte Aufgaben und
    # Belege.
    archiv = []
    for ch, zeitpunkt in snapshot.get("archiv", []):
        datum, kennung = archiv_teile(ch.name)
        eigene_belege = belege_je_change.get((ch.worktree_name, ch.name), [])
        archiv.append({
            "name": ch.name, "kennung": kennung, "datum": datum,
            # Unverändert so, wie der Nachweis ihn nennt -- UTC in ISO. Umgerechnet
            # wird erst in der Anzeige, in der Zeitzone des Betrachters.
            "zeitpunkt": zeitpunkt,
            "worktree": ch.worktree_name,
            "status": ch.status,
            "erledigt": ch.done, "gesamt": ch.total, "prozent": round(ch.percent, 1),
            "gates": list(ch.gates),
            "capabilities": list(ch.touched_specs),
            "aufgaben": [{"nummer": t.number, "text": t.text, "erledigt": t.done,
                          "abschnitt": t.section} for t in ch.tasks],
            "belege": eigene_belege,
            # Welcher Beleg die Zeile bebildert, entscheidet sich hier und nicht in der
            # Seite: eine Regel, die geprüft ist und von aussen einsehbar.
            "vorschau": vorschau_beleg(eigene_belege),
        })

    # Nur was die Git-Historie belegt. `last_completed` ist eine Näherung aus dem
    # Arbeitsbaum und steht je Change unter `zuletzt`, nicht in der Zeitleiste.
    zeitleiste = [
        {"at": eintrag.get("at", ""), "change": ch.name, "worktree": ch.worktree_name,
         "number": eintrag.get("number", ""), "text": eintrag.get("text", ""),
         "source": eintrag.get("source", "")}
        for ch in gewaehlte for eintrag in ch.completions
    ]
    zeitleiste.sort(key=lambda eintrag: eintrag["at"], reverse=True)

    # Der Schritt entsteht zuletzt, weil er beide Seiten braucht: den Stand des Baums
    # und die Changes, die ihm zugeordnet sind.
    je_name = {ch["name"]: ch for ch in changes}
    for wt in worktrees:
        wt["schritt"] = naechster_schritt(
            wt, [je_name[n] for n in wt["changes"] if n in je_name])
    worktrees.sort(key=lambda wt: (LAGE_ORDNUNG.get(wt["schritt"]["lage"], 9),
                                   -wt["geaendert_am"], wt["name"]))

    return {
        "generated": snapshot["generated"],
        "root": snapshot["root"],
        "kennzahlen": totals(snapshot),
        "worktrees": worktrees,
        "changes": changes,
        "archiv": archiv,
        "belege": alle_belege,
        "zeitleiste": zeitleiste,
    }


# Eine Datei, vom Programm selbst ausgeliefert: kein Build, kein Bundler, kein
# Framework. Sie holt sich den Stand von /api/stand und zeichnet ihn; alles, was
# entschieden werden muss, ist vorher in `web_nutzlast` entschieden.
WEB_SEITE = """<!doctype html>
<html lang="de">
<meta charset="utf-8">
<title>Lagebild — ops-lab</title>
<style>
  :root {
    --rot: #e3000f; --gruen: #4caf50; --gelb: #e0a800; --blau: #4a9eff;
    --grau: #8a8f98; --linie: #2a2e35; --karte: #171a1f; --grund: #0e1013;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--grund); color: #e6e8eb; font: 14px/1.5
         ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  header { padding: 18px 24px; border-bottom: 2px solid var(--rot);
           display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; }
  header h1 { margin: 0; font-size: 17px; letter-spacing: .5px; }
  header h1 span { color: var(--rot); }
  .zahlen { display: flex; gap: 18px; margin-left: auto; color: var(--grau); }
  .zahlen b { color: #e6e8eb; font-weight: 600; }
  main { padding: 20px 24px 60px; display: grid; gap: 28px; }
  section h2 { font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase;
               color: var(--rot); margin: 0 0 4px; }
  section p.hint { margin: 0 0 12px; color: var(--grau); font-size: 12px; }
  /* Eine Gruppe je Arbeitsbaum: links der Baum auf voller Hoehe, rechts daneben
     seine Changes. Die Zuordnung steht damit im Aufbau und nicht mehr im Text. */
  .gruppe { display: grid; grid-template-columns: minmax(290px, 1fr) minmax(420px, 2fr);
            gap: 14px; margin-bottom: 16px; padding-left: 11px;
            border-left: 3px solid var(--linie); }
  .gruppe.l-tun { border-left-color: var(--rot); }
  .gruppe.l-warten { border-left-color: var(--gelb); }
  .gruppe.l-ruhe { border-left-color: var(--gruen); }
  .gruppe > div > .karte:last-child { margin-bottom: 0; }
  .seite > .karte { height: 100%; }
  .schritt { margin-top: 9px; padding-top: 8px; font-size: 12px; color: #dfe3e8;
             border-top: 1px dashed var(--linie); }
  .schritt b { display: block; font-size: 10.5px; letter-spacing: 1.2px; font-weight: 600;
               text-transform: uppercase; color: var(--grau); margin-bottom: 3px; }
  .schritt.s-tun b { color: var(--rot); }
  .schritt.s-warten b { color: var(--gelb); }
  .schritt.s-ruhe b { color: var(--gruen); }
  .schritt code { display: block; margin-top: 6px; padding: 4px 8px; border-radius: 3px;
                  background: #1f2937; color: var(--blau); font-size: 11.5px;
                  white-space: pre; overflow-x: auto; }
  .karte { background: var(--karte); border: 1px solid var(--linie);
           border-left: 3px solid var(--linie); border-radius: 4px;
           padding: 11px 14px; margin-bottom: 9px; }
  .kopf { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .kopf b { font-size: 14px; }
  .wann { color: var(--grau); font-size: 12px; margin-left: auto; }
  .zeile { color: var(--grau); font-size: 12px; margin-top: 4px;
           overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .zeile em { color: #c9ced6; font-style: normal; }
  .marke { font-size: 11px; padding: 1px 7px; border-radius: 9px;
           border: 1px solid currentColor; }
  .frei { color: var(--gruen); } .laeuft { color: var(--blau); }
  .fertig { color: var(--gruen); } .blockiert { color: var(--gelb); }
  .impr { color: var(--gelb); } .haupt { color: var(--rot); }
  .karte.b-laeuft { border-left-color: var(--blau); }
  .karte.b-fertig { border-left-color: var(--gruen); }
  .karte.b-blockiert, .karte.b-impr { border-left-color: var(--gelb); }
  .balken { height: 3px; background: var(--linie); border-radius: 2px; margin-top: 8px; }
  .balken i { display: block; height: 100%; background: var(--blau); border-radius: 2px; }
  .gates { display: flex; gap: 5px; }
  .gate { font-size: 11px; padding: 0 6px; border-radius: 3px;
          background: #1f2937; color: var(--grau); }
  .gate.an { background: rgba(76,175,80,.16); color: var(--gruen); }
  .belege { margin-top: 8px; padding-top: 7px; border-top: 1px dashed var(--linie);
            font-size: 12px; color: var(--grau);
            display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end; }
  .belege img { max-height: 90px; border-radius: 3px; background: #fff; }
  /* Ein Beleg ohne Bild -- eine Ausgabe etwa -- bekommt trotzdem eine Kachel: sonst
     bliebe er unsichtbar, und unsichtbar war er schon lange genug. */
  .belege a { color: var(--grau); text-decoration: none; }
  .belege a:hover { color: var(--blau); }
  .belege .kein, .belege .datei { border: 1px dashed var(--linie); border-radius: 3px;
                                  padding: 6px 9px; font-size: 11px; }
  /* Die Galerie: gleich breite Kacheln, damit die Zeile ruhig bleibt, egal wie
     unterschiedlich gross die Belege sind. */
  .galerie { display: grid; gap: 12px;
             grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); }
  .galerie figure { margin: 0; background: var(--karte); border: 1px solid var(--linie);
                    border-radius: 5px; overflow: hidden; }
  .galerie a.blatt { display: flex; align-items: center; justify-content: center;
                     height: 145px; background: #fff; }
  .galerie a.blatt img { max-width: 100%; max-height: 145px; display: block; }
  .galerie a.blatt.ohne { background: #1f2937; color: var(--grau); font-size: 12px; }
  .galerie figcaption { padding: 7px 9px; font-size: 11px; color: var(--grau);
                        border-top: 1px solid var(--linie); }
  .galerie figcaption b { display: block; color: #c9ced6; font-weight: 600;
                          overflow-wrap: anywhere; }
  .galerie .stufe { color: var(--gruen); }
  .galerie .stufe.vorher { color: var(--gelb); }
  .galerie .archiv { color: var(--grau); }
  /* Das Archiv: je Lauf eine Zeile. Zugeklappt steht dort, was man beim Ueberfliegen
     braucht -- Kennung, Datum, Aufgabenstand, Gates und ein kleines Vorschaubild.
     Zwoelf offene Aufgabenlisten waeren zwoelfmal mehr, als irgendwer lesen will. */
  .archivliste { border: 1px solid var(--linie); border-radius: 5px; overflow: hidden; }
  .azeile { margin: 0; background: var(--karte);
            border-bottom: 1px solid var(--linie); }
  .azeile:last-child { border-bottom: none; }
  .azeile > summary { display: flex; align-items: center; gap: 10px;
                      padding: 5px 12px; min-height: 42px; }
  .azeile > summary:hover { background: #1f2937; }
  .azeile > summary b { color: #c9ced6; font-weight: 600; }
  .azeile .datum { color: var(--grau); font-size: 11px; flex: none; }
  .azeile .kpi { margin-left: auto; overflow: hidden;
                 text-overflow: ellipsis; white-space: nowrap; }
  .azeile .gates { flex: none; }
  /* Die Vorschau steht rechts und bleibt gleich gross, egal wie gross der Beleg ist --
     sonst wuerde die Liste bei jedem Eintrag anders hoch. */
  .azeile .vorschau { flex: none; width: 68px; height: 34px;
                      display: flex; align-items: center; justify-content: flex-end; }
  .azeile .vorschau img { max-width: 68px; max-height: 34px; border-radius: 2px;
                          background: #fff; }
  .azeile .vorschau .ohne { color: var(--linie); font-size: 10px; }
  .azeile .inhalt { padding: 4px 12px 12px; }
  .azeile a.gross { display: block; margin: 8px 0; padding: 6px; text-align: center;
                    background: #fff; border-radius: 3px; }
  .azeile a.gross img { max-width: 100%; max-height: 340px; }
  details { margin-top: 7px; }
  details > summary { cursor: pointer; color: var(--grau); font-size: 12px;
                      list-style: none; user-select: none; }
  details > summary::-webkit-details-marker { display: none; }
  details > summary::before { content: "▸ "; color: var(--rot); }
  details[open] > summary::before { content: "▾ "; }
  details > summary:hover { color: #c9ced6; }
  .liste { margin: 6px 0 2px; padding: 0; list-style: none;
           font-size: 12px; color: #c9ced6; }
  .liste li { padding: 2px 0; display: flex; gap: 8px; align-items: baseline; }
  .liste li.ab { color: var(--grau); }
  .liste .haken { color: var(--gruen); width: 1.2em; flex: none; }
  .liste li:not(.ab) .haken { color: var(--linie); }
  .liste .wo { color: var(--grau); flex: none; min-width: 5.5em; }
  .liste .art { color: var(--gelb); flex: none; min-width: 6.5em; font-size: 11px; }
  .liste .art.unverfolgt { color: var(--grau); }
  .liste .art.geloescht { color: var(--rot); }
  /* Worum es geht: der Wortlaut aus proposal.md. Die Zeilenumbrueche der Datei
     bleiben stehen -- ein Absatz, den jemand gegliedert hat, wird nicht geglaettet. */
  .worum b { display: block; margin: 7px 0 2px; color: #c9ced6; font-size: 11px;
             text-transform: uppercase; letter-spacing: .04em; }
  .worum p { margin: 0; font-size: 12px; color: #c9ced6; white-space: pre-wrap;
             overflow-wrap: anywhere; }
  /* Fehlt ein Abschnitt, steht dort ein Hinweis und kein leerer Kasten: das Fehlen
     ist die Auskunft. */
  .worum p.fehlt { color: var(--gelb); font-style: italic; white-space: normal; }
  /* Der Dateiabgleich: die Lage faerbt die Zeile. Deckung ist gruen und wird genannt,
     nicht verschwiegen; was ohne Zusage angefasst wurde, steht rot. */
  .liste .lage { flex: none; min-width: 11em; font-size: 11px; }
  .liste .lage.beides { color: var(--gruen); }
  .liste .lage.nur_zugesagt { color: var(--gelb); }
  .liste .lage.nur_angefasst { color: var(--rot); }
  .liste .zahl { color: var(--grau); flex: none; margin-left: auto; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  td { padding: 4px 10px 4px 0; border-bottom: 1px solid var(--linie);
       vertical-align: top; }
  td.t { color: var(--gruen); white-space: nowrap; }
  td.c { color: #c9ced6; white-space: nowrap; }
  td.n { color: var(--grau); white-space: nowrap; }
  td.q { color: var(--grau); text-align: right; white-space: nowrap; }
  .leer { color: var(--grau); font-size: 12px; padding: 6px 0; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; background: var(--grund);
           border-top: 1px solid var(--linie); padding: 6px 24px; font-size: 11px;
           color: var(--grau); display: flex; gap: 18px; }
  @media (max-width: 900px) { .gruppe { grid-template-columns: 1fr; } }
</style>
<header>
  <h1>ops<span>·</span>lab &nbsp;Lagebild</h1>
  <div id="wurzel" class="wann"></div>
  <div class="zahlen" id="zahlen"></div>
</header>
<main>
  <section>
    <h2>Wo und was</h2>
    <p class="hint">Je Arbeitsbaum eine Gruppe: links der Baum mit seinem nächsten Schritt,
      rechts die Changes, die er bearbeitet — was zu tun ist, steht oben</p>
    <div id="gruppen"></div>
  </section>
  <section>
    <h2>Abgeschlossen</h2>
    <p class="hint">Je archiviertem Change eine Zeile mit Vorschau — anklicken für den
      Beleg in groß, die abgehakten Aufgaben und die übrigen Belege</p>
    <div id="archiv"></div>
  </section>
  <section>
    <h2>Belegt</h2>
    <p class="hint">Jeder eingelieferte Beleg, über alle Changes und auch die archivierten —
      jüngster zuerst</p>
    <div id="galerie"></div>
  </section>
  <section class="zeit">
    <h2>Wann</h2>
    <p class="hint">Jede aus der Git-Historie belegte Fertigstellung, über alle Arbeitsbäume</p>
    <div id="zeitleiste"></div>
  </section>
</main>
<footer>
  <span id="stand">lädt …</span>
  <span>nur lesend — Gates laufen auf der Kommandozeile</span>
</footer>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const uhr = (epoch) => epoch
  ? new Date(epoch * 1000).toLocaleString("de-DE",
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "—";
// Der Abschlusszeitpunkt kommt als ISO aus dem Gate-Nachweis, also in UTC. Gezeigt
// wird er in der Zeitzone des Betrachters -- dieselbe Rechnung wie bei `uhr`, nur aus
// einer anderen Quelle. Das Jahr steht dabei, weil ein Archiv ueber Jahre laeuft.
const zeitstempel = (iso) => {
  if (!iso) return "";
  const wann = new Date(iso);
  return Number.isNaN(wann.getTime()) ? "" : wann.toLocaleString("de-DE",
    { day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit" });
};
const klasse = (b) => ({ "im PR": "impr" })[b] ?? b;

// Die Ansicht zeichnet sich alle 5 s neu. Ohne Gedaechtnis klappte dabei jedes
// geoeffnete Detail wieder zu -- man koennte nichts lesen, was laenger dauert als
// ein Intervall. Gemerkt wird die Entscheidung eines Menschen, und zwar im Browser.
//
// Gemerkt wird sie in beide Richtungen, offen wie zu. Ein blosses Set koennte "noch
// nie angefasst" nicht von "bewusst zugeklappt" unterscheiden: bei jeder Klappe mit
// der Vorgabe offen wuerde das Zuklappen den naechsten Takt nicht ueberleben. Die
// Karte ist die Entscheidung; die Vorgabe gilt nur, solange dort nichts steht.
const klappstand = new Map();
document.addEventListener("toggle", (ereignis) => {
  const ziel = ereignis.target;
  if (ziel.tagName !== "DETAILS" || !ziel.dataset.id) return;
  klappstand.set(ziel.dataset.id, ziel.open);
}, true);

const istOffen = (id, vorgabe) => klappstand.has(id) ? klappstand.get(id) : vorgabe;

const aufklappbar = (id, titel, inhalt, vorgabe = false) => `<details data-id="${esc(id)}"${
  istOffen(id, vorgabe) ? " open" : ""
}><summary>${esc(titel)}</summary>${inhalt}</details>`;

function worktreeKarte(wt) {
  const schmutz = [
    wt.vorgemerkt && wt.vorgemerkt + " vorgemerkt",
    wt.geaendert && wt.geaendert + " geändert",
    wt.unverfolgt && wt.unverfolgt + " unverfolgt",
  ].filter(Boolean).join(" · ") || "sauber";
  const versatz = [
    wt.voraus && wt.voraus + " voraus",
    wt.zurueck && wt.zurueck + " zurück",
  ].filter(Boolean).join(" · ");
  return `<div class="karte">
    <div class="kopf">
      <b>${esc(wt.name)}</b>
      ${wt.haupt ? '<span class="marke haupt">Hauptbaum</span>' : ""}
      ${wt.fehler ? '<span class="marke blockiert">' + esc(wt.fehler) + "</span>" : ""}
      <span class="wann">${uhr(wt.geaendert_am)}</span>
    </div>
    <div class="zeile"><em>${esc(wt.branch)}</em>${versatz ? " · " + esc(versatz) : ""}</div>
    <div class="zeile">${esc(wt.kopf)} ${esc(wt.betreff)}</div>
    <div class="zeile">${esc(schmutz)}</div>
    ${wt.dateien.length ? aufklappbar("wt:" + wt.name,
      wt.dateien.length + " geänderte Datei" + (wt.dateien.length > 1 ? "en" : ""),
      '<ul class="liste">' + wt.dateien.map((d) =>
        `<li><span class="art ${esc(d.art)}">${esc(d.art)}</span>${esc(d.pfad)}</li>`
      ).join("") + "</ul>") : ""}
    <div class="schritt s-${esc(wt.schritt.lage)}">
      <b>nächster Schritt</b>${esc(wt.schritt.text)}
      ${wt.schritt.befehl ? "<code>" + esc(wt.schritt.befehl) + "</code>" : ""}
    </div>
  </div>`;
}

// Der Arbeitsbaum steht an der Seite, seine Changes daneben. Ein Baum ohne Change
// verschwindet nicht: dass dort nichts liegt, ist die Auskunft.
function gruppe(wt, changes) {
  return `<div class="gruppe l-${esc(wt.schritt.lage)}">
    <div class="seite">${worktreeKarte(wt)}</div>
    <div>${changes.length ? changes.map(changeKarte).join("")
      : '<div class="karte leer">kein Change in diesem Arbeitsbaum</div>'}</div>
  </div>`;
}

// Ob sich ein Beleg zeigen laesst, sagt die Nutzlast: dieselbe Entscheidung, mit der
// die Route ihn ausliefert. Ein Graph in der Form DOT ist eine Textdatei, die man
// oeffnen, aber nicht betrachten kann -- er bekommt eine beschriftete Kachel.
const dateiname = (b) => String(b.adresse).split("/").pop();
const belegzeit = (iso) => String(iso ?? "").slice(0, 16).replace("T", " ");

function belegKachel(b) {
  const titel = `${b.stufe} · ${b.art} · ${dateiname(b)}`;
  return b.zeigbar
    ? `<a href="${esc(b.adresse)}" target="_blank" title="${esc(titel)}">`
      + `<img src="${esc(b.adresse)}" alt="${esc(titel)}"></a>`
    : `<a class="datei" href="${esc(b.adresse)}" target="_blank">`
      + `${esc(b.stufe)} · ${esc(dateiname(b))}</a>`;
}

function galerieKachel(b) {
  const blatt = b.zeigbar
    ? `<a class="blatt" href="${esc(b.adresse)}" target="_blank">`
      + `<img src="${esc(b.adresse)}" alt="${esc(b.change)} — ${esc(b.stufe)}"></a>`
    : `<a class="blatt ohne" href="${esc(b.adresse)}" target="_blank">`
      + `${esc(b.art)} · ${esc(dateiname(b))}</a>`;
  return `<figure>${blatt}<figcaption>
      <b>${esc(b.change)}</b>
      <span class="stufe ${b.stufe === "vorher" ? "vorher" : ""}">${esc(b.stufe)}</span>
      · ${esc(b.art)} · ${esc(belegzeit(b.zeit))}
      ${b.archiviert ? '<span class="archiv">· archiviert</span>' : ""}
    </figcaption></figure>`;
}

// Fehlt ein Abschnitt, ist das die Auskunft: die Karte nennt die Ueberschrift, die im
// proposal.md fehlt. Ein leerer Kasten waere ein Verschweigen -- man saehe nicht, ob
// niemand etwas abgegrenzt hat oder ob die Ansicht es nur nicht findet.
const absatz = (text, ueberschrift) => text
  ? `<p>${esc(text)}</p>`
  : `<p class="fehlt">kein Abschnitt „${esc(ueberschrift)}" im proposal.md</p>`;

// Worum es geht: das Warum und die Abgrenzung, im Wortlaut des Vorhabens. Zu als
// Vorgabe -- der Wortlaut eines Vorhabens fuellt allein schon eine Bildschirmhoehe,
// und die Ansicht zeigt nicht eine Karte, sondern alle.
function worumKlappe(ch) {
  const worum = ch.worum ?? { warum: "", abgrenzung: "" };
  return aufklappbar("ch:" + ch.name + ":worum", "Worum es geht",
    '<div class="worum"><b>Warum</b>' + absatz(worum.warum, "Warum")
    + "<b>Was ausdrücklich nicht</b>" + absatz(worum.abgrenzung, "Was ausdrücklich nicht")
    + "</div>");
}

// Die Anforderungen als Titel mit der Zahl ihrer Faelle. Der Volltext bleibt in der
// Datei: Requirements laufen hier regelmaessig ueber 500 Zeichen, und drei davon
// haetten die Karte unlesbar gemacht. Zu als Vorgabe.
function anforderungenKlappe(ch) {
  const liste = ch.anforderungen ?? [];
  const titel = liste.length
    ? `${liste.length} Anforderung${liste.length > 1 ? "en" : ""}`
    : "Anforderungen";
  const inhalt = liste.length
    ? '<ul class="liste">' + liste.map((a) =>
        `<li><span class="art">${esc(a.art)}</span><span class="wo">${esc(a.capability)}</span>`
        + `${esc(a.titel)}<span class="zahl">${a.szenarien} `
        + `Szenari${a.szenarien === 1 ? "o" : "en"}</span></li>`
      ).join("") + "</ul>"
    : '<div class="worum"><p class="fehlt">keine Delta-Spec in diesem Change</p></div>';
  return aufklappbar("ch:" + ch.name + ":anforderungen", titel, inhalt, false);
}

// Zusage gegen Diff. Beide Richtungen stehen da: angefasst ohne Zusage und zugesagt
// ohne Anfassen -- und Deckung wird als Deckung gemeldet. Der Parallelbetrieb haengt
// an dieser Zusage; ungeprueft waere sie nur eine Behauptung. Zu als Vorgabe: die
// Zahlen je Lage stehen im Titel, die Pfade dahinter.
const LAGE_WORT = { beides: "gedeckt", nur_zugesagt: "ohne Änderung", nur_angefasst: "ohne Zusage" };

function dateienKlappe(ch) {
  const dateien = ch.dateien ?? { zugesagt: [], angefasst: [], abgleich: [] };
  const abgleich = dateien.abgleich ?? [];
  const zaehle = (lage) => abgleich.filter((e) => e.lage === lage).length;
  const teile = [
    zaehle("beides") + " gedeckt",
    zaehle("nur_angefasst") + " ohne Zusage",
    zaehle("nur_zugesagt") + " ohne Änderung",
  ];
  const inhalt = abgleich.length
    ? '<ul class="liste">' + abgleich.map((e) =>
        `<li><span class="lage ${esc(e.lage)}">${esc(LAGE_WORT[e.lage] ?? e.lage)}</span>`
        + `${esc(e.pfad)}</li>`
      ).join("") + "</ul>"
    : '<div class="worum"><p class="fehlt">kein Abschnitt „Berührte Dateien" im '
      + "proposal.md und keine Änderung im Arbeitsbaum</p></div>";
  return aufklappbar("ch:" + ch.name + ":dateien", "Dateien: " + teile.join(" · "),
    inhalt);
}

function changeKarte(ch) {
  const gates = ["gate1", "gate2", "fertig"].map((g) =>
    `<span class="gate ${ch.gates.includes(g) ? "an" : ""}">${g}</span>`).join("");
  const naechste = ch.naechste
    ? `<div class="zeile">als nächstes: <em>${esc(ch.naechste.number ?? "")} ${esc(ch.naechste.text)}</em></div>`
    : "";
  const blocker = ch.blockiert_durch.length
    ? `<div class="zeile blockiert">wartet auf ${esc(ch.blockiert_durch.join(", "))}</div>` : "";
  const belege = ch.belege.length
    ? ch.belege.map(belegKachel).join("")
    : '<span class="kein">noch kein Beleg eingeliefert</span>';
  // Der Change steht genau einmal. Liegt er abweichend auch anderswo, sagt die
  // Karte das -- sonst waere die Eindeutigkeit ein Verschweigen.
  const auchIn = ch.auch_in.length
    ? `<div class="zeile">liegt abweichend auch in ${esc(ch.auch_in.join(", "))}</div>` : "";
  // Der Arbeitsbaum steht am Gruppenkopf und muss hier nicht noch einmal stehen.
  const beiwerk = [ch.weicht_ab ? "" : "unverändert", ...ch.capabilities]
    .filter(Boolean).join(" · ");
  // Zu als Vorgabe wie die uebrigen drei Klappen: den Stand nennt der Titel, die
  // einzelnen Aufgaben braucht nur, wer den Change gerade bearbeitet.
  const aufgaben = ch.aufgaben.length ? aufklappbar("ch:" + ch.name + ":aufgaben",
    `${ch.erledigt} von ${ch.gesamt} Aufgaben`,
    '<ul class="liste">' + ch.aufgaben.map((a) =>
      `<li class="${a.erledigt ? "ab" : ""}"><span class="haken">${a.erledigt ? "✓" : "○"}</span>`
      + `<span class="wo">${esc(a.nummer || "—")}</span>${esc(a.text)}</li>`
    ).join("") + "</ul>") : "";
  return `<div class="karte b-${klasse(ch.bereitschaft)}">
    <div class="kopf">
      <b>${esc(ch.name)}</b>
      <span class="marke ${klasse(ch.bereitschaft)}">${esc(ch.bereitschaft)}</span>
      <span class="wann">${ch.erledigt}/${ch.gesamt} · ${uhr(ch.geaendert_am)}</span>
    </div>
    ${beiwerk ? '<div class="zeile">' + esc(beiwerk) + "</div>" : ""}
    ${auchIn}${naechste}${blocker}
    <div class="balken"><i style="width:${ch.prozent}%"></i></div>
    <div class="zeile gates" style="margin-top:8px">${gates}</div>
    ${worumKlappe(ch)}
    ${anforderungenKlappe(ch)}
    ${dateienKlappe(ch)}
    ${aufgaben}
    <div class="belege">${belege}</div>
  </div>`;
}

// Ein abgeschlossener Lauf ist eine Zeile, keine Kachel: was man beim Ueberfliegen
// braucht, steht zugeklappt da, alles Weitere erscheint auf Klick. Welcher Beleg die
// Vorschau stellt, sagt die Nutzlast -- hier wird er nur noch gezeigt.
function archivZeile(a) {
  const id = "arch:" + a.name;
  const gates = ["gate1", "gate2", "fertig"].map((g) =>
    `<span class="gate ${a.gates.includes(g) ? "an" : ""}">${g}</span>`).join("");
  const kpi = [
    a.gesamt ? `${a.erledigt}/${a.gesamt} Aufgaben` : "ohne Aufgabenliste",
    a.belege.length ? a.belege.length + " Beleg" + (a.belege.length > 1 ? "e" : "") : "",
    ...a.capabilities,
  ].filter(Boolean).join(" · ");
  const vorschau = a.vorschau
    ? `<img src="${esc(a.vorschau.adresse)}" alt="${esc(a.kennung)}">`
    : '<span class="ohne">kein Bild</span>';
  const gross = a.vorschau
    ? `<a class="gross" href="${esc(a.vorschau.adresse)}" target="_blank">`
      + `<img src="${esc(a.vorschau.adresse)}" alt="${esc(a.kennung)}"></a>`
    : "";
  // Der Vorschaubeleg steht oben gross und muss unten nicht noch einmal stehen.
  const uebrige = a.belege.filter((b) => !a.vorschau || b.adresse !== a.vorschau.adresse);
  const aufgaben = a.aufgaben.length
    ? '<ul class="liste">' + a.aufgaben.map((t) =>
        `<li class="${t.erledigt ? "ab" : ""}"><span class="haken">${t.erledigt ? "✓" : "○"}</span>`
        + `<span class="wo">${esc(t.nummer || "—")}</span>${esc(t.text)}</li>`
      ).join("") + "</ul>"
    : '<div class="zeile">ohne Aufgabenliste</div>';
  return `<details class="azeile" data-id="${esc(id)}"${istOffen(id, false) ? " open" : ""}>
    <summary>
      <b>${esc(a.kennung)}</b>
      <span class="datum">${esc(zeitstempel(a.zeitpunkt) || a.datum || "ohne Datum")}</span>
      <span class="zeile kpi">${esc(kpi)}</span>
      <span class="gates">${gates}</span>
      <span class="vorschau">${vorschau}</span>
    </summary>
    <div class="inhalt">
      ${gross}
      ${aufgaben}
      ${uebrige.length ? '<div class="belege">' + uebrige.map(belegKachel).join("") + "</div>" : ""}
    </div>
  </details>`;
}

function zeichne(stand) {
  $("wurzel").textContent = stand.root;
  const k = stand.kennzahlen;
  $("zahlen").innerHTML = [
    ["Arbeitsbäume", k.worktrees], ["Changes", k.changes],
    ["läuft", k.in_progress], ["offen", k.open], ["fertig", k.complete],
    ["Aufgaben", k.tasks_done + "/" + k.tasks_total],
  ].map(([n, v]) => `${n} <b>${v}</b>`).join("");

  const jeName = new Map(stand.changes.map((ch) => [ch.name, ch]));
  $("gruppen").innerHTML = stand.worktrees.length
    ? stand.worktrees.map((wt) =>
        gruppe(wt, wt.changes.map((n) => jeName.get(n)).filter(Boolean))).join("")
    : '<div class="leer">kein Arbeitsbaum gefunden</div>';
  $("archiv").innerHTML = stand.archiv.length
    ? '<div class="archivliste">' + stand.archiv.map(archivZeile).join("") + "</div>"
    : '<div class="leer">noch kein Change archiviert</div>';
  $("galerie").innerHTML = stand.belege.length
    ? '<div class="galerie">' + stand.belege.map(galerieKachel).join("") + "</div>"
    : '<div class="leer">noch kein Beleg eingeliefert</div>';
  $("zeitleiste").innerHTML = stand.zeitleiste.length
    ? "<table>" + stand.zeitleiste.map((e) => `<tr>
        <td class="t">${esc(e.at.slice(0, 16).replace("T", " "))}</td>
        <td class="c">${esc(e.change)}</td>
        <td class="n">${esc(e.number)}</td>
        <td>${esc(e.text)}</td>
        <td class="q">${esc(e.worktree)} · ${esc(e.source)}</td>
      </tr>`).join("") + "</table>"
    : '<div class="leer">keine Fertigstellung in der Historie belegt</div>';
  $("stand").textContent = "Stand " + stand.generated.slice(11, 19)
    + " — Ansicht erneuert sich alle 5 s";
}

async function hole() {
  try {
    zeichne(await (await fetch("/api/stand")).json());
  } catch (fehler) {
    $("stand").textContent = "Stand nicht erreichbar: " + fehler;
  }
}
hole();
setInterval(hole, 5000);
</script>
</html>
"""

FEHLT_HINWEIS = """Für --web fehlen FastAPI und uvicorn.

Das Lagebild bleibt bewusst ohne Abhängigkeit; die Web-Ansicht ist der eine
Aufruf, der welche braucht, und holt sie sich zur Laufzeit:

  just web

Das entspricht: uv run --with fastapi --with uvicorn python3 ops.py --web

Ohne Web-Ansicht laufen --once, --graph, --json und --count unverändert weiter."""


def web_meldung(host: str, port: int) -> str:
    """Die Startzeile: wo die Ansicht zu erreichen ist, und wie weit sie reicht.

    Reine Textfunktion, damit die Zusage prüfbar bleibt. Eine offene Bindung ist im
    Browser nicht als Adresse zu gebrauchen (`http://0.0.0.0` führt nirgends hin),
    deshalb nennt die Zeile dann den Port und sagt dazu, wer alles mitliest.
    """
    if host in WEB_OFFEN:
        return (f"Lagebild: Port {port} auf allen Adressen — im lokalen Netz erreichbar"
                "    (Strg-C beendet)")
    return f"Lagebild: http://{host}:{port}    (Strg-C beendet)"


def port_belegt(host: str, port: int) -> bool:
    """Ob sich die Adresse binden lässt — geprüft mit der Standardbibliothek.

    Vor dem Import von uvicorn, aus zwei Gründen: die Meldung kommt damit auch in
    einer Umgebung ohne FastAPI zustande, und niemand sieht mehr eine Startzeile,
    der ein Traceback der Fremdbibliothek folgt.
    """
    with socket.socket(socket.AF_INET6 if ":" in host else socket.AF_INET,
                       socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((host or "0.0.0.0", port))
        except OSError:
            return True
    return False


def starte_web(root: Path, worktree_filter: str | None, port: int,
               host: str = WEB_HOST) -> int:
    """Startet das Lagebild als nur lesende HTTP-Ansicht auf `host`.

    Der Import steht hier und nicht oben: so bleibt jeder andere Aufruf von ops.py
    nachweisbar abhängigkeitsfrei, auch in einer Umgebung ohne FastAPI.
    """
    if port_belegt(host, port):
        print(f"Port {port} ist auf {host} bereits belegt. Ein anderer Port: "
              f"--web-port <nummer>.", file=sys.stderr)
        return 4

    try:
        import uvicorn
        from fastapi import FastAPI, HTTPException
        from fastapi.responses import FileResponse, HTMLResponse
    except ImportError:
        print(FEHLT_HINWEIS, file=sys.stderr)
        return 3

    app = FastAPI(title="ops-lab — Lagebild", docs_url=None, redoc_url=None)

    @app.get("/", response_class=HTMLResponse)
    def seite() -> str:
        return WEB_SEITE

    @app.get("/api/stand")
    def stand() -> dict:
        return web_nutzlast(web_erhebung(collect(root, worktree_filter)))

    @app.get("/beleg/{rest:path}")
    def beleg(rest: str) -> FileResponse:
        # Nur lesend, und nur was die Erhebung ausweist: `beleg_aufloesen` deutet die
        # Adresse nicht als Pfad, sondern schlaegt sie nach. Alles andere ist 404.
        ziel = beleg_aufloesen(root, f"/beleg/{rest}")
        if ziel is None:
            raise HTTPException(status_code=404, detail="Kein solcher Beleg")
        # Den Inhaltstyp bestimmt dieses Programm, nicht die Fremdbibliothek.
        return FileResponse(ziel, media_type=beleg_typ(ziel))

    print(web_meldung(host, port))
    uvicorn.run(app, host=host, port=port, log_level="warning")
    return 0


# ----------------------------------------------------------------------------- Haupt

def find_root(explicit: str | None) -> Path:
    """Die Repo-Wurzel: `--root`, sonst das Repo des aktuellen Ordners, sonst das des Skripts.

    So arbeitet `ops` in dem Repo, in dem es gestartet wurde, nicht immer in dem, in dem das
    Skript liegt. Der Rückfall auf den Skriptordner greift nur, wenn weder der aktuelle Ordner
    noch der Skriptordner in einem Git-Repo liegen.
    """
    if explicit:
        return Path(explicit).expanduser().resolve()
    candidates = (Path.cwd(), Path(__file__).resolve().parent)
    for base in candidates:
        result = git(base, ["rev-parse", "--show-toplevel"])
        if result.rc == 0 and result.out.strip():
            return Path(result.out.strip()).resolve()
    return Path.cwd()


def main(argv: list[str] | None = None) -> int:
    global _color_on
    parser = argparse.ArgumentParser(
        prog="ops.py",
        description="Live-Statusboard der OpenSpec-Changes über alle Git-Worktrees.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Aufrufe:")[-1] if "Aufrufe:" in __doc__ else None,
    )
    parser.add_argument("--root", help="Repo-Wurzel (Vorgabe: Repo des aktuellen Ordners)")
    parser.add_argument("--worktree", help="nur Worktrees, deren Pfad diesen Text enthält")
    parser.add_argument("--interval", type=float, default=1.0, help="Takt in Sekunden (Vorgabe 1.0)")
    parser.add_argument("--once", action="store_true", help="einmal ausgeben, dann Ende")
    parser.add_argument("--graph", action="store_true",
                        help="Aufgaben-Graph: Changes zeitlich einsortiert samt Kanten")
    parser.add_argument("--json", action="store_true", help="Stand als JSON ausgeben")
    parser.add_argument("--web", action="store_true",
                        help="Lagebild als nur lesende HTTP-Ansicht im Browser")
    parser.add_argument("--web-port", type=int, default=WEB_PORT,
                        help=f"Port der Web-Ansicht (Vorgabe {WEB_PORT})")
    parser.add_argument("--web-host", default=WEB_HOST,
                        help=f"Bindeadresse der Web-Ansicht (Vorgabe {WEB_HOST}; "
                             "0.0.0.0 macht sie im lokalen Netz erreichbar)")
    parser.add_argument("--trocken", action="store_true",
                        help="mit --web: die Nutzlast ausgeben, ohne Server zu starten")
    parser.add_argument("--no-color", action="store_true", help="ohne Farben")
    parser.add_argument("--count", action="store_true", help="nur die Kennzahlen ausgeben")
    parser.add_argument("--selftest", action="store_true", help="Parser gegen den Bestand prüfen")
    args = parser.parse_args(argv)

    if args.no_color or os.environ.get("NO_COLOR") or not sys.stdout.isatty():
        _color_on = False

    root = find_root(args.root)
    if not root.exists():
        print(f"Repo-Wurzel nicht gefunden: {root}", file=sys.stderr)
        return 2

    if args.selftest:
        return selftest()

    if args.count:
        snapshot = collect(root, args.worktree)
        summary = totals(snapshot)
        print(json.dumps(summary, ensure_ascii=False))
        return 0

    if args.json:
        print(json.dumps(to_json(collect(root, args.worktree)), ensure_ascii=False, indent=2))
        return 0

    if args.trocken and not args.web:
        print("--trocken wirkt nur zusammen mit --web.", file=sys.stderr)
        return 2

    if args.web:
        # Der Trockenlauf gibt dieselbe Nutzlast aus, die die Ansicht bekommt, und
        # startet nichts. Er ist die Tuer, durch die der Test geht.
        if args.trocken:
            print(json.dumps(web_nutzlast(web_erhebung(collect(root, args.worktree))),
                             ensure_ascii=False, indent=2))
            return 0
        return starte_web(root, args.worktree, args.web_port, args.web_host)

    if args.interval < 0.2:
        args.interval = 0.2

    view = "graph" if args.graph else "board"

    if args.once:
        snapshot = collect(root, args.worktree)
        started = time.time()
        for line in render_view(snapshot, [], args.interval, started, view):
            print(_ANSI_RE.sub("", line) if not _color_on else line)
        return 0

    try:
        return live_loop(root, args.worktree, args.interval, view)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
