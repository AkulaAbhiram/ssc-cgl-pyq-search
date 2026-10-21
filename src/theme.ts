export const colors = {
  text: '#1d1d1b',
  muted: '#5f5e5a',
  faint: '#8a8984',
  border: '#e2e1dc',
  surface: '#f5f4f0',
  page: '#ffffff',
  primary: '#534ab7',
  primaryBg: '#eeedfe',
  onPrimary: '#ffffff',
  success: '#2f5f0c',
  successBg: '#eaf3de',
  successBorder: '#97c459',
  highlight: '#ffe58f',
};

// One tint per exam section, used on tags.
export const sectionColors: Record<string, { bg: string; fg: string }> = {
  quant: { bg: '#e1f5ee', fg: '#085041' },
  reasoning: { bg: '#eeedfe', fg: '#3c3489' },
  english: { bg: '#faece7', fg: '#712b13' },
  ga: { bg: '#faeeda', fg: '#633806' },
};

export const MAX_WIDTH = 720;
