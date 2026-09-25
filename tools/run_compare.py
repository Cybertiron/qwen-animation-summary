"""
Palyginimas: vienas LLM sukuria animacijas keliems modeliams tomis pačiomis idėjomis.
  python tools/qwen-animation/run_compare.py --tag qwen38 --endpoint http://127.0.0.1:1234/v1
Rezultatai: models/anims/<tag>/<id>.js + models/anims/<tag>/_results.json (bandymai, klaidos, laikas, žetonai).
Peržiūra: python tools/qwen-animation/run_compare.py --page  → models/compare.json → index.php?models=compare&scrub
"""
import argparse
import copy
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ANIMS = ROOT / 'models' / 'anims'

IDEAS = {
    'robot': 'Nuėmus atramas robotas pakelia dešinę ranką aukštyn ir kelis kartus pamojuoja, pakraipo galvą, akys sužiba; pabaigoje nuleidžia ranką.',
    'rocket': 'Užsidega variklis (liepsna apačioje, dūmai ant pagrindo), raketa sudreba, pakyla, pakimba ore ir sklandžiai nusileidžia atgal ant pagrindo.',
    'voxel': 'Bitutė tupi ant medžio lapijos viršūnės (viršutinė modelio dalis, virš lapijos — ją atskirk). Jos sparneliai ima greitai plazdėti, '
             'ji pakyla, apskrenda ratą aplink medį ir nusileidžia atgal į tą pačią vietą.',
    'cactus': 'Kaktusas vazone išsipučia ir sumirga, tada sprogsta: dalys (vazonas, kūnas, rankos, žiedas) išlekia į šonus ir nukrenta ant pagrindo, '
              'o paskui sugrįžta ir susideda atgal.',
}
LABELS = {'claude': 'Claude', 'bonsai': 'Bonsai 2', 'qwen36': 'Qwen 3.6', 'qwen38': 'Qwen 3.8', 'qwen38think': 'Qwen 3.8 thinking', 'qwen38think2': 'Qwen 3.8 thinking v2 (xhigh)', 'qwen38medium': 'Qwen 3.8 thinking medium', 'qwen38low': 'Qwen 3.8 thinking low', 'qwen38xhigh': 'Qwen 3.8 thinking xhigh v3', 'qwen36think': 'Qwen 3.6 thinking', 'qwen36low': 'Qwen 3.6 thinking + low', 'qwen38look': 'Qwen 3.8 medium + akys', 'qwen36look': 'Qwen 3.6 thinking + akys', 'flashnext': 'Flash-Next'}


def run(tag, endpoint, models, rounds, think, max_tokens=None, temperature=None, effort=None, inject=None):
    out = ANIMS / tag
    out.mkdir(parents=True, exist_ok=True)
    res_file = out / '_results.json'
    results = json.loads(res_file.read_text(encoding='utf-8')) if res_file.exists() else {}
    for mid in models:
        t = time.time()
        cmd = [sys.executable, str(HERE / 'qwen_anim.py'), '--model', mid, '--idea', IDEAS[mid], '--endpoint', endpoint,
               '--out-dir', str(out), '--rounds', str(rounds)] + (['--max-tokens', str(max_tokens)] if max_tokens else [])
        cmd += (['--temperature', str(temperature)] if temperature is not None else []) + (['--think'] if think else ['--no-think']) + (['--effort', effort] if effort else []) + (['--inject-effort', inject] if inject else [])
        p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', env={**__import__('os').environ, 'PYTHONIOENCODING': 'utf-8'})
        log = p.stdout + p.stderr
        tokens = sum(int(x) for x in re.findall(r'← (\d+) žetonų', log))
        attempts = len(re.findall(r'^\[\d+\] Qwen rašo', log, re.M))
        ok = p.returncode == 0 and '✓ Išsaugota' in log
        last = log[log.rfind('] Qwen rašo'):] if attempts else log
        warns = sorted(set(re.findall(r'^  ! (.+)$', last, re.M)))
        err = (re.findall(r'Nepavyko: (.+)', log) or [''])[0]
        results[mid] = {'ok': ok, 'attempts': attempts, 'warnings': warns, 'error': err, 'seconds': round(time.time() - t), 'tokens': tokens}
        print(f'{tag:10s} {mid:7s} {"OK " if ok else "FAIL"} bandymai {attempts}  įspėjimai {len(warns)}  {results[mid]["seconds"]} s  {tokens} žet.' + (f'  — {err}' if err else ''))
        (out / f'_{mid}.log').write_text(log, encoding='utf-8')
        res_file.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')


def page():
    """models/compare.json: kiekvienam modeliui — Claude + visi LLM, kurių failai yra."""
    base = {e['id']: e for e in json.loads((ROOT / 'models' / 'models.json').read_text(encoding='utf-8'))}
    base.update({e['id']: e for e in json.loads((ROOT / 'models' / 'models-backup.json').read_text(encoding='utf-8'))})
    tags = [t for t in LABELS if t != 'claude' and (ANIMS / t).is_dir()]
    out = []
    for mid in IDEAS:
        c = copy.deepcopy(base[mid]); c['name'] = {k: f'{v} · Claude' for k, v in c['name'].items()}
        out.append(c)
        for tag in tags:
            if (ANIMS / tag / f'{mid}.js').exists():
                q = copy.deepcopy(base[mid]); q['id'] = f'{mid}-{tag}'
                q['name'] = {k: f'{v} · {LABELS[tag]}' for k, v in q['name'].items()}
                for k in ('fly', 'explode', 'anim', 'wiggle'):
                    q.pop(k, None)
                q['anim'] = f'{tag}/{mid}.js'
                out.append(q)
    (ROOT / 'models' / 'compare.json').write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'models/compare.json: {len(out)} įrašų ({", ".join(LABELS[t] for t in tags)})')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--tag')
    ap.add_argument('--endpoint', default='http://127.0.0.1:1234/v1')
    ap.add_argument('--models', default=','.join(IDEAS))
    ap.add_argument('--rounds', type=int, default=3)
    ap.add_argument('--think', action=argparse.BooleanOptionalAction, default=True)   # numatyta: thinking + low
    ap.add_argument('--page', action='store_true')
    ap.add_argument('--max-tokens', type=int, default=None)
    ap.add_argument('--temperature', type=float, default=None)
    ap.add_argument('--effort', choices=['low', 'medium', 'xhigh'], default=None)
    ap.add_argument('--inject-effort', choices=['low', 'medium', 'xhigh'], default=None)
    a = ap.parse_args()
    if a.tag:
        run(a.tag, a.endpoint, a.models.split(','), a.rounds, a.think, a.max_tokens, a.temperature, a.effort, a.inject_effort)
    if a.page or not a.tag:
        page()
