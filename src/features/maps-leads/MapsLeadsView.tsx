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
  const [usage, setUsage] = useState<SaasUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const saved = selected ? savedIds.includes(selected.placeId) ||
    Boolean(findBusinessDuplicate(selected, existingLeads)) : false;
  const mapAllowed = Boolean(GOOGLE_BROWSER_KEY) || SAAS_STAGING_ACTIVE;

  const choose = useCallback((id: string) => setSelectedId(id), []);

  async function search(append: boolean, input?: SearchValues) {
    if (busy.current) return;
    const wanted = append ? applied : input;
    if (!wanted) return;
    if (!append && !resolveSearchSegment(wanted.segment)) {
      setError("Selecione um segmento válido da lista, como Barbearia ou Academia.");
      return;
    }
    if (!wanted.city.trim() || wanted.city.trim().length < 2) {
      setError("Informe uma cidade válida para a busca.");
      return;
    }
    if (append && !pageToken) return;
    busy.current = true;
    setLoading(true);
    setError("");
    setMessage("");
    try {
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
      setPageToken(response.nextPageToken);
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
        setMessage("Nenhuma empresa encontrada para esta busca. Experimente outra região ou segmento.");
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mapAllowed) return;
    void search(false, { city: city.trim(), state, neighborhood: neighborhood.trim(), segment: segment.trim() });
  }

  async function saveLead() {
    if (!selected || !applied || saving || saved) return;
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

  const canLoadMore = !!pageToken && !loading && (usage?.remaining_today ?? 1) > 0;
  const mapsLink = safeExternalHref(selected?.googleMapsUrl);
  const businessSite = safeExternalHref(selected?.website);
  const displayedCity = applied ? `${applied.city} · ${applied.state}` : `${city} · ${state}`;

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
        <button className="bms-submit" type="submit" disabled={loading || !mapAllowed || usage?.remaining_today === 0}>
          {loading ? <LoaderCircle className="bms-spin" size={17} /> : <Search size={17}/>}
          {loading ? "Buscando..." : "Buscar no mapa"}
        </button>
      </form>

      <div className="bms-meta">
        <span><Layers3 size={15}/> {applied ? results.length + " empresas no mapa" : "Escolha um segmento e uma região"}</span>
        <span>{usage
          ? `Plano ${usage.plan.toUpperCase()} · ${usage.remaining_today} de ${usage.daily_limit} leads disponíveis hoje`
          : "Busca protegida por cota diária"}
        </span>
      </div>

      {!mapAllowed && <p className="bms-alert" role="status">
        A chave pública de mapas do Google ainda precisa ser configurada para ativar o mapa real.
      </p>}
      {SAAS_STAGING_ACTIVE && <p className="bms-demo-notice" role="status">
        Modo demonstração: empresas, posições e ruas são fictícias. Nenhuma busca paga ao Google é realizada.
      </p>}
      {error && <p className="bms-alert" role="alert">{error}</p>}
      {message && <p className="bms-message" role="status">{message}</p>}

      <div className="bms-layout">
        <div className="bms-map-frame">
          {GOOGLE_BROWSER_KEY && !SAAS_STAGING_ACTIVE
            ? <GoogleLeadsMap businesses={results} selectedId={selectedId}
                onSelect={choose} zoomDirection={zoomTick} />
            : <StagingIllustrativeMap businesses={SAAS_STAGING_ACTIVE ? results : []}
                selectedId={selectedId} onSelect={choose} zoom={zoom} />}
          <div className="bms-coverage">
            <div className="bms-coverage-kicker"><span className="bms-dot"/> COBERTURA TERRITORIAL</div>
            <div className="bms-coverage-place">{displayedCity}</div>
            <p>{applied
              ? `${applied.neighborhood ? applied.neighborhood + " · " : ""}${results.length} empresas encontradas`
              : "Selecione um nicho e pesquise para explorar"}</p>
          </div>

          <div className="bms-map-controls" aria-label="Controles do mapa">
            <button type="button" aria-label="Ampliar mapa" onClick={() => {
              if (GOOGLE_BROWSER_KEY && !SAAS_STAGING_ACTIVE) setZoomTick((n) => n + 1);
              else setZoom((n) => Math.min(1.8, +(n + .15).toFixed(2)));
            }}><Plus size={20}/></button>
            <span>ZOOM</span>
            <button type="button" aria-label="Reduzir mapa" onClick={() => {
              if (GOOGLE_BROWSER_KEY && !SAAS_STAGING_ACTIVE) setZoomTick((n) => n - 1);
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
                {selected.website ? "Com website" : "Sem website identificado"}
              </span>
              {mapsLink && <a href={mapsLink} target="_blank" rel="noopener noreferrer">Google Maps <ArrowUpRight size={13}/></a>}
              {businessSite && <a href={businessSite} target="_blank" rel="noopener noreferrer">Site <ArrowUpRight size={13}/></a>}
            </div>
            <button className="bms-save" type="button" disabled={saving || saved || !mapAllowed}
              onClick={() => void saveLead()}>
              {saved ? <CheckCircle2 size={17}/> : <BookmarkPlus size={17}/>}
              {saved ? "Já está no CRM" : saving ? "Adicionando..." : "Adicionar ao CRM"}
            </button>
          </article>}
          {SAAS_STAGING_ACTIVE && <span className="bms-map-footnote">
            Visualização ilustrativa · dados fictícios
          </span>}
        </div>

        <aside className="bms-results" aria-label="Empresas encontradas no mapa">
          <div className="bms-results-head">
            <div><span>RESULTADOS</span><h2>Empresas encontradas</h2></div>
            <span className="bms-results-count">{results.length}</span>
          </div>
          {results.length === 0
            ? <div className="bms-no-results">
                <MapPin size={32}/>
                <strong>Seu próximo cliente pode estar aqui</strong>
                <p>Busque por Barbearia, Academia, Restaurante ou outro segmento.</p>
              </div>
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
                        <em>{business.website ? "Website identificado" : "Sem site identificado"}</em>
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
            <ShieldCheck size={13}/> Cada novo lead liberado usa a mesma cota do Buscar Leads.
          </p>
        </aside>
      </div>
    </section>
  );
}
