// Animacijos failo tikrintuvas: paleidžia models/anims/<id>.js su tikru three.js ir tuo pačiu ctx, kaip svetainė.
//   node validate.mjs <anim.js> <part1.stl> [part2.stl ...]
// Išvestis — JSON: { ok, errors[], warnings[], stats }. Klaidos = animacija svetainėje neveiktų.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const argv = process.argv.slice(2), si = argv.indexOf('--series');
const seriesFile = si >= 0 ? argv.splice(si, 2)[1] : null;          // --series <failas.json> — judesio kreivės grafikui
const [animFile, ...stlFiles] = argv;
const series = [];
const errors = [], warnings = [], stats = {};
const done = () => { console.log(JSON.stringify({ ok: !errors.length, errors: [...new Set(errors)], warnings: [...new Set(warnings)], stats }, null, 2)); process.exit(errors.length ? 1 : 0); };

// ── statinė patikra ──
const src = fs.readFileSync(animFile, 'utf8');
const FORBID = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bdocument\./, /\bwindow\./, /localStorage/, /\beval\s*\(/, /new\s+Function\s*\(/,
    /\bimport\s*\(/, /^\s*import\s/m, /\bsetTimeout\b/, /\bsetInterval\b/, /requestAnimationFrame/];
for (const re of FORBID) if (re.test(src)) errors.push(`Draudžiama konstrukcija: ${re}`);
if (!/export\s+default/.test(src)) errors.push('Nėra "export default { ... }"');
const upd = src.slice(src.indexOf('update'));
if (/new\s+THREE\./.test(upd.slice(0, upd.indexOf('reset') > 0 ? upd.indexOf('reset') : undefined))) warnings.push('update() kuria naujus THREE objektus kiekvieną kadrą — perkelkite į setup()');
if (/Math\.random/.test(upd)) warnings.push('Math.random update() viduje — animacija turi priklausyti tik nuo ctx.e / ctx.t');
if (errors.length) done();

// ── scena kaip svetainėje: STL → Y aukštyn → sutalpinta į FIT_H × FIT_W, centre, ant pagrindo ──
const FIT_H = 2.2, FIT_W = 2.5, HOLD = 7;
const loader = new STLLoader();
const geos = stlFiles.map(f => { const b = fs.readFileSync(f); const g = loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); g.rotateX(-Math.PI / 2); return g; });
if (!geos.length) { errors.push('Nenurodyti STL failai'); done(); }
const box0 = new THREE.Box3(); geos.forEach(g => { g.computeBoundingBox(); box0.union(g.boundingBox); });
const sz0 = box0.getSize(new THREE.Vector3()), s = Math.min(FIT_H / sz0.y, FIT_W / Math.max(sz0.x, sz0.z));
const cx = (box0.min.x + box0.max.x) / 2, cz = (box0.min.z + box0.max.z) / 2;
geos.forEach(g => { g.translate(-cx, -box0.min.y, -cz); g.scale(s, s, s); if (!g.attributes.normal) g.computeVertexNormals(); });
const colors = ['#ff5a1f', '#46e5c8', '#ffd166', '#b388ff'];
const mats = colors.map(c => new THREE.MeshStandardMaterial({ color: c }));
const printGroup = new THREE.Group(), modelGroup = new THREE.Group(); printGroup.add(modelGroup);
geos.forEach((g, i) => modelGroup.add(new THREE.Mesh(g, mats[Math.min(i, 3)])));
const extra = new THREE.Group(); printGroup.add(extra);
const light = new THREE.PointLight(0xffffff, 0, 6, 1.5); printGroup.add(light);
const H = sz0.y * s;

function splitTris(geo, test) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, a = [], an = [], b = [], bn = [];
    for (let o = 0; o < P.length; o += 9) {
        const [tp, tn] = test(P, N, o) ? [b, bn] : [a, an];
        for (let k = 0; k < 9; k++) { tp.push(P[o + k]); tn.push(N[o + k]); }
    }
    const mk = (pp, nn) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3)); return g; };
    return [mk(a, an), mk(b, bn)];
}
const clamp01 = x => Math.max(0, Math.min(1, x));
// gabaritas modelio koordinatėmis (ne pasaulio — pagrindas sukasi, setFromObject duotų pasuktą dėžę ir u/w pasislinktų)
const box = new THREE.Box3(); modelGroup.children.filter(o => o.isMesh).forEach(me => { me.geometry.computeBoundingBox(); box.union(me.geometry.boundingBox); });
const size = box.getSize(new THREE.Vector3()).max(new THREE.Vector3(1e-6, 1e-6, 1e-6));
const sm = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const rel = (x, y, z) => ({ x, y, z, u: (x - box.min.x) / size.x, v: (y - box.min.y) / size.y, w: (z - box.min.z) / size.z });
const at = (u, v, w) => new THREE.Vector3(box.min.x + u * size.x, box.min.y + v * size.y, box.min.z + w * size.z);
const splits = [];
const ctx = {
    THREE, H, box, size, group: modelGroup, mats, extra, light, meshes: modelGroup.children.filter(o => o.isMesh), colors, HOLD,
    e: 0, t: 0, dt: 1 / 60, fade: 1, done: false,
    sm, clamp01, lerp: (a, b, k) => a + (b - a) * k, win: (e, a, b) => sm((e - a) / (b - a)), rel, at, _geos: [],
    split(test, opt = {}) {
        // opt.parent — kita dalis: pjaunama iš jos ir pritvirtinama prie jos (pvz. sparnai skraidančios bitutės viduje)
        const par = opt.parent || null, base = par ? par.pivot : new THREE.Vector3();
        const src = par ? par.meshes : modelGroup.children.filter(o => o.isMesh);
        const out = new THREE.Group(), made = [], bb = new THREE.Box3();
        for (const me of src) {
            const [a, b] = splitTris(me.geometry, (P, N, o) => test(rel(base.x + (P[o] + P[o + 3] + P[o + 6]) / 3, base.y + (P[o + 1] + P[o + 4] + P[o + 7]) / 3, base.z + (P[o + 2] + P[o + 5] + P[o + 8]) / 3)));
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
        const tris = made.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
        splits.push({ group: out, tris, pivot: pivot.clone(), parent: !!par });
        if (!tris) warnings.push('ctx.split() neatskyrė nė vieno trikampio — patikrinkite sąlygą (p.u / p.v / p.w)' + (par ? ' (ieškoma tik parent dalyje)' : ''));
        return { group: out, meshes: made, box: bb, pivot };
    },
};
stats.model = { H: +H.toFixed(3), size: size.toArray().map(v => +v.toFixed(3)), parts: geos.length };

// ── paleidimas ──
let A;
try { A = (await import(pathToFileURL(path.resolve(animFile)).href + '?v=' + Date.now())).default; }
catch (err) { errors.push('Failas neįsikelia: ' + err.message); done(); }
if (!A || typeof A.update !== 'function') { errors.push('export default turi turėti update(ctx) funkciją'); done(); }
const matState = () => mats.map(m => m.color.getHexString() + '|' + m.opacity + '|' + m.transparent).join(',');
const mat0 = matState();
try { if (A.setup) A.setup(ctx); } catch (err) { errors.push('setup() klaida: ' + err.message); done(); }
stats.splits = splits.map(q => ({ tris: q.tris, pivot: q.pivot.toArray().map(v => +v.toFixed(3)) }));

const snap = () => {
    const objs = [modelGroup, ...splits.map(q => q.group)];
    return objs.map(o => [...o.position.toArray(), o.rotation.x, o.rotation.y, o.rotation.z, ...o.scale.toArray()]);
};
const rest = snap();
// sukimai lyginami moduliu 2π — apsisukimas 360° atrodo lygiai kaip ramybės padėtis (nereikia „atsukti“ atgal)
const angDiff = d => { const m = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.min(m, 2 * Math.PI - m); };
const diff = (a, b) => Math.max(...a.flatMap((r, i) => r.map((v, k) => k >= 3 && k <= 5 ? angDiff(v - b[i][k]) : Math.abs(v - b[i][k]))));
const bad = v => !Number.isFinite(v);
let t0 = process.hrtime.bigint(), frames = 0, maxMove = 0;
for (let e = 0; e <= 7.0001; e += 1 / 30) {
    Object.assign(ctx, { e: +e.toFixed(4), t: 100 + e, dt: 1 / 30, fade: 1, done: e > 0 });
    try { A.update(ctx); } catch (err) { errors.push(`update() klaida ties e=${e.toFixed(2)}: ${err.message}`); break; }
    frames++;
    const sn = snap();
    if (seriesFile) series.push({ e: +e.toFixed(3), v: sn.map(r => r.slice(0, 6).map(x => +x.toFixed(4))) });
    if (sn.flat().some(bad)) { errors.push(`NaN / Infinity transformacijose ties e=${e.toFixed(2)}`); break; }
    maxMove = Math.max(maxMove, diff(sn, rest));
    let nanExtra = false; extra.traverse(o => { if ([...o.position.toArray(), ...o.scale.toArray()].some(bad)) nanExtra = true; });
    if (nanExtra) { errors.push(`NaN extra objektuose ties e=${e.toFixed(2)}`); break; }
    if (Math.abs(e) < 1e-6) { let v0 = 0; extra.traverseVisible(o => { if (o.isMesh && (!o.material.transparent || o.material.opacity > .02) && o.scale.x * o.scale.y * o.scale.z > 1e-6) v0++; });
        if (v0) errors.push(`Ties e=0 (dar spausdinama) matoma ${v0} extra objektų — jie turi atsirasti tik animacijos metu (obj.visible = amount > 0.01)`); }
    if (Math.abs(e) < 1e-6 && diff(sn, rest) > 1e-3) warnings.push('Ties e=0 (dar spausdinama) modelis ne ramybės padėtyje — spausdinant jis turi stovėti vietoje');
    if (e > 0.3 && e < 1.6 && diff(sn, rest) > 0.02) warnings.push('Modelis juda 0.3–1.6 s — tuo metu nulaužiamos atramos; pradėkite nuo ~1.7 s');
}
stats.frames = frames;
if (seriesFile) fs.writeFileSync(seriesFile, JSON.stringify({ names: ['whole model (ctx.group)', ...splits.map((q, i) => `split #${i + 1}${q.parent ? ' (nested)' : ''}`)], series }));
stats.msPerFrame = +(Number(process.hrtime.bigint() - t0) / 1e6 / Math.max(frames, 1)).toFixed(3);
stats.maxMove = +maxMove.toFixed(3);
if (!errors.length) {
    Object.assign(ctx, { e: 7.0, t: 107 });
    A.update(ctx);
    const d7 = diff(snap(), rest);
    if (d7 > 0.01) warnings.push(`Ties e=7.0 modelis negrįžo į pradinę padėtį (skirtumas ${d7.toFixed(3)}) — pelė ant modelio sustabdo laiką ties 7 s`);
    let vis = 0; extra.traverseVisible(o => { if (o.isMesh && (!o.material.transparent || o.material.opacity > .02) && o.scale.x * o.scale.y * o.scale.z > 1e-6) vis++; });   // tik tikrai matomi (su tėvais)
    if (vis) errors.push(`Ties e=7.0 dar matoma ${vis} extra objektų — efektai turi baigtis iki ~6.6 s. Paslėpkite: obj.visible = amount > 0.01 (amount — jūsų 0→1→0 gaubtinė)`);
    if (light.intensity > .05) warnings.push('Ties e=7.0 ctx.light dar šviečia');
    if (maxMove < 1e-3 && !extra.children.length) warnings.push('Animacija nieko nejudina (maxMove≈0, nėra extra objektų)');
    let meshes = 0; extra.traverse(o => { if (o.isMesh) meshes++; });
    stats.extraMeshes = meshes;
    if (meshes > 300) warnings.push(`Per daug extra objektų (${meshes}) — iki 300`);
    if (stats.msPerFrame > 2) warnings.push(`Lėta: ${stats.msPerFrame} ms kadrui (norma < 2 ms)`);
    if (matState() !== mat0) errors.push('Pakeista ctx.mats spalva / permatomumas — leidžiama keisti tik emissive ir emissiveIntensity');
    try { if (A.reset) A.reset(ctx); } catch (err) { errors.push('reset() klaida: ' + err.message); }
}
done();
