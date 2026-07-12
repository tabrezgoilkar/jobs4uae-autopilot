export type CvTemplateId = 'classic' | 'modern' | 'minimal' | 'executive';

export const CV_TEMPLATES: { id: CvTemplateId; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'modern', name: 'Modern' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'executive', name: 'Executive' },
];
