var cc=Object.defineProperty;var dc=(e,t,r)=>t in e?cc(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var U=(e,t,r)=>dc(e,typeof t!="symbol"?t+"":t,r);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))i(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const n of s.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function r(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(o){if(o.ep)return;o.ep=!0;const s=r(o);fetch(o.href,s)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Fi=globalThis,gs=Fi.ShadowRoot&&(Fi.ShadyCSS===void 0||Fi.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,vs=Symbol(),wn=new WeakMap;let Oa=class{constructor(t,r,i){if(this._$cssResult$=!0,i!==vs)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=r}get styleSheet(){let t=this.o;const r=this.t;if(gs&&t===void 0){const i=r!==void 0&&r.length===1;i&&(t=wn.get(r)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&wn.set(r,t))}return t}toString(){return this.cssText}};const hc=e=>new Oa(typeof e=="string"?e:e+"",void 0,vs),S=(e,...t)=>{const r=e.length===1?e[0]:t.reduce((i,o,s)=>i+(n=>{if(n._$cssResult$===!0)return n.cssText;if(typeof n=="number")return n;throw Error("Value passed to 'css' function must be a 'css' function result: "+n+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+e[s+1],e[0]);return new Oa(r,e,vs)},uc=(e,t)=>{if(gs)e.adoptedStyleSheets=t.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of t){const i=document.createElement("style"),o=Fi.litNonce;o!==void 0&&i.setAttribute("nonce",o),i.textContent=r.cssText,e.appendChild(i)}},yn=gs?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let r="";for(const i of t.cssRules)r+=i.cssText;return hc(r)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:pc,defineProperty:fc,getOwnPropertyDescriptor:mc,getOwnPropertyNames:bc,getOwnPropertySymbols:gc,getPrototypeOf:vc}=Object,$t=globalThis,kn=$t.trustedTypes,xc=kn?kn.emptyScript:"",Ro=$t.reactiveElementPolyfillSupport,ei=(e,t)=>e,yr={toAttribute(e,t){switch(t){case Boolean:e=e?xc:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=e!==null;break;case Number:r=e===null?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch{r=null}}return r}},xs=(e,t)=>!pc(e,t),$n={attribute:!0,type:String,converter:yr,reflect:!1,useDefault:!1,hasChanged:xs};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),$t.litPropertyMetadata??($t.litPropertyMetadata=new WeakMap);let gr=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,r=$n){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(t,r),!r.noAccessor){const i=Symbol(),o=this.getPropertyDescriptor(t,i,r);o!==void 0&&fc(this.prototype,t,o)}}static getPropertyDescriptor(t,r,i){const{get:o,set:s}=mc(this.prototype,t)??{get(){return this[r]},set(n){this[r]=n}};return{get:o,set(n){const d=o==null?void 0:o.call(this);s==null||s.call(this,n),this.requestUpdate(t,d,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$n}static _$Ei(){if(this.hasOwnProperty(ei("elementProperties")))return;const t=vc(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(ei("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(ei("properties"))){const r=this.properties,i=[...bc(r),...gc(r)];for(const o of i)this.createProperty(o,r[o])}const t=this[Symbol.metadata];if(t!==null){const r=litPropertyMetadata.get(t);if(r!==void 0)for(const[i,o]of r)this.elementProperties.set(i,o)}this._$Eh=new Map;for(const[r,i]of this.elementProperties){const o=this._$Eu(r,i);o!==void 0&&this._$Eh.set(o,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const r=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const o of i)r.unshift(yn(o))}else t!==void 0&&r.push(yn(t));return r}static _$Eu(t,r){const i=r.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(r=>r(this))}addController(t){var r;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((r=t.hostConnected)==null||r.call(t))}removeController(t){var r;(r=this._$EO)==null||r.delete(t)}_$E_(){const t=new Map,r=this.constructor.elementProperties;for(const i of r.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return uc(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(r=>{var i;return(i=r.hostConnected)==null?void 0:i.call(r)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(r=>{var i;return(i=r.hostDisconnected)==null?void 0:i.call(r)})}attributeChangedCallback(t,r,i){this._$AK(t,i)}_$ET(t,r){var s;const i=this.constructor.elementProperties.get(t),o=this.constructor._$Eu(t,i);if(o!==void 0&&i.reflect===!0){const n=(((s=i.converter)==null?void 0:s.toAttribute)!==void 0?i.converter:yr).toAttribute(r,i.type);this._$Em=t,n==null?this.removeAttribute(o):this.setAttribute(o,n),this._$Em=null}}_$AK(t,r){var s,n;const i=this.constructor,o=i._$Eh.get(t);if(o!==void 0&&this._$Em!==o){const d=i.getPropertyOptions(o),c=typeof d.converter=="function"?{fromAttribute:d.converter}:((s=d.converter)==null?void 0:s.fromAttribute)!==void 0?d.converter:yr;this._$Em=o;const f=c.fromAttribute(r,d.type);this[o]=f??((n=this._$Ej)==null?void 0:n.get(o))??f,this._$Em=null}}requestUpdate(t,r,i,o=!1,s){var n;if(t!==void 0){const d=this.constructor;if(o===!1&&(s=this[t]),i??(i=d.getPropertyOptions(t)),!((i.hasChanged??xs)(s,r)||i.useDefault&&i.reflect&&s===((n=this._$Ej)==null?void 0:n.get(t))&&!this.hasAttribute(d._$Eu(t,i))))return;this.C(t,r,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,r,{useDefault:i,reflect:o,wrapped:s},n){i&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,n??r??this[t]),s!==!0||n!==void 0)||(this._$AL.has(t)||(this.hasUpdated||i||(r=void 0),this._$AL.set(t,r)),o===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[s,n]of this._$Ep)this[s]=n;this._$Ep=void 0}const o=this.constructor.elementProperties;if(o.size>0)for(const[s,n]of o){const{wrapped:d}=n,c=this[s];d!==!0||this._$AL.has(s)||c===void 0||this.C(s,void 0,n,c)}}let t=!1;const r=this._$AL;try{t=this.shouldUpdate(r),t?(this.willUpdate(r),(i=this._$EO)==null||i.forEach(o=>{var s;return(s=o.hostUpdate)==null?void 0:s.call(o)}),this.update(r)):this._$EM()}catch(o){throw t=!1,this._$EM(),o}t&&this._$AE(r)}willUpdate(t){}_$AE(t){var r;(r=this._$EO)==null||r.forEach(i=>{var o;return(o=i.hostUpdated)==null?void 0:o.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(t){}firstUpdated(t){}};gr.elementStyles=[],gr.shadowRootOptions={mode:"open"},gr[ei("elementProperties")]=new Map,gr[ei("finalized")]=new Map,Ro==null||Ro({ReactiveElement:gr}),($t.reactiveElementVersions??($t.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ti=globalThis,Sn=e=>e,Hi=ti.trustedTypes,En=Hi?Hi.createPolicy("lit-html",{createHTML:e=>e}):void 0,Ia="$lit$",_t=`lit$${Math.random().toFixed(9).slice(2)}$`,za="?"+_t,_c=`<${za}>`,Yt=document,oi=()=>Yt.createComment(""),si=e=>e===null||typeof e!="object"&&typeof e!="function",_s=Array.isArray,wc=e=>_s(e)||typeof(e==null?void 0:e[Symbol.iterator])=="function",Lo=`[ 	
\f\r]`,Fr=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Cn=/-->/g,Tn=/>/g,Mt=RegExp(`>|${Lo}(?:([^\\s"'>=/]+)(${Lo}*=${Lo}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Pn=/'/g,An=/"/g,Ra=/^(?:script|style|textarea|title)$/i,yc=e=>(t,...r)=>({_$litType$:e,strings:t,values:r}),a=yc(1),Pe=Symbol.for("lit-noChange"),k=Symbol.for("lit-nothing"),Dn=new WeakMap,Vt=Yt.createTreeWalker(Yt,129);function La(e,t){if(!_s(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return En!==void 0?En.createHTML(t):t}const kc=(e,t)=>{const r=e.length-1,i=[];let o,s=t===2?"<svg>":t===3?"<math>":"",n=Fr;for(let d=0;d<r;d++){const c=e[d];let f,p,_=-1,$=0;for(;$<c.length&&(n.lastIndex=$,p=n.exec(c),p!==null);)$=n.lastIndex,n===Fr?p[1]==="!--"?n=Cn:p[1]!==void 0?n=Tn:p[2]!==void 0?(Ra.test(p[2])&&(o=RegExp("</"+p[2],"g")),n=Mt):p[3]!==void 0&&(n=Mt):n===Mt?p[0]===">"?(n=o??Fr,_=-1):p[1]===void 0?_=-2:(_=n.lastIndex-p[2].length,f=p[1],n=p[3]===void 0?Mt:p[3]==='"'?An:Pn):n===An||n===Pn?n=Mt:n===Cn||n===Tn?n=Fr:(n=Mt,o=void 0);const O=n===Mt&&e[d+1].startsWith("/>")?" ":"";s+=n===Fr?c+_c:_>=0?(i.push(f),c.slice(0,_)+Ia+c.slice(_)+_t+O):c+_t+(_===-2?d:O)}return[La(e,s+(e[r]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),i]};class ni{constructor({strings:t,_$litType$:r},i){let o;this.parts=[];let s=0,n=0;const d=t.length-1,c=this.parts,[f,p]=kc(t,r);if(this.el=ni.createElement(f,i),Vt.currentNode=this.el.content,r===2||r===3){const _=this.el.content.firstChild;_.replaceWith(..._.childNodes)}for(;(o=Vt.nextNode())!==null&&c.length<d;){if(o.nodeType===1){if(o.hasAttributes())for(const _ of o.getAttributeNames())if(_.endsWith(Ia)){const $=p[n++],O=o.getAttribute(_).split(_t),y=/([.?@])?(.*)/.exec($);c.push({type:1,index:s,name:y[2],strings:O,ctor:y[1]==="."?Sc:y[1]==="?"?Ec:y[1]==="@"?Cc:ao}),o.removeAttribute(_)}else _.startsWith(_t)&&(c.push({type:6,index:s}),o.removeAttribute(_));if(Ra.test(o.tagName)){const _=o.textContent.split(_t),$=_.length-1;if($>0){o.textContent=Hi?Hi.emptyScript:"";for(let O=0;O<$;O++)o.append(_[O],oi()),Vt.nextNode(),c.push({type:2,index:++s});o.append(_[$],oi())}}}else if(o.nodeType===8)if(o.data===za)c.push({type:2,index:s});else{let _=-1;for(;(_=o.data.indexOf(_t,_+1))!==-1;)c.push({type:7,index:s}),_+=_t.length-1}s++}}static createElement(t,r){const i=Yt.createElement("template");return i.innerHTML=t,i}}function kr(e,t,r=e,i){var n,d;if(t===Pe)return t;let o=i!==void 0?(n=r._$Co)==null?void 0:n[i]:r._$Cl;const s=si(t)?void 0:t._$litDirective$;return(o==null?void 0:o.constructor)!==s&&((d=o==null?void 0:o._$AO)==null||d.call(o,!1),s===void 0?o=void 0:(o=new s(e),o._$AT(e,r,i)),i!==void 0?(r._$Co??(r._$Co=[]))[i]=o:r._$Cl=o),o!==void 0&&(t=kr(e,o._$AS(e,t.values),o,i)),t}class $c{constructor(t,r){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:r},parts:i}=this._$AD,o=((t==null?void 0:t.creationScope)??Yt).importNode(r,!0);Vt.currentNode=o;let s=Vt.nextNode(),n=0,d=0,c=i[0];for(;c!==void 0;){if(n===c.index){let f;c.type===2?f=new pi(s,s.nextSibling,this,t):c.type===1?f=new c.ctor(s,c.name,c.strings,this,t):c.type===6&&(f=new Tc(s,this,t)),this._$AV.push(f),c=i[++d]}n!==(c==null?void 0:c.index)&&(s=Vt.nextNode(),n++)}return Vt.currentNode=Yt,o}p(t){let r=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,r),r+=i.strings.length-2):i._$AI(t[r])),r++}}class pi{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,r,i,o){this.type=2,this._$AH=k,this._$AN=void 0,this._$AA=t,this._$AB=r,this._$AM=i,this.options=o,this._$Cv=(o==null?void 0:o.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=r.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,r=this){t=kr(this,t,r),si(t)?t===k||t==null||t===""?(this._$AH!==k&&this._$AR(),this._$AH=k):t!==this._$AH&&t!==Pe&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):wc(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==k&&si(this._$AH)?this._$AA.nextSibling.data=t:this.T(Yt.createTextNode(t)),this._$AH=t}$(t){var s;const{values:r,_$litType$:i}=t,o=typeof i=="number"?this._$AC(t):(i.el===void 0&&(i.el=ni.createElement(La(i.h,i.h[0]),this.options)),i);if(((s=this._$AH)==null?void 0:s._$AD)===o)this._$AH.p(r);else{const n=new $c(o,this),d=n.u(this.options);n.p(r),this.T(d),this._$AH=n}}_$AC(t){let r=Dn.get(t.strings);return r===void 0&&Dn.set(t.strings,r=new ni(t)),r}k(t){_s(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let i,o=0;for(const s of t)o===r.length?r.push(i=new pi(this.O(oi()),this.O(oi()),this,this.options)):i=r[o],i._$AI(s),o++;o<r.length&&(this._$AR(i&&i._$AB.nextSibling,o),r.length=o)}_$AR(t=this._$AA.nextSibling,r){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,r);t!==this._$AB;){const o=Sn(t).nextSibling;Sn(t).remove(),t=o}}setConnected(t){var r;this._$AM===void 0&&(this._$Cv=t,(r=this._$AP)==null||r.call(this,t))}}let ao=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,r,i,o,s){this.type=1,this._$AH=k,this._$AN=void 0,this.element=t,this.name=r,this._$AM=o,this.options=s,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=k}_$AI(t,r=this,i,o){const s=this.strings;let n=!1;if(s===void 0)t=kr(this,t,r,0),n=!si(t)||t!==this._$AH&&t!==Pe,n&&(this._$AH=t);else{const d=t;let c,f;for(t=s[0],c=0;c<s.length-1;c++)f=kr(this,d[i+c],r,c),f===Pe&&(f=this._$AH[c]),n||(n=!si(f)||f!==this._$AH[c]),f===k?t=k:t!==k&&(t+=(f??"")+s[c+1]),this._$AH[c]=f}n&&!o&&this.j(t)}j(t){t===k?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},Sc=class extends ao{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===k?void 0:t}},Ec=class extends ao{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==k)}},Cc=class extends ao{constructor(t,r,i,o,s){super(t,r,i,o,s),this.type=5}_$AI(t,r=this){if((t=kr(this,t,r,0)??k)===Pe)return;const i=this._$AH,o=t===k&&i!==k||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,s=t!==k&&(i===k||o);o&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,t):this._$AH.handleEvent(t)}},Tc=class{constructor(t,r,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=r,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){kr(this,t)}};const Mo=ti.litHtmlPolyfillSupport;Mo==null||Mo(ni,pi),(ti.litHtmlVersions??(ti.litHtmlVersions=[])).push("3.3.3");const Pc=(e,t,r)=>{const i=(r==null?void 0:r.renderBefore)??t;let o=i._$litPart$;if(o===void 0){const s=(r==null?void 0:r.renderBefore)??null;i._$litPart$=o=new pi(t.insertBefore(oi(),s),s,void 0,r??{})}return o._$AI(e),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Gt=globalThis;let T=class extends gr{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const t=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=t.firstChild),t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Pc(r,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return Pe}};var Da;T._$litElement$=!0,T.finalized=!0,(Da=Gt.litElementHydrateSupport)==null||Da.call(Gt,{LitElement:T});const No=Gt.litElementPolyfillSupport;No==null||No({LitElement:T});(Gt.litElementVersions??(Gt.litElementVersions=[])).push("4.2.2");var Ac=S`
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
`;const Qo=new Set,xr=new Map;let jt,ws="ltr",ys="en";const Ma=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Ma){const e=new MutationObserver(Fa);ws=document.documentElement.dir||"ltr",ys=document.documentElement.lang||navigator.language,e.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Na(...e){e.map(t=>{const r=t.$code.toLowerCase();xr.has(r)?xr.set(r,Object.assign(Object.assign({},xr.get(r)),t)):xr.set(r,t),jt||(jt=t)}),Fa()}function Fa(){Ma&&(ws=document.documentElement.dir||"ltr",ys=document.documentElement.lang||navigator.language),[...Qo.keys()].map(e=>{typeof e.requestUpdate=="function"&&e.requestUpdate()})}let Dc=class{constructor(t){this.host=t,this.host.addController(this)}hostConnected(){Qo.add(this.host)}hostDisconnected(){Qo.delete(this.host)}dir(){return`${this.host.dir||ws}`.toLowerCase()}lang(){return`${this.host.lang||ys}`.toLowerCase()}getTranslationData(t){var r,i;let o;try{o=new Intl.Locale(t.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const s=o.language.toLowerCase(),n=(i=(r=o.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&i!==void 0?i:"",d=xr.get(`${s}-${n}`),c=xr.get(s);return{locale:o,language:s,region:n,primary:d,secondary:c}}exists(t,r){var i;const{primary:o,secondary:s}=this.getTranslationData((i=r.lang)!==null&&i!==void 0?i:this.lang());return r=Object.assign({includeFallback:!1},r),!!(o&&o[t]||s&&s[t]||r.includeFallback&&jt&&jt[t])}term(t,...r){const{primary:i,secondary:o}=this.getTranslationData(this.lang());let s;if(i&&i[t])s=i[t];else if(o&&o[t])s=o[t];else if(jt&&jt[t])s=jt[t];else return console.error(`No translation found for: ${String(t)}`),String(t);return typeof s=="function"?s(...r):s}date(t,r){return t=new Date(t),new Intl.DateTimeFormat(this.lang(),r).format(t)}number(t,r){return t=Number(t),isNaN(t)?"":new Intl.NumberFormat(this.lang(),r).format(t)}relativeTime(t,r,i){return new Intl.RelativeTimeFormat(this.lang(),i).format(t,r)}};var Ba={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(e,t)=>`Go to slide ${e} of ${t}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:e=>e===0?"No options selected":e===1?"1 option selected":`${e} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:e=>`Slide ${e}`,toggleColorFormat:"Toggle color format"};Na(Ba);var Oc=Ba,ir=class extends Dc{};Na(Oc);var je=S`
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
`,ja=Object.defineProperty,Ic=Object.defineProperties,zc=Object.getOwnPropertyDescriptor,Rc=Object.getOwnPropertyDescriptors,On=Object.getOwnPropertySymbols,Lc=Object.prototype.hasOwnProperty,Mc=Object.prototype.propertyIsEnumerable,Fo=(e,t)=>(t=Symbol[e])?t:Symbol.for("Symbol."+e),ks=e=>{throw TypeError(e)},In=(e,t,r)=>t in e?ja(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,or=(e,t)=>{for(var r in t||(t={}))Lc.call(t,r)&&In(e,r,t[r]);if(On)for(var r of On(t))Mc.call(t,r)&&In(e,r,t[r]);return e},$s=(e,t)=>Ic(e,Rc(t)),v=(e,t,r,i)=>{for(var o=i>1?void 0:i?zc(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&ja(t,r,o),o},Ha=(e,t,r)=>t.has(e)||ks("Cannot "+r),Nc=(e,t,r)=>(Ha(e,t,"read from private field"),t.get(e)),Fc=(e,t,r)=>t.has(e)?ks("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),Bc=(e,t,r,i)=>(Ha(e,t,"write to private field"),t.set(e,r),r),jc=function(e,t){this[0]=e,this[1]=t},Hc=e=>{var t=e[Fo("asyncIterator")],r=!1,i,o={};return t==null?(t=e[Fo("iterator")](),i=s=>o[s]=n=>t[s](n)):(t=t.call(e),i=s=>o[s]=n=>{if(r){if(r=!1,s==="throw")throw n;return n}return r=!0,{done:!1,value:new jc(new Promise(d=>{var c=t[s](n);c instanceof Object||ks("Object expected"),d(c)}),1)}}),o[Fo("iterator")]=()=>o,i("next"),"throw"in t?i("throw"):o.throw=s=>{throw s},"return"in t&&i("return"),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const P=e=>(t,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Uc={attribute:!0,type:String,converter:yr,reflect:!1,hasChanged:xs},Wc=(e=Uc,t,r)=>{const{kind:i,metadata:o}=r;let s=globalThis.litPropertyMetadata.get(o);if(s===void 0&&globalThis.litPropertyMetadata.set(o,s=new Map),i==="setter"&&((e=Object.create(e)).wrapped=!0),s.set(r.name,e),i==="accessor"){const{name:n}=r;return{set(d){const c=t.get.call(this);t.set.call(this,d),this.requestUpdate(n,c,e,!0,d)},init(d){return d!==void 0&&this.C(n,void 0,e,d),d}}}if(i==="setter"){const{name:n}=r;return function(d){const c=this[n];t.call(this,d),this.requestUpdate(n,c,e,!0,d)}}throw Error("Unsupported decorator location: "+i)};function h(e){return(t,r)=>typeof r=="object"?Wc(e,t,r):((i,o,s)=>{const n=o.hasOwnProperty(s);return o.constructor.createProperty(s,i),n?Object.getOwnPropertyDescriptor(o,s):void 0})(e,t,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function m(e){return h({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Vc(e){return(t,r)=>{const i=typeof t=="function"?t:t[r];Object.assign(i,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const qc=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function xe(e,t){return(r,i,o)=>{const s=n=>{var d;return((d=n.renderRoot)==null?void 0:d.querySelector(e))??null};return qc(r,i,{get(){return s(this)}})}}var Bi,pe=class extends T{constructor(){super(),Fc(this,Bi,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([e,t])=>{this.constructor.define(e,t)})}emit(e,t){const r=new CustomEvent(e,or({bubbles:!0,cancelable:!1,composed:!0,detail:{}},t));return this.dispatchEvent(r),r}static define(e,t=this,r={}){const i=customElements.get(e);if(!i){try{customElements.define(e,t,r)}catch{customElements.define(e,class extends t{},r)}return}let o=" (unknown version)",s=o;"version"in t&&t.version&&(o=" v"+t.version),"version"in i&&i.version&&(s=" v"+i.version),!(o&&s&&o===s)&&console.warn(`Attempted to register <${e}>${o}, but <${e}>${s} has already been registered.`)}attributeChangedCallback(e,t,r){Nc(this,Bi)||(this.constructor.elementProperties.forEach((i,o)=>{i.reflect&&this[o]!=null&&this.initialReflectedProperties.set(o,this[o])}),Bc(this,Bi,!0)),super.attributeChangedCallback(e,t,r)}willUpdate(e){super.willUpdate(e),this.initialReflectedProperties.forEach((t,r)=>{e.has(r)&&this[r]==null&&(this[r]=t)})}};Bi=new WeakMap;pe.version="2.20.1";pe.dependencies={};v([h()],pe.prototype,"dir",2);v([h()],pe.prototype,"lang",2);var Ua=class extends pe{constructor(){super(...arguments),this.localize=new ir(this)}render(){return a`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};Ua.styles=[je,Ac];var Br=new WeakMap,jr=new WeakMap,Hr=new WeakMap,Bo=new WeakSet,zi=new WeakMap,Wa=class{constructor(e,t){this.handleFormData=r=>{const i=this.options.disabled(this.host),o=this.options.name(this.host),s=this.options.value(this.host),n=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!i&&!n&&typeof o=="string"&&o.length>0&&typeof s<"u"&&(Array.isArray(s)?s.forEach(d=>{r.formData.append(o,d.toString())}):r.formData.append(o,s.toString()))},this.handleFormSubmit=r=>{var i;const o=this.options.disabled(this.host),s=this.options.reportValidity;this.form&&!this.form.noValidate&&((i=Br.get(this.form))==null||i.forEach(n=>{this.setUserInteracted(n,!0)})),this.form&&!this.form.noValidate&&!o&&!s(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),zi.set(this.host,[])},this.handleInteraction=r=>{const i=zi.get(this.host);i.includes(r.type)||i.push(r.type),i.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.checkValidity=="function"&&!i.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.reportValidity=="function"&&!i.reportValidity())return!1}return!0},(this.host=e).addController(this),this.options=or({form:r=>{const i=r.form;if(i){const s=r.getRootNode().querySelector(`#${i}`);if(s)return s}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var i;return(i=r.disabled)!=null?i:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,i)=>r.value=i,assumeInteractionOn:["sl-input"]},t)}hostConnected(){const e=this.options.form(this.host);e&&this.attachForm(e),zi.set(this.host,[]),this.options.assumeInteractionOn.forEach(t=>{this.host.addEventListener(t,this.handleInteraction)})}hostDisconnected(){this.detachForm(),zi.delete(this.host),this.options.assumeInteractionOn.forEach(e=>{this.host.removeEventListener(e,this.handleInteraction)})}hostUpdated(){const e=this.options.form(this.host);e||this.detachForm(),e&&this.form!==e&&(this.detachForm(),this.attachForm(e)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(e){e?(this.form=e,Br.has(this.form)?Br.get(this.form).add(this.host):Br.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),jr.has(this.form)||(jr.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),Hr.has(this.form)||(Hr.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const e=Br.get(this.form);e&&(e.delete(this.host),e.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),jr.has(this.form)&&(this.form.reportValidity=jr.get(this.form),jr.delete(this.form)),Hr.has(this.form)&&(this.form.checkValidity=Hr.get(this.form),Hr.delete(this.form)),this.form=void 0))}setUserInteracted(e,t){t?Bo.add(e):Bo.delete(e),e.requestUpdate()}doAction(e,t){if(this.form){const r=document.createElement("button");r.type=e,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",t&&(r.name=t.name,r.value=t.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(i=>{t.hasAttribute(i)&&r.setAttribute(i,t.getAttribute(i))})),this.form.append(r),r.click(),r.remove()}}getForm(){var e;return(e=this.form)!=null?e:null}reset(e){this.doAction("reset",e)}submit(e){this.doAction("submit",e)}setValidity(e){const t=this.host,r=!!Bo.has(t),i=!!t.required;t.toggleAttribute("data-required",i),t.toggleAttribute("data-optional",!i),t.toggleAttribute("data-invalid",!e),t.toggleAttribute("data-valid",e),t.toggleAttribute("data-user-invalid",!e&&r),t.toggleAttribute("data-user-valid",e&&r)}updateValidity(){const e=this.host;this.setValidity(e.validity.valid)}emitInvalidEvent(e){const t=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});e||t.preventDefault(),this.host.dispatchEvent(t)||e==null||e.preventDefault()}},Ss=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze($s(or({},Ss),{valid:!1,valueMissing:!0}));Object.freeze($s(or({},Ss),{valid:!1,customError:!0}));var Gc=S`
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
`,fi=class{constructor(e,...t){this.slotNames=[],this.handleSlotChange=r=>{const i=r.target;(this.slotNames.includes("[default]")&&!i.name||i.name&&this.slotNames.includes(i.name))&&this.host.requestUpdate()},(this.host=e).addController(this),this.slotNames=t}hasDefaultSlot(){return[...this.host.childNodes].some(e=>{if(e.nodeType===e.TEXT_NODE&&e.textContent.trim()!=="")return!0;if(e.nodeType===e.ELEMENT_NODE){const t=e;if(t.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!t.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(e){return this.host.querySelector(`:scope > [slot="${e}"]`)!==null}test(e){return e==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(e)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},es="";function zn(e){es=e}function Xc(e=""){if(!es){const t=[...document.getElementsByTagName("script")],r=t.find(i=>i.hasAttribute("data-shoelace"));if(r)zn(r.getAttribute("data-shoelace"));else{const i=t.find(s=>/shoelace(\.min)?\.js($|\?)/.test(s.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(s.src));let o="";i&&(o=i.getAttribute("src")),zn(o.split("/").slice(0,-1).join("/"))}}return es.replace(/\/$/,"")+(e?`/${e.replace(/^\//,"")}`:"")}var Yc={name:"default",resolver:e=>Xc(`assets/icons/${e}.svg`)},Kc=Yc,Rn={caret:`
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
  `},Zc={name:"system",resolver:e=>e in Rn?`data:image/svg+xml,${encodeURIComponent(Rn[e])}`:""},Jc=Zc,Qc=[Kc,Jc],ts=[];function ed(e){ts.push(e)}function td(e){ts=ts.filter(t=>t!==e)}function Ln(e){return Qc.find(t=>t.name===e)}var rd=S`
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
`;function fe(e,t){const r=or({waitUntilFirstUpdate:!1},t);return(i,o)=>{const{update:s}=i,n=Array.isArray(e)?e:[e];i.update=function(d){n.forEach(c=>{const f=c;if(d.has(f)){const p=d.get(f),_=this[f];p!==_&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[o](p,_)}}),s.call(this,d)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const id=(e,t)=>(e==null?void 0:e._$litType$)!==void 0,od=e=>e.strings===void 0,sd={},nd=(e,t=sd)=>e._$AH=t;var Ur=Symbol(),Ri=Symbol(),jo,Ho=new Map,Re=class extends pe{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(e,t){var r;let i;if(t!=null&&t.spriteSheet)return this.svg=a`<svg part="svg">
        <use part="use" href="${e}"></use>
      </svg>`,this.svg;try{if(i=await fetch(e,{mode:"cors"}),!i.ok)return i.status===410?Ur:Ri}catch{return Ri}try{const o=document.createElement("div");o.innerHTML=await i.text();const s=o.firstElementChild;if(((r=s==null?void 0:s.tagName)==null?void 0:r.toLowerCase())!=="svg")return Ur;jo||(jo=new DOMParser);const d=jo.parseFromString(s.outerHTML,"text/html").body.querySelector("svg");return d?(d.part.add("svg"),document.adoptNode(d)):Ur}catch{return Ur}}connectedCallback(){super.connectedCallback(),ed(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),td(this)}getIconSource(){const e=Ln(this.library);return this.name&&e?{url:e.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var e;const{url:t,fromLibrary:r}=this.getIconSource(),i=r?Ln(this.library):void 0;if(!t){this.svg=null;return}let o=Ho.get(t);if(o||(o=this.resolveIcon(t,i),Ho.set(t,o)),!this.initialRender)return;const s=await o;if(s===Ri&&Ho.delete(t),t===this.getIconSource().url){if(id(s)){if(this.svg=s,i){await this.updateComplete;const n=this.shadowRoot.querySelector("[part='svg']");typeof i.mutator=="function"&&n&&i.mutator(n)}return}switch(s){case Ri:case Ur:this.svg=null,this.emit("sl-error");break;default:this.svg=s.cloneNode(!0),(e=i==null?void 0:i.mutator)==null||e.call(i,this.svg),this.emit("sl-load")}}}render(){return this.svg}};Re.styles=[je,rd];v([m()],Re.prototype,"svg",2);v([h({reflect:!0})],Re.prototype,"name",2);v([h()],Re.prototype,"src",2);v([h()],Re.prototype,"label",2);v([h({reflect:!0})],Re.prototype,"library",2);v([fe("label")],Re.prototype,"handleLabelChange",1);v([fe(["name","src","library"])],Re.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const vt={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},Es=e=>(...t)=>({_$litDirective$:e,values:t});let Cs=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,r,i){this._$Ct=t,this._$AM=r,this._$Ci=i}_$AS(t,r){return this.update(t,r)}update(t,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ae=Es(class extends Cs{constructor(e){var t;if(super(e),e.type!==vt.ATTRIBUTE||e.name!=="class"||((t=e.strings)==null?void 0:t.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){var i,o;if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(s=>s!=="")));for(const s in t)t[s]&&!((i=this.nt)!=null&&i.has(s))&&this.st.add(s);return this.render(t)}const r=e.element.classList;for(const s of this.st)s in t||(r.remove(s),this.st.delete(s));for(const s in t){const n=!!t[s];n===this.st.has(s)||(o=this.nt)!=null&&o.has(s)||(n?(r.add(s),this.st.add(s)):(r.remove(s),this.st.delete(s)))}return Pe}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Va=Symbol.for(""),ad=e=>{if((e==null?void 0:e.r)===Va)return e==null?void 0:e._$litStatic$},Ui=(e,...t)=>({_$litStatic$:t.reduce((r,i,o)=>r+(s=>{if(s._$litStatic$!==void 0)return s._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${s}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(i)+e[o+1],e[0]),r:Va}),Mn=new Map,ld=e=>(t,...r)=>{const i=r.length;let o,s;const n=[],d=[];let c,f=0,p=!1;for(;f<i;){for(c=t[f];f<i&&(s=r[f],(o=ad(s))!==void 0);)c+=o+t[++f],p=!0;f!==i&&d.push(s),n.push(c),f++}if(f===i&&n.push(t[i]),p){const _=n.join("$$lit$$");(t=Mn.get(_))===void 0&&(n.raw=n,Mn.set(_,t=n)),r=d}return e(t,...r)},ji=ld(a);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const L=e=>e??k;var j=class extends pe{constructor(){super(...arguments),this.formControlController=new Wa(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new fi(this,"[default]","prefix","suffix"),this.localize=new ir(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Ss}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(e){this.isButton()&&(this.button.setCustomValidity(e),this.formControlController.updateValidity())}render(){const e=this.isLink(),t=e?Ui`a`:Ui`button`;return ji`
      <${t}
        part="base"
        class=${Ae({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${L(e?void 0:this.disabled)}
        type=${L(e?void 0:this.type)}
        title=${this.title}
        name=${L(e?void 0:this.name)}
        value=${L(e?void 0:this.value)}
        href=${L(e&&!this.disabled?this.href:void 0)}
        target=${L(e?this.target:void 0)}
        download=${L(e?this.download:void 0)}
        rel=${L(e?this.rel:void 0)}
        role=${L(e?void 0:"button")}
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
        ${this.caret?ji` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?ji`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${t}>
    `}};j.styles=[je,Gc];j.dependencies={"sl-icon":Re,"sl-spinner":Ua};v([xe(".button")],j.prototype,"button",2);v([m()],j.prototype,"hasFocus",2);v([m()],j.prototype,"invalid",2);v([h()],j.prototype,"title",2);v([h({reflect:!0})],j.prototype,"variant",2);v([h({reflect:!0})],j.prototype,"size",2);v([h({type:Boolean,reflect:!0})],j.prototype,"caret",2);v([h({type:Boolean,reflect:!0})],j.prototype,"disabled",2);v([h({type:Boolean,reflect:!0})],j.prototype,"loading",2);v([h({type:Boolean,reflect:!0})],j.prototype,"outline",2);v([h({type:Boolean,reflect:!0})],j.prototype,"pill",2);v([h({type:Boolean,reflect:!0})],j.prototype,"circle",2);v([h()],j.prototype,"type",2);v([h()],j.prototype,"name",2);v([h()],j.prototype,"value",2);v([h()],j.prototype,"href",2);v([h()],j.prototype,"target",2);v([h()],j.prototype,"rel",2);v([h()],j.prototype,"download",2);v([h()],j.prototype,"form",2);v([h({attribute:"formaction"})],j.prototype,"formAction",2);v([h({attribute:"formenctype"})],j.prototype,"formEnctype",2);v([h({attribute:"formmethod"})],j.prototype,"formMethod",2);v([h({attribute:"formnovalidate",type:Boolean})],j.prototype,"formNoValidate",2);v([h({attribute:"formtarget"})],j.prototype,"formTarget",2);v([fe("disabled",{waitUntilFirstUpdate:!0})],j.prototype,"handleDisabledChange",1);j.define("sl-button");Re.define("sl-icon");var cd=S`
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
`,dd=(e="value")=>(t,r)=>{const i=t.constructor,o=i.prototype.attributeChangedCallback;i.prototype.attributeChangedCallback=function(s,n,d){var c;const f=i.getPropertyOptions(e),p=typeof f.attribute=="string"?f.attribute:e;if(s===p){const _=f.converter||yr,O=(typeof _=="function"?_:(c=_==null?void 0:_.fromAttribute)!=null?c:yr.fromAttribute)(d,f.type);this[e]!==O&&(this[r]=O)}o.call(this,s,n,d)}},hd=S`
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
 */const ud=Es(class extends Cs{constructor(e){if(super(e),e.type!==vt.PROPERTY&&e.type!==vt.ATTRIBUTE&&e.type!==vt.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!od(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[t]){if(t===Pe||t===k)return t;const r=e.element,i=e.name;if(e.type===vt.PROPERTY){if(t===r[i])return Pe}else if(e.type===vt.BOOLEAN_ATTRIBUTE){if(!!t===r.hasAttribute(i))return Pe}else if(e.type===vt.ATTRIBUTE&&r.getAttribute(i)===t+"")return Pe;return nd(e),t}});var I=class extends pe{constructor(){super(...arguments),this.formControlController=new Wa(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new fi(this,"help-text","label"),this.localize=new ir(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var e;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((e=this.input)==null?void 0:e.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(e){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=e,this.value=this.__dateInput.value}get valueAsNumber(){var e;return this.__numberInput.value=this.value,((e=this.input)==null?void 0:e.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(e){this.__numberInput.valueAsNumber=e,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(e){e.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleKeyDown(e){const t=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;e.key==="Enter"&&!t&&setTimeout(()=>{!e.defaultPrevented&&!e.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(e,t,r="none"){this.input.setSelectionRange(e,t,r)}setRangeText(e,t,r,i="preserve"){const o=t??this.input.selectionStart,s=r??this.input.selectionEnd;this.input.setRangeText(e,o,s,i),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),r=this.label?!0:!!e,i=this.helpText?!0:!!t,s=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return a`
      <div
        part="form-control"
        class=${Ae({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":i})}
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
            class=${Ae({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
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
              name=${L(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${L(this.placeholder)}
              minlength=${L(this.minlength)}
              maxlength=${L(this.maxlength)}
              min=${L(this.min)}
              max=${L(this.max)}
              step=${L(this.step)}
              .value=${ud(this.value)}
              autocapitalize=${L(this.autocapitalize)}
              autocomplete=${L(this.autocomplete)}
              autocorrect=${L(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${L(this.pattern)}
              enterkeyhint=${L(this.enterkeyhint)}
              inputmode=${L(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${s?a`
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
            ${this.passwordToggle&&!this.disabled?a`
                  <button
                    part="password-toggle-button"
                    class="input__password-toggle"
                    type="button"
                    aria-label=${this.localize.term(this.passwordVisible?"hidePassword":"showPassword")}
                    @click=${this.handlePasswordToggle}
                    tabindex="-1"
                  >
                    ${this.passwordVisible?a`
                          <slot name="show-password-icon">
                            <sl-icon name="eye-slash" library="system"></sl-icon>
                          </slot>
                        `:a`
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
    `}};I.styles=[je,hd,cd];I.dependencies={"sl-icon":Re};v([xe(".input__control")],I.prototype,"input",2);v([m()],I.prototype,"hasFocus",2);v([h()],I.prototype,"title",2);v([h({reflect:!0})],I.prototype,"type",2);v([h()],I.prototype,"name",2);v([h()],I.prototype,"value",2);v([dd()],I.prototype,"defaultValue",2);v([h({reflect:!0})],I.prototype,"size",2);v([h({type:Boolean,reflect:!0})],I.prototype,"filled",2);v([h({type:Boolean,reflect:!0})],I.prototype,"pill",2);v([h()],I.prototype,"label",2);v([h({attribute:"help-text"})],I.prototype,"helpText",2);v([h({type:Boolean})],I.prototype,"clearable",2);v([h({type:Boolean,reflect:!0})],I.prototype,"disabled",2);v([h()],I.prototype,"placeholder",2);v([h({type:Boolean,reflect:!0})],I.prototype,"readonly",2);v([h({attribute:"password-toggle",type:Boolean})],I.prototype,"passwordToggle",2);v([h({attribute:"password-visible",type:Boolean})],I.prototype,"passwordVisible",2);v([h({attribute:"no-spin-buttons",type:Boolean})],I.prototype,"noSpinButtons",2);v([h({reflect:!0})],I.prototype,"form",2);v([h({type:Boolean,reflect:!0})],I.prototype,"required",2);v([h()],I.prototype,"pattern",2);v([h({type:Number})],I.prototype,"minlength",2);v([h({type:Number})],I.prototype,"maxlength",2);v([h()],I.prototype,"min",2);v([h()],I.prototype,"max",2);v([h()],I.prototype,"step",2);v([h()],I.prototype,"autocapitalize",2);v([h()],I.prototype,"autocorrect",2);v([h()],I.prototype,"autocomplete",2);v([h({type:Boolean})],I.prototype,"autofocus",2);v([h()],I.prototype,"enterkeyhint",2);v([h({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],I.prototype,"spellcheck",2);v([h()],I.prototype,"inputmode",2);v([fe("disabled",{waitUntilFirstUpdate:!0})],I.prototype,"handleDisabledChange",1);v([fe("step",{waitUntilFirstUpdate:!0})],I.prototype,"handleStepChange",1);v([fe("value",{waitUntilFirstUpdate:!0})],I.prototype,"handleValueChange",1);I.define("sl-input");var pd=S`
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
`,qa=class extends pe{constructor(){super(...arguments),this.hasSlotController=new fi(this,"footer","header","image")}render(){return a`
      <div
        part="base"
        class=${Ae({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};qa.styles=[je,pd];qa.define("sl-card");var fd=S`
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
`,md=S`
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
`,ce=class extends pe{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(e){this.disabled&&(e.preventDefault(),e.stopPropagation())}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}render(){const e=!!this.href,t=e?Ui`a`:Ui`button`;return ji`
      <${t}
        part="base"
        class=${Ae({"icon-button":!0,"icon-button--disabled":!e&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${L(e?void 0:this.disabled)}
        type=${L(e?void 0:"button")}
        href=${L(e?this.href:void 0)}
        target=${L(e?this.target:void 0)}
        download=${L(e?this.download:void 0)}
        rel=${L(e&&this.target?"noreferrer noopener":void 0)}
        role=${L(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${L(this.name)}
          library=${L(this.library)}
          src=${L(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${t}>
    `}};ce.styles=[je,md];ce.dependencies={"sl-icon":Re};v([xe(".icon-button")],ce.prototype,"button",2);v([m()],ce.prototype,"hasFocus",2);v([h()],ce.prototype,"name",2);v([h()],ce.prototype,"library",2);v([h()],ce.prototype,"src",2);v([h()],ce.prototype,"href",2);v([h()],ce.prototype,"target",2);v([h()],ce.prototype,"download",2);v([h()],ce.prototype,"label",2);v([h({type:Boolean,reflect:!0})],ce.prototype,"disabled",2);var bd=0,He=class extends pe{constructor(){super(...arguments),this.localize=new ir(this),this.attrId=++bd,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(e){e.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,a`
      <div
        part="base"
        class=${Ae({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
      >
        <slot></slot>
        ${this.closable?a`
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
    `}};He.styles=[je,fd];He.dependencies={"sl-icon-button":ce};v([xe(".tab")],He.prototype,"tab",2);v([h({reflect:!0})],He.prototype,"panel",2);v([h({type:Boolean,reflect:!0})],He.prototype,"active",2);v([h({type:Boolean,reflect:!0})],He.prototype,"closable",2);v([h({type:Boolean,reflect:!0})],He.prototype,"disabled",2);v([h({type:Number,reflect:!0})],He.prototype,"tabIndex",2);v([fe("active")],He.prototype,"handleActiveChange",1);v([fe("disabled")],He.prototype,"handleDisabledChange",1);He.define("sl-tab");var gd=S`
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
`,vd=S`
  :host {
    display: contents;
  }
`,lo=class extends pe{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{this.emit("sl-resize",{detail:{entries:e}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const e=this.shadowRoot.querySelector("slot");if(e!==null){const t=e.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],t.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return a` <slot @slotchange=${this.handleSlotChange}></slot> `}};lo.styles=[je,vd];v([h({type:Boolean,reflect:!0})],lo.prototype,"disabled",2);v([fe("disabled",{waitUntilFirstUpdate:!0})],lo.prototype,"handleDisabledChange",1);function xd(e,t){return{top:Math.round(e.getBoundingClientRect().top-t.getBoundingClientRect().top),left:Math.round(e.getBoundingClientRect().left-t.getBoundingClientRect().left)}}var rs=new Set;function _d(){const e=document.documentElement.clientWidth;return Math.abs(window.innerWidth-e)}function wd(){const e=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(e)||!e?0:e}function Uo(e){if(rs.add(e),!document.documentElement.classList.contains("sl-scroll-lock")){const t=_d()+wd();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),t<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${t}px`)}}function Wo(e){rs.delete(e),rs.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function Nn(e,t,r="vertical",i="smooth"){const o=xd(e,t),s=o.top+t.scrollTop,n=o.left+t.scrollLeft,d=t.scrollLeft,c=t.scrollLeft+t.offsetWidth,f=t.scrollTop,p=t.scrollTop+t.offsetHeight;(r==="horizontal"||r==="both")&&(n<d?t.scrollTo({left:n,behavior:i}):n+e.clientWidth>c&&t.scrollTo({left:n-t.offsetWidth+e.clientWidth,behavior:i})),(r==="vertical"||r==="both")&&(s<f?t.scrollTo({top:s,behavior:i}):s+e.clientHeight>p&&t.scrollTo({top:s-t.offsetHeight+e.clientHeight,behavior:i}))}var ne=class extends pe{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new ir(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const e=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{const r=t.filter(({target:i})=>{if(i===this)return!0;if(i.closest("sl-tab-group")!==this)return!1;const o=i.tagName.toLowerCase();return o==="sl-tab"||o==="sl-tab-panel"});if(r.length!==0){if(r.some(i=>!["aria-labelledby","aria-controls"].includes(i.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(i=>i.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(i=>i.attributeName==="active")){const o=r.filter(s=>s.attributeName==="active"&&s.target.tagName.toLowerCase()==="sl-tab").map(s=>s.target).find(s=>s.active);o&&this.setActiveTab(o)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),e.then(()=>{new IntersectionObserver((r,i)=>{var o;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((o=this.getActiveTab())!=null?o:this.tabs[0],{emitEvents:!1}),i.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var e,t;super.disconnectedCallback(),(e=this.mutationObserver)==null||e.disconnect(),this.nav&&((t=this.resizeObserver)==null||t.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(e=>e.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(e=>e.active)}handleClick(e){const r=e.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(e){const r=e.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(e.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),e.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))){const o=this.tabs.find(d=>d.matches(":focus")),s=this.localize.dir()==="rtl";let n=null;if((o==null?void 0:o.tagName.toLowerCase())==="sl-tab"){if(e.key==="Home")n=this.focusableTabs[0];else if(e.key==="End")n=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&e.key===(s?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&e.key==="ArrowUp"){const d=this.tabs.findIndex(c=>c===o);n=this.findNextFocusableTab(d,"backward")}else if(["top","bottom"].includes(this.placement)&&e.key===(s?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&e.key==="ArrowDown"){const d=this.tabs.findIndex(c=>c===o);n=this.findNextFocusableTab(d,"forward")}if(!n)return;n.tabIndex=0,n.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(n,{scrollBehavior:"smooth"}):this.tabs.forEach(d=>{d.tabIndex=d===n?0:-1}),["top","bottom"].includes(this.placement)&&Nn(n,this.nav,"horizontal"),e.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(e,t){if(t=or({emitEvents:!0,scrollBehavior:"auto"},t),e!==this.activeTab&&!e.disabled){const r=this.activeTab;this.activeTab=e,this.tabs.forEach(i=>{i.active=i===this.activeTab,i.tabIndex=i===this.activeTab?0:-1}),this.panels.forEach(i=>{var o;return i.active=i.name===((o=this.activeTab)==null?void 0:o.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&Nn(this.activeTab,this.nav,"horizontal",t.scrollBehavior),t.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(e=>{const t=this.panels.find(r=>r.name===e.panel);t&&(e.setAttribute("aria-controls",t.getAttribute("id")),t.setAttribute("aria-labelledby",e.getAttribute("id")))})}repositionIndicator(){const e=this.getActiveTab();if(!e)return;const t=e.clientWidth,r=e.clientHeight,i=this.localize.dir()==="rtl",o=this.getAllTabs(),n=o.slice(0,o.indexOf(e)).reduce((d,c)=>({left:d.left+c.clientWidth,top:d.top+c.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${t}px`,this.indicator.style.height="auto",this.indicator.style.translate=i?`${-1*n.left}px`:`${n.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${n.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(e=>!e.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(e,t){let r=null;const i=t==="forward"?1:-1;let o=e+i;for(;e<this.tabs.length;){if(r=this.tabs[o]||null,r===null){t==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;o+=i}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(e){const t=this.tabs.find(r=>r.panel===e);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}render(){const e=this.localize.dir()==="rtl";return a`
      <div
        part="base"
        class=${Ae({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?a`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${Ae({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
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

          ${this.hasScrollControls?a`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${Ae({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
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
    `}};ne.styles=[je,gd];ne.dependencies={"sl-icon-button":ce,"sl-resize-observer":lo};v([xe(".tab-group")],ne.prototype,"tabGroup",2);v([xe(".tab-group__body")],ne.prototype,"body",2);v([xe(".tab-group__nav")],ne.prototype,"nav",2);v([xe(".tab-group__indicator")],ne.prototype,"indicator",2);v([m()],ne.prototype,"hasScrollControls",2);v([m()],ne.prototype,"shouldHideScrollStartButton",2);v([m()],ne.prototype,"shouldHideScrollEndButton",2);v([h()],ne.prototype,"placement",2);v([h()],ne.prototype,"activation",2);v([h({attribute:"no-scroll-controls",type:Boolean})],ne.prototype,"noScrollControls",2);v([h({attribute:"fixed-scroll-controls",type:Boolean})],ne.prototype,"fixedScrollControls",2);v([Vc({passive:!0})],ne.prototype,"updateScrollButtons",1);v([fe("noScrollControls",{waitUntilFirstUpdate:!0})],ne.prototype,"updateScrollControls",1);v([fe("placement",{waitUntilFirstUpdate:!0})],ne.prototype,"syncIndicator",1);ne.define("sl-tab-group");var yd=(e,t)=>{let r=0;return function(...i){window.clearTimeout(r),r=window.setTimeout(()=>{e.call(this,...i)},t)}},Fn=(e,t,r)=>{const i=e[t];e[t]=function(...o){i.call(this,...o),r.call(this,i,...o)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const t=new Set,r=new WeakMap,i=s=>{for(const n of s.changedTouches)t.add(n.identifier)},o=s=>{for(const n of s.changedTouches)t.delete(n.identifier)};document.addEventListener("touchstart",i,!0),document.addEventListener("touchend",o,!0),document.addEventListener("touchcancel",o,!0),Fn(EventTarget.prototype,"addEventListener",function(s,n){if(n!=="scrollend")return;const d=yd(()=>{t.size?d():this.dispatchEvent(new Event("scrollend"))},100);s.call(this,"scroll",d,{passive:!0}),r.set(this,d)}),Fn(EventTarget.prototype,"removeEventListener",function(s,n){if(n!=="scrollend")return;const d=r.get(this);d&&s.call(this,"scroll",d,{passive:!0})})}})();var kd=S`
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
`;function*Ts(e=document.activeElement){e!=null&&(yield e,"shadowRoot"in e&&e.shadowRoot&&e.shadowRoot.mode!=="closed"&&(yield*Hc(Ts(e.shadowRoot.activeElement))))}function $d(){return[...Ts()].pop()}var Bn=new WeakMap;function Ga(e){let t=Bn.get(e);return t||(t=window.getComputedStyle(e,null),Bn.set(e,t)),t}function Sd(e){if(typeof e.checkVisibility=="function")return e.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const t=Ga(e);return t.visibility!=="hidden"&&t.display!=="none"}function Ed(e){const t=Ga(e),{overflowY:r,overflowX:i}=t;return r==="scroll"||i==="scroll"?!0:r!=="auto"||i!=="auto"?!1:e.scrollHeight>e.clientHeight&&r==="auto"||e.scrollWidth>e.clientWidth&&i==="auto"}function Cd(e){const t=e.tagName.toLowerCase(),r=Number(e.getAttribute("tabindex"));if(e.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||e.hasAttribute("disabled")||e.closest("[inert]"))return!1;if(t==="input"&&e.getAttribute("type")==="radio"){const s=e.getRootNode(),n=`input[type='radio'][name="${e.getAttribute("name")}"]`,d=s.querySelector(`${n}:checked`);return d?d===e:s.querySelector(n)===e}return Sd(e)?(t==="audio"||t==="video")&&e.hasAttribute("controls")||e.hasAttribute("tabindex")||e.hasAttribute("contenteditable")&&e.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(t)?!0:Ed(e):!1}function Td(e,t){var r;return((r=e.getRootNode({composed:!0}))==null?void 0:r.host)!==t}function jn(e){const t=new WeakMap,r=[];function i(o){if(o instanceof Element){if(o.hasAttribute("inert")||o.closest("[inert]")||t.has(o))return;t.set(o,!0),!r.includes(o)&&Cd(o)&&r.push(o),o instanceof HTMLSlotElement&&Td(o,e)&&o.assignedElements({flatten:!0}).forEach(s=>{i(s)}),o.shadowRoot!==null&&o.shadowRoot.mode==="open"&&i(o.shadowRoot)}for(const s of o.children)i(s)}return i(e),r.sort((o,s)=>{const n=Number(o.getAttribute("tabindex"))||0;return(Number(s.getAttribute("tabindex"))||0)-n})}var Wr=[],Pd=class{constructor(e){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=t=>{var r;if(t.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const i=$d();if(this.previousFocus=i,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;t.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const o=jn(this.element);let s=o.findIndex(d=>d===i);this.previousFocus=this.currentFocus;const n=this.tabDirection==="forward"?1:-1;for(;;){s+n>=o.length?s=0:s+n<0?s=o.length-1:s+=n,this.previousFocus=this.currentFocus;const d=o[s];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||d&&this.possiblyHasTabbableChildren(d))return;t.preventDefault(),this.currentFocus=d,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const c=[...Ts()];if(c.includes(this.currentFocus)||!c.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=e,this.elementsWithTabbableControls=["iframe"]}activate(){Wr.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){Wr=Wr.filter(e=>e!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return Wr[Wr.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const e=jn(this.element);if(!this.element.matches(":focus-within")){const t=e[0],r=e[e.length-1],i=this.tabDirection==="forward"?t:r;typeof(i==null?void 0:i.focus)=="function"&&(this.currentFocus=i,i.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(e){return this.elementsWithTabbableControls.includes(e.tagName.toLowerCase())||e.hasAttribute("controls")}},Xa=e=>{var t;const{activeElement:r}=document;r&&e.contains(r)&&((t=document.activeElement)==null||t.blur())},Ya=new Map,Ad=new WeakMap;function Dd(e){return e??{keyframes:[],options:{duration:0}}}function Hn(e,t){return t.toLowerCase()==="rtl"?{keyframes:e.rtlKeyframes||e.keyframes,options:e.options}:e}function ke(e,t){Ya.set(e,Dd(t))}function Ht(e,t,r){const i=Ad.get(e);if(i!=null&&i[t])return Hn(i[t],r.dir);const o=Ya.get(t);return o?Hn(o,r.dir):{keyframes:[],options:{duration:0}}}function Wi(e,t){return new Promise(r=>{function i(o){o.target===e&&(e.removeEventListener(t,i),r())}e.addEventListener(t,i)})}function Ut(e,t,r){return new Promise(i=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const o=e.animate(t,$s(or({},r),{duration:Od()?0:r.duration}));o.addEventListener("cancel",i,{once:!0}),o.addEventListener("finish",i,{once:!0})})}function Od(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function _r(e){return Promise.all(e.getAnimations().map(t=>new Promise(r=>{t.cancel(),requestAnimationFrame(r)})))}function Un(e){return e.charAt(0).toUpperCase()+e.slice(1)}var $e=class extends pe{constructor(){super(...arguments),this.hasSlotController=new fi(this,"footer"),this.localize=new ir(this),this.modal=new Pd(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=e=>{this.contained||e.key==="Escape"&&this.modal.isActive()&&this.open&&(e.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),Uo(this)))}disconnectedCallback(){super.disconnectedCallback(),Wo(this),this.removeOpenListeners()}requestClose(e){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:e}}).defaultPrevented){const r=Ht(this,"drawer.denyClose",{dir:this.localize.dir()});Ut(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var e;"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var e;document.removeEventListener("keydown",this.handleDocumentKeyDown),(e=this.closeWatcher)==null||e.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),Uo(this));const e=this.querySelector("[autofocus]");e&&e.removeAttribute("autofocus"),await Promise.all([_r(this.drawer),_r(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(e?e.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),e&&e.setAttribute("autofocus","")});const t=Ht(this,`drawer.show${Un(this.placement)}`,{dir:this.localize.dir()}),r=Ht(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([Ut(this.panel,t.keyframes,t.options),Ut(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{Xa(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),Wo(this)),await Promise.all([_r(this.drawer),_r(this.overlay)]);const e=Ht(this,`drawer.hide${Un(this.placement)}`,{dir:this.localize.dir()}),t=Ht(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([Ut(this.overlay,t.keyframes,t.options).then(()=>{this.overlay.hidden=!0}),Ut(this.panel,e.keyframes,e.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),Uo(this)),this.open&&this.contained&&(this.modal.deactivate(),Wo(this))}async show(){if(!this.open)return this.open=!0,Wi(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Wi(this,"sl-after-hide")}render(){return a`
      <div
        part="base"
        class=${Ae({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${L(this.noHeader?this.label:void 0)}
          aria-labelledby=${L(this.noHeader?void 0:"title")}
          tabindex="0"
        >
          ${this.noHeader?"":a`
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
    `}};$e.styles=[je,kd];$e.dependencies={"sl-icon-button":ce};v([xe(".drawer")],$e.prototype,"drawer",2);v([xe(".drawer__panel")],$e.prototype,"panel",2);v([xe(".drawer__overlay")],$e.prototype,"overlay",2);v([h({type:Boolean,reflect:!0})],$e.prototype,"open",2);v([h({reflect:!0})],$e.prototype,"label",2);v([h({reflect:!0})],$e.prototype,"placement",2);v([h({type:Boolean,reflect:!0})],$e.prototype,"contained",2);v([h({attribute:"no-header",type:Boolean,reflect:!0})],$e.prototype,"noHeader",2);v([fe("open",{waitUntilFirstUpdate:!0})],$e.prototype,"handleOpenChange",1);v([fe("contained",{waitUntilFirstUpdate:!0})],$e.prototype,"handleNoModalChange",1);ke("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});ke("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});ke("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});ke("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});ke("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});ke("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});ke("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});ke("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});ke("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});ke("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});ke("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});$e.define("sl-drawer");var Id=S`
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
`,Se=class Bt extends pe{constructor(){super(...arguments),this.hasSlotController=new fi(this,"icon","suffix"),this.localize=new ir(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var t;(t=this.countdownAnimation)==null||t.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var t;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(t=this.countdownAnimation)==null||t.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:t}=this,r="100%",i="0";this.countdownAnimation=t.animate([{width:r},{width:i}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await _r(this.base),this.base.hidden=!1;const{keyframes:t,options:r}=Ht(this,"alert.show",{dir:this.localize.dir()});await Ut(this.base,t,r),this.emit("sl-after-show")}else{Xa(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await _r(this.base);const{keyframes:t,options:r}=Ht(this,"alert.hide",{dir:this.localize.dir()});await Ut(this.base,t,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Wi(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Wi(this,"sl-after-hide")}async toast(){return new Promise(t=>{this.handleCountdownChange(),Bt.toastStack.parentElement===null&&document.body.append(Bt.toastStack),Bt.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{Bt.toastStack.removeChild(this),t(),Bt.toastStack.querySelector("sl-alert")===null&&Bt.toastStack.remove()},{once:!0})})}render(){return a`
      <div
        part="base"
        class=${Ae({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
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

        ${this.closable?a`
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

        ${this.countdown?a`
              <div
                class=${Ae({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};Se.styles=[je,Id];Se.dependencies={"sl-icon-button":ce};v([xe('[part~="base"]')],Se.prototype,"base",2);v([xe(".alert__countdown-elapsed")],Se.prototype,"countdownElement",2);v([h({type:Boolean,reflect:!0})],Se.prototype,"open",2);v([h({type:Boolean,reflect:!0})],Se.prototype,"closable",2);v([h({reflect:!0})],Se.prototype,"variant",2);v([h({type:Number})],Se.prototype,"duration",2);v([h({type:String,reflect:!0})],Se.prototype,"countdown",2);v([m()],Se.prototype,"remainingTime",2);v([fe("open",{waitUntilFirstUpdate:!0})],Se.prototype,"handleOpenChange",1);v([fe("duration")],Se.prototype,"handleDurationChange",1);var zd=Se;ke("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});ke("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});zd.define("sl-alert");function Rd(e,t){const r=new Set([...Object.keys(e),...Object.keys(t)]);for(const i of r)if((e[i]??"")!==(t[i]??""))return!0;return!1}const Ld={view:"search",auth:{required:null,authenticated:!1,hasPassword:!1},search:{state:"initial",currentSession:null,query:"",queryWords:[],results:[],total:0,source:"fts",offset:0,limit:20},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,status:null,watcher:null,syncStatus:null,watchRecentChanges:[],reindex:{dialog:"closed",current_file:null,indexed_count:0,result:null,error:null},error:null,settings:{scope:"global",values:{},original:{},dirty:!1,exists:!0,saving:!1,error:null},files:{treeCache:{},expandedPaths:[],currentDir:"",selectedPaths:[],lastSelectedAnchor:null,detail:null,detailLoading:!1,listing:!1,mobilePane:"tree",pendingAction:null,error:null,filenameSearch:{query:"",allDocs:[],docsLoading:!0,docsError:null,results:[],selectedPath:null,isActive:!1,totalMatches:0}},diary:{tab:"record",today:"",todayEntry:null,recordLoading:!1,submitting:!1,reviewDate:"",reviewEntry:null,reviewLoading:!1,calendarMonth:"",calendarDates:[],calendarOpen:!1,cityDialogOpen:!1,error:null}};class Md{constructor(){this.state=Ld,this.listeners=new Set}getState(){return this.state}setState(t){this.state={...this.state,...t},this.listeners.forEach(r=>r(this.state))}subscribe(t){return this.listeners.add(t),()=>this.listeners.delete(t)}subscribeSelector(t,r){let i=t(this.state);return this.subscribe(o=>{const s=t(o);s!==i&&(i=s,r(s))})}}const b=new Md,g={setView(e){b.setState({view:e})},setAuthState(e){const t=b.getState().auth;b.setState({auth:{...t,...e}})},setSearchState(e){const t=b.getState().search;b.setState({search:{...t,...e}})},setChatState(e){const t=b.getState().chat;b.setState({chat:{...t,...e}})},pushDetail(e){const t=b.getState().detailStack;b.setState({detailStack:[...t,e]})},popDetail(){const e=b.getState().detailStack;e.length!==0&&b.setState({detailStack:e.slice(0,-1)})},setError(e){b.setState({error:e})},setStatus(e){b.setState({status:e})},setPendingSession(e){b.setState({pendingSession:e})},setWatcherStatus(e){b.setState({watcher:e})},setSyncStatus(e){b.setState({syncStatus:e})},setWatchRecentChanges(e){b.setState({watchRecentChanges:e})},openReindexConfirm(){const e=b.getState().reindex;b.setState({reindex:{...e,dialog:"confirm"}})},startReindex(){b.setState({reindex:{...b.getState().reindex,dialog:"running",current_file:null,indexed_count:0,result:null,error:null}})},setReindexProgress(e){const t=b.getState().reindex;t.dialog==="running"&&b.setState({reindex:{...t,current_file:e.current_file,indexed_count:e.indexed_count}})},finishReindex(e){b.setState({reindex:{...b.getState().reindex,dialog:"done",result:e}})},failReindex(e){b.setState({reindex:{...b.getState().reindex,dialog:"error",error:e}})},closeReindex(){b.setState({reindex:{dialog:"closed",current_file:null,indexed_count:0,result:null,error:null}})},setSettingsScope(e){},loadSettings(e,t){const r=b.getState().settings;b.setState({settings:{...r,values:{...e},original:{...e},exists:t,dirty:!1,error:null}})},updateSetting(e,t){const r=b.getState().settings,i={...r.values,[e]:t},o=Rd(r.original,i);b.setState({settings:{...r,values:i,dirty:o}})},revertSettings(){const e=b.getState().settings,t={...e.original};b.setState({settings:{...e,values:t,dirty:!1}})},setSettingsSaving(e){const t=b.getState().settings;b.setState({settings:{...t,saving:e}})},setSettingsError(e){const t=b.getState().settings;b.setState({settings:{...t,error:e}})},setFilesState(e){const t=b.getState().files;b.setState({files:{...t,...e}})},setDiaryState(e){const t=b.getState().diary;b.setState({diary:{...t,...e}})},expandDir(e){const t=b.getState().files;t.expandedPaths.includes(e)||b.setState({files:{...t,expandedPaths:[...t.expandedPaths,e]}})},collapseDir(e){const t=b.getState().files;b.setState({files:{...t,expandedPaths:t.expandedPaths.filter(r=>r!==e)}})},selectDir(e){const t=b.getState().files;b.setState({files:{...t,currentDir:e,selectedPaths:[],lastSelectedAnchor:null,detail:null,mobilePane:t.mobilePane==="tree"?"list":t.mobilePane}})},selectEntry(e,t={}){const r=b.getState().files;let i,o=r.lastSelectedAnchor;if(t.shift&&o!==null){const n=(r.treeCache[r.currentDir]||[]).map(f=>f.path),d=n.indexOf(o),c=n.indexOf(e);if(d>=0&&c>=0){const[f,p]=d<c?[d,c]:[c,d];i=n.slice(f,p+1)}else i=[e],o=e}else t.ctrl?(i=r.selectedPaths.includes(e)?r.selectedPaths.filter(s=>s!==e):[...r.selectedPaths,e],o=e):(i=[e],o=e);b.setState({files:{...r,selectedPaths:i,lastSelectedAnchor:o}})},clearSelection(){const e=b.getState().files;b.setState({files:{...e,selectedPaths:[],lastSelectedAnchor:null,detail:null}})},invalidateDir(e){const t=b.getState().files,r={...t.treeCache};delete r[e],b.setState({files:{...t,treeCache:r}})},invalidateSubtree(e){const t=b.getState().files,r={};for(const[i,o]of Object.entries(t.treeCache))i!==e&&!i.startsWith(e+"/")&&(r[i]=o);b.setState({files:{...t,treeCache:r}})},setMobilePane(e){const t=b.getState().files;b.setState({files:{...t,mobilePane:e}})},loadIndexedDocuments(e){const t=b.getState().files;b.setState({files:{...t,filenameSearch:{...t.filenameSearch,allDocs:e,docsLoading:!1,docsError:null}}})},setFilenameSearchDocsError(e){const t=b.getState().files;b.setState({files:{...t,filenameSearch:{...t.filenameSearch,docsLoading:!1,docsError:e}}})},setFilenameSearchQuery(e){var o;const t=b.getState().files,r=e.query.trim()!=="",i=r?((o=e.results[0])==null?void 0:o.path)??null:null;b.setState({files:{...t,filenameSearch:{...t.filenameSearch,query:e.query,results:e.results,totalMatches:e.totalMatches,isActive:r,selectedPath:i}}})},clearFilenameSearch(){const e=b.getState().files;b.setState({files:{...e,filenameSearch:{...e.filenameSearch,query:"",results:[],totalMatches:0,isActive:!1,selectedPath:null}}})},selectFilenameSearchResult(e){const t=b.getState().files;b.setState({files:{...t,filenameSearch:{...t.filenameSearch,selectedPath:e}}})}},Vi={search:"#/search",chat:"#/chat",files:"#/files",diary:"#/diary",settings:"#/settings",login:"#/login"},Nd=Object.fromEntries(Object.entries(Vi).map(([e,t])=>[t,e])),Fd="search";function Bd(e){if(!e)return null;const t=e.split("?")[0];return Nd[t]??null}let Vo=!1;function qi(){return typeof window<"u"?window.location.hash:""}function is(){return Bd(qi())??Fd}function Ka(e){if(typeof window>"u")return;const t=new URL(window.location.href);t.hash=e,window.history.replaceState(null,"",t)}function Wn(){const e=is(),t=Vi[e];qi()!==t&&Ka(t),g.setView(e)}const qt={init(){if(Vo)return;Vo=!0;const e=is(),t=Vi[e];qi()!==t&&Ka(t),g.setView(e),typeof window<"u"&&window.addEventListener("hashchange",Wn)},navigate(e){const t=Vi[e];qi()!==t&&typeof window<"u"&&(window.location.hash=t)},current(){return is()},_reset(){typeof window<"u"&&window.removeEventListener("hashchange",Wn),Vo=!1}};async function Za(){const e=await fetch("/api/status",{method:"GET"}),t=await e.json().catch(()=>null);if(!e.ok)throw new Error(`status HTTP ${e.status}`);return t}class Ke extends Error{constructor(t,r,i){super(i),this.status=t,this.code=r,this.name="ApiError"}}let Xt=null;function Vn(e){Xt=e}async function F(e,t={}){const r={...t};t.json!==void 0&&(r.headers={"Content-Type":"application/json",...t.headers||{}},r.body=JSON.stringify(t.json));const i=await fetch(e,r);if(!i.ok){i.status===401&&(Xt==null||Xt());let o;try{o=await i.json()}catch{o={code:"unknown",detail:i.statusText}}throw new Ke(i.status,o.code??"unknown",o.detail??"请求失败")}return i.json()}async function*Ps(e,t,r){const i=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t),signal:r});if(!i.ok||!i.body)throw i.status===401&&(Xt==null||Xt()),new Ke(i.status,"stream_failed","流式请求失败");const o=i.body.getReader(),s=new TextDecoder;let n="";for(;;){const{value:d,done:c}=await o.read();if(c)break;for(n+=s.decode(d,{stream:!0});;){const f=n.match(/\r\n\r\n|\r\r|\n\n/);if(!f||f.index===void 0)break;const p=f.index,_=f[0].length,$=n.slice(0,p);n=n.slice(p+_);let O="message",y="";for(const Q of $.split(/\r\n|\r|\n/))Q.startsWith("event:")?O=Q.slice(6).trim():Q.startsWith("data:")&&(y+=Q.slice(5).trim());yield{event:O,data:y}}}}const Ja=()=>F("/api/auth/status"),jd=e=>F("/api/auth/login",{method:"POST",json:{password:e}}),Qa=()=>F("/api/auth/logout",{method:"POST"}),Hd=(e,t)=>F("/api/auth/password",{method:"PUT",json:{old_password:e,new_password:t}}),Ud=e=>F("/api/auth/password",{method:"DELETE",json:{password:e}});var Wd=Object.defineProperty,Vd=Object.getOwnPropertyDescriptor,el=(e,t,r,i)=>{for(var o=i>1?void 0:i?Vd(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Wd(t,r,o),o};let Gi=class extends T{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"search",label:"搜索"},{id:"chat",icon:"message-circle",label:"对话"},{id:"diary",icon:"book-open",label:"日记"},{id:"files",icon:"folder",label:"文件"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return a`
      ${this._items.map(e=>a`
        <button
          class=${this.active===e.id?"active":""}
          title=${e.label}
          aria-label=${e.label}
          @click=${()=>this._select(e.id)}>
          <doclens-icon class="icon ${this.active===e.id?"filled":""}" name=${e.icon}></doclens-icon>
          <span class="label">${e.label}</span>
        </button>`)}
    `}};Gi.styles=S`
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
  `;el([h()],Gi.prototype,"active",2);Gi=el([P("activity-bar")],Gi);var qd=Object.defineProperty,Gd=Object.getOwnPropertyDescriptor,tl=(e,t,r,i)=>{for(var o=i>1?void 0:i?Gd(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&qd(t,r,o),o};let Xi=class extends T{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"search",label:"搜索"},{id:"chat",icon:"message-circle",label:"对话"},{id:"diary",icon:"book-open",label:"日记"},{id:"files",icon:"folder",label:"文件"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return a`
      ${this._items.map(e=>a`
        <button
          class="tab ${this.active===e.id?"active":""}"
          @click=${()=>this._select(e.id)}>
          <doclens-icon class="icon ${this.active===e.id?"filled":""}" name=${e.icon}></doclens-icon>
          <span>${e.label}</span>
        </button>`)}
    `}};Xi.styles=S`
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
  `;tl([h()],Xi.prototype,"active",2);Xi=tl([P("tab-bar")],Xi);var Xd=Object.defineProperty,Yd=Object.getOwnPropertyDescriptor,at=(e,t,r,i)=>{for(var o=i>1?void 0:i?Yd(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Xd(t,r,o),o};let Fe=class extends T{constructor(){super(...arguments),this.variant="compact",this.heading="Doclens",this.subheading="",this.suffix="",this.heroIcon="",this.modes=[],this.examples=[],this.workdir=""}render(){return this.variant==="onboarding"?this._renderOnboarding():this._renderCompact()}_renderCompact(){return a`
      <h1 class="title">
        <span class="accent">${this.heading}</span>${this.suffix?a`<span class="sep">·</span><span>${this.suffix}</span>`:k}
      </h1>
      ${this.subheading?a`<p class="subtitle">${this.subheading}</p>`:k}
    `}_renderWorkdirPill(e){return a`<span class="workdir-pill" title=${this.workdir||e}
      ><doclens-icon class="pill-icon" name="folder-open"></doclens-icon><span class="pill-path"><bdo dir="ltr">${e}</bdo></span
    ></span>`}_renderOnboardingSubheading(){if(!this.subheading)return k;const e="{workdir}",t=this.subheading.indexOf(e);if(t<0)return a`<p class="onboarding-subheading">${this.subheading}</p>`;const r=this.subheading.slice(0,t),i=this.subheading.slice(t+e.length);return a`<p class="onboarding-subheading workdir-inline">
      ${r}${this._renderWorkdirPill(this.workdir||"…")}${i}
    </p>`}_renderOnboarding(){return a`
      <div class="onboarding-card">
        <div class="card-head">
          <div class="title-group">
            ${this.heroIcon?a`<div class="hero-mark"><doclens-icon name=${this.heroIcon}></doclens-icon></div>`:k}
            <h2 class="card-title">${this.heading}</h2>
          </div>
          ${this.modes.length?a`
                <div class="modes-row">
                  ${this.modes.map(e=>a`<span class="chip">${e.icon?a`<doclens-icon name=${e.icon}></doclens-icon> `:k}${e.label}</span>`)}
                </div>
              `:k}
        </div>
        ${this._renderOnboardingSubheading()}
        ${this.workdir&&!this.subheading.includes("{workdir}")?a`
              <p class="workdir-row">
                <span class="workdir-prefix">当前目录是</span>
                ${this._renderWorkdirPill(this.workdir)}
              </p>
            `:k}
        ${this.examples.length?a`
              <ul class="examples-list">
                ${this.examples.map(e=>a`<li>${e}</li>`)}
              </ul>
            `:k}
      </div>
    `}};Fe.styles=S`
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
  `;at([h()],Fe.prototype,"variant",2);at([h()],Fe.prototype,"heading",2);at([h()],Fe.prototype,"subheading",2);at([h()],Fe.prototype,"suffix",2);at([h()],Fe.prototype,"heroIcon",2);at([h({attribute:!1})],Fe.prototype,"modes",2);at([h({attribute:!1})],Fe.prototype,"examples",2);at([h({attribute:!1})],Fe.prototype,"workdir",2);Fe=at([P("welcome-pane")],Fe);var Kd=Object.defineProperty,Zd=Object.getOwnPropertyDescriptor,Ar=(e,t,r,i)=>{for(var o=i>1?void 0:i?Zd(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Kd(t,r,o),o};let Et=class extends T{constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta="",this.actions=[],this._menuOpen=!1,this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}_onMoreClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onItemClick(e){e.disabled||(this._menuOpen=!1,e.onClick())}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return a`
      <button class="back" aria-label=${this.backLabel} title=${this.backLabel} @click=${this._back}>‹</button>
      <div class="title">${this.title}</div>
      ${this.meta?a`<div class="meta">${this.meta}</div>`:null}
      ${this.actions.length>0?a`
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
            ${this.actions.map(e=>a`
              <button
                class="menu-item"
                type="button"
                role="menuitem"
                ?disabled=${e.disabled??!1}
                @click=${()=>this._onItemClick(e)}
              >
                ${e.icon?a`<doclens-icon class="icon" name=${e.icon}></doclens-icon>`:null}
                <span class="label">${e.label}</span>
              </button>
            `)}
          </div>
        </div>
      `:null}
    `}};Et.styles=S`
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
  `;Ar([h()],Et.prototype,"backLabel",2);Ar([h()],Et.prototype,"title",2);Ar([h()],Et.prototype,"meta",2);Ar([h({attribute:!1})],Et.prototype,"actions",2);Ar([m()],Et.prototype,"_menuOpen",2);Et=Ar([P("focus-header")],Et);var Jd=Object.defineProperty,Qd=Object.getOwnPropertyDescriptor,mi=(e,t,r,i)=>{for(var o=i>1?void 0:i?Qd(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Jd(t,r,o),o};let Kt=class extends T{constructor(){super(...arguments),this.title="历史会话",this.sessions=[],this.clearing=!1}_onClear(){this.clearing||this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){const e=this.sessions.length>0;return a`
      <div class="header">
        <div class="title">${this.title}</div>
        ${e?a`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing?"清空中...":"清空"}
          </button>`:null}
      </div>
      ${this.sessions.length===0?a`<div class="empty">暂无历史${this.type==="search"?"搜索":"会话"}</div>`:this.sessions.map(t=>a`<history-item .session=${t}></history-item>`)}
    `}};Kt.styles=S`
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
  `;mi([h()],Kt.prototype,"title",2);mi([h({attribute:!1})],Kt.prototype,"sessions",2);mi([h()],Kt.prototype,"type",2);mi([h({type:Boolean})],Kt.prototype,"clearing",2);Kt=mi([P("history-list")],Kt);var eh=Object.defineProperty,th=Object.getOwnPropertyDescriptor,rl=(e,t,r,i)=>{for(var o=i>1?void 0:i?th(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&eh(t,r,o),o};let Yi=class extends T{constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){if(!this.session)return null;const e=[];return this.session.type==="chat"&&e.push(String(this.session.message_count)),e.push(new Date(this.session.updated_at).toLocaleDateString()),a`
      <div class="name">
        ${this.session.mode==="grep"?a`<span class="mode-tag" title="正则 grep">grep</span>`:null}
        ${this.session.title}
      </div>
      <div class="meta">${e.join(" · ")}</div>
    `}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};Yi.styles=S`
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
  `;rl([h({attribute:!1})],Yi.prototype,"session",2);Yi=rl([P("history-item")],Yi);var rh=Object.defineProperty,ih=Object.getOwnPropertyDescriptor,Ee=(e,t,r,i)=>{for(var o=i>1?void 0:i?ih(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&rh(t,r,o),o};let ue=class extends T{constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.iconAfter=!1,this.multiline=!1,this.disabled=!1,this.streaming=!1,this.mode="keyword",this.modes=null,this._menuOpen=!1,this._onDocClick=()=>{this._menuOpen=!1,document.removeEventListener("click",this._onDocClick)}}focus(){var e;(e=this.inputEl)==null||e.focus()}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("value")||e.has("multiline"))&&this._autoResize()}_autoResize(){const e=this.renderRoot.querySelector("textarea");e&&(e.style.height="auto",e.style.height=`${e.scrollHeight}px`)}get trimmed(){return this.value.trim()}_onInput(e){const t=e.target;this.value=t.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled),this._autoResize()}_onKeydown(e){e.key==="Enter"&&(e.shiftKey&&this.multiline||(e.preventDefault(),this._submit()))}_submit(){this.streaming||!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}_emitStop(){this.dispatchEvent(new CustomEvent("stop"))}get _hasModes(){return!!this.modes&&this.mode in this.modes}_toggleMenu(e){e.stopPropagation(),this._menuOpen=!this._menuOpen,this._menuOpen&&document.addEventListener("click",this._onDocClick)}_selectMode(e){this._menuOpen=!1,document.removeEventListener("click",this._onDocClick),this.dispatchEvent(new CustomEvent("mode-change",{detail:{mode:e}}))}_renderButton(){if(this.streaming)return a`
        <button class="stop" @click=${this._emitStop} aria-label="停止生成">
          <doclens-icon class="filled" name="square" aria-hidden="true"></doclens-icon>
        </button>`;if(!this._hasModes){const t=this.buttonIcon?a`<doclens-icon class="thick" name=${this.buttonIcon} aria-hidden="true"></doclens-icon>`:null,r=a`<span>${this.buttonLabel}</span>`;return a`
        <button @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${this.iconAfter?a`${r}${t}`:a`${t}${r}`}
        </button>`}const e=this.modes[this.mode];return a`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${e!=null&&e.icon?a`<doclens-icon name=${e.icon} aria-hidden="true"></doclens-icon>`:null}
          <span>${(e==null?void 0:e.label)??this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}><doclens-icon name="chevron-down"></doclens-icon></button>
      </div>`}_renderMenu(){return!this._hasModes||!this._menuOpen?null:a`
      <div class="menu" role="menu">
        ${Object.keys(this.modes).map(e=>{const t=this.modes[e];return a`
            <div class="menu-item ${e===this.mode?"active":""}" role="menuitem"
                 @click=${()=>this._selectMode(e)}>
              <span class="menu-item-title">
                ${t.icon?a`<span aria-hidden="true">${t.icon}</span>`:null}${t.label}
              </span>
              ${t.description?a`<span class="menu-item-desc">${t.description}</span>`:null}
            </div>`})}
      </div>`}render(){const e=this.disabled||this.streaming,t=this.multiline?a`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${e} @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`:a`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${e} @input=${this._onInput} @keydown=${this._onKeydown} />`;return a`
      <div class="wrapper">
        ${t}
        ${this._renderButton()}
        ${this._renderMenu()}
      </div>
    `}};ue.styles=S`
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
  `;Ee([h()],ue.prototype,"value",2);Ee([h()],ue.prototype,"placeholder",2);Ee([h()],ue.prototype,"buttonLabel",2);Ee([h()],ue.prototype,"buttonIcon",2);Ee([h({type:Boolean})],ue.prototype,"iconAfter",2);Ee([h({type:Boolean})],ue.prototype,"multiline",2);Ee([h({type:Boolean})],ue.prototype,"disabled",2);Ee([h({type:Boolean})],ue.prototype,"streaming",2);Ee([h()],ue.prototype,"mode",2);Ee([h({attribute:!1})],ue.prototype,"modes",2);Ee([m()],ue.prototype,"_menuOpen",2);Ee([xe("input, textarea")],ue.prototype,"inputEl",2);ue=Ee([P("input-box")],ue);function As(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var sr=As();function il(e){sr=e}var Wt={exec:()=>null};function fr(e){let t=[];return r=>{let i=Math.max(0,Math.min(3,r-1)),o=t[i];return o||(o=e(i),t[i]=o),o}}function M(e,t=""){let r=typeof e=="string"?e:e.source,i={replace:(o,s)=>{let n=typeof s=="string"?s:s.source;return n=n.replace(le.caret,"$1"),r=r.replace(o,n),i},getRegex:()=>new RegExp(r,t)};return i}var oh=((e="")=>{try{return!!new RegExp("(?<=1)(?<!1)"+e)}catch{return!1}})(),le={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:fr(e=>new RegExp(`^ {0,${e}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:fr(e=>new RegExp(`^ {0,${e}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:fr(e=>new RegExp(`^ {0,${e}}(?:\`\`\`|~~~)`)),headingBeginRegex:fr(e=>new RegExp(`^ {0,${e}}#`)),htmlBeginRegex:fr(e=>new RegExp(`^ {0,${e}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:fr(e=>new RegExp(`^ {0,${e}}>`))},sh=/^(?:[ \t]*(?:\n|$))+/,nh=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,ah=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,bi=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,lh=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Ds=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,ol=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,sl=M(ol).replace(/bull/g,Ds).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),ch=M(ol).replace(/bull/g,Ds).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Os=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,dh=/^[^\n]+/,Is=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,hh=M(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",Is).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),uh=M(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,Ds).getRegex(),co="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",zs=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,ph=M("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",zs).replace("tag",co).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),nl=M(Os).replace("hr",bi).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",co).getRegex(),fh=M(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",nl).getRegex(),Rs={blockquote:fh,code:nh,def:hh,fences:ah,heading:lh,hr:bi,html:ph,lheading:sl,list:uh,newline:sh,paragraph:nl,table:Wt,text:dh},qn=M("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",bi).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",co).getRegex(),mh={...Rs,lheading:ch,table:qn,paragraph:M(Os).replace("hr",bi).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",qn).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",co).getRegex()},bh={...Rs,html:M(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",zs).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:Wt,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:M(Os).replace("hr",bi).replace("heading",` *#{1,6} *[^
]`).replace("lheading",sl).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},gh=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,vh=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,al=/^( {2,}|\\)\n(?!\s*$)/,xh=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Dr=/[\p{P}\p{S}]/u,ho=/[\s\p{P}\p{S}]/u,Ls=/[^\s\p{P}\p{S}]/u,_h=M(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,ho).getRegex(),ll=/(?!~)[\p{P}\p{S}]/u,wh=/(?!~)[\s\p{P}\p{S}]/u,yh=/(?:[^\s\p{P}\p{S}]|~)/u,kh=M(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",oh?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),cl=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,$h=M(cl,"u").replace(/punct/g,Dr).getRegex(),Sh=M(cl,"u").replace(/punct/g,ll).getRegex(),dl="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Eh=M(dl,"gu").replace(/notPunctSpace/g,Ls).replace(/punctSpace/g,ho).replace(/punct/g,Dr).getRegex(),Ch=M(dl,"gu").replace(/notPunctSpace/g,yh).replace(/punctSpace/g,wh).replace(/punct/g,ll).getRegex(),Th=M("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Ls).replace(/punctSpace/g,ho).replace(/punct/g,Dr).getRegex(),Ph=M(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,Dr).getRegex(),Ah="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",Dh=M(Ah,"gu").replace(/notPunctSpace/g,Ls).replace(/punctSpace/g,ho).replace(/punct/g,Dr).getRegex(),Oh=M(/\\(punct)/,"gu").replace(/punct/g,Dr).getRegex(),Ih=M(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),zh=M(zs).replace("(?:-->|$)","-->").getRegex(),Rh=M("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",zh).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Ki=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,Lh=M(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",Ki).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),hl=M(/^!?\[(label)\]\[(ref)\]/).replace("label",Ki).replace("ref",Is).getRegex(),ul=M(/^!?\[(ref)\](?:\[\])?/).replace("ref",Is).getRegex(),Mh=M("reflink|nolink(?!\\()","g").replace("reflink",hl).replace("nolink",ul).getRegex(),Gn=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Ms={_backpedal:Wt,anyPunctuation:Oh,autolink:Ih,blockSkip:kh,br:al,code:vh,del:Wt,delLDelim:Wt,delRDelim:Wt,emStrongLDelim:$h,emStrongRDelimAst:Eh,emStrongRDelimUnd:Th,escape:gh,link:Lh,nolink:ul,punctuation:_h,reflink:hl,reflinkSearch:Mh,tag:Rh,text:xh,url:Wt},Nh={...Ms,link:M(/^!?\[(label)\]\((.*?)\)/).replace("label",Ki).getRegex(),reflink:M(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Ki).getRegex()},os={...Ms,emStrongRDelimAst:Ch,emStrongLDelim:Sh,delLDelim:Ph,delRDelim:Dh,url:M(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",Gn).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:M(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",Gn).getRegex()},Fh={...os,br:M(al).replace("{2,}","*").getRegex(),text:M(os.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Li={normal:Rs,gfm:mh,pedantic:bh},Vr={normal:Ms,gfm:os,breaks:Fh,pedantic:Nh},Bh={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},Xn=e=>Bh[e];function Ye(e,t){if(t){if(le.escapeTest.test(e))return e.replace(le.escapeReplace,Xn)}else if(le.escapeTestNoEncode.test(e))return e.replace(le.escapeReplaceNoEncode,Xn);return e}function Yn(e){try{e=encodeURI(e).replace(le.percentDecode,"%")}catch{return null}return e}function Kn(e,t){var s;let r=e.replace(le.findPipe,(n,d,c)=>{let f=!1,p=d;for(;--p>=0&&c[p]==="\\";)f=!f;return f?"|":" |"}),i=r.split(le.splitPipe),o=0;if(i[0].trim()||i.shift(),i.length>0&&!((s=i.at(-1))!=null&&s.trim())&&i.pop(),t)if(i.length>t)i.splice(t);else for(;i.length<t;)i.push("");for(;o<i.length;o++)i[o]=i[o].trim().replace(le.slashPipe,"|");return i}function pt(e,t,r){let i=e.length;if(i===0)return"";let o=0;for(;o<i&&e.charAt(i-o-1)===t;)o++;return e.slice(0,i-o)}function Zn(e){let t=e.split(`
`),r=t.length-1;for(;r>=0&&le.blankLine.test(t[r]);)r--;return t.length-r<=2?e:t.slice(0,r+1).join(`
`)}function jh(e,t){if(e.indexOf(t[1])===-1)return-1;let r=0;for(let i=0;i<e.length;i++)if(e[i]==="\\")i++;else if(e[i]===t[0])r++;else if(e[i]===t[1]&&(r--,r<0))return i;return r>0?-2:-1}function Hh(e,t=0){let r=t,i="";for(let o of e)if(o==="	"){let s=4-r%4;i+=" ".repeat(s),r+=s}else i+=o,r++;return i}function Jn(e,t,r,i,o){let s=t.href,n=t.title||null,d=e[1].replace(o.other.outputLinkReplace,"$1");i.state.inLink=!0;let c={type:e[0].charAt(0)==="!"?"image":"link",raw:r,href:s,title:n,text:d,tokens:i.inlineTokens(d)};return i.state.inLink=!1,c}function Uh(e,t,r){let i=e.match(r.other.indentCodeCompensation);if(i===null)return t;let o=i[1];return t.split(`
`).map(s=>{let n=s.match(r.other.beginningSpace);if(n===null)return s;let[d]=n;return d.length>=o.length?s.slice(o.length):s}).join(`
`)}var Zi=class{constructor(e){U(this,"options");U(this,"rules");U(this,"lexer");this.options=e||sr}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let r=this.options.pedantic?t[0]:Zn(t[0]),i=r.replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:r,codeBlockStyle:"indented",text:i}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let r=t[0],i=Uh(r,t[3]||"",this.rules);return{type:"code",raw:r,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:i}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let r=t[2].trim();if(this.rules.other.endingHash.test(r)){let i=pt(r,"#");(this.options.pedantic||!i||this.rules.other.endingSpaceChar.test(i))&&(r=i.trim())}return{type:"heading",raw:pt(t[0],`
`),depth:t[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:pt(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let r=pt(t[0],`
`).split(`
`),i="",o="",s=[];for(;r.length>0;){let n=!1,d=[],c;for(c=0;c<r.length;c++)if(this.rules.other.blockquoteStart.test(r[c]))d.push(r[c]),n=!0;else if(!n)d.push(r[c]);else break;r=r.slice(c);let f=d.join(`
`),p=f.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");i=i?`${i}
${f}`:f,o=o?`${o}
${p}`:p;let _=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(p,s,!0),this.lexer.state.top=_,r.length===0)break;let $=s.at(-1);if(($==null?void 0:$.type)==="code")break;if(($==null?void 0:$.type)==="blockquote"){let O=$,y=O.raw+`
`+r.join(`
`),Q=this.blockquote(y);s[s.length-1]=Q,i=i.substring(0,i.length-O.raw.length)+Q.raw,o=o.substring(0,o.length-O.text.length)+Q.text;break}else if(($==null?void 0:$.type)==="list"){let O=$,y=O.raw+`
`+r.join(`
`),Q=this.list(y);s[s.length-1]=Q,i=i.substring(0,i.length-$.raw.length)+Q.raw,o=o.substring(0,o.length-O.raw.length)+Q.raw,r=y.substring(s.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:i,tokens:s,text:o}}}list(e){let t=this.rules.block.list.exec(e);if(t){let r=t[1].trim(),i=r.length>1,o={type:"list",raw:"",ordered:i,start:i?+r.slice(0,-1):"",loose:!1,items:[]};r=i?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=i?r:"[*+-]");let s=this.rules.other.listItemRegex(r),n=!1;for(;e;){let c=!1,f="",p="";if(!(t=s.exec(e))||this.rules.block.hr.test(e))break;f=t[0],e=e.substring(f.length);let _=Hh(t[2].split(`
`,1)[0],t[1].length),$=e.split(`
`,1)[0],O=!_.trim(),y=0;if(this.options.pedantic?(y=2,p=_.trimStart()):O?y=t[1].length+1:(y=_.search(this.rules.other.nonSpaceChar),y=y>4?1:y,p=_.slice(y),y+=t[1].length),O&&this.rules.other.blankLine.test($)&&(f+=$+`
`,e=e.substring($.length+1),c=!0),!c){let Q=this.rules.other.nextBulletRegex(y),B=this.rules.other.hrRegex(y),Te=this.rules.other.fencesBeginRegex(y),We=this.rules.other.headingBeginRegex(y),It=this.rules.other.htmlBeginRegex(y),ie=this.rules.other.blockquoteBeginRegex(y);for(;e;){let me=e.split(`
`,1)[0],Ve;if($=me,this.options.pedantic?($=$.replace(this.rules.other.listReplaceNesting,"  "),Ve=$):Ve=$.replace(this.rules.other.tabCharGlobal,"    "),Te.test($)||We.test($)||It.test($)||ie.test($)||Q.test($)||B.test($))break;if(Ve.search(this.rules.other.nonSpaceChar)>=y||!$.trim())p+=`
`+Ve.slice(y);else{if(O||_.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||Te.test(_)||We.test(_)||B.test(_))break;p+=`
`+$}O=!$.trim(),f+=me+`
`,e=e.substring(me.length+1),_=Ve.slice(y)}}o.loose||(n?o.loose=!0:this.rules.other.doubleBlankLine.test(f)&&(n=!0)),o.items.push({type:"list_item",raw:f,task:!!this.options.gfm&&this.rules.other.listIsTask.test(p),loose:!1,text:p,tokens:[]}),o.raw+=f}let d=o.items.at(-1);if(d)d.raw=d.raw.trimEnd(),d.text=d.text.trimEnd();else return;o.raw=o.raw.trimEnd();for(let c of o.items){this.lexer.state.top=!1,c.tokens=this.lexer.blockTokens(c.text,[]);let f=c.tokens[0];if(c.task&&((f==null?void 0:f.type)==="text"||(f==null?void 0:f.type)==="paragraph")){c.text=c.text.replace(this.rules.other.listReplaceTask,""),f.raw=f.raw.replace(this.rules.other.listReplaceTask,""),f.text=f.text.replace(this.rules.other.listReplaceTask,"");for(let _=this.lexer.inlineQueue.length-1;_>=0;_--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[_].src)){this.lexer.inlineQueue[_].src=this.lexer.inlineQueue[_].src.replace(this.rules.other.listReplaceTask,"");break}let p=this.rules.other.listTaskCheckbox.exec(c.raw);if(p){let _={type:"checkbox",raw:p[0]+" ",checked:p[0]!=="[ ]"};c.checked=_.checked,o.loose?c.tokens[0]&&["paragraph","text"].includes(c.tokens[0].type)&&"tokens"in c.tokens[0]&&c.tokens[0].tokens?(c.tokens[0].raw=_.raw+c.tokens[0].raw,c.tokens[0].text=_.raw+c.tokens[0].text,c.tokens[0].tokens.unshift(_)):c.tokens.unshift({type:"paragraph",raw:_.raw,text:_.raw,tokens:[_]}):c.tokens.unshift(_)}}else c.task&&(c.task=!1);if(!o.loose){let p=c.tokens.filter($=>$.type==="space"),_=p.length>0&&p.some($=>this.rules.other.anyLine.test($.raw));o.loose=_}}if(o.loose)for(let c of o.items){c.loose=!0;for(let f of c.tokens)f.type==="text"&&(f.type="paragraph")}return o}}html(e){let t=this.rules.block.html.exec(e);if(t){let r=Zn(t[0]);return{type:"html",block:!0,raw:r,pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:r}}}def(e){let t=this.rules.block.def.exec(e);if(t){let r=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),i=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",o=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:r,raw:pt(t[0],`
`),href:i,title:o}}}table(e){var n;let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let r=Kn(t[1]),i=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),o=(n=t[3])!=null&&n.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],s={type:"table",raw:pt(t[0],`
`),header:[],align:[],rows:[]};if(r.length===i.length){for(let d of i)this.rules.other.tableAlignRight.test(d)?s.align.push("right"):this.rules.other.tableAlignCenter.test(d)?s.align.push("center"):this.rules.other.tableAlignLeft.test(d)?s.align.push("left"):s.align.push(null);for(let d=0;d<r.length;d++)s.header.push({text:r[d],tokens:this.lexer.inline(r[d]),header:!0,align:s.align[d]});for(let d of o)s.rows.push(Kn(d,s.header.length).map((c,f)=>({text:c,tokens:this.lexer.inline(c),header:!1,align:s.align[f]})));return s}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t){let r=t[1].trim();return{type:"heading",raw:pt(t[0],`
`),depth:t[2].charAt(0)==="="?1:2,text:r,tokens:this.lexer.inline(r)}}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let r=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:r,tokens:this.lexer.inline(r)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let r=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let s=pt(r.slice(0,-1),"\\");if((r.length-s.length)%2===0)return}else{let s=jh(t[2],"()");if(s===-2)return;if(s>-1){let n=(t[0].indexOf("!")===0?5:4)+t[1].length+s;t[2]=t[2].substring(0,s),t[0]=t[0].substring(0,n).trim(),t[3]=""}}let i=t[2],o="";if(this.options.pedantic){let s=this.rules.other.pedanticHrefTitle.exec(i);s&&(i=s[1],o=s[3])}else o=t[3]?t[3].slice(1,-1):"";return i=i.trim(),this.rules.other.startAngleBracket.test(i)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?i=i.slice(1):i=i.slice(1,-1)),Jn(t,{href:i&&i.replace(this.rules.inline.anyPunctuation,"$1"),title:o&&o.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let r;if((r=this.rules.inline.reflink.exec(e))||(r=this.rules.inline.nolink.exec(e))){let i=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),o=t[i.toLowerCase()];if(!o){let s=r[0].charAt(0);return{type:"text",raw:s,text:s}}return Jn(r,o,r[0],this.lexer,this.rules)}}emStrong(e,t,r=""){let i=this.rules.inline.emStrongLDelim.exec(e);if(!(!i||!i[1]&&!i[2]&&!i[3]&&!i[4]||i[4]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(i[1]||i[3])||!r||this.rules.inline.punctuation.exec(r))){let o=[...i[0]].length-1,s,n,d=o,c=0,f=i[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(f.lastIndex=0,t=t.slice(-1*e.length+o);(i=f.exec(t))!==null;){if(s=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!s)continue;if(n=[...s].length,i[3]||i[4]){d+=n;continue}else if((i[5]||i[6])&&o%3&&!((o+n)%3)){c+=n;continue}if(d-=n,d>0)continue;n=Math.min(n,n+d+c);let p=[...i[0]][0].length,_=e.slice(0,o+i.index+p+n);if(Math.min(o,n)%2){let O=_.slice(1,-1);return{type:"em",raw:_,text:O,tokens:this.lexer.inlineTokens(O)}}let $=_.slice(2,-2);return{type:"strong",raw:_,text:$,tokens:this.lexer.inlineTokens($)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let r=t[2].replace(this.rules.other.newLineCharGlobal," "),i=this.rules.other.nonSpaceChar.test(r),o=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return i&&o&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:t[0],text:r}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e,t,r=""){let i=this.rules.inline.delLDelim.exec(e);if(i&&(!i[1]||!r||this.rules.inline.punctuation.exec(r))){let o=[...i[0]].length-1,s,n,d=o,c=this.rules.inline.delRDelim;for(c.lastIndex=0,t=t.slice(-1*e.length+o);(i=c.exec(t))!==null;){if(s=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!s||(n=[...s].length,n!==o))continue;if(i[3]||i[4]){d+=n;continue}if(d-=n,d>0)continue;n=Math.min(n,n+d);let f=[...i[0]][0].length,p=e.slice(0,o+i.index+f+n),_=p.slice(o,-o);return{type:"del",raw:p,text:_,tokens:this.lexer.inlineTokens(_)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let r,i;return t[2]==="@"?(r=t[1],i="mailto:"+r):(r=t[1],i=r),{type:"link",raw:t[0],text:r,href:i,tokens:[{type:"text",raw:r,text:r}]}}}url(e){var r;let t;if(t=this.rules.inline.url.exec(e)){let i,o;if(t[2]==="@")i=t[0],o="mailto:"+i;else{let s;do s=t[0],t[0]=((r=this.rules.inline._backpedal.exec(t[0]))==null?void 0:r[0])??"";while(s!==t[0]);i=t[0],t[1]==="www."?o="http://"+t[0]:o=t[0]}return{type:"link",raw:t[0],text:i,href:o,tokens:[{type:"text",raw:i,text:i}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let r=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:r}}}},Me=class ss{constructor(t){U(this,"tokens");U(this,"options");U(this,"state");U(this,"inlineQueue");U(this,"tokenizer");this.tokens=[],this.tokens.links=Object.create(null),this.options=t||sr,this.options.tokenizer=this.options.tokenizer||new Zi,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:le,block:Li.normal,inline:Vr.normal};this.options.pedantic?(r.block=Li.pedantic,r.inline=Vr.pedantic):this.options.gfm&&(r.block=Li.gfm,this.options.breaks?r.inline=Vr.breaks:r.inline=Vr.gfm),this.tokenizer.rules=r}static get rules(){return{block:Li,inline:Vr}}static lex(t,r){return new ss(r).lex(t)}static lexInline(t,r){return new ss(r).inlineTokens(t)}lex(t){t=t.replace(le.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let i=this.inlineQueue[r];this.inlineTokens(i.src,i.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,r=[],i=!1){var s,n,d;this.tokenizer.lexer=this,this.options.pedantic&&(t=t.replace(le.tabCharGlobal,"    ").replace(le.spaceLine,""));let o=1/0;for(;t;){if(t.length<o)o=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}let c;if((n=(s=this.options.extensions)==null?void 0:s.block)!=null&&n.some(p=>(c=p.call({lexer:this},t,r))?(t=t.substring(c.raw.length),r.push(c),!0):!1))continue;if(c=this.tokenizer.space(t)){t=t.substring(c.raw.length);let p=r.at(-1);c.raw.length===1&&p!==void 0?p.raw+=`
`:r.push(c);continue}if(c=this.tokenizer.code(t)){t=t.substring(c.raw.length);let p=r.at(-1);(p==null?void 0:p.type)==="paragraph"||(p==null?void 0:p.type)==="text"?(p.raw+=(p.raw.endsWith(`
`)?"":`
`)+c.raw,p.text+=`
`+c.text,this.inlineQueue.at(-1).src=p.text):r.push(c);continue}if(c=this.tokenizer.fences(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.heading(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.hr(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.blockquote(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.list(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.html(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.def(t)){t=t.substring(c.raw.length);let p=r.at(-1);(p==null?void 0:p.type)==="paragraph"||(p==null?void 0:p.type)==="text"?(p.raw+=(p.raw.endsWith(`
`)?"":`
`)+c.raw,p.text+=`
`+c.raw,this.inlineQueue.at(-1).src=p.text):this.tokens.links[c.tag]||(this.tokens.links[c.tag]={href:c.href,title:c.title},r.push(c));continue}if(c=this.tokenizer.table(t)){t=t.substring(c.raw.length),r.push(c);continue}if(c=this.tokenizer.lheading(t)){t=t.substring(c.raw.length),r.push(c);continue}let f=t;if((d=this.options.extensions)!=null&&d.startBlock){let p=1/0,_=t.slice(1),$;this.options.extensions.startBlock.forEach(O=>{$=O.call({lexer:this},_),typeof $=="number"&&$>=0&&(p=Math.min(p,$))}),p<1/0&&p>=0&&(f=t.substring(0,p+1))}if(this.state.top&&(c=this.tokenizer.paragraph(f))){let p=r.at(-1);i&&(p==null?void 0:p.type)==="paragraph"?(p.raw+=(p.raw.endsWith(`
`)?"":`
`)+c.raw,p.text+=`
`+c.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=p.text):r.push(c),i=f.length!==t.length,t=t.substring(c.raw.length);continue}if(c=this.tokenizer.text(t)){t=t.substring(c.raw.length);let p=r.at(-1);(p==null?void 0:p.type)==="text"?(p.raw+=(p.raw.endsWith(`
`)?"":`
`)+c.raw,p.text+=`
`+c.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=p.text):r.push(c);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return this.state.top=!0,r}inline(t,r=[]){return this.inlineQueue.push({src:t,tokens:r}),r}inlineTokens(t,r=[]){var f,p,_,$,O;this.tokenizer.lexer=this;let i=t,o=null;if(this.tokens.links){let y=Object.keys(this.tokens.links);if(y.length>0)for(;(o=this.tokenizer.rules.inline.reflinkSearch.exec(i))!==null;)y.includes(o[0].slice(o[0].lastIndexOf("[")+1,-1))&&(i=i.slice(0,o.index)+"["+"a".repeat(o[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(o=this.tokenizer.rules.inline.anyPunctuation.exec(i))!==null;)i=i.slice(0,o.index)+"++"+i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let s;for(;(o=this.tokenizer.rules.inline.blockSkip.exec(i))!==null;)s=o[2]?o[2].length:0,i=i.slice(0,o.index+s)+"["+"a".repeat(o[0].length-s-2)+"]"+i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);i=((p=(f=this.options.hooks)==null?void 0:f.emStrongMask)==null?void 0:p.call({lexer:this},i))??i;let n=!1,d="",c=1/0;for(;t;){if(t.length<c)c=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}n||(d=""),n=!1;let y;if(($=(_=this.options.extensions)==null?void 0:_.inline)!=null&&$.some(B=>(y=B.call({lexer:this},t,r))?(t=t.substring(y.raw.length),r.push(y),!0):!1))continue;if(y=this.tokenizer.escape(t)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.tag(t)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.link(t)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(y.raw.length);let B=r.at(-1);y.type==="text"&&(B==null?void 0:B.type)==="text"?(B.raw+=y.raw,B.text+=y.text):r.push(y);continue}if(y=this.tokenizer.emStrong(t,i,d)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.codespan(t)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.br(t)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.del(t,i,d)){t=t.substring(y.raw.length),r.push(y);continue}if(y=this.tokenizer.autolink(t)){t=t.substring(y.raw.length),r.push(y);continue}if(!this.state.inLink&&(y=this.tokenizer.url(t))){t=t.substring(y.raw.length),r.push(y);continue}let Q=t;if((O=this.options.extensions)!=null&&O.startInline){let B=1/0,Te=t.slice(1),We;this.options.extensions.startInline.forEach(It=>{We=It.call({lexer:this},Te),typeof We=="number"&&We>=0&&(B=Math.min(B,We))}),B<1/0&&B>=0&&(Q=t.substring(0,B+1))}if(y=this.tokenizer.inlineText(Q)){t=t.substring(y.raw.length),y.raw.slice(-1)!=="_"&&(d=y.raw.slice(-1)),n=!0;let B=r.at(-1);(B==null?void 0:B.type)==="text"?(B.raw+=y.raw,B.text+=y.text):r.push(y);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return r}infiniteLoopError(t){let r="Infinite loop on byte: "+t;if(this.options.silent)console.error(r);else throw new Error(r)}},Ji=class{constructor(e){U(this,"options");U(this,"parser");this.options=e||sr}space(e){return""}code({text:e,lang:t,escaped:r}){var s;let i=(s=(t||"").match(le.notSpaceStart))==null?void 0:s[0],o=e.replace(le.endingNewline,"")+`
`;return i?'<pre><code class="language-'+Ye(i)+'">'+(r?o:Ye(o,!0))+`</code></pre>
`:"<pre><code>"+(r?o:Ye(o,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return""}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,r=e.start,i="";for(let n=0;n<e.items.length;n++){let d=e.items[n];i+=this.listitem(d)}let o=t?"ol":"ul",s=t&&r!==1?' start="'+r+'"':"";return"<"+o+s+`>
`+i+"</"+o+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",r="";for(let o=0;o<e.header.length;o++)r+=this.tablecell(e.header[o]);t+=this.tablerow({text:r});let i="";for(let o=0;o<e.rows.length;o++){let s=e.rows[o];r="";for(let n=0;n<s.length;n++)r+=this.tablecell(s[n]);i+=this.tablerow({text:r})}return i&&(i=`<tbody>${i}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+i+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),r=e.header?"th":"td";return(e.align?`<${r} align="${e.align}">`:`<${r}>`)+t+`</${r}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${Ye(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:r}){let i=this.parser.parseInline(r),o=Yn(e);if(o===null)return i;e=o;let s='<a href="'+e+'"';return t&&(s+=' title="'+Ye(t)+'"'),s+=">"+i+"</a>",s}image({href:e,title:t,text:r,tokens:i}){i&&(r=this.parser.parseInline(i,this.parser.textRenderer));let o=Yn(e);if(o===null)return Ye(r);e=o;let s=`<img src="${e}" alt="${Ye(r)}"`;return t&&(s+=` title="${Ye(t)}"`),s+=">",s}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:Ye(e.text)}},Ns=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}checkbox({raw:e}){return e}},Ne=class ns{constructor(t){U(this,"options");U(this,"renderer");U(this,"textRenderer");this.options=t||sr,this.options.renderer=this.options.renderer||new Ji,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Ns}static parse(t,r){return new ns(r).parse(t)}static parseInline(t,r){return new ns(r).parseInline(t)}parse(t){var i,o;this.renderer.parser=this;let r="";for(let s=0;s<t.length;s++){let n=t[s];if((o=(i=this.options.extensions)==null?void 0:i.renderers)!=null&&o[n.type]){let c=n,f=this.options.extensions.renderers[c.type].call({parser:this},c);if(f!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(c.type)){r+=f||"";continue}}let d=n;switch(d.type){case"space":{r+=this.renderer.space(d);break}case"hr":{r+=this.renderer.hr(d);break}case"heading":{r+=this.renderer.heading(d);break}case"code":{r+=this.renderer.code(d);break}case"table":{r+=this.renderer.table(d);break}case"blockquote":{r+=this.renderer.blockquote(d);break}case"list":{r+=this.renderer.list(d);break}case"checkbox":{r+=this.renderer.checkbox(d);break}case"html":{r+=this.renderer.html(d);break}case"def":{r+=this.renderer.def(d);break}case"paragraph":{r+=this.renderer.paragraph(d);break}case"text":{r+=this.renderer.text(d);break}default:{let c='Token with "'+d.type+'" type was not found.';if(this.options.silent)return console.error(c),"";throw new Error(c)}}}return r}parseInline(t,r=this.renderer){var o,s;this.renderer.parser=this;let i="";for(let n=0;n<t.length;n++){let d=t[n];if((s=(o=this.options.extensions)==null?void 0:o.renderers)!=null&&s[d.type]){let f=this.options.extensions.renderers[d.type].call({parser:this},d);if(f!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(d.type)){i+=f||"";continue}}let c=d;switch(c.type){case"escape":{i+=r.text(c);break}case"html":{i+=r.html(c);break}case"link":{i+=r.link(c);break}case"image":{i+=r.image(c);break}case"checkbox":{i+=r.checkbox(c);break}case"strong":{i+=r.strong(c);break}case"em":{i+=r.em(c);break}case"codespan":{i+=r.codespan(c);break}case"br":{i+=r.br(c);break}case"del":{i+=r.del(c);break}case"text":{i+=r.text(c);break}default:{let f='Token with "'+c.type+'" type was not found.';if(this.options.silent)return console.error(f),"";throw new Error(f)}}}return i}},Ni,Kr=(Ni=class{constructor(e){U(this,"options");U(this,"block");this.options=e||sr}preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(e=this.block){return e?Me.lex:Me.lexInline}provideParser(e=this.block){return e?Ne.parse:Ne.parseInline}},U(Ni,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens","emStrongMask"])),U(Ni,"passThroughHooksRespectAsync",new Set(["preprocess","postprocess","processAllTokens"])),Ni),Wh=class{constructor(...e){U(this,"defaults",As());U(this,"options",this.setOptions);U(this,"parse",this.parseMarkdown(!0));U(this,"parseInline",this.parseMarkdown(!1));U(this,"Parser",Ne);U(this,"Renderer",Ji);U(this,"TextRenderer",Ns);U(this,"Lexer",Me);U(this,"Tokenizer",Zi);U(this,"Hooks",Kr);this.use(...e)}walkTokens(e,t){var i,o;let r=[];for(let s of e)switch(r=r.concat(t.call(this,s)),s.type){case"table":{let n=s;for(let d of n.header)r=r.concat(this.walkTokens(d.tokens,t));for(let d of n.rows)for(let c of d)r=r.concat(this.walkTokens(c.tokens,t));break}case"list":{let n=s;r=r.concat(this.walkTokens(n.items,t));break}default:{let n=s;(o=(i=this.defaults.extensions)==null?void 0:i.childTokens)!=null&&o[n.type]?this.defaults.extensions.childTokens[n.type].forEach(d=>{let c=n[d].flat(1/0);r=r.concat(this.walkTokens(c,t))}):n.tokens&&(r=r.concat(this.walkTokens(n.tokens,t)))}}return r}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(r=>{let i={...r};if(i.async=this.defaults.async||i.async||!1,r.extensions&&(r.extensions.forEach(o=>{if(!o.name)throw new Error("extension name required");if("renderer"in o){let s=t.renderers[o.name];s?t.renderers[o.name]=function(...n){let d=o.renderer.apply(this,n);return d===!1&&(d=s.apply(this,n)),d}:t.renderers[o.name]=o.renderer}if("tokenizer"in o){if(!o.level||o.level!=="block"&&o.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let s=t[o.level];s?s.unshift(o.tokenizer):t[o.level]=[o.tokenizer],o.start&&(o.level==="block"?t.startBlock?t.startBlock.push(o.start):t.startBlock=[o.start]:o.level==="inline"&&(t.startInline?t.startInline.push(o.start):t.startInline=[o.start]))}"childTokens"in o&&o.childTokens&&(t.childTokens[o.name]=o.childTokens)}),i.extensions=t),r.renderer){let o=this.defaults.renderer||new Ji(this.defaults);for(let s in r.renderer){if(!(s in o))throw new Error(`renderer '${s}' does not exist`);if(["options","parser"].includes(s))continue;let n=s,d=r.renderer[n],c=o[n];o[n]=(...f)=>{let p=d.apply(o,f);return p===!1&&(p=c.apply(o,f)),p||""}}i.renderer=o}if(r.tokenizer){let o=this.defaults.tokenizer||new Zi(this.defaults);for(let s in r.tokenizer){if(!(s in o))throw new Error(`tokenizer '${s}' does not exist`);if(["options","rules","lexer"].includes(s))continue;let n=s,d=r.tokenizer[n],c=o[n];o[n]=(...f)=>{let p=d.apply(o,f);return p===!1&&(p=c.apply(o,f)),p}}i.tokenizer=o}if(r.hooks){let o=this.defaults.hooks||new Kr;for(let s in r.hooks){if(!(s in o))throw new Error(`hook '${s}' does not exist`);if(["options","block"].includes(s))continue;let n=s,d=r.hooks[n],c=o[n];Kr.passThroughHooks.has(s)?o[n]=f=>{if(this.defaults.async&&Kr.passThroughHooksRespectAsync.has(s))return(async()=>{let _=await d.call(o,f);return c.call(o,_)})();let p=d.call(o,f);return c.call(o,p)}:o[n]=(...f)=>{if(this.defaults.async)return(async()=>{let _=await d.apply(o,f);return _===!1&&(_=await c.apply(o,f)),_})();let p=d.apply(o,f);return p===!1&&(p=c.apply(o,f)),p}}i.hooks=o}if(r.walkTokens){let o=this.defaults.walkTokens,s=r.walkTokens;i.walkTokens=function(n){let d=[];return d.push(s.call(this,n)),o&&(d=d.concat(o.call(this,n))),d}}this.defaults={...this.defaults,...i}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return Me.lex(e,t??this.defaults)}parser(e,t){return Ne.parse(e,t??this.defaults)}parseMarkdown(e){return(t,r)=>{let i={...r},o={...this.defaults,...i},s=this.onError(!!o.silent,!!o.async);if(this.defaults.async===!0&&i.async===!1)return s(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof t>"u"||t===null)return s(new Error("marked(): input parameter is undefined or null"));if(typeof t!="string")return s(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));if(o.hooks&&(o.hooks.options=o,o.hooks.block=e),o.async)return(async()=>{let n=o.hooks?await o.hooks.preprocess(t):t,d=await(o.hooks?await o.hooks.provideLexer(e):e?Me.lex:Me.lexInline)(n,o),c=o.hooks?await o.hooks.processAllTokens(d):d;o.walkTokens&&await Promise.all(this.walkTokens(c,o.walkTokens));let f=await(o.hooks?await o.hooks.provideParser(e):e?Ne.parse:Ne.parseInline)(c,o);return o.hooks?await o.hooks.postprocess(f):f})().catch(s);try{o.hooks&&(t=o.hooks.preprocess(t));let n=(o.hooks?o.hooks.provideLexer(e):e?Me.lex:Me.lexInline)(t,o);o.hooks&&(n=o.hooks.processAllTokens(n)),o.walkTokens&&this.walkTokens(n,o.walkTokens);let d=(o.hooks?o.hooks.provideParser(e):e?Ne.parse:Ne.parseInline)(n,o);return o.hooks&&(d=o.hooks.postprocess(d)),d}catch(n){return s(n)}}}onError(e,t){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let i="<p>An error occurred:</p><pre>"+Ye(r.message+"",!0)+"</pre>";return t?Promise.resolve(i):i}if(t)return Promise.reject(r);throw r}}},Zt=new Wh;function N(e,t){return Zt.parse(e,t)}N.options=N.setOptions=function(e){return Zt.setOptions(e),N.defaults=Zt.defaults,il(N.defaults),N};N.getDefaults=As;N.defaults=sr;N.use=function(...e){return Zt.use(...e),N.defaults=Zt.defaults,il(N.defaults),N};N.walkTokens=function(e,t){return Zt.walkTokens(e,t)};N.parseInline=Zt.parseInline;N.Parser=Ne;N.parser=Ne.parse;N.Renderer=Ji;N.TextRenderer=Ns;N.Lexer=Me;N.lexer=Me.lex;N.Tokenizer=Zi;N.Hooks=Kr;N.parse=N;N.options;N.setOptions;N.use;N.walkTokens;N.parseInline;Ne.parse;Me.lex;/*! @license DOMPurify 3.4.13 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.13/LICENSE */function Qn(e,t){(t==null||t>e.length)&&(t=e.length);for(var r=0,i=Array(t);r<t;r++)i[r]=e[r];return i}function Vh(e){if(Array.isArray(e))return e}function qh(e,t){var r=e==null?null:typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(r!=null){var i,o,s,n,d=[],c=!0,f=!1;try{if(s=(r=r.call(e)).next,t!==0)for(;!(c=(i=s.call(r)).done)&&(d.push(i.value),d.length!==t);c=!0);}catch(p){f=!0,o=p}finally{try{if(!c&&r.return!=null&&(n=r.return(),Object(n)!==n))return}finally{if(f)throw o}}return d}}function Gh(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Xh(e,t){return Vh(e)||qh(e,t)||Yh(e,t)||Gh()}function Yh(e,t){if(e){if(typeof e=="string")return Qn(e,t);var r={}.toString.call(e).slice(8,-1);return r==="Object"&&e.constructor&&(r=e.constructor.name),r==="Map"||r==="Set"?Array.from(e):r==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?Qn(e,t):void 0}}const pl=Object.entries,ea=Object.setPrototypeOf,Kh=Object.isFrozen,Zh=Object.getPrototypeOf,Jh=Object.getOwnPropertyDescriptor;let oe=Object.freeze,se=Object.seal,vr=Object.create,fl=typeof Reflect<"u"&&Reflect,as=fl.apply,ls=fl.construct;oe||(oe=function(t){return t});se||(se=function(t){return t});as||(as=function(t,r){for(var i=arguments.length,o=new Array(i>2?i-2:0),s=2;s<i;s++)o[s-2]=arguments[s];return t.apply(r,o)});ls||(ls=function(t){for(var r=arguments.length,i=new Array(r>1?r-1:0),o=1;o<r;o++)i[o-1]=arguments[o];return new t(...i)});const mr=Z(Array.prototype.forEach),Qh=Z(Array.prototype.lastIndexOf),ta=Z(Array.prototype.pop),br=Z(Array.prototype.push),eu=Z(Array.prototype.splice),wt=Array.isArray,Zr=Z(String.prototype.toLowerCase),qo=Z(String.prototype.toString),ra=Z(String.prototype.match),qr=Z(String.prototype.replace),ia=Z(String.prototype.indexOf),tu=Z(String.prototype.trim),ru=Z(Number.prototype.toString),iu=Z(Boolean.prototype.toString),oa=typeof BigInt>"u"?null:Z(BigInt.prototype.toString),sa=typeof Symbol>"u"?null:Z(Symbol.prototype.toString),te=Z(Object.prototype.hasOwnProperty),Gr=Z(Object.prototype.toString),ee=Z(RegExp.prototype.test),Nt=ou(TypeError);function Z(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var r=arguments.length,i=new Array(r>1?r-1:0),o=1;o<r;o++)i[o-1]=arguments[o];return as(e,t,i)}}function ou(e){return function(){for(var t=arguments.length,r=new Array(t),i=0;i<t;i++)r[i]=arguments[i];return ls(e,r)}}function R(e,t){let r=arguments.length>2&&arguments[2]!==void 0?arguments[2]:Zr;if(ea&&ea(e,null),!wt(t))return e;let i=t.length;for(;i--;){let o=t[i];if(typeof o=="string"){const s=r(o);s!==o&&(Kh(t)||(t[i]=s),o=s)}e[o]=!0}return e}function su(e){for(let t=0;t<e.length;t++)te(e,t)||(e[t]=null);return e}function ae(e){const t=vr(null);for(const i of pl(e)){var r=Xh(i,2);const o=r[0],s=r[1];te(e,o)&&(wt(s)?t[o]=su(s):s&&typeof s=="object"&&s.constructor===Object?t[o]=ae(s):t[o]=s)}return t}function nu(e){switch(typeof e){case"string":return e;case"number":return ru(e);case"boolean":return iu(e);case"bigint":return oa?oa(e):"0";case"symbol":return sa?sa(e):"Symbol()";case"undefined":return Gr(e);case"function":case"object":{if(e===null)return Gr(e);const t=e,r=Le(t,"toString");if(typeof r=="function"){const i=r(t);return typeof i=="string"?i:Gr(i)}return Gr(e)}default:return Gr(e)}}function Le(e,t){for(;e!==null;){const i=Jh(e,t);if(i){if(i.get)return Z(i.get);if(typeof i.value=="function")return Z(i.value)}e=Zh(e)}function r(){return null}return r}function au(e){try{return ee(e,""),!0}catch{return!1}}const na=oe(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),Go=oe(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Xo=oe(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),lu=oe(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Yo=oe(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),cu=oe(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),aa=oe(["#text"]),la=oe(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),Ko=oe(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),ca=oe(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),Mi=oe(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),du=se(/{{[\w\W]*|^[\w\W]*}}/g),hu=se(/<%[\w\W]*|^[\w\W]*%>/g),uu=se(/\${[\w\W]*/g),pu=se(/^data-[\-\w.\u00B7-\uFFFF]+$/),fu=se(/^aria-[\-\w]+$/),da=se(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),mu=se(/^(?:\w+script|data):/i),bu=se(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),gu=se(/^html$/i),vu=se(/^[a-z][.\w]*(-[.\w]+)+$/i),ha=se(/<[/\w!]/g),ua=se(/<[/\w]/g),xu=se(/<\/no(script|embed|frames)/i),_u=se(/\/>/i),we={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},wu=function(){return typeof window>"u"?null:window},yu=function(t,r){if(typeof t!="object"||typeof t.createPolicy!="function")return null;let i=null;const o="data-tt-policy-suffix";r&&r.hasAttribute(o)&&(i=r.getAttribute(o));const s="dompurify"+(i?"#"+i:"");try{return t.createPolicy(s,{createHTML(n){return n},createScriptURL(n){return n}})}catch{return console.warn("TrustedTypes policy "+s+" could not be created."),null}},pa=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},ft=function(t,r,i,o){return te(t,r)&&wt(t[r])?R(o.base?ae(o.base):{},t[r],o.transform):i};function ml(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:wu();const t=w=>ml(w);if(t.version="3.4.13",t.removed=[],!e||!e.document||e.document.nodeType!==we.document||!e.Element)return t.isSupported=!1,t;let r=e.document;const i=r,o=i.currentScript;e.DocumentFragment;const s=e.HTMLTemplateElement,n=e.Node,d=e.Element,c=e.NodeFilter,f=e.NamedNodeMap;f===void 0&&(e.NamedNodeMap||e.MozNamedAttrMap),e.HTMLFormElement;const p=e.DOMParser,_=e.trustedTypes,$=d.prototype,O=Le($,"cloneNode"),y=Le($,"remove"),Q=Le($,"nextSibling"),B=Le($,"childNodes"),Te=Le($,"parentNode"),We=Le($,"shadowRoot"),It=Le($,"attributes"),ie=n&&n.prototype?Le(n.prototype,"nodeType"):null,me=n&&n.prototype?Le(n.prototype,"nodeName"):null,Ve=n&&n.prototype?Le(n.prototype,"ownerDocument"):null;if(typeof s=="function"){const w=r.createElement("template");w.content&&w.content.ownerDocument&&(r=w.content.ownerDocument)}let be,zt="",go,Gs=!1,zr=0;const Xs=function(){if(zr>0)throw Nt('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},lr=function(l){Xs(),zr++;try{return be.createHTML(l)}finally{zr--}},Rl=function(l){Xs(),zr++;try{return be.createScriptURL(l)}finally{zr--}},Ll=function(){return Gs||(go=yu(_,o),Gs=!0),go},yi=r,vo=yi.implementation,Ys=yi.createNodeIterator,Ml=yi.createDocumentFragment,Nl=yi.getElementsByTagName,Fl=i.importNode;let V=pa();t.isSupported=typeof pl=="function"&&typeof Te=="function"&&vo&&vo.createHTMLDocument!==void 0;const Bl=du,jl=hu,Hl=uu,Ul=pu,Wl=fu,Vl=mu,Ks=bu,ql=vu;let Zs=da,q=null;const xo=R({},[...na,...Go,...Xo,...Yo,...aa]);let G=null;const _o=R({},[...la,...Ko,...ca,...Mi]);let K=Object.seal(vr(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),Rr=null,Js=null;const ct=Object.seal(vr(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let Qs=!0,wo=!0,en=!1,tn=!0,dt=!1,ht=!0,Rt=!1,yo=!1,ki=null,$i=null,ko=!1,cr=!1,Si=!1,Ei=!1,rn=!0,on=!1;const sn="user-content-";let $o=!0,Ci=!1,dr={},qe=null;const So=R({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]);let nn=null;const an=R({},["audio","video","img","source","image","track"]);let Eo=null;const ln=R({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),Ti="http://www.w3.org/1998/Math/MathML",Pi="http://www.w3.org/2000/svg",Ge="http://www.w3.org/1999/xhtml";let hr=Ge,Co=!1,To=null;const Gl=R({},[Ti,Pi,Ge],qo),cn=oe(["mi","mo","mn","ms","mtext"]);let Po=R({},cn);const dn=oe(["annotation-xml"]);let Ao=R({},dn);const Xl=R({},["title","style","font","a","script"]);let Lr=null;const Yl=["application/xhtml+xml","text/html"],Kl="text/html";let X=null,ur=null;const Zl=r.createElement("form"),hn=function(l){return l instanceof RegExp||l instanceof Function},Do=function(){let l=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(ur&&ur===l)return;(!l||typeof l!="object")&&(l={}),l=ae(l),Lr=Yl.indexOf(l.PARSER_MEDIA_TYPE)===-1?Kl:l.PARSER_MEDIA_TYPE,X=Lr==="application/xhtml+xml"?qo:Zr,q=ft(l,"ALLOWED_TAGS",xo,{transform:X}),G=ft(l,"ALLOWED_ATTR",_o,{transform:X}),To=ft(l,"ALLOWED_NAMESPACES",Gl,{transform:qo}),Eo=ft(l,"ADD_URI_SAFE_ATTR",ln,{transform:X,base:ln}),nn=ft(l,"ADD_DATA_URI_TAGS",an,{transform:X,base:an}),qe=ft(l,"FORBID_CONTENTS",So,{transform:X}),Rr=ft(l,"FORBID_TAGS",ae({}),{transform:X}),Js=ft(l,"FORBID_ATTR",ae({}),{transform:X}),dr=te(l,"USE_PROFILES")?l.USE_PROFILES&&typeof l.USE_PROFILES=="object"?ae(l.USE_PROFILES):l.USE_PROFILES:!1,Qs=l.ALLOW_ARIA_ATTR!==!1,wo=l.ALLOW_DATA_ATTR!==!1,en=l.ALLOW_UNKNOWN_PROTOCOLS||!1,tn=l.ALLOW_SELF_CLOSE_IN_ATTR!==!1,dt=l.SAFE_FOR_TEMPLATES||!1,ht=l.SAFE_FOR_XML!==!1,Rt=l.WHOLE_DOCUMENT||!1,cr=l.RETURN_DOM||!1,Si=l.RETURN_DOM_FRAGMENT||!1,Ei=l.RETURN_TRUSTED_TYPE||!1,ko=l.FORCE_BODY||!1,rn=l.SANITIZE_DOM!==!1,on=l.SANITIZE_NAMED_PROPS||!1,$o=l.KEEP_CONTENT!==!1,Ci=l.IN_PLACE||!1,Zs=au(l.ALLOWED_URI_REGEXP)?l.ALLOWED_URI_REGEXP:da,hr=typeof l.NAMESPACE=="string"?l.NAMESPACE:Ge,Po=te(l,"MATHML_TEXT_INTEGRATION_POINTS")&&l.MATHML_TEXT_INTEGRATION_POINTS&&typeof l.MATHML_TEXT_INTEGRATION_POINTS=="object"?ae(l.MATHML_TEXT_INTEGRATION_POINTS):R({},cn),Ao=te(l,"HTML_INTEGRATION_POINTS")&&l.HTML_INTEGRATION_POINTS&&typeof l.HTML_INTEGRATION_POINTS=="object"?ae(l.HTML_INTEGRATION_POINTS):R({},dn);const u=te(l,"CUSTOM_ELEMENT_HANDLING")&&l.CUSTOM_ELEMENT_HANDLING&&typeof l.CUSTOM_ELEMENT_HANDLING=="object"?ae(l.CUSTOM_ELEMENT_HANDLING):vr(null);if(K=vr(null),te(u,"tagNameCheck")&&hn(u.tagNameCheck)&&(K.tagNameCheck=u.tagNameCheck),te(u,"attributeNameCheck")&&hn(u.attributeNameCheck)&&(K.attributeNameCheck=u.attributeNameCheck),te(u,"allowCustomizedBuiltInElements")&&typeof u.allowCustomizedBuiltInElements=="boolean"&&(K.allowCustomizedBuiltInElements=u.allowCustomizedBuiltInElements),se(K),dt&&(wo=!1),Si&&(cr=!0),dr&&(q=R({},aa),G=vr(null),dr.html===!0&&(R(q,na),R(G,la)),dr.svg===!0&&(R(q,Go),R(G,Ko),R(G,Mi)),dr.svgFilters===!0&&(R(q,Xo),R(G,Ko),R(G,Mi)),dr.mathMl===!0&&(R(q,Yo),R(G,ca),R(G,Mi))),ct.tagCheck=null,ct.attributeCheck=null,te(l,"ADD_TAGS")&&(typeof l.ADD_TAGS=="function"?ct.tagCheck=l.ADD_TAGS:wt(l.ADD_TAGS)&&(q===xo&&(q=ae(q)),R(q,l.ADD_TAGS,X))),te(l,"ADD_ATTR")&&(typeof l.ADD_ATTR=="function"?ct.attributeCheck=l.ADD_ATTR:wt(l.ADD_ATTR)&&(G===_o&&(G=ae(G)),R(G,l.ADD_ATTR,X))),te(l,"ADD_URI_SAFE_ATTR")&&wt(l.ADD_URI_SAFE_ATTR)&&R(Eo,l.ADD_URI_SAFE_ATTR,X),te(l,"FORBID_CONTENTS")&&wt(l.FORBID_CONTENTS)&&(qe===So&&(qe=ae(qe)),R(qe,l.FORBID_CONTENTS,X)),te(l,"ADD_FORBID_CONTENTS")&&wt(l.ADD_FORBID_CONTENTS)&&(qe===So&&(qe=ae(qe)),R(qe,l.ADD_FORBID_CONTENTS,X)),$o&&(q["#text"]=!0),Rt&&R(q,["html","head","body"]),q.table&&(R(q,["tbody"]),delete Rr.tbody),l.TRUSTED_TYPES_POLICY){if(typeof l.TRUSTED_TYPES_POLICY.createHTML!="function")throw Nt('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof l.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw Nt('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');const x=be;be=l.TRUSTED_TYPES_POLICY;try{zt=lr("")}catch(E){throw be=x,E}}else l.TRUSTED_TYPES_POLICY===null?(be=void 0,zt=""):(be===void 0&&(be=Ll()),be&&typeof zt=="string"&&(zt=lr("")));oe&&oe(l),ur=l},un=R({},[...Go,...Xo,...lu]),pn=R({},[...Yo,...cu]),Jl=function(l,u,x){return u.namespaceURI===Ge?l==="svg":u.namespaceURI===Ti?l==="svg"&&(x==="annotation-xml"||Po[x]):!!un[l]},Ql=function(l,u,x){return u.namespaceURI===Ge?l==="math":u.namespaceURI===Pi?l==="math"&&Ao[x]:!!pn[l]},ec=function(l,u,x){return u.namespaceURI===Pi&&!Ao[x]||u.namespaceURI===Ti&&!Po[x]?!1:!pn[l]&&(Xl[l]||!un[l])},tc=function(l){let u=Te(l);(!u||!u.tagName)&&(u={namespaceURI:hr,tagName:"template"});const x=Zr(l.tagName),E=Zr(u.tagName);return To[l.namespaceURI]?l.namespaceURI===Pi?Jl(x,u,E):l.namespaceURI===Ti?Ql(x,u,E):l.namespaceURI===Ge?ec(x,u,E):!!(Lr==="application/xhtml+xml"&&To[l.namespaceURI]):!1},ut=function(l){br(t.removed,{element:l});try{Te(l).removeChild(l)}catch{if(y(l),!Te(l))throw Nt("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},Ai=function(l){Mr(l);const u=B(l);if(u){const E=[];mr(u,C=>{br(E,C)}),mr(E,C=>{try{y(C)}catch{}})}const x=It(l);if(x)for(let E=x.length-1;E>=0;--E){const C=x[E],D=C&&C.name;if(typeof D=="string")try{l.removeAttribute(D)}catch{}}},Lt=function(l,u){try{br(t.removed,{attribute:u.getAttributeNode(l),from:u})}catch{br(t.removed,{attribute:null,from:u})}if(u.removeAttribute(l),l==="is")if(cr||Si)try{ut(u)}catch{}else try{u.setAttribute(l,"")}catch{}},rc=function(l){const u=It(l);if(u)for(let x=u.length-1;x>=0;--x){const E=u[x],C=E&&E.name;if(!(typeof C!="string"||G[X(C)]))try{l.removeAttribute(C)}catch{}}},Mr=function(l){const u=[l];for(;u.length>0;){const x=u.pop();(ie?ie(x):x.nodeType)===we.element&&rc(x);const C=B(x);if(C)for(let D=C.length-1;D>=0;--D)u.push(C[D])}},ic=function(l){if(!ht)return;const u=[l];for(;u.length>0;){const x=u.pop(),E=ie?ie(x):x.nodeType;if(E===we.processingInstruction||E===we.comment&&ee(ua,x.data)){try{y(x)}catch{}continue}if(E===we.element){const D=x,H=X(me?me(x):x.nodeName);try{D.hasAttribute&&D.hasAttribute("patchsrc")&&D.removeAttribute("patchsrc"),D.hasAttribute&&D.hasAttribute("for")&&H!=="label"&&H!=="output"&&D.removeAttribute("for")}catch{}}const C=B(x);if(C)for(let D=C.length-1;D>=0;--D)u.push(C[D])}},fn=function(l){let u=null,x=null;if(ko)l="<remove></remove>"+l;else{const D=ra(l,/^[\r\n\t ]+/);x=D&&D[0]}Lr==="application/xhtml+xml"&&hr===Ge&&(l='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+l+"</body></html>");const E=be?lr(l):l;if(hr===Ge)try{u=new p().parseFromString(E,Lr)}catch{}if(!u||!u.documentElement){u=vo.createDocument(hr,"template",null);try{u.documentElement.innerHTML=Co?zt:E}catch{}}const C=u.body||u.documentElement;return l&&x&&C.insertBefore(r.createTextNode(x),C.childNodes[0]||null),hr===Ge?Nl.call(u,Rt?"html":"body")[0]:Rt?u.documentElement:C},mn=function(l){const u=Ve?Ve(l):l.ownerDocument;return Ys.call(u||l,l,c.SHOW_ELEMENT|c.SHOW_COMMENT|c.SHOW_TEXT|c.SHOW_PROCESSING_INSTRUCTION|c.SHOW_CDATA_SECTION,null)},Di=function(l){return l=qr(l,Bl," "),l=qr(l,jl," "),l=qr(l,Hl," "),l},Oo=function(l){var u;l.normalize();const x=Ve?Ve(l):l.ownerDocument,E=Ys.call(x||l,l,c.SHOW_TEXT|c.SHOW_COMMENT|c.SHOW_CDATA_SECTION|c.SHOW_PROCESSING_INSTRUCTION,null);let C=E.nextNode();for(;C;)C.data=Di(C.data),C=E.nextNode();const D=(u=l.querySelectorAll)===null||u===void 0?void 0:u.call(l,"template");D&&mr(D,H=>{pr(H.content)&&Oo(H.content)})},Oi=function(l){const u=me?me(l):null;return typeof u!="string"||X(u)!=="form"?!1:typeof l.nodeName!="string"||typeof l.textContent!="string"||typeof l.removeChild!="function"||l.attributes!==It(l)||typeof l.removeAttribute!="function"||typeof l.setAttribute!="function"||typeof l.namespaceURI!="string"||typeof l.insertBefore!="function"||typeof l.hasChildNodes!="function"||l.nodeType!==ie(l)||l.childNodes!==B(l)},pr=function(l){if(!ie||typeof l!="object"||l===null)return!1;try{return ie(l)===we.documentFragment}catch{return!1}},Nr=function(l){if(!ie||typeof l!="object"||l===null)return!1;try{return typeof ie(l)=="number"}catch{return!1}};function Xe(w,l,u){w.length!==0&&mr(w,x=>{x.call(t,l,u,ur)})}const oc=function(l,u){return!!(ht&&l.hasChildNodes()&&!Nr(l.firstElementChild)&&ee(ha,l.textContent)&&ee(ha,l.innerHTML)||ht&&l.namespaceURI===Ge&&u==="style"&&Nr(l.firstElementChild)||l.nodeType===we.processingInstruction||ht&&l.nodeType===we.comment&&ee(ua,l.data))},sc=function(l,u,x){if(!Rr[u]&&xn(u)&&(K.tagNameCheck instanceof RegExp&&ee(K.tagNameCheck,u)||K.tagNameCheck instanceof Function&&K.tagNameCheck(u)))return!1;if($o&&!qe[u]){const E=Te(l),C=B(l);if(C&&E){const D=C.length;for(let H=D-1;H>=0;--H){const Y=l===x?O(C[H],!0):C[H];E.insertBefore(Y,Q(l))}}}return ut(l),!0},bn=function(l,u,x,E){return l.length===0?u:u===x||u===E?ae(u):u},gn=function(l,u){if(Xe(V.beforeSanitizeElements,l,null),l!==u&&Te(l)===null)return Ci&&Mr(l),!0;if(Oi(l))return ut(l),!0;const x=X(me?me(l):l.nodeName);if(q=bn(V.uponSanitizeElement,q,xo,ki),Xe(V.uponSanitizeElement,l,{tagName:x,allowedTags:q}),l!==u&&Te(l)===null)return Ci&&Mr(l),!0;if(oc(l,x))return ut(l),!0;if(Rr[x]||!(ct.tagCheck instanceof Function&&ct.tagCheck(x))&&!q[x]){const C=sc(l,x,u);return C===!1&&Xe(V.afterSanitizeElements,l,null),C}if((ie?ie(l):l.nodeType)===we.element&&!tc(l)||(x==="noscript"||x==="noembed"||x==="noframes")&&ee(xu,l.innerHTML))return ut(l),!0;if(dt&&l.nodeType===we.text){const C=Di(l.textContent);l.textContent!==C&&(br(t.removed,{element:l.cloneNode()}),l.textContent=C)}return Xe(V.afterSanitizeElements,l,null),!1},vn=function(l,u,x){if(Js[u]||ht&&u==="patchsrc"||ht&&u==="for"&&l!=="label"&&l!=="output"||rn&&(u==="id"||u==="name")&&(x in r||x in Zl))return!1;const E=G[u]||ct.attributeCheck instanceof Function&&ct.attributeCheck(u,l);if(!(wo&&ee(Ul,u))){if(!(Qs&&ee(Wl,u))){if(E){if(!Eo[u]){if(!ee(Zs,qr(x,Ks,""))){if(!((u==="src"||u==="xlink:href"||u==="href")&&l!=="script"&&ia(x,"data:")===0&&nn[l])){if(!(en&&!ee(Vl,qr(x,Ks,"")))){if(x)return!1}}}}}else if(!(xn(l)&&(K.tagNameCheck instanceof RegExp&&ee(K.tagNameCheck,l)||K.tagNameCheck instanceof Function&&K.tagNameCheck(l))&&(K.attributeNameCheck instanceof RegExp&&ee(K.attributeNameCheck,u)||K.attributeNameCheck instanceof Function&&K.attributeNameCheck(u,l))||u==="is"&&K.allowCustomizedBuiltInElements&&(K.tagNameCheck instanceof RegExp&&ee(K.tagNameCheck,x)||K.tagNameCheck instanceof Function&&K.tagNameCheck(x))))return!1}}return!0},nc=R({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),xn=function(l){return!nc[Zr(l)]&&ee(ql,l)},ac=function(l,u,x,E){if(be&&typeof _=="object"&&typeof _.getAttributeType=="function"&&!x)switch(_.getAttributeType(l,u)){case"TrustedHTML":return lr(E);case"TrustedScriptURL":return Rl(E)}return E},lc=function(l,u,x,E){try{x?l.setAttributeNS(x,u,E):l.setAttribute(u,E),Oi(l)?ut(l):ta(t.removed)}catch{Lt(u,l)}},_n=function(l){Xe(V.beforeSanitizeAttributes,l,null);const u=l.attributes;if(!u||Oi(l))return;G=bn(V.uponSanitizeAttribute,G,_o,$i);const x={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:G,forceKeepAttr:void 0};let E=u.length;const C=X(l.nodeName);for(;E--;){const D=u[E],H=D.name,Y=D.namespaceURI,ge=D.value,ve=X(H),zo=ge;let he=H==="value"?zo:tu(zo);if(x.attrName=ve,x.attrValue=he,x.keepAttr=!0,x.forceKeepAttr=void 0,Xe(V.uponSanitizeAttribute,l,x),he=x.attrValue,on&&(ve==="id"||ve==="name")&&ia(he,sn)!==0&&(Lt(H,l),he=sn+he),ht&&ee(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,he)){Lt(H,l);continue}if(ve==="attributename"&&ra(he,"href")){Lt(H,l);continue}if(!x.forceKeepAttr){if(!x.keepAttr){Lt(H,l);continue}if(!tn&&ee(_u,he)){Lt(H,l);continue}if(dt&&(he=Di(he)),!vn(C,ve,he)){Lt(H,l);continue}he=ac(C,ve,Y,he),he!==zo&&lc(l,H,Y,he)}}Xe(V.afterSanitizeAttributes,l,null)},Ii=function(l){let u=null;const x=mn(l);for(Xe(V.beforeSanitizeShadowDOM,l,null);u=x.nextNode();)if(Xe(V.uponSanitizeShadowNode,u,null),gn(u,l),_n(u),pr(u.content)&&Ii(u.content),(ie?ie(u):u.nodeType)===we.element){const C=We(u);pr(C)&&(Io(C),Ii(C))}Xe(V.afterSanitizeShadowDOM,l,null)},Io=function(l){const u=[{node:l,shadow:null}];for(;u.length>0;){const x=u.pop();if(x.shadow){Ii(x.shadow);continue}const E=x.node,D=(ie?ie(E):E.nodeType)===we.element,H=B(E);if(H)for(let Y=H.length-1;Y>=0;--Y)u.push({node:H[Y],shadow:null});if(D){const Y=me?me(E):null;if(typeof Y=="string"&&X(Y)==="template"){const ge=E.content;pr(ge)&&u.push({node:ge,shadow:null})}}if(D){const Y=We(E);pr(Y)&&u.push({node:null,shadow:Y},{node:Y,shadow:null})}}};return t.sanitize=function(w){let l=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},u=null,x=null,E=null,C=null;if(Co=!w,Co&&(w="<!-->"),typeof w!="string"&&!Nr(w)&&(w=nu(w),typeof w!="string"))throw Nt("dirty is not a string, aborting");if(!t.isSupported)return w;yo?(q=ki,G=$i):Do(l),(V.uponSanitizeElement.length>0||V.uponSanitizeAttribute.length>0)&&(q=ae(q)),V.uponSanitizeAttribute.length>0&&(G=ae(G)),t.removed=[];const D=Ci&&typeof w!="string"&&Nr(w);if(D){ic(w);const ge=me?me(w):w.nodeName;if(typeof ge=="string"){const ve=X(ge);if(!q[ve]||Rr[ve])throw Ai(w),Nt("root node is forbidden and cannot be sanitized in-place")}if(Oi(w))throw Ai(w),Nt("root node is clobbered and cannot be sanitized in-place");try{Io(w)}catch(ve){throw Ai(w),ve}}else if(Nr(w))u=fn("<!---->"),x=u.ownerDocument.importNode(w,!0),x.nodeType===we.element&&x.nodeName==="BODY"||x.nodeName==="HTML"?u=x:u.appendChild(x),Io(x);else{if(!cr&&!dt&&!Rt&&w.indexOf("<")===-1)return be&&Ei?lr(w):w;if(u=fn(w),!u)return cr?null:Ei?zt:""}u&&ko&&ut(u.firstChild);const H=D?w:u;try{const ge=mn(H);for(;E=ge.nextNode();)gn(E,H),_n(E),pr(E.content)&&Ii(E.content)}catch(ge){throw D&&(Ai(w),mr(t.removed,ve=>{ve.element&&Mr(ve.element)})),ge}if(D)return mr(t.removed,ge=>{ge.element&&Mr(ge.element)}),dt&&Oo(w),w;if(cr){if(dt&&Oo(u),Si)for(C=Ml.call(u.ownerDocument);u.firstChild;)C.appendChild(u.firstChild);else C=u;return(G.shadowroot||G.shadowrootmode)&&(C=Fl.call(i,C,!0)),C}let Y=Rt?u.outerHTML:u.innerHTML;return Rt&&q["!doctype"]&&u.ownerDocument&&u.ownerDocument.doctype&&u.ownerDocument.doctype.name&&ee(gu,u.ownerDocument.doctype.name)&&(Y="<!DOCTYPE "+u.ownerDocument.doctype.name+`>
`+Y),dt&&(Y=Di(Y)),be&&Ei?lr(Y):Y},t.setConfig=function(){let w=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};Do(w),yo=!0,ki=q,$i=G},t.clearConfig=function(){ur=null,yo=!1,ki=null,$i=null,be=go,zt=""},t.isValidAttribute=function(w,l,u){ur||Do({});const x=X(w),E=X(l);return vn(x,E,u)},t.addHook=function(w,l){typeof l=="function"&&te(V,w)&&br(V[w],l)},t.removeHook=function(w,l){if(te(V,w)){if(l!==void 0){const u=Qh(V[w],l);return u===-1?void 0:eu(V[w],u,1)[0]}return ta(V[w])}},t.removeHooks=function(w){te(V,w)&&(V[w]=[])},t.removeAllHooks=function(){V=pa()},t}var ku=ml();function Qi(e){return ku.sanitize(e,{ADD_ATTR:["loading","target"]})}var $u=Object.defineProperty,Su=Object.getOwnPropertyDescriptor,Fs=(e,t,r,i)=>{for(var o=i>1?void 0:i?Su(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&$u(t,r,o),o};let ai=class extends T{constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}_renderSnippet(){var r;const e=((r=this.result)==null?void 0:r.snippet)??"";if(!e)return null;const t=Qi(N.parse(e,{async:!1}));return a`<div class="snippet" .innerHTML=${t}></div>`}render(){if(!this.result)return null;const e=Math.round(this.result.score*100);return a`
      <div class="path">
        ${this.result.kind==="path"?a`<span class="badge">路径</span>`:null}
        ${this.result.path}${this.result.line?`:${this.result.line}`:""}
      </div>
      ${this._renderSnippet()}
      <div class="score">评分: ${e}%</div>
    `}};ai.styles=S`
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
  `;Fs([h({attribute:!1})],ai.prototype,"result",2);Fs([h({type:Boolean,reflect:!0})],ai.prototype,"active",2);ai=Fs([P("result-card")],ai);var Eu=Object.defineProperty,Cu=Object.getOwnPropertyDescriptor,uo=(e,t,r,i)=>{for(var o=i>1?void 0:i?Cu(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Eu(t,r,o),o};let $r=class extends T{constructor(){super(...arguments),this.results=[],this.activeResult=null,this.loading=!1}render(){return a`
      <div class="list-pane">
        ${this.loading&&this.results.length===0?a`<div class="loading">搜索中</div>`:this.results.length===0?a`<div class="empty">无搜索结果</div>`:this.results.map(e=>a`
                <result-card
                  .result=${e}
                  ?active=${this.activeResult===e}>
                </result-card>`)}
      </div>
    `}};$r.styles=S`
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
  `;uo([h({attribute:!1})],$r.prototype,"results",2);uo([h({attribute:!1})],$r.prototype,"activeResult",2);uo([h({type:Boolean})],$r.prototype,"loading",2);$r=uo([P("search-results")],$r);var Tu=Object.defineProperty,Pu=Object.getOwnPropertyDescriptor,gi=(e,t,r,i)=>{for(var o=i>1?void 0:i?Pu(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Tu(t,r,o),o};let Jt=class extends T{constructor(){super(...arguments),this.src="",this._scale=1,this._x=0,this._y=0,this._dragging=!1,this._sx=0,this._sy=0,this._ox=0,this._oy=0,this._pinchDist=0,this._pinchScale=1,this._onKey=e=>{e.key==="Escape"&&this._close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this._onKey)}disconnectedCallback(){document.removeEventListener("keydown",this._onKey),super.disconnectedCallback()}_close(){this._scale=1,this._x=0,this._y=0,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}_onWheel(e){e.preventDefault();const t=-e.deltaY*.0015;this._scale=Math.max(.5,Math.min(5,this._scale+t))}_onBgClick(e){(e.target===e.currentTarget||e.target.tagName==="DIV")&&this._close()}_onDbl(){this._scale>1.5?(this._scale=1,this._x=0,this._y=0):this._scale=2.5}_md(e){e.preventDefault(),this._dragging=!0,this._sx=e.clientX,this._sy=e.clientY,this._ox=this._x,this._oy=this._y}_mm(e){this._dragging&&(this._x=this._ox+(e.clientX-this._sx),this._y=this._oy+(e.clientY-this._sy))}_mu(){this._dragging=!1}_ts(e){e.touches.length===1?(this._dragging=!0,this._sx=e.touches[0].clientX,this._sy=e.touches[0].clientY,this._ox=this._x,this._oy=this._y):e.touches.length===2&&(this._dragging=!1,this._pinchDist=this._dist(e.touches),this._pinchScale=this._scale)}_tm(e){if(e.preventDefault(),e.touches.length===1&&this._dragging)this._x=this._ox+(e.touches[0].clientX-this._sx),this._y=this._oy+(e.touches[0].clientY-this._sy);else if(e.touches.length===2&&this._pinchDist>0){const t=this._dist(e.touches)/this._pinchDist;this._scale=Math.max(.5,Math.min(5,this._pinchScale*t))}}_te(){this._dragging=!1,this._pinchDist=0}_dist(e){const t=e[0].clientX-e[1].clientX,r=e[0].clientY-e[1].clientY;return Math.hypot(t,r)}render(){return a`
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
    `}};Jt.styles=S`
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
  `;gi([h()],Jt.prototype,"src",2);gi([m()],Jt.prototype,"_scale",2);gi([m()],Jt.prototype,"_x",2);gi([m()],Jt.prototype,"_y",2);Jt=gi([P("image-viewer")],Jt);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class cs extends Cs{constructor(t){if(super(t),this.it=k,t.type!==vt.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(t){if(t===k||t==null)return this._t=void 0,this.it=t;if(t===Pe)return t;if(typeof t!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(t===this.it)return this._t;this.it=t;const r=[t];return r.raw=r,this._t={_$litType$:this.constructor.resultType,strings:r,values:[]}}}cs.directiveName="unsafeHTML",cs.resultType=1;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class ds extends cs{}ds.directiveName="unsafeSVG",ds.resultType=2;const bl=Es(ds),Au=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Du=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Ou=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Iu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,zu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Ru=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Lu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Mu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Nu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Fu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Bu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,ju=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Hu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Uu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Wu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Vu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,qu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Gu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Xu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Yu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Ku=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Zu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Ju=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,Qu=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,ep=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,tp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,rp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,ip=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,op=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,sp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,np=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,ap=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,lp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,cp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,dp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,hp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,up=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,pp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,fp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,mp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`,bp=`<!-- @license lucide-static v1.26.0 - ISC -->
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
`;var gp=Object.defineProperty,vp=Object.getOwnPropertyDescriptor,gl=(e,t,r,i)=>{for(var o=i>1?void 0:i?vp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&gp(t,r,o),o};const xp={search:Au,folder:Du,"folder-open":Ou,file:Iu,"message-circle":zu,upload:Ru,download:Lu,"folder-plus":Mu,pencil:Nu,"arrow-right":Fu,"trash-2":Bu,save:ju,x:Hu,"arrow-left":Vu,"arrow-up":qu,"arrow-up-to-line":Gu,"arrow-down-to-line":Xu,"more-horizontal":Yu,"more-vertical":Ku,"chevron-down":Zu,"chevron-right":Ju,"refresh-cw":Qu,"refresh-ccw":ep,"alert-triangle":tp,check:rp,clipboard:ip,brain:op,settings:sp,globe:np,scale:ap,"book-open":lp,"rotate-ccw":cp,sparkles:dp,regex:hp,camera:up,image:pp,calendar:fp,"chevron-left":mp,"maximize-2":Uu,copy:Wu,square:bp};let eo=class extends T{constructor(){super(...arguments),this.name=""}render(){const e=xp[this.name];return e?a`${bl(e)}`:null}};eo.styles=S`
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
  `;gl([h()],eo.prototype,"name",2);eo=gl([P("doclens-icon")],eo);const fa=300;class Bs{constructor(t,r={}){this.host=t,this.showTop=!1,this.showBottom=!1,this._scroller=null,this._ro=null,this._onScroll=()=>{this.refresh()},this.host.addController(this),this._opts=r}hostDisconnected(){this.detach()}attach(t){this._scroller!==t&&(this.detach(),this._scroller=t,t.addEventListener("scroll",this._onScroll,{passive:!0}),this._ro=new ResizeObserver(this._onScroll),this._ro.observe(t),this.refresh())}detach(){var t;this._scroller&&(this._scroller.removeEventListener("scroll",this._onScroll),this._scroller=null),(t=this._ro)==null||t.disconnect(),this._ro=null}refresh(){const t=this._scroller;if(!t)return;const r=t.scrollHeight-t.clientHeight>8,i=r&&t.scrollTop>fa,o=r&&t.scrollHeight-t.scrollTop-t.clientHeight>fa;(i!==this.showTop||o!==this.showBottom)&&(this.showTop=i,this.showBottom=o,this.host.requestUpdate())}jumpTop(){const t=this._scroller;if(t){if(this._opts.onJumpTop){this._opts.onJumpTop(t);return}t.scrollTo({top:0,behavior:this._opts.behavior??"smooth"})}}jumpBottom(){const t=this._scroller;if(t){if(this._opts.onJumpBottom){this._opts.onJumpBottom(t);return}t.scrollTo({top:t.scrollHeight-t.clientHeight,behavior:this._opts.behavior??"smooth"})}}}const js=S`
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
`;function to(e){return!e.showTop&&!e.showBottom?null:a`
    <div class="scroll-jump-fabs">
      ${e.showTop?a`<button
            class="scroll-jump-fab"
            type="button"
            aria-label="跳转到第一行"
            title="跳转到第一行"
            @click=${()=>e.jumpTop()}
          ><doclens-icon name="arrow-up-to-line"></doclens-icon></button>`:null}
      ${e.showBottom?a`<button
            class="scroll-jump-fab"
            type="button"
            aria-label="跳转到最后一行"
            title="跳转到最后一行"
            @click=${()=>e.jumpBottom()}
          ><doclens-icon name="arrow-down-to-line"></doclens-icon></button>`:null}
    </div>
  `}var _p=Object.defineProperty,wp=Object.getOwnPropertyDescriptor,lt=(e,t,r,i)=>{for(var o=i>1?void 0:i?wp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&_p(t,r,o),o};let Jr="",hs=0,ro=0;function Xr(e){if(!e)return 0;const t=Jr.indexOf(e,hs);if(t===-1){const i=Jr.indexOf(e);return i===-1?0:(Jr.slice(0,i).match(/\n/g)??[]).length+1+ro}const r=(Jr.slice(0,t).match(/\n/g)??[]).length+1;return hs=t+e.length,r+ro}function ri(e){return e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}const yp=500;function ma(e){return e>0&&e<=yp?`${e}px`:null}const kp=/^[a-zA-Z][a-zA-Z0-9+.-]*:/;function $p(e,t){if(!e||!t||t.startsWith("/")||t.startsWith("#")||kp.test(t))return null;const r=t.match(/^([^?#]*)([?#].*)?$/),i=(r==null?void 0:r[1])??t,o=(r==null?void 0:r[2])??"";if(!i)return null;const s=e.split("/").slice(0,-1);for(const d of i.split("/"))if(!(d===""||d==="."))if(d===".."){if(s.length===0)return null;s.pop()}else s.push(d);return`/api/preview/raw?path=${s.map(encodeURIComponent).join("/")}${o}`}const vl={heading(e){const t=this.parser.parseInline(e.tokens),r=Xr(e.raw);return`<h${e.depth} data-source-line="${r}">${t}</h${e.depth}>
`},paragraph(e){const t=this.parser.parseInline(e.tokens);return`<p data-source-line="${Xr(e.raw)}">${t}</p>
`},code(e){const t=Xr(e.raw),r=ri(e.text),i=e.lang?` class="language-${ri(e.lang)}"`:"";return`<pre data-source-line="${t}"><button class="copy-btn" title="复制代码">复制</button><code${i}>${r}</code></pre>
`},list(e){const t=Xr(e.raw);let r="";for(const s of e.items)r+=this.listitem(s);const i=e.ordered?"ol":"ul",o=e.ordered&&e.start!==1?` start="${e.start}"`:"";return`<${i}${o} data-source-line="${t}">
${r}</${i}>
`},blockquote(e){const t=Xr(e.raw),r=this.parser.parse(e.tokens);return`<blockquote data-source-line="${t}">
${r}</blockquote>
`}};vl.image=function(e){const t=ri(e.href||""),r=e.title?` title="${ri(e.title)}"`:"",i=ri(e.text||""),o=i&&i!=="照片"?`<figcaption>${i}</figcaption>`:"";return`<figure><img src="${t}" alt="${i}"${r} loading="lazy">${o}</figure>
`};let ba=!1;function Sp(){ba||(ba=!0,N.use({hooks:{preprocess(e){return Jr=e,hs=0,e}},renderer:vl}))}let Be=class extends T{constructor(){super(...arguments),this.content="",this.line=null,this.keyword="",this.pages=null,this.docPath="",this._viewerSrc="",this._copied=!1,this.suppressLocate=!1,this._scrollJump=new Bs(this,{behavior:"smooth"}),this._copyAll=()=>{navigator.clipboard.writeText(this.content).then(()=>{this._copied=!0,setTimeout(()=>{this._copied=!1},1500)}).catch(()=>{})}}firstUpdated(){this._scrollJump.attach(this)}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("content")||e.has("keyword"))&&this._highlightKeyword(),(e.has("content")||e.has("pages")||e.has("docPath"))&&(this._resolveImageUrls(),this._applyIconSizing(),this._bindImageClicks(),this._bindCopyButtons()),(e.has("line")||e.has("content"))&&(this.suppressLocate||this._locateAndHighlight()),this._scrollJump.refresh()}_resolveImageUrls(){if(!this.docPath)return;this.shadowRoot.querySelectorAll("img").forEach(t=>{const r=t.getAttribute("src")??"",i=$p(this.docPath,r);i&&(t.src=i)})}_bindImageClicks(){this.shadowRoot.querySelectorAll("img").forEach(t=>{t.dataset.bound||(t.dataset.bound="true",t.style.cursor="zoom-in",t.addEventListener("click",()=>{this._viewerSrc=t.src}))})}_bindCopyButtons(){this.shadowRoot.querySelectorAll(".copy-btn").forEach(t=>{t.dataset.bound||(t.dataset.bound="true",t.addEventListener("click",()=>{var i;const r=(i=t.parentElement)==null?void 0:i.querySelector("code");r&&navigator.clipboard.writeText(r.textContent||"").then(()=>{t.textContent="已复制",setTimeout(()=>{t.textContent="复制"},1500)}).catch(()=>{})}))})}_dispWidthFromSrc(e){try{const t=new URL(e,window.location.href).searchParams.get("dw");if(!t)return null;const r=Number(t);return Number.isFinite(r)&&r>0?r:null}catch{return null}}_applyIconSizing(){this.shadowRoot.querySelectorAll("img").forEach(t=>{const r=this._dispWidthFromSrc(t.src);if(r!==null){const o=ma(r);o&&(t.style.width=o);return}const i=()=>{try{const o=ma(t.naturalWidth);o&&(t.style.width=o)}catch{}};t.complete&&t.naturalWidth>0?i():t.addEventListener("load",i,{once:!0})})}_findBlockAtLine(e){const t=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));return t.length===0?null:t.reduce((r,i)=>{const o=Number(i.getAttribute("data-source-line"));return o<=e&&(!r||o>Number(r.getAttribute("data-source-line")))?i:r},null)}topSourceLine(){const e=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));if(e.length===0)return 1;const t=this.getBoundingClientRect();for(const i of e)if(i.getBoundingClientRect().bottom>t.top+1)return Number(i.getAttribute("data-source-line"))||1;const r=e[e.length-1];return Number(r.getAttribute("data-source-line"))||1}scrollToSourceLine(e,t="auto"){const r=this._findBlockAtLine(e);if(!r)return;const i=this.getBoundingClientRect();if(i.height<=0)return;const o=r.getBoundingClientRect();this.scrollTo({top:o.top-i.top+this.scrollTop,behavior:t})}_locateAndHighlight(){if(this.line===null||this.line===void 0)return;const e=this._findBlockAtLine(this.line);e&&(this.scrollToSourceLine(this.line,"smooth"),e.classList.remove("highlight-flash"),e.offsetWidth,e.classList.add("highlight-flash"))}_highlightKeyword(){var n,d;const e=(n=this.shadowRoot)==null?void 0:n.querySelector(".md-body-paged, .md-body");if(!e)return;const t=(this.keyword??"").split(/\s+/).filter(c=>c.length>0);if(t.length===0)return;const r=new RegExp(t.map(c=>this._escapeRegExp(c)).join("|"),"gi"),i=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode(c){const f=c.parentElement;if(!f)return NodeFilter.FILTER_REJECT;const p=f.tagName;return p==="SCRIPT"||p==="STYLE"||p==="MARK"?NodeFilter.FILTER_REJECT:r.test(c.nodeValue??"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),o=[];let s;for(;s=i.nextNode();)o.push(s);for(const c of o){r.lastIndex=0;const f=c.nodeValue??"",p=document.createDocumentFragment();let _=0,$;for(;($=r.exec(f))!==null;){$.index>_&&p.appendChild(document.createTextNode(f.slice(_,$.index)));const O=document.createElement("mark");O.textContent=$[0],O.className="keyword-hit",p.appendChild(O),_=$.index+$[0].length,$[0].length===0&&r.lastIndex++}_<f.length&&p.appendChild(document.createTextNode(f.slice(_))),(d=c.parentNode)==null||d.replaceChild(p,c)}}_escapeRegExp(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}_splitByPages(e,t){const r=e.split(`
`),i=[];for(let o=0;o<t.length;o++){const s=t[o].line_start-1,n=o+1<t.length?t[o+1].line_start-1:r.length,d=r.slice(Math.max(0,s),Math.max(0,n)).join(`
`);i.push({label:t[o].label,md:d,offset:s})}return i}render(){if(Sp(),!this.content)return a`<div class="empty">无内容</div>`;if(this.pages&&this.pages.length>0){const t=this._splitByPages(this.content,this.pages);return a`
        <div class="md-body md-body-paged">
          <div class="copy-bar-top">${this._renderCopyBtn()}</div>
          ${t.map(r=>{ro=r.offset;const i=Qi(N.parse(r.md,{async:!1}));return a`
              <section class="page-card">
                <header class="page-card-header">${r.label}</header>
                <div .innerHTML=${i}></div>
              </section>
            `})}
        </div>
        <div class="scroll-jump-anchor">${to(this._scrollJump)}</div>
        ${this._viewerSrc?a`<image-viewer .src=${this._viewerSrc} @close=${()=>this._viewerSrc=""}></image-viewer>`:null}
      `}ro=0;const e=Qi(N.parse(this.content,{async:!1}));return a`
      <div class="md-body">
        <div class="copy-bar-top">${this._renderCopyBtn()}</div>
        <div .innerHTML=${e}></div>
      </div>
      <div class="scroll-jump-anchor">${to(this._scrollJump)}</div>
      ${this._viewerSrc?a`<image-viewer
        .src=${this._viewerSrc}
        @close=${()=>this._viewerSrc=""}></image-viewer>`:null}
    `}_renderCopyBtn(){return a`<button class="doc-copy" @click=${this._copyAll}>
      ${this._copied?"✓ 已复制":a`<doclens-icon name="copy" style="font-size:14px"></doclens-icon> 复制全文`}
    </button>`}};Be.styles=[js,S`
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
  `];lt([h()],Be.prototype,"content",2);lt([h({type:Number})],Be.prototype,"line",2);lt([h()],Be.prototype,"keyword",2);lt([h({attribute:!1})],Be.prototype,"pages",2);lt([h({attribute:"doc-path"})],Be.prototype,"docPath",2);lt([m()],Be.prototype,"_viewerSrc",2);lt([m()],Be.prototype,"_copied",2);lt([h({type:Boolean})],Be.prototype,"suppressLocate",2);Be=lt([P("md-viewer")],Be);var Ep=Object.defineProperty,Cp=Object.getOwnPropertyDescriptor,nr=(e,t,r,i)=>{for(var o=i>1?void 0:i?Cp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Ep(t,r,o),o};let st=class extends T{constructor(){super(...arguments),this.path="",this.originalContent="",this.mobile=!1,this._text="",this._dirty=!1,this._error=null,this._scrollJump=new Bs(this,{behavior:"auto",onJumpTop:e=>this._jumpToEdge(e,0),onJumpBottom:e=>{const t=e;this._jumpToEdge(t,t.value.length)}}),this._onSaveClick=()=>{this._dirty&&this._emitSave()},this._onCancelClick=()=>{this.discard()}}willUpdate(e){e.has("originalContent")&&(this._text=this.originalContent,this._dirty=!1,this._error=null)}firstUpdated(){const e=this.shadowRoot.querySelector("textarea");e&&this._scrollJump.attach(e)}updated(){this._scrollJump.refresh()}get _textarea(){return this.shadowRoot.querySelector("textarea")}_jumpToEdge(e,t){e.focus(),e.setSelectionRange(t,t),e.scrollTop=t===0?0:e.scrollHeight-e.clientHeight}get _lines(){return this._text.split(`
`)}_syncMirror(){const e=this._textarea,t=this.shadowRoot.querySelector(".mirror");if(!e||!t)return null;const r=getComputedStyle(e),i=e.clientWidth-parseFloat(r.paddingLeft)-parseFloat(r.paddingRight);return t.style.width=`${i}px`,t.style.fontFamily=r.fontFamily,t.style.fontSize=r.fontSize,t.style.lineHeight=r.lineHeight,t.style.letterSpacing=r.letterSpacing,t}_heightBeforeLine(e){if(e<=1)return 0;const t=this._syncMirror();if(!t)return 0;const r=this._lines;t.textContent=r.slice(0,Math.min(e-1,r.length)).join(`
`);const i=t.offsetHeight;return t.textContent="",i}topLine(){const e=this._textarea;if(!e)return 1;const t=e.scrollTop,r=this._lines.length;let i=1,o=r;for(;i<o;){const s=i+o+1>>1;this._heightBeforeLine(s)<=t?i=s:o=s-1}return i}scrollToLine(e){const t=this._textarea;t&&(t.scrollTop=this._heightBeforeLine(e))}_onInput(e){const t=e.target;this._text=t.value,this._error=null,this._updateDirty()}_onKeyDown(e){(e.ctrlKey||e.metaKey)&&e.key==="s"&&(e.preventDefault(),this._dirty&&this._emitSave())}_updateDirty(){const e=this._text!==this.originalContent;e!==this._dirty&&(this._dirty=e,this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:e}})))}_emitSave(){this.dispatchEvent(new CustomEvent("save",{detail:{content:this._text}}))}discard(){this._text=this.originalContent,this._dirty=!1,this._error=null,this._updateDirty(),this.dispatchEvent(new CustomEvent("cancel",{}))}setError(e){this._error=e}render(){return a`
      <div class="toolbar">
        ${this.mobile?null:a`<span class="path">${this.path}</span>`}
        ${this._error?a`<span class="error-msg"><doclens-icon name="alert-triangle"></doclens-icon> ${this._error}</span>`:this._dirty?a`<span class="dirty">●未保存</span>`:null}
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
        ${to(this._scrollJump)}
      </div>
    `}};st.styles=[js,S`
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
  `];nr([h()],st.prototype,"path",2);nr([h()],st.prototype,"originalContent",2);nr([h({type:Boolean})],st.prototype,"mobile",2);nr([m()],st.prototype,"_text",2);nr([m()],st.prototype,"_dirty",2);nr([m()],st.prototype,"_error",2);st=nr([P("md-editor")],st);class xl extends Error{constructor(t,r,i){super(r),this.code=t,this.status=i,this.name="PreviewSaveError"}}async function Tp(e,t){const r=await fetch(`/api/preview?path=${encodeURIComponent(e)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:t})});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new xl(i.code??"UNKNOWN",i.detail??"保存失败",r.status)}return r.json()}class _l extends Error{constructor(t,r,i){super(r),this.code=t,this.status=i,this.name="PreviewUploadError"}}async function Pp(e){const t=new FormData;t.append("file",e);const r=await fetch("/api/preview/upload",{method:"POST",body:t});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new _l(i.code??"UNKNOWN",i.detail??"上传失败",r.status)}return r.json()}const Ap=[".md",".pdf",".docx",".xlsx",".xlsm",".xltx",".xltm",".csv",".mhtml",".mht",".pst",".png",".jpg",".jpeg",".webp",".gif",".bmp",".tiff",".tif"];function Dp(e){const t=e.toLowerCase();return t.includes("#")&&t.split("#")[0].endsWith(".pst")?!0:Ap.some(r=>t.endsWith(r))}async function Sr(e){const t=new URLSearchParams({path:e});try{const r=await fetch(`/api/preview?${t}`);if(r.ok){const s=await r.json();return{ok:!0,path:s.path,content:s.content,language:s.language,writable:s.writable??!1,pages:s.pages??null,lineMap:s.line_map??null,attachments:s.attachments??null}}const i=await r.json().catch(()=>({code:"UNKNOWN",detail:""}));return{ok:!1,notIndexed:i.code==="NOT_INDEXED",message:i.detail||i.code||`HTTP ${r.status}`}}catch(r){return{ok:!1,notIndexed:!1,message:r.message||"网络错误"}}}async function Op(e,t=0,r=50){const i=new URLSearchParams({path:e,offset:String(t),limit:String(r)});try{const o=await fetch(`/api/pst/emails?${i}`);if(o.ok){const n=await o.json();return{ok:!0,path:n.path,total:n.total,offset:n.offset,limit:n.limit,emails:n.emails??[]}}const s=await o.json().catch(()=>({code:"UNKNOWN",detail:""}));return{ok:!1,notIndexed:s.code==="NOT_INDEXED",message:s.detail||s.code||`HTTP ${o.status}`}}catch(o){return{ok:!1,notIndexed:!1,message:o.message||"网络错误"}}}function St(e){return e.toLowerCase().endsWith(".pst")&&!e.includes("#")}function Qt(e){const t=e.toLowerCase();return t.includes("#")&&t.split("#")[0].endsWith(".pst")}var Ip=Object.defineProperty,zp=Object.getOwnPropertyDescriptor,re=(e,t,r,i)=>{for(var o=i>1?void 0:i?zp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Ip(t,r,o),o};let J=class extends T{constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1,this.line=null,this.keyword="",this.writable=!1,this.noHeader=!1,this.mobile=!1,this.pages=null,this.attachments=null,this.showBack=!1,this.backLabel="返回",this._mode="preview",this._content="",this._showMobileMenu=!1,this._anchorLine=1,this._suppressLocate=!1,this._skipRestoreOnce=!1,this._scrollJump=new Bs(this,{behavior:"smooth"}),this._onMobileBackClick=()=>{this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=e=>{e.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=e=>{var o,s;if(!this._showMobileMenu)return;const t=e.composedPath(),r=(o=this.shadowRoot)==null?void 0:o.querySelector(".mobile-menu"),i=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-more");r&&t.includes(r)||i&&t.includes(i)||(this._showMobileMenu=!1)},this._onEditorCancel=()=>{this._captureEditorAnchor(),this._mode="preview"},this._onEditorDirty=e=>{this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:e.detail.dirty}}))},this._onDownloadClick=()=>{if(!this.path)return;const e=`/api/preview/download?path=${encodeURIComponent(this.path)}`,t=document.createElement("a");t.href=e,t.rel="noopener",document.body.appendChild(t),t.click(),document.body.removeChild(t)},this._onUploadClick=()=>{var t;const e=(t=this.shadowRoot)==null?void 0:t.querySelector('input[type="file"]');e==null||e.click()}}willUpdate(e){e.has("content")&&(this._content=this.content,this._mode="preview",this._skipRestoreOnce=!0,this._suppressLocate=!1,this._anchorLine=1)}async updated(e){var i;(i=super.updated)==null||i.call(this,e);const t=this.shadowRoot.querySelector(".body");if(t?this._scrollJump.attach(t):this._scrollJump.detach(),!e.has("_mode"))return;if(this._mode==="edit"){const o=this.shadowRoot.querySelector("md-editor");o&&(await o.updateComplete,o.scrollToLine(this._anchorLine));return}if(this._skipRestoreOnce){this._skipRestoreOnce=!1;return}const r=this.shadowRoot.querySelector("md-viewer");r&&(await r.updateComplete,r.scrollToSourceLine(this._anchorLine,"auto")),this._suppressLocate=!1}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}_basename(e){if(!e)return"";const t=e.lastIndexOf("/");return t>=0?e.slice(t+1):e}get _isPst(){return Qt(this.path)||St(this.path)}_renderMobileHeader(){return a`
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
        ${this._showMobileMenu?a`
              <div class="mobile-menu" role="menu">
                ${this.writable?a`<button
                      type="button"
                      role="menuitem"
                      @click=${()=>{this._showMobileMenu=!1,this.enterEdit()}}
                    ><doclens-icon name="pencil"></doclens-icon>编辑</button>`:null}
                ${this._isPst?null:a`<button
                      type="button"
                      role="menuitem"
                      @click=${()=>{this._showMobileMenu=!1,this._onDownloadClick()}}
                    ><doclens-icon name="download"></doclens-icon>下载</button>
                <button
                  type="button"
                  role="menuitem"
                  @click=${()=>{this._showMobileMenu=!1,this._onUploadClick()}}
                ><doclens-icon name="upload"></doclens-icon>上传</button>`}
              </div>
            `:null}
      </div>
    `}enterEdit(){const e=this.shadowRoot.querySelector("md-viewer");e&&(this._anchorLine=e.topSourceLine()),this._mode="edit"}_captureEditorAnchor(){const e=this.shadowRoot.querySelector("md-editor");e&&(this._anchorLine=e.topLine()),this._suppressLocate=!0}async _onEditorSave(e){const t=this.shadowRoot.querySelector("md-editor");this._captureEditorAnchor();try{await Tp(this.path,e.detail.content),this._content=e.detail.content,this._mode="preview",this.dispatchEvent(new CustomEvent("saved",{detail:{content:e.detail.content}}))}catch(r){const i=r instanceof xl?`${r.code} ${r.message}`:r.message??"保存失败";t==null||t.setError(i),this.dispatchEvent(new CustomEvent("save-failed",{detail:{message:i}}))}}discard(){const e=this.shadowRoot.querySelector("md-editor");e==null||e.discard(),this._mode="preview"}_renderDownloadBtn(){return this._isPst?null:a`<button class="download-btn" @click=${this._onDownloadClick}><doclens-icon name="download"></doclens-icon>下载</button>`}_renderBackBtn(){return this.showBack?a`<button class="back-btn" @click=${this._onMobileBackClick}><doclens-icon name="arrow-left"></doclens-icon>${this.backLabel}</button>`:null}async _onFileChange(e){var o;const t=e.target,r=(o=t.files)==null?void 0:o[0];if(t.value="",!(!r||!window.confirm(`即将上传 '${r.name}' 覆盖原文件，是否继续？`)))try{const s=await Pp(r);this.dispatchEvent(new CustomEvent("upload-success",{detail:{path:s.path}}))}catch(s){const n=s instanceof _l?`${s.code} ${s.message}`:s.message??"上传失败";this.dispatchEvent(new CustomEvent("upload-failed",{detail:{message:n}}))}}_renderUploadBtn(){return this._isPst?null:a`<button class="upload-btn" @click=${this._onUploadClick}><doclens-icon name="upload"></doclens-icon>上传</button>`}_formatSize(e){return e>=1024*1024?`${(e/1024/1024).toFixed(1)} MB`:e>=1024?`${Math.round(e/1024)} KB`:`${e} B`}_renderAttachments(){return!this.attachments||this.attachments.length===0?null:a`
      <div class="attachments">
        <div class="attachments-title">附件（${this.attachments.length}）</div>
        ${this.attachments.map(e=>e.stored&&e.download_url?a`<a
                class="attachment"
                href=${e.download_url}
                title=${e.name}
              ><doclens-icon name="download"></doclens-icon>
                <span class="name">${e.name}</span>
                <span class="size">${this._formatSize(e.size)}</span>
              </a>`:a`<span class="attachment disabled" title=${e.name}>
                <span class="name">${e.name}</span>
                <span class="size">${this._formatSize(e.size)} · 未落盘</span>
              </span>`)}
      </div>
    `}render(){if(this.loading)return a`<div class="empty">加载中...</div>`;if(!this._content&&!this.content)return a`<div class="empty">点击左侧结果查看预览</div>`;const e=this.mobile?this._renderMobileHeader():null,t=!this.mobile&&!this.noHeader;if(this.language==="markdown"&&this._mode==="edit")return a`
        <input type="file" hidden @change=${this._onFileChange}>
        ${e}
        ${t?a`
          <div class="header">
            ${this._renderBackBtn()}
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
      `;if(this.language==="markdown")return a`
        <input type="file" hidden @change=${this._onFileChange}>
        ${e}
        ${t?a`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this.writable?a`<button class="edit-btn" @click=${()=>this.enterEdit()}><doclens-icon name="pencil"></doclens-icon>编辑</button>`:null}
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
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
      `;if(this.language==="html")return a`
        <input type="file" hidden @change=${this._onFileChange}>
        ${e}
        ${t?a`
          <div class="header">
            ${this._renderBackBtn()}
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
`);return a`
      <input type="file" hidden @change=${this._onFileChange}>
      ${e}
      ${t?a`
        <div class="header">
          ${this._renderBackBtn()}
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      `:null}
      <div class="body">
        ${r.map((i,o)=>{const s=o+1,n=this.highlights.includes(s)?"highlight":"";return a`<div class="line ${n}"><span class="line-no">${s}</span>${i}</div>`})}
        <div class="scroll-jump-anchor">${to(this._scrollJump)}</div>
      </div>
    `}};J.styles=[js,S`
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
  `];re([h()],J.prototype,"path",2);re([h()],J.prototype,"language",2);re([h()],J.prototype,"content",2);re([h({attribute:!1})],J.prototype,"highlights",2);re([h({type:Boolean})],J.prototype,"loading",2);re([h({type:Number})],J.prototype,"line",2);re([h()],J.prototype,"keyword",2);re([h({type:Boolean})],J.prototype,"writable",2);re([h({type:Boolean})],J.prototype,"noHeader",2);re([h({type:Boolean})],J.prototype,"mobile",2);re([h({attribute:!1})],J.prototype,"pages",2);re([h({attribute:!1})],J.prototype,"attachments",2);re([h({type:Boolean})],J.prototype,"showBack",2);re([h()],J.prototype,"backLabel",2);re([m()],J.prototype,"_mode",2);re([m()],J.prototype,"_content",2);re([m()],J.prototype,"_showMobileMenu",2);J=re([P("preview-pane")],J);var Rp=Object.defineProperty,Lp=Object.getOwnPropertyDescriptor,Or=(e,t,r,i)=>{for(var o=i>1?void 0:i?Lp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Rp(t,r,o),o};let Ct=class extends T{constructor(){super(...arguments),this.role="user",this.message=null,this.error=null,this.modelName=null,this._copied=!1,this._onHoverChange=e=>{this.classList.toggle("hovered",e.type==="mouseenter")},this._onClick=e=>{const t=e.composedPath().find(i=>i instanceof HTMLElement&&i.classList.contains("ref-link"));if(!t)return;e.preventDefault();const r=t.getAttribute("data-path")??"";this.dispatchEvent(new CustomEvent("reference-click",{detail:{path:r},bubbles:!0,composed:!0}))},this._emitReask=e=>{var r;e.stopPropagation();const t=((r=this.message)==null?void 0:r.content)??"";this.dispatchEvent(new CustomEvent("reask",{detail:{content:t},bubbles:!0,composed:!0}))},this._onCopy=async e=>{var r;e.stopPropagation();const t=((r=this.message)==null?void 0:r.content)??"";if(t)try{await navigator.clipboard.writeText(t),this._copied=!0,this._copyTimer!==void 0&&window.clearTimeout(this._copyTimer),this._copyTimer=window.setTimeout(()=>{this._copied=!1},1500)}catch{this.dispatchEvent(new CustomEvent("copy-failed",{bubbles:!0,composed:!0}))}}}firstUpdated(){this.addEventListener("click",this._onClick),this.addEventListener("mouseenter",this._onHoverChange),this.addEventListener("mouseleave",this._onHoverChange)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("click",this._onClick),this.removeEventListener("mouseenter",this._onHoverChange),this.removeEventListener("mouseleave",this._onHoverChange),this._copyTimer!==void 0&&window.clearTimeout(this._copyTimer)}renderBubble(e){if(e===""){const t=this.modelName?`${this.modelName} 思考中`:"思考中";return a`<span class="thinking">${t}...</span>`}if(this.role==="assistant"){const t=N.parse(e,{async:!1}),r=Qi(this.linkifyReferences(t));return a`<div class="md-body" .innerHTML=${r}></div>`}return e}linkifyReferences(e){const t=/(<h2[^>]*>\s*参考资料\s*<\/h2>)\s*(<(?:ol|ul)[^>]*>[\s\S]*?<\/(?:ol|ul)>)/i;return e.replace(t,(r,i,o)=>{const s=o.replace(/<li>([^<]+?)<\/li>/g,(n,d)=>{const c=d.trim();return`<li><a class="ref-link" data-path="${c.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}" href="#">${c}</a></li>`});return`${i}${s}`})}render(){if(!this.message)return null;const e=this.message.tool_steps,t=this.role==="assistant"&&e&&e.length>0;if(this.role==="user")return a`<div class="bubble">${this.renderBubble(this.message.content)}${this.error?a`<div class="error"><doclens-icon name="alert-triangle"></doclens-icon> ${this.error}</div>`:null}</div><button class="reask" type="button" aria-label="重问" title="重问" @click=${this._emitReask}><doclens-icon name="rotate-ccw"></doclens-icon></button>`;const r=!!this.message.content;return a`
      <div class="bubble">
        ${t?a`<chat-tool-trace .steps=${e}></chat-tool-trace><div class="trace-sep"></div>`:null}
        ${this.renderBubble(this.message.content)}
        ${this.error?a`<div class="error"><doclens-icon name="alert-triangle"></doclens-icon> ${this.error}</div>`:null}
      </div>
      ${r?a`<button class="copy" type="button" aria-label=${this._copied?"已复制":"复制"} title=${this._copied?"已复制":"复制"} @click=${this._onCopy}><doclens-icon name=${this._copied?"check":"copy"}></doclens-icon></button>`:null}
    `}};Ct.styles=S`
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
  `;Or([h({reflect:!0})],Ct.prototype,"role",2);Or([h({attribute:!1})],Ct.prototype,"message",2);Or([h()],Ct.prototype,"error",2);Or([h({attribute:!1})],Ct.prototype,"modelName",2);Or([m()],Ct.prototype,"_copied",2);Ct=Or([P("chat-message")],Ct);var Mp=Object.defineProperty,Np=Object.getOwnPropertyDescriptor,vi=(e,t,r,i)=>{for(var o=i>1?void 0:i?Np(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Mp(t,r,o),o};const Fp={search:"search",read_document:"file",grep:"search"},Bp={search:"正在搜索",read_document:"正在读取",grep:"正在检索"};function jp(e){const t=[`思考过程（${e.length} 步）`];return e.forEach((r,i)=>{t.push(""),t.push(`[${i+1}] ${r.name}`),Object.keys(r.input).length&&(t.push("参数："),t.push(JSON.stringify(r.input,null,2))),r.output!=null&&r.output!==""?(t.push("结果："),t.push(r.output)):t.push("结果：（无输出）")}),t.join(`
`)}let er=class extends T{constructor(){super(...arguments),this.steps=[],this._expanded=!1,this._fullResultIds=new Set,this._copied=!1}willUpdate(e){if(e.has("steps")){const r=(e.get("steps")??[]).some(o=>o.status==="running"),i=this.steps.some(o=>o.status==="running");!r&&i?this._expanded=!0:r&&!i&&(this._expanded=!1)}}_toggle(){this._expanded=!this._expanded}_toggleResult(e){const t=new Set(this._fullResultIds);t.has(e)?t.delete(e):t.add(e),this._fullResultIds=t}async _onCopy(e){e.stopPropagation();const t=jp(this.steps);try{await navigator.clipboard.writeText(t),this._copied=!0,setTimeout(()=>{this._copied=!1},2e3)}catch{try{const i=document.createElement("textarea");i.value=t,i.style.position="fixed",i.style.opacity="0",document.body.appendChild(i),i.select(),document.execCommand("copy"),document.body.removeChild(i),this._copied=!0,setTimeout(()=>{this._copied=!1},2e3)}catch(i){console.warn("copy failed:",i)}}}_renderArgs(e){return Object.entries(e).map(([t,r])=>`${t}: ${typeof r=="string"?r:JSON.stringify(r)}`).join(`
`)}_renderStep(e){const t=e.status==="running",r=e.status==="error",i=Fp[e.name]??"settings",o=this._fullResultIds.has(e.tool_use_id),s=(e.output??"").split(`
`),n=!o&&s.length>5,d=n?s.slice(0,5).join(`
`):e.output??"",c=e.output!=null&&e.output!=="";return a`
      <div class="step ${t?"running":""} ${r?"error":""}">
        <div class="head">
          ${t?a`<span class="spin"></span>`:a`<doclens-icon name=${i}></doclens-icon>`}
          <span class="name">${e.name}</span>
          ${t?a`<span class="running-text">${Bp[e.name]??"正在调用"}...</span>`:null}
          <span class="meta">
            ${t?null:r?a`<doclens-icon class="err" name="x"></doclens-icon>`:a`<doclens-icon class="ok" name="check"></doclens-icon>`}
            ${e.duration_ms!=null?a` ${Math.round(e.duration_ms)}ms`:null}
          </span>
        </div>
        ${Object.keys(e.input).length?a`<div class="arg">${this._renderArgs(e.input)}</div>`:null}
        ${c?a`<div class="res">${d}${n?a`<span class="more" @click=${()=>this._toggleResult(e.tool_use_id)}>展开全部 (${s.length} 行) ⌄</span>`:null}</div>`:t?null:a`<div class="arg">（无输出）</div>`}
      </div>
    `}render(){if(!this.steps.length)return null;const e=this.steps.some(t=>t.status==="running");return a`
      <div class="summary" @click=${this._toggle}>
        <doclens-icon class="arrow" name=${this._expanded?"chevron-down":"chevron-right"}></doclens-icon>
        <doclens-icon name="sparkles"></doclens-icon> 思考过程 · <span class="count">${this.steps.length} 步</span>
        ${e?" · 进行中":""}
        <button class="copy-btn ${this._copied?"copied":""}" @click=${this._onCopy} title=${this._copied?"已复制":"复制全文"}>${this._copied?a`<doclens-icon name="check"></doclens-icon> 已复制`:a`<doclens-icon name="copy"></doclens-icon>`}</button>
      </div>
      ${this._expanded?a`<div class="steps">${this.steps.map(t=>this._renderStep(t))}</div>`:null}
    `}};er.styles=S`
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
  `;vi([h({attribute:!1})],er.prototype,"steps",2);vi([m()],er.prototype,"_expanded",2);vi([m()],er.prototype,"_fullResultIds",2);vi([m()],er.prototype,"_copied",2);er=vi([P("chat-tool-trace")],er);var Hp=Object.defineProperty,Up=Object.getOwnPropertyDescriptor,Hs=(e,t,r,i)=>{for(var o=i>1?void 0:i?Up(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Hp(t,r,o),o};let li=class extends T{constructor(){super(...arguments),this.messages=[],this.modelName=null,this._scrollRafPending=!1}updated(){this._scrollRafPending||(this._scrollRafPending=!0,requestAnimationFrame(()=>{this._scrollRafPending=!1,this.scrollTop=this.scrollHeight}))}render(){return this.messages.length===0?a`<div class="empty">开始与 Doclens 对话</div>`:a`
      ${this.messages.map(e=>a`<chat-message role=${e.role} .message=${e} .modelName=${this.modelName}></chat-message>`)}
    `}};li.styles=S`
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
  `;Hs([h({attribute:!1})],li.prototype,"messages",2);Hs([h({attribute:!1})],li.prototype,"modelName",2);li=Hs([P("chat-stream")],li);async function ga(e){return F("/api/search",{method:"POST",json:e})}async function va(e){return F("/api/grep",{method:"POST",json:e})}async function Wp(e){return F("/api/sessions",{method:"POST",json:e})}async function Vp(e){return F("/api/sessions/find-or-create",{method:"POST",json:e})}async function wl(e){const t=new URLSearchParams;return e.type&&t.set("type",e.type),e.limit&&t.set("limit",String(e.limit)),e.offset&&t.set("offset",String(e.offset)),F(`/api/sessions?${t}`,{method:"GET"})}async function xa(e,t,r){return F(`/api/sessions/${e}`,{method:"PATCH",json:{items:t,message_count:r}})}async function yl(e){const t=new URLSearchParams;return e&&t.set("type",e),F(`/api/sessions?${t}`,{method:"DELETE"})}var qp=Object.defineProperty,Gp=Object.getOwnPropertyDescriptor,xi=(e,t,r,i)=>{for(var o=i>1?void 0:i?Gp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&qp(t,r,o),o};let tr=class extends T{constructor(){super(...arguments),this.total=0,this.offset=0,this.limit=20,this.disabled=!1}get currentPage(){return this.limit<=0?1:Math.floor(this.offset/this.limit)+1}get totalPages(){return this.limit<=0?1:Math.max(1,Math.ceil(this.total/this.limit))}_emitPage(e){this.disabled||e<1||e>this.totalPages||this.dispatchEvent(new CustomEvent("page-change",{detail:{page:e}}))}_pageSlots(){const e=this.totalPages,t=this.currentPage;if(e<=7)return Array.from({length:e},(s,n)=>n+1);const r=[1],i=Math.max(2,t-1),o=Math.min(e-1,t+1);i>2&&r.push("...");for(let s=i;s<=o;s++)r.push(s);return o<e-1&&r.push("..."),r.push(e),r}render(){if(this.total<=this.limit)return a``;const e=this._pageSlots();return a`
      <div class="meta">
        共 ${this.total} 条 · 第 ${this.currentPage}/${this.totalPages} 页
      </div>
      <div class="pages">
        <button
          ?disabled=${this.disabled||this.currentPage===1}
          @click=${()=>this._emitPage(this.currentPage-1)}
          aria-label="上一页">‹</button>
        ${e.map(t=>t==="..."?a`<span class="ellipsis">…</span>`:a`<button
                class=${t===this.currentPage?"current":""}
                ?disabled=${this.disabled}
                @click=${()=>this._emitPage(t)}>${t}</button>`)}
        <button
          ?disabled=${this.disabled||this.currentPage===this.totalPages}
          @click=${()=>this._emitPage(this.currentPage+1)}
          aria-label="下一页">›</button>
      </div>
    `}};tr.styles=S`
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
  `;xi([h({type:Number})],tr.prototype,"total",2);xi([h({type:Number})],tr.prototype,"offset",2);xi([h({type:Number})],tr.prototype,"limit",2);xi([h({type:Boolean})],tr.prototype,"disabled",2);tr=xi([P("pagination-bar")],tr);var Xp=Object.defineProperty,Yp=Object.getOwnPropertyDescriptor,Pt=(e,t,r,i)=>{for(var o=i>1?void 0:i?Yp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Xp(t,r,o),o};const _a=new Map;let Ze=class extends T{constructor(){super(...arguments),this.pstPath="",this.showBack=!1,this._emails=[],this._total=0,this._offset=0,this._loading=!1,this._error=null,this._limit=50,this._onPageChange=e=>{this._offset=(e.detail.page-1)*this._limit,_a.set(this.pstPath,this._offset),this._load()},this._onBackClick=()=>{this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}}willUpdate(e){e.has("pstPath")&&(this._offset=_a.get(this.pstPath)??0,this._load())}async _load(){if(!this.pstPath)return;this._loading=!0,this._error=null;const e=await Op(this.pstPath,this._offset,this._limit);e.ok&&e.path!==this.pstPath||(e.ok?(this._emails=e.emails,this._total=e.total):(this._emails=[],this._total=0,this._error=e.notIndexed?"该 PST 尚未索引，请先执行 doclens index。":e.message||"加载失败"),this._loading=!1)}_onRowClick(e){this.dispatchEvent(new CustomEvent("open-email",{detail:{path:`${this.pstPath}#${e.entry_id}`},bubbles:!0,composed:!0}))}_basename(e){const t=e.lastIndexOf("/");return t>=0?e.slice(t+1):e}render(){return this._loading&&this._emails.length===0?a`<div class="state">加载中...</div>`:this._error?a`<div class="state error">${this._error}</div>`:a`
      <div class="header">
        ${this.showBack?a`<button class="back-btn" @click=${this._onBackClick}><doclens-icon name="arrow-left"></doclens-icon>返回</button>`:null}
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
            ${this._emails.map(e=>a`
                <tr @click=${()=>this._onRowClick(e)}>
                  <td class="col-subject" title=${e.subject}>${e.subject}</td>
                  <td class="col-sender" title=${e.sender}>${e.sender}</td>
                  <td class="col-date" title=${e.date}>${e.date}</td>
                  <td class="col-folder" title=${e.folder}>${e.folder}</td>
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
    `}};Ze.styles=S`
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
  `;Pt([h()],Ze.prototype,"pstPath",2);Pt([h({type:Boolean})],Ze.prototype,"showBack",2);Pt([m()],Ze.prototype,"_emails",2);Pt([m()],Ze.prototype,"_total",2);Pt([m()],Ze.prototype,"_offset",2);Pt([m()],Ze.prototype,"_loading",2);Pt([m()],Ze.prototype,"_error",2);Ze=Pt([P("pst-email-list")],Ze);var Kp=Object.defineProperty,Zp=Object.getOwnPropertyDescriptor,kl=(e,t,r,i)=>{for(var o=i>1?void 0:i?Zp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Kp(t,r,o),o};let io=class extends T{constructor(){super(...arguments),this._toasts=[],this._nextId=1,this._timers=new Map}pushToast(e,t="info",r=2500){const i=this._nextId++;if(this._toasts=[...this._toasts,{id:i,message:e,level:t,duration:r}],r>0){const o=window.setTimeout(()=>this.dismiss(i),r);this._timers.set(i,o)}}dismiss(e){const t=this._timers.get(e);t!==void 0&&(window.clearTimeout(t),this._timers.delete(e)),this._toasts=this._toasts.filter(r=>r.id!==e)}disconnectedCallback(){super.disconnectedCallback();for(const e of this._timers.values())window.clearTimeout(e);this._timers.clear()}render(){return a`
      ${this._toasts.map(e=>a`
          <div class="toast ${e.level}" @click=${()=>this.dismiss(e.id)}>
            <span class="msg">${e.message}</span>
          </div>
        `)}
    `}};io.styles=S`
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
  `;kl([m()],io.prototype,"_toasts",2);io=kl([P("toast-stack")],io);var Jp=Object.defineProperty,Qp=Object.getOwnPropertyDescriptor,de=(e,t,r,i)=>{for(var o=i>1?void 0:i?Qp(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Jp(t,r,o),o};let z=class extends T{constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewLine=null,this.historySessions=[],this._clearing=!1,this.previewError=null,this.previewDirty=!1,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null,this._resultsPaneWidth=z.RESULTS_PANE_WIDTH_DEFAULT,this.searchMode="keyword",this._onModeChange=e=>{this.searchMode=e.detail.mode,localStorage.setItem(z.SEARCH_MODE_KEY,e.detail.mode)},this._onSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._resultsPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=s=>{const n=s.clientX-t,d=Math.max(z.RESULTS_PANE_WIDTH_MIN,Math.min(z.RESULTS_PANE_WIDTH_MAX,r+n));d!==this._resultsPaneWidth&&(this._resultsPaneWidth=d)},o=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",o),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(z.RESULTS_PANE_WIDTH_KEY,String(this._resultsPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",o)},this._onPageChange=e=>{this._goToPage(e.detail.page)},this._onPreviewDirty=e=>{this.previewDirty=e.detail.dirty},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=e=>{this._pushToast(`保存失败：${e.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=e=>{this.previewDirty=!1,this._pushToast(`已覆盖：${e.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._pushToast(`上传失败：${e.detail.message}`,"error",5e3)},this._onOpenPstEmail=async e=>{await this._safeAction(async()=>{const t={path:e.detail.path,snippet:"",score:0,line:null,highlights:[]};g.pushDetail(t),await this._fetchAndShowPreview(t)})},this._onBackToPstList=async()=>{Qt(this.previewPath)&&await this._safeAction(async()=>{g.popDetail(),await this._fetchAndShowPreview({path:this.previewPath.split("#")[0],snippet:"",score:0,line:null,highlights:[]})})}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._loadResultsPaneWidth(),this._loadSearchMode();const e=b.getState().pendingSession;e&&e.type==="search"&&(g.setPendingSession(null),this._loadSession(e))}_loadResultsPaneWidth(){const e=localStorage.getItem(z.RESULTS_PANE_WIDTH_KEY);if(!e)return;const t=Number(e);Number.isNaN(t)||(this._resultsPaneWidth=Math.max(z.RESULTS_PANE_WIDTH_MIN,Math.min(z.RESULTS_PANE_WIDTH_MAX,t)))}_loadSearchMode(){const e=localStorage.getItem(z.SEARCH_MODE_KEY);(e==="keyword"||e==="grep")&&(this.searchMode=e)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await wl({type:"search",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){await this._safeAction(async()=>{this._clearing=!0,this.requestUpdate();try{await yl("search"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}})}get viewState(){return b.getState().search}async _submit(e){await this._safeAction(async()=>{const t=typeof e=="string"?e:e.detail.value;this.localQuery=t,b.setState({detailStack:[]}),this.previewContent="",this.previewPath="",this.previewError=null,this.previewPages=null,this.previewAttachments=null,g.setSearchState({state:"focus",query:t,queryWords:[],results:[],total:0,offset:0,limit:20,source:"fts"}),this.loading=!0;try{const r=this.searchMode==="grep"?await va({pattern:t,offset:0,limit:20}):await ga({query:t,offset:0,limit:20});g.setSearchState({state:"focus",query:t,queryWords:r.query_words??[],results:r.results,total:r.total,offset:0,limit:20,source:r.source}),this._autoPreviewFirstDesktop(r.results),Vp({type:"search",title:t,preview:t.slice(0,100),mode:this.searchMode==="grep"?"grep":"keyword"}).then(i=>{g.setSearchState({currentSession:{id:i.id,type:"search",title:t,preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0}}),this._loadHistory()}).catch(i=>{console.warn("find-or-create session failed",i)})}catch(r){g.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}})}async _backToInitial(){await this._safeAction(()=>{g.setSearchState({state:"initial",currentSession:null,results:[],query:"",queryWords:[]}),this.localQuery="",this._loadHistory()})}async _goToPage(e){const t=b.getState().search;if(!t.query||t.state!=="focus")return;const r=t.limit||20,i=Math.max(0,(e-1)*r);if(i!==t.offset){this.loading=!0;try{const o=this.searchMode==="grep"?await va({pattern:t.query,offset:i,limit:r}):await ga({query:t.query,offset:i,limit:r});g.setSearchState({state:"focus",query:t.query,results:o.results,total:o.total,offset:o.offset,limit:r,source:o.source}),this.previewContent="",this.previewPath="",this.previewLine=null}catch(o){g.setError(`翻页失败: ${o.message}`)}finally{this.loading=!1}}}async _onResultSelect(e){await this._safeAction(async()=>{const t=e.detail.result;g.pushDetail(t),await this._fetchAndShowPreview(t)})}async _fetchAndShowPreview(e){if(this.previewError=null,St(e.path)){this.previewContent="",this.previewPath=e.path,this.previewLanguage="text",this.previewLine=null,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null;return}const t=e.line??null,r=Dp(e.path);let i;t&&!r?i=await this._fetchPreviewRange(e.path,t):i=await Sr(e.path),i.ok?(this.previewContent=i.content,this.previewPath=i.path,this.previewLanguage=i.language,this.previewLine=t===null?null:i.lineMap?i.lineMap[String(t)]??null:t,this.previewWritable=i.writable,this.previewPages=i.pages,this.previewAttachments=i.attachments):i.notIndexed&&(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=e.path,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null)}async _fetchPreviewRange(e,t){const r=new URLSearchParams({path:e});r.set("start_line",String(Math.max(1,t-10))),r.set("end_line",String(t+20));try{const i=await fetch(`/api/preview?${r}`);if(i.ok){const s=await i.json();return{ok:!0,path:s.path,content:s.content,language:s.language,writable:s.writable??!1,pages:s.pages??null,lineMap:null,attachments:null}}return{ok:!1,notIndexed:(await i.json().catch(()=>({}))).code==="NOT_INDEXED"}}catch{return{ok:!1,notIndexed:!1}}}_autoPreviewFirstDesktop(e){typeof window>"u"||window.innerWidth<1024||e.length!==0&&this._fetchAndShowPreview(e[0])}_discardPreviewEdits(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=e==null?void 0:e.discard)==null||r.call(e),this.previewDirty=!1}_enterPreviewEdit(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector(".detail-overlay preview-pane");(r=e==null?void 0:e.enterEdit)==null||r.call(e)}async _safeAction(e){if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await e()}async _reloadPreview(){if(!this.previewPath)return;const e=await Sr(this.previewPath);e.ok&&(this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages,this.previewAttachments=e.attachments)}_pushToast(e,t,r){var o;const i=(o=this.shadowRoot)==null?void 0:o.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_popDetail(){g.popDetail()}_renderNotIndexedHint(e){return a`<div class=${e?"desktop-only not-indexed-hint":"not-indexed-hint"}>
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}async _loadSession(e){this.searchMode=e.mode==="grep"?"grep":"keyword",localStorage.setItem(z.SEARCH_MODE_KEY,this.searchMode),await this._submit(e.title)}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){var i;const e=this.viewState;if(e.state==="initial")return a`
        <div class="initial-stack">
          <welcome-pane
            variant="onboarding"
            heroicon="search"
            heading="在你的文档中搜索"
            subheading="对当前工作目录{workdir} 的所有文件进行全文检索"
            .modes=${[{label:"自然语言",icon:"sparkles"},{label:"正则",icon:"regex"}]}
            .examples=${["「人工智能发展」","「量子 计算」","「tcp.*timeout」","「Python 装饰器」"]}
            .workdir=${((i=b.getState().status)==null?void 0:i.workdir)??""}
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
              .modes=${z.SEARCH_MODES}
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${o=>this.localQuery=o.detail.value}
              @mode-change=${this._onModeChange}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const t=b.getState().detailStack[b.getState().detailStack.length-1],r=this.loading?"搜索中":`${e.total} 条结果${e.source==="fts"?"":` (${e.source.toUpperCase()})`}`;return a`
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
            ${e.total>e.limit?a`<pagination-bar
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
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!0):St(this.previewPath)?a`<pst-email-list
                  class="desktop-only"
                  .pstPath=${this.previewPath}
                  @open-email=${this._onOpenPstEmail}>
                </pst-email-list>`:a`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${e.queryWords.length?e.queryWords.join(" "):e.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                .attachments=${this.previewAttachments}
                ?showBack=${Qt(this.previewPath)}
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
      ${t?a`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${t.path}
            .actions=${this.previewWritable?[{label:"编辑",icon:"pencil",onClick:()=>this._enterPreviewEdit()}]:[]}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!1):St(this.previewPath)?a`<pst-email-list
                  .pstPath=${this.previewPath}
                  @open-email=${this._onOpenPstEmail}>
                </pst-email-list>`:a`<preview-pane
                ?noHeader=${!0}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${e.queryWords.length?e.queryWords.join(" "):e.query}
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
    `}};z.RESULTS_PANE_WIDTH_KEY="cortex.resultsPaneWidth";z.RESULTS_PANE_WIDTH_DEFAULT=360;z.RESULTS_PANE_WIDTH_MIN=280;z.RESULTS_PANE_WIDTH_MAX=800;z.SEARCH_MODE_KEY="cortex.searchMode";z.SEARCH_MODES={keyword:{label:"搜索",description:"拆分关键词匹配"},grep:{label:"grep",description:"正则表达式匹配"}};z.styles=S`
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
  `;de([m()],z.prototype,"localQuery",2);de([m()],z.prototype,"loading",2);de([m()],z.prototype,"previewContent",2);de([m()],z.prototype,"previewPath",2);de([m()],z.prototype,"previewLanguage",2);de([m()],z.prototype,"previewLine",2);de([m()],z.prototype,"historySessions",2);de([m()],z.prototype,"_clearing",2);de([m()],z.prototype,"previewError",2);de([m()],z.prototype,"previewDirty",2);de([m()],z.prototype,"previewWritable",2);de([m()],z.prototype,"previewPages",2);de([m()],z.prototype,"previewAttachments",2);de([m()],z.prototype,"_resultsPaneWidth",2);de([m()],z.prototype,"searchMode",2);z=de([P("search-view")],z);async function*ef(e,t){for await(const r of Ps("/api/chat",e,t))if(r.event==="token")try{yield{type:"token",text:JSON.parse(r.data).text}}catch{}else if(r.event==="tool_call")try{const i=JSON.parse(r.data);yield{type:"tool_call",tool_use_id:i.tool_use_id,name:i.name,input:i.input??{}}}catch{}else if(r.event==="tool_result")try{const i=JSON.parse(r.data);yield{type:"tool_result",tool_use_id:i.tool_use_id,name:i.name,output:i.output??"",is_error:!!i.is_error,duration_ms:i.duration_ms}}catch{}else if(r.event==="references")try{yield{type:"references",items:JSON.parse(r.data).items??[]}}catch{}else if(r.event==="toast")try{const i=JSON.parse(r.data);yield{type:"toast",level:i.level??"error",detail:String(i.detail??"")}}catch{}else if(r.event==="done")yield{type:"done"};else if(r.event==="error")try{yield{type:"error",detail:JSON.parse(r.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}async function tf(e){try{await F("/api/chat/stop",{method:"POST",json:{session_id:e}})}catch{}}var rf=Object.defineProperty,of=Object.getOwnPropertyDescriptor,_e=(e,t,r,i)=>{for(var o=i>1?void 0:i?of(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&rf(t,r,o),o};function wa(e,t){if(e.length===0)return e;const r=e[e.length-1];if(r.role!=="assistant")return e;const i=e.slice(0,-1);if(t.type==="token")return[...i,{...r,content:r.content+t.text}];if(t.type==="tool_call"){const o={tool_use_id:t.tool_use_id,name:t.name,input:t.input,status:"running"};return[...i,{...r,tool_steps:[...r.tool_steps??[],o]}]}if(t.type==="tool_result"){const o=(r.tool_steps??[]).map(s=>s.tool_use_id===t.tool_use_id?{...s,output:t.output,is_error:t.is_error,duration_ms:t.duration_ms,status:t.is_error?"error":"done"}:s);return[...i,{...r,tool_steps:o}]}return t.type==="references"?[...i,{...r,references:t.items}]:e}function sf(e){return e.some(r=>r.role==="assistant"&&(r.tool_steps??[]).some(i=>i.status==="running"))?e.map(r=>r.role!=="assistant"||!r.tool_steps?r:{...r,tool_steps:r.tool_steps.map(i=>i.status==="running"?{...i,status:"error",is_error:!0,output:i.output??"（已中断）"}:i)}):e}function nf(e){const t=[];for(const r of e){let i;try{i=JSON.parse(r.payload)}catch{continue}if(r.kind==="message_user")t.push({role:"user",content:i.content??""});else if(r.kind==="message_ai"){const o=(i.tool_calls??[]).map(d=>({tool_use_id:d.tool_use_id??"",name:d.name??"",input:d.input??{},output:d.output,is_error:d.is_error,duration_ms:d.duration_ms,status:d.is_error?"error":"done"})),s=(i.references??[]).map(d=>({path:String((d==null?void 0:d.path)??"")})).filter(d=>d.path.length>0),n={role:"assistant",content:i.content??""};o.length&&(n.tool_steps=o),s.length&&(n.references=s),t.push(n)}}return t}let W=class extends T{constructor(){super(...arguments),this.draft="",this.historySessions=[],this._clearing=!1,this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewAttachments=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1,this._previewPaneWidth=W.PREVIEW_PANE_WIDTH_DEFAULT,this._abortController=null,this._onSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=s=>{const n=Math.max(W.PREVIEW_PANE_WIDTH_MIN,Math.min(W.PREVIEW_PANE_WIDTH_MAX,r-(s.clientX-t)));n!==this._previewPaneWidth&&(this._previewPaneWidth=n)},o=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",o),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(W.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",o)},this._onOpenPstEmail=async e=>{await this._safeAction(async()=>{await this._openPreviewPath(e.detail.path)})},this._onPreviewDirty=e=>{this.previewDirty=e.detail.dirty},this._closePreview=async()=>{await this._safeAction(()=>{this.previewOpen=!1})},this._onPreviewBack=async()=>{if(Qt(this.previewPath)){await this._safeAction(async()=>{await this._openPreviewPath(this.previewPath.split("#")[0])});return}await this._closePreview()},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=e=>{this._pushToast(`保存失败：${e.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=e=>{this.previewDirty=!1,this._pushToast(`已覆盖：${e.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._pushToast(`上传失败：${e.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._loadPreviewPaneWidth();const e=b.getState().pendingSession;e&&e.type==="chat"&&(g.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await wl({type:"chat",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await yl("chat"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return b.getState().chat}async _submit(e){this._resetPreview();const t=e.detail.value;if(this.draft="",this.viewState.state==="initial"){const s=await Wp({type:"chat",title:t.slice(0,60),preview:t.slice(0,100)});g.setChatState({state:"focus",currentSession:{id:s.id,type:"chat",title:t.slice(0,60),preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:t}],streaming:!0})}else g.setChatState({messages:[...this.viewState.messages,{role:"user",content:t}],streaming:!0});const r=b.getState().chat.currentSession.id,i={role:"assistant",content:""};let o=[...b.getState().chat.messages,i];g.setChatState({messages:o}),this._abortController=new AbortController;try{for await(const n of ef({message:t,session_id:r},this._abortController.signal))n.type==="error"?(o=wa(o,{type:"token",text:`

⚠️ ${n.detail}`}),g.setChatState({messages:o})):n.type==="toast"?this._pushToast(n.detail,n.level,5e3):n.type!=="done"&&(o=wa(o,n),g.setChatState({messages:o}));const s=o[o.length-1];await xa(r,[{kind:"message_user",payload:JSON.stringify({content:t})},{kind:"message_ai",payload:JSON.stringify({content:s.content,tool_calls:s.tool_steps??[],references:s.references??[]})}],o.length),this._loadHistory()}catch(s){this._isAbortError(s)?(o=this._dropTrailingAssistant(o),g.setChatState({messages:o}),await xa(r,[{kind:"message_user",payload:JSON.stringify({content:t})}],o.length),this._loadHistory()):(o=sf(o),g.setChatState({messages:o}),g.setError(`对话失败: ${s.message}`))}finally{this._abortController=null,g.setChatState({streaming:!1})}}async _stop(){var t,r;const e=(t=b.getState().chat.currentSession)==null?void 0:t.id;(r=this._abortController)==null||r.abort(),e&&tf(e)}_isAbortError(e){return!!e&&e.name==="AbortError"}_dropTrailingAssistant(e){return e.length&&e[e.length-1].role==="assistant"?e.slice(0,-1):e}_backToInitial(){this._resetPreview(),g.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}_resetPreview(){this.previewOpen=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewPages=null,this.previewAttachments=null,this.previewWritable=!1,this.previewError=null,this.previewDirty=!1}async _loadSession(e){this._resetPreview(),g.setChatState({state:"focus",currentSession:e,messages:[]});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const r=await t.json(),i=nf(r.items||[]);g.setChatState({messages:i})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}_loadPreviewPaneWidth(){const e=localStorage.getItem(W.PREVIEW_PANE_WIDTH_KEY);if(!e)return;const t=Number(e);Number.isNaN(t)||(this._previewPaneWidth=Math.max(W.PREVIEW_PANE_WIDTH_MIN,Math.min(W.PREVIEW_PANE_WIDTH_MAX,t)))}get _previewKeyword(){const e=b.getState().chat.messages;for(let t=e.length-1;t>=0;t--)if(e[t].role==="user")return e[t].content;return""}_normalizeReferencePath(e){let t=(e??"").trim();if(!t)return"";const r=t.match(/^\[.*?\]\((.*?)\)$/);r&&(t=r[1].trim()),t=t.replace(/^file:\/\/\/?/i,"");try{t=decodeURIComponent(t)}catch{}return t}async _onReferenceClick(e){await this._safeAction(async()=>{const t=this._normalizeReferencePath(e.detail.path);if(!t){this._pushToast("参考路径为空","error",5e3);return}await this._openPreviewPath(t)})}_onReask(e){var r,i;const t=((r=e.detail)==null?void 0:r.content)??"";if(t&&(this.draft=t,this.requestUpdate(),!this.viewState.streaming)){const o=this.renderRoot.querySelector("input-box");(i=o==null?void 0:o.focus)==null||i.call(o)}}async _openPreviewPath(e){if(this.previewError=null,St(e)){this.previewContent="",this.previewPath=e,this.previewLanguage="text",this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null,this.previewOpen=!0;return}const t=await Sr(e);t.ok?(this.previewContent=t.content,this.previewPath=t.path,this.previewLanguage=t.language,this.previewWritable=t.writable,this.previewPages=t.pages,this.previewAttachments=t.attachments,this.previewOpen=!0):t.notIndexed?(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=e,this.previewWritable=!1,this.previewPages=null,this.previewAttachments=null,this.previewOpen=!0):this._pushToast(`预览失败：${t.message}`,"error",5e3)}async _safeAction(e){var t,r;if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;const o=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=o==null?void 0:o.discard)==null||r.call(o),this.previewDirty=!1}await e()}async _reloadPreview(){if(!this.previewPath)return;const e=await Sr(this.previewPath);e.ok&&(this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable,this.previewPages=e.pages,this.previewAttachments=e.attachments)}_pushToast(e,t,r){var o;const i=(o=this.shadowRoot)==null?void 0:o.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_renderNotIndexedHint(){return a`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`}render(){var i,o,s;const e=this.viewState;if(e.state==="initial")return a`
        <div class="initial-stack">
          <welcome-pane
            variant="onboarding"
            heroicon="sparkles"
            heading="与你的知识库对话"
            subheading="用自然语言提问，AI 会自动检索当前工作目录{workdir} 的知识库并引用原文回答"
            .modes=${[{label:"自动检索",icon:"search"},{label:"引用原文",icon:"book-open"}]}
            .examples=${["总结上周写过的所有技术文档","找出所有提到 X 的段落并对比","这篇文章的核心观点是什么？"]}
            .workdir=${((i=b.getState().status)==null?void 0:i.workdir)??""}
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
              @input-change=${n=>this.draft=n.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const t=this.previewOpen,r=n=>St(this.previewPath)?a`<pst-email-list
          .pstPath=${this.previewPath}
          @open-email=${this._onOpenPstEmail}>
        </pst-email-list>`:a`<preview-pane
      ?noHeader=${n}
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .keyword=${this._previewKeyword}
      ?writable=${this.previewWritable}
      .pages=${this.previewPages}
      .attachments=${this.previewAttachments}
      ?showBack=${Qt(this.previewPath)}
      backLabel="邮件列表"
      @back=${this._onPreviewBack}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}>
    </preview-pane>`;return a`
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
            .modelName=${((s=b.getState().status)==null?void 0:s.model_name)??null}
            @reference-click=${this._onReferenceClick}
            @reask=${this._onReask}
            @copy-failed=${()=>this._pushToast("复制失败，请手动选择文本","error",5e3)}>
          </chat-stream>
          ${t?a`
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
            ?streaming=${e.streaming}
            .value=${this.draft}
            @input-change=${n=>this.draft=n.detail.value}
            @submit=${this._submit}
            @stop=${this._stop}>
          </input-box>
        </div>
      </div>
      ${t?a`
        <div class="preview-overlay">
          <focus-header
            back-label="返回"
            title=${this.previewPath}
            @back=${this._onPreviewBack}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint():r(!0)}
        </div>`:null}
    `}};W.PREVIEW_PANE_WIDTH_KEY="cortex.chatPreviewWidth";W.PREVIEW_PANE_WIDTH_DEFAULT=420;W.PREVIEW_PANE_WIDTH_MIN=300;W.PREVIEW_PANE_WIDTH_MAX=900;W.styles=S`
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
  `;_e([m()],W.prototype,"draft",2);_e([m()],W.prototype,"historySessions",2);_e([m()],W.prototype,"_clearing",2);_e([m()],W.prototype,"previewOpen",2);_e([m()],W.prototype,"previewContent",2);_e([m()],W.prototype,"previewPath",2);_e([m()],W.prototype,"previewLanguage",2);_e([m()],W.prototype,"previewPages",2);_e([m()],W.prototype,"previewAttachments",2);_e([m()],W.prototype,"previewWritable",2);_e([m()],W.prototype,"previewError",2);_e([m()],W.prototype,"previewDirty",2);_e([m()],W.prototype,"_previewPaneWidth",2);W=_e([P("chat-view")],W);const af={ai:"AI 配置",search:"搜索调优",network:"网络监听"},ya={CORTEX_WEB_HOST:"127.0.0.1",CORTEX_WEB_PORT:"7860",CORTEX_MCP_ENABLED:"false",CORTEX_MCP_HOST:"127.0.0.1",CORTEX_MCP_PORT:"7880",CORTEX_SYNC_ENABLED:"true"},Zo={CORTEX_WEB_HOST:"127.0.0.1",CORTEX_WEB_PORT:"7860",CORTEX_MCP_ENABLED:"false",CORTEX_MCP_HOST:"127.0.0.1",CORTEX_MCP_PORT:"7880"},lf=[{tab:"network",section:"监听地址",envVar:"CORTEX_WEB_HOST",label:"Web 监听地址",component:"text",effect:"restart",mono:!0,hint:"Web UI 绑定地址。0.0.0.0 暴露局域网（无鉴权，慎用）。改后需重启；若改了端口，重启后需用新地址重新打开。"},{tab:"network",section:"监听地址",envVar:"CORTEX_WEB_PORT",label:"Web 监听端口",component:"number",effect:"restart",min:1,max:65535,hint:"Web UI 端口（1–65535）。改后需重启，重启后用新端口重新打开。"},{tab:"network",section:"监听地址",envVar:"CORTEX_MCP_ENABLED",label:"启用 MCP server",component:"toggle",effect:"restart",hint:"关闭时不启动 MCP HTTP server（Claude Code 的 kb-ask 等经 MCP 接入的功能将不可用）。改后需重启。"},{tab:"network",section:"监听地址",envVar:"CORTEX_MCP_HOST",label:"MCP 监听地址",component:"text",effect:"restart",mono:!0,hint:"MCP server 绑定地址。非环回地址（如 0.0.0.0）需在 .env 配 CORTEX_MCP_TOKEN，否则 MCP 拒绝启动。"},{tab:"network",section:"监听地址",envVar:"CORTEX_MCP_PORT",label:"MCP 监听端口",component:"number",effect:"restart",min:1,max:65535,hint:"MCP server 端口（1–65535）。改后需重启。"},{tab:"network",section:"知识库 Git 同步",envVar:"CORTEX_SYNC_ENABLED",label:"启用 Git 同步",component:"switch",effect:"restart",hint:"工作目录为 git 根且已配置 remote 时，定期 auto-commit → pull → push。改后需重启。"}];class ci extends Error{constructor(t,r){super(`Config API error ${t}`),this.status=t,this.body=r}}async function cf(e){const t=await fetch(`/api/config?scope=${e}`,{method:"GET"}),r=await t.json().catch(()=>null);if(!t.ok)throw new ci(t.status,r);return r}async function df(e,t){const r=await fetch(`/api/config?scope=${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:t})}),i=await r.json().catch(()=>null);if(!r.ok)throw new ci(r.status,i);return i}async function hf(e){const t=await fetch(`/api/config/reset-default?scope=${e}`,{method:"POST"}),r=await t.json().catch(()=>null);if(!t.ok)throw new ci(t.status,r);return r}var uf=Object.defineProperty,pf=Object.getOwnPropertyDescriptor,tt=(e,t,r,i)=>{for(var o=i>1?void 0:i?pf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&uf(t,r,o),o};const Yr=6;let De=class extends T{constructor(){super(...arguments),this._hasPassword=null,this._required=!1,this._old="",this._next="",this._confirm="",this._clearPin="",this._error="",this._ok="",this._busy=!1}connectedCallback(){super.connectedCallback(),this._refresh()}async _refresh(){try{const e=await Ja();this._hasPassword=e.has_password,this._required=e.required,g.setAuthState({required:e.required,authenticated:e.authenticated,hasPassword:e.has_password})}catch{this._error="无法获取密码状态"}}_resetForms(){this._old="",this._next="",this._confirm="",this._clearPin=""}_valid(e){return new RegExp(`^[0-9]{${Yr}}$`).test(e)}async _run(e,t){if(!this._busy){this._busy=!0,this._error="",this._ok="";try{await e(),this._ok=t,this._resetForms(),await this._refresh()}catch(r){this._error=r instanceof Ke?r.message:"操作失败，请重试"}finally{this._busy=!1}}}_submitSet(){if(!this._valid(this._next)){this._error="密码必须是 6 位数字";return}if(this._next!==this._confirm){this._error="两次输入的新密码不一致";return}const e=this._hasPassword===!0;if(e&&!this._old){this._error="请输入旧密码";return}this._run(()=>Hd(e?this._old:null,this._next),e?"密码已修改，其他设备需重新登录":"密码已设置")}_submitClear(){if(!this._clearPin){this._error="请输入当前密码";return}this._run(()=>Ud(this._clearPin),"密码已清除，访问不再需要登录")}async _logout(){try{await Qa()}catch{}g.setAuthState({authenticated:!1}),qt.navigate("login")}render(){return this._hasPassword===null?k:a`
      <div class="section">
        <h2>
          🔒 访问密码
          ${this._hasPassword?a`<span class="badge">已设置</span>`:k}
        </h2>
        <p class="hint">
          仅当 GUI 绑定非环回地址（如 0.0.0.0 暴露局域网）时生效；本机 127.0.0.1 访问始终免登录。
          登录状态 24 小时内有效（使用中自动续期）。
        </p>
        ${this._hasPassword?k:a`<p class="warning">尚未设置访问密码——若将 Web UI 绑定到非环回地址，局域网内任何人都可访问。</p>`}

        ${this._hasPassword?a`
              <div class="row">
                <input type="password" inputmode="numeric" maxlength=${Yr}
                  placeholder="旧密码" .value=${this._old}
                  @input=${e=>this._old=e.target.value} />
              </div>
            `:k}
        <div class="row">
          <input type="password" inputmode="numeric" maxlength=${Yr}
            placeholder="新密码（6 位数字）" .value=${this._next}
            @input=${e=>this._next=e.target.value} />
          <input type="password" inputmode="numeric" maxlength=${Yr}
            placeholder="确认新密码" .value=${this._confirm}
            @input=${e=>this._confirm=e.target.value} />
          <button class="primary" ?disabled=${this._busy} @click=${this._submitSet}>
            ${this._hasPassword?"修改密码":"设置密码"}
          </button>
        </div>

        ${this._hasPassword?a`
              <div class="row">
                <input type="password" inputmode="numeric" maxlength=${Yr}
                  placeholder="当前密码" .value=${this._clearPin}
                  @input=${e=>this._clearPin=e.target.value} />
                <button class="danger" ?disabled=${this._busy} @click=${this._submitClear}>清除密码</button>
                ${this._required?a`<button ?disabled=${this._busy} @click=${this._logout}>退出登录</button>`:k}
              </div>
            `:k}

        <p class="feedback ${this._error?"error":"ok"}">${this._error||this._ok||k}</p>
      </div>
    `}};De.styles=S`
    :host { display: block; }
    .section {
      border-top: 1px solid var(--cortex-border-muted);
      margin-top: var(--cortex-space-4, 16px);
      padding-top: var(--cortex-space-4, 16px);
    }
    h2 {
      margin: 0 0 8px;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
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
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    input {
      width: 160px;
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
  `;tt([m()],De.prototype,"_hasPassword",2);tt([m()],De.prototype,"_required",2);tt([m()],De.prototype,"_old",2);tt([m()],De.prototype,"_next",2);tt([m()],De.prototype,"_confirm",2);tt([m()],De.prototype,"_clearPin",2);tt([m()],De.prototype,"_error",2);tt([m()],De.prototype,"_ok",2);tt([m()],De.prototype,"_busy",2);De=tt([P("password-section")],De);class Us extends Error{constructor(t,r){super(`Presets API error ${t}`),this.status=t,this.body=r,this.name="PresetsApiError"}}async function _i(e){const t=await e.json().catch(()=>null);if(!e.ok)throw new Us(e.status,t);return t}async function $l(e){const t=e?`?kind=${e}`:"";return(await _i(await fetch(`/api/presets${t}`))).presets}async function Sl(e){return _i(await fetch("/api/presets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)}))}async function El(e,t){return _i(await fetch(`/api/presets/${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)}))}async function Cl(e){await _i(await fetch(`/api/presets/${e}`,{method:"DELETE"}))}async function Tl(e){return _i(await fetch(`/api/presets/${e}/activate`,{method:"POST"}))}var ff=Object.defineProperty,mf=Object.getOwnPropertyDescriptor,Ue=(e,t,r,i)=>{for(var o=i>1?void 0:i?mf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&ff(t,r,o),o};function bf(e){return{name:"",kind:e,protocol:"openai_compat",base_url:"",model_id:"",api_key:"",context_window:""}}const gf=[{value:"openai_compat",label:"OpenAI 兼容"},{value:"anthropic",label:"Anthropic"}];let ye=class extends T{constructor(){super(...arguments),this.activeLlm="",this.activeVision="",this._presets=[],this._loading=!0,this._editing=null,this._busy=!1,this._error=null,this._toast=null,this._confirmDeleteId=null,this._formError=null}connectedCallback(){super.connectedCallback(),this._load()}disconnectedCallback(){this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),super.disconnectedCallback()}async _load(){this._error=null;try{this._presets=await $l()}catch(e){this._error=`加载预设失败: ${e.message}`}finally{this._loading=!1}}_byKind(e){return this._presets.filter(t=>t.kind===e)}_isActive(e){return(e.kind==="llm"?this.activeLlm:this.activeVision)===e.name}_setFlash(e){this._toast=e,this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=null},3e3)}_errMsg(e){if(e instanceof Us){const t=e.body;return(t==null?void 0:t.detail)??`HTTP ${e.status}`}return e.message}_openNew(e){this._formError=null,this._editing={mode:"new",kind:e,form:bf(e)}}_openEdit(e){this._formError=null,this._editing={mode:"edit",kind:e.kind,presetId:e.id,form:{name:e.name,kind:e.kind,protocol:e.protocol??"openai_compat",base_url:e.base_url??"",model_id:e.model_id??"",api_key:"",context_window:e.context_window?String(e.context_window):""}}}_cancelEdit(){this._editing=null,this._formError=null}_setField(e,t){this._editing&&(this._editing={...this._editing,form:{...this._editing.form,[e]:t}})}async _submit(){const e=this._editing;if(!e)return;const t=e.form;if(!t.name.trim()){this._formError="请填写预设名称";return}if(!t.base_url.trim()||!t.model_id.trim()){this._formError="base_url 与模型 ID 必填";return}this._busy=!0,this._formError=null;try{if(e.mode==="new"){const r={name:t.name.trim(),kind:t.kind,protocol:t.protocol,base_url:t.base_url.trim(),model_id:t.model_id.trim(),api_key:t.api_key,context_window:t.kind==="llm"&&t.context_window?Number(t.context_window):null};await Sl(r),this._setFlash(`已创建预设「${r.name}」`)}else if(e.presetId){const r=t.kind==="llm"&&t.context_window?Number(t.context_window):null,i={name:t.name.trim(),protocol:t.protocol,base_url:t.base_url.trim(),model_id:t.model_id.trim(),context_window:r};t.api_key&&(i.api_key=t.api_key),await El(e.presetId,i),this._setFlash(`已更新预设「${t.name.trim()}」`)}this._editing=null,await this._load()}catch(r){this._formError=this._errMsg(r)}finally{this._busy=!1}}async _activate(e){this._busy=!0,this._error=null;try{const t=await Tl(e.id);this._setFlash(t.note??`已切换到「${e.name}」`),this.dispatchEvent(new CustomEvent("presets-activated",{bubbles:!0,composed:!0}))}catch(t){this._error=`切换失败: ${this._errMsg(t)}`}finally{this._busy=!1}}async _delete(e){if(this._confirmDeleteId!==e.id){this._confirmDeleteId=e.id;return}this._busy=!0,this._error=null;try{await Cl(e.id),this._confirmDeleteId=null,this._setFlash(`已删除预设「${e.name}」`),await this._load()}catch(t){this._error=`删除失败: ${this._errMsg(t)}`}finally{this._busy=!1}}_renderForm(){const e=this._editing;if(!e)return k;const t=e.form,r=t.kind==="llm";return a`
      <div class="form">
        <div>
          <div class="field-label">名称</div>
          <input class="input" autocomplete="off" .value=${t.name} @input=${i=>this._setField("name",i.target.value)} />
        </div>
        <div>
          <div class="field-label">协议</div>
          <select class="select" .value=${t.protocol} @change=${i=>this._setField("protocol",i.target.value)}>
            ${gf.map(i=>a`<option value=${i.value} ?selected=${i.value===t.protocol}>${i.label}</option>`)}
          </select>
        </div>
        <div class="full">
          <div class="field-label">API Base URL</div>
          <input class="input mono" autocomplete="off" placeholder="https://..." .value=${t.base_url} @input=${i=>this._setField("base_url",i.target.value)} />
        </div>
        <div>
          <div class="field-label">模型 ID</div>
          <input class="input mono" autocomplete="off" .value=${t.model_id} @input=${i=>this._setField("model_id",i.target.value)} />
        </div>
        <div>
          <div class="field-label">API Key ${e.mode==="edit"?a`（留空=不改动）`:k}</div>
          <input class="input mono" type="password" autocomplete="new-password" placeholder=${e.mode==="edit"?"••••••":"可留空"} .value=${t.api_key} @input=${i=>this._setField("api_key",i.target.value)} />
        </div>
        ${r?a`
          <div>
            <div class="field-label">上下文窗口（tokens，留空用默认 200000）</div>
            <input class="input" type="number" min="1" autocomplete="off" .value=${t.context_window} @input=${i=>this._setField("context_window",i.target.value)} />
          </div>
        `:k}
        ${this._formError?a`<div class="form-error">${this._formError}</div>`:k}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._submit()}>
            ${this._busy?"保存中…":e.mode==="new"?"创建":"保存"}
          </button>
        </div>
      </div>
    `}_renderGroup(e,t){var i;const r=this._byKind(e);return a`
      <div class="group">
        <div class="group-title">
          ${t}
          <button class="icon-btn" @click=${()=>this._openNew(e)}>+ 新建</button>
        </div>
        ${r.length===0?a`<div class="empty">暂无预设，点「新建」创建一个。</div>`:a`<div class="preset-list">
              ${r.map(o=>this._renderRow(o))}
            </div>`}
        ${((i=this._editing)==null?void 0:i.kind)===e?this._renderForm():k}
      </div>
    `}_renderRow(e){const t=this._isActive(e),r=this._confirmDeleteId===e.id;return a`
      <div class="preset-row ${t?"active":""}">
        <div class="preset-main">
          <div class="preset-name">
            ${e.name}
            ${t?a`<span class="badge">当前</span>`:k}
          </div>
          <div class="preset-meta">${e.model_id||"（未设模型）"} · ${e.protocol}${e.kind==="llm"&&e.context_window?` · ${e.context_window}k`:""}</div>
        </div>
        <div class="row-actions">
          ${t?a`<button class="icon-btn" disabled>已激活</button>`:a`<button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._activate(e)}>切换</button>`}
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._openEdit(e)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${()=>this._delete(e)}>
            ${r?"确认删除":"删除"}
          </button>
        </div>
      </div>
    `}render(){return a`
      <div class="wrap">
        <div class="head">
          <h2>模型预设</h2>
          <span class="hint">命名后一键切换全部参数（含密钥）；切换即写入 .env 并即时生效。</span>
        </div>
        ${this._loading?a`<div class="empty">加载中…</div>`:a`${this._renderGroup("llm","LLM（AI 对话）")}${this._renderGroup("vision","视觉模型（图像解析）")}`}
        ${this._error?a`<div class="msg err">${this._error}</div>`:k}
        ${this._toast?a`<div class="msg ok">${this._toast}</div>`:k}
      </div>
    `}};ye.styles=S`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-5);
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
      margin-top: var(--cortex-space-4);
    }
    .group-title {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text-subtle);
      margin: 0 0 var(--cortex-space-2);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
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
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .preset-row.active {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
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
  `;Ue([h()],ye.prototype,"activeLlm",2);Ue([h()],ye.prototype,"activeVision",2);Ue([m()],ye.prototype,"_presets",2);Ue([m()],ye.prototype,"_loading",2);Ue([m()],ye.prototype,"_editing",2);Ue([m()],ye.prototype,"_busy",2);Ue([m()],ye.prototype,"_error",2);Ue([m()],ye.prototype,"_toast",2);Ue([m()],ye.prototype,"_confirmDeleteId",2);Ue([m()],ye.prototype,"_formError",2);ye=Ue([P("model-presets-section")],ye);var vf=Object.defineProperty,xf=Object.getOwnPropertyDescriptor,rt=(e,t,r,i)=>{for(var o=i>1?void 0:i?xf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&vf(t,r,o),o};function _f(){return{name:"",max_results:"50",min_score_threshold:"0.3",max_span:"50",weight_keyword_match:"4.0",weight_file_name_match:"2.0",weight_fts_score:"1.0",weight_title_match:"2.0",weight_proximity_match:"1.0"}}const Jo=[{key:"max_results",label:"最大结果数",hint:"search 工具最多返回多少篇文档",min:1,max:500,step:1},{key:"min_score_threshold",label:"评分阈值",hint:"低于该综合分的结果被过滤，0 = 不过滤",min:0,max:1,step:.05},{key:"max_span",label:"关键词集中度",hint:"邻近度统计的关键词最大字符跨度",min:1,max:100,step:1},{key:"weight_keyword_match",label:"关键词权重",hint:"命中的关键词越多排越前",min:0,max:10,step:.1},{key:"weight_file_name_match",label:"文件名权重",hint:"文件名含关键词的文档排更前",min:0,max:10,step:.1},{key:"weight_fts_score",label:"FTS 分权重",hint:"偏向传统 BM25 全文检索排序",min:0,max:10,step:.1},{key:"weight_title_match",label:"标题权重",hint:"小节标题含关键词排更前",min:0,max:10,step:.1},{key:"weight_proximity_match",label:"邻近度权重",hint:"关键词紧邻出现的文档排更前",min:0,max:10,step:.1}];let Oe=class extends T{constructor(){super(...arguments),this.activeSearch="",this._presets=[],this._loading=!0,this._editing=null,this._busy=!1,this._error=null,this._toast=null,this._confirmDeleteId=null,this._formError=null}connectedCallback(){super.connectedCallback(),this._load()}disconnectedCallback(){this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),super.disconnectedCallback()}async _load(){this._error=null;try{this._presets=await $l("search")}catch(e){this._error=`加载预设失败: ${e.message}`}finally{this._loading=!1}}_isActive(e){return this.activeSearch===e.name}_setFlash(e){this._toast=e,this._toastTimer!==void 0&&window.clearTimeout(this._toastTimer),this._toastTimer=window.setTimeout(()=>{this._toast=null},3e3)}_errMsg(e){if(e instanceof Us){const t=e.body;return(t==null?void 0:t.detail)??`HTTP ${e.status}`}return e.message}_openNew(){this._formError=null,this._editing={mode:"new",form:_f()}}_openEdit(e){this._formError=null,this._editing={mode:"edit",presetId:e.id,form:{name:e.name,max_results:e.max_results!=null?String(e.max_results):"",min_score_threshold:e.min_score_threshold!=null?String(e.min_score_threshold):"",max_span:e.max_span!=null?String(e.max_span):"",weight_keyword_match:e.weight_keyword_match!=null?String(e.weight_keyword_match):"",weight_file_name_match:e.weight_file_name_match!=null?String(e.weight_file_name_match):"",weight_fts_score:e.weight_fts_score!=null?String(e.weight_fts_score):"",weight_title_match:e.weight_title_match!=null?String(e.weight_title_match):"",weight_proximity_match:e.weight_proximity_match!=null?String(e.weight_proximity_match):""}}}_cancelEdit(){this._editing=null,this._formError=null}_setField(e,t){this._editing&&(this._editing={...this._editing,form:{...this._editing.form,[e]:t}})}_collect(e){const t={};for(const r of Jo){const i=e[r.key].trim();t[r.key]=i===""?null:Number(i)}return t}async _submit(){const e=this._editing;if(!e)return;const t=e.form;if(!t.name.trim()){this._formError="请填写预设名称";return}for(const r of Jo){const i=t[r.key].trim();if(i!==""&&Number.isNaN(Number(i))){this._formError=`${r.label} 不是有效数字`;return}}this._busy=!0,this._formError=null;try{const r=this._collect(t);e.mode==="new"?(await Sl({name:t.name.trim(),kind:"search",...r}),this._setFlash(`已创建预设「${t.name.trim()}」`)):e.presetId&&(await El(e.presetId,{name:t.name.trim(),...r}),this._setFlash(`已更新预设「${t.name.trim()}」`)),this._editing=null,await this._load()}catch(r){this._formError=this._errMsg(r)}finally{this._busy=!1}}async _activate(e){this._busy=!0,this._error=null;try{await Tl(e.id),this._setFlash(`已切换到「${e.name}」`),this.dispatchEvent(new CustomEvent("presets-activated",{bubbles:!0,composed:!0}))}catch(t){this._error=`切换失败: ${this._errMsg(t)}`}finally{this._busy=!1}}async _delete(e){if(this._confirmDeleteId!==e.id){this._confirmDeleteId=e.id;return}this._busy=!0,this._error=null;try{await Cl(e.id),this._confirmDeleteId=null,this._setFlash(`已删除预设「${e.name}」`),await this._load()}catch(t){this._error=`删除失败: ${this._errMsg(t)}`}finally{this._busy=!1}}_summary(e){return[`结果≤${e.max_results??"?"}`,`阈值${e.min_score_threshold??"?"}`,`权[${e.weight_keyword_match??"?"}/${e.weight_file_name_match??"?"}/${e.weight_fts_score??"?"}/${e.weight_title_match??"?"}/${e.weight_proximity_match??"?"}]`].join(" · ")}_renderForm(){const e=this._editing;if(!e)return k;const t=e.form;return a`
      <div class="form">
        <div class="full">
          <div class="field-label">名称</div>
          <input class="input" autocomplete="off" .value=${t.name} @input=${r=>this._setField("name",r.target.value)} />
        </div>
        ${Jo.map(r=>a`
          <div>
            <div class="field-label">${r.label} <span class="field-range">${r.min}–${r.max}</span></div>
            <input
              class="input"
              type="number"
              autocomplete="off"
              min=${r.min}
              max=${r.max}
              step=${r.step}
              .value=${t[r.key]}
              @input=${i=>this._setField(r.key,i.target.value)}
            />
            <div class="field-hint">${r.hint}</div>
          </div>
        `)}
        ${this._formError?a`<div class="form-error">${this._formError}</div>`:k}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._submit()}>
            ${this._busy?"保存中…":e.mode==="new"?"创建":"保存"}
          </button>
        </div>
      </div>
    `}_renderRow(e){const t=this._isActive(e),r=this._confirmDeleteId===e.id;return a`
      <div class="preset-row ${t?"active":""}">
        <div class="preset-main">
          <div class="preset-name">
            ${e.name}
            ${t?a`<span class="badge">当前</span>`:k}
          </div>
          <div class="preset-meta">${this._summary(e)}</div>
        </div>
        <div class="row-actions">
          ${t?a`<button class="icon-btn" disabled>已激活</button>`:a`<button class="icon-btn primary" ?disabled=${this._busy} @click=${()=>this._activate(e)}>切换</button>`}
          <button class="icon-btn" ?disabled=${this._busy} @click=${()=>this._openEdit(e)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${()=>this._delete(e)}>
            ${r?"确认删除":"删除"}
          </button>
        </div>
      </div>
    `}render(){return a`
      <div class="wrap">
        <div class="head">
          <h2>搜索预设</h2>
          <span class="hint">一键切换搜索调优参数（结果过滤 + 评分权重）；切换即时生效。</span>
        </div>
        ${this._loading?a`<div class="empty">加载中…</div>`:a`
            <div class="group">
              <div class="group-title">
                搜索调优
                <button class="icon-btn" @click=${()=>this._openNew()}>+ 新建</button>
              </div>
              ${this._presets.length===0?a`<div class="empty">暂无预设，点「新建」创建一个。</div>`:a`<div class="preset-list">${this._presets.map(e=>this._renderRow(e))}</div>`}
              ${this._editing?this._renderForm():k}
            </div>
          `}
        ${this._error?a`<div class="msg err">${this._error}</div>`:k}
        ${this._toast?a`<div class="msg ok">${this._toast}</div>`:k}
      </div>
    `}};Oe.styles=S`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-5);
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
    .group { margin-top: var(--cortex-space-3); }
    .group-title {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text-subtle);
      margin: 0 0 var(--cortex-space-2);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
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
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .preset-row.active {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
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
  `;rt([h()],Oe.prototype,"activeSearch",2);rt([m()],Oe.prototype,"_presets",2);rt([m()],Oe.prototype,"_loading",2);rt([m()],Oe.prototype,"_editing",2);rt([m()],Oe.prototype,"_busy",2);rt([m()],Oe.prototype,"_error",2);rt([m()],Oe.prototype,"_toast",2);rt([m()],Oe.prototype,"_confirmDeleteId",2);rt([m()],Oe.prototype,"_formError",2);Oe=rt([P("search-presets-section")],Oe);var wf=Object.defineProperty,yf=Object.getOwnPropertyDescriptor,it=(e,t,r,i)=>{for(var o=i>1?void 0:i?yf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&wf(t,r,o),o};const ka=["ai","search","network"],kf={ai:"sparkles",search:"search",network:"globe"},$f=a`
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
`,Sf=a`
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
`;let Ie=class extends T{constructor(){super(...arguments),this._activeTab="ai",this._saving=!1,this._error=null,this._toast=null,this._values={},this._original={},this._exists=!0,this._scope="global",this._fieldErrors={},this._loadGen=0,this._onRevertRequest=()=>{this._revert()}}connectedCallback(){super.connectedCallback();const e=b.getState();this._scope=e.settings.scope,this._unsubscribe=b.subscribe(()=>this._onStoreChange()),window.addEventListener("cortex:revert-settings",this._onRevertRequest),this._load()}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer!==void 0&&(window.clearTimeout(this._toastTimer),this._toastTimer=void 0),this._loadGen+=1,window.removeEventListener("cortex:revert-settings",this._onRevertRequest),super.disconnectedCallback()}_onStoreChange(){const e=b.getState();e.settings.scope!==this._scope&&(this._scope=e.settings.scope,this._load())}async _load(){const e=++this._loadGen;this._error=null;try{const t=await cf(this._scope);if(e!==this._loadGen||!this.isConnected)return;this._values={...t.values},this._original={...t.values},this._exists=t.exists,this._fieldErrors={},g.loadSettings(this._values,t.exists)}catch(t){if(e!==this._loadGen||!this.isConnected)return;this._error=`加载失败: ${t.message}`}}get _dirtyFields(){const e=new Set([...Object.keys(this._original),...Object.keys(this._values)]),t=[];for(const r of e)(this._original[r]??"")!==(this._values[r]??"")&&t.push(r);return t}get _dirty(){return this._dirtyFields.length>0}_updateValues(e){this._values={...this._values,...e};for(const[t,r]of Object.entries(e))g.updateSetting(t,r)}_onInput(e,t){this._updateValues({[e]:t})}_isMobile(){return typeof window.matchMedia=="function"&&window.matchMedia("(max-width: 1023px)").matches}_pushToast(e,t="info",r=2500){var o;const i=(o=this.shadowRoot)==null?void 0:o.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_extractFieldErrors(e){if(e instanceof ci){const t=e.body,r={};for(const i of(t==null?void 0:t.fields)??[])r[i.field]=i.error;return r}return{}}async _refreshSystemStatus(){try{const e=await Za();g.setStatus(e)}catch{}}_revert(){this._values={...this._original},g.revertSettings()}async _save(){var e;if(!(!this._dirty||this._saving)){this._saving=!0,this._error=null,this._fieldErrors={};try{const t=await df(this._scope,this._values);if(!this.isConnected)return;this._original={...this._values},g.loadSettings(this._values,!0),this._refreshSystemStatus();const r=t.needs_restart?"已保存。重启 doclens gui 后 AI 配置生效。":"已保存。下次查询立即生效。";this._isMobile()?this._pushToast(r,"success",4e3):this._toast=r}catch(t){let r;if(t instanceof ci){const i=t.body,o=(e=i==null?void 0:i.fields)==null?void 0:e.map(s=>s.field).join(", ");r=o?`保存失败（${o}）`:`保存失败 (HTTP ${t.status})`}else t instanceof Error?r=`保存失败: ${t.message}`:r="保存失败: 未知错误";this._isMobile()?(this._pushToast(r,"error",5e3),this._fieldErrors=this._extractFieldErrors(t)):this._error=r}finally{this._saving=!1}}}_renderField(e){const t=this._values[e.envVar]??"";return a`
      <div class="field">
        <div class="field-label">
          <div class="name">${e.label}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(e,t)}</div>
          ${this._fieldErrors[e.envVar]?a`<div class="field-error">${this._fieldErrors[e.envVar]}</div>`:k}
        </div>
        ${this._renderDesc(e)}
      </div>
    `}_renderDesc(e){if(e.tab!=="search"||!e.hint)return k;const t=e.hint.replace(/。$/,""),r=e.min!=null&&e.max!=null?` · ${e.min}–${e.max}`:"";return a`<div class="desc">${t}${r}</div>`}_allAtDefault(){return Object.entries(ya).every(([e,t])=>(this._values[e]??"")===t)}async _resetAll(){if(!this._saving){this._saving=!0,this._error=null;try{const e=await hf(this._scope);if(!this.isConnected)return;this._values={...e.values},this._original={...e.values},g.loadSettings(e.values,!0),this._refreshSystemStatus();const t="已恢复默认配置（保留你的 API Key）。";this._isMobile()?this._pushToast(t,"success",4e3):this._toast=t}catch{this._error="恢复默认失败，请检查 .env 是否可写。"}finally{this._saving=!1}}}_renderInput(e,t){const r=e.mono?"mono":"",i=o=>this._onInput(e.envVar,o.target.value);switch(e.component){case"text":return a`
          <input
            class="input ${r}"
            type="text"
            .value=${t}
            placeholder=${Zo[e.envVar]??k}
            data-env=${e.envVar}
            @input=${i}
            list=${e.datalist?`${e.envVar}-list`:k}
          />
          ${e.datalist?a`
            <datalist id=${`${e.envVar}-list`}>
              ${e.datalist.map(o=>a`<option value=${o}></option>`)}
            </datalist>
          `:k}
        `;case"password":return a`
          <div class="password-wrap">
            <input
              class="input ${r}"
              type="password"
              .value=${t}
              data-env=${e.envVar}
              @input=${i}
            />
            <button
              class="password-toggle"
              type="button"
              aria-label="显示密码"
              @click=${o=>{const s=o.currentTarget,n=s.previousElementSibling,d=s.classList.toggle("revealed");n.type=d?"text":"password",s.setAttribute("aria-label",d?"隐藏密码":"显示密码")}}
            >
              <span class="eye-show">${$f}</span>
              <span class="eye-hide">${Sf}</span>
            </button>
          </div>
        `;case"number":return a`
          <input
            class="input"
            type="number"
            .value=${t}
            placeholder=${Zo[e.envVar]??k}
            min=${e.min??k}
            max=${e.max??k}
            step=${e.step??k}
            data-env=${e.envVar}
            @input=${i}
          />
          ${e.unit?a`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${e.unit}</span>`:k}
        `;case"select":return a`
          <select class="select" .value=${t} data-env=${e.envVar} @change=${i}>
            ${(e.options??[]).map(o=>a`
              <option value=${o.value} ?selected=${o.value===t}>${o.label}</option>
            `)}
          </select>
        `;case"switch":{const o=t==="",s=o?(ya[e.envVar]??"true")==="true":t==="true",n=d=>this._onInput(e.envVar,d.target.checked?"true":"false");return a`
          <label class="switch">
            <input
              type="checkbox"
              .checked=${s}
              data-env=${e.envVar}
              @change=${n}
            />
            <span class="track"><span class="thumb"></span></span>
            <span class="switch-text">${s?"已启用":"已停用"}${o?"（默认）":""}</span>
          </label>
        `}case"slider":{const o=t==="",s=o?Zo[e.envVar]??String(e.min??0):t;return a`
          <div class="slider-row">
            <input
              class="input"
              type="number"
              .value=${s}
              min=${e.min??k}
              max=${e.max??k}
              step=${e.step??k}
              style="width: 100px;"
              data-env=${e.envVar}
              @input=${i}
            />
            <input
              type="range"
              min=${e.min??k}
              max=${e.max??k}
              step=${e.step??k}
              .value=${s}
              @input=${i}
            />
            <span class="value-chip ${o?"implicit":""}" data-role="value-chip">${s}</span>
          </div>
        `}case"toggle":return a`
          <label class="toggle">
            <input
              type="checkbox"
              ?checked=${t==="true"}
              data-env=${e.envVar}
              @change=${o=>this._onInput(e.envVar,o.target.checked?"true":"false")}
            />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label">${t==="true"?"开启":"关闭"}</span>
          </label>
        `;default:return k}}render(){const e="全局",t=this._exists?"":"（新建）";return a`
      <div class="layout">
        <aside class="sidebar">
          <nav class="tab-strip" role="tablist">
            ${ka.map(r=>a`
              <button
                class=${this._activeTab===r?"active":""}
                @click=${()=>{this._activeTab=r}}
              ><doclens-icon name=${kf[r]}></doclens-icon>${af[r]}</button>
            `)}
          </nav>
        </aside>
        <main class="main">
          <div class="scroll-area">
            ${ka.map(r=>{const i=lf.filter(s=>s.tab===r),o=[];for(const s of i){const n=s.section??"";let d=o.find(c=>c.title===n);d||(d={title:n,fields:[]},o.push(d)),d.fields.push(s)}return a`
                <div class="tab-panel ${this._activeTab===r?"active":""}" data-panel=${r}>
                  ${r==="ai"?a`
                    <model-presets-section
                      .activeLlm=${this._values.CORTEX_ACTIVE_LLM_PRESET??""}
                      .activeVision=${this._values.CORTEX_ACTIVE_VISION_PRESET??""}
                      @presets-activated=${()=>this._load()}
                    ></model-presets-section>
                  `:k}
                  ${r==="search"?a`
                    <search-presets-section
                      .activeSearch=${this._values.CORTEX_ACTIVE_SEARCH_PRESET??""}
                      @presets-activated=${()=>this._load()}
                    ></search-presets-section>
                  `:k}
                  ${o.map(s=>a`
                    <div class="section">
                      ${s.title?a`<h2>${s.title}</h2>`:k}
                      ${s.fields.map(n=>this._renderField(n))}
                    </div>
                  `)}
                  ${r==="network"?a`<password-section></password-section>`:k}
                </div>
              `})}
          </div>
          <div class="footer-bar">
            <div class="dirty-status">
              ${this._dirty?a`<span class="dirty-dot"></span><span class="dirty-text">有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`:a`<span class="dirty-text" style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`}
              ${this._error?a`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>`:k}
              ${this._toast?a`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>`:k}
            </div>
            <div class="footer-actions">
              <button class="btn reset-all" ?disabled=${this._allAtDefault()||this._saving} @click=${()=>this._resetAll()}>恢复默认</button>
              <button class="btn" ?disabled=${!this._dirty||this._saving} @click=${()=>this._revert()}>放弃修改</button>
              <button class="btn primary" ?disabled=${!this._dirty||this._saving} @click=${()=>this._save()}>
                ${this._saving?"保存中…":a`<doclens-icon name="save"></doclens-icon>保存${e}配置${t}`}
              </button>
            </div>
          </div>
        </main>
      </div>
      <toast-stack></toast-stack>
    `}};Ie.styles=S`
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
    .section h2 {
      margin: 0 0 var(--cortex-space-4);
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.015em;
      line-height: 1.3;
      padding-bottom: var(--cortex-space-2);
      border-bottom: 1px solid var(--cortex-border-muted);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
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
      padding: var(--cortex-space-3) 0;
      border-top: 1px solid var(--cortex-border-muted);
      align-items: center;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
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

      .field {
        grid-template-columns: 1fr;
        gap: var(--cortex-space-3);
        padding: var(--cortex-space-4) 0;
      }
      .field-label .name { font-size: var(--cortex-fs-md); }

      .scroll-area {
        padding: 0 var(--cortex-space-4) var(--cortex-space-6);
      }

      /* 移动端保留 footer（保存按钮唯一入口）：fixed 吸底，避开全局 tab-bar。
         不用 sticky —— .layout/.main 被 flex 压缩后盒子包不住内容，sticky 会失效。 */
      .footer-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: var(--cortex-tab-bar-height, 44px);
        z-index: 20;
        margin: 0;
        border-radius: 0;
        padding: var(--cortex-space-2) var(--cortex-space-3);
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
  `;it([m()],Ie.prototype,"_activeTab",2);it([m()],Ie.prototype,"_saving",2);it([m()],Ie.prototype,"_error",2);it([m()],Ie.prototype,"_toast",2);it([m()],Ie.prototype,"_values",2);it([m()],Ie.prototype,"_original",2);it([m()],Ie.prototype,"_exists",2);it([m()],Ie.prototype,"_scope",2);it([m()],Ie.prototype,"_fieldErrors",2);Ie=it([P("settings-view")],Ie);const mt=e=>`/api/files${e}`,xt={list:(e,t=200,r=0)=>F(mt(`/list?path=${encodeURIComponent(e)}&limit=${t}&offset=${r}`)),stats:e=>F(mt(`/stats?path=${encodeURIComponent(e)}`)),attrs:e=>F(mt(`/attrs?path=${encodeURIComponent(e)}`)),mkdir:e=>F(mt("/mkdir"),{method:"POST",json:{path:e}}),remove:e=>F(mt(`?path=${encodeURIComponent(e)}`),{method:"DELETE"}),move:(e,t,r=!1)=>F(mt("/move"),{method:"POST",json:{from_paths:e,dest_dir:t,overwrite:r}}),rename:(e,t)=>F(mt("/rename"),{method:"POST",json:{path:e,new_name:t}}),upload:(e,t,r=!1)=>{const i=new FormData;return i.append("file",e),i.append("dest_dir",t),i.append("overwrite",String(r)),F(mt("/upload"),{method:"POST",body:i})}};var Ef=Object.defineProperty,Cf=Object.getOwnPropertyDescriptor,At=(e,t,r,i)=>{for(var o=i>1?void 0:i?Cf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Ef(t,r,o),o};let Je=class extends T{constructor(){super(...arguments),this.depth=0,this.expanded=!1,this.selected=!1,this.readonly=!1,this.childEntries=[],this.loading=""}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}_onClick(){this.readonly?this.dispatchEvent(new CustomEvent("pick-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0})):this.dispatchEvent(new CustomEvent("select-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}_toggle(e){e.stopPropagation(),this.entry.has_child_dirs&&this.dispatchEvent(new CustomEvent("toggle",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}render(){const{treeCache:e,expandedPaths:t,currentDir:r}=b.getState().files,i=new Set(t);return a`
      <div class="row ${this.selected?"selected":""}" @click=${this._onClick}>
        <span
          class="arrow ${this.expanded?"expanded":""} ${this.entry.has_child_dirs?"":"leaf"}"
          @click=${this._toggle}><doclens-icon name="chevron-right"></doclens-icon></span>
        <doclens-icon class="icon" name=${this.entry.is_dir?"folder":"file"}></doclens-icon>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded&&this.entry.is_dir?a`
        <div class="children">
          ${this.loading&&this.loading===this.entry.path?a`<div style="padding: 4px 8px; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm);">加载中…</div>`:this.childEntries.filter(o=>o.is_dir).map(o=>a`
              <tree-node
                .entry=${o}
                .depth=${this.depth+1}
                .expanded=${i.has(o.path)}
                .selected=${o.path===r}
                .childEntries=${e[o.path]||[]}
                .readonly=${this.readonly}
                @select-dir=${s=>this._relay("select-dir",s)}
                @toggle=${s=>this._relay("toggle",s)}
                @pick-dir=${s=>this._relay("pick-dir",s)}
              ></tree-node>
            `)}
        </div>
      `:""}
    `}_relay(e,t){t.stopPropagation();const r=t.detail;this.dispatchEvent(new CustomEvent(e,{detail:r,bubbles:!0,composed:!0}))}};Je.styles=S`
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
  `;At([h({type:Object})],Je.prototype,"entry",2);At([h({type:Number})],Je.prototype,"depth",2);At([h({type:Boolean})],Je.prototype,"expanded",2);At([h({type:Boolean})],Je.prototype,"selected",2);At([h({type:Boolean})],Je.prototype,"readonly",2);At([h({type:Array})],Je.prototype,"childEntries",2);At([h({type:String})],Je.prototype,"loading",2);Je=At([P("tree-node")],Je);var Tf=Object.getOwnPropertyDescriptor,Pf=(e,t,r,i)=>{for(var o=i>1?void 0:i?Tf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=n(o)||o);return o};let us=class extends T{constructor(){super(...arguments),this._onToggle=async e=>{const t=e.detail.path,{expandedPaths:r}=b.getState().files;r.includes(t)?g.collapseDir(t):(await this._ensureLoaded(t),g.expandDir(t))},this._onSelectDir=async e=>{g.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path),g.expandDir(e.detail.path)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),g.expandDir("")}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}async _ensureLoaded(e){const{treeCache:t}=b.getState().files;if(!(e in t))try{g.setFilesState({listing:!0});const r=await xt.list(e);g.setFilesState({treeCache:{...b.getState().files.treeCache,[e]:r.entries},listing:!1})}catch(r){g.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"})}}render(){var c;const{treeCache:e,expandedPaths:t,currentDir:r}=b.getState().files,i=e[""]||[],o=new Set(t),s=(c=b.getState().status)==null?void 0:c.workdir,d={name:(s==null?void 0:s.replace(/[\\/]+/g,"/").split("/").filter(Boolean).pop())||"根目录",path:"",is_dir:!0,has_child_dirs:i.some(f=>f.is_dir),size:0,modified_at:"",indexed:!1,writable:!1};return a`
      <div class="header">文件</div>
      <tree-node
        .entry=${d}
        .depth=${0}
        .expanded=${o.has("")}
        .selected=${r===""}
        .childEntries=${i}
        .loading=""
        @toggle=${this._onToggle}
        @select-dir=${this._onSelectDir}
      ></tree-node>
    `}};us.styles=S`
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
  `;us=Pf([P("file-tree")],us);const Af={pdf:{letter:"P",bg:"#E41E3F",fg:"#FFFFFF"},doc:{letter:"D",bg:"#0064E0",fg:"#FFFFFF"},docx:{letter:"D",bg:"#0064E0",fg:"#FFFFFF"},xls:{letter:"X",bg:"#31A24C",fg:"#FFFFFF"},xlsx:{letter:"X",bg:"#31A24C",fg:"#FFFFFF"},csv:{letter:"C",bg:"#31A24C",fg:"#FFFFFF"},ppt:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},pptx:{letter:"S",bg:"#EA580C",fg:"#FFFFFF"},md:{letter:"M",bg:"#A121CE",fg:"#FFFFFF"},txt:{letter:"T",bg:"#5D6C7B",fg:"#FFFFFF"},html:{letter:"H",bg:"#E34F26",fg:"#FFFFFF"},mhtml:{letter:"W",bg:"#0D9488",fg:"#FFFFFF"},mht:{letter:"W",bg:"#0D9488",fg:"#FFFFFF"},png:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},jpg:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},jpeg:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},webp:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},gif:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},bmp:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},tiff:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"},tif:{letter:"I",bg:"#7C3AED",fg:"#FFFFFF"}};function Pl(e){if(!e)return"";const t=e.lastIndexOf(".");return t<=0||t===e.length-1?"":e.slice(t+1).toLowerCase()}function Df(e,t){if(t)return null;const r=Pl(e);return Af[r]??null}function Of(e){return e.is_dir?"文件夹":Pl(e.name)}var If=Object.defineProperty,zf=Object.getOwnPropertyDescriptor,po=(e,t,r,i)=>{for(var o=i>1?void 0:i?zf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&If(t,r,o),o};let Er=class extends T{constructor(){super(...arguments),this.selected=!1,this.active=!1}_fmtSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}_fmtTime(e){if(!e)return"";try{return new Date(e).toLocaleString(void 0,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return""}}_onRowClick(){this.dispatchEvent(new CustomEvent("activated",{detail:{path:this.entry.path,is_dir:this.entry.is_dir},bubbles:!0,composed:!0}))}_onCheckboxClick(e){e.stopPropagation(),this.dispatchEvent(new CustomEvent("checked",{detail:{path:this.entry.path,ctrl:e.ctrlKey||e.metaKey,shift:e.shiftKey},bubbles:!0,composed:!0}))}render(){const e=Df(this.entry.name,this.entry.is_dir);return a`
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
          ${this.entry.is_dir?a`<doclens-icon name="folder"></doclens-icon>`:e?a`<span class="type-badge"
                  style="background:${e.bg};color:${e.fg}">${e.letter}</span>`:a`<doclens-icon name="file"></doclens-icon>`}
        </span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.is_dir?"":this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
        <span class="cell-indexed">${!this.entry.is_dir&&this.entry.indexed?a`<span class="badge">已索引</span>`:""}</span>
        <span class="cell-type">${Of(this.entry)}</span>
      </div>
    `}};Er.styles=S`
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
    .cell-icon { font-size: 16px; }
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
  `;po([h({type:Object})],Er.prototype,"entry",2);po([h({type:Boolean})],Er.prototype,"selected",2);po([h({type:Boolean})],Er.prototype,"active",2);Er=po([P("file-row")],Er);var Rf=Object.defineProperty,Lf=Object.getOwnPropertyDescriptor,wi=(e,t,r,i)=>{for(var o=i>1?void 0:i?Lf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Rf(t,r,o),o};const Al=[28,28,240,80,140,70,80],$a=[20,20,80,50,80,50,50],Sa=[60,60,800,200,300,150,200],Ea=Al.length,Ca="cortex.files.colWidths";let rr=class extends T{constructor(){super(...arguments),this.activePath="",this.mobile=!1,this._colWidths=[...Al],this._showMobileMenu=!1,this._makeColResizeHandler=e=>t=>{t.preventDefault(),t.stopPropagation();const r=t.clientX,i=this._colWidths[e];document.body.style.cursor="col-resize",document.body.style.userSelect="none";const o=n=>{const d=n.clientX-r,c=Math.max($a[e],Math.min(Sa[e],i+d)),f=[...this._colWidths];f[e]=c,this._colWidths=f},s=()=>{document.removeEventListener("mousemove",o),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(Ca,JSON.stringify(this._colWidths))};document.addEventListener("mousemove",o),document.addEventListener("mouseup",s)},this._onMobileBackClick=()=>{this._showMobileMenu=!1,this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))},this._onMobileMoreClick=e=>{e.stopPropagation(),this._showMobileMenu=!this._showMobileMenu},this._onDocClick=e=>{var o,s;if(!this._showMobileMenu)return;const t=e.composedPath(),r=(o=this.shadowRoot)==null?void 0:o.querySelector(".mobile-menu"),i=(s=this.shadowRoot)==null?void 0:s.querySelector(".mobile-more");r&&t.includes(r)||i&&t.includes(i)||(this._showMobileMenu=!1)},this._onMenuItemClick=e=>t=>{t.stopPropagation(),this._showMobileMenu=!1,this._action(e)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._loadColWidths(),document.addEventListener("click",this._onDocClick,!0)}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),document.removeEventListener("click",this._onDocClick,!0),super.disconnectedCallback()}willUpdate(){for(let e=0;e<Ea;e++)this.style.setProperty(`--col-${e+1}`,`${this._colWidths[e]}px`)}_loadColWidths(){const e=localStorage.getItem(Ca);if(e)try{const t=JSON.parse(e);Array.isArray(t)&&t.length===Ea&&t.every(r=>typeof r=="number"&&Number.isFinite(r))&&(this._colWidths=t.map((r,i)=>Math.max($a[i],Math.min(Sa[i],r))))}catch{}}_action(e){this.dispatchEvent(new CustomEvent("action",{detail:{name:e},bubbles:!0,composed:!0}))}_onRowChecked(e){const{path:t,shift:r}=e.detail;g.selectEntry(t,{ctrl:!r,shift:r})}_onSelectAll(e){const t=e.target,{currentDir:r,treeCache:i,selectedPaths:o}=b.getState().files,s=i[r]||[];if(t.checked){const n=s.map(c=>c.path),d=Array.from(new Set([...o,...n]));g.setFilesState({selectedPaths:d})}else{const n=new Set(s.map(d=>d.path));g.setFilesState({selectedPaths:o.filter(d=>!n.has(d))})}}_goUp(){const{currentDir:e}=b.getState().files;if(e==="")return;const t=e.includes("/")?e.slice(0,e.lastIndexOf("/")):"";g.selectDir(t)}_renderMobileHeader(){const{currentDir:e,selectedPaths:t}=b.getState().files,r=t.length===1,i=t.length>=1,o=e===""?"/":`/${e}/`;return a`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="mobile-path" title=${o}>${o}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        ><doclens-icon name="more-horizontal"></doclens-icon></button>
        ${this._showMobileMenu?a`
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
                  data-action="delete"
                  ?disabled=${!i}
                  class="danger"
                  @click=${this._onMenuItemClick("delete")}
                ><doclens-icon name="trash-2"></doclens-icon>删除</button>
              </div>
            `:null}
      </div>
    `}render(){const{currentDir:e,treeCache:t,selectedPaths:r}=b.getState().files,i=t[e]||[],o=new Set(r),s=r.length===1,n=r.length>=1,d=e!=="",c=e===""?"/":`/${e}/`,f=i.length>0&&i.every(p=>o.has(p.path));return this.mobile?a`
        ${this._renderMobileHeader()}
        ${i.length===0?a`<div class="empty">目录为空</div>`:a`<div class="header-row">
              <span class="select-all">
                <input
                  type="checkbox"
                  .checked=${f}
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
          ${i.map(p=>a`
            <file-row
              .entry=${p}
              .selected=${o.has(p.path)}
              .active=${p.path===this.activePath}
              @checked=${this._onRowChecked}
            ></file-row>`)}
        </div>
      `:a`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!d}
          @click=${this._goUp}
        ><doclens-icon name="arrow-up"></doclens-icon></button>
        <span class="path">${c}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${()=>this._action("mkdir")}><doclens-icon name="folder-plus"></doclens-icon>新目录</button>
        <button data-action="upload" @click=${()=>this._action("upload")}><doclens-icon name="upload"></doclens-icon>上传</button>
        <button data-action="rename" ?disabled=${!s} @click=${()=>this._action("rename")}><doclens-icon name="pencil"></doclens-icon>重命名</button>
        <button data-action="move" ?disabled=${!n} @click=${()=>this._action("move")}><doclens-icon name="arrow-right"></doclens-icon>移动</button>
        <button data-action="delete" ?disabled=${!n} class="danger" @click=${()=>this._action("delete")}><doclens-icon name="trash-2"></doclens-icon>删除</button>
      </div>
      ${i.length===0?a`<div class="empty">目录为空</div>`:a`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                .checked=${f}
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
        ${i.map(p=>a`
          <file-row
            .entry=${p}
            .selected=${o.has(p.path)}
            .active=${p.path===this.activePath}
            @checked=${this._onRowChecked}
          ></file-row>`)}
      </div>
    `}};rr.styles=S`
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
      padding: 6px 12px;
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
  `;wi([h()],rr.prototype,"activePath",2);wi([h({type:Boolean})],rr.prototype,"mobile",2);wi([m()],rr.prototype,"_colWidths",2);wi([m()],rr.prototype,"_showMobileMenu",2);rr=wi([P("file-list")],rr);var Mf=Object.defineProperty,Nf=Object.getOwnPropertyDescriptor,Ws=(e,t,r,i)=>{for(var o=i>1?void 0:i?Nf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Mf(t,r,o),o};const Ff=/[\\/:*?"<>|]/,Bf=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let di=class extends T{constructor(){super(...arguments),this._name="",this._err=""}get _parent(){return b.getState().files.currentDir}_validate(e){return e?e.startsWith(".")?"不能以点开头":Ff.test(e)?'含非法字符 / \\ : * ? " < > |':/\s/.test(e[0]||"")?"不能以空白开头":Bf.test(e)?"Windows 保留名":"":"名称不能为空"}_onInput(e){this._name=e.target.value,this._err=this._validate(this._name)}_submit(){if(this._err)return;const e=this._parent?`${this._parent}/${this._name}`:this._name;this.dispatchEvent(new CustomEvent("submit",{detail:{path:e},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=!!this._err;return a`
      <div class="row">
        <label>在 ${this._parent||"/"} 下新建目录</label>
        <input
          autofocus
          class=${e?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${t=>t.key==="Enter"&&this._submit()}
        />
        ${e?a`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${e} @click=${this._submit}>新建</button>
      </div>
    `}};di.styles=S`
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
  `;Ws([m()],di.prototype,"_name",2);Ws([m()],di.prototype,"_err",2);di=Ws([P("mkdir-dialog")],di);var jf=Object.defineProperty,Hf=Object.getOwnPropertyDescriptor,fo=(e,t,r,i)=>{for(var o=i>1?void 0:i?Hf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&jf(t,r,o),o};const Uf=/[\\/:*?"<>|]/,Wf=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let Cr=class extends T{constructor(){super(...arguments),this.currentName="",this._name="",this._err=""}connectedCallback(){super.connectedCallback(),this._name=this.currentName,this._err=this._validate(this._name)}_validate(e){return e?e===this.currentName?"名称未变化":e.startsWith(".")?"不能以点开头":Uf.test(e)?'含非法字符 / \\ : * ? " < > |':Wf.test(e)?"Windows 保留名":"":"名称不能为空"}_onInput(e){this._name=e.target.value,this._err=this._validate(this._name)}_submit(){this._err||this.dispatchEvent(new CustomEvent("submit",{detail:{newName:this._name},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=!!this._err;return a`
      <div class="row">
        <label>重命名</label>
        <input
          autofocus
          class=${e?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${t=>t.key==="Enter"&&this._submit()}
        />
        ${e?a`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${e} @click=${this._submit}>重命名</button>
      </div>
    `}};Cr.styles=S`
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
  `;fo([h({type:String})],Cr.prototype,"currentName",2);fo([m()],Cr.prototype,"_name",2);fo([m()],Cr.prototype,"_err",2);Cr=fo([P("rename-dialog")],Cr);var Vf=Object.defineProperty,qf=Object.getOwnPropertyDescriptor,Vs=(e,t,r,i)=>{for(var o=i>1?void 0:i?qf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Vf(t,r,o),o};let hi=class extends T{constructor(){super(...arguments),this._dest="",this._overwrite=!1}get _selectedCount(){return b.getState().files.selectedPaths.length}_onPickDir(e){this._dest=e.detail.path}_onToggle(e){e.stopPropagation()}_submit(){this._dest&&this.dispatchEvent(new CustomEvent("submit",{detail:{destDir:this._dest,overwrite:this._overwrite},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const{treeCache:e,expandedPaths:t}=b.getState().files,r=(e[""]||[]).filter(o=>o.is_dir),i=new Set(t);return a`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${r.map(o=>a`
          <tree-node
            .entry=${o}
            .depth=${0}
            .readonly=${!0}
            .expanded=${i.has(o.path)}
            .selected=${this._dest===o.path}
            .childEntries=${e[o.path]||[]}
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
          @change=${o=>this._overwrite=o.target.checked}
        />
        覆盖同名
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${!this._dest} @click=${this._submit}>移动到这里</button>
      </div>
    `}};hi.styles=S`
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
  `;Vs([m()],hi.prototype,"_dest",2);Vs([m()],hi.prototype,"_overwrite",2);hi=Vs([P("move-dialog")],hi);var Gf=Object.defineProperty,Xf=Object.getOwnPropertyDescriptor,mo=(e,t,r,i)=>{for(var o=i>1?void 0:i?Xf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Gf(t,r,o),o};let Tr=class extends T{constructor(){super(...arguments),this._phase="confirming",this._stats=null,this._confirmed=!1}get _selected(){return b.getState().files.selectedPaths}connectedCallback(){super.connectedCallback(),!this._stats&&this._selected.length>0&&(this._phase="loading-stats",this._loadStats())}async _loadStats(){const e=this._selected;let t=0,r=0,i=0;for(const o of e)try{const s=await xt.stats(o);t+=s.file_count,r+=s.dir_count,i+=s.total_size_bytes}catch{}t===0&&r===0&&(t=e.length),this._stats={file_count:t,dir_count:r,total_size_bytes:i},this._phase="confirming"}_fmtSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}_delete(){this._confirmed&&(this._phase="deleting",this.dispatchEvent(new CustomEvent("submit",{detail:{paths:this._selected},bubbles:!0,composed:!0})))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const e=this._selected.length;return this._phase==="loading-stats"?a`<div class="spinner">统计中…</div>`:a`
      <h3>删除 ${e>1?`${e} 项`:this._selected[0]}？</h3>
      <div class="warn"><doclens-icon name="alert-triangle"></doclens-icon> 此操作不可恢复</div>
      ${this._stats?a`
        <div class="stats">
          将永久删除：
          <ul>
            <li>• ${this._stats.file_count} 个文件</li>
            ${this._stats.dir_count>0?a`<li>• ${this._stats.dir_count} 个子文件夹</li>`:""}
            ${this._stats.total_size_bytes>0?a`<li>• 总计 ${this._fmtSize(this._stats.total_size_bytes)}</li>`:""}
          </ul>
        </div>
      `:a`<div class="stats">将永久删除 ${e} 个项目。</div>`}
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
    `}};Tr.styles=S`
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
  `;mo([m()],Tr.prototype,"_phase",2);mo([m()],Tr.prototype,"_stats",2);mo([m()],Tr.prototype,"_confirmed",2);Tr=mo([P("delete-dialog")],Tr);var Yf=Object.defineProperty,Kf=Object.getOwnPropertyDescriptor,qs=(e,t,r,i)=>{for(var o=i>1?void 0:i?Kf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Yf(t,r,o),o};let ui=class extends T{constructor(){super(...arguments),this.targetDir="",this._active=!1,this._dragCounter=0,this._onDragEnter=e=>{this._hasFilesOnly(e)&&(e.preventDefault(),this._dragCounter++,this._active=!0)},this._onDragOver=e=>{this._hasFilesOnly(e)&&e.preventDefault()},this._onDragLeave=()=>{this._dragCounter--,this._dragCounter<=0&&(this._active=!1,this._dragCounter=0)},this._onDrop=e=>{if(!e.dataTransfer)return;e.preventDefault(),this._active=!1,this._dragCounter=0;const t=Array.from(e.dataTransfer.files||[]);t.length!==0&&this.dispatchEvent(new CustomEvent("drop-files",{detail:{files:t,destDir:this.targetDir},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),window.addEventListener("dragenter",this._onDragEnter),window.addEventListener("dragover",this._onDragOver),window.addEventListener("dragleave",this._onDragLeave),window.addEventListener("drop",this._onDrop)}disconnectedCallback(){window.removeEventListener("dragenter",this._onDragEnter),window.removeEventListener("dragover",this._onDragOver),window.removeEventListener("dragleave",this._onDragLeave),window.removeEventListener("drop",this._onDrop),super.disconnectedCallback()}_hasFilesOnly(e){if(!e.dataTransfer)return!1;const t=Array.from(e.dataTransfer.items||[]);return t.length===0?e.dataTransfer.types.includes("Files"):t.every(r=>r.kind==="file")}render(){return a`
      <div class="overlay ${this._active?"active":""}">
        <div><doclens-icon name="upload"></doclens-icon> 拖放以上传到</div>
        <div><doclens-icon name="folder"></doclens-icon> ${this.targetDir||"/"}</div>
      </div>
    `}};ui.styles=S`
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
  `;qs([h({type:String})],ui.prototype,"targetDir",2);qs([m()],ui.prototype,"_active",2);ui=qs([P("drop-zone")],ui);var Zf=Object.defineProperty,Jf=Object.getOwnPropertyDescriptor,Ir=(e,t,r,i)=>{for(var o=i>1?void 0:i?Jf(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Zf(t,r,o),o};const Qf=80,em="按文件名搜索…";let Tt=class extends T{constructor(){super(...arguments),this._value="",this._isComposing=!1,this.disabled=!1,this.placeholder=em,this.value="",this._timer=null,this._onInput=e=>{const t=e.target;if(this._value=t.value,this._value.trim()===""){this._emitClear();return}this._scheduleEmit()},this._onCompositionStart=()=>{this._isComposing=!0},this._onCompositionEnd=()=>{this._isComposing=!1,this._scheduleEmit()},this._onKeyDown=e=>{e.key==="Escape"&&(e.preventDefault(),this._emitClear())},this._onClearClick=()=>{var t;this._emitClear();const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e==null||e.focus()}}connectedCallback(){super.connectedCallback(),this.value&&(this._value=this.value)}disconnectedCallback(){this._timer&&clearTimeout(this._timer),super.disconnectedCallback()}_emitSearch(){this.dispatchEvent(new CustomEvent("search",{detail:{query:this._value},bubbles:!0,composed:!0}))}_scheduleEmit(){this._timer&&clearTimeout(this._timer),this._timer=setTimeout(()=>{this._timer=null,this._isComposing||this._emitSearch()},Qf)}_emitClear(){var t;this._timer&&(clearTimeout(this._timer),this._timer=null),this._value="";const e=(t=this.shadowRoot)==null?void 0:t.querySelector("input");e&&(e.value=""),this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){return a`
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
        ${this._value?a`<button class="clear" title="清空" @click=${this._onClearClick}>×</button>`:""}
      </div>
    `}};Tt.styles=S`
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
  `;Ir([m()],Tt.prototype,"_value",2);Ir([m()],Tt.prototype,"_isComposing",2);Ir([h({type:Boolean})],Tt.prototype,"disabled",2);Ir([h()],Tt.prototype,"placeholder",2);Ir([h({type:String})],Tt.prototype,"value",2);Tt=Ir([P("file-search-box")],Tt);var tm=Object.getOwnPropertyDescriptor,rm=(e,t,r,i)=>{for(var o=i>1?void 0:i?tm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=n(o)||o);return o};const im=100;function om(e,t){if(!t)return e;const r=e.toLowerCase(),i=t.toLowerCase(),o=r.indexOf(i);return o===-1?e:[e.slice(0,o),a`<mark>${e.slice(o,o+i.length)}</mark>`,e.slice(o+i.length)]}function sm(e){const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t+1)}function nm(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}function am(e){if(!e)return"";const t=new Date(e).getTime();if(Number.isNaN(t))return"";const r=Date.now()-t,i=24*3600*1e3;return r<i?"今天":r<2*i?"昨天":r<7*i?`${Math.floor(r/i)} 天前`:r<30*i?`${Math.floor(r/(7*i))} 周前`:r<365*i?`${Math.floor(r/(30*i))} 个月前`:`${Math.floor(r/(365*i))} 年前`}let ps=class extends T{constructor(){super(...arguments),this._onKeyDown=e=>{const{results:t,selectedPath:r}=this._state;if(t.length===0){e.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}));return}const i=t.findIndex(o=>o.path===r);if(e.key==="ArrowDown"){e.preventDefault();const o=t[Math.min(t.length-1,i+1)];g.selectFilenameSearchResult(o.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:o.path},bubbles:!0,composed:!0}))}else if(e.key==="ArrowUp"){e.preventDefault();const o=t[Math.max(0,i-1)];g.selectFilenameSearchResult(o.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:o.path},bubbles:!0,composed:!0}))}else if(e.key==="Enter"){e.preventDefault();const o=t[i]??t[0];o&&this.dispatchEvent(new CustomEvent("activated",{detail:{path:o.path},bubbles:!0,composed:!0}))}else e.key==="Escape"&&this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}}get _state(){return b.getState().files.filenameSearch}_onRowClick(e){g.selectFilenameSearchResult(e.path),this.dispatchEvent(new CustomEvent("activated",{detail:{path:e.path},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.tabIndex=0,this.addEventListener("keydown",this._onKeyDown),this._unsubscribe=b.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;this.removeEventListener("keydown",this._onKeyDown),(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}render(){const{query:e,results:t,selectedPath:r,totalMatches:i}=this._state;return t.length===0?a`
        <div class="empty">
          <doclens-icon class="icon-big" name="search"></doclens-icon>
          <div>未匹配到任何文件名包含 "<b>${e}</b>" 的文档</div>
        </div>
      `:a`
      <div class="header-bar"><doclens-icon name="file"></doclens-icon> 文件名搜索结果 · 共 ${i} 项</div>
      <div class="columns">
        <span>名称 · 目录</span>
        <span>大小 · 修改</span>
      </div>
      <div class="rows">
        ${t.map(o=>{const s=sm(o.path),n=o.path===r;return a`
            <div
              class="row ${n?"active":""}"
              @click=${()=>this._onRowClick(o)}
            >
              <span class="name-cell">
                <doclens-icon class="icon" name="file"></doclens-icon>
                <span class="name">${om(o.name,e)}</span>
                ${s?a`<span class="dir">${s}</span>`:""}
              </span>
              <span class="meta">${nm(o.size)} · ${am(o.modifiedAt)}</span>
            </div>
          `})}
      </div>
      ${i>t.length?a`<div class="overflow-hint">共 ${i} 项，仅显示前 ${im}，请补充关键字</div>`:""}
    `}};ps.styles=S`
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
  `;ps=rm([P("file-search-results")],ps);async function Ta(){return(await F("/api/files/documents")).documents.map(t=>({path:t.path,name:t.name,size:t.size,modifiedAt:t.modified_at}))}var lm=Object.defineProperty,cm=Object.getOwnPropertyDescriptor,Ce=(e,t,r,i)=>{for(var o=i>1?void 0:i?cm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&lm(t,r,o),o};let A=class extends T{constructor(){super(...arguments),this._dialog=null,this._toast=null,this._toastTimer=null,this._previewPath="",this._previewContent="",this._previewLanguage="text",this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null,this._previewError=null,this._previewDirty=!1,this._treePaneWidth=A.TREE_PANE_WIDTH_DEFAULT,this._previewPaneWidth=A.PREVIEW_PANE_WIDTH_DEFAULT,this._fileInput=null,this._onIndexUpdated=async()=>{const e=b.getState().files.currentDir;g.invalidateDir(e),this._ensureLoaded(e);try{const t=await Ta();g.loadIndexedDocuments(t)}catch{}},this._onTreeSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._treePaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=s=>{const n=s.clientX-t,d=this.clientWidth,c=d>0?d-this._previewPaneWidth-A.MIDDLE_PANE_MIN-A.SPLITTERS_TOTAL:A.TREE_PANE_WIDTH_MAX,f=Math.min(A.TREE_PANE_WIDTH_MAX,c),p=Math.max(A.TREE_PANE_WIDTH_MIN,Math.min(f,r+n));p!==this._treePaneWidth&&(this._treePaneWidth=p)},o=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",o),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(A.TREE_PANE_WIDTH_KEY,String(this._treePaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",o)},this._onPreviewSplitterMouseDown=e=>{e.preventDefault();const t=e.clientX,r=this._previewPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=s=>{const n=s.clientX-t,d=this.clientWidth,c=d>0?d-this._treePaneWidth-A.MIDDLE_PANE_MIN-A.SPLITTERS_TOTAL:A.PREVIEW_PANE_WIDTH_MAX,f=Math.min(A.PREVIEW_PANE_WIDTH_MAX,c),p=Math.max(A.PREVIEW_PANE_WIDTH_MIN,Math.min(f,r-n));p!==this._previewPaneWidth&&(this._previewPaneWidth=p)},o=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",o),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(A.PREVIEW_PANE_WIDTH_KEY,String(this._previewPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",o)},this._onOpenPstEmail=async e=>{await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&g.setMobilePane("detail")},this._onPreviewDirty=e=>{this._previewDirty=e.detail.dirty},this._onPreviewSaved=()=>{this._previewDirty=!1,this._showToast("已保存")},this._onPreviewSaveFailed=e=>{this._showToast(`保存失败：${e.detail.message}`)},this._onPreviewUploadSuccess=e=>{this._previewDirty=!1,this._showToast(`已覆盖：${e.detail.path}`),this._reloadPreview()},this._onPreviewUploadFailed=e=>{this._showToast(`上传失败：${e.detail.message}`)},this._onPreviewBack=async()=>{if(Qt(this._previewPath)){await this._previewPathWithDirtyCheck(this._previewPath.split("#")[0]);return}this._goBack()},this._onFilenameSearch=e=>{const t=e.detail.query;if(t.trim()===""){g.clearFilenameSearch();return}const{allDocs:r}=b.getState().files.filenameSearch,i=t.toLowerCase(),o=r.filter(d=>d.name.toLowerCase().includes(i));o.sort((d,c)=>d.name.toLowerCase().localeCompare(c.name.toLowerCase(),"zh",{numeric:!0,sensitivity:"base"}));const s=o.length,n=o.slice(0,100);g.setFilenameSearchQuery({query:t,results:n,totalMatches:s}),n[0]&&this._previewPathWithDirtyCheck(n[0].path)},this._onFilenameClear=()=>{g.clearFilenameSearch()},this._onFilenameResultActivated=async e=>{await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&g.setMobilePane("detail")},this._cancelDialog=()=>{this._dialog=null}}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),this._loadPaneWidths(),this._loadIndexedDocuments(),window.addEventListener("cortex:watch-reindexed",this._onIndexUpdated)}async _loadIndexedDocuments(){if(b.getState().files.filenameSearch.docsLoading)try{const e=await Ta();g.loadIndexedDocuments(e)}catch(e){g.setFilenameSearchDocsError((e==null?void 0:e.message)||"文档列表加载失败")}}_loadPaneWidths(){const e=localStorage.getItem(A.TREE_PANE_WIDTH_KEY);if(e){const r=Number(e);Number.isNaN(r)||(this._treePaneWidth=Math.max(A.TREE_PANE_WIDTH_MIN,Math.min(A.TREE_PANE_WIDTH_MAX,r)))}const t=localStorage.getItem(A.PREVIEW_PANE_WIDTH_KEY);if(t){const r=Number(t);Number.isNaN(r)||(this._previewPaneWidth=Math.max(A.PREVIEW_PANE_WIDTH_MIN,Math.min(A.PREVIEW_PANE_WIDTH_MAX,r)))}}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer&&clearTimeout(this._toastTimer),window.removeEventListener("cortex:watch-reindexed",this._onIndexUpdated),super.disconnectedCallback()}get _state(){return b.getState().files}get _isMobile(){return typeof window<"u"&&window.innerWidth<1024}async _ensureLoaded(e){const{treeCache:t}=b.getState().files;if(!(e in t))try{g.setFilesState({listing:!0});const r=await xt.list(e);if(b.getState().files.treeCache!==t){const i=b.getState().files.treeCache;if(e in i)return;g.setFilesState({treeCache:{...i,[e]:r.entries},listing:!1});return}g.setFilesState({treeCache:{...t,[e]:r.entries},listing:!1})}catch(r){g.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"}),this._showToast((r==null?void 0:r.message)||"加载失败")}}updated(){}_showToast(e){this._toast=e,this._toastTimer&&clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},3500)}_onAction(e){const t=e.detail.name;if(t==="upload"){this._openFilePicker();return}if(["mkdir","rename","move","delete"].includes(t)){if(t==="rename"&&this._state.selectedPaths.length!==1||(t==="move"||t==="delete")&&this._state.selectedPaths.length===0)return;this._dialog=t}}_openFilePicker(){this._fileInput||(this._fileInput=document.createElement("input"),this._fileInput.type="file",this._fileInput.multiple=!0,this._fileInput.style.display="none",this._fileInput.addEventListener("change",()=>{this._fileInput&&this._fileInput.files&&this._fileInput.files.length>0&&(this._uploadFiles(Array.from(this._fileInput.files),this._state.currentDir),this._fileInput.value="")}),document.body.appendChild(this._fileInput)),this._fileInput.click()}async _onMkdirSubmit(e){this._dialog=null;try{await xt.mkdir(e.detail.path);const t=e.detail.path.includes("/")?e.detail.path.slice(0,e.detail.path.lastIndexOf("/")):"";g.invalidateDir(t),await this._ensureLoaded(t),g.expandDir(t),this._showToast("目录已创建")}catch(t){this._showToast((t==null?void 0:t.message)||"创建失败")}}async _onRenameSubmit(e){const t=this._state.selectedPaths[0];this._dialog=null;try{if(await xt.rename(t,e.detail.newName),g.invalidateDir(this._state.currentDir),await this._ensureLoaded(this._state.currentDir),this._previewPath===t){const r=t.includes("/")?t.slice(0,t.lastIndexOf("/")+1)+e.detail.newName:e.detail.newName;this._previewPath=r,this._reloadPreview()}this._showToast("已重命名")}catch(r){this._showToast((r==null?void 0:r.message)||"重命名失败")}}async _onMoveSubmit(e){const t=[...this._state.selectedPaths];this._dialog=null;try{const r=await xt.move(t,e.detail.destDir,e.detail.overwrite),i=new Set;t.forEach(o=>{i.add(o.includes("/")?o.slice(0,o.lastIndexOf("/")):"")}),i.add(e.detail.destDir),i.forEach(o=>g.invalidateDir(o));for(const o of i)await this._ensureLoaded(o);g.clearSelection(),this._showToast(r.skipped.length?`已移动 ${r.moved.length} 项，${r.skipped.length} 项跳过`:`已移动 ${r.moved.length} 项`)}catch(r){this._showToast((r==null?void 0:r.message)||"移动失败")}}async _onDeleteSubmit(e){const t=[...e.detail.paths];this._dialog=null;let r=0,i=0;for(const s of t)try{await xt.remove(s),r++,g.invalidateSubtree(s);const n=s.includes("/")?s.slice(0,s.lastIndexOf("/")):"";g.invalidateDir(n)}catch{i++}const o=new Set;t.forEach(s=>o.add(s.includes("/")?s.slice(0,s.lastIndexOf("/")):""));for(const s of o)await this._ensureLoaded(s);this._previewPath&&t.includes(this._previewPath)&&(this._previewPath="",this._previewContent="",this._previewError=null,this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null,this._previewDirty=!1),g.clearSelection(),this._showToast(i?`已删除 ${r}，失败 ${i}`:`已删除 ${r} 项`)}_onDropFiles(e){this._uploadFiles(e.detail.files,e.detail.destDir)}async _uploadFiles(e,t){let r=0,i=0,o="";for(const s of e)try{await xt.upload(s,t,!1),r++}catch(n){(n==null?void 0:n.code)==="ALREADY_EXISTS"?i++:o=(n==null?void 0:n.message)||"上传失败"}if(g.invalidateDir(t),await this._ensureLoaded(t),o&&r===0)this._showToast(o);else{const s=[`已上传 ${r}`];i>0&&s.push(`跳过 ${i}`),o&&s.push("部分失败"),this._showToast(s.join("，"))}}_goBack(){const e=this._state.mobilePane;e==="detail"?this._isFilenameSearchActive?g.setMobilePane("tree"):g.setMobilePane("list"):e==="list"&&g.setMobilePane("tree")}async _onFileListActivated(e){if(e.detail.is_dir){g.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path);return}await this._previewPathWithDirtyCheck(e.detail.path),this._isMobile&&g.setMobilePane("detail")}async _previewPathWithDirtyCheck(e){if(this._previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await this._fetchPreview(e)}async _fetchPreview(e){if(St(e)){this._previewError=null,this._previewPath=e,this._previewContent="",this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null;return}const t=await Sr(e);t.ok?(this._previewError=null,this._previewPath=t.path,this._previewContent=t.content,this._previewLanguage=t.language,this._previewWritable=t.writable,this._previewPages=t.pages,this._previewAttachments=t.attachments):t.notIndexed?(this._previewError="NOT_INDEXED",this._previewPath=e,this._previewContent="",this._previewWritable=!1,this._previewPages=null,this._previewAttachments=null):this._showToast(t.message||"预览失败")}async _reloadPreview(){if(!this._previewPath)return;const e=await Sr(this._previewPath);e.ok&&(this._previewContent=e.content,this._previewLanguage=e.language,this._previewWritable=e.writable,this._previewPages=e.pages,this._previewAttachments=e.attachments)}_discardPreviewEdits(){var t,r;const e=(t=this.shadowRoot)==null?void 0:t.querySelector("preview-pane");(r=e==null?void 0:e.discard)==null||r.call(e),this._previewDirty=!1}_renderNotIndexedHint(){return a`<div class="preview-placeholder">
      该文件未索引，无法预览。<br>
      请先执行 doclens index 后重试。
    </div>`}_renderPreviewPane(e={}){return this._previewError==="NOT_INDEXED"?this._renderNotIndexedHint():this._previewPath?St(this._previewPath)?a`<pst-email-list
        .pstPath=${this._previewPath}
        ?showBack=${e.mobile??!1}
        @open-email=${this._onOpenPstEmail}
        @back=${()=>this._goBack()}
      ></pst-email-list>`:a`<preview-pane
      ?noHeader=${e.noHeader??!1}
      ?mobile=${e.mobile??!1}
      path=${this._previewPath}
      language=${this._previewLanguage}
      content=${this._previewContent}
      ?writable=${this._previewWritable}
      .pages=${this._previewPages}
      .attachments=${this._previewAttachments}
      ?showBack=${Qt(this._previewPath)}
      backLabel="邮件列表"
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}
      @back=${this._onPreviewBack}
    ></preview-pane>`:a`<div class="preview-placeholder">点击文件预览</div>`}get _searchBoxState(){const e=b.getState().files.filenameSearch,t=!e.docsLoading&&e.allDocs.length===0,r=e.docsError!==null||t,i=e.docsError!==null?"文档列表加载失败":t?"暂无已索引文档":"按文件名搜索…";return{disabled:r,placeholder:i}}get _isFilenameSearchActive(){return b.getState().files.filenameSearch.isActive}render(){return a`
      ${this._isMobile?this._renderMobile():this._renderDesktop()}
      ${this._renderDialogs()}
      <drop-zone .targetDir=${this._state.currentDir} @drop-files=${this._onDropFiles}></drop-zone>
      ${this._toast?a`<div class="toast" @click=${()=>this._toast=null}>${this._toast}</div>`:""}
    `}_renderDesktop(){const{disabled:e,placeholder:t}=this._searchBoxState;return a`
      <div
        class="desktop-layout"
        style="--tree-pane-width: ${this._treePaneWidth}px; --preview-pane-width: ${this._previewPaneWidth}px"
      >
        <aside class="tree-pane">
          <file-search-box
            .value=${b.getState().files.filenameSearch.query}
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
        ${this._isFilenameSearchActive?a`<file-search-results
              @activated=${this._onFilenameResultActivated}
              @clear=${this._onFilenameClear}
            ></file-search-results>`:a`<file-list
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
    `}_renderMobile(){const e=this._state.mobilePane,t=this._searchBoxState;return a`
      <div class="mobile-layout">
        ${e==="tree"?a`
              <file-search-box
                .value=${b.getState().files.filenameSearch.query}
                ?disabled=${t.disabled}
                .placeholder=${t.placeholder}
                @search=${this._onFilenameSearch}
                @clear=${this._onFilenameClear}
              ></file-search-box>
              ${this._isFilenameSearchActive?a`<file-search-results
                    @activated=${this._onFilenameResultActivated}
                    @clear=${this._onFilenameClear}
                  ></file-search-results>`:a`<file-tree
                    @select-dir=${async r=>{g.selectDir(r.detail.path),await this._ensureLoaded(r.detail.path),g.expandDir(r.detail.path),g.setMobilePane("list")}}
                  ></file-tree>`}
            `:""}
        ${e==="list"?a`<file-list
              .activePath=${this._previewPath}
              ?mobile=${!0}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
              @back=${()=>this._goBack()}
            ></file-list>`:""}
        ${e==="detail"?a`<div class="mobile-preview">${this._renderPreviewPane({mobile:!0})}</div>`:""}
      </div>
    `}_renderDialogs(){if(this._dialog==="mkdir")return a`<dialog open>
        <mkdir-dialog
          @submit=${this._onMkdirSubmit}
          @cancel=${this._cancelDialog}
        ></mkdir-dialog>
      </dialog>`;if(this._dialog==="rename"){const t=(this._state.selectedPaths[0]||"").split("/").pop()||"";return a`<dialog open>
        <rename-dialog
          .currentName=${t}
          @submit=${this._onRenameSubmit}
          @cancel=${this._cancelDialog}
        ></rename-dialog>
      </dialog>`}return this._dialog==="move"?a`<dialog open>
        <move-dialog
          @submit=${this._onMoveSubmit}
          @cancel=${this._cancelDialog}
        ></move-dialog>
      </dialog>`:this._dialog==="delete"?a`<dialog open>
        <delete-dialog
          @submit=${this._onDeleteSubmit}
          @cancel=${this._cancelDialog}
        ></delete-dialog>
      </dialog>`:a``}};A.TREE_PANE_WIDTH_KEY="cortex.files.treePaneWidth";A.TREE_PANE_WIDTH_DEFAULT=240;A.TREE_PANE_WIDTH_MIN=180;A.TREE_PANE_WIDTH_MAX=720;A.PREVIEW_PANE_WIDTH_KEY="cortex.files.previewPaneWidth";A.PREVIEW_PANE_WIDTH_DEFAULT=320;A.PREVIEW_PANE_WIDTH_MIN=240;A.PREVIEW_PANE_WIDTH_MAX=1600;A.MIDDLE_PANE_MIN=300;A.SPLITTERS_TOTAL=8;A.styles=S`
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
  `;Ce([m()],A.prototype,"_dialog",2);Ce([m()],A.prototype,"_toast",2);Ce([m()],A.prototype,"_previewPath",2);Ce([m()],A.prototype,"_previewContent",2);Ce([m()],A.prototype,"_previewLanguage",2);Ce([m()],A.prototype,"_previewWritable",2);Ce([m()],A.prototype,"_previewPages",2);Ce([m()],A.prototype,"_previewAttachments",2);Ce([m()],A.prototype,"_previewError",2);Ce([m()],A.prototype,"_previewDirty",2);Ce([m()],A.prototype,"_treePaneWidth",2);Ce([m()],A.prototype,"_previewPaneWidth",2);A=Ce([P("files-view")],A);const bt=e=>`/api/diary${e}`,gt={today:()=>F(bt("/today")),entry:e=>F(bt(`/entry?date=${encodeURIComponent(e)}`)),calendar:e=>F(bt(`/calendar?month=${encodeURIComponent(e)}`)),addText:e=>F(bt("/fragments"),{method:"POST",json:{text:e}}),uploadPhoto:(e,t)=>{const r=new FormData;return r.append("file",e),r.append("caption",t),F(bt("/photos"),{method:"POST",body:r})},removeFragment:(e,t)=>F(bt(`/fragments/${encodeURIComponent(t)}?date=${encodeURIComponent(e)}`),{method:"DELETE"}),editFragment:(e,t,r)=>F(bt(`/fragments/${encodeURIComponent(t)}?date=${encodeURIComponent(e)}`),{method:"PUT",json:{text:r}}),setCity:(e,t)=>F(bt(`/city?date=${encodeURIComponent(e)}&city=${encodeURIComponent(t)}`),{method:"POST"})};var dm=Object.defineProperty,hm=Object.getOwnPropertyDescriptor,Dt=(e,t,r,i)=>{for(var o=i>1?void 0:i?hm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&dm(t,r,o),o};const um=["一","二","三","四","五","六","日"];function yt(e){const[t,r,i]=e.split("-").map(Number);return new Date(t,r-1,i)}function Dl(e){const t=String(e.getMonth()+1).padStart(2,"0"),r=String(e.getDate()).padStart(2,"0");return`${e.getFullYear()}-${t}-${r}`}function Qr(e){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}`}function Pa(e,t){const r=yt(e);return r.setDate(r.getDate()+t),Dl(r)}function pm(e,t){const r=yt(`${e}-01`);return r.setMonth(r.getMonth()+t),Qr(r)}const fm=["星期一","星期二","星期三","星期四","星期五","星期六","星期日"];function mm(e){return fm[(yt(e).getDay()+6)%7]}let Qe=class extends T{constructor(){super(...arguments),this.month="",this.dates=[],this.selected="",this.today="",this._view="days",this._pickerYear=0,this._yearStart=0}_shiftMonth(e){this.dispatchEvent(new CustomEvent("month-change",{detail:{month:pm(this.month,e)},bubbles:!0,composed:!0}))}_select(e){this.dispatchEvent(new CustomEvent("select-date",{detail:{date:e},bubbles:!0,composed:!0}))}_dispatchMonth(e){this.dispatchEvent(new CustomEvent("month-change",{detail:{month:e},bubbles:!0,composed:!0}))}_currentYear(){return Number(this.month.split("-")[0])||new Date().getFullYear()}_titleClick(){if(this._view==="days")this._pickerYear=this._currentYear(),this._view="months";else if(this._view==="months"){const e=this._pickerYear;this._yearStart=e-e%12,this._view="years"}else this._view="days"}_shiftPickerYear(e){this._pickerYear+=e}_shiftYearRange(e){this._yearStart+=e*12}_pickYear(e){this._pickerYear=e,this._view="months"}_pickMonth(e){const t=String(e).padStart(2,"0");this._dispatchMonth(`${this._pickerYear}-${t}`),this._view="days"}_cells(){const e=yt(`${this.month}-01`),t=new Date(e.getFullYear(),e.getMonth()+1,0).getDate(),r=(e.getDay()+6)%7,i=[];for(let o=0;o<r;o++)i.push(null);for(let o=1;o<=t;o++)i.push({date:`${this.month}-${String(o).padStart(2,"0")}`,day:o,other:!1});return i}render(){return a`
      <div class="cal-head">${this._renderHead()}</div>
      ${this._view==="days"?this._renderDays():this._view==="months"?this._renderMonths():this._renderYears()}
    `}_renderHead(){if(this._view==="months")return a`
        <button class="nav-btn" aria-label="上一年" @click=${()=>this._shiftPickerYear(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <button class="cal-title" @click=${()=>this._titleClick()}>${this._pickerYear} 年</button>
        <button class="nav-btn" aria-label="下一年" @click=${()=>this._shiftPickerYear(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      `;if(this._view==="years"){const r=this._yearStart+11;return a`
        <button class="nav-btn" aria-label="上一年代" @click=${()=>this._shiftYearRange(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <button class="cal-title" @click=${()=>this._titleClick()}>${this._yearStart}–${r}</button>
        <button class="nav-btn" aria-label="下一年代" @click=${()=>this._shiftYearRange(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      `}const[e,t]=this.month.split("-");return a`
      <button class="nav-btn" aria-label="上一月" @click=${()=>this._shiftMonth(-1)}>
        <doclens-icon name="chevron-left"></doclens-icon>
      </button>
      <button class="cal-title" @click=${()=>this._titleClick()}>
        ${Number(e)} 年 ${Number(t)} 月
      </button>
      <button class="nav-btn" aria-label="下一月" @click=${()=>this._shiftMonth(1)}>
        <doclens-icon name="chevron-right"></doclens-icon>
      </button>
    `}_renderDays(){const e=new Set(this.dates);return a`
      <div class="grid">
        ${um.map(t=>a`<span class="wd">${t}</span>`)}
        ${this._cells().map(t=>t===null?a`<span></span>`:a`
                <button
                  class="day ${t.date===this.selected?"selected":""}"
                  ?disabled=${this.today!==""&&t.date>this.today}
                  @click=${()=>this._select(t.date)}>
                  ${t.day}
                  ${e.has(t.date)?a`<span class="dot"></span>`:null}
                </button>`)}
      </div>
    `}_renderMonths(){const[e,t]=this.today?this.today.split("-").map(Number):[0,0],r=this.month;return a`
      <div class="pick-grid">
        ${Array.from({length:12},(i,o)=>{const s=o+1,n=String(s).padStart(2,"0"),d=`${this._pickerYear}-${n}`,c=this.today!==""&&(this._pickerYear>e||this._pickerYear===e&&s>t);return a`
            <button
              class="pick-cell ${d===r?"selected":""}"
              ?disabled=${c}
              @click=${()=>this._pickMonth(s)}>${s} 月</button>
          `})}
      </div>
    `}_renderYears(){const e=this._currentYear(),t=this.today?Number(this.today.split("-")[0]):0;return a`
      <div class="pick-grid">
        ${Array.from({length:12},(r,i)=>{const o=this._yearStart+i;return a`
            <button
              class="pick-cell ${o===e?"selected":""}"
              ?disabled=${this.today!==""&&o>t}
              @click=${()=>this._pickYear(o)}>${o}</button>
          `})}
      </div>
    `}};Qe.styles=S`
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
  `;Dt([h()],Qe.prototype,"month",2);Dt([h({attribute:!1})],Qe.prototype,"dates",2);Dt([h()],Qe.prototype,"selected",2);Dt([h()],Qe.prototype,"today",2);Dt([m()],Qe.prototype,"_view",2);Dt([m()],Qe.prototype,"_pickerYear",2);Dt([m()],Qe.prototype,"_yearStart",2);Qe=Dt([P("diary-calendar")],Qe);var bm=Object.defineProperty,gm=Object.getOwnPropertyDescriptor,ot=(e,t,r,i)=>{for(var o=i>1?void 0:i?gm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&bm(t,r,o),o};let ze=class extends T{constructor(){super(...arguments),this.entry=null,this.submitting=!1,this.city="",this._pendingFile=null,this._pendingPreviewUrl="",this._confirmingFid="",this._editingFid="",this._editText="",this._viewerSrc=""}_onSubmitText(e){this.dispatchEvent(new CustomEvent("submit-text",{detail:{value:e.detail.value},bubbles:!0,composed:!0}));const t=e.target;t.value=""}_onCityTag(){this.dispatchEvent(new CustomEvent("city-change",{bubbles:!0,composed:!0}))}_pickPhoto(e){const t=this.renderRoot.querySelector(e?"input[data-capture]":"input[data-gallery]");t==null||t.click()}_onFileChange(e){var i;const t=e.target,r=(i=t.files)==null?void 0:i[0];t.value="",r&&(this._pendingPreviewUrl&&URL.revokeObjectURL(this._pendingPreviewUrl),this._pendingFile=r,this._pendingPreviewUrl=URL.createObjectURL(r))}_cancelPending(){this._pendingPreviewUrl&&URL.revokeObjectURL(this._pendingPreviewUrl),this._pendingFile=null,this._pendingPreviewUrl=""}_confirmPending(){var r;if(!this._pendingFile)return;const e=((r=this.renderRoot.querySelector(".caption"))==null?void 0:r.value.trim())??"",t=this._pendingFile;this._cancelPending(),this.dispatchEvent(new CustomEvent("upload-photo",{detail:{file:t,caption:e},bubbles:!0,composed:!0}))}_onDelete(e){if(this._confirmingFid!==e){this._confirmingFid=e;return}this._confirmingFid="",this.dispatchEvent(new CustomEvent("delete-fragment",{detail:{fid:e},bubbles:!0,composed:!0}))}_onEdit(e,t){this._confirmingFid="",this._editingFid=e,this._editText=t}_onCancelEdit(){this._editingFid="",this._editText=""}_onSaveEdit(e){const t=this._editText;this.dispatchEvent(new CustomEvent("edit-fragment",{detail:{fid:e,text:t},bubbles:!0,composed:!0})),this._editingFid="",this._editText=""}_renderFragment(e){const t=this._confirmingFid===e.fid,r=this._editingFid===e.fid;return a`
      <li class="frag">
        <span class="node"></span>
        <div class="frag-content">
          <div class="frag-meta">
            <span class="time">${e.time}</span>
            <div class="frag-actions">
              ${r?null:a`<button class="icon-btn" title="编辑" @click=${()=>this._onEdit(e.fid,e.kind==="photo"&&e.text==="照片"?"":e.text)}>
                    <doclens-icon name="pencil" style="font-size:16px"></doclens-icon>
                  </button>`}
              <button
                class="del-btn ${t?"confirming":""}"
                title="删除片段"
                @click=${()=>this._onDelete(e.fid)}>
                ${t?a`确认删除`:a`<doclens-icon name="trash-2" style="font-size:16px"></doclens-icon>`}
              </button>
            </div>
          </div>
          <div class="frag-body">${r?a`<textarea
                  class="edit-area"
                  .value=${this._editText}
                  @input=${i=>this._editText=i.target.value}></textarea>
                <div class="edit-actions">
                  <button class="save-btn" ?disabled=${this.submitting} @click=${()=>this._onSaveEdit(e.fid)}>${this.submitting?"保存中…":"保存"}</button>
                  <button class="cancel-btn" ?disabled=${this.submitting} @click=${()=>this._onCancelEdit()}>取消</button>
                </div>`:e.kind==="photo"&&e.image_url?a`<div class="photo-wrap">
                  <img src=${e.image_url} alt=${e.text} loading="lazy"
                       @click=${()=>this._viewerSrc=e.image_url} />
                  <button class="expand-btn" title="全屏查看"
                          @click=${()=>this._viewerSrc=e.image_url}>
                    <doclens-icon name="maximize-2" style="font-size:14px"></doclens-icon>
                  </button>
                </div>
                ${e.text&&e.text!=="照片"?a`<div class="caption">${e.text}</div>`:null}`:e.text}</div>
        </div>
      </li>
    `}render(){var t;const e=[...((t=this.entry)==null?void 0:t.fragments)??[]].reverse();return a`
      <input-box
        class="text-input"
        multiline
        buttonLabel="记录"
        placeholder="记录此刻…（Enter 发送，Shift+Enter 换行）"
        ?disabled=${this.submitting}
        @submit=${this._onSubmitText}></input-box>
      <div class="photo-btns">
        ${this.city?a`<button class="city-tag" title="更换城市" @click=${()=>this._onCityTag()}>📍 ${this.city}</button>`:null}
        <button class="photo-btn" ?disabled=${this.submitting} @click=${()=>this._pickPhoto(!0)}>
          <doclens-icon name="camera" style="font-size:18px"></doclens-icon>拍照
        </button>
        <button class="photo-btn" ?disabled=${this.submitting} @click=${()=>this._pickPhoto(!1)}>
          <doclens-icon name="image" style="font-size:18px"></doclens-icon>相册
        </button>
      </div>
      <input type="file" data-capture accept="image/*" capture="environment" hidden @change=${this._onFileChange} />
      <input type="file" data-gallery accept="image/*" hidden @change=${this._onFileChange} />

      ${this._pendingFile?a`
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

      ${e.length>0?a`<ul class="timeline">
            ${e.map(r=>this._renderFragment(r))}
          </ul>`:a`<div class="empty-hint">今天还没有记录，写下第一条吧</div>`}

      ${this._viewerSrc?a`<image-viewer
        .src=${this._viewerSrc}
        @close=${()=>this._viewerSrc=""}></image-viewer>`:null}
    `}};ze.styles=S`
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
  `;ot([h({attribute:!1})],ze.prototype,"entry",2);ot([h({type:Boolean})],ze.prototype,"submitting",2);ot([h()],ze.prototype,"city",2);ot([m()],ze.prototype,"_pendingFile",2);ot([m()],ze.prototype,"_pendingPreviewUrl",2);ot([m()],ze.prototype,"_confirmingFid",2);ot([m()],ze.prototype,"_editingFid",2);ot([m()],ze.prototype,"_editText",2);ot([m()],ze.prototype,"_viewerSrc",2);ze=ot([P("diary-record-panel")],ze);var vm=Object.defineProperty,xm=Object.getOwnPropertyDescriptor,Ot=(e,t,r,i)=>{for(var o=i>1?void 0:i?xm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&vm(t,r,o),o};let et=class extends T{constructor(){super(...arguments),this.date="",this.today="",this.entry=null,this.loading=!1,this.calendarOpen=!1,this.calendarMonth="",this.calendarDates=[]}_nav(e){this.dispatchEvent(new CustomEvent("navigate-day",{detail:{delta:e},bubbles:!0,composed:!0}))}_toggleCalendar(){this.dispatchEvent(new CustomEvent("toggle-calendar",{bubbles:!0,composed:!0}))}_renderBody(){var e;if(this.loading)return a`<div class="content loading">加载中…</div>`;if(!this.entry||this.entry.state!=="summarized"){const t=((e=this.entry)==null?void 0:e.state)==="raw"?"这一天的日记尚未整理成文":"这一天没有日记";return a`<div class="empty">${t}</div>`}return a`<md-viewer .content=${this.entry.content}></md-viewer>`}render(){const e=this.date===this.today;return a`
      <div class="nav-row">
        <button class="nav-btn" @click=${()=>this._nav(-1)}>
          <doclens-icon name="chevron-left" style="font-size:16px"></doclens-icon>前一天
        </button>
        <button class="date-btn" @click=${this._toggleCalendar}>
          <doclens-icon name="calendar" style="font-size:16px"></doclens-icon>
          ${this.date} ${mm(this.date)}${e?"（今天）":""}
        </button>
        <button class="nav-btn" ?disabled=${e} @click=${()=>this._nav(1)}>
          后一天<doclens-icon name="chevron-right" style="font-size:16px"></doclens-icon>
        </button>
      </div>
      ${this.calendarOpen?a`
        <div class="cal-pop">
          <diary-calendar
            .month=${this.calendarMonth}
            .dates=${this.calendarDates}
            .selected=${this.date}
            .today=${this.today}></diary-calendar>
        </div>`:null}
      ${this._renderBody()}
    `}};et.styles=S`
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
  `;Ot([h()],et.prototype,"date",2);Ot([h()],et.prototype,"today",2);Ot([h({attribute:!1})],et.prototype,"entry",2);Ot([h({type:Boolean})],et.prototype,"loading",2);Ot([h({type:Boolean})],et.prototype,"calendarOpen",2);Ot([h()],et.prototype,"calendarMonth",2);Ot([h({attribute:!1})],et.prototype,"calendarDates",2);et=Ot([P("diary-review-panel")],et);var _m=Object.getOwnPropertyDescriptor,wm=(e,t,r,i)=>{for(var o=i>1?void 0:i?_m(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=n(o)||o);return o};const ym=["广州","深圳","珠海","东莞","佛山","中山"];let fs=class extends T{_pick(e){this.dispatchEvent(new CustomEvent("submit",{detail:{city:e},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){return a`
      <div class="title">选择你的城市（用于日记天气）</div>
      <div class="grid">
        ${ym.map(e=>a`<button class="city" @click=${()=>this._pick(e)}>${e}</button>`)}
      </div>
      <div class="actions">
        <button class="cancel" @click=${this._cancel}>暂不设置</button>
      </div>
    `}};fs.styles=S`
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
  `;fs=wm([P("city-dialog")],fs);var km=Object.defineProperty,$m=Object.getOwnPropertyDescriptor,Ol=(e,t,r,i)=>{for(var o=i>1?void 0:i?$m(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&km(t,r,o),o};let oo=class extends T{constructor(){super(...arguments),this._initialized=!1,this._pendingSubmit=null}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._initialized||(this._initialized=!0,this._init())}updated(e){var r;super.updated(e);const t=(r=this.shadowRoot)==null?void 0:r.querySelector("dialog");t&&!t.open&&t.showModal()}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}get _diary(){return b.getState().diary}_localToday(){return Dl(new Date)}async _init(){await this._loadToday();const e=this._diary.today||this._localToday(),t=Pa(e,-1);g.setDiaryState({reviewDate:t}),await Promise.all([this._loadReview(t),this._loadCalendar(Qr(yt(t)))])}async _loadToday(){g.setDiaryState({recordLoading:!0,error:null});try{const e=await gt.today();g.setDiaryState({today:e.today,todayEntry:e.entry,recordLoading:!1})}catch(e){g.setDiaryState({recordLoading:!1,today:this._localToday(),error:e instanceof Ke?e.message:"加载今日记录失败"})}}async _loadReview(e){g.setDiaryState({reviewLoading:!0,error:null});try{const t=await gt.entry(e);g.setDiaryState({reviewEntry:t,reviewLoading:!1})}catch(t){g.setDiaryState({reviewEntry:null,reviewLoading:!1,error:t instanceof Ke?t.message:"加载日记失败"})}}async _loadCalendar(e){try{const t=await gt.calendar(e);g.setDiaryState({calendarMonth:e,calendarDates:t.dates})}catch{g.setDiaryState({calendarMonth:e,calendarDates:[]})}}async _onSubmitText(e){var t;if(!this._diary.submitting){if(!((t=this._diary.todayEntry)!=null&&t.city)){this._pendingSubmit={type:"text",value:e.detail.value},g.setDiaryState({cityDialogOpen:!0});return}this._submitText(e.detail.value)}}async _onUploadPhoto(e){var t;if(!this._diary.submitting){if(!((t=this._diary.todayEntry)!=null&&t.city)){this._pendingSubmit={type:"photo",file:e.detail.file,caption:e.detail.caption},g.setDiaryState({cityDialogOpen:!0});return}this._uploadPhoto(e.detail.file,e.detail.caption)}}async _submitText(e){g.setDiaryState({submitting:!0,error:null});try{await gt.addText(e),await this._loadToday()}catch(t){g.setDiaryState({error:t instanceof Ke?t.message:"记录失败，请重试"})}finally{g.setDiaryState({submitting:!1})}}async _uploadPhoto(e,t){g.setDiaryState({submitting:!0,error:null});try{await gt.uploadPhoto(e,t),await this._loadToday()}catch(r){g.setDiaryState({error:r instanceof Ke?r.message:"照片上传失败，请重试"})}finally{g.setDiaryState({submitting:!1})}}async _onDeleteFragment(e){const t=this._diary.today||this._localToday();g.setDiaryState({error:null});try{await gt.removeFragment(t,e.detail.fid),await this._loadToday()}catch(r){g.setDiaryState({error:r instanceof Ke?r.message:"删除失败，请重试"})}}async _onEditFragment(e){const t=this._diary.today||this._localToday();g.setDiaryState({submitting:!0,error:null});try{await gt.editFragment(t,e.detail.fid,e.detail.text),await this._loadToday()}catch(r){g.setDiaryState({error:r instanceof Ke?r.message:"保存失败，请重试"})}finally{g.setDiaryState({submitting:!1})}}async _onNavigateDay(e){const t=Pa(this._diary.reviewDate,e.detail.delta);g.setDiaryState({reviewDate:t,calendarOpen:!1}),await this._loadReview(t);const r=Qr(yt(t));r!==this._diary.calendarMonth&&this._loadCalendar(r)}_onToggleCalendar(){const e=!this._diary.calendarOpen;g.setDiaryState({calendarOpen:e}),e&&this._loadCalendar(Qr(yt(this._diary.reviewDate)))}async _onSelectDate(e){const t=e.detail.date;g.setDiaryState({reviewDate:t,calendarOpen:!1}),await this._loadReview(t)}_onMonthChange(e){this._loadCalendar(e.detail.month)}_switchTab(e){if(g.setDiaryState({tab:e,calendarOpen:!1}),e==="record")this._loadToday();else{const t=this._diary.reviewDate;this._loadReview(t),this._loadCalendar(Qr(yt(t)))}}async _onCitySubmit(e){const t=e.detail.city,r=this._diary.today||this._localToday();g.setDiaryState({cityDialogOpen:!1});const i=this._pendingSubmit;this._pendingSubmit=null,(i==null?void 0:i.type)==="text"?await this._submitText(i.value):(i==null?void 0:i.type)==="photo"&&i.file&&await this._uploadPhoto(i.file,i.caption);try{const o=await gt.setCity(r,t);g.setDiaryState({todayEntry:o})}catch{}}_onCityCancel(){g.setDiaryState({cityDialogOpen:!1}),localStorage.setItem("doclens.diary.citySelected","true")}render(){var t;const e=this._diary;return a`
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
            class="sub-tab ${e.tab==="record"?"active":""}"
            @click=${()=>this._switchTab("record")}>
            <doclens-icon name="pencil"></doclens-icon>记录
          </button>
          <button
            class="sub-tab ${e.tab==="review"?"active":""}"
            @click=${()=>this._switchTab("review")}>
            <doclens-icon name="book-open"></doclens-icon>回顾
          </button>
        </div>
        ${e.error?a`<div class="error-bar">${e.error}</div>`:null}
        ${e.tab==="record"?a`
              <diary-record-panel
                .entry=${e.todayEntry}
                .submitting=${e.submitting}
                .city=${((t=e.todayEntry)==null?void 0:t.city)||""}
                @city-change=${()=>g.setDiaryState({cityDialogOpen:!0})}></diary-record-panel>`:a`
              <diary-review-panel
                .date=${e.reviewDate}
                .today=${e.today||this._localToday()}
                .entry=${e.reviewEntry}
                .loading=${e.reviewLoading}
                .calendarOpen=${e.calendarOpen}
                .calendarMonth=${e.calendarMonth}
                .calendarDates=${e.calendarDates}></diary-review-panel>`}
        ${e.tab==="record"&&e.cityDialogOpen?a`
          <dialog @cancel=${this._onCityCancel}>
            <city-dialog
              @submit=${this._onCitySubmit}
              @cancel=${this._onCityCancel}></city-dialog>
          </dialog>`:null}
      </div>
    `}};oo.styles=S`
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
  `;Ol([m()],oo.prototype,"_pendingSubmit",2);oo=Ol([P("diary-view")],oo);function Sm(){return typeof window.matchMedia=="function"&&window.matchMedia("(pointer: coarse)").matches}var Em=Object.getOwnPropertyDescriptor,Cm=(e,t,r,i)=>{for(var o=i>1?void 0:i?Em(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=n(o)||o);return o};let ms=class extends T{_emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}render(){return a`
      <div class="grid">
        ${["1","2","3","4","5","6","7","8","9"].map(t=>a`<button type="button" data-key=${t} @click=${()=>this._emit("digit",t)}>${t}</button>`)}
        <button type="button" class="fn" data-key="backspace" aria-label="删除"
          @click=${()=>this._emit("backspace")}>⌫</button>
        <button type="button" data-key="0" @click=${()=>this._emit("digit","0")}>0</button>
        <button type="button" class="fn" data-key="submit" aria-label="确认"
          @click=${()=>this._emit("submit")}>✓</button>
      </div>
    `}};ms.styles=S`
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
  `;ms=Cm([P("pin-pad")],ms);var Tm=Object.defineProperty,Pm=Object.getOwnPropertyDescriptor,bo=(e,t,r,i)=>{for(var o=i>1?void 0:i?Pm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Tm(t,r,o),o};const Ft=6;let Pr=class extends T{constructor(){super(...arguments),this._pin="",this._error="",this._submitting=!1,this._coarse=Sm()}async _submit(){if(!(this._pin.length!==Ft||this._submitting)){this._submitting=!0,this._error="";try{await jd(this._pin),g.setAuthState({authenticated:!0}),qt.navigate("search")}catch(e){this._pin="",this._error=e instanceof Ke?e.message:"网络错误，请重试"}finally{this._submitting=!1}}}_onDigit(e){this._pin.length>=Ft||(this._error="",this._pin+=e.detail,this._pin.length===Ft&&this._submit())}_onBackspace(){this._error="",this._pin=this._pin.slice(0,-1)}_onInput(e){const t=e.target;this._pin=t.value.replace(/\D/g,"").slice(0,Ft),t.value=this._pin,this._error=""}_onKeydown(e){e.key==="Enter"&&this._submit()}_renderCoarse(){return a`
      <div class="dots" aria-label="已输入 ${this._pin.length} 位">
        ${Array.from({length:Ft},(e,t)=>a`<span class="dot ${t<this._pin.length?"filled":""}"></span>`)}
      </div>
      <pin-pad
        @digit=${this._onDigit}
        @backspace=${this._onBackspace}
        @submit=${()=>void this._submit()}
      ></pin-pad>
    `}_renderFine(){return a`
      <input
        class="pin-input"
        type="password"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength=${Ft}
        autocomplete="current-password"
        placeholder="●●●●●●"
        .value=${this._pin}
        @input=${this._onInput}
        @keydown=${this._onKeydown}
        autofocus
      />
      <button
        class="submit"
        ?disabled=${this._pin.length!==Ft||this._submitting}
        @click=${()=>void this._submit()}
      >${this._submitting?"验证中…":"登 录"}</button>
    `}render(){return a`
      <div class="card">
        <h1>🔒 访问密码</h1>
        <p class="subtitle">此实例已启用密码保护，请输入 6 位数字密码</p>
        ${this._coarse?this._renderCoarse():this._renderFine()}
        <p class="error" role="alert">${this._error||k}</p>
      </div>
    `}};Pr.styles=S`
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
  `;bo([m()],Pr.prototype,"_pin",2);bo([m()],Pr.prototype,"_error",2);bo([m()],Pr.prototype,"_submitting",2);Pr=bo([P("login-view")],Pr);const Am='<svg viewBox="0 0 1024 1024" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" id="图层_1"><defs><style>.cls-1{fill:url(#未命名的渐变_15);}.cls-2{fill:url(#未命名的渐变_5);}.cls-3{fill:url(#未命名的渐变_12);}.cls-4{fill:#fff;}.cls-5{fill:#a6c9ff;}.cls-10,.cls-18,.cls-6,.cls-7,.cls-8,.cls-9{stroke-width:3.97px;}.cls-6{fill:url(#未命名的渐变_121);stroke:url(#未命名的渐变_89);}.cls-7{fill:url(#未命名的渐变_121-2);stroke:url(#未命名的渐变_89-2);}.cls-8{fill:url(#未命名的渐变_121-3);stroke:url(#未命名的渐变_89-3);}.cls-9{fill:url(#未命名的渐变_121-4);stroke:url(#未命名的渐变_89-4);}.cls-10{fill:url(#未命名的渐变_150);stroke:url(#未命名的渐变_89-5);}.cls-11{fill:url(#未命名的渐变_142);}.cls-12{fill:url(#未命名的渐变_15-2);}.cls-13{fill:url(#未命名的渐变_15-3);}.cls-14{fill:url(#未命名的渐变_15-4);}.cls-15,.cls-16,.cls-17{stroke-width:3.45px;}.cls-15{fill:url(#未命名的渐变_303);stroke:url(#未命名的渐变_89-6);}.cls-16{fill:url(#未命名的渐变_303-2);stroke:url(#未命名的渐变_89-7);}.cls-17{fill:url(#未命名的渐变_303-3);stroke:url(#未命名的渐变_89-8);}.cls-18{fill:url(#未命名的渐变_165);stroke:url(#未命名的渐变_89-9);}.cls-19{fill:url(#未命名的渐变_142-2);}.cls-20{fill:url(#未命名的渐变_15-5);}.cls-21{fill:url(#未命名的渐变_15-6);}</style><linearGradient gradientUnits="userSpaceOnUse" y2="575.6" x2="723.12" y1="823.34" x1="260.49" id="未命名的渐变_15"><stop stop-color="#ecf3ff" offset="0"></stop><stop stop-color="#c9e2ff" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="936.7" x2="441.51" y1="771.46" x1="117.19" id="未命名的渐变_5"><stop stop-color="#c8e1ff" offset="0"></stop><stop stop-color="#c5dfff" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="850.55" x2="962.02" y1="860.6" x1="475.44" id="未命名的渐变_12"><stop stop-color="#c5dfff" offset="0.06"></stop><stop stop-color="#8bb4f1" offset="0.23"></stop><stop stop-color="#a2c5f7" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="116.46" x2="512.61" y1="614.64" x1="176.04" id="未命名的渐变_121"><stop stop-opacity="0" stop-color="#f7f8fa" offset="0"></stop><stop stop-color="#62abff" offset="1"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="373.13" x2="484.05" y1="373.13" x1="238.3" id="未命名的渐变_89"><stop stop-opacity="0.24" stop-color="#fff" offset="0"></stop><stop stop-color="#fff" offset="0.94"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_121" y2="380.36" x2="510.69" y1="380.36" x1="268.92" id="未命名的渐变_121-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="381.02" x2="512.67" y1="381.02" x1="266.93" id="未命名的渐变_89-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_121" y2="391.59" x2="536.75" y1="391.59" x1="294.98" id="未命名的渐变_121-3"></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="392.24" x2="538.73" y1="392.24" x1="292.99" id="未命名的渐变_89-3"></linearGradient><linearGradient xlink:href="#未命名的渐变_121" y2="404.68" x2="573.3" y1="404.68" x1="331.53" id="未命名的渐变_121-4"></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="405.33" x2="575.28" y1="405.33" x1="329.55" id="未命名的渐变_89-4"></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="444.26" x2="512.56" y1="86.89" x1="-37.04" id="未命名的渐变_150"><stop stop-opacity="0" stop-color="#f7f8fa" offset="0"></stop><stop stop-color="#62abff" offset="0.92"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_89" y2="420.84" x2="604.72" y1="420.84" x1="359.85" id="未命名的渐变_89-5"></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="444.06" x2="385.18" y1="431.67" x1="215.21" id="未命名的渐变_142"><stop stop-color="#509eff" offset="0.17"></stop><stop stop-color="#06f" offset="1"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_15" y2="253.5" x2="336.38" y1="253.5" x1="249.71" id="未命名的渐变_15-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" y2="331.15" x2="336.38" y1="331.15" x1="249.71" id="未命名的渐变_15-3"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" y2="414.24" x2="336.38" y1="414.24" x1="249.71" id="未命名的渐变_15-4"></linearGradient><radialGradient gradientUnits="userSpaceOnUse" r="222.83" cy="513.98" cx="567.16" id="未命名的渐变_303"><stop stop-opacity="0" stop-color="#f7f8fa" offset="0.27"></stop><stop stop-color="#62abff" offset="1"></stop></radialGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2576.86" x2="405.02" y1="2576.86" x1="127.71" id="未命名的渐变_89-6"></linearGradient><radialGradient xlink:href="#未命名的渐变_303" r="221.75" cy="510.89" cx="606.07" id="未命名的渐变_303-2"></radialGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2585.91" x2="440.25" y1="2585.91" x1="170" id="未命名的渐变_89-7"></linearGradient><radialGradient xlink:href="#未命名的渐变_303" r="222.76" cy="511.77" cx="637.08" id="未命名的渐变_303-3"></radialGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2597.79" x2="471.6" y1="2597.79" x1="195.59" id="未命名的渐变_89-8"></linearGradient><linearGradient gradientUnits="userSpaceOnUse" y2="674.55" x2="849.14" y1="50.38" x1="174.27" id="未命名的渐变_165"><stop stop-opacity="0.5" stop-color="#f7f8fa" offset="0"></stop><stop stop-color="#62abff" offset="0.92"></stop></linearGradient><linearGradient xlink:href="#未命名的渐变_89" gradientTransform="translate(-522.81 -1835.11) rotate(-19.27)" y2="2614.84" x2="503.92" y1="2614.84" x1="225.76" id="未命名的渐变_89-9"></linearGradient><linearGradient xlink:href="#未命名的渐变_142" y2="729.89" x2="481.87" y1="217.24" x1="637.43" id="未命名的渐变_142-2"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" gradientTransform="translate(-763.31 -2288.79) rotate(-24.35)" y2="3040.03" x2="31.57" y1="3040.03" x1="-43.88" id="未命名的渐变_15-5"></linearGradient><linearGradient xlink:href="#未命名的渐变_15" gradientTransform="translate(-763.31 -2288.79) rotate(-24.35)" y2="2978.16" x2="31.57" y1="2978.16" x1="-43.88" id="未命名的渐变_15-6"></linearGradient></defs><path d="M940.25,687c0,1.06,0,2.21-.08,3.27,0,.3-.07.61-.07.91v.08c-1.22,12.69-10,25.08-26.76,35l-105.6,62.49-1.67,1-6.62,3.88L601.26,911.06a120.12,120.12,0,0,1-34.21,13.15,42.79,42.79,0,0,1-4.48.91c-.31.08-.69.15-1,.23h-.08c-35,6.77-76,2.51-105.59-12.85-.08,0-.08-.07-.15-.07L113.89,733.62C101.19,726.93,92,719,86.52,710.51a5.08,5.08,0,0,0-.54-.76,35.78,35.78,0,0,1-5.55-17.26v-1.36a5.47,5.47,0,0,1,.08-1.14v-.69a31.74,31.74,0,0,1,1.22-7.53,6,6,0,0,1,.3-1.14,44,44,0,0,1,2.81-6.46.07.07,0,0,0,.08-.07c4.33-7.76,11.78-15.06,22.35-21.29L419.34,468.08c38.39-22.73,103.47-23.34,145.51-1.37L837,609l69.71,36.42a97.68,97.68,0,0,1,10.72,6.46c11,7.75,18,16.72,21.06,25.85A36,36,0,0,1,940.25,687Z" class="cls-1"></path><path d="M114,732.79A82.18,82.18,0,0,1,93.39,718,50.63,50.63,0,0,1,85,706.86a38.87,38.87,0,0,1-2.58-5.79,33,33,0,0,1-1.9-11.78l-2.22,94.84c-.36,15.75,10.93,31.69,33.53,43.5L453.7,1006.39l2.21-94.84Z" class="cls-2"></path><path d="M940.06,691.21c-.12,1-.27,2-.48,3-.17.77-.39,1.54-.62,2.31-.28,1-.59,1.9-1,2.85q-.45,1.14-1,2.28c-.45,1-1,1.92-1.51,2.87q-.62,1.1-1.32,2.16c-.71,1.09-1.52,2.16-2.36,3.22-.49.63-1,1.25-1.5,1.87a57,57,0,0,1-5.31,5.37c-1.57,1.38-3.27,2.73-5.08,4-.55.4-1.16.77-1.72,1.16-1.54,1-3.07,2.11-4.77,3.11l-312,184.72q-3.79,2.25-7.93,4.19c-.91.43-1.88.81-2.82,1.22-1.87.83-3.75,1.65-5.71,2.39-1.16.44-2.36.82-3.54,1.23-1.82.63-3.65,1.25-5.53,1.81-1.29.38-2.61.72-3.93,1.07-1.84.49-3.68,1-5.56,1.39-1.07.24-2.14.45-3.22.67-4.63.94-9.34,1.73-14.15,2.29-.7.08-1.41.11-2.11.19-3,.3-6,.55-9.09.7-1.41.08-2.83.12-4.25.16-2,0-4,.09-6,.08-1.56,0-3.13,0-4.69-.08-1.73,0-3.45-.12-5.18-.21s-3.26-.21-4.89-.35-3.2-.28-4.79-.46-3.29-.39-4.93-.61-3.17-.46-4.75-.72-3.14-.55-4.7-.86-3.38-.68-5.05-1.06c-1.45-.33-2.88-.68-4.31-1.05q-2.91-.75-5.77-1.61c-1.24-.38-2.48-.75-3.71-1.16-3.62-1.19-7.19-2.47-10.6-3.93l-.16-.06q-4.2-1.8-8.17-3.86l-2.21,94.84q4,2.05,8.17,3.86h0l.14,0c3.41,1.46,7,2.74,10.6,3.94.44.14.84.33,1.28.47.79.25,1.63.44,2.43.68,1.91.57,3.82,1.11,5.77,1.61.7.18,1.36.41,2.06.58s1.51.3,2.25.47q2.5.57,5.05,1.06c.83.17,1.63.37,2.46.52s1.5.22,2.24.34c1.58.26,3.16.5,4.75.72.87.12,1.73.28,2.61.39s1.55.14,2.31.22c1.6.18,3.2.33,4.8.46.87.07,1.73.19,2.6.25s1.53.05,2.29.1c1.73.1,3.45.16,5.18.21.88,0,1.76.1,2.64.11.68,0,1.37,0,2,0,2,0,4,0,6-.08.93,0,1.88,0,2.81,0,.48,0,1-.09,1.44-.11,3-.16,6.07-.4,9.08-.71.6-.06,1.22-.08,1.82-.14l.3-.05c4.81-.56,9.52-1.35,14.15-2.29.51-.11,1-.15,1.55-.25s1.1-.29,1.66-.42c1.89-.42,3.73-.9,5.57-1.39,1.32-.35,2.64-.68,3.93-1.07,1.88-.56,3.71-1.18,5.54-1.81,1.17-.41,2.37-.79,3.52-1.23,2-.74,3.85-1.56,5.73-2.39.93-.42,1.9-.79,2.81-1.22q4.13-2,7.93-4.19l312-184.72c.5-.29,1-.59,1.47-.89,1.16-.72,2.21-1.47,3.29-2.22.57-.39,1.18-.76,1.73-1.16,1.79-1.3,3.48-2.63,5-4l0,0a57,57,0,0,0,5.31-5.37c.16-.18.37-.35.52-.53.37-.44.63-.9,1-1.34.84-1.06,1.64-2.13,2.36-3.21.2-.31.48-.61.67-.92s.42-.83.65-1.25c.55-1,1.05-1.9,1.51-2.87.18-.39.44-.78.61-1.17s.23-.74.38-1.11c.37-1,.68-1.89,1-2.85.13-.45.35-.9.46-1.36s.09-.64.15-1c.22-1,.37-2,.49-3,.06-.51.2-1,.24-1.51s.07-1.08.08-1.61l2.21-94.84A30,30,0,0,1,940.06,691.21Z" class="cls-3"></path><path d="M532.07,927.64c-26.41,0-53.1-5.46-74.08-16.43L115.49,733.62c-21.78-11.38-36.57-26.71-35-43.21.91-9.58,2.29-13.43,4.38-16.81.6,11.2.36,18,4.94,26.61,5.3,9.64,17.55,19.11,29.8,25.51L461.22,899.05c40.89,21.39,104.5,20.83,141.79-1.26L921,720.41,607.22,909.73C587.09,921.64,559.74,927.64,532.07,927.64Z" class="cls-4"></path><polygon points="323.8 721.71 576.21 733.33 546.85 581.36 309.01 712.21 323.8 721.71" class="cls-5"></polygon><path d="M940.25,687,654.1,784.48l21.59-25.09L837,609l69.71,36.42a97.68,97.68,0,0,1,10.72,6.46c11,7.75,18,16.72,21.06,25.85A36,36,0,0,1,940.25,687Z" class="cls-5"></path><path d="M470.48,536.78,240.3,658.05l2-504L456.11,87.88c12.68-3.89,25.95,4.06,25.95,18.6L482,517.67A21.61,21.61,0,0,1,470.48,536.78Z" class="cls-6"></path><path d="M499.11,544.62,268.92,665.89l2-504L484.74,95.72c13.49-3.6,25.95,4.06,25.95,18.6l-.05,411.19A21.61,21.61,0,0,1,499.11,544.62Z" class="cls-7"></path><path d="M525.16,555.79,295,677.06l2-504,213.78-66.14c12.48-3.26,26,4.06,26,18.61l0,411.19A21.6,21.6,0,0,1,525.16,555.79Z" class="cls-8"></path><path d="M561.71,570,331.53,691.27V185.2l213.78-66.13a21.6,21.6,0,0,1,28,20.64l0,411.18A21.59,21.59,0,0,1,561.71,570Z" class="cls-9"></path><path d="M591.16,581.67,361.84,709.4,363,198.91l213.79-66.14c11.86-6.33,26,4.06,26,18.61l0,411.19A21.59,21.59,0,0,1,591.16,581.67Z" class="cls-10"></path><path d="M327.48,720.89l-92.25-47.8a27.9,27.9,0,0,1-15.07-24.77V178.72a27.91,27.91,0,0,1,37.72-26.12l92.3,34.67a27.92,27.92,0,0,1,18.09,26.13l0,482.72A27.9,27.9,0,0,1,327.48,720.89Z" class="cls-11"></path><path d="M325.23,281.58l-67.49-27.51a12.89,12.89,0,0,1-8-11.95v-9.2a8.09,8.09,0,0,1,11.14-7.49l67.49,27.47a12.9,12.9,0,0,1,8,12v9.24A8.1,8.1,0,0,1,325.23,281.58Z" class="cls-12"></path><path d="M325.23,359.22l-67.49-27.51a12.89,12.89,0,0,1-8-11.95v-9.2a8.09,8.09,0,0,1,11.14-7.49l67.49,27.47a12.9,12.9,0,0,1,8,11.95v9.24A8.1,8.1,0,0,1,325.23,359.22Z" class="cls-13"></path><path d="M325.23,442.32l-67.49-27.51a12.89,12.89,0,0,1-8-11.95v-9.2a8.09,8.09,0,0,1,11.14-7.49l67.49,27.47a12.9,12.9,0,0,1,8,11.95v9.24A8.1,8.1,0,0,1,325.23,442.32Z" class="cls-14"></path><path d="M738.54,604.82,564.05,772.07,386.33,372.57,554.67,260.48A30.63,30.63,0,0,1,598.23,273L744.8,569.11A30.63,30.63,0,0,1,738.54,604.82Z" class="cls-15"></path><path d="M774.78,601.73,600.28,769,427.92,363.46l163-106.08a30.64,30.64,0,0,1,43.56,12.48L781,566A30.65,30.65,0,0,1,774.78,601.73Z" class="cls-16"></path><path d="M808.29,602.61,633.8,769.86,456.43,367.42l168-109.15A30.64,30.64,0,0,1,668,270.75L814.55,566.9A30.63,30.63,0,0,1,808.29,602.61Z" class="cls-17"></path><path d="M844.16,608.06,669.67,775.31l-180.31-406,170.93-105.6a30.64,30.64,0,0,1,43.57,12.48L850.42,572.35A30.63,30.63,0,0,1,844.16,608.06Z" class="cls-18"></path><path d="M654.31,785.22,564,780.42a24.28,24.28,0,0,1-20.84-14.24L379.39,403.61a27.33,27.33,0,0,1,21-38.3l80.31-11.46a24.28,24.28,0,0,1,23.73,14.22L677.73,750.94A24.29,24.29,0,0,1,654.31,785.22Z" class="cls-19"></path><path d="M521.48,493.92l-63,2.4a13.62,13.62,0,0,1-12.92-8l-3.12-6.89a6.27,6.27,0,0,1,5.47-8.85l62.95-2.42a13.59,13.59,0,0,1,12.92,8l3.13,6.92A6.27,6.27,0,0,1,521.48,493.92Z" class="cls-20"></path><path d="M494.88,437.6l-64.29,2.45a10,10,0,0,1-9.5-5.88l-3.67-8.11a7,7,0,0,1,6.1-9.88l64.28-2.47a10,10,0,0,1,9.51,5.87l3.68,8.14A7,7,0,0,1,494.88,437.6Z" class="cls-21"></path></svg>';var Dm=Object.defineProperty,Om=Object.getOwnPropertyDescriptor,Il=(e,t,r,i)=>{for(var o=i>1?void 0:i?Om(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Dm(t,r,o),o};let so=class extends T{constructor(){super(...arguments),this.open=!1,this._onKeydown=e=>{this.open&&e.key==="Escape"&&(e.preventDefault(),this._close())}}connectedCallback(){super.connectedCallback(),this._unsub=b.subscribe(()=>this.requestUpdate()),document.addEventListener("keydown",this._onKeydown)}disconnectedCallback(){var e;(e=this._unsub)==null||e.call(this),document.removeEventListener("keydown",this._onKeydown),super.disconnectedCallback()}_close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}_formatRelative(e){const t=Math.max(0,Math.floor(Date.now()/1e3-e));return t<60?`${t}s 前`:t<3600?`${Math.floor(t/60)}m 前`:t<86400?`${Math.floor(t/3600)}h 前`:`${Math.floor(t/86400)}d 前`}_renderList(e){return e.length===0?a`<div class="empty">暂无近期文件变化</div>`:a`
      <div class="list">
        ${[...e].reverse().map(t=>a`
            <div class="item">
              <span class="path">${t.path}</span>
              <span class="ts">${this._formatRelative(t.ts)}</span>
            </div>
          `)}
      </div>
    `}render(){if(!this.open)return k;const e=b.getState().watchRecentChanges;return a`
      <div class="scrim" @click=${this._close}></div>
      <dialog open>
        <div class="head">
          <h3>📁 近期文件变化</h3>
          <button class="close-btn" type="button" @click=${this._close} aria-label="关闭">✕</button>
        </div>
        ${this._renderList(e)}
      </dialog>
    `}};so.styles=S`
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
  `;Il([h({type:Boolean,reflect:!0})],so.prototype,"open",2);so=Il([P("watch-changes-dialog")],so);var Im=Object.defineProperty,zm=Object.getOwnPropertyDescriptor,ar=(e,t,r,i)=>{for(var o=i>1?void 0:i?zm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Im(t,r,o),o};let nt=class extends T{constructor(){super(...arguments),this.activeView="search",this._menuOpen=!1,this._showSaveAndRevert=!1,this._showLogout=!1,this._watchDialogOpen=!1,this._refreshing=!1,this._onWatchReindexed=e=>{var o,s;const t=e.detail,r=(o=this.shadowRoot)==null?void 0:o.querySelector("toast-stack"),i=t==null?void 0:t.doc_count;(s=r==null?void 0:r.pushToast)==null||s.call(r,i!=null?`索引已更新：${i} 文档`:"索引已更新","success",3e3)},this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_onAvatarClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onRefreshClick(){this._refreshing||(this._refreshing=!0,window.setTimeout(()=>{window.location.reload()},400))}_onScopeSelect(e){this._menuOpen=!1,this.dispatchEvent(new CustomEvent("navigate",{detail:{view:"settings",scope:e},bubbles:!0,composed:!0}))}_onRevertClick(){this._menuOpen=!1,window.dispatchEvent(new CustomEvent("cortex:revert-settings"))}_onReindexClick(){b.getState().reindex.dialog==="closed"&&(this._menuOpen=!1,g.openReindexConfirm())}async _onLogoutClick(){this._menuOpen=!1;try{await Qa()}catch{}g.setAuthState({authenticated:!1}),qt.navigate("login")}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick),window.addEventListener("cortex:watch-reindexed",this._onWatchReindexed),this._syncFromStore(),this._unsubStore=b.subscribe(()=>this._syncFromStore())}disconnectedCallback(){var e;document.removeEventListener("click",this._onDocClick),window.removeEventListener("cortex:watch-reindexed",this._onWatchReindexed),(e=this._unsubStore)==null||e.call(this),super.disconnectedCallback()}_syncFromStore(){const e=b.getState();this._showSaveAndRevert=e.view==="settings"&&e.settings.dirty,this._showLogout=e.auth.required===!0&&e.auth.authenticated,this.requestUpdate()}_openWatchDialog(){this._watchDialogOpen=!0}_renderSyncBadge(e){if(!e||!e.running&&!e.message)return k;const t=e.message!==""||e.last_success===!1,r=t?"warn":"dot",i=t?`⚠${e.message||"同步失败"}`:"●同步";return a`
      <span
        class="watch-badge sync-badge ${r}"
        role="status"
        aria-label="Git 同步状态"
        title=${e.message||"知识库 Git 同步运行中"}
      ><doclens-icon name="globe"></doclens-icon>${i}</span>
    `}_renderWatchBadge(e){const t=e==null?void 0:e.last_doc_count,r=t!=null?` ${t}`:"";let i="",o="";return!e||!e.running?(i="",o=`${r} ○监控关`):e.reindexing?(i="busy",o=`${r} ⟳更新中…`):e.changed_count>0?(i="warn",o=`${r} ·待更新 ${e.changed_count}`):(i=e.last_success===!1?"warn":"dot",o=`${r} ●监控`),a`
      <button
        class="watch-badge ${i}"
        type="button"
        aria-label="文件监控状态"
        title="点击查看近期文件变化"
        @click=${this._openWatchDialog}
      ><doclens-icon name="folder"></doclens-icon>${o}</button>
    `}render(){return a`
      <div class="brand">
        <span class="logo">${bl(Am)}</span>
        <span>Doclens</span>
      </div>
      <div class="right-cluster">
        ${this._renderSyncBadge(b.getState().syncStatus)}
        ${this._renderWatchBadge(b.getState().watcher)}
        <button
          class="refresh-btn ${this._refreshing?"spinning":""}"
          type="button"
          aria-label="刷新"
          title="刷新"
          ?disabled=${this._refreshing}
          @click=${this._onRefreshClick}
        >
          <doclens-icon class="icon" name="refresh-cw" aria-hidden="true"></doclens-icon>
        </button>
        <button class="avatar-btn" @click=${this._onAvatarClick} aria-label="用户菜单">
          <span class="avatar">L</span>
        </button>
        <div class="user-menu ${this._menuOpen?"open":""}">
          <div class="menu-header">
            <div style="font-size: var(--cortex-fs-sm); font-weight: 500;">Liang</div>
            <div class="email">liang@example.com</div>
          </div>
          <button class="menu-item" type="button" @click=${()=>this._onScopeSelect("global")}>
            <doclens-icon class="icon" name="globe"></doclens-icon>
            <span class="text">
              <span class="label">全局配置</span>
              <span class="desc">所有项目共用</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${this._onReindexClick}>
            <doclens-icon class="icon" name="refresh-ccw"></doclens-icon>
            <span class="text">
              <span class="label">强制重建索引</span>
              <span class="desc">全量重扫工作目录</span>
            </span>
          </button>
          ${this._showSaveAndRevert?a`
            <button class="menu-item" type="button" @click=${this._onRevertClick}>
              <doclens-icon class="icon" name="rotate-ccw"></doclens-icon>
              <span class="text">
                <span class="label">放弃修改</span>
                <span class="desc">恢复到 .env 当前值</span>
              </span>
            </button>
          `:k}
          ${this._showLogout?a`
            <button class="menu-item" type="button" data-testid="logout-item" @click=${this._onLogoutClick}>
              <span class="icon">⏻</span>
              <span class="text">
                <span class="label">注销登录</span>
                <span class="desc">结束当前会话，返回登录页</span>
              </span>
            </button>
          `:k}
        </div>
      </div>
      <toast-stack></toast-stack>
      <watch-changes-dialog
        .open=${this._watchDialogOpen}
        @close=${()=>{this._watchDialogOpen=!1}}
      ></watch-changes-dialog>
    `}};nt.styles=S`
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
      /* 移动端右侧空间紧张：watch-badge 隐藏（刷新按钮已显示状态）。 */
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
  `;ar([h()],nt.prototype,"activeView",2);ar([m()],nt.prototype,"_menuOpen",2);ar([m()],nt.prototype,"_showSaveAndRevert",2);ar([m()],nt.prototype,"_showLogout",2);ar([m()],nt.prototype,"_watchDialogOpen",2);ar([m()],nt.prototype,"_refreshing",2);nt=ar([P("app-bar")],nt);var Rm=Object.getOwnPropertyDescriptor,Lm=(e,t,r,i)=>{for(var o=i>1?void 0:i?Rm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=n(o)||o);return o};let bs=class extends T{constructor(){super(...arguments),this._abort=null}connectedCallback(){super.connectedCallback(),this._unsub=b.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e,t;(e=this._abort)==null||e.abort(),(t=this._unsub)==null||t.call(this),super.disconnectedCallback()}_pushToast(e,t="info",r=2500){var o;const i=(o=this.shadowRoot)==null?void 0:o.querySelector("toast-stack");i==null||i.pushToast(e,t,r)}_confirm(){g.startReindex(),this._runReindex()}_close(){var e;(e=this._abort)==null||e.abort(),g.closeReindex()}async _runReindex(){var e;this._abort=new AbortController;try{for await(const t of Ps("/api/reindex",{},this._abort.signal)){if(this._abort.signal.aborted)break;if(t.event==="progress"){const r=JSON.parse(t.data);g.setReindexProgress({current_file:r.current_file,indexed_count:r.indexed_count})}else if(t.event==="done"){const r=JSON.parse(t.data);r.success?(g.finishReindex({success:r.success,doc_count:r.doc_count,failed_count:r.failed_count}),this._pushToast(`索引重建完成：${r.doc_count} 文档`,"success",3e3)):g.failReindex(r.failed_count>0?`重建失败：${r.failed_count} 个文件失败`:"重建失败");break}else if(t.event==="error"){const r=JSON.parse(t.data);g.failReindex(r.detail||"重建失败");break}}}catch(t){(e=this._abort)!=null&&e.signal.aborted||g.failReindex(t.message||"重建失败")}}_renderBody(e){if(e.dialog==="confirm")return a`
        <h3><doclens-icon name="refresh-ccw"></doclens-icon> 强制重建索引</h3>
        <div class="body"><doclens-icon name="alert-triangle"></doclens-icon> 将清空当前索引并全量重扫工作目录，期间（数十秒）搜索结果可能不完整。是否继续？</div>
        <div class="actions">
          <button @click=${()=>g.closeReindex()}>取消</button>
          <button class="warn" @click=${this._confirm}>确认重建</button>
        </div>
      `;if(e.dialog==="running")return a`
        <h3><doclens-icon name="refresh-cw"></doclens-icon> 正在重建索引…</h3>
        <div class="body">已索引 <strong>${e.indexed_count}</strong> 个文件</div>
        ${e.current_file?a`<div class="progress">当前：${e.current_file}</div>`:""}
        <div class="actions">
          <button @click=${this._close}>关闭（后台继续）</button>
        </div>
      `;if(e.dialog==="done"){const t=e.result;return a`
        <h3><doclens-icon name="check"></doclens-icon> 重建完成</h3>
        <div class="body">
          共索引 <strong>${(t==null?void 0:t.doc_count)??0}</strong> 个文档
          ${t&&t.failed_count>0?a`<br />· ${t.failed_count} 个文件失败`:""}
        </div>
        <div class="actions">
          <button class="primary" @click=${this._close}>关闭</button>
        </div>
      `}return a`
      <h3><doclens-icon name="alert-triangle"></doclens-icon> 重建失败</h3>
      <div class="body">${e.error||"未知错误"}</div>
      <div class="actions">
        <button class="primary" @click=${this._close}>关闭</button>
      </div>
    `}render(){const e=b.getState().reindex;return e.dialog==="closed"?a`<toast-stack></toast-stack>`:a`
      <dialog open>${this._renderBody(e)}</dialog>
      <toast-stack></toast-stack>
    `}};bs.styles=S`
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
  `;bs=Lm([P("reindex-dialog")],bs);const Mm=3e3;let kt=null,wr=!0,ii=null;function Aa(e){try{return JSON.parse(e||"{}")}catch{return null}}function Nm(e){g.setWatcherStatus(e.watcher??null),g.setWatchRecentChanges(e.recent_changes??[]),g.setSyncStatus(e.sync??null)}function Fm(e){window.dispatchEvent(new CustomEvent("cortex:watch-reindexed",{detail:{doc_count:e.doc_count??null}}))}function Bm(e){return new Promise(t=>{ii=window.setTimeout(()=>{ii=null,t()},e)})}async function jm(){for(;!wr;){try{const e=kt==null?void 0:kt.signal;if(!e)return;for await(const t of Ps("/api/watch/events",{},e)){if(wr)break;if(t.event==="status"){const r=Aa(t.data);r&&Nm(r)}else if(t.event==="reindexed"){const r=Aa(t.data);r&&Fm(r)}}}catch{}if(wr)return;await Bm(Mm)}}function Hm(){wr&&(wr=!1,kt=new AbortController,jm())}function Um(){wr=!0,ii!==null&&(window.clearTimeout(ii),ii=null),kt==null||kt.abort(),kt=null}var Wm=Object.defineProperty,Vm=Object.getOwnPropertyDescriptor,zl=(e,t,r,i)=>{for(var o=i>1?void 0:i?Vm(t,r):t,s=e.length-1,n;s>=0;s--)(n=e[s])&&(o=(i?n(t,r,o):n(o))||o);return i&&o&&Wm(t,r,o),o};let no=class extends T{constructor(){super(...arguments),this._mainStarted=!1,this._mountedViews=new Set}willUpdate(){const e=b.getState().view;e!=="login"&&!this._mountedViews.has(e)&&(this._mountedViews=new Set(this._mountedViews).add(e))}connectedCallback(){super.connectedCallback(),qt.init(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),Vn(()=>{b.getState().view!=="login"&&(g.setAuthState({authenticated:!1}),qt.navigate("login"))}),this._unsubAuth=b.subscribeSelector(e=>e.auth.authenticated,e=>{e&&this._startMain()}),this._probeAuth()}async _probeAuth(){try{const e=await Ja();if(g.setAuthState({required:e.required,authenticated:e.authenticated,hasPassword:e.has_password}),e.required&&!e.authenticated){qt.navigate("login");return}}catch{g.setAuthState({required:!1,authenticated:!0})}this._startMain()}_startMain(){this._mainStarted||(this._mainStarted=!0,Hm(),this._loadStatus())}async _loadStatus(){try{const e=await Za();g.setStatus(e),e.sync!==void 0&&g.setSyncStatus(e.sync??null)}catch{}}disconnectedCallback(){var e,t;(e=this._unsubscribe)==null||e.call(this),(t=this._unsubAuth)==null||t.call(this),Vn(null),Um(),super.disconnectedCallback()}_navigate(e){qt.navigate(e.detail.view),e.detail.view==="settings"&&e.detail.scope&&g.setSettingsScope(e.detail.scope)}_renderView(){const e=b.getState().view;return a`
      ${this._mountedViews.has("search")?a`<search-view ?hidden=${e!=="search"}></search-view>`:null}
      ${this._mountedViews.has("chat")?a`<chat-view ?hidden=${e!=="chat"}></chat-view>`:null}
      ${this._mountedViews.has("files")?a`<files-view ?hidden=${e!=="files"}></files-view>`:null}
      ${this._mountedViews.has("diary")?a`<diary-view ?hidden=${e!=="diary"}></diary-view>`:null}
      ${this._mountedViews.has("settings")?a`<settings-view ?hidden=${e!=="settings"}></settings-view>`:null}
    `}render(){const e=b.getState().view;return e==="login"?a`<login-view></login-view>`:a`
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
    `}};no.styles=S`
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
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;zl([m()],no.prototype,"_mountedViews",2);no=zl([P("cortex-app")],no);
