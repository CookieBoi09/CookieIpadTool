// Text comparison only: never claims functional correctness or executes user code.
export function compareAnswers(answer, solution) {
  const normalize = value => value.replace(/\r\n?/g, '\n');
  const left = normalize(answer), right = normalize(solution);
  if (!left.trim()) return {status: 'empty', rows: []};
  if (left === right) return {status: 'match', rows: []};
  const a = left.split('\n'), b = right.split('\n');
  if (a.length > 300 || b.length > 300 || left.length + right.length > 60000) {
    return {status: 'different', rows: [], limited: true};
  }
  const lengths = Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for (let i=a.length-1;i>=0;i--) for(let j=b.length-1;j>=0;j--)
    lengths[i][j] = a[i] === b[j] ? lengths[i+1][j+1]+1 : Math.max(lengths[i+1][j],lengths[i][j+1]);
  const rows=[];let i=0,j=0;
  while(i<a.length || j<b.length) {
    if(i<a.length && j<b.length && a[i]===b[j]) {rows.push({kind:'same',text:a[i],answerLine:++i,solutionLine:++j});}
    else if(i<a.length && (j===b.length || lengths[i+1][j]>=lengths[i][j+1])) {rows.push({kind:'answer',text:a[i],answerLine:++i});}
    else {rows.push({kind:'solution',text:b[j],solutionLine:++j});}
  }
  return {status:'different', rows};
}
