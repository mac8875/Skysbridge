const base = (process.env.SKYSBRIDGE_BASE_URL || process.argv[2] || 'https://skysbridge.org').replace(/\/$/, '');

const checks = [
  ['/', 'Every child deserves to be remembered.'],
  ['/index-de.html', 'Jedes Kind verdient es, erinnert zu werden.'],
  ['/index-es.html', 'recordado'],
  ['/skys-story.html', "Sky"],
  ['/skys-story-de.html', 'Sky'],
  ['/skys-story-es.html', 'Sky'],
  ['/how-it-works.html', 'How'],
  ['/how-it-works-de.html', 'funktioniert'],
  ['/how-it-works-es.html', 'funciona'],
  ['/privacy.html', 'Your story belongs to you'],
  ['/privacy-de.html', 'Geschichte'],
  ['/privacy-es.html', 'historia'],
  ['/professional-help.html', 'Professional'],
  ['/professional-help-de.html', 'Hilfe'],
  ['/professional-help-es.html', 'Ayuda'],
];

let failures = 0;

for (const [path, expected] of checks) {
  const url = `${base}${path}`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    const ok = response.ok && text.toLowerCase().includes(expected.toLowerCase());
    if (!ok) {
      failures += 1;
      console.error(`FAIL ${response.status} ${url} — missing expected text: ${expected}`);
    } else {
      console.log(`PASS ${response.status} ${url}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${url} — ${error.message}`);
  }
}

if (failures) {
  console.error(`\n${failures} smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} smoke checks passed.`);
