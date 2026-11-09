import{m as g}from"./index-CsymaBuK.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=g("Camera",[["path",{d:"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",key:"1tc9qg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]]);async function u(e,h=1600,m=.82){var r;if(!e.type.startsWith("image/"))return e;try{const t=await createImageBitmap(e),n=Math.min(1,h/Math.max(t.width,t.height)),o=Math.round(t.width*n),s=Math.round(t.height*n),a=document.createElement("canvas");a.width=o,a.height=s,a.getContext("2d").drawImage(t,0,0,o,s),(r=t.close)==null||r.call(t);const c=await new Promise(i=>a.toBlob(i,"image/jpeg",m));return!c||c.size>=e.size?e:new File([c],e.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"})}catch{return e}}export{p as C,u as c};
