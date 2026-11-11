"use client";
import { useEffect, useRef, useState } from "react";
import "./empire-intro.css";

export default function EmpireIntro() {
  const [visible,setVisible]=useState(true);
  const [ready,setReady]=useState(false);
  const skip=useRef<HTMLButtonElement>(null);
  const close=()=>{setVisible(false);try{sessionStorage.setItem("empire-intro-v1","seen")}catch{}};
  useEffect(()=>{
    const asset=new Image();
    asset.onload=()=>setReady(true);
    asset.onerror=()=>setVisible(false);
    asset.src="/intro/ingress-abbey-reference.webp";
    if(asset.complete&&asset.naturalWidth>0)setReady(true);
    return ()=>{asset.onload=null;asset.onerror=null};
  },[]);
  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches){setVisible(false);return;}
    try{if(sessionStorage.getItem("empire-intro-v1")){setVisible(false);return;}}catch{}
    const old=document.body.style.overflow;document.body.style.overflow="hidden";skip.current?.focus();
    return ()=>{document.body.style.overflow=old};
  },[]);
  useEffect(()=>{if(!visible)return;const timer=setTimeout(close,ready?6000:10000);return()=>clearTimeout(timer)},[ready,visible]);
  useEffect(()=>{if(!visible)document.body.style.overflow=""},[visible]);
  if(!visible)return null;
  return <div className={`empire-intro${ready?" is-playing":""}`} role="dialog" aria-modal="true" aria-label="Welcome to Empire Bowls Club" onKeyDown={event=>{if(event.key==="Escape")close()}}>
    <button ref={skip} className="intro-skip" onClick={close}>Skip introduction</button>
    <div className="intro-stage" aria-hidden="true">
      <svg viewBox="0 0 1000 700" className="intro-drawing" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pencil-paper"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" seed="8" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
          <filter id="abbey-pencil"><feColorMatrix type="saturate" values=".38"/><feComponentTransfer><feFuncR type="gamma" amplitude="1.15" exponent=".72"/><feFuncG type="gamma" amplitude="1.12" exponent=".72"/><feFuncB type="gamma" amplitude="1.06" exponent=".72"/></feComponentTransfer><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="7" result="texture"/><feBlend in="SourceGraphic" in2="texture" mode="screen"/></filter>
          <linearGradient id="river-blue" x2="0" y2="1"><stop stopColor="#97b2ba" stopOpacity=".6"/><stop offset="1" stopColor="#c4d4d3" stopOpacity=".15"/></linearGradient>
          <linearGradient id="green-pencil" x2="0" y2="1"><stop stopColor="#92a77b" stopOpacity=".3"/><stop offset="1" stopColor="#497b50" stopOpacity=".65"/></linearGradient>
          <radialGradient id="abbey-fade"><stop offset=".45" stopColor="white"/><stop offset="1" stopColor="black"/></radialGradient>
          <mask id="abbey-mask"><ellipse cx="500" cy="270" rx="450" ry="265" fill="url(#abbey-fade)"/></mask>
        </defs>
        <g className="intro-heritage">
          <g className="intro-abbey" mask="url(#abbey-mask)"><image href="/intro/ingress-abbey-reference.webp" x="40" y="-80" width="920" height="614" preserveAspectRatio="xMidYMid meet" filter="url(#abbey-pencil)" onLoad={()=>setReady(true)} onError={close}/></g>
          <path className="intro-river-wash" d="M80 409 Q260 347 435 408 T920 409 L920 465 Q690 439 500 459 T80 464Z" fill="url(#river-blue)"/>
          <path className="intro-river-line" d="M80 409 Q260 347 435 408 T920 409" fill="none" stroke="#67818c" strokeWidth="2" pathLength="1"/>
          <g className="intro-ship" fill="#eee5d0" stroke="#6f6558" strokeWidth="1.4" strokeLinejoin="round">
            <path d="M645 420 Q698 437 756 417 L741 437 Q693 449 659 437Z" fill="#a58c70"/>
            <path d="M670 420V333 M700 425V319 M730 420V342 M648 420L700 319L751 420" fill="none"/>
            <path d="M671 339Q654 361 657 377H670Z M674 340Q691 363 687 378H674Z M671 382Q652 396 654 411H670Z M702 327Q682 347 686 365H701Z M705 328Q723 346 721 365H705Z M702 370Q680 392 684 413H701Z M731 349Q716 368 719 386H730Z M734 350Q748 372 745 387H734Z M733 392L748 415H733Z"/>
          </g>
        </g>
        <g filter="url(#pencil-paper)">
          <path className="intro-green" d="M160 620L322 459Q500 440 678 459L840 620Z" fill="url(#green-pencil)" stroke="#718763" strokeWidth="1.5"/>
          <path className="intro-green-line" d="M81 409Q250 370 322 459L160 620M322 459Q500 440 678 459L840 620" fill="none" stroke="#627b59" strokeWidth="2" pathLength="1"/>
          <ellipse className="intro-jack" cx="614" cy="555" rx="9" ry="8" fill="#fffdf5" stroke="#a4a391"/>
          <g className="intro-bowl"><ellipse cx="0" cy="0" rx="22" ry="20" fill="#2c4541" stroke="#263a37" strokeWidth="1.5"/><ellipse cx="5" cy="-2" rx="11" ry="15" fill="none" stroke="#a3ada1" strokeWidth="1"/><path d="M-15 7Q-20-8-8-15M-11 13Q-18 4-14-3" fill="none" stroke="#70847a"/></g>
        </g>
      </svg>
      <div className="intro-welcome"><img src="/optimized/empire-crest.webp" alt="" width="512" height="512"/><h1>Welcome to Empire Bowls Club</h1><p>Greenhithe, Kent</p></div>
    </div>
    <p className="intro-accessible">A pencil-style journey through Greenhithe’s river and sailing heritage, into a welcome to Empire Bowls Club.</p>
    <a className="intro-credit" href="/intro/artwork-credits.txt" target="_blank" rel="noreferrer">Artwork credits</a>
  </div>;
}
