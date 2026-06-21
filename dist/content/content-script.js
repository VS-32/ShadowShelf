(function(){"use strict";const x=[{pattern:/github\.com|stackoverflow\.com|developer\.|docs\.|learn\.|tutorial|coursera|udemy|edx|khanacademy|w3schools|mdn|freecodecamp|geeksforgeeks|leetcode|hackerrank|pandas|numpy|pytorch|tensorflow|arxiv\.org|wikipedia\.org|medium\.com|dev\.to|hashnode|towardsdatascience/,category:"Learning"},{pattern:/linkedin\.com|slack\.com|notion\.so|trello\.com|jira|asana\.com|monday\.com|confluence|zoom\.us|teams\.microsoft|figma\.com|gitlab|bitbucket|vercel|netlify|heroku|aws\.amazon|cloud\.google|azure\.microsoft|powerbi/,category:"Work"},{pattern:/youtube\.com|netflix\.com|primevideo|hotstar|spotify\.com|twitch\.tv|hulu\.com|disneyplus|reddit\.com|9gag|imgur|tiktok|anime|manga|steam\.com|epicgames|xbox|playstation/,category:"Entertainment"},{pattern:/facebook\.com|instagram\.com|twitter\.com|x\.com|snapchat|pinterest|tumblr|whatsapp|telegram\.org|discord\.com|threads\.net|mastodon/,category:"Social Media"},{pattern:/amazon\.|flipkart\.com|myntra\.com|meesho|ebay\.com|etsy\.com|walmart|target\.com|shopify|swiggy|zomato|blinkit|zepto|nykaa|ajio/,category:"Shopping"},{pattern:/zerodha|groww\.in|upstox|angelone|kuvera|paytm|phonepe|googlepay|razorpay|icicibank|hdfcbank|sbibank|kotak|axisbank|bankofbaroda|moneycontrol|economictimes\.com|nseindia|bseindia|mutualfund|emi|loan|insurance/,category:"Finance"},{pattern:/bbc\.com|cnn\.com|ndtv\.com|thehindu\.com|hindustantimes|timesofindia|indianexpress|theguardian|nytimes|washingtonpost|reuters\.com|apnews|bloomberg|techcrunch|theverge|wired\.com|engadget|arstechnica/,category:"News"}];function v(e,t){const o=`${e} ${t}`.toLowerCase();for(const{pattern:a,category:n}of x)if(a.test(o))return n;return"Other"}function E(e){try{return new URL(e).hostname.replace(/^www\./,"")}catch{return e}}let p=!0,u=!0,f=!1,g=[],s=!1,b=0,y=0;function w(){y++,y>=2&&_()}chrome.storage.local.get(["timerRunning"],e=>{s=e.timerRunning??!1,w()}),chrome.storage.sync.get(["highlightEnabled","clipboardEnabled","focusBlockEnabled","blockedDomains"],e=>{p=e.highlightEnabled??!0,u=e.clipboardEnabled??!0,f=e.focusBlockEnabled??!1,g=e.blockedDomains??[],w()}),chrome.storage.onChanged.addListener((e,t)=>{t==="sync"&&("highlightEnabled"in e&&(p=e.highlightEnabled.newValue),"clipboardEnabled"in e&&(u=e.clipboardEnabled.newValue),"focusBlockEnabled"in e&&(f=e.focusBlockEnabled.newValue??!1),"blockedDomains"in e&&(g=e.blockedDomains.newValue??[])),t==="local"&&"timerRunning"in e&&(s=e.timerRunning.newValue??!1,s?_():c())});function k(e){const t=new Date(e);return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`}function c(){var e;(e=document.getElementById("__shadowshelf_blocker__"))==null||e.remove()}async function _(){if(!f||!s||Date.now()<b||document.getElementById("__shadowshelf_blocker__"))return;const e=location.hostname.replace(/^www\./,"");if(!g.some(a=>{const n=a.trim().toLowerCase().replace(/^www\./,"");return n&&(e===n||e.endsWith("."+n))}))return;const o=await chrome.runtime.sendMessage({type:"GET_TIMER"}).catch(()=>null);S(e,(o==null?void 0:o.computedRemainingMs)??0)}function S(e,t){var l,d;c();const o=document.createElement("div");o.id="__shadowshelf_blocker__",o.style.cssText=["position:fixed","inset:0","z-index:2147483647","background:#0d1117","display:flex","align-items:center","justify-content:center","font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif"].join(";"),o.innerHTML=`
<div style="text-align:center;max-width:440px;padding:40px 28px;">
  <div style="font-size:60px;line-height:1;margin-bottom:20px">🔒</div>
  <h1 style="font-size:28px;font-weight:800;color:#f1f5f9;margin:0 0 10px;letter-spacing:-0.03em">
    Focus Mode Active
  </h1>
  <p style="font-size:15px;color:#475569;margin:0 0 6px">
    <span style="color:#94a3b8;font-weight:600">${e}</span> is blocked during your session.
  </p>
  <p style="font-size:13px;color:#334155;margin:0 0 32px">
    Session ends in <span id="__ss_cd__" style="color:#06b6d4;font-weight:700;font-variant-numeric:tabular-nums">--:--</span>
  </p>
  <div style="display:flex;flex-direction:column;gap:10px">
    <button id="__ss_back__" style="padding:13px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#06b6d4,#0ea5e9);color:#fff;font-size:14px;font-weight:700;font-family:inherit;letter-spacing:-0.01em">
      ← Go Back
    </button>
    <button id="__ss_override__" style="padding:10px 20px;border-radius:10px;cursor:pointer;background:rgba(255,255,255,0.04);color:#475569;border:1px solid rgba(255,255,255,0.08);font-size:12px;font-weight:600;font-family:inherit">
      Access Anyway (5 min)
    </button>
  </div>
  <div style="margin-top:28px;font-size:11px;color:#1e293b">Powered by ShadowShelf</div>
</div>`,document.documentElement.appendChild(o),(l=o.querySelector("#__ss_back__"))==null||l.addEventListener("click",()=>{history.length>1?history.back():window.close()}),(d=o.querySelector("#__ss_override__"))==null||d.addEventListener("click",()=>{b=Date.now()+5*6e4,c()});let a=t;const n=o.querySelector("#__ss_cd__"),h=setInterval(()=>{a=Math.max(0,a-1e3);const m=Math.floor(a/6e4),T=Math.floor(a%6e4/1e3);n&&(n.textContent=`${String(m).padStart(2,"0")}:${String(T).padStart(2,"0")}`),a<=0&&(clearInterval(h),c())},1e3)}let i=null;function r(){i==null||i.remove(),i=null}document.addEventListener("mouseup",()=>{if(!p){r();return}const e=window.getSelection(),t=e==null?void 0:e.toString().trim();if(!t||t.length<10){r();return}r();const a=e.getRangeAt(0).getBoundingClientRect(),n=document.createElement("div");n.id="__shadowshelf_tooltip__",n.style.cssText=`
    position: fixed;
    top: ${a.top+window.scrollY-42}px;
    left: ${a.left+a.width/2}px;
    transform: translateX(-50%);
    background: #06b6d4;
    color: #fff;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    white-space: nowrap;
    user-select: none;
  `,n.textContent="📌 Save Highlight",n.addEventListener("click",async h=>{h.stopPropagation();const l=E(location.href),d=v(location.href,document.title),m=Date.now();await chrome.runtime.sendMessage({type:"SAVE_HIGHLIGHT",payload:{text:t,url:location.href,title:document.title,domain:l,category:d,timestamp:m,date:k(m)}}),n.textContent="✓ Saved!",n.style.background="#16a34a",setTimeout(r,1200)}),document.body.appendChild(n),i=n}),document.addEventListener("mousedown",e=>{e.target.id!=="__shadowshelf_tooltip__"&&r()});const z=/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$|^\d{6}$|password|otp/i,B=/^https?:\/\//i,R=/^[+]?[\d\s\-()]{7,15}$/;document.addEventListener("copy",async()=>{if(u)try{await new Promise(a=>setTimeout(a,50));const e=await navigator.clipboard.readText();if(!(e!=null&&e.trim())||z.test(e))return;let t="text";B.test(e)?t="url":R.test(e.trim())&&(t="phone");const o=Date.now();chrome.runtime.sendMessage({type:"SAVE_CLIPBOARD",payload:{content:e.trim(),type:t,timestamp:o,date:k(o)}})}catch{}})})();
