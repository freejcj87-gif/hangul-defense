// Shared geometry baking for the 3D village: every object becomes one vertex-coloured, non-indexed mesh (position, normal, color),
// so anything can be merged into one draw call or drawn as instances with the same material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3=THREE.Vector3;
export function prep(source,matrix,color){
 const pos=source.attributes.position,nor=source.attributes.normal,index=source.index,n=index?index.count:pos.count;
 const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3);
 const v=new V3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),flip=matrix.determinant()<0;
 for(let i=0;i<n;i++){
  const corner=i%3,k=flip&&corner?i-corner+(3-corner):i,src=index?index.getX(k):k;
  v.fromBufferAttribute(pos,src).applyMatrix4(matrix);P[i*3]=v.x;P[i*3+1]=v.y;P[i*3+2]=v.z;
  if(nor){v.fromBufferAttribute(nor,src).applyMatrix3(normalMatrix).normalize();N[i*3]=v.x;N[i*3+1]=v.y;N[i*3+2]=v.z}
  C[i*3]=color.r;C[i*3+1]=color.g;C[i*3+2]=color.b;
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
 if(!nor)g.computeVertexNormals();
 return g;
}
export function fuse(list){const g=mergeGeometries(list,false);for(const item of list)item.dispose();if(!g)throw new Error('Model merge failed');return g}
export const PRIM={sphere:new THREE.SphereGeometry(1,10,8),ball:new THREE.SphereGeometry(1,8,6),box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(1,1,6),cone8:new THREE.ConeGeometry(1,1,8),
 cyl:new THREE.CylinderGeometry(1,1,1,12),cyl6:new THREE.CylinderGeometry(1,1,1,6),cyl8:new THREE.CylinderGeometry(1,1,1,8),disc:new THREE.CircleGeometry(1,20),gem:new THREE.OctahedronGeometry(1,0),
 plane:new THREE.PlaneGeometry(1,1),dot:new THREE.CircleGeometry(1,6),rock:new THREE.IcosahedronGeometry(1,0),egg:new THREE.SphereGeometry(1,7,5),
 taper:new THREE.CylinderGeometry(1,.78,1,10),ring:new THREE.TorusGeometry(1,.16,4,12),tent:new THREE.ConeGeometry(1,1,8,1,true)};
// parts: [primitive, colour, [x,y,z], scale | [sx,sy,sz], [rx,ry,rz]?]
export function solid(parts){
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
 return fuse(parts.map(([prim,color,p,s,r=[0,0,0]])=>prep(PRIM[prim],m.compose(new V3(...p),q.setFromEuler(e.set(...r)),typeof s==='number'?new V3(s,s,s):new V3(...s)),new THREE.Color(color))));
}
// A flat decal lying on the ground at height y.
export const flat=(prim,color,x,z,sx,sz,y=.02,rot=0)=>[prim,color,[x,y,z],[sx,sz,1],[-Math.PI/2,0,rot]];
// Merges baked pieces (same attributes) into one geometry; the pieces are kept.
export function merge(list){const g=mergeGeometries(list.filter(Boolean),false);if(!g)throw new Error('Model merge failed');return g}
