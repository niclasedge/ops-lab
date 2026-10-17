# Entscheidungen — beleg-bild

## Wann faellt das Urteil ueber einen Beleg

Ein Beleg nennt einen Pfad. Irgendwann muss jemand entscheiden, ob dahinter etwas
Brauchbares liegt. Es gibt zwei Zeitpunkte.

**Gewaehlt: beim Einliefern, das Ergebnis wird gespeichert.** Die Pruefung laeuft
einmal, das Urteil steht als Merkmal in der Journalzeile, und jede spaetere Frage
liest nur noch dieses Merkmal.

Alternative: beim Lesen. Wer wissen will, ob ein Change belegt ist, schaut im Moment
der Frage nach, ob die Datei da ist.

Der Tradeoff ist die Bedeutung des Journals. Wird beim Lesen geprueft, beschreibt das
Journal den heutigen Zustand der Platte; ein abgeschlossener Change verliert seinen
Nachweis, sobald jemand einen Ordner umbenennt oder einen Worktree entfernt. Wird beim
Schreiben geprueft, beschreibt das Journal den Moment, in dem der Beleg entstand — und
das ist die Aussage, die ein Nachweis treffen soll.

Der Ausschlag kommt aus der Messung im Nachbarprojekt: `git-planner-go` zaehlte
in seinem laufenden Bestand fuenf Belege, deren Pfade nicht mehr existieren, verteilt
auf sieben abgeschlossene Vorgaenge — vier davon unter `/tmp`, einer in einem
geloeschten Worktree. Unter einer Pruefung beim Lesen waeren diese sieben rueckwirkend
rot geworden, ohne dass sich an ihrer Arbeit etwas geaendert haette. Die Begruendung
steht dort ausformuliert in `internal/reports/evidence.go`.

Der Preis: ein Beleg, dessen Kopie im Store spaeter von Hand geloescht wird, gilt
weiter als vorhanden. Das ist hinnehmbar, weil die Kopie im Change-Ordner liegt und
mit ihm versioniert wird — sie zu loeschen, steht im Diff.

## Streng beim Schreiben, milde beim Lesen

**Gewaehlt: der Abschluss fordert einen sichtbaren Beleg, das Lagebild beanstandet
das Fehlen nicht rueckwirkend.**

Alternative: dieselbe Regel auf beiden Seiten. Wer die Pflicht einfuehrt, meint sie
auch fuer den Bestand.

Der Tradeoff ist der Umgang mit dem, was vor der Regel entstanden ist. Im Bestand
liegen abgeschlossene Changes, deren `fertig.md` nach der damals gueltigen Regel
korrekt zustande kam. Eine einheitliche Regel wuerde sie samt und sonders als
unbelegt ausweisen. Damit wird aus einem Hinweis, der etwas bedeutet, eine Liste, die
man wegklickt.

Deshalb gilt die Pflicht nur dort, wo ab jetzt geschrieben wird. Die beiden Regeln
liegen in `tools/pruefungen.mjs` nebeneinander, damit der Unterschied sichtbar bleibt
statt auseinanderzulaufen.

## Wo die Belege liegen

**Gewaehlt: im Change-Ordner, unter `belege/`.** Das Journal ist
`belege/belege.jsonl`, die Bilder liegen unter `belege/assets/`, die Graph-Artefakte
unter `belege/artefacts/`.

Alternative: ein zentraler Store ausserhalb des Repos, nach dem Vorbild von
`git-planner-go` mit `~/.claude/reports/` je Repo-Name.

Der Tradeoff ist Mitwandern gegen Groesse. Ein zentraler Store haelt das Repo klein
und ueberlebt das Loeschen eines Worktrees, aber der Beleg wandert dann nicht mit dem
Change: der PR zeigt ihn nicht, der Archivordner enthaelt ihn nicht, und wer das Repo
klont, sieht nichts. Genau dieses Mitwandern ist hier der Zweck — `openspec archive`
nimmt `gate1.md`, `gate2.md` und `fertig.md` mit, und der Beleg gehoert in dieselbe
Akte.

Der Preis ist Speicherplatz im Repo. Er wird durch die Groessengrenze je Beleg
begrenzt; ueberschreitet eine Datei sie, wird sie nicht kopiert, sondern als fehlend
vermerkt. Faellt das spaeter ins Gewicht, ist der Wechsel auf einen zentralen Store
ein eigener Change, weil das Modul den Vorgangsordner ohnehin als Parameter bekommt.

Warum die Graph-Artefakte getrennt von den Bildern liegen: eine spaetere Web-Ansicht
liefert `belege/assets/` als Bytes an den Browser aus. Was dort nicht hineingehoert,
liegt von vornherein woanders, damit die Trennung nicht von einer Filterregel abhaengt,
die jemand aendern kann.

## Keine Abhaengigkeit

Die Pruefung auf ein Bildformat vergleicht die ersten Bytes der Datei mit den
bekannten Signaturen von PNG, JPEG, GIF und WebP. Das sind wenige Zeilen und braucht
keine Bibliothek. Eine Bildbibliothek wuerde mehr pruefen als noetig: die Frage lautet
nicht, ob die Datei vollstaendig dekodierbar ist, sondern ob jemand statt eines Bildes
einen Textblock eingeliefert hat.
