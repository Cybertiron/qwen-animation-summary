// Bitutė: po atramų nuėmimo pakyla, sparnai greitai plazda, bitutė apskrenda ratą aplink medį ir nusileidžia atgal ant lapijos.
export default {
    setup(ctx) {
        // visa bitutė (kūnas, akys, antenos, sparnai, kojos): lapijos viršus ties v ≈ 0.706,
        // todėl kirčiame GRIAUTAI virš kontaktinio lygio (v > 0.707) — kojų dugnai lieka lapijoje ir nieko neišskylia
        this.bee = ctx.split(p => p.u > .06 && p.u < .645 && p.w > .485 && p.w < .88 && p.v > .707, { pivot: [.35, .707, .66] });
        // sparnai (tokia pati spalva kaip vanduo, atskiriami tik dėžėmis); v > 0.912 — dugno plokštelės
        // lieka kūno grupėje, tad plazdant neišsiriboja skylė; kiekvienas sparnas aplink savo vidinį pakabą
        this.wL = ctx.split(p => p.u > .065 && p.u < .28 && p.v > .912 && p.w > .585 && p.w < .733, { parent: this.bee, pivot: [.275, .912, .66] });
        this.wR = ctx.split(p => p.u > .42 && p.u < .635 && p.v > .912 && p.w > .585 && p.w < .733, { parent: this.bee, pivot: [.425, .912, .66] });
        // antenos (tamsios, priekio viršuje) — antrinis judesys
        this.ant = ctx.split(p => p.u > .215 && p.u < .485 && p.v > .912 && p.w > .768 && p.w < .823, { parent: this.bee, pivot: [.35, .915, .795] });

        // medžio ašis ir bitutės santykinė padėtis (padėtis visada = nuokrypis nuo ramybės)
        const c = ctx.at(.35, 0, .6815);
        const p0 = ctx.at(.35, .707, .66);
        this.ax = c.x; this.az = c.z;
        this.o0x = p0.x - c.x; this.o0z = p0.z - c.z;
        this.r0 = Math.max(.02, Math.hypot(this.o0x, this.o0z));
        this.a0 = Math.atan2(this.o0x, this.o0z);
    },
    update(ctx) {
        const { e, t, fade, win, lerp } = ctx;
        const env = win(e, 1.7, 1.85) * (1 - win(e, 6.35, 6.6)); // 0 ir e=0, 0 ir e≥6.6

        // pakilimas (prikrovimas → pakilimas) ir nuėjimas
        const up = win(e, 2.05, 2.75) * (1 - win(e, 5.3, 6.05));
        const crouch = win(e, 1.75, 2.0) * (1 - win(e, 2.05, 2.25)); // prieš pakilimą mažai prisėda
        const lift = .85 * up - .05 * crouch;

        // apskridimas: 0 → 1 (pilnas 2π ratas), pradeda pakilus, baigia prieš nusileidimą
        const turn = win(e, 2.35, 5.35);
        const th = this.a0 + 2 * Math.PI * turn;
        const r = lerp(this.r0, .85, up);
        const ox = r * Math.sin(th) - this.o0x;
        const oz = r * Math.cos(th) - this.o0z;

        const g = this.bee.group;
        g.position.set(ox, lift + .03 * up * Math.sin(t * 4.1), oz);
        // bitutė pasukta judėjimo krypčiu ir šiek tiek „įlenkta" į posukį (bank)
        const yaw = win(e, 2.15, 2.7) * (1 - win(e, 5.15, 5.9));
        const bank = win(e, 2.6, 3.2) * (1 - win(e, 4.9, 5.5));
        const pitch = win(e, 2.1, 2.6) * (1 - win(e, 5.5, 6.1));
        g.rotation.set(.22 * pitch + .03 * env * Math.sin(t * 4.1), -Math.PI / 2 * yaw, .3 * bank);

        // sparnai: tupint tylūs, startuodami trumpai sužiba, ore greitai plazda, nusileidus sustoja
        const flap = (win(e, 2.55, 3.1) * (1 - win(e, 5.5, 6.05))) + .3 * crouch;
        const flapA = .5 * flap * (1 + .25 * Math.sin(t * 5.3));
        const ph = t * 42 + .06 * Math.sin(t * 5.3);
        this.wL.group.rotation.z = -flapA * Math.sin(ph);
        this.wR.group.rotation.z = flapA * Math.sin(ph);

        // antenos ore švelniai virpa
        this.ant.group.rotation.x = .1 * env * Math.sin(t * 12.5);
        this.ant.group.rotation.z = .07 * env * Math.sin(t * 8.2 + 1.7);

        // švelnus šilto šviesos dėmesys seka bitutę ore
        ctx.light.color.setHex(0xfff1bd);
        ctx.light.position.set(this.ax + ox, 1.6 + lift, this.az + oz);
        ctx.light.intensity = 2.2 * up * fade;
    },
    reset(ctx) {
        if (ctx.light) ctx.light.intensity = 0;
    },
};
