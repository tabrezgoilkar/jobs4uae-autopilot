// Indeed board config (GCC regions: ae/sa/qa). Config-driven so the autofill
// engine never changes when selectors drift — only this file does. Selectors are
// deliberately broad (CSS unions + a generic fallback in the autofiller) because
// Indeed's hosted "Apply with Indeed" form markup changes often.

export const indeed = {
  id: 'indeed',
  name: 'Indeed',
  loginUrl: 'https://secure.indeed.com/account/login',
  // A logged-in-only URL we can probe to best-effort confirm a live session.
  loggedInProbe: 'https://myjobs.indeed.com/',
  // source paths resolved against { profile, fields } by the autofiller.
  fieldMap: [
    { selector: '#input-applicant\\.name, input[name="applicant.name"], input[autocomplete="name"]', source: 'profile.fullName' },
    { selector: '#input-applicant\\.email, input[type="email"], input[autocomplete="email"]', source: 'profile.email' },
    { selector: '#input-applicant\\.phoneNumber, input[type="tel"], input[autocomplete="tel"]', source: 'profile.phone' },
  ],
  resumeUpload: 'input[type="file"]',
  coverLetterField: '#input-applicant\\.coverletter, textarea[name="applicant.coverletter"], textarea',
};
