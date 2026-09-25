// Voxel salelė: bitutė tupi ant lapijos, plazdėja sparnais, pakyla, apskrenda ratą aplink medį ir nusileidžia.
export default {
    setup(ctx) {
        const { THREE } = ctx;
        // Bitutė — geltona (3-ia) dalis, virš lapijos (v > 0.72). Vyris — jos apačia (v ≈ 0.74).
        this.bee = ctx.split(p => p.v > .72, { pivot: [.35, .74, .68] });
        // Keli blizgesiai aplink bitutę.
        this.sparks = [];
        const g = new THREE.SphereGeometry(.035, 8, 6);
        for (let k = 0; k < 10; k++) {
            const s = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false }));
            const a = k * 2.399;
            this.sparks.push({ m: s, born: 2.6 + k * .16, dx: Math.cos(a), dz: Math.sin(a), dy: .5 + (k % 3) * .35 });
            ctx.extra.add(s);
        }
    },
    update(ctx) {
        const { e, t, fade, win } = ctx;
        const on = e > 1.7;                       // iki 1.7 s — bitutė visiškai neliečiama (nulaužiamos atramos)
        const lift = on ? win(e, 2.4, 3.0) * (1 - win(e, 5.9, 6.4)) : 0;   // pakyla ir nusileidžia
        const buzz = on ? win(e, 2.0, 2.3) * (1 - win(e, 6.0, 6.4)) : 0;   // sparnų plazdėjimas
        const fly  = on ? win(e, 2.6, 3.2) * (1 - win(e, 5.6, 6.3)) : 0;   // skrydžio amplitudė
        const turn = on ? win(e, 2.6, 5.9) : 0;   // 0 → 2π per skrydį (grįžta į pradžią)
        const R = .85, cx = .35, cz = .68;
        const bx = cx + R * Math.sin(turn);
        const bz = cz + R * Math.cos(turn);
        const by = .74 + .55 * lift + .12 * fly * Math.sin(t * 2.6);
        this.bee.group.position.set(bx - cx, by - .74, bz - cz);
        this.bee.group.rotation.y = Math.atan2(cx - bx, cz - bz);
        this.bee.group.position.y += buzz * .018 * Math.sin(t * 46);
        this.bee.group.rotation.z = buzz * .05 * Math.sin(t * 46);
        this.bee.group.rotation.x = buzz * .04 * Math.sin(t * 40) + .12 * lift * Math.sin(t * 2.6);
        // šviesa šilta, seka bitutę
        ctx.light.color.setHex(0xffd873);
        ctx.light.position.set(bx, by + .1, bz);
        ctx.light.intensity = on ? 3.2 * (lift * .6 + buzz * .4) * fade : 0;
        // blizgesiai
        for (const s of this.sparks) {
            const life = .7, age = e - s.born;
            const vis = on && age > 0 && age < life && fade > 0;
            s.m.visible = vis;
            if (!vis) continue;
            const k = age / life;
            s.m.position.set(bx + s.dx * (.1 + .3 * k), by + s.dy * k, bz + s.dz * (.1 + .3 * k));
            s.m.scale.setScalar(.4 + 1.6 * k);
            s.m.material.opacity = .7 * (1 - k) * fade;
        }
    },
    reset(ctx) {
        // nieko papildomo — šviesa ir blizgesiai valdomi tik iš e/t
    },
};
