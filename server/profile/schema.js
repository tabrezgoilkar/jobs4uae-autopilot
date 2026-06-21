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
    links: Array.isArray(raw.links) ? raw.links : [],
  };
}
