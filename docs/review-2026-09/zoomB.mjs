const f=(w,h)=> Math.max(0.58,Math.min(h/900,w/1440));
const cur=(x)=>Math.max(0.90,x,0.33*x+0.67);
const B=(x)=>Math.max(0.90,0.33*x+0.67); // damped both ways
for (const [W,H] of [[1440,900],[1920,1080],[2560,1440]]) for (const z of [1.25,1.5,2]) {
 const w=W/z,h=H/z, mob=w<1024;
 const c0=16*cur(f(W,H)), b0=16*B(f(W,H));
 const c= mob?16*z:16*cur(f(w,h))*z, b= mob?16*z:16*B(f(w,h))*z;
 console.log(W, z, 'current body', (c/c0*100).toFixed(0)+'%', ' damped-up body', (b/b0*100).toFixed(0)+'%', mob?'(mobile)':'');
}
