# Oberstufen-Planer

Ein selbst gehosteter Abitur-Planer für **Baden-Württemberg**, für eine einzelne Person, als Docker-Container.

- **Noten:** pro Fach genau die Teile, die es dort gibt – Klausuren (LF 2, BF 1 pro Halbjahr), Tests, GFS, mündlich, praktisch – mit eigener Gewichtung, z. B. 2/3 : 1/3 oder 50 : 30 : 20
- **Abiturnote:** Block I und Block II nach dem Leitfaden des Kultusministeriums, Prüfung aller Zulassungsbedingungen; offene Halbjahre werden aus deinen bisherigen Noten geschätzt
- **Anrechnung:** wählt automatisch die besten 40 Kurse und die beiden doppelt gewichteten Leistungsfächer
- **Ziel:** „Was brauche ich für eine 1,5?“ – Durchschnitt, den du ab jetzt in Kursen und Prüfungen brauchst
- **Fächer:** alle Einstellungen in einer Tabelle, als Datei mit Mitschülern teilbar
- **Kalender:** Liste und Monatsansicht, Import des Schulkalenders (.ics), Kalender-Abo für Google/Apple/Outlook
- **Android-App:** funktioniert eigenständig ohne Server; Sync mit dem eigenen Server ist optional
- **Darstellung:** dunkel (Standard) oder hell, fünf Akzentfarben, zwei App-Icons
- **Daten:** Sicherung als JSON-Datei, druckbare Zusammenfassung (PDF), keine Telemetrie

Der ursprüngliche Plan steht in [docs/PLAN.md](docs/PLAN.md).

> Planungshilfe – verbindlich ist die Berechnung der Schule.

## Installation

Es muss nichts konfiguriert werden – das Passwort legst du beim ersten Aufruf im Browser fest.

**TrueNAS SCALE:** siehe [docs/TRUENAS.md](docs/TRUENAS.md) (YAML einfügen, fertig).

**Docker:**

```bash
docker run -d --name oberstufen-planer -p 3000:3000 -v oberstufen-planer:/data --restart unless-stopped ghcr.io/rp998c/oberstufen-planer:latest
```

Die erste Zahl bei `-p 3000:3000` ist der Port auf deinem Server – für Port 8080 also `-p 8080:3000`.

Oder mit Docker Compose (die [compose.yaml](compose.yaml) aus diesem Repo, Port unter `published:` wählbar):

```bash
docker compose up -d
```

Dann `http://<server>:3000` öffnen und ein Passwort festlegen. Die Daten liegen im Volume unter `/data`
(eine SQLite-Datei).

**Passwort vergessen?**

```bash
docker exec -it oberstufen-planer reset-password
```

### Optionale Einstellungen

Alles funktioniert ohne diese Variablen.

| Variable            | Standard        | Bedeutung                                                                                          |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `PUID` / `PGID`     | `1000`          | Besitzer des Datenordners, z. B. `568` für TrueNAS-Datasets. Die Rechte setzt die App selbst.      |
| `AUTH`              | `password`      | `none` schaltet die Anmeldung ab, z. B. hinter einem eigenen Auth-Proxy.                           |
| `APP_PASSWORD_HASH` | –               | Festes Passwort (Argon2-Hash, erzeugen mit `hash-password` im Container) statt Passwort in der App |
| `ORIGIN`            | automatisch     | Öffentliche Adresse; nur nötig, wenn ein Reverse-Proxy keine `X-Forwarded-*`-Header setzt.         |
| `SESSION_DAYS`      | `90`            | Wie lange eine Anmeldung gültig bleibt (verlängert sich bei Nutzung)                               |
| `PORT`              | `3000`          | Port im Container                                                                                  |
| `TZ`                | `Europe/Berlin` | Zeitzone für Termine und Erinnerungen                                                              |

Für den Zugriff von außen gehört ein Reverse-Proxy mit HTTPS davor (z. B. Caddy).

Beispiel für Caddy (`Caddyfile`):

```
abi.example.org {
	reverse_proxy oberstufen-planer:3000
}
```

### Erste Schritte

1. Passwort festlegen, Abiturjahrgang wählen, dann Leistungsfächer, Basisfächer und mündliche Prüfungsfächer – die Einrichtung prüft dabei die Regeln.
2. Noten eintragen: auf der Übersicht **Note eintragen** (Taste <kbd>N</kbd>) oder ein Fach öffnen und auf die offene Klausur tippen.
3. Weicht die Gewichtung in einem Fach ab, direkt auf der Fachseite oder unter **Fächer** ändern.
4. Sobald es Zeugnisse gibt, die Zeugnisnote auf der Fachseite eintragen – dann zählt nur noch sie.

### Android-App

Die App braucht keinen Server: alle Daten bleiben auf dem Handy, Erinnerungen an Klausuren zeigt das
Handy selbst an.

1. Auf dem Handy die aktuelle APK laden:
   [oberstufen-planer.apk](https://github.com/rp998c/oberstufen-planer/releases/download/android-latest/oberstufen-planer.apk)
2. Öffnen und installieren (Android fragt einmalig, ob der Browser Apps installieren darf).
3. **Los geht's** – oder **Mit eigenem Server verbinden**, um Handy und Browser auf demselben Stand zu halten.

Sync lässt sich jederzeit unter **Einstellungen → Sync** einschalten (Adresse wie im Browser, z. B.
`192.168.1.10:3000`, und dein Passwort) und wieder trennen – die Daten bleiben auf dem Handy. Haben
Handy und Server beim Verbinden schon Daten, fragt die App, welche gelten sollen. Angemeldete Handys
stehen im Browser unter **Einstellungen → Geräte & Sync**.

### Kalender-Abo

Unter **Einstellungen → Kalender** steht eine geheime Adresse (`…/kalender/feed/<token>.ics`), die du im Kalender deines Handys abonnieren kannst. Sie funktioniert ohne Anmeldung – also nicht weitergeben. Bei Bedarf lässt sich eine neue Adresse erzeugen.

### Backup

Unter **Einstellungen → Daten** lässt sich eine Sicherung als JSON-Datei herunterladen und wieder einspielen. Alternativ die SQLite-Datei sichern:

```bash
docker compose exec oberstufen-planer sh -c 'cp /data/app.db /data/backup.db'
```

```bash
docker compose cp oberstufen-planer:/data/backup.db ./backup.db
```

## Entwicklung

Voraussetzungen: Node.js 22 und pnpm (`corepack enable`).

```bash
pnpm install
```

```bash
pnpm dev
```

Beim ersten Aufruf fragt die App nach einem Passwort (gespeichert in `apps/web/data/app.db`).

| Befehl                          | Zweck                                   |
| ------------------------------- | --------------------------------------- |
| `pnpm test`                     | Tests (Vitest)                          |
| `pnpm check`                    | Typprüfung (TypeScript, svelte-check)   |
| `pnpm lint`                     | Formatierung prüfen (Prettier)          |
| `pnpm build`                    | Produktions-Build                       |
| `pnpm --filter web db:generate` | Migration nach Schema-Änderung erzeugen |

### Aufbau

```
packages/ui              Die Oberfläche (Svelte) – dieselbe im Browser und in der Android-App
packages/app-core        Datenmodell, Änderungen, Berechnungen, Kalender-Import/-Export
packages/abi-engine-bw   Abitur-Berechnung für Baden-Württemberg (reines TypeScript)
apps/web                 Server (SvelteKit): Anmeldung, Speicherung und Sync, Kalender-Abo
apps/mobile              Android-App (Capacitor) mit Speicherung auf dem Handy
docs/PLAN.md             Plan und Meilensteine
```
