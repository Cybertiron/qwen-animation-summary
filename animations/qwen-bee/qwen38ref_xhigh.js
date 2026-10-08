// Kubelių salelė — bitė tupi ant medžio, sparneliai ima greitai plakti, ji pakyla,
// spirale išskrido ratą aplink medį ir grįžta į tą pačią vietą.
// (visa bitė atskirta nuo lapijos; sparnai — atskira pora su parent: bee;
//  akys švyti; skrydžiu po bitė bėga šešėlis; šilta šviesa ore.)
export default {
    setup(ctx) {
        const { THREE } = ctx;
        // visa bitė = viskas aukščiau lapijos (v>0.707); lapija baigiasi 0.706, kojinės prasideda 0.707
        this.bee = ctx.split(p => p.v > 0.707 && p.u > 0.06 && p.u < 0.64 && p.w > 0.49 && p.w < 0.88, { pivot: [0.35, 0.71, 0.68] });
        // sparnai — šviesiai mėlyni (ta pati spalva kaip vanduo), aukščiau kūno (v>0.912); kairys/dešinys
        this.wingL = ctx.split(p => p.v > 0.912 && p.w > 0.585 && p.w < 0.733 && p.u < 0.34, { pivot: [0.275, 0.915, 0.66], parent: this.bee });
        this.wingR = ctx.split(p => p.v > 0.912 && p.w > 0.585 && p.w < 0.733 && p.u > 0.36, { pivot: [0.425, 0.915, 0.66], parent: this.bee });
        // bitės šešėlis — plonas diskas ties lapijos viršūne
        const top = ctx.at(0.35, 0.706, 0.68);
        this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.30, 24).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x06220a, transparent: true, opacity: 0, depthWrite: false }));
        this.shadow.position.set(top.x, top.y + 0.006, top.z);
        this.shadow.visible = false;
        ctx.extra.add(this.shadow);
        // medžio (orbitos) ašis = bitės ramybės horizontali vieta
        this.cx = this.bee.pivot.x;
        this.cz = this.bee.pivot.z;
        this.oy = this.bee.pivot.y;
        ctx.mats[0].emissive.setHex(0xffe08a);            // tamsios akys — šilta šviesa
    },
    update(ctx) {
        const { e, t, fade, win } = ctx;
        const g = this.bee.group;
        // — viskas pradeda tik ~1.7 s (spausdinimo/ atramų laužymo metu ramu) —
        // sparnai: amplitudė pakyla ir grįžta į 0 (taigi ties e≥6.6 — visiškai ramu, nepriklausomai nuo t)
        const flapAmp = win(e, 1.8, 2.3) * (1 - win(e, 6.05, 6.5));
        const lift = win(e, 2.4, 3.2) * (1 - win(e, 5.8, 6.45));
        const flap = 0.5 * flapAmp * (0.15 + 0.85 * lift) * Math.sin(t * 26);   // dažnis pastovus
        this.wingL.group.rotation.x = -flap;
        this.wingR.group.rotation.x = -flap;
        // — pakilimas: tupimas → startas → skrydis → nusileidimas į tą pačią vietą —
        const squat = 0.045 * (win(e, 2.15, 2.45) * (1 - win(e, 2.75, 3.0)) + win(e, 5.75, 5.95) * (1 - win(e, 6.2, 6.4)));
        const up = 0.88 * win(e, 2.8, 3.5) * (1 - win(e, 5.8, 6.45));
        // — ratai aplink medį: spirale iš, skrydis ore, spirale atgal; baigiasi tiksliai 2π —
        const R = 0.95 * win(e, 2.7, 3.5) * (1 - win(e, 5.8, 6.5));
        const ang = 2 * Math.PI * win(e, 2.6, 6.5);       // 0 → 2π (t. y. 0 = ramybė)
        const dx = Math.sin(ang) * R;
        const dz = -Math.cos(ang) * R;
        const bob = 0.05 * lift * Math.sin(t * 2.2);
        const tilt = 0.09 * lift * Math.sin(t * 2.2 + Math.PI / 2);
        g.position.set(dx, up + bob - squat, dz);
        g.rotation.y = ang;                                // bitė veikia skrydžio kryptimi; 2π ≡ 0
        g.rotation.x = tilt;
        // šešėlis ant lapijos tik skrydžiu (sumažėja, išryškėja, grįžta)
        const shOp = 0.30 * win(e, 2.7, 3.4) * (1 - win(e, 5.9, 6.5)) * fade;
        const shs = 1 - 0.5 * (up / 0.88);
        this.shadow.material.opacity = shOp;
        this.shadow.scale.set(shs, shs, 1);
        this.shadow.visible = shOp > 0.01;
        // akys švyti per visą animaciją, nuslopa prieš pabaigą
        const glow = win(e, 1.9, 2.3) * (1 - win(e, 6.25, 6.6));
        ctx.mats[0].emissiveIntensity = glow * (0.75 + 0.25 * Math.sin(t * 6));
        // šilta šviesa ore skrydžiu; 0 prieš 1.7 s ir nuo 6.6 s
        const inAir = win(e, 3.0, 3.6) * (1 - win(e, 6.3, 6.6));
        ctx.light.color.setHex(0xffd27a);
        ctx.light.position.set(this.cx + dx, this.oy + up + 0.35, this.cz + dz);
        ctx.light.intensity = 1.8 * inAir * fade;
    },
    reset(ctx) {
        ctx.mats[0].emissiveIntensity = 0;
        ctx.light.intensity = 0;
        if (this.shadow) this.shadow.material.opacity = 0;
    },
};
