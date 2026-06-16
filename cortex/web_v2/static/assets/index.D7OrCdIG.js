(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&o(a)}).observe(document,{childList:!0,subtree:!0});function r(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function o(s){if(s.ep)return;s.ep=!0;const i=r(s);fetch(s.href,i)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const It=globalThis,de=It.ShadowRoot&&(It.ShadyCSS===void 0||It.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,ue=Symbol(),Ae=new WeakMap;let Qe=class{constructor(t,r,o){if(this._$cssResult$=!0,o!==ue)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=r}get styleSheet(){let t=this.o;const r=this.t;if(de&&t===void 0){const o=r!==void 0&&r.length===1;o&&(t=Ae.get(r)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),o&&Ae.set(r,t))}return t}toString(){return this.cssText}};const Sr=e=>new Qe(typeof e=="string"?e:e+"",void 0,ue),v=(e,...t)=>{const r=e.length===1?e[0]:t.reduce((o,s,i)=>o+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[i+1],e[0]);return new Qe(r,e,ue)},kr=(e,t)=>{if(de)e.adoptedStyleSheets=t.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of t){const o=document.createElement("style"),s=It.litNonce;s!==void 0&&o.setAttribute("nonce",s),o.textContent=r.cssText,e.appendChild(o)}},Ee=de?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let r="";for(const o of t.cssRules)r+=o.cssText;return Sr(r)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Cr,defineProperty:Ar,getOwnPropertyDescriptor:Er,getOwnPropertyNames:Tr,getOwnPropertySymbols:Or,getPrototypeOf:Pr}=Object,j=globalThis,Te=j.trustedTypes,zr=Te?Te.emptyScript:"",Jt=j.reactiveElementPolyfillSupport,yt=(e,t)=>e,lt={toAttribute(e,t){switch(t){case Boolean:e=e?zr:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=e!==null;break;case Number:r=e===null?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch{r=null}}return r}},he=(e,t)=>!Cr(e,t),Oe={attribute:!0,type:String,converter:lt,reflect:!1,useDefault:!1,hasChanged:he};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),j.litPropertyMetadata??(j.litPropertyMetadata=new WeakMap);let it=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,r=Oe){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(t,r),!r.noAccessor){const o=Symbol(),s=this.getPropertyDescriptor(t,o,r);s!==void 0&&Ar(this.prototype,t,s)}}static getPropertyDescriptor(t,r,o){const{get:s,set:i}=Er(this.prototype,t)??{get(){return this[r]},set(a){this[r]=a}};return{get:s,set(a){const c=s==null?void 0:s.call(this);i==null||i.call(this,a),this.requestUpdate(t,c,o)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Oe}static _$Ei(){if(this.hasOwnProperty(yt("elementProperties")))return;const t=Pr(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(yt("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(yt("properties"))){const r=this.properties,o=[...Tr(r),...Or(r)];for(const s of o)this.createProperty(s,r[s])}const t=this[Symbol.metadata];if(t!==null){const r=litPropertyMetadata.get(t);if(r!==void 0)for(const[o,s]of r)this.elementProperties.set(o,s)}this._$Eh=new Map;for(const[r,o]of this.elementProperties){const s=this._$Eu(r,o);s!==void 0&&this._$Eh.set(s,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const r=[];if(Array.isArray(t)){const o=new Set(t.flat(1/0).reverse());for(const s of o)r.unshift(Ee(s))}else t!==void 0&&r.push(Ee(t));return r}static _$Eu(t,r){const o=r.attribute;return o===!1?void 0:typeof o=="string"?o:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(r=>r(this))}addController(t){var r;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((r=t.hostConnected)==null||r.call(t))}removeController(t){var r;(r=this._$EO)==null||r.delete(t)}_$E_(){const t=new Map,r=this.constructor.elementProperties;for(const o of r.keys())this.hasOwnProperty(o)&&(t.set(o,this[o]),delete this[o]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return kr(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(r=>{var o;return(o=r.hostConnected)==null?void 0:o.call(r)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(r=>{var o;return(o=r.hostDisconnected)==null?void 0:o.call(r)})}attributeChangedCallback(t,r,o){this._$AK(t,o)}_$ET(t,r){var i;const o=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,o);if(s!==void 0&&o.reflect===!0){const a=(((i=o.converter)==null?void 0:i.toAttribute)!==void 0?o.converter:lt).toAttribute(r,o.type);this._$Em=t,a==null?this.removeAttribute(s):this.setAttribute(s,a),this._$Em=null}}_$AK(t,r){var i,a;const o=this.constructor,s=o._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const c=o.getPropertyOptions(s),d=typeof c.converter=="function"?{fromAttribute:c.converter}:((i=c.converter)==null?void 0:i.fromAttribute)!==void 0?c.converter:lt;this._$Em=s;const h=d.fromAttribute(r,c.type);this[s]=h??((a=this._$Ej)==null?void 0:a.get(s))??h,this._$Em=null}}requestUpdate(t,r,o,s=!1,i){var a;if(t!==void 0){const c=this.constructor;if(s===!1&&(i=this[t]),o??(o=c.getPropertyOptions(t)),!((o.hasChanged??he)(i,r)||o.useDefault&&o.reflect&&i===((a=this._$Ej)==null?void 0:a.get(t))&&!this.hasAttribute(c._$Eu(t,o))))return;this.C(t,r,o)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,r,{useDefault:o,reflect:s,wrapped:i},a){o&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,a??r??this[t]),i!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||o||(r=void 0),this._$AL.set(t,r)),s===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var o;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[i,a]of this._$Ep)this[i]=a;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[i,a]of s){const{wrapped:c}=a,d=this[i];c!==!0||this._$AL.has(i)||d===void 0||this.C(i,void 0,a,d)}}let t=!1;const r=this._$AL;try{t=this.shouldUpdate(r),t?(this.willUpdate(r),(o=this._$EO)==null||o.forEach(s=>{var i;return(i=s.hostUpdate)==null?void 0:i.call(s)}),this.update(r)):this._$EM()}catch(s){throw t=!1,this._$EM(),s}t&&this._$AE(r)}willUpdate(t){}_$AE(t){var r;(r=this._$EO)==null||r.forEach(o=>{var s;return(s=o.hostUpdated)==null?void 0:s.call(o)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(t){}firstUpdated(t){}};it.elementStyles=[],it.shadowRootOptions={mode:"open"},it[yt("elementProperties")]=new Map,it[yt("finalized")]=new Map,Jt==null||Jt({ReactiveElement:it}),(j.reactiveElementVersions??(j.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const _t=globalThis,Pe=e=>e,Rt=_t.trustedTypes,ze=Rt?Rt.createPolicy("lit-html",{createHTML:e=>e}):void 0,Xe="$lit$",V=`lit$${Math.random().toFixed(9).slice(2)}$`,Ze="?"+V,Lr=`<${Ze}>`,et=document,wt=()=>et.createComment(""),xt=e=>e===null||typeof e!="object"&&typeof e!="function",pe=Array.isArray,Ir=e=>pe(e)||typeof(e==null?void 0:e[Symbol.iterator])=="function",Yt=`[ 	
\f\r]`,pt=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Le=/-->/g,Ie=/>/g,K=RegExp(`>|${Yt}(?:([^\\s"'>=/]+)(${Yt}*=${Yt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),De=/'/g,Be=/"/g,tr=/^(?:script|style|textarea|title)$/i,Dr=e=>(t,...r)=>({_$litType$:e,strings:t,values:r}),u=Dr(1),R=Symbol.for("lit-noChange"),x=Symbol.for("lit-nothing"),Re=new WeakMap,Z=et.createTreeWalker(et,129);function er(e,t){if(!pe(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return ze!==void 0?ze.createHTML(t):t}const Br=(e,t)=>{const r=e.length-1,o=[];let s,i=t===2?"<svg>":t===3?"<math>":"",a=pt;for(let c=0;c<r;c++){const d=e[c];let h,g,b=-1,P=0;for(;P<d.length&&(a.lastIndex=P,g=a.exec(d),g!==null);)P=a.lastIndex,a===pt?g[1]==="!--"?a=Le:g[1]!==void 0?a=Ie:g[2]!==void 0?(tr.test(g[2])&&(s=RegExp("</"+g[2],"g")),a=K):g[3]!==void 0&&(a=K):a===K?g[0]===">"?(a=s??pt,b=-1):g[1]===void 0?b=-2:(b=a.lastIndex-g[2].length,h=g[1],a=g[3]===void 0?K:g[3]==='"'?Be:De):a===Be||a===De?a=K:a===Le||a===Ie?a=pt:(a=K,s=void 0);const T=a===K&&e[c+1].startsWith("/>")?" ":"";i+=a===pt?d+Lr:b>=0?(o.push(h),d.slice(0,b)+Xe+d.slice(b)+V+T):d+V+(b===-2?c:T)}return[er(e,i+(e[r]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),o]};class $t{constructor({strings:t,_$litType$:r},o){let s;this.parts=[];let i=0,a=0;const c=t.length-1,d=this.parts,[h,g]=Br(t,r);if(this.el=$t.createElement(h,o),Z.currentNode=this.el.content,r===2||r===3){const b=this.el.content.firstChild;b.replaceWith(...b.childNodes)}for(;(s=Z.nextNode())!==null&&d.length<c;){if(s.nodeType===1){if(s.hasAttributes())for(const b of s.getAttributeNames())if(b.endsWith(Xe)){const P=g[a++],T=s.getAttribute(b).split(V),N=/([.?@])?(.*)/.exec(P);d.push({type:1,index:i,name:N[2],strings:T,ctor:N[1]==="."?Hr:N[1]==="?"?Fr:N[1]==="@"?Mr:jt}),s.removeAttribute(b)}else b.startsWith(V)&&(d.push({type:6,index:i}),s.removeAttribute(b));if(tr.test(s.tagName)){const b=s.textContent.split(V),P=b.length-1;if(P>0){s.textContent=Rt?Rt.emptyScript:"";for(let T=0;T<P;T++)s.append(b[T],wt()),Z.nextNode(),d.push({type:2,index:++i});s.append(b[P],wt())}}}else if(s.nodeType===8)if(s.data===Ze)d.push({type:2,index:i});else{let b=-1;for(;(b=s.data.indexOf(V,b+1))!==-1;)d.push({type:7,index:i}),b+=V.length-1}i++}}static createElement(t,r){const o=et.createElement("template");return o.innerHTML=t,o}}function ct(e,t,r=e,o){var a,c;if(t===R)return t;let s=o!==void 0?(a=r._$Co)==null?void 0:a[o]:r._$Cl;const i=xt(t)?void 0:t._$litDirective$;return(s==null?void 0:s.constructor)!==i&&((c=s==null?void 0:s._$AO)==null||c.call(s,!1),i===void 0?s=void 0:(s=new i(e),s._$AT(e,r,o)),o!==void 0?(r._$Co??(r._$Co=[]))[o]=s:r._$Cl=s),s!==void 0&&(t=ct(e,s._$AS(e,t.values),s,o)),t}class Rr{constructor(t,r){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:r},parts:o}=this._$AD,s=((t==null?void 0:t.creationScope)??et).importNode(r,!0);Z.currentNode=s;let i=Z.nextNode(),a=0,c=0,d=o[0];for(;d!==void 0;){if(a===d.index){let h;d.type===2?h=new Ot(i,i.nextSibling,this,t):d.type===1?h=new d.ctor(i,d.name,d.strings,this,t):d.type===6&&(h=new Nr(i,this,t)),this._$AV.push(h),d=o[++c]}a!==(d==null?void 0:d.index)&&(i=Z.nextNode(),a++)}return Z.currentNode=et,s}p(t){let r=0;for(const o of this._$AV)o!==void 0&&(o.strings!==void 0?(o._$AI(t,o,r),r+=o.strings.length-2):o._$AI(t[r])),r++}}class Ot{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,r,o,s){this.type=2,this._$AH=x,this._$AN=void 0,this._$AA=t,this._$AB=r,this._$AM=o,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=r.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,r=this){t=ct(this,t,r),xt(t)?t===x||t==null||t===""?(this._$AH!==x&&this._$AR(),this._$AH=x):t!==this._$AH&&t!==R&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Ir(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==x&&xt(this._$AH)?this._$AA.nextSibling.data=t:this.T(et.createTextNode(t)),this._$AH=t}$(t){var i;const{values:r,_$litType$:o}=t,s=typeof o=="number"?this._$AC(t):(o.el===void 0&&(o.el=$t.createElement(er(o.h,o.h[0]),this.options)),o);if(((i=this._$AH)==null?void 0:i._$AD)===s)this._$AH.p(r);else{const a=new Rr(s,this),c=a.u(this.options);a.p(r),this.T(c),this._$AH=a}}_$AC(t){let r=Re.get(t.strings);return r===void 0&&Re.set(t.strings,r=new $t(t)),r}k(t){pe(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let o,s=0;for(const i of t)s===r.length?r.push(o=new Ot(this.O(wt()),this.O(wt()),this,this.options)):o=r[s],o._$AI(i),s++;s<r.length&&(this._$AR(o&&o._$AB.nextSibling,s),r.length=s)}_$AR(t=this._$AA.nextSibling,r){var o;for((o=this._$AP)==null?void 0:o.call(this,!1,!0,r);t!==this._$AB;){const s=Pe(t).nextSibling;Pe(t).remove(),t=s}}setConnected(t){var r;this._$AM===void 0&&(this._$Cv=t,(r=this._$AP)==null||r.call(this,t))}}class jt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,r,o,s,i){this.type=1,this._$AH=x,this._$AN=void 0,this.element=t,this.name=r,this._$AM=s,this.options=i,o.length>2||o[0]!==""||o[1]!==""?(this._$AH=Array(o.length-1).fill(new String),this.strings=o):this._$AH=x}_$AI(t,r=this,o,s){const i=this.strings;let a=!1;if(i===void 0)t=ct(this,t,r,0),a=!xt(t)||t!==this._$AH&&t!==R,a&&(this._$AH=t);else{const c=t;let d,h;for(t=i[0],d=0;d<i.length-1;d++)h=ct(this,c[o+d],r,d),h===R&&(h=this._$AH[d]),a||(a=!xt(h)||h!==this._$AH[d]),h===x?t=x:t!==x&&(t+=(h??"")+i[d+1]),this._$AH[d]=h}a&&!s&&this.j(t)}j(t){t===x?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Hr extends jt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===x?void 0:t}}class Fr extends jt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==x)}}class Mr extends jt{constructor(t,r,o,s,i){super(t,r,o,s,i),this.type=5}_$AI(t,r=this){if((t=ct(this,t,r,0)??x)===R)return;const o=this._$AH,s=t===x&&o!==x||t.capture!==o.capture||t.once!==o.once||t.passive!==o.passive,i=t!==x&&(o===x||s);s&&this.element.removeEventListener(this.name,this,o),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,t):this._$AH.handleEvent(t)}}class Nr{constructor(t,r,o){this.element=t,this.type=6,this._$AN=void 0,this._$AM=r,this.options=o}get _$AU(){return this._$AM._$AU}_$AI(t){ct(this,t)}}const Qt=_t.litHtmlPolyfillSupport;Qt==null||Qt($t,Ot),(_t.litHtmlVersions??(_t.litHtmlVersions=[])).push("3.3.3");const Ur=(e,t,r)=>{const o=(r==null?void 0:r.renderBefore)??t;let s=o._$litPart$;if(s===void 0){const i=(r==null?void 0:r.renderBefore)??null;o._$litPart$=s=new Ot(t.insertBefore(wt(),i),i,void 0,r??{})}return s._$AI(e),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const tt=globalThis;let w=class extends it{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const t=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=t.firstChild),t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ur(r,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return R}};var Ye;w._$litElement$=!0,w.finalized=!0,(Ye=tt.litElementHydrateSupport)==null||Ye.call(tt,{LitElement:w});const Xt=tt.litElementPolyfillSupport;Xt==null||Xt({LitElement:w});(tt.litElementVersions??(tt.litElementVersions=[])).push("4.2.2");var Vr=v`
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
`;const ie=new Set,at=new Map;let Y,be="ltr",fe="en";const rr=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(rr){const e=new MutationObserver(sr);be=document.documentElement.dir||"ltr",fe=document.documentElement.lang||navigator.language,e.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function or(...e){e.map(t=>{const r=t.$code.toLowerCase();at.has(r)?at.set(r,Object.assign(Object.assign({},at.get(r)),t)):at.set(r,t),Y||(Y=t)}),sr()}function sr(){rr&&(be=document.documentElement.dir||"ltr",fe=document.documentElement.lang||navigator.language),[...ie.keys()].map(e=>{typeof e.requestUpdate=="function"&&e.requestUpdate()})}let jr=class{constructor(t){this.host=t,this.host.addController(this)}hostConnected(){ie.add(this.host)}hostDisconnected(){ie.delete(this.host)}dir(){return`${this.host.dir||be}`.toLowerCase()}lang(){return`${this.host.lang||fe}`.toLowerCase()}getTranslationData(t){var r,o;let s;try{s=new Intl.Locale(t.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const i=s.language.toLowerCase(),a=(o=(r=s.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&o!==void 0?o:"",c=at.get(`${i}-${a}`),d=at.get(i);return{locale:s,language:i,region:a,primary:c,secondary:d}}exists(t,r){var o;const{primary:s,secondary:i}=this.getTranslationData((o=r.lang)!==null&&o!==void 0?o:this.lang());return r=Object.assign({includeFallback:!1},r),!!(s&&s[t]||i&&i[t]||r.includeFallback&&Y&&Y[t])}term(t,...r){const{primary:o,secondary:s}=this.getTranslationData(this.lang());let i;if(o&&o[t])i=o[t];else if(s&&s[t])i=s[t];else if(Y&&Y[t])i=Y[t];else return console.error(`No translation found for: ${String(t)}`),String(t);return typeof i=="function"?i(...r):i}date(t,r){return t=new Date(t),new Intl.DateTimeFormat(this.lang(),r).format(t)}number(t,r){return t=Number(t),isNaN(t)?"":new Intl.NumberFormat(this.lang(),r).format(t)}relativeTime(t,r,o){return new Intl.RelativeTimeFormat(this.lang(),o).format(t,r)}};var ir={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(e,t)=>`Go to slide ${e} of ${t}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:e=>e===0?"No options selected":e===1?"1 option selected":`${e} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:e=>`Slide ${e}`,toggleColorFormat:"Toggle color format"};or(ir);var qr=ir,rt=class extends jr{};or(qr);var H=v`
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
`,ar=Object.defineProperty,Wr=Object.defineProperties,Kr=Object.getOwnPropertyDescriptor,Gr=Object.getOwnPropertyDescriptors,He=Object.getOwnPropertySymbols,Jr=Object.prototype.hasOwnProperty,Yr=Object.prototype.propertyIsEnumerable,Zt=(e,t)=>(t=Symbol[e])?t:Symbol.for("Symbol."+e),ve=e=>{throw TypeError(e)},Fe=(e,t,r)=>t in e?ar(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,ot=(e,t)=>{for(var r in t||(t={}))Jr.call(t,r)&&Fe(e,r,t[r]);if(He)for(var r of He(t))Yr.call(t,r)&&Fe(e,r,t[r]);return e},me=(e,t)=>Wr(e,Gr(t)),n=(e,t,r,o)=>{for(var s=o>1?void 0:o?Kr(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ar(t,r,s),s},nr=(e,t,r)=>t.has(e)||ve("Cannot "+r),Qr=(e,t,r)=>(nr(e,t,"read from private field"),t.get(e)),Xr=(e,t,r)=>t.has(e)?ve("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),Zr=(e,t,r,o)=>(nr(e,t,"write to private field"),t.set(e,r),r),to=function(e,t){this[0]=e,this[1]=t},eo=e=>{var t=e[Zt("asyncIterator")],r=!1,o,s={};return t==null?(t=e[Zt("iterator")](),o=i=>s[i]=a=>t[i](a)):(t=t.call(e),o=i=>s[i]=a=>{if(r){if(r=!1,i==="throw")throw a;return a}return r=!0,{done:!1,value:new to(new Promise(c=>{var d=t[i](a);d instanceof Object||ve("Object expected"),c(d)}),1)}}),s[Zt("iterator")]=()=>s,o("next"),"throw"in t?o("throw"):s.throw=i=>{throw i},"return"in t&&o("return"),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const k=e=>(t,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ro={attribute:!0,type:String,converter:lt,reflect:!1,hasChanged:he},oo=(e=ro,t,r)=>{const{kind:o,metadata:s}=r;let i=globalThis.litPropertyMetadata.get(s);if(i===void 0&&globalThis.litPropertyMetadata.set(s,i=new Map),o==="setter"&&((e=Object.create(e)).wrapped=!0),i.set(r.name,e),o==="accessor"){const{name:a}=r;return{set(c){const d=t.get.call(this);t.set.call(this,c),this.requestUpdate(a,d,e,!0,c)},init(c){return c!==void 0&&this.C(a,void 0,e,c),c}}}if(o==="setter"){const{name:a}=r;return function(c){const d=this[a];t.call(this,c),this.requestUpdate(a,d,e,!0,c)}}throw Error("Unsupported decorator location: "+o)};function l(e){return(t,r)=>typeof r=="object"?oo(e,t,r):((o,s,i)=>{const a=s.hasOwnProperty(i);return s.constructor.createProperty(i,o),a?Object.getOwnPropertyDescriptor(s,i):void 0})(e,t,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function $(e){return l({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function so(e){return(t,r)=>{const o=typeof t=="function"?t:t[r];Object.assign(o,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const io=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function O(e,t){return(r,o,s)=>{const i=a=>{var c;return((c=a.renderRoot)==null?void 0:c.querySelector(e))??null};return io(r,o,{get(){return i(this)}})}}var Dt,A=class extends w{constructor(){super(),Xr(this,Dt,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([e,t])=>{this.constructor.define(e,t)})}emit(e,t){const r=new CustomEvent(e,ot({bubbles:!0,cancelable:!1,composed:!0,detail:{}},t));return this.dispatchEvent(r),r}static define(e,t=this,r={}){const o=customElements.get(e);if(!o){try{customElements.define(e,t,r)}catch{customElements.define(e,class extends t{},r)}return}let s=" (unknown version)",i=s;"version"in t&&t.version&&(s=" v"+t.version),"version"in o&&o.version&&(i=" v"+o.version),!(s&&i&&s===i)&&console.warn(`Attempted to register <${e}>${s}, but <${e}>${i} has already been registered.`)}attributeChangedCallback(e,t,r){Qr(this,Dt)||(this.constructor.elementProperties.forEach((o,s)=>{o.reflect&&this[s]!=null&&this.initialReflectedProperties.set(s,this[s])}),Zr(this,Dt,!0)),super.attributeChangedCallback(e,t,r)}willUpdate(e){super.willUpdate(e),this.initialReflectedProperties.forEach((t,r)=>{e.has(r)&&this[r]==null&&(this[r]=t)})}};Dt=new WeakMap;A.version="2.20.1";A.dependencies={};n([l()],A.prototype,"dir",2);n([l()],A.prototype,"lang",2);var lr=class extends A{constructor(){super(...arguments),this.localize=new rt(this)}render(){return u`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};lr.styles=[H,Vr];var bt=new WeakMap,ft=new WeakMap,vt=new WeakMap,te=new WeakSet,zt=new WeakMap,cr=class{constructor(e,t){this.handleFormData=r=>{const o=this.options.disabled(this.host),s=this.options.name(this.host),i=this.options.value(this.host),a=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!o&&!a&&typeof s=="string"&&s.length>0&&typeof i<"u"&&(Array.isArray(i)?i.forEach(c=>{r.formData.append(s,c.toString())}):r.formData.append(s,i.toString()))},this.handleFormSubmit=r=>{var o;const s=this.options.disabled(this.host),i=this.options.reportValidity;this.form&&!this.form.noValidate&&((o=bt.get(this.form))==null||o.forEach(a=>{this.setUserInteracted(a,!0)})),this.form&&!this.form.noValidate&&!s&&!i(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),zt.set(this.host,[])},this.handleInteraction=r=>{const o=zt.get(this.host);o.includes(r.type)||o.push(r.type),o.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const o of r)if(typeof o.checkValidity=="function"&&!o.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const o of r)if(typeof o.reportValidity=="function"&&!o.reportValidity())return!1}return!0},(this.host=e).addController(this),this.options=ot({form:r=>{const o=r.form;if(o){const i=r.getRootNode().querySelector(`#${o}`);if(i)return i}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var o;return(o=r.disabled)!=null?o:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,o)=>r.value=o,assumeInteractionOn:["sl-input"]},t)}hostConnected(){const e=this.options.form(this.host);e&&this.attachForm(e),zt.set(this.host,[]),this.options.assumeInteractionOn.forEach(t=>{this.host.addEventListener(t,this.handleInteraction)})}hostDisconnected(){this.detachForm(),zt.delete(this.host),this.options.assumeInteractionOn.forEach(e=>{this.host.removeEventListener(e,this.handleInteraction)})}hostUpdated(){const e=this.options.form(this.host);e||this.detachForm(),e&&this.form!==e&&(this.detachForm(),this.attachForm(e)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(e){e?(this.form=e,bt.has(this.form)?bt.get(this.form).add(this.host):bt.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),ft.has(this.form)||(ft.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),vt.has(this.form)||(vt.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const e=bt.get(this.form);e&&(e.delete(this.host),e.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),ft.has(this.form)&&(this.form.reportValidity=ft.get(this.form),ft.delete(this.form)),vt.has(this.form)&&(this.form.checkValidity=vt.get(this.form),vt.delete(this.form)),this.form=void 0))}setUserInteracted(e,t){t?te.add(e):te.delete(e),e.requestUpdate()}doAction(e,t){if(this.form){const r=document.createElement("button");r.type=e,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",t&&(r.name=t.name,r.value=t.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(o=>{t.hasAttribute(o)&&r.setAttribute(o,t.getAttribute(o))})),this.form.append(r),r.click(),r.remove()}}getForm(){var e;return(e=this.form)!=null?e:null}reset(e){this.doAction("reset",e)}submit(e){this.doAction("submit",e)}setValidity(e){const t=this.host,r=!!te.has(t),o=!!t.required;t.toggleAttribute("data-required",o),t.toggleAttribute("data-optional",!o),t.toggleAttribute("data-invalid",!e),t.toggleAttribute("data-valid",e),t.toggleAttribute("data-user-invalid",!e&&r),t.toggleAttribute("data-user-valid",e&&r)}updateValidity(){const e=this.host;this.setValidity(e.validity.valid)}emitInvalidEvent(e){const t=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});e||t.preventDefault(),this.host.dispatchEvent(t)||e==null||e.preventDefault()}},ge=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(me(ot({},ge),{valid:!1,valueMissing:!0}));Object.freeze(me(ot({},ge),{valid:!1,customError:!0}));var ao=v`
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
`,Pt=class{constructor(e,...t){this.slotNames=[],this.handleSlotChange=r=>{const o=r.target;(this.slotNames.includes("[default]")&&!o.name||o.name&&this.slotNames.includes(o.name))&&this.host.requestUpdate()},(this.host=e).addController(this),this.slotNames=t}hasDefaultSlot(){return[...this.host.childNodes].some(e=>{if(e.nodeType===e.TEXT_NODE&&e.textContent.trim()!=="")return!0;if(e.nodeType===e.ELEMENT_NODE){const t=e;if(t.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!t.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(e){return this.host.querySelector(`:scope > [slot="${e}"]`)!==null}test(e){return e==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(e)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},ae="";function Me(e){ae=e}function no(e=""){if(!ae){const t=[...document.getElementsByTagName("script")],r=t.find(o=>o.hasAttribute("data-shoelace"));if(r)Me(r.getAttribute("data-shoelace"));else{const o=t.find(i=>/shoelace(\.min)?\.js($|\?)/.test(i.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(i.src));let s="";o&&(s=o.getAttribute("src")),Me(s.split("/").slice(0,-1).join("/"))}}return ae.replace(/\/$/,"")+(e?`/${e.replace(/^\//,"")}`:"")}var lo={name:"default",resolver:e=>no(`assets/icons/${e}.svg`)},co=lo,Ne={caret:`
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
  `},uo={name:"system",resolver:e=>e in Ne?`data:image/svg+xml,${encodeURIComponent(Ne[e])}`:""},ho=uo,po=[co,ho],ne=[];function bo(e){ne.push(e)}function fo(e){ne=ne.filter(t=>t!==e)}function Ue(e){return po.find(t=>t.name===e)}var vo=v`
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
`;function E(e,t){const r=ot({waitUntilFirstUpdate:!1},t);return(o,s)=>{const{update:i}=o,a=Array.isArray(e)?e:[e];o.update=function(c){a.forEach(d=>{const h=d;if(c.has(h)){const g=c.get(h),b=this[h];g!==b&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[s](g,b)}}),i.call(this,c)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const mo=(e,t)=>(e==null?void 0:e._$litType$)!==void 0,go=e=>e.strings===void 0,yo={},_o=(e,t=yo)=>e._$AH=t;var mt=Symbol(),Lt=Symbol(),ee,re=new Map,B=class extends A{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(e,t){var r;let o;if(t!=null&&t.spriteSheet)return this.svg=u`<svg part="svg">
        <use part="use" href="${e}"></use>
      </svg>`,this.svg;try{if(o=await fetch(e,{mode:"cors"}),!o.ok)return o.status===410?mt:Lt}catch{return Lt}try{const s=document.createElement("div");s.innerHTML=await o.text();const i=s.firstElementChild;if(((r=i==null?void 0:i.tagName)==null?void 0:r.toLowerCase())!=="svg")return mt;ee||(ee=new DOMParser);const c=ee.parseFromString(i.outerHTML,"text/html").body.querySelector("svg");return c?(c.part.add("svg"),document.adoptNode(c)):mt}catch{return mt}}connectedCallback(){super.connectedCallback(),bo(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),fo(this)}getIconSource(){const e=Ue(this.library);return this.name&&e?{url:e.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var e;const{url:t,fromLibrary:r}=this.getIconSource(),o=r?Ue(this.library):void 0;if(!t){this.svg=null;return}let s=re.get(t);if(s||(s=this.resolveIcon(t,o),re.set(t,s)),!this.initialRender)return;const i=await s;if(i===Lt&&re.delete(t),t===this.getIconSource().url){if(mo(i)){if(this.svg=i,o){await this.updateComplete;const a=this.shadowRoot.querySelector("[part='svg']");typeof o.mutator=="function"&&a&&o.mutator(a)}return}switch(i){case Lt:case mt:this.svg=null,this.emit("sl-error");break;default:this.svg=i.cloneNode(!0),(e=o==null?void 0:o.mutator)==null||e.call(o,this.svg),this.emit("sl-load")}}}render(){return this.svg}};B.styles=[H,vo];n([$()],B.prototype,"svg",2);n([l({reflect:!0})],B.prototype,"name",2);n([l()],B.prototype,"src",2);n([l()],B.prototype,"label",2);n([l({reflect:!0})],B.prototype,"library",2);n([E("label")],B.prototype,"handleLabelChange",1);n([E(["name","src","library"])],B.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const G={ATTRIBUTE:1,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},dr=e=>(...t)=>({_$litDirective$:e,values:t});let ur=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,r,o){this._$Ct=t,this._$AM=r,this._$Ci=o}_$AS(t,r){return this.update(t,r)}update(t,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const D=dr(class extends ur{constructor(e){var t;if(super(e),e.type!==G.ATTRIBUTE||e.name!=="class"||((t=e.strings)==null?void 0:t.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){var o,s;if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in t)t[i]&&!((o=this.nt)!=null&&o.has(i))&&this.st.add(i);return this.render(t)}const r=e.element.classList;for(const i of this.st)i in t||(r.remove(i),this.st.delete(i));for(const i in t){const a=!!t[i];a===this.st.has(i)||(s=this.nt)!=null&&s.has(i)||(a?(r.add(i),this.st.add(i)):(r.remove(i),this.st.delete(i)))}return R}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const hr=Symbol.for(""),wo=e=>{if((e==null?void 0:e.r)===hr)return e==null?void 0:e._$litStatic$},Ht=(e,...t)=>({_$litStatic$:t.reduce((r,o,s)=>r+(i=>{if(i._$litStatic$!==void 0)return i._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${i}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(o)+e[s+1],e[0]),r:hr}),Ve=new Map,xo=e=>(t,...r)=>{const o=r.length;let s,i;const a=[],c=[];let d,h=0,g=!1;for(;h<o;){for(d=t[h];h<o&&(i=r[h],(s=wo(i))!==void 0);)d+=s+t[++h],g=!0;h!==o&&c.push(i),a.push(d),h++}if(h===o&&a.push(t[o]),g){const b=a.join("$$lit$$");(t=Ve.get(b))===void 0&&(a.raw=a,Ve.set(b,t=a)),r=c}return e(t,...r)},Bt=xo(u);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const f=e=>e??x;var m=class extends A{constructor(){super(...arguments),this.formControlController=new cr(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new Pt(this,"[default]","prefix","suffix"),this.localize=new rt(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:ge}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(e){this.isButton()&&(this.button.setCustomValidity(e),this.formControlController.updateValidity())}render(){const e=this.isLink(),t=e?Ht`a`:Ht`button`;return Bt`
      <${t}
        part="base"
        class=${D({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${f(e?void 0:this.disabled)}
        type=${f(e?void 0:this.type)}
        title=${this.title}
        name=${f(e?void 0:this.name)}
        value=${f(e?void 0:this.value)}
        href=${f(e&&!this.disabled?this.href:void 0)}
        target=${f(e?this.target:void 0)}
        download=${f(e?this.download:void 0)}
        rel=${f(e?this.rel:void 0)}
        role=${f(e?void 0:"button")}
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
    `}};m.styles=[H,ao];m.dependencies={"sl-icon":B,"sl-spinner":lr};n([O(".button")],m.prototype,"button",2);n([$()],m.prototype,"hasFocus",2);n([$()],m.prototype,"invalid",2);n([l()],m.prototype,"title",2);n([l({reflect:!0})],m.prototype,"variant",2);n([l({reflect:!0})],m.prototype,"size",2);n([l({type:Boolean,reflect:!0})],m.prototype,"caret",2);n([l({type:Boolean,reflect:!0})],m.prototype,"disabled",2);n([l({type:Boolean,reflect:!0})],m.prototype,"loading",2);n([l({type:Boolean,reflect:!0})],m.prototype,"outline",2);n([l({type:Boolean,reflect:!0})],m.prototype,"pill",2);n([l({type:Boolean,reflect:!0})],m.prototype,"circle",2);n([l()],m.prototype,"type",2);n([l()],m.prototype,"name",2);n([l()],m.prototype,"value",2);n([l()],m.prototype,"href",2);n([l()],m.prototype,"target",2);n([l()],m.prototype,"rel",2);n([l()],m.prototype,"download",2);n([l()],m.prototype,"form",2);n([l({attribute:"formaction"})],m.prototype,"formAction",2);n([l({attribute:"formenctype"})],m.prototype,"formEnctype",2);n([l({attribute:"formmethod"})],m.prototype,"formMethod",2);n([l({attribute:"formnovalidate",type:Boolean})],m.prototype,"formNoValidate",2);n([l({attribute:"formtarget"})],m.prototype,"formTarget",2);n([E("disabled",{waitUntilFirstUpdate:!0})],m.prototype,"handleDisabledChange",1);m.define("sl-button");B.define("sl-icon");var $o=v`
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
`,So=(e="value")=>(t,r)=>{const o=t.constructor,s=o.prototype.attributeChangedCallback;o.prototype.attributeChangedCallback=function(i,a,c){var d;const h=o.getPropertyOptions(e),g=typeof h.attribute=="string"?h.attribute:e;if(i===g){const b=h.converter||lt,T=(typeof b=="function"?b:(d=b==null?void 0:b.fromAttribute)!=null?d:lt.fromAttribute)(c,h.type);this[e]!==T&&(this[r]=T)}s.call(this,i,a,c)}},ko=v`
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
 */const Co=dr(class extends ur{constructor(e){if(super(e),e.type!==G.PROPERTY&&e.type!==G.ATTRIBUTE&&e.type!==G.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!go(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[t]){if(t===R||t===x)return t;const r=e.element,o=e.name;if(e.type===G.PROPERTY){if(t===r[o])return R}else if(e.type===G.BOOLEAN_ATTRIBUTE){if(!!t===r.hasAttribute(o))return R}else if(e.type===G.ATTRIBUTE&&r.getAttribute(o)===t+"")return R;return _o(e),t}});var p=class extends A{constructor(){super(...arguments),this.formControlController=new cr(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new Pt(this,"help-text","label"),this.localize=new rt(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var e;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((e=this.input)==null?void 0:e.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(e){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=e,this.value=this.__dateInput.value}get valueAsNumber(){var e;return this.__numberInput.value=this.value,((e=this.input)==null?void 0:e.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(e){this.__numberInput.valueAsNumber=e,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(e){e.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleKeyDown(e){const t=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;e.key==="Enter"&&!t&&setTimeout(()=>{!e.defaultPrevented&&!e.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(e,t,r="none"){this.input.setSelectionRange(e,t,r)}setRangeText(e,t,r,o="preserve"){const s=t??this.input.selectionStart,i=r??this.input.selectionEnd;this.input.setRangeText(e,s,i,o),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),r=this.label?!0:!!e,o=this.helpText?!0:!!t,i=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return u`
      <div
        part="form-control"
        class=${D({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":o})}
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
            class=${D({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
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
              name=${f(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${f(this.placeholder)}
              minlength=${f(this.minlength)}
              maxlength=${f(this.maxlength)}
              min=${f(this.min)}
              max=${f(this.max)}
              step=${f(this.step)}
              .value=${Co(this.value)}
              autocapitalize=${f(this.autocapitalize)}
              autocomplete=${f(this.autocomplete)}
              autocorrect=${f(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${f(this.pattern)}
              enterkeyhint=${f(this.enterkeyhint)}
              inputmode=${f(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${i?u`
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
            ${this.passwordToggle&&!this.disabled?u`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible?u`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `:u`
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
    `}};p.styles=[H,ko,$o];p.dependencies={"sl-icon":B};n([O(".input__control")],p.prototype,"input",2);n([$()],p.prototype,"hasFocus",2);n([l()],p.prototype,"title",2);n([l({reflect:!0})],p.prototype,"type",2);n([l()],p.prototype,"name",2);n([l()],p.prototype,"value",2);n([So()],p.prototype,"defaultValue",2);n([l({reflect:!0})],p.prototype,"size",2);n([l({type:Boolean,reflect:!0})],p.prototype,"filled",2);n([l({type:Boolean,reflect:!0})],p.prototype,"pill",2);n([l()],p.prototype,"label",2);n([l({attribute:"help-text"})],p.prototype,"helpText",2);n([l({type:Boolean})],p.prototype,"clearable",2);n([l({type:Boolean,reflect:!0})],p.prototype,"disabled",2);n([l()],p.prototype,"placeholder",2);n([l({type:Boolean,reflect:!0})],p.prototype,"readonly",2);n([l({attribute:"password-toggle",type:Boolean})],p.prototype,"passwordToggle",2);n([l({attribute:"password-visible",type:Boolean})],p.prototype,"passwordVisible",2);n([l({attribute:"no-spin-buttons",type:Boolean})],p.prototype,"noSpinButtons",2);n([l({reflect:!0})],p.prototype,"form",2);n([l({type:Boolean,reflect:!0})],p.prototype,"required",2);n([l()],p.prototype,"pattern",2);n([l({type:Number})],p.prototype,"minlength",2);n([l({type:Number})],p.prototype,"maxlength",2);n([l()],p.prototype,"min",2);n([l()],p.prototype,"max",2);n([l()],p.prototype,"step",2);n([l()],p.prototype,"autocapitalize",2);n([l()],p.prototype,"autocorrect",2);n([l()],p.prototype,"autocomplete",2);n([l({type:Boolean})],p.prototype,"autofocus",2);n([l()],p.prototype,"enterkeyhint",2);n([l({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],p.prototype,"spellcheck",2);n([l()],p.prototype,"inputmode",2);n([E("disabled",{waitUntilFirstUpdate:!0})],p.prototype,"handleDisabledChange",1);n([E("step",{waitUntilFirstUpdate:!0})],p.prototype,"handleStepChange",1);n([E("value",{waitUntilFirstUpdate:!0})],p.prototype,"handleValueChange",1);p.define("sl-input");var Ao=v`
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
`,pr=class extends A{constructor(){super(...arguments),this.hasSlotController=new Pt(this,"footer","header","image")}render(){return u`
      <div
        part="base"
        class=${D({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};pr.styles=[H,Ao];pr.define("sl-card");var Eo=v`
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
`,To=v`
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
`,C=class extends A{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(e){this.disabled&&(e.preventDefault(),e.stopPropagation())}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}render(){const e=!!this.href,t=e?Ht`a`:Ht`button`;return Bt`
      <${t}
        part="base"
        class=${D({"icon-button":!0,"icon-button--disabled":!e&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${f(e?void 0:this.disabled)}
        type=${f(e?void 0:"button")}
        href=${f(e?this.href:void 0)}
        target=${f(e?this.target:void 0)}
        download=${f(e?this.download:void 0)}
        rel=${f(e&&this.target?"noreferrer noopener":void 0)}
        role=${f(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${f(this.name)}
          library=${f(this.library)}
          src=${f(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${t}>
    `}};C.styles=[H,To];C.dependencies={"sl-icon":B};n([O(".icon-button")],C.prototype,"button",2);n([$()],C.prototype,"hasFocus",2);n([l()],C.prototype,"name",2);n([l()],C.prototype,"library",2);n([l()],C.prototype,"src",2);n([l()],C.prototype,"href",2);n([l()],C.prototype,"target",2);n([l()],C.prototype,"download",2);n([l()],C.prototype,"label",2);n([l({type:Boolean,reflect:!0})],C.prototype,"disabled",2);var Oo=0,F=class extends A{constructor(){super(...arguments),this.localize=new rt(this),this.attrId=++Oo,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(e){e.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,u`
      <div
        part="base"
        class=${D({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
      >
        <slot></slot>
        ${this.closable?u`
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
    `}};F.styles=[H,Eo];F.dependencies={"sl-icon-button":C};n([O(".tab")],F.prototype,"tab",2);n([l({reflect:!0})],F.prototype,"panel",2);n([l({type:Boolean,reflect:!0})],F.prototype,"active",2);n([l({type:Boolean,reflect:!0})],F.prototype,"closable",2);n([l({type:Boolean,reflect:!0})],F.prototype,"disabled",2);n([l({type:Number,reflect:!0})],F.prototype,"tabIndex",2);n([E("active")],F.prototype,"handleActiveChange",1);n([E("disabled")],F.prototype,"handleDisabledChange",1);F.define("sl-tab");var Po=v`
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
`,zo=v`
  :host {
    display: contents;
  }
`,qt=class extends A{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{this.emit("sl-resize",{detail:{entries:e}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const e=this.shadowRoot.querySelector("slot");if(e!==null){const t=e.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],t.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return u` <slot @slotchange=${this.handleSlotChange}></slot> `}};qt.styles=[H,zo];n([l({type:Boolean,reflect:!0})],qt.prototype,"disabled",2);n([E("disabled",{waitUntilFirstUpdate:!0})],qt.prototype,"handleDisabledChange",1);function Lo(e,t){return{top:Math.round(e.getBoundingClientRect().top-t.getBoundingClientRect().top),left:Math.round(e.getBoundingClientRect().left-t.getBoundingClientRect().left)}}var le=new Set;function Io(){const e=document.documentElement.clientWidth;return Math.abs(window.innerWidth-e)}function Do(){const e=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(e)||!e?0:e}function oe(e){if(le.add(e),!document.documentElement.classList.contains("sl-scroll-lock")){const t=Io()+Do();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),t<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${t}px`)}}function se(e){le.delete(e),le.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function je(e,t,r="vertical",o="smooth"){const s=Lo(e,t),i=s.top+t.scrollTop,a=s.left+t.scrollLeft,c=t.scrollLeft,d=t.scrollLeft+t.offsetWidth,h=t.scrollTop,g=t.scrollTop+t.offsetHeight;(r==="horizontal"||r==="both")&&(a<c?t.scrollTo({left:a,behavior:o}):a+e.clientWidth>d&&t.scrollTo({left:a-t.offsetWidth+e.clientWidth,behavior:o})),(r==="vertical"||r==="both")&&(i<h?t.scrollTo({top:i,behavior:o}):i+e.clientHeight>g&&t.scrollTo({top:i-t.offsetHeight+e.clientHeight,behavior:o}))}var S=class extends A{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new rt(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const e=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{const r=t.filter(({target:o})=>{if(o===this)return!0;if(o.closest("sl-tab-group")!==this)return!1;const s=o.tagName.toLowerCase();return s==="sl-tab"||s==="sl-tab-panel"});if(r.length!==0){if(r.some(o=>!["aria-labelledby","aria-controls"].includes(o.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(o=>o.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(o=>o.attributeName==="active")){const s=r.filter(i=>i.attributeName==="active"&&i.target.tagName.toLowerCase()==="sl-tab").map(i=>i.target).find(i=>i.active);s&&this.setActiveTab(s)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),e.then(()=>{new IntersectionObserver((r,o)=>{var s;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),o.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var e,t;super.disconnectedCallback(),(e=this.mutationObserver)==null||e.disconnect(),this.nav&&((t=this.resizeObserver)==null||t.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(e=>e.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(e=>e.active)}handleClick(e){const r=e.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(e){const r=e.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(e.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),e.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))){const s=this.tabs.find(c=>c.matches(":focus")),i=this.localize.dir()==="rtl";let a=null;if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){if(e.key==="Home")a=this.focusableTabs[0];else if(e.key==="End")a=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&e.key===(i?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&e.key==="ArrowUp"){const c=this.tabs.findIndex(d=>d===s);a=this.findNextFocusableTab(c,"backward")}else if(["top","bottom"].includes(this.placement)&&e.key===(i?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&e.key==="ArrowDown"){const c=this.tabs.findIndex(d=>d===s);a=this.findNextFocusableTab(c,"forward")}if(!a)return;a.tabIndex=0,a.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(a,{scrollBehavior:"smooth"}):this.tabs.forEach(c=>{c.tabIndex=c===a?0:-1}),["top","bottom"].includes(this.placement)&&je(a,this.nav,"horizontal"),e.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(e,t){if(t=ot({emitEvents:!0,scrollBehavior:"auto"},t),e!==this.activeTab&&!e.disabled){const r=this.activeTab;this.activeTab=e,this.tabs.forEach(o=>{o.active=o===this.activeTab,o.tabIndex=o===this.activeTab?0:-1}),this.panels.forEach(o=>{var s;return o.active=o.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&je(this.activeTab,this.nav,"horizontal",t.scrollBehavior),t.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(e=>{const t=this.panels.find(r=>r.name===e.panel);t&&(e.setAttribute("aria-controls",t.getAttribute("id")),t.setAttribute("aria-labelledby",e.getAttribute("id")))})}repositionIndicator(){const e=this.getActiveTab();if(!e)return;const t=e.clientWidth,r=e.clientHeight,o=this.localize.dir()==="rtl",s=this.getAllTabs(),a=s.slice(0,s.indexOf(e)).reduce((c,d)=>({left:c.left+d.clientWidth,top:c.top+d.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${t}px`,this.indicator.style.height="auto",this.indicator.style.translate=o?`${-1*a.left}px`:`${a.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${a.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(e=>!e.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(e,t){let r=null;const o=t==="forward"?1:-1;let s=e+o;for(;e<this.tabs.length;){if(r=this.tabs[s]||null,r===null){t==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;s+=o}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(e){const t=this.tabs.find(r=>r.panel===e);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}render(){const e=this.localize.dir()==="rtl";return u`
      <div
        part="base"
        class=${D({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?u`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${D({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
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

          ${this.hasScrollControls?u`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${D({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
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
    `}};S.styles=[H,Po];S.dependencies={"sl-icon-button":C,"sl-resize-observer":qt};n([O(".tab-group")],S.prototype,"tabGroup",2);n([O(".tab-group__body")],S.prototype,"body",2);n([O(".tab-group__nav")],S.prototype,"nav",2);n([O(".tab-group__indicator")],S.prototype,"indicator",2);n([$()],S.prototype,"hasScrollControls",2);n([$()],S.prototype,"shouldHideScrollStartButton",2);n([$()],S.prototype,"shouldHideScrollEndButton",2);n([l()],S.prototype,"placement",2);n([l()],S.prototype,"activation",2);n([l({attribute:"no-scroll-controls",type:Boolean})],S.prototype,"noScrollControls",2);n([l({attribute:"fixed-scroll-controls",type:Boolean})],S.prototype,"fixedScrollControls",2);n([so({passive:!0})],S.prototype,"updateScrollButtons",1);n([E("noScrollControls",{waitUntilFirstUpdate:!0})],S.prototype,"updateScrollControls",1);n([E("placement",{waitUntilFirstUpdate:!0})],S.prototype,"syncIndicator",1);S.define("sl-tab-group");var Bo=(e,t)=>{let r=0;return function(...o){window.clearTimeout(r),r=window.setTimeout(()=>{e.call(this,...o)},t)}},qe=(e,t,r)=>{const o=e[t];e[t]=function(...s){o.call(this,...s),r.call(this,o,...s)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const t=new Set,r=new WeakMap,o=i=>{for(const a of i.changedTouches)t.add(a.identifier)},s=i=>{for(const a of i.changedTouches)t.delete(a.identifier)};document.addEventListener("touchstart",o,!0),document.addEventListener("touchend",s,!0),document.addEventListener("touchcancel",s,!0),qe(EventTarget.prototype,"addEventListener",function(i,a){if(a!=="scrollend")return;const c=Bo(()=>{t.size?c():this.dispatchEvent(new Event("scrollend"))},100);i.call(this,"scroll",c,{passive:!0}),r.set(this,c)}),qe(EventTarget.prototype,"removeEventListener",function(i,a){if(a!=="scrollend")return;const c=r.get(this);c&&i.call(this,"scroll",c,{passive:!0})})}})();var Ro=v`
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
`;function*ye(e=document.activeElement){e!=null&&(yield e,"shadowRoot"in e&&e.shadowRoot&&e.shadowRoot.mode!=="closed"&&(yield*eo(ye(e.shadowRoot.activeElement))))}function Ho(){return[...ye()].pop()}var We=new WeakMap;function br(e){let t=We.get(e);return t||(t=window.getComputedStyle(e,null),We.set(e,t)),t}function Fo(e){if(typeof e.checkVisibility=="function")return e.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const t=br(e);return t.visibility!=="hidden"&&t.display!=="none"}function Mo(e){const t=br(e),{overflowY:r,overflowX:o}=t;return r==="scroll"||o==="scroll"?!0:r!=="auto"||o!=="auto"?!1:e.scrollHeight>e.clientHeight&&r==="auto"||e.scrollWidth>e.clientWidth&&o==="auto"}function No(e){const t=e.tagName.toLowerCase(),r=Number(e.getAttribute("tabindex"));if(e.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||e.hasAttribute("disabled")||e.closest("[inert]"))return!1;if(t==="input"&&e.getAttribute("type")==="radio"){const i=e.getRootNode(),a=`input[type='radio'][name="${e.getAttribute("name")}"]`,c=i.querySelector(`${a}:checked`);return c?c===e:i.querySelector(a)===e}return Fo(e)?(t==="audio"||t==="video")&&e.hasAttribute("controls")||e.hasAttribute("tabindex")||e.hasAttribute("contenteditable")&&e.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(t)?!0:Mo(e):!1}function Uo(e,t){var r;return((r=e.getRootNode({composed:!0}))==null?void 0:r.host)!==t}function Ke(e){const t=new WeakMap,r=[];function o(s){if(s instanceof Element){if(s.hasAttribute("inert")||s.closest("[inert]")||t.has(s))return;t.set(s,!0),!r.includes(s)&&No(s)&&r.push(s),s instanceof HTMLSlotElement&&Uo(s,e)&&s.assignedElements({flatten:!0}).forEach(i=>{o(i)}),s.shadowRoot!==null&&s.shadowRoot.mode==="open"&&o(s.shadowRoot)}for(const i of s.children)o(i)}return o(e),r.sort((s,i)=>{const a=Number(s.getAttribute("tabindex"))||0;return(Number(i.getAttribute("tabindex"))||0)-a})}var gt=[],Vo=class{constructor(e){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=t=>{var r;if(t.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const o=Ho();if(this.previousFocus=o,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;t.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const s=Ke(this.element);let i=s.findIndex(c=>c===o);this.previousFocus=this.currentFocus;const a=this.tabDirection==="forward"?1:-1;for(;;){i+a>=s.length?i=0:i+a<0?i=s.length-1:i+=a,this.previousFocus=this.currentFocus;const c=s[i];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||c&&this.possiblyHasTabbableChildren(c))return;t.preventDefault(),this.currentFocus=c,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const d=[...ye()];if(d.includes(this.currentFocus)||!d.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=e,this.elementsWithTabbableControls=["iframe"]}activate(){gt.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){gt=gt.filter(e=>e!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return gt[gt.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const e=Ke(this.element);if(!this.element.matches(":focus-within")){const t=e[0],r=e[e.length-1],o=this.tabDirection==="forward"?t:r;typeof(o==null?void 0:o.focus)=="function"&&(this.currentFocus=o,o.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(e){return this.elementsWithTabbableControls.includes(e.tagName.toLowerCase())||e.hasAttribute("controls")}},fr=e=>{var t;const{activeElement:r}=document;r&&e.contains(r)&&((t=document.activeElement)==null||t.blur())},vr=new Map,jo=new WeakMap;function qo(e){return e??{keyframes:[],options:{duration:0}}}function Ge(e,t){return t.toLowerCase()==="rtl"?{keyframes:e.rtlKeyframes||e.keyframes,options:e.options}:e}function z(e,t){vr.set(e,qo(t))}function Q(e,t,r){const o=jo.get(e);if(o!=null&&o[t])return Ge(o[t],r.dir);const s=vr.get(t);return s?Ge(s,r.dir):{keyframes:[],options:{duration:0}}}function Ft(e,t){return new Promise(r=>{function o(s){s.target===e&&(e.removeEventListener(t,o),r())}e.addEventListener(t,o)})}function X(e,t,r){return new Promise(o=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=e.animate(t,me(ot({},r),{duration:Wo()?0:r.duration}));s.addEventListener("cancel",o,{once:!0}),s.addEventListener("finish",o,{once:!0})})}function Wo(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function nt(e){return Promise.all(e.getAnimations().map(t=>new Promise(r=>{t.cancel(),requestAnimationFrame(r)})))}function Je(e){return e.charAt(0).toUpperCase()+e.slice(1)}var L=class extends A{constructor(){super(...arguments),this.hasSlotController=new Pt(this,"footer"),this.localize=new rt(this),this.modal=new Vo(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=e=>{this.contained||e.key==="Escape"&&this.modal.isActive()&&this.open&&(e.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),oe(this)))}disconnectedCallback(){super.disconnectedCallback(),se(this),this.removeOpenListeners()}requestClose(e){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:e}}).defaultPrevented){const r=Q(this,"drawer.denyClose",{dir:this.localize.dir()});X(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var e;"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var e;document.removeEventListener("keydown",this.handleDocumentKeyDown),(e=this.closeWatcher)==null||e.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),oe(this));const e=this.querySelector("[autofocus]");e&&e.removeAttribute("autofocus"),await Promise.all([nt(this.drawer),nt(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(e?e.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),e&&e.setAttribute("autofocus","")});const t=Q(this,`drawer.show${Je(this.placement)}`,{dir:this.localize.dir()}),r=Q(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([X(this.panel,t.keyframes,t.options),X(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{fr(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),se(this)),await Promise.all([nt(this.drawer),nt(this.overlay)]);const e=Q(this,`drawer.hide${Je(this.placement)}`,{dir:this.localize.dir()}),t=Q(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([X(this.overlay,t.keyframes,t.options).then(()=>{this.overlay.hidden=!0}),X(this.panel,e.keyframes,e.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),oe(this)),this.open&&this.contained&&(this.modal.deactivate(),se(this))}async show(){if(!this.open)return this.open=!0,Ft(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Ft(this,"sl-after-hide")}render(){return u`
      <div
        part="base"
        class=${D({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${f(this.noHeader?this.label:void 0)}
          aria-labelledby=${f(this.noHeader?void 0:"title")}
          tabindex="0"
        >
          ${this.noHeader?"":u`
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
    `}};L.styles=[H,Ro];L.dependencies={"sl-icon-button":C};n([O(".drawer")],L.prototype,"drawer",2);n([O(".drawer__panel")],L.prototype,"panel",2);n([O(".drawer__overlay")],L.prototype,"overlay",2);n([l({type:Boolean,reflect:!0})],L.prototype,"open",2);n([l({reflect:!0})],L.prototype,"label",2);n([l({reflect:!0})],L.prototype,"placement",2);n([l({type:Boolean,reflect:!0})],L.prototype,"contained",2);n([l({attribute:"no-header",type:Boolean,reflect:!0})],L.prototype,"noHeader",2);n([E("open",{waitUntilFirstUpdate:!0})],L.prototype,"handleOpenChange",1);n([E("contained",{waitUntilFirstUpdate:!0})],L.prototype,"handleNoModalChange",1);z("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});z("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});z("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});z("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});z("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});z("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});z("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});z("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});z("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});z("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});z("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});L.define("sl-drawer");var Ko=v`
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
`,I=class J extends A{constructor(){super(...arguments),this.hasSlotController=new Pt(this,"icon","suffix"),this.localize=new rt(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var t;(t=this.countdownAnimation)==null||t.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var t;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(t=this.countdownAnimation)==null||t.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:t}=this,r="100%",o="0";this.countdownAnimation=t.animate([{width:r},{width:o}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await nt(this.base),this.base.hidden=!1;const{keyframes:t,options:r}=Q(this,"alert.show",{dir:this.localize.dir()});await X(this.base,t,r),this.emit("sl-after-show")}else{fr(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await nt(this.base);const{keyframes:t,options:r}=Q(this,"alert.hide",{dir:this.localize.dir()});await X(this.base,t,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Ft(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Ft(this,"sl-after-hide")}async toast(){return new Promise(t=>{this.handleCountdownChange(),J.toastStack.parentElement===null&&document.body.append(J.toastStack),J.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{J.toastStack.removeChild(this),t(),J.toastStack.querySelector("sl-alert")===null&&J.toastStack.remove()},{once:!0})})}render(){return u`
      <div
        part="base"
        class=${D({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
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

        ${this.closable?u`
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

        ${this.countdown?u`
              <div
                class=${D({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};I.styles=[H,Ko];I.dependencies={"sl-icon-button":C};n([O('[part~="base"]')],I.prototype,"base",2);n([O(".alert__countdown-elapsed")],I.prototype,"countdownElement",2);n([l({type:Boolean,reflect:!0})],I.prototype,"open",2);n([l({type:Boolean,reflect:!0})],I.prototype,"closable",2);n([l({reflect:!0})],I.prototype,"variant",2);n([l({type:Number})],I.prototype,"duration",2);n([l({type:String,reflect:!0})],I.prototype,"countdown",2);n([$()],I.prototype,"remainingTime",2);n([E("open",{waitUntilFirstUpdate:!0})],I.prototype,"handleOpenChange",1);n([E("duration")],I.prototype,"handleDurationChange",1);var Go=I;z("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});z("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});Go.define("sl-alert");const Jo={view:"search",search:{state:"initial",currentSession:null,query:"",results:[],total:0},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,status:null,error:null};class Yo{constructor(){this.state=Jo,this.listeners=new Set}getState(){return this.state}setState(t){this.state={...this.state,...t},this.listeners.forEach(r=>r(this.state))}subscribe(t){return this.listeners.add(t),()=>this.listeners.delete(t)}subscribeSelector(t,r){let o=t(this.state);return this.subscribe(s=>{const i=t(s);i!==o&&(o=i,r(i))})}}const y=new Yo,_={setView(e){y.setState({view:e})},setSearchState(e){const t=y.getState().search;y.setState({search:{...t,...e}})},setChatState(e){const t=y.getState().chat;y.setState({chat:{...t,...e}})},pushDetail(e){const t=y.getState().detailStack;y.setState({detailStack:[...t,e]})},popDetail(){const e=y.getState().detailStack;e.length!==0&&y.setState({detailStack:e.slice(0,-1)})},setError(e){y.setState({error:e})},setPendingSession(e){y.setState({pendingSession:e})}};var Qo=Object.defineProperty,Xo=Object.getOwnPropertyDescriptor,mr=(e,t,r,o)=>{for(var s=o>1?void 0:o?Xo(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Qo(t,r,s),s};let Mt=class extends w{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"history",icon:"🕘",label:"历史"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return u`
      ${this._items.map(e=>u`
        <button
          class=${this.active===e.id?"active":""}
          title=${e.label}
          @click=${()=>this._select(e.id)}>
          ${e.icon}
        </button>`)}
    `}};Mt.styles=v`
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
  `;mr([l()],Mt.prototype,"active",2);Mt=mr([k("activity-bar")],Mt);var Zo=Object.defineProperty,ts=Object.getOwnPropertyDescriptor,gr=(e,t,r,o)=>{for(var s=o>1?void 0:o?ts(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Zo(t,r,s),s};let Nt=class extends w{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"history",icon:"🕘",label:"历史"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return u`
      ${this._items.map(e=>u`
        <button
          class="tab ${this.active===e.id?"active":""}"
          @click=${()=>this._select(e.id)}>
          <span class="icon">${e.icon}</span>
          <span>${e.label}</span>
        </button>`)}
    `}};Nt.styles=v`
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
  `;gr([l()],Nt.prototype,"active",2);Nt=gr([k("tab-bar")],Nt);var es=Object.defineProperty,rs=Object.getOwnPropertyDescriptor,_e=(e,t,r,o)=>{for(var s=o>1?void 0:o?rs(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&es(t,r,s),s};let St=class extends w{constructor(){super(...arguments),this.heading="Cortex",this.subheading=""}render(){return u`
      <h1 class="title">${this.heading}</h1>
      ${this.subheading?u`<p class="subtitle">${this.subheading}</p>`:null}
    `}};St.styles=v`
    :host {
      display: block;
      padding: var(--cortex-space-8) var(--cortex-space-6) var(--cortex-space-6);
      text-align: center;
      background: linear-gradient(180deg, var(--cortex-primary-soft) 0%, var(--cortex-surface) 100%);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      color: var(--cortex-primary);
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: 13px;
      color: var(--cortex-text-muted);
      margin-top: var(--cortex-space-1);
    }
  `;_e([l()],St.prototype,"heading",2);_e([l()],St.prototype,"subheading",2);St=_e([k("welcome-pane")],St);var os=Object.defineProperty,ss=Object.getOwnPropertyDescriptor,Wt=(e,t,r,o)=>{for(var s=o>1?void 0:o?ss(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&os(t,r,s),s};let dt=class extends w{constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta=""}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}render(){return u`
      <button class="back" @click=${this._back}>← ${this.backLabel}</button>
      <div class="title">${this.title}</div>
      ${this.meta?u`<div class="meta">${this.meta}</div>`:null}
    `}};dt.styles=v`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .back {
      background: none;
      border: none;
      color: var(--cortex-primary);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .back:hover { background: var(--cortex-primary-soft); }
    .title {
      font-weight: 600;
      color: var(--cortex-text);
      font-size: 14px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta { color: var(--cortex-text-subtle); font-size: 12px; }
  `;Wt([l()],dt.prototype,"backLabel",2);Wt([l()],dt.prototype,"title",2);Wt([l()],dt.prototype,"meta",2);dt=Wt([k("focus-header")],dt);var is=Object.defineProperty,as=Object.getOwnPropertyDescriptor,we=(e,t,r,o)=>{for(var s=o>1?void 0:o?as(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&is(t,r,s),s};let kt=class extends w{constructor(){super(...arguments),this.title="历史会话",this.sessions=[]}_onSelect(e){this.dispatchEvent(new CustomEvent("select",{detail:e.detail,bubbles:!0,composed:!0}))}render(){return u`
      <div class="title">${this.title}</div>
      ${this.sessions.length===0?u`<div class="empty">暂无历史会话</div>`:this.sessions.map(e=>u`<history-item .session=${e} @select=${this._onSelect}></history-item>`)}
    `}};kt.styles=v`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
      overflow-y: auto;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cortex-text-subtle);
      margin: 0 0 var(--cortex-space-2) 0;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: 13px;
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;we([l()],kt.prototype,"title",2);we([l({attribute:!1})],kt.prototype,"sessions",2);kt=we([k("history-list")],kt);var ns=Object.defineProperty,ls=Object.getOwnPropertyDescriptor,yr=(e,t,r,o)=>{for(var s=o>1?void 0:o?ls(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ns(t,r,s),s};let Ut=class extends w{constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){return this.session?u`
      <div class="name">${this.session.title}</div>
      <div class="meta">${this.session.message_count} · ${new Date(this.session.updated_at).toLocaleDateString()}</div>
    `:null}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};Ut.styles=v`
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
    .name { font-size: 14px; color: var(--cortex-text); font-weight: 500; }
    .meta { font-size: 11px; color: var(--cortex-text-subtle); }
  `;yr([l({attribute:!1})],Ut.prototype,"session",2);Ut=yr([k("history-item")],Ut);var cs=Object.defineProperty,ds=Object.getOwnPropertyDescriptor,W=(e,t,r,o)=>{for(var s=o>1?void 0:o?ds(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&cs(t,r,s),s};let M=class extends w{constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.multiline=!1,this.disabled=!1}focus(){var e;(e=this.inputEl)==null||e.focus()}get trimmed(){return this.value.trim()}_onInput(e){const t=e.target;this.value=t.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled)}_onKeydown(e){e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&(e.preventDefault(),this._submit()),e.key==="Enter"&&!this.multiline&&!e.shiftKey&&(e.preventDefault(),this._submit())}_submit(){!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}render(){const e=this.multiline?u`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`:u`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;return u`
      <div class="wrapper">
        ${e}
        <button @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${this.buttonIcon?u`<span aria-hidden="true">${this.buttonIcon}</span>`:null}
          <span>${this.buttonLabel}</span>
        </button>
      </div>
    `}};M.styles=v`
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
      font-size: 14px;
      color: var(--cortex-text);
      resize: none;
      min-height: calc(var(--min-h) - 12px);
      line-height: 1.4;
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
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    @media (max-width: 1023px) {
      :host { --min-h: 44px; }
    }
  `;W([l()],M.prototype,"value",2);W([l()],M.prototype,"placeholder",2);W([l()],M.prototype,"buttonLabel",2);W([l()],M.prototype,"buttonIcon",2);W([l({type:Boolean})],M.prototype,"multiline",2);W([l({type:Boolean})],M.prototype,"disabled",2);W([O("input, textarea")],M.prototype,"inputEl",2);M=W([k("input-box")],M);var us=Object.defineProperty,hs=Object.getOwnPropertyDescriptor,xe=(e,t,r,o)=>{for(var s=o>1?void 0:o?hs(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&us(t,r,s),s};let Ct=class extends w{constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}render(){return this.result?u`
      <div class="path">${this.result.path}${this.result.line?`:${this.result.line}`:""}</div>
      <div class="snippet">${this.result.snippet}</div>
    `:null}};Ct.styles=v`
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
    .path { font-size: 11px; color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); }
    .snippet {
      font-size: 13px;
      color: var(--cortex-text);
      margin-top: 4px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    mark {
      background: #FEF3C7;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
  `;xe([l({attribute:!1})],Ct.prototype,"result",2);xe([l({type:Boolean,reflect:!0})],Ct.prototype,"active",2);Ct=xe([k("result-card")],Ct);var ps=Object.defineProperty,bs=Object.getOwnPropertyDescriptor,$e=(e,t,r,o)=>{for(var s=o>1?void 0:o?bs(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ps(t,r,s),s};let At=class extends w{constructor(){super(...arguments),this.results=[],this.activePath=null}_onSelect(e){this.dispatchEvent(new CustomEvent("select",{detail:e.detail,bubbles:!0,composed:!0}))}render(){return u`
      <div class="list-pane">
        ${this.results.length===0?u`<div class="empty">无搜索结果</div>`:this.results.map(e=>u`
              <result-card
                .result=${e}
                ?active=${this.activePath===e.path}
                @select=${this._onSelect}>
              </result-card>`)}
      </div>
    `}};At.styles=v`
    :host {
      display: flex;
      gap: var(--cortex-space-4);
      flex: 1;
      min-height: 0;
    }
    .list-pane {
      flex: 0 0 40%;
      min-width: 280px;
      max-width: 480px;
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
      font-size: 13px;
      text-align: center;
      padding: var(--cortex-space-8);
    }
    /* 桌面：双栏，列表 + 预览；移动：单栏，点击触发 push */
    @media (max-width: 1023px) {
      :host { flex-direction: column; }
      .list-pane {
        flex: 1; max-width: none; min-width: 0;
        border-right: none; border-bottom: 1px solid var(--cortex-border);
      }
    }
  `;$e([l({attribute:!1})],At.prototype,"results",2);$e([l({attribute:!1})],At.prototype,"activePath",2);At=$e([k("search-results")],At);var fs=Object.defineProperty,vs=Object.getOwnPropertyDescriptor,ht=(e,t,r,o)=>{for(var s=o>1?void 0:o?vs(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&fs(t,r,s),s};let q=class extends w{constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1}render(){if(this.loading)return u`<div class="empty">加载中...</div>`;if(!this.content)return u`<div class="empty">点击左侧结果查看预览</div>`;const e=this.content.split(`
`);return u`
      <div class="header">${this.path}</div>
      <div class="body">
        ${e.map((t,r)=>{const o=r+1,s=this.highlights.includes(o)?"highlight":"";return u`<div class=${s}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${o}</span>${t}</div>`})}
      </div>
    `}};q.styles=v`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header {
      font-size: 13px;
      color: var(--cortex-text);
      padding: 10px 14px;
      border-bottom: 1px solid var(--cortex-border);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: 12px 14px;
      font-family: var(--cortex-font-mono);
      font-size: 12px;
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre;
    }
    .highlight { background: #FEF3C7; padding: 0 2px; border-radius: 2px; }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: 13px;
    }
  `;ht([l()],q.prototype,"path",2);ht([l()],q.prototype,"language",2);ht([l()],q.prototype,"content",2);ht([l({attribute:!1})],q.prototype,"highlights",2);ht([l({type:Boolean})],q.prototype,"loading",2);q=ht([k("preview-pane")],q);var ms=Object.defineProperty,gs=Object.getOwnPropertyDescriptor,Kt=(e,t,r,o)=>{for(var s=o>1?void 0:o?gs(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ms(t,r,s),s};let ut=class extends w{constructor(){super(...arguments),this.role="user",this.message=null,this.error=null}render(){return this.message?u`
      <div class="bubble">${this.message.content}${this.message.content===""?u`<span style="opacity:0.6">思考中...</span>`:null}</div>
      ${this.error?u`<div class="error">⚠️ ${this.error}</div>`:null}
    `:null}};ut.styles=v`
    :host {
      display: block;
      max-width: 75%;
    }
    :host([role="user"]) { align-self: flex-end; }
    :host([role="assistant"]) { align-self: flex-start; }
    .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    :host([role="user"]) .bubble {
      background: var(--cortex-primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    :host([role="assistant"]) .bubble {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-bottom-left-radius: 4px;
    }
    .error {
      color: var(--cortex-danger);
      font-size: 12px;
      margin-top: 4px;
    }
  `;Kt([l({reflect:!0})],ut.prototype,"role",2);Kt([l({attribute:!1})],ut.prototype,"message",2);Kt([l()],ut.prototype,"error",2);ut=Kt([k("chat-message")],ut);var ys=Object.defineProperty,_s=Object.getOwnPropertyDescriptor,_r=(e,t,r,o)=>{for(var s=o>1?void 0:o?_s(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&ys(t,r,s),s};let Vt=class extends w{constructor(){super(...arguments),this.messages=[]}updated(){this.scrollTop=this.scrollHeight}render(){return this.messages.length===0?u`<div class="empty">开始与 Cortex 对话</div>`:u`
      ${this.messages.map(e=>u`<chat-message role=${e.role} .message=${e}></chat-message>`)}
    `}};Vt.styles=v`
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
      font-size: 13px;
      text-align: center;
      margin-top: var(--cortex-space-8);
    }
  `;_r([l({attribute:!1})],Vt.prototype,"messages",2);Vt=_r([k("chat-stream")],Vt);class wr extends Error{constructor(t,r,o){super(o),this.status=t,this.code=r,this.name="ApiError"}}async function Gt(e,t={}){const r={...t};t.json!==void 0&&(r.headers={"Content-Type":"application/json",...t.headers||{}},r.body=JSON.stringify(t.json));const o=await fetch(e,r);if(!o.ok){let s;try{s=await o.json()}catch{s={code:"unknown",detail:o.statusText}}throw new wr(o.status,s.code??"unknown",s.detail??"请求失败")}return o.json()}async function*ws(e,t){const r=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!r.ok||!r.body)throw new wr(r.status,"stream_failed","流式请求失败");const o=r.body.getReader(),s=new TextDecoder;let i="";for(;;){const{value:a,done:c}=await o.read();if(c)break;for(i+=s.decode(a,{stream:!0});;){const d=i.match(/\r\n\r\n|\r\r|\n\n/);if(!d||d.index===void 0)break;const h=d.index,g=d[0].length,b=i.slice(0,h);i=i.slice(h+g);let P="message",T="";for(const N of b.split(/\r\n|\r|\n/))N.startsWith("event:")?P=N.slice(6).trim():N.startsWith("data:")&&(T+=N.slice(5).trim());yield{event:P,data:T}}}}async function xs(e){return Gt("/api/search",{method:"POST",json:e})}async function xr(e){return Gt("/api/sessions",{method:"POST",json:e})}async function Se(e){const t=new URLSearchParams;return e.type&&t.set("type",e.type),e.limit&&t.set("limit",String(e.limit)),e.offset&&t.set("offset",String(e.offset)),Gt(`/api/sessions?${t}`,{method:"GET"})}async function $r(e,t,r){return Gt(`/api/sessions/${e}`,{method:"PATCH",json:{items:t,message_count:r}})}var $s=Object.defineProperty,Ss=Object.getOwnPropertyDescriptor,st=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ss(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&$s(t,r,s),s};let U=class extends w{constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.historySessions=[]}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=y.subscribe(()=>this.requestUpdate());const e=y.getState().pendingSession;e&&e.type==="search"&&(_.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await Se({type:"search",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}get viewState(){return y.getState().search}async _submit(e){const t=e.detail.value;this.localQuery=t,_.setSearchState({state:"focus",query:t,results:[],total:0}),this.loading=!0;try{const r=await xs({query:t}),o=await xr({type:"search",title:t,preview:t.slice(0,100)});_.setSearchState({state:"focus",query:t,results:r.results,total:r.total,currentSession:{id:o.id,type:"search",title:t,preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:r.total}}),await $r(o.id,r.results.map(s=>({kind:"result",payload:JSON.stringify(s)})),r.total),this._loadHistory()}catch(r){_.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}}_backToInitial(){_.setSearchState({state:"initial",currentSession:null,results:[],query:""}),this.localQuery="",this._loadHistory()}async _onResultSelect(e){const t=e.detail.result;_.pushDetail(t);try{const r=new URLSearchParams({path:t.path});t.line&&r.set("start_line",String(Math.max(1,t.line-10))),t.line&&r.set("end_line",String(t.line+20));const o=await fetch(`/api/preview?${r}`);if(o.ok){const s=await o.json();this.previewContent=s.content,this.previewPath=s.path,this.previewLanguage=s.language}}catch(r){console.warn("preview failed",r)}}_popDetail(){_.popDetail()}async _loadSession(e){_.setSearchState({state:"focus",currentSession:e,query:e.title});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const o=((await t.json()).items||[]).filter(s=>s.kind==="result").map(s=>JSON.parse(s.payload));_.setSearchState({results:o,total:o.length})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){const e=this.viewState;if(e.state==="initial")return u`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="结构感知文档检索"></welcome-pane>
          <history-list
            title="历史会话"
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="输入搜索关键词..."
              button-label="搜索"
              button-icon="🔍"
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${r=>this.localQuery=r.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const t=y.getState().detailStack[y.getState().detailStack.length-1];return u`
      <div class="focus-body">
        <focus-header
          back-label="新搜索"
          title=${e.query}
          meta=${`${e.total} 条结果`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main">
          <search-results
            .results=${e.results}
            .activePath=${(t==null?void 0:t.path)??null}
            @select=${this._onResultSelect}>
          </search-results>
          <preview-pane
            class="desktop-only"
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}>
          </preview-pane>
        </div>
        <div class="focus-input-bar">
          <input-box
            placeholder="重新搜索..."
            button-label="🔍"
            ?disabled=${this.loading}
            .value=${this.localQuery}
            @input-change=${r=>this.localQuery=r.detail.value}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
      ${t?u`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${t.path}
            @back=${this._popDetail}>
          </focus-header>
          <preview-pane
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}>
          </preview-pane>
        </div>`:null}
    `}};U.styles=v`
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
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .focus-input-bar {
      padding: var(--cortex-space-3) var(--cortex-space-6);
      border-top: 1px solid var(--cortex-border-muted);
      background: var(--cortex-surface);
      flex-shrink: 0;
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
    @media (min-width: 1024px) {
      .detail-overlay { display: none; }
    }
  `;st([$()],U.prototype,"localQuery",2);st([$()],U.prototype,"loading",2);st([$()],U.prototype,"previewContent",2);st([$()],U.prototype,"previewPath",2);st([$()],U.prototype,"previewLanguage",2);st([$()],U.prototype,"historySessions",2);U=st([k("search-view")],U);async function*ks(e){for await(const t of ws("/api/chat",e))if(t.event==="token")try{yield{type:"token",text:JSON.parse(t.data).text}}catch{}else if(t.event==="done")yield{type:"done"};else if(t.event==="error")try{yield{type:"error",detail:JSON.parse(t.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}var Cs=Object.defineProperty,As=Object.getOwnPropertyDescriptor,ke=(e,t,r,o)=>{for(var s=o>1?void 0:o?As(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Cs(t,r,s),s};let Et=class extends w{constructor(){super(...arguments),this.draft="",this.historySessions=[]}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=y.subscribe(()=>this.requestUpdate());const e=y.getState().pendingSession;e&&e.type==="chat"&&(_.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await Se({type:"chat",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}get viewState(){return y.getState().chat}async _submit(e){const t=e.detail.value;if(this.draft="",this.viewState.state==="initial"){const o=await xr({type:"chat",title:t.slice(0,60),preview:t.slice(0,100)});_.setChatState({state:"focus",currentSession:{id:o.id,type:"chat",title:t.slice(0,60),preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:t}],streaming:!0})}else _.setChatState({messages:[...this.viewState.messages,{role:"user",content:t}],streaming:!0});const r=y.getState().chat.currentSession.id;_.setChatState({messages:[...y.getState().chat.messages,{role:"assistant",content:""}]});try{let o="";for await(const s of ks({message:t,session_id:r}))if(s.type==="token"){o+=s.text;const i=[...y.getState().chat.messages];i[i.length-1]={role:"assistant",content:o},_.setChatState({messages:i})}else if(s.type==="error"){const i=[...y.getState().chat.messages];i[i.length-1]={role:"assistant",content:o+`

⚠️ ${s.detail}`},_.setChatState({messages:i})}await $r(r,[{kind:"message_user",payload:JSON.stringify({content:t})},{kind:"message_ai",payload:JSON.stringify({content:o})}],y.getState().chat.messages.length),this._loadHistory()}catch(o){_.setError(`对话失败: ${o.message}`)}finally{_.setChatState({streaming:!1})}}_backToInitial(){_.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}async _loadSession(e){_.setChatState({state:"focus",currentSession:e,messages:[]});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const o=((await t.json()).items||[]).map(s=>{const i=JSON.parse(s.payload);return{role:s.kind==="message_user"?"user":"assistant",content:i.content}});_.setChatState({messages:o})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){var t;const e=this.viewState;return e.state==="initial"?u`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="与你的知识库对话"></welcome-pane>
          <history-list
            title="历史会话"
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="问 Cortex 任何问题..."
              button-label="→"
              multiline
              .value=${this.draft}
              @input-change=${r=>this.draft=r.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `:u`
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${((t=e.currentSession)==null?void 0:t.title)??""}
          meta=${`${e.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <chat-stream .messages=${e.messages}></chat-stream>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            button-label="→"
            multiline
            ?disabled=${e.streaming}
            .value=${this.draft}
            @input-change=${r=>this.draft=r.detail.value}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
    `}};Et.styles=v`
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
  `;ke([$()],Et.prototype,"draft",2);ke([$()],Et.prototype,"historySessions",2);Et=ke([k("chat-view")],Et);var Es=Object.defineProperty,Ts=Object.getOwnPropertyDescriptor,Ce=(e,t,r,o)=>{for(var s=o>1?void 0:o?Ts(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=(o?a(t,r,s):a(s))||s);return o&&s&&Es(t,r,s),s};let Tt=class extends w{constructor(){super(...arguments),this.sessions=[],this.loading=!0}connectedCallback(){super.connectedCallback(),this._load()}async _load(){this.loading=!0;try{const{sessions:e}=await Se({limit:100});this.sessions=e}catch(e){console.warn("load history failed",e)}finally{this.loading=!1}}_onSelect(e){const t=e.detail.session;_.setPendingSession(t),_.setView(t.type==="search"?"search":"chat")}render(){return u`
      <welcome-pane heading="历史会话" subheading="全部搜索与对话历史"></welcome-pane>
      <history-list
        title=${this.loading?"加载中...":"最近会话"}
        .sessions=${this.sessions}
        @select=${this._onSelect}>
      </history-list>
    `}};Tt.styles=v`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
  `;Ce([$()],Tt.prototype,"sessions",2);Ce([$()],Tt.prototype,"loading",2);Tt=Ce([k("history-view")],Tt);var Os=Object.getOwnPropertyDescriptor,Ps=(e,t,r,o)=>{for(var s=o>1?void 0:o?Os(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(s=a(s)||s);return s};let ce=class extends w{connectedCallback(){super.connectedCallback(),this._unsubscribe=y.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}_navigate(e){_.setView(e.detail.view)}_renderView(){const e=y.getState().view;return e==="search"?u`<search-view></search-view>`:e==="chat"?u`<chat-view></chat-view>`:u`<history-view></history-view>`}render(){const e=y.getState().view;return u`
      <activity-bar .active=${e} @navigate=${this._navigate}></activity-bar>
      <div class="main">
        ${this._renderView()}
      </div>
      <tab-bar .active=${e} @navigate=${this._navigate}></tab-bar>
    `}};ce.styles=v`
    :host {
      display: flex;
      flex-direction: row;
      height: 100dvh;
      overflow: hidden;
      background: var(--cortex-bg);
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      position: relative;
    }
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      :host { flex-direction: column; }
    }
  `;ce=Ps([k("cortex-app")],ce);
