// Production entry point. Works without any configuration:
// - direct connections (e.g. http://truenas:3000) are treated as http,
//   requests through a reverse proxy keep the proxy's X-Forwarded-Proto/-Host
// - when started as root, the data directory is handed to PUID:PGID first
import http from 'node:http';
import { dropPrivileges } from './scripts/drop-privileges.js';

dropPrivileges();

process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';
process.env.HOST_HEADER ??= 'x-forwarded-host';

const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = http.createServer((req, res) => {
	if (!req.headers['x-forwarded-proto']) req.headers['x-forwarded-proto'] = 'http';
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

server.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
