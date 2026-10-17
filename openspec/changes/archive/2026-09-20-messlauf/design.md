# Entscheidungen — messlauf

## Woraus der Aufwand eines Laufs wirklich besteht

Diese Rechnung steht hier, weil sie bestimmt, was zu messen sich lohnt. Gemessen an
einer Sitzung dieses Repos: 51 Nachrichten, 102 Token Eingabe, 95.000 Token Ausgabe,
3.500.000 Token aus dem Cache gelesen. Der Cache-Anteil betraegt 96 Prozent.

Er entsteht, weil bei jeder Antwort des Modells der gesamte bisherige Verlauf erneut
abgerechnet wird. Der Aufwand eines Laufs ist damit nicht die Summe seiner Schritte,
sondern die Summe der Kontexte, die diese Schritte gesehen haben:

    Aufwand  =  Summe ueber alle Runden i von  (Startkontext + Ausgaben bis i)
             ~  Rundenzahl mal Startkontext  +  Rundenzahl zum Quadrat halbe mal
                mittlerer Ausgabengroesse

Daraus folgen drei Hebel, nach Wirkung geordnet. Erstens die Rundenzahl: sie geht
quadratisch ein, weil jede zusaetzliche Runde alle vorherigen Ausgaben noch einmal
bezahlt. Zweitens der Startkontext: er geht linear mit der Rundenzahl ein; bei
geschaetzten 40.000 Token Startkontext und 51 Runden sind das zwei Millionen Token,
bevor irgendetwas getan wurde. Drittens die Groesse der einzelnen Werkzeugausgabe:
eine Ausgabe in Runde zehn von fuenfzig wird vierzig weitere Male bezahlt.

Der praktische Schluss: eine Optimierung, die einen Befehl einspart, wirkt stark; eine
Optimierung, die einen Befehl schneller macht, wirkt gar nicht. Darum misst dieser
Rahmen die Zahl der Befehle gleichberechtigt neben den Token — sie ist die Groesse,
an der sich eine Vereinfachung zuerst zeigt.

Die Gegenprobe gehoert dazu: ist die Rechnung falsch, muessten Token und Befehlszahl
zwischen zwei Fassungen auseinanderlaufen. Genau das wird die erste Messreihe zeigen.

## Warum ein eigenes Werkzeug neben tokens.mjs

**Gewaehlt: `messung.mjs` neben `tokens.mjs`, beide bleiben.**

Alternative: `tokens.mjs` erweitern, bis es beides kann.

Die beiden beantworten verschiedene Fragen. `tokens.mjs` zeigt die letzten Sitzungen
eines Projekts als Uebersicht — eine Sitzung ist dort die Einheit. Ein Messlauf ist
aber weder eine Sitzung noch ein Teil davon zuverlaessig: er hat einen definierten
Anfang, ein Zielrepo, einen Auftragstext und ein Ergebnis, das zu ihm gehoert. Eine
Sitzung kann zwei Laeufe enthalten oder keinen.

Der Tradeoff ist Doppelung gegen Vermischung. Beide lesen dieselben Mitschriften und
summieren aehnlich; das ist die Doppelung. Wuerde `tokens.mjs` beides leisten, haetten
seine Ausgaben zwei Bedeutungen, und die Uebersicht ueber Sitzungen — die heute
funktioniert und gebraucht wird — traegt dann die Last einer Messlogik, die sie nicht
braucht. Der geteilte Kern bleibt klein genug, dass Doppelung hier billiger ist.

## Wer den Lauf startet

**Gewaehlt: ein Mensch ruft `just test-claude` auf, der Lauf laeuft im Vordergrund.**

Alternative: das Repo startet den Lauf selbst, etwa zeitgesteuert oder in einer
Schleife, bis eine Zielgroesse erreicht ist.

Der Tradeoff ist Bequemlichkeit gegen Aufsicht. Ein Messlauf setzt ein Repo zurueck,
laesst einen Agenten darin arbeiten und mergt am Ende einen Pull Request. Das sind
drei Handlungen, die schwer rueckgaengig zu machen sind. Ein Lauf, den niemand
angestossen hat, fuehrt sie unbeaufsichtigt aus, und die Messreihe, die dabei
entsteht, waere billiger zu haben als das Vertrauen, das sie kostet.

Der Preis ist, dass eine Messreihe ueber mehrere Laeufe Handarbeit bleibt. Das ist
hinnehmbar: eine Reihe umfasst wenige Laeufe, nicht hunderte.

## Der Erfuellungsgrad ist eine Liste, keine Zahl

**Gewaehlt: sieben Kriterien, jedes einzeln als erfuellt oder nicht ausgewiesen.**

Alternative: eine Punktzahl oder ein Prozentwert.

Der Tradeoff ist Vergleichbarkeit gegen Aussagekraft. Eine Zahl laesst sich in einer
Spalte fuehren und ueber Laeufe mitteln; eine Liste nicht. Aber eine Zahl verdeckt,
welches Kriterium gefallen ist, und die Kriterien sind nicht gleich viel wert: ein
fehlender Beleg und ein nicht gemergter Pull Request sind verschiedene Zustaende, die
derselbe Bruchteil beschreibt.

Der Ausschlag kommt aus dem Zweck. Die Messreihe soll zeigen, wo ein Lauf unvollstaendig
bleibt, damit sich das abstellen laesst. Eine Zahl, die von sechs Siebteln auf fuenf
Siebtel faellt, sagt nicht, was zu tun ist. Die Liste wird zusaetzlich als Bruch
ausgewiesen, damit eine Spalte moeglich bleibt — aber der Bruch ist die Zusammenfassung,
nicht der Messwert.

## Die Preistabelle wird von Hand gepflegt

**Gewaehlt: `tools/preise.json`, eine Datei im Repo, mit Datum je Eintrag.**

Alternative: die Preise zur Laufzeit abfragen.

Der Tradeoff ist Aktualitaet gegen Reproduzierbarkeit. Eine Abfrage liefert immer den
heutigen Preis; damit aendert sich aber die Kostenangabe einer Messung von gestern,
sobald sich ein Preis aendert, und zwei Messungen werden unvergleichbar, ohne dass sich
am Lauf etwas geaendert haette. Eine Messung ist ein Beleg ueber einen Zeitpunkt — sie
haelt den Preis fest, der zu ihr gehoerte. Das ist dieselbe Begruendung, aus der
`beleg-bild` das Urteil beim Schreiben faellt und nicht beim Lesen.

Der Preis ist, dass die Tabelle veraltet, wenn niemand sie pflegt. Deshalb traegt jeder
Eintrag ein Datum, und ein Modell ohne Eintrag fuehrt zu der Angabe "unbekannt" statt
zu null — ein fehlender Preis faellt damit auf, statt still zu verschwinden.

## Warum die Wahl zwischen Werkzeugarten hier nicht vorweggenommen wird

Aus der Rechnung am Anfang laesst sich die Rangfolge der Werkzeugarten bereits
ableiten. Ein Werkzeug ueber ein Protokoll haelt seine Beschreibung im Startkontext,
zahlt sie also in jeder Runde; ein Kommandozeilenbefehl kostet dort nichts und nur
beim Aufruf. Das ist ein Unterschied in der Groessenordnung von einigen zehntausend
Token je Lauf.

Trotzdem wird dieser Change die Frage nicht entscheiden, sondern messbar machen. Die
abgeleitete Rangfolge betrifft den Startkontext — also den zweiten Hebel. Der erste,
die Rundenzahl, haengt nicht an der Werkzeugart, sondern daran, wie viele Schritte ein
Aufruf buendelt. Ein Protokoll-Werkzeug, das drei Schritte in einem erledigt, schlaegt
einen Kommandozeilenbefehl, der dreimal gerufen wird, obwohl es im Startkontext teurer
ist. Welche Wirkung ueberwiegt, ist eine Frage an die Messung und nicht an die Ableitung.

## Der Messaufbau, Punkt fuer Punkt

Diese sieben Punkte waren offen und sind entschieden. Sie stehen hier und nicht im
Vorschlag, weil sie den Rahmen nicht aendern, wohl aber die Aussagekraft der Zahlen.

### 1 · Wer den Lauf ausloest und wer die Zahlen liest

**Gewaehlt: der Mensch fuehrt `just test-claude` aus, das Werkzeug liest hinterher die
Mitschrift.** Der Lauf selbst bleibt damit in menschlicher Hand -- er setzt ein Repo
zurueck, laesst einen Agenten darin arbeiten und mergt am Ende. Das Werkzeug fasst
diese Kette nicht selbst an, es wertet aus.

Vorgesehen ist ein zweites Ziel `test-pi` mit demselben Rahmen. Damit werden zwei
Agenten-Werkzeuge an derselben Aufgabe vergleichbar -- in Aufwand, Erfuellungsgrad und
Kosten. Das ist der Grund, warum der Adapter oben so schmal geschnitten ist: starten
und Mitschrift finden, mehr unterscheidet die beiden nicht.

### 2 · Das Messstueck

**Gewaehlt: die Amortisationsdauer.** Ein Modul `src/amortisation.mjs`, eine Testdatei
`tests/amortisation.test.mjs`. Aus Finanzvolumen und Einsparpotenzial je Jahr die
Dauer in Monaten.

Der Zuschnitt entspricht dem von `einsparpotenzial`, das im ersten Durchlauf schon
gebaut wurde -- damit sind die Zahlen an diesen Durchlauf anschlussfaehig. Es liest
`einsparpotenzial`, baut es aber nicht um. Als Beleg eignet sich ein Rechenbeispiel
als Tabelle oder Diagramm.

### 3 · Der Merge am Ende der Kette

**Gewaehlt: `--admin`.** Die Umgebung lehnt `gh pr merge` ohne Review ab; im Testrepo
bestehen Admin-Rechte. Ein Ziel `merge` setzt `gh pr merge --squash --delete-branch
--admin` ab.

Der Tradeoff ist Vollstaendigkeit gegen Strenge. So wird die Kette bis zum Ende
gemessen und `just archiv` ueberhaupt erst erprobt; dafuer wird die Review-Pflicht im
Testrepo umgangen. Vertretbar, weil dort kein Produktivcode liegt -- im Tooling-Repo
gilt sie weiter.

### 4 · Wie viele Laeufe je Fassung

**Gewaehlt: die erste Fassung dreimal, danach je einmal, nachgemessen nach Bedarf.**
Die drei Kalibrierungslaeufe liefern die Streuung als Zahl. Diese Streuung ist
anschliessend der Massstab: unterscheiden sich zwei Fassungen um weniger als sie, wird
nachgemessen, sonst nicht.

Der Tradeoff ist Kosten gegen Sicherheit. Drei Laeufe je Fassung waeren robuster,
kosten bei vier Fassungen aber zwoelf Laeufe zu je rund 3,5 Millionen Token. Die
Statistik wird hier einmal bezahlt statt in jeder Runde -- und sie wird nicht
weggelassen, sondern an die Stelle gesetzt, an der sie gebraucht wird.

### 5 · Der Lerneffekt im Werkzeug

**Gewaehlt: eine Wortsperre ueber den Diff, maschinell geprueft.** Zwischen zwei
Laeufen wird das Werkzeug verbessert. Faende dabei Wissen ueber das Messstueck den Weg
hinein -- etwa die Formel fuer die Amortisationsdauer in einer Vorlage --, dann misst
der naechste Lauf die vorweggenommene Loesung und nicht den besseren Ablauf.

Geprueft wird der Diff des Werkzeugs zwischen zwei Laeufen gegen eine Liste von
Fachbegriffen des Messstuecks. Eine allgemeine Testvorlage bleibt damit erlaubt, eine
mit der Rechnung darin faellt auf. Die Grenze liegt genau dort, wo der Unterschied
zwischen Optimierung und Vorwegnahme liegt.

Die Alternative waere ein Kontrolllauf gewesen: nach jeder Optimierung das Messstueck
noch einmal mit der alten Fassung, die Differenz als reiner Wiederholungseffekt. Das
waere methodisch sauberer und kostet einen zusaetzlichen Lauf je Runde -- zu teuer fuer
den Gewinn.

### 6 · Der Startkontext

**Gewaehlt: je Lauf messen und ausweisen, Abweichung ueber zehn Prozent macht
unvergleichbar.** Der Startkontext steht in der ersten Nachricht jeder Mitschrift und
ist damit kostenlos abzulesen.

Er wird zu rund 93 Prozent vom Harness bestimmt und nicht vom Ablauf dieses Repos --
das spraeche dafuer, ihn herauszurechnen. Genau dieser Anteil ist aber der
Unterschied zwischen zwei Agenten-Werkzeugen, und den soll die Messreihe ja zeigen.
Also wird er ausgewiesen statt bereinigt; der bereinigte Aufwand laesst sich daraus
jederzeit rechnen, umgekehrt nicht.

Die Zehn-Prozent-Schwelle arbeitet wie der Pruefwert des Auftragstextes: sie
verhindert keinen Lauf, sie kennzeichnet einen Vergleich als nicht belastbar.

### 7 · Wann "minimal effizient" erreicht ist

**Gewaehlt: die kalibrierte Streuung als Aufloesungsgrenze, dazu eine Obergrenze von
zwoelf Laeufen.** Abgebrochen wird, wenn zwei aufeinanderfolgende Fassungen sich in
Token *und* in der Befehlszahl um weniger als die Streuung unterscheiden -- dann misst
die Reihe nur noch Rauschen. Bedingung dabei: voller Erfuellungsgrad, sonst zaehlt die
Fassung nicht.

Die Obergrenze ist die Notbremse fuer den Fall, dass das Kriterium nie greift. Ohne sie
laeuft die Optimierung, bis jemand aufhoert -- und "jemand hoert auf" ist kein
Ergebnis, das sich berichten laesst.

Ein absolutes Ziel waere die Alternative gewesen, etwa die Halbierung des
Kalibrierungs-Medians. Es ist einfacher zu kommunizieren, aber die Zahl waere geraten:
vielleicht ist die Haelfte trivial, vielleicht unerreichbar.
