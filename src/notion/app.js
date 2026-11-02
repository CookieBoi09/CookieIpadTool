import {syncLibrary} from './sync.js';
const pending=new Map();
function request(op,data={}) {
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Notion timed out. Completed rows are saved; sync again.'));},90000);
    pending.set(id,{resolve,reject,timer});
    window.webkit.messageHandlers.lintNative.postMessage({type:'notionRequest',id,op,data});
  });
}
window.lintNotion={
  reply(id,value,error) {
    const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);
    error?p.reject(new Error(error)):p.resolve(value);
  },
  async sync() {
    if(document.querySelector('dialog[open]')) return {message:'Close the card editor or dialog before syncing. Unsaved edits have not been changed.',reload:false};
    try {
      const r=await syncLibrary({request,storage:localStorage});
      return {reload:true,message:`${r.imported} imported or updated in Lint; ${r.exported} exported or updated in Notion.\n${r.conflicts.length} conflicts left unchanged.${r.conflicts.length?'\n\nEdit these cards to match on both sides, then sync again:\n'+r.conflicts.slice(0,8).join('\n'):''}`};
    } catch(e) {return {reload:true,message:`Sync stopped: ${e.message}\nCompleted rows are saved. Fix the issue and sync again; do not delete Lint IDs.`};}
  }
};
