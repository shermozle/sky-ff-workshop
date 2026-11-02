/* Static workshop app. Real remote decisions use the vendored Amplitude SDK. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { profiles, properties } = window.SkyProfiles;
  const config = window.SKY_WORKSHOP_CONFIG;
  const storageKey = 'sky-ff-workshop-connection-v1';
  const fields = ['mode', 'profile', 'flag', 'promo', 'input-mode', 'target', 'engagement', 'rollout', 'enabled'];
  let current = null, sdk = null, busy = false, generation = 0, activeTransport = null;
  const clients = new Map();
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* private storage may be unavailable */ }
  const usable = value => !!value && !/YOUR_|PLACEHOLDER/i.test(value);
  $('deployment').value = saved.deploymentKey || (usable(config.deploymentKey) ? config.deploymentKey : '');
  $('api-key').value = saved.analyticsApiKey || (usable(config.analyticsApiKey) ? config.analyticsApiKey : '');
  $('track').checked = saved.track === true;
  profiles.forEach(p => { const option = document.createElement('option'); option.value = p.id; option.textContent = `${p.name} · ${p.packages.filter(s => s !== 'Sky Starter').join(' + ') || 'Sky Starter'}`; $('profile').append(option); });
  const params = new URLSearchParams(location.search);
  const choices = { mode: ['practice', 'live'], profile: profiles.map(p => p.id), 'input-mode': ['explicit', 'historical'], target: ['all', 'Sky Starter', 'Sky Sport', 'Sky Movies', 'Sky Entertainment'], engagement: ['all', 'high', 'low'] };
  fields.forEach(id => {
    if (!params.has(id)) return;
    const value = params.get(id);
    if (choices[id] && !choices[id].includes(value)) return;
    if (id === 'enabled') $(id).checked = value !== '0';
    else if (id === 'rollout') $(id).value = String(Math.max(0, Math.min(100, Number(value) || 0)));
    else if (id === 'flag' || id === 'promo') $(id).value = value.slice(0, 100);
    else $(id).value = value;
  });
  const selected = () => profiles.find(p => p.id === $('profile').value);
  const state = () => Object.fromEntries(fields.map(id => [id, id === 'enabled' ? $(id).checked : $(id).value]));
  function url() {
    const result = new URL(location.href);
    result.search = ''; result.hash = '';
    Object.entries(state()).forEach(([key, value]) => result.searchParams.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value));
    return result;
  }
  function updateURL() { try { history.replaceState(null, '', url()); } catch { /* file URL or restrictive browser */ } }
  function log(message) {
    const li = document.createElement('li'), time = document.createElement('time');
    time.textContent = new Date().toLocaleTimeString([], { hour12: false });
    li.append(time, document.createTextNode(message)); $('log').prepend(li);
    while ($('log').children.length > 35) $('log').lastChild.remove();
  }
  function status(message, type = '') { $('status').textContent = message; $('status').className = `status ${type}`; }
  function metrics(items) {
    $('metrics').replaceChildren();
    items.forEach(([name, value]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = name; dd.textContent = value; $('metrics').append(dt, dd); });
  }
  function invalidate(message = 'Inputs changed. Evaluate flags to see the new decision.') {
    generation++; current = null; $('cached').disabled = true; $('result-badge').textContent = 'No decision';
    $('request').textContent = '{}'; $('response').textContent = '{}'; metrics([]); renderExperience(false, false); status(message);
  }
  function sync() {
    const p = selected(), live = $('mode').value === 'live';
    $('viewer').replaceChildren(); const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.style.background = p.colour; avatar.textContent = p.initials; $('viewer').append(avatar, document.createTextNode(p.name));
    $('profile-summary').replaceChildren(); p.packages.forEach(s => { const span = document.createElement('span'); span.textContent = s; $('profile-summary').append(span); });
    $('profile-json').textContent = JSON.stringify({ user_id: p.id, user_properties: properties(p) }, null, 2);
    $('input-hint').textContent = $('input-mode').value === 'historical' ? 'Live requests omit profile properties. Amplitude must already know this user. Practice uses a separate simulated stored profile.' : 'Send this viewer’s synthetic properties in the evaluation request.';
    $('practice-controls').hidden = live; $('rollback').hidden = live;
    $('mode-banner').textContent = live ? 'LIVE MODE · browser → Amplitude remote evaluation · US region' : 'PRACTICE MODE · simulated decisions · no requests to Amplitude';
    $('mode-banner').classList.toggle('live', live); $('rollout-value').textContent = `${$('rollout').value}%`;
    updateURL();
  }
  const catalogue = {
    popular: [['Southern Skies', 'Documentary · Original demo', '#285165,#9fbcac'], ['The Last Light', 'Drama · Original demo', '#c17952,#422436'], ['Match Day', 'Sport · Original demo', '#407967,#132c3e'], ['Beyond the Coast', 'Adventure · Original demo', '#4b7193,#202f52']],
    Sport: [['Match Day', 'Live sport · Original demo', '#348579,#123c39'], ['Extra Time', 'Sport stories · Original demo', '#db7e43,#542a2c'], ['The Long Run', 'Athletics · Original demo', '#648e9c,#1f3a52'], ['Home Ground', 'Rugby · Original demo', '#8c9250,#293f3b']],
    Movies: [['The Last Light', 'Drama · Original demo', '#c17952,#422436'], ['After the Rain', 'Film · Original demo', '#8696b3,#263454'], ['The Quiet Harbour', 'Mystery · Original demo', '#378887,#143446'], ['Another Tomorrow', 'Sci-fi · Original demo', '#8f70b2,#31244d']],
    Drama: [['Harbour Street', 'Drama · Original demo', '#b38777,#543b4f'], ['A Place Called Home', 'Series · Original demo', '#69a09b,#25434a'], ['Second Chances', 'Drama · Original demo', '#ab7692,#452f50'], ['North of Here', 'Series · Original demo', '#6b8cac,#24394b']],
    Documentary: [['Southern Skies', 'Nature · Original demo', '#285165,#9fbcac'], ['Beyond the Coast', 'Adventure · Original demo', '#4b7193,#202f52'], ['Our Wild Islands', 'Nature · Original demo', '#4a835f,#213a37'], ['Under the Surface', 'Science · Original demo', '#276a87,#172e51']]
  };
  function renderExperience(railOn, promoOn) {
    const p = selected();
    $('rail-title').textContent = railOn ? `Picked for ${p.name}` : 'Popular this week';
    $('rail-label').textContent = railOn ? `NEW RAIL · ${p.genre.toUpperCase()} PICKS` : 'THE CURRENT EXPERIENCE';
    $('experience-badge').textContent = railOn ? 'New rail · on' : 'Default rail';
    $('hero-title').innerHTML = promoOn ? 'Your next favourite<br>starts here.' : 'A little closer<br>to extraordinary.';
    $('hero-label').textContent = promoOn ? `A NEW COLLECTION FOR ${p.name.toUpperCase()}` : 'THIS WEEK ON SKY LAB';
    $('hero-description').textContent = promoOn ? `Explore a curated ${p.genre.toLowerCase()} collection. This promotional message is controlled by your optional second flag.` : 'Discover your next great watch. A fictional streaming experience for the Sky NZ feature flag workshop.';
    $('posters').replaceChildren();
    (railOn ? catalogue[p.genre] : catalogue.popular).forEach(([title, meta, colours]) => {
      const button = document.createElement('button'); button.className = 'poster'; button.setAttribute('aria-label', `Preview ${title}`);
      const art = document.createElement('div'); art.className = 'poster-art'; art.style.setProperty('--poster-bg', `linear-gradient(155deg,${colours})`);
      const small = document.createElement('small'); small.textContent = 'SKY LAB / DEMO'; const strong = document.createElement('strong'); strong.textContent = title;
      art.append(small, strong); const caption = document.createElement('p'); caption.textContent = meta; button.append(art, caption);
      button.addEventListener('click', () => preview(title)); $('posters').append(button);
    });
  }
  // Teaching simulation only. This hash deliberately makes no claim to match Amplitude assignment.
  function demoBucket(userId, flagKey) { let hash = 2166136261; for (const c of `${userId}:${flagKey}`) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return (hash >>> 0) % 100; }
  function simulate(p, key, settings) {
    const matchesPackage = settings.target === 'all' || p.packages.includes(settings.target);
    const matchesEngagement = settings.engagement === 'all' || settings.engagement === p.engagement;
    const bucket = demoBucket(p.id, key);
    const on = settings.enabled && matchesPackage && matchesEngagement && bucket < Number(settings.rollout);
    return { value: on ? 'on' : 'off', payload: { simulated: true, eligible: matchesPackage && matchesEngagement, demo_bucket: bucket } };
  }
  async function analytics(eventType, eventProperties, snapshot) {
    if (!snapshot || !snapshot.live || !snapshot.track || !usable(snapshot.analyticsKey)) return;
    try {
      const res = await fetch('https://api2.amplitude.com/2/httpapi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: snapshot.analyticsKey, events: [{ user_id: snapshot.userId, device_id: `${snapshot.userId}-web`, event_type: eventType, event_properties: eventProperties, time: Date.now(), insert_id: crypto.randomUUID() }] }), signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      log(`Analytics accepted: ${eventType}.`);
    } catch (error) { log(`Analytics failed (${eventType}): ${error.message}. Decision unchanged.`); }
  }
  function setBusy(value) {
    busy = value;
    document.querySelectorAll('.controls input, .controls select, .controls button').forEach(el => { el.disabled = value; });
    $('cached').disabled = value || !current;
    $('evaluate').textContent = value ? 'Evaluating…' : 'Evaluate flags';
  }
  async function evaluate() {
    if (busy) return;
    invalidate('Evaluating…'); sync();
    const p = selected(), s = state(), live = s.mode === 'live';
    const flag = s.flag.trim(), promo = s.promo.trim();
    if (!flag || !/^[a-zA-Z0-9_-]+$/.test(flag) || (promo && !/^[a-zA-Z0-9_-]+$/.test(promo))) { status('Enter a flag key using letters, numbers, underscores or hyphens.', 'error'); return; }
    if (live && !usable($('deployment').value.trim())) { $('connection').open = true; status('Add an approved client deployment key, or select Practice mode. No request was sent.', 'error'); return; }
    const user = { user_id: p.id, device_id: `${p.id}-web` };
    if (s['input-mode'] === 'explicit') user.user_properties = properties(p);
    $('request').textContent = JSON.stringify(user, null, 2);
    const ticket = generation; let result, duration, lookup;
    const keys = [...new Set([flag, promo].filter(Boolean))];
    setBusy(true);
    try {
      const start = performance.now();
      if (!live) {
        result = Object.fromEntries(keys.map(key => [key, simulate(p, key, s)]));
        duration = performance.now() - start; lookup = key => result[key] || { value: 'off' };
        log(`Practice evaluation for ${p.id}; ${s['input-mode'] === 'historical' ? 'simulated stored profile' : 'explicit properties'}; no network.`);
      } else {
        let transportError = null, transportCompleted = false;
        // SDK 1.15.5 fetch() resolves after transport errors. Observe its documented
        // HTTP client boundary so a failure cannot look like a successful 'off'.
        const httpClient = { async request(requestUrl, method, headers, data, timeoutMillis) {
          const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), timeoutMillis || 8000);
          try {
            // Show the actual SDK request, including its library metadata and
            // an empty user_properties object when no properties were supplied.
            const encodedUser = headers['X-Amp-Exp-User'];
            if (encodedUser) {
              const bytes = Uint8Array.from(atob(encodedUser.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
              $('request').textContent = JSON.stringify(JSON.parse(new TextDecoder().decode(bytes)), null, 2);
            }
            const res = await fetch(requestUrl, { method, headers, body: data || undefined, signal: abort.signal });
            const body = await res.text();
            if (res.status !== 200) throw new Error(`Evaluation HTTP ${res.status}. Check the client key and deployment.`);
            const parsed = JSON.parse(body);
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Unexpected evaluation response.');
            transportCompleted = true;
            return { status: res.status, body };
          } catch (error) { transportError = error; throw error; }
          finally { clearTimeout(timer); }
        }};
        // The SDK caches clients by deployment and instance name. A stable
        // delegate lets each fetch observe its own completion and errors.
        activeTransport = httpClient;
        const deployment = $('deployment').value.trim();
        if (!clients.has(deployment)) {
          clients.set(deployment, Experiment.initialize(deployment, {
            instanceName: 'sky-workshop', serverZone: 'us',
            fetchTimeoutMillis: 8000, retryFetchOnFailure: false,
            automaticExposureTracking: false,
            httpClient: { request: (...args) => activeTransport.request(...args) }
          }));
        }
        sdk = clients.get(deployment);
        sdk.clear();
        await sdk.fetch(user, { flagKeys: keys });
        duration = performance.now() - start;
        if (transportError) throw transportError;
        if (!transportCompleted) throw new Error('No completed evaluation response.');
        result = sdk.all(); lookup = key => sdk.variant(key, { value: 'off' });
        log(`Live remote fetch for ${p.id}; ${s['input-mode'] === 'historical' ? 'identity only' : 'identity + properties'}; ${duration.toFixed(1)} ms. Cache hit/miss not inferred.`);
      }
      if (ticket !== generation) return;
      const readStart = performance.now(); const railVariant = lookup(flag), promoVariant = promo ? lookup(promo) : { value: 'off' }; const readMs = performance.now() - readStart;
      current = { result, lookup, flag, promo, duration, live, userId: p.id, track: $('track').checked, analyticsKey: $('api-key').value.trim(), inputMode: s['input-mode'] };
      $('response').textContent = JSON.stringify(result, null, 2);
      renderExperience(railVariant.value === 'on', promoVariant.value === 'on');
      $('result-badge').textContent = live ? 'Live response' : 'Simulated';
      metrics([['Evaluation', live ? 'Remote · Amplitude US' : 'Practice · simulated'], ['Identity', p.id], ['Inputs', s['input-mode'] === 'historical' ? 'Identity only' : 'Identity + properties'], [live ? 'Fetch + SDK processing' : 'Simulation duration', `${duration.toFixed(2)} ms`], ['Cached variant reads', `${readMs.toFixed(3)} ms`], ['Rail variant', railVariant.value || 'off'], ['Promo variant', promo ? (promoVariant.value || 'off') : 'Not configured'], ['Observed at', new Date().toLocaleTimeString()]]);
      const missing = keys.filter(key => !Object.hasOwn(result, key));
      status(missing.length ? `Response received; no returned entry for ${missing.join(', ')}. Default experience shown. Check flag key, deployment, activation and targeting.` : `${live ? 'Live' : 'Practice'} decision applied. Change a rule, then evaluate again to fetch an updated decision.`, missing.length ? '' : 'success');
      for (const key of keys) if (Object.hasOwn(result, key)) void analytics('$exposure', { flag_key: key, variant: lookup(key).value }, current);
    } catch (error) {
      current = null; if (sdk) sdk.clear(); renderExperience(false, false); $('response').textContent = '{}'; $('result-badge').textContent = 'Fetch failed';
      metrics([['Outcome', 'Default experience'], ['Reason', 'Evaluation unavailable']]);
      status(`Could not evaluate: ${error.message} Default experience shown.`, 'error'); log(`Evaluation failed: ${error.message}. Previous user result discarded.`);
    } finally { setBusy(false); }
  }
  function preview(title) {
    if (!current) { status('Evaluate flags before previewing so the action has an assigned identity.'); return; }
    log(`Preview selected: ${title} · ${current.userId}. Fictional content; no video playback.`);
    void analytics('Demo Content Previewed', { title, rail_flag: current.flag, rail_variant: current.lookup(current.flag).value, workshop_dataset: 'sky-ff-v1' }, current);
  }
  fields.forEach(id => $(id).addEventListener(id === 'rollout' ? 'input' : 'change', () => {
    if (busy) return;
    if (id === 'profile') {
      // Every viewer selection starts a fresh evaluation, including revisits.
      // evaluate() clears the previous identity and applies the selected viewer.
      void evaluate();
    } else { invalidate(); sync(); }
  }));
  $('evaluate').addEventListener('click', evaluate);
  $('next-user').addEventListener('click', () => { if (busy) return; $('profile').selectedIndex = ($('profile').selectedIndex + 1) % profiles.length; void evaluate(); });
  $('rollback').addEventListener('click', () => { if (busy || $('mode').value !== 'practice') return; $('enabled').checked = false; sync(); void evaluate(); });
  $('cached').addEventListener('click', () => { if (!current || busy) return; const start = performance.now(); const variant = current.lookup(current.flag); const elapsed = performance.now() - start; log(`Cached variant('${current.flag}') → ${variant.value || 'off'} in ${elapsed.toFixed(3)} ms; no fetch. This reads a stored decision, not a local rule evaluation.`); status('Read the last decision without fetching. Use Evaluate flags after changing a live rule.'); });
  $('copy').addEventListener('click', async () => {
    const link = url().href;
    try { await navigator.clipboard.writeText(link); status('Scenario link copied. Identity and flag keys are included; connection keys are excluded.'); }
    catch { const input = document.createElement('input'); input.value = link; input.setAttribute('aria-label', 'Scenario URL to copy'); $('status').replaceChildren(document.createTextNode('Copy this link: '), input); input.select(); }
  });
  $('save-connection').addEventListener('click', () => {
    const connection = { deploymentKey: $('deployment').value.trim(), analyticsApiKey: $('api-key').value.trim(), track: $('track').checked };
    invalidate('Connection updated. Select Live and evaluate when ready.');
    try { localStorage.setItem(storageKey, JSON.stringify(connection)); log('Public browser connection settings saved locally.'); } catch { log('Storage unavailable. Connection settings apply for this tab only.'); }
  });
  ['deployment', 'api-key', 'track'].forEach(id => $(id).addEventListener('change', () => invalidate('Connection inputs changed. Save connection, then evaluate.')));
  $('watch').addEventListener('click', () => preview('Featured collection'));
  $('more').addEventListener('click', () => $('info').showModal()); $('close-info').addEventListener('click', () => $('info').close());
  sync(); renderExperience(false, false); log('Workshop ready. Feature Flag workshop · Org 74301 · US. Synthetic profiles only.');
  if ($('mode').value === 'practice') void evaluate();
  else status('Live scenario loaded. Check the connection settings, then evaluate.');
})();
