// Bitutė: sparneliai plazda → pakyla nuo lapijos viršūnės → apskrieja ratą aplink salelę → nusileidžia atgal.
// Naudoja: ctx.split (atskiria bitę nuo lapijos), ctx.extra (sparnai), ctx.light (bitės švytėjimas).
export default {
    setup(ctx) {
        const { THREE } = ctx;
        // Bitė — pati aukščiausia dalis (v > 0.965), atskiriama nuo lapijos viršūnės.
        this.bee = ctx.split(p => p.v > 0.965, { pivot: 'center' });

        // Sparneliai: du plokšti kubeliai, sukami apie ašį žemyn (vyris apačioje).
        const wingGeo = new THREE.BoxGeometry(0.05, 0.28, 0.18);
        const wingMat = new THREE.MeshStandardMaterial({
            color: 0xddeeff, transparent: true, opacity: 0.7, depthWrite: false, roughness: 0.3
        });
        this.wingL = new THREE.Mesh(wingGeo, wingMat);
        this.wingR = new THREE.Mesh(wingGeo, wingMat.clone());
        // Vyris apačioje: perkeliame geometriją taip, kad ašis būtų (0,0,0)
        wingGeo.translate(0, 0.14, 0);
        this.wingL.position.set(-0.12, 0.02, 0);
        this.wingR.position.set(0.12, 0.02, 0);
        ctx.extra.add(this.wingL, this.wingR);

        // Šviesos taškas bitės kūnui (geltona šviesa)
        this.lightOffset = ctx.at(0.5, 0.98, 0.5);
    },
    update(ctx) {
        const { e, t, win, fade, extra } = ctx;
        const bee = this.bee;

        // --- Sparnų plazdėjimas: nuo 1.7 s, sustoja po 6.3 s ---
        const flapOn = win(e, 1.7, 1.9) * (1 - win(e, 6.2, 6.5));
        const flapAngle = flapOn * 0.9 * Math.sin(t * 28);
        this.wingL.rotation.z = flapAngle;
        this.wingR.rotation.z = -flapAngle;
        this.wingL.material.opacity = (0.55 + 0.25 * Math.sin(t * 28)) * flapOn * fade;
        this.wingR.material.opacity = this.wingL.material.opacity;
        this.wingL.visible = flapOn > 0.01;
        this.wingR.visible = flapOn > 0.01;

        // --- Skrydžio trajektorija ---
        // Pakilimas: 1.8–2.6 s, nusileidimas: 5.4–6.2 s
        const lift = win(e, 1.8, 2.6) * (1 - win(e, 5.4, 6.2));
        // Skersinis poslinkis (apskritimas): 2.2–5.6 s
        const orbit = win(e, 2.2, 2.8) * (1 - win(e, 5.0, 5.6));

        // Kampas aplink centrą: 0 → 2π per orbit langą
        const orbitT = ctx.sm((e - 2.2) / 3.4);  // 0..1 per 2.2–5.6 s
        const angle = orbitT * Math.PI * 2;

        // Spindulys: auga orbitui įsibėgėjant
        const radius = 0.55 * orbit;

        // Aukštis: lift * 0.5 + šiek tiek svyruoja skrydyje
        const baseY = lift * 0.45;
        const hoverY = orbit * 0.08 * Math.sin(t * 3.5);

        // Bitės padėtis (offset nuo rest)
        const beeX = radius * Math.sin(angle);
        const beeZ = radius * Math.cos(angle);
        const beeY = baseY + hoverY;

        bee.group.position.set(beeX, beeY, beeZ);

        // Bitė žiūri skrydžio kryptimi (tangentinė kryptis)
        const heading = angle + Math.PI * 0.5;
        bee.group.rotation.y = heading * orbit;

        // Švelnus svyravimas skrydyje
        const sway = orbit * 0.04;
        bee.group.rotation.z = sway * Math.sin(t * 4.2);
        bee.group.rotation.x = sway * 0.5 * Math.sin(t * 3.1);

        // --- Šviesa ---
        const glow = lift * fade;
        ctx.light.color.setHex(0xffe066);
        ctx.light.position.set(beeX, beeY + 0.1, beeZ);
        ctx.light.intensity = glow * 2.5;

        // --- Emissive: bitės kūnas (geltona, colour 3) šviečia skrydyje ---
        const em = lift * (0.4 + 0.2 * Math.sin(t * 5));
        ctx.mats[3].emissive.set(0xffcc00);
        ctx.mats[3].emissiveIntensity = em * fade;
    },
    reset(ctx) {
        ctx.mats[3].emissiveIntensity = 0;
        ctx.mats[3].emissive.set(0x000000);
    },
};
