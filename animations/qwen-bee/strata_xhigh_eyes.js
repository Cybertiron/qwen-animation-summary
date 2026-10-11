// Bitutė: švelniai plazdo sparnais, pakyla nuo lapijos, apskrieja aplink medį ir nusileidžia atgal.
// Jokių ctx.mats emissive pokyčių.
export default {
    setup(ctx) {
        const THREE = ctx.THREE;

        this.bee = ctx.split(
            p =>
                p.v > .707 &&
                p.u > .069 && p.u < .631 &&
                p.w > .494 && p.w < .865,
            { pivot: [.350, .707, .682] }
        );

        this.wingL = ctx.split(
            p =>
                p.v > .912 &&
                p.u > .069 && p.u < .281 &&
                p.w > .586 && p.w < .733,
            { pivot: [.275, .912, .659], parent: this.bee }
        );

        this.wingR = ctx.split(
            p =>
                p.v > .912 &&
                p.u > .419 && p.u < .631 &&
                p.w > .586 && p.w < .733,
            { pivot: [.425, .912, .659], parent: this.bee }
        );

        this.anchor = ctx.at(.350, .820, .682);

        const glowGeo = new THREE.IcosahedronGeometry(.105, 0);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffee96,
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });

        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.glow.visible = false;
        ctx.extra.add(this.glow);

        this.pollen = [];
        const pollenGeo = new THREE.IcosahedronGeometry(.026, 0);

        for (let k = 0; k < 14; k++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xfff3b8,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            });

            const m = new THREE.Mesh(pollenGeo, mat);
            m.visible = false;
            ctx.extra.add(m);

            const a = k * 2.399963;
            const born = k < 7 ? 2.40 + k * .16 : 5.22 + (k - 7) * .10;

            this.pollen.push({
                m,
                born,
                life: .58,
                dx: Math.cos(a),
                dz: Math.sin(a),
                dy: .80 + (k % 3) * .17,
            });
        }
    },

    update(ctx) {
        const { e, t, fade, win } = ctx;

        // Galutinė ramybė: nuo 6.35 s viskas tiksliai nejudru.
        if (e >= 6.35) {
            this.bee.group.position.set(0, 0, 0);
            this.bee.group.rotation.set(0, 0, 0);
            this.wingL.group.rotation.set(0, 0, 0);
            this.wingR.group.rotation.set(0, 0, 0);

            this.glow.visible = false;
            this.glow.material.opacity = 0;

            for (const p of this.pollen) {
                p.m.visible = false;
                p.m.material.opacity = 0;
            }

            ctx.light.intensity = 0;
            return;
        }

        // Sparnų plazdėjimas: moderatas, nechaotiškas.
        const flap =
            win(e, 1.75, 2.12) *
            (1 - win(e, 5.60, 6.22));

        // Paruošimas.
        const pre =
            win(e, 1.72, 2.02) *
            (1 - win(e, 2.26, 2.68));

        // Skrydis.
        const flight =
            win(e, 2.28, 3.26) *
            (1 - win(e, 5.36, 6.22));

        // Pilnas ratas aplink medį.
        const turn = win(e, 2.38, 5.08);
        const ang = Math.PI * 2 * turn;

        // Spindulys baigiasi kartu su orbita, kad nebūtų staigaus šoninio slydimo.
        const radius =
            .45 *
            win(e, 2.30, 3.10) *
            (1 - win(e, 5.10, 6.16));

        const gx = radius * Math.sin(ang);
        const gz = radius * Math.cos(ang);

        const gy =
            .58 * flight +
            .018 * pre * Math.sin(t * 21);

        const pitch =
            .045 * flight * Math.sin(t * 7.0) +
            .025 * pre * Math.sin(t * 30) -
            .020 * flight;

        const roll = .070 * flight * Math.sin(t * 8.2);

        this.bee.group.position.set(gx, gy, gz);

        // Kampas baigiasi ties 2π; tai yra ramybės orientacija.
        this.bee.group.rotation.set(pitch, ang, roll);

        const wing = .42 * flap * Math.sin(t * 25.0);
        this.wingL.group.rotation.z = -wing;
        this.wingR.group.rotation.z =  wing;

        const glowA =
            win(e, 2.25, 2.75) *
            (1 - win(e, 5.25, 6.05));

        this.glow.position.set(
            this.anchor.x + gx,
            this.anchor.y + gy + .10,
            this.anchor.z + gz
        );
        this.glow.scale.setScalar(.36 + .62 * flight + .08 * flap);
        this.glow.visible = glowA > .02;
        this.glow.material.opacity = .09 * glowA * fade;

        ctx.light.color.setHex(0xffee9d);
        ctx.light.position.set(
            this.anchor.x + gx,
            this.anchor.y + gy + .11,
            this.anchor.z + gz
        );
        ctx.light.intensity = .80 * flight * fade;

        for (const p of this.pollen) {
            const age = e - p.born;
            const on = age > 0 && age < p.life;

            p.m.visible = on && fade > 0;
            if (!on) {
                p.m.material.opacity = 0;
                continue;
            }

            const k = age / p.life;
            const r = .05 + .42 * Math.sqrt(k);

            p.m.position.set(
                this.anchor.x + gx + p.dx * r,
                this.anchor.y + gy + .04 + p.dy * (.20 + .96 * k),
                this.anchor.z + gz + p.dz * r
            );
            p.m.scale.setScalar(.16 + 1.05 * (1 - k));
            p.m.material.opacity = .28 * (1 - k) * fade;
        }
    },

    reset(ctx) {
        if (this.bee) {
            this.bee.group.position.set(0, 0, 0);
            this.bee.group.rotation.set(0, 0, 0);
        }

        if (this.wingL) this.wingL.group.rotation.set(0, 0, 0);
        if (this.wingR) this.wingR.group.rotation.set(0, 0, 0);

        if (this.glow) {
            this.glow.visible = false;
            this.glow.material.opacity = 0;
        }

        if (this.pollen) {
            for (const p of this.pollen) {
                p.m.visible = false;
                p.m.material.opacity = 0;
            }
        }

        ctx.light.intensity = 0;
    },
};
