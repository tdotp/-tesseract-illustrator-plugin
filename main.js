(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', function () {
    var importView = byId('import-view');
    var threeView  = byId('three-view');
    var statusArea = byId('status-area');
    var errorMsg   = byId('error-msg');
    var testBtn    = byId('test-btn');
    var extractBtn = byId('extract-btn');
    var previewBtn = byId('preview-btn');
    var continueBtn= byId('continue-3d-btn');
    var debugToggle= byId('debug-toggle');
    var outputArea = byId('output-json');
    var validationStatus = byId('validation-status');
    var problemsList     = byId('problems-list');
    var canvas2d   = byId('preview-canvas');
    var ctx2d      = canvas2d ? canvas2d.getContext('2d') : null;
    var backBtn    = byId('back-btn');
    var export3dBtn= byId('export-3d-btn');
    var exportGlbBtn= byId('export-glb-btn');
    var viewport3d = byId('three-viewport');
    var canvas3d   = byId('preview-3d');
    var logArea    = byId('log-area');
    var debugDetails = byId('debug-details');
    var thicknessInput = byId('thickness-input');
    var applyThicknessBtn = byId('apply-thickness-btn');
    var materialPresetSelect = byId('material-preset');
    var materialPill = byId('material-pill');
    var refreshArtBtn = byId('refresh-art-btn');
    var artStatus = byId('art-status');
    var artSourcePill = byId('art-source-pill');
    var modeFoldBtn = byId('mode-fold-btn');
    var modeBaseBtn = byId('mode-base-btn');
    var interactionModePill = byId('interaction-mode-pill');
    var interactionStatus = byId('interaction-status');
    var viewportBadge = byId('viewport-badge');
    var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tooltab'));
    var tabPanels = Array.prototype.slice.call(document.querySelectorAll('.tabpanel'));
    var creaseControlsSlot = byId('crease-controls-slot');
    if(modeFoldBtn) modeFoldBtn.style.display='none';
    if(modeBaseBtn) modeBaseBtn.style.display='none';

    var TOLERANCE_MM   = 0.5;
    var GRAPH_EPS      = 0.5;
    var DEFAULT_THICKNESS_MM = 0.25;
    var MATERIAL_PRESETS = {
      white: { key:'white', label:'White board', shell:'#d9d5cc', shellBase:'#ece7dd', line:'#bbb3a5', hinge:'#e5dfd3' },
      kraft: { key:'kraft', label:'Kraft board', shell:'#b7aa87', shellBase:'#c7b996', line:'#8e7f5c', hinge:'#b49a6c' },
      gray:  { key:'gray',  label:'Gray board',  shell:'#aaa7a0', shellBase:'#bab7b0', line:'#807b74', hinge:'#9c978f' }
    };
    var CREASE_HINGE_RADIUS_FACTOR = 0.46;
    var CREASE_HINGE_MIN_RADIUS = 0.45;
    var CREASE_HINGE_SEGMENTS = 10;
    var CREASE_HINGE_SHOW_THRESHOLD_DEG = 2.0;
    var FOLD_BRIDGE_TOP_Z = 0.003;
    var FOLD_BRIDGE_BOTTOM_Z = 0.003;
    var CREASE_LINE_Z_OFFSET = 0.18;
    var ART_TOP_OFFSET = 0.08;
    var ART_BOTTOM_OFFSET = 0.08;

    var currentThicknessMm = DEFAULT_THICKNESS_MM;
    var currentMaterialPreset = 'white';
    var lastData   = null;
    var problems   = [];
    var currentPanelData = null;
    var currentAdjEdges = null;
    var currentBasePanelIndex = 0;
    var currentBaseSelect = null;
    var currentArtState = null;
    var creasePickables = [];
    var creaseVisuals = [];
    var panelGroupMap = [];
    var selectedFoldEdgeIdx = -1;
    var currentCreaseRows = [];
    var currentCreaseSliders = [];
    var selectedCreaseLabelEl = null;
    var selectedCreaseSliderEl = null;
    var selectedCreaseNumberEl = null;
    var interactionMode = 'fold';
    var panelLabelSprites = [];
    var foldSigns = [];
    var baseSelectionConfirmed = false;

    function setStatus(m){ statusArea.textContent = m; }
    function log(m){
      try{ console.log('[Tesseract]',m); }catch(e){}
      if(logArea){ logArea.textContent += String(m)+"\n"; logArea.scrollTop=logArea.scrollHeight; }
    }
    function clearLog(){ if(logArea){ logArea.textContent=''; } if(debugDetails) debugDetails.open=false; }

    function hasArtworkLoaded(){
      return !!(currentArtState && ((currentArtState.front && currentArtState.front.texture) || (currentArtState.back && currentArtState.back.texture)));
    }

    function getMaterialPreset(){
      return MATERIAL_PRESETS[currentMaterialPreset] || MATERIAL_PRESETS.white;
    }

    function syncMaterialPresetUI(){
      var preset = getMaterialPreset();
      if(materialPresetSelect) materialPresetSelect.value = preset.key;
      if(materialPill) materialPill.textContent = preset.label;
    }

    function getPanelShellHex(isBase){
      var preset = getMaterialPreset();
      return isBase ? preset.shellBase : preset.shell;
    }

    function getEdgeLineHex(){
      return getMaterialPreset().line;
    }

    function getFoldHingeHex(){
      return getMaterialPreset().hinge;
    }

    function getFoldHingeRadius(){
      return Math.max(CREASE_HINGE_MIN_RADIUS, currentThicknessMm * CREASE_HINGE_RADIUS_FACTOR);
    }

    function setInteractionMode(mode, announce){
      interactionMode = (mode==='base') ? 'base' : 'fold';
      if(modeFoldBtn) modeFoldBtn.classList.toggle('active', interactionMode==='fold');
      if(modeBaseBtn) modeBaseBtn.classList.toggle('active', interactionMode==='base');
      if(interactionModePill) interactionModePill.textContent = interactionMode==='base' ? 'Base selection' : 'Crease selection';
      if(interactionStatus) interactionStatus.textContent = interactionMode==='base'
        ? 'Shift + click any panel to assign it as the base. Alt/Option + click a red fold line to target a crease.'
        : 'Alt/Option + click a red fold line to target a crease. Shift + click any panel to change the base.';
      if(viewportBadge){
        viewportBadge.textContent = interactionMode==='base' ? 'Shift + click panel for base' : 'Alt/Option + click red line · Shift + click panel for base';
        if(viewport3d) viewport3d.classList.toggle('viewport-base', interactionMode==='base');
      }
      if(announce) setStatus(interactionMode==='base' ? 'Base selection mode enabled' : 'Crease selection mode enabled');
    }

    function makeLabelCanvas(text, bg, fg){
      var c=document.createElement('canvas'); c.width=256; c.height=96;
      var x=c.getContext('2d');
      x.clearRect(0,0,c.width,c.height);
      x.fillStyle=bg;
      roundRect(x, 4, 10, c.width-8, c.height-20, 20);
      x.fill();
      x.lineWidth=2; x.strokeStyle='rgba(255,255,255,0.14)'; x.stroke();
      x.fillStyle=fg; x.font='700 38px -apple-system,BlinkMacSystemFont,Segoe UI,Tahoma,sans-serif';
      x.textAlign='center'; x.textBaseline='middle'; x.fillText(text, c.width/2, c.height/2+2);
      return c;
    }

    function roundRect(ctx,x,y,w,h,r){
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.arcTo(x+w,y,x+w,y+h,r);
      ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);
      ctx.arcTo(x,y,x+w,y,r);
      ctx.closePath();
    }

    function makePanelLabelSprite(text,isBase){
      var canvas=makeLabelCanvas(text, isBase ? 'rgba(37,99,235,0.96)' : 'rgba(15,23,42,0.90)', '#ffffff');
      var tex=new THREE.CanvasTexture(canvas);
      tex.minFilter=THREE.LinearFilter; tex.needsUpdate=true;
      var mat=new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false, depthWrite:false});
      var sp=new THREE.Sprite(mat);
      sp.scale.set(34,12.75,1);
      sp.renderOrder = 120;
      return sp;
    }

    if(!importView||!threeView||!statusArea||!errorMsg||!testBtn||!extractBtn||
       !previewBtn||!continueBtn||!debugToggle||!outputArea||!validationStatus||
       !problemsList||!canvas2d||!ctx2d||!backBtn||!export3dBtn||!exportGlbBtn||!viewport3d||!canvas3d||
       !thicknessInput||!applyThicknessBtn){
      setStatus('UI mismatch - missing elements'); return;
    }

    /* ================================================================
       EXTENDSCRIPT — clean, no intrusive catch blocks
       ================================================================ */
    var EXTRACT_SCRIPT = [
      '(function(){',
      'try{',
      'var toJSON=(function(){',
      '  function esc(s){ var r="",c; for(var i=0;i<s.length;i++){ c=s.charAt(i);',
      '    if(c==String.fromCharCode(92)) r+=String.fromCharCode(92,92);',
      '    else if(c==String.fromCharCode(34)) r+=String.fromCharCode(92,34);',
      '    else if(c==String.fromCharCode(10)) r+=String.fromCharCode(92,110);',
      '    else if(c==String.fromCharCode(13)) r+=String.fromCharCode(92,114);',
      '    else if(c==String.fromCharCode(9))  r+=String.fromCharCode(92,116);',
      '    else r+=c; } return r; }',
      '  function ser(v){',
      '    if(v===null||typeof v==="undefined") return "null";',
      '    if(typeof v==="boolean") return v?"true":"false";',
      '    if(typeof v==="number") return isFinite(v)?String(v):"null";',
      '    if(typeof v==="string") return String.fromCharCode(34)+esc(v)+String.fromCharCode(34);',
      '    if(v instanceof Array){ var a=[]; for(var i=0;i<v.length;i++) a.push(ser(v[i])); return "["+a.join(",")+"]"; }',
      '    if(typeof v==="object"){ var p=[]; for(var k in v){ if(v.hasOwnProperty(k)) p.push(String.fromCharCode(34)+esc(String(k))+String.fromCharCode(34)+":"+ser(v[k])); } return "{"+p.join(",")+"}"; }',
      '    return "null"; }',
      '  return ser; })();',
      '',
      'if(!app.documents.length) return toJSON({error:"No document open"});',
      'var doc=app.activeDocument;',
      'var PT=0.352778; var EPS=0.5; var SMALL=10;',
      'var CK=["cuts","cut","corte","troquel","die","dieline","die-line","die line"];',
      'var FK=["creases","crease","fold","doblez","plegado","pliegue","score"];',
      'function lo(s){return (s||"").toLowerCase();}',
      'function has(n,ks){var nn=lo(n);for(var i=0;i<ks.length;i++){if(nn.indexOf(ks[i])!==-1)return true;}return false;}',
      'function findL(ks){for(var i=0;i<doc.layers.length;i++){if(has(doc.layers[i].name,ks))return doc.layers[i];}return null;}',
      '',
      '/* Collect paths recursively including groups and compound paths */',
      'function coll(layer,acc){',
      '  var i,j,g,cp;',
      '  for(i=0;i<layer.pathItems.length;i++){var p=layer.pathItems[i];if(!p.guides&&!p.clipping)acc.push(p);}',
      '  for(i=0;i<layer.groupItems.length;i++){g=layer.groupItems[i];',
      '    for(j=0;j<g.pathItems.length;j++){var gp=g.pathItems[j];if(!gp.guides&&!gp.clipping)acc.push(gp);}',
      '    /* recurse into nested groups */',
      '    if(g.groupItems){for(var gi=0;gi<g.groupItems.length;gi++){coll(g.groupItems[gi],acc);}}',
      '  }',
      '  for(i=0;i<layer.compoundPathItems.length;i++){cp=layer.compoundPathItems[i];',
      '    for(j=0;j<cp.pathItems.length;j++){var cpp=cp.pathItems[j];if(!cpp.guides&&!cpp.clipping)acc.push(cpp);}',
      '  }',
      '  for(i=0;i<layer.layers.length;i++) coll(layer.layers[i],acc);',
      '}',
      '',
      'function exBez(path){var pts=[];for(var i=0;i<path.pathPoints.length;i++){var pp=path.pathPoints[i];pts.push({anchor:{x:pp.anchor[0]*PT,y:pp.anchor[1]*PT},left:{x:pp.leftDirection[0]*PT,y:pp.leftDirection[1]*PT},right:{x:pp.rightDirection[0]*PT,y:pp.rightDirection[1]*PT}});}return{closed:path.closed,points:pts};}',
      'function dist(a,b){var dx=(a[0]-b[0])*PT,dy=(a[1]-b[1])*PT;return Math.sqrt(dx*dx+dy*dy);}',
      'function pArea(path){var n=path.pathPoints.length;if(n<3)return 0;var s=0;for(var i=0;i<n;i++){var A=path.pathPoints[i].anchor;var B=path.pathPoints[(i+1)%n].anchor;s+=(A[0]*PT)*(B[1]*PT)-(B[0]*PT)*(A[1]*PT);}return Math.abs(s)*0.5;}',
      'function bbArea(pts){if(!pts||pts.length<2)return 0;var a=1e30,b=1e30,c=-1e30,d=-1e30;for(var i=0;i<pts.length;i++){var p=pts[i].anchor;if(p.x<a)a=p.x;if(p.y<b)b=p.y;if(p.x>c)c=p.x;if(p.y>d)d=p.y;}return(c-a)*(d-b);}',
      '',
      'var cutL=findL(CK); var crL=findL(FK);',
      'if(!cutL) return toJSON({error:"CUT layer not found. Expected: cuts/cut/corte/troquel/die"});',
      '',
      'var cutA=[]; coll(cutL,cutA);',
      'var crA=[]; if(crL) coll(crL,crA);',
      '',
      '/* Classify cut paths */',
      'var closed=[],open=[];',
      'for(var c=0;c<cutA.length;c++){var cp=cutA[c];',
      '  if(cp.closed){closed.push({path:cp,geom:exBez(cp),area:pArea(cp)});continue;}',
      '  var np=cp.pathPoints.length;',
      '  if(np>=2){var gap=dist(cp.pathPoints[0].anchor,cp.pathPoints[np-1].anchor);',
      '    if(gap<=EPS){closed.push({path:cp,geom:exBez(cp),area:pArea(cp)});continue;}}',
      '  open.push({path:cp,geom:exBez(cp)});',
      '}',
      '',
      '/* Pick outer boundary */',
      'var outer=null,holes=[],cutLines=[];',
      'var mca=0,bci=-1;for(var i=0;i<closed.length;i++){if(closed[i].area>mca){mca=closed[i].area;bci=i;}}',
      'var mob=0,boi=-1;for(var j=0;j<open.length;j++){var bb=bbArea(open[j].geom.points);if(bb>mob){mob=bb;boi=j;}}',
      '',
      'if(boi>=0&&mob>mca*2){var best=open[boi];best.geom.closed=true;outer=best.geom;',
      '  for(var oi=0;oi<open.length;oi++){if(oi===boi)continue;cutLines.push({geom:open[oi].geom});}',
      '  for(var ci2=0;ci2<closed.length;ci2++) holes.push(closed[ci2].geom);',
      '}else if(bci>=0){outer=closed[bci].geom;',
      '  for(var ci3=0;ci3<closed.length;ci3++){if(ci3===bci)continue;holes.push(closed[ci3].geom);}',
      '  for(var oi2=0;oi2<open.length;oi2++) cutLines.push({geom:open[oi2].geom});',
      '}else{return toJSON({error:"No CUT boundary found"});}',
      '',
      '/* Collect ALL crease paths (open or closed) */',
      'var creases=[];',
      'for(var k=0;k<crA.length;k++){',
      '  var crPath=crA[k];',
      '  var crGeom=exBez(crPath);',
      '  /* skip tiny closed creases */',
      '  if(crPath.closed){var cLen=0;for(var cl=0;cl<crPath.pathPoints.length-1;cl++){cLen+=dist(crPath.pathPoints[cl].anchor,crPath.pathPoints[cl+1].anchor);}if(cLen<SMALL)continue;}',
      '  creases.push(crGeom);',
      '}',
      '',
      'return toJSON({version:"1.0",units:"mm",thickness_mm:0.25,outerBoundary:outer,holes:holes,cutLines:cutLines,creases:creases,',
      '  meta:{cutLayer:cutL.name,creaseLayer:crL?crL.name:"(none)",closedCutCount:closed.length,openCutCount:open.length,creaseCount:creases.length,totalCutPaths:cutA.length,totalCreasePaths:crA.length}});',
      '}catch(e){return toJSON({error:"Script error: "+e.message+" line:"+e.line});}',
      '})();'
    ].join('\n');

    /* ================================================================
       CEP BRIDGE — clean, no intrusive catch
       ================================================================ */
    function ensureCep(){
      if(!window.__adobe_cep__){
        errorMsg.style.display='block';
        [testBtn,extractBtn,previewBtn,continueBtn,backBtn,export3dBtn].forEach(function(b){b.disabled=true;});
        setStatus('CEP bridge not found.'); return false;
      }
      return true;
    }

    function showImport(){ importView.style.display='block'; threeView.style.display='none'; }
    function show3D()    { importView.style.display='none';  threeView.style.display='block'; }
    function setDebugVisible(on){ if(outputArea) outputArea.style.display = on?'block':'none'; }

    function setActiveTab(key){
      key = key || 'material';
      tabButtons.forEach(function(btn){
        var active = btn.dataset.tab === key;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      tabPanels.forEach(function(panel){
        panel.classList.toggle('active', panel.id === 'tab-' + key);
      });
    }
    function syncMaterialInputs(){ if(thicknessInput) thicknessInput.value=String(currentThicknessMm.toFixed(2)); syncMaterialPresetUI(); }
    function applyMaterialPreset(presetKey, rebuild){
      if(!MATERIAL_PRESETS[presetKey]) presetKey = 'white';
      currentMaterialPreset = presetKey;
      syncMaterialPresetUI();
      if(rebuild && currentPanelData){
        try{
          var built = build3DFromPanels(currentPanelData, lastData);
          if(built){
            buildFoldUI(currentPanelData);
            fitCamera3D();
            setStatus('Material preset applied: '+getMaterialPreset().label);
          }
        }catch(err){
          log('Material preset rebuild error: '+err.message);
          setStatus('Material preset error: '+err.message);
        }
      } else {
        refreshPanelMaterials();
        rebuildCreaseVisuals(buildChildrenOfMap());
      }
    }

    function setArtStatus(message,pill){
      if(artStatus) artStatus.textContent = message;
      if(artSourcePill) artSourcePill.textContent = pill || 'No art';
    }

    function resetValidationUI(){
      problems=[]; problemsList.innerHTML='';
      validationStatus.textContent='Waiting for extraction...';
      validationStatus.className='check-status';
      continueBtn.disabled=true;
    }

    function pathToFileURL(fsPath){
      var path = String(fsPath || '');
      if(!path) return '';
      if(/^file:\/\//i.test(path)) return path;
      path = path.replace(/\\/g,'/');
      if(path.charAt(0)!=='/') path = '/' + path;
      return 'file://' + encodeURI(path);
    }

    function evalScriptJSON(script){
      return new Promise(function(resolve,reject){
        window.__adobe_cep__.evalScript(script,function(result){
          try{
            if(!result || result==='undefined' || result==='null' || result==='EvalScript error.') throw new Error(String(result || 'No result returned'));
            var parsed = JSON.parse(result);
            if(parsed && parsed.error) throw new Error(parsed.error);
            resolve(parsed);
          }catch(err){
            reject(err);
          }
        });
      });
    }

    function buildArtworkExportScript(){
      return [
        '(function(){',
        'var toJSON=(function(){',
        '  function esc(s){ var r="",c; s=String(s||""); for(var i=0;i<s.length;i++){ c=s.charAt(i);',
        '    if(c==String.fromCharCode(92)) r+=String.fromCharCode(92,92);',
        '    else if(c==String.fromCharCode(34)) r+=String.fromCharCode(92,34);',
        '    else if(c==String.fromCharCode(10)) r+=String.fromCharCode(92,110);',
        '    else if(c==String.fromCharCode(13)) r+=String.fromCharCode(92,114);',
        '    else if(c==String.fromCharCode(9)) r+=String.fromCharCode(92,116);',
        '    else r+=c; } return r; }',
        '  function ser(v){',
        '    if(v===null||typeof v==="undefined") return "null";',
        '    if(typeof v==="boolean") return v?"true":"false";',
        '    if(typeof v==="number") return isFinite(v)?String(v):"null";',
        '    if(typeof v==="string") return String.fromCharCode(34)+esc(v)+String.fromCharCode(34);',
        '    if(v instanceof Array){ var a=[]; for(var i=0;i<v.length;i++) a.push(ser(v[i])); return "["+a.join(",")+"]"; }',
        '    if(typeof v==="object"){ var p=[]; for(var k in v){ if(v.hasOwnProperty(k)) p.push(String.fromCharCode(34)+esc(String(k))+String.fromCharCode(34)+":"+ser(v[k])); } return "{"+p.join(",")+"}"; }',
        '    return "null"; }',
        '  return ser; })();',
        'try{',
        '  if(!app.documents.length) return toJSON({error:"No document open"});',
        '  var doc=app.activeDocument;',
        '  var PT=0.352778;',
        '  function lo(s){ return String(s||"").toLowerCase().replace(/^\\s+|\\s+$/g,""); }',
        '  function roleForName(n){ n=lo(n); if(n==="front"||n==="tiro") return "front"; if(n==="back"||n==="retiro") return "back"; return ""; }',
        '  function mmRectFromAB(ab){ var r=ab.artboardRect; var left=r[0]*PT, top=r[1]*PT, right=r[2]*PT, bottom=r[3]*PT; return {left:left, top:top, right:right, bottom:bottom, width:Math.abs(right-left), height:Math.abs(top-bottom)}; }',
        '  function slug(s){ return String(s||"art").replace(/\\.[^\\.]+$/,"").replace(/[^a-zA-Z0-9_\\-]+/g,"_"); }',
        '  var outFolder=new Folder(Folder.temp.fsName+"/tesseract_art"); if(!outFolder.exists) outFolder.create();',
        '  var stamp=(new Date()).getTime();',
        '  var result={ok:true,mode:"none",front:null,back:null,available:{artboards:[],layers:[]},activeArtboardIndex:doc.artboards.getActiveArtboardIndex()};',
        '  function exportActiveArtboardToPNG(label){ var idx=doc.artboards.getActiveArtboardIndex(); var file=new File(outFolder.fsName+"/"+slug(doc.name)+"_"+label+"_"+stamp+".png"); var opt=new ExportOptionsPNG24(); opt.antiAliasing=true; opt.transparency=true; opt.artBoardClipping=true; opt.horizontalScale=100; opt.verticalScale=100; doc.exportFile(file,ExportType.PNG24,opt); return {path:file.fsName, rect:mmRectFromAB(doc.artboards[idx]), label:label}; }',
        '  function exportArtboardByIndex(idx,label){ var prev=doc.artboards.getActiveArtboardIndex(); doc.artboards.setActiveArtboardIndex(idx); var out=exportActiveArtboardToPNG(label); doc.artboards.setActiveArtboardIndex(prev); return out; }',
        '  var artboardFront=null, artboardBack=null;',
        '  for(var ai=0;ai<doc.artboards.length;ai++){ var ab=doc.artboards[ai]; var role=roleForName(ab.name); result.available.artboards.push({name:ab.name,index:ai,role:role}); if(role==="front" && !artboardFront) artboardFront={index:ai,name:ab.name}; if(role==="back" && !artboardBack) artboardBack={index:ai,name:ab.name}; }',
        '  function visitLayers(container,acc){ for(var li=0;li<container.layers.length;li++){ var lyr=container.layers[li]; var role=roleForName(lyr.name); acc.push({layer:lyr,role:role,name:lyr.name}); if(lyr.layers&&lyr.layers.length) visitLayers(lyr,acc); } }',
        '  var layerRefs=[]; visitLayers(doc,layerRefs);',
        '  for(var lr=0;lr<layerRefs.length;lr++){ result.available.layers.push({name:layerRefs[lr].name,role:layerRefs[lr].role}); }',
        '  if(artboardFront||artboardBack){',
        '    result.mode="artboards";',
        '    if(artboardFront) result.front=exportArtboardByIndex(artboardFront.index,"front");',
        '    if(artboardBack) result.back=exportArtboardByIndex(artboardBack.index,"back");',
        '    return toJSON(result);',
        '  }',
        '  function snapVis(container,arr){ for(var i=0;i<container.layers.length;i++){ var lyr=container.layers[i]; arr.push({layer:lyr,visible:lyr.visible}); if(lyr.layers&&lyr.layers.length) snapVis(lyr,arr); } }',
        '  function restoreVis(arr){ for(var i=0;i<arr.length;i++){ try{ arr[i].layer.visible=arr[i].visible; }catch(ex){} } }',
        '  function hideAll(container){ for(var i=0;i<container.layers.length;i++){ var lyr=container.layers[i]; lyr.visible=false; if(lyr.layers&&lyr.layers.length) hideAll(lyr); } }',
        '  function showBranch(layer){ var ptr=layer; while(ptr&&ptr.typename!=="Document"){ try{ ptr.visible=true; }catch(ex){} ptr=ptr.parent; } function showKids(node){ if(!node.layers) return; for(var i=0;i<node.layers.length;i++){ try{ node.layers[i].visible=true; }catch(ex){} showKids(node.layers[i]); } } showKids(layer); }',
        '  function findRoleLayer(role){ for(var i=0;i<layerRefs.length;i++){ if(layerRefs[i].role===role) return layerRefs[i].layer; } return null; }',
        '  var frontLayer=findRoleLayer("front"), backLayer=findRoleLayer("back");',
        '  if(frontLayer||backLayer){',
        '    result.mode="layers";',
        '    var states=[]; snapVis(doc,states);',
        '    try{',
        '      if(frontLayer){ hideAll(doc); showBranch(frontLayer); result.front=exportActiveArtboardToPNG("front"); }',
        '      if(backLayer){ hideAll(doc); showBranch(backLayer); result.back=exportActiveArtboardToPNG("back"); }',
        '    } finally { restoreVis(states); }',
        '  }',
        '  return toJSON(result);',
        '}catch(e){ return toJSON({error:"Artwork export failed: "+e.message+" line:"+e.line}); }',
        '})();'
      ].join('\n');
    }

    function loadTextureFromPath(fsPath){
      return new Promise(function(resolve,reject){
        var loader = new THREE.TextureLoader();
        loader.load(pathToFileURL(fsPath), function(tex){
          tex.flipY = false;
          if('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
          else if('encoding' in tex && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
          tex.needsUpdate = true;
          resolve(tex);
        }, undefined, function(err){
          reject(err || new Error('Texture load failed'));
        });
      });
    }

    function disposeArtOverlays(mesh){
      if(!mesh || !mesh.userData || !mesh.userData.artOverlays) return;
      mesh.userData.artOverlays.forEach(function(ov){
        mesh.remove(ov);
        if(ov.geometry) ov.geometry.dispose();
        if(ov.material) ov.material.dispose();
      });
      mesh.userData.artOverlays = [];
    }

    function applyArtUVs(geometry, artRect, center){
      if(!geometry || !artRect || !artRect.width || !artRect.height) return;
      var pos = geometry.attributes.position;
      var uv = geometry.attributes.uv;
      if(!pos || !uv) return;
      for(var i=0;i<pos.count;i++){
        var x = pos.getX(i) + center.x;
        var y = pos.getY(i) + center.y;
        var u = (x - artRect.left) / artRect.width;
        var v = (artRect.top - y) / artRect.height;
        uv.setXY(i,u,v);
      }
      uv.needsUpdate = true;
    }

    function addArtworkOverlay(mesh, verts, texture, artRect, zOffset){
      if(!mesh || !texture || !artRect) return;
      var shape = shapeFromVerts(verts);
      if(!shape) return;
      var geom = new THREE.ShapeGeometry(shape);
      applyArtUVs(geom, artRect, foldData ? foldData.center : {x:0,y:0});
      var mat = new THREE.MeshBasicMaterial({
        map:texture, transparent:true, side:THREE.DoubleSide,
        depthWrite:false, depthTest:true
      });
      var overlay = new THREE.Mesh(geom, mat);
      overlay.position.z = zOffset;
      overlay.renderOrder = 60;
      mesh.add(overlay);
      if(!mesh.userData.artOverlays) mesh.userData.artOverlays = [];
      mesh.userData.artOverlays.push(overlay);
    }

    function applyArtworkToScene(){
      panelMeshes.forEach(function(mesh){
        disposeArtOverlays(mesh);
        if(!currentArtState) return;
        if(currentArtState.front && currentArtState.front.texture && currentArtState.front.rect){
          addArtworkOverlay(mesh, mesh.userData.originalVertices, currentArtState.front.texture, currentArtState.front.rect, currentThicknessMm + ART_TOP_OFFSET);
        }
        if(currentArtState.back && currentArtState.back.texture && currentArtState.back.rect){
          addArtworkOverlay(mesh, mesh.userData.originalVertices, currentArtState.back.texture, currentArtState.back.rect, -ART_BOTTOM_OFFSET);
        }
      });
      refreshPanelMaterials();
    }

    function disposeCurrentArtTextures(){
      if(!currentArtState) return;
      ['front','back'].forEach(function(side){
        if(currentArtState[side] && currentArtState[side].texture){
          try{ currentArtState[side].texture.dispose(); }catch(ex){}
        }
      });
    }

    async function refreshArtwork(){
      if(!ensureCep()) return;
      if(!panelMeshes.length){
        setArtStatus('Build 3D first, then refresh art.','No art');
        return;
      }
      try{
        setArtStatus('Searching Front/Back or Tiro/Retiro…','Scanning');
        var exported = await evalScriptJSON(buildArtworkExportScript());
        if(!exported || exported.mode==='none' || (!exported.front && !exported.back)){
          disposeCurrentArtTextures();
          currentArtState = null;
          applyArtworkToScene();
          setArtStatus('No Front/Back or Tiro/Retiro art detected.','No art');
          return;
        }
        var nextState = { mode: exported.mode, front: null, back: null };
        if(exported.front && exported.front.path){
          nextState.front = { rect: exported.front.rect, texture: await loadTextureFromPath(exported.front.path), path: exported.front.path };
        }
        if(exported.back && exported.back.path){
          nextState.back = { rect: exported.back.rect, texture: await loadTextureFromPath(exported.back.path), path: exported.back.path };
        }
        disposeCurrentArtTextures();
        currentArtState = nextState;
        applyArtworkToScene();
        setArtStatus('Artwork loaded from '+exported.mode+'. Mapping uses full artboard coordinates.', exported.mode==='artboards' ? 'Artboards' : 'Layers');
      }catch(err){
        setArtStatus('Artwork load failed: '+err.message, 'Art error');
        log('Artwork load failed: '+err.message);
      }
    }

    /* ================================================================
       GEOMETRY UTILS
       ================================================================ */
    function distPtSeg(p,a,b){
      var l2=(b.x-a.x)*(b.x-a.x)+(b.y-a.y)*(b.y-a.y);
      if(l2===0) return Math.hypot(p.x-a.x,p.y-a.y);
      var t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2;
      t=Math.max(0,Math.min(1,t));
      return Math.hypot(p.x-(a.x+t*(b.x-a.x)), p.y-(a.y+t*(b.y-a.y)));
    }

    function segsFromPath(pathObj,closed,type,meta){
      var s=[];
      if(!pathObj||!pathObj.points||pathObj.points.length<2) return s;
      var pts=pathObj.points.map(function(p){return p.anchor;});
      for(var i=0;i<pts.length-1;i++) s.push({a:pts[i],b:pts[i+1],type:type,meta:meta});
      if(closed) s.push({a:pts[pts.length-1],b:pts[0],type:type,meta:meta});
      return s;
    }

    function buildAllSegs(data){
      var s=[];
      s.push.apply(s, segsFromPath(data.outerBoundary,true,'outer',null));
      (data.holes||[]).forEach(function(h,i){ s.push.apply(s, segsFromPath(h,true,'hole',{i:i})); });
      (data.cutLines||[]).forEach(function(cl,i){ s.push.apply(s, segsFromPath(cl.geom,false,'cutLine',{i:i})); });
      (data.creases||[]).forEach(function(cr,i){ s.push.apply(s, segsFromPath(cr,false,'crease',{i:i})); });
      return s;
    }

    function validateGeometry(data){
      problems=[]; problemsList.innerHTML='';
      if(!data||data.error){ validationStatus.textContent='Waiting...'; validationStatus.className='check-status'; continueBtn.disabled=true; return; }
      var allS=buildAllSegs(data);
      (data.creases||[]).forEach(function(cr,ci){
        if(!cr.points||cr.points.length<2) return;
        [cr.points[0].anchor, cr.points[cr.points.length-1].anchor].forEach(function(ep){
          var best=Infinity;
          for(var i=0;i<allS.length;i++){
            var sg=allS[i]; if(sg.type==='crease'&&sg.meta&&sg.meta.i===ci) continue;
            var d=distPtSeg(ep,sg.a,sg.b); if(d<best) best=d;
          }
          if(best>TOLERANCE_MM) problems.push({id:'P'+(problems.length+1),type:'Crease endpoint unconnected',dist:Number(best.toFixed(2)),point:ep});
        });
      });
      if(problems.length===0){
        validationStatus.textContent='\u2705 No problems found';
        validationStatus.className='check-status status-ok';
        continueBtn.disabled=false;
      } else {
        validationStatus.textContent='\u26a0\ufe0f '+problems.length+' potential problem(s)';
        validationStatus.className='check-status status-warning';
        continueBtn.disabled=false;
        problems.forEach(function(p){
          var li=document.createElement('li');
          li.textContent=p.id+': '+p.type+' ('+p.dist+'mm)';
          li.onclick=function(){render2D(lastData,p.id);};
          problemsList.appendChild(li);
        });
      }
    }

    /* ================================================================
       2D PREVIEW
       ================================================================ */
    function render2D(data,hlId){
      if(!data||data.error) return;
      canvas2d.style.display='block';
      ctx2d.clearRect(0,0,canvas2d.width,canvas2d.height);
      var mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
      function con(pt){if(!pt)return;mnx=Math.min(mnx,pt.x);mny=Math.min(mny,pt.y);mxx=Math.max(mxx,pt.x);mxy=Math.max(mxy,pt.y);}
      function conP(po){if(!po||!po.points)return;po.points.forEach(function(p){con(p.anchor);});}
      conP(data.outerBoundary);
      (data.holes||[]).forEach(conP);
      (data.creases||[]).forEach(conP);
      (data.cutLines||[]).forEach(function(cl){conP(cl.geom);});
      if(!isFinite(mnx)) return;
      var w=(mxx-mnx)||1,h=(mxy-mny)||1,pad=24,dw=canvas2d.width-pad*2,dh=canvas2d.height-pad*2;
      var sc=Math.min(dw/w,dh/h), ox=pad+(dw-w*sc)/2, oy=pad+(dh-h*sc)/2;
      function tr(x,y){return{x:ox+(x-mnx)*sc, y:canvas2d.height-(oy+(y-mny)*sc)};}
      function draw(po,col,dash,lw){
        if(!po||!po.points||po.points.length<2)return;
        ctx2d.beginPath();ctx2d.strokeStyle=col;ctx2d.lineWidth=lw||1.2;ctx2d.setLineDash(dash?[5,5]:[]);
        var s=tr(po.points[0].anchor.x,po.points[0].anchor.y);ctx2d.moveTo(s.x,s.y);
        for(var i=1;i<po.points.length;i++){var p=tr(po.points[i].anchor.x,po.points[i].anchor.y);ctx2d.lineTo(p.x,p.y);}
        if(po.closed)ctx2d.closePath();ctx2d.stroke();ctx2d.setLineDash([]);
      }
      draw(data.outerBoundary,'#4488ff',false,1.8);
      (data.holes||[]).forEach(function(h){draw(h,'#4488ff',true,1);});
      (data.cutLines||[]).forEach(function(cl){draw(cl.geom,'#4488ff',true,1);});
      (data.creases||[]).forEach(function(cr){draw(cr,'#ff4444',false,1.2);});
      problems.forEach(function(p){
        var pt=tr(p.point.x,p.point.y);
        ctx2d.beginPath();ctx2d.arc(pt.x,pt.y,hlId===p.id?8:5,0,Math.PI*2);
        ctx2d.strokeStyle=hlId===p.id?'#ffffff':'#f0a000';ctx2d.lineWidth=2;ctx2d.stroke();
        ctx2d.fillStyle='#f0a000';ctx2d.font='10px sans-serif';ctx2d.fillText(p.id,pt.x+8,pt.y-8);
      });
    }

    /* ================================================================
       PLANAR GRAPH TOPOLOGY ENGINE
       ================================================================ */
    function dist2d(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
    function ptEq(a,b){ return dist2d(a,b) < GRAPH_EPS; }

    function segSegIntersect(a1,a2,b1,b2){
      var det=(a2.x-a1.x)*(b2.y-b1.y)-(b2.x-b1.x)*(a2.y-a1.y);
      if(Math.abs(det)<1e-9) return null;
      var lam=((b2.y-b1.y)*(b2.x-a1.x)+(b1.x-b2.x)*(b2.y-a1.y))/det;
      var gam=((a1.y-a2.y)*(b2.x-a1.x)+(a2.x-a1.x)*(b2.y-a1.y))/det;
      if(lam>1e-6 && lam<1-1e-6 && gam>1e-6 && gam<1-1e-6){
        return {x:a1.x+lam*(a2.x-a1.x), y:a1.y+lam*(a2.y-a1.y)};
      }
      return null;
    }

    function pointOnSeg(pt,a,b){
      var d1=dist2d(pt,a), d2=dist2d(pt,b), len=dist2d(a,b);
      return d1>GRAPH_EPS && d2>GRAPH_EPS && Math.abs(d1+d2-len)<GRAPH_EPS;
    }

    function buildTopology(segments){
      log('buildTopology: '+segments.length+' input segments');
      /* Split segments at intersections */
      var dirty=true, iter=0, maxIter=segments.length*segments.length+500;
      while(dirty && iter<maxIter){
        dirty=false; iter++;
        for(var i=0;i<segments.length&&!dirty;i++){
          for(var j=i+1;j<segments.length&&!dirty;j++){
            var s1=segments[i], s2=segments[j];
            var inter=segSegIntersect(s1.p1,s1.p2,s2.p1,s2.p2);
            if(inter){
              segments.splice(j,1); segments.splice(i,1);
              segments.push({p1:s1.p1,p2:inter,type:s1.type},{p1:inter,p2:s1.p2,type:s1.type},
                            {p1:s2.p1,p2:inter,type:s2.type},{p1:inter,p2:s2.p2,type:s2.type});
              dirty=true;
            }
            if(!dirty && pointOnSeg(s2.p1,s1.p1,s1.p2)){
              segments.splice(i,1);
              segments.push({p1:s1.p1,p2:s2.p1,type:s1.type},{p1:s2.p1,p2:s1.p2,type:s1.type});
              dirty=true;
            }
            if(!dirty && pointOnSeg(s2.p2,s1.p1,s1.p2)){
              segments.splice(i,1);
              segments.push({p1:s1.p1,p2:s2.p2,type:s1.type},{p1:s2.p2,p2:s1.p2,type:s1.type});
              dirty=true;
            }
            if(!dirty && pointOnSeg(s1.p1,s2.p1,s2.p2)){
              segments.splice(j,1);
              segments.push({p1:s2.p1,p2:s1.p1,type:s2.type},{p1:s1.p1,p2:s2.p2,type:s2.type});
              dirty=true;
            }
            if(!dirty && pointOnSeg(s1.p2,s2.p1,s2.p2)){
              segments.splice(j,1);
              segments.push({p1:s2.p1,p2:s1.p2,type:s2.type},{p1:s1.p2,p2:s2.p2,type:s2.type});
              dirty=true;
            }
          }
        }
      }
      log('After splitting: '+segments.length+' segments ('+iter+' iterations)');

      /* Build adjacency graph */
      var verts=[];
      function getVid(p){
        for(var i=0;i<verts.length;i++){ if(ptEq(verts[i],p)) return i; }
        verts.push({x:p.x,y:p.y}); return verts.length-1;
      }

      var adj={};
      segments.forEach(function(seg){
        if(ptEq(seg.p1,seg.p2)) return;
        var u=getVid(seg.p1), v=getVid(seg.p2);
        if(u===v) return;
        if(!adj[u]) adj[u]=[];
        if(!adj[v]) adj[v]=[];
        var angUV=Math.atan2(verts[v].y-verts[u].y, verts[v].x-verts[u].x);
        var angVU=Math.atan2(verts[u].y-verts[v].y, verts[u].x-verts[v].x);
        if(!adj[u].find(function(e){return e.to===v;}))
          adj[u].push({to:v, type:seg.type, angle:angUV, visited:false});
        if(!adj[v].find(function(e){return e.to===u;}))
          adj[v].push({to:u, type:seg.type, angle:angVU, visited:false});
      });

      Object.keys(adj).forEach(function(k){
        adj[k].sort(function(a,b){return a.angle-b.angle;});
      });

      log('Graph: '+verts.length+' vertices, '+Object.keys(adj).length+' adj entries');

      /* Trace minimal faces using planar face traversal */
      var faces=[];
      Object.keys(adj).forEach(function(uStr){
        var u=parseInt(uStr);
        adj[u].forEach(function(startEdge){
          if(startEdge.visited) return;
          var path=[], curr=startEdge, currU=u, cycleFound=false;
          var safety=0, maxSafety=verts.length*4+100;
          while(!curr.visited && safety<maxSafety){
            safety++; curr.visited=true;
            path.push({u:currU, v:curr.to, type:curr.type});
            var vId=curr.to, outgoing=adj[vId];
            if(!outgoing||outgoing.length===0) break;
            var backIdx=-1;
            for(var bi=0;bi<outgoing.length;bi++){ if(outgoing[bi].to===currU){backIdx=bi;break;} }
            if(backIdx===-1) break;
            var nextIdx=(backIdx-1+outgoing.length)%outgoing.length;
            currU=vId; curr=outgoing[nextIdx];
            if(currU===u && curr===startEdge){ cycleFound=true; break; }
          }
          if(cycleFound && path.length>=3){
            var area=0, polyPts=path.map(function(e){return verts[e.u];});
            for(var i=0;i<polyPts.length;i++){
              var p1=polyPts[i], p2=polyPts[(i+1)%polyPts.length];
              area+=(p1.x*p2.y - p2.x*p1.y);
            }
            area/=2;
            var hasCrease=path.some(function(e){return e.type==='crease';});
            faces.push({
              vertices: polyPts.map(function(v){return{x:v.x,y:v.y};}),
              edges: path.map(function(e){ return {u:{x:verts[e.u].x,y:verts[e.u].y}, v:{x:verts[e.v].x,y:verts[e.v].y}, type:e.type}; }),
              area: area, isHole: area<0, hasCreaseEdge: hasCrease
            });
          }
        });
      });

      log('Faces traced: '+faces.length);
      faces.forEach(function(f,i){ log('  Face '+i+': area='+f.area.toFixed(1)+' verts='+f.vertices.length+' hole='+f.isHole); });
      return {faces:faces, verts:verts, adj:adj};
    }

    /* ================================================================
       3D ENGINE
       ================================================================ */
    var renderer3d=null, scene3d=null, camera3d=null;
    var orbitState=null;
    var panelMeshes=[];
    var creaseLinesGroup=null;
    var foldBridgeGroup=null;
    var foldData=null;
    var foldRoot=null;
    var foldAngles=[];
    var foldTree=[];
    var foldCenter={x:0,y:0};
    var raycaster3d = null;
    var pointer3d = null;

    function resize3D(){
      if(!renderer3d||!camera3d) return;
      var w=canvas3d.clientWidth||canvas3d.width;
      var h=canvas3d.clientHeight||canvas3d.height;
      var iw=Math.max(1,Math.floor(w));
      var ih=Math.max(1,Math.floor(h));
      if(canvas3d.width!==iw||canvas3d.height!==ih){
        canvas3d.width=iw; canvas3d.height=ih;
        renderer3d.setSize(iw,ih,false);
        camera3d.aspect=iw/ih;
        camera3d.updateProjectionMatrix();
      }
    }

    function updateCameraFromOrbit(){
      if(!orbitState) return;
      orbitState.spherical.makeSafe();
      var pos=new THREE.Vector3().setFromSpherical(orbitState.spherical).add(orbitState.target);
      camera3d.position.copy(pos);
      camera3d.lookAt(orbitState.target);
    }

    function init3D(){
      if(renderer3d) return true;
      if(!window.THREE||!THREE.WebGLRenderer){
        setStatus('Error: Three.js not loaded'); return false;
      }

      renderer3d=new THREE.WebGLRenderer({canvas:canvas3d,antialias:true,alpha:false,preserveDrawingBuffer:true});
      renderer3d.setClearColor(0xffffff,1);
      renderer3d.setPixelRatio(window.devicePixelRatio||1);
      log('Renderer created OK');

      scene3d=new THREE.Scene();
      camera3d=new THREE.PerspectiveCamera(45,1,0.01,100000);
      raycaster3d = new THREE.Raycaster();
      pointer3d = new THREE.Vector2();

      /* Lighting */
      scene3d.add(new THREE.AmbientLight(0xffffff,0.6));
      var dir=new THREE.DirectionalLight(0xffffff,0.8);
      dir.position.set(400,300,700); scene3d.add(dir);
      scene3d.add(new THREE.HemisphereLight(0xffffff,0xf3f4f6,0.65));

      /* Grid — light gray on dark bg */
      var grid=new THREE.GridHelper(1200,60,0xd1d5db,0xe5e7eb);
      grid.material.opacity=0.4; grid.material.transparent=true;
      scene3d.add(grid);

      /* Small axes in corner */
      var axes=new THREE.AxesHelper(80);
      axes.position.set(-550,0,-550);
      scene3d.add(axes);

      /* ── Transparent overlay for orbit/pan/zoom (CEP-safe) ── */
      var ov=document.createElement('div');
      ov.id='three-overlay';
      ov.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;cursor:grab;touch-action:none;';
      viewport3d.style.position='relative';
      viewport3d.appendChild(ov);

      var drag={active:false,btn:-1,x:0,y:0,moved:false};

      function onDown(e){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        drag.active=true;drag.btn=e.button;drag.x=e.clientX;drag.y=e.clientY;drag.moved=false;
        ov.style.cursor='grabbing';
        if(ov.setPointerCapture&&e.pointerId!==undefined) try{ov.setPointerCapture(e.pointerId);}catch(ex){}
      }
      function onUp(e){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        var wasActive=drag.active;
        var wasBtn=drag.btn;
        var wasMoved=drag.moved;
        drag.active=false;drag.btn=-1;ov.style.cursor='grab';
        if(ov.releasePointerCapture&&e.pointerId!==undefined) try{ov.releasePointerCapture(e.pointerId);}catch(ex){}
        if(wasActive && !wasMoved && wasBtn===0){
          try{
            if(e.shiftKey){
              if(pickPanelFromEvent(e)) return;
            } else if(e.altKey){
              if(pickCreaseFromEvent(e)) return;
            }
          }catch(ex){ log('Pick error: '+ex.message); }
        }
      }
      function onMove(e){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        if(!drag.active||!orbitState) return;
        var dx=e.clientX-drag.x, dy=e.clientY-drag.y;
        if(Math.abs(dx)>5||Math.abs(dy)>5) drag.moved=true;
        drag.x=e.clientX; drag.y=e.clientY;
        if(drag.btn===2||(drag.btn===0&&e.shiftKey)){
          /* Pan */
          var te=camera3d.matrix.elements;
          var right=new THREE.Vector3(te[0],te[1],te[2]).normalize();
          var up=new THREE.Vector3(te[4],te[5],te[6]).normalize();
          var pan=right.multiplyScalar(-dx*orbitState.panSpeed).add(up.multiplyScalar(dy*orbitState.panSpeed));
          orbitState.target.add(pan);
        } else if(drag.btn===0){
          /* Orbit */
          orbitState.spherical.theta-=dx*orbitState.rotateSpeed;
          orbitState.spherical.phi-=dy*orbitState.rotateSpeed;
        }
        updateCameraFromOrbit();
      }
      function onWheel(e){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        if(!orbitState) return;
        var delta=(e.deltaY>0)?1.08:0.92;
        orbitState.spherical.radius*=delta;
        orbitState.spherical.radius=Math.max(20,Math.min(orbitState.spherical.radius,50000));
        updateCameraFromOrbit();
      }

      /* Bind both pointer and mouse events for max CEP compatibility */
      ov.addEventListener('pointerdown',onDown,{capture:true,passive:false});
      ov.addEventListener('pointermove',onMove,{capture:true,passive:false});
      ov.addEventListener('pointerup',onUp,{capture:true,passive:false});
      ov.addEventListener('mousedown',onDown,{capture:true,passive:false});
      ov.addEventListener('mousemove',onMove,{capture:true,passive:false});
      ov.addEventListener('mouseup',onUp,{capture:true,passive:false});
      ov.addEventListener('wheel',onWheel,{capture:true,passive:false});
      ov.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();},{capture:true});

      viewport3d._overlay=ov;
      log('Overlay controls attached');

      /* Render loop */
      var firstFrame=false;
      function loop(){
        requestAnimationFrame(loop);
        resize3D();
        if(orbitState) camera3d.lookAt(orbitState.target);
        renderer3d.render(scene3d,camera3d);
        if(!firstFrame){firstFrame=true;log('First frame rendered');}
      }
      loop();
      window.addEventListener('resize',resize3D);
      resize3D();
      return true;
    }

    function clearAllMeshes(){
      panelMeshes.forEach(function(m){
        if(m.parent) m.parent.remove(m);
        else if(scene3d) scene3d.remove(m);
        if(m.geometry) m.geometry.dispose();
        if(m.material) m.material.dispose();
      });
      panelMeshes=[];
      if(creaseLinesGroup){
        if(creaseLinesGroup.parent) creaseLinesGroup.parent.remove(creaseLinesGroup);
        else if(scene3d) scene3d.remove(creaseLinesGroup);
        creaseLinesGroup=null;
      }
      if(foldBridgeGroup){
        if(foldBridgeGroup.parent) foldBridgeGroup.parent.remove(foldBridgeGroup);
        disposeObject3D(foldBridgeGroup);
        foldBridgeGroup=null;
      }
      creasePickables = [];
      creaseVisuals = [];
      panelGroupMap = [];
      panelLabelSprites = [];
      if(foldRoot){
        if(foldRoot.parent) foldRoot.parent.remove(foldRoot);
        foldRoot=null;
      }
    }

    /* ================================================================
       BUILD PANELS FROM TOPOLOGY
       ================================================================ */
    function shapeFromVerts(verts2d){
      if(verts2d.length<3) return null;
      var s=new THREE.Shape();
      s.moveTo(verts2d[0].x,verts2d[0].y);
      for(var i=1;i<verts2d.length;i++) s.lineTo(verts2d[i].x,verts2d[i].y);
      s.closePath();
      return s;
    }

    function polygonSignedArea(verts){
      var area=0;
      for(var i=0;i<verts.length;i++){
        var a=verts[i], b=verts[(i+1)%verts.length];
        area += a.x*b.y - b.x*a.y;
      }
      return area/2;
    }

    function polygonCentroid(verts){
      var a = polygonSignedArea(verts);
      if(Math.abs(a) < 1e-9){
        var cx=0, cy=0;
        verts.forEach(function(v){ cx+=v.x; cy+=v.y; });
        return {x:cx/verts.length, y:cy/verts.length};
      }
      var cx2=0, cy2=0;
      for(var i=0;i<verts.length;i++){
        var p=verts[i], q=verts[(i+1)%verts.length];
        var cross = p.x*q.y - q.x*p.y;
        cx2 += (p.x + q.x) * cross;
        cy2 += (p.y + q.y) * cross;
      }
      return {x:cx2/(6*a), y:cy2/(6*a)};
    }

    function pointOnSegment2D(pt,a,b){
      return distPtSeg(pt,a,b) <= GRAPH_EPS;
    }

    function pointInPolygonInclusive(pt, verts){
      if(!verts || verts.length < 3) return false;
      for(var i=0;i<verts.length;i++){
        if(pointOnSegment2D(pt, verts[i], verts[(i+1)%verts.length])) return true;
      }
      var inside=false;
      for(var j=0,k=verts.length-1;j<verts.length;k=j++){
        var xi=verts[j].x, yi=verts[j].y;
        var xk=verts[k].x, yk=verts[k].y;
        var intersect=((yi>pt.y)!=(yk>pt.y)) &&
          (pt.x < (xk-xi)*(pt.y-yi)/((yk-yi)||1e-9) + xi);
        if(intersect) inside=!inside;
      }
      return inside;
    }

    function contourContainsContour(outer, inner){
      if(!outer || !inner || !outer.points || !inner.points) return false;
      for(var i=0;i<inner.points.length;i++){
        if(!pointInPolygonInclusive(inner.points[i], outer.points)) return false;
      }
      return true;
    }

    function classifyClosedCutContours(data){
      var contours=[];
      function addContour(pathObj, sourceName){
        if(!pathObj || !pathObj.points || pathObj.points.length < 3) return;
        var pts = pathObj.points.map(function(p){ return {x:p.anchor.x, y:p.anchor.y}; });
        contours.push({source:sourceName, points:pts, area:polygonSignedArea(pts)});
      }
      addContour(data.outerBoundary, 'outerBoundary');
      (data.holes||[]).forEach(function(h, i){ addContour(h, 'closedCut_'+i); });

      contours.forEach(function(c, idx){
        c.idx = idx;
        c.absArea = Math.abs(c.area);
        c.centroid = polygonCentroid(c.points);
        c.parentCount = 0;
      });

      contours.forEach(function(c, idx){
        contours.forEach(function(other, jdx){
          if(idx===jdx) return;
          if(other.absArea <= c.absArea) return;
          if(contourContainsContour(other, c)) c.parentCount += 1;
        });
      });

      var shells = contours.filter(function(c){ return c.parentCount % 2 === 0; });
      var holes = contours.filter(function(c){ return c.parentCount % 2 === 1; });
      log('Closed cut contours reclassified · shells='+shells.length+' holes='+holes.length+' total='+contours.length);
      return {all:contours, shells:shells, holes:holes};
    }

    function faceBounds(verts){
      var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      verts.forEach(function(v){
        minX=Math.min(minX,v.x); minY=Math.min(minY,v.y);
        maxX=Math.max(maxX,v.x); maxY=Math.max(maxY,v.y);
      });
      return {minX:minX,minY:minY,maxX:maxX,maxY:maxY,w:maxX-minX,h:maxY-minY};
    }

    function buildPanels(data){
      log('=== buildPanels ===');
      var contourInfo = classifyClosedCutContours(data);

      /* Convert CLOSED cut contours + creases into topology segments.
         Open cut lines stay as visual overlays for now so they do not become fake panels. */
      var topoSegs=[];
      function addPath(pathObj,closed,type){
        if(!pathObj||!pathObj.points||pathObj.points.length<2) return;
        var pts=pathObj.points.map(function(p){return p.anchor;});
        for(var i=0;i<pts.length-1;i++){
          topoSegs.push({p1:{x:pts[i].x,y:pts[i].y},p2:{x:pts[i+1].x,y:pts[i+1].y},type:type});
        }
        if(closed) topoSegs.push({p1:{x:pts[pts.length-1].x,y:pts[pts.length-1].y},p2:{x:pts[0].x,y:pts[0].y},type:type});
      }

      contourInfo.all.forEach(function(c){
        addPath({points:c.points.map(function(pt){ return {anchor:pt}; })}, true, 'boundary');
      });
      (data.creases||[]).forEach(function(cr){ addPath(cr,false,'crease'); });

      log('Total topo segments (closed cuts + creases): '+topoSegs.length);

      var topo=buildTopology(topoSegs);
      var faces=topo.faces;
      var seenKeys={};
      var panels=[];

      faces.forEach(function(f){
        if(Math.abs(f.area) <= 1) return;
        var verts = f.vertices.slice();
        var signedArea = polygonSignedArea(verts);
        if(signedArea < 0) verts.reverse();
        var centroid = polygonCentroid(verts);
        var insideShell = contourInfo.shells.some(function(shell){ return pointInPolygonInclusive(centroid, shell.points); });
        var insideHole = contourInfo.holes.some(function(hole){ return pointInPolygonInclusive(centroid, hole.points); });
        if(!insideShell || insideHole) return;
        var b = faceBounds(verts);
        var minDim = Math.max(0.0001, Math.min(b.w, b.h));
        var maxDim = Math.max(b.w, b.h);
        var aspect = maxDim / minDim;
        var absArea = Math.abs(signedArea);
        if(absArea < 4) return;
        if(aspect > 30 && absArea < 120) return;
        var ckey = centroid.x.toFixed(2)+'|'+centroid.y.toFixed(2)+'|'+absArea.toFixed(2);
        if(seenKeys[ckey]) return;
        seenKeys[ckey] = true;
        panels.push({
          vertices: verts,
          edges: f.edges,
          area: absArea,
          centroid: centroid
        });
      });

      log('Panels after shell filter: '+panels.length);

      /* Find creases that are shared edges between panels */
      var creaseEdges=[];
      (data.creases||[]).forEach(function(cr,ci){
        if(!cr || !cr.points || cr.points.length < 2) return;
        var pts=cr.points.map(function(p){return p.anchor;});
        for(var i=0;i<pts.length-1;i++){
          creaseEdges.push({a:pts[i],b:pts[i+1],creaseIdx:ci,segIdx:i});
        }
      });

      /* Connectivity filter:
         keep the largest crease-connected component and drop isolated false islands. */
      if(panels.length > 1 && creaseEdges.length > 0){
        var adjEdges = buildAdjacencyStrict(panels, creaseEdges);
        var graph = [];
        var creaseTouch = [];
        for(var gi=0; gi<panels.length; gi++){
          graph[gi] = [];
          creaseTouch[gi] = 0;
        }
        adjEdges.forEach(function(ae){
          graph[ae.panelA].push(ae.panelB);
          graph[ae.panelB].push(ae.panelA);
          creaseTouch[ae.panelA] += 1;
          creaseTouch[ae.panelB] += 1;
        });

        var visited = {};
        var comps = [];
        for(var pi=0; pi<panels.length; pi++){
          if(visited[pi] || creaseTouch[pi] === 0) continue;
          var q = [pi];
          visited[pi] = true;
          var nodes = [];
          var areaSum = 0;
          while(q.length){
            var cur = q.shift();
            nodes.push(cur);
            areaSum += Math.abs(panels[cur].area || 0);
            for(var ni=0; ni<graph[cur].length; ni++){
              var nxt = graph[cur][ni];
              if(visited[nxt]) continue;
              visited[nxt] = true;
              q.push(nxt);
            }
          }
          comps.push({nodes:nodes, areaSum:areaSum});
        }

        if(comps.length > 0){
          comps.sort(function(a,b){
            if(Math.abs(b.areaSum - a.areaSum) > 0.001) return b.areaSum - a.areaSum;
            return b.nodes.length - a.nodes.length;
          });
          var keepMap = {};
          comps[0].nodes.forEach(function(idx){ keepMap[idx] = true; });
          var kept = [];
          panels.forEach(function(panel, idx){ if(keepMap[idx]) kept.push(panel); });
          log('Connectivity filter: keeping '+kept.length+' of '+panels.length+' panels from largest crease-connected component');
          panels = kept;
        } else {
          log('Connectivity filter: no crease-connected components found, keeping shell-filtered panels');
        }
      }

      return {panels:panels, creaseEdges:creaseEdges, creases:data.creases||[]};
    }

    function build3DFromPanels(panelData,data){
      clearAllMeshes();
      var panels=panelData.panels;
      var creaseEdges=panelData.creaseEdges;

      /* Compute global center */
      var allPts=[];
      panels.forEach(function(p){p.vertices.forEach(function(v){allPts.push(v);});});
      var cx=0,cy=0;
      allPts.forEach(function(p){cx+=p.x;cy+=p.y;});
      if(allPts.length>0){cx/=allPts.length;cy/=allPts.length;}

      /* Create mesh for each panel */
      panels.forEach(function(panel,pi){
        var centered=panel.vertices.map(function(v){return{x:v.x-cx,y:v.y-cy};});
        var shape=shapeFromVerts(centered);
        if(!shape) return;
        var geom=new THREE.ExtrudeGeometry(shape,{depth:currentThicknessMm,bevelEnabled:false,curveSegments:1,steps:1});
        geom.computeVertexNormals();

        var shellMat=new THREE.MeshPhongMaterial({
          color:new THREE.Color(getPanelShellHex(pi===currentBasePanelIndex)), specular:0x1b1b1b, shininess:10,
          side:THREE.DoubleSide
        });
        var mesh=new THREE.Mesh(geom,shellMat);

        /* Add board edges */
        var edges=new THREE.EdgesGeometry(geom,1);
        var lineMat=new THREE.LineBasicMaterial({color:new THREE.Color(getEdgeLineHex()),transparent:true,opacity:0.72});
        var edgeLines = new THREE.LineSegments(edges,lineMat);
        mesh.add(edgeLines);

        /* rotation handled by foldRoot group */
        mesh.position.z=0;

        /* Store panel data for folding */
        mesh.userData={
          panelIndex:pi,
          originalVertices:centered,
          center:getPolyCentroid(centered),
          creaseEdges:[],
          edgeLines:edgeLines
        };

        scene3d.add(mesh);
        panelMeshes.push(mesh);
      });

      /* Fold line visuals are built after the fold tree is established. */

      /* Store fold data */
      foldData={
        panels:panels,
        creaseEdges:creaseEdges,
        creases:panelData.creases,
        center:{x:cx,y:cy}
      };

      applyArtworkToScene();
      log('Built '+panelMeshes.length+' panel meshes, '+creaseEdges.length+' crease edge segments');
      return panelMeshes.length;
    }

    function refreshPanelMaterials(){
      panelMeshes.forEach(function(mesh){
        if(!mesh || !mesh.material) return;
        var isBase = mesh.userData && mesh.userData.panelIndex===currentBasePanelIndex;
        mesh.material.color.set(getPanelShellHex(isBase));
        mesh.material.needsUpdate = true;
        if(mesh.userData && mesh.userData.edgeLines && mesh.userData.edgeLines.material){
          mesh.userData.edgeLines.material.color.set(getEdgeLineHex());
          mesh.userData.edgeLines.material.needsUpdate = true;
        }
      });
    }

    function pickPanelFromEvent(e){
      if(!renderer3d || !camera3d || !raycaster3d || !pointer3d || !panelMeshes.length) return false;
      var rect = canvas3d.getBoundingClientRect();
      if(!rect.width || !rect.height) return false;
      pointer3d.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer3d.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster3d.setFromCamera(pointer3d, camera3d);
      var hits = raycaster3d.intersectObjects(panelMeshes, false);
      if(!hits || !hits.length) return false;
      var panelIdx = hits[0].object && hits[0].object.userData ? hits[0].object.userData.panelIndex : null;
      if(panelIdx===null || panelIdx===undefined) return false;
      setBasePanel(panelIdx, true, true);
      setActiveTab('material');
    setInteractionMode('fold', false);
      setStatus('Base set to P'+panelIdx+' · Shift + click another panel to change it');
      return true;
    }

    function fitCamera3D(){
      if(panelMeshes.length===0) return;
      if(scene3d) scene3d.updateMatrixWorld(true);
      var box=new THREE.Box3();
      if(foldRoot) box.expandByObject(foldRoot);
      else panelMeshes.forEach(function(m){box.expandByObject(m);});
      var size=new THREE.Vector3(); box.getSize(size);
      var center=new THREE.Vector3(); box.getCenter(center);
      var maxDim=Math.max(size.x,size.y,size.z)||1;
      var dist=Math.max(maxDim*1.8,180);

      orbitState={
        target:center.clone(),
        spherical:new THREE.Spherical(dist,Math.PI/3,Math.PI/4),
        panSpeed:maxDim/600,
        rotateSpeed:0.006
      };
      updateCameraFromOrbit();
      camera3d.near=Math.max(0.01,dist/2000);
      camera3d.far=dist*200;
      camera3d.updateProjectionMatrix();
    }

    /* ================================================================
       ADJACENCY + FOLD TREE
       ================================================================ */
    function getPolyCentroid(verts){
      var cx=0,cy=0;
      verts.forEach(function(v){cx+=v.x;cy+=v.y;});
      return {x:cx/verts.length, y:cy/verts.length};
    }

    function edgeMatch(a1,a2,b1,b2){
      var eps=GRAPH_EPS;
      return (dist2d(a1,b1)<eps&&dist2d(a2,b2)<eps)||(dist2d(a1,b2)<eps&&dist2d(a2,b1)<eps);
    }

    function buildAdjacencyStrict(panels,creaseEdges){
      /* Strict adjacency used only for topology cleanup.
         This avoids over-connecting tiny false panels during connectivity filtering. */
      var adj=[];
      if(!creaseEdges || !creaseEdges.length) return adj;
      creaseEdges.forEach(function(ce){
        var sharing=[];
        panels.forEach(function(panel,pi){
          var verts=panel.vertices;
          for(var i=0;i<verts.length;i++){
            var j=(i+1)%verts.length;
            if(edgeMatch(verts[i],verts[j],ce.a,ce.b)){
              sharing.push(pi); break;
            }
          }
        });
        if(sharing.length===2){
          adj.push({panelA:sharing[0],panelB:sharing[1],crease:ce,creaseIdx:ce.creaseIdx});
        }
      });
      return adj;
    }

    function buildAdjacency(panels,creaseEdges){
      /* Robust adjacency for folding UI.
         Strategy:
         1) try strict raw crease matches;
         2) try raw creases against panel crease edges with overlap;
         3) final fallback: derive fold adjacencies directly from shared panel crease edges.
         This avoids losing folds when topology split the crease into smaller sub-segments. */
      var strictAdj = buildAdjacencyStrict(panels, creaseEdges);
      if(strictAdj.length){
        log('Adjacency edges: '+strictAdj.length+' (strict)');
        return strictAdj;
      }

      var adj=[];
      var seen={};
      var eps = Math.max(GRAPH_EPS, 1.0);

      if(!creaseEdges || !creaseEdges.length){
        log('Adjacency edges: 0 (no explicit crease segments available)');
        return adj;
      }

      function edgeKey(a,b){
        var p1={x:a.x,y:a.y}, p2={x:b.x,y:b.y};
        var swap = (p1.x>p2.x) || (Math.abs(p1.x-p2.x)<eps && p1.y>p2.y);
        if(swap){ var t=p1; p1=p2; p2=t; }
        return p1.x.toFixed(2)+'|'+p1.y.toFixed(2)+'|'+p2.x.toFixed(2)+'|'+p2.y.toFixed(2);
      }

      function lineOverlapSegment(a1,a2,b1,b2){
        var va={x:a2.x-a1.x,y:a2.y-a1.y};
        var la=Math.hypot(va.x,va.y);
        if(la<eps) return null;
        var cross1=Math.abs(va.x*(b1.y-a1.y)-va.y*(b1.x-a1.x));
        var cross2=Math.abs(va.x*(b2.y-a1.y)-va.y*(b2.x-a1.x));
        if((cross1/la)>eps || (cross2/la)>eps) return null;
        var axis = Math.abs(va.x)>=Math.abs(va.y) ? 'x' : 'y';
        var aStart=a1[axis], aEnd=a2[axis];
        var bStart=b1[axis], bEnd=b2[axis];
        var aMin=Math.min(aStart,aEnd), aMax=Math.max(aStart,aEnd);
        var bMin=Math.min(bStart,bEnd), bMax=Math.max(bStart,bEnd);
        var oMin=Math.max(aMin,bMin), oMax=Math.min(aMax,bMax);
        if((oMax-oMin) <= Math.max(eps*1.2, Math.min(Math.abs(aMax-aMin), Math.abs(bMax-bMin))*0.20)) return null;
        var useX = axis==='x';
        function pointAt(val){
          var t = useX ? ((Math.abs(a2.x-a1.x)<eps)?0:(val-a1.x)/(a2.x-a1.x)) : ((Math.abs(a2.y-a1.y)<eps)?0:(val-a1.y)/(a2.y-a1.y));
          return {x:a1.x + t*(a2.x-a1.x), y:a1.y + t*(a2.y-a1.y)};
        }
        var pStart=pointAt(oMin), pEnd=pointAt(oMax);
        return {a:pStart,b:pEnd};
      }

      function pushAdj(panelA,panelB,seg,creaseIdx,mode){
        if(panelA===panelB || !seg) return;
        var key=edgeKey(seg.a, seg.b)+'|'+Math.min(panelA,panelB)+'|'+Math.max(panelA,panelB);
        if(seen[key]) return;
        seen[key]=true;
        adj.push({
          panelA:Math.min(panelA,panelB),
          panelB:Math.max(panelA,panelB),
          crease:{a:{x:seg.a.x,y:seg.a.y}, b:{x:seg.b.x,y:seg.b.y}},
          creaseIdx:creaseIdx
        });
      }

      if(creaseEdges && creaseEdges.length){
        creaseEdges.forEach(function(ce){
          var sharing=[];
          panels.forEach(function(panel,pi){
            var pedges=(panel.edges||[]).filter(function(e){ return e.type==='crease'; });
            for(var ei=0;ei<pedges.length;ei++){
              var pe=pedges[ei];
              var overlap=lineOverlapSegment(pe.u,pe.v,ce.a,ce.b);
              if(edgeMatch(pe.u,pe.v,ce.a,ce.b) || overlap){
                sharing.push({idx:pi, edge:pe, seg: overlap || {a:pe.u,b:pe.v}});
              }
            }
          });
          if(sharing.length>=2){
            for(var si=0; si<sharing.length-1; si++){
              for(var sj=si+1; sj<sharing.length; sj++){
                var seg = lineOverlapSegment(sharing[si].edge.u, sharing[si].edge.v, sharing[sj].edge.u, sharing[sj].edge.v) || sharing[si].seg || sharing[sj].seg;
                pushAdj(sharing[si].idx, sharing[sj].idx, seg, ce.creaseIdx, 'raw-vs-panel');
              }
            }
          }
        });
      }

      if(adj.length){
        log('Adjacency edges: '+adj.length+' (raw-panel overlap)');
        return adj;
      }

      /* Final fallback: derive folds purely from shared crease edges between panels. */
      for(var i=0;i<panels.length;i++){
        var edgesA=(panels[i].edges||[]).filter(function(e){ return e.type==='crease'; });
        if(!edgesA.length) continue;
        for(var j=i+1;j<panels.length;j++){
          var edgesB=(panels[j].edges||[]).filter(function(e){ return e.type==='crease'; });
          if(!edgesB.length) continue;
          for(var ai=0; ai<edgesA.length; ai++){
            for(var bi=0; bi<edgesB.length; bi++){
              var seg=lineOverlapSegment(edgesA[ai].u, edgesA[ai].v, edgesB[bi].u, edgesB[bi].v);
              if(seg){
                pushAdj(i, j, seg, -1, 'panel-panel');
              }
            }
          }
        }
      }

      log('Adjacency edges: '+adj.length+' (panel-panel fallback)');
      return adj;
    }

    function buildFoldTree(panels,adjEdges,baseIdx){
      /* BFS from base panel */
      var visited={}; visited[baseIdx]=true;
      var tree=[]; /* {parent, child, crease} */
      var queue=[baseIdx];
      while(queue.length>0){
        var curr=queue.shift();
        adjEdges.forEach(function(ae){
          var neighbor=-1;
          if(ae.panelA===curr&&!visited[ae.panelB]) neighbor=ae.panelB;
          if(ae.panelB===curr&&!visited[ae.panelA]) neighbor=ae.panelA;
          if(neighbor>=0){
            visited[neighbor]=true;
            tree.push({parent:curr,child:neighbor,crease:ae.crease, sign: computeFoldSign(panels[curr], panels[neighbor], ae.crease)});
            queue.push(neighbor);
          }
        });
      }
      log('Fold tree edges: '+tree.length+' (base=P'+baseIdx+')');
      return tree;
    }



    function signedDisplayAngle(edgeIdx, internalAngle){
      var sign = (foldSigns && typeof foldSigns[edgeIdx]==='number' && foldSigns[edgeIdx]!==0) ? foldSigns[edgeIdx] : 1;
      return Math.round((internalAngle || 0) * sign);
    }

    function internalAngleFromDisplay(edgeIdx, displayAngle){
      var sign = (foldSigns && typeof foldSigns[edgeIdx]==='number' && foldSigns[edgeIdx]!==0) ? foldSigns[edgeIdx] : 1;
      return (displayAngle || 0) * sign;
    }

    function updatePerCreaseRow(edgeIdx){
      var cs = currentCreaseSliders[edgeIdx];
      if(!cs) return;
      var display = signedDisplayAngle(edgeIdx, foldAngles[edgeIdx] || 0);
      cs.slider.value = String(display);
      cs.val.textContent = (display>0?'+':'') + String(display) + '°';
      if(cs.label) cs.label.textContent = 'C'+edgeIdx+'  P'+foldTree[edgeIdx].parent+'→P'+foldTree[edgeIdx].child+'  ' + (display>=0 ? '+' : '−');
    }

    function computeFoldSign(parentPanel, childPanel, crease){
      if(!parentPanel || !childPanel || !crease) return 1;
      var ax = crease.a.x, ay = crease.a.y, bx = crease.b.x, by = crease.b.y;
      var vx = bx - ax, vy = by - ay;
      var cc = childPanel.centroid || getPolyCentroid(childPanel.vertices || []);
      var cross = vx * (cc.y - ay) - vy * (cc.x - ax);
      if(Math.abs(cross) < 0.001){
        var pc = parentPanel.centroid || getPolyCentroid(parentPanel.vertices || []);
        cross = vx * (pc.y - ay) - vy * (pc.x - ax);
        cross *= -1;
      }
      return cross >= 0 ? 1 : -1;
    }

    function disposeObject3D(obj){
      if(!obj) return;
      if(obj.geometry) try{ obj.geometry.dispose(); }catch(ex){}
      if(obj.material){
        if(obj.material instanceof Array){
          obj.material.forEach(function(m){ try{ m.dispose(); }catch(ex){}; });
        } else {
          try{ obj.material.dispose(); }catch(ex){}
        }
      }
      if(obj.children && obj.children.length){
        obj.children.slice().forEach(function(ch){ disposeObject3D(ch); });
      }
    }


    function projectInsetDir(mid, centroid, tx, ty, fallbackSign){
      var vx = centroid.x - mid.x;
      var vy = centroid.y - mid.y;
      var dot = vx * tx + vy * ty;
      vx -= dot * tx;
      vy -= dot * ty;
      var len = Math.hypot(vx, vy);
      if(len < 1e-4){
        vx = -ty * (fallbackSign || 1);
        vy = tx * (fallbackSign || 1);
        len = Math.hypot(vx, vy);
      }
      return { x: vx / len, y: vy / len };
    }

    function buildRibbonStripGeometry(worldRows, flatRows, artRect){
      if(!worldRows || worldRows.length < 2) return null;
      var cols = worldRows[0].length;
      if(cols < 2) return null;
      var positions = [];
      var uvs = [];
      var indices = [];
      for(var r=0;r<worldRows.length;r++){
        for(var c=0;c<cols;c++){
          var wp = worldRows[r][c];
          positions.push(wp.x, wp.y, wp.z);
          if(artRect && flatRows && flatRows[r] && flatRows[r][c]){
            var fp = flatRows[r][c];
            var gx = fp.x + foldCenter.x;
            var gy = fp.y + foldCenter.y;
            var u = (gx - artRect.left) / artRect.width;
            var v = (artRect.top - gy) / artRect.height;
            uvs.push(u, v);
          } else {
            uvs.push(c/(cols-1), r/(worldRows.length-1));
          }
        }
      }
      for(var rr=0; rr<worldRows.length-1; rr++){
        for(var cc=0; cc<cols-1; cc++){
          var a = rr*cols + cc;
          var b = a + 1;
          var cidx = a + cols;
          var d = cidx + 1;
          indices.push(a, cidx, b);
          indices.push(b, cidx, d);
        }
      }
      var geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
      geom.setIndex(indices);
      geom.computeVertexNormals();
      return geom;
    }

    function makeBridgeRowsForEdge(parentGroup, childGroup, p1, p2, parentIdx, childIdx, zLocal){
      if(!parentGroup || !childGroup || !currentPanelData) return null;
      var parentPanel = currentPanelData.panels[parentIdx];
      var childPanel = currentPanelData.panels[childIdx];
      if(!parentPanel || !childPanel) return null;
      var mx = (p1.x + p2.x) * 0.5;
      var my = (p1.y + p2.y) * 0.5;
      var segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if(segLen < 1) return null;
      var tx = (p2.x - p1.x) / segLen;
      var ty = (p2.y - p1.y) / segLen;
      var parentCent = { x: parentPanel.centroid.x - foldCenter.x, y: parentPanel.centroid.y - foldCenter.y };
      var childCent = { x: childPanel.centroid.x - foldCenter.x, y: childPanel.centroid.y - foldCenter.y };
      var parentDir = projectInsetDir({x:mx,y:my}, parentCent, tx, ty, 1);
      var childDir = projectInsetDir({x:mx,y:my}, childCent, tx, ty, -1);
      var inset = Math.max(0.04, Math.min(0.35, currentThicknessMm * 0.35));
      var parent2 = [
        { x: p1.x + parentDir.x * inset, y: p1.y + parentDir.y * inset },
        { x: p2.x + parentDir.x * inset, y: p2.y + parentDir.y * inset }
      ];
      var crease2 = [ { x:p1.x, y:p1.y }, { x:p2.x, y:p2.y } ];
      var child2 = [
        { x: p1.x + childDir.x * inset, y: p1.y + childDir.y * inset },
        { x: p2.x + childDir.x * inset, y: p2.y + childDir.y * inset }
      ];
      function toWorld(g, pt, z){ return g.localToWorld(new THREE.Vector3(pt.x, pt.y, z)); }
      var parentWorld = [ toWorld(parentGroup, parent2[0], zLocal), toWorld(parentGroup, parent2[1], zLocal) ];
      var parentCrease = [ toWorld(parentGroup, crease2[0], zLocal), toWorld(parentGroup, crease2[1], zLocal) ];
      var childCrease = [ toWorld(childGroup, crease2[0], zLocal), toWorld(childGroup, crease2[1], zLocal) ];
      var childWorld = [ toWorld(childGroup, child2[0], zLocal), toWorld(childGroup, child2[1], zLocal) ];
      var middleWorld = [ parentCrease[0].clone().lerp(childCrease[0], 0.5), parentCrease[1].clone().lerp(childCrease[1], 0.5) ];
      return {
        worldRows: [parentWorld, middleWorld, childWorld],
        flatRows: [parent2, crease2, child2]
      };
    }

    function addFoldBridgeVisual(parentGroup, childGroup, edgeIdx, p1, p2, parentIdx, childIdx){
      if(!scene3d || !parentGroup || !childGroup) return;
      var displayAngle = signedDisplayAngle(edgeIdx, foldAngles[edgeIdx] || 0);
      if(Math.abs(displayAngle) < CREASE_HINGE_SHOW_THRESHOLD_DEG) return;
      if(!foldBridgeGroup){
        foldBridgeGroup = new THREE.Group();
        foldBridgeGroup.name = 'fold-bridges';
        scene3d.add(foldBridgeGroup);
      }

      var topRows = makeBridgeRowsForEdge(parentGroup, childGroup, p1, p2, parentIdx, childIdx, currentThicknessMm + FOLD_BRIDGE_TOP_Z);
      if(topRows){
        var topGeom = buildRibbonStripGeometry(topRows.worldRows, topRows.flatRows, currentArtState && currentArtState.front ? currentArtState.front.rect : null);
        if(topGeom){
          var topMat;
          if(currentArtState && currentArtState.front && currentArtState.front.texture){
            topMat = new THREE.MeshBasicMaterial({ map: currentArtState.front.texture, transparent:true, side:THREE.DoubleSide, depthWrite:true, depthTest:true });
          } else {
            topMat = new THREE.MeshPhongMaterial({ color:new THREE.Color(getFoldHingeHex()), specular:0x1b1b1b, shininess:6, side:THREE.DoubleSide });
          }
          var topMesh = new THREE.Mesh(topGeom, topMat);
          topMesh.renderOrder = 33;
          topMesh.userData = { role:'foldBridgeTop', edgeIdx:edgeIdx };
          foldBridgeGroup.add(topMesh);
        }
      }

      var bottomRows = makeBridgeRowsForEdge(parentGroup, childGroup, p1, p2, parentIdx, childIdx, -FOLD_BRIDGE_BOTTOM_Z);
      if(bottomRows){
        var bottomGeom = buildRibbonStripGeometry(bottomRows.worldRows, bottomRows.flatRows, currentArtState && currentArtState.back ? currentArtState.back.rect : null);
        if(bottomGeom){
          var bottomMat;
          if(currentArtState && currentArtState.back && currentArtState.back.texture){
            bottomMat = new THREE.MeshBasicMaterial({ map: currentArtState.back.texture, transparent:true, side:THREE.DoubleSide, depthWrite:true, depthTest:true });
          } else {
            bottomMat = new THREE.MeshPhongMaterial({ color:new THREE.Color(getFoldHingeHex()), specular:0x1b1b1b, shininess:6, side:THREE.DoubleSide });
          }
          var bottomMesh = new THREE.Mesh(bottomGeom, bottomMat);
          bottomMesh.renderOrder = 32;
          bottomMesh.userData = { role:'foldBridgeBottom', edgeIdx:edgeIdx };
          foldBridgeGroup.add(bottomMesh);
        }
      }
    }

    function rebuildCreaseVisuals(childrenOf){
      if(foldBridgeGroup){
        if(foldBridgeGroup.parent) foldBridgeGroup.parent.remove(foldBridgeGroup);
        disposeObject3D(foldBridgeGroup);
        foldBridgeGroup=null;
      }
      if(scene3d) scene3d.updateMatrixWorld(true);
      creasePickables = [];
      creaseVisuals = [];
      if(!panelGroupMap.length || !foldTree.length) return;
      Object.keys(childrenOf || {}).forEach(function(parentKey){
        var parentIdx = parseInt(parentKey,10);
        var parentGroup = panelGroupMap[parentIdx];
        if(!parentGroup) return;
        (childrenOf[parentKey] || []).forEach(function(ch){
          var edgeIdx = ch.edgeIdx;
          var ca = ch.crease.a, cb = ch.crease.b;
          var p1 = {x:ca.x-foldCenter.x, y:ca.y-foldCenter.y};
          var p2 = {x:cb.x-foldCenter.x, y:cb.y-foldCenter.y};
          var z = currentThicknessMm + CREASE_LINE_Z_OFFSET;

          addFoldBridgeVisual(parentGroup, panelGroupMap[ch.child], edgeIdx, p1, p2, parentIdx, ch.child);

          var visibleGeom = new THREE.BufferGeometry();
          visibleGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            p1.x,p1.y,z,
            p2.x,p2.y,z
          ]),3));
          var visibleMat = new THREE.LineBasicMaterial({
            color:0xff4444, transparent:true, opacity:0.98,
            depthTest:false, depthWrite:false
          });
          var visibleLine = new THREE.Line(visibleGeom, visibleMat);
          visibleLine.renderOrder = 90;
          visibleLine.userData = { edgeIdx: edgeIdx, role: 'visibleCrease' };
          visibleLine.frustumCulled = false;
          parentGroup.add(visibleLine);

          var segLen = Math.hypot(p2.x-p1.x, p2.y-p1.y);
          var segMidX = (p1.x+p2.x)/2;
          var segMidY = (p1.y+p2.y)/2;
          var segAngle = Math.atan2(p2.y-p1.y, p2.x-p1.x);
          var pickGeom = new THREE.BoxGeometry(Math.max(segLen + 6, 8), Math.max(26, currentThicknessMm*9), Math.max(5.0, currentThicknessMm*3.2));
          var pickMat = new THREE.MeshBasicMaterial({
            color:0xffffff, transparent:true, opacity:0.001,
            depthTest:false, depthWrite:false
          });
          var pickLine = new THREE.Mesh(pickGeom, pickMat);
          pickLine.position.set(segMidX, segMidY, z + 0.55);
          pickLine.rotation.z = segAngle;
          pickLine.renderOrder = 95;
          pickLine.userData = { edgeIdx: edgeIdx, role: 'pickCrease' };
          parentGroup.add(pickLine);

          creasePickables.push(pickLine);
          creasePickables.push(visibleLine);
          creaseVisuals.push({edgeIdx:edgeIdx, visible:visibleLine, pick:pickLine});
        });
      });
      updateSelectedCreaseVisuals();
    }

    function updateSelectedCreaseVisuals(){
      creaseVisuals.forEach(function(entry){
        if(!entry.visible || !entry.visible.material) return;
        var active = entry.edgeIdx===selectedFoldEdgeIdx;
        entry.visible.material.color.set(active ? '#ffd166' : '#ff4444');
        entry.visible.material.opacity = active ? 1 : 0.98;
        entry.visible.material.needsUpdate = true;
      });
      currentCreaseRows.forEach(function(row, idx){
        if(!row) return;
        row.style.background = idx===selectedFoldEdgeIdx ? 'rgba(255,209,102,0.10)' : 'transparent';
        row.style.borderRadius = '8px';
        row.style.padding = '2px 4px';
      });
    }

    function syncSelectedCreaseUI(){
      if(!selectedCreaseLabelEl || !selectedCreaseSliderEl || !selectedCreaseNumberEl) return;
      if(selectedFoldEdgeIdx<0 || !foldTree[selectedFoldEdgeIdx]){
        selectedCreaseLabelEl.textContent = 'Selected crease: none';
        selectedCreaseSliderEl.disabled = true;
        selectedCreaseNumberEl.disabled = true;
        selectedCreaseSliderEl.value = '0';
        selectedCreaseNumberEl.value = '0';
        updateSelectedCreaseVisuals();
        return;
      }
      var edge = foldTree[selectedFoldEdgeIdx];
      var displayAngle = signedDisplayAngle(selectedFoldEdgeIdx, foldAngles[selectedFoldEdgeIdx] || 0);
      selectedCreaseLabelEl.textContent = 'Selected crease: C'+selectedFoldEdgeIdx+' · P'+edge.parent+' → P'+edge.child+' · '+(displayAngle>0?'+':'')+displayAngle+'°';
      selectedCreaseSliderEl.disabled = false;
      selectedCreaseNumberEl.disabled = false;
      selectedCreaseSliderEl.value = String(displayAngle);
      selectedCreaseNumberEl.value = String(displayAngle);
      updateSelectedCreaseVisuals();
    }

    function selectFoldEdge(edgeIdx, applyNow){
      if(edgeIdx===null || edgeIdx===undefined || !foldTree.length){
        selectedFoldEdgeIdx = -1;
        syncSelectedCreaseUI();
        return;
      }
      selectedFoldEdgeIdx = Math.max(0, Math.min(edgeIdx, foldTree.length-1));
      setInteractionMode('fold', false);
      syncSelectedCreaseUI();
      if(applyNow) applyFolding();
    }

    function applySelectedCreaseAngle(angle){
      if(selectedFoldEdgeIdx<0 || selectedFoldEdgeIdx>=foldAngles.length) return;
      var clamped = Math.max(-180, Math.min(180, angle));
      foldAngles[selectedFoldEdgeIdx] = internalAngleFromDisplay(selectedFoldEdgeIdx, clamped);
      if(currentCreaseSliders[selectedFoldEdgeIdx]) updatePerCreaseRow(selectedFoldEdgeIdx);
      syncSelectedCreaseUI();
      applyFolding();
    }

    function pickCreaseFromEvent(e){
      if(!renderer3d || !camera3d || !raycaster3d || !pointer3d || !creasePickables.length) return false;
      var rect = canvas3d.getBoundingClientRect();
      if(!rect.width || !rect.height) return false;
      pointer3d.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer3d.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster3d.params.Line = raycaster3d.params.Line || {};
      raycaster3d.params.Line.threshold = 40;
      raycaster3d.setFromCamera(pointer3d, camera3d);
      var hits = raycaster3d.intersectObjects(creasePickables, true).sort(function(a,b){ return a.distance-b.distance; });
      if(!hits || !hits.length) return false;
      var edgeIdx = hits[0].object && hits[0].object.userData ? hits[0].object.userData.edgeIdx : null;
      if(edgeIdx===null || edgeIdx===undefined) return false;
      selectFoldEdge(edgeIdx, false);
      setActiveTab('creases');
      setStatus('Crease C'+edgeIdx+' selected · Alt/Option + click another red line to retarget');
      return true;
    }

    /* ================================================================
       APPLY FOLDING — hierarchical pivot rotation
       ================================================================ */
    function applyFolding(){
      if(!scene3d || !panelMeshes.length) return;

      if(foldRoot && foldRoot.parent) foldRoot.parent.remove(foldRoot);
      foldRoot=new THREE.Group();
      foldRoot.rotation.x=-Math.PI/2;
      scene3d.add(foldRoot);

      var panelGroups=[];
      panelGroupMap = panelGroups;
      panelLabelSprites = [];
      panelMeshes.forEach(function(mesh){
        if(mesh.parent) mesh.parent.remove(mesh);
        else scene3d.remove(mesh);
        mesh.rotation.set(0,0,0);
        mesh.position.set(0,0,0);
        var g=new THREE.Group();
        g.add(mesh);
        var pIdx = mesh.userData.panelIndex;
        if(currentPanelData && currentPanelData.panels && currentPanelData.panels[pIdx]){
          var pData = currentPanelData.panels[pIdx];
          var showLabel = !baseSelectionConfirmed || pIdx===currentBasePanelIndex;
          if(showLabel){
            var sp = makePanelLabelSprite('P'+pIdx, pIdx===currentBasePanelIndex);
            sp.position.set((pData.centroid.x - foldCenter.x), (pData.centroid.y - foldCenter.y), currentThicknessMm + 5.0);
            sp.userData = { panelIndex:pIdx, role:'panelLabel' };
            g.add(sp);
            panelLabelSprites[pIdx] = sp;
          }
        }
        panelGroups[pIdx]=g;
      });

      var childrenOf={};
      foldTree.forEach(function(edge,ei){
        if(!childrenOf[edge.parent]) childrenOf[edge.parent]=[];
        childrenOf[edge.parent].push({child:edge.child,crease:edge.crease,edgeIdx:ei});
      });

      var attached={};
      function attachChildren(parentIdx,parentGroup){
        attached[parentIdx]=true;
        var children=childrenOf[parentIdx]||[];
        children.forEach(function(ch){
          var angle=(foldAngles[ch.edgeIdx]||0)*Math.PI/180;
          var ca=ch.crease.a, cb=ch.crease.b;
          var p1={x:ca.x-foldCenter.x, y:ca.y-foldCenter.y};
          var p2={x:cb.x-foldCenter.x, y:cb.y-foldCenter.y};

          var pivot=new THREE.Group();
          pivot.position.set(p1.x,p1.y,0);

          var creaseAngle=Math.atan2(p2.y-p1.y, p2.x-p1.x);
          var alignGroup=new THREE.Group();
          alignGroup.rotation.z=creaseAngle;

          var innerPivot=new THREE.Group();
          innerPivot.rotation.x=angle;

          /* IMPORTANT:
             Keep translation and un-alignment in separate groups so that
             angle=0 preserves the child's original flat world transform.
             Mixing rotation.z and position on the same group caused
             T(p1)·R(a)·T(-p1)·R(-a), which displaces panels even at 0°. */
          var unalignGroup=new THREE.Group();
          unalignGroup.rotation.z=-creaseAngle;

          var translateGroup=new THREE.Group();
          translateGroup.position.set(-p1.x,-p1.y,0);

          translateGroup.add(panelGroups[ch.child]);
          unalignGroup.add(translateGroup);
          innerPivot.add(unalignGroup);
          alignGroup.add(innerPivot);
          pivot.add(alignGroup);
          parentGroup.add(pivot);

          attachChildren(ch.child,translateGroup);
        });
      }

      var baseIdx=Math.max(0, Math.min(currentBasePanelIndex, panelMeshes.length-1));
      if(panelGroups[baseIdx]){
        foldRoot.add(panelGroups[baseIdx]);
        attachChildren(baseIdx,panelGroups[baseIdx]);
      }

      panelGroups.forEach(function(g,idx){
        if(g && !attached[idx] && idx!==baseIdx) foldRoot.add(g);
      });

      rebuildCreaseVisuals(childrenOf);
      refreshPanelMaterials();
      if(scene3d) scene3d.updateMatrixWorld(true);
    }

    function getDefaultBaseIndex(panelData){
      var bestBase=0, bestArea=0;
      panelData.panels.forEach(function(p,i){
        if(Math.abs(p.area)>bestArea){bestArea=Math.abs(p.area);bestBase=i;}
      });
      return bestBase;
    }

    function setBasePanel(newBase, rebuildUI, userSelected){
      if(!currentPanelData || !currentAdjEdges) return;
      currentBasePanelIndex = Math.max(0, Math.min(newBase, currentPanelData.panels.length-1));
      if(userSelected) baseSelectionConfirmed = true;
      foldTree = buildFoldTree(currentPanelData.panels, currentAdjEdges, currentBasePanelIndex);
      foldSigns = foldTree.map(function(edge){ return edge.sign || 1; });
      foldAngles = foldTree.map(function(){ return 0; });
      foldCenter = foldData ? foldData.center : {x:0,y:0};
      selectedFoldEdgeIdx = foldTree.length ? 0 : -1;
      if(rebuildUI) buildFoldUI(currentPanelData);
      applyFolding();
      fitCamera3D();
      setStatus('3D ready · base=P'+currentBasePanelIndex+' · thickness='+currentThicknessMm.toFixed(1)+'mm');
    }

    function buildFoldUI(panelData){
      currentPanelData = panelData;
      currentAdjEdges = buildAdjacency(panelData.panels,panelData.creaseEdges);
      if(currentBasePanelIndex<0 || currentBasePanelIndex>=panelData.panels.length){
        currentBasePanelIndex = getDefaultBaseIndex(panelData);
      }
      foldTree = buildFoldTree(panelData.panels,currentAdjEdges,currentBasePanelIndex);
      foldSigns = foldTree.map(function(edge){ return edge.sign || 1; });
      foldAngles = foldTree.map(function(){return 0;});
      foldCenter = foldData?foldData.center:{x:0,y:0};

      var existing=byId('fold-panel');
      if(existing) existing.remove();

      var nPanels=panelData.panels.length;
      var panel=document.createElement('div');
      panel.id='fold-panel';
      panel.className='card fold-section';
      panel.style.cssText='margin-top:0;max-height:320px;overflow-y:auto;';

      var title=document.createElement('div');
      title.className='cardtitle';
      title.textContent='Fold Controls';
      title.style.marginBottom='8px';
      panel.appendChild(title);

      var info=document.createElement('div');
      info.style.cssText='font-size:11px;opacity:0.78;margin-bottom:8px;line-height:1.35;';
      info.textContent=nPanels+' panels, '+currentAdjEdges.length+' fold edges, base=P'+currentBasePanelIndex+(currentAdjEdges.length ? '. Alt/Option + click a red fold line in 3D. Shift + click any panel to change the base.' : '. No fold edges detected yet.');
      panel.appendChild(info);

      var selectedRow=document.createElement('div');
      selectedRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;';
      selectedCreaseLabelEl=document.createElement('div');
      selectedCreaseLabelEl.style.cssText='font-size:11px;font-weight:700;min-width:140px;';
      selectedCreaseLabelEl.textContent='Selected crease: none';
      selectedCreaseSliderEl=document.createElement('input');
      selectedCreaseSliderEl.type='range'; selectedCreaseSliderEl.min='-180'; selectedCreaseSliderEl.max='180'; selectedCreaseSliderEl.value='0';
      selectedCreaseSliderEl.style.cssText='flex:1;min-width:120px;accent-color:#ffd166;';
      selectedCreaseNumberEl=document.createElement('input');
      selectedCreaseNumberEl.type='number'; selectedCreaseNumberEl.min='-180'; selectedCreaseNumberEl.max='180'; selectedCreaseNumberEl.step='1'; selectedCreaseNumberEl.value='0';
      selectedCreaseNumberEl.style.cssText='width:72px;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:8px;padding:6px 8px;font-size:11px;';
      selectedRow.appendChild(selectedCreaseLabelEl);
      selectedRow.appendChild(selectedCreaseSliderEl);
      selectedRow.appendChild(selectedCreaseNumberEl);
      panel.appendChild(selectedRow);

      var baseRow=document.createElement('div');
      baseRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;';
      var baseLabel=document.createElement('span');
      baseLabel.textContent='Base';
      baseLabel.style.cssText='font-size:11px;font-weight:700;min-width:36px;';
      var baseSelect=document.createElement('select');
      baseSelect.style.cssText='flex:1;background:#0b1220;color:#fff;border:1px solid #334155;border-radius:10px;padding:8px 10px;font-size:11px;';
      panelData.panels.forEach(function(p,i){
        var opt=document.createElement('option');
        opt.value=i;
        opt.textContent='P'+i+' ('+Math.abs(p.area).toFixed(0)+' mm²)';
        if(i===currentBasePanelIndex) opt.selected=true;
        baseSelect.appendChild(opt);
      });
      currentBaseSelect = baseSelect;
      baseRow.appendChild(baseLabel);
      baseRow.appendChild(baseSelect);
      panel.appendChild(baseRow);

      var allDetails=document.createElement('details');
      allDetails.className='all-creases';
      allDetails.open=false;
      var allSummary=document.createElement('summary');
      allSummary.textContent='ALL creases';
      allDetails.appendChild(allSummary);
      var allRow=document.createElement('div');
      allRow.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px;';
      var allLabel=document.createElement('span');
      allLabel.textContent='ALL';
      allLabel.style.cssText='font-size:11px;font-weight:700;color:#ff6b6b;min-width:30px;';
      var allSlider=document.createElement('input');
      allSlider.type='range'; allSlider.min='-180'; allSlider.max='180'; allSlider.value='0';
      allSlider.style.cssText='flex:1;accent-color:#ff6b6b;';
      var allVal=document.createElement('span');
      allVal.textContent='0°';
      allVal.style.cssText='font-size:11px;min-width:42px;text-align:right;';
      allRow.appendChild(allLabel);
      allRow.appendChild(allSlider);
      allRow.appendChild(allVal);
      allDetails.appendChild(allRow);

      var creaseListWrap=document.createElement('div');
      creaseListWrap.style.cssText='display:flex;flex-direction:column;gap:4px;';
      allDetails.appendChild(creaseListWrap);
      panel.appendChild(allDetails);

      var creaseSliders=[];
      currentCreaseRows = [];
      currentCreaseSliders = creaseSliders;
      foldTree.forEach(function(edge,ei){
        var row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:4px;cursor:pointer;';
        var label=document.createElement('span');
        label.textContent='C'+ei+'  P'+edge.parent+'→P'+edge.child+'  '+((foldSigns[ei]||1)>=0?'+':'−');
        label.style.cssText='font-size:10px;font-weight:600;color:#66bbff;min-width:30px;';
        var slider=document.createElement('input');
        slider.type='range'; slider.min='-180'; slider.max='180'; slider.value='0';
        slider.style.cssText='flex:1;accent-color:#66bbff;';
        slider.dataset.idx=ei;
        var val=document.createElement('span');
        val.textContent='0°';
        val.style.cssText='font-size:10px;min-width:35px;text-align:right;';
        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(val);
        creaseListWrap.appendChild(row);
        creaseSliders.push({slider:slider,val:val,row:row,label:label});
        currentCreaseRows.push(row);

        row.addEventListener('click', function(){
          selectFoldEdge(ei, false);
        });

        slider.addEventListener('input',function(){
          var idx=parseInt(this.dataset.idx,10);
          var displayVal=parseFloat(this.value);
          foldAngles[idx]=internalAngleFromDisplay(idx, displayVal);
          val.textContent=(displayVal>0?'+':'')+displayVal+'°';
          if(selectedFoldEdgeIdx===idx) syncSelectedCreaseUI();
          applyFolding();
        });
      });

      selectedCreaseSliderEl.addEventListener('input', function(){
        applySelectedCreaseAngle(parseFloat(this.value));
      });
      selectedCreaseNumberEl.addEventListener('change', function(){
        applySelectedCreaseAngle(parseFloat(this.value));
      });

      allSlider.addEventListener('input',function(){
        var v=parseFloat(allSlider.value);
        allVal.textContent=(v>0?'+':'')+v+'°';
        foldAngles=foldAngles.map(function(){return v;});
        creaseSliders.forEach(function(cs,idx){ updatePerCreaseRow(idx); });
        syncSelectedCreaseUI();
        applyFolding();
      });

      var resetBtn=document.createElement('button');
      resetBtn.className='btn secondary full';
      resetBtn.textContent='↩ Reset Flat';
      resetBtn.style.marginTop='6px';
      resetBtn.addEventListener('click',function(){
        allSlider.value='0'; allVal.textContent='0°';
        foldAngles=foldAngles.map(function(){return 0;});
        creaseSliders.forEach(function(cs,idx){ updatePerCreaseRow(idx); });
        syncSelectedCreaseUI();
        applyFolding();
      });
      panel.appendChild(resetBtn);

      baseSelect.addEventListener('change',function(){
        setBasePanel(parseInt(baseSelect.value,10), true, true);
      });

      var debugDetails = byId('debug-details');
      var logNode = byId('log-area');
      var creaseSlot = byId('crease-controls-slot');
      if(creaseSlot){
        creaseSlot.innerHTML='';
        creaseSlot.appendChild(panel);
      }else if(debugDetails && debugDetails.parentNode===threeView){
        threeView.insertBefore(panel, debugDetails);
      }else if(logNode && logNode.parentNode===threeView){
        threeView.insertBefore(panel, logNode);
      }else{
        threeView.appendChild(panel);
      }
      if(!foldTree.length) selectedFoldEdgeIdx = -1;
      else if(selectedFoldEdgeIdx<0 || selectedFoldEdgeIdx>=foldTree.length) selectedFoldEdgeIdx = 0;
      syncSelectedCreaseUI();
      applyFolding();
      refreshPanelMaterials();
      setStatus(currentAdjEdges.length ? ('3D model ready - '+nPanels+' panels, '+currentAdjEdges.length+' fold edges') : ('3D model ready - '+nPanels+' panels, no fold edges detected'));
    }

    function triggerDownload(blob, filename){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ try{ document.body.removeChild(a); }catch(ex){} URL.revokeObjectURL(url); }, 250);
    }

    function blobToBase64(blob){
      return new Promise(function(resolve, reject){
        try{
          var fr = new FileReader();
          fr.onerror = function(){ reject(new Error('Could not read GLB blob')); };
          fr.onloadend = function(){
            try{
              var s = String(fr.result || '');
              var comma = s.indexOf(',');
              resolve(comma >= 0 ? s.slice(comma + 1) : s);
            }catch(ex){ reject(ex); }
          };
          fr.readAsDataURL(blob);
        }catch(ex){ reject(ex); }
      });
    }

    function askSavePathViaIllustrator(defaultName){
      return new Promise(function(resolve, reject){
        try{
          var safeName = String(defaultName || 'tesseract_model.glb').replace(/[^A-Za-z0-9._-]+/g,'_');
          var jsx = '(function(){\n'
            + 'var f = File.saveDialog("Save GLB", "*.glb");\n'
            + 'if(!f) return "";\n'
            + 'var name = String(f.name||"");\n'
            + 'if(!/\.glb$/i.test(name)) f = new File(f.fsName + ".glb");\n'
            + 'return f.fsName;\n'
            + '})();';
          window.__adobe_cep__.evalScript(jsx, function(result){
            if(result === 'EvalScript error.') return reject(new Error('Illustrator save dialog failed'));
            resolve(String(result || ''));
          });
        }catch(ex){ reject(ex); }
      });
    }

    async function saveBlobWithDialog(blob, defaultName){
      var path = await askSavePathViaIllustrator(defaultName || 'tesseract_model.glb');
      if(!path) return { cancelled:true, path:'' };
      if(!(window.cep && window.cep.fs && typeof window.cep.fs.writeFile === 'function')){
        triggerDownload(blob, defaultName || 'tesseract_model.glb');
        return { cancelled:false, path:'', fallback:true };
      }
      var base64 = await blobToBase64(blob);
      var enc = (window.cep.encoding && (window.cep.encoding.Base64 || window.cep.encoding.base64)) || 'Base64';
      var res = window.cep.fs.writeFile(path, base64, enc);
      if(!res || (res.err !== 0 && res.err !== '0')){
        throw new Error('Could not save GLB file' + (res && res.err !== undefined ? ' (err '+res.err+')' : ''));
      }
      return { cancelled:false, path:path };
    }

    function exportPNG(){
      if(!renderer3d) return;
      var url=renderer3d.domElement.toDataURL('image/png');
      var a=document.createElement('a');
      a.href=url; a.download='tesseract_3d.png'; a.click();
    }

    function bytesFromDataURL(dataURL){
      var parts = String(dataURL||'').split(',');
      var meta = parts[0] || '';
      var base64 = parts[1] || '';
      var mimeMatch = meta.match(/data:([^;]+)/i);
      var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      var bin = atob(base64);
      var out = new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
      return { mime:mime, bytes:out };
    }

    function textureToImageBytes(texture){
      if(!texture || !texture.image) return null;
      var img = texture.image;
      try{
        if(typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement){
          return bytesFromDataURL(img.toDataURL('image/png'));
        }
      }catch(ex0){}
      try{
        var w = img.naturalWidth || img.videoWidth || img.width;
        var h = img.naturalHeight || img.videoHeight || img.height;
        if(!w || !h) return null;
        var cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        var ictx = cvs.getContext('2d');
        ictx.drawImage(img,0,0,w,h);
        return bytesFromDataURL(cvs.toDataURL('image/png'));
      }catch(ex1){
        try{ log('Texture image encode failed: '+ex1.message); }catch(exlog){}
        return null;
      }
    }

    function padBytes(u8, padVal){
      var pad = (4 - (u8.length % 4)) % 4;
      if(!pad) return u8;
      var out = new Uint8Array(u8.length + pad);
      out.set(u8,0);
      for(var i=u8.length;i<out.length;i++) out[i] = padVal || 0;
      return out;
    }

    function toUint8View(typed){
      return new Uint8Array(typed.buffer, typed.byteOffset||0, typed.byteLength);
    }

    function typedArrayFromList(list, ctor){
      var arr = new ctor(list.length);
      for(var i=0;i<list.length;i++) arr[i] = list[i];
      return arr;
    }

    function buildExportSceneMeshes(){
      if(!scene3d) return [];
      scene3d.updateMatrixWorld(true);
      var out = [];
      scene3d.traverse(function(obj){
        if(!obj || !obj.isMesh) return;
        if(obj.userData && (obj.userData.role==='pickCrease' || obj.userData.role==='panelLabel')) return;
        if(obj.material && obj.material.opacity!==undefined && obj.material.transparent && obj.material.opacity < 0.01) return;
        if(!obj.geometry) return;
        var geom = obj.geometry.clone();
        if(!geom.attributes || !geom.attributes.position) return;
        if(!geom.attributes.normal) geom.computeVertexNormals();
        var posAttr = geom.attributes.position;
        var posOut = [];
        var min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
        for(var i=0;i<posAttr.count;i++){
          var v = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(obj.matrixWorld);
          posOut.push(v.x,v.y,v.z);
          if(v.x<min[0]) min[0]=v.x; if(v.y<min[1]) min[1]=v.y; if(v.z<min[2]) min[2]=v.z;
          if(v.x>max[0]) max[0]=v.x; if(v.y>max[1]) max[1]=v.y; if(v.z>max[2]) max[2]=v.z;
        }
        var normOut = [];
        if(geom.attributes.normal){
          var nMat = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
          var nAttr = geom.attributes.normal;
          for(var j=0;j<nAttr.count;j++){
            var n = new THREE.Vector3(nAttr.getX(j), nAttr.getY(j), nAttr.getZ(j)).applyMatrix3(nMat).normalize();
            normOut.push(n.x,n.y,n.z);
          }
        }
        var uvOut = [];
        if(geom.attributes.uv){
          var uvAttr = geom.attributes.uv;
          for(var u=0;u<uvAttr.count;u++) uvOut.push(uvAttr.getX(u), uvAttr.getY(u));
        }
        var idxOut = [];
        if(geom.index){
          var idxAttr = geom.index.array;
          for(var k=0;k<idxAttr.length;k++) idxOut.push(idxAttr[k]);
        } else {
          for(var q=0;q<posAttr.count;q++) idxOut.push(q);
        }
        out.push({
          name: obj.name || (obj.userData && obj.userData.role) || 'mesh_'+out.length,
          positions: typedArrayFromList(posOut, Float32Array),
          normals: normOut.length ? typedArrayFromList(normOut, Float32Array) : null,
          uvs: uvOut.length ? typedArrayFromList(uvOut, Float32Array) : null,
          indices: (Math.max.apply(null, idxOut) < 65535) ? typedArrayFromList(idxOut, Uint16Array) : typedArrayFromList(idxOut, Uint32Array),
          min: min,
          max: max,
          material: obj.material
        });
      });
      return out;
    }

    function materialKey(mat){
      if(!mat) return 'default';
      var c = mat.color ? mat.color.getHexString() : 'ffffff';
      var op = (mat.opacity!==undefined ? mat.opacity : 1);
      var ds = (mat.side===THREE.DoubleSide) ? 'd' : 's';
      var mapId = (mat.map && (mat.map.uuid || (mat.map.image && (mat.map.image.currentSrc || mat.map.image.src)) )) || 'nomap';
      return [c,op,ds,mapId].join('|');
    }

    function buildGLBBlobFromCurrentView(){
      var meshes = buildExportSceneMeshes();
      if(!meshes.length) throw new Error('Nothing exportable in current 3D view');

      var gltf = {
        asset:{version:'2.0', generator:'Tesseract Phase 7B'},
        scene:0,
        scenes:[{nodes:[]}],
        nodes:[],
        meshes:[],
        materials:[],
        accessors:[],
        bufferViews:[],
        buffers:[{byteLength:0}]
      };

      var binaryParts = [];
      var byteOffset = 0;
      function appendBytes(u8, target){
        var pad = (4 - (byteOffset % 4)) % 4;
        if(pad){ binaryParts.push(new Uint8Array(pad)); byteOffset += pad; }
        var viewIndex = gltf.bufferViews.length;
        gltf.bufferViews.push({ buffer:0, byteOffset:byteOffset, byteLength:u8.length });
        if(target) gltf.bufferViews[viewIndex].target = target;
        binaryParts.push(u8);
        byteOffset += u8.length;
        return viewIndex;
      }
      function addAccessorFromTyped(typed, type, componentType, target, extras){
        var viewIndex = appendBytes(toUint8View(typed), target);
        var acc = { bufferView:viewIndex, componentType:componentType, count: typed.length / ({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type]||1), type:type };
        if(extras){ for(var k in extras) acc[k]=extras[k]; }
        var accIndex = gltf.accessors.length;
        gltf.accessors.push(acc);
        return accIndex;
      }

      var samplerIndex = null;
      var textureMap = {};
      var materialMap = {};

      function ensureSampler(){
        if(gltf.samplers && gltf.samplers.length) return 0;
        gltf.samplers = [{ magFilter:9729, minFilter:9729, wrapS:10497, wrapT:10497 }];
        return 0;
      }

      function ensureTexture(texture){
        if(!texture || !texture.image) return null;
        var key = texture.uuid || (texture.image.currentSrc || texture.image.src || ('tex_'+Object.keys(textureMap).length));
        if(textureMap[key]!==undefined) return textureMap[key];
        var imgBytes = textureToImageBytes(texture);
        if(!imgBytes || !imgBytes.bytes || !imgBytes.bytes.length) return null;
        var imgView = appendBytes(imgBytes.bytes, null);
        if(!gltf.images) gltf.images = [];
        if(!gltf.textures) gltf.textures = [];
        var imgIndex = gltf.images.length;
        gltf.images.push({ bufferView:imgView, mimeType: imgBytes.mime || 'image/png', name:'image_'+imgIndex });
        var texIndex = gltf.textures.length;
        gltf.textures.push({ sampler: ensureSampler(), source: imgIndex, name:'texture_'+texIndex });
        textureMap[key] = texIndex;
        return texIndex;
      }

      function ensureMaterial(mat){
        var key = materialKey(mat);
        if(materialMap[key]!==undefined) return materialMap[key];
        var color = mat && mat.color ? mat.color : new THREE.Color(0xffffff);
        var alpha = (mat && mat.opacity!==undefined) ? mat.opacity : 1;
        var out = {
          name: 'mat_'+gltf.materials.length,
          pbrMetallicRoughness: {
            baseColorFactor: [color.r, color.g, color.b, alpha],
            metallicFactor: 0,
            roughnessFactor: 1
          },
          doubleSided: true
        };
        if(mat && mat.map){
          var texIndex = ensureTexture(mat.map);
          if(texIndex!==null) out.pbrMetallicRoughness.baseColorTexture = { index: texIndex };
        }
        if(alpha < 0.999 || (mat && mat.transparent)) out.alphaMode = 'BLEND';
        var idx = gltf.materials.length;
        gltf.materials.push(out);
        materialMap[key] = idx;
        return idx;
      }

      meshes.forEach(function(meshInfo){
        var attr = {};
        attr.POSITION = addAccessorFromTyped(meshInfo.positions, 'VEC3', 5126, 34962, { min: meshInfo.min, max: meshInfo.max });
        if(meshInfo.normals) attr.NORMAL = addAccessorFromTyped(meshInfo.normals, 'VEC3', 5126, 34962);
        if(meshInfo.uvs) attr.TEXCOORD_0 = addAccessorFromTyped(meshInfo.uvs, 'VEC2', 5126, 34962);
        var idxType = (meshInfo.indices instanceof Uint32Array) ? 5125 : 5123;
        var indicesAccessor = addAccessorFromTyped(meshInfo.indices, 'SCALAR', idxType, 34963);
        var primitive = { attributes: attr, indices: indicesAccessor, material: ensureMaterial(meshInfo.material), mode: 4 };
        var meshIndex = gltf.meshes.length;
        gltf.meshes.push({ name: meshInfo.name, primitives:[primitive] });
        var nodeIndex = gltf.nodes.length;
        gltf.nodes.push({ mesh: meshIndex, name: meshInfo.name });
        gltf.scenes[0].nodes.push(nodeIndex);
      });

      var totalBinLen = 0;
      binaryParts.forEach(function(p){ totalBinLen += p.length; });
      gltf.buffers[0].byteLength = totalBinLen;

      var enc = new TextEncoder();
      var jsonBytes = padBytes(enc.encode(JSON.stringify(gltf)), 0x20);
      var binBytes = new Uint8Array(totalBinLen);
      var cursor = 0;
      binaryParts.forEach(function(p){ binBytes.set(p, cursor); cursor += p.length; });
      var binPadded = padBytes(binBytes, 0x00);

      var totalLen = 12 + 8 + jsonBytes.length + 8 + binPadded.length;
      var header = new ArrayBuffer(12);
      var hv = new DataView(header);
      hv.setUint32(0, 0x46546C67, true);
      hv.setUint32(4, 2, true);
      hv.setUint32(8, totalLen, true);

      var jsonHeader = new ArrayBuffer(8);
      var jv = new DataView(jsonHeader);
      jv.setUint32(0, jsonBytes.length, true);
      jv.setUint32(4, 0x4E4F534A, true);

      var binHeader = new ArrayBuffer(8);
      var bv = new DataView(binHeader);
      bv.setUint32(0, binPadded.length, true);
      bv.setUint32(4, 0x004E4942, true);

      return new Blob([header, jsonHeader, jsonBytes, binHeader, binPadded], { type:'model/gltf-binary' });
    }

    async function exportGLB(){
      if(!scene3d || !foldRoot) throw new Error('Build 3D first');
      scene3d.updateMatrixWorld(true);
      var blob = buildGLBBlobFromCurrentView();
      var out = await saveBlobWithDialog(blob, 'tesseract_model.glb');
      if(out && out.cancelled){
        setStatus('GLB export cancelled');
      }else if(out && out.fallback){
        setStatus('GLB exported with browser download fallback');
      }else if(out && out.path){
        setStatus('GLB saved: ' + out.path);
      }else{
        setStatus('GLB exported');
      }
      return blob;
    }

    /* ================================================================
       EVENT HANDLERS
       ================================================================ */
    if(!ensureCep()) return;

    showImport();
    resetValidationUI();
    setDebugVisible(debugToggle.checked);
    syncMaterialInputs();
    setArtStatus('Looks for Front/Back or Tiro/Retiro as artboards or layers. Mapping is aligned to the full artboard.','No art');
    setInteractionMode('fold', false);

    testBtn.addEventListener('click',function(){
      setStatus('Testing...');
      var jsx='(function(){ return "OK_FROM_ILLUSTRATOR"; })();';
      window.__adobe_cep__.evalScript(jsx,function(result){
        setStatus((result&&String(result).trim())?result:'No result returned');
      });
    });

    extractBtn.addEventListener('click',function(){
      setStatus('Extracting...');
      outputArea.value='';
      resetValidationUI();

      window.__adobe_cep__.evalScript(EXTRACT_SCRIPT,function(result){
        try{
          if(!result || result==='undefined' || result==='null' || result==='EvalScript error.'){
            setStatus('Error: ' + String(result || 'No result returned'));
            return;
          }
          var parsed = JSON.parse(result);
          if(parsed.error){
            lastData = parsed;
            outputArea.value = result;
            if(debugToggle.checked) setDebugVisible(true);
            setStatus(parsed.error);
            return;
          }
          lastData = parsed;
          outputArea.value = JSON.stringify(parsed, null, 2);
          if(debugToggle.checked) setDebugVisible(true);
          validateGeometry(parsed);
          render2D(parsed);
          setStatus('Extraction complete');
        }catch(err){
          outputArea.value = String(result || '');
          if(debugToggle.checked) setDebugVisible(true);
          setStatus('Parse error: ' + err.message);
          log('Parse error: ' + err.message);
        }
      });
    });

    previewBtn.addEventListener('click', function(){
      if(!lastData || lastData.error){
        setStatus('Nothing to preview. Extract first.');
        return;
      }
      render2D(lastData);
      setStatus('2D preview updated');
    });

    continueBtn.addEventListener('click', function(){
      if(!lastData || lastData.error){
        setStatus('Nothing to build. Extract first.');
        return;
      }
      clearLog();
      show3D();
      setStatus('Preparing 3D...');

      if(!init3D()){
        setStatus('3D init failed');
        return;
      }

      try{
        var panelData = buildPanels(lastData);
        if(!panelData || !panelData.panels || panelData.panels.length===0){
          setStatus('No 3D panels could be generated from the dieline');
          return;
        }
        currentPanelData = panelData;
        if(currentBasePanelIndex<0 || currentBasePanelIndex>=panelData.panels.length){
          currentBasePanelIndex = getDefaultBaseIndex(panelData);
        }
        var built = build3DFromPanels(panelData, lastData);
        if(!built){
          setStatus('3D build failed');
          return;
        }
        buildFoldUI(panelData);
        fitCamera3D();
        setStatus('3D ready · thickness='+currentThicknessMm.toFixed(1)+'mm');
        refreshArtwork();
      }catch(err){
        log('3D error: ' + err.message);
        setStatus('3D error: ' + err.message);
      }
    });

    applyThicknessBtn.addEventListener('click', function(){
      var parsed = parseFloat(thicknessInput.value);
      if(!isFinite(parsed) || parsed<=0){
        setStatus('Thickness must be greater than 0');
        syncMaterialInputs();
        return;
      }
      currentThicknessMm = Math.max(0.1, Math.min(parsed, 20));
      syncMaterialInputs();
      if(!currentPanelData){
        setStatus('Thickness updated. Build 3D to apply it.');
        return;
      }
      try{
        var built = build3DFromPanels(currentPanelData, lastData);
        if(!built){
          setStatus('3D rebuild failed');
          return;
        }
        buildFoldUI(currentPanelData);
        fitCamera3D();
        setStatus('Thickness applied: '+currentThicknessMm.toFixed(1)+'mm');
        applyArtworkToScene();
      }catch(err){
        log('Rebuild error: '+err.message);
        setStatus('Rebuild error: '+err.message);
      }
    });

    backBtn.addEventListener('click', function(){
      showImport();
      setStatus('Back to import');
    });

    export3dBtn.addEventListener('click', function(){
      exportPNG();
      setStatus('3D PNG exported');
    });

    exportGlbBtn.addEventListener('click', async function(){
      try{
        setStatus('Exporting GLB…');
        await exportGLB();
        setStatus('GLB exported from current 3D pose');
      }catch(err){
        log('GLB export failed: '+err.message);
        if(debugDetails) debugDetails.open = true;
        setStatus('GLB export failed: '+err.message);
      }
    });

    if(materialPresetSelect){
      materialPresetSelect.addEventListener('change', function(){
        applyMaterialPreset(materialPresetSelect.value, true);
      });
    }

    if(refreshArtBtn){
      refreshArtBtn.addEventListener('click', function(){
        refreshArtwork();
      });
    }

    if(tabButtons.length){
      tabButtons.forEach(function(btn){
        btn.addEventListener('click', function(){
          setActiveTab(btn.dataset.tab);
        });
      });
    }

    if(modeFoldBtn){
      modeFoldBtn.addEventListener('click', function(){ setInteractionMode('fold', true); });
    }

    if(modeBaseBtn){
      modeBaseBtn.addEventListener('click', function(){ setInteractionMode('base', true); });
    }

    document.addEventListener('keydown', function(ev){
      if(!threeView || threeView.style.display==='none') return;
      var tag=(ev.target && ev.target.tagName ? ev.target.tagName.toLowerCase() : '');
      if(tag==='input' || tag==='textarea' || ev.target.isContentEditable) return;
      var key=(ev.key||'').toLowerCase();
      if(key==='escape'){ ev.preventDefault(); setInteractionMode('fold', true); }
    });

    debugToggle.addEventListener('change', function(){
      setDebugVisible(!!debugToggle.checked);
    });

  });
})();
