/* ─────────────────────────────────────────────────────────────
   BEVMAQ · Komplettanlage als scrollgesteuerter 3D-Film (three.js r158)
   Werkhalle bei Nacht, PET-Linie nach Krones-Vorbild:
   Preforms → Ofen + Blasrad → Füller → Verschließer → Inspektion →
   Etikettierer → Packer + Schrumpftunnel → Lagenpalettierer.
   Alles Bewegte ist eine Funktion der Zeit t (zustandslos).
   Die Kamera folgt einem Drehbuch aus SHOTS, gesteuert über set(p 0..1).
   API: var f=AnlageFilm(host,{reduced,onShot}); f.set(p); f.start(); f.stop();
   ───────────────────────────────────────────────────────────── */
(function(global){
  'use strict';
  var TAU=Math.PI*2;
  function clamp(v,a,b){return v<a?a:v>b?b:v}
  function ss(a,b,x){x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)}
  function lerp(a,b,u){return a+(b-a)*u}

  /* ── Tuning ───────────────────────── */
  var SP=.11, V=.95, CH=.95, DELTA=.45;           // Teilung, Bandgeschw., Bandhöhe, Ein-/Auslaufwinkel
  var PACK=6, LAYER=12, LAYERS=5;
  var PACK_RATE=V/(SP*PACK), LAYER_T=LAYER/PACK_RATE, VP=.42, SPP=VP/PACK_RATE;

  function AnlageFilm(host,o){
    o=o||{};var T=global.THREE;if(!T)return null;
    var W=host.clientWidth||800,H=host.clientHeight||600,MOB=W<760;
    var R=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    R.setPixelRatio(Math.min(MOB?1.5:1.6,global.devicePixelRatio||1));R.setSize(W,H);
    R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1;
    R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
    host.appendChild(R.domElement);R.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';
    var S=new T.Scene();S.fog=new T.FogExp2(0x0b0d10,.045);
    var CAM=new T.PerspectiveCamera(38,W/H,.03,120);

    /* ── Texturen ─────────────────────── */
    function canvas(w,h,fn){var c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t}
    var TX={
      glow:canvas(128,128,function(x,w){var g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,w)}),
      cone:canvas(8,128,function(x,w,h){var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.15,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h)}),
      label:canvas(512,96,function(x,w,h){x.fillStyle='#F7F5F1';x.fillRect(0,0,w,h);x.fillStyle='#FF8F42';x.fillRect(0,58,w,14);x.fillStyle='#15130F';x.font='700 34px Barlow, Arial';for(var i=0;i<3;i++){x.fillText('BEV',20+i*172,42);x.fillStyle='#FF8F42';x.fillText('MAQ',20+i*172+x.measureText('BEV').width,42);x.fillStyle='#15130F'}}),
      hmi:canvas(512,320,function(x,w,h){x.fillStyle='#0E1013';x.fillRect(0,0,w,h);x.fillStyle='#1B1F24';x.fillRect(0,0,w,44);x.fillStyle='#FF8F42';x.font='600 22px Barlow, Arial';x.fillText('BEVMAQ · LINIE 1',18,30);
        x.fillStyle='#3BD18A';x.beginPath();x.arc(w-26,22,7,0,TAU);x.fill();
        x.strokeStyle='#FF8F42';x.lineWidth=3;x.beginPath();for(var i=0;i<=40;i++){var px=24+i*11,py=200-Math.sin(i*.45)*40-i*1.6;i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();
        x.fillStyle='rgba(255,143,66,.25)';for(var j=0;j<10;j++)x.fillRect(24+j*46,270-((j*37)%60)-20,30,(j*37)%60+20);
        x.fillStyle='#8B949E';x.font='500 15px monospace';x.fillText('FÜLLER  OK',300,80);x.fillText('OFEN    112°C',300,104);x.fillText('PACKER  OK',300,128)}),
      reel:canvas(256,256,function(x){for(var r=124;r>20;r-=4){x.fillStyle=(r/4)%2?'#F3F0EA':'#FF8F42';x.beginPath();x.arc(128,128,r,0,TAU);x.fill()}x.fillStyle='#2A2C30';x.beginPath();x.arc(128,128,22,0,TAU);x.fill()}),
      pack:canvas(256,256,function(x,w,h){x.fillStyle='#E06A1C';x.fillRect(0,0,w,h);for(var i=0;i<3;i++){var cx=43+i*85,g=x.createLinearGradient(cx-34,0,cx+34,0);g.addColorStop(0,'#C9540F');g.addColorStop(.35,'#FFB27A');g.addColorStop(1,'#B84A0C');x.fillStyle=g;x.fillRect(cx-34,30,68,226);x.fillStyle='#F4F1EC';x.fillRect(cx-34,120,68,52);x.fillStyle='#FF8F42';x.fillRect(cx-34,156,68,8)}
        x.fillStyle='rgba(255,255,255,.28)';x.fillRect(0,0,w,10);x.fillRect(18,0,6,h)}),
      concrete:canvas(512,512,function(x,w,h){x.fillStyle='#808080';x.fillRect(0,0,w,h);for(var i=0;i<9000;i++){var v=110+Math.random()*40|0;x.fillStyle='rgba('+v+','+v+','+v+','+(Math.random()*.25)+')';x.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3)}
        x.strokeStyle='rgba(40,40,40,.35)';x.lineWidth=2;x.strokeRect(0,0,w,h)}),
      window:canvas(16,256,function(x,w,h){var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#1B2A44');g.addColorStop(.55,'#E2733A');g.addColorStop(1,'#FFC08A');x.fillStyle=g;x.fillRect(0,0,w,h)})
    };
    TX.concrete.wrapS=TX.concrete.wrapT=T.RepeatWrapping;TX.concrete.repeat.set(14,6);TX.concrete.colorSpace=T.NoColorSpace;
    TX.label.wrapS=T.RepeatWrapping;

    /* ── Umgebung (Reflexionen) ───────── */
    (function(){
      var r=new T.Scene(),g=new T.BoxGeometry();
      var room=new T.Mesh(g,new T.MeshStandardMaterial({side:T.BackSide,color:0x2a2d31}));room.scale.set(40,14,24);room.position.y=6;r.add(room);
      r.add(new T.AmbientLight(0xffffff,.6));
      function L(i,x,y,z,sx,sy,sz,c){var m=new T.Mesh(g,new T.MeshBasicMaterial({color:new T.Color(c||0xffffff).multiplyScalar(i)}));m.position.set(x,y,z);m.scale.set(sx,sy,sz);r.add(m)}
      for(var k=-3;k<=3;k++){L(5,k*5,12.8,-2,3.6,.1,.25);L(5,k*5,12.8,2,3.6,.1,.25)}
      L(2.2,0,5,-11.8,30,4,.1,0xff9a55);L(1.2,-19.8,5,0,.1,5,12,0x88aaff);
      var pm=new T.PMREMGenerator(R);S.environment=pm.fromScene(r,.03).texture;pm.dispose();
    })();

    /* ── Materialien ──────────────────── */
    var M={
      steel:new T.MeshPhysicalMaterial({color:0xd6dbe0,metalness:1,roughness:.2}),
      brushed:new T.MeshPhysicalMaterial({color:0xbfc5cb,metalness:1,roughness:.38}),
      darkSteel:new T.MeshPhysicalMaterial({color:0x5b6168,metalness:.9,roughness:.42}),
      white:new T.MeshPhysicalMaterial({color:0xeeeeec,roughness:.42,clearcoat:.6,clearcoatRoughness:.3}),
      graphite:new T.MeshPhysicalMaterial({color:0x2b2e33,roughness:.5,clearcoat:.4}),
      orange:new T.MeshPhysicalMaterial({color:0xff7f2a,roughness:.32,clearcoat:1,clearcoatRoughness:.12}),
      black:new T.MeshPhysicalMaterial({color:0x111214,roughness:.6}),
      rubber:new T.MeshStandardMaterial({color:0x18191b,roughness:.9}),
      glassPanel:new T.MeshPhysicalMaterial({color:0xc4dbe8,roughness:.04,metalness:0,transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false,envMapIntensity:2}),
      bottle:new T.MeshPhysicalMaterial({color:0xeaf6fb,emissive:0x1c2a30,roughness:.04,metalness:0,transparent:true,opacity:.42,clearcoat:1,envMapIntensity:3,depthWrite:false}),
      preform:new T.MeshPhysicalMaterial({color:0xc9a26a,roughness:.15,transparent:true,opacity:.75,clearcoat:1}),
      liquid:new T.MeshPhysicalMaterial({color:0xff7a1f,emissive:0xff4a00,emissiveIntensity:.35,roughness:.1,clearcoat:1,transparent:true,opacity:.94}),
      cap:new T.MeshPhysicalMaterial({color:0x1c1d20,roughness:.35,clearcoat:.8}),
      label:new T.MeshPhysicalMaterial({map:TX.label,roughness:.4,clearcoat:.5}),
      pack:new T.MeshPhysicalMaterial({map:TX.pack,roughness:.18,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.4}),
      wood:new T.MeshStandardMaterial({color:0xb08a5a,roughness:.85}),
      floor:new T.MeshPhysicalMaterial({color:0x3a3c40,roughness:.55,roughnessMap:TX.concrete,clearcoat:.35,clearcoatRoughness:.35}),
      lamp:new T.MeshBasicMaterial({color:0xffffff}),
      heat:new T.MeshBasicMaterial({color:0xff6a1a}),
      hmi:new T.MeshBasicMaterial({map:TX.hmi,toneMapped:false}),
      reel:new T.MeshPhysicalMaterial({map:TX.reel,roughness:.5}),
      tape:new T.MeshStandardMaterial({color:0xff8f42,roughness:.6,emissive:0x331100}),
      laser:new T.MeshBasicMaterial({color:0xff6a1a,transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false})
    };
    function mk(g,m,x,y,z,p,cast){var e=new T.Mesh(g,m);e.position.set(x||0,y||0,z||0);e.castShadow=cast!==false;e.receiveShadow=true;(p||S).add(e);return e}
    function box(w,h,d,m,x,y,z,p,cast){return mk(new T.BoxGeometry(w,h,d),m,x,y,z,p,cast)}
    function cyl(r,h,m,x,y,z,p,seg,cast){return mk(new T.CylinderGeometry(r,r,h,seg||40),m,x,y,z,p,cast)}
    function glow(color,size,x,y,z,p,op){var s=new T.Sprite(new T.SpriteMaterial({map:TX.glow,color:color,transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:op==null?1:op,toneMapped:false}));s.position.set(x,y,z);s.scale.set(size,size,1);(p||S).add(s);return s}

    /* ── Halle ────────────────────────── */
    var floor=mk(new T.PlaneGeometry(70,34),M.floor,8,0,0,S,false);floor.rotation.x=-Math.PI/2;
    // Bodenmarkierung: Fahrwege
    [-1.9,1.9].forEach(function(z){box(30,.004,.08,M.tape,7.5,.002,z,S,false)});
    for(var i=0;i<16;i++){box(.6,.004,.08,M.tape,-6+i*2.2,.002,3.4,S,false)}
    // Säulen + Träger
    for(var cx=-9;cx<=27;cx+=6){[-5.5,5.5].forEach(function(z){box(.35,8,.35,M.darkSteel,cx,4,z);box(.5,.04,.5,M.tape,cx,1.2,z,S,false)})}
    for(var bx=-9;bx<=27;bx+=6){box(.25,.5,11.4,M.darkSteel,bx,7.8,0,S,false)}
    box(37,.4,.25,M.darkSteel,9,7.6,-5.5,S,false);box(37,.4,.25,M.darkSteel,9,7.6,5.5,S,false);
    // Rückwand mit Fensterband (Abendlicht)
    box(46,9,.2,new T.MeshStandardMaterial({color:0x15171a,roughness:.9}),9,4.5,-7,S,false);
    var win=mk(new T.PlaneGeometry(40,2.2),new T.MeshBasicMaterial({map:TX.window,toneMapped:false,fog:false}),9,5.6,-6.88,S,false);
    for(var wi=0;wi<20;wi++)box(.08,2.3,.08,M.black,-10.5+wi*2.05,5.6,-6.85,S,false);
    // LED-Lichtbänder + Lichtkegel
    var leds=[],cones=[];
    for(var lx=-6;lx<=24;lx+=4.5){[-2.2,2.2].forEach(function(z){
      var m=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});var l=box(3.2,.05,.14,m,lx,7.2,z,S,false);l.castShadow=false;leds.push(l);
      var c=mk(new T.CylinderGeometry(.9,2.6,7,24,1,true),new T.MeshBasicMaterial({map:TX.cone,color:0xfff1e0,transparent:true,opacity:.07,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}),lx,3.65,z,S,false);c.castShadow=false;cones.push(c)})}
    // Kabeltrasse
    box(30,.06,.5,M.brushed,7,4.6,-1.2,S,false);
    // Schaltschränke an der Rückwand
    for(var si=0;si<9;si++){var sx=-4+si*.82;box(.8,2,.5,M.white,sx,1,-4.6);box(.7,.04,.02,M.tape,sx,1.75,-4.34,S,false);glow(si%3?0x3bd18a:0xff8f42,.12,sx+.25,1.85,-4.32,S,.9)}

    /* ── Pfad der Flaschen ────────────── */
    function nR(n){return n*SP/TAU}
    function car(cx,n){var r=nR(n);return {cx:cx,cz:-r*Math.cos(DELTA),R:r,n:n}}
    var WB=car(-1.0,40),WF=car(2.7,72),WC=car(4.85,24),WL=car(8.4,48),XI=6.5,PK0=10.7,PK1=14.6,TB=16.35,PAL=17.95;
    var segs=[],L=0;
    function line(ax,az,bx,bz){var l=Math.hypot(bx-ax,bz-az);segs.push({t:0,ax:ax,az:az,bx:bx,bz:bz,s0:L,len:l});L+=l}
    function pt(c,th){return [c.cx+c.R*Math.sin(th),c.cz+c.R*Math.cos(th)]}
    function arc(c){var len=c.R*(TAU-2*DELTA);c.s0=L;c.s1=L+len;segs.push({t:1,c:c,s0:L,len:len});L+=len}
    var START=-4.3,prev=[START,0],sOvenA,sOvenB;
    [WB,WF,WC].forEach(function(c){var e=pt(c,-DELTA);line(prev[0],prev[1],e[0],e[1]);arc(c);prev=pt(c,DELTA)});
    line(prev[0],prev[1],XI,0);var sInsp=L;prev=[XI,0];
    var e2=pt(WL,-DELTA);line(prev[0],prev[1],e2[0],e2[1]);arc(WL);prev=pt(WL,DELTA);
    line(prev[0],prev[1],PK0+.35,0);var sEnd=L;
    function at(s,out){for(var i=segs.length-1;i>=0;i--){var g=segs[i];if(s>=g.s0){var u=s-g.s0;
      if(!g.t){var k=u/g.len;out.x=g.ax+(g.bx-g.ax)*k;out.z=g.az+(g.bz-g.az)*k;out.c=null;return out}
      var th=-DELTA-u/g.c.R;out.x=g.c.cx+g.c.R*Math.sin(th);out.z=g.c.cz+g.c.R*Math.cos(th);out.c=g.c;out.th=th;return out}}out.x=START;out.z=0;out.c=null;return out}

    /* ── Förderbänder ─────────────────── */
    var CW=.16;
    function conveyor(ax,az,bx,bz,w){
      w=w||CW;var l=Math.hypot(bx-ax,bz-az),g=new T.Group();g.position.set((ax+bx)/2,0,(az+bz)/2);g.rotation.y=-Math.atan2(bz-az,bx-ax);S.add(g);
      box(l,.012,w,M.graphite,0,CH-.006,0,g);
      box(l,.07,.012,M.steel,0,CH+.02,w/2+.01,g);box(l,.07,.012,M.steel,0,CH+.02,-w/2-.01,g);
      box(l,.12,w+.04,M.brushed,0,CH-.07,0,g);
      for(var s=.3;s<l;s+=1.1){box(.04,CH-.13,.04,M.brushed,-l/2+s,(CH-.13)/2,w/2,g);box(.04,CH-.13,.04,M.brushed,-l/2+s,(CH-.13)/2,-w/2,g);cyl(.04,.02,M.rubber,-l/2+s,.01,w/2,g,12);cyl(.04,.02,M.rubber,-l/2+s,.01,-w/2,g,12)}
      return g;
    }
    segs.forEach(function(g){if(!g.t&&g.len>.05)conveyor(g.ax,g.az,g.bx,g.bz)});
    conveyor(PK1,0,TB-.4,0,.3);

    /* ── Instanzen: Flaschen ──────────── */
    var prof=[[0,0],[.028,0],[.034,.012],[.034,.13],[.03,.16],[.018,.2],[.0135,.215],[.0135,.24],[0,.24]].map(function(p){return new T.Vector2(p[0],p[1])});
    var MAXB=420;
    function IM(g,m,n,cast){var e=new T.InstancedMesh(g,m,n);e.castShadow=!!cast;e.receiveShadow=false;e.frustumCulled=false;e.count=0;S.add(e);return e}
    var gPre=new T.LatheGeometry([[0,0],[.012,0],[.013,.01],[.013,.09],[.016,.095],[.016,.11],[0,.11]].map(function(p){return new T.Vector2(p[0],p[1])}),14);
    var IPre=IM(gPre,M.preform,140,true),IBot=IM(new T.LatheGeometry(prof,20),M.bottle,MAXB),
      gLiq=new T.LatheGeometry([[0,0],[.0315,0],[.0315,.128],[.027,.155],[.016,.19],[.0115,.2],[0,.2]].map(function(p){return new T.Vector2(p[0],p[1])}),16);var ILiq=IM(gLiq,M.liquid,MAXB,true),
      ICap=IM(new T.CylinderGeometry(.0155,.0155,.018,14),M.cap,MAXB,true),
      gLab=new T.CylinderGeometry(.0347,.0347,.06,20,1,true);var ILab=IM(gLab,M.label,MAXB);
    var gPack=new T.BoxGeometry(.21,.25,.14);gPack.translate(0,.125,0);var IPack=IM(gPack,M.pack,190,true);
    var ICapP=IM(new T.CylinderGeometry(.0155,.0155,.02,10),M.cap,190*6);
    var D=new T.Object3D(),P={x:0,z:0};

    /* ── Preform-Zufuhr (Trichter + Steilförderer) ── */
    box(1.1,.9,1.1,M.white,-5.4,1.65,-.9);mk(new T.CylinderGeometry(.55,.15,.6,4,1,true),M.brushed,-5.4,1.0,-.9).rotation.y=Math.PI/4;
    for(var pi=0;pi<60;pi++){var pp=mk(gPre,M.preform,-5.4+(Math.random()-.5)*.9,2.1+Math.random()*.05,-.9+(Math.random()-.5)*.9,S,false);pp.rotation.set(Math.PI/2*Math.random()+1,Math.random()*3,0)}
    box(.16,2.4,.16,M.brushed,-4.75,1.2,-.5);box(.6,.05,.16,M.steel,-4.55,CH+.05,-.25);

    /* ── Ofen + Blasrad (im Glasgehäuse) ── */
    var oven=new T.Group();S.add(oven);
    box(1.5,.9,.62,M.darkSteel,-3.15,CH+.12,-.0,oven);box(1.52,.05,.64,M.orange,-3.15,CH+.58,0,oven);
    var ovenSlot=box(1.52,.18,.2,M.black,-3.15,CH+.05,.25,oven,false);
    var lampMat=new T.MeshBasicMaterial({color:0xff5418,toneMapped:false});
    var ovenLamps=[];for(var oi=0;oi<12;oi++){var lp=box(.08,.12,.02,lampMat,-3.82+oi*.12,CH+.06,.31,oven,false);ovenLamps.push(lp)}
    var ovenGlow=glow(0xff5a1a,2.4,-3.15,CH+.05,.5,S,.65);
    var ovenLight=new T.PointLight(0xff5a1a,1.2,3,2);ovenLight.position.set(-3.15,CH+.08,.45);S.add(ovenLight);
    function enclosure(cx,cz,w,h,d,roof){
      var g=new T.Group();g.position.set(cx,0,cz);S.add(g);
      box(w,.25,d,M.white,0,.125,0,g);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){box(.06,h,.06,M.steel,q[0]*w/2,h/2,q[1]*d/2,g)});
      [-1,1].forEach(function(q){box(w,.06,.06,M.steel,0,h,q*d/2,g);box(.06,.06,d,M.steel,q*w/2,h,0,g);box(w,.05,.05,M.steel,0,1.3,q*d/2,g)});
      var pf=new T.PlaneGeometry(w,h-.3),ps=new T.PlaneGeometry(d,h-.3);
      var a=mk(pf,M.glassPanel,0,(h+.3)/2,d/2,g,false),b=mk(pf,M.glassPanel,0,(h+.3)/2,-d/2,g,false),c=mk(ps,M.glassPanel,w/2,(h+.3)/2,0,g,false),e=mk(ps,M.glassPanel,-w/2,(h+.3)/2,0,g,false);c.rotation.y=e.rotation.y=Math.PI/2;
      if(roof!==false){box(w+.1,.12,d+.1,M.white,0,h+.06,0,g);for(var r=0;r<5;r++)box(w*.8,.02,.06,M.graphite,0,h+.13,-d/2+.3+r*(d-.6)/4,g,false)}
      return g;
    }
    var encB=enclosure(WB.cx,WB.cz+.1,2.1,2.3,2.2);
    var wheelB=new T.Group();wheelB.position.set(WB.cx,0,WB.cz);S.add(wheelB);
    cyl(WB.R+.1,.6,M.brushed,0,.55,0,wheelB);cyl(WB.R+.14,.04,M.steel,0,CH-.02,0,wheelB);
    var gMould=new T.BoxGeometry(.075,.17,.1),IMould=new T.InstancedMesh(gMould,M.steel,WB.n);IMould.castShadow=true;wheelB.add(IMould);
    var gRod=new T.CylinderGeometry(.008,.008,.35,8),IRod=new T.InstancedMesh(gRod,M.steel,WB.n);wheelB.add(IRod);
    cyl(WB.R+.12,.05,M.steel,0,CH+.48,0,wheelB);cyl(.18,1.1,M.darkSteel,0,CH+.3,0,wheelB);
    var baseB=-DELTA-(((-WB.s0)%SP+SP)%SP)/WB.R;
    for(var mi=0;mi<WB.n;mi++){var th=baseB-mi*SP/WB.R;D.position.set(WB.R*Math.sin(th),CH+.12,WB.R*Math.cos(th));D.rotation.set(0,th,0);D.updateMatrix();IMould.setMatrixAt(mi,D.matrix);D.position.y=CH+.32;D.updateMatrix();IRod.setMatrixAt(mi,D.matrix)}

    /* ── Füller ───────────────────────── */
    var encF=enclosure(WF.cx,WF.cz+.15,3.9,2.7,3.8);
    var carF=new T.Group();carF.position.set(WF.cx,0,WF.cz);S.add(carF);
    cyl(WF.R+.18,.62,M.white,WF.cx,.56,WF.cz,S);cyl(WF.R+.2,.04,M.orange,WF.cx,.88,WF.cz,S);
    cyl(WF.R+.08,.03,M.steel,0,CH-.015,0,carF,96);
    var baseF=-DELTA-(((-WF.s0)%SP+SP)%SP)/WF.R;
    var IValve=new T.InstancedMesh(new T.CylinderGeometry(.026,.022,.2,14),M.steel,WF.n),IVTip=new T.InstancedMesh(new T.CylinderGeometry(.012,.006,.05,10),M.steel,WF.n),IVRing=new T.InstancedMesh(new T.TorusGeometry(.03,.006,6,16),M.orange,WF.n);
    IValve.castShadow=true;carF.add(IValve);carF.add(IVTip);carF.add(IVRing);
    for(var vi=0;vi<WF.n;vi++){var thv=baseF-vi*SP/WF.R,vx=WF.R*Math.sin(thv),vz=WF.R*Math.cos(thv);
      D.rotation.set(0,0,0);D.position.set(vx,CH+.42,vz);D.updateMatrix();IValve.setMatrixAt(vi,D.matrix);D.position.y=CH+.3;D.updateMatrix();IVTip.setMatrixAt(vi,D.matrix);
      D.position.y=CH+.46;D.rotation.set(Math.PI/2,0,0);D.updateMatrix();IVRing.setMatrixAt(vi,D.matrix)}
    var ringBowl=mk(new T.TorusGeometry(WF.R,.08,16,120),M.steel,0,CH+.62,0,carF);ringBowl.rotation.x=Math.PI/2;
    cyl(WF.R+.02,.04,M.steel,0,CH+.54,0,carF,96);
    for(var ar=0;ar<8;ar++){var aa=ar/8*TAU,arm=box(WF.R,.04,.05,M.brushed,Math.cos(aa)*WF.R/2,CH+.75,Math.sin(aa)*WF.R/2,carF);arm.rotation.y=-aa}
    cyl(.22,.9,M.steel,0,CH+.55,0,carF);cyl(.42,.32,M.steel,0,CH+1.0,0,carF);mk(new T.SphereGeometry(.42,40,20,0,TAU,0,Math.PI/2),M.steel,0,CH+1.16,0,carF).scale.y=.5;
    // Produktleitung zur Decke
    var pipe=mk(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(WF.cx,CH+1.3,WF.cz),new T.Vector3(WF.cx,3.2,WF.cz),new T.Vector3(WF.cx+.4,3.9,WF.cz-.6),new T.Vector3(WF.cx+.4,7.4,WF.cz-1.2)]),40,.06,12),M.steel);
    var fLight=new T.SpotLight(0x8fd4ff,30,8,.5,.6,1.5);fLight.position.set(WF.cx+2.5,4.2,2.8);fLight.target.position.set(WF.cx,CH,WF.cz);S.add(fLight);S.add(fLight.target);
    // HMI-Panels
    function hmi(x,z,ry){var g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry||0;S.add(g);box(.06,1.3,.06,M.brushed,0,.65,0,g);box(.5,.36,.06,M.graphite,0,1.42,.02,g);var s=mk(new T.PlaneGeometry(.46,.3),M.hmi,0,1.42,.052,g,false);glow(0xff8f42,.6,0,1.42,.1,g,.18);return g}
    hmi(WF.cx+1.85,1.05,-.5);hmi(WL.cx-1.3,1.0,.4);hmi(PK0+.6,.95,.2);

    /* ── Verschließer + Deckelrutsche ── */
    var carC=new T.Group();carC.position.set(WC.cx,0,WC.cz);S.add(carC);
    cyl(WC.R+.12,.6,M.white,WC.cx,.55,WC.cz,S);cyl(WC.R+.05,.03,M.steel,0,CH-.015,0,carC);
    var baseC=-DELTA-(((-WC.s0)%SP+SP)%SP)/WC.R;
    var IHead=new T.InstancedMesh(new T.CylinderGeometry(.03,.03,.26,14),M.steel,WC.n),IHeadC=new T.InstancedMesh(new T.CylinderGeometry(.022,.022,.03,14),M.cap,WC.n);IHead.castShadow=true;carC.add(IHead);carC.add(IHeadC);
    for(var hi=0;hi<WC.n;hi++){var thh=baseC-hi*SP/WC.R;D.rotation.set(0,0,0);D.position.set(WC.R*Math.sin(thh),CH+.43,WC.R*Math.cos(thh));D.updateMatrix();IHead.setMatrixAt(hi,D.matrix);D.position.y=CH+.29;D.updateMatrix();IHeadC.setMatrixAt(hi,D.matrix)}
    cyl(WC.R+.05,.06,M.steel,0,CH+.58,0,carC);cyl(.12,.9,M.darkSteel,0,CH+.95,0,carC);
    box(.7,.6,.7,M.white,WC.cx-.9,3.0,WC.cz-.9);box(.06,2.7,.06,M.brushed,WC.cx-.9,1.35,WC.cz-1.2);
    var chuteC=new T.CatmullRomCurve3([new T.Vector3(WC.cx-.9,2.7,WC.cz-.9),new T.Vector3(WC.cx-.75,2.0,WC.cz-.6),new T.Vector3(WC.cx-.35,1.55,WC.cz-.2),new T.Vector3(WC.cx-.05,CH+.36,WC.cz+WC.R*.7)]);
    mk(new T.TubeGeometry(chuteC,60,.03,10),M.glassPanel,0,0,0,S,false);
    var ICh=IM(new T.CylinderGeometry(.0155,.0155,.018,12),M.cap,26,true);ICh.count=26;

    /* ── Inspektion ───────────────────── */
    var insp=new T.Group();insp.position.set(XI,0,0);S.add(insp);
    box(.5,1.6,.12,M.white,0,.8,-.32,insp);box(.5,1.6,.12,M.white,0,.8,.32,insp);box(.6,.22,.78,M.white,0,1.64,0,insp);
    box(.52,.24,.02,M.black,0,1.2,.385,insp,false);box(.2,.04,.02,M.tape,0,1.5,.385,insp,false);
    var laser=mk(new T.PlaneGeometry(.02,.7),M.laser,0,CH+.15,0,insp,false);laser.rotation.y=Math.PI/2;
    var laserSheet=mk(new T.PlaneGeometry(.5,.004),M.laser,0,CH+.1,0,insp,false);laserSheet.rotation.set(-Math.PI/2,0,Math.PI/2);laserSheet.scale.set(1,1,1);
    var lzGlow=glow(0xff6a1a,.7,0,CH+.12,0,insp,.8);
    var camDomes=[[-0.2,1.35,.25],[.2,1.35,-.25]].map(function(c){var d=mk(new T.SphereGeometry(.05,20,12),M.black,c[0],c[1],c[2],insp);glow(0xff3010,.08,c[0],c[1],c[2]+(c[2]>0?.06:-.06),insp,1);return d});
    var iLight=new T.PointLight(0xff6a1a,1.4,2.5,2);iLight.position.set(XI,CH+.3,.4);S.add(iLight);

    /* ── Etikettierer ─────────────────── */
    var carL=new T.Group();carL.position.set(WL.cx,0,WL.cz);S.add(carL);
    cyl(WL.R+.14,.6,M.white,WL.cx,.55,WL.cz,S);cyl(WL.R+.06,.03,M.steel,0,CH-.015,0,carL);
    var basel=-DELTA-(((-WL.s0)%SP+SP)%SP)/WL.R;
    var IPlate=new T.InstancedMesh(new T.CylinderGeometry(.04,.04,.02,14),M.steel,WL.n),ICent=new T.InstancedMesh(new T.CylinderGeometry(.018,.018,.18,10),M.steel,WL.n);carL.add(IPlate);carL.add(ICent);
    for(var li=0;li<WL.n;li++){var thl=basel-li*SP/WL.R;D.rotation.set(0,0,0);D.position.set(WL.R*Math.sin(thl),CH-.01,WL.R*Math.cos(thl));D.updateMatrix();IPlate.setMatrixAt(li,D.matrix);D.position.y=CH+.36;D.updateMatrix();ICent.setMatrixAt(li,D.matrix)}
    cyl(WL.R+.04,.04,M.steel,0,CH+.46,0,carL);cyl(.14,.8,M.darkSteel,0,CH+.85,0,carL);
    var reels=[];
    [[-1,.2],[1,.2]].forEach(function(sd,ri){var ax=WL.cx+sd[0]*(WL.R+.55),az=WL.cz-.15;
      box(.7,1.05,.7,M.white,ax,.525,az);var drum=cyl(.12,.3,M.steel,ax-sd[0]*.3,CH+.12,az+.25,S,32);
      var rg=new T.Group();rg.position.set(ax,1.08,az-.05);S.add(rg);cyl(.3,.1,M.reel,0,.05,0,rg,48);cyl(.04,.2,M.steel,0,.08,0,rg,16);reels.push({g:rg,d:drum})});

    /* ── Packer + Schrumpftunnel ──────── */
    var pk=new T.Group();S.add(pk);
    box(1.9,2.0,1.3,M.white,PK0+.95,1.0,0,pk);
    var pwin=mk(new T.PlaneGeometry(1.4,.8),M.glassPanel,PK0+.95,1.35,.66,pk,false);
    box(1.92,.05,1.32,M.orange,PK0+.95,1.82,0,pk);
    // Tunnel
    box(2.0,1.25,1.0,M.darkSteel,PK0+2.9,.95+.25,0,pk);
    box(2.02,.14,1.02,M.graphite,PK0+2.9,1.86,0,pk);
    var mouth=box(.02,.5,.6,M.heat,PK1-.01,1.2,0,pk,false);mouth.castShadow=false;
    var tunGlow=glow(0xff5a10,2.6,PK1+.1,1.2,0,S,.7);var tLight=new T.PointLight(0xff5a10,3,3.5,2);tLight.position.set(PK1+.35,1.25,0);S.add(tLight);
    var curtains=[];for(var ci=0;ci<10;ci++){var cu=box(.006,.42,.05,M.black,PK1+.01,1.22,-.25+ci*.055,pk,false);curtains.push(cu)}
    for(var vi2=0;vi2<6;vi2++)box(.12,.02,.9,M.graphite,PK0+2.2+vi2*.27,1.95,0,pk,false);
    // Dampf
    var STN=90,stG=new T.BufferGeometry(),stP=new Float32Array(STN*3);stG.setAttribute('position',new T.BufferAttribute(stP,3));
    var steam=new T.Points(stG,new T.PointsMaterial({map:TX.glow,size:.35,color:0xffd9c0,transparent:true,opacity:.16,depthWrite:false,blending:T.AdditiveBlending}));S.add(steam);
    var stSeed=[];for(var sti=0;sti<STN;sti++)stSeed.push([Math.random(),Math.random()-.5,Math.random()-.5]);

    /* ── Lagenpalettierer ─────────────── */
    var pal=new T.Group();S.add(pal);
    box(1.0,.06,.7,M.brushed,TB+.25,CH-.03,0,pal); // Lagenbildungstisch
    var GX0=TB-.2,GX1=PAL+.9,GZ=.75,GH=3.1;
    [[GX0,-GZ],[GX0,GZ],[GX1,-GZ],[GX1,GZ]].forEach(function(q){box(.14,GH,.14,M.orange,q[0],GH/2,q[1],pal);box(.3,.04,.3,M.darkSteel,q[0],.02,q[1],pal)});
    box(GX1-GX0+.14,.16,.14,M.orange,(GX0+GX1)/2,GH,-GZ,pal);box(GX1-GX0+.14,.16,.14,M.orange,(GX0+GX1)/2,GH,GZ,pal);
    var carriage=new T.Group();pal.add(carriage);box(.3,.2,GZ*2+.2,M.graphite,0,GH+.12,0,carriage);
    var mast=new T.Group();mast.position.y=GH;carriage.add(mast);box(.12,1.8,.12,M.steel,0,-.9,0,mast);
    var head=new T.Group();mast.add(head);box(.95,.08,.5,M.graphite,0,0,0,head);
    [-1,1].forEach(function(q){box(.95,.25,.02,M.steel,0,-.14,q*.25,head)});
    var pBeacon=glow(0xff8f42,.35,GX1,GH+.25,-GZ,S,.9);
    // Rollenbahn für Paletten
    box(4,.05,.9,M.brushed,PAL+.8,.32,0,pal);for(var rr=0;rr<26;rr++)cyl(.035,.88,M.steel,PAL-1.1+rr*.15,.36,0,pal,12).rotation.x=Math.PI/2;
    function palletMesh(){var g=new T.Group();for(var k=0;k<3;k++)box(.84,.03,.12,M.wood,0,.13,-.29+k*.29,g);for(var k2=0;k2<3;k2++)box(.12,.09,.66,M.wood,-.36+k2*.36,.07,0,g);for(var k3=0;k3<5;k3++)box(.12,.025,.66,M.wood,-.36+k3*.18,.16,0,g);return g}
    var palA=palletMesh(),palB=palletMesh();palA.position.y=palB.position.y=.32;S.add(palA);S.add(palB);
    // Gabelstapler (geparkt)
    var fork=new T.Group();fork.position.set(21.6,0,2.2);fork.rotation.y=-2.3;S.add(fork);
    box(1.0,.6,.8,M.orange,0,.5,0,fork);box(.6,.05,.75,M.black,.05,1.5,0,fork);[[-.3,-.35],[.3,-.35],[-.3,.35],[.3,.35]].forEach(function(q){box(.04,1.0,.04,M.black,q[0],1.0,q[1],fork)});
    box(.1,1.6,.6,M.darkSteel,.55,.85,0,fork);box(.7,.04,.1,M.steel,.9,.12,-.18,fork);box(.7,.04,.1,M.steel,.9,.12,.18,fork);
    [[-.32,-.42],[.32,-.42],[-.32,.42],[.32,.42]].forEach(function(q){var w=cyl(.17,.14,M.rubber,q[0],.17,q[1],fork,20);w.rotation.x=Math.PI/2});
    glow(0xff8f42,.3,0,1.58,0,fork,.8);

    /* Staub in der Luft */
    var DN=MOB?600:1400,dG=new T.BufferGeometry(),dP=new Float32Array(DN*3),dS=[];
    for(var di=0;di<DN;di++){dS.push([Math.random()*30-6,Math.random()*6.5+.2,Math.random()*9-4.5,Math.random()*TAU]);}
    dG.setAttribute('position',new T.BufferAttribute(dP,3));
    var dust=new T.Points(dG,new T.PointsMaterial({map:TX.glow,size:.045,color:0xffe7cf,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));S.add(dust);

    /* Lichter */
    var hemi=new T.HemisphereLight(0x9fb4c8,0x1a1512,.35);S.add(hemi);
    var key=new T.DirectionalLight(0xfff0e0,2.2);key.position.set(10,12,7);key.target.position.set(8,0,0);S.add(key);S.add(key.target);
    key.castShadow=true;key.shadow.mapSize.set(MOB?1024:2048,MOB?1024:2048);var kc=key.shadow.camera;kc.left=-16;kc.right=16;kc.top=8;kc.bottom=-8;kc.near=2;kc.far=40;key.shadow.bias=-.0003;key.shadow.normalBias=.02;
    var rim=new T.DirectionalLight(0xff9a5a,.8);rim.position.set(-8,5,-9);S.add(rim);
    var accent=new T.PointLight(0xff8f42,0,6,2);S.add(accent);

    /* ── Drehbuch ─────────────────────── */
    function V3(x,y,z){return new T.Vector3(x,y,z)}
    var SHOTS=[
      {n:'intro',w:1.1,a:[V3(12,9.5,17),V3(7,1.2,0)],b:[V3(9,7.2,13.5),V3(6,1,0)],fov:40,g:{bg:0x07080a,fog:.05,exp:.75,hemi:.15,key:.6,acc:0x6688ff}},
      {n:'blow',w:1,a:[V3(-6.2,2.1,3.4),V3(-3.4,1.0,-.2)],b:[V3(-3.0,1.75,2.6),V3(-2.4,1.0,-.3)],fov:36,g:{bg:0x140b07,fog:.06,exp:1.05,hemi:.3,key:1.1,acc:0xff5a1a}},
      {n:'wheel',w:.9,a:[V3(-.1,2.3,2.2),V3(-1,1.15,-.7)],b:[V3(-1.9,2.0,2.0),V3(-1,1.1,-.6)],fov:34,g:{bg:0x0d0c0b,fog:.05,exp:1.05,hemi:.35,key:1.2,acc:0xff7a2a}},
      {n:'fill',w:1.3,ride:WF,fov:30,g:{bg:0x081016,fog:.055,exp:1.15,hemi:.4,key:1.2,acc:0x7fd0ff}},
      {n:'cap',w:.9,a:[V3(4.0,2.5,1.5),V3(4.6,1.6,-.4)],b:[V3(5.5,1.75,1.15),V3(4.9,1.15,-.35)],fov:34,g:{bg:0x0c0c0e,fog:.05,exp:1.05,hemi:.35,key:1.2,acc:0xffffff}},
      {n:'insp',w:.9,a:[V3(5.1,1.5,1.5),V3(6.4,1.1,0)],b:[V3(7.7,1.45,1.35),V3(6.5,1.1,0)],fov:32,g:{bg:0x08070a,fog:.06,exp:1.0,hemi:.2,key:.8,acc:0xff3010}},
      {n:'lab',w:.9,a:[V3(8.4,3.6,1.3),V3(8.4,1,-.6)],b:[V3(9.4,2.8,1.8),V3(8.6,1,-.5)],fov:36,g:{bg:0x110d09,fog:.045,exp:1.1,hemi:.45,key:1.3,acc:0xffb070}},
      {n:'pack',w:1,a:[V3(15.3,1.25,1.5),V3(14.3,1.15,0)],b:[V3(15.9,1.55,1.0),V3(14.7,1.05,0)],fov:34,g:{bg:0x1a0a03,fog:.065,exp:1.1,hemi:.3,key:1.0,acc:0xff5a10}},
      {n:'pal',w:1.1,a:[V3(15.6,.55,4.2),V3(17.8,1.7,0)],b:[V3(20.2,.8,3.6),V3(17.6,1.9,0)],fov:34,g:{bg:0x0b0e12,fog:.045,exp:1.1,hemi:.45,key:1.4,acc:0xff8f42}},
      {n:'outro',w:1.2,a:[V3(22,3.2,7.5),V3(12,1,0)],b:[V3(10,15,21),V3(7.5,.4,0)],fov:42,g:{bg:0x1a1410,fog:.025,exp:1.2,hemi:.7,key:1.6,acc:0xffa060}}
    ];
    var HOLD=.5,tot=0,POS=[];SHOTS.forEach(function(s){POS.push(tot);tot+=s.w});POS.push(tot);POS=POS.map(function(v){return v/tot});
    var cA=new T.Color(),cB=new T.Color(),tmpP=new T.Vector3(),tmpT=new T.Vector3(),tP2=new T.Vector3(),tT2=new T.Vector3();
    function shotCam(s,u,t,outP,outT){
      if(s.ride){var c=s.ride,ang=-(V*t)/c.R+.35+u*.5,rr=c.R+.5-u*.08;
        outP.set(c.cx+rr*Math.sin(ang),CH+.58-u*.06,c.cz+rr*Math.cos(ang));var at2=ang-.38;outT.set(c.cx+c.R*Math.sin(at2),CH+.2,c.cz+c.R*Math.cos(at2));return}
      var e=ss(0,1,u);outP.copy(s.a[0]).lerp(s.b[0],e);outT.copy(s.a[1]).lerp(s.b[1],e);
    }
    var F=0,FS=0,raf=0,running=false,t0=performance.now()/1000-30,lastShot=-1,mx=0,my=0,smx=0,smy=0;
    function grade(gA,gB,e){
      cA.set(gA.bg);cB.set(gB.bg);cA.lerp(cB,e);R.setClearColor(cA);S.fog.color.copy(cA);
      S.fog.density=lerp(gA.fog,gB.fog,e)*(MOB?.8:1);R.toneMappingExposure=lerp(gA.exp,gB.exp,e);hemi.intensity=lerp(gA.hemi,gB.hemi,e);key.intensity=lerp(gA.key,gB.key,e);
      cA.set(gA.acc);cB.set(gB.acc);accent.color.copy(cA.lerp(cB,e));
    }

    /* ── Frame ────────────────────────── */
    function frame(){
      var t=o.reduced?30:performance.now()/1000-t0;
      FS+=(F-FS)*(o.reduced?1:.06);if(Math.abs(F-FS)<1e-5)FS=F;
      // Kamera
      var i=0;while(i<SHOTS.length-1&&FS>=POS[i+1])i++;
      var loc=(FS-POS[i])/(POS[i+1]-POS[i]),s=SHOTS[i],n=SHOTS[Math.min(SHOTS.length-1,i+1)];
      var shotIdx=i;
      if(loc<=HOLD||i===SHOTS.length-1){shotCam(s,Math.min(1,loc/HOLD),t,tmpP,tmpT);grade(s.g,s.g,0);CAM.fov=s.fov}
      else{var u=ss(0,1,ss(0,1,(loc-HOLD)/(1-HOLD)));shotCam(s,1,t,tmpP,tmpT);shotCam(n,0,t,tP2,tT2);
        var lift=Math.sin(u*Math.PI)*Math.min(1.4,tmpP.distanceTo(tP2)*.18);tmpP.lerp(tP2,u);tmpP.y+=lift;tmpT.lerp(tT2,u);grade(s.g,n.g,u);CAM.fov=lerp(s.fov,n.fov,u);if(u>.5)shotIdx=i+1;
        if(o.onFlash)o.onFlash(Math.pow(Math.sin(u*Math.PI),3))}
      if(loc<=HOLD&&o.onFlash)o.onFlash(0);
      smx+=(mx-smx)*.05;smy+=(my-smy)*.05;
      CAM.position.copy(tmpP);CAM.position.x+=smx*.12;CAM.position.y+=-smy*.08;
      if(!o.reduced){CAM.position.y+=Math.sin(t*.7)*.008;CAM.position.x+=Math.sin(t*.53)*.008}
      CAM.lookAt(tmpT);CAM.updateProjectionMatrix();
      if(shotIdx!==lastShot){lastShot=shotIdx;if(o.onShot)o.onShot(shotIdx,SHOTS[shotIdx].n)}
      accent.position.copy(tmpT).add(V3(0,.8,.8));accent.intensity=1.2;
      // Licht an (Intro)
      var on=ss(.004,.05,FS);
      leds.forEach(function(l,k){var d=ss(k/leds.length*.7,k/leds.length*.7+.3,on);l.material.color.setScalar(.05+d*1.6);cones[k].material.opacity=.075*d});
      // Rundläufer
      wheelB.rotation.y=-(V*t)/WB.R;carF.rotation.y=-(V*t)/WF.R;carC.rotation.y=-(V*t)/WC.R;carL.rotation.y=-(V*t)/WL.R;
      IHead.position.y=0;
      reels.forEach(function(r,k){r.g.rotation.y=t*(k?1.6:-1.6);r.d.rotation.y=t*6});
      // Ofen flackert
      var fl=.85+.15*Math.sin(t*13)*Math.sin(t*7.3);ovenGlow.material.opacity=.55*fl;ovenLight.intensity=1.2*fl;
      // Laser
      var ly=(Math.sin(t*5)+1)/2;laser.position.y=CH+.02+ly*.26;laserSheet.position.y=CH+.02+ly*.26;lzGlow.position.y=laser.position.y;
      // Tunnel
      var hp=.8+.2*Math.sin(t*2.3);tunGlow.material.opacity=.65*hp;tLight.intensity=3*hp;
      curtains.forEach(function(c,k){c.rotation.z=Math.sin(t*3+k)*.08});
      for(var q=0;q<STN;q++){var sd=stSeed[q],u2=(t*.22+sd[0])%1;stP[q*3]=PK0+2.3+sd[1]*1.4;stP[q*3+1]=1.95+u2*1.6;stP[q*3+2]=sd[2]*.8+u2*.3}
      stG.attributes.position.needsUpdate=true;steam.material.opacity=.14;
      // Staub
      for(var di2=0;di2<DN;di2++){var d=dS[di2];dP[di2*3]=d[0]+Math.sin(t*.1+d[3])*.4;dP[di2*3+1]=d[1]+Math.sin(t*.13+d[3]*2)*.3;dP[di2*3+2]=d[2]+Math.cos(t*.09+d[3])*.4}
      dG.attributes.position.needsUpdate=true;

      // Flaschen
      var phase=(V*t)%SP,nb=0,np=0,nl=0,nc=0,nlab=0;
      for(var k=0;k*SP<sEnd+SP;k++){var sv=phase+k*SP-SP;if(sv<0||sv>sEnd)continue;at(sv,P);
        var grow=WB.s1?ss(WB.s0+(WB.s1-WB.s0)*.45,WB.s0+(WB.s1-WB.s0)*.6,sv):1;
        var fill=ss(WF.s0+(WF.s1-WF.s0)*.06,WF.s0+(WF.s1-WF.s0)*.85,sv),cap=sv>WC.s0+(WC.s1-WC.s0)*.45,lab=ss(WL.s0+(WL.s1-WL.s0)*.25,WL.s0+(WL.s1-WL.s0)*.62,sv);
        var lift=0;if(P.c===WF)lift=.0;
        D.rotation.set(0,sv*7,0);
        if(grow<.5){D.position.set(P.x,CH,P.z);D.scale.set(1,1,1);D.updateMatrix();IPre.setMatrixAt(np++,D.matrix);continue}
        var g2=.55+.45*ss(.5,1,grow);D.position.set(P.x,CH,P.z);D.scale.set(g2,g2,g2);D.updateMatrix();IBot.setMatrixAt(nb++,D.matrix);
        if(fill>.01){D.position.set(P.x,CH+.004,P.z);D.scale.set(1,fill*.97,1);D.updateMatrix();ILiq.setMatrixAt(nl++,D.matrix)}
        if(cap){D.position.set(P.x,CH+.24,P.z);D.scale.set(1,1,1);D.updateMatrix();ICap.setMatrixAt(nc++,D.matrix)}
        if(lab>.01){D.position.set(P.x,CH+.08,P.z);D.scale.set(1,lab,1);D.updateMatrix();ILab.setMatrixAt(nlab++,D.matrix)}
      }
      // Deckel in der Rutsche
      for(var ch=0;ch<26;ch++){var cu=(t*.25+ch/26)%1,cp=chuteC.getPointAt(cu);D.position.copy(cp);D.rotation.set(0,0,0);D.scale.set(1,1,1);D.updateMatrix();ICh.setMatrixAt(ch,D.matrix)}
      ICh.instanceMatrix.needsUpdate=true;

      // Packs
      var npk=0,ncp=0;
      function pack(x,y,z,ry){D.position.set(x,y,z);D.rotation.set(0,ry||0,0);D.scale.set(1,1,1);D.updateMatrix();IPack.setMatrixAt(npk++,D.matrix);
        for(var a=0;a<3;a++)for(var b=0;b<2;b++){D.position.set(x-.07+a*.07,y+.255,z-.035+b*.07);D.updateMatrix();ICapP.setMatrixAt(ncp++,D.matrix)}}
      var ph2=(t*VP)%SPP;for(var pq=0;pq<12;pq++){var px=PK1-.1+ph2+pq*SPP;if(px<PK1-.05||px>TB-.35)continue;pack(px,CH,0)}
      // Lagenzyklus
      var J=t/LAYER_T,j=Math.floor(J),uu=J-j;
      function slot(m){var a=m%4,b=Math.floor(m/4);return [-.33+a*.22,-.15+b*.15]}
      // Tisch: neue Lage bildet sich (ab uu .15)
      var cntT=Math.min(LAYER,Math.floor(Math.max(0,(uu-.12)/.88)*LAYER+.0001));
      for(var tm=0;tm<cntT;tm++){var sl=slot(tm);pack(TB+.25+sl[0],CH,sl[1]*1)}
      // Greifer
      var tblX=TB+.25,palX=PAL,top=GH-.55,low=CH+.28,cx2,cy2=top,carry=false;
      if(uu<.12){cx2=tblX;cy2=lerp(top,low,Math.sin(uu/.12*Math.PI));carry=uu>.06}
      else if(uu<.45){var e3=ss(.12,.45,uu);cx2=lerp(tblX,palX,e3);cy2=top;carry=true}
      else if(uu<.6){var e4=Math.sin(ss(.45,.6,uu)*Math.PI);cx2=palX;carry=uu<.53}
      else{cx2=lerp(palX,tblX,ss(.6,1,uu));cy2=top}
      var m5=((j-1)%LAYERS+LAYERS)%LAYERS,placed=m5+(uu>=.53?1:0),stackY=.48;
      if(uu>=.45&&uu<.6){var lyTarget=stackY+m5*.25+.28;cy2=lerp(top,lyTarget,e4)}
      carriage.position.x=cx2;head.position.y=cy2-GH;mast.children[0].scale.y=1;
      if(carry&&j>0){for(var cm=0;cm<LAYER;cm++){var sl2=slot(cm);pack(cx2+sl2[0],cy2-.28,sl2[1])}}
      // Paletten
      var out=0,inn=1;if(m5===LAYERS-1&&uu>=.6){out=ss(.62,.82,uu);inn=ss(.82,1,uu)}
      var showCount=j>0?placed:0;if(m5===LAYERS-1&&uu>=.6)showCount=LAYERS;
      palA.position.set(PAL+out*2.6,.32,0);
      for(var ly=0;ly<showCount;ly++)for(var cm2=0;cm2<LAYER;cm2++){var sl3=slot(cm2);pack(palA.position.x+sl3[0],stackY+ly*.25,sl3[1])}
      palB.visible=m5===LAYERS-1&&uu>=.8;palB.position.set(PAL-1.6+inn*1.6,.32,0);
      if(m5===LAYERS-1&&uu>=.995)palB.visible=false;
      IPack.count=npk;ICapP.count=ncp;IPack.instanceMatrix.needsUpdate=ICapP.instanceMatrix.needsUpdate=true;

      IPre.count=np;IBot.count=nb;ILiq.count=nl;ICap.count=nc;ILab.count=nlab;
      [IPre,IBot,ILiq,ICap,ILab].forEach(function(m){m.instanceMatrix.needsUpdate=true});
      if(o.onTick)o.onTick(t,Math.floor(V*t/SP));
      R.render(S,CAM);
      raf=running&&!o.reduced?requestAnimationFrame(frame):0;
    }
    function resize(){W=host.clientWidth;H=host.clientHeight;if(!W||!H)return;R.setSize(W,H);CAM.aspect=W/H;CAM.updateProjectionMatrix();if(!running||o.reduced)frame()}
    addEventListener('resize',resize);
    addEventListener('pointermove',function(e){mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
    resize();
    return {
      set:function(p){F=clamp(p,0,1);if(o.reduced)frame()},
      start:function(){if(running)return;running=true;if(!raf)raf=requestAnimationFrame(frame)},
      stop:function(){running=false},
      snap:function(){FS=F;frame()},
      shots:SHOTS.map(function(s){return s.n}),pos:POS,hold:HOLD
    };
  }
  global.AnlageFilm=AnlageFilm;
})(window);
