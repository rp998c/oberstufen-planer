<script lang="ts">
	import {
		CATEGORY_LABELS,
		validateSetup,
		type Category,
		type HalfYear,
		type Issue
	} from '@oberstufen-planer/abi-engine-bw';
	import {
		SUBJECT_COLORS,
		SUBJECT_PRESETS,
		defaultGrading,
		type Subject
	} from '@oberstufen-planer/app-core';
	import Icon from '../components/Icon.svelte';
	import Logo from '../components/Logo.svelte';
	import { href, router } from '../lib/router.svelte.ts';
	import { newId, store } from '../lib/store.svelte.ts';

	interface Pick {
		name: string;
		category: Category;
		halfYears: HalfYear[];
		lf: boolean;
		bf: boolean;
		oral: boolean;
		compulsory: boolean;
		canBeLF: boolean;
	}

	const existing = store.data.subjects;
	const byName = new Map(existing.map((s) => [s.name, s]));
	const now = new Date();
	const defaultYear = now.getMonth() >= 7 ? now.getFullYear() + 2 : now.getFullYear() + 1;

	let step = $state(1);
	let abiYear = $state(store.data.profile.abiYear ?? defaultYear);
	let picks = $state<Pick[]>([
		...SUBJECT_PRESETS.map((p) => {
			const ex = byName.get(p.name);
			return {
				name: p.name,
				category: p.category,
				halfYears: ex?.halfYears ?? [...p.halfYears],
				lf: ex?.level === 'LF',
				bf: ex ? ex.level === 'BF' : existing.length === 0 && p.compulsory === true,
				oral: ex?.exam === 'oral',
				compulsory: p.compulsory === true,
				canBeLF: p.canBeLF === true
			};
		}),
		...existing
			.filter((s) => !SUBJECT_PRESETS.some((p) => p.name === s.name))
			.map((s) => ({
				name: s.name,
				category: s.category,
				halfYears: s.halfYears,
				lf: s.level === 'LF',
				bf: s.level === 'BF',
				oral: s.exam === 'oral',
				compulsory: false,
				canBeLF: true
			}))
	]);
	let customName = $state('');
	let customCat = $state<Category>('sonstiges');

	const lf = $derived(picks.filter((p) => p.lf));
	const bf = $derived(picks.filter((p) => p.bf && !p.lf));
	const chosen = $derived([...lf, ...bf]);

	function toggleLf(p: Pick) {
		if (!p.lf && lf.length >= 3) return;
		p.lf = !p.lf;
		if (p.lf) p.oral = false;
	}
	function toggleBf(p: Pick) {
		if (p.lf) return;
		p.bf = !p.bf;
		if (!p.bf) p.oral = false;
	}
	function toggleOral(p: Pick) {
		if (!p.oral && bf.filter((x) => x.oral).length >= 2) return;
		p.oral = !p.oral;
	}
	function addCustom() {
		const name = customName.trim();
		if (!name || picks.some((p) => p.name === name)) return;
		picks.push({
			name,
			category: customCat,
			halfYears: [1, 2, 3, 4],
			lf: false,
			bf: true,
			oral: false,
			compulsory: false,
			canBeLF: true
		});
		customName = '';
	}

	const input = $derived({
		subjects: chosen.map((p) => ({
			id: p.name,
			name: p.name,
			category: p.category,
			level: (p.lf ? 'LF' : 'BF') as 'LF' | 'BF',
			exam: (p.lf ? 'written' : p.oral ? 'oral' : null) as Subject['exam'],
			fromClass8: true,
			courses: Object.fromEntries(p.halfYears.map((h) => [h, {}]))
		}))
	});
	const allIssues = $derived(validateSetup(input));
	const STEP2 = ['lf-count', 'lf-core'];
	const step2Errors = $derived(allIssues.filter((i) => STEP2.includes(i.code)));
	const step3Errors = $derived(
		allIssues.filter((i) => i.severity === 'error' && !STEP2.includes(i.code))
	);
	const missing = $derived(allIssues.filter((i) => i.severity === 'warning'));

	const checks2 = $derived([
		{ ok: lf.length === 3, t: `${lf.length} von 3 Leistungsfächern gewählt` },
		{
			ok: !allIssues.some((i) => i.code === 'lf-core'),
			t: 'Zwei davon aus Deutsch, Mathe, Fremdsprache oder Naturwissenschaft'
		},
		...[
			['missing-deutsch', 'Deutsch'],
			['missing-mathe', 'Mathematik'],
			['missing-fremdsprache', 'Eine Fremdsprache'],
			['missing-naturwissenschaft', 'Eine Naturwissenschaft'],
			['missing-geschichte', 'Geschichte'],
			['missing-religion_ethik', 'Religion oder Ethik'],
			['missing-kunst', 'Kunst oder Musik'],
			['missing-sport', 'Sport']
		].map(([code, t]) => ({ ok: !allIssues.some((i) => i.code === code), t: `${t} belegt` }))
	]);

	function lfHint(issues: Issue[]): string | null {
		if (!issues.some((i) => i.code === 'lf-core')) return null;
		const weak = lf.find(
			(p) => !['deutsch', 'mathe', 'fremdsprache', 'naturwissenschaft'].includes(p.category)
		);
		return weak ? `Tausch z. B. ${weak.name} gegen Englisch, Physik oder Deutsch.` : null;
	}

	const canNext = $derived(
		step === 1
			? abiYear >= 2020 && abiYear <= 2100
			: step === 2
				? step2Errors.length === 0
				: step === 3
					? step3Errors.length === 0
					: true
	);

	const removed = $derived(existing.filter((s) => !chosen.some((p) => p.name === s.name)));

	function finish() {
		if (
			removed.length &&
			!confirm(`${removed.map((s) => s.name).join(', ')} mit allen Noten entfernen?`)
		)
			return;
		store.mutate({ type: 'profile.set', abiYear });
		for (const s of removed) store.mutate({ type: 'subject.delete', id: s.id });
		chosen.forEach((p, i) => {
			const ex = byName.get(p.name);
			const level = p.lf ? 'LF' : 'BF';
			const grading = defaultGrading(p.category, level);
			store.mutate({
				type: 'subject.upsert',
				subject: {
					id: ex?.id ?? newId(),
					name: p.name,
					color: ex?.color ?? SUBJECT_COLORS[i % SUBJECT_COLORS.length]!,
					category: p.category,
					level,
					exam: p.lf ? 'written' : p.oral ? 'oral' : null,
					fromClass8: ex?.fromClass8 ?? true,
					sortOrder: i,
					halfYears: p.halfYears,
					klausuren: ex && ex.level === level ? ex.klausuren : grading.klausuren,
					tests: ex?.tests ?? grading.tests,
					weights: ex?.weights ?? grading.weights
				}
			});
		});
		router.go({ name: 'overview' });
	}

	const steps = ['Abiturjahrgang', 'Fächer', 'Prüfungen', 'Fertig'];
</script>

<div class="wrap">
	<div class="brand"><Logo icon={store.prefs.icon} /><span>Oberstufen-Planer</span></div>

	<ol class="steps" aria-label="Schritte">
		{#each steps as s, i (s)}
			<li
				class:done={i + 1 < step}
				class:cur={i + 1 === step}
				aria-current={i + 1 === step ? 'step' : undefined}
			>
				{#if i + 1 < step}<Icon name="check" size={14} stroke={3} />
					{i === 0 ? `Abitur ${abiYear}` : s}{:else}{i + 1} · {s}{/if}
			</li>
		{/each}
	</ol>

	{#if step === 1}
		<h1>Wann machst du Abitur?</h1>
		<p class="lead">Daraus ergibt sich, in welchem Halbjahr du gerade bist.</p>
		<div class="years">
			{#each [defaultYear - 1, defaultYear, defaultYear + 1] as y (y)}
				<button
					type="button"
					class="pick year"
					class:on={abiYear === y}
					aria-pressed={abiYear === y}
					onclick={() => (abiYear = y)}>Abitur {y}</button
				>
			{/each}
		</div>
		{#if existing.length === 0}
			<p class="small muted alt">
				Du hast schon eine Sicherung? <a href={href({ name: 'settings' })}
					>In den Einstellungen wiederherstellen</a
				>
			</p>
		{/if}
	{:else if step === 2}
		<h1>Welche Fächer hast du?</h1>
		<p class="lead">
			Wähl deine drei Leistungsfächer und die Basisfächer. Wie Klausuren und mündliche Noten zählen,
			ist schon sinnvoll voreingestellt.
		</p>
		<div class="cols">
			<div class="main-col">
				<section aria-labelledby="lf-h">
					<div class="sec-h">
						<h2 id="lf-h">Leistungsfächer</h2>
						<span class="small muted">{lf.length} von 3 gewählt · 2 Klausuren pro Halbjahr</span>
					</div>
					<div class="grid">
						{#each picks.filter((p) => p.canBeLF) as p (p.name)}
							<button
								type="button"
								class="pick"
								class:on={p.lf}
								aria-pressed={p.lf}
								disabled={!p.lf && lf.length >= 3}
								onclick={() => toggleLf(p)}>{p.name}</button
							>
						{/each}
					</div>
					{#if step2Errors.length && lf.length === 3}
						<div class="banner warn hint" role="alert">
							<Icon name="alert" size={18} />
							<div>
								<strong>So geht das nicht:</strong>
								{step2Errors[0]!.message}{#if lfHint(step2Errors)}<br /><span class="sub"
										>{lfHint(step2Errors)}</span
									>{/if}
							</div>
						</div>
					{/if}
				</section>
				<section aria-labelledby="bf-h">
					<div class="sec-h">
						<h2 id="bf-h">Basisfächer</h2>
						<span class="small muted">Pflichtfächer sind schon drin</span>
					</div>
					<div class="grid">
						{#each picks.filter((p) => !p.lf) as p (p.name)}
							<button
								type="button"
								class="pick"
								class:on={p.bf}
								aria-pressed={p.bf}
								onclick={() => toggleBf(p)}
							>
								<span class="pn">{p.name}</span>{#if p.compulsory}<span class="req">Pflicht</span
									>{/if}
							</button>
						{/each}
					</div>
					<form class="custom" onsubmit={(e) => (e.preventDefault(), addCustom())}>
						<input
							class="input"
							placeholder="Anderes Fach"
							maxlength="60"
							bind:value={customName}
							aria-label="Anderes Fach"
						/>
						<select class="input" bind:value={customCat} aria-label="Art">
							{#each Object.entries(CATEGORY_LABELS) as [k, l] (k)}<option value={k}>{l}</option
								>{/each}
						</select>
						<button class="btn" type="submit">Hinzufügen</button>
					</form>
				</section>
			</div>
			<aside class="card pad checks" aria-labelledby="chk-h">
				<h2 id="chk-h" class="card-title">Passt deine Wahl?</h2>
				<ul>
					{#each checks2 as c (c.t)}
						<li class:bad={!c.ok}><span class="ci">{c.ok ? '✓' : '!'}</span>{c.t}</li>
					{/each}
				</ul>
				<p class="tiny muted">
					Gewichtung, Tests und Halbjahre kannst du später in einer Tabelle für alle Fächer auf
					einmal ändern.
				</p>
			</aside>
		</div>
	{:else if step === 3}
		<h1>Deine Prüfungsfächer</h1>
		<p class="lead">
			Die Leistungsfächer prüfst du schriftlich. Wähl dazu zwei Basisfächer für die mündliche
			Prüfung.
		</p>
		<div class="cols">
			<div class="main-col">
				<div class="sec-h"><h2>Schriftlich</h2></div>
				<div class="grid">
					{#each lf as p (p.name)}<span class="pick on static">{p.name}</span>{/each}
				</div>
				<div class="sec-h">
					<h2>Mündlich</h2>
					<span class="small muted">{bf.filter((p) => p.oral).length} von 2 gewählt</span>
				</div>
				<div class="grid">
					{#each bf as p (p.name)}
						<button
							type="button"
							class="pick"
							class:on={p.oral}
							aria-pressed={p.oral}
							disabled={!p.oral && bf.filter((x) => x.oral).length >= 2}
							onclick={() => toggleOral(p)}>{p.name}</button
						>
					{/each}
				</div>
			</div>
			<aside class="card pad checks">
				<h2 class="card-title">Passt das?</h2>
				{#if step3Errors.length}
					<ul>
						{#each step3Errors as i (i.code + i.message)}<li class="bad">
								<span class="ci">!</span>{i.message}
							</li>{/each}
					</ul>
				{:else}
					<ul><li><span class="ci">✓</span>Alle Regeln für die Prüfungsfächer erfüllt</li></ul>
				{/if}
			</aside>
		</div>
	{:else}
		<h1>Fertig!</h1>
		<p class="lead">
			{chosen.length} Fächer, {chosen.reduce((a, p) => a + p.halfYears.length, 0)} Kurse. Ab jetzt einfach
			Noten eintragen – der Rest rechnet sich von selbst.
		</p>
		<div class="card pad summary">
			<div>
				<span class="muted small">Leistungsfächer</span><strong
					>{lf.map((p) => p.name).join(', ')}</strong
				>
			</div>
			<div>
				<span class="muted small">Mündliche Prüfung</span><strong
					>{bf
						.filter((p) => p.oral)
						.map((p) => p.name)
						.join(', ')}</strong
				>
			</div>
			<div>
				<span class="muted small">Basisfächer</span><strong
					>{bf.map((p) => p.name).join(', ')}</strong
				>
			</div>
			{#if missing.length}<div class="banner warn small">
					{missing.map((m) => m.message).join(' ')}
				</div>{/if}
		</div>
	{/if}

	<div class="nav">
		{#if step > 1}
			<button class="btn ghost big" type="button" onclick={() => step--}>Zurück</button>
		{:else if existing.length}
			<a class="btn ghost big" href={href({ name: 'settings' })}>Abbrechen</a>
		{:else}<span></span>{/if}
		{#if step < 4}
			<button class="btn primary big" type="button" disabled={!canNext} onclick={() => step++}
				>Weiter</button
			>
		{:else}
			<button class="btn accent big" type="button" onclick={finish}>Los geht's</button>
		{/if}
	</div>
</div>

<style>
	.wrap {
		max-width: 1120px;
		margin: 0 auto;
		padding: calc(32px + env(safe-area-inset-top)) 20px calc(48px + env(safe-area-inset-bottom));
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 650;
		margin-bottom: 28px;
	}
	.steps {
		list-style: none;
		margin: 0 0 28px;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 13px;
		font-weight: 550;
	}
	.steps li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 999px;
		color: var(--muted);
	}
	.steps li.done {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text2);
	}
	.steps li.done :global(svg) {
		color: var(--ok);
	}
	.steps li.cur {
		background: var(--strong);
		color: var(--on-strong);
	}
	h1 {
		font-size: 30px;
	}
	.lead {
		margin: 8px 0 28px;
		font-size: 15px;
		color: var(--muted);
		max-width: 640px;
		line-height: 1.5;
	}
	.years {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.year {
		min-width: 150px;
		justify-content: center;
		font-size: 16px;
	}
	.alt {
		margin-top: 24px;
	}
	.cols {
		display: flex;
		flex-wrap: wrap;
		gap: 28px;
		align-items: flex-start;
	}
	.main-col {
		flex: 999 1 560px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.sec-h {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 12px;
	}
	.sec-h h2 {
		font-size: 17px;
		font-weight: 650;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 8px;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 46px;
		min-width: 0;
		padding: 8px 12px;
		border-radius: 10px;
		border: 1px solid var(--border2);
		background: var(--surface);
		font-size: 14px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}
	.pick:hover:not(:disabled) {
		border-color: var(--faint);
	}
	.pick.on {
		background: var(--tint);
		border-color: var(--accent);
	}
	.pick:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.pick.static {
		cursor: default;
	}
	.pn {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		hyphens: auto;
		line-height: 1.25;
	}
	.req {
		flex: none;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--muted);
		background: var(--chip);
		border-radius: 4px;
		padding: 2px 5px;
	}
	.hint {
		margin-top: 14px;
	}
	.hint .sub {
		opacity: 0.85;
	}
	.custom {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.custom .input {
		flex: 1 1 180px;
		width: auto;
	}
	.checks {
		flex: 1 1 300px;
		max-width: 380px;
	}
	.checks ul {
		list-style: none;
		margin: 12px 0;
		padding: 0;
		display: grid;
		gap: 9px;
		font-size: 14px;
		line-height: 1.4;
	}
	.checks li {
		display: flex;
		gap: 10px;
	}
	.ci {
		flex: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--ok);
		color: var(--bg);
		font-size: 11px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 1px;
	}
	.checks li.bad {
		color: var(--warn-text);
	}
	.checks li.bad .ci {
		background: var(--warn-dot);
	}
	.summary {
		display: grid;
		gap: 14px;
		max-width: 640px;
	}
	.summary div {
		display: grid;
		gap: 2px;
	}
	.nav {
		display: flex;
		justify-content: space-between;
		margin-top: 36px;
		max-width: 760px;
	}
	.nav .btn {
		min-width: 120px;
	}
</style>
