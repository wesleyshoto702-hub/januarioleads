import {
  ArrowUpRight,
  BookmarkPlus,
  CheckCircle2,
  Compass,
  Layers3,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BRAZIL_STATES } from "../../lib/brazil-locations";
import { safeExternalHref } from "../../lib/safe-external-url";
import type { PersistedLead } from "../leads/remote-leads";
import type { BusinessAddResult } from "../search-leads/BusinessDetailsModal";
import { findBusinessDuplicate, findSavedBusinessMatch } from "../search-leads/identity";
import { searchBusinesses } from "../search-leads/search-businesses";
import { searchAutomaticMaps, type GeoapifyPreview } from "./geoapify-client";
import { loadMapPlaceDetails } from "./map-place-details";
import { buildMapPoints } from "./map-points";
import { RealGoogleMap } from "./RealGoogleMap";
import {
  DEFAULT_SEARCH_LOCATION,
  loadSearchLocation,
  loadBrazilianMunicipalities,
  resolveMunicipality,
  saveSearchLocation,
  withSearchLocation,
  type SearchLocation,
} from "../search-leads/search-location";
import { ALL_SEARCH_SEGMENTS, resolveSearchSegment } from "../search-leads/segments";
import {
  SAAS_STAGING_ACTIVE,
  loadMySaasUsage,
  type SaasUsage,
} from "../search-leads/saas-usage";
import type { BusinessSearchResult } from "../search-leads/types";

const GOOGLE_BROWSER_KEY = (import.meta.env["VITE_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined)?.trim() ?? "";

type SearchValues = SearchLocation & { segment: string; neighborhood: string };
type MapsProvider = "geoapify" | "google";
type MapZoomAction = { id: number; delta: number };

export function MapsLeadsView({
  existingLeads,
  onAddLead,
}: {
  existingLeads: PersistedLead[];
  onAddLead: (business: BusinessSearchResult, segment: string) => Promise<BusinessAddResult>;
}) {
  const [location] = useState(() => typeof window === "undefined" ? DEFAULT_SEARCH_LOCATION : loadSearchLocation());
  const [city, setCity] = useState(location.city);
  const [state, setState] = useState(location.state);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalitiesState, setMunicipalitiesState] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [segment, setSegment] = useState("Barbearia");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applied, setApplied] = useState<SearchValues | null>(null);
  const [appliedProvider, setAppliedProvider] = useState<MapsProvider | null>(null);
  const [geoResults, setGeoResults] = useState<GeoapifyPreview[]>([]);
  const [selectedGeoId, setSelectedGeoId] = useState<string | null>(null);
  const [usage, setUsage] = useState<SaasUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [googleCrmName, setGoogleCrmName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [zoomAction, setZoomAction] = useState<MapZoomAction>({ id: 0, delta: 0 });
  const resultList = useRef<HTMLOListElement>(null);
  const busy = useRef(false);

  // IBGE municipality suggestions are loaded for the selected UF only. If
  // the official service is unavailable, manual city entry still works.
  useEffect(() => {
    const controller = new AbortController();
    setMunicipalities([]);
    setMunicipalitiesState("");
    void loadBrazilianMunicipalities(state, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setMunicipalities(items);
      setMunicipalitiesState(state);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setMunicipalities([]);
        setMunicipalitiesState("");
      }
    });
    return () => controller.abort();
  }, [state]);

  useEffect(() => {
    let live = true;
    void loadMySaasUsage().then((next) => { if (live) setUsage(next); });
    return () => { live = false; };
  }, []);

  const selected = useMemo(
    () => results.find((item) => item.placeId === selectedId) ?? null,
    [results, selectedId],
  );
  const selectedGeo = useMemo(
    () => geoResults.find((item) => item.sourceId === selectedGeoId) ?? null,
    [geoResults, selectedGeoId],
  );
  // The CRM is shared across both entry points. Google and Geoapify do not
  // share Place IDs, so Geoapify also compares strict identity + geo proximity.
  const crmGoogleIds = useMemo(() => new Set(results
    .filter((place) => Boolean(findBusinessDuplicate(place, existingLeads)))
    .map((place) => place.placeId)), [results, existingLeads]);
  const crmGeoIds = useMemo(() => new Set(geoResults
    .filter((place) => Boolean(findSavedBusinessMatch({
      placeId: place.sourceId,
      equivalentPlaceId:place.equivalentPlaceId,
      name: place.name,
      address: place.address,
      city: place.city,
      state: place.state,
      latitude: place.latitude,
      longitude: place.longitude,
    }, existingLeads)))
    .map((place) => place.sourceId)), [geoResults, existingLeads]);
  const saved = selected ? savedIds.includes(selected.placeId) ||
    crmGoogleIds.has(selected.placeId) : false;
  const geoSaved = selectedGeo ? crmGeoIds.has(selectedGeo.sourceId) || savedIds.includes(selectedGeo.sourceId) : false;
  // Search may still work without a browser map key; never expose the server Places key.
  const mapPoints = useMemo(() => buildMapPoints(appliedProvider, results, geoResults),
    [appliedProvider, geoResults, results]);

  const choose = useCallback((id: string) => {
    if (appliedProvider === "geoapify") setSelectedGeoId(id);
    else { setSelectedId(id); setGoogleCrmName(""); }
    const nodes = resultList.current?.querySelectorAll<HTMLButtonElement>("[data-marker-id]");
    const item = nodes && Array.from(nodes).find((button) => button.dataset.markerId === id);
    item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [appliedProvider]);

  async function search(input: SearchValues) {
    if (busy.current) return;
    const wanted = input;
    if (!wanted) return;
    if (!resolveSearchSegment(wanted.segment)) {
      setError("Selecione um segmento válido da lista, como Barbearia ou Academia.");
      return;
    }
    if (!wanted.city.trim() || wanted.city.trim().length < 2) {
      setError("Informe uma cidade válida para a busca.");
      return;
    }
    if (municipalitiesState === wanted.state && municipalities.length) {
      const canonicalCity = resolveMunicipality(wanted.city, municipalities);
      if (!canonicalCity) {
        setError("Escolha um município válido na lista do IBGE para a UF selecionada.");
        return;
      }
      wanted.city = canonicalCity;
    }
    busy.current = true;
    setLoading(true);
    setError("");
    setMessage("");
    setGoogleCrmName("");
    try {
      if (SAAS_STAGING_ACTIVE) {
        // All routing is server-side. One user action; at most one Google request.
        // Backend claims the plan search quota exactly once, even on fallback.
        const response = await searchAutomaticMaps({
          city: wanted.city,
          state: wanted.state,
          segment: resolveSearchSegment(wanted.segment) ?? wanted.segment,
          neighborhood: wanted.neighborhood,
        });
        if (!response.ok) {
          setResults([]);
          setGeoResults([]);
          setSelectedId(null);
          setSelectedGeoId(null);
          setApplied(null);
          setAppliedProvider(null);
          setError(response.message);
          return;
        }
        setApplied(wanted);
        saveSearchLocation({ city: wanted.city, state: wanted.state });
        setDetailsLoaded([]);
        if (response.quota) setUsage(response.quota);
        if (response.provider === "geoapify") {
          setAppliedProvider("geoapify");
          setResults([]);
          setSelectedId(null);
          setGeoResults(response.places);
          setSelectedGeoId(response.places[0]?.sourceId ?? null);
          if (response.coverage.message) setMessage(response.coverage.message);
          else if (!response.places.length) setMessage(response.quota?.test_mode
            ? "Nenhum estabelecimento encontrado com esses filtros ou dentro dos limites seguros das APIs."
            : "Nenhum estabelecimento coube no saldo diário disponível.");
        } else {
          setAppliedProvider("google");
          setGeoResults([]);
          setSelectedGeoId(null);
          setResults(response.results);
          setSelectedId(response.results[0]?.placeId ?? null);
          if (!response.results.length) {
            setMessage(response.quota?.test_mode
              ? "Nenhum estabelecimento encontrado com esses filtros ou dentro dos limites seguros das APIs."
              : "Nenhum estabelecimento foi encontrado ou coube no saldo diário disponível.");
          } else if (response.partial) {
            setMessage("A fonte atingiu um limite durante a busca. Estes são os resultados válidos disponíveis.");
          }
        }
        return;
      }

      // Production stays on its legacy route until reviewed rollout.
      const response = await searchBusinesses({
        ...wanted,
        segment: resolveSearchSegment(wanted.segment) ?? wanted.segment,
        mapMode: true,
      });
      if (!response.ok) {
        if (response.quota) setUsage(response.quota);
        setError(response.message);
        return;
      }
      if (response.quota) setUsage(response.quota);
      setApplied(wanted);
      saveSearchLocation({ city: wanted.city, state: wanted.state });
      setAppliedProvider("google");
      setGeoResults([]);
      setSelectedGeoId(null);
      setDetailsLoaded([]);
      setResults(response.results);
      setSelectedId(response.results[0]?.placeId ?? null);
      if (!response.results.length) {
        setMessage("Nenhuma empresa encontrada nesta região e segmento.");
      }
    } catch {
      setError("Não foi possível concluir a pesquisa. Tente novamente.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search({
      city: city.trim(), state,
      neighborhood: neighborhood.trim(),
      segment: segment.trim(),
    });
  }

  async function consultExtraDetails() {
    const placeId = selected?.placeId;
    if (!placeId || SAAS_STAGING_ACTIVE || detailsLoading ||
        detailsLoaded.includes(placeId)) return;
    setDetailsLoading(true);
    setError("");
    try {
      const response = await loadMapPlaceDetails(placeId);
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResults((items) => items.map((item) =>
        item.placeId === placeId ? { ...item, ...response.business } : item));
      setDetailsLoaded((ids) => ids.includes(placeId) ? ids : [...ids, placeId]);
      setMessage("Detalhes adicionais consultados. Esta consulta usa o orçamento separado de detalhes.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function saveLead(geoTargetId?: string) {
    if (!applied || saving) return;
    const isGeo=appliedProvider==="geoapify";
    // The sidebar can save an OSM lead directly without first waiting for a
    // React selection state update. Google leads still require a typed name.
    const targetGeo=isGeo
      ? geoTargetId
        ? geoResults.find((place)=>place.sourceId===geoTargetId) ?? null
        : selectedGeo
      : null;
    const selectedPlaceId=isGeo?targetGeo?.sourceId:selected?.placeId;
    const alreadySaved=isGeo
      ? Boolean(selectedPlaceId && (savedIds.includes(selectedPlaceId) || crmGeoIds.has(selectedPlaceId)))
      : saved;
    if (!selectedPlaceId || alreadySaved) return;
    let candidate: BusinessSearchResult;
    if (isGeo) {
      if (!targetGeo) return;
      // Geoapify/OSM data is independently licensed for storage with attribution.
      candidate = {
        placeId:targetGeo.sourceId,
        equivalentPlaceId:targetGeo.equivalentPlaceId??null,
        name:targetGeo.name,
        primaryCategory:targetGeo.category,
        categories:[],description:null,
        address:targetGeo.address,
        neighborhood:null,
        city:targetGeo.city,state:targetGeo.state,
        phone:null,internationalPhone:null,
        rating:null,reviewCount:null,isOpenNow:null,
        openingHours:[],currentOpeningHours:null,regularOpeningHours:null,
        website:null,instagram:null,googleMapsUrl:null,businessStatus:null,
        latitude:targetGeo.latitude,longitude:targetGeo.longitude,
      };
    } else {
      if (!selected) return;
      const manualName=googleCrmName.trim();
      if (manualName.length<3 || manualName.length>120) {
        setError("Digite um nome próprio para identificar este lead no CRM (3 a 120 caracteres).");
        return;
      }
      // Google Places only permits permanently persisting Place IDs, not its
      // name, coordinates, address or contact fields. This CRM name is typed
      // by the user and is NEVER copied automatically from the Places response.
      candidate = {
        placeId:selected.placeId,equivalentPlaceId:selected.equivalentPlaceId??null,
        crmManualName:true,
        name:manualName,primaryCategory:null,
        categories:[],description:null,address:null,neighborhood:null,
        city:null,state:null,phone:null,internationalPhone:null,
        rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
        currentOpeningHours:null,regularOpeningHours:null,
        website:null,instagram:null,googleMapsUrl:null,
        businessStatus:null,latitude:null,longitude:null,
      };
    }
    setSaving(true);
    setError("");
    try {
      const result=await onAddLead(candidate,
        resolveSearchSegment(applied.segment) ?? applied.segment);
      if(result.ok) {
        setSavedIds((ids)=>ids.includes(selectedPlaceId)?ids:[...ids,selectedPlaceId]);
        setMessage(result.alreadyExisted
          ? "Lead já adicionado ao CRM. Nenhum novo cadastro foi criado."
          : isGeo
            ? "Lead salvo no CRM com dados Geoapify/OSM e atribuição da fonte."
            : "Lead salvo no CRM com o nome informado por você e o identificador Google; dados do Google não foram copiados.");
      } else setError(result.message);
    } catch {
      setError("Não foi possível salvar o lead no CRM agora.");
    } finally {
      setSaving(false);
    }
  }

  function beginAddGoogle(placeId: string) {
    choose(placeId);
    // The Google Places contract does not allow copying the provider's name
    // straight into the CRM. Guide the user to the manual-name field instead.
    window.requestAnimationFrame(() => {
      document.getElementById("bms-google-crm-name")?.focus();
    });
  }

  const mapsLink = safeExternalHref(selected?.googleMapsUrl);
  const businessSite = safeExternalHref(selected?.website);
  const displayedCity = applied ? `${applied.city} · ${applied.state}` : `${city} · ${state}`;
  const resultCount = appliedProvider === "geoapify" ? geoResults.length : results.length;
  const osmLink = selectedGeo
    ? `https://www.openstreetmap.org/?mlat=${selectedGeo.latitude}&mlon=${selectedGeo.longitude}#map=16/${selectedGeo.latitude}/${selectedGeo.longitude}`
    : null;
  // A real Google map loads even before the first search; its map tiles
  // are never generated or simulated. Only verified results become numbered pins.
  const displayGoogleMap = Boolean(GOOGLE_BROWSER_KEY);
  const activeMarkerId = appliedProvider === "geoapify" ? selectedGeoId : selectedId;


  return (
    <section className="bms-root saas-page" aria-labelledby="bms-heading">
      <div className="bms-heading">
        <div>
          <div className="bms-eyebrow"><Compass size={14} /> EXPLORAÇÃO GEOGRÁFICA</div>
          <h1 id="bms-heading">Buscar <span>via Maps</span></h1>
          <p>Pesquise empresas reais em municípios de todas as 27 UFs do Brasil, por segmento e bairro, com seleção automática da fonte.</p>
        </div>
        <div className="bms-plan-chip"><ShieldCheck size={15} /> {usage?.test_mode ? "Modo testes · créditos pausados" : "Pro e Advanced · 2 créditos por lead"}</div>
      </div>

      <form className="bms-searchbar" onSubmit={onSubmit}>
        <div className="bms-field bms-field--segment">
          <label htmlFor="bms-segment">O QUE VOCÊ PROCURA?</label>
          <div className="bms-field-entry"><Search size={18}/><input
            id="bms-segment" list="bms-niches" maxLength={120} required
            value={segment} onChange={(e) => setSegment(e.target.value)}
            placeholder="Ex.: Barbearia" autoComplete="off"
          /></div>
          <datalist id="bms-niches">{ALL_SEARCH_SEGMENTS.map((value) => <option value={value} key={value}/>)}</datalist>
        </div>
        <div className="bms-field bms-field--city">
          <label htmlFor="bms-city">CIDADE</label>
          <div className="bms-field-entry"><MapPin size={17}/><input
            id="bms-city" list="bms-brazil-cities" maxLength={80} value={city} required
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex.: Lavras" autoComplete="off"
            title="Digite ou selecione o município da UF escolhida"
          /></div>
          <datalist id="bms-brazil-cities">
            {(municipalitiesState === state ? municipalities : []).map((item) =>
              <option value={item} key={item}/>)}
          </datalist>
        </div>
        <div className="bms-field bms-field--state">
          <label htmlFor="bms-state">UF</label>
          <select id="bms-state" value={state} onChange={(e) => {
            setState(e.target.value); setCity(""); setNeighborhood("");
          }}>
            {BRAZIL_STATES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
          </select>
        </div>
        <div className="bms-field bms-field--neighborhood">
          <label htmlFor="bms-neighborhood">BAIRRO <span>(OPCIONAL)</span></label>
          <input id="bms-neighborhood" maxLength={80} value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex.: Centro" />
        </div>
        <button className="bms-submit" type="submit"
          disabled={loading || (usage != null && usage.test_mode !== true && usage.remaining_today < 2)}>
          {loading ? <LoaderCircle className="bms-spin" size={17} /> : <Search size={17}/>}
          {loading ? "Buscando empresas..." : "Buscar no mapa"}
        </button>
      </form>

      <div className="bms-meta">
        <span><Layers3 size={15}/> {applied
          ? `${resultCount} empresas encontradas`
          : "Escolha um segmento e uma região"}</span>
        <span>{usage?.test_mode
          ? "Modo testes: nenhuma pesquisa ou crédito descontado. Orçamentos das APIs protegidos."
          : usage
          ? `Plano ${usage.plan.toUpperCase()} · ${usage.remaining_today} de ${usage.daily_limit} créditos restantes · 2 por lead`
          : "Busca protegida por cota diária"}
        </span>
      </div>

      {!displayGoogleMap && <p className="bms-alert" role="status">
        A chave pública de mapas do Google ainda precisa ser configurada para ativar o mapa real.
      </p>}
      {SAAS_STAGING_ACTIVE && <p className="bms-demo-notice" role="status">
        Homologação: resultados e coordenadas reais. É possível salvar um lead Geoapify/OSM ou o identificador Google com nome fornecido por você.
      </p>}
      {error && <p className="bms-alert" role="alert">{error}</p>}
      {message && <p className="bms-message" role="status">{message}</p>}
      <div className="bms-layout">
        <div className="bms-map-frame">
          {displayGoogleMap
            ? <RealGoogleMap points={mapPoints} selectedId={activeMarkerId}
                onSelect={choose} zoomAction={zoomAction} />
            : <div className="bms-map-placeholder" role="status">
                <MapPin size={34}/>
                <strong>Chave do Google Maps não configurada</strong>
                <p>A lista de empresas ainda funciona. Configure uma chave pública
                  autorizada para a API Maps JavaScript para mostrar o mapa geográfico real.</p>
              </div>}
          <div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{applied ? displayedCity : "Brasil · mapa real"}</div>
            <p>{applied
              ? `${applied.neighborhood ? applied.neighborhood + " · " : ""}${resultCount} empresas encontradas`
              : "Selecione um nicho e pesquise para explorar"}</p>
          </div>

          {displayGoogleMap && <div className="bms-map-controls" aria-label="Controles do mapa">
            <button type="button" aria-label="Ampliar mapa" onClick={() => {
              setZoomAction((prev) => ({ id: prev.id + 1, delta: 1 }));
            }}><Plus size={20}/></button>
            <span>ZOOM</span>
            <button type="button" aria-label="Reduzir mapa" onClick={() => {
              setZoomAction((prev) => ({ id: prev.id + 1, delta: -1 }));
            }}><Minus size={20}/></button>
          </div>}

          {selected && <article className="bms-business-card" aria-label={"Empresa selecionada: " + selected.name}>
            <button type="button" className="bms-business-close" aria-label="Fechar detalhes do lead"
              onClick={() => { setSelectedId(null); setGoogleCrmName(""); }}><X size={17}/></button>
            <div className="bms-business-top">
              <span className="bms-business-icon"><MapPin size={23} /></span>
              <div className="bms-business-title">
                <span>{selected.primaryCategory ?? applied?.segment ?? "EMPRESA"}</span>
                <h2>{selected.name}</h2>
              </div>
              <span className="bms-business-counter">#{results.findIndex((b) => b.placeId === selectedId) + 1}</span>
            </div>
            <p className="bms-business-address"><MapPin size={15} /> {selected.address || displayedCity}</p>
            {saved && <span className="bms-saved-label">Lead já adicionado</span>}
            <div className="bms-business-details">
              {selected.rating != null && <span><Star size={15} fill="#ffbc58" stroke="#ffbc58" />
                {selected.rating.toFixed(1)} {selected.reviewCount != null ? `(${selected.reviewCount})` : ""}</span>}
              <span className={selected.website ? "bms-site yes" : "bms-site"}>
                {selected.website ? "Com website" : detailsLoaded.includes(selected.placeId)
                  ? "Sem website identificado" : "Website não consultado"}
              </span>
              {selected.phone && <span>Telefone: {selected.phone}</span>}
              {mapsLink && <a href={mapsLink} target="_blank" rel="noopener noreferrer">Google Maps <ArrowUpRight size={13}/></a>}
              {businessSite && <a href={businessSite} target="_blank" rel="noopener noreferrer">Site <ArrowUpRight size={13}/></a>}
            </div>
            {!SAAS_STAGING_ACTIVE && !detailsLoaded.includes(selected.placeId) &&
              <button className="bms-enrich" type="button"
                disabled={detailsLoading || saving}
                onClick={() => void consultExtraDetails()}>
                {detailsLoading ? "Consultando..." : "Consultar telefone, website e avaliações"}
                <small>Consulta adicional do Google Places sujeita aos limites de segurança</small>
              </button>}
            <div className="bms-crm-save">
              {!saved && <>
                <label htmlFor="bms-google-crm-name">Nome que você quer usar no CRM</label>
                <input id="bms-google-crm-name" type="text" maxLength={120}
                  value={googleCrmName} onChange={(event)=>setGoogleCrmName(event.target.value)}
                  placeholder="Digite o nome por conta própria" autoComplete="off"/>
                <small>O CRM salvará o nome que você digitou e o identificador Google; outros dados ficam somente na consulta.</small>
              </>}
              <button className="bms-save" type="button"
                disabled={saving || saved || (!saved && googleCrmName.trim().length<3)}
                onClick={() => void saveLead()}>
                {saved ? <CheckCircle2 size={17}/> : <BookmarkPlus size={17}/>}
                {saved ? "Lead já adicionado" : saving ? "Adicionando..." : "Adicionar lead"}
              </button>
            </div>
          </article>}
          {selectedGeo && appliedProvider === "geoapify" &&
            <article className="bms-business-card" aria-label={"Estabelecimento Geoapify: " + selectedGeo.name}>
              <button type="button" className="bms-business-close" aria-label="Fechar detalhes do lead"
                onClick={() => setSelectedGeoId(null)}><X size={17}/></button>
              <div className="bms-business-top">
                <span className="bms-business-icon"><MapPin size={23}/></span>
                <div className="bms-business-title">
                  <span>{selectedGeo.category ?? "ESTABELECIMENTO"} · GEOAPIFY/OSM</span>
                  <h2>{selectedGeo.name}</h2>
                </div>
                <span className="bms-business-counter">
                  #{geoResults.findIndex((b) => b.sourceId === selectedGeoId) + 1}
                </span>
              </div>
              <p className="bms-business-address"><MapPin size={15}/>
                {selectedGeo.address || `${selectedGeo.city} · ${selectedGeo.state}`}
              </p>
              {geoSaved && <span className="bms-saved-label">Lead já adicionado</span>}
              <div className="bms-business-details">
                {osmLink && <a href={osmLink} target="_blank" rel="noopener noreferrer">
                  Ver localização no OpenStreetMap <ArrowUpRight size={13}/>
                </a>}
              </div>
              <p className="bms-readonly">Dados provenientes do Geoapify e © OpenStreetMap contributors. Contatos não disponíveis poderão ser adicionados depois no CRM.</p>
              <button className="bms-save" type="button"
                disabled={saving || geoSaved}
                onClick={() => void saveLead()}>
                {geoSaved ? <CheckCircle2 size={17}/> : <BookmarkPlus size={17}/>}
                {geoSaved ? "Lead já adicionado" : saving ? "Adicionando..." : "Adicionar lead"}
              </button>
            </article>}

        </div>

        <aside className="bms-results" aria-label="Empresas encontradas no mapa">
          <div className="bms-results-head">
            <div><span>RESULTADOS</span><h2>Empresas encontradas</h2></div>
            <span className="bms-results-count">{resultCount}</span>
          </div>
          {appliedProvider === "geoapify" &&
            <p className="bms-provider-attribution">
              Fonte: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
                Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright"
                  target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
            </p>}
          {appliedProvider === "google" &&
            <p className="bms-provider-attribution">
              Fonte: <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">
                Google Maps</a>. Consulta independente, sem mesclar dados do Geoapify.
            </p>}
          {resultCount === 0
            ? <div className="bms-no-results">
                <MapPin size={32}/>
                <strong>{applied && appliedProvider === "geoapify"
                  ? "Nenhum negócio dessa categoria cadastrado na fonte"
                  : applied ? "Nenhuma empresa encontrada" : "Seu próximo cliente pode estar aqui"}</strong>
                <p>{applied
                  ? "Nenhuma empresa encontrada com os filtros informados. Tente outra região ou segmento."
                  : "Busque por Barbearia, Academia, Restaurante ou outro segmento."}</p>
              </div>
            : appliedProvider === "geoapify"
              ? <ol className="bms-results-list" ref={resultList}>
                  {geoResults.map((business, i) => (
                    <li key={business.sourceId} className="bms-result-row">
                      <button type="button"
                        className={selectedGeoId === business.sourceId ? "bms-result selected" : "bms-result"}
                        data-marker-id={business.sourceId}
                        onClick={() => choose(business.sourceId)}>
                        <span className="bms-result-index">{i + 1}</span>
                        <span className="bms-result-text">
                          <strong>{business.name}</strong>
                          <small>{business.address || `${business.city} · ${business.state}`}</small>
                          {(crmGeoIds.has(business.sourceId) || savedIds.includes(business.sourceId)) &&
                            <span className="bms-saved-inline">Lead já adicionado</span>}
                          <em>Geoapify · sem dados de contato</em>
                        </span>
                      </button>
                      <button type="button" className="bms-result-add"
                        aria-label={"Adicionar lead: " + business.name}
                        disabled={saving || crmGeoIds.has(business.sourceId) || savedIds.includes(business.sourceId)}
                        onClick={() => {
                          choose(business.sourceId);
                          void saveLead(business.sourceId);
                        }}>
                        {crmGeoIds.has(business.sourceId) || savedIds.includes(business.sourceId)
                          ? <><CheckCircle2 size={14}/> Lead já adicionado</>
                          : <><BookmarkPlus size={14}/> Adicionar lead</>}
                      </button>
                    </li>
                  ))}
                </ol>
              : <ol className="bms-results-list" ref={resultList}>
                  {results.map((business, i) => (
                    <li key={business.placeId} className="bms-result-row">
                      <button type="button"
                        className={selectedId === business.placeId ? "bms-result selected" : "bms-result"}
                        data-marker-id={business.placeId}
                        onClick={() => choose(business.placeId)}>
                        <span className="bms-result-index">{i + 1}</span>
                        <span className="bms-result-text">
                          <strong>{business.name}</strong>
                          <small>{business.neighborhood || business.address || displayedCity}</small>
                          {(crmGoogleIds.has(business.placeId) || savedIds.includes(business.placeId)) &&
                            <span className="bms-saved-inline">Lead já adicionado</span>}
                          <em>Google Maps · {business.website ? "Website identificado"
                            : detailsLoaded.includes(business.placeId) ? "Sem website identificado"
                            : "Website não consultado"}</em>
                        </span>
                      </button>
                      <button type="button" className="bms-result-add"
                        aria-label={"Adicionar lead: " + business.name}
                        disabled={saving || crmGoogleIds.has(business.placeId) || savedIds.includes(business.placeId)}
                        onClick={() => beginAddGoogle(business.placeId)}>
                        {crmGoogleIds.has(business.placeId) || savedIds.includes(business.placeId)
                          ? <><CheckCircle2 size={14}/> Lead já adicionado</>
                          : <><BookmarkPlus size={14}/> Adicionar lead</>}
                      </button>
                    </li>
                  ))}
                </ol>}
          <p className="bms-results-footnote">
            <ShieldCheck size={13}/> {usage?.test_mode
              ? "Modo testes: resultados reais, sem desconto de créditos; limites de custo de provedores ativos."
              : SAAS_STAGING_ACTIVE
              ? "Resultados para consulta nesta homologação. A busca usa automaticamente a fonte disponível."
              : "Buscar via Maps debita 2 créditos por lead entregue, no saldo diário compartilhado."}
          </p>
        </aside>
      </div>
    </section>
  );
}
