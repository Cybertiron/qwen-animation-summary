// Voxel island: bitutė pakyla nuo medžio, apskrenda aplink jį ir nusileidžia.
export default {
    setup(ctx) {
        const { THREE } = ctx;
        
        // Atskiriame bitutę pagal erdvinę padėtį (u, v, w).
        // Bitutės gabaritai: u [0.18, 0.53], v [0.74, 0.91], w [0.50, 0.86].
        // Pridedame šiek tiek tolerancijos, kad apimtume visus trikampius.
        this.bee = ctx.split(p => 
            p.u > 0.15 && p.u < 0.56 && 
            p.v > 0.72 && p.v < 0.93 && 
            p.w > 0.48 && p.w < 0.88, 
            { pivot: 'center' }
        );
        
        // Pradinė bitutės pozicija (apytiksliai centro taškas iš u,v,w)
        // Naudosime šią poziciją kaip "namų" tašką, į kurį bitutė grįžta.
        this.beeHome = ctx.at(0.35, 0.82, 0.68);
        
        // Medžio centras orbitai (modelio centras)
        this.treeCenter = ctx.at(0.5, 0.5, 0.5);
    },
    update(ctx) {
        const { e, t, win, fade, THREE } = ctx;
        
        // --- Laiko valdymas ---
        // Animacija vyksta tik tarp 1.7s ir 6.6s.
        // Jei e < 1.7 arba e > 6.6, viskas turi būti ramybės būsenoje.
        
        // Bendras animacijos "aktyvumo" langas: 1.7 -> 6.6
        // Naudojame win, kad gautume sklandų 0->1->0 perėjimą.
        const animStart = 1.7;
        const animEnd = 6.6;
        
        // Jei laikas yra už animacijos ribų, priverstinai nustatome ramybę.
        if (e < animStart || e > animEnd) {
            this.reset(ctx);
            return;
        }
        
        // Skrydžio fazės:
        // 1. Pakilimas: 1.7 -> 2.5
        // 2. Orbita: 2.5 -> 5.5
        // 3. Nusileidimas: 5.5 -> 6.3
        // 4. Ramybė: 6.3 -> 6.6
        
        const liftUp = win(e, 1.7, 2.5);
        const orbitStart = win(e, 2.5, 2.8);
        const orbitEnd = win(e, 5.2, 5.5);
        const landDown = win(e, 5.5, 6.3);
        
        // "Flying" būsenos indikatorius (1 kai ore, 0 kai žemėje)
        const flying = liftUp * (1 - landDown);
        
        // --- Bitutės judesys ---
        if (this.bee) {
            // Pradinė pozicija (namai)
            const homeX = this.beeHome.x;
            const homeY = this.beeHome.y;
            const homeZ = this.beeHome.z;
            
            // 1. Pakilimo aukštis
            const liftHeight = 0.6 * liftUp;
            
            // 2. Orbitos kampas
            // Orbita vyksta tarp 2.5s ir 5.5s.
            // Kampas eina nuo 0 iki 2*PI.
            const orbitProgress = win(e, 2.5, 5.5); // 0 -> 1
            // Norime, kad orbita prasidėtų 0 ir baigtųsi 2*PI, bet tada grįžtų atgal?
            // Ne, paprasčiau: bitutė skrenda ratu.
            // Kampas = orbitProgress * 2 * PI.
            const orbitAngle = orbitProgress * Math.PI * 2;
            
            // Orbitos spindulys
            const radius = 0.8;
            
            // Tikslinė pozicija orbitoje
            const orbitX = this.treeCenter.x + Math.cos(orbitAngle) * radius;
            const orbitZ = this.treeCenter.z + Math.sin(orbitAngle) * radius;
            const orbitY = this.treeCenter.y + 0.5 + liftHeight; // Virš medžio centro
            
            // Galutinė pozicija
            let finalX, finalY, finalZ;
            
            if (e < 2.5) {
                // Tik pakilimas
                finalX = homeX;
                finalY = homeY + liftHeight;
                finalZ = homeZ;
            } else if (e > 5.5) {
                // Nusileidimas
                // Interpoliuojame iš orbitos pozicijos (kuri buvo 5.5s) į namus
                // Bet orbitos pozicija 5.5s yra pabaiga rato.
                // Geriau: tiesiog interpoliuojame tarp orbitos taško ir namų.
                // Kadangi landDown eina 0->1, tai (1-landDown) eina 1->0.
                const orbitPosAtLand = {
                    x: this.treeCenter.x + Math.cos(Math.PI * 2) * radius, // 5.5s kampas ~ 2PI
                    z: this.treeCenter.z + Math.sin(Math.PI * 2) * radius,
                    y: this.treeCenter.y + 0.5 + 0.6 // liftHeight buvo 0.6
                };
                
                finalX = THREE.MathUtils.lerp(orbitPosAtLand.x, homeX, landDown);
                finalY = THREE.MathUtils.lerp(orbitPosAtLand.y, homeY, landDown);
                finalZ = THREE.MathUtils.lerp(orbitPosAtLand.z, homeZ, landDown);
            } else {
                // Orbita
                finalX = orbitX;
                finalY = orbitY;
                finalZ = orbitZ;
            }
            
            // Taikome poziciją kaip offsetą nuo pradinės vietos
            this.bee.group.position.set(
                finalX - homeX,
                finalY - homeY,
                finalZ - homeZ
            );
            
            // Sukimas: bitutė žiūri į orbitos centrą
            // Kampas tarp bitutės ir centro
            const dx = this.treeCenter.x - finalX;
            const dz = this.treeCenter.z - finalZ;
            const lookAngle = Math.atan2(dx, dz); // Žiūri į centrą
            
            // Pradinis kampas (kai bitutė namuose)
            // Namuose bitutė yra ties ~ (0.35, 0.82, 0.68)
            // Centras (0.5, 0.5, 0.5)
            // Pradinis kampas:
            const homeDx = this.treeCenter.x - homeX;
            const homeDz = this.treeCenter.z - homeZ;
            const homeAngle = Math.atan2(homeDx, homeDz);
            
            // Rotacijos offsetas
            let rotY = lookAngle - homeAngle;
            
            // Normalizuojame rotaciją, kad būtų sklandi
            // Jei skirtumas didelis, koreguojame
            while (rotY > Math.PI) rotY -= Math.PI * 2;
            while (rotY < -Math.PI) rotY += Math.PI * 2;
            
            this.bee.group.rotation.y = rotY;
            
            // Sparnų plazdėjimas / vibracija
            const wobble = flying * 0.1 * Math.sin(t * 30);
            this.bee.group.rotation.z = wobble;
            this.bee.group.rotation.x = wobble * 0.5;
        }
        
        // --- Šviesa ---
        // Geltona šviesa nuo bitutės
        const lightIntensity = flying * 4.0 * (0.8 + 0.2 * Math.sin(t * 15));
        ctx.light.intensity = lightIntensity * fade;
        ctx.light.color.setHex(0xF6C431);
        
        // Šviesos pozicija seka bitutę
        if (this.bee) {
            ctx.light.position.set(
                this.bee.group.position.x + this.beeHome.x,
                this.bee.group.position.y + this.beeHome.y,
                this.bee.group.position.z + this.beeHome.z
            );
        }
        
        // --- Salos "gyvybė" ---
        // Šiek tiek padidiname salą, kai bitutė skrenda
        const islandScale = 1.0 + 0.02 * flying * Math.sin(t * 2);
        ctx.group.scale.setScalar(islandScale);
    },
    reset(ctx) {
        ctx.light.intensity = 0;
        ctx.group.scale.setScalar(1);
        if (this.bee) {
            this.bee.group.position.set(0, 0, 0);
            this.bee.group.rotation.set(0, 0, 0);
        }
    }
};
