// Bitutė prasiplešia sparnus, pakyla, apskrieda aplink medį ir grįžta į lapiją.
export default {
    setup(ctx) {
        // Visa bitutė: griežtai virš lapijos kontakto plokštumos (v > 0.707).
        this.bee = ctx.split(
            p => p.v > .707 && p.u > .074 && p.u < .626 && p.w > .499 && p.w < .865,
            { pivot: [.35, .85, .682] }
        );
        // Sparnai atskiriami iš bitės, kad galėtų plazdėti apie savo vaires.
        this.wingL = ctx.split(
            p => p.v > .911 && p.u > .074 && p.u < .276 && p.w > .590 && p.w < .728,
            { pivot: [.275, .912, .659], parent: this.bee }
        );
        this.wingR = ctx.split(
            p => p.v > .911 && p.u > .424 && p.u < .626 && p.w > .590 && p.w < .728,
            { pivot: [.425, .912, .659], parent: this.bee }
        );
    },

    update(ctx) {
        const { e, t, win } = ctx;

        // Sparnai: pradeda greitai, o nusileidus sulėtėja ir sustoja.
        const flapEnv = win(e, 1.7, 2.15) * (1 - win(e, 5.55, 6.15));
        const flap = .72 * flapEnv * Math.sin(t * 30);

        this.wingL.group.rotation.z = -flap;
        this.wingR.group.rotation.z = flap;

        // Anticipacija: nedidelis parankimas prieš pakilimą.
        const dip = win(e, 2.15, 2.45) * (1 - win(e, 2.45, 2.65));

        // Skrydžio aplinkinė: pakyla ir vėl nusileidžia.
        const fly = win(e, 2.45, 3.15) * (1 - win(e, 5.15, 6.05));

        // Rataplinkšis aplink medį: 0 -> 2π, todėl pabaigoje kryptis grįžta į pradinę.
        const turn = win(e, 2.75, 5.75);
        const angle = 2 * Math.PI * turn;

        // Spindulys išsiskleidžia pakilus ir sugrįžta nusileidžiant.
        const radEnv = win(e, 2.65, 3.15) * (1 - win(e, 5.35, 5.95));
        const R = .42;

        // Padas, kuris pradeda ir baigiasi ties medžio viršūne (offset 0, kai angle = 0/2π).
        const px = R * radEnv * (Math.cos(angle) - 1);
        const pz = R * radEnv * Math.sin(angle);

        // Vertikalus skrydys + švelnus pakilimo „bobas“.
        const py = .52 * fly + .028 * fly * Math.sin(t * 2.4) - .035 * dip;

        // Bitutės grupės padėtis: offset nuo ramybės padėties.
        this.bee.group.position.set(px, py, pz);

        // Kryptis: pilnas apsisukimas baigiasi 2π, todėl ramybės padėtyje kryptis 0.
        this.bee.group.rotation.y = angle;

        // Švelnus pasvirimas posūkyje ir pakilime, kad atrodytų fiziką.
        const bank = .22 * radEnv * Math.cos(angle);
        this.bee.group.rotation.z = bank;
        this.bee.group.rotation.x = -.12 * fly * Math.sin(t * 1.9);
    },

    reset(ctx) {
        // Visi transformai yra offsetai, todėl ramybės padėtyje jie = 0.
        // Jei būtų keista emisija, grąžintume čia, bet ši animacija jos nenaudoja.
    },
};
