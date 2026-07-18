import { matchQuestion } from './match.js';
import { gradeAnswer } from './confidence.js';

// Autofills a board's application form through an injected page `adapter` (so the
// orchestration is unit-testable without a real browser). It fills mapped contact
// fields, uploads the resume PDF, pastes the cover letter, and answers screening
// questions it can — returning the rest as pending for the user. It NEVER submits.
//
// adapter shape:
//   fillField(selector, value) -> bool   uploadFile(selector, path) -> bool
//   setText(selector, value)   -> bool   detectQuestions() -> [{ id, selector, label, type }]

function resolveSource(source, { profile, fields }) {
  const [scope, key] = String(source).split('.');
  if (scope === 'profile') return profile?.[key] ?? '';
  if (scope === 'field') return fields?.[key] ?? '';
  return '';
}

export async function autofillJob(adapter, ctx, engine) {
  const { board, profile = {}, documents = {}, details = { fields: {}, memory: [] } } = ctx ?? {};
  const fields = details.fields ?? {};
  const memory = details.memory ?? [];
  let filledCount = 0;

  // 1) Mapped contact fields.
  for (const map of board.fieldMap ?? []) {
    const value = resolveSource(map.source, { profile, fields });
    if (value && (await adapter.fillField(map.selector, value))) filledCount++;
  }

  // 2) Resume PDF + cover letter.
  if (documents.resumePdfPath && board.resumeUpload) {
    if (await adapter.uploadFile(board.resumeUpload, documents.resumePdfPath)) filledCount++;
  }
  if (documents.coverLetter && board.coverLetterField) {
    if (await adapter.setText(board.coverLetterField, documents.coverLetter)) filledCount++;
  }

  // 3) Screening questions: fill what we can, surface the rest for the user.
  //    Every answered question is graded with the deterministic confidence
  //    model — high-confidence ('fill') answers are submitted; low-confidence
  //    drafts are returned as pending for human review (never auto-submitted).
  //    Grounded answers = verified memory + application-details fields.
  const groundedAnswers = [
    ...memory.map((m) => ({ label: m.questionLabel, answer: m.answer })),
    ...Object.values(fields ?? {}).filter((v) => typeof v === 'string' && v.trim()).map((v) => ({ answer: v })),
  ];
  const pending = [];
  const questions = (await adapter.detectQuestions()) ?? [];
  for (const q of questions) {
    const decision = await matchQuestion({ label: q.label }, { fields, memory, profile, job: ctx.job ?? '' }, engine);
    if ((decision.action === 'fill' || decision.action === 'draft') && decision.answer) {
      const grade = gradeAnswer(q.label, decision.answer, profile, profile.faq ?? [], groundedAnswers);
      if (grade.confidence === 'high') {
        if (await adapter.fillField(q.selector, decision.answer)) filledCount++;
      } else {
        // Grounded answer could not be verified — route to review, do NOT submit.
        pending.push({ id: q.id, selector: q.selector, label: q.label, type: q.type, draft: decision.answer, confidence: 'low', missingReference: grade.reference ?? 'profile/FAQ' });
      }
    } else {
      pending.push({ id: q.id, selector: q.selector, label: q.label, type: q.type });
    }
  }

  // Never submits — the human reviews the live form and clicks Submit.
  return { filledCount, pending };
}
