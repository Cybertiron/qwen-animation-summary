// Excerpt from the (unreleased) shop website (index.php, three.js r170 hero module): the host side of the animation API.
// `modelGroup`, `printGroup`, `mats`, `HOLD`, `clamp01`, `colorsOf` come from the surrounding hero code.
// Per frame the host does: Object.assign(animCtx, { e, t, dt, fade, done }); anim.update(animCtx);

    function splitTris(geo, test) {
        const P = geo.attributes.position.array, N = geo.attributes.normal.array, a = [], an = [], b = [], bn = [];
        for (let o = 0; o < P.length; o += 9) {
            const [tp, tn] = test(P, N, o) ? [b, bn] : [a, an];
            for (let k = 0; k < 9; k++) { tp.push(P[o + k]); tn.push(N[o + k]); }
        }
        const mk = (pp, nn) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); return g; };
        return [mk(a, an), mk(b, bn)];
    }

    /* ── Išorinės animacijos: models/anims/<id>.js (models.json "anim"). Sąsaja aprašyta tools/qwen-animation/GUIDE.md.
          Failas eksportuoja { setup(ctx), update(ctx), reset(ctx) }; update kviečiamas kiekvieną kadrą. ── */
    // ?scrub — animacijų derinimui: slankiklis nustato, kiek sekundžių praėjo nuo spausdinimo pabaigos
    let scrubE = null;
    if (new URLSearchParams(location.search).has('scrub')) {
        const sc = document.createElement('div');
        sc.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:3;display:flex;gap:.6rem;align-items:center;padding:.45rem .8rem;border:1px solid var(--line);border-radius:10px;background:var(--nav-bg);font:12px JetBrains Mono,monospace';
        sc.innerHTML = '<button type="button" style="font:inherit;cursor:pointer">▶</button><input type="range" min="0" max="7.6" step="0.02" value="0" style="width:min(52vw,420px)"><b style="min-width:4.5em">auto</b>';
        stage.appendChild(sc);
        const [btn, rng, lab] = sc.children;
        rng.addEventListener('input', () => { scrubE = +rng.value; lab.textContent = 'e=' + scrubE.toFixed(2) + 's'; });
        btn.addEventListener('click', () => { scrubE = null; lab.textContent = 'auto'; t0 = performance.now(); pt = 0; doneAt = 0; });
    }
    const animExtra = new THREE.Group(); printGroup.add(animExtra);               // animacijos savi objektai (sukasi su pagrindu)
    const animLight = new THREE.PointLight(0xffffff, 0, 6, 1.5); printGroup.add(animLight);
    const animCache = new Map();
    let anim = null, animCtx = null;
    const loadAnim = f => { if (!animCache.has(f)) animCache.set(f, import('./models/anims/' + f + '?v=' + Date.now()).then(mod => mod.default)); return animCache.get(f); };
    function animReset() {
        if (anim && anim.reset) { try { anim.reset(animCtx); } catch (err) { console.warn('anim reset', err); } }
        if (animCtx) animCtx._geos.forEach(g => g.dispose());
        anim = null; animCtx = null;
        animExtra.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
        animExtra.clear(); animLight.intensity = 0;
        modelGroup.position.set(0, 0, 0); modelGroup.rotation.set(0, 0, 0); modelGroup.scale.setScalar(1);
    }
    function animSetup(A, m) {
        // gabaritas modelio koordinatėmis (ne pasaulio — pagrindas sukasi, setFromObject duotų pasuktą dėžę ir u/w pasislinktų)
        const box = new THREE.Box3(); modelGroup.children.filter(o => o.isMesh).forEach(me => { me.geometry.computeBoundingBox(); box.union(me.geometry.boundingBox); });
        const size = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(1e-6, 1e-6, 1e-6));
        const sm = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
        const rel = (x, y, z) => ({ x, y, z, u: (x - box.min.x) / size.x, v: (y - box.min.y) / size.y, w: (z - box.min.z) / size.z });
        const at = (u, v, w) => new THREE.Vector3(box.min.x + u * size.x, box.min.y + v * size.y, box.min.z + w * size.z);
        const ctx = {
            THREE, H: m.H, box, size, group: modelGroup, mats, extra: animExtra, light: animLight,
            meshes: modelGroup.children.filter(o => o.isMesh), colors: colorsOf(m.def), HOLD,
            e: 0, t: 0, dt: 0, fade: 1, done: false,
            sm, clamp01, lerp: (a, b, k) => a + (b - a) * k, win: (e, a, b) => sm((e - a) / (b - a)), rel, at, _geos: [],
            // atskiria trikampius, kurių centras tenkina test(p) (p.x/y/z — scenos, p.u/v/w — 0…1 modelio gabarite), į atskirą grupę
            split(test, opt = {}) {
                // opt.parent — kita dalis: pjaunama iš jos ir pritvirtinama prie jos (pvz. sparnai skraidančios bitutės viduje)
                const par = opt.parent || null, base = par ? par.pivot : new THREE.Vector3();
                const src = par ? par.meshes : modelGroup.children.filter(o => o.isMesh);
                const out = new THREE.Group(), made = [], bb = new THREE.Box3();
                for (const me of src) {
                    const [a, b] = splitTris(me.geometry, (P, N, o) => test(rel(base.x + (P[o] + P[o + 3] + P[o + 6]) / 3, base.y + (P[o + 1] + P[o + 4] + P[o + 7]) / 3, base.z + (P[o + 2] + P[o + 5] + P[o + 8]) / 3)));
                    ctx._geos.push(a, b);
                    if (!b.attributes.position.count) continue;
                    me.geometry = a;
                    b.translate(base.x, base.y, base.z);                          // → modelio koordinatės
                    const nm = new THREE.Mesh(b, me.material); made.push(nm); b.computeBoundingBox(); bb.union(b.boundingBox);
                }
                const pv = opt.pivot, c = bb.isEmpty() ? new THREE.Vector3() : bb.getCenter(new THREE.Vector3());
                const pivot = Array.isArray(pv) ? at(pv[0], pv[1], pv[2]) : pv && pv.isVector3 ? pv.clone() : bb.isEmpty() ? c
                    : pv === 'top' ? c.setY(bb.max.y) : pv === 'center' ? c : c.setY(bb.min.y);
                // holder stovi vyrio taške; grąžinama grupė viduje — jos ramybės transformacija nulinė,
                // tad position.y = 0.3 pakelia dalį 0.3, o rotation / scale suka ir mastelį keičia apie vyrį
                const holder = new THREE.Group(); holder.position.copy(pivot).sub(base); holder.add(out); (par ? par.group : modelGroup).add(holder);
                made.forEach(nm => { nm.geometry.translate(-pivot.x, -pivot.y, -pivot.z); out.add(nm); });
                return { group: out, meshes: made, box: bb, pivot };
            },
        };
        animCtx = ctx; anim = A;
        if (A.setup) A.setup(ctx);
    }
