#!/usr/bin/env node
// Synthetic presenter analysis fixtures. Dry run by default; --send writes data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { profiles } = require('../public/profiles.js');
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/config.js'), 'utf8'), scope);
const config = scope.window.SKY_WORKSHOP_CONFIG;
const flagKey = 'presenter-recommendations';
const dataset = 'sky-highlighted-v1';
const now = Date.now();
const exposures = [], activity = [];
// A deliberately synthetic seven-day history, including activity today.
for (let day = 6; day >= 0; day--) {
  const dayStart = day === 0 ? now - 30 * 60000 : new Date(new Date(now - day * 86400000).toISOString().slice(0, 10) + 'T12:00:00Z').getTime();
  const date = new Date(dayStart).toISOString().slice(0, 10);
  for (const profile of profiles) {
    const on = profile.engagement === 'high';
    const sessions = on ? 4 : 2;
    for (let session = 0; session < sessions; session++) {
      const time = dayStart + session * 180000;
      const base = { user_id: profile.id, device_id: `${profile.id}-web`, session_id: time };
      const props = { synthetic: true, workshop_dataset: dataset, rail_flag: flagKey, rail_variant: on ? 'on' : 'off', genre: profile.genre };
      const insert = `${dataset}-${date}-${profile.id}-${session}`;
      exposures.push({ ...base, event_type: '$exposure', time, insert_id: `${insert}-exposure`, event_properties: { ...props, flag_key: flagKey, variant: on ? 'on' : 'off' } });
      activity.push({ ...base, event_type: 'Demo Recommendation Rail Viewed', time: time + 1000, insert_id: `${insert}-view`, event_properties: props });
      if (session < (on ? 3 : 1)) activity.push({ ...base, event_type: 'Demo Content Previewed', time: time + 12000, insert_id: `${insert}-preview`, event_properties: { ...props, title: `${profile.genre} demo programme` } });
      if (session < (on ? 2 : 1) && profile.id !== 'sky-workshop-casey') activity.push({ ...base, event_type: 'Demo Content Watched', time: time + 60000, insert_id: `${insert}-watched`, event_properties: { ...props, minutes_watched: on ? 24 + session * 3 : 12 } });
    }
  }
}
const all = [...exposures, ...activity];
const counts = all.reduce((result, e) => { result[e.event_type] = (result[e.event_type] || 0) + 1; return result; }, {});
async function upload(events) {
  let accepted = 0;
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50);
    const response = await fetch('https://api2.amplitude.com/2/httpapi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: config.analyticsApiKey, events: batch }), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || result.code !== 200 || result.events_ingested !== batch.length) throw new Error(`Ingestion failed: HTTP ${response.status}; ${JSON.stringify(result)}`);
    accepted += result.events_ingested;
  }
  return accepted;
}
async function main() {
  console.log(JSON.stringify({ mode: process.argv.includes('--send') ? 'SEND' : 'DRY RUN', project: config.projectName, projectId: config.projectId, flag: flagKey, dataset, users: profiles.length, days: 7, eventCount: all.length, eventTypes: counts, note: 'Illustrative synthetic history, not a measured feature impact. Exposure values reflect the current high-engagement targeting rule.' }, null, 2));
  if (!process.argv.includes('--send')) return;
  if (config.projectId !== '896821' || config.region !== 'us' || config.projectName !== 'Feature Flag workshop') throw new Error('Unexpected target project.');
  if (!config.analyticsApiKey || /YOUR_|PLACEHOLDER/.test(config.analyticsApiKey)) throw new Error('Approved Analytics API key is required.');
  // Establish flag exposures before sending downstream activity.
  const exposureCount = await upload(exposures);
  console.log(`Accepted ${exposureCount} synthetic flag exposures.`);
  const activityCount = await upload(activity);
  console.log(`Accepted ${activityCount} synthetic viewing events. Allow processing time before checking Highlighted Analysis.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
