export const EMPTY_PROFILE = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  headline: '',
  summary: '',
  skills: [],
  experience: [], // { company, title, startDate, endDate, description }
  education: [],  // { institution, degree, field, year }
  projects: [],   // { name, description, tech: string[], url }
  certifications: [], // { name, issuer, year, url }
  languages: [],  // { name, level }
  awards: [],     // { title, issuer, year, description }
  links: [],
  updatedAt: null,
};

export function normalizeProfile(raw = {}) {
  return {
    ...EMPTY_PROFILE,
    ...raw,
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    experience: Array.isArray(raw.experience) ? raw.experience : [],
    education: Array.isArray(raw.education) ? raw.education : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    certifications: Array.isArray(raw.certifications) ? raw.certifications : [],
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    awards: Array.isArray(raw.awards) ? raw.awards : [],
    links: Array.isArray(raw.links) ? raw.links : [],
  };
}
