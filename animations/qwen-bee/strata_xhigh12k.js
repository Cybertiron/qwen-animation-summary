// Bitutė atgyja: sparnai pradeda plazdėti, ji pakyla, apskrenda ratą virš medžio ir nusileidžia.
export default {
    setup(ctx) {
        this.restTop    = ctx.at(.35, .707, .682);
        this.beeCentre  = ctx.at(.35, .854, .682);

        this.radius = Math.max(.18, Math.min(ctx.size.x, ctx.size.z) * .15);
        this.lift   = Math.min(.95, .36 * ctx.H);

        // visas bitės kūnas: atskiriamas nuo lapijos viršaus
        this.bee = ctx.split(p =>
            p.v > 0.7070 &&
            p.u > 0.0649 && p.u < 0.6351 &&
            p.w > 0.4899 && p.w < 0.8751,
            { pivot: [.35, .854, .682] }
        );

        // kairysis sparnas atskiriamas nuo jau suformuotos bitės dalies
        this.leftWing = ctx.split(p =>
            p.v > 0.9125 &&
            p.u > 0.0649 && p.u < 0.2780 &&
            p.w > 0.5849 && p.w < 0.7381,
            { pivot: [.275, .912, .659], parent: this.bee }
        );

        // dešinysis sparnas
        this.rightWing = ctx.split(p =>
            p.v > 0.9125 &&
            p.u > 0.4219 && p.u < 0.6351 &&
            p.w > 0.5849 && p.w < 0.7381,
            { pivot: [.425, .912, .659], parent: this.bee }
        );
    },

    update(ctx) {
        const { e, t, win, fade } = ctx;

        const alive   = win(e, 1.78, 2.18);
        const land    = 1 - win(e, 5.58, 6.28);
        const air     = alive * land;

        const flutter = win(e, 1.78, 2.22) * (1 - win(e, 6.10, 6.45));

        const takeoff = win(e, 2.22, 3.00);
        const orbitT  = win(e, 3.00, 5.05);
        const angle   = 2 * Math.PI * orbitT;

        const cx = Math.cos(angle);
        const sz = Math.sin(angle);

        const r = this.radius * air;

        const x = r * cx;
        const z = r * sz;

        const y = this.lift * takeoff * land
                + air * (.035 * Math.sin(t * 2.7) + .018 * Math.sin(t * 4.3));

        const tremble = (e > 1.78 && e < 2.30)
            ? .012 * Math.sin(t * 45)
            : 0;

        this.bee.group.position.set(x, y + tremble, z);

        const beat = (.78 + .22 * Math.sin(t * 39)) * flutter;

        this.leftWing.group.rotation.z  = -0.36 * beat;
        this.rightWing.group.rotation.z =  0.36 * beat;

        const bodyBank  = air * (.10 * Math.sin(angle + Math.PI)
                               + .04 * Math.sin(t * 2.3));
        const bodyPitch = air * .07 * Math.sin(t * 1.8 + .2);

        this.bee.group.rotation.y = -angle;
        this.bee.group.rotation.z = bodyBank;
        this.bee.group.rotation.x = bodyPitch;

        ctx.light.color.setHex(0xffe7b0);
        ctx.light.position.set(
            this.beeCentre.x + x,
            this.beeCentre.y + y + 0.18,
            this.beeCentre.z + z
        );
        ctx.light.intensity = air * .55 * fade;
    },

    reset(ctx) {
        ctx.light.intensity = 0;
    },
};
