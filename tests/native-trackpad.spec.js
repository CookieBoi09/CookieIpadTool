import {test,expect} from '@playwright/test';
async function frame(page,detail){await page.evaluate(detail=>window.dispatchEvent(new CustomEvent('lint-native-trackpad',{detail})),detail);}
const data=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('lint.web.notes.v1')));
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{window.nativeCalls=[];window.lintNative={platform:'macOS',setEnabled:v=>window.nativeCalls.push(['enabled',v]),setArmed:v=>window.nativeCalls.push(['armed',v])};});
 await page.goto('/');await page.getByRole('button',{name:'Notes',exact:true}).click();await page.locator('#notes-new-note').click();
});
async function position(page){const svg=page.locator('#note-canvas');await svg.scrollIntoViewIfNeeded();const r=await svg.boundingBox();await page.mouse.click(r.x+r.width*.4,r.y+r.height*.4);return r;}
test('native rectangle tracks cursor, locks during raw drawing, and saves mapped strokes',async({page})=>{
 await expect(page.locator('#note-canvas')).toHaveAttribute('viewBox','0 0 1000 1400');
 const r=await position(page);const box=page.locator('.native-trackpad-region');const x=await box.getAttribute('x');
 await page.mouse.move(r.x+r.width*.6,r.y+r.height*.4);expect(await box.getAttribute('x')).not.toBe(x);
 const frozen=await box.getAttribute('x');await page.keyboard.down('Space');
 await page.mouse.move(r.x+r.width*.2,r.y+r.height*.5);await expect(box).toHaveAttribute('x',frozen);
 await expect(page.locator('#note-canvas path')).toHaveCount(0);
 await frame(page,{type:'touch',phase:'begin',x:0,y:0});await frame(page,{type:'touch',phase:'move',x:1,y:1});await frame(page,{type:'touch',phase:'end'});
 await page.keyboard.up('Space');
 const note=(await data(page)).notes[0];expect(note.pageHeight).toBe(1400);expect(note.strokes).toHaveLength(1);expect(note.strokes[0].points[1][0]-note.strokes[0].points[0][0]).toBe(397);
 await frame(page,{type:'touch',phase:'begin',x:.5,y:.5});await expect(page.locator('#note-canvas path')).toHaveCount(1);
 await page.mouse.move(r.x+r.width*.3,r.y+r.height*.4);expect(await box.getAttribute('x')).not.toBe(frozen);
});
test('native highlighter and contact separation preserve pen-up boundaries',async({page})=>{
 await page.getByRole('button',{name:'Highlighter',exact:false}).click();await position(page);await page.keyboard.down('Space');
 for(let i=0;i<2;i++){await frame(page,{type:'touch',phase:'begin',x:.2,y:.3});await frame(page,{type:'touch',phase:'move',x:.8,y:.7});await frame(page,{type:'touch',phase:'end'});}
 await frame(page,{type:'released'});await page.keyboard.up('Space');
 expect((await data(page)).notes[0].strokes).toHaveLength(2);await expect(page.locator('#note-canvas path').first()).toHaveAttribute('opacity','0.3');await expect(page.locator('#ink-mode')).toHaveText('SCROLL MODE');
});
test('cursor fallback draws without raw touch data and focus loss disarms capture',async({page})=>{
 await page.getByRole('button',{name:'Trackpad positioning: on'}).click();const r=await position(page);await page.keyboard.down('Space');await page.mouse.move(r.x+r.width*.5,r.y+r.height*.45,{steps:5});await page.keyboard.up('Space');
 await expect(page.locator('#note-canvas path')).toHaveCount(1);
 await page.getByRole('button',{name:'Trackpad positioning: off'}).click();await position(page);await page.keyboard.down('Space');await frame(page,{type:'touch',phase:'begin',x:.3,y:.4});await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');
 const count=(await data(page)).notes[0].strokes.length;await frame(page,{type:'touch',phase:'move',x:.8,y:.9});expect((await data(page)).notes[0].strokes.length).toBe(count);
 expect(await page.evaluate(()=>window.nativeCalls.at(-1))).toEqual(['armed',false]);
});
