export function cursorRegion(point, pageWidth, pageHeight, width=400, height=250) {
  width=Math.min(width,pageWidth);height=Math.min(height,pageHeight);
  return {x:Math.max(0,Math.min(pageWidth-width,point[0]-width/2)),y:Math.max(0,Math.min(pageHeight-height,point[1]-height/2)),width,height};
}
export function mapTouch(frame, region, inset=0) {
  if(!frame || !['begin','move'].includes(frame.phase) || !Number.isFinite(frame.x) || !Number.isFinite(frame.y) || frame.x<0 || frame.x>1 || frame.y<0 || frame.y>1)return null;
  const margin=Math.min(Math.max(0,inset),region.width/2,region.height/2);
  return [region.x+margin+frame.x*(region.width-2*margin),region.y+margin+frame.y*(region.height-2*margin)].map(n=>Math.round(n*10)/10);
}
