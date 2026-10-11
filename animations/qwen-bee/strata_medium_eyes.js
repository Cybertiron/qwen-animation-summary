// Bitutė: sparneliai plazda, ji pakyla, apskrenda ratą aplink salelę ir nusileidžia atgal ant lapijos.
// Sukimui — wrapper grupė ctx.group viduje (ne extra); extra tik švytėjimo kamuoliukai, nematomi iki skrydžio.
export default {
    setup(ctx) {
        // visa bitė: viskas virš lapijos (atramos lūžta virš kontakto plokštumos)
        this.bee = ctx.split(p => p.v > .707, { pivot: [.35, .75, .68] });
        this.wingL = ctx.split(p => p.v > .915 && p.u < .32 && p.w < .755, { parent: this.bee, pivot: [.278, .94, .66] });
        this.wingR = ctx.split(p => p.v > .915 && p.u > .38 && p.w < .755, { parent: this.bee, pivot: [.422, .94, .66] });
        this.ant = ctx.split(p => p.v > .912 && p.w > .755, { parent: this.bee, pivot: [.35, .915, .78] });

        // bitė kabina ant aplink salelės centrą sukamos grupės (wrapper) → tikras ratas aplink medį
        this.wrap = new ctx.THREE.Group();
        this.wrap.add(this.bee.group);
        ctx.group.add(this.wrap);                            // paliekame modelio medyje (ne extra)

        const { THREE } = ctx;
        this.aura = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.core = new THREE.Mesh(new THREE.SphereGeometry(.11, 14, 10),
            new THREE.MeshBasicMaterial({ color: 0xffeab8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.aura.visible = this.core.visible = false;
        ctx.extra.add(this.aura, this.core);

        const B = ctx.at(.36, .86, .68);                       // aureolės vieta ramybės būsenoje (bitės centras)
        this.A = B;                                            // salelės centras = (0,0) → sukimas apie Y
        const r = Math.max(.001, Math.hypot(B.x, B.z)), ux = B.x / r, uz = B.z / r;
        this.ux = ux; this.uz = uz;                            // spindulio kryptis nuo salelės centro
    },
    update(ctx) {
        const { e, t, win, fade } = ctx;
        const flap = win(e, 1.8, 2.2)  * (1 - win(e, 5.6, 6.15));   // sparnai
        const fly  = win(e, 2.3, 2.95) * (1 - win(e, 5.2, 5.85));   // pakylimas / nusileidimas
        const tr   = win(e, 1.7, 1.98) * (1 - win(e, 2.2, 2.45));   // drebulys prieš pakylant
        const turn = win(e, 3.05, 5.25);                            // vienas pilnas ratas
        const th = 2 * Math.PI * turn;

        this.wrap.rotation.y = th;                                  // skrieja ratu aplink salelės centrą

        const bg = this.bee.group;
        const out = .4 * fly;                                       // tolsta nuo centro → spindulys ~0.8
        bg.position.x = this.ux * out + .015 * tr * Math.sin(t * 24);
        bg.position.z = this.uz * out;
        bg.position.y = .55 * fly + .05 * fly * Math.sin(t * 3.0)
                      + .02 * tr * Math.abs(Math.sin(t * 22));
        bg.rotation.z = -.18 * Math.sin(th) * fly;                  // posvyris į posūkį
        bg.rotation.x = .07 * fly * Math.sin(t * 2.0);              // siūbavimas ore
        bg.rotation.y = .06 * fly * Math.sin(t * 1.6);              // lengvas galos pakrypimas

        const amp = .75 * flap * Math.sin(t * 28);                  // sparnų plazdesys (pastovus dažnis)
        this.wingL.group.rotation.z = -amp;
        this.wingR.group.rotation.z =  amp;
        this.ant.group.rotation.x = .14 * flap * Math.sin(t * 9);

        // švytėjimas tik skrydžio metu; iki to ir po — nematoma
        const env = win(e, 2.0, 2.5) * (1 - win(e, 5.0, 5.5));
        const on = env > .01 && fade > 0;
        this.aura.visible = this.core.visible = on;
        if (on) {
            const ox = this.A.x + bg.position.x, oz = this.A.z + bg.position.z;
            const c = Math.cos(th), s = Math.sin(th);
            const x = ox * c + oz * s, z = -ox * s + oz * c;
            const y = this.A.y + bg.position.y;
            const pu = 1 + .10 * Math.sin(t * 10);
            this.aura.position.set(x, y, z); this.core.position.set(x, y, z);
            this.aura.scale.setScalar(pu);   this.core.scale.setScalar(pu);
            this.aura.material.opacity = .18 * env * pu * fade;
            this.core.material.opacity = .26 * env * pu * fade;
            ctx.light.color.setHex(0xffca55);
            ctx.light.position.set(x, y, z);
            ctx.light.intensity = 2.2 * env * pu * fade;
        } else {
            ctx.light.intensity = 0;
        }
    },
};
