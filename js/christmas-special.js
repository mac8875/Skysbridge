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
    #christmas-special-sleigh{position:absolute;top:12px;left:12px;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100px;min-height:56px;padding:4px;text-decoration:none;color:#f7dfab;border-radius:8px;background:#07121eaa;touch-action:manipulation}
    #christmas-special-sleigh[hidden]{display:none!important}
    #christmas-special-sleigh svg{width:82px;height:35px;overflow:visible;filter:drop-shadow(0 0 5px #e6c78d55);animation:christmas-sleigh-float 7s ease-in-out infinite}
    #christmas-special-sleigh span{font-size:10px;line-height:1.15;text-align:center}
    #christmas-special-link:focus-visible,#christmas-special-sleigh:focus-visible{outline:2px solid #f6d79b;outline-offset:3px}
    @keyframes christmas-sleigh-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
    @media(prefers-reduced-motion:reduce){#christmas-special-sleigh svg{animation:none}}
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
  sleigh.innerHTML = '<svg viewBox="0 0 116 48" aria-hidden="true" focusable="false"><g fill="none" stroke="#f0d099" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M7 13l3 4m-3 0 3-4M22 4v8m-4-4h8M1 29h18M11 35h16" opacity=".7"/><path d="M33 17q-7 0-10 6l9 1q4 10 15 13h43q15 0 19-13l-12 2H64q-8-2-9-12z" fill="#a33839"/><path d="M40 37l4 5h48q12 0 15-8M35 43h62"/><path d="M60 25q-3-8 0-15l8-4 7 5 1 14" fill="#b34141"/><circle cx="68" cy="8" r="5" fill="#f7dfae"/><path d="M61 7q0-10 13-3l5 1-5 3z" fill="#b34141"/><path d="M64 11q4 6 9 0" stroke="#fff3d8" stroke-width="3"/><path d="M79 24q-3-12 8-14 12-1 12 16" fill="#ad874f"/><path d="M83 11l8 1"/></g></svg>';
  const caption = document.createElement("span"); caption.textContent = words.sleigh;
  sleigh.append(caption); wall.append(sleigh);
  toggle.addEventListener("change", () => { sleigh.hidden = !toggle.checked; });
})();
