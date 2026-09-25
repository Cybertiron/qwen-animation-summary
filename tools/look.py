"""
„Akys“ Qwen'ui: animacijos kadrų tinklelis + judesio grafikas + automatinės pastabos.
Kadrai — capture.mjs (paslėptas Chrome su tikru GPU), judesys — validate.mjs --series.
"""
import base64
import io
import json
import math
import socket
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TIMES = [1.0, 2.2, 3.0, 3.8, 4.6, 5.4, 6.2, 6.9]
PORT = 8079                                      # atskiras nuo vartotojo peržiūros (8077)


def _font(size):
    for f in ('C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/arial.ttf'):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def ensure_server(port=PORT):
    with socket.socket() as s:
        s.settimeout(.5)
        if s.connect_ex(('127.0.0.1', port)) == 0:
            return
    subprocess.Popen([sys.executable, str(HERE / 'serve.py'), str(port)], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)


def capture(entry, anim_rel, workdir):
    """Kadrai: laikinas sąrašas models/__look.json su šiuo modeliu ir tikrinama animacija."""
    e = dict(entry)
    for k in ('fly', 'explode', 'wiggle'):
        e.pop(k, None)
    e['id'] = e['id'] + '-look'
    e['anim'] = anim_rel
    import hashlib
    name = '__look_' + hashlib.sha1(anim_rel.encode()).hexdigest()[:8]
    (ROOT / 'models' / f'{name}.json').write_text(json.dumps([e], ensure_ascii=False), encoding='utf-8')
    ensure_server()
    p = subprocess.run(['node', str(HERE / 'capture.mjs'), '--list', name, '--port', str(PORT), '--out', str(workdir),
                        '--times', ','.join(str(t) for t in TIMES)], capture_output=True, text=True, encoding='utf-8', cwd=HERE, timeout=180)
    res = json.loads(p.stdout.strip().splitlines()[-1])
    if not res.get('ok'):
        raise RuntimeError(res.get('error') or p.stderr[-400:])
    return res['frames']


def contact_sheet(frames):
    """8 kadrai → 4×2 tinklelis su laiko žymomis (viena nuotrauka — mažiau vaizdo žetonų)."""
    W, H = 480, 267
    sheet = Image.new('RGB', (W * 4, H * 2 + 8), (245, 245, 245))
    d = ImageDraw.Draw(sheet)
    font = _font(20)
    for i, f in enumerate(frames):
        im = Image.open(f['file']).convert('RGB')
        w, h = im.size                                   # apkerpam kraštus — 3D scena centre
        im = im.crop((int(w * .18), int(h * .02), int(w * .82), int(h * .92))).resize((W, H))
        x, y = (i % 4) * W, (i // 4) * (H + 8)
        sheet.paste(im, (x, y))
        d.rectangle((x + 6, y + 6, x + 118, y + 34), fill=(255, 90, 31))
        d.text((x + 12, y + 9), f"e={f['e']:.1f}s", fill='white', font=font)
    buf = io.BytesIO(); sheet.save(buf, 'PNG')
    return buf.getvalue()


def motion(series_file):
    """Judesio grafikas + pastabos (greitas sukimasis, netolygus virpesys)."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    d = json.loads(Path(series_file).read_text(encoding='utf-8'))
    names, S = d['names'], d['series']
    t = np.array([s['e'] for s in S])
    V = np.array([s['v'] for s in S])                  # [kadras, objektas, 6]
    notes = []
    n = len(names)
    fig, axs = plt.subplots(n, 2, figsize=(12, 2.1 * n + .6), squeeze=False)
    for j, name in enumerate(names):
        pos, rot = V[:, j, :3], np.degrees(np.unwrap(V[:, j, 3:6], axis=0))
        for k, c in enumerate('xyz'):
            axs[j, 0].plot(t, pos[:, k], label=c)
            axs[j, 1].plot(t, rot[:, k], label=c)
        speed = np.abs(np.gradient(rot, t, axis=0))       # °/s
        fast = speed.max(axis=1) > 720
        if fast.any():
            i0 = np.argmax(fast); i1 = len(fast) - 1 - np.argmax(fast[::-1])
            axs[j, 1].axvspan(t[i0], t[i1], color='red', alpha=.18)
            ang = np.ptp(rot[i0:i1 + 1], axis=0).max() if i1 > i0 else 0
            if ang > 90:                                   # tikras apsisukimas (ne sparnų plazdėjimas)
                notes.append(f'{name}: very fast rotation between e={t[i0]:.1f}s and e={t[i1]:.1f}s (up to {speed.max():.0f}°/s, '
                             f'~{ang:.0f}° turned) — looks like a sudden unnatural spin.')
            else:                                          # greitas virpesys mažu kampu — plazdėjimas
                zc = np.where(np.diff(np.sign(rot[i0:i1 + 1] - rot[i0:i1 + 1].mean(axis=0)), axis=0) != 0)[0]
                hz = len(zc) / 2 / max(t[i1] - t[i0], 1e-6) / 3
                notes.append(f'{name}: fast oscillation ±{ang / 2:.0f}° at ~{hz:.0f} Hz between e={t[i0]:.1f}s and e={t[i1]:.1f}s — '
                             f'fine for insect wings (a blur), too fast to read for bigger parts.')
        for k, c in enumerate('xyz'):                    # netolygus virpesys (kintantis dažnis — „trūkčiojimas“)
            r = rot[:, k] - np.convolve(rot[:, k], np.ones(9) / 9, mode='same')
            r[np.convolve(fast, np.ones(11), mode='same') > 0] = 0      # greito apsisukimo vietos — ne virpesys
            if np.ptp(r) < 6:
                continue
            zc = np.where(np.diff(np.sign(r[5:-5])) != 0)[0]
            if len(zc) > 12 and np.ptp(rot[:, k]) > 10:
                iv = np.diff(t[5:-5][zc])
                if iv.mean() > 0 and iv.std() / iv.mean() > .45:
                    notes.append(f'{name}: rotation.{c} oscillates IRREGULARLY (interval spread {iv.std() / iv.mean():.0%}) — reads as twitching, not a steady flap. Use Math.sin(t * CONSTANT).')
                    break
        for ax in axs[j]:
            ax.axvspan(.5, 1.6, color='grey', alpha=.12)
            ax.axvline(6.6, color='k', ls=':', lw=1)
            ax.grid(alpha=.3); ax.legend(loc='upper left', fontsize=7)
        axs[j, 0].set_ylabel(name, fontsize=8)
    axs[0, 0].set_title('position (scene units) vs e [s]')
    axs[0, 1].set_title('rotation (degrees) vs e [s] — red = faster than 720°/s')
    fig.tight_layout()
    buf = io.BytesIO(); fig.savefig(buf, format='png', dpi=80); plt.close(fig)
    return buf.getvalue(), notes


def data_url(png):
    return 'data:image/png;base64,' + base64.b64encode(png).decode()


def review_message(idea, sheet_png, chart_png, notes):
    text = ('Here is how your animation ACTUALLY looks in the site (frames rendered by the real page), and a chart of how every '
            'part moves over time.\nImage 1: frames at the marked times e (seconds after printing).\n'
            'Image 2: position/rotation curves of the whole model and each split part (grey = supports being removed, dotted = 6.6 s).\n'
            + ('Automatic observations:\n- ' + '\n- '.join(notes) + '\n' if notes else '')
            + f'\nThe owner\'s idea was:\n{idea}\n\n'
            'Look critically, like the site owner would: does each part move as intended? Is any piece left behind, torn off, '
            'intersecting the model, too small a motion to notice, jerky/twitching, or spinning unnaturally fast? Does it end calmly at rest?\n'
            'If it truly looks right, reply with exactly: LOOKS_GOOD\n'
            'Otherwise list the visible problems in 1-5 short lines, then return the complete corrected module in one ```js block.')
    return {'role': 'user', 'content': [
        {'type': 'text', 'text': text},
        {'type': 'image_url', 'image_url': {'url': data_url(sheet_png)}},
        {'type': 'image_url', 'image_url': {'url': data_url(chart_png)}},
    ]}
