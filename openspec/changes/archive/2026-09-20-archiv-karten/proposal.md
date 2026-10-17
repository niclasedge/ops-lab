# archiv-karten

## Warum

Die Web-Ansicht führt seit `belege-sichtbar` eine Sektion mit allen Belegen, auch denen
archivierter Changes. Was sie nicht führt, ist der Change dazu. Wer ein Bild aus dem
Archiv sieht, liest darunter eine Kennung und sonst nichts: keine Aufgabe, kein
Aufgabenstand, keine Spur davon, was in diesem Lauf abgehakt wurde. Die Zuordnung ist
eine Zeile Text, kein Zusammenhang.

Sieben von acht Changes im Repo sind archiviert. Die Ansicht zeigt von ihnen nur eine
Zahl je Arbeitsbaum — `7 archiviert` — und im Übrigen deren Belege ohne Kontext. Der
abgeschlossene Lauf ist der belegte Lauf; gerade er gehört sichtbar gemacht.

Das Gerüst liegt bereits: `build_change` nimmt seit jeher ein `archived` entgegen und
überspringt dafür die teure Historienabfrage. Aufgerufen wird es nie mit `True`.

## Was ändert sich

Die Web-Erhebung baut archivierte Changes ebenfalls zu Change-Objekten und führt sie in
der Nutzlast als eigene Liste `archiv` — getrennt von den laufenden Changes. Jeder
Eintrag nennt seine Kennung, sein Archivdatum, seinen Aufgabenstand samt einzelner
Aufgaben und seine Belege. Die Seite zeigt je archiviertem Change eine Karte, und die
Belege stehen darin als Bild, nicht als Liste von Adressen.

Jeder archivierte Change steht einmal, auch wenn mehrere Arbeitsbäume dieselbe Historie
und damit dasselbe Archiv tragen.

## Was ausdrücklich nicht

Archivierte Changes kommen **nicht** in die Liste `changes`. Sie haben keinen
Arbeitsraum, keine Zuweisung, keine Abweichung und keinen nächsten Schritt — jede Regel,
die auf einem laufenden Change aufsetzt, bräuchte einen Sonderfall. Kennzahlen,
Bereitschaft, Zeitleiste und *Nächste freie Changes* bleiben deshalb unberührt, ebenso
das Lagebild im Terminal. Es wird keine Belegdatei erzeugt und keine bestehende
verschoben; die flache Sektion *Belegt* bleibt, wie sie ist.

## Berührte Dateien

- `ops.py`
- `tests/lagebild-archiv.test.mjs` (neu)
- `openspec/changes/archiv-karten/` (Artefakte und Nachweise dieses Changes)
