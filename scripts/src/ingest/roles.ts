const LOCALIZATION_PATTERNS = [
  /localization/i,
  /translator/i,
  /adr/i,
  /dub/i,
  /subtitles?/i,
  /subtitling/i,
  /script\s*\(dub\)/i,
  /english dub/i,
];

export function isLocalizationRole(roleText: string) {
  return LOCALIZATION_PATTERNS.some((re) => re.test(roleText ?? ''));
}

const MAP: Record<string, number> = {
  director: 1.5,
  'series composition': 1.3,
  'character design': 1.3,
  music: 1.2,
  producer: 1.0,
};

export function roleWeight(role: string) {
  const key = (role ?? '').toLowerCase();
  return Object.entries(MAP).find(([k]) => key.includes(k))?.[1] ?? 0.8;
}
