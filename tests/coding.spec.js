import {test,expect} from '@playwright/test';
const library=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('lint.web.library.v1')));
async function deck(page){await page.locator('.deck-tile').filter({hasText:'Algorithms'}).click();}
async function fixture(page,language='python'){
 await page.evaluate(language=>{
  const value=JSON.parse(localStorage.getItem('lint.web.library.v1'));
  const card=value.cards.find(c=>c.kind==='coding');
  card.front='Print forty-two.';card.back=language==='java'?'System.out.println(42);':'print(42)';card.explanation='Multiply six by seven.\nTime complexity: O(1).';card.language=language;card.due=Date.now()-1000;
  localStorage.setItem('lint.web.library.v1',JSON.stringify(value));
 },language);await page.reload();await deck(page);
}
test.beforeEach(async({page})=>{await page.goto('/');});
test('authors can save separate solution code and explanation and reopen both',async({page})=>{
 await deck(page);await page.getByRole('button',{name:'+ Add card',exact:true}).click();
 await page.getByLabel('Card type',{exact:true}).selectOption('coding');
 await page.getByLabel('FRONT · QUESTION').fill('Print an answer');
 await page.locator('#code-editor .cm-content').fill('print(42)');
 await page.getByLabel('EXPLANATION',{exact:true}).fill('This prints the answer.\nKeep the code and reasoning separate.');
 await page.getByRole('button',{name:'Save card',exact:true}).click();
 const card=(await library(page)).cards.find(c=>c.front==='Print an answer');
 expect(card.back).toBe('print(42)');expect(card.explanation).toContain('reasoning separate');
 await page.reload();await deck(page);await page.locator('.card-row').filter({hasText:'Print an answer'}).click();
 await expect(page.getByLabel('EXPLANATION',{exact:true})).toHaveValue(card.explanation);
 await expect(page.locator('#code-editor .cm-content')).toHaveText(card.back);
});
test('Python answer stays hidden from the solution until reveal, then compares without modifying the card',async({page})=>{
 await fixture(page);const original=(await library(page)).cards.find(c=>c.kind==='coding');
 await page.getByRole('button',{name:'Study now'}).click();
 await expect(page.locator('#saved-solution')).toHaveCount(0);await expect(page.locator('#solution-explanation')).toHaveCount(0);
 await page.getByLabel('Your code answer',{exact:true}).fill('print(6 * 7)');
 await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
 await expect(page.getByLabel('Your code answer',{exact:true})).toHaveText('print(6 * 7)');
 await expect(page.locator('#saved-solution')).toHaveText('print(42)');
 await expect(page.locator('#comparison-status')).toHaveAttribute('data-result','different');
 await expect(page.locator('.answer-comparison')).toContainText('Different code can still be correct');
 await expect(page.locator('#solution-explanation')).toHaveText(original.explanation);
 await page.getByText('View line-by-line differences',{exact:true}).click();
 await expect(page.locator('.diff-answer')).toContainText('print(6 * 7)');await expect(page.locator('.diff-solution')).toContainText('print(42)');
 await page.getByLabel('Your code answer',{exact:true}).fill('print(42)');await page.getByRole('button',{name:'Compare again'}).click();
 await expect(page.locator('#comparison-status')).toHaveAttribute('data-result','match');
 await page.getByRole('button',{name:'Good 1d',exact:true}).click();
 const after=(await library(page)).cards.find(c=>c.id===original.id);expect(after.back).toBe(original.back);expect(after.explanation).toBe(original.explanation);expect(after.reviews).toHaveLength(1);
});
test('Java answers compare and blank attempts are not presented as correct',async({page})=>{
 await fixture(page,'java');await page.getByRole('button',{name:'Study now'}).click();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
 await expect(page.locator('#comparison-status')).toHaveAttribute('data-result','empty');
 await page.getByLabel('Your code answer',{exact:true}).fill('System.out.println(42);');await page.getByRole('button',{name:'Compare again'}).click();
 await expect(page.locator('#comparison-status')).toHaveAttribute('data-result','match');
 await page.setViewportSize({width:390,height:844});
 expect(await page.locator('#modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
test('older cards without explanation still review and math cards are unchanged',async({page})=>{
 await deck(page);await page.getByRole('button',{name:'Study now'}).click();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
 await expect(page.locator('#solution-explanation')).toContainText('No explanation has been added');await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Overview',exact:true}).click();await page.locator('.deck-tile').filter({hasText:'Calculus'}).click();
 await page.getByRole('button',{name:'Study now'}).click();await expect(page.locator('#your-code')).toHaveCount(0);await expect(page.locator('#study-card .katex')).not.toHaveCount(0);
 await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await expect(page.locator('.ratings')).toBeVisible();
});
test('explanations export in backups and render as safe plain text',async({page})=>{
 await fixture(page);await page.locator('.card-row').first().click();await page.getByLabel('EXPLANATION',{exact:true}).fill('<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Save card',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:false}).first().click();const download=await downloadPromise;const stream=await download.createReadStream();let data='';for await(const chunk of stream)data+=chunk;
 expect(JSON.parse(data).cards.find(c=>c.kind==='coding').explanation).toContain('<img');
 await page.getByRole('button',{name:'Study now'}).click();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
 await expect(page.locator('#solution-explanation')).toHaveText('<img src=x onerror=alert(1)>');await expect(page.locator('#solution-explanation img')).toHaveCount(0);
});
