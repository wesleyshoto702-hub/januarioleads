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
import { searchGeoapifyPlaces, type GeoapifyPreview, type GeoapifySearchResponse } from "./geoapify-client";
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
type GeoapifyCoverage = Extract<GeoapifySearchResponse, { ok: true }>["coverage"];

const GEOAPIFY_SEGMENTS = new Set([
  "Barbearia", "Salão de Beleza", "Academia", "Restaurante",
  "Cafeteria", "Pizzaria", "Spa",
]);
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

function GoogleLeadsMap({
  businesses, selectedId, onSelect, zoomDirection,
}: {
  businesses: BusinessSearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoomDirection: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMapInstance | null>(null);
  const sdk = useRef<GoogleMapsApi | null>(null);
  const markers = useRef<GoogleMarker[]>([]);
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
        styles: DARK_GOOGLE_STYLE,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        backgroundColor: "#121017",
      });
      setReady(true);
    }).catch((reason: unknown) => {
      if (alive) setError(reason instanceof Error ? reason.message : "Mapa indisponível.");
    });
    return () => {
      alive = false;
      for (const marker of markers.current) marker.setMap(null);
      markers.current = [];
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = sdk.current;
    const instance = map.current;
    if (!ready || !g || !instance) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];
    const bounds = new g.maps.LatLngBounds();
    const valid = businesses.filter(hasCoordinates);
    valid.forEach((business, i) => {
      const position = { lat: business.latitude, lng: business.longitude };
      bounds.extend(position);
      const marker = new g.maps.Marker({
        map: instance,
        position,
        title: business.name,
        label: { text: String(i + 1), color: "#fff", fontSize: "11px", fontWeight: "700" },
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: "#ed2f57",
          fillOpacity: 1,
          strokeColor: "#fff0f2",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onSelect(business.placeId));
      markers.current.push(marker);
    });
    if (valid.length) {
      instance.fitBounds(bounds);
      // Google may initially zoom too far for a single company.
      if (valid.length === 1) instance.setZoom(14);
    }
    return () => {
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
    };
  }, [businesses, ready, onSelect]);

  useEffect(() => {
    const target = businesses.find((b) => b.placeId === selectedId);
    if (target && hasCoordinates(target)) map.current?.panTo({ lat: target.latitude, lng: target.longitude });
  }, [businesses, selectedId]);

  useEffect(() => {
    if (!zoomDirection || !map.current) return;
    const zoom = map.current.getZoom() ?? 12;
    map.current.setZoom(Math.min(18, Math.max(5, zoom + Math.sign(zoomDirection))));
  }, [zoomDirection]);

  return (
    <div className="bms-google-map" ref={container} aria-label="Mapa Google com as empresas encontradas">
      {!ready && <div className="bms-map-loading" role="status">
        {error || "Carregando mapa do Google..."}
      </div>}
    </div>
  );
}

function markerPosition(index: number) {
  // Fictional placements for STAGING ONLY, not a geographic representation.
  const x = 17 + ((index * 31 + index * index * 7) % 66);
  const y = 20 + ((index * 23 + index * index * 5) % 56);
  return { left: x + "%", top: y + "%" };
}

function StagingIllustrativeMap({
  businesses, selectedId, onSelect, zoom,
}: {
  businesses: BusinessSearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoom: number;
}) {
  return (
    <div className="bms-illustrative-map" aria-label="Mapa ilustrativo da simulação, sem dados cartográficos reais">
      <div className="bms-illustrative-transform" style={{ transform: `scale(${zoom})` }}>
        <svg viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="1000" height="640" fill="#101014" />
          <g stroke="#272530" strokeWidth="2" fill="none" opacity=".92">
            <path d="M-50 80L280 120L430 55L710 100L1100 64M-30 202L370 222L610 188L1080 236M-30 365L290 306L525 388L760 354L1050 402M0 532L265 454L525 528L840 488L1100 562" />
            <path d="M100 -60L165 720M276 -60L332 740M466 -60L524 730M647 -90L713 720M846 -45L886 712" />
            <path d="M-20 28L720 635M480 -70L1000 500M-80 530L650 -50M230 720L1000 -80" />
          </g>
          <g stroke="#403843" strokeWidth="5" fill="none" opacity=".82">
            <path d="M-65 303Q145 267 253 343T532 331T1050 295" />
            <path d="M362 -70Q315 165 420 263T516 710" />
            <path d="M698 -80Q622 153 743 273T768 700" />
          </g>
          <g stroke="#5c4555" strokeWidth="2" fill="none" opacity=".46">
            <path d="M-100 324Q145 286 253 362T532 350T1060 315" />
            <path d="M381 -70Q334 165 439 263T535 710" />
          </g>
          <g stroke="#222b36" strokeWidth="38" opacity=".43" fill="none">
            <path d="M1050 -20Q726 160 860 315T971 680" />
          </g>
          <g stroke="#394b60" strokeWidth="2" opacity=".62" fill="none">
            <path d="M1050 -20Q726 160 860 315T971 680" />
          </g>
          <g fill="#362e37" opacity=".82">
            <rect x="82" y="235" width="48" height="34" rx="3" transform="rotate(-8 82 235)" />
            <rect x="527" y="151" width="79" height="49" rx="5" />
            <rect x="540" y="445" width="58" height="76" rx="4" />
            <rect x="793" y="407" width="67" height="36" rx="4" />
            <rect x="198" y="485" width="88" height="40" rx="4" />
          </g>
        </svg>
        {businesses.slice(0, 30).map((business, index) => (
          <button
            className={business.placeId === selectedId ? "bms-pin selected" : "bms-pin"}
            key={business.placeId}
            style={markerPosition(index)}
            aria-label={"Selecionar " + business.name}
            aria-pressed={business.placeId === selectedId}
            type="button"
            onClick={() => onSelect(business.placeId)}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="bms-map-watermark">MAPA ILUSTRATIVO · HOMOLOGAÇÃO</div>
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
  const [provider, setProvider] = useState<MapsProvider>(SAAS_STAGING_ACTIVE ? "geoapify" : "google");
  const [appliedProvider, setAppliedProvider] = useState<MapsProvider | null>(null);
  const [geoResults, setGeoResults] = useState<GeoapifyPreview[]>([]);
  const [selectedGeoId, setSelectedGeoId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<GeoapifyCoverage | null>(null);
  const [usage, setUsage] = useState<SaasUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [zoom, setZoom] = useState(1);
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

  const choose = useCallback((id: string) => setSelectedId(id), []);

  function switchProvider(next: MapsProvider) {
    if (busy.current || next === provider) return;
    setProvider(next);
    setResults([]);
    setGeoResults([]);
    setSelectedId(null);
    setSelectedGeoId(null);
    setApplied(null);
    setAppliedProvider(null);
    setPageToken(null);
    setCoverage(null);
    setDetailsLoaded([]);
    setError("");
    setMessage("");
    if (next === "geoapify") setNeighborhood("");
  }

  async function search(
    append: boolean, input?: SearchValues, sourceOverride?: MapsProvider,
  ) {
    if (busy.current) return;
    const wanted = append ? applied : input;
    const source = sourceOverride ?? provider;
    if (!wanted || (append && source !== "google")) return;
    if (!append && !resolveSearchSegment(wanted.segment)) {
      setError("Selecione um segmento válido da lista, como Barbearia ou Academia.");
      return;
    }
    if (!wanted.city.trim() || wanted.city.trim().length < 2) {
      setError("Informe uma cidade válida para a busca.");
      return;
    }
    if (append && !pageToken) return;
    if (source === "geoapify" && !GEOAPIFY_SEGMENTS.has(resolveSearchSegment(wanted.segment) ?? "")) {
      setError("No Geoapify, escolha Barbearia, Salão de Beleza, Academia, Restaurante, Cafeteria, Pizzaria ou Spa. Para outros segmentos, use Google Places.");
      return;
    }
    if (source === "geoapify" && wanted.neighborhood.trim()) {
      setError("A busca por bairro está disponível na fonte Google Places. Remova o bairro ou selecione Google Places.");
      return;
    }
    busy.current = true;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (source === "geoapify") {
        const response = await searchGeoapifyPlaces({
          city: wanted.city,
          state: wanted.state,
          segment: resolveSearchSegment(wanted.segment) ?? wanted.segment,
          mapMode: true,
        });
        if (!response.ok) {
          setError(response.message);
          return;
        }
        setApplied(wanted);
        setAppliedProvider("geoapify");
        setResults([]);
        setSelectedId(null);
        setGeoResults(response.places);
        setSelectedGeoId(response.places[0]?.sourceId ?? null);
        setCoverage(response.coverage);
        setPageToken(null);
        setDetailsLoaded([]);
        if (response.coverage.message) {
          setMessage(response.coverage.message);
        } else if (!response.places.length) {
          setMessage("Nenhuma empresa catalogada nessa categoria pelo Geoapify.");
        }
        return;
      }

      // A deliberate Google selection ALWAYS uses a real query in staging.
      // Do not silently show the synthetic staging demo results.
      const response = await searchBusinesses({
        ...wanted,
        segment: resolveSearchSegment(wanted.segment) ?? wanted.segment,
        mapMode: true,
        liveGoogle: SAAS_STAGING_ACTIVE,
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
      setCoverage(null);
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
      if (response.results.length === 0) {
        setMessage("Nenhuma empresa encontrada pelo Google Places. Experimente outra região ou segmento.");
      }
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
      neighborhood: provider === "geoapify" ? "" : neighborhood.trim(),
      segment: segment.trim(),
    }, provider);
  }

  function searchGoogleAsAlternative() {
    if (!applied || loading || appliedProvider !== "geoapify") return;
    // Only this explicit click triggers a second provider request.
    setProvider("google");
    void search(false, applied, "google");
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

  const canLoadMore = appliedProvider === "google" && !!pageToken &&
    !loading && (usage?.remaining_today ?? 1) > 0;
  const mapsLink = safeExternalHref(selected?.googleMapsUrl);
  const businessSite = safeExternalHref(selected?.website);
  const displayedCity = applied ? `${applied.city} · ${applied.state}` : `${city} · ${state}`;
  const resultCount = appliedProvider === "geoapify" ? geoResults.length : results.length;
  const osmLink = selectedGeo
    ? `https://www.openstreetmap.org/?mlat=${selectedGeo.latitude}&mlon=${selectedGeo.longitude}#map=16/${selectedGeo.latitude}/${selectedGeo.longitude}`
    : null;
  const displayGoogleMap = appliedProvider !== "geoapify" && !!GOOGLE_BROWSER_KEY && !SAAS_STAGING_ACTIVE;
  const preventCrmWrite = appliedProvider === "geoapify" || SAAS_STAGING_ACTIVE;

  return (
    <section className="bms-root saas-page" aria-labelledby="bms-heading">
      <div className="bms-heading">
        <div>
          <div className="bms-eyebrow"><Compass size={14} /> EXPLORAÇÃO GEOGRÁFICA</div>
          <h1 id="bms-heading">Buscar <span>via Maps</span></h1>
          <p>Explore empresas por segmento, cidade e bairro. Selecione os marcadores e salve oportunidades no CRM.</p>
        </div>
        <div className="bms-plan-chip"><ShieldCheck size={15} /> Disponível no Pro e Advanced</div>
      </div>

      {SAAS_STAGING_ACTIVE && <div className="bms-provider-group">
        <div className="bms-provider-switch" role="group" aria-label="Fonte de estabelecimentos">
          <button type="button" className={provider === "geoapify" ? "selected" : ""}
            aria-pressed={provider === "geoapify"} disabled={loading}
            onClick={() => switchProvider("geoapify")}>
            <Layers3 size={15}/> Geoapify · OpenStreetMap
          </button>
          <button type="button" className={provider === "google" ? "selected" : ""}
            aria-pressed={provider === "google"} disabled={loading}
            onClick={() => switchProvider("google")}>
            <MapPin size={15}/> Google Places · busca real
          </button>
        </div>
        <p>Uma fonte por pesquisa. Trocar a fonte não consulta a API; clique em Buscar no mapa para iniciar uma nova busca sujeita às cotas.</p>
      </div>}

      <form className={provider === "geoapify" ? "bms-searchbar bms-searchbar--geo" : "bms-searchbar"} onSubmit={onSubmit}>
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
        {provider === "google" && <div className="bms-field bms-field--neighborhood">
          <label htmlFor="bms-neighborhood">BAIRRO <span>(OPCIONAL)</span></label>
          <input id="bms-neighborhood" maxLength={80} value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ex.: Centro" />
        </div>}
        <button className="bms-submit" type="submit"
          disabled={loading || !mapAllowed || (provider === "google" && usage?.remaining_today === 0)}>
          {loading ? <LoaderCircle className="bms-spin" size={17} /> : <Search size={17}/>}
          {loading ? "Buscando..." : "Buscar no mapa"}
        </button>
      </form>

      <div className="bms-meta">
        <span><Layers3 size={15}/> {applied
          ? `${resultCount} empresas encontradas · ${appliedProvider === "geoapify" ? "Geoapify" : "Google Places"}`
          : "Escolha uma fonte, um segmento e uma região"}</span>
        <span>{usage
          ? `Plano ${usage.plan.toUpperCase()} · ${usage.remaining_today} de ${usage.daily_limit} leads disponíveis hoje`
          : "Busca protegida por cota diária"}
        </span>
      </div>

      {!mapAllowed && <p className="bms-alert" role="status">
        A chave pública de mapas do Google ainda precisa ser configurada para ativar o mapa real.
      </p>}
      {SAAS_STAGING_ACTIVE && <p className="bms-demo-notice" role="status">
        Homologação: as consultas Geoapify e Google Places são reais e controladas por orçamento.
        O desenho ao fundo é ilustrativo, sem marcadores geográficos; use os links oficiais para localizar empresas.
      </p>}
      {error && <p className="bms-alert" role="alert">{error}</p>}
      {message && <p className="bms-message" role="status">{message}</p>}
      {SAAS_STAGING_ACTIVE && appliedProvider === "geoapify" && coverage?.alternativeSource === "google_places_manual" && applied && (
        <div className="bms-provider-fallback" role="status">
          <div>
            <strong>Não encontrou empresas no Geoapify?</strong>
            <p>Você pode tentar a mesma região e categoria no Google Places com uma nova consulta.</p>
          </div>
          <button type="button" disabled={loading || usage?.remaining_today === 0}
            onClick={searchGoogleAsAlternative}>
            <Search size={16}/> Buscar no Google Places
          </button>
          <small>Essa segunda consulta poderá consumir sua cota de leads e a franquia do Google.
            A troca nunca ocorre automaticamente.</small>
        </div>
      )}

      <div className="bms-layout">
        <div className="bms-map-frame">
          {displayGoogleMap
            ? <GoogleLeadsMap businesses={results} selectedId={selectedId}
                onSelect={choose} zoomDirection={zoomTick} />
            : <StagingIllustrativeMap businesses={[]}
                selectedId={null} onSelect={choose} zoom={zoom} />}
          <div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{displayedCity}</div>
            <p>{applied
              ? `${applied.neighborhood ? applied.neighborhood + " · " : ""}${resultCount} empresas encontradas`
              : "Selecione um nicho e pesquise para explorar"}</p>
          </div>

          <div className="bms-map-controls" aria-label="Controles do mapa">
            <button type="button" aria-label="Ampliar mapa" onClick={() => {
              if (displayGoogleMap) setZoomTick((n) => n + 1);
              else setZoom((n) => Math.min(1.8, +(n + .15).toFixed(2)));
            }}><Plus size={20}/></button>
            <span>ZOOM</span>
            <button type="button" aria-label="Reduzir mapa" onClick={() => {
              if (displayGoogleMap) setZoomTick((n) => n - 1);
              else setZoom((n) => Math.max(1, +(n - .15).toFixed(2)));
            }}><Minus size={20}/></button>
          </div>

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
          {selectedGeo && appliedProvider === "geoapify" &&
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
          {SAAS_STAGING_ACTIVE && <span className="bms-map-footnote">
            Desenho ilustrativo · sem marcadores geográficos reais
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
                <p>{appliedProvider === "geoapify"
                  ? coverage?.message ?? "Tente uma região ou categoria diferente."
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
          {canLoadMore && <button className="bms-more" type="button"
            onClick={() => void search(true)} disabled={loading}>
            {loading ? "Carregando..." : "Carregar mais empresas"}
          </button>}
          <p className="bms-results-footnote">
            <ShieldCheck size={13}/> {SAAS_STAGING_ACTIVE
              ? "Resultados somente para consulta nesta homologação; uma nova fonte exige nova busca."
              : "Cada novo lead liberado usa a mesma cota do Buscar Leads."}
          </p>
        </aside>
      </div>
    </section>
  );
}
