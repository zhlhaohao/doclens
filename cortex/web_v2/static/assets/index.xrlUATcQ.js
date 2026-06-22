var gi=Object.defineProperty;var vi=(t,e,r)=>e in t?gi(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r;var T=(t,e,r)=>vi(t,typeof e!="symbol"?e+"":e,r);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function r(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(s){if(s.ep)return;s.ep=!0;const o=r(s);fetch(s.href,o)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Pe=globalThis,_r=Pe.ShadowRoot&&(Pe.ShadyCSS===void 0||Pe.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,wr=Symbol(),Xr=new WeakMap;let Ps=class{constructor(e,r,i){if(this._$cssResult$=!0,i!==wr)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=r}get styleSheet(){let e=this.o;const r=this.t;if(_r&&e===void 0){const i=r!==void 0&&r.length===1;i&&(e=Xr.get(r)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),i&&Xr.set(r,e))}return e}toString(){return this.cssText}};const mi=t=>new Ps(typeof t=="string"?t:t+"",void 0,wr),y=(t,...e)=>{const r=t.length===1?t[0]:e.reduce((i,s,o)=>i+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+t[o+1],t[0]);return new Ps(r,t,wr)},xi=(t,e)=>{if(_r)t.adoptedStyleSheets=e.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of e){const i=document.createElement("style"),s=Pe.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=r.cssText,t.appendChild(i)}},Gr=_r?t=>t:t=>t instanceof CSSStyleSheet?(e=>{let r="";for(const i of e.cssRules)r+=i.cssText;return mi(r)})(t):t;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:yi,defineProperty:_i,getOwnPropertyDescriptor:wi,getOwnPropertyNames:ki,getOwnPropertySymbols:$i,getPrototypeOf:Si}=Object,ct=globalThis,Zr=ct.trustedTypes,Ci=Zr?Zr.emptyScript:"",Je=ct.reactiveElementPolyfillSupport,se=(t,e)=>t,Bt={toAttribute(t,e){switch(e){case Boolean:t=t?Ci:null;break;case Object:case Array:t=t==null?t:JSON.stringify(t)}return t},fromAttribute(t,e){let r=t;switch(e){case Boolean:r=t!==null;break;case Number:r=t===null?null:Number(t);break;case Object:case Array:try{r=JSON.parse(t)}catch{r=null}}return r}},kr=(t,e)=>!yi(t,e),Yr={attribute:!0,type:String,converter:Bt,reflect:!1,useDefault:!1,hasChanged:kr};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),ct.litPropertyMetadata??(ct.litPropertyMetadata=new WeakMap);let Lt=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??(this.l=[])).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,r=Yr){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(e,r),!r.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(e,i,r);s!==void 0&&_i(this.prototype,e,s)}}static getPropertyDescriptor(e,r,i){const{get:s,set:o}=wi(this.prototype,e)??{get(){return this[r]},set(a){this[r]=a}};return{get:s,set(a){const l=s==null?void 0:s.call(this);o==null||o.call(this,a),this.requestUpdate(e,l,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Yr}static _$Ei(){if(this.hasOwnProperty(se("elementProperties")))return;const e=Si(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(se("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(se("properties"))){const r=this.properties,i=[...ki(r),...$i(r)];for(const s of i)this.createProperty(s,r[s])}const e=this[Symbol.metadata];if(e!==null){const r=litPropertyMetadata.get(e);if(r!==void 0)for(const[i,s]of r)this.elementProperties.set(i,s)}this._$Eh=new Map;for(const[r,i]of this.elementProperties){const s=this._$Eu(r,i);s!==void 0&&this._$Eh.set(s,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){const r=[];if(Array.isArray(e)){const i=new Set(e.flat(1/0).reverse());for(const s of i)r.unshift(Gr(s))}else e!==void 0&&r.push(Gr(e));return r}static _$Eu(e,r){const i=r.attribute;return i===!1?void 0:typeof i=="string"?i:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var e;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(e=this.constructor.l)==null||e.forEach(r=>r(this))}addController(e){var r;(this._$EO??(this._$EO=new Set)).add(e),this.renderRoot!==void 0&&this.isConnected&&((r=e.hostConnected)==null||r.call(e))}removeController(e){var r;(r=this._$EO)==null||r.delete(e)}_$E_(){const e=new Map,r=this.constructor.elementProperties;for(const i of r.keys())this.hasOwnProperty(i)&&(e.set(i,this[i]),delete this[i]);e.size>0&&(this._$Ep=e)}createRenderRoot(){const e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return xi(e,this.constructor.elementStyles),e}connectedCallback(){var e;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(e=this._$EO)==null||e.forEach(r=>{var i;return(i=r.hostConnected)==null?void 0:i.call(r)})}enableUpdating(e){}disconnectedCallback(){var e;(e=this._$EO)==null||e.forEach(r=>{var i;return(i=r.hostDisconnected)==null?void 0:i.call(r)})}attributeChangedCallback(e,r,i){this._$AK(e,i)}_$ET(e,r){var o;const i=this.constructor.elementProperties.get(e),s=this.constructor._$Eu(e,i);if(s!==void 0&&i.reflect===!0){const a=(((o=i.converter)==null?void 0:o.toAttribute)!==void 0?i.converter:Bt).toAttribute(r,i.type);this._$Em=e,a==null?this.removeAttribute(s):this.setAttribute(s,a),this._$Em=null}}_$AK(e,r){var o,a;const i=this.constructor,s=i._$Eh.get(e);if(s!==void 0&&this._$Em!==s){const l=i.getPropertyOptions(s),n=typeof l.converter=="function"?{fromAttribute:l.converter}:((o=l.converter)==null?void 0:o.fromAttribute)!==void 0?l.converter:Bt;this._$Em=s;const h=n.fromAttribute(r,l.type);this[s]=h??((a=this._$Ej)==null?void 0:a.get(s))??h,this._$Em=null}}requestUpdate(e,r,i,s=!1,o){var a;if(e!==void 0){const l=this.constructor;if(s===!1&&(o=this[e]),i??(i=l.getPropertyOptions(e)),!((i.hasChanged??kr)(o,r)||i.useDefault&&i.reflect&&o===((a=this._$Ej)==null?void 0:a.get(e))&&!this.hasAttribute(l._$Eu(e,i))))return;this.C(e,r,i)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,r,{useDefault:i,reflect:s,wrapped:o},a){i&&!(this._$Ej??(this._$Ej=new Map)).has(e)&&(this._$Ej.set(e,a??r??this[e]),o!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||i||(r=void 0),this._$AL.set(e,r)),s===!0&&this._$Em!==e&&(this._$Eq??(this._$Eq=new Set)).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var i;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[o,a]of this._$Ep)this[o]=a;this._$Ep=void 0}const s=this.constructor.elementProperties;if(s.size>0)for(const[o,a]of s){const{wrapped:l}=a,n=this[o];l!==!0||this._$AL.has(o)||n===void 0||this.C(o,void 0,a,n)}}let e=!1;const r=this._$AL;try{e=this.shouldUpdate(r),e?(this.willUpdate(r),(i=this._$EO)==null||i.forEach(s=>{var o;return(o=s.hostUpdate)==null?void 0:o.call(s)}),this.update(r)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(r)}willUpdate(e){}_$AE(e){var r;(r=this._$EO)==null||r.forEach(i=>{var s;return(s=i.hostUpdated)==null?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(e){}firstUpdated(e){}};Lt.elementStyles=[],Lt.shadowRootOptions={mode:"open"},Lt[se("elementProperties")]=new Map,Lt[se("finalized")]=new Map,Je==null||Je({ReactiveElement:Lt}),(ct.reactiveElementVersions??(ct.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ie=globalThis,Qr=t=>t,Oe=ie.trustedTypes,Jr=Oe?Oe.createPolicy("lit-html",{createHTML:t=>t}):void 0,Ts="$lit$",lt=`lit$${Math.random().toFixed(9).slice(2)}$`,zs="?"+lt,Ei=`<${zs}>`,$t=document,oe=()=>$t.createComment(""),ae=t=>t===null||typeof t!="object"&&typeof t!="function",$r=Array.isArray,Ai=t=>$r(t)||typeof(t==null?void 0:t[Symbol.iterator])=="function",tr=`[ 	
\f\r]`,Kt=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ts=/-->/g,es=/>/g,bt=RegExp(`>|${tr}(?:([^\\s"'>=/]+)(${tr}*=${tr}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),rs=/'/g,ss=/"/g,Os=/^(?:script|style|textarea|title)$/i,Pi=t=>(e,...r)=>({_$litType$:t,strings:e,values:r}),c=Pi(1),Y=Symbol.for("lit-noChange"),w=Symbol.for("lit-nothing"),is=new WeakMap,wt=$t.createTreeWalker($t,129);function Ds(t,e){if(!$r(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return Jr!==void 0?Jr.createHTML(e):e}const Ti=(t,e)=>{const r=t.length-1,i=[];let s,o=e===2?"<svg>":e===3?"<math>":"",a=Kt;for(let l=0;l<r;l++){const n=t[l];let h,u,f=-1,v=0;for(;v<n.length&&(a.lastIndex=v,u=a.exec(n),u!==null);)v=a.lastIndex,a===Kt?u[1]==="!--"?a=ts:u[1]!==void 0?a=es:u[2]!==void 0?(Os.test(u[2])&&(s=RegExp("</"+u[2],"g")),a=bt):u[3]!==void 0&&(a=bt):a===bt?u[0]===">"?(a=s??Kt,f=-1):u[1]===void 0?f=-2:(f=a.lastIndex-u[2].length,h=u[1],a=u[3]===void 0?bt:u[3]==='"'?ss:rs):a===ss||a===rs?a=bt:a===ts||a===es?a=Kt:(a=bt,s=void 0);const k=a===bt&&t[l+1].startsWith("/>")?" ":"";o+=a===Kt?n+Ei:f>=0?(i.push(h),n.slice(0,f)+Ts+n.slice(f)+lt+k):n+lt+(f===-2?l:k)}return[Ds(t,o+(t[r]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),i]};class ne{constructor({strings:e,_$litType$:r},i){let s;this.parts=[];let o=0,a=0;const l=e.length-1,n=this.parts,[h,u]=Ti(e,r);if(this.el=ne.createElement(h,i),wt.currentNode=this.el.content,r===2||r===3){const f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(s=wt.nextNode())!==null&&n.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(const f of s.getAttributeNames())if(f.endsWith(Ts)){const v=u[a++],k=s.getAttribute(f).split(lt),g=/([.?@])?(.*)/.exec(v);n.push({type:1,index:o,name:g[2],strings:k,ctor:g[1]==="."?Oi:g[1]==="?"?Di:g[1]==="@"?Li:He}),s.removeAttribute(f)}else f.startsWith(lt)&&(n.push({type:6,index:o}),s.removeAttribute(f));if(Os.test(s.tagName)){const f=s.textContent.split(lt),v=f.length-1;if(v>0){s.textContent=Oe?Oe.emptyScript:"";for(let k=0;k<v;k++)s.append(f[k],oe()),wt.nextNode(),n.push({type:2,index:++o});s.append(f[v],oe())}}}else if(s.nodeType===8)if(s.data===zs)n.push({type:2,index:o});else{let f=-1;for(;(f=s.data.indexOf(lt,f+1))!==-1;)n.push({type:7,index:o}),f+=lt.length-1}o++}}static createElement(e,r){const i=$t.createElement("template");return i.innerHTML=e,i}}function Nt(t,e,r=t,i){var a,l;if(e===Y)return e;let s=i!==void 0?(a=r._$Co)==null?void 0:a[i]:r._$Cl;const o=ae(e)?void 0:e._$litDirective$;return(s==null?void 0:s.constructor)!==o&&((l=s==null?void 0:s._$AO)==null||l.call(s,!1),o===void 0?s=void 0:(s=new o(t),s._$AT(t,r,i)),i!==void 0?(r._$Co??(r._$Co=[]))[i]=s:r._$Cl=s),s!==void 0&&(e=Nt(t,s._$AS(t,e.values),s,i)),e}class zi{constructor(e,r){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){const{el:{content:r},parts:i}=this._$AD,s=((e==null?void 0:e.creationScope)??$t).importNode(r,!0);wt.currentNode=s;let o=wt.nextNode(),a=0,l=0,n=i[0];for(;n!==void 0;){if(a===n.index){let h;n.type===2?h=new ve(o,o.nextSibling,this,e):n.type===1?h=new n.ctor(o,n.name,n.strings,this,e):n.type===6&&(h=new Ri(o,this,e)),this._$AV.push(h),n=i[++l]}a!==(n==null?void 0:n.index)&&(o=wt.nextNode(),a++)}return wt.currentNode=$t,s}p(e){let r=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(e,i,r),r+=i.strings.length-2):i._$AI(e[r])),r++}}class ve{get _$AU(){var e;return((e=this._$AM)==null?void 0:e._$AU)??this._$Cv}constructor(e,r,i,s){this.type=2,this._$AH=w,this._$AN=void 0,this._$AA=e,this._$AB=r,this._$AM=i,this.options=s,this._$Cv=(s==null?void 0:s.isConnected)??!0}get parentNode(){let e=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(e==null?void 0:e.nodeType)===11&&(e=r.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,r=this){e=Nt(this,e,r),ae(e)?e===w||e==null||e===""?(this._$AH!==w&&this._$AR(),this._$AH=w):e!==this._$AH&&e!==Y&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Ai(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==w&&ae(this._$AH)?this._$AA.nextSibling.data=e:this.T($t.createTextNode(e)),this._$AH=e}$(e){var o;const{values:r,_$litType$:i}=e,s=typeof i=="number"?this._$AC(e):(i.el===void 0&&(i.el=ne.createElement(Ds(i.h,i.h[0]),this.options)),i);if(((o=this._$AH)==null?void 0:o._$AD)===s)this._$AH.p(r);else{const a=new zi(s,this),l=a.u(this.options);a.p(r),this.T(l),this._$AH=a}}_$AC(e){let r=is.get(e.strings);return r===void 0&&is.set(e.strings,r=new ne(e)),r}k(e){$r(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let i,s=0;for(const o of e)s===r.length?r.push(i=new ve(this.O(oe()),this.O(oe()),this,this.options)):i=r[s],i._$AI(o),s++;s<r.length&&(this._$AR(i&&i._$AB.nextSibling,s),r.length=s)}_$AR(e=this._$AA.nextSibling,r){var i;for((i=this._$AP)==null?void 0:i.call(this,!1,!0,r);e!==this._$AB;){const s=Qr(e).nextSibling;Qr(e).remove(),e=s}}setConnected(e){var r;this._$AM===void 0&&(this._$Cv=e,(r=this._$AP)==null||r.call(this,e))}}let He=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,r,i,s,o){this.type=1,this._$AH=w,this._$AN=void 0,this.element=e,this.name=r,this._$AM=s,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=w}_$AI(e,r=this,i,s){const o=this.strings;let a=!1;if(o===void 0)e=Nt(this,e,r,0),a=!ae(e)||e!==this._$AH&&e!==Y,a&&(this._$AH=e);else{const l=e;let n,h;for(e=o[0],n=0;n<o.length-1;n++)h=Nt(this,l[i+n],r,n),h===Y&&(h=this._$AH[n]),a||(a=!ae(h)||h!==this._$AH[n]),h===w?e=w:e!==w&&(e+=(h??"")+o[n+1]),this._$AH[n]=h}a&&!s&&this.j(e)}j(e){e===w?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Oi=class extends He{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===w?void 0:e}},Di=class extends He{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==w)}},Li=class extends He{constructor(e,r,i,s,o){super(e,r,i,s,o),this.type=5}_$AI(e,r=this){if((e=Nt(this,e,r,0)??w)===Y)return;const i=this._$AH,s=e===w&&i!==w||e.capture!==i.capture||e.once!==i.once||e.passive!==i.passive,o=e!==w&&(i===w||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,e):this._$AH.handleEvent(e)}},Ri=class{constructor(e,r,i){this.element=e,this.type=6,this._$AN=void 0,this._$AM=r,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(e){Nt(this,e)}};const er=ie.litHtmlPolyfillSupport;er==null||er(ne,ve),(ie.litHtmlVersions??(ie.litHtmlVersions=[])).push("3.3.3");const Ii=(t,e,r)=>{const i=(r==null?void 0:r.renderBefore)??e;let s=i._$litPart$;if(s===void 0){const o=(r==null?void 0:r.renderBefore)??null;i._$litPart$=s=new ve(e.insertBefore(oe(),o),o,void 0,r??{})}return s._$AI(t),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const kt=globalThis;let $=class extends Lt{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const e=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=e.firstChild),e}update(e){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Ii(r,this.renderRoot,this.renderOptions)}connectedCallback(){var e;super.connectedCallback(),(e=this._$Do)==null||e.setConnected(!0)}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._$Do)==null||e.setConnected(!1)}render(){return Y}};var As;$._$litElement$=!0,$.finalized=!0,(As=kt.litElementHydrateSupport)==null||As.call(kt,{LitElement:$});const rr=kt.litElementPolyfillSupport;rr==null||rr({LitElement:$});(kt.litElementVersions??(kt.litElementVersions=[])).push("4.2.2");var Bi=y`
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
`;const cr=new Set,Rt=new Map;let mt,Sr="ltr",Cr="en";const Ls=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(Ls){const t=new MutationObserver(Is);Sr=document.documentElement.dir||"ltr",Cr=document.documentElement.lang||navigator.language,t.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function Rs(...t){t.map(e=>{const r=e.$code.toLowerCase();Rt.has(r)?Rt.set(r,Object.assign(Object.assign({},Rt.get(r)),e)):Rt.set(r,e),mt||(mt=e)}),Is()}function Is(){Ls&&(Sr=document.documentElement.dir||"ltr",Cr=document.documentElement.lang||navigator.language),[...cr.keys()].map(t=>{typeof t.requestUpdate=="function"&&t.requestUpdate()})}let Ni=class{constructor(e){this.host=e,this.host.addController(this)}hostConnected(){cr.add(this.host)}hostDisconnected(){cr.delete(this.host)}dir(){return`${this.host.dir||Sr}`.toLowerCase()}lang(){return`${this.host.lang||Cr}`.toLowerCase()}getTranslationData(e){var r,i;let s;try{s=new Intl.Locale(e.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const o=s.language.toLowerCase(),a=(i=(r=s.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&i!==void 0?i:"",l=Rt.get(`${o}-${a}`),n=Rt.get(o);return{locale:s,language:o,region:a,primary:l,secondary:n}}exists(e,r){var i;const{primary:s,secondary:o}=this.getTranslationData((i=r.lang)!==null&&i!==void 0?i:this.lang());return r=Object.assign({includeFallback:!1},r),!!(s&&s[e]||o&&o[e]||r.includeFallback&&mt&&mt[e])}term(e,...r){const{primary:i,secondary:s}=this.getTranslationData(this.lang());let o;if(i&&i[e])o=i[e];else if(s&&s[e])o=s[e];else if(mt&&mt[e])o=mt[e];else return console.error(`No translation found for: ${String(e)}`),String(e);return typeof o=="function"?o(...r):o}date(e,r){return e=new Date(e),new Intl.DateTimeFormat(this.lang(),r).format(e)}number(e,r){return e=Number(e),isNaN(e)?"":new Intl.NumberFormat(this.lang(),r).format(e)}relativeTime(e,r,i){return new Intl.RelativeTimeFormat(this.lang(),i).format(e,r)}};var Bs={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(t,e)=>`Go to slide ${t} of ${e}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:t=>t===0?"No options selected":t===1?"1 option selected":`${t} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:t=>`Slide ${t}`,toggleColorFormat:"Toggle color format"};Rs(Bs);var Fi=Bs,Tt=class extends Ni{};Rs(Fi);var J=y`
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
`,Ns=Object.defineProperty,Mi=Object.defineProperties,ji=Object.getOwnPropertyDescriptor,Ui=Object.getOwnPropertyDescriptors,os=Object.getOwnPropertySymbols,Hi=Object.prototype.hasOwnProperty,Vi=Object.prototype.propertyIsEnumerable,sr=(t,e)=>(e=Symbol[t])?e:Symbol.for("Symbol."+t),Er=t=>{throw TypeError(t)},as=(t,e,r)=>e in t?Ns(t,e,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[e]=r,zt=(t,e)=>{for(var r in e||(e={}))Hi.call(e,r)&&as(t,r,e[r]);if(os)for(var r of os(e))Vi.call(e,r)&&as(t,r,e[r]);return t},Ar=(t,e)=>Mi(t,Ui(e)),p=(t,e,r,i)=>{for(var s=i>1?void 0:i?ji(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Ns(e,r,s),s},Fs=(t,e,r)=>e.has(t)||Er("Cannot "+r),qi=(t,e,r)=>(Fs(t,e,"read from private field"),e.get(t)),Wi=(t,e,r)=>e.has(t)?Er("Cannot add the same private member more than once"):e instanceof WeakSet?e.add(t):e.set(t,r),Ki=(t,e,r,i)=>(Fs(t,e,"write to private field"),e.set(t,r),r),Xi=function(t,e){this[0]=t,this[1]=e},Gi=t=>{var e=t[sr("asyncIterator")],r=!1,i,s={};return e==null?(e=t[sr("iterator")](),i=o=>s[o]=a=>e[o](a)):(e=e.call(t),i=o=>s[o]=a=>{if(r){if(r=!1,o==="throw")throw a;return a}return r=!0,{done:!1,value:new Xi(new Promise(l=>{var n=e[o](a);n instanceof Object||Er("Object expected"),l(n)}),1)}}),s[sr("iterator")]=()=>s,i("next"),"throw"in e?i("throw"):s.throw=o=>{throw o},"return"in e&&i("return"),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=t=>(e,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Zi={attribute:!0,type:String,converter:Bt,reflect:!1,hasChanged:kr},Yi=(t=Zi,e,r)=>{const{kind:i,metadata:s}=r;let o=globalThis.litPropertyMetadata.get(s);if(o===void 0&&globalThis.litPropertyMetadata.set(s,o=new Map),i==="setter"&&((t=Object.create(t)).wrapped=!0),o.set(r.name,t),i==="accessor"){const{name:a}=r;return{set(l){const n=e.get.call(this);e.set.call(this,l),this.requestUpdate(a,n,t,!0,l)},init(l){return l!==void 0&&this.C(a,void 0,t,l),l}}}if(i==="setter"){const{name:a}=r;return function(l){const n=this[a];e.call(this,l),this.requestUpdate(a,n,t,!0,l)}}throw Error("Unsupported decorator location: "+i)};function d(t){return(e,r)=>typeof r=="object"?Yi(t,e,r):((i,s,o)=>{const a=s.hasOwnProperty(o);return s.constructor.createProperty(o,i),a?Object.getOwnPropertyDescriptor(s,o):void 0})(t,e,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function x(t){return d({...t,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Qi(t){return(e,r)=>{const i=typeof e=="function"?e:e[r];Object.assign(i,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ji=(t,e,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof e!="object"&&Object.defineProperty(t,e,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function M(t,e){return(r,i,s)=>{const o=a=>{var l;return((l=a.renderRoot)==null?void 0:l.querySelector(t))??null};return Ji(r,i,{get(){return o(this)}})}}var Te,B=class extends ${constructor(){super(),Wi(this,Te,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([t,e])=>{this.constructor.define(t,e)})}emit(t,e){const r=new CustomEvent(t,zt({bubbles:!0,cancelable:!1,composed:!0,detail:{}},e));return this.dispatchEvent(r),r}static define(t,e=this,r={}){const i=customElements.get(t);if(!i){try{customElements.define(t,e,r)}catch{customElements.define(t,class extends e{},r)}return}let s=" (unknown version)",o=s;"version"in e&&e.version&&(s=" v"+e.version),"version"in i&&i.version&&(o=" v"+i.version),!(s&&o&&s===o)&&console.warn(`Attempted to register <${t}>${s}, but <${t}>${o} has already been registered.`)}attributeChangedCallback(t,e,r){qi(this,Te)||(this.constructor.elementProperties.forEach((i,s)=>{i.reflect&&this[s]!=null&&this.initialReflectedProperties.set(s,this[s])}),Ki(this,Te,!0)),super.attributeChangedCallback(t,e,r)}willUpdate(t){super.willUpdate(t),this.initialReflectedProperties.forEach((e,r)=>{t.has(r)&&this[r]==null&&(this[r]=e)})}};Te=new WeakMap;B.version="2.20.1";B.dependencies={};p([d()],B.prototype,"dir",2);p([d()],B.prototype,"lang",2);var Ms=class extends B{constructor(){super(...arguments),this.localize=new Tt(this)}render(){return c`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};Ms.styles=[J,Bi];var Xt=new WeakMap,Gt=new WeakMap,Zt=new WeakMap,ir=new WeakSet,Se=new WeakMap,js=class{constructor(t,e){this.handleFormData=r=>{const i=this.options.disabled(this.host),s=this.options.name(this.host),o=this.options.value(this.host),a=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!i&&!a&&typeof s=="string"&&s.length>0&&typeof o<"u"&&(Array.isArray(o)?o.forEach(l=>{r.formData.append(s,l.toString())}):r.formData.append(s,o.toString()))},this.handleFormSubmit=r=>{var i;const s=this.options.disabled(this.host),o=this.options.reportValidity;this.form&&!this.form.noValidate&&((i=Xt.get(this.form))==null||i.forEach(a=>{this.setUserInteracted(a,!0)})),this.form&&!this.form.noValidate&&!s&&!o(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),Se.set(this.host,[])},this.handleInteraction=r=>{const i=Se.get(this.host);i.includes(r.type)||i.push(r.type),i.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.checkValidity=="function"&&!i.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const i of r)if(typeof i.reportValidity=="function"&&!i.reportValidity())return!1}return!0},(this.host=t).addController(this),this.options=zt({form:r=>{const i=r.form;if(i){const o=r.getRootNode().querySelector(`#${i}`);if(o)return o}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var i;return(i=r.disabled)!=null?i:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,i)=>r.value=i,assumeInteractionOn:["sl-input"]},e)}hostConnected(){const t=this.options.form(this.host);t&&this.attachForm(t),Se.set(this.host,[]),this.options.assumeInteractionOn.forEach(e=>{this.host.addEventListener(e,this.handleInteraction)})}hostDisconnected(){this.detachForm(),Se.delete(this.host),this.options.assumeInteractionOn.forEach(t=>{this.host.removeEventListener(t,this.handleInteraction)})}hostUpdated(){const t=this.options.form(this.host);t||this.detachForm(),t&&this.form!==t&&(this.detachForm(),this.attachForm(t)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(t){t?(this.form=t,Xt.has(this.form)?Xt.get(this.form).add(this.host):Xt.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),Gt.has(this.form)||(Gt.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),Zt.has(this.form)||(Zt.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const t=Xt.get(this.form);t&&(t.delete(this.host),t.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),Gt.has(this.form)&&(this.form.reportValidity=Gt.get(this.form),Gt.delete(this.form)),Zt.has(this.form)&&(this.form.checkValidity=Zt.get(this.form),Zt.delete(this.form)),this.form=void 0))}setUserInteracted(t,e){e?ir.add(t):ir.delete(t),t.requestUpdate()}doAction(t,e){if(this.form){const r=document.createElement("button");r.type=t,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",e&&(r.name=e.name,r.value=e.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(i=>{e.hasAttribute(i)&&r.setAttribute(i,e.getAttribute(i))})),this.form.append(r),r.click(),r.remove()}}getForm(){var t;return(t=this.form)!=null?t:null}reset(t){this.doAction("reset",t)}submit(t){this.doAction("submit",t)}setValidity(t){const e=this.host,r=!!ir.has(e),i=!!e.required;e.toggleAttribute("data-required",i),e.toggleAttribute("data-optional",!i),e.toggleAttribute("data-invalid",!t),e.toggleAttribute("data-valid",t),e.toggleAttribute("data-user-invalid",!t&&r),e.toggleAttribute("data-user-valid",t&&r)}updateValidity(){const t=this.host;this.setValidity(t.validity.valid)}emitInvalidEvent(t){const e=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});t||e.preventDefault(),this.host.dispatchEvent(e)||t==null||t.preventDefault()}},Pr=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(Ar(zt({},Pr),{valid:!1,valueMissing:!0}));Object.freeze(Ar(zt({},Pr),{valid:!1,customError:!0}));var to=y`
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
`,me=class{constructor(t,...e){this.slotNames=[],this.handleSlotChange=r=>{const i=r.target;(this.slotNames.includes("[default]")&&!i.name||i.name&&this.slotNames.includes(i.name))&&this.host.requestUpdate()},(this.host=t).addController(this),this.slotNames=e}hasDefaultSlot(){return[...this.host.childNodes].some(t=>{if(t.nodeType===t.TEXT_NODE&&t.textContent.trim()!=="")return!0;if(t.nodeType===t.ELEMENT_NODE){const e=t;if(e.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!e.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(t){return this.host.querySelector(`:scope > [slot="${t}"]`)!==null}test(t){return t==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(t)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},dr="";function ns(t){dr=t}function eo(t=""){if(!dr){const e=[...document.getElementsByTagName("script")],r=e.find(i=>i.hasAttribute("data-shoelace"));if(r)ns(r.getAttribute("data-shoelace"));else{const i=e.find(o=>/shoelace(\.min)?\.js($|\?)/.test(o.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(o.src));let s="";i&&(s=i.getAttribute("src")),ns(s.split("/").slice(0,-1).join("/"))}}return dr.replace(/\/$/,"")+(t?`/${t.replace(/^\//,"")}`:"")}var ro={name:"default",resolver:t=>eo(`assets/icons/${t}.svg`)},so=ro,ls={caret:`
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
  `},io={name:"system",resolver:t=>t in ls?`data:image/svg+xml,${encodeURIComponent(ls[t])}`:""},oo=io,ao=[so,oo],ur=[];function no(t){ur.push(t)}function lo(t){ur=ur.filter(e=>e!==t)}function cs(t){return ao.find(e=>e.name===t)}var co=y`
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
`;function N(t,e){const r=zt({waitUntilFirstUpdate:!1},e);return(i,s)=>{const{update:o}=i,a=Array.isArray(t)?t:[t];i.update=function(l){a.forEach(n=>{const h=n;if(l.has(h)){const u=l.get(h),f=this[h];u!==f&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[s](u,f)}}),o.call(this,l)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const uo=(t,e)=>(t==null?void 0:t._$litType$)!==void 0,ho=t=>t.strings===void 0,po={},fo=(t,e=po)=>t._$AH=e;var Yt=Symbol(),Ce=Symbol(),or,ar=new Map,X=class extends B{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(t,e){var r;let i;if(e!=null&&e.spriteSheet)return this.svg=c`<svg part="svg">
        <use part="use" href="${t}"></use>
      </svg>`,this.svg;try{if(i=await fetch(t,{mode:"cors"}),!i.ok)return i.status===410?Yt:Ce}catch{return Ce}try{const s=document.createElement("div");s.innerHTML=await i.text();const o=s.firstElementChild;if(((r=o==null?void 0:o.tagName)==null?void 0:r.toLowerCase())!=="svg")return Yt;or||(or=new DOMParser);const l=or.parseFromString(o.outerHTML,"text/html").body.querySelector("svg");return l?(l.part.add("svg"),document.adoptNode(l)):Yt}catch{return Yt}}connectedCallback(){super.connectedCallback(),no(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),lo(this)}getIconSource(){const t=cs(this.library);return this.name&&t?{url:t.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var t;const{url:e,fromLibrary:r}=this.getIconSource(),i=r?cs(this.library):void 0;if(!e){this.svg=null;return}let s=ar.get(e);if(s||(s=this.resolveIcon(e,i),ar.set(e,s)),!this.initialRender)return;const o=await s;if(o===Ce&&ar.delete(e),e===this.getIconSource().url){if(uo(o)){if(this.svg=o,i){await this.updateComplete;const a=this.shadowRoot.querySelector("[part='svg']");typeof i.mutator=="function"&&a&&i.mutator(a)}return}switch(o){case Ce:case Yt:this.svg=null,this.emit("sl-error");break;default:this.svg=o.cloneNode(!0),(t=i==null?void 0:i.mutator)==null||t.call(i,this.svg),this.emit("sl-load")}}}render(){return this.svg}};X.styles=[J,co];p([x()],X.prototype,"svg",2);p([d({reflect:!0})],X.prototype,"name",2);p([d()],X.prototype,"src",2);p([d()],X.prototype,"label",2);p([d({reflect:!0})],X.prototype,"library",2);p([N("label")],X.prototype,"handleLabelChange",1);p([N(["name","src","library"])],X.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const gt={ATTRIBUTE:1,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},Us=t=>(...e)=>({_$litDirective$:t,values:e});let Hs=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,r,i){this._$Ct=e,this._$AM=r,this._$Ci=i}_$AS(e,r){return this.update(e,r)}update(e,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const K=Us(class extends Hs{constructor(t){var e;if(super(t),t.type!==gt.ATTRIBUTE||t.name!=="class"||((e=t.strings)==null?void 0:e.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(t){return" "+Object.keys(t).filter(e=>t[e]).join(" ")+" "}update(t,[e]){var i,s;if(this.st===void 0){this.st=new Set,t.strings!==void 0&&(this.nt=new Set(t.strings.join(" ").split(/\s/).filter(o=>o!=="")));for(const o in e)e[o]&&!((i=this.nt)!=null&&i.has(o))&&this.st.add(o);return this.render(e)}const r=t.element.classList;for(const o of this.st)o in e||(r.remove(o),this.st.delete(o));for(const o in e){const a=!!e[o];a===this.st.has(o)||(s=this.nt)!=null&&s.has(o)||(a?(r.add(o),this.st.add(o)):(r.remove(o),this.st.delete(o)))}return Y}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Vs=Symbol.for(""),bo=t=>{if((t==null?void 0:t.r)===Vs)return t==null?void 0:t._$litStatic$},De=(t,...e)=>({_$litStatic$:e.reduce((r,i,s)=>r+(o=>{if(o._$litStatic$!==void 0)return o._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${o}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(i)+t[s+1],t[0]),r:Vs}),ds=new Map,go=t=>(e,...r)=>{const i=r.length;let s,o;const a=[],l=[];let n,h=0,u=!1;for(;h<i;){for(n=e[h];h<i&&(o=r[h],(s=bo(o))!==void 0);)n+=s+e[++h],u=!0;h!==i&&l.push(o),a.push(n),h++}if(h===i&&a.push(e[i]),u){const f=a.join("$$lit$$");(e=ds.get(f))===void 0&&(a.raw=a,ds.set(f,e=a)),r=l}return t(e,...r)},ze=go(c);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const S=t=>t??w;var P=class extends B{constructor(){super(...arguments),this.formControlController=new js(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new me(this,"[default]","prefix","suffix"),this.localize=new Tt(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:Pr}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(t){this.isButton()&&(this.button.setCustomValidity(t),this.formControlController.updateValidity())}render(){const t=this.isLink(),e=t?De`a`:De`button`;return ze`
      <${e}
        part="base"
        class=${K({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${S(t?void 0:this.disabled)}
        type=${S(t?void 0:this.type)}
        title=${this.title}
        name=${S(t?void 0:this.name)}
        value=${S(t?void 0:this.value)}
        href=${S(t&&!this.disabled?this.href:void 0)}
        target=${S(t?this.target:void 0)}
        download=${S(t?this.download:void 0)}
        rel=${S(t?this.rel:void 0)}
        role=${S(t?void 0:"button")}
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
        ${this.caret?ze` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?ze`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${e}>
    `}};P.styles=[J,to];P.dependencies={"sl-icon":X,"sl-spinner":Ms};p([M(".button")],P.prototype,"button",2);p([x()],P.prototype,"hasFocus",2);p([x()],P.prototype,"invalid",2);p([d()],P.prototype,"title",2);p([d({reflect:!0})],P.prototype,"variant",2);p([d({reflect:!0})],P.prototype,"size",2);p([d({type:Boolean,reflect:!0})],P.prototype,"caret",2);p([d({type:Boolean,reflect:!0})],P.prototype,"disabled",2);p([d({type:Boolean,reflect:!0})],P.prototype,"loading",2);p([d({type:Boolean,reflect:!0})],P.prototype,"outline",2);p([d({type:Boolean,reflect:!0})],P.prototype,"pill",2);p([d({type:Boolean,reflect:!0})],P.prototype,"circle",2);p([d()],P.prototype,"type",2);p([d()],P.prototype,"name",2);p([d()],P.prototype,"value",2);p([d()],P.prototype,"href",2);p([d()],P.prototype,"target",2);p([d()],P.prototype,"rel",2);p([d()],P.prototype,"download",2);p([d()],P.prototype,"form",2);p([d({attribute:"formaction"})],P.prototype,"formAction",2);p([d({attribute:"formenctype"})],P.prototype,"formEnctype",2);p([d({attribute:"formmethod"})],P.prototype,"formMethod",2);p([d({attribute:"formnovalidate",type:Boolean})],P.prototype,"formNoValidate",2);p([d({attribute:"formtarget"})],P.prototype,"formTarget",2);p([N("disabled",{waitUntilFirstUpdate:!0})],P.prototype,"handleDisabledChange",1);P.define("sl-button");X.define("sl-icon");var vo=y`
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
`,mo=(t="value")=>(e,r)=>{const i=e.constructor,s=i.prototype.attributeChangedCallback;i.prototype.attributeChangedCallback=function(o,a,l){var n;const h=i.getPropertyOptions(t),u=typeof h.attribute=="string"?h.attribute:t;if(o===u){const f=h.converter||Bt,k=(typeof f=="function"?f:(n=f==null?void 0:f.fromAttribute)!=null?n:Bt.fromAttribute)(l,h.type);this[t]!==k&&(this[r]=k)}s.call(this,o,a,l)}},xo=y`
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
 */const yo=Us(class extends Hs{constructor(t){if(super(t),t.type!==gt.PROPERTY&&t.type!==gt.ATTRIBUTE&&t.type!==gt.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!ho(t))throw Error("`live` bindings can only contain a single expression")}render(t){return t}update(t,[e]){if(e===Y||e===w)return e;const r=t.element,i=t.name;if(t.type===gt.PROPERTY){if(e===r[i])return Y}else if(t.type===gt.BOOLEAN_ATTRIBUTE){if(!!e===r.hasAttribute(i))return Y}else if(t.type===gt.ATTRIBUTE&&r.getAttribute(i)===e+"")return Y;return fo(t),e}});var _=class extends B{constructor(){super(...arguments),this.formControlController=new js(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new me(this,"help-text","label"),this.localize=new Tt(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var t;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((t=this.input)==null?void 0:t.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(t){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=t,this.value=this.__dateInput.value}get valueAsNumber(){var t;return this.__numberInput.value=this.value,((t=this.input)==null?void 0:t.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(t){this.__numberInput.valueAsNumber=t,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(t){t.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(t){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(t)}handleKeyDown(t){const e=t.metaKey||t.ctrlKey||t.shiftKey||t.altKey;t.key==="Enter"&&!e&&setTimeout(()=>{!t.defaultPrevented&&!t.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(t){this.input.focus(t)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(t,e,r="none"){this.input.setSelectionRange(t,e,r)}setRangeText(t,e,r,i="preserve"){const s=e??this.input.selectionStart,o=r??this.input.selectionEnd;this.input.setRangeText(t,s,o,i),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(t){this.input.setCustomValidity(t),this.formControlController.updateValidity()}render(){const t=this.hasSlotController.test("label"),e=this.hasSlotController.test("help-text"),r=this.label?!0:!!t,i=this.helpText?!0:!!e,o=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return c`
      <div
        part="form-control"
        class=${K({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":i})}
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
            class=${K({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
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
              name=${S(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${S(this.placeholder)}
              minlength=${S(this.minlength)}
              maxlength=${S(this.maxlength)}
              min=${S(this.min)}
              max=${S(this.max)}
              step=${S(this.step)}
              .value=${yo(this.value)}
              autocapitalize=${S(this.autocapitalize)}
              autocomplete=${S(this.autocomplete)}
              autocorrect=${S(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${S(this.pattern)}
              enterkeyhint=${S(this.enterkeyhint)}
              inputmode=${S(this.inputmode)}
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
    `}};_.styles=[J,xo,vo];_.dependencies={"sl-icon":X};p([M(".input__control")],_.prototype,"input",2);p([x()],_.prototype,"hasFocus",2);p([d()],_.prototype,"title",2);p([d({reflect:!0})],_.prototype,"type",2);p([d()],_.prototype,"name",2);p([d()],_.prototype,"value",2);p([mo()],_.prototype,"defaultValue",2);p([d({reflect:!0})],_.prototype,"size",2);p([d({type:Boolean,reflect:!0})],_.prototype,"filled",2);p([d({type:Boolean,reflect:!0})],_.prototype,"pill",2);p([d()],_.prototype,"label",2);p([d({attribute:"help-text"})],_.prototype,"helpText",2);p([d({type:Boolean})],_.prototype,"clearable",2);p([d({type:Boolean,reflect:!0})],_.prototype,"disabled",2);p([d()],_.prototype,"placeholder",2);p([d({type:Boolean,reflect:!0})],_.prototype,"readonly",2);p([d({attribute:"password-toggle",type:Boolean})],_.prototype,"passwordToggle",2);p([d({attribute:"password-visible",type:Boolean})],_.prototype,"passwordVisible",2);p([d({attribute:"no-spin-buttons",type:Boolean})],_.prototype,"noSpinButtons",2);p([d({reflect:!0})],_.prototype,"form",2);p([d({type:Boolean,reflect:!0})],_.prototype,"required",2);p([d()],_.prototype,"pattern",2);p([d({type:Number})],_.prototype,"minlength",2);p([d({type:Number})],_.prototype,"maxlength",2);p([d()],_.prototype,"min",2);p([d()],_.prototype,"max",2);p([d()],_.prototype,"step",2);p([d()],_.prototype,"autocapitalize",2);p([d()],_.prototype,"autocorrect",2);p([d()],_.prototype,"autocomplete",2);p([d({type:Boolean})],_.prototype,"autofocus",2);p([d()],_.prototype,"enterkeyhint",2);p([d({type:Boolean,converter:{fromAttribute:t=>!(!t||t==="false"),toAttribute:t=>t?"true":"false"}})],_.prototype,"spellcheck",2);p([d()],_.prototype,"inputmode",2);p([N("disabled",{waitUntilFirstUpdate:!0})],_.prototype,"handleDisabledChange",1);p([N("step",{waitUntilFirstUpdate:!0})],_.prototype,"handleStepChange",1);p([N("value",{waitUntilFirstUpdate:!0})],_.prototype,"handleValueChange",1);_.define("sl-input");var _o=y`
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
`,qs=class extends B{constructor(){super(...arguments),this.hasSlotController=new me(this,"footer","header","image")}render(){return c`
      <div
        part="base"
        class=${K({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};qs.styles=[J,_o];qs.define("sl-card");var wo=y`
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
`,ko=y`
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
`,R=class extends B{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(t){this.disabled&&(t.preventDefault(),t.stopPropagation())}click(){this.button.click()}focus(t){this.button.focus(t)}blur(){this.button.blur()}render(){const t=!!this.href,e=t?De`a`:De`button`;return ze`
      <${e}
        part="base"
        class=${K({"icon-button":!0,"icon-button--disabled":!t&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${S(t?void 0:this.disabled)}
        type=${S(t?void 0:"button")}
        href=${S(t?this.href:void 0)}
        target=${S(t?this.target:void 0)}
        download=${S(t?this.download:void 0)}
        rel=${S(t&&this.target?"noreferrer noopener":void 0)}
        role=${S(t?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${S(this.name)}
          library=${S(this.library)}
          src=${S(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${e}>
    `}};R.styles=[J,ko];R.dependencies={"sl-icon":X};p([M(".icon-button")],R.prototype,"button",2);p([x()],R.prototype,"hasFocus",2);p([d()],R.prototype,"name",2);p([d()],R.prototype,"library",2);p([d()],R.prototype,"src",2);p([d()],R.prototype,"href",2);p([d()],R.prototype,"target",2);p([d()],R.prototype,"download",2);p([d()],R.prototype,"label",2);p([d({type:Boolean,reflect:!0})],R.prototype,"disabled",2);var $o=0,tt=class extends B{constructor(){super(...arguments),this.localize=new Tt(this),this.attrId=++$o,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(t){t.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,c`
      <div
        part="base"
        class=${K({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
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
    `}};tt.styles=[J,wo];tt.dependencies={"sl-icon-button":R};p([M(".tab")],tt.prototype,"tab",2);p([d({reflect:!0})],tt.prototype,"panel",2);p([d({type:Boolean,reflect:!0})],tt.prototype,"active",2);p([d({type:Boolean,reflect:!0})],tt.prototype,"closable",2);p([d({type:Boolean,reflect:!0})],tt.prototype,"disabled",2);p([d({type:Number,reflect:!0})],tt.prototype,"tabIndex",2);p([N("active")],tt.prototype,"handleActiveChange",1);p([N("disabled")],tt.prototype,"handleDisabledChange",1);tt.define("sl-tab");var So=y`
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
`,Co=y`
  :host {
    display: contents;
  }
`,Ve=class extends B{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(t=>{this.emit("sl-resize",{detail:{entries:t}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const t=this.shadowRoot.querySelector("slot");if(t!==null){const e=t.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],e.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return c` <slot @slotchange=${this.handleSlotChange}></slot> `}};Ve.styles=[J,Co];p([d({type:Boolean,reflect:!0})],Ve.prototype,"disabled",2);p([N("disabled",{waitUntilFirstUpdate:!0})],Ve.prototype,"handleDisabledChange",1);function Eo(t,e){return{top:Math.round(t.getBoundingClientRect().top-e.getBoundingClientRect().top),left:Math.round(t.getBoundingClientRect().left-e.getBoundingClientRect().left)}}var hr=new Set;function Ao(){const t=document.documentElement.clientWidth;return Math.abs(window.innerWidth-t)}function Po(){const t=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(t)||!t?0:t}function nr(t){if(hr.add(t),!document.documentElement.classList.contains("sl-scroll-lock")){const e=Ao()+Po();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),e<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${e}px`)}}function lr(t){hr.delete(t),hr.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function us(t,e,r="vertical",i="smooth"){const s=Eo(t,e),o=s.top+e.scrollTop,a=s.left+e.scrollLeft,l=e.scrollLeft,n=e.scrollLeft+e.offsetWidth,h=e.scrollTop,u=e.scrollTop+e.offsetHeight;(r==="horizontal"||r==="both")&&(a<l?e.scrollTo({left:a,behavior:i}):a+t.clientWidth>n&&e.scrollTo({left:a-e.offsetWidth+t.clientWidth,behavior:i})),(r==="vertical"||r==="both")&&(o<h?e.scrollTo({top:o,behavior:i}):o+t.clientHeight>u&&e.scrollTo({top:o-e.offsetHeight+t.clientHeight,behavior:i}))}var D=class extends B{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new Tt(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const t=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(e=>{const r=e.filter(({target:i})=>{if(i===this)return!0;if(i.closest("sl-tab-group")!==this)return!1;const s=i.tagName.toLowerCase();return s==="sl-tab"||s==="sl-tab-panel"});if(r.length!==0){if(r.some(i=>!["aria-labelledby","aria-controls"].includes(i.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(i=>i.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(i=>i.attributeName==="active")){const s=r.filter(o=>o.attributeName==="active"&&o.target.tagName.toLowerCase()==="sl-tab").map(o=>o.target).find(o=>o.active);s&&this.setActiveTab(s)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),t.then(()=>{new IntersectionObserver((r,i)=>{var s;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((s=this.getActiveTab())!=null?s:this.tabs[0],{emitEvents:!1}),i.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var t,e;super.disconnectedCallback(),(t=this.mutationObserver)==null||t.disconnect(),this.nav&&((e=this.resizeObserver)==null||e.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(t=>t.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(t=>t.active)}handleClick(t){const r=t.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(t){const r=t.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(t.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),t.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(t.key))){const s=this.tabs.find(l=>l.matches(":focus")),o=this.localize.dir()==="rtl";let a=null;if((s==null?void 0:s.tagName.toLowerCase())==="sl-tab"){if(t.key==="Home")a=this.focusableTabs[0];else if(t.key==="End")a=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&t.key===(o?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&t.key==="ArrowUp"){const l=this.tabs.findIndex(n=>n===s);a=this.findNextFocusableTab(l,"backward")}else if(["top","bottom"].includes(this.placement)&&t.key===(o?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&t.key==="ArrowDown"){const l=this.tabs.findIndex(n=>n===s);a=this.findNextFocusableTab(l,"forward")}if(!a)return;a.tabIndex=0,a.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(a,{scrollBehavior:"smooth"}):this.tabs.forEach(l=>{l.tabIndex=l===a?0:-1}),["top","bottom"].includes(this.placement)&&us(a,this.nav,"horizontal"),t.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(t,e){if(e=zt({emitEvents:!0,scrollBehavior:"auto"},e),t!==this.activeTab&&!t.disabled){const r=this.activeTab;this.activeTab=t,this.tabs.forEach(i=>{i.active=i===this.activeTab,i.tabIndex=i===this.activeTab?0:-1}),this.panels.forEach(i=>{var s;return i.active=i.name===((s=this.activeTab)==null?void 0:s.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&us(this.activeTab,this.nav,"horizontal",e.scrollBehavior),e.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(t=>{const e=this.panels.find(r=>r.name===t.panel);e&&(t.setAttribute("aria-controls",e.getAttribute("id")),e.setAttribute("aria-labelledby",t.getAttribute("id")))})}repositionIndicator(){const t=this.getActiveTab();if(!t)return;const e=t.clientWidth,r=t.clientHeight,i=this.localize.dir()==="rtl",s=this.getAllTabs(),a=s.slice(0,s.indexOf(t)).reduce((l,n)=>({left:l.left+n.clientWidth,top:l.top+n.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${e}px`,this.indicator.style.height="auto",this.indicator.style.translate=i?`${-1*a.left}px`:`${a.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${a.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(t=>!t.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(t,e){let r=null;const i=e==="forward"?1:-1;let s=t+i;for(;t<this.tabs.length;){if(r=this.tabs[s]||null,r===null){e==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;s+=i}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(t){const e=this.tabs.find(r=>r.panel===t);e&&this.setActiveTab(e,{scrollBehavior:"smooth"})}render(){const t=this.localize.dir()==="rtl";return c`
      <div
        part="base"
        class=${K({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?c`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${K({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
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

          ${this.hasScrollControls?c`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${K({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
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
    `}};D.styles=[J,So];D.dependencies={"sl-icon-button":R,"sl-resize-observer":Ve};p([M(".tab-group")],D.prototype,"tabGroup",2);p([M(".tab-group__body")],D.prototype,"body",2);p([M(".tab-group__nav")],D.prototype,"nav",2);p([M(".tab-group__indicator")],D.prototype,"indicator",2);p([x()],D.prototype,"hasScrollControls",2);p([x()],D.prototype,"shouldHideScrollStartButton",2);p([x()],D.prototype,"shouldHideScrollEndButton",2);p([d()],D.prototype,"placement",2);p([d()],D.prototype,"activation",2);p([d({attribute:"no-scroll-controls",type:Boolean})],D.prototype,"noScrollControls",2);p([d({attribute:"fixed-scroll-controls",type:Boolean})],D.prototype,"fixedScrollControls",2);p([Qi({passive:!0})],D.prototype,"updateScrollButtons",1);p([N("noScrollControls",{waitUntilFirstUpdate:!0})],D.prototype,"updateScrollControls",1);p([N("placement",{waitUntilFirstUpdate:!0})],D.prototype,"syncIndicator",1);D.define("sl-tab-group");var To=(t,e)=>{let r=0;return function(...i){window.clearTimeout(r),r=window.setTimeout(()=>{t.call(this,...i)},e)}},hs=(t,e,r)=>{const i=t[e];t[e]=function(...s){i.call(this,...s),r.call(this,i,...s)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const e=new Set,r=new WeakMap,i=o=>{for(const a of o.changedTouches)e.add(a.identifier)},s=o=>{for(const a of o.changedTouches)e.delete(a.identifier)};document.addEventListener("touchstart",i,!0),document.addEventListener("touchend",s,!0),document.addEventListener("touchcancel",s,!0),hs(EventTarget.prototype,"addEventListener",function(o,a){if(a!=="scrollend")return;const l=To(()=>{e.size?l():this.dispatchEvent(new Event("scrollend"))},100);o.call(this,"scroll",l,{passive:!0}),r.set(this,l)}),hs(EventTarget.prototype,"removeEventListener",function(o,a){if(a!=="scrollend")return;const l=r.get(this);l&&o.call(this,"scroll",l,{passive:!0})})}})();var zo=y`
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
`;function*Tr(t=document.activeElement){t!=null&&(yield t,"shadowRoot"in t&&t.shadowRoot&&t.shadowRoot.mode!=="closed"&&(yield*Gi(Tr(t.shadowRoot.activeElement))))}function Oo(){return[...Tr()].pop()}var ps=new WeakMap;function Ws(t){let e=ps.get(t);return e||(e=window.getComputedStyle(t,null),ps.set(t,e)),e}function Do(t){if(typeof t.checkVisibility=="function")return t.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const e=Ws(t);return e.visibility!=="hidden"&&e.display!=="none"}function Lo(t){const e=Ws(t),{overflowY:r,overflowX:i}=e;return r==="scroll"||i==="scroll"?!0:r!=="auto"||i!=="auto"?!1:t.scrollHeight>t.clientHeight&&r==="auto"||t.scrollWidth>t.clientWidth&&i==="auto"}function Ro(t){const e=t.tagName.toLowerCase(),r=Number(t.getAttribute("tabindex"));if(t.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||t.hasAttribute("disabled")||t.closest("[inert]"))return!1;if(e==="input"&&t.getAttribute("type")==="radio"){const o=t.getRootNode(),a=`input[type='radio'][name="${t.getAttribute("name")}"]`,l=o.querySelector(`${a}:checked`);return l?l===t:o.querySelector(a)===t}return Do(t)?(e==="audio"||e==="video")&&t.hasAttribute("controls")||t.hasAttribute("tabindex")||t.hasAttribute("contenteditable")&&t.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(e)?!0:Lo(t):!1}function Io(t,e){var r;return((r=t.getRootNode({composed:!0}))==null?void 0:r.host)!==e}function fs(t){const e=new WeakMap,r=[];function i(s){if(s instanceof Element){if(s.hasAttribute("inert")||s.closest("[inert]")||e.has(s))return;e.set(s,!0),!r.includes(s)&&Ro(s)&&r.push(s),s instanceof HTMLSlotElement&&Io(s,t)&&s.assignedElements({flatten:!0}).forEach(o=>{i(o)}),s.shadowRoot!==null&&s.shadowRoot.mode==="open"&&i(s.shadowRoot)}for(const o of s.children)i(o)}return i(t),r.sort((s,o)=>{const a=Number(s.getAttribute("tabindex"))||0;return(Number(o.getAttribute("tabindex"))||0)-a})}var Qt=[],Bo=class{constructor(t){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=e=>{var r;if(e.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const i=Oo();if(this.previousFocus=i,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;e.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const s=fs(this.element);let o=s.findIndex(l=>l===i);this.previousFocus=this.currentFocus;const a=this.tabDirection==="forward"?1:-1;for(;;){o+a>=s.length?o=0:o+a<0?o=s.length-1:o+=a,this.previousFocus=this.currentFocus;const l=s[o];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||l&&this.possiblyHasTabbableChildren(l))return;e.preventDefault(),this.currentFocus=l,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const n=[...Tr()];if(n.includes(this.currentFocus)||!n.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=t,this.elementsWithTabbableControls=["iframe"]}activate(){Qt.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){Qt=Qt.filter(t=>t!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return Qt[Qt.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const t=fs(this.element);if(!this.element.matches(":focus-within")){const e=t[0],r=t[t.length-1],i=this.tabDirection==="forward"?e:r;typeof(i==null?void 0:i.focus)=="function"&&(this.currentFocus=i,i.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(t){return this.elementsWithTabbableControls.includes(t.tagName.toLowerCase())||t.hasAttribute("controls")}},Ks=t=>{var e;const{activeElement:r}=document;r&&t.contains(r)&&((e=document.activeElement)==null||e.blur())},Xs=new Map,No=new WeakMap;function Fo(t){return t??{keyframes:[],options:{duration:0}}}function bs(t,e){return e.toLowerCase()==="rtl"?{keyframes:t.rtlKeyframes||t.keyframes,options:t.options}:t}function U(t,e){Xs.set(t,Fo(e))}function xt(t,e,r){const i=No.get(t);if(i!=null&&i[e])return bs(i[e],r.dir);const s=Xs.get(e);return s?bs(s,r.dir):{keyframes:[],options:{duration:0}}}function Le(t,e){return new Promise(r=>{function i(s){s.target===t&&(t.removeEventListener(e,i),r())}t.addEventListener(e,i)})}function yt(t,e,r){return new Promise(i=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const s=t.animate(e,Ar(zt({},r),{duration:Mo()?0:r.duration}));s.addEventListener("cancel",i,{once:!0}),s.addEventListener("finish",i,{once:!0})})}function Mo(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function It(t){return Promise.all(t.getAnimations().map(e=>new Promise(r=>{e.cancel(),requestAnimationFrame(r)})))}function gs(t){return t.charAt(0).toUpperCase()+t.slice(1)}var H=class extends B{constructor(){super(...arguments),this.hasSlotController=new me(this,"footer"),this.localize=new Tt(this),this.modal=new Bo(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=t=>{this.contained||t.key==="Escape"&&this.modal.isActive()&&this.open&&(t.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),nr(this)))}disconnectedCallback(){super.disconnectedCallback(),lr(this),this.removeOpenListeners()}requestClose(t){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:t}}).defaultPrevented){const r=xt(this,"drawer.denyClose",{dir:this.localize.dir()});yt(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var t;"CloseWatcher"in window?((t=this.closeWatcher)==null||t.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var t;document.removeEventListener("keydown",this.handleDocumentKeyDown),(t=this.closeWatcher)==null||t.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),nr(this));const t=this.querySelector("[autofocus]");t&&t.removeAttribute("autofocus"),await Promise.all([It(this.drawer),It(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(t?t.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),t&&t.setAttribute("autofocus","")});const e=xt(this,`drawer.show${gs(this.placement)}`,{dir:this.localize.dir()}),r=xt(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([yt(this.panel,e.keyframes,e.options),yt(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{Ks(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),lr(this)),await Promise.all([It(this.drawer),It(this.overlay)]);const t=xt(this,`drawer.hide${gs(this.placement)}`,{dir:this.localize.dir()}),e=xt(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([yt(this.overlay,e.keyframes,e.options).then(()=>{this.overlay.hidden=!0}),yt(this.panel,t.keyframes,t.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),nr(this)),this.open&&this.contained&&(this.modal.deactivate(),lr(this))}async show(){if(!this.open)return this.open=!0,Le(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Le(this,"sl-after-hide")}render(){return c`
      <div
        part="base"
        class=${K({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${S(this.noHeader?this.label:void 0)}
          aria-labelledby=${S(this.noHeader?void 0:"title")}
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
    `}};H.styles=[J,zo];H.dependencies={"sl-icon-button":R};p([M(".drawer")],H.prototype,"drawer",2);p([M(".drawer__panel")],H.prototype,"panel",2);p([M(".drawer__overlay")],H.prototype,"overlay",2);p([d({type:Boolean,reflect:!0})],H.prototype,"open",2);p([d({reflect:!0})],H.prototype,"label",2);p([d({reflect:!0})],H.prototype,"placement",2);p([d({type:Boolean,reflect:!0})],H.prototype,"contained",2);p([d({attribute:"no-header",type:Boolean,reflect:!0})],H.prototype,"noHeader",2);p([N("open",{waitUntilFirstUpdate:!0})],H.prototype,"handleOpenChange",1);p([N("contained",{waitUntilFirstUpdate:!0})],H.prototype,"handleNoModalChange",1);U("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});U("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});U("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});U("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});U("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});U("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});U("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});U("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});U("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});U("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});U("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});H.define("sl-drawer");var jo=y`
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
`,V=class vt extends B{constructor(){super(...arguments),this.hasSlotController=new me(this,"icon","suffix"),this.localize=new Tt(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var e;(e=this.countdownAnimation)==null||e.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var e;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(e=this.countdownAnimation)==null||e.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:e}=this,r="100%",i="0";this.countdownAnimation=e.animate([{width:r},{width:i}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await It(this.base),this.base.hidden=!1;const{keyframes:e,options:r}=xt(this,"alert.show",{dir:this.localize.dir()});await yt(this.base,e,r),this.emit("sl-after-show")}else{Ks(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await It(this.base);const{keyframes:e,options:r}=xt(this,"alert.hide",{dir:this.localize.dir()});await yt(this.base,e,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,Le(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,Le(this,"sl-after-hide")}async toast(){return new Promise(e=>{this.handleCountdownChange(),vt.toastStack.parentElement===null&&document.body.append(vt.toastStack),vt.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{vt.toastStack.removeChild(this),e(),vt.toastStack.querySelector("sl-alert")===null&&vt.toastStack.remove()},{once:!0})})}render(){return c`
      <div
        part="base"
        class=${K({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
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
                class=${K({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};V.styles=[J,jo];V.dependencies={"sl-icon-button":R};p([M('[part~="base"]')],V.prototype,"base",2);p([M(".alert__countdown-elapsed")],V.prototype,"countdownElement",2);p([d({type:Boolean,reflect:!0})],V.prototype,"open",2);p([d({type:Boolean,reflect:!0})],V.prototype,"closable",2);p([d({reflect:!0})],V.prototype,"variant",2);p([d({type:Number})],V.prototype,"duration",2);p([d({type:String,reflect:!0})],V.prototype,"countdown",2);p([x()],V.prototype,"remainingTime",2);p([N("open",{waitUntilFirstUpdate:!0})],V.prototype,"handleOpenChange",1);p([N("duration")],V.prototype,"handleDurationChange",1);var Uo=V;U("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});U("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});Uo.define("sl-alert");function Ho(t,e){const r=new Set([...Object.keys(t),...Object.keys(e)]);for(const i of r)if((t[i]??"")!==(e[i]??""))return!0;return!1}const Vo={view:"search",search:{state:"initial",currentSession:null,query:"",results:[],total:0,source:"fts",offset:0,limit:20},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,status:null,error:null,settings:{scope:"local",values:{},original:{},dirty:!1,exists:!0,saving:!1,error:null},files:{treeCache:{},expandedPaths:[],currentDir:"",selectedPaths:[],lastSelectedAnchor:null,detail:null,detailLoading:!1,listing:!1,mobilePane:"tree",pendingAction:null,error:null}};class qo{constructor(){this.state=Vo,this.listeners=new Set}getState(){return this.state}setState(e){this.state={...this.state,...e},this.listeners.forEach(r=>r(this.state))}subscribe(e){return this.listeners.add(e),()=>this.listeners.delete(e)}subscribeSelector(e,r){let i=e(this.state);return this.subscribe(s=>{const o=e(s);o!==i&&(i=o,r(o))})}}const b=new qo,m={setView(t){b.setState({view:t})},setSearchState(t){const e=b.getState().search;b.setState({search:{...e,...t}})},setChatState(t){const e=b.getState().chat;b.setState({chat:{...e,...t}})},pushDetail(t){const e=b.getState().detailStack;b.setState({detailStack:[...e,t]})},popDetail(){const t=b.getState().detailStack;t.length!==0&&b.setState({detailStack:t.slice(0,-1)})},setError(t){b.setState({error:t})},setPendingSession(t){b.setState({pendingSession:t})},setSettingsScope(t){const e=b.getState().settings;b.setState({settings:{...e,scope:t}})},loadSettings(t,e){const r=b.getState().settings;b.setState({settings:{...r,values:{...t},original:{...t},exists:e,dirty:!1,error:null}})},updateSetting(t,e){const r=b.getState().settings,i={...r.values,[t]:e},s=Ho(r.original,i);b.setState({settings:{...r,values:i,dirty:s}})},revertSettings(){const t=b.getState().settings,e={...t.original};b.setState({settings:{...t,values:e,dirty:!1}})},setSettingsSaving(t){const e=b.getState().settings;b.setState({settings:{...e,saving:t}})},setSettingsError(t){const e=b.getState().settings;b.setState({settings:{...e,error:t}})},setFilesState(t){const e=b.getState().files;b.setState({files:{...e,...t}})},expandDir(t){const e=b.getState().files;e.expandedPaths.includes(t)||b.setState({files:{...e,expandedPaths:[...e.expandedPaths,t]}})},collapseDir(t){const e=b.getState().files;b.setState({files:{...e,expandedPaths:e.expandedPaths.filter(r=>r!==t)}})},selectDir(t){const e=b.getState().files;b.setState({files:{...e,currentDir:t,selectedPaths:[],lastSelectedAnchor:null,detail:null,mobilePane:e.mobilePane==="tree"?"list":e.mobilePane}})},selectEntry(t,e={}){const r=b.getState().files;let i,s=r.lastSelectedAnchor;if(e.shift&&s!==null){const a=(r.treeCache[r.currentDir]||[]).map(h=>h.path),l=a.indexOf(s),n=a.indexOf(t);if(l>=0&&n>=0){const[h,u]=l<n?[l,n]:[n,l];i=a.slice(h,u+1)}else i=[t],s=t}else e.ctrl?(i=r.selectedPaths.includes(t)?r.selectedPaths.filter(o=>o!==t):[...r.selectedPaths,t],s=t):(i=[t],s=t);b.setState({files:{...r,selectedPaths:i,lastSelectedAnchor:s}})},clearSelection(){const t=b.getState().files;b.setState({files:{...t,selectedPaths:[],lastSelectedAnchor:null,detail:null}})},invalidateDir(t){const e=b.getState().files,r={...e.treeCache};delete r[t],b.setState({files:{...e,treeCache:r}})},invalidateSubtree(t){const e=b.getState().files,r={};for(const[i,s]of Object.entries(e.treeCache))i!==t&&!i.startsWith(t+"/")&&(r[i]=s);b.setState({files:{...e,treeCache:r}})},setMobilePane(t){const e=b.getState().files;b.setState({files:{...e,mobilePane:t}})}};var Wo=Object.defineProperty,Ko=Object.getOwnPropertyDescriptor,Gs=(t,e,r,i)=>{for(var s=i>1?void 0:i?Ko(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Wo(e,r,s),s};let Re=class extends ${constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"files",icon:"📁",label:"文件"}]}_select(t){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:t},bubbles:!0,composed:!0}))}render(){return c`
      ${this._items.map(t=>c`
        <button
          class=${this.active===t.id?"active":""}
          title=${t.label}
          @click=${()=>this._select(t.id)}>
          ${t.icon}
        </button>`)}
    `}};Re.styles=y`
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
  `;Gs([d()],Re.prototype,"active",2);Re=Gs([E("activity-bar")],Re);var Xo=Object.defineProperty,Go=Object.getOwnPropertyDescriptor,Zs=(t,e,r,i)=>{for(var s=i>1?void 0:i?Go(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Xo(e,r,s),s};let Ie=class extends ${constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"files",icon:"📁",label:"文件"}]}_select(t){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:t},bubbles:!0,composed:!0}))}render(){return c`
      ${this._items.map(t=>c`
        <button
          class="tab ${this.active===t.id?"active":""}"
          @click=${()=>this._select(t.id)}>
          <span class="icon">${t.icon}</span>
          <span>${t.label}</span>
        </button>`)}
    `}};Ie.styles=y`
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
  `;Zs([d()],Ie.prototype,"active",2);Ie=Zs([E("tab-bar")],Ie);var Zo=Object.defineProperty,Yo=Object.getOwnPropertyDescriptor,zr=(t,e,r,i)=>{for(var s=i>1?void 0:i?Yo(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Zo(e,r,s),s};let le=class extends ${constructor(){super(...arguments),this.heading="Cortex",this.subheading=""}render(){return c`
      <h1 class="title">${this.heading}</h1>
      ${this.subheading?c`<p class="subtitle">${this.subheading}</p>`:null}
    `}};le.styles=y`
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
  `;zr([d()],le.prototype,"heading",2);zr([d()],le.prototype,"subheading",2);le=zr([E("welcome-pane")],le);var Qo=Object.defineProperty,Jo=Object.getOwnPropertyDescriptor,Ht=(t,e,r,i)=>{for(var s=i>1?void 0:i?Jo(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Qo(e,r,s),s};let dt=class extends ${constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta="",this.actions=[],this._menuOpen=!1,this._onDocClick=t=>{if(!this._menuOpen)return;t.composedPath().includes(this)||(this._menuOpen=!1)}}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}_onMoreClick(t){t.stopPropagation(),this._menuOpen=!this._menuOpen}_onItemClick(t){t.disabled||(this._menuOpen=!1,t.onClick())}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return c`
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
            ${this.actions.map(t=>c`
              <button
                class="menu-item"
                type="button"
                role="menuitem"
                ?disabled=${t.disabled??!1}
                @click=${()=>this._onItemClick(t)}
              >
                ${t.icon?c`<span class="icon">${t.icon}</span>`:null}
                <span class="label">${t.label}</span>
              </button>
            `)}
          </div>
        </div>
      `:null}
    `}};dt.styles=y`
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
  `;Ht([d()],dt.prototype,"backLabel",2);Ht([d()],dt.prototype,"title",2);Ht([d()],dt.prototype,"meta",2);Ht([d({attribute:!1})],dt.prototype,"actions",2);Ht([x()],dt.prototype,"_menuOpen",2);dt=Ht([E("focus-header")],dt);var ta=Object.defineProperty,ea=Object.getOwnPropertyDescriptor,xe=(t,e,r,i)=>{for(var s=i>1?void 0:i?ea(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&ta(e,r,s),s};let St=class extends ${constructor(){super(...arguments),this.title="历史会话",this.sessions=[],this.clearing=!1}_onClear(){this.clearing||this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){const t=this.sessions.length>0;return c`
      <div class="header">
        <div class="title">${this.title}</div>
        ${t?c`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing?"清空中...":"清空"}
          </button>`:null}
      </div>
      ${this.sessions.length===0?c`<div class="empty">暂无历史会话</div>`:this.sessions.map(e=>c`<history-item .session=${e}></history-item>`)}
    `}};St.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
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
  `;xe([d()],St.prototype,"title",2);xe([d({attribute:!1})],St.prototype,"sessions",2);xe([d()],St.prototype,"type",2);xe([d({type:Boolean})],St.prototype,"clearing",2);St=xe([E("history-list")],St);var ra=Object.defineProperty,sa=Object.getOwnPropertyDescriptor,Ys=(t,e,r,i)=>{for(var s=i>1?void 0:i?sa(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&ra(e,r,s),s};let Be=class extends ${constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){if(!this.session)return null;const t=[];return this.session.type==="chat"&&t.push(String(this.session.message_count)),t.push(new Date(this.session.updated_at).toLocaleDateString()),c`
      <div class="name">${this.session.title}</div>
      <div class="meta">${t.join(" · ")}</div>
    `}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};Be.styles=y`
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
  `;Ys([d({attribute:!1})],Be.prototype,"session",2);Be=Ys([E("history-item")],Be);var ia=Object.defineProperty,oa=Object.getOwnPropertyDescriptor,ht=(t,e,r,i)=>{for(var s=i>1?void 0:i?oa(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&ia(e,r,s),s};let rt=class extends ${constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.multiline=!1,this.disabled=!1}focus(){var t;(t=this.inputEl)==null||t.focus()}get trimmed(){return this.value.trim()}_onInput(t){const e=t.target;this.value=e.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled)}_onKeydown(t){t.key==="Enter"&&(t.ctrlKey||t.metaKey)&&(t.preventDefault(),this._submit()),t.key==="Enter"&&!this.multiline&&!t.shiftKey&&(t.preventDefault(),this._submit())}_submit(){!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}render(){const t=this.multiline?c`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`:c`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;return c`
      <div class="wrapper">
        ${t}
        <button @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${this.buttonIcon?c`<span aria-hidden="true">${this.buttonIcon}</span>`:null}
          <span>${this.buttonLabel}</span>
        </button>
      </div>
    `}};rt.styles=y`
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
    @media (max-width: 1023px) {
      :host { --min-h: 44px; }
    }
  `;ht([d()],rt.prototype,"value",2);ht([d()],rt.prototype,"placeholder",2);ht([d()],rt.prototype,"buttonLabel",2);ht([d()],rt.prototype,"buttonIcon",2);ht([d({type:Boolean})],rt.prototype,"multiline",2);ht([d({type:Boolean})],rt.prototype,"disabled",2);ht([M("input, textarea")],rt.prototype,"inputEl",2);rt=ht([E("input-box")],rt);var aa=Object.defineProperty,na=Object.getOwnPropertyDescriptor,Or=(t,e,r,i)=>{for(var s=i>1?void 0:i?na(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&aa(e,r,s),s};let ce=class extends ${constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}render(){if(!this.result)return null;const t=Math.round(this.result.score*100);return c`
      <div class="path">${this.result.path}${this.result.line?`:${this.result.line}`:""}</div>
      <div class="snippet">${this.result.snippet}</div>
      <div class="score">评分: ${t}%</div>
    `}};ce.styles=y`
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
    .path { font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); }
    .snippet {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      margin-top: 4px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .score {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      margin-top: 2px;
    }
    mark {
      background: #FEF3C7;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
  `;Or([d({attribute:!1})],ce.prototype,"result",2);Or([d({type:Boolean,reflect:!0})],ce.prototype,"active",2);ce=Or([E("result-card")],ce);var la=Object.defineProperty,ca=Object.getOwnPropertyDescriptor,ye=(t,e,r,i)=>{for(var s=i>1?void 0:i?ca(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&la(e,r,s),s};let Ct=class extends ${constructor(){super(...arguments),this.results=[],this.activePath=null,this.activeLine=null,this.loading=!1}render(){return c`
      <div class="list-pane">
        ${this.loading&&this.results.length===0?c`<div class="loading">搜索中</div>`:this.results.length===0?c`<div class="empty">无搜索结果</div>`:this.results.map(t=>c`
                <result-card
                  .result=${t}
                  ?active=${this.activePath===t.path&&this.activeLine===t.line}>
                </result-card>`)}
      </div>
    `}};Ct.styles=y`
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
  `;ye([d({attribute:!1})],Ct.prototype,"results",2);ye([d({attribute:!1})],Ct.prototype,"activePath",2);ye([d({attribute:!1})],Ct.prototype,"activeLine",2);ye([d({type:Boolean})],Ct.prototype,"loading",2);Ct=ye([E("search-results")],Ct);function Dr(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Ot=Dr();function Qs(t){Ot=t}var _t={exec:()=>null};function Dt(t){let e=[];return r=>{let i=Math.max(0,Math.min(3,r-1)),s=e[i];return s||(s=t(i),e[i]=s),s}}function C(t,e=""){let r=typeof t=="string"?t:t.source,i={replace:(s,o)=>{let a=typeof o=="string"?o:o.source;return a=a.replace(L.caret,"$1"),r=r.replace(s,a),i},getRegex:()=>new RegExp(r,e)};return i}var da=((t="")=>{try{return!!new RegExp("(?<=1)(?<!1)"+t)}catch{return!1}})(),L={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:t=>new RegExp(`^( {0,3}${t})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:Dt(t=>new RegExp(`^ {0,${t}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:Dt(t=>new RegExp(`^ {0,${t}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:Dt(t=>new RegExp(`^ {0,${t}}(?:\`\`\`|~~~)`)),headingBeginRegex:Dt(t=>new RegExp(`^ {0,${t}}#`)),htmlBeginRegex:Dt(t=>new RegExp(`^ {0,${t}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:Dt(t=>new RegExp(`^ {0,${t}}>`))},ua=/^(?:[ \t]*(?:\n|$))+/,ha=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,pa=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,_e=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,fa=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Lr=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,Js=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,ti=C(Js).replace(/bull/g,Lr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),ba=C(Js).replace(/bull/g,Lr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Rr=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,ga=/^[^\n]+/,Ir=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,va=C(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",Ir).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),ma=C(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,Lr).getRegex(),qe="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",Br=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,xa=C("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",Br).replace("tag",qe).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),ei=C(Rr).replace("hr",_e).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",qe).getRegex(),ya=C(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",ei).getRegex(),Nr={blockquote:ya,code:ha,def:va,fences:pa,heading:fa,hr:_e,html:xa,lheading:ti,list:ma,newline:ua,paragraph:ei,table:_t,text:ga},vs=C("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",_e).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",qe).getRegex(),_a={...Nr,lheading:ba,table:vs,paragraph:C(Rr).replace("hr",_e).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",vs).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",qe).getRegex()},wa={...Nr,html:C(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",Br).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:_t,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:C(Rr).replace("hr",_e).replace("heading",` *#{1,6} *[^
]`).replace("lheading",ti).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},ka=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,$a=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,ri=/^( {2,}|\\)\n(?!\s*$)/,Sa=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Vt=/[\p{P}\p{S}]/u,We=/[\s\p{P}\p{S}]/u,Fr=/[^\s\p{P}\p{S}]/u,Ca=C(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,We).getRegex(),si=/(?!~)[\p{P}\p{S}]/u,Ea=/(?!~)[\s\p{P}\p{S}]/u,Aa=/(?:[^\s\p{P}\p{S}]|~)/u,Pa=C(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",da?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),ii=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,Ta=C(ii,"u").replace(/punct/g,Vt).getRegex(),za=C(ii,"u").replace(/punct/g,si).getRegex(),oi="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",Oa=C(oi,"gu").replace(/notPunctSpace/g,Fr).replace(/punctSpace/g,We).replace(/punct/g,Vt).getRegex(),Da=C(oi,"gu").replace(/notPunctSpace/g,Aa).replace(/punctSpace/g,Ea).replace(/punct/g,si).getRegex(),La=C("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,Fr).replace(/punctSpace/g,We).replace(/punct/g,Vt).getRegex(),Ra=C(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,Vt).getRegex(),Ia="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",Ba=C(Ia,"gu").replace(/notPunctSpace/g,Fr).replace(/punctSpace/g,We).replace(/punct/g,Vt).getRegex(),Na=C(/\\(punct)/,"gu").replace(/punct/g,Vt).getRegex(),Fa=C(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Ma=C(Br).replace("(?:-->|$)","-->").getRegex(),ja=C("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Ma).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),Ne=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,Ua=C(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",Ne).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),ai=C(/^!?\[(label)\]\[(ref)\]/).replace("label",Ne).replace("ref",Ir).getRegex(),ni=C(/^!?\[(ref)\](?:\[\])?/).replace("ref",Ir).getRegex(),Ha=C("reflink|nolink(?!\\()","g").replace("reflink",ai).replace("nolink",ni).getRegex(),ms=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Mr={_backpedal:_t,anyPunctuation:Na,autolink:Fa,blockSkip:Pa,br:ri,code:$a,del:_t,delLDelim:_t,delRDelim:_t,emStrongLDelim:Ta,emStrongRDelimAst:Oa,emStrongRDelimUnd:La,escape:ka,link:Ua,nolink:ni,punctuation:Ca,reflink:ai,reflinkSearch:Ha,tag:ja,text:Sa,url:_t},Va={...Mr,link:C(/^!?\[(label)\]\((.*?)\)/).replace("label",Ne).getRegex(),reflink:C(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",Ne).getRegex()},pr={...Mr,emStrongRDelimAst:Da,emStrongLDelim:za,delLDelim:Ra,delRDelim:Ba,url:C(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",ms).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:C(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",ms).getRegex()},qa={...pr,br:C(ri).replace("{2,}","*").getRegex(),text:C(pr.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Ee={normal:Nr,gfm:_a,pedantic:wa},Jt={normal:Mr,gfm:pr,breaks:qa,pedantic:Va},Wa={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},xs=t=>Wa[t];function et(t,e){if(e){if(L.escapeTest.test(t))return t.replace(L.escapeReplace,xs)}else if(L.escapeTestNoEncode.test(t))return t.replace(L.escapeReplaceNoEncode,xs);return t}function ys(t){try{t=encodeURI(t).replace(L.percentDecode,"%")}catch{return null}return t}function _s(t,e){var o;let r=t.replace(L.findPipe,(a,l,n)=>{let h=!1,u=l;for(;--u>=0&&n[u]==="\\";)h=!h;return h?"|":" |"}),i=r.split(L.splitPipe),s=0;if(i[0].trim()||i.shift(),i.length>0&&!((o=i.at(-1))!=null&&o.trim())&&i.pop(),e)if(i.length>e)i.splice(e);else for(;i.length<e;)i.push("");for(;s<i.length;s++)i[s]=i[s].trim().replace(L.slashPipe,"|");return i}function at(t,e,r){let i=t.length;if(i===0)return"";let s=0;for(;s<i&&t.charAt(i-s-1)===e;)s++;return t.slice(0,i-s)}function ws(t){let e=t.split(`
`),r=e.length-1;for(;r>=0&&L.blankLine.test(e[r]);)r--;return e.length-r<=2?t:e.slice(0,r+1).join(`
`)}function Ka(t,e){if(t.indexOf(e[1])===-1)return-1;let r=0;for(let i=0;i<t.length;i++)if(t[i]==="\\")i++;else if(t[i]===e[0])r++;else if(t[i]===e[1]&&(r--,r<0))return i;return r>0?-2:-1}function Xa(t,e=0){let r=e,i="";for(let s of t)if(s==="	"){let o=4-r%4;i+=" ".repeat(o),r+=o}else i+=s,r++;return i}function ks(t,e,r,i,s){let o=e.href,a=e.title||null,l=t[1].replace(s.other.outputLinkReplace,"$1");i.state.inLink=!0;let n={type:t[0].charAt(0)==="!"?"image":"link",raw:r,href:o,title:a,text:l,tokens:i.inlineTokens(l)};return i.state.inLink=!1,n}function Ga(t,e,r){let i=t.match(r.other.indentCodeCompensation);if(i===null)return e;let s=i[1];return e.split(`
`).map(o=>{let a=o.match(r.other.beginningSpace);if(a===null)return o;let[l]=a;return l.length>=s.length?o.slice(s.length):o}).join(`
`)}var Fe=class{constructor(t){T(this,"options");T(this,"rules");T(this,"lexer");this.options=t||Ot}space(t){let e=this.rules.block.newline.exec(t);if(e&&e[0].length>0)return{type:"space",raw:e[0]}}code(t){let e=this.rules.block.code.exec(t);if(e){let r=this.options.pedantic?e[0]:ws(e[0]),i=r.replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:r,codeBlockStyle:"indented",text:i}}}fences(t){let e=this.rules.block.fences.exec(t);if(e){let r=e[0],i=Ga(r,e[3]||"",this.rules);return{type:"code",raw:r,lang:e[2]?e[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):e[2],text:i}}}heading(t){let e=this.rules.block.heading.exec(t);if(e){let r=e[2].trim();if(this.rules.other.endingHash.test(r)){let i=at(r,"#");(this.options.pedantic||!i||this.rules.other.endingSpaceChar.test(i))&&(r=i.trim())}return{type:"heading",raw:at(e[0],`
`),depth:e[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(t){let e=this.rules.block.hr.exec(t);if(e)return{type:"hr",raw:at(e[0],`
`)}}blockquote(t){let e=this.rules.block.blockquote.exec(t);if(e){let r=at(e[0],`
`).split(`
`),i="",s="",o=[];for(;r.length>0;){let a=!1,l=[],n;for(n=0;n<r.length;n++)if(this.rules.other.blockquoteStart.test(r[n]))l.push(r[n]),a=!0;else if(!a)l.push(r[n]);else break;r=r.slice(n);let h=l.join(`
`),u=h.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");i=i?`${i}
${h}`:h,s=s?`${s}
${u}`:u;let f=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(u,o,!0),this.lexer.state.top=f,r.length===0)break;let v=o.at(-1);if((v==null?void 0:v.type)==="code")break;if((v==null?void 0:v.type)==="blockquote"){let k=v,g=k.raw+`
`+r.join(`
`),W=this.blockquote(g);o[o.length-1]=W,i=i.substring(0,i.length-k.raw.length)+W.raw,s=s.substring(0,s.length-k.text.length)+W.text;break}else if((v==null?void 0:v.type)==="list"){let k=v,g=k.raw+`
`+r.join(`
`),W=this.list(g);o[o.length-1]=W,i=i.substring(0,i.length-v.raw.length)+W.raw,s=s.substring(0,s.length-k.raw.length)+W.raw,r=g.substring(o.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:i,tokens:o,text:s}}}list(t){let e=this.rules.block.list.exec(t);if(e){let r=e[1].trim(),i=r.length>1,s={type:"list",raw:"",ordered:i,start:i?+r.slice(0,-1):"",loose:!1,items:[]};r=i?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=i?r:"[*+-]");let o=this.rules.other.listItemRegex(r),a=!1;for(;t;){let n=!1,h="",u="";if(!(e=o.exec(t))||this.rules.block.hr.test(t))break;h=e[0],t=t.substring(h.length);let f=Xa(e[2].split(`
`,1)[0],e[1].length),v=t.split(`
`,1)[0],k=!f.trim(),g=0;if(this.options.pedantic?(g=2,u=f.trimStart()):k?g=e[1].length+1:(g=f.search(this.rules.other.nonSpaceChar),g=g>4?1:g,u=f.slice(g),g+=e[1].length),k&&this.rules.other.blankLine.test(v)&&(h+=v+`
`,t=t.substring(v.length+1),n=!0),!n){let W=this.rules.other.nextBulletRegex(g),O=this.rules.other.hrRegex(g),$e=this.rules.other.fencesBeginRegex(g),ft=this.rules.other.headingBeginRegex(g),Ye=this.rules.other.htmlBeginRegex(g),bi=this.rules.other.blockquoteBeginRegex(g);for(;t;){let Qe=t.split(`
`,1)[0],Wt;if(v=Qe,this.options.pedantic?(v=v.replace(this.rules.other.listReplaceNesting,"  "),Wt=v):Wt=v.replace(this.rules.other.tabCharGlobal,"    "),$e.test(v)||ft.test(v)||Ye.test(v)||bi.test(v)||W.test(v)||O.test(v))break;if(Wt.search(this.rules.other.nonSpaceChar)>=g||!v.trim())u+=`
`+Wt.slice(g);else{if(k||f.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||$e.test(f)||ft.test(f)||O.test(f))break;u+=`
`+v}k=!v.trim(),h+=Qe+`
`,t=t.substring(Qe.length+1),f=Wt.slice(g)}}s.loose||(a?s.loose=!0:this.rules.other.doubleBlankLine.test(h)&&(a=!0)),s.items.push({type:"list_item",raw:h,task:!!this.options.gfm&&this.rules.other.listIsTask.test(u),loose:!1,text:u,tokens:[]}),s.raw+=h}let l=s.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;s.raw=s.raw.trimEnd();for(let n of s.items){this.lexer.state.top=!1,n.tokens=this.lexer.blockTokens(n.text,[]);let h=n.tokens[0];if(n.task&&((h==null?void 0:h.type)==="text"||(h==null?void 0:h.type)==="paragraph")){n.text=n.text.replace(this.rules.other.listReplaceTask,""),h.raw=h.raw.replace(this.rules.other.listReplaceTask,""),h.text=h.text.replace(this.rules.other.listReplaceTask,"");for(let f=this.lexer.inlineQueue.length-1;f>=0;f--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[f].src)){this.lexer.inlineQueue[f].src=this.lexer.inlineQueue[f].src.replace(this.rules.other.listReplaceTask,"");break}let u=this.rules.other.listTaskCheckbox.exec(n.raw);if(u){let f={type:"checkbox",raw:u[0]+" ",checked:u[0]!=="[ ]"};n.checked=f.checked,s.loose?n.tokens[0]&&["paragraph","text"].includes(n.tokens[0].type)&&"tokens"in n.tokens[0]&&n.tokens[0].tokens?(n.tokens[0].raw=f.raw+n.tokens[0].raw,n.tokens[0].text=f.raw+n.tokens[0].text,n.tokens[0].tokens.unshift(f)):n.tokens.unshift({type:"paragraph",raw:f.raw,text:f.raw,tokens:[f]}):n.tokens.unshift(f)}}else n.task&&(n.task=!1);if(!s.loose){let u=n.tokens.filter(v=>v.type==="space"),f=u.length>0&&u.some(v=>this.rules.other.anyLine.test(v.raw));s.loose=f}}if(s.loose)for(let n of s.items){n.loose=!0;for(let h of n.tokens)h.type==="text"&&(h.type="paragraph")}return s}}html(t){let e=this.rules.block.html.exec(t);if(e){let r=ws(e[0]);return{type:"html",block:!0,raw:r,pre:e[1]==="pre"||e[1]==="script"||e[1]==="style",text:r}}}def(t){let e=this.rules.block.def.exec(t);if(e){let r=e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),i=e[2]?e[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=e[3]?e[3].substring(1,e[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):e[3];return{type:"def",tag:r,raw:at(e[0],`
`),href:i,title:s}}}table(t){var a;let e=this.rules.block.table.exec(t);if(!e||!this.rules.other.tableDelimiter.test(e[2]))return;let r=_s(e[1]),i=e[2].replace(this.rules.other.tableAlignChars,"").split("|"),s=(a=e[3])!=null&&a.trim()?e[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],o={type:"table",raw:at(e[0],`
`),header:[],align:[],rows:[]};if(r.length===i.length){for(let l of i)this.rules.other.tableAlignRight.test(l)?o.align.push("right"):this.rules.other.tableAlignCenter.test(l)?o.align.push("center"):this.rules.other.tableAlignLeft.test(l)?o.align.push("left"):o.align.push(null);for(let l=0;l<r.length;l++)o.header.push({text:r[l],tokens:this.lexer.inline(r[l]),header:!0,align:o.align[l]});for(let l of s)o.rows.push(_s(l,o.header.length).map((n,h)=>({text:n,tokens:this.lexer.inline(n),header:!1,align:o.align[h]})));return o}}lheading(t){let e=this.rules.block.lheading.exec(t);if(e){let r=e[1].trim();return{type:"heading",raw:at(e[0],`
`),depth:e[2].charAt(0)==="="?1:2,text:r,tokens:this.lexer.inline(r)}}}paragraph(t){let e=this.rules.block.paragraph.exec(t);if(e){let r=e[1].charAt(e[1].length-1)===`
`?e[1].slice(0,-1):e[1];return{type:"paragraph",raw:e[0],text:r,tokens:this.lexer.inline(r)}}}text(t){let e=this.rules.block.text.exec(t);if(e)return{type:"text",raw:e[0],text:e[0],tokens:this.lexer.inline(e[0])}}escape(t){let e=this.rules.inline.escape.exec(t);if(e)return{type:"escape",raw:e[0],text:e[1]}}tag(t){let e=this.rules.inline.tag.exec(t);if(e)return!this.lexer.state.inLink&&this.rules.other.startATag.test(e[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(e[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(e[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(e[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:e[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:e[0]}}link(t){let e=this.rules.inline.link.exec(t);if(e){let r=e[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let o=at(r.slice(0,-1),"\\");if((r.length-o.length)%2===0)return}else{let o=Ka(e[2],"()");if(o===-2)return;if(o>-1){let a=(e[0].indexOf("!")===0?5:4)+e[1].length+o;e[2]=e[2].substring(0,o),e[0]=e[0].substring(0,a).trim(),e[3]=""}}let i=e[2],s="";if(this.options.pedantic){let o=this.rules.other.pedanticHrefTitle.exec(i);o&&(i=o[1],s=o[3])}else s=e[3]?e[3].slice(1,-1):"";return i=i.trim(),this.rules.other.startAngleBracket.test(i)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?i=i.slice(1):i=i.slice(1,-1)),ks(e,{href:i&&i.replace(this.rules.inline.anyPunctuation,"$1"),title:s&&s.replace(this.rules.inline.anyPunctuation,"$1")},e[0],this.lexer,this.rules)}}reflink(t,e){let r;if((r=this.rules.inline.reflink.exec(t))||(r=this.rules.inline.nolink.exec(t))){let i=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),s=e[i.toLowerCase()];if(!s){let o=r[0].charAt(0);return{type:"text",raw:o,text:o}}return ks(r,s,r[0],this.lexer,this.rules)}}emStrong(t,e,r=""){let i=this.rules.inline.emStrongLDelim.exec(t);if(!(!i||!i[1]&&!i[2]&&!i[3]&&!i[4]||i[4]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(i[1]||i[3])||!r||this.rules.inline.punctuation.exec(r))){let s=[...i[0]].length-1,o,a,l=s,n=0,h=i[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(h.lastIndex=0,e=e.slice(-1*t.length+s);(i=h.exec(e))!==null;){if(o=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!o)continue;if(a=[...o].length,i[3]||i[4]){l+=a;continue}else if((i[5]||i[6])&&s%3&&!((s+a)%3)){n+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l+n);let u=[...i[0]][0].length,f=t.slice(0,s+i.index+u+a);if(Math.min(s,a)%2){let k=f.slice(1,-1);return{type:"em",raw:f,text:k,tokens:this.lexer.inlineTokens(k)}}let v=f.slice(2,-2);return{type:"strong",raw:f,text:v,tokens:this.lexer.inlineTokens(v)}}}}codespan(t){let e=this.rules.inline.code.exec(t);if(e){let r=e[2].replace(this.rules.other.newLineCharGlobal," "),i=this.rules.other.nonSpaceChar.test(r),s=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return i&&s&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:e[0],text:r}}}br(t){let e=this.rules.inline.br.exec(t);if(e)return{type:"br",raw:e[0]}}del(t,e,r=""){let i=this.rules.inline.delLDelim.exec(t);if(i&&(!i[1]||!r||this.rules.inline.punctuation.exec(r))){let s=[...i[0]].length-1,o,a,l=s,n=this.rules.inline.delRDelim;for(n.lastIndex=0,e=e.slice(-1*t.length+s);(i=n.exec(e))!==null;){if(o=i[1]||i[2]||i[3]||i[4]||i[5]||i[6],!o||(a=[...o].length,a!==s))continue;if(i[3]||i[4]){l+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l);let h=[...i[0]][0].length,u=t.slice(0,s+i.index+h+a),f=u.slice(s,-s);return{type:"del",raw:u,text:f,tokens:this.lexer.inlineTokens(f)}}}}autolink(t){let e=this.rules.inline.autolink.exec(t);if(e){let r,i;return e[2]==="@"?(r=e[1],i="mailto:"+r):(r=e[1],i=r),{type:"link",raw:e[0],text:r,href:i,tokens:[{type:"text",raw:r,text:r}]}}}url(t){var r;let e;if(e=this.rules.inline.url.exec(t)){let i,s;if(e[2]==="@")i=e[0],s="mailto:"+i;else{let o;do o=e[0],e[0]=((r=this.rules.inline._backpedal.exec(e[0]))==null?void 0:r[0])??"";while(o!==e[0]);i=e[0],e[1]==="www."?s="http://"+e[0]:s=e[0]}return{type:"link",raw:e[0],text:i,href:s,tokens:[{type:"text",raw:i,text:i}]}}}inlineText(t){let e=this.rules.inline.text.exec(t);if(e){let r=this.lexer.state.inRawBlock;return{type:"text",raw:e[0],text:e[0],escaped:r}}}},G=class fr{constructor(e){T(this,"tokens");T(this,"options");T(this,"state");T(this,"inlineQueue");T(this,"tokenizer");this.tokens=[],this.tokens.links=Object.create(null),this.options=e||Ot,this.options.tokenizer=this.options.tokenizer||new Fe,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:L,block:Ee.normal,inline:Jt.normal};this.options.pedantic?(r.block=Ee.pedantic,r.inline=Jt.pedantic):this.options.gfm&&(r.block=Ee.gfm,this.options.breaks?r.inline=Jt.breaks:r.inline=Jt.gfm),this.tokenizer.rules=r}static get rules(){return{block:Ee,inline:Jt}}static lex(e,r){return new fr(r).lex(e)}static lexInline(e,r){return new fr(r).inlineTokens(e)}lex(e){e=e.replace(L.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let i=this.inlineQueue[r];this.inlineTokens(i.src,i.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,r=[],i=!1){var o,a,l;this.tokenizer.lexer=this,this.options.pedantic&&(e=e.replace(L.tabCharGlobal,"    ").replace(L.spaceLine,""));let s=1/0;for(;e;){if(e.length<s)s=e.length;else{this.infiniteLoopError(e.charCodeAt(0));break}let n;if((a=(o=this.options.extensions)==null?void 0:o.block)!=null&&a.some(u=>(n=u.call({lexer:this},e,r))?(e=e.substring(n.raw.length),r.push(n),!0):!1))continue;if(n=this.tokenizer.space(e)){e=e.substring(n.raw.length);let u=r.at(-1);n.raw.length===1&&u!==void 0?u.raw+=`
`:r.push(n);continue}if(n=this.tokenizer.code(e)){e=e.substring(n.raw.length);let u=r.at(-1);(u==null?void 0:u.type)==="paragraph"||(u==null?void 0:u.type)==="text"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.text,this.inlineQueue.at(-1).src=u.text):r.push(n);continue}if(n=this.tokenizer.fences(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.heading(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.hr(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.blockquote(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.list(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.html(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.def(e)){e=e.substring(n.raw.length);let u=r.at(-1);(u==null?void 0:u.type)==="paragraph"||(u==null?void 0:u.type)==="text"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.raw,this.inlineQueue.at(-1).src=u.text):this.tokens.links[n.tag]||(this.tokens.links[n.tag]={href:n.href,title:n.title},r.push(n));continue}if(n=this.tokenizer.table(e)){e=e.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.lheading(e)){e=e.substring(n.raw.length),r.push(n);continue}let h=e;if((l=this.options.extensions)!=null&&l.startBlock){let u=1/0,f=e.slice(1),v;this.options.extensions.startBlock.forEach(k=>{v=k.call({lexer:this},f),typeof v=="number"&&v>=0&&(u=Math.min(u,v))}),u<1/0&&u>=0&&(h=e.substring(0,u+1))}if(this.state.top&&(n=this.tokenizer.paragraph(h))){let u=r.at(-1);i&&(u==null?void 0:u.type)==="paragraph"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=u.text):r.push(n),i=h.length!==e.length,e=e.substring(n.raw.length);continue}if(n=this.tokenizer.text(e)){e=e.substring(n.raw.length);let u=r.at(-1);(u==null?void 0:u.type)==="text"?(u.raw+=(u.raw.endsWith(`
`)?"":`
`)+n.raw,u.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=u.text):r.push(n);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return this.state.top=!0,r}inline(e,r=[]){return this.inlineQueue.push({src:e,tokens:r}),r}inlineTokens(e,r=[]){var h,u,f,v,k;this.tokenizer.lexer=this;let i=e,s=null;if(this.tokens.links){let g=Object.keys(this.tokens.links);if(g.length>0)for(;(s=this.tokenizer.rules.inline.reflinkSearch.exec(i))!==null;)g.includes(s[0].slice(s[0].lastIndexOf("[")+1,-1))&&(i=i.slice(0,s.index)+"["+"a".repeat(s[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(s=this.tokenizer.rules.inline.anyPunctuation.exec(i))!==null;)i=i.slice(0,s.index)+"++"+i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let o;for(;(s=this.tokenizer.rules.inline.blockSkip.exec(i))!==null;)o=s[2]?s[2].length:0,i=i.slice(0,s.index+o)+"["+"a".repeat(s[0].length-o-2)+"]"+i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);i=((u=(h=this.options.hooks)==null?void 0:h.emStrongMask)==null?void 0:u.call({lexer:this},i))??i;let a=!1,l="",n=1/0;for(;e;){if(e.length<n)n=e.length;else{this.infiniteLoopError(e.charCodeAt(0));break}a||(l=""),a=!1;let g;if((v=(f=this.options.extensions)==null?void 0:f.inline)!=null&&v.some(O=>(g=O.call({lexer:this},e,r))?(e=e.substring(g.raw.length),r.push(g),!0):!1))continue;if(g=this.tokenizer.escape(e)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.tag(e)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.link(e)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(g.raw.length);let O=r.at(-1);g.type==="text"&&(O==null?void 0:O.type)==="text"?(O.raw+=g.raw,O.text+=g.text):r.push(g);continue}if(g=this.tokenizer.emStrong(e,i,l)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.codespan(e)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.br(e)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.del(e,i,l)){e=e.substring(g.raw.length),r.push(g);continue}if(g=this.tokenizer.autolink(e)){e=e.substring(g.raw.length),r.push(g);continue}if(!this.state.inLink&&(g=this.tokenizer.url(e))){e=e.substring(g.raw.length),r.push(g);continue}let W=e;if((k=this.options.extensions)!=null&&k.startInline){let O=1/0,$e=e.slice(1),ft;this.options.extensions.startInline.forEach(Ye=>{ft=Ye.call({lexer:this},$e),typeof ft=="number"&&ft>=0&&(O=Math.min(O,ft))}),O<1/0&&O>=0&&(W=e.substring(0,O+1))}if(g=this.tokenizer.inlineText(W)){e=e.substring(g.raw.length),g.raw.slice(-1)!=="_"&&(l=g.raw.slice(-1)),a=!0;let O=r.at(-1);(O==null?void 0:O.type)==="text"?(O.raw+=g.raw,O.text+=g.text):r.push(g);continue}if(e){this.infiniteLoopError(e.charCodeAt(0));break}}return r}infiniteLoopError(e){let r="Infinite loop on byte: "+e;if(this.options.silent)console.error(r);else throw new Error(r)}},Me=class{constructor(t){T(this,"options");T(this,"parser");this.options=t||Ot}space(t){return""}code({text:t,lang:e,escaped:r}){var o;let i=(o=(e||"").match(L.notSpaceStart))==null?void 0:o[0],s=t.replace(L.endingNewline,"")+`
`;return i?'<pre><code class="language-'+et(i)+'">'+(r?s:et(s,!0))+`</code></pre>
`:"<pre><code>"+(r?s:et(s,!0))+`</code></pre>
`}blockquote({tokens:t}){return`<blockquote>
${this.parser.parse(t)}</blockquote>
`}html({text:t}){return t}def(t){return""}heading({tokens:t,depth:e}){return`<h${e}>${this.parser.parseInline(t)}</h${e}>
`}hr(t){return`<hr>
`}list(t){let e=t.ordered,r=t.start,i="";for(let a=0;a<t.items.length;a++){let l=t.items[a];i+=this.listitem(l)}let s=e?"ol":"ul",o=e&&r!==1?' start="'+r+'"':"";return"<"+s+o+`>
`+i+"</"+s+`>
`}listitem(t){return`<li>${this.parser.parse(t.tokens)}</li>
`}checkbox({checked:t}){return"<input "+(t?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:t}){return`<p>${this.parser.parseInline(t)}</p>
`}table(t){let e="",r="";for(let s=0;s<t.header.length;s++)r+=this.tablecell(t.header[s]);e+=this.tablerow({text:r});let i="";for(let s=0;s<t.rows.length;s++){let o=t.rows[s];r="";for(let a=0;a<o.length;a++)r+=this.tablecell(o[a]);i+=this.tablerow({text:r})}return i&&(i=`<tbody>${i}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+i+`</table>
`}tablerow({text:t}){return`<tr>
${t}</tr>
`}tablecell(t){let e=this.parser.parseInline(t.tokens),r=t.header?"th":"td";return(t.align?`<${r} align="${t.align}">`:`<${r}>`)+e+`</${r}>
`}strong({tokens:t}){return`<strong>${this.parser.parseInline(t)}</strong>`}em({tokens:t}){return`<em>${this.parser.parseInline(t)}</em>`}codespan({text:t}){return`<code>${et(t,!0)}</code>`}br(t){return"<br>"}del({tokens:t}){return`<del>${this.parser.parseInline(t)}</del>`}link({href:t,title:e,tokens:r}){let i=this.parser.parseInline(r),s=ys(t);if(s===null)return i;t=s;let o='<a href="'+t+'"';return e&&(o+=' title="'+et(e)+'"'),o+=">"+i+"</a>",o}image({href:t,title:e,text:r,tokens:i}){i&&(r=this.parser.parseInline(i,this.parser.textRenderer));let s=ys(t);if(s===null)return et(r);t=s;let o=`<img src="${t}" alt="${et(r)}"`;return e&&(o+=` title="${et(e)}"`),o+=">",o}text(t){return"tokens"in t&&t.tokens?this.parser.parseInline(t.tokens):"escaped"in t&&t.escaped?t.text:et(t.text)}},jr=class{strong({text:t}){return t}em({text:t}){return t}codespan({text:t}){return t}del({text:t}){return t}html({text:t}){return t}text({text:t}){return t}link({text:t}){return""+t}image({text:t}){return""+t}br(){return""}checkbox({raw:t}){return t}},Z=class br{constructor(e){T(this,"options");T(this,"renderer");T(this,"textRenderer");this.options=e||Ot,this.options.renderer=this.options.renderer||new Me,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new jr}static parse(e,r){return new br(r).parse(e)}static parseInline(e,r){return new br(r).parseInline(e)}parse(e){var i,s;this.renderer.parser=this;let r="";for(let o=0;o<e.length;o++){let a=e[o];if((s=(i=this.options.extensions)==null?void 0:i.renderers)!=null&&s[a.type]){let n=a,h=this.options.extensions.renderers[n.type].call({parser:this},n);if(h!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(n.type)){r+=h||"";continue}}let l=a;switch(l.type){case"space":{r+=this.renderer.space(l);break}case"hr":{r+=this.renderer.hr(l);break}case"heading":{r+=this.renderer.heading(l);break}case"code":{r+=this.renderer.code(l);break}case"table":{r+=this.renderer.table(l);break}case"blockquote":{r+=this.renderer.blockquote(l);break}case"list":{r+=this.renderer.list(l);break}case"checkbox":{r+=this.renderer.checkbox(l);break}case"html":{r+=this.renderer.html(l);break}case"def":{r+=this.renderer.def(l);break}case"paragraph":{r+=this.renderer.paragraph(l);break}case"text":{r+=this.renderer.text(l);break}default:{let n='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(n),"";throw new Error(n)}}}return r}parseInline(e,r=this.renderer){var s,o;this.renderer.parser=this;let i="";for(let a=0;a<e.length;a++){let l=e[a];if((o=(s=this.options.extensions)==null?void 0:s.renderers)!=null&&o[l.type]){let h=this.options.extensions.renderers[l.type].call({parser:this},l);if(h!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(l.type)){i+=h||"";continue}}let n=l;switch(n.type){case"escape":{i+=r.text(n);break}case"html":{i+=r.html(n);break}case"link":{i+=r.link(n);break}case"image":{i+=r.image(n);break}case"checkbox":{i+=r.checkbox(n);break}case"strong":{i+=r.strong(n);break}case"em":{i+=r.em(n);break}case"codespan":{i+=r.codespan(n);break}case"br":{i+=r.br(n);break}case"del":{i+=r.del(n);break}case"text":{i+=r.text(n);break}default:{let h='Token with "'+n.type+'" type was not found.';if(this.options.silent)return console.error(h),"";throw new Error(h)}}}return i}},Ae,ee=(Ae=class{constructor(t){T(this,"options");T(this,"block");this.options=t||Ot}preprocess(t){return t}postprocess(t){return t}processAllTokens(t){return t}emStrongMask(t){return t}provideLexer(t=this.block){return t?G.lex:G.lexInline}provideParser(t=this.block){return t?Z.parse:Z.parseInline}},T(Ae,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens","emStrongMask"])),T(Ae,"passThroughHooksRespectAsync",new Set(["preprocess","postprocess","processAllTokens"])),Ae),Za=class{constructor(...t){T(this,"defaults",Dr());T(this,"options",this.setOptions);T(this,"parse",this.parseMarkdown(!0));T(this,"parseInline",this.parseMarkdown(!1));T(this,"Parser",Z);T(this,"Renderer",Me);T(this,"TextRenderer",jr);T(this,"Lexer",G);T(this,"Tokenizer",Fe);T(this,"Hooks",ee);this.use(...t)}walkTokens(t,e){var i,s;let r=[];for(let o of t)switch(r=r.concat(e.call(this,o)),o.type){case"table":{let a=o;for(let l of a.header)r=r.concat(this.walkTokens(l.tokens,e));for(let l of a.rows)for(let n of l)r=r.concat(this.walkTokens(n.tokens,e));break}case"list":{let a=o;r=r.concat(this.walkTokens(a.items,e));break}default:{let a=o;(s=(i=this.defaults.extensions)==null?void 0:i.childTokens)!=null&&s[a.type]?this.defaults.extensions.childTokens[a.type].forEach(l=>{let n=a[l].flat(1/0);r=r.concat(this.walkTokens(n,e))}):a.tokens&&(r=r.concat(this.walkTokens(a.tokens,e)))}}return r}use(...t){let e=this.defaults.extensions||{renderers:{},childTokens:{}};return t.forEach(r=>{let i={...r};if(i.async=this.defaults.async||i.async||!1,r.extensions&&(r.extensions.forEach(s=>{if(!s.name)throw new Error("extension name required");if("renderer"in s){let o=e.renderers[s.name];o?e.renderers[s.name]=function(...a){let l=s.renderer.apply(this,a);return l===!1&&(l=o.apply(this,a)),l}:e.renderers[s.name]=s.renderer}if("tokenizer"in s){if(!s.level||s.level!=="block"&&s.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let o=e[s.level];o?o.unshift(s.tokenizer):e[s.level]=[s.tokenizer],s.start&&(s.level==="block"?e.startBlock?e.startBlock.push(s.start):e.startBlock=[s.start]:s.level==="inline"&&(e.startInline?e.startInline.push(s.start):e.startInline=[s.start]))}"childTokens"in s&&s.childTokens&&(e.childTokens[s.name]=s.childTokens)}),i.extensions=e),r.renderer){let s=this.defaults.renderer||new Me(this.defaults);for(let o in r.renderer){if(!(o in s))throw new Error(`renderer '${o}' does not exist`);if(["options","parser"].includes(o))continue;let a=o,l=r.renderer[a],n=s[a];s[a]=(...h)=>{let u=l.apply(s,h);return u===!1&&(u=n.apply(s,h)),u||""}}i.renderer=s}if(r.tokenizer){let s=this.defaults.tokenizer||new Fe(this.defaults);for(let o in r.tokenizer){if(!(o in s))throw new Error(`tokenizer '${o}' does not exist`);if(["options","rules","lexer"].includes(o))continue;let a=o,l=r.tokenizer[a],n=s[a];s[a]=(...h)=>{let u=l.apply(s,h);return u===!1&&(u=n.apply(s,h)),u}}i.tokenizer=s}if(r.hooks){let s=this.defaults.hooks||new ee;for(let o in r.hooks){if(!(o in s))throw new Error(`hook '${o}' does not exist`);if(["options","block"].includes(o))continue;let a=o,l=r.hooks[a],n=s[a];ee.passThroughHooks.has(o)?s[a]=h=>{if(this.defaults.async&&ee.passThroughHooksRespectAsync.has(o))return(async()=>{let f=await l.call(s,h);return n.call(s,f)})();let u=l.call(s,h);return n.call(s,u)}:s[a]=(...h)=>{if(this.defaults.async)return(async()=>{let f=await l.apply(s,h);return f===!1&&(f=await n.apply(s,h)),f})();let u=l.apply(s,h);return u===!1&&(u=n.apply(s,h)),u}}i.hooks=s}if(r.walkTokens){let s=this.defaults.walkTokens,o=r.walkTokens;i.walkTokens=function(a){let l=[];return l.push(o.call(this,a)),s&&(l=l.concat(s.call(this,a))),l}}this.defaults={...this.defaults,...i}}),this}setOptions(t){return this.defaults={...this.defaults,...t},this}lexer(t,e){return G.lex(t,e??this.defaults)}parser(t,e){return Z.parse(t,e??this.defaults)}parseMarkdown(t){return(e,r)=>{let i={...r},s={...this.defaults,...i},o=this.onError(!!s.silent,!!s.async);if(this.defaults.async===!0&&i.async===!1)return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof e>"u"||e===null)return o(new Error("marked(): input parameter is undefined or null"));if(typeof e!="string")return o(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(e)+", string expected"));if(s.hooks&&(s.hooks.options=s,s.hooks.block=t),s.async)return(async()=>{let a=s.hooks?await s.hooks.preprocess(e):e,l=await(s.hooks?await s.hooks.provideLexer(t):t?G.lex:G.lexInline)(a,s),n=s.hooks?await s.hooks.processAllTokens(l):l;s.walkTokens&&await Promise.all(this.walkTokens(n,s.walkTokens));let h=await(s.hooks?await s.hooks.provideParser(t):t?Z.parse:Z.parseInline)(n,s);return s.hooks?await s.hooks.postprocess(h):h})().catch(o);try{s.hooks&&(e=s.hooks.preprocess(e));let a=(s.hooks?s.hooks.provideLexer(t):t?G.lex:G.lexInline)(e,s);s.hooks&&(a=s.hooks.processAllTokens(a)),s.walkTokens&&this.walkTokens(a,s.walkTokens);let l=(s.hooks?s.hooks.provideParser(t):t?Z.parse:Z.parseInline)(a,s);return s.hooks&&(l=s.hooks.postprocess(l)),l}catch(a){return o(a)}}}onError(t,e){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,t){let i="<p>An error occurred:</p><pre>"+et(r.message+"",!0)+"</pre>";return e?Promise.resolve(i):i}if(e)return Promise.reject(r);throw r}}},Et=new Za;function A(t,e){return Et.parse(t,e)}A.options=A.setOptions=function(t){return Et.setOptions(t),A.defaults=Et.defaults,Qs(A.defaults),A};A.getDefaults=Dr;A.defaults=Ot;A.use=function(...t){return Et.use(...t),A.defaults=Et.defaults,Qs(A.defaults),A};A.walkTokens=function(t,e){return Et.walkTokens(t,e)};A.parseInline=Et.parseInline;A.Parser=Z;A.parser=Z.parse;A.Renderer=Me;A.TextRenderer=jr;A.Lexer=G;A.lexer=G.lex;A.Tokenizer=Fe;A.Hooks=ee;A.parse=A;A.options;A.setOptions;A.use;A.walkTokens;A.parseInline;Z.parse;G.lex;var Ya=Object.defineProperty,Qa=Object.getOwnPropertyDescriptor,we=(t,e,r,i)=>{for(var s=i>1?void 0:i?Qa(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Ya(e,r,s),s};let re="",gr=0;function te(t){if(!t)return 0;const e=re.indexOf(t,gr);if(e===-1){const i=re.indexOf(t);return i===-1?0:(re.slice(0,i).match(/\n/g)??[]).length+1}const r=(re.slice(0,e).match(/\n/g)??[]).length+1;return gr=e+t.length,r}function $s(t){return t.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}const Ja={heading(t){const e=this.parser.parseInline(t.tokens),r=te(t.raw);return`<h${t.depth} data-source-line="${r}">${e}</h${t.depth}>
`},paragraph(t){const e=this.parser.parseInline(t.tokens);return`<p data-source-line="${te(t.raw)}">${e}</p>
`},code(t){const e=te(t.raw),r=$s(t.text),i=t.lang?` class="language-${$s(t.lang)}"`:"";return`<pre data-source-line="${e}"><code${i}>${r}</code></pre>
`},list(t){const e=te(t.raw);let r="";for(const o of t.items)r+=this.listitem(o);const i=t.ordered?"ol":"ul",s=t.ordered&&t.start!==1?` start="${t.start}"`:"";return`<${i}${s} data-source-line="${e}">
${r}</${i}>
`},blockquote(t){const e=te(t.raw),r=this.parser.parse(t.tokens);return`<blockquote data-source-line="${e}">
${r}</blockquote>
`}};let Ss=!1;function tn(){Ss||(Ss=!0,A.use({hooks:{preprocess(t){return re=t,gr=0,t}},renderer:Ja}))}let At=class extends ${constructor(){super(...arguments),this.content="",this.line=null,this.keyword="",this.pages=null}updated(t){var e;(e=super.updated)==null||e.call(this,t),(t.has("content")||t.has("keyword"))&&this._highlightKeyword(),(t.has("line")||t.has("content"))&&this._locateAndHighlight()}_locateAndHighlight(){if(this.line===null||this.line===void 0)return;const t=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));if(t.length===0)return;const e=t.reduce((i,s)=>{const o=Number(s.getAttribute("data-source-line"));return o<=this.line&&(!i||o>Number(i.getAttribute("data-source-line")))?s:i},null);if(!e)return;const r=this.getBoundingClientRect();if(r.height>0){const i=e.getBoundingClientRect(),s=i.top-r.top+this.scrollTop;this.scrollTo({top:s-r.height/2+i.height/2,behavior:"smooth"})}e.classList.remove("highlight-flash"),e.offsetWidth,e.classList.add("highlight-flash")}_highlightKeyword(){var a,l;const t=(a=this.shadowRoot)==null?void 0:a.querySelector(".md-body-paged, .md-body");if(!t)return;const e=(this.keyword??"").split(/\s+/).filter(n=>n.length>0);if(e.length===0)return;const r=new RegExp(e.map(n=>this._escapeRegExp(n)).join("|"),"gi"),i=document.createTreeWalker(t,NodeFilter.SHOW_TEXT,{acceptNode(n){const h=n.parentElement;if(!h)return NodeFilter.FILTER_REJECT;const u=h.tagName;return u==="SCRIPT"||u==="STYLE"||u==="MARK"?NodeFilter.FILTER_REJECT:r.test(n.nodeValue??"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),s=[];let o;for(;o=i.nextNode();)s.push(o);for(const n of s){r.lastIndex=0;const h=n.nodeValue??"",u=document.createDocumentFragment();let f=0,v;for(;(v=r.exec(h))!==null;){v.index>f&&u.appendChild(document.createTextNode(h.slice(f,v.index)));const k=document.createElement("mark");k.textContent=v[0],k.className="keyword-hit",u.appendChild(k),f=v.index+v[0].length,v[0].length===0&&r.lastIndex++}f<h.length&&u.appendChild(document.createTextNode(h.slice(f))),(l=n.parentNode)==null||l.replaceChild(u,n)}}_escapeRegExp(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}_splitByPages(t,e){const r=t.split(`
`),i=[];for(let s=0;s<e.length;s++){const o=e[s].line_start-1,a=s+1<e.length?e[s+1].line_start-1:r.length,l=r.slice(Math.max(0,o),Math.max(0,a)).join(`
`);i.push({label:e[s].label,md:l})}return i}render(){if(tn(),!this.content)return c`<div class="empty">无内容</div>`;if(this.pages&&this.pages.length>0){const e=this._splitByPages(this.content,this.pages);return c`<div class="md-body md-body-paged">
        ${e.map(r=>c`
          <section class="page-card">
            <header class="page-card-header">${r.label}</header>
            <div .innerHTML=${A.parse(r.md,{async:!1})}></div>
          </section>
        `)}
      </div>`}const t=A.parse(this.content,{async:!1});return c`<div class="md-body" .innerHTML=${t}></div>`}};At.styles=y`
    :host {
      display: block;
      padding: 12px 16px;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow: auto;
      height: 100%;
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
    /* 定位块的闪烁动画（"你滚到这里了"指示） */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { background: rgba(254, 243, 199, 0.8); }
      100% { background: transparent; }
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
  `;we([d()],At.prototype,"content",2);we([d({type:Number})],At.prototype,"line",2);we([d()],At.prototype,"keyword",2);we([d({attribute:!1})],At.prototype,"pages",2);At=we([E("md-viewer")],At);var en=Object.defineProperty,rn=Object.getOwnPropertyDescriptor,qt=(t,e,r,i)=>{for(var s=i>1?void 0:i?rn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&en(e,r,s),s};let ut=class extends ${constructor(){super(...arguments),this.path="",this.originalContent="",this._text="",this._dirty=!1,this._error=null,this._onSaveClick=()=>{this._dirty&&this._emitSave()},this._onCancelClick=()=>{this.discard()}}willUpdate(t){t.has("originalContent")&&(this._text=this.originalContent,this._dirty=!1,this._error=null)}get _lineCount(){return this._text===""?1:(this._text.match(/\n/g)??[]).length+1}_onInput(t){const e=t.target;this._text=e.value,this._error=null,this._updateDirty()}_onScroll(t){const e=t.target,r=this.shadowRoot.querySelector(".line-col");r&&(r.scrollTop=e.scrollTop)}_onKeyDown(t){(t.ctrlKey||t.metaKey)&&t.key==="s"&&(t.preventDefault(),this._dirty&&this._emitSave())}_updateDirty(){const t=this._text!==this.originalContent;t!==this._dirty&&(this._dirty=t,this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:t}})))}_emitSave(){this.dispatchEvent(new CustomEvent("save",{detail:{content:this._text}}))}discard(){this._text=this.originalContent,this._dirty=!1,this._error=null,this._updateDirty(),this.dispatchEvent(new CustomEvent("cancel",{}))}setError(t){this._error=t}render(){const t=[];for(let e=1;e<=this._lineCount;e++)t.push(e);return c`
      <div class="toolbar">
        <span class="path">${this.path}</span>
        ${this._error?c`<span class="error-msg">⚠ ${this._error}</span>`:this._dirty?c`<span class="dirty">●未保存</span>`:null}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          💾 保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}>✖ 取消</button>
      </div>
      <div class="body">
        <div class="line-col">
          ${t.map(e=>c`<span class="line-no">${e}</span>`)}
        </div>
        <textarea
          spellcheck="false"
          .value=${this._text}
          @input=${this._onInput}
          @scroll=${this._onScroll}
          @keydown=${this._onKeyDown}
        ></textarea>
      </div>
    `}};ut.styles=y`
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
  `;qt([d()],ut.prototype,"path",2);qt([d()],ut.prototype,"originalContent",2);qt([x()],ut.prototype,"_text",2);qt([x()],ut.prototype,"_dirty",2);qt([x()],ut.prototype,"_error",2);ut=qt([E("md-editor")],ut);class li extends Error{constructor(e,r,i){super(r),this.code=e,this.status=i,this.name="PreviewSaveError"}}async function sn(t,e){const r=await fetch(`/api/preview?path=${encodeURIComponent(t)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:e})});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new li(i.code??"UNKNOWN",i.detail??"保存失败",r.status)}return r.json()}class ci extends Error{constructor(e,r,i){super(r),this.code=e,this.status=i,this.name="PreviewUploadError"}}async function on(t){const e=new FormData;e.append("file",t);const r=await fetch("/api/preview/upload",{method:"POST",body:e});if(!r.ok){const i=await r.json().catch(()=>({code:"UNKNOWN",detail:r.statusText}));throw new ci(i.code??"UNKNOWN",i.detail??"上传失败",r.status)}return r.json()}var an=Object.defineProperty,nn=Object.getOwnPropertyDescriptor,q=(t,e,r,i)=>{for(var s=i>1?void 0:i?nn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&an(e,r,s),s};let I=class extends ${constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1,this.line=null,this.keyword="",this.writable=!1,this.noHeader=!1,this.pages=null,this._mode="preview",this._content="",this._onEditorCancel=()=>{this._mode="preview"},this._onEditorDirty=t=>{this.dispatchEvent(new CustomEvent("dirty-change",{detail:{dirty:t.detail.dirty}}))},this._onDownloadClick=()=>{if(!this.path)return;const t=`/api/preview/download?path=${encodeURIComponent(this.path)}`,e=document.createElement("a");e.href=t,e.rel="noopener",document.body.appendChild(e),e.click(),document.body.removeChild(e)},this._onUploadClick=()=>{var e;const t=(e=this.shadowRoot)==null?void 0:e.querySelector('input[type="file"]');t==null||t.click()}}willUpdate(t){t.has("content")&&(this._content=this.content,this._mode="preview")}enterEdit(){this._mode="edit"}async _onEditorSave(t){const e=this.shadowRoot.querySelector("md-editor");try{await sn(this.path,t.detail.content),this._content=t.detail.content,this._mode="preview",this.dispatchEvent(new CustomEvent("saved",{detail:{content:t.detail.content}}))}catch(r){const i=r instanceof li?`${r.code} ${r.message}`:r.message??"保存失败";e==null||e.setError(i),this.dispatchEvent(new CustomEvent("save-failed",{detail:{message:i}}))}}discard(){const t=this.shadowRoot.querySelector("md-editor");t==null||t.discard(),this._mode="preview"}_renderDownloadBtn(){return c`<button class="download-btn" @click=${this._onDownloadClick}>⬇️ 下载</button>`}async _onFileChange(t){var s;const e=t.target,r=(s=e.files)==null?void 0:s[0];if(e.value="",!(!r||!window.confirm(`即将上传 '${r.name}' 覆盖原文件，是否继续？`)))try{const o=await on(r);this.dispatchEvent(new CustomEvent("upload-success",{detail:{path:o.path}}))}catch(o){const a=o instanceof ci?`${o.code} ${o.message}`:o.message??"上传失败";this.dispatchEvent(new CustomEvent("upload-failed",{detail:{message:a}}))}}_renderUploadBtn(){return c`<button class="upload-btn" @click=${this._onUploadClick}>⬆️ 上传</button>`}render(){if(this.loading)return c`<div class="empty">加载中...</div>`;if(!this._content&&!this.content)return c`<div class="empty">点击左侧结果查看预览</div>`;if(this.language==="markdown"&&this._mode==="edit")return c`
        <input type="file" hidden @change=${this._onFileChange}>
        ${this.noHeader?null:c`
          <div class="header">
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        `}
        <md-editor
          .path=${this.path}
          .originalContent=${this._content}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
      `;if(this.language==="markdown")return c`
        <input type="file" hidden @change=${this._onFileChange}>
        ${this.noHeader?null:c`
          <div class="header">
            <span class="path">${this.path}</span>
            ${this.writable?c`<button class="edit-btn" @click=${()=>this.enterEdit()}>✏️ 编辑</button>`:null}
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        `}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this.keyword}
          .pages=${this.pages}
        ></md-viewer>
      `;const t=this._content.split(`
`);return c`
      <input type="file" hidden @change=${this._onFileChange}>
      ${this.noHeader?null:c`
        <div class="header">
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      `}
      <div class="body">
        ${t.map((e,r)=>{const i=r+1,s=this.highlights.includes(i)?"highlight":"";return c`<div class=${s}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${i}</span>${e}</div>`})}
      </div>
    `}};I.styles=y`
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
  `;q([d()],I.prototype,"path",2);q([d()],I.prototype,"language",2);q([d()],I.prototype,"content",2);q([d({attribute:!1})],I.prototype,"highlights",2);q([d({type:Boolean})],I.prototype,"loading",2);q([d({type:Number})],I.prototype,"line",2);q([d()],I.prototype,"keyword",2);q([d({type:Boolean})],I.prototype,"writable",2);q([d({type:Boolean})],I.prototype,"noHeader",2);q([d({attribute:!1})],I.prototype,"pages",2);q([x()],I.prototype,"_mode",2);q([x()],I.prototype,"_content",2);I=q([E("preview-pane")],I);var ln=Object.defineProperty,cn=Object.getOwnPropertyDescriptor,Ke=(t,e,r,i)=>{for(var s=i>1?void 0:i?cn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&ln(e,r,s),s};let Ft=class extends ${constructor(){super(...arguments),this.role="user",this.message=null,this.error=null}render(){return this.message?c`
      <div class="bubble">${this.message.content}${this.message.content===""?c`<span style="opacity:0.6">思考中...</span>`:null}</div>
      ${this.error?c`<div class="error">⚠️ ${this.error}</div>`:null}
    `:null}};Ft.styles=y`
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
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
  `;Ke([d({reflect:!0})],Ft.prototype,"role",2);Ke([d({attribute:!1})],Ft.prototype,"message",2);Ke([d()],Ft.prototype,"error",2);Ft=Ke([E("chat-message")],Ft);var dn=Object.defineProperty,un=Object.getOwnPropertyDescriptor,di=(t,e,r,i)=>{for(var s=i>1?void 0:i?un(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&dn(e,r,s),s};let je=class extends ${constructor(){super(...arguments),this.messages=[]}updated(){this.scrollTop=this.scrollHeight}render(){return this.messages.length===0?c`<div class="empty">开始与 Cortex 对话</div>`:c`
      ${this.messages.map(t=>c`<chat-message role=${t.role} .message=${t}></chat-message>`)}
    `}};je.styles=y`
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
  `;di([d({attribute:!1})],je.prototype,"messages",2);je=di([E("chat-stream")],je);class ui extends Error{constructor(e,r,i){super(i),this.status=e,this.code=r,this.name="ApiError"}}async function F(t,e={}){const r={...e};e.json!==void 0&&(r.headers={"Content-Type":"application/json",...e.headers||{}},r.body=JSON.stringify(e.json));const i=await fetch(t,r);if(!i.ok){let s;try{s=await i.json()}catch{s={code:"unknown",detail:i.statusText}}throw new ui(i.status,s.code??"unknown",s.detail??"请求失败")}return i.json()}async function*hn(t,e){const r=await fetch(t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!r.ok||!r.body)throw new ui(r.status,"stream_failed","流式请求失败");const i=r.body.getReader(),s=new TextDecoder;let o="";for(;;){const{value:a,done:l}=await i.read();if(l)break;for(o+=s.decode(a,{stream:!0});;){const n=o.match(/\r\n\r\n|\r\r|\n\n/);if(!n||n.index===void 0)break;const h=n.index,u=n[0].length,f=o.slice(0,h);o=o.slice(h+u);let v="message",k="";for(const g of f.split(/\r\n|\r|\n/))g.startsWith("event:")?v=g.slice(6).trim():g.startsWith("data:")&&(k+=g.slice(5).trim());yield{event:v,data:k}}}}async function Cs(t){return F("/api/search",{method:"POST",json:t})}async function pn(t){return F("/api/sessions",{method:"POST",json:t})}async function fn(t){return F("/api/sessions/find-or-create",{method:"POST",json:t})}async function hi(t){const e=new URLSearchParams;return t.type&&e.set("type",t.type),t.limit&&e.set("limit",String(t.limit)),t.offset&&e.set("offset",String(t.offset)),F(`/api/sessions?${e}`,{method:"GET"})}async function bn(t,e,r){return F(`/api/sessions/${t}`,{method:"PATCH",json:{items:e,message_count:r}})}async function pi(t){const e=new URLSearchParams;return t&&e.set("type",t),F(`/api/sessions?${e}`,{method:"DELETE"})}var gn=Object.defineProperty,vn=Object.getOwnPropertyDescriptor,ke=(t,e,r,i)=>{for(var s=i>1?void 0:i?vn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&gn(e,r,s),s};let Pt=class extends ${constructor(){super(...arguments),this.total=0,this.offset=0,this.limit=20,this.disabled=!1}get currentPage(){return this.limit<=0?1:Math.floor(this.offset/this.limit)+1}get totalPages(){return this.limit<=0?1:Math.max(1,Math.ceil(this.total/this.limit))}_emitPage(t){this.disabled||t<1||t>this.totalPages||this.dispatchEvent(new CustomEvent("page-change",{detail:{page:t}}))}_pageSlots(){const t=this.totalPages,e=this.currentPage;if(t<=7)return Array.from({length:t},(o,a)=>a+1);const r=[1],i=Math.max(2,e-1),s=Math.min(t-1,e+1);i>2&&r.push("...");for(let o=i;o<=s;o++)r.push(o);return s<t-1&&r.push("..."),r.push(t),r}render(){if(this.total<=this.limit)return c``;const t=this._pageSlots();return c`
      <div class="meta">
        共 ${this.total} 条 · 第 ${this.currentPage}/${this.totalPages} 页
      </div>
      <div class="pages">
        <button
          ?disabled=${this.disabled||this.currentPage===1}
          @click=${()=>this._emitPage(this.currentPage-1)}
          aria-label="上一页">‹</button>
        ${t.map(e=>e==="..."?c`<span class="ellipsis">…</span>`:c`<button
                class=${e===this.currentPage?"current":""}
                ?disabled=${this.disabled}
                @click=${()=>this._emitPage(e)}>${e}</button>`)}
        <button
          ?disabled=${this.disabled||this.currentPage===this.totalPages}
          @click=${()=>this._emitPage(this.currentPage+1)}
          aria-label="下一页">›</button>
      </div>
    `}};Pt.styles=y`
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
  `;ke([d({type:Number})],Pt.prototype,"total",2);ke([d({type:Number})],Pt.prototype,"offset",2);ke([d({type:Number})],Pt.prototype,"limit",2);ke([d({type:Boolean})],Pt.prototype,"disabled",2);Pt=ke([E("pagination-bar")],Pt);var mn=Object.defineProperty,xn=Object.getOwnPropertyDescriptor,fi=(t,e,r,i)=>{for(var s=i>1?void 0:i?xn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&mn(e,r,s),s};let Ue=class extends ${constructor(){super(...arguments),this._toasts=[],this._nextId=1,this._timers=new Map}pushToast(t,e="info",r=2500){const i=this._nextId++;if(this._toasts=[...this._toasts,{id:i,message:t,level:e,duration:r}],r>0){const s=window.setTimeout(()=>this.dismiss(i),r);this._timers.set(i,s)}}dismiss(t){const e=this._timers.get(t);e!==void 0&&(window.clearTimeout(e),this._timers.delete(t)),this._toasts=this._toasts.filter(r=>r.id!==t)}disconnectedCallback(){super.disconnectedCallback();for(const t of this._timers.values())window.clearTimeout(t);this._timers.clear()}render(){return c`
      ${this._toasts.map(t=>c`
          <div class="toast ${t.level}" @click=${()=>this.dismiss(t.id)}>
            <span class="msg">${t.message}</span>
          </div>
        `)}
    `}};Ue.styles=y`
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
  `;fi([x()],Ue.prototype,"_toasts",2);Ue=fi([E("toast-stack")],Ue);var yn=Object.defineProperty,_n=Object.getOwnPropertyDescriptor,j=(t,e,r,i)=>{for(var s=i>1?void 0:i?_n(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&yn(e,r,s),s};const wn=[".md",".pdf",".docx",".xlsx",".xlsm",".xltx",".xltm",".csv"];function kn(t){const e=t.toLowerCase();return wn.some(r=>e.endsWith(r))}let z=class extends ${constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewLine=null,this.historySessions=[],this._clearing=!1,this.previewError=null,this.previewDirty=!1,this.previewWritable=!1,this.previewPages=null,this._resultsPaneWidth=z.RESULTS_PANE_WIDTH_DEFAULT,this._onSplitterMouseDown=t=>{t.preventDefault();const e=t.clientX,r=this._resultsPaneWidth;document.body.style.cursor="col-resize",document.body.style.userSelect="none";const i=o=>{const a=o.clientX-e,l=Math.max(z.RESULTS_PANE_WIDTH_MIN,Math.min(z.RESULTS_PANE_WIDTH_MAX,r+a));l!==this._resultsPaneWidth&&(this._resultsPaneWidth=l)},s=()=>{document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",s),document.body.style.cursor="",document.body.style.userSelect="",localStorage.setItem(z.RESULTS_PANE_WIDTH_KEY,String(this._resultsPaneWidth))};document.addEventListener("mousemove",i),document.addEventListener("mouseup",s)},this._onPageChange=t=>{this._goToPage(t.detail.page)},this._onPreviewDirty=t=>{this.previewDirty=t.detail.dirty},this._onPreviewSaved=()=>{this.previewDirty=!1,this._pushToast("已保存","success",2500)},this._onPreviewSaveFailed=t=>{this._pushToast(`保存失败：${t.detail.message}`,"error",5e3)},this._onPreviewUploadSuccess=t=>{this.previewDirty=!1,this._pushToast(`已覆盖：${t.detail.path}`,"success",2500),this._reloadPreview()},this._onPreviewUploadFailed=t=>{this._pushToast(`上传失败：${t.detail.message}`,"error",5e3)}}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._loadResultsPaneWidth();const t=b.getState().pendingSession;t&&t.type==="search"&&(m.setPendingSession(null),this._loadSession(t))}_loadResultsPaneWidth(){const t=localStorage.getItem(z.RESULTS_PANE_WIDTH_KEY);if(!t)return;const e=Number(t);Number.isNaN(e)||(this._resultsPaneWidth=Math.max(z.RESULTS_PANE_WIDTH_MIN,Math.min(z.RESULTS_PANE_WIDTH_MAX,e)))}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._unsubscribe)==null||t.call(this)}async _loadHistory(){try{const{sessions:t}=await hi({type:"search",limit:20});this.historySessions=t}catch(t){console.warn("load history failed",t)}}async _onClearHistory(){await this._safeAction(async()=>{this._clearing=!0,this.requestUpdate();try{await pi("search"),this.historySessions=[]}catch(t){console.warn("clear sessions failed",t)}finally{this._clearing=!1,this.requestUpdate()}})}get viewState(){return b.getState().search}async _submit(t){await this._safeAction(async()=>{const e=typeof t=="string"?t:t.detail.value;this.localQuery=e,b.setState({detailStack:[]}),this.previewContent="",this.previewPath="",this.previewError=null,this.previewPages=null,m.setSearchState({state:"focus",query:e,results:[],total:0,offset:0,limit:20,source:"fts"}),this.loading=!0;try{const r=await Cs({query:e,offset:0,limit:20});m.setSearchState({state:"focus",query:e,results:r.results,total:r.total,offset:0,limit:20,source:r.source}),this._autoPreviewFirstDesktop(r.results),fn({type:"search",title:e,preview:e.slice(0,100)}).then(i=>{m.setSearchState({currentSession:{id:i.id,type:"search",title:e,preview:e.slice(0,100),updated_at:new Date().toISOString(),message_count:0}}),this._loadHistory()}).catch(i=>{console.warn("find-or-create session failed",i)})}catch(r){m.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}})}async _backToInitial(){await this._safeAction(()=>{m.setSearchState({state:"initial",currentSession:null,results:[],query:""}),this.localQuery="",this._loadHistory()})}async _goToPage(t){const e=b.getState().search;if(!e.query||e.state!=="focus")return;const r=e.limit||20,i=Math.max(0,(t-1)*r);if(i!==e.offset){this.loading=!0;try{const s=await Cs({query:e.query,offset:i,limit:r});m.setSearchState({state:"focus",query:e.query,results:s.results,total:s.total,offset:s.offset,limit:r,source:s.source}),this.previewContent="",this.previewPath="",this.previewLine=null}catch(s){m.setError(`翻页失败: ${s.message}`)}finally{this.loading=!1}}}async _onResultSelect(t){await this._safeAction(async()=>{const e=t.detail.result;m.pushDetail(e),await this._fetchAndShowPreview(e)})}async _fetchAndShowPreview(t){this.previewError=null;try{const e=new URLSearchParams({path:t.path}),r=kn(t.path);t.line&&!r&&(e.set("start_line",String(Math.max(1,t.line-10))),e.set("end_line",String(t.line+20)));const i=await fetch(`/api/preview?${e}`);if(i.ok){const s=await i.json();this.previewContent=s.content,this.previewPath=s.path,this.previewLanguage=s.language,this.previewLine=t.line??null,this.previewWritable=s.writable??!1,this.previewPages=s.pages??null}else(await i.json().catch(()=>({code:"UNKNOWN",detail:""}))).code==="NOT_INDEXED"&&(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=t.path,this.previewWritable=!1,this.previewPages=null)}catch(e){console.warn("preview failed",e)}}_autoPreviewFirstDesktop(t){typeof window>"u"||window.innerWidth<1024||t.length!==0&&this._fetchAndShowPreview(t[0])}_discardPreviewEdits(){var e,r;const t=(e=this.shadowRoot)==null?void 0:e.querySelector("preview-pane");(r=t==null?void 0:t.discard)==null||r.call(t),this.previewDirty=!1}_enterPreviewEdit(){var e,r;const t=(e=this.shadowRoot)==null?void 0:e.querySelector(".detail-overlay preview-pane");(r=t==null?void 0:t.enterEdit)==null||r.call(t)}async _safeAction(t){if(this.previewDirty){if(!window.confirm(`当前文件有未保存的修改。
确定要丢弃吗？`))return;this._discardPreviewEdits()}await t()}async _reloadPreview(){if(this.previewPath)try{const t=await fetch(`/api/preview?path=${encodeURIComponent(this.previewPath)}`);if(t.ok){const e=await t.json();this.previewContent=e.content,this.previewLanguage=e.language,this.previewWritable=e.writable??!1,this.previewPages=e.pages??null}}catch(t){console.warn("reload preview failed",t)}}_pushToast(t,e,r){var s;const i=(s=this.shadowRoot)==null?void 0:s.querySelector("toast-stack");i==null||i.pushToast(t,e,r)}_popDetail(){m.popDetail()}_renderNotIndexedHint(t){return c`<div class=${t?"desktop-only not-indexed-hint":"not-indexed-hint"}>
      该文件未索引，无法预览。<br>请先执行 cortex index 后重试。
    </div>`}async _loadSession(t){await this._submit(t.title)}_onHistorySelect(t){this._loadSession(t.detail.session)}render(){const t=this.viewState;if(t.state==="initial")return c`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="结构感知文档检索"></welcome-pane>
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
              placeholder="输入搜索关键词..."
              button-label="搜索"
              button-icon="🔍"
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${i=>this.localQuery=i.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const e=b.getState().detailStack[b.getState().detailStack.length-1],r=this.loading?"搜索中":`${t.total} 条结果${t.source==="fts"?"":` (${t.source.toUpperCase()})`}`;return c`
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
              .activePath=${(e==null?void 0:e.path)??this.previewPath??null}
              .activeLine=${(e==null?void 0:e.line)??this.previewLine??null}
              @select=${this._onResultSelect}>
            </search-results>
            ${t.total>t.limit?c`<pagination-bar
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
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!0):c`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${t.query}
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
      ${e?c`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${e.path}
            .actions=${this.previewWritable?[{label:"编辑",icon:"✏️",onClick:()=>this._enterPreviewEdit()}]:[]}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!1):c`<preview-pane
                ?noHeader=${!0}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${t.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>`:null}
    `}};z.RESULTS_PANE_WIDTH_KEY="cortex.resultsPaneWidth";z.RESULTS_PANE_WIDTH_DEFAULT=360;z.RESULTS_PANE_WIDTH_MIN=280;z.RESULTS_PANE_WIDTH_MAX=800;z.styles=y`
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
  `;j([x()],z.prototype,"localQuery",2);j([x()],z.prototype,"loading",2);j([x()],z.prototype,"previewContent",2);j([x()],z.prototype,"previewPath",2);j([x()],z.prototype,"previewLanguage",2);j([x()],z.prototype,"previewLine",2);j([x()],z.prototype,"historySessions",2);j([x()],z.prototype,"_clearing",2);j([x()],z.prototype,"previewError",2);j([x()],z.prototype,"previewDirty",2);j([x()],z.prototype,"previewWritable",2);j([x()],z.prototype,"previewPages",2);j([x()],z.prototype,"_resultsPaneWidth",2);z=j([E("search-view")],z);async function*$n(t){for await(const e of hn("/api/chat",t))if(e.event==="token")try{yield{type:"token",text:JSON.parse(e.data).text}}catch{}else if(e.event==="done")yield{type:"done"};else if(e.event==="error")try{yield{type:"error",detail:JSON.parse(e.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}var Sn=Object.defineProperty,Cn=Object.getOwnPropertyDescriptor,Xe=(t,e,r,i)=>{for(var s=i>1?void 0:i?Cn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Sn(e,r,s),s};let Mt=class extends ${constructor(){super(...arguments),this.draft="",this.historySessions=[],this._clearing=!1}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=b.subscribe(()=>this.requestUpdate());const t=b.getState().pendingSession;t&&t.type==="chat"&&(m.setPendingSession(null),this._loadSession(t))}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._unsubscribe)==null||t.call(this)}async _loadHistory(){try{const{sessions:t}=await hi({type:"chat",limit:20});this.historySessions=t}catch(t){console.warn("load history failed",t)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await pi("chat"),this.historySessions=[]}catch(t){console.warn("clear sessions failed",t)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return b.getState().chat}async _submit(t){const e=t.detail.value;if(this.draft="",this.viewState.state==="initial"){const i=await pn({type:"chat",title:e.slice(0,60),preview:e.slice(0,100)});m.setChatState({state:"focus",currentSession:{id:i.id,type:"chat",title:e.slice(0,60),preview:e.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:e}],streaming:!0})}else m.setChatState({messages:[...this.viewState.messages,{role:"user",content:e}],streaming:!0});const r=b.getState().chat.currentSession.id;m.setChatState({messages:[...b.getState().chat.messages,{role:"assistant",content:""}]});try{let i="";for await(const s of $n({message:e,session_id:r}))if(s.type==="token"){i+=s.text;const o=[...b.getState().chat.messages];o[o.length-1]={role:"assistant",content:i},m.setChatState({messages:o})}else if(s.type==="error"){const o=[...b.getState().chat.messages];o[o.length-1]={role:"assistant",content:i+`

⚠️ ${s.detail}`},m.setChatState({messages:o})}await bn(r,[{kind:"message_user",payload:JSON.stringify({content:e})},{kind:"message_ai",payload:JSON.stringify({content:i})}],b.getState().chat.messages.length),this._loadHistory()}catch(i){m.setError(`对话失败: ${i.message}`)}finally{m.setChatState({streaming:!1})}}_backToInitial(){m.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}async _loadSession(t){m.setChatState({state:"focus",currentSession:t,messages:[]});try{const e=await fetch(`/api/sessions/${t.id}`);if(e.ok){const i=((await e.json()).items||[]).map(s=>{const o=JSON.parse(s.payload);return{role:s.kind==="message_user"?"user":"assistant",content:o.content}});m.setChatState({messages:i})}}catch(e){console.warn("load session failed",e)}}_onHistorySelect(t){this._loadSession(t.detail.session)}render(){var e;const t=this.viewState;return t.state==="initial"?c`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="与你的知识库对话"></welcome-pane>
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
              placeholder="问 Cortex 任何问题..."
              button-label="→"
              multiline
              .value=${this.draft}
              @input-change=${r=>this.draft=r.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `:c`
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${((e=t.currentSession)==null?void 0:e.title)??""}
          meta=${`${t.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <chat-stream .messages=${t.messages}></chat-stream>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            button-label="→"
            multiline
            ?disabled=${t.streaming}
            .value=${this.draft}
            @input-change=${r=>this.draft=r.detail.value}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
    `}};Mt.styles=y`
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
    @media (min-width: 1024px) {
      /* 桌面端：居中列布局，避免全宽拉伸 */
      .initial-stack {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
      chat-stream {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
      .input-bar {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;Xe([x()],Mt.prototype,"draft",2);Xe([x()],Mt.prototype,"historySessions",2);Xe([x()],Mt.prototype,"_clearing",2);Mt=Xe([E("chat-view")],Mt);const En={ai:"AI 配置",search:"搜索调优",scoring:"评分",terminal:"终端"},An=[{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_BASE_URL",label:"API Base URL",component:"text",effect:"restart",mono:!0,hint:"Anthropic API 端点。可替换为兼容代理或本地模型服务。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_API_KEY",label:"API Key",component:"password",effect:"restart",mono:!0,hint:"Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_MODEL_ID",label:"模型 ID",component:"text",effect:"restart",mono:!0,datalist:["claude-opus-4-6","claude-sonnet-4-6","claude-haiku-4-5"],hint:"支持自动补全常见模型；也可手动输入自定义模型 ID。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_RESULTS",label:"最大结果数（跨文档）",component:"number",effect:"live",min:1,max:200,hint:"search 工具返回的最大文档数量。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_NODES_PER_DOC",label:"每文档最大节点数",component:"number",effect:"live",min:1,max:20,hint:"同一文档返回的最大节点（段落）数。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MAX_SPAN",label:"关键词最大跨度",component:"number",effect:"live",min:1,max:100,hint:"窗口内匹配关键词的最大字符跨度。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORD_MATCH",label:"最少关键词匹配数",component:"number",effect:"live",min:0,max:10,hint:"文档至少命中多少个关键词才进入候选。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_PROXIMITY_SCORE",label:"最低邻近度阈值",component:"select",effect:"live",options:[{value:"0",label:"0 — 不限制"},{value:"1",label:"1 — 部分紧邻"},{value:"2",label:"2 — 全部关键词紧邻"}],hint:"关键词在文档中的邻近程度阈值。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORDS_PER_LINE",label:"行级关键词阈值",component:"number",effect:"live",min:1,max:10,hint:'单行至少命中多少关键词才被选为"最佳行"。'},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_SCORE_THRESHOLD",label:"综合评分阈值",component:"number",effect:"live",min:0,max:1,step:.05,hint:"0 = 不过滤；0.3 = 轻微过滤；0.5+ 容易砍光多关键词结果。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_KEYWORD_MATCH",label:"关键词匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏好'命中的关键词数量多'的文档（多关键词 query 时尤其重要）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FILE_NAME_MATCH",label:"文件名匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，文件名包含关键词的文档排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FTS_SCORE",label:"FTS 原始分权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏向传统全文检索 BM25 排序（与关键词匹配度正相关）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_TITLE_MATCH",label:"标题匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，节点标题（如 Markdown 小节标题）含关键词时排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_PROXIMITY_MATCH",label:"邻近度权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，多关键词在文档中紧邻出现的文档越受偏好。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_CONTEXT_LINES",label:"上下文行数上限",component:"number",unit:"行",min:0,max:100,hint:"每个命中行向上/向下最多各显示多少行原文上下文。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_ANCHOR_LINES",label:"锚点行数上限",component:"number",unit:"行",min:1,max:50,hint:"从同一文档的所有命中行里，挑出多少个'最佳行'作为展示中心（锚点）。锚点越多，结果越完整但输出越长。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_CONTEXT_EXPAND_RANGE",label:"锚点上下文扩展范围",component:"number",unit:"行",min:0,max:100,hint:"以每个锚点为中心，向前/向后各展开多少行作为上下文（再与'上下文行数上限'取较小值）。"}];class de extends Error{constructor(e,r){super(`Config API error ${e}`),this.status=e,this.body=r}}async function Pn(t){const e=await fetch(`/api/config?scope=${t}`,{method:"GET"}),r=await e.json().catch(()=>null);if(!e.ok)throw new de(e.status,r);return r}async function Tn(t,e){const r=await fetch(`/api/config?scope=${t}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:e})}),i=await r.json().catch(()=>null);if(!r.ok)throw new de(r.status,i);return i}async function zn(){const t=await fetch("/api/config/copy-from-global",{method:"POST"}),e=await t.json().catch(()=>null);if(!t.ok)throw new de(t.status,e);return e}var On=Object.defineProperty,Dn=Object.getOwnPropertyDescriptor,ot=(t,e,r,i)=>{for(var s=i>1?void 0:i?Dn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&On(e,r,s),s};const Es=["ai","search","scoring","terminal"];let Q=class extends ${constructor(){super(...arguments),this._activeTab="ai",this._saving=!1,this._error=null,this._toast=null,this._values={},this._original={},this._exists=!0,this._scope="local",this._loadGen=0}connectedCallback(){super.connectedCallback();const t=b.getState();this._scope=t.settings.scope,this._unsubscribe=b.subscribe(()=>this._onStoreChange()),this._load()}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),this._toastTimer!==void 0&&(window.clearTimeout(this._toastTimer),this._toastTimer=void 0),this._loadGen+=1,super.disconnectedCallback()}_onStoreChange(){const t=b.getState();t.settings.scope!==this._scope&&(this._scope=t.settings.scope,this._load())}async _load(){const t=++this._loadGen;this._error=null;try{const e=await Pn(this._scope);if(t!==this._loadGen||!this.isConnected)return;this._values={...e.values},this._original={...e.values},this._exists=e.exists,m.loadSettings(e.values,e.exists)}catch(e){if(t!==this._loadGen||!this.isConnected)return;this._error=`加载失败: ${e.message}`}}get _dirtyFields(){const t=new Set([...Object.keys(this._original),...Object.keys(this._values)]),e=[];for(const r of t)(this._original[r]??"")!==(this._values[r]??"")&&e.push(r);return e}get _dirty(){return this._dirtyFields.length>0}_onInput(t,e){this._values={...this._values,[t]:e},m.updateSetting(t,e)}_revert(){this._values={...this._original},m.revertSettings()}async _copyFromGlobal(){try{await zn(),await this._load()}catch(t){t instanceof de?this._error=`复制失败 (HTTP ${t.status})`:t instanceof Error?this._error=`复制失败: ${t.message}`:this._error="复制失败: 未知错误"}}async _save(){var t;if(!(!this._dirty||this._saving)){this._saving=!0,this._error=null;try{const e=await Tn(this._scope,this._values);if(!this.isConnected)return;this._original={...this._values},m.loadSettings(this._values,!0),this._toast=e.needs_restart?"已保存。重启 cortex gui 后 AI 配置生效。":"已保存。下次查询立即生效。",this._toastTimer=window.setTimeout(()=>{this._toast=null,this._toastTimer=void 0},4e3)}catch(e){let r;if(e instanceof de){const i=e.body,s=(t=i==null?void 0:i.fields)==null?void 0:t.map(o=>o.field).join(", ");r=s?`保存失败（${s}）`:`保存失败 (HTTP ${e.status})`}else e instanceof Error?r=`保存失败: ${e.message}`:r="保存失败: 未知错误";this._error=r}finally{this._saving=!1}}}_renderField(t){const e=this._values[t.envVar]??"",r=t.effect?c`<span class="effect ${t.effect}">${t.effect==="restart"?"🔁 需重启":"● 即时"}</span>`:w;return c`
      <div class="field">
        <div class="field-label">
          <div class="name">${t.label} ${r}</div>
          <div class="env">${t.envVar}${t.min!==void 0&&t.max!==void 0?` · 范围 ${t.min}~${t.max}`:""}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(t,e)}</div>
          ${t.hint?c`<div class="hint">${t.hint}</div>`:w}
        </div>
      </div>
    `}_renderInput(t,e){const r=t.mono?"mono":"",i=s=>this._onInput(t.envVar,s.target.value);switch(t.component){case"text":return c`
          <input
            class="input ${r}"
            type="text"
            .value=${e}
            data-env=${t.envVar}
            @input=${i}
            list=${t.datalist?`${t.envVar}-list`:w}
          />
          ${t.datalist?c`
            <datalist id=${`${t.envVar}-list`}>
              ${t.datalist.map(s=>c`<option value=${s}></option>`)}
            </datalist>
          `:w}
        `;case"password":return c`
          <div style="position: relative; max-width: 420px;">
            <input
              class="input ${r}"
              type="password"
              .value=${e}
              data-env=${t.envVar}
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
            .value=${e}
            min=${t.min??w}
            max=${t.max??w}
            step=${t.step??w}
            data-env=${t.envVar}
            @input=${i}
          />
          ${t.unit?c`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${t.unit}</span>`:w}
        `;case"select":return c`
          <select class="select" .value=${e} data-env=${t.envVar} @change=${i}>
            ${(t.options??[]).map(s=>c`
              <option value=${s.value} ?selected=${s.value===e}>${s.label}</option>
            `)}
          </select>
        `;case"slider":return c`
          <input
            class="input"
            type="number"
            .value=${e}
            min=${t.min??w}
            max=${t.max??w}
            step=${t.step??w}
            style="width: 100px;"
            data-env=${t.envVar}
            @input=${i}
          />
          <input
            type="range"
            .value=${e}
            min=${t.min??w}
            max=${t.max??w}
            step=${t.step??w}
            style="flex: 1; max-width: 280px;"
            @input=${i}
          />
        `;default:return w}}_renderInfoBox(t){return t==="ai"?c`
        <div class="info-box">
          本 tab 的所有参数修改后需<strong>重启 cortex gui</strong> 才能生效。
        </div>
      `:t==="search"?c`<div class="info-box">本 tab 的参数保存后下次查询即时生效，<strong>无需重启</strong>。</div>`:t==="scoring"?c`
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
      `:t==="terminal"?c`
        <div class="info-box warn">
          ⚠️ 这些参数仅影响 <code>cortex</code> CLI/TUI 的<strong>终端输出格式</strong>，对 Web UI 没有可见效果。在此处提供编辑仅为了免去手动改 .env 的麻烦。
        </div>
      `:w}render(){const t=this._scope==="local"?"本地":"全局",e=this._exists?"":"（新建）";return c`
      ${this._scope==="local"&&!this._exists?c`
            <div class="copy-banner">
              <span>ℹ️</span>
              <span>当前工作目录尚未创建 <code>.cortex/.env</code>，将使用全局配置。</span>
              <span class="grow"></span>
              <button class="btn primary" @click=${this._copyFromGlobal}>📋 从全局复制并编辑</button>
            </div>
          `:w}
      <nav class="tab-strip" role="tablist">
        ${Es.map(r=>c`
          <button
            class=${this._activeTab===r?"active":""}
            @click=${()=>{this._activeTab=r}}
          >${En[r]}</button>
        `)}
      </nav>

      <div class="scroll-area">
        ${Es.map(r=>{const i=An.filter(o=>o.tab===r),s=[];for(const o of i){let a=s.find(l=>l.title===o.section);a||(a={title:o.section,fields:[]},s.push(a)),a.fields.push(o)}return c`
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

        <div class="footer-bar">
          <div class="dirty-status">
            ${this._dirty?c`<span class="dirty-dot"></span><span>有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`:c`<span style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`}
            ${this._error?c`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>`:w}
            ${this._toast?c`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>`:w}
          </div>
          <div style="display: flex; gap: var(--cortex-space-2);">
            <button class="btn" ?disabled=${!this._dirty||this._saving} @click=${()=>this._revert()}>放弃修改</button>
            <button class="btn primary" ?disabled=${!this._dirty||this._saving} @click=${()=>this._save()}>
              ${this._saving?"保存中…":`💾 保存${t}配置${e}`}
            </button>
          </div>
        </div>
      </div>
    `}};Q.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .tab-strip {
      display: flex;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      padding: 0 var(--cortex-space-8);
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tab-strip button {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }
    .tab-strip button:hover { color: var(--cortex-text); }
    .tab-strip button.active {
      color: var(--cortex-primary);
      border-bottom-color: var(--cortex-primary);
      font-weight: 500;
    }
    .scroll-area {
      flex: 1;
      overflow-y: auto;
      padding: var(--cortex-space-6) var(--cortex-space-8) 120px;
      position: relative;
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
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
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

    .copy-banner {
      background: var(--cortex-primary-soft);
      border-bottom: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
    }
    .copy-banner .grow { flex: 1; }
  `;ot([x()],Q.prototype,"_activeTab",2);ot([x()],Q.prototype,"_saving",2);ot([x()],Q.prototype,"_error",2);ot([x()],Q.prototype,"_toast",2);ot([x()],Q.prototype,"_values",2);ot([x()],Q.prototype,"_original",2);ot([x()],Q.prototype,"_exists",2);ot([x()],Q.prototype,"_scope",2);Q=ot([E("settings-view")],Q);const nt=t=>`/api/files${t}`,it={list:(t,e=200,r=0)=>F(nt(`/list?path=${encodeURIComponent(t)}&limit=${e}&offset=${r}`)),stats:t=>F(nt(`/stats?path=${encodeURIComponent(t)}`)),attrs:t=>F(nt(`/attrs?path=${encodeURIComponent(t)}`)),mkdir:t=>F(nt("/mkdir"),{method:"POST",json:{path:t}}),remove:t=>F(nt(`?path=${encodeURIComponent(t)}`),{method:"DELETE"}),move:(t,e,r=!1)=>F(nt("/move"),{method:"POST",json:{from_paths:t,dest_dir:e,overwrite:r}}),rename:(t,e)=>F(nt("/rename"),{method:"POST",json:{path:t,new_name:e}}),upload:(t,e,r=!1)=>{const i=new FormData;return i.append("file",t),i.append("dest_dir",e),i.append("overwrite",String(r)),F(nt("/upload"),{method:"POST",body:i})}};var Ln=Object.defineProperty,Rn=Object.getOwnPropertyDescriptor,pt=(t,e,r,i)=>{for(var s=i>1?void 0:i?Rn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Ln(e,r,s),s};let st=class extends ${constructor(){super(...arguments),this.depth=0,this.expanded=!1,this.selected=!1,this.readonly=!1,this.childEntries=[],this.loading=""}_onClick(){this.readonly?this.dispatchEvent(new CustomEvent("pick-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0})):this.dispatchEvent(new CustomEvent("select-dir",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}_toggle(t){t.stopPropagation(),this.entry.has_child_dirs&&this.dispatchEvent(new CustomEvent("toggle",{detail:{path:this.entry.path},bubbles:!0,composed:!0}))}render(){return c`
      <div class="row ${this.selected?"selected":""}" @click=${this._onClick}>
        <span
          class="arrow ${this.expanded?"expanded":""} ${this.entry.has_child_dirs?"":"leaf"}"
          @click=${this._toggle}>▶</span>
        <span class="icon">${this.entry.is_dir?"📁":"📄"}</span>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded&&this.entry.is_dir?c`
        <div class="children">
          ${this.loading===this.entry.path?c`<div style="padding: 4px 8px; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm);">加载中…</div>`:this.childEntries.filter(t=>t.is_dir).map(t=>c`
              <tree-node
                .entry=${t}
                .depth=${this.depth+1}
                .readonly=${this.readonly}
                @select-dir=${e=>this._relay("select-dir",e)}
                @toggle=${e=>this._relay("toggle",e)}
                @pick-dir=${e=>this._relay("pick-dir",e)}
              ></tree-node>
            `)}
        </div>
      `:""}
    `}_relay(t,e){e.stopPropagation();const r=e.detail;this.dispatchEvent(new CustomEvent(t,{detail:r,bubbles:!0,composed:!0}))}};st.styles=y`
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
  `;pt([d({type:Object})],st.prototype,"entry",2);pt([d({type:Number})],st.prototype,"depth",2);pt([d({type:Boolean})],st.prototype,"expanded",2);pt([d({type:Boolean})],st.prototype,"selected",2);pt([d({type:Boolean})],st.prototype,"readonly",2);pt([d({type:Array})],st.prototype,"childEntries",2);pt([d({type:String})],st.prototype,"loading",2);st=pt([E("tree-node")],st);var In=Object.getOwnPropertyDescriptor,Bn=(t,e,r,i)=>{for(var s=i>1?void 0:i?In(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=a(s)||s);return s};let vr=class extends ${constructor(){super(...arguments),this._onToggle=async t=>{const e=t.detail.path,{expandedPaths:r}=b.getState().files;r.includes(e)?m.collapseDir(e):(await this._ensureLoaded(e),m.expandDir(e))},this._onSelectDir=async t=>{m.selectDir(t.detail.path),await this._ensureLoaded(t.detail.path),m.expandDir(t.detail.path)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._ensureLoaded(""),m.expandDir("")}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}async _ensureLoaded(t){const{treeCache:e}=b.getState().files;if(!(t in e))try{m.setFilesState({listing:!0});const r=await it.list(t);m.setFilesState({treeCache:{...b.getState().files.treeCache,[t]:r.entries},listing:!1})}catch(r){m.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"})}}render(){const{treeCache:t,expandedPaths:e,currentDir:r}=b.getState().files,i=t[""]||[],s=new Set(e);return c`
      <div class="header">文件</div>
      ${i.filter(o=>o.is_dir).map(o=>c`
        <tree-node
          .entry=${o}
          .depth=${0}
          .expanded=${s.has(o.path)}
          .selected=${o.path===r}
          .childEntries=${t[o.path]||[]}
          .loading=""
          @toggle=${this._onToggle}
          @select-dir=${this._onSelectDir}
        ></tree-node>
      `)}
    `}};vr.styles=y`
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
  `;vr=Bn([E("file-tree")],vr);var Nn=Object.defineProperty,Fn=Object.getOwnPropertyDescriptor,Ur=(t,e,r,i)=>{for(var s=i>1?void 0:i?Fn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Nn(e,r,s),s};let ue=class extends ${constructor(){super(...arguments),this.selected=!1}_fmtSize(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}_fmtTime(t){if(!t)return"";try{return new Date(t).toLocaleString(void 0,{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return""}}_onClick(t){this.dispatchEvent(new CustomEvent("clicked",{detail:{path:this.entry.path,ctrl:t.ctrlKey||t.metaKey,shift:t.shiftKey},bubbles:!0,composed:!0}))}_onDblClick(){this.dispatchEvent(new CustomEvent("activated",{detail:{path:this.entry.path,is_dir:this.entry.is_dir},bubbles:!0,composed:!0}))}render(){return c`
      <div
        class="row ${this.selected?"selected":""}"
        @click=${this._onClick}
        @dblclick=${this._onDblClick}>
        <span class="icon">${this.entry.is_dir?"📁":"📄"}</span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.is_dir?"":this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
        <span>${!this.entry.is_dir&&this.entry.indexed?c`<span class="badge">已索引</span>`:""}</span>
      </div>
    `}};ue.styles=y`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns: 20px 1fr 80px 140px 70px;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); }
    .icon { font-size: 14px; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .size, .time {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: right;
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
  `;Ur([d({type:Object})],ue.prototype,"entry",2);Ur([d({type:Boolean})],ue.prototype,"selected",2);ue=Ur([E("file-row")],ue);var Mn=Object.getOwnPropertyDescriptor,jn=(t,e,r,i)=>{for(var s=i>1?void 0:i?Mn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=a(s)||s);return s};let mr=class extends ${connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}_action(t){this.dispatchEvent(new CustomEvent("action",{detail:{name:t},bubbles:!0,composed:!0}))}_onRowClicked(t){m.selectEntry(t.detail.path,{ctrl:t.detail.ctrl,shift:t.detail.shift})}_onRowActivated(t){t.detail.is_dir&&m.selectDir(t.detail.path)}_goUp(){const{currentDir:t}=b.getState().files;if(t==="")return;const e=t.includes("/")?t.slice(0,t.lastIndexOf("/")):"";m.selectDir(e)}render(){const{currentDir:t,treeCache:e,selectedPaths:r}=b.getState().files,i=e[t]||[],s=new Set(r),o=r.length===1,a=r.length>=1,l=t!=="",n=t===""?"/":`/${t}/`;return c`
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
      <div class="rows">
        ${i.length===0?c`<div class="empty">目录为空</div>`:i.map(h=>c`
            <file-row
              .entry=${h}
              .selected=${s.has(h.path)}
              @clicked=${this._onRowClicked}
              @activated=${this._onRowActivated}
            ></file-row>`)}
      </div>
    `}};mr.styles=y`
    :host {
      display: flex; flex-direction: column; flex: 1; min-height: 0;
      background: var(--cortex-surface);
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
    .rows { flex: 1; overflow-y: auto; }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
    }
  `;mr=jn([E("file-list")],mr);var Un=Object.getOwnPropertyDescriptor,Hn=(t,e,r,i)=>{for(var s=i>1?void 0:i?Un(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=a(s)||s);return s};let xr=class extends ${connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}_action(t){this.dispatchEvent(new CustomEvent("action",{detail:{name:t},bubbles:!0,composed:!0}))}_fmtSize(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}render(){const{selectedPaths:t,detail:e,detailLoading:r}=b.getState().files;if(t.length===0)return c`<div class="placeholder">选择一个文件查看详情</div>`;if(t.length>1)return c`
        <div class="placeholder">
          <p><strong>${t.length}</strong> 项已选中</p>
          <div class="actions">
            <button @click=${()=>this._action("move")}>→ 移动…</button>
            <button class="danger" @click=${()=>this._action("delete")}>🗑 删除…</button>
          </div>
        </div>
      `;if(r||!e)return c`<div class="placeholder">${r?"加载中…":"选择一个文件查看详情"}</div>`;const i=e;return c`
      <h2>${i.is_dir?"📁":"📄"} ${i.name}</h2>
      <div class="row"><span class="k">路径</span><span class="v">${i.path}</span></div>
      <div class="row"><span class="k">大小</span><span class="v">${i.is_dir?"—":this._fmtSize(i.size)}</span></div>
      <div class="row"><span class="k">类型</span><span class="v">${i.extension||"—"}</span></div>
      <div class="row"><span class="k">修改</span><span class="v">${i.modified_at?new Date(i.modified_at).toLocaleString():"—"}</span></div>
      <div class="row"><span class="k">创建</span><span class="v">${i.created_at?new Date(i.created_at).toLocaleString():"—"}</span></div>
      <div class="row"><span class="k">可写</span><span class="v">${i.writable?"是":"否"}</span></div>
      ${i.is_dir?"":c`<div class="row"><span class="k">已索引</span><span class="v">${i.indexed?"是":"否"}</span></div>`}
      <div class="actions">
        ${i.is_dir?"":c`<button @click=${()=>this._action("preview")}>👁 打开预览</button>`}
        ${i.is_dir?"":c`<button @click=${()=>this._action("download")}>⬇ 下载</button>`}
        <button @click=${()=>this._action("rename")}>✎ 重命名</button>
        <button @click=${()=>this._action("move")}>→ 移动</button>
        <button class="danger" @click=${()=>this._action("delete")}>🗑 删除</button>
      </div>
    `}};xr.styles=y`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border);
      padding: var(--cortex-space-4);
      gap: var(--cortex-space-2);
      overflow-y: auto;
    }
    h2 {
      margin: 0 0 var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-md);
      word-break: break-all;
    }
    .placeholder {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: var(--cortex-space-8) 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: var(--cortex-space-2) 0;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-sm);
      gap: var(--cortex-space-3);
    }
    .row .k { color: var(--cortex-text-muted); flex-shrink: 0; }
    .row .v {
      font-family: var(--cortex-font-mono);
      word-break: break-all;
      text-align: right;
    }
    .actions {
      display: flex; flex-direction: column; gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    .actions button {
      padding: 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .actions button:hover { background: var(--cortex-surface-muted); }
    .actions button.danger { color: var(--cortex-danger); }
  `;xr=Hn([E("file-detail")],xr);var Vn=Object.defineProperty,qn=Object.getOwnPropertyDescriptor,Hr=(t,e,r,i)=>{for(var s=i>1?void 0:i?qn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Vn(e,r,s),s};const Wn=/[\\/:*?"<>|]/,Kn=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let he=class extends ${constructor(){super(...arguments),this._name="",this._err=""}get _parent(){return b.getState().files.currentDir}_validate(t){return t?t.startsWith(".")?"不能以点开头":Wn.test(t)?'含非法字符 / \\ : * ? " < > |':/\s/.test(t[0]||"")?"不能以空白开头":Kn.test(t)?"Windows 保留名":"":"名称不能为空"}_onInput(t){this._name=t.target.value,this._err=this._validate(this._name)}_submit(){if(this._err)return;const t=this._parent?`${this._parent}/${this._name}`:this._name;this.dispatchEvent(new CustomEvent("submit",{detail:{path:t},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=!!this._err;return c`
      <div class="row">
        <label>在 ${this._parent||"/"} 下新建目录</label>
        <input
          autofocus
          class=${t?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${e=>e.key==="Enter"&&this._submit()}
        />
        ${t?c`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${t} @click=${this._submit}>新建</button>
      </div>
    `}};he.styles=y`
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
  `;Hr([x()],he.prototype,"_name",2);Hr([x()],he.prototype,"_err",2);he=Hr([E("mkdir-dialog")],he);var Xn=Object.defineProperty,Gn=Object.getOwnPropertyDescriptor,Ge=(t,e,r,i)=>{for(var s=i>1?void 0:i?Gn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Xn(e,r,s),s};const Zn=/[\\/:*?"<>|]/,Yn=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;let jt=class extends ${constructor(){super(...arguments),this.currentName="",this._name="",this._err=""}connectedCallback(){super.connectedCallback(),this._name=this.currentName,this._err=this._validate(this._name)}_validate(t){return t?t===this.currentName?"名称未变化":t.startsWith(".")?"不能以点开头":Zn.test(t)?'含非法字符 / \\ : * ? " < > |':Yn.test(t)?"Windows 保留名":"":"名称不能为空"}_onInput(t){this._name=t.target.value,this._err=this._validate(this._name)}_submit(){this._err||this.dispatchEvent(new CustomEvent("submit",{detail:{newName:this._name},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=!!this._err;return c`
      <div class="row">
        <label>重命名</label>
        <input
          autofocus
          class=${t?"invalid":""}
          .value=${this._name}
          @input=${this._onInput}
          @keydown=${e=>e.key==="Enter"&&this._submit()}
        />
        ${t?c`<div class="err">${this._err}</div>`:""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${t} @click=${this._submit}>重命名</button>
      </div>
    `}};jt.styles=y`
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
  `;Ge([d({type:String})],jt.prototype,"currentName",2);Ge([x()],jt.prototype,"_name",2);Ge([x()],jt.prototype,"_err",2);jt=Ge([E("rename-dialog")],jt);var Qn=Object.defineProperty,Jn=Object.getOwnPropertyDescriptor,Vr=(t,e,r,i)=>{for(var s=i>1?void 0:i?Jn(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&Qn(e,r,s),s};let pe=class extends ${constructor(){super(...arguments),this._dest="",this._overwrite=!1}get _selectedCount(){return b.getState().files.selectedPaths.length}_onPickDir(t){this._dest=t.detail.path}_onToggle(t){t.stopPropagation()}_submit(){this._dest&&this.dispatchEvent(new CustomEvent("submit",{detail:{destDir:this._dest,overwrite:this._overwrite},bubbles:!0,composed:!0}))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const{treeCache:t,expandedPaths:e}=b.getState().files,r=(t[""]||[]).filter(s=>s.is_dir),i=new Set(e);return c`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${r.map(s=>c`
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
    `}};pe.styles=y`
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
  `;Vr([x()],pe.prototype,"_dest",2);Vr([x()],pe.prototype,"_overwrite",2);pe=Vr([E("move-dialog")],pe);var tl=Object.defineProperty,el=Object.getOwnPropertyDescriptor,Ze=(t,e,r,i)=>{for(var s=i>1?void 0:i?el(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&tl(e,r,s),s};let Ut=class extends ${constructor(){super(...arguments),this._phase="confirming",this._stats=null,this._confirmed=!1}get _selected(){return b.getState().files.selectedPaths}connectedCallback(){super.connectedCallback(),!this._stats&&this._selected.length>0&&(this._phase="loading-stats",this._loadStats())}async _loadStats(){const t=this._selected;let e=0,r=0,i=0;for(const s of t)try{const o=await it.stats(s);e+=o.file_count,r+=o.dir_count,i+=o.total_size_bytes}catch{}e===0&&r===0&&(e=t.length),this._stats={file_count:e,dir_count:r,total_size_bytes:i},this._phase="confirming"}_fmtSize(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/1024/1024).toFixed(1)} MB`}_delete(){this._confirmed&&(this._phase="deleting",this.dispatchEvent(new CustomEvent("submit",{detail:{paths:this._selected},bubbles:!0,composed:!0})))}_cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){const t=this._selected.length;return this._phase==="loading-stats"?c`<div class="spinner">统计中…</div>`:c`
      <h3>删除 ${t>1?`${t} 项`:this._selected[0]}？</h3>
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
      `:c`<div class="stats">将永久删除 ${t} 个项目。</div>`}
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
    `}};Ut.styles=y`
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
  `;Ze([x()],Ut.prototype,"_phase",2);Ze([x()],Ut.prototype,"_stats",2);Ze([x()],Ut.prototype,"_confirmed",2);Ut=Ze([E("delete-dialog")],Ut);var rl=Object.defineProperty,sl=Object.getOwnPropertyDescriptor,qr=(t,e,r,i)=>{for(var s=i>1?void 0:i?sl(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&rl(e,r,s),s};let fe=class extends ${constructor(){super(...arguments),this.targetDir="",this._active=!1,this._dragCounter=0,this._onDragEnter=t=>{this._hasFilesOnly(t)&&(t.preventDefault(),this._dragCounter++,this._active=!0)},this._onDragOver=t=>{this._hasFilesOnly(t)&&t.preventDefault()},this._onDragLeave=()=>{this._dragCounter--,this._dragCounter<=0&&(this._active=!1,this._dragCounter=0)},this._onDrop=t=>{if(!t.dataTransfer)return;t.preventDefault(),this._active=!1,this._dragCounter=0;const e=Array.from(t.dataTransfer.files||[]);e.length!==0&&this.dispatchEvent(new CustomEvent("drop-files",{detail:{files:e,destDir:this.targetDir},bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),window.addEventListener("dragenter",this._onDragEnter),window.addEventListener("dragover",this._onDragOver),window.addEventListener("dragleave",this._onDragLeave),window.addEventListener("drop",this._onDrop)}disconnectedCallback(){window.removeEventListener("dragenter",this._onDragEnter),window.removeEventListener("dragover",this._onDragOver),window.removeEventListener("dragleave",this._onDragLeave),window.removeEventListener("drop",this._onDrop),super.disconnectedCallback()}_hasFilesOnly(t){if(!t.dataTransfer)return!1;const e=Array.from(t.dataTransfer.items||[]);return e.length===0?t.dataTransfer.types.includes("Files"):e.every(r=>r.kind==="file")}render(){return c`
      <div class="overlay ${this._active?"active":""}">
        <div>⬇ 拖放以上传到</div>
        <div>📁 ${this.targetDir||"/"}</div>
      </div>
    `}};fe.styles=y`
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
  `;qr([d({type:String})],fe.prototype,"targetDir",2);qr([x()],fe.prototype,"_active",2);fe=qr([E("drop-zone")],fe);var il=Object.defineProperty,ol=Object.getOwnPropertyDescriptor,Wr=(t,e,r,i)=>{for(var s=i>1?void 0:i?ol(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&il(e,r,s),s};let be=class extends ${constructor(){super(...arguments),this._dialog=null,this._toast=null,this._toastTimer=null,this._lastSelectedSig="",this._fileInput=null,this._cancelDialog=()=>{this._dialog=null}}connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate()),this._ensureLoaded("")}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),this._toastTimer&&clearTimeout(this._toastTimer),super.disconnectedCallback()}get _state(){return b.getState().files}get _isMobile(){return typeof window<"u"&&window.innerWidth<1024}async _ensureLoaded(t){const{treeCache:e}=b.getState().files;if(!(t in e))try{m.setFilesState({listing:!0});const r=await it.list(t);if(b.getState().files.treeCache!==e){const i=b.getState().files.treeCache;if(t in i)return;m.setFilesState({treeCache:{...i,[t]:r.entries},listing:!1});return}m.setFilesState({treeCache:{...e,[t]:r.entries},listing:!1})}catch(r){m.setFilesState({listing:!1,error:(r==null?void 0:r.message)||"加载失败"}),this._showToast((r==null?void 0:r.message)||"加载失败")}}async _maybeLoadDetail(){const t=this._state.selectedPaths,e=t.join(",");if(e!==this._lastSelectedSig){if(this._lastSelectedSig=e,t.length!==1){this._state.detail!==null&&m.setFilesState({detail:null});return}m.setFilesState({detailLoading:!0});try{const r=await it.attrs(t[0]);if(b.getState().files.selectedPaths.join(",")!==e)return;m.setFilesState({detail:r,detailLoading:!1})}catch{m.setFilesState({detailLoading:!1})}}}updated(){this._maybeLoadDetail()}_showToast(t){this._toast=t,this._toastTimer&&clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast=null},3500)}_onAction(t){const e=t.detail.name;if(e==="preview"||e==="download"){const r=this._state.selectedPaths[0];r&&window.open(`/api/preview/download?path=${encodeURIComponent(r)}`,"_blank");return}if(e==="upload"){this._openFilePicker();return}if(["mkdir","rename","move","delete"].includes(e)){if(e==="rename"&&this._state.selectedPaths.length!==1||(e==="move"||e==="delete")&&this._state.selectedPaths.length===0)return;this._dialog=e}}_openFilePicker(){this._fileInput||(this._fileInput=document.createElement("input"),this._fileInput.type="file",this._fileInput.multiple=!0,this._fileInput.style.display="none",this._fileInput.addEventListener("change",()=>{this._fileInput&&this._fileInput.files&&this._fileInput.files.length>0&&(this._uploadFiles(Array.from(this._fileInput.files),this._state.currentDir),this._fileInput.value="")}),document.body.appendChild(this._fileInput)),this._fileInput.click()}async _onMkdirSubmit(t){this._dialog=null;try{await it.mkdir(t.detail.path);const e=t.detail.path.includes("/")?t.detail.path.slice(0,t.detail.path.lastIndexOf("/")):"";m.invalidateDir(e),await this._ensureLoaded(e),m.expandDir(e),this._showToast("目录已创建")}catch(e){this._showToast((e==null?void 0:e.message)||"创建失败")}}async _onRenameSubmit(t){const e=this._state.selectedPaths[0];this._dialog=null;try{await it.rename(e,t.detail.newName),m.invalidateDir(this._state.currentDir),await this._ensureLoaded(this._state.currentDir),this._showToast("已重命名")}catch(r){this._showToast((r==null?void 0:r.message)||"重命名失败")}}async _onMoveSubmit(t){const e=[...this._state.selectedPaths];this._dialog=null;try{const r=await it.move(e,t.detail.destDir,t.detail.overwrite),i=new Set;e.forEach(s=>{i.add(s.includes("/")?s.slice(0,s.lastIndexOf("/")):"")}),i.add(t.detail.destDir),i.forEach(s=>m.invalidateDir(s));for(const s of i)await this._ensureLoaded(s);m.clearSelection(),this._showToast(r.skipped.length?`已移动 ${r.moved.length} 项，${r.skipped.length} 项跳过`:`已移动 ${r.moved.length} 项`)}catch(r){this._showToast((r==null?void 0:r.message)||"移动失败")}}async _onDeleteSubmit(t){const e=[...t.detail.paths];this._dialog=null;let r=0,i=0;for(const o of e)try{await it.remove(o),r++,m.invalidateSubtree(o);const a=o.includes("/")?o.slice(0,o.lastIndexOf("/")):"";m.invalidateDir(a)}catch{i++}const s=new Set;e.forEach(o=>s.add(o.includes("/")?o.slice(0,o.lastIndexOf("/")):""));for(const o of s)await this._ensureLoaded(o);m.clearSelection(),this._showToast(i?`已删除 ${r}，失败 ${i}`:`已删除 ${r} 项`)}_onDropFiles(t){this._uploadFiles(t.detail.files,t.detail.destDir)}async _uploadFiles(t,e){let r=0,i=0,s="";for(const o of t)try{await it.upload(o,e,!1),r++}catch(a){(a==null?void 0:a.code)==="ALREADY_EXISTS"?i++:s=(a==null?void 0:a.message)||"上传失败"}if(m.invalidateDir(e),await this._ensureLoaded(e),s&&r===0)this._showToast(s);else{const o=[`已上传 ${r}`];i>0&&o.push(`跳过 ${i}`),s&&o.push("部分失败"),this._showToast(o.join("，"))}}_goBack(){const t=this._state.mobilePane;t==="detail"?m.setMobilePane("list"):t==="list"&&m.setMobilePane("tree")}render(){return c`
      ${this._isMobile?this._renderMobile():this._renderDesktop()}
      ${this._renderDialogs()}
      <drop-zone .targetDir=${this._state.currentDir} @drop-files=${this._onDropFiles}></drop-zone>
      ${this._toast?c`<div class="toast" @click=${()=>this._toast=null}>${this._toast}</div>`:""}
    `}_renderDesktop(){return c`
      <div class="desktop-layout">
        <file-tree></file-tree>
        <file-list @action=${this._onAction}></file-list>
        <file-detail @action=${this._onAction}></file-detail>
      </div>
    `}_renderMobile(){const t=this._state.mobilePane;return c`
      <div class="mobile-layout">
        ${t!=="tree"?c`<button class="back-btn" @click=${()=>this._goBack()}>← 返回</button>`:""}
        ${t==="tree"?c`<file-tree
              @select-dir=${async e=>{m.selectDir(e.detail.path),await this._ensureLoaded(e.detail.path),m.expandDir(e.detail.path),m.setMobilePane("list")}}
            ></file-tree>`:""}
        ${t==="list"?c`<file-list @action=${this._onAction}
              @activated=${e=>{e.detail.is_dir||m.setMobilePane("detail")}}
            ></file-list>`:""}
        ${t==="detail"?c`<file-detail @action=${this._onAction}></file-detail>`:""}
      </div>
    `}_renderDialogs(){if(this._dialog==="mkdir")return c`<dialog open>
        <mkdir-dialog
          @submit=${this._onMkdirSubmit}
          @cancel=${this._cancelDialog}
        ></mkdir-dialog>
      </dialog>`;if(this._dialog==="rename"){const e=(this._state.selectedPaths[0]||"").split("/").pop()||"";return c`<dialog open>
        <rename-dialog
          .currentName=${e}
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
      </dialog>`:c``}};be.styles=y`
    :host {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .desktop-layout {
      flex: 1;
      display: grid;
      grid-template-columns: 240px 1fr 320px;
      min-height: 0;
    }
    .mobile-layout {
      flex: 1; min-height: 0; position: relative;
    }
    .mobile-layout file-tree,
    .mobile-layout file-list,
    .mobile-layout file-detail {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
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
  `;Wr([x()],be.prototype,"_dialog",2);Wr([x()],be.prototype,"_toast",2);be=Wr([E("files-view")],be);var al=Object.defineProperty,nl=Object.getOwnPropertyDescriptor,Kr=(t,e,r,i)=>{for(var s=i>1?void 0:i?nl(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=(i?a(e,r,s):a(s))||s);return i&&s&&al(e,r,s),s};let ge=class extends ${constructor(){super(...arguments),this.activeView="search",this._menuOpen=!1,this._onDocClick=t=>{if(!this._menuOpen)return;t.composedPath().includes(this)||(this._menuOpen=!1)}}_onAvatarClick(t){t.stopPropagation(),this._menuOpen=!this._menuOpen}_onScopeSelect(t){this._menuOpen=!1,this.dispatchEvent(new CustomEvent("navigate",{detail:{view:"settings",scope:t},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return c`
      <div class="brand">
        <span class="logo">🧠</span>
        <span>Cortex</span>
      </div>
      <div class="right-cluster">
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
          <button class="menu-item" type="button" @click=${()=>this._onScopeSelect("local")}>
            <span class="icon">📁</span>
            <span class="text">
              <span class="label">本地配置</span>
              <span class="desc">仅当前工作目录</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${()=>this._onScopeSelect("global")}>
            <span class="icon">🌍</span>
            <span class="text">
              <span class="label">全局配置</span>
              <span class="desc">所有项目共用</span>
            </span>
          </button>
        </div>
      </div>
    `}};ge.styles=y`
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
  `;Kr([d()],ge.prototype,"activeView",2);Kr([x()],ge.prototype,"_menuOpen",2);ge=Kr([E("app-bar")],ge);var ll=Object.getOwnPropertyDescriptor,cl=(t,e,r,i)=>{for(var s=i>1?void 0:i?ll(e,r):e,o=t.length-1,a;o>=0;o--)(a=t[o])&&(s=a(s)||s);return s};let yr=class extends ${connectedCallback(){super.connectedCallback(),this._unsubscribe=b.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var t;(t=this._unsubscribe)==null||t.call(this),super.disconnectedCallback()}_navigate(t){m.setView(t.detail.view),t.detail.view==="settings"&&t.detail.scope&&m.setSettingsScope(t.detail.scope)}_renderView(){const t=b.getState().view;return t==="chat"?c`<chat-view></chat-view>`:t==="settings"?c`<settings-view></settings-view>`:t==="files"?c`<files-view></files-view>`:c`<search-view></search-view>`}render(){const t=b.getState().view;return c`
      <app-bar
        .activeView=${t}
        @navigate=${this._navigate}
      ></app-bar>
      <div class="app-body">
        <activity-bar .active=${t} @navigate=${this._navigate}></activity-bar>
        <div class="main">
          ${this._renderView()}
        </div>
        <tab-bar .active=${t} @navigate=${this._navigate}></tab-bar>
      </div>
    `}};yr.styles=y`
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
      position: relative;
    }
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;yr=cl([E("cortex-app")],yr);
