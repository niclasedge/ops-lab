# Verworfen — nicht gemergt

Dieser Change ist **vollständig durchlaufen und trotzdem nicht in `main` gelandet**.
Gate 1 8/8, Gate 2 4/4, Abschluss 5/5, zwei Commits, PR #7 — und dann geschlossen.

Er liegt hier, weil ein Lauf, den man wegwirft, sonst spurlos verschwindet. Die drei
Nachweise nebenan belegen, dass der Ablauf gehalten hat; verworfen wurde nicht die
Arbeit am Ablauf, sondern ihr Gegenstand.

## Warum

`tests-eigenes-repo` hat denselben Fehler behoben, zur selben Zeit, in einer zweiten
Sitzung. Beide bauten `tests/lagebild-web.test.mjs` ein Wegwerf-Repo unter `mkdtemp`,
beide kamen auf exakt 40 `it()`. Der Merge von `tests-eigenes-repo` (`1ae899d`, 14:42)
war zuerst da; PR #7 stand danach auf CONFLICTING, und der Konflikt lag über die ganze
Datei.

Aufgefallen ist es erst am Konflikt — also nachdem beide Läufe fertig waren. *Nächste
freie Changes* im Lagebild vergleicht die Zusagen unter „Berührte Dateien", aber nur von
Changes, die als Ordner schon existieren. Ein Branch, an dem jemand gerade arbeitet, ohne
dass sein Change-Ordner auf `main` liegt, ist dort unsichtbar.

## Was davon weiterlebt

Vier Prüfungen dieses Changes hatte `tests-eigenes-repo` nicht. Sie sind als eigener
Change `pruefstand-tiefe` nachgezogen worden und stecken in `main`:

- der Prüfstand belegt alle vier Dateiarten, nicht nur die eine, die zufällig herumlag
- die Zeitleiste wird gegen eine selbst angelegte Fertigstellung geprüft

Verloren ist nichts außer der Zeit für den doppelten Lauf.

## Wo der Befund steht

`docs/beobachtungen.md`, Abschnitt *2026-09-20 · Zwei Sitzungen haben denselben Fehler
zweimal repariert*. Dort steht auch der Kandidat für die Abhilfe: gepushte Branches und
angelegte Arbeitsräume im Lagebild führen, auch ohne Change-Ordner.

Noch ist das ein Fall und kein Muster. Ein zweiter Fall macht daraus eine Aufgabe.
