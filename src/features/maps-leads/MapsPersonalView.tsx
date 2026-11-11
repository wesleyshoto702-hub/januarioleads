import {
  ArrowUpRight, BookmarkPlus, CheckCircle2, Compass, Layers, LoaderCircle,
  MapPin, Minus, Plus, Search, Star, X,
} from "lucide-react";
import {
  useCallback, useEffect, useMemo, useRef, useState, type FormEvent,
} from "react";
import { BRAZIL_STATES } from "../../lib/brazil-locations";
import { isLegacyWorkspaceOwner } from "../../lib/account-storage";
import { safeExternalHref } from "../../lib/safe-external-url";
import type { PersistedLead } from "../leads/remote-leads";
import type { BusinessAddResult } from "../search-leads/BusinessDetailsModal";
import { findBusinessDuplicate } from "../search-leads/identity";
import type { BusinessSearchResult } from "../search-leads/types";
import {
  DEFAULT_SEARCH_LOCATION, loadSearchLocation, saveSearchLocation,
  loadBrazilianMunicipalities, resolveMunicipality,
} from "../search-leads/search-location";
import { ALL_SEARCH_SEGMENTS, resolveSearchSegment } from "../search-leads/segments";
import { searchPersonalGeoapify, type PersonalGeoapifyPlace, type PersonalGooglePlace } from "./personal-geoapify";
import { buildMapPoints } from "./map-points";
import { RealGoogleMap } from "./RealGoogleMap";
import { KeylessInteractiveMap } from "./KeylessInteractiveMap";
import { canDisplayGooglePlaces, getBrowserGoogleMapsKey } from "./browser-map-key";

type ResultsProvider = "google" | "geoapify";
type SearchInput = {city:string;state:string;segment:string;neighborhood:string};
type ZoomAction = {id:number;delta:number};

function emptyBusiness(): BusinessSearchResult {
  return {
    placeId:"",name:"",primaryCategory:null,categories:[],description:null,
    address:null,neighborhood:null,city:null,state:null,phone:null,
    internationalPhone:null,rating:null,reviewCount:null,isOpenNow:null,
    openingHours:[],website:null,instagram:null,googleMapsUrl:null,
    businessStatus:null,latitude:null,longitude:null,
  };
}

/** Keep OSM IDs in provenance, never in the Google Place ID database field. */
function osmReference(id:string):string {
  return `Geoapify/OSM ID: ${id}`;
}
function osmBusiness(place:PersonalGeoapifyPlace):BusinessSearchResult {
  return {
    ...emptyBusiness(),
    placeId:"", name:place.name,
    primaryCategory:place.category, address:place.address,
    city:place.city, state:place.state,
    description:`Fonte: ${place.source==="osm"?"OpenStreetMap / Overpass":"Geoapify / OpenStreetMap"}. ${osmReference(place.sourceId)}. ${place.matchQuality==="related"||place.matchQuality==="name"?"Atividade não validada, conferir manualmente.":""}`,
    latitude:place.latitude, longitude:place.longitude,
  };
}

function personalGoogleBusiness(place:PersonalGooglePlace):BusinessSearchResult{
  return {...emptyBusiness(),
    placeId:place.placeId,name:place.name,address:place.address,
    city:place.city,state:place.state,googleMapsUrl:place.googleMapsUrl,
    latitude:place.latitude,longitude:place.longitude,
  };
}
function googleCrmBusiness(
  place:BusinessSearchResult,
  input:SearchInput,
):BusinessSearchResult {
  // Google allows long-term storage of Place IDs, not Google-sourced names.
  // Generate a useful distinct CRM label using only the user's niche/city
  // inputs plus an ID fragment, never any Google Places display fields.
  const label = [input.segment.slice(0,45),input.city.slice(0,45),
    "Ref. "+place.placeId.slice(-8)].join(" · ");
  return {
    ...emptyBusiness(),
    placeId:place.placeId,
    name:label,
    city:input.city,
    state:input.state,
  };
}

export function MapsPersonalView({
  existingLeads, onAddLead, displayMode="map", embedded=false,
}:{
  existingLeads:PersistedLead[];
  onAddLead:(business:BusinessSearchResult,segment:string)=>Promise<BusinessAddResult>;
  /** Only changes presentation. Switching list/map MUST NOT trigger a new API request. */
  displayMode?:"list"|"map";
  /** Unified Buscar Leads owns the page heading and search navigation. */
  embedded?:boolean;
}){
  const [initialLocation] = useState(() => typeof window==="undefined"
    ? DEFAULT_SEARCH_LOCATION : loadSearchLocation());
  const [city,setCity]=useState(initialLocation.city);
  const [state,setState]=useState(initialLocation.state);
  const [segment,setSegment]=useState("Barbearia");
  const [neighborhood,setNeighborhood]=useState("");
  const [searchPriority,setSearchPriority]=useState<"geoapify"|"google">("geoapify");
  const [municipalities,setMunicipalities]=useState<string[]>([]);
  const [municipalityState,setMunicipalityState]=useState("");
  const [googleResults,setGoogleResults]=useState<BusinessSearchResult[]>([]);
  const [geoResults,setGeoResults]=useState<PersonalGeoapifyPlace[]>([]);
  const [geoMatchMode,setGeoMatchMode]=useState<"category"|"name"|"related"|null>(null);
  const [resultProvider,setResultProvider]=useState<ResultsProvider|null>(null);
  const [selection,setSelection]=useState<string|null>(null);
  const [applied,setApplied]=useState<SearchInput|null>(null);
  const [savedIds,setSavedIds]=useState<string[]>([]);
  const [isLoading,setLoading]=useState(false);
  const [isSaving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [zoomAction,setZoomAction]=useState<ZoomAction>({id:0,delta:0});
  // A single optional site key enables Google Maps for everyone on the domain.
  // Without it, MapLibre/OpenFreeMap provides a real map without per-user keys.
  const browserKey=getBrowserGoogleMapsKey();
  const [googleUnavailable,setGoogleUnavailable]=useState(false);
  const requestLock=useRef(false);
  const saveLock=useRef(false);
  const listRef=useRef<HTMLOListElement>(null);

  useEffect(()=>{
    const controller=new AbortController();
    setMunicipalities([]);
    setMunicipalityState("");
    void loadBrazilianMunicipalities(state,controller.signal).then((list)=>{
      if(controller.signal.aborted)return;
      setMunicipalities(list);setMunicipalityState(state);
    }).catch(()=>{ if(!controller.signal.aborted){setMunicipalities([]);setMunicipalityState("");} });
    return ()=>controller.abort();
  },[state]);

  const selectedGoogle=useMemo(
    ()=>resultProvider==="google"?googleResults.find(item=>item.placeId===selection)??null:null,
    [resultProvider,googleResults,selection],
  );
  const selectedGeo=useMemo(
    ()=>resultProvider==="geoapify"?geoResults.find(item=>item.sourceId===selection)??null:null,
    [resultProvider,geoResults,selection],
  );

  const savedGoogleIds=useMemo(()=>new Set(googleResults
    .filter(place=>existingLeads.some(lead=>lead.placeId===place.placeId))
    .map(place=>place.placeId)),[googleResults,existingLeads]);
  const savedGeoIds=useMemo(()=>new Set(geoResults
    .filter(place=>existingLeads.some(lead =>
      lead.description?.includes(osmReference(place.sourceId)) ||
      Boolean(findBusinessDuplicate(osmBusiness(place),[lead]))
    ))
    .map(place=>place.sourceId)),[geoResults,existingLeads]);
  const savedInCrm=(id:string)=>savedIds.includes(id)||
    (resultProvider==="geoapify"?savedGeoIds.has(id):savedGoogleIds.has(id));

  const mapPoints=useMemo(()=>buildMapPoints(
    resultProvider,googleResults,geoResults,
  ),[resultProvider,googleResults,geoResults]);
  const count=resultProvider==="geoapify"?geoResults.length:googleResults.length;

  const choose=useCallback((id:string)=>{
    setSelection(id);
    const row=listRef.current?.querySelectorAll<HTMLButtonElement>("[data-marker-id]");
    const button=row&&Array.from(row).find(item=>item.dataset["markerId"]===id);
    button?.scrollIntoView({behavior:"smooth",block:"nearest"});
  },[]);

  async function runSearch(input:SearchInput){
    if(requestLock.current)return;
    if(!isLegacyWorkspaceOwner()){
      setError("Buscar via Maps pessoal está disponível somente para a conta original.");return;
    }
    const canonical=resolveSearchSegment(input.segment);
    if(!canonical){setError("Selecione um nicho válido, como Barbearia ou Academia.");return;}
    if(input.city.trim().length<2){setError("Informe um município brasileiro válido.");return;}
    if(municipalityState===input.state&&municipalities.length){
      const resolved=resolveMunicipality(input.city,municipalities);
      if(!resolved){setError("Escolha uma cidade válida da UF selecionada.");return;}
      input.city=resolved;
    }
    requestLock.current=true;
    // Invalidate the previous search before requesting another city/niche.
    // A failed or quota-limited request must never appear to return old places.
    setGeoResults([]);setGoogleResults([]);setResultProvider(null);setGeoMatchMode(null);
    setSelection(null);setApplied(null);setSavedIds([]);
    setLoading(true);setError("");
    try{
      // One owner-authenticated request, one daily claim. The Supabase Edge
      // Function orchestrates both providers and decides when a fallback is
      // necessary. Google billing never occurs for successful Geoapify-first
      // searches with confirmed matches.
      const result=await searchPersonalGeoapify({
        ...input,segment:canonical,priority:searchPriority,
      });
      if(!result.ok){
        setError(result.message);
        return;
      }
      if(!result.places.length){
        setError("Nenhuma empresa correspondente foi localizada nas fontes disponíveis. "+
          "A cobertura varia conforme nicho e município."+
          (result.fallbackNote?" "+result.fallbackNote:""));
        return;
      }
      if(result.provider==="google"){
        const list=result.places.map(personalGoogleBusiness);
        setGoogleResults(list);setGeoResults([]);setGeoMatchMode(null);
        setResultProvider("google");setSelection(list[0]?.placeId??null);
      }else{
        setGeoResults(result.places);setGoogleResults([]);
        setGeoMatchMode(result.matchMode);setResultProvider("geoapify");
        setSelection(result.places[0]?.sourceId??null);
      }
      setApplied({...input,segment:canonical});
      saveSearchLocation({city:input.city,state:input.state});
    }catch{
      setError("Não foi possível realizar a pesquisa agora. Tente novamente.");
    }finally{
      requestLock.current=false;setLoading(false);
    }
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void runSearch({city:city.trim(),state,segment:segment.trim(),neighborhood:neighborhood.trim()});
  }

  async function addLead(id:string){
    if(!applied||saveLock.current||savedInCrm(id))return;
    const geo=resultProvider==="geoapify"?geoResults.find(item=>item.sourceId===id):null;
    const google=resultProvider==="google"?googleResults.find(item=>item.placeId===id):null;
    if(!geo&&!google)return;
    const business=geo?osmBusiness(geo):googleCrmBusiness(google!,applied);
    saveLock.current=true;setSaving(true);setError("");
    try{
      const response=await onAddLead(business,applied.segment);
      if(!response.ok){setError(response.message);return;}
      setSavedIds(current=>current.includes(id)?current:[...current,id]);
    }catch{setError("Não foi possível salvar o lead no Supabase.");}
    finally{saveLock.current=false;setSaving(false);}
  }
  const titleCity=applied?`${applied.city} · ${applied.state}`:`${city} · ${state}`;
  const activeId=selection;
  const selected=selectedGoogle;
  const googleMapUrl=safeExternalHref(selected?.googleMapsUrl);
  const googleListOnly=resultProvider==="google"&&
    !canDisplayGooglePlaces(browserKey,googleUnavailable);
  const osmlink=selectedGeo?`https://www.openstreetmap.org/?mlat=${selectedGeo.latitude}&mlon=${selectedGeo.longitude}#map=16/${selectedGeo.latitude}/${selectedGeo.longitude}`:null;

  return (
    <section className={"bms-root saas-page"+(embedded?" bms-root--embedded":"")}
      aria-label={embedded?"Resultados da busca de empresas":undefined}
      aria-labelledby={embedded?undefined:"bms-heading"}>
      {!embedded&&<div className="bms-heading">
        <div>
          <div className="bms-eyebrow"><Compass size={14}/> EXPLORAÇÃO GEOGRÁFICA</div>
          <h1 id="bms-heading">Buscar <span>via Maps</span></h1>
          <p>Encontre estabelecimentos por nicho e município em todo o Brasil e adicione novos contatos ao seu CRM.</p>
        </div>
      </div>}
      <form className="bms-searchbar" onSubmit={submit}>
        <div className="bms-field bms-field--segment">
          <label htmlFor="bms-segment">O QUE VOCÊ PROCURA?</label>
          <div className="bms-field-entry"><Search size={18}/><input
            id="bms-segment" list="bms-niches" maxLength={120} required
            value={segment} onChange={e=>setSegment(e.target.value)}
            placeholder="Ex.: Barbearia" autoComplete="off"
          /></div>
          <datalist id="bms-niches">{ALL_SEARCH_SEGMENTS.map(item=>
            <option key={item} value={item}/>)}</datalist>
        </div>
        <div className="bms-field bms-field--city">
          <label htmlFor="bms-city">CIDADE</label>
          <div className="bms-field-entry"><MapPin size={17}/><input
            id="bms-city" list="bms-brazil-cities" maxLength={80} required
            value={city} onChange={e=>setCity(e.target.value)}
            placeholder="Ex.: Lavras" autoComplete="off"/></div>
          <datalist id="bms-brazil-cities">{(municipalityState===state?municipalities:[]).map(item=>
            <option key={item} value={item}/>)}</datalist>
        </div>
        <div className="bms-field bms-field--state">
          <label htmlFor="bms-state">UF</label>
          <select id="bms-state" value={state} onChange={e=>{
            setState(e.target.value);setCity("");setNeighborhood("");
          }}>{BRAZIL_STATES.map(item=><option key={item.code} value={item.code}>{item.code}</option>)}</select>
        </div>
        <div className="bms-field bms-field--neighborhood">
          <label htmlFor="bms-neighborhood">BAIRRO <span>(OPCIONAL)</span></label>
          <input id="bms-neighborhood" value={neighborhood} maxLength={80}
            onChange={e=>setNeighborhood(e.target.value)} placeholder="Ex.: Centro"/>
        </div>
        <button className="bms-submit" type="submit" disabled={isLoading}>
          {isLoading?<LoaderCircle className="bms-spin" size={17}/>:<Search size={17}/>}
          {isLoading?"Buscando...":"Buscar no mapa"}
        </button>
      </form>
      <div className="bms-source-choice">
        <label htmlFor="bms-source-priority">ORDEM DAS FONTES</label>
        <select id="bms-source-priority" value={searchPriority}
          onChange={event=>setSearchPriority(event.target.value==="google"?"google":"geoapify")}
          disabled={isLoading}>
          <option value="geoapify">Automático · Geoapify primeiro, Google se necessário</option>
          <option value="google">Google primeiro · Geoapify como alternativa</option>
        </select>
        <span>O Google Places pode gerar cobrança quando consultado. O limite diário do Januário Leads está temporariamente pausado para testes. Google Places pode gerar cobranças.</span>
      </div>
      <div className="bms-meta">
        <span><Layers size={15}/> {applied?`${count} empresas encontradas`:"Escolha um nicho e uma região"}</span>
      </div>
      {error&&<p className="bms-alert" role="alert">{error}</p>}
      {resultProvider==="geoapify"&&geoMatchMode==="related"&&
        <p className="bms-source-hint" role="status">Foram localizados estabelecimentos de uma categoria relacionada, mas a atividade exata não foi confirmada. Confira cada empresa antes de adicionar ao CRM.</p>}
      {resultProvider==="geoapify"&&geoMatchMode==="name"&&
        <p className="bms-source-hint" role="status">Resultados encontrados pela correspondência de nome na base aberta. A cobertura pode ser parcial e a atividade deve ser confirmada antes da prospecção.</p>}
      <div className={"bms-layout"+(displayMode==="list"?" bms-layout--list":"")}>
        {displayMode==="map"&&<div className="bms-map-frame">
          {resultProvider==="google"
            ? googleListOnly
              ? <div className="bms-google-list-panel" role="region"
                  aria-label="Resultados do Google Places sem mapa">
                  <div className="bms-google-list-brand">
                    <a href="https://www.google.com/maps" target="_blank"
                       rel="noopener noreferrer">Google Maps</a>
                  </div>
                  <h2>{applied?.segment??"Estabelecimentos"} · {titleCity}</h2>
                  <p>{count} estabelecimentos encontrados pelo Google Places.
                    Selecione uma empresa na lista à direita para ver os detalhes.</p>
                  <p>Para respeitar os termos de uso, esses resultados não são posicionados
                     sobre o mapa OpenStreetMap.</p>
                </div>
              : <RealGoogleMap key={browserKey} browserKey={browserKey}
                  points={mapPoints} selectedId={activeId}
                  onSelect={choose} zoomAction={zoomAction}
                  onUnavailable={()=>{
                    // Keep Google data in the attributed list; never plot it
                    // on a map provided by OpenFreeMap.
                    setGoogleUnavailable(true);
                  }}/>
            : <KeylessInteractiveMap
                points={resultProvider==="geoapify"?mapPoints:[]}
                selectedId={resultProvider==="geoapify"?activeId:null}
                onSelect={choose} zoomAction={zoomAction}/>}
          {!googleListOnly&&<div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{applied?titleCity:"Brasil · mapa real"}</div>
            <p>{applied?`${count} empresas retornadas · ${applied.segment}`:"Pesquise por nicho e município"}</p>
          </div>}
          {!googleListOnly&&<div className="bms-map-controls" aria-label="Controles do mapa">
            <button type="button" aria-label="Ampliar mapa"
              onClick={()=>setZoomAction(prev=>({id:prev.id+1,delta:1}))}><Plus size={20}/></button>
            <span>ZOOM</span>
            <button type="button" aria-label="Reduzir mapa"
              onClick={()=>setZoomAction(prev=>({id:prev.id+1,delta:-1}))}><Minus size={20}/></button>
          </div>}

          {selected&&<article className="bms-business-card" aria-label={"Empresa selecionada: "+selected.name}>
            <button type="button" className="bms-business-close" aria-label="Fechar detalhes do lead"
              onClick={()=>setSelection(null)}><X size={17}/></button>
            <div className="bms-business-top">
              <span className="bms-business-icon"><MapPin size={23}/></span>
              <div className="bms-business-title">
                <span>{selected.primaryCategory??applied?.segment??"EMPRESA"} · GOOGLE MAPS</span>
                <h2>{selected.name}</h2>
              </div>
              <span className="bms-business-counter">
                #{googleResults.findIndex(item=>item.placeId===selection)+1}
              </span>
            </div>
            <p className="bms-business-address"><MapPin size={15}/>{selected.address||titleCity}</p>
            {savedInCrm(selected.placeId)&&<span className="bms-saved-label">Lead já adicionado</span>}
            <div className="bms-business-details">
              {selected.rating!=null&&<span><Star size={15}/>{selected.rating.toFixed(1)}</span>}
              {selected.phone&&<span>Telefone: {selected.phone}</span>}
              {googleMapUrl&&<a href={googleMapUrl} target="_blank" rel="noopener noreferrer">
                Abrir Google Maps <ArrowUpRight size={13}/></a>}
            </div>
            {!savedInCrm(selected.placeId)&&<button className="bms-save" type="button"
              disabled={isSaving}
              onClick={()=>void addLead(selected.placeId)}>
              <BookmarkPlus size={17}/>{isSaving?"Adicionando...":"Adicionar lead"}
            </button>}
          </article>}
          {selectedGeo&&<article className="bms-business-card" aria-label={"Estabelecimento: "+selectedGeo.name}>
            <button type="button" className="bms-business-close" aria-label="Fechar detalhes do lead"
              onClick={()=>setSelection(null)}><X size={17}/></button>
            <div className="bms-business-top">
              <span className="bms-business-icon"><MapPin size={23}/></span>
              <div className="bms-business-title">
                <span>{applied?.segment??"ESTABELECIMENTO"} · {selectedGeo.matchQuality==="related"?"ATIVIDADE A CONFERIR":selectedGeo.matchQuality==="name"?"NOME COMPATÍVEL":selectedGeo.source==="osm"?"OPENSTREETMAP":"GEOAPIFY / OSM"}</span>
                <h2>{selectedGeo.name}</h2>
              </div>
              <span className="bms-business-counter">
                #{geoResults.findIndex(item=>item.sourceId===selection)+1}
              </span>
            </div>
            <p className="bms-business-address"><MapPin size={15}/>{selectedGeo.address||titleCity}</p>
            {osmlink&&<div className="bms-business-details"><a href={osmlink}
              target="_blank" rel="noopener noreferrer">Ver no OpenStreetMap <ArrowUpRight size={13}/></a></div>}
            <p className="bms-readonly">Fonte: {selectedGeo.source==="osm"?"OpenStreetMap / Overpass":"Geoapify"} · © OpenStreetMap contributors. Complete contatos manualmente no CRM, se necessário.</p>
            <button type="button" className="bms-save" disabled={isSaving||savedInCrm(selectedGeo.sourceId)}
              onClick={()=>void addLead(selectedGeo.sourceId)}>
              {savedInCrm(selectedGeo.sourceId)?<CheckCircle2 size={17}/>:<BookmarkPlus size={17}/>}
              {savedInCrm(selectedGeo.sourceId)?"Lead já adicionado":isSaving?"Adicionando...":"Adicionar lead"}
            </button>
          </article>}
        </div>}
        <aside className="bms-results" aria-label="Empresas encontradas na pesquisa">
          <div className="bms-results-head">
            <div><span>RESULTADOS</span><h2>Empresas encontradas</h2></div>
            <span className="bms-results-count">{count}</span>
          </div>
          <p className="bms-provider-attribution">
            {resultProvider==="geoapify"?<>
              {geoResults[0]?.source==="osm"?"Fonte: OpenStreetMap / Overpass":<a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a>}
              {" · "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
            </>:resultProvider==="google"?<a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">Fonte: Google Maps · consulta individual</a>:"Fonte automática definida na pesquisa"}
          </p>
          {displayMode==="list"&&selectedGoogle&&<div className="bms-list-selected" role="region"
            aria-label={"Detalhes de "+selectedGoogle.name}>
            <div className="bms-list-selected-details">
              <span className="bms-list-selected-label">GOOGLE MAPS · EMPRESA SELECIONADA</span>
              <strong>{selectedGoogle.name}</strong>
              <span>{selectedGoogle.address??titleCity}</span>
              {googleMapUrl&&<a href={googleMapUrl} target="_blank" rel="noopener noreferrer">
                Ver no Google Maps <ArrowUpRight size={13}/>
              </a>}
            </div>
            <button type="button" className="bms-save"
              onClick={()=>void addLead(selectedGoogle.placeId)}
              disabled={isSaving||savedInCrm(selectedGoogle.placeId)}>
              {savedInCrm(selectedGoogle.placeId)?"Lead já adicionado":isSaving?"Salvando...":"Adicionar ao CRM"}
            </button>
          </div>}
          {displayMode==="list"&&selectedGeo&&<div className="bms-list-selected" role="region"
            aria-label={"Detalhes de "+selectedGeo.name}>
            <div className="bms-list-selected-details">
              <span className="bms-list-selected-label">
                {selectedGeo.source==="osm"?"OPENSTREETMAP":"GEOAPIFY"} · EMPRESA SELECIONADA
              </span>
              <strong>{selectedGeo.name}</strong>
              <span>{selectedGeo.address??titleCity}</span>
              {osmlink&&<a href={osmlink} target="_blank" rel="noopener noreferrer">
                Ver no OpenStreetMap <ArrowUpRight size={13}/>
              </a>}
            </div>
            <button type="button" className="bms-save"
              onClick={()=>void addLead(selectedGeo.sourceId)}
              disabled={isSaving||savedInCrm(selectedGeo.sourceId)}>
              {savedInCrm(selectedGeo.sourceId)?"Lead já adicionado":isSaving?"Salvando...":"Adicionar ao CRM"}
            </button>
          </div>}
          {count===0?<div className="bms-no-results">
            <MapPin size={32}/>
            <strong>{applied?"Nenhuma empresa encontrada":"Seu próximo cliente pode estar aqui"}</strong>
            <p>{applied?"Tente outro bairro, nicho ou município.":"Pesquise Barbearia, Academia, Restaurante ou outro nicho."}</p>
          </div>:<ol className="bms-results-list" ref={listRef}>
            {(resultProvider==="google"?googleResults.map(item=>({
              id:item.placeId,name:item.name,address:item.address??titleCity,
              sub:item.website?"Site identificado":"Google Places",
            })):geoResults.map(item=>({
              id:item.sourceId,name:item.name,address:item.address??titleCity,
              sub:item.matchQuality==="related"?"Serviço relacionado · confirmar atividade":item.matchQuality==="name"?"Nome compatível · confirmar atividade":item.source==="osm"?"OpenStreetMap / Overpass":"Geoapify / OpenStreetMap",
            }))).map((item,index)=><li key={item.id} className="bms-result-row">
              <button type="button"
                className={selection===item.id?"bms-result selected":"bms-result"}
                data-marker-id={item.id} onClick={()=>choose(item.id)}>
                <span className="bms-result-index">{index+1}</span>
                <span className="bms-result-text">
                  <strong>{item.name}</strong><small>{item.address}</small>
                  {savedInCrm(item.id)&&<span className="bms-saved-inline">Lead já adicionado</span>}
                  <em>{item.sub}</em>
                </span>
              </button>
              <button type="button" className="bms-result-add"
                aria-label={"Adicionar lead: "+item.name}
                disabled={isSaving||savedInCrm(item.id)}
                onClick={()=>void addLead(item.id)}>
                {savedInCrm(item.id)?<><CheckCircle2 size={14}/> Já adicionado</>
                  :<><BookmarkPlus size={14}/> Adicionar lead</>}
              </button>
            </li>)}
          </ol>}
        </aside>
      </div>
    </section>
  );
}
