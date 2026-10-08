// Bitutė tupi ant lapijos, sparnai plakti, ji pakyla, apskrenda ratą aplink medį (krypčiai į skrydžio kryptį) ir nusileidžia atgal į tą pačią vietą.
export default {
    setup(ctx) {
        // Visa bitutė: kojytės liečiasi su lapijos viršūne (v = 0.707) — kirčiame tik aukščiau, apačios maržos neliečiame.
        this.bee = ctx.split(
            p => p.v > .707 &&
                 p.u >= .075 - 1e-4 && p.u <= .625 + 1e-4 &&
                 p.w >= .500 - 1e-4 && p.w <= .864 + 1e-4,
            { pivot: [.35, .83, .682] }
        );
        // Abi sparnai — iš jau atskirtos bitutės, kad skrydžio metu judėtų kartu su ja.
        this.leftWing = ctx.split(
            p => p.v > .912 &&
                 p.u >= .075 - 1e-4 && p.u <= .275 + 1e-4 &&
                 p.w >= .591 - 1e-4 && p.w <= .727 + 1e-4,
            { pivot: [.225, .912, .659], parent: this.bee }
        );
        this.rightWing = ctx.split(
            p => p.v > .912 &&
                 p.u >= .425 - 1e-4 && p.u <= .625 + 1e-4 &&
                 p.w >= .591 - 1e-4 && p.w <= .727 + 1e-4,
            { pivot: [.475, .912, .659], parent: this.bee }
        );
        // Bitutės ramioji padėtis jau yra ties medžio ašimi, todėl skrydžio
        // poslinkis nuo ramybės tiesiog ir yra apskridimas aplink medį.
        this.radius = .5;
    },

    update(ctx) {
        const { e, t, win } = ctx;

        const dip     = win(e, 1.70, 1.95) * (1 - win(e, 1.95, 2.25)); // tikėjimosi įlinksmas prieš pakilimą
        const tremble = win(e, 1.70, 1.95) * (1 - win(e, 2.05, 2.40)); // smulkus drebanimas
        const flap    = win(e, 1.75, 2.30) * (1 - win(e, 5.75, 6.35)); // sparnų plaktymas
        const up      = win(e, 2.15, 2.85) * (1 - win(e, 5.45, 6.20)); // pakilimas / nusileidimas
        const turn    = win(e, 2.45, 5.50);                           // pilnas 360° apskridimas
        const rad     = win(e, 2.55, 3.15) * (1 - win(e, 5.20, 5.75)); // rato spindulys
        const orient  = win(e, 2.50, 2.90) * (1 - win(e, 5.50, 6.20)); // sukis skrydžio kryptimi, prieš nusileidimą – atgal į priekį
        const tilt    = win(e, 2.20, 2.70) * (1 - win(e, 5.30, 5.85)); // švelnus pasvirimas

        const th = 2 * Math.PI * turn;
        const r = this.radius * rad;

        // Poslinkis NŪ ramybės padėties: apskridimas aplink medžio ašį.
        // Ties e=0 ir e≥6.6 tai visada (0,0,0) → bitutė prilygsta.
        const y = .52 * up - .03 * dip + .012 * up * Math.sin(t * 5.2);
        const sx = .007 * tremble * Math.sin(t * 42);
        const sz = .005 * tremble * Math.sin(t * 33);

        this.bee.group.position.set(r * Math.sin(th) + sx, y, r * Math.cos(th) + sz);
        // Kryptis į judėjimo kryptį (tangencialiai); prieš nusileidimą grįžta į priekį,
        // todėl ramioje padėtyje rotation.y = 2π (≡ 0).
        this.bee.group.rotation.y = th + (Math.PI / 2) * orient;
        this.bee.group.rotation.x = .14 * tilt + .05 * up * Math.sin(t * 26);
        this.bee.group.rotation.z = .24 * orient + .04 * up * Math.sin(t * 8);

        // Abi sparnai juda sinchroniškai, pastovus dažnis.
        const beat = Math.sin(t * 26);
        this.leftWing.group.rotation.z = -.70 * beat * flap;
        this.rightWing.group.rotation.z = .70 * beat * flap;
    },

    reset(ctx) {
        // Keičiami tik transformacijos — atstatyti nėra ko.
    }
};
