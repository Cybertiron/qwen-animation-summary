// Bitutė: sparnai plazda, tupi, pakyla, apskrenda pilną ratą aplink medį ir nusileidžia ant lapijos.
export default {
    setup(ctx) {
        // Bee: pivot at the tree axis (where legs meet foliage) so Y-rotation = orbit around tree
        this.bee = ctx.split(
            p => p.u >= .075 && p.u <= .625 && p.v > .707 && p.w >= .500 && p.w <= .864,
            { pivot: [.35, .707, .68] }
        );
        // Wings nested in bee, pivot at inner-bottom edge (where wing meets body)
        this.wingL = ctx.split(
            p => p.u >= .075 && p.u <= .275 && p.v > .912 && p.w >= .591 && p.w <= .727,
            { pivot: [.175, .912, .66], parent: this.bee }
        );
        this.wingR = ctx.split(
            p => p.u >= .425 && p.u <= .625 && p.v > .912 && p.w >= .591 && p.w <= .727,
            { pivot: [.525, .912, .66], parent: this.bee }
        );
    },
    update(ctx) {
        const { e, t, win } = ctx;

        // Envelopes
        const flap = win(e, 1.7, 2.0) * (1 - win(e, 5.8, 6.3));
        const crouch = win(e, 1.8, 2.1) * (1 - win(e, 2.3, 2.6));
        const lift = win(e, 2.2, 3.0) * (1 - win(e, 5.2, 6.0));
        const orbit = win(e, 2.6, 5.4);
        const inFlight = win(e, 3.0, 3.6) * (1 - win(e, 4.8, 5.4));
        const settle = win(e, 5.9, 6.1) * (1 - win(e, 6.1, 6.4));

        // Wing flapping (faster in flight)
        const freq = 22 + 14 * lift;
        const wingAngle = flap * .38 * Math.sin(t * freq);
        this.wingL.group.rotation.z = -wingAngle;
        this.wingR.group.rotation.z = wingAngle;

        // Orbit: full circle around tree axis, radius scales with lift
        const R = .65, H = .85;
        const theta = 2 * Math.PI * orbit;
        const r = R * lift;
        this.bee.group.position.set(
            r * Math.cos(theta),
            -.04 * crouch + H * lift - .04 * settle,
            r * Math.sin(theta)
        );

        // Gentle wobble while in flight
        this.bee.group.rotation.x = .06 * inFlight * Math.sin(t * 2.8);
        this.bee.group.rotation.z = .05 * inFlight * Math.sin(t * 2.1 + 1);

        // Subtle warm glow on the bee body (colour 3)
        const glow = win(e, 1.8, 2.3) * (1 - win(e, 6.0, 6.4));
        ctx.mats[3].emissive.set(0xffe066);
        ctx.mats[3].emissiveIntensity = .12 * glow * (.7 + .3 * Math.sin(t * 4));
    },
    reset(ctx) {
        ctx.mats[3].emissiveIntensity = 0;
    },
};
