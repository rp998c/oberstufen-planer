<script lang="ts">
	import {
		parsePercent,
		validateSetup,
		type Area,
		type HalfYear
	} from '@oberstufen-planer/abi-engine-bw';
	import {
		OpError,
		TEST_MODE_LABELS,
		exportSubjects,
		planInput,
		sortedSubjects,
		type Subject,
		type SubjectTemplate,
		type TestMode
	} from '@oberstufen-planer/app-core';
	import Icon from '../components/Icon.svelte';
	import SubjectSheet from '../components/SubjectSheet.svelte';
	import { weightText, weightsLabel } from '../lib/format.ts';
	import { store } from '../lib/store.svelte.ts';
	import { ui } from '../lib/ui.svelte.ts';

	const subjects = $derived(sortedSubjects(store.data.subjects));
	const issues = $derived(
		validateSetup(planInput(store.data)).filter((i) => i.severity === 'error')
	);
	const warnings = $derived(
		validateSetup(planInput(store.data)).filter((i) => i.severity === 'warning')
	);
	const lfCount = $derived(subjects.filter((s) => s.level === 'LF').length);
	const examCount = $derived(subjects.filter((s) => s.exam).length);

	let sheet = $state<{ subject: Subject | null } | null>(null);

	function update(s: Subject, patch: Partial<Subject>) {
		const next = { ...s, ...patch };
		if (patch.level === 'LF') next.exam = 'written';
		if (patch.level === 'BF' && s.exam === 'written') next.exam = null;
		try {
			store.mutate({ type: 'subject.upsert', subject: next });
		} catch (e) {
			ui.notify(e instanceof OpError ? e.message : String(e));
		}
	}
	function setWeight(s: Subject, a: Area, v: string) {
		const n = v.trim() === '' ? 0 : parsePercent(v);
		if (n === null) {
			ui.notify('Gewichte als Prozent (60) oder Bruch (2/3) eingeben.');
			return;
		}
		update(s, { weights: { ...s.weights, [a]: n } });
	}
	function toggleHj(s: Subject, h: HalfYear) {
		const halfYears = s.halfYears.includes(h)
			? s.halfYears.filter((x) => x !== h)
			: [...s.halfYears, h].sort();
		update(s, { halfYears });
	}
	function setKlausuren(s: Subject, v: string) {
		const n = Number(v);
		if (Number.isInteger(n) && n >= 0 && n <= 4) update(s, { klausuren: n });
		else ui.notify('Klausuren pro Halbjahr: 0 bis 4.');
	}

	async function exportFile() {
		await store.platform.saveFile(
			'faecher.json',
			'application/json',
			JSON.stringify(exportSubjects(store.data), null, 2)
		);
	}
	async function importFile() {
		const text = await store.platform.pickFile('.json,application/json');
		if (!text) return;
		let parsed: { kind?: string; subjects?: SubjectTemplate[] };
		try {
			parsed = JSON.parse(text);
		} catch {
			ui.notify('Das ist keine gültige Datei.');
			return;
		}
		if (parsed.kind !== 'faecher' || !Array.isArray(parsed.subjects)) {
			ui.notify(
				'Das ist keine Fächer-Datei. Eine komplette Sicherung stellst du in den Einstellungen wieder her.'
			);
			return;
		}
		const names = new Set(store.data.subjects.map((s) => s.name.trim().toLowerCase()));
		const matching = parsed.subjects.filter((s) => names.has(s.name.trim().toLowerCase())).length;
		const msg = store.data.subjects.length
			? `Gewichtung, Klausuren und Tests für ${matching} passende Fächer übernehmen?`
			: `${parsed.subjects.length} Fächer übernehmen?`;
		if (!confirm(msg)) return;
		try {
			store.mutate({ type: 'subjects.merge', subjects: parsed.subjects });
			ui.notify('Übernommen');
		} catch (e) {
			ui.notify(e instanceof OpError ? e.message : String(e));
		}
	}
</script>

<header class="head">
	<div>
		<h1>Fächer</h1>
		<p class="muted small sub">
			Alles an einem Ort. Klicken, ändern, fertig – wird sofort gespeichert.
		</p>
	</div>
	<div class="actions">
		<button class="btn" type="button" onclick={exportFile}
			><Icon name="upload" size={16} /> Exportieren</button
		>
		<button class="btn" type="button" onclick={importFile}
			><Icon name="download" size={16} /> Importieren</button
		>
	</div>
</header>

{#if issues.length}
	<div class="banner warn msg">
		<Icon name="alert" size={18} />
		<div>
			{#each issues as i (i.code + i.message)}<div>{i.message}</div>{/each}
		</div>
	</div>
{:else}
	<div class="banner ok msg">
		<Icon name="check" size={16} stroke={2.4} />
		<span
			>Deine Fächerwahl ist gültig: {lfCount} Leistungsfächer, {examCount} Prüfungsfächer.{warnings.length
				? ` Hinweis: ${warnings.map((w) => w.message).join(' ')}`
				: ''}</span
		>
	</div>
{/if}

{#if ui.wide}
	<section class="card tcard">
		<div class="table-wrap">
			<table class="grid ft">
				<thead>
					<tr>
						<th scope="col" class="first">Fach</th>
						<th scope="col">Niveau</th>
						<th scope="col">Abiturprüfung</th>
						<th scope="col" class="c">Klausuren<br />pro HJ</th>
						<th scope="col">Tests</th>
						<th scope="col" class="c" colspan="3">Gewichtung<br />schriftl. · mündl. · prakt.</th>
						<th scope="col" class="c">Halbjahre<br />1 · 2 · 3 · 4</th>
						<th scope="col"><span class="sr-only">Aktionen</span></th>
					</tr>
				</thead>
				<tbody>
					{#each subjects as s (s.id)}
						<tr>
							<th scope="row" class="first">
								<span class="nm">
									<label class="colorpick" style:background={s.color} title="Farbe ändern">
										<input
											type="color"
											value={s.color}
											onchange={(e) => update(s, { color: e.currentTarget.value.toUpperCase() })}
											aria-label="Farbe {s.name}"
										/>
									</label>
									<input
										class="cell name"
										value={s.name}
										aria-label="Name"
										onchange={(e) => update(s, { name: e.currentTarget.value })}
									/>
								</span>
							</th>
							<td>
								<select
									class="cell"
									aria-label="Niveau {s.name}"
									value={s.level}
									onchange={(e) => update(s, { level: e.currentTarget.value as 'LF' | 'BF' })}
								>
									<option value="LF">Leistungsfach</option><option value="BF">Basisfach</option>
								</select>
							</td>
							<td>
								<select
									class="cell"
									aria-label="Prüfung {s.name}"
									value={s.exam ?? ''}
									disabled={s.level === 'LF'}
									onchange={(e) =>
										update(s, { exam: e.currentTarget.value === 'oral' ? 'oral' : null })}
								>
									{#if s.level === 'LF'}<option value="written">schriftlich</option>{:else}<option
											value="">–</option
										><option value="oral">mündlich</option>{/if}
								</select>
							</td>
							<td class="c"
								><input
									class="cell num"
									inputmode="numeric"
									aria-label="Klausuren pro Halbjahr {s.name}"
									value={s.klausuren}
									onchange={(e) => setKlausuren(s, e.currentTarget.value)}
								/></td
							>
							<td>
								<select
									class="cell"
									aria-label="Tests {s.name}"
									value={s.tests}
									onchange={(e) => update(s, { tests: e.currentTarget.value as TestMode })}
								>
									{#each Object.entries(TEST_MODE_LABELS) as [k, l] (k)}<option value={k}
											>{l}</option
										>{/each}
								</select>
							</td>
							{#each ['schriftlich', 'muendlich', 'praktisch'] as const as a (a)}
								<td class="c w"
									><input
										class="cell num"
										aria-label="Gewicht {a} {s.name}"
										placeholder="–"
										value={weightText(s.weights[a])}
										onchange={(e) => setWeight(s, a, e.currentTarget.value)}
									/></td
								>
							{/each}
							<td class="c">
								<span class="hjs">
									{#each [1, 2, 3, 4] as const as h (h)}
										<input
											type="checkbox"
											class="hj"
											checked={s.halfYears.includes(h)}
											aria-label="{s.name} Halbjahr {h}"
											onchange={() => toggleHj(s, h)}
										/>
									{/each}
								</span>
							</td>
							<td class="c"
								><button
									class="btn ghost del"
									type="button"
									aria-label="{s.name}: Farbe, Art, Löschen"
									onclick={() => (sheet = { subject: s })}
									title="Mehr …"><Icon name="settings" size={16} /></button
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="tfoot">
			<button class="linkbtn" type="button" onclick={() => (sheet = { subject: null })}
				>+ Fach hinzufügen</button
			>
			<span class="tiny muted"
				>Gewichte als Prozent (60) oder Bruch (2/3). Leer = gibt es in dem Fach nicht.</span
			>
		</div>
	</section>
{:else}
	<div class="card list">
		{#each subjects as s (s.id)}
			<button class="list-row" type="button" onclick={() => (sheet = { subject: s })}>
				<span class="dot" style:background={s.color}></span>
				<span class="ln"
					><span class="lname">{s.name}</span><span class="tiny muted"
						>{s.klausuren} Kl. · {weightsLabel(s.weights)}{s.tests !== 'none'
							? ' · Tests'
							: ''}</span
					></span
				>
				<span class="badge">{s.level}</span>
				<span class="muted"><Icon name="next" size={16} /></span>
			</button>
		{/each}
	</div>
	<button class="btn add" type="button" onclick={() => (sheet = { subject: null })}
		><Icon name="plus" size={16} /> Fach hinzufügen</button
	>
{/if}

{#if sheet}<SubjectSheet onclose={() => (sheet = null)} subject={sheet.subject} />{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	.sub {
		margin: 6px 0 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.msg {
		margin-bottom: 16px;
	}
	.tcard {
		overflow: hidden;
	}
	.ft {
		min-width: 1000px;
	}
	.ft td,
	.ft th {
		padding: 6px 6px;
	}
	.first {
		padding-left: 14px !important;
		text-align: left;
	}
	.c {
		text-align: center !important;
	}
	.nm {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.colorpick {
		position: relative;
		width: 14px;
		height: 14px;
		border-radius: 4px;
		flex: none;
		cursor: pointer;
	}
	.colorpick input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	.cell {
		height: 34px;
		border: 1px solid transparent;
		background: transparent;
		border-radius: 7px;
		padding: 0 8px;
		font-size: 14px;
		color: var(--text);
		min-width: 0;
	}
	.cell:hover:not(:disabled) {
		border-color: var(--border2);
		background: var(--surface2);
	}
	.cell:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--surface2);
	}
	.cell:disabled {
		color: var(--muted);
		-webkit-appearance: none;
		appearance: none;
	}
	.cell.name {
		font-weight: 500;
		width: 180px;
	}
	select.cell option {
		background: var(--surface);
	}
	.num {
		width: 56px;
		text-align: center;
	}
	.hjs {
		display: inline-flex;
		gap: 12px;
	}
	.hj {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
		margin: 0;
	}
	.del {
		min-height: 32px;
		padding: 0 8px;
		color: var(--muted);
	}
	.tfoot {
		border-top: 1px solid var(--line);
		padding: 8px 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.list {
		overflow: hidden;
	}
	.ln {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.lname {
		font-size: 15px;
		font-weight: 500;
	}
	.add {
		margin-top: 12px;
		width: 100%;
	}
</style>
