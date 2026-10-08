// Bee on voxel island: wings flap, bee lifts off, circles around the tree, lands back.
export default {
    setup(ctx) {
        this.bee = ctx.split(
            p => p.u > .075 && p.u < .625 && p.v > .707 && p.w > .500 && p.w < .864,
            { pivot: [.35, .707, .682] }
        );
        this.wingL = ctx.split(
            p => p.u > .075 && p.u < .275 && p.v > .912 && p.w > .591 && p.w < .727,
            { pivot: [.275, .912, .659], parent: this.bee }
        );
        this.wingR = ctx.split(
            p => p.u > .425 && p.u < .625 && p.v > .912 && p.w > .591 && p.w < .727,
            { pivot: [.425, .912, .659], parent: this.bee }
        );
    },
    update(ctx) {
        const { e, t, win } = ctx;

        const flapOn  = win(e, 1.7, 2.2) * (1 - win(e, 5.8, 6.3));
        const wingSin = Math.sin(t * 28);
        const amp     = .45 * flapOn;

        this.wingL.group.rotation.z = -amp * wingSin;
        this.wingR.group.rotation.z =  amp * wingSin;

        const lift     = win(e, 2.3, 3.0) * (1 - win(e, 5.3, 6.0));
        const orbitEnv = win(e, 2.8, 3.4) * (1 - win(e, 4.9, 5.5));
        const turn     = win(e, 3.2, 5.3);
        const angle    = 2 * Math.PI * turn;
        const radius   = .45;

        let dx = radius * Math.sin(angle) * orbitEnv;
        let dz = radius * (Math.cos(angle) - 1) * orbitEnv;
        let dy = .38 * lift + .025 * lift * Math.sin(t * 7);

        if (e > 1.7 && e < 2.4) {
            dy += .004 * Math.sin(t * 42);
            dx += .003 * Math.sin(t * 38);
        }

        this.bee.group.position.set(dx, dy, dz);
        this.bee.group.rotation.set(
            .05 * orbitEnv * Math.sin(angle),
            0,
            -.10 * orbitEnv * Math.cos(angle)
        );

        ctx.light.intensity = 0;
    },
    reset(ctx) {},
};
