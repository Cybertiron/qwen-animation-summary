"""
Bitutės variantų galerija ataskaitai: kiekvienam — 8 kadrų tinklelis (tikras puslapis, paslėptas Chrome)
ir judesio grafikas (validate.mjs --series). Rezultatas → <out>/images/*.png + notes.json.
  python tools/qwen-animation/make_gallery.py C:/AI/qwen-animation-summary
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import look  # noqa: E402

VARIANTS = [   # tag, compare.json id, kadrų laikai (problema matosi būtent jose)
    ('claude', 'voxel', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
    ('qwen38-no-thinking', 'voxel-qwen38', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
    ('qwen38-xhigh-v1', 'voxel-qwen38think', [1.0, 2.3, 3.0, 3.4, 4.2, 4.6, 5.4, 6.9]),
    ('qwen38-xhigh-v2', 'voxel-qwen38think2', [1.0, 2.2, 3.0, 3.8, 4.4, 5.4, 6.2, 6.9]),
    ('qwen38-xhigh-v3', 'voxel-qwen38xhigh', [1.0, 2.2, 3.0, 3.6, 4.2, 5.0, 6.2, 6.9]),
    ('qwen38-medium', 'voxel-qwen38medium', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
    ('qwen38-low', 'voxel-qwen38low', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
    ('qwen36-thinking', 'voxel-qwen36think', [1.0, 2.2, 3.0, 3.8, 4.6, 4.9, 5.0, 5.1]),
    ('qwen36-inject-low', 'voxel-qwen36low', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
    ('qwen38-medium-eyes', 'voxel-qwen38look', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
    ('qwen36-eyes', 'voxel-qwen36look', [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]),
]


def main(out):
    out = Path(out); img = out / 'images'; img.mkdir(parents=True, exist_ok=True)
    entries = {e['id']: e for e in json.loads((ROOT / 'models' / 'compare.json').read_text(encoding='utf-8'))}
    notes = {}
    look.ensure_server()
    for tag, eid, times in VARIANTS:
        e = dict(entries[eid])
        (ROOT / 'models' / f'__g_{tag.replace("-", "_")}.json').write_text(json.dumps([e], ensure_ascii=False), encoding='utf-8')
        work = img / '_frames' / tag
        p = subprocess.run(['node', str(HERE / 'capture.mjs'), '--list', f'__g_{tag.replace("-", "_")}', '--port', str(look.PORT),
                            '--out', str(work), '--times', ','.join(map(str, times))], capture_output=True, text=True, encoding='utf-8', cwd=HERE, timeout=240)
        res = json.loads(p.stdout.strip().splitlines()[-1])
        if not res.get('ok'):
            print(tag, 'KLAIDA', res.get('error')); continue
        (img / f'{tag}-frames.png').write_bytes(look.contact_sheet(res['frames']))
        (ROOT / 'models' / f'__g_{tag.replace("-", "_")}.json').unlink()
        n = []
        if e.get('anim'):                                        # Qwen animacija — judesio grafikas
            series = img / '_frames' / f'{tag}.series.json'
            stls = [str(ROOT / 'models' / f) for f in e['parts']]
            subprocess.run(['node', str(HERE / 'validate.mjs'), '--series', str(series), str(ROOT / 'models' / 'anims' / e['anim']), *stls],
                           capture_output=True, text=True, encoding='utf-8', cwd=HERE)
            chart, n = look.motion(series)
            (img / f'{tag}-motion.png').write_bytes(chart)
        notes[tag] = n
        print(tag, 'ok', '; '.join(n))
    (out / 'notes.json').write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1])
