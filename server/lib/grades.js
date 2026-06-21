export const GRADES = ['A', 'B', 'C', 'D', 'F'];

export function coerceGrade(g) {
  const up = String(g || '').trim().toUpperCase();
  return GRADES.includes(up) ? up : 'C';
}
