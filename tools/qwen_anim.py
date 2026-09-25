"""
vietinis Qwen sukuria hero animaciją modeliui.

  (pirma: tools/qwen-animation/start_qwen38.bat — numatytasis modelis Qwen3.8-27B, GPU1, http://127.0.0.1:1234/v1)
  python tools/qwen-animation/qwen_anim.py --model robot --idea "pakelia ranką ir pamojuoja"
  python tools/qwen-animation/qwen_anim.py --model gear --idea "..." --preview      # po to atidaro peržiūrą
  python tools/qwen-animation/qwen_anim.py --model vase --dry-run                   # tik parodo užklausą

Eiga: modelio faktai (dalys, jų gabaritai, Python kūrimo kodas) + SYSTEM_PROMPT.md + pavyzdžiai → Qwen →
kodas → validate.mjs (tikras three.js) → jei klaidos, jos grąžinamos Qwen pataisyti (iki --rounds kartų) →
models/anims/<id>.js + "anim" įrašas models.json (arba models-backup.json) + models/preview.json.
Serveris — bet koks OpenAI suderinamas (llama.cpp llama-server, vLLM, LM Studio, Ollama /v1).
"""
import argparse
import http.client
import json
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent                       # <site folder>
MODELS = ROOT / 'models'
ANIMS = MODELS / 'anims'
MAKE = ROOT / 'tools' / 'make_models.py'
U = 40.0                                        # mm viename modelio vienete (make_models.py)
EXAMPLES = ['robot.js', 'rocket.js']            # patikrinti pavyzdžiai, įdedami į užklausą
sys.path.insert(0, str(HERE))                   # look.py

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


def parse_stl(path):
    data = path.read_bytes()
    if len(data) >= 84:
        n = int.from_bytes(data[80:84], 'little')
        if 84 + n * 50 == len(data):
            rec = np.frombuffer(data, dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]), count=n, offset=84)
            return rec['v'].astype(np.float64)
    v = np.array(re.findall(r'vertex\s+(\S+)\s+(\S+)\s+(\S+)', data.decode('ascii', 'ignore')), dtype=np.float64)
    return v[: len(v) // 3 * 3].reshape(-1, 3, 3)


def find_entry(mid):
    for fn in ('models.json', 'models-backup.json'):
        p = MODELS / fn
        if p.exists():
            for e in json.loads(p.read_text(encoding='utf-8')):
                if e['id'] == mid:
                    return e, p
    raise SystemExit(f'Modelis "{mid}" nerastas models.json / models-backup.json')


def builder_source(mid):
    """Modelio kūrimo funkcija iš make_models.py (koordinatės — modelio vienetais, Y aukštyn)."""
    src = MAKE.read_text(encoding='utf-8')
    m = re.search(r"\(\s*'" + re.escape(mid) + r"',.*?,\s*(\w+)\),\s*\n", src)
    if not m:
        return None
    grab = lambda name: (re.search(r'^def ' + name + r'\(.*?(?=^def |^# ─|^[A-Z_]+ = )', src, re.S | re.M) or [None])[0]
    main_src = grab(m.group(1))
    if not main_src:
        return None
    out = [main_src.rstrip()]
    COMMON = {'rbox', 'cyl', 'ball', 'join', 'at', 'P', 'capsule', 'revolve', 'voxels_to_parts', 'tree_support', 'range', 'len',
              'rotation_matrix', 'translation_matrix', 'zip', 'min', 'max', 'abs', 'sorted', 'tuple', 'list', 'int', 'float'}
    for name in dict.fromkeys(re.findall(r'\b([a-z_]\w*)\(', main_src)):   # viena gylio pakopa: _cactus_vox, voxel_bee …
        if name in COMMON or name == m.group(1):
            continue
        d = grab(name)
        if d and d.count('\n') < 90:
            out.append(d.rstrip())
    return '\n\n\n'.join(out)


def model_facts(entry):
    """Dalių gabaritai modelio vienetais (Y aukštyn, Z į priekį) ir santykinėmis u/v/w koordinatėmis."""
    parts = []
    for i, f in enumerate(entry['parts']):
        tri = parse_stl(MODELS / f).reshape(-1, 3)
        pts = np.c_[tri[:, 0], tri[:, 2], -tri[:, 1]] / U       # STL Z aukštyn → Y aukštyn
        parts.append((i, f, pts.min(0), pts.max(0), len(tri) // 3))
    lo = np.min([p[2] for p in parts], axis=0); hi = np.max([p[3] for p in parts], axis=0); span = np.maximum(hi - lo, 1e-9)
    colors = entry.get('colors', [])
    lines = [f'Model id: {entry["id"]}   name: {entry["name"].get("en")} / {entry["name"].get("lt")}',
             f'Model-unit bounding box (Y up, +Z front): x [{lo[0]:.3f}, {hi[0]:.3f}]  y [{lo[1]:.3f}, {hi[1]:.3f}]  z [{lo[2]:.3f}, {hi[2]:.3f}]',
             f'Real size: {span[0] * U:.1f} × {span[1] * U:.1f} × {span[2] * U:.1f} mm (W × H × D)',
             'Parts (one per filament colour index):']
    for i, f, a, b, n in parts:
        ua, ub = (a - lo) / span, (b - lo) / span
        col = colors[i] if i < len(colors) else colors[0] if colors else '?'
        lines.append(f'  colour {i} ({col}, {(entry.get("materials") or ["PLA"] * 4)[min(i, len(entry.get("materials") or [1]) - 1)]}): {f}, {n} triangles, '
                     f'u [{ua[0]:.2f}, {ub[0]:.2f}]  v [{ua[1]:.2f}, {ub[1]:.2f}]  w [{ua[2]:.2f}, {ub[2]:.2f}]')
    if entry.get('supports'):
        lines.append('Printed with support structures (the host snaps them off at 0.5–1.6 s).')
    named = json.loads((HERE / 'parts.json').read_text(encoding='utf-8')).get(entry['id']) if (HERE / 'parts.json').exists() else None
    if named:                                                  # įvardytos dalys (parts.json) → u/v/w
        lines.append('Named parts (authoritative — use these boxes in split tests. Add a ±0.01 margin ONLY on free sides; '
                     'where a part rests on another one (marked "cut ABOVE"), start the test at the given lower bound, never below it):')
        for q in named:
            box = [(np.array(q[k]) - lo[i]) / span[i] for i, k in enumerate('xyz')]
            col = f', colour {q["colour"]}' if 'colour' in q else ''
            cut = '  ← cut ABOVE: use p.v > ' + f'{box[1][0]:.3f}' + ' with NO margin below' if q.get('contact_below') else ''
            lines.append(f'  {q["name"]}{col}: u [{box[0][0]:.3f}, {box[0][1]:.3f}]  v [{box[1][0]:.3f}, {box[1][1]:.3f}]  w [{box[2][0]:.3f}, {box[2][1]:.3f}]{cut}')
    return '\n'.join(lines)


# Qwen 3.8 šablono mąstymo lygių tekstai — modeliams be reasoning_effort (pvz. Qwen 3.6) galima įterpti ranka (--inject-effort)
EFFORT_TEXT = {
    'low': 'Reasoning effort is set to low. Keep your thinking brief and focused, moving directly to the conclusion without unnecessary elaboration.',
    'medium': '',
    'xhigh': 'Reasoning effort is set to xhigh. Please think carefully through the task, validate key assumptions, consider plausible alternatives, and prioritize correctness, consistency, and clarity in the final answer.',
}


def build_messages(entry, idea, inject=None):
    system = (HERE / 'SYSTEM_PROMPT.md').read_text(encoding='utf-8')
    if inject and EFFORT_TEXT.get(inject):
        system = EFFORT_TEXT[inject] + '\n\n' + system
    for ex in EXAMPLES:
        p = ANIMS / ex
        if p.exists() and ex != f'{entry["id"]}.js':          # to paties modelio sprendimo Qwen nemato
            system += f'\n\n## Verified example: {ex}\n\n```js\n{p.read_text(encoding="utf-8").strip()}\n```'
    src = builder_source(entry['id'])
    user = model_facts(entry)
    if src:
        user += f'\n\nBuilder source (Python, model units, helper P(x,y,z) = Y-up point; rbox(w,h,d,r,x,y,z) = rounded box centred at x,y,z):\n```python\n{src}\n```'
    user += f'\n\nAnimation idea (from the site owner, may be in Lithuanian):\n{idea}\n\nWrite the module now.'
    return [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]


def call_llm(endpoint, api_model, messages, think, max_tokens, temperature, effort=None):
    body = {'model': api_model, 'messages': messages, 'temperature': temperature, 'max_tokens': max_tokens,
            'chat_template_kwargs': {'enable_thinking': think, **({'reasoning_effort': effort} if think and effort else {})}}
    req = urllib.request.Request(endpoint.rstrip('/') + '/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    t = time.time()
    with urllib.request.urlopen(req, timeout=1800) as r:
        res = json.loads(r.read())
    msg = res['choices'][0]['message']
    if think and msg.get('reasoning_content'):
        print(f'  (mąstymas: {len(msg["reasoning_content"])} simbolių)')
    text = msg.get('content') or ''
    usage = res.get('usage', {})
    print(f'  ← {usage.get("completion_tokens", "?")} žetonų per {time.time() - t:.0f} s')
    return text


def pick_model(endpoint):
    try:
        with urllib.request.urlopen(endpoint.rstrip('/') + '/models', timeout=10) as r:
            data = json.loads(r.read())
        if data.get('data'):
            return data['data'][0]['id']
        return data['models'][0].get('model') or data['models'][0]['name']      # llama.cpp / Ollama formatas
    except Exception as e:
        raise SystemExit(f'Nepavyko prisijungti prie {endpoint} ({e}).\nPaleiskite numatytąjį Qwen 3.8: tools\\qwen-animation\\start_qwen38.bat (arba kitą serverį ir nurodykite --endpoint).')


def extract_code(text):
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.S)
    blocks = re.findall(r'```(?:js|javascript|mjs)?\s*\n(.*?)```', text, re.S)
    return (blocks[-1] if blocks else text).strip() + '\n'


def validate(js_path, entry, series=None):
    stls = [str(MODELS / f) for f in entry['parts']]
    extra = ['--series', str(series)] if series else []
    p = subprocess.run(['node', str(HERE / 'validate.mjs'), *extra, str(js_path), *stls], capture_output=True, text=True, encoding='utf-8', cwd=HERE)
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError:
        return {'ok': False, 'errors': [p.stderr.strip() or p.stdout.strip() or 'validatorius nepasileido'], 'warnings': [], 'stats': {}}


def set_anim(entry_file, mid, anim):
    data = json.loads(entry_file.read_text(encoding='utf-8'))
    for e in data:
        if e['id'] == mid:
            e['anim'] = anim
    entry_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    entry = next(e for e in data if e['id'] == mid)
    (MODELS / 'preview.json').write_text(json.dumps([entry], ensure_ascii=False, indent=2), encoding='utf-8')


def ensure_server(port=8077):
    with socket.socket() as s:
        s.settimeout(.5)
        if s.connect_ex(('127.0.0.1', port)) == 0:
            return
    subprocess.Popen([sys.executable, str(HERE / 'serve.py'), str(port)], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', required=True, help='modelio id (models.json arba models-backup.json)')
    ap.add_argument('--idea', default='', help='ką animacija turi daryti (galima lietuviškai)')
    ap.add_argument('--endpoint', default='http://127.0.0.1:1234/v1', help='OpenAI suderinamas serveris')
    ap.add_argument('--api-model', default=None, help='modelio vardas serveryje (numatyta — pirmas iš /v1/models)')
    ap.add_argument('--rounds', type=int, default=3, help='kiek kartų leisti Qwen taisyti klaidas')
    # numatyta: thinking + medium (savininko vertinimu gražiausia; low — greitesnis, bet daro „trumpinius“); --no-think — be mąstymo
    ap.add_argument('--think', action=argparse.BooleanOptionalAction, default=True, help='Qwen „thinking“ režimas (numatyta: įjungtas)')
    ap.add_argument('--effort', choices=['low', 'medium', 'xhigh'], default='medium', help='mąstymo lygis (numatyta: medium; šablono be nurodymo — xhigh)')
    ap.add_argument('--inject-effort', choices=['low', 'medium', 'xhigh'], default=None, help='įterpti Qwen 3.8 lygio tekstą į system (modeliams be reasoning_effort, pvz. Qwen 3.6)')
    ap.add_argument('--max-tokens', type=int, default=None, help='atsakymo riba (numatyta: 20000 su mąstymu, 6000 be)')
    ap.add_argument('--temperature', type=float, default=None, help='numatyta: 1.0 su mąstymu (Qwen rekomendacija), 0.4 be')
    ap.add_argument('--preview', action='store_true', help='atidaryti peržiūrą naršyklėje (localhost:8077, su laiko slankikliu)')
    ap.add_argument('--dry-run', action='store_true', help='tik išspausdinti užklausą')
    ap.add_argument('--look', action=argparse.BooleanOptionalAction, default=True,
                    help='„akys“: po techninės patikros Qwen pamato kadrus + judesio grafiką ir pataiso (reikia serverio su --mmproj)')
    ap.add_argument('--look-rounds', type=int, default=2, help='kiek kartų Qwen gali taisyti pagal tai, ką mato')
    ap.add_argument('--out-dir', default=None, help='išsaugoti čia (pvz. models/anims/qwen) — models.json nekeičiamas (palyginimams)')
    a = ap.parse_args()
    if a.max_tokens is None:
        a.max_tokens = 20000 if a.think else 6000
    if a.temperature is None:
        a.temperature = 1.0 if a.think else 0.4

    entry, entry_file = find_entry(a.model)
    if not a.idea:
        a.idea = 'Choose the most fitting, delightful animation for this object yourself.'
    messages = build_messages(entry, a.idea, a.inject_effort)
    if a.dry_run:
        for m in messages:
            print(f'===== {m["role"]} =====\n{m["content"]}\n')
        return
    api_model = a.api_model or pick_model(a.endpoint)
    print(f'Qwen: {api_model} @ {a.endpoint}  ·  modelis: {a.model}')
    ANIMS.mkdir(exist_ok=True)
    draft = ANIMS / (f'_draft_{a.model}_{Path(a.out_dir).name}.js' if a.out_dir else f'_draft_{a.model}.js')   # lygiagretūs paleidimai nesimuša
    result, best = None, None                                  # best — paskutinis techniškai tvarkingas kodas
    tech_left, look_left = a.rounds, (a.look_rounds if a.look else 0)
    series = ANIMS / f'{draft.stem}.series.json'
    look_dir = ANIMS / '_look' / (Path(a.out_dir).name if a.out_dir else a.model)
    rnd = 1
    print(f'[{rnd}] Qwen rašo animaciją…')
    text = call_llm(a.endpoint, api_model, messages, a.think, a.max_tokens, a.temperature, a.effort)
    while True:
        code = extract_code(text)
        draft.write_text(code, encoding='utf-8')
        result = validate(draft, entry, series)
        for w in result['warnings']:
            print('  ! ' + w)
        if not result['ok'] or result['warnings']:            # 1) techninės klaidos / pastabos → taisymas
            if tech_left <= 0:
                if result['ok']:
                    best = (code, result)
                break
            tech_left -= 1
            problems = result['errors'] + result['warnings']
            print(('  ✗ klaidos: ' if result['errors'] else '  ~ pastabos: ') + '; '.join(result['errors'][:3] or result['warnings'][:3]))
            messages += [{'role': 'assistant', 'content': text},
                         {'role': 'user', 'content': 'The validator (real three.js, same ctx as the site) reported:\n- ' + '\n- '.join(problems)
                          + '\n\nFix these problems. Return the complete corrected module in one ```js block.'}]
        else:                                                  # 2) techniškai tvarkinga → „akys“
            best = (code, result)
            if look_left <= 0:
                break
            look_left -= 1
            try:
                import look
                look_dir.mkdir(parents=True, exist_ok=True)
                frames = look.capture(entry, draft.name, look_dir / 'frames')
                sheet = look.contact_sheet(frames)
                chart, notes = look.motion(series)
                (look_dir / f'r{rnd}_frames.png').write_bytes(sheet)
                (look_dir / f'r{rnd}_motion.png').write_bytes(chart)
                print(f'  👁 kadrai ir judesio grafikas → {look_dir.relative_to(ROOT)}' + (''.join('\n     · ' + n for n in notes)))
                msg = look.review_message(a.idea, sheet, chart, notes)
            except Exception as e:                             # be kadrų (nėra Chrome / serverio) — paliekam kaip yra
                print(f'  (akys nepavyko: {e})')
                break
            messages += [{'role': 'assistant', 'content': text}, msg]
            try:
                rnd += 1
                print(f'[{rnd}] Qwen žiūri į kadrus…')
                text = call_llm(a.endpoint, api_model, messages, a.think, a.max_tokens, a.temperature, a.effort)
            except urllib.error.HTTPError as e:
                print(f'  (serveris nepriima paveikslėlių — paleiskite su --mmproj; {e})')
                break
            if 'LOOKS_GOOD' in text and '```' not in text:
                print('  👁 Qwen: LOOKS_GOOD — atrodo gerai')
                break
            seen = re.sub(r'<think>.*?</think>', '', text, flags=re.S).split('```')[0].strip()
            print('  👁 Qwen mato:' + ''.join('\n     ' + l for l in seen.splitlines()[:6] if l.strip()))
            continue                                           # naujas kodas → vėl patikra
        rnd += 1
        print(f'[{rnd}] Qwen taiso…')
        text = call_llm(a.endpoint, api_model, messages, a.think, a.max_tokens, a.temperature, a.effort)
    if best and (not result or not result['ok'] or result['warnings']):   # paskutinis bandymas blogesnis — grąžinam geriausią
        code, result = best
        draft.write_text(code, encoding='utf-8')
    series.unlink(missing_ok=True)
    if not result or not result['ok']:
        print(f'\nNepavyko: {"; ".join(result["errors"]) if result else "?"}\nJuodraštis paliktas: {draft}')
        sys.exit(1)
    if a.out_dir:                                              # palyginimui: tik failas, models.json nekeičiamas
        out = (ROOT / a.out_dir) if not Path(a.out_dir).is_absolute() else Path(a.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        draft.replace(out / f'{a.model}.js')
        print(f'\n✓ Išsaugota: {(out / f"{a.model}.js")}   statistika: {json.dumps(result["stats"], ensure_ascii=False)}')
        return
    final = ANIMS / f'{a.model}.js'
    if final.exists():
        old = ANIMS / '_old'; old.mkdir(exist_ok=True)
        shutil.copy2(final, old / f'{a.model}.{time.strftime("%Y%m%d-%H%M%S")}.js')
    draft.replace(final)
    set_anim(entry_file, a.model, final.name)
    print(f'\n✓ Išsaugota: {final.relative_to(ROOT)}   ({entry_file.name}: "anim": "{final.name}")')
    print(f'  statistika: {json.dumps(result["stats"], ensure_ascii=False)}')
    url = 'http://localhost:8077/index.php?models=preview&scrub&lang=lt'
    print(f'  Peržiūra: {url}')
    if a.preview:
        ensure_server()
        webbrowser.open(url)


if __name__ == '__main__':
    main()
