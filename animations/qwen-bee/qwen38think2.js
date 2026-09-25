// Voxel island: bitė tupi ant lapijos — sukdinėja sparnus, pakyla, apskrenda ratą aplink medį ir nusileidžia atgal.
export default {
    setup(ctx) {
        const M = .012; // margin around the authoritative boxes

        // Split the WHOLE bee first (its box is fully above the foliage top, so no foliage is stolen).
        this.bee = ctx.split(p =>
            p.u > .075 - M && p.u < .625 + M &&
            p.v > .706 - M && p.v < 1.000 + M &&
            p.w > .500 - M && p.w < .864 + M,
            { pivot: [.35, .72, .682] });

        // Then carve the two wings out of the bee. Wing boxes are disjoint (u <0.275 vs u >0.425)
        // and neither contains the other, so no triangle is stolen.
        this.wingL = ctx.split(p =>
            p.u > .075 - M && p.u < .275 + M &&
            p.v > .912 - M && p.v < 1.000 + M &&
            p.w > .591 - M && p.w < .727 + M,
            { pivot: [.20, .912, .660], parent: this.bee });

        this.wingR = ctx.split(p =>
            p.u > .425 - M && p.u < .625 + M &&
            p.v > .912 - M && p.v < 1.000 + M &&
            p.w > .591 - M && p.w < .727 + M,
            { pivot: [.50, .912, .660], parent: this.bee });

        // Rest centre of the bee (its box centre) — the orbit is measured around this point.
        this.rest = ctx.at(.35, .85, .682);
    },

    update(ctx) {
        const { e, t, win } = ctx;
        const TAU = Math.PI * 2;

        // Everything is a product of envelopes that are 0 before 1.7 s and 0 from ~6.3 s on.
        const up = win(e, 1.8, 2.9) * (1 - win(e, 5.4, 6.45));   // lift + orbit amount
        const face = win(e, 1.9, 2.4) * (1 - win(e, 5.4, 6.45)); // turn to face travel direction

        // Anticipation: a small dip + tremble just before take-off.
        const dip = win(e, 1.72, 1.95) * (1 - win(e, 2.05, 2.25));
        const tremble = dip * .012 * Math.sin(t * 37);

        // Orbit: one full circle, centred on the bee's rest position.
        const theta = win(e, 2.3, 5.5) * TAU;
        const R = .5;
        const dx = R * up * Math.cos(theta);
        const dy = .62 * up - .06 * dip + tremble;
        const dz = R * up * Math.sin(theta);

        // Offsets from rest (all zero at e<=1.7 and at e>=6.6).
        this.bee.group.position.x = dx;
        this.bee.group.position.y = dy;
        this.bee.group.position.z = dz;
        this.bee.group.rotation.y = face * (theta + Math.PI / 2); // face along travel tangent

        // Wing flap: idle flutter builds up, full flapping in flight, settles on landing.
        const flapEnv = win(e, 1.75, 2.1) * (1 - win(e, 5.7, 6.35));
        const amp = .6 * (.45 + .55 * win(e, 2.3, 2.9));
        const phase = 24 * e + 6 * (1 - win(e, 2.2, 2.9)) * (1 - win(e, 5.7, 6.35));
        const flap = amp * flapEnv * Math.sin(phase);
        this.wingL.group.rotation.z = flap;
        this.wingR.group.rotation.z = -flap;
    },

    reset(ctx) {
        if (this.bee) {
            this.bee.group.position.set(0, 0, 0);
            this.bee.group.rotation.y = 0;
            this.wingL.group.rotation.z = 0;
            this.wingR.group.rotation.z = 0;
        }
    },
};
