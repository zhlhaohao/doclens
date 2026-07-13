var Yo=Object.defineProperty;var Go=(e,t,r)=>t in e?Yo(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var z=(e,t,r)=>Go(e,typeof t!="symbol"?t+"":t,r);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&o(a)}).observe(document,{childList:!0,subtree:!0});function r(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(s){if(s.ep)return;s.ep=!0;const i=r(s);fetch(s.href,i)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Nt=globalThis,Br=Nt.ShadowRoot&&(Nt.ShadyCSS===void 0||Nt.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Hr=Symbol(),us=new WeakMap;let ro=class{constructor(t,r,o){if(this._$cssResult$=!0,o!==Hr)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=r}get styleSheet(){let t=this.o;const r=this.t;if(Br&&t===void 0){const o=r!==void 0&&r.length===1;o&&(t=us.get(r)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),o&&us.set(r,t))}return t}toString(){return this.cssText}};const Zo=e=>new ro(typeof e=="string"?e:e+"",void 0,Hr),_=(e,...t)=>{const r=e.length===1?e[0]:t.reduce((o,s,i)=>o+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[i+1],e[0]);return new ro(r,e,Hr)},Jo=(e,t)=>{if(Br)e.adoptedStyleSheets=t.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of t){const o=document.createElement("style"),s=Nt.litNonce;s!==void 0&&o.setAttribute("nonce",s),o.textContent=r.cssText,e.appendChild(o)}},hs=Br?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let r="";for(const o of t.cssRules)r+=o.cssText;return Zo(r)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Qo,defineProperty:ei,getOwnPropertyDescriptor:ti,getOwnPropertyNames:ri,getOwnPropertySymbols:si,getPrototypeOf:oi}=Object,be=globalThis,ps=be.trustedTypes,ii=ps?ps.emptyScript:"",mr=be.reactiveElementPolyfillSupport,ft=(e,t)=>e,Ve={toAttribute(e,t){switch(t){case Boolean:e=e?ii:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=e!==null;break;case Number:r=e===null?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch{r=null}}return r}},Ur=(e,t)=>!Qo(e,t),fs={attribute:!0,type:String,converter:Ve,reflect:!1,useDefault:!1,hasChanged:Ur};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),be.litPropertyMetadata??(be.litPropertyMetadata=new WeakMap);let He=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,r=fs){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(t,r),!r.noAccessor){const o=Symbol(),s=this.getPropertyDescriptor(t,o,r);s!==void 0&&ei(this.prototype,t,s)}}static getPropertyDescriptor(t,r,o){const{get:s,set:i}=ti(this.prototype,t)??{get(){return this[r]},set(a){this[r]=a}};return{get:s,set(a){const l=s==null?void 0:s.call(this);i==null||i.call(this,a),this.requestUpdate(t,l,o)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??fs}static _$Ei(){if(this.hasOwnProperty(ft("elementProperties")))return;const t=oi(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(ft("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ft("properties"))){const r=this.properties,o=[...ri(r),...si(r)];for(const s of o)this.createProperty(s,r[s])}const t=this[Symbol.metadata];if(t!==null){const r=litPropertyMetadata.get(t);if(r!==void 0)for(const[o,s]of r)this.elementProperties.set(o,s)}this._$Eh=new Map;for(const[r,o]of this.elementProperties){const s=this._$Eu(r,o);s!==void 0&&this._$Eh.set(s,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const r=[];if(Array.isArray(t)){const o=new Set(t.flat(1/0).reverse());for(const s of o)r.unshift(hs(s))}else t!==void 0&&r.push(hs(t));return r}static _$Eu(t,r){const o=r.attribute;return o===!1?void 0:typeof o=="string"?o:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(r=>r(this))}addController(t){var r;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((r=t.hostConnected)==null||r.call(t))}removeController(t){var r;(r=this._$EO)==null||r.delete(t)}_$E_(){const t=new Map,r=this.constructor.elementProperties;for(const o of r.keys())this.hasOwnProperty(o)&&(t.set(o,this[o]),delete this[o]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Jo(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(r=>{var o;return(o=r.hostConnected)==null?void 0:o.call(r)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(r=>{var o;return(o=r.hostDisconnected)==null?void 0:o.call(r)})}attributeChangedCallback(t,r,o){this._$AK(t,o)}_$ET(t,r){var i;const o=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,o);if(s!==void 0&&o.reflect===!0){const a=(((i=o.converter)==null?void 0:i.toAttribute)!==void 0?o.converter:Ve).toAttribute(r,o.type);this._$Em=t,a==null?this.removeAttribute(s):this.setAttribute(s,a),this._$Em=null}}_$AK(t,r){var i,a;const o=this.constructor,s=o._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const l=o.getPropertyOptions(s),n=typeof l.converter=="function"?{fromAttribute:l.converter}:((i=l.converter)==null?void 0:i.fromAttribute)!==void 0?l.converter:Ve;this._$Em=s;const h=n.fromAttribute(r,l.type);this[s]=h??((a=this._$Ej)==null?void 0:a.get(s))??h,this._$Em=null}}requestUpdate(t,r,o,s=!1,i){var a;if(t!==void 0){const l=this.constructor;if(s===!1&&(i=this[t]),o??(o=l.getPropertyOptions(t)),!((o.hasChanged??Ur)(i,r)||o.useDefault&&o.reflect&&i===((a=this._$Ej)==null?void 0:a.get(t))&&!this.hasAttribute(l._$Eu(t,o))))return;this.C(t,r,o)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,r,{useDefault:o,reflect:s,wrapped:i},a){o&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,a??r??this[t]),i!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||o||(r=void 0),this._$AL.set(t,r)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var o;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[i,a]of this._$Ep)this[i]=a;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,a]of s){const{wrapped:l}=a,n=this[i];l!==!0||this._$AL.has(i)||n===void 0||this.C(i,void 0,a,n)}}let t=!1;const r=this._$AL;try{t=this.shouldUpdate(r),t?(this.willUpdate(r),(o=this._$EO)==null||o.forEach(s=>{var i;return(i=s.hostUpdate)==null?void 0:i.call(s)}),this.update(r)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(r)}willUpdate(t){}_$AE(t){var r;(r=this._$EO)==null||r.forEach(o=>{var s;return(s=o.hostUpdated)==null?void 0:s.call(o)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(t){}firstUpdated(t){}};He.elementStyles=[],He.shadowRootOptions={mode:"open"},He[ft("elementProperties")]=new Map,He[ft("finalized")]=new Map,mr==null||mr({ReactiveElement:He}),(be.reactiveElementVersions??(be.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const bt=globalThis,bs=e=>e,Ut=bt.trustedTypes,vs=Ut?Ut.createPolicy("lit-html",{createHTML:e=>e}):void 0,so="$lit$",fe=`lit$${Math.random().toFixed(9).slice(2)}$`,oo="?"+fe,ai=`<${oo}>`,Ae=document,mt=()=>Ae.createComment(""),gt=e=>e===null||typeof e!="object"&&typeof e!="function",jr=Array.isArray,ni=e=>jr(e)||typeof(e==null?void 0:e[Symbol.iterator])=="function",gr=`[ 	
\f\r]`,ot=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ms=/-->/g,gs=/>/g,_e=RegExp(`>|${gr}(?:([^\\s"'>=/]+)(${gr}*=${gr}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),xs=/'/g,_s=/"/g,io=/^(?:script|style|textarea|title)$/i,li=e=>(t,...r)=>({_$litType$:e,strings:t,values:r}),c=li(1),se=Symbol.for("lit-noChange"),w=Symbol.for("lit-nothing"),ys=new WeakMap,Ce=Ae.createTreeWalker(Ae,129);function ao(e,t){if(!jr(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return vs!==void 0?vs.createHTML(t):t}const ci=(e,t)=>{const r=e.length-1,o=[];let s,i=t===2?"<svg>":t===3?"<math>":"",a=ot;for(let l=0;l<r;l++){const n=e[l];let h,u,b=-1,x=0;for(;x<n.length&&(a.lastIndex=x,u=a.exec(n),u!==null);)x=a.lastIndex,a===ot?u[1]==="!--"?a=ms:u[1]!==void 0?a=gs:u[2]!==void 0?(io.test(u[2])&&(s=RegExp("</"+u[2],"g")),a=_e):u[3]!==void 0&&(a=_e):a===_e?u[0]===">"?(a=s??ot,b=-1):u[1]===void 0?b=-2:(b=a.lastIndex-u[2].length,h=u[1],a=u[3]===void 0?_e:u[3]==='"'?_s:xs):a===_s||a===xs?a=_e:a===ms||a===gs?a=ot:(a=_e,s=void 0);const S=a===_e&&e[l+1].startsWith("/>")?" ":"";i+=a===ot?n+ai:b>=0?(o.push(h),n.slice(0,b)+so+n.slice(b)+fe+S):n+fe+(b===-2?l:S)}return[ao(e,i+(e[r]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),o]};class xt{constructor({strings:t,_$litType$:r},o){let s;this.parts=[];let i=0,a=0;const l=t.length-1,n=this.parts,[h,u]=ci(t,r);if(this.el=xt.createElement(h,o),Ce.currentNode=this.el.content,r===2||r===3){const b=this.el.content.firstChild;b.replaceWith(...b.childNodes)}for(;(s=Ce.nextNode())!==null&&n.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(const b of s.getAttributeNames())if(b.endsWith(so)){const x=u[a++],S=s.getAttribute(b).split(fe),g=/([.?@])?(.*)/.exec(x);n.push({type:1,index:i,name:g[2],strings:S,ctor:g[1]==="."?ui:g[1]==="?"?hi:g[1]==="@"?pi:ir}),s.removeAttribute(b)}else b.startsWith(fe)&&(n.push({type:6,index:i}),s.removeAttribute(b));if(io.test(s.tagName)){const b=s.textContent.split(fe),x=b.length-1;if(x>0){s.textContent=Ut?Ut.emptyScript:"";for(let S=0;S<x;S++)s.append(b[S],mt()),Ce.nextNode(),n.push({type:2,index:++i});s.append(b[x],mt())}}}else if(s.nodeType===8)if(s.data===oo)n.push({type:2,index:i});else{let b=-1;for(;(b=s.data.indexOf(fe,b+1))!==-1;)n.push({type:7,index:i}),b+=fe.length-1}i++}}static createElement(t,r){const o=Ae.createElement("template");return o.innerHTML=t,o}}function qe(e,t,r=e,o){var a,l;if(t===se)return t;let s=o!==void 0?(a=r._$Co)==null?void 0:a[o]:r._$Cl;const i=gt(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==i&&((l=s==null?void 0:s._$AO)==null||l.call(s,!1),i===void 0?s=void 0:(s=new i(e),s._$AT(e,r,o)),o!==void 0?(r._$Co??(r._$Co=[]))[o]=s:r._$Cl=s),s!==void 0&&(t=qe(e,s._$AS(e,t.values),s,o)),t}class di{constructor(t,r){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:r},parts:o}=this._$AD,s=((t==null?void 0:t.creationScope)??Ae).importNode(r,!0);Ce.currentNode=s;let i=Ce.nextNode(),a=0,l=0,n=o[0];for(;n!==void 0;){if(a===n.index){let h;n.type===2?h=new St(i,i.nextSibling,this,t):n.type===1?h=new n.ctor(i,n.name,n.strings,this,t):n.type===6&&(h=new fi(i,this,t)),this._$AV.push(h),n=o[++l]}a!==(n==null?void 0:n.index)&&(i=Ce.nextNode(),a++)}return Ce.currentNode=Ae,s}p(t){let r=0;for(const o of this._$AV)o!==void 0&&(o.strings!==void 0?(o._$AI(t,o,r),r+=o.strings.length-2):o._$AI(t[r])),r++}}class St{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,r,o,s){this.type=2,this._$AH=w,this._$AN=void 0,this._$AA=t,this._$AB=r,this._$AM=o,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=r.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,r=this){t=qe(this,t,r),gt(t)?t===w||t==null||t===""?(this._$AH!==w&&this._$AR(),this._$AH=w):t!==this._$AH&&t!==se&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):ni(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==w&&gt(this._$AH)?this._$AA.nextSibling.data=t:this.T(Ae.createTextNode(t)),this._$AH=t}$(t){var i;const{values:r,_$litType$:o}=t,s=typeof o=="number"?this._$AC(t):(o.el===void 0&&(o.el=xt.createElement(ao(o.h,o.h[0]),this.options)),o);if(((i=this._$AH)==null?void 0:i._$AD)===s)this._$AH.p(r);else{const a=new di(s,this),l=a.u(this.options);a.p(r),this.T(l),this._$AH=a}}_$AC(t){let r=ys.get(t.strings);return r===void 0&&ys.set(t.strings,r=new xt(t)),r}k(t){jr(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let o,s=0;for(const i of t)s===r.length?r.push(o=new St(this.O(mt()),this.O(mt()),this,this.options)):o=r[s],o._$AI(i),s++;s<r.length&&(this._$AR(o&&o._$AB.nextSibling,s),r.length=s)}_$AR(t=this._$AA.nextSibling,r){var o;for((o=this._$AP)==null?void 0:o.call(this,!1,!0,r);t!==this._$AB;){const s=bs(t).nextSibling;bs(t).remove(),t=s}}setConnected(t){var r;this._$AM===void 0&&(this._$Cv=t,(r=this._$AP)==null||r.call(this,t))}}let ir=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,r,o,s,i){this.type=1,this._$AH=w,this._$AN=void 0,this.element=t,this.name=r,this._$AM=s,this.options=i,o.length>2||o[0]!==""||o[1]!==""?(this._$AH=Array(o.length-1).fill(new String),this.strings=o):this._$AH=w}_$AI(t,r=this,o,s){const i=this.strings;let a=!1;if(i===void 0)t=qe(this,t,r,0),a=!gt(t)||t!==this._$AH&&t!==se,a&&(this._$AH=t);else{const l=t;let n,h;for(t=i[0],n=0;n<i.length-1;n++)h=qe(this,l[o+n],r,n),h===se&&(h=this._$AH[n]),a||(a=!gt(h)||h!==this._$AH[n]),h===w?t=w:t!==w&&(t+=(h??"")+i[n+1]),this._$AH[n]=h}a&&!s&&this.j(t)}j(t){t===w?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},ui=class extends ir{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===w?void 0:t}},hi=class extends ir{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==w)}},pi=class extends ir{constructor(t,r,o,s,i){super(t,r,o,s,i),this.type=5}_$AI(t,r=this){if((t=qe(this,t,r,0)??w)===se)return;const o=this._$AH,s=t===w&&o!==w||t.capture!==o.capture||t.once!==o.once||t.passive!==o.passive,i=t!==w&&(o===w||s);s&&this.element.removeEventListener(this.name,this,o),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,t):this._$AH.handleEvent(t)}},fi=class{constructor(t,r,o){this.element=t,this.type=6,this._$AN=void 0,this._$AM=r,this.options=o}get _$AU(){return this._$AM._$AU}_$AI(t){qe(this,t)}};const xr=bt.litHtmlPolyfillSupport;xr==null||xr(xt,St),(bt.litHtmlVersions??(bt.litHtmlVersions=[])).push("3.3.3");const bi=(e,t,r)=>{const o=(r==null?void 0:r.renderBefore)??t;let s=o._$litPart$;if(s===void 0){const i=(r==null?void 0:r.renderBefore)??null;o._$litPart$=s=new St(t.insertBefore(mt(),i),i,void 0,r??{})}return s._$AI(e),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pe=globalThis;let k=class extends He{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const t=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=t.firstChild),t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=bi(r,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return se}};var to;k._$litElement$=!0,k.finalized=!0,(to=Pe.litElementHydrateSupport)==null||to.call(Pe,{LitElement:k});const _r=Pe.litElementPolyfillSupport;_r==null||_r({LitElement:k});(Pe.litElementVersions??(Pe.litElementVersions=[])).push("4.2.2");var vi=_`
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
`;const Pr=new Set,Ue=new Map;let ke,Vr="ltr",qr="en";const no=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(no){const e=new MutationObserver(co);Vr=document.documentElement.dir||"ltr",qr=document.documentElement.lang||navigator.language,e.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function lo(...e){e.map(t=>{const r=t.$code.toLowerCase();Ue.has(r)?Ue.set(r,Object.assign(Object.assign({},Ue.get(r)),t)):Ue.set(r,t),ke||(ke=t)}),co()}function co(){no&&(Vr=document.documentElement.dir||"ltr",qr=document.documentElement.lang||navigator.language),[...Pr.keys()].map(e=>{typeof e.requestUpdate=="function"&&e.requestUpdate()})}let mi=class{constructor(t){this.host=t,this.host.addController(this)}hostConnected(){Pr.add(this.host)}hostDisconnected(){Pr.delete(this.host)}dir(){return`${this.host.dir||Vr}`.toLowerCase()}lang(){return`${this.host.lang||qr}`.toLowerCase()}getTranslationData(t){var r,o;let s;try{s=new Intl.Locale(t.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const i=s.language.toLowerCase(),a=(o=(r=s.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&o!==void 0?o:"",l=Ue.get(`${i}-${a}`),n=Ue.get(i);return{locale:s,language:i,region:a,primary:l,secondary:n}}exists(t,r){var o;const{primary:s,secondary:i}=this.getTranslationData((o=r.lang)!==null&&o!==void 0?o:this.lang());return r=Object.assign({includeFallback:!1},r),!!(s&&s[t]||i&&i[t]||r.includeFallback&&ke&&ke[t])}term(t,...r){const{primary:o,secondary:s}=this.getTranslationData(this.lang());let i;if(o&&o[t])i=o[t];else if(s&&s[t])i=s[t];else if(ke&&ke[t])i=ke[t];else return console.error(`No translation found for: ${String(t)}`),String(t);return typeof i=="function"?i(...r):i}date(t,r){return t=new Date(t),new Intl.DateTimeFormat(this.lang(),r).format(t)}number(t,r){return t=Number(t),isNaN(t)?"":new Intl.NumberFormat(this.lang(),r).format(t)}relativeTime(t,r,o){return new Intl.RelativeTimeFormat(this.lang(),o).format(t,r)}};var uo={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(e,t)=>`Go to slide ${e} of ${t}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:e=>e===0?"No options selected":e===1?"1 option selected":`${e} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:e=>`Slide ${e}`,toggleColorFormat:"Toggle color format"};lo(uo);var gi=uo,Me=class extends mi{};lo(gi);var oe=_`
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
`,ho=Object.defineProperty,xi=Object.defineProperties,_i=Object.getOwnPropertyDescriptor,yi=Object.getOwnPropertyDescriptors,ws=Object.getOwnPropertySymbols,wi=Object.prototype.hasOwnProperty,ki=Object.prototype.propertyIsEnumerable,yr=(e,t)=>(t=Symbol[e])?t:Symbol.for("Symbol."+e),Xr=e=>{throw TypeError(e)},ks=(e,t,r)=>t in e?ho(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,Fe=(e,t)=>{for(var r in t||(t={}))wi.call(t,r)&&ks(e,r,t[r]);if(ws)for(var r of ws(t))ki.call(t,r)&&ks(e,r,t[r]);return e},Kr=(e,t)=>xi(e,yi(t)),p=(e,t,r,o)=>{for(var s=o>1?void 0:o?_i(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ho(t,r,s),s},po=(e,t,r)=>t.has(e)||Xr("Cannot "+r),$i=(e,t,r)=>(po(e,t,"read from private field"),t.get(e)),Si=(e,t,r)=>t.has(e)?Xr("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),Ei=(e,t,r,o)=>(po(e,t,"write to private field"),t.set(e,r),r),Ci=function(e,t){this[0]=e,this[1]=t},Pi=e=>{var t=e[yr("asyncIterator")],r=!1,o,s={};return t==null?(t=e[yr("iterator")](),o=i=>s[i]=a=>t[i](a)):(t=t.call(e),o=i=>s[i]=a=>{if(r){if(r=!1,i==="throw")throw a;return a}return r=!0,{done:!1,value:new Ci(new Promise(l=>{var n=t[i](a);n instanceof Object||Xr("Object expected"),l(n)}),1)}}),s[yr("iterator")]=()=>s,o("next"),"throw"in t?o("throw"):s.throw=i=>{throw i},"return"in t&&o("return"),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=e=>(t,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ai={attribute:!0,type:String,converter:Ve,reflect:!1,hasChanged:Ur},Ti=(e=Ai,t,r)=>{const{kind:o,metadata:s}=r;let i=globalThis.litPropertyMetadata.get(s);if(i===void 0&&globalThis.litPropertyMetadata.set(s,i=new Map),o==="setter"&&((e=Object.create(e)).wrapped=!0),i.set(r.name,e),o==="accessor"){const{name:a}=r;return{set(l){const n=t.get.call(this);t.set.call(this,l),this.requestUpdate(a,n,e,!0,l)},init(l){return l!==void 0&&this.C(a,void 0,e,l),l}}}if(o==="setter"){const{name:a}=r;return function(l){const n=this[a];t.call(this,l),this.requestUpdate(a,n,e,!0,l)}}throw Error("Unsupported decorator location: "+o)};function d(e){return(t,r)=>typeof r=="object"?Ti(e,t,r):((o,s,i)=>{const a=s.hasOwnProperty(i);return s.constructor.createProperty(i,o),a?Object.getOwnPropertyDescriptor(s,i):void 0})(e,t,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function v(e){return d({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Di(e){return(t,r)=>{const o=typeof t=="function"?t:t[r];Object.assign(o,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const zi=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function V(e,t){return(r,o,s)=>{const i=a=>{var l;return((l=a.renderRoot)==null?void 0:l.querySelector(e))??null};return zi(r,o,{get(){return i(this)}})}}var Wt,B=class extends k{constructor(){super(),Si(this,Wt,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([e,t])=>{this.constructor.define(e,t)})}emit(e,t){const r=new CustomEvent(e,Fe({bubbles:!0,cancelable:!1,composed:!0,detail:{}},t));return this.dispatchEvent(r),r}static define(e,t=this,r={}){const o=customElements.get(e);if(!o){try{customElements.define(e,t,r)}catch{customElements.define(e,class extends t{},r)}return}let s=" (unknown version)",i=s;"version"in t&&t.version&&(s=" v"+t.version),"version"in o&&o.version&&(i=" v"+o.version),!(s&&i&&s===i)&&console.warn(`Attempted to register <${e}>${s}, but <${e}>${i} has already been registered.`)}attributeChangedCallback(e,t,r){$i(this,Wt)||(this.constructor.elementProperties.forEach((o,s)=>{o.reflect&&this[s]!=null&&this.initialReflectedProperties.set(s,this[s])}),Ei(this,Wt,!0)),super.attributeChangedCallback(e,t,r)}willUpdate(e){super.willUpdate(e),this.initialReflectedProperties.forEach((t,r)=>{e.has(r)&&this[r]==null&&(this[r]=t)})}};Wt=new WeakMap;B.version="2.20.1";B.dependencies={};p([d()],B.prototype,"dir",2);p([d()],B.prototype,"lang",2);var fo=class extends B{constructor(){super(...arguments),this.localize=new Me(this)}render(){return c`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};fo.styles=[oe,vi];var it=new WeakMap,at=new WeakMap,nt=new WeakMap,wr=new WeakSet,It=new WeakMap,bo=class{constructor(e,t){this.handleFormData=r=>{const o=this.options.disabled(this.host),s=this.options.name(this.host),i=this.options.value(this.host),a=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!o&&!a&&typeof s=="string"&&s.length>0&&typeof i<"u"&&(Array.isArray(i)?i.forEach(l=>{r.formData.append(s,l.toString())}):r.formData.append(s,i.toString()))},this.handleFormSubmit=r=>{var o;const s=this.options.disabled(this.host),i=this.options.reportValidity;this.form&&!this.form.noValidate&&((o=it.get(this.form))==null||o.forEach(a=>{this.setUserInteracted(a,!0)})),this.form&&!this.form.noValidate&&!s&&!i(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),It.set(this.host,[])},this.handleInteraction=r=>{const o=It.get(this.host);o.includes(r.type)||o.push(r.type),o.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const o of r)if(typeof o.checkValidity=="function"&&!o.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const o of r)if(typeof o.reportValidity=="function"&&!o.reportValidity())return!1}return!0},(this.host=e).addController(this),this.options=Fe({form:r=>{const o=r.form;if(o){const i=r.getRootNode().querySelector(`#${o}`);if(i)return i}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var o;return(o=r.disabled)!=null?o:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,o)=>r.value=o,assumeInteractionOn:["sl-input"]},t)}hostConnected(){const e=this.options.form(this.host);e&&this.attachForm(e),It.set(this.host,[]),this.options.assumeInteractionOn.forEach(t=>{this.host.addEventListener(t,this.handleInteraction)})}hostDisconnected(){this.detachForm(),It.delete(this.host),this.options.assumeInteractionOn.forEach(e=>{this.host.removeEventListener(e,this.handleInteraction)})}hostUpdated(){const e=this.options.form(this.host);e||this.detachForm(),e&&this.form!==e&&(this.detachForm(),this.attachForm(e)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(e){e?(this.form=e,it.has(this.form)?it.get(this.form).add(this.host):it.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),at.has(this.form)||(at.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),nt.has(this.form)||(nt.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const e=it.get(this.form);e&&(e.delete(this.host),e.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),at.has(this.form)&&(this.form.reportValidity=at.get(this.form),at.delete(this.form)),nt.has(this.form)&&(this.form.checkValidity=nt.get(this.form),nt.delete(this.form)),this.form=void 0))}setUserInteracted(e,t){t?wr.add(e):wr.delete(e),e.requestUpdate()}doAction(e,t){if(this.form){const r=document.createElement("button");r.type=e,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",t&&(r.name=t.name,r.value=t.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(o=>{t.hasAttribute(o)&&r.setAttribute(o,t.getAttribute(o))})),this.form.append(r),r.click(),r.remove()}}getForm(){var e;return(e=this.form)!=null?e:null}reset(e){this.doAction("reset",e)}submit(e){this.doAction("submit",e)}setValidity(e){const t=this.host,r=!!wr.has(t),o=!!t.required;t.toggleAttribute("data-required",o),t.toggleAttribute("data-optional",!o),t.toggleAttribute("data-invalid",!e),t.toggleAttribute("data-valid",e),t.toggleAttribute("data-user-invalid",!e&&r),t.toggleAttribute("data-user-valid",e&&r)}updateValidity(){const e=this.host;this.setValidity(e.validity.valid)}emitInvalidEvent(e){const t=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});e||t.preventDefault(),this.host.dispatchEvent(t)||e==null||e.preventDefault()}},Yr=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(Kr(Fe({},Yr),{valid:!1,valueMissing:!0}));Object.freeze(Kr(Fe({},Yr),{valid:!1,customError:!0}));var Oi=_`
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
`,Et=class{constructor(e,...t){this.slotNames=[],this.handleSlotChange=r=>{const o=r.target;(this.slotNames.includes("[default]")&&!o.name||o.name&&this.slotNames.includes(o.name))&&this.host.requestUpdate()},(this.host=e).addController(this),this.slotNames=t}hasDefaultSlot(){return[...this.host.childNodes].some(e=>{if(e.nodeType===e.TEXT_NODE&&e.textContent.trim()!=="")return!0;if(e.nodeType===e.ELEMENT_NODE){const t=e;if(t.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!t.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(e){return this.host.querySelector(`:scope > [slot="${e}"]`)!==null}test(e){return e==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(e)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},Ar="";function $s(e){Ar=e}function Ri(e=""){if(!Ar){const t=[...document.getElementsByTagName("script")],r=t.find(o=>o.hasAttribute("data-shoelace"));if(r)$s(r.getAttribute("data-shoelace"));else{const o=t.find(i=>/shoelace(\.min)?\.js($|\?)/.test(i.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(i.src));let s="";o&&(s=o.getAttribute("src")),$s(s.split("/").slice(0,-1).join("/"))}}return Ar.replace(/\/$/,"")+(e?`/${e.replace(/^\//,"")}`:"")}var Ii={name:"default",resolver:e=>Ri(`assets/icons/${e}.svg`)},Li=Ii,Ss={caret:`
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
  `},Mi={name:"system",resolver:e=>e in Ss?`data:image/svg+xml,${encodeURIComponent(Ss[e])}`:""},Fi=Mi,Ni=[Li,Fi],Tr=[];function Wi(e){Tr.push(e)}function Bi(e){Tr=Tr.filter(t=>t!==e)}function Es(e){return Ni.find(t=>t.name===e)}var Hi=_`
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
`;function H(e,t){const r=Fe({waitUntilFirstUpdate:!1},t);return(o,s)=>{const{update:i}=o,a=Array.isArray(e)?e:[e];o.update=function(l){a.forEach(n=>{const h=n;if(l.has(h)){const u=l.get(h),b=this[h];u!==b&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[s](u,b)}}),i.call(this,l)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ui=(e,t)=>(e==null?void 0:e._$litType$)!==void 0,ji=e=>e.strings===void 0,Vi={},qi=(e,t=Vi)=>e._$AH=t;var lt=Symbol(),Lt=Symbol(),kr,$r=new Map,Q=class extends B{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(e,t){var r;let o;if(t!=null&&t.spriteSheet)return this.svg=c`<svg part="svg">
        <use part="use" href="${e}"></use>
      </svg>`,this.svg;try{if(o=await fetch(e,{mode:"cors"}),!o.ok)return o.status===410?lt:Lt}catch{return Lt}try{const s=document.createElement("div");s.innerHTML=await o.text();const i=s.firstElementChild;if(((r=i==null?void 0:i.tagName)==null?void 0:r.toLowerCase())!=="svg")return lt;kr||(kr=new DOMParser);const l=kr.parseFromString(i.outerHTML,"text/html").body.querySelector("svg");return l?(l.part.add("svg"),document.adoptNode(l)):lt}catch{return lt}}connectedCallback(){super.connectedCallback(),Wi(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),Bi(this)}getIconSource(){const e=Es(this.library);return this.name&&e?{url:e.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var e;const{url:t,fromLibrary:r}=this.getIconSource(),o=r?Es(this.library):void 0;if(!t){this.svg=null;return}let s=$r.get(t);if(s||(s=this.resolveIcon(t,o),$r.set(t,s)),!this.initialRender)return;const i=await s;if(i===Lt&&$r.delete(t),t===this.getIconSource().url){if(Ui(i)){if(this.svg=i,o){await this.updateComplete;const a=this.shadowRoot.querySelector("[part='svg']");typeof o.mutator=="function"&&a&&o.mutator(a)}return}switch(i){case Lt:case lt:this.svg=null,this.emit("sl-error");break;default:this.svg=i.cloneNode(!0),(e=o==null?void 0:o.mutator)==null||e.call(o,this.svg),this.emit("sl-load")}}}render(){return this.svg}};Q.styles=[oe,Hi];p([v()],Q.prototype,"svg",2);p([d({reflect:!0})],Q.prototype,"name",2);p([d()],Q.prototype,"src",2);p([d()],Q.prototype,"label",2);p([d({reflect:!0})],Q.prototype,"library",2);p([H("label")],Q.prototype,"handleLabelChange",1);p([H(["name","src","library"])],Q.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ye={ATTRIBUTE:1,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},vo=e=>(...t)=>({_$litDirective$:e,values:t});let mo=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,r,o){this._$Ct=t,this._$AM=r,this._$Ci=o}_$AS(t,r){return this.update(t,r)}update(t,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const J=vo(class extends mo{constructor(e){var t;if(super(e),e.type!==ye.ATTRIBUTE||e.name!=="class"||((t=e.strings)==null?void 0:t.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){var o,s;if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in t)t[i]&&!((o=this.nt)!=null&&o.has(i))&&this.st.add(i);return this.render(t)}const r=e.element.classList;for(const i of this.st)i in t||(r.remove(i),this.st.delete(i));for(const i in t){const a=!!t[i];a===this.st.has(i)||(s=this.nt)!=null&&s.has(i)||(a?(r.add(i),this.st.add(i)):(r.remove(i),this.st.delete(i)))}return se}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const go=Symbol.for(""),Xi=e=>{if((e==null?void 0:e.r)===go)return e==null?void 0:e._$litStatic$},jt=(e,...t)=>({_$litStatic$:t.reduce((r,o,s)=>r+(i=>{if(i._$litStatic$!==void 0)return i._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${i}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(o)+e[s+1],e[0]),r:go}),Cs=new Map,Ki=e=>(t,...r)=>{const o=r.length;let s,i;const a=[],l=[];let n,h=0,u=!1;for(;h<o;){for(n=t[h];h<o&&(i=r[h],(s=Xi(i))!==void 0);)n+=s+t[++h],u=!0;h!==o&&l.push(i),a.push(n),h++}if(h===o&&a.push(t[o]),u){const b=a.join("$$lit$$");(t=Cs.get(b))===void 0&&(a.raw=a,Cs.set(b,t=a)),r=l}return e(t,...r)},Bt=Ki(c);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const C=e=>e??w;var D=class extends B{constructor(){super(...arguments),this.formControlController=new bo(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new Et(this,"[default]","prefix","suffix"),this.localize=new Me(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Yr}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(e){this.isButton()&&(this.button.setCustomValidity(e),this.formControlController.updateValidity())}render(){const e=this.isLink(),t=e?jt`a`:jt`button`;return Bt`
      <${t}
        part="base"
        class=${J({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${C(e?void 0:this.disabled)}
        type=${C(e?void 0:this.type)}
        title=${this.title}
        name=${C(e?void 0:this.name)}
        value=${C(e?void 0:this.value)}
        href=${C(e&&!this.disabled?this.href:void 0)}
        target=${C(e?this.target:void 0)}
        download=${C(e?this.download:void 0)}
        rel=${C(e?this.rel:void 0)}
        role=${C(e?void 0:"button")}
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
        ${this.caret?Bt` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?Bt`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${t}>
    `}};D.styles=[oe,Oi];D.dependencies={"sl-icon":Q,"sl-spinner":fo};p([V(".button")],D.prototype,"button",2);p([v()],D.prototype,"hasFocus",2);p([v()],D.prototype,"invalid",2);p([d()],D.prototype,"title",2);p([d({reflect:!0})],D.prototype,"variant",2);p([d({reflect:!0})],D.prototype,"size",2);p([d({type:Boolean,reflect:!0})],D.prototype,"caret",2);p([d({type:Boolean,reflect:!0})],D.prototype,"disabled",2);p([d({type:Boolean,reflect:!0})],D.prototype,"loading",2);p([d({type:Boolean,reflect:!0})],D.prototype,"outline",2);p([d({type:Boolean,reflect:!0})],D.prototype,"pill",2);p([d({type:Boolean,reflect:!0})],D.prototype,"circle",2);p([d()],D.prototype,"type",2);p([d()],D.prototype,"name",2);p([d()],D.prototype,"value",2);p([d()],D.prototype,"href",2);p([d()],D.prototype,"target",2);p([d()],D.prototype,"rel",2);p([d()],D.prototype,"download",2);p([d()],D.prototype,"form",2);p([d({attribute:"formaction"})],D.prototype,"formAction",2);p([d({attribute:"formenctype"})],D.prototype,"formEnctype",2);p([d({attribute:"formmethod"})],D.prototype,"formMethod",2);p([d({attribute:"formnovalidate",type:Boolean})],D.prototype,"formNoValidate",2);p([d({attribute:"formtarget"})],D.prototype,"formTarget",2);p([H("disabled",{waitUntilFirstUpdate:!0})],D.prototype,"handleDisabledChange",1);D.define("sl-button");Q.define("sl-icon");var Yi=_`
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
`,Gi=(e="value")=>(t,r)=>{const o=t.constructor,s=o.prototype.attributeChangedCallback;o.prototype.attributeChangedCallback=function(i,a,l){var n;const h=o.getPropertyOptions(e),u=typeof h.attribute=="string"?h.attribute:e;if(i===u){const b=h.converter||Ve,S=(typeof b=="function"?b:(n=b==null?void 0:b.fromAttribute)!=null?n:Ve.fromAttribute)(l,h.type);this[e]!==S&&(this[r]=S)}s.call(this,i,a,l)}},Zi=_`
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
 */const Ji=vo(class extends mo{constructor(e){if(super(e),e.type!==ye.PROPERTY&&e.type!==ye.ATTRIBUTE&&e.type!==ye.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!ji(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[t]){if(t===se||t===w)return t;const r=e.element,o=e.name;if(e.type===ye.PROPERTY){if(t===r[o])return se}else if(e.type===ye.BOOLEAN_ATTRIBUTE){if(!!t===r.hasAttribute(o))return se}else if(e.type===ye.ATTRIBUTE&&r.getAttribute(o)===t+"")return se;return qi(e),t}});var $=class extends B{constructor(){super(...arguments),this.formControlController=new bo(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new Et(this,"help-text","label"),this.localize=new Me(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var e;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((e=this.input)==null?void 0:e.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(e){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=e,this.value=this.__dateInput.value}get valueAsNumber(){var e;return this.__numberInput.value=this.value,((e=this.input)==null?void 0:e.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(e){this.__numberInput.valueAsNumber=e,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(e){e.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleKeyDown(e){const t=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;e.key==="Enter"&&!t&&setTimeout(()=>{!e.defaultPrevented&&!e.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(e,t,r="none"){this.input.setSelectionRange(e,t,r)}setRangeText(e,t,r,o="preserve"){const s=t??this.input.selectionStart,i=r??this.input.selectionEnd;this.input.setRangeText(e,s,i,o),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),r=this.label?!0:!!e,o=this.helpText?!0:!!t,i=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return c`
      <div
        part="form-control"
        class=${J({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":o})}
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
            class=${J({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
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
              name=${C(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${C(this.placeholder)}
              minlength=${C(this.minlength)}
              maxlength=${C(this.maxlength)}
              min=${C(this.min)}
              max=${C(this.max)}
              step=${C(this.step)}
              .value=${Ji(this.value)}
              autocapitalize=${C(this.autocapitalize)}
              autocomplete=${C(this.autocomplete)}
              autocorrect=${C(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${C(this.pattern)}
              enterkeyhint=${C(this.enterkeyhint)}
              inputmode=${C(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${i?c`
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
            ${this.passwordToggle&&!this.disabled?c`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible?c`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `:c`
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
          aria-hidden=${o?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};$.styles=[oe,Zi,Yi];$.dependencies={"sl-icon":Q};p([V(".input__control")],$.prototype,"input",2);p([v()],$.prototype,"hasFocus",2);p([d()],$.prototype,"title",2);p([d({reflect:!0})],$.prototype,"type",2);p([d()],$.prototype,"name",2);p([d()],$.prototype,"value",2);p([Gi()],$.prototype,"defaultValue",2);p([d({reflect:!0})],$.prototype,"size",2);p([d({type:Boolean,reflect:!0})],$.prototype,"filled",2);p([d({type:Boolean,reflect:!0})],$.prototype,"pill",2);p([d()],$.prototype,"label",2);p([d({attribute:"help-text"})],$.prototype,"helpText",2);p([d({type:Boolean})],$.prototype,"clearable",2);p([d({type:Boolean,reflect:!0})],$.prototype,"disabled",2);p([d()],$.prototype,"placeholder",2);p([d({type:Boolean,reflect:!0})],$.prototype,"readonly",2);p([d({attribute:"password-toggle",type:Boolean})],$.prototype,"passwordToggle",2);p([d({attribute:"password-visible",type:Boolean})],$.prototype,"passwordVisible",2);p([d({attribute:"no-spin-buttons",type:Boolean})],$.prototype,"noSpinButtons",2);p([d({reflect:!0})],$.prototype,"form",2);p([d({type:Boolean,reflect:!0})],$.prototype,"required",2);p([d()],$.prototype,"pattern",2);p([d({type:Number})],$.prototype,"minlength",2);p([d({type:Number})],$.prototype,"maxlength",2);p([d()],$.prototype,"min",2);p([d()],$.prototype,"max",2);p([d()],$.prototype,"step",2);p([d()],$.prototype,"autocapitalize",2);p([d()],$.prototype,"autocorrect",2);p([d()],$.prototype,"autocomplete",2);p([d({type:Boolean})],$.prototype,"autofocus",2);p([d()],$.prototype,"enterkeyhint",2);p([d({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],$.prototype,"spellcheck",2);p([d()],$.prototype,"inputmode",2);p([H("disabled",{waitUntilFirstUpdate:!0})],$.prototype,"handleDisabledChange",1);p([H("step",{waitUntilFirstUpdate:!0})],$.prototype,"handleStepChange",1);p([H("value",{waitUntilFirstUpdate:!0})],$.prototype,"handleValueChange",1);$.define("sl-input");var Qi=_`
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
`,xo=class extends B{constructor(){super(...arguments),this.hasSlotController=new Et(this,"footer","header","image")}render(){return c`
      <div
        part="base"
        class=${J({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};xo.styles=[oe,Qi];xo.define("sl-card");var ea=_`
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
`,ta=_`
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
`,W=class extends B{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(e){this.disabled&&(e.preventDefault(),e.stopPropagation())}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}render(){const e=!!this.href,t=e?jt`a`:jt`button`;return Bt`
      <${t}
        part="base"
        class=${J({"icon-button":!0,"icon-button--disabled":!e&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${C(e?void 0:this.disabled)}
        type=${C(e?void 0:"button")}
        href=${C(e?this.href:void 0)}
        target=${C(e?this.target:void 0)}
        download=${C(e?this.download:void 0)}
        rel=${C(e&&this.target?"noreferrer noopener":void 0)}
        role=${C(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${C(this.name)}
          library=${C(this.library)}
          src=${C(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${t}>
    `}};W.styles=[oe,ta];W.dependencies={"sl-icon":Q};p([V(".icon-button")],W.prototype,"button",2);p([v()],W.prototype,"hasFocus",2);p([d()],W.prototype,"name",2);p([d()],W.prototype,"library",2);p([d()],W.prototype,"src",2);p([d()],W.prototype,"href",2);p([d()],W.prototype,"target",2);p([d()],W.prototype,"download",2);p([d()],W.prototype,"label",2);p([d({type:Boolean,reflect:!0})],W.prototype,"disabled",2);var ra=0,ie=class extends B{constructor(){super(...arguments),this.localize=new Me(this),this.attrId=++ra,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(e){e.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,c`
      <div
        part="base"
        class=${J({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
      >
        <slot></slot>
        ${this.closable?c`
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
    `}};ie.styles=[oe,ea];ie.dependencies={"sl-icon-button":W};p([V(".tab")],ie.prototype,"tab",2);p([d({reflect:!0})],ie.prototype,"panel",2);p([d({type:Boolean,reflect:!0})],ie.prototype,"active",2);p([d({type:Boolean,reflect:!0})],ie.prototype,"closable",2);p([d({type:Boolean,reflect:!0})],ie.prototype,"disabled",2);p([d({type:Number,reflect:!0})],ie.prototype,"tabIndex",2);p([H("active")],ie.prototype,"handleActiveChange",1);p([H("disabled")],ie.prototype,"handleDisabledChange",1);ie.define("sl-tab");var sa=_`
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
`,oa=_`
  :host {
    display: contents;
  }
`,ar=class extends B{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{this.emit("sl-resize",{detail:{entries:e}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const e=this.shadowRoot.querySelector("slot");if(e!==null){const t=e.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],t.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return c` <slot @slotchange=${this.handleSlotChange}></slot> `}};ar.styles=[oe,oa];p([d({type:Boolean,reflect:!0})],ar.prototype,"disabled",2);p([H("disabled",{waitUntilFirstUpdate:!0})],ar.prototype,"handleDisabledChange",1);function ia(e,t){return{top:Math.round(e.getBoundingClientRect().top-t.getBoundingClientRect().top),left:Math.round(e.getBoundingClientRect().left-t.getBoundingClientRect().left)}}var Dr=new Set;function aa(){const e=document.documentElement.clientWidth;return Math.abs(window.innerWidth-e)}function na(){const e=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(e)||!e?0:e}function Sr(e){if(Dr.add(e),!document.documentElement.classList.contains("sl-scroll-lock")){const t=aa()+na();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),t<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${t}px`)}}function Er(e){Dr.delete(e),Dr.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function Ps(e,t,r="vertical",o="smooth"){const s=ia(e,t),i=s.top+t.scrollTop,a=s.left+t.scrollLeft,l=t.scrollLeft,n=t.scrollLeft+t.offsetWidth,h=t.scrollTop,u=t.scrollTop+t.offsetHeight;(r==="horizontal"||r==="both")&&(a<l?t.scrollTo({left:a,behavior:o}):a+e.clientWidth>n&&t.scrollTo({left:a-t.offsetWidth+e.clientWidth,behavior:o})),(r==="vertical"||r==="both")&&(i<h?t.scrollTo({top:i,behavior:o}):i+e.clientHeight>u&&t.scrollTo({top:i-t.offsetHeight+e.clientHeight,behavior:o}))}var M=class extends B{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new Me(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const e=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{const r=t.filter(({target:o})=>{if(o===this)return!0;if(o.closest("sl-tab-group")!==this)return!1;const s=o.tagName.toLowerCase();return s==="sl-tab"||s==="sl-tab-panel"});if(r.length!==0){if(r.some(o=>!["aria-labelledby","aria-controls"].includes(o.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(o=>o.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(o=>o.attributeName==="active")){const s=r.filter(i=>i.attributeName==="active"&&i.target.tagName.toLowerCase()==="sl-tab").map(i=>i.target).find(i=>i.active);s&&this.setActiveTab(s)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),e.then(()=>{new IntersectionObserver((r,o)=>{var s;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),o.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var e,t;super.disconnectedCallback(),(e=this.mutationObserver)==null||e.disconnect(),this.nav&&((t=this.resizeObserver)==null||t.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(e=>e.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(e=>e.active)}handleClick(e){const r=e.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(e){const r=e.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(e.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),e.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))){const s=this.tabs.find(l=>l.matches(":focus")),i=this.localize.dir()==="rtl";let a=null;if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){if(e.key==="Home")a=this.focusableTabs[0];else if(e.key==="End")a=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&e.key===(i?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&e.key==="ArrowUp"){const l=this.tabs.findIndex(n=>n===s);a=this.findNextFocusableTab(l,"backward")}else if(["top","bottom"].includes(this.placement)&&e.key===(i?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&e.key==="ArrowDown"){const l=this.tabs.findIndex(n=>n===s);a=this.findNextFocusableTab(l,"forward")}if(!a)return;a.tabIndex=0,a.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(a,{scrollBehavior:"smooth"}):this.tabs.forEach(l=>{l.tabIndex=l===a?0:-1}),["top","bottom"].includes(this.placement)&&Ps(a,this.nav,"horizontal"),e.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(e,t){if(t=Fe({emitEvents:!0,scrollBehavior:"auto"},t),e!==this.activeTab&&!e.disabled){const r=this.activeTab;this.activeTab=e,this.tabs.forEach(o=>{o.active=o===this.activeTab,o.tabIndex=o===this.activeTab?0:-1}),this.panels.forEach(o=>{var s;return o.active=o.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&Ps(this.activeTab,this.nav,"horizontal",t.scrollBehavior),t.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(e=>{const t=this.panels.find(r=>r.name===e.panel);t&&(e.setAttribute("aria-controls",t.getAttribute("id")),t.setAttribute("aria-labelledby",e.getAttribute("id")))})}repositionIndicator(){const e=this.getActiveTab();if(!e)return;const t=e.clientWidth,r=e.clientHeight,o=this.localize.dir()==="rtl",s=this.getAllTabs(),a=s.slice(0,s.indexOf(e)).reduce((l,n)=>({left:l.left+n.clientWidth,top:l.top+n.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${t}px`,this.indicator.style.height="auto",this.indicator.style.translate=o?`${-1*a.left}px`:`${a.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${a.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(e=>!e.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(e,t){let r=null;const o=t==="forward"?1:-1;let s=e+o;for(;e<this.tabs.length;){if(r=this.tabs[s]||null,r===null){t==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;s+=o}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(e){const t=this.tabs.find(r=>r.panel===e);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}render(){const e=this.localize.dir()==="rtl";return c`
      <div
        part="base"
        class=${J({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?c`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${J({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
                  name=${e?"chevron-right":"chevron-left"}
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

          ${this.hasScrollControls?c`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${J({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
                  name=${e?"chevron-left":"chevron-right"}
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
    `}};M.styles=[oe,sa];M.dependencies={"sl-icon-button":W,"sl-resize-observer":ar};p([V(".tab-group")],M.prototype,"tabGroup",2);p([V(".tab-group__body")],M.prototype,"body",2);p([V(".tab-group__nav")],M.prototype,"nav",2);p([V(".tab-group__indicator")],M.prototype,"indicator",2);p([v()],M.prototype,"hasScrollControls",2);p([v()],M.prototype,"shouldHideScrollStartButton",2);p([v()],M.prototype,"shouldHideScrollEndButton",2);p([d()],M.prototype,"placement",2);p([d()],M.prototype,"activation",2);p([d({attribute:"no-scroll-controls",type:Boolean})],M.prototype,"noScrollControls",2);p([d({attribute:"fixed-scroll-controls",type:Boolean})],M.prototype,"fixedScrollControls",2);p([Di({passive:!0})],M.prototype,"updateScrollButtons",1);p([H("noScrollControls",{waitUntilFirstUpdate:!0})],M.prototype,"updateScrollControls",1);p([H("placement",{waitUntilFirstUpdate:!0})],M.prototype,"syncIndicator",1);M.define("sl-tab-group");var la=(e,t)=>{let r=0;return function(...o){window.clearTimeout(r),r=window.setTimeout(()=>{e.call(this,...o)},t)}},As=(e,t,r)=>{const o=e[t];e[t]=function(...s){o.call(this,...s),r.call(this,o,...s)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const t=new Set,r=new WeakMap,o=i=>{for(const a of i.changedTouches)t.add(a.identifier)},s=i=>{for(const a of i.changedTouches)t.delete(a.identifier)};document.addEventListener("touchstart",o,!0),document.addEventListener("touchend",s,!0),document.addEventListener("touchcancel",s,!0),As(EventTarget.prototype,"addEventListener",function(i,a){if(a!=="scrollend")return;const l=la(()=>{t.size?l():this.dispatchEvent(new Event("scrollend"))},100);i.call(this,"scroll",l,{passive:!0}),r.set(this,l)}),As(EventTarget.prototype,"removeEventListener",function(i,a){if(a!=="scrollend")return;const l=r.get(this);l&&i.call(this,"scroll",l,{passive:!0})})}})();var ca=_`
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
`;function*Gr(e=document.activeElement){e!=null&&(yield e,"shadowRoot"in e&&e.shadowRoot&&e.shadowRoot.mode!=="closed"&&(yield*Pi(Gr(e.shadowRoot.activeElement))))}function da(){return[...Gr()].pop()}var Ts=new WeakMap;function _o(e){let t=Ts.get(e);return t||(t=window.getComputedStyle(e,null),Ts.set(e,t)),t}function ua(e){if(typeof e.checkVisibility=="function")return e.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const t=_o(e);return t.visibility!=="hidden"&&t.display!=="none"}function ha(e){const t=_o(e),{overflowY:r,overflowX:o}=t;return r==="scroll"||o==="scroll"?!0:r!=="auto"||o!=="auto"?!1:e.scrollHeight>e.clientHeight&&r==="auto"||e.scrollWidth>e.clientWidth&&o==="auto"}function pa(e){const t=e.tagName.toLowerCase(),r=Number(e.getAttribute("tabindex"));if(e.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||e.hasAttribute("disabled")||e.closest("[inert]"))return!1;if(t==="input"&&e.getAttribute("type")==="radio"){const i=e.getRootNode(),a=`input[type='radio'][name="${e.getAttribute("name")}"]`,l=i.querySelector(`${a}:checked`);return l?l===e:i.querySelector(a)===e}return ua(e)?(t==="audio"||t==="video")&&e.hasAttribute("controls")||e.hasAttribute("tabindex")||e.hasAttribute("contenteditable")&&e.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(t)?!0:ha(e):!1}function fa(e,t){var r;return((r=e.getRootNode({composed:!0}))==null?void 0:r.host)!==t}function Ds(e){const t=new WeakMap,r=[];function o(s){if(s instanceof Element){if(s.hasAttribute("inert")||s.closest("[inert]")||t.has(s))return;t.set(s,!0),!r.includes(s)&&pa(s)&&r.push(s),s instanceof HTMLSlotElement&&fa(s,e)&&s.assignedElements({flatten:!0}).forEach(i=>{o(i)}),s.shadowRoot!==null&&s.shadowRoot.mode==="open"&&o(s.shadowRoot)}for(const i of s.children)o(i)}return o(e),r.sort((s,i)=>{const a=Number(s.getAttribute("tabindex"))||0;return(Number(i.getAttribute("tabindex"))||0)-a})}var ct=[],ba=class{constructor(e){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=t=>{var r;if(t.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const o=da();if(this.previousFocus=o,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;t.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const s=Ds(this.element);let i=s.findIndex(l=>l===o);this.previousFocus=this.currentFocus;const a=this.tabDirection==="forward"?1:-1;for(;;){i+a>=s.length?i=0:i+a<0?i=s.length-1:i+=a,this.previousFocus=this.currentFocus;const l=s[i];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||l&&this.possiblyHasTabbableChildren(l))return;t.preventDefault(),this.currentFocus=l,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const n=[...Gr()];if(n.includes(this.currentFocus)||!n.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=e,this.elementsWithTabbableControls=["iframe"]}activate(){ct.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){ct=ct.filter(e=>e!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return ct[ct.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const e=Ds(this.element);if(!this.element.matches(":focus-within")){const t=e[0],r=e[e.length-1],o=this.tabDirection==="forward"?t:r;typeof(o==null?void 0:o.focus)=="function"&&(this.currentFocus=o,o.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(e){return this.elementsWithTabbableControls.includes(e.tagName.toLowerCase())||e.hasAttribute("controls")}},yo=e=>{var t;const{activeElement:r}=document;r&&e.contains(r)&&((t=document.activeElement)==null||t.blur())},wo=new Map,va=new WeakMap;function ma(e){return e??{keyframes:[],options:{duration:0}}}function zs(e,t){return t.toLowerCase()==="rtl"?{keyframes:e.rtlKeyframes||e.keyframes,options:e.options}:e}function K(e,t){wo.set(e,ma(t))}function $e(e,t,r){const o=va.get(e);if(o!=null&&o[t])return zs(o[t],r.dir);const s=wo.get(t);return s?zs(s,r.dir):{keyframes:[],options:{duration:0}}}function Vt(e,t){return new Promise(r=>{function o(s){s.target===e&&(e.removeEventListener(t,o),r())}e.addEventListener(t,o)})}function Se(e,t,r){return new Promise(o=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=e.animate(t,Kr(Fe({},r),{duration:ga()?0:r.duration}));s.addEventListener("cancel",o,{once:!0}),s.addEventListener("finish",o,{once:!0})})}function ga(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function je(e){return Promise.all(e.getAnimations().map(t=>new Promise(r=>{t.cancel(),requestAnimationFrame(r)})))}function Os(e){return e.charAt(0).toUpperCase()+e.slice(1)}var Y=class extends B{constructor(){super(...arguments),this.hasSlotController=new Et(this,"footer"),this.localize=new Me(this),this.modal=new ba(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=e=>{this.contained||e.key==="Escape"&&this.modal.isActive()&&this.open&&(e.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),Sr(this)))}disconnectedCallback(){super.disconnectedCallback(),Er(this),this.removeOpenListeners()}requestClose(e){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:e}}).defaultPrevented){const r=$e(this,"drawer.denyClose",{dir:this.localize.dir()});Se(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var e;"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var e;document.removeEventListener("keydown",this.handleDocumentKeyDown),(e=this.closeWatcher)==null||e.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),Sr(this));const e=this.querySelector("[autofocus]");e&&e.removeAttribute("autofocus"),await Promise.all([je(this.drawer),je(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(e?e.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),e&&e.setAttribute("autofocus","")});const t=$e(this,`drawer.show${Os(this.placement)}`,{dir:this.localize.dir()}),r=$e(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([Se(this.panel,t.keyframes,t.options),Se(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{yo(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),Er(this)),await Promise.all([je(this.drawer),je(this.overlay)]);const e=$e(this,`drawer.hide${Os(this.placement)}`,{dir:this.localize.dir()}),t=$e(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([Se(this.overlay,t.keyframes,t.options).then(()=>{this.overlay.hidden=!0}),Se(this.panel,e.keyframes,e.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),Sr(this)),this.open&&this.contained&&(this.modal.deactivate(),Er(this))}async show(){if(!this.open)return this.open=!0,Vt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Vt(this,"sl-after-hide")}render(){return c`
      <div
        part="base"
        class=${J({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${C(this.noHeader?this.label:void 0)}
          aria-labelledby=${C(this.noHeader?void 0:"title")}
          tabindex="0"
        >
          ${this.noHeader?"":c`
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
    `}};Y.styles=[oe,ca];Y.dependencies={"sl-icon-button":W};p([V(".drawer")],Y.prototype,"drawer",2);p([V(".drawer__panel")],Y.prototype,"panel",2);p([V(".drawer__overlay")],Y.prototype,"overlay",2);p([d({type:Boolean,reflect:!0})],Y.prototype,"open",2);p([d({reflect:!0})],Y.prototype,"label",2);p([d({reflect:!0})],Y.prototype,"placement",2);p([d({type:Boolean,reflect:!0})],Y.prototype,"contained",2);p([d({attribute:"no-header",type:Boolean,reflect:!0})],Y.prototype,"noHeader",2);p([H("open",{waitUntilFirstUpdate:!0})],Y.prototype,"handleOpenChange",1);p([H("contained",{waitUntilFirstUpdate:!0})],Y.prototype,"handleNoModalChange",1);K("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});K("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});K("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});K("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});K("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});K("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});K("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});K("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});K("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});K("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});K("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});Y.define("sl-drawer");var xa=_`
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
`,G=class we extends B{constructor(){super(...arguments),this.hasSlotController=new Et(this,"icon","suffix"),this.localize=new Me(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var t;(t=this.countdownAnimation)==null||t.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var t;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(t=this.countdownAnimation)==null||t.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:t}=this,r="100%",o="0";this.countdownAnimation=t.animate([{width:r},{width:o}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await je(this.base),this.base.hidden=!1;const{keyframes:t,options:r}=$e(this,"alert.show",{dir:this.localize.dir()});await Se(this.base,t,r),this.emit("sl-after-show")}else{yo(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await je(this.base);const{keyframes:t,options:r}=$e(this,"alert.hide",{dir:this.localize.dir()});await Se(this.base,t,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Vt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Vt(this,"sl-after-hide")}async toast(){return new Promise(t=>{this.handleCountdownChange(),we.toastStack.parentElement===null&&document.body.append(we.toastStack),we.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{we.toastStack.removeChild(this),t(),we.toastStack.querySelector("sl-alert")===null&&we.toastStack.remove()},{once:!0})})}render(){return c`
      <div
        part="base"
        class=${J({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
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

        ${this.closable?c`
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

        ${this.countdown?c`
              <div
                class=${J({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};G.styles=[oe,xa];G.dependencies={"sl-icon-button":W};p([V('[part~="base"]')],G.prototype,"base",2);p([V(".alert__countdown-elapsed")],G.prototype,"countdownElement",2);p([d({type:Boolean,reflect:!0})],G.prototype,"open",2);p([d({type:Boolean,reflect:!0})],G.prototype,"closable",2);p([d({reflect:!0})],G.prototype,"variant",2);p([d({type:Number})],G.prototype,"duration",2);p([d({type:String,reflect:!0})],G.prototype,"countdown",2);p([v()],G.prototype,"remainingTime",2);p([H("open",{waitUntilFirstUpdate:!0})],G.prototype,"handleOpenChange",1);p([H("duration")],G.prototype,"handleDurationChange",1);var _a=G;K("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});K("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});_a.define("sl-alert");function ya(e,t){const r=new Set([...Object.keys(e),...Object.keys(t)]);for(const o of r)if((e[o]??"")!==(t[o]??""))return!0;return!1}const wa={view:"search",search:{state:"initial",currentSession:null,query:"",queryWords:[],results:[],total:0,source:"fts",offset:0,limit:20},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,status:null,watcher:null,reindex:{dialog:"closed",current_file:null,indexed_count:0,result:null,error:null},error:null,settings:{scope:"global",values:{},original:{},dirty:!1,exists:!0,saving:!1,error:null},files:{treeCache:{},expandedPaths:[],currentDir:"",selectedPaths:[],lastSelectedAnchor:null,detail:null,detailLoading:!1,listing:!1,mobilePane:"tree",pendingAction:null,error:null,filenameSearch:{query:"",allDocs:[],docsLoading:!0,docsError:null,results:[],selectedPath:null,isActive:!1,totalMatches:0}}};class ka{constructor(){this.state=wa,this.listeners=new Set}getState(){return this.state}setState(t){this.state={...this.state,...t},this.listeners.forEach(r=>r(this.state))}subscribe(t){return this.listeners.add(t),()=>this.listeners.delete(t)}subscribeSelector(t,r){let o=t(this.state);return this.subscribe(s=>{const i=t(s);i!==o&&(o=i,r(i))})}}const f=new ka,m={setView(e){f.setState({view:e})},setSearchState(e){const t=f.getState().search;f.setState({search:{...t,...e}})},setChatState(e){const t=f.getState().chat;f.setState({chat:{...t,...e}})},pushDetail(e){const t=f.getState().detailStack;f.setState({detailStack:[...t,e]})},popDetail(){const e=f.getState().detailStack;e.length!==0&&f.setState({detailStack:e.slice(0,-1)})},setError(e){f.setState({error:e})},setPendingSession(e){f.setState({pendingSession:e})},setWatcherStatus(e){f.setState({watcher:e})},openReindexConfirm(){const e=f.getState().reindex;f.setState({reindex:{...e,dialog:"confirm"}})},startReindex(){f.setState({reindex:{...f.getState().reindex,dialog:"running",current_file:null,indexed_count:0,result:null,error:null}})},setReindexProgress(e){const t=f.getState().reindex;t.dialog==="running"&&f.setState({reindex:{...t,current_file:e.current_file,indexed_count:e.indexed_count}})},finishReindex(e){f.setState({reindex:{...f.getState().reindex,dialog:"done",result:e}})},failReindex(e){f.setState({reindex:{...f.getState().reindex,dialog:"error",error:e}})},closeReindex(){f.setState({reindex:{dialog:"closed",current_file:null,indexed_count:0,result:null,error:null}})},setSettingsScope(e){},loadSettings(e,t){const r=f.getState().settings;f.setState({settings:{...r,values:{...e},original:{...e},exists:t,dirty:!1,error:null}})},updateSetting(e,t){const r=f.getState().settings,o={...r.values,[e]:t},s=ya(r.original,o);f.setState({settings:{...r,values:o,dirty:s}})},revertSettings(){const e=f.getState().settings,t={...e.original};f.setState({settings:{...e,values:t,dirty:!1}})},setSettingsSaving(e){const t=f.getState().settings;f.setState({settings:{...t,saving:e}})},setSettingsError(e){const t=f.getState().settings;f.setState({settings:{...t,error:e}})},setFilesState(e){const t=f.getState().files;f.setState({files:{...t,...e}})},expandDir(e){const t=f.getState().files;t.expandedPaths.includes(e)||f.setState({files:{...t,expandedPaths:[...t.expandedPaths,e]}})},collapseDir(e){const t=f.getState().files;f.setState({files:{...t,expandedPaths:t.expandedPaths.filter(r=>r!==e)}})},selectDir(e){const t=f.getState().files;f.setState({files:{...t,currentDir:e,selectedPaths:[],lastSelectedAnchor:null,detail:null,mobilePane:t.mobilePane==="tree"?"list":t.mobilePane}})},selectEntry(e,t={}){const r=f.getState().files;let o,s=r.lastSelectedAnchor;if(t.shift&&s!==null){const a=(r.treeCache[r.currentDir]||[]).map(h=>h.path),l=a.indexOf(s),n=a.indexOf(e);if(l>=0&&n>=0){const[h,u]=l<n?[l,n]:[n,l];o=a.slice(h,u+1)}else o=[e],s=e}else t.ctrl?(o=r.selectedPaths.includes(e)?r.selectedPaths.filter(i=>i!==e):[...r.selectedPaths,e],s=e):(o=[e],s=e);f.setState({files:{...r,selectedPaths:o,lastSelectedAnchor:s}})},clearSelection(){const e=f.getState().files;f.setState({files:{...e,selectedPaths:[],lastSelectedAnchor:null,detail:null}})},invalidateDir(e){const t=f.getState().files,r={...t.treeCache};delete r[e],f.setState({files:{...t,treeCache:r}})},invalidateSubtree(e){const t=f.getState().files,r={};for(const[o,s]of Object.entries(t.treeCache))o!==e&&!o.startsWith(e+"/")&&(r[o]=s);f.setState({files:{...t,treeCache:r}})},setMobilePane(e){const t=f.getState().files;f.setState({files:{...t,mobilePane:e}})},loadIndexedDocuments(e){const t=f.getState().files;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,allDocs:e,docsLoading:!1,docsError:null}}})},setFilenameSearchDocsError(e){const t=f.getState().files;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,docsLoading:!1,docsError:e}}})},setFilenameSearchQuery(e){var s;const t=f.getState().files,r=e.query.trim()!=="",o=r?((s=e.results[0])==null?void 0:s.path)??null:null;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,query:e.query,results:e.results,totalMatches:e.totalMatches,isActive:r,selectedPath:o}}})},clearFilenameSearch(){const e=f.getState().files;f.setState({files:{...e,filenameSearch:{...e.filenameSearch,query:"",results:[],totalMatches:0,isActive:!1,selectedPath:null}}})},selectFilenameSearchResult(e){const t=f.getState().files;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,selectedPath:e}}})}},qt={search:"#/search",chat:"#/chat",files:"#/files",settings:"#/settings"},$a=Object.fromEntries(Object.entries(qt).map(([e,t])=>[t,e])),Sa="search";function Ea(e){if(!e)return null;const t=e.split("?")[0];return $a[t]??null}let Cr=!1;function Xt(){return typeof window<"u"?window.location.hash:""}function zr(){return Ea(Xt())??Sa}function ko(e){if(typeof window>"u")return;const t=new URL(window.location.href);t.hash=e,window.history.replaceState(null,"",t)}function Rs(){const e=zr(),t=qt[e];Xt()!==t&&ko(t),m.setView(e)}const Is={init(){if(Cr)return;Cr=!0;const e=zr(),t=qt[e];Xt()!==t&&ko(t),m.setView(e),typeof window<"u"&&window.addEventListener("hashchange",Rs)},navigate(e){const t=qt[e];Xt()!==t&&typeof window<"u"&&(window.location.hash=t)},current(){return zr()},_reset(){typeof window<"u"&&window.removeEventListener("hashchange",Rs),Cr=!1}};var Ca=Object.defineProperty,Pa=Object.getOwnPropertyDescriptor,$o=(e,t,r,o)=>{for(var s=o>1?void 0:o?Pa(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Ca(t,r,s),s};let Kt=class extends k{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"files",icon:"📁",label:"文件"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return c`
      ${this._items.map(e=>c`
        <button
          class=${this.active===e.id?"active":""}
          title=${e.label}
          @click=${()=>this._select(e.id)}>
          ${e.icon}
        </button>`)}
    `}};Kt.styles=_`
    :host {
      display: var(--cortex-show-activity-bar, none);
      flex-direction: column;
      align-items: center;
      width: var(--cortex-activity-bar-width);
      background-color: var(--cortex-border-muted);
      background-image: radial-gradient(circle, var(--cortex-border) 0.7px, transparent 1px);
      background-size: 10px 10px;
      color: var(--cortex-text-muted);
      border-right: 1px solid var(--cortex-border);
      padding: var(--cortex-space-4) 0;
      gap: var(--cortex-space-4);
      flex-shrink: 0;
    }
    button {
      width: 40px; height: 40px;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    }
    button:hover { background: var(--cortex-surface-muted); color: var(--cortex-text); }
    button.active {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      box-shadow: inset 2px 0 0 var(--cortex-primary);
    }
  `;$o([d()],Kt.prototype,"active",2);Kt=$o([E("activity-bar")],Kt);var Aa=Object.defineProperty,Ta=Object.getOwnPropertyDescriptor,So=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ta(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Aa(t,r,s),s};let Yt=class extends k{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"files",icon:"📁",label:"文件"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return c`
      ${this._items.map(e=>c`
        <button
          class="tab ${this.active===e.id?"active":""}"
          @click=${()=>this._select(e.id)}>
          <span class="icon">${e.icon}</span>
          <span>${e.label}</span>
        </button>`)}
    `}};Yt.styles=_`
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
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      font-size: 10px;
      /* 上多下少：图标视觉重心略偏下，padding 把它往中间拉 */
      padding: 8px 0 2px;
      transition: background 0.15s, color 0.15s;
    }
    .tab:hover { background: var(--cortex-surface-muted); }
    .tab.active { color: var(--cortex-primary); font-weight: 600; }
    .tab .icon { font-size: 18px; line-height: 1; }
  `;So([d()],Yt.prototype,"active",2);Yt=So([E("tab-bar")],Yt);var Da=Object.defineProperty,za=Object.getOwnPropertyDescriptor,nr=(e,t,r,o)=>{for(var s=o>1?void 0:o?za(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Da(t,r,s),s};let Xe=class extends k{constructor(){super(...arguments),this.heading="Doclens",this.subheading="",this.suffix=""}render(){return c`
      <h1 class="title">
        <span class="accent">${this.heading}</span>${this.suffix?c`<span class="sep">·</span><span>${this.suffix}</span>`:null}
      </h1>
      ${this.subheading?c`<p class="subtitle">${this.subheading}</p>`:null}
    `}};Xe.styles=_`
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
    /* suffix（如「问日程」）——紧跟在 .sep 之后的 span */
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
    @media (min-width: 1024px) {
      :host {
        padding: 28px var(--cortex-space-4) 18px;
      }
    }
  `;nr([d()],Xe.prototype,"heading",2);nr([d()],Xe.prototype,"subheading",2);nr([d()],Xe.prototype,"suffix",2);Xe=nr([E("welcome-pane")],Xe);var Oa=Object.defineProperty,Ra=Object.getOwnPropertyDescriptor,et=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ra(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Oa(t,r,s),s};let ve=class extends k{constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta="",this.actions=[],this._menuOpen=!1,this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}_onMoreClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onItemClick(e){e.disabled||(this._menuOpen=!1,e.onClick())}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return c`
      <button class="back" aria-label=${this.backLabel} title=${this.backLabel} @click=${this._back}>‹</button>
      <div class="title">${this.title}</div>
      ${this.meta?c`<div class="meta">${this.meta}</div>`:null}
      ${this.actions.length>0?c`
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
            <span class="kebab" aria-hidden="true">${this._menuOpen?"⋯":"⋮"}</span>
          </button>
          <div class="menu ${this._menuOpen?"open":""}" role="menu">
            ${this.actions.map(e=>c`
              <button
                class="menu-item"
                type="button"
                role="menuitem"
                ?disabled=${e.disabled??!1}
                @click=${()=>this._onItemClick(e)}
              >
                ${e.icon?c`<span class="icon">${e.icon}</span>`:null}
                <span class="label">${e.label}</span>
              </button>
            `)}
          </div>
        </div>
      `:null}
    `}};ve.styles=_`
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
  `;et([d()],ve.prototype,"backLabel",2);et([d()],ve.prototype,"title",2);et([d()],ve.prototype,"meta",2);et([d({attribute:!1})],ve.prototype,"actions",2);et([v()],ve.prototype,"_menuOpen",2);ve=et([E("focus-header")],ve);var Ia=Object.defineProperty,La=Object.getOwnPropertyDescriptor,Ct=(e,t,r,o)=>{for(var s=o>1?void 0:o?La(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Ia(t,r,s),s};let Te=class extends k{constructor(){super(...arguments),this.title="历史会话",this.sessions=[],this.clearing=!1}_onClear(){this.clearing||this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){const e=this.sessions.length>0;return c`
      <div class="header">
        <div class="title">${this.title}</div>
        ${e?c`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing?"清空中...":"清空"}
          </button>`:null}
      </div>
      ${this.sessions.length===0?c`<div class="empty">暂无历史会话</div>`:this.sessions.map(t=>c`<history-item .session=${t}></history-item>`)}
    `}};Te.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-6) var(--cortex-space-3);
      flex: 1;
      /* min-height:0 允许在 flex column 容器内收缩到 content 以下，
         配合 overflow-y:auto 实现内部滚动。缺少时 min-height 默认为
         auto(=min-content)，历史会话多时会撑开父容器，把底部 tab-bar
         推出视口。 */
      min-height: 0;
      overflow-y: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: var(--cortex-space-2) 0 var(--cortex-space-1) 0;
    }
    .title {
      font-size: var(--cortex-fs-sm);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--cortex-text-muted);
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
  `;Ct([d()],Te.prototype,"title",2);Ct([d({attribute:!1})],Te.prototype,"sessions",2);Ct([d()],Te.prototype,"type",2);Ct([d({type:Boolean})],Te.prototype,"clearing",2);Te=Ct([E("history-list")],Te);var Ma=Object.defineProperty,Fa=Object.getOwnPropertyDescriptor,Eo=(e,t,r,o)=>{for(var s=o>1?void 0:o?Fa(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Ma(t,r,s),s};let Gt=class extends k{constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){if(!this.session)return null;const e=[];return this.session.type==="chat"&&e.push(String(this.session.message_count)),e.push(new Date(this.session.updated_at).toLocaleDateString()),c`
      <div class="name">
        ${this.session.mode==="grep"?c`<span class="mode-tag" title="正则 grep">grep</span>`:null}
        ${this.session.title}
      </div>
      <div class="meta">${e.join(" · ")}</div>
    `}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};Gt.styles=_`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    :host(:hover) {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-subtle);
    }
    .name {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      font-weight: 500;
    }
    .meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
    .mode-tag {
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      font-size: var(--cortex-fs-xs);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
      line-height: 1.5;
    }
  `;Eo([d({attribute:!1})],Gt.prototype,"session",2);Gt=Eo([E("history-item")],Gt);var Na=Object.defineProperty,Wa=Object.getOwnPropertyDescriptor,ae=(e,t,r,o)=>{for(var s=o>1?void 0:o?Wa(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Na(t,r,s),s};let q=class extends k{constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.multiline=!1,this.disabled=!1,this.mode="keyword",this.modes=null,this._menuOpen=!1,this._onDocClick=()=>{this._menuOpen=!1,document.removeEventListener("click",this._onDocClick)}}focus(){var e;(e=this.inputEl)==null||e.focus()}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("value")||e.has("multiline"))&&this._autoResize()}_autoResize(){const e=this.renderRoot.querySelector("textarea");e&&(e.style.height="auto",e.style.height=`${e.scrollHeight}px`)}get trimmed(){return this.value.trim()}_onInput(e){const t=e.target;this.value=t.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled),this._autoResize()}_onKeydown(e){e.key==="Enter"&&(e.shiftKey&&this.multiline||(e.preventDefault(),this._submit()))}_submit(){!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}get _hasModes(){return!!this.modes&&this.mode in this.modes}_toggleMenu(e){e.stopPropagation(),this._menuOpen=!this._menuOpen,this._menuOpen&&document.addEventListener("click",this._onDocClick)}_selectMode(e){this._menuOpen=!1,document.removeEventListener("click",this._onDocClick),this.dispatchEvent(new CustomEvent("mode-change",{detail:{mode:e}}))}_renderButton(){if(!this._hasModes)return c`
        <button @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${this.buttonIcon?c`<span aria-hidden="true">${this.buttonIcon}</span>`:null}
          <span>${this.buttonLabel}</span>
        </button>`;const e=this.modes[this.mode];return c`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${e!=null&&e.icon?c`<span aria-hidden="true">${e.icon}</span>`:null}
          <span>${(e==null?void 0:e.label)??this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}>▾</button>
      </div>`}_renderMenu(){return!this._hasModes||!this._menuOpen?null:c`
      <div class="menu" role="menu">
        ${Object.keys(this.modes).map(e=>{const t=this.modes[e];return c`
            <div class="menu-item ${e===this.mode?"active":""}" role="menuitem"
                 @click=${()=>this._selectMode(e)}>
              <span class="menu-item-title">
                ${t.icon?c`<span aria-hidden="true">${t.icon}</span>`:null}${t.label}
              </span>
              ${t.description?c`<span class="menu-item-desc">${t.description}</span>`:null}
            </div>`})}
      </div>`}render(){const e=this.multiline?c`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`:c`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;return c`
      <div class="wrapper">
        ${e}
        ${this._renderButton()}
        ${this._renderMenu()}
      </div>
    `}};q.styles=_`
    :host {
      display: block;
      --min-h: 48px;
    }
    .wrapper {
      position: relative;
      display: flex;
      align-items: center;
      border: 1px solid var(--cortex-chat-input-border);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-chat-input-bg);
      min-height: var(--min-h);
      padding: 0 var(--cortex-input-btn-reserve, calc(var(--min-h) + 6px)) 0 18px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .wrapper:focus-within {
      border-color: var(--cortex-primary);
      background: var(--cortex-surface);
      box-shadow: var(--cortex-focus-ring);
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
      padding: 11px 0;
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
      background: var(--cortex-primary-gradient);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-lg);
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
      box-shadow: var(--cortex-primary-glow);
      transition: filter 0.15s, transform 0.1s;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    button:hover:not(:disabled) { filter: brightness(1.05); }
    button:active:not(:disabled) { transform: translateY(-50%) scale(0.96); }
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
      border-radius: var(--cortex-radius-lg) 0 0 var(--cortex-radius-lg);
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
      border-radius: 0 var(--cortex-radius-md) var(--cortex-radius-md) 0;
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
  `;ae([d()],q.prototype,"value",2);ae([d()],q.prototype,"placeholder",2);ae([d()],q.prototype,"buttonLabel",2);ae([d()],q.prototype,"buttonIcon",2);ae([d({type:Boolean})],q.prototype,"multiline",2);ae([d({type:Boolean})],q.prototype,"disabled",2);ae([d()],q.prototype,"mode",2);ae([d({attribute:!1})],q.prototype,"modes",2);ae([v()],q.prototype,"_menuOpen",2);ae([V("input, textarea")],q.prototype,"inputEl",2);q=ae([E("input-box")],q);function Zr(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Ne=Zr();function Co(e){Ne=e}var Ee={exec:()=>null};function Be(e){let t=[];return r=>{let o=Math.max(0,Math.min(3,r-1)),s=t[o];return s||(s=e(o),t[o]=s),s}}function A(e,t=""){let r=typeof e=="string"?e:e.source,o={replace:(s,i)=>{let a=typeof i=="string"?i:i.source;return a=a.replace(N.caret,"$1"),r=r.replace(s,a),o},getRegex:()=>new RegExp(r,t)};return o}var Ba=((e="")=>{try{return!!new RegExp("(?<=1)(?<!1)"+e)}catch{return!1}})(),N={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:Be(e=>new RegExp(`^ {0,${e}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:Be(e=>new RegExp(`^ {0,${e}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:Be(e=>new RegExp(`^ {0,${e}}(?:\`\`\`|~~~)`)),headingBeginRegex:Be(e=>new RegExp(`^ {0,${e}}#`)),htmlBeginRegex:Be(e=>new RegExp(`^ {0,${e}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:Be(e=>new RegExp(`^ {0,${e}}>`))},Ha=/^(?:[ \t]*(?:\n|$))+/,Ua=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,ja=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,Pt=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Va=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Jr=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,Po=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,Ao=A(Po).replace(/bull/g,Jr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),qa=A(Po).replace(/bull/g,Jr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Qr=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,Xa=/^[^\n]+/,es=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,Ka=A(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",es).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Ya=A(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,Jr).getRegex(),lr="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",ts=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Ga=A("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",ts).replace("tag",lr).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),To=A(Qr).replace("hr",Pt).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",lr).getRegex(),Za=A(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",To).getRegex(),rs={blockquote:Za,code:Ua,def:Ka,fences:ja,heading:Va,hr:Pt,html:Ga,lheading:Ao,list:Ya,newline:Ha,paragraph:To,table:Ee,text:Xa},Ls=A("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",Pt).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",lr).getRegex(),Ja={...rs,lheading:qa,table:Ls,paragraph:A(Qr).replace("hr",Pt).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",Ls).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",lr).getRegex()},Qa={...rs,html:A(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",ts).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:Ee,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:A(Qr).replace("hr",Pt).replace("heading",` *#{1,6} *[^
]`).replace("lheading",Ao).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},en=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,tn=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Do=/^( {2,}|\\)\n(?!\s*$)/,rn=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,tt=/[\p{P}\p{S}]/u,cr=/[\s\p{P}\p{S}]/u,ss=/[^\s\p{P}\p{S}]/u,sn=A(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,cr).getRegex(),zo=/(?!~)[\p{P}\p{S}]/u,on=/(?!~)[\s\p{P}\p{S}]/u,an=/(?:[^\s\p{P}\p{S}]|~)/u,nn=A(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",Ba?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),Oo=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,ln=A(Oo,"u").replace(/punct/g,tt).getRegex(),cn=A(Oo,"u").replace(/punct/g,zo).getRegex(),Ro="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",dn=A(Ro,"gu").replace(/notPunctSpace/g,ss).replace(/punctSpace/g,cr).replace(/punct/g,tt).getRegex(),un=A(Ro,"gu").replace(/notPunctSpace/g,an).replace(/punctSpace/g,on).replace(/punct/g,zo).getRegex(),hn=A("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,ss).replace(/punctSpace/g,cr).replace(/punct/g,tt).getRegex(),pn=A(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,tt).getRegex(),fn="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",bn=A(fn,"gu").replace(/notPunctSpace/g,ss).replace(/punctSpace/g,cr).replace(/punct/g,tt).getRegex(),vn=A(/\\(punct)/,"gu").replace(/punct/g,tt).getRegex(),mn=A(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),gn=A(ts).replace("(?:-->|$)","-->").getRegex(),xn=A("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",gn).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Zt=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,_n=A(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",Zt).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),Io=A(/^!?\[(label)\]\[(ref)\]/).replace("label",Zt).replace("ref",es).getRegex(),Lo=A(/^!?\[(ref)\](?:\[\])?/).replace("ref",es).getRegex(),yn=A("reflink|nolink(?!\\()","g").replace("reflink",Io).replace("nolink",Lo).getRegex(),Ms=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,os={_backpedal:Ee,anyPunctuation:vn,autolink:mn,blockSkip:nn,br:Do,code:tn,del:Ee,delLDelim:Ee,delRDelim:Ee,emStrongLDelim:ln,emStrongRDelimAst:dn,emStrongRDelimUnd:hn,escape:en,link:_n,nolink:Lo,punctuation:sn,reflink:Io,reflinkSearch:yn,tag:xn,text:rn,url:Ee},wn={...os,link:A(/^!?\[(label)\]\((.*?)\)/).replace("label",Zt).getRegex(),reflink:A(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Zt).getRegex()},Or={...os,emStrongRDelimAst:un,emStrongLDelim:cn,delLDelim:pn,delRDelim:bn,url:A(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",Ms).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:A(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",Ms).getRegex()},kn={...Or,br:A(Do).replace("{2,}","*").getRegex(),text:A(Or.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Mt={normal:rs,gfm:Ja,pedantic:Qa},dt={normal:os,gfm:Or,breaks:kn,pedantic:wn},$n={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},Fs=e=>$n[e];function le(e,t){if(t){if(N.escapeTest.test(e))return e.replace(N.escapeReplace,Fs)}else if(N.escapeTestNoEncode.test(e))return e.replace(N.escapeReplaceNoEncode,Fs);return e}function Ns(e){try{e=encodeURI(e).replace(N.percentDecode,"%")}catch{return null}return e}function Ws(e,t){var i;let r=e.replace(N.findPipe,(a,l,n)=>{let h=!1,u=l;for(;--u>=0&&n[u]==="\\";)h=!h;return h?"|":" |"}),o=r.split(N.splitPipe),s=0;if(o[0].trim()||o.shift(),o.length>0&&!((i=o.at(-1))!=null&&i.trim())&&o.pop(),t)if(o.length>t)o.splice(t);else for(;o.length<t;)o.push("");for(;s<o.length;s++)o[s]=o[s].trim().replace(N.slashPipe,"|");return o}function ue(e,t,r){let o=e.length;if(o===0)return"";let s=0;for(;s<o&&e.charAt(o-s-1)===t;)s++;return e.slice(0,o-s)}function Bs(e){let t=e.split(`
`),r=t.length-1;for(;r>=0&&N.blankLine.test(t[r]);)r--;return t.length-r<=2?e:t.slice(0,r+1).join(`
`)}function Sn(e,t){if(e.indexOf(t[1])===-1)return-1;let r=0;for(let o=0;o<e.length;o++)if(e[o]==="\\")o++;else if(e[o]===t[0])r++;else if(e[o]===t[1]&&(r--,r<0))return o;return r>0?-2:-1}function En(e,t=0){let r=t,o="";for(let s of e)if(s==="	"){let i=4-r%4;o+=" ".repeat(i),r+=i}else o+=s,r++;return o}function Hs(e,t,r,o,s){let i=t.href,a=t.title||null,l=e[1].replace(s.other.outputLinkReplace,"$1");o.state.inLink=!0;let n={type:e[0].charAt(0)==="!"?"image":"link",raw:r,href:i,title:a,text:l,tokens:o.inlineTokens(l)};return o.state.inLink=!1,n}function Cn(e,t,r){let o=e.match(r.other.indentCodeCompensation);if(o===null)return t;let s=o[1];return t.split(`
`).map(i=>{let a=i.match(r.other.beginningSpace);if(a===null)return i;let[l]=a;return l.length>=s.length?i.slice(s.length):i}).join(`
`)}var Jt=class{constructor(e){z(this,"options");z(this,"rules");z(this,"lexer");this.options=e||Ne}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let r=this.options.pedantic?t[0]:Bs(t[0]),o=r.replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:r,codeBlockStyle:"indented",text:o}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let r=t[0],o=Cn(r,t[3]||"",this.rules);return{type:"code",raw:r,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:o}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let r=t[2].trim();if(this.rules.other.endingHash.test(r)){let o=ue(r,"#");(this.options.pedantic||!o||this.rules.other.endingSpaceChar.test(o))&&(r=o.trim())}return{type:"heading",raw:ue(t[0],`
`),depth:t[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:ue(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let r=ue(t[0],`
`).split(`
`),o="",s="",i=[];for(;r.length>0;){let a=!1,l=[],n;for(n=0;n<r.length;n++)if(this.rules.other.blockquoteStart.test(r[n]))l.push(r[n]),a=!0;else if(!a)l.push(r[n]);else break;r=r.slice(n);let h=l.join(`
`),u=h.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");o=o?`${o}
${h}`:h,s=s?`${s}
${u}`:u;let b=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(u,i,!0),this.lexer.state.top=b,r.length===0)break;let x=i.at(-1);if((x==null?void 0:x.type)==="code")break;if((x==null?void 0:x.type)==="blockquote"){let S=x,g=S.raw+`
`+r.join(`
`),I=this.blockquote(g);i[i.length-1]=I,o=o.substring(0,o.length-S.raw.length)+I.raw,s=s.substring(0,s.length-S.text.length)+I.text;break}else if((x==null?void 0:x.type)==="list"){let S=x,g=S.raw+`
`+r.join(`
`),I=this.list(g);i[i.length-1]=I,o=o.substring(0,o.length-x.raw.length)+I.raw,s=s.substring(0,s.length-S.raw.length)+I.raw,r=g.substring(i.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:o,tokens:i,text:s}}}list(e){let t=this.rules.block.list.exec(e);if(t){let r=t[1].trim(),o=r.length>1,s={type:"list",raw:"",ordered:o,start:o?+r.slice(0,-1):"",loose:!1,items:[]};r=o?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=o?r:"[*+-]");let i=this.rules.other.listItemRegex(r),a=!1;for(;e;){let n=!1,h="",u="";if(!(t=i.exec(e))||this.rules.block.hr.test(e))break;h=t[0],e=e.substring(h.length);let b=En(t[2].split(`
`,1)[0],t[1].length),x=e.split(`
`,1)[0],S=!b.trim(),g=0;if(this.options.pedantic?(g=2,u=b.trimStart()):S?g=t[1].length+1:(g=b.search(this.rules.other.nonSpaceChar),g=g>4?1:g,u=b.slice(g),g+=t[1].length),S&&this.rules.other.blankLine.test(x)&&(h+=x+`
`,e=e.substring(x.length+1),n=!0),!n){let I=this.rules.other.nextBulletRegex(g),R=this.rules.other.hrRegex(g),Rt=this.rules.other.fencesBeginRegex(g),xe=this.rules.other.headingBeginRegex(g),br=this.rules.other.htmlBeginRegex(g),Ko=this.rules.other.blockquoteBeginRegex(g);for(;e;){let vr=e.split(`
`,1)[0],st;if(x=vr,this.options.pedantic?(x=x.replace(this.rules.other.listReplaceNesting,"  "),st=x):st=x.replace(this.rules.other.tabCharGlobal,"    "),Rt.test(x)||xe.test(x)||br.test(x)||Ko.test(x)||I.test(x)||R.test(x))break;if(st.search(this.rules.other.nonSpaceChar)>=g||!x.trim())u+=`
`+st.slice(g);else{if(S||b.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||Rt.test(b)||xe.test(b)||R.test(b))break;u+=`
`+x}S=!x.trim(),h+=vr+`
`,e=e.substring(vr.length+1),b=st.slice(g)}}s.loose||(a?s.loose=!0:this.rules.other.doubleBlankLine.test(h)&&(a=!0)),s.items.push({type:"list_item",raw:h,task:!!this.options.gfm&&this.rules.other.listIsTask.test(u),loose:!1,text:u,tokens:[]}),s.raw+=h}let l=s.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;s.raw=s.raw.trimEnd();for(let n of s.items){this.lexer.state.top=!1,n.tokens=this.lexer.blockTokens(n.text,[]);let h=n.tokens[0];if(n.task&&((h==null?void 0:h.type)==="text"||(h==null?void 0:h.type)==="paragraph")){n.text=n.text.replace(this.rules.other.listReplaceTask,""),h.raw=h.raw.replace(this.rules.other.listReplaceTask,""),h.text=h.text.replace(this.rules.other.listReplaceTask,"");for(let b=this.lexer.inlineQueue.length-1;b>=0;b--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[b].src)){this.lexer.inlineQueue[b].src=this.lexer.inlineQueue[b].src.replace(this.rules.other.listReplaceTask,"");break}let u=this.rules.other.listTaskCheckbox.exec(n.raw);if(u){let b={type:"checkbox",raw:u[0]+" ",checked:u[0]!=="[ ]"};n.checked=b.checked,s.loose?n.tokens[0]&&["paragraph","text"].includes(n.tokens[0].type)&&"tokens"in n.tokens[0]&&n.tokens[0].tokens?(n.tokens[0].raw=b.raw+n.tokens[0].raw,n.tokens[0].text=b.raw+n.tokens[0].text,n.tokens[0].tokens.unshift(b)):n.tokens.unshift({type:"paragraph",raw:b.raw,text:b.raw,tokens:[b]}):n.tokens.unshift(b)}}else n.task&&(n.task=!1);if(!s.loose){let u=n.tokens.filter(x=>x.type==="space"),b=u.length>0&&u.some(x=>this.rules.other.anyLine.test(x.raw));s.loose=b}}if(s.loose)for(let n of s.items){n.loose=!0;for(let h of n.tokens)h.type==="text"&&(h.type="paragraph")}return s}}html(e){let t=this.rules.block.html.exec(e);if(t){let r=Bs(t[0]);return{type:"html",block:!0,raw:r,pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:r}}}def(e){let t=this.rules.block.def.exec(e);if(t){let r=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),o=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:r,raw:ue(t[0],`
`),href:o,title:s}}}table(e){var a;let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let r=Ws(t[1]),o=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),s=(a=t[3])!=null&&a.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],i={type:"table",raw:ue(t[0],`
`),header:[],align:[],rows:[]};if(r.length===o.length){for(let l of o)this.rules.other.tableAlignRight.test(l)?i.align.push("right"):this.rules.other.tableAlignCenter.test(l)?i.align.push("center"):this.rules.other.tableAlignLeft.test(l)?i.align.push("left"):i.align.push(null);for(let l=0;l<r.length;l++)i.header.push({text:r[l],tokens:this.lexer.inline(r[l]),header:!0,align:i.align[l]});for(let l of s)i.rows.push(Ws(l,i.header.length).map((n,h)=>({text:n,tokens:this.lexer.inline(n),header:!1,align:i.align[h]})));return i}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t){let r=t[1].trim();return{type:"heading",raw:ue(t[0],`
`),depth:t[2].charAt(0)==="="?1:2,text:r,tokens:this.lexer.inline(r)}}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let r=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:r,tokens:this.lexer.inline(r)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let r=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let i=ue(r.slice(0,-1),"\\");if((r.length-i.length)%2===0)return}else{let i=Sn(t[2],"()");if(i===-2)return;if(i>-1){let a=(t[0].indexOf("!")===0?5:4)+t[1].length+i;t[2]=t[2].substring(0,i),t[0]=t[0].substring(0,a).trim(),t[3]=""}}let o=t[2],s="";if(this.options.pedantic){let i=this.rules.other.pedanticHrefTitle.exec(o);i&&(o=i[1],s=i[3])}else s=t[3]?t[3].slice(1,-1):"";return o=o.trim(),this.rules.other.startAngleBracket.test(o)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?o=o.slice(1):o=o.slice(1,-1)),Hs(t,{href:o&&o.replace(this.rules.inline.anyPunctuation,"$1"),title:s&&s.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let r;if((r=this.rules.inline.reflink.exec(e))||(r=this.rules.inline.nolink.exec(e))){let o=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),s=t[o.toLowerCase()];if(!s){let i=r[0].charAt(0);return{type:"text",raw:i,text:i}}return Hs(r,s,r[0],this.lexer,this.rules)}}emStrong(e,t,r=""){let o=this.rules.inline.emStrongLDelim.exec(e);if(!(!o||!o[1]&&!o[2]&&!o[3]&&!o[4]||o[4]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(o[1]||o[3])||!r||this.rules.inline.punctuation.exec(r))){let s=[...o[0]].length-1,i,a,l=s,n=0,h=o[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(h.lastIndex=0,t=t.slice(-1*e.length+s);(o=h.exec(t))!==null;){if(i=o[1]||o[2]||o[3]||o[4]||o[5]||o[6],!i)continue;if(a=[...i].length,o[3]||o[4]){l+=a;continue}else if((o[5]||o[6])&&s%3&&!((s+a)%3)){n+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l+n);let u=[...o[0]][0].length,b=e.slice(0,s+o.index+u+a);if(Math.min(s,a)%2){let S=b.slice(1,-1);return{type:"em",raw:b,text:S,tokens:this.lexer.inlineTokens(S)}}let x=b.slice(2,-2);return{type:"strong",raw:b,text:x,tokens:this.lexer.inlineTokens(x)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let r=t[2].replace(this.rules.other.newLineCharGlobal," "),o=this.rules.other.nonSpaceChar.test(r),s=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return o&&s&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:t[0],text:r}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e,t,r=""){let o=this.rules.inline.delLDelim.exec(e);if(o&&(!o[1]||!r||this.rules.inline.punctuation.exec(r))){let s=[...o[0]].length-1,i,a,l=s,n=this.rules.inline.delRDelim;for(n.lastIndex=0,t=t.slice(-1*e.length+s);(o=n.exec(t))!==null;){if(i=o[1]||o[2]||o[3]||o[4]||o[5]||o[6],!i||(a=[...i].length,a!==s))continue;if(o[3]||o[4]){l+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l);let h=[...o[0]][0].length,u=e.slice(0,s+o.index+h+a),b=u.slice(s,-s);return{type:"del",raw:u,text:b,tokens:this.lexer.inlineTokens(b)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let r,o;return t[2]==="@"?(r=t[1],o="mailto:"+r):(r=t[1],o=r),{type:"link",raw:t[0],text:r,href:o,tokens:[{type:"text",raw:r,text:r}]}}}url(e){var r;let t;if(t=this.rules.inline.url.exec(e)){let o,s;if(t[2]==="@")o=t[0],s="mailto:"+o;else{let i;do i=t[0],t[0]=((r=this.rules.inline._backpedal.exec(t[0]))==null?void 0:r[0])??"";while(i!==t[0]);o=t[0],t[1]==="www."?s="http://"+t[0]:s=t[0]}return{type:"link",raw:t[0],text:o,href:s,tokens:[{type:"text",raw:o,text:o}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let r=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:r}}}},te=class Rr{constructor(t){z(this,"tokens");z(this,"options");z(this,"state");z(this,"inlineQueue");z(this,"tokenizer");this.tokens=[],this.tokens.links=Object.create(null),this.options=t||Ne,this.options.tokenizer=this.options.tokenizer||new Jt,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:N,block:Mt.normal,inline:dt.normal};this.options.pedantic?(r.block=Mt.pedantic,r.inline=dt.pedantic):this.options.gfm&&(r.block=Mt.gfm,this.options.breaks?r.inline=dt.breaks:r.inline=dt.gfm),this.tokenizer.rules=r}static get rules(){return{block:Mt,inline:dt}}static lex(t,r){return new Rr(r).lex(t)}static lexInline(t,r){return new Rr(r).inlineTokens(t)}lex(t){t=t.replace(N.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let o=this.inlineQueue[r];this.inlineTokens(o.src,o.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,r=[],o=!1){var i,a,l;this.tokenizer.lexer=this,this.options.pedantic&&(t=t.replace(N.tabCharGlobal,"    ").replace(N.spaceLine,""));let s=1/0;for(;t;){if(t.length<s)s=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}let n;if((a=(i=this.options.extensions)==null?void 0:i.block)!=null&&a.some(u=>(n=u.call({lexer:this},t,r))?(t=t.substring(n.raw.length),r.push(n),!0):!1))continue;if(n=this.tokenizer.space(t)){t=t.substring(n.raw.length);let u=r.at(-1);n.raw.length===1&&u!==void 0?u.raw+=`
`:r.push(n);continue}if(n=this.tokenizer.code(t)){t=t.substring(n.raw.length);let u=r.at(-1);(u==null?void 0:u.type)==="paragraph"||(u==null?void 0:u.type)==="text"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.text,this.inlineQueue.at(-1).src=u.text):r.push(n);continue}if(n=this.tokenizer.fences(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.heading(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.hr(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.blockquote(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.list(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.html(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.def(t)){t=t.substring(n.raw.length);let u=r.at(-1);(u==null?void 0:u.type)==="paragraph"||(u==null?void 0:u.type)==="text"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.raw,this.inlineQueue.at(-1).src=u.text):this.tokens.links[n.tag]||(this.tokens.links[n.tag]={href:n.href,title:n.title},r.push(n));continue}if(n=this.tokenizer.table(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.lheading(t)){t=t.substring(n.raw.length),r.push(n);continue}let h=t;if((l=this.options.extensions)!=null&&l.startBlock){let u=1/0,b=t.slice(1),x;this.options.extensions.startBlock.forEach(S=>{x=S.call({lexer:this},b),typeof x=="number"&&x>=0&&(u=Math.min(u,x))}),u<1/0&&u>=0&&(h=t.substring(0,u+1))}if(this.state.top&&(n=this.tokenizer.paragraph(h))){let u=r.at(-1);o&&(u==null?void 0:u.type)==="paragraph"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=u.text):r.push(n),o=h.length!==t.length,t=t.substring(n.raw.length);continue}if(n=this.tokenizer.text(t)){t=t.substring(n.raw.length);let u=r.at(-1);(u==null?void 0:u.type)==="text"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=u.text):r.push(n);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return this.state.top=!0,r}inline(t,r=[]){return this.inlineQueue.push({src:t,tokens:r}),r}inlineTokens(t,r=[]){var h,u,b,x,S;this.tokenizer.lexer=this;let o=t,s=null;if(this.tokens.links){let g=Object.keys(this.tokens.links);if(g.length>0)for(;(s=this.tokenizer.rules.inline.reflinkSearch.exec(o))!==null;)g.includes(s[0].slice(s[0].lastIndexOf("[")+1,-1))&&(o=o.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+o.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(s=this.tokenizer.rules.inline.anyPunctuation.exec(o))!==null;)o=o.slice(0,s.index)+"++"+o.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let i;for(;(s=this.tokenizer.rules.inline.blockSkip.exec(o))!==null;)i=s[2]?s[2].length:0,o=o.slice(0,s.index+i)+"["+"a".repeat(s[0].length-i-2)+"]"+o.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);o=((u=(h=this.options.hooks)==null?void 0:h.emStrongMask)==null?void 0:u.call({lexer:this},o))??o;let a=!1,l="",n=1/0;for(;t;){if(t.length<n)n=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}a||(l=""),a=!1;let g;if((x=(b=this.options.extensions)==null?void 0:b.inline)!=null&&x.some(R=>(g=R.call({lexer:this},t,r))?(t=t.substring(g.raw.length),r.push(g),!0):!1))continue;if(g=this.tokenizer.escape(t)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.tag(t)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.link(t)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(g.raw.length);let R=r.at(-1);g.type==="text"&&(R==null?void 0:R.type)==="text"?(R.raw+=g.raw,R.text+=g.text):r.push(g);continue}if(g=this.tokenizer.emStrong(t,o,l)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.codespan(t)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.br(t)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.del(t,o,l)){t=t.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.autolink(t)){t=t.substring(g.raw.length),r.push(g);continue}if(!this.state.inLink&&(g=this.tokenizer.url(t))){t=t.substring(g.raw.length),r.push(g);continue}let I=t;if((S=this.options.extensions)!=null&&S.startInline){let R=1/0,Rt=t.slice(1),xe;this.options.extensions.startInline.forEach(br=>{xe=br.call({lexer:this},Rt),typeof xe=="number"&&xe>=0&&(R=Math.min(R,xe))}),R<1/0&&R>=0&&(I=t.substring(0,R+1))}if(g=this.tokenizer.inlineText(I)){t=t.substring(g.raw.length),g.raw.slice(-1)!=="_"&&(l=g.raw.slice(-1)),a=!0;let R=r.at(-1);(R==null?void 0:R.type)==="text"?(R.raw+=g.raw,R.text+=g.text):r.push(g);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return r}infiniteLoopError(t){let r="Infinite loop on byte: "+t;if(this.options.silent)console.error(r);else throw new Error(r)}},Qt=class{constructor(e){z(this,"options");z(this,"parser");this.options=e||Ne}space(e){return""}code({text:e,lang:t,escaped:r}){var i;let o=(i=(t||"").match(N.notSpaceStart))==null?void 0:i[0],s=e.replace(N.endingNewline,"")+`
`;return o?'<pre><code class="language-'+le(o)+'">'+(r?s:le(s,!0))+`</code></pre>
`:"<pre><code>"+(r?s:le(s,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return""}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,r=e.start,o="";for(let a=0;a<e.items.length;a++){let l=e.items[a];o+=this.listitem(l)}let s=t?"ol":"ul",i=t&&r!==1?' start="'+r+'"':"";return"<"+s+i+`>
`+o+"</"+s+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",r="";for(let s=0;s<e.header.length;s++)r+=this.tablecell(e.header[s]);t+=this.tablerow({text:r});let o="";for(let s=0;s<e.rows.length;s++){let i=e.rows[s];r="";for(let a=0;a<i.length;a++)r+=this.tablecell(i[a]);o+=this.tablerow({text:r})}return o&&(o=`<tbody>${o}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+o+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),r=e.header?"th":"td";return(e.align?`<${r} align="${e.align}">`:`<${r}>`)+t+`</${r}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${le(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:r}){let o=this.parser.parseInline(r),s=Ns(e);if(s===null)return o;e=s;let i='<a href="'+e+'"';return t&&(i+=' title="'+le(t)+'"'),i+=">"+o+"</a>",i}image({href:e,title:t,text:r,tokens:o}){o&&(r=this.parser.parseInline(o,this.parser.textRenderer));let s=Ns(e);if(s===null)return le(r);e=s;let i=`<img src="${e}" alt="${le(r)}"`;return t&&(i+=` title="${le(t)}"`),i+=">",i}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:le(e.text)}},is=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}checkbox({raw:e}){return e}},re=class Ir{constructor(t){z(this,"options");z(this,"renderer");z(this,"textRenderer");this.options=t||Ne,this.options.renderer=this.options.renderer||new Qt,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new is}static parse(t,r){return new Ir(r).parse(t)}static parseInline(t,r){return new Ir(r).parseInline(t)}parse(t){var o,s;this.renderer.parser=this;let r="";for(let i=0;i<t.length;i++){let a=t[i];if((s=(o=this.options.extensions)==null?void 0:o.renderers)!=null&&s[a.type]){let n=a,h=this.options.extensions.renderers[n.type].call({parser:this},n);if(h!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(n.type)){r+=h||"";continue}}let l=a;switch(l.type){case"space":{r+=this.renderer.space(l);break}case"hr":{r+=this.renderer.hr(l);break}case"heading":{r+=this.renderer.heading(l);break}case"code":{r+=this.renderer.code(l);break}case"table":{r+=this.renderer.table(l);break}case"blockquote":{r+=this.renderer.blockquote(l);break}case"list":{r+=this.renderer.list(l);break}case"checkbox":{r+=this.renderer.checkbox(l);break}case"html":{r+=this.renderer.html(l);break}case"def":{r+=this.renderer.def(l);break}case"paragraph":{r+=this.renderer.paragraph(l);break}case"text":{r+=this.renderer.text(l);break}default:{let n='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(n),"";throw new Error(n)}}}return r}parseInline(t,r=this.renderer){var s,i;this.renderer.parser=this;let o="";for(let a=0;a<t.length;a++){let l=t[a];if((i=(s=this.options.extensions)==null?void 0:s.renderers)!=null&&i[l.type]){let h=this.options.extensions.renderers[l.type].call({parser:this},l);if(h!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(l.type)){o+=h||"";continue}}let n=l;switch(n.type){case"escape":{o+=r.text(n);break}case"html":{o+=r.html(n);break}case"link":{o+=r.link(n);break}case"image":{o+=r.image(n);break}case"checkbox":{o+=r.checkbox(n);break}case"strong":{o+=r.strong(n);break}case"em":{o+=r.em(n);break}case"codespan":{o+=r.codespan(n);break}case"br":{o+=r.br(n);break}case"del":{o+=r.del(n);break}case"text":{o+=r.text(n);break}default:{let h='Token with "'+n.type+'" type was not found.';if(this.options.silent)return console.error(h),"";throw new Error(h)}}}return o}},Ft,ht=(Ft=class{constructor(e){z(this,"options");z(this,"block");this.options=e||Ne}preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(e=this.block){return e?te.lex:te.lexInline}provideParser(e=this.block){return e?re.parse:re.parseInline}},z(Ft,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens","emStrongMask"])),z(Ft,"passThroughHooksRespectAsync",new Set(["preprocess","postprocess","processAllTokens"])),Ft),Pn=class{constructor(...e){z(this,"defaults",Zr());z(this,"options",this.setOptions);z(this,"parse",this.parseMarkdown(!0));z(this,"parseInline",this.parseMarkdown(!1));z(this,"Parser",re);z(this,"Renderer",Qt);z(this,"TextRenderer",is);z(this,"Lexer",te);z(this,"Tokenizer",Jt);z(this,"Hooks",ht);this.use(...e)}walkTokens(e,t){var o,s;let r=[];for(let i of e)switch(r=r.concat(t.call(this,i)),i.type){case"table":{let a=i;for(let l of a.header)r=r.concat(this.walkTokens(l.tokens,t));for(let l of a.rows)for(let n of l)r=r.concat(this.walkTokens(n.tokens,t));break}case"list":{let a=i;r=r.concat(this.walkTokens(a.items,t));break}default:{let a=i;(s=(o=this.defaults.extensions)==null?void 0:o.childTokens)!=null&&s[a.type]?this.defaults.extensions.childTokens[a.type].forEach(l=>{let n=a[l].flat(1/0);r=r.concat(this.walkTokens(n,t))}):a.tokens&&(r=r.concat(this.walkTokens(a.tokens,t)))}}return r}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(r=>{let o={...r};if(o.async=this.defaults.async||o.async||!1,r.extensions&&(r.extensions.forEach(s=>{if(!s.name)throw new Error("extension name required");if("renderer"in s){let i=t.renderers[s.name];i?t.renderers[s.name]=function(...a){let l=s.renderer.apply(this,a);return l===!1&&(l=i.apply(this,a)),l}:t.renderers[s.name]=s.renderer}if("tokenizer"in s){if(!s.level||s.level!=="block"&&s.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let i=t[s.level];i?i.unshift(s.tokenizer):t[s.level]=[s.tokenizer],s.start&&(s.level==="block"?t.startBlock?t.startBlock.push(s.start):t.startBlock=[s.start]:s.level==="inline"&&(t.startInline?t.startInline.push(s.start):t.startInline=[s.start]))}"childTokens"in s&&s.childTokens&&(t.childTokens[s.name]=s.childTokens)}),o.extensions=t),r.renderer){let s=this.defaults.renderer||new Qt(this.defaults);for(let i in r.renderer){if(!(i in s))throw new Error(`renderer '${i}' does not exist`);if(["options","parser"].includes(i))continue;let a=i,l=r.renderer[a],n=s[a];s[a]=(...h)=>{let u=l.apply(s,h);return u===!1&&(u=n.apply(s,h)),u||""}}o.renderer=s}if(r.tokenizer){let s=this.defaults.tokenizer||new Jt(this.defaults);for(let i in r.tokenizer){if(!(i in s))throw new Error(`tokenizer '${i}' does not exist`);if(["options","rules","lexer"].includes(i))continue;let a=i,l=r.tokenizer[a],n=s[a];s[a]=(...h)=>{let u=l.apply(s,h);return u===!1&&(u=n.apply(s,h)),u}}o.tokenizer=s}if(r.hooks){let s=this.defaults.hooks||new ht;for(let i in r.hooks){if(!(i in s))throw new Error(`hook '${i}' does not exist`);if(["options","block"].includes(i))continue;let a=i,l=r.hooks[a],n=s[a];ht.passThroughHooks.has(i)?s[a]=h=>{if(this.defaults.async&&ht.passThroughHooksRespectAsync.has(i))return(async()=>{let b=await l.call(s,h);return n.call(s,b)})();let u=l.call(s,h);return n.call(s,u)}:s[a]=(...h)=>{if(this.defaults.async)return(async()=>{let b=await l.apply(s,h);return b===!1&&(b=await n.apply(s,h)),b})();let u=l.apply(s,h);return u===!1&&(u=n.apply(s,h)),u}}o.hooks=s}if(r.walkTokens){let s=this.defaults.walkTokens,i=r.walkTokens;o.walkTokens=function(a){let l=[];return l.push(i.call(this,a)),s&&(l=l.concat(s.call(this,a))),l}}this.defaults={...this.defaults,...o}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return te.lex(e,t??this.defaults)}parser(e,t){return re.parse(e,t??this.defaults)}parseMarkdown(e){return(t,r)=>{let o={...r},s={...this.defaults,...o},i=this.onError(!!s.silent,!!s.async);if(this.defaults.async===!0&&o.async===!1)return i(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof t>"u"||t===null)return i(new Error("marked(): input parameter is undefined or null"));if(typeof t!="string")return i(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));if(s.hooks&&(s.hooks.options=s,s.hooks.block=e),s.async)return(async()=>{let a=s.hooks?await s.hooks.preprocess(t):t,l=await(s.hooks?await s.hooks.provideLexer(e):e?te.lex:te.lexInline)(a,s),n=s.hooks?await s.hooks.processAllTokens(l):l;s.walkTokens&&await Promise.all(this.walkTokens(n,s.walkTokens));let h=await(s.hooks?await s.hooks.provideParser(e):e?re.parse:re.parseInline)(n,s);return s.hooks?await s.hooks.postprocess(h):h})().catch(i);try{s.hooks&&(t=s.hooks.preprocess(t));let a=(s.hooks?s.hooks.provideLexer(e):e?te.lex:te.lexInline)(t,s);s.hooks&&(a=s.hooks.processAllTokens(a)),s.walkTokens&&this.walkTokens(a,s.walkTokens);let l=(s.hooks?s.hooks.provideParser(e):e?re.parse:re.parseInline)(a,s);return s.hooks&&(l=s.hooks.postprocess(l)),l}catch(a){return i(a)}}}onError(e,t){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let o="<p>An error occurred:</p><pre>"+le(r.message+"",!0)+"</pre>";return t?Promise.resolve(o):o}if(t)return Promise.reject(r);throw r}}},De=new Pn;function T(e,t){return De.parse(e,t)}T.options=T.setOptions=function(e){return De.setOptions(e),T.defaults=De.defaults,Co(T.defaults),T};T.getDefaults=Zr;T.defaults=Ne;T.use=function(...e){return De.use(...e),T.defaults=De.defaults,Co(T.defaults),T};T.walkTokens=function(e,t){return De.walkTokens(e,t)};T.parseInline=De.parseInline;T.Parser=re;T.parser=re.parse;T.Renderer=Qt;T.TextRenderer=is;T.Lexer=te;T.lexer=te.lex;T.Tokenizer=Jt;T.Hooks=ht;T.parse=T;T.options;T.setOptions;T.use;T.walkTokens;T.parseInline;re.parse;te.lex;var An=Object.defineProperty,Tn=Object.getOwnPropertyDescriptor,as=(e,t,r,o)=>{for(var s=o>1?void 0:o?Tn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&An(t,r,s),s};let _t=class extends k{constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}_renderSnippet(){var r;const e=((r=this.result)==null?void 0:r.snippet)??"";if(!e)return null;const t=T.parse(e,{async:!1});return c`<div class="snippet" .innerHTML=${t}></div>`}render(){if(!this.result)return null;const e=Math.round(this.result.score*100);return c`
      <div class="path">
        ${this.result.kind==="path"?c`<span class="badge">路径</span>`:null}
        ${this.result.path}${this.result.line?`:${this.result.line}`:""}
      </div>
      ${this._renderSnippet()}
      <div class="score">评分: ${e}%</div>
    `}};_t.styles=_`
    :host {
      display: block;
      background: var(--cortex-surface);
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
      box-shadow: var(--cortex-shadow-md);
    }
    :host(:hover) {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-shadow-md);
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
      background: rgba(0, 82, 255, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
  `;as([d({attribute:!1})],_t.prototype,"result",2);as([d({type:Boolean,reflect:!0})],_t.prototype,"active",2);_t=as([E("result-card")],_t);var Dn=Object.defineProperty,zn=Object.getOwnPropertyDescriptor,dr=(e,t,r,o)=>{for(var s=o>1?void 0:o?zn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Dn(t,r,s),s};let Ke=class extends k{constructor(){super(...arguments),this.results=[],this.activeResult=null,this.loading=!1}render(){return c`
      <div class="list-pane">
        ${this.loading&&this.results.length===0?c`<div class="loading">搜索中</div>`:this.results.length===0?c`<div class="empty">无搜索结果</div>`:this.results.map(e=>c`
                <result-card
                  .result=${e}
                  ?active=${this.activeResult===e}>
                </result-card>`)}
      </div>
    `}};Ke.styles=_`
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
  `;dr([d({attribute:!1})],Ke.prototype,"results",2);dr([d({attribute:!1})],Ke.prototype,"activeResult",2);dr([d({type:Boolean})],Ke.prototype,"loading",2);Ke=dr([E("search-results")],Ke);var On=Object.defineProperty,Rn=Object.getOwnPropertyDescriptor,At=(e,t,r,o)=>{for(var s=o>1?void 0:o?Rn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&On(t,r,s),s};let pt="",Lr=0,er=0;function ut(e){if(!e)return 0;const t=pt.indexOf(e,Lr);if(t===-1){const o=pt.indexOf(e);return o===-1?0:(pt.slice(0,o).match(/\n/g)??[]).length+1+er}const r=(pt.slice(0,t).match(/\n/g)??[]).length+1;return Lr=t+e.length,r+er}function tr(e){return e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}const In=500;function Us(e){return e>0&&e<=In?`${e}px`:null}const Mo={heading(e){const t=this.parser.parseInline(e.tokens),r=ut(e.raw);return`<h${e.depth} data-source-line="${r}">${t}</h${e.depth}>
`},paragraph(e){const t=this.parser.parseInline(e.tokens);return`<p data-source-line="${ut(e.raw)}">${t}</p>
`},code(e){const t=ut(e.raw),r=tr(e.text),o=e.lang?` class="language-${tr(e.lang)}"`:"";return`<pre data-source-line="${t}"><code${o}>${r}</code></pre>
`},list(e){const t=ut(e.raw);let r="";for(const i of e.items)r+=this.listitem(i);const o=e.ordered?"ol":"ul",s=e.ordered&&e.start!==1?` start="${e.start}"`:"";return`<${o}${s} data-source-line="${t}">
${r}</${o}>
`},blockquote(e){const t=ut(e.raw),r=this.parser.parse(e.tokens);return`<blockquote data-source-line="${t}">
${r}</blockquote>
`}};Mo.image=function(e){const t=e.title?` title="${tr(e.title)}"`:"";return`<img src="${e.href}" alt="${tr(e.text||"")}"${t} loading="lazy">
`};let js=!1;function Ln(){js||(js=!0,T.use({hooks:{preprocess(e){return pt=e,Lr=0,e}},renderer:Mo}))}let ze=class extends k{constructor(){super(...arguments),this.content="",this.line=null,this.keyword="",this.pages=null}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("content")||e.has("keyword"))&&this._highlightKeyword(),(e.has("content")||e.has("pages"))&&this._applyIconSizing(),(e.has("line")||e.has("content"))&&this._locateAndHighlight()}_dispWidthFromSrc(e){try{const t=new URL(e,window.location.href).searchParams.get("dw");if(!t)return null;const r=Number(t);return Number.isFinite(r)&&r>0?r:null}catch{return null}}_applyIconSizing(){this.shadowRoot.querySelectorAll("img").forEach(t=>{const r=this._dispWidthFromSrc(t.src);if(r!==null){const s=Us(r);s&&(t.style.width=s);return}const o=()=>{try{const s=Us(t.naturalWidth);s&&(t.style.width=s)}catch{}};t.complete&&t.naturalWidth>0?o():t.addEventListener("load",o,{once:!0})})}_locateAndHighlight(){if(this.line===null||this.line===void 0)return;const e=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));if(e.length===0)return;const t=e.reduce((o,s)=>{const i=Number(s.getAttribute("data-source-line"));return i<=this.line&&(!o||i>Number(o.getAttribute("data-source-line")))?s:o},null);if(!t)return;const r=this.getBoundingClientRect();if(r.height>0){const s=t.getBoundingClientRect().top-r.top+this.scrollTop;this.scrollTo({top:s,behavior:"smooth"})}t.classList.remove("highlight-flash"),t.offsetWidth,t.classList.add("highlight-flash")}_highlightKeyword(){var a,l;const e=(a=this.shadowRoot)==null?void 0:a.querySelector(".md-body-paged, .md-body");if(!e)return;const t=(this.keyword??"").split(/\s+/).filter(n=>n.length>0);if(t.length===0)return;const r=new RegExp(t.map(n=>this._escapeRegExp(n)).join("|"),"gi"),o=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode(n){const h=n.parentElement;if(!h)return NodeFilter.FILTER_REJECT;const u=h.tagName;return u==="SCRIPT"||u==="STYLE"||u==="MARK"?NodeFilter.FILTER_REJECT:r.test(n.nodeValue??"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),s=[];let i;for(;i=o.nextNode();)s.push(i);for(const n of s){r.lastIndex=0;const h=n.nodeValue??"",u=document.createDocumentFragment();let b=0,x;for(;(x=r.exec(h))!==null;){x.index>b&&u.appendChild(document.createTextNode(h.slice(b,x.index)));const S=document.createElement("mark");S.textContent=x[0],S.className="keyword-hit",u.appendChild(S),b=x.index+x[0].length,x[0].length===0&&r.lastIndex++}b<h.length&&u.appendChild(document.createTextNode(h.slice(b))),(l=n.parentNode)==null||l.replaceChild(u,n)}}_escapeRegExp(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}_splitByPages(e,t){const r=e.split(`
`),o=[];for(let s=0;s<t.length;s++){const i=t[s].line_start-1,a=s+1<t.length?t[s+1].line_start-1:r.length,l=r.slice(Math.max(0,i),Math.max(0,a)).join(`
`);o.push({label:t[s].label,md:l,offset:i})}return o}render(){if(Ln(),!this.content)return c`<div class="empty">无内容</div>`;if(this.pages&&this.pages.length>0){const t=this._splitByPages(this.content,this.pages);return c`<div class="md-body md-body-paged">
        ${t.map(r=>{er=r.offset;const o=T.parse(r.md,{async:!1});return c`
            <section class="page-card">
              <header class="page-card-header">${r.label}</header>
              <div .innerHTML=${o}></div>
            </section>
          `})}
      </div>`}er=0;const e=T.parse(this.content,{async:!1});return c`<div class="md-body" .innerHTML=${e}></div>`}};ze.styles=_`
    :host {
      display: block;
      padding: var(--cortex-space-4);
      background: var(--cortex-bg);   /* 灰底：让白纸浮起 */
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
    /* 代码块：surface-muted + hairline + radius-md + 横向滚动 */
    :host pre {
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
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
    :host img {
      max-width: 100%;
      height: auto;
      border-radius: var(--cortex-radius-md);
      margin: 0 var(--cortex-space-2) var(--cortex-space-2) 0;
      display: inline-block;
      vertical-align: middle;
    }
    /* 单块预览（docx/md）= 一张白纸；max-width 居中，宽屏不撑满 */
    .md-body {
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
    /* 定位块的闪烁动画（"你滚到这里了"指示）
       使用 box-shadow 而不是 background，避免和 <mark class="keyword-hit">
       的 primary 底色叠加产生视觉混乱（xlsx 场景下 scrollTo 可能是 mark）。
       primary-based rgba 对齐 SaaS Boutique Electric Blue。 */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { box-shadow: 0 0 0 4px rgba(0, 82, 255, 0.12); }
      100% { box-shadow: 0 0 0 4px transparent; }
    }
    /* 搜索关键字命中高亮（primary-soft 底，类似浏览器 Ctrl+F）
       SaaS Boutique：旧 amber #FEF3C7 已替换为 primary-based rgba。 */
    :host mark.keyword-hit {
      background: rgba(0, 82, 255, 0.15);
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
  `;At([d()],ze.prototype,"content",2);At([d({type:Number})],ze.prototype,"line",2);At([d()],ze.prototype,"keyword",2);At([d({attribute:!1})],ze.prototype,"pages",2);ze=At([E("md-viewer")],ze);var Mn=Object.defineProperty,Fn=Object.getOwnPropertyDescriptor,We=(e,t,r,o)=>{for(var s=o>1?void 0:o?Fn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Mn(t,r,s),s};let de=class extends k{constructor(){super(...arguments),this.path="",this.originalContent="",this.mobile=!1,this._text="",this._dirty=!1,this._error=null,this._onSaveClick=()=>{this._dirty&&this._emitSave()},this._onCancelClick=()=>{this.discard()}}willUpdate(e){e.has("originalContent")&&(this._text=this.originalContent,this._dirty=!1,this._error=null)}get _lineCount(){return this._text===""?1:(this._text.match(/\n/g)??[]).length+1}_onInput(e){const t=e.target;this._text=t.value,this._error=null,this._updateDirty()}_onScroll(e){const t=e.target,r=this.shadowRoot.querySelector(".line-col");r&&(r.scrollTop=t.scrollTop)}_onKeyDown(e){(e.ctrlKey||e.metaKey)&&e.key==="s"&&(e.preventDefault(),this._dirty&&this._emitSave())}_updateDirty(){const e=this._text!==this.originalContent;e!==this._dirty&&(this._dirty=e,this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:e}})))}_emitSave(){this.dispatchEvent(new CustomEvent("save",{detail:{content:this._text}}))}discard(){this._text=this.originalContent,this._dirty=!1,this._error=null,this._updateDirty(),this.dispatchEvent(new CustomEvent("cancel",{}))}setError(e){this._error=e}render(){const e=[];for(let t=1;t<=this._lineCount;t++)e.push(t);return c`
      <div class="toolbar">
        ${this.mobile?null:c`<span class="path">${this.path}</span>`}
        ${this._error?c`<span class="error-msg">⚠ ${this._error}</span>`:this._dirty?c`<span class="dirty">●未保存</span>`:null}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          💾 保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}>✖ 取消</button>
      </div>
      <div class="body">
        <div class="line-col">
          ${e.map(t=>c`<span class="line-no">${t}</span>`)}
        </div>
        <textarea
          spellcheck="false"
          .value=${this._text}
          @input=${this._onInput}
          @scroll=${this._onScroll}
          @keydown=${this._onKeyDown}
        ></textarea>
      </div>
    `}};de.styles=_`
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
      border-radius: var(--cortex-radius-sm);
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
      background: var(--cortex-primary-gradient);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-primary-glow);
    }
    button.save-btn:hover {
      opacity: 0.9;
      background: var(--cortex-primary-gradient);
      color: #fff;
    }
    button.save-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring), var(--cortex-primary-glow);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    /* 行号列（gutter）：surface-muted + subtle + mono + border-right */
    .line-col {
      flex-shrink: 0;
      padding: var(--cortex-space-3) var(--cortex-space-2);
      text-align: right;
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      user-select: none;
      overflow: hidden;
      background: var(--cortex-surface-muted);
      border-right: 1px solid var(--cortex-border-muted);
      min-width: 32px;
    }
    .line-col .line-no {
      display: block;
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
      white-space: pre;
      overflow: auto;
    }
  `;We([d()],de.prototype,"path",2);We([d()],de.prototype,"originalContent",2);We([d({type:Boolean})],de.prototype,"mobile",2);We([v()],de.prototype,"_text",2);We([v()],de.prototype,"_dirty",2);We([v()],de.prototype,"_error",2);de=We([E("md-editor")],de);class Fo extends Error{constructor(t,r,o){super(r),this.code=t,this.status=o,this.name="PreviewSaveError"}}async function Nn(e,t){const r=await fetch(`/api/preview?path=${encodeURIComponent(e)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:t})});if(!r.ok){const o=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new Fo(o.code??"UNKNOWN",o.detail??"保存失败",r.status)}return r.json()}class No extends Error{constructor(t,r,o){super(r),this.code=t,this.status=o,this.name="PreviewUploadError"}}async function Wn(e){const t=new FormData;t.append("file",e);const r=await fetch("/api/preview/upload",{method:"POST",body:t});if(!r.ok){const o=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new No(o.code??"UNKNOWN",o.detail??"上传失败",r.status)}return r.json()}const Bn=[".md",".pdf",".docx",".xlsx",".xlsm",".xltx",".xltm",".csv"];function Hn(e){const t=e.toLowerCase();return Bn.some(r=>t.endsWith(r))}async function Ye(e){const t=new URLSearchParams({path:e});try{const r=await fetch(`/api/preview?${t}`);if(r.ok){const i=await r.json();return{ok:!0,path:i.path,content:i.content,language:i.language,writable:i.writable??!1,pages:i.pages??null,lineMap:i.line_map??null}}const o=await r.json().catch(()=>({code:"UNKNOWN",detail:""}));return{ok:!1,notIndexed:o.code==="NOT_INDEXED",message:o.detail||o.code||`HTTP ${r.status}`}}catch(r){return{ok:!1,notIndexed:!1,message:r.message||"网络错误"}}}var Un=Object.defineProperty,jn=Object.getOwnPropertyDescriptor,U=(e,t,r,o)=>{for(var s=o>1?void 0:o?jn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Un(t,r,s),s};let L=class extends k{constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1,this.line=null,this.keyword="",this.writable=!1,this.noHeader=!1,this.mobile=!1,this.pages=null,this._mode="preview",this._content="",this._showMobileMenu=!1,this._onMobileBackClick=()=>{this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=e=>{e.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=e=>{var s,i;if(!this._showMobileMenu)return;const t=e.composedPath(),r=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-menu"),o=(i=this.shadowRoot)==null?void 0:i.querySelector(".mobile-more");r&&t.includes(r)||o&&t.includes(o)||(this._showMobileMenu=!1)},this._onEditorCancel=()=>{this._mode="preview"},this._onEditorDirty=e=>{this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:e.detail.dirty}}))},this._onDownloadClick=()=>{if(!this.path)return;const e=`/api/preview/download?path=${encodeURIComponent(this.path)}`,t=document.createElement("a");t.href=e,t.rel="noopener",document.body.appendChild(t),t.click(),document.body.removeChild(t)},this._onUploadClick=()=>{var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector('input[type="file"]');e==null||e.click()}}willUpdate(e){e.has("content")&&(this._content=this.content,this._mode="preview")}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}_basename(e){if(!e)return"";const t=e.lastIndexOf("/");return t>=0?e.slice(t+1):e}_renderMobileHeader(){return c`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        >←</button>
        <span class="mobile-filename" title=${this.path}>${this._basename(this.path)}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        >⋯</button>
        ${this._showMobileMenu?c`
              <div class="mobile-menu" role="menu">
                ${this.writable?c`<button
                      type="button"
                      role="menuitem"
                      @click=${()=>{this._showMobileMenu=!1,this.enterEdit()}}
                    >✏️ 编辑</button>`:null}
                <button
                  type="button"
                  role="menuitem"
                  @click=${()=>{this._showMobileMenu=!1,this._onDownloadClick()}}
                >⬇️ 下载</button>
                <button
                  type="button"
                  role="menuitem"
                  @click=${()=>{this._showMobileMenu=!1,this._onUploadClick()}}
                >⬆️ 上传</button>
              </div>
            `:null}
      </div>
    `}enterEdit(){this._mode="edit"}async _onEditorSave(e){const t=this.shadowRoot.querySelector("md-editor");try{await Nn(this.path,e.detail.content),this._content=e.detail.content,this._mode="preview",this.dispatchEvent(new CustomEvent("saved",{detail:{content:e.detail.content}}))}catch(r){const o=r instanceof Fo?`${r.code} ${r.message}`:r.message??"保存失败";t==null||t.setError(o),this.dispatchEvent(new CustomEvent("save-failed",{detail:{message:o}}))}}discard(){const e=this.shadowRoot.querySelector("md-editor");e==null||e.discard(),this._mode="preview"}_renderDownloadBtn(){return c`<button class="download-btn" @click=${this._onDownloadClick}>⬇️ 下载</button>`}async _onFileChange(e){var s;const t=e.target,r=(s=t.files)==null?void 0:s[0];if(t.value="",!(!r||!window.confirm(`即将上传 '${r.name}' 覆盖原文件，是否继续？`)))try{const i=await Wn(r);this.dispatchEvent(new CustomEvent("upload-success",{detail:{path:i.path}}))}catch(i){const a=i instanceof No?`${i.code} ${i.message}`:i.message??"上传失败";this.dispatchEvent(new CustomEvent("upload-failed",{detail:{message:a}}))}}_renderUploadBtn(){return c`<button class="upload-btn" @click=${this._onUploadClick}>⬆️ 上传</button>`}render(){if(this.loading)return c`<div class="empty">加载中...</div>`;if(!this._content&&!this.content)return c`<div class="empty">点击左侧结果查看预览</div>`;const e=this.mobile?this._renderMobileHeader():null,t=!this.mobile&&!this.noHeader;if(this.language==="markdown"&&this._mode==="edit")return c`
        <input type="file" hidden @change=${this._onFileChange}>
        ${e}
        ${t?c`
          <div class="header">
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
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
      `;if(this.language==="markdown")return c`
        <input type="file" hidden @change=${this._onFileChange}>
        ${e}
        ${t?c`
          <div class="header">
            <span class="path">${this.path}</span>
            ${this.writable?c`<button class="edit-btn" @click=${()=>this.enterEdit()}>✏️ 编辑</button>`:null}
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        `:null}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this.keyword}
          .pages=${this.pages}
        ></md-viewer>
      `;if(this.language==="html")return c`
        <input type="file" hidden @change=${this._onFileChange}>
        ${e}
        ${t?c`
          <div class="header">
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        `:null}
        <iframe
          class="html-frame"
          srcdoc=${this._content}
          sandbox="allow-scripts"
          title="HTML 预览"
        ></iframe>
      `;const r=this._content.split(`
`);return c`
      <input type="file" hidden @change=${this._onFileChange}>
      ${e}
      ${t?c`
        <div class="header">
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      `:null}
      <div class="body">
        ${r.map((o,s)=>{const i=s+1,a=this.highlights.includes(i)?"highlight":"";return c`<div class=${a}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${i}</span>${o}</div>`})}
      </div>
    `}};L.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
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
      white-space: pre;
    }
    /* 搜索命中行高亮 —— SaaS Boutique primary-based（替代旧 amber） */
    .highlight {
      background: rgba(0, 82, 255, 0.15);
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
    button.upload-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    button.download-btn:hover,
    button.upload-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    /* 主动作：编辑按钮 = primary gradient + glow */
    button.edit-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: none;
      background: var(--cortex-primary-gradient);
      color: #fff;
      border-radius: var(--cortex-radius-sm);
      box-shadow: var(--cortex-primary-glow);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button.edit-btn:hover { opacity: 0.9; }
    button.edit-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring), var(--cortex-primary-glow);
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
  `;U([d()],L.prototype,"path",2);U([d()],L.prototype,"language",2);U([d()],L.prototype,"content",2);U([d({attribute:!1})],L.prototype,"highlights",2);U([d({type:Boolean})],L.prototype,"loading",2);U([d({type:Number})],L.prototype,"line",2);U([d()],L.prototype,"keyword",2);U([d({type:Boolean})],L.prototype,"writable",2);U([d({type:Boolean})],L.prototype,"noHeader",2);U([d({type:Boolean})],L.prototype,"mobile",2);U([d({attribute:!1})],L.prototype,"pages",2);U([v()],L.prototype,"_mode",2);U([v()],L.prototype,"_content",2);U([v()],L.prototype,"_showMobileMenu",2);L=U([E("preview-pane")],L);var Vn=Object.defineProperty,qn=Object.getOwnPropertyDescriptor,ur=(e,t,r,o)=>{for(var s=o>1?void 0:o?qn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Vn(t,r,s),s};let Ge=class extends k{constructor(){super(...arguments),this.role="user",this.message=null,this.error=null,this._onClick=e=>{const t=e.composedPath().find(o=>o instanceof HTMLElement&&o.classList.contains("ref-link"));if(!t)return;e.preventDefault();const r=t.getAttribute("data-path")??"";this.dispatchEvent(new CustomEvent("reference-click",{detail:{path:r},bubbles:!0,composed:!0}))}}firstUpdated(){this.addEventListener("click",this._onClick)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this._onClick)}renderBubble(e){if(e==="")return c`<span class="thinking">思考中...</span>`;if(this.role==="assistant"){const t=T.parse(e,{async:!1});return c`<div class="md-body" .innerHTML=${this.linkifyReferences(t)}></div>`}return e}linkifyReferences(e){const t=/(<h2[^>]*>\s*参考资料\s*<\/h2>)\s*(<(?:ol|ul)[^>]*>[\s\S]*?<\/(?:ol|ul)>)/i;return e.replace(t,(r,o,s)=>{const i=s.replace(/<li>([^<]+?)<\/li>/g,(a,l)=>{const n=l.trim();return`<li><a class="ref-link" data-path="${n.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" href="#">${n}</a></li>`});return`${o}${i}`})}render(){if(!this.message)return null;const e=this.message.tool_steps,t=this.role==="assistant"&&e&&e.length>0;return this.role==="user"?c`<div class="bubble">${this.renderBubble(this.message.content)}${this.error?c`<div class="error">⚠️ ${this.error}</div>`:null}</div>`:c`
      <div class="bubble">
        ${t?c`<chat-tool-trace .steps=${e}></chat-tool-trace><div class="trace-sep"></div>`:null}
        ${this.renderBubble(this.message.content)}
        ${this.error?c`<div class="error">⚠️ ${this.error}</div>`:null}
      </div>
    `}};Ge.styles=_`
    :host {
      display: block;
      max-width: 78%;
    }
    :host([role="user"]) { align-self: flex-end; }
    :host([role="assistant"]) { align-self: flex-start; }
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
      border-radius: 8px;
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
  `;ur([d({reflect:!0})],Ge.prototype,"role",2);ur([d({attribute:!1})],Ge.prototype,"message",2);ur([d()],Ge.prototype,"error",2);Ge=ur([E("chat-message")],Ge);var Xn=Object.defineProperty,Kn=Object.getOwnPropertyDescriptor,Tt=(e,t,r,o)=>{for(var s=o>1?void 0:o?Kn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Xn(t,r,s),s};const Yn={search:"🔍",read_document:"📄",grep:"🔎"},Gn={search:"正在搜索",read_document:"正在读取",grep:"正在检索"};function Zn(e){const t=[`思考过程（${e.length} 步）`];return e.forEach((r,o)=>{t.push(""),t.push(`[${o+1}] ${r.name}`),Object.keys(r.input).length&&(t.push("参数："),t.push(JSON.stringify(r.input,null,2))),r.output!=null&&r.output!==""?(t.push("结果："),t.push(r.output)):t.push("结果：（无输出）")}),t.join(`
`)}let Oe=class extends k{constructor(){super(...arguments),this.steps=[],this._expanded=!1,this._fullResultIds=new Set,this._copied=!1}willUpdate(e){if(e.has("steps")){const r=(e.get("steps")??[]).some(s=>s.status==="running"),o=this.steps.some(s=>s.status==="running");!r&&o?this._expanded=!0:r&&!o&&(this._expanded=!1)}}_toggle(){this._expanded=!this._expanded}_toggleResult(e){const t=new Set(this._fullResultIds);t.has(e)?t.delete(e):t.add(e),this._fullResultIds=t}async _onCopy(e){e.stopPropagation();const t=Zn(this.steps);try{await navigator.clipboard.writeText(t),this._copied=!0,setTimeout(()=>{this._copied=!1},2e3)}catch{try{const o=document.createElement("textarea");o.value=t,o.style.position="fixed",o.style.opacity="0",document.body.appendChild(o),o.select(),document.execCommand("copy"),document.body.removeChild(o),this._copied=!0,setTimeout(()=>{this._copied=!1},2e3)}catch(o){console.warn("copy failed:",o)}}}_renderArgs(e){return Object.entries(e).map(([t,r])=>`${t}: ${typeof r=="string"?r:JSON.stringify(r)}`).join(`
`)}_renderStep(e){const t=e.status==="running",r=e.status==="error",o=Yn[e.name]??"🔧",s=this._fullResultIds.has(e.tool_use_id),i=(e.output??"").split(`
`),a=!s&&i.length>5,l=a?i.slice(0,5).join(`
`):e.output??"",n=e.output!=null&&e.output!=="";return c`
      <div class="step ${t?"running":""} ${r?"error":""}">
        <div class="head">
          ${t?c`<span class="spin"></span>`:c`<span>${o}</span>`}
          <span class="name">${e.name}</span>
          ${t?c`<span class="running-text">${Gn[e.name]??"正在调用"}...</span>`:null}
          <span class="meta">
            ${t?null:r?c`<span class="err">✗</span>`:c`<span class="ok">✓</span>`}
            ${e.duration_ms!=null?c` ${Math.round(e.duration_ms)}ms`:null}
          </span>
        </div>
        ${Object.keys(e.input).length?c`<div class="arg">${this._renderArgs(e.input)}</div>`:null}
        ${n?c`<div class="res">${l}${a?c`<span class="more" @click=${()=>this._toggleResult(e.tool_use_id)}>展开全部 (${i.length} 行) ⌄</span>`:null}</div>`:t?null:c`<div class="arg">（无输出）</div>`}
      </div>
    `}render(){if(!this.steps.length)return null;const e=this.steps.some(t=>t.status==="running");return c`
      <div class="summary" @click=${this._toggle}>
        <span class="arrow">${this._expanded?"▾":"▸"}</span>
        🧠 思考过程 · <span class="count">${this.steps.length} 步</span>
        ${e?" · 进行中":""}
        <button class="copy-btn ${this._copied?"copied":""}" @click=${this._onCopy} title=${this._copied?"已复制":"复制全文"}>${this._copied?"✓ 已复制":"📋"}</button>
      </div>
      ${this._expanded?c`<div class="steps">${this.steps.map(t=>this._renderStep(t))}</div>`:null}
    `}};Oe.styles=_`
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
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      padding: 2px 8px;
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font);
      line-height: 1.2;
    }
    .copy-btn:hover { background: var(--cortex-primary-soft); color: var(--cortex-primary); border-color: var(--cortex-primary); }
    .copy-btn.copied { border-color: var(--cortex-success); color: var(--cortex-success); }
  `;Tt([d({attribute:!1})],Oe.prototype,"steps",2);Tt([v()],Oe.prototype,"_expanded",2);Tt([v()],Oe.prototype,"_fullResultIds",2);Tt([v()],Oe.prototype,"_copied",2);Oe=Tt([E("chat-tool-trace")],Oe);var Jn=Object.defineProperty,Qn=Object.getOwnPropertyDescriptor,Wo=(e,t,r,o)=>{for(var s=o>1?void 0:o?Qn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Jn(t,r,s),s};let rr=class extends k{constructor(){super(...arguments),this.messages=[],this._scrollRafPending=!1}updated(){this._scrollRafPending||(this._scrollRafPending=!0,requestAnimationFrame(()=>{this._scrollRafPending=!1,this.scrollTop=this.scrollHeight}))}render(){return this.messages.length===0?c`<div class="empty">开始与 Doclens 对话</div>`:c`
      ${this.messages.map(e=>c`<chat-message role=${e.role} .message=${e}></chat-message>`)}
    `}};rr.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      flex: 1;
      padding: var(--cortex-space-4);
      overflow-y: auto;
      background: var(--cortex-chat-bg);
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
  `;Wo([d({attribute:!1})],rr.prototype,"messages",2);rr=Wo([E("chat-stream")],rr);class Bo extends Error{constructor(t,r,o){super(o),this.status=t,this.code=r,this.name="ApiError"}}async function F(e,t={}){const r={...t};t.json!==void 0&&(r.headers={"Content-Type":"application/json",...t.headers||{}},r.body=JSON.stringify(t.json));const o=await fetch(e,r);if(!o.ok){let s;try{s=await o.json()}catch{s={code:"unknown",detail:o.statusText}}throw new Bo(o.status,s.code??"unknown",s.detail??"请求失败")}return o.json()}async function*Ho(e,t,r){const o=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t),signal:r});if(!o.ok||!o.body)throw new Bo(o.status,"stream_failed","流式请求失败");const s=o.body.getReader(),i=new TextDecoder;let a="";for(;;){const{value:l,done:n}=await s.read();if(n)break;for(a+=i.decode(l,{stream:!0});;){const h=a.match(/\r\n\r\n|\r\r|\n\n/);if(!h||h.index===void 0)break;const u=h.index,b=h[0].length,x=a.slice(0,u);a=a.slice(u+b);let S="message",g="";for(const I of x.split(/\r\n|\r|\n/))I.startsWith("event:")?S=I.slice(6).trim():I.startsWith("data:")&&(g+=I.slice(5).trim());yield{event:S,data:g}}}}async function Vs(e){return F("/api/search",{method:"POST",json:e})}async function qs(e){return F("/api/grep",{method:"POST",json:e})}async function el(e){return F("/api/sessions",{method:"POST",json:e})}async function tl(e){return F("/api/sessions/find-or-create",{method:"POST",json:e})}async function Uo(e){const t=new URLSearchParams;return e.type&&t.set("type",e.type),e.limit&&t.set("limit",String(e.limit)),e.offset&&t.set("offset",String(e.offset)),F(`/api/sessions?${t}`,{method:"GET"})}async function rl(e,t,r){return F(`/api/sessions/${e}`,{method:"PATCH",json:{items:t,message_count:r}})}async function jo(e){const t=new URLSearchParams;return e&&t.set("type",e),F(`/api/sessions?${t}`,{method:"DELETE"})}var sl=Object.defineProperty,ol=Object.getOwnPropertyDescriptor,Dt=(e,t,r,o)=>{for(var s=o>1?void 0:o?ol(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&sl(t,r,s),s};let Re=class extends k{constructor(){super(...arguments),this.total=0,this.offset=0,this.limit=20,this.disabled=!1}get currentPage(){return this.limit<=0?1:Math.floor(this.offset/this.limit)+1}get totalPages(){return this.limit<=0?1:Math.max(1,Math.ceil(this.total/this.limit))}_emitPage(e){this.disabled||e<1||e>this.totalPages||this.dispatchEvent(new CustomEvent("page-change",{detail:{page:e}}))}_pageSlots(){const e=this.totalPages,t=this.currentPage;if(e<=7)return Array.from({length:e},(i,a)=>a+1);const r=[1],o=Math.max(2,t-1),s=Math.min(e-1,t+1);o>2&&r.push("...");for(let i=o;i<=s;i++)r.push(i);return s<e-1&&r.push("..."),r.push(e),r}render(){if(this.total<=this.limit)return c``;const e=this._pageSlots();return c`
      <div class="meta">
        共 ${this.total} 条 · 第 ${this.currentPage}/${this.totalPages} 页
      </div>
      <div class="pages">
        <button
          ?disabled=${this.disabled||this.currentPage===1}
          @click=${()=>this._emitPage(this.currentPage-1)}
          aria-label="上一页">‹</button>
        ${e.map(t=>t==="..."?c`<span class="ellipsis">…</span>`:c`<button
                class=${t===this.currentPage?"current":""}
                ?disabled=${this.disabled}
                @click=${()=>this._emitPage(t)}>${t}</button>`)}
        <button
          ?disabled=${this.disabled||this.currentPage===this.totalPages}
          @click=${()=>this._emitPage(this.currentPage+1)}
          aria-label="下一页">›</button>
      </div>
    `}};Re.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
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
      border-radius: var(--cortex-radius-md);
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
  `;Dt([d({type:Number})],Re.prototype,"total",2);Dt([d({type:Number})],Re.prototype,"offset",2);Dt([d({type:Number})],Re.prototype,"limit",2);Dt([d({type:Boolean})],Re.prototype,"disabled",2);Re=Dt([E("pagination-bar")],Re);var il=Object.defineProperty,al=Object.getOwnPropertyDescriptor,Vo=(e,t,r,o)=>{for(var s=o>1?void 0:o?al(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&il(t,r,s),s};let sr=class extends k{constructor(){super(...arguments),this._toasts=[],this._nextId=1,this._timers=new Map}pushToast(e,t="info",r=2500){const o=this._nextId++;if(this._toasts=[...this._toasts,{id:o,message:e,level:t,duration:r}],r>0){const s=window.setTimeout(()=>this.dismiss(o),r);this._timers.set(o,s)}}dismiss(e){const t=this._timers.get(e);t!==void 0&&(window.clearTimeout(t),this._timers.delete(e)),this._toasts=this._toasts.filter(r=>r.id!==e)}disconnectedCallback(){super.disconnectedCallback();for(const e of this._timers.values())window.clearTimeout(e);this._timers.clear()}render(){return c`
      ${this._toasts.map(e=>c`
          <div class="toast ${e.level}" @click=${()=>this.dismiss(e.id)}>
            <span class="msg">${e.message}</span>
          </div>
        `)}
    `}};sr.styles=_`
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
  `;Vo([v()],sr.prototype,"_toasts",2);sr=Vo([E("toast-stack")],sr);var nl=Object.defineProperty,ll=Object.getOwnPropertyDescriptor,j=(e,t,r,o)=>{for(var s=o>1?void 0:o?ll(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&nl(t,r,s),s};let P=class extends k{constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewLine=null,this.historySessions=[],this._clearing=!1,this.previewError=null,this.previewDirty=!1,this.previewWritable=!1,this.previewPages=null,this._resultsPaneWidth=P.RESULTS_PANE_WIDTH_DEFAULT,this.searchMode="keyword",this._onModeChange=e=>{this.searchMode=e.detail.mode,localStorage.setItem(P.SEARCH_MODE_KEY,e.detail.mode)},this._onSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._resultsPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const o=i=>{const a=i.clientX-t,l=Math.max(P.RESULTS_PANE_WIDTH_MIN,Math.min(P.RESULTS_PANE_WIDTH_MAX,r+a));l!==this._resultsPaneWidth&&(this._resultsPaneWidth=l)},s=()=>{document.removeEventListener("mousemove",o),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(P.RESULTS_PANE_WIDTH_KEY,String(this._resultsPaneWidth))};document.addEventListener("mousemove",o),document.addEventListener("mouseup",s)},this._onPageChange=e=>{this._goToPage(e.detail.page)},this._onPreviewDirty=e=>{this.previewDirty=e.detail.dirty},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=e=>{this._pushToast(`保存失败：${e.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=e=>{this.previewDirty=!1,this._pushToast(`已覆盖：${e.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._pushToast(`上传失败：${e.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._loadResultsPaneWidth(),this._loadSearchMode();const e=f.getState().pendingSession;e&&e.type==="search"&&(m.setPendingSession(null),this._loadSession(e))}_loadResultsPaneWidth(){const e=localStorage.getItem(P.RESULTS_PANE_WIDTH_KEY);if(!e)return;const t=Number(e);Number.isNaN(t)||(this._resultsPaneWidth=Math.max(P.RESULTS_PANE_WIDTH_MIN,Math.min(P.RESULTS_PANE_WIDTH_MAX,t)))}_loadSearchMode(){const e=localStorage.getItem(P.SEARCH_MODE_KEY);(e==="keyword"||e==="grep")&&(this.searchMode=e)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await Uo({type:"search",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){await this._safeAction(async()=>{this._clearing=!0,this.requestUpdate();try{await jo("search"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}})}get viewState(){return f.getState().search}async _submit(e){await this._safeAction(async()=>{const t=typeof e=="string"?e:e.detail.value;this.localQuery=t,f.setState({detailStack:[]}),this.previewContent="",this.previewPath="",this.previewError=null,this.previewPages=null,m.setSearchState({state:"focus",query:t,queryWords:[],results:[],total:0,offset:0,limit:20,source:"fts"}),this.loading=!0;try{const r=this.searchMode==="grep"?await qs({pattern:t,offset:0,limit:20}):await Vs({query:t,offset:0,limit:20});m.setSearchState({state:"focus",query:t,queryWords:r.query_words??[],results:r.results,total:r.total,offset:0,limit:20,source:r.source}),this._autoPreviewFirstDesktop(r.results),tl({type:"search",title:t,preview:t.slice(0,100),mode:this.searchMode==="grep"?"grep":"keyword"}).then(o=>{m.setSearchState({currentSession:{id:o.id,type:"search",title:t,preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0}}),this._loadHistory()}).catch(o=>{console.warn("find-or-create session failed",o)})}catch(r){m.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}})}async _backToInitial(){await this._safeAction(()=>{m.setSearchState({state:"initial",currentSession:null,results:[],query:"",queryWords:[]}),this.localQuery="",this._loadHistory()})}async _goToPage(e){const t=f.getState().search;if(!t.query||t.state!=="focus")return;const r=t.limit||20,o=Math.max(0,(e-1)*r);if(o!==t.offset){this.loading=!0;try{const s=this.searchMode==="grep"?await qs({pattern:t.query,offset:o,limit:r}):await Vs({query:t.query,offset:o,limit:r});m.setSearchState({state:"focus",query:t.query,results:s.results,total:s.total,offset:s.offset,limit:r,source:s.source}),this.previewContent="",this.previewPath="",this.previewLine=null}catch(s){m.setError(`翻页失败: ${s.message}`)}finally{this.loading=!1}}}async _onResultSelect(e){await this._safeAction(async()=>{const t=e.detail.result;m.pushDetail(t),await this._fetchAndShowPreview(t)})}async _fetchAndShowPreview(e){this.previewError=null;const t=e.line??null,r=Hn(e.path);let o;t&&!r?o=await this._fetchPreviewRange(e.path,t):o=await Ye(e.path),o.ok?(this.previewContent=o.content,this.previewPath=o.path,this.previewLanguage=o.language,this.previewLine=t===null?null:o.lineMap?o.lineMap[String(t)]??null:t,this.previewWritable=o.writable,this.previewPages=o.pages):o.notIndexed&&(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=e.path,this.previewWritable=!1,this.previewPages=null)}async _fetchPreviewRange(e,t){const r=new URLSearchParams({path:e});r.set("start_line",String(Math.max(1,t-10))),r.set("end_line",String(t+20));try{const o=await fetch(`/api/preview?${r}`);if(o.ok){const i=await o.json();return{ok:!0,path:i.path,content:i.content,language:i.language,writable:i.writable??!1,pages:i.pages??null,lineMap:null}}return{ok:!1,notIndexed:(await o.json().catch(()=>({}))).code==="NOT_INDEXED"}}catch{return{ok:!1,notIndexed:!1}}}_autoPreviewFirstDesktop(e){typeof window>"u"||window.innerWidth<1024||e.length!==0&&this._fetchAndShowPreview(e[0])}_discardPreviewEdits(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=e==null?void 0:e.discard)==null||r.call(e),this.previewDirty=!1}_enterPreviewEdit(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".detail-overlay preview-pane");(r=e==null?void 0:e.enterEdit)==null||r.call(e)}async _safeAction(e){if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await e()}async _reloadPreview(){if(!this.previewPath)return;const e=await Ye(this.previewPath);e.ok&&(this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages)}_pushToast(e,t,r){var s;const o=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");o==null||o.pushToast(e,t,r)}_popDetail(){m.popDetail()}_renderNotIndexedHint(e){return c`<div class=${e?"desktop-only not-indexed-hint":"not-indexed-hint"}>
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}async _loadSession(e){this.searchMode=e.mode==="grep"?"grep":"keyword",localStorage.setItem(P.SEARCH_MODE_KEY,this.searchMode),await this._submit(e.title)}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){const e=this.viewState;if(e.state==="initial")return c`
        <div class="initial-stack">
          <welcome-pane heading="Doclens" subheading="结构感知文档检索"></welcome-pane>
          <history-list
            title="历史会话"
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
              button-icon="🔍"
              .mode=${this.searchMode}
              .modes=${P.SEARCH_MODES}
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${o=>this.localQuery=o.detail.value}
              @mode-change=${this._onModeChange}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const t=f.getState().detailStack[f.getState().detailStack.length-1],r=this.loading?"搜索中":`${e.total} 条结果${e.source==="fts"?"":` (${e.source.toUpperCase()})`}`;return c`
      <toast-stack></toast-stack>
      <div class="focus-body ${t?"is-covered":""}">
        <focus-header
          back-label="新搜索"
          title=${e.query}
          meta=${r}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main" style="--results-pane-width: ${this._resultsPaneWidth}px">
          <div class="results-col">
            <search-results
              .results=${e.results}
              ?loading=${this.loading}
              .activeResult=${t??null}
              @select=${this._onResultSelect}>
            </search-results>
            ${e.total>e.limit?c`<pagination-bar
                  .total=${e.total}
                  .offset=${e.offset}
                  .limit=${e.limit}
                  ?disabled=${this.loading}
                  @page-change=${this._onPageChange}>
                </pagination-bar>`:null}
          </div>
          <div class="splitter"
               role="separator"
               aria-orientation="vertical"
               aria-label="调整搜索结果栏宽度"
               @mousedown=${this._onSplitterMouseDown}></div>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!0):c`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${e.queryWords.length?e.queryWords.join(" "):e.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>
      </div>
      ${t?c`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${t.path}
            .actions=${this.previewWritable?[{label:"编辑",icon:"✏️",onClick:()=>this._enterPreviewEdit()}]:[]}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!1):c`<preview-pane
                ?noHeader=${!0}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${e.queryWords.length?e.queryWords.join(" "):e.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>`:null}
    `}};P.RESULTS_PANE_WIDTH_KEY="cortex.resultsPaneWidth";P.RESULTS_PANE_WIDTH_DEFAULT=360;P.RESULTS_PANE_WIDTH_MIN=280;P.RESULTS_PANE_WIDTH_MAX=800;P.SEARCH_MODE_KEY="cortex.searchMode";P.SEARCH_MODES={keyword:{label:"搜索",description:"拆分关键词匹配"},grep:{label:"grep",description:"正则表达式匹配"}};P.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-row {
      padding: var(--cortex-space-4) var(--cortex-space-6);
      flex-shrink: 0;
      background: var(--cortex-surface);
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
      background: var(--cortex-surface);
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
  `;j([v()],P.prototype,"localQuery",2);j([v()],P.prototype,"loading",2);j([v()],P.prototype,"previewContent",2);j([v()],P.prototype,"previewPath",2);j([v()],P.prototype,"previewLanguage",2);j([v()],P.prototype,"previewLine",2);j([v()],P.prototype,"historySessions",2);j([v()],P.prototype,"_clearing",2);j([v()],P.prototype,"previewError",2);j([v()],P.prototype,"previewDirty",2);j([v()],P.prototype,"previewWritable",2);j([v()],P.prototype,"previewPages",2);j([v()],P.prototype,"_resultsPaneWidth",2);j([v()],P.prototype,"searchMode",2);P=j([E("search-view")],P);async function*cl(e){for await(const t of Ho("/api/chat",e))if(t.event==="token")try{yield{type:"token",text:JSON.parse(t.data).text}}catch{}else if(t.event==="tool_call")try{const r=JSON.parse(t.data);yield{type:"tool_call",tool_use_id:r.tool_use_id,name:r.name,input:r.input??{}}}catch{}else if(t.event==="tool_result")try{const r=JSON.parse(t.data);yield{type:"tool_result",tool_use_id:r.tool_use_id,name:r.name,output:r.output??"",is_error:!!r.is_error,duration_ms:r.duration_ms}}catch{}else if(t.event==="references")try{yield{type:"references",items:JSON.parse(t.data).items??[]}}catch{}else if(t.event==="toast")try{const r=JSON.parse(t.data);yield{type:"toast",level:r.level??"error",detail:String(r.detail??"")}}catch{}else if(t.event==="done")yield{type:"done"};else if(t.event==="error")try{yield{type:"error",detail:JSON.parse(t.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}var dl=Object.defineProperty,ul=Object.getOwnPropertyDescriptor,Z=(e,t,r,o)=>{for(var s=o>1?void 0:o?ul(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&dl(t,r,s),s};function Xs(e,t){if(e.length===0)return e;const r=e[e.length-1];if(r.role!=="assistant")return e;const o=e.slice(0,-1);if(t.type==="token")return[...o,{...r,content:r.content+t.text}];if(t.type==="tool_call"){const s={tool_use_id:t.tool_use_id,name:t.name,input:t.input,status:"running"};return[...o,{...r,tool_steps:[...r.tool_steps??[],s]}]}if(t.type==="tool_result"){const s=(r.tool_steps??[]).map(i=>i.tool_use_id===t.tool_use_id?{...i,output:t.output,is_error:t.is_error,duration_ms:t.duration_ms,status:t.is_error?"error":"done"}:i);return[...o,{...r,tool_steps:s}]}return t.type==="references"?[...o,{...r,references:t.items}]:e}function hl(e){return e.some(r=>r.role==="assistant"&&(r.tool_steps??[]).some(o=>o.status==="running"))?e.map(r=>r.role!=="assistant"||!r.tool_steps?r:{...r,tool_steps:r.tool_steps.map(o=>o.status==="running"?{...o,status:"error",is_error:!0,output:o.output??"（已中断）"}:o)}):e}function pl(e){const t=[];for(const r of e){let o;try{o=JSON.parse(r.payload)}catch{continue}if(r.kind==="message_user")t.push({role:"user",content:o.content??""});else if(r.kind==="message_ai"){const s=(o.tool_calls??[]).map(l=>({tool_use_id:l.tool_use_id??"",name:l.name??"",input:l.input??{},output:l.output,is_error:l.is_error,duration_ms:l.duration_ms,status:l.is_error?"error":"done"})),i=(o.references??[]).map(l=>({path:String((l==null?void 0:l.path)??"")})).filter(l=>l.path.length>0),a={role:"assistant",content:o.content??""};s.length&&(a.tool_steps=s),i.length&&(a.references=i),t.push(a)}}return t}let O=class extends k{constructor(){super(...arguments),this.draft="",this.historySessions=[],this._clearing=!1,this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1,this._previewPaneWidth=O.PREVIEW_PANE_WIDTH_DEFAULT,this._onSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const o=i=>{const a=Math.max(O.PREVIEW_PANE_WIDTH_MIN,Math.min(O.PREVIEW_PANE_WIDTH_MAX,r-(i.clientX-t)));a!==this._previewPaneWidth&&(this._previewPaneWidth=a)},s=()=>{document.removeEventListener("mousemove",o),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(O.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",o),document.addEventListener("mouseup",s)},this._onPreviewDirty=e=>{this.previewDirty=e.detail.dirty},this._closePreview=async()=>{await this._safeAction(()=>{this.previewOpen=!1})},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=e=>{this._pushToast(`保存失败：${e.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=e=>{this.previewDirty=!1,this._pushToast(`已覆盖：${e.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._pushToast(`上传失败：${e.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._loadPreviewPaneWidth();const e=f.getState().pendingSession;e&&e.type==="chat"&&(m.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await Uo({type:"chat",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await jo("chat"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return f.getState().chat}async _submit(e){this._resetPreview();const t=e.detail.value;if(this.draft="",this.viewState.state==="initial"){const i=await el({type:"chat",title:t.slice(0,60),preview:t.slice(0,100)});m.setChatState({state:"focus",currentSession:{id:i.id,type:"chat",title:t.slice(0,60),preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:t}],streaming:!0})}else m.setChatState({messages:[...this.viewState.messages,{role:"user",content:t}],streaming:!0});const r=f.getState().chat.currentSession.id,o={role:"assistant",content:""};let s=[...f.getState().chat.messages,o];m.setChatState({messages:s});try{for await(const a of cl({message:t,session_id:r}))a.type==="error"?(s=Xs(s,{type:"token",text:`

⚠️ ${a.detail}`}),m.setChatState({messages:s})):a.type==="toast"?this._pushToast(a.detail,a.level,5e3):a.type!=="done"&&(s=Xs(s,a),m.setChatState({messages:s}));const i=s[s.length-1];await rl(r,[{kind:"message_user",payload:JSON.stringify({content:t})},{kind:"message_ai",payload:JSON.stringify({content:i.content,tool_calls:i.tool_steps??[],references:i.references??[]})}],s.length),this._loadHistory()}catch(i){s=hl(s),m.setChatState({messages:s}),m.setError(`对话失败: ${i.message}`)}finally{m.setChatState({streaming:!1})}}_backToInitial(){this._resetPreview(),m.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}_resetPreview(){this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1}async _loadSession(e){this._resetPreview(),m.setChatState({state:"focus",currentSession:e,messages:[]});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const r=await t.json(),o=pl(r.items||[]);m.setChatState({messages:o})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}_loadPreviewPaneWidth(){const e=localStorage.getItem(O.PREVIEW_PANE_WIDTH_KEY);if(!e)return;const t=Number(e);Number.isNaN(t)||(this._previewPaneWidth=Math.max(O.PREVIEW_PANE_WIDTH_MIN,Math.min(O.PREVIEW_PANE_WIDTH_MAX,t)))}get _previewKeyword(){const e=f.getState().chat.messages;for(let t=e.length-1;t>=0;t--)if(e[t].role==="user")return e[t].content;return""}_normalizeReferencePath(e){let t=(e??"").trim();if(!t)return"";const r=t.match(/^\[.*?\]\((.*?)\)$/);r&&(t=r[1].trim()),t=t.replace(/^file:\/\/\/?/i,"");try{t=decodeURIComponent(t)}catch{}return t}async _onReferenceClick(e){await this._safeAction(async()=>{const t=this._normalizeReferencePath(e.detail.path);if(!t){this._pushToast("参考路径为空","error",5e3);return}this.previewError=null;const r=await Ye(t);r.ok?(this.previewContent=r.content,this.previewPath=r.path,this.previewLanguage=r.language,this.previewWritable=r.writable,this.previewPages=r.pages,this.previewOpen=!0):r.notIndexed?(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=t,this.previewWritable=!1,this.previewPages=null,this.previewOpen=!0):this._pushToast(`预览失败：${r.message}`,"error",5e3)})}async _safeAction(e){var t,r;if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;const s=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=s==null?void 0:s.discard)==null||r.call(s),this.previewDirty=!1}await e()}async _reloadPreview(){if(!this.previewPath)return;const e=await Ye(this.previewPath);e.ok&&(this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages)}_pushToast(e,t,r){var s;const o=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");o==null||o.pushToast(e,t,r)}_renderNotIndexedHint(){return c`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}render(){var o;const e=this.viewState;if(e.state==="initial")return c`
        <div class="initial-stack">
          <welcome-pane heading="Doclens" suffix="问日程" subheading="与你的知识库对话"></welcome-pane>
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
              .buttonLabel=${"知识库对话"}
              style="--cortex-input-btn-reserve: 112px"
              multiline
              .value=${this.draft}
              @input-change=${s=>this.draft=s.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const t=this.previewOpen,r=s=>c`<preview-pane
      ?noHeader=${s}
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .keyword=${this._previewKeyword}
      ?writable=${this.previewWritable}
      .pages=${this.previewPages}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}>
    </preview-pane>`;return c`
      <toast-stack></toast-stack>
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${((o=e.currentSession)==null?void 0:o.title)??""}
          meta=${`${e.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main ${t?"has-preview":""}"
             style="--preview-pane-width: ${this._previewPaneWidth}px">
          <chat-stream
            .messages=${e.messages}
            @reference-click=${this._onReferenceClick}>
          </chat-stream>
          ${t?c`
            <div class="splitter desktop-only"
                 role="separator"
                 aria-orientation="vertical"
                 aria-label="调整预览栏宽度"
                 @mousedown=${this._onSplitterMouseDown}></div>
            <div class="preview-pane-wrap desktop-only">
              <button class="preview-close" type="button" aria-label="关闭预览"
                      @click=${this._closePreview}>✕</button>
              ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint():r(!1)}
            </div>`:null}
        </div>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            .buttonLabel=${"知识库对话"}
            style="--cortex-input-btn-reserve: 112px"
            multiline
            ?disabled=${e.streaming}
            .value=${this.draft}
            @input-change=${s=>this.draft=s.detail.value}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
      ${t?c`
        <div class="preview-overlay">
          <focus-header
            back-label="返回"
            title=${this.previewPath}
            @back=${this._closePreview}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint():r(!0)}
        </div>`:null}
    `}};O.PREVIEW_PANE_WIDTH_KEY="cortex.chatPreviewWidth";O.PREVIEW_PANE_WIDTH_DEFAULT=420;O.PREVIEW_PANE_WIDTH_MIN=300;O.PREVIEW_PANE_WIDTH_MAX=900;O.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-chat-bg);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
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
      background: var(--cortex-chat-bg);
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
      background: var(--cortex-surface);
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
      background: var(--cortex-surface);
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
  `;Z([v()],O.prototype,"draft",2);Z([v()],O.prototype,"historySessions",2);Z([v()],O.prototype,"_clearing",2);Z([v()],O.prototype,"previewOpen",2);Z([v()],O.prototype,"previewContent",2);Z([v()],O.prototype,"previewPath",2);Z([v()],O.prototype,"previewLanguage",2);Z([v()],O.prototype,"previewPages",2);Z([v()],O.prototype,"previewWritable",2);Z([v()],O.prototype,"previewError",2);Z([v()],O.prototype,"previewDirty",2);Z([v()],O.prototype,"_previewPaneWidth",2);O=Z([E("chat-view")],O);const fl={ai:"AI 配置",search:"搜索调优",scoring:"评分",terminal:"终端"},bl=[{value:"anthropic",label:"Anthropic（默认）"},{value:"openrouter",label:"OpenRouter"},{value:"qwen",label:"阿里通义千问"},{value:"deepseek",label:"DeepSeek"},{value:"glm",label:"智谱 GLM"},{value:"custom",label:"自定义（OpenAI 兼容或 Anthropic 协议）"}],vl=[{value:"anthropic",label:"Anthropic 协议"},{value:"openai_compat",label:"OpenAI 兼容"}],ml={anthropic:"",openrouter:"https://openrouter.ai/api/v1",qwen:"https://dashscope.aliyuncs.com/compatible-mode/v1",deepseek:"https://api.deepseek.com/v1",glm:"https://open.bigmodel.cn/api/paas/v4/",custom:""},Ks={anthropic:"anthropic",openrouter:"openai_compat",qwen:"openai_compat",deepseek:"openai_compat",glm:"openai_compat",custom:""},gl=[{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_PROVIDER",label:"LLM 提供商",component:"select",effect:"live",options:bl,hint:"选择 LLM 提供商。已知预设会自动填入默认 base_url 和 protocol。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_PROTOCOL",label:"API 协议",component:"select",effect:"live",options:vl,hint:"已知预设下会自动选择；custom 时必填。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_BASE_URL",label:"API Base URL",component:"text",effect:"restart",mono:!0,hint:"Anthropic API 端点。可替换为兼容代理或本地模型服务。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_API_KEY",label:"API Key",component:"password",effect:"restart",mono:!0,hint:"Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_MODEL_ID",label:"模型 ID",component:"text",effect:"restart",mono:!0,datalist:["claude-opus-4-6","claude-sonnet-4-6","claude-haiku-4-5"],hint:"支持自动补全常见模型；也可手动输入自定义模型 ID。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_RESULTS",label:"最大结果数（跨文档）",component:"number",effect:"live",min:1,max:200,hint:"search 工具返回的最大文档数量。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_NODES_PER_DOC",label:"每文档最大节点数",component:"number",effect:"live",min:1,max:20,hint:"同一文档返回的最大节点（段落）数。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MAX_SPAN",label:"关键词最大跨度",component:"number",effect:"live",min:1,max:100,hint:"窗口内匹配关键词的最大字符跨度。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORD_MATCH",label:"最少关键词匹配数",component:"number",effect:"live",min:0,max:10,hint:"文档至少命中多少个关键词才进入候选。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_PROXIMITY_SCORE",label:"最低邻近度阈值",component:"select",effect:"live",options:[{value:"0",label:"0 — 不限制"},{value:"1",label:"1 — 部分紧邻"},{value:"2",label:"2 — 全部关键词紧邻"}],hint:"关键词在文档中的邻近程度阈值。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORDS_PER_LINE",label:"行级关键词阈值",component:"number",effect:"live",min:1,max:10,hint:'单行至少命中多少关键词才被选为"最佳行"。'},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_SCORE_THRESHOLD",label:"综合评分阈值",component:"number",effect:"live",min:0,max:1,step:.05,hint:"0 = 不过滤；0.3 = 轻微过滤；0.5+ 容易砍光多关键词结果。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_KEYWORD_MATCH",label:"关键词匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏好'命中的关键词数量多'的文档（多关键词 query 时尤其重要）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FILE_NAME_MATCH",label:"文件名匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，文件名包含关键词的文档排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FTS_SCORE",label:"FTS 原始分权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏向传统全文检索 BM25 排序（与关键词匹配度正相关）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_TITLE_MATCH",label:"标题匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，节点标题（如 Markdown 小节标题）含关键词时排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_PROXIMITY_MATCH",label:"邻近度权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，多关键词在文档中紧邻出现的文档越受偏好。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_CONTEXT_LINES",label:"上下文行数上限",component:"number",unit:"行",min:0,max:100,hint:"每个命中行向上/向下最多各显示多少行原文上下文。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_ANCHOR_LINES",label:"锚点行数上限",component:"number",unit:"行",min:1,max:50,hint:"从同一文档的所有命中行里，挑出多少个'最佳行'作为展示中心（锚点）。锚点越多，结果越完整但输出越长。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_CONTEXT_EXPAND_RANGE",label:"锚点上下文扩展范围",component:"number",unit:"行",min:0,max:100,hint:"以每个锚点为中心，向前/向后各展开多少行作为上下文（再与'上下文行数上限'取较小值）。"}];var xl=Object.defineProperty,_l=Object.getOwnPropertyDescriptor,ns=(e,t,r,o)=>{for(var s=o>1?void 0:o?_l(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&xl(t,r,s),s};let yt=class extends k{constructor(){super(...arguments),this.scope="local",this.exists=!0}render(){return c`
      <button class="pill active">🌍 全局</button>
    `}};yt.styles=_`
    :host {
      display: flex;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      font-family: var(--cortex-font);
    }
    .pill {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: 999px;
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      min-height: var(--cortex-touch-target, 44px);
    }
    .pill:hover { background: var(--cortex-surface-muted); }
    .pill.active {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
      font-weight: 500;
    }
    .new-tag {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-warning);
      margin-left: 4px;
    }
    @media (max-width: 1023px) {
      :host {
        position: sticky;
        top: 0;
        z-index: 5;
        box-shadow: 0 1px 0 var(--cortex-border);
      }
    }
  `;ns([d()],yt.prototype,"scope",2);ns([d({type:Boolean})],yt.prototype,"exists",2);yt=ns([E("settings-scope-segment")],yt);class or extends Error{constructor(t,r){super(`Config API error ${t}`),this.status=t,this.body=r}}async function yl(e){const t=await fetch(`/api/config?scope=${e}`,{method:"GET"}),r=await t.json().catch(()=>null);if(!t.ok)throw new or(t.status,r);return r}async function wl(e,t){const r=await fetch(`/api/config?scope=${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:t})}),o=await r.json().catch(()=>null);if(!r.ok)throw new or(r.status,o);return o}var kl=Object.defineProperty,$l=Object.getOwnPropertyDescriptor,ne=(e,t,r,o)=>{for(var s=o>1?void 0:o?$l(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&kl(t,r,s),s};const Ys=["ai","search","scoring","terminal"];let X=class extends k{constructor(){super(...arguments),this._activeTab="ai",this._saving=!1,this._error=null,this._toast=null,this._values={},this._original={},this._userEditedBaseUrl=!1,this._exists=!0,this._scope="global",this._fieldErrors={},this._loadGen=0,this._onSaveRequest=()=>{this._save()},this._onRevertRequest=()=>{this._revert()}}connectedCallback(){super.connectedCallback();const e=f.getState();this._scope=e.settings.scope,this._unsubscribe=f.subscribe(()=>this._onStoreChange()),window.addEventListener("cortex:save-settings",this._onSaveRequest),window.addEventListener("cortex:revert-settings",this._onRevertRequest),this._load()}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer!==void 0&&(window.clearTimeout(this._toastTimer),this._toastTimer=void 0),this._loadGen+=1,window.removeEventListener("cortex:save-settings",this._onSaveRequest),window.removeEventListener("cortex:revert-settings",this._onRevertRequest),super.disconnectedCallback()}_onStoreChange(){const e=f.getState();e.settings.scope!==this._scope&&(this._scope=e.settings.scope,this._load())}async _load(){const e=++this._loadGen;this._error=null;try{const t=await yl(this._scope);if(e!==this._loadGen||!this.isConnected)return;this._values={...t.values},this._original={...t.values},this._userEditedBaseUrl=!1,this._exists=t.exists,this._fieldErrors={},m.loadSettings(t.values,t.exists)}catch(t){if(e!==this._loadGen||!this.isConnected)return;this._error=`加载失败: ${t.message}`}}get _dirtyFields(){const e=new Set([...Object.keys(this._original),...Object.keys(this._values)]),t=[];for(const r of e)(this._original[r]??"")!==(this._values[r]??"")&&t.push(r);return t}get _dirty(){return this._dirtyFields.length>0}_updateValues(e){this._values={...this._values,...e};for(const[t,r]of Object.entries(e))m.updateSetting(t,r)}_onInput(e,t){if(e==="PLANIFY_PROVIDER"){this._onProviderChange(t);return}if(e==="PLANIFY_BASE_URL"){this._onBaseUrlChange(t);return}this._updateValues({[e]:t})}_onProviderChange(e){if(e==="custom"){const t=this._values.PLANIFY_PROTOCOL?{PLANIFY_PROVIDER:e}:{PLANIFY_PROVIDER:e,PLANIFY_PROTOCOL:"openai_compat"};this._updateValues(t);return}if(!this._userEditedBaseUrl){this._updateValues({PLANIFY_PROVIDER:e,PLANIFY_BASE_URL:ml[e]??"",PLANIFY_PROTOCOL:Ks[e]??"anthropic"});return}this._updateValues({PLANIFY_PROVIDER:e,PLANIFY_PROTOCOL:Ks[e]??"anthropic"})}_onBaseUrlChange(e){this._userEditedBaseUrl=!0,this._updateValues({PLANIFY_BASE_URL:e})}_isMobile(){return typeof window.matchMedia=="function"&&window.matchMedia("(max-width: 1023px)").matches}_pushToast(e,t="info",r=2500){var s;const o=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");o==null||o.pushToast(e,t,r)}_extractFieldErrors(e){if(e instanceof or){const t=e.body,r={};for(const o of(t==null?void 0:t.fields)??[])r[o.field]=o.error;return r}return{}}_revert(){this._values={...this._original},this._userEditedBaseUrl=!1,m.revertSettings()}async _save(){var e;if(!(!this._dirty||this._saving)){this._saving=!0,this._error=null,this._fieldErrors={};try{const t=await wl(this._scope,this._values);if(!this.isConnected)return;this._original={...this._values},this._userEditedBaseUrl=!1,m.loadSettings(this._values,!0);const r=t.needs_restart?"已保存。重启 doclens gui 后 AI 配置生效。":"已保存。下次查询立即生效。";this._isMobile()?this._pushToast(r,"success",4e3):this._toast=r}catch(t){let r;if(t instanceof or){const o=t.body,s=(e=o==null?void 0:o.fields)==null?void 0:e.map(i=>i.field).join(", ");r=s?`保存失败（${s}）`:`保存失败 (HTTP ${t.status})`}else t instanceof Error?r=`保存失败: ${t.message}`:r="保存失败: 未知错误";this._isMobile()?(this._pushToast(r,"error",5e3),this._fieldErrors=this._extractFieldErrors(t)):this._error=r}finally{this._saving=!1}}}_renderField(e){const t=this._values[e.envVar]??"",r=e.effect?c`<span class="effect ${e.effect}">${e.effect==="restart"?"🔁 需重启":"● 即时"}</span>`:w;return c`
      <div class="field">
        <div class="field-label">
          <div class="name">${e.label} ${r}</div>
          <div class="env">${e.envVar}${e.min!==void 0&&e.max!==void 0?` · 范围 ${e.min}~${e.max}`:""}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(e,t)}</div>
          ${e.hint?c`<div class="hint">${e.hint}</div>`:w}
          ${this._fieldErrors[e.envVar]?c`<div class="field-error">${this._fieldErrors[e.envVar]}</div>`:w}
        </div>
      </div>
    `}_renderInput(e,t){const r=e.mono?"mono":"",o=s=>this._onInput(e.envVar,s.target.value);switch(e.component){case"text":return c`
          <input
            class="input ${r}"
            type="text"
            .value=${t}
            data-env=${e.envVar}
            @input=${o}
            list=${e.datalist?`${e.envVar}-list`:w}
          />
          ${e.datalist?c`
            <datalist id=${`${e.envVar}-list`}>
              ${e.datalist.map(s=>c`<option value=${s}></option>`)}
            </datalist>
          `:w}
        `;case"password":return c`
          <div style="position: relative; max-width: 420px;">
            <input
              class="input ${r}"
              type="password"
              .value=${t}
              data-env=${e.envVar}
              @input=${o}
            />
            <button
              class="btn"
              type="button"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); padding: 2px 8px; font-size: var(--cortex-fs-xs);"
              @click=${s=>{const i=s.target.previousElementSibling;i.type=i.type==="password"?"text":"password"}}
            >显示</button>
          </div>
        `;case"number":return c`
          <input
            class="input"
            type="number"
            .value=${t}
            min=${e.min??w}
            max=${e.max??w}
            step=${e.step??w}
            data-env=${e.envVar}
            @input=${o}
          />
          ${e.unit?c`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${e.unit}</span>`:w}
        `;case"select":return c`
          <select class="select" .value=${t} data-env=${e.envVar} @change=${o}>
            ${(e.options??[]).map(s=>c`
              <option value=${s.value} ?selected=${s.value===t}>${s.label}</option>
            `)}
          </select>
        `;case"slider":return c`
          <div class="slider-row">
            <input
              class="input"
              type="number"
              .value=${t}
              min=${e.min??w}
              max=${e.max??w}
              step=${e.step??w}
              style="width: 100px;"
              data-env=${e.envVar}
              @input=${o}
            />
            <input
              type="range"
              .value=${t}
              min=${e.min??w}
              max=${e.max??w}
              step=${e.step??w}
              @input=${o}
            />
            <span class="value-chip" data-role="value-chip">${t}</span>
          </div>
        `;default:return w}}_renderInfoBox(e){return e==="ai"?c`
        <div class="info-box">
          本 tab 的所有参数修改后需<strong>重启 doclens gui</strong> 才能生效。
        </div>
      `:e==="search"?c`<div class="info-box">本 tab 的参数保存后下次查询即时生效，<strong>无需重启</strong>。</div>`:e==="scoring"?c`
        <div class="info-box">
          <strong>📐 评分原理（白话版）</strong><br>
          最终得分（0~1）= 把下面 5 个信号<strong>按权重做加权平均</strong>（每个信号名对应下方一个"XX 权重"字段）：<br>
          • <strong>关键词匹配</strong> —— 文档里命中的关键词数 ÷ 你查询的总词数<br>
          • <strong>文件名匹配</strong> —— 文件名里命中的关键词数 ÷ 总词数<br>
          • <strong>FTS 原始分</strong> —— FTS5 全文检索给的相关度（0~1 之间）<br>
          • <strong>标题匹配</strong> —— 段落标题里命中的关键词数 ÷ 总词数<br>
          • <strong>邻近度</strong> —— 0 / 0.5 / 1 三档（多词紧挨着分数更高）<br><br>
          每个权重<strong>越大</strong>，对应信号对最终排序的影响越大；权重设为 <code>0</code> = <strong>完全忽略</strong>该信号。推荐区间 <code>0~10</code>。
        </div>
      `:e==="terminal"?c`
        <div class="info-box warn">
          ⚠️ 这些参数仅影响 <code>doclens</code> CLI/TUI 的<strong>终端输出格式</strong>，对 Web UI 没有可见效果。在此处提供编辑仅为了免去手动改 .env 的麻烦。
        </div>
      `:w}render(){const e="全局",t=this._exists?"":"（新建）";return c`
      <div class="copy-banner">
        <span>ℹ️</span>
        <span>正在编辑全局配置。</span>
        <span class="grow"></span>
      </div>
      <div class="layout">
        <aside class="sidebar">
          <settings-scope-segment
            .scope=${this._scope}
            .exists=${this._exists}
            @scope-change=${r=>{m.setSettingsScope(r.detail.scope)}}
          ></settings-scope-segment>
          <nav class="tab-strip" role="tablist">
            ${Ys.map(r=>c`
              <button
                class=${this._activeTab===r?"active":""}
                @click=${()=>{this._activeTab=r}}
              >${fl[r]}</button>
            `)}
          </nav>
        </aside>
        <main class="main">
          <div class="scroll-area">
            ${Ys.map(r=>{const o=gl.filter(i=>i.tab===r),s=[];for(const i of o){let a=s.find(l=>l.title===i.section);a||(a={title:i.section,fields:[]},s.push(a)),a.fields.push(i)}return c`
                <div class="tab-panel ${this._activeTab===r?"active":""}" data-panel=${r}>
                  ${this._renderInfoBox(r)}
                  ${s.map(i=>c`
                    <div class="section">
                      <h2>${i.title}</h2>
                      ${i.fields.map(a=>this._renderField(a))}
                    </div>
                  `)}
                </div>
              `})}
          </div>
          <div class="footer-bar">
            <div class="dirty-status">
              ${this._dirty?c`<span class="dirty-dot"></span><span>有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`:c`<span style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`}
              ${this._error?c`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>`:w}
              ${this._toast?c`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>`:w}
            </div>
            <div style="display: flex; gap: var(--cortex-space-2);">
              <button class="btn" ?disabled=${!this._dirty||this._saving} @click=${()=>this._revert()}>放弃修改</button>
              <button class="btn primary" ?disabled=${!this._dirty||this._saving} @click=${()=>this._save()}>
                ${this._saving?"保存中…":`💾 保存${e}配置${t}`}
              </button>
            </div>
          </div>
        </main>
      </div>
      <toast-stack></toast-stack>
    `}};X.styles=_`
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
      border-right: 1px solid var(--cortex-border);
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
      gap: var(--cortex-space-1);
    }
    .tab-strip button {
      background: transparent;
      border: none;
      border-left: 3px solid transparent;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      border-radius: 0;
    }
    .tab-strip button:hover { color: var(--cortex-text); background: var(--cortex-surface-muted); }
    .tab-strip button.active {
      color: var(--cortex-primary);
      border-left-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      font-weight: 500;
    }
    .scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--cortex-space-4);
    }
    .tab-panel { display: none; max-width: 680px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    .section {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-md);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      margin-bottom: var(--cortex-space-4);
    }
    .section h2 {
      margin: 0 0 var(--cortex-space-4);
      font-size: var(--cortex-fs-md);
      font-weight: 600;
      color: var(--cortex-text);
      letter-spacing: -0.01em;
    }
    .section-desc {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin: 0 0 var(--cortex-space-4) 0;
    }
    .field {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-3) 0;
      border-top: 1px solid var(--cortex-border-muted);
      align-items: start;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      color: var(--cortex-text);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .field-label .env {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      margin-top: 2px;
    }
    .field-control { display: flex; flex-direction: column; gap: var(--cortex-space-1); }
    .field-control .row { display: flex; align-items: center; gap: var(--cortex-space-2); }
    .slider-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
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
    .field-control .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: var(--cortex-space-1);
    }

    .input, .select {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      max-width: 420px;
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }

    .effect {
      display: inline-flex;
      font-size: var(--cortex-fs-xs);
      padding: 2px var(--cortex-space-2);
      border-radius: var(--cortex-radius-sm);
      font-weight: 500;
    }
    .effect.restart { background: rgba(245,158,11,0.12); color: var(--cortex-warning); }
    .effect.live { background: rgba(16,185,129,0.12); color: var(--cortex-success); }

    .info-box {
      background: var(--cortex-primary-soft);
      border-left: 3px solid var(--cortex-primary);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      margin-bottom: var(--cortex-space-4);
      line-height: 1.7;
    }
    .info-box.warn {
      background: rgba(245,158,11,0.08);
      border-left-color: var(--cortex-warning);
    }

    .footer-bar {
      flex-shrink: 0;
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
      max-width: 680px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
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
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      font-family: inherit;
    }
    .btn:hover { background: var(--cortex-surface-muted); }
    .btn.primary {
      background: var(--cortex-primary-gradient);
      border: none;
      color: #fff;
      box-shadow: var(--cortex-primary-glow);
      font-weight: 500;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* 桌面端：隐藏 copy-banner（scope 已在 sidebar 显示，信息冗余）；移动端 @media 复位显示 */
    .copy-banner { display: none; }
    .copy-banner .grow { flex: 1; }

    /* ===== 移动端 (<1024px) ===== */
    @media (max-width: 1023px) {
      /* F1 移动端单列回退：scope+tab 回到顶部水平条，整体滚动，footer 隐藏，banner 显示 */
      :host { overflow-y: auto; }
      .layout { flex-direction: column; flex: 1; min-height: 0; overflow: visible; }
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
      .main { overflow: visible; min-height: 0; }
      .scroll-area { overflow: visible; }
      .tab-strip { flex-direction: row; overflow-x: auto; }
      .tab-strip button {
        border-left: none;
        border-bottom: 2px solid transparent;
        text-align: center;
        white-space: nowrap;
        border-radius: 0;
      }
      .tab-strip button:hover { background: transparent; }
      .tab-strip button.active {
        border-left-color: transparent;
        border-bottom-color: var(--cortex-primary);
        background: transparent;
      }
      .copy-banner {
        display: flex;
        background: var(--cortex-primary-soft);
        color: var(--cortex-primary);
        font-weight: 500;
        border-bottom: 1px solid var(--cortex-border);
        padding: var(--cortex-space-2) var(--cortex-space-4);
        align-items: center;
        gap: var(--cortex-space-3);
        font-size: var(--cortex-fs-sm);
      }

      .field {
        grid-template-columns: 1fr;
        gap: var(--cortex-space-3);
        padding: var(--cortex-space-4) 0;
      }
      .field-label .name { font-size: var(--cortex-fs-md); }

      .scroll-area {
        padding: 0 var(--cortex-space-4) var(--cortex-space-6);
      }

      .footer-bar { display: none; }

      .input, .select { max-width: 100%; }

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
      .value-chip {
        display: inline-block;
        align-self: flex-start;
        font-size: var(--cortex-fs-md);
        font-weight: 600;
      }

      /* Password "显示" 按钮：从绝对定位改为独立行 */
      .password-wrap { max-width: 100% !important; position: static !important; }
      .password-toggle {
        position: static !important;
        transform: none !important;
        margin-top: var(--cortex-space-2);
        align-self: flex-end;
      }

      /* 复制 banner 堆叠 */
      .copy-banner {
        flex-direction: column;
        align-items: stretch;
        padding: var(--cortex-space-3) var(--cortex-space-4);
      }
      .copy-banner .grow { display: none; }
      .copy-banner button { align-self: flex-end; }

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
      .info-box {
        padding: var(--cortex-space-2) var(--cortex-space-3);
        line-height: 1.55;
        font-size: var(--cortex-fs-xs);
      }
      .info-box br + br { display: none; }
      .tab-strip {
        padding: 0 var(--cortex-space-3);
        gap: var(--cortex-space-1);
      }
      .tab-strip button {
        padding: var(--cortex-space-3) var(--cortex-space-2);
        font-size: var(--cortex-fs-sm);
      }
      .copy-banner {
        padding: var(--cortex-space-3);
        font-size: var(--cortex-fs-xs);
      }
    }
  `;ne([v()],X.prototype,"_activeTab",2);ne([v()],X.prototype,"_saving",2);ne([v()],X.prototype,"_error",2);ne([v()],X.prototype,"_toast",2);ne([v()],X.prototype,"_values",2);ne([v()],X.prototype,"_original",2);ne([v()],X.prototype,"_userEditedBaseUrl",2);ne([v()],X.prototype,"_exists",2);ne([v()],X.prototype,"_scope",2);ne([v()],X.prototype,"_fieldErrors",2);X=ne([E("settings-view")],X);const he=e=>`/api/files${e}`,pe={list:(e,t=200,r=0)=>F(he(`/list?path=${encodeURIComponent(e)}&limit=${t}&offset=${r}`)),stats:e=>F(he(`/stats?path=${encodeURIComponent(e)}`)),attrs:e=>F(he(`/attrs?path=${encodeURIComponent(e)}`)),mkdir:e=>F(he("/mkdir"),{method:"POST",json:{path:e}}),remove:e=>F(he(`?path=${encodeURIComponent(e)}`),{method:"DELETE"}),move:(e,t,r=!1)=>F(he("/move"),{method:"POST",json:{from_paths:e,dest_dir:t,overwrite:r}}),rename:(e,t)=>F(he("/rename"),{method:"POST",json:{path:e,new_name:t}}),upload:(e,t,r=!1)=>{const o=new FormData;return o.append("file",e),o.append("dest_dir",t),o.append("overwrite",String(r)),F(he("/upload"),{method:"POST",body:o})}};var Sl=Object.defineProperty,El=Object.getOwnPropertyDescriptor,ge=(e,t,r,o)=>{for(var s=o>1?void 0:o?El(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Sl(t,r,s),s};let ce=class extends k{constructor(){super(...arguments),this.depth=0,this.expanded=!1,this.selected=!1,this.readonly=!1,this.childEntries=[],this.loading=""}_onClick(){this.readonly?this.dispatchEvent(new CustomEvent("pick-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0})):this.dispatchEvent(new CustomEvent("select-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}_toggle(e){e.stopPropagation(),this.entry.has_child_dirs&&this.dispatchEvent(new CustomEvent("toggle",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}render(){return c`
      <div class="row ${this.selected?"selected":""}" @click=${this._onClick}>
        <span
          class="arrow ${this.expanded?"expanded":""} ${this.entry.has_child_dirs?"":"leaf"}"
          @click=${this._toggle}>▶</span>
        <span class="icon">${this.entry.is_dir?"📁":"📄"}</span>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded&&this.entry.is_dir?c`
        <div class="children">
          ${this.loading===this.entry.path?c`<div style="padding: 4px 8px; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm);">加载中…</div>`:this.childEntries.filter(e=>e.is_dir).map(e=>c`
              <tree-node
                .entry=${e}
                .depth=${this.depth+1}
                .readonly=${this.readonly}
                @select-dir=${t=>this._relay("select-dir",t)}
                @toggle=${t=>this._relay("toggle",t)}
                @pick-dir=${t=>this._relay("pick-dir",t)}
              ></tree-node>
            `)}
        </div>
      `:""}
    `}_relay(e,t){t.stopPropagation();const r=t.detail;this.dispatchEvent(new CustomEvent(e,{detail:r,bubbles:!0,composed:!0}))}};ce.styles=_`
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
      font-size: 10px;
    }
    .arrow.expanded { transform: rotate(90deg); }
    .arrow.leaf { visibility: hidden; }
    .icon { font-size: 14px; }
    .label {
      flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);
    }
    .children { padding-left: 16px; }
  `;ge([d({type:Object})],ce.prototype,"entry",2);ge([d({type:Number})],ce.prototype,"depth",2);ge([d({type:Boolean})],ce.prototype,"expanded",2);ge([d({type:Boolean})],ce.prototype,"selected",2);ge([d({type:Boolean})],ce.prototype,"readonly",2);ge([d({type:Array})],ce.prototype,"childEntries",2);ge([d({type:String})],ce.prototype,"loading",2);ce=ge([E("tree-node")],ce);var Cl=Object.getOwnPropertyDescriptor,Pl=(e,t,r,o)=>{for(var s=o>1?void 0:o?Cl(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=a(s)||s);return s};let Mr=class extends k{constructor(){super(...arguments),this._onToggle=async e=>{const t=e.detail.path,{expandedPaths:r}=f.getState().files;r.includes(t)?m.collapseDir(t):(await this._ensureLoaded(t),m.expandDir(t))},this._onSelectDir=async e=>{m.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path),m.expandDir(e.detail.path)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),m.expandDir("")}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}async _ensureLoaded(e){const{treeCache:t}=f.getState().files;if(!(e in t))try{m.setFilesState({listing:!0});const r=await pe.list(e);m.setFilesState({treeCache:{...f.getState().files.treeCache,[e]:r.entries},listing:!1})}catch(r){m.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"})}}render(){const{treeCache:e,expandedPaths:t,currentDir:r}=f.getState().files,o=e[""]||[],s=new Set(t);return c`
      <div class="header">文件</div>
      ${o.filter(i=>i.is_dir).map(i=>c`
        <tree-node
          .entry=${i}
          .depth=${0}
          .expanded=${s.has(i.path)}
          .selected=${i.path===r}
          .childEntries=${e[i.path]||[]}
          .loading=""
          @toggle=${this._onToggle}
          @select-dir=${this._onSelectDir}
        ></tree-node>
      `)}
    `}};Mr.styles=_`
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
  `;Mr=Pl([E("file-tree")],Mr);const Al={pdf:{letter:"P",bg:"#DC2626",fg:"#FFFFFF"},doc:{letter:"D",bg:"#2563EB",fg:"#FFFFFF"},docx:{letter:"D",bg:"#2563EB",fg:"#FFFFFF"},xls:{letter:"X",bg:"#16A34A",fg:"#FFFFFF"},xlsx:{letter:"X",bg:"#16A34A",fg:"#FFFFFF"},csv:{letter:"C",bg:"#16A34A",fg:"#FFFFFF"},ppt:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},pptx:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},md:{letter:"M",bg:"#6366F1",fg:"#FFFFFF"},txt:{letter:"T",bg:"#6B7280",fg:"#FFFFFF"},html:{letter:"H",bg:"#E34F26",fg:"#FFFFFF"}};function qo(e){if(!e)return"";const t=e.lastIndexOf(".");return t<=0||t===e.length-1?"":e.slice(t+1).toLowerCase()}function Tl(e,t){if(t)return null;const r=qo(e);return Al[r]??null}function Dl(e){return e.is_dir?"文件夹":qo(e.name)}var zl=Object.defineProperty,Ol=Object.getOwnPropertyDescriptor,hr=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ol(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&zl(t,r,s),s};let Ze=class extends k{constructor(){super(...arguments),this.selected=!1,this.active=!1}_fmtSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}_fmtTime(e){if(!e)return"";try{return new Date(e).toLocaleString(void 0,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return""}}_onRowClick(){this.dispatchEvent(new CustomEvent("activated",{detail:{path:this.entry.path,is_dir:this.entry.is_dir},bubbles:!0,composed:!0}))}_onCheckboxClick(e){e.stopPropagation(),this.dispatchEvent(new CustomEvent("checked",{detail:{path:this.entry.path,ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey},bubbles:!0,composed:!0}))}render(){const e=Tl(this.entry.name,this.entry.is_dir);return c`
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
          ${this.entry.is_dir?"📁":e?c`<span class="type-badge"
                  style="background:${e.bg};color:${e.fg}">${e.letter}</span>`:"📄"}
        </span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.is_dir?"":this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
        <span class="cell-indexed">${!this.entry.is_dir&&this.entry.indexed?c`<span class="badge">已索引</span>`:""}</span>
        <span class="cell-type">${Dl(this.entry)}</span>
      </div>
    `}};Ze.styles=_`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns:
        var(--col-1, 28px)
        var(--col-2, 28px)
        var(--col-3, 240px)
        var(--col-4, 80px)
        var(--col-5, 140px)
        var(--col-6, 70px)
        var(--col-7, 80px);
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
    .cell-icon { font-size: 14px; }
    .name {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: var(--cortex-text); font-size: var(--cortex-fs-sm);
    }
    .size, .time, .cell-type, .cell-indexed {
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
    @media (max-width: 1023px) {
      .row {
        grid-template-columns:
          var(--col-1, 28px)
          var(--col-2, 28px)
          var(--col-3, 240px)
          var(--col-4, 80px)
          var(--col-5, 140px)
          var(--col-6, 70px);
      }
      .cell-type { display: none; }
    }
  `;hr([d({type:Object})],Ze.prototype,"entry",2);hr([d({type:Boolean})],Ze.prototype,"selected",2);hr([d({type:Boolean})],Ze.prototype,"active",2);Ze=hr([E("file-row")],Ze);var Rl=Object.defineProperty,Il=Object.getOwnPropertyDescriptor,zt=(e,t,r,o)=>{for(var s=o>1?void 0:o?Il(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Rl(t,r,s),s};const Xo=[28,28,240,80,140,70,80],Gs=[20,20,80,50,80,50,50],Zs=[60,60,800,200,300,150,200],Js=Xo.length,Qs="cortex.files.colWidths";let Ie=class extends k{constructor(){super(...arguments),this.activePath="",this.mobile=!1,this._colWidths=[...Xo],this._showMobileMenu=!1,this._makeColResizeHandler=e=>t=>{t.preventDefault(),t.stopPropagation();const r=t.clientX,o=this._colWidths[e];document.body.style.cursor="col-resize",document.body.style.userSelect="none";const s=a=>{const l=a.clientX-r,n=Math.max(Gs[e],Math.min(Zs[e],o+l)),h=[...this._colWidths];h[e]=n,this._colWidths=h},i=()=>{document.removeEventListener("mousemove",s),document.removeEventListener("mouseup",i),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(Qs,JSON.stringify(this._colWidths))};document.addEventListener("mousemove",s),document.addEventListener("mouseup",i)},this._onMobileBackClick=()=>{this._showMobileMenu=!1,this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=e=>{e.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=e=>{var s,i;if(!this._showMobileMenu)return;const t=e.composedPath(),r=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-menu"),o=(i=this.shadowRoot)==null?void 0:i.querySelector(".mobile-more");r&&t.includes(r)||o&&t.includes(o)||(this._showMobileMenu=!1)},this._onMenuItemClick=e=>t=>{t.stopPropagation(),this._showMobileMenu=!1,this._action(e)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._loadColWidths(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}willUpdate(){for(let e=0;e<Js;e++)this.style.setProperty(`--col-${e+1}`,`${this._colWidths[e]}px`)}_loadColWidths(){const e=localStorage.getItem(Qs);if(e)try{const t=JSON.parse(e);Array.isArray(t)&&t.length===Js&&t.every(r=>typeof r=="number"&&Number.isFinite(r))&&(this._colWidths=t.map((r,o)=>Math.max(Gs[o],Math.min(Zs[o],r))))}catch{}}_action(e){this.dispatchEvent(new CustomEvent("action",{detail:{name:e},bubbles:!0,composed:!0}))}_onRowChecked(e){const{path:t,shift:r}=e.detail;m.selectEntry(t,{ctrl:!r,shift:r})}_onSelectAll(e){const t=e.target,{currentDir:r,treeCache:o,selectedPaths:s}=f.getState().files,i=o[r]||[];if(t.checked){const a=i.map(n=>n.path),l=Array.from(new Set([...s,...a]));m.setFilesState({selectedPaths:l})}else{const a=new Set(i.map(l=>l.path));m.setFilesState({selectedPaths:s.filter(l=>!a.has(l))})}}_goUp(){const{currentDir:e}=f.getState().files;if(e==="")return;const t=e.includes("/")?e.slice(0,e.lastIndexOf("/")):"";m.selectDir(t)}_renderMobileHeader(){const{currentDir:e,selectedPaths:t}=f.getState().files,r=t.length===1,o=t.length>=1,s=e===""?"/":`/${e}/`;return c`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        >←</button>
        <span class="mobile-path" title=${s}>${s}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        >⋯</button>
        ${this._showMobileMenu?c`
              <div class="mobile-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  data-action="mkdir"
                  @click=${this._onMenuItemClick("mkdir")}
                >+ 新目录</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="upload"
                  @click=${this._onMenuItemClick("upload")}
                >⬆ 上传</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="rename"
                  ?disabled=${!r}
                  @click=${this._onMenuItemClick("rename")}
                >✎ 重命名</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="move"
                  ?disabled=${!o}
                  @click=${this._onMenuItemClick("move")}
                >→ 移动</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="delete"
                  ?disabled=${!o}
                  class="danger"
                  @click=${this._onMenuItemClick("delete")}
                >🗑 删除</button>
              </div>
            `:null}
      </div>
    `}render(){const{currentDir:e,treeCache:t,selectedPaths:r}=f.getState().files,o=t[e]||[],s=new Set(r),i=r.length===1,a=r.length>=1,l=e!=="",n=e===""?"/":`/${e}/`,h=o.length>0&&o.every(u=>s.has(u.path));return this.mobile?c`
        ${this._renderMobileHeader()}
        ${o.length===0?c`<div class="empty">目录为空</div>`:c`<div class="header-row">
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
              <span class="cell-indexed"></span>
            </div>`}
        <div class="rows">
          ${o.map(u=>c`
            <file-row
              .entry=${u}
              .selected=${s.has(u.path)}
              .active=${u.path===this.activePath}
              @checked=${this._onRowChecked}
            ></file-row>`)}
        </div>
      `:c`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!l}
          @click=${this._goUp}
        >↑</button>
        <span class="path">${n}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${()=>this._action("mkdir")}>+ 新目录</button>
        <button data-action="upload" @click=${()=>this._action("upload")}>⬆ 上传</button>
        <button data-action="rename" ?disabled=${!i} @click=${()=>this._action("rename")}>✎ 重命名</button>
        <button data-action="move" ?disabled=${!a} @click=${()=>this._action("move")}>→ 移动</button>
        <button data-action="delete" ?disabled=${!a} class="danger" @click=${()=>this._action("delete")}>🗑 删除</button>
      </div>
      ${o.length===0?c`<div class="empty">目录为空</div>`:c`<div class="header-row">
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
            <span class="cell-indexed"><span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(5)}
              ></span></span>
            <span class="cell-type">类型</span>
          </div>`}
      <div class="rows">
        ${o.map(u=>c`
          <file-row
            .entry=${u}
            .selected=${s.has(u.path)}
            .active=${u.path===this.activePath}
            @checked=${this._onRowChecked}
          ></file-row>`)}
      </div>
    `}};Ie.styles=_`
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
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
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
      padding: 6px 12px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
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
      padding: 6px 10px;
      border-radius: var(--cortex-radius-sm);
      min-width: 36px;
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
      display: block;
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
        var(--col-5, 140px)
        var(--col-6, 70px)
        var(--col-7, 80px);
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
      .header-row {
        grid-template-columns:
          var(--col-1, 28px)
          var(--col-2, 28px)
          var(--col-3, 240px)
          var(--col-4, 80px)
          var(--col-5, 140px)
          var(--col-6, 70px);
      }
      .header-row .cell-type { display: none; }
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
      height: 100%;
      background: linear-gradient(
        to bottom,
        var(--cortex-primary-soft),
        var(--cortex-primary)
      );
      transition: background 0.15s;
    }
    .col-resize:hover::before,
    .col-resize:active::before {
      background: var(--cortex-primary);
    }
    .select-all { display: flex; align-items: center; justify-content: center; }
    .header-row .cell-size,
    .header-row .cell-time,
    .header-row .cell-indexed,
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
  `;zt([d()],Ie.prototype,"activePath",2);zt([d({type:Boolean})],Ie.prototype,"mobile",2);zt([v()],Ie.prototype,"_colWidths",2);zt([v()],Ie.prototype,"_showMobileMenu",2);Ie=zt([E("file-list")],Ie);var Ll=Object.defineProperty,Ml=Object.getOwnPropertyDescriptor,ls=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ml(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Ll(t,r,s),s};const Fl=/[\\/:*?"<>|]/,Nl=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let wt=class extends k{constructor(){super(...arguments),this._name="",this._err=""}get _parent(){return f.getState().files.currentDir}_validate(e){return e?e.startsWith(".")?"不能以点开头":Fl.test(e)?'含非法字符 / \\ : * ? " < > |':/\s/.test(e[0]||"")?"不能以空白开头":Nl.test(e)?"Windows 保留名":"":"名称不能为空"}_onInput(e){this._name=e.target.value,this._err=this._validate(this._name)}_submit(){if(this._err)return;const e=this._parent?`${this._parent}/${this._name}`:this._name;this.dispatchEvent(new CustomEvent("submit",{detail:{path:e},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=!!this._err;return c`
      <div class="row">
        <label>在 ${this._parent||"/"} 下新建目录</label>
        <input
          autofocus
          class=${e?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${t=>t.key==="Enter"&&this._submit()}
        />
        ${e?c`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${e} @click=${this._submit}>新建</button>
      </div>
    `}};wt.styles=_`
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-primary-gradient);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-primary-glow);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;ls([v()],wt.prototype,"_name",2);ls([v()],wt.prototype,"_err",2);wt=ls([E("mkdir-dialog")],wt);var Wl=Object.defineProperty,Bl=Object.getOwnPropertyDescriptor,pr=(e,t,r,o)=>{for(var s=o>1?void 0:o?Bl(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Wl(t,r,s),s};const Hl=/[\\/:*?"<>|]/,Ul=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let Je=class extends k{constructor(){super(...arguments),this.currentName="",this._name="",this._err=""}connectedCallback(){super.connectedCallback(),this._name=this.currentName,this._err=this._validate(this._name)}_validate(e){return e?e===this.currentName?"名称未变化":e.startsWith(".")?"不能以点开头":Hl.test(e)?'含非法字符 / \\ : * ? " < > |':Ul.test(e)?"Windows 保留名":"":"名称不能为空"}_onInput(e){this._name=e.target.value,this._err=this._validate(this._name)}_submit(){this._err||this.dispatchEvent(new CustomEvent("submit",{detail:{newName:this._name},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=!!this._err;return c`
      <div class="row">
        <label>重命名</label>
        <input
          autofocus
          class=${e?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${t=>t.key==="Enter"&&this._submit()}
        />
        ${e?c`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${e} @click=${this._submit}>重命名</button>
      </div>
    `}};Je.styles=_`
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-primary-gradient);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-primary-glow);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;pr([d({type:String})],Je.prototype,"currentName",2);pr([v()],Je.prototype,"_name",2);pr([v()],Je.prototype,"_err",2);Je=pr([E("rename-dialog")],Je);var jl=Object.defineProperty,Vl=Object.getOwnPropertyDescriptor,cs=(e,t,r,o)=>{for(var s=o>1?void 0:o?Vl(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&jl(t,r,s),s};let kt=class extends k{constructor(){super(...arguments),this._dest="",this._overwrite=!1}get _selectedCount(){return f.getState().files.selectedPaths.length}_onPickDir(e){this._dest=e.detail.path}_onToggle(e){e.stopPropagation()}_submit(){this._dest&&this.dispatchEvent(new CustomEvent("submit",{detail:{destDir:this._dest,overwrite:this._overwrite},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const{treeCache:e,expandedPaths:t}=f.getState().files,r=(e[""]||[]).filter(s=>s.is_dir),o=new Set(t);return c`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${r.map(s=>c`
          <tree-node
            .entry=${s}
            .depth=${0}
            .readonly=${!0}
            .expanded=${o.has(s.path)}
            .selected=${this._dest===s.path}
            .childEntries=${e[s.path]||[]}
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
    `}};kt.styles=_`
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-primary-gradient);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-primary-glow);
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
  `;cs([v()],kt.prototype,"_dest",2);cs([v()],kt.prototype,"_overwrite",2);kt=cs([E("move-dialog")],kt);var ql=Object.defineProperty,Xl=Object.getOwnPropertyDescriptor,fr=(e,t,r,o)=>{for(var s=o>1?void 0:o?Xl(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ql(t,r,s),s};let Qe=class extends k{constructor(){super(...arguments),this._phase="confirming",this._stats=null,this._confirmed=!1}get _selected(){return f.getState().files.selectedPaths}connectedCallback(){super.connectedCallback(),!this._stats&&this._selected.length>0&&(this._phase="loading-stats",this._loadStats())}async _loadStats(){const e=this._selected;let t=0,r=0,o=0;for(const s of e)try{const i=await pe.stats(s);t+=i.file_count,r+=i.dir_count,o+=i.total_size_bytes}catch{}t===0&&r===0&&(t=e.length),this._stats={file_count:t,dir_count:r,total_size_bytes:o},this._phase="confirming"}_fmtSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}_delete(){this._confirmed&&(this._phase="deleting",this.dispatchEvent(new CustomEvent("submit",{detail:{paths:this._selected},bubbles:!0,composed:!0})))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=this._selected.length;return this._phase==="loading-stats"?c`<div class="spinner">统计中…</div>`:c`
      <h3>删除 ${e>1?`${e} 项`:this._selected[0]}？</h3>
      <div class="warn">⚠️ 此操作不可恢复</div>
      ${this._stats?c`
        <div class="stats">
          将永久删除：
          <ul>
            <li>• ${this._stats.file_count} 个文件</li>
            ${this._stats.dir_count>0?c`<li>• ${this._stats.dir_count} 个子文件夹</li>`:""}
            ${this._stats.total_size_bytes>0?c`<li>• 总计 ${this._fmtSize(this._stats.total_size_bytes)}</li>`:""}
          </ul>
        </div>
      `:c`<div class="stats">将永久删除 ${e} 个项目。</div>`}
      <label class="opt">
        <input
          type="checkbox"
          .checked=${this._confirmed}
          @change=${t=>this._confirmed=t.target.checked}
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
    `}};Qe.styles=_`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); word-break: break-all; font-weight: 600; letter-spacing: -0.01em; color: var(--cortex-text); }
    .warn {
      padding: var(--cortex-space-3);
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.3);
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.danger {
      background: var(--cortex-danger);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-lg);
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
  `;fr([v()],Qe.prototype,"_phase",2);fr([v()],Qe.prototype,"_stats",2);fr([v()],Qe.prototype,"_confirmed",2);Qe=fr([E("delete-dialog")],Qe);var Kl=Object.defineProperty,Yl=Object.getOwnPropertyDescriptor,ds=(e,t,r,o)=>{for(var s=o>1?void 0:o?Yl(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Kl(t,r,s),s};let $t=class extends k{constructor(){super(...arguments),this.targetDir="",this._active=!1,this._dragCounter=0,this._onDragEnter=e=>{this._hasFilesOnly(e)&&(e.preventDefault(),this._dragCounter++,this._active=!0)},this._onDragOver=e=>{this._hasFilesOnly(e)&&e.preventDefault()},this._onDragLeave=()=>{this._dragCounter--,this._dragCounter<=0&&(this._active=!1,this._dragCounter=0)},this._onDrop=e=>{if(!e.dataTransfer)return;e.preventDefault(),this._active=!1,this._dragCounter=0;const t=Array.from(e.dataTransfer.files||[]);t.length!==0&&this.dispatchEvent(new CustomEvent("drop-files",{detail:{files:t,destDir:this.targetDir},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),window.addEventListener("dragenter",this._onDragEnter),window.addEventListener("dragover",this._onDragOver),window.addEventListener("dragleave",this._onDragLeave),window.addEventListener("drop",this._onDrop)}disconnectedCallback(){window.removeEventListener("dragenter",this._onDragEnter),window.removeEventListener("dragover",this._onDragOver),window.removeEventListener("dragleave",this._onDragLeave),window.removeEventListener("drop",this._onDrop),super.disconnectedCallback()}_hasFilesOnly(e){if(!e.dataTransfer)return!1;const t=Array.from(e.dataTransfer.items||[]);return t.length===0?e.dataTransfer.types.includes("Files"):t.every(r=>r.kind==="file")}render(){return c`
      <div class="overlay ${this._active?"active":""}">
        <div>⬇ 拖放以上传到</div>
        <div>📁 ${this.targetDir||"/"}</div>
      </div>
    `}};$t.styles=_`
    :host { display: contents; }
    .overlay {
      position: fixed; inset: 0;
      background: rgba(0, 82, 255, 0.05);
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
  `;ds([d({type:String})],$t.prototype,"targetDir",2);ds([v()],$t.prototype,"_active",2);$t=ds([E("drop-zone")],$t);var Gl=Object.defineProperty,Zl=Object.getOwnPropertyDescriptor,rt=(e,t,r,o)=>{for(var s=o>1?void 0:o?Zl(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Gl(t,r,s),s};const Jl=80,Ql="按文件名搜索…";let me=class extends k{constructor(){super(...arguments),this._value="",this._isComposing=!1,this.disabled=!1,this.placeholder=Ql,this.value="",this._timer=null,this._onInput=e=>{const t=e.target;if(this._value=t.value,this._value.trim()===""){this._emitClear();return}this._scheduleEmit()},this._onCompositionStart=()=>{this._isComposing=!0},this._onCompositionEnd=()=>{this._isComposing=!1,this._scheduleEmit()},this._onKeyDown=e=>{e.key==="Escape"&&(e.preventDefault(),this._emitClear())},this._onClearClick=()=>{var t;this._emitClear();const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e==null||e.focus()}}connectedCallback(){super.connectedCallback(),this.value&&(this._value=this.value)}disconnectedCallback(){this._timer&&clearTimeout(this._timer),super.disconnectedCallback()}_emitSearch(){this.dispatchEvent(new CustomEvent("search",{detail:{query:this._value},bubbles:!0,composed:!0}))}_scheduleEmit(){this._timer&&clearTimeout(this._timer),this._timer=setTimeout(()=>{this._timer=null,this._isComposing||this._emitSearch()},Jl)}_emitClear(){var t;this._timer&&(clearTimeout(this._timer),this._timer=null),this._value="";const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e&&(e.value=""),this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){return c`
      <div class="box">
        <span class="icon">🔍</span>
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
        ${this._value?c`<button class="clear" title="清空" @click=${this._onClearClick}>×</button>`:""}
      </div>
    `}};me.styles=_`
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
    .icon { color: var(--cortex-text-subtle); font-size: 13px; }
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
  `;rt([v()],me.prototype,"_value",2);rt([v()],me.prototype,"_isComposing",2);rt([d({type:Boolean})],me.prototype,"disabled",2);rt([d()],me.prototype,"placeholder",2);rt([d({type:String})],me.prototype,"value",2);me=rt([E("file-search-box")],me);var ec=Object.getOwnPropertyDescriptor,tc=(e,t,r,o)=>{for(var s=o>1?void 0:o?ec(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=a(s)||s);return s};const rc=100;function sc(e,t){if(!t)return e;const r=e.toLowerCase(),o=t.toLowerCase(),s=r.indexOf(o);return s===-1?e:[e.slice(0,s),c`<mark>${e.slice(s,s+o.length)}</mark>`,e.slice(s+o.length)]}function oc(e){const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t+1)}function ic(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}function ac(e){if(!e)return"";const t=new Date(e).getTime();if(Number.isNaN(t))return"";const r=Date.now()-t,o=24*3600*1e3;return r<o?"今天":r<2*o?"昨天":r<7*o?`${Math.floor(r/o)} 天前`:r<30*o?`${Math.floor(r/(7*o))} 周前`:r<365*o?`${Math.floor(r/(30*o))} 个月前`:`${Math.floor(r/(365*o))} 年前`}let Fr=class extends k{constructor(){super(...arguments),this._onKeyDown=e=>{const{results:t,selectedPath:r}=this._state;if(t.length===0){e.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}));return}const o=t.findIndex(s=>s.path===r);if(e.key==="ArrowDown"){e.preventDefault();const s=t[Math.min(t.length-1,o+1)];m.selectFilenameSearchResult(s.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else if(e.key==="ArrowUp"){e.preventDefault();const s=t[Math.max(0,o-1)];m.selectFilenameSearchResult(s.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else if(e.key==="Enter"){e.preventDefault();const s=t[o]??t[0];s&&this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else e.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}}get _state(){return f.getState().files.filenameSearch}_onRowClick(e){m.selectFilenameSearchResult(e.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:e.path},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.tabIndex=0,this.addEventListener("keydown",this._onKeyDown),this._unsubscribe=f.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;this.removeEventListener("keydown",this._onKeyDown),(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}render(){const{query:e,results:t,selectedPath:r,totalMatches:o}=this._state;return t.length===0?c`
        <div class="empty">
          <div class="icon-big">🔍</div>
          <div>未匹配到任何文件名包含 "<b>${e}</b>" 的文档</div>
        </div>
      `:c`
      <div class="header-bar">📄 文件名搜索结果 · 共 ${o} 项</div>
      <div class="columns">
        <span>名称 · 目录</span>
        <span>大小 · 修改</span>
      </div>
      <div class="rows">
        ${t.map(s=>{const i=oc(s.path),a=s.path===r;return c`
            <div
              class="row ${a?"active":""}"
              @click=${()=>this._onRowClick(s)}
            >
              <span class="name-cell">
                <span class="icon">📄</span>
                <span class="name">${sc(s.name,e)}</span>
                ${i?c`<span class="dir">${i}</span>`:""}
              </span>
              <span class="meta">${ic(s.size)} · ${ac(s.modifiedAt)}</span>
            </div>
          `})}
      </div>
      ${o>t.length?c`<div class="overflow-hint">共 ${o} 项，仅显示前 ${rc}，请补充关键字</div>`:""}
    `}};Fr.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      min-width: 0;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header-bar {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      background: var(--cortex-surface);
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
      background: rgba(0, 82, 255, 0.15);
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
  `;Fr=tc([E("file-search-results")],Fr);async function nc(){return(await F("/api/files/documents")).documents.map(t=>({path:t.path,name:t.name,size:t.size,modifiedAt:t.modified_at}))}var lc=Object.defineProperty,cc=Object.getOwnPropertyDescriptor,ee=(e,t,r,o)=>{for(var s=o>1?void 0:o?cc(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&lc(t,r,s),s};let y=class extends k{constructor(){super(...arguments),this._dialog=null,this._toast=null,this._toastTimer=null,this._previewPath="",this._previewContent="",this._previewLanguage="text",this._previewWritable=!1,this._previewPages=null,this._previewError=null,this._previewDirty=!1,this._treePaneWidth=y.TREE_PANE_WIDTH_DEFAULT,this._previewPaneWidth=y.PREVIEW_PANE_WIDTH_DEFAULT,this._fileInput=null,this._onTreeSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._treePaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const o=i=>{const a=i.clientX-t,l=this.clientWidth,n=l>0?l-this._previewPaneWidth-y.MIDDLE_PANE_MIN-y.SPLITTERS_TOTAL:y.TREE_PANE_WIDTH_MAX,h=Math.min(y.TREE_PANE_WIDTH_MAX,n),u=Math.max(y.TREE_PANE_WIDTH_MIN,Math.min(h,r+a));u!==this._treePaneWidth&&(this._treePaneWidth=u)},s=()=>{document.removeEventListener("mousemove",o),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(y.TREE_PANE_WIDTH_KEY,String(this._treePaneWidth))};document.addEventListener("mousemove",o),document.addEventListener("mouseup",s)},this._onPreviewSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const o=i=>{const a=i.clientX-t,l=this.clientWidth,n=l>0?l-this._treePaneWidth-y.MIDDLE_PANE_MIN-y.SPLITTERS_TOTAL:y.PREVIEW_PANE_WIDTH_MAX,h=Math.min(y.PREVIEW_PANE_WIDTH_MAX,n),u=Math.max(y.PREVIEW_PANE_WIDTH_MIN,Math.min(h,r-a));u!==this._previewPaneWidth&&(this._previewPaneWidth=u)},s=()=>{document.removeEventListener("mousemove",o),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(y.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",o),document.addEventListener("mouseup",s)},this._onPreviewDirty=e=>{this._previewDirty=e.detail.dirty},this._onPreviewSaved=()=>{this._previewDirty=!1,this._showToast("已保存")},this._onPreviewSaveFailed=e=>{this._showToast(`保存失败：${e.detail.message}`)},this._onPreviewUploadSuccess=e=>{this._previewDirty=!1,this._showToast(`已覆盖：${e.detail.path}`),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._showToast(`上传失败：${e.detail.message}`)},this._onFilenameSearch=e=>{const t=e.detail.query;if(t.trim()===""){m.clearFilenameSearch();return}const{allDocs:r}=f.getState().files.filenameSearch,o=t.toLowerCase(),s=r.filter(l=>l.name.toLowerCase().includes(o));s.sort((l,n)=>l.name.toLowerCase().localeCompare(n.name.toLowerCase(),"zh",{numeric:!0,sensitivity:"base"}));const i=s.length,a=s.slice(0,100);m.setFilenameSearchQuery({query:t,results:a,totalMatches:i}),a[0]&&this._previewPathWithDirtyCheck(a[0].path)},this._onFilenameClear=()=>{m.clearFilenameSearch()},this._onFilenameResultActivated=async e=>{await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&m.setMobilePane("detail")},this._cancelDialog=()=>{this._dialog=null}}connectedCallback(){super.connectedCallback(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),this._loadPaneWidths(),this._loadIndexedDocuments()}async _loadIndexedDocuments(){if(f.getState().files.filenameSearch.docsLoading)try{const e=await nc();m.loadIndexedDocuments(e)}catch(e){m.setFilenameSearchDocsError((e==null?void 0:e.message)||"文档列表加载失败")}}_loadPaneWidths(){const e=localStorage.getItem(y.TREE_PANE_WIDTH_KEY);if(e){const r=Number(e);Number.isNaN(r)||(this._treePaneWidth=Math.max(y.TREE_PANE_WIDTH_MIN,Math.min(y.TREE_PANE_WIDTH_MAX,r)))}const t=localStorage.getItem(y.PREVIEW_PANE_WIDTH_KEY);if(t){const r=Number(t);Number.isNaN(r)||(this._previewPaneWidth=Math.max(y.PREVIEW_PANE_WIDTH_MIN,Math.min(y.PREVIEW_PANE_WIDTH_MAX,r)))}}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer&&clearTimeout(this._toastTimer),super.disconnectedCallback()}get _state(){return f.getState().files}get _isMobile(){return typeof window<"u"&&window.innerWidth<1024}async _ensureLoaded(e){const{treeCache:t}=f.getState().files;if(!(e in t))try{m.setFilesState({listing:!0});const r=await pe.list(e);if(f.getState().files.treeCache!==t){const o=f.getState().files.treeCache;if(e in o)return;m.setFilesState({treeCache:{...o,[e]:r.entries},listing:!1});return}m.setFilesState({treeCache:{...t,[e]:r.entries},listing:!1})}catch(r){m.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"}),this._showToast((r==null?void 0:r.message)||"加载失败")}}updated(){}_showToast(e){this._toast=e,this._toastTimer&&clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},3500)}_onAction(e){const t=e.detail.name;if(t==="upload"){this._openFilePicker();return}if(["mkdir","rename","move","delete"].includes(t)){if(t==="rename"&&this._state.selectedPaths.length!==1||(t==="move"||t==="delete")&&this._state.selectedPaths.length===0)return;this._dialog=t}}_openFilePicker(){this._fileInput||(this._fileInput=document.createElement("input"),this._fileInput.type="file",this._fileInput.multiple=!0,this._fileInput.style.display="none",this._fileInput.addEventListener("change",()=>{this._fileInput&&this._fileInput.files&&this._fileInput.files.length>0&&(this._uploadFiles(Array.from(this._fileInput.files),this._state.currentDir),this._fileInput.value="")}),document.body.appendChild(this._fileInput)),this._fileInput.click()}async _onMkdirSubmit(e){this._dialog=null;try{await pe.mkdir(e.detail.path);const t=e.detail.path.includes("/")?e.detail.path.slice(0,e.detail.path.lastIndexOf("/")):"";m.invalidateDir(t),await this._ensureLoaded(t),m.expandDir(t),this._showToast("目录已创建")}catch(t){this._showToast((t==null?void 0:t.message)||"创建失败")}}async _onRenameSubmit(e){const t=this._state.selectedPaths[0];this._dialog=null;try{if(await pe.rename(t,e.detail.newName),m.invalidateDir(this._state.currentDir),await this._ensureLoaded(this._state.currentDir),this._previewPath===t){const r=t.includes("/")?t.slice(0,t.lastIndexOf("/")+1)+e.detail.newName:e.detail.newName;this._previewPath=r,this._reloadPreview()}this._showToast("已重命名")}catch(r){this._showToast((r==null?void 0:r.message)||"重命名失败")}}async _onMoveSubmit(e){const t=[...this._state.selectedPaths];this._dialog=null;try{const r=await pe.move(t,e.detail.destDir,e.detail.overwrite),o=new Set;t.forEach(s=>{o.add(s.includes("/")?s.slice(0,s.lastIndexOf("/")):"")}),o.add(e.detail.destDir),o.forEach(s=>m.invalidateDir(s));for(const s of o)await this._ensureLoaded(s);m.clearSelection(),this._showToast(r.skipped.length?`已移动 ${r.moved.length} 项，${r.skipped.length} 项跳过`:`已移动 ${r.moved.length} 项`)}catch(r){this._showToast((r==null?void 0:r.message)||"移动失败")}}async _onDeleteSubmit(e){const t=[...e.detail.paths];this._dialog=null;let r=0,o=0;for(const i of t)try{await pe.remove(i),r++,m.invalidateSubtree(i);const a=i.includes("/")?i.slice(0,i.lastIndexOf("/")):"";m.invalidateDir(a)}catch{o++}const s=new Set;t.forEach(i=>s.add(i.includes("/")?i.slice(0,i.lastIndexOf("/")):""));for(const i of s)await this._ensureLoaded(i);this._previewPath&&t.includes(this._previewPath)&&(this._previewPath="",this._previewContent="",this._previewError=null,this._previewWritable=!1,this._previewPages=null,this._previewDirty=!1),m.clearSelection(),this._showToast(o?`已删除 ${r}，失败 ${o}`:`已删除 ${r} 项`)}_onDropFiles(e){this._uploadFiles(e.detail.files,e.detail.destDir)}async _uploadFiles(e,t){let r=0,o=0,s="";for(const i of e)try{await pe.upload(i,t,!1),r++}catch(a){(a==null?void 0:a.code)==="ALREADY_EXISTS"?o++:s=(a==null?void 0:a.message)||"上传失败"}if(m.invalidateDir(t),await this._ensureLoaded(t),s&&r===0)this._showToast(s);else{const i=[`已上传 ${r}`];o>0&&i.push(`跳过 ${o}`),s&&i.push("部分失败"),this._showToast(i.join("，"))}}_goBack(){const e=this._state.mobilePane;e==="detail"?this._isFilenameSearchActive?m.setMobilePane("tree"):m.setMobilePane("list"):e==="list"&&m.setMobilePane("tree")}async _onFileListActivated(e){if(e.detail.is_dir){m.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path);return}await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&m.setMobilePane("detail")}async _previewPathWithDirtyCheck(e){if(this._previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await this._fetchPreview(e)}async _fetchPreview(e){const t=await Ye(e);t.ok?(this._previewError=null,this._previewPath=t.path,this._previewContent=t.content,this._previewLanguage=t.language,this._previewWritable=t.writable,this._previewPages=t.pages):t.notIndexed?(this._previewError="NOT_INDEXED",this._previewPath=e,this._previewContent="",this._previewWritable=!1,this._previewPages=null):this._showToast(t.message||"预览失败")}async _reloadPreview(){if(!this._previewPath)return;const e=await Ye(this._previewPath);e.ok&&(this._previewContent=e.content,this._previewLanguage=e.language,this._previewWritable=e.writable,this._previewPages=e.pages)}_discardPreviewEdits(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=e==null?void 0:e.discard)==null||r.call(e),this._previewDirty=!1}_renderNotIndexedHint(){return c`<div class="preview-placeholder">
      该文件未索引，无法预览。<br>
      请先执行 doclens index 后重试。
    </div>`}_renderPreviewPane(e={}){return this._previewError==="NOT_INDEXED"?this._renderNotIndexedHint():this._previewPath?c`<preview-pane
      ?noHeader=${e.noHeader??!1}
      ?mobile=${e.mobile??!1}
      path=${this._previewPath}
      language=${this._previewLanguage}
      content=${this._previewContent}
      ?writable=${this._previewWritable}
      .pages=${this._previewPages}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}
      @back=${()=>this._goBack()}
    ></preview-pane>`:c`<div class="preview-placeholder">点击文件预览</div>`}get _searchBoxState(){const e=f.getState().files.filenameSearch,t=!e.docsLoading&&e.allDocs.length===0,r=e.docsError!==null||t,o=e.docsError!==null?"文档列表加载失败":t?"暂无已索引文档":"按文件名搜索…";return{disabled:r,placeholder:o}}get _isFilenameSearchActive(){return f.getState().files.filenameSearch.isActive}render(){return c`
      ${this._isMobile?this._renderMobile():this._renderDesktop()}
      ${this._renderDialogs()}
      <drop-zone .targetDir=${this._state.currentDir} @drop-files=${this._onDropFiles}></drop-zone>
      ${this._toast?c`<div class="toast" @click=${()=>this._toast=null}>${this._toast}</div>`:""}
    `}_renderDesktop(){const{disabled:e,placeholder:t}=this._searchBoxState;return c`
      <div
        class="desktop-layout"
        style="--tree-pane-width: ${this._treePaneWidth}px; --preview-pane-width: ${this._previewPaneWidth}px"
      >
        <aside class="tree-pane">
          <file-search-box
            .value=${f.getState().files.filenameSearch.query}
            ?disabled=${e}
            .placeholder=${t}
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
        ${this._isFilenameSearchActive?c`<file-search-results
              @activated=${this._onFilenameResultActivated}
              @clear=${this._onFilenameClear}
            ></file-search-results>`:c`<file-list
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
    `}_renderMobile(){const e=this._state.mobilePane,t=this._searchBoxState;return c`
      <div class="mobile-layout">
        ${e==="tree"?c`
              <file-search-box
                .value=${f.getState().files.filenameSearch.query}
                ?disabled=${t.disabled}
                .placeholder=${t.placeholder}
                @search=${this._onFilenameSearch}
                @clear=${this._onFilenameClear}
              ></file-search-box>
              ${this._isFilenameSearchActive?c`<file-search-results
                    @activated=${this._onFilenameResultActivated}
                    @clear=${this._onFilenameClear}
                  ></file-search-results>`:c`<file-tree
                    @select-dir=${async r=>{m.selectDir(r.detail.path),await this._ensureLoaded(r.detail.path),m.expandDir(r.detail.path),m.setMobilePane("list")}}
                  ></file-tree>`}
            `:""}
        ${e==="list"?c`<file-list
              .activePath=${this._previewPath}
              ?mobile=${!0}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
              @back=${()=>this._goBack()}
            ></file-list>`:""}
        ${e==="detail"?c`<div class="mobile-preview">${this._renderPreviewPane({mobile:!0})}</div>`:""}
      </div>
    `}_renderDialogs(){if(this._dialog==="mkdir")return c`<dialog open>
        <mkdir-dialog
          @submit=${this._onMkdirSubmit}
          @cancel=${this._cancelDialog}
        ></mkdir-dialog>
      </dialog>`;if(this._dialog==="rename"){const t=(this._state.selectedPaths[0]||"").split("/").pop()||"";return c`<dialog open>
        <rename-dialog
          .currentName=${t}
          @submit=${this._onRenameSubmit}
          @cancel=${this._cancelDialog}
        ></rename-dialog>
      </dialog>`}return this._dialog==="move"?c`<dialog open>
        <move-dialog
          @submit=${this._onMoveSubmit}
          @cancel=${this._cancelDialog}
        ></move-dialog>
      </dialog>`:this._dialog==="delete"?c`<dialog open>
        <delete-dialog
          @submit=${this._onDeleteSubmit}
          @cancel=${this._cancelDialog}
        ></delete-dialog>
      </dialog>`:c``}};y.TREE_PANE_WIDTH_KEY="cortex.files.treePaneWidth";y.TREE_PANE_WIDTH_DEFAULT=240;y.TREE_PANE_WIDTH_MIN=180;y.TREE_PANE_WIDTH_MAX=720;y.PREVIEW_PANE_WIDTH_KEY="cortex.files.previewPaneWidth";y.PREVIEW_PANE_WIDTH_DEFAULT=320;y.PREVIEW_PANE_WIDTH_MIN=240;y.PREVIEW_PANE_WIDTH_MAX=1600;y.MIDDLE_PANE_MIN=300;y.SPLITTERS_TOTAL=8;y.styles=_`
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
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 360px;
      max-width: 90vw;
    }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0;
        width: calc(100vw - 16px);
        max-width: calc(100vw - 16px);
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
  `;ee([v()],y.prototype,"_dialog",2);ee([v()],y.prototype,"_toast",2);ee([v()],y.prototype,"_previewPath",2);ee([v()],y.prototype,"_previewContent",2);ee([v()],y.prototype,"_previewLanguage",2);ee([v()],y.prototype,"_previewWritable",2);ee([v()],y.prototype,"_previewPages",2);ee([v()],y.prototype,"_previewError",2);ee([v()],y.prototype,"_previewDirty",2);ee([v()],y.prototype,"_treePaneWidth",2);ee([v()],y.prototype,"_previewPaneWidth",2);y=ee([E("files-view")],y);var dc=Object.defineProperty,uc=Object.getOwnPropertyDescriptor,Ot=(e,t,r,o)=>{for(var s=o>1?void 0:o?uc(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&dc(t,r,s),s};let Le=class extends k{constructor(){super(...arguments),this.activeView="search",this._menuOpen=!1,this._showSaveAndRevert=!1,this._refreshing=!1,this._onWatchReindexed=e=>{var s,i;const t=e.detail,r=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack"),o=t==null?void 0:t.doc_count;(i=r==null?void 0:r.pushToast)==null||i.call(r,o!=null?`索引已更新：${o} 文档`:"索引已更新","success",3e3)},this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_onAvatarClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onRefreshClick(){this._refreshing||(this._refreshing=!0,window.setTimeout(()=>{window.location.reload()},400))}_onScopeSelect(e){this._menuOpen=!1,this.dispatchEvent(new CustomEvent("navigate",{detail:{view:"settings",scope:e},bubbles:!0,composed:!0}))}_onSaveClick(){window.dispatchEvent(new CustomEvent("cortex:save-settings"))}_onRevertClick(){this._menuOpen=!1,window.dispatchEvent(new CustomEvent("cortex:revert-settings"))}_onReindexClick(){f.getState().reindex.dialog==="closed"&&(this._menuOpen=!1,m.openReindexConfirm())}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick),window.addEventListener("cortex:watch-reindexed",this._onWatchReindexed),this._syncFromStore(),this._unsubStore=f.subscribe(()=>this._syncFromStore())}disconnectedCallback(){var e;document.removeEventListener("click",this._onDocClick),window.removeEventListener("cortex:watch-reindexed",this._onWatchReindexed),(e=this._unsubStore)==null||e.call(this),super.disconnectedCallback()}_syncFromStore(){const e=f.getState();this._showSaveAndRevert=e.view==="settings"&&e.settings.dirty,this.requestUpdate()}_renderWatchBadge(e){const t=e==null?void 0:e.last_doc_count,r=t!=null?` ${t}`:"";if(!e||!e.running)return c`<span class="watch-badge">📁${r} ○监控关</span>`;if(e.reindexing)return c`<span class="watch-badge busy">📁${r} ⟳更新中…</span>`;if(e.changed_count>0)return c`<span class="watch-badge warn">📁${r} ·待更新 ${e.changed_count}</span>`;const o=e.last_success===!1;return c`<span class="watch-badge ${o?"warn":"dot"}">📁${r} ●监控</span>`}render(){return c`
      <div class="brand">
        <span class="logo">🧠</span>
        <span>Doclens</span>
      </div>
      <div class="right-cluster">
        ${this._renderWatchBadge(f.getState().watcher)}
        ${this._showSaveAndRevert?c`
          <button class="save-btn" type="button" @click=${this._onSaveClick}>💾 保存</button>
        `:w}
        <button
          class="refresh-btn ${this._refreshing?"spinning":""}"
          type="button"
          aria-label="刷新"
          title="刷新"
          ?disabled=${this._refreshing}
          @click=${this._onRefreshClick}
        >
          <span class="icon" aria-hidden="true">↻</span>
        </button>
        <button class="avatar-btn" @click=${this._onAvatarClick}>
          <span class="avatar">L</span>
          <span class="name">Liang</span>
          <span class="chev">▾</span>
        </button>
        <div class="user-menu ${this._menuOpen?"open":""}">
          <div class="menu-header">
            <div style="font-size: var(--cortex-fs-sm); font-weight: 500;">Liang</div>
            <div class="email">liang@example.com</div>
          </div>
          <button class="menu-item" type="button" @click=${()=>this._onScopeSelect("global")}>
            <span class="icon">🌍</span>
            <span class="text">
              <span class="label">全局配置</span>
              <span class="desc">所有项目共用</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${this._onReindexClick}>
            <span class="icon">🔄</span>
            <span class="text">
              <span class="label">强制重建索引</span>
              <span class="desc">全量重扫工作目录</span>
            </span>
          </button>
          ${this._showSaveAndRevert?c`
            <button class="menu-item" type="button" @click=${this._onRevertClick}>
              <span class="icon">↩</span>
              <span class="text">
                <span class="label">放弃修改</span>
                <span class="desc">恢复到 .env 当前值</span>
              </span>
            </button>
          `:w}
        </div>
      </div>
      <toast-stack></toast-stack>
    `}};Le.styles=_`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 var(--cortex-space-6);
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
      background: var(--cortex-primary-gradient);
      border-radius: var(--cortex-radius-md);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
      box-shadow: var(--cortex-primary-glow);
    }
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
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      white-space: nowrap;
    }
    .watch-badge.dot { color: var(--cortex-success); }
    .watch-badge.busy { color: var(--cortex-primary); }
    .watch-badge.warn { color: var(--cortex-warning); }
    /* 移动端刷新按钮：圆形描边按钮，点击派发 cortex:refresh 事件，
       各 view 可监听并自行决定如何刷新（默认不做事，硬刷新由调用方决定）。
       桌面端默认隐藏，移动端（≤1023px）显示。 */
    .refresh-btn {
      display: none;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--cortex-border);
      border-radius: 50%;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
      /* 同 focus-header 返回按钮：disable iOS Safari 双击缩放检测 */
      touch-action: manipulation;
    }
    .refresh-btn:hover {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
    }
    .refresh-btn:active { transform: scale(0.94); }
    .refresh-btn .icon {
      font-size: 16px;
      line-height: 1;
      font-weight: 600;
      display: inline-block;
      transition: transform 0.4s ease;
    }
    .refresh-btn.spinning .icon {
      animation: cortex-refresh-spin 0.6s linear;
    }
    @keyframes cortex-refresh-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .refresh-btn.spinning .icon { animation: none; }
    }
    @media (max-width: 1023px) {
      .refresh-btn { display: inline-flex; }
    }
    .avatar-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 4px 8px 4px 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 999px;
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
      background: var(--cortex-primary-gradient);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--cortex-fs-sm);
    }
    .name { font-size: var(--cortex-fs-sm); }
    .chev { color: var(--cortex-text-muted); font-size: 12px; }

    .user-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .user-menu.open { display: block; }
    .save-btn {
      padding: 6px 14px;
      background: var(--cortex-primary);
      color: #fff;
      border: 1px solid var(--cortex-primary);
      border-radius: var(--cortex-radius-md);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      cursor: pointer;
      min-height: var(--cortex-touch-target, 44px);
    }
    .save-btn:hover { background: var(--cortex-primary-hover); border-color: var(--cortex-primary-hover); }
    .menu-header {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      margin-bottom: var(--cortex-space-2);
    }
    .menu-header .email {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
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
    .menu-item .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      display: block;
      margin-top: 2px;
    }
  `;Ot([d()],Le.prototype,"activeView",2);Ot([v()],Le.prototype,"_menuOpen",2);Ot([v()],Le.prototype,"_showSaveAndRevert",2);Ot([v()],Le.prototype,"_refreshing",2);Le=Ot([E("app-bar")],Le);var hc=Object.getOwnPropertyDescriptor,pc=(e,t,r,o)=>{for(var s=o>1?void 0:o?hc(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=a(s)||s);return s};let Nr=class extends k{constructor(){super(...arguments),this._abort=null}connectedCallback(){super.connectedCallback(),this._unsub=f.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e,t;(e=this._abort)==null||e.abort(),(t=this._unsub)==null||t.call(this),super.disconnectedCallback()}_pushToast(e,t="info",r=2500){var s;const o=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");o==null||o.pushToast(e,t,r)}_confirm(){m.startReindex(),this._runReindex()}_close(){var e;(e=this._abort)==null||e.abort(),m.closeReindex()}async _runReindex(){var e;this._abort=new AbortController;try{for await(const t of Ho("/api/reindex",{},this._abort.signal)){if(this._abort.signal.aborted)break;if(t.event==="progress"){const r=JSON.parse(t.data);m.setReindexProgress({current_file:r.current_file,indexed_count:r.indexed_count})}else if(t.event==="done"){const r=JSON.parse(t.data);r.success?(m.finishReindex({success:r.success,doc_count:r.doc_count,failed_count:r.failed_count}),this._pushToast(`索引重建完成：${r.doc_count} 文档`,"success",3e3)):m.failReindex(r.failed_count>0?`重建失败：${r.failed_count} 个文件失败`:"重建失败");break}else if(t.event==="error"){const r=JSON.parse(t.data);m.failReindex(r.detail||"重建失败");break}}}catch(t){(e=this._abort)!=null&&e.signal.aborted||m.failReindex(t.message||"重建失败")}}_renderBody(e){if(e.dialog==="confirm")return c`
        <h3>🔄 强制重建索引</h3>
        <div class="body">⚠️ 将清空当前索引并全量重扫工作目录，期间（数十秒）搜索结果可能不完整。是否继续？</div>
        <div class="actions">
          <button @click=${()=>m.closeReindex()}>取消</button>
          <button class="warn" @click=${this._confirm}>确认重建</button>
        </div>
      `;if(e.dialog==="running")return c`
        <h3>⟳ 正在重建索引…</h3>
        <div class="body">已索引 <strong>${e.indexed_count}</strong> 个文件</div>
        ${e.current_file?c`<div class="progress">当前：${e.current_file}</div>`:""}
        <div class="actions">
          <button @click=${this._close}>关闭（后台继续）</button>
        </div>
      `;if(e.dialog==="done"){const t=e.result;return c`
        <h3>✅ 重建完成</h3>
        <div class="body">
          共索引 <strong>${(t==null?void 0:t.doc_count)??0}</strong> 个文档
          ${t&&t.failed_count>0?c`<br />· ${t.failed_count} 个文件失败`:""}
        </div>
        <div class="actions">
          <button class="primary" @click=${this._close}>关闭</button>
        </div>
      `}return c`
      <h3>⚠️ 重建失败</h3>
      <div class="body">${e.error||"未知错误"}</div>
      <div class="actions">
        <button class="primary" @click=${this._close}>关闭</button>
      </div>
    `}render(){const e=f.getState().reindex;return e.dialog==="closed"?c`<toast-stack></toast-stack>`:c`
      <dialog open>${this._renderBody(e)}</dialog>
      <toast-stack></toast-stack>
    `}};Nr.styles=_`
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
      border-radius: var(--cortex-radius-sm); font-size: var(--cortex-fs-base);
    }
    button.primary { background: var(--cortex-primary-gradient); color: #fff; border: none; border-radius: var(--cortex-radius-lg); box-shadow: var(--cortex-primary-glow); }
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
  `;Nr=pc([E("reindex-dialog")],Nr);async function fc(){const e=await fetch("/api/watch/status",{method:"GET"}),t=await e.json().catch(()=>null);if(!e.ok)throw new Error(`watch/status HTTP ${e.status}`);return t}const bc=5e3;let vt=null,Ht;async function eo(){try{const t=(await fc()).watcher,r=(t==null?void 0:t.last_reindex_at)??null;Ht!==void 0&&r!==null&&r!==Ht&&window.dispatchEvent(new CustomEvent("cortex:watch-reindexed",{detail:{doc_count:(t==null?void 0:t.last_doc_count)??null}})),Ht=r,m.setWatcherStatus(t)}catch{}}function vc(){vt===null&&(Ht=void 0,eo(),vt=window.setInterval(()=>{eo()},bc))}function mc(){vt!==null&&(window.clearInterval(vt),vt=null)}var gc=Object.getOwnPropertyDescriptor,xc=(e,t,r,o)=>{for(var s=o>1?void 0:o?gc(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=a(s)||s);return s};let Wr=class extends k{connectedCallback(){super.connectedCallback(),Is.init(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),vc()}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),mc(),super.disconnectedCallback()}_navigate(e){Is.navigate(e.detail.view),e.detail.view==="settings"&&e.detail.scope&&m.setSettingsScope(e.detail.scope)}_renderView(){const e=f.getState().view;return e==="chat"?c`<chat-view></chat-view>`:e==="settings"?c`<settings-view></settings-view>`:e==="files"?c`<files-view></files-view>`:c`<search-view></search-view>`}render(){const e=f.getState().view;return c`
      <app-bar
        .activeView=${e}
        @navigate=${this._navigate}
      ></app-bar>
      <div class="app-body">
        <activity-bar .active=${e} @navigate=${this._navigate}></activity-bar>
        <div class="main">
          ${this._renderView()}
        </div>
        <tab-bar .active=${e} @navigate=${this._navigate}></tab-bar>
      </div>
      <reindex-dialog></reindex-dialog>
    `}};Wr.styles=_`
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
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;Wr=xc([E("cortex-app")],Wr);
