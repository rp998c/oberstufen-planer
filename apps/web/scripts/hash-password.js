#!/usr/bin/env node
// Creates the Argon2id hash for APP_PASSWORD_HASH.
// Usage: hash-password            (asks for the password, input hidden)
//        echo -n "pw" | hash-password
import { hash } from '@node-rs/argon2';
import { createInterface } from 'node:readline';

async function readFromStdin() {
	let data = '';
	for await (const chunk of process.stdin) data += chunk;
	return data.replace(/\r?\n$/, '');
}

function ask(question) {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		let muted = false;
		rl._writeToOutput = (s) => {
			if (!muted) process.stdout.write(s);
		};
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
		muted = true;
	});
}

async function main() {
	let password;
	if (process.stdin.isTTY) {
		password = await ask('Passwort: ');
		const repeat = await ask('Passwort wiederholen: ');
		if (password !== repeat) {
			console.error('Die Passwörter stimmen nicht überein.');
			process.exit(1);
		}
	} else {
		password = await readFromStdin();
	}

	if (password.length < 8) {
		console.error('Das Passwort muss mindestens 8 Zeichen lang sein.');
		process.exit(1);
	}

	const result = await hash(password);
	console.log(result);
	console.error(
		`\nIn die .env-Datei eintragen (mit einfachen Anführungszeichen):\nAPP_PASSWORD_HASH='${result}'`
	);
}

main();
