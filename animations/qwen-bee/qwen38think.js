// Bitutė: sparneliai greitai plazdėja, tupi ant lapijos, pakyla, apskraida ratą aplink medį ir nusileidžia atgal.
export default {
    setup(ctx) {
        // sparnai (geltoni kubeliai, virš kūno — v > .897, kad nenuimtume kūno) — plazdėjimui
        this.wings = ctx.split(p => p.v > .897 && p.v < 1.01 && p.u > .12 && p.u < .56 && p.w > .55 && p.w < .73, { pivot: [.35, .86, .62] });
        // visa bitutė (kūnas + akys + antenos + sparnai + kojos)
        this.bee = ctx.split(p => p.v > .712 && p.u > .13 && p.u < .55 && p.w > .53 && p.w < .88, { pivot: [.35, .84, .68] });
        this.bee.group.rotation.order = 'YXZ'; // yaw → pitch → roll
        // būsena be prisiminimo: bitutės „perkos" vieta (dulkėms) išsaugoma kartą
        this.perch = ctx.at(.35, .71, .68);
        // pakilimo dulkės — gimimo laikas ir kryptis iš anksto (auksinis kampas)
        const THREE = ctx.THREE;
        const dGeo = new THREE.SphereGeometry(.03, 8, 6);
        this.dust = [];
        for (let i = 0; i < 14; i++) {
            const m = new THREE.Mesh(dGeo, new THREE.MeshBasicMaterial({ color: 0xf0e6c8, transparent: true, opacity: 0, depthWrite: false }));
            const a = i * 2.39996;
            this.dust.push({ m, born: 2.4 + i * .02, dx: Math.cos(a), dz: Math.sin(a) });
            ctx.extra.add(m);
        }
    },
    update(ctx) {
        const { e, t, fade, win, lerp, clamp01 } = ctx;
        // --- sparnų plakimas: 1.85–2.15 įsijungia, 5.9–6.4 sustoja (0 ant 6.6 s)
        const flap = win(e, 1.85, 2.15) * (1 - win(e, 5.9, 6.4));
        const fr = lerp(6, 26, clamp01(flap * 1.2));
        const beat = Math.sin(t * fr * Math.PI) * (.25 + .75 * Math.sin(clamp01((e - 1.85) / .5) * Math.PI / 2));
        this.wings.group.rotation.x = .8 * flap * beat;
        // --- trajektorija: tupėjimas → pakilimas → ratas aplink medį → nusileidimas
        const crouch = win(e, 2.0, 2.25) * (1 - win(e, 2.42, 2.55)) * .09;
        const lift = win(e, 2.4, 3.1) * (1 - win(e, 5.4, 6.15));
        const R = .78 * win(e, 3.0, 3.6);
        const loopP = win(e, 3.1, 5.35);          // ratas: 0 → 1
        const th = 2 * Math.PI * loopP;           // kampas ratu
        const home = win(e, 5.35, 6.2);           // nusileidimas: 0 → 1
        const air = win(e, 2.6, 3.2) * (1 - win(e, 5.8, 6.3)); // orinė „sveikata" (vibracijos)
        const tx = R * Math.cos(th), tz = R * Math.sin(th);
        const ty = .42 * lift + .13 * air * Math.sin(2 * th);
        const x = lerp(tx, 0, home), z = lerp(tz, 0, home);
        const bounce = (e > 5.4 && e < 6.6) ? -.05 * Math.sin(((e - 5.4) / .75) * Math.PI) : 0;
        this.bee.group.position.set(x, ty + crouch + bounce, z);
        // kryptis: ratu — tangentiškai (-th), nusileidžiant — grįžta į 0 (matomai be lūžimo)
        const yaw = home > 0 ? 0 : -th;
        this.bee.group.rotation.set(
            .18 * air * (1 - win(e, 2.5, 3.0)) + .1 * air + .03 * lift * Math.sin(t * 5),
            yaw + .02 * air * Math.sin(t * 7),
            .3 * air
        );
        // --- dulkės pakilimo metu (visos numiršta ~3.05 s, prieš 6.6 s)
        const pc = this.perch;
        for (const d of this.dust) {
            const L = .6, age = e - d.born;
            const on = age > 0 && age < L;
            d.m.visible = on && fade > 0;
            if (!on) continue;
            const k = age / L;
            d.m.position.set(pc.x + d.dx * (.1 + .5 * k), pc.y + .1 * k, pc.z + d.dz * (.1 + .5 * k));
            d.m.scale.setScalar(.4 + 1.6 * k);
            d.m.material.opacity = .45 * (1 - k) * fade;
        }
        // --- žolė ant lapio pakvepė nuo sparnų (2-oji spalva, dalinai)
        ctx.mats[1].emissive.setHex(0x9ee46a);
        ctx.mats[1].emissiveIntensity = (flap * (.35 * Math.abs(beat) + .2)) * fade;
        ctx.light.intensity = 0;
    },
    reset(ctx) {
        ctx.mats[1].emissiveIntensity = 0;
    },
};
