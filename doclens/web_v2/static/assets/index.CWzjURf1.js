var Mi=Object.defineProperty;var Fi=(e,t,r)=>t in e?Mi(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var z=(e,t,r)=>Fi(e,typeof t!="symbol"?t+"":t,r);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function r(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(s){if(s.ep)return;s.ep=!0;const o=r(s);fetch(s.href,o)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Rt=globalThis,Ir=Rt.ShadowRoot&&(Rt.ShadyCSS===void 0||Rt.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Rr=Symbol(),os=new WeakMap;let Xs=class{constructor(t,r,i){if(this._$cssResult$=!0,i!==Rr)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=r}get styleSheet(){let t=this.o;const r=this.t;if(Ir&&t===void 0){const i=r!==void 0&&r.length===1;i&&(t=os.get(r)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&os.set(r,t))}return t}toString(){return this.cssText}};const Ni=e=>new Xs(typeof e=="string"?e:e+"",void 0,Rr),_=(e,...t)=>{const r=e.length===1?e[0]:t.reduce((i,s,o)=>i+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[o+1],e[0]);return new Xs(r,e,Rr)},Wi=(e,t)=>{if(Ir)e.adoptedStyleSheets=t.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of t){const i=document.createElement("style"),s=Rt.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=r.cssText,e.appendChild(i)}},as=Ir?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let r="";for(const i of t.cssRules)r+=i.cssText;return Ni(r)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Hi,defineProperty:Bi,getOwnPropertyDescriptor:Ui,getOwnPropertyNames:ji,getOwnPropertySymbols:qi,getPrototypeOf:Vi}=Object,be=globalThis,ns=be.trustedTypes,Xi=ns?ns.emptyScript:"",hr=be.reactiveElementPolyfillSupport,ut=(e,t)=>e,Ue={toAttribute(e,t){switch(t){case Boolean:e=e?Xi:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=e!==null;break;case Number:r=e===null?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch{r=null}}return r}},Lr=(e,t)=>!Hi(e,t),ls={attribute:!0,type:String,converter:Ue,reflect:!1,useDefault:!1,hasChanged:Lr};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),be.litPropertyMetadata??(be.litPropertyMetadata=new WeakMap);let We=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,r=ls){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(t,r),!r.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,r);s!==void 0&&Bi(this.prototype,t,s)}}static getPropertyDescriptor(t,r,i){const{get:s,set:o}=Ui(this.prototype,t)??{get(){return this[r]},set(a){this[r]=a}};return{get:s,set(a){const l=s==null?void 0:s.call(this);o==null||o.call(this,a),this.requestUpdate(t,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??ls}static _$Ei(){if(this.hasOwnProperty(ut("elementProperties")))return;const t=Vi(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(ut("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ut("properties"))){const r=this.properties,i=[...ji(r),...qi(r)];for(const s of i)this.createProperty(s,r[s])}const t=this[Symbol.metadata];if(t!==null){const r=litPropertyMetadata.get(t);if(r!==void 0)for(const[i,s]of r)this.elementProperties.set(i,s)}this._$Eh=new Map;for(const[r,i]of this.elementProperties){const s=this._$Eu(r,i);s!==void 0&&this._$Eh.set(s,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const r=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const s of i)r.unshift(as(s))}else t!==void 0&&r.push(as(t));return r}static _$Eu(t,r){const i=r.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(r=>r(this))}addController(t){var r;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((r=t.hostConnected)==null||r.call(t))}removeController(t){var r;(r=this._$EO)==null||r.delete(t)}_$E_(){const t=new Map,r=this.constructor.elementProperties;for(const i of r.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Wi(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(r=>{var i;return(i=r.hostConnected)==null?void 0:i.call(r)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(r=>{var i;return(i=r.hostDisconnected)==null?void 0:i.call(r)})}attributeChangedCallback(t,r,i){this._$AK(t,i)}_$ET(t,r){var o;const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(s!==void 0&&i.reflect===!0){const a=(((o=i.converter)==null?void 0:o.toAttribute)!==void 0?i.converter:Ue).toAttribute(r,i.type);this._$Em=t,a==null?this.removeAttribute(s):this.setAttribute(s,a),this._$Em=null}}_$AK(t,r){var o,a;const i=this.constructor,s=i._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const l=i.getPropertyOptions(s),n=typeof l.converter=="function"?{fromAttribute:l.converter}:((o=l.converter)==null?void 0:o.fromAttribute)!==void 0?l.converter:Ue;this._$Em=s;const u=n.fromAttribute(r,l.type);this[s]=u??((a=this._$Ej)==null?void 0:a.get(s))??u,this._$Em=null}}requestUpdate(t,r,i,s=!1,o){var a;if(t!==void 0){const l=this.constructor;if(s===!1&&(o=this[t]),i??(i=l.getPropertyOptions(t)),!((i.hasChanged??Lr)(o,r)||i.useDefault&&i.reflect&&o===((a=this._$Ej)==null?void 0:a.get(t))&&!this.hasAttribute(l._$Eu(t,i))))return;this.C(t,r,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,r,{useDefault:i,reflect:s,wrapped:o},a){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,a??r??this[t]),o!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(r=void 0),this._$AL.set(t,r)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[o,a]of this._$Ep)this[o]=a;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[o,a]of s){const{wrapped:l}=a,n=this[o];l!==!0||this._$AL.has(o)||n===void 0||this.C(o,void 0,a,n)}}let t=!1;const r=this._$AL;try{t=this.shouldUpdate(r),t?(this.willUpdate(r),(i=this._$EO)==null||i.forEach(s=>{var o;return(o=s.hostUpdate)==null?void 0:o.call(s)}),this.update(r)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(r)}willUpdate(t){}_$AE(t){var r;(r=this._$EO)==null||r.forEach(i=>{var s;return(s=i.hostUpdated)==null?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(t){}firstUpdated(t){}};We.elementStyles=[],We.shadowRootOptions={mode:"open"},We[ut("elementProperties")]=new Map,We[ut("finalized")]=new Map,hr==null||hr({ReactiveElement:We}),(be.reactiveElementVersions??(be.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const pt=globalThis,cs=e=>e,Ft=pt.trustedTypes,ds=Ft?Ft.createPolicy("lit-html",{createHTML:e=>e}):void 0,Ks="$lit$",fe=`lit$${Math.random().toFixed(9).slice(2)}$`,Ys="?"+fe,Ki=`<${Ys}>`,Ae=document,ft=()=>Ae.createComment(""),bt=e=>e===null||typeof e!="object"&&typeof e!="function",Mr=Array.isArray,Yi=e=>Mr(e)||typeof(e==null?void 0:e[Symbol.iterator])=="function",ur=`[ 	
\f\r]`,rt=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,hs=/-->/g,us=/>/g,_e=RegExp(`>|${ur}(?:([^\\s"'>=/]+)(${ur}*=${ur}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ps=/'/g,fs=/"/g,Gs=/^(?:script|style|textarea|title)$/i,Gi=e=>(t,...r)=>({_$litType$:e,strings:t,values:r}),c=Gi(1),se=Symbol.for("lit-noChange"),w=Symbol.for("lit-nothing"),bs=new WeakMap,Ce=Ae.createTreeWalker(Ae,129);function Zs(e,t){if(!Mr(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return ds!==void 0?ds.createHTML(t):t}const Zi=(e,t)=>{const r=e.length-1,i=[];let s,o=t===2?"<svg>":t===3?"<math>":"",a=rt;for(let l=0;l<r;l++){const n=e[l];let u,h,b=-1,x=0;for(;x<n.length&&(a.lastIndex=x,h=a.exec(n),h!==null);)x=a.lastIndex,a===rt?h[1]==="!--"?a=hs:h[1]!==void 0?a=us:h[2]!==void 0?(Gs.test(h[2])&&(s=RegExp("</"+h[2],"g")),a=_e):h[3]!==void 0&&(a=_e):a===_e?h[0]===">"?(a=s??rt,b=-1):h[1]===void 0?b=-2:(b=a.lastIndex-h[2].length,u=h[1],a=h[3]===void 0?_e:h[3]==='"'?fs:ps):a===fs||a===ps?a=_e:a===hs||a===us?a=rt:(a=_e,s=void 0);const S=a===_e&&e[l+1].startsWith("/>")?" ":"";o+=a===rt?n+Ki:b>=0?(i.push(u),n.slice(0,b)+Ks+n.slice(b)+fe+S):n+fe+(b===-2?l:S)}return[Zs(e,o+(e[r]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]};class mt{constructor({strings:t,_$litType$:r},i){let s;this.parts=[];let o=0,a=0;const l=t.length-1,n=this.parts,[u,h]=Zi(t,r);if(this.el=mt.createElement(u,i),Ce.currentNode=this.el.content,r===2||r===3){const b=this.el.content.firstChild;b.replaceWith(...b.childNodes)}for(;(s=Ce.nextNode())!==null&&n.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(const b of s.getAttributeNames())if(b.endsWith(Ks)){const x=h[a++],S=s.getAttribute(b).split(fe),v=/([.?@])?(.*)/.exec(x);n.push({type:1,index:o,name:v[2],strings:S,ctor:v[1]==="."?Ji:v[1]==="?"?eo:v[1]==="@"?to:Jt}),s.removeAttribute(b)}else b.startsWith(fe)&&(n.push({type:6,index:o}),s.removeAttribute(b));if(Gs.test(s.tagName)){const b=s.textContent.split(fe),x=b.length-1;if(x>0){s.textContent=Ft?Ft.emptyScript:"";for(let S=0;S<x;S++)s.append(b[S],ft()),Ce.nextNode(),n.push({type:2,index:++o});s.append(b[x],ft())}}}else if(s.nodeType===8)if(s.data===Ys)n.push({type:2,index:o});else{let b=-1;for(;(b=s.data.indexOf(fe,b+1))!==-1;)n.push({type:7,index:o}),b+=fe.length-1}o++}}static createElement(t,r){const i=Ae.createElement("template");return i.innerHTML=t,i}}function je(e,t,r=e,i){var a,l;if(t===se)return t;let s=i!==void 0?(a=r._$Co)==null?void 0:a[i]:r._$Cl;const o=bt(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==o&&((l=s==null?void 0:s._$AO)==null||l.call(s,!1),o===void 0?s=void 0:(s=new o(e),s._$AT(e,r,i)),i!==void 0?(r._$Co??(r._$Co=[]))[i]=s:r._$Cl=s),s!==void 0&&(t=je(e,s._$AS(e,t.values),s,i)),t}class Qi{constructor(t,r){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:r},parts:i}=this._$AD,s=((t==null?void 0:t.creationScope)??Ae).importNode(r,!0);Ce.currentNode=s;let o=Ce.nextNode(),a=0,l=0,n=i[0];for(;n!==void 0;){if(a===n.index){let u;n.type===2?u=new kt(o,o.nextSibling,this,t):n.type===1?u=new n.ctor(o,n.name,n.strings,this,t):n.type===6&&(u=new ro(o,this,t)),this._$AV.push(u),n=i[++l]}a!==(n==null?void 0:n.index)&&(o=Ce.nextNode(),a++)}return Ce.currentNode=Ae,s}p(t){let r=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,r),r+=i.strings.length-2):i._$AI(t[r])),r++}}class kt{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,r,i,s){this.type=2,this._$AH=w,this._$AN=void 0,this._$AA=t,this._$AB=r,this._$AM=i,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=r.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,r=this){t=je(this,t,r),bt(t)?t===w||t==null||t===""?(this._$AH!==w&&this._$AR(),this._$AH=w):t!==this._$AH&&t!==se&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Yi(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==w&&bt(this._$AH)?this._$AA.nextSibling.data=t:this.T(Ae.createTextNode(t)),this._$AH=t}$(t){var o;const{values:r,_$litType$:i}=t,s=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=mt.createElement(Zs(i.h,i.h[0]),this.options)),i);if(((o=this._$AH)==null?void 0:o._$AD)===s)this._$AH.p(r);else{const a=new Qi(s,this),l=a.u(this.options);a.p(r),this.T(l),this._$AH=a}}_$AC(t){let r=bs.get(t.strings);return r===void 0&&bs.set(t.strings,r=new mt(t)),r}k(t){Mr(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let i,s=0;for(const o of t)s===r.length?r.push(i=new kt(this.O(ft()),this.O(ft()),this,this.options)):i=r[s],i._$AI(o),s++;s<r.length&&(this._$AR(i&&i._$AB.nextSibling,s),r.length=s)}_$AR(t=this._$AA.nextSibling,r){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,r);t!==this._$AB;){const s=cs(t).nextSibling;cs(t).remove(),t=s}}setConnected(t){var r;this._$AM===void 0&&(this._$Cv=t,(r=this._$AP)==null||r.call(this,t))}}let Jt=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,r,i,s,o){this.type=1,this._$AH=w,this._$AN=void 0,this.element=t,this.name=r,this._$AM=s,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=w}_$AI(t,r=this,i,s){const o=this.strings;let a=!1;if(o===void 0)t=je(this,t,r,0),a=!bt(t)||t!==this._$AH&&t!==se,a&&(this._$AH=t);else{const l=t;let n,u;for(t=o[0],n=0;n<o.length-1;n++)u=je(this,l[i+n],r,n),u===se&&(u=this._$AH[n]),a||(a=!bt(u)||u!==this._$AH[n]),u===w?t=w:t!==w&&(t+=(u??"")+o[n+1]),this._$AH[n]=u}a&&!s&&this.j(t)}j(t){t===w?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},Ji=class extends Jt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===w?void 0:t}},eo=class extends Jt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==w)}},to=class extends Jt{constructor(t,r,i,s,o){super(t,r,i,s,o),this.type=5}_$AI(t,r=this){if((t=je(this,t,r,0)??w)===se)return;const i=this._$AH,s=t===w&&i!==w||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==w&&(i===w||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,t):this._$AH.handleEvent(t)}},ro=class{constructor(t,r,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=r,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){je(this,t)}};const pr=pt.litHtmlPolyfillSupport;pr==null||pr(mt,kt),(pt.litHtmlVersions??(pt.litHtmlVersions=[])).push("3.3.3");const so=(e,t,r)=>{const i=(r==null?void 0:r.renderBefore)??t;let s=i._$litPart$;if(s===void 0){const o=(r==null?void 0:r.renderBefore)??null;i._$litPart$=s=new kt(t.insertBefore(ft(),o),o,void 0,r??{})}return s._$AI(e),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pe=globalThis;let $=class extends We{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const t=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=t.firstChild),t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=so(r,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return se}};var Vs;$._$litElement$=!0,$.finalized=!0,(Vs=Pe.litElementHydrateSupport)==null||Vs.call(Pe,{LitElement:$});const fr=Pe.litElementPolyfillSupport;fr==null||fr({LitElement:$});(Pe.litElementVersions??(Pe.litElementVersions=[])).push("4.2.2");var io=_`
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
`;const wr=new Set,He=new Map;let ke,Fr="ltr",Nr="en";const Qs=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Qs){const e=new MutationObserver(ei);Fr=document.documentElement.dir||"ltr",Nr=document.documentElement.lang||navigator.language,e.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Js(...e){e.map(t=>{const r=t.$code.toLowerCase();He.has(r)?He.set(r,Object.assign(Object.assign({},He.get(r)),t)):He.set(r,t),ke||(ke=t)}),ei()}function ei(){Qs&&(Fr=document.documentElement.dir||"ltr",Nr=document.documentElement.lang||navigator.language),[...wr.keys()].map(e=>{typeof e.requestUpdate=="function"&&e.requestUpdate()})}let oo=class{constructor(t){this.host=t,this.host.addController(this)}hostConnected(){wr.add(this.host)}hostDisconnected(){wr.delete(this.host)}dir(){return`${this.host.dir||Fr}`.toLowerCase()}lang(){return`${this.host.lang||Nr}`.toLowerCase()}getTranslationData(t){var r,i;let s;try{s=new Intl.Locale(t.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const o=s.language.toLowerCase(),a=(i=(r=s.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&i!==void 0?i:"",l=He.get(`${o}-${a}`),n=He.get(o);return{locale:s,language:o,region:a,primary:l,secondary:n}}exists(t,r){var i;const{primary:s,secondary:o}=this.getTranslationData((i=r.lang)!==null&&i!==void 0?i:this.lang());return r=Object.assign({includeFallback:!1},r),!!(s&&s[t]||o&&o[t]||r.includeFallback&&ke&&ke[t])}term(t,...r){const{primary:i,secondary:s}=this.getTranslationData(this.lang());let o;if(i&&i[t])o=i[t];else if(s&&s[t])o=s[t];else if(ke&&ke[t])o=ke[t];else return console.error(`No translation found for: ${String(t)}`),String(t);return typeof o=="function"?o(...r):o}date(t,r){return t=new Date(t),new Intl.DateTimeFormat(this.lang(),r).format(t)}number(t,r){return t=Number(t),isNaN(t)?"":new Intl.NumberFormat(this.lang(),r).format(t)}relativeTime(t,r,i){return new Intl.RelativeTimeFormat(this.lang(),i).format(t,r)}};var ti={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(e,t)=>`Go to slide ${e} of ${t}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:e=>e===0?"No options selected":e===1?"1 option selected":`${e} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:e=>`Slide ${e}`,toggleColorFormat:"Toggle color format"};Js(ti);var ao=ti,Re=class extends oo{};Js(ao);var ie=_`
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
`,ri=Object.defineProperty,no=Object.defineProperties,lo=Object.getOwnPropertyDescriptor,co=Object.getOwnPropertyDescriptors,ms=Object.getOwnPropertySymbols,ho=Object.prototype.hasOwnProperty,uo=Object.prototype.propertyIsEnumerable,br=(e,t)=>(t=Symbol[e])?t:Symbol.for("Symbol."+e),Wr=e=>{throw TypeError(e)},vs=(e,t,r)=>t in e?ri(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,Le=(e,t)=>{for(var r in t||(t={}))ho.call(t,r)&&vs(e,r,t[r]);if(ms)for(var r of ms(t))uo.call(t,r)&&vs(e,r,t[r]);return e},Hr=(e,t)=>no(e,co(t)),p=(e,t,r,i)=>{for(var s=i>1?void 0:i?lo(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&ri(t,r,s),s},si=(e,t,r)=>t.has(e)||Wr("Cannot "+r),po=(e,t,r)=>(si(e,t,"read from private field"),t.get(e)),fo=(e,t,r)=>t.has(e)?Wr("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),bo=(e,t,r,i)=>(si(e,t,"write to private field"),t.set(e,r),r),mo=function(e,t){this[0]=e,this[1]=t},vo=e=>{var t=e[br("asyncIterator")],r=!1,i,s={};return t==null?(t=e[br("iterator")](),i=o=>s[o]=a=>t[o](a)):(t=t.call(e),i=o=>s[o]=a=>{if(r){if(r=!1,o==="throw")throw a;return a}return r=!0,{done:!1,value:new mo(new Promise(l=>{var n=t[o](a);n instanceof Object||Wr("Object expected"),l(n)}),1)}}),s[br("iterator")]=()=>s,i("next"),"throw"in t?i("throw"):s.throw=o=>{throw o},"return"in t&&i("return"),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const A=e=>(t,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const go={attribute:!0,type:String,converter:Ue,reflect:!1,hasChanged:Lr},xo=(e=go,t,r)=>{const{kind:i,metadata:s}=r;let o=globalThis.litPropertyMetadata.get(s);if(o===void 0&&globalThis.litPropertyMetadata.set(s,o=new Map),i==="setter"&&((e=Object.create(e)).wrapped=!0),o.set(r.name,e),i==="accessor"){const{name:a}=r;return{set(l){const n=t.get.call(this);t.set.call(this,l),this.requestUpdate(a,n,e,!0,l)},init(l){return l!==void 0&&this.C(a,void 0,e,l),l}}}if(i==="setter"){const{name:a}=r;return function(l){const n=this[a];t.call(this,l),this.requestUpdate(a,n,e,!0,l)}}throw Error("Unsupported decorator location: "+i)};function d(e){return(t,r)=>typeof r=="object"?xo(e,t,r):((i,s,o)=>{const a=s.hasOwnProperty(o);return s.constructor.createProperty(o,i),a?Object.getOwnPropertyDescriptor(s,o):void 0})(e,t,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function m(e){return d({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function _o(e){return(t,r)=>{const i=typeof t=="function"?t:t[r];Object.assign(i,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const yo=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function j(e,t){return(r,i,s)=>{const o=a=>{var l;return((l=a.renderRoot)==null?void 0:l.querySelector(e))??null};return yo(r,i,{get(){return o(this)}})}}var Lt,W=class extends ${constructor(){super(),fo(this,Lt,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([e,t])=>{this.constructor.define(e,t)})}emit(e,t){const r=new CustomEvent(e,Le({bubbles:!0,cancelable:!1,composed:!0,detail:{}},t));return this.dispatchEvent(r),r}static define(e,t=this,r={}){const i=customElements.get(e);if(!i){try{customElements.define(e,t,r)}catch{customElements.define(e,class extends t{},r)}return}let s=" (unknown version)",o=s;"version"in t&&t.version&&(s=" v"+t.version),"version"in i&&i.version&&(o=" v"+i.version),!(s&&o&&s===o)&&console.warn(`Attempted to register <${e}>${s}, but <${e}>${o} has already been registered.`)}attributeChangedCallback(e,t,r){po(this,Lt)||(this.constructor.elementProperties.forEach((i,s)=>{i.reflect&&this[s]!=null&&this.initialReflectedProperties.set(s,this[s])}),bo(this,Lt,!0)),super.attributeChangedCallback(e,t,r)}willUpdate(e){super.willUpdate(e),this.initialReflectedProperties.forEach((t,r)=>{e.has(r)&&this[r]==null&&(this[r]=t)})}};Lt=new WeakMap;W.version="2.20.1";W.dependencies={};p([d()],W.prototype,"dir",2);p([d()],W.prototype,"lang",2);var ii=class extends W{constructor(){super(...arguments),this.localize=new Re(this)}render(){return c`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};ii.styles=[ie,io];var st=new WeakMap,it=new WeakMap,ot=new WeakMap,mr=new WeakSet,Dt=new WeakMap,oi=class{constructor(e,t){this.handleFormData=r=>{const i=this.options.disabled(this.host),s=this.options.name(this.host),o=this.options.value(this.host),a=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!i&&!a&&typeof s=="string"&&s.length>0&&typeof o<"u"&&(Array.isArray(o)?o.forEach(l=>{r.formData.append(s,l.toString())}):r.formData.append(s,o.toString()))},this.handleFormSubmit=r=>{var i;const s=this.options.disabled(this.host),o=this.options.reportValidity;this.form&&!this.form.noValidate&&((i=st.get(this.form))==null||i.forEach(a=>{this.setUserInteracted(a,!0)})),this.form&&!this.form.noValidate&&!s&&!o(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),Dt.set(this.host,[])},this.handleInteraction=r=>{const i=Dt.get(this.host);i.includes(r.type)||i.push(r.type),i.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.checkValidity=="function"&&!i.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.reportValidity=="function"&&!i.reportValidity())return!1}return!0},(this.host=e).addController(this),this.options=Le({form:r=>{const i=r.form;if(i){const o=r.getRootNode().querySelector(`#${i}`);if(o)return o}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var i;return(i=r.disabled)!=null?i:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,i)=>r.value=i,assumeInteractionOn:["sl-input"]},t)}hostConnected(){const e=this.options.form(this.host);e&&this.attachForm(e),Dt.set(this.host,[]),this.options.assumeInteractionOn.forEach(t=>{this.host.addEventListener(t,this.handleInteraction)})}hostDisconnected(){this.detachForm(),Dt.delete(this.host),this.options.assumeInteractionOn.forEach(e=>{this.host.removeEventListener(e,this.handleInteraction)})}hostUpdated(){const e=this.options.form(this.host);e||this.detachForm(),e&&this.form!==e&&(this.detachForm(),this.attachForm(e)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(e){e?(this.form=e,st.has(this.form)?st.get(this.form).add(this.host):st.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),it.has(this.form)||(it.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),ot.has(this.form)||(ot.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const e=st.get(this.form);e&&(e.delete(this.host),e.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),it.has(this.form)&&(this.form.reportValidity=it.get(this.form),it.delete(this.form)),ot.has(this.form)&&(this.form.checkValidity=ot.get(this.form),ot.delete(this.form)),this.form=void 0))}setUserInteracted(e,t){t?mr.add(e):mr.delete(e),e.requestUpdate()}doAction(e,t){if(this.form){const r=document.createElement("button");r.type=e,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",t&&(r.name=t.name,r.value=t.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(i=>{t.hasAttribute(i)&&r.setAttribute(i,t.getAttribute(i))})),this.form.append(r),r.click(),r.remove()}}getForm(){var e;return(e=this.form)!=null?e:null}reset(e){this.doAction("reset",e)}submit(e){this.doAction("submit",e)}setValidity(e){const t=this.host,r=!!mr.has(t),i=!!t.required;t.toggleAttribute("data-required",i),t.toggleAttribute("data-optional",!i),t.toggleAttribute("data-invalid",!e),t.toggleAttribute("data-valid",e),t.toggleAttribute("data-user-invalid",!e&&r),t.toggleAttribute("data-user-valid",e&&r)}updateValidity(){const e=this.host;this.setValidity(e.validity.valid)}emitInvalidEvent(e){const t=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});e||t.preventDefault(),this.host.dispatchEvent(t)||e==null||e.preventDefault()}},Br=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(Hr(Le({},Br),{valid:!1,valueMissing:!0}));Object.freeze(Hr(Le({},Br),{valid:!1,customError:!0}));var wo=_`
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
`,$t=class{constructor(e,...t){this.slotNames=[],this.handleSlotChange=r=>{const i=r.target;(this.slotNames.includes("[default]")&&!i.name||i.name&&this.slotNames.includes(i.name))&&this.host.requestUpdate()},(this.host=e).addController(this),this.slotNames=t}hasDefaultSlot(){return[...this.host.childNodes].some(e=>{if(e.nodeType===e.TEXT_NODE&&e.textContent.trim()!=="")return!0;if(e.nodeType===e.ELEMENT_NODE){const t=e;if(t.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!t.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(e){return this.host.querySelector(`:scope > [slot="${e}"]`)!==null}test(e){return e==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(e)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},kr="";function gs(e){kr=e}function ko(e=""){if(!kr){const t=[...document.getElementsByTagName("script")],r=t.find(i=>i.hasAttribute("data-shoelace"));if(r)gs(r.getAttribute("data-shoelace"));else{const i=t.find(o=>/shoelace(\.min)?\.js($|\?)/.test(o.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(o.src));let s="";i&&(s=i.getAttribute("src")),gs(s.split("/").slice(0,-1).join("/"))}}return kr.replace(/\/$/,"")+(e?`/${e.replace(/^\//,"")}`:"")}var $o={name:"default",resolver:e=>ko(`assets/icons/${e}.svg`)},So=$o,xs={caret:`
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
  `},Eo={name:"system",resolver:e=>e in xs?`data:image/svg+xml,${encodeURIComponent(xs[e])}`:""},Co=Eo,Po=[So,Co],$r=[];function Ao(e){$r.push(e)}function To(e){$r=$r.filter(t=>t!==e)}function _s(e){return Po.find(t=>t.name===e)}var Do=_`
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
`;function H(e,t){const r=Le({waitUntilFirstUpdate:!1},t);return(i,s)=>{const{update:o}=i,a=Array.isArray(e)?e:[e];i.update=function(l){a.forEach(n=>{const u=n;if(l.has(u)){const h=l.get(u),b=this[u];h!==b&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[s](h,b)}}),o.call(this,l)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const zo=(e,t)=>(e==null?void 0:e._$litType$)!==void 0,Oo=e=>e.strings===void 0,Io={},Ro=(e,t=Io)=>e._$AH=t;var at=Symbol(),zt=Symbol(),vr,gr=new Map,J=class extends W{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(e,t){var r;let i;if(t!=null&&t.spriteSheet)return this.svg=c`<svg part="svg">
        <use part="use" href="${e}"></use>
      </svg>`,this.svg;try{if(i=await fetch(e,{mode:"cors"}),!i.ok)return i.status===410?at:zt}catch{return zt}try{const s=document.createElement("div");s.innerHTML=await i.text();const o=s.firstElementChild;if(((r=o==null?void 0:o.tagName)==null?void 0:r.toLowerCase())!=="svg")return at;vr||(vr=new DOMParser);const l=vr.parseFromString(o.outerHTML,"text/html").body.querySelector("svg");return l?(l.part.add("svg"),document.adoptNode(l)):at}catch{return at}}connectedCallback(){super.connectedCallback(),Ao(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),To(this)}getIconSource(){const e=_s(this.library);return this.name&&e?{url:e.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var e;const{url:t,fromLibrary:r}=this.getIconSource(),i=r?_s(this.library):void 0;if(!t){this.svg=null;return}let s=gr.get(t);if(s||(s=this.resolveIcon(t,i),gr.set(t,s)),!this.initialRender)return;const o=await s;if(o===zt&&gr.delete(t),t===this.getIconSource().url){if(zo(o)){if(this.svg=o,i){await this.updateComplete;const a=this.shadowRoot.querySelector("[part='svg']");typeof i.mutator=="function"&&a&&i.mutator(a)}return}switch(o){case zt:case at:this.svg=null,this.emit("sl-error");break;default:this.svg=o.cloneNode(!0),(e=i==null?void 0:i.mutator)==null||e.call(i,this.svg),this.emit("sl-load")}}}render(){return this.svg}};J.styles=[ie,Do];p([m()],J.prototype,"svg",2);p([d({reflect:!0})],J.prototype,"name",2);p([d()],J.prototype,"src",2);p([d()],J.prototype,"label",2);p([d({reflect:!0})],J.prototype,"library",2);p([H("label")],J.prototype,"handleLabelChange",1);p([H(["name","src","library"])],J.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ye={ATTRIBUTE:1,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},ai=e=>(...t)=>({_$litDirective$:e,values:t});let ni=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,r,i){this._$Ct=t,this._$AM=r,this._$Ci=i}_$AS(t,r){return this.update(t,r)}update(t,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Z=ai(class extends ni{constructor(e){var t;if(super(e),e.type!==ye.ATTRIBUTE||e.name!=="class"||((t=e.strings)==null?void 0:t.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){var i,s;if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(o=>o!=="")));for(const o in t)t[o]&&!((i=this.nt)!=null&&i.has(o))&&this.st.add(o);return this.render(t)}const r=e.element.classList;for(const o of this.st)o in t||(r.remove(o),this.st.delete(o));for(const o in t){const a=!!t[o];a===this.st.has(o)||(s=this.nt)!=null&&s.has(o)||(a?(r.add(o),this.st.add(o)):(r.remove(o),this.st.delete(o)))}return se}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const li=Symbol.for(""),Lo=e=>{if((e==null?void 0:e.r)===li)return e==null?void 0:e._$litStatic$},Nt=(e,...t)=>({_$litStatic$:t.reduce((r,i,s)=>r+(o=>{if(o._$litStatic$!==void 0)return o._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${o}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(i)+e[s+1],e[0]),r:li}),ys=new Map,Mo=e=>(t,...r)=>{const i=r.length;let s,o;const a=[],l=[];let n,u=0,h=!1;for(;u<i;){for(n=t[u];u<i&&(o=r[u],(s=Lo(o))!==void 0);)n+=s+t[++u],h=!0;u!==i&&l.push(o),a.push(n),u++}if(u===i&&a.push(t[i]),h){const b=a.join("$$lit$$");(t=ys.get(b))===void 0&&(a.raw=a,ys.set(b,t=a)),r=l}return e(t,...r)},Mt=Mo(c);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=e=>e??w;var D=class extends W{constructor(){super(...arguments),this.formControlController=new oi(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new $t(this,"[default]","prefix","suffix"),this.localize=new Re(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Br}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(e){this.isButton()&&(this.button.setCustomValidity(e),this.formControlController.updateValidity())}render(){const e=this.isLink(),t=e?Nt`a`:Nt`button`;return Mt`
      <${t}
        part="base"
        class=${Z({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${E(e?void 0:this.disabled)}
        type=${E(e?void 0:this.type)}
        title=${this.title}
        name=${E(e?void 0:this.name)}
        value=${E(e?void 0:this.value)}
        href=${E(e&&!this.disabled?this.href:void 0)}
        target=${E(e?this.target:void 0)}
        download=${E(e?this.download:void 0)}
        rel=${E(e?this.rel:void 0)}
        role=${E(e?void 0:"button")}
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
        ${this.caret?Mt` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?Mt`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${t}>
    `}};D.styles=[ie,wo];D.dependencies={"sl-icon":J,"sl-spinner":ii};p([j(".button")],D.prototype,"button",2);p([m()],D.prototype,"hasFocus",2);p([m()],D.prototype,"invalid",2);p([d()],D.prototype,"title",2);p([d({reflect:!0})],D.prototype,"variant",2);p([d({reflect:!0})],D.prototype,"size",2);p([d({type:Boolean,reflect:!0})],D.prototype,"caret",2);p([d({type:Boolean,reflect:!0})],D.prototype,"disabled",2);p([d({type:Boolean,reflect:!0})],D.prototype,"loading",2);p([d({type:Boolean,reflect:!0})],D.prototype,"outline",2);p([d({type:Boolean,reflect:!0})],D.prototype,"pill",2);p([d({type:Boolean,reflect:!0})],D.prototype,"circle",2);p([d()],D.prototype,"type",2);p([d()],D.prototype,"name",2);p([d()],D.prototype,"value",2);p([d()],D.prototype,"href",2);p([d()],D.prototype,"target",2);p([d()],D.prototype,"rel",2);p([d()],D.prototype,"download",2);p([d()],D.prototype,"form",2);p([d({attribute:"formaction"})],D.prototype,"formAction",2);p([d({attribute:"formenctype"})],D.prototype,"formEnctype",2);p([d({attribute:"formmethod"})],D.prototype,"formMethod",2);p([d({attribute:"formnovalidate",type:Boolean})],D.prototype,"formNoValidate",2);p([d({attribute:"formtarget"})],D.prototype,"formTarget",2);p([H("disabled",{waitUntilFirstUpdate:!0})],D.prototype,"handleDisabledChange",1);D.define("sl-button");J.define("sl-icon");var Fo=_`
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
`,No=(e="value")=>(t,r)=>{const i=t.constructor,s=i.prototype.attributeChangedCallback;i.prototype.attributeChangedCallback=function(o,a,l){var n;const u=i.getPropertyOptions(e),h=typeof u.attribute=="string"?u.attribute:e;if(o===h){const b=u.converter||Ue,S=(typeof b=="function"?b:(n=b==null?void 0:b.fromAttribute)!=null?n:Ue.fromAttribute)(l,u.type);this[e]!==S&&(this[r]=S)}s.call(this,o,a,l)}},Wo=_`
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
 */const Ho=ai(class extends ni{constructor(e){if(super(e),e.type!==ye.PROPERTY&&e.type!==ye.ATTRIBUTE&&e.type!==ye.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!Oo(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[t]){if(t===se||t===w)return t;const r=e.element,i=e.name;if(e.type===ye.PROPERTY){if(t===r[i])return se}else if(e.type===ye.BOOLEAN_ATTRIBUTE){if(!!t===r.hasAttribute(i))return se}else if(e.type===ye.ATTRIBUTE&&r.getAttribute(i)===t+"")return se;return Ro(e),t}});var k=class extends W{constructor(){super(...arguments),this.formControlController=new oi(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new $t(this,"help-text","label"),this.localize=new Re(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var e;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((e=this.input)==null?void 0:e.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(e){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=e,this.value=this.__dateInput.value}get valueAsNumber(){var e;return this.__numberInput.value=this.value,((e=this.input)==null?void 0:e.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(e){this.__numberInput.valueAsNumber=e,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(e){e.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleKeyDown(e){const t=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;e.key==="Enter"&&!t&&setTimeout(()=>{!e.defaultPrevented&&!e.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(e,t,r="none"){this.input.setSelectionRange(e,t,r)}setRangeText(e,t,r,i="preserve"){const s=t??this.input.selectionStart,o=r??this.input.selectionEnd;this.input.setRangeText(e,s,o,i),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),r=this.label?!0:!!e,i=this.helpText?!0:!!t,o=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return c`
      <div
        part="form-control"
        class=${Z({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":i})}
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
            class=${Z({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
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
              name=${E(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${E(this.placeholder)}
              minlength=${E(this.minlength)}
              maxlength=${E(this.maxlength)}
              min=${E(this.min)}
              max=${E(this.max)}
              step=${E(this.step)}
              .value=${Ho(this.value)}
              autocapitalize=${E(this.autocapitalize)}
              autocomplete=${E(this.autocomplete)}
              autocorrect=${E(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${E(this.pattern)}
              enterkeyhint=${E(this.enterkeyhint)}
              inputmode=${E(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${o?c`
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
          aria-hidden=${i?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};k.styles=[ie,Wo,Fo];k.dependencies={"sl-icon":J};p([j(".input__control")],k.prototype,"input",2);p([m()],k.prototype,"hasFocus",2);p([d()],k.prototype,"title",2);p([d({reflect:!0})],k.prototype,"type",2);p([d()],k.prototype,"name",2);p([d()],k.prototype,"value",2);p([No()],k.prototype,"defaultValue",2);p([d({reflect:!0})],k.prototype,"size",2);p([d({type:Boolean,reflect:!0})],k.prototype,"filled",2);p([d({type:Boolean,reflect:!0})],k.prototype,"pill",2);p([d()],k.prototype,"label",2);p([d({attribute:"help-text"})],k.prototype,"helpText",2);p([d({type:Boolean})],k.prototype,"clearable",2);p([d({type:Boolean,reflect:!0})],k.prototype,"disabled",2);p([d()],k.prototype,"placeholder",2);p([d({type:Boolean,reflect:!0})],k.prototype,"readonly",2);p([d({attribute:"password-toggle",type:Boolean})],k.prototype,"passwordToggle",2);p([d({attribute:"password-visible",type:Boolean})],k.prototype,"passwordVisible",2);p([d({attribute:"no-spin-buttons",type:Boolean})],k.prototype,"noSpinButtons",2);p([d({reflect:!0})],k.prototype,"form",2);p([d({type:Boolean,reflect:!0})],k.prototype,"required",2);p([d()],k.prototype,"pattern",2);p([d({type:Number})],k.prototype,"minlength",2);p([d({type:Number})],k.prototype,"maxlength",2);p([d()],k.prototype,"min",2);p([d()],k.prototype,"max",2);p([d()],k.prototype,"step",2);p([d()],k.prototype,"autocapitalize",2);p([d()],k.prototype,"autocorrect",2);p([d()],k.prototype,"autocomplete",2);p([d({type:Boolean})],k.prototype,"autofocus",2);p([d()],k.prototype,"enterkeyhint",2);p([d({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],k.prototype,"spellcheck",2);p([d()],k.prototype,"inputmode",2);p([H("disabled",{waitUntilFirstUpdate:!0})],k.prototype,"handleDisabledChange",1);p([H("step",{waitUntilFirstUpdate:!0})],k.prototype,"handleStepChange",1);p([H("value",{waitUntilFirstUpdate:!0})],k.prototype,"handleValueChange",1);k.define("sl-input");var Bo=_`
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
`,ci=class extends W{constructor(){super(...arguments),this.hasSlotController=new $t(this,"footer","header","image")}render(){return c`
      <div
        part="base"
        class=${Z({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};ci.styles=[ie,Bo];ci.define("sl-card");var Uo=_`
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
`,jo=_`
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
`,N=class extends W{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(e){this.disabled&&(e.preventDefault(),e.stopPropagation())}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}render(){const e=!!this.href,t=e?Nt`a`:Nt`button`;return Mt`
      <${t}
        part="base"
        class=${Z({"icon-button":!0,"icon-button--disabled":!e&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${E(e?void 0:this.disabled)}
        type=${E(e?void 0:"button")}
        href=${E(e?this.href:void 0)}
        target=${E(e?this.target:void 0)}
        download=${E(e?this.download:void 0)}
        rel=${E(e&&this.target?"noreferrer noopener":void 0)}
        role=${E(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${E(this.name)}
          library=${E(this.library)}
          src=${E(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${t}>
    `}};N.styles=[ie,jo];N.dependencies={"sl-icon":J};p([j(".icon-button")],N.prototype,"button",2);p([m()],N.prototype,"hasFocus",2);p([d()],N.prototype,"name",2);p([d()],N.prototype,"library",2);p([d()],N.prototype,"src",2);p([d()],N.prototype,"href",2);p([d()],N.prototype,"target",2);p([d()],N.prototype,"download",2);p([d()],N.prototype,"label",2);p([d({type:Boolean,reflect:!0})],N.prototype,"disabled",2);var qo=0,oe=class extends W{constructor(){super(...arguments),this.localize=new Re(this),this.attrId=++qo,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(e){e.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,c`
      <div
        part="base"
        class=${Z({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
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
    `}};oe.styles=[ie,Uo];oe.dependencies={"sl-icon-button":N};p([j(".tab")],oe.prototype,"tab",2);p([d({reflect:!0})],oe.prototype,"panel",2);p([d({type:Boolean,reflect:!0})],oe.prototype,"active",2);p([d({type:Boolean,reflect:!0})],oe.prototype,"closable",2);p([d({type:Boolean,reflect:!0})],oe.prototype,"disabled",2);p([d({type:Number,reflect:!0})],oe.prototype,"tabIndex",2);p([H("active")],oe.prototype,"handleActiveChange",1);p([H("disabled")],oe.prototype,"handleDisabledChange",1);oe.define("sl-tab");var Vo=_`
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
`,Xo=_`
  :host {
    display: contents;
  }
`,er=class extends W{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{this.emit("sl-resize",{detail:{entries:e}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const e=this.shadowRoot.querySelector("slot");if(e!==null){const t=e.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],t.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return c` <slot @slotchange=${this.handleSlotChange}></slot> `}};er.styles=[ie,Xo];p([d({type:Boolean,reflect:!0})],er.prototype,"disabled",2);p([H("disabled",{waitUntilFirstUpdate:!0})],er.prototype,"handleDisabledChange",1);function Ko(e,t){return{top:Math.round(e.getBoundingClientRect().top-t.getBoundingClientRect().top),left:Math.round(e.getBoundingClientRect().left-t.getBoundingClientRect().left)}}var Sr=new Set;function Yo(){const e=document.documentElement.clientWidth;return Math.abs(window.innerWidth-e)}function Go(){const e=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(e)||!e?0:e}function xr(e){if(Sr.add(e),!document.documentElement.classList.contains("sl-scroll-lock")){const t=Yo()+Go();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),t<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${t}px`)}}function _r(e){Sr.delete(e),Sr.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function ws(e,t,r="vertical",i="smooth"){const s=Ko(e,t),o=s.top+t.scrollTop,a=s.left+t.scrollLeft,l=t.scrollLeft,n=t.scrollLeft+t.offsetWidth,u=t.scrollTop,h=t.scrollTop+t.offsetHeight;(r==="horizontal"||r==="both")&&(a<l?t.scrollTo({left:a,behavior:i}):a+e.clientWidth>n&&t.scrollTo({left:a-t.offsetWidth+e.clientWidth,behavior:i})),(r==="vertical"||r==="both")&&(o<u?t.scrollTo({top:o,behavior:i}):o+e.clientHeight>h&&t.scrollTo({top:o-t.offsetHeight+e.clientHeight,behavior:i}))}var L=class extends W{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new Re(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const e=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{const r=t.filter(({target:i})=>{if(i===this)return!0;if(i.closest("sl-tab-group")!==this)return!1;const s=i.tagName.toLowerCase();return s==="sl-tab"||s==="sl-tab-panel"});if(r.length!==0){if(r.some(i=>!["aria-labelledby","aria-controls"].includes(i.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(i=>i.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(i=>i.attributeName==="active")){const s=r.filter(o=>o.attributeName==="active"&&o.target.tagName.toLowerCase()==="sl-tab").map(o=>o.target).find(o=>o.active);s&&this.setActiveTab(s)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),e.then(()=>{new IntersectionObserver((r,i)=>{var s;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),i.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var e,t;super.disconnectedCallback(),(e=this.mutationObserver)==null||e.disconnect(),this.nav&&((t=this.resizeObserver)==null||t.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(e=>e.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(e=>e.active)}handleClick(e){const r=e.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(e){const r=e.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(e.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),e.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))){const s=this.tabs.find(l=>l.matches(":focus")),o=this.localize.dir()==="rtl";let a=null;if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){if(e.key==="Home")a=this.focusableTabs[0];else if(e.key==="End")a=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&e.key===(o?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&e.key==="ArrowUp"){const l=this.tabs.findIndex(n=>n===s);a=this.findNextFocusableTab(l,"backward")}else if(["top","bottom"].includes(this.placement)&&e.key===(o?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&e.key==="ArrowDown"){const l=this.tabs.findIndex(n=>n===s);a=this.findNextFocusableTab(l,"forward")}if(!a)return;a.tabIndex=0,a.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(a,{scrollBehavior:"smooth"}):this.tabs.forEach(l=>{l.tabIndex=l===a?0:-1}),["top","bottom"].includes(this.placement)&&ws(a,this.nav,"horizontal"),e.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(e,t){if(t=Le({emitEvents:!0,scrollBehavior:"auto"},t),e!==this.activeTab&&!e.disabled){const r=this.activeTab;this.activeTab=e,this.tabs.forEach(i=>{i.active=i===this.activeTab,i.tabIndex=i===this.activeTab?0:-1}),this.panels.forEach(i=>{var s;return i.active=i.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&ws(this.activeTab,this.nav,"horizontal",t.scrollBehavior),t.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(e=>{const t=this.panels.find(r=>r.name===e.panel);t&&(e.setAttribute("aria-controls",t.getAttribute("id")),t.setAttribute("aria-labelledby",e.getAttribute("id")))})}repositionIndicator(){const e=this.getActiveTab();if(!e)return;const t=e.clientWidth,r=e.clientHeight,i=this.localize.dir()==="rtl",s=this.getAllTabs(),a=s.slice(0,s.indexOf(e)).reduce((l,n)=>({left:l.left+n.clientWidth,top:l.top+n.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${t}px`,this.indicator.style.height="auto",this.indicator.style.translate=i?`${-1*a.left}px`:`${a.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${a.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(e=>!e.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(e,t){let r=null;const i=t==="forward"?1:-1;let s=e+i;for(;e<this.tabs.length;){if(r=this.tabs[s]||null,r===null){t==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;s+=i}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(e){const t=this.tabs.find(r=>r.panel===e);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}render(){const e=this.localize.dir()==="rtl";return c`
      <div
        part="base"
        class=${Z({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?c`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${Z({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
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
                  class=${Z({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
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
    `}};L.styles=[ie,Vo];L.dependencies={"sl-icon-button":N,"sl-resize-observer":er};p([j(".tab-group")],L.prototype,"tabGroup",2);p([j(".tab-group__body")],L.prototype,"body",2);p([j(".tab-group__nav")],L.prototype,"nav",2);p([j(".tab-group__indicator")],L.prototype,"indicator",2);p([m()],L.prototype,"hasScrollControls",2);p([m()],L.prototype,"shouldHideScrollStartButton",2);p([m()],L.prototype,"shouldHideScrollEndButton",2);p([d()],L.prototype,"placement",2);p([d()],L.prototype,"activation",2);p([d({attribute:"no-scroll-controls",type:Boolean})],L.prototype,"noScrollControls",2);p([d({attribute:"fixed-scroll-controls",type:Boolean})],L.prototype,"fixedScrollControls",2);p([_o({passive:!0})],L.prototype,"updateScrollButtons",1);p([H("noScrollControls",{waitUntilFirstUpdate:!0})],L.prototype,"updateScrollControls",1);p([H("placement",{waitUntilFirstUpdate:!0})],L.prototype,"syncIndicator",1);L.define("sl-tab-group");var Zo=(e,t)=>{let r=0;return function(...i){window.clearTimeout(r),r=window.setTimeout(()=>{e.call(this,...i)},t)}},ks=(e,t,r)=>{const i=e[t];e[t]=function(...s){i.call(this,...s),r.call(this,i,...s)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const t=new Set,r=new WeakMap,i=o=>{for(const a of o.changedTouches)t.add(a.identifier)},s=o=>{for(const a of o.changedTouches)t.delete(a.identifier)};document.addEventListener("touchstart",i,!0),document.addEventListener("touchend",s,!0),document.addEventListener("touchcancel",s,!0),ks(EventTarget.prototype,"addEventListener",function(o,a){if(a!=="scrollend")return;const l=Zo(()=>{t.size?l():this.dispatchEvent(new Event("scrollend"))},100);o.call(this,"scroll",l,{passive:!0}),r.set(this,l)}),ks(EventTarget.prototype,"removeEventListener",function(o,a){if(a!=="scrollend")return;const l=r.get(this);l&&o.call(this,"scroll",l,{passive:!0})})}})();var Qo=_`
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
`;function*Ur(e=document.activeElement){e!=null&&(yield e,"shadowRoot"in e&&e.shadowRoot&&e.shadowRoot.mode!=="closed"&&(yield*vo(Ur(e.shadowRoot.activeElement))))}function Jo(){return[...Ur()].pop()}var $s=new WeakMap;function di(e){let t=$s.get(e);return t||(t=window.getComputedStyle(e,null),$s.set(e,t)),t}function ea(e){if(typeof e.checkVisibility=="function")return e.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const t=di(e);return t.visibility!=="hidden"&&t.display!=="none"}function ta(e){const t=di(e),{overflowY:r,overflowX:i}=t;return r==="scroll"||i==="scroll"?!0:r!=="auto"||i!=="auto"?!1:e.scrollHeight>e.clientHeight&&r==="auto"||e.scrollWidth>e.clientWidth&&i==="auto"}function ra(e){const t=e.tagName.toLowerCase(),r=Number(e.getAttribute("tabindex"));if(e.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||e.hasAttribute("disabled")||e.closest("[inert]"))return!1;if(t==="input"&&e.getAttribute("type")==="radio"){const o=e.getRootNode(),a=`input[type='radio'][name="${e.getAttribute("name")}"]`,l=o.querySelector(`${a}:checked`);return l?l===e:o.querySelector(a)===e}return ea(e)?(t==="audio"||t==="video")&&e.hasAttribute("controls")||e.hasAttribute("tabindex")||e.hasAttribute("contenteditable")&&e.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(t)?!0:ta(e):!1}function sa(e,t){var r;return((r=e.getRootNode({composed:!0}))==null?void 0:r.host)!==t}function Ss(e){const t=new WeakMap,r=[];function i(s){if(s instanceof Element){if(s.hasAttribute("inert")||s.closest("[inert]")||t.has(s))return;t.set(s,!0),!r.includes(s)&&ra(s)&&r.push(s),s instanceof HTMLSlotElement&&sa(s,e)&&s.assignedElements({flatten:!0}).forEach(o=>{i(o)}),s.shadowRoot!==null&&s.shadowRoot.mode==="open"&&i(s.shadowRoot)}for(const o of s.children)i(o)}return i(e),r.sort((s,o)=>{const a=Number(s.getAttribute("tabindex"))||0;return(Number(o.getAttribute("tabindex"))||0)-a})}var nt=[],ia=class{constructor(e){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=t=>{var r;if(t.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const i=Jo();if(this.previousFocus=i,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;t.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const s=Ss(this.element);let o=s.findIndex(l=>l===i);this.previousFocus=this.currentFocus;const a=this.tabDirection==="forward"?1:-1;for(;;){o+a>=s.length?o=0:o+a<0?o=s.length-1:o+=a,this.previousFocus=this.currentFocus;const l=s[o];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||l&&this.possiblyHasTabbableChildren(l))return;t.preventDefault(),this.currentFocus=l,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const n=[...Ur()];if(n.includes(this.currentFocus)||!n.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=e,this.elementsWithTabbableControls=["iframe"]}activate(){nt.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){nt=nt.filter(e=>e!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return nt[nt.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const e=Ss(this.element);if(!this.element.matches(":focus-within")){const t=e[0],r=e[e.length-1],i=this.tabDirection==="forward"?t:r;typeof(i==null?void 0:i.focus)=="function"&&(this.currentFocus=i,i.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(e){return this.elementsWithTabbableControls.includes(e.tagName.toLowerCase())||e.hasAttribute("controls")}},hi=e=>{var t;const{activeElement:r}=document;r&&e.contains(r)&&((t=document.activeElement)==null||t.blur())},ui=new Map,oa=new WeakMap;function aa(e){return e??{keyframes:[],options:{duration:0}}}function Es(e,t){return t.toLowerCase()==="rtl"?{keyframes:e.rtlKeyframes||e.keyframes,options:e.options}:e}function V(e,t){ui.set(e,aa(t))}function $e(e,t,r){const i=oa.get(e);if(i!=null&&i[t])return Es(i[t],r.dir);const s=ui.get(t);return s?Es(s,r.dir):{keyframes:[],options:{duration:0}}}function Wt(e,t){return new Promise(r=>{function i(s){s.target===e&&(e.removeEventListener(t,i),r())}e.addEventListener(t,i)})}function Se(e,t,r){return new Promise(i=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=e.animate(t,Hr(Le({},r),{duration:na()?0:r.duration}));s.addEventListener("cancel",i,{once:!0}),s.addEventListener("finish",i,{once:!0})})}function na(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Be(e){return Promise.all(e.getAnimations().map(t=>new Promise(r=>{t.cancel(),requestAnimationFrame(r)})))}function Cs(e){return e.charAt(0).toUpperCase()+e.slice(1)}var X=class extends W{constructor(){super(...arguments),this.hasSlotController=new $t(this,"footer"),this.localize=new Re(this),this.modal=new ia(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=e=>{this.contained||e.key==="Escape"&&this.modal.isActive()&&this.open&&(e.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),xr(this)))}disconnectedCallback(){super.disconnectedCallback(),_r(this),this.removeOpenListeners()}requestClose(e){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:e}}).defaultPrevented){const r=$e(this,"drawer.denyClose",{dir:this.localize.dir()});Se(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var e;"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var e;document.removeEventListener("keydown",this.handleDocumentKeyDown),(e=this.closeWatcher)==null||e.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),xr(this));const e=this.querySelector("[autofocus]");e&&e.removeAttribute("autofocus"),await Promise.all([Be(this.drawer),Be(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(e?e.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),e&&e.setAttribute("autofocus","")});const t=$e(this,`drawer.show${Cs(this.placement)}`,{dir:this.localize.dir()}),r=$e(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([Se(this.panel,t.keyframes,t.options),Se(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{hi(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),_r(this)),await Promise.all([Be(this.drawer),Be(this.overlay)]);const e=$e(this,`drawer.hide${Cs(this.placement)}`,{dir:this.localize.dir()}),t=$e(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([Se(this.overlay,t.keyframes,t.options).then(()=>{this.overlay.hidden=!0}),Se(this.panel,e.keyframes,e.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),xr(this)),this.open&&this.contained&&(this.modal.deactivate(),_r(this))}async show(){if(!this.open)return this.open=!0,Wt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Wt(this,"sl-after-hide")}render(){return c`
      <div
        part="base"
        class=${Z({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${E(this.noHeader?this.label:void 0)}
          aria-labelledby=${E(this.noHeader?void 0:"title")}
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
    `}};X.styles=[ie,Qo];X.dependencies={"sl-icon-button":N};p([j(".drawer")],X.prototype,"drawer",2);p([j(".drawer__panel")],X.prototype,"panel",2);p([j(".drawer__overlay")],X.prototype,"overlay",2);p([d({type:Boolean,reflect:!0})],X.prototype,"open",2);p([d({reflect:!0})],X.prototype,"label",2);p([d({reflect:!0})],X.prototype,"placement",2);p([d({type:Boolean,reflect:!0})],X.prototype,"contained",2);p([d({attribute:"no-header",type:Boolean,reflect:!0})],X.prototype,"noHeader",2);p([H("open",{waitUntilFirstUpdate:!0})],X.prototype,"handleOpenChange",1);p([H("contained",{waitUntilFirstUpdate:!0})],X.prototype,"handleNoModalChange",1);V("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});V("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});V("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});V("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});V("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});V("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});V("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});V("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});V("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});V("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});V("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});X.define("sl-drawer");var la=_`
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
`,K=class we extends W{constructor(){super(...arguments),this.hasSlotController=new $t(this,"icon","suffix"),this.localize=new Re(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var t;(t=this.countdownAnimation)==null||t.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var t;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(t=this.countdownAnimation)==null||t.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:t}=this,r="100%",i="0";this.countdownAnimation=t.animate([{width:r},{width:i}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await Be(this.base),this.base.hidden=!1;const{keyframes:t,options:r}=$e(this,"alert.show",{dir:this.localize.dir()});await Se(this.base,t,r),this.emit("sl-after-show")}else{hi(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await Be(this.base);const{keyframes:t,options:r}=$e(this,"alert.hide",{dir:this.localize.dir()});await Se(this.base,t,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Wt(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Wt(this,"sl-after-hide")}async toast(){return new Promise(t=>{this.handleCountdownChange(),we.toastStack.parentElement===null&&document.body.append(we.toastStack),we.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{we.toastStack.removeChild(this),t(),we.toastStack.querySelector("sl-alert")===null&&we.toastStack.remove()},{once:!0})})}render(){return c`
      <div
        part="base"
        class=${Z({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
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
                class=${Z({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};K.styles=[ie,la];K.dependencies={"sl-icon-button":N};p([j('[part~="base"]')],K.prototype,"base",2);p([j(".alert__countdown-elapsed")],K.prototype,"countdownElement",2);p([d({type:Boolean,reflect:!0})],K.prototype,"open",2);p([d({type:Boolean,reflect:!0})],K.prototype,"closable",2);p([d({reflect:!0})],K.prototype,"variant",2);p([d({type:Number})],K.prototype,"duration",2);p([d({type:String,reflect:!0})],K.prototype,"countdown",2);p([m()],K.prototype,"remainingTime",2);p([H("open",{waitUntilFirstUpdate:!0})],K.prototype,"handleOpenChange",1);p([H("duration")],K.prototype,"handleDurationChange",1);var ca=K;V("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});V("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});ca.define("sl-alert");function da(e,t){const r=new Set([...Object.keys(e),...Object.keys(t)]);for(const i of r)if((e[i]??"")!==(t[i]??""))return!0;return!1}const ha={view:"search",search:{state:"initial",currentSession:null,query:"",queryWords:[],results:[],total:0,source:"fts",offset:0,limit:20},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,status:null,error:null,settings:{scope:"global",values:{},original:{},dirty:!1,exists:!0,saving:!1,error:null},files:{treeCache:{},expandedPaths:[],currentDir:"",selectedPaths:[],lastSelectedAnchor:null,detail:null,detailLoading:!1,listing:!1,mobilePane:"tree",pendingAction:null,error:null,filenameSearch:{query:"",allDocs:[],docsLoading:!0,docsError:null,results:[],selectedPath:null,isActive:!1,totalMatches:0}}};class ua{constructor(){this.state=ha,this.listeners=new Set}getState(){return this.state}setState(t){this.state={...this.state,...t},this.listeners.forEach(r=>r(this.state))}subscribe(t){return this.listeners.add(t),()=>this.listeners.delete(t)}subscribeSelector(t,r){let i=t(this.state);return this.subscribe(s=>{const o=t(s);o!==i&&(i=o,r(o))})}}const f=new ua,g={setView(e){f.setState({view:e})},setSearchState(e){const t=f.getState().search;f.setState({search:{...t,...e}})},setChatState(e){const t=f.getState().chat;f.setState({chat:{...t,...e}})},pushDetail(e){const t=f.getState().detailStack;f.setState({detailStack:[...t,e]})},popDetail(){const e=f.getState().detailStack;e.length!==0&&f.setState({detailStack:e.slice(0,-1)})},setError(e){f.setState({error:e})},setPendingSession(e){f.setState({pendingSession:e})},setSettingsScope(e){},loadSettings(e,t){const r=f.getState().settings;f.setState({settings:{...r,values:{...e},original:{...e},exists:t,dirty:!1,error:null}})},updateSetting(e,t){const r=f.getState().settings,i={...r.values,[e]:t},s=da(r.original,i);f.setState({settings:{...r,values:i,dirty:s}})},revertSettings(){const e=f.getState().settings,t={...e.original};f.setState({settings:{...e,values:t,dirty:!1}})},setSettingsSaving(e){const t=f.getState().settings;f.setState({settings:{...t,saving:e}})},setSettingsError(e){const t=f.getState().settings;f.setState({settings:{...t,error:e}})},setFilesState(e){const t=f.getState().files;f.setState({files:{...t,...e}})},expandDir(e){const t=f.getState().files;t.expandedPaths.includes(e)||f.setState({files:{...t,expandedPaths:[...t.expandedPaths,e]}})},collapseDir(e){const t=f.getState().files;f.setState({files:{...t,expandedPaths:t.expandedPaths.filter(r=>r!==e)}})},selectDir(e){const t=f.getState().files;f.setState({files:{...t,currentDir:e,selectedPaths:[],lastSelectedAnchor:null,detail:null,mobilePane:t.mobilePane==="tree"?"list":t.mobilePane}})},selectEntry(e,t={}){const r=f.getState().files;let i,s=r.lastSelectedAnchor;if(t.shift&&s!==null){const a=(r.treeCache[r.currentDir]||[]).map(u=>u.path),l=a.indexOf(s),n=a.indexOf(e);if(l>=0&&n>=0){const[u,h]=l<n?[l,n]:[n,l];i=a.slice(u,h+1)}else i=[e],s=e}else t.ctrl?(i=r.selectedPaths.includes(e)?r.selectedPaths.filter(o=>o!==e):[...r.selectedPaths,e],s=e):(i=[e],s=e);f.setState({files:{...r,selectedPaths:i,lastSelectedAnchor:s}})},clearSelection(){const e=f.getState().files;f.setState({files:{...e,selectedPaths:[],lastSelectedAnchor:null,detail:null}})},invalidateDir(e){const t=f.getState().files,r={...t.treeCache};delete r[e],f.setState({files:{...t,treeCache:r}})},invalidateSubtree(e){const t=f.getState().files,r={};for(const[i,s]of Object.entries(t.treeCache))i!==e&&!i.startsWith(e+"/")&&(r[i]=s);f.setState({files:{...t,treeCache:r}})},setMobilePane(e){const t=f.getState().files;f.setState({files:{...t,mobilePane:e}})},loadIndexedDocuments(e){const t=f.getState().files;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,allDocs:e,docsLoading:!1,docsError:null}}})},setFilenameSearchDocsError(e){const t=f.getState().files;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,docsLoading:!1,docsError:e}}})},setFilenameSearchQuery(e){var s;const t=f.getState().files,r=e.query.trim()!=="",i=r?((s=e.results[0])==null?void 0:s.path)??null:null;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,query:e.query,results:e.results,totalMatches:e.totalMatches,isActive:r,selectedPath:i}}})},clearFilenameSearch(){const e=f.getState().files;f.setState({files:{...e,filenameSearch:{...e.filenameSearch,query:"",results:[],totalMatches:0,isActive:!1,selectedPath:null}}})},selectFilenameSearchResult(e){const t=f.getState().files;f.setState({files:{...t,filenameSearch:{...t.filenameSearch,selectedPath:e}}})}},Ht={search:"#/search",chat:"#/chat",files:"#/files",settings:"#/settings"},pa=Object.fromEntries(Object.entries(Ht).map(([e,t])=>[t,e])),fa="search";function ba(e){if(!e)return null;const t=e.split("?")[0];return pa[t]??null}let yr=!1;function Bt(){return typeof window<"u"?window.location.hash:""}function Er(){return ba(Bt())??fa}function pi(e){if(typeof window>"u")return;const t=new URL(window.location.href);t.hash=e,window.history.replaceState(null,"",t)}function Ps(){const e=Er(),t=Ht[e];Bt()!==t&&pi(t),g.setView(e)}const As={init(){if(yr)return;yr=!0;const e=Er(),t=Ht[e];Bt()!==t&&pi(t),g.setView(e),typeof window<"u"&&window.addEventListener("hashchange",Ps)},navigate(e){const t=Ht[e];Bt()!==t&&typeof window<"u"&&(window.location.hash=t)},current(){return Er()},_reset(){typeof window<"u"&&window.removeEventListener("hashchange",Ps),yr=!1}};var ma=Object.defineProperty,va=Object.getOwnPropertyDescriptor,fi=(e,t,r,i)=>{for(var s=i>1?void 0:i?va(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&ma(t,r,s),s};let Ut=class extends ${constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"files",icon:"📁",label:"文件"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return c`
      ${this._items.map(e=>c`
        <button
          class=${this.active===e.id?"active":""}
          title=${e.label}
          @click=${()=>this._select(e.id)}>
          ${e.icon}
        </button>`)}
    `}};Ut.styles=_`
    :host {
      display: var(--cortex-show-activity-bar, none);
      flex-direction: column;
      align-items: center;
      width: var(--cortex-activity-bar-width);
      background: #0F172A;
      color: #94A3B8;
      padding: var(--cortex-space-4) 0;
      gap: var(--cortex-space-4);
      flex-shrink: 0;
    }
    button {
      width: 36px; height: 36px;
      border: none;
      background: transparent;
      color: inherit;
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: background 0.15s, color 0.15s;
    }
    button:hover { background: rgba(255,255,255,0.08); color: #fff; }
    button.active { background: var(--cortex-primary); color: #fff; }
  `;fi([d()],Ut.prototype,"active",2);Ut=fi([A("activity-bar")],Ut);var ga=Object.defineProperty,xa=Object.getOwnPropertyDescriptor,bi=(e,t,r,i)=>{for(var s=i>1?void 0:i?xa(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&ga(t,r,s),s};let jt=class extends ${constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"files",icon:"📁",label:"文件"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return c`
      ${this._items.map(e=>c`
        <button
          class="tab ${this.active===e.id?"active":""}"
          @click=${()=>this._select(e.id)}>
          <span class="icon">${e.icon}</span>
          <span>${e.label}</span>
        </button>`)}
    `}};jt.styles=_`
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
      color: var(--cortex-text-subtle);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      font-size: 10px;
    }
    .tab.active { color: var(--cortex-primary); font-weight: 600; }
    .tab .icon { font-size: 18px; }
  `;bi([d()],jt.prototype,"active",2);jt=bi([A("tab-bar")],jt);var _a=Object.defineProperty,ya=Object.getOwnPropertyDescriptor,jr=(e,t,r,i)=>{for(var s=i>1?void 0:i?ya(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&_a(t,r,s),s};let vt=class extends ${constructor(){super(...arguments),this.heading="Doclens",this.subheading=""}render(){return c`
      <h1 class="title">${this.heading}</h1>
      ${this.subheading?c`<p class="subtitle">${this.subheading}</p>`:null}
    `}};vt.styles=_`
    :host {
      display: block;
      padding: var(--cortex-space-8) var(--cortex-space-6) var(--cortex-space-6);
      text-align: center;
      background: linear-gradient(180deg, var(--cortex-primary-soft) 0%, var(--cortex-surface) 100%);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .title {
      font-size: var(--cortex-fs-xl);
      font-weight: 700;
      color: var(--cortex-primary);
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text-muted);
      margin-top: var(--cortex-space-1);
    }
    @media (min-width: 1024px) {
      :host {
        padding: var(--cortex-space-6) var(--cortex-space-4) var(--cortex-space-4);
        border-radius: var(--cortex-radius-lg);
      }
    }
  `;jr([d()],vt.prototype,"heading",2);jr([d()],vt.prototype,"subheading",2);vt=jr([A("welcome-pane")],vt);var wa=Object.defineProperty,ka=Object.getOwnPropertyDescriptor,Qe=(e,t,r,i)=>{for(var s=i>1?void 0:i?ka(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&wa(t,r,s),s};let me=class extends ${constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta="",this.actions=[],this._menuOpen=!1,this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}_onMoreClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onItemClick(e){e.disabled||(this._menuOpen=!1,e.onClick())}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return c`
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
    `}};me.styles=_`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      position: relative;
    }
    .back {
      background: none;
      border: none;
      color: var(--cortex-primary);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 22px;
      font-weight: 500;
      line-height: 1;
      transition: background 0.15s, opacity 0.1s;
      /* Disable iOS Safari double-tap-zoom detection: without this, the first
         tap is held for ~300ms to see if a second tap follows, which surfaces
         as "needs 2 clicks" on touch devices. */
      touch-action: manipulation;
    }
    .back:hover { background: var(--cortex-primary-soft); }
    .back:active { opacity: 0.7; }
    .title {
      font-weight: 600;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-md);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta { color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm); }
    .more-wrap { position: relative; }
    .more-btn {
      background: transparent;
      border: none;
      color: var(--cortex-text);
      font-family: inherit;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s, opacity 0.1s;
      touch-action: manipulation;
    }
    .more-btn:hover { background: var(--cortex-surface-muted); }
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
  `;Qe([d()],me.prototype,"backLabel",2);Qe([d()],me.prototype,"title",2);Qe([d()],me.prototype,"meta",2);Qe([d({attribute:!1})],me.prototype,"actions",2);Qe([m()],me.prototype,"_menuOpen",2);me=Qe([A("focus-header")],me);var $a=Object.defineProperty,Sa=Object.getOwnPropertyDescriptor,St=(e,t,r,i)=>{for(var s=i>1?void 0:i?Sa(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&$a(t,r,s),s};let Te=class extends ${constructor(){super(...arguments),this.title="历史会话",this.sessions=[],this.clearing=!1}_onClear(){this.clearing||this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){const e=this.sessions.length>0;return c`
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
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
      /* min-height:0 允许在 flex column 容器内收缩到 content 以下，
         配合 overflow-y:auto 实现内部滚动。缺少时 min-height 默认为
         auto(=min-content)，历史会话多时会撑开父容器，把底部 tab-bar
         推出视口。 */
      min-height: 0;
      overflow-y: auto;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 var(--cortex-space-2) 0;
    }
    .title {
      font-size: var(--cortex-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cortex-text-subtle);
    }
    .clear-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .clear-btn:hover {
      color: #dc2626;
      background: rgba(220, 38, 38, 0.08);
    }
    .clear-btn:disabled {
      color: var(--cortex-text-subtle);
      cursor: not-allowed;
      opacity: 0.6;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;St([d()],Te.prototype,"title",2);St([d({attribute:!1})],Te.prototype,"sessions",2);St([d()],Te.prototype,"type",2);St([d({type:Boolean})],Te.prototype,"clearing",2);Te=St([A("history-list")],Te);var Ea=Object.defineProperty,Ca=Object.getOwnPropertyDescriptor,mi=(e,t,r,i)=>{for(var s=i>1?void 0:i?Ca(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Ea(t,r,s),s};let qt=class extends ${constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){if(!this.session)return null;const e=[];return this.session.type==="chat"&&e.push(String(this.session.message_count)),e.push(new Date(this.session.updated_at).toLocaleDateString()),c`
      <div class="name">
        ${this.session.mode==="grep"?c`<span class="mode-tag" title="正则 grep">grep</span>`:null}
        ${this.session.title}
      </div>
      <div class="meta">${e.join(" · ")}</div>
    `}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};qt.styles=_`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    :host(:hover) { border-color: var(--cortex-primary); }
    .name { font-size: var(--cortex-fs-md); color: var(--cortex-text); font-weight: 500; }
    .meta { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); }
    .mode-tag {
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      border-radius: 9999px;
      padding: 1px 8px;
      line-height: 1.5;
    }
  `;mi([d({attribute:!1})],qt.prototype,"session",2);qt=mi([A("history-item")],qt);var Pa=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,ae=(e,t,r,i)=>{for(var s=i>1?void 0:i?Aa(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Pa(t,r,s),s};let q=class extends ${constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.multiline=!1,this.disabled=!1,this.mode="keyword",this.modes=null,this._menuOpen=!1,this._onDocClick=()=>{this._menuOpen=!1,document.removeEventListener("click",this._onDocClick)}}focus(){var e;(e=this.inputEl)==null||e.focus()}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("value")||e.has("multiline"))&&this._autoResize()}_autoResize(){const e=this.renderRoot.querySelector("textarea");e&&(e.style.height="auto",e.style.height=`${e.scrollHeight}px`)}get trimmed(){return this.value.trim()}_onInput(e){const t=e.target;this.value=t.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled),this._autoResize()}_onKeydown(e){e.key==="Enter"&&(e.shiftKey&&this.multiline||(e.preventDefault(),this._submit()))}_submit(){!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}get _hasModes(){return!!this.modes&&this.mode in this.modes}_toggleMenu(e){e.stopPropagation(),this._menuOpen=!this._menuOpen,this._menuOpen&&document.addEventListener("click",this._onDocClick)}_selectMode(e){this._menuOpen=!1,document.removeEventListener("click",this._onDocClick),this.dispatchEvent(new CustomEvent("mode-change",{detail:{mode:e}}))}_renderButton(){if(!this._hasModes)return c`
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
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface-muted);
      min-height: var(--min-h);
      padding: 0 calc(var(--min-h) + 8px) 0 14px;
    }
    .wrapper:focus-within {
      border-color: var(--cortex-primary);
      box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.15);
    }
    input, textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      resize: none;
      min-height: calc(var(--min-h) - 12px);
      line-height: 1.4;
    }
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--cortex-primary);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-sm);
      min-width: var(--cortex-touch-target);
      height: calc(var(--min-h) - 8px);
      padding: 0 12px;
      font-size: var(--cortex-fs-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:hover:not(:disabled) { background: var(--cortex-primary-hover); }
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
      border-radius: var(--cortex-radius-sm) 0 0 var(--cortex-radius-sm);
    }
    .caret {
      position: static;
      top: auto;
      right: auto;
      transform: none;
      background: var(--cortex-primary);
      color: #fff;
      border: none;
      border-left: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0 var(--cortex-radius-sm) var(--cortex-radius-sm) 0;
      height: calc(var(--min-h) - 8px);
      min-width: 24px;
      padding: 0 8px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-primary-hover); }
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
      border-radius: var(--cortex-radius-sm);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
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
    .menu-item.active .menu-item-title { color: var(--cortex-primary); font-weight: 600; }
    @media (max-width: 1023px) {
      :host { --min-h: 44px; }
    }
  `;ae([d()],q.prototype,"value",2);ae([d()],q.prototype,"placeholder",2);ae([d()],q.prototype,"buttonLabel",2);ae([d()],q.prototype,"buttonIcon",2);ae([d({type:Boolean})],q.prototype,"multiline",2);ae([d({type:Boolean})],q.prototype,"disabled",2);ae([d()],q.prototype,"mode",2);ae([d({attribute:!1})],q.prototype,"modes",2);ae([m()],q.prototype,"_menuOpen",2);ae([j("input, textarea")],q.prototype,"inputEl",2);q=ae([A("input-box")],q);function qr(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Me=qr();function vi(e){Me=e}var Ee={exec:()=>null};function Ne(e){let t=[];return r=>{let i=Math.max(0,Math.min(3,r-1)),s=t[i];return s||(s=e(i),t[i]=s),s}}function P(e,t=""){let r=typeof e=="string"?e:e.source,i={replace:(s,o)=>{let a=typeof o=="string"?o:o.source;return a=a.replace(F.caret,"$1"),r=r.replace(s,a),i},getRegex:()=>new RegExp(r,t)};return i}var Ta=((e="")=>{try{return!!new RegExp("(?<=1)(?<!1)"+e)}catch{return!1}})(),F={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:Ne(e=>new RegExp(`^ {0,${e}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:Ne(e=>new RegExp(`^ {0,${e}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:Ne(e=>new RegExp(`^ {0,${e}}(?:\`\`\`|~~~)`)),headingBeginRegex:Ne(e=>new RegExp(`^ {0,${e}}#`)),htmlBeginRegex:Ne(e=>new RegExp(`^ {0,${e}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:Ne(e=>new RegExp(`^ {0,${e}}>`))},Da=/^(?:[ \t]*(?:\n|$))+/,za=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,Oa=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,Et=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Ia=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Vr=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,gi=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,xi=P(gi).replace(/bull/g,Vr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),Ra=P(gi).replace(/bull/g,Vr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Xr=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,La=/^[^\n]+/,Kr=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,Ma=P(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",Kr).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Fa=P(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,Vr).getRegex(),tr="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",Yr=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Na=P("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",Yr).replace("tag",tr).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),_i=P(Xr).replace("hr",Et).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",tr).getRegex(),Wa=P(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",_i).getRegex(),Gr={blockquote:Wa,code:za,def:Ma,fences:Oa,heading:Ia,hr:Et,html:Na,lheading:xi,list:Fa,newline:Da,paragraph:_i,table:Ee,text:La},Ts=P("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",Et).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",tr).getRegex(),Ha={...Gr,lheading:Ra,table:Ts,paragraph:P(Xr).replace("hr",Et).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",Ts).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",tr).getRegex()},Ba={...Gr,html:P(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",Yr).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:Ee,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:P(Xr).replace("hr",Et).replace("heading",` *#{1,6} *[^
]`).replace("lheading",xi).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Ua=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,ja=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,yi=/^( {2,}|\\)\n(?!\s*$)/,qa=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Je=/[\p{P}\p{S}]/u,rr=/[\s\p{P}\p{S}]/u,Zr=/[^\s\p{P}\p{S}]/u,Va=P(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,rr).getRegex(),wi=/(?!~)[\p{P}\p{S}]/u,Xa=/(?!~)[\s\p{P}\p{S}]/u,Ka=/(?:[^\s\p{P}\p{S}]|~)/u,Ya=P(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",Ta?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),ki=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,Ga=P(ki,"u").replace(/punct/g,Je).getRegex(),Za=P(ki,"u").replace(/punct/g,wi).getRegex(),$i="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Qa=P($i,"gu").replace(/notPunctSpace/g,Zr).replace(/punctSpace/g,rr).replace(/punct/g,Je).getRegex(),Ja=P($i,"gu").replace(/notPunctSpace/g,Ka).replace(/punctSpace/g,Xa).replace(/punct/g,wi).getRegex(),en=P("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Zr).replace(/punctSpace/g,rr).replace(/punct/g,Je).getRegex(),tn=P(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,Je).getRegex(),rn="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",sn=P(rn,"gu").replace(/notPunctSpace/g,Zr).replace(/punctSpace/g,rr).replace(/punct/g,Je).getRegex(),on=P(/\\(punct)/,"gu").replace(/punct/g,Je).getRegex(),an=P(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),nn=P(Yr).replace("(?:-->|$)","-->").getRegex(),ln=P("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",nn).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Vt=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,cn=P(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",Vt).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),Si=P(/^!?\[(label)\]\[(ref)\]/).replace("label",Vt).replace("ref",Kr).getRegex(),Ei=P(/^!?\[(ref)\](?:\[\])?/).replace("ref",Kr).getRegex(),dn=P("reflink|nolink(?!\\()","g").replace("reflink",Si).replace("nolink",Ei).getRegex(),Ds=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Qr={_backpedal:Ee,anyPunctuation:on,autolink:an,blockSkip:Ya,br:yi,code:ja,del:Ee,delLDelim:Ee,delRDelim:Ee,emStrongLDelim:Ga,emStrongRDelimAst:Qa,emStrongRDelimUnd:en,escape:Ua,link:cn,nolink:Ei,punctuation:Va,reflink:Si,reflinkSearch:dn,tag:ln,text:qa,url:Ee},hn={...Qr,link:P(/^!?\[(label)\]\((.*?)\)/).replace("label",Vt).getRegex(),reflink:P(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Vt).getRegex()},Cr={...Qr,emStrongRDelimAst:Ja,emStrongLDelim:Za,delLDelim:tn,delRDelim:sn,url:P(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",Ds).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:P(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",Ds).getRegex()},un={...Cr,br:P(yi).replace("{2,}","*").getRegex(),text:P(Cr.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Ot={normal:Gr,gfm:Ha,pedantic:Ba},lt={normal:Qr,gfm:Cr,breaks:un,pedantic:hn},pn={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},zs=e=>pn[e];function ne(e,t){if(t){if(F.escapeTest.test(e))return e.replace(F.escapeReplace,zs)}else if(F.escapeTestNoEncode.test(e))return e.replace(F.escapeReplaceNoEncode,zs);return e}function Os(e){try{e=encodeURI(e).replace(F.percentDecode,"%")}catch{return null}return e}function Is(e,t){var o;let r=e.replace(F.findPipe,(a,l,n)=>{let u=!1,h=l;for(;--h>=0&&n[h]==="\\";)u=!u;return u?"|":" |"}),i=r.split(F.splitPipe),s=0;if(i[0].trim()||i.shift(),i.length>0&&!((o=i.at(-1))!=null&&o.trim())&&i.pop(),t)if(i.length>t)i.splice(t);else for(;i.length<t;)i.push("");for(;s<i.length;s++)i[s]=i[s].trim().replace(F.slashPipe,"|");return i}function he(e,t,r){let i=e.length;if(i===0)return"";let s=0;for(;s<i&&e.charAt(i-s-1)===t;)s++;return e.slice(0,i-s)}function Rs(e){let t=e.split(`
`),r=t.length-1;for(;r>=0&&F.blankLine.test(t[r]);)r--;return t.length-r<=2?e:t.slice(0,r+1).join(`
`)}function fn(e,t){if(e.indexOf(t[1])===-1)return-1;let r=0;for(let i=0;i<e.length;i++)if(e[i]==="\\")i++;else if(e[i]===t[0])r++;else if(e[i]===t[1]&&(r--,r<0))return i;return r>0?-2:-1}function bn(e,t=0){let r=t,i="";for(let s of e)if(s==="	"){let o=4-r%4;i+=" ".repeat(o),r+=o}else i+=s,r++;return i}function Ls(e,t,r,i,s){let o=t.href,a=t.title||null,l=e[1].replace(s.other.outputLinkReplace,"$1");i.state.inLink=!0;let n={type:e[0].charAt(0)==="!"?"image":"link",raw:r,href:o,title:a,text:l,tokens:i.inlineTokens(l)};return i.state.inLink=!1,n}function mn(e,t,r){let i=e.match(r.other.indentCodeCompensation);if(i===null)return t;let s=i[1];return t.split(`
`).map(o=>{let a=o.match(r.other.beginningSpace);if(a===null)return o;let[l]=a;return l.length>=s.length?o.slice(s.length):o}).join(`
`)}var Xt=class{constructor(e){z(this,"options");z(this,"rules");z(this,"lexer");this.options=e||Me}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let r=this.options.pedantic?t[0]:Rs(t[0]),i=r.replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:r,codeBlockStyle:"indented",text:i}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let r=t[0],i=mn(r,t[3]||"",this.rules);return{type:"code",raw:r,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:i}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let r=t[2].trim();if(this.rules.other.endingHash.test(r)){let i=he(r,"#");(this.options.pedantic||!i||this.rules.other.endingSpaceChar.test(i))&&(r=i.trim())}return{type:"heading",raw:he(t[0],`
`),depth:t[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:he(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let r=he(t[0],`
`).split(`
`),i="",s="",o=[];for(;r.length>0;){let a=!1,l=[],n;for(n=0;n<r.length;n++)if(this.rules.other.blockquoteStart.test(r[n]))l.push(r[n]),a=!0;else if(!a)l.push(r[n]);else break;r=r.slice(n);let u=l.join(`
`),h=u.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");i=i?`${i}
${u}`:u,s=s?`${s}
${h}`:h;let b=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(h,o,!0),this.lexer.state.top=b,r.length===0)break;let x=o.at(-1);if((x==null?void 0:x.type)==="code")break;if((x==null?void 0:x.type)==="blockquote"){let S=x,v=S.raw+`
`+r.join(`
`),G=this.blockquote(v);o[o.length-1]=G,i=i.substring(0,i.length-S.raw.length)+G.raw,s=s.substring(0,s.length-S.text.length)+G.text;break}else if((x==null?void 0:x.type)==="list"){let S=x,v=S.raw+`
`+r.join(`
`),G=this.list(v);o[o.length-1]=G,i=i.substring(0,i.length-x.raw.length)+G.raw,s=s.substring(0,s.length-S.raw.length)+G.raw,r=v.substring(o.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:i,tokens:o,text:s}}}list(e){let t=this.rules.block.list.exec(e);if(t){let r=t[1].trim(),i=r.length>1,s={type:"list",raw:"",ordered:i,start:i?+r.slice(0,-1):"",loose:!1,items:[]};r=i?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=i?r:"[*+-]");let o=this.rules.other.listItemRegex(r),a=!1;for(;e;){let n=!1,u="",h="";if(!(t=o.exec(e))||this.rules.block.hr.test(e))break;u=t[0],e=e.substring(u.length);let b=bn(t[2].split(`
`,1)[0],t[1].length),x=e.split(`
`,1)[0],S=!b.trim(),v=0;if(this.options.pedantic?(v=2,h=b.trimStart()):S?v=t[1].length+1:(v=b.search(this.rules.other.nonSpaceChar),v=v>4?1:v,h=b.slice(v),v+=t[1].length),S&&this.rules.other.blankLine.test(x)&&(u+=x+`
`,e=e.substring(x.length+1),n=!0),!n){let G=this.rules.other.nextBulletRegex(v),I=this.rules.other.hrRegex(v),Tt=this.rules.other.fencesBeginRegex(v),xe=this.rules.other.headingBeginRegex(v),cr=this.rules.other.htmlBeginRegex(v),Li=this.rules.other.blockquoteBeginRegex(v);for(;e;){let dr=e.split(`
`,1)[0],tt;if(x=dr,this.options.pedantic?(x=x.replace(this.rules.other.listReplaceNesting,"  "),tt=x):tt=x.replace(this.rules.other.tabCharGlobal,"    "),Tt.test(x)||xe.test(x)||cr.test(x)||Li.test(x)||G.test(x)||I.test(x))break;if(tt.search(this.rules.other.nonSpaceChar)>=v||!x.trim())h+=`
`+tt.slice(v);else{if(S||b.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||Tt.test(b)||xe.test(b)||I.test(b))break;h+=`
`+x}S=!x.trim(),u+=dr+`
`,e=e.substring(dr.length+1),b=tt.slice(v)}}s.loose||(a?s.loose=!0:this.rules.other.doubleBlankLine.test(u)&&(a=!0)),s.items.push({type:"list_item",raw:u,task:!!this.options.gfm&&this.rules.other.listIsTask.test(h),loose:!1,text:h,tokens:[]}),s.raw+=u}let l=s.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;s.raw=s.raw.trimEnd();for(let n of s.items){this.lexer.state.top=!1,n.tokens=this.lexer.blockTokens(n.text,[]);let u=n.tokens[0];if(n.task&&((u==null?void 0:u.type)==="text"||(u==null?void 0:u.type)==="paragraph")){n.text=n.text.replace(this.rules.other.listReplaceTask,""),u.raw=u.raw.replace(this.rules.other.listReplaceTask,""),u.text=u.text.replace(this.rules.other.listReplaceTask,"");for(let b=this.lexer.inlineQueue.length-1;b>=0;b--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[b].src)){this.lexer.inlineQueue[b].src=this.lexer.inlineQueue[b].src.replace(this.rules.other.listReplaceTask,"");break}let h=this.rules.other.listTaskCheckbox.exec(n.raw);if(h){let b={type:"checkbox",raw:h[0]+" ",checked:h[0]!=="[ ]"};n.checked=b.checked,s.loose?n.tokens[0]&&["paragraph","text"].includes(n.tokens[0].type)&&"tokens"in n.tokens[0]&&n.tokens[0].tokens?(n.tokens[0].raw=b.raw+n.tokens[0].raw,n.tokens[0].text=b.raw+n.tokens[0].text,n.tokens[0].tokens.unshift(b)):n.tokens.unshift({type:"paragraph",raw:b.raw,text:b.raw,tokens:[b]}):n.tokens.unshift(b)}}else n.task&&(n.task=!1);if(!s.loose){let h=n.tokens.filter(x=>x.type==="space"),b=h.length>0&&h.some(x=>this.rules.other.anyLine.test(x.raw));s.loose=b}}if(s.loose)for(let n of s.items){n.loose=!0;for(let u of n.tokens)u.type==="text"&&(u.type="paragraph")}return s}}html(e){let t=this.rules.block.html.exec(e);if(t){let r=Rs(t[0]);return{type:"html",block:!0,raw:r,pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:r}}}def(e){let t=this.rules.block.def.exec(e);if(t){let r=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),i=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:r,raw:he(t[0],`
`),href:i,title:s}}}table(e){var a;let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let r=Is(t[1]),i=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),s=(a=t[3])!=null&&a.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],o={type:"table",raw:he(t[0],`
`),header:[],align:[],rows:[]};if(r.length===i.length){for(let l of i)this.rules.other.tableAlignRight.test(l)?o.align.push("right"):this.rules.other.tableAlignCenter.test(l)?o.align.push("center"):this.rules.other.tableAlignLeft.test(l)?o.align.push("left"):o.align.push(null);for(let l=0;l<r.length;l++)o.header.push({text:r[l],tokens:this.lexer.inline(r[l]),header:!0,align:o.align[l]});for(let l of s)o.rows.push(Is(l,o.header.length).map((n,u)=>({text:n,tokens:this.lexer.inline(n),header:!1,align:o.align[u]})));return o}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t){let r=t[1].trim();return{type:"heading",raw:he(t[0],`
`),depth:t[2].charAt(0)==="="?1:2,text:r,tokens:this.lexer.inline(r)}}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let r=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:r,tokens:this.lexer.inline(r)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let r=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let o=he(r.slice(0,-1),"\\");if((r.length-o.length)%2===0)return}else{let o=fn(t[2],"()");if(o===-2)return;if(o>-1){let a=(t[0].indexOf("!")===0?5:4)+t[1].length+o;t[2]=t[2].substring(0,o),t[0]=t[0].substring(0,a).trim(),t[3]=""}}let i=t[2],s="";if(this.options.pedantic){let o=this.rules.other.pedanticHrefTitle.exec(i);o&&(i=o[1],s=o[3])}else s=t[3]?t[3].slice(1,-1):"";return i=i.trim(),this.rules.other.startAngleBracket.test(i)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?i=i.slice(1):i=i.slice(1,-1)),Ls(t,{href:i&&i.replace(this.rules.inline.anyPunctuation,"$1"),title:s&&s.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let r;if((r=this.rules.inline.reflink.exec(e))||(r=this.rules.inline.nolink.exec(e))){let i=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),s=t[i.toLowerCase()];if(!s){let o=r[0].charAt(0);return{type:"text",raw:o,text:o}}return Ls(r,s,r[0],this.lexer,this.rules)}}emStrong(e,t,r=""){let i=this.rules.inline.emStrongLDelim.exec(e);if(!(!i||!i[1]&&!i[2]&&!i[3]&&!i[4]||i[4]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(i[1]||i[3])||!r||this.rules.inline.punctuation.exec(r))){let s=[...i[0]].length-1,o,a,l=s,n=0,u=i[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(u.lastIndex=0,t=t.slice(-1*e.length+s);(i=u.exec(t))!==null;){if(o=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!o)continue;if(a=[...o].length,i[3]||i[4]){l+=a;continue}else if((i[5]||i[6])&&s%3&&!((s+a)%3)){n+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l+n);let h=[...i[0]][0].length,b=e.slice(0,s+i.index+h+a);if(Math.min(s,a)%2){let S=b.slice(1,-1);return{type:"em",raw:b,text:S,tokens:this.lexer.inlineTokens(S)}}let x=b.slice(2,-2);return{type:"strong",raw:b,text:x,tokens:this.lexer.inlineTokens(x)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let r=t[2].replace(this.rules.other.newLineCharGlobal," "),i=this.rules.other.nonSpaceChar.test(r),s=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return i&&s&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:t[0],text:r}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e,t,r=""){let i=this.rules.inline.delLDelim.exec(e);if(i&&(!i[1]||!r||this.rules.inline.punctuation.exec(r))){let s=[...i[0]].length-1,o,a,l=s,n=this.rules.inline.delRDelim;for(n.lastIndex=0,t=t.slice(-1*e.length+s);(i=n.exec(t))!==null;){if(o=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!o||(a=[...o].length,a!==s))continue;if(i[3]||i[4]){l+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l);let u=[...i[0]][0].length,h=e.slice(0,s+i.index+u+a),b=h.slice(s,-s);return{type:"del",raw:h,text:b,tokens:this.lexer.inlineTokens(b)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let r,i;return t[2]==="@"?(r=t[1],i="mailto:"+r):(r=t[1],i=r),{type:"link",raw:t[0],text:r,href:i,tokens:[{type:"text",raw:r,text:r}]}}}url(e){var r;let t;if(t=this.rules.inline.url.exec(e)){let i,s;if(t[2]==="@")i=t[0],s="mailto:"+i;else{let o;do o=t[0],t[0]=((r=this.rules.inline._backpedal.exec(t[0]))==null?void 0:r[0])??"";while(o!==t[0]);i=t[0],t[1]==="www."?s="http://"+t[0]:s=t[0]}return{type:"link",raw:t[0],text:i,href:s,tokens:[{type:"text",raw:i,text:i}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let r=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:r}}}},te=class Pr{constructor(t){z(this,"tokens");z(this,"options");z(this,"state");z(this,"inlineQueue");z(this,"tokenizer");this.tokens=[],this.tokens.links=Object.create(null),this.options=t||Me,this.options.tokenizer=this.options.tokenizer||new Xt,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:F,block:Ot.normal,inline:lt.normal};this.options.pedantic?(r.block=Ot.pedantic,r.inline=lt.pedantic):this.options.gfm&&(r.block=Ot.gfm,this.options.breaks?r.inline=lt.breaks:r.inline=lt.gfm),this.tokenizer.rules=r}static get rules(){return{block:Ot,inline:lt}}static lex(t,r){return new Pr(r).lex(t)}static lexInline(t,r){return new Pr(r).inlineTokens(t)}lex(t){t=t.replace(F.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let i=this.inlineQueue[r];this.inlineTokens(i.src,i.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,r=[],i=!1){var o,a,l;this.tokenizer.lexer=this,this.options.pedantic&&(t=t.replace(F.tabCharGlobal,"    ").replace(F.spaceLine,""));let s=1/0;for(;t;){if(t.length<s)s=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}let n;if((a=(o=this.options.extensions)==null?void 0:o.block)!=null&&a.some(h=>(n=h.call({lexer:this},t,r))?(t=t.substring(n.raw.length),r.push(n),!0):!1))continue;if(n=this.tokenizer.space(t)){t=t.substring(n.raw.length);let h=r.at(-1);n.raw.length===1&&h!==void 0?h.raw+=`
`:r.push(n);continue}if(n=this.tokenizer.code(t)){t=t.substring(n.raw.length);let h=r.at(-1);(h==null?void 0:h.type)==="paragraph"||(h==null?void 0:h.type)==="text"?(h.raw+=(h.raw.endsWith(`
`)?"":`
`)+n.raw,h.text+=`
`+n.text,this.inlineQueue.at(-1).src=h.text):r.push(n);continue}if(n=this.tokenizer.fences(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.heading(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.hr(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.blockquote(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.list(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.html(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.def(t)){t=t.substring(n.raw.length);let h=r.at(-1);(h==null?void 0:h.type)==="paragraph"||(h==null?void 0:h.type)==="text"?(h.raw+=(h.raw.endsWith(`
`)?"":`
`)+n.raw,h.text+=`
`+n.raw,this.inlineQueue.at(-1).src=h.text):this.tokens.links[n.tag]||(this.tokens.links[n.tag]={href:n.href,title:n.title},r.push(n));continue}if(n=this.tokenizer.table(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.lheading(t)){t=t.substring(n.raw.length),r.push(n);continue}let u=t;if((l=this.options.extensions)!=null&&l.startBlock){let h=1/0,b=t.slice(1),x;this.options.extensions.startBlock.forEach(S=>{x=S.call({lexer:this},b),typeof x=="number"&&x>=0&&(h=Math.min(h,x))}),h<1/0&&h>=0&&(u=t.substring(0,h+1))}if(this.state.top&&(n=this.tokenizer.paragraph(u))){let h=r.at(-1);i&&(h==null?void 0:h.type)==="paragraph"?(h.raw+=(h.raw.endsWith(`
`)?"":`
`)+n.raw,h.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=h.text):r.push(n),i=u.length!==t.length,t=t.substring(n.raw.length);continue}if(n=this.tokenizer.text(t)){t=t.substring(n.raw.length);let h=r.at(-1);(h==null?void 0:h.type)==="text"?(h.raw+=(h.raw.endsWith(`
`)?"":`
`)+n.raw,h.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=h.text):r.push(n);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return this.state.top=!0,r}inline(t,r=[]){return this.inlineQueue.push({src:t,tokens:r}),r}inlineTokens(t,r=[]){var u,h,b,x,S;this.tokenizer.lexer=this;let i=t,s=null;if(this.tokens.links){let v=Object.keys(this.tokens.links);if(v.length>0)for(;(s=this.tokenizer.rules.inline.reflinkSearch.exec(i))!==null;)v.includes(s[0].slice(s[0].lastIndexOf("[")+1,-1))&&(i=i.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(s=this.tokenizer.rules.inline.anyPunctuation.exec(i))!==null;)i=i.slice(0,s.index)+"++"+i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let o;for(;(s=this.tokenizer.rules.inline.blockSkip.exec(i))!==null;)o=s[2]?s[2].length:0,i=i.slice(0,s.index+o)+"["+"a".repeat(s[0].length-o-2)+"]"+i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);i=((h=(u=this.options.hooks)==null?void 0:u.emStrongMask)==null?void 0:h.call({lexer:this},i))??i;let a=!1,l="",n=1/0;for(;t;){if(t.length<n)n=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}a||(l=""),a=!1;let v;if((x=(b=this.options.extensions)==null?void 0:b.inline)!=null&&x.some(I=>(v=I.call({lexer:this},t,r))?(t=t.substring(v.raw.length),r.push(v),!0):!1))continue;if(v=this.tokenizer.escape(t)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.tag(t)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.link(t)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(v.raw.length);let I=r.at(-1);v.type==="text"&&(I==null?void 0:I.type)==="text"?(I.raw+=v.raw,I.text+=v.text):r.push(v);continue}if(v=this.tokenizer.emStrong(t,i,l)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.codespan(t)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.br(t)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.del(t,i,l)){t=t.substring(v.raw.length),r.push(v);continue}if(v=this.tokenizer.autolink(t)){t=t.substring(v.raw.length),r.push(v);continue}if(!this.state.inLink&&(v=this.tokenizer.url(t))){t=t.substring(v.raw.length),r.push(v);continue}let G=t;if((S=this.options.extensions)!=null&&S.startInline){let I=1/0,Tt=t.slice(1),xe;this.options.extensions.startInline.forEach(cr=>{xe=cr.call({lexer:this},Tt),typeof xe=="number"&&xe>=0&&(I=Math.min(I,xe))}),I<1/0&&I>=0&&(G=t.substring(0,I+1))}if(v=this.tokenizer.inlineText(G)){t=t.substring(v.raw.length),v.raw.slice(-1)!=="_"&&(l=v.raw.slice(-1)),a=!0;let I=r.at(-1);(I==null?void 0:I.type)==="text"?(I.raw+=v.raw,I.text+=v.text):r.push(v);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return r}infiniteLoopError(t){let r="Infinite loop on byte: "+t;if(this.options.silent)console.error(r);else throw new Error(r)}},Kt=class{constructor(e){z(this,"options");z(this,"parser");this.options=e||Me}space(e){return""}code({text:e,lang:t,escaped:r}){var o;let i=(o=(t||"").match(F.notSpaceStart))==null?void 0:o[0],s=e.replace(F.endingNewline,"")+`
`;return i?'<pre><code class="language-'+ne(i)+'">'+(r?s:ne(s,!0))+`</code></pre>
`:"<pre><code>"+(r?s:ne(s,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return""}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,r=e.start,i="";for(let a=0;a<e.items.length;a++){let l=e.items[a];i+=this.listitem(l)}let s=t?"ol":"ul",o=t&&r!==1?' start="'+r+'"':"";return"<"+s+o+`>
`+i+"</"+s+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",r="";for(let s=0;s<e.header.length;s++)r+=this.tablecell(e.header[s]);t+=this.tablerow({text:r});let i="";for(let s=0;s<e.rows.length;s++){let o=e.rows[s];r="";for(let a=0;a<o.length;a++)r+=this.tablecell(o[a]);i+=this.tablerow({text:r})}return i&&(i=`<tbody>${i}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+i+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),r=e.header?"th":"td";return(e.align?`<${r} align="${e.align}">`:`<${r}>`)+t+`</${r}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${ne(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:r}){let i=this.parser.parseInline(r),s=Os(e);if(s===null)return i;e=s;let o='<a href="'+e+'"';return t&&(o+=' title="'+ne(t)+'"'),o+=">"+i+"</a>",o}image({href:e,title:t,text:r,tokens:i}){i&&(r=this.parser.parseInline(i,this.parser.textRenderer));let s=Os(e);if(s===null)return ne(r);e=s;let o=`<img src="${e}" alt="${ne(r)}"`;return t&&(o+=` title="${ne(t)}"`),o+=">",o}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:ne(e.text)}},Jr=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}checkbox({raw:e}){return e}},re=class Ar{constructor(t){z(this,"options");z(this,"renderer");z(this,"textRenderer");this.options=t||Me,this.options.renderer=this.options.renderer||new Kt,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Jr}static parse(t,r){return new Ar(r).parse(t)}static parseInline(t,r){return new Ar(r).parseInline(t)}parse(t){var i,s;this.renderer.parser=this;let r="";for(let o=0;o<t.length;o++){let a=t[o];if((s=(i=this.options.extensions)==null?void 0:i.renderers)!=null&&s[a.type]){let n=a,u=this.options.extensions.renderers[n.type].call({parser:this},n);if(u!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(n.type)){r+=u||"";continue}}let l=a;switch(l.type){case"space":{r+=this.renderer.space(l);break}case"hr":{r+=this.renderer.hr(l);break}case"heading":{r+=this.renderer.heading(l);break}case"code":{r+=this.renderer.code(l);break}case"table":{r+=this.renderer.table(l);break}case"blockquote":{r+=this.renderer.blockquote(l);break}case"list":{r+=this.renderer.list(l);break}case"checkbox":{r+=this.renderer.checkbox(l);break}case"html":{r+=this.renderer.html(l);break}case"def":{r+=this.renderer.def(l);break}case"paragraph":{r+=this.renderer.paragraph(l);break}case"text":{r+=this.renderer.text(l);break}default:{let n='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(n),"";throw new Error(n)}}}return r}parseInline(t,r=this.renderer){var s,o;this.renderer.parser=this;let i="";for(let a=0;a<t.length;a++){let l=t[a];if((o=(s=this.options.extensions)==null?void 0:s.renderers)!=null&&o[l.type]){let u=this.options.extensions.renderers[l.type].call({parser:this},l);if(u!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(l.type)){i+=u||"";continue}}let n=l;switch(n.type){case"escape":{i+=r.text(n);break}case"html":{i+=r.html(n);break}case"link":{i+=r.link(n);break}case"image":{i+=r.image(n);break}case"checkbox":{i+=r.checkbox(n);break}case"strong":{i+=r.strong(n);break}case"em":{i+=r.em(n);break}case"codespan":{i+=r.codespan(n);break}case"br":{i+=r.br(n);break}case"del":{i+=r.del(n);break}case"text":{i+=r.text(n);break}default:{let u='Token with "'+n.type+'" type was not found.';if(this.options.silent)return console.error(u),"";throw new Error(u)}}}return i}},It,dt=(It=class{constructor(e){z(this,"options");z(this,"block");this.options=e||Me}preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(e=this.block){return e?te.lex:te.lexInline}provideParser(e=this.block){return e?re.parse:re.parseInline}},z(It,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens","emStrongMask"])),z(It,"passThroughHooksRespectAsync",new Set(["preprocess","postprocess","processAllTokens"])),It),vn=class{constructor(...e){z(this,"defaults",qr());z(this,"options",this.setOptions);z(this,"parse",this.parseMarkdown(!0));z(this,"parseInline",this.parseMarkdown(!1));z(this,"Parser",re);z(this,"Renderer",Kt);z(this,"TextRenderer",Jr);z(this,"Lexer",te);z(this,"Tokenizer",Xt);z(this,"Hooks",dt);this.use(...e)}walkTokens(e,t){var i,s;let r=[];for(let o of e)switch(r=r.concat(t.call(this,o)),o.type){case"table":{let a=o;for(let l of a.header)r=r.concat(this.walkTokens(l.tokens,t));for(let l of a.rows)for(let n of l)r=r.concat(this.walkTokens(n.tokens,t));break}case"list":{let a=o;r=r.concat(this.walkTokens(a.items,t));break}default:{let a=o;(s=(i=this.defaults.extensions)==null?void 0:i.childTokens)!=null&&s[a.type]?this.defaults.extensions.childTokens[a.type].forEach(l=>{let n=a[l].flat(1/0);r=r.concat(this.walkTokens(n,t))}):a.tokens&&(r=r.concat(this.walkTokens(a.tokens,t)))}}return r}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(r=>{let i={...r};if(i.async=this.defaults.async||i.async||!1,r.extensions&&(r.extensions.forEach(s=>{if(!s.name)throw new Error("extension name required");if("renderer"in s){let o=t.renderers[s.name];o?t.renderers[s.name]=function(...a){let l=s.renderer.apply(this,a);return l===!1&&(l=o.apply(this,a)),l}:t.renderers[s.name]=s.renderer}if("tokenizer"in s){if(!s.level||s.level!=="block"&&s.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let o=t[s.level];o?o.unshift(s.tokenizer):t[s.level]=[s.tokenizer],s.start&&(s.level==="block"?t.startBlock?t.startBlock.push(s.start):t.startBlock=[s.start]:s.level==="inline"&&(t.startInline?t.startInline.push(s.start):t.startInline=[s.start]))}"childTokens"in s&&s.childTokens&&(t.childTokens[s.name]=s.childTokens)}),i.extensions=t),r.renderer){let s=this.defaults.renderer||new Kt(this.defaults);for(let o in r.renderer){if(!(o in s))throw new Error(`renderer '${o}' does not exist`);if(["options","parser"].includes(o))continue;let a=o,l=r.renderer[a],n=s[a];s[a]=(...u)=>{let h=l.apply(s,u);return h===!1&&(h=n.apply(s,u)),h||""}}i.renderer=s}if(r.tokenizer){let s=this.defaults.tokenizer||new Xt(this.defaults);for(let o in r.tokenizer){if(!(o in s))throw new Error(`tokenizer '${o}' does not exist`);if(["options","rules","lexer"].includes(o))continue;let a=o,l=r.tokenizer[a],n=s[a];s[a]=(...u)=>{let h=l.apply(s,u);return h===!1&&(h=n.apply(s,u)),h}}i.tokenizer=s}if(r.hooks){let s=this.defaults.hooks||new dt;for(let o in r.hooks){if(!(o in s))throw new Error(`hook '${o}' does not exist`);if(["options","block"].includes(o))continue;let a=o,l=r.hooks[a],n=s[a];dt.passThroughHooks.has(o)?s[a]=u=>{if(this.defaults.async&&dt.passThroughHooksRespectAsync.has(o))return(async()=>{let b=await l.call(s,u);return n.call(s,b)})();let h=l.call(s,u);return n.call(s,h)}:s[a]=(...u)=>{if(this.defaults.async)return(async()=>{let b=await l.apply(s,u);return b===!1&&(b=await n.apply(s,u)),b})();let h=l.apply(s,u);return h===!1&&(h=n.apply(s,u)),h}}i.hooks=s}if(r.walkTokens){let s=this.defaults.walkTokens,o=r.walkTokens;i.walkTokens=function(a){let l=[];return l.push(o.call(this,a)),s&&(l=l.concat(s.call(this,a))),l}}this.defaults={...this.defaults,...i}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return te.lex(e,t??this.defaults)}parser(e,t){return re.parse(e,t??this.defaults)}parseMarkdown(e){return(t,r)=>{let i={...r},s={...this.defaults,...i},o=this.onError(!!s.silent,!!s.async);if(this.defaults.async===!0&&i.async===!1)return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof t>"u"||t===null)return o(new Error("marked(): input parameter is undefined or null"));if(typeof t!="string")return o(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));if(s.hooks&&(s.hooks.options=s,s.hooks.block=e),s.async)return(async()=>{let a=s.hooks?await s.hooks.preprocess(t):t,l=await(s.hooks?await s.hooks.provideLexer(e):e?te.lex:te.lexInline)(a,s),n=s.hooks?await s.hooks.processAllTokens(l):l;s.walkTokens&&await Promise.all(this.walkTokens(n,s.walkTokens));let u=await(s.hooks?await s.hooks.provideParser(e):e?re.parse:re.parseInline)(n,s);return s.hooks?await s.hooks.postprocess(u):u})().catch(o);try{s.hooks&&(t=s.hooks.preprocess(t));let a=(s.hooks?s.hooks.provideLexer(e):e?te.lex:te.lexInline)(t,s);s.hooks&&(a=s.hooks.processAllTokens(a)),s.walkTokens&&this.walkTokens(a,s.walkTokens);let l=(s.hooks?s.hooks.provideParser(e):e?re.parse:re.parseInline)(a,s);return s.hooks&&(l=s.hooks.postprocess(l)),l}catch(a){return o(a)}}}onError(e,t){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let i="<p>An error occurred:</p><pre>"+ne(r.message+"",!0)+"</pre>";return t?Promise.resolve(i):i}if(t)return Promise.reject(r);throw r}}},De=new vn;function T(e,t){return De.parse(e,t)}T.options=T.setOptions=function(e){return De.setOptions(e),T.defaults=De.defaults,vi(T.defaults),T};T.getDefaults=qr;T.defaults=Me;T.use=function(...e){return De.use(...e),T.defaults=De.defaults,vi(T.defaults),T};T.walkTokens=function(e,t){return De.walkTokens(e,t)};T.parseInline=De.parseInline;T.Parser=re;T.parser=re.parse;T.Renderer=Kt;T.TextRenderer=Jr;T.Lexer=te;T.lexer=te.lex;T.Tokenizer=Xt;T.Hooks=dt;T.parse=T;T.options;T.setOptions;T.use;T.walkTokens;T.parseInline;re.parse;te.lex;var gn=Object.defineProperty,xn=Object.getOwnPropertyDescriptor,es=(e,t,r,i)=>{for(var s=i>1?void 0:i?xn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&gn(t,r,s),s};let gt=class extends ${constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}_renderSnippet(){var r;const e=((r=this.result)==null?void 0:r.snippet)??"";if(!e)return null;const t=T.parse(e,{async:!1});return c`<div class="snippet" .innerHTML=${t}></div>`}render(){if(!this.result)return null;const e=Math.round(this.result.score*100);return c`
      <div class="path">
        ${this.result.kind==="path"?c`<span class="badge">路径</span>`:null}
        ${this.result.path}${this.result.line?`:${this.result.line}`:""}
      </div>
      ${this._renderSnippet()}
      <div class="score">评分: ${e}%</div>
    `}};gt.styles=_`
    :host {
      display: block;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    :host([active]) {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
    }
    :host(:hover) { border-color: var(--cortex-primary); }
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
      border-radius: 4px;
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
      border-radius: 2px;
    }
    .snippet pre {
      background: var(--cortex-surface-muted);
      padding: 6px 8px;
      border-radius: 4px;
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
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      margin-top: 4px;
    }
    mark {
      background: #FEF3C7;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
  `;es([d({attribute:!1})],gt.prototype,"result",2);es([d({type:Boolean,reflect:!0})],gt.prototype,"active",2);gt=es([A("result-card")],gt);var _n=Object.defineProperty,yn=Object.getOwnPropertyDescriptor,sr=(e,t,r,i)=>{for(var s=i>1?void 0:i?yn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&_n(t,r,s),s};let qe=class extends ${constructor(){super(...arguments),this.results=[],this.activeResult=null,this.loading=!1}render(){return c`
      <div class="list-pane">
        ${this.loading&&this.results.length===0?c`<div class="loading">搜索中</div>`:this.results.length===0?c`<div class="empty">无搜索结果</div>`:this.results.map(e=>c`
                <result-card
                  .result=${e}
                  ?active=${this.activeResult===e}>
                </result-card>`)}
      </div>
    `}};qe.styles=_`
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
      color: var(--cortex-text-subtle);
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
  `;sr([d({attribute:!1})],qe.prototype,"results",2);sr([d({attribute:!1})],qe.prototype,"activeResult",2);sr([d({type:Boolean})],qe.prototype,"loading",2);qe=sr([A("search-results")],qe);var wn=Object.defineProperty,kn=Object.getOwnPropertyDescriptor,Ct=(e,t,r,i)=>{for(var s=i>1?void 0:i?kn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&wn(t,r,s),s};let ht="",Tr=0,Yt=0;function ct(e){if(!e)return 0;const t=ht.indexOf(e,Tr);if(t===-1){const i=ht.indexOf(e);return i===-1?0:(ht.slice(0,i).match(/\n/g)??[]).length+1+Yt}const r=(ht.slice(0,t).match(/\n/g)??[]).length+1;return Tr=t+e.length,r+Yt}function Ms(e){return e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}const $n={heading(e){const t=this.parser.parseInline(e.tokens),r=ct(e.raw);return`<h${e.depth} data-source-line="${r}">${t}</h${e.depth}>
`},paragraph(e){const t=this.parser.parseInline(e.tokens);return`<p data-source-line="${ct(e.raw)}">${t}</p>
`},code(e){const t=ct(e.raw),r=Ms(e.text),i=e.lang?` class="language-${Ms(e.lang)}"`:"";return`<pre data-source-line="${t}"><code${i}>${r}</code></pre>
`},list(e){const t=ct(e.raw);let r="";for(const o of e.items)r+=this.listitem(o);const i=e.ordered?"ol":"ul",s=e.ordered&&e.start!==1?` start="${e.start}"`:"";return`<${i}${s} data-source-line="${t}">
${r}</${i}>
`},blockquote(e){const t=ct(e.raw),r=this.parser.parse(e.tokens);return`<blockquote data-source-line="${t}">
${r}</blockquote>
`}};let Fs=!1;function Sn(){Fs||(Fs=!0,T.use({hooks:{preprocess(e){return ht=e,Tr=0,e}},renderer:$n}))}let ze=class extends ${constructor(){super(...arguments),this.content="",this.line=null,this.keyword="",this.pages=null}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("content")||e.has("keyword"))&&this._highlightKeyword(),(e.has("line")||e.has("content"))&&this._locateAndHighlight()}_locateAndHighlight(){if(this.line===null||this.line===void 0)return;const e=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));if(e.length===0)return;const t=e.reduce((i,s)=>{const o=Number(s.getAttribute("data-source-line"));return o<=this.line&&(!i||o>Number(i.getAttribute("data-source-line")))?s:i},null);if(!t)return;const r=this.getBoundingClientRect();if(r.height>0){const s=t.getBoundingClientRect().top-r.top+this.scrollTop;this.scrollTo({top:s,behavior:"smooth"})}t.classList.remove("highlight-flash"),t.offsetWidth,t.classList.add("highlight-flash")}_highlightKeyword(){var a,l;const e=(a=this.shadowRoot)==null?void 0:a.querySelector(".md-body-paged, .md-body");if(!e)return;const t=(this.keyword??"").split(/\s+/).filter(n=>n.length>0);if(t.length===0)return;const r=new RegExp(t.map(n=>this._escapeRegExp(n)).join("|"),"gi"),i=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode(n){const u=n.parentElement;if(!u)return NodeFilter.FILTER_REJECT;const h=u.tagName;return h==="SCRIPT"||h==="STYLE"||h==="MARK"?NodeFilter.FILTER_REJECT:r.test(n.nodeValue??"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),s=[];let o;for(;o=i.nextNode();)s.push(o);for(const n of s){r.lastIndex=0;const u=n.nodeValue??"",h=document.createDocumentFragment();let b=0,x;for(;(x=r.exec(u))!==null;){x.index>b&&h.appendChild(document.createTextNode(u.slice(b,x.index)));const S=document.createElement("mark");S.textContent=x[0],S.className="keyword-hit",h.appendChild(S),b=x.index+x[0].length,x[0].length===0&&r.lastIndex++}b<u.length&&h.appendChild(document.createTextNode(u.slice(b))),(l=n.parentNode)==null||l.replaceChild(h,n)}}_escapeRegExp(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}_splitByPages(e,t){const r=e.split(`
`),i=[];for(let s=0;s<t.length;s++){const o=t[s].line_start-1,a=s+1<t.length?t[s+1].line_start-1:r.length,l=r.slice(Math.max(0,o),Math.max(0,a)).join(`
`);i.push({label:t[s].label,md:l,offset:o})}return i}render(){if(Sn(),!this.content)return c`<div class="empty">无内容</div>`;if(this.pages&&this.pages.length>0){const t=this._splitByPages(this.content,this.pages);return c`<div class="md-body md-body-paged">
        ${t.map(r=>{Yt=r.offset;const i=T.parse(r.md,{async:!1});return c`
            <section class="page-card">
              <header class="page-card-header">${r.label}</header>
              <div .innerHTML=${i}></div>
            </section>
          `})}
      </div>`}Yt=0;const e=T.parse(this.content,{async:!1});return c`<div class="md-body" .innerHTML=${e}></div>`}};ze.styles=_`
    :host {
      display: block;
      padding: 12px 16px;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow: auto;
      /* 作为 preview-pane (flex column) 的 flex item，必须用 flex 填充
         而非 height: 100%。height: 100% + overflow: auto 在 iOS Safari
         中会触发 flexbox 触摸滚动 bug，导致手指滑动无法滚动内容。 */
      flex: 1 1 0;
      min-height: 0;
    }
    :host h1, :host h2, :host h3 {
      margin: 1em 0 0.5em;
      line-height: 1.3;
    }
    :host h1 { font-size: 1.4em; }
    :host h2 { font-size: 1.2em; }
    :host h3 { font-size: 1.05em; }
    :host p { margin: 0.5em 0; }
    :host ul, :host ol { margin: 0.5em 0; padding-left: 1.5em; }
    :host li { margin: 0.2em 0; }
    :host pre {
      background: var(--cortex-surface-muted);
      padding: 8px 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    :host code {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    :host blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 12px;
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
      padding: 6px 12px;
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
    .empty {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: 24px;
    }
    /* 定位块的闪烁动画（"你滚到这里了"指示）
       使用 box-shadow 而不是 background，避免和 <mark class="keyword-hit">
       的黄色背景叠加产生视觉混乱（xlsx 场景下 scrollTo 可能是 mark）。 */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { box-shadow: 0 0 0 4px rgba(254, 243, 199, 1); }
      100% { box-shadow: 0 0 0 4px transparent; }
    }
    /* 搜索关键字命中高亮（持久黄底，类似浏览器 Ctrl+F） */
    :host mark.keyword-hit {
      background: #FEF3C7;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
    /* 分页卡片 */
    .page-card {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
      margin: 16px 8px;
      padding: 14px 20px;
    }
    .page-card-header {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      font-weight: 500;
      letter-spacing: 0.02em;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--cortex-border);
    }
    /* 卡片内部标题更紧凑 */
    .page-card h1, .page-card h2, .page-card h3 {
      margin-top: 0.5em;
    }
  `;Ct([d()],ze.prototype,"content",2);Ct([d({type:Number})],ze.prototype,"line",2);Ct([d()],ze.prototype,"keyword",2);Ct([d({attribute:!1})],ze.prototype,"pages",2);ze=Ct([A("md-viewer")],ze);var En=Object.defineProperty,Cn=Object.getOwnPropertyDescriptor,Fe=(e,t,r,i)=>{for(var s=i>1?void 0:i?Cn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&En(t,r,s),s};let de=class extends ${constructor(){super(...arguments),this.path="",this.originalContent="",this.mobile=!1,this._text="",this._dirty=!1,this._error=null,this._onSaveClick=()=>{this._dirty&&this._emitSave()},this._onCancelClick=()=>{this.discard()}}willUpdate(e){e.has("originalContent")&&(this._text=this.originalContent,this._dirty=!1,this._error=null)}get _lineCount(){return this._text===""?1:(this._text.match(/\n/g)??[]).length+1}_onInput(e){const t=e.target;this._text=t.value,this._error=null,this._updateDirty()}_onScroll(e){const t=e.target,r=this.shadowRoot.querySelector(".line-col");r&&(r.scrollTop=t.scrollTop)}_onKeyDown(e){(e.ctrlKey||e.metaKey)&&e.key==="s"&&(e.preventDefault(),this._dirty&&this._emitSave())}_updateDirty(){const e=this._text!==this.originalContent;e!==this._dirty&&(this._dirty=e,this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:e}})))}_emitSave(){this.dispatchEvent(new CustomEvent("save",{detail:{content:this._text}}))}discard(){this._text=this.originalContent,this._dirty=!1,this._error=null,this._updateDirty(),this.dispatchEvent(new CustomEvent("cancel",{}))}setError(e){this._error=e}render(){const e=[];for(let t=1;t<=this._lineCount;t++)e.push(t);return c`
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
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .toolbar .path {
      flex: 1;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    .toolbar .dirty {
      color: #d97706;
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
    }
    .toolbar .error-msg {
      color: #dc2626;
      font-size: var(--cortex-fs-sm);
      flex: 1;
    }
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.save-btn {
      background: var(--cortex-primary);
      color: #fff;
      border-color: var(--cortex-primary);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .line-col {
      flex-shrink: 0;
      padding: 8px 6px 8px 0;
      text-align: right;
      color: var(--cortex-text-subtle);
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
      padding: 8px 12px;
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      background: var(--cortex-surface);
      color: inherit;
      white-space: pre;
      overflow: auto;
    }
  `;Fe([d()],de.prototype,"path",2);Fe([d()],de.prototype,"originalContent",2);Fe([d({type:Boolean})],de.prototype,"mobile",2);Fe([m()],de.prototype,"_text",2);Fe([m()],de.prototype,"_dirty",2);Fe([m()],de.prototype,"_error",2);de=Fe([A("md-editor")],de);class Ci extends Error{constructor(t,r,i){super(r),this.code=t,this.status=i,this.name="PreviewSaveError"}}async function Pn(e,t){const r=await fetch(`/api/preview?path=${encodeURIComponent(e)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:t})});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new Ci(i.code??"UNKNOWN",i.detail??"保存失败",r.status)}return r.json()}class Pi extends Error{constructor(t,r,i){super(r),this.code=t,this.status=i,this.name="PreviewUploadError"}}async function An(e){const t=new FormData;t.append("file",e);const r=await fetch("/api/preview/upload",{method:"POST",body:t});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new Pi(i.code??"UNKNOWN",i.detail??"上传失败",r.status)}return r.json()}const Tn=[".md",".pdf",".docx",".xlsx",".xlsm",".xltx",".xltm",".csv"];function Dn(e){const t=e.toLowerCase();return Tn.some(r=>t.endsWith(r))}async function Ve(e){const t=new URLSearchParams({path:e});try{const r=await fetch(`/api/preview?${t}`);if(r.ok){const o=await r.json();return{ok:!0,path:o.path,content:o.content,language:o.language,writable:o.writable??!1,pages:o.pages??null,lineMap:o.line_map??null}}const i=await r.json().catch(()=>({code:"UNKNOWN",detail:""}));return{ok:!1,notIndexed:i.code==="NOT_INDEXED",message:i.detail||i.code||`HTTP ${r.status}`}}catch(r){return{ok:!1,notIndexed:!1,message:r.message||"网络错误"}}}var zn=Object.defineProperty,On=Object.getOwnPropertyDescriptor,B=(e,t,r,i)=>{for(var s=i>1?void 0:i?On(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&zn(t,r,s),s};let R=class extends ${constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1,this.line=null,this.keyword="",this.writable=!1,this.noHeader=!1,this.mobile=!1,this.pages=null,this._mode="preview",this._content="",this._showMobileMenu=!1,this._onMobileBackClick=()=>{this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=e=>{e.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=e=>{var s,o;if(!this._showMobileMenu)return;const t=e.composedPath(),r=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-menu"),i=(o=this.shadowRoot)==null?void 0:o.querySelector(".mobile-more");r&&t.includes(r)||i&&t.includes(i)||(this._showMobileMenu=!1)},this._onEditorCancel=()=>{this._mode="preview"},this._onEditorDirty=e=>{this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:e.detail.dirty}}))},this._onDownloadClick=()=>{if(!this.path)return;const e=`/api/preview/download?path=${encodeURIComponent(this.path)}`,t=document.createElement("a");t.href=e,t.rel="noopener",document.body.appendChild(t),t.click(),document.body.removeChild(t)},this._onUploadClick=()=>{var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector('input[type="file"]');e==null||e.click()}}willUpdate(e){e.has("content")&&(this._content=this.content,this._mode="preview")}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}_basename(e){if(!e)return"";const t=e.lastIndexOf("/");return t>=0?e.slice(t+1):e}_renderMobileHeader(){return c`
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
    `}enterEdit(){this._mode="edit"}async _onEditorSave(e){const t=this.shadowRoot.querySelector("md-editor");try{await Pn(this.path,e.detail.content),this._content=e.detail.content,this._mode="preview",this.dispatchEvent(new CustomEvent("saved",{detail:{content:e.detail.content}}))}catch(r){const i=r instanceof Ci?`${r.code} ${r.message}`:r.message??"保存失败";t==null||t.setError(i),this.dispatchEvent(new CustomEvent("save-failed",{detail:{message:i}}))}}discard(){const e=this.shadowRoot.querySelector("md-editor");e==null||e.discard(),this._mode="preview"}_renderDownloadBtn(){return c`<button class="download-btn" @click=${this._onDownloadClick}>⬇️ 下载</button>`}async _onFileChange(e){var s;const t=e.target,r=(s=t.files)==null?void 0:s[0];if(t.value="",!(!r||!window.confirm(`即将上传 '${r.name}' 覆盖原文件，是否继续？`)))try{const o=await An(r);this.dispatchEvent(new CustomEvent("upload-success",{detail:{path:o.path}}))}catch(o){const a=o instanceof Pi?`${o.code} ${o.message}`:o.message??"上传失败";this.dispatchEvent(new CustomEvent("upload-failed",{detail:{message:a}}))}}_renderUploadBtn(){return c`<button class="upload-btn" @click=${this._onUploadClick}>⬆️ 上传</button>`}render(){if(this.loading)return c`<div class="empty">加载中...</div>`;if(!this._content&&!this.content)return c`<div class="empty">点击左侧结果查看预览</div>`;const e=this.mobile?this._renderMobileHeader():null,t=!this.mobile&&!this.noHeader;if(this.language==="markdown"&&this._mode==="edit")return c`
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
        ${r.map((i,s)=>{const o=s+1,a=this.highlights.includes(o)?"highlight":"";return c`<div class=${a}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${o}</span>${i}</div>`})}
      </div>
    `}};R.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      padding: 10px 14px;
      border-bottom: 1px solid var(--cortex-border);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
    }
    .header .path { flex: 1; }
    .body {
      flex: 1;
      overflow: auto;
      padding: 12px 14px;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre;
    }
    .highlight { background: #fef3c7; padding: 0 2px; border-radius: 2px; }
    .html-frame {
      flex: 1;
      border: 0;
      width: 100%;
      background: white;
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
    button.edit-btn,
    button.download-btn,
    button.upload-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
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
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
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
    .mobile-header .mobile-menu button:hover {
      background: var(--cortex-surface-muted);
    }
  `;B([d()],R.prototype,"path",2);B([d()],R.prototype,"language",2);B([d()],R.prototype,"content",2);B([d({attribute:!1})],R.prototype,"highlights",2);B([d({type:Boolean})],R.prototype,"loading",2);B([d({type:Number})],R.prototype,"line",2);B([d()],R.prototype,"keyword",2);B([d({type:Boolean})],R.prototype,"writable",2);B([d({type:Boolean})],R.prototype,"noHeader",2);B([d({type:Boolean})],R.prototype,"mobile",2);B([d({attribute:!1})],R.prototype,"pages",2);B([m()],R.prototype,"_mode",2);B([m()],R.prototype,"_content",2);B([m()],R.prototype,"_showMobileMenu",2);R=B([A("preview-pane")],R);var In=Object.defineProperty,Rn=Object.getOwnPropertyDescriptor,ir=(e,t,r,i)=>{for(var s=i>1?void 0:i?Rn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&In(t,r,s),s};let Xe=class extends ${constructor(){super(...arguments),this.role="user",this.message=null,this.error=null,this._onClick=e=>{const t=e.composedPath().find(i=>i instanceof HTMLElement&&i.classList.contains("ref-link"));if(!t)return;e.preventDefault();const r=t.getAttribute("data-path")??"";this.dispatchEvent(new CustomEvent("reference-click",{detail:{path:r},bubbles:!0,composed:!0}))}}firstUpdated(){this.addEventListener("click",this._onClick)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this._onClick)}updated(e){e.has("message")&&this.role==="assistant"&&this._processReferences()}_processReferences(){const e=this.renderRoot.querySelector(".md-body");if(!e)return;const r=Array.from(e.querySelectorAll("h2")).find(s=>(s.textContent??"").includes("参考资料"));if(!r)return;let i=r.nextElementSibling;for(;i&&i.tagName!=="OL"&&i.tagName!=="UL";)i=i.nextElementSibling;i&&i.querySelectorAll("li").forEach(s=>{if(s.querySelector(".ref-link"))return;const o=(s.textContent??"").trim();if(!o)return;const a=document.createElement("a");a.className="ref-link",a.setAttribute("data-path",o),a.setAttribute("href","#"),a.textContent=o,s.textContent="",s.appendChild(a)})}renderBubble(e){if(e==="")return c`<span class="thinking">思考中...</span>`;if(this.role==="assistant"){const t=T.parse(e,{async:!1});return c`<div class="md-body" .innerHTML=${t}></div>`}return e}render(){return this.message?c`
      <div class="bubble">${this.renderBubble(this.message.content)}</div>
      ${this.error?c`<div class="error">⚠️ ${this.error}</div>`:null}
    `:null}};Xe.styles=_`
    :host {
      display: block;
      max-width: 75%;
    }
    :host([role="user"]) { align-self: flex-end; }
    :host([role="assistant"]) { align-self: flex-start; }
    .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: var(--cortex-fs-md);
      line-height: 1.5;
      word-break: break-word;
    }
    :host([role="user"]) .bubble {
      background: var(--cortex-primary);
      color: #fff;
      border-bottom-right-radius: 4px;
      /* 用户输入按纯文本展示：保留换行、不解析 markdown */
      white-space: pre-wrap;
    }
    :host([role="assistant"]) .bubble {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-bottom-left-radius: 4px;
    }
    /* assistant 回复的 markdown 渲染（紧凑气泡风格） */
    .md-body > :first-child { margin-top: 0; }
    .md-body > :last-child { margin-bottom: 0; }
    .md-body p { margin: 0.4em 0; }
    .md-body h1, .md-body h2, .md-body h3 {
      margin: 0.6em 0 0.3em;
      line-height: 1.3;
    }
    .md-body h1 { font-size: 1.2em; }
    .md-body h2 { font-size: 1.1em; }
    .md-body h3 { font-size: 1em; }
    .md-body ul, .md-body ol { margin: 0.4em 0; padding-left: 1.4em; }
    .md-body li { margin: 0.15em 0; }
    .md-body pre {
      background: var(--cortex-surface);
      padding: 8px 10px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      margin: 0.5em 0;
    }
    .md-body code {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .md-body :not(pre) > code {
      background: var(--cortex-surface);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .md-body blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 10px;
      margin: 0.4em 0;
      color: var(--cortex-text-muted);
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
      background: var(--cortex-surface);
      font-weight: 600;
    }
    .md-body .ref-link {
      color: var(--cortex-primary);
      text-decoration: underline;
      cursor: pointer;
    }
    .md-body .ref-link:hover {
      opacity: 0.8;
    }
    .thinking { opacity: 0.6; }
    .error {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
  `;ir([d({reflect:!0})],Xe.prototype,"role",2);ir([d({attribute:!1})],Xe.prototype,"message",2);ir([d()],Xe.prototype,"error",2);Xe=ir([A("chat-message")],Xe);var Ln=Object.defineProperty,Mn=Object.getOwnPropertyDescriptor,Ai=(e,t,r,i)=>{for(var s=i>1?void 0:i?Mn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Ln(t,r,s),s};let Gt=class extends ${constructor(){super(...arguments),this.messages=[]}updated(){this.scrollTop=this.scrollHeight}render(){return this.messages.length===0?c`<div class="empty">开始与 Doclens 对话</div>`:c`
      ${this.messages.map(e=>c`<chat-message role=${e.role} .message=${e}></chat-message>`)}
    `}};Gt.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      flex: 1;
      padding: var(--cortex-space-4) var(--cortex-space-6);
      overflow-y: auto;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      margin-top: var(--cortex-space-8);
    }
  `;Ai([d({attribute:!1})],Gt.prototype,"messages",2);Gt=Ai([A("chat-stream")],Gt);class Ti extends Error{constructor(t,r,i){super(i),this.status=t,this.code=r,this.name="ApiError"}}async function M(e,t={}){const r={...t};t.json!==void 0&&(r.headers={"Content-Type":"application/json",...t.headers||{}},r.body=JSON.stringify(t.json));const i=await fetch(e,r);if(!i.ok){let s;try{s=await i.json()}catch{s={code:"unknown",detail:i.statusText}}throw new Ti(i.status,s.code??"unknown",s.detail??"请求失败")}return i.json()}async function*Fn(e,t){const r=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!r.ok||!r.body)throw new Ti(r.status,"stream_failed","流式请求失败");const i=r.body.getReader(),s=new TextDecoder;let o="";for(;;){const{value:a,done:l}=await i.read();if(l)break;for(o+=s.decode(a,{stream:!0});;){const n=o.match(/\r\n\r\n|\r\r|\n\n/);if(!n||n.index===void 0)break;const u=n.index,h=n[0].length,b=o.slice(0,u);o=o.slice(u+h);let x="message",S="";for(const v of b.split(/\r\n|\r|\n/))v.startsWith("event:")?x=v.slice(6).trim():v.startsWith("data:")&&(S+=v.slice(5).trim());yield{event:x,data:S}}}}async function Ns(e){return M("/api/search",{method:"POST",json:e})}async function Ws(e){return M("/api/grep",{method:"POST",json:e})}async function Nn(e){return M("/api/sessions",{method:"POST",json:e})}async function Wn(e){return M("/api/sessions/find-or-create",{method:"POST",json:e})}async function Di(e){const t=new URLSearchParams;return e.type&&t.set("type",e.type),e.limit&&t.set("limit",String(e.limit)),e.offset&&t.set("offset",String(e.offset)),M(`/api/sessions?${t}`,{method:"GET"})}async function Hn(e,t,r){return M(`/api/sessions/${e}`,{method:"PATCH",json:{items:t,message_count:r}})}async function zi(e){const t=new URLSearchParams;return e&&t.set("type",e),M(`/api/sessions?${t}`,{method:"DELETE"})}var Bn=Object.defineProperty,Un=Object.getOwnPropertyDescriptor,Pt=(e,t,r,i)=>{for(var s=i>1?void 0:i?Un(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Bn(t,r,s),s};let Oe=class extends ${constructor(){super(...arguments),this.total=0,this.offset=0,this.limit=20,this.disabled=!1}get currentPage(){return this.limit<=0?1:Math.floor(this.offset/this.limit)+1}get totalPages(){return this.limit<=0?1:Math.max(1,Math.ceil(this.total/this.limit))}_emitPage(e){this.disabled||e<1||e>this.totalPages||this.dispatchEvent(new CustomEvent("page-change",{detail:{page:e}}))}_pageSlots(){const e=this.totalPages,t=this.currentPage;if(e<=7)return Array.from({length:e},(o,a)=>a+1);const r=[1],i=Math.max(2,t-1),s=Math.min(e-1,t+1);i>2&&r.push("...");for(let o=i;o<=s;o++)r.push(o);return s<e-1&&r.push("..."),r.push(e),r}render(){if(this.total<=this.limit)return c``;const e=this._pageSlots();return c`
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
    `}};Oe.styles=_`
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
      color: var(--cortex-text-subtle);
      text-align: center;
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
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    button.current {
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    .ellipsis {
      padding: 0 4px;
      color: var(--cortex-text-subtle);
    }
  `;Pt([d({type:Number})],Oe.prototype,"total",2);Pt([d({type:Number})],Oe.prototype,"offset",2);Pt([d({type:Number})],Oe.prototype,"limit",2);Pt([d({type:Boolean})],Oe.prototype,"disabled",2);Oe=Pt([A("pagination-bar")],Oe);var jn=Object.defineProperty,qn=Object.getOwnPropertyDescriptor,Oi=(e,t,r,i)=>{for(var s=i>1?void 0:i?qn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&jn(t,r,s),s};let Zt=class extends ${constructor(){super(...arguments),this._toasts=[],this._nextId=1,this._timers=new Map}pushToast(e,t="info",r=2500){const i=this._nextId++;if(this._toasts=[...this._toasts,{id:i,message:e,level:t,duration:r}],r>0){const s=window.setTimeout(()=>this.dismiss(i),r);this._timers.set(i,s)}}dismiss(e){const t=this._timers.get(e);t!==void 0&&(window.clearTimeout(t),this._timers.delete(e)),this._toasts=this._toasts.filter(r=>r.id!==e)}disconnectedCallback(){super.disconnectedCallback();for(const e of this._timers.values())window.clearTimeout(e);this._timers.clear()}render(){return c`
      ${this._toasts.map(e=>c`
          <div class="toast ${e.level}" @click=${()=>this.dismiss(e.id)}>
            <span class="msg">${e.message}</span>
          </div>
        `)}
    `}};Zt.styles=_`
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
      border-radius: 6px;
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .toast.success { background: #10b981; color: #fff; }
    .toast.error { background: #dc2626; color: #fff; }
    .toast.info { background: var(--cortex-surface); color: var(--cortex-text); border: 1px solid var(--cortex-border); }
    .toast .msg { flex: 1; }
  `;Oi([m()],Zt.prototype,"_toasts",2);Zt=Oi([A("toast-stack")],Zt);var Vn=Object.defineProperty,Xn=Object.getOwnPropertyDescriptor,U=(e,t,r,i)=>{for(var s=i>1?void 0:i?Xn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Vn(t,r,s),s};let C=class extends ${constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewLine=null,this.historySessions=[],this._clearing=!1,this.previewError=null,this.previewDirty=!1,this.previewWritable=!1,this.previewPages=null,this._resultsPaneWidth=C.RESULTS_PANE_WIDTH_DEFAULT,this.searchMode="keyword",this._onModeChange=e=>{this.searchMode=e.detail.mode,localStorage.setItem(C.SEARCH_MODE_KEY,e.detail.mode)},this._onSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._resultsPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=o=>{const a=o.clientX-t,l=Math.max(C.RESULTS_PANE_WIDTH_MIN,Math.min(C.RESULTS_PANE_WIDTH_MAX,r+a));l!==this._resultsPaneWidth&&(this._resultsPaneWidth=l)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(C.RESULTS_PANE_WIDTH_KEY,String(this._resultsPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPageChange=e=>{this._goToPage(e.detail.page)},this._onPreviewDirty=e=>{this.previewDirty=e.detail.dirty},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=e=>{this._pushToast(`保存失败：${e.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=e=>{this.previewDirty=!1,this._pushToast(`已覆盖：${e.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._pushToast(`上传失败：${e.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._loadResultsPaneWidth(),this._loadSearchMode();const e=f.getState().pendingSession;e&&e.type==="search"&&(g.setPendingSession(null),this._loadSession(e))}_loadResultsPaneWidth(){const e=localStorage.getItem(C.RESULTS_PANE_WIDTH_KEY);if(!e)return;const t=Number(e);Number.isNaN(t)||(this._resultsPaneWidth=Math.max(C.RESULTS_PANE_WIDTH_MIN,Math.min(C.RESULTS_PANE_WIDTH_MAX,t)))}_loadSearchMode(){const e=localStorage.getItem(C.SEARCH_MODE_KEY);(e==="keyword"||e==="grep")&&(this.searchMode=e)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await Di({type:"search",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){await this._safeAction(async()=>{this._clearing=!0,this.requestUpdate();try{await zi("search"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}})}get viewState(){return f.getState().search}async _submit(e){await this._safeAction(async()=>{const t=typeof e=="string"?e:e.detail.value;this.localQuery=t,f.setState({detailStack:[]}),this.previewContent="",this.previewPath="",this.previewError=null,this.previewPages=null,g.setSearchState({state:"focus",query:t,queryWords:[],results:[],total:0,offset:0,limit:20,source:"fts"}),this.loading=!0;try{const r=this.searchMode==="grep"?await Ws({pattern:t,offset:0,limit:20}):await Ns({query:t,offset:0,limit:20});g.setSearchState({state:"focus",query:t,queryWords:r.query_words??[],results:r.results,total:r.total,offset:0,limit:20,source:r.source}),this._autoPreviewFirstDesktop(r.results),Wn({type:"search",title:t,preview:t.slice(0,100),mode:this.searchMode==="grep"?"grep":"keyword"}).then(i=>{g.setSearchState({currentSession:{id:i.id,type:"search",title:t,preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0}}),this._loadHistory()}).catch(i=>{console.warn("find-or-create session failed",i)})}catch(r){g.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}})}async _backToInitial(){await this._safeAction(()=>{g.setSearchState({state:"initial",currentSession:null,results:[],query:"",queryWords:[]}),this.localQuery="",this._loadHistory()})}async _goToPage(e){const t=f.getState().search;if(!t.query||t.state!=="focus")return;const r=t.limit||20,i=Math.max(0,(e-1)*r);if(i!==t.offset){this.loading=!0;try{const s=this.searchMode==="grep"?await Ws({pattern:t.query,offset:i,limit:r}):await Ns({query:t.query,offset:i,limit:r});g.setSearchState({state:"focus",query:t.query,results:s.results,total:s.total,offset:s.offset,limit:r,source:s.source}),this.previewContent="",this.previewPath="",this.previewLine=null}catch(s){g.setError(`翻页失败: ${s.message}`)}finally{this.loading=!1}}}async _onResultSelect(e){await this._safeAction(async()=>{const t=e.detail.result;g.pushDetail(t),await this._fetchAndShowPreview(t)})}async _fetchAndShowPreview(e){this.previewError=null;const t=e.line??null,r=Dn(e.path);let i;t&&!r?i=await this._fetchPreviewRange(e.path,t):i=await Ve(e.path),i.ok?(this.previewContent=i.content,this.previewPath=i.path,this.previewLanguage=i.language,this.previewLine=t===null?null:i.lineMap?i.lineMap[String(t)]??null:t,this.previewWritable=i.writable,this.previewPages=i.pages):i.notIndexed&&(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=e.path,this.previewWritable=!1,this.previewPages=null)}async _fetchPreviewRange(e,t){const r=new URLSearchParams({path:e});r.set("start_line",String(Math.max(1,t-10))),r.set("end_line",String(t+20));try{const i=await fetch(`/api/preview?${r}`);if(i.ok){const o=await i.json();return{ok:!0,path:o.path,content:o.content,language:o.language,writable:o.writable??!1,pages:o.pages??null,lineMap:null}}return{ok:!1,notIndexed:(await i.json().catch(()=>({}))).code==="NOT_INDEXED"}}catch{return{ok:!1,notIndexed:!1}}}_autoPreviewFirstDesktop(e){typeof window>"u"||window.innerWidth<1024||e.length!==0&&this._fetchAndShowPreview(e[0])}_discardPreviewEdits(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=e==null?void 0:e.discard)==null||r.call(e),this.previewDirty=!1}_enterPreviewEdit(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".detail-overlay preview-pane");(r=e==null?void 0:e.enterEdit)==null||r.call(e)}async _safeAction(e){if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await e()}async _reloadPreview(){if(!this.previewPath)return;const e=await Ve(this.previewPath);e.ok&&(this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages)}_pushToast(e,t,r){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_popDetail(){g.popDetail()}_renderNotIndexedHint(e){return c`<div class=${e?"desktop-only not-indexed-hint":"not-indexed-hint"}>
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}async _loadSession(e){this.searchMode=e.mode==="grep"?"grep":"keyword",localStorage.setItem(C.SEARCH_MODE_KEY,this.searchMode),await this._submit(e.title)}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){const e=this.viewState;if(e.state==="initial")return c`
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
              .modes=${C.SEARCH_MODES}
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${i=>this.localQuery=i.detail.value}
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
    `}};C.RESULTS_PANE_WIDTH_KEY="cortex.resultsPaneWidth";C.RESULTS_PANE_WIDTH_DEFAULT=360;C.RESULTS_PANE_WIDTH_MIN=280;C.RESULTS_PANE_WIDTH_MAX=800;C.SEARCH_MODE_KEY="cortex.searchMode";C.SEARCH_MODES={keyword:{label:"搜索",description:"拆分关键词匹配"},grep:{label:"grep",description:"正则表达式匹配"}};C.styles=_`
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
      background: var(--cortex-border);
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
      color: var(--cortex-text-subtle);
      padding: 24px;
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
  `;U([m()],C.prototype,"localQuery",2);U([m()],C.prototype,"loading",2);U([m()],C.prototype,"previewContent",2);U([m()],C.prototype,"previewPath",2);U([m()],C.prototype,"previewLanguage",2);U([m()],C.prototype,"previewLine",2);U([m()],C.prototype,"historySessions",2);U([m()],C.prototype,"_clearing",2);U([m()],C.prototype,"previewError",2);U([m()],C.prototype,"previewDirty",2);U([m()],C.prototype,"previewWritable",2);U([m()],C.prototype,"previewPages",2);U([m()],C.prototype,"_resultsPaneWidth",2);U([m()],C.prototype,"searchMode",2);C=U([A("search-view")],C);async function*Kn(e){for await(const t of Fn("/api/chat",e))if(t.event==="token")try{yield{type:"token",text:JSON.parse(t.data).text}}catch{}else if(t.event==="done")yield{type:"done"};else if(t.event==="error")try{yield{type:"error",detail:JSON.parse(t.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}var Yn=Object.defineProperty,Gn=Object.getOwnPropertyDescriptor,Y=(e,t,r,i)=>{for(var s=i>1?void 0:i?Gn(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Yn(t,r,s),s};let O=class extends ${constructor(){super(...arguments),this.draft="",this.historySessions=[],this._clearing=!1,this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1,this._previewPaneWidth=O.PREVIEW_PANE_WIDTH_DEFAULT,this._onSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=o=>{const a=Math.max(O.PREVIEW_PANE_WIDTH_MIN,Math.min(O.PREVIEW_PANE_WIDTH_MAX,r-(o.clientX-t)));a!==this._previewPaneWidth&&(this._previewPaneWidth=a)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(O.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPreviewDirty=e=>{this.previewDirty=e.detail.dirty},this._closePreview=async()=>{await this._safeAction(()=>{this.previewOpen=!1})},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=e=>{this._pushToast(`保存失败：${e.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=e=>{this.previewDirty=!1,this._pushToast(`已覆盖：${e.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._pushToast(`上传失败：${e.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._loadPreviewPaneWidth();const e=f.getState().pendingSession;e&&e.type==="chat"&&(g.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await Di({type:"chat",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await zi("chat"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return f.getState().chat}async _submit(e){this._resetPreview();const t=e.detail.value;if(this.draft="",this.viewState.state==="initial"){const i=await Nn({type:"chat",title:t.slice(0,60),preview:t.slice(0,100)});g.setChatState({state:"focus",currentSession:{id:i.id,type:"chat",title:t.slice(0,60),preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:t}],streaming:!0})}else g.setChatState({messages:[...this.viewState.messages,{role:"user",content:t}],streaming:!0});const r=f.getState().chat.currentSession.id;g.setChatState({messages:[...f.getState().chat.messages,{role:"assistant",content:""}]});try{let i="";for await(const s of Kn({message:t,session_id:r}))if(s.type==="token"){i+=s.text;const o=[...f.getState().chat.messages];o[o.length-1]={role:"assistant",content:i},g.setChatState({messages:o})}else if(s.type==="error"){const o=[...f.getState().chat.messages];o[o.length-1]={role:"assistant",content:i+`

⚠️ ${s.detail}`},g.setChatState({messages:o})}await Hn(r,[{kind:"message_user",payload:JSON.stringify({content:t})},{kind:"message_ai",payload:JSON.stringify({content:i})}],f.getState().chat.messages.length),this._loadHistory()}catch(i){g.setError(`对话失败: ${i.message}`)}finally{g.setChatState({streaming:!1})}}_backToInitial(){this._resetPreview(),g.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}_resetPreview(){this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1}async _loadSession(e){this._resetPreview(),g.setChatState({state:"focus",currentSession:e,messages:[]});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const i=((await t.json()).items||[]).map(s=>{const o=JSON.parse(s.payload);return{role:s.kind==="message_user"?"user":"assistant",content:o.content}});g.setChatState({messages:i})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}_loadPreviewPaneWidth(){const e=localStorage.getItem(O.PREVIEW_PANE_WIDTH_KEY);if(!e)return;const t=Number(e);Number.isNaN(t)||(this._previewPaneWidth=Math.max(O.PREVIEW_PANE_WIDTH_MIN,Math.min(O.PREVIEW_PANE_WIDTH_MAX,t)))}get _previewKeyword(){const e=f.getState().chat.messages;for(let t=e.length-1;t>=0;t--)if(e[t].role==="user")return e[t].content;return""}_normalizeReferencePath(e){let t=(e??"").trim();if(!t)return"";const r=t.match(/^\[.*?\]\((.*?)\)$/);r&&(t=r[1].trim()),t=t.replace(/^file:\/\/\/?/i,"");try{t=decodeURIComponent(t)}catch{}return t}async _onReferenceClick(e){await this._safeAction(async()=>{const t=this._normalizeReferencePath(e.detail.path);if(!t){this._pushToast("参考路径为空","error",5e3);return}this.previewError=null;const r=await Ve(t);r.ok?(this.previewContent=r.content,this.previewPath=r.path,this.previewLanguage=r.language,this.previewWritable=r.writable,this.previewPages=r.pages,this.previewOpen=!0):r.notIndexed?(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=t,this.previewWritable=!1,this.previewPages=null,this.previewOpen=!0):this._pushToast(`预览失败：${r.message}`,"error",5e3)})}async _safeAction(e){var t,r;if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;const s=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=s==null?void 0:s.discard)==null||r.call(s),this.previewDirty=!1}await e()}async _reloadPreview(){if(!this.previewPath)return;const e=await Ve(this.previewPath);e.ok&&(this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages)}_pushToast(e,t,r){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_renderNotIndexedHint(){return c`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}render(){var i;const e=this.viewState;if(e.state==="initial")return c`
        <div class="initial-stack">
          <welcome-pane heading="Doclens" subheading="与你的知识库对话"></welcome-pane>
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
              button-label="→"
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
          title=${((i=e.currentSession)==null?void 0:i.title)??""}
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
            button-label="→"
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
        max-width: 800px;
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
      background: var(--cortex-border);
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
    }
    .focus-main .preview-close {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      border: none;
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .focus-main .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      padding: 24px;
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
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
      .input-bar {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;Y([m()],O.prototype,"draft",2);Y([m()],O.prototype,"historySessions",2);Y([m()],O.prototype,"_clearing",2);Y([m()],O.prototype,"previewOpen",2);Y([m()],O.prototype,"previewContent",2);Y([m()],O.prototype,"previewPath",2);Y([m()],O.prototype,"previewLanguage",2);Y([m()],O.prototype,"previewPages",2);Y([m()],O.prototype,"previewWritable",2);Y([m()],O.prototype,"previewError",2);Y([m()],O.prototype,"previewDirty",2);Y([m()],O.prototype,"_previewPaneWidth",2);O=Y([A("chat-view")],O);const Zn={ai:"AI 配置",search:"搜索调优",scoring:"评分",terminal:"终端"},Qn=[{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_BASE_URL",label:"API Base URL",component:"text",effect:"restart",mono:!0,hint:"Anthropic API 端点。可替换为兼容代理或本地模型服务。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_API_KEY",label:"API Key",component:"password",effect:"restart",mono:!0,hint:"Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_MODEL_ID",label:"模型 ID",component:"text",effect:"restart",mono:!0,datalist:["claude-opus-4-6","claude-sonnet-4-6","claude-haiku-4-5"],hint:"支持自动补全常见模型；也可手动输入自定义模型 ID。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_RESULTS",label:"最大结果数（跨文档）",component:"number",effect:"live",min:1,max:200,hint:"search 工具返回的最大文档数量。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_NODES_PER_DOC",label:"每文档最大节点数",component:"number",effect:"live",min:1,max:20,hint:"同一文档返回的最大节点（段落）数。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MAX_SPAN",label:"关键词最大跨度",component:"number",effect:"live",min:1,max:100,hint:"窗口内匹配关键词的最大字符跨度。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORD_MATCH",label:"最少关键词匹配数",component:"number",effect:"live",min:0,max:10,hint:"文档至少命中多少个关键词才进入候选。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_PROXIMITY_SCORE",label:"最低邻近度阈值",component:"select",effect:"live",options:[{value:"0",label:"0 — 不限制"},{value:"1",label:"1 — 部分紧邻"},{value:"2",label:"2 — 全部关键词紧邻"}],hint:"关键词在文档中的邻近程度阈值。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORDS_PER_LINE",label:"行级关键词阈值",component:"number",effect:"live",min:1,max:10,hint:'单行至少命中多少关键词才被选为"最佳行"。'},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_SCORE_THRESHOLD",label:"综合评分阈值",component:"number",effect:"live",min:0,max:1,step:.05,hint:"0 = 不过滤；0.3 = 轻微过滤；0.5+ 容易砍光多关键词结果。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_KEYWORD_MATCH",label:"关键词匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏好'命中的关键词数量多'的文档（多关键词 query 时尤其重要）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FILE_NAME_MATCH",label:"文件名匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，文件名包含关键词的文档排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FTS_SCORE",label:"FTS 原始分权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏向传统全文检索 BM25 排序（与关键词匹配度正相关）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_TITLE_MATCH",label:"标题匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，节点标题（如 Markdown 小节标题）含关键词时排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_PROXIMITY_MATCH",label:"邻近度权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，多关键词在文档中紧邻出现的文档越受偏好。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_CONTEXT_LINES",label:"上下文行数上限",component:"number",unit:"行",min:0,max:100,hint:"每个命中行向上/向下最多各显示多少行原文上下文。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_ANCHOR_LINES",label:"锚点行数上限",component:"number",unit:"行",min:1,max:50,hint:"从同一文档的所有命中行里，挑出多少个'最佳行'作为展示中心（锚点）。锚点越多，结果越完整但输出越长。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_CONTEXT_EXPAND_RANGE",label:"锚点上下文扩展范围",component:"number",unit:"行",min:0,max:100,hint:"以每个锚点为中心，向前/向后各展开多少行作为上下文（再与'上下文行数上限'取较小值）。"}];var Jn=Object.defineProperty,el=Object.getOwnPropertyDescriptor,ts=(e,t,r,i)=>{for(var s=i>1?void 0:i?el(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Jn(t,r,s),s};let xt=class extends ${constructor(){super(...arguments),this.scope="local",this.exists=!0}render(){return c`
      <button class="pill active">🌍 全局</button>
    `}};xt.styles=_`
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
      background: transparent;
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-md);
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
      font-weight: 600;
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
  `;ts([d()],xt.prototype,"scope",2);ts([d({type:Boolean})],xt.prototype,"exists",2);xt=ts([A("settings-scope-segment")],xt);class Qt extends Error{constructor(t,r){super(`Config API error ${t}`),this.status=t,this.body=r}}async function tl(e){const t=await fetch(`/api/config?scope=${e}`,{method:"GET"}),r=await t.json().catch(()=>null);if(!t.ok)throw new Qt(t.status,r);return r}async function rl(e,t){const r=await fetch(`/api/config?scope=${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:t})}),i=await r.json().catch(()=>null);if(!r.ok)throw new Qt(r.status,i);return i}var sl=Object.defineProperty,il=Object.getOwnPropertyDescriptor,ce=(e,t,r,i)=>{for(var s=i>1?void 0:i?il(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&sl(t,r,s),s};const Hs=["ai","search","scoring","terminal"];let Q=class extends ${constructor(){super(...arguments),this._activeTab="ai",this._saving=!1,this._error=null,this._toast=null,this._values={},this._original={},this._exists=!0,this._scope="global",this._fieldErrors={},this._loadGen=0,this._onSaveRequest=()=>{this._save()},this._onRevertRequest=()=>{this._revert()}}connectedCallback(){super.connectedCallback();const e=f.getState();this._scope=e.settings.scope,this._unsubscribe=f.subscribe(()=>this._onStoreChange()),window.addEventListener("cortex:save-settings",this._onSaveRequest),window.addEventListener("cortex:revert-settings",this._onRevertRequest),this._load()}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer!==void 0&&(window.clearTimeout(this._toastTimer),this._toastTimer=void 0),this._loadGen+=1,window.removeEventListener("cortex:save-settings",this._onSaveRequest),window.removeEventListener("cortex:revert-settings",this._onRevertRequest),super.disconnectedCallback()}_onStoreChange(){const e=f.getState();e.settings.scope!==this._scope&&(this._scope=e.settings.scope,this._load())}async _load(){const e=++this._loadGen;this._error=null;try{const t=await tl(this._scope);if(e!==this._loadGen||!this.isConnected)return;this._values={...t.values},this._original={...t.values},this._exists=t.exists,this._fieldErrors={},g.loadSettings(t.values,t.exists)}catch(t){if(e!==this._loadGen||!this.isConnected)return;this._error=`加载失败: ${t.message}`}}get _dirtyFields(){const e=new Set([...Object.keys(this._original),...Object.keys(this._values)]),t=[];for(const r of e)(this._original[r]??"")!==(this._values[r]??"")&&t.push(r);return t}get _dirty(){return this._dirtyFields.length>0}_onInput(e,t){this._values={...this._values,[e]:t},g.updateSetting(e,t)}_isMobile(){return typeof window.matchMedia=="function"&&window.matchMedia("(max-width: 1023px)").matches}_pushToast(e,t="info",r=2500){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_extractFieldErrors(e){if(e instanceof Qt){const t=e.body,r={};for(const i of(t==null?void 0:t.fields)??[])r[i.field]=i.error;return r}return{}}_revert(){this._values={...this._original},g.revertSettings()}async _save(){var e;if(!(!this._dirty||this._saving)){this._saving=!0,this._error=null,this._fieldErrors={};try{const t=await rl(this._scope,this._values);if(!this.isConnected)return;this._original={...this._values},g.loadSettings(this._values,!0);const r=t.needs_restart?"已保存。重启 doclens gui 后 AI 配置生效。":"已保存。下次查询立即生效。";this._isMobile()?this._pushToast(r,"success",4e3):this._toast=r}catch(t){let r;if(t instanceof Qt){const i=t.body,s=(e=i==null?void 0:i.fields)==null?void 0:e.map(o=>o.field).join(", ");r=s?`保存失败（${s}）`:`保存失败 (HTTP ${t.status})`}else t instanceof Error?r=`保存失败: ${t.message}`:r="保存失败: 未知错误";this._isMobile()?(this._pushToast(r,"error",5e3),this._fieldErrors=this._extractFieldErrors(t)):this._error=r}finally{this._saving=!1}}}_renderField(e){const t=this._values[e.envVar]??"",r=e.effect?c`<span class="effect ${e.effect}">${e.effect==="restart"?"🔁 需重启":"● 即时"}</span>`:w;return c`
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
    `}_renderInput(e,t){const r=e.mono?"mono":"",i=s=>this._onInput(e.envVar,s.target.value);switch(e.component){case"text":return c`
          <input
            class="input ${r}"
            type="text"
            .value=${t}
            data-env=${e.envVar}
            @input=${i}
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
              @input=${i}
            />
            <button
              class="btn"
              type="button"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); padding: 2px 8px; font-size: var(--cortex-fs-xs);"
              @click=${s=>{const o=s.target.previousElementSibling;o.type=o.type==="password"?"text":"password"}}
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
            @input=${i}
          />
          ${e.unit?c`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${e.unit}</span>`:w}
        `;case"select":return c`
          <select class="select" .value=${t} data-env=${e.envVar} @change=${i}>
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
              @input=${i}
            />
            <input
              type="range"
              .value=${t}
              min=${e.min??w}
              max=${e.max??w}
              step=${e.step??w}
              @input=${i}
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
            @scope-change=${r=>{g.setSettingsScope(r.detail.scope)}}
          ></settings-scope-segment>
          <nav class="tab-strip" role="tablist">
            ${Hs.map(r=>c`
              <button
                class=${this._activeTab===r?"active":""}
                @click=${()=>{this._activeTab=r}}
              >${Zn[r]}</button>
            `)}
          </nav>
        </aside>
        <main class="main">
          <div class="scroll-area">
            ${Hs.map(r=>{const i=Qn.filter(o=>o.tab===r),s=[];for(const o of i){let a=s.find(l=>l.title===o.section);a||(a={title:o.section,fields:[]},s.push(a)),a.fields.push(o)}return c`
                <div class="tab-panel ${this._activeTab===r?"active":""}" data-panel=${r}>
                  ${this._renderInfoBox(r)}
                  ${s.map(o=>c`
                    <div class="section">
                      <h2>${o.title}</h2>
                      ${o.fields.map(a=>this._renderField(a))}
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
    `}};Q.styles=_`
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
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      border-radius: var(--cortex-radius-sm);
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
      padding: var(--cortex-space-6) var(--cortex-space-8);
    }
    .tab-panel { display: none; max-width: 880px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    .section {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-6);
      margin-bottom: var(--cortex-space-4);
    }
    .section h2 {
      margin: 0 0 var(--cortex-space-1) 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
    }
    .section-desc {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin: 0 0 var(--cortex-space-4) 0;
    }
    .field {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: var(--cortex-space-6);
      padding: var(--cortex-space-3) 0;
      border-top: 1px solid var(--cortex-border-muted);
      align-items: start;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-base);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .field-label .env {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 2px;
    }
    .field-control { display: flex; flex-direction: column; gap: var(--cortex-space-1); }
    .field-control .row { display: flex; align-items: center; gap: var(--cortex-space-2); }
    .slider-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
    }
    .slider-row .value-chip { display: none; }
    .field-control .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }

    .input, .select {
      padding: 6px 10px;
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
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
    }

    .effect {
      display: inline-flex;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
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
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
      /* F1：footer 与 panel 对齐（max-width 880 居中），不再通栏 */
      max-width: 880px;
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
      width: 8px; height: 8px;
      background: var(--cortex-warning);
      border-radius: 50%;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 6px 12px;
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
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
      color: #fff;
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
        border-bottom: 1px solid var(--cortex-border);
        padding: var(--cortex-space-3) var(--cortex-space-4);
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
        font-variant-numeric: tabular-nums;
        font-size: var(--cortex-fs-md);
        font-weight: 600;
        color: var(--cortex-primary);
        background: var(--cortex-primary-soft);
        padding: 2px 10px;
        border-radius: var(--cortex-radius-md);
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
  `;ce([m()],Q.prototype,"_activeTab",2);ce([m()],Q.prototype,"_saving",2);ce([m()],Q.prototype,"_error",2);ce([m()],Q.prototype,"_toast",2);ce([m()],Q.prototype,"_values",2);ce([m()],Q.prototype,"_original",2);ce([m()],Q.prototype,"_exists",2);ce([m()],Q.prototype,"_scope",2);ce([m()],Q.prototype,"_fieldErrors",2);Q=ce([A("settings-view")],Q);const ue=e=>`/api/files${e}`,pe={list:(e,t=200,r=0)=>M(ue(`/list?path=${encodeURIComponent(e)}&limit=${t}&offset=${r}`)),stats:e=>M(ue(`/stats?path=${encodeURIComponent(e)}`)),attrs:e=>M(ue(`/attrs?path=${encodeURIComponent(e)}`)),mkdir:e=>M(ue("/mkdir"),{method:"POST",json:{path:e}}),remove:e=>M(ue(`?path=${encodeURIComponent(e)}`),{method:"DELETE"}),move:(e,t,r=!1)=>M(ue("/move"),{method:"POST",json:{from_paths:e,dest_dir:t,overwrite:r}}),rename:(e,t)=>M(ue("/rename"),{method:"POST",json:{path:e,new_name:t}}),upload:(e,t,r=!1)=>{const i=new FormData;return i.append("file",e),i.append("dest_dir",t),i.append("overwrite",String(r)),M(ue("/upload"),{method:"POST",body:i})}};var ol=Object.defineProperty,al=Object.getOwnPropertyDescriptor,ge=(e,t,r,i)=>{for(var s=i>1?void 0:i?al(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&ol(t,r,s),s};let le=class extends ${constructor(){super(...arguments),this.depth=0,this.expanded=!1,this.selected=!1,this.readonly=!1,this.childEntries=[],this.loading=""}_onClick(){this.readonly?this.dispatchEvent(new CustomEvent("pick-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0})):this.dispatchEvent(new CustomEvent("select-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}_toggle(e){e.stopPropagation(),this.entry.has_child_dirs&&this.dispatchEvent(new CustomEvent("toggle",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}render(){return c`
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
    `}_relay(e,t){t.stopPropagation();const r=t.detail;this.dispatchEvent(new CustomEvent(e,{detail:r,bubbles:!0,composed:!0}))}};le.styles=_`
    :host { display: block; }
    .row {
      display: flex; align-items: center; gap: var(--cortex-space-1);
      padding: 4px 8px; cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base); color: var(--cortex-text);
      user-select: none;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .arrow {
      width: 16px; height: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--cortex-text-subtle); transition: transform 0.1s;
      font-size: 10px;
    }
    .arrow.expanded { transform: rotate(90deg); }
    .arrow.leaf { visibility: hidden; }
    .icon { font-size: 14px; }
    .label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .children { padding-left: 16px; }
  `;ge([d({type:Object})],le.prototype,"entry",2);ge([d({type:Number})],le.prototype,"depth",2);ge([d({type:Boolean})],le.prototype,"expanded",2);ge([d({type:Boolean})],le.prototype,"selected",2);ge([d({type:Boolean})],le.prototype,"readonly",2);ge([d({type:Array})],le.prototype,"childEntries",2);ge([d({type:String})],le.prototype,"loading",2);le=ge([A("tree-node")],le);var nl=Object.getOwnPropertyDescriptor,ll=(e,t,r,i)=>{for(var s=i>1?void 0:i?nl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=a(s)||s);return s};let Dr=class extends ${constructor(){super(...arguments),this._onToggle=async e=>{const t=e.detail.path,{expandedPaths:r}=f.getState().files;r.includes(t)?g.collapseDir(t):(await this._ensureLoaded(t),g.expandDir(t))},this._onSelectDir=async e=>{g.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path),g.expandDir(e.detail.path)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),g.expandDir("")}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}async _ensureLoaded(e){const{treeCache:t}=f.getState().files;if(!(e in t))try{g.setFilesState({listing:!0});const r=await pe.list(e);g.setFilesState({treeCache:{...f.getState().files.treeCache,[e]:r.entries},listing:!1})}catch(r){g.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"})}}render(){const{treeCache:e,expandedPaths:t,currentDir:r}=f.getState().files,i=e[""]||[],s=new Set(t);return c`
      <div class="header">文件</div>
      ${i.filter(o=>o.is_dir).map(o=>c`
        <tree-node
          .entry=${o}
          .depth=${0}
          .expanded=${s.has(o.path)}
          .selected=${o.path===r}
          .childEntries=${e[o.path]||[]}
          .loading=""
          @toggle=${this._onToggle}
          @select-dir=${this._onSelectDir}
        ></tree-node>
      `)}
    `}};Dr.styles=_`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-right: 1px solid var(--cortex-border);
      overflow-y: auto;
    }
    .header {
      padding: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: sticky; top: 0;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border-muted);
      z-index: 1;
    }
  `;Dr=ll([A("file-tree")],Dr);const cl={pdf:{letter:"P",bg:"#DC2626",fg:"#FFFFFF"},doc:{letter:"D",bg:"#2563EB",fg:"#FFFFFF"},docx:{letter:"D",bg:"#2563EB",fg:"#FFFFFF"},xls:{letter:"X",bg:"#16A34A",fg:"#FFFFFF"},xlsx:{letter:"X",bg:"#16A34A",fg:"#FFFFFF"},csv:{letter:"C",bg:"#16A34A",fg:"#FFFFFF"},ppt:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},pptx:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},md:{letter:"M",bg:"#6366F1",fg:"#FFFFFF"},txt:{letter:"T",bg:"#6B7280",fg:"#FFFFFF"},html:{letter:"H",bg:"#E34F26",fg:"#FFFFFF"}};function Ii(e){if(!e)return"";const t=e.lastIndexOf(".");return t<=0||t===e.length-1?"":e.slice(t+1).toLowerCase()}function dl(e,t){if(t)return null;const r=Ii(e);return cl[r]??null}function hl(e){return e.is_dir?"文件夹":Ii(e.name)}var ul=Object.defineProperty,pl=Object.getOwnPropertyDescriptor,or=(e,t,r,i)=>{for(var s=i>1?void 0:i?pl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&ul(t,r,s),s};let Ke=class extends ${constructor(){super(...arguments),this.selected=!1,this.active=!1}_fmtSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}_fmtTime(e){if(!e)return"";try{return new Date(e).toLocaleString(void 0,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return""}}_onRowClick(){this.dispatchEvent(new CustomEvent("activated",{detail:{path:this.entry.path,is_dir:this.entry.is_dir},bubbles:!0,composed:!0}))}_onCheckboxClick(e){e.stopPropagation(),this.dispatchEvent(new CustomEvent("checked",{detail:{path:this.entry.path,ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey},bubbles:!0,composed:!0}))}render(){const e=dl(this.entry.name,this.entry.is_dir);return c`
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
        <span class="cell-type">${hl(this.entry)}</span>
      </div>
    `}};Ke.styles=_`
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .checkbox { display: flex; align-items: center; justify-content: center; }
    .cell-icon { font-size: 14px; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .size, .time, .cell-type, .cell-indexed {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 10px;
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
      border-radius: 50%;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      user-select: none;
      font-family: var(--cortex-font-sans);
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
  `;or([d({type:Object})],Ke.prototype,"entry",2);or([d({type:Boolean})],Ke.prototype,"selected",2);or([d({type:Boolean})],Ke.prototype,"active",2);Ke=or([A("file-row")],Ke);var fl=Object.defineProperty,bl=Object.getOwnPropertyDescriptor,At=(e,t,r,i)=>{for(var s=i>1?void 0:i?bl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&fl(t,r,s),s};const Ri=[28,28,240,80,140,70,80],Bs=[20,20,80,50,80,50,50],Us=[60,60,800,200,300,150,200],js=Ri.length,qs="cortex.files.colWidths";let Ie=class extends ${constructor(){super(...arguments),this.activePath="",this.mobile=!1,this._colWidths=[...Ri],this._showMobileMenu=!1,this._makeColResizeHandler=e=>t=>{t.preventDefault(),t.stopPropagation();const r=t.clientX,i=this._colWidths[e];document.body.style.cursor="col-resize",document.body.style.userSelect="none";const s=a=>{const l=a.clientX-r,n=Math.max(Bs[e],Math.min(Us[e],i+l)),u=[...this._colWidths];u[e]=n,this._colWidths=u},o=()=>{document.removeEventListener("mousemove",s),document.removeEventListener("mouseup",o),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(qs,JSON.stringify(this._colWidths))};document.addEventListener("mousemove",s),document.addEventListener("mouseup",o)},this._onMobileBackClick=()=>{this._showMobileMenu=!1,this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=e=>{e.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=e=>{var s,o;if(!this._showMobileMenu)return;const t=e.composedPath(),r=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-menu"),i=(o=this.shadowRoot)==null?void 0:o.querySelector(".mobile-more");r&&t.includes(r)||i&&t.includes(i)||(this._showMobileMenu=!1)},this._onMenuItemClick=e=>t=>{t.stopPropagation(),this._showMobileMenu=!1,this._action(e)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._loadColWidths(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}willUpdate(){for(let e=0;e<js;e++)this.style.setProperty(`--col-${e+1}`,`${this._colWidths[e]}px`)}_loadColWidths(){const e=localStorage.getItem(qs);if(e)try{const t=JSON.parse(e);Array.isArray(t)&&t.length===js&&t.every(r=>typeof r=="number"&&Number.isFinite(r))&&(this._colWidths=t.map((r,i)=>Math.max(Bs[i],Math.min(Us[i],r))))}catch{}}_action(e){this.dispatchEvent(new CustomEvent("action",{detail:{name:e},bubbles:!0,composed:!0}))}_onRowChecked(e){const{path:t,shift:r}=e.detail;g.selectEntry(t,{ctrl:!r,shift:r})}_onSelectAll(e){const t=e.target,{currentDir:r,treeCache:i,selectedPaths:s}=f.getState().files,o=i[r]||[];if(t.checked){const a=o.map(n=>n.path),l=Array.from(new Set([...s,...a]));g.setFilesState({selectedPaths:l})}else{const a=new Set(o.map(l=>l.path));g.setFilesState({selectedPaths:s.filter(l=>!a.has(l))})}}_goUp(){const{currentDir:e}=f.getState().files;if(e==="")return;const t=e.includes("/")?e.slice(0,e.lastIndexOf("/")):"";g.selectDir(t)}_renderMobileHeader(){const{currentDir:e,selectedPaths:t}=f.getState().files,r=t.length===1,i=t.length>=1,s=e===""?"/":`/${e}/`;return c`
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
                  ?disabled=${!i}
                  @click=${this._onMenuItemClick("move")}
                >→ 移动</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="delete"
                  ?disabled=${!i}
                  class="danger"
                  @click=${this._onMenuItemClick("delete")}
                >🗑 删除</button>
              </div>
            `:null}
      </div>
    `}render(){const{currentDir:e,treeCache:t,selectedPaths:r}=f.getState().files,i=t[e]||[],s=new Set(r),o=r.length===1,a=r.length>=1,l=e!=="",n=e===""?"/":`/${e}/`,u=i.length>0&&i.every(h=>s.has(h.path));return this.mobile?c`
        ${this._renderMobileHeader()}
        ${i.length===0?c`<div class="empty">目录为空</div>`:c`<div class="header-row">
              <span class="select-all">
                <input
                  type="checkbox"
                  .checked=${u}
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
          ${i.map(h=>c`
            <file-row
              .entry=${h}
              .selected=${s.has(h.path)}
              .active=${h.path===this.activePath}
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
        <button data-action="rename" ?disabled=${!o} @click=${()=>this._action("rename")}>✎ 重命名</button>
        <button data-action="move" ?disabled=${!a} @click=${()=>this._action("move")}>→ 移动</button>
        <button data-action="delete" ?disabled=${!a} class="danger" @click=${()=>this._action("delete")}>🗑 删除</button>
      </div>
      ${i.length===0?c`<div class="empty">目录为空</div>`:c`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                .checked=${u}
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
        ${i.map(h=>c`
          <file-row
            .entry=${h}
            .selected=${s.has(h.path)}
            .active=${h.path===this.activePath}
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
      padding: var(--cortex-space-2) var(--cortex-space-3);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .breadcrumb .path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
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
      border-radius: var(--cortex-radius-sm);
    }
    .toolbar button:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar button.danger { color: var(--cortex-danger); }
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
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
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
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
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
      font-size: var(--cortex-fs-sm);
    }
    .rows { flex: 1; overflow-y: auto; }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
    }
  `;At([d()],Ie.prototype,"activePath",2);At([d({type:Boolean})],Ie.prototype,"mobile",2);At([m()],Ie.prototype,"_colWidths",2);At([m()],Ie.prototype,"_showMobileMenu",2);Ie=At([A("file-list")],Ie);var ml=Object.defineProperty,vl=Object.getOwnPropertyDescriptor,rs=(e,t,r,i)=>{for(var s=i>1?void 0:i?vl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&ml(t,r,s),s};const gl=/[\\/:*?"<>|]/,xl=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let _t=class extends ${constructor(){super(...arguments),this._name="",this._err=""}get _parent(){return f.getState().files.currentDir}_validate(e){return e?e.startsWith(".")?"不能以点开头":gl.test(e)?'含非法字符 / \\ : * ? " < > |':/\s/.test(e[0]||"")?"不能以空白开头":xl.test(e)?"Windows 保留名":"":"名称不能为空"}_onInput(e){this._name=e.target.value,this._err=this._validate(this._name)}_submit(){if(this._err)return;const e=this._parent?`${this._parent}/${this._name}`:this._name;this.dispatchEvent(new CustomEvent("submit",{detail:{path:e},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=!!this._err;return c`
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
    `}};_t.styles=_`
    :host { display: block; min-width: 360px; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: inherit;
    }
    input.invalid { border-color: var(--cortex-danger); }
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
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;rs([m()],_t.prototype,"_name",2);rs([m()],_t.prototype,"_err",2);_t=rs([A("mkdir-dialog")],_t);var _l=Object.defineProperty,yl=Object.getOwnPropertyDescriptor,ar=(e,t,r,i)=>{for(var s=i>1?void 0:i?yl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&_l(t,r,s),s};const wl=/[\\/:*?"<>|]/,kl=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let Ye=class extends ${constructor(){super(...arguments),this.currentName="",this._name="",this._err=""}connectedCallback(){super.connectedCallback(),this._name=this.currentName,this._err=this._validate(this._name)}_validate(e){return e?e===this.currentName?"名称未变化":e.startsWith(".")?"不能以点开头":wl.test(e)?'含非法字符 / \\ : * ? " < > |':kl.test(e)?"Windows 保留名":"":"名称不能为空"}_onInput(e){this._name=e.target.value,this._err=this._validate(this._name)}_submit(){this._err||this.dispatchEvent(new CustomEvent("submit",{detail:{newName:this._name},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=!!this._err;return c`
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
    `}};Ye.styles=_`
    :host { display: block; min-width: 360px; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: inherit;
    }
    input.invalid { border-color: var(--cortex-danger); }
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
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;ar([d({type:String})],Ye.prototype,"currentName",2);ar([m()],Ye.prototype,"_name",2);ar([m()],Ye.prototype,"_err",2);Ye=ar([A("rename-dialog")],Ye);var $l=Object.defineProperty,Sl=Object.getOwnPropertyDescriptor,ss=(e,t,r,i)=>{for(var s=i>1?void 0:i?Sl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&$l(t,r,s),s};let yt=class extends ${constructor(){super(...arguments),this._dest="",this._overwrite=!1}get _selectedCount(){return f.getState().files.selectedPaths.length}_onPickDir(e){this._dest=e.detail.path}_onToggle(e){e.stopPropagation()}_submit(){this._dest&&this.dispatchEvent(new CustomEvent("submit",{detail:{destDir:this._dest,overwrite:this._overwrite},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const{treeCache:e,expandedPaths:t}=f.getState().files,r=(e[""]||[]).filter(s=>s.is_dir),i=new Set(t);return c`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${r.map(s=>c`
          <tree-node
            .entry=${s}
            .depth=${0}
            .readonly=${!0}
            .expanded=${i.has(s.path)}
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
    `}};yt.styles=_`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); }
    .tree {
      max-height: 320px; overflow-y: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-2);
      margin: var(--cortex-space-2) 0;
    }
    .selected {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-2);
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
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
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
  `;ss([m()],yt.prototype,"_dest",2);ss([m()],yt.prototype,"_overwrite",2);yt=ss([A("move-dialog")],yt);var El=Object.defineProperty,Cl=Object.getOwnPropertyDescriptor,nr=(e,t,r,i)=>{for(var s=i>1?void 0:i?Cl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&El(t,r,s),s};let Ge=class extends ${constructor(){super(...arguments),this._phase="confirming",this._stats=null,this._confirmed=!1}get _selected(){return f.getState().files.selectedPaths}connectedCallback(){super.connectedCallback(),!this._stats&&this._selected.length>0&&(this._phase="loading-stats",this._loadStats())}async _loadStats(){const e=this._selected;let t=0,r=0,i=0;for(const s of e)try{const o=await pe.stats(s);t+=o.file_count,r+=o.dir_count,i+=o.total_size_bytes}catch{}t===0&&r===0&&(t=e.length),this._stats={file_count:t,dir_count:r,total_size_bytes:i},this._phase="confirming"}_fmtSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}_delete(){this._confirmed&&(this._phase="deleting",this.dispatchEvent(new CustomEvent("submit",{detail:{paths:this._selected},bubbles:!0,composed:!0})))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=this._selected.length;return this._phase==="loading-stats"?c`<div class="spinner">统计中…</div>`:c`
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
    `}};Ge.styles=_`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); word-break: break-all; }
    .warn {
      padding: var(--cortex-space-3);
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      border-radius: var(--cortex-radius-md);
      color: #92400E;
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-3);
    }
    .stats {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
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
      color: white;
      border-color: var(--cortex-danger);
    }
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
  `;nr([m()],Ge.prototype,"_phase",2);nr([m()],Ge.prototype,"_stats",2);nr([m()],Ge.prototype,"_confirmed",2);Ge=nr([A("delete-dialog")],Ge);var Pl=Object.defineProperty,Al=Object.getOwnPropertyDescriptor,is=(e,t,r,i)=>{for(var s=i>1?void 0:i?Al(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Pl(t,r,s),s};let wt=class extends ${constructor(){super(...arguments),this.targetDir="",this._active=!1,this._dragCounter=0,this._onDragEnter=e=>{this._hasFilesOnly(e)&&(e.preventDefault(),this._dragCounter++,this._active=!0)},this._onDragOver=e=>{this._hasFilesOnly(e)&&e.preventDefault()},this._onDragLeave=()=>{this._dragCounter--,this._dragCounter<=0&&(this._active=!1,this._dragCounter=0)},this._onDrop=e=>{if(!e.dataTransfer)return;e.preventDefault(),this._active=!1,this._dragCounter=0;const t=Array.from(e.dataTransfer.files||[]);t.length!==0&&this.dispatchEvent(new CustomEvent("drop-files",{detail:{files:t,destDir:this.targetDir},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),window.addEventListener("dragenter",this._onDragEnter),window.addEventListener("dragover",this._onDragOver),window.addEventListener("dragleave",this._onDragLeave),window.addEventListener("drop",this._onDrop)}disconnectedCallback(){window.removeEventListener("dragenter",this._onDragEnter),window.removeEventListener("dragover",this._onDragOver),window.removeEventListener("dragleave",this._onDragLeave),window.removeEventListener("drop",this._onDrop),super.disconnectedCallback()}_hasFilesOnly(e){if(!e.dataTransfer)return!1;const t=Array.from(e.dataTransfer.items||[]);return t.length===0?e.dataTransfer.types.includes("Files"):t.every(r=>r.kind==="file")}render(){return c`
      <div class="overlay ${this._active?"active":""}">
        <div>⬇ 拖放以上传到</div>
        <div>📁 ${this.targetDir||"/"}</div>
      </div>
    `}};wt.styles=_`
    :host { display: contents; }
    .overlay {
      position: fixed; inset: 0;
      background: rgba(13, 148, 136, 0.15);
      border: 4px dashed var(--cortex-primary);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: var(--cortex-space-2);
      pointer-events: none;
      z-index: 9999;
      font-size: var(--cortex-fs-lg);
      color: var(--cortex-primary);
      font-weight: 500;
    }
    .overlay.active { display: flex; }
    @media (max-width: 1023px) {
      /* 移动端不支持拖拽上传 */
      :host { display: none !important; }
    }
  `;is([d({type:String})],wt.prototype,"targetDir",2);is([m()],wt.prototype,"_active",2);wt=is([A("drop-zone")],wt);var Tl=Object.defineProperty,Dl=Object.getOwnPropertyDescriptor,et=(e,t,r,i)=>{for(var s=i>1?void 0:i?Dl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Tl(t,r,s),s};const zl=80,Ol="按文件名搜索…";let ve=class extends ${constructor(){super(...arguments),this._value="",this._isComposing=!1,this.disabled=!1,this.placeholder=Ol,this.value="",this._timer=null,this._onInput=e=>{const t=e.target;if(this._value=t.value,this._value.trim()===""){this._emitClear();return}this._scheduleEmit()},this._onCompositionStart=()=>{this._isComposing=!0},this._onCompositionEnd=()=>{this._isComposing=!1,this._scheduleEmit()},this._onKeyDown=e=>{e.key==="Escape"&&(e.preventDefault(),this._emitClear())},this._onClearClick=()=>{var t;this._emitClear();const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e==null||e.focus()}}connectedCallback(){super.connectedCallback(),this.value&&(this._value=this.value)}disconnectedCallback(){this._timer&&clearTimeout(this._timer),super.disconnectedCallback()}_emitSearch(){this.dispatchEvent(new CustomEvent("search",{detail:{query:this._value},bubbles:!0,composed:!0}))}_scheduleEmit(){this._timer&&clearTimeout(this._timer),this._timer=setTimeout(()=>{this._timer=null,this._isComposing||this._emitSearch()},zl)}_emitClear(){var t;this._timer&&(clearTimeout(this._timer),this._timer=null),this._value="";const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e&&(e.value=""),this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){return c`
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
    `}};ve.styles=_`
    :host {
      display: block;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 4px 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-surface);
    }
    .box:focus-within {
      border-color: var(--cortex-primary);
    }
    .icon { opacity: 0.6; font-size: 13px; }
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
    button.clear {
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 4px;
      border-radius: var(--cortex-radius-sm);
    }
    button.clear:hover { color: var(--cortex-text); background: var(--cortex-surface-muted); }
  `;et([m()],ve.prototype,"_value",2);et([m()],ve.prototype,"_isComposing",2);et([d({type:Boolean})],ve.prototype,"disabled",2);et([d()],ve.prototype,"placeholder",2);et([d({type:String})],ve.prototype,"value",2);ve=et([A("file-search-box")],ve);var Il=Object.getOwnPropertyDescriptor,Rl=(e,t,r,i)=>{for(var s=i>1?void 0:i?Il(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=a(s)||s);return s};const Ll=100;function Ml(e,t){if(!t)return e;const r=e.toLowerCase(),i=t.toLowerCase(),s=r.indexOf(i);return s===-1?e:[e.slice(0,s),c`<mark>${e.slice(s,s+i.length)}</mark>`,e.slice(s+i.length)]}function Fl(e){const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t+1)}function Nl(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}function Wl(e){if(!e)return"";const t=new Date(e).getTime();if(Number.isNaN(t))return"";const r=Date.now()-t,i=24*3600*1e3;return r<i?"今天":r<2*i?"昨天":r<7*i?`${Math.floor(r/i)} 天前`:r<30*i?`${Math.floor(r/(7*i))} 周前`:r<365*i?`${Math.floor(r/(30*i))} 个月前`:`${Math.floor(r/(365*i))} 年前`}let zr=class extends ${constructor(){super(...arguments),this._onKeyDown=e=>{const{results:t,selectedPath:r}=this._state;if(t.length===0){e.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}));return}const i=t.findIndex(s=>s.path===r);if(e.key==="ArrowDown"){e.preventDefault();const s=t[Math.min(t.length-1,i+1)];g.selectFilenameSearchResult(s.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else if(e.key==="ArrowUp"){e.preventDefault();const s=t[Math.max(0,i-1)];g.selectFilenameSearchResult(s.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else if(e.key==="Enter"){e.preventDefault();const s=t[i]??t[0];s&&this.dispatchEvent(new CustomEvent("activated",{detail:{path:s.path},bubbles:!0,composed:!0}))}else e.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}}get _state(){return f.getState().files.filenameSearch}_onRowClick(e){g.selectFilenameSearchResult(e.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:e.path},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.tabIndex=0,this.addEventListener("keydown",this._onKeyDown),this._unsubscribe=f.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;this.removeEventListener("keydown",this._onKeyDown),(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}render(){const{query:e,results:t,selectedPath:r,totalMatches:i}=this._state;return t.length===0?c`
        <div class="empty">
          <div class="icon-big">🔍</div>
          <div>未匹配到任何文件名包含 "<b>${e}</b>" 的文档</div>
        </div>
      `:c`
      <div class="header-bar">📄 文件名搜索结果 · 共 ${i} 项</div>
      <div class="columns">
        <span>名称 · 目录</span>
        <span>大小 · 修改</span>
      </div>
      <div class="rows">
        ${t.map(s=>{const o=Fl(s.path),a=s.path===r;return c`
            <div
              class="row ${a?"active":""}"
              @click=${()=>this._onRowClick(s)}
            >
              <span class="name-cell">
                <span class="icon">📄</span>
                <span class="name">${Ml(s.name,e)}</span>
                ${o?c`<span class="dir">${o}</span>`:""}
              </span>
              <span class="meta">${Nl(s.size)} · ${Wl(s.modifiedAt)}</span>
            </div>
          `})}
      </div>
      ${i>t.length?c`<div class="overflow-hint">共 ${i} 项，仅显示前 ${Ll}，请补充关键字</div>`:""}
    `}};zr.styles=_`
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
      color: var(--cortex-primary);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
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
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-base);
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
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    mark {
      background: var(--cortex-warning-soft, #fff3a8);
      color: var(--cortex-warning-fg, #1a1a1a);
      padding: 0 2px;
      border-radius: 2px;
    }
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8);
      color: var(--cortex-text-subtle);
      text-align: center;
      gap: var(--cortex-space-2);
    }
    .empty .icon-big { font-size: 32px; opacity: 0.5; }
    .overflow-hint {
      padding: 6px var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: center;
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
  `;zr=Rl([A("file-search-results")],zr);async function Hl(){return(await M("/api/files/documents")).documents.map(t=>({path:t.path,name:t.name,size:t.size,modifiedAt:t.modified_at}))}var Bl=Object.defineProperty,Ul=Object.getOwnPropertyDescriptor,ee=(e,t,r,i)=>{for(var s=i>1?void 0:i?Ul(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&Bl(t,r,s),s};let y=class extends ${constructor(){super(...arguments),this._dialog=null,this._toast=null,this._toastTimer=null,this._previewPath="",this._previewContent="",this._previewLanguage="text",this._previewWritable=!1,this._previewPages=null,this._previewError=null,this._previewDirty=!1,this._treePaneWidth=y.TREE_PANE_WIDTH_DEFAULT,this._previewPaneWidth=y.PREVIEW_PANE_WIDTH_DEFAULT,this._fileInput=null,this._onTreeSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._treePaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=o=>{const a=o.clientX-t,l=this.clientWidth,n=l>0?l-this._previewPaneWidth-y.MIDDLE_PANE_MIN-y.SPLITTERS_TOTAL:y.TREE_PANE_WIDTH_MAX,u=Math.min(y.TREE_PANE_WIDTH_MAX,n),h=Math.max(y.TREE_PANE_WIDTH_MIN,Math.min(u,r+a));h!==this._treePaneWidth&&(this._treePaneWidth=h)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(y.TREE_PANE_WIDTH_KEY,String(this._treePaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPreviewSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=o=>{const a=o.clientX-t,l=this.clientWidth,n=l>0?l-this._treePaneWidth-y.MIDDLE_PANE_MIN-y.SPLITTERS_TOTAL:y.PREVIEW_PANE_WIDTH_MAX,u=Math.min(y.PREVIEW_PANE_WIDTH_MAX,n),h=Math.max(y.PREVIEW_PANE_WIDTH_MIN,Math.min(u,r-a));h!==this._previewPaneWidth&&(this._previewPaneWidth=h)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(y.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPreviewDirty=e=>{this._previewDirty=e.detail.dirty},this._onPreviewSaved=()=>{this._previewDirty=!1,this._showToast("已保存")},this._onPreviewSaveFailed=e=>{this._showToast(`保存失败：${e.detail.message}`)},this._onPreviewUploadSuccess=e=>{this._previewDirty=!1,this._showToast(`已覆盖：${e.detail.path}`),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._showToast(`上传失败：${e.detail.message}`)},this._onFilenameSearch=e=>{const t=e.detail.query;if(t.trim()===""){g.clearFilenameSearch();return}const{allDocs:r}=f.getState().files.filenameSearch,i=t.toLowerCase(),s=r.filter(l=>l.name.toLowerCase().includes(i));s.sort((l,n)=>l.name.toLowerCase().localeCompare(n.name.toLowerCase(),"zh",{numeric:!0,sensitivity:"base"}));const o=s.length,a=s.slice(0,100);g.setFilenameSearchQuery({query:t,results:a,totalMatches:o}),a[0]&&this._previewPathWithDirtyCheck(a[0].path)},this._onFilenameClear=()=>{g.clearFilenameSearch()},this._onFilenameResultActivated=async e=>{await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&g.setMobilePane("detail")},this._cancelDialog=()=>{this._dialog=null}}connectedCallback(){super.connectedCallback(),this._unsubscribe=f.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),this._loadPaneWidths(),this._loadIndexedDocuments()}async _loadIndexedDocuments(){if(f.getState().files.filenameSearch.docsLoading)try{const e=await Hl();g.loadIndexedDocuments(e)}catch(e){g.setFilenameSearchDocsError((e==null?void 0:e.message)||"文档列表加载失败")}}_loadPaneWidths(){const e=localStorage.getItem(y.TREE_PANE_WIDTH_KEY);if(e){const r=Number(e);Number.isNaN(r)||(this._treePaneWidth=Math.max(y.TREE_PANE_WIDTH_MIN,Math.min(y.TREE_PANE_WIDTH_MAX,r)))}const t=localStorage.getItem(y.PREVIEW_PANE_WIDTH_KEY);if(t){const r=Number(t);Number.isNaN(r)||(this._previewPaneWidth=Math.max(y.PREVIEW_PANE_WIDTH_MIN,Math.min(y.PREVIEW_PANE_WIDTH_MAX,r)))}}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer&&clearTimeout(this._toastTimer),super.disconnectedCallback()}get _state(){return f.getState().files}get _isMobile(){return typeof window<"u"&&window.innerWidth<1024}async _ensureLoaded(e){const{treeCache:t}=f.getState().files;if(!(e in t))try{g.setFilesState({listing:!0});const r=await pe.list(e);if(f.getState().files.treeCache!==t){const i=f.getState().files.treeCache;if(e in i)return;g.setFilesState({treeCache:{...i,[e]:r.entries},listing:!1});return}g.setFilesState({treeCache:{...t,[e]:r.entries},listing:!1})}catch(r){g.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"}),this._showToast((r==null?void 0:r.message)||"加载失败")}}updated(){}_showToast(e){this._toast=e,this._toastTimer&&clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},3500)}_onAction(e){const t=e.detail.name;if(t==="upload"){this._openFilePicker();return}if(["mkdir","rename","move","delete"].includes(t)){if(t==="rename"&&this._state.selectedPaths.length!==1||(t==="move"||t==="delete")&&this._state.selectedPaths.length===0)return;this._dialog=t}}_openFilePicker(){this._fileInput||(this._fileInput=document.createElement("input"),this._fileInput.type="file",this._fileInput.multiple=!0,this._fileInput.style.display="none",this._fileInput.addEventListener("change",()=>{this._fileInput&&this._fileInput.files&&this._fileInput.files.length>0&&(this._uploadFiles(Array.from(this._fileInput.files),this._state.currentDir),this._fileInput.value="")}),document.body.appendChild(this._fileInput)),this._fileInput.click()}async _onMkdirSubmit(e){this._dialog=null;try{await pe.mkdir(e.detail.path);const t=e.detail.path.includes("/")?e.detail.path.slice(0,e.detail.path.lastIndexOf("/")):"";g.invalidateDir(t),await this._ensureLoaded(t),g.expandDir(t),this._showToast("目录已创建")}catch(t){this._showToast((t==null?void 0:t.message)||"创建失败")}}async _onRenameSubmit(e){const t=this._state.selectedPaths[0];this._dialog=null;try{if(await pe.rename(t,e.detail.newName),g.invalidateDir(this._state.currentDir),await this._ensureLoaded(this._state.currentDir),this._previewPath===t){const r=t.includes("/")?t.slice(0,t.lastIndexOf("/")+1)+e.detail.newName:e.detail.newName;this._previewPath=r,this._reloadPreview()}this._showToast("已重命名")}catch(r){this._showToast((r==null?void 0:r.message)||"重命名失败")}}async _onMoveSubmit(e){const t=[...this._state.selectedPaths];this._dialog=null;try{const r=await pe.move(t,e.detail.destDir,e.detail.overwrite),i=new Set;t.forEach(s=>{i.add(s.includes("/")?s.slice(0,s.lastIndexOf("/")):"")}),i.add(e.detail.destDir),i.forEach(s=>g.invalidateDir(s));for(const s of i)await this._ensureLoaded(s);g.clearSelection(),this._showToast(r.skipped.length?`已移动 ${r.moved.length} 项，${r.skipped.length} 项跳过`:`已移动 ${r.moved.length} 项`)}catch(r){this._showToast((r==null?void 0:r.message)||"移动失败")}}async _onDeleteSubmit(e){const t=[...e.detail.paths];this._dialog=null;let r=0,i=0;for(const o of t)try{await pe.remove(o),r++,g.invalidateSubtree(o);const a=o.includes("/")?o.slice(0,o.lastIndexOf("/")):"";g.invalidateDir(a)}catch{i++}const s=new Set;t.forEach(o=>s.add(o.includes("/")?o.slice(0,o.lastIndexOf("/")):""));for(const o of s)await this._ensureLoaded(o);this._previewPath&&t.includes(this._previewPath)&&(this._previewPath="",this._previewContent="",this._previewError=null,this._previewWritable=!1,this._previewPages=null,this._previewDirty=!1),g.clearSelection(),this._showToast(i?`已删除 ${r}，失败 ${i}`:`已删除 ${r} 项`)}_onDropFiles(e){this._uploadFiles(e.detail.files,e.detail.destDir)}async _uploadFiles(e,t){let r=0,i=0,s="";for(const o of e)try{await pe.upload(o,t,!1),r++}catch(a){(a==null?void 0:a.code)==="ALREADY_EXISTS"?i++:s=(a==null?void 0:a.message)||"上传失败"}if(g.invalidateDir(t),await this._ensureLoaded(t),s&&r===0)this._showToast(s);else{const o=[`已上传 ${r}`];i>0&&o.push(`跳过 ${i}`),s&&o.push("部分失败"),this._showToast(o.join("，"))}}_goBack(){const e=this._state.mobilePane;e==="detail"?this._isFilenameSearchActive?g.setMobilePane("tree"):g.setMobilePane("list"):e==="list"&&g.setMobilePane("tree")}async _onFileListActivated(e){if(e.detail.is_dir){g.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path);return}await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&g.setMobilePane("detail")}async _previewPathWithDirtyCheck(e){if(this._previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await this._fetchPreview(e)}async _fetchPreview(e){const t=await Ve(e);t.ok?(this._previewError=null,this._previewPath=t.path,this._previewContent=t.content,this._previewLanguage=t.language,this._previewWritable=t.writable,this._previewPages=t.pages):t.notIndexed?(this._previewError="NOT_INDEXED",this._previewPath=e,this._previewContent="",this._previewWritable=!1,this._previewPages=null):this._showToast(t.message||"预览失败")}async _reloadPreview(){if(!this._previewPath)return;const e=await Ve(this._previewPath);e.ok&&(this._previewContent=e.content,this._previewLanguage=e.language,this._previewWritable=e.writable,this._previewPages=e.pages)}_discardPreviewEdits(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=e==null?void 0:e.discard)==null||r.call(e),this._previewDirty=!1}_renderNotIndexedHint(){return c`<div class="preview-placeholder">
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
    ></preview-pane>`:c`<div class="preview-placeholder">点击文件预览</div>`}get _searchBoxState(){const e=f.getState().files.filenameSearch,t=!e.docsLoading&&e.allDocs.length===0,r=e.docsError!==null||t,i=e.docsError!==null?"文档列表加载失败":t?"暂无已索引文档":"按文件名搜索…";return{disabled:r,placeholder:i}}get _isFilenameSearchActive(){return f.getState().files.filenameSearch.isActive}render(){return c`
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
                    @select-dir=${async r=>{g.selectDir(r.detail.path),await this._ensureLoaded(r.detail.path),g.expandDir(r.detail.path),g.setMobilePane("list")}}
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
      background: var(--cortex-border);
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
      color: var(--cortex-text-subtle);
      text-align: center;
      font-size: var(--cortex-fs-base);
    }
    .mobile-preview {
      flex: 1; min-height: 0; display: flex; flex-direction: column;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
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
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
  `;ee([m()],y.prototype,"_dialog",2);ee([m()],y.prototype,"_toast",2);ee([m()],y.prototype,"_previewPath",2);ee([m()],y.prototype,"_previewContent",2);ee([m()],y.prototype,"_previewLanguage",2);ee([m()],y.prototype,"_previewWritable",2);ee([m()],y.prototype,"_previewPages",2);ee([m()],y.prototype,"_previewError",2);ee([m()],y.prototype,"_previewDirty",2);ee([m()],y.prototype,"_treePaneWidth",2);ee([m()],y.prototype,"_previewPaneWidth",2);y=ee([A("files-view")],y);var jl=Object.defineProperty,ql=Object.getOwnPropertyDescriptor,lr=(e,t,r,i)=>{for(var s=i>1?void 0:i?ql(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=(i?a(t,r,s):a(s))||s);return i&&s&&jl(t,r,s),s};let Ze=class extends ${constructor(){super(...arguments),this.activeView="search",this._menuOpen=!1,this._showSaveAndRevert=!1,this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_onAvatarClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onScopeSelect(e){this._menuOpen=!1,this.dispatchEvent(new CustomEvent("navigate",{detail:{view:"settings",scope:e},bubbles:!0,composed:!0}))}_onSaveClick(){window.dispatchEvent(new CustomEvent("cortex:save-settings"))}_onRevertClick(){this._menuOpen=!1,window.dispatchEvent(new CustomEvent("cortex:revert-settings"))}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick),this._syncFromStore(),this._unsubStore=f.subscribe(()=>this._syncFromStore())}disconnectedCallback(){var e;document.removeEventListener("click",this._onDocClick),(e=this._unsubStore)==null||e.call(this),super.disconnectedCallback()}_syncFromStore(){const e=f.getState();this._showSaveAndRevert=e.view==="settings"&&e.settings.dirty,this.requestUpdate()}render(){return c`
      <div class="brand">
        <span class="logo">🧠</span>
        <span>Doclens</span>
      </div>
      <div class="right-cluster">
        ${this._showSaveAndRevert?c`
          <button class="save-btn" type="button" @click=${this._onSaveClick}>💾 保存</button>
        `:w}
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
    `}};Ze.styles=_`
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
      background: var(--cortex-primary);
      border-radius: var(--cortex-radius-md);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
    }
    .right-cluster {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      position: relative;
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
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-border);
    }
    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0D9488, #0F766E);
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
  `;lr([d()],Ze.prototype,"activeView",2);lr([m()],Ze.prototype,"_menuOpen",2);lr([m()],Ze.prototype,"_showSaveAndRevert",2);Ze=lr([A("app-bar")],Ze);var Vl=Object.getOwnPropertyDescriptor,Xl=(e,t,r,i)=>{for(var s=i>1?void 0:i?Vl(t,r):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(s=a(s)||s);return s};let Or=class extends ${connectedCallback(){super.connectedCallback(),As.init(),this._unsubscribe=f.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}_navigate(e){As.navigate(e.detail.view),e.detail.view==="settings"&&e.detail.scope&&g.setSettingsScope(e.detail.scope)}_renderView(){const e=f.getState().view;return e==="chat"?c`<chat-view></chat-view>`:e==="settings"?c`<settings-view></settings-view>`:e==="files"?c`<files-view></files-view>`:c`<search-view></search-view>`}render(){const e=f.getState().view;return c`
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
    `}};Or.styles=_`
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
  `;Or=Xl([A("cortex-app")],Or);
