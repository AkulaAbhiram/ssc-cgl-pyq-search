// Shared by the app and the Node build script, so keep this plain JS.

// Free hosting on Netlify; the Android app is a direct APK download from the
// site (no Play Store listing yet).
export const SITE_URL = 'https://ssc-cgl-pyq.netlify.app';
export const SITE_NAME = 'SSC CGL PYQ search';
export const ANDROID_PACKAGE = 'in.sscpyq.app';
export const APK_PATH = '/download/ssc-cgl-pyq.apk';

export const SECTIONS = [
  { slug: 'quant', label: 'Quant', full: 'Quantitative aptitude' },
  { slug: 'reasoning', label: 'Reasoning', full: 'General intelligence and reasoning' },
  { slug: 'english', label: 'English', full: 'English comprehension' },
  { slug: 'ga', label: 'GA', full: 'General awareness' },
];

export const sectionBySlug = (slug) => SECTIONS.find((s) => s.slug === slug);
