/**
 * Safe patch: visible tooltips + autoload presets (fixed parens).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');

const root = __dirname;
const bundlePath = path.join(root, 'app-extracted', 'dist', 'bundle.js');
const htmlPath = path.join(root, 'app-extracted', 'app.html');
const cssPath = path.join(root, 'app-extracted', 'dist', 'style.css');

let b = fs.readFileSync(bundlePath, 'utf8');
let html = fs.readFileSync(htmlPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

function mustReplace(label, oldStr, newStr) {
  const i = b.indexOf(oldStr);
  if (i < 0) {
    console.error('FAIL', label);
    process.exit(1);
  }
  b = b.slice(0, i) + newStr + b.slice(i + oldStr.length);
  console.log('OK', label);
}

function addTip(labelText, tip) {
  const needle = "},void 0,'" + labelText + "')";
  const i = b.indexOf(needle);
  if (i < 0) {
    console.warn('SKIP missing', labelText);
    return;
  }
  if (b.slice(Math.max(0, i - 120), i).includes('title:')) {
    console.log('SKIP already', labelText);
    return;
  }
  const safe = tip.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const neu = ",title:'" + safe + "'},void 0,'" + labelText + "')";
  b = b.slice(0, i) + neu + b.slice(i + needle.length);
  console.log('OK tip', labelText);
}

const oldConnect =
  "console.log('identity OK - NOT full-sync (avoids bricking USB)');Oe((0,oe.setConnected)(!0));return Ae('activate',{preset:{id:1}}).then(function(r){console.log('activate1',r);return true},function(){return true})";

const newConnect =
  "console.log('identity OK - loading presets from INSTRUMENT 1');Oe((0,oe.setConnected)(!0));" +
  "return Ae('get',{general:{}}).then(function(gRes){" +
  "if(gRes&&gRes.data&&gRes.data.general){Oe((0,ue.generalSet)(gRes.data.general,!0));console.log('general loaded')}" +
  "}).catch(function(e){console.log('general load err',e)}).then(function(){" +
  "var chain=Promise.resolve();" +
  "function fromDev(p){if(!p)return null;var out=Object.assign({},p);" +
  "switch(p.fingerboard_mode){case'string':out.mode=p.fretless?'fretless_string':'fretted_string';break;case'keyboard':out.mode='grid';break;case'pad':out.mode='pad';break;default:out.mode='fretted_string'}" +
  "switch(p.bridge_mode){case'pluck':out.method='strum';break;case'press':out.method='press';break;case'bow':out.method='bow';break;case'slide':out.method='slide';break;default:out.method='press'}" +
  "out.json_version='1.0.1';out.is_factory_preset=!1;return out}" +
  "[1,2,3,4,5,6,7,8].forEach(function(pid){chain=chain.then(function(){return Ae('get',{preset:{id:pid}}).then(function(r){var p=r&&r.data&&r.data.preset;if(!p){console.log('preset',pid,'missing');return}var ed=fromDev(p);ed.id=pid;Oe((0,ae.bankSetPreset)(ae.INSTRUMENT_BANK,ed));console.log('loaded #'+pid,ed.preset_name,ed.mode,ed.method)})})});" +
  "return chain}).then(function(){return Ae('get',{active_preset:{}}).then(function(ap){var aid=ap&&ap.data&&ap.data.active_preset&&(ap.data.active_preset.id||ap.data.active_preset);console.log('active_preset',aid);if(aid&&aid!=='edit_buffer'){Oe((0,oe.setActiveInfo)(ae.INSTRUMENT_BANK,aid,!0));return true}return Ae('activate',{preset:{id:1}}).then(function(){Oe((0,oe.setActiveInfo)(ae.INSTRUMENT_BANK,1,!0));return true})},function(){return Ae('activate',{preset:{id:1}})})}).then(function(){console.log('device presets load DONE');return true},function(e){console.log('device presets load err',e);return true})";

// Validate newConnect fragment in isolation
try {
  new vm.Script('function test(Ae,Oe,ue,ae,oe){' + newConnect + '}');
  console.log('autoload fragment OK');
} catch (e) {
  console.error('autoload fragment FAIL', e.message);
  process.exit(1);
}

mustReplace('autoload', oldConnect, newConnect);

addTip('Aftertouch Sensitivity', 'Pressure after a note is held - controls MIDI aftertouch / expression.');
addTip('Capo Step Size', 'Semitones moved per capo/transpose step. 1 = chromatic, 12 = octave.');
addTip('String Flip', 'Which side is string 1. Automatic follows the accelerometer.');
addTip('String Flip Override', 'Override String Flip for this preset only. No Override uses Instrument setting.');
addTip('Arpeggiator', 'When On, held notes play as an arpeggio based on Global Tempo.');
addTip('Arpeggiator Subdivider', 'Note division for the arpeggiator relative to Global Tempo.');
addTip('String Bending', 'Allow bending notes by sliding sideways on fretted strings.');
addTip('I1 Tilt', 'Enable tilt sensor as a MIDI expression source.');
addTip('MIDI Mode', 'Multi Channel = one MIDI channel per string. Single Channel = all notes on one channel.');
addTip('MIDI Pitch Bend Range', 'Pitch bend range in semitones (12 / 24 / 48).');
addTip('MIDI Program Changes', 'When On, the instrument knob can send MIDI program changes.');
addTip('Global Tempo', 'BPM used by the arpeggiator and tempo-synced features.');
addTip('Pulloff (replay on release)', 'On = lifting a finger re-triggers a note. Turn Off to stop replay when you release.');

try {
  new vm.Script(b);
  console.log('SYNTAX OK');
} catch (e) {
  console.error('SYNTAX FAIL', e.message);
  process.exit(1);
}

fs.writeFileSync(bundlePath, b);

if (!css.includes('artiphon-tooltip')) {
  css +=
    '\n.artiphon-tooltip{position:fixed;z-index:999999;max-width:280px;padding:8px 10px;background:#1e2430;color:#f2f4f8;font-size:12px;line-height:1.35;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.25);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease}\n.artiphon-tooltip.is-on{opacity:1;transform:translateY(0)}\n';
  fs.writeFileSync(cssPath, css);
  console.log('OK css');
}

if (!html.includes('artiphon-tooltip')) {
  html = html.replace(
    '</body>',
    `<script>
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    var tip=document.createElement('div');
    tip.className='artiphon-tooltip';
    document.body.appendChild(tip);
    var timer=null, current=null;
    function hide(){ tip.classList.remove('is-on'); current=null; }
    function show(el, text, ev){
      if(!text) return;
      tip.textContent=text;
      tip.classList.add('is-on');
      current=el;
      var tw=tip.offsetWidth||200, th=tip.offsetHeight||40;
      tip.style.left=Math.max(8, Math.min(window.innerWidth-tw-8, ev.clientX+14))+'px';
      tip.style.top=Math.max(8, Math.min(window.innerHeight-th-8, ev.clientY+14))+'px';
    }
    function findHit(el){
      var n=el;
      while(n && n!==document.body){
        if(n.getAttribute){
          var t=n.getAttribute('data-tip')||n.getAttribute('title');
          if(t) return {el:n, text:t};
        }
        n=n.parentNode;
      }
      return null;
    }
    document.addEventListener('mouseover', function(ev){
      var hit=findHit(ev.target);
      if(!hit){ clearTimeout(timer); if(current) hide(); return; }
      if(hit.el.getAttribute('title')){
        hit.el.setAttribute('data-tip', hit.el.getAttribute('title'));
        hit.el.removeAttribute('title');
      }
      clearTimeout(timer);
      var text=hit.el.getAttribute('data-tip')||hit.text;
      timer=setTimeout(function(){ show(hit.el, text, ev); }, 120);
    }, true);
    document.addEventListener('mousemove', function(ev){
      if(!current || !tip.classList.contains('is-on')) return;
      var tw=tip.offsetWidth||200, th=tip.offsetHeight||40;
      tip.style.left=Math.max(8, Math.min(window.innerWidth-tw-8, ev.clientX+14))+'px';
      tip.style.top=Math.max(8, Math.min(window.innerHeight-th-8, ev.clientY+14))+'px';
    }, true);
    document.addEventListener('mouseout', function(ev){
      if(!current) return;
      var to=ev.relatedTarget;
      if(to && current.contains && current.contains(to)) return;
      clearTimeout(timer);
      hide();
    }, true);
  });
})();
</script>
</body>`
  );
  fs.writeFileSync(htmlPath, html);
  console.log('OK html');
}

execSync(
  'npx --yes @electron/asar pack "' +
    path.join(root, 'app-extracted') +
    '" "' +
    path.join(root, 'app.asar') +
    '"',
  { stdio: 'inherit' }
);
console.log('PACKED');
