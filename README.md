# Oberstufen-Planer

Ein selbst gehosteter Abitur-Planer für **Baden-Württemberg**, für eine einzelne Person, als Docker-Container.

- **Noten:** Einzelnoten pro Halbjahr mit Notenarten und Gewichtung, angekündigte („offene“) Noten, Zeugnisnoten und eigene Prognosen
- **Abiturnote:** Block I und Block II nach dem Leitfaden des Kultusministeriums, Prüfung aller Zulassungsbedingungen, besondere Lernleistung
- **Anrechnung:** wählt automatisch die besten 40 Kurse und die beiden doppelt gewichteten Leistungsfächer – oder du legst es selbst fest
- **Hochrechnung:** „Was wäre wenn“ für jede Note und Prüfung, Zielrechner („Was brauche ich für eine 1,5?“)
- **Übersicht:** hochgerechnete Abiturnote, Verlauf pro Fach, Unterkurse, nächste Termine
- **Kalender:** Klausuren, GFS und Prüfungen, Import des Schulkalenders (.ics), Kalender-Abo fürs Handy, Erinnerungen per Push oder [ntfy](https://ntfy.sh)
- **Stundenplan, Aufgaben, Lernziele**
- **Daten:** Sicherung als JSON-Datei, druckbare Zusammenfassung (PDF)
- Als App aufs Handy installierbar, offline lesbar, keine Telemetrie

Der ursprüngliche Plan steht in [docs/PLAN.md](docs/PLAN.md).

> Planungshilfe – verbindlich ist die Berechnung der Schule.

## Installation

Es muss nichts konfiguriert werden – das Passwort legst du beim ersten Aufruf im Browser fest.

**TrueNAS SCALE:** siehe [docs/TRUENAS.md](docs/TRUENAS.md) (YAML einfügen, fertig).

**Docker:**

```bash
docker run -d --name oberstufen-planer -p 3000:3000 -v oberstufen-planer:/data --restart unless-stopped ghcr.io/rp998c/oberstufen-planer:latest
```

oder mit Docker Compose (die [compose.yaml](compose.yaml) aus diesem Repo):

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

Für den Zugriff von außen gehört ein Reverse-Proxy mit HTTPS davor (z. B. Caddy). Ohne HTTPS funktionieren die Installation als App und Push-Erinnerungen nicht (Ausnahme: `localhost`).

Beispiel für Caddy (`Caddyfile`):

```
abi.example.org {
	reverse_proxy oberstufen-planer:3000
}
```

### Erste Schritte

1. Passwort festlegen und unter **Einrichtung** Fächer, Leistungsfächer und mündliche Prüfungsfächer wählen.
2. Unter **Mehr → Einstellungen** die Notenarten und ihre Gewichtung anpassen (Standard: Klausur 2, Mündlich 1, GFS 1).
3. Unter **Noten** Einzelnoten oder direkt die Zeugnisnoten eintragen.
4. Optional: **Kalender** befüllen, Erinnerungen einrichten, App zum Home-Bildschirm hinzufügen.

### Erinnerungen

- **Push:** unter Einstellungen „Push auf diesem Gerät aktivieren“. Braucht HTTPS. Auf dem iPhone muss die App vorher zum Home-Bildschirm hinzugefügt werden.
- **ntfy:** Server und Thema eintragen und dasselbe Thema in der ntfy-App abonnieren. Auf `ntfy.sh` einen schwer zu erratenden Themennamen wählen.
- Der Server prüft jede Minute, ob Erinnerungen fällig sind.

### Kalender-Abo

Unter Einstellungen steht eine geheime Adresse (`…/kalender/feed/<token>.ics`), die du im Kalender deines Handys abonnieren kannst. Sie funktioniert ohne Anmeldung – also nicht weitergeben. Bei Bedarf lässt sich eine neue Adresse erzeugen.

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
apps/web                 SvelteKit-App (UI, API, SQLite über Drizzle)
packages/abi-engine-bw   Abitur-Berechnung für Baden-Württemberg (reines TypeScript)
docs/PLAN.md             Plan und Meilensteine
```
