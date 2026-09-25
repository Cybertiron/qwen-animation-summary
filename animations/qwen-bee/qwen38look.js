// Bitutė: sparnai aiškiai plazdėja (lėtesnis, matomas svyruojantis judesys), tupi, pakyla,
// apskrenda ratą aplink medį ir nusileidžia ant lapijos.
export default {
    setup(ctx) {
        // Bitė (kūnas, akys, antenos, kojytės, sparnai) — stovi ant lapijos viršūnės, kontakt v=0.707
        this.bee = ctx.split(
            p => p.v > 0.707 && p.u >= 0.075 && p.u <= 0.625 && p.w >= 0.500 && p.w <= 0.864,
            { pivot: [0.35, 0.707, 0.682] }  // medžio centras ties kontakt plane
        );
        // Kairysis sparnas (išsitiesia -x nuo kūno)
        this.wingL = ctx.split(
            p => p.u >= 0.075 && p.u <= 0.275 && p.v > 0.912 && p.w >= 0.591 && p.w <= 0.727,
            { pivot: [0.275, 0.912, 0.659], parent: this.bee }
        );
        // Dešinysis sparnas (išsitiesia +x nuo kūno)
        this.wingR = ctx.split(
            p => p.u >= 0.425 && p.u <= 0.625 && p.v > 0.912 && p.w >= 0.591 && p.w <= 0.727,
            { pivot: [0.425, 0.912, 0.659], parent: this.bee }
        );
    },
    update(ctx) {
        const { e, t, win } = ctx;

        // --- Envelopes ---
        const flapEnv = win(e, 1.8, 2.2) * (1 - win(e, 5.9, 6.3));
        const dip     = win(e, 2.0, 2.2) * (1 - win(e, 2.2, 2.4));
        const takeoff = win(e, 2.4, 3.1);
        const orbit   = win(e, 3.1, 5.5);
        const land    = win(e, 5.5, 6.2);
        const flight  = takeoff * (1 - land);

        // --- Bee position (offset from rest) ---
        const R = 0.9;   // orbit radius in scene units
        const H = 0.7;   // flight height above contact plane
        const px = R * flight;
        const py = -0.05 * dip + H * flight;

        this.bee.group.position.set(px, py, 0);
        // Full revolution: 2π ≡ 0 at rest (host accepts multiples of 2π)
        this.bee.group.rotation.y = 2 * Math.PI * orbit;

        // Forward lean + gentle wobble while in the air
        this.bee.group.rotation.x = (0.12 + 0.07 * Math.sin(t * 3.1)) * flight;
        this.bee.group.rotation.z = 0.05 * flight * Math.sin(t * 2.4 + 1.2);

        // --- Wings: readable up-down flap (constant frequency, amplitude gated) ---
        // Slower stroke so each beat is visible instead of a buzz; both wings rise together.
        const flap = 0.5 * flapEnv * Math.sin(t * 14);
        this.wingL.group.rotation.z = -flap;  // left wing extends −X: −Z lifts it
        this.wingR.group.rotation.z =  flap;  // right wing extends +X: +Z lifts it
    },
    reset(ctx) {
        // No emissive or extra objects to restore
    },
};
