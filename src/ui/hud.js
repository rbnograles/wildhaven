import { RESOURCES } from '../data/supplies.js';
import { NODES } from '../world/nodes.js';
import { regionAt } from '../world/regions.js';
import { nearbyNode, hasGathered } from '../actions/gather.js';
import { $ } from './layout.js';

const DOING={Chop:'Chopping',Pick:'Picking',Gather:'Gathering'};

export function createHud(session) {
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');
    toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);
  }
  function update() {
    const {state,animator}=session;
    for(const resource of RESOURCES)$(resource).textContent=state.resources[resource];
    $('region-name').textContent=regionAt(state.player);
    $('discovery-count').textContent=`${state.discovered.length} / 3`;
    $('quest-gather').classList.toggle('complete',hasGathered(state));
    $('quest-explore').classList.toggle('complete',state.discovered.length===3);
    if(hasGathered(state)&&state.discovered.length===3)$('quest-text').textContent='You have found your feet. Keep exploring — this is just the beginning.';
    else $('quest-text').textContent='Gather supplies and follow the paths to discover the world.';
    const node=nearbyNode(state),busy=NODES.find(n=>n.id===animator.pending?.target),button=$('interact');
    button.hidden=!node&&!busy;button.classList.toggle('busy',!!busy);button.setAttribute('aria-disabled',String(!!busy));
    if(busy)button.querySelector('span').textContent=`${DOING[busy.verb]} ${busy.label.toLowerCase()}… move to stop`;
    else if(node)button.querySelector('span').textContent=`${node.verb} ${node.label.toLowerCase()}`;
  }
  return {notify,update};
}
