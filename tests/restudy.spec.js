import {test,expect} from '@playwright/test';
const library=page=>page.evaluate(()=>localStorage.getItem('lint.web.library.v1'));
test.beforeEach(async({page})=>{await page.goto('/');});
test('restudy includes future cards in only the selected deck without modifying scheduling or history',async({page})=>{
 await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('lint.web.library.v1'));v.cards.forEach(c=>{c.due=Date.now()+86400000*7;c.interval=7;});localStorage.setItem('lint.web.library.v1',JSON.stringify(v));});
 await page.reload();const before=await library(page);
 await page.locator('.deck-tile').filter({hasText:'Calculus'}).click();
 await expect(page.getByRole('button',{name:'Study now'})).toBeDisabled();
 await page.getByRole('button',{name:'Restudy deck',exact:true}).click();
 await expect(page.locator('.practice-notice')).toContainText('schedule stays unchanged');
 for(let i=0;i<2;i++){
  await expect(page.locator('.study-meta')).toContainText(`${i+1} / 2`);
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await expect(page.locator('[data-rate]')).toHaveCount(0);
  await page.getByRole('button',{name:i===0?'Next card':'Finish practice',exact:true}).click();
 }
 await expect(page.locator('.study-complete')).toContainText('You practiced 2 cards');
 expect(await library(page)).toBe(before);
 await page.locator('#session-restudy').click();
 await expect(page.locator('.study-meta')).toContainText('1 / 2');
 await expect(page.getByRole('button',{name:'Reveal answer',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.reload();expect(await library(page)).toBe(before);
});
test('normal study still schedules cards; completed decks can be restudied with fresh coding attempts',async({page})=>{
 await page.locator('.deck-tile').filter({hasText:'Algorithms'}).click();
 await page.getByRole('button',{name:'Study now'}).click();await page.getByLabel('Your code answer',{exact:true}).fill('my first attempt');
 await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.getByRole('button',{name:'Good 1d',exact:true}).click();
 const afterReview=await library(page);expect(JSON.parse(afterReview).cards.find(c=>c.kind==='coding').reviews).toHaveLength(1);
 await page.locator('#session-restudy').click();
 await expect(page.getByLabel('Your code answer',{exact:true})).toHaveText('');
 await page.getByLabel('Your code answer',{exact:true}).fill('second attempt');await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
 await expect(page.locator('#saved-solution')).toBeVisible();await page.getByRole('button',{name:'Finish practice'}).click();
 expect(await library(page)).toBe(afterReview);
});
test('empty decks cannot be restudied',async({page})=>{
 await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('lint.web.library.v1'));v.cards=[];localStorage.setItem('lint.web.library.v1',JSON.stringify(v));});await page.reload();
 await page.locator('.deck-tile').filter({hasText:'Calculus'}).click();
 await expect(page.getByRole('button',{name:'Restudy deck',exact:true})).toBeDisabled();
});
