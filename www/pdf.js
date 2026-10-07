/* Génération du PDF de ronde (jsPDF, fonctionne hors ligne) */
function makePDF(r,ST,PARTS,H){
const d=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),W=210,Mx=14,CW=W-2*Mx;let y=0;
const S=t=>String(t==null?'':t).replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x20-\x7E\u00A0-\u00FF]/g,'');
const INK=[20,33,43],MUT=[91,107,119],PRI=[36,51,61],OK=[27,127,76],KO=[192,57,43],LINE=[225,230,234];
const ensure=h=>{if(y+h>284){d.addPage();y=16}};
const font=(sz,b,c)=>{d.setFont('helvetica',b?'bold':'normal');d.setFontSize(sz);d.setTextColor(...(c||INK))};
const wrap=(t,sz,b,c,x,w,lh)=>{font(sz,b,c);const L=d.splitTextToSize(S(t),w);ensure(L.length*lh);L.forEach(l=>{d.text(l,x,y);y+=lh})};
const cnt=H.cnt;

/* En-tête */
d.setFillColor(...PRI);d.rect(0,0,W,30,'F');
d.setTextColor(255,255,255);d.setFont('helvetica','bold');d.setFontSize(18);d.text('RONDE DE SÉCURITÉ - '+S(BATIMENT),Mx,13);
d.setFont('helvetica','normal');d.setFontSize(11);d.text((H.label?H.label+'  -  ':'')+'Ronde du '+H.fd(r.debut),Mx,21.5);
/* Logo (www/logo.png, même couleur de fond que le bandeau), en haut à droite */
if(H.logo){try{const ip=d.getImageProperties(H.logo),sc=Math.min(26/ip.width,26/ip.height),w=ip.width*sc,h=ip.height*sc,x=W-Mx-w,y0=(30-h)/2;
 d.addImage(H.logo,ip.fileType||'PNG',x,y0,w,h)}catch(e){}}
y=40;
wrap('Contrôleur : '+r.agent,10,false,INK,Mx,CW,5);
wrap('Début : '+H.ft(r.debut)+'   Fin : '+(r.fin?H.ft(r.fin)+'   Durée : '+H.dur(r):'en cours'),10,false,INK,Mx,CW,5);
wrap('Bâtiment : '+BATIMENT,10,false,INK,Mx,CW,5);
if(r.incomplete){y+=2;wrap('RONDE CLÔTURÉE INCOMPLÈTE - '+cnt(r).rest+' point(s) sans réponse. Motif : '+r.motif,10,true,KO,Mx,CW,5)}
y+=3;

/* Chiffres clés */
const c=cnt(r),bw=CW/4,box=[['réalisées',c.done,INK],['conformes',c.c,OK],['non conformes',c.n,c.n?KO:INK],['sans réponse',c.rest,c.rest?KO:INK]];
box.forEach((b,i)=>{const x=Mx+i*bw;d.setDrawColor(...LINE);d.setLineWidth(.3);d.rect(x,y,bw-3,17);font(17,true,b[2]);d.text(String(b[1]),x+(bw-3)/2,y+9,{align:'center'});font(8,false,MUT);d.text(b[0],x+(bw-3)/2,y+14,{align:'center'})});
y+=24;

/* Détail par partie */
Object.keys(PARTS).forEach(k=>{const q=cnt(r,ST.filter(s=>s.ronde===k));
 wrap(PARTS[k]+' : '+q.done+'/'+q.t+' contrôlés - '+q.c+' conformes - '+q.n+' non conformes'+(q.rest?' - '+q.rest+' MANQUANT(S)':''),9.5,false,q.rest?KO:INK,Mx,CW,5)});
y+=5;

/* Anomalies */
const nc=[];ST.forEach(s=>s.pts.forEach(p=>{const x=r.r[p.k];if(x&&x.v==='NC')nc.push({s,p,x})}));
ensure(14);font(12,true,PRI);d.text('ANOMALIES ('+nc.length+')',Mx,y);y+=2;d.setDrawColor(...PRI);d.setLineWidth(.5);d.line(Mx,y,Mx+CW,y);y+=6;
if(!nc.length)wrap('Aucune anomalie constatée.',10,false,INK,Mx,CW,5);
nc.forEach(({s,p,x})=>{ensure(30);
 d.setFillColor(...KO);const y0=y-3.5;
 wrap(p.id+' - '+p.lib,10,true,KO,Mx+3,CW-3,4.8);
 wrap(s.titre+'  |  Lieu : '+x.lieu+(x.ent?'  |  Entrée '+x.ent:'')+'  |  '+H.ft(x.t),9,false,MUT,Mx+3,CW-3,4.4);
 wrap('Observation : '+x.com,9.5,false,INK,Mx+3,CW-3,4.6);
 {const h=(x.hist||[]).slice(-1)[0];wrap('Suivi : '+(x.suivi||'À traiter')+(h?' (depuis le '+H.fd(h.t)+' '+H.ft(h.t)+')':''),9,true,INK,Mx+3,CW-3,4.6)}
 if(x.ph){try{const ip=d.getImageProperties(x.ph),sc=Math.min(70/ip.width,60/ip.height),w=ip.width*sc,h=ip.height*sc;ensure(h+3);d.addImage(x.ph,'JPEG',Mx+3,y,w,h);y+=h+2}catch(e){}}
 d.rect(Mx,y0,1.2,y-y0,'F');y+=5});

/* Annexe : tous les contrôles */
d.addPage();y=16;
font(12,true,PRI);d.text('DÉTAIL DE TOUS LES CONTRÔLES',Mx,y);y+=2;d.setDrawColor(...PRI);d.setLineWidth(.5);d.line(Mx,y,Mx+CW,y);y+=5;
wrap('* = validé en bloc avec « Tout mettre conforme » (heure du bloc).',8,false,MUT,Mx,CW,4);y+=2;
Object.keys(PARTS).forEach(k=>{
 ensure(12);font(10.5,true,PRI);d.text(S(PARTS[k]).toUpperCase(),Mx,y);y+=5;
 ST.filter(s=>s.ronde===k).forEach(s=>{const q=cnt(r,[s]);
  ensure(5.5+3.8*3);d.setFillColor(238,241,243);d.rect(Mx,y-3.6,CW,5,'F');
  font(8.5,true,INK);d.text(S(s.titre),Mx+1,y);font(8,false,MUT);d.text(q.c+'/'+q.t+' conformes',Mx+CW-1,y,{align:'right'});y+=5;
  s.pts.forEach(p=>{const x=r.r[p.k];font(7.5,false,INK);const L=d.splitTextToSize(S(p.lib),118),h=L.length*3.3+1;ensure(h);
   font(7.5,false,MUT);d.text(p.id,Mx+1,y);font(7.5,false,INK);L.forEach((l,i)=>d.text(l,Mx+12,y+i*3.3));
   if(!x){font(7.5,true,KO);d.text('MANQUANT',Mx+135,y)}
   else if(x.v==='C'){font(7.5,false,OK);d.text('Conforme',Mx+135,y);font(7.5,false,MUT);d.text(H.ft(x.t)+(x.bloc?' *':''),Mx+165,y)}
   else{font(7.5,true,KO);d.text('NON CONFORME',Mx+135,y);font(7.5,false,MUT);d.text(H.ft(x.t),Mx+165,y)}
   y+=h;d.setDrawColor(...LINE);d.setLineWidth(.15);d.line(Mx,y-2.8,Mx+CW,y-2.8)});
  y+=1.5})});

/* Pied de page */
const n=d.getNumberOfPages();for(let i=1;i<=n;i++){d.setPage(i);font(8,false,MUT);d.text('Ronde '+S(BATIMENT)+(H.label?' - '+H.label:'')+' - '+H.fd(r.debut)+' - page '+i+'/'+n,Mx,291)}
return d}
if(typeof module!=='undefined')module.exports={makePDF};
