import test from 'node:test';
import assert from 'node:assert/strict';
import {cursorRegion,mapTouch} from '../site/notes/native-mapping.js';
import {emptyLibrary,makeNote,validate} from '../site/notes/model.js';
test('cursor region follows and clamps to the large note page',()=>{
 assert.deepEqual(cursorRegion([500,700],1000,1400),{x:300,y:575,width:400,height:250});
 assert.deepEqual(cursorRegion([990,1390],1000,1400),{x:600,y:1150,width:400,height:250});
});
test('absolute finger position maps into a fixed rectangle independently of cursor motion',()=>{
 const r={x:300,y:500,width:400,height:250};
 assert.deepEqual(mapTouch({phase:'begin',x:0,y:0},r,2),[302,502]);
 assert.deepEqual(mapTouch({phase:'move',x:1,y:1},r,2),[698,748]);
 assert.deepEqual(mapTouch({phase:'move',x:.5,y:.5},r),[500,625]);
 assert.equal(mapTouch({phase:'move',x:NaN,y:0},r),null);
 assert.equal(mapTouch({phase:'move',x:1.1,y:0},r),null);
});
test('large-page backups validate without breaking existing note coordinates',()=>{
 const l=emptyLibrary(),n=makeNote();l.notes.push(n);n.pageHeight=1400;n.strokes=[{tool:'pen',color:'#253428',width:3,points:[[100,1300]]}];validate(l);
 delete n.pageHeight;assert.throws(()=>validate(l));n.strokes[0].points=[[100,600]];validate(l);
});
