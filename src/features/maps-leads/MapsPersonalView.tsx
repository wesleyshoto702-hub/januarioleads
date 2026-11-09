import {
  ArrowUpRight, BookmarkPlus, CheckCircle2, Compass, Layers, LoaderCircle,
  MapPin, Minus, Plus, Search, Star, X,
} from "lucide-react";
import {
  useCallback, useEffect, useMemo, useRef, useState, type FormEvent,
} from "react";
import { BRAZIL_STATES } from "../../lib/brazil-locations";
import { accountLocalStorage, isLegacyWorkspaceOwner } from "../../lib/account-storage";
import { safeExternalHref } from "../../lib/safe-external-url";
import type { PersistedLead } from "../leads/remote-leads";
import type { BusinessAddResult } from "../search-leads/BusinessDetailsModal";
import { findBusinessDuplicate } from "../search-leads/identity";
import { searchBusinesses } from "../search-leads/search-businesses";
import type { BusinessSearchResult } from "../search-leads/types";
import {
  DEFAULT_SEARCH_LOCATION, loadSearchLocation, saveSearchLocation,
  loadBrazilianMunicipalities, resolveMunicipality,
} from "../search-leads/search-location";
import { ALL_SEARCH_SEGMENTS, resolveSearchSegment } from "../search-leads/segments";
import { searchPersonalGeoapify, type PersonalGeoapifyPlace } from "./personal-geoapify";
import { buildMapPoints } from "./map-points";
import { ENV_GOOGLE_MAPS_BROWSER_KEY, RealGoogleMap } from "./RealGoogleMap";

const MAP_KEY_STORAGE = "maps-personal-browser-api-key";
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
    description:`Fonte: Geoapify / OpenStreetMap. ${osmReference(place.sourceId)}.`,
    latitude:place.latitude, longitude:place.longitude,
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

function normalize(value:string):string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function googleKeyFromBrowser():string {
  if (typeof window==="undefined") return ENV_GOOGLE_MAPS_BROWSER_KEY;
  try {return accountLocalStorage.getItem(MAP_KEY_STORAGE)?.trim()||ENV_GOOGLE_MAPS_BROWSER_KEY;}
  catch {return ENV_GOOGLE_MAPS_BROWSER_KEY;}
}

export function MapsPersonalView({
  existingLeads, onAddLead,
}:{
  existingLeads:PersistedLead[];
  onAddLead:(business:BusinessSearchResult,segment:string)=>Promise<BusinessAddResult>;
}){
  const [initialLocation] = useState(() => typeof window==="undefined"
    ? DEFAULT_SEARCH_LOCATION : loadSearchLocation());
  const [city,setCity]=useState(initialLocation.city);
  const [state,setState]=useState(initialLocation.state);
  const [segment,setSegment]=useState("Barbearia");
  const [neighborhood,setNeighborhood]=useState("");
  const [municipalities,setMunicipalities]=useState<string[]>([]);
  const [municipalityState,setMunicipalityState]=useState("");
  const [googleResults,setGoogleResults]=useState<BusinessSearchResult[]>([]);
  const [geoResults,setGeoResults]=useState<PersonalGeoapifyPlace[]>([]);
  const [resultProvider,setResultProvider]=useState<ResultsProvider|null>(null);
  const [selection,setSelection]=useState<string|null>(null);
  const [applied,setApplied]=useState<SearchInput|null>(null);
  const [savedIds,setSavedIds]=useState<string[]>([]);
  const [isLoading,setLoading]=useState(false);
  const [isSaving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [zoomAction,setZoomAction]=useState<ZoomAction>({id:0,delta:0});
  // Existing device key remains supported while public deployments can inject
  // a site-restricted VITE_GOOGLE_MAPS_BROWSER_KEY at build time.
  const [browserKey]=useState(googleKeyFromBrowser);
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
    const button=row&&Array.from(row).find(item=>item.dataset.markerId===id);
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
    setGeoResults([]);setGoogleResults([]);setResultProvider(null);
    setSelection(null);setApplied(null);setSavedIds([]);
    setLoading(true);setError("");
    try{
      // Automatic: Geoapify first for supported OSM categories; a separate
      // authenticated Google Places query only if no valid OSM match.
      const geo=await searchPersonalGeoapify({...input,segment:canonical});
      if(geo.ok&&geo.places.length){
        setGeoResults(geo.places);setGoogleResults([]);
        setResultProvider("geoapify");setSelection(geo.places[0]?.sourceId??null);
        setApplied({...input,segment:canonical});
        saveSearchLocation({city:input.city,state:input.state});
        return;
      }
      if(!geo.ok&&geo.code==="QUOTA"){
        setError(geo.message+". A busca automática foi interrompida para proteger o orçamento das APIs.");
        return;
      }
      // This can trigger a separate provider-billed search; Google has an
      // existing server-side per-account budget/rate-limiting circuit breaker.
      const google=await searchBusinesses({city:input.city,state:input.state,segment:canonical});
      if(!google.ok){setError(google.message);return;}
      let results=google.results;
      if(input.neighborhood.trim()){
        const n=normalize(input.neighborhood);
        results=results.filter(place=>
          normalize(place.neighborhood??"").includes(n)||
          normalize(place.address??"").includes(n)
        );
      }
      setGeoResults([]);setGoogleResults(results);
      setResultProvider("google");setSelection(results[0]?.placeId??null);
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
  const osmlink=selectedGeo?`https://www.openstreetmap.org/?mlat=${selectedGeo.latitude}&mlon=${selectedGeo.longitude}#map=16/${selectedGeo.latitude}/${selectedGeo.longitude}`:null;

  return (
    <section className="bms-root saas-page" aria-labelledby="bms-heading">
      <div className="bms-heading">
        <div>
          <div className="bms-eyebrow"><Compass size={14}/> EXPLORAÇÃO GEOGRÁFICA</div>
          <h1 id="bms-heading">Buscar <span>via Maps</span></h1>
          <p>Encontre estabelecimentos por nicho e município em todo o Brasil e adicione novos contatos ao seu CRM.</p>
        </div>
      </div>
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
      <div className="bms-meta">
        <span><Layers size={15}/> {applied?`${count} empresas encontradas`:"Escolha um nicho e uma região"}</span>
      </div>
      {error&&<p className="bms-alert" role="alert">{error}</p>}
      <div className="bms-layout">
        <div className="bms-map-frame">
          {browserKey
            ? <RealGoogleMap key={browserKey} browserKey={browserKey}
              points={mapPoints} selectedId={activeId}
              onSelect={choose} zoomAction={zoomAction}/>
            : <div className="bms-map-placeholder" role="status">
              <MapPin size={34}/>
              <strong>Mapa temporariamente indisponível</strong>
              <p>Você ainda pode consultar as empresas encontradas na lista de resultados.</p>
            </div>}
          <div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{applied?titleCity:"Brasil · mapa real"}</div>
            <p>{applied?`${count} empresas retornadas · ${applied.segment}`:"Pesquise por nicho e município"}</p>
          </div>
          {browserKey&&<div className="bms-map-controls" aria-label="Controles do mapa">
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
                <span>{selectedGeo.category??"ESTABELECIMENTO"} · GEOAPIFY / OSM</span>
                <h2>{selectedGeo.name}</h2>
              </div>
              <span className="bms-business-counter">
                #{geoResults.findIndex(item=>item.sourceId===selection)+1}
              </span>
            </div>
            <p className="bms-business-address"><MapPin size={15}/>{selectedGeo.address||titleCity}</p>
            {osmlink&&<div className="bms-business-details"><a href={osmlink}
              target="_blank" rel="noopener noreferrer">Ver no OpenStreetMap <ArrowUpRight size={13}/></a></div>}
            <p className="bms-readonly">Fonte: Geoapify · © OpenStreetMap contributors. Complete contatos manualmente no CRM, se necessário.</p>
            <button type="button" className="bms-save" disabled={isSaving||savedInCrm(selectedGeo.sourceId)}
              onClick={()=>void addLead(selectedGeo.sourceId)}>
              {savedInCrm(selectedGeo.sourceId)?<CheckCircle2 size={17}/>:<BookmarkPlus size={17}/>}
              {savedInCrm(selectedGeo.sourceId)?"Lead já adicionado":isSaving?"Adicionando...":"Adicionar lead"}
            </button>
          </article>}
        </div>
        <aside className="bms-results" aria-label="Empresas encontradas no mapa">
          <div className="bms-results-head">
            <div><span>RESULTADOS</span><h2>Empresas encontradas</h2></div>
            <span className="bms-results-count">{count}</span>
          </div>
          <p className="bms-provider-attribution">
            {resultProvider==="geoapify"?<>
              <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a>
              {" · "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
            </>:resultProvider==="google"?"Fonte: Google Maps · consulta individual":"Fonte automática definida na pesquisa"}
          </p>
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
              sub:"Geoapify / OpenStreetMap",
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
