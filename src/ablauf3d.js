/* ─────────────────────────────────────────────────────────────
   BEVMAQ · Ablauf in 3D (three.js r158, global THREE)
   Eine Studio-Bühne mit Drehteller. Fünf Motive morphen per Scroll:
   0 Daten-Scan der Maschine · 1 Marktwert-Gauge · 2 Globus mit Routen
   3 Schloss + Münzen · 4 Container-LKW
   API: var a=Ablauf3D(host,{reduced}); a.set(f) mit f von 0 bis 4; a.start(); a.stop();
   ───────────────────────────────────────────────────────────── */
(function(global){
  'use strict';
  function sstep(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x)}
  function backOut(x){var c=1.6;x=Math.max(0,Math.min(1,x));return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}
  function lerp(a,b,u){return a+(b-a)*u}

  function Ablauf3D(host,o){
    o=o||{};var T=global.THREE;if(!T)return null;
    var W=host.clientWidth||600,H=host.clientHeight||600;
    var R=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    R.setPixelRatio(Math.min(1.75,global.devicePixelRatio||1));R.setSize(W,H);
    R.outputColorSpace=T.SRGBColorSpace;R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=.9;
    R.shadowMap.enabled=true;R.shadowMap.type=T.PCFShadowMap;
    host.appendChild(R.domElement);R.domElement.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';

    var S=new T.Scene(),CAM=new T.PerspectiveCamera(28,W/H,.1,80);

    /* Umgebung: Studio mit Lichtflächen (für Reflexionen) */
    (function(){
      var r=new T.Scene(),g=new T.BoxGeometry();
      var room=new T.Mesh(g,new T.MeshStandardMaterial({side:T.BackSide,color:0xd0cdc8}));room.scale.set(30,18,30);room.position.y=7;r.add(room);
      var pl=new T.PointLight(0xffffff,300,0,2);pl.position.set(0,10,0);r.add(pl);
      function L(i,x,y,z,sx,sy,sz,c){var m=new T.Mesh(g,new T.MeshBasicMaterial({color:new T.Color(c||0xffffff).multiplyScalar(i)}));m.position.set(x,y,z);m.scale.set(sx,sy,sz);r.add(m)}
      L(6,0,15.5,0,12,.2,5);L(3.5,-14.5,7,2,.2,6,8);L(2,14.5,5,-3,.2,5,6);L(1.2,2,6,-14.5,10,5,.2);L(1,-4,3,14.5,6,3,.2,0xffd2b0);
      var pm=new T.PMREMGenerator(R);S.environment=pm.fromScene(r,.035).texture;pm.dispose();
    })();

    var key=new T.DirectionalLight(0xffffff,2.2);key.position.set(4,9,5);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.radius=6;key.shadow.bias=-.0004;
    var sc=key.shadow.camera;sc.left=-5;sc.right=5;sc.top=5;sc.bottom=-5;sc.near=1;sc.far=25;S.add(key);
    S.add(new T.HemisphereLight(0xffffff,0xe9e2d8,.35));
    var rim=new T.DirectionalLight(0xffc49a,.9);rim.position.set(-6,3,-5);S.add(rim);

    /* Materialien */
    var M={
      white:new T.MeshPhysicalMaterial({color:0xf3f2ef,roughness:.38,clearcoat:.7,clearcoatRoughness:.25}),
      steel:new T.MeshPhysicalMaterial({color:0xdfe3e6,metalness:1,roughness:.22}),
      steelD:new T.MeshPhysicalMaterial({color:0x9aa0a5,metalness:1,roughness:.35}),
      orange:new T.MeshPhysicalMaterial({color:0xff8636,roughness:.3,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:.6}),
      gold:new T.MeshPhysicalMaterial({color:0xffb074,metalness:1,roughness:.26}),
      ink:new T.MeshPhysicalMaterial({color:0x1f1d1a,roughness:.45,clearcoat:.4}),
      glass:new T.MeshPhysicalMaterial({color:0xffffff,roughness:.04,metalness:0,transparent:true,opacity:.28,clearcoat:1,envMapIntensity:1.6,depthWrite:false}),
      liquid:new T.MeshPhysicalMaterial({color:0xff7a22,roughness:.12,clearcoat:1,transparent:true,opacity:.92}),
      glow:new T.MeshStandardMaterial({color:0xff7a22,emissive:0xff6a10,emissiveIntensity:1.6}),
      grey:new T.MeshPhysicalMaterial({color:0xd8d5d0,roughness:.5}),
      dot:new T.MeshStandardMaterial({color:0x3a3632,roughness:.6})
    };
    function mesh(g,m,cast){var x=new T.Mesh(g,m);x.castShadow=cast!==false;x.receiveShadow=true;return x}
    function cyl(r,h,m,seg){return mesh(new T.CylinderGeometry(r,r,h,seg||48),m)}

    /* Boden + Drehteller */
    var ground=new T.Mesh(new T.PlaneGeometry(40,40),new T.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;S.add(ground);
    var plinth=cyl(2.35,.16,M.white,96);plinth.position.y=.08;S.add(plinth);
    var ringO=mesh(new T.TorusGeometry(2.35,.012,8,160),M.glow,false);ringO.rotation.x=Math.PI/2;ringO.position.y=.165;S.add(ringO);
    var turn=new T.Group();S.add(turn);

    /* Flasche (Lathe) */
    var prof=[[0,0],[.085,0],[.092,.02],[.092,.3],[.085,.36],[.05,.43],[.036,.47],[.036,.53],[0,.53]].map(function(p){return new T.Vector2(p[0],p[1])});
    var bottleG=new T.LatheGeometry(prof,24),liqG=new T.CylinderGeometry(.078,.078,1,20);liqG.translate(0,.5,0);
    function bottle(fill,cap){
      var g=new T.Group(),b=mesh(bottleG,M.glass,false);g.add(b);
      var l=mesh(liqG,M.liquid);l.scale.y=.32*fill;l.position.y=.012;g.add(l);
      if(cap){var c=cyl(.042,.04,M.ink,16);c.position.y=.55;g.add(c)}
      var lab=cyl(.094,.1,M.white,24);lab.position.y=.17;lab.castShadow=false;g.add(lab);
      return g;
    }

    /* ── 0/1: Füller ─────────────────── */
    function machine(){
      var g=new T.Group();
      var base=cyl(1.25,.5,M.white,96);base.position.y=.25;g.add(base);
      var band=cyl(1.262,.05,M.orange,96);band.position.y=.42;g.add(band);
      var car=new T.Group();g.add(car);
      var table=cyl(1.15,.05,M.steel,96);table.position.y=.525;car.add(table);
      var N=18;for(var i=0;i<N;i++){var a=i/N*Math.PI*2,x=Math.cos(a)*.96,z=Math.sin(a)*.96;
        var b=bottle(.55+.45*((i%5)/4),true);b.position.set(x,.55,z);car.add(b);
        var v=cyl(.055,.24,M.steel,16);v.position.set(x,1.25,z);car.add(v);
        var tip=cyl(.03,.05,M.ink,12);tip.position.set(x,1.11,z);car.add(tip)}
      var ring=cyl(1.12,.07,M.steel,96);ring.position.y=1.4;car.add(ring);
      var col=cyl(.16,.9,M.steelD,32);col.position.y=.95;car.add(col);
      var tank=cyl(.58,.42,M.steel,64);tank.position.y=1.66;car.add(tank);
      var dome=mesh(new T.SphereGeometry(.58,48,24,0,Math.PI*2,0,Math.PI/2),M.steel);dome.scale.y=.42;dome.position.y=1.87;car.add(dome);
      var bc=cyl(.07,.16,M.glow,24);bc.position.y=2.2;bc.castShadow=false;g.add(bc);
      var bl=new T.PointLight(0xff8f42,0,3,2);bl.position.y=2.25;g.add(bl);
      g.userData={car:car,beacon:bl};
      return g;
    }
    var mach=machine();turn.add(mach);

    // Scan-Ring + Typenschild-Hologramm + Datenpartikel
    var scan=mesh(new T.TorusGeometry(1.42,.014,8,160),M.glow,false);scan.rotation.x=Math.PI/2;turn.add(scan);
    var scanDisc=new T.Mesh(new T.CircleGeometry(1.42,96),new T.MeshBasicMaterial({color:0xff8f42,transparent:true,opacity:.08,side:T.DoubleSide,depthWrite:false}));scanDisc.rotation.x=-Math.PI/2;turn.add(scanDisc);
    var plateTex=(function(){var c=document.createElement('canvas');c.width=768;c.height=440;var x=c.getContext('2d');
      x.fillStyle='rgba(255,255,255,.92)';x.beginPath();x.roundRect?x.roundRect(4,4,760,432,28):x.rect(4,4,760,432);x.fill();x.strokeStyle='rgba(21,19,15,.18)';x.lineWidth=3;x.stroke();
      x.fillStyle='#15130F';x.font='700 46px Barlow, Arial, sans-serif';x.fillText('BEV',44,82);var w=x.measureText('BEV').width;x.fillStyle='#FF8F42';x.fillText('MAQ',44+w,82);
      x.fillStyle='#8A857F';x.font='600 26px "Barlow Condensed", sans-serif';x.fillText('TYPENSCHILD · ANKAUF',380,78);
      x.fillStyle='rgba(21,19,15,.14)';x.fillRect(44,106,680,2);
      var rows=[['HERSTELLER','KRONES'],['MODELL','MODULFILL'],['BAUJAHR','2012'],['ZUSTAND','IN PRODUKTION']];
      rows.forEach(function(r,i){var y=160+i*68;x.fillStyle='#8A857F';x.font='600 24px "Barlow Condensed", sans-serif';x.fillText(r[0],44,y);x.fillStyle='#15130F';x.font='500 32px "Barlow Condensed", monospace';x.fillText(r[1],300,y+4)});
      x.fillStyle='#FF8F42';x.fillRect(44,400,220,6);
      var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t})();
    var plate=new T.Mesh(new T.PlaneGeometry(1.6,.92),new T.MeshBasicMaterial({map:plateTex,transparent:true,toneMapped:false,depthWrite:false}));S.add(plate);
    var PN=70,parts=new T.InstancedMesh(new T.BoxGeometry(.045,.045,.045),M.glow,PN);parts.castShadow=false;S.add(parts);
    var pSeed=[];for(var i=0;i<PN;i++)pSeed.push([Math.random()*Math.PI*2,Math.random()*1.6+.4,Math.random()]);

    /* ── 1: Gauge + Balken ───────────── */
    var gauge=new T.Group();S.add(gauge);var gaugeW=new T.Group();S.add(gaugeW);
    var GN=44,gSeg=new T.InstancedMesh(new T.BoxGeometry(.1,.26,.08),M.orange,GN),gOff=new T.InstancedMesh(new T.BoxGeometry(.1,.26,.08),M.grey,GN);
    gSeg.castShadow=gOff.castShadow=true;gauge.add(gOff);gauge.add(gSeg);
    var needle=new T.Group(),nd=mesh(new T.BoxGeometry(.05,1.75,.05),M.ink);nd.position.y=.875;needle.add(nd);var hub=cyl(.12,.1,M.ink,32);hub.rotation.x=Math.PI/2;needle.add(hub);
    gauge.add(needle);
    var bars=[],BH=[.45,.7,.6,.95,1.2,1.5];
    BH.forEach(function(h,i){var b=mesh(new T.BoxGeometry(.22,1,.22),i===5?M.orange:M.white);b.position.set(1.25+i*.27,.16,.9);b.userData.h=h;gaugeW.add(b);bars.push(b)});
    var dm=new T.Object3D();

    /* ── 2: Globus ────────────────────── */
    var globe=new T.Group();S.add(globe);globe.position.y=1.55;
    var gl=mesh(new T.SphereGeometry(1.18,96,64),M.white);globe.add(gl);
    function land(lat,lon){ // grobe Kontinentmaske aus Ellipsen
      var E=[[50,10,22,40],[8,20,28,25],[-15,25,20,18],[45,90,25,60],[25,78,12,14],[-25,135,13,22],[45,-100,20,40],[60,-110,15,50],[-15,-60,28,18],[70,-40,10,20],[35,105,15,25]];
      for(var i=0;i<E.length;i++){var e=E[i],dl=(lat-e[0])/e[2],dn=((lon-e[1]+540)%360-180)/e[3];if(dl*dl+dn*dn<1)return true}return false}
    function ll(lat,lon,r){var p=(90-lat)*Math.PI/180,t=(lon+180)*Math.PI/180;return new T.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t))}
    var DN=2600,dots=[],i2;
    for(i2=0;i2<DN;i2++){var y=1-2*(i2+.5)/DN,rr=Math.sqrt(1-y*y),th=i2*2.39996,lat=Math.asin(y)*180/Math.PI,lon=((Math.atan2(Math.sin(th)*rr,Math.cos(th)*rr)*180/Math.PI)+360)%360-180;if(land(lat,lon))dots.push([lat,lon])}
    var dotM=new T.InstancedMesh(new T.CircleGeometry(.014,8),M.dot,dots.length);
    dots.forEach(function(d,i){var p=ll(d[0],d[1],1.185);dm.position.copy(p);dm.lookAt(p.clone().multiplyScalar(2));dm.updateMatrix();dotM.setMatrixAt(i,dm.matrix)});globe.add(dotM);
    var HOME=[52.6,7.9],DEST=[[40.7,-74],[-23.5,-46.6],[6.5,3.4],[25.2,55.3],[19,72.8],[31.2,121.5],[19.4,-99.1],[-33.9,18.4],[55.7,37.6]];
    var homeP=ll(HOME[0],HOME[1],1.19),pin=cyl(.05,.05,M.glow,24);pin.position.copy(homeP);pin.lookAt(0,0,0);pin.rotateX(Math.PI/2);globe.add(pin);
    var homeRing=mesh(new T.TorusGeometry(.09,.008,8,48),M.glow,false);homeRing.position.copy(homeP.clone().multiplyScalar(1.002));homeRing.lookAt(homeP.clone().multiplyScalar(2));globe.add(homeRing);
    var arcs=DEST.map(function(d,i){var B=ll(d[0],d[1],1.19),mid=homeP.clone().add(B).multiplyScalar(.5),len=homeP.distanceTo(B);mid.normalize().multiplyScalar(1.19+len*.42);
      var curve=new T.QuadraticBezierCurve3(homeP,mid,B),tg=new T.TubeGeometry(curve,64,.009,6,false),m=mesh(tg,M.glow,false);globe.add(m);
      var dot=mesh(new T.SphereGeometry(.03,12,8),M.glow,false);globe.add(dot);var end=cyl(.035,.03,M.orange,16);end.position.copy(B);end.lookAt(0,0,0);end.rotateX(Math.PI/2);globe.add(end);
      return {m:m,curve:curve,dot:dot,end:end,n:tg.index.count,d:i*.07}});
    globe.rotation.y=-1.75;globe.rotation.x=.42;

    /* ── 3: Schloss + Münzen ──────────── */
    var lock=new T.Group();S.add(lock);
    var body=mesh(new T.BoxGeometry(1.3,1.05,.5),M.orange);body.position.y=.72;lock.add(body);
    var bev=mesh(new T.BoxGeometry(1.22,.97,.52),M.orange);bev.position.y=.72;lock.add(bev); // Kanten-Illusion
    var kh=cyl(.11,.06,M.ink,32);kh.rotation.x=Math.PI/2;kh.position.set(0,.82,.27);lock.add(kh);
    var ks=mesh(new T.BoxGeometry(.07,.24,.06),M.ink);ks.position.set(0,.67,.27);lock.add(ks);
    var shack=new T.Group();lock.add(shack);
    var arc=mesh(new T.TorusGeometry(.42,.085,24,64,Math.PI),M.steel);arc.position.y=.62;shack.add(arc);
    var legL=cyl(.085,.62,M.steel,24),legR=cyl(.085,.62,M.steel,24);legL.position.set(-.42,.31,0);legR.position.set(.42,.31,0);shack.add(legL);shack.add(legR);
    shack.position.y=1.0;
    var CN=10,coins=[],coinG=new T.CylinderGeometry(.3,.3,.07,48);
    for(var c=0;c<CN;c++){var cm=mesh(coinG,M.gold);lock.add(cm);coins.push(cm)}
    var shield=mesh(new T.TorusGeometry(1.75,.012,8,180),M.glow,false);shield.rotation.x=Math.PI/2;S.add(shield);

    /* ── 4: Container-LKW ─────────────── */
    var truck=new T.Group();S.add(truck);var TS=.78;
    var chassis=mesh(new T.BoxGeometry(3.7,.16,.95),M.ink);chassis.position.set(.1,.42,0);truck.add(chassis);
    var cab=mesh(new T.BoxGeometry(.9,1.05,1.02),M.white);cab.position.set(2.05,1.0,0);truck.add(cab);
    var wind=mesh(new T.BoxGeometry(.04,.42,.9),M.ink);wind.position.set(2.51,1.2,0);truck.add(wind);
    var stripe=mesh(new T.BoxGeometry(.91,.07,1.03),M.orange);stripe.position.set(2.05,.72,0);truck.add(stripe);
    var wheels=[];[-1.25,-.7,1.95].forEach(function(x){[-.48,.48].forEach(function(z){var w=cyl(.24,.18,M.ink,32);w.rotation.x=Math.PI/2;w.position.set(x,.24,z);truck.add(w);wheels.push(w);
      var hubc=cyl(.11,.19,M.steel,24);hubc.rotation.x=Math.PI/2;hubc.position.copy(w.position);truck.add(hubc);wheels.push(hubc)})});
    var cont=new T.Group();truck.add(cont);cont.position.set(-.3,.5,0);
    var CL=2.9,CH=1.15,CD=1.0;
    var floor=mesh(new T.BoxGeometry(CL,.06,CD),M.orange);floor.position.y=.03;cont.add(floor);
    var roof=mesh(new T.BoxGeometry(CL,.06,CD),M.orange);roof.position.y=CH;cont.add(roof);
    var front=mesh(new T.BoxGeometry(.06,CH,CD),M.orange);front.position.set(CL/2,CH/2,0);cont.add(front);
    var ribG=new T.BoxGeometry(.07,CH-.06,.05);
    [-1,1].forEach(function(sd){var wall=mesh(new T.BoxGeometry(CL,CH,.03),M.orange);wall.position.set(0,CH/2,sd*CD/2);cont.add(wall);
      for(var r=0;r<20;r++){var rb=mesh(ribG,M.orange);rb.position.set(-CL/2+.1+r*(CL-.2)/19,CH/2,sd*(CD/2+.02));cont.add(rb)}});
    var doorL=new T.Group(),doorR=new T.Group();
    [doorL,doorR].forEach(function(d,i){var s=i?-1:1,pl=mesh(new T.BoxGeometry(.05,CH,CD/2),M.orange);pl.position.set(0,CH/2,-s*CD/4);d.add(pl);
      var bar=cyl(.018,CH*.9,M.steel,12);bar.position.set(-.04,CH/2,-s*CD/4*1.4);d.add(bar);d.position.set(-CL/2,0,s*CD/2);cont.add(d)});
    var mini=machine();mini.scale.setScalar(.36);cont.add(mini);
    var road=new T.Group();S.add(road);var dashG=new T.BoxGeometry(.5,.01,.06),dashM=new T.MeshStandardMaterial({color:0xffffff,roughness:.6});
    var dashes=[];for(var dd=0;dd<14;dd++){var ds=mesh(dashG,M.grey,false);ds.position.set(-7+dd*1,0.005,1.15);road.add(ds);dashes.push(ds)}

    /* ── Steuerung ────────────────────── */
    var F=0,FS=0,t0=performance.now(),raf=0,running=false,px=0,py=0,ppx=0,ppy=0;
    var CAMS=[ // azimut, höhe, distanz, blickhöhe
      [.62,3.6,11.2,1.15],[.15,3.2,11.6,1.25],[.05,2.8,10.6,1.4],[.45,3.0,10.8,1.0],[.9,3.6,13.2,.9]];
    function pres(i){return 1-sstep(.22,.78,Math.abs(FS-i))}
    function grow(g,e,spin){var s=Math.max(.0001,backOut(e));g.scale.setScalar(s);g.visible=e>.002;if(spin!=null)g.rotation.y=spin+(1-e)*1.2}

    function frame(){
      var t=(performance.now()-t0)/1000;FS+=(F-FS)*(o.reduced?1:.08);if(Math.abs(F-FS)<1e-4)FS=F;
      var p0=pres(0),p1=pres(1),p2=pres(2),p3=pres(3),p4=pres(4),pm=Math.max(p0,p1);
      turn.rotation.y=o.reduced?0:t*.12;
      // Kamera: Bogenfahrt zwischen den Stationen + Zeiger-Parallaxe
      var i0=Math.floor(Math.min(3.999,FS)),u2=sstep(0,1,FS-i0),A=CAMS[i0],B=CAMS[Math.min(4,i0+1)];
      ppx+=(px-ppx)*.05;ppy+=(py-ppy)*.05;
      var az=lerp(A[0],B[0],u2)+ppx*.12,hh=lerp(A[1],B[1],u2)+ppy*.4,dist=lerp(A[2],B[2],u2),ly=lerp(A[3],B[3],u2);
      var asp=CAM.aspect;if(asp<.8)dist*=1.35/asp*.62+.2;
      CAM.position.set(Math.sin(az)*dist,hh,Math.cos(az)*dist);CAM.lookAt(0,ly,0);


      // Maschine
      grow(mach,pm,0);mach.userData.car.rotation.y=-t*.6;mach.userData.beacon.intensity=pm*(1.2+.8*Math.sin(t*5));
      mach.position.y=(1-pm)*-.4;
      // Scan
      var sy=.15+(Math.sin(t*1.6)*.5+.5)*1.95;scan.position.y=sy;scanDisc.position.y=sy;scan.visible=scanDisc.visible=p0>.01;scan.scale.setScalar(.001+p0);scanDisc.scale.setScalar(.001+p0);
      plate.visible=p0>.01;var pp=new T.Vector3(1.95,1.75+Math.sin(t*1.3)*.06,.55);plate.position.copy(pp);plate.quaternion.copy(CAM.quaternion);plate.scale.setScalar(Math.max(.001,backOut(sstep(0,1,p0))));plate.material.opacity=p0;
      // Partikel: von der Maschine zum Schild
      var tmp=new T.Vector3();
      for(var i=0;i<PN;i++){var sd=pSeed[i],u=(t*.35+sd[2])%1,a=sd[0]+turn.rotation.y,src=new T.Vector3(Math.cos(a)*1.3,sd[1],Math.sin(a)*1.3);
        tmp.copy(src).lerp(pp,u*u);tmp.y+=Math.sin(u*Math.PI)*.5;dm.position.copy(tmp);dm.rotation.set(t*2+i,t*3,0);dm.scale.setScalar(p0*(1-u)*(.6+sd[2]));dm.updateMatrix();parts.setMatrixAt(i,dm.matrix)}
      parts.instanceMatrix.needsUpdate=true;parts.visible=p0>.01;

      // Gauge
      gauge.visible=p1>.01;gauge.scale.setScalar(Math.max(.001,backOut(p1)));var cz=Math.cos(az),sz=Math.sin(az);gauge.position.set(-sz*1.6,1.0,-cz*1.6);gauge.rotation.y=az;gaugeW.rotation.y=az;
      var val=sstep(.15,1,p1)*.74+Math.sin(t*1.2)*.015*p1;
      for(var g=0;g<GN;g++){var ang=Math.PI*(1-g/(GN-1)),on=g/(GN-1)<=val;dm.position.set(Math.cos(ang)*1.95,Math.sin(ang)*1.95,0);dm.rotation.set(0,0,ang-Math.PI/2);
        dm.scale.setScalar(1);dm.updateMatrix();(on?gSeg:gOff).setMatrixAt(g,dm.matrix);dm.scale.setScalar(0);dm.updateMatrix();(on?gOff:gSeg).setMatrixAt(g,dm.matrix)}
      gSeg.instanceMatrix.needsUpdate=gOff.instanceMatrix.needsUpdate=true;needle.rotation.z=Math.PI/2-Math.PI*val;
      bars.forEach(function(b,i){var e=sstep(i*.08,.55+i*.08,p1),h=b.userData.h*e+.001;b.scale.y=h;b.position.y=.16+h/2;b.visible=p1>.01});

      // Globus
      globe.visible=p2>.01;globe.scale.setScalar(Math.max(.001,backOut(p2)));globe.rotation.y=-1.75+(o.reduced?0:Math.sin(t*.25)*.18);
      homeRing.scale.setScalar(1+((t*.9)%1)*1.6);homeRing.material=M.glow;
      arcs.forEach(function(A){var k=sstep(.2+A.d,.75+A.d,p2);A.m.geometry.setDrawRange(0,Math.floor(A.n*k/6)*6);var u=(t*.45+A.d*3)%1;A.dot.position.copy(A.curve.getPoint(u));A.dot.visible=k>.98;A.end.scale.setScalar(k>.98?1:.001)});

      // Schloss
      lock.visible=p3>.01;lock.scale.setScalar(Math.max(.001,backOut(p3)));lock.rotation.y=az-.25+(o.reduced?0:Math.sin(t*.6)*.12)+(1-p3)*1.4;
      shack.position.y=1.0+.38*(1-sstep(.55,.92,p3));
      coins.forEach(function(cm,i){var e=sstep(.1+i*.06,.4+i*.06,p3),side=i%2?1:-1,k=Math.floor(i/2);var drop=(1-backOut(e))*2.5;
        cm.position.set(side*1.35,.2+k*.075+drop,.35);cm.rotation.set(0,i,0);cm.visible=e>0;cm.scale.setScalar(e>0?1:.001)});
      shield.visible=p3>.01;shield.scale.setScalar(.001+sstep(.6,1,p3));shield.position.y=.2+Math.sin(t*2)*.03;

      // LKW
      truck.visible=p4>.01;var e4=sstep(0,.5,p4);truck.position.set(lerp(-7,0,backOut(e4)),.16,0);truck.scale.setScalar(TS);
      var load=sstep(.35,.7,p4);mini.position.set(lerp(-3.2,-.2,load),.07,0);mini.visible=p4>.3;mini.userData.car.rotation.y=-t*.6;
      var close=sstep(.72,.95,p4);doorL.rotation.y=lerp(-1.9,0,close);doorR.rotation.y=lerp(1.9,0,close);
      var drive=p4>.97&&!o.reduced?1:0;wheels.forEach(function(w){w.rotation.y=-t*3*drive});
      road.visible=p4>.5;dashes.forEach(function(d,i){var x=((i-t*2.2*drive)%14+14)%14-7;d.position.x=x});

      R.render(S,CAM);
      raf=running&&!o.reduced?requestAnimationFrame(frame):0;
    }
    function resize(){W=host.clientWidth;H=host.clientHeight;if(!W||!H)return;R.setSize(W,H);CAM.aspect=W/H;CAM.updateProjectionMatrix();if(!running||o.reduced)frame()}
    addEventListener('resize',resize);
    host.addEventListener('pointermove',function(e){var r=host.getBoundingClientRect();px=(e.clientX-r.left)/r.width-.5;py=(e.clientY-r.top)/r.height-.5});
    host.addEventListener('pointerleave',function(){px=py=0});
    resize();frame();
    return {
      set:function(f){F=Math.max(0,Math.min(4,f));if(o.reduced)frame()},
      start:function(){if(running)return;running=true;if(!raf)raf=requestAnimationFrame(frame)},
      stop:function(){running=false},
      snap:function(){FS=F;frame()}
    };
  }
  global.Ablauf3D=Ablauf3D;
})(window);
