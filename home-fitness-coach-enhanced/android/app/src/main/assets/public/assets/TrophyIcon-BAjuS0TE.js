import{c,bf as o,at as i,J as h,aP as l,e6 as d,j as n}from"./index-C9hzOFip.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15",key:"143lza"}],["path",{d:"M11 12 5.12 2.2",key:"qhuxz6"}],["path",{d:"m13 12 5.88-9.8",key:"hbye0f"}],["path",{d:"M8 7h8",key:"i86dvs"}],["circle",{cx:"12",cy:"17",r:"5",key:"qbz8iq"}],["path",{d:"M12 18v-2h-.5",key:"fawc4q"}]],m=c("medal",p),y={dumbbell:l,flame:h,swords:i,medal:m};function x({def:r,locked:a,size:e=56}){const s=a?o:y[r.icon],t=d[r.tier];return n.jsx("span",{className:"relative flex shrink-0 items-center justify-center rounded-full",style:{width:e,height:e,background:a?"var(--graphite)":`radial-gradient(circle at 30% 25%, ${t}55, ${t}1f 70%)`,border:`2px solid ${a?"var(--line)":t}`,boxShadow:a?"none":`0 0 ${e/3}px ${t}40`},children:n.jsx(s,{style:{width:e*.45,height:e*.45,color:a?"var(--ink-4)":t}})})}export{x as T};
