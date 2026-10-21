// Shared by the app and the Node build script, so keep this plain JS.

// Placeholders until the domain and Play listing exist.
export const SITE_URL = 'https://sscpyq.in';
export const SITE_NAME = 'SSC CGL PYQ search';
export const ANDROID_PACKAGE = 'in.sscpyq.app';
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

export const SECTIONS = [
  { slug: 'quant', label: 'Quant', full: 'Quantitative aptitude' },
  { slug: 'reasoning', label: 'Reasoning', full: 'General intelligence and reasoning' },
  { slug: 'english', label: 'English', full: 'English comprehension' },
  { slug: 'ga', label: 'GA', full: 'General awareness' },
];

export const sectionBySlug = (slug) => SECTIONS.find((s) => s.slug === slug);
