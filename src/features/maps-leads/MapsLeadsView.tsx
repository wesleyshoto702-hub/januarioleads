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
import { findBusinessDuplicate, findSavedBusinessMatch } from "../search-leads/identity";
import { searchBusinesses } from "../search-leads/search-businesses";
import { searchAutomaticMaps, type GeoapifyPreview } from "./geoapify-client";
import { loadMapPlaceDetails } from "./map-place-details";
import { buildMapPoints, type RealMapPoint } from "./map-points";
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
type GeoPoint = { lat: number; lng: number };

type GoogleMapInstance = {
  fitBounds: (value: GoogleBounds) => void;
  panTo: (value: GeoPoint) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number | undefined;
};
type GoogleMarker = {
  setMap: (map: GoogleMapInstance | null) => void;
  addListener: (event: string, callback: () => void) => void;
  setIcon: (options: Record<string, unknown>) => void;
  setZIndex: (value: number) => void;
};
type GoogleBounds = { extend: (value: GeoPoint) => void };
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    LatLngBounds: new () => GoogleBounds;
    SymbolPath: { CIRCLE: number };
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
      reject(new Error("A chave pública do Google Maps não está configurada."));
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
    script.onerror = () => reject(new Error("Falha ao carregar o mapa. Verifique a chave e a conexão."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    mapsLoader = null;
    throw error;
  });
  return mapsLoader;
}

const DARK_GOOGLE_STYLE: Array<Record<string, unknown>> = [
  { elementType: "geometry", stylers: [{ color: "#17121a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a8a1ad" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#151018" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#41343f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#342c37" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#241c29" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#59414d" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#101922" }] },
];

function hasCoordinates(value: BusinessSearchResult): value is BusinessSearchResult & { latitude: number; longitude: number } {
  return typeof value.latitude === "number" && Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" && Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

type MapDisplayPoint = RealMapPoint;
type MapZoomAction = { id: number; delta: number };

function markerIcon(google: GoogleMapsApi, active: boolean) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: active ? 20 : 15,
    fillColor: active ? "#ff174c" : "#e52d57",
    fillOpacity: 1,
    strokeColor: active ? "#ffffff" : "#f7dce4",
    strokeWeight: active ? 3 : 2,
  };
}

/** Only verified provider coordinates appear on the live Google map; never simulated pins. */
function GoogleLeadsMap({
  points, selectedId, onSelect, zoomAction,
}: {
  points: MapDisplayPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoomAction: MapZoomAction;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMapInstance | null>(null);
  const sdk = useRef<GoogleMapsApi | null>(null);
  const markers = useRef<Array<{ id: string; marker: GoogleMarker }>>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void loadGoogleMaps().then((google) => {
      if (!alive || !container.current) return;
      sdk.current = google;
      map.current = new google.maps.Map(container.current, {
        center: { lat: -21.245, lng: -44.999 },
        zoom: 12,
        maxZoom: 18,
        styles: DARK_GOOGLE_STYLE,
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
      for (const item of markers.current) item.marker.setMap(null);
      markers.current = [];
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const google = sdk.current;
    const instance = map.current;
    if (!ready || !google || !instance) return;
    markers.current.forEach((item) => item.marker.setMap(null));
    markers.current = [];
    const bounds = new google.maps.LatLngBounds();
    for (const [index, point] of points.entries()) {
      const position = { lat: point.lat, lng: point.lng };
      bounds.extend(position);
      const marker = new google.maps.Marker({
        map: instance, position, title: point.name,
        label: { text: String(index + 1), color: "#ffffff", fontSize: "11px", fontWeight: "800" },
        icon: markerIcon(google, selectedId === point.id),
        zIndex: selectedId === point.id ? 1000 : index + 1,
      });
      marker.addListener("click", () => onSelect(point.id));
      markers.current.push({ id: point.id, marker });
    }
    if (points.length) {
      instance.fitBounds(bounds);
      if (points.length === 1) instance.setZoom(15);
    }
    return () => {
      markers.current.forEach((item) => item.marker.setMap(null));
      markers.current = [];
    };
    // Selected marker styling is updated below without refitting the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready, onSelect]);

  useEffect(() => {
    const google = sdk.current;
    if (!ready || !google) return;
    for (const item of markers.current) {
      const active = item.id === selectedId;
      item.marker.setIcon(markerIcon(google, active));
      item.marker.setZIndex(active ? 1000 : 1);
    }
    const target = points.find((point) => point.id === selectedId);
    if (target) map.current?.panTo({ lat: target.lat, lng: target.lng });
  }, [points, selectedId, ready]);

  useEffect(() => {
    if (!zoomAction.id || !map.current) return;
    const zoom = map.current.getZoom() ?? 12;
    map.current.setZoom(Math.min(18, Math.max(5, zoom + zoomAction.delta)));
  }, [zoomAction]);

  return (
    <div className="bms-google-map" ref={container}
      role="region" aria-label="Google Maps real com marcadores dos estabelecimentos encontrados">
      {!ready && <div className="bms-map-loading" role="status">
        {error || "Carregando Google Maps..."}
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
  const mapAllowed = Boolean(GOOGLE_BROWSER_KEY) || SAAS_STAGING_ACTIVE;
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
          else if (!response.places.length) setMessage("Nenhum estabelecimento coube no saldo diário disponível.");
        } else {
          setAppliedProvider("google");
          setGeoResults([]);
          setSelectedGeoId(null);
          setResults(response.results);
          setSelectedId(response.results[0]?.placeId ?? null);
          if (!response.results.length) {
            setMessage("Nenhum estabelecimento foi encontrado ou coube no saldo diário disponível.");
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
    if (!mapAllowed) return;
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

  async function saveLead() {
    if (!applied || saving) return;
    const isGeo=appliedProvider==="geoapify";
    const selectedPlaceId=isGeo?selectedGeo?.sourceId:selected?.placeId;
    if (!selectedPlaceId || (isGeo ? geoSaved : saved)) return;
    let candidate: BusinessSearchResult;
    if (isGeo) {
      if (!selectedGeo) return;
      // Geoapify/OSM data is independently licensed for storage with attribution.
      candidate = {
        placeId:selectedGeo.sourceId,
        equivalentPlaceId:selectedGeo.equivalentPlaceId??null,
        name:selectedGeo.name,
        primaryCategory:selectedGeo.category,
        categories:[],description:null,
        address:selectedGeo.address,
        neighborhood:null,
        city:selectedGeo.city,state:selectedGeo.state,
        phone:null,internationalPhone:null,
        rating:null,reviewCount:null,isOpenNow:null,
        openingHours:[],currentOpeningHours:null,regularOpeningHours:null,
        website:null,instagram:null,googleMapsUrl:null,businessStatus:null,
        latitude:selectedGeo.latitude,longitude:selectedGeo.longitude,
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

  const mapsLink = safeExternalHref(selected?.googleMapsUrl);
  const businessSite = safeExternalHref(selected?.website);
  const displayedCity = applied ? `${applied.city} · ${applied.state}` : `${city} · ${state}`;
  const resultCount = appliedProvider === "geoapify" ? geoResults.length : results.length;
  const osmLink = selectedGeo
    ? `https://www.openstreetmap.org/?mlat=${selectedGeo.latitude}&mlon=${selectedGeo.longitude}#map=16/${selectedGeo.latitude}/${selectedGeo.longitude}`
    : null;
  const displayGoogleMap = Boolean(GOOGLE_BROWSER_KEY) && mapPoints.length > 0;
  const activeMarkerId = appliedProvider === "geoapify" ? selectedGeoId : selectedId;


  return (
    <section className="bms-root saas-page" aria-labelledby="bms-heading">
      <div className="bms-heading">
        <div>
          <div className="bms-eyebrow"><Compass size={14} /> EXPLORAÇÃO GEOGRÁFICA</div>
          <h1 id="bms-heading">Buscar <span>via Maps</span></h1>
          <p>Pesquise empresas reais em municípios de todas as 27 UFs do Brasil, por segmento e bairro, com seleção automática da fonte.</p>
        </div>
        <div className="bms-plan-chip"><ShieldCheck size={15} /> Pro e Advanced · 2 créditos por lead</div>
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
          disabled={loading || !mapAllowed || (usage != null && usage.remaining_today < 2)}>
          {loading ? <LoaderCircle className="bms-spin" size={17} /> : <Search size={17}/>}
          {loading ? "Buscando empresas..." : "Buscar no mapa"}
        </button>
      </form>

      <div className="bms-meta">
        <span><Layers3 size={15}/> {applied
          ? `${resultCount} empresas encontradas`
          : "Escolha um segmento e uma região"}</span>
        <span>{usage
          ? `Plano ${usage.plan.toUpperCase()} · ${usage.remaining_today} de ${usage.daily_limit} créditos restantes · 2 por lead`
          : "Busca protegida por cota diária"}
        </span>
      </div>

      {!mapAllowed && <p className="bms-alert" role="status">
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
            ? <GoogleLeadsMap points={mapPoints} selectedId={activeMarkerId}
                onSelect={choose} zoomAction={zoomAction} />
            : <div className="bms-map-placeholder" role="status">
                <MapPin size={34}/>
                <strong>{!GOOGLE_BROWSER_KEY ? "Google Maps aguardando configuração" :
                  resultCount ? "Nenhum local com coordenadas válidas" : "Explore empresas reais no mapa"}</strong>
                <p>{!GOOGLE_BROWSER_KEY
                  ? "A busca de estabelecimentos funciona, mas o mapa real precisa de uma chave pública exclusiva para Maps JavaScript API."
                  : resultCount ? "Consulte a lista de resultados para abrir cada localização."
                  : "Escolha o segmento e a cidade e clique em Buscar no mapa."}</p>
              </div>}
          <div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{displayedCity}</div>
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
                disabled={saving || saved || !mapAllowed || (!saved && googleCrmName.trim().length<3)}
                onClick={() => void saveLead()}>
                {saved ? <CheckCircle2 size={17}/> : <BookmarkPlus size={17}/>}
                {saved ? "Lead já adicionado" : saving ? "Adicionando..." : "Adicionar ao CRM"}
              </button>
            </div>
          </article>}
          {selectedGeo && appliedProvider === "geoapify" &&
            <article className="bms-business-card" aria-label={"Estabelecimento Geoapify: " + selectedGeo.name}>
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
                disabled={saving || geoSaved || !mapAllowed}
                onClick={() => void saveLead()}>
                {geoSaved ? <CheckCircle2 size={17}/> : <BookmarkPlus size={17}/>}
                {geoSaved ? "Lead já adicionado" : saving ? "Adicionando..." : "Adicionar ao CRM"}
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
                    <li key={business.sourceId}>
                      <button type="button"
                        className={selectedGeoId === business.sourceId ? "bms-result selected" : "bms-result"}
                        data-marker-id={business.sourceId}
                        onClick={() => choose(business.sourceId)}>
                        <span className="bms-result-index">{i + 1}</span>
                        <span className="bms-result-text">
                          <strong>{business.name}</strong>
                          <small>{business.address || `${business.city} · ${business.state}`}</small>
                          {crmGeoIds.has(business.sourceId) &&
                            <span className="bms-saved-inline">Lead já adicionado</span>}
                          <em>Geoapify · sem dados de contato</em>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              : <ol className="bms-results-list" ref={resultList}>
                  {results.map((business, i) => (
                    <li key={business.placeId}>
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
                    </li>
                  ))}
                </ol>}
          {SAAS_STAGING_ACTIVE && appliedProvider === "google" && selected &&
            <div className="bms-staging-google-detail" aria-label={"Detalhes da empresa " + selected.name}>
              <strong>{selected.name}</strong>
              <p>{selected.address ?? displayedCity}</p>
              {mapsLink && <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                Ver no Google Maps <ArrowUpRight size={13}/>
              </a>}
              <small>Dados do Google para consulta; ao adicionar ao CRM, salvamos apenas o Place ID e o nome informado por você.</small>
            </div>}
          <p className="bms-results-footnote">
            <ShieldCheck size={13}/> {SAAS_STAGING_ACTIVE
              ? "Resultados para consulta nesta homologação. A busca usa automaticamente a fonte disponível."
              : "Buscar via Maps debita 2 créditos por lead entregue, no saldo diário compartilhado."}
          </p>
        </aside>
      </div>
    </section>
  );
}
