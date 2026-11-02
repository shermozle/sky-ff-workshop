#!/usr/bin/env node
// Presenter-only utility. Node 20+. Dry run by default; sends only with --send.
const { profiles, properties } = require('../public/profiles.js');
const { randomUUID } = require('node:crypto');
const send = process.argv.includes('--send');
const events = profiles.flatMap(p => {
  const user = { user_id: p.id, device_id: `${p.id}-web` };
  // Put properties and an event together so profiles appear in Analytics.
  return [
    { ...user, event_type: 'Workshop Profile Seeded', user_properties: properties(p), event_properties: { workshop_dataset: 'sky-ff-v1', synthetic: true }, time: Date.now() - 120000, insert_id: randomUUID() },
    ...Array.from({ length: p.watches }, (_, i) => ({ ...user, event_type: 'Demo Content Watched', event_properties: { genre: p.genre, minutes_watched: 15 + i, workshop_dataset: 'sky-ff-v1', synthetic: true }, time: Date.now() - (p.watches - i) * 3600000, insert_id: `sky-ff-v1-${p.id}-watch-${i}` }))
  ];
});
async function main() {
  console.log(`${send ? 'SEND' : 'DRY RUN'} · US endpoint · intended project Feature Flag workshop · org 74301 · ${profiles.length} synthetic users · ${events.length} events`);
  if (!send) { console.log(JSON.stringify(events.filter(e => e.event_type === 'Workshop Profile Seeded'), null, 2)); console.log('To send after approval: set SKY_AMPLITUDE_API_KEY and SKY_AMPLITUDE_PROJECT_NAME, then run node scripts/seed-users.cjs --send'); return; }
  if (process.env.SKY_AMPLITUDE_PROJECT_NAME !== 'Feature Flag workshop') throw new Error('Set SKY_AMPLITUDE_PROJECT_NAME="Feature Flag workshop" after confirming the API key belongs to this project.');
  const apiKey = process.env.SKY_AMPLITUDE_API_KEY;
  if (!apiKey || /YOUR_|PLACEHOLDER/.test(apiKey)) throw new Error('Set SKY_AMPLITUDE_API_KEY to the approved project Analytics API key.');
  const response = await fetch('https://api2.amplitude.com/2/httpapi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: apiKey, events }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result.code !== 200 || result.events_ingested !== events.length) throw new Error(`Seed failed or incomplete: HTTP ${response.status}; ${JSON.stringify(result)}`);
  console.log(`Accepted ${result.events_ingested} events. Verify all five profiles and historical-property targeting before the workshop; acceptance does not confirm enrichment readiness.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
