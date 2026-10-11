// Bitė plazdo sparnais, pakyla nuo lapijos, apskrenda ratą aplink medį ir nusileidžia.
export default {
    setup(ctx) {
        this.bee = ctx.split(
            p => p.v > 0.707 && p.u > 0.065 && p.u < 0.635 && p.w > 0.49 && p.w < 0.874,
            { pivot: [0.35, 0.707, 0.68] }
        );
        this.lwing = ctx.split(
            p => p.v > 0.912 && p.w > 0.58 && p.w < 0.737 && p.u < 0.30,
            { pivot: [0.275, 0.912, 0.659], parent: this.bee }
        );
        this.rwing = ctx.split(
            p => p.v > 0.912 && p.w > 0.58 && p.w < 0.737 && p.u > 0.39,
            { pivot: [0.425, 0.912, 0.659], parent: this.bee }
        );
    },
    update(ctx) {
        const { e, t, win } = ctx;

        // Anticipacija: bitė dreba prieš pakildama (1.75–2.2)
        const tremble = win(e, 1.75, 1.9) * (1 - win(e, 2.1, 2.3));
        const tx = tremble * 0.007 * Math.sin(t * 52);
        const ty = tremble * 0.005 * Math.sin(t * 63);

        // Sparnelių plazdėjimas
        const flutter = win(e, 1.8, 2.4) * (1 - win(e, 5.5, 6.2));
        const flap = flutter * 0.32;
        this.rwing.group.rotation.z = flap * Math.sin(t * 30);
        this.lwing.group.rotation.z = -flap * Math.sin(t * 30);

        // Kilimas / nusileidimas
        const lift = win(e, 2.3, 3.0) * (1 - win(e, 5.3, 6.0));
        const hoverBob = lift * 0.025 * Math.sin(t * 6.5);
        const beeY = 0.52 * lift + ty + hoverBob;

        // Ratas aplink medį (3.0–5.3 s, vienas pilnas posūkis)
        const orbitT = win(e, 3.0, 5.3);
        const theta = 2 * Math.PI * orbitT;
        const R = 0.48;
        const ox = R * (1 - Math.cos(theta));
        const oz = R * Math.sin(theta);

        // Pakreipimas posūkyje (bank) + lengvas pakrypimas skrydyje
        const bank = 0.055 * lift * Math.sin(theta);
        const pitch = lift * 0.04 * Math.sin(t * 2.2);

        this.bee.group.position.set(tx + ox, beeY, oz);
        this.bee.group.rotation.set(pitch, theta, bank);

        // Švelnus medžio lapijos virpėjimas, kai bitė pakyla
        const leafWobble = win(e, 2.3, 2.6) * (1 - win(e, 3.4, 4.0));
        if (leafWobble > 0) {
            ctx.mats[1].emissive.set(ctx.colors[1]);
            ctx.mats[1].emissiveIntensity = 0.08 * leafWobble * Math.abs(Math.sin(t * 14));
        }
    },
    reset(ctx) {
        ctx.mats[1].emissiveIntensity = 0;
    },
};
