import { matchQuestion } from './match.js';

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
  const pending = [];
  const questions = (await adapter.detectQuestions()) ?? [];
  for (const q of questions) {
    const decision = await matchQuestion({ label: q.label }, { fields, memory, profile, job: ctx.job ?? '' }, engine);
    if (decision.action === 'fill' && decision.answer) {
      if (await adapter.fillField(q.selector, decision.answer)) filledCount++;
    } else if (decision.action === 'draft') {
      pending.push({ id: q.id, selector: q.selector, label: q.label, type: q.type, draft: decision.answer });
    } else {
      pending.push({ id: q.id, selector: q.selector, label: q.label, type: q.type });
    }
  }

  // Never submits — the human reviews the live form and clicks Submit.
  return { filledCount, pending };
}
