#!/usr/bin/env python3
"""Generate deck, presenter notes and hub from one timed slide manifest."""
import html, json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
P = ROOT / 'public'
manifest = json.loads((ROOT / 'content/workshop.json').read_text())
esc = html.escape

def shell(title, body):
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(title)} · Sky Lab</title><link rel="stylesheet" href="docs.css"></head><body><header><a class="brand" href="index.html">sky<small>LAB / WORKSHOP</small></a><a href="app.html">Open app ↗</a><a href="handout.html">Exercise guide</a><a href="slides.html">Slides</a></header><main>{body}</main><footer>Sky NZ · Amplitude Feature Flags · Feature Flag workshop · Org 74301 · US region · Synthetic workshop data<br>Static prototype. Live integration requires approved client keys and project setup.</footer></body></html>'''

def agenda():
    return '<div class="table-wrap"><table><thead><tr><th>Session block</th><th>Minutes</th><th>Clock</th></tr></thead><tbody>'+''.join(f'<tr><td>{esc(b["name"])}</td><td>{b["minutes"]}</td><td>{sum(x["minutes"] for x in manifest["blocks"][:i]):02d}–{sum(x["minutes"] for x in manifest["blocks"][:i+1]):02d}</td></tr>' for i,b in enumerate(manifest['blocks']))+'<tr><th>Total</th><th>90</th><td></td></tr></tbody></table></div>'

slides=[]; notes=[]; elapsed=0; names={}; ends={}
for act, block in enumerate(manifest['blocks']):
    names[str(act)] = block['name']; ends[str(act)] = elapsed+block['minutes']
    assert sum(s['minutes'] for s in block['slides']) == block['minutes'], block['name']
    notes.append(f'<section><h2>{esc(block["name"])}</h2><p class="budget">{block["minutes"]} minutes</p>')
    for s in block['slides']:
        num=len(slides)+1
        eyebrow=f'<div class="eyebrow"><span class="dot"></span>Sky NZ / {esc(block["name"])}<span class="mins">{elapsed:02d}–{elapsed+s["minutes"]:02d} min</span></div>'
        slides.append(f'<section class="slide {"ex" if s.get("exercise") else ""}" data-act="{act}" data-title="{esc(s["title"],quote=True)}">{eyebrow}<div class="body"><h2 class="head">{esc(s["title"])}</h2>{s["body"]}</div></section>')
        notes.append(f'<article class="slide-block"><h3><span class="sn">{num}</span><a href="slides.html#{num}">{esc(s["title"])}</a><span class="clock">{elapsed:02d}:00</span></h3><p>{s["notes"]}</p><p class="cut">{s.get("cut", "Keep to the clock and leave time for participants to complete the exercises.")}</p></article>')
        elapsed += s['minutes']
    notes.append('</section>')
assert elapsed == 90
# The workshop template is checked in so regeneration doesn't depend on a personal skill installation.
template=(ROOT/'content/deck-template.html').read_text()
a=template.index('<!-- ═══════════════ SLIDES')
b=template.index('<!-- ═══════════════ END SLIDES')
template=template[:a]+'\n'.join(slides)+'\n'+template[b:]
template=re.sub(r'<link[^>]+>', '', template)
template=re.sub(r'<!--.*?-->', '', template, flags=re.S)
template=template.replace('<title>Deck Template</title>','<title>Sky NZ · Amplitude Feature Flags</title>')
template=template.replace('var ACT_NAMES = { "0": "Frame", "1": "First section", "2": "Hands on" };', 'var ACT_NAMES = '+json.dumps(names)+';')
template=template.replace('var ACT_END   = { "0": 5, "1": 20, "2": 60 };','var ACT_END = '+json.dumps(ends)+';')
template=template.replace('var NO_PREFIX = ["2"];','var NO_PREFIX = '+json.dumps(list(names))+';')
template=template.replace('    if (jump.classList.contains("on") || help.classList.contains("on")) return;\n    if (e.clientX', '    if (jump.classList.contains("on") || help.classList.contains("on") || e.target.closest("a, button, input, select")) return;\n    if (e.clientX')
extra='''<style>:root{--sans:system-ui,-apple-system,"Segoe UI",sans-serif;--disp:var(--sans);--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--accent:#6da9ff;--signal:#71dbcc;--faint:#9caec7}h2.head{font-size:44px;max-width:38ch}.card h3{font-size:25px}.card p{font-size:21px;line-height:1.5}.rows .term{font-size:23px}.rows .def{font-size:22px}.rows li{grid-template-columns:230px 1fr;padding:15px 2px}.caption{font-size:18px;color:#adbbcf}.steps li{font-size:24px}.urlbox a{color:#90bcff;font:23px var(--mono);overflow-wrap:anywhere}.flow{display:flex;align-items:stretch;gap:16px;margin-top:32px}.flow .node{flex:1;padding:23px 20px;border:1px solid #486183;border-radius:10px;background:#152237;font-size:25px;font-weight:650}.flow .node small{display:block;font-size:19px;color:#adbbcf;font-weight:400;margin-top:14px}.flow .arrow{align-self:center;color:#71dbcc;font-size:30px}.compare{border-collapse:collapse;width:100%;margin-top:26px;font-size:23px}.compare td,.compare th{text-align:left;padding:15px 16px;border-bottom:1px solid #34435c}.compare th{color:#8cb7ef}.compare td{color:#d3ddeb}.pill-row .pill{font-size:18px}.source{font-size:14px;margin-top:17px;color:#a5b7d0}.source a{color:#a5b7d0}.code{font-size:22px!important;line-height:1.5!important}h2.head{margin-bottom:12px}.big{font-size:29px;line-height:1.6;color:#becce0;max-width:1000px}#stamp{color:#afbdd0}#jump h3{color:#b8c7dd}.urlbox{padding:16px 20px!important;margin-top:22px!important}</style>'''
template=template.replace('</style>', '</style>'+extra,1)
script='''<script>document.querySelectorAll('.workshop-url').forEach(a=>{a.textContent=location.protocol==='file:'?'Open index.html · workshop hub':new URL('index.html',location.href).href;});</script>'''
(P/'slides.html').write_text('<!doctype html><html lang="en"><head>'+template.split('<div id="viewport">')[0]+'</head><body><div id="viewport">'+template.split('<div id="viewport">',1)[1]+script+'</body></html>')
(P/'demo-script.html').write_text(shell('App demo script', (ROOT/'content/demo-script.html').read_text()))
(P/'talk-track.html').write_text(shell('Presenter notes', '<span class="eyebrow">PRESENTER / 90 MINUTES</span><h1>Run the workshop.</h1><p class="lead">These notes are a floor, not a script. Use your own words; keep the hands-on time intact.</p><p><a href="demo-script.html">Open the spoken app-demo script ↗</a> for the live walkthrough and rollback cues.</p><div class="callout">Start the deck timer with T. O opens the slide menu. F enters full screen. If late, shorten the API explanation and the architecture report-back; retain all three core exercises. The optional promo flag is the final buffer station.</div>'+agenda()+''.join(notes)))
(P/'index.html').write_text(shell('Workshop home', '''<span class="eyebrow">SKY NZ × AMPLITUDE / 90 MINUTES</span><h1>Change the experience.<br>Control the rollout.</h1><p class="lead">Start with what feature flags are, what they control and how evaluation works. Then use a fictional Sky streaming app to target viewers, test a rollout and use stored Amplitude user data.</p><div class="callout"><strong>Start here:</strong> open the app and exercise guide in separate tabs. Practice mode works now. Live mode is connected to the US deployment sky-workshop-web for project Feature Flag workshop. Flags must be created, attached and activated in Amplitude.</div><div class="cards"><a class="card" href="app.html"><span>01 / HANDS ON</span><h2>Open Sky Lab ↗</h2><p>A ready-made streaming interface with synthetic viewers and a decision inspector.</p></a><a class="card" href="handout.html"><span>02 / PARTICIPANTS</span><h2>Follow the exercises ↗</h2><p>Setup, targeting, rollout, rollback and historical user data.</p></a><a class="card" href="slides.html"><span>03 / THE ROOM</span><h2>Open the slides ↗</h2><p>Architecture, latency, experiments, APIs and the future discussion.</p></a><a class="card" href="talk-track.html"><span>04 / PRESENTER</span><h2>Run of show ↗</h2><p>Timed notes, checkpoints and cut points.</p></a><a class="card" href="demo-script.html"><span>05 / DEMO SCRIPT</span><h2>Read the app-demo script ↗</h2><p>Spoken words and actions for targeting, stored user data, caching and rollback.</p></a></div><h2>The session</h2>'''+agenda()+'''<h2>Before the workshop</h2><p>Bring a laptop with a modern browser and permission to create and activate feature flags in the dedicated project. You won’t need to write code. The presenter will seed five fictional viewers in advance.</p><p><a href="setup.html">Presenter setup and rehearsal</a> · <a href="api-examples.html">Programmatic API examples</a> · <a href="sources.html">Technical sources and limitations</a></p>'''))
print(f'Generated {len(slides)} slides and presenter blocks; {elapsed} minutes.')
