// Voxel island: bee's wings flap, it lifts off the tree top, circles the tree once, and lands back.
export default {
    setup(ctx) {
        // Split the whole bee above the foliage contact plane (v > 0.707, no margin below)
        this.bee = ctx.split(
            p => p.v > 0.707 && p.u >= 0.075 && p.u <= 0.625 && p.w >= 0.500 && p.w <= 0.864,
            { pivot: [0.35, 0.707, 0.682] }
        );
        // Split left wing (nested inside bee)
        this.wingL = ctx.split(
            p => p.u >= 0.075 && p.u <= 0.275 && p.v >= 0.912 && p.w >= 0.591 && p.w <= 0.727,
            { pivot: [0.35, 0.912, 0.659], parent: this.bee }
        );
        // Split right wing (nested inside bee)
        this.wingR = ctx.split(
            p => p.u >= 0.425 && p.u <= 0.625 && p.v >= 0.912 && p.w >= 0.591 && p.w <= 0.727,
            { pivot: [0.35, 0.912, 0.659], parent: this.bee }
        );
        // Precompute orbit radius relative to model
        this.R = 0.85;
    },
    update(ctx) {
        const { e, t, win, fade, clamp01 } = ctx;

        // Envelopes
        const flapEnv = win(e, 1.8, 2.3) * (1 - win(e, 5.9, 6.5));
        const liftUp = win(e, 2.3, 3.1) * (1 - win(e, 5.4, 6.3));
        const orbitEnv = win(e, 2.6, 3.4) * (1 - win(e, 5.1, 5.9));

        // Orbit: one full revolution, 0 → 2π
        const orbitProg = clamp01((e - 2.8) / 3.2); // 0 at e=2.8, 1 at e=6.0
        const orbitAngle = 2 * Math.PI * orbitProg;

        // Bee position (offsets from rest)
        const R = this.R;
        const liftY = 0.65 * liftUp;
        const ox = R * Math.sin(orbitAngle) * orbitEnv;
        const oz = R * Math.cos(orbitAngle) * orbitEnv;
        this.bee.group.position.set(ox, liftY, oz);

        // Face tangent to orbit
        this.bee.group.rotation.y = -orbitAngle * orbitEnv;
        // Slight nose-down tilt during flight
        this.bee.group.rotation.x = -0.08 * liftUp * orbitEnv;
        // Gentle bob
        const bob = 0.04 * liftUp * orbitEnv * Math.sin(t * 4);
        this.bee.group.position.y = liftY + bob;

        // Wing flapping — constant frequency, amplitude scaled by envelope
        const flapAmp = 0.5 * flapEnv;
        const flap = flapAmp * Math.sin(t * 30);
        this.wingL.group.rotation.z = -flap;
        this.wingR.group.rotation.z = flap;

        // Subtle emissive glow on bee body during flight
        ctx.mats[3].emissive.set('#ffdd44');
        ctx.mats[3].emissiveIntensity = 0.12 * liftUp * fade;
    },
    reset(ctx) {
        ctx.mats[3].emissiveIntensity = 0;
    }
};
