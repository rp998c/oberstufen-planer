#!/usr/bin/env node
// Removes the password set in the app and logs out all devices.
// On the next visit the app asks for a new password.
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dropPrivileges } from './drop-privileges.js';

dropPrivileges();
const file = join(process.env.DATA_DIR ?? 'data', 'app.db');
if (!existsSync(file)) {
	console.log('Noch keine Datenbank vorhanden – es gibt nichts zurückzusetzen.');
	process.exit(0);
}
const db = new Database(file);
db.prepare("DELETE FROM settings WHERE key = 'passwordHash'").run();
db.prepare('DELETE FROM sessions').run();
db.close();
console.log('Passwort zurückgesetzt. Beim nächsten Aufruf der App kannst du ein neues festlegen.');
if (process.env.APP_PASSWORD_HASH) {
	console.log(
		'Hinweis: APP_PASSWORD_HASH ist gesetzt und hat Vorrang – entferne die Variable, um das Passwort in der App festzulegen.'
	);
}
