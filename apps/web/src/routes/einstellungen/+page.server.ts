import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { REMINDER_PRESETS } from '$lib/calendar.ts';
import { BackupError, importData } from '$lib/server/backup.ts';
import {
	MIN_PASSWORD_LENGTH,
	SESSION_COOKIE,
	changePassword,
	deleteOtherSessions,
	deleteSessionById,
	listAppSessions,
	getPasswordHash,
	verifyPassword
} from '$lib/server/auth.ts';
import { getConfig } from '$lib/server/config.ts';
import { getProfile, listGradeTypes, setSetting } from '$lib/server/data.ts';
import { gradeTypes, grades, pushSubscriptions } from '$lib/server/db/schema.ts';
import { getDefaultReminders, getFeedToken } from '$lib/server/events.ts';
import { FormError, intOrNull, num, str } from '$lib/server/form.ts';
import { getDb } from '$lib/server/instance.ts';
import { getNtfy, notify } from '$lib/server/notify.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const used = new Set(
		db
			.select({ id: grades.gradeTypeId })
			.from(grades)
			.all()
			.map((r) => r.id)
	);
	return {
		profile: getProfile(db),
		gradeTypes: listGradeTypes(db).map((t) => ({ ...t, used: used.has(t.id) })),
		feedUrl: `${url.origin}/kalender/feed/${getFeedToken(db)}.ics`,
		ntfy: getNtfy(db),
		reminderDefaults: getDefaultReminders(db),
		pushDevices: db.select().from(pushSubscriptions).all().length,
		appDevices: listAppSessions(db).map((d) => ({
			id: d.id,
			name: d.name ?? 'Android',
			createdAt: d.createdAt.getTime(),
			lastSeenAt: d.lastSeenAt?.getTime() ?? null
		})),
		password: getConfig().auth === 'none' ? 'none' : getConfig().passwordHash ? 'env' : 'app'
	};
};

function guard<T>(fn: () => T) {
	try {
		return fn();
	} catch (e) {
		if (e instanceof FormError) return fail(400, { error: e.message });
		throw e;
	}
}

export const actions: Actions = {
	profile: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			setSetting(db, 'profile', {
				...getProfile(db),
				abiYear: intOrNull(fd, 'abiYear', 2020, 2100, 'Abiturjahr')
			});
			return { saved: 'profile' };
		});
	},
	saveType: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const db = getDb();
			const id = str(fd, 'id');
			const values = {
				name: str(fd, 'name', { required: true, max: 40, label: 'Name' }),
				weight: num(fd, 'weight', 0, 10, 'Gewicht')
			};
			if (id) db.update(gradeTypes).set(values).where(eq(gradeTypes.id, id)).run();
			else
				db.insert(gradeTypes)
					.values({ id: randomUUID(), ...values, sortOrder: listGradeTypes(db).length })
					.run();
			return { saved: 'types' };
		});
	},
	deleteType: async ({ request }) => {
		const db = getDb();
		const id = String((await request.formData()).get('id') ?? '');
		const inUse = db.select().from(grades).where(eq(grades.gradeTypeId, id)).get();
		if (inUse) return fail(400, { error: 'Diese Notenart wird noch verwendet.' });
		db.delete(gradeTypes).where(eq(gradeTypes.id, id)).run();
		return { saved: 'types' };
	},
	ntfy: async ({ request }) => {
		const fd = await request.formData();
		return guard(() => {
			const topic = str(fd, 'topic', { max: 64, label: 'Thema' });
			const server = str(fd, 'server', { max: 200, label: 'Server' }) || 'https://ntfy.sh';
			if (topic && !/^[\w-]+$/.test(topic))
				throw new FormError('Das Thema darf nur Buchstaben, Ziffern, - und _ enthalten.');
			if (!/^https?:\/\//.test(server))
				throw new FormError('Der Server muss mit http:// oder https:// beginnen.');
			const token = str(fd, 'token', { max: 200, label: 'Token' });
			setSetting(getDb(), 'ntfy', topic ? { server, topic, ...(token ? { token } : {}) } : null);
			return { saved: 'ntfy' };
		});
	},
	reminders: async ({ request }) => {
		const fd = await request.formData();
		const allowed = new Set<number>(REMINDER_PRESETS.map((p) => p.minutes));
		const values = fd
			.getAll('reminders')
			.map(Number)
			.filter((m) => allowed.has(m));
		setSetting(getDb(), 'reminderDefaults', values);
		return { saved: 'reminders' };
	},
	test: async () => {
		const count = await notify(getDb(), {
			title: 'Oberstufen-Planer',
			body: 'Test: Benachrichtigungen funktionieren.',
			url: '/einstellungen'
		});
		return count > 0
			? { saved: 'test', count }
			: fail(400, {
					error:
						'Keine Benachrichtigung zugestellt – Push auf diesem Gerät aktivieren oder ntfy einrichten.'
				});
	},
	feed: () => {
		getFeedToken(getDb(), true);
		return { saved: 'feed' };
	},
	restore: async ({ request }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { error: 'Bitte eine Sicherungsdatei wählen.' });
		if (file.size > 20 * 1024 * 1024) return fail(400, { error: 'Die Datei ist zu groß.' });
		let json: unknown;
		try {
			json = JSON.parse(await file.text());
		} catch {
			return fail(400, { error: 'Die Datei ist kein gültiges JSON.' });
		}
		try {
			importData(getDb(), json);
		} catch (e) {
			if (e instanceof BackupError) return fail(400, { error: e.message });
			throw e;
		}
		return { saved: 'restore' };
	},
	password: async ({ request, cookies }) => {
		const config = getConfig();
		if (config.auth === 'none' || config.passwordHash) {
			return fail(400, {
				error: 'Das Passwort wird über die Umgebungsvariable APP_PASSWORD_HASH verwaltet.'
			});
		}
		const db = getDb();
		const fd = await request.formData();
		const current = String(fd.get('current') ?? '');
		const next = String(fd.get('next') ?? '');
		const hashValue = getPasswordHash(db, '');
		if (!hashValue || !(await verifyPassword(hashValue, current))) {
			return fail(400, { error: 'Das aktuelle Passwort ist falsch.' });
		}
		if (next.length < MIN_PASSWORD_LENGTH) {
			return fail(400, {
				error: `Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`
			});
		}
		if (next !== String(fd.get('repeat') ?? ''))
			return fail(400, { error: 'Die neuen Passwörter stimmen nicht überein.' });
		await changePassword(db, next);
		const token = cookies.get(SESSION_COOKIE);
		if (token) deleteOtherSessions(db, token);
		return { saved: 'password' };
	},
	revokeDevice: async ({ request }) => {
		const id = String((await request.formData()).get('id') ?? '');
		const db = getDb();
		if (listAppSessions(db).some((d) => d.id === id)) deleteSessionById(db, id);
		return { saved: 'devices' };
	}
};
