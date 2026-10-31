# Self-hosted Abitur planner (Docker) – plan

Working name: **Oberstufen-Planer** (own name and branding, so it doesn't copy "AbiPlaner").
Scope: **one user, Baden-Württemberg only** (allgemein bildendes Gymnasium, current AGVO).

## 1. What the reference app does

abi-planer.com (developer Daniel Jost) is a **Flutter** app for iOS, Android and the web
(abi-planer.web.app). It uses **Firebase** (Auth with e-mail/Google/Apple, Firestore for cloud backup)
and Sentry. It has a free tier and a paid **AbiPlanerPro** upgrade.
Sources: the website, the Play Store text, the web version's login screen, and the UI strings in the
public web bundle (`main.dart.js`). I did not create an account.

| Area | What it does (UI terms from the app) | In our version |
|---|---|---|
| Onboarding | Choose Bundesland, "Profil erstellen" | BW is fixed; one profile |
| Subjects | Leistungskurs/Grundkurs, "Belegte Halbjahre", seminars | ✅ Leistungsfach/Basisfach, Seminarkurs |
| Grades | "Leistungstypen", "Gewichtung" per half-year, "Kursnote manuell eintragen", "Offene Noten" | ✅ |
| Abitur | Block I / Block II, Abiturschnitt, how the total points break down | ✅ |
| Forecast | "Hochrechnung", "Kurs-Prognosen", "Bei Erhalt der Note…" (what if) | ✅ |
| Dashboard | Average, forecast, next exam, charts | ✅ |
| Calendar | Exams, reminders, iCal import | ✅ |
| Timetable | "Stundenplan" | ✅ |
| Tasks & goals | "Aufgaben", "Lernziele" | ✅ |
| Course groups (Pro) | Share dates with friends | ❌ dropped (pointless for one user) |
| Sync | Firebase cloud backup | ✅ your own server *is* the cloud |
| 16 Bundesländer | | ❌ BW only (engine built so more can be added later) |

## 2. Product

- **Web app / PWA** in place of native apps: it can be installed on a phone's home screen and works
  offline (read-only offline view at first, editing offline later).
- **One Docker container** with one volume; no external services and no telemetry.
- **Single user:** no registration or user table. Access is protected by
  - `AUTH=password`: one password from `APP_PASSWORD_HASH` (Argon2) gives a long-lived session cookie, **or**
  - `AUTH=none`: for running behind your own auth proxy (Authelia, Tailscale, LAN only).
- German UI only.

### Features (v1)
1. **Setup:** Abitur year, the 3 Leistungsfächer, the Basisfächer, the 2 oral exam subjects, Seminarkurs/besondere Lernleistung (optional).
2. **Grades:** grade types with weighting (Klausur, GFS, mündlich …), weighting per half-year;
   the half-year grade is calculated or entered by hand; "Offene Noten" are placeholders for grades still to come.
3. **BW engine:** Block I, Block II, total points, Abitur grade, admission checks (see §5).
4. **Course selection:** finds the best allowed 40 courses **and** the best choice of which 2 Leistungsfächer to
   double, automatically, with a manual override (in BW you make this decision after Q4).
5. **What-if/forecast:** click any grade or weighting to change it and see the effect on the half-year grade and the Abitur grade live.
6. **Target calculator:** "What points do I need in the written exams for a 1.x?"
7. **Dashboard:** average, forecast, next exam, trend per subject, warnings (8 Unterkurse, at most 3 of them in the Leistungsfächer, 0 points).
8. **Calendar:** Klausuren, GFS and Abitur dates; iCal import (the school calendar) and an iCal feed (subscribe on your phone).
9. **Reminders:** Web Push before exams (optionally via [ntfy](https://ntfy.sh) as a simpler alternative).
10. **Timetable**, **tasks**, **study goals** (each linked to a subject).
11. **Backup:** JSON export/import, PDF summary.

## 3. Architecture

```
┌──────────────── Docker container (node:22-alpine) ────────────────┐
│  SvelteKit app (adapter-node)                                      │
│   ├─ UI (Svelte 5, Tailwind, PWA service worker)                   │
│   ├─ /api/*  (data, iCal feed, export, push)                       │
│   ├─ scheduler (node-cron) for reminders                           │
│   └─ packages/abi-engine-bw (pure TS, used in browser + server)    │
│  SQLite via Drizzle ORM  →  /data/app.db                           │
└────────────────────────────────────────────────────────────────────┘
        optional: Caddy/Traefik for HTTPS (needed for PWA + push)
```

- With a single user the **server is the single source of truth**; the PWA caches the last state for offline viewing.
  There's no sync logic and no conflicts to resolve.
- **The engine is pure TypeScript with no dependencies**, so the forecast runs instantly in the browser and is easy to test.

### Repo layout
```
/apps/web               SvelteKit app
/packages/abi-engine-bw calculation + optimiser + rule checks
/docker                 Dockerfile, compose.yaml
```

## 4. Data model

```
Settings(abi_year, auth, push_enabled, reminder_defaults)
Subject(id, name, kind[LF|BF], exam[written|oral|none], is_seminar, color,
        category[deutsch|mathe|fremdsprache|naturwiss|geschichte|geo|gk|kunst_musik|other],
        fs_from_class8:bool)
GradeType(id, name, default_weight)                      -- Klausur, GFS, mündlich …
Grade(id, subject_id, half_year[1..4], grade_type_id, points 0-15, weight, date, is_planned, note)
HalfYearResult(subject_id, half_year, points, is_manual)  -- calculated or entered by hand
CourseSelection(subject_id, half_year, counted:bool, locked:bool)   -- manual override
DoubledLF(subject_id) ×2                                  -- manual override, otherwise optimiser
ExamResult(subject_id, written?, oral?)                   -- written subjects: optional oral
BesondereLernleistung(points?, mode[blockI|replace_oral|none])
Event(id, subject_id?, title, start, end?, kind[klausur|gfs|abi|other], reminders[])
TimetableSlot(weekday, period, subject_id, room)
Task(id, subject_id?, title, due, done)
StudyGoal(id, subject_id?, title, target_points?, due, achieved)
PushSubscription(endpoint, keys)
```

## 5. BW calculation engine

Source: KM BW, *Leitfaden für die gymnasiale Oberstufe, Abitur 2028* (based on the AGVO).
Every rule below links to its page in the guide in code comments and tests.

**Block I (max 600, min 200)**
- **Exactly 40 courses** from the 4 half-years of the two Jahrgangsstufen.
- Mandatory:
  - all **12 courses in the Leistungsfächer**; two of the three Leistungsfächer (**your choice**) count double
  - unless already covered as a Leistungsfach: 4× Deutsch, 4× Mathematik, 4× Geschichte, ≥4× one foreign language (taught from at least Klasse 8), ≥4× one natural science
  - **either** 2 foreign languages **or** 2 natural sciences (or one natural science + Informatik/NwT), with 4 courses each
  - the compulsory courses in Geographie and Gemeinschaftskunde; 2 courses in Bildende Kunst or Musik
  - the courses in the oral exam subjects
- Besondere Lernleistung / Seminarkurs: can count in Block I double (max 30 points), using up 2 course slots.
- `E_I = round(P × 40 / 48)`, where P is the sum of all counted courses with the doubled ones counted twice (40 + 8 = 48 units).
- At most **8 courses below 5 points**, of which at most **3 in the Leistungsfächer**; **no compulsory course with 0 points**.

**Block II (max 300, min 100)**
- 3 written exams (the Leistungsfächer) + 2 oral exams (Basisfächer).
- Written or oral only: points ×4.
- Written + oral (additional or voluntary): `PF = (2s + m)/3`, then `round_half_up(PF × 4)`.
- The besondere Lernleistung can replace the 5th exam subject (×4 in Block II).
- At least **100 points**; in **3 of 5 exam subjects, 2 of them Leistungsfächer, ≥20 points** (×4);
  in each exam subject ≥4 points (×4), so 0 points written needs ≥3 in an oral exam, and 0 points oral needs an additional exam with ≥2.
- Points from Block I and Block II can't make up for each other.

**Grade:** the official lookup table (900–823 → 1.0 … 300 → 4.0), which matches `17/3 − E/180` truncated to one decimal place.
The engine uses the **table** and unit tests compare it against the formula.

**Optimiser:** the mandatory courses are fixed, so what's left is "which LF to double" (3 options) × "fill the remaining slots".
For each of the 3 doubling options: take the mandatory courses, then pick the best remaining courses greedily
while respecting the Unterkurs limits, then improve by swapping. That's under 10 ms. Missing grades are filled from the
forecast (the subject's average so far, or the user's slider value).

**Tests (Vitest):** example calculations from the guide; edge cases (exactly 8 Unterkurse, 4 of them in the LF, 0-point course,
rounding at x.5 in Block II, 822 vs. 823 points); property tests for the optimiser (never worse than any valid manual selection).

## 6. Docker

**Dockerfile** (multi-stage):
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -r build && pnpm --filter web deploy --prod /out

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out .
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
USER node
HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "build"]
```
Database migrations run automatically on startup.

**compose.yaml**
```yaml
services:
  abi:
    image: ghcr.io/<you>/oberstufen-planer:latest
    ports: ["3000:3000"]
    volumes: ["./data:/data"]
    environment:
      AUTH: password                 # password | none
      APP_PASSWORD_HASH: "$argon2id$..."   # generate: docker run --rm <image> hash-password
      ORIGIN: https://abi.example.org
      VAPID_PUBLIC_KEY: ...          # generated automatically on first start if missing
      VAPID_PRIVATE_KEY: ...
      TZ: Europe/Berlin
    restart: unless-stopped
```
- Image is about 200–280 MB (mostly the Node base image; the app itself is under 40 MB), built for amd64 and arm64 (Raspberry Pi / Synology).
- Backups are a copy of `./data/app.db` or the JSON export.
- HTTPS through a reverse proxy (Caddy example in the docs), which a PWA and Web Push need.

## 7. Milestones

| # | Content | Estimate |
|---|---|---|
| M0 ✅ | Repo, CI (lint, test, image build to GHCR), Docker skeleton, password login, healthcheck | 1–2 days |
| M1 | `abi-engine-bw`: Block I/II, rule checks, grade table, optimiser + tests | 4–5 days |
| M2 | UI: setup, subjects, grade types, grade entry, half-year grades | 1 week |
| M3 | Dashboard, what-if/forecast, target calculator, course-selection view | 1 week |
| M4 | Calendar + iCal import/feed, reminders (Web Push/ntfy), PWA/offline | 4–5 days |
| M5 | Timetable, tasks, study goals, JSON/PDF export → **v1.0** | 4–5 days |

About **5 weeks** in total.

## 8. Risks and open questions
- Rules can change by Abitur year. The engine gets a `ruleset: "bw-agvo-2028"` version so newer guides can be added without breaking old data.
- **Berufliche Gymnasien** (BGVO, at least 36 courses, at most 20 % Unterkurse, Profilfach doubled) and **Gemeinschaftsschulen** with their special rules are out of scope for v1.
- Show a disclaimer in the UI: "Planning aid – the school's calculation is binding."
