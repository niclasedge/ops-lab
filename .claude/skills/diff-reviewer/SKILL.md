---
name: diff-reviewer
description: Hält die Zusage aus dem Vorschlag eines Changes gegen den Diff und liest den Befund. Aufrufen, bevor ein Pull Request gestellt wird, oder wenn unklar ist, ob ein Change noch in seinem zugesagten Dateiumfang liegt.
---

# Diff-Reviewer

Jeder Vorschlag nennt unter **Berührte Dateien**, was der Change anfasst. Diese Liste ist die
Zusage, auf der der Parallelbetrieb ruht: zwei Changes laufen gleichzeitig, wenn ihre
Dateimengen disjunkt sind, und das Lagebild entscheidet genau danach. Sie prüfen, ob der Diff
sie eingehalten hat.

Alle Aufrufe laufen im Arbeitsraum des Changes — dem Arbeitsverzeichnis, aus dem Sie gerufen
wurden. `git rev-parse --show-toplevel` nennt Ihnen den Pfad, falls Sie ihn brauchen.

## 1. Abgleichen

    just abgleich KENNUNG

Gegen eine andere Basis als `main`:

    just abgleich KENNUNG zweig

Gerechnet wird gegen den gemeinsamen Vorfahren, einschließlich dessen, was noch nicht
committet ist. Der Abgleich läuft deshalb sinnvoll ab dem ersten Handgriff, nicht erst nach
dem Commit.

## 2. Den Befund lesen

Der Bericht kennt drei Ausgänge.

**deckungsgleich** — der Diff hält sich an die Zusage. Nichts zu tun; weiter mit
`just fertig KENNUNG` und `just pr KENNUNG`.

**Zusatz — angefasst, aber nicht zugesagt.** Die ernste Richtung. Das Lagebild hat diesen
Change anhand seiner Zusage neben andere gestellt; eine Datei, die dort nicht steht, kann
genau der Konflikt sein, den die Zusage verhindern sollte. Zwei Wege, und Sie entscheiden
begründet:

- Die Datei gehört zum Change: in den Vorschlag aufnehmen und prüfen, ob dadurch eine
  Überschneidung mit einem laufenden Change entsteht — `just lage` zeigt, wer sonst noch
  arbeitet.
- Die Datei gehört nicht dazu: aus dem Change heraushalten und getrennt behandeln. Eine
  nebenbei mitgenommene Korrektur ist der häufigste Fall.

**Auslassung — zugesagt, aber nicht angefasst.** Kein Risiko für den Parallelbetrieb, aber
meist ein Hinweis, dass der Zuschnitt sich unterwegs verschoben hat. Prüfen Sie, ob der
Vorschlag noch beschreibt, was der Change tut. Steht dort eine Datei, die Sie bewusst nicht
mehr anfassen, gehört das in den Vorschlag, nicht in den Kopf.

Ein einzelnes Wort ohne Schrägstrich in der Liste — der Name eines `just`-Ziels etwa — taucht
als Auslassung auf. Das ist keine Abweichung, sondern die Grenze einer Textregel: von einem
Dateinamen wie `justfile` ist es nicht zu unterscheiden.

## 3. Melden

Melden Sie der Person am Rechner beide Richtungen getrennt und Ihre Einschätzung dazu. Bei
Deckungsgleichheit genügt ein Satz.

## Grenzen

**Der Abgleich ist kein Gate.** Er endet mit Exit 0, auch wenn er etwas findet, und keine
Datei hängt von ihm ab. Das ist Absicht: eine Zusage kann sich im Lauf eines Changes
berechtigt ändern, und ein Gate, das daran scheitert, erzeugt Druck, die Zusage nachträglich
passend zu schreiben, statt sie ernst zu nehmen. Gates prüfen, was sich ohne Urteil
entscheiden lässt — das hier lässt sich das nicht.

Er vergleicht Dateinamen, keine Inhalte. Ob eine zugesagte Datei sinnvoll geändert wurde,
sieht er nicht.

Die Artefakte des Ablaufs unter `openspec/` zählt er nicht als Zusatz. Sie fallen in jedem
Lauf an, und niemand muss sie zusagen.

Sie schreiben keine Zusage um, nur damit der Bericht ruhig wird. Wer die Liste nachträglich
an den Diff anpasst, ohne den Zuschnitt zu prüfen, hat den Abgleich abgeschafft, nicht
bestanden.
