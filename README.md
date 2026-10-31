# Oberstufen-Planer

Ein selbst gehosteter Abitur-Planer für **Baden-Württemberg**, für eine einzelne Person, als Docker-Container.

- Notenerfassung pro Halbjahr mit Leistungstypen und Gewichtung
- Berechnung von Block I und Block II, Gesamtpunktzahl und Abiturnote nach AGVO, Prüfung der Zulassungsbedingungen
- Automatische Wahl der anzurechnenden Kurse und der beiden doppelt gewichteten Leistungsfächer
- Hochrechnung, „Was wäre wenn“-Szenarien, Zielrechner
- Klausurenkalender mit iCal-Feed, Erinnerungen, Stundenplan, Aufgaben und Lernziele
- PWA: lässt sich auf dem Handy installieren, keine Telemetrie

**Status:** Meilenstein M0 (Grundgerüst: Login, Datenbank, Docker, CI). Der Plan steht in [docs/PLAN.md](docs/PLAN.md).

> Planungshilfe – verbindlich ist die Berechnung der Schule.

## Starten mit Docker

1. Passwort-Hash erzeugen (das Passwort wird verdeckt abgefragt):

   ```bash
   docker run --rm -it ghcr.io/rp998c/oberstufen-planer:latest hash-password
   ```

2. `.env.example` nach `.env` kopieren und den Hash eintragen – **in einfachen Anführungszeichen**, weil er `$` enthält:

   ```bash
   APP_PASSWORD_HASH='$argon2id$v=19$m=19456,t=2,p=1$…'
   ```

3. Starten:

   ```bash
   docker compose up -d
   ```

Die App läuft dann auf <http://localhost:3000>. Die Daten liegen im Docker-Volume `data` (eine SQLite-Datei, `/data/app.db`).

### Konfiguration

| Variable            | Standard        | Bedeutung                                                                                                 |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `AUTH`              | `password`      | `password`: Anmeldung mit einem Passwort. `none`: keine Anmeldung, z. B. hinter einem eigenen Auth-Proxy. |
| `APP_PASSWORD_HASH` | –               | Argon2-Hash des Passworts (Pflicht bei `AUTH=password`)                                                   |
| `ORIGIN`            | –               | Öffentliche Adresse, z. B. `https://abi.example.org`. Nötig, damit Formulare funktionieren.               |
| `SESSION_DAYS`      | `90`            | Wie lange eine Anmeldung gültig bleibt (verlängert sich bei Nutzung)                                      |
| `PORT`              | `3000`          | Port im Container                                                                                         |
| `TZ`                | `Europe/Berlin` | Zeitzone für Termine und Erinnerungen                                                                     |

Für den Zugriff von außen gehört ein Reverse-Proxy mit HTTPS davor (z. B. Caddy). Ohne HTTPS funktionieren später Installation als App und Push-Erinnerungen nicht.

### Backup

```bash
docker compose exec oberstufen-planer sh -c 'cp /data/app.db /data/backup.db'
docker compose cp oberstufen-planer:/data/backup.db ./backup.db
```

## Entwicklung

Voraussetzungen: Node.js 22 und pnpm (`corepack enable`).

```bash
pnpm install
echo -n 'mein-passwort' | pnpm --silent --filter web hash-password
```

```bash
APP_PASSWORD_HASH='…' pnpm dev
```

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
