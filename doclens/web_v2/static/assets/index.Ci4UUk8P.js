var Wh=Object.defineProperty;var Vh=(t,e,r)=>e in t?Wh(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r;var we=(t,e,r)=>Vh(t,typeof e!="symbol"?e+"":e,r);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function r(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(s){if(s.ep)return;s.ep=!0;const a=r(s);fetch(s.href,a)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ya=globalThis,zl=Ya.ShadowRoot&&(Ya.ShadyCSS===void 0||Ya.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,$l=Symbol(),Rc=new WeakMap;let Pd=class{constructor(e,r,i){if(this._$cssResult$=!0,i!==$l)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=r}get styleSheet(){let e=this.o;const r=this.t;if(zl&&e===void 0){const i=r!==void 0&&r.length===1;i&&(e=Rc.get(r)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&Rc.set(r,e))}return e}toString(){return this.cssText}};const Dd=t=>new Pd(typeof t=="string"?t:t+"",void 0,$l),U=(t,...e)=>{const r=t.length===1?t[0]:e.reduce((i,s,a)=>i+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[a+1],t[0]);return new Pd(r,t,$l)},Gh=(t,e)=>{if(zl)t.adoptedStyleSheets=e.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of e){const i=document.createElement("style"),s=Ya.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=r.cssText,t.appendChild(i)}},Lc=zl?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let r="";for(const i of e.cssRules)r+=i.cssText;return Dd(r)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Xh,defineProperty:Kh,getOwnPropertyDescriptor:Yh,getOwnPropertyNames:Zh,getOwnPropertySymbols:Jh,getPrototypeOf:Qh}=Object,Yr=globalThis,Bc=Yr.trustedTypes,ep=Bc?Bc.emptyScript:"",on=Yr.reactiveElementPolyfillSupport,Zs=(t,e)=>t,ns={toAttribute(t,e){switch(e){case Boolean:t=t?ep:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let r=t;switch(e){case Boolean:r=t!==null;break;case Number:r=t===null?null:Number(t);break;case Object:case Array:try{r=JSON.parse(t)}catch{r=null}}return r}},Tl=(t,e)=>!Xh(t,e),Nc={attribute:!0,type:String,converter:ns,reflect:!1,useDefault:!1,hasChanged:Tl};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),Yr.litPropertyMetadata??(Yr.litPropertyMetadata=new WeakMap);let es=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,r=Nc){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(e,r),!r.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(e,i,r);s!==void 0&&Kh(this.prototype,e,s)}}static getPropertyDescriptor(e,r,i){const{get:s,set:a}=Yh(this.prototype,e)??{get(){return this[r]},set(o){this[r]=o}};return{get:s,set(o){const l=s==null?void 0:s.call(this);a==null||a.call(this,o),this.requestUpdate(e,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Nc}static _$Ei(){if(this.hasOwnProperty(Zs("elementProperties")))return;const e=Qh(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(Zs("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Zs("properties"))){const r=this.properties,i=[...Zh(r),...Jh(r)];for(const s of i)this.createProperty(s,r[s])}const e=this[Symbol.metadata];if(e!==null){const r=litPropertyMetadata.get(e);if(r!==void 0)for(const[i,s]of r)this.elementProperties.set(i,s)}this._$Eh=new Map;for(const[r,i]of this.elementProperties){const s=this._$Eu(r,i);s!==void 0&&this._$Eh.set(s,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const r=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const s of i)r.unshift(Lc(s))}else e!==void 0&&r.push(Lc(e));return r}static _$Eu(e,r){const i=r.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var e;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(e=this.constructor.l)==null||e.forEach(r=>r(this))}addController(e){var r;(this._$EO??(this._$EO=new Set)).add(e),this.renderRoot!==void 0&&this.isConnected&&((r=e.hostConnected)==null||r.call(e))}removeController(e){var r;(r=this._$EO)==null||r.delete(e)}_$E_(){const e=new Map,r=this.constructor.elementProperties;for(const i of r.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Gh(e,this.constructor.elementStyles),e}connectedCallback(){var e;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(e=this._$EO)==null||e.forEach(r=>{var i;return(i=r.hostConnected)==null?void 0:i.call(r)})}enableUpdating(e){}disconnectedCallback(){var e;(e=this._$EO)==null||e.forEach(r=>{var i;return(i=r.hostDisconnected)==null?void 0:i.call(r)})}attributeChangedCallback(e,r,i){this._$AK(e,i)}_$ET(e,r){var a;const i=this.constructor.elementProperties.get(e),s=this.constructor._$Eu(e,i);if(s!==void 0&&i.reflect===!0){const o=(((a=i.converter)==null?void 0:a.toAttribute)!==void 0?i.converter:ns).toAttribute(r,i.type);this._$Em=e,o==null?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(e,r){var a,o;const i=this.constructor,s=i._$Eh.get(e);if(s!==void 0&&this._$Em!==s){const l=i.getPropertyOptions(s),c=typeof l.converter=="function"?{fromAttribute:l.converter}:((a=l.converter)==null?void 0:a.fromAttribute)!==void 0?l.converter:ns;this._$Em=s;const h=c.fromAttribute(r,l.type);this[s]=h??((o=this._$Ej)==null?void 0:o.get(s))??h,this._$Em=null}}requestUpdate(e,r,i,s=!1,a){var o;if(e!==void 0){const l=this.constructor;if(s===!1&&(a=this[e]),i??(i=l.getPropertyOptions(e)),!((i.hasChanged??Tl)(a,r)||i.useDefault&&i.reflect&&a===((o=this._$Ej)==null?void 0:o.get(e))&&!this.hasAttribute(l._$Eu(e,i))))return;this.C(e,r,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,r,{useDefault:i,reflect:s,wrapped:a},o){i&&!(this._$Ej??(this._$Ej=new Map)).has(e)&&(this._$Ej.set(e,o??r??this[e]),a!==!0||o!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(r=void 0),this._$AL.set(e,r)),s===!0&&this._$Em!==e&&(this._$Eq??(this._$Eq=new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[a,o]of this._$Ep)this[a]=o;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[a,o]of s){const{wrapped:l}=o,c=this[a];l!==!0||this._$AL.has(a)||c===void 0||this.C(a,void 0,o,c)}}let e=!1;const r=this._$AL;try{e=this.shouldUpdate(r),e?(this.willUpdate(r),(i=this._$EO)==null||i.forEach(s=>{var a;return(a=s.hostUpdate)==null?void 0:a.call(s)}),this.update(r)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(r)}willUpdate(e){}_$AE(e){var r;(r=this._$EO)==null||r.forEach(i=>{var s;return(s=i.hostUpdated)==null?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(e){}firstUpdated(e){}};es.elementStyles=[],es.shadowRootOptions={mode:"open"},es[Zs("elementProperties")]=new Map,es[Zs("finalized")]=new Map,on==null||on({ReactiveElement:es}),(Yr.reactiveElementVersions??(Yr.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Js=globalThis,Fc=t=>t,to=Js.trustedTypes,Hc=to?to.createPolicy("lit-html",{createHTML:t=>t}):void 0,Od="$lit$",Wr=`lit$${Math.random().toFixed(9).slice(2)}$`,Id="?"+Wr,tp=`<${Id}>`,Ei=document,ra=()=>Ei.createComment(""),ia=t=>t===null||typeof t!="object"&&typeof t!="function",Cl=Array.isArray,rp=t=>Cl(t)||typeof(t==null?void 0:t[Symbol.iterator])=="function",nn=`[ 	
\f\r]`,Rs=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,qc=/-->/g,Uc=/>/g,mi=RegExp(`>|${nn}(?:([^\\s"'>=/]+)(${nn}*=${nn}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),jc=/'/g,Wc=/"/g,Rd=/^(?:script|style|textarea|title)$/i,ip=t=>(e,...r)=>({_$litType$:t,strings:e,values:r}),p=ip(1),At=Symbol.for("lit-noChange"),F=Symbol.for("lit-nothing"),Vc=new WeakMap,$i=Ei.createTreeWalker(Ei,129);function Ld(t,e){if(!Cl(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Hc!==void 0?Hc.createHTML(e):e}const sp=(t,e)=>{const r=t.length-1,i=[];let s,a=e===2?"<svg>":e===3?"<math>":"",o=Rs;for(let l=0;l<r;l++){const c=t[l];let h,f,b=-1,y=0;for(;y<c.length&&(o.lastIndex=y,f=o.exec(c),f!==null);)y=o.lastIndex,o===Rs?f[1]==="!--"?o=qc:f[1]!==void 0?o=Uc:f[2]!==void 0?(Rd.test(f[2])&&(s=RegExp("</"+f[2],"g")),o=mi):f[3]!==void 0&&(o=mi):o===mi?f[0]===">"?(o=s??Rs,b=-1):f[1]===void 0?b=-2:(b=o.lastIndex-f[2].length,h=f[1],o=f[3]===void 0?mi:f[3]==='"'?Wc:jc):o===Wc||o===jc?o=mi:o===qc||o===Uc?o=Rs:(o=mi,s=void 0);const k=o===mi&&t[l+1].startsWith("/>")?" ":"";a+=o===Rs?c+tp:b>=0?(i.push(h),c.slice(0,b)+Od+c.slice(b)+Wr+k):c+Wr+(b===-2?l:k)}return[Ld(t,a+(t[r]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]};let Fn=class Bd{constructor({strings:e,_$litType$:r},i){let s;this.parts=[];let a=0,o=0;const l=e.length-1,c=this.parts,[h,f]=sp(e,r);if(this.el=Bd.createElement(h,i),$i.currentNode=this.el.content,r===2||r===3){const b=this.el.content.firstChild;b.replaceWith(...b.childNodes)}for(;(s=$i.nextNode())!==null&&c.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(const b of s.getAttributeNames())if(b.endsWith(Od)){const y=f[o++],k=s.getAttribute(b).split(Wr),z=/([.?@])?(.*)/.exec(y);c.push({type:1,index:a,name:z[2],strings:k,ctor:z[1]==="."?op:z[1]==="?"?np:z[1]==="@"?lp:zo}),s.removeAttribute(b)}else b.startsWith(Wr)&&(c.push({type:6,index:a}),s.removeAttribute(b));if(Rd.test(s.tagName)){const b=s.textContent.split(Wr),y=b.length-1;if(y>0){s.textContent=to?to.emptyScript:"";for(let k=0;k<y;k++)s.append(b[k],ra()),$i.nextNode(),c.push({type:2,index:++a});s.append(b[y],ra())}}}else if(s.nodeType===8)if(s.data===Id)c.push({type:2,index:a});else{let b=-1;for(;(b=s.data.indexOf(Wr,b+1))!==-1;)c.push({type:7,index:a}),b+=Wr.length-1}a++}}static createElement(e,r){const i=Ei.createElement("template");return i.innerHTML=e,i}};function ls(t,e,r=t,i){var o,l;if(e===At)return e;let s=i!==void 0?(o=r._$Co)==null?void 0:o[i]:r._$Cl;const a=ia(e)?void 0:e._$litDirective$;return(s==null?void 0:s.constructor)!==a&&((l=s==null?void 0:s._$AO)==null||l.call(s,!1),a===void 0?s=void 0:(s=new a(t),s._$AT(t,r,i)),i!==void 0?(r._$Co??(r._$Co=[]))[i]=s:r._$Cl=s),s!==void 0&&(e=ls(t,s._$AS(t,e.values),s,i)),e}class ap{constructor(e,r){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:r},parts:i}=this._$AD,s=((e==null?void 0:e.creationScope)??Ei).importNode(r,!0);$i.currentNode=s;let a=$i.nextNode(),o=0,l=0,c=i[0];for(;c!==void 0;){if(o===c.index){let h;c.type===2?h=new pa(a,a.nextSibling,this,e):c.type===1?h=new c.ctor(a,c.name,c.strings,this,e):c.type===6&&(h=new cp(a,this,e)),this._$AV.push(h),c=i[++l]}o!==(c==null?void 0:c.index)&&(a=$i.nextNode(),o++)}return $i.currentNode=Ei,s}p(e){let r=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,r),r+=i.strings.length-2):i._$AI(e[r])),r++}}class pa{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,r,i,s){this.type=2,this._$AH=F,this._$AN=void 0,this._$AA=e,this._$AB=r,this._$AM=i,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let e=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(e==null?void 0:e.nodeType)===11&&(e=r.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,r=this){e=ls(this,e,r),ia(e)?e===F||e==null||e===""?(this._$AH!==F&&this._$AR(),this._$AH=F):e!==this._$AH&&e!==At&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):rp(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==F&&ia(this._$AH)?this._$AA.nextSibling.data=e:this.T(Ei.createTextNode(e)),this._$AH=e}$(e){var a;const{values:r,_$litType$:i}=e,s=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=Fn.createElement(Ld(i.h,i.h[0]),this.options)),i);if(((a=this._$AH)==null?void 0:a._$AD)===s)this._$AH.p(r);else{const o=new ap(s,this),l=o.u(this.options);o.p(r),this.T(l),this._$AH=o}}_$AC(e){let r=Vc.get(e.strings);return r===void 0&&Vc.set(e.strings,r=new Fn(e)),r}k(e){Cl(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let i,s=0;for(const a of e)s===r.length?r.push(i=new pa(this.O(ra()),this.O(ra()),this,this.options)):i=r[s],i._$AI(a),s++;s<r.length&&(this._$AR(i&&i._$AB.nextSibling,s),r.length=s)}_$AR(e=this._$AA.nextSibling,r){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,r);e!==this._$AB;){const s=Fc(e).nextSibling;Fc(e).remove(),e=s}}setConnected(e){var r;this._$AM===void 0&&(this._$Cv=e,(r=this._$AP)==null||r.call(this,e))}}let zo=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,r,i,s,a){this.type=1,this._$AH=F,this._$AN=void 0,this.element=e,this.name=r,this._$AM=s,this.options=a,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=F}_$AI(e,r=this,i,s){const a=this.strings;let o=!1;if(a===void 0)e=ls(this,e,r,0),o=!ia(e)||e!==this._$AH&&e!==At,o&&(this._$AH=e);else{const l=e;let c,h;for(e=a[0],c=0;c<a.length-1;c++)h=ls(this,l[i+c],r,c),h===At&&(h=this._$AH[c]),o||(o=!ia(h)||h!==this._$AH[c]),h===F?e=F:e!==F&&(e+=(h??"")+a[c+1]),this._$AH[c]=h}o&&!s&&this.j(e)}j(e){e===F?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},op=class extends zo{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===F?void 0:e}},np=class extends zo{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==F)}},lp=class extends zo{constructor(e,r,i,s,a){super(e,r,i,s,a),this.type=5}_$AI(e,r=this){if((e=ls(this,e,r,0)??F)===At)return;const i=this._$AH,s=e===F&&i!==F||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,a=e!==F&&(i===F||s);s&&this.element.removeEventListener(this.name,this,i),a&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,e):this._$AH.handleEvent(e)}},cp=class{constructor(e,r,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=r,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){ls(this,e)}};const ln=Js.litHtmlPolyfillSupport;ln==null||ln(Fn,pa),(Js.litHtmlVersions??(Js.litHtmlVersions=[])).push("3.3.3");const dp=(t,e,r)=>{const i=(r==null?void 0:r.renderBefore)??e;let s=i._$litPart$;if(s===void 0){const a=(r==null?void 0:r.renderBefore)??null;i._$litPart$=s=new pa(e.insertBefore(ra(),a),a,void 0,r??{})}return s._$AI(t),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ti=globalThis;let G=class extends es{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const e=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=e.firstChild),e}update(e){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=dp(r,this.renderRoot,this.renderOptions)}connectedCallback(){var e;super.connectedCallback(),(e=this._$Do)==null||e.setConnected(!0)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._$Do)==null||e.setConnected(!1)}render(){return At}};var Md;G._$litElement$=!0,G.finalized=!0,(Md=Ti.litElementHydrateSupport)==null||Md.call(Ti,{LitElement:G});const cn=Ti.litElementPolyfillSupport;cn==null||cn({LitElement:G});(Ti.litElementVersions??(Ti.litElementVersions=[])).push("4.2.2");var up=U`
  :host {
    --track-width: 2px;
    --track-color: rgb(128 128 128 / 25%);
    --indicator-color: var(--sl-color-primary-600);
    --speed: 2s;

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex: none;
  }

  .spinner {
    flex: 1 1 auto;
    height: 100%;
    width: 100%;
  }

  .spinner__track,
  .spinner__indicator {
    fill: none;
    stroke-width: var(--track-width);
    r: calc(0.5em - var(--track-width) / 2);
    cx: 0.5em;
    cy: 0.5em;
    transform-origin: 50% 50%;
  }

  .spinner__track {
    stroke: var(--track-color);
    transform-origin: 0% 0%;
  }

  .spinner__indicator {
    stroke: var(--indicator-color);
    stroke-linecap: round;
    stroke-dasharray: 150% 75%;
    animation: spin var(--speed) linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
      stroke-dasharray: 0.05em, 3em;
    }

    50% {
      transform: rotate(450deg);
      stroke-dasharray: 1.375em, 1.375em;
    }

    100% {
      transform: rotate(1080deg);
      stroke-dasharray: 0.05em, 3em;
    }
  }
`;const Hn=new Set,is=new Map;let wi,El="ltr",Al="en";const Nd=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Nd){const t=new MutationObserver(Hd);El=document.documentElement.dir||"ltr",Al=document.documentElement.lang||navigator.language,t.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Fd(...t){t.map(e=>{const r=e.$code.toLowerCase();is.has(r)?is.set(r,Object.assign(Object.assign({},is.get(r)),e)):is.set(r,e),wi||(wi=e)}),Hd()}function Hd(){Nd&&(El=document.documentElement.dir||"ltr",Al=document.documentElement.lang||navigator.language),[...Hn.keys()].map(t=>{typeof t.requestUpdate=="function"&&t.requestUpdate()})}let hp=class{constructor(e){this.host=e,this.host.addController(this)}hostConnected(){Hn.add(this.host)}hostDisconnected(){Hn.delete(this.host)}dir(){return`${this.host.dir||El}`.toLowerCase()}lang(){return`${this.host.lang||Al}`.toLowerCase()}getTranslationData(e){var r,i;let s;try{s=new Intl.Locale(e.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const a=s.language.toLowerCase(),o=(i=(r=s.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&i!==void 0?i:"",l=is.get(`${a}-${o}`),c=is.get(a);return{locale:s,language:a,region:o,primary:l,secondary:c}}exists(e,r){var i;const{primary:s,secondary:a}=this.getTranslationData((i=r.lang)!==null&&i!==void 0?i:this.lang());return r=Object.assign({includeFallback:!1},r),!!(s&&s[e]||a&&a[e]||r.includeFallback&&wi&&wi[e])}term(e,...r){const{primary:i,secondary:s}=this.getTranslationData(this.lang());let a;if(i&&i[e])a=i[e];else if(s&&s[e])a=s[e];else if(wi&&wi[e])a=wi[e];else return console.error(`No translation found for: ${String(e)}`),String(e);return typeof a=="function"?a(...r):a}date(e,r){return e=new Date(e),new Intl.DateTimeFormat(this.lang(),r).format(e)}number(e,r){return e=Number(e),isNaN(e)?"":new Intl.NumberFormat(this.lang(),r).format(e)}relativeTime(e,r,i){return new Intl.RelativeTimeFormat(this.lang(),i).format(e,r)}};var qd={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(t,e)=>`Go to slide ${t} of ${e}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:t=>t===0?"No options selected":t===1?"1 option selected":`${t} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:t=>`Slide ${t}`,toggleColorFormat:"Toggle color format"};Fd(qd);var pp=qd,Bi=class extends hp{};Fd(pp);var Gt=U`
  :host {
    box-sizing: border-box;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: inherit;
  }

  [hidden] {
    display: none !important;
  }
`,Ud=Object.defineProperty,fp=Object.defineProperties,mp=Object.getOwnPropertyDescriptor,vp=Object.getOwnPropertyDescriptors,Gc=Object.getOwnPropertySymbols,bp=Object.prototype.hasOwnProperty,gp=Object.prototype.propertyIsEnumerable,dn=(t,e)=>(e=Symbol[t])?e:Symbol.for("Symbol."+t),Ml=t=>{throw TypeError(t)},Xc=(t,e,r)=>e in t?Ud(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r,Ni=(t,e)=>{for(var r in e||(e={}))bp.call(e,r)&&Xc(t,r,e[r]);if(Gc)for(var r of Gc(e))gp.call(e,r)&&Xc(t,r,e[r]);return t},Pl=(t,e)=>fp(t,vp(e)),E=(t,e,r,i)=>{for(var s=i>1?void 0:i?mp(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Ud(e,r,s),s},jd=(t,e,r)=>e.has(t)||Ml("Cannot "+r),xp=(t,e,r)=>(jd(t,e,"read from private field"),e.get(t)),yp=(t,e,r)=>e.has(t)?Ml("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,r),wp=(t,e,r,i)=>(jd(t,e,"write to private field"),e.set(t,r),r),_p=function(t,e){this[0]=t,this[1]=e},kp=t=>{var e=t[dn("asyncIterator")],r=!1,i,s={};return e==null?(e=t[dn("iterator")](),i=a=>s[a]=o=>e[a](o)):(e=e.call(t),i=a=>s[a]=o=>{if(r){if(r=!1,a==="throw")throw o;return o}return r=!0,{done:!1,value:new _p(new Promise(l=>{var c=e[a](o);c instanceof Object||Ml("Object expected"),l(c)}),1)}}),s[dn("iterator")]=()=>s,i("next"),"throw"in e?i("throw"):s.throw=a=>{throw a},"return"in e&&i("return"),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Z=t=>(e,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Sp={attribute:!0,type:String,converter:ns,reflect:!1,hasChanged:Tl},zp=(t=Sp,e,r)=>{const{kind:i,metadata:s}=r;let a=globalThis.litPropertyMetadata.get(s);if(a===void 0&&globalThis.litPropertyMetadata.set(s,a=new Map),i==="setter"&&((t=Object.create(t)).wrapped=!0),a.set(r.name,t),i==="accessor"){const{name:o}=r;return{set(l){const c=e.get.call(this);e.set.call(this,l),this.requestUpdate(o,c,t,!0,l)},init(l){return l!==void 0&&this.C(o,void 0,t,l),l}}}if(i==="setter"){const{name:o}=r;return function(l){const c=this[o];e.call(this,l),this.requestUpdate(o,c,t,!0,l)}}throw Error("Unsupported decorator location: "+i)};function w(t){return(e,r)=>typeof r=="object"?zp(t,e,r):((i,s,a)=>{const o=s.hasOwnProperty(a);return s.constructor.createProperty(a,i),o?Object.getOwnPropertyDescriptor(s,a):void 0})(t,e,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function $(t){return w({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function $p(t){return(e,r)=>{const i=typeof e=="function"?e:e[r];Object.assign(i,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Tp=(t,e,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(t,e,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function ht(t,e){return(r,i,s)=>{const a=o=>{var l;return((l=o.renderRoot)==null?void 0:l.querySelector(t))??null};return Tp(r,i,{get(){return a(this)}})}}var Za,at=class extends G{constructor(){super(),yp(this,Za,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([t,e])=>{this.constructor.define(t,e)})}emit(t,e){const r=new CustomEvent(t,Ni({bubbles:!0,cancelable:!1,composed:!0,detail:{}},e));return this.dispatchEvent(r),r}static define(t,e=this,r={}){const i=customElements.get(t);if(!i){try{customElements.define(t,e,r)}catch{customElements.define(t,class extends e{},r)}return}let s=" (unknown version)",a=s;"version"in e&&e.version&&(s=" v"+e.version),"version"in i&&i.version&&(a=" v"+i.version),!(s&&a&&s===a)&&console.warn(`Attempted to register <${t}>${s}, but <${t}>${a} has already been registered.`)}attributeChangedCallback(t,e,r){xp(this,Za)||(this.constructor.elementProperties.forEach((i,s)=>{i.reflect&&this[s]!=null&&this.initialReflectedProperties.set(s,this[s])}),wp(this,Za,!0)),super.attributeChangedCallback(t,e,r)}willUpdate(t){super.willUpdate(t),this.initialReflectedProperties.forEach((e,r)=>{t.has(r)&&this[r]==null&&(this[r]=e)})}};Za=new WeakMap;at.version="2.20.1";at.dependencies={};E([w()],at.prototype,"dir",2);E([w()],at.prototype,"lang",2);var Wd=class extends at{constructor(){super(...arguments),this.localize=new Bi(this)}render(){return p`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};Wd.styles=[Gt,up];var Ls=new WeakMap,Bs=new WeakMap,Ns=new WeakMap,un=new WeakSet,La=new WeakMap,Vd=class{constructor(t,e){this.handleFormData=r=>{const i=this.options.disabled(this.host),s=this.options.name(this.host),a=this.options.value(this.host),o=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!i&&!o&&typeof s=="string"&&s.length>0&&typeof a<"u"&&(Array.isArray(a)?a.forEach(l=>{r.formData.append(s,l.toString())}):r.formData.append(s,a.toString()))},this.handleFormSubmit=r=>{var i;const s=this.options.disabled(this.host),a=this.options.reportValidity;this.form&&!this.form.noValidate&&((i=Ls.get(this.form))==null||i.forEach(o=>{this.setUserInteracted(o,!0)})),this.form&&!this.form.noValidate&&!s&&!a(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),La.set(this.host,[])},this.handleInteraction=r=>{const i=La.get(this.host);i.includes(r.type)||i.push(r.type),i.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.checkValidity=="function"&&!i.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.reportValidity=="function"&&!i.reportValidity())return!1}return!0},(this.host=t).addController(this),this.options=Ni({form:r=>{const i=r.form;if(i){const a=r.getRootNode().querySelector(`#${i}`);if(a)return a}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var i;return(i=r.disabled)!=null?i:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,i)=>r.value=i,assumeInteractionOn:["sl-input"]},e)}hostConnected(){const t=this.options.form(this.host);t&&this.attachForm(t),La.set(this.host,[]),this.options.assumeInteractionOn.forEach(e=>{this.host.addEventListener(e,this.handleInteraction)})}hostDisconnected(){this.detachForm(),La.delete(this.host),this.options.assumeInteractionOn.forEach(t=>{this.host.removeEventListener(t,this.handleInteraction)})}hostUpdated(){const t=this.options.form(this.host);t||this.detachForm(),t&&this.form!==t&&(this.detachForm(),this.attachForm(t)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(t){t?(this.form=t,Ls.has(this.form)?Ls.get(this.form).add(this.host):Ls.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),Bs.has(this.form)||(Bs.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),Ns.has(this.form)||(Ns.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const t=Ls.get(this.form);t&&(t.delete(this.host),t.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),Bs.has(this.form)&&(this.form.reportValidity=Bs.get(this.form),Bs.delete(this.form)),Ns.has(this.form)&&(this.form.checkValidity=Ns.get(this.form),Ns.delete(this.form)),this.form=void 0))}setUserInteracted(t,e){e?un.add(t):un.delete(t),t.requestUpdate()}doAction(t,e){if(this.form){const r=document.createElement("button");r.type=t,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",e&&(r.name=e.name,r.value=e.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(i=>{e.hasAttribute(i)&&r.setAttribute(i,e.getAttribute(i))})),this.form.append(r),r.click(),r.remove()}}getForm(){var t;return(t=this.form)!=null?t:null}reset(t){this.doAction("reset",t)}submit(t){this.doAction("submit",t)}setValidity(t){const e=this.host,r=!!un.has(e),i=!!e.required;e.toggleAttribute("data-required",i),e.toggleAttribute("data-optional",!i),e.toggleAttribute("data-invalid",!t),e.toggleAttribute("data-valid",t),e.toggleAttribute("data-user-invalid",!t&&r),e.toggleAttribute("data-user-valid",t&&r)}updateValidity(){const t=this.host;this.setValidity(t.validity.valid)}emitInvalidEvent(t){const e=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});t||e.preventDefault(),this.host.dispatchEvent(e)||t==null||t.preventDefault()}},Dl=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(Pl(Ni({},Dl),{valid:!1,valueMissing:!0}));Object.freeze(Pl(Ni({},Dl),{valid:!1,customError:!0}));var Cp=U`
  :host {
    display: inline-block;
    position: relative;
    width: auto;
    cursor: pointer;
  }

  .button {
    display: inline-flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    border-style: solid;
    border-width: var(--sl-input-border-width);
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-font-weight-semibold);
    text-decoration: none;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;
    vertical-align: middle;
    padding: 0;
    transition:
      var(--sl-transition-x-fast) background-color,
      var(--sl-transition-x-fast) color,
      var(--sl-transition-x-fast) border,
      var(--sl-transition-x-fast) box-shadow;
    cursor: inherit;
  }

  .button::-moz-focus-inner {
    border: 0;
  }

  .button:focus {
    outline: none;
  }

  .button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* When disabled, prevent mouse events from bubbling up from children */
  .button--disabled * {
    pointer-events: none;
  }

  .button__prefix,
  .button__suffix {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .button__label {
    display: inline-block;
  }

  .button__label::slotted(sl-icon) {
    vertical-align: -2px;
  }

  /*
   * Standard buttons
   */

  /* Default */
  .button--standard.button--default {
    background-color: var(--sl-color-neutral-0);
    border-color: var(--sl-input-border-color);
    color: var(--sl-color-neutral-700);
  }

  .button--standard.button--default:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-50);
    border-color: var(--sl-color-primary-300);
    color: var(--sl-color-primary-700);
  }

  .button--standard.button--default:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-100);
    border-color: var(--sl-color-primary-400);
    color: var(--sl-color-primary-700);
  }

  /* Primary */
  .button--standard.button--primary {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:hover:not(.button--disabled) {
    background-color: var(--sl-color-primary-500);
    border-color: var(--sl-color-primary-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--primary:active:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--standard.button--success {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:hover:not(.button--disabled) {
    background-color: var(--sl-color-success-500);
    border-color: var(--sl-color-success-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--success:active:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--standard.button--neutral {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:hover:not(.button--disabled) {
    background-color: var(--sl-color-neutral-500);
    border-color: var(--sl-color-neutral-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--neutral:active:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--standard.button--warning {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }
  .button--standard.button--warning:hover:not(.button--disabled) {
    background-color: var(--sl-color-warning-500);
    border-color: var(--sl-color-warning-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--warning:active:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--standard.button--danger {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:hover:not(.button--disabled) {
    background-color: var(--sl-color-danger-500);
    border-color: var(--sl-color-danger-500);
    color: var(--sl-color-neutral-0);
  }

  .button--standard.button--danger:active:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  /*
   * Outline buttons
   */

  .button--outline {
    background: none;
    border: solid 1px;
  }

  /* Default */
  .button--outline.button--default {
    border-color: var(--sl-input-border-color);
    color: var(--sl-color-neutral-700);
  }

  .button--outline.button--default:hover:not(.button--disabled),
  .button--outline.button--default.button--checked:not(.button--disabled) {
    border-color: var(--sl-color-primary-600);
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--default:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Primary */
  .button--outline.button--primary {
    border-color: var(--sl-color-primary-600);
    color: var(--sl-color-primary-600);
  }

  .button--outline.button--primary:hover:not(.button--disabled),
  .button--outline.button--primary.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-primary-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--primary:active:not(.button--disabled) {
    border-color: var(--sl-color-primary-700);
    background-color: var(--sl-color-primary-700);
    color: var(--sl-color-neutral-0);
  }

  /* Success */
  .button--outline.button--success {
    border-color: var(--sl-color-success-600);
    color: var(--sl-color-success-600);
  }

  .button--outline.button--success:hover:not(.button--disabled),
  .button--outline.button--success.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-success-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--success:active:not(.button--disabled) {
    border-color: var(--sl-color-success-700);
    background-color: var(--sl-color-success-700);
    color: var(--sl-color-neutral-0);
  }

  /* Neutral */
  .button--outline.button--neutral {
    border-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-600);
  }

  .button--outline.button--neutral:hover:not(.button--disabled),
  .button--outline.button--neutral.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-neutral-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--neutral:active:not(.button--disabled) {
    border-color: var(--sl-color-neutral-700);
    background-color: var(--sl-color-neutral-700);
    color: var(--sl-color-neutral-0);
  }

  /* Warning */
  .button--outline.button--warning {
    border-color: var(--sl-color-warning-600);
    color: var(--sl-color-warning-600);
  }

  .button--outline.button--warning:hover:not(.button--disabled),
  .button--outline.button--warning.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-warning-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--warning:active:not(.button--disabled) {
    border-color: var(--sl-color-warning-700);
    background-color: var(--sl-color-warning-700);
    color: var(--sl-color-neutral-0);
  }

  /* Danger */
  .button--outline.button--danger {
    border-color: var(--sl-color-danger-600);
    color: var(--sl-color-danger-600);
  }

  .button--outline.button--danger:hover:not(.button--disabled),
  .button--outline.button--danger.button--checked:not(.button--disabled) {
    background-color: var(--sl-color-danger-600);
    color: var(--sl-color-neutral-0);
  }

  .button--outline.button--danger:active:not(.button--disabled) {
    border-color: var(--sl-color-danger-700);
    background-color: var(--sl-color-danger-700);
    color: var(--sl-color-neutral-0);
  }

  @media (forced-colors: active) {
    .button.button--outline.button--checked:not(.button--disabled) {
      outline: solid 2px transparent;
    }
  }

  /*
   * Text buttons
   */

  .button--text {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-600);
  }

  .button--text:hover:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:focus-visible:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-500);
  }

  .button--text:active:not(.button--disabled) {
    background-color: transparent;
    border-color: transparent;
    color: var(--sl-color-primary-700);
  }

  /*
   * Size modifiers
   */

  .button--small {
    height: auto;
    min-height: var(--sl-input-height-small);
    font-size: var(--sl-button-font-size-small);
    line-height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-small);
  }

  .button--medium {
    height: auto;
    min-height: var(--sl-input-height-medium);
    font-size: var(--sl-button-font-size-medium);
    line-height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-medium);
  }

  .button--large {
    height: auto;
    min-height: var(--sl-input-height-large);
    font-size: var(--sl-button-font-size-large);
    line-height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    border-radius: var(--sl-input-border-radius-large);
  }

  /*
   * Pill modifier
   */

  .button--pill.button--small {
    border-radius: var(--sl-input-height-small);
  }

  .button--pill.button--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .button--pill.button--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Circle modifier
   */

  .button--circle {
    padding-left: 0;
    padding-right: 0;
  }

  .button--circle.button--small {
    width: var(--sl-input-height-small);
    border-radius: 50%;
  }

  .button--circle.button--medium {
    width: var(--sl-input-height-medium);
    border-radius: 50%;
  }

  .button--circle.button--large {
    width: var(--sl-input-height-large);
    border-radius: 50%;
  }

  .button--circle .button__prefix,
  .button--circle .button__suffix,
  .button--circle .button__caret {
    display: none;
  }

  /*
   * Caret modifier
   */

  .button--caret .button__suffix {
    display: none;
  }

  .button--caret .button__caret {
    height: auto;
  }

  /*
   * Loading modifier
   */

  .button--loading {
    position: relative;
    cursor: wait;
  }

  .button--loading .button__prefix,
  .button--loading .button__label,
  .button--loading .button__suffix,
  .button--loading .button__caret {
    visibility: hidden;
  }

  .button--loading sl-spinner {
    --indicator-color: currentColor;
    position: absolute;
    font-size: 1em;
    height: 1em;
    width: 1em;
    top: calc(50% - 0.5em);
    left: calc(50% - 0.5em);
  }

  /*
   * Badges
   */

  .button ::slotted(sl-badge) {
    position: absolute;
    top: 0;
    right: 0;
    translate: 50% -50%;
    pointer-events: none;
  }

  .button--rtl ::slotted(sl-badge) {
    right: auto;
    left: 0;
    translate: -50% -50%;
  }

  /*
   * Button spacing
   */

  .button--has-label.button--small .button__label {
    padding: 0 var(--sl-spacing-small);
  }

  .button--has-label.button--medium .button__label {
    padding: 0 var(--sl-spacing-medium);
  }

  .button--has-label.button--large .button__label {
    padding: 0 var(--sl-spacing-large);
  }

  .button--has-prefix.button--small {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--small .button__label {
    padding-inline-start: var(--sl-spacing-x-small);
  }

  .button--has-prefix.button--medium {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--medium .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-prefix.button--large .button__label {
    padding-inline-start: var(--sl-spacing-small);
  }

  .button--has-suffix.button--small,
  .button--caret.button--small {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--small .button__label,
  .button--caret.button--small .button__label {
    padding-inline-end: var(--sl-spacing-x-small);
  }

  .button--has-suffix.button--medium,
  .button--caret.button--medium {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--medium .button__label,
  .button--caret.button--medium .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large,
  .button--caret.button--large {
    padding-inline-end: var(--sl-spacing-small);
  }

  .button--has-suffix.button--large .button__label,
  .button--caret.button--large .button__label {
    padding-inline-end: var(--sl-spacing-small);
  }

  /*
   * Button groups support a variety of button types (e.g. buttons with tooltips, buttons as dropdown triggers, etc.).
   * This means buttons aren't always direct descendants of the button group, thus we can't target them with the
   * ::slotted selector. To work around this, the button group component does some magic to add these special classes to
   * buttons and we style them here instead.
   */

  :host([data-sl-button-group__button--first]:not([data-sl-button-group__button--last])) .button {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :host([data-sl-button-group__button--inner]) .button {
    border-radius: 0;
  }

  :host([data-sl-button-group__button--last]:not([data-sl-button-group__button--first])) .button {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  /* All except the first */
  :host([data-sl-button-group__button]:not([data-sl-button-group__button--first])) {
    margin-inline-start: calc(-1 * var(--sl-input-border-width));
  }

  /* Add a visual separator between solid buttons */
  :host(
      [data-sl-button-group__button]:not(
          [data-sl-button-group__button--first],
          [data-sl-button-group__button--radio],
          [variant='default']
        ):not(:hover)
    )
    .button:after {
    content: '';
    position: absolute;
    top: 0;
    inset-inline-start: 0;
    bottom: 0;
    border-left: solid 1px rgb(128 128 128 / 33%);
    mix-blend-mode: multiply;
  }

  /* Bump hovered, focused, and checked buttons up so their focus ring isn't clipped */
  :host([data-sl-button-group__button--hover]) {
    z-index: 1;
  }

  /* Focus and checked are always on top */
  :host([data-sl-button-group__button--focus]),
  :host([data-sl-button-group__button][checked]) {
    z-index: 2;
  }
`,fa=class{constructor(t,...e){this.slotNames=[],this.handleSlotChange=r=>{const i=r.target;(this.slotNames.includes("[default]")&&!i.name||i.name&&this.slotNames.includes(i.name))&&this.host.requestUpdate()},(this.host=t).addController(this),this.slotNames=e}hasDefaultSlot(){return[...this.host.childNodes].some(t=>{if(t.nodeType===t.TEXT_NODE&&t.textContent.trim()!=="")return!0;if(t.nodeType===t.ELEMENT_NODE){const e=t;if(e.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!e.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(t){return this.host.querySelector(`:scope > [slot="${t}"]`)!==null}test(t){return t==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(t)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},qn="";function Kc(t){qn=t}function Ep(t=""){if(!qn){const e=[...document.getElementsByTagName("script")],r=e.find(i=>i.hasAttribute("data-shoelace"));if(r)Kc(r.getAttribute("data-shoelace"));else{const i=e.find(a=>/shoelace(\.min)?\.js($|\?)/.test(a.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(a.src));let s="";i&&(s=i.getAttribute("src")),Kc(s.split("/").slice(0,-1).join("/"))}}return qn.replace(/\/$/,"")+(t?`/${t.replace(/^\//,"")}`:"")}var Ap={name:"default",resolver:t=>Ep(`assets/icons/${t}.svg`)},Mp=Ap,Yc={caret:`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `,check:`
    <svg part="checked-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor">
          <g transform="translate(3.428571, 3.428571)">
            <path d="M0,5.71428571 L3.42857143,9.14285714"></path>
            <path d="M9.14285714,0 L3.42857143,9.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"chevron-down":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,"chevron-left":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
    </svg>
  `,"chevron-right":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  `,copy:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
    </svg>
  `,eye:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  `,"eye-slash":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash" viewBox="0 0 16 16">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
      <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
    </svg>
  `,eyedropper:`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eyedropper" viewBox="0 0 16 16">
      <path d="M13.354.646a1.207 1.207 0 0 0-1.708 0L8.5 3.793l-.646-.647a.5.5 0 1 0-.708.708L8.293 5l-7.147 7.146A.5.5 0 0 0 1 12.5v1.793l-.854.853a.5.5 0 1 0 .708.707L1.707 15H3.5a.5.5 0 0 0 .354-.146L11 7.707l1.146 1.147a.5.5 0 0 0 .708-.708l-.647-.646 3.147-3.146a1.207 1.207 0 0 0 0-1.708l-2-2zM2 12.707l7-7L10.293 7l-7 7H2v-1.293z"></path>
    </svg>
  `,"grip-vertical":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16">
      <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"></path>
    </svg>
  `,indeterminate:`
    <svg part="indeterminate-icon" class="checkbox__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-linecap="round">
        <g stroke="currentColor" stroke-width="2">
          <g transform="translate(2.285714, 6.857143)">
            <path d="M10.2857143,1.14285714 L1.14285714,1.14285714"></path>
          </g>
        </g>
      </g>
    </svg>
  `,"person-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-fill" viewBox="0 0 16 16">
      <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
    </svg>
  `,"play-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"></path>
    </svg>
  `,"pause-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"></path>
    </svg>
  `,radio:`
    <svg part="checked-icon" class="radio__icon" viewBox="0 0 16 16">
      <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g fill="currentColor">
          <circle cx="8" cy="8" r="3.42857143"></circle>
        </g>
      </g>
    </svg>
  `,"star-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
      <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
    </svg>
  `,"x-lg":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
      <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
    </svg>
  `,"x-circle-fill":`
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"></path>
    </svg>
  `},Pp={name:"system",resolver:t=>t in Yc?`data:image/svg+xml,${encodeURIComponent(Yc[t])}`:""},Dp=Pp,Op=[Mp,Dp],Un=[];function Ip(t){Un.push(t)}function Rp(t){Un=Un.filter(e=>e!==t)}function Zc(t){return Op.find(e=>e.name===t)}var Lp=U`
  :host {
    display: inline-block;
    width: 1em;
    height: 1em;
    box-sizing: content-box !important;
  }

  svg {
    display: block;
    height: 100%;
    width: 100%;
  }
`;function ot(t,e){const r=Ni({waitUntilFirstUpdate:!1},e);return(i,s)=>{const{update:a}=i,o=Array.isArray(t)?t:[t];i.update=function(l){o.forEach(c=>{const h=c;if(l.has(h)){const f=l.get(h),b=this[h];f!==b&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[s](f,b)}}),a.call(this,l)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Bp=(t,e)=>(t==null?void 0:t._$litType$)!==void 0,Np=t=>t.strings===void 0,Fp={},Hp=(t,e=Fp)=>t._$AH=e;var Fs=Symbol(),Ba=Symbol(),hn,pn=new Map,Bt=class extends at{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(t,e){var r;let i;if(e!=null&&e.spriteSheet)return this.svg=p`<svg part="svg">
        <use part="use" href="${t}"></use>
      </svg>`,this.svg;try{if(i=await fetch(t,{mode:"cors"}),!i.ok)return i.status===410?Fs:Ba}catch{return Ba}try{const s=document.createElement("div");s.innerHTML=await i.text();const a=s.firstElementChild;if(((r=a==null?void 0:a.tagName)==null?void 0:r.toLowerCase())!=="svg")return Fs;hn||(hn=new DOMParser);const l=hn.parseFromString(a.outerHTML,"text/html").body.querySelector("svg");return l?(l.part.add("svg"),document.adoptNode(l)):Fs}catch{return Fs}}connectedCallback(){super.connectedCallback(),Ip(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),Rp(this)}getIconSource(){const t=Zc(this.library);return this.name&&t?{url:t.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var t;const{url:e,fromLibrary:r}=this.getIconSource(),i=r?Zc(this.library):void 0;if(!e){this.svg=null;return}let s=pn.get(e);if(s||(s=this.resolveIcon(e,i),pn.set(e,s)),!this.initialRender)return;const a=await s;if(a===Ba&&pn.delete(e),e===this.getIconSource().url){if(Bp(a)){if(this.svg=a,i){await this.updateComplete;const o=this.shadowRoot.querySelector("[part='svg']");typeof i.mutator=="function"&&o&&i.mutator(o)}return}switch(a){case Ba:case Fs:this.svg=null,this.emit("sl-error");break;default:this.svg=a.cloneNode(!0),(t=i==null?void 0:i.mutator)==null||t.call(i,this.svg),this.emit("sl-load")}}}render(){return this.svg}};Bt.styles=[Gt,Lp];E([$()],Bt.prototype,"svg",2);E([w({reflect:!0})],Bt.prototype,"name",2);E([w()],Bt.prototype,"src",2);E([w()],Bt.prototype,"label",2);E([w({reflect:!0})],Bt.prototype,"library",2);E([ot("label")],Bt.prototype,"handleLabelChange",1);E([ot(["name","src","library"])],Bt.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ur={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},Ol=t=>(...e)=>({_$litDirective$:t,values:e});let Il=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,r,i){this._$Ct=e,this._$AM=r,this._$Ci=i}_$AS(e,r){return this.update(e,r)}update(e,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pt=Ol(class extends Il{constructor(t){var e;if(super(t),t.type!==Ur.ATTRIBUTE||t.name!=="class"||((e=t.strings)==null?void 0:e.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return" "+Object.keys(t).filter(e=>t[e]).join(" ")+" "}update(t,[e]){var i,s;if(this.st===void 0){this.st=new Set,t.strings!==void 0&&(this.nt=new Set(t.strings.join(" ").split(/\s/).filter(a=>a!=="")));for(const a in e)e[a]&&!((i=this.nt)!=null&&i.has(a))&&this.st.add(a);return this.render(e)}const r=t.element.classList;for(const a of this.st)a in e||(r.remove(a),this.st.delete(a));for(const a in e){const o=!!e[a];o===this.st.has(a)||(s=this.nt)!=null&&s.has(a)||(o?(r.add(a),this.st.add(a)):(r.remove(a),this.st.delete(a)))}return At}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Gd=Symbol.for(""),qp=t=>{if((t==null?void 0:t.r)===Gd)return t==null?void 0:t._$litStatic$},ro=(t,...e)=>({_$litStatic$:e.reduce((r,i,s)=>r+(a=>{if(a._$litStatic$!==void 0)return a._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${a}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(i)+t[s+1],t[0]),r:Gd}),Jc=new Map,Up=t=>(e,...r)=>{const i=r.length;let s,a;const o=[],l=[];let c,h=0,f=!1;for(;h<i;){for(c=e[h];h<i&&(a=r[h],(s=qp(a))!==void 0);)c+=s+e[++h],f=!0;h!==i&&l.push(a),o.push(c),h++}if(h===i&&o.push(e[i]),f){const b=o.join("$$lit$$");(e=Jc.get(b))===void 0&&(o.raw=o,Jc.set(b,e=o)),r=l}return t(e,...r)},Ja=Up(p);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const he=t=>t??F;var xe=class extends at{constructor(){super(...arguments),this.formControlController=new Vd(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new fa(this,"[default]","prefix","suffix"),this.localize=new Bi(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Dl}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(t){this.isButton()&&(this.button.setCustomValidity(t),this.formControlController.updateValidity())}render(){const t=this.isLink(),e=t?ro`a`:ro`button`;return Ja`
      <${e}
        part="base"
        class=${Pt({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${he(t?void 0:this.disabled)}
        type=${he(t?void 0:this.type)}
        title=${this.title}
        name=${he(t?void 0:this.name)}
        value=${he(t?void 0:this.value)}
        href=${he(t&&!this.disabled?this.href:void 0)}
        target=${he(t?this.target:void 0)}
        download=${he(t?this.download:void 0)}
        rel=${he(t?this.rel:void 0)}
        role=${he(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @invalid=${this.isButton()?this.handleInvalid:null}
        @click=${this.handleClick}
      >
        <slot name="prefix" part="prefix" class="button__prefix"></slot>
        <slot part="label" class="button__label"></slot>
        <slot name="suffix" part="suffix" class="button__suffix"></slot>
        ${this.caret?Ja` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?Ja`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${e}>
    `}};xe.styles=[Gt,Cp];xe.dependencies={"sl-icon":Bt,"sl-spinner":Wd};E([ht(".button")],xe.prototype,"button",2);E([$()],xe.prototype,"hasFocus",2);E([$()],xe.prototype,"invalid",2);E([w()],xe.prototype,"title",2);E([w({reflect:!0})],xe.prototype,"variant",2);E([w({reflect:!0})],xe.prototype,"size",2);E([w({type:Boolean,reflect:!0})],xe.prototype,"caret",2);E([w({type:Boolean,reflect:!0})],xe.prototype,"disabled",2);E([w({type:Boolean,reflect:!0})],xe.prototype,"loading",2);E([w({type:Boolean,reflect:!0})],xe.prototype,"outline",2);E([w({type:Boolean,reflect:!0})],xe.prototype,"pill",2);E([w({type:Boolean,reflect:!0})],xe.prototype,"circle",2);E([w()],xe.prototype,"type",2);E([w()],xe.prototype,"name",2);E([w()],xe.prototype,"value",2);E([w()],xe.prototype,"href",2);E([w()],xe.prototype,"target",2);E([w()],xe.prototype,"rel",2);E([w()],xe.prototype,"download",2);E([w()],xe.prototype,"form",2);E([w({attribute:"formaction"})],xe.prototype,"formAction",2);E([w({attribute:"formenctype"})],xe.prototype,"formEnctype",2);E([w({attribute:"formmethod"})],xe.prototype,"formMethod",2);E([w({attribute:"formnovalidate",type:Boolean})],xe.prototype,"formNoValidate",2);E([w({attribute:"formtarget"})],xe.prototype,"formTarget",2);E([ot("disabled",{waitUntilFirstUpdate:!0})],xe.prototype,"handleDisabledChange",1);xe.define("sl-button");Bt.define("sl-icon");var jp=U`
  :host {
    display: block;
  }

  .input {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: stretch;
    justify-content: start;
    position: relative;
    width: 100%;
    font-family: var(--sl-input-font-family);
    font-weight: var(--sl-input-font-weight);
    letter-spacing: var(--sl-input-letter-spacing);
    vertical-align: middle;
    overflow: hidden;
    cursor: text;
    transition:
      var(--sl-transition-fast) color,
      var(--sl-transition-fast) border,
      var(--sl-transition-fast) box-shadow,
      var(--sl-transition-fast) background-color;
  }

  /* Standard inputs */
  .input--standard {
    background-color: var(--sl-input-background-color);
    border: solid var(--sl-input-border-width) var(--sl-input-border-color);
  }

  .input--standard:hover:not(.input--disabled) {
    background-color: var(--sl-input-background-color-hover);
    border-color: var(--sl-input-border-color-hover);
  }

  .input--standard.input--focused:not(.input--disabled) {
    background-color: var(--sl-input-background-color-focus);
    border-color: var(--sl-input-border-color-focus);
    box-shadow: 0 0 0 var(--sl-focus-ring-width) var(--sl-input-focus-ring-color);
  }

  .input--standard.input--focused:not(.input--disabled) .input__control {
    color: var(--sl-input-color-focus);
  }

  .input--standard.input--disabled {
    background-color: var(--sl-input-background-color-disabled);
    border-color: var(--sl-input-border-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input--standard.input--disabled .input__control {
    color: var(--sl-input-color-disabled);
  }

  .input--standard.input--disabled .input__control::placeholder {
    color: var(--sl-input-placeholder-color-disabled);
  }

  /* Filled inputs */
  .input--filled {
    border: none;
    background-color: var(--sl-input-filled-background-color);
    color: var(--sl-input-color);
  }

  .input--filled:hover:not(.input--disabled) {
    background-color: var(--sl-input-filled-background-color-hover);
  }

  .input--filled.input--focused:not(.input--disabled) {
    background-color: var(--sl-input-filled-background-color-focus);
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .input--filled.input--disabled {
    background-color: var(--sl-input-filled-background-color-disabled);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input__control {
    flex: 1 1 auto;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    min-width: 0;
    height: 100%;
    color: var(--sl-input-color);
    border: none;
    background: inherit;
    box-shadow: none;
    padding: 0;
    margin: 0;
    cursor: inherit;
    -webkit-appearance: none;
  }

  .input__control::-webkit-search-decoration,
  .input__control::-webkit-search-cancel-button,
  .input__control::-webkit-search-results-button,
  .input__control::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  .input__control:-webkit-autofill,
  .input__control:-webkit-autofill:hover,
  .input__control:-webkit-autofill:focus,
  .input__control:-webkit-autofill:active {
    box-shadow: 0 0 0 var(--sl-input-height-large) var(--sl-input-background-color-hover) inset !important;
    -webkit-text-fill-color: var(--sl-color-primary-500);
    caret-color: var(--sl-input-color);
  }

  .input--filled .input__control:-webkit-autofill,
  .input--filled .input__control:-webkit-autofill:hover,
  .input--filled .input__control:-webkit-autofill:focus,
  .input--filled .input__control:-webkit-autofill:active {
    box-shadow: 0 0 0 var(--sl-input-height-large) var(--sl-input-filled-background-color) inset !important;
  }

  .input__control::placeholder {
    color: var(--sl-input-placeholder-color);
    user-select: none;
    -webkit-user-select: none;
  }

  .input:hover:not(.input--disabled) .input__control {
    color: var(--sl-input-color-hover);
  }

  .input__control:focus {
    outline: none;
  }

  .input__prefix,
  .input__suffix {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    cursor: default;
  }

  .input__prefix ::slotted(sl-icon),
  .input__suffix ::slotted(sl-icon) {
    color: var(--sl-input-icon-color);
  }

  /*
   * Size modifiers
   */

  .input--small {
    border-radius: var(--sl-input-border-radius-small);
    font-size: var(--sl-input-font-size-small);
    height: var(--sl-input-height-small);
  }

  .input--small .input__control {
    height: calc(var(--sl-input-height-small) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-small);
  }

  .input--small .input__clear,
  .input--small .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-small) * 2);
  }

  .input--small .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-small);
  }

  .input--small .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-small);
  }

  .input--medium {
    border-radius: var(--sl-input-border-radius-medium);
    font-size: var(--sl-input-font-size-medium);
    height: var(--sl-input-height-medium);
  }

  .input--medium .input__control {
    height: calc(var(--sl-input-height-medium) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-medium);
  }

  .input--medium .input__clear,
  .input--medium .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-medium) * 2);
  }

  .input--medium .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-medium);
  }

  .input--medium .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-medium);
  }

  .input--large {
    border-radius: var(--sl-input-border-radius-large);
    font-size: var(--sl-input-font-size-large);
    height: var(--sl-input-height-large);
  }

  .input--large .input__control {
    height: calc(var(--sl-input-height-large) - var(--sl-input-border-width) * 2);
    padding: 0 var(--sl-input-spacing-large);
  }

  .input--large .input__clear,
  .input--large .input__password-toggle {
    width: calc(1em + var(--sl-input-spacing-large) * 2);
  }

  .input--large .input__prefix ::slotted(*) {
    margin-inline-start: var(--sl-input-spacing-large);
  }

  .input--large .input__suffix ::slotted(*) {
    margin-inline-end: var(--sl-input-spacing-large);
  }

  /*
   * Pill modifier
   */

  .input--pill.input--small {
    border-radius: var(--sl-input-height-small);
  }

  .input--pill.input--medium {
    border-radius: var(--sl-input-height-medium);
  }

  .input--pill.input--large {
    border-radius: var(--sl-input-height-large);
  }

  /*
   * Clearable + Password Toggle
   */

  .input__clear,
  .input__password-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: inherit;
    color: var(--sl-input-icon-color);
    border: none;
    background: none;
    padding: 0;
    transition: var(--sl-transition-fast) color;
    cursor: pointer;
  }

  .input__clear:hover,
  .input__password-toggle:hover {
    color: var(--sl-input-icon-color-hover);
  }

  .input__clear:focus,
  .input__password-toggle:focus {
    outline: none;
  }

  /* Don't show the browser's password toggle in Edge */
  ::-ms-reveal {
    display: none;
  }

  /* Hide the built-in number spinner */
  .input--no-spin-buttons input[type='number']::-webkit-outer-spin-button,
  .input--no-spin-buttons input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    display: none;
  }

  .input--no-spin-buttons input[type='number'] {
    -moz-appearance: textfield;
  }
`,Wp=(t="value")=>(e,r)=>{const i=e.constructor,s=i.prototype.attributeChangedCallback;i.prototype.attributeChangedCallback=function(a,o,l){var c;const h=i.getPropertyOptions(t),f=typeof h.attribute=="string"?h.attribute:t;if(a===f){const b=h.converter||ns,k=(typeof b=="function"?b:(c=b==null?void 0:b.fromAttribute)!=null?c:ns.fromAttribute)(l,h.type);this[t]!==k&&(this[r]=k)}s.call(this,a,o,l)}},Vp=U`
  .form-control .form-control__label {
    display: none;
  }

  .form-control .form-control__help-text {
    display: none;
  }

  /* Label */
  .form-control--has-label .form-control__label {
    display: inline-block;
    color: var(--sl-input-label-color);
    margin-bottom: var(--sl-spacing-3x-small);
  }

  .form-control--has-label.form-control--small .form-control__label {
    font-size: var(--sl-input-label-font-size-small);
  }

  .form-control--has-label.form-control--medium .form-control__label {
    font-size: var(--sl-input-label-font-size-medium);
  }

  .form-control--has-label.form-control--large .form-control__label {
    font-size: var(--sl-input-label-font-size-large);
  }

  :host([required]) .form-control--has-label .form-control__label::after {
    content: var(--sl-input-required-content);
    margin-inline-start: var(--sl-input-required-content-offset);
    color: var(--sl-input-required-content-color);
  }

  /* Help text */
  .form-control--has-help-text .form-control__help-text {
    display: block;
    color: var(--sl-input-help-text-color);
    margin-top: var(--sl-spacing-3x-small);
  }

  .form-control--has-help-text.form-control--small .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-small);
  }

  .form-control--has-help-text.form-control--medium .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-medium);
  }

  .form-control--has-help-text.form-control--large .form-control__help-text {
    font-size: var(--sl-input-help-text-font-size-large);
  }

  .form-control--has-help-text.form-control--radio-group .form-control__help-text {
    margin-top: var(--sl-spacing-2x-small);
  }
`;/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Gp=Ol(class extends Il{constructor(t){if(super(t),t.type!==Ur.PROPERTY&&t.type!==Ur.ATTRIBUTE&&t.type!==Ur.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!Np(t))throw Error("`live` bindings can only contain a single expression")}render(t){return t}update(t,[e]){if(e===At||e===F)return e;const r=t.element,i=t.name;if(t.type===Ur.PROPERTY){if(e===r[i])return At}else if(t.type===Ur.BOOLEAN_ATTRIBUTE){if(!!e===r.hasAttribute(i))return At}else if(t.type===Ur.ATTRIBUTE&&r.getAttribute(i)===e+"")return At;return Hp(t),e}});var oe=class extends at{constructor(){super(...arguments),this.formControlController=new Vd(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new fa(this,"help-text","label"),this.localize=new Bi(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var t;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((t=this.input)==null?void 0:t.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(t){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=t,this.value=this.__dateInput.value}get valueAsNumber(){var t;return this.__numberInput.value=this.value,((t=this.input)==null?void 0:t.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(t){this.__numberInput.valueAsNumber=t,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(t){t.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}handleKeyDown(t){const e=t.metaKey||t.ctrlKey||t.shiftKey||t.altKey;t.key==="Enter"&&!e&&setTimeout(()=>{!t.defaultPrevented&&!t.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(t){this.input.focus(t)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(t,e,r="none"){this.input.setSelectionRange(t,e,r)}setRangeText(t,e,r,i="preserve"){const s=e??this.input.selectionStart,a=r??this.input.selectionEnd;this.input.setRangeText(t,s,a,i),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(t){this.input.setCustomValidity(t),this.formControlController.updateValidity()}render(){const t=this.hasSlotController.test("label"),e=this.hasSlotController.test("help-text"),r=this.label?!0:!!t,i=this.helpText?!0:!!e,a=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return p`
      <div
        part="form-control"
        class=${Pt({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":i})}
      >
        <label
          part="form-control-label"
          class="form-control__label"
          for="input"
          aria-hidden=${r?"false":"true"}
        >
          <slot name="label">${this.label}</slot>
        </label>

        <div part="form-control-input" class="form-control-input">
          <div
            part="base"
            class=${Pt({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
          >
            <span part="prefix" class="input__prefix">
              <slot name="prefix"></slot>
            </span>

            <input
              part="input"
              id="input"
              class="input__control"
              type=${this.type==="password"&&this.passwordVisible?"text":this.type}
              title=${this.title}
              name=${he(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${he(this.placeholder)}
              minlength=${he(this.minlength)}
              maxlength=${he(this.maxlength)}
              min=${he(this.min)}
              max=${he(this.max)}
              step=${he(this.step)}
              .value=${Gp(this.value)}
              autocapitalize=${he(this.autocapitalize)}
              autocomplete=${he(this.autocomplete)}
              autocorrect=${he(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${he(this.pattern)}
              enterkeyhint=${he(this.enterkeyhint)}
              inputmode=${he(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${a?p`
                  <button
                    part="clear-button"
                    class="input__clear"
                    type="button"
                    aria-label=${this.localize.term("clearEntry")}
                    @click=${this.handleClearClick}
                    tabindex="-1"
                  >
                    <slot name="clear-icon">
                      <sl-icon name="x-circle-fill" library="system"></sl-icon>
                    </slot>
                  </button>
                `:""}
            ${this.passwordToggle&&!this.disabled?p`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible?p`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `:p`
                          <slot name="hide-password-icon">
                            <sl-icon name="eye" library="system"></sl-icon>
                          </slot>
                        `}
                  </button>
                `:""}

            <span part="suffix" class="input__suffix">
              <slot name="suffix"></slot>
            </span>
          </div>
        </div>

        <div
          part="form-control-help-text"
          id="help-text"
          class="form-control__help-text"
          aria-hidden=${i?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};oe.styles=[Gt,Vp,jp];oe.dependencies={"sl-icon":Bt};E([ht(".input__control")],oe.prototype,"input",2);E([$()],oe.prototype,"hasFocus",2);E([w()],oe.prototype,"title",2);E([w({reflect:!0})],oe.prototype,"type",2);E([w()],oe.prototype,"name",2);E([w()],oe.prototype,"value",2);E([Wp()],oe.prototype,"defaultValue",2);E([w({reflect:!0})],oe.prototype,"size",2);E([w({type:Boolean,reflect:!0})],oe.prototype,"filled",2);E([w({type:Boolean,reflect:!0})],oe.prototype,"pill",2);E([w()],oe.prototype,"label",2);E([w({attribute:"help-text"})],oe.prototype,"helpText",2);E([w({type:Boolean})],oe.prototype,"clearable",2);E([w({type:Boolean,reflect:!0})],oe.prototype,"disabled",2);E([w()],oe.prototype,"placeholder",2);E([w({type:Boolean,reflect:!0})],oe.prototype,"readonly",2);E([w({attribute:"password-toggle",type:Boolean})],oe.prototype,"passwordToggle",2);E([w({attribute:"password-visible",type:Boolean})],oe.prototype,"passwordVisible",2);E([w({attribute:"no-spin-buttons",type:Boolean})],oe.prototype,"noSpinButtons",2);E([w({reflect:!0})],oe.prototype,"form",2);E([w({type:Boolean,reflect:!0})],oe.prototype,"required",2);E([w()],oe.prototype,"pattern",2);E([w({type:Number})],oe.prototype,"minlength",2);E([w({type:Number})],oe.prototype,"maxlength",2);E([w()],oe.prototype,"min",2);E([w()],oe.prototype,"max",2);E([w()],oe.prototype,"step",2);E([w()],oe.prototype,"autocapitalize",2);E([w()],oe.prototype,"autocorrect",2);E([w()],oe.prototype,"autocomplete",2);E([w({type:Boolean})],oe.prototype,"autofocus",2);E([w()],oe.prototype,"enterkeyhint",2);E([w({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="false"),toAttribute:t=>t?"true":"false"}})],oe.prototype,"spellcheck",2);E([w()],oe.prototype,"inputmode",2);E([ot("disabled",{waitUntilFirstUpdate:!0})],oe.prototype,"handleDisabledChange",1);E([ot("step",{waitUntilFirstUpdate:!0})],oe.prototype,"handleStepChange",1);E([ot("value",{waitUntilFirstUpdate:!0})],oe.prototype,"handleValueChange",1);oe.define("sl-input");var Xp=U`
  :host {
    --border-color: var(--sl-color-neutral-200);
    --border-radius: var(--sl-border-radius-medium);
    --border-width: 1px;
    --padding: var(--sl-spacing-large);

    display: inline-block;
  }

  .card {
    display: flex;
    flex-direction: column;
    background-color: var(--sl-panel-background-color);
    box-shadow: var(--sl-shadow-x-small);
    border: solid var(--border-width) var(--border-color);
    border-radius: var(--border-radius);
  }

  .card__image {
    display: flex;
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
    margin: calc(-1 * var(--border-width));
    overflow: hidden;
  }

  .card__image::slotted(img) {
    display: block;
    width: 100%;
  }

  .card:not(.card--has-image) .card__image {
    display: none;
  }

  .card__header {
    display: block;
    border-bottom: solid var(--border-width) var(--border-color);
    padding: calc(var(--padding) / 2) var(--padding);
  }

  .card:not(.card--has-header) .card__header {
    display: none;
  }

  .card:not(.card--has-image) .card__header {
    border-top-left-radius: var(--border-radius);
    border-top-right-radius: var(--border-radius);
  }

  .card__body {
    display: block;
    padding: var(--padding);
  }

  .card--has-footer .card__footer {
    display: block;
    border-top: solid var(--border-width) var(--border-color);
    padding: var(--padding);
  }

  .card:not(.card--has-footer) .card__footer {
    display: none;
  }
`,Xd=class extends at{constructor(){super(...arguments),this.hasSlotController=new fa(this,"footer","header","image")}render(){return p`
      <div
        part="base"
        class=${Pt({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};Xd.styles=[Gt,Xp];Xd.define("sl-card");var Kp=U`
  :host {
    display: inline-block;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-semibold);
    border-radius: var(--sl-border-radius-medium);
    color: var(--sl-color-neutral-600);
    padding: var(--sl-spacing-medium) var(--sl-spacing-large);
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
    transition:
      var(--transition-speed) box-shadow,
      var(--transition-speed) color;
  }

  .tab:hover:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  :host(:focus) {
    outline: transparent;
  }

  :host(:focus-visible) {
    color: var(--sl-color-primary-600);
    outline: var(--sl-focus-ring);
    outline-offset: calc(-1 * var(--sl-focus-ring-width) - var(--sl-focus-ring-offset));
  }

  .tab.tab--active:not(.tab--disabled) {
    color: var(--sl-color-primary-600);
  }

  .tab.tab--closable {
    padding-inline-end: var(--sl-spacing-small);
  }

  .tab.tab--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab__close-button {
    font-size: var(--sl-font-size-small);
    margin-inline-start: var(--sl-spacing-small);
  }

  .tab__close-button::part(base) {
    padding: var(--sl-spacing-3x-small);
  }

  @media (forced-colors: active) {
    .tab.tab--active:not(.tab--disabled) {
      outline: solid 1px transparent;
      outline-offset: -3px;
    }
  }
`,Yp=U`
  :host {
    display: inline-block;
    color: var(--sl-color-neutral-600);
  }

  .icon-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--sl-border-radius-medium);
    font-size: inherit;
    color: inherit;
    padding: var(--sl-spacing-x-small);
    cursor: pointer;
    transition: var(--sl-transition-x-fast) color;
    -webkit-appearance: none;
  }

  .icon-button:hover:not(.icon-button--disabled),
  .icon-button:focus-visible:not(.icon-button--disabled) {
    color: var(--sl-color-primary-600);
  }

  .icon-button:active:not(.icon-button--disabled) {
    color: var(--sl-color-primary-700);
  }

  .icon-button:focus {
    outline: none;
  }

  .icon-button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-button:focus-visible {
    outline: var(--sl-focus-ring);
    outline-offset: var(--sl-focus-ring-offset);
  }

  .icon-button__icon {
    pointer-events: none;
  }
`,Je=class extends at{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(t){this.disabled&&(t.preventDefault(),t.stopPropagation())}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}render(){const t=!!this.href,e=t?ro`a`:ro`button`;return Ja`
      <${e}
        part="base"
        class=${Pt({"icon-button":!0,"icon-button--disabled":!t&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${he(t?void 0:this.disabled)}
        type=${he(t?void 0:"button")}
        href=${he(t?this.href:void 0)}
        target=${he(t?this.target:void 0)}
        download=${he(t?this.download:void 0)}
        rel=${he(t&&this.target?"noreferrer noopener":void 0)}
        role=${he(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${he(this.name)}
          library=${he(this.library)}
          src=${he(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${e}>
    `}};Je.styles=[Gt,Yp];Je.dependencies={"sl-icon":Bt};E([ht(".icon-button")],Je.prototype,"button",2);E([$()],Je.prototype,"hasFocus",2);E([w()],Je.prototype,"name",2);E([w()],Je.prototype,"library",2);E([w()],Je.prototype,"src",2);E([w()],Je.prototype,"href",2);E([w()],Je.prototype,"target",2);E([w()],Je.prototype,"download",2);E([w()],Je.prototype,"label",2);E([w({type:Boolean,reflect:!0})],Je.prototype,"disabled",2);var Zp=0,Xt=class extends at{constructor(){super(...arguments),this.localize=new Bi(this),this.attrId=++Zp,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(t){t.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,p`
      <div
        part="base"
        class=${Pt({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
      >
        <slot></slot>
        ${this.closable?p`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                class="tab__close-button"
                @click=${this.handleCloseClick}
                tabindex="-1"
              ></sl-icon-button>
            `:""}
      </div>
    `}};Xt.styles=[Gt,Kp];Xt.dependencies={"sl-icon-button":Je};E([ht(".tab")],Xt.prototype,"tab",2);E([w({reflect:!0})],Xt.prototype,"panel",2);E([w({type:Boolean,reflect:!0})],Xt.prototype,"active",2);E([w({type:Boolean,reflect:!0})],Xt.prototype,"closable",2);E([w({type:Boolean,reflect:!0})],Xt.prototype,"disabled",2);E([w({type:Number,reflect:!0})],Xt.prototype,"tabIndex",2);E([ot("active")],Xt.prototype,"handleActiveChange",1);E([ot("disabled")],Xt.prototype,"handleDisabledChange",1);Xt.define("sl-tab");var Jp=U`
  :host {
    --indicator-color: var(--sl-color-primary-600);
    --track-color: var(--sl-color-neutral-200);
    --track-width: 2px;

    display: block;
  }

  .tab-group {
    display: flex;
    border-radius: 0;
  }

  .tab-group__tabs {
    display: flex;
    position: relative;
  }

  .tab-group__indicator {
    position: absolute;
    transition:
      var(--sl-transition-fast) translate ease,
      var(--sl-transition-fast) width ease;
  }

  .tab-group--has-scroll-controls .tab-group__nav-container {
    position: relative;
    padding: 0 var(--sl-spacing-x-large);
  }

  .tab-group--has-scroll-controls .tab-group__scroll-button--start--hidden,
  .tab-group--has-scroll-controls .tab-group__scroll-button--end--hidden {
    visibility: hidden;
  }

  .tab-group__body {
    display: block;
    overflow: auto;
  }

  .tab-group__scroll-button {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--sl-spacing-x-large);
  }

  .tab-group__scroll-button--start {
    left: 0;
  }

  .tab-group__scroll-button--end {
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--start {
    left: auto;
    right: 0;
  }

  .tab-group--rtl .tab-group__scroll-button--end {
    left: 0;
    right: auto;
  }

  /*
   * Top
   */

  .tab-group--top {
    flex-direction: column;
  }

  .tab-group--top .tab-group__nav-container {
    order: 1;
  }

  .tab-group--top .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--top .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--top .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-bottom: solid var(--track-width) var(--track-color);
  }

  .tab-group--top .tab-group__indicator {
    bottom: calc(-1 * var(--track-width));
    border-bottom: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--top .tab-group__body {
    order: 2;
  }

  .tab-group--top ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Bottom
   */

  .tab-group--bottom {
    flex-direction: column;
  }

  .tab-group--bottom .tab-group__nav-container {
    order: 2;
  }

  .tab-group--bottom .tab-group__nav {
    display: flex;
    overflow-x: auto;

    /* Hide scrollbar in Firefox */
    scrollbar-width: none;
  }

  /* Hide scrollbar in Chrome/Safari */
  .tab-group--bottom .tab-group__nav::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .tab-group--bottom .tab-group__tabs {
    flex: 1 1 auto;
    position: relative;
    flex-direction: row;
    border-top: solid var(--track-width) var(--track-color);
  }

  .tab-group--bottom .tab-group__indicator {
    top: calc(-1 * var(--track-width));
    border-top: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--bottom .tab-group__body {
    order: 1;
  }

  .tab-group--bottom ::slotted(sl-tab-panel) {
    --padding: var(--sl-spacing-medium) 0;
  }

  /*
   * Start
   */

  .tab-group--start {
    flex-direction: row;
  }

  .tab-group--start .tab-group__nav-container {
    order: 1;
  }

  .tab-group--start .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-inline-end: solid var(--track-width) var(--track-color);
  }

  .tab-group--start .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    border-right: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--start.tab-group--rtl .tab-group__indicator {
    right: auto;
    left: calc(-1 * var(--track-width));
  }

  .tab-group--start .tab-group__body {
    flex: 1 1 auto;
    order: 2;
  }

  .tab-group--start ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }

  /*
   * End
   */

  .tab-group--end {
    flex-direction: row;
  }

  .tab-group--end .tab-group__nav-container {
    order: 2;
  }

  .tab-group--end .tab-group__tabs {
    flex: 0 0 auto;
    flex-direction: column;
    border-left: solid var(--track-width) var(--track-color);
  }

  .tab-group--end .tab-group__indicator {
    left: calc(-1 * var(--track-width));
    border-inline-start: solid var(--track-width) var(--indicator-color);
  }

  .tab-group--end.tab-group--rtl .tab-group__indicator {
    right: calc(-1 * var(--track-width));
    left: auto;
  }

  .tab-group--end .tab-group__body {
    flex: 1 1 auto;
    order: 1;
  }

  .tab-group--end ::slotted(sl-tab-panel) {
    --padding: 0 var(--sl-spacing-medium);
  }
`,Qp=U`
  :host {
    display: contents;
  }
`,$o=class extends at{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(t=>{this.emit("sl-resize",{detail:{entries:t}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const t=this.shadowRoot.querySelector("slot");if(t!==null){const e=t.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],e.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return p` <slot @slotchange=${this.handleSlotChange}></slot> `}};$o.styles=[Gt,Qp];E([w({type:Boolean,reflect:!0})],$o.prototype,"disabled",2);E([ot("disabled",{waitUntilFirstUpdate:!0})],$o.prototype,"handleDisabledChange",1);function e1(t,e){return{top:Math.round(t.getBoundingClientRect().top-e.getBoundingClientRect().top),left:Math.round(t.getBoundingClientRect().left-e.getBoundingClientRect().left)}}var jn=new Set;function t1(){const t=document.documentElement.clientWidth;return Math.abs(window.innerWidth-t)}function r1(){const t=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(t)||!t?0:t}function fn(t){if(jn.add(t),!document.documentElement.classList.contains("sl-scroll-lock")){const e=t1()+r1();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),e<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${e}px`)}}function mn(t){jn.delete(t),jn.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function Qc(t,e,r="vertical",i="smooth"){const s=e1(t,e),a=s.top+e.scrollTop,o=s.left+e.scrollLeft,l=e.scrollLeft,c=e.scrollLeft+e.offsetWidth,h=e.scrollTop,f=e.scrollTop+e.offsetHeight;(r==="horizontal"||r==="both")&&(o<l?e.scrollTo({left:o,behavior:i}):o+t.clientWidth>c&&e.scrollTo({left:o-e.offsetWidth+t.clientWidth,behavior:i})),(r==="vertical"||r==="both")&&(a<h?e.scrollTo({top:a,behavior:i}):a+t.clientHeight>f&&e.scrollTo({top:a-e.offsetHeight+t.clientHeight,behavior:i}))}var Xe=class extends at{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new Bi(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const t=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(e=>{const r=e.filter(({target:i})=>{if(i===this)return!0;if(i.closest("sl-tab-group")!==this)return!1;const s=i.tagName.toLowerCase();return s==="sl-tab"||s==="sl-tab-panel"});if(r.length!==0){if(r.some(i=>!["aria-labelledby","aria-controls"].includes(i.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(i=>i.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(i=>i.attributeName==="active")){const s=r.filter(a=>a.attributeName==="active"&&a.target.tagName.toLowerCase()==="sl-tab").map(a=>a.target).find(a=>a.active);s&&this.setActiveTab(s)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),t.then(()=>{new IntersectionObserver((r,i)=>{var s;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),i.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var t,e;super.disconnectedCallback(),(t=this.mutationObserver)==null||t.disconnect(),this.nav&&((e=this.resizeObserver)==null||e.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(t=>t.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(t=>t.active)}handleClick(t){const r=t.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(t){const r=t.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(t.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),t.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key))){const s=this.tabs.find(l=>l.matches(":focus")),a=this.localize.dir()==="rtl";let o=null;if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){if(t.key==="Home")o=this.focusableTabs[0];else if(t.key==="End")o=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&t.key===(a?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&t.key==="ArrowUp"){const l=this.tabs.findIndex(c=>c===s);o=this.findNextFocusableTab(l,"backward")}else if(["top","bottom"].includes(this.placement)&&t.key===(a?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&t.key==="ArrowDown"){const l=this.tabs.findIndex(c=>c===s);o=this.findNextFocusableTab(l,"forward")}if(!o)return;o.tabIndex=0,o.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(o,{scrollBehavior:"smooth"}):this.tabs.forEach(l=>{l.tabIndex=l===o?0:-1}),["top","bottom"].includes(this.placement)&&Qc(o,this.nav,"horizontal"),t.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(t,e){if(e=Ni({emitEvents:!0,scrollBehavior:"auto"},e),t!==this.activeTab&&!t.disabled){const r=this.activeTab;this.activeTab=t,this.tabs.forEach(i=>{i.active=i===this.activeTab,i.tabIndex=i===this.activeTab?0:-1}),this.panels.forEach(i=>{var s;return i.active=i.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&Qc(this.activeTab,this.nav,"horizontal",e.scrollBehavior),e.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(t=>{const e=this.panels.find(r=>r.name===t.panel);e&&(t.setAttribute("aria-controls",e.getAttribute("id")),e.setAttribute("aria-labelledby",t.getAttribute("id")))})}repositionIndicator(){const t=this.getActiveTab();if(!t)return;const e=t.clientWidth,r=t.clientHeight,i=this.localize.dir()==="rtl",s=this.getAllTabs(),o=s.slice(0,s.indexOf(t)).reduce((l,c)=>({left:l.left+c.clientWidth,top:l.top+c.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${e}px`,this.indicator.style.height="auto",this.indicator.style.translate=i?`${-1*o.left}px`:`${o.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${o.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(t=>!t.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(t,e){let r=null;const i=e==="forward"?1:-1;let s=t+i;for(;t<this.tabs.length;){if(r=this.tabs[s]||null,r===null){e==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;s+=i}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(t){const e=this.tabs.find(r=>r.panel===t);e&&this.setActiveTab(e,{scrollBehavior:"smooth"})}render(){const t=this.localize.dir()==="rtl";return p`
      <div
        part="base"
        class=${Pt({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?p`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${Pt({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
                  name=${t?"chevron-right":"chevron-left"}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term("scrollToStart")}
                  @click=${this.handleScrollToStart}
                ></sl-icon-button>
              `:""}

          <div class="tab-group__nav" @scrollend=${this.updateScrollButtons}>
            <div part="tabs" class="tab-group__tabs" role="tablist">
              <div part="active-tab-indicator" class="tab-group__indicator"></div>
              <sl-resize-observer @sl-resize=${this.syncIndicator}>
                <slot name="nav" @slotchange=${this.syncTabsAndPanels}></slot>
              </sl-resize-observer>
            </div>
          </div>

          ${this.hasScrollControls?p`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${Pt({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
                  name=${t?"chevron-left":"chevron-right"}
                  library="system"
                  tabindex="-1"
                  aria-hidden="true"
                  label=${this.localize.term("scrollToEnd")}
                  @click=${this.handleScrollToEnd}
                ></sl-icon-button>
              `:""}
        </div>

        <slot part="body" class="tab-group__body" @slotchange=${this.syncTabsAndPanels}></slot>
      </div>
    `}};Xe.styles=[Gt,Jp];Xe.dependencies={"sl-icon-button":Je,"sl-resize-observer":$o};E([ht(".tab-group")],Xe.prototype,"tabGroup",2);E([ht(".tab-group__body")],Xe.prototype,"body",2);E([ht(".tab-group__nav")],Xe.prototype,"nav",2);E([ht(".tab-group__indicator")],Xe.prototype,"indicator",2);E([$()],Xe.prototype,"hasScrollControls",2);E([$()],Xe.prototype,"shouldHideScrollStartButton",2);E([$()],Xe.prototype,"shouldHideScrollEndButton",2);E([w()],Xe.prototype,"placement",2);E([w()],Xe.prototype,"activation",2);E([w({attribute:"no-scroll-controls",type:Boolean})],Xe.prototype,"noScrollControls",2);E([w({attribute:"fixed-scroll-controls",type:Boolean})],Xe.prototype,"fixedScrollControls",2);E([$p({passive:!0})],Xe.prototype,"updateScrollButtons",1);E([ot("noScrollControls",{waitUntilFirstUpdate:!0})],Xe.prototype,"updateScrollControls",1);E([ot("placement",{waitUntilFirstUpdate:!0})],Xe.prototype,"syncIndicator",1);Xe.define("sl-tab-group");var i1=(t,e)=>{let r=0;return function(...i){window.clearTimeout(r),r=window.setTimeout(()=>{t.call(this,...i)},e)}},e0=(t,e,r)=>{const i=t[e];t[e]=function(...s){i.call(this,...s),r.call(this,i,...s)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const e=new Set,r=new WeakMap,i=a=>{for(const o of a.changedTouches)e.add(o.identifier)},s=a=>{for(const o of a.changedTouches)e.delete(o.identifier)};document.addEventListener("touchstart",i,!0),document.addEventListener("touchend",s,!0),document.addEventListener("touchcancel",s,!0),e0(EventTarget.prototype,"addEventListener",function(a,o){if(o!=="scrollend")return;const l=i1(()=>{e.size?l():this.dispatchEvent(new Event("scrollend"))},100);a.call(this,"scroll",l,{passive:!0}),r.set(this,l)}),e0(EventTarget.prototype,"removeEventListener",function(a,o){if(o!=="scrollend")return;const l=r.get(this);l&&a.call(this,"scroll",l,{passive:!0})})}})();var s1=U`
  :host {
    --size: 25rem;
    --header-spacing: var(--sl-spacing-large);
    --body-spacing: var(--sl-spacing-large);
    --footer-spacing: var(--sl-spacing-large);

    display: contents;
  }

  .drawer {
    top: 0;
    inset-inline-start: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
  }

  .drawer--contained {
    position: absolute;
    z-index: initial;
  }

  .drawer--fixed {
    position: fixed;
    z-index: var(--sl-z-index-drawer);
  }

  .drawer__panel {
    position: absolute;
    display: flex;
    flex-direction: column;
    z-index: 2;
    max-width: 100%;
    max-height: 100%;
    background-color: var(--sl-panel-background-color);
    box-shadow: var(--sl-shadow-x-large);
    overflow: auto;
    pointer-events: all;
  }

  .drawer__panel:focus {
    outline: none;
  }

  .drawer--top .drawer__panel {
    top: 0;
    inset-inline-end: auto;
    bottom: auto;
    inset-inline-start: 0;
    width: 100%;
    height: var(--size);
  }

  .drawer--end .drawer__panel {
    top: 0;
    inset-inline-end: 0;
    bottom: auto;
    inset-inline-start: auto;
    width: var(--size);
    height: 100%;
  }

  .drawer--bottom .drawer__panel {
    top: auto;
    inset-inline-end: auto;
    bottom: 0;
    inset-inline-start: 0;
    width: 100%;
    height: var(--size);
  }

  .drawer--start .drawer__panel {
    top: 0;
    inset-inline-end: auto;
    bottom: auto;
    inset-inline-start: 0;
    width: var(--size);
    height: 100%;
  }

  .drawer__header {
    display: flex;
  }

  .drawer__title {
    flex: 1 1 auto;
    font: inherit;
    font-size: var(--sl-font-size-large);
    line-height: var(--sl-line-height-dense);
    padding: var(--header-spacing);
    margin: 0;
  }

  .drawer__header-actions {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: var(--sl-spacing-2x-small);
    padding: 0 var(--header-spacing);
  }

  .drawer__header-actions sl-icon-button,
  .drawer__header-actions ::slotted(sl-icon-button) {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-medium);
  }

  .drawer__body {
    flex: 1 1 auto;
    display: block;
    padding: var(--body-spacing);
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  .drawer__footer {
    text-align: right;
    padding: var(--footer-spacing);
  }

  .drawer__footer ::slotted(sl-button:not(:last-of-type)) {
    margin-inline-end: var(--sl-spacing-x-small);
  }

  .drawer:not(.drawer--has-footer) .drawer__footer {
    display: none;
  }

  .drawer__overlay {
    display: block;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: var(--sl-overlay-background-color);
    pointer-events: all;
  }

  .drawer--contained .drawer__overlay {
    display: none;
  }

  @media (forced-colors: active) {
    .drawer__panel {
      border: solid 1px var(--sl-color-neutral-0);
    }
  }
`;function*Rl(t=document.activeElement){t!=null&&(yield t,"shadowRoot"in t&&t.shadowRoot&&t.shadowRoot.mode!=="closed"&&(yield*kp(Rl(t.shadowRoot.activeElement))))}function a1(){return[...Rl()].pop()}var t0=new WeakMap;function Kd(t){let e=t0.get(t);return e||(e=window.getComputedStyle(t,null),t0.set(t,e)),e}function o1(t){if(typeof t.checkVisibility=="function")return t.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const e=Kd(t);return e.visibility!=="hidden"&&e.display!=="none"}function n1(t){const e=Kd(t),{overflowY:r,overflowX:i}=e;return r==="scroll"||i==="scroll"?!0:r!=="auto"||i!=="auto"?!1:t.scrollHeight>t.clientHeight&&r==="auto"||t.scrollWidth>t.clientWidth&&i==="auto"}function l1(t){const e=t.tagName.toLowerCase(),r=Number(t.getAttribute("tabindex"));if(t.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||t.hasAttribute("disabled")||t.closest("[inert]"))return!1;if(e==="input"&&t.getAttribute("type")==="radio"){const a=t.getRootNode(),o=`input[type='radio'][name="${t.getAttribute("name")}"]`,l=a.querySelector(`${o}:checked`);return l?l===t:a.querySelector(o)===t}return o1(t)?(e==="audio"||e==="video")&&t.hasAttribute("controls")||t.hasAttribute("tabindex")||t.hasAttribute("contenteditable")&&t.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(e)?!0:n1(t):!1}function c1(t,e){var r;return((r=t.getRootNode({composed:!0}))==null?void 0:r.host)!==e}function r0(t){const e=new WeakMap,r=[];function i(s){if(s instanceof Element){if(s.hasAttribute("inert")||s.closest("[inert]")||e.has(s))return;e.set(s,!0),!r.includes(s)&&l1(s)&&r.push(s),s instanceof HTMLSlotElement&&c1(s,t)&&s.assignedElements({flatten:!0}).forEach(a=>{i(a)}),s.shadowRoot!==null&&s.shadowRoot.mode==="open"&&i(s.shadowRoot)}for(const a of s.children)i(a)}return i(t),r.sort((s,a)=>{const o=Number(s.getAttribute("tabindex"))||0;return(Number(a.getAttribute("tabindex"))||0)-o})}var Hs=[],d1=class{constructor(t){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=e=>{var r;if(e.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const i=a1();if(this.previousFocus=i,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;e.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const s=r0(this.element);let a=s.findIndex(l=>l===i);this.previousFocus=this.currentFocus;const o=this.tabDirection==="forward"?1:-1;for(;;){a+o>=s.length?a=0:a+o<0?a=s.length-1:a+=o,this.previousFocus=this.currentFocus;const l=s[a];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||l&&this.possiblyHasTabbableChildren(l))return;e.preventDefault(),this.currentFocus=l,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const c=[...Rl()];if(c.includes(this.currentFocus)||!c.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=t,this.elementsWithTabbableControls=["iframe"]}activate(){Hs.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){Hs=Hs.filter(t=>t!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return Hs[Hs.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const t=r0(this.element);if(!this.element.matches(":focus-within")){const e=t[0],r=t[t.length-1],i=this.tabDirection==="forward"?e:r;typeof(i==null?void 0:i.focus)=="function"&&(this.currentFocus=i,i.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(t){return this.elementsWithTabbableControls.includes(t.tagName.toLowerCase())||t.hasAttribute("controls")}},Yd=t=>{var e;const{activeElement:r}=document;r&&t.contains(r)&&((e=document.activeElement)==null||e.blur())},Zd=new Map,u1=new WeakMap;function h1(t){return t??{keyframes:[],options:{duration:0}}}function i0(t,e){return e.toLowerCase()==="rtl"?{keyframes:t.rtlKeyframes||t.keyframes,options:t.options}:t}function wt(t,e){Zd.set(t,h1(e))}function _i(t,e,r){const i=u1.get(t);if(i!=null&&i[e])return i0(i[e],r.dir);const s=Zd.get(e);return s?i0(s,r.dir):{keyframes:[],options:{duration:0}}}function io(t,e){return new Promise(r=>{function i(s){s.target===t&&(t.removeEventListener(e,i),r())}t.addEventListener(e,i)})}function ki(t,e,r){return new Promise(i=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=t.animate(e,Pl(Ni({},r),{duration:p1()?0:r.duration}));s.addEventListener("cancel",i,{once:!0}),s.addEventListener("finish",i,{once:!0})})}function p1(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function ss(t){return Promise.all(t.getAnimations().map(e=>new Promise(r=>{e.cancel(),requestAnimationFrame(r)})))}function s0(t){return t.charAt(0).toUpperCase()+t.slice(1)}var _t=class extends at{constructor(){super(...arguments),this.hasSlotController=new fa(this,"footer"),this.localize=new Bi(this),this.modal=new d1(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=t=>{this.contained||t.key==="Escape"&&this.modal.isActive()&&this.open&&(t.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),fn(this)))}disconnectedCallback(){super.disconnectedCallback(),mn(this),this.removeOpenListeners()}requestClose(t){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:t}}).defaultPrevented){const r=_i(this,"drawer.denyClose",{dir:this.localize.dir()});ki(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var t;"CloseWatcher"in window?((t=this.closeWatcher)==null||t.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var t;document.removeEventListener("keydown",this.handleDocumentKeyDown),(t=this.closeWatcher)==null||t.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),fn(this));const t=this.querySelector("[autofocus]");t&&t.removeAttribute("autofocus"),await Promise.all([ss(this.drawer),ss(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(t?t.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),t&&t.setAttribute("autofocus","")});const e=_i(this,`drawer.show${s0(this.placement)}`,{dir:this.localize.dir()}),r=_i(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([ki(this.panel,e.keyframes,e.options),ki(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{Yd(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),mn(this)),await Promise.all([ss(this.drawer),ss(this.overlay)]);const t=_i(this,`drawer.hide${s0(this.placement)}`,{dir:this.localize.dir()}),e=_i(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([ki(this.overlay,e.keyframes,e.options).then(()=>{this.overlay.hidden=!0}),ki(this.panel,t.keyframes,t.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),fn(this)),this.open&&this.contained&&(this.modal.deactivate(),mn(this))}async show(){if(!this.open)return this.open=!0,io(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,io(this,"sl-after-hide")}render(){return p`
      <div
        part="base"
        class=${Pt({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${he(this.noHeader?this.label:void 0)}
          aria-labelledby=${he(this.noHeader?void 0:"title")}
          tabindex="0"
        >
          ${this.noHeader?"":p`
                <header part="header" class="drawer__header">
                  <h2 part="title" class="drawer__title" id="title">
                    <!-- If there's no label, use an invisible character to prevent the header from collapsing -->
                    <slot name="label"> ${this.label.length>0?this.label:"\uFEFF"} </slot>
                  </h2>
                  <div part="header-actions" class="drawer__header-actions">
                    <slot name="header-actions"></slot>
                    <sl-icon-button
                      part="close-button"
                      exportparts="base:close-button__base"
                      class="drawer__close"
                      name="x-lg"
                      label=${this.localize.term("close")}
                      library="system"
                      @click=${()=>this.requestClose("close-button")}
                    ></sl-icon-button>
                  </div>
                </header>
              `}

          <slot part="body" class="drawer__body"></slot>

          <footer part="footer" class="drawer__footer">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    `}};_t.styles=[Gt,s1];_t.dependencies={"sl-icon-button":Je};E([ht(".drawer")],_t.prototype,"drawer",2);E([ht(".drawer__panel")],_t.prototype,"panel",2);E([ht(".drawer__overlay")],_t.prototype,"overlay",2);E([w({type:Boolean,reflect:!0})],_t.prototype,"open",2);E([w({reflect:!0})],_t.prototype,"label",2);E([w({reflect:!0})],_t.prototype,"placement",2);E([w({type:Boolean,reflect:!0})],_t.prototype,"contained",2);E([w({attribute:"no-header",type:Boolean,reflect:!0})],_t.prototype,"noHeader",2);E([ot("open",{waitUntilFirstUpdate:!0})],_t.prototype,"handleOpenChange",1);E([ot("contained",{waitUntilFirstUpdate:!0})],_t.prototype,"handleNoModalChange",1);wt("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});wt("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});wt("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});wt("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});wt("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});wt("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});wt("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});wt("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});wt("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});wt("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});wt("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});_t.define("sl-drawer");var f1=U`
  :host {
    display: contents;

    /* For better DX, we'll reset the margin here so the base part can inherit it */
    margin: 0;
  }

  .alert {
    position: relative;
    display: flex;
    align-items: stretch;
    background-color: var(--sl-panel-background-color);
    border: solid var(--sl-panel-border-width) var(--sl-panel-border-color);
    border-top-width: calc(var(--sl-panel-border-width) * 3);
    border-radius: var(--sl-border-radius-medium);
    font-family: var(--sl-font-sans);
    font-size: var(--sl-font-size-small);
    font-weight: var(--sl-font-weight-normal);
    line-height: 1.6;
    color: var(--sl-color-neutral-700);
    margin: inherit;
    overflow: hidden;
  }

  .alert:not(.alert--has-icon) .alert__icon,
  .alert:not(.alert--closable) .alert__close-button {
    display: none;
  }

  .alert__icon {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-large);
    padding-inline-start: var(--sl-spacing-large);
  }

  .alert--has-countdown {
    border-bottom: none;
  }

  .alert--primary {
    border-top-color: var(--sl-color-primary-600);
  }

  .alert--primary .alert__icon {
    color: var(--sl-color-primary-600);
  }

  .alert--success {
    border-top-color: var(--sl-color-success-600);
  }

  .alert--success .alert__icon {
    color: var(--sl-color-success-600);
  }

  .alert--neutral {
    border-top-color: var(--sl-color-neutral-600);
  }

  .alert--neutral .alert__icon {
    color: var(--sl-color-neutral-600);
  }

  .alert--warning {
    border-top-color: var(--sl-color-warning-600);
  }

  .alert--warning .alert__icon {
    color: var(--sl-color-warning-600);
  }

  .alert--danger {
    border-top-color: var(--sl-color-danger-600);
  }

  .alert--danger .alert__icon {
    color: var(--sl-color-danger-600);
  }

  .alert__message {
    flex: 1 1 auto;
    display: block;
    padding: var(--sl-spacing-large);
    overflow: hidden;
  }

  .alert__close-button {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    font-size: var(--sl-font-size-medium);
    margin-inline-end: var(--sl-spacing-medium);
    align-self: center;
  }

  .alert__countdown {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: calc(var(--sl-panel-border-width) * 3);
    background-color: var(--sl-panel-border-color);
    display: flex;
  }

  .alert__countdown--ltr {
    justify-content: flex-end;
  }

  .alert__countdown .alert__countdown-elapsed {
    height: 100%;
    width: 0;
  }

  .alert--primary .alert__countdown-elapsed {
    background-color: var(--sl-color-primary-600);
  }

  .alert--success .alert__countdown-elapsed {
    background-color: var(--sl-color-success-600);
  }

  .alert--neutral .alert__countdown-elapsed {
    background-color: var(--sl-color-neutral-600);
  }

  .alert--warning .alert__countdown-elapsed {
    background-color: var(--sl-color-warning-600);
  }

  .alert--danger .alert__countdown-elapsed {
    background-color: var(--sl-color-danger-600);
  }

  .alert__timer {
    display: none;
  }
`,kt=class yi extends at{constructor(){super(...arguments),this.hasSlotController=new fa(this,"icon","suffix"),this.localize=new Bi(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var e;(e=this.countdownAnimation)==null||e.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var e;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(e=this.countdownAnimation)==null||e.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:e}=this,r="100%",i="0";this.countdownAnimation=e.animate([{width:r},{width:i}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await ss(this.base),this.base.hidden=!1;const{keyframes:e,options:r}=_i(this,"alert.show",{dir:this.localize.dir()});await ki(this.base,e,r),this.emit("sl-after-show")}else{Yd(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await ss(this.base);const{keyframes:e,options:r}=_i(this,"alert.hide",{dir:this.localize.dir()});await ki(this.base,e,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,io(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,io(this,"sl-after-hide")}async toast(){return new Promise(e=>{this.handleCountdownChange(),yi.toastStack.parentElement===null&&document.body.append(yi.toastStack),yi.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{yi.toastStack.removeChild(this),e(),yi.toastStack.querySelector("sl-alert")===null&&yi.toastStack.remove()},{once:!0})})}render(){return p`
      <div
        part="base"
        class=${Pt({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
        role="alert"
        aria-hidden=${this.open?"false":"true"}
        @mouseenter=${this.pauseAutoHide}
        @mouseleave=${this.resumeAutoHide}
      >
        <div part="icon" class="alert__icon">
          <slot name="icon"></slot>
        </div>

        <div part="message" class="alert__message" aria-live="polite">
          <slot></slot>
        </div>

        ${this.closable?p`
              <sl-icon-button
                part="close-button"
                exportparts="base:close-button__base"
                class="alert__close-button"
                name="x-lg"
                library="system"
                label=${this.localize.term("close")}
                @click=${this.handleCloseClick}
              ></sl-icon-button>
            `:""}

        <div role="timer" class="alert__timer">${this.remainingTime}</div>

        ${this.countdown?p`
              <div
                class=${Pt({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};kt.styles=[Gt,f1];kt.dependencies={"sl-icon-button":Je};E([ht('[part~="base"]')],kt.prototype,"base",2);E([ht(".alert__countdown-elapsed")],kt.prototype,"countdownElement",2);E([w({type:Boolean,reflect:!0})],kt.prototype,"open",2);E([w({type:Boolean,reflect:!0})],kt.prototype,"closable",2);E([w({reflect:!0})],kt.prototype,"variant",2);E([w({type:Number})],kt.prototype,"duration",2);E([w({type:String,reflect:!0})],kt.prototype,"countdown",2);E([$()],kt.prototype,"remainingTime",2);E([ot("open",{waitUntilFirstUpdate:!0})],kt.prototype,"handleOpenChange",1);E([ot("duration")],kt.prototype,"handleDurationChange",1);var m1=kt;wt("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});wt("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});m1.define("sl-alert");function v1(t,e){const r=new Set([...Object.keys(t),...Object.keys(e)]);for(const i of r)if((t[i]??"")!==(e[i]??""))return!0;return!1}const b1={view:"search",auth:{required:null,authenticated:!1,hasPassword:!1},search:{state:"initial",currentSession:null,query:"",queryWords:[],results:[],total:0,source:"fts",offset:0,limit:20},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,pendingSkillChat:null,status:null,watcher:null,syncStatus:null,watchRecentChanges:[],reindex:{dialog:"closed",current_file:null,indexed_count:0,sub_label:null,result:null,error:null},error:null,settings:{scope:"global",values:{},original:{},dirty:!1,exists:!0,saving:!1,error:null},files:{treeCache:{},expandedPaths:[],currentDir:"",selectedPaths:[],lastSelectedAnchor:null,detail:null,detailLoading:!1,listing:!1,mobilePane:"tree",pendingAction:null,error:null,filenameSearch:{query:"",allDocs:[],docsLoading:!0,docsError:null,results:[],selectedPath:null,isActive:!1,totalMatches:0}},diary:{tab:"record",today:"",todayEntry:null,recordLoading:!1,submitting:!1,reviewDate:"",reviewEntry:null,reviewLoading:!1,calendarMonth:"",calendarDates:[],calendarOpen:!1,cityDialogOpen:!1,error:null}};class g1{constructor(){this.state=b1,this.listeners=new Set}getState(){return this.state}setState(e){this.state={...this.state,...e},this.listeners.forEach(r=>r(this.state))}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}subscribeSelector(e,r){let i=e(this.state);return this.subscribe(s=>{const a=e(s);a!==i&&(i=a,r(a))})}}const T=new g1,C={setView(t){T.setState({view:t})},setAuthState(t){const e=T.getState().auth;T.setState({auth:{...e,...t}})},setSearchState(t){const e=T.getState().search;T.setState({search:{...e,...t}})},setChatState(t){const e=T.getState().chat;T.setState({chat:{...e,...t}})},pushDetail(t){const e=T.getState().detailStack;T.setState({detailStack:[...e,t]})},popDetail(){const t=T.getState().detailStack;t.length!==0&&T.setState({detailStack:t.slice(0,-1)})},setError(t){T.setState({error:t})},setStatus(t){T.setState({status:t})},setPendingSession(t){T.setState({pendingSession:t})},setPendingSkillChat(t){T.setState({pendingSkillChat:t})},setWatcherStatus(t){T.setState({watcher:t})},setSyncStatus(t){T.setState({syncStatus:t})},setWatchRecentChanges(t){T.setState({watchRecentChanges:t})},openReindexConfirm(){const t=T.getState().reindex;T.setState({reindex:{...t,dialog:"confirm"}})},startReindex(){T.setState({reindex:{...T.getState().reindex,dialog:"running",current_file:null,indexed_count:0,sub_label:null,result:null,error:null}})},setReindexProgress(t){const e=T.getState().reindex;e.dialog==="running"&&T.setState({reindex:{...e,current_file:t.current_file,indexed_count:t.indexed_count,sub_label:t.sub_label??null}})},finishReindex(t){T.setState({reindex:{...T.getState().reindex,dialog:"done",result:t}})},failReindex(t){T.setState({reindex:{...T.getState().reindex,dialog:"error",error:t}})},closeReindex(){T.setState({reindex:{dialog:"closed",current_file:null,indexed_count:0,sub_label:null,result:null,error:null}})},setSettingsScope(t){},loadSettings(t,e){const r=T.getState().settings;T.setState({settings:{...r,values:{...t},original:{...t},exists:e,dirty:!1,error:null}})},updateSetting(t,e){const r=T.getState().settings,i={...r.values,[t]:e},s=v1(r.original,i);T.setState({settings:{...r,values:i,dirty:s}})},revertSettings(){const t=T.getState().settings,e={...t.original};T.setState({settings:{...t,values:e,dirty:!1}})},setSettingsSaving(t){const e=T.getState().settings;T.setState({settings:{...e,saving:t}})},setSettingsError(t){const e=T.getState().settings;T.setState({settings:{...e,error:t}})},setFilesState(t){const e=T.getState().files;T.setState({files:{...e,...t}})},setDiaryState(t){const e=T.getState().diary;T.setState({diary:{...e,...t}})},expandDir(t){const e=T.getState().files;e.expandedPaths.includes(t)||T.setState({files:{...e,expandedPaths:[...e.expandedPaths,t]}})},collapseDir(t){const e=T.getState().files;T.setState({files:{...e,expandedPaths:e.expandedPaths.filter(r=>r!==t)}})},selectDir(t){const e=T.getState().files;T.setState({files:{...e,currentDir:t,selectedPaths:[],lastSelectedAnchor:null,detail:null,mobilePane:e.mobilePane==="tree"?"list":e.mobilePane}})},selectEntry(t,e={}){const r=T.getState().files;let i,s=r.lastSelectedAnchor;if(e.shift&&s!==null){const o=(r.treeCache[r.currentDir]||[]).map(h=>h.path),l=o.indexOf(s),c=o.indexOf(t);if(l>=0&&c>=0){const[h,f]=l<c?[l,c]:[c,l];i=o.slice(h,f+1)}else i=[t],s=t}else e.ctrl?(i=r.selectedPaths.includes(t)?r.selectedPaths.filter(a=>a!==t):[...r.selectedPaths,t],s=t):(i=[t],s=t);T.setState({files:{...r,selectedPaths:i,lastSelectedAnchor:s}})},clearSelection(){const t=T.getState().files;T.setState({files:{...t,selectedPaths:[],lastSelectedAnchor:null,detail:null}})},invalidateDir(t){const e=T.getState().files,r={...e.treeCache};delete r[t],T.setState({files:{...e,treeCache:r}})},invalidateSubtree(t){const e=T.getState().files,r={};for(const[i,s]of Object.entries(e.treeCache))i!==t&&!i.startsWith(t+"/")&&(r[i]=s);T.setState({files:{...e,treeCache:r}})},setMobilePane(t){const e=T.getState().files;T.setState({files:{...e,mobilePane:t}})},loadIndexedDocuments(t){const e=T.getState().files;T.setState({files:{...e,filenameSearch:{...e.filenameSearch,allDocs:t,docsLoading:!1,docsError:null}}})},setFilenameSearchDocsError(t){const e=T.getState().files;T.setState({files:{...e,filenameSearch:{...e.filenameSearch,docsLoading:!1,docsError:t}}})},setFilenameSearchQuery(t){var s;const e=T.getState().files,r=t.query.trim()!=="",i=r?((s=t.results[0])==null?void 0:s.path)??null:null;T.setState({files:{...e,filenameSearch:{...e.filenameSearch,query:t.query,results:t.results,totalMatches:t.totalMatches,isActive:r,selectedPath:i}}})},clearFilenameSearch(){const t=T.getState().files;T.setState({files:{...t,filenameSearch:{...t.filenameSearch,query:"",results:[],totalMatches:0,isActive:!1,selectedPath:null}}})},selectFilenameSearchResult(t){const e=T.getState().files;T.setState({files:{...e,filenameSearch:{...e.filenameSearch,selectedPath:t}}})}},so={search:"#/search",chat:"#/chat",files:"#/files",diary:"#/diary",settings:"#/settings",login:"#/login"},x1=Object.fromEntries(Object.entries(so).map(([t,e])=>[e,t])),Ll="search";function y1(t){if(!t)return null;const e=t.split("?")[0];return x1[e]??null}let vn=!1,Wn=Ll;function Jd(t){t!=="settings"&&t!=="login"&&(Wn=t)}function ao(){return typeof window<"u"?window.location.hash:""}function Vn(){return y1(ao())??Ll}function Qd(t){if(typeof window>"u")return;const e=new URL(window.location.href);e.hash=t,window.history.replaceState(null,"",e)}function a0(){const t=Vn(),e=so[t];ao()!==e&&Qd(e),C.setView(t),Jd(t)}const Sr={init(){if(vn)return;vn=!0;const t=Vn(),e=so[t];ao()!==e&&Qd(e),C.setView(t),Jd(t),typeof window<"u"&&window.addEventListener("hashchange",a0)},navigate(t){const e=so[t];ao()!==e&&typeof window<"u"&&(window.location.hash=e)},current(){return Vn()},lastMain(){return Wn},_reset(){typeof window<"u"&&window.removeEventListener("hashchange",a0),vn=!1,Wn=Ll}};async function eu(){const t=await fetch("/api/status",{method:"GET"}),e=await t.json().catch(()=>null);if(!t.ok)throw new Error(`status HTTP ${t.status}`);return e}class Et extends Error{constructor(e,r,i){super(i),this.status=e,this.code=r,this.name="ApiError"}}let Ci=null;function o0(t){Ci=t}async function pe(t,e={}){const r={...e};e.json!==void 0&&(r.headers={"Content-Type":"application/json",...e.headers||{}},r.body=JSON.stringify(e.json));const i=await fetch(t,r);if(!i.ok){i.status===401&&(Ci==null||Ci());let s;try{s=await i.json()}catch{s={code:"unknown",detail:i.statusText}}throw new Et(i.status,s.code??"unknown",s.detail??"请求失败")}return i.json()}async function*Bl(t,e,r){const i=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e),signal:r});if(!i.ok||!i.body)throw i.status===401&&(Ci==null||Ci()),new Et(i.status,"stream_failed","流式请求失败");const s=i.body.getReader(),a=new TextDecoder;let o="";for(;;){const{value:l,done:c}=await s.read();if(c)break;for(o+=a.decode(l,{stream:!0});;){const h=o.match(/\r\n\r\n|\r\r|\n\n/);if(!h||h.index===void 0)break;const f=h.index,b=h[0].length,y=o.slice(0,f);o=o.slice(f+b);let k="message",z="";for(const O of y.split(/\r\n|\r|\n/))O.startsWith("event:")?k=O.slice(6).trim():O.startsWith("data:")&&(z+=O.slice(5).trim());yield{event:k,data:z}}}}const tu=()=>pe("/api/auth/status"),w1=t=>pe("/api/auth/login",{method:"POST",json:{password:t}}),ru=()=>pe("/api/auth/logout",{method:"POST"}),_1=(t,e)=>pe("/api/auth/password",{method:"PUT",json:{old_password:t,new_password:e}}),k1=t=>pe("/api/auth/password",{method:"DELETE",json:{password:t}});var S1=Object.defineProperty,z1=Object.getOwnPropertyDescriptor,iu=(t,e,r,i)=>{for(var s=i>1?void 0:i?z1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&S1(e,r,s),s};let oo=class extends G{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"search",label:"搜索"},{id:"chat",icon:"message-circle",label:"对话"},{id:"diary",icon:"book-open",label:"日记"},{id:"files",icon:"folder",label:"文件"}]}_select(t){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:t},bubbles:!0,composed:!0}))}render(){return p`
      ${this._items.map(t=>p`
        <button
          class=${this.active===t.id?"active":""}
          title=${t.label}
          aria-label=${t.label}
          @click=${()=>this._select(t.id)}>
          <doclens-icon class="icon ${this.active===t.id?"filled":""}" name=${t.icon}></doclens-icon>
          <span class="label">${t.label}</span>
        </button>`)}
    `}};oo.styles=U`
    :host {
      display: var(--cortex-show-activity-bar, none);
      flex-direction: column;
      align-items: stretch;
      width: max-content;
      min-width: max-content;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-right: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-4) var(--cortex-space-2);
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    button {
      width: max-content;
      min-width: 100%;
      min-height: 40px;
      padding: var(--cortex-space-2) var(--cortex-space-4);
      /* 对齐 tab-bar：无边框、透明底、muted 文字 */
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: var(--cortex-space-3);
      transition: background var(--cortex-duration-fast), color var(--cortex-duration-fast);
      white-space: nowrap;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
    }
    button:hover { background: var(--cortex-surface-muted); }
    button.active {
      /* 对齐 tab-bar：激活无底色，深红文字 + 加粗（写在 :hover 之后以覆盖残留灰底） */
      background: transparent;
      color: var(--cortex-nav-active);
      font-weight: 700;
    }
    .icon {
      font-size: 22px;        /* 对齐 tab-bar 图标尺寸 */
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      transition: color var(--cortex-duration-fast);
    }
    /* 激活项图标：深红（搭配 .filled 实心填充，与 tab-bar 完全一致） */
    button.active .icon { color: var(--cortex-nav-active); }
    .label { font-size: var(--cortex-fs-sm); }
  `;iu([w()],oo.prototype,"active",2);oo=iu([Z("activity-bar")],oo);var $1=Object.defineProperty,T1=Object.getOwnPropertyDescriptor,su=(t,e,r,i)=>{for(var s=i>1?void 0:i?T1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&$1(e,r,s),s};let no=class extends G{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"search",label:"搜索"},{id:"chat",icon:"message-circle",label:"对话"},{id:"diary",icon:"book-open",label:"日记"},{id:"files",icon:"folder",label:"文件"}]}_select(t){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:t},bubbles:!0,composed:!0}))}render(){return p`
      ${this._items.map(t=>p`
        <button
          class="tab ${this.active===t.id?"active":""}"
          @click=${()=>this._select(t.id)}>
          <doclens-icon class="icon ${this.active===t.id?"filled":""}" name=${t.icon}></doclens-icon>
          <span>${t.label}</span>
        </button>`)}
    `}};no.styles=U`
    :host {
      display: var(--cortex-show-tab-bar, none);
      flex-direction: row;
      height: var(--cortex-tab-bar-height);
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding-bottom: env(safe-area-inset-bottom);
      flex-shrink: 0;
    }
    .tab {
      flex: 1;
      position: relative;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      font-size: 12px;
      padding: 8px 0 6px;
      transition: background 0.15s, color 0.15s;
    }
    .tab:hover { background: var(--cortex-surface-muted); }
    .tab.active {
      background: transparent;   /* 激活 tab 无底色（覆盖移动端 :hover 残留灰底） */
      color: var(--cortex-nav-active);  /* 深红，非纯红 */
      font-weight: 700;
    }
    .tab .icon {
      font-size: 22px;
      line-height: 1;
      transition: color var(--cortex-duration-fast);
    }
    /* 激活 tab：图标也变深红（无背景、无胶囊） */
    .tab.active .icon {
      color: var(--cortex-nav-active);
    }
  `;su([w()],no.prototype,"active",2);no=su([Z("tab-bar")],no);var C1=Object.defineProperty,E1=Object.getOwnPropertyDescriptor,Cr=(t,e,r,i)=>{for(var s=i>1?void 0:i?E1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&C1(e,r,s),s};let Wt=class extends G{constructor(){super(...arguments),this.variant="compact",this.heading="Doclens",this.subheading="",this.suffix="",this.heroIcon="",this.modes=[],this.examples=[],this.workdir=""}render(){return this.variant==="onboarding"?this._renderOnboarding():this._renderCompact()}_renderCompact(){return p`
      <h1 class="title">
        <span class="accent">${this.heading}</span>${this.suffix?p`<span class="sep">·</span><span>${this.suffix}</span>`:F}
      </h1>
      ${this.subheading?p`<p class="subtitle">${this.subheading}</p>`:F}
    `}_renderWorkdirPill(t){return p`<span class="workdir-pill" title=${this.workdir||t}
      ><doclens-icon class="pill-icon" name="folder-open"></doclens-icon><span class="pill-path"><bdo dir="ltr">${t}</bdo></span
    ></span>`}_renderOnboardingSubheading(){if(!this.subheading)return F;const t="{workdir}",e=this.subheading.indexOf(t);if(e<0)return p`<p class="onboarding-subheading">${this.subheading}</p>`;const r=this.subheading.slice(0,e),i=this.subheading.slice(e+t.length);return p`<p class="onboarding-subheading workdir-inline">
      ${r}${this._renderWorkdirPill(this.workdir||"…")}${i}
    </p>`}_renderOnboarding(){return p`
      <div class="onboarding-card">
        <div class="card-head">
          <div class="title-group">
            ${this.heroIcon?p`<div class="hero-mark"><doclens-icon name=${this.heroIcon}></doclens-icon></div>`:F}
            <h2 class="card-title">${this.heading}</h2>
          </div>
          ${this.modes.length?p`
                <div class="modes-row">
                  ${this.modes.map(t=>p`<span class="chip">${t.icon?p`<doclens-icon name=${t.icon}></doclens-icon> `:F}${t.label}</span>`)}
                </div>
              `:F}
        </div>
        ${this._renderOnboardingSubheading()}
        ${this.workdir&&!this.subheading.includes("{workdir}")?p`
              <p class="workdir-row">
                <span class="workdir-prefix">当前目录是</span>
                ${this._renderWorkdirPill(this.workdir)}
              </p>
            `:F}
        ${this.examples.length?p`
              <ul class="examples-list">
                ${this.examples.map(t=>p`<li>${t}</li>`)}
              </ul>
            `:F}
      </div>
    `}};Wt.styles=U`
    :host {
      display: block;
      padding: 36px var(--cortex-space-6) 22px;
      text-align: center;
      background: linear-gradient(
        180deg,
        var(--cortex-primary-soft) 0%,
        var(--cortex-surface) 100%
      );
      flex-shrink: 0;
    }
    /* compact 模式：保持原来的标题样式 */
    .title {
      font-size: var(--cortex-fs-xl);
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.02em;
      margin: 0;
    }
    .title .accent {
      color: var(--cortex-primary);
      font-weight: 700;
    }
    .title .sep + span {
      color: var(--cortex-primary);
      font-weight: 600;
    }
    .title .sep {
      color: var(--cortex-text-subtle);
      margin: 0 6px;
      font-weight: 400;
    }
    .subtitle {
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text-muted);
      margin-top: 6px;
    }

    /* onboarding 模式：去掉标题渐变背景，卡片宽度与 history-list/input-row 对齐 */
    :host([variant="onboarding"]) {
      background: transparent;
      padding: 10px var(--cortex-space-4) 6px;
      text-align: left;
    }
    .onboarding-card {
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: var(--cortex-space-6) var(--cortex-space-5);
      /* 聚光灯 hero（极淡蓝）：亮白热斑 → 极淡蓝向外微衰减，清淡通透；文字深色可读。 */
      background:
        radial-gradient(circle at 18% 22%, #ffffff 0%, #f5f9ff 30%, #edf3fd 60%, #e4eefb 100%);
      color: var(--cortex-text);
      border: none;
      border-radius: var(--cortex-radius-3xl);
      box-shadow: var(--cortex-shadow-md);
    }
    .title-group {
      /* 图标 + 标题同一行（避免列堆叠把 card-head 撑高），桌面/移动一致 */
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--cortex-space-3);
      min-width: 0;
    }
    .hero-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--cortex-radius-circle);
      background: var(--cortex-primary);
      color: #ffffff;
      font-size: 24px;
    }
    /* 头部一行：左标题右模式 chips，节省一行高度 */
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      /* 标题组 + 模式 chips 始终同一行；标题过长由 card-title 省略号兜底 */
      flex-wrap: nowrap;
    }
    .onboarding-card .card-title {
      /* 桌面 hero 标题：介于 fs-lg(17) 与 fs-xl(30) 之间的 22px，仍是标题级别但不再过大 */
      font-size: 22px;
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.02em;
      margin: 0;
      /* card-head nowrap 兜底：标题过长时省略号，避免挤压右侧 modes chips */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .onboarding-subheading {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-caption);
      line-height: 1.5;
      margin: 6px 0 0;
    }
    .workdir-row {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin: 4px 0 0;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;       /* "当前目录是" + 胶囊 始终同一行 */
      min-width: 0;
    }
    .workdir-row .workdir-prefix {
      flex-shrink: 0;          /* "当前目录是" 不被挤压换行 */
    }
    /* 路径胶囊基础样式：不限定父容器，workdir-row 和内嵌 subheading 都生效。
     * inline-flex + max-width:100%：移动端不溢出屏幕右缘。 */
    .workdir-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      box-sizing: border-box;
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
      background: rgba(10, 19, 23, 0.08);
      border: 1px solid rgba(10, 19, 23, 0.14);
      border-radius: var(--cortex-radius-pill);
      padding: 2px 10px;
      overflow: hidden;
      white-space: nowrap;
    }
    .workdir-pill .pill-icon {
      flex-shrink: 0;
    }
    /* 路径过长时截断开头（省略号在左），路径末尾（最有区分度的部分）保持可见：
     * direction:rtl 让溢出发生在左侧，<bdo dir="ltr"> 保证 Windows 反斜杠路径不 bidi 乱序 */
    .workdir-pill .pill-path {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
    }
    .workdir-row .workdir-pill {
      flex: 1 1 auto;
      min-width: 0;
    }
    /* subheading 内嵌路径胶囊（合并为一行）：垂直居中 + 左右小间距 */
    .workdir-inline .workdir-pill {
      vertical-align: middle;
      margin: 0 3px;
      max-width: 100%;
    }
    .modes-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex-shrink: 0;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text);
      background: rgba(10, 19, 23, 0.10);
      border: 1px solid rgba(10, 19, 23, 0.08);
      border-radius: var(--cortex-radius-pill);
      white-space: nowrap;
    }
    /* 示例：两列网格 + 顶部分隔线，替代小节标签，压缩竖向空间 */
    .examples-list {
      list-style: none;
      padding: 8px 0 0;
      margin: 8px 0 0;
      border-top: 1px solid rgba(10, 19, 23, 0.12);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 16px;
    }
    .examples-list li {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      padding: 1px 0;
      line-height: 1.4;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .examples-list li::before {
      content: "• ";
      color: var(--cortex-primary);
      margin-right: 4px;
    }
    @media (min-width: 1024px) {
      :host { padding: 20px var(--cortex-space-4) 14px; }
      /* onboarding：桌面端去掉水平 padding，卡片与 history-list 同宽（720/760px） */
      :host([variant="onboarding"]) { padding: 10px 0 6px; }
    }
    @media (max-width: 1023px) {
      /* 移动端：去掉渐变背景 + 缩进对齐 hero-card */
      :host {
        background: transparent;
        text-align: left;
        padding: 0 0 6px;
      }
      :host([variant="onboarding"]) {
        padding: 0 0 6px;
      }
      .title { font-size: var(--cortex-fs-lg); }
      .subtitle { font-size: var(--cortex-fs-sm); }
      .onboarding-card { padding: var(--cortex-space-5) var(--cortex-space-4); border-radius: 0; }
      /* 窄屏：缩小 hero 圆盘 + 隐藏模式 chip 胶囊（title-group 已默认同行） */
      .hero-mark { width: 36px; height: 36px; font-size: 18px; }
      .modes-row { display: none; }
      .card-title { font-size: var(--cortex-fs-lg); }
      /* 窄屏也保持 2 列（示例已精简，2×2 排布），收紧列间距防溢出 */
      .examples-list { grid-template-columns: 1fr 1fr; gap: 2px 10px; }
    }
  `;Cr([w()],Wt.prototype,"variant",2);Cr([w()],Wt.prototype,"heading",2);Cr([w()],Wt.prototype,"subheading",2);Cr([w()],Wt.prototype,"suffix",2);Cr([w()],Wt.prototype,"heroIcon",2);Cr([w({attribute:!1})],Wt.prototype,"modes",2);Cr([w({attribute:!1})],Wt.prototype,"examples",2);Cr([w({attribute:!1})],Wt.prototype,"workdir",2);Wt=Cr([Z("welcome-pane")],Wt);var A1=Object.defineProperty,M1=Object.getOwnPropertyDescriptor,xs=(t,e,r,i)=>{for(var s=i>1?void 0:i?M1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&A1(e,r,s),s};let Jr=class extends G{constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta="",this.actions=[],this._menuOpen=!1,this._onDocClick=t=>{if(!this._menuOpen)return;t.composedPath().includes(this)||(this._menuOpen=!1)}}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}_onMoreClick(t){t.stopPropagation(),this._menuOpen=!this._menuOpen}_onItemClick(t){t.disabled||(this._menuOpen=!1,t.onClick())}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return p`
      <button class="back" aria-label=${this.backLabel} title=${this.backLabel} @click=${this._back}>‹</button>
      <div class="title">${this.title}</div>
      ${this.meta?p`<div class="meta">${this.meta}</div>`:null}
      ${this.actions.length>0?p`
        <div class="more-wrap">
          <button
            class="more-btn"
            type="button"
            aria-label="更多"
            title="更多"
            aria-haspopup="true"
            aria-expanded=${this._menuOpen?"true":"false"}
            @click=${this._onMoreClick}
          >
            <doclens-icon class="kebab" aria-hidden="true" name=${this._menuOpen?"more-horizontal":"more-vertical"}></doclens-icon>
          </button>
          <div class="menu ${this._menuOpen?"open":""}" role="menu">
            ${this.actions.map(t=>p`
              <button
                class="menu-item"
                type="button"
                role="menuitem"
                ?disabled=${t.disabled??!1}
                @click=${()=>this._onItemClick(t)}
              >
                ${t.icon?p`<doclens-icon class="icon" name=${t.icon}></doclens-icon>`:null}
                <span class="label">${t.label}</span>
              </button>
            `)}
          </div>
        </div>
      `:null}
    `}};Jr.styles=U`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid transparent;
      flex-shrink: 0;
      position: relative;
    }
    .back {
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      transition: transform 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
      /* Disable iOS Safari double-tap-zoom detection: without this, the first
         tap is held for ~300ms to see if a second tap follows, which surfaces
         as "needs 2 clicks" on touch devices. */
      touch-action: manipulation;
    }
    .back:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .back:active { transform: scale(0.94); }
    .title {
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-md);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
    .meta {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      flex-shrink: 0;
    }
    .more-wrap { position: relative; }
    .more-btn {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      color: var(--cortex-text-muted);
      font-family: inherit;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      touch-action: manipulation;
    }
    .more-btn:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .more-btn:active { opacity: 0.7; }
    .more-btn .kebab {
      font-size: 18px;
      line-height: 1;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 200px;
      max-width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .menu.open { display: block; }
    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
      color: var(--cortex-text);
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu-item .icon { font-size: 16px; flex-shrink: 0; }
    .menu-item .label { font-size: var(--cortex-fs-sm); font-weight: 500; }
  `;xs([w()],Jr.prototype,"backLabel",2);xs([w()],Jr.prototype,"title",2);xs([w()],Jr.prototype,"meta",2);xs([w({attribute:!1})],Jr.prototype,"actions",2);xs([$()],Jr.prototype,"_menuOpen",2);Jr=xs([Z("focus-header")],Jr);var P1=Object.defineProperty,D1=Object.getOwnPropertyDescriptor,ma=(t,e,r,i)=>{for(var s=i>1?void 0:i?D1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&P1(e,r,s),s};let Ai=class extends G{constructor(){super(...arguments),this.title="历史会话",this.sessions=[],this.clearing=!1}_onClear(){this.clearing||this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){const t=this.sessions.length>0;return p`
      <div class="header">
        <div class="title">${this.title}</div>
        ${t?p`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing?"清空中...":"清空"}
          </button>`:null}
      </div>
      ${this.sessions.length===0?p`<div class="empty">暂无历史${this.type==="search"?"搜索":"会话"}</div>`:this.sessions.map(e=>p`<history-item .session=${e}></history-item>`)}
    `}};Ai.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 6px var(--cortex-space-6) var(--cortex-space-3);
      flex: 1;
      /* min-height:0 允许在 flex column 容器内收缩到 content 以下，
         配合 overflow-y:auto 实现内部滚动。缺少时 min-height 默认为
         auto(=min-content)，历史会话多时会撑开父容器，把底部 tab-bar
         推出视口。 */
      min-height: 0;
      overflow-y: auto;
      /* 隐藏滚动条：内容溢出时仍可用鼠标滚轮滚动（scrollbar-width: none
         + ::-webkit-scrollbar { display: none } 是 Firefox/Chrome 双覆盖） */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: var(--cortex-space-2) 0 var(--cortex-space-1) 0;
    }
    .title {
      font-size: var(--cortex-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--cortex-text-subtle);
      font-weight: 500;
    }
    .clear-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      transition: color 0.15s, background 0.15s;
    }
    .clear-btn:hover {
      color: var(--cortex-danger);
      background: var(--cortex-surface-muted);
    }
    .clear-btn:disabled {
      color: var(--cortex-text-subtle);
      cursor: not-allowed;
      opacity: 0.6;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;ma([w()],Ai.prototype,"title",2);ma([w({attribute:!1})],Ai.prototype,"sessions",2);ma([w()],Ai.prototype,"type",2);ma([w({type:Boolean})],Ai.prototype,"clearing",2);Ai=ma([Z("history-list")],Ai);var O1=Object.defineProperty,I1=Object.getOwnPropertyDescriptor,au=(t,e,r,i)=>{for(var s=i>1?void 0:i?I1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&O1(e,r,s),s};let lo=class extends G{constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){if(!this.session)return null;const t=[];return this.session.type==="chat"&&t.push(String(this.session.message_count)),t.push(new Date(this.session.updated_at).toLocaleDateString()),p`
      <div class="name">
        ${this.session.mode==="grep"?p`<span class="mode-tag" title="正则 grep">grep</span>`:null}
        ${this.session.title}
      </div>
      <div class="meta">${t.join(" · ")}</div>
    `}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};lo.styles=U`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      /* 弱化：去卡片化，改透明行 + 细分隔线 */
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--cortex-border-muted);
      border-radius: 0;
      padding: 7px 4px;
      cursor: pointer;
      transition: background var(--cortex-duration-fast);
    }
    :host(:hover) {
      background: var(--cortex-surface-muted);
    }
    :host(:last-child) {
      border-bottom: none;
    }
    .name {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      font-weight: 400;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
      margin-left: var(--cortex-space-2);
    }
    .mode-tag {
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      font-size: var(--cortex-fs-xs);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text-muted);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
      line-height: 1.5;
    }
  `;au([w({attribute:!1})],lo.prototype,"session",2);lo=au([Z("history-item")],lo);var R1=Object.defineProperty,L1=Object.getOwnPropertyDescriptor,St=(t,e,r,i)=>{for(var s=i>1?void 0:i?L1(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&R1(e,r,s),s};let st=class extends G{constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.iconAfter=!1,this.multiline=!1,this.disabled=!1,this.streaming=!1,this.mode="keyword",this.modes=null,this._menuOpen=!1,this._onDocClick=()=>{this._menuOpen=!1,document.removeEventListener("click",this._onDocClick)}}focus(){var t;(t=this.inputEl)==null||t.focus()}updated(t){var e;(e=super.updated)==null||e.call(this,t),(t.has("value")||t.has("multiline"))&&this._autoResize()}_autoResize(){const t=this.renderRoot.querySelector("textarea");t&&(t.style.height="auto",t.style.height=`${t.scrollHeight}px`)}get trimmed(){return this.value.trim()}_onInput(t){const e=t.target;this.value=e.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled),this._autoResize()}_onKeydown(t){t.key==="Enter"&&(t.shiftKey&&this.multiline||(t.preventDefault(),this._submit()))}_submit(){this.streaming||!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}_emitStop(){this.dispatchEvent(new CustomEvent("stop"))}get _hasModes(){return!!this.modes&&this.mode in this.modes}_toggleMenu(t){t.stopPropagation(),this._menuOpen=!this._menuOpen,this._menuOpen&&document.addEventListener("click",this._onDocClick)}_selectMode(t){this._menuOpen=!1,document.removeEventListener("click",this._onDocClick),this.dispatchEvent(new CustomEvent("mode-change",{detail:{mode:t}}))}_renderButton(){if(this.streaming)return p`
        <button class="stop" @click=${this._emitStop} aria-label="停止生成">
          <doclens-icon class="filled" name="square" aria-hidden="true"></doclens-icon>
        </button>`;if(!this._hasModes){const e=this.buttonIcon?p`<doclens-icon class="thick" name=${this.buttonIcon} aria-hidden="true"></doclens-icon>`:null,r=p`<span>${this.buttonLabel}</span>`;return p`
        <button @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${this.iconAfter?p`${r}${e}`:p`${e}${r}`}
        </button>`}const t=this.modes[this.mode];return p`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${t!=null&&t.icon?p`<doclens-icon name=${t.icon} aria-hidden="true"></doclens-icon>`:null}
          <span>${(t==null?void 0:t.label)??this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}><doclens-icon name="chevron-down"></doclens-icon></button>
      </div>`}_renderMenu(){return!this._hasModes||!this._menuOpen?null:p`
      <div class="menu" role="menu">
        ${Object.keys(this.modes).map(t=>{const e=this.modes[t];return p`
            <div class="menu-item ${t===this.mode?"active":""}" role="menuitem"
                 @click=${()=>this._selectMode(t)}>
              <span class="menu-item-title">
                ${e.icon?p`<span aria-hidden="true">${e.icon}</span>`:null}${e.label}
              </span>
              ${e.description?p`<span class="menu-item-desc">${e.description}</span>`:null}
            </div>`})}
      </div>`}render(){const t=this.disabled||this.streaming,e=this.multiline?p`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${t} @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`:p`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${t} @input=${this._onInput} @keydown=${this._onKeydown} />`;return p`
      <div class="wrapper">
        ${e}
        ${this._renderButton()}
        ${this._renderMenu()}
      </div>
    `}};st.styles=U`
    :host {
      display: block;
      --min-h: 48px;
    }
    .wrapper {
      position: relative;
      display: flex;
      align-items: center;
      /* 边框效果：绿色渐变描边（padding-box 白心 + border-box 渐变），跟随 pill 圆角 */
      border: 2px solid transparent;
      border-radius: var(--cortex-radius-pill);
      background:
        linear-gradient(var(--cortex-chat-input-bg), var(--cortex-chat-input-bg)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
      min-height: var(--min-h);
      padding: 0 var(--cortex-input-btn-reserve, calc(var(--min-h) + 6px)) 0 18px;
      /* 强化：绿色调 elevation 阴影——静止即浮起，作为主动作区 */
      box-shadow: 0 6px 18px rgba(22, 163, 74, 0.12), 0 1px 2px rgba(20, 22, 26, 0.05);
      transition: box-shadow var(--cortex-duration-fast), background var(--cortex-duration-fast);
    }
    .wrapper:focus-within {
      /* 聚焦：绿色渐变描边加深为满色 + 更强 elevation + 绿色光晕环 */
      background:
        linear-gradient(var(--cortex-surface), var(--cortex-surface)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
      box-shadow: 0 10px 30px rgba(22, 163, 74, 0.20), 0 0 0 4px rgba(22, 163, 74, 0.14);
    }
    input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      /* Shadow DOM 不继承全局 box-sizing，必须显式声明，否则 padding 会把
         height 撑大 2 倍（44px height + 22px padding = 66px 高，移动端 ≈ 2.5 字）。 */
      box-sizing: border-box;
      /* 单行输入框：显式 height + 等高 line-height → 文字 100% 垂直居中 */
      height: var(--min-h);
      line-height: var(--min-h);
      padding: 0;
    }
    textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      resize: none;
      /* Shadow DOM 内必须显式声明 box-sizing，否则 min-height 是 content-box
         高度，padding 会叠加在外部导致总高度 = min-height + padding。 */
      box-sizing: border-box;
      /* 多行输入框：min-height 保证 1 行时总高度（含 padding）= wrapper 高度；
         line-height + padding 组合让单行文本视觉上居中（22.5px 文字在 24px
         内容区里 ≈ 完美居中）。实际高度由 _autoResize 按 scrollHeight 撑开。 */
      min-height: var(--min-h);
      line-height: 1.5;
      padding: var(--cortex-input-pad-y, 11px) 0;
    }
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    textarea::-webkit-scrollbar {
      display: none;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-pill);
      min-width: calc(var(--min-h) - 12px);
      height: calc(var(--min-h) - 12px);
      padding: 0 14px;
      font-size: var(--cortex-fs-md);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: filter 0.15s, transform 0.1s;
    }
    button:disabled { filter: saturate(0.4); cursor: not-allowed; box-shadow: none; }
    button:hover:not(:disabled) { filter: brightness(1.05); }
    button:active:not(:disabled) { transform: translateY(-50%) scale(0.96); }
    /* 停止态：流式中发送键原地变身为「停止」（红色方形图标钮，区别于绿色发送），始终可点 */
    button.stop { background: #dc2626; padding: 0; }
    /* 停止态动画：白色方块呼吸 + 红色光晕扩散，错开节奏传达"正在思考/输出" */
    button.stop { animation: cortex-stop-glow 1.4s ease-in-out infinite; }
    button.stop doclens-icon { animation: cortex-stop-pulse 0.9s ease-in-out infinite; }
    @keyframes cortex-stop-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
      50% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.28); }
    }
    @keyframes cortex-stop-pulse {
      0%, 100% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      button.stop, button.stop doclens-icon { animation: none; }
    }
    /* 分裂按钮：主体 + caret 拼成单一控件（模式选择器） */
    .actions.split {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
    }
    .actions.split .primary {
      position: static;
      top: auto;
      right: auto;
      transform: none;
      border-radius: var(--cortex-radius-pill) 0 0 var(--cortex-radius-pill);
      /* 分裂按钮：primary 与 caret 拼成单一控件，必须共享同一 elevation；
         抑制主按钮的 glow，避免左半 "漂浮" 而右半扁平的不对称视觉。 */
      box-shadow: none;
    }
    .actions.split .primary:active:not(:disabled) { transform: scale(0.96); }
    .caret {
      box-sizing: border-box;
      position: static;
      top: auto;
      right: auto;
      transform: none;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 0 var(--cortex-radius-pill) var(--cortex-radius-pill) 0;
      box-shadow: none;
      height: calc(var(--min-h) - 12px);
      min-width: 28px;
      padding: 0 10px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-surface-muted); filter: none; }
    .caret:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu {
      position: absolute;
      /* 向上展开：input-box（带模式选择器）只用在 search 初始态，位于页面底端，
         向下展开会落到视口之外不可见。 */
      bottom: calc(100% + 4px);
      right: 6px;
      z-index: 20;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      overflow: hidden;
    }
    .menu-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item-title { font-size: var(--cortex-fs-md); color: var(--cortex-text); font-weight: 500; white-space: nowrap; }
    .menu-item-desc { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); white-space: nowrap; }
    .menu-item.active { background: var(--cortex-primary-soft); }
    .menu-item.active:hover { background: var(--cortex-primary-soft); }
    .menu-item.active .menu-item-title { color: var(--cortex-primary); font-weight: 600; }
    @media (max-width: 1023px) {
      :host { --min-h: 44px; }
    }
  `;St([w()],st.prototype,"value",2);St([w()],st.prototype,"placeholder",2);St([w()],st.prototype,"buttonLabel",2);St([w()],st.prototype,"buttonIcon",2);St([w({type:Boolean})],st.prototype,"iconAfter",2);St([w({type:Boolean})],st.prototype,"multiline",2);St([w({type:Boolean})],st.prototype,"disabled",2);St([w({type:Boolean})],st.prototype,"streaming",2);St([w()],st.prototype,"mode",2);St([w({attribute:!1})],st.prototype,"modes",2);St([$()],st.prototype,"_menuOpen",2);St([ht("input, textarea")],st.prototype,"inputEl",2);st=St([Z("input-box")],st);function Nl(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Fi=Nl();function ou(t){Fi=t}var Si={exec:()=>null};function Yi(t){let e=[];return r=>{let i=Math.max(0,Math.min(3,r-1)),s=e[i];return s||(s=t(i),e[i]=s),s}}function fe(t,e=""){let r=typeof t=="string"?t:t.source,i={replace:(s,a)=>{let o=typeof a=="string"?a:a.source;return o=o.replace(Ye.caret,"$1"),r=r.replace(s,o),i},getRegex:()=>new RegExp(r,e)};return i}var B1=((t="")=>{try{return!!new RegExp("(?<=1)(?<!1)"+t)}catch{return!1}})(),Ye={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:t=>new RegExp(`^( {0,3}${t})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:Yi(t=>new RegExp(`^ {0,${t}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:Yi(t=>new RegExp(`^ {0,${t}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:Yi(t=>new RegExp(`^ {0,${t}}(?:\`\`\`|~~~)`)),headingBeginRegex:Yi(t=>new RegExp(`^ {0,${t}}#`)),htmlBeginRegex:Yi(t=>new RegExp(`^ {0,${t}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:Yi(t=>new RegExp(`^ {0,${t}}>`))},N1=/^(?:[ \t]*(?:\n|$))+/,F1=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,H1=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,va=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,q1=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Fl=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,nu=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,lu=fe(nu).replace(/bull/g,Fl).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),U1=fe(nu).replace(/bull/g,Fl).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Hl=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,j1=/^[^\n]+/,ql=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,W1=fe(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",ql).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),V1=fe(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,Fl).getRegex(),To="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",Ul=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,G1=fe("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",Ul).replace("tag",To).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),cu=fe(Hl).replace("hr",va).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",To).getRegex(),X1=fe(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",cu).getRegex(),jl={blockquote:X1,code:F1,def:W1,fences:H1,heading:q1,hr:va,html:G1,lheading:lu,list:V1,newline:N1,paragraph:cu,table:Si,text:j1},n0=fe("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",va).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",To).getRegex(),K1={...jl,lheading:U1,table:n0,paragraph:fe(Hl).replace("hr",va).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",n0).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",To).getRegex()},Y1={...jl,html:fe(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",Ul).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:Si,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:fe(Hl).replace("hr",va).replace("heading",` *#{1,6} *[^
]`).replace("lheading",lu).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Z1=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,J1=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,du=/^( {2,}|\\)\n(?!\s*$)/,Q1=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,ys=/[\p{P}\p{S}]/u,Co=/[\s\p{P}\p{S}]/u,Wl=/[^\s\p{P}\p{S}]/u,ef=fe(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,Co).getRegex(),uu=/(?!~)[\p{P}\p{S}]/u,tf=/(?!~)[\s\p{P}\p{S}]/u,rf=/(?:[^\s\p{P}\p{S}]|~)/u,sf=fe(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",B1?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),hu=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,af=fe(hu,"u").replace(/punct/g,ys).getRegex(),of=fe(hu,"u").replace(/punct/g,uu).getRegex(),pu="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",nf=fe(pu,"gu").replace(/notPunctSpace/g,Wl).replace(/punctSpace/g,Co).replace(/punct/g,ys).getRegex(),lf=fe(pu,"gu").replace(/notPunctSpace/g,rf).replace(/punctSpace/g,tf).replace(/punct/g,uu).getRegex(),cf=fe("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Wl).replace(/punctSpace/g,Co).replace(/punct/g,ys).getRegex(),df=fe(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,ys).getRegex(),uf="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",hf=fe(uf,"gu").replace(/notPunctSpace/g,Wl).replace(/punctSpace/g,Co).replace(/punct/g,ys).getRegex(),pf=fe(/\\(punct)/,"gu").replace(/punct/g,ys).getRegex(),ff=fe(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),mf=fe(Ul).replace("(?:-->|$)","-->").getRegex(),vf=fe("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",mf).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),co=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,bf=fe(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",co).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),fu=fe(/^!?\[(label)\]\[(ref)\]/).replace("label",co).replace("ref",ql).getRegex(),mu=fe(/^!?\[(ref)\](?:\[\])?/).replace("ref",ql).getRegex(),gf=fe("reflink|nolink(?!\\()","g").replace("reflink",fu).replace("nolink",mu).getRegex(),l0=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Vl={_backpedal:Si,anyPunctuation:pf,autolink:ff,blockSkip:sf,br:du,code:J1,del:Si,delLDelim:Si,delRDelim:Si,emStrongLDelim:af,emStrongRDelimAst:nf,emStrongRDelimUnd:cf,escape:Z1,link:bf,nolink:mu,punctuation:ef,reflink:fu,reflinkSearch:gf,tag:vf,text:Q1,url:Si},xf={...Vl,link:fe(/^!?\[(label)\]\((.*?)\)/).replace("label",co).getRegex(),reflink:fe(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",co).getRegex()},Gn={...Vl,emStrongRDelimAst:lf,emStrongLDelim:of,delLDelim:df,delRDelim:hf,url:fe(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",l0).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:fe(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",l0).getRegex()},yf={...Gn,br:fe(du).replace("{2,}","*").getRegex(),text:fe(Gn.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Na={normal:jl,gfm:K1,pedantic:Y1},qs={normal:Vl,gfm:Gn,breaks:yf,pedantic:xf},wf={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},c0=t=>wf[t];function rr(t,e){if(e){if(Ye.escapeTest.test(t))return t.replace(Ye.escapeReplace,c0)}else if(Ye.escapeTestNoEncode.test(t))return t.replace(Ye.escapeReplaceNoEncode,c0);return t}function d0(t){try{t=encodeURI(t).replace(Ye.percentDecode,"%")}catch{return null}return t}function u0(t,e){var a;let r=t.replace(Ye.findPipe,(o,l,c)=>{let h=!1,f=l;for(;--f>=0&&c[f]==="\\";)h=!h;return h?"|":" |"}),i=r.split(Ye.splitPipe),s=0;if(i[0].trim()||i.shift(),i.length>0&&!((a=i.at(-1))!=null&&a.trim())&&i.pop(),e)if(i.length>e)i.splice(e);else for(;i.length<e;)i.push("");for(;s<i.length;s++)i[s]=i[s].trim().replace(Ye.slashPipe,"|");return i}function Rr(t,e,r){let i=t.length;if(i===0)return"";let s=0;for(;s<i&&t.charAt(i-s-1)===e;)s++;return t.slice(0,i-s)}function h0(t){let e=t.split(`
`),r=e.length-1;for(;r>=0&&Ye.blankLine.test(e[r]);)r--;return e.length-r<=2?t:e.slice(0,r+1).join(`
`)}function _f(t,e){if(t.indexOf(e[1])===-1)return-1;let r=0;for(let i=0;i<t.length;i++)if(t[i]==="\\")i++;else if(t[i]===e[0])r++;else if(t[i]===e[1]&&(r--,r<0))return i;return r>0?-2:-1}function kf(t,e=0){let r=e,i="";for(let s of t)if(s==="	"){let a=4-r%4;i+=" ".repeat(a),r+=a}else i+=s,r++;return i}function p0(t,e,r,i,s){let a=e.href,o=e.title||null,l=t[1].replace(s.other.outputLinkReplace,"$1");i.state.inLink=!0;let c={type:t[0].charAt(0)==="!"?"image":"link",raw:r,href:a,title:o,text:l,tokens:i.inlineTokens(l)};return i.state.inLink=!1,c}function Sf(t,e,r){let i=t.match(r.other.indentCodeCompensation);if(i===null)return e;let s=i[1];return e.split(`
`).map(a=>{let o=a.match(r.other.beginningSpace);if(o===null)return a;let[l]=o;return l.length>=s.length?a.slice(s.length):a}).join(`
`)}var uo=class{constructor(t){we(this,"options");we(this,"rules");we(this,"lexer");this.options=t||Fi}space(t){let e=this.rules.block.newline.exec(t);if(e&&e[0].length>0)return{type:"space",raw:e[0]}}code(t){let e=this.rules.block.code.exec(t);if(e){let r=this.options.pedantic?e[0]:h0(e[0]),i=r.replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:r,codeBlockStyle:"indented",text:i}}}fences(t){let e=this.rules.block.fences.exec(t);if(e){let r=e[0],i=Sf(r,e[3]||"",this.rules);return{type:"code",raw:r,lang:e[2]?e[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):e[2],text:i}}}heading(t){let e=this.rules.block.heading.exec(t);if(e){let r=e[2].trim();if(this.rules.other.endingHash.test(r)){let i=Rr(r,"#");(this.options.pedantic||!i||this.rules.other.endingSpaceChar.test(i))&&(r=i.trim())}return{type:"heading",raw:Rr(e[0],`
`),depth:e[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(t){let e=this.rules.block.hr.exec(t);if(e)return{type:"hr",raw:Rr(e[0],`
`)}}blockquote(t){let e=this.rules.block.blockquote.exec(t);if(e){let r=Rr(e[0],`
`).split(`
`),i="",s="",a=[];for(;r.length>0;){let o=!1,l=[],c;for(c=0;c<r.length;c++)if(this.rules.other.blockquoteStart.test(r[c]))l.push(r[c]),o=!0;else if(!o)l.push(r[c]);else break;r=r.slice(c);let h=l.join(`
`),f=h.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");i=i?`${i}
${h}`:h,s=s?`${s}
${f}`:f;let b=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(f,a,!0),this.lexer.state.top=b,r.length===0)break;let y=a.at(-1);if((y==null?void 0:y.type)==="code")break;if((y==null?void 0:y.type)==="blockquote"){let k=y,z=k.raw+`
`+r.join(`
`),O=this.blockquote(z);a[a.length-1]=O,i=i.substring(0,i.length-k.raw.length)+O.raw,s=s.substring(0,s.length-k.text.length)+O.text;break}else if((y==null?void 0:y.type)==="list"){let k=y,z=k.raw+`
`+r.join(`
`),O=this.list(z);a[a.length-1]=O,i=i.substring(0,i.length-y.raw.length)+O.raw,s=s.substring(0,s.length-k.raw.length)+O.raw,r=z.substring(a.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:i,tokens:a,text:s}}}list(t){let e=this.rules.block.list.exec(t);if(e){let r=e[1].trim(),i=r.length>1,s={type:"list",raw:"",ordered:i,start:i?+r.slice(0,-1):"",loose:!1,items:[]};r=i?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=i?r:"[*+-]");let a=this.rules.other.listItemRegex(r),o=!1;for(;t;){let c=!1,h="",f="";if(!(e=a.exec(t))||this.rules.block.hr.test(t))break;h=e[0],t=t.substring(h.length);let b=kf(e[2].split(`
`,1)[0],e[1].length),y=t.split(`
`,1)[0],k=!b.trim(),z=0;if(this.options.pedantic?(z=2,f=b.trimStart()):k?z=e[1].length+1:(z=b.search(this.rules.other.nonSpaceChar),z=z>4?1:z,f=b.slice(z),z+=e[1].length),k&&this.rules.other.blankLine.test(y)&&(h+=y+`
`,t=t.substring(y.length+1),c=!0),!c){let O=this.rules.other.nextBulletRegex(z),M=this.rules.other.hrRegex(z),N=this.rules.other.fencesBeginRegex(z),j=this.rules.other.headingBeginRegex(z),J=this.rules.other.htmlBeginRegex(z),V=this.rules.other.blockquoteBeginRegex(z);for(;t;){let K=t.split(`
`,1)[0],ee;if(y=K,this.options.pedantic?(y=y.replace(this.rules.other.listReplaceNesting,"  "),ee=y):ee=y.replace(this.rules.other.tabCharGlobal,"    "),N.test(y)||j.test(y)||J.test(y)||V.test(y)||O.test(y)||M.test(y))break;if(ee.search(this.rules.other.nonSpaceChar)>=z||!y.trim())f+=`
`+ee.slice(z);else{if(k||b.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||N.test(b)||j.test(b)||M.test(b))break;f+=`
`+y}k=!y.trim(),h+=K+`
`,t=t.substring(K.length+1),b=ee.slice(z)}}s.loose||(o?s.loose=!0:this.rules.other.doubleBlankLine.test(h)&&(o=!0)),s.items.push({type:"list_item",raw:h,task:!!this.options.gfm&&this.rules.other.listIsTask.test(f),loose:!1,text:f,tokens:[]}),s.raw+=h}let l=s.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;s.raw=s.raw.trimEnd();for(let c of s.items){this.lexer.state.top=!1,c.tokens=this.lexer.blockTokens(c.text,[]);let h=c.tokens[0];if(c.task&&((h==null?void 0:h.type)==="text"||(h==null?void 0:h.type)==="paragraph")){c.text=c.text.replace(this.rules.other.listReplaceTask,""),h.raw=h.raw.replace(this.rules.other.listReplaceTask,""),h.text=h.text.replace(this.rules.other.listReplaceTask,"");for(let b=this.lexer.inlineQueue.length-1;b>=0;b--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[b].src)){this.lexer.inlineQueue[b].src=this.lexer.inlineQueue[b].src.replace(this.rules.other.listReplaceTask,"");break}let f=this.rules.other.listTaskCheckbox.exec(c.raw);if(f){let b={type:"checkbox",raw:f[0]+" ",checked:f[0]!=="[ ]"};c.checked=b.checked,s.loose?c.tokens[0]&&["paragraph","text"].includes(c.tokens[0].type)&&"tokens"in c.tokens[0]&&c.tokens[0].tokens?(c.tokens[0].raw=b.raw+c.tokens[0].raw,c.tokens[0].text=b.raw+c.tokens[0].text,c.tokens[0].tokens.unshift(b)):c.tokens.unshift({type:"paragraph",raw:b.raw,text:b.raw,tokens:[b]}):c.tokens.unshift(b)}}else c.task&&(c.task=!1);if(!s.loose){let f=c.tokens.filter(y=>y.type==="space"),b=f.length>0&&f.some(y=>this.rules.other.anyLine.test(y.raw));s.loose=b}}if(s.loose)for(let c of s.items){c.loose=!0;for(let h of c.tokens)h.type==="text"&&(h.type="paragraph")}return s}}html(t){let e=this.rules.block.html.exec(t);if(e){let r=h0(e[0]);return{type:"html",block:!0,raw:r,pre:e[1]==="pre"||e[1]==="script"||e[1]==="style",text:r}}}def(t){let e=this.rules.block.def.exec(t);if(e){let r=e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),i=e[2]?e[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=e[3]?e[3].substring(1,e[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):e[3];return{type:"def",tag:r,raw:Rr(e[0],`
`),href:i,title:s}}}table(t){var o;let e=this.rules.block.table.exec(t);if(!e||!this.rules.other.tableDelimiter.test(e[2]))return;let r=u0(e[1]),i=e[2].replace(this.rules.other.tableAlignChars,"").split("|"),s=(o=e[3])!=null&&o.trim()?e[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],a={type:"table",raw:Rr(e[0],`
`),header:[],align:[],rows:[]};if(r.length===i.length){for(let l of i)this.rules.other.tableAlignRight.test(l)?a.align.push("right"):this.rules.other.tableAlignCenter.test(l)?a.align.push("center"):this.rules.other.tableAlignLeft.test(l)?a.align.push("left"):a.align.push(null);for(let l=0;l<r.length;l++)a.header.push({text:r[l],tokens:this.lexer.inline(r[l]),header:!0,align:a.align[l]});for(let l of s)a.rows.push(u0(l,a.header.length).map((c,h)=>({text:c,tokens:this.lexer.inline(c),header:!1,align:a.align[h]})));return a}}lheading(t){let e=this.rules.block.lheading.exec(t);if(e){let r=e[1].trim();return{type:"heading",raw:Rr(e[0],`
`),depth:e[2].charAt(0)==="="?1:2,text:r,tokens:this.lexer.inline(r)}}}paragraph(t){let e=this.rules.block.paragraph.exec(t);if(e){let r=e[1].charAt(e[1].length-1)===`
`?e[1].slice(0,-1):e[1];return{type:"paragraph",raw:e[0],text:r,tokens:this.lexer.inline(r)}}}text(t){let e=this.rules.block.text.exec(t);if(e)return{type:"text",raw:e[0],text:e[0],tokens:this.lexer.inline(e[0])}}escape(t){let e=this.rules.inline.escape.exec(t);if(e)return{type:"escape",raw:e[0],text:e[1]}}tag(t){let e=this.rules.inline.tag.exec(t);if(e)return!this.lexer.state.inLink&&this.rules.other.startATag.test(e[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(e[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(e[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(e[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:e[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:e[0]}}link(t){let e=this.rules.inline.link.exec(t);if(e){let r=e[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let a=Rr(r.slice(0,-1),"\\");if((r.length-a.length)%2===0)return}else{let a=_f(e[2],"()");if(a===-2)return;if(a>-1){let o=(e[0].indexOf("!")===0?5:4)+e[1].length+a;e[2]=e[2].substring(0,a),e[0]=e[0].substring(0,o).trim(),e[3]=""}}let i=e[2],s="";if(this.options.pedantic){let a=this.rules.other.pedanticHrefTitle.exec(i);a&&(i=a[1],s=a[3])}else s=e[3]?e[3].slice(1,-1):"";return i=i.trim(),this.rules.other.startAngleBracket.test(i)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?i=i.slice(1):i=i.slice(1,-1)),p0(e,{href:i&&i.replace(this.rules.inline.anyPunctuation,"$1"),title:s&&s.replace(this.rules.inline.anyPunctuation,"$1")},e[0],this.lexer,this.rules)}}reflink(t,e){let r;if((r=this.rules.inline.reflink.exec(t))||(r=this.rules.inline.nolink.exec(t))){let i=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),s=e[i.toLowerCase()];if(!s){let a=r[0].charAt(0);return{type:"text",raw:a,text:a}}return p0(r,s,r[0],this.lexer,this.rules)}}emStrong(t,e,r=""){let i=this.rules.inline.emStrongLDelim.exec(t);if(!(!i||!i[1]&&!i[2]&&!i[3]&&!i[4]||i[4]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(i[1]||i[3])||!r||this.rules.inline.punctuation.exec(r))){let s=[...i[0]].length-1,a,o,l=s,c=0,h=i[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(h.lastIndex=0,e=e.slice(-1*t.length+s);(i=h.exec(e))!==null;){if(a=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!a)continue;if(o=[...a].length,i[3]||i[4]){l+=o;continue}else if((i[5]||i[6])&&s%3&&!((s+o)%3)){c+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l+c);let f=[...i[0]][0].length,b=t.slice(0,s+i.index+f+o);if(Math.min(s,o)%2){let k=b.slice(1,-1);return{type:"em",raw:b,text:k,tokens:this.lexer.inlineTokens(k)}}let y=b.slice(2,-2);return{type:"strong",raw:b,text:y,tokens:this.lexer.inlineTokens(y)}}}}codespan(t){let e=this.rules.inline.code.exec(t);if(e){let r=e[2].replace(this.rules.other.newLineCharGlobal," "),i=this.rules.other.nonSpaceChar.test(r),s=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return i&&s&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:e[0],text:r}}}br(t){let e=this.rules.inline.br.exec(t);if(e)return{type:"br",raw:e[0]}}del(t,e,r=""){let i=this.rules.inline.delLDelim.exec(t);if(i&&(!i[1]||!r||this.rules.inline.punctuation.exec(r))){let s=[...i[0]].length-1,a,o,l=s,c=this.rules.inline.delRDelim;for(c.lastIndex=0,e=e.slice(-1*t.length+s);(i=c.exec(e))!==null;){if(a=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!a||(o=[...a].length,o!==s))continue;if(i[3]||i[4]){l+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l);let h=[...i[0]][0].length,f=t.slice(0,s+i.index+h+o),b=f.slice(s,-s);return{type:"del",raw:f,text:b,tokens:this.lexer.inlineTokens(b)}}}}autolink(t){let e=this.rules.inline.autolink.exec(t);if(e){let r,i;return e[2]==="@"?(r=e[1],i="mailto:"+r):(r=e[1],i=r),{type:"link",raw:e[0],text:r,href:i,tokens:[{type:"text",raw:r,text:r}]}}}url(t){var r;let e;if(e=this.rules.inline.url.exec(t)){let i,s;if(e[2]==="@")i=e[0],s="mailto:"+i;else{let a;do a=e[0],e[0]=((r=this.rules.inline._backpedal.exec(e[0]))==null?void 0:r[0])??"";while(a!==e[0]);i=e[0],e[1]==="www."?s="http://"+e[0]:s=e[0]}return{type:"link",raw:e[0],text:i,href:s,tokens:[{type:"text",raw:i,text:i}]}}}inlineText(t){let e=this.rules.inline.text.exec(t);if(e){let r=this.lexer.state.inRawBlock;return{type:"text",raw:e[0],text:e[0],escaped:r}}}},Ut=class Xn{constructor(e){we(this,"tokens");we(this,"options");we(this,"state");we(this,"inlineQueue");we(this,"tokenizer");this.tokens=[],this.tokens.links=Object.create(null),this.options=e||Fi,this.options.tokenizer=this.options.tokenizer||new uo,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:Ye,block:Na.normal,inline:qs.normal};this.options.pedantic?(r.block=Na.pedantic,r.inline=qs.pedantic):this.options.gfm&&(r.block=Na.gfm,this.options.breaks?r.inline=qs.breaks:r.inline=qs.gfm),this.tokenizer.rules=r}static get rules(){return{block:Na,inline:qs}}static lex(e,r){return new Xn(r).lex(e)}static lexInline(e,r){return new Xn(r).inlineTokens(e)}lex(e){e=e.replace(Ye.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let i=this.inlineQueue[r];this.inlineTokens(i.src,i.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,r=[],i=!1){var a,o,l;this.tokenizer.lexer=this,this.options.pedantic&&(e=e.replace(Ye.tabCharGlobal,"    ").replace(Ye.spaceLine,""));let s=1/0;for(;e;){if(e.length<s)s=e.length;else{this.infiniteLoopError(e.charCodeAt(0));break}let c;if((o=(a=this.options.extensions)==null?void 0:a.block)!=null&&o.some(f=>(c=f.call({lexer:this},e,r))?(e=e.substring(c.raw.length),r.push(c),!0):!1))continue;if(c=this.tokenizer.space(e)){e=e.substring(c.raw.length);let f=r.at(-1);c.raw.length===1&&f!==void 0?f.raw+=`
`:r.push(c);continue}if(c=this.tokenizer.code(e)){e=e.substring(c.raw.length);let f=r.at(-1);(f==null?void 0:f.type)==="paragraph"||(f==null?void 0:f.type)==="text"?(f.raw+=(f.raw.endsWith(`
`)?"":`
`)+c.raw,f.text+=`
`+c.text,this.inlineQueue.at(-1).src=f.text):r.push(c);continue}if(c=this.tokenizer.fences(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.heading(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.hr(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.blockquote(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.list(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.html(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.def(e)){e=e.substring(c.raw.length);let f=r.at(-1);(f==null?void 0:f.type)==="paragraph"||(f==null?void 0:f.type)==="text"?(f.raw+=(f.raw.endsWith(`
`)?"":`
`)+c.raw,f.text+=`
`+c.raw,this.inlineQueue.at(-1).src=f.text):this.tokens.links[c.tag]||(this.tokens.links[c.tag]={href:c.href,title:c.title},r.push(c));continue}if(c=this.tokenizer.table(e)){e=e.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.lheading(e)){e=e.substring(c.raw.length),r.push(c);continue}let h=e;if((l=this.options.extensions)!=null&&l.startBlock){let f=1/0,b=e.slice(1),y;this.options.extensions.startBlock.forEach(k=>{y=k.call({lexer:this},b),typeof y=="number"&&y>=0&&(f=Math.min(f,y))}),f<1/0&&f>=0&&(h=e.substring(0,f+1))}if(this.state.top&&(c=this.tokenizer.paragraph(h))){let f=r.at(-1);i&&(f==null?void 0:f.type)==="paragraph"?(f.raw+=(f.raw.endsWith(`
`)?"":`
`)+c.raw,f.text+=`
`+c.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=f.text):r.push(c),i=h.length!==e.length,e=e.substring(c.raw.length);continue}if(c=this.tokenizer.text(e)){e=e.substring(c.raw.length);let f=r.at(-1);(f==null?void 0:f.type)==="text"?(f.raw+=(f.raw.endsWith(`
`)?"":`
`)+c.raw,f.text+=`
`+c.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=f.text):r.push(c);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return this.state.top=!0,r}inline(e,r=[]){return this.inlineQueue.push({src:e,tokens:r}),r}inlineTokens(e,r=[]){var h,f,b,y,k;this.tokenizer.lexer=this;let i=e,s=null;if(this.tokens.links){let z=Object.keys(this.tokens.links);if(z.length>0)for(;(s=this.tokenizer.rules.inline.reflinkSearch.exec(i))!==null;)z.includes(s[0].slice(s[0].lastIndexOf("[")+1,-1))&&(i=i.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(s=this.tokenizer.rules.inline.anyPunctuation.exec(i))!==null;)i=i.slice(0,s.index)+"++"+i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let a;for(;(s=this.tokenizer.rules.inline.blockSkip.exec(i))!==null;)a=s[2]?s[2].length:0,i=i.slice(0,s.index+a)+"["+"a".repeat(s[0].length-a-2)+"]"+i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);i=((f=(h=this.options.hooks)==null?void 0:h.emStrongMask)==null?void 0:f.call({lexer:this},i))??i;let o=!1,l="",c=1/0;for(;e;){if(e.length<c)c=e.length;else{this.infiniteLoopError(e.charCodeAt(0));break}o||(l=""),o=!1;let z;if((y=(b=this.options.extensions)==null?void 0:b.inline)!=null&&y.some(M=>(z=M.call({lexer:this},e,r))?(e=e.substring(z.raw.length),r.push(z),!0):!1))continue;if(z=this.tokenizer.escape(e)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.tag(e)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.link(e)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(z.raw.length);let M=r.at(-1);z.type==="text"&&(M==null?void 0:M.type)==="text"?(M.raw+=z.raw,M.text+=z.text):r.push(z);continue}if(z=this.tokenizer.emStrong(e,i,l)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.codespan(e)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.br(e)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.del(e,i,l)){e=e.substring(z.raw.length),r.push(z);continue}if(z=this.tokenizer.autolink(e)){e=e.substring(z.raw.length),r.push(z);continue}if(!this.state.inLink&&(z=this.tokenizer.url(e))){e=e.substring(z.raw.length),r.push(z);continue}let O=e;if((k=this.options.extensions)!=null&&k.startInline){let M=1/0,N=e.slice(1),j;this.options.extensions.startInline.forEach(J=>{j=J.call({lexer:this},N),typeof j=="number"&&j>=0&&(M=Math.min(M,j))}),M<1/0&&M>=0&&(O=e.substring(0,M+1))}if(z=this.tokenizer.inlineText(O)){e=e.substring(z.raw.length),z.raw.slice(-1)!=="_"&&(l=z.raw.slice(-1)),o=!0;let M=r.at(-1);(M==null?void 0:M.type)==="text"?(M.raw+=z.raw,M.text+=z.text):r.push(z);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return r}infiniteLoopError(e){let r="Infinite loop on byte: "+e;if(this.options.silent)console.error(r);else throw new Error(r)}},ho=class{constructor(t){we(this,"options");we(this,"parser");this.options=t||Fi}space(t){return""}code({text:t,lang:e,escaped:r}){var a;let i=(a=(e||"").match(Ye.notSpaceStart))==null?void 0:a[0],s=t.replace(Ye.endingNewline,"")+`
`;return i?'<pre><code class="language-'+rr(i)+'">'+(r?s:rr(s,!0))+`</code></pre>
`:"<pre><code>"+(r?s:rr(s,!0))+`</code></pre>
`}blockquote({tokens:t}){return`<blockquote>
${this.parser.parse(t)}</blockquote>
`}html({text:t}){return t}def(t){return""}heading({tokens:t,depth:e}){return`<h${e}>${this.parser.parseInline(t)}</h${e}>
`}hr(t){return`<hr>
`}list(t){let e=t.ordered,r=t.start,i="";for(let o=0;o<t.items.length;o++){let l=t.items[o];i+=this.listitem(l)}let s=e?"ol":"ul",a=e&&r!==1?' start="'+r+'"':"";return"<"+s+a+`>
`+i+"</"+s+`>
`}listitem(t){return`<li>${this.parser.parse(t.tokens)}</li>
`}checkbox({checked:t}){return"<input "+(t?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:t}){return`<p>${this.parser.parseInline(t)}</p>
`}table(t){let e="",r="";for(let s=0;s<t.header.length;s++)r+=this.tablecell(t.header[s]);e+=this.tablerow({text:r});let i="";for(let s=0;s<t.rows.length;s++){let a=t.rows[s];r="";for(let o=0;o<a.length;o++)r+=this.tablecell(a[o]);i+=this.tablerow({text:r})}return i&&(i=`<tbody>${i}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+i+`</table>
`}tablerow({text:t}){return`<tr>
${t}</tr>
`}tablecell(t){let e=this.parser.parseInline(t.tokens),r=t.header?"th":"td";return(t.align?`<${r} align="${t.align}">`:`<${r}>`)+e+`</${r}>
`}strong({tokens:t}){return`<strong>${this.parser.parseInline(t)}</strong>`}em({tokens:t}){return`<em>${this.parser.parseInline(t)}</em>`}codespan({text:t}){return`<code>${rr(t,!0)}</code>`}br(t){return"<br>"}del({tokens:t}){return`<del>${this.parser.parseInline(t)}</del>`}link({href:t,title:e,tokens:r}){let i=this.parser.parseInline(r),s=d0(t);if(s===null)return i;t=s;let a='<a href="'+t+'"';return e&&(a+=' title="'+rr(e)+'"'),a+=">"+i+"</a>",a}image({href:t,title:e,text:r,tokens:i}){i&&(r=this.parser.parseInline(i,this.parser.textRenderer));let s=d0(t);if(s===null)return rr(r);t=s;let a=`<img src="${t}" alt="${rr(r)}"`;return e&&(a+=` title="${rr(e)}"`),a+=">",a}text(t){return"tokens"in t&&t.tokens?this.parser.parseInline(t.tokens):"escaped"in t&&t.escaped?t.text:rr(t.text)}},Gl=class{strong({text:t}){return t}em({text:t}){return t}codespan({text:t}){return t}del({text:t}){return t}html({text:t}){return t}text({text:t}){return t}link({text:t}){return""+t}image({text:t}){return""+t}br(){return""}checkbox({raw:t}){return t}},jt=class Kn{constructor(e){we(this,"options");we(this,"renderer");we(this,"textRenderer");this.options=e||Fi,this.options.renderer=this.options.renderer||new ho,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Gl}static parse(e,r){return new Kn(r).parse(e)}static parseInline(e,r){return new Kn(r).parseInline(e)}parse(e){var i,s;this.renderer.parser=this;let r="";for(let a=0;a<e.length;a++){let o=e[a];if((s=(i=this.options.extensions)==null?void 0:i.renderers)!=null&&s[o.type]){let c=o,h=this.options.extensions.renderers[c.type].call({parser:this},c);if(h!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(c.type)){r+=h||"";continue}}let l=o;switch(l.type){case"space":{r+=this.renderer.space(l);break}case"hr":{r+=this.renderer.hr(l);break}case"heading":{r+=this.renderer.heading(l);break}case"code":{r+=this.renderer.code(l);break}case"table":{r+=this.renderer.table(l);break}case"blockquote":{r+=this.renderer.blockquote(l);break}case"list":{r+=this.renderer.list(l);break}case"checkbox":{r+=this.renderer.checkbox(l);break}case"html":{r+=this.renderer.html(l);break}case"def":{r+=this.renderer.def(l);break}case"paragraph":{r+=this.renderer.paragraph(l);break}case"text":{r+=this.renderer.text(l);break}default:{let c='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(c),"";throw new Error(c)}}}return r}parseInline(e,r=this.renderer){var s,a;this.renderer.parser=this;let i="";for(let o=0;o<e.length;o++){let l=e[o];if((a=(s=this.options.extensions)==null?void 0:s.renderers)!=null&&a[l.type]){let h=this.options.extensions.renderers[l.type].call({parser:this},l);if(h!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(l.type)){i+=h||"";continue}}let c=l;switch(c.type){case"escape":{i+=r.text(c);break}case"html":{i+=r.html(c);break}case"link":{i+=r.link(c);break}case"image":{i+=r.image(c);break}case"checkbox":{i+=r.checkbox(c);break}case"strong":{i+=r.strong(c);break}case"em":{i+=r.em(c);break}case"codespan":{i+=r.codespan(c);break}case"br":{i+=r.br(c);break}case"del":{i+=r.del(c);break}case"text":{i+=r.text(c);break}default:{let h='Token with "'+c.type+'" type was not found.';if(this.options.silent)return console.error(h),"";throw new Error(h)}}}return i}},Ka,Vs=(Ka=class{constructor(t){we(this,"options");we(this,"block");this.options=t||Fi}preprocess(t){return t}postprocess(t){return t}processAllTokens(t){return t}emStrongMask(t){return t}provideLexer(t=this.block){return t?Ut.lex:Ut.lexInline}provideParser(t=this.block){return t?jt.parse:jt.parseInline}},we(Ka,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens","emStrongMask"])),we(Ka,"passThroughHooksRespectAsync",new Set(["preprocess","postprocess","processAllTokens"])),Ka),zf=class{constructor(...t){we(this,"defaults",Nl());we(this,"options",this.setOptions);we(this,"parse",this.parseMarkdown(!0));we(this,"parseInline",this.parseMarkdown(!1));we(this,"Parser",jt);we(this,"Renderer",ho);we(this,"TextRenderer",Gl);we(this,"Lexer",Ut);we(this,"Tokenizer",uo);we(this,"Hooks",Vs);this.use(...t)}walkTokens(t,e){var i,s;let r=[];for(let a of t)switch(r=r.concat(e.call(this,a)),a.type){case"table":{let o=a;for(let l of o.header)r=r.concat(this.walkTokens(l.tokens,e));for(let l of o.rows)for(let c of l)r=r.concat(this.walkTokens(c.tokens,e));break}case"list":{let o=a;r=r.concat(this.walkTokens(o.items,e));break}default:{let o=a;(s=(i=this.defaults.extensions)==null?void 0:i.childTokens)!=null&&s[o.type]?this.defaults.extensions.childTokens[o.type].forEach(l=>{let c=o[l].flat(1/0);r=r.concat(this.walkTokens(c,e))}):o.tokens&&(r=r.concat(this.walkTokens(o.tokens,e)))}}return r}use(...t){let e=this.defaults.extensions||{renderers:{},childTokens:{}};return t.forEach(r=>{let i={...r};if(i.async=this.defaults.async||i.async||!1,r.extensions&&(r.extensions.forEach(s=>{if(!s.name)throw new Error("extension name required");if("renderer"in s){let a=e.renderers[s.name];a?e.renderers[s.name]=function(...o){let l=s.renderer.apply(this,o);return l===!1&&(l=a.apply(this,o)),l}:e.renderers[s.name]=s.renderer}if("tokenizer"in s){if(!s.level||s.level!=="block"&&s.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let a=e[s.level];a?a.unshift(s.tokenizer):e[s.level]=[s.tokenizer],s.start&&(s.level==="block"?e.startBlock?e.startBlock.push(s.start):e.startBlock=[s.start]:s.level==="inline"&&(e.startInline?e.startInline.push(s.start):e.startInline=[s.start]))}"childTokens"in s&&s.childTokens&&(e.childTokens[s.name]=s.childTokens)}),i.extensions=e),r.renderer){let s=this.defaults.renderer||new ho(this.defaults);for(let a in r.renderer){if(!(a in s))throw new Error(`renderer '${a}' does not exist`);if(["options","parser"].includes(a))continue;let o=a,l=r.renderer[o],c=s[o];s[o]=(...h)=>{let f=l.apply(s,h);return f===!1&&(f=c.apply(s,h)),f||""}}i.renderer=s}if(r.tokenizer){let s=this.defaults.tokenizer||new uo(this.defaults);for(let a in r.tokenizer){if(!(a in s))throw new Error(`tokenizer '${a}' does not exist`);if(["options","rules","lexer"].includes(a))continue;let o=a,l=r.tokenizer[o],c=s[o];s[o]=(...h)=>{let f=l.apply(s,h);return f===!1&&(f=c.apply(s,h)),f}}i.tokenizer=s}if(r.hooks){let s=this.defaults.hooks||new Vs;for(let a in r.hooks){if(!(a in s))throw new Error(`hook '${a}' does not exist`);if(["options","block"].includes(a))continue;let o=a,l=r.hooks[o],c=s[o];Vs.passThroughHooks.has(a)?s[o]=h=>{if(this.defaults.async&&Vs.passThroughHooksRespectAsync.has(a))return(async()=>{let b=await l.call(s,h);return c.call(s,b)})();let f=l.call(s,h);return c.call(s,f)}:s[o]=(...h)=>{if(this.defaults.async)return(async()=>{let b=await l.apply(s,h);return b===!1&&(b=await c.apply(s,h)),b})();let f=l.apply(s,h);return f===!1&&(f=c.apply(s,h)),f}}i.hooks=s}if(r.walkTokens){let s=this.defaults.walkTokens,a=r.walkTokens;i.walkTokens=function(o){let l=[];return l.push(a.call(this,o)),s&&(l=l.concat(s.call(this,o))),l}}this.defaults={...this.defaults,...i}}),this}setOptions(t){return this.defaults={...this.defaults,...t},this}lexer(t,e){return Ut.lex(t,e??this.defaults)}parser(t,e){return jt.parse(t,e??this.defaults)}parseMarkdown(t){return(e,r)=>{let i={...r},s={...this.defaults,...i},a=this.onError(!!s.silent,!!s.async);if(this.defaults.async===!0&&i.async===!1)return a(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof e>"u"||e===null)return a(new Error("marked(): input parameter is undefined or null"));if(typeof e!="string")return a(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(e)+", string expected"));if(s.hooks&&(s.hooks.options=s,s.hooks.block=t),s.async)return(async()=>{let o=s.hooks?await s.hooks.preprocess(e):e,l=await(s.hooks?await s.hooks.provideLexer(t):t?Ut.lex:Ut.lexInline)(o,s),c=s.hooks?await s.hooks.processAllTokens(l):l;s.walkTokens&&await Promise.all(this.walkTokens(c,s.walkTokens));let h=await(s.hooks?await s.hooks.provideParser(t):t?jt.parse:jt.parseInline)(c,s);return s.hooks?await s.hooks.postprocess(h):h})().catch(a);try{s.hooks&&(e=s.hooks.preprocess(e));let o=(s.hooks?s.hooks.provideLexer(t):t?Ut.lex:Ut.lexInline)(e,s);s.hooks&&(o=s.hooks.processAllTokens(o)),s.walkTokens&&this.walkTokens(o,s.walkTokens);let l=(s.hooks?s.hooks.provideParser(t):t?jt.parse:jt.parseInline)(o,s);return s.hooks&&(l=s.hooks.postprocess(l)),l}catch(o){return a(o)}}}onError(t,e){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,t){let i="<p>An error occurred:</p><pre>"+rr(r.message+"",!0)+"</pre>";return e?Promise.resolve(i):i}if(e)return Promise.reject(r);throw r}}},Mi=new zf;function de(t,e){return Mi.parse(t,e)}de.options=de.setOptions=function(t){return Mi.setOptions(t),de.defaults=Mi.defaults,ou(de.defaults),de};de.getDefaults=Nl;de.defaults=Fi;de.use=function(...t){return Mi.use(...t),de.defaults=Mi.defaults,ou(de.defaults),de};de.walkTokens=function(t,e){return Mi.walkTokens(t,e)};de.parseInline=Mi.parseInline;de.Parser=jt;de.parser=jt.parse;de.Renderer=ho;de.TextRenderer=Gl;de.Lexer=Ut;de.lexer=Ut.lex;de.Tokenizer=uo;de.Hooks=Vs;de.parse=de;de.options;de.setOptions;de.use;de.walkTokens;de.parseInline;jt.parse;Ut.lex;/*! @license DOMPurify 3.4.13 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.13/LICENSE */function f0(t,e){(e==null||e>t.length)&&(e=t.length);for(var r=0,i=Array(e);r<e;r++)i[r]=t[r];return i}function $f(t){if(Array.isArray(t))return t}function Tf(t,e){var r=t==null?null:typeof Symbol<"u"&&t[Symbol.iterator]||t["@@iterator"];if(r!=null){var i,s,a,o,l=[],c=!0,h=!1;try{if(a=(r=r.call(t)).next,e!==0)for(;!(c=(i=a.call(r)).done)&&(l.push(i.value),l.length!==e);c=!0);}catch(f){h=!0,s=f}finally{try{if(!c&&r.return!=null&&(o=r.return(),Object(o)!==o))return}finally{if(h)throw s}}return l}}function Cf(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Ef(t,e){return $f(t)||Tf(t,e)||Af(t,e)||Cf()}function Af(t,e){if(t){if(typeof t=="string")return f0(t,e);var r={}.toString.call(t).slice(8,-1);return r==="Object"&&t.constructor&&(r=t.constructor.name),r==="Map"||r==="Set"?Array.from(t):r==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?f0(t,e):void 0}}const vu=Object.entries,m0=Object.setPrototypeOf,Mf=Object.isFrozen,Pf=Object.getPrototypeOf,Df=Object.getOwnPropertyDescriptor;let Ve=Object.freeze,Ge=Object.seal,ts=Object.create,bu=typeof Reflect<"u"&&Reflect,Yn=bu.apply,Zn=bu.construct;Ve||(Ve=function(e){return e});Ge||(Ge=function(e){return e});Yn||(Yn=function(e,r){for(var i=arguments.length,s=new Array(i>2?i-2:0),a=2;a<i;a++)s[a-2]=arguments[a];return e.apply(r,s)});Zn||(Zn=function(e){for(var r=arguments.length,i=new Array(r>1?r-1:0),s=1;s<r;s++)i[s-1]=arguments[s];return new e(...i)});const Zi=Le(Array.prototype.forEach),Of=Le(Array.prototype.lastIndexOf),v0=Le(Array.prototype.pop),Ji=Le(Array.prototype.push),If=Le(Array.prototype.splice),Vr=Array.isArray,Gs=Le(String.prototype.toLowerCase),bn=Le(String.prototype.toString),b0=Le(String.prototype.match),Us=Le(String.prototype.replace),g0=Le(String.prototype.indexOf),Rf=Le(String.prototype.trim),Lf=Le(Number.prototype.toString),Bf=Le(Boolean.prototype.toString),x0=typeof BigInt>"u"?null:Le(BigInt.prototype.toString),y0=typeof Symbol>"u"?null:Le(Symbol.prototype.toString),je=Le(Object.prototype.hasOwnProperty),js=Le(Object.prototype.toString),Ue=Le(RegExp.prototype.test),vi=Nf(TypeError);function Le(t){return function(e){e instanceof RegExp&&(e.lastIndex=0);for(var r=arguments.length,i=new Array(r>1?r-1:0),s=1;s<r;s++)i[s-1]=arguments[s];return Yn(t,e,i)}}function Nf(t){return function(){for(var e=arguments.length,r=new Array(e),i=0;i<e;i++)r[i]=arguments[i];return Zn(t,r)}}function ue(t,e){let r=arguments.length>2&&arguments[2]!==void 0?arguments[2]:Gs;if(m0&&m0(t,null),!Vr(e))return t;let i=e.length;for(;i--;){let s=e[i];if(typeof s=="string"){const a=r(s);a!==s&&(Mf(e)||(e[i]=a),s=a)}t[s]=!0}return t}function Ff(t){for(let e=0;e<t.length;e++)je(t,e)||(t[e]=null);return t}function Ke(t){const e=ts(null);for(const i of vu(t)){var r=Ef(i,2);const s=r[0],a=r[1];je(t,s)&&(Vr(a)?e[s]=Ff(a):a&&typeof a=="object"&&a.constructor===Object?e[s]=Ke(a):e[s]=a)}return e}function Hf(t){switch(typeof t){case"string":return t;case"number":return Lf(t);case"boolean":return Bf(t);case"bigint":return x0?x0(t):"0";case"symbol":return y0?y0(t):"Symbol()";case"undefined":return js(t);case"function":case"object":{if(t===null)return js(t);const e=t,r=qt(e,"toString");if(typeof r=="function"){const i=r(e);return typeof i=="string"?i:js(i)}return js(t)}default:return js(t)}}function qt(t,e){for(;t!==null;){const i=Df(t,e);if(i){if(i.get)return Le(i.get);if(typeof i.value=="function")return Le(i.value)}t=Pf(t)}function r(){return null}return r}function qf(t){try{return Ue(t,""),!0}catch{return!1}}const w0=Ve(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),gn=Ve(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),xn=Ve(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),Uf=Ve(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),yn=Ve(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),jf=Ve(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),_0=Ve(["#text"]),k0=Ve(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),wn=Ve(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),S0=Ve(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),Fa=Ve(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),Wf=Ge(/{{[\w\W]*|^[\w\W]*}}/g),Vf=Ge(/<%[\w\W]*|^[\w\W]*%>/g),Gf=Ge(/\${[\w\W]*/g),Xf=Ge(/^data-[\-\w.\u00B7-\uFFFF]+$/),Kf=Ge(/^aria-[\-\w]+$/),z0=Ge(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),Yf=Ge(/^(?:\w+script|data):/i),Zf=Ge(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),Jf=Ge(/^html$/i),Qf=Ge(/^[a-z][.\w]*(-[.\w]+)+$/i),$0=Ge(/<[/\w!]/g),T0=Ge(/<[/\w]/g),em=Ge(/<\/no(script|embed|frames)/i),tm=Ge(/\/>/i),bt={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},rm=function(){return typeof window>"u"?null:window},im=function(e,r){if(typeof e!="object"||typeof e.createPolicy!="function")return null;let i=null;const s="data-tt-policy-suffix";r&&r.hasAttribute(s)&&(i=r.getAttribute(s));const a="dompurify"+(i?"#"+i:"");try{return e.createPolicy(a,{createHTML(o){return o},createScriptURL(o){return o}})}catch{return console.warn("TrustedTypes policy "+a+" could not be created."),null}},C0=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},Lr=function(e,r,i,s){return je(e,r)&&Vr(e[r])?ue(s.base?Ke(s.base):{},e[r],s.transform):i};function gu(){let t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:rm();const e=B=>gu(B);if(e.version="3.4.13",e.removed=[],!t||!t.document||t.document.nodeType!==bt.document||!t.Element)return e.isSupported=!1,e;let r=t.document;const i=r,s=i.currentScript;t.DocumentFragment;const a=t.HTMLTemplateElement,o=t.Node,l=t.Element,c=t.NodeFilter,h=t.NamedNodeMap;h===void 0&&(t.NamedNodeMap||t.MozNamedAttrMap),t.HTMLFormElement;const f=t.DOMParser,b=t.trustedTypes,y=l.prototype,k=qt(y,"cloneNode"),z=qt(y,"remove"),O=qt(y,"nextSibling"),M=qt(y,"childNodes"),N=qt(y,"parentNode"),j=qt(y,"shadowRoot"),J=qt(y,"attributes"),V=o&&o.prototype?qt(o.prototype,"nodeType"):null,K=o&&o.prototype?qt(o.prototype,"nodeName"):null,ee=o&&o.prototype?qt(o.prototype,"ownerDocument"):null;if(typeof a=="function"){const B=r.createElement("template");B.content&&B.content.ownerDocument&&(r=B.content.ownerDocument)}let re,ne="",le,We=!1,Ne=0;const ze=function(){if(Ne>0)throw vi('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},Tt=function(v){ze(),Ne++;try{return re.createHTML(v)}finally{Ne--}},Ct=function(v){ze(),Ne++;try{return re.createScriptURL(v)}finally{Ne--}},ft=function(){return We||(le=im(b,s),We=!0),le},mt=r,Yt=mt.implementation,br=mt.createNodeIterator,Ts=mt.createDocumentFragment,Zt=mt.getElementsByTagName,Jt=i.importNode;let be=C0();e.isSupported=typeof vu=="function"&&typeof N=="function"&&Yt&&Yt.createHTMLDocument!==void 0;const vt=Wf,Ui=Vf,Sa=Gf,Vo=Xf,Dr=Kf,za=Yf,gr=Zf,$a=Qf;let Cs=z0,_e=null;const Or=ue({},[...w0,...gn,...xn,...yn,..._0]);let ge=null;const Es=ue({},[...k0,...wn,...S0,...Fa]);let $e=Object.seal(ts(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),hi=null,As=null;const Nt=Object.seal(ts(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let pi=!0,Ms=!0,Ta=!1,ji=!0,Ft=!1,Ht=!0,xr=!1,Ps=!1,yr=null,wr=null,Go=!1,Wi=!1,Ca=!1,Ea=!1,gc=!0,xc=!1;const yc="user-content-";let Xo=!0,Aa=!1,Vi={},Qt=null;const Ko=ue({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]);let wc=null;const _c=ue({},["audio","video","img","source","image","track"]);let Yo=null;const kc=ue({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),Ma="http://www.w3.org/1998/Math/MathML",Pa="http://www.w3.org/2000/svg",er="http://www.w3.org/1999/xhtml";let Gi=er,Zo=!1,Jo=null;const Eh=ue({},[Ma,Pa,er],bn),Sc=Ve(["mi","mo","mn","ms","mtext"]);let Qo=ue({},Sc);const zc=Ve(["annotation-xml"]);let en=ue({},zc);const Ah=ue({},["title","style","font","a","script"]);let Ds=null;const Mh=["application/xhtml+xml","text/html"],Ph="text/html";let Ee=null,Xi=null;const Dh=r.createElement("form"),$c=function(v){return v instanceof RegExp||v instanceof Function},tn=function(){let v=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(Xi&&Xi===v)return;(!v||typeof v!="object")&&(v={}),v=Ke(v),Ds=Mh.indexOf(v.PARSER_MEDIA_TYPE)===-1?Ph:v.PARSER_MEDIA_TYPE,Ee=Ds==="application/xhtml+xml"?bn:Gs,_e=Lr(v,"ALLOWED_TAGS",Or,{transform:Ee}),ge=Lr(v,"ALLOWED_ATTR",Es,{transform:Ee}),Jo=Lr(v,"ALLOWED_NAMESPACES",Eh,{transform:bn}),Yo=Lr(v,"ADD_URI_SAFE_ATTR",kc,{transform:Ee,base:kc}),wc=Lr(v,"ADD_DATA_URI_TAGS",_c,{transform:Ee,base:_c}),Qt=Lr(v,"FORBID_CONTENTS",Ko,{transform:Ee}),hi=Lr(v,"FORBID_TAGS",Ke({}),{transform:Ee}),As=Lr(v,"FORBID_ATTR",Ke({}),{transform:Ee}),Vi=je(v,"USE_PROFILES")?v.USE_PROFILES&&typeof v.USE_PROFILES=="object"?Ke(v.USE_PROFILES):v.USE_PROFILES:!1,pi=v.ALLOW_ARIA_ATTR!==!1,Ms=v.ALLOW_DATA_ATTR!==!1,Ta=v.ALLOW_UNKNOWN_PROTOCOLS||!1,ji=v.ALLOW_SELF_CLOSE_IN_ATTR!==!1,Ft=v.SAFE_FOR_TEMPLATES||!1,Ht=v.SAFE_FOR_XML!==!1,xr=v.WHOLE_DOCUMENT||!1,Wi=v.RETURN_DOM||!1,Ca=v.RETURN_DOM_FRAGMENT||!1,Ea=v.RETURN_TRUSTED_TYPE||!1,Go=v.FORCE_BODY||!1,gc=v.SANITIZE_DOM!==!1,xc=v.SANITIZE_NAMED_PROPS||!1,Xo=v.KEEP_CONTENT!==!1,Aa=v.IN_PLACE||!1,Cs=qf(v.ALLOWED_URI_REGEXP)?v.ALLOWED_URI_REGEXP:z0,Gi=typeof v.NAMESPACE=="string"?v.NAMESPACE:er,Qo=je(v,"MATHML_TEXT_INTEGRATION_POINTS")&&v.MATHML_TEXT_INTEGRATION_POINTS&&typeof v.MATHML_TEXT_INTEGRATION_POINTS=="object"?Ke(v.MATHML_TEXT_INTEGRATION_POINTS):ue({},Sc),en=je(v,"HTML_INTEGRATION_POINTS")&&v.HTML_INTEGRATION_POINTS&&typeof v.HTML_INTEGRATION_POINTS=="object"?Ke(v.HTML_INTEGRATION_POINTS):ue({},zc);const S=je(v,"CUSTOM_ELEMENT_HANDLING")&&v.CUSTOM_ELEMENT_HANDLING&&typeof v.CUSTOM_ELEMENT_HANDLING=="object"?Ke(v.CUSTOM_ELEMENT_HANDLING):ts(null);if($e=ts(null),je(S,"tagNameCheck")&&$c(S.tagNameCheck)&&($e.tagNameCheck=S.tagNameCheck),je(S,"attributeNameCheck")&&$c(S.attributeNameCheck)&&($e.attributeNameCheck=S.attributeNameCheck),je(S,"allowCustomizedBuiltInElements")&&typeof S.allowCustomizedBuiltInElements=="boolean"&&($e.allowCustomizedBuiltInElements=S.allowCustomizedBuiltInElements),Ge($e),Ft&&(Ms=!1),Ca&&(Wi=!0),Vi&&(_e=ue({},_0),ge=ts(null),Vi.html===!0&&(ue(_e,w0),ue(ge,k0)),Vi.svg===!0&&(ue(_e,gn),ue(ge,wn),ue(ge,Fa)),Vi.svgFilters===!0&&(ue(_e,xn),ue(ge,wn),ue(ge,Fa)),Vi.mathMl===!0&&(ue(_e,yn),ue(ge,S0),ue(ge,Fa))),Nt.tagCheck=null,Nt.attributeCheck=null,je(v,"ADD_TAGS")&&(typeof v.ADD_TAGS=="function"?Nt.tagCheck=v.ADD_TAGS:Vr(v.ADD_TAGS)&&(_e===Or&&(_e=Ke(_e)),ue(_e,v.ADD_TAGS,Ee))),je(v,"ADD_ATTR")&&(typeof v.ADD_ATTR=="function"?Nt.attributeCheck=v.ADD_ATTR:Vr(v.ADD_ATTR)&&(ge===Es&&(ge=Ke(ge)),ue(ge,v.ADD_ATTR,Ee))),je(v,"ADD_URI_SAFE_ATTR")&&Vr(v.ADD_URI_SAFE_ATTR)&&ue(Yo,v.ADD_URI_SAFE_ATTR,Ee),je(v,"FORBID_CONTENTS")&&Vr(v.FORBID_CONTENTS)&&(Qt===Ko&&(Qt=Ke(Qt)),ue(Qt,v.FORBID_CONTENTS,Ee)),je(v,"ADD_FORBID_CONTENTS")&&Vr(v.ADD_FORBID_CONTENTS)&&(Qt===Ko&&(Qt=Ke(Qt)),ue(Qt,v.ADD_FORBID_CONTENTS,Ee)),Xo&&(_e["#text"]=!0),xr&&ue(_e,["html","head","body"]),_e.table&&(ue(_e,["tbody"]),delete hi.tbody),v.TRUSTED_TYPES_POLICY){if(typeof v.TRUSTED_TYPES_POLICY.createHTML!="function")throw vi('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof v.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw vi('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');const P=re;re=v.TRUSTED_TYPES_POLICY;try{ne=Tt("")}catch(W){throw re=P,W}}else v.TRUSTED_TYPES_POLICY===null?(re=void 0,ne=""):(re===void 0&&(re=ft()),re&&typeof ne=="string"&&(ne=Tt("")));Ve&&Ve(v),Xi=v},Tc=ue({},[...gn,...xn,...Uf]),Cc=ue({},[...yn,...jf]),Oh=function(v,S,P){return S.namespaceURI===er?v==="svg":S.namespaceURI===Ma?v==="svg"&&(P==="annotation-xml"||Qo[P]):!!Tc[v]},Ih=function(v,S,P){return S.namespaceURI===er?v==="math":S.namespaceURI===Pa?v==="math"&&en[P]:!!Cc[v]},Rh=function(v,S,P){return S.namespaceURI===Pa&&!en[P]||S.namespaceURI===Ma&&!Qo[P]?!1:!Cc[v]&&(Ah[v]||!Tc[v])},Lh=function(v){let S=N(v);(!S||!S.tagName)&&(S={namespaceURI:Gi,tagName:"template"});const P=Gs(v.tagName),W=Gs(S.tagName);return Jo[v.namespaceURI]?v.namespaceURI===Pa?Oh(P,S,W):v.namespaceURI===Ma?Ih(P,S,W):v.namespaceURI===er?Rh(P,S,W):!!(Ds==="application/xhtml+xml"&&Jo[v.namespaceURI]):!1},Ir=function(v){Ji(e.removed,{element:v});try{N(v).removeChild(v)}catch{if(z(v),!N(v))throw vi("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},Da=function(v){Os(v);const S=M(v);if(S){const W=[];Zi(S,X=>{Ji(W,X)}),Zi(W,X=>{try{z(X)}catch{}})}const P=J(v);if(P)for(let W=P.length-1;W>=0;--W){const X=P[W],se=X&&X.name;if(typeof se=="string")try{v.removeAttribute(se)}catch{}}},fi=function(v,S){try{Ji(e.removed,{attribute:S.getAttributeNode(v),from:S})}catch{Ji(e.removed,{attribute:null,from:S})}if(S.removeAttribute(v),v==="is")if(Wi||Ca)try{Ir(S)}catch{}else try{S.setAttribute(v,"")}catch{}},Bh=function(v){const S=J(v);if(S)for(let P=S.length-1;P>=0;--P){const W=S[P],X=W&&W.name;if(!(typeof X!="string"||ge[Ee(X)]))try{v.removeAttribute(X)}catch{}}},Os=function(v){const S=[v];for(;S.length>0;){const P=S.pop();(V?V(P):P.nodeType)===bt.element&&Bh(P);const X=M(P);if(X)for(let se=X.length-1;se>=0;--se)S.push(X[se])}},Nh=function(v){if(!Ht)return;const S=[v];for(;S.length>0;){const P=S.pop(),W=V?V(P):P.nodeType;if(W===bt.processingInstruction||W===bt.comment&&Ue(T0,P.data)){try{z(P)}catch{}continue}if(W===bt.element){const se=P,ye=Ee(K?K(P):P.nodeName);try{se.hasAttribute&&se.hasAttribute("patchsrc")&&se.removeAttribute("patchsrc"),se.hasAttribute&&se.hasAttribute("for")&&ye!=="label"&&ye!=="output"&&se.removeAttribute("for")}catch{}}const X=M(P);if(X)for(let se=X.length-1;se>=0;--se)S.push(X[se])}},Ec=function(v){let S=null,P=null;if(Go)v="<remove></remove>"+v;else{const se=b0(v,/^[\r\n\t ]+/);P=se&&se[0]}Ds==="application/xhtml+xml"&&Gi===er&&(v='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+v+"</body></html>");const W=re?Tt(v):v;if(Gi===er)try{S=new f().parseFromString(W,Ds)}catch{}if(!S||!S.documentElement){S=Yt.createDocument(Gi,"template",null);try{S.documentElement.innerHTML=Zo?ne:W}catch{}}const X=S.body||S.documentElement;return v&&P&&X.insertBefore(r.createTextNode(P),X.childNodes[0]||null),Gi===er?Zt.call(S,xr?"html":"body")[0]:xr?S.documentElement:X},Ac=function(v){const S=ee?ee(v):v.ownerDocument;return br.call(S||v,v,c.SHOW_ELEMENT|c.SHOW_COMMENT|c.SHOW_TEXT|c.SHOW_PROCESSING_INSTRUCTION|c.SHOW_CDATA_SECTION,null)},Oa=function(v){return v=Us(v,vt," "),v=Us(v,Ui," "),v=Us(v,Sa," "),v},rn=function(v){var S;v.normalize();const P=ee?ee(v):v.ownerDocument,W=br.call(P||v,v,c.SHOW_TEXT|c.SHOW_COMMENT|c.SHOW_CDATA_SECTION|c.SHOW_PROCESSING_INSTRUCTION,null);let X=W.nextNode();for(;X;)X.data=Oa(X.data),X=W.nextNode();const se=(S=v.querySelectorAll)===null||S===void 0?void 0:S.call(v,"template");se&&Zi(se,ye=>{Ki(ye.content)&&rn(ye.content)})},Ia=function(v){const S=K?K(v):null;return typeof S!="string"||Ee(S)!=="form"?!1:typeof v.nodeName!="string"||typeof v.textContent!="string"||typeof v.removeChild!="function"||v.attributes!==J(v)||typeof v.removeAttribute!="function"||typeof v.setAttribute!="function"||typeof v.namespaceURI!="string"||typeof v.insertBefore!="function"||typeof v.hasChildNodes!="function"||v.nodeType!==V(v)||v.childNodes!==M(v)},Ki=function(v){if(!V||typeof v!="object"||v===null)return!1;try{return V(v)===bt.documentFragment}catch{return!1}},Is=function(v){if(!V||typeof v!="object"||v===null)return!1;try{return typeof V(v)=="number"}catch{return!1}};function tr(B,v,S){B.length!==0&&Zi(B,P=>{P.call(e,v,S,Xi)})}const Fh=function(v,S){return!!(Ht&&v.hasChildNodes()&&!Is(v.firstElementChild)&&Ue($0,v.textContent)&&Ue($0,v.innerHTML)||Ht&&v.namespaceURI===er&&S==="style"&&Is(v.firstElementChild)||v.nodeType===bt.processingInstruction||Ht&&v.nodeType===bt.comment&&Ue(T0,v.data))},Hh=function(v,S,P){if(!hi[S]&&Oc(S)&&($e.tagNameCheck instanceof RegExp&&Ue($e.tagNameCheck,S)||$e.tagNameCheck instanceof Function&&$e.tagNameCheck(S)))return!1;if(Xo&&!Qt[S]){const W=N(v),X=M(v);if(X&&W){const se=X.length;for(let ye=se-1;ye>=0;--ye){const Ae=v===P?k(X[ye],!0):X[ye];W.insertBefore(Ae,O(v))}}}return Ir(v),!0},Mc=function(v,S,P,W){return v.length===0?S:S===P||S===W?Ke(S):S},Pc=function(v,S){if(tr(be.beforeSanitizeElements,v,null),v!==S&&N(v)===null)return Aa&&Os(v),!0;if(Ia(v))return Ir(v),!0;const P=Ee(K?K(v):v.nodeName);if(_e=Mc(be.uponSanitizeElement,_e,Or,yr),tr(be.uponSanitizeElement,v,{tagName:P,allowedTags:_e}),v!==S&&N(v)===null)return Aa&&Os(v),!0;if(Fh(v,P))return Ir(v),!0;if(hi[P]||!(Nt.tagCheck instanceof Function&&Nt.tagCheck(P))&&!_e[P]){const X=Hh(v,P,S);return X===!1&&tr(be.afterSanitizeElements,v,null),X}if((V?V(v):v.nodeType)===bt.element&&!Lh(v)||(P==="noscript"||P==="noembed"||P==="noframes")&&Ue(em,v.innerHTML))return Ir(v),!0;if(Ft&&v.nodeType===bt.text){const X=Oa(v.textContent);v.textContent!==X&&(Ji(e.removed,{element:v.cloneNode()}),v.textContent=X)}return tr(be.afterSanitizeElements,v,null),!1},Dc=function(v,S,P){if(As[S]||Ht&&S==="patchsrc"||Ht&&S==="for"&&v!=="label"&&v!=="output"||gc&&(S==="id"||S==="name")&&(P in r||P in Dh))return!1;const W=ge[S]||Nt.attributeCheck instanceof Function&&Nt.attributeCheck(S,v);if(!(Ms&&Ue(Vo,S))){if(!(pi&&Ue(Dr,S))){if(W){if(!Yo[S]){if(!Ue(Cs,Us(P,gr,""))){if(!((S==="src"||S==="xlink:href"||S==="href")&&v!=="script"&&g0(P,"data:")===0&&wc[v])){if(!(Ta&&!Ue(za,Us(P,gr,"")))){if(P)return!1}}}}}else if(!(Oc(v)&&($e.tagNameCheck instanceof RegExp&&Ue($e.tagNameCheck,v)||$e.tagNameCheck instanceof Function&&$e.tagNameCheck(v))&&($e.attributeNameCheck instanceof RegExp&&Ue($e.attributeNameCheck,S)||$e.attributeNameCheck instanceof Function&&$e.attributeNameCheck(S,v))||S==="is"&&$e.allowCustomizedBuiltInElements&&($e.tagNameCheck instanceof RegExp&&Ue($e.tagNameCheck,P)||$e.tagNameCheck instanceof Function&&$e.tagNameCheck(P))))return!1}}return!0},qh=ue({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),Oc=function(v){return!qh[Gs(v)]&&Ue($a,v)},Uh=function(v,S,P,W){if(re&&typeof b=="object"&&typeof b.getAttributeType=="function"&&!P)switch(b.getAttributeType(v,S)){case"TrustedHTML":return Tt(W);case"TrustedScriptURL":return Ct(W)}return W},jh=function(v,S,P,W){try{P?v.setAttributeNS(P,S,W):v.setAttribute(S,W),Ia(v)?Ir(v):v0(e.removed)}catch{fi(S,v)}},Ic=function(v){tr(be.beforeSanitizeAttributes,v,null);const S=v.attributes;if(!S||Ia(v))return;ge=Mc(be.uponSanitizeAttribute,ge,Es,wr);const P={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:ge,forceKeepAttr:void 0};let W=S.length;const X=Ee(v.nodeName);for(;W--;){const se=S[W],ye=se.name,Ae=se.namespaceURI,ct=se.value,dt=Ee(ye),an=ct;let et=ye==="value"?an:Rf(an);if(P.attrName=dt,P.attrValue=et,P.keepAttr=!0,P.forceKeepAttr=void 0,tr(be.uponSanitizeAttribute,v,P),et=P.attrValue,xc&&(dt==="id"||dt==="name")&&g0(et,yc)!==0&&(fi(ye,v),et=yc+et),Ht&&Ue(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,et)){fi(ye,v);continue}if(dt==="attributename"&&b0(et,"href")){fi(ye,v);continue}if(!P.forceKeepAttr){if(!P.keepAttr){fi(ye,v);continue}if(!ji&&Ue(tm,et)){fi(ye,v);continue}if(Ft&&(et=Oa(et)),!Dc(X,dt,et)){fi(ye,v);continue}et=Uh(X,dt,Ae,et),et!==an&&jh(v,ye,Ae,et)}}tr(be.afterSanitizeAttributes,v,null)},Ra=function(v){let S=null;const P=Ac(v);for(tr(be.beforeSanitizeShadowDOM,v,null);S=P.nextNode();)if(tr(be.uponSanitizeShadowNode,S,null),Pc(S,v),Ic(S),Ki(S.content)&&Ra(S.content),(V?V(S):S.nodeType)===bt.element){const X=j(S);Ki(X)&&(sn(X),Ra(X))}tr(be.afterSanitizeShadowDOM,v,null)},sn=function(v){const S=[{node:v,shadow:null}];for(;S.length>0;){const P=S.pop();if(P.shadow){Ra(P.shadow);continue}const W=P.node,se=(V?V(W):W.nodeType)===bt.element,ye=M(W);if(ye)for(let Ae=ye.length-1;Ae>=0;--Ae)S.push({node:ye[Ae],shadow:null});if(se){const Ae=K?K(W):null;if(typeof Ae=="string"&&Ee(Ae)==="template"){const ct=W.content;Ki(ct)&&S.push({node:ct,shadow:null})}}if(se){const Ae=j(W);Ki(Ae)&&S.push({node:null,shadow:Ae},{node:Ae,shadow:null})}}};return e.sanitize=function(B){let v=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},S=null,P=null,W=null,X=null;if(Zo=!B,Zo&&(B="<!-->"),typeof B!="string"&&!Is(B)&&(B=Hf(B),typeof B!="string"))throw vi("dirty is not a string, aborting");if(!e.isSupported)return B;Ps?(_e=yr,ge=wr):tn(v),(be.uponSanitizeElement.length>0||be.uponSanitizeAttribute.length>0)&&(_e=Ke(_e)),be.uponSanitizeAttribute.length>0&&(ge=Ke(ge)),e.removed=[];const se=Aa&&typeof B!="string"&&Is(B);if(se){Nh(B);const ct=K?K(B):B.nodeName;if(typeof ct=="string"){const dt=Ee(ct);if(!_e[dt]||hi[dt])throw Da(B),vi("root node is forbidden and cannot be sanitized in-place")}if(Ia(B))throw Da(B),vi("root node is clobbered and cannot be sanitized in-place");try{sn(B)}catch(dt){throw Da(B),dt}}else if(Is(B))S=Ec("<!---->"),P=S.ownerDocument.importNode(B,!0),P.nodeType===bt.element&&P.nodeName==="BODY"||P.nodeName==="HTML"?S=P:S.appendChild(P),sn(P);else{if(!Wi&&!Ft&&!xr&&B.indexOf("<")===-1)return re&&Ea?Tt(B):B;if(S=Ec(B),!S)return Wi?null:Ea?ne:""}S&&Go&&Ir(S.firstChild);const ye=se?B:S;try{const ct=Ac(ye);for(;W=ct.nextNode();)Pc(W,ye),Ic(W),Ki(W.content)&&Ra(W.content)}catch(ct){throw se&&(Da(B),Zi(e.removed,dt=>{dt.element&&Os(dt.element)})),ct}if(se)return Zi(e.removed,ct=>{ct.element&&Os(ct.element)}),Ft&&rn(B),B;if(Wi){if(Ft&&rn(S),Ca)for(X=Ts.call(S.ownerDocument);S.firstChild;)X.appendChild(S.firstChild);else X=S;return(ge.shadowroot||ge.shadowrootmode)&&(X=Jt.call(i,X,!0)),X}let Ae=xr?S.outerHTML:S.innerHTML;return xr&&_e["!doctype"]&&S.ownerDocument&&S.ownerDocument.doctype&&S.ownerDocument.doctype.name&&Ue(Jf,S.ownerDocument.doctype.name)&&(Ae="<!DOCTYPE "+S.ownerDocument.doctype.name+`>
`+Ae),Ft&&(Ae=Oa(Ae)),re&&Ea?Tt(Ae):Ae},e.setConfig=function(){let B=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};tn(B),Ps=!0,yr=_e,wr=ge},e.clearConfig=function(){Xi=null,Ps=!1,yr=null,wr=null,re=le,ne=""},e.isValidAttribute=function(B,v,S){Xi||tn({});const P=Ee(B),W=Ee(v);return Dc(P,W,S)},e.addHook=function(B,v){typeof v=="function"&&je(be,B)&&Ji(be[B],v)},e.removeHook=function(B,v){if(je(be,B)){if(v!==void 0){const S=Of(be[B],v);return S===-1?void 0:If(be[B],S,1)[0]}return v0(be[B])}},e.removeHooks=function(B){je(be,B)&&(be[B]=[])},e.removeAllHooks=function(){be=C0()},e}var sm=gu();function po(t){return sm.sanitize(t,{ADD_ATTR:["loading","target"]})}var am=Object.defineProperty,om=Object.getOwnPropertyDescriptor,Xl=(t,e,r,i)=>{for(var s=i>1?void 0:i?om(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&am(e,r,s),s};let sa=class extends G{constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}_renderSnippet(){var r;const t=((r=this.result)==null?void 0:r.snippet)??"";if(!t)return null;const e=po(de.parse(t,{async:!1}));return p`<div class="snippet" .innerHTML=${e}></div>`}render(){if(!this.result)return null;const t=Math.round(this.result.score*100);return p`
      <div class="path">
        ${this.result.kind==="path"?p`<span class="badge">路径</span>`:null}
        ${this.result.path}${this.result.line?`:${this.result.line}`:""}
      </div>
      ${this._renderSnippet()}
      <div class="score">评分: ${t}%</div>
    `}};sa.styles=U`
    :host {
      display: block;
      background: var(--cortex-card-bg);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: 12px 16px;
      cursor: pointer;
      box-shadow: var(--cortex-shadow-sm);
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    :host([active]) {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
    }
    :host(:hover) {
      border-color: var(--cortex-primary);
    }
    .path {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
    .badge {
      display: inline-block;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
      margin-right: 4px;
    }
    .snippet {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      margin-top: 4px;
      line-height: 1.5;
    }
    /* 卡片是片段预览（snippet 已截断到 ~300 字符），让块级 md 元素
       自然展开即可，不再用 line-clamp 强行压成 4 行（块级 + 嵌套元素
       下 line-clamp 行为不一致，且 md 结构需要更多垂直空间）。 */
    .snippet h1, .snippet h2, .snippet h3, .snippet h4 {
      font-size: inherit;
      font-weight: 600;
      margin: 0;
      display: inline;
    }
    .snippet h1::before, .snippet h2::before,
    .snippet h3::before, .snippet h4::before {
      content: " ";
    }
    .snippet p { margin: 0; }
    .snippet p + p { margin-top: 4px; }
    .snippet ul, .snippet ol {
      margin: 4px 0;
      padding-left: 1.4em;
    }
    .snippet li { margin: 1px 0; }
    .snippet code {
      font-family: var(--cortex-font-mono);
      font-size: 0.9em;
      background: var(--cortex-surface-muted);
      padding: 0 3px;
      border-radius: var(--cortex-radius-sm);
    }
    .snippet pre {
      background: var(--cortex-surface-muted);
      padding: 6px 8px;
      border-radius: var(--cortex-radius-sm);
      overflow-x: auto;
      margin: 4px 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .snippet pre code {
      background: transparent;
      padding: 0;
    }
    .snippet blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 8px;
      color: var(--cortex-text-muted);
      margin: 4px 0;
    }
    .snippet a {
      color: var(--cortex-primary);
      text-decoration: none;
    }
    .snippet hr {
      border: none;
      border-top: 1px solid var(--cortex-border);
      margin: 6px 0;
    }
    .snippet table {
      border-collapse: collapse;
      font-size: var(--cortex-fs-sm);
      margin: 4px 0;
    }
    .snippet th, .snippet td {
      border: 1px solid var(--cortex-border);
      padding: 2px 6px;
    }
    .score {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      margin-top: 4px;
    }
    mark {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
  `;Xl([w({attribute:!1})],sa.prototype,"result",2);Xl([w({type:Boolean,reflect:!0})],sa.prototype,"active",2);sa=Xl([Z("result-card")],sa);var nm=Object.defineProperty,lm=Object.getOwnPropertyDescriptor,Eo=(t,e,r,i)=>{for(var s=i>1?void 0:i?lm(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&nm(e,r,s),s};let cs=class extends G{constructor(){super(...arguments),this.results=[],this.activeResult=null,this.loading=!1}render(){return p`
      <div class="list-pane">
        ${this.loading&&this.results.length===0?p`<div class="loading">搜索中</div>`:this.results.length===0?p`<div class="empty">无搜索结果</div>`:this.results.map(t=>p`
                <result-card
                  .result=${t}
                  ?active=${this.activeResult===t}>
                </result-card>`)}
      </div>
    `}};cs.styles=U`
    :host {
      display: flex;
      gap: var(--cortex-space-4);
      flex: 0 0 auto;
      min-height: 0;
    }
    .list-pane {
      flex: 0 0 var(--results-pane-width, 360px);
      min-width: 280px;
      max-width: 800px;
      background: var(--cortex-surface-muted);
      border-right: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-8);
    }
    .loading {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-8);
    }
    .loading::after {
      content: "";
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-left: 8px;
      border: 2px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      vertical-align: middle;
      animation: cortex-spin 0.8s linear infinite;
    }
    @keyframes cortex-spin { to { transform: rotate(360deg); } }
    /* 桌面：双栏，列表 + 预览；移动：单栏，点击触发 push */
    @media (max-width: 1023px) {
      :host { flex-direction: column; flex: 1; }
      .list-pane {
        flex: 1; max-width: none; min-width: 0;
        border-right: none; border-bottom: 1px solid var(--cortex-border);
      }
    }
  `;Eo([w({attribute:!1})],cs.prototype,"results",2);Eo([w({attribute:!1})],cs.prototype,"activeResult",2);Eo([w({type:Boolean})],cs.prototype,"loading",2);cs=Eo([Z("search-results")],cs);class I extends Error{constructor(e,r){var i="KaTeX parse error: "+e,s,a,o=r&&r.loc;if(o&&o.start<=o.end){var l=o.lexer.input;s=o.start,a=o.end,s===l.length?i+=" at end of input: ":i+=" at position "+(s+1)+": ";var c=l.slice(s,a).replace(/[^]/g,"$&̲"),h;s>15?h="…"+l.slice(s-15,s):h=l.slice(0,s);var f;a+15<l.length?f=l.slice(a,a+15)+"…":f=l.slice(a),i+=h+c+f}super(i),this.name="ParseError",this.position=void 0,this.length=void 0,this.rawMessage=void 0,Object.setPrototypeOf(this,I.prototype),this.position=s,s!=null&&a!=null&&(this.length=a-s),this.rawMessage=e}}var cm=/([A-Z])/g,dm=t=>t.replace(cm,"-$1").toLowerCase(),um={"&":"&amp;",">":"&gt;","<":"&lt;",'"':"&quot;","'":"&#x27;"},hm=/[&><"']/g,Ze=t=>String(t).replace(hm,e=>um[e]),Qa=t=>t.type==="ordgroup"||t.type==="color"?t.body.length===1?Qa(t.body[0]):t:t.type==="font"?Qa(t.body):t,pm=new Set(["mathord","textord","atom"]),Er=t=>pm.has(Qa(t).type),fm=t=>{var e=/^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(t);return e?e[2]!==":"||!/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(e[1])?null:e[1].toLowerCase():"_relative"},Jn={displayMode:{type:"boolean",description:"Render math in display mode, which puts the math in display style (so \\int and \\sum are large, for example), and centers the math on the page on its own line.",cli:"-d, --display-mode"},output:{type:{enum:["htmlAndMathml","html","mathml"]},description:"Determines the markup language of the output.",cli:"-F, --format <type>"},leqno:{type:"boolean",description:"Render display math in leqno style (left-justified tags)."},fleqn:{type:"boolean",description:"Render display math flush left."},throwOnError:{type:"boolean",default:!0,cli:"-t, --no-throw-on-error",cliDescription:"Render errors (in the color given by --error-color) instead of throwing a ParseError exception when encountering an error."},errorColor:{type:"string",default:"#cc0000",cli:"-c, --error-color <color>",cliDescription:"A color string given in the format 'rgb' or 'rrggbb' (no #). This option determines the color of errors rendered by the -t option.",cliProcessor:t=>"#"+t},macros:{type:"object",cli:"-m, --macro <def>",cliDescription:"Define custom macro of the form '\\foo:expansion' (use multiple -m arguments for multiple macros).",cliDefault:[],cliProcessor:(t,e)=>(e.push(t),e)},minRuleThickness:{type:"number",description:"Specifies a minimum thickness, in ems, for fraction lines, `\\sqrt` top lines, `{array}` vertical lines, `\\hline`, `\\hdashline`, `\\underline`, `\\overline`, and the borders of `\\fbox`, `\\boxed`, and `\\fcolorbox`.",processor:t=>Math.max(0,t),cli:"--min-rule-thickness <size>",cliProcessor:parseFloat},colorIsTextColor:{type:"boolean",description:"Makes \\color behave like LaTeX's 2-argument \\textcolor, instead of LaTeX's one-argument \\color mode change.",cli:"-b, --color-is-text-color"},strict:{type:[{enum:["warn","ignore","error"]},"boolean","function"],description:"Turn on strict / LaTeX faithfulness mode, which throws an error if the input uses features that are not supported by LaTeX.",cli:"-S, --strict",cliDefault:!1},trust:{type:["boolean","function"],description:"Trust the input, enabling all HTML features such as \\url.",cli:"-T, --trust"},maxSize:{type:"number",default:1/0,description:"If non-zero, all user-specified sizes, e.g. in \\rule{500em}{500em}, will be capped to maxSize ems. Otherwise, elements and spaces can be arbitrarily large",processor:t=>Math.max(0,t),cli:"-s, --max-size <n>",cliProcessor:parseInt},maxExpand:{type:"number",default:1e3,description:"Limit the number of macro expansions to the specified number, to prevent e.g. infinite macro loops. If set to Infinity, the macro expander will try to fully expand as in LaTeX.",processor:t=>Math.max(0,t),cli:"-e, --max-expand <n>",cliProcessor:t=>t==="Infinity"?1/0:parseInt(t)},globalGroup:{type:"boolean",cli:!1}};function mm(t){if(typeof t!="string")return t.enum[0];switch(t){case"boolean":return!1;case"string":return"";case"number":return 0;case"object":return{};default:throw new Error("Unexpected schema type; settings must declare an explicit default.")}}function vm(t){if(t.default!==void 0)return t.default;var e=Array.isArray(t.type)?t.type[0]:t.type;return mm(e)}function bm(t,e,r,i){var s=r[e];t[e]=s!==void 0?i.processor?i.processor(s):s:vm(i)}class Kl{constructor(e){e===void 0&&(e={}),this.displayMode=void 0,this.output=void 0,this.leqno=void 0,this.fleqn=void 0,this.throwOnError=void 0,this.errorColor=void 0,this.macros=void 0,this.minRuleThickness=void 0,this.colorIsTextColor=void 0,this.strict=void 0,this.trust=void 0,this.maxSize=void 0,this.maxExpand=void 0,this.globalGroup=void 0,e=e||{};for(var r of Object.keys(Jn)){var i=Jn[r];i&&bm(this,r,e,i)}}reportNonstrict(e,r,i){var s=this.strict;if(typeof s=="function"&&(s=s(e,r,i)),!(!s||s==="ignore")){if(s===!0||s==="error")throw new I("LaTeX-incompatible input and strict mode is set to 'error': "+(r+" ["+e+"]"),i);s==="warn"?typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+(r+" ["+e+"]")):typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to "+("unrecognized '"+s+"': "+r+" ["+e+"]"))}}useStrictBehavior(e,r,i){var s=this.strict;if(typeof s=="function")try{s=s(e,r,i)}catch{s="error"}return!s||s==="ignore"?!1:s===!0||s==="error"?!0:s==="warn"?(typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+(r+" ["+e+"]")),!1):(typeof console<"u"&&console.warn("LaTeX-incompatible input and strict mode is set to "+("unrecognized '"+s+"': "+r+" ["+e+"]")),!1)}isTrusted(e){if("url"in e&&e.url&&!e.protocol){var r=fm(e.url);if(r==null)return!1;e.protocol=r}var i=typeof this.trust=="function"?this.trust(e):this.trust;return!!i}}class Br{constructor(e,r,i){this.id=void 0,this.size=void 0,this.cramped=void 0,this.id=e,this.size=r,this.cramped=i}sup(){return ir[gm[this.id]]}sub(){return ir[xm[this.id]]}fracNum(){return ir[ym[this.id]]}fracDen(){return ir[wm[this.id]]}cramp(){return ir[_m[this.id]]}text(){return ir[km[this.id]]}isTight(){return this.size>=2}}var Yl=0,fo=1,as=2,zr=3,aa=4,Mt=5,ds=6,it=7,ir=[new Br(Yl,0,!1),new Br(fo,0,!0),new Br(as,1,!1),new Br(zr,1,!0),new Br(aa,2,!1),new Br(Mt,2,!0),new Br(ds,3,!1),new Br(it,3,!0)],gm=[aa,Mt,aa,Mt,ds,it,ds,it],xm=[Mt,Mt,Mt,Mt,it,it,it,it],ym=[as,zr,aa,Mt,ds,it,ds,it],wm=[zr,zr,Mt,Mt,it,it,it,it],_m=[fo,fo,zr,zr,Mt,Mt,it,it],km=[Yl,fo,as,zr,as,zr,as,zr],ie={DISPLAY:ir[Yl],TEXT:ir[as],SCRIPT:ir[aa],SCRIPTSCRIPT:ir[ds]},Qn=[{name:"latin",blocks:[[256,591],[768,879]]},{name:"cyrillic",blocks:[[1024,1279]]},{name:"armenian",blocks:[[1328,1423]]},{name:"brahmic",blocks:[[2304,4255]]},{name:"georgian",blocks:[[4256,4351]]},{name:"cjk",blocks:[[12288,12543],[19968,40879],[65280,65376]]},{name:"hangul",blocks:[[44032,55215]]}];function Sm(t){for(var e=0;e<Qn.length;e++)for(var r=Qn[e],i=0;i<r.blocks.length;i++){var s=r.blocks[i];if(t>=s[0]&&t<=s[1])return r.name}return null}var eo=[];Qn.forEach(t=>t.blocks.forEach(e=>eo.push(...e)));function xu(t){for(var e=0;e<eo.length;e+=2)if(t>=eo[e]&&t<=eo[e+1])return!0;return!1}var Fe=t=>t+" "+t,Qi=80,zm=function(e,r){return"M95,"+(622+e+r)+`
c-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,-10,-9.5,-14
c0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54
c44.2,-33.3,65.8,-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10
s173,378,173,378c0.7,0,35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429
c69,-144,104.5,-217.7,106.5,-221
l`+e/2.075+" -"+e+`
c5.3,-9.3,12,-14,20,-14
H400000v`+(40+e)+`H845.2724
s-225.272,467,-225.272,467s-235,486,-235,486c-2.7,4.7,-9,7,-19,7
c-6,0,-10,-1,-12,-3s-194,-422,-194,-422s-65,47,-65,47z
M`+(834+e)+" "+r+"h400000v"+(40+e)+"h-400000z"},$m=function(e,r){return"M263,"+(601+e+r)+`c0.7,0,18,39.7,52,119
c34,79.3,68.167,158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120
c340,-704.7,510.7,-1060.3,512,-1067
l`+e/2.084+" -"+e+`
c4.7,-7.3,11,-11,19,-11
H40000v`+(40+e)+`H1012.3
s-271.3,567,-271.3,567c-38.7,80.7,-84,175,-136,283c-52,108,-89.167,185.3,-111.5,232
c-22.3,46.7,-33.8,70.3,-34.5,71c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1
s-109,-253,-109,-253c-72.7,-168,-109.3,-252,-110,-252c-10.7,8,-22,16.7,-34,26
c-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26s76,-59,76,-59s76,-60,76,-60z
M`+(1001+e)+" "+r+"h400000v"+(40+e)+"h-400000z"},Tm=function(e,r){return"M983 "+(10+e+r)+`
l`+e/3.13+" -"+e+`
c4,-6.7,10,-10,18,-10 H400000v`+(40+e)+`
H1013.1s-83.4,268,-264.1,840c-180.7,572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7
s-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744
c-10,12,-21,25,-33,39s-32,39,-32,39c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30
c26.7,-32.7,52,-63,76,-91s52,-60,52,-60s208,722,208,722
c56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,-658.5
c53.7,-170.3,84.5,-266.8,92.5,-289.5z
M`+(1001+e)+" "+r+"h400000v"+(40+e)+"h-400000z"},Cm=function(e,r){return"M424,"+(2398+e+r)+`
c-1.3,-0.7,-38.5,-172,-111.5,-514c-73,-342,-109.8,-513.3,-110.5,-514
c0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,25c-5.7,9.3,-9.8,16,-12.5,20
s-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,-13s76,-122,76,-122s77,-121,77,-121
s209,968,209,968c0,-2,84.7,-361.7,254,-1079c169.3,-717.3,254.7,-1077.7,256,-1081
l`+e/4.223+" -"+e+`c4,-6.7,10,-10,18,-10 H400000
v`+(40+e)+`H1014.6
s-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185
c-2,6,-10,9,-24,9
c-8,0,-12,-0.7,-12,-2z M`+(1001+e)+" "+r+`
h400000v`+(40+e)+"h-400000z"},Em=function(e,r){return"M473,"+(2713+e+r)+`
c339.3,-1799.3,509.3,-2700,510,-2702 l`+e/5.298+" -"+e+`
c3.3,-7.3,9.3,-11,18,-11 H400000v`+(40+e)+`H1017.7
s-90.5,478,-276.2,1466c-185.7,988,-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9
c-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200
c0,-1.3,-5.3,8.7,-16,30c-10.7,21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26
s76,-153,76,-153s77,-151,77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,
606zM`+(1001+e)+" "+r+"h400000v"+(40+e)+"H1017.7z"},Am=function(e){var r=e/2;return"M400000 "+e+" H0 L"+r+" 0 l65 45 L145 "+(e-80)+" H400000z"},Mm=function(e,r,i){var s=i-54-r-e;return"M702 "+(e+r)+"H400000"+(40+e)+`
H742v`+s+`l-4 4-4 4c-.667.7 -2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1
h-12l-28-84c-16.667-52-96.667 -294.333-240-727l-212 -643 -85 170
c-4-3.333-8.333-7.667-13 -13l-13-13l77-155 77-156c66 199.333 139 419.667
219 661 l218 661zM702 `+r+"H400000v"+(40+e)+"H742z"},Pm=function(e,r,i){r=1e3*r;var s="";switch(e){case"sqrtMain":s=zm(r,Qi);break;case"sqrtSize1":s=$m(r,Qi);break;case"sqrtSize2":s=Tm(r,Qi);break;case"sqrtSize3":s=Cm(r,Qi);break;case"sqrtSize4":s=Em(r,Qi);break;case"sqrtTall":s=Mm(r,Qi,i)}return s},Dm=function(e,r){switch(e){case"⎜":return Fe("M291 0 H417 V"+r+" H291z");case"∣":return Fe("M145 0 H188 V"+r+" H145z");case"∥":return Fe("M145 0 H188 V"+r+" H145z")+Fe("M367 0 H410 V"+r+" H367z");case"⎟":return Fe("M457 0 H583 V"+r+" H457z");case"⎢":return Fe("M319 0 H403 V"+r+" H319z");case"⎥":return Fe("M263 0 H347 V"+r+" H263z");case"⎪":return Fe("M384 0 H504 V"+r+" H384z");case"⏐":return Fe("M312 0 H355 V"+r+" H312z");case"‖":return Fe("M257 0 H300 V"+r+" H257z")+Fe("M478 0 H521 V"+r+" H478z");default:return""}},E0={doubleleftarrow:`M262 157
l10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3
 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28
 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5
c2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5
 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87
-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7
-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z
m8 0v40h399730v-40zm0 194v40h399730v-40z`,doublerightarrow:`M399738 392l
-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5
 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88
-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68
-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18
-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782
c-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3
-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z`,leftarrow:`M400000 241H110l3-3c68.7-52.7 113.7-120
 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8
-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247
c-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208
 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3
 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202
 l-3-3h399890zM100 241v40h399900v-40z`,leftbrace:`M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117
-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7
 5-6 9-10 13-.7 1-7.3 1-20 1H6z`,leftbraceunder:`M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13
 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688
 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7
-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z`,leftgroup:`M400000 80
H435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0
 435 0h399565z`,leftgroupunder:`M400000 262
H435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219
 435 219h399565z`,leftharpoon:`M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3
-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5
-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7
-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z`,leftharpoonplus:`M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5
 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3
-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7
-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z
m0 0v40h400000v-40z`,leftharpoondown:`M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333
 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5
 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667
-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z`,leftharpoondownplus:`M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12
 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7
-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0
v40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z`,lefthook:`M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5
-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3
-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21
 71.5 23h399859zM103 281v-40h399897v40z`,leftlinesegment:Fe("M40 281 V428 H0 V94 H40 V241 H400000 v40z"),leftbracketunder:Fe("M0 0 h120 V290 H399995 v120 H0z"),leftbracketover:Fe("M0 440 h120 V150 H399995 v-120 H0z"),leftmapsto:Fe("M40 281 V448H0V74H40V241H400000v40z"),leftToFrom:`M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23
-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8
c28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3
 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z`,longequal:Fe("M0 50 h400000 v40H0z m0 194h40000v40H0z"),midbrace:`M200428 334
c-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14
-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7
 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11
 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z`,midbraceunder:`M199572 214
c100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14
 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3
 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0
-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z`,oiintSize1:`M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6
-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z
m368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8
60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z`,oiintSize2:`M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8
-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z
m502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2
c0 110 84 276 504 276s502.4-166 502.4-276z`,oiiintSize1:`M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6
-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z
m525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0
85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z`,oiiintSize2:`M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8
-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z
m770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1
c0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z`,rightarrow:`M0 241v40h399891c-47.3 35.3-84 78-110 128
-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20
 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7
 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85
-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
 151.7 139 205zm0 0v40h399900v-40z`,rightbrace:`M400000 542l
-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5
s-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1
c124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z`,rightbraceunder:`M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3
 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237
-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z`,rightgroup:`M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0
 3-1 3-3v-38c-76-158-257-219-435-219H0z`,rightgroupunder:`M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18
 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z`,rightharpoon:`M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3
-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2
-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58
 69.2 92 94.5zm0 0v40h399900v-40z`,rightharpoonplus:`M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11
-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7
 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z
m0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z`,rightharpoondown:`M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8
 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5
-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95
-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z`,rightharpoondownplus:`M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8
 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3
 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3
-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z
m0-194v40h400000v-40zm0 0v40h400000v-40z`,righthook:`M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3
 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0
-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21
 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z`,rightlinesegment:Fe("M399960 241 V94 h40 V428 h-40 V281 H0 v-40z"),rightbracketunder:Fe("M399995 0 h-120 V290 H0 v120 H400000z"),rightbracketover:Fe("M399995 440 h-120 V150 H0 v-120 H399995z"),rightToFrom:`M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23
 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32
-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142
-167z M100 147v40h399900v-40zM0 341v40h399900v-40z`,twoheadleftarrow:`M0 167c68 40
 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69
-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3
-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19
-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101
 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z`,twoheadrightarrow:`M400000 167
c-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3
 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42
 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333
-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70
 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z`,tilde1:`M200 55.538c-77 0-168 73.953-177 73.953-3 0-7
-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0
 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0
 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128
-68.267.847-113-73.952-191-73.952z`,tilde2:`M344 55.266c-142 0-300.638 81.316-311.5 86.418
-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9
 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114
c1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751
 181.476 676 181.476c-149 0-189-126.21-332-126.21z`,tilde3:`M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457
-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0
 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697
 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696
 -338 0-409-156.573-744-156.573z`,tilde4:`M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345
-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409
 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9
 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409
 -175.236-744-175.236z`,vec:`M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5
3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11
10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63
-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1
-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59
H213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359
c-16-25.333-24-45-24-59z`,widehat1:`M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22
c-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z`,widehat2:`M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widehat3:`M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widehat4:`M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widecheck1:`M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,
-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z`,widecheck2:`M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,widecheck3:`M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,widecheck4:`M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,baraboveleftarrow:`M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202
c4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5
c-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130
s-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47
121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6
s2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11
c0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z
M100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z`,rightarrowabovebar:`M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32
-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0
13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39
-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5
-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z`,baraboveshortleftharpoon:`M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17
c2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21
c-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40
c-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z
M0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z`,rightharpoonaboveshortbar:`M0,241 l0,40c399126,0,399993,0,399993,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z`,shortbaraboveleftharpoon:`M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,
1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,
-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z
M93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z`,shortrightharpoonabovebar:`M53,241l0,40c398570,0,399437,0,399437,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z`},Om=function(e,r){switch(e){case"lbrack":return"M403 1759 V84 H666 V0 H319 V1759 v"+r+` v1759 v84 h347 v-84
H403z M403 1759 V0 H319 V1759 v`+r+" v1759 v84 h84z";case"rbrack":return"M347 1759 V0 H0 V84 H263 V1759 v"+r+` v1759 H0 v84 H347z
M347 1759 V0 H263 V1759 v`+r+" v1759 h84z";case"vert":return"M145 15 v585 v"+r+` v585 c2.667,10,9.667,15,21,15
c10,0,16.667,-5,20,-15 v-585 v`+-r+` v-585 c-2.667,-10,-9.667,-15,-21,-15
c-10,0,-16.667,5,-20,15z M188 15 H145 v585 v`+r+" v585 h43z";case"doublevert":return"M145 15 v585 v"+r+` v585 c2.667,10,9.667,15,21,15
c10,0,16.667,-5,20,-15 v-585 v`+-r+` v-585 c-2.667,-10,-9.667,-15,-21,-15
c-10,0,-16.667,5,-20,15z M188 15 H145 v585 v`+r+` v585 h43z
M367 15 v585 v`+r+` v585 c2.667,10,9.667,15,21,15
c10,0,16.667,-5,20,-15 v-585 v`+-r+` v-585 c-2.667,-10,-9.667,-15,-21,-15
c-10,0,-16.667,5,-20,15z M410 15 H367 v585 v`+r+" v585 h43z";case"lfloor":return"M319 602 V0 H403 V602 v"+r+` v1715 h263 v84 H319z
MM319 602 V0 H403 V602 v`+r+" v1715 H319z";case"rfloor":return"M319 602 V0 H403 V602 v"+r+` v1799 H0 v-84 H319z
MM319 602 V0 H403 V602 v`+r+" v1715 H319z";case"lceil":return"M403 1759 V84 H666 V0 H319 V1759 v"+r+` v602 h84z
M403 1759 V0 H319 V1759 v`+r+" v602 h84z";case"rceil":return"M347 1759 V0 H0 V84 H263 V1759 v"+r+` v602 h84z
M347 1759 V0 h-84 V1759 v`+r+" v602 h84z";case"lparen":return`M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1
c-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,
-36,557 l0,`+(r+84)+`c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,
949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9
c0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,
-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189
l0,-`+(r+92)+`c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,
-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z`;case"rparen":return`M76,0c-16.7,0,-25,3,-25,9c0,2,2,6.3,6,13c21.3,28.7,42.3,60.3,
63,95c96.7,156.7,172.8,332.5,228.5,527.5c55.7,195,92.8,416.5,111.5,664.5
c11.3,139.3,17,290.7,17,454c0,28,1.7,43,3.3,45l0,`+(r+9)+`
c-3,4,-3.3,16.7,-3.3,38c0,162,-5.7,313.7,-17,455c-18.7,248,-55.8,469.3,-111.5,664
c-55.7,194.7,-131.8,370.3,-228.5,527c-20.7,34.7,-41.7,66.3,-63,95c-2,3.3,-4,7,-6,11
c0,7.3,5.7,11,17,11c0,0,11,0,11,0c9.3,0,14.3,-0.3,15,-1c5.3,-5.3,10.3,-11,15,-17
c242.7,-294.7,395.3,-681.7,458,-1161c21.3,-164.7,33.3,-350.7,36,-558
l0,-`+(r+144)+`c-2,-159.3,-10,-310.7,-24,-454c-53.3,-528,-210,-949.7,
-470,-1265c-4.7,-6,-9.7,-11.7,-15,-17c-0.7,-0.7,-6.7,-1,-18,-1z`;default:throw new Error("Unknown stretchy delimiter.")}};function Im(t){return"toText"in t}class ws{constructor(e){this.children=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,this.children=e,this.classes=[],this.height=0,this.depth=0,this.maxFontSize=0,this.style={}}hasClass(e){return this.classes.includes(e)}toNode(){for(var e=document.createDocumentFragment(),r=0;r<this.children.length;r++)e.appendChild(this.children[r].toNode());return e}toMarkup(){for(var e="",r=0;r<this.children.length;r++)e+=this.children[r].toMarkup();return e}toText(){return this.children.map(e=>{if(Im(e))return e.toText();throw new Error("Expected MathDomNode with toText, got "+e.constructor.name)}).join("")}}var el={pt:1,mm:7227/2540,cm:7227/254,in:72.27,bp:803/800,pc:12,dd:1238/1157,cc:14856/1157,nd:685/642,nc:1370/107,sp:1/65536,px:803/800},Rm={ex:!0,em:!0,mu:!0},yu=function(e){return typeof e!="string"&&(e=e.unit),e in el||e in Rm||e==="ex"},Pe=function(e,r){var i;if(e.unit in el)i=el[e.unit]/r.fontMetrics().ptPerEm/r.sizeMultiplier;else if(e.unit==="mu")i=r.fontMetrics().cssEmPerMu;else{var s;if(r.style.isTight()?s=r.havingStyle(r.style.text()):s=r,e.unit==="ex")i=s.fontMetrics().xHeight;else if(e.unit==="em")i=s.fontMetrics().quad;else throw new I("Invalid unit: '"+e.unit+"'");s!==r&&(i*=s.sizeMultiplier/r.sizeMultiplier)}return Math.min(e.number*i,r.maxSize)},L=function(e){return+e.toFixed(4)+"em"},Qr=function(e){return e.filter(r=>r).join(" ")},Zl=function(e){var r="";for(var i of Object.keys(e)){var s=e[i];s!==void 0&&(r+=dm(i)+":"+s+";")}return r},wu=function(e,r,i){if(this.classes=e||[],this.attributes={},this.height=0,this.depth=0,this.maxFontSize=0,this.style=i||{},r){r.style.isTight()&&this.classes.push("mtight");var s=r.getColor();s&&(this.style.color=s)}},_u=function(e){var r=document.createElement(e);r.className=Qr(this.classes),Object.assign(r.style,this.style);for(var i of Object.keys(this.attributes))r.setAttribute(i,this.attributes[i]);for(var s=0;s<this.children.length;s++)r.appendChild(this.children[s].toNode());return r},Lm=/[\s"'>/=\x00-\x1f]/,ku=function(e){var r="<"+e;this.classes.length&&(r+=' class="'+Ze(Qr(this.classes))+'"');var i=Zl(this.style);i&&(r+=' style="'+Ze(i)+'"');for(var s of Object.keys(this.attributes)){if(Lm.test(s))throw new I("Invalid attribute name '"+s+"'");r+=" "+s+'="'+Ze(this.attributes[s])+'"'}r+=">";for(var a=0;a<this.children.length;a++)r+=this.children[a].toMarkup();return r+="</"+e+">",r};class _s{constructor(e,r,i,s){this.children=void 0,this.attributes=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.width=void 0,this.maxFontSize=void 0,this.style=void 0,this.italic=void 0,wu.call(this,e,i,s),this.children=r||[]}setAttribute(e,r){this.attributes[e]=r}hasClass(e){return this.classes.includes(e)}toNode(){return _u.call(this,"span")}toMarkup(){return ku.call(this,"span")}}class Ao{constructor(e,r,i,s){this.children=void 0,this.attributes=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,wu.call(this,r,s),this.children=i||[],this.setAttribute("href",e)}setAttribute(e,r){this.attributes[e]=r}hasClass(e){return this.classes.includes(e)}toNode(){return _u.call(this,"a")}toMarkup(){return ku.call(this,"a")}}class Bm{constructor(e,r,i){this.src=void 0,this.alt=void 0,this.classes=void 0,this.height=void 0,this.depth=void 0,this.maxFontSize=void 0,this.style=void 0,this.alt=r,this.src=e,this.classes=["mord"],this.height=0,this.depth=0,this.maxFontSize=0,this.style=i}hasClass(e){return this.classes.includes(e)}toNode(){var e=document.createElement("img");return e.src=this.src,e.alt=this.alt,e.className="mord",Object.assign(e.style,this.style),e}toMarkup(){var e='<img src="'+Ze(this.src)+'"'+(' alt="'+Ze(this.alt)+'"'),r=Zl(this.style);return r&&(e+=' style="'+Ze(r)+'"'),e+="'/>",e}}var Nm={î:"ı̂",ï:"ı̈",í:"ı́",ì:"ı̀"};class xt{constructor(e,r,i,s,a,o,l,c){this.text=void 0,this.height=void 0,this.depth=void 0,this.italic=void 0,this.skew=void 0,this.width=void 0,this.maxFontSize=void 0,this.classes=void 0,this.style=void 0,this.text=e,this.height=r||0,this.depth=i||0,this.italic=s||0,this.skew=a||0,this.width=o||0,this.classes=l||[],this.style=c||{},this.maxFontSize=0;var h=Sm(this.text.charCodeAt(0));h&&this.classes.push(h+"_fallback"),/[îïíì]/.test(this.text)&&(this.text=Nm[this.text])}hasClass(e){return this.classes.includes(e)}toNode(){var e=document.createTextNode(this.text),r=null;return this.italic>0&&(r=document.createElement("span"),r.style.marginRight=L(this.italic)),this.classes.length>0&&(r=r||document.createElement("span"),r.className=Qr(this.classes)),Object.keys(this.style).length>0&&(r=r||document.createElement("span"),Object.assign(r.style,this.style)),r?(r.appendChild(e),r):e}toMarkup(){var e=!1,r="<span";this.classes.length&&(e=!0,r+=' class="',r+=Ze(Qr(this.classes)),r+='"');var i="";this.italic>0&&(i+="margin-right:"+L(this.italic)+";"),i+=Zl(this.style),i&&(e=!0,r+=' style="'+Ze(i)+'"');var s=Ze(this.text);return e?(r+=">",r+=s,r+="</span>",r):s}}class $r{constructor(e,r){this.children=void 0,this.attributes=void 0,this.children=e||[],this.attributes=r||{}}toNode(){var e="http://www.w3.org/2000/svg",r=document.createElementNS(e,"svg");for(var i of Object.keys(this.attributes))r.setAttribute(i,this.attributes[i]);for(var s=0;s<this.children.length;s++)r.appendChild(this.children[s].toNode());return r}toMarkup(){var e='<svg xmlns="http://www.w3.org/2000/svg"';for(var r of Object.keys(this.attributes))e+=" "+r+'="'+Ze(this.attributes[r])+'"';e+=">";for(var i=0;i<this.children.length;i++)e+=this.children[i].toMarkup();return e+="</svg>",e}}class ei{constructor(e,r){this.pathName=void 0,this.alternate=void 0,this.pathName=e,this.alternate=r}toNode(){var e="http://www.w3.org/2000/svg",r=document.createElementNS(e,"path");return this.alternate?r.setAttribute("d",this.alternate):r.setAttribute("d",E0[this.pathName]),r}toMarkup(){return this.alternate?'<path d="'+Ze(this.alternate)+'"/>':'<path d="'+Ze(E0[this.pathName])+'"/>'}}class tl{constructor(e){this.attributes=void 0,this.attributes=e||{}}toNode(){var e="http://www.w3.org/2000/svg",r=document.createElementNS(e,"line");for(var i of Object.keys(this.attributes))r.setAttribute(i,this.attributes[i]);return r}toMarkup(){var e="<line";for(var r of Object.keys(this.attributes))e+=" "+r+'="'+Ze(this.attributes[r])+'"';return e+="/>",e}}function Fm(t){if(t instanceof xt)return t;throw new Error("Expected symbolNode but got "+String(t)+".")}function Hm(t){if(t instanceof _s)return t;throw new Error("Expected span<HtmlDomNode> but got "+String(t)+".")}var qm=t=>t instanceof _s||t instanceof Ao||t instanceof ws,sr={"AMS-Regular":{32:[0,0,0,0,.25],65:[0,.68889,0,0,.72222],66:[0,.68889,0,0,.66667],67:[0,.68889,0,0,.72222],68:[0,.68889,0,0,.72222],69:[0,.68889,0,0,.66667],70:[0,.68889,0,0,.61111],71:[0,.68889,0,0,.77778],72:[0,.68889,0,0,.77778],73:[0,.68889,0,0,.38889],74:[.16667,.68889,0,0,.5],75:[0,.68889,0,0,.77778],76:[0,.68889,0,0,.66667],77:[0,.68889,0,0,.94445],78:[0,.68889,0,0,.72222],79:[.16667,.68889,0,0,.77778],80:[0,.68889,0,0,.61111],81:[.16667,.68889,0,0,.77778],82:[0,.68889,0,0,.72222],83:[0,.68889,0,0,.55556],84:[0,.68889,0,0,.66667],85:[0,.68889,0,0,.72222],86:[0,.68889,0,0,.72222],87:[0,.68889,0,0,1],88:[0,.68889,0,0,.72222],89:[0,.68889,0,0,.72222],90:[0,.68889,0,0,.66667],107:[0,.68889,0,0,.55556],160:[0,0,0,0,.25],165:[0,.675,.025,0,.75],174:[.15559,.69224,0,0,.94666],240:[0,.68889,0,0,.55556],295:[0,.68889,0,0,.54028],710:[0,.825,0,0,2.33334],732:[0,.9,0,0,2.33334],770:[0,.825,0,0,2.33334],771:[0,.9,0,0,2.33334],989:[.08167,.58167,0,0,.77778],1008:[0,.43056,.04028,0,.66667],8245:[0,.54986,0,0,.275],8463:[0,.68889,0,0,.54028],8487:[0,.68889,0,0,.72222],8498:[0,.68889,0,0,.55556],8502:[0,.68889,0,0,.66667],8503:[0,.68889,0,0,.44445],8504:[0,.68889,0,0,.66667],8513:[0,.68889,0,0,.63889],8592:[-.03598,.46402,0,0,.5],8594:[-.03598,.46402,0,0,.5],8602:[-.13313,.36687,0,0,1],8603:[-.13313,.36687,0,0,1],8606:[.01354,.52239,0,0,1],8608:[.01354,.52239,0,0,1],8610:[.01354,.52239,0,0,1.11111],8611:[.01354,.52239,0,0,1.11111],8619:[0,.54986,0,0,1],8620:[0,.54986,0,0,1],8621:[-.13313,.37788,0,0,1.38889],8622:[-.13313,.36687,0,0,1],8624:[0,.69224,0,0,.5],8625:[0,.69224,0,0,.5],8630:[0,.43056,0,0,1],8631:[0,.43056,0,0,1],8634:[.08198,.58198,0,0,.77778],8635:[.08198,.58198,0,0,.77778],8638:[.19444,.69224,0,0,.41667],8639:[.19444,.69224,0,0,.41667],8642:[.19444,.69224,0,0,.41667],8643:[.19444,.69224,0,0,.41667],8644:[.1808,.675,0,0,1],8646:[.1808,.675,0,0,1],8647:[.1808,.675,0,0,1],8648:[.19444,.69224,0,0,.83334],8649:[.1808,.675,0,0,1],8650:[.19444,.69224,0,0,.83334],8651:[.01354,.52239,0,0,1],8652:[.01354,.52239,0,0,1],8653:[-.13313,.36687,0,0,1],8654:[-.13313,.36687,0,0,1],8655:[-.13313,.36687,0,0,1],8666:[.13667,.63667,0,0,1],8667:[.13667,.63667,0,0,1],8669:[-.13313,.37788,0,0,1],8672:[-.064,.437,0,0,1.334],8674:[-.064,.437,0,0,1.334],8705:[0,.825,0,0,.5],8708:[0,.68889,0,0,.55556],8709:[.08167,.58167,0,0,.77778],8717:[0,.43056,0,0,.42917],8722:[-.03598,.46402,0,0,.5],8724:[.08198,.69224,0,0,.77778],8726:[.08167,.58167,0,0,.77778],8733:[0,.69224,0,0,.77778],8736:[0,.69224,0,0,.72222],8737:[0,.69224,0,0,.72222],8738:[.03517,.52239,0,0,.72222],8739:[.08167,.58167,0,0,.22222],8740:[.25142,.74111,0,0,.27778],8741:[.08167,.58167,0,0,.38889],8742:[.25142,.74111,0,0,.5],8756:[0,.69224,0,0,.66667],8757:[0,.69224,0,0,.66667],8764:[-.13313,.36687,0,0,.77778],8765:[-.13313,.37788,0,0,.77778],8769:[-.13313,.36687,0,0,.77778],8770:[-.03625,.46375,0,0,.77778],8774:[.30274,.79383,0,0,.77778],8776:[-.01688,.48312,0,0,.77778],8778:[.08167,.58167,0,0,.77778],8782:[.06062,.54986,0,0,.77778],8783:[.06062,.54986,0,0,.77778],8785:[.08198,.58198,0,0,.77778],8786:[.08198,.58198,0,0,.77778],8787:[.08198,.58198,0,0,.77778],8790:[0,.69224,0,0,.77778],8791:[.22958,.72958,0,0,.77778],8796:[.08198,.91667,0,0,.77778],8806:[.25583,.75583,0,0,.77778],8807:[.25583,.75583,0,0,.77778],8808:[.25142,.75726,0,0,.77778],8809:[.25142,.75726,0,0,.77778],8812:[.25583,.75583,0,0,.5],8814:[.20576,.70576,0,0,.77778],8815:[.20576,.70576,0,0,.77778],8816:[.30274,.79383,0,0,.77778],8817:[.30274,.79383,0,0,.77778],8818:[.22958,.72958,0,0,.77778],8819:[.22958,.72958,0,0,.77778],8822:[.1808,.675,0,0,.77778],8823:[.1808,.675,0,0,.77778],8828:[.13667,.63667,0,0,.77778],8829:[.13667,.63667,0,0,.77778],8830:[.22958,.72958,0,0,.77778],8831:[.22958,.72958,0,0,.77778],8832:[.20576,.70576,0,0,.77778],8833:[.20576,.70576,0,0,.77778],8840:[.30274,.79383,0,0,.77778],8841:[.30274,.79383,0,0,.77778],8842:[.13597,.63597,0,0,.77778],8843:[.13597,.63597,0,0,.77778],8847:[.03517,.54986,0,0,.77778],8848:[.03517,.54986,0,0,.77778],8858:[.08198,.58198,0,0,.77778],8859:[.08198,.58198,0,0,.77778],8861:[.08198,.58198,0,0,.77778],8862:[0,.675,0,0,.77778],8863:[0,.675,0,0,.77778],8864:[0,.675,0,0,.77778],8865:[0,.675,0,0,.77778],8872:[0,.69224,0,0,.61111],8873:[0,.69224,0,0,.72222],8874:[0,.69224,0,0,.88889],8876:[0,.68889,0,0,.61111],8877:[0,.68889,0,0,.61111],8878:[0,.68889,0,0,.72222],8879:[0,.68889,0,0,.72222],8882:[.03517,.54986,0,0,.77778],8883:[.03517,.54986,0,0,.77778],8884:[.13667,.63667,0,0,.77778],8885:[.13667,.63667,0,0,.77778],8888:[0,.54986,0,0,1.11111],8890:[.19444,.43056,0,0,.55556],8891:[.19444,.69224,0,0,.61111],8892:[.19444,.69224,0,0,.61111],8901:[0,.54986,0,0,.27778],8903:[.08167,.58167,0,0,.77778],8905:[.08167,.58167,0,0,.77778],8906:[.08167,.58167,0,0,.77778],8907:[0,.69224,0,0,.77778],8908:[0,.69224,0,0,.77778],8909:[-.03598,.46402,0,0,.77778],8910:[0,.54986,0,0,.76042],8911:[0,.54986,0,0,.76042],8912:[.03517,.54986,0,0,.77778],8913:[.03517,.54986,0,0,.77778],8914:[0,.54986,0,0,.66667],8915:[0,.54986,0,0,.66667],8916:[0,.69224,0,0,.66667],8918:[.0391,.5391,0,0,.77778],8919:[.0391,.5391,0,0,.77778],8920:[.03517,.54986,0,0,1.33334],8921:[.03517,.54986,0,0,1.33334],8922:[.38569,.88569,0,0,.77778],8923:[.38569,.88569,0,0,.77778],8926:[.13667,.63667,0,0,.77778],8927:[.13667,.63667,0,0,.77778],8928:[.30274,.79383,0,0,.77778],8929:[.30274,.79383,0,0,.77778],8934:[.23222,.74111,0,0,.77778],8935:[.23222,.74111,0,0,.77778],8936:[.23222,.74111,0,0,.77778],8937:[.23222,.74111,0,0,.77778],8938:[.20576,.70576,0,0,.77778],8939:[.20576,.70576,0,0,.77778],8940:[.30274,.79383,0,0,.77778],8941:[.30274,.79383,0,0,.77778],8994:[.19444,.69224,0,0,.77778],8995:[.19444,.69224,0,0,.77778],9416:[.15559,.69224,0,0,.90222],9484:[0,.69224,0,0,.5],9488:[0,.69224,0,0,.5],9492:[0,.37788,0,0,.5],9496:[0,.37788,0,0,.5],9585:[.19444,.68889,0,0,.88889],9586:[.19444,.74111,0,0,.88889],9632:[0,.675,0,0,.77778],9633:[0,.675,0,0,.77778],9650:[0,.54986,0,0,.72222],9651:[0,.54986,0,0,.72222],9654:[.03517,.54986,0,0,.77778],9660:[0,.54986,0,0,.72222],9661:[0,.54986,0,0,.72222],9664:[.03517,.54986,0,0,.77778],9674:[.11111,.69224,0,0,.66667],9733:[.19444,.69224,0,0,.94445],10003:[0,.69224,0,0,.83334],10016:[0,.69224,0,0,.83334],10731:[.11111,.69224,0,0,.66667],10846:[.19444,.75583,0,0,.61111],10877:[.13667,.63667,0,0,.77778],10878:[.13667,.63667,0,0,.77778],10885:[.25583,.75583,0,0,.77778],10886:[.25583,.75583,0,0,.77778],10887:[.13597,.63597,0,0,.77778],10888:[.13597,.63597,0,0,.77778],10889:[.26167,.75726,0,0,.77778],10890:[.26167,.75726,0,0,.77778],10891:[.48256,.98256,0,0,.77778],10892:[.48256,.98256,0,0,.77778],10901:[.13667,.63667,0,0,.77778],10902:[.13667,.63667,0,0,.77778],10933:[.25142,.75726,0,0,.77778],10934:[.25142,.75726,0,0,.77778],10935:[.26167,.75726,0,0,.77778],10936:[.26167,.75726,0,0,.77778],10937:[.26167,.75726,0,0,.77778],10938:[.26167,.75726,0,0,.77778],10949:[.25583,.75583,0,0,.77778],10950:[.25583,.75583,0,0,.77778],10955:[.28481,.79383,0,0,.77778],10956:[.28481,.79383,0,0,.77778],57350:[.08167,.58167,0,0,.22222],57351:[.08167,.58167,0,0,.38889],57352:[.08167,.58167,0,0,.77778],57353:[0,.43056,.04028,0,.66667],57356:[.25142,.75726,0,0,.77778],57357:[.25142,.75726,0,0,.77778],57358:[.41951,.91951,0,0,.77778],57359:[.30274,.79383,0,0,.77778],57360:[.30274,.79383,0,0,.77778],57361:[.41951,.91951,0,0,.77778],57366:[.25142,.75726,0,0,.77778],57367:[.25142,.75726,0,0,.77778],57368:[.25142,.75726,0,0,.77778],57369:[.25142,.75726,0,0,.77778],57370:[.13597,.63597,0,0,.77778],57371:[.13597,.63597,0,0,.77778]},"Caligraphic-Regular":{32:[0,0,0,0,.25],65:[0,.68333,0,.19445,.79847],66:[0,.68333,.03041,.13889,.65681],67:[0,.68333,.05834,.13889,.52653],68:[0,.68333,.02778,.08334,.77139],69:[0,.68333,.08944,.11111,.52778],70:[0,.68333,.09931,.11111,.71875],71:[.09722,.68333,.0593,.11111,.59487],72:[0,.68333,.00965,.11111,.84452],73:[0,.68333,.07382,0,.54452],74:[.09722,.68333,.18472,.16667,.67778],75:[0,.68333,.01445,.05556,.76195],76:[0,.68333,0,.13889,.68972],77:[0,.68333,0,.13889,1.2009],78:[0,.68333,.14736,.08334,.82049],79:[0,.68333,.02778,.11111,.79611],80:[0,.68333,.08222,.08334,.69556],81:[.09722,.68333,0,.11111,.81667],82:[0,.68333,0,.08334,.8475],83:[0,.68333,.075,.13889,.60556],84:[0,.68333,.25417,0,.54464],85:[0,.68333,.09931,.08334,.62583],86:[0,.68333,.08222,0,.61278],87:[0,.68333,.08222,.08334,.98778],88:[0,.68333,.14643,.13889,.7133],89:[.09722,.68333,.08222,.08334,.66834],90:[0,.68333,.07944,.13889,.72473],160:[0,0,0,0,.25]},"Fraktur-Regular":{32:[0,0,0,0,.25],33:[0,.69141,0,0,.29574],34:[0,.69141,0,0,.21471],38:[0,.69141,0,0,.73786],39:[0,.69141,0,0,.21201],40:[.24982,.74947,0,0,.38865],41:[.24982,.74947,0,0,.38865],42:[0,.62119,0,0,.27764],43:[.08319,.58283,0,0,.75623],44:[0,.10803,0,0,.27764],45:[.08319,.58283,0,0,.75623],46:[0,.10803,0,0,.27764],47:[.24982,.74947,0,0,.50181],48:[0,.47534,0,0,.50181],49:[0,.47534,0,0,.50181],50:[0,.47534,0,0,.50181],51:[.18906,.47534,0,0,.50181],52:[.18906,.47534,0,0,.50181],53:[.18906,.47534,0,0,.50181],54:[0,.69141,0,0,.50181],55:[.18906,.47534,0,0,.50181],56:[0,.69141,0,0,.50181],57:[.18906,.47534,0,0,.50181],58:[0,.47534,0,0,.21606],59:[.12604,.47534,0,0,.21606],61:[-.13099,.36866,0,0,.75623],63:[0,.69141,0,0,.36245],65:[0,.69141,0,0,.7176],66:[0,.69141,0,0,.88397],67:[0,.69141,0,0,.61254],68:[0,.69141,0,0,.83158],69:[0,.69141,0,0,.66278],70:[.12604,.69141,0,0,.61119],71:[0,.69141,0,0,.78539],72:[.06302,.69141,0,0,.7203],73:[0,.69141,0,0,.55448],74:[.12604,.69141,0,0,.55231],75:[0,.69141,0,0,.66845],76:[0,.69141,0,0,.66602],77:[0,.69141,0,0,1.04953],78:[0,.69141,0,0,.83212],79:[0,.69141,0,0,.82699],80:[.18906,.69141,0,0,.82753],81:[.03781,.69141,0,0,.82699],82:[0,.69141,0,0,.82807],83:[0,.69141,0,0,.82861],84:[0,.69141,0,0,.66899],85:[0,.69141,0,0,.64576],86:[0,.69141,0,0,.83131],87:[0,.69141,0,0,1.04602],88:[0,.69141,0,0,.71922],89:[.18906,.69141,0,0,.83293],90:[.12604,.69141,0,0,.60201],91:[.24982,.74947,0,0,.27764],93:[.24982,.74947,0,0,.27764],94:[0,.69141,0,0,.49965],97:[0,.47534,0,0,.50046],98:[0,.69141,0,0,.51315],99:[0,.47534,0,0,.38946],100:[0,.62119,0,0,.49857],101:[0,.47534,0,0,.40053],102:[.18906,.69141,0,0,.32626],103:[.18906,.47534,0,0,.5037],104:[.18906,.69141,0,0,.52126],105:[0,.69141,0,0,.27899],106:[0,.69141,0,0,.28088],107:[0,.69141,0,0,.38946],108:[0,.69141,0,0,.27953],109:[0,.47534,0,0,.76676],110:[0,.47534,0,0,.52666],111:[0,.47534,0,0,.48885],112:[.18906,.52396,0,0,.50046],113:[.18906,.47534,0,0,.48912],114:[0,.47534,0,0,.38919],115:[0,.47534,0,0,.44266],116:[0,.62119,0,0,.33301],117:[0,.47534,0,0,.5172],118:[0,.52396,0,0,.5118],119:[0,.52396,0,0,.77351],120:[.18906,.47534,0,0,.38865],121:[.18906,.47534,0,0,.49884],122:[.18906,.47534,0,0,.39054],160:[0,0,0,0,.25],8216:[0,.69141,0,0,.21471],8217:[0,.69141,0,0,.21471],58112:[0,.62119,0,0,.49749],58113:[0,.62119,0,0,.4983],58114:[.18906,.69141,0,0,.33328],58115:[.18906,.69141,0,0,.32923],58116:[.18906,.47534,0,0,.50343],58117:[0,.69141,0,0,.33301],58118:[0,.62119,0,0,.33409],58119:[0,.47534,0,0,.50073]},"Main-Bold":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.35],34:[0,.69444,0,0,.60278],35:[.19444,.69444,0,0,.95833],36:[.05556,.75,0,0,.575],37:[.05556,.75,0,0,.95833],38:[0,.69444,0,0,.89444],39:[0,.69444,0,0,.31944],40:[.25,.75,0,0,.44722],41:[.25,.75,0,0,.44722],42:[0,.75,0,0,.575],43:[.13333,.63333,0,0,.89444],44:[.19444,.15556,0,0,.31944],45:[0,.44444,0,0,.38333],46:[0,.15556,0,0,.31944],47:[.25,.75,0,0,.575],48:[0,.64444,0,0,.575],49:[0,.64444,0,0,.575],50:[0,.64444,0,0,.575],51:[0,.64444,0,0,.575],52:[0,.64444,0,0,.575],53:[0,.64444,0,0,.575],54:[0,.64444,0,0,.575],55:[0,.64444,0,0,.575],56:[0,.64444,0,0,.575],57:[0,.64444,0,0,.575],58:[0,.44444,0,0,.31944],59:[.19444,.44444,0,0,.31944],60:[.08556,.58556,0,0,.89444],61:[-.10889,.39111,0,0,.89444],62:[.08556,.58556,0,0,.89444],63:[0,.69444,0,0,.54305],64:[0,.69444,0,0,.89444],65:[0,.68611,0,0,.86944],66:[0,.68611,0,0,.81805],67:[0,.68611,0,0,.83055],68:[0,.68611,0,0,.88194],69:[0,.68611,0,0,.75555],70:[0,.68611,0,0,.72361],71:[0,.68611,0,0,.90416],72:[0,.68611,0,0,.9],73:[0,.68611,0,0,.43611],74:[0,.68611,0,0,.59444],75:[0,.68611,0,0,.90138],76:[0,.68611,0,0,.69166],77:[0,.68611,0,0,1.09166],78:[0,.68611,0,0,.9],79:[0,.68611,0,0,.86388],80:[0,.68611,0,0,.78611],81:[.19444,.68611,0,0,.86388],82:[0,.68611,0,0,.8625],83:[0,.68611,0,0,.63889],84:[0,.68611,0,0,.8],85:[0,.68611,0,0,.88472],86:[0,.68611,.01597,0,.86944],87:[0,.68611,.01597,0,1.18888],88:[0,.68611,0,0,.86944],89:[0,.68611,.02875,0,.86944],90:[0,.68611,0,0,.70277],91:[.25,.75,0,0,.31944],92:[.25,.75,0,0,.575],93:[.25,.75,0,0,.31944],94:[0,.69444,0,0,.575],95:[.31,.13444,.03194,0,.575],97:[0,.44444,0,0,.55902],98:[0,.69444,0,0,.63889],99:[0,.44444,0,0,.51111],100:[0,.69444,0,0,.63889],101:[0,.44444,0,0,.52708],102:[0,.69444,.10903,0,.35139],103:[.19444,.44444,.01597,0,.575],104:[0,.69444,0,0,.63889],105:[0,.69444,0,0,.31944],106:[.19444,.69444,0,0,.35139],107:[0,.69444,0,0,.60694],108:[0,.69444,0,0,.31944],109:[0,.44444,0,0,.95833],110:[0,.44444,0,0,.63889],111:[0,.44444,0,0,.575],112:[.19444,.44444,0,0,.63889],113:[.19444,.44444,0,0,.60694],114:[0,.44444,0,0,.47361],115:[0,.44444,0,0,.45361],116:[0,.63492,0,0,.44722],117:[0,.44444,0,0,.63889],118:[0,.44444,.01597,0,.60694],119:[0,.44444,.01597,0,.83055],120:[0,.44444,0,0,.60694],121:[.19444,.44444,.01597,0,.60694],122:[0,.44444,0,0,.51111],123:[.25,.75,0,0,.575],124:[.25,.75,0,0,.31944],125:[.25,.75,0,0,.575],126:[.35,.34444,0,0,.575],160:[0,0,0,0,.25],163:[0,.69444,0,0,.86853],168:[0,.69444,0,0,.575],172:[0,.44444,0,0,.76666],176:[0,.69444,0,0,.86944],177:[.13333,.63333,0,0,.89444],184:[.17014,0,0,0,.51111],198:[0,.68611,0,0,1.04166],215:[.13333,.63333,0,0,.89444],216:[.04861,.73472,0,0,.89444],223:[0,.69444,0,0,.59722],230:[0,.44444,0,0,.83055],247:[.13333,.63333,0,0,.89444],248:[.09722,.54167,0,0,.575],305:[0,.44444,0,0,.31944],338:[0,.68611,0,0,1.16944],339:[0,.44444,0,0,.89444],567:[.19444,.44444,0,0,.35139],710:[0,.69444,0,0,.575],711:[0,.63194,0,0,.575],713:[0,.59611,0,0,.575],714:[0,.69444,0,0,.575],715:[0,.69444,0,0,.575],728:[0,.69444,0,0,.575],729:[0,.69444,0,0,.31944],730:[0,.69444,0,0,.86944],732:[0,.69444,0,0,.575],733:[0,.69444,0,0,.575],915:[0,.68611,0,0,.69166],916:[0,.68611,0,0,.95833],920:[0,.68611,0,0,.89444],923:[0,.68611,0,0,.80555],926:[0,.68611,0,0,.76666],928:[0,.68611,0,0,.9],931:[0,.68611,0,0,.83055],933:[0,.68611,0,0,.89444],934:[0,.68611,0,0,.83055],936:[0,.68611,0,0,.89444],937:[0,.68611,0,0,.83055],8211:[0,.44444,.03194,0,.575],8212:[0,.44444,.03194,0,1.14999],8216:[0,.69444,0,0,.31944],8217:[0,.69444,0,0,.31944],8220:[0,.69444,0,0,.60278],8221:[0,.69444,0,0,.60278],8224:[.19444,.69444,0,0,.51111],8225:[.19444,.69444,0,0,.51111],8242:[0,.55556,0,0,.34444],8407:[0,.72444,.15486,0,.575],8463:[0,.69444,0,0,.66759],8465:[0,.69444,0,0,.83055],8467:[0,.69444,0,0,.47361],8472:[.19444,.44444,0,0,.74027],8476:[0,.69444,0,0,.83055],8501:[0,.69444,0,0,.70277],8592:[-.10889,.39111,0,0,1.14999],8593:[.19444,.69444,0,0,.575],8594:[-.10889,.39111,0,0,1.14999],8595:[.19444,.69444,0,0,.575],8596:[-.10889,.39111,0,0,1.14999],8597:[.25,.75,0,0,.575],8598:[.19444,.69444,0,0,1.14999],8599:[.19444,.69444,0,0,1.14999],8600:[.19444,.69444,0,0,1.14999],8601:[.19444,.69444,0,0,1.14999],8636:[-.10889,.39111,0,0,1.14999],8637:[-.10889,.39111,0,0,1.14999],8640:[-.10889,.39111,0,0,1.14999],8641:[-.10889,.39111,0,0,1.14999],8656:[-.10889,.39111,0,0,1.14999],8657:[.19444,.69444,0,0,.70277],8658:[-.10889,.39111,0,0,1.14999],8659:[.19444,.69444,0,0,.70277],8660:[-.10889,.39111,0,0,1.14999],8661:[.25,.75,0,0,.70277],8704:[0,.69444,0,0,.63889],8706:[0,.69444,.06389,0,.62847],8707:[0,.69444,0,0,.63889],8709:[.05556,.75,0,0,.575],8711:[0,.68611,0,0,.95833],8712:[.08556,.58556,0,0,.76666],8715:[.08556,.58556,0,0,.76666],8722:[.13333,.63333,0,0,.89444],8723:[.13333,.63333,0,0,.89444],8725:[.25,.75,0,0,.575],8726:[.25,.75,0,0,.575],8727:[-.02778,.47222,0,0,.575],8728:[-.02639,.47361,0,0,.575],8729:[-.02639,.47361,0,0,.575],8730:[.18,.82,0,0,.95833],8733:[0,.44444,0,0,.89444],8734:[0,.44444,0,0,1.14999],8736:[0,.69224,0,0,.72222],8739:[.25,.75,0,0,.31944],8741:[.25,.75,0,0,.575],8743:[0,.55556,0,0,.76666],8744:[0,.55556,0,0,.76666],8745:[0,.55556,0,0,.76666],8746:[0,.55556,0,0,.76666],8747:[.19444,.69444,.12778,0,.56875],8764:[-.10889,.39111,0,0,.89444],8768:[.19444,.69444,0,0,.31944],8771:[.00222,.50222,0,0,.89444],8773:[.027,.638,0,0,.894],8776:[.02444,.52444,0,0,.89444],8781:[.00222,.50222,0,0,.89444],8801:[.00222,.50222,0,0,.89444],8804:[.19667,.69667,0,0,.89444],8805:[.19667,.69667,0,0,.89444],8810:[.08556,.58556,0,0,1.14999],8811:[.08556,.58556,0,0,1.14999],8826:[.08556,.58556,0,0,.89444],8827:[.08556,.58556,0,0,.89444],8834:[.08556,.58556,0,0,.89444],8835:[.08556,.58556,0,0,.89444],8838:[.19667,.69667,0,0,.89444],8839:[.19667,.69667,0,0,.89444],8846:[0,.55556,0,0,.76666],8849:[.19667,.69667,0,0,.89444],8850:[.19667,.69667,0,0,.89444],8851:[0,.55556,0,0,.76666],8852:[0,.55556,0,0,.76666],8853:[.13333,.63333,0,0,.89444],8854:[.13333,.63333,0,0,.89444],8855:[.13333,.63333,0,0,.89444],8856:[.13333,.63333,0,0,.89444],8857:[.13333,.63333,0,0,.89444],8866:[0,.69444,0,0,.70277],8867:[0,.69444,0,0,.70277],8868:[0,.69444,0,0,.89444],8869:[0,.69444,0,0,.89444],8900:[-.02639,.47361,0,0,.575],8901:[-.02639,.47361,0,0,.31944],8902:[-.02778,.47222,0,0,.575],8968:[.25,.75,0,0,.51111],8969:[.25,.75,0,0,.51111],8970:[.25,.75,0,0,.51111],8971:[.25,.75,0,0,.51111],8994:[-.13889,.36111,0,0,1.14999],8995:[-.13889,.36111,0,0,1.14999],9651:[.19444,.69444,0,0,1.02222],9657:[-.02778,.47222,0,0,.575],9661:[.19444,.69444,0,0,1.02222],9667:[-.02778,.47222,0,0,.575],9711:[.19444,.69444,0,0,1.14999],9824:[.12963,.69444,0,0,.89444],9825:[.12963,.69444,0,0,.89444],9826:[.12963,.69444,0,0,.89444],9827:[.12963,.69444,0,0,.89444],9837:[0,.75,0,0,.44722],9838:[.19444,.69444,0,0,.44722],9839:[.19444,.69444,0,0,.44722],10216:[.25,.75,0,0,.44722],10217:[.25,.75,0,0,.44722],10815:[0,.68611,0,0,.9],10927:[.19667,.69667,0,0,.89444],10928:[.19667,.69667,0,0,.89444],57376:[.19444,.69444,0,0,0]},"Main-BoldItalic":{32:[0,0,0,0,.25],33:[0,.69444,.11417,0,.38611],34:[0,.69444,.07939,0,.62055],35:[.19444,.69444,.06833,0,.94444],37:[.05556,.75,.12861,0,.94444],38:[0,.69444,.08528,0,.88555],39:[0,.69444,.12945,0,.35555],40:[.25,.75,.15806,0,.47333],41:[.25,.75,.03306,0,.47333],42:[0,.75,.14333,0,.59111],43:[.10333,.60333,.03306,0,.88555],44:[.19444,.14722,0,0,.35555],45:[0,.44444,.02611,0,.41444],46:[0,.14722,0,0,.35555],47:[.25,.75,.15806,0,.59111],48:[0,.64444,.13167,0,.59111],49:[0,.64444,.13167,0,.59111],50:[0,.64444,.13167,0,.59111],51:[0,.64444,.13167,0,.59111],52:[.19444,.64444,.13167,0,.59111],53:[0,.64444,.13167,0,.59111],54:[0,.64444,.13167,0,.59111],55:[.19444,.64444,.13167,0,.59111],56:[0,.64444,.13167,0,.59111],57:[0,.64444,.13167,0,.59111],58:[0,.44444,.06695,0,.35555],59:[.19444,.44444,.06695,0,.35555],61:[-.10889,.39111,.06833,0,.88555],63:[0,.69444,.11472,0,.59111],64:[0,.69444,.09208,0,.88555],65:[0,.68611,0,0,.86555],66:[0,.68611,.0992,0,.81666],67:[0,.68611,.14208,0,.82666],68:[0,.68611,.09062,0,.87555],69:[0,.68611,.11431,0,.75666],70:[0,.68611,.12903,0,.72722],71:[0,.68611,.07347,0,.89527],72:[0,.68611,.17208,0,.8961],73:[0,.68611,.15681,0,.47166],74:[0,.68611,.145,0,.61055],75:[0,.68611,.14208,0,.89499],76:[0,.68611,0,0,.69777],77:[0,.68611,.17208,0,1.07277],78:[0,.68611,.17208,0,.8961],79:[0,.68611,.09062,0,.85499],80:[0,.68611,.0992,0,.78721],81:[.19444,.68611,.09062,0,.85499],82:[0,.68611,.02559,0,.85944],83:[0,.68611,.11264,0,.64999],84:[0,.68611,.12903,0,.7961],85:[0,.68611,.17208,0,.88083],86:[0,.68611,.18625,0,.86555],87:[0,.68611,.18625,0,1.15999],88:[0,.68611,.15681,0,.86555],89:[0,.68611,.19803,0,.86555],90:[0,.68611,.14208,0,.70888],91:[.25,.75,.1875,0,.35611],93:[.25,.75,.09972,0,.35611],94:[0,.69444,.06709,0,.59111],95:[.31,.13444,.09811,0,.59111],97:[0,.44444,.09426,0,.59111],98:[0,.69444,.07861,0,.53222],99:[0,.44444,.05222,0,.53222],100:[0,.69444,.10861,0,.59111],101:[0,.44444,.085,0,.53222],102:[.19444,.69444,.21778,0,.4],103:[.19444,.44444,.105,0,.53222],104:[0,.69444,.09426,0,.59111],105:[0,.69326,.11387,0,.35555],106:[.19444,.69326,.1672,0,.35555],107:[0,.69444,.11111,0,.53222],108:[0,.69444,.10861,0,.29666],109:[0,.44444,.09426,0,.94444],110:[0,.44444,.09426,0,.64999],111:[0,.44444,.07861,0,.59111],112:[.19444,.44444,.07861,0,.59111],113:[.19444,.44444,.105,0,.53222],114:[0,.44444,.11111,0,.50167],115:[0,.44444,.08167,0,.48694],116:[0,.63492,.09639,0,.385],117:[0,.44444,.09426,0,.62055],118:[0,.44444,.11111,0,.53222],119:[0,.44444,.11111,0,.76777],120:[0,.44444,.12583,0,.56055],121:[.19444,.44444,.105,0,.56166],122:[0,.44444,.13889,0,.49055],126:[.35,.34444,.11472,0,.59111],160:[0,0,0,0,.25],168:[0,.69444,.11473,0,.59111],176:[0,.69444,0,0,.94888],184:[.17014,0,0,0,.53222],198:[0,.68611,.11431,0,1.02277],216:[.04861,.73472,.09062,0,.88555],223:[.19444,.69444,.09736,0,.665],230:[0,.44444,.085,0,.82666],248:[.09722,.54167,.09458,0,.59111],305:[0,.44444,.09426,0,.35555],338:[0,.68611,.11431,0,1.14054],339:[0,.44444,.085,0,.82666],567:[.19444,.44444,.04611,0,.385],710:[0,.69444,.06709,0,.59111],711:[0,.63194,.08271,0,.59111],713:[0,.59444,.10444,0,.59111],714:[0,.69444,.08528,0,.59111],715:[0,.69444,0,0,.59111],728:[0,.69444,.10333,0,.59111],729:[0,.69444,.12945,0,.35555],730:[0,.69444,0,0,.94888],732:[0,.69444,.11472,0,.59111],733:[0,.69444,.11472,0,.59111],915:[0,.68611,.12903,0,.69777],916:[0,.68611,0,0,.94444],920:[0,.68611,.09062,0,.88555],923:[0,.68611,0,0,.80666],926:[0,.68611,.15092,0,.76777],928:[0,.68611,.17208,0,.8961],931:[0,.68611,.11431,0,.82666],933:[0,.68611,.10778,0,.88555],934:[0,.68611,.05632,0,.82666],936:[0,.68611,.10778,0,.88555],937:[0,.68611,.0992,0,.82666],8211:[0,.44444,.09811,0,.59111],8212:[0,.44444,.09811,0,1.18221],8216:[0,.69444,.12945,0,.35555],8217:[0,.69444,.12945,0,.35555],8220:[0,.69444,.16772,0,.62055],8221:[0,.69444,.07939,0,.62055]},"Main-Italic":{32:[0,0,0,0,.25],33:[0,.69444,.12417,0,.30667],34:[0,.69444,.06961,0,.51444],35:[.19444,.69444,.06616,0,.81777],37:[.05556,.75,.13639,0,.81777],38:[0,.69444,.09694,0,.76666],39:[0,.69444,.12417,0,.30667],40:[.25,.75,.16194,0,.40889],41:[.25,.75,.03694,0,.40889],42:[0,.75,.14917,0,.51111],43:[.05667,.56167,.03694,0,.76666],44:[.19444,.10556,0,0,.30667],45:[0,.43056,.02826,0,.35778],46:[0,.10556,0,0,.30667],47:[.25,.75,.16194,0,.51111],48:[0,.64444,.13556,0,.51111],49:[0,.64444,.13556,0,.51111],50:[0,.64444,.13556,0,.51111],51:[0,.64444,.13556,0,.51111],52:[.19444,.64444,.13556,0,.51111],53:[0,.64444,.13556,0,.51111],54:[0,.64444,.13556,0,.51111],55:[.19444,.64444,.13556,0,.51111],56:[0,.64444,.13556,0,.51111],57:[0,.64444,.13556,0,.51111],58:[0,.43056,.0582,0,.30667],59:[.19444,.43056,.0582,0,.30667],61:[-.13313,.36687,.06616,0,.76666],63:[0,.69444,.1225,0,.51111],64:[0,.69444,.09597,0,.76666],65:[0,.68333,0,0,.74333],66:[0,.68333,.10257,0,.70389],67:[0,.68333,.14528,0,.71555],68:[0,.68333,.09403,0,.755],69:[0,.68333,.12028,0,.67833],70:[0,.68333,.13305,0,.65277],71:[0,.68333,.08722,0,.77361],72:[0,.68333,.16389,0,.74333],73:[0,.68333,.15806,0,.38555],74:[0,.68333,.14028,0,.525],75:[0,.68333,.14528,0,.76888],76:[0,.68333,0,0,.62722],77:[0,.68333,.16389,0,.89666],78:[0,.68333,.16389,0,.74333],79:[0,.68333,.09403,0,.76666],80:[0,.68333,.10257,0,.67833],81:[.19444,.68333,.09403,0,.76666],82:[0,.68333,.03868,0,.72944],83:[0,.68333,.11972,0,.56222],84:[0,.68333,.13305,0,.71555],85:[0,.68333,.16389,0,.74333],86:[0,.68333,.18361,0,.74333],87:[0,.68333,.18361,0,.99888],88:[0,.68333,.15806,0,.74333],89:[0,.68333,.19383,0,.74333],90:[0,.68333,.14528,0,.61333],91:[.25,.75,.1875,0,.30667],93:[.25,.75,.10528,0,.30667],94:[0,.69444,.06646,0,.51111],95:[.31,.12056,.09208,0,.51111],97:[0,.43056,.07671,0,.51111],98:[0,.69444,.06312,0,.46],99:[0,.43056,.05653,0,.46],100:[0,.69444,.10333,0,.51111],101:[0,.43056,.07514,0,.46],102:[.19444,.69444,.21194,0,.30667],103:[.19444,.43056,.08847,0,.46],104:[0,.69444,.07671,0,.51111],105:[0,.65536,.1019,0,.30667],106:[.19444,.65536,.14467,0,.30667],107:[0,.69444,.10764,0,.46],108:[0,.69444,.10333,0,.25555],109:[0,.43056,.07671,0,.81777],110:[0,.43056,.07671,0,.56222],111:[0,.43056,.06312,0,.51111],112:[.19444,.43056,.06312,0,.51111],113:[.19444,.43056,.08847,0,.46],114:[0,.43056,.10764,0,.42166],115:[0,.43056,.08208,0,.40889],116:[0,.61508,.09486,0,.33222],117:[0,.43056,.07671,0,.53666],118:[0,.43056,.10764,0,.46],119:[0,.43056,.10764,0,.66444],120:[0,.43056,.12042,0,.46389],121:[.19444,.43056,.08847,0,.48555],122:[0,.43056,.12292,0,.40889],126:[.35,.31786,.11585,0,.51111],160:[0,0,0,0,.25],168:[0,.66786,.10474,0,.51111],176:[0,.69444,0,0,.83129],184:[.17014,0,0,0,.46],198:[0,.68333,.12028,0,.88277],216:[.04861,.73194,.09403,0,.76666],223:[.19444,.69444,.10514,0,.53666],230:[0,.43056,.07514,0,.71555],248:[.09722,.52778,.09194,0,.51111],338:[0,.68333,.12028,0,.98499],339:[0,.43056,.07514,0,.71555],710:[0,.69444,.06646,0,.51111],711:[0,.62847,.08295,0,.51111],713:[0,.56167,.10333,0,.51111],714:[0,.69444,.09694,0,.51111],715:[0,.69444,0,0,.51111],728:[0,.69444,.10806,0,.51111],729:[0,.66786,.11752,0,.30667],730:[0,.69444,0,0,.83129],732:[0,.66786,.11585,0,.51111],733:[0,.69444,.1225,0,.51111],915:[0,.68333,.13305,0,.62722],916:[0,.68333,0,0,.81777],920:[0,.68333,.09403,0,.76666],923:[0,.68333,0,0,.69222],926:[0,.68333,.15294,0,.66444],928:[0,.68333,.16389,0,.74333],931:[0,.68333,.12028,0,.71555],933:[0,.68333,.11111,0,.76666],934:[0,.68333,.05986,0,.71555],936:[0,.68333,.11111,0,.76666],937:[0,.68333,.10257,0,.71555],8211:[0,.43056,.09208,0,.51111],8212:[0,.43056,.09208,0,1.02222],8216:[0,.69444,.12417,0,.30667],8217:[0,.69444,.12417,0,.30667],8220:[0,.69444,.1685,0,.51444],8221:[0,.69444,.06961,0,.51444],8463:[0,.68889,0,0,.54028]},"Main-Regular":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.27778],34:[0,.69444,0,0,.5],35:[.19444,.69444,0,0,.83334],36:[.05556,.75,0,0,.5],37:[.05556,.75,0,0,.83334],38:[0,.69444,0,0,.77778],39:[0,.69444,0,0,.27778],40:[.25,.75,0,0,.38889],41:[.25,.75,0,0,.38889],42:[0,.75,0,0,.5],43:[.08333,.58333,0,0,.77778],44:[.19444,.10556,0,0,.27778],45:[0,.43056,0,0,.33333],46:[0,.10556,0,0,.27778],47:[.25,.75,0,0,.5],48:[0,.64444,0,0,.5],49:[0,.64444,0,0,.5],50:[0,.64444,0,0,.5],51:[0,.64444,0,0,.5],52:[0,.64444,0,0,.5],53:[0,.64444,0,0,.5],54:[0,.64444,0,0,.5],55:[0,.64444,0,0,.5],56:[0,.64444,0,0,.5],57:[0,.64444,0,0,.5],58:[0,.43056,0,0,.27778],59:[.19444,.43056,0,0,.27778],60:[.0391,.5391,0,0,.77778],61:[-.13313,.36687,0,0,.77778],62:[.0391,.5391,0,0,.77778],63:[0,.69444,0,0,.47222],64:[0,.69444,0,0,.77778],65:[0,.68333,0,0,.75],66:[0,.68333,0,0,.70834],67:[0,.68333,0,0,.72222],68:[0,.68333,0,0,.76389],69:[0,.68333,0,0,.68056],70:[0,.68333,0,0,.65278],71:[0,.68333,0,0,.78472],72:[0,.68333,0,0,.75],73:[0,.68333,0,0,.36111],74:[0,.68333,0,0,.51389],75:[0,.68333,0,0,.77778],76:[0,.68333,0,0,.625],77:[0,.68333,0,0,.91667],78:[0,.68333,0,0,.75],79:[0,.68333,0,0,.77778],80:[0,.68333,0,0,.68056],81:[.19444,.68333,0,0,.77778],82:[0,.68333,0,0,.73611],83:[0,.68333,0,0,.55556],84:[0,.68333,0,0,.72222],85:[0,.68333,0,0,.75],86:[0,.68333,.01389,0,.75],87:[0,.68333,.01389,0,1.02778],88:[0,.68333,0,0,.75],89:[0,.68333,.025,0,.75],90:[0,.68333,0,0,.61111],91:[.25,.75,0,0,.27778],92:[.25,.75,0,0,.5],93:[.25,.75,0,0,.27778],94:[0,.69444,0,0,.5],95:[.31,.12056,.02778,0,.5],97:[0,.43056,0,0,.5],98:[0,.69444,0,0,.55556],99:[0,.43056,0,0,.44445],100:[0,.69444,0,0,.55556],101:[0,.43056,0,0,.44445],102:[0,.69444,.07778,0,.30556],103:[.19444,.43056,.01389,0,.5],104:[0,.69444,0,0,.55556],105:[0,.66786,0,0,.27778],106:[.19444,.66786,0,0,.30556],107:[0,.69444,0,0,.52778],108:[0,.69444,0,0,.27778],109:[0,.43056,0,0,.83334],110:[0,.43056,0,0,.55556],111:[0,.43056,0,0,.5],112:[.19444,.43056,0,0,.55556],113:[.19444,.43056,0,0,.52778],114:[0,.43056,0,0,.39167],115:[0,.43056,0,0,.39445],116:[0,.61508,0,0,.38889],117:[0,.43056,0,0,.55556],118:[0,.43056,.01389,0,.52778],119:[0,.43056,.01389,0,.72222],120:[0,.43056,0,0,.52778],121:[.19444,.43056,.01389,0,.52778],122:[0,.43056,0,0,.44445],123:[.25,.75,0,0,.5],124:[.25,.75,0,0,.27778],125:[.25,.75,0,0,.5],126:[.35,.31786,0,0,.5],160:[0,0,0,0,.25],163:[0,.69444,0,0,.76909],167:[.19444,.69444,0,0,.44445],168:[0,.66786,0,0,.5],172:[0,.43056,0,0,.66667],176:[0,.69444,0,0,.75],177:[.08333,.58333,0,0,.77778],182:[.19444,.69444,0,0,.61111],184:[.17014,0,0,0,.44445],198:[0,.68333,0,0,.90278],215:[.08333,.58333,0,0,.77778],216:[.04861,.73194,0,0,.77778],223:[0,.69444,0,0,.5],230:[0,.43056,0,0,.72222],247:[.08333,.58333,0,0,.77778],248:[.09722,.52778,0,0,.5],305:[0,.43056,0,0,.27778],338:[0,.68333,0,0,1.01389],339:[0,.43056,0,0,.77778],567:[.19444,.43056,0,0,.30556],710:[0,.69444,0,0,.5],711:[0,.62847,0,0,.5],713:[0,.56778,0,0,.5],714:[0,.69444,0,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,0,0,.5],729:[0,.66786,0,0,.27778],730:[0,.69444,0,0,.75],732:[0,.66786,0,0,.5],733:[0,.69444,0,0,.5],915:[0,.68333,0,0,.625],916:[0,.68333,0,0,.83334],920:[0,.68333,0,0,.77778],923:[0,.68333,0,0,.69445],926:[0,.68333,0,0,.66667],928:[0,.68333,0,0,.75],931:[0,.68333,0,0,.72222],933:[0,.68333,0,0,.77778],934:[0,.68333,0,0,.72222],936:[0,.68333,0,0,.77778],937:[0,.68333,0,0,.72222],8211:[0,.43056,.02778,0,.5],8212:[0,.43056,.02778,0,1],8216:[0,.69444,0,0,.27778],8217:[0,.69444,0,0,.27778],8220:[0,.69444,0,0,.5],8221:[0,.69444,0,0,.5],8224:[.19444,.69444,0,0,.44445],8225:[.19444,.69444,0,0,.44445],8230:[0,.123,0,0,1.172],8242:[0,.55556,0,0,.275],8407:[0,.71444,.15382,0,.5],8463:[0,.68889,0,0,.54028],8465:[0,.69444,0,0,.72222],8467:[0,.69444,0,.11111,.41667],8472:[.19444,.43056,0,.11111,.63646],8476:[0,.69444,0,0,.72222],8501:[0,.69444,0,0,.61111],8592:[-.13313,.36687,0,0,1],8593:[.19444,.69444,0,0,.5],8594:[-.13313,.36687,0,0,1],8595:[.19444,.69444,0,0,.5],8596:[-.13313,.36687,0,0,1],8597:[.25,.75,0,0,.5],8598:[.19444,.69444,0,0,1],8599:[.19444,.69444,0,0,1],8600:[.19444,.69444,0,0,1],8601:[.19444,.69444,0,0,1],8614:[.011,.511,0,0,1],8617:[.011,.511,0,0,1.126],8618:[.011,.511,0,0,1.126],8636:[-.13313,.36687,0,0,1],8637:[-.13313,.36687,0,0,1],8640:[-.13313,.36687,0,0,1],8641:[-.13313,.36687,0,0,1],8652:[.011,.671,0,0,1],8656:[-.13313,.36687,0,0,1],8657:[.19444,.69444,0,0,.61111],8658:[-.13313,.36687,0,0,1],8659:[.19444,.69444,0,0,.61111],8660:[-.13313,.36687,0,0,1],8661:[.25,.75,0,0,.61111],8704:[0,.69444,0,0,.55556],8706:[0,.69444,.05556,.08334,.5309],8707:[0,.69444,0,0,.55556],8709:[.05556,.75,0,0,.5],8711:[0,.68333,0,0,.83334],8712:[.0391,.5391,0,0,.66667],8715:[.0391,.5391,0,0,.66667],8722:[.08333,.58333,0,0,.77778],8723:[.08333,.58333,0,0,.77778],8725:[.25,.75,0,0,.5],8726:[.25,.75,0,0,.5],8727:[-.03472,.46528,0,0,.5],8728:[-.05555,.44445,0,0,.5],8729:[-.05555,.44445,0,0,.5],8730:[.2,.8,0,0,.83334],8733:[0,.43056,0,0,.77778],8734:[0,.43056,0,0,1],8736:[0,.69224,0,0,.72222],8739:[.25,.75,0,0,.27778],8741:[.25,.75,0,0,.5],8743:[0,.55556,0,0,.66667],8744:[0,.55556,0,0,.66667],8745:[0,.55556,0,0,.66667],8746:[0,.55556,0,0,.66667],8747:[.19444,.69444,.11111,0,.41667],8764:[-.13313,.36687,0,0,.77778],8768:[.19444,.69444,0,0,.27778],8771:[-.03625,.46375,0,0,.77778],8773:[-.022,.589,0,0,.778],8776:[-.01688,.48312,0,0,.77778],8781:[-.03625,.46375,0,0,.77778],8784:[-.133,.673,0,0,.778],8801:[-.03625,.46375,0,0,.77778],8804:[.13597,.63597,0,0,.77778],8805:[.13597,.63597,0,0,.77778],8810:[.0391,.5391,0,0,1],8811:[.0391,.5391,0,0,1],8826:[.0391,.5391,0,0,.77778],8827:[.0391,.5391,0,0,.77778],8834:[.0391,.5391,0,0,.77778],8835:[.0391,.5391,0,0,.77778],8838:[.13597,.63597,0,0,.77778],8839:[.13597,.63597,0,0,.77778],8846:[0,.55556,0,0,.66667],8849:[.13597,.63597,0,0,.77778],8850:[.13597,.63597,0,0,.77778],8851:[0,.55556,0,0,.66667],8852:[0,.55556,0,0,.66667],8853:[.08333,.58333,0,0,.77778],8854:[.08333,.58333,0,0,.77778],8855:[.08333,.58333,0,0,.77778],8856:[.08333,.58333,0,0,.77778],8857:[.08333,.58333,0,0,.77778],8866:[0,.69444,0,0,.61111],8867:[0,.69444,0,0,.61111],8868:[0,.69444,0,0,.77778],8869:[0,.69444,0,0,.77778],8872:[.249,.75,0,0,.867],8900:[-.05555,.44445,0,0,.5],8901:[-.05555,.44445,0,0,.27778],8902:[-.03472,.46528,0,0,.5],8904:[.005,.505,0,0,.9],8942:[.03,.903,0,0,.278],8943:[-.19,.313,0,0,1.172],8945:[-.1,.823,0,0,1.282],8968:[.25,.75,0,0,.44445],8969:[.25,.75,0,0,.44445],8970:[.25,.75,0,0,.44445],8971:[.25,.75,0,0,.44445],8994:[-.14236,.35764,0,0,1],8995:[-.14236,.35764,0,0,1],9136:[.244,.744,0,0,.412],9137:[.244,.745,0,0,.412],9651:[.19444,.69444,0,0,.88889],9657:[-.03472,.46528,0,0,.5],9661:[.19444,.69444,0,0,.88889],9667:[-.03472,.46528,0,0,.5],9711:[.19444,.69444,0,0,1],9824:[.12963,.69444,0,0,.77778],9825:[.12963,.69444,0,0,.77778],9826:[.12963,.69444,0,0,.77778],9827:[.12963,.69444,0,0,.77778],9837:[0,.75,0,0,.38889],9838:[.19444,.69444,0,0,.38889],9839:[.19444,.69444,0,0,.38889],10216:[.25,.75,0,0,.38889],10217:[.25,.75,0,0,.38889],10222:[.244,.744,0,0,.412],10223:[.244,.745,0,0,.412],10229:[.011,.511,0,0,1.609],10230:[.011,.511,0,0,1.638],10231:[.011,.511,0,0,1.859],10232:[.024,.525,0,0,1.609],10233:[.024,.525,0,0,1.638],10234:[.024,.525,0,0,1.858],10236:[.011,.511,0,0,1.638],10815:[0,.68333,0,0,.75],10927:[.13597,.63597,0,0,.77778],10928:[.13597,.63597,0,0,.77778],57376:[.19444,.69444,0,0,0]},"Math-BoldItalic":{32:[0,0,0,0,.25],48:[0,.44444,0,0,.575],49:[0,.44444,0,0,.575],50:[0,.44444,0,0,.575],51:[.19444,.44444,0,0,.575],52:[.19444,.44444,0,0,.575],53:[.19444,.44444,0,0,.575],54:[0,.64444,0,0,.575],55:[.19444,.44444,0,0,.575],56:[0,.64444,0,0,.575],57:[.19444,.44444,0,0,.575],65:[0,.68611,0,0,.86944],66:[0,.68611,.04835,0,.8664],67:[0,.68611,.06979,0,.81694],68:[0,.68611,.03194,0,.93812],69:[0,.68611,.05451,0,.81007],70:[0,.68611,.15972,0,.68889],71:[0,.68611,0,0,.88673],72:[0,.68611,.08229,0,.98229],73:[0,.68611,.07778,0,.51111],74:[0,.68611,.10069,0,.63125],75:[0,.68611,.06979,0,.97118],76:[0,.68611,0,0,.75555],77:[0,.68611,.11424,0,1.14201],78:[0,.68611,.11424,0,.95034],79:[0,.68611,.03194,0,.83666],80:[0,.68611,.15972,0,.72309],81:[.19444,.68611,0,0,.86861],82:[0,.68611,.00421,0,.87235],83:[0,.68611,.05382,0,.69271],84:[0,.68611,.15972,0,.63663],85:[0,.68611,.11424,0,.80027],86:[0,.68611,.25555,0,.67778],87:[0,.68611,.15972,0,1.09305],88:[0,.68611,.07778,0,.94722],89:[0,.68611,.25555,0,.67458],90:[0,.68611,.06979,0,.77257],97:[0,.44444,0,0,.63287],98:[0,.69444,0,0,.52083],99:[0,.44444,0,0,.51342],100:[0,.69444,0,0,.60972],101:[0,.44444,0,0,.55361],102:[.19444,.69444,.11042,0,.56806],103:[.19444,.44444,.03704,0,.5449],104:[0,.69444,0,0,.66759],105:[0,.69326,0,0,.4048],106:[.19444,.69326,.0622,0,.47083],107:[0,.69444,.01852,0,.6037],108:[0,.69444,.0088,0,.34815],109:[0,.44444,0,0,1.0324],110:[0,.44444,0,0,.71296],111:[0,.44444,0,0,.58472],112:[.19444,.44444,0,0,.60092],113:[.19444,.44444,.03704,0,.54213],114:[0,.44444,.03194,0,.5287],115:[0,.44444,0,0,.53125],116:[0,.63492,0,0,.41528],117:[0,.44444,0,0,.68102],118:[0,.44444,.03704,0,.56666],119:[0,.44444,.02778,0,.83148],120:[0,.44444,0,0,.65903],121:[.19444,.44444,.03704,0,.59028],122:[0,.44444,.04213,0,.55509],160:[0,0,0,0,.25],915:[0,.68611,.15972,0,.65694],916:[0,.68611,0,0,.95833],920:[0,.68611,.03194,0,.86722],923:[0,.68611,0,0,.80555],926:[0,.68611,.07458,0,.84125],928:[0,.68611,.08229,0,.98229],931:[0,.68611,.05451,0,.88507],933:[0,.68611,.15972,0,.67083],934:[0,.68611,0,0,.76666],936:[0,.68611,.11653,0,.71402],937:[0,.68611,.04835,0,.8789],945:[0,.44444,0,0,.76064],946:[.19444,.69444,.03403,0,.65972],947:[.19444,.44444,.06389,0,.59003],948:[0,.69444,.03819,0,.52222],949:[0,.44444,0,0,.52882],950:[.19444,.69444,.06215,0,.50833],951:[.19444,.44444,.03704,0,.6],952:[0,.69444,.03194,0,.5618],953:[0,.44444,0,0,.41204],954:[0,.44444,0,0,.66759],955:[0,.69444,0,0,.67083],956:[.19444,.44444,0,0,.70787],957:[0,.44444,.06898,0,.57685],958:[.19444,.69444,.03021,0,.50833],959:[0,.44444,0,0,.58472],960:[0,.44444,.03704,0,.68241],961:[.19444,.44444,0,0,.6118],962:[.09722,.44444,.07917,0,.42361],963:[0,.44444,.03704,0,.68588],964:[0,.44444,.13472,0,.52083],965:[0,.44444,.03704,0,.63055],966:[.19444,.44444,0,0,.74722],967:[.19444,.44444,0,0,.71805],968:[.19444,.69444,.03704,0,.75833],969:[0,.44444,.03704,0,.71782],977:[0,.69444,0,0,.69155],981:[.19444,.69444,0,0,.7125],982:[0,.44444,.03194,0,.975],1009:[.19444,.44444,0,0,.6118],1013:[0,.44444,0,0,.48333],57649:[0,.44444,0,0,.39352],57911:[.19444,.44444,0,0,.43889]},"Math-Italic":{32:[0,0,0,0,.25],48:[0,.43056,0,0,.5],49:[0,.43056,0,0,.5],50:[0,.43056,0,0,.5],51:[.19444,.43056,0,0,.5],52:[.19444,.43056,0,0,.5],53:[.19444,.43056,0,0,.5],54:[0,.64444,0,0,.5],55:[.19444,.43056,0,0,.5],56:[0,.64444,0,0,.5],57:[.19444,.43056,0,0,.5],65:[0,.68333,0,.13889,.75],66:[0,.68333,.05017,.08334,.75851],67:[0,.68333,.07153,.08334,.71472],68:[0,.68333,.02778,.05556,.82792],69:[0,.68333,.05764,.08334,.7382],70:[0,.68333,.13889,.08334,.64306],71:[0,.68333,0,.08334,.78625],72:[0,.68333,.08125,.05556,.83125],73:[0,.68333,.07847,.11111,.43958],74:[0,.68333,.09618,.16667,.55451],75:[0,.68333,.07153,.05556,.84931],76:[0,.68333,0,.02778,.68056],77:[0,.68333,.10903,.08334,.97014],78:[0,.68333,.10903,.08334,.80347],79:[0,.68333,.02778,.08334,.76278],80:[0,.68333,.13889,.08334,.64201],81:[.19444,.68333,0,.08334,.79056],82:[0,.68333,.00773,.08334,.75929],83:[0,.68333,.05764,.08334,.6132],84:[0,.68333,.13889,.08334,.58438],85:[0,.68333,.10903,.02778,.68278],86:[0,.68333,.22222,0,.58333],87:[0,.68333,.13889,0,.94445],88:[0,.68333,.07847,.08334,.82847],89:[0,.68333,.22222,0,.58056],90:[0,.68333,.07153,.08334,.68264],97:[0,.43056,0,0,.52859],98:[0,.69444,0,0,.42917],99:[0,.43056,0,.05556,.43276],100:[0,.69444,0,.16667,.52049],101:[0,.43056,0,.05556,.46563],102:[.19444,.69444,.10764,.16667,.48959],103:[.19444,.43056,.03588,.02778,.47697],104:[0,.69444,0,0,.57616],105:[0,.65952,0,0,.34451],106:[.19444,.65952,.05724,0,.41181],107:[0,.69444,.03148,0,.5206],108:[0,.69444,.01968,.08334,.29838],109:[0,.43056,0,0,.87801],110:[0,.43056,0,0,.60023],111:[0,.43056,0,.05556,.48472],112:[.19444,.43056,0,.08334,.50313],113:[.19444,.43056,.03588,.08334,.44641],114:[0,.43056,.02778,.05556,.45116],115:[0,.43056,0,.05556,.46875],116:[0,.61508,0,.08334,.36111],117:[0,.43056,0,.02778,.57246],118:[0,.43056,.03588,.02778,.48472],119:[0,.43056,.02691,.08334,.71592],120:[0,.43056,0,.02778,.57153],121:[.19444,.43056,.03588,.05556,.49028],122:[0,.43056,.04398,.05556,.46505],160:[0,0,0,0,.25],915:[0,.68333,.13889,.08334,.61528],916:[0,.68333,0,.16667,.83334],920:[0,.68333,.02778,.08334,.76278],923:[0,.68333,0,.16667,.69445],926:[0,.68333,.07569,.08334,.74236],928:[0,.68333,.08125,.05556,.83125],931:[0,.68333,.05764,.08334,.77986],933:[0,.68333,.13889,.05556,.58333],934:[0,.68333,0,.08334,.66667],936:[0,.68333,.11,.05556,.61222],937:[0,.68333,.05017,.08334,.7724],945:[0,.43056,.0037,.02778,.6397],946:[.19444,.69444,.05278,.08334,.56563],947:[.19444,.43056,.05556,0,.51773],948:[0,.69444,.03785,.05556,.44444],949:[0,.43056,0,.08334,.46632],950:[.19444,.69444,.07378,.08334,.4375],951:[.19444,.43056,.03588,.05556,.49653],952:[0,.69444,.02778,.08334,.46944],953:[0,.43056,0,.05556,.35394],954:[0,.43056,0,0,.57616],955:[0,.69444,0,0,.58334],956:[.19444,.43056,0,.02778,.60255],957:[0,.43056,.06366,.02778,.49398],958:[.19444,.69444,.04601,.11111,.4375],959:[0,.43056,0,.05556,.48472],960:[0,.43056,.03588,0,.57003],961:[.19444,.43056,0,.08334,.51702],962:[.09722,.43056,.07986,.08334,.36285],963:[0,.43056,.03588,0,.57141],964:[0,.43056,.1132,.02778,.43715],965:[0,.43056,.03588,.02778,.54028],966:[.19444,.43056,0,.08334,.65417],967:[.19444,.43056,0,.05556,.62569],968:[.19444,.69444,.03588,.11111,.65139],969:[0,.43056,.03588,0,.62245],977:[0,.69444,0,.08334,.59144],981:[.19444,.69444,0,.08334,.59583],982:[0,.43056,.02778,0,.82813],1009:[.19444,.43056,0,.08334,.51702],1013:[0,.43056,0,.05556,.4059],57649:[0,.43056,0,.02778,.32246],57911:[.19444,.43056,0,.08334,.38403]},"SansSerif-Bold":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.36667],34:[0,.69444,0,0,.55834],35:[.19444,.69444,0,0,.91667],36:[.05556,.75,0,0,.55],37:[.05556,.75,0,0,1.02912],38:[0,.69444,0,0,.83056],39:[0,.69444,0,0,.30556],40:[.25,.75,0,0,.42778],41:[.25,.75,0,0,.42778],42:[0,.75,0,0,.55],43:[.11667,.61667,0,0,.85556],44:[.10556,.13056,0,0,.30556],45:[0,.45833,0,0,.36667],46:[0,.13056,0,0,.30556],47:[.25,.75,0,0,.55],48:[0,.69444,0,0,.55],49:[0,.69444,0,0,.55],50:[0,.69444,0,0,.55],51:[0,.69444,0,0,.55],52:[0,.69444,0,0,.55],53:[0,.69444,0,0,.55],54:[0,.69444,0,0,.55],55:[0,.69444,0,0,.55],56:[0,.69444,0,0,.55],57:[0,.69444,0,0,.55],58:[0,.45833,0,0,.30556],59:[.10556,.45833,0,0,.30556],61:[-.09375,.40625,0,0,.85556],63:[0,.69444,0,0,.51945],64:[0,.69444,0,0,.73334],65:[0,.69444,0,0,.73334],66:[0,.69444,0,0,.73334],67:[0,.69444,0,0,.70278],68:[0,.69444,0,0,.79445],69:[0,.69444,0,0,.64167],70:[0,.69444,0,0,.61111],71:[0,.69444,0,0,.73334],72:[0,.69444,0,0,.79445],73:[0,.69444,0,0,.33056],74:[0,.69444,0,0,.51945],75:[0,.69444,0,0,.76389],76:[0,.69444,0,0,.58056],77:[0,.69444,0,0,.97778],78:[0,.69444,0,0,.79445],79:[0,.69444,0,0,.79445],80:[0,.69444,0,0,.70278],81:[.10556,.69444,0,0,.79445],82:[0,.69444,0,0,.70278],83:[0,.69444,0,0,.61111],84:[0,.69444,0,0,.73334],85:[0,.69444,0,0,.76389],86:[0,.69444,.01528,0,.73334],87:[0,.69444,.01528,0,1.03889],88:[0,.69444,0,0,.73334],89:[0,.69444,.0275,0,.73334],90:[0,.69444,0,0,.67223],91:[.25,.75,0,0,.34306],93:[.25,.75,0,0,.34306],94:[0,.69444,0,0,.55],95:[.35,.10833,.03056,0,.55],97:[0,.45833,0,0,.525],98:[0,.69444,0,0,.56111],99:[0,.45833,0,0,.48889],100:[0,.69444,0,0,.56111],101:[0,.45833,0,0,.51111],102:[0,.69444,.07639,0,.33611],103:[.19444,.45833,.01528,0,.55],104:[0,.69444,0,0,.56111],105:[0,.69444,0,0,.25556],106:[.19444,.69444,0,0,.28611],107:[0,.69444,0,0,.53056],108:[0,.69444,0,0,.25556],109:[0,.45833,0,0,.86667],110:[0,.45833,0,0,.56111],111:[0,.45833,0,0,.55],112:[.19444,.45833,0,0,.56111],113:[.19444,.45833,0,0,.56111],114:[0,.45833,.01528,0,.37222],115:[0,.45833,0,0,.42167],116:[0,.58929,0,0,.40417],117:[0,.45833,0,0,.56111],118:[0,.45833,.01528,0,.5],119:[0,.45833,.01528,0,.74445],120:[0,.45833,0,0,.5],121:[.19444,.45833,.01528,0,.5],122:[0,.45833,0,0,.47639],126:[.35,.34444,0,0,.55],160:[0,0,0,0,.25],168:[0,.69444,0,0,.55],176:[0,.69444,0,0,.73334],180:[0,.69444,0,0,.55],184:[.17014,0,0,0,.48889],305:[0,.45833,0,0,.25556],567:[.19444,.45833,0,0,.28611],710:[0,.69444,0,0,.55],711:[0,.63542,0,0,.55],713:[0,.63778,0,0,.55],728:[0,.69444,0,0,.55],729:[0,.69444,0,0,.30556],730:[0,.69444,0,0,.73334],732:[0,.69444,0,0,.55],733:[0,.69444,0,0,.55],915:[0,.69444,0,0,.58056],916:[0,.69444,0,0,.91667],920:[0,.69444,0,0,.85556],923:[0,.69444,0,0,.67223],926:[0,.69444,0,0,.73334],928:[0,.69444,0,0,.79445],931:[0,.69444,0,0,.79445],933:[0,.69444,0,0,.85556],934:[0,.69444,0,0,.79445],936:[0,.69444,0,0,.85556],937:[0,.69444,0,0,.79445],8211:[0,.45833,.03056,0,.55],8212:[0,.45833,.03056,0,1.10001],8216:[0,.69444,0,0,.30556],8217:[0,.69444,0,0,.30556],8220:[0,.69444,0,0,.55834],8221:[0,.69444,0,0,.55834]},"SansSerif-Italic":{32:[0,0,0,0,.25],33:[0,.69444,.05733,0,.31945],34:[0,.69444,.00316,0,.5],35:[.19444,.69444,.05087,0,.83334],36:[.05556,.75,.11156,0,.5],37:[.05556,.75,.03126,0,.83334],38:[0,.69444,.03058,0,.75834],39:[0,.69444,.07816,0,.27778],40:[.25,.75,.13164,0,.38889],41:[.25,.75,.02536,0,.38889],42:[0,.75,.11775,0,.5],43:[.08333,.58333,.02536,0,.77778],44:[.125,.08333,0,0,.27778],45:[0,.44444,.01946,0,.33333],46:[0,.08333,0,0,.27778],47:[.25,.75,.13164,0,.5],48:[0,.65556,.11156,0,.5],49:[0,.65556,.11156,0,.5],50:[0,.65556,.11156,0,.5],51:[0,.65556,.11156,0,.5],52:[0,.65556,.11156,0,.5],53:[0,.65556,.11156,0,.5],54:[0,.65556,.11156,0,.5],55:[0,.65556,.11156,0,.5],56:[0,.65556,.11156,0,.5],57:[0,.65556,.11156,0,.5],58:[0,.44444,.02502,0,.27778],59:[.125,.44444,.02502,0,.27778],61:[-.13,.37,.05087,0,.77778],63:[0,.69444,.11809,0,.47222],64:[0,.69444,.07555,0,.66667],65:[0,.69444,0,0,.66667],66:[0,.69444,.08293,0,.66667],67:[0,.69444,.11983,0,.63889],68:[0,.69444,.07555,0,.72223],69:[0,.69444,.11983,0,.59722],70:[0,.69444,.13372,0,.56945],71:[0,.69444,.11983,0,.66667],72:[0,.69444,.08094,0,.70834],73:[0,.69444,.13372,0,.27778],74:[0,.69444,.08094,0,.47222],75:[0,.69444,.11983,0,.69445],76:[0,.69444,0,0,.54167],77:[0,.69444,.08094,0,.875],78:[0,.69444,.08094,0,.70834],79:[0,.69444,.07555,0,.73611],80:[0,.69444,.08293,0,.63889],81:[.125,.69444,.07555,0,.73611],82:[0,.69444,.08293,0,.64584],83:[0,.69444,.09205,0,.55556],84:[0,.69444,.13372,0,.68056],85:[0,.69444,.08094,0,.6875],86:[0,.69444,.1615,0,.66667],87:[0,.69444,.1615,0,.94445],88:[0,.69444,.13372,0,.66667],89:[0,.69444,.17261,0,.66667],90:[0,.69444,.11983,0,.61111],91:[.25,.75,.15942,0,.28889],93:[.25,.75,.08719,0,.28889],94:[0,.69444,.0799,0,.5],95:[.35,.09444,.08616,0,.5],97:[0,.44444,.00981,0,.48056],98:[0,.69444,.03057,0,.51667],99:[0,.44444,.08336,0,.44445],100:[0,.69444,.09483,0,.51667],101:[0,.44444,.06778,0,.44445],102:[0,.69444,.21705,0,.30556],103:[.19444,.44444,.10836,0,.5],104:[0,.69444,.01778,0,.51667],105:[0,.67937,.09718,0,.23889],106:[.19444,.67937,.09162,0,.26667],107:[0,.69444,.08336,0,.48889],108:[0,.69444,.09483,0,.23889],109:[0,.44444,.01778,0,.79445],110:[0,.44444,.01778,0,.51667],111:[0,.44444,.06613,0,.5],112:[.19444,.44444,.0389,0,.51667],113:[.19444,.44444,.04169,0,.51667],114:[0,.44444,.10836,0,.34167],115:[0,.44444,.0778,0,.38333],116:[0,.57143,.07225,0,.36111],117:[0,.44444,.04169,0,.51667],118:[0,.44444,.10836,0,.46111],119:[0,.44444,.10836,0,.68334],120:[0,.44444,.09169,0,.46111],121:[.19444,.44444,.10836,0,.46111],122:[0,.44444,.08752,0,.43472],126:[.35,.32659,.08826,0,.5],160:[0,0,0,0,.25],168:[0,.67937,.06385,0,.5],176:[0,.69444,0,0,.73752],184:[.17014,0,0,0,.44445],305:[0,.44444,.04169,0,.23889],567:[.19444,.44444,.04169,0,.26667],710:[0,.69444,.0799,0,.5],711:[0,.63194,.08432,0,.5],713:[0,.60889,.08776,0,.5],714:[0,.69444,.09205,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,.09483,0,.5],729:[0,.67937,.07774,0,.27778],730:[0,.69444,0,0,.73752],732:[0,.67659,.08826,0,.5],733:[0,.69444,.09205,0,.5],915:[0,.69444,.13372,0,.54167],916:[0,.69444,0,0,.83334],920:[0,.69444,.07555,0,.77778],923:[0,.69444,0,0,.61111],926:[0,.69444,.12816,0,.66667],928:[0,.69444,.08094,0,.70834],931:[0,.69444,.11983,0,.72222],933:[0,.69444,.09031,0,.77778],934:[0,.69444,.04603,0,.72222],936:[0,.69444,.09031,0,.77778],937:[0,.69444,.08293,0,.72222],8211:[0,.44444,.08616,0,.5],8212:[0,.44444,.08616,0,1],8216:[0,.69444,.07816,0,.27778],8217:[0,.69444,.07816,0,.27778],8220:[0,.69444,.14205,0,.5],8221:[0,.69444,.00316,0,.5]},"SansSerif-Regular":{32:[0,0,0,0,.25],33:[0,.69444,0,0,.31945],34:[0,.69444,0,0,.5],35:[.19444,.69444,0,0,.83334],36:[.05556,.75,0,0,.5],37:[.05556,.75,0,0,.83334],38:[0,.69444,0,0,.75834],39:[0,.69444,0,0,.27778],40:[.25,.75,0,0,.38889],41:[.25,.75,0,0,.38889],42:[0,.75,0,0,.5],43:[.08333,.58333,0,0,.77778],44:[.125,.08333,0,0,.27778],45:[0,.44444,0,0,.33333],46:[0,.08333,0,0,.27778],47:[.25,.75,0,0,.5],48:[0,.65556,0,0,.5],49:[0,.65556,0,0,.5],50:[0,.65556,0,0,.5],51:[0,.65556,0,0,.5],52:[0,.65556,0,0,.5],53:[0,.65556,0,0,.5],54:[0,.65556,0,0,.5],55:[0,.65556,0,0,.5],56:[0,.65556,0,0,.5],57:[0,.65556,0,0,.5],58:[0,.44444,0,0,.27778],59:[.125,.44444,0,0,.27778],61:[-.13,.37,0,0,.77778],63:[0,.69444,0,0,.47222],64:[0,.69444,0,0,.66667],65:[0,.69444,0,0,.66667],66:[0,.69444,0,0,.66667],67:[0,.69444,0,0,.63889],68:[0,.69444,0,0,.72223],69:[0,.69444,0,0,.59722],70:[0,.69444,0,0,.56945],71:[0,.69444,0,0,.66667],72:[0,.69444,0,0,.70834],73:[0,.69444,0,0,.27778],74:[0,.69444,0,0,.47222],75:[0,.69444,0,0,.69445],76:[0,.69444,0,0,.54167],77:[0,.69444,0,0,.875],78:[0,.69444,0,0,.70834],79:[0,.69444,0,0,.73611],80:[0,.69444,0,0,.63889],81:[.125,.69444,0,0,.73611],82:[0,.69444,0,0,.64584],83:[0,.69444,0,0,.55556],84:[0,.69444,0,0,.68056],85:[0,.69444,0,0,.6875],86:[0,.69444,.01389,0,.66667],87:[0,.69444,.01389,0,.94445],88:[0,.69444,0,0,.66667],89:[0,.69444,.025,0,.66667],90:[0,.69444,0,0,.61111],91:[.25,.75,0,0,.28889],93:[.25,.75,0,0,.28889],94:[0,.69444,0,0,.5],95:[.35,.09444,.02778,0,.5],97:[0,.44444,0,0,.48056],98:[0,.69444,0,0,.51667],99:[0,.44444,0,0,.44445],100:[0,.69444,0,0,.51667],101:[0,.44444,0,0,.44445],102:[0,.69444,.06944,0,.30556],103:[.19444,.44444,.01389,0,.5],104:[0,.69444,0,0,.51667],105:[0,.67937,0,0,.23889],106:[.19444,.67937,0,0,.26667],107:[0,.69444,0,0,.48889],108:[0,.69444,0,0,.23889],109:[0,.44444,0,0,.79445],110:[0,.44444,0,0,.51667],111:[0,.44444,0,0,.5],112:[.19444,.44444,0,0,.51667],113:[.19444,.44444,0,0,.51667],114:[0,.44444,.01389,0,.34167],115:[0,.44444,0,0,.38333],116:[0,.57143,0,0,.36111],117:[0,.44444,0,0,.51667],118:[0,.44444,.01389,0,.46111],119:[0,.44444,.01389,0,.68334],120:[0,.44444,0,0,.46111],121:[.19444,.44444,.01389,0,.46111],122:[0,.44444,0,0,.43472],126:[.35,.32659,0,0,.5],160:[0,0,0,0,.25],168:[0,.67937,0,0,.5],176:[0,.69444,0,0,.66667],184:[.17014,0,0,0,.44445],305:[0,.44444,0,0,.23889],567:[.19444,.44444,0,0,.26667],710:[0,.69444,0,0,.5],711:[0,.63194,0,0,.5],713:[0,.60889,0,0,.5],714:[0,.69444,0,0,.5],715:[0,.69444,0,0,.5],728:[0,.69444,0,0,.5],729:[0,.67937,0,0,.27778],730:[0,.69444,0,0,.66667],732:[0,.67659,0,0,.5],733:[0,.69444,0,0,.5],915:[0,.69444,0,0,.54167],916:[0,.69444,0,0,.83334],920:[0,.69444,0,0,.77778],923:[0,.69444,0,0,.61111],926:[0,.69444,0,0,.66667],928:[0,.69444,0,0,.70834],931:[0,.69444,0,0,.72222],933:[0,.69444,0,0,.77778],934:[0,.69444,0,0,.72222],936:[0,.69444,0,0,.77778],937:[0,.69444,0,0,.72222],8211:[0,.44444,.02778,0,.5],8212:[0,.44444,.02778,0,1],8216:[0,.69444,0,0,.27778],8217:[0,.69444,0,0,.27778],8220:[0,.69444,0,0,.5],8221:[0,.69444,0,0,.5]},"Script-Regular":{32:[0,0,0,0,.25],65:[0,.7,.22925,0,.80253],66:[0,.7,.04087,0,.90757],67:[0,.7,.1689,0,.66619],68:[0,.7,.09371,0,.77443],69:[0,.7,.18583,0,.56162],70:[0,.7,.13634,0,.89544],71:[0,.7,.17322,0,.60961],72:[0,.7,.29694,0,.96919],73:[0,.7,.19189,0,.80907],74:[.27778,.7,.19189,0,1.05159],75:[0,.7,.31259,0,.91364],76:[0,.7,.19189,0,.87373],77:[0,.7,.15981,0,1.08031],78:[0,.7,.3525,0,.9015],79:[0,.7,.08078,0,.73787],80:[0,.7,.08078,0,1.01262],81:[0,.7,.03305,0,.88282],82:[0,.7,.06259,0,.85],83:[0,.7,.19189,0,.86767],84:[0,.7,.29087,0,.74697],85:[0,.7,.25815,0,.79996],86:[0,.7,.27523,0,.62204],87:[0,.7,.27523,0,.80532],88:[0,.7,.26006,0,.94445],89:[0,.7,.2939,0,.70961],90:[0,.7,.24037,0,.8212],160:[0,0,0,0,.25]},"Size1-Regular":{32:[0,0,0,0,.25],40:[.35001,.85,0,0,.45834],41:[.35001,.85,0,0,.45834],47:[.35001,.85,0,0,.57778],91:[.35001,.85,0,0,.41667],92:[.35001,.85,0,0,.57778],93:[.35001,.85,0,0,.41667],123:[.35001,.85,0,0,.58334],125:[.35001,.85,0,0,.58334],160:[0,0,0,0,.25],710:[0,.72222,0,0,.55556],732:[0,.72222,0,0,.55556],770:[0,.72222,0,0,.55556],771:[0,.72222,0,0,.55556],8214:[-99e-5,.601,0,0,.77778],8593:[1e-5,.6,0,0,.66667],8595:[1e-5,.6,0,0,.66667],8657:[1e-5,.6,0,0,.77778],8659:[1e-5,.6,0,0,.77778],8719:[.25001,.75,0,0,.94445],8720:[.25001,.75,0,0,.94445],8721:[.25001,.75,0,0,1.05556],8730:[.35001,.85,0,0,1],8739:[-.00599,.606,0,0,.33333],8741:[-.00599,.606,0,0,.55556],8747:[.30612,.805,.19445,0,.47222],8748:[.306,.805,.19445,0,.47222],8749:[.306,.805,.19445,0,.47222],8750:[.30612,.805,.19445,0,.47222],8896:[.25001,.75,0,0,.83334],8897:[.25001,.75,0,0,.83334],8898:[.25001,.75,0,0,.83334],8899:[.25001,.75,0,0,.83334],8968:[.35001,.85,0,0,.47222],8969:[.35001,.85,0,0,.47222],8970:[.35001,.85,0,0,.47222],8971:[.35001,.85,0,0,.47222],9168:[-99e-5,.601,0,0,.66667],10216:[.35001,.85,0,0,.47222],10217:[.35001,.85,0,0,.47222],10752:[.25001,.75,0,0,1.11111],10753:[.25001,.75,0,0,1.11111],10754:[.25001,.75,0,0,1.11111],10756:[.25001,.75,0,0,.83334],10758:[.25001,.75,0,0,.83334]},"Size2-Regular":{32:[0,0,0,0,.25],40:[.65002,1.15,0,0,.59722],41:[.65002,1.15,0,0,.59722],47:[.65002,1.15,0,0,.81111],91:[.65002,1.15,0,0,.47222],92:[.65002,1.15,0,0,.81111],93:[.65002,1.15,0,0,.47222],123:[.65002,1.15,0,0,.66667],125:[.65002,1.15,0,0,.66667],160:[0,0,0,0,.25],710:[0,.75,0,0,1],732:[0,.75,0,0,1],770:[0,.75,0,0,1],771:[0,.75,0,0,1],8719:[.55001,1.05,0,0,1.27778],8720:[.55001,1.05,0,0,1.27778],8721:[.55001,1.05,0,0,1.44445],8730:[.65002,1.15,0,0,1],8747:[.86225,1.36,.44445,0,.55556],8748:[.862,1.36,.44445,0,.55556],8749:[.862,1.36,.44445,0,.55556],8750:[.86225,1.36,.44445,0,.55556],8896:[.55001,1.05,0,0,1.11111],8897:[.55001,1.05,0,0,1.11111],8898:[.55001,1.05,0,0,1.11111],8899:[.55001,1.05,0,0,1.11111],8968:[.65002,1.15,0,0,.52778],8969:[.65002,1.15,0,0,.52778],8970:[.65002,1.15,0,0,.52778],8971:[.65002,1.15,0,0,.52778],10216:[.65002,1.15,0,0,.61111],10217:[.65002,1.15,0,0,.61111],10752:[.55001,1.05,0,0,1.51112],10753:[.55001,1.05,0,0,1.51112],10754:[.55001,1.05,0,0,1.51112],10756:[.55001,1.05,0,0,1.11111],10758:[.55001,1.05,0,0,1.11111]},"Size3-Regular":{32:[0,0,0,0,.25],40:[.95003,1.45,0,0,.73611],41:[.95003,1.45,0,0,.73611],47:[.95003,1.45,0,0,1.04445],91:[.95003,1.45,0,0,.52778],92:[.95003,1.45,0,0,1.04445],93:[.95003,1.45,0,0,.52778],123:[.95003,1.45,0,0,.75],125:[.95003,1.45,0,0,.75],160:[0,0,0,0,.25],710:[0,.75,0,0,1.44445],732:[0,.75,0,0,1.44445],770:[0,.75,0,0,1.44445],771:[0,.75,0,0,1.44445],8730:[.95003,1.45,0,0,1],8968:[.95003,1.45,0,0,.58334],8969:[.95003,1.45,0,0,.58334],8970:[.95003,1.45,0,0,.58334],8971:[.95003,1.45,0,0,.58334],10216:[.95003,1.45,0,0,.75],10217:[.95003,1.45,0,0,.75]},"Size4-Regular":{32:[0,0,0,0,.25],40:[1.25003,1.75,0,0,.79167],41:[1.25003,1.75,0,0,.79167],47:[1.25003,1.75,0,0,1.27778],91:[1.25003,1.75,0,0,.58334],92:[1.25003,1.75,0,0,1.27778],93:[1.25003,1.75,0,0,.58334],123:[1.25003,1.75,0,0,.80556],125:[1.25003,1.75,0,0,.80556],160:[0,0,0,0,.25],710:[0,.825,0,0,1.8889],732:[0,.825,0,0,1.8889],770:[0,.825,0,0,1.8889],771:[0,.825,0,0,1.8889],8730:[1.25003,1.75,0,0,1],8968:[1.25003,1.75,0,0,.63889],8969:[1.25003,1.75,0,0,.63889],8970:[1.25003,1.75,0,0,.63889],8971:[1.25003,1.75,0,0,.63889],9115:[.64502,1.155,0,0,.875],9116:[1e-5,.6,0,0,.875],9117:[.64502,1.155,0,0,.875],9118:[.64502,1.155,0,0,.875],9119:[1e-5,.6,0,0,.875],9120:[.64502,1.155,0,0,.875],9121:[.64502,1.155,0,0,.66667],9122:[-99e-5,.601,0,0,.66667],9123:[.64502,1.155,0,0,.66667],9124:[.64502,1.155,0,0,.66667],9125:[-99e-5,.601,0,0,.66667],9126:[.64502,1.155,0,0,.66667],9127:[1e-5,.9,0,0,.88889],9128:[.65002,1.15,0,0,.88889],9129:[.90001,0,0,0,.88889],9130:[0,.3,0,0,.88889],9131:[1e-5,.9,0,0,.88889],9132:[.65002,1.15,0,0,.88889],9133:[.90001,0,0,0,.88889],9143:[.88502,.915,0,0,1.05556],10216:[1.25003,1.75,0,0,.80556],10217:[1.25003,1.75,0,0,.80556],57344:[-.00499,.605,0,0,1.05556],57345:[-.00499,.605,0,0,1.05556],57680:[0,.12,0,0,.45],57681:[0,.12,0,0,.45],57682:[0,.12,0,0,.45],57683:[0,.12,0,0,.45]},"Typewriter-Regular":{32:[0,0,0,0,.525],33:[0,.61111,0,0,.525],34:[0,.61111,0,0,.525],35:[0,.61111,0,0,.525],36:[.08333,.69444,0,0,.525],37:[.08333,.69444,0,0,.525],38:[0,.61111,0,0,.525],39:[0,.61111,0,0,.525],40:[.08333,.69444,0,0,.525],41:[.08333,.69444,0,0,.525],42:[0,.52083,0,0,.525],43:[-.08056,.53055,0,0,.525],44:[.13889,.125,0,0,.525],45:[-.08056,.53055,0,0,.525],46:[0,.125,0,0,.525],47:[.08333,.69444,0,0,.525],48:[0,.61111,0,0,.525],49:[0,.61111,0,0,.525],50:[0,.61111,0,0,.525],51:[0,.61111,0,0,.525],52:[0,.61111,0,0,.525],53:[0,.61111,0,0,.525],54:[0,.61111,0,0,.525],55:[0,.61111,0,0,.525],56:[0,.61111,0,0,.525],57:[0,.61111,0,0,.525],58:[0,.43056,0,0,.525],59:[.13889,.43056,0,0,.525],60:[-.05556,.55556,0,0,.525],61:[-.19549,.41562,0,0,.525],62:[-.05556,.55556,0,0,.525],63:[0,.61111,0,0,.525],64:[0,.61111,0,0,.525],65:[0,.61111,0,0,.525],66:[0,.61111,0,0,.525],67:[0,.61111,0,0,.525],68:[0,.61111,0,0,.525],69:[0,.61111,0,0,.525],70:[0,.61111,0,0,.525],71:[0,.61111,0,0,.525],72:[0,.61111,0,0,.525],73:[0,.61111,0,0,.525],74:[0,.61111,0,0,.525],75:[0,.61111,0,0,.525],76:[0,.61111,0,0,.525],77:[0,.61111,0,0,.525],78:[0,.61111,0,0,.525],79:[0,.61111,0,0,.525],80:[0,.61111,0,0,.525],81:[.13889,.61111,0,0,.525],82:[0,.61111,0,0,.525],83:[0,.61111,0,0,.525],84:[0,.61111,0,0,.525],85:[0,.61111,0,0,.525],86:[0,.61111,0,0,.525],87:[0,.61111,0,0,.525],88:[0,.61111,0,0,.525],89:[0,.61111,0,0,.525],90:[0,.61111,0,0,.525],91:[.08333,.69444,0,0,.525],92:[.08333,.69444,0,0,.525],93:[.08333,.69444,0,0,.525],94:[0,.61111,0,0,.525],95:[.09514,0,0,0,.525],96:[0,.61111,0,0,.525],97:[0,.43056,0,0,.525],98:[0,.61111,0,0,.525],99:[0,.43056,0,0,.525],100:[0,.61111,0,0,.525],101:[0,.43056,0,0,.525],102:[0,.61111,0,0,.525],103:[.22222,.43056,0,0,.525],104:[0,.61111,0,0,.525],105:[0,.61111,0,0,.525],106:[.22222,.61111,0,0,.525],107:[0,.61111,0,0,.525],108:[0,.61111,0,0,.525],109:[0,.43056,0,0,.525],110:[0,.43056,0,0,.525],111:[0,.43056,0,0,.525],112:[.22222,.43056,0,0,.525],113:[.22222,.43056,0,0,.525],114:[0,.43056,0,0,.525],115:[0,.43056,0,0,.525],116:[0,.55358,0,0,.525],117:[0,.43056,0,0,.525],118:[0,.43056,0,0,.525],119:[0,.43056,0,0,.525],120:[0,.43056,0,0,.525],121:[.22222,.43056,0,0,.525],122:[0,.43056,0,0,.525],123:[.08333,.69444,0,0,.525],124:[.08333,.69444,0,0,.525],125:[.08333,.69444,0,0,.525],126:[0,.61111,0,0,.525],127:[0,.61111,0,0,.525],160:[0,0,0,0,.525],176:[0,.61111,0,0,.525],184:[.19445,0,0,0,.525],305:[0,.43056,0,0,.525],567:[.22222,.43056,0,0,.525],711:[0,.56597,0,0,.525],713:[0,.56555,0,0,.525],714:[0,.61111,0,0,.525],715:[0,.61111,0,0,.525],728:[0,.61111,0,0,.525],730:[0,.61111,0,0,.525],770:[0,.61111,0,0,.525],771:[0,.61111,0,0,.525],776:[0,.61111,0,0,.525],915:[0,.61111,0,0,.525],916:[0,.61111,0,0,.525],920:[0,.61111,0,0,.525],923:[0,.61111,0,0,.525],926:[0,.61111,0,0,.525],928:[0,.61111,0,0,.525],931:[0,.61111,0,0,.525],933:[0,.61111,0,0,.525],934:[0,.61111,0,0,.525],936:[0,.61111,0,0,.525],937:[0,.61111,0,0,.525],8216:[0,.61111,0,0,.525],8217:[0,.61111,0,0,.525],8242:[0,.61111,0,0,.525],9251:[.11111,.21944,0,0,.525]}},Ha={slant:[.25,.25,.25],space:[0,0,0],stretch:[0,0,0],shrink:[0,0,0],xHeight:[.431,.431,.431],quad:[1,1.171,1.472],extraSpace:[0,0,0],num1:[.677,.732,.925],num2:[.394,.384,.387],num3:[.444,.471,.504],denom1:[.686,.752,1.025],denom2:[.345,.344,.532],sup1:[.413,.503,.504],sup2:[.363,.431,.404],sup3:[.289,.286,.294],sub1:[.15,.143,.2],sub2:[.247,.286,.4],supDrop:[.386,.353,.494],subDrop:[.05,.071,.1],delim1:[2.39,1.7,1.98],delim2:[1.01,1.157,1.42],axisHeight:[.25,.25,.25],defaultRuleThickness:[.04,.049,.049],bigOpSpacing1:[.111,.111,.111],bigOpSpacing2:[.166,.166,.166],bigOpSpacing3:[.2,.2,.2],bigOpSpacing4:[.6,.611,.611],bigOpSpacing5:[.1,.143,.143],sqrtRuleThickness:[.04,.04,.04],ptPerEm:[10,10,10],doubleRuleSep:[.2,.2,.2],arrayRuleWidth:[.04,.04,.04],fboxsep:[.3,.3,.3],fboxrule:[.04,.04,.04]},A0={Å:"A",Ð:"D",Þ:"o",å:"a",ð:"d",þ:"o",А:"A",Б:"B",В:"B",Г:"F",Д:"A",Е:"E",Ж:"K",З:"3",И:"N",Й:"N",К:"K",Л:"N",М:"M",Н:"H",О:"O",П:"N",Р:"P",С:"C",Т:"T",У:"y",Ф:"O",Х:"X",Ц:"U",Ч:"h",Ш:"W",Щ:"W",Ъ:"B",Ы:"X",Ь:"B",Э:"3",Ю:"X",Я:"R",а:"a",б:"b",в:"a",г:"r",д:"y",е:"e",ж:"m",з:"e",и:"n",й:"n",к:"n",л:"n",м:"m",н:"n",о:"o",п:"n",р:"p",с:"c",т:"o",у:"y",ф:"b",х:"x",ц:"n",ч:"n",ш:"w",щ:"w",ъ:"a",ы:"m",ь:"a",э:"e",ю:"m",я:"r"};function Um(t,e){sr[t]=e}function Jl(t,e,r){if(!sr[e])throw new Error("Font metrics not found for font: "+e+".");var i=t.charCodeAt(0),s=sr[e][i];if(!s&&t[0]in A0&&(i=A0[t[0]].charCodeAt(0),s=sr[e][i]),!s&&r==="text"&&xu(i)&&(s=sr[e][77]),s)return{depth:s[0],height:s[1],italic:s[2],skew:s[3],width:s[4]}}var _n={};function jm(t){var e;if(t>=5?e=0:t>=3?e=1:e=2,!_n[e]){var r=_n[e]={cssEmPerMu:Ha.quad[e]/18};for(var i in Ha)Ha.hasOwnProperty(i)&&(r[i]=Ha[i][e])}return _n[e]}var Te={math:{},text:{}};function n(t,e,r,i,s,a){Te[t][s]={font:e,group:r,replace:i},a&&i&&(Te[t][i]=Te[t][s])}var d="math",A="text",u="main",g="ams",Ce="accent-token",q="bin",nt="close",ks="inner",Y="mathord",Be="op-token",zt="open",ba="punct",x="rel",Ar="spacing",_="textord";n(d,u,x,"≡","\\equiv",!0);n(d,u,x,"≺","\\prec",!0);n(d,u,x,"≻","\\succ",!0);n(d,u,x,"∼","\\sim",!0);n(d,u,x,"⊥","\\perp");n(d,u,x,"⪯","\\preceq",!0);n(d,u,x,"⪰","\\succeq",!0);n(d,u,x,"≃","\\simeq",!0);n(d,u,x,"∣","\\mid",!0);n(d,u,x,"≪","\\ll",!0);n(d,u,x,"≫","\\gg",!0);n(d,u,x,"≍","\\asymp",!0);n(d,u,x,"∥","\\parallel");n(d,u,x,"⋈","\\bowtie",!0);n(d,u,x,"⌣","\\smile",!0);n(d,u,x,"⊑","\\sqsubseteq",!0);n(d,u,x,"⊒","\\sqsupseteq",!0);n(d,u,x,"≐","\\doteq",!0);n(d,u,x,"⌢","\\frown",!0);n(d,u,x,"∋","\\ni",!0);n(d,u,x,"∝","\\propto",!0);n(d,u,x,"⊢","\\vdash",!0);n(d,u,x,"⊣","\\dashv",!0);n(d,u,x,"∋","\\owns");n(d,u,ba,".","\\ldotp");n(d,u,ba,"⋅","\\cdotp");n(d,u,ba,"⋅","·");n(A,u,_,"⋅","·");n(d,u,_,"#","\\#");n(A,u,_,"#","\\#");n(d,u,_,"&","\\&");n(A,u,_,"&","\\&");n(d,u,_,"ℵ","\\aleph",!0);n(d,u,_,"∀","\\forall",!0);n(d,u,_,"ℏ","\\hbar",!0);n(d,u,_,"∃","\\exists",!0);n(d,u,_,"∇","\\nabla",!0);n(d,u,_,"♭","\\flat",!0);n(d,u,_,"ℓ","\\ell",!0);n(d,u,_,"♮","\\natural",!0);n(d,u,_,"♣","\\clubsuit",!0);n(d,u,_,"℘","\\wp",!0);n(d,u,_,"♯","\\sharp",!0);n(d,u,_,"♢","\\diamondsuit",!0);n(d,u,_,"ℜ","\\Re",!0);n(d,u,_,"♡","\\heartsuit",!0);n(d,u,_,"ℑ","\\Im",!0);n(d,u,_,"♠","\\spadesuit",!0);n(d,u,_,"§","\\S",!0);n(A,u,_,"§","\\S");n(d,u,_,"¶","\\P",!0);n(A,u,_,"¶","\\P");n(d,u,_,"†","\\dag");n(A,u,_,"†","\\dag");n(A,u,_,"†","\\textdagger");n(d,u,_,"‡","\\ddag");n(A,u,_,"‡","\\ddag");n(A,u,_,"‡","\\textdaggerdbl");n(d,u,nt,"⎱","\\rmoustache",!0);n(d,u,zt,"⎰","\\lmoustache",!0);n(d,u,nt,"⟯","\\rgroup",!0);n(d,u,zt,"⟮","\\lgroup",!0);n(d,u,q,"∓","\\mp",!0);n(d,u,q,"⊖","\\ominus",!0);n(d,u,q,"⊎","\\uplus",!0);n(d,u,q,"⊓","\\sqcap",!0);n(d,u,q,"∗","\\ast");n(d,u,q,"⊔","\\sqcup",!0);n(d,u,q,"◯","\\bigcirc",!0);n(d,u,q,"∙","\\bullet",!0);n(d,u,q,"‡","\\ddagger");n(d,u,q,"≀","\\wr",!0);n(d,u,q,"⨿","\\amalg");n(d,u,q,"&","\\And");n(d,u,x,"⟵","\\longleftarrow",!0);n(d,u,x,"⇐","\\Leftarrow",!0);n(d,u,x,"⟸","\\Longleftarrow",!0);n(d,u,x,"⟶","\\longrightarrow",!0);n(d,u,x,"⇒","\\Rightarrow",!0);n(d,u,x,"⟹","\\Longrightarrow",!0);n(d,u,x,"↔","\\leftrightarrow",!0);n(d,u,x,"⟷","\\longleftrightarrow",!0);n(d,u,x,"⇔","\\Leftrightarrow",!0);n(d,u,x,"⟺","\\Longleftrightarrow",!0);n(d,u,x,"↦","\\mapsto",!0);n(d,u,x,"⟼","\\longmapsto",!0);n(d,u,x,"↗","\\nearrow",!0);n(d,u,x,"↩","\\hookleftarrow",!0);n(d,u,x,"↪","\\hookrightarrow",!0);n(d,u,x,"↘","\\searrow",!0);n(d,u,x,"↼","\\leftharpoonup",!0);n(d,u,x,"⇀","\\rightharpoonup",!0);n(d,u,x,"↙","\\swarrow",!0);n(d,u,x,"↽","\\leftharpoondown",!0);n(d,u,x,"⇁","\\rightharpoondown",!0);n(d,u,x,"↖","\\nwarrow",!0);n(d,u,x,"⇌","\\rightleftharpoons",!0);n(d,g,x,"≮","\\nless",!0);n(d,g,x,"","\\@nleqslant");n(d,g,x,"","\\@nleqq");n(d,g,x,"⪇","\\lneq",!0);n(d,g,x,"≨","\\lneqq",!0);n(d,g,x,"","\\@lvertneqq");n(d,g,x,"⋦","\\lnsim",!0);n(d,g,x,"⪉","\\lnapprox",!0);n(d,g,x,"⊀","\\nprec",!0);n(d,g,x,"⋠","\\npreceq",!0);n(d,g,x,"⋨","\\precnsim",!0);n(d,g,x,"⪹","\\precnapprox",!0);n(d,g,x,"≁","\\nsim",!0);n(d,g,x,"","\\@nshortmid");n(d,g,x,"∤","\\nmid",!0);n(d,g,x,"⊬","\\nvdash",!0);n(d,g,x,"⊭","\\nvDash",!0);n(d,g,x,"⋪","\\ntriangleleft");n(d,g,x,"⋬","\\ntrianglelefteq",!0);n(d,g,x,"⊊","\\subsetneq",!0);n(d,g,x,"","\\@varsubsetneq");n(d,g,x,"⫋","\\subsetneqq",!0);n(d,g,x,"","\\@varsubsetneqq");n(d,g,x,"≯","\\ngtr",!0);n(d,g,x,"","\\@ngeqslant");n(d,g,x,"","\\@ngeqq");n(d,g,x,"⪈","\\gneq",!0);n(d,g,x,"≩","\\gneqq",!0);n(d,g,x,"","\\@gvertneqq");n(d,g,x,"⋧","\\gnsim",!0);n(d,g,x,"⪊","\\gnapprox",!0);n(d,g,x,"⊁","\\nsucc",!0);n(d,g,x,"⋡","\\nsucceq",!0);n(d,g,x,"⋩","\\succnsim",!0);n(d,g,x,"⪺","\\succnapprox",!0);n(d,g,x,"≆","\\ncong",!0);n(d,g,x,"","\\@nshortparallel");n(d,g,x,"∦","\\nparallel",!0);n(d,g,x,"⊯","\\nVDash",!0);n(d,g,x,"⋫","\\ntriangleright");n(d,g,x,"⋭","\\ntrianglerighteq",!0);n(d,g,x,"","\\@nsupseteqq");n(d,g,x,"⊋","\\supsetneq",!0);n(d,g,x,"","\\@varsupsetneq");n(d,g,x,"⫌","\\supsetneqq",!0);n(d,g,x,"","\\@varsupsetneqq");n(d,g,x,"⊮","\\nVdash",!0);n(d,g,x,"⪵","\\precneqq",!0);n(d,g,x,"⪶","\\succneqq",!0);n(d,g,x,"","\\@nsubseteqq");n(d,g,q,"⊴","\\unlhd");n(d,g,q,"⊵","\\unrhd");n(d,g,x,"↚","\\nleftarrow",!0);n(d,g,x,"↛","\\nrightarrow",!0);n(d,g,x,"⇍","\\nLeftarrow",!0);n(d,g,x,"⇏","\\nRightarrow",!0);n(d,g,x,"↮","\\nleftrightarrow",!0);n(d,g,x,"⇎","\\nLeftrightarrow",!0);n(d,g,x,"△","\\vartriangle");n(d,g,_,"ℏ","\\hslash");n(d,g,_,"▽","\\triangledown");n(d,g,_,"◊","\\lozenge");n(d,g,_,"Ⓢ","\\circledS");n(d,g,_,"®","\\circledR");n(A,g,_,"®","\\circledR");n(d,g,_,"∡","\\measuredangle",!0);n(d,g,_,"∄","\\nexists");n(d,g,_,"℧","\\mho");n(d,g,_,"Ⅎ","\\Finv",!0);n(d,g,_,"⅁","\\Game",!0);n(d,g,_,"‵","\\backprime");n(d,g,_,"▲","\\blacktriangle");n(d,g,_,"▼","\\blacktriangledown");n(d,g,_,"■","\\blacksquare");n(d,g,_,"⧫","\\blacklozenge");n(d,g,_,"★","\\bigstar");n(d,g,_,"∢","\\sphericalangle",!0);n(d,g,_,"∁","\\complement",!0);n(d,g,_,"ð","\\eth",!0);n(A,u,_,"ð","ð");n(d,g,_,"╱","\\diagup");n(d,g,_,"╲","\\diagdown");n(d,g,_,"□","\\square");n(d,g,_,"□","\\Box");n(d,g,_,"◊","\\Diamond");n(d,g,_,"¥","\\yen",!0);n(A,g,_,"¥","\\yen",!0);n(d,g,_,"✓","\\checkmark",!0);n(A,g,_,"✓","\\checkmark");n(d,g,_,"ℶ","\\beth",!0);n(d,g,_,"ℸ","\\daleth",!0);n(d,g,_,"ℷ","\\gimel",!0);n(d,g,_,"ϝ","\\digamma",!0);n(d,g,_,"ϰ","\\varkappa");n(d,g,zt,"┌","\\@ulcorner",!0);n(d,g,nt,"┐","\\@urcorner",!0);n(d,g,zt,"└","\\@llcorner",!0);n(d,g,nt,"┘","\\@lrcorner",!0);n(d,g,x,"≦","\\leqq",!0);n(d,g,x,"⩽","\\leqslant",!0);n(d,g,x,"⪕","\\eqslantless",!0);n(d,g,x,"≲","\\lesssim",!0);n(d,g,x,"⪅","\\lessapprox",!0);n(d,g,x,"≊","\\approxeq",!0);n(d,g,q,"⋖","\\lessdot");n(d,g,x,"⋘","\\lll",!0);n(d,g,x,"≶","\\lessgtr",!0);n(d,g,x,"⋚","\\lesseqgtr",!0);n(d,g,x,"⪋","\\lesseqqgtr",!0);n(d,g,x,"≑","\\doteqdot");n(d,g,x,"≓","\\risingdotseq",!0);n(d,g,x,"≒","\\fallingdotseq",!0);n(d,g,x,"∽","\\backsim",!0);n(d,g,x,"⋍","\\backsimeq",!0);n(d,g,x,"⫅","\\subseteqq",!0);n(d,g,x,"⋐","\\Subset",!0);n(d,g,x,"⊏","\\sqsubset",!0);n(d,g,x,"≼","\\preccurlyeq",!0);n(d,g,x,"⋞","\\curlyeqprec",!0);n(d,g,x,"≾","\\precsim",!0);n(d,g,x,"⪷","\\precapprox",!0);n(d,g,x,"⊲","\\vartriangleleft");n(d,g,x,"⊴","\\trianglelefteq");n(d,g,x,"⊨","\\vDash",!0);n(d,g,x,"⊪","\\Vvdash",!0);n(d,g,x,"⌣","\\smallsmile");n(d,g,x,"⌢","\\smallfrown");n(d,g,x,"≏","\\bumpeq",!0);n(d,g,x,"≎","\\Bumpeq",!0);n(d,g,x,"≧","\\geqq",!0);n(d,g,x,"⩾","\\geqslant",!0);n(d,g,x,"⪖","\\eqslantgtr",!0);n(d,g,x,"≳","\\gtrsim",!0);n(d,g,x,"⪆","\\gtrapprox",!0);n(d,g,q,"⋗","\\gtrdot");n(d,g,x,"⋙","\\ggg",!0);n(d,g,x,"≷","\\gtrless",!0);n(d,g,x,"⋛","\\gtreqless",!0);n(d,g,x,"⪌","\\gtreqqless",!0);n(d,g,x,"≖","\\eqcirc",!0);n(d,g,x,"≗","\\circeq",!0);n(d,g,x,"≜","\\triangleq",!0);n(d,g,x,"∼","\\thicksim");n(d,g,x,"≈","\\thickapprox");n(d,g,x,"⫆","\\supseteqq",!0);n(d,g,x,"⋑","\\Supset",!0);n(d,g,x,"⊐","\\sqsupset",!0);n(d,g,x,"≽","\\succcurlyeq",!0);n(d,g,x,"⋟","\\curlyeqsucc",!0);n(d,g,x,"≿","\\succsim",!0);n(d,g,x,"⪸","\\succapprox",!0);n(d,g,x,"⊳","\\vartriangleright");n(d,g,x,"⊵","\\trianglerighteq");n(d,g,x,"⊩","\\Vdash",!0);n(d,g,x,"∣","\\shortmid");n(d,g,x,"∥","\\shortparallel");n(d,g,x,"≬","\\between",!0);n(d,g,x,"⋔","\\pitchfork",!0);n(d,g,x,"∝","\\varpropto");n(d,g,x,"◀","\\blacktriangleleft");n(d,g,x,"∴","\\therefore",!0);n(d,g,x,"∍","\\backepsilon");n(d,g,x,"▶","\\blacktriangleright");n(d,g,x,"∵","\\because",!0);n(d,g,x,"⋘","\\llless");n(d,g,x,"⋙","\\gggtr");n(d,g,q,"⊲","\\lhd");n(d,g,q,"⊳","\\rhd");n(d,g,x,"≂","\\eqsim",!0);n(d,u,x,"⋈","\\Join");n(d,g,x,"≑","\\Doteq",!0);n(d,g,q,"∔","\\dotplus",!0);n(d,g,q,"∖","\\smallsetminus");n(d,g,q,"⋒","\\Cap",!0);n(d,g,q,"⋓","\\Cup",!0);n(d,g,q,"⩞","\\doublebarwedge",!0);n(d,g,q,"⊟","\\boxminus",!0);n(d,g,q,"⊞","\\boxplus",!0);n(d,g,q,"⋇","\\divideontimes",!0);n(d,g,q,"⋉","\\ltimes",!0);n(d,g,q,"⋊","\\rtimes",!0);n(d,g,q,"⋋","\\leftthreetimes",!0);n(d,g,q,"⋌","\\rightthreetimes",!0);n(d,g,q,"⋏","\\curlywedge",!0);n(d,g,q,"⋎","\\curlyvee",!0);n(d,g,q,"⊝","\\circleddash",!0);n(d,g,q,"⊛","\\circledast",!0);n(d,g,q,"⋅","\\centerdot");n(d,g,q,"⊺","\\intercal",!0);n(d,g,q,"⋒","\\doublecap");n(d,g,q,"⋓","\\doublecup");n(d,g,q,"⊠","\\boxtimes",!0);n(d,g,x,"⇢","\\dashrightarrow",!0);n(d,g,x,"⇠","\\dashleftarrow",!0);n(d,g,x,"⇇","\\leftleftarrows",!0);n(d,g,x,"⇆","\\leftrightarrows",!0);n(d,g,x,"⇚","\\Lleftarrow",!0);n(d,g,x,"↞","\\twoheadleftarrow",!0);n(d,g,x,"↢","\\leftarrowtail",!0);n(d,g,x,"↫","\\looparrowleft",!0);n(d,g,x,"⇋","\\leftrightharpoons",!0);n(d,g,x,"↶","\\curvearrowleft",!0);n(d,g,x,"↺","\\circlearrowleft",!0);n(d,g,x,"↰","\\Lsh",!0);n(d,g,x,"⇈","\\upuparrows",!0);n(d,g,x,"↿","\\upharpoonleft",!0);n(d,g,x,"⇃","\\downharpoonleft",!0);n(d,u,x,"⊶","\\origof",!0);n(d,u,x,"⊷","\\imageof",!0);n(d,g,x,"⊸","\\multimap",!0);n(d,g,x,"↭","\\leftrightsquigarrow",!0);n(d,g,x,"⇉","\\rightrightarrows",!0);n(d,g,x,"⇄","\\rightleftarrows",!0);n(d,g,x,"↠","\\twoheadrightarrow",!0);n(d,g,x,"↣","\\rightarrowtail",!0);n(d,g,x,"↬","\\looparrowright",!0);n(d,g,x,"↷","\\curvearrowright",!0);n(d,g,x,"↻","\\circlearrowright",!0);n(d,g,x,"↱","\\Rsh",!0);n(d,g,x,"⇊","\\downdownarrows",!0);n(d,g,x,"↾","\\upharpoonright",!0);n(d,g,x,"⇂","\\downharpoonright",!0);n(d,g,x,"⇝","\\rightsquigarrow",!0);n(d,g,x,"⇝","\\leadsto");n(d,g,x,"⇛","\\Rrightarrow",!0);n(d,g,x,"↾","\\restriction");n(d,u,_,"‘","`");n(d,u,_,"$","\\$");n(A,u,_,"$","\\$");n(A,u,_,"$","\\textdollar");n(d,u,_,"%","\\%");n(A,u,_,"%","\\%");n(d,u,_,"_","\\_");n(A,u,_,"_","\\_");n(A,u,_,"_","\\textunderscore");n(d,u,_,"∠","\\angle",!0);n(d,u,_,"∞","\\infty",!0);n(d,u,_,"′","\\prime");n(d,u,_,"△","\\triangle");n(d,u,_,"Γ","\\Gamma",!0);n(d,u,_,"Δ","\\Delta",!0);n(d,u,_,"Θ","\\Theta",!0);n(d,u,_,"Λ","\\Lambda",!0);n(d,u,_,"Ξ","\\Xi",!0);n(d,u,_,"Π","\\Pi",!0);n(d,u,_,"Σ","\\Sigma",!0);n(d,u,_,"Υ","\\Upsilon",!0);n(d,u,_,"Φ","\\Phi",!0);n(d,u,_,"Ψ","\\Psi",!0);n(d,u,_,"Ω","\\Omega",!0);n(d,u,_,"A","Α");n(d,u,_,"B","Β");n(d,u,_,"E","Ε");n(d,u,_,"Z","Ζ");n(d,u,_,"H","Η");n(d,u,_,"I","Ι");n(d,u,_,"K","Κ");n(d,u,_,"M","Μ");n(d,u,_,"N","Ν");n(d,u,_,"O","Ο");n(d,u,_,"P","Ρ");n(d,u,_,"T","Τ");n(d,u,_,"X","Χ");n(d,u,_,"¬","\\neg",!0);n(d,u,_,"¬","\\lnot");n(d,u,_,"⊤","\\top");n(d,u,_,"⊥","\\bot");n(d,u,_,"∅","\\emptyset");n(d,g,_,"∅","\\varnothing");n(d,u,Y,"α","\\alpha",!0);n(d,u,Y,"β","\\beta",!0);n(d,u,Y,"γ","\\gamma",!0);n(d,u,Y,"δ","\\delta",!0);n(d,u,Y,"ϵ","\\epsilon",!0);n(d,u,Y,"ζ","\\zeta",!0);n(d,u,Y,"η","\\eta",!0);n(d,u,Y,"θ","\\theta",!0);n(d,u,Y,"ι","\\iota",!0);n(d,u,Y,"κ","\\kappa",!0);n(d,u,Y,"λ","\\lambda",!0);n(d,u,Y,"μ","\\mu",!0);n(d,u,Y,"ν","\\nu",!0);n(d,u,Y,"ξ","\\xi",!0);n(d,u,Y,"ο","\\omicron",!0);n(d,u,Y,"π","\\pi",!0);n(d,u,Y,"ρ","\\rho",!0);n(d,u,Y,"σ","\\sigma",!0);n(d,u,Y,"τ","\\tau",!0);n(d,u,Y,"υ","\\upsilon",!0);n(d,u,Y,"ϕ","\\phi",!0);n(d,u,Y,"χ","\\chi",!0);n(d,u,Y,"ψ","\\psi",!0);n(d,u,Y,"ω","\\omega",!0);n(d,u,Y,"ε","\\varepsilon",!0);n(d,u,Y,"ϑ","\\vartheta",!0);n(d,u,Y,"ϖ","\\varpi",!0);n(d,u,Y,"ϱ","\\varrho",!0);n(d,u,Y,"ς","\\varsigma",!0);n(d,u,Y,"φ","\\varphi",!0);n(d,u,q,"∗","*",!0);n(d,u,q,"+","+");n(d,u,q,"−","-",!0);n(d,u,q,"⋅","\\cdot",!0);n(d,u,q,"∘","\\circ",!0);n(d,u,q,"÷","\\div",!0);n(d,u,q,"±","\\pm",!0);n(d,u,q,"×","\\times",!0);n(d,u,q,"∩","\\cap",!0);n(d,u,q,"∪","\\cup",!0);n(d,u,q,"∖","\\setminus",!0);n(d,u,q,"∧","\\land");n(d,u,q,"∨","\\lor");n(d,u,q,"∧","\\wedge",!0);n(d,u,q,"∨","\\vee",!0);n(d,u,_,"√","\\surd");n(d,u,zt,"⟨","\\langle",!0);n(d,u,zt,"∣","\\lvert");n(d,u,zt,"∥","\\lVert");n(d,u,nt,"?","?");n(d,u,nt,"!","!");n(d,u,nt,"⟩","\\rangle",!0);n(d,u,nt,"∣","\\rvert");n(d,u,nt,"∥","\\rVert");n(d,u,x,"=","=");n(d,u,x,":",":");n(d,u,x,"≈","\\approx",!0);n(d,u,x,"≅","\\cong",!0);n(d,u,x,"≥","\\ge");n(d,u,x,"≥","\\geq",!0);n(d,u,x,"←","\\gets");n(d,u,x,">","\\gt",!0);n(d,u,x,"∈","\\in",!0);n(d,u,x,"","\\@not");n(d,u,x,"⊂","\\subset",!0);n(d,u,x,"⊃","\\supset",!0);n(d,u,x,"⊆","\\subseteq",!0);n(d,u,x,"⊇","\\supseteq",!0);n(d,g,x,"⊈","\\nsubseteq",!0);n(d,g,x,"⊉","\\nsupseteq",!0);n(d,u,x,"⊨","\\models");n(d,u,x,"←","\\leftarrow",!0);n(d,u,x,"≤","\\le");n(d,u,x,"≤","\\leq",!0);n(d,u,x,"<","\\lt",!0);n(d,u,x,"→","\\rightarrow",!0);n(d,u,x,"→","\\to");n(d,g,x,"≱","\\ngeq",!0);n(d,g,x,"≰","\\nleq",!0);n(d,u,Ar," ","\\ ");n(d,u,Ar," ","\\space");n(d,u,Ar," ","\\nobreakspace");n(A,u,Ar," ","\\ ");n(A,u,Ar," "," ");n(A,u,Ar," ","\\space");n(A,u,Ar," ","\\nobreakspace");n(d,u,Ar,"","\\nobreak");n(d,u,Ar,"","\\allowbreak");n(d,u,ba,",",",");n(d,u,ba,";",";");n(d,g,q,"⊼","\\barwedge",!0);n(d,g,q,"⊻","\\veebar",!0);n(d,u,q,"⊙","\\odot",!0);n(d,u,q,"⊕","\\oplus",!0);n(d,u,q,"⊗","\\otimes",!0);n(d,u,_,"∂","\\partial",!0);n(d,u,q,"⊘","\\oslash",!0);n(d,g,q,"⊚","\\circledcirc",!0);n(d,g,q,"⊡","\\boxdot",!0);n(d,u,q,"△","\\bigtriangleup");n(d,u,q,"▽","\\bigtriangledown");n(d,u,q,"†","\\dagger");n(d,u,q,"⋄","\\diamond");n(d,u,q,"⋆","\\star");n(d,u,q,"◃","\\triangleleft");n(d,u,q,"▹","\\triangleright");n(d,u,zt,"{","\\{");n(A,u,_,"{","\\{");n(A,u,_,"{","\\textbraceleft");n(d,u,nt,"}","\\}");n(A,u,_,"}","\\}");n(A,u,_,"}","\\textbraceright");n(d,u,zt,"{","\\lbrace");n(d,u,nt,"}","\\rbrace");n(d,u,zt,"[","\\lbrack",!0);n(A,u,_,"[","\\lbrack",!0);n(d,u,nt,"]","\\rbrack",!0);n(A,u,_,"]","\\rbrack",!0);n(d,u,zt,"(","\\lparen",!0);n(d,u,nt,")","\\rparen",!0);n(A,u,_,"<","\\textless",!0);n(A,u,_,">","\\textgreater",!0);n(d,u,zt,"⌊","\\lfloor",!0);n(d,u,nt,"⌋","\\rfloor",!0);n(d,u,zt,"⌈","\\lceil",!0);n(d,u,nt,"⌉","\\rceil",!0);n(d,u,_,"\\","\\backslash");n(d,u,_,"∣","|");n(d,u,_,"∣","\\vert");n(A,u,_,"|","\\textbar",!0);n(d,u,_,"∥","\\|");n(d,u,_,"∥","\\Vert");n(A,u,_,"∥","\\textbardbl");n(A,u,_,"~","\\textasciitilde");n(A,u,_,"\\","\\textbackslash");n(A,u,_,"^","\\textasciicircum");n(d,u,x,"↑","\\uparrow",!0);n(d,u,x,"⇑","\\Uparrow",!0);n(d,u,x,"↓","\\downarrow",!0);n(d,u,x,"⇓","\\Downarrow",!0);n(d,u,x,"↕","\\updownarrow",!0);n(d,u,x,"⇕","\\Updownarrow",!0);n(d,u,Be,"∐","\\coprod");n(d,u,Be,"⋁","\\bigvee");n(d,u,Be,"⋀","\\bigwedge");n(d,u,Be,"⨄","\\biguplus");n(d,u,Be,"⋂","\\bigcap");n(d,u,Be,"⋃","\\bigcup");n(d,u,Be,"∫","\\int");n(d,u,Be,"∫","\\intop");n(d,u,Be,"∬","\\iint");n(d,u,Be,"∭","\\iiint");n(d,u,Be,"∏","\\prod");n(d,u,Be,"∑","\\sum");n(d,u,Be,"⨂","\\bigotimes");n(d,u,Be,"⨁","\\bigoplus");n(d,u,Be,"⨀","\\bigodot");n(d,u,Be,"∮","\\oint");n(d,u,Be,"∯","\\oiint");n(d,u,Be,"∰","\\oiiint");n(d,u,Be,"⨆","\\bigsqcup");n(d,u,Be,"∫","\\smallint");n(A,u,ks,"…","\\textellipsis");n(d,u,ks,"…","\\mathellipsis");n(A,u,ks,"…","\\ldots",!0);n(d,u,ks,"…","\\ldots",!0);n(d,u,ks,"⋯","\\@cdots",!0);n(d,u,ks,"⋱","\\ddots",!0);n(d,u,_,"⋮","\\varvdots");n(A,u,_,"⋮","\\varvdots");n(d,u,Ce,"ˊ","\\acute");n(d,u,Ce,"ˋ","\\grave");n(d,u,Ce,"¨","\\ddot");n(d,u,Ce,"~","\\tilde");n(d,u,Ce,"ˉ","\\bar");n(d,u,Ce,"˘","\\breve");n(d,u,Ce,"ˇ","\\check");n(d,u,Ce,"^","\\hat");n(d,u,Ce,"⃗","\\vec");n(d,u,Ce,"˙","\\dot");n(d,u,Ce,"˚","\\mathring");n(d,u,Y,"","\\@imath");n(d,u,Y,"","\\@jmath");n(d,u,_,"ı","ı");n(d,u,_,"ȷ","ȷ");n(A,u,_,"ı","\\i",!0);n(A,u,_,"ȷ","\\j",!0);n(A,u,_,"ß","\\ss",!0);n(A,u,_,"æ","\\ae",!0);n(A,u,_,"œ","\\oe",!0);n(A,u,_,"ø","\\o",!0);n(A,u,_,"Æ","\\AE",!0);n(A,u,_,"Œ","\\OE",!0);n(A,u,_,"Ø","\\O",!0);n(A,u,Ce,"ˊ","\\'");n(A,u,Ce,"ˋ","\\`");n(A,u,Ce,"ˆ","\\^");n(A,u,Ce,"˜","\\~");n(A,u,Ce,"ˉ","\\=");n(A,u,Ce,"˘","\\u");n(A,u,Ce,"˙","\\.");n(A,u,Ce,"¸","\\c");n(A,u,Ce,"˚","\\r");n(A,u,Ce,"ˇ","\\v");n(A,u,Ce,"¨",'\\"');n(A,u,Ce,"˝","\\H");n(A,u,Ce,"◯","\\textcircled");var Su={"--":!0,"---":!0,"``":!0,"''":!0};n(A,u,_,"–","--",!0);n(A,u,_,"–","\\textendash");n(A,u,_,"—","---",!0);n(A,u,_,"—","\\textemdash");n(A,u,_,"‘","`",!0);n(A,u,_,"‘","\\textquoteleft");n(A,u,_,"’","'",!0);n(A,u,_,"’","\\textquoteright");n(A,u,_,"“","``",!0);n(A,u,_,"“","\\textquotedblleft");n(A,u,_,"”","''",!0);n(A,u,_,"”","\\textquotedblright");n(d,u,_,"°","\\degree",!0);n(A,u,_,"°","\\degree");n(A,u,_,"°","\\textdegree",!0);n(d,u,_,"£","\\pounds");n(d,u,_,"£","\\mathsterling",!0);n(A,u,_,"£","\\pounds");n(A,u,_,"£","\\textsterling",!0);n(d,g,_,"✠","\\maltese");n(A,g,_,"✠","\\maltese");var M0='0123456789/@."';for(var kn=0;kn<M0.length;kn++){var P0=M0.charAt(kn);n(d,u,_,P0,P0)}var D0='0123456789!@*()-=+";:?/.,';for(var Sn=0;Sn<D0.length;Sn++){var O0=D0.charAt(Sn);n(A,u,_,O0,O0)}var mo="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";for(var zn=0;zn<mo.length;zn++){var qa=mo.charAt(zn);n(d,u,Y,qa,qa),n(A,u,_,qa,qa)}n(d,g,_,"C","ℂ");n(A,g,_,"C","ℂ");n(d,g,_,"H","ℍ");n(A,g,_,"H","ℍ");n(d,g,_,"N","ℕ");n(A,g,_,"N","ℕ");n(d,g,_,"P","ℙ");n(A,g,_,"P","ℙ");n(d,g,_,"Q","ℚ");n(A,g,_,"Q","ℚ");n(d,g,_,"R","ℝ");n(A,g,_,"R","ℝ");n(d,g,_,"Z","ℤ");n(A,g,_,"Z","ℤ");n(d,u,Y,"h","ℎ");n(A,u,Y,"h","ℎ");var Q;for(var tt=0;tt<mo.length;tt++){var De=mo.charAt(tt);Q=String.fromCharCode(55349,56320+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56372+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56424+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56580+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56684+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56736+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56788+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56840+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56944+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),tt<26&&(Q=String.fromCharCode(55349,56632+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q),Q=String.fromCharCode(55349,56476+tt),n(d,u,Y,De,Q),n(A,u,_,De,Q))}Q="𝕜";n(d,u,Y,"k",Q);n(A,u,_,"k",Q);for(var bi=0;bi<10;bi++){var Nr=bi.toString();Q=String.fromCharCode(55349,57294+bi),n(d,u,Y,Nr,Q),n(A,u,_,Nr,Q),Q=String.fromCharCode(55349,57314+bi),n(d,u,Y,Nr,Q),n(A,u,_,Nr,Q),Q=String.fromCharCode(55349,57324+bi),n(d,u,Y,Nr,Q),n(A,u,_,Nr,Q),Q=String.fromCharCode(55349,57334+bi),n(d,u,Y,Nr,Q),n(A,u,_,Nr,Q)}var rl="ÐÞþ";for(var $n=0;$n<rl.length;$n++){var Ua=rl.charAt($n);n(d,u,Y,Ua,Ua),n(A,u,_,Ua,Ua)}var il={mathClass:"mathbf",textClass:"textbf",font:"Main-Bold"},I0={mathClass:"mathnormal",textClass:"textit",font:"Math-Italic"},R0={mathClass:"boldsymbol",textClass:"boldsymbol",font:"Main-BoldItalic"},Wm={mathClass:"mathscr",textClass:"textscr",font:"Script-Regular"},zi={mathClass:"",textClass:"",font:""},L0={mathClass:"mathfrak",textClass:"textfrak",font:"Fraktur-Regular"},B0={mathClass:"mathbb",textClass:"textbb",font:"AMS-Regular"},N0={mathClass:"mathboldfrak",textClass:"textboldfrak",font:"Fraktur-Regular"},sl={mathClass:"mathsf",textClass:"textsf",font:"SansSerif-Regular"},al={mathClass:"mathboldsf",textClass:"textboldsf",font:"SansSerif-Bold"},F0={mathClass:"mathitsf",textClass:"textitsf",font:"SansSerif-Italic"},ol={mathClass:"mathtt",textClass:"texttt",font:"Typewriter-Regular"},H0=[il,il,I0,I0,R0,R0,Wm,zi,zi,zi,L0,L0,B0,B0,N0,N0,sl,sl,al,al,F0,F0,zi,zi,ol,ol],Vm=[il,zi,sl,al,ol],Gm=t=>{var e=t.charCodeAt(0),r=t.charCodeAt(1),i=(e-55296)*1024+(r-56320)+65536;if(119808<=i&&i<120484){var s=Math.floor((i-119808)/26);return H0[s]}else if(120782<=i&&i<=120831){var a=Math.floor((i-120782)/10);return Vm[a]}else{if(i===120485||i===120486)return H0[0];if(120486<i&&i<120782)return zi;throw new I("Unsupported character: "+t)}},Mo=function(e,r,i){if(Te[i][e]){var s=Te[i][e].replace;s&&(e=s)}return{value:e,metrics:Jl(e,r,i)}},rt=function(e,r,i,s,a){var o=Mo(e,r,i),l=o.metrics;e=o.value;var c;if(l){var h=l.italic;(i==="text"||s&&s.font==="mathit")&&(h=0),c=new xt(e,l.height,l.depth,h,l.skew,l.width,a)}else typeof console<"u"&&console.warn("No character metrics "+("for '"+e+"' in style '"+r+"' and mode '"+i+"'")),c=new xt(e,0,0,0,0,0,a);if(s){c.maxFontSize=s.sizeMultiplier,s.style.isTight()&&c.classes.push("mtight");var f=s.getColor();f&&(c.style.color=f)}return c},Ql=function(e,r,i,s){return s===void 0&&(s=[]),i.font==="boldsymbol"&&Mo(e,"Main-Bold",r).metrics?rt(e,"Main-Bold",r,i,s.concat(["mathbf"])):e==="\\"||Te[r][e].font==="main"?rt(e,"Main-Regular",r,i,s):rt(e,"AMS-Regular",r,i,s.concat(["amsrm"]))},Xm=function(e,r,i){return i!=="textord"&&Mo(e,"Math-BoldItalic",r).metrics?{fontName:"Math-BoldItalic",fontClass:"boldsymbol"}:{fontName:"Main-Bold",fontClass:"mathbf"}},Po=function(e,r){var i=e.type==="mathord"?"mathord":"textord",s=e.mode,a=e.text,o=["mord"],{font:l,fontFamily:c,fontWeight:h,fontShape:f}=r,b=s==="math"||s==="text"&&!!l,y=b?l:c,k="",z="";if(a.charCodeAt(0)===55349){var O=Gm(a);k=O.font,z=O[s+"Class"]}if(k)return rt(a,k,s,r,o.concat(z));if(y){var M,N;if(y==="boldsymbol"){var j=Xm(a,s,i);M=j.fontName,N=[j.fontClass]}else b?(M=nl[l].fontName,N=[l]):(M=ja(c,h,f),N=[c,h,f]);if(Mo(a,M,s).metrics)return rt(a,M,s,r,o.concat(N));if(Su.hasOwnProperty(a)&&M.slice(0,10)==="Typewriter"){for(var J=[],V=0;V<a.length;V++)J.push(rt(a[V],M,s,r,o.concat(N)));return Mr(J)}}if(i==="mathord")return rt(a,"Math-Italic",s,r,o.concat(["mathnormal"]));if(i==="textord"){var K=Te[s][a]&&Te[s][a].font;if(K==="ams"){var ee=ja("amsrm",h,f);return rt(a,ee,s,r,o.concat("amsrm",h,f))}else if(K==="main"||!K){var re=ja("textrm",h,f);return rt(a,re,s,r,o.concat(h,f))}else{var ne=ja(K,h,f);return rt(a,ne,s,r,o.concat(ne,h,f))}}else throw new Error("unexpected type: "+i+" in makeOrd")},Km=(t,e)=>{if(Qr(t.classes)!==Qr(e.classes)||t.skew!==e.skew||t.maxFontSize!==e.maxFontSize||t.italic!==0&&t.hasClass("mathnormal"))return!1;if(t.classes.length===1){var r=t.classes[0];if(r==="mbin"||r==="mord")return!1}for(var i of Object.keys(t.style))if(t.style[i]!==e.style[i])return!1;for(var s of Object.keys(e.style))if(t.style[s]!==e.style[s])return!1;return!0},zu=t=>{for(var e=0;e<t.length-1;e++){var r=t[e],i=t[e+1];r instanceof xt&&i instanceof xt&&Km(r,i)&&(r.text+=i.text,r.height=Math.max(r.height,i.height),r.depth=Math.max(r.depth,i.depth),r.italic=i.italic,t.splice(e+1,1),e--)}return t},ec=function(e){for(var r=0,i=0,s=0,a=0;a<e.children.length;a++){var o=e.children[a];o.height>r&&(r=o.height),o.depth>i&&(i=o.depth),o.maxFontSize>s&&(s=o.maxFontSize)}e.height=r,e.depth=i,e.maxFontSize=s},D=function(e,r,i,s){var a=new _s(e,r,i,s);return ec(a),a},ti=(t,e,r,i)=>new _s(t,e,r,i),us=function(e,r,i){var s=D([e],[],r);return s.height=Math.max(i||r.fontMetrics().defaultRuleThickness,r.minRuleThickness),s.style.borderBottomWidth=L(s.height),s.maxFontSize=1,s},Ym=function(e,r,i,s){var a=new Ao(e,r,i,s);return ec(a),a},Mr=function(e){var r=new ws(e);return ec(r),r},hs=function(e,r){return e instanceof ws?D([],[e],r):e},Zm=function(e){if(e.positionType==="individualShift"){for(var r=e.children,i=[r[0]],s=-r[0].shift-r[0].elem.depth,a=s,o=1;o<r.length;o++){var l=-r[o].shift-a-r[o].elem.depth,c=l-(r[o-1].elem.height+r[o-1].elem.depth);a=a+l,i.push({type:"kern",size:c}),i.push(r[o])}return{children:i,depth:s}}var h;if(e.positionType==="top"){for(var f=e.positionData,b=0;b<e.children.length;b++){var y=e.children[b];f-=y.type==="kern"?y.size:y.elem.height+y.elem.depth}h=f}else if(e.positionType==="bottom")h=-e.positionData;else{var k=e.children[0];if(k.type!=="elem")throw new Error('First child must have type "elem".');if(e.positionType==="shift")h=-k.elem.depth-e.positionData;else if(e.positionType==="firstBaseline")h=-k.elem.depth;else throw new Error("Invalid positionType "+e.positionType+".")}return{children:e.children,depth:h}},me=function(e,r){for(var{children:i,depth:s}=Zm(e),a=0,o=0;o<i.length;o++){var l=i[o];if(l.type==="elem"){var c=l.elem;a=Math.max(a,c.maxFontSize,c.height)}}a+=2;var h=D(["pstrut"],[]);h.style.height=L(a);for(var f=[],b=s,y=s,k=s,z=0;z<i.length;z++){var O=i[z];if(O.type==="kern")k+=O.size;else{var M=O.elem,N=O.wrapperClasses||[],j=O.wrapperStyle||{},J=D(N,[h,M],void 0,j);J.style.top=L(-a-k-M.depth),O.marginLeft&&(J.style.marginLeft=O.marginLeft),O.marginRight&&(J.style.marginRight=O.marginRight),f.push(J),k+=M.height+M.depth}b=Math.min(b,k),y=Math.max(y,k)}var V=D(["vlist"],f);V.style.height=L(y);var K;if(b<0){var ee=D([],[]),re=D(["vlist"],[ee]);re.style.height=L(-b);var ne=D(["vlist-s"],[new xt("​")]);K=[D(["vlist-r"],[V,ne]),D(["vlist-r"],[re])]}else K=[D(["vlist-r"],[V])];var le=D(["vlist-t"],K);return K.length===2&&le.classes.push("vlist-t2"),le.height=y,le.depth=-b,le},$u=(t,e)=>{var r=D(["mspace"],[],e),i=Pe(t,e);return r.style.marginRight=L(i),r},ja=(t,e,r)=>{var i,s;switch(t){case"amsrm":i="AMS";break;case"textrm":i="Main";break;case"textsf":i="SansSerif";break;case"texttt":i="Typewriter";break;default:i=t}return e==="textbf"&&r==="textit"?s="BoldItalic":e==="textbf"?s="Bold":r==="textit"?s="Italic":s="Regular",i+"-"+s},nl={mathbf:{variant:"bold",fontName:"Main-Bold"},mathrm:{variant:"normal",fontName:"Main-Regular"},textit:{variant:"italic",fontName:"Main-Italic"},mathit:{variant:"italic",fontName:"Main-Italic"},mathnormal:{variant:"italic",fontName:"Math-Italic"},mathsfit:{variant:"sans-serif-italic",fontName:"SansSerif-Italic"},mathbb:{variant:"double-struck",fontName:"AMS-Regular"},mathcal:{variant:"script",fontName:"Caligraphic-Regular"},mathfrak:{variant:"fraktur",fontName:"Fraktur-Regular"},mathscr:{variant:"script",fontName:"Script-Regular"},mathsf:{variant:"sans-serif",fontName:"SansSerif-Regular"},mathtt:{variant:"monospace",fontName:"Typewriter-Regular"}},Tu={vec:["vec",.471,.714],oiintSize1:["oiintSize1",.957,.499],oiintSize2:["oiintSize2",1.472,.659],oiiintSize1:["oiiintSize1",1.304,.499],oiiintSize2:["oiiintSize2",1.98,.659]},Cu=function(e,r){var[i,s,a]=Tu[e],o=new ei(i),l=new $r([o],{width:L(s),height:L(a),style:"width:"+L(s),viewBox:"0 0 "+1e3*s+" "+1e3*a,preserveAspectRatio:"xMinYMin"}),c=ti(["overlay"],[l],r);return c.height=a,c.style.height=L(a),c.style.width=L(s),c},Me={number:3,unit:"mu"},gi={number:4,unit:"mu"},_r={number:5,unit:"mu"},Jm={mord:{mop:Me,mbin:gi,mrel:_r,minner:Me},mop:{mord:Me,mop:Me,mrel:_r,minner:Me},mbin:{mord:gi,mop:gi,mopen:gi,minner:gi},mrel:{mord:_r,mop:_r,mopen:_r,minner:_r},mopen:{},mclose:{mop:Me,mbin:gi,mrel:_r,minner:Me},mpunct:{mord:Me,mop:Me,mrel:_r,mopen:Me,mclose:Me,mpunct:Me,minner:Me},minner:{mord:Me,mop:Me,mbin:gi,mrel:_r,mopen:Me,mpunct:Me,minner:Me}},Qm={mord:{mop:Me},mop:{mord:Me,mop:Me},mbin:{},mrel:{},mopen:{},mclose:{mop:Me},mpunct:{},minner:{mop:Me}},Eu={},oa={},na={};function H(t){for(var{type:e,names:r,htmlBuilder:i,mathmlBuilder:s}=t,a=0;a<r.length;++a)Eu[r[a]]=t;e&&(i&&(oa[e]=i),s&&(na[e]=s))}function Hi(t){var{type:e,htmlBuilder:r,mathmlBuilder:i}=t;r&&(oa[e]=r),i&&(na[e]=i)}var vo=function(e){return e.type==="ordgroup"&&e.body.length===1?e.body[0]:e},Ie=function(e){return e.type==="ordgroup"?e.body:[e]},ev=new Set(["leftmost","mbin","mopen","mrel","mop","mpunct"]),tv=new Set(["rightmost","mrel","mclose","mpunct"]),rv={display:ie.DISPLAY,text:ie.TEXT,script:ie.SCRIPT,scriptscript:ie.SCRIPTSCRIPT},iv={mord:"mord",mop:"mop",mbin:"mbin",mrel:"mrel",mopen:"mopen",mclose:"mclose",mpunct:"mpunct",minner:"minner"},He=function(e,r,i,s){s===void 0&&(s=[null,null]);for(var a=[],o=0;o<e.length;o++){var l=ve(e[o],r);if(l instanceof ws){var c=l.children;a.push(...c)}else a.push(l)}if(zu(a),!i)return a;var h=r;if(e.length===1){var f=e[0];f.type==="sizing"?h=r.havingSize(f.size):f.type==="styling"&&(h=r.havingStyle(rv[f.style]))}var b=D([s[0]||"leftmost"],[],r),y=D([s[1]||"rightmost"],[],r),k=i==="root";return ll(a,(z,O)=>{var M=O.classes[0],N=z.classes[0];M==="mbin"&&tv.has(N)?O.classes[0]="mord":N==="mbin"&&ev.has(M)&&(z.classes[0]="mord")},{node:b},y,k),ll(a,(z,O)=>{var M,N,j=dl(O),J=dl(z),V=j&&J?z.hasClass("mtight")?(M=Qm[j])==null?void 0:M[J]:(N=Jm[j])==null?void 0:N[J]:null;if(V)return $u(V,h)},{node:b},y,k),a},ll=function(e,r,i,s,a){s&&e.push(s);for(var o=0;o<e.length;o++){var l=e[o],c=Au(l);if(c){ll(c.children,r,i,null,a);continue}var h=!l.hasClass("mspace");if(h){var f=r(l,i.node);f&&(i.insertAfter?i.insertAfter(f):(e.unshift(f),o++))}h?i.node=l:a&&l.hasClass("newline")&&(i.node=D(["leftmost"])),i.insertAfter=(b=>y=>{e.splice(b+1,0,y),o++})(o)}s&&e.pop()},Au=function(e){return e instanceof ws||e instanceof Ao||e instanceof _s&&e.hasClass("enclosing")?e:null},cl=function(e,r){var i=Au(e);if(i){var s=i.children;if(s.length){if(r==="right")return cl(s[s.length-1],"right");if(r==="left")return cl(s[0],"left")}}return e},dl=function(e,r){if(!e)return null;r&&(e=cl(e,r));var i=e.classes[0];return iv[i]||null},la=function(e,r){var i=["nulldelimiter"].concat(e.baseSizingClasses());return D(r.concat(i))},ve=function(e,r,i){if(!e)return D();if(oa[e.type]){var s=oa[e.type](e,r);if(i&&r.size!==i.size){s=D(r.sizingClasses(i),[s],r);var a=r.sizeMultiplier/i.sizeMultiplier;s.height*=a,s.depth*=a}return s}else throw new I("Got group of unknown type: '"+e.type+"'")};function Wa(t,e){var r=D(["base"],t,e),i=D(["strut"]);return i.style.height=L(r.height+r.depth),r.depth&&(i.style.verticalAlign=L(-r.depth)),r.children.unshift(i),r}function ul(t,e){var r=null;t.length===1&&t[0].type==="tag"&&(r=t[0].tag,t=t[0].body);var i=He(t,e,"root"),s;i.length===2&&i[1].hasClass("tag")&&(s=i.pop());for(var a=[],o=[],l=0;l<i.length;l++)if(o.push(i[l]),i[l].hasClass("mbin")||i[l].hasClass("mrel")||i[l].hasClass("allowbreak")){for(var c=!1;l<i.length-1&&i[l+1].hasClass("mspace")&&!i[l+1].hasClass("newline");)l++,o.push(i[l]),i[l].hasClass("nobreak")&&(c=!0);c||(a.push(Wa(o,e)),o=[])}else i[l].hasClass("newline")&&(o.pop(),o.length>0&&(a.push(Wa(o,e)),o=[]),a.push(i[l]));o.length>0&&a.push(Wa(o,e));var h;r?(h=Wa(He(r,e,!0),e),h.classes=["tag"],a.push(h)):s&&a.push(s);var f=D(["katex-html"],a);if(f.setAttribute("aria-hidden","true"),h){var b=h.children[0];b.style.height=L(f.height+f.depth),f.depth&&(b.style.verticalAlign=L(-f.depth))}return f}function Mu(t){return new ws(t)}class R{constructor(e,r,i){this.type=void 0,this.attributes=void 0,this.children=void 0,this.classes=void 0,this.type=e,this.attributes={},this.children=r||[],this.classes=i||[]}setAttribute(e,r){this.attributes[e]=r}getAttribute(e){return this.attributes[e]}toNode(){var e=document.createElementNS("http://www.w3.org/1998/Math/MathML",this.type);for(var r in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,r)&&e.setAttribute(r,this.attributes[r]);this.classes.length>0&&(e.className=Qr(this.classes));for(var i=0;i<this.children.length;i++)if(this.children[i]instanceof Re&&this.children[i+1]instanceof Re){for(var s=this.children[i].toText()+this.children[++i].toText();this.children[i+1]instanceof Re;)s+=this.children[++i].toText();e.appendChild(new Re(s).toNode())}else e.appendChild(this.children[i].toNode());return e}toMarkup(){var e="<"+this.type;for(var r in this.attributes)Object.prototype.hasOwnProperty.call(this.attributes,r)&&(e+=" "+r+'="',e+=Ze(this.attributes[r]),e+='"');this.classes.length>0&&(e+=' class ="'+Ze(Qr(this.classes))+'"'),e+=">";for(var i=0;i<this.children.length;i++)e+=this.children[i].toMarkup();return e+="</"+this.type+">",e}toText(){return this.children.map(e=>e.toText()).join("")}}class Re{constructor(e){this.text=void 0,this.text=e}toNode(){return document.createTextNode(this.text)}toMarkup(){return Ze(this.toText())}toText(){return this.text}}class Pu{constructor(e){this.width=void 0,this.character=void 0,this.width=e,e>=.05555&&e<=.05556?this.character=" ":e>=.1666&&e<=.1667?this.character=" ":e>=.2222&&e<=.2223?this.character=" ":e>=.2777&&e<=.2778?this.character="  ":e>=-.05556&&e<=-.05555?this.character=" ⁣":e>=-.1667&&e<=-.1666?this.character=" ⁣":e>=-.2223&&e<=-.2222?this.character=" ⁣":e>=-.2778&&e<=-.2777?this.character=" ⁣":this.character=null}toNode(){if(this.character)return document.createTextNode(this.character);var e=document.createElementNS("http://www.w3.org/1998/Math/MathML","mspace");return e.setAttribute("width",L(this.width)),e}toMarkup(){return this.character?"<mtext>"+this.character+"</mtext>":'<mspace width="'+L(this.width)+'"/>'}toText(){return this.character?this.character:" "}}var sv=new Set(["\\imath","\\jmath"]),av=new Set(["mrow","mtable"]),Dt=function(e,r,i){return Te[r][e]&&Te[r][e].replace&&e.charCodeAt(0)!==55349&&!(Su.hasOwnProperty(e)&&i&&(i.fontFamily&&i.fontFamily.slice(4,6)==="tt"||i.font&&i.font.slice(4,6)==="tt"))&&(e=Te[r][e].replace),new Re(e)},tc=function(e){return e.length===1?e[0]:new R("mrow",e)},ov={mathit:"italic",boldsymbol:t=>t.type==="textord"?"bold":"bold-italic",mathbf:"bold",mathbb:"double-struck",mathsfit:"sans-serif-italic",mathfrak:"fraktur",mathscr:"script",mathcal:"script",mathsf:"sans-serif",mathtt:"monospace"},rc=(t,e)=>{if(t.mode==="text"){if(e.fontFamily==="texttt")return"monospace";if(e.fontFamily==="textsf")return e.fontShape==="textit"&&e.fontWeight==="textbf"?"sans-serif-bold-italic":e.fontShape==="textit"?"sans-serif-italic":e.fontWeight==="textbf"?"bold-sans-serif":"sans-serif";if(e.fontShape==="textit"&&e.fontWeight==="textbf")return"bold-italic";if(e.fontShape==="textit")return"italic";if(e.fontWeight==="textbf")return"bold"}var r=e.font;if(!r||r==="mathnormal")return null;var i=t.mode,s=ov[r];if(s)return typeof s=="function"?s(t):s;var a=t.text;if(sv.has(a))return null;if(Te[i][a]){var o=Te[i][a].replace;o&&(a=o)}var l=nl[r].fontName;return Jl(a,l,i)?nl[r].variant:null};function Tn(t){if(!t)return!1;if(t.type==="mi"&&t.children.length===1){var e=t.children[0];return e instanceof Re&&e.text==="."}else if(t.type==="mo"&&t.children.length===1&&t.getAttribute("separator")==="true"&&t.getAttribute("lspace")==="0em"&&t.getAttribute("rspace")==="0em"){var r=t.children[0];return r instanceof Re&&r.text===","}else return!1}var $t=function(e,r,i){if(e.length===1){var s=Se(e[0],r);return i&&s instanceof R&&s.type==="mo"&&(s.setAttribute("lspace","0em"),s.setAttribute("rspace","0em")),[s]}for(var a=[],o,l=0;l<e.length;l++){var c=Se(e[l],r);if(c instanceof R&&o instanceof R){if(c.type==="mtext"&&o.type==="mtext"&&c.getAttribute("mathvariant")===o.getAttribute("mathvariant")){o.children.push(...c.children);continue}else if(c.type==="mn"&&o.type==="mn"){o.children.push(...c.children);continue}else if(Tn(c)&&o.type==="mn"){o.children.push(...c.children);continue}else if(c.type==="mn"&&Tn(o))c.children=[...o.children,...c.children],a.pop();else if((c.type==="msup"||c.type==="msub")&&c.children.length>=1&&(o.type==="mn"||Tn(o))){var h=c.children[0];h instanceof R&&h.type==="mn"&&(h.children=[...o.children,...h.children],a.pop())}else if(o.type==="mi"&&o.children.length===1){var f=o.children[0];if(f instanceof Re&&f.text==="̸"&&(c.type==="mo"||c.type==="mi"||c.type==="mn")){var b=c.children[0];b instanceof Re&&b.text.length>0&&(b.text=b.text.slice(0,1)+"̸"+b.text.slice(1),a.pop())}}}a.push(c),o=c}return a},ri=function(e,r,i){return tc($t(e,r,i))},Se=function(e,r){if(!e)return new R("mrow");if(na[e.type])return na[e.type](e,r);throw new I("Got group of unknown type: '"+e.type+"'")};function q0(t,e,r,i,s){var a=$t(t,r),o;a.length===1&&a[0]instanceof R&&av.has(a[0].type)?o=a[0]:o=new R("mrow",a);var l=new R("annotation",[new Re(e)]);l.setAttribute("encoding","application/x-tex");var c=new R("semantics",[o,l]),h=new R("math",[c]);h.setAttribute("xmlns","http://www.w3.org/1998/Math/MathML"),i&&h.setAttribute("display","block");var f=s?"katex":"katex-mathml";return D([f],[h])}var nv=[[1,1,1],[2,1,1],[3,1,1],[4,2,1],[5,2,1],[6,3,1],[7,4,2],[8,6,3],[9,7,6],[10,8,7],[11,10,9]],U0=[.5,.6,.7,.8,.9,1,1.2,1.44,1.728,2.074,2.488],j0=function(e,r){return r.size<2?e:nv[e-1][r.size-1]};class kr{constructor(e){this.style=void 0,this.color=void 0,this.size=void 0,this.textSize=void 0,this.phantom=void 0,this.font=void 0,this.fontFamily=void 0,this.fontWeight=void 0,this.fontShape=void 0,this.sizeMultiplier=void 0,this.maxSize=void 0,this.minRuleThickness=void 0,this._fontMetrics=void 0,this.style=e.style,this.color=e.color,this.size=e.size||kr.BASESIZE,this.textSize=e.textSize||this.size,this.phantom=!!e.phantom,this.font=e.font||"",this.fontFamily=e.fontFamily||"",this.fontWeight=e.fontWeight||"",this.fontShape=e.fontShape||"",this.sizeMultiplier=U0[this.size-1],this.maxSize=e.maxSize,this.minRuleThickness=e.minRuleThickness,this._fontMetrics=void 0}extend(e){var r={style:this.style,size:this.size,textSize:this.textSize,color:this.color,phantom:this.phantom,font:this.font,fontFamily:this.fontFamily,fontWeight:this.fontWeight,fontShape:this.fontShape,maxSize:this.maxSize,minRuleThickness:this.minRuleThickness};return Object.assign(r,e),new kr(r)}havingStyle(e){return this.style===e?this:this.extend({style:e,size:j0(this.textSize,e)})}havingCrampedStyle(){return this.havingStyle(this.style.cramp())}havingSize(e){return this.size===e&&this.textSize===e?this:this.extend({style:this.style.text(),size:e,textSize:e,sizeMultiplier:U0[e-1]})}havingBaseStyle(e){e=e||this.style.text();var r=j0(kr.BASESIZE,e);return this.size===r&&this.textSize===kr.BASESIZE&&this.style===e?this:this.extend({style:e,size:r})}havingBaseSizing(){var e;switch(this.style.id){case 4:case 5:e=3;break;case 6:case 7:e=1;break;default:e=6}return this.extend({style:this.style.text(),size:e})}withColor(e){return this.extend({color:e})}withPhantom(){return this.extend({phantom:!0})}withFont(e){return this.extend({font:e})}withTextFontFamily(e){return this.extend({fontFamily:e,font:""})}withTextFontWeight(e){return this.extend({fontWeight:e,font:""})}withTextFontShape(e){return this.extend({fontShape:e,font:""})}sizingClasses(e){return e.size!==this.size?["sizing","reset-size"+e.size,"size"+this.size]:[]}baseSizingClasses(){return this.size!==kr.BASESIZE?["sizing","reset-size"+this.size,"size"+kr.BASESIZE]:[]}fontMetrics(){return this._fontMetrics||(this._fontMetrics=jm(this.size)),this._fontMetrics}getColor(){return this.phantom?"transparent":this.color}}kr.BASESIZE=6;var Du=function(e){return new kr({style:e.displayMode?ie.DISPLAY:ie.TEXT,maxSize:e.maxSize,minRuleThickness:e.minRuleThickness})},Ou=function(e,r){if(r.displayMode){var i=["katex-display"];r.leqno&&i.push("leqno"),r.fleqn&&i.push("fleqn"),e=D(i,[e])}return e},lv=function(e,r,i){var s=Du(i),a;if(i.output==="mathml")return q0(e,r,s,i.displayMode,!0);if(i.output==="html"){var o=ul(e,s);a=D(["katex"],[o])}else{var l=q0(e,r,s,i.displayMode,!1),c=ul(e,s);a=D(["katex"],[l,c])}return Ou(a,i)},cv=function(e,r,i){var s=Du(i),a=ul(e,s),o=D(["katex"],[a]);return Ou(o,i)},dv={widehat:"^",widecheck:"ˇ",widetilde:"~",utilde:"~",overleftarrow:"←",underleftarrow:"←",xleftarrow:"←",overrightarrow:"→",underrightarrow:"→",xrightarrow:"→",underbrace:"⏟",overbrace:"⏞",underbracket:"⎵",overbracket:"⎴",overgroup:"⏠",undergroup:"⏡",overleftrightarrow:"↔",underleftrightarrow:"↔",xleftrightarrow:"↔",Overrightarrow:"⇒",xRightarrow:"⇒",overleftharpoon:"↼",xleftharpoonup:"↼",overrightharpoon:"⇀",xrightharpoonup:"⇀",xLeftarrow:"⇐",xLeftrightarrow:"⇔",xhookleftarrow:"↩",xhookrightarrow:"↪",xmapsto:"↦",xrightharpoondown:"⇁",xleftharpoondown:"↽",xrightleftharpoons:"⇌",xleftrightharpoons:"⇋",xtwoheadleftarrow:"↞",xtwoheadrightarrow:"↠",xlongequal:"=",xtofrom:"⇄",xrightleftarrows:"⇄",xrightequilibrium:"⇌",xleftequilibrium:"⇋","\\cdrightarrow":"→","\\cdleftarrow":"←","\\cdlongequal":"="},Do=function(e){var r=new R("mo",[new Re(dv[e.replace(/^\\/,"")])]);return r.setAttribute("stretchy","true"),r},uv={overrightarrow:[["rightarrow"],.888,522,"xMaxYMin"],overleftarrow:[["leftarrow"],.888,522,"xMinYMin"],underrightarrow:[["rightarrow"],.888,522,"xMaxYMin"],underleftarrow:[["leftarrow"],.888,522,"xMinYMin"],xrightarrow:[["rightarrow"],1.469,522,"xMaxYMin"],"\\cdrightarrow":[["rightarrow"],3,522,"xMaxYMin"],xleftarrow:[["leftarrow"],1.469,522,"xMinYMin"],"\\cdleftarrow":[["leftarrow"],3,522,"xMinYMin"],Overrightarrow:[["doublerightarrow"],.888,560,"xMaxYMin"],xRightarrow:[["doublerightarrow"],1.526,560,"xMaxYMin"],xLeftarrow:[["doubleleftarrow"],1.526,560,"xMinYMin"],overleftharpoon:[["leftharpoon"],.888,522,"xMinYMin"],xleftharpoonup:[["leftharpoon"],.888,522,"xMinYMin"],xleftharpoondown:[["leftharpoondown"],.888,522,"xMinYMin"],overrightharpoon:[["rightharpoon"],.888,522,"xMaxYMin"],xrightharpoonup:[["rightharpoon"],.888,522,"xMaxYMin"],xrightharpoondown:[["rightharpoondown"],.888,522,"xMaxYMin"],xlongequal:[["longequal"],.888,334,"xMinYMin"],"\\cdlongequal":[["longequal"],3,334,"xMinYMin"],xtwoheadleftarrow:[["twoheadleftarrow"],.888,334,"xMinYMin"],xtwoheadrightarrow:[["twoheadrightarrow"],.888,334,"xMaxYMin"],overleftrightarrow:[["leftarrow","rightarrow"],.888,522],overbrace:[["leftbrace","midbrace","rightbrace"],1.6,548],underbrace:[["leftbraceunder","midbraceunder","rightbraceunder"],1.6,548],underleftrightarrow:[["leftarrow","rightarrow"],.888,522],xleftrightarrow:[["leftarrow","rightarrow"],1.75,522],xLeftrightarrow:[["doubleleftarrow","doublerightarrow"],1.75,560],xrightleftharpoons:[["leftharpoondownplus","rightharpoonplus"],1.75,716],xleftrightharpoons:[["leftharpoonplus","rightharpoondownplus"],1.75,716],xhookleftarrow:[["leftarrow","righthook"],1.08,522],xhookrightarrow:[["lefthook","rightarrow"],1.08,522],overlinesegment:[["leftlinesegment","rightlinesegment"],.888,522],underlinesegment:[["leftlinesegment","rightlinesegment"],.888,522],overbracket:[["leftbracketover","rightbracketover"],1.6,440],underbracket:[["leftbracketunder","rightbracketunder"],1.6,410],overgroup:[["leftgroup","rightgroup"],.888,342],undergroup:[["leftgroupunder","rightgroupunder"],.888,342],xmapsto:[["leftmapsto","rightarrow"],1.5,522],xtofrom:[["leftToFrom","rightToFrom"],1.75,528],xrightleftarrows:[["baraboveleftarrow","rightarrowabovebar"],1.75,901],xrightequilibrium:[["baraboveshortleftharpoon","rightharpoonaboveshortbar"],1.75,716],xleftequilibrium:[["shortbaraboveleftharpoon","shortrightharpoonabovebar"],1.75,716]},hv=new Set(["widehat","widecheck","widetilde","utilde"]),Oo=function(e,r){function i(){var l=4e5,c=e.label.slice(1);if(hv.has(c)&&"base"in e){var h=e.base.type==="ordgroup"?e.base.body.length:1,f,b,y;if(h>5)c==="widehat"||c==="widecheck"?(f=420,l=2364,y=.42,b=c+"4"):(f=312,l=2340,y=.34,b="tilde4");else{var k=[1,1,2,2,3,3][h];c==="widehat"||c==="widecheck"?(l=[0,1062,2364,2364,2364][k],f=[0,239,300,360,420][k],y=[0,.24,.3,.3,.36,.42][k],b=c+k):(l=[0,600,1033,2339,2340][k],f=[0,260,286,306,312][k],y=[0,.26,.286,.3,.306,.34][k],b="tilde"+k)}var z=new ei(b),O=new $r([z],{width:"100%",height:L(y),viewBox:"0 0 "+l+" "+f,preserveAspectRatio:"none"});return{span:ti([],[O],r),minWidth:0,height:y}}else{var M=[],N=uv[c];if(!N)throw new Error('No SVG data for "'+c+'".');var[j,J,V]=N,K=V/1e3,ee=j.length,re,ne;if(ee===1){if(N.length!==4)throw new Error('Expected 4-tuple for single-path SVG data "'+c+'".');re=["hide-tail"],ne=[N[3]]}else if(ee===2)re=["halfarrow-left","halfarrow-right"],ne=["xMinYMin","xMaxYMin"];else if(ee===3)re=["brace-left","brace-center","brace-right"],ne=["xMinYMin","xMidYMin","xMaxYMin"];else throw new Error(`Correct katexImagesData or update code here to support
                    `+ee+" children.");for(var le=0;le<ee;le++){var We=new ei(j[le]),Ne=new $r([We],{width:"400em",height:L(K),viewBox:"0 0 "+l+" "+V,preserveAspectRatio:ne[le]+" slice"}),ze=ti([re[le]],[Ne],r);if(ee===1)return{span:ze,minWidth:J,height:K};ze.style.height=L(K),M.push(ze)}return{span:D(["stretchy"],M,r),minWidth:J,height:K}}}var{span:s,minWidth:a,height:o}=i();return s.height=o,s.style.height=L(o),a>0&&(s.style.minWidth=L(a)),s},pv=function(e,r,i,s,a){var o,l=e.height+e.depth+i+s;if(/fbox|color|angl/.test(r)){if(o=D(["stretchy",r],[],a),r==="fbox"){var c=a.color&&a.getColor();c&&(o.style.borderColor=c)}}else{var h=[];/^[bx]cancel$/.test(r)&&h.push(new tl({x1:"0",y1:"0",x2:"100%",y2:"100%","stroke-width":"0.046em"})),/^x?cancel$/.test(r)&&h.push(new tl({x1:"0",y1:"100%",x2:"100%",y2:"0","stroke-width":"0.046em"}));var f=new $r(h,{width:"100%",height:L(l)});o=ti([],[f],a)}return o.height=l,o.style.height=L(l),o},fv={bin:1,close:1,inner:1,open:1,punct:1,rel:1},mv={"accent-token":1,mathord:1,"op-token":1,spacing:1,textord:1};function vv(t){return t in fv}function ae(t,e){if(!t||t.type!==e)throw new Error("Expected node of type "+e+", but got "+(t?"node of type "+t.type:String(t)));return t}function Io(t){var e=Ro(t);if(!e)throw new Error("Expected node of symbol group type, but got "+(t?"node of type "+t.type:String(t)));return e}function Ro(t){return t&&(t.type==="atom"||mv.hasOwnProperty(t.type))?t:null}var Iu=t=>{if(t instanceof xt)return t;if(qm(t)&&t.children.length===1)return Iu(t.children[0])},Ru=(t,e)=>{var r,i,s;t&&t.type==="supsub"?(i=ae(t.base,"accent"),r=i.base,t.base=r,s=Hm(ve(t,e)),t.base=i):(i=ae(t,"accent"),r=i.base);var a=ve(r,e.havingCrampedStyle()),o=i.isShifty&&Er(r),l=0;if(o){var c,h;l=(c=(h=Iu(a))==null?void 0:h.skew)!=null?c:0}var f=i.label==="\\c",b=f?a.height+a.depth:Math.min(a.height,e.fontMetrics().xHeight),y;if(i.isStretchy)y=Oo(i,e),y=me({positionType:"firstBaseline",children:[{type:"elem",elem:a},{type:"elem",elem:y,wrapperClasses:["svg-align"],wrapperStyle:l>0?{width:"calc(100% - "+L(2*l)+")",marginLeft:L(2*l)}:void 0}]});else{var k,z;i.label==="\\vec"?(k=Cu("vec",e),z=Tu.vec[1]):(k=Po({type:"textord",mode:i.mode,text:i.label},e),k=Fm(k),k.italic=0,z=k.width,f&&(b+=k.depth)),y=D(["accent-body"],[k]);var O=i.label==="\\textcircled";O&&(y.classes.push("accent-full"),b=a.height);var M=l;O||(M-=z/2),y.style.left=L(M),i.label==="\\textcircled"&&(y.style.top=".2em"),y=me({positionType:"firstBaseline",children:[{type:"elem",elem:a},{type:"kern",size:-b},{type:"elem",elem:y}]})}var N=D(["mord","accent"],[y],e);return s?(s.children[0]=N,s.height=Math.max(N.height,s.height),s.classes[0]="mord",s):N},bv=(t,e)=>{var r=t.isStretchy?Do(t.label):new R("mo",[Dt(t.label,t.mode)]),i=new R("mover",[Se(t.base,e),r]);return i.setAttribute("accent","true"),i},gv=new RegExp(["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring"].map(t=>"\\"+t).join("|"));H({type:"accent",names:["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring","\\widecheck","\\widehat","\\widetilde","\\overrightarrow","\\overleftarrow","\\Overrightarrow","\\overleftrightarrow","\\overgroup","\\overlinesegment","\\overleftharpoon","\\overrightharpoon"],numArgs:1,handler:(t,e)=>{var r=vo(e[0]),i=!gv.test(t.funcName),s=!i||t.funcName==="\\widehat"||t.funcName==="\\widetilde"||t.funcName==="\\widecheck";return{type:"accent",mode:t.parser.mode,label:t.funcName,isStretchy:i,isShifty:s,base:r}},htmlBuilder:Ru,mathmlBuilder:bv});H({type:"accent",names:["\\'","\\`","\\^","\\~","\\=","\\u","\\.",'\\"',"\\c","\\r","\\H","\\v","\\textcircled"],numArgs:1,allowedInText:!0,allowedInMath:!0,argTypes:["primitive"],handler:(t,e)=>{var r=e[0],i=t.parser.mode;return i==="math"&&(t.parser.settings.reportNonstrict("mathVsTextAccents","LaTeX's accent "+t.funcName+" works only in text mode"),i="text"),{type:"accent",mode:i,label:t.funcName,isStretchy:!1,isShifty:!0,base:r}}});H({type:"accentUnder",names:["\\underleftarrow","\\underrightarrow","\\underleftrightarrow","\\undergroup","\\underlinesegment","\\utilde"],numArgs:1,handler:(t,e)=>{var{parser:r,funcName:i}=t,s=e[0];return{type:"accentUnder",mode:r.mode,label:i,base:s}},htmlBuilder:(t,e)=>{var r=ve(t.base,e),i=Oo(t,e),s=t.label==="\\utilde"?.12:0,a=me({positionType:"top",positionData:r.height,children:[{type:"elem",elem:i,wrapperClasses:["svg-align"]},{type:"kern",size:s},{type:"elem",elem:r}]});return D(["mord","accentunder"],[a],e)},mathmlBuilder:(t,e)=>{var r=Do(t.label),i=new R("munder",[Se(t.base,e),r]);return i.setAttribute("accentunder","true"),i}});var Va=t=>{var e=new R("mpadded",t?[t]:[]);return e.setAttribute("width","+0.6em"),e.setAttribute("lspace","0.3em"),e};H({type:"xArrow",names:["\\xleftarrow","\\xrightarrow","\\xLeftarrow","\\xRightarrow","\\xleftrightarrow","\\xLeftrightarrow","\\xhookleftarrow","\\xhookrightarrow","\\xmapsto","\\xrightharpoondown","\\xrightharpoonup","\\xleftharpoondown","\\xleftharpoonup","\\xrightleftharpoons","\\xleftrightharpoons","\\xlongequal","\\xtwoheadrightarrow","\\xtwoheadleftarrow","\\xtofrom","\\xrightleftarrows","\\xrightequilibrium","\\xleftequilibrium","\\\\cdrightarrow","\\\\cdleftarrow","\\\\cdlongequal"],numArgs:1,numOptionalArgs:1,handler(t,e,r){var{parser:i,funcName:s}=t;return{type:"xArrow",mode:i.mode,label:s,body:e[0],below:r[0]}},htmlBuilder(t,e){var r=e.style,i=e.havingStyle(r.sup()),s=hs(ve(t.body,i,e),e),a=t.label.slice(0,2)==="\\x"?"x":"cd";s.classes.push(a+"-arrow-pad");var o;t.below&&(i=e.havingStyle(r.sub()),o=hs(ve(t.below,i,e),e),o.classes.push(a+"-arrow-pad"));var l=Oo(t,e),c=-e.fontMetrics().axisHeight+.5*l.height,h=-e.fontMetrics().axisHeight-.5*l.height-.111;(s.depth>.25||t.label==="\\xleftequilibrium")&&(h-=s.depth);var f;if(o){var b=-e.fontMetrics().axisHeight+o.height+.5*l.height+.111;f=me({positionType:"individualShift",children:[{type:"elem",elem:s,shift:h},{type:"elem",elem:l,shift:c,wrapperClasses:["svg-align"]},{type:"elem",elem:o,shift:b}]})}else f=me({positionType:"individualShift",children:[{type:"elem",elem:s,shift:h},{type:"elem",elem:l,shift:c,wrapperClasses:["svg-align"]}]});return D(["mrel","x-arrow"],[f],e)},mathmlBuilder(t,e){var r=Do(t.label);r.setAttribute("minsize",t.label.charAt(0)==="x"?"1.75em":"3.0em");var i;if(t.body){var s=Va(Se(t.body,e));if(t.below){var a=Va(Se(t.below,e));i=new R("munderover",[r,a,s])}else i=new R("mover",[r,s])}else if(t.below){var o=Va(Se(t.below,e));i=new R("munder",[r,o])}else i=Va(),i=new R("mover",[r,i]);return i}});function xv(t,e){var r=He(t.body,e,!0);return D([t.mclass],r,e)}function yv(t,e){var r,i=$t(t.body,e);return t.mclass==="minner"?r=new R("mpadded",i):t.mclass==="mord"?t.isCharacterBox?(r=i[0],r.type="mi"):r=new R("mi",i):(t.isCharacterBox?(r=i[0],r.type="mo"):r=new R("mo",i),t.mclass==="mbin"?(r.attributes.lspace="0.22em",r.attributes.rspace="0.22em"):t.mclass==="mpunct"?(r.attributes.lspace="0em",r.attributes.rspace="0.17em"):(t.mclass==="mopen"||t.mclass==="mclose")&&(r.attributes.lspace="0em",r.attributes.rspace="0em")),r}H({type:"mclass",names:["\\mathord","\\mathbin","\\mathrel","\\mathopen","\\mathclose","\\mathpunct","\\mathinner"],numArgs:1,primitive:!0,handler(t,e){var{parser:r,funcName:i}=t,s=e[0];return{type:"mclass",mode:r.mode,mclass:"m"+i.slice(5),body:Ie(s),isCharacterBox:Er(s)}},htmlBuilder:xv,mathmlBuilder:yv});var Lo=t=>{var e=t.type==="ordgroup"&&t.body.length?t.body[0]:t;return e.type==="atom"&&(e.family==="bin"||e.family==="rel")?"m"+e.family:"mord"};H({type:"mclass",names:["\\@binrel"],numArgs:2,handler(t,e){var{parser:r}=t;return{type:"mclass",mode:r.mode,mclass:Lo(e[0]),body:Ie(e[1]),isCharacterBox:Er(e[1])}}});H({type:"mclass",names:["\\stackrel","\\overset","\\underset"],numArgs:2,handler(t,e){var{parser:r,funcName:i}=t,s=e[1],a=e[0],o;i!=="\\stackrel"?o=Lo(s):o="mrel";var l={type:"op",mode:s.mode,limits:!0,alwaysHandleSupSub:!0,parentIsSupSub:!1,symbol:!1,suppressBaseShift:i!=="\\stackrel",body:Ie(s)},c=i==="\\underset"?{type:"supsub",mode:a.mode,base:l,sub:a}:{type:"supsub",mode:a.mode,base:l,sup:a};return{type:"mclass",mode:r.mode,mclass:o,body:[c],isCharacterBox:Er(c)}}});H({type:"pmb",names:["\\pmb"],numArgs:1,allowedInText:!0,handler(t,e){var{parser:r}=t;return{type:"pmb",mode:r.mode,mclass:Lo(e[0]),body:Ie(e[0])}},htmlBuilder(t,e){var r=He(t.body,e,!0),i=D([t.mclass],r,e);return i.style.textShadow="0.02em 0.01em 0.04px",i},mathmlBuilder(t,e){var r=$t(t.body,e),i=new R("mstyle",r);return i.setAttribute("style","text-shadow: 0.02em 0.01em 0.04px"),i}});var wv={">":"\\\\cdrightarrow","<":"\\\\cdleftarrow","=":"\\\\cdlongequal",A:"\\uparrow",V:"\\downarrow","|":"\\Vert",".":"no arrow"},W0=()=>({type:"styling",body:[],mode:"math",style:"display",resetFont:!0}),V0=t=>t.type==="textord"&&t.text==="@",_v=(t,e)=>(t.type==="mathord"||t.type==="atom")&&t.text===e;function kv(t,e,r){var i=wv[t];switch(i){case"\\\\cdrightarrow":case"\\\\cdleftarrow":return r.callFunction(i,[e[0]],[e[1]]);case"\\uparrow":case"\\downarrow":{var s=r.callFunction("\\\\cdleft",[e[0]],[]),a={type:"atom",text:i,mode:"math",family:"rel"},o=r.callFunction("\\Big",[a],[]),l=r.callFunction("\\\\cdright",[e[1]],[]),c={type:"ordgroup",mode:"math",body:[s,o,l]};return r.callFunction("\\\\cdparent",[c],[])}case"\\\\cdlongequal":return r.callFunction("\\\\cdlongequal",[],[]);case"\\Vert":{var h={type:"textord",text:"\\Vert",mode:"math"};return r.callFunction("\\Big",[h],[])}default:return{type:"textord",text:" ",mode:"math"}}}function Sv(t){var e=[];for(t.gullet.beginGroup(),t.gullet.macros.set("\\cr","\\\\\\relax"),t.gullet.beginGroup();;){e.push(t.parseExpression(!1,"\\\\")),t.gullet.endGroup(),t.gullet.beginGroup();var r=t.fetch().text;if(r==="&"||r==="\\\\")t.consume();else if(r==="\\end"){e[e.length-1].length===0&&e.pop();break}else throw new I("Expected \\\\ or \\cr or \\end",t.nextToken)}for(var i=[],s=[i],a=0;a<e.length;a++){for(var o=e[a],l=W0(),c=0;c<o.length;c++)if(!V0(o[c]))l.body.push(o[c]);else{i.push(l),c+=1;var h=Io(o[c]).text,f=new Array(2);if(f[0]={type:"ordgroup",mode:"math",body:[]},f[1]={type:"ordgroup",mode:"math",body:[]},!"=|.".includes(h))if("<>AV".includes(h))for(var b=0;b<2;b++){for(var y=!0,k=c+1;k<o.length;k++){if(_v(o[k],h)){y=!1,c=k;break}if(V0(o[k]))throw new I("Missing a "+h+" character to complete a CD arrow.",o[k]);f[b].body.push(o[k])}if(y)throw new I("Missing a "+h+" character to complete a CD arrow.",o[c])}else throw new I('Expected one of "<>AV=|." after @',o[c]);var z=kv(h,f,t),O={type:"styling",body:[z],mode:"math",style:"display",resetFont:!0};i.push(O),l=W0()}a%2===0?i.push(l):i.shift(),i=[],s.push(i)}t.gullet.endGroup(),t.gullet.endGroup();var M=new Array(s[0].length).fill({type:"align",align:"c",pregap:.25,postgap:.25});return{type:"array",mode:"math",body:s,arraystretch:1,addJot:!0,rowGaps:[null],cols:M,colSeparationType:"CD",hLinesBeforeRow:new Array(s.length+1).fill([])}}H({type:"cdlabel",names:["\\\\cdleft","\\\\cdright"],numArgs:1,handler(t,e){var{parser:r,funcName:i}=t;return{type:"cdlabel",mode:r.mode,side:i.slice(4),label:e[0]}},htmlBuilder(t,e){var r=e.havingStyle(e.style.sup()),i=hs(ve(t.label,r,e),e);return i.classes.push("cd-label-"+t.side),i.style.bottom=L(.8-i.depth),i.height=0,i.depth=0,i},mathmlBuilder(t,e){var r=new R("mrow",[Se(t.label,e)]);return r=new R("mpadded",[r]),r.setAttribute("width","0"),t.side==="left"&&r.setAttribute("lspace","-1width"),r.setAttribute("voffset","0.7em"),r=new R("mstyle",[r]),r.setAttribute("displaystyle","false"),r.setAttribute("scriptlevel","1"),r}});H({type:"cdlabelparent",names:["\\\\cdparent"],numArgs:1,handler(t,e){var{parser:r}=t;return{type:"cdlabelparent",mode:r.mode,fragment:e[0]}},htmlBuilder(t,e){var r=hs(ve(t.fragment,e),e);return r.classes.push("cd-vert-arrow"),r},mathmlBuilder(t,e){return new R("mrow",[Se(t.fragment,e)])}});H({type:"textord",names:["\\@char"],numArgs:1,allowedInText:!0,handler(t,e){for(var{parser:r}=t,i=ae(e[0],"ordgroup"),s=i.body,a="",o=0;o<s.length;o++){var l=ae(s[o],"textord");a+=l.text}var c=parseInt(a),h;if(isNaN(c))throw new I("\\@char has non-numeric argument "+a);if(c<0||c>=1114111)throw new I("\\@char with invalid code point "+a);return c<=65535?h=String.fromCharCode(c):(c-=65536,h=String.fromCharCode((c>>10)+55296,(c&1023)+56320)),{type:"textord",mode:r.mode,text:h}}});var zv=(t,e)=>{var r=He(t.body,e.withColor(t.color),!1);return Mr(r)},$v=(t,e)=>{var r=$t(t.body,e.withColor(t.color)),i=new R("mstyle",r);return i.setAttribute("mathcolor",t.color),i};H({type:"color",names:["\\textcolor"],numArgs:2,allowedInText:!0,argTypes:["color","original"],handler(t,e){var{parser:r}=t,i=ae(e[0],"color-token").color,s=e[1];return{type:"color",mode:r.mode,color:i,body:Ie(s)}},htmlBuilder:zv,mathmlBuilder:$v});H({type:"color",names:["\\color"],numArgs:1,allowedInText:!0,argTypes:["color"],handler(t,e){var{parser:r,breakOnTokenText:i}=t,s=ae(e[0],"color-token").color;r.gullet.macros.set("\\current@color",s);var a=r.parseExpression(!0,i);return{type:"color",mode:r.mode,color:s,body:a}}});H({type:"cr",names:["\\\\"],numArgs:0,numOptionalArgs:0,allowedInText:!0,handler(t,e,r){var{parser:i}=t,s=i.gullet.future().text==="["?i.parseSizeGroup(!0):null,a=!i.settings.displayMode||!i.settings.useStrictBehavior("newLineInDisplayMode","In LaTeX, \\\\ or \\newline does nothing in display mode");return{type:"cr",mode:i.mode,newLine:a,size:s&&ae(s,"size").value}},htmlBuilder(t,e){var r=D(["mspace"],[],e);return t.newLine&&(r.classes.push("newline"),t.size&&(r.style.marginTop=L(Pe(t.size,e)))),r},mathmlBuilder(t,e){var r=new R("mspace");return t.newLine&&(r.setAttribute("linebreak","newline"),t.size&&r.setAttribute("height",L(Pe(t.size,e)))),r}});var hl={"\\global":"\\global","\\long":"\\\\globallong","\\\\globallong":"\\\\globallong","\\def":"\\gdef","\\gdef":"\\gdef","\\edef":"\\xdef","\\xdef":"\\xdef","\\let":"\\\\globallet","\\futurelet":"\\\\globalfuture"},Lu=t=>{var e=t.text;if(/^(?:[\\{}$&#^_]|EOF)$/.test(e))throw new I("Expected a control sequence",t);return e},Tv=t=>{var e=t.gullet.popToken();return e.text==="="&&(e=t.gullet.popToken(),e.text===" "&&(e=t.gullet.popToken())),e},Bu=(t,e,r,i)=>{var s=t.gullet.macros.get(r.text);s==null&&(r.noexpand=!0,s={tokens:[r],numArgs:0,unexpandable:!t.gullet.isExpandable(r.text)}),t.gullet.macros.set(e,s,i)};H({type:"internal",names:["\\global","\\long","\\\\globallong"],numArgs:0,allowedInText:!0,handler(t){var{parser:e,funcName:r}=t;e.consumeSpaces();var i=e.fetch();if(hl[i.text])return(r==="\\global"||r==="\\\\globallong")&&(i.text=hl[i.text]),ae(e.parseFunction(),"internal");throw new I("Invalid token after macro prefix",i)}});H({type:"internal",names:["\\def","\\gdef","\\edef","\\xdef"],numArgs:0,allowedInText:!0,primitive:!0,handler(t){var{parser:e,funcName:r}=t,i=e.gullet.popToken(),s=i.text;if(/^(?:[\\{}$&#^_]|EOF)$/.test(s))throw new I("Expected a control sequence",i);for(var a=0,o,l=[[]];e.gullet.future().text!=="{";)if(i=e.gullet.popToken(),i.text==="#"){if(e.gullet.future().text==="{"){o=e.gullet.future(),l[a].push("{");break}if(i=e.gullet.popToken(),!/^[1-9]$/.test(i.text))throw new I('Invalid argument number "'+i.text+'"');if(parseInt(i.text)!==a+1)throw new I('Argument number "'+i.text+'" out of order');a++,l.push([])}else{if(i.text==="EOF")throw new I("Expected a macro definition");l[a].push(i.text)}var{tokens:c}=e.gullet.consumeArg();return o&&c.unshift(o),(r==="\\edef"||r==="\\xdef")&&(c=e.gullet.expandTokens(c),c.reverse()),e.gullet.macros.set(s,{tokens:c,numArgs:a,delimiters:l},r===hl[r]),{type:"internal",mode:e.mode}}});H({type:"internal",names:["\\let","\\\\globallet"],numArgs:0,allowedInText:!0,primitive:!0,handler(t){var{parser:e,funcName:r}=t,i=Lu(e.gullet.popToken());e.gullet.consumeSpaces();var s=Tv(e);return Bu(e,i,s,r==="\\\\globallet"),{type:"internal",mode:e.mode}}});H({type:"internal",names:["\\futurelet","\\\\globalfuture"],numArgs:0,allowedInText:!0,primitive:!0,handler(t){var{parser:e,funcName:r}=t,i=Lu(e.gullet.popToken()),s=e.gullet.popToken(),a=e.gullet.popToken();return Bu(e,i,a,r==="\\\\globalfuture"),e.gullet.pushToken(a),e.gullet.pushToken(s),{type:"internal",mode:e.mode}}});var Xs=function(e,r,i){var s=Te.math[e]&&Te.math[e].replace,a=Jl(s||e,r,i);if(!a)throw new Error("Unsupported symbol "+e+" and font size "+r+".");return a},ic=function(e,r,i,s){var a=i.havingBaseStyle(r),o=D(s.concat(a.sizingClasses(i)),[e],i),l=a.sizeMultiplier/i.sizeMultiplier;return o.height*=l,o.depth*=l,o.maxFontSize=a.sizeMultiplier,o},Nu=function(e,r,i){var s=r.havingBaseStyle(i),a=(1-r.sizeMultiplier/s.sizeMultiplier)*r.fontMetrics().axisHeight;e.classes.push("delimcenter"),e.style.top=L(a),e.height-=a,e.depth+=a},Cv=function(e,r,i,s,a,o){var l=rt(e,"Main-Regular",a,s),c=ic(l,r,s,o);return Nu(c,s,r),c},Ev=function(e,r,i,s){return rt(e,"Size"+r+"-Regular",i,s)},Fu=function(e,r,i,s,a,o){var l=Ev(e,r,a,s),c=ic(D(["delimsizing","size"+r],[l],s),ie.TEXT,s,o);return i&&Nu(c,s,ie.TEXT),c},Cn=function(e,r,i){var s;r==="Size1-Regular"?s="delim-size1":s="delim-size4";var a=D(["delimsizinginner",s],[D([],[rt(e,r,i)])]);return{type:"elem",elem:a}},En=function(e,r,i){var s=sr["Size4-Regular"][e.charCodeAt(0)]?sr["Size4-Regular"][e.charCodeAt(0)][4]:sr["Size1-Regular"][e.charCodeAt(0)][4],a=new ei("inner",Dm(e,Math.round(1e3*r))),o=new $r([a],{width:L(s),height:L(r),style:"width:"+L(s),viewBox:"0 0 "+1e3*s+" "+Math.round(1e3*r),preserveAspectRatio:"xMinYMin"}),l=ti([],[o],i);return l.height=r,l.style.height=L(r),l.style.width=L(s),{type:"elem",elem:l}},pl=.008,Ga={type:"kern",size:-1*pl},Av=new Set(["|","\\lvert","\\rvert","\\vert"]),Mv=new Set(["\\|","\\lVert","\\rVert","\\Vert"]),Hu=function(e,r,i,s,a,o){var l,c,h,f,b="",y=0;l=h=f=e,c=null;var k="Size1-Regular";e==="\\uparrow"?h=f="⏐":e==="\\Uparrow"?h=f="‖":e==="\\downarrow"?l=h="⏐":e==="\\Downarrow"?l=h="‖":e==="\\updownarrow"?(l="\\uparrow",h="⏐",f="\\downarrow"):e==="\\Updownarrow"?(l="\\Uparrow",h="‖",f="\\Downarrow"):Av.has(e)?(h="∣",b="vert",y=333):Mv.has(e)?(h="∥",b="doublevert",y=556):e==="["||e==="\\lbrack"?(l="⎡",h="⎢",f="⎣",k="Size4-Regular",b="lbrack",y=667):e==="]"||e==="\\rbrack"?(l="⎤",h="⎥",f="⎦",k="Size4-Regular",b="rbrack",y=667):e==="\\lfloor"||e==="⌊"?(h=l="⎢",f="⎣",k="Size4-Regular",b="lfloor",y=667):e==="\\lceil"||e==="⌈"?(l="⎡",h=f="⎢",k="Size4-Regular",b="lceil",y=667):e==="\\rfloor"||e==="⌋"?(h=l="⎥",f="⎦",k="Size4-Regular",b="rfloor",y=667):e==="\\rceil"||e==="⌉"?(l="⎤",h=f="⎥",k="Size4-Regular",b="rceil",y=667):e==="("||e==="\\lparen"?(l="⎛",h="⎜",f="⎝",k="Size4-Regular",b="lparen",y=875):e===")"||e==="\\rparen"?(l="⎞",h="⎟",f="⎠",k="Size4-Regular",b="rparen",y=875):e==="\\{"||e==="\\lbrace"?(l="⎧",c="⎨",f="⎩",h="⎪",k="Size4-Regular"):e==="\\}"||e==="\\rbrace"?(l="⎫",c="⎬",f="⎭",h="⎪",k="Size4-Regular"):e==="\\lgroup"||e==="⟮"?(l="⎧",f="⎩",h="⎪",k="Size4-Regular"):e==="\\rgroup"||e==="⟯"?(l="⎫",f="⎭",h="⎪",k="Size4-Regular"):e==="\\lmoustache"||e==="⎰"?(l="⎧",f="⎭",h="⎪",k="Size4-Regular"):(e==="\\rmoustache"||e==="⎱")&&(l="⎫",f="⎩",h="⎪",k="Size4-Regular");var z=Xs(l,k,a),O=z.height+z.depth,M=Xs(h,k,a),N=M.height+M.depth,j=Xs(f,k,a),J=j.height+j.depth,V=0,K=1;if(c!==null){var ee=Xs(c,k,a);V=ee.height+ee.depth,K=2}var re=O+J+V,ne=Math.max(0,Math.ceil((r-re)/(K*N))),le=re+ne*K*N,We=s.fontMetrics().axisHeight;i&&(We*=s.sizeMultiplier);var Ne=le/2-We,ze=[];if(b.length>0){var Tt=le-O-J,Ct=Math.round(le*1e3),ft=Om(b,Math.round(Tt*1e3)),mt=new ei(b,ft),Yt=L(y/1e3),br=L(Ct/1e3),Ts=new $r([mt],{width:Yt,height:br,viewBox:"0 0 "+y+" "+Ct}),Zt=ti([],[Ts],s);Zt.height=Ct/1e3,Zt.style.width=Yt,Zt.style.height=br,ze.push({type:"elem",elem:Zt})}else{if(ze.push(Cn(f,k,a)),ze.push(Ga),c===null){var Jt=le-O-J+2*pl;ze.push(En(h,Jt,s))}else{var be=(le-O-J-V)/2+2*pl;ze.push(En(h,be,s)),ze.push(Ga),ze.push(Cn(c,k,a)),ze.push(Ga),ze.push(En(h,be,s))}ze.push(Ga),ze.push(Cn(l,k,a))}var vt=s.havingBaseStyle(ie.TEXT),Ui=me({positionType:"bottom",positionData:Ne,children:ze});return ic(D(["delimsizing","mult"],[Ui],vt),ie.TEXT,s,o)},An=80,Mn=.08,Pn=function(e,r,i,s,a){var o=Pm(e,s,i),l=new ei(e,o),c=new $r([l],{width:"400em",height:L(r),viewBox:"0 0 400000 "+i,preserveAspectRatio:"xMinYMin slice"});return ti(["hide-tail"],[c],a)},Pv=function(e,r){var i=r.havingBaseSizing(),s=Vu("\\surd",e*i.sizeMultiplier,Wu,i),a=i.sizeMultiplier,o=Math.max(0,r.minRuleThickness-r.fontMetrics().sqrtRuleThickness),l,c,h,f,b;return s.type==="small"?(f=1e3+1e3*o+An,e<1?a=1:e<1.4&&(a=.7),c=(1+o+Mn)/a,h=(1+o)/a,l=Pn("sqrtMain",c,f,o,r),l.style.minWidth="0.853em",b=.833/a):s.type==="large"?(f=(1e3+An)*Qs[s.size],h=(Qs[s.size]+o)/a,c=(Qs[s.size]+o+Mn)/a,l=Pn("sqrtSize"+s.size,c,f,o,r),l.style.minWidth="1.02em",b=1/a):(c=e+o+Mn,h=e+o,f=Math.floor(1e3*e+o)+An,l=Pn("sqrtTall",c,f,o,r),l.style.minWidth="0.742em",b=1.056),l.height=h,l.style.height=L(c),{span:l,advanceWidth:b,ruleWidth:(r.fontMetrics().sqrtRuleThickness+o)*a}},qu=new Set(["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","⌊","⌋","\\lceil","\\rceil","⌈","⌉","\\surd"]),Dv=new Set(["\\uparrow","\\downarrow","\\updownarrow","\\Uparrow","\\Downarrow","\\Updownarrow","|","\\|","\\vert","\\Vert","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","⟮","⟯","\\lmoustache","\\rmoustache","⎰","⎱"]),Uu=new Set(["<",">","\\langle","\\rangle","/","\\backslash","\\lt","\\gt"]),Qs=[0,1.2,1.8,2.4,3],ju=function(e,r,i,s,a){if(e==="<"||e==="\\lt"||e==="⟨"?e="\\langle":(e===">"||e==="\\gt"||e==="⟩")&&(e="\\rangle"),qu.has(e)||Uu.has(e))return Fu(e,r,!1,i,s,a);if(Dv.has(e))return Hu(e,Qs[r],!1,i,s,a);throw new I("Illegal delimiter: '"+e+"'")},Ov=[{type:"small",style:ie.SCRIPTSCRIPT},{type:"small",style:ie.SCRIPT},{type:"small",style:ie.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4}],Iv=[{type:"small",style:ie.SCRIPTSCRIPT},{type:"small",style:ie.SCRIPT},{type:"small",style:ie.TEXT},{type:"stack"}],Wu=[{type:"small",style:ie.SCRIPTSCRIPT},{type:"small",style:ie.SCRIPT},{type:"small",style:ie.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4},{type:"stack"}],Rv=function(e){if(e.type==="small")return"Main-Regular";if(e.type==="large")return"Size"+e.size+"-Regular";if(e.type==="stack")return"Size4-Regular";var r=e.type;throw new Error("Add support for delim type '"+r+"' here.")},Vu=function(e,r,i,s){for(var a=Math.min(2,3-s.style.size),o=a;o<i.length;o++){var l=i[o];if(l.type==="stack")break;var c=Xs(e,Rv(l),"math"),h=c.height+c.depth;if(l.type==="small"){var f=s.havingBaseStyle(l.style);h*=f.sizeMultiplier}if(h>r)return l}return i[i.length-1]},fl=function(e,r,i,s,a,o){e==="<"||e==="\\lt"||e==="⟨"?e="\\langle":(e===">"||e==="\\gt"||e==="⟩")&&(e="\\rangle");var l;Uu.has(e)?l=Ov:qu.has(e)?l=Wu:l=Iv;var c=Vu(e,r,l,s);return c.type==="small"?Cv(e,c.style,i,s,a,o):c.type==="large"?Fu(e,c.size,i,s,a,o):Hu(e,r,i,s,a,o)},Dn=function(e,r,i,s,a,o){var l=s.fontMetrics().axisHeight*s.sizeMultiplier,c=901,h=5/s.fontMetrics().ptPerEm,f=Math.max(r-l,i+l),b=Math.max(f/500*c,2*f-h);return fl(e,b,!0,s,a,o)},G0={"\\bigl":{mclass:"mopen",size:1},"\\Bigl":{mclass:"mopen",size:2},"\\biggl":{mclass:"mopen",size:3},"\\Biggl":{mclass:"mopen",size:4},"\\bigr":{mclass:"mclose",size:1},"\\Bigr":{mclass:"mclose",size:2},"\\biggr":{mclass:"mclose",size:3},"\\Biggr":{mclass:"mclose",size:4},"\\bigm":{mclass:"mrel",size:1},"\\Bigm":{mclass:"mrel",size:2},"\\biggm":{mclass:"mrel",size:3},"\\Biggm":{mclass:"mrel",size:4},"\\big":{mclass:"mord",size:1},"\\Big":{mclass:"mord",size:2},"\\bigg":{mclass:"mord",size:3},"\\Bigg":{mclass:"mord",size:4}},Lv=new Set(["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","⌊","⌋","\\lceil","\\rceil","⌈","⌉","<",">","\\langle","⟨","\\rangle","⟩","\\lt","\\gt","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","⟮","⟯","\\lmoustache","\\rmoustache","⎰","⎱","/","\\backslash","|","\\vert","\\|","\\Vert","\\uparrow","\\Uparrow","\\downarrow","\\Downarrow","\\updownarrow","\\Updownarrow","."]);function X0(t){return"isMiddle"in t}function Bo(t,e){var r=Ro(t);if(r&&Lv.has(r.text))return r;throw r?new I("Invalid delimiter '"+r.text+"' after '"+e.funcName+"'",t):new I("Invalid delimiter type '"+t.type+"'",t)}H({type:"delimsizing",names:["\\bigl","\\Bigl","\\biggl","\\Biggl","\\bigr","\\Bigr","\\biggr","\\Biggr","\\bigm","\\Bigm","\\biggm","\\Biggm","\\big","\\Big","\\bigg","\\Bigg"],numArgs:1,argTypes:["primitive"],handler:(t,e)=>{var r=Bo(e[0],t);return{type:"delimsizing",mode:t.parser.mode,size:G0[t.funcName].size,mclass:G0[t.funcName].mclass,delim:r.text}},htmlBuilder:(t,e)=>t.delim==="."?D([t.mclass]):ju(t.delim,t.size,e,t.mode,[t.mclass]),mathmlBuilder:t=>{var e=[];t.delim!=="."&&e.push(Dt(t.delim,t.mode));var r=new R("mo",e);t.mclass==="mopen"||t.mclass==="mclose"?r.setAttribute("fence","true"):r.setAttribute("fence","false"),r.setAttribute("stretchy","true");var i=L(Qs[t.size]);return r.setAttribute("minsize",i),r.setAttribute("maxsize",i),r}});function K0(t){if(!t.body)throw new Error("Bug: The leftright ParseNode wasn't fully parsed.")}H({type:"leftright-right",names:["\\right"],numArgs:1,primitive:!0,handler:(t,e)=>{var r=t.parser.gullet.macros.get("\\current@color");if(r&&typeof r!="string")throw new I("\\current@color set to non-string in \\right");return{type:"leftright-right",mode:t.parser.mode,delim:Bo(e[0],t).text,color:r}}});H({type:"leftright",names:["\\left"],numArgs:1,primitive:!0,handler:(t,e)=>{var r=Bo(e[0],t),i=t.parser;++i.leftrightDepth;var s=i.parseExpression(!1);--i.leftrightDepth,i.expect("\\right",!1);var a=ae(i.parseFunction(),"leftright-right");return{type:"leftright",mode:i.mode,body:s,left:r.text,right:a.delim,rightColor:a.color}},htmlBuilder:(t,e)=>{K0(t);for(var r=He(t.body,e,!0,["mopen","mclose"]),i=0,s=0,a=!1,o=0;o<r.length;o++){var l=r[o];X0(l)?a=!0:(i=Math.max(r[o].height,i),s=Math.max(r[o].depth,s))}i*=e.sizeMultiplier,s*=e.sizeMultiplier;var c;if(t.left==="."?c=la(e,["mopen"]):c=Dn(t.left,i,s,e,t.mode,["mopen"]),r.unshift(c),a)for(var h=1;h<r.length;h++){var f=r[h];if(X0(f)){var b=f.isMiddle;r[h]=Dn(b.delim,i,s,b.options,t.mode,[])}}var y;if(t.right===".")y=la(e,["mclose"]);else{var k=t.rightColor?e.withColor(t.rightColor):e;y=Dn(t.right,i,s,k,t.mode,["mclose"])}return r.push(y),D(["minner"],r,e)},mathmlBuilder:(t,e)=>{K0(t);var r=$t(t.body,e);if(t.left!=="."){var i=new R("mo",[Dt(t.left,t.mode)]);i.setAttribute("fence","true"),r.unshift(i)}if(t.right!=="."){var s=new R("mo",[Dt(t.right,t.mode)]);s.setAttribute("fence","true"),t.rightColor&&s.setAttribute("mathcolor",t.rightColor),r.push(s)}return tc(r)}});H({type:"middle",names:["\\middle"],numArgs:1,primitive:!0,handler:(t,e)=>{var r=Bo(e[0],t);if(!t.parser.leftrightDepth)throw new I("\\middle without preceding \\left",r);return{type:"middle",mode:t.parser.mode,delim:r.text}},htmlBuilder:(t,e)=>{var r;return t.delim==="."?r=la(e,[]):(r=ju(t.delim,1,e,t.mode,[]),r.isMiddle={delim:t.delim,options:e}),r},mathmlBuilder:(t,e)=>{var r=t.delim==="\\vert"||t.delim==="|"?Dt("|","text"):Dt(t.delim,t.mode),i=new R("mo",[r]);return i.setAttribute("fence","true"),i.setAttribute("lspace","0.05em"),i.setAttribute("rspace","0.05em"),i}});var Bv=(t,e)=>{var r=hs(ve(t.body,e),e),i=t.label.slice(1),s=e.sizeMultiplier,a,o,l=Er(t.body);if(i==="sout")a=D(["stretchy","sout"]),a.height=e.fontMetrics().defaultRuleThickness/s,o=-.5*e.fontMetrics().xHeight;else if(i==="phase"){var c=Pe({number:.6,unit:"pt"},e),h=Pe({number:.35,unit:"ex"},e),f=e.havingBaseSizing();s=s/f.sizeMultiplier;var b=r.height+r.depth+c+h;r.style.paddingLeft=L(b/2+c);var y=Math.floor(1e3*b*s),k=Am(y),z=new $r([new ei("phase",k)],{width:"400em",height:L(y/1e3),viewBox:"0 0 400000 "+y,preserveAspectRatio:"xMinYMin slice"});a=ti(["hide-tail"],[z],e),a.style.height=L(b),o=r.depth+c+h}else{/cancel/.test(i)?l||r.classes.push("cancel-pad"):i==="angl"?r.classes.push("anglpad"):r.classes.push("boxpad");var O,M,N=0;/box/.test(i)?(N=Math.max(e.fontMetrics().fboxrule,e.minRuleThickness),O=e.fontMetrics().fboxsep+(i==="colorbox"?0:N),M=O):i==="angl"?(N=Math.max(e.fontMetrics().defaultRuleThickness,e.minRuleThickness),O=4*N,M=Math.max(0,.25-r.depth)):(O=l?.2:0,M=O),a=pv(r,i,O,M,e),/fbox|boxed|fcolorbox/.test(i)?(a.style.borderStyle="solid",a.style.borderWidth=L(N)):i==="angl"&&N!==.049&&(a.style.borderTopWidth=L(N),a.style.borderRightWidth=L(N)),o=r.depth+M,t.backgroundColor&&(a.style.backgroundColor=t.backgroundColor,t.borderColor&&(a.style.borderColor=t.borderColor))}var j;if(t.backgroundColor)j=me({positionType:"individualShift",children:[{type:"elem",elem:a,shift:o},{type:"elem",elem:r,shift:0}]});else{var J=/cancel|phase/.test(i)?["svg-align"]:[];j=me({positionType:"individualShift",children:[{type:"elem",elem:r,shift:0},{type:"elem",elem:a,shift:o,wrapperClasses:J}]})}return/cancel/.test(i)&&(j.height=r.height,j.depth=r.depth),/cancel/.test(i)&&!l?D(["mord","cancel-lap"],[j],e):D(["mord"],[j],e)},Nv=(t,e)=>{var r,i=new R(t.label.includes("colorbox")?"mpadded":"menclose",[Se(t.body,e)]);switch(t.label){case"\\cancel":i.setAttribute("notation","updiagonalstrike");break;case"\\bcancel":i.setAttribute("notation","downdiagonalstrike");break;case"\\phase":i.setAttribute("notation","phasorangle");break;case"\\sout":i.setAttribute("notation","horizontalstrike");break;case"\\fbox":i.setAttribute("notation","box");break;case"\\angl":i.setAttribute("notation","actuarial");break;case"\\fcolorbox":case"\\colorbox":if(r=e.fontMetrics().fboxsep*e.fontMetrics().ptPerEm,i.setAttribute("width","+"+2*r+"pt"),i.setAttribute("height","+"+2*r+"pt"),i.setAttribute("lspace",r+"pt"),i.setAttribute("voffset",r+"pt"),t.label==="\\fcolorbox"){var s=Math.max(e.fontMetrics().fboxrule,e.minRuleThickness);i.setAttribute("style","border: "+L(s)+" solid "+t.borderColor)}break;case"\\xcancel":i.setAttribute("notation","updiagonalstrike downdiagonalstrike");break}return t.backgroundColor&&i.setAttribute("mathbackground",t.backgroundColor),i};H({type:"enclose",names:["\\colorbox"],numArgs:2,allowedInText:!0,argTypes:["color","hbox"],handler(t,e,r){var{parser:i,funcName:s}=t,a=ae(e[0],"color-token").color,o=e[1];return{type:"enclose",mode:i.mode,label:s,backgroundColor:a,body:o}},htmlBuilder:Bv,mathmlBuilder:Nv});H({type:"enclose",names:["\\fcolorbox"],numArgs:3,allowedInText:!0,argTypes:["color","color","hbox"],handler(t,e,r){var{parser:i,funcName:s}=t,a=ae(e[0],"color-token").color,o=ae(e[1],"color-token").color,l=e[2];return{type:"enclose",mode:i.mode,label:s,backgroundColor:o,borderColor:a,body:l}}});H({type:"enclose",names:["\\fbox"],numArgs:1,argTypes:["hbox"],allowedInText:!0,handler(t,e){var{parser:r}=t;return{type:"enclose",mode:r.mode,label:"\\fbox",body:e[0]}}});H({type:"enclose",names:["\\cancel","\\bcancel","\\xcancel","\\phase"],numArgs:1,handler(t,e){var{parser:r,funcName:i}=t,s=e[0];return{type:"enclose",mode:r.mode,label:i,body:s}}});H({type:"enclose",names:["\\sout"],numArgs:1,allowedInText:!0,handler(t,e){var{parser:r,funcName:i}=t;r.mode==="math"&&r.settings.reportNonstrict("mathVsSout","LaTeX's \\sout works only in text mode");var s=e[0];return{type:"enclose",mode:r.mode,label:i,body:s}}});H({type:"enclose",names:["\\angl"],numArgs:1,argTypes:["hbox"],allowedInText:!1,handler(t,e){var{parser:r}=t;return{type:"enclose",mode:r.mode,label:"\\angl",body:e[0]}}});var Gu={};function dr(t){for(var{type:e,names:r,props:i,handler:s,htmlBuilder:a,mathmlBuilder:o}=t,l={type:e,numArgs:i.numArgs||0,allowedInText:!1,numOptionalArgs:0,handler:s},c=0;c<r.length;++c)Gu[r[c]]=l;a&&(oa[e]=a),o&&(na[e]=o)}var Xu={};function m(t,e){Xu[t]=e}class ut{constructor(e,r,i){this.lexer=void 0,this.start=void 0,this.end=void 0,this.lexer=e,this.start=r,this.end=i}static range(e,r){return r?!e||!e.loc||!r.loc||e.loc.lexer!==r.loc.lexer?null:new ut(e.loc.lexer,e.loc.start,r.loc.end):e&&e.loc}}class gt{constructor(e,r){this.text=void 0,this.loc=void 0,this.noexpand=void 0,this.treatAsRelax=void 0,this.text=e,this.loc=r}range(e,r){return new gt(r,ut.range(this,e))}}function Y0(t){var e=[];t.consumeSpaces();var r=t.fetch().text;for(r==="\\relax"&&(t.consume(),t.consumeSpaces(),r=t.fetch().text);r==="\\hline"||r==="\\hdashline";)t.consume(),e.push(r==="\\hdashline"),t.consumeSpaces(),r=t.fetch().text;return e}var No=t=>{var e=t.parser.settings;if(!e.displayMode)throw new I("{"+t.envName+"} can be used only in display mode.")},Fv=new Set(["gather","gather*"]);function sc(t){if(!t.includes("ed"))return!t.includes("*")}function oi(t,e,r){var{hskipBeforeAndAfter:i,addJot:s,cols:a,arraystretch:o,colSeparationType:l,autoTag:c,singleRow:h,emptySingleRow:f,maxNumCols:b,leqno:y}=e;if(t.gullet.beginGroup(),h||t.gullet.macros.set("\\cr","\\\\\\relax"),!o){var k=t.gullet.expandMacroAsText("\\arraystretch");if(k==null)o=1;else if(o=parseFloat(k),!o||o<0)throw new I("Invalid \\arraystretch: "+k)}t.gullet.beginGroup();var z=[],O=[z],M=[],N=[],j=c!=null?[]:void 0;function J(){c&&t.gullet.macros.set("\\@eqnsw","1",!0)}function V(){j&&(t.gullet.macros.get("\\df@tag")?(j.push(t.subparse([new gt("\\df@tag")])),t.gullet.macros.set("\\df@tag",void 0,!0)):j.push(!!c&&t.gullet.macros.get("\\@eqnsw")==="1"))}for(J(),N.push(Y0(t));;){var K=t.parseExpression(!1,h?"\\end":"\\\\");t.gullet.endGroup(),t.gullet.beginGroup();var ee={type:"ordgroup",mode:t.mode,body:K};r&&(ee={type:"styling",mode:t.mode,style:r,resetFont:!0,body:[ee]}),z.push(ee);var re=t.fetch().text;if(re==="&"){if(b&&z.length===b){if(h||l)throw new I("Too many tab characters: &",t.nextToken);t.settings.reportNonstrict("textEnv","Too few columns specified in the {array} column argument.")}t.consume()}else if(re==="\\end"){V(),z.length===1&&ee.type==="styling"&&ee.body.length===1&&ee.body[0].type==="ordgroup"&&ee.body[0].body.length===0&&(O.length>1||!f)&&O.pop(),N.length<O.length+1&&N.push([]);break}else if(re==="\\\\"){t.consume();var ne=void 0;t.gullet.future().text!==" "&&(ne=t.parseSizeGroup(!0)),M.push(ne?ne.value:null),V(),N.push(Y0(t)),z=[],O.push(z),J()}else throw new I("Expected & or \\\\ or \\cr or \\end",t.nextToken)}return t.gullet.endGroup(),t.gullet.endGroup(),{type:"array",mode:t.mode,addJot:s,arraystretch:o,body:O,cols:a,rowGaps:M,hskipBeforeAndAfter:i,hLinesBeforeRow:N,colSeparationType:l,tags:j,leqno:y}}function ac(t){return t.slice(0,1)==="d"?"display":"text"}var ur=function(e,r){var i,s,a=e.body.length,o=e.hLinesBeforeRow,l=0,c=new Array(a),h=[],f=Math.max(r.fontMetrics().arrayRuleWidth,r.minRuleThickness),b=1/r.fontMetrics().ptPerEm,y=5*b;if(e.colSeparationType&&e.colSeparationType==="small"){var k=r.havingStyle(ie.SCRIPT).sizeMultiplier;y=.2778*(k/r.sizeMultiplier)}var z=e.colSeparationType==="CD"?Pe({number:3,unit:"ex"},r):12*b,O=3*b,M=e.arraystretch*z,N=.7*M,j=.3*M,J=0;function V(yr){for(var wr=0;wr<yr.length;++wr)wr>0&&(J+=.25),h.push({pos:J,isDashed:yr[wr]})}for(V(o[0]),i=0;i<e.body.length;++i){var K=e.body[i],ee=N,re=j;l<K.length&&(l=K.length);var ne={cells:new Array(K.length),height:0,depth:0,pos:0};for(s=0;s<K.length;++s){var le=ve(K[s],r);re<le.depth&&(re=le.depth),ee<le.height&&(ee=le.height),ne.cells[s]=le}var We=e.rowGaps[i],Ne=0;We&&(Ne=Pe(We,r),Ne>0&&(Ne+=j,re<Ne&&(re=Ne),Ne=0)),e.addJot&&i<e.body.length-1&&(re+=O),ne.height=ee,ne.depth=re,J+=ee,ne.pos=J,J+=re+Ne,c[i]=ne,V(o[i+1])}var ze=J/2+r.fontMetrics().axisHeight,Tt=e.cols||[],Ct=[],ft,mt,Yt=[];if(e.tags&&e.tags.some(yr=>yr))for(i=0;i<a;++i){var br=c[i],Ts=br.pos-ze,Zt=e.tags[i],Jt=void 0;Zt===!0?Jt=D(["eqn-num"],[],r):Zt===!1?Jt=D([],[],r):Jt=D([],He(Zt,r,!0),r),Jt.depth=br.depth,Jt.height=br.height,Yt.push({type:"elem",elem:Jt,shift:Ts})}for(s=0,mt=0;s<l||mt<Tt.length;++s,++mt){for(var be,vt=Tt[mt],Ui=!0;((Sa=vt)==null?void 0:Sa.type)==="separator";){var Sa;if(Ui||(ft=D(["arraycolsep"],[]),ft.style.width=L(r.fontMetrics().doubleRuleSep),Ct.push(ft)),vt.separator==="|"||vt.separator===":"){var Vo=vt.separator==="|"?"solid":"dashed",Dr=D(["vertical-separator"],[],r);Dr.style.height=L(J),Dr.style.borderRightWidth=L(f),Dr.style.borderRightStyle=Vo,Dr.style.margin="0 "+L(-f/2);var za=J-ze;za&&(Dr.style.verticalAlign=L(-za)),Ct.push(Dr)}else throw new I("Invalid separator type: "+vt.separator);mt++,vt=Tt[mt],Ui=!1}if(!(s>=l)){var gr=void 0;if(s>0||e.hskipBeforeAndAfter){var $a,Cs;gr=($a=(Cs=vt)==null?void 0:Cs.pregap)!=null?$a:y,gr!==0&&(ft=D(["arraycolsep"],[]),ft.style.width=L(gr),Ct.push(ft))}var _e=[];for(i=0;i<a;++i){var Or=c[i],ge=Or.cells[s];if(ge){var Es=Or.pos-ze;ge.depth=Or.depth,ge.height=Or.height,_e.push({type:"elem",elem:ge,shift:Es})}}var $e=me({positionType:"individualShift",children:_e}),hi=D(["col-align-"+(((be=vt)==null?void 0:be.align)||"c")],[$e]);if(Ct.push(hi),s<l-1||e.hskipBeforeAndAfter){var As,Nt;gr=(As=(Nt=vt)==null?void 0:Nt.postgap)!=null?As:y,gr!==0&&(ft=D(["arraycolsep"],[]),ft.style.width=L(gr),Ct.push(ft))}}}var pi=D(["mtable"],Ct);if(h.length>0){for(var Ms=us("hline",r,f),Ta=us("hdashline",r,f),ji=[{type:"elem",elem:pi,shift:0}];h.length>0;){var Ft=h.pop(),Ht=Ft.pos-ze;Ft.isDashed?ji.push({type:"elem",elem:Ta,shift:Ht}):ji.push({type:"elem",elem:Ms,shift:Ht})}pi=me({positionType:"individualShift",children:ji})}if(Yt.length===0)return D(["mord"],[pi],r);var xr=me({positionType:"individualShift",children:Yt}),Ps=D(["tag"],[xr],r);return Mr([pi,Ps])},Hv={c:"center ",l:"left ",r:"right "},hr=function(e,r){for(var i=[],s=new R("mtd",[],["mtr-glue"]),a=new R("mtd",[],["mml-eqn-num"]),o=0;o<e.body.length;o++){for(var l=e.body[o],c=[],h=0;h<l.length;h++)c.push(new R("mtd",[Se(l[h],r)]));e.tags&&e.tags[o]&&(c.unshift(s),c.push(s),e.leqno?c.unshift(a):c.push(a)),i.push(new R("mtr",c))}var f=new R("mtable",i),b=e.arraystretch===.5?.1:.16+e.arraystretch-1+(e.addJot?.09:0);f.setAttribute("rowspacing",L(b));var y="",k="";if(e.cols&&e.cols.length>0){var z=e.cols,O="",M=!1,N=0,j=z.length;z[0].type==="separator"&&(y+="top ",N=1),z[z.length-1].type==="separator"&&(y+="bottom ",j-=1);for(var J=N;J<j;J++){var V=z[J];V.type==="align"?(k+=Hv[V.align],M&&(O+="none "),M=!0):V.type==="separator"&&M&&(O+=V.separator==="|"?"solid ":"dashed ",M=!1)}f.setAttribute("columnalign",k.trim()),/[sd]/.test(O)&&f.setAttribute("columnlines",O.trim())}if(e.colSeparationType==="align"){for(var K=e.cols||[],ee="",re=1;re<K.length;re++)ee+=re%2?"0em ":"1em ";f.setAttribute("columnspacing",ee.trim())}else e.colSeparationType==="alignat"||e.colSeparationType==="gather"?f.setAttribute("columnspacing","0em"):e.colSeparationType==="small"?f.setAttribute("columnspacing","0.2778em"):e.colSeparationType==="CD"?f.setAttribute("columnspacing","0.5em"):f.setAttribute("columnspacing","1em");var ne="",le=e.hLinesBeforeRow;y+=le[0].length>0?"left ":"",y+=le[le.length-1].length>0?"right ":"";for(var We=1;We<le.length-1;We++)ne+=le[We].length===0?"none ":le[We][0]?"dashed ":"solid ";return/[sd]/.test(ne)&&f.setAttribute("rowlines",ne.trim()),y!==""&&(f=new R("menclose",[f]),f.setAttribute("notation",y.trim())),e.arraystretch&&e.arraystretch<1&&(f=new R("mstyle",[f]),f.setAttribute("scriptlevel","1")),f},Ku=function(e,r){e.envName.includes("ed")||No(e);var i=[],s=e.envName==="split",a=oi(e.parser,{cols:i,addJot:!0,autoTag:s?void 0:sc(e.envName),emptySingleRow:!0,colSeparationType:e.envName.includes("at")?"alignat":"align",maxNumCols:s?2:void 0,leqno:e.parser.settings.leqno},"display"),o=0,l=0,c={type:"ordgroup",mode:e.mode,body:[]};if(r[0]&&r[0].type==="ordgroup"){for(var h="",f=0;f<r[0].body.length;f++){var b=ae(r[0].body[f],"textord");h+=b.text}o=Number(h),l=o*2}var y=!l;a.body.forEach(function(M){for(var N=1;N<M.length;N+=2){var j=ae(M[N],"styling"),J=ae(j.body[0],"ordgroup");J.body.unshift(c)}if(y)l<M.length&&(l=M.length);else{var V=M.length/2;if(o<V)throw new I("Too many math in a row: "+("expected "+o+", but got "+V),M[0])}});for(var k=0;k<l;++k){var z="r",O=0;k%2===1?z="l":k>0&&y&&(O=1),i[k]={type:"align",align:z,pregap:O,postgap:0}}return a.colSeparationType=y?"align":"alignat",a};dr({type:"array",names:["array","darray"],props:{numArgs:1},handler(t,e){var r=Ro(e[0]),i=r?[e[0]]:ae(e[0],"ordgroup").body,s=i.map(function(o){var l=Io(o),c=l.text;if("lcr".includes(c))return{type:"align",align:c};if(c==="|")return{type:"separator",separator:"|"};if(c===":")return{type:"separator",separator:":"};throw new I("Unknown column alignment: "+c,o)}),a={cols:s,hskipBeforeAndAfter:!0,maxNumCols:s.length};return oi(t.parser,a,ac(t.envName))},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["matrix","pmatrix","bmatrix","Bmatrix","vmatrix","Vmatrix","matrix*","pmatrix*","bmatrix*","Bmatrix*","vmatrix*","Vmatrix*"],props:{numArgs:0},handler(t){var e={matrix:null,pmatrix:["(",")"],bmatrix:["[","]"],Bmatrix:["\\{","\\}"],vmatrix:["|","|"],Vmatrix:["\\Vert","\\Vert"]}[t.envName.replace("*","")],r="c",i={hskipBeforeAndAfter:!1,cols:[{type:"align",align:r}]};if(t.envName.charAt(t.envName.length-1)==="*"){var s=t.parser;if(s.consumeSpaces(),s.fetch().text==="["){if(s.consume(),s.consumeSpaces(),r=s.fetch().text,!"lcr".includes(r))throw new I("Expected l or c or r",s.nextToken);s.consume(),s.consumeSpaces(),s.expect("]"),s.consume(),i.cols=[{type:"align",align:r}]}}var a=oi(t.parser,i,ac(t.envName)),o=Math.max(0,...a.body.map(l=>l.length));return a.cols=new Array(o).fill({type:"align",align:r}),e?{type:"leftright",mode:t.mode,body:[a],left:e[0],right:e[1],rightColor:void 0}:a},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["smallmatrix"],props:{numArgs:0},handler(t){var e={arraystretch:.5},r=oi(t.parser,e,"script");return r.colSeparationType="small",r},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["subarray"],props:{numArgs:1},handler(t,e){var r=Ro(e[0]),i=r?[e[0]]:ae(e[0],"ordgroup").body,s=i.map(function(l){var c=Io(l),h=c.text;if("lc".includes(h))return{type:"align",align:h};throw new I("Unknown column alignment: "+h,l)});if(s.length>1)throw new I("{subarray} can contain only one column");var a={cols:s,hskipBeforeAndAfter:!1,arraystretch:.5},o=oi(t.parser,a,"script");if(o.body.length>0&&o.body[0].length>1)throw new I("{subarray} can contain only one column");return o},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["cases","dcases","rcases","drcases"],props:{numArgs:0},handler(t){var e={arraystretch:1.2,cols:[{type:"align",align:"l",pregap:0,postgap:1},{type:"align",align:"l",pregap:0,postgap:0}]},r=oi(t.parser,e,ac(t.envName));return{type:"leftright",mode:t.mode,body:[r],left:t.envName.includes("r")?".":"\\{",right:t.envName.includes("r")?"\\}":".",rightColor:void 0}},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["align","align*","aligned","split"],props:{numArgs:0},handler:Ku,htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["gathered","gather","gather*"],props:{numArgs:0},handler(t){Fv.has(t.envName)&&No(t);var e={cols:[{type:"align",align:"c"}],addJot:!0,colSeparationType:"gather",autoTag:sc(t.envName),emptySingleRow:!0,leqno:t.parser.settings.leqno};return oi(t.parser,e,"display")},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["alignat","alignat*","alignedat"],props:{numArgs:1},handler:Ku,htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["equation","equation*"],props:{numArgs:0},handler(t){No(t);var e={autoTag:sc(t.envName),emptySingleRow:!0,singleRow:!0,maxNumCols:1,leqno:t.parser.settings.leqno};return oi(t.parser,e,"display")},htmlBuilder:ur,mathmlBuilder:hr});dr({type:"array",names:["CD"],props:{numArgs:0},handler(t){return No(t),Sv(t.parser)},htmlBuilder:ur,mathmlBuilder:hr});m("\\nonumber","\\gdef\\@eqnsw{0}");m("\\notag","\\nonumber");H({type:"text",names:["\\hline","\\hdashline"],numArgs:0,allowedInText:!0,allowedInMath:!0,handler(t,e){throw new I(t.funcName+" valid only within array environment")}});var Z0=Gu;H({type:"environment",names:["\\begin","\\end"],numArgs:1,argTypes:["text"],handler(t,e){var{parser:r,funcName:i}=t,s=e[0];if(s.type!=="ordgroup")throw new I("Invalid environment name",s);for(var a="",o=0;o<s.body.length;++o)a+=ae(s.body[o],"textord").text;if(i==="\\begin"){if(!Z0.hasOwnProperty(a))throw new I("No such environment: "+a,s);var l=Z0[a],{args:c,optArgs:h}=r.parseArguments("\\begin{"+a+"}",l),f={mode:r.mode,envName:a,parser:r},b=l.handler(f,c,h);r.expect("\\end",!1);var y=r.nextToken,k=ae(r.parseFunction(),"environment");if(k.name!==a)throw new I("Mismatch: \\begin{"+a+"} matched by \\end{"+k.name+"}",y);return b}return{type:"environment",mode:r.mode,name:a,nameGroup:s}}});var qv=(t,e)=>{var r=t.font,i=e.withFont(r);return ve(t.body,i)},Uv=(t,e)=>{var r=t.font,i=e.withFont(r);return Se(t.body,i)},J0={"\\Bbb":"\\mathbb","\\bold":"\\mathbf","\\frak":"\\mathfrak"};H({type:"font",names:["\\mathrm","\\mathit","\\mathbf","\\mathnormal","\\mathsfit","\\mathbb","\\mathcal","\\mathfrak","\\mathscr","\\mathsf","\\mathtt","\\Bbb","\\bold","\\frak"],numArgs:1,allowedInArgument:!0,handler:(t,e)=>{var{parser:r,funcName:i}=t,s=vo(e[0]),a=i in J0?J0[i]:i;return{type:"font",mode:r.mode,font:a.slice(1),body:s}},htmlBuilder:qv,mathmlBuilder:Uv});H({type:"mclass",names:["\\boldsymbol","\\bm"],numArgs:1,handler:(t,e)=>{var{parser:r}=t,i=e[0];return{type:"mclass",mode:r.mode,mclass:Lo(i),body:[{type:"font",mode:r.mode,font:"boldsymbol",body:i}],isCharacterBox:Er(i)}}});H({type:"font",names:["\\rm","\\sf","\\tt","\\bf","\\it","\\cal"],numArgs:0,allowedInText:!0,handler:(t,e)=>{var{parser:r,funcName:i,breakOnTokenText:s}=t,{mode:a}=r,o=r.parseExpression(!0,s);return{type:"font",mode:a,font:"math"+i.slice(1),body:{type:"ordgroup",mode:r.mode,body:o}}}});var jv=(t,e)=>{var r=e.style,i=r.fracNum(),s=r.fracDen(),a;a=e.havingStyle(i);var o=ve(t.numer,a,e);if(t.continued){var l=8.5/e.fontMetrics().ptPerEm,c=3.5/e.fontMetrics().ptPerEm;o.height=o.height<l?l:o.height,o.depth=o.depth<c?c:o.depth}a=e.havingStyle(s);var h=ve(t.denom,a,e),f,b,y;t.hasBarLine?(t.barSize?(b=Pe(t.barSize,e),f=us("frac-line",e,b)):f=us("frac-line",e),b=f.height,y=f.height):(f=null,b=0,y=e.fontMetrics().defaultRuleThickness);var k,z,O;r.size===ie.DISPLAY.size?(k=e.fontMetrics().num1,b>0?z=3*y:z=7*y,O=e.fontMetrics().denom1):(b>0?(k=e.fontMetrics().num2,z=y):(k=e.fontMetrics().num3,z=3*y),O=e.fontMetrics().denom2);var M;if(f){var j=e.fontMetrics().axisHeight;k-o.depth-(j+.5*b)<z&&(k+=z-(k-o.depth-(j+.5*b))),j-.5*b-(h.height-O)<z&&(O+=z-(j-.5*b-(h.height-O)));var J=-(j-.5*b);M=me({positionType:"individualShift",children:[{type:"elem",elem:h,shift:O},{type:"elem",elem:f,shift:J},{type:"elem",elem:o,shift:-k}]})}else{var N=k-o.depth-(h.height-O);N<z&&(k+=.5*(z-N),O+=.5*(z-N)),M=me({positionType:"individualShift",children:[{type:"elem",elem:h,shift:O},{type:"elem",elem:o,shift:-k}]})}a=e.havingStyle(r),M.height*=a.sizeMultiplier/e.sizeMultiplier,M.depth*=a.sizeMultiplier/e.sizeMultiplier;var V;r.size===ie.DISPLAY.size?V=e.fontMetrics().delim1:r.size===ie.SCRIPTSCRIPT.size?V=e.havingStyle(ie.SCRIPT).fontMetrics().delim2:V=e.fontMetrics().delim2;var K,ee;return t.leftDelim==null?K=la(e,["mopen"]):K=fl(t.leftDelim,V,!0,e.havingStyle(r),t.mode,["mopen"]),t.continued?ee=D([]):t.rightDelim==null?ee=la(e,["mclose"]):ee=fl(t.rightDelim,V,!0,e.havingStyle(r),t.mode,["mclose"]),D(["mord"].concat(a.sizingClasses(e)),[K,D(["mfrac"],[M]),ee],e)},Wv=(t,e)=>{var r=new R("mfrac",[Se(t.numer,e),Se(t.denom,e)]);if(!t.hasBarLine)r.setAttribute("linethickness","0px");else if(t.barSize){var i=Pe(t.barSize,e);r.setAttribute("linethickness",L(i))}if(t.leftDelim!=null||t.rightDelim!=null){var s=[];if(t.leftDelim!=null){var a=new R("mo",[new Re(t.leftDelim.replace("\\",""))]);a.setAttribute("fence","true"),s.push(a)}if(s.push(r),t.rightDelim!=null){var o=new R("mo",[new Re(t.rightDelim.replace("\\",""))]);o.setAttribute("fence","true"),s.push(o)}return tc(s)}return r},Yu=(t,e)=>{if(!e)return t;var r={type:"styling",mode:t.mode,style:e,body:[t]};return r};H({type:"genfrac",names:["\\cfrac","\\dfrac","\\frac","\\tfrac","\\dbinom","\\binom","\\tbinom","\\\\atopfrac","\\\\bracefrac","\\\\brackfrac"],numArgs:2,allowedInArgument:!0,handler:(t,e)=>{var{parser:r,funcName:i}=t,s=e[0],a=e[1],o,l=null,c=null;switch(i){case"\\cfrac":case"\\dfrac":case"\\frac":case"\\tfrac":o=!0;break;case"\\\\atopfrac":o=!1;break;case"\\dbinom":case"\\binom":case"\\tbinom":o=!1,l="(",c=")";break;case"\\\\bracefrac":o=!1,l="\\{",c="\\}";break;case"\\\\brackfrac":o=!1,l="[",c="]";break;default:throw new Error("Unrecognized genfrac command")}var h=i==="\\cfrac",f=null;return h||i.startsWith("\\d")?f="display":i.startsWith("\\t")&&(f="text"),Yu({type:"genfrac",mode:r.mode,numer:s,denom:a,continued:h,hasBarLine:o,leftDelim:l,rightDelim:c,barSize:null},f)},htmlBuilder:jv,mathmlBuilder:Wv});H({type:"infix",names:["\\over","\\choose","\\atop","\\brace","\\brack"],numArgs:0,infix:!0,handler(t){var{parser:e,funcName:r,token:i}=t,s;switch(r){case"\\over":s="\\frac";break;case"\\choose":s="\\binom";break;case"\\atop":s="\\\\atopfrac";break;case"\\brace":s="\\\\bracefrac";break;case"\\brack":s="\\\\brackfrac";break;default:throw new Error("Unrecognized infix genfrac command")}return{type:"infix",mode:e.mode,replaceWith:s,token:i}}});var Q0=["display","text","script","scriptscript"],ed=function(e){var r=null;return e.length>0&&(r=e,r=r==="."?null:r),r};H({type:"genfrac",names:["\\genfrac"],numArgs:6,allowedInArgument:!0,argTypes:["math","math","size","text","math","math"],handler(t,e){var{parser:r}=t,i=e[4],s=e[5],a=vo(e[0]),o=a.type==="atom"&&a.family==="open"?ed(a.text):null,l=vo(e[1]),c=l.type==="atom"&&l.family==="close"?ed(l.text):null,h=ae(e[2],"size"),f,b=null;h.isBlank?f=!0:(b=h.value,f=b.number>0);var y=null,k=e[3];if(k.type==="ordgroup"){if(k.body.length>0){var z=ae(k.body[0],"textord");y=Q0[Number(z.text)]}}else k=ae(k,"textord"),y=Q0[Number(k.text)];return Yu({type:"genfrac",mode:r.mode,numer:i,denom:s,continued:!1,hasBarLine:f,barSize:b,leftDelim:o,rightDelim:c},y)}});H({type:"infix",names:["\\above"],numArgs:1,argTypes:["size"],infix:!0,handler(t,e){var{parser:r,funcName:i,token:s}=t;return{type:"infix",mode:r.mode,replaceWith:"\\\\abovefrac",size:ae(e[0],"size").value,token:s}}});H({type:"genfrac",names:["\\\\abovefrac"],numArgs:3,argTypes:["math","size","math"],handler:(t,e)=>{var{parser:r,funcName:i}=t,s=e[0],a=ae(e[1],"infix").size;if(!a)throw new Error("\\\\abovefrac expected size, but got "+String(a));var o=e[2],l=a.number>0;return{type:"genfrac",mode:r.mode,numer:s,denom:o,continued:!1,hasBarLine:l,barSize:a,leftDelim:null,rightDelim:null}}});var Zu=(t,e)=>{var r=e.style,i,s;t.type==="supsub"?(i=t.sup?ve(t.sup,e.havingStyle(r.sup()),e):ve(t.sub,e.havingStyle(r.sub()),e),s=ae(t.base,"horizBrace")):s=ae(t,"horizBrace");var a=ve(s.base,e.havingBaseStyle(ie.DISPLAY)),o=Oo(s,e),l;if(s.isOver?l=me({positionType:"firstBaseline",children:[{type:"elem",elem:a},{type:"kern",size:.1},{type:"elem",elem:o,wrapperClasses:["svg-align"]}]}):l=me({positionType:"bottom",positionData:a.depth+.1+o.height,children:[{type:"elem",elem:o,wrapperClasses:["svg-align"]},{type:"kern",size:.1},{type:"elem",elem:a}]}),i){var c=D(["minner",s.isOver?"mover":"munder"],[l],e);s.isOver?l=me({positionType:"firstBaseline",children:[{type:"elem",elem:c},{type:"kern",size:.2},{type:"elem",elem:i}]}):l=me({positionType:"bottom",positionData:c.depth+.2+i.height+i.depth,children:[{type:"elem",elem:i},{type:"kern",size:.2},{type:"elem",elem:c}]})}return D(["minner",s.isOver?"mover":"munder"],[l],e)},Vv=(t,e)=>{var r=Do(t.label);return new R(t.isOver?"mover":"munder",[Se(t.base,e),r])};H({type:"horizBrace",names:["\\overbrace","\\underbrace","\\overbracket","\\underbracket"],numArgs:1,handler(t,e){var{parser:r,funcName:i}=t;return{type:"horizBrace",mode:r.mode,label:i,isOver:i.includes("\\over"),base:e[0]}},htmlBuilder:Zu,mathmlBuilder:Vv});H({type:"href",names:["\\href"],numArgs:2,argTypes:["url","original"],allowedInText:!0,handler:(t,e)=>{var{parser:r}=t,i=e[1],s=ae(e[0],"url").url;return r.settings.isTrusted({command:"\\href",url:s})?{type:"href",mode:r.mode,href:s,body:Ie(i)}:r.formatUnsupportedCmd("\\href")},htmlBuilder:(t,e)=>{var r=He(t.body,e,!1);return Ym(t.href,[],r,e)},mathmlBuilder:(t,e)=>{var r=ri(t.body,e);return r instanceof R||(r=new R("mrow",[r])),r.setAttribute("href",t.href),r}});H({type:"href",names:["\\url"],numArgs:1,argTypes:["url"],allowedInText:!0,handler:(t,e)=>{var{parser:r}=t,i=ae(e[0],"url").url;if(!r.settings.isTrusted({command:"\\url",url:i}))return r.formatUnsupportedCmd("\\url");for(var s=[],a=0;a<i.length;a++){var o=i[a];o==="~"&&(o="\\textasciitilde"),s.push({type:"textord",mode:"text",text:o})}var l={type:"text",mode:r.mode,font:"\\texttt",body:s};return{type:"href",mode:r.mode,href:i,body:Ie(l)}}});H({type:"hbox",names:["\\hbox"],numArgs:1,argTypes:["text"],allowedInText:!0,primitive:!0,handler(t,e){var{parser:r}=t;return{type:"hbox",mode:r.mode,body:Ie(e[0])}},htmlBuilder(t,e){var r=He(t.body,e.withFont(""),!1);return Mr(r)},mathmlBuilder(t,e){return new R("mrow",$t(t.body,e.withFont("")))}});H({type:"html",names:["\\htmlClass","\\htmlId","\\htmlStyle","\\htmlData"],numArgs:2,argTypes:["raw","original"],allowedInText:!0,handler:(t,e)=>{var{parser:r,funcName:i,token:s}=t,a=ae(e[0],"raw").string,o=e[1];r.settings.strict&&r.settings.reportNonstrict("htmlExtension","HTML extension is disabled on strict mode");var l,c={};switch(i){case"\\htmlClass":c.class=a,l={command:"\\htmlClass",class:a};break;case"\\htmlId":c.id=a,l={command:"\\htmlId",id:a};break;case"\\htmlStyle":c.style=a,l={command:"\\htmlStyle",style:a};break;case"\\htmlData":{for(var h=a.split(","),f=0;f<h.length;f++){var b=h[f],y=b.indexOf("=");if(y<0)throw new I("\\htmlData key/value '"+b+"' missing equals sign");var k=b.slice(0,y),z=b.slice(y+1);c["data-"+k.trim()]=z}l={command:"\\htmlData",attributes:c};break}default:throw new Error("Unrecognized html command")}return r.settings.isTrusted(l)?{type:"html",mode:r.mode,attributes:c,body:Ie(o)}:r.formatUnsupportedCmd(i)},htmlBuilder:(t,e)=>{var r=He(t.body,e,!1),i=["enclosing"];t.attributes.class&&i.push(...t.attributes.class.trim().split(/\s+/));var s=D(i,r,e);for(var a in t.attributes)a!=="class"&&t.attributes.hasOwnProperty(a)&&s.setAttribute(a,t.attributes[a]);return s},mathmlBuilder:(t,e)=>ri(t.body,e)});H({type:"htmlmathml",names:["\\html@mathml"],numArgs:2,allowedInArgument:!0,allowedInText:!0,handler:(t,e)=>{var{parser:r}=t;return{type:"htmlmathml",mode:r.mode,html:Ie(e[0]),mathml:Ie(e[1])}},htmlBuilder:(t,e)=>{var r=He(t.html,e,!1);return Mr(r)},mathmlBuilder:(t,e)=>ri(t.mathml,e)});var On=function(e){if(/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(e))return{number:+e,unit:"bp"};var r=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(e);if(!r)throw new I("Invalid size: '"+e+"' in \\includegraphics");var i={number:+(r[1]+r[2]),unit:r[3]};if(!yu(i))throw new I("Invalid unit: '"+i.unit+"' in \\includegraphics.");return i};H({type:"includegraphics",names:["\\includegraphics"],numArgs:1,numOptionalArgs:1,argTypes:["raw","url"],allowedInText:!1,handler:(t,e,r)=>{var{parser:i}=t,s={number:0,unit:"em"},a={number:.9,unit:"em"},o={number:0,unit:"em"},l="";if(r[0])for(var c=ae(r[0],"raw").string,h=c.split(","),f=0;f<h.length;f++){var b=h[f].split("=");if(b.length===2){var y=b[1].trim();switch(b[0].trim()){case"alt":l=y;break;case"width":s=On(y);break;case"height":a=On(y);break;case"totalheight":o=On(y);break;default:throw new I("Invalid key: '"+b[0]+"' in \\includegraphics.")}}}var k=ae(e[0],"url").url;return l===""&&(l=k,l=l.replace(/^.*[\\/]/,""),l=l.substring(0,l.lastIndexOf("."))),i.settings.isTrusted({command:"\\includegraphics",url:k})?{type:"includegraphics",mode:i.mode,alt:l,width:s,height:a,totalheight:o,src:k}:i.formatUnsupportedCmd("\\includegraphics")},htmlBuilder:(t,e)=>{var r=Pe(t.height,e),i=0;t.totalheight.number>0&&(i=Pe(t.totalheight,e)-r);var s=0;t.width.number>0&&(s=Pe(t.width,e));var a={height:L(r+i)};s>0&&(a.width=L(s)),i>0&&(a.verticalAlign=L(-i));var o=new Bm(t.src,t.alt,a);return o.height=r,o.depth=i,o},mathmlBuilder:(t,e)=>{var r=new R("mglyph",[]);r.setAttribute("alt",t.alt);var i=Pe(t.height,e),s=0;if(t.totalheight.number>0&&(s=Pe(t.totalheight,e)-i,r.setAttribute("valign",L(-s))),r.setAttribute("height",L(i+s)),t.width.number>0){var a=Pe(t.width,e);r.setAttribute("width",L(a))}return r.setAttribute("src",t.src),r}});H({type:"kern",names:["\\kern","\\mkern","\\hskip","\\mskip"],numArgs:1,argTypes:["size"],primitive:!0,allowedInText:!0,handler(t,e){var{parser:r,funcName:i}=t,s=ae(e[0],"size");if(r.settings.strict){var a=i[1]==="m",o=s.value.unit==="mu";a?(o||r.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+i+" supports only mu units, "+("not "+s.value.unit+" units")),r.mode!=="math"&&r.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+i+" works only in math mode")):o&&r.settings.reportNonstrict("mathVsTextUnits","LaTeX's "+i+" doesn't support mu units")}return{type:"kern",mode:r.mode,dimension:s.value}},htmlBuilder(t,e){return $u(t.dimension,e)},mathmlBuilder(t,e){var r=Pe(t.dimension,e);return new Pu(r)}});H({type:"lap",names:["\\mathllap","\\mathrlap","\\mathclap"],numArgs:1,allowedInText:!0,handler:(t,e)=>{var{parser:r,funcName:i}=t,s=e[0];return{type:"lap",mode:r.mode,alignment:i.slice(5),body:s}},htmlBuilder:(t,e)=>{var r;t.alignment==="clap"?(r=D([],[ve(t.body,e)]),r=D(["inner"],[r],e)):r=D(["inner"],[ve(t.body,e)]);var i=D(["fix"],[]),s=D([t.alignment],[r,i],e),a=D(["strut"]);return a.style.height=L(s.height+s.depth),s.depth&&(a.style.verticalAlign=L(-s.depth)),s.children.unshift(a),s=D(["thinbox"],[s],e),D(["mord","vbox"],[s],e)},mathmlBuilder:(t,e)=>{var r=new R("mpadded",[Se(t.body,e)]);if(t.alignment!=="rlap"){var i=t.alignment==="llap"?"-1":"-0.5";r.setAttribute("lspace",i+"width")}return r.setAttribute("width","0px"),r}});H({type:"styling",names:["\\(","$"],numArgs:0,allowedInText:!0,allowedInMath:!1,handler(t,e){var{funcName:r,parser:i}=t,s=i.mode;i.switchMode("math");var a=r==="\\("?"\\)":"$",o=i.parseExpression(!1,a);return i.expect(a),i.switchMode(s),{type:"styling",mode:i.mode,style:"text",resetFont:!0,body:o}}});H({type:"text",names:["\\)","\\]"],numArgs:0,allowedInText:!0,allowedInMath:!1,handler(t,e){throw new I("Mismatched "+t.funcName)}});var td=(t,e)=>{switch(e.style.size){case ie.DISPLAY.size:return t.display;case ie.TEXT.size:return t.text;case ie.SCRIPT.size:return t.script;case ie.SCRIPTSCRIPT.size:return t.scriptscript;default:return t.text}};H({type:"mathchoice",names:["\\mathchoice"],numArgs:4,primitive:!0,handler:(t,e)=>{var{parser:r}=t;return{type:"mathchoice",mode:r.mode,display:Ie(e[0]),text:Ie(e[1]),script:Ie(e[2]),scriptscript:Ie(e[3])}},htmlBuilder:(t,e)=>{var r=td(t,e),i=He(r,e,!1);return Mr(i)},mathmlBuilder:(t,e)=>{var r=td(t,e);return ri(r,e)}});var Ju=(t,e,r,i,s,a,o)=>{t=D([],[t]);var l=r&&Er(r),c,h;if(e){var f=ve(e,i.havingStyle(s.sup()),i);h={elem:f,kern:Math.max(i.fontMetrics().bigOpSpacing1,i.fontMetrics().bigOpSpacing3-f.depth)}}if(r){var b=ve(r,i.havingStyle(s.sub()),i);c={elem:b,kern:Math.max(i.fontMetrics().bigOpSpacing2,i.fontMetrics().bigOpSpacing4-b.height)}}var y;if(h&&c){var k=i.fontMetrics().bigOpSpacing5+c.elem.height+c.elem.depth+c.kern+t.depth+o;y=me({positionType:"bottom",positionData:k,children:[{type:"kern",size:i.fontMetrics().bigOpSpacing5},{type:"elem",elem:c.elem,marginLeft:L(-a)},{type:"kern",size:c.kern},{type:"elem",elem:t},{type:"kern",size:h.kern},{type:"elem",elem:h.elem,marginLeft:L(a)},{type:"kern",size:i.fontMetrics().bigOpSpacing5}]})}else if(c){var z=t.height-o;y=me({positionType:"top",positionData:z,children:[{type:"kern",size:i.fontMetrics().bigOpSpacing5},{type:"elem",elem:c.elem,marginLeft:L(-a)},{type:"kern",size:c.kern},{type:"elem",elem:t}]})}else if(h){var O=t.depth+o;y=me({positionType:"bottom",positionData:O,children:[{type:"elem",elem:t},{type:"kern",size:h.kern},{type:"elem",elem:h.elem,marginLeft:L(a)},{type:"kern",size:i.fontMetrics().bigOpSpacing5}]})}else return t;var M=[y];if(c&&a!==0&&!l){var N=D(["mspace"],[],i);N.style.marginRight=L(a),M.unshift(N)}return D(["mop","op-limits"],M,i)},Qu=new Set(["\\smallint"]),eh=(t,e)=>{var r,i,s=!1,a;t.type==="supsub"?(r=t.sup,i=t.sub,a=ae(t.base,"op"),s=!0):a=ae(t,"op");var o=e.style,l=!1;o.size===ie.DISPLAY.size&&a.symbol&&!Qu.has(a.name)&&(l=!0);var c,h;if(a.symbol){var f=l?"Size2-Regular":"Size1-Regular",b="";if((a.name==="\\oiint"||a.name==="\\oiiint")&&(b=a.name.slice(1),a.name=b==="oiint"?"\\iint":"\\iiint"),c=rt(a.name,f,"math",e,["mop","op-symbol",l?"large-op":"small-op"]),h=c.italic,b.length>0){var y=Cu(b+"Size"+(l?"2":"1"),e);c=me({positionType:"individualShift",children:[{type:"elem",elem:c,shift:0},{type:"elem",elem:y,shift:l?.08:0}]}),a.name="\\"+b,c.classes.unshift("mop"),c.italic=h}}else if(a.body){var k=He(a.body,e,!0);k.length===1&&k[0]instanceof xt?(c=k[0],c.classes[0]="mop"):c=D(["mop"],k,e)}else{for(var z=[],O=1;O<a.name.length;O++)z.push(Ql(a.name[O],a.mode,e));c=D(["mop"],z,e)}var M=0,N=0;if((c instanceof xt||a.name==="\\oiint"||a.name==="\\oiiint")&&!a.suppressBaseShift){var j;M=(c.height-c.depth)/2-e.fontMetrics().axisHeight,N=(j=c.italic)!=null?j:0}return s?Ju(c,r,i,e,o,N,M):(M&&(c.style.position="relative",c.style.top=L(M)),c)},Gv=(t,e)=>{var r;if(t.symbol)r=new R("mo",[Dt(t.name,t.mode)]),Qu.has(t.name)&&r.setAttribute("largeop","false");else if(t.body)r=new R("mo",$t(t.body,e));else{r=new R("mi",[new Re(t.name.slice(1))]);var i=new R("mo",[Dt("⁡","text")]);t.parentIsSupSub?r=new R("mrow",[r,i]):r=Mu([r,i])}return r},Xv={"∏":"\\prod","∐":"\\coprod","∑":"\\sum","⋀":"\\bigwedge","⋁":"\\bigvee","⋂":"\\bigcap","⋃":"\\bigcup","⨀":"\\bigodot","⨁":"\\bigoplus","⨂":"\\bigotimes","⨄":"\\biguplus","⨆":"\\bigsqcup"};H({type:"op",names:["\\coprod","\\bigvee","\\bigwedge","\\biguplus","\\bigcap","\\bigcup","\\intop","\\prod","\\sum","\\bigotimes","\\bigoplus","\\bigodot","\\bigsqcup","\\smallint","∏","∐","∑","⋀","⋁","⋂","⋃","⨀","⨁","⨂","⨄","⨆"],numArgs:0,handler:(t,e)=>{var{parser:r,funcName:i}=t,s=i;return s.length===1&&(s=Xv[s]),{type:"op",mode:r.mode,limits:!0,parentIsSupSub:!1,symbol:!0,name:s}},htmlBuilder:eh,mathmlBuilder:Gv});H({type:"op",names:["\\mathop"],numArgs:1,primitive:!0,handler:(t,e)=>{var{parser:r}=t,i=e[0];return{type:"op",mode:r.mode,limits:!1,parentIsSupSub:!1,symbol:!1,body:Ie(i)}}});var Kv={"∫":"\\int","∬":"\\iint","∭":"\\iiint","∮":"\\oint","∯":"\\oiint","∰":"\\oiiint"};H({type:"op",names:["\\arcsin","\\arccos","\\arctan","\\arctg","\\arcctg","\\arg","\\ch","\\cos","\\cosec","\\cosh","\\cot","\\cotg","\\coth","\\csc","\\ctg","\\cth","\\deg","\\dim","\\exp","\\hom","\\ker","\\lg","\\ln","\\log","\\sec","\\sin","\\sinh","\\sh","\\tan","\\tanh","\\tg","\\th"],numArgs:0,handler(t){var{parser:e,funcName:r}=t;return{type:"op",mode:e.mode,limits:!1,parentIsSupSub:!1,symbol:!1,name:r}}});H({type:"op",names:["\\det","\\gcd","\\inf","\\lim","\\max","\\min","\\Pr","\\sup"],numArgs:0,handler(t){var{parser:e,funcName:r}=t;return{type:"op",mode:e.mode,limits:!0,parentIsSupSub:!1,symbol:!1,name:r}}});H({type:"op",names:["\\int","\\iint","\\iiint","\\oint","\\oiint","\\oiiint","∫","∬","∭","∮","∯","∰"],numArgs:0,allowedInArgument:!0,handler(t){var{parser:e,funcName:r}=t,i=r;return i.length===1&&(i=Kv[i]),{type:"op",mode:e.mode,limits:!1,parentIsSupSub:!1,symbol:!0,name:i}}});var th=(t,e)=>{var r,i,s=!1,a;t.type==="supsub"?(r=t.sup,i=t.sub,a=ae(t.base,"operatorname"),s=!0):a=ae(t,"operatorname");var o;if(a.body.length>0){for(var l=a.body.map(b=>{var y="text"in b?b.text:void 0;return typeof y=="string"?{type:"textord",mode:b.mode,text:y}:b}),c=He(l,e.withFont("mathrm"),!0),h=0;h<c.length;h++){var f=c[h];f instanceof xt&&(f.text=f.text.replace(/\u2212/,"-").replace(/\u2217/,"*"))}o=D(["mop"],c,e)}else o=D(["mop"],[],e);return s?Ju(o,r,i,e,e.style,0,0):o},Yv=(t,e)=>{for(var r=$t(t.body,e.withFont("mathrm")),i=!0,s=0;s<r.length;s++){var a=r[s];if(!(a instanceof Pu))if(a instanceof R)switch(a.type){case"mi":case"mn":case"mspace":case"mtext":break;case"mo":{var o=a.children[0];a.children.length===1&&o instanceof Re?o.text=o.text.replace(/\u2212/,"-").replace(/\u2217/,"*"):i=!1;break}default:i=!1}else i=!1}if(i){var l=r.map(f=>f.toText()).join("");r=[new Re(l)]}var c=new R("mi",r);c.setAttribute("mathvariant","normal");var h=new R("mo",[Dt("⁡","text")]);return t.parentIsSupSub?new R("mrow",[c,h]):Mu([c,h])};H({type:"operatorname",names:["\\operatorname@","\\operatornamewithlimits"],numArgs:1,handler:(t,e)=>{var{parser:r,funcName:i}=t,s=e[0];return{type:"operatorname",mode:r.mode,body:Ie(s),alwaysHandleSupSub:i==="\\operatornamewithlimits",limits:!1,parentIsSupSub:!1}},htmlBuilder:th,mathmlBuilder:Yv});m("\\operatorname","\\@ifstar\\operatornamewithlimits\\operatorname@");Hi({type:"ordgroup",htmlBuilder(t,e){return t.semisimple?Mr(He(t.body,e,!1)):D(["mord"],He(t.body,e,!0),e)},mathmlBuilder(t,e){return ri(t.body,e,!0)}});H({type:"overline",names:["\\overline"],numArgs:1,handler(t,e){var{parser:r}=t,i=e[0];return{type:"overline",mode:r.mode,body:i}},htmlBuilder(t,e){var r=ve(t.body,e.havingCrampedStyle()),i=us("overline-line",e),s=e.fontMetrics().defaultRuleThickness,a=me({positionType:"firstBaseline",children:[{type:"elem",elem:r},{type:"kern",size:3*s},{type:"elem",elem:i},{type:"kern",size:s}]});return D(["mord","overline"],[a],e)},mathmlBuilder(t,e){var r=new R("mo",[new Re("‾")]);r.setAttribute("stretchy","true");var i=new R("mover",[Se(t.body,e),r]);return i.setAttribute("accent","true"),i}});H({type:"phantom",names:["\\phantom"],numArgs:1,allowedInText:!0,handler:(t,e)=>{var{parser:r}=t,i=e[0];return{type:"phantom",mode:r.mode,body:Ie(i)}},htmlBuilder:(t,e)=>{var r=He(t.body,e.withPhantom(),!1);return Mr(r)},mathmlBuilder:(t,e)=>{var r=$t(t.body,e);return new R("mphantom",r)}});m("\\hphantom","\\smash{\\phantom{#1}}");H({type:"vphantom",names:["\\vphantom"],numArgs:1,allowedInText:!0,handler:(t,e)=>{var{parser:r}=t,i=e[0];return{type:"vphantom",mode:r.mode,body:i}},htmlBuilder:(t,e)=>{var r=D(["inner"],[ve(t.body,e.withPhantom())]),i=D(["fix"],[]);return D(["mord","rlap"],[r,i],e)},mathmlBuilder:(t,e)=>{var r=$t(Ie(t.body),e),i=new R("mphantom",r),s=new R("mpadded",[i]);return s.setAttribute("width","0px"),s}});H({type:"raisebox",names:["\\raisebox"],numArgs:2,argTypes:["size","hbox"],allowedInText:!0,handler(t,e){var{parser:r}=t,i=ae(e[0],"size").value,s=e[1];return{type:"raisebox",mode:r.mode,dy:i,body:s}},htmlBuilder(t,e){var r=ve(t.body,e),i=Pe(t.dy,e);return me({positionType:"shift",positionData:-i,children:[{type:"elem",elem:r}]})},mathmlBuilder(t,e){var r=new R("mpadded",[Se(t.body,e)]),i=t.dy.number+t.dy.unit;return r.setAttribute("voffset",i),r}});H({type:"internal",names:["\\relax"],numArgs:0,allowedInText:!0,allowedInArgument:!0,handler(t){var{parser:e}=t;return{type:"internal",mode:e.mode}}});H({type:"rule",names:["\\rule"],numArgs:2,numOptionalArgs:1,allowedInText:!0,allowedInMath:!0,argTypes:["size","size","size"],handler(t,e,r){var{parser:i}=t,s=r[0],a=ae(e[0],"size"),o=ae(e[1],"size");return{type:"rule",mode:i.mode,shift:s&&ae(s,"size").value,width:a.value,height:o.value}},htmlBuilder(t,e){var r=D(["mord","rule"],[],e),i=Pe(t.width,e),s=Pe(t.height,e),a=t.shift?Pe(t.shift,e):0;return r.style.borderRightWidth=L(i),r.style.borderTopWidth=L(s),r.style.bottom=L(a),r.width=i,r.height=s+a,r.depth=-a,r.maxFontSize=s*1.125*e.sizeMultiplier,r},mathmlBuilder(t,e){var r=Pe(t.width,e),i=Pe(t.height,e),s=t.shift?Pe(t.shift,e):0,a=e.color&&e.getColor()||"black",o=new R("mspace");o.setAttribute("mathbackground",a),o.setAttribute("width",L(r)),o.setAttribute("height",L(i));var l=new R("mpadded",[o]);return s>=0?l.setAttribute("height",L(s)):(l.setAttribute("height",L(s)),l.setAttribute("depth",L(-s))),l.setAttribute("voffset",L(s)),l}});function rh(t,e,r){for(var i=He(t,e,!1),s=e.sizeMultiplier/r.sizeMultiplier,a=0;a<i.length;a++){var o=i[a].classes.indexOf("sizing");o<0?Array.prototype.push.apply(i[a].classes,e.sizingClasses(r)):i[a].classes[o+1]==="reset-size"+e.size&&(i[a].classes[o+1]="reset-size"+r.size),i[a].height*=s,i[a].depth*=s}return Mr(i)}var rd=["\\tiny","\\sixptsize","\\scriptsize","\\footnotesize","\\small","\\normalsize","\\large","\\Large","\\LARGE","\\huge","\\Huge"],Zv=(t,e)=>{var r=e.havingSize(t.size);return rh(t.body,r,e)};H({type:"sizing",names:rd,numArgs:0,allowedInText:!0,handler:(t,e)=>{var{breakOnTokenText:r,funcName:i,parser:s}=t,a=s.parseExpression(!1,r);return{type:"sizing",mode:s.mode,size:rd.indexOf(i)+1,body:a}},htmlBuilder:Zv,mathmlBuilder:(t,e)=>{var r=e.havingSize(t.size),i=$t(t.body,r),s=new R("mstyle",i);return s.setAttribute("mathsize",L(r.sizeMultiplier)),s}});H({type:"smash",names:["\\smash"],numArgs:1,numOptionalArgs:1,allowedInText:!0,handler:(t,e,r)=>{var{parser:i}=t,s=!1,a=!1,o=r[0]&&ae(r[0],"ordgroup");if(o)for(var l,c=0;c<o.body.length;++c){var h=o.body[c];if(l=Io(h).text,l==="t")s=!0;else if(l==="b")a=!0;else{s=!1,a=!1;break}}else s=!0,a=!0;var f=e[0];return{type:"smash",mode:i.mode,body:f,smashHeight:s,smashDepth:a}},htmlBuilder:(t,e)=>{var r=D([],[ve(t.body,e)]);if(!t.smashHeight&&!t.smashDepth)return r;if(t.smashHeight&&(r.height=0),t.smashDepth&&(r.depth=0),t.smashHeight&&t.smashDepth)return D(["mord","smash"],[r],e);if(r.children)for(var i=0;i<r.children.length;i++)t.smashHeight&&(r.children[i].height=0),t.smashDepth&&(r.children[i].depth=0);var s=me({positionType:"firstBaseline",children:[{type:"elem",elem:r}]});return D(["mord"],[s],e)},mathmlBuilder:(t,e)=>{var r=new R("mpadded",[Se(t.body,e)]);return t.smashHeight&&r.setAttribute("height","0px"),t.smashDepth&&r.setAttribute("depth","0px"),r}});H({type:"sqrt",names:["\\sqrt"],numArgs:1,numOptionalArgs:1,handler(t,e,r){var{parser:i}=t,s=r[0],a=e[0];return{type:"sqrt",mode:i.mode,body:a,index:s}},htmlBuilder(t,e){var r=ve(t.body,e.havingCrampedStyle());r.height===0&&(r.height=e.fontMetrics().xHeight),r=hs(r,e);var i=e.fontMetrics(),s=i.defaultRuleThickness,a=s;e.style.id<ie.TEXT.id&&(a=e.fontMetrics().xHeight);var o=s+a/4,l=r.height+r.depth+o+s,{span:c,ruleWidth:h,advanceWidth:f}=Pv(l,e),b=c.height-h;b>r.height+r.depth+o&&(o=(o+b-r.height-r.depth)/2);var y=c.height-r.height-o-h;r.style.paddingLeft=L(f);var k=me({positionType:"firstBaseline",children:[{type:"elem",elem:r,wrapperClasses:["svg-align"]},{type:"kern",size:-(r.height+y)},{type:"elem",elem:c},{type:"kern",size:h}]});if(t.index){var z=e.havingStyle(ie.SCRIPTSCRIPT),O=ve(t.index,z,e),M=.6*(k.height-k.depth),N=me({positionType:"shift",positionData:-M,children:[{type:"elem",elem:O}]}),j=D(["root"],[N]);return D(["mord","sqrt"],[j,k],e)}else return D(["mord","sqrt"],[k],e)},mathmlBuilder(t,e){var{body:r,index:i}=t;return i?new R("mroot",[Se(r,e),Se(i,e)]):new R("msqrt",[Se(r,e)])}});var ml={display:ie.DISPLAY,text:ie.TEXT,script:ie.SCRIPT,scriptscript:ie.SCRIPTSCRIPT};function Jv(t){return t in ml}H({type:"styling",names:["\\displaystyle","\\textstyle","\\scriptstyle","\\scriptscriptstyle"],numArgs:0,allowedInText:!0,primitive:!0,handler(t,e){var{breakOnTokenText:r,funcName:i,parser:s}=t,a=s.parseExpression(!0,r),o=i.slice(1,i.length-5);if(!Jv(o))throw new Error("Unknown style: "+o);return{type:"styling",mode:s.mode,style:o,body:a}},htmlBuilder(t,e){var r=ml[t.style],i=e.havingStyle(r);return t.resetFont&&(i=i.withFont("")),rh(t.body,i,e)},mathmlBuilder(t,e){var r=ml[t.style],i=e.havingStyle(r);t.resetFont&&(i=i.withFont(""));var s=$t(t.body,i),a=new R("mstyle",s),o={display:["0","true"],text:["0","false"],script:["1","false"],scriptscript:["2","false"]},l=o[t.style];return a.setAttribute("scriptlevel",l[0]),a.setAttribute("displaystyle",l[1]),a}});var Qv=function(e,r){var i=e.base;if(i)if(i.type==="op"){var s=i.limits&&(r.style.size===ie.DISPLAY.size||i.alwaysHandleSupSub);return s?eh:null}else if(i.type==="operatorname"){var a=i.alwaysHandleSupSub&&(r.style.size===ie.DISPLAY.size||i.limits);return a?th:null}else{if(i.type==="accent")return Er(i.base)?Ru:null;if(i.type==="horizBrace"){var o=!e.sub;return o===i.isOver?Zu:null}else return null}else return null};Hi({type:"supsub",htmlBuilder(t,e){var r=Qv(t,e);if(r)return r(t,e);var{base:i,sup:s,sub:a}=t,o=ve(i,e),l,c,h=e.fontMetrics(),f=0,b=0,y=i&&Er(i);if(s){var k=e.havingStyle(e.style.sup());l=ve(s,k,e),y||(f=o.height-k.fontMetrics().supDrop*k.sizeMultiplier/e.sizeMultiplier)}if(a){var z=e.havingStyle(e.style.sub());c=ve(a,z,e),y||(b=o.depth+z.fontMetrics().subDrop*z.sizeMultiplier/e.sizeMultiplier)}var O;e.style===ie.DISPLAY?O=h.sup1:e.style.cramped?O=h.sup3:O=h.sup2;var M=e.sizeMultiplier,N=L(.5/h.ptPerEm/M),j=null;if(c){var J=t.base&&t.base.type==="op"&&t.base.name&&(t.base.name==="\\oiint"||t.base.name==="\\oiiint");if(o instanceof xt||J){var V;j=L(-((V=o.italic)!=null?V:0))}}var K;if(l&&c){f=Math.max(f,O,l.depth+.25*h.xHeight),b=Math.max(b,h.sub2);var ee=h.defaultRuleThickness,re=4*ee;if(f-l.depth-(c.height-b)<re){b=re-(f-l.depth)+c.height;var ne=.8*h.xHeight-(f-l.depth);ne>0&&(f+=ne,b-=ne)}var le=[{type:"elem",elem:c,shift:b,marginRight:N,marginLeft:j},{type:"elem",elem:l,shift:-f,marginRight:N}];K=me({positionType:"individualShift",children:le})}else if(c){b=Math.max(b,h.sub1,c.height-.8*h.xHeight);var We=[{type:"elem",elem:c,marginLeft:j,marginRight:N}];K=me({positionType:"shift",positionData:b,children:We})}else if(l)f=Math.max(f,O,l.depth+.25*h.xHeight),K=me({positionType:"shift",positionData:-f,children:[{type:"elem",elem:l,marginRight:N}]});else throw new Error("supsub must have either sup or sub.");var Ne=dl(o,"right")||"mord";return D([Ne],[o,D(["msupsub"],[K])],e)},mathmlBuilder(t,e){var r=!1,i,s;t.base&&t.base.type==="horizBrace"&&(s=!!t.sup,s===t.base.isOver&&(r=!0,i=t.base.isOver)),t.base&&(t.base.type==="op"||t.base.type==="operatorname")&&(t.base.parentIsSupSub=!0);var a=[Se(t.base,e)];t.sub&&a.push(Se(t.sub,e)),t.sup&&a.push(Se(t.sup,e));var o;if(r)o=i?"mover":"munder";else if(t.sub)if(t.sup){var h=t.base;h&&h.type==="op"&&h.limits&&e.style===ie.DISPLAY||h&&h.type==="operatorname"&&h.alwaysHandleSupSub&&(e.style===ie.DISPLAY||h.limits)?o="munderover":o="msubsup"}else{var c=t.base;c&&c.type==="op"&&c.limits&&(e.style===ie.DISPLAY||c.alwaysHandleSupSub)||c&&c.type==="operatorname"&&c.alwaysHandleSupSub&&(c.limits||e.style===ie.DISPLAY)?o="munder":o="msub"}else{var l=t.base;l&&l.type==="op"&&l.limits&&(e.style===ie.DISPLAY||l.alwaysHandleSupSub)||l&&l.type==="operatorname"&&l.alwaysHandleSupSub&&(l.limits||e.style===ie.DISPLAY)?o="mover":o="msup"}return new R(o,a)}});Hi({type:"atom",htmlBuilder(t,e){return Ql(t.text,t.mode,e,["m"+t.family])},mathmlBuilder(t,e){var r=new R("mo",[Dt(t.text,t.mode)]);if(t.family==="bin"){var i=rc(t,e);i==="bold-italic"&&r.setAttribute("mathvariant",i)}else t.family==="punct"?r.setAttribute("separator","true"):(t.family==="open"||t.family==="close")&&r.setAttribute("stretchy","false");return r}});var ih={mi:"italic",mn:"normal",mtext:"normal"};Hi({type:"mathord",htmlBuilder(t,e){return Po(t,e)},mathmlBuilder(t,e){var r=new R("mi",[Dt(t.text,t.mode,e)]),i=rc(t,e)||"italic";return i!==ih[r.type]&&r.setAttribute("mathvariant",i),r}});Hi({type:"textord",htmlBuilder(t,e){return Po(t,e)},mathmlBuilder(t,e){var r=Dt(t.text,t.mode,e),i=rc(t,e)||"normal",s;return t.mode==="text"?s=new R("mtext",[r]):/[0-9]/.test(t.text)?s=new R("mn",[r]):t.text==="\\prime"?s=new R("mo",[r]):s=new R("mi",[r]),i!==ih[s.type]&&s.setAttribute("mathvariant",i),s}});var In={"\\nobreak":"nobreak","\\allowbreak":"allowbreak"},Rn={" ":{},"\\ ":{},"~":{className:"nobreak"},"\\space":{},"\\nobreakspace":{className:"nobreak"}};Hi({type:"spacing",htmlBuilder(t,e){if(Rn.hasOwnProperty(t.text)){var r=Rn[t.text].className||"";if(t.mode==="text"){var i=Po(t,e);return i.classes.push(r),i}else return D(["mspace",r],[Ql(t.text,t.mode,e)],e)}else{if(In.hasOwnProperty(t.text))return D(["mspace",In[t.text]],[],e);throw new I('Unknown type of space "'+t.text+'"')}},mathmlBuilder(t,e){var r;if(Rn.hasOwnProperty(t.text))r=new R("mtext",[new Re(" ")]);else{if(In.hasOwnProperty(t.text))return new R("mspace");throw new I('Unknown type of space "'+t.text+'"')}return r}});var id=()=>{var t=new R("mtd",[]);return t.setAttribute("width","50%"),t};Hi({type:"tag",mathmlBuilder(t,e){var r=new R("mtable",[new R("mtr",[id(),new R("mtd",[ri(t.body,e)]),id(),new R("mtd",[ri(t.tag,e)])])]);return r.setAttribute("width","100%"),r}});var sd={"\\text":void 0,"\\textrm":"textrm","\\textsf":"textsf","\\texttt":"texttt","\\textnormal":"textrm"},ad={"\\textbf":"textbf","\\textmd":"textmd"},eb={"\\textit":"textit","\\textup":"textup"},od=(t,e)=>{var r=t.font;if(r){if(sd[r])return e.withTextFontFamily(sd[r]);if(ad[r])return e.withTextFontWeight(ad[r]);if(r==="\\emph")return e.fontShape==="textit"?e.withTextFontShape("textup"):e.withTextFontShape("textit")}else return e;return e.withTextFontShape(eb[r])};H({type:"text",names:["\\text","\\textrm","\\textsf","\\texttt","\\textnormal","\\textbf","\\textmd","\\textit","\\textup","\\emph"],numArgs:1,argTypes:["text"],allowedInArgument:!0,allowedInText:!0,handler(t,e){var{parser:r,funcName:i}=t,s=e[0];return{type:"text",mode:r.mode,body:Ie(s),font:i}},htmlBuilder(t,e){var r=od(t,e),i=He(t.body,r,!0);return D(["mord","text"],i,r)},mathmlBuilder(t,e){var r=od(t,e);return ri(t.body,r)}});H({type:"underline",names:["\\underline"],numArgs:1,allowedInText:!0,handler(t,e){var{parser:r}=t;return{type:"underline",mode:r.mode,body:e[0]}},htmlBuilder(t,e){var r=ve(t.body,e),i=us("underline-line",e),s=e.fontMetrics().defaultRuleThickness,a=me({positionType:"top",positionData:r.height,children:[{type:"kern",size:s},{type:"elem",elem:i},{type:"kern",size:3*s},{type:"elem",elem:r}]});return D(["mord","underline"],[a],e)},mathmlBuilder(t,e){var r=new R("mo",[new Re("‾")]);r.setAttribute("stretchy","true");var i=new R("munder",[Se(t.body,e),r]);return i.setAttribute("accentunder","true"),i}});H({type:"vcenter",names:["\\vcenter"],numArgs:1,argTypes:["original"],allowedInText:!1,handler(t,e){var{parser:r}=t;return{type:"vcenter",mode:r.mode,body:e[0]}},htmlBuilder(t,e){var r=ve(t.body,e),i=e.fontMetrics().axisHeight,s=.5*(r.height-i-(r.depth+i));return me({positionType:"shift",positionData:s,children:[{type:"elem",elem:r}]})},mathmlBuilder(t,e){var r=new R("mpadded",[Se(t.body,e)],["vcenter"]);return new R("mrow",[r])}});H({type:"verb",names:["\\verb"],numArgs:0,allowedInText:!0,handler(t,e,r){throw new I("\\verb ended by end of line instead of matching delimiter")},htmlBuilder(t,e){for(var r=nd(t),i=[],s=e.havingStyle(e.style.text()),a=0;a<r.length;a++){var o=r[a];o==="~"&&(o="\\textasciitilde"),i.push(rt(o,"Typewriter-Regular",t.mode,s,["mord","texttt"]))}return D(["mord","text"].concat(s.sizingClasses(e)),zu(i),s)},mathmlBuilder(t,e){var r=new Re(nd(t)),i=new R("mtext",[r]);return i.setAttribute("mathvariant","monospace"),i}});var nd=t=>t.body.replace(/ /g,t.star?"␣":" "),Gr=Eu,sh=`[ \r
	]`,tb="\\\\[a-zA-Z@]+",rb="\\\\[^\uD800-\uDFFF]",ib="("+tb+")"+sh+"*",sb=`\\\\(
|[ \r	]+
?)[ \r	]*`,vl="[̀-ͯ]",ab=new RegExp(vl+"+$"),ob="("+sh+"+)|"+(sb+"|")+"([!-\\[\\]-‧‪-퟿豈-￿]"+(vl+"*")+"|[\uD800-\uDBFF][\uDC00-\uDFFF]"+(vl+"*")+"|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5"+("|"+ib)+("|"+rb+")");class ld{constructor(e,r){this.input=void 0,this.settings=void 0,this.tokenRegex=void 0,this.catcodes=void 0,this.input=e,this.settings=r,this.tokenRegex=new RegExp(ob,"g"),this.catcodes={"%":14,"~":13}}setCatcode(e,r){this.catcodes[e]=r}lex(){var e=this.input,r=this.tokenRegex.lastIndex;if(r===e.length)return new gt("EOF",new ut(this,r,r));var i=this.tokenRegex.exec(e);if(i===null||i.index!==r)throw new I("Unexpected character: '"+e[r]+"'",new gt(e[r],new ut(this,r,r+1)));var s=i[6]||i[3]||(i[2]?"\\ ":" ");if(this.catcodes[s]===14){var a=e.indexOf(`
`,this.tokenRegex.lastIndex);return a===-1?(this.tokenRegex.lastIndex=e.length,this.settings.reportNonstrict("commentAtEnd","% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode (e.g. $)")):this.tokenRegex.lastIndex=a+1,this.lex()}return new gt(s,new ut(this,r,this.tokenRegex.lastIndex))}}class nb{constructor(e,r){e===void 0&&(e={}),r===void 0&&(r={}),this.current=void 0,this.builtins=void 0,this.undefStack=void 0,this.current=r,this.builtins=e,this.undefStack=[]}beginGroup(){this.undefStack.push({})}endGroup(){if(this.undefStack.length===0)throw new I("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");var e=this.undefStack.pop();for(var r in e)e.hasOwnProperty(r)&&(e[r]==null?delete this.current[r]:this.current[r]=e[r])}endGroups(){for(;this.undefStack.length>0;)this.endGroup()}has(e){return this.current.hasOwnProperty(e)||this.builtins.hasOwnProperty(e)}get(e){return this.current.hasOwnProperty(e)?this.current[e]:this.builtins[e]}set(e,r,i){if(i===void 0&&(i=!1),i){for(var s=0;s<this.undefStack.length;s++)delete this.undefStack[s][e];this.undefStack.length>0&&(this.undefStack[this.undefStack.length-1][e]=r)}else{var a=this.undefStack[this.undefStack.length-1];a&&!a.hasOwnProperty(e)&&(a[e]=this.current[e])}r==null?delete this.current[e]:this.current[e]=r}}var lb=Xu;m("\\noexpand",function(t){var e=t.popToken();return t.isExpandable(e.text)&&(e.noexpand=!0,e.treatAsRelax=!0),{tokens:[e],numArgs:0}});m("\\expandafter",function(t){var e=t.popToken();return t.expandOnce(!0),{tokens:[e],numArgs:0}});m("\\@firstoftwo",function(t){var e=t.consumeArgs(2);return{tokens:e[0],numArgs:0}});m("\\@secondoftwo",function(t){var e=t.consumeArgs(2);return{tokens:e[1],numArgs:0}});m("\\@ifnextchar",function(t){var e=t.consumeArgs(3);t.consumeSpaces();var r=t.future();return e[0].length===1&&e[0][0].text===r.text?{tokens:e[1],numArgs:0}:{tokens:e[2],numArgs:0}});m("\\@ifstar","\\@ifnextchar *{\\@firstoftwo{#1}}");m("\\TextOrMath",function(t){var e=t.consumeArgs(2);return t.mode==="text"?{tokens:e[0],numArgs:0}:{tokens:e[1],numArgs:0}});var cd={0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,A:10,b:11,B:11,c:12,C:12,d:13,D:13,e:14,E:14,f:15,F:15};m("\\char",function(t){var e=t.popToken(),r,i=0;if(e.text==="'")r=8,e=t.popToken();else if(e.text==='"')r=16,e=t.popToken();else if(e.text==="`")if(e=t.popToken(),e.text[0]==="\\")i=e.text.charCodeAt(1);else{if(e.text==="EOF")throw new I("\\char` missing argument");i=e.text.charCodeAt(0)}else r=10;if(r){if(i=cd[e.text],i==null||i>=r)throw new I("Invalid base-"+r+" digit "+e.text);for(var s;(s=cd[t.future().text])!=null&&s<r;)i*=r,i+=s,t.popToken()}return"\\@char{"+i+"}"});var oc=(t,e,r,i)=>{var s=t.consumeArg().tokens;if(s.length!==1)throw new I("\\newcommand's first argument must be a macro name");var a=s[0].text,o=t.isDefined(a);if(o&&!e)throw new I("\\newcommand{"+a+"} attempting to redefine "+(a+"; use \\renewcommand"));if(!o&&!r)throw new I("\\renewcommand{"+a+"} when command "+a+" does not yet exist; use \\newcommand");var l=0;if(s=t.consumeArg().tokens,s.length===1&&s[0].text==="["){for(var c="",h=t.expandNextToken();h.text!=="]"&&h.text!=="EOF";)c+=h.text,h=t.expandNextToken();if(!c.match(/^\s*[0-9]+\s*$/))throw new I("Invalid number of arguments: "+c);l=parseInt(c),s=t.consumeArg().tokens}return o&&i||t.macros.set(a,{tokens:s,numArgs:l}),""};m("\\newcommand",t=>oc(t,!1,!0,!1));m("\\renewcommand",t=>oc(t,!0,!1,!1));m("\\providecommand",t=>oc(t,!0,!0,!0));m("\\message",t=>{var e=t.consumeArgs(1)[0];return console.log(e.reverse().map(r=>r.text).join("")),""});m("\\errmessage",t=>{var e=t.consumeArgs(1)[0];return console.error(e.reverse().map(r=>r.text).join("")),""});m("\\show",t=>{var e=t.popToken(),r=e.text;return console.log(e,t.macros.get(r),Gr[r],Te.math[r],Te.text[r]),""});m("\\bgroup","{");m("\\egroup","}");m("~","\\nobreakspace");m("\\lq","`");m("\\rq","'");m("\\aa","\\r a");m("\\AA","\\r A");m("\\textcopyright","\\html@mathml{\\textcircled{c}}{\\char`©}");m("\\copyright","\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");m("\\textregistered","\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`®}");m("ℬ","\\mathscr{B}");m("ℰ","\\mathscr{E}");m("ℱ","\\mathscr{F}");m("ℋ","\\mathscr{H}");m("ℐ","\\mathscr{I}");m("ℒ","\\mathscr{L}");m("ℳ","\\mathscr{M}");m("ℛ","\\mathscr{R}");m("ℭ","\\mathfrak{C}");m("ℌ","\\mathfrak{H}");m("ℨ","\\mathfrak{Z}");m("\\Bbbk","\\Bbb{k}");m("\\llap","\\mathllap{\\textrm{#1}}");m("\\rlap","\\mathrlap{\\textrm{#1}}");m("\\clap","\\mathclap{\\textrm{#1}}");m("\\mathstrut","\\vphantom{(}");m("\\underbar","\\underline{\\text{#1}}");m("\\not",'\\html@mathml{\\mathrel{\\mathrlap\\@not}\\nobreak}{\\char"338}');m("\\neq","\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`≠}}");m("\\ne","\\neq");m("≠","\\neq");m("\\notin","\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}{\\mathrel{\\char`∉}}");m("∉","\\notin");m("≘","\\html@mathml{\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}}{\\mathrel{\\char`≘}}");m("≙","\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`≘}}");m("≚","\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`≚}}");m("≛","\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}{\\mathrel{\\char`≛}}");m("≝","\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}{\\mathrel{\\char`≝}}");m("≞","\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}{\\mathrel{\\char`≞}}");m("≟","\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`≟}}");m("⟂","\\perp");m("‼","\\mathclose{!\\mkern-0.8mu!}");m("∌","\\notni");m("⌜","\\ulcorner");m("⌝","\\urcorner");m("⌞","\\llcorner");m("⌟","\\lrcorner");m("©","\\copyright");m("®","\\textregistered");m("\\ulcorner",'\\html@mathml{\\@ulcorner}{\\mathop{\\char"231c}}');m("\\urcorner",'\\html@mathml{\\@urcorner}{\\mathop{\\char"231d}}');m("\\llcorner",'\\html@mathml{\\@llcorner}{\\mathop{\\char"231e}}');m("\\lrcorner",'\\html@mathml{\\@lrcorner}{\\mathop{\\char"231f}}');m("\\vdots","{\\varvdots\\rule{0pt}{15pt}}");m("⋮","\\vdots");m("\\varGamma","\\mathit{\\Gamma}");m("\\varDelta","\\mathit{\\Delta}");m("\\varTheta","\\mathit{\\Theta}");m("\\varLambda","\\mathit{\\Lambda}");m("\\varXi","\\mathit{\\Xi}");m("\\varPi","\\mathit{\\Pi}");m("\\varSigma","\\mathit{\\Sigma}");m("\\varUpsilon","\\mathit{\\Upsilon}");m("\\varPhi","\\mathit{\\Phi}");m("\\varPsi","\\mathit{\\Psi}");m("\\varOmega","\\mathit{\\Omega}");m("\\substack","\\begin{subarray}{c}#1\\end{subarray}");m("\\colon","\\nobreak\\mskip2mu\\mathpunct{}\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu\\relax");m("\\boxed","\\fbox{$\\displaystyle{#1}$}");m("\\iff","\\DOTSB\\;\\Longleftrightarrow\\;");m("\\implies","\\DOTSB\\;\\Longrightarrow\\;");m("\\impliedby","\\DOTSB\\;\\Longleftarrow\\;");m("\\dddot","{\\overset{\\raisebox{-0.1ex}{\\normalsize ...}}{#1}}");m("\\ddddot","{\\overset{\\raisebox{-0.1ex}{\\normalsize ....}}{#1}}");var dd={",":"\\dotsc","\\not":"\\dotsb","+":"\\dotsb","=":"\\dotsb","<":"\\dotsb",">":"\\dotsb","-":"\\dotsb","*":"\\dotsb",":":"\\dotsb","\\DOTSB":"\\dotsb","\\coprod":"\\dotsb","\\bigvee":"\\dotsb","\\bigwedge":"\\dotsb","\\biguplus":"\\dotsb","\\bigcap":"\\dotsb","\\bigcup":"\\dotsb","\\prod":"\\dotsb","\\sum":"\\dotsb","\\bigotimes":"\\dotsb","\\bigoplus":"\\dotsb","\\bigodot":"\\dotsb","\\bigsqcup":"\\dotsb","\\And":"\\dotsb","\\longrightarrow":"\\dotsb","\\Longrightarrow":"\\dotsb","\\longleftarrow":"\\dotsb","\\Longleftarrow":"\\dotsb","\\longleftrightarrow":"\\dotsb","\\Longleftrightarrow":"\\dotsb","\\mapsto":"\\dotsb","\\longmapsto":"\\dotsb","\\hookrightarrow":"\\dotsb","\\doteq":"\\dotsb","\\mathbin":"\\dotsb","\\mathrel":"\\dotsb","\\relbar":"\\dotsb","\\Relbar":"\\dotsb","\\xrightarrow":"\\dotsb","\\xleftarrow":"\\dotsb","\\DOTSI":"\\dotsi","\\int":"\\dotsi","\\oint":"\\dotsi","\\iint":"\\dotsi","\\iiint":"\\dotsi","\\iiiint":"\\dotsi","\\idotsint":"\\dotsi","\\DOTSX":"\\dotsx"},cb=new Set(["bin","rel"]);m("\\dots",function(t){var e="\\dotso",r=t.expandAfterFuture().text;return r in dd?e=dd[r]:(r.slice(0,4)==="\\not"||r in Te.math&&cb.has(Te.math[r].group))&&(e="\\dotsb"),e});var nc={")":!0,"]":!0,"\\rbrack":!0,"\\}":!0,"\\rbrace":!0,"\\rangle":!0,"\\rceil":!0,"\\rfloor":!0,"\\rgroup":!0,"\\rmoustache":!0,"\\right":!0,"\\bigr":!0,"\\biggr":!0,"\\Bigr":!0,"\\Biggr":!0,$:!0,";":!0,".":!0,",":!0};m("\\dotso",function(t){var e=t.future().text;return e in nc?"\\ldots\\,":"\\ldots"});m("\\dotsc",function(t){var e=t.future().text;return e in nc&&e!==","?"\\ldots\\,":"\\ldots"});m("\\cdots",function(t){var e=t.future().text;return e in nc?"\\@cdots\\,":"\\@cdots"});m("\\dotsb","\\cdots");m("\\dotsm","\\cdots");m("\\dotsi","\\!\\cdots");m("\\dotsx","\\ldots\\,");m("\\DOTSI","\\relax");m("\\DOTSB","\\relax");m("\\DOTSX","\\relax");m("\\tmspace","\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax");m("\\,","\\tmspace+{3mu}{.1667em}");m("\\thinspace","\\,");m("\\>","\\mskip{4mu}");m("\\:","\\tmspace+{4mu}{.2222em}");m("\\medspace","\\:");m("\\;","\\tmspace+{5mu}{.2777em}");m("\\thickspace","\\;");m("\\!","\\tmspace-{3mu}{.1667em}");m("\\negthinspace","\\!");m("\\negmedspace","\\tmspace-{4mu}{.2222em}");m("\\negthickspace","\\tmspace-{5mu}{.277em}");m("\\enspace","\\kern.5em ");m("\\enskip","\\hskip.5em\\relax");m("\\quad","\\hskip1em\\relax");m("\\qquad","\\hskip2em\\relax");m("\\tag","\\@ifstar\\tag@literal\\tag@paren");m("\\tag@paren","\\tag@literal{({#1})}");m("\\tag@literal",t=>{if(t.macros.get("\\df@tag"))throw new I("Multiple \\tag");return"\\gdef\\df@tag{\\text{#1}}"});m("\\bmod","\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");m("\\pod","\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");m("\\pmod","\\pod{{\\rm mod}\\mkern6mu#1}");m("\\mod","\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1");m("\\newline","\\\\\\relax");m("\\TeX","\\textrm{\\html@mathml{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}{TeX}}");var ah=L(sr["Main-Regular"][84][1]-.7*sr["Main-Regular"][65][1]);m("\\LaTeX","\\textrm{\\html@mathml{"+("L\\kern-.36em\\raisebox{"+ah+"}{\\scriptstyle A}")+"\\kern-.15em\\TeX}{LaTeX}}");m("\\KaTeX","\\textrm{\\html@mathml{"+("K\\kern-.17em\\raisebox{"+ah+"}{\\scriptstyle A}")+"\\kern-.15em\\TeX}{KaTeX}}");m("\\hspace","\\@ifstar\\@hspacer\\@hspace");m("\\@hspace","\\hskip #1\\relax");m("\\@hspacer","\\rule{0pt}{0pt}\\hskip #1\\relax");m("\\ordinarycolon",":");m("\\vcentcolon","\\mathrel{\\mathop\\ordinarycolon}");m("\\dblcolon",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}}{\\mathop{\\char"2237}}');m("\\coloneqq",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2254}}');m("\\Coloneqq",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}}{\\mathop{\\char"2237\\char"3d}}');m("\\coloneq",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"3a\\char"2212}}');m("\\Coloneq",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}}{\\mathop{\\char"2237\\char"2212}}');m("\\eqqcolon",'\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2255}}');m("\\Eqqcolon",'\\html@mathml{\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"3d\\char"2237}}');m("\\eqcolon",'\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}}{\\mathop{\\char"2239}}');m("\\Eqcolon",'\\html@mathml{\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}}{\\mathop{\\char"2212\\char"2237}}');m("\\colonapprox",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"3a\\char"2248}}');m("\\Colonapprox",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}}{\\mathop{\\char"2237\\char"2248}}');m("\\colonsim",'\\html@mathml{\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"3a\\char"223c}}');m("\\Colonsim",'\\html@mathml{\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}}{\\mathop{\\char"2237\\char"223c}}');m("∷","\\dblcolon");m("∹","\\eqcolon");m("≔","\\coloneqq");m("≕","\\eqqcolon");m("⩴","\\Coloneqq");m("\\ratio","\\vcentcolon");m("\\coloncolon","\\dblcolon");m("\\colonequals","\\coloneqq");m("\\coloncolonequals","\\Coloneqq");m("\\equalscolon","\\eqqcolon");m("\\equalscoloncolon","\\Eqqcolon");m("\\colonminus","\\coloneq");m("\\coloncolonminus","\\Coloneq");m("\\minuscolon","\\eqcolon");m("\\minuscoloncolon","\\Eqcolon");m("\\coloncolonapprox","\\Colonapprox");m("\\coloncolonsim","\\Colonsim");m("\\simcolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");m("\\simcoloncolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");m("\\approxcolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");m("\\approxcoloncolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}");m("\\notni","\\html@mathml{\\not\\ni}{\\mathrel{\\char`∌}}");m("\\limsup","\\DOTSB\\operatorname*{lim\\,sup}");m("\\liminf","\\DOTSB\\operatorname*{lim\\,inf}");m("\\injlim","\\DOTSB\\operatorname*{inj\\,lim}");m("\\projlim","\\DOTSB\\operatorname*{proj\\,lim}");m("\\varlimsup","\\DOTSB\\operatorname*{\\overline{lim}}");m("\\varliminf","\\DOTSB\\operatorname*{\\underline{lim}}");m("\\varinjlim","\\DOTSB\\operatorname*{\\underrightarrow{lim}}");m("\\varprojlim","\\DOTSB\\operatorname*{\\underleftarrow{lim}}");m("\\gvertneqq","\\html@mathml{\\@gvertneqq}{≩}");m("\\lvertneqq","\\html@mathml{\\@lvertneqq}{≨}");m("\\ngeqq","\\html@mathml{\\@ngeqq}{≱}");m("\\ngeqslant","\\html@mathml{\\@ngeqslant}{≱}");m("\\nleqq","\\html@mathml{\\@nleqq}{≰}");m("\\nleqslant","\\html@mathml{\\@nleqslant}{≰}");m("\\nshortmid","\\html@mathml{\\@nshortmid}{∤}");m("\\nshortparallel","\\html@mathml{\\@nshortparallel}{∦}");m("\\nsubseteqq","\\html@mathml{\\@nsubseteqq}{⊈}");m("\\nsupseteqq","\\html@mathml{\\@nsupseteqq}{⊉}");m("\\varsubsetneq","\\html@mathml{\\@varsubsetneq}{⊊}");m("\\varsubsetneqq","\\html@mathml{\\@varsubsetneqq}{⫋}");m("\\varsupsetneq","\\html@mathml{\\@varsupsetneq}{⊋}");m("\\varsupsetneqq","\\html@mathml{\\@varsupsetneqq}{⫌}");m("\\imath","\\html@mathml{\\@imath}{ı}");m("\\jmath","\\html@mathml{\\@jmath}{ȷ}");m("\\llbracket","\\html@mathml{\\mathopen{[\\mkern-3.2mu[}}{\\mathopen{\\char`⟦}}");m("\\rrbracket","\\html@mathml{\\mathclose{]\\mkern-3.2mu]}}{\\mathclose{\\char`⟧}}");m("⟦","\\llbracket");m("⟧","\\rrbracket");m("\\lBrace","\\html@mathml{\\mathopen{\\{\\mkern-3.2mu[}}{\\mathopen{\\char`⦃}}");m("\\rBrace","\\html@mathml{\\mathclose{]\\mkern-3.2mu\\}}}{\\mathclose{\\char`⦄}}");m("⦃","\\lBrace");m("⦄","\\rBrace");m("\\minuso","\\mathbin{\\html@mathml{{\\mathrlap{\\mathchoice{\\kern{0.145em}}{\\kern{0.145em}}{\\kern{0.1015em}}{\\kern{0.0725em}}\\circ}{-}}}{\\char`⦵}}");m("⦵","\\minuso");m("\\darr","\\downarrow");m("\\dArr","\\Downarrow");m("\\Darr","\\Downarrow");m("\\lang","\\langle");m("\\rang","\\rangle");m("\\uarr","\\uparrow");m("\\uArr","\\Uparrow");m("\\Uarr","\\Uparrow");m("\\N","\\mathbb{N}");m("\\R","\\mathbb{R}");m("\\Z","\\mathbb{Z}");m("\\alef","\\aleph");m("\\alefsym","\\aleph");m("\\Alpha","\\mathrm{A}");m("\\Beta","\\mathrm{B}");m("\\bull","\\bullet");m("\\Chi","\\mathrm{X}");m("\\clubs","\\clubsuit");m("\\cnums","\\mathbb{C}");m("\\Complex","\\mathbb{C}");m("\\Dagger","\\ddagger");m("\\diamonds","\\diamondsuit");m("\\empty","\\emptyset");m("\\Epsilon","\\mathrm{E}");m("\\Eta","\\mathrm{H}");m("\\exist","\\exists");m("\\harr","\\leftrightarrow");m("\\hArr","\\Leftrightarrow");m("\\Harr","\\Leftrightarrow");m("\\hearts","\\heartsuit");m("\\image","\\Im");m("\\infin","\\infty");m("\\Iota","\\mathrm{I}");m("\\isin","\\in");m("\\Kappa","\\mathrm{K}");m("\\larr","\\leftarrow");m("\\lArr","\\Leftarrow");m("\\Larr","\\Leftarrow");m("\\lrarr","\\leftrightarrow");m("\\lrArr","\\Leftrightarrow");m("\\Lrarr","\\Leftrightarrow");m("\\Mu","\\mathrm{M}");m("\\natnums","\\mathbb{N}");m("\\Nu","\\mathrm{N}");m("\\Omicron","\\mathrm{O}");m("\\plusmn","\\pm");m("\\rarr","\\rightarrow");m("\\rArr","\\Rightarrow");m("\\Rarr","\\Rightarrow");m("\\real","\\Re");m("\\reals","\\mathbb{R}");m("\\Reals","\\mathbb{R}");m("\\Rho","\\mathrm{P}");m("\\sdot","\\cdot");m("\\sect","\\S");m("\\spades","\\spadesuit");m("\\sub","\\subset");m("\\sube","\\subseteq");m("\\supe","\\supseteq");m("\\Tau","\\mathrm{T}");m("\\thetasym","\\vartheta");m("\\weierp","\\wp");m("\\Zeta","\\mathrm{Z}");m("\\argmin","\\DOTSB\\operatorname*{arg\\,min}");m("\\argmax","\\DOTSB\\operatorname*{arg\\,max}");m("\\plim","\\DOTSB\\mathop{\\operatorname{plim}}\\limits");m("\\bra","\\mathinner{\\langle{#1}|}");m("\\ket","\\mathinner{|{#1}\\rangle}");m("\\braket","\\mathinner{\\langle{#1}\\rangle}");m("\\Bra","\\left\\langle#1\\right|");m("\\Ket","\\left|#1\\right\\rangle");var oh=t=>e=>{var r=e.consumeArg().tokens,i=e.consumeArg().tokens,s=e.consumeArg().tokens,a=e.consumeArg().tokens,o=e.macros.get("|"),l=e.macros.get("\\|");e.macros.beginGroup();var c=b=>y=>{t&&(y.macros.set("|",o),s.length&&y.macros.set("\\|",l));var k=b;if(!b&&s.length){var z=y.future();z.text==="|"&&(y.popToken(),k=!0)}return{tokens:k?s:i,numArgs:0}};e.macros.set("|",c(!1)),s.length&&e.macros.set("\\|",c(!0));var h=e.consumeArg().tokens,f=e.expandTokens([...a,...h,...r]);return e.macros.endGroup(),{tokens:f.reverse(),numArgs:0}};m("\\bra@ket",oh(!1));m("\\bra@set",oh(!0));m("\\Braket","\\bra@ket{\\left\\langle}{\\,\\middle\\vert\\,}{\\,\\middle\\vert\\,}{\\right\\rangle}");m("\\Set","\\bra@set{\\left\\{\\:}{\\;\\middle\\vert\\;}{\\;\\middle\\Vert\\;}{\\:\\right\\}}");m("\\set","\\bra@set{\\{\\,}{\\mid}{}{\\,\\}}");m("\\angln","{\\angl n}");m("\\blue","\\textcolor{##6495ed}{#1}");m("\\orange","\\textcolor{##ffa500}{#1}");m("\\pink","\\textcolor{##ff00af}{#1}");m("\\red","\\textcolor{##df0030}{#1}");m("\\green","\\textcolor{##28ae7b}{#1}");m("\\gray","\\textcolor{gray}{#1}");m("\\purple","\\textcolor{##9d38bd}{#1}");m("\\blueA","\\textcolor{##ccfaff}{#1}");m("\\blueB","\\textcolor{##80f6ff}{#1}");m("\\blueC","\\textcolor{##63d9ea}{#1}");m("\\blueD","\\textcolor{##11accd}{#1}");m("\\blueE","\\textcolor{##0c7f99}{#1}");m("\\tealA","\\textcolor{##94fff5}{#1}");m("\\tealB","\\textcolor{##26edd5}{#1}");m("\\tealC","\\textcolor{##01d1c1}{#1}");m("\\tealD","\\textcolor{##01a995}{#1}");m("\\tealE","\\textcolor{##208170}{#1}");m("\\greenA","\\textcolor{##b6ffb0}{#1}");m("\\greenB","\\textcolor{##8af281}{#1}");m("\\greenC","\\textcolor{##74cf70}{#1}");m("\\greenD","\\textcolor{##1fab54}{#1}");m("\\greenE","\\textcolor{##0d923f}{#1}");m("\\goldA","\\textcolor{##ffd0a9}{#1}");m("\\goldB","\\textcolor{##ffbb71}{#1}");m("\\goldC","\\textcolor{##ff9c39}{#1}");m("\\goldD","\\textcolor{##e07d10}{#1}");m("\\goldE","\\textcolor{##a75a05}{#1}");m("\\redA","\\textcolor{##fca9a9}{#1}");m("\\redB","\\textcolor{##ff8482}{#1}");m("\\redC","\\textcolor{##f9685d}{#1}");m("\\redD","\\textcolor{##e84d39}{#1}");m("\\redE","\\textcolor{##bc2612}{#1}");m("\\maroonA","\\textcolor{##ffbde0}{#1}");m("\\maroonB","\\textcolor{##ff92c6}{#1}");m("\\maroonC","\\textcolor{##ed5fa6}{#1}");m("\\maroonD","\\textcolor{##ca337c}{#1}");m("\\maroonE","\\textcolor{##9e034e}{#1}");m("\\purpleA","\\textcolor{##ddd7ff}{#1}");m("\\purpleB","\\textcolor{##c6b9fc}{#1}");m("\\purpleC","\\textcolor{##aa87ff}{#1}");m("\\purpleD","\\textcolor{##7854ab}{#1}");m("\\purpleE","\\textcolor{##543b78}{#1}");m("\\mintA","\\textcolor{##f5f9e8}{#1}");m("\\mintB","\\textcolor{##edf2df}{#1}");m("\\mintC","\\textcolor{##e0e5cc}{#1}");m("\\grayA","\\textcolor{##f6f7f7}{#1}");m("\\grayB","\\textcolor{##f0f1f2}{#1}");m("\\grayC","\\textcolor{##e3e5e6}{#1}");m("\\grayD","\\textcolor{##d6d8da}{#1}");m("\\grayE","\\textcolor{##babec2}{#1}");m("\\grayF","\\textcolor{##888d93}{#1}");m("\\grayG","\\textcolor{##626569}{#1}");m("\\grayH","\\textcolor{##3b3e40}{#1}");m("\\grayI","\\textcolor{##21242c}{#1}");m("\\kaBlue","\\textcolor{##314453}{#1}");m("\\kaGreen","\\textcolor{##71B307}{#1}");var nh={"^":!0,_:!0,"\\limits":!0,"\\nolimits":!0};class db{constructor(e,r,i){this.settings=void 0,this.expansionCount=void 0,this.lexer=void 0,this.macros=void 0,this.stack=void 0,this.mode=void 0,this.settings=r,this.expansionCount=0,this.feed(e),this.macros=new nb(lb,r.macros),this.mode=i,this.stack=[]}feed(e){this.lexer=new ld(e,this.settings)}switchMode(e){this.mode=e}beginGroup(){this.macros.beginGroup()}endGroup(){this.macros.endGroup()}endGroups(){this.macros.endGroups()}future(){return this.stack.length===0&&this.pushToken(this.lexer.lex()),this.stack[this.stack.length-1]}popToken(){return this.future(),this.stack.pop()}pushToken(e){this.stack.push(e)}pushTokens(e){this.stack.push(...e)}scanArgument(e){var r,i,s;if(e){if(this.consumeSpaces(),this.future().text!=="[")return null;r=this.popToken(),{tokens:s,end:i}=this.consumeArg(["]"])}else({tokens:s,start:r,end:i}=this.consumeArg());return this.pushToken(new gt("EOF",i.loc)),this.pushTokens(s),new gt("",ut.range(r,i))}consumeSpaces(){for(;;){var e=this.future();if(e.text===" ")this.stack.pop();else break}}consumeArg(e){var r=[],i=e&&e.length>0;i||this.consumeSpaces();var s=this.future(),a,o=0,l=0;do{if(a=this.popToken(),r.push(a),a.text==="{")++o;else if(a.text==="}"){if(--o,o===-1)throw new I("Extra }",a)}else if(a.text==="EOF")throw new I("Unexpected end of input in a macro argument, expected '"+(e&&i?e[l]:"}")+"'",a);if(e&&i)if((o===0||o===1&&e[l]==="{")&&a.text===e[l]){if(++l,l===e.length){r.splice(-l,l);break}}else l=0}while(o!==0||i);return s.text==="{"&&r[r.length-1].text==="}"&&(r.pop(),r.shift()),r.reverse(),{tokens:r,start:s,end:a}}consumeArgs(e,r){if(r){if(r.length!==e+1)throw new I("The length of delimiters doesn't match the number of args!");for(var i=r[0],s=0;s<i.length;s++){var a=this.popToken();if(i[s]!==a.text)throw new I("Use of the macro doesn't match its definition",a)}}for(var o=[],l=0;l<e;l++)o.push(this.consumeArg(r&&r[l+1]).tokens);return o}countExpansion(e){if(this.expansionCount+=e,this.expansionCount>this.settings.maxExpand)throw new I("Too many expansions: infinite loop or need to increase maxExpand setting")}expandOnce(e){var r=this.popToken(),i=r.text,s=r.noexpand?null:this._getExpansion(i);if(s==null||e&&s.unexpandable){if(e&&s==null&&i[0]==="\\"&&!this.isDefined(i))throw new I("Undefined control sequence: "+i);return this.pushToken(r),!1}this.countExpansion(1);var a=s.tokens,o=this.consumeArgs(s.numArgs,s.delimiters);if(s.numArgs){a=a.slice();for(var l=a.length-1;l>=0;--l){var c=a[l];if(c.text==="#"){if(l===0)throw new I("Incomplete placeholder at end of macro body",c);if(c=a[--l],c.text==="#")a.splice(l+1,1);else if(/^[1-9]$/.test(c.text))a.splice(l,2,...o[+c.text-1]);else throw new I("Not a valid argument number",c)}}}return this.pushTokens(a),a.length}expandAfterFuture(){return this.expandOnce(),this.future()}expandNextToken(){for(;;)if(this.expandOnce()===!1){var e=this.stack.pop();return e.treatAsRelax&&(e.text="\\relax"),e}}expandMacro(e){return this.macros.has(e)?this.expandTokens([new gt(e)]):void 0}expandTokens(e){var r=[],i=this.stack.length;for(this.pushTokens(e);this.stack.length>i;)if(this.expandOnce(!0)===!1){var s=this.stack.pop();s.treatAsRelax&&(s.noexpand=!1,s.treatAsRelax=!1),r.push(s)}return this.countExpansion(r.length),r}expandMacroAsText(e){var r=this.expandMacro(e);return r&&r.map(i=>i.text).join("")}_getExpansion(e){var r=this.macros.get(e);if(r==null)return r;if(e.length===1){var i=this.lexer.catcodes[e];if(i!=null&&i!==13)return}var s=typeof r=="function"?r(this):r;if(typeof s=="string"){var a=0;if(s.includes("#"))for(var o=s.replace(/##/g,"");o.includes("#"+(a+1));)++a;for(var l=new ld(s,this.settings),c=[],h=l.lex();h.text!=="EOF";)c.push(h),h=l.lex();c.reverse();var f={tokens:c,numArgs:a};return f}return s}isDefined(e){return this.macros.has(e)||Gr.hasOwnProperty(e)||Te.math.hasOwnProperty(e)||Te.text.hasOwnProperty(e)||nh.hasOwnProperty(e)}isExpandable(e){var r=this.macros.get(e);return r!=null?typeof r=="string"||typeof r=="function"||!r.unexpandable:Gr.hasOwnProperty(e)&&!Gr[e].primitive}}var ud=/^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/,Xa=Object.freeze({"₊":"+","₋":"-","₌":"=","₍":"(","₎":")","₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9","ₐ":"a","ₑ":"e","ₕ":"h","ᵢ":"i","ⱼ":"j","ₖ":"k","ₗ":"l","ₘ":"m","ₙ":"n","ₒ":"o","ₚ":"p","ᵣ":"r","ₛ":"s","ₜ":"t","ᵤ":"u","ᵥ":"v","ₓ":"x","ᵦ":"β","ᵧ":"γ","ᵨ":"ρ","ᵩ":"ϕ","ᵪ":"χ","⁺":"+","⁻":"-","⁼":"=","⁽":"(","⁾":")","⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","ᴬ":"A","ᴮ":"B","ᴰ":"D","ᴱ":"E","ᴳ":"G","ᴴ":"H","ᴵ":"I","ᴶ":"J","ᴷ":"K","ᴸ":"L","ᴹ":"M","ᴺ":"N","ᴼ":"O","ᴾ":"P","ᴿ":"R","ᵀ":"T","ᵁ":"U","ⱽ":"V","ᵂ":"W","ᵃ":"a","ᵇ":"b","ᶜ":"c","ᵈ":"d","ᵉ":"e","ᶠ":"f","ᵍ":"g",ʰ:"h","ⁱ":"i",ʲ:"j","ᵏ":"k",ˡ:"l","ᵐ":"m",ⁿ:"n","ᵒ":"o","ᵖ":"p",ʳ:"r",ˢ:"s","ᵗ":"t","ᵘ":"u","ᵛ":"v",ʷ:"w",ˣ:"x",ʸ:"y","ᶻ":"z","ᵝ":"β","ᵞ":"γ","ᵟ":"δ","ᵠ":"ϕ","ᵡ":"χ","ᶿ":"θ"}),Ln={"́":{text:"\\'",math:"\\acute"},"̀":{text:"\\`",math:"\\grave"},"̈":{text:'\\"',math:"\\ddot"},"̃":{text:"\\~",math:"\\tilde"},"̄":{text:"\\=",math:"\\bar"},"̆":{text:"\\u",math:"\\breve"},"̌":{text:"\\v",math:"\\check"},"̂":{text:"\\^",math:"\\hat"},"̇":{text:"\\.",math:"\\dot"},"̊":{text:"\\r",math:"\\mathring"},"̋":{text:"\\H"},"̧":{text:"\\c"}},hd={á:"á",à:"à",ä:"ä",ǟ:"ǟ",ã:"ã",ā:"ā",ă:"ă",ắ:"ắ",ằ:"ằ",ẵ:"ẵ",ǎ:"ǎ",â:"â",ấ:"ấ",ầ:"ầ",ẫ:"ẫ",ȧ:"ȧ",ǡ:"ǡ",å:"å",ǻ:"ǻ",ḃ:"ḃ",ć:"ć",ḉ:"ḉ",č:"č",ĉ:"ĉ",ċ:"ċ",ç:"ç",ď:"ď",ḋ:"ḋ",ḑ:"ḑ",é:"é",è:"è",ë:"ë",ẽ:"ẽ",ē:"ē",ḗ:"ḗ",ḕ:"ḕ",ĕ:"ĕ",ḝ:"ḝ",ě:"ě",ê:"ê",ế:"ế",ề:"ề",ễ:"ễ",ė:"ė",ȩ:"ȩ",ḟ:"ḟ",ǵ:"ǵ",ḡ:"ḡ",ğ:"ğ",ǧ:"ǧ",ĝ:"ĝ",ġ:"ġ",ģ:"ģ",ḧ:"ḧ",ȟ:"ȟ",ĥ:"ĥ",ḣ:"ḣ",ḩ:"ḩ",í:"í",ì:"ì",ï:"ï",ḯ:"ḯ",ĩ:"ĩ",ī:"ī",ĭ:"ĭ",ǐ:"ǐ",î:"î",ǰ:"ǰ",ĵ:"ĵ",ḱ:"ḱ",ǩ:"ǩ",ķ:"ķ",ĺ:"ĺ",ľ:"ľ",ļ:"ļ",ḿ:"ḿ",ṁ:"ṁ",ń:"ń",ǹ:"ǹ",ñ:"ñ",ň:"ň",ṅ:"ṅ",ņ:"ņ",ó:"ó",ò:"ò",ö:"ö",ȫ:"ȫ",õ:"õ",ṍ:"ṍ",ṏ:"ṏ",ȭ:"ȭ",ō:"ō",ṓ:"ṓ",ṑ:"ṑ",ŏ:"ŏ",ǒ:"ǒ",ô:"ô",ố:"ố",ồ:"ồ",ỗ:"ỗ",ȯ:"ȯ",ȱ:"ȱ",ő:"ő",ṕ:"ṕ",ṗ:"ṗ",ŕ:"ŕ",ř:"ř",ṙ:"ṙ",ŗ:"ŗ",ś:"ś",ṥ:"ṥ",š:"š",ṧ:"ṧ",ŝ:"ŝ",ṡ:"ṡ",ş:"ş",ẗ:"ẗ",ť:"ť",ṫ:"ṫ",ţ:"ţ",ú:"ú",ù:"ù",ü:"ü",ǘ:"ǘ",ǜ:"ǜ",ǖ:"ǖ",ǚ:"ǚ",ũ:"ũ",ṹ:"ṹ",ū:"ū",ṻ:"ṻ",ŭ:"ŭ",ǔ:"ǔ",û:"û",ů:"ů",ű:"ű",ṽ:"ṽ",ẃ:"ẃ",ẁ:"ẁ",ẅ:"ẅ",ŵ:"ŵ",ẇ:"ẇ",ẘ:"ẘ",ẍ:"ẍ",ẋ:"ẋ",ý:"ý",ỳ:"ỳ",ÿ:"ÿ",ỹ:"ỹ",ȳ:"ȳ",ŷ:"ŷ",ẏ:"ẏ",ẙ:"ẙ",ź:"ź",ž:"ž",ẑ:"ẑ",ż:"ż",Á:"Á",À:"À",Ä:"Ä",Ǟ:"Ǟ",Ã:"Ã",Ā:"Ā",Ă:"Ă",Ắ:"Ắ",Ằ:"Ằ",Ẵ:"Ẵ",Ǎ:"Ǎ",Â:"Â",Ấ:"Ấ",Ầ:"Ầ",Ẫ:"Ẫ",Ȧ:"Ȧ",Ǡ:"Ǡ",Å:"Å",Ǻ:"Ǻ",Ḃ:"Ḃ",Ć:"Ć",Ḉ:"Ḉ",Č:"Č",Ĉ:"Ĉ",Ċ:"Ċ",Ç:"Ç",Ď:"Ď",Ḋ:"Ḋ",Ḑ:"Ḑ",É:"É",È:"È",Ë:"Ë",Ẽ:"Ẽ",Ē:"Ē",Ḗ:"Ḗ",Ḕ:"Ḕ",Ĕ:"Ĕ",Ḝ:"Ḝ",Ě:"Ě",Ê:"Ê",Ế:"Ế",Ề:"Ề",Ễ:"Ễ",Ė:"Ė",Ȩ:"Ȩ",Ḟ:"Ḟ",Ǵ:"Ǵ",Ḡ:"Ḡ",Ğ:"Ğ",Ǧ:"Ǧ",Ĝ:"Ĝ",Ġ:"Ġ",Ģ:"Ģ",Ḧ:"Ḧ",Ȟ:"Ȟ",Ĥ:"Ĥ",Ḣ:"Ḣ",Ḩ:"Ḩ",Í:"Í",Ì:"Ì",Ï:"Ï",Ḯ:"Ḯ",Ĩ:"Ĩ",Ī:"Ī",Ĭ:"Ĭ",Ǐ:"Ǐ",Î:"Î",İ:"İ",Ĵ:"Ĵ",Ḱ:"Ḱ",Ǩ:"Ǩ",Ķ:"Ķ",Ĺ:"Ĺ",Ľ:"Ľ",Ļ:"Ļ",Ḿ:"Ḿ",Ṁ:"Ṁ",Ń:"Ń",Ǹ:"Ǹ",Ñ:"Ñ",Ň:"Ň",Ṅ:"Ṅ",Ņ:"Ņ",Ó:"Ó",Ò:"Ò",Ö:"Ö",Ȫ:"Ȫ",Õ:"Õ",Ṍ:"Ṍ",Ṏ:"Ṏ",Ȭ:"Ȭ",Ō:"Ō",Ṓ:"Ṓ",Ṑ:"Ṑ",Ŏ:"Ŏ",Ǒ:"Ǒ",Ô:"Ô",Ố:"Ố",Ồ:"Ồ",Ỗ:"Ỗ",Ȯ:"Ȯ",Ȱ:"Ȱ",Ő:"Ő",Ṕ:"Ṕ",Ṗ:"Ṗ",Ŕ:"Ŕ",Ř:"Ř",Ṙ:"Ṙ",Ŗ:"Ŗ",Ś:"Ś",Ṥ:"Ṥ",Š:"Š",Ṧ:"Ṧ",Ŝ:"Ŝ",Ṡ:"Ṡ",Ş:"Ş",Ť:"Ť",Ṫ:"Ṫ",Ţ:"Ţ",Ú:"Ú",Ù:"Ù",Ü:"Ü",Ǘ:"Ǘ",Ǜ:"Ǜ",Ǖ:"Ǖ",Ǚ:"Ǚ",Ũ:"Ũ",Ṹ:"Ṹ",Ū:"Ū",Ṻ:"Ṻ",Ŭ:"Ŭ",Ǔ:"Ǔ",Û:"Û",Ů:"Ů",Ű:"Ű",Ṽ:"Ṽ",Ẃ:"Ẃ",Ẁ:"Ẁ",Ẅ:"Ẅ",Ŵ:"Ŵ",Ẇ:"Ẇ",Ẍ:"Ẍ",Ẋ:"Ẋ",Ý:"Ý",Ỳ:"Ỳ",Ÿ:"Ÿ",Ỹ:"Ỹ",Ȳ:"Ȳ",Ŷ:"Ŷ",Ẏ:"Ẏ",Ź:"Ź",Ž:"Ž",Ẑ:"Ẑ",Ż:"Ż",ά:"ά",ὰ:"ὰ",ᾱ:"ᾱ",ᾰ:"ᾰ",έ:"έ",ὲ:"ὲ",ή:"ή",ὴ:"ὴ",ί:"ί",ὶ:"ὶ",ϊ:"ϊ",ΐ:"ΐ",ῒ:"ῒ",ῑ:"ῑ",ῐ:"ῐ",ό:"ό",ὸ:"ὸ",ύ:"ύ",ὺ:"ὺ",ϋ:"ϋ",ΰ:"ΰ",ῢ:"ῢ",ῡ:"ῡ",ῠ:"ῠ",ώ:"ώ",ὼ:"ὼ",Ύ:"Ύ",Ὺ:"Ὺ",Ϋ:"Ϋ",Ῡ:"Ῡ",Ῠ:"Ῠ",Ώ:"Ώ",Ὼ:"Ὼ"};class Fo{constructor(e,r){this.mode=void 0,this.gullet=void 0,this.settings=void 0,this.leftrightDepth=void 0,this.nextToken=void 0,this.mode="math",this.gullet=new db(e,r,this.mode),this.settings=r,this.leftrightDepth=0,this.nextToken=null}expect(e,r){if(r===void 0&&(r=!0),this.fetch().text!==e)throw new I("Expected '"+e+"', got '"+this.fetch().text+"'",this.fetch());r&&this.consume()}consume(){this.nextToken=null}fetch(){return this.nextToken==null&&(this.nextToken=this.gullet.expandNextToken()),this.nextToken}switchMode(e){this.mode=e,this.gullet.switchMode(e)}parse(){this.settings.globalGroup||this.gullet.beginGroup(),this.settings.colorIsTextColor&&this.gullet.macros.set("\\color","\\textcolor");try{var e=this.parseExpression(!1);return this.expect("EOF"),this.settings.globalGroup||this.gullet.endGroup(),e}finally{this.gullet.endGroups()}}subparse(e){var r=this.nextToken;this.consume(),this.gullet.pushToken(new gt("}")),this.gullet.pushTokens(e);var i=this.parseExpression(!1);return this.expect("}"),this.nextToken=r,i}parseExpression(e,r){for(var i=[];;){this.mode==="math"&&this.consumeSpaces();var s=this.fetch();if(Fo.endOfExpression.has(s.text)||r&&s.text===r||e&&Gr[s.text]&&Gr[s.text].infix)break;var a=this.parseAtom(r);if(a){if(a.type==="internal")continue}else break;i.push(a)}return this.mode==="text"&&this.formLigatures(i),this.handleInfixNodes(i)}handleInfixNodes(e){for(var r=-1,i,s=0;s<e.length;s++){var a=e[s];if(a.type==="infix"){if(r!==-1)throw new I("only one infix operator per group",a.token);r=s,i=a.replaceWith}}if(r!==-1&&i){var o,l,c=e.slice(0,r),h=e.slice(r+1);c.length===1&&c[0].type==="ordgroup"?o=c[0]:o={type:"ordgroup",mode:this.mode,body:c},h.length===1&&h[0].type==="ordgroup"?l=h[0]:l={type:"ordgroup",mode:this.mode,body:h};var f;return i==="\\\\abovefrac"?f=this.callFunction(i,[o,e[r],l],[]):f=this.callFunction(i,[o,l],[]),[f]}else return e}handleSupSubscript(e){var r=this.fetch(),i=r.text;this.consume(),this.consumeSpaces();var s;do{var a;s=this.parseGroup(e)}while(((a=s)==null?void 0:a.type)==="internal");if(!s)throw new I("Expected group after '"+i+"'",r);return s}formatUnsupportedCmd(e){for(var r=[],i=0;i<e.length;i++)r.push({type:"textord",mode:"text",text:e[i]});var s={type:"text",mode:this.mode,body:r},a={type:"color",mode:this.mode,color:this.settings.errorColor,body:[s]};return a}parseAtom(e){var r=this.parseGroup("atom",e);if((r==null?void 0:r.type)==="internal"||this.mode==="text")return r;for(var i,s;;){this.consumeSpaces();var a=this.fetch();if(a.text==="\\limits"||a.text==="\\nolimits"){if(r&&r.type==="op")r.limits=a.text==="\\limits",r.alwaysHandleSupSub=!0;else if(r&&r.type==="operatorname")r.alwaysHandleSupSub&&(r.limits=a.text==="\\limits");else throw new I("Limit controls must follow a math operator",a);this.consume()}else if(a.text==="^"){if(i)throw new I("Double superscript",a);i=this.handleSupSubscript("superscript")}else if(a.text==="_"){if(s)throw new I("Double subscript",a);s=this.handleSupSubscript("subscript")}else if(a.text==="'"){if(i)throw new I("Double superscript",a);var o={type:"textord",mode:this.mode,text:"\\prime"},l=[o];for(this.consume();this.fetch().text==="'";)l.push(o),this.consume();this.fetch().text==="^"&&l.push(this.handleSupSubscript("superscript")),i={type:"ordgroup",mode:this.mode,body:l}}else if(Xa[a.text]){var c=ud.test(a.text),h=[];for(h.push(new gt(Xa[a.text])),this.consume();;){var f=this.fetch().text;if(!Xa[f]||ud.test(f)!==c)break;h.unshift(new gt(Xa[f])),this.consume()}var b=this.subparse(h);c?s={type:"ordgroup",mode:"math",body:b}:i={type:"ordgroup",mode:"math",body:b}}else break}return i&&s?{type:"supsub",mode:this.mode,base:r,sup:i,sub:s}:i?{type:"supsub",mode:this.mode,base:r,sup:i}:s?{type:"supsub",mode:this.mode,base:r,sub:s}:r}parseFunction(e,r){var i=this.fetch(),s=i.text,a=Gr[s];if(!a)return null;if(this.consume(),r&&r!=="atom"&&!a.allowedInArgument)throw new I("Got function '"+s+"' with no arguments"+(r?" as "+r:""),i);if(this.mode==="text"&&!a.allowedInText)throw new I("Can't use function '"+s+"' in text mode",i);if(this.mode==="math"&&a.allowedInMath===!1)throw new I("Can't use function '"+s+"' in math mode",i);var{args:o,optArgs:l}=this.parseArguments(s,a);return this.callFunction(s,o,l,i,e)}callFunction(e,r,i,s,a){var o={funcName:e,parser:this,token:s,breakOnTokenText:a},l=Gr[e];if(l&&l.handler)return l.handler(o,r,i);throw new I("No function handler for "+e)}parseArguments(e,r){var i,s=(i=r.numOptionalArgs)!=null?i:0,a=r.numArgs+s;if(a===0)return{args:[],optArgs:[]};for(var o=[],l=[],c=0;c<a;c++){var h,f=(h=r.argTypes)==null?void 0:h[c],b=c<s;("primitive"in r&&r.primitive&&f==null||r.type==="sqrt"&&c===1&&l[0]==null)&&(f="primitive");var y=this.parseGroupOfType("argument to '"+e+"'",f,b);if(b)l.push(y);else if(y!=null)o.push(y);else throw new I("Null argument, please report this as a bug")}return{args:o,optArgs:l}}parseGroupOfType(e,r,i){switch(r){case"color":return this.parseColorGroup(i);case"size":return this.parseSizeGroup(i);case"url":return this.parseUrlGroup(i);case"math":case"text":return this.parseArgumentGroup(i,r);case"hbox":{var s=this.parseArgumentGroup(i,"text");return s!=null?{type:"styling",mode:s.mode,body:[s],style:"text",resetFont:!0}:null}case"raw":{var a=this.parseStringGroup(i);return a!=null?{type:"raw",mode:"text",string:a.text}:null}case"primitive":{if(i)throw new I("A primitive argument cannot be optional");var o=this.parseGroup(e);if(o==null)throw new I("Expected group as "+e,this.fetch());return o}case"original":case void 0:return this.parseArgumentGroup(i);default:throw new I("Unknown group type as "+e,this.fetch())}}consumeSpaces(){for(;this.fetch().text===" ";)this.consume()}parseStringGroup(e){var r=this.gullet.scanArgument(e);if(r==null)return null;for(var i="",s;(s=this.fetch()).text!=="EOF";)i+=s.text,this.consume();return this.consume(),r.text=i,r}parseRegexGroup(e,r){for(var i=this.fetch(),s=i,a="",o;(o=this.fetch()).text!=="EOF"&&e.test(a+o.text);)s=o,a+=s.text,this.consume();if(a==="")throw new I("Invalid "+r+": '"+i.text+"'",i);return i.range(s,a)}parseColorGroup(e){var r=this.parseStringGroup(e);if(r==null)return null;var i=/^(#[a-f0-9]{3,4}|#[a-f0-9]{6}|#[a-f0-9]{8}|[a-f0-9]{6}|[a-z]+)$/i.exec(r.text);if(!i)throw new I("Invalid color: '"+r.text+"'",r);var s=i[0];return/^[0-9a-f]{6}$/i.test(s)&&(s="#"+s),{type:"color-token",mode:this.mode,color:s}}parseSizeGroup(e){var r,i=!1;if(this.gullet.consumeSpaces(),!e&&this.gullet.future().text!=="{"?r=this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/,"size"):r=this.parseStringGroup(e),!r)return null;!e&&r.text.length===0&&(r.text="0pt",i=!0);var s=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(r.text);if(!s)throw new I("Invalid size: '"+r.text+"'",r);var a={number:+(s[1]+s[2]),unit:s[3]};if(!yu(a))throw new I("Invalid unit: '"+a.unit+"'",r);return{type:"size",mode:this.mode,value:a,isBlank:i}}parseUrlGroup(e){this.gullet.lexer.setCatcode("%",13),this.gullet.lexer.setCatcode("~",12);var r=this.parseStringGroup(e);if(this.gullet.lexer.setCatcode("%",14),this.gullet.lexer.setCatcode("~",13),r==null)return null;var i=r.text.replace(/\\([#$%&~_^{}])/g,"$1");return{type:"url",mode:this.mode,url:i}}parseArgumentGroup(e,r){var i=this.gullet.scanArgument(e);if(i==null)return null;var s=this.mode;r&&this.switchMode(r),this.gullet.beginGroup();var a=this.parseExpression(!1,"EOF");this.expect("EOF"),this.gullet.endGroup();var o={type:"ordgroup",mode:this.mode,loc:i.loc,body:a};return r&&this.switchMode(s),o}parseGroup(e,r){var i=this.fetch(),s=i.text,a;if(s==="{"||s==="\\begingroup"){this.consume();var o=s==="{"?"}":"\\endgroup";this.gullet.beginGroup();var l=this.parseExpression(!1,o),c=this.fetch();this.expect(o),this.gullet.endGroup(),a={type:"ordgroup",mode:this.mode,loc:ut.range(i,c),body:l,semisimple:s==="\\begingroup"||void 0}}else if(a=this.parseFunction(r,e)||this.parseSymbol(),a==null&&s[0]==="\\"&&!nh.hasOwnProperty(s)){if(this.settings.throwOnError)throw new I("Undefined control sequence: "+s,i);a=this.formatUnsupportedCmd(s),this.consume()}return a}formLigatures(e){for(var r=e.length-1,i=0;i<r;++i){var s=e[i];if(s.type==="textord"){var a=s.text,o=e[i+1];if(!(!o||o.type!=="textord")){if(a==="-"&&o.text==="-"){var l=e[i+2];i+1<r&&l&&l.type==="textord"&&l.text==="-"?(e.splice(i,3,{type:"textord",mode:"text",loc:ut.range(s,l),text:"---"}),r-=2):(e.splice(i,2,{type:"textord",mode:"text",loc:ut.range(s,o),text:"--"}),r-=1)}(a==="'"||a==="`")&&o.text===a&&(e.splice(i,2,{type:"textord",mode:"text",loc:ut.range(s,o),text:a+a}),r-=1)}}}}parseSymbol(){var e=this.fetch(),r=e.text;if(/^\\verb[^a-zA-Z]/.test(r)){this.consume();var i=r.slice(5),s=i.charAt(0)==="*";if(s&&(i=i.slice(1)),i.length<2||i.charAt(0)!==i.slice(-1))throw new I(`\\verb assertion failed --
                    please report what input caused this bug`);return i=i.slice(1,-1),{type:"verb",mode:"text",body:i,star:s}}hd.hasOwnProperty(r[0])&&!Te[this.mode][r[0]]&&(this.settings.strict&&this.mode==="math"&&this.settings.reportNonstrict("unicodeTextInMathMode",'Accented Unicode text character "'+r[0]+'" used in math mode',e),r=hd[r[0]]+r.slice(1));var a=ab.exec(r);a&&(r=r.substring(0,a.index),r==="i"?r="ı":r==="j"&&(r="ȷ"));var o;if(Te[this.mode][r]){this.settings.strict&&this.mode==="math"&&rl.includes(r)&&this.settings.reportNonstrict("unicodeTextInMathMode",'Latin-1/Unicode text character "'+r[0]+'" used in math mode',e);var l=Te[this.mode][r].group,c=ut.range(e),h;vv(l)?h={type:"atom",mode:this.mode,family:l,loc:c,text:r}:h={type:l,mode:this.mode,loc:c,text:r},o=h}else if(r.charCodeAt(0)>=128)this.settings.strict&&(xu(r.charCodeAt(0))?this.mode==="math"&&this.settings.reportNonstrict("unicodeTextInMathMode",'Unicode text character "'+r[0]+'" used in math mode',e):this.settings.reportNonstrict("unknownSymbol",'Unrecognized Unicode character "'+r[0]+'"'+(" ("+r.charCodeAt(0)+")"),e)),o={type:"textord",mode:"text",loc:ut.range(e),text:r};else return null;if(this.consume(),a)for(var f=0;f<a[0].length;f++){var b=a[0][f];if(!Ln[b])throw new I("Unknown accent ' "+b+"'",e);var y=Ln[b][this.mode]||Ln[b].text;if(!y)throw new I("Accent "+b+" unsupported in "+this.mode+" mode",e);o={type:"accent",mode:this.mode,loc:ut.range(e),label:y,isStretchy:!1,isShifty:!0,base:o}}return o}}Fo.endOfExpression=new Set(["}","\\endgroup","\\end","\\right","&"]);var lc=function(e,r){if(!(typeof e=="string"||e instanceof String))throw new TypeError("KaTeX can only parse string typed expression");var i=new Fo(e,r);delete i.gullet.macros.current["\\df@tag"];var s=i.parse();if(delete i.gullet.macros.current["\\current@color"],delete i.gullet.macros.current["\\color"],i.gullet.macros.get("\\df@tag")){if(!r.displayMode)throw new I("\\tag works only in display equations");s=[{type:"tag",mode:"text",body:s,tag:i.subparse([new gt("\\df@tag")])}]}return s},lh=function(e,r,i){r.textContent="";var s=cc(e,i).toNode();r.appendChild(s)};typeof document<"u"&&document.compatMode!=="CSS1Compat"&&(typeof console<"u"&&console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your website has a suitable doctype."),lh=function(){throw new I("KaTeX doesn't work in quirks mode.")});var ub=function(e,r){var i=cc(e,r).toMarkup();return i},hb=function(e,r){var i=new Kl(r);return lc(e,i)},ch=function(e,r,i){if(i.throwOnError||!(e instanceof I))throw e;var s=D(["katex-error"],[new xt(r)]);return s.setAttribute("title",e.toString()),s.setAttribute("style","color:"+i.errorColor),s},cc=function(e,r){var i=new Kl(r);try{var s=lc(e,i);return lv(s,e,i)}catch(a){return ch(a,e,i)}},pb=function(e,r){var i=new Kl(r);try{var s=lc(e,i);return cv(s,e,i)}catch(a){return ch(a,e,i)}},fb="0.17.0",mb={Span:_s,Anchor:Ao,SymbolNode:xt,SvgNode:$r,PathNode:ei,LineNode:tl},dh={version:fb,render:lh,renderToString:ub,ParseError:I,SETTINGS_SCHEMA:Jn,__parse:hb,__renderToDomTree:cc,__renderToHTMLTree:pb,__setFontMetrics:Um,__defineSymbol:n,__defineFunction:H,__defineMacro:m,__domTree:mb};const vb=/^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1(?=[\s?!\.,:？！。，：]|$)/,bb=/^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1/,gb=/^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;function xb(t={}){return{extensions:[yb(t,pd(t,!1)),wb(t,pd(t,!0))]}}function pd(t,e){return r=>dh.renderToString(r.text,{...t,displayMode:r.displayMode})+(e?`
`:"")}function yb(t,e){const r=t&&t.nonStandard,i=r?bb:vb;return{name:"inlineKatex",level:"inline",start(s){let a,o=s;for(;o;){if(a=o.indexOf("$"),a===-1)return;if((r?a>-1:a===0||o.charAt(a-1)===" ")&&o.substring(a).match(i))return a;o=o.substring(a+1).replace(/^\$+/,"")}},tokenizer(s,a){const o=s.match(i);if(o)return{type:"inlineKatex",raw:o[0],text:o[2].trim(),displayMode:o[1].length===2}},renderer:e}}function wb(t,e){return{name:"blockKatex",level:"block",tokenizer(r,i){const s=r.match(gb);if(s)return{type:"blockKatex",raw:s[0],text:s[2].trim(),displayMode:s[1].length===2}},renderer:e}}const _b='@font-face{font-display:block;font-family:KaTeX_AMS;font-style:normal;font-weight:400;src:url(/assets/KaTeX_AMS-Regular.BQhdFMY1.woff2) format("woff2"),url(/assets/KaTeX_AMS-Regular.DMm9YOAa.woff) format("woff"),url(/assets/KaTeX_AMS-Regular.DRggAlZN.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Caligraphic;font-style:normal;font-weight:700;src:url(/assets/KaTeX_Caligraphic-Bold.Dq_IR9rO.woff2) format("woff2"),url(/assets/KaTeX_Caligraphic-Bold.BEiXGLvX.woff) format("woff"),url(/assets/KaTeX_Caligraphic-Bold.ATXxdsX0.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Caligraphic;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Caligraphic-Regular.Di6jR-x-.woff2) format("woff2"),url(/assets/KaTeX_Caligraphic-Regular.CTRA-rTL.woff) format("woff"),url(/assets/KaTeX_Caligraphic-Regular.wX97UBjC.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Fraktur;font-style:normal;font-weight:700;src:url(/assets/KaTeX_Fraktur-Bold.CL6g_b3V.woff2) format("woff2"),url(/assets/KaTeX_Fraktur-Bold.BsDP51OF.woff) format("woff"),url(/assets/KaTeX_Fraktur-Bold.BdnERNNW.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Fraktur;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Fraktur-Regular.CTYiF6lA.woff2) format("woff2"),url(/assets/KaTeX_Fraktur-Regular.Dxdc4cR9.woff) format("woff"),url(/assets/KaTeX_Fraktur-Regular.CB_wures.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Main;font-style:normal;font-weight:700;src:url(/assets/KaTeX_Main-Bold.Cx986IdX.woff2) format("woff2"),url(/assets/KaTeX_Main-Bold.Jm3AIy58.woff) format("woff"),url(/assets/KaTeX_Main-Bold.waoOVXN0.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Main;font-style:italic;font-weight:700;src:url(/assets/KaTeX_Main-BoldItalic.DxDJ3AOS.woff2) format("woff2"),url(/assets/KaTeX_Main-BoldItalic.SpSLRI95.woff) format("woff"),url(/assets/KaTeX_Main-BoldItalic.DzxPMmG6.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Main;font-style:italic;font-weight:400;src:url(/assets/KaTeX_Main-Italic.NWA7e6Wa.woff2) format("woff2"),url(/assets/KaTeX_Main-Italic.BMLOBm91.woff) format("woff"),url(/assets/KaTeX_Main-Italic.3WenGoN9.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Main;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Main-Regular.B22Nviop.woff2) format("woff2"),url(/assets/KaTeX_Main-Regular.Dr94JaBh.woff) format("woff"),url(/assets/KaTeX_Main-Regular.ypZvNtVU.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Math;font-style:italic;font-weight:700;src:url(/assets/KaTeX_Math-BoldItalic.CZnvNsCZ.woff2) format("woff2"),url(/assets/KaTeX_Math-BoldItalic.iY-2wyZ7.woff) format("woff"),url(/assets/KaTeX_Math-BoldItalic.B3XSjfu4.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Math;font-style:italic;font-weight:400;src:url(/assets/KaTeX_Math-Italic.t53AETM-.woff2) format("woff2"),url(/assets/KaTeX_Math-Italic.DA0__PXp.woff) format("woff"),url(/assets/KaTeX_Math-Italic.flOr_0UB.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_SansSerif;font-style:normal;font-weight:700;src:url(/assets/KaTeX_SansSerif-Bold.D1sUS0GD.woff2) format("woff2"),url(/assets/KaTeX_SansSerif-Bold.DbIhKOiC.woff) format("woff"),url(/assets/KaTeX_SansSerif-Bold.CFMepnvq.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_SansSerif;font-style:italic;font-weight:400;src:url(/assets/KaTeX_SansSerif-Italic.C3H0VqGB.woff2) format("woff2"),url(/assets/KaTeX_SansSerif-Italic.DN2j7dab.woff) format("woff"),url(/assets/KaTeX_SansSerif-Italic.YYjJ1zSn.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_SansSerif;font-style:normal;font-weight:400;src:url(/assets/KaTeX_SansSerif-Regular.DDBCnlJ7.woff2) format("woff2"),url(/assets/KaTeX_SansSerif-Regular.CS6fqUqJ.woff) format("woff"),url(/assets/KaTeX_SansSerif-Regular.BNo7hRIc.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Script;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Script-Regular.D3wIWfF6.woff2) format("woff2"),url(/assets/KaTeX_Script-Regular.D5yQViql.woff) format("woff"),url(/assets/KaTeX_Script-Regular.C5JkGWo-.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Size1;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Size1-Regular.mCD8mA8B.woff2) format("woff2"),url(/assets/KaTeX_Size1-Regular.C195tn64.woff) format("woff"),url(/assets/KaTeX_Size1-Regular.Dbsnue_I.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Size2;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Size2-Regular.Dy4dx90m.woff2) format("woff2"),url(/assets/KaTeX_Size2-Regular.oD1tc_U0.woff) format("woff"),url(/assets/KaTeX_Size2-Regular.B7gKUWhC.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Size3;font-style:normal;font-weight:400;src:url(data:font/woff2;base64,d09GMgABAAAAAA4oAA4AAAAAHbQAAA3TAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAAgRQIDgmcDBEICo1oijYBNgIkA14LMgAEIAWJAAeBHAyBHBvbGiMRdnO0IkRRkiYDgr9KsJ1NUAf2kILNxgUmgqIgq1P89vcbIcmsQbRps3vCcXdYOKSWEPEKgZgQkprQQsxIXUgq0DqpGKmIvrgkeVGtEQD9DzAO29fM9jYhxZEsL2FeURH2JN4MIcTdO049NCVdxQ/w9NrSYFEBKTDKpLKfNkCGDc1RwjZLQcm3vqJ2UW9Xfa3tgAHz6ivp6vgC2yD4/6352ndnN0X0TL7seypkjZlMsjmZnf0Mm5Q+JykRWQBKCVCVPbARPXWyQtb5VgLB6Biq7/Uixcj2WGqdI8tGSgkuRG+t910GKP2D7AQH0DB9FMDW/obJZ8giFI3Wg8Cvevz0M+5m0rTh7XDBlvo9Y4vm13EXmfttwI4mBo1EG15fxJhUiCLbiiyCf/ZA6MFAhg3pGIZGdGIVjtPn6UcMk9A/UUr9PhoNsCENw1APAq0gpH73e+M+0ueyHbabc3vkbcdtzcf/fiy+NxQEjf9ud/ELBHAXJ0nk4z+MXH2Ev/kWyV4k7SkvpPc9Qr38F6RPWnM9cN6DJ0AdD1BhtgABtmoRoFCvPsBAumNm6soZG2Gk5GyVTo2sJncSyp0jQTYoR6WDvTwaaEcHsxHfvuWhHA3a6bN7twRKtcGok6NsCi7jYRrM2jExsUFMxMQYuJbMhuWNOumEJy9hi29Dmg5zMp/A5+hhPG19j1vBrq8JTLr8ki5VLPmG/PynJHVul440bxg5xuymHUFPBshC+nA9I1FmwbRBTNHAcik3Oae0cxKoI3MOriM42UrPe51nsaGxJ+WfXubAsP84aabUlQSJ1IiE0iPETLUU4CATgfXSCSpuRFRmCGbO+wSpAnzaeaCYW1VNEysRtuXCEL1kUFUbbtMv3Tilt/1c11jt3Q5bbMa84cpWipp8Elw3MZhOHsOlwwVUQM3lAR35JiFQbaYCRnMF2lxAWoOg2gyoIV4PouX8HytNIfLhqpJtXB4vjiViUI8IJ7bkC4ikkQvKksnOTKICwnqWSZ9YS5f0WCxmpgjbIq7EJcM4aI2nmhLNY2JIUgOjXZFWBHb+x5oh6cwb0Tv1ackHdKi0I9OO2wE9aogIOn540CCCziyhN+IaejtgAONKznHlHyutPrHGwCx9S6B8kfS4Mfi4Eyv7OU730bT1SCBjt834cXsf43zVjPUqqJjgrjeGnBxSG4aYAKFuVbeCfkDIjAqMb6yLNIbCuvXhMH2/+k2vkNpkORhR59N1CkzoOENvneIosjYmuTxlhUzaGEJQ/iWqx4dmwpmKjrwTiTGTCVozNAYqk/zXOndWxuWSmJkQpJw3pK5KX6QrLt5LATMqpmPAQhkhK6PUjzHUn7E0gHE0kPE0iKkolgkUx9SZmVAdDgpffdyJKg3k7VmzYGCwVXGz/tXmkOIp+vcWs+EMuhhvN0h9uhfzWJziBQmCREGSIFmQIkgVpAnSBRmC//6hkLZwaVhwxlrJSOdqlFtOYxlau9F2QN5Y98xmIAsiM1HVp2VFX+DHHGg6Ecjh3vmqtidX3qHI2qycTk/iwxSt5UzTmEP92ZBnEWTk4Mx8Mpl78ZDokxg/KWb+Q0QkvdKVmq3TMW+RXEgrsziSAfNXFMhDc60N5N9jQzjfO0kBKpUZl0ZmwJ41j/B9Hz6wmRaJB84niNmQrzp9eSlQCDDzazGDdVi3P36VZQ+Jy4f9UBNp+3zTjqI4abaFAm+GShVaXlsGdF3FYzZcDI6cori4kMxUECl9IjJZpzkvitAoxKue+90pDMvcKRxLl53TmOKCmV/xRolNKSqqUxc6LStOETmFOiLZZptlZepcKiAzteG8PEdpnQpbOMNcMsR4RR2Bs0cKFEvSmIjAFcnarqwUL4lDhHmnVkwu1IwshbiCcgvOheZuYyOteufZZwlcTlLgnZ3o/WcYdzZHW/WGaqaVfmTZ1aWCceJjkbZqsfbkOtcFlUZM/jy+hXHDbaUobWqqXaeWobbLO99yG5N3U4wxco0rQGGcOLASFMXeJoham8M+/x6O2WywK2l4HGbq1CoUyC/IZikQhdq3SiuNrvAEj0AVu9x2x3lp/xWzahaxidezFVtdcb5uEnzyl0ZmYiuKI0exvCd4Xc9CV1KB0db00z92wDPde0kukbvZIWN6jUWFTmPIC/Y4UPCm8UfDTFZpZNon1qLFTkBhxzB+FjQRA2Q/YRJT8pQigslMaUpFyAG8TMlXigiqmAZX4xgijKjRlGpLE0GdplRfCaJo0JQaSxNBk6ZmMzcya0FmrcisDdn0Q3HI2sWSppYigmlM1XT/kLQZSNpMJG0WkjYbSZuDpM1F0uYhFc1HxU4m1QJjDK6iL0S5uSj5rgXc3RejEigtcRBtqYPQsiTskmO5vosV+q4VGIKbOkDg0jtRrq+Em1YloaTFar3EGr1EUC8R0kus1Uus00usL97ABr2BjXoDm/QGNhuWtMVBKOwg/i78lT7hBsAvDmwHc/ao3vmUbBmhjeYySZNWvGkfZAgISDSaDo1SVpzGDsAEkF8B+gEapViUoZgUWXcRIGFZNm6gWbAKk0bp0k1MHG9fLYtV4iS2SmLEQFARzRcnf9PUS0LVn05/J9MiRRBU3v2IrvW974v4N00L7ZMk0wXP1409CHo/an8zTRHD3eSJ6m8D4YMkZNl3M79sqeuAsr/m3f+8/yl7A50aiAEJgeBeMWzu7ui9UfUBCe2TIqZIoOd/3/udRBOQidQZUERzb2/VwZN1H/Sju82ew2H2Wfr6qvfVf3hqwDvAIpkQVFy4B9Pe9e4/XvPeceu7h3dvO56iJPf0+A6cqA2ip18ER+iFgggiuOkvj24bby0N9j2UHIkgqIt+sVgfodC4YghLSMjSZbH0VR/6dMDrYJeKHilKTemt6v6kvzvn3/RrdWtr0GoN/xL+Sex/cPYLUpepx9cz/D46UPU5KXgAQa+NDps1v6J3xP1i2HtaDB0M9aX2deA7SYff//+gUCovMmIK/qfsFcOk+4Y5ZN97XlG6zebqtMbKgeRFi51vnxTQYBUik2rS/Cn6PC8ADR8FGxsRPB82dzfND90gIcshOcYUkfjherBz53odpm6TP8txlwOZ71xmfHHOvq053qFF/MRlS3jP0ELudrf2OeN8DHvp6ZceLe8qKYvWz/7yp0u4dKPfli3CYq0O13Ih71mylJ80tOi10On8wi+F4+LWgDPeJ30msSQt9/vkmHq9/Lvo2b461mP801v3W4xTcs6CbvF9UDdrSt+A8OUbpSh55qAUFXWznBBfdeJ8a4d7ugT5tvxUza3h9m4H7ptTqiG4z0g5dc0X29OcGlhpGFMpQo9ytTS+NViZpNdvU4kWx+LKxNY10kQ1yqGXrhe4/1nvP7E+nd5A92TtaRplbHSqoIdOqtRWti+fkB5/n1+/VvCmz12pG1kpQWsfi1ftlBobm0bpngs16CHkbIwdLnParxtTV3QYRlfJ0KFskH7pdN/YDn+yRuSd7sNH3aO0DYPggk6uWuXrfOc+fa3VTxFVvKaNxHsiHmsXyCLIE5yuOeN3/Jdf8HBL/5M6shjyhxHx9BjB1O0+4NLOnjLLSxwO7ukN4jMbOIcD879KLSi6Pk61Oqm2377n8079PXEEQ7cy7OKEC9nbpet118fxweTafpt69x/Bt8UqGzNQt7aelpc44dn5cqhwf71+qKp/Zf/+a0zcizOUWpl/iBcSXip0pplkatCchoH5c5aUM8I7/dWxAej8WicPL1URFZ9BDJelUwEwTkGqUhgSlydVes95YdXvhh9Gfz/aeFWvgVb4tuLbcv4+wLdutVZv/cUonwBD/6eDlE0aSiKK/uoH3+J1wDE/jMVqY2ysGufN84oIXB0sPzy8ollX/LegY74DgJXJR57sn+VGza0x3DnuIgABFM15LmajjjsNlYj+JEZGbuRYcAMOWxFkPN2w6Wd46xo4gVWQR/X4lyI/R6K/YK0110GzudPRW7Y+UOBGTfNNzHeYT0fiH0taunBpq9HEW8OKSaBGj21L0MqenEmNRWBAWDWAk4CpNoEZJ2tTaPFgbQYj8HxtFilErs3BTRwT8uO1NXQaWfIotchmPkAF5mMBAliEmZiOGVgCG9LgRzpscMAOOwowlT3JhusdazXGSC/hxR3UlmWVwWHpOIKheqONvjyhSiTHIkVUco5bnji8m//zL7PKaT1Vl5I6UE609f+gkr6MZKVyKc7zJRmCahLsdlyA5fdQkRSan9LgnnLEyGSkaKJCJog0wAgvepWBt80+1yKln1bMVtCljfNWDueKLsWwaEbBSfSPTEmVRsUcYYMnEjcjeyCZzBXK9E9BYBXLKjOSpUDR+nEV3TFSUdQaz+ot98QxgXwx0GQ+EEUAKB2qZPkQQ0GqFD8UPFMqyaCHM24BZmSGic9EYMagKizOw9Hz50DMrDLrqqLkTAhplMictiCAx5S3BIUQdeJeLnBy2CNtMfz6cV4u8XKoFZQesbf9YZiIERiHjaNodDW6LgcirX/mPnJIkBGDUpTBhSa0EIr38D5hCIszhCM8URGBqImoWjpvpt1ebu/v3Gl3qJfMnNM+9V+kiRFyROTPHQWOcs1dNW94/ukKMPZBvDi55i5CttdeJz84DLngLqjcdwEZ87bFFR8CIG35OAkDVN6VRDZ7aq67NteYqZ2lpT8oYB2CytoBd6VuAx4WgiAsnuj3WohG+LugzXiQRDeM3XYXlULv4dp5VFYC) format("woff2"),url(/assets/KaTeX_Size3-Regular.CTq5MqoE.woff) format("woff"),url(/assets/KaTeX_Size3-Regular.DgpXs0kz.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Size4;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Size4-Regular.Dl5lxZxV.woff2) format("woff2"),url(/assets/KaTeX_Size4-Regular.BF-4gkZK.woff) format("woff"),url(/assets/KaTeX_Size4-Regular.DWFBv043.ttf) format("truetype")}@font-face{font-display:block;font-family:KaTeX_Typewriter;font-style:normal;font-weight:400;src:url(/assets/KaTeX_Typewriter-Regular.CO6r4hn1.woff2) format("woff2"),url(/assets/KaTeX_Typewriter-Regular.C0xS9mPB.woff) format("woff"),url(/assets/KaTeX_Typewriter-Regular.D3Ib7_Hf.ttf) format("truetype")}.katex{font: 1.21em KaTeX_Main,Times New Roman,serif;line-height:1.2;position:relative;text-indent:0;text-rendering:auto}.katex *{-ms-high-contrast-adjust:none!important;border-color:currentColor}.katex .katex-version:after{content:"0.17.0"}.katex .katex-mathml{border:0;-webkit-clip-path:inset(50%);clip-path:inset(50%);height:1px;overflow:hidden;padding:0;position:absolute;width:1px}.katex .katex-html>.newline{display:block}.katex .base{position:relative;white-space:nowrap;width:-webkit-min-content;width:-moz-min-content;width:min-content}.katex .base,.katex .strut{display:inline-block}.katex .textbf{font-weight:700}.katex .textit{font-style:italic}.katex .textrm{font-family:KaTeX_Main}.katex .textsf{font-family:KaTeX_SansSerif}.katex .texttt{font-family:KaTeX_Typewriter}.katex .mathnormal{font-family:KaTeX_Math;font-style:italic}.katex .mathit{font-family:KaTeX_Main;font-style:italic}.katex .mathrm{font-style:normal}.katex .mathbf{font-family:KaTeX_Main;font-weight:700}.katex .boldsymbol{font-family:KaTeX_Math;font-style:italic;font-weight:700}.katex .amsrm,.katex .mathbb,.katex .textbb{font-family:KaTeX_AMS}.katex .mathcal{font-family:KaTeX_Caligraphic}.katex .mathfrak,.katex .textfrak{font-family:KaTeX_Fraktur}.katex .mathboldfrak,.katex .textboldfrak{font-family:KaTeX_Fraktur;font-weight:700}.katex .mathtt{font-family:KaTeX_Typewriter}.katex .mathscr,.katex .textscr{font-family:KaTeX_Script}.katex .mathsf,.katex .textsf{font-family:KaTeX_SansSerif}.katex .mathboldsf,.katex .textboldsf{font-family:KaTeX_SansSerif;font-weight:700}.katex .mathitsf,.katex .mathsfit,.katex .textitsf{font-family:KaTeX_SansSerif;font-style:italic}.katex .mainrm{font-family:KaTeX_Main;font-style:normal}.katex .vlist-t{border-collapse:collapse;display:inline-table;table-layout:fixed}.katex .vlist-r{display:table-row}.katex .vlist{display:table-cell;position:relative;vertical-align:bottom}.katex .vlist>span{display:block;height:0;position:relative}.katex .vlist>span>span{display:inline-block}.katex .vlist>span>.pstrut{overflow:hidden;width:0}.katex .vlist-t2{margin-right:-2px}.katex .vlist-s{display:table-cell;font-size:1px;min-width:2px;vertical-align:bottom;width:2px}.katex .vbox{align-items:baseline;display:inline-flex;flex-direction:column}.katex .hbox{width:100%}.katex .hbox,.katex .thinbox{display:inline-flex;flex-direction:row}.katex .thinbox{max-width:0;width:0}.katex .msupsub{text-align:left}.katex .mfrac>span>span{text-align:center}.katex .mfrac .frac-line{border-bottom-style:solid;display:inline-block;width:100%}.katex .hdashline,.katex .hline,.katex .mfrac .frac-line,.katex .overline .overline-line,.katex .rule,.katex .underline .underline-line{min-height:1px}.katex .mspace{display:inline-block}.katex .smash{display:inline;line-height:0}.katex .clap,.katex .llap,.katex .rlap{position:relative;width:0}.katex .clap>.inner,.katex .llap>.inner,.katex .rlap>.inner{position:absolute}.katex .clap>.fix,.katex .llap>.fix,.katex .rlap>.fix{display:inline-block}.katex .llap>.inner{right:0}.katex .clap>.inner,.katex .rlap>.inner{left:0}.katex .clap>.inner>span{margin-left:-50%;margin-right:50%}.katex .rule{border:0 solid;display:inline-block;position:relative}.katex .hline,.katex .overline .overline-line,.katex .underline .underline-line{border-bottom-style:solid;display:inline-block;width:100%}.katex .hdashline{border-bottom-style:dashed;display:inline-block;width:100%}.katex .sqrt>.root{margin-left:.2777777778em;margin-right:-.5555555556em}.katex .fontsize-ensurer.reset-size1.size1,.katex .sizing.reset-size1.size1{font-size:1em}.katex .fontsize-ensurer.reset-size1.size2,.katex .sizing.reset-size1.size2{font-size:1.2em}.katex .fontsize-ensurer.reset-size1.size3,.katex .sizing.reset-size1.size3{font-size:1.4em}.katex .fontsize-ensurer.reset-size1.size4,.katex .sizing.reset-size1.size4{font-size:1.6em}.katex .fontsize-ensurer.reset-size1.size5,.katex .sizing.reset-size1.size5{font-size:1.8em}.katex .fontsize-ensurer.reset-size1.size6,.katex .sizing.reset-size1.size6{font-size:2em}.katex .fontsize-ensurer.reset-size1.size7,.katex .sizing.reset-size1.size7{font-size:2.4em}.katex .fontsize-ensurer.reset-size1.size8,.katex .sizing.reset-size1.size8{font-size:2.88em}.katex .fontsize-ensurer.reset-size1.size9,.katex .sizing.reset-size1.size9{font-size:3.456em}.katex .fontsize-ensurer.reset-size1.size10,.katex .sizing.reset-size1.size10{font-size:4.148em}.katex .fontsize-ensurer.reset-size1.size11,.katex .sizing.reset-size1.size11{font-size:4.976em}.katex .fontsize-ensurer.reset-size2.size1,.katex .sizing.reset-size2.size1{font-size:.8333333333em}.katex .fontsize-ensurer.reset-size2.size2,.katex .sizing.reset-size2.size2{font-size:1em}.katex .fontsize-ensurer.reset-size2.size3,.katex .sizing.reset-size2.size3{font-size:1.1666666667em}.katex .fontsize-ensurer.reset-size2.size4,.katex .sizing.reset-size2.size4{font-size:1.3333333333em}.katex .fontsize-ensurer.reset-size2.size5,.katex .sizing.reset-size2.size5{font-size:1.5em}.katex .fontsize-ensurer.reset-size2.size6,.katex .sizing.reset-size2.size6{font-size:1.6666666667em}.katex .fontsize-ensurer.reset-size2.size7,.katex .sizing.reset-size2.size7{font-size:2em}.katex .fontsize-ensurer.reset-size2.size8,.katex .sizing.reset-size2.size8{font-size:2.4em}.katex .fontsize-ensurer.reset-size2.size9,.katex .sizing.reset-size2.size9{font-size:2.88em}.katex .fontsize-ensurer.reset-size2.size10,.katex .sizing.reset-size2.size10{font-size:3.4566666667em}.katex .fontsize-ensurer.reset-size2.size11,.katex .sizing.reset-size2.size11{font-size:4.1466666667em}.katex .fontsize-ensurer.reset-size3.size1,.katex .sizing.reset-size3.size1{font-size:.7142857143em}.katex .fontsize-ensurer.reset-size3.size2,.katex .sizing.reset-size3.size2{font-size:.8571428571em}.katex .fontsize-ensurer.reset-size3.size3,.katex .sizing.reset-size3.size3{font-size:1em}.katex .fontsize-ensurer.reset-size3.size4,.katex .sizing.reset-size3.size4{font-size:1.1428571429em}.katex .fontsize-ensurer.reset-size3.size5,.katex .sizing.reset-size3.size5{font-size:1.2857142857em}.katex .fontsize-ensurer.reset-size3.size6,.katex .sizing.reset-size3.size6{font-size:1.4285714286em}.katex .fontsize-ensurer.reset-size3.size7,.katex .sizing.reset-size3.size7{font-size:1.7142857143em}.katex .fontsize-ensurer.reset-size3.size8,.katex .sizing.reset-size3.size8{font-size:2.0571428571em}.katex .fontsize-ensurer.reset-size3.size9,.katex .sizing.reset-size3.size9{font-size:2.4685714286em}.katex .fontsize-ensurer.reset-size3.size10,.katex .sizing.reset-size3.size10{font-size:2.9628571429em}.katex .fontsize-ensurer.reset-size3.size11,.katex .sizing.reset-size3.size11{font-size:3.5542857143em}.katex .fontsize-ensurer.reset-size4.size1,.katex .sizing.reset-size4.size1{font-size:.625em}.katex .fontsize-ensurer.reset-size4.size2,.katex .sizing.reset-size4.size2{font-size:.75em}.katex .fontsize-ensurer.reset-size4.size3,.katex .sizing.reset-size4.size3{font-size:.875em}.katex .fontsize-ensurer.reset-size4.size4,.katex .sizing.reset-size4.size4{font-size:1em}.katex .fontsize-ensurer.reset-size4.size5,.katex .sizing.reset-size4.size5{font-size:1.125em}.katex .fontsize-ensurer.reset-size4.size6,.katex .sizing.reset-size4.size6{font-size:1.25em}.katex .fontsize-ensurer.reset-size4.size7,.katex .sizing.reset-size4.size7{font-size:1.5em}.katex .fontsize-ensurer.reset-size4.size8,.katex .sizing.reset-size4.size8{font-size:1.8em}.katex .fontsize-ensurer.reset-size4.size9,.katex .sizing.reset-size4.size9{font-size:2.16em}.katex .fontsize-ensurer.reset-size4.size10,.katex .sizing.reset-size4.size10{font-size:2.5925em}.katex .fontsize-ensurer.reset-size4.size11,.katex .sizing.reset-size4.size11{font-size:3.11em}.katex .fontsize-ensurer.reset-size5.size1,.katex .sizing.reset-size5.size1{font-size:.5555555556em}.katex .fontsize-ensurer.reset-size5.size2,.katex .sizing.reset-size5.size2{font-size:.6666666667em}.katex .fontsize-ensurer.reset-size5.size3,.katex .sizing.reset-size5.size3{font-size:.7777777778em}.katex .fontsize-ensurer.reset-size5.size4,.katex .sizing.reset-size5.size4{font-size:.8888888889em}.katex .fontsize-ensurer.reset-size5.size5,.katex .sizing.reset-size5.size5{font-size:1em}.katex .fontsize-ensurer.reset-size5.size6,.katex .sizing.reset-size5.size6{font-size:1.1111111111em}.katex .fontsize-ensurer.reset-size5.size7,.katex .sizing.reset-size5.size7{font-size:1.3333333333em}.katex .fontsize-ensurer.reset-size5.size8,.katex .sizing.reset-size5.size8{font-size:1.6em}.katex .fontsize-ensurer.reset-size5.size9,.katex .sizing.reset-size5.size9{font-size:1.92em}.katex .fontsize-ensurer.reset-size5.size10,.katex .sizing.reset-size5.size10{font-size:2.3044444444em}.katex .fontsize-ensurer.reset-size5.size11,.katex .sizing.reset-size5.size11{font-size:2.7644444444em}.katex .fontsize-ensurer.reset-size6.size1,.katex .sizing.reset-size6.size1{font-size:.5em}.katex .fontsize-ensurer.reset-size6.size2,.katex .sizing.reset-size6.size2{font-size:.6em}.katex .fontsize-ensurer.reset-size6.size3,.katex .sizing.reset-size6.size3{font-size:.7em}.katex .fontsize-ensurer.reset-size6.size4,.katex .sizing.reset-size6.size4{font-size:.8em}.katex .fontsize-ensurer.reset-size6.size5,.katex .sizing.reset-size6.size5{font-size:.9em}.katex .fontsize-ensurer.reset-size6.size6,.katex .sizing.reset-size6.size6{font-size:1em}.katex .fontsize-ensurer.reset-size6.size7,.katex .sizing.reset-size6.size7{font-size:1.2em}.katex .fontsize-ensurer.reset-size6.size8,.katex .sizing.reset-size6.size8{font-size:1.44em}.katex .fontsize-ensurer.reset-size6.size9,.katex .sizing.reset-size6.size9{font-size:1.728em}.katex .fontsize-ensurer.reset-size6.size10,.katex .sizing.reset-size6.size10{font-size:2.074em}.katex .fontsize-ensurer.reset-size6.size11,.katex .sizing.reset-size6.size11{font-size:2.488em}.katex .fontsize-ensurer.reset-size7.size1,.katex .sizing.reset-size7.size1{font-size:.4166666667em}.katex .fontsize-ensurer.reset-size7.size2,.katex .sizing.reset-size7.size2{font-size:.5em}.katex .fontsize-ensurer.reset-size7.size3,.katex .sizing.reset-size7.size3{font-size:.5833333333em}.katex .fontsize-ensurer.reset-size7.size4,.katex .sizing.reset-size7.size4{font-size:.6666666667em}.katex .fontsize-ensurer.reset-size7.size5,.katex .sizing.reset-size7.size5{font-size:.75em}.katex .fontsize-ensurer.reset-size7.size6,.katex .sizing.reset-size7.size6{font-size:.8333333333em}.katex .fontsize-ensurer.reset-size7.size7,.katex .sizing.reset-size7.size7{font-size:1em}.katex .fontsize-ensurer.reset-size7.size8,.katex .sizing.reset-size7.size8{font-size:1.2em}.katex .fontsize-ensurer.reset-size7.size9,.katex .sizing.reset-size7.size9{font-size:1.44em}.katex .fontsize-ensurer.reset-size7.size10,.katex .sizing.reset-size7.size10{font-size:1.7283333333em}.katex .fontsize-ensurer.reset-size7.size11,.katex .sizing.reset-size7.size11{font-size:2.0733333333em}.katex .fontsize-ensurer.reset-size8.size1,.katex .sizing.reset-size8.size1{font-size:.3472222222em}.katex .fontsize-ensurer.reset-size8.size2,.katex .sizing.reset-size8.size2{font-size:.4166666667em}.katex .fontsize-ensurer.reset-size8.size3,.katex .sizing.reset-size8.size3{font-size:.4861111111em}.katex .fontsize-ensurer.reset-size8.size4,.katex .sizing.reset-size8.size4{font-size:.5555555556em}.katex .fontsize-ensurer.reset-size8.size5,.katex .sizing.reset-size8.size5{font-size:.625em}.katex .fontsize-ensurer.reset-size8.size6,.katex .sizing.reset-size8.size6{font-size:.6944444444em}.katex .fontsize-ensurer.reset-size8.size7,.katex .sizing.reset-size8.size7{font-size:.8333333333em}.katex .fontsize-ensurer.reset-size8.size8,.katex .sizing.reset-size8.size8{font-size:1em}.katex .fontsize-ensurer.reset-size8.size9,.katex .sizing.reset-size8.size9{font-size:1.2em}.katex .fontsize-ensurer.reset-size8.size10,.katex .sizing.reset-size8.size10{font-size:1.4402777778em}.katex .fontsize-ensurer.reset-size8.size11,.katex .sizing.reset-size8.size11{font-size:1.7277777778em}.katex .fontsize-ensurer.reset-size9.size1,.katex .sizing.reset-size9.size1{font-size:.2893518519em}.katex .fontsize-ensurer.reset-size9.size2,.katex .sizing.reset-size9.size2{font-size:.3472222222em}.katex .fontsize-ensurer.reset-size9.size3,.katex .sizing.reset-size9.size3{font-size:.4050925926em}.katex .fontsize-ensurer.reset-size9.size4,.katex .sizing.reset-size9.size4{font-size:.462962963em}.katex .fontsize-ensurer.reset-size9.size5,.katex .sizing.reset-size9.size5{font-size:.5208333333em}.katex .fontsize-ensurer.reset-size9.size6,.katex .sizing.reset-size9.size6{font-size:.5787037037em}.katex .fontsize-ensurer.reset-size9.size7,.katex .sizing.reset-size9.size7{font-size:.6944444444em}.katex .fontsize-ensurer.reset-size9.size8,.katex .sizing.reset-size9.size8{font-size:.8333333333em}.katex .fontsize-ensurer.reset-size9.size9,.katex .sizing.reset-size9.size9{font-size:1em}.katex .fontsize-ensurer.reset-size9.size10,.katex .sizing.reset-size9.size10{font-size:1.2002314815em}.katex .fontsize-ensurer.reset-size9.size11,.katex .sizing.reset-size9.size11{font-size:1.4398148148em}.katex .fontsize-ensurer.reset-size10.size1,.katex .sizing.reset-size10.size1{font-size:.2410800386em}.katex .fontsize-ensurer.reset-size10.size2,.katex .sizing.reset-size10.size2{font-size:.2892960463em}.katex .fontsize-ensurer.reset-size10.size3,.katex .sizing.reset-size10.size3{font-size:.337512054em}.katex .fontsize-ensurer.reset-size10.size4,.katex .sizing.reset-size10.size4{font-size:.3857280617em}.katex .fontsize-ensurer.reset-size10.size5,.katex .sizing.reset-size10.size5{font-size:.4339440694em}.katex .fontsize-ensurer.reset-size10.size6,.katex .sizing.reset-size10.size6{font-size:.4821600771em}.katex .fontsize-ensurer.reset-size10.size7,.katex .sizing.reset-size10.size7{font-size:.5785920926em}.katex .fontsize-ensurer.reset-size10.size8,.katex .sizing.reset-size10.size8{font-size:.6943105111em}.katex .fontsize-ensurer.reset-size10.size9,.katex .sizing.reset-size10.size9{font-size:.8331726133em}.katex .fontsize-ensurer.reset-size10.size10,.katex .sizing.reset-size10.size10{font-size:1em}.katex .fontsize-ensurer.reset-size10.size11,.katex .sizing.reset-size10.size11{font-size:1.1996142719em}.katex .fontsize-ensurer.reset-size11.size1,.katex .sizing.reset-size11.size1{font-size:.2009646302em}.katex .fontsize-ensurer.reset-size11.size2,.katex .sizing.reset-size11.size2{font-size:.2411575563em}.katex .fontsize-ensurer.reset-size11.size3,.katex .sizing.reset-size11.size3{font-size:.2813504823em}.katex .fontsize-ensurer.reset-size11.size4,.katex .sizing.reset-size11.size4{font-size:.3215434084em}.katex .fontsize-ensurer.reset-size11.size5,.katex .sizing.reset-size11.size5{font-size:.3617363344em}.katex .fontsize-ensurer.reset-size11.size6,.katex .sizing.reset-size11.size6{font-size:.4019292605em}.katex .fontsize-ensurer.reset-size11.size7,.katex .sizing.reset-size11.size7{font-size:.4823151125em}.katex .fontsize-ensurer.reset-size11.size8,.katex .sizing.reset-size11.size8{font-size:.578778135em}.katex .fontsize-ensurer.reset-size11.size9,.katex .sizing.reset-size11.size9{font-size:.6945337621em}.katex .fontsize-ensurer.reset-size11.size10,.katex .sizing.reset-size11.size10{font-size:.8336012862em}.katex .fontsize-ensurer.reset-size11.size11,.katex .sizing.reset-size11.size11{font-size:1em}.katex .delimsizing.size1{font-family:KaTeX_Size1}.katex .delimsizing.size2{font-family:KaTeX_Size2}.katex .delimsizing.size3{font-family:KaTeX_Size3}.katex .delimsizing.size4{font-family:KaTeX_Size4}.katex .delimsizing.mult .delim-size1>span{font-family:KaTeX_Size1}.katex .delimsizing.mult .delim-size4>span{font-family:KaTeX_Size4}.katex .nulldelimiter{display:inline-block;width:.12em}.katex .delimcenter,.katex .op-symbol{position:relative}.katex .op-symbol.small-op{font-family:KaTeX_Size1}.katex .op-symbol.large-op{font-family:KaTeX_Size2}.katex .accent>.vlist-t,.katex .op-limits>.vlist-t{text-align:center}.katex .accent .accent-body{position:relative}.katex .accent .accent-body:not(.accent-full){width:0}.katex .overlay{display:block}.katex .mtable .vertical-separator{display:inline-block;min-width:1px}.katex .mtable .arraycolsep{display:inline-block}.katex .mtable .col-align-c>.vlist-t{text-align:center}.katex .mtable .col-align-l>.vlist-t{text-align:left}.katex .mtable .col-align-r>.vlist-t{text-align:right}.katex .svg-align{text-align:left}.katex svg{fill:currentColor;stroke:currentColor;display:block;height:inherit;position:absolute;width:100%}.katex svg path{stroke:none}.katex svg{fill-rule:nonzero;fill-opacity:1;stroke-width:1;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1}.katex img{border-style:none;max-height:none;max-width:none;min-height:0;min-width:0}.katex .stretchy{display:block;overflow:hidden;position:relative;width:100%}.katex .stretchy:after,.katex .stretchy:before{content:""}.katex .hide-tail{overflow:hidden;position:relative;width:100%}.katex .halfarrow-left{left:0;overflow:hidden;position:absolute;width:50.2%}.katex .halfarrow-right{overflow:hidden;position:absolute;right:0;width:50.2%}.katex .brace-left{left:0;overflow:hidden;position:absolute;width:25.1%}.katex .brace-center{left:25%;overflow:hidden;position:absolute;width:50%}.katex .brace-right{overflow:hidden;position:absolute;right:0;width:25.1%}.katex .x-arrow-pad{padding:0 .5em}.katex .cd-arrow-pad{padding:0 .55556em 0 .27778em}.katex .mover,.katex .munder,.katex .x-arrow{text-align:center}.katex .boxpad{padding:0 .3em}.katex .fbox,.katex .fcolorbox{border:.04em solid;box-sizing:border-box}.katex .cancel-pad{padding:0 .2em}.katex .cancel-lap{margin-left:-.2em;margin-right:-.2em}.katex .sout{border-bottom-style:solid;border-bottom-width:.08em}.katex .angl{border-right:.049em solid;border-top:.049em solid;box-sizing:border-box;margin-right:.03889em}.katex .anglpad{padding:0 .03889em}.katex .eqn-num:before{content:"(" counter(katexEqnNo) ")";counter-increment:katexEqnNo}.katex .mml-eqn-num:before{content:"(" counter(mmlEqnNo) ")";counter-increment:mmlEqnNo}.katex .mtr-glue{width:50%}.katex .cd-vert-arrow{display:inline-block;position:relative}.katex .cd-label-left{display:inline-block;position:absolute;right:calc(50% + .3em);text-align:left}.katex .cd-label-right{display:inline-block;left:calc(50% + .3em);position:absolute;text-align:right}.katex-display{display:block;margin:1em 0;text-align:center}.katex-display>.katex{display:block;text-align:center;white-space:nowrap}.katex-display>.katex>.katex-html{display:block;position:relative}.katex-display>.katex>.katex-html>.tag{position:absolute;right:0}.katex-display.leqno>.katex>.katex-html>.tag{left:0;right:auto}.katex-display.fleqn>.katex{padding-left:2em;text-align:left}body{counter-reset:katexEqnNo mmlEqnNo}';var kb=Object.defineProperty,Sb=Object.getOwnPropertyDescriptor,ga=(t,e,r,i)=>{for(var s=i>1?void 0:i?Sb(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&kb(e,r,s),s};let Pi=class extends G{constructor(){super(...arguments),this.src="",this._scale=1,this._x=0,this._y=0,this._dragging=!1,this._sx=0,this._sy=0,this._ox=0,this._oy=0,this._pinchDist=0,this._pinchScale=1,this._onKey=t=>{t.key==="Escape"&&this._close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this._onKey)}disconnectedCallback(){document.removeEventListener("keydown",this._onKey),super.disconnectedCallback()}_close(){this._scale=1,this._x=0,this._y=0,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}_onWheel(t){t.preventDefault();const e=-t.deltaY*.0015;this._scale=Math.max(.5,Math.min(5,this._scale+e))}_onBgClick(t){(t.target===t.currentTarget||t.target.tagName==="DIV")&&this._close()}_onDbl(){this._scale>1.5?(this._scale=1,this._x=0,this._y=0):this._scale=2.5}_md(t){t.preventDefault(),this._dragging=!0,this._sx=t.clientX,this._sy=t.clientY,this._ox=this._x,this._oy=this._y}_mm(t){this._dragging&&(this._x=this._ox+(t.clientX-this._sx),this._y=this._oy+(t.clientY-this._sy))}_mu(){this._dragging=!1}_ts(t){t.touches.length===1?(this._dragging=!0,this._sx=t.touches[0].clientX,this._sy=t.touches[0].clientY,this._ox=this._x,this._oy=this._y):t.touches.length===2&&(this._dragging=!1,this._pinchDist=this._dist(t.touches),this._pinchScale=this._scale)}_tm(t){if(t.preventDefault(),t.touches.length===1&&this._dragging)this._x=this._ox+(t.touches[0].clientX-this._sx),this._y=this._oy+(t.touches[0].clientY-this._sy);else if(t.touches.length===2&&this._pinchDist>0){const e=this._dist(t.touches)/this._pinchDist;this._scale=Math.max(.5,Math.min(5,this._pinchScale*e))}}_te(){this._dragging=!1,this._pinchDist=0}_dist(t){const e=t[0].clientX-t[1].clientX,r=t[0].clientY-t[1].clientY;return Math.hypot(e,r)}render(){return p`
      <button class="close-btn" @click=${this._close}>✕</button>
      <div
        style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;"
        @click=${this._onBgClick}
        @wheel=${this._onWheel}
        @dblclick=${this._onDbl}
        @mousedown=${this._md} @mousemove=${this._mm} @mouseup=${this._mu} @mouseleave=${this._mu}
        @touchstart=${this._ts} @touchmove=${this._tm} @touchend=${this._te}
      >
        <img
          src=${this.src}
          alt=""
          draggable="false"
          style="transform: translate(${this._x}px, ${this._y}px) scale(${this._scale})"
        />
      </div>
    `}};Pi.styles=U`
    :host {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.92);
      overflow: hidden;
      touch-action: none;
      cursor: grab;
    }
    :host(:active) { cursor: grabbing; }
    .close-btn {
      position: fixed;
      top: calc(16px + env(safe-area-inset-top));
      right: 16px;
      z-index: 1;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn:hover { background: rgba(255, 255, 255, 0.3); }
    img {
      max-width: 92vw;
      max-height: 92vh;
      transform-origin: center center;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }
  `;ga([w()],Pi.prototype,"src",2);ga([$()],Pi.prototype,"_scale",2);ga([$()],Pi.prototype,"_x",2);ga([$()],Pi.prototype,"_y",2);Pi=ga([Z("image-viewer")],Pi);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class bl extends Il{constructor(e){if(super(e),this.it=F,e.type!==Ur.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(e){if(e===F||e==null)return this._t=void 0,this.it=e;if(e===At)return e;if(typeof e!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(e===this.it)return this._t;this.it=e;const r=[e];return r.raw=r,this._t={_$litType$:this.constructor.resultType,strings:r,values:[]}}}bl.directiveName="unsafeHTML",bl.resultType=1;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class gl extends bl{}gl.directiveName="unsafeSVG",gl.resultType=2;const uh=Ol(gl),zb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-search"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m21 21-4.34-4.34" />
  <circle cx="11" cy="11" r="8" />
</svg>
`,$b=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-folder"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</svg>
`,Tb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-folder-open"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
</svg>
`,Cb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-file"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
  <path d="M14 2v5a1 1 0 0 0 1 1h5" />
</svg>
`,Eb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-message-circle"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
</svg>
`,Ab=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-upload"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3v12" />
  <path d="m17 8-5-5-5 5" />
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
</svg>
`,Mb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-download"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 15V3" />
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <path d="m7 10 5 5 5-5" />
</svg>
`,Pb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-folder-plus"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 10v6" />
  <path d="M9 13h6" />
  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</svg>
`,Db=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-pencil"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
  <path d="m15 5 4 4" />
</svg>
`,Ob=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-arrow-right"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 12h14" />
  <path d="m12 5 7 7-7 7" />
</svg>
`,Ib=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-trash-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M10 11v6" />
  <path d="M14 11v6" />
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  <path d="M3 6h18" />
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
</svg>
`,Rb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-save"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
  <path d="M7 3v4a1 1 0 0 0 1 1h7" />
</svg>
`,Lb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-x"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M18 6 6 18" />
  <path d="m6 6 12 12" />
</svg>
`,Bb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-maximize-2"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M15 3h6v6" />
  <path d="m21 3-7 7" />
  <path d="m3 21 7-7" />
  <path d="M9 21H3v-6" />
</svg>
`,Nb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-copy"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
</svg>
`,Fb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-arrow-left"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m12 19-7-7 7-7" />
  <path d="M19 12H5" />
</svg>
`,Hb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-arrow-up"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m5 12 7-7 7 7" />
  <path d="M12 19V5" />
</svg>
`,qb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-arrow-up-to-line"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M5 3h14" />
  <path d="m18 13-6-6-6 6" />
  <path d="M12 7v14" />
</svg>
`,Ub=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-arrow-down-to-line"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 17V3" />
  <path d="m6 11 6 6 6-6" />
  <path d="M19 21H5" />
</svg>
`,jb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-more-horizontal"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="1" />
  <circle cx="19" cy="12" r="1" />
  <circle cx="5" cy="12" r="1" />
</svg>
`,Wb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-more-vertical"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="1" />
  <circle cx="12" cy="5" r="1" />
  <circle cx="12" cy="19" r="1" />
</svg>
`,Vb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-chevron-down"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m6 9 6 6 6-6" />
</svg>
`,Gb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-chevron-right"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m9 18 6-6-6-6" />
</svg>
`,Xb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-refresh-cw"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
  <path d="M21 3v5h-5" />
  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
  <path d="M8 16H3v5" />
</svg>
`,Kb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-refresh-ccw"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
  <path d="M3 3v5h5" />
  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
  <path d="M16 16h5v5" />
</svg>
`,Yb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-alert-triangle"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
  <path d="M12 9v4" />
  <path d="M12 17h.01" />
</svg>
`,Zb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-check"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M20 6 9 17l-5-5" />
</svg>
`,Jb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-clipboard"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
</svg>
`,Qb=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-brain"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 18V5" />
  <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
  <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
  <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
  <path d="M18 18a4 4 0 0 0 2-7.464" />
  <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
  <path d="M6 18a4 4 0 0 1-2-7.464" />
  <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
</svg>
`,eg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-settings"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
  <circle cx="12" cy="12" r="3" />
</svg>
`,tg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-globe"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="12" cy="12" r="10" />
  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
  <path d="M2 12h20" />
</svg>
`,rg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-scale"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3v18" />
  <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
  <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
  <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
  <path d="M7 21h10" />
</svg>
`,ig=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-book-open"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 5v16" />
  <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
</svg>
`,sg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-rotate-ccw"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
  <path d="M3 3v5h5" />
</svg>
`,ag=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-sparkles"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
  <path d="M20 2v4" />
  <path d="M22 4h-4" />
  <circle cx="4" cy="20" r="2" />
</svg>
`,og=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-regex"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M17 3v10" />
  <path d="m12.67 5.5 8.66 5" />
  <path d="m12.67 10.5 8.66-5" />
  <path d="M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z" />
</svg>
`,ng=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-camera"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
  <circle cx="12" cy="13" r="3" />
</svg>
`,lg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-image"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
  <circle cx="9" cy="9" r="2" />
  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
</svg>
`,cg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-calendar"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M8 2v4" />
  <path d="M16 2v4" />
  <rect width="18" height="18" x="3" y="4" rx="2" />
  <path d="M3 10h18" />
</svg>
`,dg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-chevron-left"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m15 18-6-6 6-6" />
</svg>
`,ug=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-square"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="18" height="18" x="3" y="3" rx="2" />
</svg>
`,hg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-user"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
  <circle cx="12" cy="7" r="4" />
</svg>
`,pg=`<!-- @license lucide-static v1.26.0 - ISC -->
<svg
  class="lucide lucide-log-out"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m16 17 5-5-5-5" />
  <path d="M21 12H9" />
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
</svg>
`;var fg=Object.defineProperty,mg=Object.getOwnPropertyDescriptor,hh=(t,e,r,i)=>{for(var s=i>1?void 0:i?mg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&fg(e,r,s),s};const vg={search:zb,folder:$b,"folder-open":Tb,file:Cb,"message-circle":Eb,upload:Ab,download:Mb,"folder-plus":Pb,pencil:Db,"arrow-right":Ob,"trash-2":Ib,save:Rb,x:Lb,"arrow-left":Fb,"arrow-up":Hb,"arrow-up-to-line":qb,"arrow-down-to-line":Ub,"more-horizontal":jb,"more-vertical":Wb,"chevron-down":Vb,"chevron-right":Gb,"refresh-cw":Xb,"refresh-ccw":Kb,"alert-triangle":Yb,check:Zb,clipboard:Jb,brain:Qb,settings:eg,globe:tg,scale:rg,"book-open":ig,"rotate-ccw":sg,sparkles:ag,regex:og,camera:ng,image:lg,calendar:cg,"chevron-left":dg,"maximize-2":Bb,copy:Nb,square:ug,user:hg,"log-out":pg};let bo=class extends G{constructor(){super(...arguments),this.name=""}render(){const t=vg[this.name];return t?p`${uh(t)}`:null}};bo.styles=U`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      vertical-align: middle;
      /* 尺寸跟随宿主 font-size：svg 用 1em */
    }
    :host svg {
      width: 1em;
      height: 1em;
      display: block;
    }
    /* .filled：描边图标变实心填充（fill/stroke 都用 currentColor，颜色继承上下文） */
    :host(.filled) svg {
      fill: currentColor;
      stroke: currentColor;
    }
    /* .thick：加粗描边线条 */
    :host(.thick) svg {
      stroke-width: 2.6;
    }
  `;hh([w()],bo.prototype,"name",2);bo=hh([Z("doclens-icon")],bo);const fd=300;class dc{constructor(e,r={}){this.host=e,this.showTop=!1,this.showBottom=!1,this._scroller=null,this._ro=null,this._onScroll=()=>{this.refresh()},this.host.addController(this),this._opts=r}hostDisconnected(){this.detach()}attach(e){this._scroller!==e&&(this.detach(),this._scroller=e,e.addEventListener("scroll",this._onScroll,{passive:!0}),this._ro=new ResizeObserver(this._onScroll),this._ro.observe(e),this.refresh())}detach(){var e;this._scroller&&(this._scroller.removeEventListener("scroll",this._onScroll),this._scroller=null),(e=this._ro)==null||e.disconnect(),this._ro=null}refresh(){const e=this._scroller;if(!e)return;const r=e.scrollHeight-e.clientHeight>8,i=r&&e.scrollTop>fd,s=r&&e.scrollHeight-e.scrollTop-e.clientHeight>fd;(i!==this.showTop||s!==this.showBottom)&&(this.showTop=i,this.showBottom=s,this.host.requestUpdate())}jumpTop(){const e=this._scroller;if(e){if(this._opts.onJumpTop){this._opts.onJumpTop(e);return}e.scrollTo({top:0,behavior:this._opts.behavior??"smooth"})}}jumpBottom(){const e=this._scroller;if(e){if(this._opts.onJumpBottom){this._opts.onJumpBottom(e);return}e.scrollTo({top:e.scrollHeight-e.clientHeight,behavior:this._opts.behavior??"smooth"})}}}const uc=U`
  .scroll-jump-anchor {
    position: sticky;
    bottom: var(--cortex-space-3);
    height: 0;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;  /* height:0 容器防止 stretch 压扁按钮组 */
    z-index: 2;
  }
  .scroll-jump-anchor .scroll-jump-fabs {
    /* height:0 锚点：把按钮组整体上移到锚点线之上（translate 不影响滚动范围） */
    transform: translateY(-100%);
    padding-right: var(--cortex-space-1);
  }
  .scroll-jump-fabs {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--cortex-space-2);
    /* 容器可能覆盖在文本上方：默认不拦截指针，仅按钮本体可点 */
    pointer-events: none;
  }
  .scroll-jump-fab {
    pointer-events: auto;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text-muted);
    box-shadow: var(--cortex-shadow-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .scroll-jump-fab:hover {
    background: var(--cortex-primary-soft);
    color: var(--cortex-primary);
    border-color: var(--cortex-primary);
  }
  .scroll-jump-fab:focus-visible {
    outline: none;
    box-shadow: var(--cortex-focus-ring);
  }
`;function go(t){return!t.showTop&&!t.showBottom?null:p`
    <div class="scroll-jump-fabs">
      ${t.showTop?p`<button
            class="scroll-jump-fab"
            type="button"
            aria-label="跳转到第一行"
            title="跳转到第一行"
            @click=${()=>t.jumpTop()}
          ><doclens-icon name="arrow-up-to-line"></doclens-icon></button>`:null}
      ${t.showBottom?p`<button
            class="scroll-jump-fab"
            type="button"
            aria-label="跳转到最后一行"
            title="跳转到最后一行"
            @click=${()=>t.jumpBottom()}
          ><doclens-icon name="arrow-down-to-line"></doclens-icon></button>`:null}
    </div>
  `}var bg=Object.defineProperty,gg=Object.getOwnPropertyDescriptor,Pr=(t,e,r,i)=>{for(var s=i>1?void 0:i?gg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&bg(e,r,s),s};let Ks="",xl=0,xo=0;function rs(t){if(!t)return 0;const e=Ks.indexOf(t,xl);if(e===-1){const i=Ks.indexOf(t);return i===-1?0:(Ks.slice(0,i).match(/\n/g)??[]).length+1+xo}const r=(Ks.slice(0,e).match(/\n/g)??[]).length+1;return xl=e+t.length,r+xo}function ea(t){return t.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}const xg=500;function md(t){return t>0&&t<=xg?`${t}px`:null}const yg=/^[a-zA-Z][a-zA-Z0-9+.-]*:/;function wg(t,e){if(!t||!e||e.startsWith("/")||e.startsWith("#")||yg.test(e))return null;const r=e.match(/^([^?#]*)([?#].*)?$/),i=(r==null?void 0:r[1])??e,s=(r==null?void 0:r[2])??"";if(!i)return null;const a=t.split("/").slice(0,-1);for(const l of i.split("/"))if(!(l===""||l==="."))if(l===".."){if(a.length===0)return null;a.pop()}else a.push(l);return`/api/preview/raw?path=${a.map(encodeURIComponent).join("/")}${s}`}const ph={heading(t){const e=this.parser.parseInline(t.tokens),r=rs(t.raw);return`<h${t.depth} data-source-line="${r}">${e}</h${t.depth}>
`},paragraph(t){const e=this.parser.parseInline(t.tokens);return`<p data-source-line="${rs(t.raw)}">${e}</p>
`},code(t){const e=rs(t.raw),r=ea(t.text),i=t.lang?` class="language-${ea(t.lang)}"`:"";return`<pre data-source-line="${e}"><button class="copy-btn" title="复制代码">复制</button><code${i}>${r}</code></pre>
`},list(t){const e=rs(t.raw);let r="";for(const a of t.items)r+=this.listitem(a);const i=t.ordered?"ol":"ul",s=t.ordered&&t.start!==1?` start="${t.start}"`:"";return`<${i}${s} data-source-line="${e}">
${r}</${i}>
`},blockquote(t){const e=rs(t.raw),r=this.parser.parse(t.tokens);return`<blockquote data-source-line="${e}">
${r}</blockquote>
`}};ph.image=function(t){const e=ea(t.href||""),r=t.title?` title="${ea(t.title)}"`:"",i=ea(t.text||""),s=i&&i!=="照片"?`<figcaption>${i}</figcaption>`:"";return`<figure><img src="${e}" alt="${i}"${r} loading="lazy">${s}</figure>
`};const _g={name:"singleLineDisplayMath",level:"block",start(t){return t.indexOf("$$")},tokenizer(t){const e=/^\$\$([^\n]+?)\$\$\s*(?:\n|$)/.exec(t);if(e)return{type:"singleLineDisplayMath",raw:e[0],text:e[1].trim()}},renderer(t){const e=rs(t.raw),r=dh.renderToString(t.text.replace(/\$/g,""),{displayMode:!0,throwOnError:!1});return`<div data-source-line="${e}">${r}</div>
`}};let vd=!1;function kg(){vd||(vd=!0,de.use({hooks:{preprocess(t){return Ks=t,xl=0,t}},renderer:ph}),de.use(xb({throwOnError:!1})),de.use({extensions:[_g]}))}let Vt=class extends G{constructor(){super(...arguments),this.content="",this.line=null,this.keyword="",this.pages=null,this.docPath="",this._viewerSrc="",this._copied=!1,this.suppressLocate=!1,this._scrollJump=new dc(this,{behavior:"smooth"}),this._copyAll=()=>{navigator.clipboard.writeText(this.content).then(()=>{this._copied=!0,setTimeout(()=>{this._copied=!1},1500)}).catch(()=>{})}}firstUpdated(){this._scrollJump.attach(this)}updated(t){var e;(e=super.updated)==null||e.call(this,t),(t.has("content")||t.has("keyword"))&&this._highlightKeyword(),(t.has("content")||t.has("pages")||t.has("docPath"))&&(this._resolveImageUrls(),this._applyIconSizing(),this._bindImageClicks(),this._bindCopyButtons()),(t.has("line")||t.has("content"))&&(this.suppressLocate||this._locateAndHighlight()),this._scrollJump.refresh()}_resolveImageUrls(){if(!this.docPath)return;this.shadowRoot.querySelectorAll("img").forEach(e=>{const r=e.getAttribute("src")??"",i=wg(this.docPath,r);i&&(e.src=i)})}_bindImageClicks(){this.shadowRoot.querySelectorAll("img").forEach(e=>{e.dataset.bound||(e.dataset.bound="true",e.style.cursor="zoom-in",e.addEventListener("click",()=>{this._viewerSrc=e.src}))})}_bindCopyButtons(){this.shadowRoot.querySelectorAll(".copy-btn").forEach(e=>{e.dataset.bound||(e.dataset.bound="true",e.addEventListener("click",()=>{var i;const r=(i=e.parentElement)==null?void 0:i.querySelector("code");r&&navigator.clipboard.writeText(r.textContent||"").then(()=>{e.textContent="已复制",setTimeout(()=>{e.textContent="复制"},1500)}).catch(()=>{})}))})}_dispWidthFromSrc(t){try{const e=new URL(t,window.location.href).searchParams.get("dw");if(!e)return null;const r=Number(e);return Number.isFinite(r)&&r>0?r:null}catch{return null}}_applyIconSizing(){this.shadowRoot.querySelectorAll("img").forEach(e=>{const r=this._dispWidthFromSrc(e.src);if(r!==null){const s=md(r);s&&(e.style.width=s);return}const i=()=>{try{const s=md(e.naturalWidth);s&&(e.style.width=s)}catch{}};e.complete&&e.naturalWidth>0?i():e.addEventListener("load",i,{once:!0})})}_findBlockAtLine(t){const e=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));return e.length===0?null:e.reduce((r,i)=>{const s=Number(i.getAttribute("data-source-line"));return s<=t&&(!r||s>Number(r.getAttribute("data-source-line")))?i:r},null)}topSourceLine(){const t=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));if(t.length===0)return 1;const e=this.getBoundingClientRect();for(const i of t)if(i.getBoundingClientRect().bottom>e.top+1)return Number(i.getAttribute("data-source-line"))||1;const r=t[t.length-1];return Number(r.getAttribute("data-source-line"))||1}scrollToSourceLine(t,e="auto"){const r=this._findBlockAtLine(t);if(!r)return;const i=this.getBoundingClientRect();if(i.height<=0)return;const s=r.getBoundingClientRect();this.scrollTo({top:s.top-i.top+this.scrollTop,behavior:e})}_locateAndHighlight(){if(this.line===null||this.line===void 0)return;const t=this._findBlockAtLine(this.line);t&&(this.scrollToSourceLine(this.line,"smooth"),t.classList.remove("highlight-flash"),t.offsetWidth,t.classList.add("highlight-flash"))}_highlightKeyword(){var o,l;const t=(o=this.shadowRoot)==null?void 0:o.querySelector(".md-body-paged, .md-body");if(!t)return;const e=(this.keyword??"").split(/\s+/).filter(c=>c.length>0);if(e.length===0)return;const r=new RegExp(e.map(c=>this._escapeRegExp(c)).join("|"),"gi"),i=document.createTreeWalker(t,NodeFilter.SHOW_TEXT,{acceptNode(c){const h=c.parentElement;if(!h)return NodeFilter.FILTER_REJECT;const f=h.tagName;return f==="SCRIPT"||f==="STYLE"||f==="MARK"?NodeFilter.FILTER_REJECT:r.test(c.nodeValue??"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),s=[];let a;for(;a=i.nextNode();)s.push(a);for(const c of s){r.lastIndex=0;const h=c.nodeValue??"",f=document.createDocumentFragment();let b=0,y;for(;(y=r.exec(h))!==null;){y.index>b&&f.appendChild(document.createTextNode(h.slice(b,y.index)));const k=document.createElement("mark");k.textContent=y[0],k.className="keyword-hit",f.appendChild(k),b=y.index+y[0].length,y[0].length===0&&r.lastIndex++}b<h.length&&f.appendChild(document.createTextNode(h.slice(b))),(l=c.parentNode)==null||l.replaceChild(f,c)}}_escapeRegExp(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}_splitByPages(t,e){const r=t.split(`
`),i=[];for(let s=0;s<e.length;s++){const a=e[s].line_start-1,o=s+1<e.length?e[s+1].line_start-1:r.length,l=r.slice(Math.max(0,a),Math.max(0,o)).join(`
`);i.push({label:e[s].label,md:l,offset:a})}return i}render(){if(kg(),!this.content)return p`<div class="empty">无内容</div>`;if(this.pages&&this.pages.length>0){const e=this._splitByPages(this.content,this.pages);return p`
        <div class="md-body md-body-paged">
          <div class="copy-bar-top">${this._renderCopyBtn()}</div>
          ${e.map(r=>{xo=r.offset;const i=po(de.parse(r.md,{async:!1}));return p`
              <section class="page-card">
                <header class="page-card-header">${r.label}</header>
                <div .innerHTML=${i}></div>
              </section>
            `})}
        </div>
        <div class="scroll-jump-anchor">${go(this._scrollJump)}</div>
        ${this._viewerSrc?p`<image-viewer .src=${this._viewerSrc} @close=${()=>this._viewerSrc=""}></image-viewer>`:null}
      `}xo=0;const t=po(de.parse(this.content,{async:!1}));return p`
      <div class="md-body">
        <div class="copy-bar-top">${this._renderCopyBtn()}</div>
        <div .innerHTML=${t}></div>
      </div>
      <div class="scroll-jump-anchor">${go(this._scrollJump)}</div>
      ${this._viewerSrc?p`<image-viewer
        .src=${this._viewerSrc}
        @close=${()=>this._viewerSrc=""}></image-viewer>`:null}
    `}_renderCopyBtn(){return p`<button class="doc-copy" @click=${this._copyAll}>
      ${this._copied?"✓ 已复制":p`<doclens-icon name="copy" style="font-size:14px"></doclens-icon> 复制全文`}
    </button>`}};Vt.styles=[uc,Dd(_b),U`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: block;
      padding: var(--cortex-space-4);
      background: var(--cortex-surface-muted);   /* surface-soft 底：白画布上让白纸浮起 */
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow-y: auto;
      /* 作为 preview-pane (flex column) 的 flex item，必须用 flex 填充
         而非 height: 100%。height: 100% + overflow: auto 在 iOS Safari
         中会触发 flexbox 触摸滚动 bug，导致手指滑动无法滚动内容。 */
      flex: 1 1 0;
      min-height: 0;
    }
    :host h1, :host h2, :host h3, :host h4 {
      margin: 1em 0 0.5em;
      line-height: 1.3;
      color: var(--cortex-text);
    }
    :host h1, :host h2 {
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    :host h3, :host h4 {
      font-weight: 600;
    }
    :host h1 { font-size: 1.4em; }
    :host h2 { font-size: 1.2em; }
    :host h3 { font-size: 1.05em; }
    :host p { margin: 0.5em 0; color: var(--cortex-text); }
    /* 链接：primary + 无下划线；hover 下划线 */
    :host a { color: var(--cortex-primary); text-decoration: none; }
    :host a:hover { text-decoration: underline; }
    :host ul, :host ol { margin: 0.5em 0; padding-left: 1.5em; }
    :host li { margin: 0.2em 0; }
    /* 代码块：surface-muted + hairline + radius-md；长行自动折行不横向滚动 */
    :host pre {
      position: relative;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      overflow-x: hidden;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .copy-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm, 6px);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 12px;
      font-family: var(--cortex-font);
      opacity: 0;
      transition: opacity 0.15s;
    }
    pre:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { color: var(--cortex-primary); border-color: var(--cortex-primary); }
    /* pre 内 code 重置 inline 样式 */
    :host pre code {
      background: transparent;
      padding: 0;
      font-size: inherit;
    }
    /* inline code：mono + surface-muted + radius-sm */
    :host code {
      font-family: var(--cortex-font-mono);
      font-size: 0.9em;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
    }
    /* 引用：primary 左边框 + primary-soft 底 + radius 右侧 */
    :host blockquote {
      border-left: 3px solid var(--cortex-primary);
      background: var(--cortex-primary-soft);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-radius: 0 var(--cortex-radius-md) var(--cortex-radius-md) 0;
      color: var(--cortex-text-muted);
      margin: 0.5em 0;
    }
    /* md 表格：之前缺规则导致浏览器默认无边框，分隔线不可见 */
    :host table {
      border-collapse: collapse;
      margin: 0.75em 0;
      font-size: var(--cortex-fs-sm);
      display: block;
      overflow-x: auto;  /* 宽表横向滚动，避免撑破预览面板 */
    }
    :host th, :host td {
      border: 1px solid var(--cortex-border);
      padding: var(--cortex-space-2);
      text-align: left;
      vertical-align: top;
    }
    :host th {
      background: var(--cortex-surface-muted);
      font-weight: 600;
    }
    :host tbody tr:nth-child(even) {
      background: var(--cortex-surface-muted);
    }
    /* 图片：inline-block 流式排列——小图（icon，设了固定 width）从左到右排成行，
       大图（max-width:100%）自然占满一行。连续图片由后端用空格 join 进同一段落，
       渲染后成为同 <p> 内的 inline <img>，从而横向流动换行。 */
    :host figure {
      margin: 0 0 var(--cortex-space-2) 0;
      display: inline-block;
    }
    :host img {
      max-width: 100%;
      height: auto;
      border-radius: var(--cortex-radius-md);
      display: block;
    }
    :host figcaption {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      text-align: center;
      margin-top: var(--cortex-space-1, 4px);
      line-height: 1.4;
    }
    /* 单块预览（docx/md）= 一张白纸；max-width 居中，宽屏不撑满 */
    .md-body {
      position: relative;
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-sm);
      padding: var(--cortex-space-8) var(--cortex-space-8);
      max-width: 820px;
      margin: 0 auto;
    }
    /* 分页容器（pdf/pptx/excel）：覆盖 .md-body 白纸为透明，
       仅保留居中 —— 让子 .page-card 当"多张纸"而非"一张大纸包多页"。
       必须在 .md-body 之后定义才能覆盖。 */
    .md-body-paged {
      background: transparent;
      box-shadow: none;
      padding: 0;
      border-radius: 0;
      max-width: 820px;
      margin: 0 auto;
    }
    .empty {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: var(--cortex-space-6);
    }
    /* 全文复制按钮：贴纸面右上角（absolute，不受 padding 影响） */
    .copy-bar-top {
      position: absolute;
      top: 8px;
      right: 12px;
      z-index: 5;
    }
    .doc-copy {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 32px;
      padding: 0 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 13px;
      font-family: var(--cortex-font);
      opacity: 0.7;
      transition: opacity 0.15s;
    }
    .doc-copy:hover { opacity: 1; color: var(--cortex-primary); }
    /* 定位块的闪烁动画（"你滚到这里了"指示）
       使用 box-shadow 而不是 background，避免和 <mark class="keyword-hit">
       的 primary 底色叠加产生视觉混乱（xlsx 场景下 scrollTo 可能是 mark）。
       primary-based rgba 对齐 SaaS Boutique Electric Blue。 */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { box-shadow: 0 0 0 4px rgba(0, 100, 224, 0.12); }
      100% { box-shadow: 0 0 0 4px transparent; }
    }
    /* 搜索关键字命中高亮（primary-soft 底，类似浏览器 Ctrl+F）
       SaaS Boutique：旧 amber #FEF3C7 已替换为 primary-based rgba。 */
    :host mark.keyword-hit {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    /* 分页卡片：白纸，靠阴影区分（去 border） */
    .page-card {
      background: var(--cortex-surface);
      border: none;
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-md);
      margin: 0 0 var(--cortex-space-4);
      padding: var(--cortex-space-6) var(--cortex-space-8);
    }
    .page-card-header {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-weight: 500;
      letter-spacing: 0.02em;
      padding-bottom: var(--cortex-space-2);
      margin-bottom: var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    /* 卡片内部标题更紧凑 */
    .page-card h1, .page-card h2, .page-card h3 {
      margin-top: 0.5em;
    }
    /* 移动端：纸张边距收紧 */
    @media (max-width: 768px) {
      :host { padding: var(--cortex-space-2); }
      .md-body, .page-card {
        padding: var(--cortex-space-4);
        border-radius: var(--cortex-radius-md);
      }
    }
  `];Pr([w()],Vt.prototype,"content",2);Pr([w({type:Number})],Vt.prototype,"line",2);Pr([w()],Vt.prototype,"keyword",2);Pr([w({attribute:!1})],Vt.prototype,"pages",2);Pr([w({attribute:"doc-path"})],Vt.prototype,"docPath",2);Pr([$()],Vt.prototype,"_viewerSrc",2);Pr([$()],Vt.prototype,"_copied",2);Pr([w({type:Boolean})],Vt.prototype,"suppressLocate",2);Vt=Pr([Z("md-viewer")],Vt);var Sg=Object.defineProperty,zg=Object.getOwnPropertyDescriptor,qi=(t,e,r,i)=>{for(var s=i>1?void 0:i?zg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Sg(e,r,s),s};let Tr=class extends G{constructor(){super(...arguments),this.path="",this.originalContent="",this.mobile=!1,this._text="",this._dirty=!1,this._error=null,this._scrollJump=new dc(this,{behavior:"auto",onJumpTop:t=>this._jumpToEdge(t,0),onJumpBottom:t=>{const e=t;this._jumpToEdge(e,e.value.length)}}),this._onSaveClick=()=>{this._dirty&&this._emitSave()},this._onCancelClick=()=>{this.discard()}}willUpdate(t){t.has("originalContent")&&(this._text=this.originalContent,this._dirty=!1,this._error=null)}firstUpdated(){const t=this.shadowRoot.querySelector("textarea");t&&this._scrollJump.attach(t)}updated(){this._scrollJump.refresh()}get _textarea(){return this.shadowRoot.querySelector("textarea")}_jumpToEdge(t,e){t.focus(),t.setSelectionRange(e,e),t.scrollTop=e===0?0:t.scrollHeight-t.clientHeight}get _lines(){return this._text.split(`
`)}_syncMirror(){const t=this._textarea,e=this.shadowRoot.querySelector(".mirror");if(!t||!e)return null;const r=getComputedStyle(t),i=t.clientWidth-parseFloat(r.paddingLeft)-parseFloat(r.paddingRight);return e.style.width=`${i}px`,e.style.fontFamily=r.fontFamily,e.style.fontSize=r.fontSize,e.style.lineHeight=r.lineHeight,e.style.letterSpacing=r.letterSpacing,e}_heightBeforeLine(t){if(t<=1)return 0;const e=this._syncMirror();if(!e)return 0;const r=this._lines;e.textContent=r.slice(0,Math.min(t-1,r.length)).join(`
`);const i=e.offsetHeight;return e.textContent="",i}topLine(){const t=this._textarea;if(!t)return 1;const e=t.scrollTop,r=this._lines.length;let i=1,s=r;for(;i<s;){const a=i+s+1>>1;this._heightBeforeLine(a)<=e?i=a:s=a-1}return i}scrollToLine(t){const e=this._textarea;e&&(e.scrollTop=this._heightBeforeLine(t))}_onInput(t){const e=t.target;this._text=e.value,this._error=null,this._updateDirty()}_onKeyDown(t){(t.ctrlKey||t.metaKey)&&t.key==="s"&&(t.preventDefault(),this._dirty&&this._emitSave())}_updateDirty(){const t=this._text!==this.originalContent;t!==this._dirty&&(this._dirty=t,this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:t}})))}_emitSave(){this.dispatchEvent(new CustomEvent("save",{detail:{content:this._text}}))}discard(){this._text=this.originalContent,this._dirty=!1,this._error=null,this._updateDirty(),this.dispatchEvent(new CustomEvent("cancel",{}))}setError(t){this._error=t}render(){return p`
      <div class="toolbar">
        ${this.mobile?null:p`<span class="path">${this.path}</span>`}
        ${this._error?p`<span class="error-msg"><doclens-icon name="alert-triangle"></doclens-icon> ${this._error}</span>`:this._dirty?p`<span class="dirty">●未保存</span>`:null}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          <doclens-icon name="save"></doclens-icon>保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}><doclens-icon name="x"></doclens-icon>取消</button>
      </div>
      <div class="body">
        <div class="mirror" aria-hidden="true"></div>
        <textarea
          spellcheck="false"
          .value=${this._text}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
        ></textarea>
        ${go(this._scrollJump)}
      </div>
    `}};Tr.styles=[uc,U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-lg);
      overflow: hidden;
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .toolbar .path {
      flex: 1;
      min-width: 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .toolbar .dirty {
      color: var(--cortex-warning);
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
    }
    .toolbar .error-msg {
      color: var(--cortex-danger);
      background: rgba(220, 38, 38, 0.06);
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-1) var(--cortex-space-2);
      border-radius: var(--cortex-radius-sm);
      flex: 1;
    }
    /* 次级按钮：hairline + radius-sm + muted */
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    button:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    /* 主按钮：保存 = primary gradient + glow */
    button.save-btn {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.save-btn:hover {
      opacity: 0.9;
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
    }
    button.save-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      position: relative;  /* FAB absolute 定位上下文 */
    }
    /* 悬浮跳转按钮：覆盖在 textarea 右下角 */
    .body > .scroll-jump-fabs {
      position: absolute;
      right: var(--cortex-space-3);
      bottom: var(--cortex-space-3);
    }
    /* 隐藏镜像 div：与 textarea 同宽同字体，用于折行下的行号↔像素换算 */
    .mirror {
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      pointer-events: none;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      z-index: -1;
    }
    textarea {
      flex: 1;
      resize: none;
      border: none;
      outline: none;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      background: var(--cortex-surface);
      color: var(--cortex-text);
      white-space: pre-wrap;  /* 长行自动折回，不横向滚动 */
      overflow: auto;
    }
  `];qi([w()],Tr.prototype,"path",2);qi([w()],Tr.prototype,"originalContent",2);qi([w({type:Boolean})],Tr.prototype,"mobile",2);qi([$()],Tr.prototype,"_text",2);qi([$()],Tr.prototype,"_dirty",2);qi([$()],Tr.prototype,"_error",2);Tr=qi([Z("md-editor")],Tr);class fh extends Error{constructor(e,r,i){super(r),this.code=e,this.status=i,this.name="PreviewSaveError"}}async function $g(t,e){const r=await fetch(`/api/preview?path=${encodeURIComponent(t)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:e})});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new fh(i.code??"UNKNOWN",i.detail??"保存失败",r.status)}return r.json()}class mh extends Error{constructor(e,r,i){super(r),this.code=e,this.status=i,this.name="PreviewUploadError"}}async function Tg(t){const e=new FormData;e.append("file",t);const r=await fetch("/api/preview/upload",{method:"POST",body:e});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new mh(i.code??"UNKNOWN",i.detail??"上传失败",r.status)}return r.json()}const Cg=[".md",".pdf",".docx",".xlsx",".xlsm",".xltx",".xltm",".csv",".mhtml",".mht",".pst",".png",".jpg",".jpeg",".webp",".gif",".bmp",".tiff",".tif"];function Eg(t){const e=t.toLowerCase();return e.includes("#")&&e.split("#")[0].endsWith(".pst")?!0:Cg.some(r=>e.endsWith(r))}const Ag=[".png",".jpg",".jpeg",".webp"];function bd(t){const e=t.toLowerCase();return Ag.some(r=>e.endsWith(r))}async function ps(t){const e=new URLSearchParams({path:t});try{const r=await fetch(`/api/preview?${e}`);if(r.ok){const a=await r.json();return{ok:!0,path:a.path,content:a.content,language:a.language,writable:a.writable??!1,pages:a.pages??null,lineMap:a.line_map??null,attachments:a.attachments??null}}const i=await r.json().catch(()=>({code:"UNKNOWN",detail:""}));return{ok:!1,notIndexed:i.code==="NOT_INDEXED",message:i.detail||i.code||`HTTP ${r.status}`}}catch(r){return{ok:!1,notIndexed:!1,message:r.message||"网络错误"}}}async function Mg(t,e=0,r=50){const i=new URLSearchParams({path:t,offset:String(e),limit:String(r)});try{const s=await fetch(`/api/pst/emails?${i}`);if(s.ok){const o=await s.json();return{ok:!0,path:o.path,total:o.total,offset:o.offset,limit:o.limit,emails:o.emails??[]}}const a=await s.json().catch(()=>({code:"UNKNOWN",detail:""}));return{ok:!1,notIndexed:a.code==="NOT_INDEXED",message:a.detail||a.code||`HTTP ${s.status}`}}catch(s){return{ok:!1,notIndexed:!1,message:s.message||"网络错误"}}}function Zr(t){return t.toLowerCase().endsWith(".pst")&&!t.includes("#")}function Di(t){const e=t.toLowerCase();return e.includes("#")&&e.split("#")[0].endsWith(".pst")}var Pg=Object.defineProperty,Dg=Object.getOwnPropertyDescriptor,qe=(t,e,r,i)=>{for(var s=i>1?void 0:i?Dg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Pg(e,r,s),s};let Oe=class extends G{constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1,this.line=null,this.keyword="",this.writable=!1,this.noHeader=!1,this.mobile=!1,this.pages=null,this.attachments=null,this.showBack=!1,this.backLabel="返回",this.enableReparse=!1,this._mode="preview",this._content="",this._showMobileMenu=!1,this._anchorLine=1,this._suppressLocate=!1,this._skipRestoreOnce=!1,this._scrollJump=new dc(this,{behavior:"smooth"}),this._onMobileBackClick=()=>{this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=t=>{t.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=t=>{var s,a;if(!this._showMobileMenu)return;const e=t.composedPath(),r=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-menu"),i=(a=this.shadowRoot)==null?void 0:a.querySelector(".mobile-more");r&&e.includes(r)||i&&e.includes(i)||(this._showMobileMenu=!1)},this._onEditorCancel=()=>{this._captureEditorAnchor(),this._mode="preview"},this._onEditorDirty=t=>{this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:t.detail.dirty}}))},this._onDownloadClick=()=>{if(!this.path)return;const t=`/api/preview/download?path=${encodeURIComponent(this.path)}`,e=document.createElement("a");e.href=t,e.rel="noopener",document.body.appendChild(e),e.click(),document.body.removeChild(e)},this._onReparseClick=()=>{this.path&&this.dispatchEvent(new CustomEvent("reparse",{detail:{path:this.path},bubbles:!0,composed:!0}))},this._onUploadClick=()=>{var e;const t=(e=this.shadowRoot)==null?void 0:e.querySelector('input[type="file"]');t==null||t.click()}}willUpdate(t){t.has("content")&&(this._content=this.content,this._mode="preview",this._skipRestoreOnce=!0,this._suppressLocate=!1,this._anchorLine=1)}async updated(t){var i;(i=super.updated)==null||i.call(this,t);const e=this.shadowRoot.querySelector(".body");if(e?this._scrollJump.attach(e):this._scrollJump.detach(),!t.has("_mode"))return;if(this._mode==="edit"){const s=this.shadowRoot.querySelector("md-editor");s&&(await s.updateComplete,s.scrollToLine(this._anchorLine));return}if(this._skipRestoreOnce){this._skipRestoreOnce=!1;return}const r=this.shadowRoot.querySelector("md-viewer");r&&(await r.updateComplete,r.scrollToSourceLine(this._anchorLine,"auto")),this._suppressLocate=!1}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}_basename(t){if(!t)return"";const e=t.lastIndexOf("/");return e>=0?t.slice(e+1):t}get _isPst(){return Di(this.path)||Zr(this.path)}_renderMobileHeader(){return p`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="mobile-filename" title=${this.path}>${this._basename(this.path)}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        ><doclens-icon name="more-horizontal"></doclens-icon></button>
        ${this._showMobileMenu?p`
              <div class="mobile-menu" role="menu">
                ${this.writable?p`<button
                      type="button"
                      role="menuitem"
                      @click=${()=>{this._showMobileMenu=!1,this.enterEdit()}}
                    ><doclens-icon name="pencil"></doclens-icon>编辑</button>`:null}
                ${this._isPst?null:p`<button
                      type="button"
                      role="menuitem"
                      @click=${()=>{this._showMobileMenu=!1,this._onDownloadClick()}}
                    ><doclens-icon name="download"></doclens-icon>下载</button>
                <button
                  type="button"
                  role="menuitem"
                  @click=${()=>{this._showMobileMenu=!1,this._onUploadClick()}}
                ><doclens-icon name="upload"></doclens-icon>上传</button>
                ${this.enableReparse&&bd(this.path)?p`<button
                      type="button"
                      role="menuitem"
                      @click=${()=>{this._showMobileMenu=!1,this._onReparseClick()}}
                    ><doclens-icon name="refresh-cw"></doclens-icon>重新解析</button>`:null}`}
              </div>
            `:null}
      </div>
    `}enterEdit(){const t=this.shadowRoot.querySelector("md-viewer");t&&(this._anchorLine=t.topSourceLine()),this._mode="edit"}_captureEditorAnchor(){const t=this.shadowRoot.querySelector("md-editor");t&&(this._anchorLine=t.topLine()),this._suppressLocate=!0}async _onEditorSave(t){const e=this.shadowRoot.querySelector("md-editor");this._captureEditorAnchor();try{await $g(this.path,t.detail.content),this._content=t.detail.content,this._mode="preview",this.dispatchEvent(new CustomEvent("saved",{detail:{content:t.detail.content}}))}catch(r){const i=r instanceof fh?`${r.code} ${r.message}`:r.message??"保存失败";e==null||e.setError(i),this.dispatchEvent(new CustomEvent("save-failed",{detail:{message:i}}))}}discard(){const t=this.shadowRoot.querySelector("md-editor");t==null||t.discard(),this._mode="preview"}_renderDownloadBtn(){return this._isPst?null:p`<button class="download-btn" @click=${this._onDownloadClick}><doclens-icon name="download"></doclens-icon>下载</button>`}_renderReparseBtn(){return!this.enableReparse||this._isPst||!bd(this.path)?null:p`<button class="download-btn" @click=${this._onReparseClick}><doclens-icon name="refresh-cw"></doclens-icon>重新解析</button>`}_renderBackBtn(){return this.showBack?p`<button class="back-btn" @click=${this._onMobileBackClick}><doclens-icon name="arrow-left"></doclens-icon>${this.backLabel}</button>`:null}async _onFileChange(t){var s;const e=t.target,r=(s=e.files)==null?void 0:s[0];if(e.value="",!(!r||!window.confirm(`即将上传 '${r.name}' 覆盖原文件，是否继续？`)))try{const a=await Tg(r);this.dispatchEvent(new CustomEvent("upload-success",{detail:{path:a.path}}))}catch(a){const o=a instanceof mh?`${a.code} ${a.message}`:a.message??"上传失败";this.dispatchEvent(new CustomEvent("upload-failed",{detail:{message:o}}))}}_renderUploadBtn(){return this._isPst?null:p`<button class="upload-btn" @click=${this._onUploadClick}><doclens-icon name="upload"></doclens-icon>上传</button>`}_formatSize(t){return t>=1024*1024?`${(t/1024/1024).toFixed(1)} MB`:t>=1024?`${Math.round(t/1024)} KB`:`${t} B`}_renderAttachments(){return!this.attachments||this.attachments.length===0?null:p`
      <div class="attachments">
        <div class="attachments-title">附件（${this.attachments.length}）</div>
        ${this.attachments.map(t=>t.stored&&t.download_url?p`<a
                class="attachment"
                href=${t.download_url}
                title=${t.name}
              ><doclens-icon name="download"></doclens-icon>
                <span class="name">${t.name}</span>
                <span class="size">${this._formatSize(t.size)}</span>
              </a>`:p`<span class="attachment disabled" title=${t.name}>
                <span class="name">${t.name}</span>
                <span class="size">${this._formatSize(t.size)} · 未落盘</span>
              </span>`)}
      </div>
    `}render(){if(this.loading)return p`<div class="empty">加载中...</div>`;if(!this._content&&!this.content)return p`<div class="empty">点击左侧结果查看预览</div>`;const t=this.mobile?this._renderMobileHeader():null,e=!this.mobile&&!this.noHeader;if(this.language==="markdown"&&this._mode==="edit")return p`
        <input type="file" hidden @change=${this._onFileChange}>
        ${t}
        ${e?p`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
          </div>
        `:null}
        <md-editor
          .path=${this.path}
          .originalContent=${this._content}
          ?mobile=${this.mobile}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
      `;if(this.language==="markdown")return p`
        <input type="file" hidden @change=${this._onFileChange}>
        ${t}
        ${e?p`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this.writable?p`<button class="edit-btn" @click=${()=>this.enterEdit()}><doclens-icon name="pencil"></doclens-icon>编辑</button>`:null}
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
          </div>
        `:null}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this.keyword}
          .pages=${this.pages}
          .docPath=${this.path}
          ?suppressLocate=${this._suppressLocate}
        ></md-viewer>
        ${this._renderAttachments()}
      `;if(this.language==="html")return p`
        <input type="file" hidden @change=${this._onFileChange}>
        ${t}
        ${e?p`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
          </div>
        `:null}
        <iframe
          class="html-frame"
          srcdoc=${this._content}
          sandbox="allow-scripts"
          title="HTML 预览"
        ></iframe>
      `;const r=this._content.split(`
`);return p`
      <input type="file" hidden @change=${this._onFileChange}>
      ${t}
      ${e?p`
        <div class="header">
          ${this._renderBackBtn()}
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
        </div>
      `:null}
      <div class="body">
        ${r.map((i,s)=>{const a=s+1,o=this.highlights.includes(a)?"highlight":"";return p`<div class="line ${o}"><span class="line-no">${a}</span>${i}</div>`})}
        <div class="scroll-jump-anchor">${go(this._scrollJump)}</div>
      </div>
    `}};Oe.styles=[uc,U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .header .path {
      flex: 1;
      min-width: 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre-wrap;      /* 长行自动折回，不横向滚动 */
      overflow-wrap: anywhere;
    }
    /* 行号悬挂缩进：折行的续行对齐到正文列，不压行号列 */
    .body .line {
      padding-left: 48px;
      text-indent: -48px;
    }
    .body .line-no {
      color: var(--cortex-text-subtle);
      display: inline-block;
      width: 40px;
    }
    /* 搜索命中行高亮 —— SaaS Boutique primary-based（替代旧 amber） */
    .highlight {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    .html-frame {
      flex: 1;
      border: none;
      border-radius: 0;
      width: 100%;
      background: #fff;
      min-height: 0;
    }
    /* PST 邮件附件下载区（markdown 预览底部） */
    .attachments {
      flex-shrink: 0;
      max-height: 30%;
      overflow: auto;
      border-top: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-1);
    }
    .attachments-title {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-weight: 500;
      padding: var(--cortex-space-1) 0;
    }
    .attachment {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-primary);
      text-decoration: none;
      padding: var(--cortex-space-1) var(--cortex-space-2);
      border-radius: var(--cortex-radius-md);
      transition: background 0.12s;
      min-width: 0;
    }
    .attachment:hover {
      background: var(--cortex-primary-soft);
    }
    .attachment .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .attachment .size {
      flex-shrink: 0;
      margin-left: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .attachment.disabled {
      color: var(--cortex-text-muted);
      cursor: default;
    }
    .attachment.disabled:hover {
      background: transparent;
    }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
    }
    /* 次级动作按钮：hairline + radius-sm + muted；hover surface-muted + text */
    button.download-btn,
    button.upload-btn,
    button.back-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    button.download-btn:hover,
    button.upload-btn:hover,
    button.back-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    button.back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    /* 主动作：编辑按钮 = primary gradient + glow */
    button.edit-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: none;
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button.edit-btn:hover { opacity: 0.9; }
    button.edit-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    .mobile-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      flex-shrink: 0;
      position: relative;
    }
    /* 圆形返回 / 更多按钮 —— 同 focus-header */
    .mobile-header .mobile-back,
    .mobile-header .mobile-more {
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      touch-action: manipulation;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .mobile-header .mobile-back:hover,
    .mobile-header .mobile-more:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .mobile-header .mobile-filename {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-header .mobile-menu {
      position: absolute;
      top: 100%;
      right: var(--cortex-space-2);
      min-width: 140px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10;
      padding: var(--cortex-space-1) 0;
    }
    .mobile-header .mobile-menu button {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      cursor: pointer;
      transition: background 0.15s;
    }
    .mobile-header .mobile-menu button:hover {
      background: var(--cortex-surface-muted);
    }
  `];qe([w()],Oe.prototype,"path",2);qe([w()],Oe.prototype,"language",2);qe([w()],Oe.prototype,"content",2);qe([w({attribute:!1})],Oe.prototype,"highlights",2);qe([w({type:Boolean})],Oe.prototype,"loading",2);qe([w({type:Number})],Oe.prototype,"line",2);qe([w()],Oe.prototype,"keyword",2);qe([w({type:Boolean})],Oe.prototype,"writable",2);qe([w({type:Boolean})],Oe.prototype,"noHeader",2);qe([w({type:Boolean})],Oe.prototype,"mobile",2);qe([w({attribute:!1})],Oe.prototype,"pages",2);qe([w({attribute:!1})],Oe.prototype,"attachments",2);qe([w({type:Boolean})],Oe.prototype,"showBack",2);qe([w()],Oe.prototype,"backLabel",2);qe([w({type:Boolean})],Oe.prototype,"enableReparse",2);qe([$()],Oe.prototype,"_mode",2);qe([$()],Oe.prototype,"_content",2);qe([$()],Oe.prototype,"_showMobileMenu",2);Oe=qe([Z("preview-pane")],Oe);var Og=Object.defineProperty,Ig=Object.getOwnPropertyDescriptor,Ss=(t,e,r,i)=>{for(var s=i>1?void 0:i?Ig(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Og(e,r,s),s};let ii=class extends G{constructor(){super(...arguments),this.role="user",this.message=null,this.error=null,this.modelName=null,this._copied=!1,this._onHoverChange=t=>{this.classList.toggle("hovered",t.type==="mouseenter")},this._onClick=t=>{const e=t.composedPath().find(i=>i instanceof HTMLElement&&i.classList.contains("ref-link"));if(!e)return;t.preventDefault();const r=e.getAttribute("data-path")??"";this.dispatchEvent(new CustomEvent("reference-click",{detail:{path:r},bubbles:!0,composed:!0}))},this._emitReask=t=>{var r;t.stopPropagation();const e=((r=this.message)==null?void 0:r.content)??"";this.dispatchEvent(new CustomEvent("reask",{detail:{content:e},bubbles:!0,composed:!0}))},this._onCopy=async t=>{var r;t.stopPropagation();const e=((r=this.message)==null?void 0:r.content)??"";if(e)try{await navigator.clipboard.writeText(e),this._copied=!0,this._copyTimer!==void 0&&window.clearTimeout(this._copyTimer),this._copyTimer=window.setTimeout(()=>{this._copied=!1},1500)}catch{this.dispatchEvent(new CustomEvent("copy-failed",{bubbles:!0,composed:!0}))}}}firstUpdated(){this.addEventListener("click",this._onClick),this.addEventListener("mouseenter",this._onHoverChange),this.addEventListener("mouseleave",this._onHoverChange)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this._onClick),this.removeEventListener("mouseenter",this._onHoverChange),this.removeEventListener("mouseleave",this._onHoverChange),this._copyTimer!==void 0&&window.clearTimeout(this._copyTimer)}renderBubble(t){if(t===""){const e=this.modelName?`${this.modelName} 思考中`:"思考中";return p`<span class="thinking">${e}...</span>`}if(this.role==="assistant"){const e=de.parse(t,{async:!1}),r=po(this.linkifyReferences(e));return p`<div class="md-body" .innerHTML=${r}></div>`}return t}linkifyReferences(t){const e=/(<h2[^>]*>\s*参考资料\s*<\/h2>)\s*(<(?:ol|ul)[^>]*>[\s\S]*?<\/(?:ol|ul)>)/i;return t.replace(e,(r,i,s)=>{const a=s.replace(/<li>([^<]+?)<\/li>/g,(o,l)=>{const c=l.trim();return`<li><a class="ref-link" data-path="${c.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" href="#">${c}</a></li>`});return`${i}${a}`})}render(){if(!this.message)return null;const t=this.message.tool_steps,e=this.role==="assistant"&&t&&t.length>0;if(this.role==="user")return p`<div class="bubble">${this.renderBubble(this.message.content)}${this.error?p`<div class="error"><doclens-icon name="alert-triangle"></doclens-icon> ${this.error}</div>`:null}</div><button class="reask" type="button" aria-label="重问" title="重问" @click=${this._emitReask}><doclens-icon name="rotate-ccw"></doclens-icon></button>`;const r=!!this.message.content;return p`
      <div class="bubble">
        ${e?p`<chat-tool-trace .steps=${t}></chat-tool-trace><div class="trace-sep"></div>`:null}
        ${this.renderBubble(this.message.content)}
        ${this.error?p`<div class="error"><doclens-icon name="alert-triangle"></doclens-icon> ${this.error}</div>`:null}
      </div>
      ${r?p`<button class="copy" type="button" aria-label=${this._copied?"已复制":"复制"} title=${this._copied?"已复制":"复制"} @click=${this._onCopy}><doclens-icon name=${this._copied?"check":"copy"}></doclens-icon></button>`:null}
    `}};ii.styles=U`
    :host {
      display: block;
      max-width: 78%;
    }
    :host([role="user"]) {
      align-self: flex-end;
      /* 气泡 + 重问钮 纵向堆叠并靠右对齐 */
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    :host([role="assistant"]) {
      align-self: flex-start;
      width: 100%;
      max-width: 100%;
      /* 气泡 + 复制钮 纵向堆叠并靠左对齐 */
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .bubble {
      padding: 10px 14px;
      border-radius: var(--cortex-radius-lg);
      font-size: var(--cortex-fs-md);
      line-height: 1.6;
      word-break: break-word;
      box-shadow: var(--cortex-shadow-sm);
    }
    /* 用户气泡：电蓝色底（--cortex-chat-bubble-user token） */
    :host([role="user"]) .bubble {
      display: flex;
      align-items: center;   /* 显式垂直居中：单行文字/匿名文本节点居中显示 */
      background: var(--cortex-chat-bubble-user);
      color: var(--cortex-chat-bubble-user-text);
      border: 1px solid var(--cortex-chat-bubble-user-border);
      border-bottom-right-radius: 6px;
      /* 用户输入按纯文本展示：保留换行、不解析 markdown */
      white-space: pre-wrap;
      /* user 气泡收紧：单行纯文本不需要 .bubble 通用的 10px 内边距与 1.6 行高，
         否则短消息气泡偏高（≈44px → ≈35px）。AI 气泡保留宽松值以适配多行 markdown。 */
      padding: 7px 12px;
      line-height: 1.4;
    }
    /* 用户气泡下方的小时间戳（17:08 风格） */
    .ts {
      display: block;
      text-align: right;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 4px;
      padding-right: 4px;
    }
    /* AI 气泡：白底 + 极浅边框（更轻盈）。多子元素（trace / md / error）
       仍用普通文档流堆叠。 */
    :host([role="assistant"]) .bubble {
      background: var(--cortex-chat-bubble-ai);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-chat-bubble-ai-border);
      border-bottom-left-radius: 6px;
      width: 100%;
      box-sizing: border-box;  /* outer 宽度计入 padding+border，不溢出 host */
    }
    /* assistant 回复的 markdown 渲染（紧凑气泡风格） */
    .md-body > :first-child { margin-top: 0; }
    .md-body > :last-child { margin-bottom: 0; }
    .md-body p { margin: 0.5em 0; }
    /* 结构化日程里的 section header：示例里是「?【周立松总经理】（今天）日程安排」
       这种带 ? 前缀的 H2 行内突出渲染为蓝色块标题 */
    .md-body h1, .md-body h2, .md-body h3, .md-body h4 {
      margin: 0.7em 0 0.4em;
      line-height: 1.4;
      color: var(--cortex-chat-section);
      font-weight: 600;
    }
    .md-body h1 { font-size: 1.05em; }
    .md-body h2 { font-size: 1em; }
    .md-body h3 { font-size: 0.95em; }
    .md-body h4 { font-size: 0.92em; }
    /* H2 内若以 ? 开头，去掉 ? 显示 + 让整行更醒目（贴近示例效果） */
    .md-body h2::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 1em;
      background: var(--cortex-chat-section);
      border-radius: 2px;
      margin-right: 8px;
      vertical-align: -2px;
    }
    .md-body ul, .md-body ol { margin: 0.4em 0; padding-left: 1.4em; }
    .md-body li { margin: 0.2em 0; }
    /* 结构化日程的"时间 + 描述"行：示例里是 09:00 日常工作 / 14:00 ... */
    .md-body li:has(> code),
    .md-body p > code:first-child {
      font-family: var(--cortex-font-mono);
    }
    .md-body pre {
      background: var(--cortex-surface-muted);
      padding: 8px 10px;
      border-radius: var(--cortex-radius-md);
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      margin: 0.5em 0;
      border: 1px solid var(--cortex-border-muted);
    }
    .md-body code {
      font-family: var(--cortex-font-mono);
      font-size: 0.92em;
      color: var(--cortex-chat-section);
      background: var(--cortex-surface-muted);
      padding: 1px 6px;
      border-radius: var(--cortex-radius-sm);
    }
    .md-body :not(pre) > code {
      background: var(--cortex-surface-muted);
      padding: 0 3px;
      border-radius: var(--cortex-radius-sm);
    }
    .md-body blockquote {
      border-left: 3px solid var(--cortex-primary);
      padding-left: 12px;
      margin: 0.5em 0;
      color: var(--cortex-text-muted);
      background: var(--cortex-primary-soft);
      border-radius: 0 6px 6px 0;
      padding-top: 6px;
      padding-bottom: 6px;
    }
    .md-body table {
      border-collapse: collapse;
      margin: 0.5em 0;
      font-size: var(--cortex-fs-sm);
      display: block;
      overflow-x: auto;  /* 宽表横向滚动，避免撑破气泡 */
    }
    .md-body th, .md-body td {
      border: 1px solid var(--cortex-border);
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
    }
    .md-body th {
      background: var(--cortex-surface-muted);
      font-weight: 600;
    }
    /* 结构化引用卡片：path 来自检索工具结果（非 AI 正文），任意扩展名/格式都可点 */
    .references {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--cortex-border-muted);
    }
    .references-title {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-bottom: 4px;
    }
    .references ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ref-link {
      color: var(--cortex-primary);
      text-decoration: none;
      cursor: pointer;
      font-weight: 500;
      font-size: var(--cortex-fs-sm);
      border-radius: var(--cortex-radius-sm);
      word-break: break-all;
    }
    .md-body .ref-link:hover {
      background: var(--cortex-primary-soft);
      text-decoration: underline;
    }
    .thinking {
      color: var(--cortex-text-subtle);
      font-style: italic;
    }
    .trace-sep {
      border-top: 1px dashed var(--cortex-border);
      margin: 8px 0;
    }
    .error {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
    /* 消息操作钮（user 重问 / assistant 复制）：默认隐藏，hover/focus 消息时浮现（移动端常显） */
    .reask, .copy {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      margin-top: 2px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--cortex-radius-sm);
      color: var(--cortex-text-subtle);
      font-size: 13px;
      cursor: pointer;
      opacity: 0;
      transition: opacity var(--cortex-duration-fast), color var(--cortex-duration-fast),
        background var(--cortex-duration-fast);
    }
    :host(.hovered) .reask,
    :host(.hovered) .copy,
    :host(:focus-within) .reask,
    :host(:focus-within) .copy,
    .reask:focus,
    .copy:focus { opacity: 1; }
    .reask:hover, .copy:hover {
      color: var(--cortex-primary);
      background: var(--cortex-surface-muted);
    }
    /* AI 复制钮靠右（与 user 重问钮左右对称） */
    .copy { align-self: flex-end; }
  `;Ss([w({reflect:!0})],ii.prototype,"role",2);Ss([w({attribute:!1})],ii.prototype,"message",2);Ss([w()],ii.prototype,"error",2);Ss([w({attribute:!1})],ii.prototype,"modelName",2);Ss([$()],ii.prototype,"_copied",2);ii=Ss([Z("chat-message")],ii);var Rg=Object.defineProperty,Lg=Object.getOwnPropertyDescriptor,xa=(t,e,r,i)=>{for(var s=i>1?void 0:i?Lg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Rg(e,r,s),s};const Bg={search:"search",read_document:"file",grep:"search"},Ng={search:"正在搜索",read_document:"正在读取",grep:"正在检索"};function Fg(t){const e=[`思考过程（${t.length} 步）`];return t.forEach((r,i)=>{e.push(""),e.push(`[${i+1}] ${r.name}`),Object.keys(r.input).length&&(e.push("参数："),e.push(JSON.stringify(r.input,null,2))),r.output!=null&&r.output!==""?(e.push("结果："),e.push(r.output)):e.push("结果：（无输出）")}),e.join(`
`)}let Oi=class extends G{constructor(){super(...arguments),this.steps=[],this._expanded=!1,this._fullResultIds=new Set,this._copied=!1}willUpdate(t){if(t.has("steps")){const r=(t.get("steps")??[]).some(s=>s.status==="running"),i=this.steps.some(s=>s.status==="running");!r&&i?this._expanded=!0:r&&!i&&(this._expanded=!1)}}_toggle(){this._expanded=!this._expanded}_toggleResult(t){const e=new Set(this._fullResultIds);e.has(t)?e.delete(t):e.add(t),this._fullResultIds=e}async _onCopy(t){t.stopPropagation();const e=Fg(this.steps);try{await navigator.clipboard.writeText(e),this._copied=!0,setTimeout(()=>{this._copied=!1},2e3)}catch{try{const i=document.createElement("textarea");i.value=e,i.style.position="fixed",i.style.opacity="0",document.body.appendChild(i),i.select(),document.execCommand("copy"),document.body.removeChild(i),this._copied=!0,setTimeout(()=>{this._copied=!1},2e3)}catch(i){console.warn("copy failed:",i)}}}_renderArgs(t){return Object.entries(t).map(([e,r])=>`${e}: ${typeof r=="string"?r:JSON.stringify(r)}`).join(`
`)}_renderStep(t){const e=t.status==="running",r=t.status==="error",i=Bg[t.name]??"settings",s=this._fullResultIds.has(t.tool_use_id),a=(t.output??"").split(`
`),o=!s&&a.length>5,l=o?a.slice(0,5).join(`
`):t.output??"",c=t.output!=null&&t.output!=="";return p`
      <div class="step ${e?"running":""} ${r?"error":""}">
        <div class="head">
          ${e?p`<span class="spin"></span>`:p`<doclens-icon name=${i}></doclens-icon>`}
          <span class="name">${t.name}</span>
          ${e?p`<span class="running-text">${Ng[t.name]??"正在调用"}...</span>`:null}
          <span class="meta">
            ${e?null:r?p`<doclens-icon class="err" name="x"></doclens-icon>`:p`<doclens-icon class="ok" name="check"></doclens-icon>`}
            ${t.duration_ms!=null?p` ${Math.round(t.duration_ms)}ms`:null}
          </span>
        </div>
        ${Object.keys(t.input).length?p`<div class="arg">${this._renderArgs(t.input)}</div>`:null}
        ${c?p`<div class="res">${l}${o?p`<span class="more" @click=${()=>this._toggleResult(t.tool_use_id)}>展开全部 (${a.length} 行) ⌄</span>`:null}</div>`:e?null:p`<div class="arg">（无输出）</div>`}
      </div>
    `}render(){if(!this.steps.length)return null;const t=this.steps.some(e=>e.status==="running");return p`
      <div class="summary" @click=${this._toggle}>
        <doclens-icon class="arrow" name=${this._expanded?"chevron-down":"chevron-right"}></doclens-icon>
        <doclens-icon name="sparkles"></doclens-icon> 思考过程 · <span class="count">${this.steps.length} 步</span>
        ${t?" · 进行中":""}
        <button class="copy-btn ${this._copied?"copied":""}" @click=${this._onCopy} title=${this._copied?"已复制":"复制全文"}>${this._copied?p`<doclens-icon name="check"></doclens-icon> 已复制`:p`<doclens-icon name="copy"></doclens-icon>`}</button>
      </div>
      ${this._expanded?p`<div class="steps">${this.steps.map(e=>this._renderStep(e))}</div>`:null}
    `}};Oi.styles=U`
    :host {
      display: block;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface-muted);
      overflow: hidden;
    }
    .summary {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted);
      cursor: pointer; user-select: none;
      padding: var(--cortex-space-2) var(--cortex-space-3);
    }
    .summary:hover { background: var(--cortex-surface); }
    .summary .arrow { color: var(--cortex-primary); font-weight: 700; }
    .summary .count { color: var(--cortex-text); font-weight: 600; }
    .steps { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .step {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 7px 9px;
    }
    .step.running { border-color: var(--cortex-primary); background: var(--cortex-primary-soft); }
    .step.error { border-color: var(--cortex-danger); }
    .head { display: flex; align-items: center; gap: 7px; font-size: var(--cortex-fs-sm); color: var(--cortex-text); }
    .head .name { font-weight: 600; font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); }
    .head .meta { margin-left: auto; color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); }
    .head .ok { color: var(--cortex-success); }
    .head .err { color: var(--cortex-danger); }
    .arg {
      color: var(--cortex-text-muted); margin-top: 3px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      white-space: pre-wrap; word-break: break-word;
    }
    .res {
      margin-top: 5px; background: var(--cortex-surface);
      border-radius: var(--cortex-radius-sm); padding: 5px 7px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: pre-wrap; word-break: break-word;
      max-height: 96px; overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .res::-webkit-scrollbar {
      display: none;
    }
    .res .more { color: var(--cortex-primary); cursor: pointer; display: inline-block; margin-top: 3px; }
    .spin {
      width: 12px; height: 12px;
      border: 2px solid var(--cortex-primary);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin .8s infinite linear;
      display: inline-block;
    }
    .running-text { color: var(--cortex-primary); font-size: var(--cortex-fs-xs); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    .copy-btn {
      margin-left: auto;
      /* 背景融入 .summary 容器（transparent + 无边框），仅 hover/已复制 给轻反馈 */
      background: transparent;
      border: none;
      border-radius: var(--cortex-radius-sm);
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font);
      line-height: 1.2;
    }
    .copy-btn:hover { background: var(--cortex-surface); color: var(--cortex-primary); }
    .copy-btn.copied { color: var(--cortex-success); }
  `;xa([w({attribute:!1})],Oi.prototype,"steps",2);xa([$()],Oi.prototype,"_expanded",2);xa([$()],Oi.prototype,"_fullResultIds",2);xa([$()],Oi.prototype,"_copied",2);Oi=xa([Z("chat-tool-trace")],Oi);var Hg=Object.defineProperty,qg=Object.getOwnPropertyDescriptor,hc=(t,e,r,i)=>{for(var s=i>1?void 0:i?qg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Hg(e,r,s),s};let ca=class extends G{constructor(){super(...arguments),this.messages=[],this.modelName=null,this._scrollRafPending=!1}updated(){this._scrollRafPending||(this._scrollRafPending=!0,requestAnimationFrame(()=>{this._scrollRafPending=!1,this.scrollTop=this.scrollHeight}))}render(){return this.messages.length===0?p`<div class="empty">开始与 Doclens 对话</div>`:p`
      ${this.messages.map(t=>p`<chat-message role=${t.role} .message=${t} .modelName=${this.modelName}></chat-message>`)}
    `}};ca.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      flex: 1;
      padding: var(--cortex-space-4);
      overflow-y: auto;
      background: var(--cortex-view-bg);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      align-self: center;
      margin: auto;
    }
  `;hc([w({attribute:!1})],ca.prototype,"messages",2);hc([w({attribute:!1})],ca.prototype,"modelName",2);ca=hc([Z("chat-stream")],ca);async function gd(t){return pe("/api/search",{method:"POST",json:t})}async function xd(t){return pe("/api/grep",{method:"POST",json:t})}async function Ug(t){return pe("/api/sessions",{method:"POST",json:t})}async function jg(t){return pe("/api/sessions/find-or-create",{method:"POST",json:t})}async function vh(t){const e=new URLSearchParams;return t.type&&e.set("type",t.type),t.limit&&e.set("limit",String(t.limit)),t.offset&&e.set("offset",String(t.offset)),pe(`/api/sessions?${e}`,{method:"GET"})}async function yd(t,e,r){return pe(`/api/sessions/${t}`,{method:"PATCH",json:{items:e,message_count:r}})}async function bh(t){const e=new URLSearchParams;return t&&e.set("type",t),pe(`/api/sessions?${e}`,{method:"DELETE"})}var Wg=Object.defineProperty,Vg=Object.getOwnPropertyDescriptor,ya=(t,e,r,i)=>{for(var s=i>1?void 0:i?Vg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Wg(e,r,s),s};let Ii=class extends G{constructor(){super(...arguments),this.total=0,this.offset=0,this.limit=20,this.disabled=!1}get currentPage(){return this.limit<=0?1:Math.floor(this.offset/this.limit)+1}get totalPages(){return this.limit<=0?1:Math.max(1,Math.ceil(this.total/this.limit))}_emitPage(t){this.disabled||t<1||t>this.totalPages||this.dispatchEvent(new CustomEvent("page-change",{detail:{page:t}}))}_pageSlots(){const t=this.totalPages,e=this.currentPage;if(t<=7)return Array.from({length:t},(a,o)=>o+1);const r=[1],i=Math.max(2,e-1),s=Math.min(t-1,e+1);i>2&&r.push("...");for(let a=i;a<=s;a++)r.push(a);return s<t-1&&r.push("..."),r.push(t),r}render(){if(this.total<=this.limit)return p``;const t=this._pageSlots();return p`
      <div class="meta">
        共 ${this.total} 条 · 第 ${this.currentPage}/${this.totalPages} 页
      </div>
      <div class="pages">
        <button
          ?disabled=${this.disabled||this.currentPage===1}
          @click=${()=>this._emitPage(this.currentPage-1)}
          aria-label="上一页">‹</button>
        ${t.map(e=>e==="..."?p`<span class="ellipsis">…</span>`:p`<button
                class=${e===this.currentPage?"current":""}
                ?disabled=${this.disabled}
                @click=${()=>this._emitPage(e)}>${e}</button>`)}
        <button
          ?disabled=${this.disabled||this.currentPage===this.totalPages}
          @click=${()=>this._emitPage(this.currentPage+1)}
          aria-label="下一页">›</button>
      </div>
    `}};Ii.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--cortex-border);
      background: var(--cortex-card-bg);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
    }
    .meta {
      color: var(--cortex-text-muted);
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
    }
    .pages {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-subtle);
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    button.current {
      background: var(--cortex-primary);
      color: #fff;
      border-color: var(--cortex-primary);
    }
    .ellipsis {
      padding: 0 4px;
      color: var(--cortex-text-subtle);
    }
  `;ya([w({type:Number})],Ii.prototype,"total",2);ya([w({type:Number})],Ii.prototype,"offset",2);ya([w({type:Number})],Ii.prototype,"limit",2);ya([w({type:Boolean})],Ii.prototype,"disabled",2);Ii=ya([Z("pagination-bar")],Ii);var Gg=Object.defineProperty,Xg=Object.getOwnPropertyDescriptor,ni=(t,e,r,i)=>{for(var s=i>1?void 0:i?Xg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Gg(e,r,s),s};const wd=new Map;let ar=class extends G{constructor(){super(...arguments),this.pstPath="",this.showBack=!1,this._emails=[],this._total=0,this._offset=0,this._loading=!1,this._error=null,this._limit=50,this._onPageChange=t=>{this._offset=(t.detail.page-1)*this._limit,wd.set(this.pstPath,this._offset),this._load()},this._onBackClick=()=>{this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}}willUpdate(t){t.has("pstPath")&&(this._offset=wd.get(this.pstPath)??0,this._load())}async _load(){if(!this.pstPath)return;this._loading=!0,this._error=null;const t=await Mg(this.pstPath,this._offset,this._limit);t.ok&&t.path!==this.pstPath||(t.ok?(this._emails=t.emails,this._total=t.total):(this._emails=[],this._total=0,this._error=t.notIndexed?"该 PST 尚未索引，请先执行 doclens index。":t.message||"加载失败"),this._loading=!1)}_onRowClick(t){this.dispatchEvent(new CustomEvent("open-email",{detail:{path:`${this.pstPath}#${t.entry_id}`},bubbles:!0,composed:!0}))}_basename(t){const e=t.lastIndexOf("/");return e>=0?t.slice(e+1):t}render(){return this._loading&&this._emails.length===0?p`<div class="state">加载中...</div>`:this._error?p`<div class="state error">${this._error}</div>`:p`
      <div class="header">
        ${this.showBack?p`<button class="back-btn" @click=${this._onBackClick}><doclens-icon name="arrow-left"></doclens-icon>返回</button>`:null}
        <span class="name" title=${this.pstPath}>${this._basename(this.pstPath)}</span>
        <span class="meta">共 ${this._total} 封邮件</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-subject">主题</th>
              <th class="col-sender">发件人</th>
              <th class="col-date">日期</th>
              <th class="col-folder">文件夹</th>
            </tr>
          </thead>
          <tbody>
            ${this._emails.map(t=>p`
                <tr @click=${()=>this._onRowClick(t)}>
                  <td class="col-subject" title=${t.subject}>${t.subject}</td>
                  <td class="col-sender" title=${t.sender}>${t.sender}</td>
                  <td class="col-date" title=${t.date}>${t.date}</td>
                  <td class="col-folder" title=${t.folder}>${t.folder}</td>
                </tr>
              `)}
          </tbody>
        </table>
      </div>
      <pagination-bar
        .total=${this._total}
        .offset=${this._offset}
        .limit=${this._limit}
        ?disabled=${this._loading}
        @page-change=${this._onPageChange}>
      </pagination-bar>
    `}};ar.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: baseline;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .header .name {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header .meta {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: nowrap;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .back-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    .table-wrap {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
    }
    thead th {
      position: sticky;
      top: 0;
      background: var(--cortex-card-bg);
      text-align: left;
      font-weight: 500;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      white-space: nowrap;
    }
    tbody td {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 0;
    }
    tbody tr {
      cursor: pointer;
      transition: background 0.12s;
    }
    tbody tr:hover {
      background: var(--cortex-surface-muted);
    }
    /* 列宽：主题弹性，其余按内容收缩 */
    .col-subject { width: 45%; }
    .col-sender { width: 25%; }
    .col-date { width: 17%; }
    .col-folder { width: 13%; }
    td.col-date, td.col-folder {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
    }
    .state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      padding: var(--cortex-space-4);
      text-align: center;
    }
    .state.error {
      color: var(--cortex-text-muted);
    }
    pagination-bar {
      flex-shrink: 0;
    }
  `;ni([w()],ar.prototype,"pstPath",2);ni([w({type:Boolean})],ar.prototype,"showBack",2);ni([$()],ar.prototype,"_emails",2);ni([$()],ar.prototype,"_total",2);ni([$()],ar.prototype,"_offset",2);ni([$()],ar.prototype,"_loading",2);ni([$()],ar.prototype,"_error",2);ar=ni([Z("pst-email-list")],ar);var Kg=Object.defineProperty,Yg=Object.getOwnPropertyDescriptor,gh=(t,e,r,i)=>{for(var s=i>1?void 0:i?Yg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Kg(e,r,s),s};let yo=class extends G{constructor(){super(...arguments),this._toasts=[],this._nextId=1,this._timers=new Map}pushToast(t,e="info",r=2500){const i=this._nextId++;if(this._toasts=[...this._toasts,{id:i,message:t,level:e,duration:r}],r>0){const s=window.setTimeout(()=>this.dismiss(i),r);this._timers.set(i,s)}}dismiss(t){const e=this._timers.get(t);e!==void 0&&(window.clearTimeout(e),this._timers.delete(t)),this._toasts=this._toasts.filter(r=>r.id!==t)}disconnectedCallback(){super.disconnectedCallback();for(const t of this._timers.values())window.clearTimeout(t);this._timers.clear()}render(){return p`
      ${this._toasts.map(t=>p`
          <div class="toast ${t.level}" @click=${()=>this.dismiss(t.id)}>
            <span class="msg">${t.message}</span>
          </div>
        `)}
    `}};yo.styles=U`
    :host {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      min-width: 200px;
      max-width: 360px;
      padding: 10px 14px;
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      box-shadow: var(--cortex-shadow-lg);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .toast.success { border-left: 3px solid var(--cortex-success); }
    .toast.error { border-left: 3px solid var(--cortex-danger); }
    .toast.info { border-left: 3px solid var(--cortex-primary); }
    .toast .msg { flex: 1; color: var(--cortex-text-muted); }
  `;gh([$()],yo.prototype,"_toasts",2);yo=gh([Z("toast-stack")],yo);var Zg=Object.defineProperty,Jg=Object.getOwnPropertyDescriptor,Qe=(t,e,r,i)=>{for(var s=i>1?void 0:i?Jg(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Zg(e,r,s),s};let ce=class extends G{constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewLine=null,this.historySessions=[],this._clearing=!1,this.previewError=null,this.previewDirty=!1,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null,this._resultsPaneWidth=ce.RESULTS_PANE_WIDTH_DEFAULT,this.searchMode="keyword",this._onModeChange=t=>{this.searchMode=t.detail.mode,localStorage.setItem(ce.SEARCH_MODE_KEY,t.detail.mode)},this._onSplitterMouseDown=t=>{t.preventDefault();const e=t.clientX,r=this._resultsPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=a=>{const o=a.clientX-e,l=Math.max(ce.RESULTS_PANE_WIDTH_MIN,Math.min(ce.RESULTS_PANE_WIDTH_MAX,r+o));l!==this._resultsPaneWidth&&(this._resultsPaneWidth=l)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(ce.RESULTS_PANE_WIDTH_KEY,String(this._resultsPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPageChange=t=>{this._goToPage(t.detail.page)},this._onPreviewDirty=t=>{this.previewDirty=t.detail.dirty},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=t=>{this._pushToast(`保存失败：${t.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=t=>{this.previewDirty=!1,this._pushToast(`已覆盖：${t.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=t=>{this._pushToast(`上传失败：${t.detail.message}`,"error",5e3)},this._onOpenPstEmail=async t=>{await this._safeAction(async()=>{const e={path:t.detail.path,snippet:"",score:0,line:null,highlights:[]};C.pushDetail(e),await this._fetchAndShowPreview(e)})},this._onBackToPstList=async()=>{Di(this.previewPath)&&await this._safeAction(async()=>{C.popDetail(),await this._fetchAndShowPreview({path:this.previewPath.split("#")[0],snippet:"",score:0,line:null,highlights:[]})})}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=T.subscribe(()=>this.requestUpdate()),this._loadResultsPaneWidth(),this._loadSearchMode();const t=T.getState().pendingSession;t&&t.type==="search"&&(C.setPendingSession(null),this._loadSession(t))}_loadResultsPaneWidth(){const t=localStorage.getItem(ce.RESULTS_PANE_WIDTH_KEY);if(!t)return;const e=Number(t);Number.isNaN(e)||(this._resultsPaneWidth=Math.max(ce.RESULTS_PANE_WIDTH_MIN,Math.min(ce.RESULTS_PANE_WIDTH_MAX,e)))}_loadSearchMode(){const t=localStorage.getItem(ce.SEARCH_MODE_KEY);(t==="keyword"||t==="grep")&&(this.searchMode=t)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._unsubscribe)==null||t.call(this)}async _loadHistory(){try{const{sessions:t}=await vh({type:"search",limit:20});this.historySessions=t}catch(t){console.warn("load history failed",t)}}async _onClearHistory(){await this._safeAction(async()=>{this._clearing=!0,this.requestUpdate();try{await bh("search"),this.historySessions=[]}catch(t){console.warn("clear sessions failed",t)}finally{this._clearing=!1,this.requestUpdate()}})}get viewState(){return T.getState().search}async _submit(t){await this._safeAction(async()=>{const e=typeof t=="string"?t:t.detail.value;this.localQuery=e,T.setState({detailStack:[]}),this.previewContent="",this.previewPath="",this.previewError=null,this.previewPages=null,this.previewAttachments=null,C.setSearchState({state:"focus",query:e,queryWords:[],results:[],total:0,offset:0,limit:20,source:"fts"}),this.loading=!0;try{const r=this.searchMode==="grep"?await xd({pattern:e,offset:0,limit:20}):await gd({query:e,offset:0,limit:20});C.setSearchState({state:"focus",query:e,queryWords:r.query_words??[],results:r.results,total:r.total,offset:0,limit:20,source:r.source}),this._autoPreviewFirstDesktop(r.results),jg({type:"search",title:e,preview:e.slice(0,100),mode:this.searchMode==="grep"?"grep":"keyword"}).then(i=>{C.setSearchState({currentSession:{id:i.id,type:"search",title:e,preview:e.slice(0,100),updated_at:new Date().toISOString(),message_count:0}}),this._loadHistory()}).catch(i=>{console.warn("find-or-create session failed",i)})}catch(r){C.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}})}async _backToInitial(){await this._safeAction(()=>{C.setSearchState({state:"initial",currentSession:null,results:[],query:"",queryWords:[]}),this.localQuery="",this._loadHistory()})}async _goToPage(t){const e=T.getState().search;if(!e.query||e.state!=="focus")return;const r=e.limit||20,i=Math.max(0,(t-1)*r);if(i!==e.offset){this.loading=!0;try{const s=this.searchMode==="grep"?await xd({pattern:e.query,offset:i,limit:r}):await gd({query:e.query,offset:i,limit:r});C.setSearchState({state:"focus",query:e.query,results:s.results,total:s.total,offset:s.offset,limit:r,source:s.source}),this.previewContent="",this.previewPath="",this.previewLine=null}catch(s){C.setError(`翻页失败: ${s.message}`)}finally{this.loading=!1}}}async _onResultSelect(t){await this._safeAction(async()=>{const e=t.detail.result;C.pushDetail(e),await this._fetchAndShowPreview(e)})}async _fetchAndShowPreview(t){if(this.previewError=null,Zr(t.path)){this.previewContent="",this.previewPath=t.path,this.previewLanguage="text",this.previewLine=null,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null;return}const e=t.line??null,r=Eg(t.path);let i;e&&!r?i=await this._fetchPreviewRange(t.path,e):i=await ps(t.path),i.ok?(this.previewContent=i.content,this.previewPath=i.path,this.previewLanguage=i.language,this.previewLine=e===null?null:i.lineMap?i.lineMap[String(e)]??null:e,this.previewWritable=i.writable,this.previewPages=i.pages,this.previewAttachments=i.attachments):i.notIndexed&&(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=t.path,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null)}async _fetchPreviewRange(t,e){const r=new URLSearchParams({path:t});r.set("start_line",String(Math.max(1,e-10))),r.set("end_line",String(e+20));try{const i=await fetch(`/api/preview?${r}`);if(i.ok){const a=await i.json();return{ok:!0,path:a.path,content:a.content,language:a.language,writable:a.writable??!1,pages:a.pages??null,lineMap:null,attachments:null}}return{ok:!1,notIndexed:(await i.json().catch(()=>({}))).code==="NOT_INDEXED"}}catch{return{ok:!1,notIndexed:!1}}}_autoPreviewFirstDesktop(t){typeof window>"u"||window.innerWidth<1024||t.length!==0&&this._fetchAndShowPreview(t[0])}_discardPreviewEdits(){var e,r;const t=(e=this.shadowRoot)==null?void 0:e.querySelector("preview-pane");(r=t==null?void 0:t.discard)==null||r.call(t),this.previewDirty=!1}_enterPreviewEdit(){var e,r;const t=(e=this.shadowRoot)==null?void 0:e.querySelector(".detail-overlay preview-pane");(r=t==null?void 0:t.enterEdit)==null||r.call(t)}async _safeAction(t){if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await t()}async _reloadPreview(){if(!this.previewPath)return;const t=await ps(this.previewPath);t.ok&&(this.previewContent=t.content,this.previewLanguage=t.language,this.previewWritable=t.writable,this.previewPages=t.pages,this.previewAttachments=t.attachments)}_pushToast(t,e,r){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(t,e,r)}_popDetail(){C.popDetail()}_renderNotIndexedHint(t){return p`<div class=${t?"desktop-only not-indexed-hint":"not-indexed-hint"}>
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}async _loadSession(t){this.searchMode=t.mode==="grep"?"grep":"keyword",localStorage.setItem(ce.SEARCH_MODE_KEY,this.searchMode),await this._submit(t.title)}_onHistorySelect(t){this._loadSession(t.detail.session)}render(){var i;const t=this.viewState;if(t.state==="initial")return p`
        <div class="initial-stack">
          <welcome-pane
            variant="onboarding"
            heroicon="search"
            heading="在你的文档中搜索"
            subheading="对当前工作目录{workdir} 的所有文件进行全文检索"
            .modes=${[{label:"自然语言",icon:"sparkles"},{label:"正则",icon:"regex"}]}
            .examples=${["「人工智能发展」","「量子 计算」","「tcp.*timeout」","「Python 装饰器」"]}
            .workdir=${((i=T.getState().status)==null?void 0:i.workdir)??""}
          ></welcome-pane>
          <history-list
            title="历史搜索"
            type="search"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder=${this.searchMode==="grep"?"输入正则表达式...":"输入搜索关键词..."}
              button-label="搜索"
              button-icon="search"
              .mode=${this.searchMode}
              .modes=${ce.SEARCH_MODES}
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${s=>this.localQuery=s.detail.value}
              @mode-change=${this._onModeChange}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const e=T.getState().detailStack[T.getState().detailStack.length-1],r=this.loading?"搜索中":`${t.total} 条结果${t.source==="fts"?"":` (${t.source.toUpperCase()})`}`;return p`
      <toast-stack></toast-stack>
      <div class="focus-body ${e?"is-covered":""}">
        <focus-header
          back-label="新搜索"
          title=${t.query}
          meta=${r}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main" style="--results-pane-width: ${this._resultsPaneWidth}px">
          <div class="results-col">
            <search-results
              .results=${t.results}
              ?loading=${this.loading}
              .activeResult=${e??null}
              @select=${this._onResultSelect}>
            </search-results>
            ${t.total>t.limit?p`<pagination-bar
                  .total=${t.total}
                  .offset=${t.offset}
                  .limit=${t.limit}
                  ?disabled=${this.loading}
                  @page-change=${this._onPageChange}>
                </pagination-bar>`:null}
          </div>
          <div class="splitter"
               role="separator"
               aria-orientation="vertical"
               aria-label="调整搜索结果栏宽度"
               @mousedown=${this._onSplitterMouseDown}></div>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!0):Zr(this.previewPath)?p`<pst-email-list
                  class="desktop-only"
                  .pstPath=${this.previewPath}
                  @open-email=${this._onOpenPstEmail}>
                </pst-email-list>`:p`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${t.queryWords.length?t.queryWords.join(" "):t.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                .attachments=${this.previewAttachments}
                ?showBack=${Di(this.previewPath)}
                backLabel="邮件列表"
                @back=${this._onBackToPstList}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>
      </div>
      ${e?p`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${e.path}
            .actions=${this.previewWritable?[{label:"编辑",icon:"pencil",onClick:()=>this._enterPreviewEdit()}]:[]}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!1):Zr(this.previewPath)?p`<pst-email-list
                  .pstPath=${this.previewPath}
                  @open-email=${this._onOpenPstEmail}>
                </pst-email-list>`:p`<preview-pane
                ?noHeader=${!0}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${t.queryWords.length?t.queryWords.join(" "):t.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                .attachments=${this.previewAttachments}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>`:null}
    `}};ce.RESULTS_PANE_WIDTH_KEY="cortex.resultsPaneWidth";ce.RESULTS_PANE_WIDTH_DEFAULT=360;ce.RESULTS_PANE_WIDTH_MIN=280;ce.RESULTS_PANE_WIDTH_MAX=800;ce.SEARCH_MODE_KEY="cortex.searchMode";ce.SEARCH_MODES={keyword:{label:"搜索",description:"拆分关键词匹配"},grep:{label:"grep",description:"正则表达式匹配"}};ce.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-view-bg);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      /* 顶部蓝色光晕：让白色卡片从 view-bg 中浮出 */
      background: radial-gradient(720px 280px at 50% -80px, rgba(0, 100, 224, 0.08), transparent 70%);
    }
    .input-row {
      padding: var(--cortex-space-4) var(--cortex-space-6);
      flex-shrink: 0;
      background: transparent;
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    /* Mobile only (<1024px): when the detail-overlay covers focus-body,
       disable pointer events on focus-body so its (visually-hidden)
       focus-header can't intercept taps. On desktop, detail-overlay is
       display:none, so focus-body is NOT covered and must stay interactive. */
    @media (max-width: 1023px) {
      .focus-body.is-covered { pointer-events: none; }
    }
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
      /* 四周留白：避免结果/预览/分页紧贴 focus-header 下沿和视口边缘 */
      padding: var(--cortex-space-3);
    }
    /* 结果列：search-results + pagination-bar 垂直堆叠，宽度跟随 --results-pane-width */
    .results-col {
      display: flex;
      flex-direction: column;
      flex: 0 0 var(--results-pane-width, 360px);
      min-width: 280px;
      max-width: 800px;
      min-height: 0;
      /* 结果列表与分页栏之间的呼吸空间 */
      gap: var(--cortex-space-2);
    }
    /* 让 search-results 在 .results-col 内填充剩余高度（覆盖其 :host 的 flex: 0 0 auto）。
       !important 是必要的，因为子组件 :host 的特异性 (0,1,0) 高于父级类型选择器 (0,0,1)。 */
    .results-col > search-results {
      flex: 1 1 0 !important;
      min-height: 0;
    }
    /* 移动端：结果列占满全宽，跟随 search-results 的响应式行为 */
    @media (max-width: 1023px) {
      .results-col {
        flex: 1;
        max-width: none;
        min-width: 0;
      }
    }
    .splitter {
      flex: 0 0 4px;
      cursor: col-resize;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
    }
    .splitter:hover, .splitter:active { background: var(--cortex-primary); }
    @media (max-width: 1023px) {
      .splitter { display: none; }
    }
    /* 移动端：详情整页推入覆盖 */
    .detail-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-card-bg);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-md);
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-6);
      text-align: center;
    }
    /* 移动端（<1024px）：隐藏桌面端独占的预览栏，预览由 detail-overlay 全屏覆盖 */
    @media (max-width: 1023px) {
      .desktop-only { display: none; }
    }
    @media (min-width: 1024px) {
      .detail-overlay { display: none; }
      /* 桌面端：初始内容居中，避免全宽拉伸的"手机浏览器"观感 */
      .initial-stack {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;Qe([$()],ce.prototype,"localQuery",2);Qe([$()],ce.prototype,"loading",2);Qe([$()],ce.prototype,"previewContent",2);Qe([$()],ce.prototype,"previewPath",2);Qe([$()],ce.prototype,"previewLanguage",2);Qe([$()],ce.prototype,"previewLine",2);Qe([$()],ce.prototype,"historySessions",2);Qe([$()],ce.prototype,"_clearing",2);Qe([$()],ce.prototype,"previewError",2);Qe([$()],ce.prototype,"previewDirty",2);Qe([$()],ce.prototype,"previewWritable",2);Qe([$()],ce.prototype,"previewPages",2);Qe([$()],ce.prototype,"previewAttachments",2);Qe([$()],ce.prototype,"_resultsPaneWidth",2);Qe([$()],ce.prototype,"searchMode",2);ce=Qe([Z("search-view")],ce);async function*Qg(t,e){for await(const r of Bl("/api/chat",t,e))if(r.event==="token")try{yield{type:"token",text:JSON.parse(r.data).text}}catch{}else if(r.event==="tool_call")try{const i=JSON.parse(r.data);yield{type:"tool_call",tool_use_id:i.tool_use_id,name:i.name,input:i.input??{}}}catch{}else if(r.event==="tool_result")try{const i=JSON.parse(r.data);yield{type:"tool_result",tool_use_id:i.tool_use_id,name:i.name,output:i.output??"",is_error:!!i.is_error,duration_ms:i.duration_ms}}catch{}else if(r.event==="references")try{yield{type:"references",items:JSON.parse(r.data).items??[]}}catch{}else if(r.event==="toast")try{const i=JSON.parse(r.data);yield{type:"toast",level:i.level??"error",detail:String(i.detail??"")}}catch{}else if(r.event==="done")yield{type:"done"};else if(r.event==="error")try{yield{type:"error",detail:JSON.parse(r.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}async function e2(t){try{await pe("/api/chat/stop",{method:"POST",json:{session_id:t}})}catch{}}var t2=Object.defineProperty,r2=Object.getOwnPropertyDescriptor,pt=(t,e,r,i)=>{for(var s=i>1?void 0:i?r2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&t2(e,r,s),s};function _d(t,e){if(t.length===0)return t;const r=t[t.length-1];if(r.role!=="assistant")return t;const i=t.slice(0,-1);if(e.type==="token")return[...i,{...r,content:r.content+e.text}];if(e.type==="tool_call"){const s={tool_use_id:e.tool_use_id,name:e.name,input:e.input,status:"running"};return[...i,{...r,tool_steps:[...r.tool_steps??[],s]}]}if(e.type==="tool_result"){const s=(r.tool_steps??[]).map(a=>a.tool_use_id===e.tool_use_id?{...a,output:e.output,is_error:e.is_error,duration_ms:e.duration_ms,status:e.is_error?"error":"done"}:a);return[...i,{...r,tool_steps:s}]}return e.type==="references"?[...i,{...r,references:e.items}]:t}function i2(t){return t.some(r=>r.role==="assistant"&&(r.tool_steps??[]).some(i=>i.status==="running"))?t.map(r=>r.role!=="assistant"||!r.tool_steps?r:{...r,tool_steps:r.tool_steps.map(i=>i.status==="running"?{...i,status:"error",is_error:!0,output:i.output??"（已中断）"}:i)}):t}function s2(t){const e=[];for(const r of t){let i;try{i=JSON.parse(r.payload)}catch{continue}if(r.kind==="message_user")e.push({role:"user",content:i.content??""});else if(r.kind==="message_ai"){const s=(i.tool_calls??[]).map(l=>({tool_use_id:l.tool_use_id??"",name:l.name??"",input:l.input??{},output:l.output,is_error:l.is_error,duration_ms:l.duration_ms,status:l.is_error?"error":"done"})),a=(i.references??[]).map(l=>({path:String((l==null?void 0:l.path)??"")})).filter(l=>l.path.length>0),o={role:"assistant",content:i.content??""};s.length&&(o.tool_steps=s),a.length&&(o.references=a),e.push(o)}}return e}let ke=class extends G{constructor(){super(...arguments),this.draft="",this.historySessions=[],this._clearing=!1,this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewAttachments=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1,this._previewPaneWidth=ke.PREVIEW_PANE_WIDTH_DEFAULT,this._abortController=null,this._onSplitterMouseDown=t=>{t.preventDefault();const e=t.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=a=>{const o=Math.max(ke.PREVIEW_PANE_WIDTH_MIN,Math.min(ke.PREVIEW_PANE_WIDTH_MAX,r-(a.clientX-e)));o!==this._previewPaneWidth&&(this._previewPaneWidth=o)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(ke.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onOpenPstEmail=async t=>{await this._safeAction(async()=>{await this._openPreviewPath(t.detail.path)})},this._onPreviewDirty=t=>{this.previewDirty=t.detail.dirty},this._closePreview=async()=>{await this._safeAction(()=>{this.previewOpen=!1})},this._onPreviewBack=async()=>{if(Di(this.previewPath)){await this._safeAction(async()=>{await this._openPreviewPath(this.previewPath.split("#")[0])});return}await this._closePreview()},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=t=>{this._pushToast(`保存失败：${t.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=t=>{this.previewDirty=!1,this._pushToast(`已覆盖：${t.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=t=>{this._pushToast(`上传失败：${t.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=T.subscribe(()=>{this.requestUpdate(),this._consumePendingSkillChat()}),this._loadPreviewPaneWidth();const t=T.getState().pendingSession;t&&t.type==="chat"&&(C.setPendingSession(null),this._loadSession(t)),this._consumePendingSkillChat()}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._unsubscribe)==null||t.call(this)}async _loadHistory(){try{const{sessions:t}=await vh({type:"chat",limit:20});this.historySessions=t}catch(t){console.warn("load history failed",t)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await bh("chat"),this.historySessions=[]}catch(t){console.warn("clear sessions failed",t)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return T.getState().chat}async _submit(t){this._resetPreview();const e=t.detail.value;if(this.draft="",this.viewState.state==="initial"){await this._ensureSession(e,e),await this._sendMessage(e,!0);return}await this._sendMessage(e)}async _consumePendingSkillChat(){const t=T.getState().pendingSkillChat;t&&(C.setPendingSkillChat(null),this.viewState.state==="initial"&&(await this._ensureSession(t.title,t.message),await this._sendMessage(t.message,!0)))}async _ensureSession(t,e){const r=await Ug({type:"chat",title:t.slice(0,60),preview:e.slice(0,100)});C.setChatState({state:"focus",currentSession:{id:r.id,type:"chat",title:t.slice(0,60),preview:e.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:e}],streaming:!0})}async _sendMessage(t,e=!1){e?C.setChatState({streaming:!0}):C.setChatState({messages:[...this.viewState.messages,{role:"user",content:t}],streaming:!0});const r=T.getState().chat.currentSession.id,i={role:"assistant",content:""};let s=[...T.getState().chat.messages,i];C.setChatState({messages:s}),this._abortController=new AbortController;try{for await(const o of Qg({message:t,session_id:r},this._abortController.signal))o.type==="error"?(s=_d(s,{type:"token",text:`

⚠️ ${o.detail}`}),C.setChatState({messages:s})):o.type==="toast"?this._pushToast(o.detail,o.level,5e3):o.type!=="done"&&(s=_d(s,o),C.setChatState({messages:s}));const a=s[s.length-1];await yd(r,[{kind:"message_user",payload:JSON.stringify({content:t})},{kind:"message_ai",payload:JSON.stringify({content:a.content,tool_calls:a.tool_steps??[],references:a.references??[]})}],s.length),this._loadHistory()}catch(a){this._isAbortError(a)?(s=this._dropTrailingAssistant(s),C.setChatState({messages:s}),await yd(r,[{kind:"message_user",payload:JSON.stringify({content:t})}],s.length),this._loadHistory()):(s=i2(s),C.setChatState({messages:s}),C.setError(`对话失败: ${a.message}`))}finally{this._abortController=null,C.setChatState({streaming:!1})}}async _stop(){var e,r;const t=(e=T.getState().chat.currentSession)==null?void 0:e.id;(r=this._abortController)==null||r.abort(),t&&e2(t)}_isAbortError(t){return!!t&&t.name==="AbortError"}_dropTrailingAssistant(t){return t.length&&t[t.length-1].role==="assistant"?t.slice(0,-1):t}_backToInitial(){this._resetPreview(),C.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}_resetPreview(){this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewAttachments=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1}async _loadSession(t){this._resetPreview(),C.setChatState({state:"focus",currentSession:t,messages:[]});try{const e=await fetch(`/api/sessions/${t.id}`);if(e.ok){const r=await e.json(),i=s2(r.items||[]);C.setChatState({messages:i})}}catch(e){console.warn("load session failed",e)}}_onHistorySelect(t){this._loadSession(t.detail.session)}_loadPreviewPaneWidth(){const t=localStorage.getItem(ke.PREVIEW_PANE_WIDTH_KEY);if(!t)return;const e=Number(t);Number.isNaN(e)||(this._previewPaneWidth=Math.max(ke.PREVIEW_PANE_WIDTH_MIN,Math.min(ke.PREVIEW_PANE_WIDTH_MAX,e)))}get _previewKeyword(){const t=T.getState().chat.messages;for(let e=t.length-1;e>=0;e--)if(t[e].role==="user")return t[e].content;return""}_normalizeReferencePath(t){let e=(t??"").trim();if(!e)return"";const r=e.match(/^\[.*?\]\((.*?)\)$/);r&&(e=r[1].trim()),e=e.replace(/^file:\/\/\/?/i,"");try{e=decodeURIComponent(e)}catch{}return e}async _onReferenceClick(t){await this._safeAction(async()=>{const e=this._normalizeReferencePath(t.detail.path);if(!e){this._pushToast("参考路径为空","error",5e3);return}await this._openPreviewPath(e)})}_onReask(t){var r,i;const e=((r=t.detail)==null?void 0:r.content)??"";if(e&&(this.draft=e,this.requestUpdate(),!this.viewState.streaming)){const s=this.renderRoot.querySelector("input-box");(i=s==null?void 0:s.focus)==null||i.call(s)}}async _openPreviewPath(t){if(this.previewError=null,Zr(t)){this.previewContent="",this.previewPath=t,this.previewLanguage="text",this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null,this.previewOpen=!0;return}const e=await ps(t);e.ok?(this.previewContent=e.content,this.previewPath=e.path,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages,this.previewAttachments=e.attachments,this.previewOpen=!0):e.notIndexed?(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=t,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null,this.previewOpen=!0):this._pushToast(`预览失败：${e.message}`,"error",5e3)}async _safeAction(t){var e,r;if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;const s=(e=this.shadowRoot)==null?void 0:e.querySelector("preview-pane");(r=s==null?void 0:s.discard)==null||r.call(s),this.previewDirty=!1}await t()}async _reloadPreview(){if(!this.previewPath)return;const t=await ps(this.previewPath);t.ok&&(this.previewContent=t.content,this.previewLanguage=t.language,this.previewWritable=t.writable,this.previewPages=t.pages,this.previewAttachments=t.attachments)}_pushToast(t,e,r){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(t,e,r)}_renderNotIndexedHint(){return p`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}render(){var i,s,a;const t=this.viewState;if(t.state==="initial")return p`
        <div class="initial-stack">
          <welcome-pane
            variant="onboarding"
            heroicon="sparkles"
            heading="与你的知识库对话"
            subheading="用自然语言提问，AI 会自动检索当前工作目录{workdir} 的知识库并引用原文回答"
            .modes=${[{label:"自动检索",icon:"search"},{label:"引用原文",icon:"book-open"}]}
            .examples=${["总结上周写过的所有技术文档","找出所有提到 X 的段落并对比","这篇文章的核心观点是什么？"]}
            .workdir=${((i=T.getState().status)==null?void 0:i.workdir)??""}
          ></welcome-pane>
          <history-list
            title="历史会话"
            type="chat"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="问 Doclens 任何问题..."
              .buttonLabel=${"发送"}
              .buttonIcon=${"arrow-up"}
              .iconAfter=${!0}
              style="--cortex-input-btn-reserve: 96px"
              multiline
              .value=${this.draft}
              @input-change=${o=>this.draft=o.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const e=this.previewOpen,r=o=>Zr(this.previewPath)?p`<pst-email-list
          .pstPath=${this.previewPath}
          @open-email=${this._onOpenPstEmail}>
        </pst-email-list>`:p`<preview-pane
      ?noHeader=${o}
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .keyword=${this._previewKeyword}
      ?writable=${this.previewWritable}
      .pages=${this.previewPages}
      .attachments=${this.previewAttachments}
      ?showBack=${Di(this.previewPath)}
      backLabel="邮件列表"
      @back=${this._onPreviewBack}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}>
    </preview-pane>`;return p`
      <toast-stack></toast-stack>
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${((s=t.currentSession)==null?void 0:s.title)??""}
          meta=${`${t.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main ${e?"has-preview":""}"
             style="--preview-pane-width: ${this._previewPaneWidth}px">
          <chat-stream
            .messages=${t.messages}
            .modelName=${((a=T.getState().status)==null?void 0:a.model_name)??null}
            @reference-click=${this._onReferenceClick}
            @reask=${this._onReask}
            @copy-failed=${()=>this._pushToast("复制失败，请手动选择文本","error",5e3)}>
          </chat-stream>
          ${e?p`
            <div class="splitter desktop-only"
                 role="separator"
                 aria-orientation="vertical"
                 aria-label="调整预览栏宽度"
                 @mousedown=${this._onSplitterMouseDown}></div>
            <div class="preview-pane-wrap desktop-only">
              <button class="preview-close" type="button" aria-label="关闭预览"
                      @click=${this._closePreview}><doclens-icon name="x"></doclens-icon></button>
              ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint():r(!1)}
            </div>`:null}
        </div>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            .buttonLabel=${"发送"}
            .buttonIcon=${"arrow-up"}
            .iconAfter=${!0}
            style="--cortex-input-btn-reserve: 96px"
            multiline
            ?streaming=${t.streaming}
            .value=${this.draft}
            @input-change=${o=>this.draft=o.detail.value}
            @submit=${this._submit}
            @stop=${this._stop}>
          </input-box>
        </div>
      </div>
      ${e?p`
        <div class="preview-overlay">
          <focus-header
            back-label="返回"
            title=${this.previewPath}
            @back=${this._onPreviewBack}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint():r(!0)}
        </div>`:null}
    `}};ke.PREVIEW_PANE_WIDTH_KEY="cortex.chatPreviewWidth";ke.PREVIEW_PANE_WIDTH_DEFAULT=420;ke.PREVIEW_PANE_WIDTH_MIN=300;ke.PREVIEW_PANE_WIDTH_MAX=900;ke.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-view-bg);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      /* 顶部蓝色光晕：让白色卡片从背景中浮出，增加层次感 */
      background:
        radial-gradient(720px 280px at 50% -80px, rgba(0, 100, 224, 0.08), transparent 70%);
    }
    .input-row {
      padding: 6px var(--cortex-space-6) 18px;
      flex-shrink: 0;
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-bar {
      padding: var(--cortex-space-3) var(--cortex-space-6);
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
      background: var(--cortex-view-bg);
    }
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    /* 桌面 preview 关闭：chat-stream 居中（现状） */
    @media (min-width: 1024px) {
      .focus-main:not(.has-preview) chat-stream {
        max-width: 820px;
        margin: 0 auto;
        width: 100%;
      }
    }
    /* 桌面 preview 打开：水平排布，chat-stream 让位 */
    @media (min-width: 1024px) {
      .focus-main.has-preview {
        flex-direction: row;
        padding: var(--cortex-space-3);
      }
      .focus-main.has-preview chat-stream {
        flex: 1 1 0;
        min-width: 0;
        max-width: none;
      }
    }
    .focus-main .splitter {
      flex: 0 0 4px;
      cursor: col-resize;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
    }
    .focus-main .splitter:hover,
    .focus-main .splitter:active {
      background: var(--cortex-primary);
    }
    .focus-main .preview-pane-wrap {
      flex: 0 0 var(--preview-pane-width, 420px);
      min-width: 300px;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      position: relative;
      background: var(--cortex-card-bg);
      border-radius: var(--cortex-radius-lg);
      border: 1px solid var(--cortex-border-muted);
    }
    .focus-main .preview-close {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      width: 26px;
      height: 26px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .focus-main .preview-close:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .focus-main .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-md);
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-6);
      margin: var(--cortex-space-3);
      text-align: center;
    }
    /* 移动端：桌面 splitter / preview-pane-wrap 隐藏 */
    @media (max-width: 1023px) {
      .focus-main .splitter,
      .focus-main .preview-pane-wrap,
      .focus-main .desktop-only {
        display: none;
      }
    }
    /* 移动端预览 overlay */
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-card-bg);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    @media (min-width: 1024px) {
      .preview-overlay {
        display: none;
      }
    }
    @media (min-width: 1024px) {
      /* 桌面端：居中列布局，避免全宽拉伸 */
      .initial-stack {
        max-width: 760px;
        margin: 0 auto;
        width: 100%;
      }
      .input-bar {
        max-width: 820px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;pt([$()],ke.prototype,"draft",2);pt([$()],ke.prototype,"historySessions",2);pt([$()],ke.prototype,"_clearing",2);pt([$()],ke.prototype,"previewOpen",2);pt([$()],ke.prototype,"previewContent",2);pt([$()],ke.prototype,"previewPath",2);pt([$()],ke.prototype,"previewLanguage",2);pt([$()],ke.prototype,"previewPages",2);pt([$()],ke.prototype,"previewAttachments",2);pt([$()],ke.prototype,"previewWritable",2);pt([$()],ke.prototype,"previewError",2);pt([$()],ke.prototype,"previewDirty",2);pt([$()],ke.prototype,"_previewPaneWidth",2);ke=pt([Z("chat-view")],ke);const a2={ai:"AI 配置",search:"搜索调优",network:"网络监听"},o2={CORTEX_WEB_HOST:"127.0.0.1",CORTEX_WEB_PORT:"7860",CORTEX_MCP_ENABLED:"false",CORTEX_MCP_HOST:"127.0.0.1",CORTEX_MCP_PORT:"7880",CORTEX_SYNC_ENABLED:"true"},Bn={CORTEX_WEB_HOST:"127.0.0.1",CORTEX_WEB_PORT:"7860",CORTEX_MCP_ENABLED:"false",CORTEX_MCP_HOST:"127.0.0.1",CORTEX_MCP_PORT:"7880"},n2=[{tab:"ai",section:"百度天气 API",envVar:"BAIDU_WEATHER_AK",label:"百度地图开放平台 AK",component:"password",hint:"供日记录入时抓取城市天气。需在百度地图开放平台申请；留空则日记不带天气（不影响其他功能）。保存后即时生效。"},{tab:"network",section:"监听地址",envVar:"CORTEX_WEB_HOST",label:"Web 监听地址",component:"text",effect:"restart",mono:!0,hint:"Web UI 绑定地址。0.0.0.0 暴露局域网（无鉴权，慎用）。改后需重启；若改了端口，重启后需用新地址重新打开。"},{tab:"network",section:"监听地址",envVar:"CORTEX_WEB_PORT",label:"Web 监听端口",component:"number",effect:"restart",min:1,max:65535,hint:"Web UI 端口（1–65535）。改后需重启，重启后用新端口重新打开。"},{tab:"network",section:"监听地址",envVar:"CORTEX_MCP_ENABLED",label:"启用 MCP server",component:"toggle",effect:"restart",hint:"关闭时不启动 MCP HTTP server（Claude Code 的 kb-ask 等经 MCP 接入的功能将不可用）。改后需重启。"},{tab:"network",section:"监听地址",envVar:"CORTEX_MCP_HOST",label:"MCP 监听地址",component:"text",effect:"restart",mono:!0,hint:"MCP server 绑定地址。非环回地址（如 0.0.0.0）需在 .env 配 CORTEX_MCP_TOKEN，否则 MCP 拒绝启动。"},{tab:"network",section:"监听地址",envVar:"CORTEX_MCP_PORT",label:"MCP 监听端口",component:"number",effect:"restart",min:1,max:65535,hint:"MCP server 端口（1–65535）。改后需重启。"},{tab:"network",section:"知识库 Git 同步",envVar:"CORTEX_SYNC_ENABLED",label:"启用 Git 同步",component:"switch",effect:"restart",hint:"工作目录为 git 根且已配置 remote 时，定期 auto-commit → pull → push。改后需重启。"}];class wo extends Error{constructor(e,r){super(`Config API error ${e}`),this.status=e,this.body=r}}async function l2(t){const e=await fetch(`/api/config?scope=${t}`,{method:"GET"}),r=await e.json().catch(()=>null);if(!e.ok)throw new wo(e.status,r);return r}async function c2(t,e){const r=await fetch(`/api/config?scope=${t}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:e})}),i=await r.json().catch(()=>null);if(!r.ok)throw new wo(r.status,i);return i}var d2=Object.defineProperty,u2=Object.getOwnPropertyDescriptor,pr=(t,e,r,i)=>{for(var s=i>1?void 0:i?u2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&d2(e,r,s),s};const Ws=6;let Ot=class extends G{constructor(){super(...arguments),this._hasPassword=null,this._required=!1,this._old="",this._next="",this._confirm="",this._clearPin="",this._error="",this._ok="",this._busy=!1}connectedCallback(){super.connectedCallback(),this._refresh(),this._observer=new IntersectionObserver(t=>{t.some(e=>e.isIntersecting)&&this._refresh()}),this._observer.observe(this)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._observer)==null||t.disconnect()}async _refresh(){try{const t=await tu();this._hasPassword=t.has_password,this._required=t.required,C.setAuthState({required:t.required,authenticated:t.authenticated,hasPassword:t.has_password})}catch{this._error="无法获取密码状态"}}_resetForms(){this._old="",this._next="",this._confirm="",this._clearPin=""}_valid(t){return new RegExp(`^[0-9]{${Ws}}$`).test(t)}async _run(t,e){if(!this._busy){this._busy=!0,this._error="",this._ok="";try{await t(),this._ok=e,this._resetForms(),await this._refresh()}catch(r){this._error=r instanceof Et?r.message:"操作失败，请重试"}finally{this._busy=!1}}}_submitSet(){if(!this._valid(this._next)){this._error="密码必须是 6 位数字";return}if(this._next!==this._confirm){this._error="两次输入的新密码不一致";return}const t=this._hasPassword===!0;if(t&&!this._old){this._error="请输入旧密码";return}this._run(()=>_1(t?this._old:null,this._next),t?"密码已修改，其他设备需重新登录":"密码已设置")}_submitClear(){if(!this._clearPin){this._error="请输入当前密码";return}this._run(()=>k1(this._clearPin),"密码已清除，访问不再需要登录")}async _logout(){try{await ru()}catch{}C.setAuthState({authenticated:!1}),Sr.navigate("login")}render(){if(this._hasPassword===null)return F;const t=this._hasPassword===!0;return p`
      <div class="section">
        <h2>
          🔒 访问密码
          ${t?p`<span class="badge">已设置</span>`:F}
        </h2>
        <p class="hint">
          仅当 GUI 绑定非环回地址（如 0.0.0.0 暴露局域网）时生效；本机 127.0.0.1 访问始终免登录。
          登录状态 24 小时内有效（使用中自动续期）。
        </p>
        ${t?F:p`<p class="warning">尚未设置访问密码——若将 Web UI 绑定到非环回地址，局域网内任何人都可访问。</p>`}

        ${t?p`
              <div class="field">
                <span class="field-label">旧密码</span>
                <input type="password" inputmode="numeric" maxlength=${Ws}
                  autocomplete="current-password" placeholder="6 位数字"
                  .value=${this._old}
                  @input=${e=>this._old=e.target.value} />
              </div>
            `:F}

        <div class="field">
          <span class="field-label">新密码（6 位数字）</span>
          <input type="password" inputmode="numeric" maxlength=${Ws}
            autocomplete="new-password" placeholder="6 位数字"
            .value=${this._next}
            @input=${e=>this._next=e.target.value} />
        </div>
        <div class="field">
          <span class="field-label">确认新密码</span>
          <input type="password" inputmode="numeric" maxlength=${Ws}
            autocomplete="new-password" placeholder="再次输入"
            .value=${this._confirm}
            @input=${e=>this._confirm=e.target.value} />
        </div>
        <div class="actions">
          <button class="primary" ?disabled=${this._busy} @click=${this._submitSet}>
            ${t?"修改密码":"设置密码"}
          </button>
        </div>

        ${t?p`
              <div class="field">
                <span class="field-label">当前密码</span>
                <input type="password" inputmode="numeric" maxlength=${Ws}
                  autocomplete="current-password" placeholder="6 位数字"
                  .value=${this._clearPin}
                  @input=${e=>this._clearPin=e.target.value} />
              </div>
              <div class="actions">
                <button class="danger" ?disabled=${this._busy} @click=${this._submitClear}>清除密码</button>
                ${this._required?p`<button ?disabled=${this._busy} @click=${this._logout}>退出登录</button>`:F}
              </div>
            `:F}

        <p class="feedback ${this._error?"error":"ok"}">${this._error||this._ok||F}</p>
      </div>
    `}};Ot.styles=U`
    :host { display: block; }
    .section {
      margin-top: var(--cortex-space-4, 16px);
      padding-top: var(--cortex-space-4, 16px);
    }
    h2 {
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .hint {
      margin: 4px 0 12px;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      line-height: 1.6;
    }
    .warning {
      margin: 4px 0 12px;
      padding: 8px 12px;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-warning);
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-warning);
      border-radius: var(--cortex-radius-md);
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-success);
      border: 1px solid var(--cortex-success);
      border-radius: 999px;
      margin-left: 8px;
      vertical-align: middle;
    }
    /* 垂直 label + 全宽 input（DESIGN form 风格） */
    .field {
      display: grid;
      grid-template-columns: minmax(80px, 140px) 1fr;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-2) 0;
      align-items: center;
    }
    .field-label {
      font-size: var(--cortex-fs-sm);
      font-weight: 400;
      color: var(--cortex-text-muted);
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      font-size: var(--cortex-fs-base);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      outline: none;
    }
    input:focus {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 4px 0 14px;
    }
    button {
      padding: 8px 16px;
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      color: var(--cortex-text);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
    }
    button.primary {
      color: #fff;
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    button.primary:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    button.danger {
      color: var(--cortex-danger);
      border-color: var(--cortex-danger);
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .feedback {
      min-height: 1.2em;
      font-size: var(--cortex-fs-sm);
      margin: 4px 0 0;
    }
    .feedback.error { color: var(--cortex-danger); }
    .feedback.ok { color: var(--cortex-success); }
  `;pr([$()],Ot.prototype,"_hasPassword",2);pr([$()],Ot.prototype,"_required",2);pr([$()],Ot.prototype,"_old",2);pr([$()],Ot.prototype,"_next",2);pr([$()],Ot.prototype,"_confirm",2);pr([$()],Ot.prototype,"_clearPin",2);pr([$()],Ot.prototype,"_error",2);pr([$()],Ot.prototype,"_ok",2);pr([$()],Ot.prototype,"_busy",2);Ot=pr([Z("password-section")],Ot);class pc extends Error{constructor(e,r){super(`Presets API error ${e}`),this.status=e,this.body=r,this.name="PresetsApiError"}}async function wa(t){const e=await t.json().catch(()=>null);if(!t.ok)throw new pc(t.status,e);return e}async function xh(t){const e=t?`?kind=${t}`:"";return(await wa(await fetch(`/api/presets${e}`))).presets}async function yh(t){return wa(await fetch("/api/presets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}))}async function wh(t,e){return wa(await fetch(`/api/presets/${t}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}))}async function _h(t){await wa(await fetch(`/api/presets/${t}`,{method:"DELETE"}))}async function kh(t){return wa(await fetch(`/api/presets/${t}/activate`,{method:"POST"}))}var h2=Object.defineProperty,p2=Object.getOwnPropertyDescriptor,Kt=(t,e,r,i)=>{for(var s=i>1?void 0:i?p2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&h2(e,r,s),s};function f2(t){return{name:"",kind:t,protocol:"openai_compat",base_url:"",model_id:"",api_key:"",context_window:""}}const m2=[{value:"openai_compat",label:"OpenAI 兼容"},{value:"anthropic",label:"Anthropic"}];let yt=class extends G{constructor(){super(...arguments),this.activeLlm="",this.activeVision="",this._presets=[],this._loading=!0,this._editing=null,this._busy=!1,this._error=null,this._toast=null,this._confirmDeleteId=null,this._formError=null}connectedCallback(){super.connectedCallback(),this._load()}disconnectedCallback(){this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),super.disconnectedCallback()}async _load(){this._error=null;try{this._presets=await xh()}catch(t){this._error=`加载预设失败: ${t.message}`}finally{this._loading=!1}}_byKind(t){return this._presets.filter(e=>e.kind===t)}_isActive(t){return(t.kind==="llm"?this.activeLlm:this.activeVision)===t.name}_setFlash(t){this._toast=t,this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=null},3e3)}_errMsg(t){if(t instanceof pc){const e=t.body;return(e==null?void 0:e.detail)??`HTTP ${t.status}`}return t.message}_openNew(t){this._formError=null,this._editing={mode:"new",kind:t,form:f2(t)}}_openEdit(t){this._formError=null,this._editing={mode:"edit",kind:t.kind,presetId:t.id,form:{name:t.name,kind:t.kind,protocol:t.protocol??"openai_compat",base_url:t.base_url??"",model_id:t.model_id??"",api_key:"",context_window:t.context_window?String(t.context_window):""}}}_cancelEdit(){this._editing=null,this._formError=null}_setField(t,e){this._editing&&(this._editing={...this._editing,form:{...this._editing.form,[t]:e}})}async _submit(){const t=this._editing;if(!t)return;const e=t.form;if(!e.name.trim()){this._formError="请填写预设名称";return}if(!e.base_url.trim()||!e.model_id.trim()){this._formError="base_url 与模型 ID 必填";return}this._busy=!0,this._formError=null;try{if(t.mode==="new"){const r={name:e.name.trim(),kind:e.kind,protocol:e.protocol,base_url:e.base_url.trim(),model_id:e.model_id.trim(),api_key:e.api_key,context_window:e.kind==="llm"&&e.context_window?Number(e.context_window):null};await yh(r),this._setFlash(`已创建预设「${r.name}」`)}else if(t.presetId){const r=e.kind==="llm"&&e.context_window?Number(e.context_window):null,i={name:e.name.trim(),protocol:e.protocol,base_url:e.base_url.trim(),model_id:e.model_id.trim(),context_window:r};e.api_key&&(i.api_key=e.api_key),await wh(t.presetId,i),this._setFlash(`已更新预设「${e.name.trim()}」`)}this._editing=null,await this._load()}catch(r){this._formError=this._errMsg(r)}finally{this._busy=!1}}async _activate(t){this._busy=!0,this._error=null;try{const e=await kh(t.id);this._setFlash(e.note??`已切换到「${t.name}」`),this.dispatchEvent(new CustomEvent("presets-activated",{bubbles:!0,composed:!0}))}catch(e){this._error=`切换失败: ${this._errMsg(e)}`}finally{this._busy=!1}}async _delete(t){if(this._confirmDeleteId!==t.id){this._confirmDeleteId=t.id;return}this._busy=!0,this._error=null;try{await _h(t.id),this._confirmDeleteId=null,this._setFlash(`已删除预设「${t.name}」`),await this._load()}catch(e){this._error=`删除失败: ${this._errMsg(e)}`}finally{this._busy=!1}}_renderForm(){const t=this._editing;if(!t)return F;const e=t.form,r=e.kind==="llm";return p`
      <div class="form">
        <div>
          <div class="field-label">名称</div>
          <input class="input" autocomplete="off" .value=${e.name} @input=${i=>this._setField("name",i.target.value)} />
        </div>
        <div>
          <div class="field-label">协议</div>
          <select class="select" .value=${e.protocol} @change=${i=>this._setField("protocol",i.target.value)}>
            ${m2.map(i=>p`<option value=${i.value} ?selected=${i.value===e.protocol}>${i.label}</option>`)}
          </select>
        </div>
        <div class="full">
          <div class="field-label">API Base URL</div>
          <input class="input mono" autocomplete="off" placeholder="https://..." .value=${e.base_url} @input=${i=>this._setField("base_url",i.target.value)} />
        </div>
        <div>
          <div class="field-label">模型 ID</div>
          <input class="input mono" autocomplete="off" .value=${e.model_id} @input=${i=>this._setField("model_id",i.target.value)} />
        </div>
        <div>
          <div class="field-label">API Key ${t.mode==="edit"?p`（留空=不改动）`:F}</div>
          <input class="input mono" type="password" autocomplete="new-password" placeholder=${t.mode==="edit"?"••••••":"可留空"} .value=${e.api_key} @input=${i=>this._setField("api_key",i.target.value)} />
        </div>
        ${r?p`
          <div>
            <div class="field-label">上下文窗口（tokens，留空用默认 200000）</div>
            <input class="input" type="number" min="1" autocomplete="off" .value=${e.context_window} @input=${i=>this._setField("context_window",i.target.value)} />
          </div>
        `:F}
        ${this._formError?p`<div class="form-error">${this._formError}</div>`:F}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._submit()}>
            ${this._busy?"保存中…":t.mode==="new"?"创建":"保存"}
          </button>
        </div>
      </div>
    `}_renderGroup(t,e){var i;const r=this._byKind(t);return p`
      <div class="group">
        <div class="group-title">
          ${e}
          <button class="icon-btn" @click=${()=>this._openNew(t)}>+ 新建</button>
        </div>
        ${r.length===0?p`<div class="empty">暂无预设，点「新建」创建一个。</div>`:p`<div class="preset-list">
              ${r.map(s=>this._renderRow(s))}
            </div>`}
        ${((i=this._editing)==null?void 0:i.kind)===t?this._renderForm():F}
      </div>
    `}_renderRow(t){const e=this._isActive(t),r=this._confirmDeleteId===t.id;return p`
      <div class="preset-row ${e?"active":""}">
        <div class="preset-main">
          <div class="preset-name">
            ${t.name}
          </div>
          <div class="preset-meta">${t.model_id||"（未设模型）"} · ${t.protocol}${t.kind==="llm"&&t.context_window?` · ${t.context_window}k`:""}</div>
        </div>
        <div class="row-actions">
          ${e?p`<button class="icon-btn" disabled>已激活</button>`:p`<button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._activate(t)}>切换</button>`}
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._openEdit(t)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${()=>this._delete(t)}>
            ${r?"确认删除":"删除"}
          </button>
        </div>
      </div>
    `}render(){return p`
      <div class="wrap">
        ${this._loading?p`<div class="empty">加载中…</div>`:p`${this._renderGroup("llm","LLM（AI 对话）")}${this._renderGroup("vision","视觉模型（图像解析）")}`}
        ${this._error?p`<div class="msg err">${this._error}</div>`:F}
        ${this._toast?p`<div class="msg ok">${this._toast}</div>`:F}
      </div>
    `}};yt.styles=U`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      margin-bottom: var(--cortex-space-6);
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-2);
    }
    .head h2 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      letter-spacing: -0.015em;
    }
    .head .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .group {
      margin-top: var(--cortex-space-5);
    }
    .group + .group {
      margin-top: var(--cortex-space-6);
      padding-top: var(--cortex-space-5);
    }
    .group-title {
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 var(--cortex-space-3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2);
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .preset-list {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .preset-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: none;
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .preset-row.active {
      border-color: var(--cortex-primary);
      background: rgba(49, 162, 76, 0.15);
    }
    .preset-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .preset-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .badge {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-primary);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-primary);
      border-radius: var(--cortex-radius-pill);
      padding: 1px var(--cortex-space-2);
    }
    .preset-meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-actions {
      display: flex;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    .icon-btn {
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
    }
    .icon-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-muted);
    }
    .icon-btn.primary {
      background: var(--cortex-btn-primary-bg);
      border-color: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .icon-btn.primary:hover { filter: brightness(1.05); }
    .icon-btn.danger:hover {
      background: var(--cortex-danger);
      border-color: var(--cortex-danger);
      color: #fff;
    }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      padding: var(--cortex-space-2) 0;
    }

    /* ===== 内联编辑表单 ===== */
    .form {
      margin-top: var(--cortex-space-3);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-3);
    }
    .form .full { grid-column: 1 / -1; }
    .field-label {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      margin-bottom: 2px;
    }
    .input, .select {
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      box-sizing: border-box;
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    .form-error {
      grid-column: 1 / -1;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-danger);
    }

    .msg {
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      margin-top: var(--cortex-space-3);
    }
    .msg.ok { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .msg.err { background: var(--cortex-danger-soft, rgba(220,38,38,0.1)); color: var(--cortex-danger); }

    @media (max-width: 1023px) {
      .form { grid-template-columns: 1fr; }
    }
  `;Kt([w()],yt.prototype,"activeLlm",2);Kt([w()],yt.prototype,"activeVision",2);Kt([$()],yt.prototype,"_presets",2);Kt([$()],yt.prototype,"_loading",2);Kt([$()],yt.prototype,"_editing",2);Kt([$()],yt.prototype,"_busy",2);Kt([$()],yt.prototype,"_error",2);Kt([$()],yt.prototype,"_toast",2);Kt([$()],yt.prototype,"_confirmDeleteId",2);Kt([$()],yt.prototype,"_formError",2);yt=Kt([Z("model-presets-section")],yt);var v2=Object.defineProperty,b2=Object.getOwnPropertyDescriptor,fr=(t,e,r,i)=>{for(var s=i>1?void 0:i?b2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&v2(e,r,s),s};function g2(){return{name:"",max_results:"50",min_score_threshold:"0.3",max_span:"50",weight_keyword_match:"4.0",weight_file_name_match:"2.0",weight_fts_score:"1.0",weight_title_match:"2.0",weight_proximity_match:"1.0"}}const Nn=[{key:"max_results",label:"最大结果数",hint:"search 工具最多返回多少篇文档",min:1,max:500,step:1},{key:"min_score_threshold",label:"评分阈值",hint:"低于该综合分的结果被过滤，0 = 不过滤",min:0,max:1,step:.05},{key:"max_span",label:"关键词集中度",hint:"邻近度统计的关键词最大字符跨度",min:1,max:100,step:1},{key:"weight_keyword_match",label:"关键词权重",hint:"命中的关键词越多排越前",min:0,max:10,step:.1},{key:"weight_file_name_match",label:"文件名权重",hint:"文件名含关键词的文档排更前",min:0,max:10,step:.1},{key:"weight_fts_score",label:"FTS 分权重",hint:"偏向传统 BM25 全文检索排序",min:0,max:10,step:.1},{key:"weight_title_match",label:"标题权重",hint:"小节标题含关键词排更前",min:0,max:10,step:.1},{key:"weight_proximity_match",label:"邻近度权重",hint:"关键词紧邻出现的文档排更前",min:0,max:10,step:.1}];let It=class extends G{constructor(){super(...arguments),this.activeSearch="",this._presets=[],this._loading=!0,this._editing=null,this._busy=!1,this._error=null,this._toast=null,this._confirmDeleteId=null,this._formError=null}connectedCallback(){super.connectedCallback(),this._load()}disconnectedCallback(){this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),super.disconnectedCallback()}async _load(){this._error=null;try{this._presets=await xh("search")}catch(t){this._error=`加载预设失败: ${t.message}`}finally{this._loading=!1}}_isActive(t){return this.activeSearch===t.name}_setFlash(t){this._toast=t,this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=null},3e3)}_errMsg(t){if(t instanceof pc){const e=t.body;return(e==null?void 0:e.detail)??`HTTP ${t.status}`}return t.message}_openNew(){this._formError=null,this._editing={mode:"new",form:g2()}}_openEdit(t){this._formError=null,this._editing={mode:"edit",presetId:t.id,form:{name:t.name,max_results:t.max_results!=null?String(t.max_results):"",min_score_threshold:t.min_score_threshold!=null?String(t.min_score_threshold):"",max_span:t.max_span!=null?String(t.max_span):"",weight_keyword_match:t.weight_keyword_match!=null?String(t.weight_keyword_match):"",weight_file_name_match:t.weight_file_name_match!=null?String(t.weight_file_name_match):"",weight_fts_score:t.weight_fts_score!=null?String(t.weight_fts_score):"",weight_title_match:t.weight_title_match!=null?String(t.weight_title_match):"",weight_proximity_match:t.weight_proximity_match!=null?String(t.weight_proximity_match):""}}}_cancelEdit(){this._editing=null,this._formError=null}_setField(t,e){this._editing&&(this._editing={...this._editing,form:{...this._editing.form,[t]:e}})}_collect(t){const e={};for(const r of Nn){const i=t[r.key].trim();e[r.key]=i===""?null:Number(i)}return e}async _submit(){const t=this._editing;if(!t)return;const e=t.form;if(!e.name.trim()){this._formError="请填写预设名称";return}for(const r of Nn){const i=e[r.key].trim();if(i!==""&&Number.isNaN(Number(i))){this._formError=`${r.label} 不是有效数字`;return}}this._busy=!0,this._formError=null;try{const r=this._collect(e);t.mode==="new"?(await yh({name:e.name.trim(),kind:"search",...r}),this._setFlash(`已创建预设「${e.name.trim()}」`)):t.presetId&&(await wh(t.presetId,{name:e.name.trim(),...r}),this._setFlash(`已更新预设「${e.name.trim()}」`)),this._editing=null,await this._load()}catch(r){this._formError=this._errMsg(r)}finally{this._busy=!1}}async _activate(t){this._busy=!0,this._error=null;try{await kh(t.id),this._setFlash(`已切换到「${t.name}」`),this.dispatchEvent(new CustomEvent("presets-activated",{bubbles:!0,composed:!0}))}catch(e){this._error=`切换失败: ${this._errMsg(e)}`}finally{this._busy=!1}}async _delete(t){if(this._confirmDeleteId!==t.id){this._confirmDeleteId=t.id;return}this._busy=!0,this._error=null;try{await _h(t.id),this._confirmDeleteId=null,this._setFlash(`已删除预设「${t.name}」`),await this._load()}catch(e){this._error=`删除失败: ${this._errMsg(e)}`}finally{this._busy=!1}}_summary(t){return[`结果≤${t.max_results??"?"}`,`阈值${t.min_score_threshold??"?"}`,`权[${t.weight_keyword_match??"?"}/${t.weight_file_name_match??"?"}/${t.weight_fts_score??"?"}/${t.weight_title_match??"?"}/${t.weight_proximity_match??"?"}]`].join(" · ")}_renderForm(){const t=this._editing;if(!t)return F;const e=t.form;return p`
      <div class="form">
        <div class="full">
          <div class="field-label">名称</div>
          <input class="input" autocomplete="off" .value=${e.name} @input=${r=>this._setField("name",r.target.value)} />
        </div>
        ${Nn.map(r=>p`
          <div>
            <div class="field-label">${r.label} <span class="field-range">${r.min}–${r.max}</span></div>
            <input
              class="input"
              type="number"
              autocomplete="off"
              min=${r.min}
              max=${r.max}
              step=${r.step}
              .value=${e[r.key]}
              @input=${i=>this._setField(r.key,i.target.value)}
            />
            <div class="field-hint">${r.hint}</div>
          </div>
        `)}
        ${this._formError?p`<div class="form-error">${this._formError}</div>`:F}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._submit()}>
            ${this._busy?"保存中…":t.mode==="new"?"创建":"保存"}
          </button>
        </div>
      </div>
    `}_renderRow(t){const e=this._isActive(t),r=this._confirmDeleteId===t.id;return p`
      <div class="preset-row ${e?"active":""}">
        <div class="preset-main">
          <div class="preset-name">
            ${t.name}
          </div>
          <div class="preset-meta">${this._summary(t)}</div>
        </div>
        <div class="row-actions">
          ${e?p`<button class="icon-btn" disabled>已激活</button>`:p`<button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._activate(t)}>切换</button>`}
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._openEdit(t)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${()=>this._delete(t)}>
            ${r?"确认删除":"删除"}
          </button>
        </div>
      </div>
    `}render(){return p`
      <div class="wrap">
        ${this._loading?p`<div class="empty">加载中…</div>`:p`
            <div class="group">
              <div class="group-title">
                搜索调优
                <button class="icon-btn" @click=${()=>this._openNew()}>+ 新建</button>
              </div>
              ${this._presets.length===0?p`<div class="empty">暂无预设，点「新建」创建一个。</div>`:p`<div class="preset-list">${this._presets.map(t=>this._renderRow(t))}</div>`}
              ${this._editing?this._renderForm():F}
            </div>
          `}
        ${this._error?p`<div class="msg err">${this._error}</div>`:F}
        ${this._toast?p`<div class="msg ok">${this._toast}</div>`:F}
      </div>
    `}};It.styles=U`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      margin-bottom: var(--cortex-space-6);
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-2);
    }
    .head h2 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      letter-spacing: -0.015em;
    }
    .head .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .group {
      margin-top: var(--cortex-space-5);
    }
    .group + .group {
      margin-top: var(--cortex-space-6);
      padding-top: var(--cortex-space-5);
    }
    .group-title {
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 var(--cortex-space-3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2);
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .preset-list {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .preset-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: none;
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .preset-row.active {
      border-color: var(--cortex-primary);
      background: rgba(49, 162, 76, 0.15);
    }
    .preset-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .preset-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .badge {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-primary);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-primary);
      border-radius: var(--cortex-radius-pill);
      padding: 1px var(--cortex-space-2);
    }
    .preset-meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .row-actions {
      display: flex;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    .icon-btn {
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
    }
    .icon-btn:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-text-muted); }
    .icon-btn.primary {
      background: var(--cortex-btn-primary-bg);
      border-color: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .icon-btn.primary:hover { filter: brightness(1.05); }
    .icon-btn.danger:hover {
      background: var(--cortex-danger);
      border-color: var(--cortex-danger);
      color: #fff;
    }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      padding: var(--cortex-space-2) 0;
    }

    .form {
      margin-top: var(--cortex-space-3);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-3);
    }
    .form .full { grid-column: 1 / -1; }
    .field-label {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      margin-bottom: 2px;
    }
    .field-label .field-range {
      font-weight: 400;
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      margin-left: var(--cortex-space-2);
    }
    .field-hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 2px;
      line-height: 1.4;
    }
    .input {
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }
    .input:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    .form-error {
      grid-column: 1 / -1;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-danger);
    }
    .msg {
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      margin-top: var(--cortex-space-3);
    }
    .msg.ok { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .msg.err { background: var(--cortex-danger-soft, rgba(220,38,38,0.1)); color: var(--cortex-danger); }

    @media (max-width: 1023px) {
      .form { grid-template-columns: 1fr; }
    }
  `;fr([w()],It.prototype,"activeSearch",2);fr([$()],It.prototype,"_presets",2);fr([$()],It.prototype,"_loading",2);fr([$()],It.prototype,"_editing",2);fr([$()],It.prototype,"_busy",2);fr([$()],It.prototype,"_error",2);fr([$()],It.prototype,"_toast",2);fr([$()],It.prototype,"_confirmDeleteId",2);fr([$()],It.prototype,"_formError",2);It=fr([Z("search-presets-section")],It);var x2=Object.defineProperty,y2=Object.getOwnPropertyDescriptor,mr=(t,e,r,i)=>{for(var s=i>1?void 0:i?y2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&x2(e,r,s),s};const kd=["ai","search","network"],w2={ai:"sparkles",search:"search",network:"globe"},_2=p`
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
`,k2=p`
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
`;let Rt=class extends G{constructor(){super(...arguments),this._activeTab="ai",this._saving=!1,this._error=null,this._toast=null,this._values={},this._original={},this._exists=!0,this._scope="global",this._fieldErrors={},this._loadGen=0,this._onRevertRequest=()=>{this._revert()}}connectedCallback(){super.connectedCallback();const t=T.getState();this._scope=t.settings.scope,this._unsubscribe=T.subscribe(()=>this._onStoreChange()),window.addEventListener("cortex:revert-settings",this._onRevertRequest),this._load()}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),this._toastTimer!==void 0&&(window.clearTimeout(this._toastTimer),this._toastTimer=void 0),this._loadGen+=1,window.removeEventListener("cortex:revert-settings",this._onRevertRequest),super.disconnectedCallback()}_onStoreChange(){const t=T.getState();t.settings.scope!==this._scope&&(this._scope=t.settings.scope,this._load())}async _load(){const t=++this._loadGen;this._error=null;try{const e=await l2(this._scope);if(t!==this._loadGen||!this.isConnected)return;this._values={...e.values},this._original={...e.values},this._exists=e.exists,this._fieldErrors={},C.loadSettings(this._values,e.exists)}catch(e){if(t!==this._loadGen||!this.isConnected)return;this._error=`加载失败: ${e.message}`}}get _dirtyFields(){const t=new Set([...Object.keys(this._original),...Object.keys(this._values)]),e=[];for(const r of t)(this._original[r]??"")!==(this._values[r]??"")&&e.push(r);return e}get _dirty(){return this._dirtyFields.length>0}_updateValues(t){this._values={...this._values,...t};for(const[e,r]of Object.entries(t))C.updateSetting(e,r)}_onInput(t,e){this._updateValues({[t]:e})}_isMobile(){return typeof window.matchMedia=="function"&&window.matchMedia("(max-width: 1023px)").matches}_pushToast(t,e="info",r=2500){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(t,e,r)}_extractFieldErrors(t){if(t instanceof wo){const e=t.body,r={};for(const i of(e==null?void 0:e.fields)??[])r[i.field]=i.error;return r}return{}}_close(){Sr.navigate(Sr.lastMain())}async _refreshSystemStatus(){try{const t=await eu();C.setStatus(t)}catch{}}_revert(){this._values={...this._original},C.revertSettings()}async _save(){var t;if(!(!this._dirty||this._saving)){this._saving=!0,this._error=null,this._fieldErrors={};try{const e=await c2(this._scope,this._values);if(!this.isConnected)return;this._original={...this._values},C.loadSettings(this._values,!0),this._refreshSystemStatus();const r=e.needs_restart?"已保存。重启 doclens gui 后 AI 配置生效。":"已保存。下次查询立即生效。";this._isMobile()?this._pushToast(r,"success",4e3):this._toast=r}catch(e){let r;if(e instanceof wo){const i=e.body,s=(t=i==null?void 0:i.fields)==null?void 0:t.map(a=>a.field).join(", ");r=s?`保存失败（${s}）`:`保存失败 (HTTP ${e.status})`}else e instanceof Error?r=`保存失败: ${e.message}`:r="保存失败: 未知错误";this._isMobile()?(this._pushToast(r,"error",5e3),this._fieldErrors=this._extractFieldErrors(e)):this._error=r}finally{this._saving=!1}}}_renderField(t){const e=this._values[t.envVar]??"";return p`
      <div class="field">
        <div class="field-label">
          <div class="name">${t.label}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(t,e)}</div>
          ${this._fieldErrors[t.envVar]?p`<div class="field-error">${this._fieldErrors[t.envVar]}</div>`:F}
        </div>
        ${this._renderDesc(t)}
      </div>
    `}_renderDesc(t){if(t.tab!=="search"||!t.hint)return F;const e=t.hint.replace(/。$/,""),r=t.min!=null&&t.max!=null?` · ${t.min}–${t.max}`:"";return p`<div class="desc">${e}${r}</div>`}_renderInput(t,e){const r=t.mono?"mono":"",i=s=>this._onInput(t.envVar,s.target.value);switch(t.component){case"text":return p`
          <input
            class="input ${r}"
            type="text"
            .value=${e}
            placeholder=${Bn[t.envVar]??F}
            data-env=${t.envVar}
            @input=${i}
            list=${t.datalist?`${t.envVar}-list`:F}
          />
          ${t.datalist?p`
            <datalist id=${`${t.envVar}-list`}>
              ${t.datalist.map(s=>p`<option value=${s}></option>`)}
            </datalist>
          `:F}
        `;case"password":return p`
          <div class="password-wrap">
            <input
              class="input ${r}"
              type="password"
              .value=${e}
              data-env=${t.envVar}
              @input=${i}
            />
            <button
              class="password-toggle"
              type="button"
              aria-label="显示密码"
              @click=${s=>{const a=s.currentTarget,o=a.previousElementSibling,l=a.classList.toggle("revealed");o.type=l?"text":"password",a.setAttribute("aria-label",l?"隐藏密码":"显示密码")}}
            >
              <span class="eye-show">${_2}</span>
              <span class="eye-hide">${k2}</span>
            </button>
          </div>
        `;case"number":return p`
          <input
            class="input"
            type="number"
            .value=${e}
            placeholder=${Bn[t.envVar]??F}
            min=${t.min??F}
            max=${t.max??F}
            step=${t.step??F}
            data-env=${t.envVar}
            @input=${i}
          />
          ${t.unit?p`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${t.unit}</span>`:F}
        `;case"select":return p`
          <select class="select" .value=${e} data-env=${t.envVar} @change=${i}>
            ${(t.options??[]).map(s=>p`
              <option value=${s.value} ?selected=${s.value===e}>${s.label}</option>
            `)}
          </select>
        `;case"switch":{const s=e==="",a=s?(o2[t.envVar]??"true")==="true":e==="true",o=l=>this._onInput(t.envVar,l.target.checked?"true":"false");return p`
          <label class="switch">
            <input
              type="checkbox"
              .checked=${a}
              data-env=${t.envVar}
              @change=${o}
            />
            <span class="track"><span class="thumb"></span></span>
            <span class="switch-text">${a?"已启用":"已停用"}${s?"（默认）":""}</span>
          </label>
        `}case"slider":{const s=e==="",a=s?Bn[t.envVar]??String(t.min??0):e;return p`
          <div class="slider-row">
            <input
              class="input"
              type="number"
              .value=${a}
              min=${t.min??F}
              max=${t.max??F}
              step=${t.step??F}
              style="width: 100px;"
              data-env=${t.envVar}
              @input=${i}
            />
            <input
              type="range"
              min=${t.min??F}
              max=${t.max??F}
              step=${t.step??F}
              .value=${a}
              @input=${i}
            />
            <span class="value-chip ${s?"implicit":""}" data-role="value-chip">${a}</span>
          </div>
        `}case"toggle":return p`
          <label class="toggle">
            <input
              type="checkbox"
              ?checked=${e==="true"}
              data-env=${t.envVar}
              @change=${s=>this._onInput(t.envVar,s.target.checked?"true":"false")}
            />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label">${e==="true"?"开启":"关闭"}</span>
          </label>
        `;default:return F}}render(){const t="全局",e=this._exists?"":"（新建）";return p`
      <div class="layout">
        <aside class="sidebar">
          <nav class="tab-strip" role="tablist">
            ${kd.map(r=>p`
              <button
                class=${this._activeTab===r?"active":""}
                @click=${()=>{this._activeTab=r}}
              ><doclens-icon name=${w2[r]}></doclens-icon>${a2[r]}</button>
            `)}
          </nav>
        </aside>
        <main class="main">
          <div class="scroll-area">
            ${kd.map(r=>{const i=n2.filter(a=>a.tab===r),s=[];for(const a of i){const o=a.section??"";let l=s.find(c=>c.title===o);l||(l={title:o,fields:[]},s.push(l)),l.fields.push(a)}return p`
                <div class="tab-panel ${this._activeTab===r?"active":""}" data-panel=${r}>
                  ${r==="ai"?p`
                    <model-presets-section
                      .activeLlm=${this._values.CORTEX_ACTIVE_LLM_PRESET??""}
                      .activeVision=${this._values.CORTEX_ACTIVE_VISION_PRESET??""}
                      @presets-activated=${()=>{this._load(),this._refreshSystemStatus()}}
                    ></model-presets-section>
                  `:F}
                  ${r==="search"?p`
                    <search-presets-section
                      .activeSearch=${this._values.CORTEX_ACTIVE_SEARCH_PRESET??""}
                      @presets-activated=${()=>this._load()}
                    ></search-presets-section>
                  `:F}
                  ${s.map(a=>p`
                    <div class="section">
                      ${a.title?p`<h2>${a.title}</h2>`:F}
                      ${a.fields.map(o=>this._renderField(o))}
                    </div>
                  `)}
                  ${r==="network"?p`<password-section></password-section>`:F}
                </div>
              `})}
          </div>
          <div class="footer-bar">
            <div class="dirty-status">
              ${this._dirty?p`<span class="dirty-dot"></span><span class="dirty-text">有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`:p`<span class="dirty-text" style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`}
              ${this._error?p`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>`:F}
              ${this._toast?p`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>`:F}
            </div>
            <div class="footer-actions">
              ${this._dirty?p`<button class="btn" ?disabled=${this._saving} @click=${()=>this._revert()}>放弃修改</button>`:F}
              <button class="btn close" type="button" @click=${()=>this._close()}>关闭</button>
              <button class="btn primary" ?disabled=${!this._dirty||this._saving} @click=${()=>this._save()}>
                ${this._saving?"保存中…":p`<doclens-icon name="save"></doclens-icon>保存${t}配置${e}`}
              </button>
            </div>
          </div>
        </main>
      </div>
      <toast-stack></toast-stack>
    `}};Rt.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    /* ===== 桌面端 F1 布局：左 sidebar（scope+垂直 tab）+ 右 main（panel/footer 居中对齐）===== */
    .layout {
      display: flex;
      flex-direction: row;
      flex: 1;
      min-height: 0;
    }
    .sidebar {
      width: 180px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-6) var(--cortex-space-3);
      background: var(--cortex-surface);
      border-right: 1px solid var(--cortex-border-muted);
      overflow-y: auto;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }
    .tab-strip {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tab-strip button {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      background: transparent;
      border: none;
      padding: var(--cortex-space-2) var(--cortex-space-4);
      font-size: 14px;
      font-weight: 600;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      border-radius: var(--cortex-radius-lg);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tab-strip button doclens-icon {
      font-size: 16px;
      flex-shrink: 0;
    }
    .tab-strip button:hover {
      color: var(--cortex-text);
    }
    .tab-strip button.active {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
    }
    .scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--cortex-space-4);
    }
    .tab-panel { display: none; max-width: 880px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    .section {
      padding: 0 0 var(--cortex-space-6);
      margin-bottom: var(--cortex-space-2);
    }
    .section + .section {
      padding-top: var(--cortex-space-5);
    }
    .section h2 {
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1.3;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .section-desc {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin: 0 0 var(--cortex-space-4) 0;
    }
    .field {
      display: grid;
      grid-template-columns: minmax(80px, 140px) 1fr;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-2) 0;
      align-items: center;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-sm);
      font-weight: 400;
      color: var(--cortex-text);
      line-height: 1.5;
    }
    .field-control { display: flex; flex-direction: column; gap: var(--cortex-space-1); }
    /* password wrapper：撑满父容器 + 让"显示"按钮内嵌右侧 */
    .password-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 100%;
    }
    .password-wrap .input { padding-right: 44px; max-width: 100%; }
    .password-toggle {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      color: var(--cortex-text-muted);
      background: transparent;
      border: none;
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .password-toggle:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    /* CSS-only icon swap：模板里两个 span 都在 DOM，class 控制可见性，
       避免 render() 在 shadow DOM 中因 cached template 不挂载导致 SVG 丢失 */
    .password-toggle .eye-hide { display: none; }
    .password-toggle.revealed .eye-show { display: none; }
    .password-toggle.revealed .eye-hide { display: inline-flex; }
    .field-control .row { display: flex; align-items: center; gap: var(--cortex-space-2); }
    .slider-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
    }
    /* 布尔开关（switch 组件）：轨道 + 滑块，选中态用主色 */
    .switch {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      cursor: pointer;
      user-select: none;
    }
    .switch input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .switch .track {
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background: var(--cortex-border);
      position: relative;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .switch .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s;
    }
    .switch input:checked + .track { background: var(--cortex-primary); }
    .switch input:checked + .track .thumb { transform: translateX(16px); }
    .switch input:focus-visible + .track {
      outline: 2px solid var(--cortex-primary);
      outline-offset: 1px;
    }
    .switch .switch-text {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .slider-row input[type="range"] {
      accent-color: var(--cortex-primary);
      flex: 1;
    }
    .slider-row .value-chip { display: none; }
    .value-chip {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      border-radius: var(--cortex-radius-sm);
      padding: 2px var(--cortex-space-2);
      font-variant-numeric: tabular-nums;
    }

    /* 常驻描述行（仅 search tab 渲染，见 _renderDesc） */
    .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      line-height: 1.4;
      margin-top: 2px;
    }
    /* .field 是双列 grid，desc 独占一行通栏显示 */
    .field .desc { grid-column: 1 / -1; }

    /* 权重区：桌面两列网格 */
    .weights-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-4) var(--cortex-space-6);
    }
    .w-item { min-width: 0; }
    .w-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2);
      margin-bottom: 2px;
    }
    .w-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
    }
    /* 未显式设置、回显默认值的徽章：弱化样式与显式值区分 */
    .value-chip.implicit {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
    }
    .w-slider {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-1);
    }
    .w-slider input[type="range"] {
      flex: 1;
      accent-color: var(--cortex-primary);
    }
    .w-end {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      min-width: 14px;
      text-align: center;
    }

    .input, .select {
      padding: 9px 12px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    /* toggle 开关（bool 配置项，如「启用 MCP server」） */
    .toggle {
      display: inline-flex; align-items: center; gap: var(--cortex-space-2);
      cursor: pointer; user-select: none;
    }
    .toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
    .toggle-track {
      width: 36px; height: 20px; border-radius: 10px;
      background: var(--cortex-border-muted);
      position: relative; transition: background 0.15s; flex-shrink: 0;
    }
    .toggle-thumb {
      position: absolute; top: 2px; left: 2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--cortex-surface);
      transition: transform 0.15s;
    }
    .toggle input:checked + .toggle-track { background: var(--cortex-primary); }
    .toggle input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }
    .toggle input:focus-visible + .toggle-track { box-shadow: var(--cortex-focus-ring); }
    .toggle-label { font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle); }
    .input:hover:not(:focus), .select:hover:not(:focus) {
      border-color: var(--cortex-text-muted);
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      background: var(--cortex-surface);
      box-shadow: var(--cortex-focus-ring);
    }

    .footer-bar {
      flex-shrink: 0;
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -1px 0 var(--cortex-border-muted);
      max-width: 880px;
      width: 100%;
      margin: var(--cortex-space-4) auto 0;
      box-sizing: border-box;
      border-radius: var(--cortex-radius-lg) var(--cortex-radius-lg) 0 0;
    }
    .dirty-status {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .dirty-dot {
      display: inline-block;
      width: 8px; height: 8px;
      background: var(--cortex-warning);
      border-radius: 50%;
      margin-right: var(--cortex-space-2);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 8px 14px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s, transform 0.05s;
    }
    .btn:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-text-muted); }
    .btn:active { transform: translateY(0.5px); }
    .btn.primary {
      background: var(--cortex-btn-primary-bg);
      border: none;
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .btn.primary:hover { filter: brightness(1.05); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    /* 关闭按钮加宽：与保存并列时点击目标更大 */
    .btn.close { padding-left: var(--cortex-space-6); padding-right: var(--cortex-space-6); }

    /* ===== 移动端 (<1024px) ===== */
    @media (max-width: 1023px) {
      /* F1 移动端单列回退：scope+tab 回到顶部水平条，整体滚动，footer 吸底保留。
         注意：.layout/.main/.scroll-area 必须 flex: none 让盒子随内容撑高，
         否则被 flex 压缩后 overflow:visible 只是"看得见"，底部 padding 无效。 */
      :host { overflow-y: auto; }
      .layout { flex-direction: column; flex: none; min-height: 0; overflow: visible; }
      .sidebar {
        width: 100%;
        flex-direction: column;
        gap: var(--cortex-space-2);
        padding: var(--cortex-space-3) var(--cortex-space-4);
        border-right: none;
        border-bottom: 1px solid var(--cortex-border);
        overflow: visible;
        flex-shrink: 0;
      }
      .main { overflow: visible; min-height: 0; flex: none; }
      .scroll-area { overflow: visible; flex: none; }
      .tab-strip { flex-direction: row; overflow-x: auto; }
      .tab-strip button {
        justify-content: center;
        text-align: center;
        white-space: nowrap;
      }

      .section h2 {
        margin-left: calc(-1 * var(--cortex-space-4));
        margin-right: calc(-1 * var(--cortex-space-4));
      }
      .scroll-area {
        padding: 0 var(--cortex-space-4) var(--cortex-space-6);
      }

      /* 移动端保留 footer（保存按钮唯一入口）：fixed 吸底。
         设置页全屏覆盖 tab-bar 区域（app.ts 在 settings 视图隐藏 tab-bar），
         故 bottom: 0，并为刘海屏留出安全区。
         不用 sticky —— .layout/.main 被 flex 压缩后盒子包不住内容，sticky 会失效。 */
      .footer-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 20;
        margin: 0;
        border-radius: 0;
        padding: var(--cortex-space-2) var(--cortex-space-3);
        padding-bottom: calc(var(--cortex-space-2) + env(safe-area-inset-bottom, 0px));
        flex-wrap: nowrap;
        align-items: center;
        gap: var(--cortex-space-2);
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
      }
      /* 给 fixed footer 让位：padding 必须加在随内容撑高的 .scroll-area 上，
         加在 .main 上会像 sticky 一样被 flex 压缩吞掉 */
      .scroll-area { padding-bottom: 120px; }
      /* 状态区压缩：移动端只留脏标记圆点 + 错误/成功提示，说明文字省略 */
      .footer-bar .dirty-status { flex: 0 0 auto; font-size: var(--cortex-fs-xs); gap: var(--cortex-space-1); }
      .footer-bar .dirty-status .dirty-text { display: none; }
      .footer-bar .dirty-dot { margin-right: 0; }
      /* 按钮单行不折行：revert 幽灵小按钮，save 主按钮撑满剩余空间 */
      .footer-bar .footer-actions { flex: 1; display: flex; gap: var(--cortex-space-2); min-width: 0; }
      .footer-bar .btn {
        white-space: nowrap;
        min-height: 40px;
        padding: 6px var(--cortex-space-3);
      }
      .footer-bar .btn.primary { flex: 1; justify-content: center; }
      /* 移动端关闭按钮与保存等宽分摊剩余空间 */
      .footer-bar .btn.close { flex: 1; justify-content: center; }

      .input, .select { max-width: 100%; }

      /* 权重区移动端回退单列 */
      .weights-grid { grid-template-columns: 1fr; }

      /* Slider 单控件 + 数值 chip */
      .slider-row {
        display: flex;
        flex-direction: column;
        gap: var(--cortex-space-2);
      }
      .slider-row input[type="number"] { display: none; }
      .slider-row input[type="range"] {
        max-width: 100%;
        width: 100%;
        flex: 1;
      }
      /* 需压过桌面端 .slider-row .value-chip { display: none } 的优先级 */
      .slider-row .value-chip {
        display: inline-block;
        align-self: flex-start;
        font-size: var(--cortex-fs-md);
        font-weight: 600;
      }

      /* Password 显示按钮：mobile 仍嵌在 input 内右侧，与桌面布局一致 */
      .password-wrap { max-width: 100% !important; position: relative !important; }
      .password-toggle {
        position: absolute !important;
        right: var(--cortex-space-2) !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }

      /* Toast-stack 避开移动 tab-bar */
      toast-stack {
        bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 12px);
        right: 12px;
        left: 12px;
        width: auto;
      }
      toast-stack .toast { max-width: 100%; }

      /* 字段错误红字 */
      .field-error {
        font-size: var(--cortex-fs-xs);
        color: var(--cortex-danger);
        margin-top: var(--cortex-space-1);
      }

      /* ===== Mobile polish: tightened spacing ===== */
      .section {
        padding: var(--cortex-space-4);
        margin-bottom: var(--cortex-space-3);
      }
      .tab-strip {
        gap: 4px;
      }
      .tab-strip button {
        padding: var(--cortex-space-3) var(--cortex-space-2);
        font-size: var(--cortex-fs-sm);
      }
    }
  `;mr([$()],Rt.prototype,"_activeTab",2);mr([$()],Rt.prototype,"_saving",2);mr([$()],Rt.prototype,"_error",2);mr([$()],Rt.prototype,"_toast",2);mr([$()],Rt.prototype,"_values",2);mr([$()],Rt.prototype,"_original",2);mr([$()],Rt.prototype,"_exists",2);mr([$()],Rt.prototype,"_scope",2);mr([$()],Rt.prototype,"_fieldErrors",2);Rt=mr([Z("settings-view")],Rt);const Fr=t=>`/api/files${t}`,jr={list:(t,e=200,r=0)=>pe(Fr(`/list?path=${encodeURIComponent(t)}&limit=${e}&offset=${r}`)),stats:t=>pe(Fr(`/stats?path=${encodeURIComponent(t)}`)),attrs:t=>pe(Fr(`/attrs?path=${encodeURIComponent(t)}`)),mkdir:t=>pe(Fr("/mkdir"),{method:"POST",json:{path:t}}),remove:t=>pe(Fr(`?path=${encodeURIComponent(t)}`),{method:"DELETE"}),move:(t,e,r=!1)=>pe(Fr("/move"),{method:"POST",json:{from_paths:t,dest_dir:e,overwrite:r}}),rename:(t,e)=>pe(Fr("/rename"),{method:"POST",json:{path:t,new_name:e}}),upload:(t,e,r=!1)=>{const i=new FormData;return i.append("file",t),i.append("dest_dir",e),i.append("overwrite",String(r)),pe(Fr("/upload"),{method:"POST",body:i})}};var S2=Object.defineProperty,z2=Object.getOwnPropertyDescriptor,li=(t,e,r,i)=>{for(var s=i>1?void 0:i?z2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&S2(e,r,s),s};let or=class extends G{constructor(){super(...arguments),this.depth=0,this.expanded=!1,this.selected=!1,this.readonly=!1,this.childEntries=[],this.loading=""}connectedCallback(){super.connectedCallback(),this._unsubscribe=T.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}_onClick(){this.readonly?this.dispatchEvent(new CustomEvent("pick-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0})):this.dispatchEvent(new CustomEvent("select-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}_toggle(t){t.stopPropagation(),this.entry.has_child_dirs&&this.dispatchEvent(new CustomEvent("toggle",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}render(){const{treeCache:t,expandedPaths:e,currentDir:r}=T.getState().files,i=new Set(e);return p`
      <div class="row ${this.selected?"selected":""}" @click=${this._onClick}>
        <span
          class="arrow ${this.expanded?"expanded":""} ${this.entry.has_child_dirs?"":"leaf"}"
          @click=${this._toggle}><doclens-icon name="chevron-right"></doclens-icon></span>
        <doclens-icon class="icon" name=${this.entry.is_dir?"folder":"file"}></doclens-icon>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded&&this.entry.is_dir?p`
        <div class="children">
          ${this.loading&&this.loading===this.entry.path?p`<div style="padding: 4px 8px; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm);">加载中…</div>`:this.childEntries.filter(s=>s.is_dir).map(s=>p`
              <tree-node
                .entry=${s}
                .depth=${this.depth+1}
                .expanded=${i.has(s.path)}
                .selected=${s.path===r}
                .childEntries=${t[s.path]||[]}
                .readonly=${this.readonly}
                @select-dir=${a=>this._relay("select-dir",a)}
                @toggle=${a=>this._relay("toggle",a)}
                @pick-dir=${a=>this._relay("pick-dir",a)}
              ></tree-node>
            `)}
        </div>
      `:""}
    `}_relay(t,e){e.stopPropagation();const r=e.detail;this.dispatchEvent(new CustomEvent(t,{detail:r,bubbles:!0,composed:!0}))}};or.styles=U`
    :host { display: block; }
    .row {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3); cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-sm); color: var(--cortex-text);
      user-select: none;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .arrow {
      width: 16px; height: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--cortex-text-subtle); transition: transform 0.15s;
      font-size: 14px;
    }
    .arrow.expanded { transform: rotate(90deg); }
    .arrow.leaf { visibility: hidden; }
    .icon { font-size: 16px; }
    .label {
      flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);
    }
    .children { padding-left: 16px; }
  `;li([w({type:Object})],or.prototype,"entry",2);li([w({type:Number})],or.prototype,"depth",2);li([w({type:Boolean})],or.prototype,"expanded",2);li([w({type:Boolean})],or.prototype,"selected",2);li([w({type:Boolean})],or.prototype,"readonly",2);li([w({type:Array})],or.prototype,"childEntries",2);li([w({type:String})],or.prototype,"loading",2);or=li([Z("tree-node")],or);var $2=Object.getOwnPropertyDescriptor,T2=(t,e,r,i)=>{for(var s=i>1?void 0:i?$2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=o(s)||s);return s};let yl=class extends G{constructor(){super(...arguments),this._onToggle=async t=>{const e=t.detail.path,{expandedPaths:r}=T.getState().files;r.includes(e)?C.collapseDir(e):(await this._ensureLoaded(e),C.expandDir(e))},this._onSelectDir=async t=>{C.selectDir(t.detail.path),await this._ensureLoaded(t.detail.path),C.expandDir(t.detail.path)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=T.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),C.expandDir("")}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}async _ensureLoaded(t){const{treeCache:e}=T.getState().files;if(!(t in e))try{C.setFilesState({listing:!0});const r=await jr.list(t);C.setFilesState({treeCache:{...T.getState().files.treeCache,[t]:r.entries},listing:!1})}catch(r){C.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"})}}render(){var c;const{treeCache:t,expandedPaths:e,currentDir:r}=T.getState().files,i=t[""]||[],s=new Set(e),a=(c=T.getState().status)==null?void 0:c.workdir,l={name:(a==null?void 0:a.replace(/[\\/]+/g,"/").split("/").filter(Boolean).pop())||"根目录",path:"",is_dir:!0,has_child_dirs:i.some(h=>h.is_dir),size:0,modified_at:"",indexed:!1,writable:!1};return p`
      <div class="header">文件</div>
      <tree-node
        .entry=${l}
        .depth=${0}
        .expanded=${s.has("")}
        .selected=${r===""}
        .childEntries=${i}
        .loading=""
        @toggle=${this._onToggle}
        @select-dir=${this._onSelectDir}
      ></tree-node>
    `}};yl.styles=U`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-right: 1px solid var(--cortex-border);
      overflow-y: auto;
    }
    .header {
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: sticky; top: 0;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border-muted);
      z-index: 1;
    }
  `;yl=T2([Z("file-tree")],yl);const C2={pdf:{letter:"P",bg:"#E41E3F",fg:"#FFFFFF"},doc:{letter:"D",bg:"#0064E0",fg:"#FFFFFF"},docx:{letter:"D",bg:"#0064E0",fg:"#FFFFFF"},xls:{letter:"X",bg:"#31A24C",fg:"#FFFFFF"},xlsx:{letter:"X",bg:"#31A24C",fg:"#FFFFFF"},csv:{letter:"C",bg:"#31A24C",fg:"#FFFFFF"},ppt:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},pptx:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},md:{letter:"M",bg:"#A121CE",fg:"#FFFFFF"},txt:{letter:"T",bg:"#5D6C7B",fg:"#FFFFFF"},html:{letter:"H",bg:"#E34F26",fg:"#FFFFFF"},mhtml:{letter:"W",bg:"#0D9488",fg:"#FFFFFF"},mht:{letter:"W",bg:"#0D9488",fg:"#FFFFFF"},png:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},jpg:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},jpeg:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},webp:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},gif:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},bmp:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},tiff:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},tif:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"}};function E2(t){if(!t)return"";const e=t.lastIndexOf(".");return e<=0||e===t.length-1?"":t.slice(e+1).toLowerCase()}function A2(t,e){if(e)return null;const r=E2(t);return C2[r]??null}var M2=Object.defineProperty,P2=Object.getOwnPropertyDescriptor,Ho=(t,e,r,i)=>{for(var s=i>1?void 0:i?P2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&M2(e,r,s),s};let fs=class extends G{constructor(){super(...arguments),this.selected=!1,this.active=!1}_fmtSize(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}_fmtTime(t){if(!t)return"";try{return new Date(t).toLocaleString(void 0,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return""}}_onRowClick(){this.dispatchEvent(new CustomEvent("activated",{detail:{path:this.entry.path,is_dir:this.entry.is_dir},bubbles:!0,composed:!0}))}_onCheckboxClick(t){t.stopPropagation(),this.dispatchEvent(new CustomEvent("checked",{detail:{path:this.entry.path,ctrl:t.ctrlKey||t.metaKey,shift:t.shiftKey},bubbles:!0,composed:!0}))}render(){const t=A2(this.entry.name,this.entry.is_dir);return p`
      <div
        class="row ${this.active?"active":""}"
        @click=${this._onRowClick}>
        <span class="checkbox">
          <input
            type="checkbox"
            .checked=${this.selected}
            @click=${this._onCheckboxClick}
          />
        </span>
        <span class="cell-icon">
          ${this.entry.is_dir?p`<doclens-icon name="folder"></doclens-icon>`:t?p`<span class="type-badge"
                  style="background:${t.bg};color:${t.fg}">${t.letter}</span>`:p`<doclens-icon name="file"></doclens-icon>`}
        </span>
        <span class="name ${!this.entry.is_dir&&!this.entry.indexed?"unindexed":""}"
          title=${!this.entry.is_dir&&!this.entry.indexed?"未索引（不参与搜索）":""}
        >${this.entry.name}</span>
        <span class="size">${this.entry.is_dir?"":this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
      </div>
    `}};fs.styles=U`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns:
        var(--col-1, 28px)
        var(--col-2, 28px)
        var(--col-3, 240px)
        var(--col-4, 80px)
        var(--col-5, 140px);
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      transition: background 0.1s;
      font-size: var(--cortex-fs-sm);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .checkbox { display: flex; align-items: center; justify-content: center; }
    .checkbox input { accent-color: var(--cortex-primary); }
    .cell-icon { font-size: 16px; }
    .name {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: var(--cortex-text); font-size: var(--cortex-fs-sm);
    }
    /* 未索引文件：名称用 subtle 灰色区别（替代原"已索引"列徽标） */
    .name.unindexed { color: var(--cortex-text-subtle); }
    .size, .time, .cell-type {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: var(--cortex-fs-xs);
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
    .type-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-xs);
      font-weight: 700;
      line-height: 1;
      user-select: none;
      font-family: var(--cortex-font-mono);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
    }
  `;Ho([w({type:Object})],fs.prototype,"entry",2);Ho([w({type:Boolean})],fs.prototype,"selected",2);Ho([w({type:Boolean})],fs.prototype,"active",2);fs=Ho([Z("file-row")],fs);var D2=Object.defineProperty,O2=Object.getOwnPropertyDescriptor,_a=(t,e,r,i)=>{for(var s=i>1?void 0:i?O2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&D2(e,r,s),s};const Sh=[28,28,240,80,140],Sd=[20,20,80,50,80],zd=[60,60,800,200,300],$d=Sh.length,Td="cortex.files.colWidths";let Ri=class extends G{constructor(){super(...arguments),this.activePath="",this.mobile=!1,this._colWidths=[...Sh],this._showMobileMenu=!1,this._makeColResizeHandler=t=>e=>{e.preventDefault(),e.stopPropagation();const r=e.clientX,i=this._colWidths[t];document.body.style.cursor="col-resize",document.body.style.userSelect="none";const s=o=>{const l=o.clientX-r,c=Math.max(Sd[t],Math.min(zd[t],i+l)),h=[...this._colWidths];h[t]=c,this._colWidths=h},a=()=>{document.removeEventListener("mousemove",s),document.removeEventListener("mouseup",a),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(Td,JSON.stringify(this._colWidths))};document.addEventListener("mousemove",s),document.addEventListener("mouseup",a)},this._onMobileBackClick=()=>{this._showMobileMenu=!1,this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=t=>{t.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=t=>{var s,a;if(!this._showMobileMenu)return;const e=t.composedPath(),r=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-menu"),i=(a=this.shadowRoot)==null?void 0:a.querySelector(".mobile-more");r&&e.includes(r)||i&&e.includes(i)||(this._showMobileMenu=!1)},this._onMenuItemClick=t=>e=>{e.stopPropagation(),this._showMobileMenu=!1,this._action(t)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=T.subscribe(()=>this.requestUpdate()),this._loadColWidths(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}willUpdate(){for(let t=0;t<$d;t++)this.style.setProperty(`--col-${t+1}`,`${this._colWidths[t]}px`)}_loadColWidths(){const t=localStorage.getItem(Td);if(t)try{const e=JSON.parse(t);Array.isArray(e)&&e.length===$d&&e.every(r=>typeof r=="number"&&Number.isFinite(r))&&(this._colWidths=e.map((r,i)=>Math.max(Sd[i],Math.min(zd[i],r))))}catch{}}_action(t){this.dispatchEvent(new CustomEvent("action",{detail:{name:t},bubbles:!0,composed:!0}))}_onRowChecked(t){const{path:e,shift:r}=t.detail;C.selectEntry(e,{ctrl:!r,shift:r})}_onSelectAll(t){const e=t.target,{currentDir:r,treeCache:i,selectedPaths:s}=T.getState().files,a=i[r]||[];if(e.checked){const o=a.map(c=>c.path),l=Array.from(new Set([...s,...o]));C.setFilesState({selectedPaths:l})}else{const o=new Set(a.map(l=>l.path));C.setFilesState({selectedPaths:s.filter(l=>!o.has(l))})}}_goUp(){const{currentDir:t}=T.getState().files;if(t==="")return;const e=t.includes("/")?t.slice(0,t.lastIndexOf("/")):"";C.selectDir(e)}_renderMobileHeader(){const{currentDir:t,selectedPaths:e}=T.getState().files,r=e.length===1,i=e.length>=1,s=t===""?"/":`/${t}/`;return p`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="mobile-path" title=${s}>${s}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        ><doclens-icon name="more-horizontal"></doclens-icon></button>
        ${this._showMobileMenu?p`
              <div class="mobile-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  data-action="mkdir"
                  @click=${this._onMenuItemClick("mkdir")}
                ><doclens-icon name="folder-plus"></doclens-icon>新目录</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="upload"
                  @click=${this._onMenuItemClick("upload")}
                ><doclens-icon name="upload"></doclens-icon>上传</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="rename"
                  ?disabled=${!r}
                  @click=${this._onMenuItemClick("rename")}
                ><doclens-icon name="pencil"></doclens-icon>重命名</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="move"
                  ?disabled=${!i}
                  @click=${this._onMenuItemClick("move")}
                ><doclens-icon name="arrow-right"></doclens-icon>移动</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="skill-toolbox"
                  ?disabled=${!i}
                  @click=${this._onMenuItemClick("skill-toolbox")}
                ><doclens-icon name="sparkles"></doclens-icon>技能工具箱</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="copy-path"
                  ?disabled=${!i}
                  @click=${this._onMenuItemClick("copy-path")}
                ><doclens-icon name="copy"></doclens-icon>拷贝路径</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="delete"
                  ?disabled=${!i}
                  class="danger"
                  @click=${this._onMenuItemClick("delete")}
                ><doclens-icon name="trash-2"></doclens-icon>删除</button>
              </div>
            `:null}
      </div>
    `}render(){const{currentDir:t,treeCache:e,selectedPaths:r}=T.getState().files,i=e[t]||[],s=new Set(r),a=r.length===1,o=r.length>=1,l=t!=="",c=t===""?"/":`/${t}/`,h=i.length>0&&i.every(f=>s.has(f.path));return this.mobile?p`
        ${this._renderMobileHeader()}
        ${i.length===0?p`<div class="empty">目录为空</div>`:p`<div class="header-row">
              <span class="select-all">
                <input
                  type="checkbox"
                  .checked=${h}
                  @click=${this._onSelectAll}
                />
              </span>
              <span></span>
              <span>名称</span>
              <span class="cell-size">大小</span>
              <span class="cell-time">修改</span>
            </div>`}
        <div class="rows">
          ${i.map(f=>p`
            <file-row
              .entry=${f}
              .selected=${s.has(f.path)}
              .active=${f.path===this.activePath}
              @checked=${this._onRowChecked}
            ></file-row>`)}
        </div>
      `:p`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!l}
          @click=${this._goUp}
        ><doclens-icon name="arrow-up"></doclens-icon></button>
        <span class="path">${c}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${()=>this._action("mkdir")}><doclens-icon name="folder-plus"></doclens-icon><span class="btn-label">新目录</span></button>
        <button data-action="upload" @click=${()=>this._action("upload")}><doclens-icon name="upload"></doclens-icon><span class="btn-label">上传</span></button>
        <button data-action="rename" ?disabled=${!a} @click=${()=>this._action("rename")}><doclens-icon name="pencil"></doclens-icon><span class="btn-label">重命名</span></button>
        <button data-action="move" ?disabled=${!o} @click=${()=>this._action("move")}><doclens-icon name="arrow-right"></doclens-icon><span class="btn-label">移动</span></button>
        <button data-action="copy-path" ?disabled=${!o} title="复制选中项的路径（多选时每行一个）" @click=${()=>this._action("copy-path")}><doclens-icon name="copy"></doclens-icon><span class="btn-label">拷贝路径</span></button>
        <button data-action="skill-toolbox" ?disabled=${!o} title="对选中文件运行技能（AI 对话）" @click=${()=>this._action("skill-toolbox")}><doclens-icon name="sparkles"></doclens-icon><span class="btn-label">技能工具箱</span></button>
        <button data-action="delete" ?disabled=${!o} class="danger" @click=${()=>this._action("delete")}><doclens-icon name="trash-2"></doclens-icon><span class="btn-label">删除</span></button>
      </div>
      ${i.length===0?p`<div class="empty">目录为空</div>`:p`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                .checked=${h}
                @click=${this._onSelectAll}
              />
            </span>
            <span></span>
            <span>名称<span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(2)}
              ></span></span>
            <span class="cell-size">大小<span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(3)}
              ></span></span>
            <span class="cell-time">修改<span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(4)}
              ></span></span>
          </div>`}
      <div class="rows">
        ${i.map(f=>p`
          <file-row
            .entry=${f}
            .selected=${s.has(f.path)}
            .active=${f.path===this.activePath}
            @checked=${this._onRowChecked}
          ></file-row>`)}
      </div>
    `}};Ri.styles=U`
    :host {
      display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .breadcrumb {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .breadcrumb .path {
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    .up-btn {
      padding: 2px 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      line-height: 1.4;
    }
    .up-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .up-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar {
      display: flex; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      position: relative;
      padding: 6px 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
    }
    .toolbar button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-subtle);
    }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar button.danger { color: var(--cortex-danger); }
    .toolbar button.danger:hover:not(:disabled) {
      background: rgba(220, 38, 38, 0.06);
      border-color: var(--cortex-danger);
    }
    /* 桌面省空间：按钮只显图标，文字在 hover 时以 tooltip 浮现（上方，
       覆盖面包屑区域，z-index 保证在上），不撑宽按钮、无布局抖动 */
    .toolbar button .btn-label {
      display: none;
    }
    .toolbar button:hover:not(:disabled) .btn-label {
      display: block;
      position: absolute;
      bottom: calc(100% + 5px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      background: var(--cortex-text);
      color: var(--cortex-surface);
      font-size: var(--cortex-fs-xs);
      line-height: 1.4;
      padding: 2px 10px;
      border-radius: var(--cortex-radius-pill);
      z-index: 20;
      pointer-events: none;
    }
    .mobile-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 8px 10px;
      border-bottom: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      flex-shrink: 0;
      position: relative;
    }
    .mobile-header .mobile-back,
    .mobile-header .mobile-more {
      border: none;
      background: transparent;
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mobile-header .mobile-back:hover,
    .mobile-header .mobile-more:hover {
      background: var(--cortex-surface-muted);
    }
    .mobile-header .mobile-path {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-header .mobile-menu {
      position: absolute;
      top: 100%;
      right: var(--cortex-space-2);
      min-width: 160px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10;
      padding: 4px 0;
    }
    .mobile-header .mobile-menu button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 10px 14px;
      cursor: pointer;
    }
    .mobile-header .mobile-menu button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
    }
    .mobile-header .mobile-menu button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .mobile-header .mobile-menu button.danger { color: var(--cortex-danger); }
    .header-row {
      display: grid;
      grid-template-columns:
        var(--col-1, 28px)
        var(--col-2, 28px)
        var(--col-3, 240px)
        var(--col-4, 80px)
        var(--col-5, 140px);
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      font-size: var(--cortex-fs-xs);
      font-weight: 500;
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    @media (max-width: 1023px) {
      .col-resize { display: none !important; }
    }
    .header-row > span { position: relative; }
    .col-resize {
      position: absolute;
      top: 0;
      right: -4px;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      z-index: 1;
      user-select: none;
      background: transparent;
    }
    .col-resize::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 1px;
      /* 2026-08-17 决议：竖线不再 100vh 贯穿整个列表（会从模态 dialog 旁
         穿出、列表区视觉突兀），仅表头行高内可见作列分隔指示；
         pointer-events:none 让视觉线不拦截行点击（拖动热区仍是 col-resize 主体） */
      height: 100%;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
      pointer-events: none;
    }
    .col-resize:hover::before,
    .col-resize:active::before {
      background: var(--cortex-text-muted);
    }
    .select-all { display: flex; align-items: center; justify-content: center; }
    .header-row .cell-size,
    .header-row .cell-time,
    .header-row .cell-type {
      text-align: center;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
    }
    .rows { flex: 1; overflow-y: auto; }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
    }
  `;_a([w()],Ri.prototype,"activePath",2);_a([w({type:Boolean})],Ri.prototype,"mobile",2);_a([$()],Ri.prototype,"_colWidths",2);_a([$()],Ri.prototype,"_showMobileMenu",2);Ri=_a([Z("file-list")],Ri);var I2=Object.defineProperty,R2=Object.getOwnPropertyDescriptor,fc=(t,e,r,i)=>{for(var s=i>1?void 0:i?R2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&I2(e,r,s),s};const L2=/[\\/:*?"<>|]/,B2=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let da=class extends G{constructor(){super(...arguments),this._name="",this._err=""}get _parent(){return T.getState().files.currentDir}_validate(t){return t?t.startsWith(".")?"不能以点开头":L2.test(t)?'含非法字符 / \\ : * ? " < > |':/\s/.test(t[0]||"")?"不能以空白开头":B2.test(t)?"Windows 保留名":"":"名称不能为空"}_onInput(t){this._name=t.target.value,this._err=this._validate(this._name)}_submit(){if(this._err)return;const t=this._parent?`${this._parent}/${this._name}`:this._name;this.dispatchEvent(new CustomEvent("submit",{detail:{path:t},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=!!this._err;return p`
      <div class="row">
        <label>在 ${this._parent||"/"} 下新建目录</label>
        <input
          autofocus
          class=${t?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${e=>e.key==="Enter"&&this._submit()}
        />
        ${t?p`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${t} @click=${this._submit}>新建</button>
      </div>
    `}};da.styles=U`
    :host { display: block; min-width: 360px; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    input.invalid { border-color: var(--cortex-danger); }
    input.invalid:focus { box-shadow: var(--cortex-focus-ring-danger); }
    .err {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;fc([$()],da.prototype,"_name",2);fc([$()],da.prototype,"_err",2);da=fc([Z("mkdir-dialog")],da);var N2=Object.defineProperty,F2=Object.getOwnPropertyDescriptor,qo=(t,e,r,i)=>{for(var s=i>1?void 0:i?F2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&N2(e,r,s),s};const H2=/[\\/:*?"<>|]/,q2=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let ms=class extends G{constructor(){super(...arguments),this.currentName="",this._name="",this._err=""}connectedCallback(){super.connectedCallback(),this._name=this.currentName,this._err=this._validate(this._name)}_validate(t){return t?t===this.currentName?"名称未变化":t.startsWith(".")?"不能以点开头":H2.test(t)?'含非法字符 / \\ : * ? " < > |':q2.test(t)?"Windows 保留名":"":"名称不能为空"}_onInput(t){this._name=t.target.value,this._err=this._validate(this._name)}_submit(){this._err||this.dispatchEvent(new CustomEvent("submit",{detail:{newName:this._name},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=!!this._err;return p`
      <div class="row">
        <label>重命名</label>
        <input
          autofocus
          class=${t?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${e=>e.key==="Enter"&&this._submit()}
        />
        ${t?p`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${t} @click=${this._submit}>重命名</button>
      </div>
    `}};ms.styles=U`
    :host { display: block; min-width: 360px; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    input.invalid { border-color: var(--cortex-danger); }
    input.invalid:focus { box-shadow: var(--cortex-focus-ring-danger); }
    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-top: 4px; }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;qo([w({type:String})],ms.prototype,"currentName",2);qo([$()],ms.prototype,"_name",2);qo([$()],ms.prototype,"_err",2);ms=qo([Z("rename-dialog")],ms);class mc extends Error{constructor(e,r,i){super(r),this.code=e,this.status=i,this.name="ReparseError"}}async function U2(){return(await pe("/api/vision/prompt")).prompt}async function j2(t,e){try{return await pe("/api/vision/reparse",{method:"POST",json:{path:t,prompt:e}})}catch(r){throw r instanceof Et?new mc(r.code,r.message,r.status):r}}async function W2(t,e){try{return await pe("/api/vision/note",{method:"POST",json:{path:t,markdown:e}})}catch(r){throw r instanceof Et?new mc(r.code,r.message,r.status):r}}var V2=Object.defineProperty,G2=Object.getOwnPropertyDescriptor,ci=(t,e,r,i)=>{for(var s=i>1?void 0:i?G2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&V2(e,r,s),s};let nr=class extends G{constructor(){super(...arguments),this.path="",this._mode="ai",this._defaultPrompt="",this._prompt="",this._promptLoading=!0,this._loading=!1,this._err=""}async connectedCallback(){super.connectedCallback();try{this._defaultPrompt=await U2(),this._mode==="ai"&&(this._prompt=this._defaultPrompt)}catch{this._err="加载默认提示词失败，请手动输入"}this._promptLoading=!1}_switchMode(t){this._loading||t===this._mode||(this._mode=t,this._err="",this._prompt=t==="ai"?this._defaultPrompt:"")}_clear(){this._loading||(this._prompt="",this._err="")}_onInput(t){this._prompt=t.target.value,this._err&&(this._err="")}async _submit(){if(!(this._loading||this._promptLoading)){if(!this._prompt.trim()){this._err=this._mode==="ai"?"提示词不能为空":"备注不能为空";return}this._err="",this._loading=!0;try{this._mode==="ai"?await j2(this.path,this._prompt):await W2(this.path,this._prompt),this.dispatchEvent(new CustomEvent("done",{bubbles:!0,composed:!0}))}catch(t){const e=t instanceof mc?`[${t.code}] `:"";this._err=`${e}${t.message??"操作失败"}`}finally{this._loading=!1}}}_cancel(){this._loading||this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=this._mode==="ai",e=!this._loading&&!this._promptLoading&&!!this._prompt.trim(),r=!!this._err,i=this._loading?t?"解析中...":"保存中...":t?"重新解析":"保存备注";return p`
      <div class="mode-tabs">
        <button class="tab ${t?"active":""}" ?disabled=${this._promptLoading}
          @click=${()=>this._switchMode("ai")}>AI 重新解析</button>
        <button class="tab ${t?"":"active"}"
          @click=${()=>this._switchMode("manual")}>手动备注</button>
      </div>
      <div class="row">
        <label>${t?"提示词（AI 按此解析图像）":"备注内容（直接作为图像解读，不调 AI，覆盖解析结果）"}</label>
        <textarea
          class=${r?"invalid":""}
          .value=${this._prompt}
          ?disabled=${this._loading||this._promptLoading}
          placeholder=${this._promptLoading?"加载默认提示词...":t?"":`输入备注 Markdown（如 # 主题
说明文字…），将覆盖 AI 解析结果`}
          @input=${this._onInput}
        ></textarea>
        ${r?p`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._clear} ?disabled=${this._loading||this._promptLoading}>清空</button>
        <span class="spacer"></span>
        <button @click=${this._cancel} ?disabled=${this._loading}>取消</button>
        <button class="primary" ?disabled=${!e} @click=${this._submit}>${i}</button>
      </div>
    `}};nr.styles=U`
    :host { display: block; min-width: 360px; max-width: 560px; }
    .mode-tabs { display: flex; gap: var(--cortex-space-2); margin-bottom: var(--cortex-space-3); }
    .mode-tabs .tab {
      flex: 1; padding: 6px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-sm); cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .mode-tabs .tab:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .mode-tabs .tab.active {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    .mode-tabs .tab:disabled { opacity: 0.4; cursor: not-allowed; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    textarea {
      width: 100%; min-height: 180px; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      box-sizing: border-box;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    textarea:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    textarea.invalid { border-color: var(--cortex-danger); }
    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-top: 4px; }
    .actions {
      display: flex; justify-content: flex-end; align-items: center;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    .actions .spacer { flex: 1; }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .actions { flex-wrap: wrap; gap: var(--cortex-space-3); }
      .actions .spacer { flex-basis: 100%; }
      .actions button { flex: 1; padding: 12px 16px; min-height: 44px; }
    }
  `;ci([w()],nr.prototype,"path",2);ci([$()],nr.prototype,"_mode",2);ci([$()],nr.prototype,"_defaultPrompt",2);ci([$()],nr.prototype,"_prompt",2);ci([$()],nr.prototype,"_promptLoading",2);ci([$()],nr.prototype,"_loading",2);ci([$()],nr.prototype,"_err",2);nr=ci([Z("reparse-dialog")],nr);var X2=Object.defineProperty,K2=Object.getOwnPropertyDescriptor,vc=(t,e,r,i)=>{for(var s=i>1?void 0:i?K2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&X2(e,r,s),s};let ua=class extends G{constructor(){super(...arguments),this._dest="",this._overwrite=!1}get _selectedCount(){return T.getState().files.selectedPaths.length}_onPickDir(t){this._dest=t.detail.path}_onToggle(t){t.stopPropagation()}_submit(){this._dest&&this.dispatchEvent(new CustomEvent("submit",{detail:{destDir:this._dest,overwrite:this._overwrite},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const{treeCache:t,expandedPaths:e}=T.getState().files,r=(t[""]||[]).filter(s=>s.is_dir),i=new Set(e);return p`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${r.map(s=>p`
          <tree-node
            .entry=${s}
            .depth=${0}
            .readonly=${!0}
            .expanded=${i.has(s.path)}
            .selected=${this._dest===s.path}
            .childEntries=${t[s.path]||[]}
            @pick-dir=${this._onPickDir}
            @toggle=${this._onToggle}
          ></tree-node>
        `)}
      </div>
      <div class="selected">目标：${this._dest||"（请选择）"}</div>
      <label class="opt">
        <input
          type="checkbox"
          .checked=${this._overwrite}
          @change=${s=>this._overwrite=s.target.checked}
        />
        覆盖同名
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${!this._dest} @click=${this._submit}>移动到这里</button>
      </div>
    `}};ua.styles=U`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); font-weight: 600; letter-spacing: -0.01em; color: var(--cortex-text); }
    .tree {
      max-height: 320px; overflow-y: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-2);
      margin: var(--cortex-space-2) 0;
    }
    .selected {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      margin-bottom: var(--cortex-space-2);
      word-break: break-all;
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    label.opt {
      display: flex; gap: var(--cortex-space-2); align-items: center;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-2) 0;
    }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .tree { max-height: 50vh; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;vc([$()],ua.prototype,"_dest",2);vc([$()],ua.prototype,"_overwrite",2);ua=vc([Z("move-dialog")],ua);var Y2=Object.defineProperty,Z2=Object.getOwnPropertyDescriptor,Uo=(t,e,r,i)=>{for(var s=i>1?void 0:i?Z2(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Y2(e,r,s),s};let vs=class extends G{constructor(){super(...arguments),this._phase="confirming",this._stats=null,this._confirmed=!1}get _selected(){return T.getState().files.selectedPaths}connectedCallback(){super.connectedCallback(),!this._stats&&this._selected.length>0&&(this._phase="loading-stats",this._loadStats())}async _loadStats(){const t=this._selected;let e=0,r=0,i=0;for(const s of t)try{const a=await jr.stats(s);e+=a.file_count,r+=a.dir_count,i+=a.total_size_bytes}catch{}e===0&&r===0&&(e=t.length),this._stats={file_count:e,dir_count:r,total_size_bytes:i},this._phase="confirming"}_fmtSize(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}_delete(){this._confirmed&&(this._phase="deleting",this.dispatchEvent(new CustomEvent("submit",{detail:{paths:this._selected},bubbles:!0,composed:!0})))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=this._selected.length;return this._phase==="loading-stats"?p`<div class="spinner">统计中…</div>`:p`
      <h3>删除 ${t>1?`${t} 项`:this._selected[0]}？</h3>
      <div class="warn"><doclens-icon name="alert-triangle"></doclens-icon> 此操作不可恢复</div>
      ${this._stats?p`
        <div class="stats">
          将永久删除：
          <ul>
            <li>• ${this._stats.file_count} 个文件</li>
            ${this._stats.dir_count>0?p`<li>• ${this._stats.dir_count} 个子文件夹</li>`:""}
            ${this._stats.total_size_bytes>0?p`<li>• 总计 ${this._fmtSize(this._stats.total_size_bytes)}</li>`:""}
          </ul>
        </div>
      `:p`<div class="stats">将永久删除 ${t} 个项目。</div>`}
      <label class="opt">
        <input
          type="checkbox"
          .checked=${this._confirmed}
          @change=${e=>this._confirmed=e.target.checked}
        />
        我确定要永久删除
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button
          class="danger"
          ?disabled=${!this._confirmed||this._phase==="deleting"}
          @click=${this._delete}>
          ${this._phase==="deleting"?"删除中…":"永久删除"}
        </button>
      </div>
    `}};vs.styles=U`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); word-break: break-all; font-weight: 600; letter-spacing: -0.01em; color: var(--cortex-text); }
    .warn {
      padding: var(--cortex-space-3);
      background: rgba(247, 185, 40, 0.10);
      border: 1px solid rgba(247, 185, 40, 0.35);
      border-left: 3px solid var(--cortex-warning);
      border-radius: var(--cortex-radius-md);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-3);
    }
    .stats {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      line-height: 1.6;
    }
    .stats ul { list-style: none; padding: 0; margin: var(--cortex-space-2) 0; }
    .stats li { padding: 2px 0; }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.danger {
      background: var(--cortex-danger);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.danger:hover:not(:disabled) { filter: brightness(1.05); }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    label.opt {
      display: flex; gap: var(--cortex-space-2); align-items: center;
      padding: var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-sm);
    }
    .spinner { color: var(--cortex-text-muted); padding: var(--cortex-space-4); text-align: center; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;Uo([$()],vs.prototype,"_phase",2);Uo([$()],vs.prototype,"_stats",2);Uo([$()],vs.prototype,"_confirmed",2);vs=Uo([Z("delete-dialog")],vs);async function J2(){return(await pe("/api/skills")).skills??[]}var Q2=Object.defineProperty,e4=Object.getOwnPropertyDescriptor,ka=(t,e,r,i)=>{for(var s=i>1?void 0:i?e4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&Q2(e,r,s),s};let Li=class extends G{constructor(){super(...arguments),this._skills=[],this._loading=!0,this._error=null,this._isMobile=!1,this._onMqlChange=t=>{this._isMobile=t.matches}}connectedCallback(){super.connectedCallback(),this._mql=window.matchMedia("(max-width: 1023px)"),this._isMobile=this._mql.matches,this._mql.addEventListener("change",this._onMqlChange),this._load()}disconnectedCallback(){var t;(t=this._mql)==null||t.removeEventListener("change",this._onMqlChange),super.disconnectedCallback()}async _load(){this._loading=!0,this._error=null;try{this._skills=await J2()}catch(t){this._error=(t==null?void 0:t.message)||"技能列表加载失败"}finally{this._loading=!1}}_onPick(t){this.dispatchEvent(new CustomEvent("pick",{detail:{skill:t},bubbles:!0,composed:!0}))}_onItemKeydown(t,e){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this._onPick(e))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}_renderBody(){return this._loading?p`<div class="empty">加载中…</div>`:this._error?p`<div class="err">${this._error}</div>`:this._skills.length===0?p`<div class="empty">暂无可用技能</div>`:this._isMobile?p`<ul class="list">
        ${this._skills.map(t=>p`
          <li
            class="item"
            role="button"
            tabindex="0"
            @click=${()=>this._onPick(t)}
            @keydown=${e=>this._onItemKeydown(e,t)}
          >
            <span class="head"><doclens-icon name=${t.icon}></doclens-icon>${t.name}</span>
            <span class="desc">${t.description}</span>
          </li>
        `)}
      </ul>`:p`<div class="grid" role="listbox">
      ${this._skills.map(t=>p`
        <button
          type="button"
          role="option"
          class="skill"
          @click=${()=>this._onPick(t)}
        >
          <span class="head"><doclens-icon name=${t.icon}></doclens-icon>${t.name}</span>
          <span class="desc">${t.description}</span>
        </button>
      `)}
    </div>`}render(){return p`
      <h3>选择技能</h3>
      ${this._renderBody()}
      <div class="actions">
        <button type="button" class="cancel" @click=${this._cancel}>取消</button>
      </div>
    `}};Li.styles=U`
    :host {
      display: block;
      /* 桌面占页面宽度 50%（2026-08-17 决议），三列卡片矩阵 */
      width: 50vw;
      max-width: 100%;
    }
    h3 {
      margin: 0 0 var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-md); font-weight: 600;
      letter-spacing: -0.01em; color: var(--cortex-text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--cortex-space-3);
      max-height: 380px;
      overflow-y: auto;
      padding: var(--cortex-space-1); /* 给卡片 hover 阴影留呼吸空间 */
    }
    /* 浮起卡片（Meta card-product-feature 风格）：大圆角 + 静态细边框平面，
       hover 抬升阴影 + 上移 2px，focus-visible 同步 */
    .skill {
      display: flex; flex-direction: column; align-items: flex-start;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-xl);
      background: var(--cortex-surface);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
    }
    .skill:hover:not(:disabled),
    .skill:focus-visible {
      border-color: var(--cortex-border);
      box-shadow: var(--cortex-shadow-md);
      transform: translateY(-2px);
      outline: none;
    }
    .skill:active:not(:disabled) { transform: translateY(0); }
    .skill:disabled { opacity: 0.4; cursor: not-allowed; }
    .head {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-sm); font-weight: 600;
      color: var(--cortex-text);
      word-break: break-all;
    }
    .head doclens-icon { flex-shrink: 0; }
    .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    /* 移动端 list item 列表（仅移动端渲染，无需媒体查询） */
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 50vh;
      overflow-y: auto;
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--cortex-space-1);
      padding: var(--cortex-space-3) var(--cortex-space-2);
      border-bottom: 1px solid var(--cortex-border-muted);
      cursor: pointer;
    }
    .item:last-child { border-bottom: none; }
    .item:hover,
    .item:focus-visible {
      background: var(--cortex-surface-muted);
      outline: none;
    }
    .item .desc {
      -webkit-line-clamp: 2;
      width: 100%;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
    }
    .err {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-4);
      text-align: center;
    }
    .actions {
      display: flex; justify-content: flex-end;
      margin-top: var(--cortex-space-4);
    }
    button.cancel {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    @media (max-width: 1023px) {
      /* border-box：dialog > * 注入的 16px 内边距计入 100% 宽度，
         否则内容比对话框宽 32px，出现横向滚动条 */
      :host { width: 100%; box-sizing: border-box; }
    }
  `;ka([$()],Li.prototype,"_skills",2);ka([$()],Li.prototype,"_loading",2);ka([$()],Li.prototype,"_error",2);ka([$()],Li.prototype,"_isMobile",2);Li=ka([Z("skill-toolbox-dialog")],Li);var t4=Object.defineProperty,r4=Object.getOwnPropertyDescriptor,jo=(t,e,r,i)=>{for(var s=i>1?void 0:i?r4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&t4(e,r,s),s};let bs=class extends G{constructor(){super(...arguments),this.skill=null,this.filePaths=[],this._prompt=""}_submit(){this.dispatchEvent(new CustomEvent("submit",{detail:{prompt:this._prompt.trim()},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=this.skill;return p`
      <h3>
        <doclens-icon name=${(t==null?void 0:t.icon)??"sparkles"}></doclens-icon>
        ${(t==null?void 0:t.name)??""}
      </h3>
      <div class="files">
        <div class="count">将处理 ${this.filePaths.length} 个文件：</div>
        <ul>
          ${this.filePaths.map(e=>p`<li title=${e}>${e}</li>`)}
        </ul>
      </div>
      <label for="skill-prompt">补充要求（可选）</label>
      <textarea
        id="skill-prompt"
        placeholder="例如：重点提取数据结论 / 用中文输出 / 简明扼要…"
        .value=${this._prompt}
        @input=${e=>this._prompt=e.target.value}
      ></textarea>
      <div class="actions">
        <button type="button" @click=${this._cancel}>取消</button>
        <button
          type="button"
          class="primary"
          ?disabled=${!t||this.filePaths.length===0}
          @click=${this._submit}
        >开始对话</button>
      </div>
    `}};bs.styles=U`
    :host { display: block; min-width: 420px; }
    h3 {
      margin: 0 0 var(--cortex-space-3) 0;
      font-size: var(--cortex-fs-md); font-weight: 600;
      letter-spacing: -0.01em; color: var(--cortex-text);
      display: flex; align-items: center; gap: var(--cortex-space-2);
    }
    .files {
      max-height: 220px; overflow-y: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      margin: var(--cortex-space-2) 0;
    }
    .files .count {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      margin-bottom: var(--cortex-space-1);
    }
    .files ul { margin: 0; padding: 0; list-style: none; }
    .files li {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text);
      padding: 2px 0;
      word-break: break-all;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin: var(--cortex-space-3) 0 4px 0;
    }
    textarea {
      width: 100%; min-height: 72px; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      font-family: inherit;
      box-sizing: border-box;
      resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: var(--cortex-surface);
      color: var(--cortex-text);
    }
    textarea:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .files { max-height: 35vh; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;jo([w({attribute:!1})],bs.prototype,"skill",2);jo([w({attribute:!1})],bs.prototype,"filePaths",2);jo([$()],bs.prototype,"_prompt",2);bs=jo([Z("skill-run-dialog")],bs);var i4=Object.defineProperty,s4=Object.getOwnPropertyDescriptor,bc=(t,e,r,i)=>{for(var s=i>1?void 0:i?s4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&i4(e,r,s),s};let ha=class extends G{constructor(){super(...arguments),this.targetDir="",this._active=!1,this._dragCounter=0,this._onDragEnter=t=>{this._hasFilesOnly(t)&&(t.preventDefault(),this._dragCounter++,this._active=!0)},this._onDragOver=t=>{this._hasFilesOnly(t)&&t.preventDefault()},this._onDragLeave=()=>{this._dragCounter--,this._dragCounter<=0&&(this._active=!1,this._dragCounter=0)},this._onDrop=t=>{if(!t.dataTransfer)return;t.preventDefault(),this._active=!1,this._dragCounter=0;const e=Array.from(t.dataTransfer.files||[]);e.length!==0&&this.dispatchEvent(new CustomEvent("drop-files",{detail:{files:e,destDir:this.targetDir},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),window.addEventListener("dragenter",this._onDragEnter),window.addEventListener("dragover",this._onDragOver),window.addEventListener("dragleave",this._onDragLeave),window.addEventListener("drop",this._onDrop)}disconnectedCallback(){window.removeEventListener("dragenter",this._onDragEnter),window.removeEventListener("dragover",this._onDragOver),window.removeEventListener("dragleave",this._onDragLeave),window.removeEventListener("drop",this._onDrop),super.disconnectedCallback()}_hasFilesOnly(t){if(!t.dataTransfer)return!1;const e=Array.from(t.dataTransfer.items||[]);return e.length===0?t.dataTransfer.types.includes("Files"):e.every(r=>r.kind==="file")}render(){return p`
      <div class="overlay ${this._active?"active":""}">
        <div><doclens-icon name="upload"></doclens-icon> 拖放以上传到</div>
        <div><doclens-icon name="folder"></doclens-icon> ${this.targetDir||"/"}</div>
      </div>
    `}};ha.styles=U`
    :host { display: contents; }
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0, 100, 224, 0.05);
      border: 2px dashed var(--cortex-primary);
      border-radius: var(--cortex-radius-lg);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: var(--cortex-space-2);
      pointer-events: none;
      z-index: 1000;
      font-size: var(--cortex-fs-lg);
      color: var(--cortex-primary);
      font-weight: 600;
    }
    .overlay.active { display: flex; }
    @media (max-width: 1023px) {
      /* 移动端不支持拖拽上传 */
      :host { display: none !important; }
    }
  `;bc([w({type:String})],ha.prototype,"targetDir",2);bc([$()],ha.prototype,"_active",2);ha=bc([Z("drop-zone")],ha);var a4=Object.defineProperty,o4=Object.getOwnPropertyDescriptor,zs=(t,e,r,i)=>{for(var s=i>1?void 0:i?o4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&a4(e,r,s),s};const n4=80,l4="按文件名搜索…";let si=class extends G{constructor(){super(...arguments),this._value="",this._isComposing=!1,this.disabled=!1,this.placeholder=l4,this.value="",this._timer=null,this._onInput=t=>{const e=t.target;if(this._value=e.value,this._value.trim()===""){this._emitClear();return}this._scheduleEmit()},this._onCompositionStart=()=>{this._isComposing=!0},this._onCompositionEnd=()=>{this._isComposing=!1,this._scheduleEmit()},this._onKeyDown=t=>{t.key==="Escape"&&(t.preventDefault(),this._emitClear())},this._onClearClick=()=>{var e;this._emitClear();const t=(e=this.shadowRoot)==null?void 0:e.querySelector("input");t==null||t.focus()}}connectedCallback(){super.connectedCallback(),this.value&&(this._value=this.value)}disconnectedCallback(){this._timer&&clearTimeout(this._timer),super.disconnectedCallback()}_emitSearch(){this.dispatchEvent(new CustomEvent("search",{detail:{query:this._value},bubbles:!0,composed:!0}))}_scheduleEmit(){this._timer&&clearTimeout(this._timer),this._timer=setTimeout(()=>{this._timer=null,this._isComposing||this._emitSearch()},n4)}_emitClear(){var e;this._timer&&(clearTimeout(this._timer),this._timer=null),this._value="";const t=(e=this.shadowRoot)==null?void 0:e.querySelector("input");t&&(t.value=""),this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){return p`
      <div class="box">
        <doclens-icon class="icon" name="search"></doclens-icon>
        <input
          type="text"
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          .value=${this._value}
          @input=${this._onInput}
          @compositionstart=${this._onCompositionStart}
          @compositionend=${this._onCompositionEnd}
          @keydown=${this._onKeyDown}
        />
        ${this._value?p`<button class="clear" title="清空" @click=${this._onClearClick}>×</button>`:""}
      </div>
    `}};si.styles=U`
    :host {
      display: block;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      background: var(--cortex-surface);
      flex-shrink: 0;
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
    }
    .box:focus-within {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .box:has(input:disabled) {
      background: var(--cortex-surface-muted);
    }
    .icon { color: var(--cortex-text-subtle); font-size: 16px; }
    input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
    }
    input::placeholder { color: var(--cortex-text-subtle); }
    input:disabled { opacity: 0.5; cursor: not-allowed; }
    button.clear {
      border: none;
      background: transparent;
      color: var(--cortex-text-subtle);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 4px;
      border-radius: var(--cortex-radius-sm);
    }
    button.clear:hover { color: var(--cortex-text); background: var(--cortex-surface-muted); }
  `;zs([$()],si.prototype,"_value",2);zs([$()],si.prototype,"_isComposing",2);zs([w({type:Boolean})],si.prototype,"disabled",2);zs([w()],si.prototype,"placeholder",2);zs([w({type:String})],si.prototype,"value",2);si=zs([Z("file-search-box")],si);var c4=Object.getOwnPropertyDescriptor,d4=(t,e,r,i)=>{for(var s=i>1?void 0:i?c4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=o(s)||s);return s};const u4=100;function h4(t,e){if(!e)return t;const r=t.toLowerCase(),i=e.toLowerCase(),s=r.indexOf(i);return s===-1?t:[t.slice(0,s),p`<mark>${t.slice(s,s+i.length)}</mark>`,t.slice(s+i.length)]}function p4(t){const e=t.lastIndexOf("/");return e===-1?"":t.slice(0,e+1)}function f4(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}function m4(t){if(!t)return"";const e=new Date(t).getTime();if(Number.isNaN(e))return"";const r=Date.now()-e,i=24*3600*1e3;return r<i?"今天":r<2*i?"昨天":r<7*i?`${Math.floor(r/i)} 天前`:r<30*i?`${Math.floor(r/(7*i))} 周前`:r<365*i?`${Math.floor(r/(30*i))} 个月前`:`${Math.floor(r/(365*i))} 年前`}let wl=class extends G{constructor(){super(...arguments),this._onKeyDown=t=>{const{results:e,selectedPath:r}=this._state;if(e.length===0){t.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}));return}const i=e.findIndex(s=>s.path===r);if(t.key==="ArrowDown"){t.preventDefault();const s=e[Math.min(e.length-1,i+1)];C.selectFilenameSearchResult(s.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else if(t.key==="ArrowUp"){t.preventDefault();const s=e[Math.max(0,i-1)];C.selectFilenameSearchResult(s.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else if(t.key==="Enter"){t.preventDefault();const s=e[i]??e[0];s&&this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else t.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}}get _state(){return T.getState().files.filenameSearch}_onRowClick(t){C.selectFilenameSearchResult(t.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:t.path},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.tabIndex=0,this.addEventListener("keydown",this._onKeyDown),this._unsubscribe=T.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var t;this.removeEventListener("keydown",this._onKeyDown),(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}render(){const{query:t,results:e,selectedPath:r,totalMatches:i}=this._state;return e.length===0?p`
        <div class="empty">
          <doclens-icon class="icon-big" name="search"></doclens-icon>
          <div>未匹配到任何文件名包含 "<b>${t}</b>" 的文档</div>
        </div>
      `:p`
      <div class="header-bar"><doclens-icon name="file"></doclens-icon> 文件名搜索结果 · 共 ${i} 项</div>
      <div class="columns">
        <span>名称 · 目录</span>
        <span>大小 · 修改</span>
      </div>
      <div class="rows">
        ${e.map(s=>{const a=p4(s.path),o=s.path===r;return p`
            <div
              class="row ${o?"active":""}"
              @click=${()=>this._onRowClick(s)}
            >
              <span class="name-cell">
                <doclens-icon class="icon" name="file"></doclens-icon>
                <span class="name">${h4(s.name,t)}</span>
                ${a?p`<span class="dir">${a}</span>`:""}
              </span>
              <span class="meta">${f4(s.size)} · ${m4(s.modifiedAt)}</span>
            </div>
          `})}
      </div>
      ${i>e.length?p`<div class="overflow-hint">共 ${i} 项，仅显示前 ${u4}，请补充关键字</div>`:""}
    `}};wl.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      min-width: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
    }
    .header-bar {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      background: var(--cortex-card-bg);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      font-size: var(--cortex-fs-xs);
      font-weight: 500;
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .rows {
      flex: 1;
      overflow-y: auto;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-sm);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .name-cell {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      min-width: 0;
    }
    .icon { flex-shrink: 0; }
    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--cortex-text);
    }
    .dir {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    mark {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8) var(--cortex-space-4);
      color: var(--cortex-text-subtle);
      text-align: center;
      gap: var(--cortex-space-2);
    }
    .empty .icon-big { font-size: 32px; opacity: 0.5; }
    .overflow-hint {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-xs);
      text-align: center;
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
  `;wl=d4([Z("file-search-results")],wl);async function Cd(){return(await pe("/api/files/documents")).documents.map(e=>({path:e.path,name:e.name,size:e.size,modifiedAt:e.modified_at}))}var v4=Object.defineProperty,b4=Object.getOwnPropertyDescriptor,lt=(t,e,r,i)=>{for(var s=i>1?void 0:i?b4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&v4(e,r,s),s};let te=class extends G{constructor(){super(...arguments),this._dialog=null,this._reparsePath="",this._pickedSkill=null,this._toast=null,this._toastTimer=null,this._previewPath="",this._previewContent="",this._previewLanguage="text",this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null,this._previewError=null,this._previewDirty=!1,this._treePaneWidth=te.TREE_PANE_WIDTH_DEFAULT,this._previewPaneWidth=te.PREVIEW_PANE_WIDTH_DEFAULT,this._fileInput=null,this._onIndexUpdated=async()=>{const t=T.getState().files.currentDir;C.invalidateDir(t),this._ensureLoaded(t);try{const e=await Cd();C.loadIndexedDocuments(e)}catch{}},this._onTreeSplitterMouseDown=t=>{t.preventDefault();const e=t.clientX,r=this._treePaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=a=>{const o=a.clientX-e,l=this.clientWidth,c=l>0?l-this._previewPaneWidth-te.MIDDLE_PANE_MIN-te.SPLITTERS_TOTAL:te.TREE_PANE_WIDTH_MAX,h=Math.min(te.TREE_PANE_WIDTH_MAX,c),f=Math.max(te.TREE_PANE_WIDTH_MIN,Math.min(h,r+o));f!==this._treePaneWidth&&(this._treePaneWidth=f)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(te.TREE_PANE_WIDTH_KEY,String(this._treePaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPreviewSplitterMouseDown=t=>{t.preventDefault();const e=t.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=a=>{const o=a.clientX-e,l=this.clientWidth,c=l>0?l-this._treePaneWidth-te.MIDDLE_PANE_MIN-te.SPLITTERS_TOTAL:te.PREVIEW_PANE_WIDTH_MAX,h=Math.min(te.PREVIEW_PANE_WIDTH_MAX,c),f=Math.max(te.PREVIEW_PANE_WIDTH_MIN,Math.min(h,r-o));f!==this._previewPaneWidth&&(this._previewPaneWidth=f)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(te.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onOpenPstEmail=async t=>{await this._previewPathWithDirtyCheck(t.detail.path),this._isMobile&&C.setMobilePane("detail")},this._onPreviewDirty=t=>{this._previewDirty=t.detail.dirty},this._onPreviewSaved=()=>{this._previewDirty=!1,this._showToast("已保存")},this._onPreviewSaveFailed=t=>{this._showToast(`保存失败：${t.detail.message}`)},this._onPreviewUploadSuccess=t=>{this._previewDirty=!1,this._showToast(`已覆盖：${t.detail.path}`),this._reloadPreview()},this._onPreviewUploadFailed=t=>{this._showToast(`上传失败：${t.detail.message}`)},this._onReparse=t=>{this._reparsePath=t.detail.path,this._dialog="reparse"},this._onReparseDone=()=>{this._dialog=null,this._showToast("已重新解析"),this._reloadPreview()},this._onPreviewBack=async()=>{if(Di(this._previewPath)){await this._previewPathWithDirtyCheck(this._previewPath.split("#")[0]);return}this._goBack()},this._onFilenameSearch=t=>{const e=t.detail.query;if(e.trim()===""){C.clearFilenameSearch();return}const{allDocs:r}=T.getState().files.filenameSearch,i=e.toLowerCase(),s=r.filter(l=>l.name.toLowerCase().includes(i));s.sort((l,c)=>l.name.toLowerCase().localeCompare(c.name.toLowerCase(),"zh",{numeric:!0,sensitivity:"base"}));const a=s.length,o=s.slice(0,100);C.setFilenameSearchQuery({query:e,results:o,totalMatches:a}),o[0]&&this._previewPathWithDirtyCheck(o[0].path)},this._onFilenameClear=()=>{C.clearFilenameSearch()},this._onFilenameResultActivated=async t=>{await this._previewPathWithDirtyCheck(t.detail.path),this._isMobile&&C.setMobilePane("detail")},this._cancelDialog=()=>{this._dialog=null}}connectedCallback(){super.connectedCallback(),this._unsubscribe=T.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),this._loadPaneWidths(),this._loadIndexedDocuments(),window.addEventListener("cortex:watch-reindexed",this._onIndexUpdated)}async _loadIndexedDocuments(){if(T.getState().files.filenameSearch.docsLoading)try{const t=await Cd();C.loadIndexedDocuments(t)}catch(t){C.setFilenameSearchDocsError((t==null?void 0:t.message)||"文档列表加载失败")}}_loadPaneWidths(){const t=localStorage.getItem(te.TREE_PANE_WIDTH_KEY);if(t){const r=Number(t);Number.isNaN(r)||(this._treePaneWidth=Math.max(te.TREE_PANE_WIDTH_MIN,Math.min(te.TREE_PANE_WIDTH_MAX,r)))}const e=localStorage.getItem(te.PREVIEW_PANE_WIDTH_KEY);if(e){const r=Number(e);Number.isNaN(r)||(this._previewPaneWidth=Math.max(te.PREVIEW_PANE_WIDTH_MIN,Math.min(te.PREVIEW_PANE_WIDTH_MAX,r)))}}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),this._toastTimer&&clearTimeout(this._toastTimer),window.removeEventListener("cortex:watch-reindexed",this._onIndexUpdated),super.disconnectedCallback()}get _state(){return T.getState().files}get _isMobile(){return typeof window<"u"&&window.innerWidth<1024}async _ensureLoaded(t){const{treeCache:e}=T.getState().files;if(!(t in e))try{C.setFilesState({listing:!0});const r=await jr.list(t);if(T.getState().files.treeCache!==e){const i=T.getState().files.treeCache;if(t in i)return;C.setFilesState({treeCache:{...i,[t]:r.entries},listing:!1});return}C.setFilesState({treeCache:{...e,[t]:r.entries},listing:!1})}catch(r){C.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"}),this._showToast((r==null?void 0:r.message)||"加载失败")}}updated(){var e;const t=(e=this.shadowRoot)==null?void 0:e.querySelector("dialog");t&&!t.open&&t.showModal()}_showToast(t){this._toast=t,this._toastTimer&&clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},3500)}_onAction(t){const e=t.detail.name;if(e==="upload"){this._openFilePicker();return}if(e==="copy-path"){this._copySelectedPaths();return}if(e==="skill-toolbox"){if(this._selectedFilePaths().length===0)return;this._pickedSkill=null,this._dialog="skill-toolbox";return}if(["mkdir","rename","move","delete"].includes(e)){if(e==="rename"&&this._state.selectedPaths.length!==1||(e==="move"||e==="delete")&&this._state.selectedPaths.length===0)return;this._dialog=e}}_selectedFilePaths(){const{treeCache:t,selectedPaths:e}=this._state,r=new Map;for(const i of Object.values(t))for(const s of i)r.set(s.path,s);return e.filter(i=>{const s=r.get(i);return s?!s.is_dir:!0})}_onSkillPick(t){this._pickedSkill=t.detail.skill,this._dialog="skill-run"}_onSkillRunSubmit(t){const e=this._pickedSkill,r=this._selectedFilePaths();if(this._dialog=null,!e||r.length===0)return;const i=[`[调用技能: ${e.name}]`,"",`请先 load_skill("${e.name}") 加载技能，然后按技能指引处理以下文件。`,"","文件：",...r.map(a=>`- ${a}`),"",`补充要求：${t.detail.prompt||"无"}`],s=r[0].split("/").pop()??r[0];C.setChatState({state:"initial",currentSession:null,messages:[],streaming:!1}),C.setPendingSkillChat({message:i.join(`
`),title:`${e.name} · ${s}`}),C.clearSelection(),C.setView("chat")}_copySelectedPaths(){const t=this._state.selectedPaths;if(t.length===0)return;const e=t.join(`
`);navigator.clipboard.writeText(e).then(()=>this._showToast(`已复制 ${t.length} 个路径`),()=>this._showToast("复制失败（剪贴板不可用）"))}_openFilePicker(){this._fileInput||(this._fileInput=document.createElement("input"),this._fileInput.type="file",this._fileInput.multiple=!0,this._fileInput.style.display="none",this._fileInput.addEventListener("change",()=>{this._fileInput&&this._fileInput.files&&this._fileInput.files.length>0&&(this._uploadFiles(Array.from(this._fileInput.files),this._state.currentDir),this._fileInput.value="")}),document.body.appendChild(this._fileInput)),this._fileInput.click()}async _onMkdirSubmit(t){this._dialog=null;try{await jr.mkdir(t.detail.path);const e=t.detail.path.includes("/")?t.detail.path.slice(0,t.detail.path.lastIndexOf("/")):"";C.invalidateDir(e),await this._ensureLoaded(e),C.expandDir(e),this._showToast("目录已创建")}catch(e){this._showToast((e==null?void 0:e.message)||"创建失败")}}async _onRenameSubmit(t){const e=this._state.selectedPaths[0];this._dialog=null;try{if(await jr.rename(e,t.detail.newName),C.invalidateDir(this._state.currentDir),await this._ensureLoaded(this._state.currentDir),this._previewPath===e){const r=e.includes("/")?e.slice(0,e.lastIndexOf("/")+1)+t.detail.newName:t.detail.newName;this._previewPath=r,this._reloadPreview()}this._showToast("已重命名")}catch(r){this._showToast((r==null?void 0:r.message)||"重命名失败")}}async _onMoveSubmit(t){const e=[...this._state.selectedPaths];this._dialog=null;try{const r=await jr.move(e,t.detail.destDir,t.detail.overwrite),i=new Set;e.forEach(s=>{i.add(s.includes("/")?s.slice(0,s.lastIndexOf("/")):"")}),i.add(t.detail.destDir),i.forEach(s=>C.invalidateDir(s));for(const s of i)await this._ensureLoaded(s);C.clearSelection(),this._showToast(r.skipped.length?`已移动 ${r.moved.length} 项，${r.skipped.length} 项跳过`:`已移动 ${r.moved.length} 项`)}catch(r){this._showToast((r==null?void 0:r.message)||"移动失败")}}async _onDeleteSubmit(t){const e=[...t.detail.paths];this._dialog=null;let r=0,i=0;for(const a of e)try{await jr.remove(a),r++,C.invalidateSubtree(a);const o=a.includes("/")?a.slice(0,a.lastIndexOf("/")):"";C.invalidateDir(o)}catch{i++}const s=new Set;e.forEach(a=>s.add(a.includes("/")?a.slice(0,a.lastIndexOf("/")):""));for(const a of s)await this._ensureLoaded(a);this._previewPath&&e.includes(this._previewPath)&&(this._previewPath="",this._previewContent="",this._previewError=null,this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null,this._previewDirty=!1),C.clearSelection(),this._showToast(i?`已删除 ${r}，失败 ${i}`:`已删除 ${r} 项`)}_onDropFiles(t){this._uploadFiles(t.detail.files,t.detail.destDir)}async _uploadFiles(t,e){let r=0,i=0,s="";for(const a of t)try{await jr.upload(a,e,!1),r++}catch(o){(o==null?void 0:o.code)==="ALREADY_EXISTS"?i++:s=(o==null?void 0:o.message)||"上传失败"}if(C.invalidateDir(e),await this._ensureLoaded(e),s&&r===0)this._showToast(s);else{const a=[`已上传 ${r}`];i>0&&a.push(`跳过 ${i}`),s&&a.push("部分失败"),this._showToast(a.join("，"))}}_goBack(){const t=this._state.mobilePane;t==="detail"?this._isFilenameSearchActive?C.setMobilePane("tree"):C.setMobilePane("list"):t==="list"&&C.setMobilePane("tree")}async _onFileListActivated(t){if(t.detail.is_dir){C.selectDir(t.detail.path),await this._ensureLoaded(t.detail.path);return}await this._previewPathWithDirtyCheck(t.detail.path),this._isMobile&&C.setMobilePane("detail")}async _previewPathWithDirtyCheck(t){if(this._previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await this._fetchPreview(t)}async _fetchPreview(t){if(Zr(t)){this._previewError=null,this._previewPath=t,this._previewContent="",this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null;return}const e=await ps(t);e.ok?(this._previewError=null,this._previewPath=e.path,this._previewContent=e.content,this._previewLanguage=e.language,this._previewWritable=e.writable,this._previewPages=e.pages,this._previewAttachments=e.attachments):e.notIndexed?(this._previewError="NOT_INDEXED",this._previewPath=t,this._previewContent="",this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null):this._showToast(e.message||"预览失败")}async _reloadPreview(){if(!this._previewPath)return;const t=await ps(this._previewPath);t.ok&&(this._previewContent=t.content,this._previewLanguage=t.language,this._previewWritable=t.writable,this._previewPages=t.pages,this._previewAttachments=t.attachments)}_discardPreviewEdits(){var e,r;const t=(e=this.shadowRoot)==null?void 0:e.querySelector("preview-pane");(r=t==null?void 0:t.discard)==null||r.call(t),this._previewDirty=!1}_renderNotIndexedHint(){return p`<div class="preview-placeholder">
      该文件未索引，无法预览。<br>
      请先执行 doclens index 后重试。
    </div>`}_renderPreviewPane(t={}){return this._previewError==="NOT_INDEXED"?this._renderNotIndexedHint():this._previewPath?Zr(this._previewPath)?p`<pst-email-list
        .pstPath=${this._previewPath}
        ?showBack=${t.mobile??!1}
        @open-email=${this._onOpenPstEmail}
        @back=${()=>this._goBack()}
      ></pst-email-list>`:p`<preview-pane
      ?noHeader=${t.noHeader??!1}
      ?mobile=${t.mobile??!1}
      ?enableReparse=${!0}
      path=${this._previewPath}
      language=${this._previewLanguage}
      content=${this._previewContent}
      ?writable=${this._previewWritable}
      .pages=${this._previewPages}
      .attachments=${this._previewAttachments}
      ?showBack=${Di(this._previewPath)}
      backLabel="邮件列表"
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}
      @reparse=${this._onReparse}
      @back=${this._onPreviewBack}
    ></preview-pane>`:p`<div class="preview-placeholder">点击文件预览</div>`}get _searchBoxState(){const t=T.getState().files.filenameSearch,e=!t.docsLoading&&t.allDocs.length===0,r=t.docsError!==null||e,i=t.docsError!==null?"文档列表加载失败":e?"暂无已索引文档":"按文件名搜索…";return{disabled:r,placeholder:i}}get _isFilenameSearchActive(){return T.getState().files.filenameSearch.isActive}render(){return p`
      ${this._isMobile?this._renderMobile():this._renderDesktop()}
      ${this._renderDialogs()}
      <drop-zone .targetDir=${this._state.currentDir} @drop-files=${this._onDropFiles}></drop-zone>
      ${this._toast?p`<div class="toast" @click=${()=>this._toast=null}>${this._toast}</div>`:""}
    `}_renderDesktop(){const{disabled:t,placeholder:e}=this._searchBoxState;return p`
      <div
        class="desktop-layout"
        style="--tree-pane-width: ${this._treePaneWidth}px; --preview-pane-width: ${this._previewPaneWidth}px"
      >
        <aside class="tree-pane">
          <file-search-box
            .value=${T.getState().files.filenameSearch.query}
            ?disabled=${t}
            .placeholder=${e}
            @search=${this._onFilenameSearch}
            @clear=${this._onFilenameClear}
          ></file-search-box>
          <file-tree></file-tree>
        </aside>
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整文件树栏宽度"
          @mousedown=${this._onTreeSplitterMouseDown}
        ></div>
        ${this._isFilenameSearchActive?p`<file-search-results
              @activated=${this._onFilenameResultActivated}
              @clear=${this._onFilenameClear}
            ></file-search-results>`:p`<file-list
              .activePath=${this._previewPath}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
            ></file-list>`}
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整预览栏宽度"
          @mousedown=${this._onPreviewSplitterMouseDown}
        ></div>
        <div class="preview-col">${this._renderPreviewPane({noHeader:!1})}</div>
      </div>
    `}_renderMobile(){const t=this._state.mobilePane,e=this._searchBoxState;return p`
      <div class="mobile-layout">
        ${t==="tree"?p`
              <file-search-box
                .value=${T.getState().files.filenameSearch.query}
                ?disabled=${e.disabled}
                .placeholder=${e.placeholder}
                @search=${this._onFilenameSearch}
                @clear=${this._onFilenameClear}
              ></file-search-box>
              ${this._isFilenameSearchActive?p`<file-search-results
                    @activated=${this._onFilenameResultActivated}
                    @clear=${this._onFilenameClear}
                  ></file-search-results>`:p`<file-tree
                    @select-dir=${async r=>{C.selectDir(r.detail.path),await this._ensureLoaded(r.detail.path),C.expandDir(r.detail.path),C.setMobilePane("list")}}
                  ></file-tree>`}
            `:""}
        ${t==="list"?p`<file-list
              .activePath=${this._previewPath}
              ?mobile=${!0}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
              @back=${()=>this._goBack()}
            ></file-list>`:""}
        ${t==="detail"?p`<div class="mobile-preview">${this._renderPreviewPane({mobile:!0})}</div>`:""}
      </div>
    `}_renderDialogs(){if(this._dialog==="mkdir")return p`<dialog @cancel=${this._cancelDialog}>
        <mkdir-dialog
          @submit=${this._onMkdirSubmit}
          @cancel=${this._cancelDialog}
        ></mkdir-dialog>
      </dialog>`;if(this._dialog==="rename"){const e=(this._state.selectedPaths[0]||"").split("/").pop()||"";return p`<dialog @cancel=${this._cancelDialog}>
        <rename-dialog
          .currentName=${e}
          @submit=${this._onRenameSubmit}
          @cancel=${this._cancelDialog}
        ></rename-dialog>
      </dialog>`}return this._dialog==="move"?p`<dialog @cancel=${this._cancelDialog}>
        <move-dialog
          @submit=${this._onMoveSubmit}
          @cancel=${this._cancelDialog}
        ></move-dialog>
      </dialog>`:this._dialog==="delete"?p`<dialog @cancel=${this._cancelDialog}>
        <delete-dialog
          @submit=${this._onDeleteSubmit}
          @cancel=${this._cancelDialog}
        ></delete-dialog>
      </dialog>`:this._dialog==="reparse"?p`<dialog @cancel=${this._cancelDialog}>
        <reparse-dialog
          .path=${this._reparsePath}
          @done=${this._onReparseDone}
          @cancel=${this._cancelDialog}
        ></reparse-dialog>
      </dialog>`:this._dialog==="skill-toolbox"?p`<dialog @cancel=${this._cancelDialog}>
        <skill-toolbox-dialog
          @pick=${this._onSkillPick}
          @cancel=${this._cancelDialog}
        ></skill-toolbox-dialog>
      </dialog>`:this._dialog==="skill-run"?p`<dialog @cancel=${this._cancelDialog}>
        <skill-run-dialog
          .skill=${this._pickedSkill}
          .filePaths=${this._selectedFilePaths()}
          @submit=${this._onSkillRunSubmit}
          @cancel=${this._cancelDialog}
        ></skill-run-dialog>
      </dialog>`:p``}};te.TREE_PANE_WIDTH_KEY="cortex.files.treePaneWidth";te.TREE_PANE_WIDTH_DEFAULT=240;te.TREE_PANE_WIDTH_MIN=180;te.TREE_PANE_WIDTH_MAX=720;te.PREVIEW_PANE_WIDTH_KEY="cortex.files.previewPaneWidth";te.PREVIEW_PANE_WIDTH_DEFAULT=320;te.PREVIEW_PANE_WIDTH_MIN=240;te.PREVIEW_PANE_WIDTH_MAX=1600;te.MIDDLE_PANE_MIN=300;te.SPLITTERS_TOTAL=8;te.styles=U`
    :host {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .desktop-layout {
      flex: 1;
      display: grid;
      grid-template-columns:
        var(--tree-pane-width, 240px)
        4px
        minmax(0, 1fr)
        4px
        var(--preview-pane-width, 320px);
      min-height: 0;
      min-width: 0;
    }
    .splitter {
      cursor: col-resize;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
      min-height: 0;
    }
    .splitter:hover, .splitter:active { background: var(--cortex-primary); }
    .tree-pane {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .tree-pane file-tree {
      flex: 1;
      min-height: 0;
    }
    .mobile-layout {
      /* display:flex 让子元素(file-tree/file-list/.mobile-preview)的
         flex:1 生效，提供明确高度链。缺少这个会导致 .mobile-preview
         高度塌陷（因为 block 容器内 flex:1 无效），进而让 preview-pane
         内的 md-viewer（flex:1 1 0）塌陷为 0，预览内容不可见。 */
      display: flex; flex-direction: column;
      flex: 1; min-height: 0; position: relative;
    }
    .mobile-layout file-tree,
    .mobile-layout file-list,
    .mobile-layout file-search-results,
    .mobile-layout .mobile-preview {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .preview-col {
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border);
      overflow: hidden;
    }
    .preview-placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8);
      margin: var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-lg);
      color: var(--cortex-text-subtle);
      text-align: center;
      font-size: var(--cortex-fs-base);
    }
    .mobile-preview {
      flex: 1; min-height: 0; display: flex; flex-direction: column;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      /* border-box：移动端 width:100vw 时边框不额外撑出屏幕 */
      box-sizing: border-box;
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 360px;
      max-width: 90vw;
    }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0;
        /* 移动端对话框占满屏幕宽度（2026-08-17 决议） */
        width: 100vw;
        max-width: 100vw;
        max-height: calc(100vh - 16px);
        border-radius: var(--cortex-radius-md);
      }
      dialog > * { padding: var(--cortex-space-4); }
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    .toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: var(--cortex-text);
      color: var(--cortex-surface);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10000;
      cursor: pointer;
    }
    .back-btn {
      position: absolute; top: var(--cortex-space-2); left: var(--cortex-space-2);
      padding: 6px 12px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      z-index: 5;
      font-size: var(--cortex-fs-sm);
    }
    @media (max-width: 1023px) {
      .desktop-layout { display: none; }
    }
    @media (min-width: 1024px) {
      .mobile-layout { display: none; }
    }
  `;lt([$()],te.prototype,"_dialog",2);lt([$()],te.prototype,"_reparsePath",2);lt([$()],te.prototype,"_pickedSkill",2);lt([$()],te.prototype,"_toast",2);lt([$()],te.prototype,"_previewPath",2);lt([$()],te.prototype,"_previewContent",2);lt([$()],te.prototype,"_previewLanguage",2);lt([$()],te.prototype,"_previewWritable",2);lt([$()],te.prototype,"_previewPages",2);lt([$()],te.prototype,"_previewAttachments",2);lt([$()],te.prototype,"_previewError",2);lt([$()],te.prototype,"_previewDirty",2);lt([$()],te.prototype,"_treePaneWidth",2);lt([$()],te.prototype,"_previewPaneWidth",2);te=lt([Z("files-view")],te);const Hr=t=>`/api/diary${t}`,qr={today:()=>pe(Hr("/today")),entry:t=>pe(Hr(`/entry?date=${encodeURIComponent(t)}`)),calendar:t=>pe(Hr(`/calendar?month=${encodeURIComponent(t)}`)),addText:t=>pe(Hr("/fragments"),{method:"POST",json:{text:t}}),uploadPhoto:(t,e)=>{const r=new FormData;return r.append("file",t),r.append("caption",e),pe(Hr("/photos"),{method:"POST",body:r})},removeFragment:(t,e)=>pe(Hr(`/fragments/${encodeURIComponent(e)}?date=${encodeURIComponent(t)}`),{method:"DELETE"}),editFragment:(t,e,r)=>pe(Hr(`/fragments/${encodeURIComponent(e)}?date=${encodeURIComponent(t)}`),{method:"PUT",json:{text:r}}),setCity:(t,e)=>pe(Hr(`/city?date=${encodeURIComponent(t)}&city=${encodeURIComponent(e)}`),{method:"POST"})};var g4=Object.defineProperty,x4=Object.getOwnPropertyDescriptor,di=(t,e,r,i)=>{for(var s=i>1?void 0:i?x4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&g4(e,r,s),s};const y4=["一","二","三","四","五","六","日"];function Xr(t){const[e,r,i]=t.split("-").map(Number);return new Date(e,r-1,i)}function zh(t){const e=String(t.getMonth()+1).padStart(2,"0"),r=String(t.getDate()).padStart(2,"0");return`${t.getFullYear()}-${e}-${r}`}function Ys(t){return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`}function Ed(t,e){const r=Xr(t);return r.setDate(r.getDate()+e),zh(r)}function w4(t,e){const r=Xr(`${t}-01`);return r.setMonth(r.getMonth()+e),Ys(r)}const _4=["星期一","星期二","星期三","星期四","星期五","星期六","星期日"];function k4(t){return _4[(Xr(t).getDay()+6)%7]}let lr=class extends G{constructor(){super(...arguments),this.month="",this.dates=[],this.selected="",this.today="",this._view="days",this._pickerYear=0,this._yearStart=0}_shiftMonth(t){this.dispatchEvent(new CustomEvent("month-change",{detail:{month:w4(this.month,t)},bubbles:!0,composed:!0}))}_select(t){this.dispatchEvent(new CustomEvent("select-date",{detail:{date:t},bubbles:!0,composed:!0}))}_dispatchMonth(t){this.dispatchEvent(new CustomEvent("month-change",{detail:{month:t},bubbles:!0,composed:!0}))}_currentYear(){return Number(this.month.split("-")[0])||new Date().getFullYear()}_titleClick(){if(this._view==="days")this._pickerYear=this._currentYear(),this._view="months";else if(this._view==="months"){const t=this._pickerYear;this._yearStart=t-t%12,this._view="years"}else this._view="days"}_shiftPickerYear(t){this._pickerYear+=t}_shiftYearRange(t){this._yearStart+=t*12}_pickYear(t){this._pickerYear=t,this._view="months"}_pickMonth(t){const e=String(t).padStart(2,"0");this._dispatchMonth(`${this._pickerYear}-${e}`),this._view="days"}_cells(){const t=Xr(`${this.month}-01`),e=new Date(t.getFullYear(),t.getMonth()+1,0).getDate(),r=(t.getDay()+6)%7,i=[];for(let s=0;s<r;s++)i.push(null);for(let s=1;s<=e;s++)i.push({date:`${this.month}-${String(s).padStart(2,"0")}`,day:s,other:!1});return i}render(){return p`
      <div class="cal-head">${this._renderHead()}</div>
      ${this._view==="days"?this._renderDays():this._view==="months"?this._renderMonths():this._renderYears()}
    `}_renderHead(){if(this._view==="months")return p`
        <button class="nav-btn" aria-label="上一年" @click=${()=>this._shiftPickerYear(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <button class="cal-title" @click=${()=>this._titleClick()}>${this._pickerYear} 年</button>
        <button class="nav-btn" aria-label="下一年" @click=${()=>this._shiftPickerYear(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      `;if(this._view==="years"){const r=this._yearStart+11;return p`
        <button class="nav-btn" aria-label="上一年代" @click=${()=>this._shiftYearRange(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <button class="cal-title" @click=${()=>this._titleClick()}>${this._yearStart}–${r}</button>
        <button class="nav-btn" aria-label="下一年代" @click=${()=>this._shiftYearRange(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      `}const[t,e]=this.month.split("-");return p`
      <button class="nav-btn" aria-label="上一月" @click=${()=>this._shiftMonth(-1)}>
        <doclens-icon name="chevron-left"></doclens-icon>
      </button>
      <button class="cal-title" @click=${()=>this._titleClick()}>
        ${Number(t)} 年 ${Number(e)} 月
      </button>
      <button class="nav-btn" aria-label="下一月" @click=${()=>this._shiftMonth(1)}>
        <doclens-icon name="chevron-right"></doclens-icon>
      </button>
    `}_renderDays(){const t=new Set(this.dates);return p`
      <div class="grid">
        ${y4.map(e=>p`<span class="wd">${e}</span>`)}
        ${this._cells().map(e=>e===null?p`<span></span>`:p`
                <button
                  class="day ${e.date===this.selected?"selected":""}"
                  ?disabled=${this.today!==""&&e.date>this.today}
                  @click=${()=>this._select(e.date)}>
                  ${e.day}
                  ${t.has(e.date)?p`<span class="dot"></span>`:null}
                </button>`)}
      </div>
    `}_renderMonths(){const[t,e]=this.today?this.today.split("-").map(Number):[0,0],r=this.month;return p`
      <div class="pick-grid">
        ${Array.from({length:12},(i,s)=>{const a=s+1,o=String(a).padStart(2,"0"),l=`${this._pickerYear}-${o}`,c=this.today!==""&&(this._pickerYear>t||this._pickerYear===t&&a>e);return p`
            <button
              class="pick-cell ${l===r?"selected":""}"
              ?disabled=${c}
              @click=${()=>this._pickMonth(a)}>${a} 月</button>
          `})}
      </div>
    `}_renderYears(){const t=this._currentYear(),e=this.today?Number(this.today.split("-")[0]):0;return p`
      <div class="pick-grid">
        ${Array.from({length:12},(r,i)=>{const s=this._yearStart+i;return p`
            <button
              class="pick-cell ${s===t?"selected":""}"
              ?disabled=${this.today!==""&&s>e}
              @click=${()=>this._pickYear(s)}>${s}</button>
          `})}
      </div>
    `}};lr.styles=U`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: block;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      box-shadow: var(--cortex-shadow-md);
      padding: var(--cortex-space-3, 12px);
    }
    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--cortex-space-2, 8px);
    }
    .cal-title {
      font-weight: 600;
      font-size: 15px;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--cortex-radius-pill, 100px);
    }
    .cal-title:hover { background: var(--cortex-surface-muted); }
    .nav-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill, 100px);
    }
    .nav-btn:hover { background: var(--cortex-surface-muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .wd {
      text-align: center;
      font-size: 12px;
      color: var(--cortex-text-muted);
      padding: 4px 0;
    }
    .day {
      position: relative;
      border: none;
      background: transparent;
      cursor: pointer;
      min-height: 44px;             /* 触控目标 ≥44px */
      border-radius: var(--cortex-radius-md, 8px);
      font-size: 14px;
      color: var(--cortex-text);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .day:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .day.other { color: var(--cortex-text-muted); opacity: 0.4; }
    .day:disabled { color: var(--cortex-text-muted); opacity: 0.35; cursor: default; }
    .day.selected {
      background: var(--cortex-primary);
      color: #fff;
      font-weight: 700;
    }
    .day .dot {
      position: absolute;
      bottom: 6px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--cortex-primary);
    }
    .day.selected .dot { background: #fff; }
    /* 月份/年份快速选择网格（4 列） */
    .pick-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2px;
    }
    .pick-cell {
      min-height: 44px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: var(--cortex-radius-md, 8px);
      font-size: 14px;
      color: var(--cortex-text);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pick-cell:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .pick-cell:disabled { color: var(--cortex-text-muted); opacity: 0.35; cursor: default; }
    .pick-cell.selected {
      background: var(--cortex-primary);
      color: #fff;
      font-weight: 700;
    }
  `;di([w()],lr.prototype,"month",2);di([w({attribute:!1})],lr.prototype,"dates",2);di([w()],lr.prototype,"selected",2);di([w()],lr.prototype,"today",2);di([$()],lr.prototype,"_view",2);di([$()],lr.prototype,"_pickerYear",2);di([$()],lr.prototype,"_yearStart",2);lr=di([Z("diary-calendar")],lr);var S4=Object.defineProperty,z4=Object.getOwnPropertyDescriptor,vr=(t,e,r,i)=>{for(var s=i>1?void 0:i?z4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&S4(e,r,s),s};let Lt=class extends G{constructor(){super(...arguments),this.entry=null,this.submitting=!1,this.city="",this._pendingFile=null,this._pendingPreviewUrl="",this._confirmingFid="",this._editingFid="",this._editText="",this._viewerSrc=""}_onSubmitText(t){this.dispatchEvent(new CustomEvent("submit-text",{detail:{value:t.detail.value},bubbles:!0,composed:!0}));const e=t.target;e.value=""}_onCityTag(){this.dispatchEvent(new CustomEvent("city-change",{bubbles:!0,composed:!0}))}_pickPhoto(t){const e=this.renderRoot.querySelector(t?"input[data-capture]":"input[data-gallery]");e==null||e.click()}_onFileChange(t){var i;const e=t.target,r=(i=e.files)==null?void 0:i[0];e.value="",r&&(this._pendingPreviewUrl&&URL.revokeObjectURL(this._pendingPreviewUrl),this._pendingFile=r,this._pendingPreviewUrl=URL.createObjectURL(r))}_cancelPending(){this._pendingPreviewUrl&&URL.revokeObjectURL(this._pendingPreviewUrl),this._pendingFile=null,this._pendingPreviewUrl=""}_confirmPending(){var r;if(!this._pendingFile)return;const t=((r=this.renderRoot.querySelector(".caption"))==null?void 0:r.value.trim())??"",e=this._pendingFile;this._cancelPending(),this.dispatchEvent(new CustomEvent("upload-photo",{detail:{file:e,caption:t},bubbles:!0,composed:!0}))}_onDelete(t){if(this._confirmingFid!==t){this._confirmingFid=t;return}this._confirmingFid="",this.dispatchEvent(new CustomEvent("delete-fragment",{detail:{fid:t},bubbles:!0,composed:!0}))}_onEdit(t,e){this._confirmingFid="",this._editingFid=t,this._editText=e}_onCancelEdit(){this._editingFid="",this._editText=""}_onSaveEdit(t){const e=this._editText;this.dispatchEvent(new CustomEvent("edit-fragment",{detail:{fid:t,text:e},bubbles:!0,composed:!0})),this._editingFid="",this._editText=""}_renderFragment(t){const e=this._confirmingFid===t.fid,r=this._editingFid===t.fid;return p`
      <li class="frag">
        <span class="node"></span>
        <div class="frag-content">
          <div class="frag-meta">
            <span class="time">${t.time}</span>
            <div class="frag-actions">
              ${r?null:p`<button class="icon-btn" title="编辑" @click=${()=>this._onEdit(t.fid,t.kind==="photo"&&t.text==="照片"?"":t.text)}>
                    <doclens-icon name="pencil" style="font-size:16px"></doclens-icon>
                  </button>`}
              <button
                class="del-btn ${e?"confirming":""}"
                title="删除片段"
                @click=${()=>this._onDelete(t.fid)}>
                ${e?p`确认删除`:p`<doclens-icon name="trash-2" style="font-size:16px"></doclens-icon>`}
              </button>
            </div>
          </div>
          <div class="frag-body">${r?p`<textarea
                  class="edit-area"
                  .value=${this._editText}
                  @input=${i=>this._editText=i.target.value}></textarea>
                <div class="edit-actions">
                  <button class="save-btn" ?disabled=${this.submitting} @click=${()=>this._onSaveEdit(t.fid)}>${this.submitting?"保存中…":"保存"}</button>
                  <button class="cancel-btn" ?disabled=${this.submitting} @click=${()=>this._onCancelEdit()}>取消</button>
                </div>`:t.kind==="photo"&&t.image_url?p`<div class="photo-wrap">
                  <img src=${t.image_url} alt=${t.text} loading="lazy"
                       @click=${()=>this._viewerSrc=t.image_url} />
                  <button class="expand-btn" title="全屏查看"
                          @click=${()=>this._viewerSrc=t.image_url}>
                    <doclens-icon name="maximize-2" style="font-size:14px"></doclens-icon>
                  </button>
                </div>
                ${t.text&&t.text!=="照片"?p`<div class="caption">${t.text}</div>`:null}`:t.text}</div>
        </div>
      </li>
    `}render(){var e;const t=[...((e=this.entry)==null?void 0:e.fragments)??[]].reverse();return p`
      <input-box
        class="text-input"
        multiline
        buttonLabel="记录"
        placeholder="记录此刻…（Enter 发送，Shift+Enter 换行）"
        ?disabled=${this.submitting}
        @submit=${this._onSubmitText}></input-box>
      <div class="photo-btns">
        ${this.city?p`<button class="city-tag" title="更换城市" @click=${()=>this._onCityTag()}>📍 ${this.city}</button>`:null}
        <button class="photo-btn" ?disabled=${this.submitting} @click=${()=>this._pickPhoto(!0)}>
          <doclens-icon name="camera" style="font-size:18px"></doclens-icon>拍照
        </button>
        <button class="photo-btn" ?disabled=${this.submitting} @click=${()=>this._pickPhoto(!1)}>
          <doclens-icon name="image" style="font-size:18px"></doclens-icon>相册
        </button>
      </div>
      <input type="file" data-capture accept="image/*" capture="environment" hidden @change=${this._onFileChange} />
      <input type="file" data-gallery accept="image/*" hidden @change=${this._onFileChange} />

      ${this._pendingFile?p`
        <div class="pending-photo">
          <img src=${this._pendingPreviewUrl} alt="待上传照片" />
          <input class="caption" placeholder="给照片加条备注（可选）" maxlength="200" />
          <button class="confirm-btn" ?disabled=${this.submitting} @click=${this._confirmPending}>
            ${this.submitting?"上传中…":"上传"}
          </button>
          <button class="cancel-btn" title="取消" @click=${this._cancelPending}>
            <doclens-icon name="x" style="font-size:18px"></doclens-icon>
          </button>
        </div>`:null}

      ${t.length>0?p`<ul class="timeline">
            ${t.map(r=>this._renderFragment(r))}
          </ul>`:p`<div class="empty-hint">今天还没有记录，写下第一条吧</div>`}

      ${this._viewerSrc?p`<image-viewer
        .src=${this._viewerSrc}
        @close=${()=>this._viewerSrc=""}></image-viewer>`:null}
    `}};Lt.styles=U`
    :host { display: block; box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    .text-input {
      display: block;
      /* 记录页输入框更紧凑：矮一点 + 上下 padding 收窄（默认 48px/11px 偏空旷） */
      --min-h: 36px;
      --cortex-input-pad-y: 6px;
    }
    .photo-btns {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--cortex-space-2, 8px);
      margin-top: var(--cortex-space-2, 8px);
    }
    .city-tag {
      margin-right: auto;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 13px;
      padding: 0;
      white-space: nowrap;
    }
    .city-tag:hover { color: var(--cortex-primary); }
    .photo-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      padding: 0 14px;
      font-size: 14px;
    }
    .photo-btn:hover { background: var(--cortex-surface-muted); }
    .photo-btn:disabled { opacity: 0.5; cursor: default; }

    /* 待上传照片：备注输入条 */
    .pending-photo {
      margin-top: var(--cortex-space-3, 12px);
      display: flex;
      gap: var(--cortex-space-3, 12px);
      align-items: center;
      padding: var(--cortex-space-3, 12px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      background: var(--cortex-surface);
    }
    .pending-photo img {
      width: 72px;
      height: 72px;
      object-fit: cover;
      border-radius: var(--cortex-radius-md, 8px);
      flex-shrink: 0;
    }
    .pending-photo .caption {
      flex: 1;
      min-width: 0;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md, 8px);
      font-size: 14px;
      background: var(--cortex-bg);
      color: var(--cortex-text);
    }
    .pending-photo .caption:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .confirm-btn {
      min-height: 44px;
      padding: 0 18px;
      border: none;
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-primary);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .confirm-btn:disabled { opacity: 0.5; cursor: default; }
    .cancel-btn {
      min-width: 44px;
      min-height: 44px;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cancel-btn:hover { background: var(--cortex-surface-muted); }

    /* 今日片段时间线（时间轴模式，最新在上）：钴蓝圆点节点 + 节点间连接轴线 */
    .timeline {
      list-style: none;
      margin: var(--cortex-space-4, 16px) 0 0;
      padding: 0;
    }
    .frag {
      display: grid;
      grid-template-columns: 24px 1fr;
      column-gap: var(--cortex-space-2, 8px);
      position: relative;
      padding-bottom: var(--cortex-space-4, 16px);
    }
    .frag:last-child { padding-bottom: 0; }
    /* 节点间连接轴线（最后一条不画） */
    .frag::before {
      content: "";
      position: absolute;
      left: 11px;
      top: 20px;
      bottom: 0;
      width: 2px;
      background: var(--cortex-border-muted, var(--cortex-border));
    }
    .frag:last-child::before { display: none; }
    .node {
      grid-column: 1;
      align-self: start;
      width: 10px;
      height: 10px;
      margin: 6px 0 0 7px;
      border-radius: 50%;
      background: var(--cortex-primary);
      position: relative;
      z-index: 1;
    }
    .frag-content {
      grid-column: 2;
      min-width: 0;
    }
    .frag-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2, 8px);
      margin-bottom: 2px;
    }
    .frag-meta .time {
      font-size: 12px;
      font-weight: 600;
      color: var(--cortex-text-muted);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .frag-body {
      font-size: 15px;
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .frag-body img {
      max-width: 100%;
      max-height: 240px;
      margin-top: var(--cortex-space-1, 4px);
      border-radius: var(--cortex-radius-md, 8px);
      display: block;
      cursor: zoom-in;
    }
    .photo-wrap {
      position: relative;
      display: inline-block;
      margin-top: var(--cortex-space-1, 4px);
      white-space: normal; /* 覆盖 .frag-body 的 pre-wrap，避免模板空白撑高 */
    }
    .photo-wrap img { margin-top: 0; }
    .expand-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .frag-body .caption {
      font-size: 13px;
      color: var(--cortex-text-muted);
      margin-top: var(--cortex-space-1, 4px);
    }
    .del-btn {
      flex-shrink: 0;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }
    .del-btn:hover { background: var(--cortex-surface-muted); color: var(--cortex-nav-active); }
    .del-btn.confirming { color: #fff; background: var(--cortex-nav-active); padding: 0 12px; }
    .frag-actions { display: flex; align-items: center; gap: 2px; }
    .icon-btn {
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-btn:hover { background: var(--cortex-surface-muted); color: var(--cortex-primary); }
    .edit-area {
      width: 100%;
      min-height: 72px;
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md, 8px);
      background: var(--cortex-bg);
      color: var(--cortex-text);
      font-family: var(--cortex-font);
      font-size: 15px;
      line-height: 1.6;
      resize: vertical;
    }
    .edit-area:focus { outline: none; border-color: var(--cortex-primary); }
    .edit-actions {
      display: flex;
      gap: var(--cortex-space-2, 8px);
      margin-top: var(--cortex-space-2, 8px);
    }
    .save-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 0 14px;
      border: none;
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-primary);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .save-btn:disabled { opacity: 0.5; cursor: default; }
    .cancel-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 0 14px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: 14px;
      cursor: pointer;
    }
    .cancel-btn:disabled { opacity: 0.5; cursor: default; }
    .empty-hint {
      color: var(--cortex-text-muted);
      font-size: 14px;
      text-align: center;
      padding: var(--cortex-space-6, 24px) 0;
    }
  `;vr([w({attribute:!1})],Lt.prototype,"entry",2);vr([w({type:Boolean})],Lt.prototype,"submitting",2);vr([w()],Lt.prototype,"city",2);vr([$()],Lt.prototype,"_pendingFile",2);vr([$()],Lt.prototype,"_pendingPreviewUrl",2);vr([$()],Lt.prototype,"_confirmingFid",2);vr([$()],Lt.prototype,"_editingFid",2);vr([$()],Lt.prototype,"_editText",2);vr([$()],Lt.prototype,"_viewerSrc",2);Lt=vr([Z("diary-record-panel")],Lt);var $4=Object.defineProperty,T4=Object.getOwnPropertyDescriptor,ui=(t,e,r,i)=>{for(var s=i>1?void 0:i?T4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&$4(e,r,s),s};let cr=class extends G{constructor(){super(...arguments),this.date="",this.today="",this.entry=null,this.loading=!1,this.calendarOpen=!1,this.calendarMonth="",this.calendarDates=[]}_nav(t){this.dispatchEvent(new CustomEvent("navigate-day",{detail:{delta:t},bubbles:!0,composed:!0}))}_toggleCalendar(){this.dispatchEvent(new CustomEvent("toggle-calendar",{bubbles:!0,composed:!0}))}_renderBody(){var t;if(this.loading)return p`<div class="content loading">加载中…</div>`;if(!this.entry||this.entry.state!=="summarized"){const e=((t=this.entry)==null?void 0:t.state)==="raw"?"这一天的日记尚未整理成文":"这一天没有日记";return p`<div class="empty">${e}</div>`}return p`<md-viewer .content=${this.entry.content}></md-viewer>`}render(){const t=this.date===this.today;return p`
      <div class="nav-row">
        <button class="nav-btn" @click=${()=>this._nav(-1)}>
          <doclens-icon name="chevron-left" style="font-size:16px"></doclens-icon>前一天
        </button>
        <button class="date-btn" @click=${this._toggleCalendar}>
          <doclens-icon name="calendar" style="font-size:16px"></doclens-icon>
          ${this.date} ${k4(this.date)}${t?"（今天）":""}
        </button>
        <button class="nav-btn" ?disabled=${t} @click=${()=>this._nav(1)}>
          后一天<doclens-icon name="chevron-right" style="font-size:16px"></doclens-icon>
        </button>
      </div>
      ${this.calendarOpen?p`
        <div class="cal-pop">
          <diary-calendar
            .month=${this.calendarMonth}
            .dates=${this.calendarDates}
            .selected=${this.date}
            .today=${this.today}></diary-calendar>
        </div>`:null}
      ${this._renderBody()}
    `}};cr.styles=U`
    :host { display: block; position: relative; box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    .nav-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2, 8px);
      margin-bottom: var(--cortex-space-4, 16px);
    }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
    }
    .nav-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .nav-btn:disabled { opacity: 0.4; cursor: default; }
    .date-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
    }
    .date-btn:hover { background: var(--cortex-surface-muted); }
    .cal-pop {
      position: absolute;
      top: 52px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      width: min(340px, 92vw);
    }
    .content.loading {
      text-align: center;
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-8, 32px) 0;
    }
    .empty {
      text-align: center;
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-8, 32px) 0;
      font-size: 15px;
    }
  `;ui([w()],cr.prototype,"date",2);ui([w()],cr.prototype,"today",2);ui([w({attribute:!1})],cr.prototype,"entry",2);ui([w({type:Boolean})],cr.prototype,"loading",2);ui([w({type:Boolean})],cr.prototype,"calendarOpen",2);ui([w()],cr.prototype,"calendarMonth",2);ui([w({attribute:!1})],cr.prototype,"calendarDates",2);cr=ui([Z("diary-review-panel")],cr);var C4=Object.getOwnPropertyDescriptor,E4=(t,e,r,i)=>{for(var s=i>1?void 0:i?C4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=o(s)||s);return s};const A4=["广州","深圳","珠海","东莞","佛山","中山"];let _l=class extends G{_pick(t){this.dispatchEvent(new CustomEvent("submit",{detail:{city:t},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){return p`
      <div class="title">选择你的城市（用于日记天气）</div>
      <div class="grid">
        ${A4.map(t=>p`<button class="city" @click=${()=>this._pick(t)}>${t}</button>`)}
      </div>
      <div class="actions">
        <button class="cancel" @click=${this._cancel}>暂不设置</button>
      </div>
    `}};_l.styles=U`
    :host { display: block; min-width: 320px; }
    .title {
      font-size: var(--cortex-fs-base);
      font-weight: 600;
      margin-bottom: var(--cortex-space-3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--cortex-space-2);
    }
    button.city {
      padding: 12px 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      min-height: 44px;
    }
    button.city:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--cortex-space-4);
    }
    button.cancel {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .actions { flex-direction: column-reverse; }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;_l=E4([Z("city-dialog")],_l);var M4=Object.defineProperty,P4=Object.getOwnPropertyDescriptor,$h=(t,e,r,i)=>{for(var s=i>1?void 0:i?P4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&M4(e,r,s),s};let _o=class extends G{constructor(){super(...arguments),this._initialized=!1,this._pendingSubmit=null}connectedCallback(){super.connectedCallback(),this._unsubscribe=T.subscribe(()=>this.requestUpdate()),this._initialized||(this._initialized=!0,this._init())}updated(t){var r;super.updated(t);const e=(r=this.shadowRoot)==null?void 0:r.querySelector("dialog");e&&!e.open&&e.showModal()}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}get _diary(){return T.getState().diary}_localToday(){return zh(new Date)}async _init(){await this._loadToday();const t=this._diary.today||this._localToday(),e=Ed(t,-1);C.setDiaryState({reviewDate:e}),await Promise.all([this._loadReview(e),this._loadCalendar(Ys(Xr(e)))])}async _loadToday(){C.setDiaryState({recordLoading:!0,error:null});try{const t=await qr.today();C.setDiaryState({today:t.today,todayEntry:t.entry,recordLoading:!1})}catch(t){C.setDiaryState({recordLoading:!1,today:this._localToday(),error:t instanceof Et?t.message:"加载今日记录失败"})}}async _loadReview(t){C.setDiaryState({reviewLoading:!0,error:null});try{const e=await qr.entry(t);C.setDiaryState({reviewEntry:e,reviewLoading:!1})}catch(e){C.setDiaryState({reviewEntry:null,reviewLoading:!1,error:e instanceof Et?e.message:"加载日记失败"})}}async _loadCalendar(t){try{const e=await qr.calendar(t);C.setDiaryState({calendarMonth:t,calendarDates:e.dates})}catch{C.setDiaryState({calendarMonth:t,calendarDates:[]})}}async _onSubmitText(t){var e;if(!this._diary.submitting){if(!((e=this._diary.todayEntry)!=null&&e.city)){this._pendingSubmit={type:"text",value:t.detail.value},C.setDiaryState({cityDialogOpen:!0});return}this._submitText(t.detail.value)}}async _onUploadPhoto(t){var e;if(!this._diary.submitting){if(!((e=this._diary.todayEntry)!=null&&e.city)){this._pendingSubmit={type:"photo",file:t.detail.file,caption:t.detail.caption},C.setDiaryState({cityDialogOpen:!0});return}this._uploadPhoto(t.detail.file,t.detail.caption)}}async _submitText(t){C.setDiaryState({submitting:!0,error:null});try{await qr.addText(t),await this._loadToday()}catch(e){C.setDiaryState({error:e instanceof Et?e.message:"记录失败，请重试"})}finally{C.setDiaryState({submitting:!1})}}async _uploadPhoto(t,e){C.setDiaryState({submitting:!0,error:null});try{await qr.uploadPhoto(t,e),await this._loadToday()}catch(r){C.setDiaryState({error:r instanceof Et?r.message:"照片上传失败，请重试"})}finally{C.setDiaryState({submitting:!1})}}async _onDeleteFragment(t){const e=this._diary.today||this._localToday();C.setDiaryState({error:null});try{await qr.removeFragment(e,t.detail.fid),await this._loadToday()}catch(r){C.setDiaryState({error:r instanceof Et?r.message:"删除失败，请重试"})}}async _onEditFragment(t){const e=this._diary.today||this._localToday();C.setDiaryState({submitting:!0,error:null});try{await qr.editFragment(e,t.detail.fid,t.detail.text),await this._loadToday()}catch(r){C.setDiaryState({error:r instanceof Et?r.message:"保存失败，请重试"})}finally{C.setDiaryState({submitting:!1})}}async _onNavigateDay(t){const e=Ed(this._diary.reviewDate,t.detail.delta);C.setDiaryState({reviewDate:e,calendarOpen:!1}),await this._loadReview(e);const r=Ys(Xr(e));r!==this._diary.calendarMonth&&this._loadCalendar(r)}_onToggleCalendar(){const t=!this._diary.calendarOpen;C.setDiaryState({calendarOpen:t}),t&&this._loadCalendar(Ys(Xr(this._diary.reviewDate)))}async _onSelectDate(t){const e=t.detail.date;C.setDiaryState({reviewDate:e,calendarOpen:!1}),await this._loadReview(e)}_onMonthChange(t){this._loadCalendar(t.detail.month)}_switchTab(t){if(C.setDiaryState({tab:t,calendarOpen:!1}),t==="record")this._loadToday();else{const e=this._diary.reviewDate;this._loadReview(e),this._loadCalendar(Ys(Xr(e)))}}async _onCitySubmit(t){const e=t.detail.city,r=this._diary.today||this._localToday();C.setDiaryState({cityDialogOpen:!1});const i=this._pendingSubmit;this._pendingSubmit=null,(i==null?void 0:i.type)==="text"?await this._submitText(i.value):(i==null?void 0:i.type)==="photo"&&i.file&&await this._uploadPhoto(i.file,i.caption);try{const s=await qr.setCity(r,e);C.setDiaryState({todayEntry:s})}catch{}}_onCityCancel(){C.setDiaryState({cityDialogOpen:!1}),localStorage.setItem("doclens.diary.citySelected","true")}render(){var e;const t=this._diary;return p`
      <div class="page"
        @submit-text=${this._onSubmitText}
        @upload-photo=${this._onUploadPhoto}
        @delete-fragment=${this._onDeleteFragment}
        @edit-fragment=${this._onEditFragment}
        @navigate-day=${this._onNavigateDay}
        @toggle-calendar=${this._onToggleCalendar}
        @select-date=${this._onSelectDate}
        @month-change=${this._onMonthChange}>
        <div class="tab-strip">
          <button
            class="sub-tab ${t.tab==="record"?"active":""}"
            @click=${()=>this._switchTab("record")}>
            <doclens-icon name="pencil"></doclens-icon>记录
          </button>
          <button
            class="sub-tab ${t.tab==="review"?"active":""}"
            @click=${()=>this._switchTab("review")}>
            <doclens-icon name="book-open"></doclens-icon>回顾
          </button>
        </div>
        ${t.error?p`<div class="error-bar">${t.error}</div>`:null}
        ${t.tab==="record"?p`
              <diary-record-panel
                .entry=${t.todayEntry}
                .submitting=${t.submitting}
                .city=${((e=t.todayEntry)==null?void 0:e.city)||""}
                @city-change=${()=>C.setDiaryState({cityDialogOpen:!0})}></diary-record-panel>`:p`
              <diary-review-panel
                .date=${t.reviewDate}
                .today=${t.today||this._localToday()}
                .entry=${t.reviewEntry}
                .loading=${t.reviewLoading}
                .calendarOpen=${t.calendarOpen}
                .calendarMonth=${t.calendarMonth}
                .calendarDates=${t.calendarDates}></diary-review-panel>`}
        ${t.tab==="record"&&t.cityDialogOpen?p`
          <dialog @cancel=${this._onCityCancel}>
            <city-dialog
              @submit=${this._onCitySubmit}
              @cancel=${this._onCityCancel}></city-dialog>
          </dialog>`:null}
      </div>
    `}};_o.styles=U`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      background: var(--cortex-bg);
    }
    .page {
      flex: 1;
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: var(--cortex-space-4, 16px) var(--cortex-space-4, 16px)
        calc(var(--cortex-space-6, 24px) + env(safe-area-inset-bottom));
    }
    .tab-strip {
      display: flex;
      gap: 4px;
      margin-bottom: var(--cortex-space-4, 16px);
    }
    .sub-tab {
      flex: 1;
      min-height: 40px;
      padding: 0 16px;
      border: none;
      border-radius: var(--cortex-radius-lg, 16px);
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .sub-tab:hover { color: var(--cortex-text); }
    .sub-tab doclens-icon { font-size: 16px; }
    .sub-tab.active {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
    }
    .error-bar {
      margin-bottom: var(--cortex-space-3, 12px);
      padding: var(--cortex-space-2, 8px) var(--cortex-space-3, 12px);
      border-radius: var(--cortex-radius-md, 8px);
      background: #fef2f2;
      color: var(--cortex-nav-active);
      font-size: 13px;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
  `;$h([$()],_o.prototype,"_pendingSubmit",2);_o=$h([Z("diary-view")],_o);function D4(){return typeof window.matchMedia=="function"&&window.matchMedia("(pointer: coarse)").matches}var O4=Object.getOwnPropertyDescriptor,I4=(t,e,r,i)=>{for(var s=i>1?void 0:i?O4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=o(s)||s);return s};let kl=class extends G{_emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}render(){return p`
      <div class="grid">
        ${["1","2","3","4","5","6","7","8","9"].map(e=>p`<button type="button" data-key=${e} @click=${()=>this._emit("digit",e)}>${e}</button>`)}
        <button type="button" class="fn" data-key="backspace" aria-label="删除"
          @click=${()=>this._emit("backspace")}>⌫</button>
        <button type="button" data-key="0" @click=${()=>this._emit("digit","0")}>0</button>
        <button type="button" class="fn" data-key="submit" aria-label="确认"
          @click=${()=>this._emit("submit")}>✓</button>
      </div>
    `}};kl.styles=U`
    :host {
      display: block;
      width: 100%;
      max-width: 300px;
      margin: 0 auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--cortex-space-3, 12px);
    }
    button {
      height: 56px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-xl);
      font-family: var(--cortex-font);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    button:active {
      background: var(--cortex-surface-muted);
    }
    button.fn {
      font-size: var(--cortex-fs-lg);
      color: var(--cortex-text-muted);
    }
  `;kl=I4([Z("pin-pad")],kl);var R4=Object.defineProperty,L4=Object.getOwnPropertyDescriptor,Wo=(t,e,r,i)=>{for(var s=i>1?void 0:i?L4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&R4(e,r,s),s};const xi=6;let gs=class extends G{constructor(){super(...arguments),this._pin="",this._error="",this._submitting=!1,this._coarse=D4()}async _submit(){if(!(this._pin.length!==xi||this._submitting)){this._submitting=!0,this._error="";try{await w1(this._pin),C.setAuthState({authenticated:!0}),Sr.navigate("search")}catch(t){this._pin="",this._error=t instanceof Et?t.message:"网络错误，请重试"}finally{this._submitting=!1}}}_onDigit(t){this._pin.length>=xi||(this._error="",this._pin+=t.detail,this._pin.length===xi&&this._submit())}_onBackspace(){this._error="",this._pin=this._pin.slice(0,-1)}_onInput(t){const e=t.target;this._pin=e.value.replace(/\D/g,"").slice(0,xi),e.value=this._pin,this._error=""}_onKeydown(t){t.key==="Enter"&&this._submit()}_renderCoarse(){return p`
      <div class="dots" aria-label="已输入 ${this._pin.length} 位">
        ${Array.from({length:xi},(t,e)=>p`<span class="dot ${e<this._pin.length?"filled":""}"></span>`)}
      </div>
      <pin-pad
        @digit=${this._onDigit}
        @backspace=${this._onBackspace}
        @submit=${()=>void this._submit()}
      ></pin-pad>
    `}_renderFine(){return p`
      <input
        class="pin-input"
        type="password"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength=${xi}
        autocomplete="current-password"
        placeholder="●●●●●●"
        .value=${this._pin}
        @input=${this._onInput}
        @keydown=${this._onKeydown}
        autofocus
      />
      <button
        class="submit"
        ?disabled=${this._pin.length!==xi||this._submitting}
        @click=${()=>void this._submit()}
      >${this._submitting?"验证中…":"登 录"}</button>
    `}render(){return p`
      <div class="card">
        <h1>🔒 访问密码</h1>
        <p class="subtitle">此实例已启用密码保护，请输入 6 位数字密码</p>
        ${this._coarse?this._renderCoarse():this._renderFine()}
        <p class="error" role="alert">${this._error||F}</p>
      </div>
    `}};gs.styles=U`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100dvh;
      background: var(--cortex-bg);
      padding: var(--cortex-space-4, 16px);
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 360px;
      background: var(--cortex-card-bg);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      box-shadow: var(--cortex-shadow-lg);
      padding: 32px 28px;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4, 16px);
    }
    h1 {
      margin: 0;
      font-size: var(--cortex-fs-xl);
      color: var(--cortex-text);
      text-align: center;
    }
    .subtitle {
      margin: 0;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      text-align: center;
    }
    .dots {
      display: flex;
      justify-content: center;
      gap: 12px;
      height: 20px;
    }
    .dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1.5px solid var(--cortex-border);
      background: transparent;
    }
    .dot.filled {
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    input.pin-input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 14px;
      font-size: var(--cortex-fs-xl);
      font-family: var(--cortex-font-mono);
      letter-spacing: 0.5em;
      text-align: center;
      color: var(--cortex-text);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      outline: none;
    }
    input.pin-input:focus {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .error {
      margin: 0;
      min-height: 1.2em;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-danger);
      text-align: center;
    }
    button.submit {
      width: 100%;
      padding: 12px;
      font-size: var(--cortex-fs-base);
      font-family: var(--cortex-font);
      color: #fff;
      background: var(--cortex-primary);
      border: none;
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
    }
    button.submit:hover:not(:disabled) {
      background: var(--cortex-primary-hover);
    }
    button.submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;Wo([$()],gs.prototype,"_pin",2);Wo([$()],gs.prototype,"_error",2);Wo([$()],gs.prototype,"_submitting",2);gs=Wo([Z("login-view")],gs);const B4='<svg viewBox="0 0 1024 1024" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" id="图层_1"><defs><style>.cls-1{fill:url(#未命名的渐变_15);}.cls-2{fill:url(#未命名的渐变_5);}.cls-3{fill:url(#未命名的渐变_12);}.cls-4{fill:#fff;}.cls-5{fill:#a6c9ff;}.cls-10,.cls-18,.cls-6,.cls-7,.cls-8,.cls-9{stroke-width:3.97px;}.cls-6{fill:url(#未命名的渐变_121);stroke:url(#未命名的渐变_89);}.cls-7{fill:url(#未命名的渐变_121-2);stroke:url(#未命名的渐变_89-2);}.cls-8{fill:url(#未命名的渐变_121-3);stroke:url(#未命名的渐变_89-3);}.cls-9{fill:url(#未命名的渐变_121-4);stroke:url(#未命名的渐变_89-4);}.cls-10{fill:url(#未命名的渐变_150);stroke:url(#未命名的渐变_89-5);}.cls-11{fill:url(#未命名的渐变_142);}.cls-12{fill:url(#未命名的渐变_15-2);}.cls-13{fill:url(#未命名的渐变_15-3);}.cls-14{fill:url(#未命名的渐变_15-4);}.cls-15,.cls-16,.cls-17{stroke-width:3.45px;}.cls-15{fill:url(#未命名的渐变_303);stroke:url(#未命名的渐变_89-6);}.cls-16{fill:url(#未命名的渐变_303-2);stroke:url(#未命名的渐变_89-7);}.cls-17{fill:url(#未命名的渐变_303-3);stroke:url(#未命名的渐变_89-8);}.cls-18{fill:url(#未命名的渐变_165);stroke:url(#未命名的渐变_89-9);}.cls-19{fill:url(#未命名的渐变_142-2);}.cls-20{fill:url(#未命名的渐变_15-5);}.cls-21{fill:url(#未命名的渐变_15-6);}</style><linearGradient gradientUnits="userSpaceOnUse" y2="575.6" x2="723.12" y1="823.34" x1="260.49" id="未命名的渐变_15"><stop stop-color="#ecf3ff" offset="0"></stop><stop stop-color="#c9e2ff" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="936.7" x2="441.51" y1="771.46" x1="117.19" id="未命名的渐变_5"><stop stop-color="#c8e1ff" offset="0"></stop><stop stop-color="#c5dfff" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="850.55" x2="962.02" y1="860.6" x1="475.44" id="未命名的渐变_12"><stop stop-color="#c5dfff" offset="0.06"></stop><stop stop-color="#8bb4f1" offset="0.23"></stop><stop stop-color="#a2c5f7" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="116.46" x2="512.61" y1="614.64" x1="176.04" id="未命名的渐变_121"><stop stop-opacity="0" stop-color="#f7f8fa" offset="0"></stop><stop stop-color="#62abff" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="373.13" x2="484.05" y1="373.13" x1="238.3" id="未命名的渐变_89"><stop stop-opacity="0.24" stop-color="#fff" offset="0"></stop><stop stop-color="#fff" offset="0.94"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_121" y2="380.36" x2="510.69" y1="380.36" x1="268.92" id="未命名的渐变_121-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="381.02" x2="512.67" y1="381.02" x1="266.93" id="未命名的渐变_89-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_121" y2="391.59" x2="536.75" y1="391.59" x1="294.98" id="未命名的渐变_121-3"></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="392.24" x2="538.73" y1="392.24" x1="292.99" id="未命名的渐变_89-3"></linearGradient><linearGradient xlink:href="#未命名的渐变_121" y2="404.68" x2="573.3" y1="404.68" x1="331.53" id="未命名的渐变_121-4"></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="405.33" x2="575.28" y1="405.33" x1="329.55" id="未命名的渐变_89-4"></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="444.26" x2="512.56" y1="86.89" x1="-37.04" id="未命名的渐变_150"><stop stop-opacity="0" stop-color="#f7f8fa" offset="0"></stop><stop stop-color="#62abff" offset="0.92"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="420.84" x2="604.72" y1="420.84" x1="359.85" id="未命名的渐变_89-5"></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="444.06" x2="385.18" y1="431.67" x1="215.21" id="未命名的渐变_142"><stop stop-color="#509eff" offset="0.17"></stop><stop stop-color="#06f" offset="1"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_15" y2="253.5" x2="336.38" y1="253.5" x1="249.71" id="未命名的渐变_15-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" y2="331.15" x2="336.38" y1="331.15" x1="249.71" id="未命名的渐变_15-3"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" y2="414.24" x2="336.38" y1="414.24" x1="249.71" id="未命名的渐变_15-4"></linearGradient><radialGradient gradientUnits="userSpaceOnUse" r="222.83" cy="513.98" cx="567.16" id="未命名的渐变_303"><stop stop-opacity="0" stop-color="#f7f8fa" offset="0.27"></stop><stop stop-color="#62abff" offset="1"></stop></radialGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2576.86" x2="405.02" y1="2576.86" x1="127.71" id="未命名的渐变_89-6"></linearGradient><radialGradient xlink:href="#未命名的渐变_303" r="221.75" cy="510.89" cx="606.07" id="未命名的渐变_303-2"></radialGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2585.91" x2="440.25" y1="2585.91" x1="170" id="未命名的渐变_89-7"></linearGradient><radialGradient xlink:href="#未命名的渐变_303" r="222.76" cy="511.77" cx="637.08" id="未命名的渐变_303-3"></radialGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2597.79" x2="471.6" y1="2597.79" x1="195.59" id="未命名的渐变_89-8"></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="674.55" x2="849.14" y1="50.38" x1="174.27" id="未命名的渐变_165"><stop stop-opacity="0.5" stop-color="#f7f8fa" offset="0"></stop><stop stop-color="#62abff" offset="0.92"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2614.84" x2="503.92" y1="2614.84" x1="225.76" id="未命名的渐变_89-9"></linearGradient><linearGradient xlink:href="#未命名的渐变_142" y2="729.89" x2="481.87" y1="217.24" x1="637.43" id="未命名的渐变_142-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" gradientTransform="translate(-763.31 -2288.79) rotate(-24.35)" y2="3040.03" x2="31.57" y1="3040.03" x1="-43.88" id="未命名的渐变_15-5"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" gradientTransform="translate(-763.31 -2288.79) rotate(-24.35)" y2="2978.16" x2="31.57" y1="2978.16" x1="-43.88" id="未命名的渐变_15-6"></linearGradient></defs><path d="M940.25,687c0,1.06,0,2.21-.08,3.27,0,.3-.07.61-.07.91v.08c-1.22,12.69-10,25.08-26.76,35l-105.6,62.49-1.67,1-6.62,3.88L601.26,911.06a120.12,120.12,0,0,1-34.21,13.15,42.79,42.79,0,0,1-4.48.91c-.31.08-.69.15-1,.23h-.08c-35,6.77-76,2.51-105.59-12.85-.08,0-.08-.07-.15-.07L113.89,733.62C101.19,726.93,92,719,86.52,710.51a5.08,5.08,0,0,0-.54-.76,35.78,35.78,0,0,1-5.55-17.26v-1.36a5.47,5.47,0,0,1,.08-1.14v-.69a31.74,31.74,0,0,1,1.22-7.53,6,6,0,0,1,.3-1.14,44,44,0,0,1,2.81-6.46.07.07,0,0,0,.08-.07c4.33-7.76,11.78-15.06,22.35-21.29L419.34,468.08c38.39-22.73,103.47-23.34,145.51-1.37L837,609l69.71,36.42a97.68,97.68,0,0,1,10.72,6.46c11,7.75,18,16.72,21.06,25.85A36,36,0,0,1,940.25,687Z" class="cls-1"></path><path d="M114,732.79A82.18,82.18,0,0,1,93.39,718,50.63,50.63,0,0,1,85,706.86a38.87,38.87,0,0,1-2.58-5.79,33,33,0,0,1-1.9-11.78l-2.22,94.84c-.36,15.75,10.93,31.69,33.53,43.5L453.7,1006.39l2.21-94.84Z" class="cls-2"></path><path d="M940.06,691.21c-.12,1-.27,2-.48,3-.17.77-.39,1.54-.62,2.31-.28,1-.59,1.9-1,2.85q-.45,1.14-1,2.28c-.45,1-1,1.92-1.51,2.87q-.62,1.1-1.32,2.16c-.71,1.09-1.52,2.16-2.36,3.22-.49.63-1,1.25-1.5,1.87a57,57,0,0,1-5.31,5.37c-1.57,1.38-3.27,2.73-5.08,4-.55.4-1.16.77-1.72,1.16-1.54,1-3.07,2.11-4.77,3.11l-312,184.72q-3.79,2.25-7.93,4.19c-.91.43-1.88.81-2.82,1.22-1.87.83-3.75,1.65-5.71,2.39-1.16.44-2.36.82-3.54,1.23-1.82.63-3.65,1.25-5.53,1.81-1.29.38-2.61.72-3.93,1.07-1.84.49-3.68,1-5.56,1.39-1.07.24-2.14.45-3.22.67-4.63.94-9.34,1.73-14.15,2.29-.7.08-1.41.11-2.11.19-3,.3-6,.55-9.09.7-1.41.08-2.83.12-4.25.16-2,0-4,.09-6,.08-1.56,0-3.13,0-4.69-.08-1.73,0-3.45-.12-5.18-.21s-3.26-.21-4.89-.35-3.2-.28-4.79-.46-3.29-.39-4.93-.61-3.17-.46-4.75-.72-3.14-.55-4.7-.86-3.38-.68-5.05-1.06c-1.45-.33-2.88-.68-4.31-1.05q-2.91-.75-5.77-1.61c-1.24-.38-2.48-.75-3.71-1.16-3.62-1.19-7.19-2.47-10.6-3.93l-.16-.06q-4.2-1.8-8.17-3.86l-2.21,94.84q4,2.05,8.17,3.86h0l.14,0c3.41,1.46,7,2.74,10.6,3.94.44.14.84.33,1.28.47.79.25,1.63.44,2.43.68,1.91.57,3.82,1.11,5.77,1.61.7.18,1.36.41,2.06.58s1.51.3,2.25.47q2.5.57,5.05,1.06c.83.17,1.63.37,2.46.52s1.5.22,2.24.34c1.58.26,3.16.5,4.75.72.87.12,1.73.28,2.61.39s1.55.14,2.31.22c1.6.18,3.2.33,4.8.46.87.07,1.73.19,2.6.25s1.53.05,2.29.1c1.73.1,3.45.16,5.18.21.88,0,1.76.1,2.64.11.68,0,1.37,0,2,0,2,0,4,0,6-.08.93,0,1.88,0,2.81,0,.48,0,1-.09,1.44-.11,3-.16,6.07-.4,9.08-.71.6-.06,1.22-.08,1.82-.14l.3-.05c4.81-.56,9.52-1.35,14.15-2.29.51-.11,1-.15,1.55-.25s1.1-.29,1.66-.42c1.89-.42,3.73-.9,5.57-1.39,1.32-.35,2.64-.68,3.93-1.07,1.88-.56,3.71-1.18,5.54-1.81,1.17-.41,2.37-.79,3.52-1.23,2-.74,3.85-1.56,5.73-2.39.93-.42,1.9-.79,2.81-1.22q4.13-2,7.93-4.19l312-184.72c.5-.29,1-.59,1.47-.89,1.16-.72,2.21-1.47,3.29-2.22.57-.39,1.18-.76,1.73-1.16,1.79-1.3,3.48-2.63,5-4l0,0a57,57,0,0,0,5.31-5.37c.16-.18.37-.35.52-.53.37-.44.63-.9,1-1.34.84-1.06,1.64-2.13,2.36-3.21.2-.31.48-.61.67-.92s.42-.83.65-1.25c.55-1,1.05-1.9,1.51-2.87.18-.39.44-.78.61-1.17s.23-.74.38-1.11c.37-1,.68-1.89,1-2.85.13-.45.35-.9.46-1.36s.09-.64.15-1c.22-1,.37-2,.49-3,.06-.51.2-1,.24-1.51s.07-1.08.08-1.61l2.21-94.84A30,30,0,0,1,940.06,691.21Z" class="cls-3"></path><path d="M532.07,927.64c-26.41,0-53.1-5.46-74.08-16.43L115.49,733.62c-21.78-11.38-36.57-26.71-35-43.21.91-9.58,2.29-13.43,4.38-16.81.6,11.2.36,18,4.94,26.61,5.3,9.64,17.55,19.11,29.8,25.51L461.22,899.05c40.89,21.39,104.5,20.83,141.79-1.26L921,720.41,607.22,909.73C587.09,921.64,559.74,927.64,532.07,927.64Z" class="cls-4"></path><polygon points="323.8 721.71 576.21 733.33 546.85 581.36 309.01 712.21 323.8 721.71" class="cls-5"></polygon><path d="M940.25,687,654.1,784.48l21.59-25.09L837,609l69.71,36.42a97.68,97.68,0,0,1,10.72,6.46c11,7.75,18,16.72,21.06,25.85A36,36,0,0,1,940.25,687Z" class="cls-5"></path><path d="M470.48,536.78,240.3,658.05l2-504L456.11,87.88c12.68-3.89,25.95,4.06,25.95,18.6L482,517.67A21.61,21.61,0,0,1,470.48,536.78Z" class="cls-6"></path><path d="M499.11,544.62,268.92,665.89l2-504L484.74,95.72c13.49-3.6,25.95,4.06,25.95,18.6l-.05,411.19A21.61,21.61,0,0,1,499.11,544.62Z" class="cls-7"></path><path d="M525.16,555.79,295,677.06l2-504,213.78-66.14c12.48-3.26,26,4.06,26,18.61l0,411.19A21.6,21.6,0,0,1,525.16,555.79Z" class="cls-8"></path><path d="M561.71,570,331.53,691.27V185.2l213.78-66.13a21.6,21.6,0,0,1,28,20.64l0,411.18A21.59,21.59,0,0,1,561.71,570Z" class="cls-9"></path><path d="M591.16,581.67,361.84,709.4,363,198.91l213.79-66.14c11.86-6.33,26,4.06,26,18.61l0,411.19A21.59,21.59,0,0,1,591.16,581.67Z" class="cls-10"></path><path d="M327.48,720.89l-92.25-47.8a27.9,27.9,0,0,1-15.07-24.77V178.72a27.91,27.91,0,0,1,37.72-26.12l92.3,34.67a27.92,27.92,0,0,1,18.09,26.13l0,482.72A27.9,27.9,0,0,1,327.48,720.89Z" class="cls-11"></path><path d="M325.23,281.58l-67.49-27.51a12.89,12.89,0,0,1-8-11.95v-9.2a8.09,8.09,0,0,1,11.14-7.49l67.49,27.47a12.9,12.9,0,0,1,8,12v9.24A8.1,8.1,0,0,1,325.23,281.58Z" class="cls-12"></path><path d="M325.23,359.22l-67.49-27.51a12.89,12.89,0,0,1-8-11.95v-9.2a8.09,8.09,0,0,1,11.14-7.49l67.49,27.47a12.9,12.9,0,0,1,8,11.95v9.24A8.1,8.1,0,0,1,325.23,359.22Z" class="cls-13"></path><path d="M325.23,442.32l-67.49-27.51a12.89,12.89,0,0,1-8-11.95v-9.2a8.09,8.09,0,0,1,11.14-7.49l67.49,27.47a12.9,12.9,0,0,1,8,11.95v9.24A8.1,8.1,0,0,1,325.23,442.32Z" class="cls-14"></path><path d="M738.54,604.82,564.05,772.07,386.33,372.57,554.67,260.48A30.63,30.63,0,0,1,598.23,273L744.8,569.11A30.63,30.63,0,0,1,738.54,604.82Z" class="cls-15"></path><path d="M774.78,601.73,600.28,769,427.92,363.46l163-106.08a30.64,30.64,0,0,1,43.56,12.48L781,566A30.65,30.65,0,0,1,774.78,601.73Z" class="cls-16"></path><path d="M808.29,602.61,633.8,769.86,456.43,367.42l168-109.15A30.64,30.64,0,0,1,668,270.75L814.55,566.9A30.63,30.63,0,0,1,808.29,602.61Z" class="cls-17"></path><path d="M844.16,608.06,669.67,775.31l-180.31-406,170.93-105.6a30.64,30.64,0,0,1,43.57,12.48L850.42,572.35A30.63,30.63,0,0,1,844.16,608.06Z" class="cls-18"></path><path d="M654.31,785.22,564,780.42a24.28,24.28,0,0,1-20.84-14.24L379.39,403.61a27.33,27.33,0,0,1,21-38.3l80.31-11.46a24.28,24.28,0,0,1,23.73,14.22L677.73,750.94A24.29,24.29,0,0,1,654.31,785.22Z" class="cls-19"></path><path d="M521.48,493.92l-63,2.4a13.62,13.62,0,0,1-12.92-8l-3.12-6.89a6.27,6.27,0,0,1,5.47-8.85l62.95-2.42a13.59,13.59,0,0,1,12.92,8l3.13,6.92A6.27,6.27,0,0,1,521.48,493.92Z" class="cls-20"></path><path d="M494.88,437.6l-64.29,2.45a10,10,0,0,1-9.5-5.88l-3.67-8.11a7,7,0,0,1,6.1-9.88l64.28-2.47a10,10,0,0,1,9.51,5.87l3.68,8.14A7,7,0,0,1,494.88,437.6Z" class="cls-21"></path></svg>';var N4=Object.defineProperty,F4=Object.getOwnPropertyDescriptor,Th=(t,e,r,i)=>{for(var s=i>1?void 0:i?F4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&N4(e,r,s),s};let ko=class extends G{constructor(){super(...arguments),this.open=!1,this._onKeydown=t=>{this.open&&t.key==="Escape"&&(t.preventDefault(),this._close())}}connectedCallback(){super.connectedCallback(),this._unsub=T.subscribe(()=>this.requestUpdate()),document.addEventListener("keydown",this._onKeydown)}disconnectedCallback(){var t;(t=this._unsub)==null||t.call(this),document.removeEventListener("keydown",this._onKeydown),super.disconnectedCallback()}_close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}_formatRelative(t){const e=Math.max(0,Math.floor(Date.now()/1e3-t));return e<60?`${e}s 前`:e<3600?`${Math.floor(e/60)}m 前`:e<86400?`${Math.floor(e/3600)}h 前`:`${Math.floor(e/86400)}d 前`}_renderList(t){return t.length===0?p`<div class="empty">暂无近期文件变化</div>`:p`
      <div class="list">
        ${[...t].reverse().map(e=>p`
            <div class="item">
              <span class="path">${e.path}</span>
              <span class="ts">${this._formatRelative(e.ts)}</span>
            </div>
          `)}
      </div>
    `}render(){if(!this.open)return F;const t=T.getState().watchRecentChanges;return p`
      <div class="scrim" @click=${this._close}></div>
      <dialog open>
        <div class="head">
          <h3>📁 近期文件变化</h3>
          <button class="close-btn" type="button" @click=${this._close} aria-label="关闭">✕</button>
        </div>
        ${this._renderList(t)}
      </dialog>
    `}};ko.styles=U`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      pointer-events: none;
    }
    /* 仅在 open 时显示遮罩并捕获点击（modal 行为） */
    :host([open]) {
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .scrim {
      position: absolute;
      inset: 0;
    }
    dialog {
      position: relative;
      pointer-events: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 380px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .head h3 {
      margin: 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--cortex-text);
    }
    .close-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      color: var(--cortex-text-muted);
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .close-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .list {
      overflow-y: auto;
      padding: var(--cortex-space-2) var(--cortex-space-6) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
    }
    .item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      padding: 6px 0;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .item:last-child {
      border-bottom: none;
    }
    .item .path {
      color: var(--cortex-text);
      word-break: break-all;
    }
    .item .ts {
      color: var(--cortex-text-muted);
      flex-shrink: 0;
      white-space: nowrap;
      font-size: var(--cortex-fs-xs);
    }
    .empty {
      padding: var(--cortex-space-6);
      text-align: center;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
    }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0;
        width: calc(100vw - 16px);
        max-width: calc(100vw - 16px);
      }
    }
  `;Th([w({type:Boolean,reflect:!0})],ko.prototype,"open",2);ko=Th([Z("watch-changes-dialog")],ko);var H4=Object.defineProperty,q4=Object.getOwnPropertyDescriptor,$s=(t,e,r,i)=>{for(var s=i>1?void 0:i?q4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&H4(e,r,s),s};let ai=class extends G{constructor(){super(...arguments),this.activeView="search",this._menuOpen=!1,this._showSaveAndRevert=!1,this._showLogout=!1,this._watchDialogOpen=!1,this._onWatchReindexed=t=>{var a,o,l;const e=t.detail,r=(a=this.shadowRoot)==null?void 0:a.querySelector("toast-stack"),i=e==null?void 0:e.doc_count,s=(e==null?void 0:e.failed_count)??0;s>0?(o=r==null?void 0:r.pushToast)==null||o.call(r,i!=null?`索引完成：${i} 文档，${s} 个文件失败`:`索引完成：${s} 个文件失败`,"error",5e3):(l=r==null?void 0:r.pushToast)==null||l.call(r,i!=null?`索引已更新：${i} 文档`:"索引已更新","success",3e3)},this._onDocClick=t=>{if(!this._menuOpen)return;t.composedPath().includes(this)||(this._menuOpen=!1)}}_onAvatarClick(t){t.stopPropagation(),this._menuOpen=!this._menuOpen}_onRefreshMenuClick(){this._menuOpen=!1,window.location.reload()}_onWatchMenuClick(){this._menuOpen=!1,this._watchDialogOpen=!0}_onScopeSelect(t){this._menuOpen=!1,this.dispatchEvent(new CustomEvent("navigate",{detail:{view:"settings",scope:t},bubbles:!0,composed:!0}))}_onRevertClick(){this._menuOpen=!1,window.dispatchEvent(new CustomEvent("cortex:revert-settings"))}_onReindexClick(){T.getState().reindex.dialog==="closed"&&(this._menuOpen=!1,C.openReindexConfirm())}async _onLogoutClick(){this._menuOpen=!1;try{await ru()}catch{}C.setAuthState({authenticated:!1}),Sr.navigate("login")}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick),window.addEventListener("cortex:watch-reindexed",this._onWatchReindexed),this._syncFromStore(),this._unsubStore=T.subscribe(()=>this._syncFromStore())}disconnectedCallback(){var t;document.removeEventListener("click",this._onDocClick),window.removeEventListener("cortex:watch-reindexed",this._onWatchReindexed),(t=this._unsubStore)==null||t.call(this),super.disconnectedCallback()}_syncFromStore(){const t=T.getState();this._showSaveAndRevert=t.view==="settings"&&t.settings.dirty,this._showLogout=t.auth.required===!0&&t.auth.authenticated,this.requestUpdate()}_openWatchDialog(){this._watchDialogOpen=!0}_renderSyncBadge(t){if(!t||!t.running&&!t.message)return F;const e=t.message!==""||t.last_success===!1,r=e?"warn":"dot",i=e?`⚠${t.message||"同步失败"}`:"●同步";return p`
      <span
        class="watch-badge sync-badge ${r}"
        role="status"
        aria-label="Git 同步状态"
        title=${t.message||"知识库 Git 同步运行中"}
      ><doclens-icon name="globe"></doclens-icon>${i}</span>
    `}_watchStatus(t){const e=t==null?void 0:t.last_doc_count,r=e!=null?` ${e}`:"";return!t||!t.running?{cls:"",label:`${r} ○监控关`}:t.reindexing?{cls:"busy",label:`${r} ⟳更新中…`}:t.changed_count>0?{cls:"warn",label:`${r} ·待更新 ${t.changed_count}`}:{cls:t.last_success===!1?"warn":"dot",label:`${r} ●监控`}}_renderWatchBadge(t){const{cls:e,label:r}=this._watchStatus(t);return p`
      <button
        class="watch-badge ${e}"
        type="button"
        aria-label="文件监控状态"
        title="点击查看近期文件变化"
        @click=${this._openWatchDialog}
      ><doclens-icon name="folder"></doclens-icon>${r}</button>
    `}render(){return p`
      <div class="brand">
        <span class="logo">${uh(B4)}</span>
        <span>Doclens</span>
      </div>
      <div class="right-cluster">
        ${this._renderSyncBadge(T.getState().syncStatus)}
        ${this._renderWatchBadge(T.getState().watcher)}
        <button class="avatar-btn" @click=${this._onAvatarClick} aria-label="用户菜单">
          <span class="avatar"><doclens-icon name="user" style="font-size:18px"></doclens-icon></span>
        </button>
        <div class="user-menu ${this._menuOpen?"open":""}">
          <button class="menu-item" type="button" @click=${()=>this._onScopeSelect("global")}>
            <doclens-icon class="icon" name="globe"></doclens-icon>
            <span class="text">
              <span class="label">全局配置</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${this._onReindexClick}>
            <doclens-icon class="icon" name="refresh-ccw"></doclens-icon>
            <span class="text">
              <span class="label">强制重建索引</span>
            </span>
          </button>
          <button class="menu-item mobile-only" type="button" @click=${this._onWatchMenuClick}>
            <doclens-icon class="icon" name="folder"></doclens-icon>
            <span class="text">
              <span class="label ${this._watchStatus(T.getState().watcher).cls}">
                文件监控${this._watchStatus(T.getState().watcher).label}
              </span>
            </span>
          </button>
          <button class="menu-item mobile-only" type="button" @click=${this._onRefreshMenuClick}>
            <doclens-icon class="icon" name="refresh-cw"></doclens-icon>
            <span class="text">
              <span class="label">刷新</span>
            </span>
          </button>
          ${this._showSaveAndRevert?p`
            <button class="menu-item" type="button" @click=${this._onRevertClick}>
              <doclens-icon class="icon" name="rotate-ccw"></doclens-icon>
              <span class="text">
                <span class="label">放弃修改</span>
              </span>
            </button>
          `:F}
          ${this._showLogout?p`
            <button class="menu-item" type="button" data-testid="logout-item" @click=${this._onLogoutClick}>
              <doclens-icon class="icon" name="log-out"></doclens-icon>
              <span class="text">
                <span class="label">注销登录</span>
              </span>
            </button>
          `:F}
        </div>
      </div>
      <toast-stack></toast-stack>
      <watch-changes-dialog
        .open=${this._watchDialogOpen}
        @close=${()=>{this._watchDialogOpen=!1}}
      ></watch-changes-dialog>
    `}};ai.styles=U`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 calc(var(--cortex-space-2) + 4px);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      position: relative;
      z-index: 50;
      font-family: var(--cortex-font);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-weight: 600;
      font-size: var(--cortex-fs-md);
    }
    .brand .logo {
      width: 28px; height: 28px;
      border-radius: var(--cortex-radius-md);
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand .logo svg { width: 100%; height: 100%; display: block; }
    .right-cluster {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      position: relative;
    }
    .watch-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      padding: 4px 10px;
      font-size: var(--cortex-fs-xs);
      font-family: inherit;
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      white-space: nowrap;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      transition: background 0.15s, border-color 0.15s;
    }
    .watch-badge:hover {
      background: var(--cortex-surface);
      border-color: var(--cortex-primary);
    }
    .watch-badge:focus-visible {
      outline: 2px solid var(--cortex-primary);
      outline-offset: 1px;
    }
    .watch-badge.dot { color: var(--cortex-success); }
    .watch-badge.busy { color: var(--cortex-primary); }
    .watch-badge.warn { color: var(--cortex-warning); }
    /* Git 同步徽标：非交互（纯状态展示），复用 watch-badge 视觉 */
    .sync-badge { cursor: default; }
    .sync-badge:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-border); }
    @media (max-width: 1023px) {
      /* 移动端右侧空间紧张：watch-badge 隐藏（状态移入用户菜单）。 */
      .watch-badge { display: none; }
    }
    .avatar-btn {
      display: inline-flex;
      align-items: center;
      padding: 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 50%;
      cursor: pointer;
      font-family: inherit;
      color: var(--cortex-text);
      transition: background 0.15s, border-color 0.15s;
    }
    .avatar-btn:hover {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-border);
    }
    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--cortex-primary);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--cortex-fs-sm);
    }

    .user-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-md);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .user-menu.open { display: block; }
    .menu-item {
      display: flex;
      align-items: flex-start;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item .icon {
      font-size: 18px;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
    }
    .menu-item .text { flex: 1; min-width: 0; }
    .menu-item .label {
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      color: var(--cortex-text);
      display: block;
    }
    /* 移动端专属菜单项（watch 状态 / 刷新）：桌面端顶栏已有徽标与空间，不重复 */
    @media (min-width: 1024px) {
      .menu-item.mobile-only { display: none; }
    }
    /* watch 菜单项状态色（与徽标同语义） */
    .menu-item .label.dot { color: var(--cortex-success); }
    .menu-item .label.busy { color: var(--cortex-primary); }
    .menu-item .label.warn { color: var(--cortex-warning); }
  `;$s([w()],ai.prototype,"activeView",2);$s([$()],ai.prototype,"_menuOpen",2);$s([$()],ai.prototype,"_showSaveAndRevert",2);$s([$()],ai.prototype,"_showLogout",2);$s([$()],ai.prototype,"_watchDialogOpen",2);ai=$s([Z("app-bar")],ai);var U4=Object.getOwnPropertyDescriptor,j4=(t,e,r,i)=>{for(var s=i>1?void 0:i?U4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=o(s)||s);return s};let Sl=class extends G{constructor(){super(...arguments),this._abort=null}connectedCallback(){super.connectedCallback(),this._unsub=T.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var t,e;(t=this._abort)==null||t.abort(),(e=this._unsub)==null||e.call(this),super.disconnectedCallback()}_pushToast(t,e="info",r=2500){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(t,e,r)}_confirm(){C.startReindex(),this._runReindex()}_close(){var t;(t=this._abort)==null||t.abort(),C.closeReindex()}async _runReindex(){var t;this._abort=new AbortController;try{for await(const e of Bl("/api/reindex",{},this._abort.signal)){if(this._abort.signal.aborted)break;if(e.event==="progress"){const r=JSON.parse(e.data);C.setReindexProgress({current_file:r.current_file,indexed_count:r.indexed_count,sub_label:r.sub_label})}else if(e.event==="done"){const r=JSON.parse(e.data);r.success?(C.finishReindex({success:r.success,doc_count:r.doc_count,failed_count:r.failed_count}),this._pushToast(r.failed_count>0?`索引重建完成：${r.doc_count} 文档，${r.failed_count} 个文件失败`:`索引重建完成：${r.doc_count} 文档`,r.failed_count>0?"error":"success",3e3)):C.failReindex(r.failed_count>0?`重建失败：${r.failed_count} 个文件失败`:"重建失败");break}else if(e.event==="error"){const r=JSON.parse(e.data);C.failReindex(r.detail||"重建失败");break}}}catch(e){(t=this._abort)!=null&&t.signal.aborted||C.failReindex(e.message||"重建失败")}}_renderBody(t){if(t.dialog==="confirm")return p`
        <h3><doclens-icon name="refresh-ccw"></doclens-icon> 强制重建索引</h3>
        <div class="body"><doclens-icon name="alert-triangle"></doclens-icon> 将清空当前索引并全量重扫工作目录，期间（数十秒）搜索结果可能不完整。是否继续？</div>
        <div class="actions">
          <button @click=${()=>C.closeReindex()}>取消</button>
          <button class="warn" @click=${this._confirm}>确认重建</button>
        </div>
      `;if(t.dialog==="running")return p`
        <h3><doclens-icon name="refresh-cw"></doclens-icon> 正在重建索引…</h3>
        <div class="body">已索引 <strong>${t.indexed_count}</strong> 个文件</div>
        ${t.current_file?p`<div class="progress">当前：${t.current_file}${t.sub_label?` · ${t.sub_label}`:""}</div>`:""}
        <div class="actions">
          <button @click=${this._close}>关闭（后台继续）</button>
        </div>
      `;if(t.dialog==="done"){const e=t.result;return p`
        <h3 style="${e&&e.failed_count>0?"color: var(--cortex-danger)":""}">
          <doclens-icon name="${e&&e.failed_count>0?"alert-triangle":"check"}"></doclens-icon>
          ${e&&e.failed_count>0?"重建完成（部分失败）":"重建完成"}
        </h3>
        <div class="body">
          共索引 <strong>${(e==null?void 0:e.doc_count)??0}</strong> 个文档
          ${e&&e.failed_count>0?p`<br /><span style="color: var(--cortex-danger); font-weight: 600;">· ${e.failed_count} 个文件失败</span>`:""}
        </div>
        <div class="actions">
          <button class="primary" @click=${this._close}>关闭</button>
        </div>
      `}return p`
      <h3><doclens-icon name="alert-triangle"></doclens-icon> 重建失败</h3>
      <div class="body">${t.error||"未知错误"}</div>
      <div class="actions">
        <button class="primary" @click=${this._close}>关闭</button>
      </div>
    `}render(){const t=T.getState().reindex;return t.dialog==="closed"?p`<toast-stack></toast-stack>`:p`
      <dialog open>${this._renderBody(t)}</dialog>
      <toast-stack></toast-stack>
    `}};Sl.styles=U`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      pointer-events: none;
    }
    /* 仅在 dialog 打开时显示 scrim 并捕获点击（modal 行为） */
    :host(:has(dialog[open])) {
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    dialog {
      pointer-events: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0; background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 360px; max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    /* toast-stack 在 closed 态下仍需可点击 */
    :host > toast-stack { pointer-events: auto; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); font-weight: 600; letter-spacing: -0.01em; color: var(--cortex-text); }
    .body { font-size: var(--cortex-fs-sm); color: var(--cortex-text); line-height: 1.6; }
    .progress {
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted); margin-top: var(--cortex-space-2);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2); margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px; border: 1px solid var(--cortex-border);
      background: var(--cortex-surface); cursor: pointer;
      border-radius: var(--cortex-radius-pill); font-size: var(--cortex-fs-base);
    }
    button.primary { background: var(--cortex-btn-primary-bg); color: var(--cortex-btn-primary-text); border: none; border-radius: var(--cortex-radius-pill); }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button.warn { background: var(--cortex-danger); color: #fff; border: none; border-radius: var(--cortex-radius-lg); }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0; width: calc(100vw - 16px); max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
      }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;Sl=j4([Z("reindex-dialog")],Sl);const W4=3e3;let Kr=null,os=!0,ta=null;function Ad(t){try{return JSON.parse(t||"{}")}catch{return null}}function V4(t){C.setWatcherStatus(t.watcher??null),C.setWatchRecentChanges(t.recent_changes??[]),C.setSyncStatus(t.sync??null)}function G4(t){window.dispatchEvent(new CustomEvent("cortex:watch-reindexed",{detail:{doc_count:t.doc_count??null,failed_count:t.failed_count??0}}))}function X4(t){return new Promise(e=>{ta=window.setTimeout(()=>{ta=null,e()},t)})}async function K4(){for(;!os;){try{const t=Kr==null?void 0:Kr.signal;if(!t)return;for await(const e of Bl("/api/watch/events",{},t)){if(os)break;if(e.event==="status"){const r=Ad(e.data);r&&V4(r)}else if(e.event==="reindexed"){const r=Ad(e.data);r&&G4(r)}}}catch{}if(os)return;await X4(W4)}}function Y4(){os&&(os=!1,Kr=new AbortController,K4())}function Z4(){os=!0,ta!==null&&(window.clearTimeout(ta),ta=null),Kr==null||Kr.abort(),Kr=null}var J4=Object.defineProperty,Q4=Object.getOwnPropertyDescriptor,Ch=(t,e,r,i)=>{for(var s=i>1?void 0:i?Q4(e,r):e,a=t.length-1,o;a>=0;a--)(o=t[a])&&(s=(i?o(e,r,s):o(s))||s);return i&&s&&J4(e,r,s),s};let So=class extends G{constructor(){super(...arguments),this._mainStarted=!1,this._mountedViews=new Set}willUpdate(){const t=T.getState().view;t!=="login"&&!this._mountedViews.has(t)&&(this._mountedViews=new Set(this._mountedViews).add(t))}connectedCallback(){super.connectedCallback(),Sr.init(),this._unsubscribe=T.subscribe(()=>this.requestUpdate()),o0(()=>{T.getState().view!=="login"&&(C.setAuthState({authenticated:!1}),Sr.navigate("login"))}),this._unsubAuth=T.subscribeSelector(t=>t.auth.authenticated,t=>{t&&this._startMain()}),this._probeAuth()}async _probeAuth(){try{const t=await tu();if(C.setAuthState({required:t.required,authenticated:t.authenticated,hasPassword:t.has_password}),t.required&&!t.authenticated){Sr.navigate("login");return}}catch{C.setAuthState({required:!1,authenticated:!0})}this._startMain()}_startMain(){this._mainStarted||(this._mainStarted=!0,Y4(),this._loadStatus())}async _loadStatus(){try{const t=await eu();C.setStatus(t),t.sync!==void 0&&C.setSyncStatus(t.sync??null)}catch{}}disconnectedCallback(){var t,e;(t=this._unsubscribe)==null||t.call(this),(e=this._unsubAuth)==null||e.call(this),o0(null),Z4(),super.disconnectedCallback()}_navigate(t){Sr.navigate(t.detail.view),t.detail.view==="settings"&&t.detail.scope&&C.setSettingsScope(t.detail.scope)}_renderView(){const t=T.getState().view;return p`
      ${this._mountedViews.has("search")?p`<search-view ?hidden=${t!=="search"}></search-view>`:null}
      ${this._mountedViews.has("chat")?p`<chat-view ?hidden=${t!=="chat"}></chat-view>`:null}
      ${this._mountedViews.has("files")?p`<files-view ?hidden=${t!=="files"}></files-view>`:null}
      ${this._mountedViews.has("diary")?p`<diary-view ?hidden=${t!=="diary"}></diary-view>`:null}
      ${this._mountedViews.has("settings")?p`<settings-view ?hidden=${t!=="settings"}></settings-view>`:null}
    `}render(){const t=T.getState().view;return t==="login"?p`<login-view></login-view>`:p`
      <app-bar
        .activeView=${t}
        @navigate=${this._navigate}
      ></app-bar>
      <div class="app-body">
        <activity-bar .active=${t} @navigate=${this._navigate}></activity-bar>
        <div class="main">
          ${this._renderView()}
        </div>
        <tab-bar .active=${t} @navigate=${this._navigate} ?hidden=${t==="settings"}></tab-bar>
      </div>
      <reindex-dialog></reindex-dialog>
    `}};So.styles=U`
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
      background: var(--cortex-bg);
    }
    .app-body {
      flex: 1;
      display: flex;
      flex-direction: row;
      min-height: 0;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      position: relative;
    }
    /* keep-alive：各 view 常驻 DOM，用 [hidden] 切换显隐。
       各 view 自身 :host { display:flex } 与 UA [hidden]{display:none}
       特异度相同会覆盖掉 hidden，这里用 !important 压住，确保隐藏生效。 */
    .main > [hidden] { display: none !important; }
    /* 设置页覆盖 app-bar 以下全屏（移动端隐藏底部 tab-bar） */
    .app-body > [hidden] { display: none !important; }
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;Ch([$()],So.prototype,"_mountedViews",2);So=Ch([Z("cortex-app")],So);
