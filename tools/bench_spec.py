"""
Spekuliacinio dekodavimo greičio testas (GPU1): be spekuliacijos / MTP / DFlash / DSpark.
  python tools/qwen-animation/bench_spec.py
Kiekvienai konfigūracijai: paleidžia llama-server, 2 užduotys × 2 kartai (kodas be mąstymo, mąstymas),
matuoja generavimo greitį (t/s) ir kiek juodraščio žetonų priimta. Rezultatai → bench_spec.json.
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

LLAMA = r'C:\AI2\llama\llama-server.exe'
Q36 = r'C:\AI\llama\Qwen3.6-27B-UD-Q4_K_XL.gguf'
Q38 = r'C:\AI2\models\Qwen3.8-27B\Qwen3.8-27B-UD-IQ4_XS.gguf'
CONFIGS = [
    ('Qwen 3.6 · be spekuliacijos', Q36, []),
    ('Qwen 3.6 · MTP n4', Q36, ['--spec-type', 'draft-mtp', '--spec-draft-n-max', '4']),
    ('Qwen 3.6 · DFlash', Q36, ['--spec-type', 'draft-dflash', '-md', r'C:\AI\llama\Qwen3.6-27B-DFlash-Q8_0.gguf', '-ngld', '99']),
    ('Qwen 3.8 · be spekuliacijos', Q38, []),
    ('Qwen 3.8 · MTP n4', Q38, ['--spec-type', 'draft-mtp', '--spec-draft-n-max', '4']),
    ('Qwen 3.8 · DFlash2', Q38, ['--spec-type', 'draft-dflash', '-md', r'C:\AI2\models\Qwen3.8-27B\Qwen3.8-27B-DFlash2-Q8_0.gguf', '-ngld', '99']),
    ('Qwen 3.8 · DSpark', Q38, ['--spec-type', 'draft-dspark', '-md', r'C:\AI\llama\Qwen3.8-27B-DSpark-Q8_0.gguf', '-ngld', '99']),
]
DF36 = ['--spec-type', 'draft-dflash', '-md', r'C:\AI\llama\Qwen3.6-27B-DFlash-Q8_0.gguf', '-ngld', '99']
MTP = ['--spec-type', 'draft-mtp']
CONFIGS_N = [
    ('Qwen 3.6 · DFlash n7', Q36, DF36 + ['--spec-draft-n-max', '7']),       # DFlash — tik n7 (be rakto numatyta n3)
    ('Qwen 3.8 · MTP n4', Q38, MTP + ['--spec-draft-n-max', '4']),
    ('Qwen 3.8 · MTP n5', Q38, MTP + ['--spec-draft-n-max', '5']),
    ('Qwen 3.8 · MTP n6', Q38, MTP + ['--spec-draft-n-max', '6']),
]
PMIN = ['--spec-draft-p-min', '0.6']                              # juodraštis sustoja, kai modelis nebetikras
CONFIGS_P = [
    ('Qwen 3.6 · DFlash n7 + p-min 0.6', Q36, DF36 + ['--spec-draft-n-max', '7'] + PMIN),
    ('Qwen 3.8 · MTP n6 + p-min 0.6', Q38, MTP + ['--spec-draft-n-max', '6'] + PMIN),
    ('Qwen 3.8 · MTP n4 + p-min 0.6', Q38, MTP + ['--spec-draft-n-max', '4'] + PMIN),
]
CONFIGS_P2 = [(f'Qwen 3.8 · MTP n4 + p-min {pm}', Q38, MTP + ['--spec-draft-n-max', '4', '--spec-draft-p-min', pm]) for pm in ('0.6', '0.65', '0.7')] +              [(f'Qwen 3.6 · DFlash n7 + p-min {pm}', Q36, DF36 + ['--spec-draft-n-max', '7', '--spec-draft-p-min', pm]) for pm in ('0.6', '0.65', '0.7')]
DF38 = ['--spec-type', 'draft-dflash', '-md', r'C:\AI2\models\Qwen3.8-27B\Qwen3.8-27B-DFlash2-Q8_0.gguf', '-ngld', '99']
CONFIGS_D2 = [(f'Qwen 3.8 · DFlash2 n{n} + p-min 0.65', Q38, DF38 + ['--spec-draft-n-max', n, '--spec-draft-p-min', '0.65']) for n in ('3', '4', '7')] +              [('Qwen 3.8 · MTP n4 + p-min 0.65 (atskaita)', Q38, MTP + ['--spec-draft-n-max', '4', '--spec-draft-p-min', '0.65'])]
CONFIGS_D3 = [(f'Qwen 3.8 · DFlash2 n7 + p-min {pm}', Q38, DF38 + ['--spec-draft-n-max', '7', '--spec-draft-p-min', pm]) for pm in ('0.6', '0.65', '0.7')]
DSP = ['--spec-type', 'draft-dspark', '-md', r'C:\AI\llama\Qwen3.8-27B-DSpark-Q8_0.gguf', '-ngld', '99', '--spec-draft-n-max', '7']
CONFIGS_DS = [(f'{m} · DSpark n7 + p-min {pm}', q, DSP + ['--spec-draft-p-min', pm]) for m, q in (('Qwen 3.6', Q36), ('Qwen 3.8', Q38)) for pm in ('0.65', '0.7')]
CODE = ('Write a complete three.js ES module that animates a voxel bee: split wings, flap them with Math.sin, '
        'fly an orbit around a tree with smooth easing and land. Only code, about 60 lines.')
THINK = 'A bee sits on a voxel tree. Plan step by step how to animate its wings and a circular flight in three.js, with timing in seconds.'
PORT = 1236


def post(body):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/v1/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())


def run(name, model, extra):
    log = open(Path(os.environ['TEMP']) / 'bench_spec_server.log', 'w')
    args = [LLAMA, '-m', model, '-ngl', '99', '-c', '16384', '-fa', 'on', '-ctk', 'q8_0', '-ctv', 'q8_0', '--parallel', '1',
            '--no-warmup', '--jinja', '--top-p', '0.95', '--top-k', '20', '--min-p', '0', '--port', str(PORT)] + extra
    srv = subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT, env={**os.environ, 'CUDA_VISIBLE_DEVICES': '1'})
    out = {'name': name}
    try:
        for _ in range(120):
            try:
                if b'ok' in urllib.request.urlopen(f'http://127.0.0.1:{PORT}/health', timeout=2).read():
                    break
            except Exception:
                pass
            if srv.poll() is not None:
                out['error'] = 'serveris neužsikrovė'
                return out
            time.sleep(1)
        for task, prompt, think, n in (('kodas', CODE, False, 700), ('mąstymas', THINK, True, 1500)):
            speeds, acc = [], []
            for _ in range(2):
                d = post({'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': n, 'temperature': 1.0,
                          'chat_template_kwargs': {'enable_thinking': think}})
                tm = d.get('timings', {})
                speeds.append(tm.get('predicted_per_second', 0))
                if tm.get('draft_n'):
                    acc.append(tm['draft_n_accepted'] / tm['draft_n'])
            out[task] = {'tps': round(sum(speeds) / len(speeds), 1), 'accept': round(sum(acc) / len(acc), 2) if acc else None}
    except Exception as e:
        out['error'] = str(e)[:200]
    finally:
        srv.terminate()
        try:
            srv.wait(20)
        except subprocess.TimeoutExpired:
            srv.kill()
        time.sleep(2)
    return out


if __name__ == '__main__':
    import sys
    which = CONFIGS_DS if '--ds' in sys.argv else CONFIGS_D3 if '--d3' in sys.argv else CONFIGS_D2 if '--d2' in sys.argv else CONFIGS_P2 if '--p2' in sys.argv else CONFIGS_P if '--p' in sys.argv else CONFIGS_N if '--n' in sys.argv else CONFIGS   # --n: ilgis, --p / --p2: p-min
    results = []
    for c in which:
        r = run(*c)
        results.append(r)
        print(json.dumps(r, ensure_ascii=False), flush=True)
    (Path(__file__).parent / ('bench_spec_ds.json' if '--ds' in sys.argv else 'bench_spec_d3.json' if '--d3' in sys.argv else 'bench_spec_d2.json' if '--d2' in sys.argv else 'bench_spec_p2.json' if '--p2' in sys.argv else 'bench_spec_p.json' if '--p' in sys.argv else 'bench_spec_n.json' if '--n' in sys.argv else 'bench_spec.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
