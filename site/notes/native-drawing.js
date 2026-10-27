import {cursorRegion,mapTouch} from './native-mapping.js';
export function attachNativeDrawing(svg,{getNote,getTool,changed,status,active,makePath}) {
  const bridge=window.lintNative;
  let native=true,space=false,current=null,path=null,last=null,region=null,waiting;
  const box=document.createElementNS('http://www.w3.org/2000/svg','rect');
  box.setAttribute('class','native-trackpad-region');box.setAttribute('pointer-events','none');box.setAttribute('fill','none');box.setAttribute('stroke','#617e44');box.setAttribute('stroke-width','2');box.setAttribute('stroke-dasharray','5 7');box.style.display='none';svg.append(box);
  const controls=document.createElement('div');controls.className='native-trackpad-controls';
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Trackpad positioning: on';toggle.setAttribute('aria-pressed','true');
  const hint=document.createElement('span');hint.setAttribute('role','status');hint.textContent='Position the dotted rectangle. Hold Space, then place one finger on the trackpad.';
  controls.append(toggle,hint);svg.parentElement.before(controls);
  bridge.setEnabled(true);
  const editable=target=>target instanceof Element&&!!target.closest('input,textarea,select,button,a,[contenteditable="true"]');
  function point(event){const r=svg.getBoundingClientRect();const v=svg.viewBox.baseVal;const x=(event.clientX-r.left)/r.width*v.width,y=(event.clientY-r.top)/r.height*v.height;return x>=0&&x<=v.width&&y>=0&&y<=v.height?[x,y]:null;}
  function position(p){const v=svg.viewBox.baseVal;region=cursorRegion(p,v.width,v.height);for(const [key,value]of Object.entries(region))box.setAttribute(key,value);box.style.display='';}
  function finish(){if(current){current=null;path=null;changed();}}
  function disarm(notify=true){space=false;clearTimeout(waiting);finish();svg.classList.remove('writing');status(false);if(notify)bridge.setArmed(false);}
  function add(p){if(!current){current={...getTool(),points:[p]};getNote().strokes.push(current);path=makePath(current);svg.append(path);svg.append(box);}else{const previous=current.points.at(-1);if(Math.hypot(p[0]-previous[0],p[1]-previous[1])<.6)return;current.points.push(p);path.setAttribute('d',`M${current.points.map(p=>p.join(' ')).join(' L')}`);}}
  function move(event){if(!active()||event.pointerType==='touch')return;const p=point(event);if(space){if(!native){if(p&&region&&p[0]>=region.x&&p[0]<=region.x+region.width&&p[1]>=region.y&&p[1]<=region.y+region.height)add(p);else finish();}return;}last=p;if(p)position(p);else box.style.display='none';}
  function down(event){if(active()&&event.pointerType!=='touch'&&event.button===0){svg.focus({preventScroll:true});last=point(event);if(last)position(last);}}
  function keydown(event){if(!active()||editable(event.target)||document.querySelector('dialog[open]')||event.code!=='Space'||event.metaKey||event.ctrlKey||event.altKey||!last)return;event.preventDefault();if(space)return;space=true;position(last);svg.classList.add('writing');status(true);if(native){bridge.setArmed(true);hint.textContent='Rectangle locked. Place one finger on the trackpad; lift it between strokes.';waiting=setTimeout(()=>{if(space&&!current)hint.textContent='No touch received. Lift your finger and touch again inside Lint, or turn trackpad positioning off for cursor drawing.';},2500);}else add(last);}
  function keyup(event){if(event.code==='Space')disarm();}
  function frame(event){const data=event.detail;if(!data||typeof data!=='object')return;if(data.type==='released'){disarm(false);return;}if(data.type==='scroll'){finish();return;}if(!space||!native||!active()||!region||data.type!=='touch')return;if(data.phase==='end'){finish();return;}const p=mapTouch(data,region,getTool().width/2);if(!p){finish();return;}clearTimeout(waiting);if(data.phase==='begin')finish();hint.textContent='Drawing from absolute finger position. Release Space to reposition.';add(p);}
  function focus(event){if(editable(event.target)||!svg.contains(event.target))disarm();}
  function visibility(){if(document.hidden)disarm();}
  function blur(){disarm();last=null;}
  function wheel(){finish();if(!space){last=null;box.style.display='none';}}
  toggle.onclick=()=>{disarm();native=!native;bridge.setEnabled(native);toggle.textContent=`Trackpad positioning: ${native?'on':'off'}`;toggle.setAttribute('aria-pressed',String(native));hint.textContent=native?'Hold Space, then place one finger on the trackpad.':'Cursor fallback: hold Space and move the pointer inside the locked rectangle.';};
  window.addEventListener('pointermove',move);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);window.addEventListener('pointercancel',blur);window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('lint-native-trackpad',frame);document.addEventListener('focusin',focus);document.addEventListener('visibilitychange',visibility);svg.addEventListener('pointerdown',down);
  return {finish:()=>disarm(),destroy(){disarm();bridge.setEnabled(false);window.removeEventListener('pointermove',move);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);window.removeEventListener('pointercancel',blur);window.removeEventListener('wheel',wheel);window.removeEventListener('lint-native-trackpad',frame);document.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);svg.removeEventListener('pointerdown',down);box.remove();controls.remove();}};
}
