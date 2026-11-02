// Sync only flashcard content. Scheduling and review history remain local.
const LIBRARY = 'lint.web.library.v1';
const STATE = 'lint.notion.sync.v1';
const fields = {Front:'title', Back:'rich_text', Deck:'rich_text', Kind:'select', Language:'select', Explanation:'rich_text', 'Lint ID':'rich_text'};
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const text = (property, type='rich_text') => {
  const parts = property?.[type] || [];
  if (parts.length >= 25) throw new Error('A Notion field is too long to read safely. Use fewer than 25 text fragments per field.');
  return parts.map(p => p.plain_text ?? p.text?.content ?? '').join('');
};
export function fromPage(page) {
  const p = page.properties;
  const value = {front:text(p.Front,'title'),back:text(p.Back),deck:text(p.Deck)||'Notion',kind:p.Kind?.select?.name||'math',language:p.Language?.select?.name||'python',explanation:text(p.Explanation)};
  validate(value);
  return {pageId:page.id,cardId:text(p['Lint ID']),value};
}
function validate(value) {
  if (!value.front.trim() || !value.back.trim()) throw new Error('Every card needs a nonempty Front and Back.');
  if (!['math','coding'].includes(value.kind) || !['python','java','javascript','swift'].includes(value.language)) throw new Error('Kind must be math or coding; Language must be python, java, javascript, or swift.');
  for (const key of ['front','back','deck','explanation']) if (value[key].length > 2000) throw new Error(`${key} exceeds the supported 2,000-character limit. No sync changes were made.`);
}
export function properties(value, id) {
  const rich = s => s ? [{type:'text',text:{content:s}}] : [];
  return {Front:{title:rich(value.front)},Back:{rich_text:rich(value.back)},Deck:{rich_text:rich(value.deck)},Kind:{select:{name:value.kind}},Language:{select:{name:value.language}},Explanation:{rich_text:rich(value.explanation)},'Lint ID':{rich_text:rich(id)}};
}
function localValue(card, library) {
  const value = {front:card.front,back:card.back,deck:library.decks.find(d=>d.id===card.deckId)?.name||'Notion',kind:card.kind,language:card.language||'python',explanation:card.explanation||''};
  validate(value); return value;
}
export async function syncLibrary({request, storage, uuid=()=>crypto.randomUUID(), now=()=>Date.now()}) {
  let raw = storage.getItem(LIBRARY);
  if (!raw) throw new Error('Open your flashcard library before syncing.');
  let library = JSON.parse(raw);
  if (library.format !== 'lint-web' || library.version !== 1 || !Array.isArray(library.cards) || !Array.isArray(library.decks)) throw new Error('The local library is invalid. Export a backup before continuing.');
  const source = await request('source');
  for (const [name,type] of Object.entries(fields)) if (source.properties?.[name]?.type !== type) throw new Error(`Notion needs a property named "${name}" of type ${type}. See the Notion setup guide.`);
  const stateKey = `${STATE}.${source.id}`;
  const state = Object.assign(Object.create(null), JSON.parse(storage.getItem(stateKey)||'{}'));
  const pages=[]; let cursor; const cursors=new Set();
  do {
    const batch=await request('query', {cursor});
    pages.push(...batch.results.filter(p=>!p.archived && !p.in_trash));
    if (pages.length>10000) throw new Error('This integration supports up to 10,000 Notion rows.');
    if (batch.has_more && (!batch.next_cursor || cursors.has(batch.next_cursor))) throw new Error('Notion returned an invalid pagination cursor.');
    cursor=batch.has_more ? batch.next_cursor : undefined; if(cursor)cursors.add(cursor);
  } while (cursor);
  // Validate every card before the first write; never silently drop malformed rows.
  const remote = pages.map(fromPage);
  const local = new Map(library.cards.map(c=>[c.id,localValue(c,library)]));
  if(local.size!==library.cards.length || library.cards.some(c=>typeof c.id!=='string'||!c.id)) throw new Error('The library contains invalid or duplicate card IDs.');
  const seen = new Set();
  for (const r of remote) if (r.cardId) {
    if (seen.has(r.cardId)) throw new Error('Duplicate Lint ID values exist in Notion. Give each card its own row.');
    seen.add(r.cardId);
  }
  const result={imported:0,exported:0,conflicts:[],unchanged:0};
  function assertUnchanged() {if(storage.getItem(LIBRARY)!==raw) throw new Error('The local library changed during sync. Earlier completed rows are saved; sync again.');}
  function save() {
    assertUnchanged();
    const next=JSON.stringify(library); storage.setItem(LIBRARY,next); raw=next;
    storage.setItem(stateKey,JSON.stringify(state));
  }
  function importCard(id,value) {
    let deck=library.decks.find(d=>d.name===value.deck);
    if(!deck) {deck={id:uuid(),name:value.deck,folderId:null};library.decks.push(deck);}
    const old=library.cards.find(c=>c.id===id);
    const card={...(old||{id,due:now(),interval:0,ease:2.5,reviews:[]}),front:value.front,back:value.back,kind:value.kind,language:value.language,explanation:value.explanation,deckId:deck.id};
    if(old) library.cards[library.cards.indexOf(old)]=card; else library.cards.push(card);
  }
  for (const r of remote) {
    assertUnchanged();
    const id=r.cardId||uuid(), value=local.get(id), baseline=state[id];
    // Keep deletions local. Do not resurrect a previously synced deleted card.
    if (!value && baseline) {result.unchanged++;continue;}
    if (!value) {
      if(!r.cardId) await request('update',{id:r.pageId,properties:{'Lint ID':properties(r.value,id)['Lint ID']}});
      importCard(id,r.value);state[id]={pageId:r.pageId,value:r.value};save();result.imported++;continue;
    }
    if (same(value,r.value)) {state[id]={pageId:r.pageId,value};save();result.unchanged++;continue;}
    if (!baseline || baseline.pageId!==r.pageId || (!same(value,baseline.value) && !same(r.value,baseline.value))) {
      result.conflicts.push(value.front.slice(0,100));continue;
    }
    if (same(value,baseline.value)) {
      importCard(id,r.value);state[id]={pageId:r.pageId,value:r.value};save();result.imported++;
    } else {
      // Recheck the row immediately before writing to reduce concurrent-edit races.
      const latest=fromPage(await request('get',{id:r.pageId}));
      if(!same(latest,r)) {result.conflicts.push(value.front.slice(0,100));continue;}
      assertUnchanged();
      await request('update',{id:r.pageId,properties:properties(value,id)});
      state[id]={pageId:r.pageId,value};save();result.exported++;
    }
  }
  for (const [id,value] of local) {
    if(seen.has(id) || state[id]) continue; // Do not recreate a deleted Notion row.
    assertUnchanged();
    const created=await request('create',{properties:properties(value,id)});
    if(!created.id) throw new Error('Notion did not confirm the created row. Sync again to reconcile.');
    state[id]={pageId:created.id,value};save();result.exported++;
  }
  return result;
}
