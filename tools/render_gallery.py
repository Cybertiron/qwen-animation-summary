"""Galerijai: kadrų tinklelis (8 momentai) + judesio grafikas jau išsaugotai animacijai.
  python tools/qwen-animation/render_gallery.py --model voxel --out <aplankas> gsqrco qwen38ref ...
Kiekvienam tag'ui: models/anims/<tag>/<model>.js → <out>/<tag>-frames.png, <tag>-motion.png, <tag>-notes.json
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import look                      # noqa: E402
import qwen_anim                 # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--model', default='voxel')
ap.add_argument('--out', required=True)
ap.add_argument('tags', nargs='+')
a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
entry, _ = qwen_anim.find_entry(a.model)
for tag in a.tags:
    js = qwen_anim.ANIMS / tag / f'{a.model}.js'
    with tempfile.TemporaryDirectory() as td:
        series = Path(td) / 'series.json'
        res = qwen_anim.validate(js, entry, series)
        frames = look.capture(entry, f'{tag}/{a.model}.js', Path(td) / 'frames')
        (out / f'{tag}-frames.png').write_bytes(look.contact_sheet(frames))
        chart, notes = look.motion(series)
        (out / f'{tag}-motion.png').write_bytes(chart)
        (out / f'{tag}-notes.json').write_text(json.dumps({'validator_ok': res.get('ok'), 'warnings': res.get('warnings', []), 'notes': notes}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(tag, 'ok', 'warnings', len(res.get('warnings', [])))
