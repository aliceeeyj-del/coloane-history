// All distances are in kilometres in the relief's local X/Z plane.
const connectionToleranceSquared=.02**2;

function nearSegment([x,,z],[ax,,az],[bx,,bz]){
 const dx=bx-ax,dz=bz-az;
 const lengthSquared=dx*dx+dz*dz;
 const fraction=lengthSquared?Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/lengthSquared)):0;
 return (x-ax-fraction*dx)**2+(z-az-fraction*dz)**2<=connectionToleranceSquared;
}

function touchesLand(point,rings){
 const [x,,z]=point;
 let inside=false;
 for(const ring of rings){
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const a=ring[j],b=ring[i];
   if((a[2]>z)!==(b[2]>z)&&x<a[0]+(b[0]-a[0])*(z-a[2])/(b[2]-a[2]))inside=!inside;
   if(nearSegment(point,a,b))return true;
  }
 }
 return inside;
}

function touchesPath(points,path){
 return points.some(point=>path.some((end,i)=>i>0&&nearSegment(point,path[i-1],end)));
}

export function connectedBridgePaths(bridges,rings){
 const connected=new Set(bridges.filter(path=>path.some(point=>touchesLand(point,rings))));
 // A long crossing may span several source tiles. Follow segments from a mapped shore
 // so a section entirely above water can still belong to a real bridge.
 for(const shorePath of connected){
  for(const path of bridges){
   if(!connected.has(path)&&(touchesPath(path,shorePath)||touchesPath(shorePath,path)))connected.add(path);
  }
 }
 return bridges.filter(path=>connected.has(path));
}
