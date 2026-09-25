// Bitutė: sparneliai ima greitai plakti, bitė pakyla, skrieda ratu aplink medį ir nusileidžia į tą pačią vietą.
export default {
    setup(ctx) {
        // Poilsio padėties centras (vyris) — bitės kūno viduryje, tiksliai per ctx.at
        this.A = ctx.at(.35, .8235, .682);
        this.R = .72;                                  // skrydžio rato spindulys (scenos vienetai)
        this.lift = ctx.at(.35, 1.01, .682).y - this.A.y;  // pakilimo aukštis (~0.41)

        // 1) visa bitė — STYGUIAI AUKŠTAIJAU lapijos (v>0.707, be paklaidos apačioje)
        this.bee = ctx.split(p =>
            p.v > .707 && p.u >= .07 && p.u <= .63 && p.w >= .49 && p.w <= .87,
            { pivot: [.35, .8235, .682] });

        // 2) sparnai — iškarpomi IŠ bitės (parent), vyris — prie kūno krašto (apačia, v=.912)
        this.wL = ctx.split(p => p.u < .35, { pivot: [.255, .912, .66], parent: this.bee });
        this.wR = ctx.split(p => p.u >= .35, { pivot: [.445, .912, .66], parent: this.bee });
    },

    update(ctx) {
        const { e, t, win } = ctx;
        if (e < 1.7) return;   // spausdymas / atramų nulaužimas — bitė lieka nepaliesta

        const takeoff = win(e, 2.1, 3.05);
        const land    = win(e, 4.85, 5.8);
        const flight  = Math.min(1, takeoff * (1 - land));

        // --- skrydis: spirale išorėn → vienas ratas aplink medį → spirale į vidų ir žemyn
        if (flight > 1e-4) {
            const p = Math.max(0, Math.min(1, (e - 2.1) / 3.7));
            const th = 6.2832 * (p + .05 * Math.sin(6.2832 * p));   // tiksliai 2π per visą skrydį
            const rr = this.R * Math.min(takeoff * takeoff * (3 - 2 * takeoff),
                                         1 - land * land * (3 - 2 * land));
            const liftE = Math.max(takeoff * takeoff * (3 - 2 * takeoff), 1 - land);
            const y = this.lift * liftE * (1 + .06 * flight * Math.sin(t * 5.3));
            this.bee.group.position.set(
                rr * Math.cos(th) + .025 * flight * Math.sin(t * 7.1),
                y,
                rr * Math.sin(th) + .025 * flight * Math.sin(t * 6.3 + 1.7));
            // galvos į skrydžio kryptį + pasvirimas į posūkį, pakilimo / leiskimosi kėlenos
            this.bee.group.rotation.y = -th + .1 * flight * Math.sin(t * 3.1);
            this.bee.group.rotation.x = -.32 * (takeoff - land) + .05 * flight * Math.sin(t * 4.2);
            this.bee.group.rotation.z = .22 * flight;
        } else {
            // po skrydžio (ir iki 1.7 s) — TIKSLIAI nuliniai vektorius, kad e≥6.6 modelis būtų ramybėje
            this.bee.group.position.set(0, 0, 0);
            this.bee.group.rotation.set(0, 0, 0);
        }

        // --- sparnų plakimas: ramybė → įkarštis prieš pakilimą → greitas ore → slopstantis po nusileidimo
        const amp = .32 * win(e, 1.7, 2.15) * (1 - win(e, 6.05, 6.45));
        const fast = flight * (.55 + .12 * Math.sin(t * 2.7));
        const A = amp + fast + (flight > 0 && e > 5.8 ? .22 * Math.exp(-2.8 * (e - 5.8)) : 0);
        const F = Math.sin(t * (9 + 16 * flight));
        this.wL.group.rotation.z = -A * F;
        this.wR.group.rotation.z = A * F;
    },

    reset() {},
};
