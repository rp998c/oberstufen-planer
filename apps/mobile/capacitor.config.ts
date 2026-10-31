import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'io.github.rp998c.oberstufenplaner',
	appName: 'Oberstufen-Planer',
	webDir: 'dist',
	plugins: {
		// Native HTTP: no CORS needed and http:// servers in the home network work too
		CapacitorHttp: { enabled: true },
		LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#15803d' }
	}
};

export default config;
