// Voxel island: bee perches on the tree canopy, flaps, hovers in a circle around the trunk, then lands back.
export default {
    setup(ctx) {
        const { THREE } = ctx;
        // Tree canopy + trunk: everything above v = 0.71 (tree top region)
        this.tree = ctx.split(p => p.v > 0.71, { pivot: [0.5, 0.71, 0.5] });
        // Bee: yellow voxels (colour 3) — the bee body, wings, antennae, eyes
        this.bee = ctx.split(p => p.u > 0.18 && p.u < 0.53 && p.v > 0.74 && p.v < 0.91 && p.w > 0.50 && p.w < 0.86, { pivot: [0.355, 0.825, 0.68] });
        // Wing geometry (two simple quads, one per wing)
        const wingGeo = new THREE.PlaneGeometry(0.18, 0.12, 1, 1);
        wingGeo.rotateX(Math.PI / 2); // lay flat
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x9ED8F6, transparent: true, opacity: 0, depthWrite: false });
        this.wingL = new THREE.Mesh(wingGeo, wingMat);
        this.wingR = new THREE.Mesh(wingGeo, wingMat);
        ctx.extra.add(this.wingL, this.wingR);
    },
    update(ctx) {
        const { e, t, win, fade } = ctx;
        const bee = this.bee;
        const tree = this.tree;
        const wings = [this.wingL, this.wingR];

        // Envelope: 1.7 → 6.6 s
        const cycle = win(e, 1.9, 2.4) * (1 - win(e, 5.8, 6.4));
        const flap = win(e, 2.0, 2.3) * (1 - win(e, 5.9, 6.4));
        const fly = win(e, 2.4, 3.2) * (1 - win(e, 5.5, 6.2));
        const land = win(e, 5.5, 6.2) * (1 - win(e, 6.0, 6.4));

        // Wing flapping
        const flapSpeed = 28;
        const flapAmp = 0.9 * flap;
        wings[0].rotation.z = flapAmp * Math.sin(t * flapSpeed);
        wings[1].rotation.z = -flapAmp * Math.sin(t * flapSpeed);
        wings[0].material.opacity = flap * fade;
        wings[1].material.opacity = flap * fade;
        wings[0].position.set(-0.06, 0.02, 0);
        wings[1].position.set(0.06, 0.02, 0);

        // Bee position: hover above canopy, circle around trunk
        const hoverY = 0.35 * fly;
        const circleAngle = t * 1.8 * fly;
        const circleRadius = 0.4 * fly;
        const beeX = circleRadius * Math.cos(circleAngle);
        const beeZ = circleRadius * Math.sin(circleAngle);
        const beeY = hoverY + 0.05 * Math.sin(t * 3) * fly;

        // Land: ease back to rest
        const landK = 1 - land;
        const bx = beeX * landK;
        const by = (hoverY + 0.05 * Math.sin(t * 3)) * landK;
        const bz = beeZ * landK;

        // Bee transform
        if (bee.group) {
            bee.group.position.set(bx, by, bz);
            bee.group.rotation.y = -circleAngle * landK;
            bee.group.rotation.x = 0.08 * Math.sin(t * 4) * fly * landK;
            bee.group.rotation.z = 0.05 * Math.sin(t * 5) * fly * landK;
        }

        // Tree sway (subtle)
        if (tree.group) {
            tree.group.rotation.z = 0.02 * Math.sin(t * 1.2) * cycle;
            tree.group.rotation.x = 0.01 * Math.sin(t * 1.5) * cycle;
        }

        // Glow light
        const glow = fly * fade;
        ctx.light.color.setHex(0xF6C431);
        ctx.light.position.set(bx, by + 0.1, bz);
        ctx.light.intensity = 3 * glow;

        // Emissive on bee material (colour index 3 = yellow)
        ctx.mats[3].emissiveIntensity = 0.3 * fly * fade;
        ctx.mats[3].emissive.setHex(0xF6C431);
    },
    reset(ctx) {
        ctx.mats[3].emissiveIntensity = 0;
        ctx.light.intensity = 0;
    },
};
