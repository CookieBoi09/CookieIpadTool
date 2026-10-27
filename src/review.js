// Injected into the preserved flashcard closure by scripts/update-flashcards.py.
// Adapter bindings: me=library, re=dialog, xo=showDialog, Sg=CodeMirror editor,
// ha=math renderer, ps=transactional persistence, $0=scheduler, yo=cleanup.
function xA(deckId, practice = false) {
  const deckCards = me.cards.filter(card=>!deckId || card.deckId===deckId);
  const queue = (practice ? deckCards : dr(deckCards)).sort((a,b)=>a.due-b.due).map(card=>card.id);
  const total=queue.length, attempts=new Map(); let completed=0;
  if(!total){$i(practice ? 'Add a card to this deck before restudying.' : 'All caught up. No cards due yet.');return;}
  function draw(revealed=false) {
    const card=me.cards.find(c=>c.id===queue[0]);
    if(!card) {
      xo(`${wo('SESSION COMPLETE','A little more learned.')}<div class="study-complete"><span>✓</span><p>You ${practice?'practiced':'reviewed'} <strong>${completed}</strong> cards. Let that settle in.</p><p class="field-hint">${practice?'Your review schedule is unchanged.':'Cards graded Again will be due in one minute.'}</p>${deckId?'<button class="outline" id="session-restudy">Restudy deck</button>':''}<button class="primary" data-close>Back to library</button></div>`);
      re.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>{wi();kt();});
      re.querySelector('#session-restudy')?.addEventListener('click',()=>xA(deckId,true));kt();return;
    }
    const coding=card.kind==='coding';
    const answer = attempts.get(card.id) || '';
    xo(`${wo(Pe(me.decks.find(d=>d.id===card.deckId).name),revealed?'Compare and reflect.':'Try it yourself.')}<div class="study-meta"><span>${coding?'⌘ Code':'ƒ Math'}</span><span>${completed+1} / ${total}</span></div>${practice?'<p class="practice-notice">Restudy mode · All cards in this deck. Your review schedule stays unchanged.</p>':''}<progress max="${total}" value="${completed}" aria-label="Review progress"></progress><div id="study-card" class="study-card"></div>${coding?`<div class="coding-answer-grid ${revealed?'is-revealed':''}"><section aria-labelledby="your-answer-title"><h3 id="your-answer-title">Your answer</h3><div id="your-code" class="code-container"></div><p class="field-hint">Practice here. Your answer stays separate from the saved card.</p></section>${revealed?'<section aria-labelledby="solution-title"><h3 id="solution-title">Saved solution</h3><pre id="saved-solution" class="saved-solution" tabindex="0" aria-label="Saved solution code"></pre></section>':''}</div>${revealed?'<section class="answer-comparison" aria-label="Answer comparison"><div id="comparison-status" role="status"></div><p class="field-hint">This compares code text, not program behavior. Different code can still be correct. Indentation and spaces are preserved; line endings are normalized.</p><button class="outline" id="compare-again">Compare again</button><div id="code-diff"></div></section><section class="solution-explanation"><h3>Explanation</h3><div id="solution-explanation"></div></section>':''}`:''}${revealed&&practice?`<div class="reveal-row"><span>Practice only · no scheduling changes</span><button class="primary" id="practice-next">${queue.length===1?'Finish practice':'Next card'}</button></div>`:revealed?`<p class="field-hint">How well did you understand the solution?</p><div class="ratings">${ma.map(rating=>`<button data-rate="${rating}" class="rate-${rating}"><strong>${rating[0].toUpperCase()+rating.slice(1)}</strong><span>${rating==='again'?'1 min':`${Math.round($0(card,rating).interval)}d`}</span></button>`).join('')}</div>`:'<div class="reveal-row"><span>Try an answer before revealing the solution.</span><button class="primary" id="reveal">Reveal answer</button></div>'}`,true);
    const question=re.querySelector('#study-card');
    if(coding)question.textContent=card.front;else ha(question,revealed?card.back:card.front);
    let editor;
    if(coding) {
      editor=Sg(re.querySelector('#your-code'),answer,card.language,value=>attempts.set(card.id,value));
      editor.contentDOM.setAttribute('aria-label','Your code answer');
      if(revealed) {
        re.querySelector('#saved-solution').textContent=card.back;
        re.querySelector('#solution-explanation').textContent=card.explanation?.trim() || 'No explanation has been added to this card yet.';
        function compare() {
          const result=compareAnswers(editor.state.doc.toString(),card.back);
          const status=re.querySelector('#comparison-status');
          status.textContent=result.status==='empty'?'No answer entered yet.':result.status==='match'?'Your code text matches the saved solution.':'Your code differs from the saved solution.';
          status.dataset.result=result.status;
          const container=re.querySelector('#code-diff');container.replaceChildren();
          if(result.limited){const p=document.createElement('p');p.className='field-hint';p.textContent='This answer is too large for line-by-line highlighting. Compare the two code panels above.';container.append(p);}
          else if(result.rows.length) {
            const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='View line-by-line differences';details.append(summary);
            const legend=document.createElement('p');legend.className='field-hint';legend.textContent='− Only in your answer · + Only in the solution · Unmarked lines match';details.append(legend);
            const pre=document.createElement('pre');pre.className='code-diff-lines';
            for(const row of result.rows) {
              const line=document.createElement('span');line.className=`diff-line diff-${row.kind}`;
              line.textContent=`${row.kind==='answer'?'−':row.kind==='solution'?'+':' '} ${row.text}\n`;pre.append(line);
            }
            details.append(pre);container.append(details);
          }
        }
        compare();re.querySelector('#compare-again').onclick=compare;
      }
    }
    yo=()=>editor?.destroy();
    re.querySelector('#reveal')?.addEventListener('click',()=>draw(true));
    re.querySelector('#practice-next')?.addEventListener('click',()=>{queue.shift();completed++;draw();});
    re.querySelectorAll('[data-rate]').forEach(button=>button.onclick=()=>{
      if(ps(value=>{const i=value.cards.findIndex(c=>c.id===card.id);value.cards[i]=$0(value.cards[i],button.dataset.rate);})){queue.shift();completed++;kt();draw();}
    });
  }
  draw();
}
