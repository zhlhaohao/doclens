var Us=Object.defineProperty;var qs=(e,t,r)=>t in e?Us(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r;var A=(e,t,r)=>qs(e,typeof t!="symbol"?t+"":t,r);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const i of o)if(i.type==="childList")for(const a of i.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function r(o){const i={};return o.integrity&&(i.integrity=o.integrity),o.referrerPolicy&&(i.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?i.credentials="include":o.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(o){if(o.ep)return;o.ep=!0;const i=r(o);fetch(o.href,i)}})();/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const he=globalThis,rr=he.ShadowRoot&&(he.ShadyCSS===void 0||he.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,sr=Symbol(),Cr=new WeakMap;let as=class{constructor(t,r,s){if(this._$cssResult$=!0,s!==sr)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=r}get styleSheet(){let t=this.o;const r=this.t;if(rr&&t===void 0){const s=r!==void 0&&r.length===1;s&&(t=Cr.get(r)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),s&&Cr.set(r,t))}return t}toString(){return this.cssText}};const Ws=e=>new as(typeof e=="string"?e:e+"",void 0,sr),$=(e,...t)=>{const r=e.length===1?e[0]:t.reduce((s,o,i)=>s+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+e[i+1],e[0]);return new as(r,e,sr)},Xs=(e,t)=>{if(rr)e.adoptedStyleSheets=t.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of t){const s=document.createElement("style"),o=he.litNonce;o!==void 0&&s.setAttribute("nonce",o),s.textContent=r.cssText,e.appendChild(s)}},Ar=rr?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let r="";for(const s of t.cssRules)r+=s.cssText;return Ws(r)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:Ks,defineProperty:Gs,getOwnPropertyDescriptor:Zs,getOwnPropertyNames:Qs,getOwnPropertySymbols:Ys,getPrototypeOf:Js}=Object,ot=globalThis,Er=ot.trustedTypes,to=Er?Er.emptyScript:"",Be=ot.reactiveElementPolyfillSupport,Xt=(e,t)=>e,At={toAttribute(e,t){switch(t){case Boolean:e=e?to:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=e!==null;break;case Number:r=e===null?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch{r=null}}return r}},or=(e,t)=>!Ks(e,t),Tr={attribute:!0,type:String,converter:At,reflect:!1,useDefault:!1,hasChanged:or};Symbol.metadata??(Symbol.metadata=Symbol("metadata")),ot.litPropertyMetadata??(ot.litPropertyMetadata=new WeakMap);let $t=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??(this.l=[])).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,r=Tr){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(t,r),!r.noAccessor){const s=Symbol(),o=this.getPropertyDescriptor(t,s,r);o!==void 0&&Gs(this.prototype,t,o)}}static getPropertyDescriptor(t,r,s){const{get:o,set:i}=Zs(this.prototype,t)??{get(){return this[r]},set(a){this[r]=a}};return{get:o,set(a){const l=o==null?void 0:o.call(this);i==null||i.call(this,a),this.requestUpdate(t,l,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Tr}static _$Ei(){if(this.hasOwnProperty(Xt("elementProperties")))return;const t=Js(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Xt("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Xt("properties"))){const r=this.properties,s=[...Qs(r),...Ys(r)];for(const o of s)this.createProperty(o,r[o])}const t=this[Symbol.metadata];if(t!==null){const r=litPropertyMetadata.get(t);if(r!==void 0)for(const[s,o]of r)this.elementProperties.set(s,o)}this._$Eh=new Map;for(const[r,s]of this.elementProperties){const o=this._$Eu(r,s);o!==void 0&&this._$Eh.set(o,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const r=[];if(Array.isArray(t)){const s=new Set(t.flat(1/0).reverse());for(const o of s)r.unshift(Ar(o))}else t!==void 0&&r.push(Ar(t));return r}static _$Eu(t,r){const s=r.attribute;return s===!1?void 0:typeof s=="string"?s:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){var t;this._$ES=new Promise(r=>this.enableUpdating=r),this._$AL=new Map,this._$E_(),this.requestUpdate(),(t=this.constructor.l)==null||t.forEach(r=>r(this))}addController(t){var r;(this._$EO??(this._$EO=new Set)).add(t),this.renderRoot!==void 0&&this.isConnected&&((r=t.hostConnected)==null||r.call(t))}removeController(t){var r;(r=this._$EO)==null||r.delete(t)}_$E_(){const t=new Map,r=this.constructor.elementProperties;for(const s of r.keys())this.hasOwnProperty(s)&&(t.set(s,this[s]),delete this[s]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Xs(t,this.constructor.elementStyles),t}connectedCallback(){var t;this.renderRoot??(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$EO)==null||t.forEach(r=>{var s;return(s=r.hostConnected)==null?void 0:s.call(r)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$EO)==null||t.forEach(r=>{var s;return(s=r.hostDisconnected)==null?void 0:s.call(r)})}attributeChangedCallback(t,r,s){this._$AK(t,s)}_$ET(t,r){var i;const s=this.constructor.elementProperties.get(t),o=this.constructor._$Eu(t,s);if(o!==void 0&&s.reflect===!0){const a=(((i=s.converter)==null?void 0:i.toAttribute)!==void 0?s.converter:At).toAttribute(r,s.type);this._$Em=t,a==null?this.removeAttribute(o):this.setAttribute(o,a),this._$Em=null}}_$AK(t,r){var i,a;const s=this.constructor,o=s._$Eh.get(t);if(o!==void 0&&this._$Em!==o){const l=s.getPropertyOptions(o),n=typeof l.converter=="function"?{fromAttribute:l.converter}:((i=l.converter)==null?void 0:i.fromAttribute)!==void 0?l.converter:At;this._$Em=o;const h=n.fromAttribute(r,l.type);this[o]=h??((a=this._$Ej)==null?void 0:a.get(o))??h,this._$Em=null}}requestUpdate(t,r,s,o=!1,i){var a;if(t!==void 0){const l=this.constructor;if(o===!1&&(i=this[t]),s??(s=l.getPropertyOptions(t)),!((s.hasChanged??or)(i,r)||s.useDefault&&s.reflect&&i===((a=this._$Ej)==null?void 0:a.get(t))&&!this.hasAttribute(l._$Eu(t,s))))return;this.C(t,r,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,r,{useDefault:s,reflect:o,wrapped:i},a){s&&!(this._$Ej??(this._$Ej=new Map)).has(t)&&(this._$Ej.set(t,a??r??this[t]),i!==!0||a!==void 0)||(this._$AL.has(t)||(this.hasUpdated||s||(r=void 0),this._$AL.set(t,r)),o===!0&&this._$Em!==t&&(this._$Eq??(this._$Eq=new Set)).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var s;if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??(this.renderRoot=this.createRenderRoot()),this._$Ep){for(const[i,a]of this._$Ep)this[i]=a;this._$Ep=void 0}const o=this.constructor.elementProperties;if(o.size>0)for(const[i,a]of o){const{wrapped:l}=a,n=this[i];l!==!0||this._$AL.has(i)||n===void 0||this.C(i,void 0,a,n)}}let t=!1;const r=this._$AL;try{t=this.shouldUpdate(r),t?(this.willUpdate(r),(s=this._$EO)==null||s.forEach(o=>{var i;return(i=o.hostUpdate)==null?void 0:i.call(o)}),this.update(r)):this._$EM()}catch(o){throw t=!1,this._$EM(),o}t&&this._$AE(r)}willUpdate(t){}_$AE(t){var r;(r=this._$EO)==null||r.forEach(s=>{var o;return(o=s.hostUpdated)==null?void 0:o.call(s)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&(this._$Eq=this._$Eq.forEach(r=>this._$ET(r,this[r]))),this._$EM()}updated(t){}firstUpdated(t){}};$t.elementStyles=[],$t.shadowRootOptions={mode:"open"},$t[Xt("elementProperties")]=new Map,$t[Xt("finalized")]=new Map,Be==null||Be({ReactiveElement:$t}),(ot.reactiveElementVersions??(ot.reactiveElementVersions=[])).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Kt=globalThis,zr=e=>e,fe=Kt.trustedTypes,Pr=fe?fe.createPolicy("lit-html",{createHTML:e=>e}):void 0,ns="$lit$",st=`lit$${Math.random().toFixed(9).slice(2)}$`,ls="?"+st,eo=`<${ls}>`,mt=document,Gt=()=>mt.createComment(""),Zt=e=>e===null||typeof e!="object"&&typeof e!="function",ir=Array.isArray,ro=e=>ir(e)||typeof(e==null?void 0:e[Symbol.iterator])=="function",Ne=`[ 	
\f\r]`,Bt=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Or=/-->/g,Rr=/>/g,lt=RegExp(`>|${Ne}(?:([^\\s"'>=/]+)(${Ne}*=${Ne}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Ir=/'/g,Lr=/"/g,cs=/^(?:script|style|textarea|title)$/i,so=e=>(t,...r)=>({_$litType$:e,strings:t,values:r}),p=so(1),X=Symbol.for("lit-noChange"),y=Symbol.for("lit-nothing"),Dr=new WeakMap,ft=mt.createTreeWalker(mt,129);function ds(e,t){if(!ir(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return Pr!==void 0?Pr.createHTML(t):t}const oo=(e,t)=>{const r=e.length-1,s=[];let o,i=t===2?"<svg>":t===3?"<math>":"",a=Bt;for(let l=0;l<r;l++){const n=e[l];let h,c,b=-1,g=0;for(;g<n.length&&(a.lastIndex=g,c=a.exec(n),c!==null);)g=a.lastIndex,a===Bt?c[1]==="!--"?a=Or:c[1]!==void 0?a=Rr:c[2]!==void 0?(cs.test(c[2])&&(o=RegExp("</"+c[2],"g")),a=lt):c[3]!==void 0&&(a=lt):a===lt?c[0]===">"?(a=o??Bt,b=-1):c[1]===void 0?b=-2:(b=a.lastIndex-c[2].length,h=c[1],a=c[3]===void 0?lt:c[3]==='"'?Lr:Ir):a===Lr||a===Ir?a=lt:a===Or||a===Rr?a=Bt:(a=lt,o=void 0);const x=a===lt&&e[l+1].startsWith("/>")?" ":"";i+=a===Bt?n+eo:b>=0?(s.push(h),n.slice(0,b)+ns+n.slice(b)+st+x):n+st+(b===-2?l:x)}return[ds(e,i+(e[r]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),s]};class Qt{constructor({strings:t,_$litType$:r},s){let o;this.parts=[];let i=0,a=0;const l=t.length-1,n=this.parts,[h,c]=oo(t,r);if(this.el=Qt.createElement(h,s),ft.currentNode=this.el.content,r===2||r===3){const b=this.el.content.firstChild;b.replaceWith(...b.childNodes)}for(;(o=ft.nextNode())!==null&&n.length<l;){if(o.nodeType===1){if(o.hasAttributes())for(const b of o.getAttributeNames())if(b.endsWith(ns)){const g=c[a++],x=o.getAttribute(b).split(st),f=/([.?@])?(.*)/.exec(g);n.push({type:1,index:i,name:f[2],strings:x,ctor:f[1]==="."?ao:f[1]==="?"?no:f[1]==="@"?lo:Se}),o.removeAttribute(b)}else b.startsWith(st)&&(n.push({type:6,index:i}),o.removeAttribute(b));if(cs.test(o.tagName)){const b=o.textContent.split(st),g=b.length-1;if(g>0){o.textContent=fe?fe.emptyScript:"";for(let x=0;x<g;x++)o.append(b[x],Gt()),ft.nextNode(),n.push({type:2,index:++i});o.append(b[g],Gt())}}}else if(o.nodeType===8)if(o.data===ls)n.push({type:2,index:i});else{let b=-1;for(;(b=o.data.indexOf(st,b+1))!==-1;)n.push({type:7,index:i}),b+=st.length-1}i++}}static createElement(t,r){const s=mt.createElement("template");return s.innerHTML=t,s}}function Et(e,t,r=e,s){var a,l;if(t===X)return t;let o=s!==void 0?(a=r._$Co)==null?void 0:a[s]:r._$Cl;const i=Zt(t)?void 0:t._$litDirective$;return(o==null?void 0:o.constructor)!==i&&((l=o==null?void 0:o._$AO)==null||l.call(o,!1),i===void 0?o=void 0:(o=new i(e),o._$AT(e,r,s)),s!==void 0?(r._$Co??(r._$Co=[]))[s]=o:r._$Cl=o),o!==void 0&&(t=Et(e,o._$AS(e,t.values),o,s)),t}class io{constructor(t,r){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:r},parts:s}=this._$AD,o=((t==null?void 0:t.creationScope)??mt).importNode(r,!0);ft.currentNode=o;let i=ft.nextNode(),a=0,l=0,n=s[0];for(;n!==void 0;){if(a===n.index){let h;n.type===2?h=new re(i,i.nextSibling,this,t):n.type===1?h=new n.ctor(i,n.name,n.strings,this,t):n.type===6&&(h=new co(i,this,t)),this._$AV.push(h),n=s[++l]}a!==(n==null?void 0:n.index)&&(i=ft.nextNode(),a++)}return ft.currentNode=mt,o}p(t){let r=0;for(const s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(t,s,r),r+=s.strings.length-2):s._$AI(t[r])),r++}}class re{get _$AU(){var t;return((t=this._$AM)==null?void 0:t._$AU)??this._$Cv}constructor(t,r,s,o){this.type=2,this._$AH=y,this._$AN=void 0,this._$AA=t,this._$AB=r,this._$AM=s,this.options=o,this._$Cv=(o==null?void 0:o.isConnected)??!0}get parentNode(){let t=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=r.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,r=this){t=Et(this,t,r),Zt(t)?t===y||t==null||t===""?(this._$AH!==y&&this._$AR(),this._$AH=y):t!==this._$AH&&t!==X&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):ro(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==y&&Zt(this._$AH)?this._$AA.nextSibling.data=t:this.T(mt.createTextNode(t)),this._$AH=t}$(t){var i;const{values:r,_$litType$:s}=t,o=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=Qt.createElement(ds(s.h,s.h[0]),this.options)),s);if(((i=this._$AH)==null?void 0:i._$AD)===o)this._$AH.p(r);else{const a=new io(o,this),l=a.u(this.options);a.p(r),this.T(l),this._$AH=a}}_$AC(t){let r=Dr.get(t.strings);return r===void 0&&Dr.set(t.strings,r=new Qt(t)),r}k(t){ir(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let s,o=0;for(const i of t)o===r.length?r.push(s=new re(this.O(Gt()),this.O(Gt()),this,this.options)):s=r[o],s._$AI(i),o++;o<r.length&&(this._$AR(s&&s._$AB.nextSibling,o),r.length=o)}_$AR(t=this._$AA.nextSibling,r){var s;for((s=this._$AP)==null?void 0:s.call(this,!1,!0,r);t!==this._$AB;){const o=zr(t).nextSibling;zr(t).remove(),t=o}}setConnected(t){var r;this._$AM===void 0&&(this._$Cv=t,(r=this._$AP)==null||r.call(this,t))}}let Se=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,r,s,o,i){this.type=1,this._$AH=y,this._$AN=void 0,this.element=t,this.name=r,this._$AM=o,this.options=i,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=y}_$AI(t,r=this,s,o){const i=this.strings;let a=!1;if(i===void 0)t=Et(this,t,r,0),a=!Zt(t)||t!==this._$AH&&t!==X,a&&(this._$AH=t);else{const l=t;let n,h;for(t=i[0],n=0;n<i.length-1;n++)h=Et(this,l[s+n],r,n),h===X&&(h=this._$AH[n]),a||(a=!Zt(h)||h!==this._$AH[n]),h===y?t=y:t!==y&&(t+=(h??"")+i[n+1]),this._$AH[n]=h}a&&!o&&this.j(t)}j(t){t===y?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},ao=class extends Se{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===y?void 0:t}},no=class extends Se{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==y)}},lo=class extends Se{constructor(t,r,s,o,i){super(t,r,s,o,i),this.type=5}_$AI(t,r=this){if((t=Et(this,t,r,0)??y)===X)return;const s=this._$AH,o=t===y&&s!==y||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,i=t!==y&&(s===y||o);o&&this.element.removeEventListener(this.name,this,s),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var r;typeof this._$AH=="function"?this._$AH.call(((r=this.options)==null?void 0:r.host)??this.element,t):this._$AH.handleEvent(t)}},co=class{constructor(t,r,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=r,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(t){Et(this,t)}};const He=Kt.litHtmlPolyfillSupport;He==null||He(Qt,re),(Kt.litHtmlVersions??(Kt.litHtmlVersions=[])).push("3.3.3");const uo=(e,t,r)=>{const s=(r==null?void 0:r.renderBefore)??t;let o=s._$litPart$;if(o===void 0){const i=(r==null?void 0:r.renderBefore)??null;s._$litPart$=o=new re(t.insertBefore(Gt(),i),i,void 0,r??{})}return o._$AI(e),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const gt=globalThis;let T=class extends $t{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var r;const t=super.createRenderRoot();return(r=this.renderOptions).renderBefore??(r.renderBefore=t.firstChild),t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=uo(r,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)==null||t.setConnected(!0)}disconnectedCallback(){var t;super.disconnectedCallback(),(t=this._$Do)==null||t.setConnected(!1)}render(){return X}};var is;T._$litElement$=!0,T.finalized=!0,(is=gt.litElementHydrateSupport)==null||is.call(gt,{LitElement:T});const Fe=gt.litElementPolyfillSupport;Fe==null||Fe({LitElement:T});(gt.litElementVersions??(gt.litElementVersions=[])).push("4.2.2");var ho=$`
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
`;const Xe=new Set,St=new Map;let ut,ar="ltr",nr="en";const us=typeof MutationObserver<"u"&&typeof document<"u"&&typeof document.documentElement<"u";if(us){const e=new MutationObserver(ps);ar=document.documentElement.dir||"ltr",nr=document.documentElement.lang||navigator.language,e.observe(document.documentElement,{attributes:!0,attributeFilter:["dir","lang"]})}function hs(...e){e.map(t=>{const r=t.$code.toLowerCase();St.has(r)?St.set(r,Object.assign(Object.assign({},St.get(r)),t)):St.set(r,t),ut||(ut=t)}),ps()}function ps(){us&&(ar=document.documentElement.dir||"ltr",nr=document.documentElement.lang||navigator.language),[...Xe.keys()].map(e=>{typeof e.requestUpdate=="function"&&e.requestUpdate()})}let po=class{constructor(t){this.host=t,this.host.addController(this)}hostConnected(){Xe.add(this.host)}hostDisconnected(){Xe.delete(this.host)}dir(){return`${this.host.dir||ar}`.toLowerCase()}lang(){return`${this.host.lang||nr}`.toLowerCase()}getTranslationData(t){var r,s;let o;try{o=new Intl.Locale(t.replace(/_/g,"-"))}catch{return{locale:void 0,language:"",region:"",primary:void 0,secondary:void 0}}const i=o.language.toLowerCase(),a=(s=(r=o.region)===null||r===void 0?void 0:r.toLowerCase())!==null&&s!==void 0?s:"",l=St.get(`${i}-${a}`),n=St.get(i);return{locale:o,language:i,region:a,primary:l,secondary:n}}exists(t,r){var s;const{primary:o,secondary:i}=this.getTranslationData((s=r.lang)!==null&&s!==void 0?s:this.lang());return r=Object.assign({includeFallback:!1},r),!!(o&&o[t]||i&&i[t]||r.includeFallback&&ut&&ut[t])}term(t,...r){const{primary:s,secondary:o}=this.getTranslationData(this.lang());let i;if(s&&s[t])i=s[t];else if(o&&o[t])i=o[t];else if(ut&&ut[t])i=ut[t];else return console.error(`No translation found for: ${String(t)}`),String(t);return typeof i=="function"?i(...r):i}date(t,r){return t=new Date(t),new Intl.DateTimeFormat(this.lang(),r).format(t)}number(t,r){return t=Number(t),isNaN(t)?"":new Intl.NumberFormat(this.lang(),r).format(t)}relativeTime(t,r,s){return new Intl.RelativeTimeFormat(this.lang(),s).format(t,r)}};var bs={$code:"en",$name:"English",$dir:"ltr",carousel:"Carousel",clearEntry:"Clear entry",close:"Close",copied:"Copied",copy:"Copy",currentValue:"Current value",error:"Error",goToSlide:(e,t)=>`Go to slide ${e} of ${t}`,hidePassword:"Hide password",loading:"Loading",nextSlide:"Next slide",numOptionsSelected:e=>e===0?"No options selected":e===1?"1 option selected":`${e} options selected`,previousSlide:"Previous slide",progress:"Progress",remove:"Remove",resize:"Resize",scrollToEnd:"Scroll to end",scrollToStart:"Scroll to start",selectAColorFromTheScreen:"Select a color from the screen",showPassword:"Show password",slideNum:e=>`Slide ${e}`,toggleColorFormat:"Toggle color format"};hs(bs);var bo=bs,xt=class extends po{};hs(bo);var G=$`
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
`,fs=Object.defineProperty,fo=Object.defineProperties,go=Object.getOwnPropertyDescriptor,mo=Object.getOwnPropertyDescriptors,Br=Object.getOwnPropertySymbols,vo=Object.prototype.hasOwnProperty,yo=Object.prototype.propertyIsEnumerable,Me=(e,t)=>(t=Symbol[e])?t:Symbol.for("Symbol."+e),lr=e=>{throw TypeError(e)},Nr=(e,t,r)=>t in e?fs(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,wt=(e,t)=>{for(var r in t||(t={}))vo.call(t,r)&&Nr(e,r,t[r]);if(Br)for(var r of Br(t))yo.call(t,r)&&Nr(e,r,t[r]);return e},cr=(e,t)=>fo(e,mo(t)),d=(e,t,r,s)=>{for(var o=s>1?void 0:s?go(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&fs(t,r,o),o},gs=(e,t,r)=>t.has(e)||lr("Cannot "+r),xo=(e,t,r)=>(gs(e,t,"read from private field"),t.get(e)),wo=(e,t,r)=>t.has(e)?lr("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,r),_o=(e,t,r,s)=>(gs(e,t,"write to private field"),t.set(e,r),r),ko=function(e,t){this[0]=e,this[1]=t},$o=e=>{var t=e[Me("asyncIterator")],r=!1,s,o={};return t==null?(t=e[Me("iterator")](),s=i=>o[i]=a=>t[i](a)):(t=t.call(e),s=i=>o[i]=a=>{if(r){if(r=!1,i==="throw")throw a;return a}return r=!0,{done:!1,value:new ko(new Promise(l=>{var n=t[i](a);n instanceof Object||lr("Object expected"),l(n)}),1)}}),o[Me("iterator")]=()=>o,s("next"),"throw"in t?s("throw"):o.throw=i=>{throw i},"return"in t&&s("return"),o};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const P=e=>(t,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const So={attribute:!0,type:String,converter:At,reflect:!1,hasChanged:or},Co=(e=So,t,r)=>{const{kind:s,metadata:o}=r;let i=globalThis.litPropertyMetadata.get(o);if(i===void 0&&globalThis.litPropertyMetadata.set(o,i=new Map),s==="setter"&&((e=Object.create(e)).wrapped=!0),i.set(r.name,e),s==="accessor"){const{name:a}=r;return{set(l){const n=t.get.call(this);t.set.call(this,l),this.requestUpdate(a,n,e,!0,l)},init(l){return l!==void 0&&this.C(a,void 0,e,l),l}}}if(s==="setter"){const{name:a}=r;return function(l){const n=this[a];t.call(this,l),this.requestUpdate(a,n,e,!0,l)}}throw Error("Unsupported decorator location: "+s)};function u(e){return(t,r)=>typeof r=="object"?Co(e,t,r):((s,o,i)=>{const a=o.hasOwnProperty(i);return o.constructor.createProperty(i,s),a?Object.getOwnPropertyDescriptor(o,i):void 0})(e,t,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function k(e){return u({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Ao(e){return(t,r)=>{const s=typeof t=="function"?t:t[r];Object.assign(s,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Eo=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function B(e,t){return(r,s,o)=>{const i=a=>{var l;return((l=a.renderRoot)==null?void 0:l.querySelector(e))??null};return Eo(r,s,{get(){return i(this)}})}}var pe,L=class extends T{constructor(){super(),wo(this,pe,!1),this.initialReflectedProperties=new Map,Object.entries(this.constructor.dependencies).forEach(([e,t])=>{this.constructor.define(e,t)})}emit(e,t){const r=new CustomEvent(e,wt({bubbles:!0,cancelable:!1,composed:!0,detail:{}},t));return this.dispatchEvent(r),r}static define(e,t=this,r={}){const s=customElements.get(e);if(!s){try{customElements.define(e,t,r)}catch{customElements.define(e,class extends t{},r)}return}let o=" (unknown version)",i=o;"version"in t&&t.version&&(o=" v"+t.version),"version"in s&&s.version&&(i=" v"+s.version),!(o&&i&&o===i)&&console.warn(`Attempted to register <${e}>${o}, but <${e}>${i} has already been registered.`)}attributeChangedCallback(e,t,r){xo(this,pe)||(this.constructor.elementProperties.forEach((s,o)=>{s.reflect&&this[o]!=null&&this.initialReflectedProperties.set(o,this[o])}),_o(this,pe,!0)),super.attributeChangedCallback(e,t,r)}willUpdate(e){super.willUpdate(e),this.initialReflectedProperties.forEach((t,r)=>{e.has(r)&&this[r]==null&&(this[r]=t)})}};pe=new WeakMap;L.version="2.20.1";L.dependencies={};d([u()],L.prototype,"dir",2);d([u()],L.prototype,"lang",2);var ms=class extends L{constructor(){super(...arguments),this.localize=new xt(this)}render(){return p`
      <svg part="base" class="spinner" role="progressbar" aria-label=${this.localize.term("loading")}>
        <circle class="spinner__track"></circle>
        <circle class="spinner__indicator"></circle>
      </svg>
    `}};ms.styles=[G,ho];var Nt=new WeakMap,Ht=new WeakMap,Ft=new WeakMap,Ve=new WeakSet,le=new WeakMap,vs=class{constructor(e,t){this.handleFormData=r=>{const s=this.options.disabled(this.host),o=this.options.name(this.host),i=this.options.value(this.host),a=this.host.tagName.toLowerCase()==="sl-button";this.host.isConnected&&!s&&!a&&typeof o=="string"&&o.length>0&&typeof i<"u"&&(Array.isArray(i)?i.forEach(l=>{r.formData.append(o,l.toString())}):r.formData.append(o,i.toString()))},this.handleFormSubmit=r=>{var s;const o=this.options.disabled(this.host),i=this.options.reportValidity;this.form&&!this.form.noValidate&&((s=Nt.get(this.form))==null||s.forEach(a=>{this.setUserInteracted(a,!0)})),this.form&&!this.form.noValidate&&!o&&!i(this.host)&&(r.preventDefault(),r.stopImmediatePropagation())},this.handleFormReset=()=>{this.options.setValue(this.host,this.options.defaultValue(this.host)),this.setUserInteracted(this.host,!1),le.set(this.host,[])},this.handleInteraction=r=>{const s=le.get(this.host);s.includes(r.type)||s.push(r.type),s.length===this.options.assumeInteractionOn.length&&this.setUserInteracted(this.host,!0)},this.checkFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const s of r)if(typeof s.checkValidity=="function"&&!s.checkValidity())return!1}return!0},this.reportFormValidity=()=>{if(this.form&&!this.form.noValidate){const r=this.form.querySelectorAll("*");for(const s of r)if(typeof s.reportValidity=="function"&&!s.reportValidity())return!1}return!0},(this.host=e).addController(this),this.options=wt({form:r=>{const s=r.form;if(s){const i=r.getRootNode().querySelector(`#${s}`);if(i)return i}return r.closest("form")},name:r=>r.name,value:r=>r.value,defaultValue:r=>r.defaultValue,disabled:r=>{var s;return(s=r.disabled)!=null?s:!1},reportValidity:r=>typeof r.reportValidity=="function"?r.reportValidity():!0,checkValidity:r=>typeof r.checkValidity=="function"?r.checkValidity():!0,setValue:(r,s)=>r.value=s,assumeInteractionOn:["sl-input"]},t)}hostConnected(){const e=this.options.form(this.host);e&&this.attachForm(e),le.set(this.host,[]),this.options.assumeInteractionOn.forEach(t=>{this.host.addEventListener(t,this.handleInteraction)})}hostDisconnected(){this.detachForm(),le.delete(this.host),this.options.assumeInteractionOn.forEach(e=>{this.host.removeEventListener(e,this.handleInteraction)})}hostUpdated(){const e=this.options.form(this.host);e||this.detachForm(),e&&this.form!==e&&(this.detachForm(),this.attachForm(e)),this.host.hasUpdated&&this.setValidity(this.host.validity.valid)}attachForm(e){e?(this.form=e,Nt.has(this.form)?Nt.get(this.form).add(this.host):Nt.set(this.form,new Set([this.host])),this.form.addEventListener("formdata",this.handleFormData),this.form.addEventListener("submit",this.handleFormSubmit),this.form.addEventListener("reset",this.handleFormReset),Ht.has(this.form)||(Ht.set(this.form,this.form.reportValidity),this.form.reportValidity=()=>this.reportFormValidity()),Ft.has(this.form)||(Ft.set(this.form,this.form.checkValidity),this.form.checkValidity=()=>this.checkFormValidity())):this.form=void 0}detachForm(){if(!this.form)return;const e=Nt.get(this.form);e&&(e.delete(this.host),e.size<=0&&(this.form.removeEventListener("formdata",this.handleFormData),this.form.removeEventListener("submit",this.handleFormSubmit),this.form.removeEventListener("reset",this.handleFormReset),Ht.has(this.form)&&(this.form.reportValidity=Ht.get(this.form),Ht.delete(this.form)),Ft.has(this.form)&&(this.form.checkValidity=Ft.get(this.form),Ft.delete(this.form)),this.form=void 0))}setUserInteracted(e,t){t?Ve.add(e):Ve.delete(e),e.requestUpdate()}doAction(e,t){if(this.form){const r=document.createElement("button");r.type=e,r.style.position="absolute",r.style.width="0",r.style.height="0",r.style.clipPath="inset(50%)",r.style.overflow="hidden",r.style.whiteSpace="nowrap",t&&(r.name=t.name,r.value=t.value,["formaction","formenctype","formmethod","formnovalidate","formtarget"].forEach(s=>{t.hasAttribute(s)&&r.setAttribute(s,t.getAttribute(s))})),this.form.append(r),r.click(),r.remove()}}getForm(){var e;return(e=this.form)!=null?e:null}reset(e){this.doAction("reset",e)}submit(e){this.doAction("submit",e)}setValidity(e){const t=this.host,r=!!Ve.has(t),s=!!t.required;t.toggleAttribute("data-required",s),t.toggleAttribute("data-optional",!s),t.toggleAttribute("data-invalid",!e),t.toggleAttribute("data-valid",e),t.toggleAttribute("data-user-invalid",!e&&r),t.toggleAttribute("data-user-valid",e&&r)}updateValidity(){const e=this.host;this.setValidity(e.validity.valid)}emitInvalidEvent(e){const t=new CustomEvent("sl-invalid",{bubbles:!1,composed:!1,cancelable:!0,detail:{}});e||t.preventDefault(),this.host.dispatchEvent(t)||e==null||e.preventDefault()}},dr=Object.freeze({badInput:!1,customError:!1,patternMismatch:!1,rangeOverflow:!1,rangeUnderflow:!1,stepMismatch:!1,tooLong:!1,tooShort:!1,typeMismatch:!1,valid:!0,valueMissing:!1});Object.freeze(cr(wt({},dr),{valid:!1,valueMissing:!0}));Object.freeze(cr(wt({},dr),{valid:!1,customError:!0}));var To=$`
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
`,se=class{constructor(e,...t){this.slotNames=[],this.handleSlotChange=r=>{const s=r.target;(this.slotNames.includes("[default]")&&!s.name||s.name&&this.slotNames.includes(s.name))&&this.host.requestUpdate()},(this.host=e).addController(this),this.slotNames=t}hasDefaultSlot(){return[...this.host.childNodes].some(e=>{if(e.nodeType===e.TEXT_NODE&&e.textContent.trim()!=="")return!0;if(e.nodeType===e.ELEMENT_NODE){const t=e;if(t.tagName.toLowerCase()==="sl-visually-hidden")return!1;if(!t.hasAttribute("slot"))return!0}return!1})}hasNamedSlot(e){return this.host.querySelector(`:scope > [slot="${e}"]`)!==null}test(e){return e==="[default]"?this.hasDefaultSlot():this.hasNamedSlot(e)}hostConnected(){this.host.shadowRoot.addEventListener("slotchange",this.handleSlotChange)}hostDisconnected(){this.host.shadowRoot.removeEventListener("slotchange",this.handleSlotChange)}},Ke="";function Hr(e){Ke=e}function zo(e=""){if(!Ke){const t=[...document.getElementsByTagName("script")],r=t.find(s=>s.hasAttribute("data-shoelace"));if(r)Hr(r.getAttribute("data-shoelace"));else{const s=t.find(i=>/shoelace(\.min)?\.js($|\?)/.test(i.src)||/shoelace-autoloader(\.min)?\.js($|\?)/.test(i.src));let o="";s&&(o=s.getAttribute("src")),Hr(o.split("/").slice(0,-1).join("/"))}}return Ke.replace(/\/$/,"")+(e?`/${e.replace(/^\//,"")}`:"")}var Po={name:"default",resolver:e=>zo(`assets/icons/${e}.svg`)},Oo=Po,Fr={caret:`
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
  `},Ro={name:"system",resolver:e=>e in Fr?`data:image/svg+xml,${encodeURIComponent(Fr[e])}`:""},Io=Ro,Lo=[Oo,Io],Ge=[];function Do(e){Ge.push(e)}function Bo(e){Ge=Ge.filter(t=>t!==e)}function Mr(e){return Lo.find(t=>t.name===e)}var No=$`
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
`;function D(e,t){const r=wt({waitUntilFirstUpdate:!1},t);return(s,o)=>{const{update:i}=s,a=Array.isArray(e)?e:[e];s.update=function(l){a.forEach(n=>{const h=n;if(l.has(h)){const c=l.get(h),b=this[h];c!==b&&(!r.waitUntilFirstUpdate||this.hasUpdated)&&this[o](c,b)}}),i.call(this,l)}}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ho=(e,t)=>(e==null?void 0:e._$litType$)!==void 0,Fo=e=>e.strings===void 0,Mo={},Vo=(e,t=Mo)=>e._$AH=t;var Mt=Symbol(),ce=Symbol(),je,Ue=new Map,U=class extends L{constructor(){super(...arguments),this.initialRender=!1,this.svg=null,this.label="",this.library="default"}async resolveIcon(e,t){var r;let s;if(t!=null&&t.spriteSheet)return this.svg=p`<svg part="svg">
        <use part="use" href="${e}"></use>
      </svg>`,this.svg;try{if(s=await fetch(e,{mode:"cors"}),!s.ok)return s.status===410?Mt:ce}catch{return ce}try{const o=document.createElement("div");o.innerHTML=await s.text();const i=o.firstElementChild;if(((r=i==null?void 0:i.tagName)==null?void 0:r.toLowerCase())!=="svg")return Mt;je||(je=new DOMParser);const l=je.parseFromString(i.outerHTML,"text/html").body.querySelector("svg");return l?(l.part.add("svg"),document.adoptNode(l)):Mt}catch{return Mt}}connectedCallback(){super.connectedCallback(),Do(this)}firstUpdated(){this.initialRender=!0,this.setIcon()}disconnectedCallback(){super.disconnectedCallback(),Bo(this)}getIconSource(){const e=Mr(this.library);return this.name&&e?{url:e.resolver(this.name),fromLibrary:!0}:{url:this.src,fromLibrary:!1}}handleLabelChange(){typeof this.label=="string"&&this.label.length>0?(this.setAttribute("role","img"),this.setAttribute("aria-label",this.label),this.removeAttribute("aria-hidden")):(this.removeAttribute("role"),this.removeAttribute("aria-label"),this.setAttribute("aria-hidden","true"))}async setIcon(){var e;const{url:t,fromLibrary:r}=this.getIconSource(),s=r?Mr(this.library):void 0;if(!t){this.svg=null;return}let o=Ue.get(t);if(o||(o=this.resolveIcon(t,s),Ue.set(t,o)),!this.initialRender)return;const i=await o;if(i===ce&&Ue.delete(t),t===this.getIconSource().url){if(Ho(i)){if(this.svg=i,s){await this.updateComplete;const a=this.shadowRoot.querySelector("[part='svg']");typeof s.mutator=="function"&&a&&s.mutator(a)}return}switch(i){case ce:case Mt:this.svg=null,this.emit("sl-error");break;default:this.svg=i.cloneNode(!0),(e=s==null?void 0:s.mutator)==null||e.call(s,this.svg),this.emit("sl-load")}}}render(){return this.svg}};U.styles=[G,No];d([k()],U.prototype,"svg",2);d([u({reflect:!0})],U.prototype,"name",2);d([u()],U.prototype,"src",2);d([u()],U.prototype,"label",2);d([u({reflect:!0})],U.prototype,"library",2);d([D("label")],U.prototype,"handleLabelChange",1);d([D(["name","src","library"])],U.prototype,"setIcon",1);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ct={ATTRIBUTE:1,PROPERTY:3,BOOLEAN_ATTRIBUTE:4},ys=e=>(...t)=>({_$litDirective$:e,values:t});let xs=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,r,s){this._$Ct=t,this._$AM=r,this._$Ci=s}_$AS(t,r){return this.update(t,r)}update(t,r){return this.render(...r)}};/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const V=ys(class extends xs{constructor(e){var t;if(super(e),e.type!==ct.ATTRIBUTE||e.name!=="class"||((t=e.strings)==null?void 0:t.length)>2)throw Error("`classMap()` can only be used in the `class` attribute and must be the only part in the attribute.")}render(e){return" "+Object.keys(e).filter(t=>e[t]).join(" ")+" "}update(e,[t]){var s,o;if(this.st===void 0){this.st=new Set,e.strings!==void 0&&(this.nt=new Set(e.strings.join(" ").split(/\s/).filter(i=>i!=="")));for(const i in t)t[i]&&!((s=this.nt)!=null&&s.has(i))&&this.st.add(i);return this.render(t)}const r=e.element.classList;for(const i of this.st)i in t||(r.remove(i),this.st.delete(i));for(const i in t){const a=!!t[i];a===this.st.has(i)||(o=this.nt)!=null&&o.has(i)||(a?(r.add(i),this.st.add(i)):(r.remove(i),this.st.delete(i)))}return X}});/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const ws=Symbol.for(""),jo=e=>{if((e==null?void 0:e.r)===ws)return e==null?void 0:e._$litStatic$},ge=(e,...t)=>({_$litStatic$:t.reduce((r,s,o)=>r+(i=>{if(i._$litStatic$!==void 0)return i._$litStatic$;throw Error(`Value passed to 'literal' function must be a 'literal' result: ${i}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`)})(s)+e[o+1],e[0]),r:ws}),Vr=new Map,Uo=e=>(t,...r)=>{const s=r.length;let o,i;const a=[],l=[];let n,h=0,c=!1;for(;h<s;){for(n=t[h];h<s&&(i=r[h],(o=jo(i))!==void 0);)n+=o+t[++h],c=!0;h!==s&&l.push(i),a.push(n),h++}if(h===s&&a.push(t[s]),c){const b=a.join("$$lit$$");(t=Vr.get(b))===void 0&&(a.raw=a,Vr.set(b,t=a)),r=l}return e(t,...r)},be=Uo(p);/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const w=e=>e??y;var C=class extends L{constructor(){super(...arguments),this.formControlController=new vs(this,{assumeInteractionOn:["click"]}),this.hasSlotController=new se(this,"[default]","prefix","suffix"),this.localize=new xt(this),this.hasFocus=!1,this.invalid=!1,this.title="",this.variant="default",this.size="medium",this.caret=!1,this.disabled=!1,this.loading=!1,this.outline=!1,this.pill=!1,this.circle=!1,this.type="button",this.name="",this.value="",this.href="",this.rel="noreferrer noopener"}get validity(){return this.isButton()?this.button.validity:dr}get validationMessage(){return this.isButton()?this.button.validationMessage:""}firstUpdated(){this.isButton()&&this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(){this.type==="submit"&&this.formControlController.submit(this),this.type==="reset"&&this.formControlController.reset(this)}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}isButton(){return!this.href}isLink(){return!!this.href}handleDisabledChange(){this.isButton()&&this.formControlController.setValidity(this.disabled)}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}checkValidity(){return this.isButton()?this.button.checkValidity():!0}getForm(){return this.formControlController.getForm()}reportValidity(){return this.isButton()?this.button.reportValidity():!0}setCustomValidity(e){this.isButton()&&(this.button.setCustomValidity(e),this.formControlController.updateValidity())}render(){const e=this.isLink(),t=e?ge`a`:ge`button`;return be`
      <${t}
        part="base"
        class=${V({button:!0,"button--default":this.variant==="default","button--primary":this.variant==="primary","button--success":this.variant==="success","button--neutral":this.variant==="neutral","button--warning":this.variant==="warning","button--danger":this.variant==="danger","button--text":this.variant==="text","button--small":this.size==="small","button--medium":this.size==="medium","button--large":this.size==="large","button--caret":this.caret,"button--circle":this.circle,"button--disabled":this.disabled,"button--focused":this.hasFocus,"button--loading":this.loading,"button--standard":!this.outline,"button--outline":this.outline,"button--pill":this.pill,"button--rtl":this.localize.dir()==="rtl","button--has-label":this.hasSlotController.test("[default]"),"button--has-prefix":this.hasSlotController.test("prefix"),"button--has-suffix":this.hasSlotController.test("suffix")})}
        ?disabled=${w(e?void 0:this.disabled)}
        type=${w(e?void 0:this.type)}
        title=${this.title}
        name=${w(e?void 0:this.name)}
        value=${w(e?void 0:this.value)}
        href=${w(e&&!this.disabled?this.href:void 0)}
        target=${w(e?this.target:void 0)}
        download=${w(e?this.download:void 0)}
        rel=${w(e?this.rel:void 0)}
        role=${w(e?void 0:"button")}
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
        ${this.caret?be` <sl-icon part="caret" class="button__caret" library="system" name="caret"></sl-icon> `:""}
        ${this.loading?be`<sl-spinner part="spinner"></sl-spinner>`:""}
      </${t}>
    `}};C.styles=[G,To];C.dependencies={"sl-icon":U,"sl-spinner":ms};d([B(".button")],C.prototype,"button",2);d([k()],C.prototype,"hasFocus",2);d([k()],C.prototype,"invalid",2);d([u()],C.prototype,"title",2);d([u({reflect:!0})],C.prototype,"variant",2);d([u({reflect:!0})],C.prototype,"size",2);d([u({type:Boolean,reflect:!0})],C.prototype,"caret",2);d([u({type:Boolean,reflect:!0})],C.prototype,"disabled",2);d([u({type:Boolean,reflect:!0})],C.prototype,"loading",2);d([u({type:Boolean,reflect:!0})],C.prototype,"outline",2);d([u({type:Boolean,reflect:!0})],C.prototype,"pill",2);d([u({type:Boolean,reflect:!0})],C.prototype,"circle",2);d([u()],C.prototype,"type",2);d([u()],C.prototype,"name",2);d([u()],C.prototype,"value",2);d([u()],C.prototype,"href",2);d([u()],C.prototype,"target",2);d([u()],C.prototype,"rel",2);d([u()],C.prototype,"download",2);d([u()],C.prototype,"form",2);d([u({attribute:"formaction"})],C.prototype,"formAction",2);d([u({attribute:"formenctype"})],C.prototype,"formEnctype",2);d([u({attribute:"formmethod"})],C.prototype,"formMethod",2);d([u({attribute:"formnovalidate",type:Boolean})],C.prototype,"formNoValidate",2);d([u({attribute:"formtarget"})],C.prototype,"formTarget",2);d([D("disabled",{waitUntilFirstUpdate:!0})],C.prototype,"handleDisabledChange",1);C.define("sl-button");U.define("sl-icon");var qo=$`
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
`,Wo=(e="value")=>(t,r)=>{const s=t.constructor,o=s.prototype.attributeChangedCallback;s.prototype.attributeChangedCallback=function(i,a,l){var n;const h=s.getPropertyOptions(e),c=typeof h.attribute=="string"?h.attribute:e;if(i===c){const b=h.converter||At,x=(typeof b=="function"?b:(n=b==null?void 0:b.fromAttribute)!=null?n:At.fromAttribute)(l,h.type);this[e]!==x&&(this[r]=x)}o.call(this,i,a,l)}},Xo=$`
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
 */const Ko=ys(class extends xs{constructor(e){if(super(e),e.type!==ct.PROPERTY&&e.type!==ct.ATTRIBUTE&&e.type!==ct.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!Fo(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[t]){if(t===X||t===y)return t;const r=e.element,s=e.name;if(e.type===ct.PROPERTY){if(t===r[s])return X}else if(e.type===ct.BOOLEAN_ATTRIBUTE){if(!!t===r.hasAttribute(s))return X}else if(e.type===ct.ATTRIBUTE&&r.getAttribute(s)===t+"")return X;return Vo(e),t}});var v=class extends L{constructor(){super(...arguments),this.formControlController=new vs(this,{assumeInteractionOn:["sl-blur","sl-input"]}),this.hasSlotController=new se(this,"help-text","label"),this.localize=new xt(this),this.hasFocus=!1,this.title="",this.__numberInput=Object.assign(document.createElement("input"),{type:"number"}),this.__dateInput=Object.assign(document.createElement("input"),{type:"date"}),this.type="text",this.name="",this.value="",this.defaultValue="",this.size="medium",this.filled=!1,this.pill=!1,this.label="",this.helpText="",this.clearable=!1,this.disabled=!1,this.placeholder="",this.readonly=!1,this.passwordToggle=!1,this.passwordVisible=!1,this.noSpinButtons=!1,this.form="",this.required=!1,this.spellcheck=!0}get valueAsDate(){var e;return this.__dateInput.type=this.type,this.__dateInput.value=this.value,((e=this.input)==null?void 0:e.valueAsDate)||this.__dateInput.valueAsDate}set valueAsDate(e){this.__dateInput.type=this.type,this.__dateInput.valueAsDate=e,this.value=this.__dateInput.value}get valueAsNumber(){var e;return this.__numberInput.value=this.value,((e=this.input)==null?void 0:e.valueAsNumber)||this.__numberInput.valueAsNumber}set valueAsNumber(e){this.__numberInput.valueAsNumber=e,this.value=this.__numberInput.value}get validity(){return this.input.validity}get validationMessage(){return this.input.validationMessage}firstUpdated(){this.formControlController.updateValidity()}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleChange(){this.value=this.input.value,this.emit("sl-change")}handleClearClick(e){e.preventDefault(),this.value!==""&&(this.value="",this.emit("sl-clear"),this.emit("sl-input"),this.emit("sl-change")),this.input.focus()}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleInput(){this.value=this.input.value,this.formControlController.updateValidity(),this.emit("sl-input")}handleInvalid(e){this.formControlController.setValidity(!1),this.formControlController.emitInvalidEvent(e)}handleKeyDown(e){const t=e.metaKey||e.ctrlKey||e.shiftKey||e.altKey;e.key==="Enter"&&!t&&setTimeout(()=>{!e.defaultPrevented&&!e.isComposing&&this.formControlController.submit()})}handlePasswordToggle(){this.passwordVisible=!this.passwordVisible}handleDisabledChange(){this.formControlController.setValidity(this.disabled)}handleStepChange(){this.input.step=String(this.step),this.formControlController.updateValidity()}async handleValueChange(){await this.updateComplete,this.formControlController.updateValidity()}focus(e){this.input.focus(e)}blur(){this.input.blur()}select(){this.input.select()}setSelectionRange(e,t,r="none"){this.input.setSelectionRange(e,t,r)}setRangeText(e,t,r,s="preserve"){const o=t??this.input.selectionStart,i=r??this.input.selectionEnd;this.input.setRangeText(e,o,i,s),this.value!==this.input.value&&(this.value=this.input.value)}showPicker(){"showPicker"in HTMLInputElement.prototype&&this.input.showPicker()}stepUp(){this.input.stepUp(),this.value!==this.input.value&&(this.value=this.input.value)}stepDown(){this.input.stepDown(),this.value!==this.input.value&&(this.value=this.input.value)}checkValidity(){return this.input.checkValidity()}getForm(){return this.formControlController.getForm()}reportValidity(){return this.input.reportValidity()}setCustomValidity(e){this.input.setCustomValidity(e),this.formControlController.updateValidity()}render(){const e=this.hasSlotController.test("label"),t=this.hasSlotController.test("help-text"),r=this.label?!0:!!e,s=this.helpText?!0:!!t,i=this.clearable&&!this.disabled&&!this.readonly&&(typeof this.value=="number"||this.value.length>0);return p`
      <div
        part="form-control"
        class=${V({"form-control":!0,"form-control--small":this.size==="small","form-control--medium":this.size==="medium","form-control--large":this.size==="large","form-control--has-label":r,"form-control--has-help-text":s})}
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
            class=${V({input:!0,"input--small":this.size==="small","input--medium":this.size==="medium","input--large":this.size==="large","input--pill":this.pill,"input--standard":!this.filled,"input--filled":this.filled,"input--disabled":this.disabled,"input--focused":this.hasFocus,"input--empty":!this.value,"input--no-spin-buttons":this.noSpinButtons})}
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
              name=${w(this.name)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              placeholder=${w(this.placeholder)}
              minlength=${w(this.minlength)}
              maxlength=${w(this.maxlength)}
              min=${w(this.min)}
              max=${w(this.max)}
              step=${w(this.step)}
              .value=${Ko(this.value)}
              autocapitalize=${w(this.autocapitalize)}
              autocomplete=${w(this.autocomplete)}
              autocorrect=${w(this.autocorrect)}
              ?autofocus=${this.autofocus}
              spellcheck=${this.spellcheck}
              pattern=${w(this.pattern)}
              enterkeyhint=${w(this.enterkeyhint)}
              inputmode=${w(this.inputmode)}
              aria-describedby="help-text"
              @change=${this.handleChange}
              @input=${this.handleInput}
              @invalid=${this.handleInvalid}
              @keydown=${this.handleKeyDown}
              @focus=${this.handleFocus}
              @blur=${this.handleBlur}
            />

            ${i?p`
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
          aria-hidden=${s?"false":"true"}
        >
          <slot name="help-text">${this.helpText}</slot>
        </div>
      </div>
    `}};v.styles=[G,Xo,qo];v.dependencies={"sl-icon":U};d([B(".input__control")],v.prototype,"input",2);d([k()],v.prototype,"hasFocus",2);d([u()],v.prototype,"title",2);d([u({reflect:!0})],v.prototype,"type",2);d([u()],v.prototype,"name",2);d([u()],v.prototype,"value",2);d([Wo()],v.prototype,"defaultValue",2);d([u({reflect:!0})],v.prototype,"size",2);d([u({type:Boolean,reflect:!0})],v.prototype,"filled",2);d([u({type:Boolean,reflect:!0})],v.prototype,"pill",2);d([u()],v.prototype,"label",2);d([u({attribute:"help-text"})],v.prototype,"helpText",2);d([u({type:Boolean})],v.prototype,"clearable",2);d([u({type:Boolean,reflect:!0})],v.prototype,"disabled",2);d([u()],v.prototype,"placeholder",2);d([u({type:Boolean,reflect:!0})],v.prototype,"readonly",2);d([u({attribute:"password-toggle",type:Boolean})],v.prototype,"passwordToggle",2);d([u({attribute:"password-visible",type:Boolean})],v.prototype,"passwordVisible",2);d([u({attribute:"no-spin-buttons",type:Boolean})],v.prototype,"noSpinButtons",2);d([u({reflect:!0})],v.prototype,"form",2);d([u({type:Boolean,reflect:!0})],v.prototype,"required",2);d([u()],v.prototype,"pattern",2);d([u({type:Number})],v.prototype,"minlength",2);d([u({type:Number})],v.prototype,"maxlength",2);d([u()],v.prototype,"min",2);d([u()],v.prototype,"max",2);d([u()],v.prototype,"step",2);d([u()],v.prototype,"autocapitalize",2);d([u()],v.prototype,"autocorrect",2);d([u()],v.prototype,"autocomplete",2);d([u({type:Boolean})],v.prototype,"autofocus",2);d([u()],v.prototype,"enterkeyhint",2);d([u({type:Boolean,converter:{fromAttribute:e=>!(!e||e==="false"),toAttribute:e=>e?"true":"false"}})],v.prototype,"spellcheck",2);d([u()],v.prototype,"inputmode",2);d([D("disabled",{waitUntilFirstUpdate:!0})],v.prototype,"handleDisabledChange",1);d([D("step",{waitUntilFirstUpdate:!0})],v.prototype,"handleStepChange",1);d([D("value",{waitUntilFirstUpdate:!0})],v.prototype,"handleValueChange",1);v.define("sl-input");var Go=$`
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
`,_s=class extends L{constructor(){super(...arguments),this.hasSlotController=new se(this,"footer","header","image")}render(){return p`
      <div
        part="base"
        class=${V({card:!0,"card--has-footer":this.hasSlotController.test("footer"),"card--has-image":this.hasSlotController.test("image"),"card--has-header":this.hasSlotController.test("header")})}
      >
        <slot name="image" part="image" class="card__image"></slot>
        <slot name="header" part="header" class="card__header"></slot>
        <slot part="body" class="card__body"></slot>
        <slot name="footer" part="footer" class="card__footer"></slot>
      </div>
    `}};_s.styles=[G,Go];_s.define("sl-card");var Zo=$`
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
`,Qo=$`
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
`,I=class extends L{constructor(){super(...arguments),this.hasFocus=!1,this.label="",this.disabled=!1}handleBlur(){this.hasFocus=!1,this.emit("sl-blur")}handleFocus(){this.hasFocus=!0,this.emit("sl-focus")}handleClick(e){this.disabled&&(e.preventDefault(),e.stopPropagation())}click(){this.button.click()}focus(e){this.button.focus(e)}blur(){this.button.blur()}render(){const e=!!this.href,t=e?ge`a`:ge`button`;return be`
      <${t}
        part="base"
        class=${V({"icon-button":!0,"icon-button--disabled":!e&&this.disabled,"icon-button--focused":this.hasFocus})}
        ?disabled=${w(e?void 0:this.disabled)}
        type=${w(e?void 0:"button")}
        href=${w(e?this.href:void 0)}
        target=${w(e?this.target:void 0)}
        download=${w(e?this.download:void 0)}
        rel=${w(e&&this.target?"noreferrer noopener":void 0)}
        role=${w(e?void 0:"button")}
        aria-disabled=${this.disabled?"true":"false"}
        aria-label="${this.label}"
        tabindex=${this.disabled?"-1":"0"}
        @blur=${this.handleBlur}
        @focus=${this.handleFocus}
        @click=${this.handleClick}
      >
        <sl-icon
          class="icon-button__icon"
          name=${w(this.name)}
          library=${w(this.library)}
          src=${w(this.src)}
          aria-hidden="true"
        ></sl-icon>
      </${t}>
    `}};I.styles=[G,Qo];I.dependencies={"sl-icon":U};d([B(".icon-button")],I.prototype,"button",2);d([k()],I.prototype,"hasFocus",2);d([u()],I.prototype,"name",2);d([u()],I.prototype,"library",2);d([u()],I.prototype,"src",2);d([u()],I.prototype,"href",2);d([u()],I.prototype,"target",2);d([u()],I.prototype,"download",2);d([u()],I.prototype,"label",2);d([u({type:Boolean,reflect:!0})],I.prototype,"disabled",2);var Yo=0,Z=class extends L{constructor(){super(...arguments),this.localize=new xt(this),this.attrId=++Yo,this.componentId=`sl-tab-${this.attrId}`,this.panel="",this.active=!1,this.closable=!1,this.disabled=!1,this.tabIndex=0}connectedCallback(){super.connectedCallback(),this.setAttribute("role","tab")}handleCloseClick(e){e.stopPropagation(),this.emit("sl-close")}handleActiveChange(){this.setAttribute("aria-selected",this.active?"true":"false")}handleDisabledChange(){this.setAttribute("aria-disabled",this.disabled?"true":"false"),this.disabled&&!this.active?this.tabIndex=-1:this.tabIndex=0}render(){return this.id=this.id.length>0?this.id:this.componentId,p`
      <div
        part="base"
        class=${V({tab:!0,"tab--active":this.active,"tab--closable":this.closable,"tab--disabled":this.disabled})}
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
    `}};Z.styles=[G,Zo];Z.dependencies={"sl-icon-button":I};d([B(".tab")],Z.prototype,"tab",2);d([u({reflect:!0})],Z.prototype,"panel",2);d([u({type:Boolean,reflect:!0})],Z.prototype,"active",2);d([u({type:Boolean,reflect:!0})],Z.prototype,"closable",2);d([u({type:Boolean,reflect:!0})],Z.prototype,"disabled",2);d([u({type:Number,reflect:!0})],Z.prototype,"tabIndex",2);d([D("active")],Z.prototype,"handleActiveChange",1);d([D("disabled")],Z.prototype,"handleDisabledChange",1);Z.define("sl-tab");var Jo=$`
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
`,ti=$`
  :host {
    display: contents;
  }
`,Ce=class extends L{constructor(){super(...arguments),this.observedElements=[],this.disabled=!1}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(e=>{this.emit("sl-resize",{detail:{entries:e}})}),this.disabled||this.startObserver()}disconnectedCallback(){super.disconnectedCallback(),this.stopObserver()}handleSlotChange(){this.disabled||this.startObserver()}startObserver(){const e=this.shadowRoot.querySelector("slot");if(e!==null){const t=e.assignedElements({flatten:!0});this.observedElements.forEach(r=>this.resizeObserver.unobserve(r)),this.observedElements=[],t.forEach(r=>{this.resizeObserver.observe(r),this.observedElements.push(r)})}}stopObserver(){this.resizeObserver.disconnect()}handleDisabledChange(){this.disabled?this.stopObserver():this.startObserver()}render(){return p` <slot @slotchange=${this.handleSlotChange}></slot> `}};Ce.styles=[G,ti];d([u({type:Boolean,reflect:!0})],Ce.prototype,"disabled",2);d([D("disabled",{waitUntilFirstUpdate:!0})],Ce.prototype,"handleDisabledChange",1);function ei(e,t){return{top:Math.round(e.getBoundingClientRect().top-t.getBoundingClientRect().top),left:Math.round(e.getBoundingClientRect().left-t.getBoundingClientRect().left)}}var Ze=new Set;function ri(){const e=document.documentElement.clientWidth;return Math.abs(window.innerWidth-e)}function si(){const e=Number(getComputedStyle(document.body).paddingRight.replace(/px/,""));return isNaN(e)||!e?0:e}function qe(e){if(Ze.add(e),!document.documentElement.classList.contains("sl-scroll-lock")){const t=ri()+si();let r=getComputedStyle(document.documentElement).scrollbarGutter;(!r||r==="auto")&&(r="stable"),t<2&&(r=""),document.documentElement.style.setProperty("--sl-scroll-lock-gutter",r),document.documentElement.classList.add("sl-scroll-lock"),document.documentElement.style.setProperty("--sl-scroll-lock-size",`${t}px`)}}function We(e){Ze.delete(e),Ze.size===0&&(document.documentElement.classList.remove("sl-scroll-lock"),document.documentElement.style.removeProperty("--sl-scroll-lock-size"))}function jr(e,t,r="vertical",s="smooth"){const o=ei(e,t),i=o.top+t.scrollTop,a=o.left+t.scrollLeft,l=t.scrollLeft,n=t.scrollLeft+t.offsetWidth,h=t.scrollTop,c=t.scrollTop+t.offsetHeight;(r==="horizontal"||r==="both")&&(a<l?t.scrollTo({left:a,behavior:s}):a+e.clientWidth>n&&t.scrollTo({left:a-t.offsetWidth+e.clientWidth,behavior:s})),(r==="vertical"||r==="both")&&(i<h?t.scrollTo({top:i,behavior:s}):i+e.clientHeight>c&&t.scrollTo({top:i-t.offsetHeight+e.clientHeight,behavior:s}))}var O=class extends L{constructor(){super(...arguments),this.tabs=[],this.focusableTabs=[],this.panels=[],this.localize=new xt(this),this.hasScrollControls=!1,this.shouldHideScrollStartButton=!1,this.shouldHideScrollEndButton=!1,this.placement="top",this.activation="auto",this.noScrollControls=!1,this.fixedScrollControls=!1,this.scrollOffset=1}connectedCallback(){const e=Promise.all([customElements.whenDefined("sl-tab"),customElements.whenDefined("sl-tab-panel")]);super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.repositionIndicator(),this.updateScrollControls()}),this.mutationObserver=new MutationObserver(t=>{const r=t.filter(({target:s})=>{if(s===this)return!0;if(s.closest("sl-tab-group")!==this)return!1;const o=s.tagName.toLowerCase();return o==="sl-tab"||o==="sl-tab-panel"});if(r.length!==0){if(r.some(s=>!["aria-labelledby","aria-controls"].includes(s.attributeName))&&setTimeout(()=>this.setAriaLabels()),r.some(s=>s.attributeName==="disabled"))this.syncTabsAndPanels();else if(r.some(s=>s.attributeName==="active")){const o=r.filter(i=>i.attributeName==="active"&&i.target.tagName.toLowerCase()==="sl-tab").map(i=>i.target).find(i=>i.active);o&&this.setActiveTab(o)}}}),this.updateComplete.then(()=>{this.syncTabsAndPanels(),this.mutationObserver.observe(this,{attributes:!0,attributeFilter:["active","disabled","name","panel"],childList:!0,subtree:!0}),this.resizeObserver.observe(this.nav),e.then(()=>{new IntersectionObserver((r,s)=>{var o;r[0].intersectionRatio>0&&(this.setAriaLabels(),this.setActiveTab((o=this.getActiveTab())!=null?o:this.tabs[0],{emitEvents:!1}),s.unobserve(r[0].target))}).observe(this.tabGroup)})})}disconnectedCallback(){var e,t;super.disconnectedCallback(),(e=this.mutationObserver)==null||e.disconnect(),this.nav&&((t=this.resizeObserver)==null||t.unobserve(this.nav))}getAllTabs(){return this.shadowRoot.querySelector('slot[name="nav"]').assignedElements()}getAllPanels(){return[...this.body.assignedElements()].filter(e=>e.tagName.toLowerCase()==="sl-tab-panel")}getActiveTab(){return this.tabs.find(e=>e.active)}handleClick(e){const r=e.target.closest("sl-tab");(r==null?void 0:r.closest("sl-tab-group"))===this&&r!==null&&this.setActiveTab(r,{scrollBehavior:"smooth"})}handleKeyDown(e){const r=e.target.closest("sl-tab");if((r==null?void 0:r.closest("sl-tab-group"))===this&&(["Enter"," "].includes(e.key)&&r!==null&&(this.setActiveTab(r,{scrollBehavior:"smooth"}),e.preventDefault()),["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(e.key))){const o=this.tabs.find(l=>l.matches(":focus")),i=this.localize.dir()==="rtl";let a=null;if((o==null?void 0:o.tagName.toLowerCase())==="sl-tab"){if(e.key==="Home")a=this.focusableTabs[0];else if(e.key==="End")a=this.focusableTabs[this.focusableTabs.length-1];else if(["top","bottom"].includes(this.placement)&&e.key===(i?"ArrowRight":"ArrowLeft")||["start","end"].includes(this.placement)&&e.key==="ArrowUp"){const l=this.tabs.findIndex(n=>n===o);a=this.findNextFocusableTab(l,"backward")}else if(["top","bottom"].includes(this.placement)&&e.key===(i?"ArrowLeft":"ArrowRight")||["start","end"].includes(this.placement)&&e.key==="ArrowDown"){const l=this.tabs.findIndex(n=>n===o);a=this.findNextFocusableTab(l,"forward")}if(!a)return;a.tabIndex=0,a.focus({preventScroll:!0}),this.activation==="auto"?this.setActiveTab(a,{scrollBehavior:"smooth"}):this.tabs.forEach(l=>{l.tabIndex=l===a?0:-1}),["top","bottom"].includes(this.placement)&&jr(a,this.nav,"horizontal"),e.preventDefault()}}}handleScrollToStart(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft+this.nav.clientWidth:this.nav.scrollLeft-this.nav.clientWidth,behavior:"smooth"})}handleScrollToEnd(){this.nav.scroll({left:this.localize.dir()==="rtl"?this.nav.scrollLeft-this.nav.clientWidth:this.nav.scrollLeft+this.nav.clientWidth,behavior:"smooth"})}setActiveTab(e,t){if(t=wt({emitEvents:!0,scrollBehavior:"auto"},t),e!==this.activeTab&&!e.disabled){const r=this.activeTab;this.activeTab=e,this.tabs.forEach(s=>{s.active=s===this.activeTab,s.tabIndex=s===this.activeTab?0:-1}),this.panels.forEach(s=>{var o;return s.active=s.name===((o=this.activeTab)==null?void 0:o.panel)}),this.syncIndicator(),["top","bottom"].includes(this.placement)&&jr(this.activeTab,this.nav,"horizontal",t.scrollBehavior),t.emitEvents&&(r&&this.emit("sl-tab-hide",{detail:{name:r.panel}}),this.emit("sl-tab-show",{detail:{name:this.activeTab.panel}}))}}setAriaLabels(){this.tabs.forEach(e=>{const t=this.panels.find(r=>r.name===e.panel);t&&(e.setAttribute("aria-controls",t.getAttribute("id")),t.setAttribute("aria-labelledby",e.getAttribute("id")))})}repositionIndicator(){const e=this.getActiveTab();if(!e)return;const t=e.clientWidth,r=e.clientHeight,s=this.localize.dir()==="rtl",o=this.getAllTabs(),a=o.slice(0,o.indexOf(e)).reduce((l,n)=>({left:l.left+n.clientWidth,top:l.top+n.clientHeight}),{left:0,top:0});switch(this.placement){case"top":case"bottom":this.indicator.style.width=`${t}px`,this.indicator.style.height="auto",this.indicator.style.translate=s?`${-1*a.left}px`:`${a.left}px`;break;case"start":case"end":this.indicator.style.width="auto",this.indicator.style.height=`${r}px`,this.indicator.style.translate=`0 ${a.top}px`;break}}syncTabsAndPanels(){this.tabs=this.getAllTabs(),this.focusableTabs=this.tabs.filter(e=>!e.disabled),this.panels=this.getAllPanels(),this.syncIndicator(),this.updateComplete.then(()=>this.updateScrollControls())}findNextFocusableTab(e,t){let r=null;const s=t==="forward"?1:-1;let o=e+s;for(;e<this.tabs.length;){if(r=this.tabs[o]||null,r===null){t==="forward"?r=this.focusableTabs[0]:r=this.focusableTabs[this.focusableTabs.length-1];break}if(!r.disabled)break;o+=s}return r}updateScrollButtons(){this.hasScrollControls&&!this.fixedScrollControls&&(this.shouldHideScrollStartButton=this.scrollFromStart()<=this.scrollOffset,this.shouldHideScrollEndButton=this.isScrolledToEnd())}isScrolledToEnd(){return this.scrollFromStart()+this.nav.clientWidth>=this.nav.scrollWidth-this.scrollOffset}scrollFromStart(){return this.localize.dir()==="rtl"?-this.nav.scrollLeft:this.nav.scrollLeft}updateScrollControls(){this.noScrollControls?this.hasScrollControls=!1:this.hasScrollControls=["top","bottom"].includes(this.placement)&&this.nav.scrollWidth>this.nav.clientWidth+1,this.updateScrollButtons()}syncIndicator(){this.getActiveTab()?(this.indicator.style.display="block",this.repositionIndicator()):this.indicator.style.display="none"}show(e){const t=this.tabs.find(r=>r.panel===e);t&&this.setActiveTab(t,{scrollBehavior:"smooth"})}render(){const e=this.localize.dir()==="rtl";return p`
      <div
        part="base"
        class=${V({"tab-group":!0,"tab-group--top":this.placement==="top","tab-group--bottom":this.placement==="bottom","tab-group--start":this.placement==="start","tab-group--end":this.placement==="end","tab-group--rtl":this.localize.dir()==="rtl","tab-group--has-scroll-controls":this.hasScrollControls})}
        @click=${this.handleClick}
        @keydown=${this.handleKeyDown}
      >
        <div class="tab-group__nav-container" part="nav">
          ${this.hasScrollControls?p`
                <sl-icon-button
                  part="scroll-button scroll-button--start"
                  exportparts="base:scroll-button__base"
                  class=${V({"tab-group__scroll-button":!0,"tab-group__scroll-button--start":!0,"tab-group__scroll-button--start--hidden":this.shouldHideScrollStartButton})}
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

          ${this.hasScrollControls?p`
                <sl-icon-button
                  part="scroll-button scroll-button--end"
                  exportparts="base:scroll-button__base"
                  class=${V({"tab-group__scroll-button":!0,"tab-group__scroll-button--end":!0,"tab-group__scroll-button--end--hidden":this.shouldHideScrollEndButton})}
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
    `}};O.styles=[G,Jo];O.dependencies={"sl-icon-button":I,"sl-resize-observer":Ce};d([B(".tab-group")],O.prototype,"tabGroup",2);d([B(".tab-group__body")],O.prototype,"body",2);d([B(".tab-group__nav")],O.prototype,"nav",2);d([B(".tab-group__indicator")],O.prototype,"indicator",2);d([k()],O.prototype,"hasScrollControls",2);d([k()],O.prototype,"shouldHideScrollStartButton",2);d([k()],O.prototype,"shouldHideScrollEndButton",2);d([u()],O.prototype,"placement",2);d([u()],O.prototype,"activation",2);d([u({attribute:"no-scroll-controls",type:Boolean})],O.prototype,"noScrollControls",2);d([u({attribute:"fixed-scroll-controls",type:Boolean})],O.prototype,"fixedScrollControls",2);d([Ao({passive:!0})],O.prototype,"updateScrollButtons",1);d([D("noScrollControls",{waitUntilFirstUpdate:!0})],O.prototype,"updateScrollControls",1);d([D("placement",{waitUntilFirstUpdate:!0})],O.prototype,"syncIndicator",1);O.define("sl-tab-group");var oi=(e,t)=>{let r=0;return function(...s){window.clearTimeout(r),r=window.setTimeout(()=>{e.call(this,...s)},t)}},Ur=(e,t,r)=>{const s=e[t];e[t]=function(...o){s.call(this,...o),r.call(this,s,...o)}};(()=>{if(typeof window>"u")return;if(!("onscrollend"in window)){const t=new Set,r=new WeakMap,s=i=>{for(const a of i.changedTouches)t.add(a.identifier)},o=i=>{for(const a of i.changedTouches)t.delete(a.identifier)};document.addEventListener("touchstart",s,!0),document.addEventListener("touchend",o,!0),document.addEventListener("touchcancel",o,!0),Ur(EventTarget.prototype,"addEventListener",function(i,a){if(a!=="scrollend")return;const l=oi(()=>{t.size?l():this.dispatchEvent(new Event("scrollend"))},100);i.call(this,"scroll",l,{passive:!0}),r.set(this,l)}),Ur(EventTarget.prototype,"removeEventListener",function(i,a){if(a!=="scrollend")return;const l=r.get(this);l&&i.call(this,"scroll",l,{passive:!0})})}})();var ii=$`
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
`;function*ur(e=document.activeElement){e!=null&&(yield e,"shadowRoot"in e&&e.shadowRoot&&e.shadowRoot.mode!=="closed"&&(yield*$o(ur(e.shadowRoot.activeElement))))}function ai(){return[...ur()].pop()}var qr=new WeakMap;function ks(e){let t=qr.get(e);return t||(t=window.getComputedStyle(e,null),qr.set(e,t)),t}function ni(e){if(typeof e.checkVisibility=="function")return e.checkVisibility({checkOpacity:!1,checkVisibilityCSS:!0});const t=ks(e);return t.visibility!=="hidden"&&t.display!=="none"}function li(e){const t=ks(e),{overflowY:r,overflowX:s}=t;return r==="scroll"||s==="scroll"?!0:r!=="auto"||s!=="auto"?!1:e.scrollHeight>e.clientHeight&&r==="auto"||e.scrollWidth>e.clientWidth&&s==="auto"}function ci(e){const t=e.tagName.toLowerCase(),r=Number(e.getAttribute("tabindex"));if(e.hasAttribute("tabindex")&&(isNaN(r)||r<=-1)||e.hasAttribute("disabled")||e.closest("[inert]"))return!1;if(t==="input"&&e.getAttribute("type")==="radio"){const i=e.getRootNode(),a=`input[type='radio'][name="${e.getAttribute("name")}"]`,l=i.querySelector(`${a}:checked`);return l?l===e:i.querySelector(a)===e}return ni(e)?(t==="audio"||t==="video")&&e.hasAttribute("controls")||e.hasAttribute("tabindex")||e.hasAttribute("contenteditable")&&e.getAttribute("contenteditable")!=="false"||["button","input","select","textarea","a","audio","video","summary","iframe"].includes(t)?!0:li(e):!1}function di(e,t){var r;return((r=e.getRootNode({composed:!0}))==null?void 0:r.host)!==t}function Wr(e){const t=new WeakMap,r=[];function s(o){if(o instanceof Element){if(o.hasAttribute("inert")||o.closest("[inert]")||t.has(o))return;t.set(o,!0),!r.includes(o)&&ci(o)&&r.push(o),o instanceof HTMLSlotElement&&di(o,e)&&o.assignedElements({flatten:!0}).forEach(i=>{s(i)}),o.shadowRoot!==null&&o.shadowRoot.mode==="open"&&s(o.shadowRoot)}for(const i of o.children)s(i)}return s(e),r.sort((o,i)=>{const a=Number(o.getAttribute("tabindex"))||0;return(Number(i.getAttribute("tabindex"))||0)-a})}var Vt=[],ui=class{constructor(e){this.tabDirection="forward",this.handleFocusIn=()=>{this.isActive()&&this.checkFocus()},this.handleKeyDown=t=>{var r;if(t.key!=="Tab"||this.isExternalActivated||!this.isActive())return;const s=ai();if(this.previousFocus=s,this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus))return;t.shiftKey?this.tabDirection="backward":this.tabDirection="forward";const o=Wr(this.element);let i=o.findIndex(l=>l===s);this.previousFocus=this.currentFocus;const a=this.tabDirection==="forward"?1:-1;for(;;){i+a>=o.length?i=0:i+a<0?i=o.length-1:i+=a,this.previousFocus=this.currentFocus;const l=o[i];if(this.tabDirection==="backward"&&this.previousFocus&&this.possiblyHasTabbableChildren(this.previousFocus)||l&&this.possiblyHasTabbableChildren(l))return;t.preventDefault(),this.currentFocus=l,(r=this.currentFocus)==null||r.focus({preventScroll:!1});const n=[...ur()];if(n.includes(this.currentFocus)||!n.includes(this.previousFocus))break}setTimeout(()=>this.checkFocus())},this.handleKeyUp=()=>{this.tabDirection="forward"},this.element=e,this.elementsWithTabbableControls=["iframe"]}activate(){Vt.push(this.element),document.addEventListener("focusin",this.handleFocusIn),document.addEventListener("keydown",this.handleKeyDown),document.addEventListener("keyup",this.handleKeyUp)}deactivate(){Vt=Vt.filter(e=>e!==this.element),this.currentFocus=null,document.removeEventListener("focusin",this.handleFocusIn),document.removeEventListener("keydown",this.handleKeyDown),document.removeEventListener("keyup",this.handleKeyUp)}isActive(){return Vt[Vt.length-1]===this.element}activateExternal(){this.isExternalActivated=!0}deactivateExternal(){this.isExternalActivated=!1}checkFocus(){if(this.isActive()&&!this.isExternalActivated){const e=Wr(this.element);if(!this.element.matches(":focus-within")){const t=e[0],r=e[e.length-1],s=this.tabDirection==="forward"?t:r;typeof(s==null?void 0:s.focus)=="function"&&(this.currentFocus=s,s.focus({preventScroll:!1}))}}}possiblyHasTabbableChildren(e){return this.elementsWithTabbableControls.includes(e.tagName.toLowerCase())||e.hasAttribute("controls")}},$s=e=>{var t;const{activeElement:r}=document;r&&e.contains(r)&&((t=document.activeElement)==null||t.blur())},Ss=new Map,hi=new WeakMap;function pi(e){return e??{keyframes:[],options:{duration:0}}}function Xr(e,t){return t.toLowerCase()==="rtl"?{keyframes:e.rtlKeyframes||e.keyframes,options:e.options}:e}function N(e,t){Ss.set(e,pi(t))}function ht(e,t,r){const s=hi.get(e);if(s!=null&&s[t])return Xr(s[t],r.dir);const o=Ss.get(t);return o?Xr(o,r.dir):{keyframes:[],options:{duration:0}}}function me(e,t){return new Promise(r=>{function s(o){o.target===e&&(e.removeEventListener(t,s),r())}e.addEventListener(t,s)})}function pt(e,t,r){return new Promise(s=>{if((r==null?void 0:r.duration)===1/0)throw new Error("Promise-based animations must be finite.");const o=e.animate(t,cr(wt({},r),{duration:bi()?0:r.duration}));o.addEventListener("cancel",s,{once:!0}),o.addEventListener("finish",s,{once:!0})})}function bi(){return window.matchMedia("(prefers-reduced-motion: reduce)").matches}function Ct(e){return Promise.all(e.getAnimations().map(t=>new Promise(r=>{t.cancel(),requestAnimationFrame(r)})))}function Kr(e){return e.charAt(0).toUpperCase()+e.slice(1)}var H=class extends L{constructor(){super(...arguments),this.hasSlotController=new se(this,"footer"),this.localize=new xt(this),this.modal=new ui(this),this.open=!1,this.label="",this.placement="end",this.contained=!1,this.noHeader=!1,this.handleDocumentKeyDown=e=>{this.contained||e.key==="Escape"&&this.modal.isActive()&&this.open&&(e.stopImmediatePropagation(),this.requestClose("keyboard"))}}firstUpdated(){this.drawer.hidden=!this.open,this.open&&(this.addOpenListeners(),this.contained||(this.modal.activate(),qe(this)))}disconnectedCallback(){super.disconnectedCallback(),We(this),this.removeOpenListeners()}requestClose(e){if(this.emit("sl-request-close",{cancelable:!0,detail:{source:e}}).defaultPrevented){const r=ht(this,"drawer.denyClose",{dir:this.localize.dir()});pt(this.panel,r.keyframes,r.options);return}this.hide()}addOpenListeners(){var e;"CloseWatcher"in window?((e=this.closeWatcher)==null||e.destroy(),this.contained||(this.closeWatcher=new CloseWatcher,this.closeWatcher.onclose=()=>this.requestClose("keyboard"))):document.addEventListener("keydown",this.handleDocumentKeyDown)}removeOpenListeners(){var e;document.removeEventListener("keydown",this.handleDocumentKeyDown),(e=this.closeWatcher)==null||e.destroy()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.addOpenListeners(),this.originalTrigger=document.activeElement,this.contained||(this.modal.activate(),qe(this));const e=this.querySelector("[autofocus]");e&&e.removeAttribute("autofocus"),await Promise.all([Ct(this.drawer),Ct(this.overlay)]),this.drawer.hidden=!1,requestAnimationFrame(()=>{this.emit("sl-initial-focus",{cancelable:!0}).defaultPrevented||(e?e.focus({preventScroll:!0}):this.panel.focus({preventScroll:!0})),e&&e.setAttribute("autofocus","")});const t=ht(this,`drawer.show${Kr(this.placement)}`,{dir:this.localize.dir()}),r=ht(this,"drawer.overlay.show",{dir:this.localize.dir()});await Promise.all([pt(this.panel,t.keyframes,t.options),pt(this.overlay,r.keyframes,r.options)]),this.emit("sl-after-show")}else{$s(this),this.emit("sl-hide"),this.removeOpenListeners(),this.contained||(this.modal.deactivate(),We(this)),await Promise.all([Ct(this.drawer),Ct(this.overlay)]);const e=ht(this,`drawer.hide${Kr(this.placement)}`,{dir:this.localize.dir()}),t=ht(this,"drawer.overlay.hide",{dir:this.localize.dir()});await Promise.all([pt(this.overlay,t.keyframes,t.options).then(()=>{this.overlay.hidden=!0}),pt(this.panel,e.keyframes,e.options).then(()=>{this.panel.hidden=!0})]),this.drawer.hidden=!0,this.overlay.hidden=!1,this.panel.hidden=!1;const r=this.originalTrigger;typeof(r==null?void 0:r.focus)=="function"&&setTimeout(()=>r.focus()),this.emit("sl-after-hide")}}handleNoModalChange(){this.open&&!this.contained&&(this.modal.activate(),qe(this)),this.open&&this.contained&&(this.modal.deactivate(),We(this))}async show(){if(!this.open)return this.open=!0,me(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,me(this,"sl-after-hide")}render(){return p`
      <div
        part="base"
        class=${V({drawer:!0,"drawer--open":this.open,"drawer--top":this.placement==="top","drawer--end":this.placement==="end","drawer--bottom":this.placement==="bottom","drawer--start":this.placement==="start","drawer--contained":this.contained,"drawer--fixed":!this.contained,"drawer--rtl":this.localize.dir()==="rtl","drawer--has-footer":this.hasSlotController.test("footer")})}
      >
        <div part="overlay" class="drawer__overlay" @click=${()=>this.requestClose("overlay")} tabindex="-1"></div>

        <div
          part="panel"
          class="drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-hidden=${this.open?"false":"true"}
          aria-label=${w(this.noHeader?this.label:void 0)}
          aria-labelledby=${w(this.noHeader?void 0:"title")}
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
    `}};H.styles=[G,ii];H.dependencies={"sl-icon-button":I};d([B(".drawer")],H.prototype,"drawer",2);d([B(".drawer__panel")],H.prototype,"panel",2);d([B(".drawer__overlay")],H.prototype,"overlay",2);d([u({type:Boolean,reflect:!0})],H.prototype,"open",2);d([u({reflect:!0})],H.prototype,"label",2);d([u({reflect:!0})],H.prototype,"placement",2);d([u({type:Boolean,reflect:!0})],H.prototype,"contained",2);d([u({attribute:"no-header",type:Boolean,reflect:!0})],H.prototype,"noHeader",2);d([D("open",{waitUntilFirstUpdate:!0})],H.prototype,"handleOpenChange",1);d([D("contained",{waitUntilFirstUpdate:!0})],H.prototype,"handleNoModalChange",1);N("drawer.showTop",{keyframes:[{opacity:0,translate:"0 -100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});N("drawer.hideTop",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -100%"}],options:{duration:250,easing:"ease"}});N("drawer.showEnd",{keyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});N("drawer.hideEnd",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],options:{duration:250,easing:"ease"}});N("drawer.showBottom",{keyframes:[{opacity:0,translate:"0 100%"},{opacity:1,translate:"0 0"}],options:{duration:250,easing:"ease"}});N("drawer.hideBottom",{keyframes:[{opacity:1,translate:"0 0"},{opacity:0,translate:"0 100%"}],options:{duration:250,easing:"ease"}});N("drawer.showStart",{keyframes:[{opacity:0,translate:"-100%"},{opacity:1,translate:"0"}],rtlKeyframes:[{opacity:0,translate:"100%"},{opacity:1,translate:"0"}],options:{duration:250,easing:"ease"}});N("drawer.hideStart",{keyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"-100%"}],rtlKeyframes:[{opacity:1,translate:"0"},{opacity:0,translate:"100%"}],options:{duration:250,easing:"ease"}});N("drawer.denyClose",{keyframes:[{scale:1},{scale:1.01},{scale:1}],options:{duration:250}});N("drawer.overlay.show",{keyframes:[{opacity:0},{opacity:1}],options:{duration:250}});N("drawer.overlay.hide",{keyframes:[{opacity:1},{opacity:0}],options:{duration:250}});H.define("sl-drawer");var fi=$`
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
`,F=class dt extends L{constructor(){super(...arguments),this.hasSlotController=new se(this,"icon","suffix"),this.localize=new xt(this),this.open=!1,this.closable=!1,this.variant="primary",this.duration=1/0,this.remainingTime=this.duration}static get toastStack(){return this.currentToastStack||(this.currentToastStack=Object.assign(document.createElement("div"),{className:"sl-toast-stack"})),this.currentToastStack}firstUpdated(){this.base.hidden=!this.open}restartAutoHide(){this.handleCountdownChange(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),this.open&&this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.duration),this.remainingTime=this.duration,this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100))}pauseAutoHide(){var t;(t=this.countdownAnimation)==null||t.pause(),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval)}resumeAutoHide(){var t;this.duration<1/0&&(this.autoHideTimeout=window.setTimeout(()=>this.hide(),this.remainingTime),this.remainingTimeInterval=window.setInterval(()=>{this.remainingTime-=100},100),(t=this.countdownAnimation)==null||t.play())}handleCountdownChange(){if(this.open&&this.duration<1/0&&this.countdown){const{countdownElement:t}=this,r="100%",s="0";this.countdownAnimation=t.animate([{width:r},{width:s}],{duration:this.duration,easing:"linear"})}}handleCloseClick(){this.hide()}async handleOpenChange(){if(this.open){this.emit("sl-show"),this.duration<1/0&&this.restartAutoHide(),await Ct(this.base),this.base.hidden=!1;const{keyframes:t,options:r}=ht(this,"alert.show",{dir:this.localize.dir()});await pt(this.base,t,r),this.emit("sl-after-show")}else{$s(this),this.emit("sl-hide"),clearTimeout(this.autoHideTimeout),clearInterval(this.remainingTimeInterval),await Ct(this.base);const{keyframes:t,options:r}=ht(this,"alert.hide",{dir:this.localize.dir()});await pt(this.base,t,r),this.base.hidden=!0,this.emit("sl-after-hide")}}handleDurationChange(){this.restartAutoHide()}async show(){if(!this.open)return this.open=!0,me(this,"sl-after-show")}async hide(){if(this.open)return this.open=!1,me(this,"sl-after-hide")}async toast(){return new Promise(t=>{this.handleCountdownChange(),dt.toastStack.parentElement===null&&document.body.append(dt.toastStack),dt.toastStack.appendChild(this),requestAnimationFrame(()=>{this.clientWidth,this.show()}),this.addEventListener("sl-after-hide",()=>{dt.toastStack.removeChild(this),t(),dt.toastStack.querySelector("sl-alert")===null&&dt.toastStack.remove()},{once:!0})})}render(){return p`
      <div
        part="base"
        class=${V({alert:!0,"alert--open":this.open,"alert--closable":this.closable,"alert--has-countdown":!!this.countdown,"alert--has-icon":this.hasSlotController.test("icon"),"alert--primary":this.variant==="primary","alert--success":this.variant==="success","alert--neutral":this.variant==="neutral","alert--warning":this.variant==="warning","alert--danger":this.variant==="danger"})}
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
                class=${V({alert__countdown:!0,"alert__countdown--ltr":this.countdown==="ltr"})}
              >
                <div class="alert__countdown-elapsed"></div>
              </div>
            `:""}
      </div>
    `}};F.styles=[G,fi];F.dependencies={"sl-icon-button":I};d([B('[part~="base"]')],F.prototype,"base",2);d([B(".alert__countdown-elapsed")],F.prototype,"countdownElement",2);d([u({type:Boolean,reflect:!0})],F.prototype,"open",2);d([u({type:Boolean,reflect:!0})],F.prototype,"closable",2);d([u({reflect:!0})],F.prototype,"variant",2);d([u({type:Number})],F.prototype,"duration",2);d([u({type:String,reflect:!0})],F.prototype,"countdown",2);d([k()],F.prototype,"remainingTime",2);d([D("open",{waitUntilFirstUpdate:!0})],F.prototype,"handleOpenChange",1);d([D("duration")],F.prototype,"handleDurationChange",1);var gi=F;N("alert.show",{keyframes:[{opacity:0,scale:.8},{opacity:1,scale:1}],options:{duration:250,easing:"ease"}});N("alert.hide",{keyframes:[{opacity:1,scale:1},{opacity:0,scale:.8}],options:{duration:250,easing:"ease"}});gi.define("sl-alert");function mi(e,t){const r=new Set([...Object.keys(e),...Object.keys(t)]);for(const s of r)if((e[s]??"")!==(t[s]??""))return!0;return!1}const vi={view:"search",search:{state:"initial",currentSession:null,query:"",results:[],total:0,source:"fts"},chat:{state:"initial",currentSession:null,messages:[],streaming:!1},detailStack:[],pendingSession:null,status:null,error:null,settings:{scope:"local",values:{},original:{},dirty:!1,exists:!0,saving:!1,error:null}};class yi{constructor(){this.state=vi,this.listeners=new Set}getState(){return this.state}setState(t){this.state={...this.state,...t},this.listeners.forEach(r=>r(this.state))}subscribe(t){return this.listeners.add(t),()=>this.listeners.delete(t)}subscribeSelector(t,r){let s=t(this.state);return this.subscribe(o=>{const i=t(o);i!==s&&(s=i,r(i))})}}const m=new yi,E={setView(e){m.setState({view:e})},setSearchState(e){const t=m.getState().search;m.setState({search:{...t,...e}})},setChatState(e){const t=m.getState().chat;m.setState({chat:{...t,...e}})},pushDetail(e){const t=m.getState().detailStack;m.setState({detailStack:[...t,e]})},popDetail(){const e=m.getState().detailStack;e.length!==0&&m.setState({detailStack:e.slice(0,-1)})},setError(e){m.setState({error:e})},setPendingSession(e){m.setState({pendingSession:e})},setSettingsScope(e){const t=m.getState().settings;m.setState({settings:{...t,scope:e}})},loadSettings(e,t){const r=m.getState().settings;m.setState({settings:{...r,values:{...e},original:{...e},exists:t,dirty:!1,error:null}})},updateSetting(e,t){const r=m.getState().settings,s={...r.values,[e]:t},o=mi(r.original,s);m.setState({settings:{...r,values:s,dirty:o}})},revertSettings(){const e=m.getState().settings,t={...e.original};m.setState({settings:{...e,values:t,dirty:!1}})},setSettingsSaving(e){const t=m.getState().settings;m.setState({settings:{...t,saving:e}})},setSettingsError(e){const t=m.getState().settings;m.setState({settings:{...t,error:e}})}};var xi=Object.defineProperty,wi=Object.getOwnPropertyDescriptor,Cs=(e,t,r,s)=>{for(var o=s>1?void 0:s?wi(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&xi(t,r,o),o};let ve=class extends T{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"history",icon:"🕘",label:"历史"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return p`
      ${this._items.map(e=>p`
        <button
          class=${this.active===e.id?"active":""}
          title=${e.label}
          @click=${()=>this._select(e.id)}>
          ${e.icon}
        </button>`)}
    `}};ve.styles=$`
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
  `;Cs([u()],ve.prototype,"active",2);ve=Cs([P("activity-bar")],ve);var _i=Object.defineProperty,ki=Object.getOwnPropertyDescriptor,As=(e,t,r,s)=>{for(var o=s>1?void 0:s?ki(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&_i(t,r,o),o};let ye=class extends T{constructor(){super(...arguments),this.active="search",this._items=[{id:"search",icon:"🔍",label:"搜索"},{id:"chat",icon:"💬",label:"对话"},{id:"history",icon:"🕘",label:"历史"}]}_select(e){this.dispatchEvent(new CustomEvent("navigate",{detail:{view:e},bubbles:!0,composed:!0}))}render(){return p`
      ${this._items.map(e=>p`
        <button
          class="tab ${this.active===e.id?"active":""}"
          @click=${()=>this._select(e.id)}>
          <span class="icon">${e.icon}</span>
          <span>${e.label}</span>
        </button>`)}
    `}};ye.styles=$`
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
  `;As([u()],ye.prototype,"active",2);ye=As([P("tab-bar")],ye);var $i=Object.defineProperty,Si=Object.getOwnPropertyDescriptor,hr=(e,t,r,s)=>{for(var o=s>1?void 0:s?Si(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&$i(t,r,o),o};let Yt=class extends T{constructor(){super(...arguments),this.heading="Cortex",this.subheading=""}render(){return p`
      <h1 class="title">${this.heading}</h1>
      ${this.subheading?p`<p class="subtitle">${this.subheading}</p>`:null}
    `}};Yt.styles=$`
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
  `;hr([u()],Yt.prototype,"heading",2);hr([u()],Yt.prototype,"subheading",2);Yt=hr([P("welcome-pane")],Yt);var Ci=Object.defineProperty,Ai=Object.getOwnPropertyDescriptor,Ae=(e,t,r,s)=>{for(var o=s>1?void 0:s?Ai(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ci(t,r,o),o};let Tt=class extends T{constructor(){super(...arguments),this.backLabel="返回",this.title="",this.meta=""}_back(){this.dispatchEvent(new CustomEvent("back",{bubbles:!0,composed:!0}))}render(){return p`
      <button class="back" @click=${this._back}>← ${this.backLabel}</button>
      <div class="title">${this.title}</div>
      ${this.meta?p`<div class="meta">${this.meta}</div>`:null}
    `}};Tt.styles=$`
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
      font-size: var(--cortex-fs-base);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .back:hover { background: var(--cortex-primary-soft); }
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
  `;Ae([u()],Tt.prototype,"backLabel",2);Ae([u()],Tt.prototype,"title",2);Ae([u()],Tt.prototype,"meta",2);Tt=Ae([P("focus-header")],Tt);var Ei=Object.defineProperty,Ti=Object.getOwnPropertyDescriptor,oe=(e,t,r,s)=>{for(var o=s>1?void 0:s?Ti(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ei(t,r,o),o};let vt=class extends T{constructor(){super(...arguments),this.title="历史会话",this.sessions=[],this.clearing=!1}_onSelect(e){this.dispatchEvent(new CustomEvent("select",{detail:e.detail,bubbles:!0,composed:!0}))}_onClear(){this.clearing||this.dispatchEvent(new CustomEvent("clear",{bubbles:!0,composed:!0}))}render(){const e=this.sessions.length>0;return p`
      <div class="header">
        <div class="title">${this.title}</div>
        ${e?p`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing?"清空中...":"清空"}
          </button>`:null}
      </div>
      ${this.sessions.length===0?p`<div class="empty">暂无历史会话</div>`:this.sessions.map(t=>p`<history-item .session=${t} @select=${this._onSelect}></history-item>`)}
    `}};vt.styles=$`
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
  `;oe([u()],vt.prototype,"title",2);oe([u({attribute:!1})],vt.prototype,"sessions",2);oe([u()],vt.prototype,"type",2);oe([u({type:Boolean})],vt.prototype,"clearing",2);vt=oe([P("history-list")],vt);var zi=Object.defineProperty,Pi=Object.getOwnPropertyDescriptor,Es=(e,t,r,s)=>{for(var o=s>1?void 0:s?Pi(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&zi(t,r,o),o};let xe=class extends T{constructor(){super(...arguments),this.session=null}_select(){this.session&&this.dispatchEvent(new CustomEvent("select",{detail:{session:this.session},bubbles:!0,composed:!0}))}render(){return this.session?p`
      <div class="name">${this.session.title}</div>
      <div class="meta">${this.session.message_count} · ${new Date(this.session.updated_at).toLocaleDateString()}</div>
    `:null}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}};xe.styles=$`
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
  `;Es([u({attribute:!1})],xe.prototype,"session",2);xe=Es([P("history-item")],xe);var Oi=Object.defineProperty,Ri=Object.getOwnPropertyDescriptor,it=(e,t,r,s)=>{for(var o=s>1?void 0:s?Ri(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Oi(t,r,o),o};let Y=class extends T{constructor(){super(...arguments),this.value="",this.placeholder="",this.buttonLabel="搜索",this.buttonIcon="",this.multiline=!1,this.disabled=!1}focus(){var e;(e=this.inputEl)==null||e.focus()}get trimmed(){return this.value.trim()}_onInput(e){const t=e.target;this.value=t.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value}}));const r=this.renderRoot.querySelector("button");r&&(r.disabled=!this.trimmed||this.disabled)}_onKeydown(e){e.key==="Enter"&&(e.ctrlKey||e.metaKey)&&(e.preventDefault(),this._submit()),e.key==="Enter"&&!this.multiline&&!e.shiftKey&&(e.preventDefault(),this._submit())}_submit(){!this.trimmed||this.disabled||this.dispatchEvent(new CustomEvent("submit",{detail:{value:this.trimmed}}))}render(){const e=this.multiline?p`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`:p`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;return p`
      <div class="wrapper">
        ${e}
        <button @click=${this._submit} ?disabled=${!this.trimmed||this.disabled}>
          ${this.buttonIcon?p`<span aria-hidden="true">${this.buttonIcon}</span>`:null}
          <span>${this.buttonLabel}</span>
        </button>
      </div>
    `}};Y.styles=$`
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
  `;it([u()],Y.prototype,"value",2);it([u()],Y.prototype,"placeholder",2);it([u()],Y.prototype,"buttonLabel",2);it([u()],Y.prototype,"buttonIcon",2);it([u({type:Boolean})],Y.prototype,"multiline",2);it([u({type:Boolean})],Y.prototype,"disabled",2);it([B("input, textarea")],Y.prototype,"inputEl",2);Y=it([P("input-box")],Y);var Ii=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,pr=(e,t,r,s)=>{for(var o=s>1?void 0:s?Li(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ii(t,r,o),o};let Jt=class extends T{constructor(){super(...arguments),this.result=null,this.active=!1}_select(){this.result&&this.dispatchEvent(new CustomEvent("select",{detail:{result:this.result},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),this.addEventListener("click",this._select)}disconnectedCallback(){this.removeEventListener("click",this._select),super.disconnectedCallback()}render(){if(!this.result)return null;const e=Math.round(this.result.score*100);return p`
      <div class="path">${this.result.path}${this.result.line?`:${this.result.line}`:""}</div>
      <div class="snippet">${this.result.snippet}</div>
      <div class="score">评分: ${e}%</div>
    `}};Jt.styles=$`
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
  `;pr([u({attribute:!1})],Jt.prototype,"result",2);pr([u({type:Boolean,reflect:!0})],Jt.prototype,"active",2);Jt=pr([P("result-card")],Jt);var Di=Object.defineProperty,Bi=Object.getOwnPropertyDescriptor,Ee=(e,t,r,s)=>{for(var o=s>1?void 0:s?Bi(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Di(t,r,o),o};let zt=class extends T{constructor(){super(...arguments),this.results=[],this.activePath=null,this.activeLine=null}_onSelect(e){this.dispatchEvent(new CustomEvent("select",{detail:e.detail,bubbles:!0,composed:!0}))}render(){return p`
      <div class="list-pane">
        ${this.results.length===0?p`<div class="empty">无搜索结果</div>`:this.results.map(e=>p`
              <result-card
                .result=${e}
                ?active=${this.activePath===e.path&&this.activeLine===e.line}
                @select=${this._onSelect}>
              </result-card>`)}
      </div>
    `}};zt.styles=$`
    :host {
      display: flex;
      gap: var(--cortex-space-4);
      flex: 0 0 auto;
      min-height: 0;
    }
    .list-pane {
      flex: 0 0 360px;
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
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-8);
    }
    /* 桌面：双栏，列表 + 预览；移动：单栏，点击触发 push */
    @media (max-width: 1023px) {
      :host { flex-direction: column; flex: 1; }
      .list-pane {
        flex: 1; max-width: none; min-width: 0;
        border-right: none; border-bottom: 1px solid var(--cortex-border);
      }
    }
  `;Ee([u({attribute:!1})],zt.prototype,"results",2);Ee([u({attribute:!1})],zt.prototype,"activePath",2);Ee([u({attribute:!1})],zt.prototype,"activeLine",2);zt=Ee([P("search-results")],zt);function br(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var _t=br();function Ts(e){_t=e}var bt={exec:()=>null};function kt(e){let t=[];return r=>{let s=Math.max(0,Math.min(3,r-1)),o=t[s];return o||(o=e(s),t[s]=o),o}}function _(e,t=""){let r=typeof e=="string"?e:e.source,s={replace:(o,i)=>{let a=typeof i=="string"?i:i.source;return a=a.replace(R.caret,"$1"),r=r.replace(o,a),s},getRegex:()=>new RegExp(r,t)};return s}var Ni=((e="")=>{try{return!!new RegExp("(?<=1)(?<!1)"+e)}catch{return!1}})(),R={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] +\S/,listReplaceTask:/^\[[ xX]\] +/,listTaskCheckbox:/\[[ xX]\]/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:e=>new RegExp(`^( {0,3}${e})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:kt(e=>new RegExp(`^ {0,${e}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),hrRegex:kt(e=>new RegExp(`^ {0,${e}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)),fencesBeginRegex:kt(e=>new RegExp(`^ {0,${e}}(?:\`\`\`|~~~)`)),headingBeginRegex:kt(e=>new RegExp(`^ {0,${e}}#`)),htmlBeginRegex:kt(e=>new RegExp(`^ {0,${e}}<(?:[a-z].*>|!--)`,"i")),blockquoteBeginRegex:kt(e=>new RegExp(`^ {0,${e}}>`))},Hi=/^(?:[ \t]*(?:\n|$))+/,Fi=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,Mi=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,ie=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Vi=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,fr=/ {0,3}(?:[*+-]|\d{1,9}[.)])/,zs=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,Ps=_(zs).replace(/bull/g,fr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),ji=_(zs).replace(/bull/g,fr).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),gr=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,Ui=/^[^\n]+/,mr=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,qi=_(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",mr).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Wi=_(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g,fr).getRegex(),Te="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",vr=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,Xi=_("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",vr).replace("tag",Te).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),Os=_(gr).replace("hr",ie).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Te).getRegex(),Ki=_(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",Os).getRegex(),yr={blockquote:Ki,code:Fi,def:qi,fences:Mi,heading:Vi,hr:ie,html:Xi,lheading:Ps,list:Wi,newline:Hi,paragraph:Os,table:bt,text:Ui},Gr=_("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",ie).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Te).getRegex(),Gi={...yr,lheading:ji,table:Gr,paragraph:_(gr).replace("hr",ie).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",Gr).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Te).getRegex()},Zi={...yr,html:_(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",vr).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:bt,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:_(gr).replace("hr",ie).replace("heading",` *#{1,6} *[^
]`).replace("lheading",Ps).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Qi=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Yi=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Rs=/^( {2,}|\\)\n(?!\s*$)/,Ji=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Lt=/[\p{P}\p{S}]/u,ze=/[\s\p{P}\p{S}]/u,xr=/[^\s\p{P}\p{S}]/u,ta=_(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,ze).getRegex(),Is=/(?!~)[\p{P}\p{S}]/u,ea=/(?!~)[\s\p{P}\p{S}]/u,ra=/(?:[^\s\p{P}\p{S}]|~)/u,sa=_(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",Ni?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),Ls=/^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/,oa=_(Ls,"u").replace(/punct/g,Lt).getRegex(),ia=_(Ls,"u").replace(/punct/g,Is).getRegex(),Ds="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",aa=_(Ds,"gu").replace(/notPunctSpace/g,xr).replace(/punctSpace/g,ze).replace(/punct/g,Lt).getRegex(),na=_(Ds,"gu").replace(/notPunctSpace/g,ra).replace(/punctSpace/g,ea).replace(/punct/g,Is).getRegex(),la=_("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,xr).replace(/punctSpace/g,ze).replace(/punct/g,Lt).getRegex(),ca=_(/^~~?(?:((?!~)punct)|[^\s~])/,"u").replace(/punct/g,Lt).getRegex(),da="^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)",ua=_(da,"gu").replace(/notPunctSpace/g,xr).replace(/punctSpace/g,ze).replace(/punct/g,Lt).getRegex(),ha=_(/\\(punct)/,"gu").replace(/punct/g,Lt).getRegex(),pa=_(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),ba=_(vr).replace("(?:-->|$)","-->").getRegex(),fa=_("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",ba).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),we=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/,ga=_(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label",we).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),Bs=_(/^!?\[(label)\]\[(ref)\]/).replace("label",we).replace("ref",mr).getRegex(),Ns=_(/^!?\[(ref)\](?:\[\])?/).replace("ref",mr).getRegex(),ma=_("reflink|nolink(?!\\()","g").replace("reflink",Bs).replace("nolink",Ns).getRegex(),Zr=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,wr={_backpedal:bt,anyPunctuation:ha,autolink:pa,blockSkip:sa,br:Rs,code:Yi,del:bt,delLDelim:bt,delRDelim:bt,emStrongLDelim:oa,emStrongRDelimAst:aa,emStrongRDelimUnd:la,escape:Qi,link:ga,nolink:Ns,punctuation:ta,reflink:Bs,reflinkSearch:ma,tag:fa,text:Ji,url:bt},va={...wr,link:_(/^!?\[(label)\]\((.*?)\)/).replace("label",we).getRegex(),reflink:_(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",we).getRegex()},Qe={...wr,emStrongRDelimAst:na,emStrongLDelim:ia,delLDelim:ca,delRDelim:ua,url:_(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",Zr).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:_(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",Zr).getRegex()},ya={...Qe,br:_(Rs).replace("{2,}","*").getRegex(),text:_(Qe.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},de={normal:yr,gfm:Gi,pedantic:Zi},jt={normal:wr,gfm:Qe,breaks:ya,pedantic:va},xa={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},Qr=e=>xa[e];function Q(e,t){if(t){if(R.escapeTest.test(e))return e.replace(R.escapeReplace,Qr)}else if(R.escapeTestNoEncode.test(e))return e.replace(R.escapeReplaceNoEncode,Qr);return e}function Yr(e){try{e=encodeURI(e).replace(R.percentDecode,"%")}catch{return null}return e}function Jr(e,t){var i;let r=e.replace(R.findPipe,(a,l,n)=>{let h=!1,c=l;for(;--c>=0&&n[c]==="\\";)h=!h;return h?"|":" |"}),s=r.split(R.splitPipe),o=0;if(s[0].trim()||s.shift(),s.length>0&&!((i=s.at(-1))!=null&&i.trim())&&s.pop(),t)if(s.length>t)s.splice(t);else for(;s.length<t;)s.push("");for(;o<s.length;o++)s[o]=s[o].trim().replace(R.slashPipe,"|");return s}function rt(e,t,r){let s=e.length;if(s===0)return"";let o=0;for(;o<s&&e.charAt(s-o-1)===t;)o++;return e.slice(0,s-o)}function ts(e){let t=e.split(`
`),r=t.length-1;for(;r>=0&&R.blankLine.test(t[r]);)r--;return t.length-r<=2?e:t.slice(0,r+1).join(`
`)}function wa(e,t){if(e.indexOf(t[1])===-1)return-1;let r=0;for(let s=0;s<e.length;s++)if(e[s]==="\\")s++;else if(e[s]===t[0])r++;else if(e[s]===t[1]&&(r--,r<0))return s;return r>0?-2:-1}function _a(e,t=0){let r=t,s="";for(let o of e)if(o==="	"){let i=4-r%4;s+=" ".repeat(i),r+=i}else s+=o,r++;return s}function es(e,t,r,s,o){let i=t.href,a=t.title||null,l=e[1].replace(o.other.outputLinkReplace,"$1");s.state.inLink=!0;let n={type:e[0].charAt(0)==="!"?"image":"link",raw:r,href:i,title:a,text:l,tokens:s.inlineTokens(l)};return s.state.inLink=!1,n}function ka(e,t,r){let s=e.match(r.other.indentCodeCompensation);if(s===null)return t;let o=s[1];return t.split(`
`).map(i=>{let a=i.match(r.other.beginningSpace);if(a===null)return i;let[l]=a;return l.length>=o.length?i.slice(o.length):i}).join(`
`)}var _e=class{constructor(e){A(this,"options");A(this,"rules");A(this,"lexer");this.options=e||_t}space(e){let t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){let t=this.rules.block.code.exec(e);if(t){let r=this.options.pedantic?t[0]:ts(t[0]),s=r.replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:r,codeBlockStyle:"indented",text:s}}}fences(e){let t=this.rules.block.fences.exec(e);if(t){let r=t[0],s=ka(r,t[3]||"",this.rules);return{type:"code",raw:r,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:s}}}heading(e){let t=this.rules.block.heading.exec(e);if(t){let r=t[2].trim();if(this.rules.other.endingHash.test(r)){let s=rt(r,"#");(this.options.pedantic||!s||this.rules.other.endingSpaceChar.test(s))&&(r=s.trim())}return{type:"heading",raw:rt(t[0],`
`),depth:t[1].length,text:r,tokens:this.lexer.inline(r)}}}hr(e){let t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:rt(t[0],`
`)}}blockquote(e){let t=this.rules.block.blockquote.exec(e);if(t){let r=rt(t[0],`
`).split(`
`),s="",o="",i=[];for(;r.length>0;){let a=!1,l=[],n;for(n=0;n<r.length;n++)if(this.rules.other.blockquoteStart.test(r[n]))l.push(r[n]),a=!0;else if(!a)l.push(r[n]);else break;r=r.slice(n);let h=l.join(`
`),c=h.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");s=s?`${s}
${h}`:h,o=o?`${o}
${c}`:c;let b=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(c,i,!0),this.lexer.state.top=b,r.length===0)break;let g=i.at(-1);if((g==null?void 0:g.type)==="code")break;if((g==null?void 0:g.type)==="blockquote"){let x=g,f=x.raw+`
`+r.join(`
`),M=this.blockquote(f);i[i.length-1]=M,s=s.substring(0,s.length-x.raw.length)+M.raw,o=o.substring(0,o.length-x.text.length)+M.text;break}else if((g==null?void 0:g.type)==="list"){let x=g,f=x.raw+`
`+r.join(`
`),M=this.list(f);i[i.length-1]=M,s=s.substring(0,s.length-g.raw.length)+M.raw,o=o.substring(0,o.length-x.raw.length)+M.raw,r=f.substring(i.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:s,tokens:i,text:o}}}list(e){let t=this.rules.block.list.exec(e);if(t){let r=t[1].trim(),s=r.length>1,o={type:"list",raw:"",ordered:s,start:s?+r.slice(0,-1):"",loose:!1,items:[]};r=s?`\\d{1,9}\\${r.slice(-1)}`:`\\${r}`,this.options.pedantic&&(r=s?r:"[*+-]");let i=this.rules.other.listItemRegex(r),a=!1;for(;e;){let n=!1,h="",c="";if(!(t=i.exec(e))||this.rules.block.hr.test(e))break;h=t[0],e=e.substring(h.length);let b=_a(t[2].split(`
`,1)[0],t[1].length),g=e.split(`
`,1)[0],x=!b.trim(),f=0;if(this.options.pedantic?(f=2,c=b.trimStart()):x?f=t[1].length+1:(f=b.search(this.rules.other.nonSpaceChar),f=f>4?1:f,c=b.slice(f),f+=t[1].length),x&&this.rules.other.blankLine.test(g)&&(h+=g+`
`,e=e.substring(g.length+1),n=!0),!n){let M=this.rules.other.nextBulletRegex(f),z=this.rules.other.hrRegex(f),ne=this.rules.other.fencesBeginRegex(f),nt=this.rules.other.headingBeginRegex(f),Le=this.rules.other.htmlBeginRegex(f),js=this.rules.other.blockquoteBeginRegex(f);for(;e;){let De=e.split(`
`,1)[0],Dt;if(g=De,this.options.pedantic?(g=g.replace(this.rules.other.listReplaceNesting,"  "),Dt=g):Dt=g.replace(this.rules.other.tabCharGlobal,"    "),ne.test(g)||nt.test(g)||Le.test(g)||js.test(g)||M.test(g)||z.test(g))break;if(Dt.search(this.rules.other.nonSpaceChar)>=f||!g.trim())c+=`
`+Dt.slice(f);else{if(x||b.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||ne.test(b)||nt.test(b)||z.test(b))break;c+=`
`+g}x=!g.trim(),h+=De+`
`,e=e.substring(De.length+1),b=Dt.slice(f)}}o.loose||(a?o.loose=!0:this.rules.other.doubleBlankLine.test(h)&&(a=!0)),o.items.push({type:"list_item",raw:h,task:!!this.options.gfm&&this.rules.other.listIsTask.test(c),loose:!1,text:c,tokens:[]}),o.raw+=h}let l=o.items.at(-1);if(l)l.raw=l.raw.trimEnd(),l.text=l.text.trimEnd();else return;o.raw=o.raw.trimEnd();for(let n of o.items){this.lexer.state.top=!1,n.tokens=this.lexer.blockTokens(n.text,[]);let h=n.tokens[0];if(n.task&&((h==null?void 0:h.type)==="text"||(h==null?void 0:h.type)==="paragraph")){n.text=n.text.replace(this.rules.other.listReplaceTask,""),h.raw=h.raw.replace(this.rules.other.listReplaceTask,""),h.text=h.text.replace(this.rules.other.listReplaceTask,"");for(let b=this.lexer.inlineQueue.length-1;b>=0;b--)if(this.rules.other.listIsTask.test(this.lexer.inlineQueue[b].src)){this.lexer.inlineQueue[b].src=this.lexer.inlineQueue[b].src.replace(this.rules.other.listReplaceTask,"");break}let c=this.rules.other.listTaskCheckbox.exec(n.raw);if(c){let b={type:"checkbox",raw:c[0]+" ",checked:c[0]!=="[ ]"};n.checked=b.checked,o.loose?n.tokens[0]&&["paragraph","text"].includes(n.tokens[0].type)&&"tokens"in n.tokens[0]&&n.tokens[0].tokens?(n.tokens[0].raw=b.raw+n.tokens[0].raw,n.tokens[0].text=b.raw+n.tokens[0].text,n.tokens[0].tokens.unshift(b)):n.tokens.unshift({type:"paragraph",raw:b.raw,text:b.raw,tokens:[b]}):n.tokens.unshift(b)}}else n.task&&(n.task=!1);if(!o.loose){let c=n.tokens.filter(g=>g.type==="space"),b=c.length>0&&c.some(g=>this.rules.other.anyLine.test(g.raw));o.loose=b}}if(o.loose)for(let n of o.items){n.loose=!0;for(let h of n.tokens)h.type==="text"&&(h.type="paragraph")}return o}}html(e){let t=this.rules.block.html.exec(e);if(t){let r=ts(t[0]);return{type:"html",block:!0,raw:r,pre:t[1]==="pre"||t[1]==="script"||t[1]==="style",text:r}}}def(e){let t=this.rules.block.def.exec(e);if(t){let r=t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),s=t[2]?t[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",o=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:r,raw:rt(t[0],`
`),href:s,title:o}}}table(e){var a;let t=this.rules.block.table.exec(e);if(!t||!this.rules.other.tableDelimiter.test(t[2]))return;let r=Jr(t[1]),s=t[2].replace(this.rules.other.tableAlignChars,"").split("|"),o=(a=t[3])!=null&&a.trim()?t[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],i={type:"table",raw:rt(t[0],`
`),header:[],align:[],rows:[]};if(r.length===s.length){for(let l of s)this.rules.other.tableAlignRight.test(l)?i.align.push("right"):this.rules.other.tableAlignCenter.test(l)?i.align.push("center"):this.rules.other.tableAlignLeft.test(l)?i.align.push("left"):i.align.push(null);for(let l=0;l<r.length;l++)i.header.push({text:r[l],tokens:this.lexer.inline(r[l]),header:!0,align:i.align[l]});for(let l of o)i.rows.push(Jr(l,i.header.length).map((n,h)=>({text:n,tokens:this.lexer.inline(n),header:!1,align:i.align[h]})));return i}}lheading(e){let t=this.rules.block.lheading.exec(e);if(t){let r=t[1].trim();return{type:"heading",raw:rt(t[0],`
`),depth:t[2].charAt(0)==="="?1:2,text:r,tokens:this.lexer.inline(r)}}}paragraph(e){let t=this.rules.block.paragraph.exec(e);if(t){let r=t[1].charAt(t[1].length-1)===`
`?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:r,tokens:this.lexer.inline(r)}}}text(e){let t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){let t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:t[1]}}tag(e){let t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&this.rules.other.startATag.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){let t=this.rules.inline.link.exec(e);if(t){let r=t[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(r)){if(!this.rules.other.endAngleBracket.test(r))return;let i=rt(r.slice(0,-1),"\\");if((r.length-i.length)%2===0)return}else{let i=wa(t[2],"()");if(i===-2)return;if(i>-1){let a=(t[0].indexOf("!")===0?5:4)+t[1].length+i;t[2]=t[2].substring(0,i),t[0]=t[0].substring(0,a).trim(),t[3]=""}}let s=t[2],o="";if(this.options.pedantic){let i=this.rules.other.pedanticHrefTitle.exec(s);i&&(s=i[1],o=i[3])}else o=t[3]?t[3].slice(1,-1):"";return s=s.trim(),this.rules.other.startAngleBracket.test(s)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(r)?s=s.slice(1):s=s.slice(1,-1)),es(t,{href:s&&s.replace(this.rules.inline.anyPunctuation,"$1"),title:o&&o.replace(this.rules.inline.anyPunctuation,"$1")},t[0],this.lexer,this.rules)}}reflink(e,t){let r;if((r=this.rules.inline.reflink.exec(e))||(r=this.rules.inline.nolink.exec(e))){let s=(r[2]||r[1]).replace(this.rules.other.multipleSpaceGlobal," "),o=t[s.toLowerCase()];if(!o){let i=r[0].charAt(0);return{type:"text",raw:i,text:i}}return es(r,o,r[0],this.lexer,this.rules)}}emStrong(e,t,r=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!(!s||!s[1]&&!s[2]&&!s[3]&&!s[4]||s[4]&&r.match(this.rules.other.unicodeAlphaNumeric))&&(!(s[1]||s[3])||!r||this.rules.inline.punctuation.exec(r))){let o=[...s[0]].length-1,i,a,l=o,n=0,h=s[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(h.lastIndex=0,t=t.slice(-1*e.length+o);(s=h.exec(t))!==null;){if(i=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!i)continue;if(a=[...i].length,s[3]||s[4]){l+=a;continue}else if((s[5]||s[6])&&o%3&&!((o+a)%3)){n+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l+n);let c=[...s[0]][0].length,b=e.slice(0,o+s.index+c+a);if(Math.min(o,a)%2){let x=b.slice(1,-1);return{type:"em",raw:b,text:x,tokens:this.lexer.inlineTokens(x)}}let g=b.slice(2,-2);return{type:"strong",raw:b,text:g,tokens:this.lexer.inlineTokens(g)}}}}codespan(e){let t=this.rules.inline.code.exec(e);if(t){let r=t[2].replace(this.rules.other.newLineCharGlobal," "),s=this.rules.other.nonSpaceChar.test(r),o=this.rules.other.startingSpaceChar.test(r)&&this.rules.other.endingSpaceChar.test(r);return s&&o&&(r=r.substring(1,r.length-1)),{type:"codespan",raw:t[0],text:r}}}br(e){let t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e,t,r=""){let s=this.rules.inline.delLDelim.exec(e);if(s&&(!s[1]||!r||this.rules.inline.punctuation.exec(r))){let o=[...s[0]].length-1,i,a,l=o,n=this.rules.inline.delRDelim;for(n.lastIndex=0,t=t.slice(-1*e.length+o);(s=n.exec(t))!==null;){if(i=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!i||(a=[...i].length,a!==o))continue;if(s[3]||s[4]){l+=a;continue}if(l-=a,l>0)continue;a=Math.min(a,a+l);let h=[...s[0]][0].length,c=e.slice(0,o+s.index+h+a),b=c.slice(o,-o);return{type:"del",raw:c,text:b,tokens:this.lexer.inlineTokens(b)}}}}autolink(e){let t=this.rules.inline.autolink.exec(e);if(t){let r,s;return t[2]==="@"?(r=t[1],s="mailto:"+r):(r=t[1],s=r),{type:"link",raw:t[0],text:r,href:s,tokens:[{type:"text",raw:r,text:r}]}}}url(e){var r;let t;if(t=this.rules.inline.url.exec(e)){let s,o;if(t[2]==="@")s=t[0],o="mailto:"+s;else{let i;do i=t[0],t[0]=((r=this.rules.inline._backpedal.exec(t[0]))==null?void 0:r[0])??"";while(i!==t[0]);s=t[0],t[1]==="www."?o="http://"+t[0]:o=t[0]}return{type:"link",raw:t[0],text:s,href:o,tokens:[{type:"text",raw:s,text:s}]}}}inlineText(e){let t=this.rules.inline.text.exec(e);if(t){let r=this.lexer.state.inRawBlock;return{type:"text",raw:t[0],text:t[0],escaped:r}}}},q=class Ye{constructor(t){A(this,"tokens");A(this,"options");A(this,"state");A(this,"inlineQueue");A(this,"tokenizer");this.tokens=[],this.tokens.links=Object.create(null),this.options=t||_t,this.options.tokenizer=this.options.tokenizer||new _e,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let r={other:R,block:de.normal,inline:jt.normal};this.options.pedantic?(r.block=de.pedantic,r.inline=jt.pedantic):this.options.gfm&&(r.block=de.gfm,this.options.breaks?r.inline=jt.breaks:r.inline=jt.gfm),this.tokenizer.rules=r}static get rules(){return{block:de,inline:jt}}static lex(t,r){return new Ye(r).lex(t)}static lexInline(t,r){return new Ye(r).inlineTokens(t)}lex(t){t=t.replace(R.carriageReturn,`
`),this.blockTokens(t,this.tokens);for(let r=0;r<this.inlineQueue.length;r++){let s=this.inlineQueue[r];this.inlineTokens(s.src,s.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(t,r=[],s=!1){var i,a,l;this.tokenizer.lexer=this,this.options.pedantic&&(t=t.replace(R.tabCharGlobal,"    ").replace(R.spaceLine,""));let o=1/0;for(;t;){if(t.length<o)o=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}let n;if((a=(i=this.options.extensions)==null?void 0:i.block)!=null&&a.some(c=>(n=c.call({lexer:this},t,r))?(t=t.substring(n.raw.length),r.push(n),!0):!1))continue;if(n=this.tokenizer.space(t)){t=t.substring(n.raw.length);let c=r.at(-1);n.raw.length===1&&c!==void 0?c.raw+=`
`:r.push(n);continue}if(n=this.tokenizer.code(t)){t=t.substring(n.raw.length);let c=r.at(-1);(c==null?void 0:c.type)==="paragraph"||(c==null?void 0:c.type)==="text"?(c.raw+=(c.raw.endsWith(`
`)?"":`
`)+n.raw,c.text+=`
`+n.text,this.inlineQueue.at(-1).src=c.text):r.push(n);continue}if(n=this.tokenizer.fences(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.heading(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.hr(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.blockquote(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.list(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.html(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.def(t)){t=t.substring(n.raw.length);let c=r.at(-1);(c==null?void 0:c.type)==="paragraph"||(c==null?void 0:c.type)==="text"?(c.raw+=(c.raw.endsWith(`
`)?"":`
`)+n.raw,c.text+=`
`+n.raw,this.inlineQueue.at(-1).src=c.text):this.tokens.links[n.tag]||(this.tokens.links[n.tag]={href:n.href,title:n.title},r.push(n));continue}if(n=this.tokenizer.table(t)){t=t.substring(n.raw.length),r.push(n);continue}if(n=this.tokenizer.lheading(t)){t=t.substring(n.raw.length),r.push(n);continue}let h=t;if((l=this.options.extensions)!=null&&l.startBlock){let c=1/0,b=t.slice(1),g;this.options.extensions.startBlock.forEach(x=>{g=x.call({lexer:this},b),typeof g=="number"&&g>=0&&(c=Math.min(c,g))}),c<1/0&&c>=0&&(h=t.substring(0,c+1))}if(this.state.top&&(n=this.tokenizer.paragraph(h))){let c=r.at(-1);s&&(c==null?void 0:c.type)==="paragraph"?(c.raw+=(c.raw.endsWith(`
`)?"":`
`)+n.raw,c.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=c.text):r.push(n),s=h.length!==t.length,t=t.substring(n.raw.length);continue}if(n=this.tokenizer.text(t)){t=t.substring(n.raw.length);let c=r.at(-1);(c==null?void 0:c.type)==="text"?(c.raw+=(c.raw.endsWith(`
`)?"":`
`)+n.raw,c.text+=`
`+n.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=c.text):r.push(n);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return this.state.top=!0,r}inline(t,r=[]){return this.inlineQueue.push({src:t,tokens:r}),r}inlineTokens(t,r=[]){var h,c,b,g,x;this.tokenizer.lexer=this;let s=t,o=null;if(this.tokens.links){let f=Object.keys(this.tokens.links);if(f.length>0)for(;(o=this.tokenizer.rules.inline.reflinkSearch.exec(s))!==null;)f.includes(o[0].slice(o[0].lastIndexOf("[")+1,-1))&&(s=s.slice(0,o.index)+"["+"a".repeat(o[0].length-2)+"]"+s.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(o=this.tokenizer.rules.inline.anyPunctuation.exec(s))!==null;)s=s.slice(0,o.index)+"++"+s.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let i;for(;(o=this.tokenizer.rules.inline.blockSkip.exec(s))!==null;)i=o[2]?o[2].length:0,s=s.slice(0,o.index+i)+"["+"a".repeat(o[0].length-i-2)+"]"+s.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);s=((c=(h=this.options.hooks)==null?void 0:h.emStrongMask)==null?void 0:c.call({lexer:this},s))??s;let a=!1,l="",n=1/0;for(;t;){if(t.length<n)n=t.length;else{this.infiniteLoopError(t.charCodeAt(0));break}a||(l=""),a=!1;let f;if((g=(b=this.options.extensions)==null?void 0:b.inline)!=null&&g.some(z=>(f=z.call({lexer:this},t,r))?(t=t.substring(f.raw.length),r.push(f),!0):!1))continue;if(f=this.tokenizer.escape(t)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.tag(t)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.link(t)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.reflink(t,this.tokens.links)){t=t.substring(f.raw.length);let z=r.at(-1);f.type==="text"&&(z==null?void 0:z.type)==="text"?(z.raw+=f.raw,z.text+=f.text):r.push(f);continue}if(f=this.tokenizer.emStrong(t,s,l)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.codespan(t)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.br(t)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.del(t,s,l)){t=t.substring(f.raw.length),r.push(f);continue}if(f=this.tokenizer.autolink(t)){t=t.substring(f.raw.length),r.push(f);continue}if(!this.state.inLink&&(f=this.tokenizer.url(t))){t=t.substring(f.raw.length),r.push(f);continue}let M=t;if((x=this.options.extensions)!=null&&x.startInline){let z=1/0,ne=t.slice(1),nt;this.options.extensions.startInline.forEach(Le=>{nt=Le.call({lexer:this},ne),typeof nt=="number"&&nt>=0&&(z=Math.min(z,nt))}),z<1/0&&z>=0&&(M=t.substring(0,z+1))}if(f=this.tokenizer.inlineText(M)){t=t.substring(f.raw.length),f.raw.slice(-1)!=="_"&&(l=f.raw.slice(-1)),a=!0;let z=r.at(-1);(z==null?void 0:z.type)==="text"?(z.raw+=f.raw,z.text+=f.text):r.push(f);continue}if(t){this.infiniteLoopError(t.charCodeAt(0));break}}return r}infiniteLoopError(t){let r="Infinite loop on byte: "+t;if(this.options.silent)console.error(r);else throw new Error(r)}},ke=class{constructor(e){A(this,"options");A(this,"parser");this.options=e||_t}space(e){return""}code({text:e,lang:t,escaped:r}){var i;let s=(i=(t||"").match(R.notSpaceStart))==null?void 0:i[0],o=e.replace(R.endingNewline,"")+`
`;return s?'<pre><code class="language-'+Q(s)+'">'+(r?o:Q(o,!0))+`</code></pre>
`:"<pre><code>"+(r?o:Q(o,!0))+`</code></pre>
`}blockquote({tokens:e}){return`<blockquote>
${this.parser.parse(e)}</blockquote>
`}html({text:e}){return e}def(e){return""}heading({tokens:e,depth:t}){return`<h${t}>${this.parser.parseInline(e)}</h${t}>
`}hr(e){return`<hr>
`}list(e){let t=e.ordered,r=e.start,s="";for(let a=0;a<e.items.length;a++){let l=e.items[a];s+=this.listitem(l)}let o=t?"ol":"ul",i=t&&r!==1?' start="'+r+'"':"";return"<"+o+i+`>
`+s+"</"+o+`>
`}listitem(e){return`<li>${this.parser.parse(e.tokens)}</li>
`}checkbox({checked:e}){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox"> '}paragraph({tokens:e}){return`<p>${this.parser.parseInline(e)}</p>
`}table(e){let t="",r="";for(let o=0;o<e.header.length;o++)r+=this.tablecell(e.header[o]);t+=this.tablerow({text:r});let s="";for(let o=0;o<e.rows.length;o++){let i=e.rows[o];r="";for(let a=0;a<i.length;a++)r+=this.tablecell(i[a]);s+=this.tablerow({text:r})}return s&&(s=`<tbody>${s}</tbody>`),`<table>
<thead>
`+t+`</thead>
`+s+`</table>
`}tablerow({text:e}){return`<tr>
${e}</tr>
`}tablecell(e){let t=this.parser.parseInline(e.tokens),r=e.header?"th":"td";return(e.align?`<${r} align="${e.align}">`:`<${r}>`)+t+`</${r}>
`}strong({tokens:e}){return`<strong>${this.parser.parseInline(e)}</strong>`}em({tokens:e}){return`<em>${this.parser.parseInline(e)}</em>`}codespan({text:e}){return`<code>${Q(e,!0)}</code>`}br(e){return"<br>"}del({tokens:e}){return`<del>${this.parser.parseInline(e)}</del>`}link({href:e,title:t,tokens:r}){let s=this.parser.parseInline(r),o=Yr(e);if(o===null)return s;e=o;let i='<a href="'+e+'"';return t&&(i+=' title="'+Q(t)+'"'),i+=">"+s+"</a>",i}image({href:e,title:t,text:r,tokens:s}){s&&(r=this.parser.parseInline(s,this.parser.textRenderer));let o=Yr(e);if(o===null)return Q(r);e=o;let i=`<img src="${e}" alt="${Q(r)}"`;return t&&(i+=` title="${Q(t)}"`),i+=">",i}text(e){return"tokens"in e&&e.tokens?this.parser.parseInline(e.tokens):"escaped"in e&&e.escaped?e.text:Q(e.text)}},_r=class{strong({text:e}){return e}em({text:e}){return e}codespan({text:e}){return e}del({text:e}){return e}html({text:e}){return e}text({text:e}){return e}link({text:e}){return""+e}image({text:e}){return""+e}br(){return""}checkbox({raw:e}){return e}},W=class Je{constructor(t){A(this,"options");A(this,"renderer");A(this,"textRenderer");this.options=t||_t,this.options.renderer=this.options.renderer||new ke,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new _r}static parse(t,r){return new Je(r).parse(t)}static parseInline(t,r){return new Je(r).parseInline(t)}parse(t){var s,o;this.renderer.parser=this;let r="";for(let i=0;i<t.length;i++){let a=t[i];if((o=(s=this.options.extensions)==null?void 0:s.renderers)!=null&&o[a.type]){let n=a,h=this.options.extensions.renderers[n.type].call({parser:this},n);if(h!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(n.type)){r+=h||"";continue}}let l=a;switch(l.type){case"space":{r+=this.renderer.space(l);break}case"hr":{r+=this.renderer.hr(l);break}case"heading":{r+=this.renderer.heading(l);break}case"code":{r+=this.renderer.code(l);break}case"table":{r+=this.renderer.table(l);break}case"blockquote":{r+=this.renderer.blockquote(l);break}case"list":{r+=this.renderer.list(l);break}case"checkbox":{r+=this.renderer.checkbox(l);break}case"html":{r+=this.renderer.html(l);break}case"def":{r+=this.renderer.def(l);break}case"paragraph":{r+=this.renderer.paragraph(l);break}case"text":{r+=this.renderer.text(l);break}default:{let n='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(n),"";throw new Error(n)}}}return r}parseInline(t,r=this.renderer){var o,i;this.renderer.parser=this;let s="";for(let a=0;a<t.length;a++){let l=t[a];if((i=(o=this.options.extensions)==null?void 0:o.renderers)!=null&&i[l.type]){let h=this.options.extensions.renderers[l.type].call({parser:this},l);if(h!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(l.type)){s+=h||"";continue}}let n=l;switch(n.type){case"escape":{s+=r.text(n);break}case"html":{s+=r.html(n);break}case"link":{s+=r.link(n);break}case"image":{s+=r.image(n);break}case"checkbox":{s+=r.checkbox(n);break}case"strong":{s+=r.strong(n);break}case"em":{s+=r.em(n);break}case"codespan":{s+=r.codespan(n);break}case"br":{s+=r.br(n);break}case"del":{s+=r.del(n);break}case"text":{s+=r.text(n);break}default:{let h='Token with "'+n.type+'" type was not found.';if(this.options.silent)return console.error(h),"";throw new Error(h)}}}return s}},ue,qt=(ue=class{constructor(e){A(this,"options");A(this,"block");this.options=e||_t}preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}emStrongMask(e){return e}provideLexer(e=this.block){return e?q.lex:q.lexInline}provideParser(e=this.block){return e?W.parse:W.parseInline}},A(ue,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens","emStrongMask"])),A(ue,"passThroughHooksRespectAsync",new Set(["preprocess","postprocess","processAllTokens"])),ue),$a=class{constructor(...e){A(this,"defaults",br());A(this,"options",this.setOptions);A(this,"parse",this.parseMarkdown(!0));A(this,"parseInline",this.parseMarkdown(!1));A(this,"Parser",W);A(this,"Renderer",ke);A(this,"TextRenderer",_r);A(this,"Lexer",q);A(this,"Tokenizer",_e);A(this,"Hooks",qt);this.use(...e)}walkTokens(e,t){var s,o;let r=[];for(let i of e)switch(r=r.concat(t.call(this,i)),i.type){case"table":{let a=i;for(let l of a.header)r=r.concat(this.walkTokens(l.tokens,t));for(let l of a.rows)for(let n of l)r=r.concat(this.walkTokens(n.tokens,t));break}case"list":{let a=i;r=r.concat(this.walkTokens(a.items,t));break}default:{let a=i;(o=(s=this.defaults.extensions)==null?void 0:s.childTokens)!=null&&o[a.type]?this.defaults.extensions.childTokens[a.type].forEach(l=>{let n=a[l].flat(1/0);r=r.concat(this.walkTokens(n,t))}):a.tokens&&(r=r.concat(this.walkTokens(a.tokens,t)))}}return r}use(...e){let t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach(r=>{let s={...r};if(s.async=this.defaults.async||s.async||!1,r.extensions&&(r.extensions.forEach(o=>{if(!o.name)throw new Error("extension name required");if("renderer"in o){let i=t.renderers[o.name];i?t.renderers[o.name]=function(...a){let l=o.renderer.apply(this,a);return l===!1&&(l=i.apply(this,a)),l}:t.renderers[o.name]=o.renderer}if("tokenizer"in o){if(!o.level||o.level!=="block"&&o.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let i=t[o.level];i?i.unshift(o.tokenizer):t[o.level]=[o.tokenizer],o.start&&(o.level==="block"?t.startBlock?t.startBlock.push(o.start):t.startBlock=[o.start]:o.level==="inline"&&(t.startInline?t.startInline.push(o.start):t.startInline=[o.start]))}"childTokens"in o&&o.childTokens&&(t.childTokens[o.name]=o.childTokens)}),s.extensions=t),r.renderer){let o=this.defaults.renderer||new ke(this.defaults);for(let i in r.renderer){if(!(i in o))throw new Error(`renderer '${i}' does not exist`);if(["options","parser"].includes(i))continue;let a=i,l=r.renderer[a],n=o[a];o[a]=(...h)=>{let c=l.apply(o,h);return c===!1&&(c=n.apply(o,h)),c||""}}s.renderer=o}if(r.tokenizer){let o=this.defaults.tokenizer||new _e(this.defaults);for(let i in r.tokenizer){if(!(i in o))throw new Error(`tokenizer '${i}' does not exist`);if(["options","rules","lexer"].includes(i))continue;let a=i,l=r.tokenizer[a],n=o[a];o[a]=(...h)=>{let c=l.apply(o,h);return c===!1&&(c=n.apply(o,h)),c}}s.tokenizer=o}if(r.hooks){let o=this.defaults.hooks||new qt;for(let i in r.hooks){if(!(i in o))throw new Error(`hook '${i}' does not exist`);if(["options","block"].includes(i))continue;let a=i,l=r.hooks[a],n=o[a];qt.passThroughHooks.has(i)?o[a]=h=>{if(this.defaults.async&&qt.passThroughHooksRespectAsync.has(i))return(async()=>{let b=await l.call(o,h);return n.call(o,b)})();let c=l.call(o,h);return n.call(o,c)}:o[a]=(...h)=>{if(this.defaults.async)return(async()=>{let b=await l.apply(o,h);return b===!1&&(b=await n.apply(o,h)),b})();let c=l.apply(o,h);return c===!1&&(c=n.apply(o,h)),c}}s.hooks=o}if(r.walkTokens){let o=this.defaults.walkTokens,i=r.walkTokens;s.walkTokens=function(a){let l=[];return l.push(i.call(this,a)),o&&(l=l.concat(o.call(this,a))),l}}this.defaults={...this.defaults,...s}}),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return q.lex(e,t??this.defaults)}parser(e,t){return W.parse(e,t??this.defaults)}parseMarkdown(e){return(t,r)=>{let s={...r},o={...this.defaults,...s},i=this.onError(!!o.silent,!!o.async);if(this.defaults.async===!0&&s.async===!1)return i(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof t>"u"||t===null)return i(new Error("marked(): input parameter is undefined or null"));if(typeof t!="string")return i(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(t)+", string expected"));if(o.hooks&&(o.hooks.options=o,o.hooks.block=e),o.async)return(async()=>{let a=o.hooks?await o.hooks.preprocess(t):t,l=await(o.hooks?await o.hooks.provideLexer(e):e?q.lex:q.lexInline)(a,o),n=o.hooks?await o.hooks.processAllTokens(l):l;o.walkTokens&&await Promise.all(this.walkTokens(n,o.walkTokens));let h=await(o.hooks?await o.hooks.provideParser(e):e?W.parse:W.parseInline)(n,o);return o.hooks?await o.hooks.postprocess(h):h})().catch(i);try{o.hooks&&(t=o.hooks.preprocess(t));let a=(o.hooks?o.hooks.provideLexer(e):e?q.lex:q.lexInline)(t,o);o.hooks&&(a=o.hooks.processAllTokens(a)),o.walkTokens&&this.walkTokens(a,o.walkTokens);let l=(o.hooks?o.hooks.provideParser(e):e?W.parse:W.parseInline)(a,o);return o.hooks&&(l=o.hooks.postprocess(l)),l}catch(a){return i(a)}}}onError(e,t){return r=>{if(r.message+=`
Please report this to https://github.com/markedjs/marked.`,e){let s="<p>An error occurred:</p><pre>"+Q(r.message+"",!0)+"</pre>";return t?Promise.resolve(s):s}if(t)return Promise.reject(r);throw r}}},yt=new $a;function S(e,t){return yt.parse(e,t)}S.options=S.setOptions=function(e){return yt.setOptions(e),S.defaults=yt.defaults,Ts(S.defaults),S};S.getDefaults=br;S.defaults=_t;S.use=function(...e){return yt.use(...e),S.defaults=yt.defaults,Ts(S.defaults),S};S.walkTokens=function(e,t){return yt.walkTokens(e,t)};S.parseInline=yt.parseInline;S.Parser=W;S.parser=W.parse;S.Renderer=ke;S.TextRenderer=_r;S.Lexer=q;S.lexer=q.lex;S.Tokenizer=_e;S.Hooks=qt;S.parse=S;S.options;S.setOptions;S.use;S.walkTokens;S.parseInline;W.parse;q.lex;var Sa=Object.defineProperty,Ca=Object.getOwnPropertyDescriptor,Pe=(e,t,r,s)=>{for(var o=s>1?void 0:s?Ca(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Sa(t,r,o),o};let Wt="",tr=0;function Ut(e){if(!e)return 0;const t=Wt.indexOf(e,tr);if(t===-1){const s=Wt.indexOf(e);return s===-1?0:(Wt.slice(0,s).match(/\n/g)??[]).length+1}const r=(Wt.slice(0,t).match(/\n/g)??[]).length+1;return tr=t+e.length,r}function rs(e){return e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}const Aa={heading(e){const t=this.parser.parseInline(e.tokens),r=Ut(e.raw);return`<h${e.depth} data-source-line="${r}">${t}</h${e.depth}>
`},paragraph(e){const t=this.parser.parseInline(e.tokens);return`<p data-source-line="${Ut(e.raw)}">${t}</p>
`},code(e){const t=Ut(e.raw),r=rs(e.text),s=e.lang?` class="language-${rs(e.lang)}"`:"";return`<pre data-source-line="${t}"><code${s}>${r}</code></pre>
`},list(e){const t=Ut(e.raw);let r="";for(const i of e.items)r+=this.listitem(i);const s=e.ordered?"ol":"ul",o=e.ordered&&e.start!==1?` start="${e.start}"`:"";return`<${s}${o} data-source-line="${t}">
${r}</${s}>
`},blockquote(e){const t=Ut(e.raw),r=this.parser.parse(e.tokens);return`<blockquote data-source-line="${t}">
${r}</blockquote>
`}};let ss=!1;function Ea(){ss||(ss=!0,S.use({hooks:{preprocess(e){return Wt=e,tr=0,e}},renderer:Aa}))}let Pt=class extends T{constructor(){super(...arguments),this.content="",this.line=null,this.keyword=""}updated(e){var t;(t=super.updated)==null||t.call(this,e),(e.has("content")||e.has("keyword"))&&this._highlightKeyword(),(e.has("line")||e.has("content"))&&this._locateAndHighlight()}_locateAndHighlight(){if(this.line===null||this.line===void 0)return;const e=Array.from(this.shadowRoot.querySelectorAll("[data-source-line]"));if(e.length===0)return;const t=e.reduce((s,o)=>{const i=Number(o.getAttribute("data-source-line"));return i<=this.line&&(!s||i>Number(s.getAttribute("data-source-line")))?o:s},null);if(!t)return;const r=this.getBoundingClientRect();if(r.height>0){const s=t.getBoundingClientRect(),o=s.top-r.top+this.scrollTop;this.scrollTo({top:o-r.height/2+s.height/2,behavior:"smooth"})}t.classList.remove("highlight-flash"),t.offsetWidth,t.classList.add("highlight-flash")}_highlightKeyword(){var a,l;const e=(a=this.shadowRoot)==null?void 0:a.querySelector(".md-body");if(!e)return;const t=(this.keyword??"").split(/\s+/).filter(n=>n.length>0);if(t.length===0)return;const r=new RegExp(t.map(n=>this._escapeRegExp(n)).join("|"),"gi"),s=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,{acceptNode(n){const h=n.parentElement;if(!h)return NodeFilter.FILTER_REJECT;const c=h.tagName;return c==="SCRIPT"||c==="STYLE"||c==="MARK"?NodeFilter.FILTER_REJECT:r.test(n.nodeValue??"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}}),o=[];let i;for(;i=s.nextNode();)o.push(i);for(const n of o){r.lastIndex=0;const h=n.nodeValue??"",c=document.createDocumentFragment();let b=0,g;for(;(g=r.exec(h))!==null;){g.index>b&&c.appendChild(document.createTextNode(h.slice(b,g.index)));const x=document.createElement("mark");x.textContent=g[0],x.className="keyword-hit",c.appendChild(x),b=g.index+g[0].length,g[0].length===0&&r.lastIndex++}b<h.length&&c.appendChild(document.createTextNode(h.slice(b))),(l=n.parentNode)==null||l.replaceChild(c,n)}}_escapeRegExp(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}render(){if(Ea(),!this.content)return p`<div class="empty">无内容</div>`;const e=S.parse(this.content,{async:!1});return p`<div class="md-body" .innerHTML=${e}></div>`}};Pt.styles=$`
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
  `;Pe([u()],Pt.prototype,"content",2);Pe([u({type:Number})],Pt.prototype,"line",2);Pe([u()],Pt.prototype,"keyword",2);Pt=Pe([P("md-viewer")],Pt);var Ta=Object.defineProperty,za=Object.getOwnPropertyDescriptor,at=(e,t,r,s)=>{for(var o=s>1?void 0:s?za(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ta(t,r,o),o};let J=class extends T{constructor(){super(...arguments),this.path="",this.language="text",this.content="",this.highlights=[],this.loading=!1,this.line=null,this.keyword=""}render(){if(this.loading)return p`<div class="empty">加载中...</div>`;if(!this.content)return p`<div class="empty">点击左侧结果查看预览</div>`;if(this.language==="markdown")return p`
        <div class="header">${this.path}</div>
        <md-viewer
          .content=${this.content}
          .line=${this.line}
          .keyword=${this.keyword}>
        </md-viewer>
      `;const e=this.content.split(`
`);return p`
      <div class="header">${this.path}</div>
      <div class="body">
        ${e.map((t,r)=>{const s=r+1,o=this.highlights.includes(s)?"highlight":"";return p`<div class=${o}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${s}</span>${t}</div>`})}
      </div>
    `}};J.styles=$`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header {
      font-size: var(--cortex-fs-base);
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
      font-size: var(--cortex-fs-sm);
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
      font-size: var(--cortex-fs-base);
    }
  `;at([u()],J.prototype,"path",2);at([u()],J.prototype,"language",2);at([u()],J.prototype,"content",2);at([u({attribute:!1})],J.prototype,"highlights",2);at([u({type:Boolean})],J.prototype,"loading",2);at([u({type:Number})],J.prototype,"line",2);at([u()],J.prototype,"keyword",2);J=at([P("preview-pane")],J);var Pa=Object.defineProperty,Oa=Object.getOwnPropertyDescriptor,Oe=(e,t,r,s)=>{for(var o=s>1?void 0:s?Oa(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Pa(t,r,o),o};let Ot=class extends T{constructor(){super(...arguments),this.role="user",this.message=null,this.error=null}render(){return this.message?p`
      <div class="bubble">${this.message.content}${this.message.content===""?p`<span style="opacity:0.6">思考中...</span>`:null}</div>
      ${this.error?p`<div class="error">⚠️ ${this.error}</div>`:null}
    `:null}};Ot.styles=$`
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
  `;Oe([u({reflect:!0})],Ot.prototype,"role",2);Oe([u({attribute:!1})],Ot.prototype,"message",2);Oe([u()],Ot.prototype,"error",2);Ot=Oe([P("chat-message")],Ot);var Ra=Object.defineProperty,Ia=Object.getOwnPropertyDescriptor,Hs=(e,t,r,s)=>{for(var o=s>1?void 0:s?Ia(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ra(t,r,o),o};let $e=class extends T{constructor(){super(...arguments),this.messages=[]}updated(){this.scrollTop=this.scrollHeight}render(){return this.messages.length===0?p`<div class="empty">开始与 Cortex 对话</div>`:p`
      ${this.messages.map(e=>p`<chat-message role=${e.role} .message=${e}></chat-message>`)}
    `}};$e.styles=$`
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
  `;Hs([u({attribute:!1})],$e.prototype,"messages",2);$e=Hs([P("chat-stream")],$e);class Fs extends Error{constructor(t,r,s){super(s),this.status=t,this.code=r,this.name="ApiError"}}async function ae(e,t={}){const r={...t};t.json!==void 0&&(r.headers={"Content-Type":"application/json",...t.headers||{}},r.body=JSON.stringify(t.json));const s=await fetch(e,r);if(!s.ok){let o;try{o=await s.json()}catch{o={code:"unknown",detail:s.statusText}}throw new Fs(s.status,o.code??"unknown",o.detail??"请求失败")}return s.json()}async function*La(e,t){const r=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!r.ok||!r.body)throw new Fs(r.status,"stream_failed","流式请求失败");const s=r.body.getReader(),o=new TextDecoder;let i="";for(;;){const{value:a,done:l}=await s.read();if(l)break;for(i+=o.decode(a,{stream:!0});;){const n=i.match(/\r\n\r\n|\r\r|\n\n/);if(!n||n.index===void 0)break;const h=n.index,c=n[0].length,b=i.slice(0,h);i=i.slice(h+c);let g="message",x="";for(const f of b.split(/\r\n|\r|\n/))f.startsWith("event:")?g=f.slice(6).trim():f.startsWith("data:")&&(x+=f.slice(5).trim());yield{event:g,data:x}}}}async function Da(e){return ae("/api/search",{method:"POST",json:e})}async function Ms(e){return ae("/api/sessions",{method:"POST",json:e})}async function kr(e){const t=new URLSearchParams;return e.type&&t.set("type",e.type),e.limit&&t.set("limit",String(e.limit)),e.offset&&t.set("offset",String(e.offset)),ae(`/api/sessions?${t}`,{method:"GET"})}async function Vs(e,t,r){return ae(`/api/sessions/${e}`,{method:"PATCH",json:{items:t,message_count:r}})}async function $r(e){const t=new URLSearchParams;return e&&t.set("type",e),ae(`/api/sessions?${t}`,{method:"DELETE"})}var Ba=Object.defineProperty,Na=Object.getOwnPropertyDescriptor,tt=(e,t,r,s)=>{for(var o=s>1?void 0:s?Na(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ba(t,r,o),o};const Ha=[".md",".pdf",".docx",".xlsx",".xlsm",".xltx",".xltm",".csv"];function Fa(e){const t=e.toLowerCase();return Ha.some(r=>t.endsWith(r))}let j=class extends T{constructor(){super(...arguments),this.localQuery="",this.loading=!1,this.previewContent="",this.previewPath="",this.previewLanguage="text",this.previewLine=null,this.historySessions=[],this._clearing=!1,this.previewError=null}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=m.subscribe(()=>this.requestUpdate());const e=m.getState().pendingSession;e&&e.type==="search"&&(E.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await kr({type:"search",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await $r("search"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return m.getState().search}async _submit(e){const t=e.detail.value;this.localQuery=t,E.setSearchState({state:"focus",query:t,results:[],total:0,source:"fts"}),this.loading=!0;try{const r=await Da({query:t}),s=await Ms({type:"search",title:t,preview:t.slice(0,100)});E.setSearchState({state:"focus",query:t,results:r.results,total:r.total,source:r.source,currentSession:{id:s.id,type:"search",title:t,preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:r.total}}),await Vs(s.id,r.results.map(o=>({kind:"result",payload:JSON.stringify(o)})),r.total),this._loadHistory()}catch(r){E.setError(`搜索失败: ${r.message}`)}finally{this.loading=!1}}_backToInitial(){E.setSearchState({state:"initial",currentSession:null,results:[],query:""}),this.localQuery="",this._loadHistory()}async _onResultSelect(e){const t=e.detail.result;E.pushDetail(t),this.previewError=null;try{const r=new URLSearchParams({path:t.path}),s=Fa(t.path);t.line&&!s&&(r.set("start_line",String(Math.max(1,t.line-10))),r.set("end_line",String(t.line+20)));const o=await fetch(`/api/preview?${r}`);if(o.ok){const i=await o.json();this.previewContent=i.content,this.previewPath=i.path,this.previewLanguage=i.language,this.previewLine=t.line??null}else(await o.json().catch(()=>({code:"UNKNOWN",detail:""}))).code==="NOT_INDEXED"&&(this.previewError="NOT_INDEXED",this.previewContent="",this.previewPath=t.path)}catch(r){console.warn("preview failed",r)}}_popDetail(){E.popDetail()}_renderNotIndexedHint(e){return p`<div class=${e?"desktop-only not-indexed-hint":"not-indexed-hint"}>
      该文件未索引，无法预览。<br>请先执行 cortex index 后重试。
    </div>`}async _loadSession(e){E.setSearchState({state:"focus",currentSession:e,query:e.title});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const s=((await t.json()).items||[]).filter(o=>o.kind==="result").map(o=>JSON.parse(o.payload));E.setSearchState({results:s,total:s.length,source:"fts"})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){const e=this.viewState;if(e.state==="initial")return p`
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
              @input-change=${r=>this.localQuery=r.detail.value}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;const t=m.getState().detailStack[m.getState().detailStack.length-1];return p`
      <div class="focus-body">
        <focus-header
          back-label="新搜索"
          title=${e.query}
          meta=${`${e.total} 条结果${e.source==="fts"?"":` (${e.source.toUpperCase()})`}`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main">
          <search-results
            .results=${e.results}
            .activePath=${(t==null?void 0:t.path)??null}
            .activeLine=${(t==null?void 0:t.line)??null}
            @select=${this._onResultSelect}>
          </search-results>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!0):p`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${e.query}>
              </preview-pane>`}
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
      ${t?p`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${t.path}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError==="NOT_INDEXED"?this._renderNotIndexedHint(!1):p`<preview-pane
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${e.query}>
              </preview-pane>`}
        </div>`:null}
    `}};j.styles=$`
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
      .focus-input-bar {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;tt([k()],j.prototype,"localQuery",2);tt([k()],j.prototype,"loading",2);tt([k()],j.prototype,"previewContent",2);tt([k()],j.prototype,"previewPath",2);tt([k()],j.prototype,"previewLanguage",2);tt([k()],j.prototype,"previewLine",2);tt([k()],j.prototype,"historySessions",2);tt([k()],j.prototype,"_clearing",2);tt([k()],j.prototype,"previewError",2);j=tt([P("search-view")],j);async function*Ma(e){for await(const t of La("/api/chat",e))if(t.event==="token")try{yield{type:"token",text:JSON.parse(t.data).text}}catch{}else if(t.event==="done")yield{type:"done"};else if(t.event==="error")try{yield{type:"error",detail:JSON.parse(t.data).detail}}catch{yield{type:"error",detail:"未知错误"}}}var Va=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,Re=(e,t,r,s)=>{for(var o=s>1?void 0:s?ja(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Va(t,r,o),o};let Rt=class extends T{constructor(){super(...arguments),this.draft="",this.historySessions=[],this._clearing=!1}connectedCallback(){super.connectedCallback(),this._loadHistory(),this._unsubscribe=m.subscribe(()=>this.requestUpdate());const e=m.getState().pendingSession;e&&e.type==="chat"&&(E.setPendingSession(null),this._loadSession(e))}disconnectedCallback(){var e;super.disconnectedCallback(),(e=this._unsubscribe)==null||e.call(this)}async _loadHistory(){try{const{sessions:e}=await kr({type:"chat",limit:20});this.historySessions=e}catch(e){console.warn("load history failed",e)}}async _onClearHistory(){this._clearing=!0,this.requestUpdate();try{await $r("chat"),this.historySessions=[]}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}}get viewState(){return m.getState().chat}async _submit(e){const t=e.detail.value;if(this.draft="",this.viewState.state==="initial"){const s=await Ms({type:"chat",title:t.slice(0,60),preview:t.slice(0,100)});E.setChatState({state:"focus",currentSession:{id:s.id,type:"chat",title:t.slice(0,60),preview:t.slice(0,100),updated_at:new Date().toISOString(),message_count:0},messages:[{role:"user",content:t}],streaming:!0})}else E.setChatState({messages:[...this.viewState.messages,{role:"user",content:t}],streaming:!0});const r=m.getState().chat.currentSession.id;E.setChatState({messages:[...m.getState().chat.messages,{role:"assistant",content:""}]});try{let s="";for await(const o of Ma({message:t,session_id:r}))if(o.type==="token"){s+=o.text;const i=[...m.getState().chat.messages];i[i.length-1]={role:"assistant",content:s},E.setChatState({messages:i})}else if(o.type==="error"){const i=[...m.getState().chat.messages];i[i.length-1]={role:"assistant",content:s+`

⚠️ ${o.detail}`},E.setChatState({messages:i})}await Vs(r,[{kind:"message_user",payload:JSON.stringify({content:t})},{kind:"message_ai",payload:JSON.stringify({content:s})}],m.getState().chat.messages.length),this._loadHistory()}catch(s){E.setError(`对话失败: ${s.message}`)}finally{E.setChatState({streaming:!1})}}_backToInitial(){E.setChatState({state:"initial",currentSession:null,messages:[]}),this._loadHistory()}async _loadSession(e){E.setChatState({state:"focus",currentSession:e,messages:[]});try{const t=await fetch(`/api/sessions/${e.id}`);if(t.ok){const s=((await t.json()).items||[]).map(o=>{const i=JSON.parse(o.payload);return{role:o.kind==="message_user"?"user":"assistant",content:i.content}});E.setChatState({messages:s})}}catch(t){console.warn("load session failed",t)}}_onHistorySelect(e){this._loadSession(e.detail.session)}render(){var t;const e=this.viewState;return e.state==="initial"?p`
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
      `:p`
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
    `}};Rt.styles=$`
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
  `;Re([k()],Rt.prototype,"draft",2);Re([k()],Rt.prototype,"historySessions",2);Re([k()],Rt.prototype,"_clearing",2);Rt=Re([P("chat-view")],Rt);var Ua=Object.defineProperty,qa=Object.getOwnPropertyDescriptor,Ie=(e,t,r,s)=>{for(var o=s>1?void 0:s?qa(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ua(t,r,o),o};let It=class extends T{constructor(){super(...arguments),this.sessions=[],this.loading=!0,this._clearing=!1}connectedCallback(){super.connectedCallback(),this._load()}async _load(){this.loading=!0;try{const{sessions:e}=await kr({limit:100});this.sessions=e}catch(e){console.warn("load history failed",e)}finally{this.loading=!1}}_onSelect(e){const t=e.detail.session;E.setPendingSession(t),E.setView(t.type==="search"?"search":"chat")}async _onClear(){this._clearing=!0,this.requestUpdate();try{await $r(),await this._load()}catch(e){console.warn("clear sessions failed",e)}finally{this._clearing=!1,this.requestUpdate()}}render(){return p`
      <welcome-pane heading="历史会话" subheading="全部搜索与对话历史"></welcome-pane>
      <history-list
        title=${this.loading?"加载中...":"最近会话"}
        ?clearing=${this._clearing}
        .sessions=${this.sessions}
        @select=${this._onSelect}
        @clear=${this._onClear}>
      </history-list>
    `}};It.styles=$`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
  `;Ie([k()],It.prototype,"sessions",2);Ie([k()],It.prototype,"loading",2);Ie([k()],It.prototype,"_clearing",2);It=Ie([P("history-view")],It);const Wa={ai:"AI 配置",search:"搜索调优",scoring:"评分",terminal:"终端"},Xa=[{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_BASE_URL",label:"API Base URL",component:"text",effect:"restart",mono:!0,hint:"Anthropic API 端点。可替换为兼容代理或本地模型服务。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_API_KEY",label:"API Key",component:"password",effect:"restart",mono:!0,hint:"Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。"},{tab:"ai",section:"🤖 AI 模型与 API",envVar:"PLANIFY_MODEL_ID",label:"模型 ID",component:"text",effect:"restart",mono:!0,datalist:["claude-opus-4-6","claude-sonnet-4-6","claude-haiku-4-5"],hint:"支持自动补全常见模型；也可手动输入自定义模型 ID。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_RESULTS",label:"最大结果数（跨文档）",component:"number",effect:"live",min:1,max:200,hint:"search 工具返回的最大文档数量。"},{tab:"search",section:"📊 结果数量",envVar:"CORTEX_MAX_NODES_PER_DOC",label:"每文档最大节点数",component:"number",effect:"live",min:1,max:20,hint:"同一文档返回的最大节点（段落）数。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MAX_SPAN",label:"关键词最大跨度",component:"number",effect:"live",min:1,max:100,hint:"窗口内匹配关键词的最大字符跨度。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORD_MATCH",label:"最少关键词匹配数",component:"number",effect:"live",min:0,max:10,hint:"文档至少命中多少个关键词才进入候选。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_PROXIMITY_SCORE",label:"最低邻近度阈值",component:"select",effect:"live",options:[{value:"0",label:"0 — 不限制"},{value:"1",label:"1 — 部分紧邻"},{value:"2",label:"2 — 全部关键词紧邻"}],hint:"关键词在文档中的邻近程度阈值。"},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_KEYWORDS_PER_LINE",label:"行级关键词阈值",component:"number",effect:"live",min:1,max:10,hint:'单行至少命中多少关键词才被选为"最佳行"。'},{tab:"search",section:"🎯 关键词匹配",envVar:"CORTEX_MIN_SCORE_THRESHOLD",label:"综合评分阈值",component:"number",effect:"live",min:0,max:1,step:.05,hint:"0 = 不过滤；0.3 = 轻微过滤；0.5+ 容易砍光多关键词结果。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_KEYWORD_MATCH",label:"关键词匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏好'命中的关键词数量多'的文档（多关键词 query 时尤其重要）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FILE_NAME_MATCH",label:"文件名匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，文件名包含关键词的文档排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_FTS_SCORE",label:"FTS 原始分权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，越偏向传统全文检索 BM25 排序（与关键词匹配度正相关）。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_TITLE_MATCH",label:"标题匹配权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，节点标题（如 Markdown 小节标题）含关键词时排序越靠前。"},{tab:"scoring",section:"⚖️ 权重配置",envVar:"CORTEX_WEIGHT_PROXIMITY_MATCH",label:"邻近度权重",component:"slider",effect:"live",min:0,max:10,step:.1,hint:"权重越大，多关键词在文档中紧邻出现的文档越受偏好。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_CONTEXT_LINES",label:"上下文行数上限",component:"number",unit:"行",min:0,max:100,hint:"每个命中行向上/向下最多各显示多少行原文上下文。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_MAX_ANCHOR_LINES",label:"锚点行数上限",component:"number",unit:"行",min:1,max:50,hint:"从同一文档的所有命中行里，挑出多少个'最佳行'作为展示中心（锚点）。锚点越多，结果越完整但输出越长。"},{tab:"terminal",section:"🖥️ 终端结果显示",envVar:"CORTEX_CONTEXT_EXPAND_RANGE",label:"锚点上下文扩展范围",component:"number",unit:"行",min:0,max:100,hint:"以每个锚点为中心，向前/向后各展开多少行作为上下文（再与'上下文行数上限'取较小值）。"}];class te extends Error{constructor(t,r){super(`Config API error ${t}`),this.status=t,this.body=r}}async function Ka(e){const t=await fetch(`/api/config?scope=${e}`,{method:"GET"}),r=await t.json().catch(()=>null);if(!t.ok)throw new te(t.status,r);return r}async function Ga(e,t){const r=await fetch(`/api/config?scope=${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({values:t})}),s=await r.json().catch(()=>null);if(!r.ok)throw new te(r.status,s);return s}async function Za(){const e=await fetch("/api/config/copy-from-global",{method:"POST"}),t=await e.json().catch(()=>null);if(!e.ok)throw new te(e.status,t);return t}var Qa=Object.defineProperty,Ya=Object.getOwnPropertyDescriptor,et=(e,t,r,s)=>{for(var o=s>1?void 0:s?Ya(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Qa(t,r,o),o};const os=["ai","search","scoring","terminal"];let K=class extends T{constructor(){super(...arguments),this._activeTab="ai",this._saving=!1,this._error=null,this._toast=null,this._values={},this._original={},this._exists=!0,this._scope="local",this._loadGen=0}connectedCallback(){super.connectedCallback();const e=m.getState();this._scope=e.settings.scope,this._unsubscribe=m.subscribe(()=>this._onStoreChange()),this._load()}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),this._toastTimer!==void 0&&(window.clearTimeout(this._toastTimer),this._toastTimer=void 0),this._loadGen+=1,super.disconnectedCallback()}_onStoreChange(){const e=m.getState();e.settings.scope!==this._scope&&(this._scope=e.settings.scope,this._load())}async _load(){const e=++this._loadGen;this._error=null;try{const t=await Ka(this._scope);if(e!==this._loadGen||!this.isConnected)return;this._values={...t.values},this._original={...t.values},this._exists=t.exists,E.loadSettings(t.values,t.exists)}catch(t){if(e!==this._loadGen||!this.isConnected)return;this._error=`加载失败: ${t.message}`}}get _dirtyFields(){const e=new Set([...Object.keys(this._original),...Object.keys(this._values)]),t=[];for(const r of e)(this._original[r]??"")!==(this._values[r]??"")&&t.push(r);return t}get _dirty(){return this._dirtyFields.length>0}_onInput(e,t){this._values={...this._values,[e]:t},E.updateSetting(e,t)}_revert(){this._values={...this._original},E.revertSettings()}async _copyFromGlobal(){try{await Za(),await this._load()}catch(e){e instanceof te?this._error=`复制失败 (HTTP ${e.status})`:e instanceof Error?this._error=`复制失败: ${e.message}`:this._error="复制失败: 未知错误"}}async _save(){var e;if(!(!this._dirty||this._saving)){this._saving=!0,this._error=null;try{const t=await Ga(this._scope,this._values);if(!this.isConnected)return;this._original={...this._values},E.loadSettings(this._values,!0),this._toast=t.needs_restart?"已保存。重启 cortex gui 后 AI 配置生效。":"已保存。下次查询立即生效。",this._toastTimer=window.setTimeout(()=>{this._toast=null,this._toastTimer=void 0},4e3)}catch(t){let r;if(t instanceof te){const s=t.body,o=(e=s==null?void 0:s.fields)==null?void 0:e.map(i=>i.field).join(", ");r=o?`保存失败（${o}）`:`保存失败 (HTTP ${t.status})`}else t instanceof Error?r=`保存失败: ${t.message}`:r="保存失败: 未知错误";this._error=r}finally{this._saving=!1}}}_renderField(e){const t=this._values[e.envVar]??"",r=e.effect?p`<span class="effect ${e.effect}">${e.effect==="restart"?"🔁 需重启":"● 即时"}</span>`:y;return p`
      <div class="field">
        <div class="field-label">
          <div class="name">${e.label} ${r}</div>
          <div class="env">${e.envVar}${e.min!==void 0&&e.max!==void 0?` · 范围 ${e.min}~${e.max}`:""}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(e,t)}</div>
          ${e.hint?p`<div class="hint">${e.hint}</div>`:y}
        </div>
      </div>
    `}_renderInput(e,t){const r=e.mono?"mono":"",s=o=>this._onInput(e.envVar,o.target.value);switch(e.component){case"text":return p`
          <input
            class="input ${r}"
            type="text"
            .value=${t}
            data-env=${e.envVar}
            @input=${s}
            list=${e.datalist?`${e.envVar}-list`:y}
          />
          ${e.datalist?p`
            <datalist id=${`${e.envVar}-list`}>
              ${e.datalist.map(o=>p`<option value=${o}></option>`)}
            </datalist>
          `:y}
        `;case"password":return p`
          <div style="position: relative; max-width: 420px;">
            <input
              class="input ${r}"
              type="password"
              .value=${t}
              data-env=${e.envVar}
              @input=${s}
            />
            <button
              class="btn"
              type="button"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); padding: 2px 8px; font-size: var(--cortex-fs-xs);"
              @click=${o=>{const i=o.target.previousElementSibling;i.type=i.type==="password"?"text":"password"}}
            >显示</button>
          </div>
        `;case"number":return p`
          <input
            class="input"
            type="number"
            .value=${t}
            min=${e.min??y}
            max=${e.max??y}
            step=${e.step??y}
            data-env=${e.envVar}
            @input=${s}
          />
          ${e.unit?p`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${e.unit}</span>`:y}
        `;case"select":return p`
          <select class="select" .value=${t} data-env=${e.envVar} @change=${s}>
            ${(e.options??[]).map(o=>p`
              <option value=${o.value} ?selected=${o.value===t}>${o.label}</option>
            `)}
          </select>
        `;case"slider":return p`
          <input
            class="input"
            type="number"
            .value=${t}
            min=${e.min??y}
            max=${e.max??y}
            step=${e.step??y}
            style="width: 100px;"
            data-env=${e.envVar}
            @input=${s}
          />
          <input
            type="range"
            .value=${t}
            min=${e.min??y}
            max=${e.max??y}
            step=${e.step??y}
            style="flex: 1; max-width: 280px;"
            @input=${s}
          />
        `;default:return y}}_renderInfoBox(e){return e==="ai"?p`
        <div class="info-box">
          本 tab 的所有参数修改后需<strong>重启 cortex gui</strong> 才能生效。
        </div>
      `:e==="search"?p`<div class="info-box">本 tab 的参数保存后下次查询即时生效，<strong>无需重启</strong>。</div>`:e==="scoring"?p`
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
      `:e==="terminal"?p`
        <div class="info-box warn">
          ⚠️ 这些参数仅影响 <code>cortex</code> CLI/TUI 的<strong>终端输出格式</strong>，对 Web UI 没有可见效果。在此处提供编辑仅为了免去手动改 .env 的麻烦。
        </div>
      `:y}render(){const e=this._scope==="local"?"本地":"全局",t=this._exists?"":"（新建）";return p`
      ${this._scope==="local"&&!this._exists?p`
            <div class="copy-banner">
              <span>ℹ️</span>
              <span>当前工作目录尚未创建 <code>.cortex/.env</code>，将使用全局配置。</span>
              <span class="grow"></span>
              <button class="btn primary" @click=${this._copyFromGlobal}>📋 从全局复制并编辑</button>
            </div>
          `:y}
      <nav class="tab-strip" role="tablist">
        ${os.map(r=>p`
          <button
            class=${this._activeTab===r?"active":""}
            @click=${()=>{this._activeTab=r}}
          >${Wa[r]}</button>
        `)}
      </nav>

      <div class="scroll-area">
        ${os.map(r=>{const s=Xa.filter(i=>i.tab===r),o=[];for(const i of s){let a=o.find(l=>l.title===i.section);a||(a={title:i.section,fields:[]},o.push(a)),a.fields.push(i)}return p`
            <div class="tab-panel ${this._activeTab===r?"active":""}" data-panel=${r}>
              ${this._renderInfoBox(r)}
              ${o.map(i=>p`
                <div class="section">
                  <h2>${i.title}</h2>
                  ${i.fields.map(a=>this._renderField(a))}
                </div>
              `)}
            </div>
          `})}

        <div class="footer-bar">
          <div class="dirty-status">
            ${this._dirty?p`<span class="dirty-dot"></span><span>有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`:p`<span style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`}
            ${this._error?p`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>`:y}
            ${this._toast?p`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>`:y}
          </div>
          <div style="display: flex; gap: var(--cortex-space-2);">
            <button class="btn" ?disabled=${!this._dirty||this._saving} @click=${()=>this._revert()}>放弃修改</button>
            <button class="btn primary" ?disabled=${!this._dirty||this._saving} @click=${()=>this._save()}>
              ${this._saving?"保存中…":`💾 保存${e}配置${t}`}
            </button>
          </div>
        </div>
      </div>
    `}};K.styles=$`
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
  `;et([k()],K.prototype,"_activeTab",2);et([k()],K.prototype,"_saving",2);et([k()],K.prototype,"_error",2);et([k()],K.prototype,"_toast",2);et([k()],K.prototype,"_values",2);et([k()],K.prototype,"_original",2);et([k()],K.prototype,"_exists",2);et([k()],K.prototype,"_scope",2);K=et([P("settings-view")],K);var Ja=Object.defineProperty,tn=Object.getOwnPropertyDescriptor,Sr=(e,t,r,s)=>{for(var o=s>1?void 0:s?tn(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=(s?a(t,r,o):a(o))||o);return s&&o&&Ja(t,r,o),o};let ee=class extends T{constructor(){super(...arguments),this.activeView="search",this._menuOpen=!1,this._onDocClick=e=>{if(!this._menuOpen)return;e.composedPath().includes(this)||(this._menuOpen=!1)}}_onAvatarClick(e){e.stopPropagation(),this._menuOpen=!this._menuOpen}_onScopeSelect(e){this._menuOpen=!1,this.dispatchEvent(new CustomEvent("navigate",{detail:{view:"settings",scope:e},bubbles:!0,composed:!0}))}connectedCallback(){super.connectedCallback(),document.addEventListener("click",this._onDocClick)}disconnectedCallback(){document.removeEventListener("click",this._onDocClick),super.disconnectedCallback()}render(){return p`
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
    `}};ee.styles=$`
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
  `;Sr([u()],ee.prototype,"activeView",2);Sr([k()],ee.prototype,"_menuOpen",2);ee=Sr([P("app-bar")],ee);var en=Object.getOwnPropertyDescriptor,rn=(e,t,r,s)=>{for(var o=s>1?void 0:s?en(t,r):t,i=e.length-1,a;i>=0;i--)(a=e[i])&&(o=a(o)||o);return o};let er=class extends T{connectedCallback(){super.connectedCallback(),this._unsubscribe=m.subscribe(()=>this.requestUpdate())}disconnectedCallback(){var e;(e=this._unsubscribe)==null||e.call(this),super.disconnectedCallback()}_navigate(e){E.setView(e.detail.view),e.detail.view==="settings"&&e.detail.scope&&E.setSettingsScope(e.detail.scope)}_renderView(){const e=m.getState().view;return e==="search"?p`<search-view></search-view>`:e==="chat"?p`<chat-view></chat-view>`:e==="settings"?p`<settings-view></settings-view>`:p`<history-view></history-view>`}render(){const e=m.getState().view;return p`
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
    `}};er.styles=$`
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
  `;er=rn([P("cortex-app")],er);
