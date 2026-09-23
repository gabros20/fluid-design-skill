const f=(w,h)=> w<1024?1:Math.max(0.58,Math.min(h/900,w/1440));
const disp=(x,w)=> w<1024?1:Math.max(0.82,x,0.62*x+0.38);
const copy=(x,w)=> w<1024?1:Math.max(0.90,x,0.33*x+0.67);
for (const [W,H] of [[1440,900],[1920,1080],[2560,1440]]) {
  const b=f(W,H); const d0=64*disp(b,W), c0=16*copy(b,W);
  console.log(`\n${W}x${H}  base heading ${d0.toFixed(1)}  body ${c0.toFixed(1)} (device-independent px on screen)`);
  for (const z of [1.1,1.25,1.5,1.75,2,2.5,3]) {
    const w=W/z,h=H/z,u=f(w,h); const mob = w<1024;
    const d=64*disp(u,w)*z, c=16*copy(u,w)*z;
    // mobile fallback: assume mobile heading 40, body 16
    const dm = mob? 40*z : d, cm = mob? 16*z : c;
    console.log(`zoom ${z}: css ${w.toFixed(0)}x${h.toFixed(0)} ${mob?'MOBILE':'fluid '+u.toFixed(3)} heading ${(dm/d0*100).toFixed(0)}%  body ${(cm/c0*100).toFixed(0)}%`);
  }
}
