import idleUrl from '../assets/characters/starting-characters-idle-v1.png';
import sideWalkUrl from '../assets/characters/animations/side-walk-v2.png';
import scoutRun from '../assets/characters/animations/scout-run-v2.png';
import builderRun from '../assets/characters/animations/builder-run-v2.png';
import survivorRun from '../assets/characters/animations/survivor-run-v2.png';
import scoutWalk from '../assets/characters/animations/scout-locomotion.png';
import builderWalk from '../assets/characters/animations/builder-locomotion.png';
import survivorWalk from '../assets/characters/animations/survivor-locomotion.png';
import scoutActions from '../assets/characters/animations/scout-actions.png';
import builderActions from '../assets/characters/animations/builder-actions.png';
import survivorActions from '../assets/characters/animations/survivor-actions.png';
import {CHARACTERS} from './state.js';
import {sampleAnimation,steadyAnchors} from './animation.js';

// Measured transparent gutters, rather than assumed equal rows, preserve all generated poses.
const SOURCES={
  scout:{locomotion:{url:scoutWalk,edges:[0,228,447,663,889,1112,1331,1547,1774]},actions:{url:scoutActions,edges:[0,295,592,852,1153,1402]}},
  builder:{locomotion:{url:builderWalk,edges:[0,228,446,667,891,1109,1332,1552,1774]},actions:{url:builderActions,edges:[0,308,627,890,1190,1402]}},
  survivor:{locomotion:{url:survivorWalk,edges:[0,241,456,675,902,1119,1331,1554,1774]},actions:{url:survivorActions,edges:[0,298,602,883,1188,1402]}},
};

export function loadImage(url,label='character artwork'){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const timer=setTimeout(()=>reject(new Error(`The ${label} took too long to load. Please try again.`)),15000);
    image.onload=()=>{clearTimeout(timer);resolve(image);};
    image.onerror=()=>{clearTimeout(timer);reject(new Error(`We could not load the ${label}. Please try again.`));};
    image.src=url;
  });
}

function measureFrames(image,edges,steady=false,columns=4){
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Your browser could not prepare the animation frames.');
  ctx.drawImage(image,0,0);const {data}=ctx.getImageData(0,0,image.width,image.height);
  const frames=[];
  for(let row=0;row<edges.length-1;row++){
    const strip=[];
    for(let col=0;col<columns;col++){
      const left=Math.round(col*image.width/columns),right=Math.round((col+1)*image.width/columns),top=edges[row],bottom=edges[row+1];
      let minX=right,minY=bottom,maxX=left,maxY=top;
      for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        if(data[(y*image.width+x)*4+3]>40){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      }
      if(minX>maxX || minY>maxY)throw new Error('An animation frame is empty. Please reload the artwork.');
      // Centre of the head band (top quarter of the cell height, limbs never reach it).
      let headSum=0,headCount=0;
      for(let y=minY,end=Math.min(maxY,minY+Math.round((bottom-top)/4));y<=end;y++)for(let x=minX;x<=maxX;x++){
        if(data[(y*image.width+x)*4+3]>40){headSum+=x;headCount++;}
      }
      strip.push({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,anchorX:(left+right)/2,headX:headSum/headCount});
    }
    if(steady){
      const anchors=steadyAnchors(strip.map(frame=>frame.anchorX),strip.map(frame=>frame.headX));
      strip.forEach((frame,i)=>{frame.anchorX=anchors[i];});
    }
    frames.push(strip);
  }
  // One scale per sheet preserves crouching and horizontal swimming proportions.
  return {image,frames,referenceHeight:Math.max(...frames[0].map(frame=>frame.height))};
}

let cached;
// Resolves to {idle, atlases:{[characterId]:{locomotion, actions}}}; each sheet is {image, frames[row][col], referenceHeight}.
export function loadCharacterSheets(){
  if(cached)return cached;
  cached=(async()=>{
    const idle=measureFrames(await loadImage(idleUrl),[0,418,836,1254]);
    const profile=measureFrames(await loadImage(sideWalkUrl),[0,418,836,1254],true);
    const atlases={};
    await Promise.all(CHARACTERS.map(async character=>{
      const source=SOURCES[character.id];
      const sheets=await Promise.all(['locomotion','actions'].map(async name=>[name,measureFrames(await loadImage(source[name].url),source[name].edges)]));
      atlases[character.id]=Object.fromEntries(sheets);
      const runSheets = {
        scout:[scoutRun, [0,290,579,887]],
        builder:[builderRun, [0,292,579,887]],
        survivor:[survivorRun, [0,294,583,887]],
      };
      const [url,edges] = runSheets[character.id];
      atlases[character.id].run = measureFrames(await loadImage(url),edges,true,6);
    }));
    return {idle,atlases,profile};
  })().catch(error=>{cached=null;throw error;});
  return cached;
}

// 2D-canvas painter over the same sheets, used by the animation preview dialog.
export function resolvePose(sheets,characterId,clip,time,direction,loop){
  const sample=sampleAnimation(clip,time,direction,loop);
  const character=CHARACTERS.find(c=>c.id===characterId)??CHARACTERS[0];
  const profile=clip==='walk' && (direction===1 || direction===2);
  const key=profile?'profile':sample.sheet==='idle'?'idle':character.id+'-'+sample.sheet;
  const sheet=sheets[key]??sheets.atlases[character.id][sample.sheet];
  const row=profile || sample.sheet==='idle'?character.row:sample.row;
  const column=sample.sheet==='idle'?sample.direction:sample.frame;
  return {sheet,key,name:row+'-'+column,frame:sheet.frames[row][column],flip:sample.flip||(profile&&direction===1),lift:sample.lift};
}
export async function loadCharacterPainter(){
  const sheets=await loadCharacterSheets();
  return {
    draw(ctx,characterId,clip,time,direction,x,y,height=105,loop){
      const {sheet,frame,flip,lift}=resolvePose(sheets,characterId,clip,time,direction,loop);
      const scale=height/sheet.referenceHeight;
      ctx.save();ctx.translate(x,y-height*lift);if(flip)ctx.scale(-1,1);
      ctx.drawImage(sheet.image,frame.x,frame.y,frame.width,frame.height,(frame.x-frame.anchorX)*scale,-frame.height*scale,frame.width*scale,frame.height*scale);
      ctx.restore();
    }
  };
}
