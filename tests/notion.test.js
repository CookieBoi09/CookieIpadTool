import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncLibrary, properties} from '../src/notion/sync.js';
const key='lint.web.library.v1';
const content={front:'Question',back:'Answer',deck:'Deck',kind:'math',language:'python',explanation:''};
const card=(id='c1')=>({id,deckId:'d1',front:'Question',back:'Answer',kind:'math',language:'python',due:123,interval:7,ease:2.1,reviews:[{date:42,rating:'good'}]});
function page(id,value,cardId){return {id,properties:properties(value,cardId)};}
function setup(cards=[card()],pages=[]) {
 const data=new Map([[key,JSON.stringify({format:'lint-web',version:1,folders:[],decks:[{id:'d1',name:'Deck',folderId:null}],cards})]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const schema=Object.fromEntries(Object.entries(properties(content,'c1')).map(([name,p])=>[name,{type:Object.keys(p)[0]}]));
 const calls=[];let serial=0;
 const request=async(op,arg={})=>{
  calls.push({op,arg});
  if(op==='source')return {id:'source-1',properties:schema};
  if(op==='query')return {results:pages,has_more:false};
  if(op==='get')return pages.find(p=>p.id===arg.id);
  if(op==='create'){const p={id:`p${++serial}`,properties:arg.properties};pages.push(p);return p;}
  if(op==='update'){const p=pages.find(p=>p.id===arg.id);p.properties={...p.properties,...arg.properties};return p;}
  throw Error(op);
 };
 return {storage,request,calls,pages,schema,run:()=>syncLibrary({storage,request,uuid:()=>`new-${++serial}`,now:()=>999}),library:()=>JSON.parse(storage.getItem(key)),save:v=>storage.setItem(key,JSON.stringify(v))};
}
test('first sync exports cards once; repeated sync is idempotent',async()=>{
 const s=setup();assert.equal((await s.run()).exported,1);assert.equal((await s.run()).unchanged,1);assert.equal(s.pages.length,1);assert.deepEqual(s.library().cards[0],card());
});
test('imports new Notion rows and assigns a stable Lint ID',async()=>{
 const s=setup([],[page('p1',content,'')]);assert.equal((await s.run()).imported,1);const c=s.library().cards[0];assert.equal(c.front,'Question');assert.equal(c.due,999);assert.equal((await s.run()).unchanged,1);assert.equal(s.library().cards.length,1);
});
test('remote changes update content but preserve local review schedule',async()=>{
 const s=setup();await s.run();s.pages[0].properties=properties({...content,back:'Changed in Notion'},'c1');await s.run();assert.deepEqual(s.library().cards[0],{...card(),back:'Changed in Notion',explanation:''});
});
test('local changes export and do not reset review history',async()=>{
 const s=setup();await s.run();const lib=s.library();lib.cards[0].back='Changed in Lint';s.save(lib);assert.equal((await s.run()).exported,1);assert.equal(s.pages[0].properties.Back.rich_text[0].text.content,'Changed in Lint');
});
test('simultaneous edits report conflict and preserve both versions',async()=>{
 const s=setup();await s.run();const lib=s.library();lib.cards[0].back='Local';s.save(lib);s.pages[0].properties=properties({...content,back:'Remote'},'c1');const r=await s.run();assert.equal(r.conflicts.length,1);assert.equal(s.library().cards[0].back,'Local');assert.equal(s.pages[0].properties.Back.rich_text[0].text.content,'Remote');
});
test('deletions never propagate or resurrect synced cards',async()=>{
 const s=setup();await s.run();const lib=s.library();lib.cards=[];s.save(lib);await s.run();assert.equal(s.library().cards.length,0);assert.equal(s.pages.length,1);
 const t=setup();await t.run();t.pages.length=0;await t.run();assert.equal(t.pages.length,0);assert.equal(t.library().cards.length,1);
});
test('duplicate IDs and schema errors fail before writes',async()=>{
 const s=setup([],[page('p1',content,'same'),page('p2',content,'same')]);await assert.rejects(s.run(),/Duplicate Lint ID/);assert.equal(s.calls.some(c=>['create','update'].includes(c.op)),false);
 const t=setup();t.schema.Back.type='number';await assert.rejects(t.run(),/Back/);assert.equal(t.pages.length,0);
});
test('all query pages are read before importing',async()=>{
 const s=setup([]);let queries=0;
 const request=async(op,arg)=>op==='query'?(++queries===1?{results:[page('p1',content,'a')],has_more:true,next_cursor:'next'}:{results:[page('p2',{...content,front:'Second'},'b')],has_more:false}):s.request(op,arg);
 const r=await syncLibrary({...s,request});assert.equal(queries,2);assert.equal(r.imported,2);assert.equal(s.library().cards.length,2);
});
test('a remote edit between query and write becomes a conflict',async()=>{
 const s=setup();await s.run();const lib=s.library();lib.cards[0].back='Local';s.save(lib);
 const request=async(op,arg)=>op==='get'?page('p1',{...content,back:'Concurrent'},'c1'):s.request(op,arg);
 assert.equal((await syncLibrary({...s,request})).conflicts.length,1);
});
test('local edits during a request stop application without overwriting them',async()=>{
 const s=setup([],[page('p1',content,'a')]);const request=async(op,arg)=>{const r=await s.request(op,arg);if(op==='query'){const lib=s.library();lib.decks[0].name='Edited';s.save(lib);}return r;};
 await assert.rejects(syncLibrary({...s,request}),/library changed/);assert.equal(s.library().decks[0].name,'Edited');
});
test('partial create failure can be retried without duplicate rows',async()=>{
 const s=setup([card('a'),{...card('b'),front:'Second'}]);let creates=0;
 const request=async(op,arg)=>{if(op==='create'&&++creates===2)throw Error('Offline');return s.request(op,arg);};
 await assert.rejects(syncLibrary({...s,request}),/Offline/);assert.equal(s.pages.length,1);await s.run();assert.equal(s.pages.length,2);
});
test('oversized fields stop sync before any writes',async()=>{
 const s=setup([{...card(),back:'x'.repeat(2001)}]);await assert.rejects(s.run(),/2,000/);assert.equal(s.pages.length,0);
});
