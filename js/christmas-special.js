/* Seasonal web-only addition; no memorial or account data accessed. */
(() => {
  "use strict";
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() || ["android","ios"].includes(cap?.getPlatform?.()) ||
      ["capacitor:","ionic:","file:"].includes(location.protocol) ||
      ["localhost","127.0.0.1"].includes(location.hostname) || /\bCapacitor\b/i.test(navigator.userAgent)) return;
  const artwork = `<svg viewBox="0 0 244 96" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="sbGold" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fff4cf"/><stop offset=".42" stop-color="#eac78b"/><stop offset="1" stop-color="#a66f35"/></linearGradient>
  <linearGradient id="sbRed" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d45c61"/><stop offset=".5" stop-color="#a3263e"/><stop offset="1" stop-color="#59152b"/></linearGradient>
  <linearGradient id="sbTrace"><stop stop-color="#f3d59b" stop-opacity="0"/><stop offset=".8" stop-color="#efd8a1" stop-opacity=".6"/><stop offset="1" stop-color="#fff0ce" stop-opacity=".85"/></linearGradient>
  <g id="sbDeer" fill="url(#sbGold)" stroke="#f2d69d" stroke-width=".6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M4 38Q1 33 0 33L5 31Q10 25 22 27L34 28 39 17 44 11 49 13 49 19 55 20 57 23 52 26 43 24 38 37 34 41 23 42 11 41Z"/>
    <path d="M12 39 8 47 0 51-2 49 6 43 8 36M20 40 24 47 32 49 32 51 22 50 16 43M33 38 39 45 47 44 48 47 38 49 30 42M37 36 45 40 54 37 56 39 46 43 37 41"/>
    <path d="M43 12 39 4 35 1M39 4 43 0M48 13 51 5 56 2M51 5 51 0M51 5 58 7" fill="none" stroke="#e8c48a" stroke-width="1.65"/>
    <circle cx="49" cy="19" r="1" fill="#332030" stroke="none"/>
    <path d="M39 29 44 30" stroke="#a53649" stroke-width="2.3"/>
  </g>
</defs>
<g fill="none" stroke-linecap="round">
  <path d="M0 63Q19 55 47 59" stroke="url(#sbTrace)" stroke-width="2.3"/>
  <path d="M9 71Q31 64 50 65" stroke="url(#sbTrace)" stroke-width="1"/>
</g>
<g fill="#ffe8b6"><circle cx="10" cy="51" r="1.1" opacity=".65"/><circle cx="27" cy="71" r="1.3" opacity=".9"/><path d="M23 40l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5z"/><circle cx="5" cy="78" r=".8"/></g>
<g stroke-linecap="round" stroke-linejoin="round">
  <path d="M103 46Q128 48 147 36T205 30" fill="none" stroke="#edca8e" stroke-width="1.15"/>
  <use href="#sbDeer" x="120" y="15"/>
  <use href="#sbDeer" x="180" y="5"/>
  <path d="M94 50Q132 47 157 45L218 35" fill="none" stroke="#d9b47a" stroke-width=".85" opacity=".9"/>
  <path d="M53 52Q42 41 47 34Q52 27 61 33L70 47Q75 53 85 53H107Q116 53 118 44L124 43Q126 65 110 72H66Q51 72 48 60Z" fill="url(#sbRed)" stroke="url(#sbGold)" stroke-width="2"/>
  <path d="M53 48Q56 60 68 62H106Q115 62 121 53M61 68H110" fill="none" stroke="#f4d49a" stroke-width="1.35"/>
  <path d="M56 72L53 81M105 72L110 81M43 81H114Q127 81 131 70Q134 62 128 63M43 81Q35 81 35 75" fill="none" stroke="url(#sbGold)" stroke-width="3"/>
  <path d="M57 47Q49 35 54 26Q62 22 71 31L76 47" fill="#b79a65" stroke="#edcc91" stroke-width="1.1"/>
  <path d="M56 28 64 28" stroke="#ffe4ad" stroke-width="1.5"/>
  <path d="M79 51Q72 37 80 27L90 24 98 32 100 53" fill="url(#sbRed)" stroke="#edca8c" stroke-width="1.35"/>
  <path d="M80 31Q88 32 94 36L105 43" fill="none" stroke="#d45761" stroke-width="7"/>
  <path d="M102 41 108 44" stroke="#fff0da" stroke-width="3.4"/>
  <circle cx="89" cy="20" r="8" fill="#eec6a1" stroke="#f4d6ad" stroke-width=".8"/>
  <path d="M82 17Q80 7 88 5Q95 5 100 15L94 13 92 17Z" fill="url(#sbRed)" stroke="#e8c48a" stroke-width="1"/>
  <path d="M81 17H95M83 24Q89 34 95 23" fill="none" stroke="#fff1dc" stroke-width="3.6"/>
  <circle cx="100" cy="14" r="2.3" fill="#fff1dc"/>
</g></svg>`;
  const random = (min,max) => min + Math.random() * (max-min);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function attachFlight(el, area, enabled = () => true) {
    let flight = null, timer = null, focused = false, hover = false;
    el.innerHTML = artwork;
    const graphic = el.querySelector("svg");
    const clear = () => {
      clearTimeout(timer); timer = null;
      if (flight) { flight.onfinish = null; flight.cancel(); flight = null; }
    };
    const position = (x,y) => "translate3d(" + x + "px," + y + "px,0)";
    const parked = () => {
      const x = Math.max(4, (area.clientWidth - el.offsetWidth) * .5);
      const y = Math.max(3, Math.min(area.clientHeight - el.offsetHeight - 3, area.clientHeight * .12));
      el.style.transform = position(x,y);
      el.style.opacity = "1"; el.style.pointerEvents = "auto";
      graphic.style.transform = "";
    };
    const idle = () => {
      el.style.transform = position(-el.offsetWidth - 20,0);
      el.style.opacity = "0"; el.style.pointerEvents = "none";
    };
    function schedule(delay) {
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    }
    function run() {
      clear();
      if (!enabled()) { idle(); return; }
      if (focused || motion.matches || typeof el.animate !== "function") { parked(); return; }
      if (document.hidden || !area.clientWidth || !area.clientHeight) { idle(); schedule(1200); return; }
      const w = area.clientWidth, h = area.clientHeight, ew = el.offsetWidth, eh = el.offsetHeight;
      const pad = Math.min(28, Math.max(4,(h-eh)*.12));
      const low = pad, high = Math.max(low,h-eh-pad);
      const startY = random(low,high), endY = random(low,high);
      const middleY = Math.max(low,Math.min(high,(startY+endY)/2 + random(-1,1)*Math.min(85,(high-low)*.35)));
      const reverse = Math.random() < .5, from = reverse ? w+ew*.15 : -ew-12, to = reverse ? -ew-12 : w+ew*.15;
      graphic.style.transform = reverse ? "scaleX(-1)" : "";
      el.style.opacity = "1"; el.style.pointerEvents = "auto";
      flight = el.animate([
        {transform:position(from,startY),opacity:0,offset:0},
        {transform:position(from+(to-from)*.09,startY+(middleY-startY)*.18),opacity:1,offset:.09},
        {transform:position((from+to)/2,middleY),opacity:1,offset:.5},
        {transform:position(from+(to-from)*.91,endY+(middleY-endY)*.18),opacity:1,offset:.91},
        {transform:position(to,endY),opacity:0,offset:1}
      ],{duration:random(8500,14000),easing:"linear",fill:"both"});
      if (hover) flight.pause();
      flight.onfinish = () => { clear(); idle(); schedule(random(4500,12000)); };
    }
    el.addEventListener("focus",() => { if(!el.matches(":focus-visible")) return; focused=true; clear(); if(enabled()) parked(); });
    el.addEventListener("blur",() => { if(!focused) return; focused=false; run(); });
    el.addEventListener("pointerenter",event => { if(event.pointerType==="mouse"){hover=true;flight?.pause();} });
    el.addEventListener("pointerleave",event => { if(event.pointerType==="mouse"){hover=false;flight?.play();} });
    motion.addEventListener?.("change",run);
    let resizeTimer;
    window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(run,180);},{passive:true});
    document.addEventListener("visibilitychange",()=>{if(document.hidden){clear();idle();}else run();});
    idle(); schedule(350);
    return run;
  }
  const style = document.createElement("style");
  style.textContent = `
    #christmas-special-link{display:inline-flex;align-items:center;gap:.5rem;color:#f1d7a2;text-decoration:none;font-size:14px;margin:0 0 12px;padding:8px 16px;border:1px solid #e6c78d66;border-radius:30px;line-height:1.4;max-width:100%;background:#11243a}
    #christmas-special-link:hover{color:#fff2d1}
    #christmas-special-sleigh,.sky-objects #sleigh{position:absolute;top:0;left:0;display:flex;align-items:center;justify-content:center;width:174px;height:70px;padding:0;border:0;background:transparent;color:#f7dfab;touch-action:manipulation;opacity:0;will-change:transform}
    #christmas-special-sleigh{z-index:4;text-decoration:none}
    #christmas-special-sleigh[hidden]{display:none!important}
    #christmas-special-sleigh svg,.sky-objects #sleigh svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 5px #e6c78d55);pointer-events:none}
    #christmas-special-sleigh:hover,.sky-objects #sleigh:hover{filter:brightness(1.12)}
    #christmas-special-link:focus-visible,#christmas-special-sleigh:focus-visible,.sky-objects #sleigh:focus-visible{outline:2px solid #f6d79b;outline-offset:3px;border-radius:5px}
    @media(max-width:600px){#christmas-special-sleigh,.sky-objects #sleigh{width:142px;height:56px}}
  `;
  document.head.append(style);
  const pageSleigh = document.querySelector(".sky-objects #sleigh");
  if (pageSleigh) { attachFlight(pageSleigh,pageSleigh.parentElement); return; }
  const now = new Date();
  if (now.getMonth() !== 11 && !(now.getMonth() === 10 && now.getDate() >= 24)) return;
  if (now.getMonth() === 11 && now.getDate() > 26) return;
  const wall = document.querySelector("#memorialGrid");
  const settings = document.querySelector(".sky-layer-settings");
  if (!wall || !settings || document.getElementById("christmas-special-link")) return;
  const lang = document.documentElement.lang.toLowerCase().slice(0,2);
  const words = ({
    de:{title:"Weihnachten im Sternenhimmel",sleigh:"Weihnachtsschlitten"},
    en:{title:"Christmas in the Stars",sleigh:"Santa’s sleigh"},
    es:{title:"Navidad entre las estrellas",sleigh:"Trineo navideño"}
  })[lang] || {title:"Christmas in the Stars",sleigh:"Santa’s sleigh"};
  const url = "christmas.html?lang=" + (["de","en","es"].includes(lang) ? lang : "en");
  const link = document.createElement("a");
  link.id = "christmas-special-link"; link.href = url; link.textContent = "✦ " + words.title;
  settings.insertAdjacentElement("beforebegin", link);
  const label = document.createElement("label");
  label.className = "sky-layer-toggle";
  const toggle = document.createElement("input");
  toggle.type = "checkbox"; toggle.checked = true; toggle.setAttribute("aria-controls","christmas-special-sleigh");
  const labelText = document.createElement("span"); labelText.textContent = words.sleigh;
  label.append(toggle,labelText); settings.append(label);
  const sleigh = document.createElement("a");
  sleigh.id = "christmas-special-sleigh"; sleigh.href = url;
  sleigh.setAttribute("aria-label",words.sleigh + " – " + words.title);
  wall.append(sleigh);
  const restart = attachFlight(sleigh,wall,()=>toggle.checked);
  toggle.addEventListener("change",()=>{sleigh.hidden=!toggle.checked;restart();});
})();
