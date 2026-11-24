/* Seasonal web-only addition; no memorial or account data accessed. */
(() => {
  "use strict";
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.() || ["android","ios"].includes(cap?.getPlatform?.()) ||
      ["capacitor:","ionic:","file:"].includes(location.protocol) ||
      ["localhost","127.0.0.1"].includes(location.hostname) || /\bCapacitor\b/i.test(navigator.userAgent)) return;
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
  const style = document.createElement("style");
  style.textContent = `
    #christmas-special-link{display:inline-flex;align-items:center;gap:.5rem;color:#f1d7a2;text-decoration:none;font-size:14px;margin:0 0 12px;padding:8px 16px;border:1px solid #e6c78d66;border-radius:30px;line-height:1.4;max-width:100%;background:#11243a}
    #christmas-special-link:hover,#christmas-special-sleigh:hover{color:#fff2d1}
    #christmas-special-sleigh{position:absolute;top:10%;left:-150px;z-index:4;display:flex;align-items:center;justify-content:center;width:132px;height:62px;padding:0;border:0;background:transparent;text-decoration:none;color:#f7dfab;touch-action:manipulation;animation:christmas-sleigh-flight 21s linear infinite;opacity:0}
    #christmas-special-sleigh[hidden]{display:none!important}
    #christmas-special-sleigh svg{display:block;width:132px;height:62px;overflow:visible;filter:drop-shadow(0 0 5px #e6c78d66);pointer-events:none}
    #christmas-special-sleigh::before{content:"";position:absolute;right:76%;top:58%;width:85px;height:8px;border-radius:50%;background:linear-gradient(90deg,transparent,#ead09b55,#fff1c9aa);filter:blur(3px);pointer-events:none}
    #christmas-special-sleigh:hover{animation-play-state:paused;filter:brightness(1.12)}
    #christmas-special-link:focus-visible,#christmas-special-sleigh:focus-visible{outline:2px solid #f6d79b;outline-offset:3px}
    #christmas-special-sleigh:focus-visible{animation:none;left:12px;top:10%;opacity:1}
    @keyframes christmas-sleigh-flight{0%{left:-150px;top:14%;opacity:0} 5%{opacity:1} 23%{left:24%;top:7%;opacity:1} 43%{left:57%;top:14%;opacity:1} 60%{left:calc(100% + 130px);top:6%;opacity:1} 61%,100%{left:calc(100% + 130px);top:6%;opacity:0}}
    @media(max-width:600px){#christmas-special-sleigh{width:108px;height:52px}#christmas-special-sleigh svg{width:108px;height:52px}#christmas-special-sleigh::before{width:55px}}
    @media(prefers-reduced-motion:reduce){#christmas-special-sleigh{animation:none;left:12px;top:10%;opacity:1}}
  `;
  document.head.append(style);
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
  sleigh.innerHTML = `<svg viewBox="0 0 180 80" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sbSleighGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff5d0"/><stop offset=".45" stop-color="#eac681"/><stop offset="1" stop-color="#bd7834"/></linearGradient><linearGradient id="sbSleighRed" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#db5359"/><stop offset="1" stop-color="#6c182b"/></linearGradient><linearGradient id="sbSleighTrail"><stop stop-color="#e8c98a" stop-opacity="0"/><stop offset="1" stop-color="#fff1bc" stop-opacity=".8"/></linearGradient></defs>
<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M2 56Q23 45 48 49" stroke="url(#sbSleighTrail)" stroke-width="2"/><path d="M10 63Q30 55 48 55" stroke="url(#sbSleighTrail)" stroke-width="1"/>
<g fill="#fff0c0" stroke="none"><path d="M15 35l1.4 4.6 4.6 1.4-4.6 1.4-1.4 4.6-1.4-4.6-4.6-1.4 4.6-1.4z"/><circle cx="27" cy="59" r="1.5"/><circle cx="6" cy="50" r="1"/><circle cx="35" cy="38" r="1.4"/></g>
<g stroke="url(#sbSleighGold)" stroke-width="2"><path d="M43 31Q35 25 34 36l5 18q2 8 12 8h47q12 0 18-12l-10 4H76q-10-1-13-17l-5-12q-5-5-15 6Z" fill="url(#sbSleighRed)"/><path d="M43 33q7-7 14 0l7 12M49 57h53"/><path d="M42 64l-2 7m56-9 3 8M35 72h71q13 0 16-10M35 72q-7 0-7-5"/><path d="M66 45q-5-13 4-20l9-3 9 9 2 14" fill="url(#sbSleighRed)"/><path d="M69 28q-6 0-10 5" stroke="#fff3d9" stroke-width="3"/><circle cx="77" cy="20" r="7" fill="#f5d0a0" stroke-width="1"/><path d="M69 17q1-10 9-12 6 1 11 12l-7-3-10 3z" fill="url(#sbSleighRed)"/><path d="M68 17h15M73 23q5 9 10 0" stroke="#fff4de" stroke-width="3"/><circle cx="90" cy="16" r="2" fill="#fff4de" stroke="none"/><path d="M47 44q-8-15 3-20 8 2 11 20" fill="#a58048"/><path d="M52 25l-5 4"/>
<path d="M94 35Q118 31 139 36" stroke-width="1.1"/><g fill="#d8b475" stroke="#f7dca2" stroke-width="1.2"><path d="M126 39q7-8 20-5l6-11 6 2-2 8 7 3-4 5-11-1-5 7-16-1-7-5z"/><path d="M130 45l-8 9-5 2m21-10 6 9 7 1m-1-13 9 7 5-1m-40-8-7-6" fill="none" stroke-width="2"/><path d="M153 24l-2-8-5-4m5 4 5-6m2 15 5-9 4-2m-4 2 1-6" fill="none" stroke-width="1.5"/></g><circle cx="162" cy="36" r="1.6" fill="#e85e60" stroke="none"/></g></g></svg>`;
  wall.append(sleigh);
  toggle.addEventListener("change", () => { sleigh.hidden = !toggle.checked; });
})();
