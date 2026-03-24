import { world, system } from "@minecraft/server";

// 1. Start with 0 in memory
let globalCO2 = 0;

// 2. LOAD: Wait 1 second after world starts to fetch the saved value
// (We wait because the world database takes a moment to "wake up")
system.runTimeout(() => {
    const savedValue = world.getDynamicProperty("global_co2_level");
    
    if (savedValue !== undefined) {
        globalCO2 = savedValue;
        
    }
}, 20); 

// 3. THE UPDATE FUNCTION (Use this in your Break/Place events)
function updateCO2(amount) {
    globalCO2 += amount;
    if (globalCO2 < 0) globalCO2 = 0;
    
    // In 2026, you just set it. No registration required!
    world.setDynamicProperty("global_co2_level", globalCO2);
}




// 1. Connection Message
world.afterEvents.playerSpawn.subscribe((event) => {
    event.player.sendMessage("§3[SYSTEM] §fCO2 Research Environment: §aACTIVE");
});

// 2. FIXED: Block Breaking (Pollution)
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const blockId = event.brokenBlockPermutation.type.id.toLowerCase();
    const player = event.player;

    // We check for "log" (wood) and "coal_ore"
    if (blockId.includes("log") || blockId.includes("coal")) {
        updateCO2(10);
        player.onScreenDisplay.setActionBar(`§c[!] DEFORESTATION: §f+10ppm`);
    }
    if(blockId.includes("sapling") || blockId.includes("leaves")) {
         updateCO2(5);
        player.onScreenDisplay.setActionBar(`§c[!] DEFORESTATION: §f+5ppm`);
    }
});

// 3. NEW: Block Placing (Restoration)
world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const blockId = event.block.typeId.toLowerCase();
    const player = event.player;

    // If you plant a sapling or leaves, CO2 goes down
    if (blockId.includes("sapling") || blockId.includes("leaves")) {
        if (globalCO2 > 0) {
             updateCO2(-5);
            player.onScreenDisplay.setActionBar(`§a[+] REFORESTATION: §f-5ppm`);
        }
    }
});

// 4. Real-Time HUD (Always Running)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const color = globalCO2 > 100 ? "§c" : "§a";
        const status = globalCO2 > 100 ? "CRITICAL" : "STABLE";
        
        player.onScreenDisplay.setActionBar(
            `§fAtmosphere: ${color}${status} §8| §fCO2: §e${globalCO2}ppm`
        );
    }
}, 20);




system.runInterval(() => {
    // 1. Check if the threshold is met
    if (globalCO2 > 150) {
        for (const player of world.getAllPlayers()) {
            const pos = player.location;
            const dimension = player.dimension;

            // 2. FIXED: Explicit Vector3 for Particle Positioning
            // Using "minecraft:basic_smoke_particle" as it's the most stable ID
            const particleLocation = { 
                x: pos.x + (Math.random() - 0.5) * 2, 
                y: pos.y + 1.5, 
                z: pos.z + (Math.random() - 0.5) * 2 
            };

            try {
                dimension.spawnParticle("minecraft:basic_smoke_particle", particleLocation);
            } catch (e) {
                // Silently catch if particle ID fails
            }

            // 3. FIXED: Effect Application
            if (globalCO2 > 250) {
                // In some 2026 builds, duration is in ticks (20 ticks = 1 sec)
                player.addEffect("slowness", 100, { 
                    amplifier: 1, 
                    showParticles: true 
                });
                
                // Visual "gas" hint on the HUD
                player.onScreenDisplay.setActionBar("§8[!!!] SMOG WARNING: HIGH TOXICITY");
            }
        }
    }
}, 5); // Run every 10 ticks to save performance