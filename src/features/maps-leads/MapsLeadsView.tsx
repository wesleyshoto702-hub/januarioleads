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
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BRAZIL_STATES } from "../../lib/brazil-locations";
import { safeExternalHref } from "../../lib/safe-external-url";
import type { PersistedLead } from "../leads/remote-leads";
import type { BusinessAddResult } from "../search-leads/BusinessDetailsModal";
import { findBusinessDuplicate } from "../search-leads/identity";
import { searchBusinesses } from "../search-leads/search-businesses";
import { searchAutomaticMaps, type GeoapifyPreview } from "./geoapify-client";
import { loadMapPlaceDetails } from "./map-place-details";
import {
  DEFAULT_SEARCH_LOCATION,
  loadSearchLocation,
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
type GeoPoint = { lat: number; lng: number };

type MapBusiness = { id: string; name: string; lat: number; lng: number };
type GoogleMapInstance = {
  fitBounds: (value: GoogleBounds, padding?: number) => void;
  panTo: (value: GeoPoint) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
};
type GoogleMarker = {
  map: GoogleMapInstance | null;
  addListener: (event: string, callback: () => void) => void;
};
type GoogleBounds = { extend: (value: GeoPoint) => void };
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    LatLngBounds: new () => GoogleBounds;
    importLibrary: (name: string) => Promise<{
      AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarker;
    }>;
  };
};
let mapsLoader: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const w = window as Window & { google?: GoogleMapsApi };
    if (w.google?.maps?.Map) {
      resolve(w.google);
      return;
    }
    if (!GOOGLE_BROWSER_KEY) {
      reject(new Error("É necessária uma chave Maps JavaScript exclusiva para o navegador."));
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(GOOGLE_BROWSER_KEY) + "&v=weekly&language=pt-BR&region=BR";
    script.onload = () => {
      if (w.google?.maps?.Map) resolve(w.google);
      else reject(new Error("O Google Maps não respondeu corretamente."));
    };
    script.onerror = () => reject(new Error("Não foi possível abrir o Google Maps. Confira a chave da API."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    mapsLoader = null;
    throw error;
  });
  return mapsLoader;
}

function GoogleLeadsMap({
  businesses, selectedId, onSelect, zoomDirection,
}: {
  businesses: MapBusiness[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoomDirection: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMapInstance | null>(null);
  const markers = useRef<Array<{ id: string; marker: GoogleMarker; pin: HTMLDivElement }>>([]);
  const markerLibrary = useRef<Awaited<ReturnType<GoogleMapsApi["maps"]["importLibrary"]>> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void loadGoogleMaps().then(async (google) => {
      const library = await google.maps.importLibrary("marker");
      if (!alive || !container.current) return;
      markerLibrary.current = library;
      map.current = new google.maps.Map(container.current, {
        center: { lat: -21.245, lng: -44.999 },
        zoom: 12,
        mapId: (import.meta.env["VITE_GOOGLE_MAPS_MAP_ID"] as string | undefined)?.trim() || "DEMO_MAP_ID",
        colorScheme: "DARK",
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "cooperative",
        backgroundColor: "#121017",
      });
      setReady(true);
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : "Mapa indisponível.");
    });
    return () => {
      alive = false;
      markers.current.forEach(({ marker }) => { marker.map = null; });
      markers.current = [];
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const library = markerLibrary.current;
    if (!ready || !instance || !library) return;
    markers.current.forEach(({ marker }) => { marker.map = null; });
    markers.current = [];
    const bounds = new (window as Window & { google: GoogleMapsApi }).google.maps.LatLngBounds();
    businesses.forEach((business, index) => {
      const position = { lat: business.lat, lng: business.lng };
      bounds.extend(position);
      const pin = document.createElement("div");
      pin.className = "bms-real-pin" + (business.id === selectedId ? " selected" : "");
      pin.textContent = String(index + 1).padStart(2, "0");
      pin.setAttribute("aria-label", business.name);
      const marker = new library.AdvancedMarkerElement({
        map: instance,
        position,
        title: business.name,
        content: pin,
      });
      marker.addListener("click", () => onSelect(business.id));
      markers.current.push({ id: business.id, marker, pin });
    });
    if (businesses.length === 1) {
      instance.panTo({ lat: businesses[0].lat, lng: businesses[0].lng });
      instance.setZoom(15);
    } else if (businesses.length > 1) {
      instance.fitBounds(bounds, 70);
    }
    return () => {
      markers.current.forEach(({ marker }) => { marker.map = null; });
      markers.current = [];
    };
  }, [businesses, ready, onSelect]);

  useEffect(() => {
    markers.current.forEach(({ id, pin }) => pin.classList.toggle("selected", id === selectedId));
    const target = businesses.find((b) => b.id === selectedId);
    if (target) map.current?.panTo({ lat: target.lat, lng: target.lng });
  }, [businesses, selectedId]);

  useEffect(() => {
    if (!zoomDirection || !map.current) return;
    const zoom = map.current.getZoom() ?? 12;
    map.current.setZoom(Math.min(19, Math.max(5, zoom + Math.sign(zoomDirection))));
  }, [zoomDirection]);

  return (
    <div className="bms-google-map" ref={container} aria-label="Google Maps com marcadores posicionados nas coordenadas reais dos estabelecimentos">
      {!ready && <div className="bms-map-loading" role="status">
        {error || "Carregando mapa geográfico do Google..."}
      </div>}
    </div>
  );
}

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
  const [neighborhood, setNeighborhood] = useState("");
  const [segment, setSegment] = useState("Barbearia");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applied, setApplied] = useState<SearchValues | null>(null);
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [appliedProvider, setAppliedProvider] = useState<MapsProvider | null>(null);
  const [geoResults, setGeoResults] = useState<GeoapifyPreview[]>([]);
  const [selectedGeoId, setSelectedGeoId] = useState<string | null>(null);
  const [usage, setUsage] = useState<SaasUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [zoomTick, setZoomTick] = useState(0);
  const busy = useRef(false);

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
  const saved = selected ? savedIds.includes(selected.placeId) ||
    Boolean(findBusinessDuplicate(selected, existingLeads)) : false;
  const mapAllowed = Boolean(GOOGLE_BROWSER_KEY) || SAAS_STAGING_ACTIVE;

  const chooseMapPin = useCallback((id: string) => {
    if (appliedProvider === "geoapify") setSelectedGeoId(id);
    else setSelectedId(id);
  }, [appliedProvider]);

  const mappedBusinesses = useMemo<MapBusiness[]>(() => {
    if (appliedProvider === "geoapify") return geoResults
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) &&
        Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180)
      .map((item) => ({ id: item.sourceId, name: item.name, lat: item.latitude, lng: item.longitude }));
    return results.filter((item): item is BusinessSearchResult & {latitude: number; longitude: number} =>
      typeof item.latitude === "number" && typeof item.longitude === "number" &&
      Number.isFinite(item.latitude) && Number.isFinite(item.longitude) &&
      Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180)
      .map((item) => ({ id: item.placeId, name: item.name, lat: item.latitude, lng: item.longitude }));
  }, [appliedProvider, geoResults, results]);

  async function search(append: boolean, input?: SearchValues) {
    if (busy.current) return;
    const wanted = append ? applied : input;
    if (!wanted) return;
    if (!resolveSearchSegment(wanted.segment)) {
      setError("Selecione um segmento válido da lista, como Barbearia ou Academia.");
      return;
    }
    if (!wanted.city.trim() || wanted.city.trim().length < 2) {
      setError("Informe uma cidade válida para a busca.");
      return;
    }
    if (append && (!pageToken || SAAS_STAGING_ACTIVE)) return;
    busy.current = true;
    setLoading(true);
    setError("");
    setMessage("");
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
          setPageToken(null);
          setError(response.message);
          return;
        }
        setApplied(wanted);
        setPageToken(null);
        setDetailsLoaded([]);
        if (response.provider === "geoapify") {
          setAppliedProvider("geoapify");
          setResults([]);
          setSelectedId(null);
          setGeoResults(response.places);
          setSelectedGeoId(response.places[0]?.sourceId ?? null);
          if (response.coverage.message) setMessage(response.coverage.message);
        } else {
          setAppliedProvider("google");
          setGeoResults([]);
          setSelectedGeoId(null);
          setResults(response.results);
          setSelectedId(response.results[0]?.placeId ?? null);
          if (!response.results.length) {
            setMessage("Nenhuma empresa encontrada nesta região e segmento. Tente outra combinação.");
          }
        }
        return;
      }

      // Production remains on the existing Google route until reviewed rollout.
      const response = await searchBusinesses({
        ...wanted,
        segment: resolveSearchSegment(wanted.segment) ?? wanted.segment,
        mapMode: true,
        ...(append && pageToken ? { pageToken } : {}),
      });
      if (!response.ok) {
        if (response.quota) setUsage(response.quota);
        setError(response.message);
        return;
      }
      if (response.quota) setUsage(response.quota);
      setApplied(wanted);
      setAppliedProvider("google");
      setGeoResults([]);
      setSelectedGeoId(null);
      setPageToken(response.nextPageToken);
      if (!append) setDetailsLoaded([]);
      setResults((previous) => {
        const next = append ? previous : [];
        const known = new Set(next.map((item) => item.placeId));
        for (const item of response.results) {
          if (!known.has(item.placeId)) {
            next.push(item);
            known.add(item.placeId);
          }
        }
        return [...next];
      });
      if (!append) setSelectedId(response.results[0]?.placeId ?? null);
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
    if (!mapAllowed) return;
    void search(false, {
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

  async function saveLead() {
    if (!selected || !applied || saving || saved || SAAS_STAGING_ACTIVE || appliedProvider !== "google") return;
    setSaving(true);
    setError("");
    try {
      const result = await onAddLead(
        withSearchLocation(selected, { city: applied.city, state: applied.state }),
        resolveSearchSegment(applied.segment) ?? applied.segment,
      );
      if (result.ok) {
        setSavedIds((ids) => ids.includes(selected.placeId) ? ids : [...ids, selected.placeId]);
        setMessage("Empresa adicionada ao CRM com sucesso.");
      } else {
        setError(result.message);
      }
    } catch {
      setError("Não foi possível salvar o lead no CRM agora.");
    } finally {
      setSaving(false);
    }
  }

  const canLoadMore = !SAAS_STAGING_ACTIVE &&
    appliedProvider === "google" && !!pageToken &&
    !loading && (usage?.remaining_today ?? 1) > 0;
  const mapsLink = safeExternalHref(selected?.googleMapsUrl);
  const businessSite = safeExternalHref(selected?.website);
  const displayedCity = applied ? `${applied.city} · ${applied.state}` : `${city} · ${state}`;
  const resultCount = appliedProvider === "geoapify" ? geoResults.length : results.length;
  const osmLink = selectedGeo
    ? `https://www.openstreetmap.org/?mlat=${selectedGeo.latitude}&mlon=${selectedGeo.longitude}#map=16/${selectedGeo.latitude}/${selectedGeo.longitude}`
    : null;
  const displayGoogleMap = !!GOOGLE_BROWSER_KEY;
  const preventCrmWrite = appliedProvider === "geoapify" || SAAS_STAGING_ACTIVE;

  return (
    <section className="bms-root saas-page" aria-labelledby="bms-heading">
      <div className="bms-heading">
        <div>
          <div className="bms-eyebrow"><Compass size={14} /> EXPLORAÇÃO GEOGRÁFICA</div>
          <h1 id="bms-heading">Buscar <span>via Maps</span></h1>
          <p>Encontre empresas por segmento, cidade e bairro em uma única pesquisa, com cobertura automática de fontes.</p>
        </div>
        <div className="bms-plan-chip"><ShieldCheck size={15} /> Disponível no Pro e Advanced</div>
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
            id="bms-city" maxLength={120} value={city} required
            onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Lavras"
          /></div>
        </div>
        <div className="bms-field bms-field--state">
          <label htmlFor="bms-state">UF</label>
          <select id="bms-state" value={state} onChange={(e) => setState(e.target.value)}>
            {BRAZIL_STATES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
          </select>
        </div>
        <div className="bms-field bms-field--neighborhood">
          <label htmlFor="bms-neighborhood">BAIRRO <span>(OPCIONAL)</span></label>
          <input id="bms-neighborhood" maxLength={80} value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex.: Centro" />
        </div>
        <button className="bms-submit" type="submit"
          disabled={loading || !mapAllowed || (!SAAS_STAGING_ACTIVE && usage?.remaining_today === 0)}>
          {loading ? <LoaderCircle className="bms-spin" size={17} /> : <Search size={17}/>}
          {loading ? "Buscando empresas..." : "Buscar no mapa"}
        </button>
      </form>

      <div className="bms-meta">
        <span><Layers3 size={15}/> {applied
          ? `${resultCount} empresas encontradas`
          : "Escolha um segmento e uma região"}</span>
        <span>{usage
          ? `Plano ${usage.plan.toUpperCase()} · ${usage.remaining_today} de ${usage.daily_limit} leads disponíveis hoje`
          : "Busca protegida por cota diária"}
        </span>
      </div>

      {!displayGoogleMap && <p className="bms-alert" role="status">
        O Google Maps geográfico precisa de uma chave de navegador separada, restrita à Maps JavaScript API.
        Os resultados abaixo são reais, mas não serão exibidos em posições fictícias.
      </p>}
      {SAAS_STAGING_ACTIVE && <p className="bms-demo-notice" role="status">
        Homologação: os resultados são de consultas reais ao Geoapify ou Google Places.
        {displayGoogleMap
          ? " Os marcadores representam coordenadas geográficas reais; não há pontos simulados."
          : " O mapa só será exibido após configurar a chave Maps JavaScript no navegador."}
      </p>
      {error && <p className="bms-alert" role="alert">{error}</p>}
      {message && <p className="bms-message" role="status">{message}</p>}
      <div className="bms-layout">
        <div className="bms-map-frame">
          {displayGoogleMap
            ? <GoogleLeadsMap businesses={mappedBusinesses}
                selectedId={appliedProvider === "geoapify" ? selectedGeoId : selectedId}
                onSelect={chooseMapPin} zoomDirection={zoomTick} />
            : <div className="bms-map-unavailable" role="status">
                <MapPin size={42} />
                <strong>Mapa real em preparação</strong>
                <span>Ative a Maps JavaScript API e configure a chave pública na Vercel de testes
                  para exibir cada empresa em sua posição geográfica exata.</span>
                <small>Não exibimos marcadores ou ruas fictícias.</small>
              </div>}
          <div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{displayedCity}</div>
            <p>{applied
              ? `${applied.neighborhood ? applied.neighborhood + " · " : ""}${resultCount} empresas encontradas`
              : "Selecione um nicho e pesquise para explorar"}</p>
          </div>

          <div className="bms-map-controls" aria-label="Controles do mapa">
            <button type="button" aria-label="Ampliar mapa" disabled={!displayGoogleMap} onClick={() => {
              if (displayGoogleMap) setZoomTick((n) => n + 1);
            }}><Plus size={20}/></button>
            <span>ZOOM</span>
            <button type="button" aria-label="Reduzir mapa" disabled={!displayGoogleMap} onClick={() => {
              if (displayGoogleMap) setZoomTick((n) => n - 1);
            }}><Minus size={20}/></button>
          </div>

          {selected && appliedProvider === "google" && displayGoogleMap && <article className="bms-business-card" aria-label={"Empresa selecionada: " + selected.name}>
            <div className="bms-business-top">
              <span className="bms-business-icon"><MapPin size={23} /></span>
              <div className="bms-business-title">
                <span>{selected.primaryCategory ?? applied?.segment ?? "EMPRESA"}</span>
                <h2>{selected.name}</h2>
              </div>
              <span className="bms-business-counter">#{results.findIndex((b) => b.placeId === selectedId) + 1}</span>
            </div>
            <p className="bms-business-address"><MapPin size={15} /> {selected.address || displayedCity}</p>
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
            {preventCrmWrite
              ? <p className="bms-readonly">Visualização apenas: a importação de dados do Google no CRM fica desativada durante a homologação.</p>
              : <button className="bms-save" type="button" disabled={saving || saved || !mapAllowed}
                  onClick={() => void saveLead()}>
                  {saved ? <CheckCircle2 size={17}/> : <BookmarkPlus size={17}/>}
                  {saved ? "Já está no CRM" : saving ? "Adicionando..." : "Adicionar ao CRM"}
                </button>}
          </article>}
          {selectedGeo && appliedProvider === "geoapify" && displayGoogleMap &&
            <article className="bms-business-card" aria-label={"Estabelecimento Geoapify: " + selectedGeo.name}>
              <div className="bms-business-top">
                <span className="bms-business-icon"><MapPin size={23}/></span>
                <div className="bms-business-title">
                  <span>GEOAPIFY · OPENSTREETMAP</span>
                  <h2>{selectedGeo.name}</h2>
                </div>
                <span className="bms-business-counter">
                  #{geoResults.findIndex((b) => b.sourceId === selectedGeoId) + 1}
                </span>
              </div>
              <p className="bms-business-address"><MapPin size={15}/>
                {selectedGeo.address || `${selectedGeo.city} · ${selectedGeo.state}`}
              </p>
              <div className="bms-business-details">
                {osmLink && <a href={osmLink} target="_blank" rel="noopener noreferrer">
                  Ver localização no OpenStreetMap <ArrowUpRight size={13}/>
                </a>}
              </div>
              <p className="bms-readonly">Consulta de estabelecimentos baseada em OpenStreetMap.
                Contatos e importação para o CRM não estão habilitados nessa fonte durante a homologação.</p>
            </article>}
          {SAAS_STAGING_ACTIVE && displayGoogleMap && <span className="bms-map-footnote">
            Coordenadas reais · Google Maps
          </span>}
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
              ? <ol className="bms-results-list">
                  {geoResults.map((business, i) => (
                    <li key={business.sourceId}>
                      <button type="button"
                        className={selectedGeoId === business.sourceId ? "bms-result selected" : "bms-result"}
                        onClick={() => setSelectedGeoId(business.sourceId)}>
                        <span className="bms-result-index">{i + 1}</span>
                        <span className="bms-result-text">
                          <strong>{business.name}</strong>
                          <small>{business.address || `${business.city} · ${business.state}`}</small>
                          <em>Geoapify · sem dados de contato</em>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              : <ol className="bms-results-list">
                  {results.map((business, i) => (
                    <li key={business.placeId}>
                      <button type="button"
                        className={selectedId === business.placeId ? "bms-result selected" : "bms-result"}
                        onClick={() => setSelectedId(business.placeId)}>
                        <span className="bms-result-index">{i + 1}</span>
                        <span className="bms-result-text">
                          <strong>{business.name}</strong>
                          <small>{business.neighborhood || business.address || displayedCity}</small>
                          <em>Google Maps · {business.website ? "Website identificado"
                            : detailsLoaded.includes(business.placeId) ? "Sem website identificado"
                            : "Website não consultado"}</em>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>}
          {SAAS_STAGING_ACTIVE && !displayGoogleMap && appliedProvider === "google" && selected &&
            <div className="bms-staging-google-detail" aria-label={"Detalhes da empresa " + selected.name}>
              <strong>{selected.name}</strong>
              <p>{selected.address ?? displayedCity}</p>
              {mapsLink && <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                Ver no Google Maps <ArrowUpRight size={13}/>
              </a>}
              <small>Resultados do Google Maps para consulta, sem importação ao CRM.</small>
            </div>}
          {canLoadMore && <button className="bms-more" type="button"
            onClick={() => void search(true)} disabled={loading}>
            {loading ? "Carregando..." : "Carregar mais empresas"}
          </button>}
          <p className="bms-results-footnote">
            <ShieldCheck size={13}/> {SAAS_STAGING_ACTIVE
              ? "Resultados para consulta nesta homologação. A busca usa automaticamente a fonte disponível."
              : "Cada novo lead liberado usa a mesma cota do Buscar Leads."}
          </p>
        </aside>
      </div>
    </section>
  );
}
