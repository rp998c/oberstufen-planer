// When started as root (e.g. on TrueNAS), make the data directory belong to PUID:PGID
// and continue as that user. Without root nothing happens.
import { chownSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function chownRecursive(path, uid, gid) {
	chownSync(path, uid, gid);
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		const p = join(path, entry.name);
		if (entry.isDirectory()) chownRecursive(p, uid, gid);
		else chownSync(p, uid, gid);
	}
}

export function dropPrivileges() {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) return;
	const uid = Number(process.env.PUID ?? 1000);
	const gid = Number(process.env.PGID ?? 1000);
	if (uid === 0) return; // explicitly asked to run as root
	const dataDir = process.env.DATA_DIR ?? 'data';
	try {
		mkdirSync(dataDir, { recursive: true });
		chownRecursive(dataDir, uid, gid);
	} catch (e) {
		console.warn(`Warnung: Rechte für ${dataDir} konnten nicht gesetzt werden:`, e.message);
	}
	process.setgid(gid);
	process.setuid(uid);
}
