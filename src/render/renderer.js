import * as Phaser from 'phaser';
import { WORLD } from '../world/map.js';
import { LOCATIONS } from '../world/regions.js';
import { NODES } from '../world/nodes.js';
import { WILD } from '../data/supplies.js';
import { nearbyNode, isAvailable } from '../actions/gather.js';
import { loadCharacterSheets, loadImage, resolvePose } from '../animation/sheets.js';
import { actionProgress } from '../animation/clips.js';
import mapData from '../../assets/world/map/wildhaven.json';
import objectSpecs from '../../assets/world/source/objects.json';
import tilesetUrl from '../../assets/world/map/tileset.png';
import overviewUrl from '../../assets/world/map/overview.webp';

const objectUrls=Object.fromEntries(Object.entries(import.meta.glob('../../assets/world/source/objects/*.png',{eager:true,query:'?url',import:'default'}))
  .map(([path,url])=>[path.match(/([\w-]+)\.png$/)[1],url]));
const TERRAIN_LAYERS=['ground','dirt','sand','water'];
const PLAYER_HEIGHT=112;

// Phaser draws the world (tile layers, object sprites, character); game rules live in src/actions/ and src/world/, input in src/core/input.js.
export async function createRenderer(container, miniCanvas) {
  const mini=miniCanvas.getContext('2d');
  if(!mini) throw new Error('This browser does not support the game canvas. Please try a current desktop browser.');
  const [overview,sheets]=await Promise.all([loadImage(overviewUrl,'world map'),loadCharacterSheets()]);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camera={x:0,y:0,initialized:false};
  let player,shadow,supplies,cue,bar,snap=true;

  const scene=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('The world took too long to load. Please try again.')),20000);
    const fail=message=>{clearTimeout(timer);game.destroy(true);reject(new Error(message));};
    class WorldScene extends Phaser.Scene {
      preload() {
        this.load.on('loaderror',()=>fail('We could not load the world artwork. Check the connection and try again.'));
        this.load.image('terrain',tilesetUrl);
        for(const [name,url] of Object.entries(objectUrls)) this.load.image(`object-${name}`,url);
      }
      create() {
        this.cache.tilemap.add('world',{format:Phaser.Tilemaps.Formats.TILED_JSON,data:mapData});
        const map=this.make.tilemap({key:'world'});
        const tiles=map.addTilesetImage('terrain','terrain');
        TERRAIN_LAYERS.forEach((name,i)=>map.createLayer(name,tiles,0,0).setDepth(i-20));

        // Standing objects sort by their ground line, so the character can walk behind a tree or in front of it.
        // Harvestable wild scenery is skipped here; it is drawn with the supplies below.
        for(const object of map.getObjectLayer('objects').objects) {
          const spec=objectSpecs[object.name];
          if(!spec || WILD[object.name] || !this.textures.exists(`object-${object.name}`)) continue;
          this.add.image(object.x,object.y,`object-${object.name}`).setOrigin(...spec.origin).setScale(spec.scale??1).setDepth(spec.flat?-1:object.y);
        }

        // Supplies are sprites like the scenery around them; draw() glows the one in reach (WebGL only) and caps it with E.
        const webgl=this.renderer.type===Phaser.WEBGL;
        supplies=NODES.map(node=>{
          const spec=objectSpecs[node.sprite];
          const sprite=this.add.image(node.x,node.y,`object-${node.sprite}`).setOrigin(...spec.origin).setScale(node.scale).setDepth(spec.flat?-1:node.y);
          let glow=null;
          if(webgl){sprite.enableFilters();glow=sprite.filters.internal.addGlow(0xfff5ce,3,0,1,false,10,8).setPaddingOverride(null);glow.active=false;}
          // Cue height: the sprite's top, but on a tall tree's canopy rather than its tip, where it would crowd the HUD.
          return {node,sprite,glow,top:Math.max(node.y-sprite.displayHeight*sprite.originY,node.y-150)};
        });
        const cap=this.add.graphics().fillStyle(0x172e24,0.3).fillRoundedRect(-12,-10,24,24,6)
          .fillStyle(0xf7f1de,1).fillRoundedRect(-12,-12,24,24,6).lineStyle(1.5,0x254432,1).strokeRoundedRect(-12,-12,24,24,6);
        const key=this.add.text(0,0,'E',{fontFamily:'system-ui, sans-serif',fontSize:'13px',fontStyle:'bold',color:'#254432'}).setOrigin(0.5).setResolution(2);
        cue=this.add.container(0,0,[cap,key]).setDepth(WORLD.height+1).setVisible(false);
        bar=this.add.graphics().setDepth(WORLD.height+1);

        // Each character frame is the full sheet column, trimmed vertically, so feet sit on the frame's bottom centre.
        const addFrames=(key,sheet)=>{
          const texture=this.textures.addImage(key,sheet.image);
          const cell=sheet.image.width/4; // sheets are four columns wide
          sheet.frames.forEach((row,r)=>row.forEach((f,c)=>texture.add(`${r}-${c}`,0,f.x,f.y,f.width,f.height)));
        };
        addFrames('idle',sheets.idle);
        addFrames('profile',sheets.profile);
        for(const [id,atlas] of Object.entries(sheets.atlases)) for(const [name,sheet] of Object.entries(atlas)) addFrames(`${id}-${name}`,sheet);

        shadow=this.add.ellipse(0,0,38,14,0x172e34,0.22);
        player=this.add.image(0,0,'idle','0-0').setOrigin(0.5,1);
        this.cameras.main.setBounds(0,0,WORLD.width,WORLD.height).setRoundPixels(true);
        clearTimeout(timer);resolve(this);
      }
    }
    const game=new Phaser.Game({
      type:Phaser.AUTO,parent:container,backgroundColor:'#507345',banner:false,audio:{noAudio:true},
      scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
      input:{keyboard:false,mouse:false,touch:false}, // main.js owns input through the DOM
      render:{antialias:true},
      scene:WorldScene,
    });
  });

  function drawMap(ctx,state,w,h) {
    ctx.clearRect(0,0,w,h); ctx.drawImage(overview,0,0,w,h);
    for(const loc of LOCATIONS) {
      const x=loc.x/WORLD.width*w,y=loc.y/WORLD.height*h;
      ctx.fillStyle=state.discovered.includes(loc.id)?'#f7ecc5':'#273f32';
      ctx.strokeStyle='#fff6d7';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    const x=state.player.x/WORLD.width*w,y=state.player.y/WORLD.height*h;
    ctx.fillStyle='#ffffff';ctx.strokeStyle='#294c3b';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.stroke();
  }

  function draw(state,dt,animator) {
    // The game boots while its container is still hidden, so the canvas is sized here once it is on screen.
    const w=container.clientWidth,h=container.clientHeight;
    if(w&&h&&(scene.scale.width!==w||scene.scale.height!==h)) scene.scale.resize(w,h);
    const view=scene.cameras.main;
    const zoom=view.width<700?0.9:1.08;
    view.setZoom(zoom);
    const smoothing=reducedMotion?1:1-Math.exp(-dt*9);
    if(!camera.initialized){camera.x=state.player.x;camera.y=state.player.y;camera.initialized=true;}
    camera.x+=(state.player.x-camera.x)*smoothing; camera.y+=(state.player.y-camera.y)*smoothing;
    view.centerOn(camera.x,camera.y);

    // Gathered supplies fade out and regrown patches fade back in; switching characters (resetCamera) snaps them to that save instead.
    const nearest=nearbyNode(state),busy=animator.pending?.target,step=reducedMotion||snap?1:dt*4;
    let capped=null,working=null;snap=false;
    for(const s of supplies) {
      const gone=!isAvailable(state,s.node);
      s.sprite.setAlpha(gone?Math.max(0,s.sprite.alpha-step):Math.min(1,s.sprite.alpha+step));
      s.sprite.setVisible(s.sprite.alpha>0);
      const target=!gone&&(busy?s.node.id===busy:s.node.id===nearest?.id);
      if(s.glow)s.glow.active=target;
      if(target){if(busy)working=s;else capped=s;}
    }
    cue.setVisible(!!capped);
    if(capped)cue.setPosition(capped.node.x,capped.top-18+(reducedMotion?0:Math.sin(performance.now()/260)*2.5));
    bar.clear();
    if(working){
      const w=64,x=working.node.x-w/2,y=working.top-24,progress=actionProgress(animator);
      bar.fillStyle(0x254432,0.88).fillRoundedRect(x-2,y-2,w+4,13,6.5);
      if(progress>0)bar.fillStyle(0xf7f1de,1).fillRoundedRect(x,y,Math.max(9,w*progress),9,4.5);
    }

    // A timed action is longer than one pass of its clip, so it loops until the action ends.
    const pose=resolvePose(sheets,state.character,animator.clip,animator.time,state.player.direction,animator.pending?true:undefined);
    const pivot=(pose.frame.anchorX-pose.frame.x)/pose.frame.width;
    player.setTexture(pose.key,pose.name).setOrigin(pose.flip?1-pivot:pivot,1)
      .setFlipX(pose.flip).setScale(PLAYER_HEIGHT/pose.sheet.referenceHeight)
      .setPosition(state.player.x,state.player.y+4-PLAYER_HEIGHT*pose.lift).setDepth(state.player.y);
    shadow.setPosition(state.player.x,state.player.y-1).setDepth(state.player.y-0.5);
    drawMap(mini,state,miniCanvas.width,miniCanvas.height);
  }

  return { draw, drawMap:(canvas,state)=>drawMap(canvas.getContext('2d'),state,canvas.width,canvas.height), resetCamera:()=>{camera.initialized=false;snap=true;} };
}
