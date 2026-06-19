import{e as p,a as m}from"../assets/categorize-B65gRhjX.js";let a=null;function s(){a==null||a.remove(),a=null}document.addEventListener("mouseup",()=>{const t=window.getSelection(),o=t==null?void 0:t.toString().trim();if(!o||o.length<10){s();return}s();const n=t.getRangeAt(0).getBoundingClientRect(),e=document.createElement("div");e.id="__shadowshelf_tooltip__",e.style.cssText=`
    position: fixed;
    top: ${n.top+window.scrollY-42}px;
    left: ${n.left+n.width/2}px;
    transform: translateX(-50%);
    background: #4f65f8;
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
  `,e.textContent="📌 Save Highlight",e.addEventListener("click",async d=>{d.stopPropagation();const c=p(location.href),l=m(location.href,document.title),r=Date.now();await chrome.runtime.sendMessage({type:"SAVE_HIGHLIGHT",payload:{text:o,url:location.href,title:document.title,domain:c,category:l,timestamp:r,date:new Date(r).toISOString().slice(0,10)}}),e.textContent="✓ Saved!",e.style.background="#16a34a",setTimeout(s,1200)}),document.body.appendChild(e),a=e});document.addEventListener("mousedown",t=>{t.target.id!=="__shadowshelf_tooltip__"&&s()});const u=/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$|^\d{6}$|password|otp/i,f=/^https?:\/\//i,g=/^[+]?[\d\s\-()]{7,15}$/;document.addEventListener("copy",async()=>{try{await new Promise(n=>setTimeout(n,50));const t=await navigator.clipboard.readText();if(!(t!=null&&t.trim())||u.test(t))return;let o="text";f.test(t)?o="url":g.test(t.trim())&&(o="phone");const i=Date.now();chrome.runtime.sendMessage({type:"SAVE_CLIPBOARD",payload:{content:t.trim(),type:o,timestamp:i,date:new Date(i).toISOString().slice(0,10)}})}catch{}});
