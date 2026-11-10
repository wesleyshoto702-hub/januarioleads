import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import type { RealMapPoint } from "./map-points";

/**
 * Real Google Maps JavaScript tiles and verified provider coordinates.
 * No illustrative/AI map is ever substituted for geographic data.
 *
 * Without a Cloud Map ID use Google raster/JSON dark styling and SVG legacy pins
 * (legacy Marker is deprecated but still supported). With a real Map ID prefer
 * AdvancedMarkerElement and the dark map style configured in Google Cloud.
 */
export { ENV_GOOGLE_MAPS_BROWSER_KEY } from "./browser-map-key";
const MAP_ID = (import.meta.env["VITE_GOOGLE_MAPS_MAP_ID"] as string | undefined)?.trim() ?? "";

// Public geographic overview used only BEFORE a locality search; actual
// establishment pins always come from the authenticated provider response.
const BRAZIL_OVERVIEW = { lat: -14.235, lng: -51.9253 };
type LatLng = { lat: number; lng: number };
type Bounds = { extend: (point: LatLng) => void };
type MapInstance = {
  fitBounds: (bounds: Bounds, padding?: number) => void;
  setCenter: (point: LatLng) => void;
  panTo: (point: LatLng) => void;
  getZoom: () => number | undefined;
  setZoom: (zoom: number) => void;
};
type LegacyMarker = {
  addListener: (name: string, listener: () => void) => unknown;
  setIcon: (value: Record<string, unknown>) => void;
  setZIndex: (value: number) => void;
  setMap: (map: MapInstance | null) => void;
};
type AdvancedMarker = {
  addListener: (name: string, listener: () => void) => unknown;
  map: MapInstance | null;
  zIndex: number;
};
type GoogleMapsSDK = {
  maps: {
    Map: new (container: HTMLElement, options: Record<string, unknown>) => MapInstance;
    LatLngBounds: new () => Bounds;
    Marker?: new (options: Record<string, unknown>) => LegacyMarker;
    importLibrary?: (name: "marker") => Promise<unknown>;
    marker?: {
      AdvancedMarkerElement?: new (options: Record<string, unknown>) => AdvancedMarker;
    };
  };
};
let scriptPromise: Promise<GoogleMapsSDK> | null = null;

function loadMapsSDK(browserKey: string): Promise<GoogleMapsSDK> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleMapsSDK>((resolve, reject) => {
    if (!browserKey) {
      reject(new Error("Chave pública do Google Maps não configurada."));
      return;
    }
    const win = window as Window & { google?: GoogleMapsSDK };
    const ready = () => {
      const google = win.google;
      if (typeof google?.maps?.Map !== "function" ||
          typeof google.maps.LatLngBounds !== "function") {
        reject(new Error("A biblioteca Maps JavaScript não inicializou corretamente."));
        return;
      }
      resolve(google);
    };
    if (typeof win.google?.maps?.Map === "function") {
      ready();
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(browserKey) +
      "&v=weekly&libraries=marker&language=pt-BR&region=BR";
    script.onload = ready;
    script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps. Confira Maps JavaScript API, faturamento e restrições da chave."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null; // let users retry after a temporary connection error
    throw error;
  });
  return scriptPromise;
}

const DARK_STYLE: Record<string, unknown>[] = [
  { elementType: "geometry", stylers: [{ color: "#11141b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8e9aaa" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1117" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#485360" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#11141b" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c3541" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#202935" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b4655" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#556579" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#303a48" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1521" }] },
];

/** A numbered, SVG teardrop. The input is solely a local array index. */
function svgPin(index: number, active: boolean): Record<string, unknown> {
  const n = String(index + 1).padStart(2, "0");
  // Legacy Google markers are SVG data URIs, so CSS alone cannot recolor them.
  // Read only the validated palette's computed CSS variables at render time.
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue(active ? "--primary-hover" : "--primary").trim();
  const ink = css.getPropertyValue("--primary-contrast").trim();
  const fill = /^#[\da-f]{6}$/i.test(accent) ? accent : "#f12d46";
  const stroke = /^#[\da-f]{6}$/i.test(ink) ? ink : "#ffffff";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="54" viewBox="0 0 42 54">
    <path d="M21 2C10 2 3 10 3 21c0 13 18 30 18 30s18-17 18-30C39 10 32 2 21 2Z"
      fill="${fill}" stroke="${stroke}" stroke-width="${active ? 3 : 2}"/>
    <text x="21" y="26" text-anchor="middle" font-family="Arial,sans-serif"
      font-size="12" font-weight="800" fill="${stroke}">${n}</text>
  </svg>`;
  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg) };
}

function advancedPin(index: number, active: boolean): HTMLElement {
  const pin = document.createElement("div");
  pin.className = "bms-real-pin" + (active ? " is-active" : "");
  const label = document.createElement("span");
  label.textContent = String(index + 1).padStart(2, "0");
  pin.appendChild(label);
  pin.setAttribute("aria-label", "Empresa " + String(index + 1));
  return pin;
}

type MarkerRecord = {
  id: string;
  index: number;
  legacy?: LegacyMarker;
  advanced?: AdvancedMarker;
  content?: HTMLElement;
};
function LocalMapErrorBoundary({ children }: { children: ReactNode }) {
  return <LocalMapErrorBoundaryInner>{children}</LocalMapErrorBoundaryInner>;
}
class LocalMapErrorBoundaryInner extends Component<{children: ReactNode}, {failed: boolean}> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: Error) { console.error("[JanuárioLeads Maps] Falha inesperada no mapa:", error); }
  override render() {
    if (this.state.failed) {
      return <div className="bms-map-placeholder" role="status">
        <MapPin size={30}/>
        <strong>Mapa temporariamente indisponível</strong>
        <p>Você ainda pode selecionar e adicionar empresas na lista de resultados.</p>
      </div>;
    }
    return this.props.children;
  }
}

export function RealGoogleMap(props: {
  browserKey: string;
  points: RealMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoomAction: { id: number; delta: number };
}) {
  return <LocalMapErrorBoundary><RealGoogleMapCanvas {...props}/></LocalMapErrorBoundary>;
}

function RealGoogleMapCanvas({
  browserKey, points, selectedId, onSelect, zoomAction,
}: {
  browserKey: string;
  points: RealMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoomAction: { id: number; delta: number };
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const sdk = useRef<GoogleMapsSDK | null>(null);
  const records = useRef<MarkerRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [markerWarning, setMarkerWarning] = useState("");

  const clearMarkers = useCallback(() => {
    const old = records.current;
    records.current = [];
    for (const item of old) {
      try {
        if (item.legacy) item.legacy.setMap(null);
        if (item.advanced) item.advanced.map = null;
      } catch (reason) {
        console.warn("[JanuárioLeads Maps] Falha ao retirar marcador:", reason);
      }
    }
  }, []);

  useEffect(() => {
    let live = true;
    void loadMapsSDK(browserKey).then(async (google) => {
      if (typeof google.maps.Marker !== "function" && google.maps.importLibrary) {
        try { await google.maps.importLibrary("marker"); }
        catch (reason) { console.warn("[JanuárioLeads Maps] Biblioteca marker:", reason); }
      }
      if (!live || !canvas.current) return;
      try {
        const advancedReady = typeof google.maps.marker?.AdvancedMarkerElement === "function";
        // A Cloud map ID is required for AdvancedMarkerElement. Without one,
        // retain inline CodeMakers-inspired dark JSON styling with legacy SVG pins.
        // Advanced markers require a map ID. Never select the default
        // DEMO_MAP_ID implicitly: that would discard our custom dark styling.
        const useAdvanced = advancedReady && Boolean(MAP_ID);
        const mapOptions: Record<string, unknown> = {
          center: BRAZIL_OVERVIEW,
          zoom: 4,
          minZoom: 3,
          maxZoom: 19,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          backgroundColor: "#10131a",
          // Map ID and inline JSON styles cannot be used simultaneously.
          ...(useAdvanced ? {
            mapId: MAP_ID,
            colorScheme: "DARK",
          } : {
            styles: DARK_STYLE,
          }),
        };
        sdk.current = google;
        map.current = new google.maps.Map(canvas.current, mapOptions);
        setError("");
        setReady(true);
      } catch (reason) {
        if (!live) return;
        console.error("[JanuárioLeads Maps] Não foi possível iniciar o mapa:", reason);
        setError("Não foi possível exibir o mapa real. Confira a API JavaScript e a chave pública no Google Cloud.");
        setReady(false);
      }
    }).catch((reason: unknown) => {
      if (!live) return;
      console.error("[JanuárioLeads Maps] Falha ao carregar o SDK:", reason);
      setError(reason instanceof Error ? reason.message : "Falha ao carregar o Google Maps.");
      setReady(false);
    });
    return () => {
      live = false;
      clearMarkers();
      map.current = null;
      sdk.current = null;
    };
  }, [browserKey, clearMarkers]);

  useEffect(() => {
    const instance = map.current;
    const google = sdk.current;
    if (!ready || !instance || !google) return;
    clearMarkers();
    if (!points.length) {
      setMarkerWarning("");
      return;
    }
    try {
      const bounds = new google.maps.LatLngBounds();
      for (const [index, point] of points.entries()) {
        const position = { lat: point.lat, lng: point.lng };
        bounds.extend(position);
        const AdvancedMarkerElement = google.maps.marker?.AdvancedMarkerElement;
        const LegacyMarker = google.maps.Marker;
        if (typeof AdvancedMarkerElement === "function" && Boolean(MAP_ID)) {
          const pin = advancedPin(point.listIndex - 1, point.id === selectedId);
          const marker = new AdvancedMarkerElement({
            map: instance, position, title: point.name,
            content: pin, gmpClickable: true,
            zIndex: point.id === selectedId ? 1000 : index + 1,
          });
          marker.addListener("click", () => onSelect(point.id));
          records.current.push({ id: point.id, index: point.listIndex - 1, advanced: marker, content: pin });
        } else if (typeof LegacyMarker === "function") {
          const marker = new LegacyMarker({
            map: instance, position, title: point.name,
            icon: svgPin(point.listIndex - 1, point.id === selectedId),
            zIndex: point.id === selectedId ? 1000 : index + 1,
          });
          marker.addListener("click", () => onSelect(point.id));
          records.current.push({ id: point.id, index: point.listIndex - 1, legacy: marker });
        } else {
          setMarkerWarning("Mapa real disponível, mas a biblioteca de marcadores não carregou. Selecione uma empresa na lista.");
          break;
        }
      }
      if (points.length === 1) {
        instance.setCenter({ lat: points[0]!.lat, lng: points[0]!.lng });
        instance.setZoom(15);
      } else {
        instance.fitBounds(bounds, 72);
      }
      if (records.current.length === points.length) setMarkerWarning("");
    } catch (reason) {
      // Do NOT unmount the real cartography or the CRM list if a marker fails.
      console.error("[JanuárioLeads Maps] Falha nos pins:", reason);
      setMarkerWarning("Alguns marcadores não puderam ser exibidos. Todas as empresas permanecem na lista.");
    }
    return clearMarkers;
    // selectedId is updated separately without resetting zoom/bounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready, onSelect, clearMarkers]);

  useEffect(() => {
    if (!ready) return;
    for (const item of records.current) {
      const active = item.id === selectedId;
      try {
        if (item.legacy) {
          item.legacy.setIcon(svgPin(item.index, active));
          item.legacy.setZIndex(active ? 1000 : item.index + 1);
        }
        if (item.advanced) {
          item.advanced.zIndex = active ? 1000 : item.index + 1;
          item.content?.classList.toggle("is-active", active);
        }
      } catch (reason) {
        console.warn("[JanuárioLeads Maps] Não foi possível realçar marcador:", reason);
      }
    }
    const item = points.find((point) => point.id === selectedId);
    if (item) {
      try { map.current?.panTo({ lat: item.lat, lng: item.lng }); }
      catch (reason) { console.warn("[JanuárioLeads Maps] Falha no movimento:", reason); }
    }
  }, [points, selectedId, ready]);

  useEffect(() => {
    if (!zoomAction.id || !map.current) return;
    try {
      const zoom = map.current.getZoom() ?? 10;
      map.current.setZoom(Math.min(19, Math.max(3, zoom + zoomAction.delta)));
    } catch (reason) {
      console.warn("[JanuárioLeads Maps] Zoom indisponível:", reason);
    }
  }, [zoomAction]);

  return <div className="bms-real-google-map">
    <div className="bms-google-map" ref={canvas} role="region"
      aria-label="Mapa real interativo do Brasil com empresas nas coordenadas retornadas pelo provedor"/>
    {(!ready || error) && <div className="bms-map-loading" role="status">
      <MapPin size={29}/>
      <strong>{error ? "Mapa indisponível" : "Carregando mapa real..."}</strong>
      <p>{error || "O Google Maps está preparando ruas, bairros e geografia real."}</p>
    </div>}
    {markerWarning && <div className="bms-map-pin-warning" role="status">{markerWarning}</div>}
  </div>;
}
