import { world, system, Dimension, Vector3, Block, System, BlockPermutation} from "@minecraft/server";
import {SAPLING} from "./config.js"



type SaplingData={

    dimId:string;
    pos:Vector3;
    maturity:number;


}

export class SaplingSys{

    private saplings:Map<string,SaplingData>
    constructor(){
        this.saplings=new Map();

    }

    private generateKey(data:SaplingData):string{
        
        return `${data.dimId}:${data.pos.x}:${data.pos.y}:${data.pos.z}`;

    }


    private addSapling(sapling:SaplingData):void{

        this.saplings.set(this.generateKey(sapling),sapling);

    }



    private storeMap():void{

        const map:string = JSON.stringify([...this.saplings]);

        world.setDynamicProperty("saplings",map);



    }

    private loadMap():boolean{

        const map = world.getDynamicProperty("saplings") as string;
        if(map){
            this.saplings = new Map(JSON.parse(map));
            return true;
        }
        return false;

    }



    private init(){
        const GROWTH_DURATION:number=500;

        system.runTimeout(()=>{

            this.loadMap();

        },50);

        //@ts-ignore
        world.beforeEvents.itemUseOn.subscribe((event)=>{
            const player = event.source;
            const item = event.itemStack;
            if(item.typeId.includes("sapling"))
            {
                const target : Vector3 =event.block.location;
                const dimension :Dimension = player.dimension;

                if(this.checkRadius(target,dimension)){
                    event.cancel=true;
                    player.sendMessage("§cToo crowded! Space out your saplings.")
                }
               


            }
        })



        //@ts-ignore
        world.beforeEvents.itemUseOn.subscribe((event)=>{
            const item = event.itemStack;
            const player= event.source;
            const dim:Dimension=world.getDimension("overworld");
            const block:Block|undefined=dim.getBlock(event.block.location);
            if(block && item.typeId.includes("bone_meal") && block.typeId.includes("sapling"))
            {
    
                event.cancel=true;
                player.sendMessage("§cCan't use bonemeal to grow saplings.");

                
            }
        })

        //@ts-ignore
        world.afterEvents.itemUseOn.subscribe((event)=>{

            const player = event.source;
            const item = event.itemStack;
            
            if(item.typeId.includes("sapling"))
            {
                const target: Vector3 = event.block.above()?.location ?? {
                x: event.block.location.x,
                y: event.block.location.y + 1,
                z: event.block.location.z,
                };
                player.sendMessage("§a Sapling is placed perfectly and waiting to grow");
                this.startGrowth(player.dimension,target,GROWTH_DURATION);


               


            }









        }) 

        



    }


    private startGrowth(dimension:Dimension,target:Vector3,duration:number):void{
        const sapling:SaplingData = {
            dimId:dimension.id,
            pos:target,
            maturity:world.getAbsoluteTime()+duration

        };

        this.addSapling(sapling);
        this.storeMap();
        if(this.saplings.size==1)
        this.scheduleGrowth();

    }

    private scheduleGrowth():void{
        const checkInterval = system.runInterval(()=>{

                for(const sapling of this.saplings.values()){
                if(world.getAbsoluteTime()>sapling.maturity){
                    const dim:Dimension=world.getDimension(sapling.dimId);
                    const block:Block|undefined=dim.getBlock(sapling.pos);
                    if (block && block.typeId.includes("sapling")){
                        this.growTree(block,sapling);
                        this.saplings.delete(this.generateKey(sapling));
                        this.storeMap();
                        if(this.saplings.size==0)
                            system.clearRun(checkInterval);
                    
                    }





             }
            }




        },5);



    }

   


    private growTree(block: Block,sapling:SaplingData):void{
    if (!block) return;

    const pos: Vector3  = block.location;
    const dim: Dimension = block.dimension;
    const shape: TreeShape | undefined = TREE_SHAPES[block.typeId];

    if (!shape) {
        console.warn(`No tree shape defined for: ${block.typeId}`);
        return;
    }


    const trunkHeight: number = shape.trunkMin +
        Math.floor(Math.random() * (shape.trunkMax - shape.trunkMin + 1));

   
    dim.runCommand(`setblock ${pos.x} ${pos.y} ${pos.z} air`);

    for (let y = 0; y < trunkHeight; y++) {
        dim.runCommand(
            `setblock ${pos.x} ${pos.y + y} ${pos.z} ${shape.trunkBlock}`
        );
    }

    const topY: number = pos.y + trunkHeight - 1;

    for (const layer of shape.canopy) {
        const layerY: number = topY + layer.dy;
        const r: number      = layer.radius;

        for (let lx = -r; lx <= r; lx++) {
            for (let lz = -r; lz <= r; lz++) {

                if (!layer.corners &&
                    Math.abs(lx) === r && Math.abs(lz) === r) continue;

                const isTrunk = (lx === 0 && lz === 0 && layer.dy <= 0);
                if (isTrunk) continue;

                dim.runCommand(
                    `setblock ${pos.x+lx} ${layerY} ${pos.z+lz} ${shape.leavesBlock} keep`
                );
            }
        }
    }

        world.sendMessage("§2A tree has matured after 3 days!! of position : "+ sapling.pos.x + sapling.pos.y + sapling.pos.z);
    }




    private checkRadius(pos:Vector3,dim:Dimension):boolean{

        let  x:number;
        let  y:number;
        let  z:number;



        for(x=-SAPLING.SPACE_RADIUS;x<=SAPLING.SPACE_RADIUS;x++){
            for(y=-SAPLING.HEIGHT_RADIUS;y<=SAPLING.HEIGHT_RADIUS;y++){
                for(z=-SAPLING.SPACE_RADIUS;z<=SAPLING.SPACE_RADIUS;z++){

                   
                    const block:Block|undefined = dim.getBlock
                    ({
                        x:pos.x+x,
                        y:pos.y+y,
                        z:pos.z+z
                    });
                    if(block && block.typeId.includes("sapling"))
                    return true;

                }
            }
            



        }

        return false;


        
    }





}



export type TreeLayer = { dy: number; radius: number; corners: boolean };

export type TreeShape = {
    trunkBlock:  string;
    leavesBlock: string;
    trunkMin:    number;
    trunkMax:    number;
    canopy:      TreeLayer[];
    quad:        boolean;       
};











export const TREE_SHAPES: Record<string, TreeShape> = {

    "minecraft:oak_sapling": {
        trunkBlock:  "minecraft:oak_log",
        leavesBlock: "minecraft:oak_leaves",
        trunkMin: 4, trunkMax: 6, quad: false,
        canopy: [
            { dy:  2, radius: 1, corners: false },
            { dy:  1, radius: 2, corners: false },
            { dy:  0, radius: 2, corners: false },
            { dy: -1, radius: 3, corners: true  },
        ],
    },

    "minecraft:birch_sapling": {
        trunkBlock:  "minecraft:birch_log",
        leavesBlock: "minecraft:birch_leaves",
        trunkMin: 5, trunkMax: 7, quad: false,
        canopy: [
            { dy:  2, radius: 1, corners: false },
            { dy:  1, radius: 2, corners: false },
            { dy:  0, radius: 2, corners: false },
            { dy: -1, radius: 2, corners: true  },
        ],
    },

    "minecraft:spruce_sapling": {
        trunkBlock:  "minecraft:spruce_log",
        leavesBlock: "minecraft:spruce_leaves",
        trunkMin: 6, trunkMax: 9, quad: false,
        canopy: [
            { dy:  1, radius: 1, corners: false },
            { dy:  0, radius: 1, corners: false },
            { dy: -1, radius: 2, corners: false },
            { dy: -2, radius: 2, corners: true  },
            { dy: -3, radius: 3, corners: true  },
            { dy: -4, radius: 3, corners: true  },
        ],
    },

    "minecraft:jungle_sapling": {
        trunkBlock:  "minecraft:jungle_log",
        leavesBlock: "minecraft:jungle_leaves",
        trunkMin: 8, trunkMax: 12, quad: false,
        canopy: [
            { dy:  2, radius: 1, corners: false },
            { dy:  1, radius: 2, corners: false },
            { dy:  0, radius: 3, corners: false },
            { dy: -1, radius: 3, corners: true  },
        ],
    },

    "minecraft:acacia_sapling": {
        trunkBlock:  "minecraft:acacia_log",
        leavesBlock: "minecraft:acacia_leaves",
        trunkMin: 5, trunkMax: 7, quad: false,
        canopy: [
            { dy:  1, radius: 3, corners: true  },
            { dy:  0, radius: 3, corners: false },
            { dy: -1, radius: 2, corners: false },
        ],
    },

    "minecraft:dark_oak_sapling": {
        trunkBlock:  "minecraft:dark_oak_log",
        leavesBlock: "minecraft:dark_oak_leaves",
        trunkMin: 5, trunkMax: 7, quad: true,   
        canopy: [
            { dy:  2, radius: 2, corners: false },
            { dy:  1, radius: 3, corners: false },
            { dy:  0, radius: 3, corners: true  },
            { dy: -1, radius: 2, corners: true  },
        ],
    },

};

export const saplingSys= new SaplingSys();