// Bitutė: sparnai pradeda plazdėti, bitutė pakyla, apskrenda ratu aplink medį ir nusileidžia atgal.
export default {
    setup(ctx) {
        // Atskirti visą bitį nuo salos (v > 0.707 — kontakto plokštuma su lapija)
        this.bee = ctx.split(
            p => p.v > 0.707 && p.u > 0.065 && p.u < 0.635 && p.w > 0.49 && p.w < 0.874,
            { pivot: [0.35, 0.707, 0.682] }
        );
        // Kairysis sparnas (parent = bee, nested)
        this.wingL = ctx.split(
            p => p.v > 0.912 && p.u < 0.35 && p.w > 0.58 && p.w < 0.74,
            { pivot: [0.25, 0.912, 0.66], parent: this.bee }
        );
        // Dešinysis sparnas
        this.wingR = ctx.split(
            p => p.v > 0.912 && p.u > 0.35 && p.w > 0.58 && p.w < 0.74,
            { pivot: [0.45, 0.912, 0.66], parent: this.bee }
        );

        // Dulkės nusileidimo metu
        const { THREE } = ctx;
        const dustGeo = new THREE.SphereGeometry(0.025, 6, 4);
        this.dust = [];
        for (let i = 0; i < 10; i++) {
            const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({
                color: 0x7a6540, transparent: true, opacity: 0, depthWrite: false
            }));
            const a = i * 2.39996;
            this.dust.push({ m, born: 5.65 + i * 0.03, dx: Math.cos(a), dz: Math.sin(a) });
            ctx.extra.add(m);
        }
        // Bitės stovėjimo taškas (pasaulio koordinatėse)
        this.standPos = ctx.at(0.35, 0.707, 0.682);
    },
    update(ctx) {
        const { e, t, fade, win } = ctx;
        if (e < 1.7) return;

        // --- Sparnų plakimas ---
        const flapAmp = win(e, 1.7, 2.2) * (1 - win(e, 5.8, 6.4));
        const flapFreq = 10 + 16 * win(e, 2.0, 2.8) * (1 - win(e, 5.4, 6.2));
        const flap = 0.5 * flapAmp * Math.sin(t * flapFreq);
        this.wingL.group.rotation.z = -flap;
        this.wingR.group.rotation.z = flap;

        // --- Anticipacija: mažas pakilimas prieš pakelti ---
        const dip = -0.025 * win(e, 2.0, 2.2) * (1 - win(e, 2.2, 2.35));

        // --- Pakilimas / nusileidimas ---
        const lift = win(e, 2.25, 2.95) * (1 - win(e, 5.3, 6.0));
        const yOff = 0.55 * lift + dip;

        // --- Apšvaivimas aplink medį (vienas ratas) ---
        const orbitT = win(e, 2.7, 5.5);
        const angle = 2 * Math.PI * orbitT;
        const R = 0.48;
        const dx = R * Math.sin(angle);
        const dz = R * (1 - Math.cos(angle));

        // --- Nusileidimo "šokinėjimas" ---
        const landK = 1 - win(e, 5.6, 6.1);
        const bounce = (landK > 0.05 && landK < 0.95) ? 0.02 * Math.abs(Math.sin(landK * Math.PI * 2.5)) * landK : 0;

        this.bee.group.position.set(
            dx * lift,
            yOff + bounce,
            dz * lift
        );

        // --- Pakryvis pakilimo / nusileidimo metu ---
        const ascend = win(e, 2.25, 2.7) * (1 - win(e, 2.9, 3.2));
        const descend = win(e, 5.1, 5.5) * (1 - win(e, 5.8, 6.1));
        this.bee.group.rotation.x = -0.06 * ascend + 0.05 * descend;
        // Lengvas svyravimas ore
        const airWobble = lift * 0.02 * Math.sin(t * 3.1);
        this.bee.group.rotation.z = airWobble;

        // --- Dulkes nusileidimo metu ---
        const sp = this.standPos;
        for (const d of this.dust) {
            const age = e - d.born;
            const life = 0.55;
            const on = age > 0 && age < life;
            d.m.visible = on && fade > 0.01;
            if (!on) continue;
            const k = age / life;
            d.m.position.set(
                sp.x + d.dx * 0.12 * k,
                sp.y + 0.02 + 0.06 * k,
                sp.z + d.dz * 0.12 * k
            );
            d.m.scale.setScalar(1 + 2.5 * k);
            d.m.material.opacity = 0.45 * (1 - k) * fade;
        }

        // --- Minkšta šviesa aplink bitį ore ---
        const glow = win(e, 2.3, 2.8) * (1 - win(e, 5.4, 6.2));
        ctx.light.color.setHex(0xffe8a0);
        ctx.light.position.set(
            this.bee.group.position.x * 0.3,
            yOff + 0.25,
            this.bee.group.position.z * 0.3 + 0.15
        );
        ctx.light.intensity = 2.5 * glow * fade;

        // --- Bitės kūno švytėjimas (geltona) ---
        ctx.mats[3].emissive.set(ctx.colors[3]);
        ctx.mats[3].emissiveIntensity = 0.15 * glow * fade * (0.7 + 0.3 * Math.sin(t * 5));
    },
    reset(ctx) {
        ctx.light.intensity = 0;
        ctx.mats[3].emissiveIntensity = 0;
    }
};
