"""Apply guarded UI patches and insert readable review source into the recovered bundle.
The original dependency bundle is retained; no minified dependency code is changed.
Run this script when editing src/review.js or src/comparison.js.
"""
from pathlib import Path
p=Path('site/app.js')
s=p.read_text()
def replace(old,new):
 global s
 if new in s:return
 if s.count(old)!=1:raise RuntimeError(f'Unexpected bundle structure: {old[:90]}')
 s=s.replace(old,new,1)
replace('<div id="answer-preview" class="math-preview"></div>', '<div id="answer-preview" class="math-preview"></div><div id="coding-explanation-field"><label for="coding-explanation">EXPLANATION</label><textarea id="coding-explanation" placeholder="Explain the approach, key steps, and complexity."></textarea></div>')
replace('l.value=e.language;let a=', 'l.value=e.language;re.querySelector("#coding-explanation").value=e.explanation||"";let a=')
replace('n.oninput=()=>{e.front=n.value', 're.querySelector("#coding-explanation").oninput=()=>{e.explanation=re.querySelector("#coding-explanation").value,a()},n.oninput=()=>{e.front=n.value')
replace('["#language-field","#code-editor","#code-hint"]', '["#language-field","#code-editor","#code-hint","#coding-explanation-field"]')
replace('typeof s.back!="string"||!s.back.trim()||', 'typeof s.back!="string"||!s.back.trim()||(s.explanation!==void 0&&typeof s.explanation!=="string")||')
replace('`${n.front} ${n.back}`.toLowerCase()', '`${n.front} ${n.back} ${n.explanation||""}`.toLowerCase()')
replace('it.querySelectorAll("[data-add]")', 'it.querySelectorAll("[data-restudy]").forEach(i=>i.onclick=()=>xA(i.dataset.restudy,true)),it.querySelectorAll("[data-add]")')
replace('<button class="outline" data-add="${Pe(r.id)}">+ Add card</button>', '<button class="outline" data-restudy="${Pe(r.id)}" ${e.length?"":"disabled"} title="Practice every card without changing review dates">Restudy deck</button><button class="outline" data-add="${Pe(r.id)}">+ Add card</button>')
start=s.find('/* LINT_REVIEW_START */')
if start<0:start=s.index('function xA(')
end=s.index('function wA(',start)
source=Path('src/comparison.js').read_text().replace('export function ', 'function ')+ '\n'+Path('src/review.js').read_text()
s=s[:start]+'/* LINT_REVIEW_START */\n'+source+'\n/* LINT_REVIEW_END */\n'+s[end:]
p.write_text(s)
