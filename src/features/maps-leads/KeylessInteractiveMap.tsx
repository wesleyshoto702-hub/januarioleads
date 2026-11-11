import { MapPin, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RealMapPoint } from "./map-points";

/**
 * Real, keyless interactive map: MapLibre GL JS with OpenFreeMap vector tiles.
 * No Google Maps key, no Supabase token, and no places API is used by the basemap.
 * The optional Google engine is still preferred when configured by the site owner.
 *
 * A pinned CDN build is used so the current Bun lockfile is not rewritten by
 * hand; a self-hosted MapLibre bundle/tiles is the future high-scale option.
 */
const SDK_URLS = [
  "https://cdn.jsdelivr.net/npm/maplibre-gl@6.17.0/dist/maplibre-gl.mjs",
  "https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.mjs",
] as const;
const CSS_URLS = [
  "https://cdn.jsdelivr.net/npm/maplibre-gl@6.17.0/dist/maplibre-gl.css",
  "https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.css",
] as const;
const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/dark";
const BRAZIL_CENTER: [number, number] = [-51.9253, -14.235];
const STYLE_URL = (() => {
  const configured = (import.meta.env["VITE_MAP_STYLE_URL"] as string | undefined)?.trim();
  if (!configured) return DEFAULT_STYLE;
  try { return new URL(configured).protocol === "https:" ? configured : DEFAULT_STYLE; }
  catch { return DEFAULT_STYLE; }
})();

type MapLike = {
  once: (event: string, callback: () => void) => void;
  on: (event: string, callback: () => void) => void;
  remove: () => void;
  resize: () => void;
  getZoom: () => number;
  zoomTo: (level: number, options?: Record<string, unknown>) => void;
  easeTo: (options: Record<string, unknown>) => void;
  fitBounds: (bounds: [[number,number],[number,number]], options: Record<string, unknown>) => void;
};
type MarkerLike = {
  setLngLat: (lnglat:[number,number]) => MarkerLike;
  addTo: (map:MapLike) => MarkerLike;
  remove: () => void;
};
type MapLibreSdk = {
  Map: new (options: Record<string, unknown>) => MapLike;
  Marker: new (options: Record<string, unknown>) => MarkerLike;
};
let cachedSdk:Promise<MapLibreSdk>|null=null;
function loadMapLibre():Promise<MapLibreSdk>{
  if (!cachedSdk) {
    cachedSdk = (async()=>{
      // Fixed, version-pinned CDNs; no user-provided script URLs are accepted.
      // Vite must leave the browser-only import intact for SSR-safe loading.
      for (const url of SDK_URLS) {
        try {
          const sdk = await import(/* @vite-ignore */ url) as MapLibreSdk;
          if(typeof sdk?.Map==="function"&&typeof sdk?.Marker==="function")return sdk;
        } catch { /* CDN unavailable; retry from the secondary mirror. */ }
      }
      throw new Error("A biblioteca do mapa não está disponível.");
    })().catch((error:unknown)=>{cachedSdk=null;throw error;});
  }
  return cachedSdk;
}
function ensureMapCss(){
  if(document.querySelector('link[data-jl-maplibre-css]'))return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href=CSS_URLS[0];
  link.onerror=()=>{if(link.href!==CSS_URLS[1])link.href=CSS_URLS[1];};
  link.setAttribute("data-jl-maplibre-css","");
  document.head.appendChild(link);
}
function isPointValid(point:RealMapPoint):boolean{
  return Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&
    Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180;
}
function escapeSelectedIframe(points:RealMapPoint[],selectedId:string|null,zoomOffset:number):string{
  const point=points.find(x=>x.id===selectedId&&isPointValid(x))??points.find(isPointValid);
  const lon=point?.lng??BRAZIL_CENTER[0];
  const lat=point?.lat??BRAZIL_CENTER[1];
  const spread=(point?0.045:22)/Math.pow(2,zoomOffset);
  const south=Math.max(-85,lat-spread), north=Math.min(85,lat+spread);
  const west=Math.max(-180,lon-spread), east=Math.min(180,lon+spread);
  const url=new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set("bbox",[west,south,east,north].join(","));
  url.searchParams.set("layer","mapnik");
  if(point)url.searchParams.set("marker",point.lat+","+point.lng);
  return url.toString();
}
export function KeylessInteractiveMap({
  points,selectedId,onSelect,zoomAction,
}:{
  points:RealMapPoint[];
  selectedId:string|null;
  onSelect:(id:string)=>void;
  zoomAction:{id:number;delta:number};
}){
  const canvas=useRef<HTMLDivElement>(null);
  const map=useRef<MapLike|null>(null);
  const sdk=useRef<MapLibreSdk|null>(null);
  const markers=useRef<MarkerLike[]>([]);
  const callback=useRef(onSelect);
  const [mode,setMode]=useState<"loading"|"ready"|"fallback">("loading");
  const [retry,setRetry]=useState(0);
  const [fallbackZoom,setFallbackZoom]=useState(0);
  const [message,setMessage]=useState("");
  useEffect(()=>{callback.current=onSelect;},[onSelect]);

  useEffect(()=>{
    let alive=true;
    let failureCount=0;
    let timeout:number|undefined;
    let observer:ResizeObserver|undefined;
    setMode("loading");setMessage("");
    ensureMapCss();
    const start=async()=>{
      try{
        const lib=await loadMapLibre();
        if(!alive||!canvas.current)return;
        const instance=new lib.Map({
          container:canvas.current,
          style:STYLE_URL,
          center:BRAZIL_CENTER,
          zoom:3.65,
          minZoom:2.5,
          maxZoom:19,
          attributionControl:true,
          locale:{"AttributionControl.ToggleAttribution":"Mostrar atribuições"},
          dragRotate:false,
          touchPitch:false,
        });
        map.current=instance;
        sdk.current=lib;
        if(typeof ResizeObserver!=="undefined"){
          observer=new ResizeObserver(()=>{if(alive)instance.resize();});
          observer.observe(canvas.current);
        }
        instance.once("load",()=>{
          if(!alive)return;
          if(timeout!==undefined)window.clearTimeout(timeout);
          setMode("ready");
        });
        instance.on("error",()=>{
          if(!alive||!timeout)return;
          failureCount++;
          if(failureCount<3)return;
          window.clearTimeout(timeout);
          setMessage("O servidor do mapa não respondeu. Exibindo visualização alternativa.");
          setMode("fallback");
          observer?.disconnect();
          instance.remove();map.current=null;sdk.current=null;
        });
        // CSP, tile services or WebGL may fail without a usable error event.
        timeout=window.setTimeout(()=>{
          if(!alive)return;
          setMessage("Mapa vetorial indisponível. Exibindo visualização alternativa.");
          setMode("fallback");
          observer?.disconnect();
          instance.remove();map.current=null;sdk.current=null;
        },14000);
      }catch{
        if(!alive)return;
        setMessage("O mapa vetorial não carregou; usando visualização alternativa.");
        setMode("fallback");
      }
    };
    void start();
    return ()=>{
      alive=false;
      if(timeout!==undefined)window.clearTimeout(timeout);
      observer?.disconnect();
      for(const marker of markers.current)marker.remove();
      markers.current=[];
      map.current?.remove();map.current=null;sdk.current=null;
    };
  },[retry]);

  useEffect(()=>{
    if(mode!=="ready"||!sdk.current||!map.current)return;
    for(const marker of markers.current)marker.remove();
    markers.current=[];
    const instance=map.current;
    const lib=sdk.current;
    const valid=points.filter(isPointValid);
    valid.forEach(point=>{
      const pin=document.createElement("button");
      pin.type="button";
      pin.className="bms-keyless-pin"+(point.id===selectedId?" is-active":"");
      const label=document.createElement("span");
      label.textContent=String(point.listIndex).padStart(2,"0");
      pin.appendChild(label);
      pin.title=point.name;
      pin.dataset.markerId=point.id;
      pin.setAttribute("aria-label","Selecionar empresa "+point.listIndex+": "+point.name);
      pin.addEventListener("click",()=>callback.current(point.id));
      // MapLibre sets positioning transforms on its root DOM element.
      // Keep our rotated pin inside a distinct wrapper so it isn't overwritten.
      const root=document.createElement("div");
      root.className="bms-keyless-marker";
      root.appendChild(pin);
      const marker=new lib.Marker({element:root,anchor:"bottom"})
        .setLngLat([point.lng,point.lat]).addTo(instance);
      markers.current.push(marker);
    });
    if(valid.length===1){
      const p=valid[0]!;
      instance.easeTo({center:[p.lng,p.lat],zoom:14,duration:650});
    }else if(valid.length>1){
      const west=Math.min(...valid.map(p=>p.lng));
      const south=Math.min(...valid.map(p=>p.lat));
      const east=Math.max(...valid.map(p=>p.lng));
      const north=Math.max(...valid.map(p=>p.lat));
      instance.fitBounds([[west,south],[east,north]],{padding:75,maxZoom:14,duration:650});
    }else{
      instance.easeTo({center:BRAZIL_CENTER,zoom:3.65,duration:450});
    }
    return ()=>{for(const marker of markers.current)marker.remove();markers.current=[];};
    // Marker selection is handled separately to avoid resetting the user's zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[points,mode]);

  useEffect(()=>{
    if(mode!=="ready"||!map.current)return;
    const point=points.find(x=>x.id===selectedId&&isPointValid(x));
    canvas.current?.querySelectorAll(".bms-keyless-pin").forEach(el=>{
      el.classList.toggle("is-active",el.getAttribute("data-marker-id")===selectedId);
    });
    if(point)map.current.easeTo({center:[point.lng,point.lat],duration:440});
  },[points,selectedId,mode]);

  useEffect(()=>{
    if(!zoomAction.id)return;
    if(mode==="fallback"){
      setFallbackZoom(level=>Math.max(-2,Math.min(7,level+zoomAction.delta)));
      return;
    }
    if(mode!=="ready"||!map.current)return;
    const current=map.current.getZoom();
    map.current.zoomTo(Math.max(2.5,Math.min(19,current+zoomAction.delta)),{duration:250});
  },[zoomAction,mode]);

  return <div className="bms-real-google-map bms-keyless-map">
    <div className="bms-google-map" ref={canvas} role="region"
      aria-label="Mapa interativo de ruas reais com marcadores dos estabelecimentos encontrados"/>
    {mode==="loading"&&<div className="bms-map-loading" role="status">
      <MapPin size={28}/><strong>Carregando mapa interativo...</strong>
      <p>Preparando ruas e bairros com dados cartográficos reais.</p>
    </div>}
    {mode==="fallback"&&<div className="bms-map-osm-fallback" role="status">
      <iframe title="Mapa geográfico alternativo do OpenStreetMap"
        src={escapeSelectedIframe(points,selectedId,fallbackZoom)} loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"/>
      <div className="bms-map-fallback-note">
        <span>{message} Selecione empresas na lista para centralizar o marcador.</span>
        <button type="button" onClick={()=>setRetry(x=>x+1)}>
          <RotateCcw size={14}/> Tentar mapa completo
        </button>
      </div>
    </div>}
    <div className="bms-keyless-attribution">Mapa © OpenStreetMap contributors · OpenFreeMap</div>
  </div>;
}
