import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Login sessions. `id` is the SHA-256 of the cookie token, so a leaked DB can't be used to log in. */
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
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
	sortOrder: integer('sort_order').notNull().default(0)
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

/** Kinds of grades with their weight for the half-year grade (Klausur, mündlich, GFS …). */
export const gradeTypes = sqliteTable('grade_types', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	weight: real('weight').notNull().default(1),
	sortOrder: integer('sort_order').notNull().default(0)
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
