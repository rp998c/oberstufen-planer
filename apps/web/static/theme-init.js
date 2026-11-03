// Applies the chosen theme before the first paint (no flash). Kept as a file because of the CSP.
try {
	var p = JSON.parse(localStorage.getItem('op2.prefs') || '{}');
	var t =
		p.theme === 'system'
			? matchMedia('(prefers-color-scheme: light)').matches
				? 'light'
				: 'dark'
			: p.theme || 'dark';
	document.documentElement.className = t + ' acc-' + (p.accent || 'blau');
} catch (e) {
	// keep the default
}
