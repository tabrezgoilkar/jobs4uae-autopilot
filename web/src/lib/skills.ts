export function gradeToStars(grade: string): number {
  const map: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
  return map[(grade || '').toUpperCase()] ?? 3;
}

export interface LearningLink {
  label: string;
  url: string;
}

// Deterministic, real search pages on reputable free platforms — never invented course URLs.
export function learningLinks(skill: string): LearningLink[] {
  const q = encodeURIComponent(skill.trim());
  return [
    { label: 'YouTube', url: `https://www.youtube.com/results?search_query=learn+${q}+free` },
    { label: 'freeCodeCamp', url: `https://www.freecodecamp.org/news/search/?query=${q}` },
    { label: 'Microsoft Learn', url: `https://learn.microsoft.com/en-us/search/?terms=${q}` },
    { label: 'Coursera', url: `https://www.coursera.org/search?query=${q}` },
  ];
}
