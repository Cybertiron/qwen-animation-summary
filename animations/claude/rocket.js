// Raketa: užsidega variklis → pakyla → pakimba ore → grįžta ir nusileidžia (kaip „Falcon“).
// Naudoja: ctx.group (visas modelis), ctx.extra (liepsna ir dūmai), ctx.light (liepsnos šviesa).
export default {
    setup(ctx) {
        const { THREE } = ctx;
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0, depthWrite: false });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0, depthWrite: false });
        this.flame = new THREE.Mesh(new THREE.ConeGeometry(.16, .7, 20, 1, true).rotateX(Math.PI).translate(0, -.35, 0), flameMat);
        this.core = new THREE.Mesh(new THREE.ConeGeometry(.08, .4, 16, 1, true).rotateX(Math.PI).translate(0, -.2, 0), coreMat);
        ctx.extra.add(this.flame, this.core);
        // dūmų kamuoliukai: gimimo laikas ir kryptis iš anksto (animacija priklauso tik nuo laiko → nėra būsenos)
        this.puffs = [];
        const puffGeo = new THREE.SphereGeometry(.12, 12, 8);
        for (let k = 0; k < 28; k++) {
            const m = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color: 0xd8dadf, roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
            const a = k * 2.399;                                     // „auksinis kampas“ — tolygiai į visas puses
            this.puffs.push({ m, born: k < 14 ? 1.8 + k * .12 : 4.9 + (k - 14) * .07, dx: Math.cos(a), dz: Math.sin(a) });
            ctx.extra.add(m);
        }
    },
    update(ctx) {
        const { e, t, fade, win } = ctx;
        const up = win(e, 2.4, 3.6) * (1 - win(e, 4.6, 5.9));        // 0 → 1 → 0
        const hover = win(e, 3.2, 3.8) * (1 - win(e, 4.4, 4.8));
        const shake = e > 1.8 && e < 2.5 ? .012 * Math.sin(t * 90) : 0;   // dreba prieš pakilimą
        const y = .9 * up;
        ctx.group.position.set(shake, y, 0);
        ctx.group.rotation.z = .05 * hover * Math.sin(t * 2.2);
        ctx.group.rotation.x = .04 * hover * Math.sin(t * 1.7);

        const thrust = e > 1.8 && e < 6.0 ? win(e, 1.8, 2.2) * (1 - win(e, 5.8, 6.0)) : 0;
        const fl = thrust * (1 + .18 * Math.sin(t * 47) + .1 * Math.sin(t * 83));
        for (const o of [this.flame, this.core]) {
            o.position.set(ctx.group.position.x, y + .02, 0);
            o.scale.set(1, Math.max(.001, fl * (1 + .6 * (1 - up))), 1);   // prie žemės liepsna ilgesnė
            o.material.opacity = Math.min(1, thrust * 1.4) * fade * (o === this.core ? 1 : .85);
            o.visible = thrust > .01;
        }
        ctx.light.color.setHex(0xff9a3c);
        ctx.light.position.set(0, y - .2, 0);
        ctx.light.intensity = 6 * fl * fade;

        for (const p of this.puffs) {
            const life = p.born < 4 ? 1.5 : .8, age = e - p.born;      // viskas baigiasi iki ~6,6 s (pelė ant modelio sustabdo laiką ties 7 s)
            const on = age > 0 && age < life;
            p.m.visible = on && fade > 0;
            if (!on) continue;
            const k = age / life, r = .15 + 1.1 * Math.sqrt(k);
            p.m.position.set(p.dx * r, .06 + .25 * k, p.dz * r);
            p.m.scale.setScalar(.5 + 2.2 * k);
            p.m.material.opacity = .55 * (1 - k) * fade;
        }
    },
};
