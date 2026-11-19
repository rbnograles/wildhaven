import * as Phaser from 'phaser';
import { WORLD, CHARACTERS, LOCATIONS, NODES, nearbyNode } from './state.js';
import { loadCharacterSheets, loadImage, resolvePose } from './animation-art.js';
import mapData from '../assets/world/map/wildhaven.json';
import objectSpecs from '../assets/world/source/objects.json';
import tilesetUrl from '../assets/world/map/tileset.png';
import overviewUrl from '../assets/world/map/overview.webp';

const objectUrls=Object.fromEntries(Object.entries(import.meta.glob('../assets/world/source/objects/*.png',{eager:true,query:'?url',import:'default'}))
  .map(([path,url])=>[path.match(/([\w-]+)\.png$/)[1],url]));
const TERRAIN_LAYERS=['ground','dirt','sand','water'];
const PLAYER_HEIGHT=112;

// Phaser draws the world (tile layers, object sprites, character); game rules and input stay in state.js / main.js.
export async function createRenderer(container, miniCanvas) {
  const mini=miniCanvas.getContext('2d');
  if(!mini) throw new Error('This browser does not support the game canvas. Please try a current desktop browser.');
  const [overview,sheets]=await Promise.all([loadImage(overviewUrl,'world map'),loadCharacterSheets()]);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camera={x:0,y:0,initialized:false};
  let player,shadow,markers;

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
        for(const object of map.getObjectLayer('objects').objects) {
          const spec=objectSpecs[object.name];
          if(!spec || !this.textures.exists(`object-${object.name}`)) continue;
          this.add.image(object.x,object.y,`object-${object.name}`).setOrigin(...spec.origin).setDepth(spec.flat?-1:object.y);
        }

        markers=NODES.map(node=>({
          node,
          ring:this.add.circle(node.x,node.y-15,9,0x254432,0.81).setStrokeStyle(1.5,0xfff5ce),
          label:this.add.text(node.x,node.y-15,'+',{fontFamily:'system-ui',fontSize:'10px',color:'#fff5ce'}).setOrigin(0.5),
        }));

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

    const nearest=nearbyNode(state);
    for(const {node,ring,label} of markers) {
      const visible=!state.collected.includes(node.id),active=nearest?.id===node.id;
      ring.setVisible(visible).setRadius(active?13:9).setFillStyle(active?0xf7f1de:0x254432,active?1:0.81).setDepth(WORLD.height+1);
      label.setVisible(visible).setText(active?'E':'+').setColor(active?'#254432':'#fff5ce').setFontSize(active?12:10).setFontStyle(active?'bold':'normal').setDepth(WORLD.height+2);
    }

    const pose=resolvePose(sheets,state.character,animator.clip,animator.time,state.player.direction);
    const pivot=(pose.frame.anchorX-pose.frame.x)/pose.frame.width;
    player.setTexture(pose.key,pose.name).setOrigin(pose.flip?1-pivot:pivot,1)
      .setFlipX(pose.flip).setScale(PLAYER_HEIGHT/pose.sheet.referenceHeight)
      .setPosition(state.player.x,state.player.y+4-PLAYER_HEIGHT*pose.lift).setDepth(state.player.y);
    shadow.setPosition(state.player.x,state.player.y-1).setDepth(state.player.y-0.5);
    drawMap(mini,state,miniCanvas.width,miniCanvas.height);
  }

  return { draw, drawMap:(canvas,state)=>drawMap(canvas.getContext('2d'),state,canvas.width,canvas.height), resetCamera:()=>{camera.initialized=false;} };
}
