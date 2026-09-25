// Voxel island: bitutė pakyla nuo lapijos, apskrenda ratą aplink medį ir nusileidžia atgal.
// Sparneliai plazda, bitutė įlinksta į posūkį, šviesos efektas paryškina skrydį.
export default {
    setup(ctx) {
        // Atskiriame visą bitutę nuo medžio (griežtai virš v=0.707)
        this.bee = ctx.split(p => p.v > 0.707 && p.u > 0.065 && p.u < 0.635 && p.w > 0.49 && p.w < 0.874,
                             { pivot: [0.35, 0.707, 0.682] });
        // Atskiriame sparnus nuo kūno (virš v=0.912), pririštus prie bitutės grupės
        this.wings = ctx.split(p => p.v > 0.912 && p.u > 0.065 && p.u < 0.635 && p.w > 0.581 && p.w < 0.737,
                               { pivot: [0.35, 0.912, 0.682], parent: this.bee });
    },
    update(ctx) {
        const { e, t, fade, win, clamp01 } = ctx;

        // Laiko langai (envelopes)
        const flapEnv = win(e, 1.8, 2.0) * (1 - win(e, 5.8, 6.4));
        const liftEnv = win(e, 2.0, 2.4) * (1 - win(e, 5.2, 5.6));
        const orbitEnv = win(e, 2.4, 2.6) * (1 - win(e, 4.8, 5.0));
        const orbitProg = clamp01((e - 2.6) / 2.4); // 0→1 skrydžio trukmės metu
        const angle = orbitProg * Math.PI * 2 * orbitEnv;

        // Bitutės padėtis: pakilimas + apskridimas rato
        this.bee.group.position.set(
            Math.cos(angle) * 0.6 * orbitEnv,
            0.5 * liftEnv,
            Math.sin(angle) * 0.6 * orbitEnv
        );
        // Pasukimai: šnabdas aukštyn, kūnas įlinksta į posūkį, frontas sukasi kartu
        this.bee.group.rotation.set(
            0.15 * liftEnv,
            -angle * 0.4 * orbitEnv,
            Math.cos(angle) * 0.2 * orbitEnv
        );

        // Sparnų plazdėjimas
        this.wings.group.rotation.x = Math.sin(t * 16) * 0.4 * flapEnv;
        this.wings.group.rotation.z = Math.sin(t * 16) * 0.08 * flapEnv;

        // Šviesos efektas po bitute
        ctx.light.color.setHex(0xfff4d0);
        ctx.light.position.set(this.bee.group.position.x, 0.6 + this.bee.group.position.y, this.bee.group.position.z);
        ctx.light.intensity = 4 * liftEnv * fade;
    },
    reset(ctx) {
        ctx.light.intensity = 0;
    }
};
