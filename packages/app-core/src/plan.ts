import {
	HALF_YEARS,
	type HalfYear,
	type PlanInput,
	type SubjectInput
} from '@oberstufen-planer/abi-engine-bw';
import { courseView, type CourseView } from './course.ts';
import { sortedSubjects, type Snapshot, type SubjectRow } from './snapshot.ts';

export interface SubjectCourses {
	subject: SubjectRow;
	courses: Partial<Record<HalfYear, CourseView>>;
}

/** Course views per subject, in display order. */
export function subjectCourses(snapshot: Snapshot): SubjectCourses[] {
	const { data } = snapshot;
	return sortedSubjects(data.subjects).map((subject) => {
		const courses: SubjectCourses['courses'] = {};
		for (const c of data.courses.filter((c) => c.subjectId === subject.id)) {
			const g = data.grades.filter((g) => g.subjectId === subject.id && g.halfYear === c.halfYear);
			courses[c.halfYear as HalfYear] = courseView(c, g, data.gradeTypes);
		}
		return { subject, courses };
	});
}

/** Engine input: report-card grades are real, everything else is a forecast. */
export function planInputFromSnapshot(snapshot: Snapshot): PlanInput {
	const subjects: SubjectInput[] = subjectCourses(snapshot).map(({ subject: s, courses }) => {
		const cs: SubjectInput['courses'] = {};
		for (const h of HALF_YEARS) {
			const c = courses[h];
			if (!c) continue;
			cs[h] = { points: c.points, forecast: c.source === 'zeugnis' ? null : c.effective };
		}
		const exam = snapshot.data.exams.find((e) => e.subjectId === s.id);
		return {
			id: s.id,
			name: s.name,
			category: s.category,
			level: s.level,
			exam: s.exam,
			fromClass8: s.fromClass8,
			courses: cs,
			examResult: exam
				? {
						written: exam.written,
						oral: exam.oral,
						writtenForecast: exam.writtenForecast,
						oralForecast: exam.oralForecast
					}
				: undefined
		};
	});
	return {
		subjects,
		bll: snapshot.settings.bll ?? { mode: 'none' },
		overrides: snapshot.settings.overrides ?? {}
	};
}
