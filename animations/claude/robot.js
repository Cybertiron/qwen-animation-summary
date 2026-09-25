// Robotas: nuėmus atramas pakelia dešinę ranką ir pamojuoja, pakraipo galvą, akys sužiba.
// Naudoja: ctx.split (atskiria ranką ir galvą), vyrio tašką (pivot), ctx.mats (akių švytėjimas).
export default {
    setup(ctx) {
        // dešinė ranka + plaštaka: dešinėje gabarito dalyje (u > 0.84), žemiau pečių (v < 0.6)
        this.arm = ctx.split(p => p.u > .84 && p.v < .6, { pivot: [.92, .58, .5] });   // vyris — petys
        // galva su ausimis ir antena: viskas virš korpuso (v > 0.62)
        this.head = ctx.split(p => p.v > .62, { pivot: [.5, .62, .5] });               // vyris — kaklas
    },
    update(ctx) {
        const { e, t, win } = ctx;
        const raise = win(e, 1.8, 2.4) * (1 - win(e, 5.6, 6.3));     // ranka aukštyn ir vėl žemyn
        const wave = win(e, 2.3, 2.6) * (1 - win(e, 5.2, 5.6));
        this.arm.group.rotation.z = 2.6 * raise + .35 * wave * Math.sin(t * 9);
        const nod = win(e, 1.9, 2.4) * (1 - win(e, 5.8, 6.4));
        this.head.group.rotation.z = -.14 * nod + .05 * wave * Math.sin(t * 4.5);
        this.head.group.rotation.x = .06 * nod * Math.sin(t * 3);
        const glow = win(e, 1.9, 2.3) * (1 - win(e, 6.0, 6.5));
        ctx.mats[2].emissive.set(ctx.colors[3]);                     // akys (3-ia spalva) šviečia 4-os spalvos atspalviu
        ctx.mats[2].emissiveIntensity = glow * (.6 + .3 * Math.sin(t * 6));
    },
    reset(ctx) {
        ctx.mats[2].emissiveIntensity = 0;
    },
};
