// Voxel island: bee flaps wings (synchronized), lifts off, orbits tree, lands back.
export default {
    setup(ctx) {
        // Split whole bee from island — legs stand on foliage top at v = 0.707, exact bound
        this.bee = ctx.split(p => p.v > 0.707, { pivot: [0.35, 0.707, 0.682] });

        // Split left wing from bee (pivot at inner edge, bottom — the root)
        // Left wing box u: [0.075, 0.275]. Root is at the right side (0.275).
        this.leftWing = ctx.split(
            p => p.u >= 0.075 && p.u <= 0.275 && p.v >= 0.912 && p.w >= 0.591 && p.w <= 0.727,
            { pivot: [0.275, 0.912, 0.66], parent: this.bee }
        );

        // Split right wing from bee (pivot at inner edge, bottom — the root)
        // Right wing box u: [0.425, 0.625]. Root is at the left side (0.425).
        this.rightWing = ctx.split(
            p => p.u >= 0.425 && p.u <= 0.625 && p.v >= 0.912 && p.w >= 0.591 && p.w <= 0.727,
            { pivot: [0.425, 0.912, 0.66], parent: this.bee }
        );
    },
    update(ctx) {
        const { e, t, win } = ctx;

        // --- Wing flap ---
        // Ramp up flapping intensity, hold, then fade out
        const flapEnv = win(e, 1.7, 2.1) * (1 - win(e, 5.8, 6.5));
        
        // Amplitude 0.25 rad (~14 deg), Freq 25 rad/s (~4 Hz)
        // Invert rotation for left wing so both wings flap in sync (both down, both up)
        const flapAngle = flapEnv * 0.25 * Math.sin(t * 25);
        this.leftWing.group.rotation.z = -flapAngle;  // Left wing (-X from pivot) needs opposite sign to match Right
        this.rightWing.group.rotation.z = flapAngle;  // Right wing (+X from pivot)
        
        // --- Lift ---
        // Bee rises slightly
        const lift = win(e, 2.0, 2.5) * (1 - win(e, 5.5, 6.4));

        // --- Orbit around tree centre ---
        // Orbit radius increases, completes one turn, returns to 0
        const orbitFade = win(e, 2.3, 3.0) * (1 - win(e, 5.2, 5.8));
        const orbitAngle = 2 * Math.PI * orbitFade;
        const orbitRadius = 0.75;

        // Bee position offsets from rest
        const beeX = orbitFade * orbitRadius * Math.sin(orbitAngle);
        const beeY = lift * 0.55 + flapEnv * 0.03 * Math.sin(t * 8); // Lift + hover wobble
        const beeZ = orbitFade * orbitRadius * (Math.cos(orbitAngle) - 1);

        this.bee.group.position.set(beeX, beeY, beeZ);

        // Banking during orbit — slight tilt following the turn direction
        const bank = orbitFade * 0.12 * Math.sin(t * 3);
        this.bee.group.rotation.z = bank;
    },
    reset(ctx) {
        // Transforms are naturally 0 at rest.
    },
};
