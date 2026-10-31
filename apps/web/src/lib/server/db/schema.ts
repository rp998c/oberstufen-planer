import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Login sessions. `id` is the SHA-256 of the cookie token, so a leaked DB can't be used to log in. */
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
	/** 'browser' or 'app' (Android app with a bearer token). */
	kind: text('kind').notNull().default('browser'),
	/** Device name chosen in the app. */
	name: text('name'),
	lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' })
});

/** Key/value store for app settings (profile, besondere Lernleistung, overrides, …). */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull()
});

/** A school subject in the Kursstufe. */
export const subjects = sqliteTable('subjects', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** Engine category, see abi-engine-bw `Category`. */
	category: text('category').notNull(),
	/** 'LF' or 'BF'. */
	level: text('level').notNull(),
	/** 'written', 'oral' or null. */
	exam: text('exam'),
	fromClass8: integer('from_class8', { mode: 'boolean' }).notNull().default(true),
	color: text('color').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	/** Weighting of schriftlich/mündlich/praktisch for this subject; null = the default from the settings. */
	areaWeights: text('area_weights', { mode: 'json' }).$type<{
		schriftlich: number;
		muendlich: number;
		praktisch: number;
	} | null>()
});

/**
 * A half-year course. The row exists if the subject is taken in that half-year.
 * `points` = grade on the report card, `forecast` = own estimate (what-if).
 */
export const courses = sqliteTable(
	'courses',
	{
		subjectId: text('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'cascade' }),
		halfYear: integer('half_year').notNull(),
		points: integer('points'),
		forecast: integer('forecast')
	},
	(t) => [primaryKey({ columns: [t.subjectId, t.halfYear] })]
);

/** Kinds of grades (Klausur, Test, mündlich, GFS, praktisch …) and the area they count in. */
export const gradeTypes = sqliteTable('grade_types', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** No longer used (weighting is per subject and area since #11); kept for old databases. */
	weight: real('weight').notNull().default(1),
	sortOrder: integer('sort_order').notNull().default(0),
	/** 'schriftlich' | 'muendlich' | 'praktisch' */
	area: text('area').notNull().default('schriftlich'),
	/** Tests: all grades of this type together count like this many single grades; null = each counts. */
	groupAs: real('group_as')
});

/**
 * A single grade. `points` null = "offene Note": an announced grade that is still to come,
 * optionally with `forecast` points for the projection.
 */
export const grades = sqliteTable('grades', {
	id: text('id').primaryKey(),
	subjectId: text('subject_id')
		.notNull()
		.references(() => subjects.id, { onDelete: 'cascade' }),
	halfYear: integer('half_year').notNull(),
	gradeTypeId: text('grade_type_id')
		.notNull()
		.references(() => gradeTypes.id, { onDelete: 'restrict' }),
	points: integer('points'),
	forecast: integer('forecast'),
	weight: real('weight').notNull().default(1),
	/** ISO date (YYYY-MM-DD). */
	date: text('date'),
	note: text('note').notNull().default('')
});

/** Abitur exam results and forecasts per subject. */
export const exams = sqliteTable('exams', {
	subjectId: text('subject_id')
		.primaryKey()
		.references(() => subjects.id, { onDelete: 'cascade' }),
	written: integer('written'),
	oral: integer('oral'),
	writtenForecast: integer('written_forecast'),
	oralForecast: integer('oral_forecast')
});

/**
 * Calendar entry. `start`/`end` are local times: "YYYY-MM-DD" for all-day entries,
 * otherwise "YYYY-MM-DDTHH:mm". `reminders` = minutes before the start (all-day: 00:00).
 */
export const events = sqliteTable('events', {
	id: text('id').primaryKey(),
	subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
	title: text('title').notNull(),
	/** 'klausur' | 'gfs' | 'abi' | 'sonstiges' */
	kind: text('kind').notNull(),
	start: text('start').notNull(),
	end: text('end'),
	allDay: integer('all_day', { mode: 'boolean' }).notNull().default(true),
	note: text('note').notNull().default(''),
	reminders: text('reminders', { mode: 'json' }).$type<number[]>().notNull().default([]),
	/** UID of an imported iCal event, to update instead of duplicating on re-import. */
	externalUid: text('external_uid').unique()
});

/** Web Push subscriptions of the user's devices. */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
	endpoint: text('endpoint').primaryKey(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

/** Reminders already sent, so each one goes out only once. */
export const sentReminders = sqliteTable(
	'sent_reminders',
	{
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		minutes: integer('minutes').notNull(),
		sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [primaryKey({ columns: [t.eventId, t.minutes] })]
);

/** One lesson in the weekly timetable. */
export const timetableSlots = sqliteTable(
	'timetable_slots',
	{
		id: text('id').primaryKey(),
		/** 1 = Monday … 6 = Saturday */
		weekday: integer('weekday').notNull(),
		/** Lesson number, 1-based */
		period: integer('period').notNull(),
		subjectId: text('subject_id')
			.notNull()
			.references(() => subjects.id, { onDelete: 'cascade' }),
		room: text('room').notNull().default('')
	},
	(t) => [uniqueIndex('timetable_slot_unique').on(t.weekday, t.period)]
);

/** To-dos ("Aufgaben"), optionally linked to a subject. */
export const tasks = sqliteTable('tasks', {
	id: text('id').primaryKey(),
	subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
	title: text('title').notNull(),
	/** ISO date */
	due: text('due'),
	done: integer('done', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

/** Study goals ("Lernziele"), e.g. "Mathe: 12 Punkte im 3. Halbjahr". */
export const studyGoals = sqliteTable('study_goals', {
	id: text('id').primaryKey(),
	subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
	title: text('title').notNull(),
	targetPoints: integer('target_points'),
	/** ISO date */
	due: text('due'),
	achieved: integer('achieved', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

/**
 * Single row with a counter that SQLite triggers increase on every change of user data
 * (see migration 0005). The app only downloads data when the revision changed.
 */
export const syncMeta = sqliteTable('sync_meta', {
	id: integer('id').primaryKey(),
	revision: integer('revision').notNull().default(0)
});

/** Operations from the app that were already applied (each one only once). */
export const appliedOps = sqliteTable('applied_ops', {
	opId: text('op_id').primaryKey(),
	appliedAt: integer('applied_at', { mode: 'timestamp_ms' }).notNull()
});
