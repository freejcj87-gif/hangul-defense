// 0.9 village layout: where every 3D prop and farmer spot goes (world units, village centre = origin; no three.js, no DOM,
// so a script can check it). The rules own the fixed places (world.js: 20 tower slots, 20 hen homes, PLACE buildings);
// props keep >= 1.2 from every tower slot and >= 0.9 from every hen home (measured to the prop's footprint edge),
// dirt paths keep their edge >= 1.2 from tower slots and >= 0.5 from hen homes, farmer spots and walks stay off tower bases.
const D=Math.PI/180;
export const MARKET_AT=[4.2,-1.8];   // world.js PLACE.market: the market actor's own decor is market-local

/* ---------- economy decor that was already in 0.8 ---------- */
export const POND={x:3.2,z:2.5},POND_R=[0,.62,.82,1.0],POND_RIM=1.14;
export const HAY={x:5.6,z:1.8};
// fixed little garden inside the village [x,z,scale]
export const GARDEN={bush:[[-5.45,2.9,1.1],[1.8,-5.6,1],[6.3,3.6,1.15],[-1.9,4.6,.9]],rock:[[-5.95,3.75,.9],[2.2,4.4,.8],[7.3,-1.4,1],[-6.8,-.4,.8]]};

/* ---------- farmers: one stroll zone each [ax,az, bx,bz, lateral half-width], egg pick-up and market counter spots ---------- */
export const ZONE={road:[-.5,-.85,2.35,.35,.2],yard:[-1.4,1.9,.3,3.9,.5],market:[2.75,.8,4.4,.65,.35],nests:[-.8,-1.05,1.6,-1.05,.15]};
export const FARM_ZONE=['road','road','market','yard','road','nests','market','yard','road','market'];
export const FARM_HOME=[[-.5,-.75],[1.6,-.2],[3.3,.75],[-.9,2.6],[2.3,.1],[.4,-1.05],[4.1,.65],[-.2,3.3],[.6,-.45],[2.9,.8]];
// pick-up spots in the strip between the front hens and the nests; counter spots in two rows in front of the market (clear of tower slots 0 and 3)
export const PICK=[[-.3,-.9],[.3,-.9],[-.9,-.9],[.9,-.9],[1.5,-.9],[0,-1.25],[-.6,-1.25],[.6,-1.25],[1.2,-1.25],[1.8,-1.25]];
export const DROP=[[3.45,.1],[2.9,.15],[4.0,.1],[3.15,.7],[3.7,.7],[2.6,.7],[4.25,.65],[2.85,1.25],[3.4,1.3],[3.95,1.25]];
export const MARKET_FRONT={x:3.9,z:-.1};
// running to the market the farmers pass this point in front of the market's left corner (they never cut through the building)
export const MARKET_GATE={x:2.1,z:.2};

/* ---------- market tiers: tier 0 stall · 1 roofed shop (+ crate and barrel by the counter, market-local) ·
   2 the market street (a dirt road out of the market's back lined with tents) · 3 a longer street, a gate and more tents ---------- */
export const MARKET_NEAR=[{kind:'crate',x:-1.55,z:.35,r:.32},{kind:'barrel',x:-1.75,z:-.75,r:.27}];
const ST=-45*D,along=(r,side)=>[+(Math.cos(ST)*r-Math.sin(ST)*side).toFixed(2),+(Math.sin(ST)*r+Math.cos(ST)*side).toFixed(2)];   // street frame: r along, side across
// tents stand off the street (side = 1.9), the right-hand one past the market's back corner
export const TENTS=[{at:along(7.5,-1.9),r:1.05,stage:2,colors:[0xe2453a,0xfff4e0],goods:'apples'},{at:along(8.7,1.9),r:1.05,stage:2,colors:[0x3a8fd6,0xfff4e0],goods:'loaves'},
 {at:along(11.0,-1.9),r:1.1,stage:3,colors:[0x5aa83a,0xfff4e0],goods:'cabbages'}];
// flag poles at the street entrance (stage 2; at stage 3 a sign board hangs between them: the big-market gate) and further down
export const STREET_FLAGS=[{at:along(6.45,-1.0),h:2.5,color:0xffd24a,stage:2},{at:along(6.45,1.0),h:2.5,color:0x6fd3ff,stage:2},
 {at:along(12.4,-1.1),h:2.9,color:0xff5a4a,stage:3},{at:along(11.7,1.1),h:2.9,color:0xff8fb3,stage:3}];
export const STREET_CRATES=[{at:along(9.05,-1.3),n:2,stage:3},{at:along(10.3,1.35),n:2,stage:3}];
export const GATE={a:along(6.45,-1.0),b:along(6.45,1.0),stage:3};

/* ---------- dirt paths per hall stage: [x0,z0,x1,z1,width]. The core (0.8 slots, hens, pond, coop, market) is full,
   so the roads start where it ends and run out on the diagonals, between the outer tower rings and the wolf trails. ---------- */
const spoke=(deg,r0,r1,w=1.15)=>{const a=deg*D;return [+(Math.cos(a)*r0).toFixed(2),+(Math.sin(a)*r0).toFixed(2),+(Math.cos(a)*r1).toFixed(2),+(Math.sin(a)*r1).toFixed(2),w]};
export const PATHS=[[],
 [spoke(45,5.9,8.8),spoke(225,6.45,8.8),spoke(315,5.8,8.8)],
 [spoke(45,5.9,11.4),spoke(225,6.45,11.4),spoke(315,5.8,11.4)],
 [spoke(45,5.9,14),spoke(135,7.65,14),spoke(225,9.3,14),spoke(315,5.8,14)]];   // hall 3: the barn sits on the inner south-west road

/* ---------- lanterns (stage 2+) beside the road entrances and by the market, more down the roads at stage 3 ---------- */
const beside=(deg,r,side)=>{const a=deg*D;return [+(Math.cos(a)*r-Math.sin(a)*side).toFixed(2),+(Math.sin(a)*r+Math.cos(a)*side).toFixed(2)]};
export function lanterns(stage){
 const out=[];
 if(stage>=2)out.push(beside(45,6.3,-1.0),beside(225,6.9,1.0),beside(315,7.2,1.05));
 if(stage>=3)out.push(beside(45,10.4,1.0),beside(135,8.3,1.0),beside(225,10.2,-1.0));
 return out;
}
export const LANTERN_BOX=.24;   // the lantern hangs this far +x of its post

/* ---------- stage 3: feast flags around the village and hay stacked by the barn ---------- */
export const FLAGS3=[[2.0,3.3],[-3.4,3.2],[-1.3,-4.9],[-5.0,-6.9]];
export const HAY3=[[-8.1,-2.6,1],[-7.4,-2.1,.85],[-7.8,-1.6,.9]];

/* ---------- egg nests between the hall and the small coop, behind the front hens ---------- */
export const NESTS=[[-.62,-1.98],[.3,-2.0]];
