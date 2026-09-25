// Bitutė ant medžio: sparnai ima plazdėti, bitė pakyla, apskrenda ratą aplink medį ir grįžta.
export default {
    setup(ctx) {
        // Visą bitutę atskiriame nuo salelės – viskas virš lapijos (v > 0.707)
        this.bee = ctx.split(p => p.v > 0.707 && p.u > 0.065 && p.u < 0.635 && p.w > 0.49 && p.w < 0.874, {
            pivot: [0.35, 0.707, 0.68]
        });

        // Sparnus atskiriame iš bitės viduje (nested split), kad plazdėtų kartu judant kūnui
        this.lw = ctx.split(p => p.u > 0.065 && p.u < 0.285 && p.v > 0.912 && p.w > 0.58 && p.w < 0.74, {
            pivot: [0.27, 0.93, 0.66], parent: this.bee
        });
        this.rw = ctx.split(p => p.u > 0.415 && p.u < 0.635 && p.v > 0.912 && p.w > 0.58 && p.w < 0.74, {
            pivot: [0.43, 0.93, 0.66], parent: this.bee
        });
    },

    update(ctx) {
        const { e, t, win, clamp01, fade } = ctx;

        // Sparnų plazdėjimas: lėtai ima ~1.9 s, greitai 2.3–5.5 s, nutilsta ~6.2 s
        const flapEnv = win(e, 1.9, 2.3) * (1 - win(e, 5.7, 6.2));
        const flap = flapEnv * 0.4 * Math.sin(t * 35);
        this.lw.group.rotation.z = flap;
        this.rw.group.rotation.z = flap;

        // Anticipacija: mažas nusileidimas + drebulys prieš pakilimą
        const antic = win(e, 1.7, 1.9) * (1 - win(e, 2.0, 2.1));
        // Pakilimas / nusileidimas
        const lift = win(e, 2.2, 2.7) * (1 - win(e, 5.2, 5.7));

        // Orbita aplink medį: vienas pilnas ratas 2.8–5.0 s
        const orbitEnv = win(e, 2.6, 3.0) * (1 - win(e, 4.8, 5.2));
        const phase = clamp01((e - 2.8) / 2.2);
        const orbitAngle = phase * 2 * Math.PI;
        const radius = 0.6 * orbitEnv;

        this.bee.group.position.x = Math.cos(orbitAngle) * radius + antic * 0.02 * Math.sin(t * 20);
        this.bee.group.position.y = -0.03 * antic + 0.25 * lift;
        this.bee.group.position.z = Math.sin(orbitAngle) * radius;
        // Bitė sukiasi ratu ir visada žiūri į judėjimo kryptį
        this.bee.group.rotation.y = (orbitAngle + Math.PI * 0.5) * orbitEnv;

        // Bankinimas posūkiuose (fizikali detalė)
        this.bee.group.rotation.z = 0.12 * orbitEnv * Math.cos(orbitAngle);
        this.bee.group.rotation.x = 0.08 * orbitEnv * Math.sin(orbitAngle);

        // Šiltas šviesos taškas seka bitę skrydžio metu
        const lightOn = win(e, 2.0, 2.4) * (1 - win(e, 5.5, 6.0));
        ctx.light.color.setHex(0xffdd88);
        ctx.light.position.set(this.bee.group.position.x, this.bee.group.position.y + 0.3, this.bee.group.position.z);
        ctx.light.intensity = 3 * lightOn * fade;
    },

    reset(ctx) {
        ctx.light.intensity = 0;
    }
};
