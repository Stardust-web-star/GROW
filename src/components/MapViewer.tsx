import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { PoleData, CableSpan, UserAccount } from '../types';
import { Search, Filter, Layers, Navigation, AlertTriangle, Plus, ShieldCheck, Ruler, RefreshCw, ChevronRight, ChevronDown, ChevronUp, Grid, Eye, EyeOff, Zap, Sliders, Flame, Cable, Camera, Image as ImageIcon, Download, X, Locate, LocateFixed, ExternalLink, MapPin, Compass, ArrowUp } from 'lucide-react';
import { calculateHaversineDistanceMeters, checkIsRowViolation, getMinRowRequirement } from '../utils/kmzParser';
import { EditCableModal } from './EditCableModal';
import { NewCableModal } from './NewCableModal';
import { GeometricBlueHeaderBg } from './GeometricBlueHeaderBg';
import { GisPlnLogo } from './GisPlnLogo';
import { GeoLocationPermissionModal } from './GeoLocationPermissionModal';

// Helper to compress and convert photo to Base64 (max 1200px width/height, ~150-250KB)
const compressImageFile = (file: File, maxDim = 1200, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export interface NavigationTarget {
  type: 'pole' | 'cable';
  id: string;
  code: string;
  name: string;
  feeder: string;
  lat: number;
  lng: number;
  pole?: PoleData;
  span?: CableSpan;
  fromPoleCode?: string;
  toPoleCode?: string;
  locationName?: string;
  extraInfo?: string;
}

interface MapViewerProps {
  poles: PoleData[];
  spans: CableSpan[];
  isActive?: boolean;
  currentUser?: UserAccount | null;
  feederColors?: Record<string, string>;
  feederVisibility?: Record<string, boolean>;
  onSelectPole: (pole: PoleData) => void;
  onOpenAddInspection: (pole: PoleData) => void;
  onCreateSpkForPole: (pole: PoleData) => void;
  onDeletePole?: (poleId: string) => void;
  onUpdatePole?: (pole: PoleData) => void;
  onAddCustomPole: () => void;
  onOpenFeederDrawer?: () => void;
  onSaveSpan?: (span: CableSpan) => void;
  onUpdateSpan?: (span: CableSpan) => void;
  onDeleteSpan?: (spanId: string, fromPoleId?: string, toPoleId?: string) => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  poles,
  spans,
  isActive = true,
  currentUser,
  feederColors = {},
  feederVisibility = {},
  onSelectPole,
  onOpenAddInspection,
  onCreateSpkForPole,
  onDeletePole,
  onUpdatePole,
  onAddCustomPole,
  onOpenFeederDrawer,
  onSaveSpan,
  onUpdateSpan,
  onDeleteSpan
}) => {
  const isPetugasRow = currentUser?.role === 'Petugas ROW';
  const isPetugasRowRef = useRef<boolean>(isPetugasRow);
  useEffect(() => {
    isPetugasRowRef.current = isPetugasRow;
  }, [isPetugasRow]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeeder, setSelectedFeeder] = useState<string>('ALL');
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [showRowOnly, setShowRowOnly] = useState<boolean>(false);

  // Cable Drag & Drop / Drawing state
  const [isPullingCable, setIsPullingCable] = useState<boolean>(false);
  const [cableSourcePole, setCableSourcePole] = useState<PoleData | null>(null);
  const [cableTargetPole, setCableTargetPole] = useState<PoleData | null>(null);
  const [snapTargetPole, setSnapTargetPole] = useState<PoleData | null>(null);
  const [selectedSpanForEdit, setSelectedSpanForEdit] = useState<CableSpan | null>(null);

  // Fresh Refs to eliminate stale closures in Leaflet event listeners
  const isPullingCableRef = useRef<boolean>(false);
  const cableSourcePoleRef = useRef<PoleData | null>(null);
  const isDraggingCableRef = useRef<boolean>(false);
  const snapTargetPoleRef = useRef<PoleData | null>(null);
  const guideLineRef = useRef<L.Polyline | null>(null);
  const snapRingRef = useRef<L.CircleMarker | null>(null);
  const downPoleRef = useRef<{ pole: PoleData; pt: L.Point } | null>(null);

  // GPS Tracking & Live Navigation State (watchPosition real-time)
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    heading?: number | null;
    speed?: number | null;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'locked' | 'error'>('idle');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
  const [activeNavTarget, setActiveNavTarget] = useState<NavigationTarget | null>(null);
  const [activeNavPole, setActiveNavPole] = useState<PoleData | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState<boolean>(true);
  const [compassBearing, setCompassBearing] = useState<number | null>(null);
  const [navDistanceMeters, setNavDistanceMeters] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // In-App Geographic Location Access Request Modal state (matching user screenshot)
  const [showGeoModal, setShowGeoModal] = useState<boolean>(false);
  const pendingNavPoleRef = useRef<PoleData | null>(null);

  // GPS Refs to eliminate stale closures in callbacks and event listeners
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsLayerRef = useRef<L.LayerGroup | null>(null);
  const isGpsActiveRef = useRef<boolean>(false);
  const userCoordsRef = useRef<{ lat: number; lng: number; accuracy: number; heading?: number | null } | null>(null);
  const activeNavTargetRef = useRef<NavigationTarget | null>(null);
  const activeNavPoleRef = useRef<PoleData | null>(null);
  const isFollowingUserRef = useRef<boolean>(true);
  const routeGeometryRef = useRef<[number, number][] | null>(null);
  const lastRouteFetchCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    isGpsActiveRef.current = isGpsActive;
  }, [isGpsActive]);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  useEffect(() => {
    activeNavTargetRef.current = activeNavTarget;
    if (activeNavTarget?.pole) {
      setActiveNavPole(activeNavTarget.pole);
      activeNavPoleRef.current = activeNavTarget.pole;
    } else {
      setActiveNavPole(null);
      activeNavPoleRef.current = null;
    }
  }, [activeNavTarget]);

  useEffect(() => {
    isFollowingUserRef.current = isFollowingUser;
  }, [isFollowingUser]);

  useEffect(() => {
    routeGeometryRef.current = routeGeometry;
  }, [routeGeometry]);

  // Synchronize refs with state to eliminate stale closures
  useEffect(() => {
    isPullingCableRef.current = isPullingCable;
    if (!isPullingCable) {
      cableSourcePoleRef.current = null;
      isDraggingCableRef.current = false;
      snapTargetPoleRef.current = null;
      setSnapTargetPole(null);
      if (guideLineRef.current) {
        guideLineRef.current.remove();
        guideLineRef.current = null;
      }
      if (snapRingRef.current) {
        snapRingRef.current.remove();
        snapRingRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.getContainer().classList.remove('cable-pulling-mode');
        const draggable = (mapInstanceRef.current.dragging as any)?._draggable;
        if (draggable) {
          draggable._moving = false;
          draggable._moved = false;
        }
        (L.Draggable as any)._dragging = false;
        if (!mapInstanceRef.current.dragging.enabled()) {
          mapInstanceRef.current.dragging.enable();
        }
      }
    } else {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.getContainer().classList.add('cable-pulling-mode');
      }
    }
  }, [isPullingCable]);

  useEffect(() => {
    cableSourcePoleRef.current = cableSourcePole;
  }, [cableSourcePole]);

  // Pin Style State: Google Earth Pro Dot Pins vs Badge Detail
  const [pinStyle, setPinStyle] = useState<'googleEarth' | 'badge'>('googleEarth');

  // Cable Color Mode: 'byClearance' (Safety Level Color) vs 'byFeeder' (Custom Feeder Color)
  const [cableColorMode, setCableColorMode] = useState<'byClearance' | 'byFeeder'>('byClearance');

  // Heatmap State
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // Floating Legend visibility
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);

  // Top Toolbar Visibility (Pop In / Pop Out)
  const [isToolbarOpen, setIsToolbarOpen] = useState<boolean>(true);

  // Clustering & Performance State
  const [isClusterMode, setIsClusterMode] = useState<boolean>(true); // Cluster bubbles when zoomed out
  const [activeFeedersMap, setActiveFeedersMap] = useState<Record<string, boolean>>({});
  const [showClusterPanel, setShowClusterPanel] = useState<boolean>(false);

  // Distance Measurement state
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);

  // Photo Lightbox Preview state
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Extract all available feeders
  const allFeeders = Array.from(new Set(poles.map(p => p.feeder)));

  // Initialize active feeders map if empty or when new feeders are imported
  useEffect(() => {
    setActiveFeedersMap(prev => {
      const updated = { ...prev };
      allFeeders.forEach(f => {
        if (updated[f] === undefined) {
          updated[f] = true; // Default all feeders enabled
        }
      });
      return updated;
    });
  }, [poles.length]);

  // Compute Feeder Clusters Data
  const feederClusters = allFeeders.map(feederName => {
    const feederPoles = poles.filter(p => p.feeder === feederName);
    const criticalCount = feederPoles.filter(p => p.clearanceDistanceMeters < 1.5 || p.physicalCondition === 'Korosi Kritis').length;
    const rowCount = feederPoles.filter(p => p.clearanceDistanceMeters < 3.0).length;

    // Calculate center lat/lng of cluster
    const avgLat = feederPoles.reduce((acc, p) => acc + p.lat, 0) / (feederPoles.length || 1);
    const avgLng = feederPoles.reduce((acc, p) => acc + p.lng, 0) / (feederPoles.length || 1);

    return {
      feederName,
      poleCount: feederPoles.length,
      criticalCount,
      rowCount,
      avgLat,
      avgLng,
      poles: feederPoles,
      isActive: activeFeedersMap[feederName] !== false
    };
  });

  // Toggle single feeder
  const toggleFeeder = (feederName: string) => {
    setActiveFeedersMap(prev => ({
      ...prev,
      [feederName]: !prev[feederName]
    }));
  };

  // Toggle all feeders
  const toggleAllFeeders = (enable: boolean) => {
    const nextMap: Record<string, boolean> = {};
    allFeeders.forEach(f => { nextMap[f] = enable; });
    setActiveFeedersMap(nextMap);
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Create high-performance Canvas renderer
      const canvasRenderer = L.canvas({ padding: 0.5 });
      canvasRendererRef.current = canvasRenderer;

      // Center at Passo / Baguala, Ambon Island with GPU hardware acceleration
      const map = L.map(mapContainerRef.current, {
        center: [-3.6285, 128.2321],
        zoom: 14,
        zoomControl: false,
        preferCanvas: true,
        wheelDebounceTime: 50,
        wheelPxPerZoomLevel: 100,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true
      });

      // Esri World Imagery (Satellite) Layer
      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Esri Satellite',
          maxZoom: 19
        }
      );

      satelliteLayer.addTo(map);

      // Create dedicated Leaflet Panes for GPS so that accuracy circle and route polyline SVG never block canvas poles & cables
      const accuracyPane = map.createPane('gpsAccuracyPane');
      accuracyPane.style.zIndex = '350';
      accuracyPane.style.pointerEvents = 'none';

      const routePane = map.createPane('gpsRoutePane');
      routePane.style.zIndex = '380';
      routePane.style.pointerEvents = 'none';

      const userPane = map.createPane('gpsUserPane');
      userPane.style.zIndex = '660';

      // Create Layer Groups for markers, lines, heatmap, and GPS navigation
      const markersGroup = L.layerGroup().addTo(map);
      const linesGroup = L.layerGroup().addTo(map);
      const heatmapGroup = L.layerGroup().addTo(map);
      const gpsGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersGroup;
      linesLayerRef.current = linesGroup;
      heatmapLayerRef.current = heatmapGroup;
      gpsLayerRef.current = gpsGroup;

      // When user manually drags the map, pause auto-follow mode (Google Maps style)
      map.on('dragstart', () => {
        setIsFollowingUser(false);
      });

      // Handle map click for measurement tool
      map.on('click', (e: L.LeafletMouseEvent) => {
        if ((window as any).isMeasuringActive) {
          const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
          (window as any).addMeasurePoint(latlng);
        }
      });
    }

    return () => {
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      if (canvasRendererRef.current) {
        canvasRendererRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // When tab becomes active or container resizes, invalidate map size to adjust to container instantly
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const triggerInvalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    triggerInvalidate();
    const t1 = setTimeout(triggerInvalidate, 80);
    const t2 = setTimeout(triggerInvalidate, 250);
    const t3 = setTimeout(triggerInvalidate, 600);

    // ResizeObserver on map container ensures immediate redraw if container dimensions change
    let ro: ResizeObserver | null = null;
    if (mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        triggerInvalidate();
      });
      ro.observe(mapContainerRef.current);
    }

    window.addEventListener('resize', triggerInvalidate);
    window.addEventListener('orientationchange', triggerInvalidate);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', triggerInvalidate);
      window.removeEventListener('orientationchange', triggerInvalidate);
    };
  }, [isActive]);

  // Sync measurement handler with window
  useEffect(() => {
    (window as any).isMeasuringActive = isMeasuring;
    (window as any).addMeasurePoint = (latlng: [number, number]) => {
      setMeasurePoints(prev => {
        const next = [...prev, latlng];
        if (next.length === 2) {
          const dist = calculateHaversineDistanceMeters(next[0][0], next[0][1], next[1][0], next[1][1]);
          setMeasuredDistance(dist);
        }
        return next;
      });
    };
  }, [isMeasuring]);


  // Switch Tile Layer when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (mapType === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Satellite',
        maxZoom: 19
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png', {
        attribution: 'OpenStreetMap',
        maxZoom: 19
      }).addTo(map);
    }
  }, [mapType]);

  // Filter Poles based on active feeder toggles, search, condition, and ROW (Memoized)
  const filteredPoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return poles.filter(pole => {
      const isFeederActive = activeFeedersMap[pole.feeder] !== false;
      const isFeederVisible = feederVisibility[pole.feeder] !== false;
      if (!isFeederActive || !isFeederVisible) return false;

      const matchesSearch = !q ||
        pole.id.toLowerCase().includes(q) ||
        pole.code.toLowerCase().includes(q) ||
        pole.locationName.toLowerCase().includes(q);

      const matchesFeeder = selectedFeeder === 'ALL' || pole.feeder === selectedFeeder;
      const matchesCondition = selectedCondition === 'ALL' || pole.physicalCondition === selectedCondition;
      const matchesRow = !showRowOnly || pole.clearanceDistanceMeters < 3.0;

      return matchesSearch && matchesFeeder && matchesCondition && matchesRow;
    });
  }, [poles, activeFeedersMap, feederVisibility, searchQuery, selectedFeeder, selectedCondition, showRowOnly]);

  // Focus Map on a specific cluster area
  const focusOnCluster = (clusterPoles: PoleData[]) => {
    const map = mapInstanceRef.current;
    if (!map || clusterPoles.length === 0) return;

    const bounds = L.latLngBounds(clusterPoles.map(p => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  };

  // Helper for Feeder Colors with fallback to default palette
  const getFeederColor = (feederName: string): string => {
    if (feederColors && feederColors[feederName]) return feederColors[feederName];
    const f = (feederName || '').toLowerCase();
    if (f.includes('passo')) return '#22C55E'; // Emerald Green
    if (f.includes('waiheru 1')) return '#06B6D4'; // Cyan
    if (f.includes('waiheru 2')) return '#EAB308'; // Gold Yellow
    if (f.includes('waiheru 3')) return '#A855F7'; // Electric Purple
    if (f.includes('waiheru')) return '#EAB308'; // Gold Yellow
    if (f.includes('lateri 1')) return '#22C55E'; // Emerald Green
    if (f.includes('lateri 2')) return '#A855F7'; // Electric Purple
    if (f.includes('lateri 3')) return '#EAB308'; // Gold Yellow
    if (f.includes('lateri') || f.includes('halong')) return '#A855F7'; // Electric Purple
    if (f.includes('tulehu')) return '#06B6D4'; // Cyan
    if (f.includes('suli')) return '#EC4899'; // Hot Pink / Magenta
    if (f.includes('liang') || f.includes('hitu')) return '#F97316'; // Coral Orange
    if (f.includes('kota') || f.includes('laha')) return '#84CC16'; // Lime Green
    if (f.includes('bandara 1')) return '#EAB308'; // Gold Yellow
    if (f.includes('bandara 2')) return '#A855F7'; // Electric Purple
    if (f.includes('galala 1')) return '#EAB308'; // Gold Yellow
    if (f.includes('galala 2')) return '#06B6D4'; // Cyan
    if (f.includes('allang')) return '#EF4444'; // Red
    if (f.includes('hutumuri')) return '#84CC16'; // Lime Green
    if (f.includes('karpan 1')) return '#38BDF8'; // Sky Blue
    if (f.includes('mvtic 1')) return '#84CC16'; // Lime Green
    if (f.includes('mvtic 2')) return '#06B6D4'; // Cyan
    if (f.includes('rijali')) return '#22C55E'; // Emerald Green
    if (f.includes('wayame 1')) return '#3B82F6'; // Royal Blue
    if (f.includes('wayame 2')) return '#EAB308'; // Gold Yellow
    return '#3B82F6'; // Royal Blue
  };

  // Cancel cable pulling mode cleanly
  const cancelCablePulling = useCallback(() => {
    setIsPullingCable(false);
    setCableSourcePole(null);
    setCableTargetPole(null);
    setSnapTargetPole(null);
    isPullingCableRef.current = false;
    cableSourcePoleRef.current = null;
    isDraggingCableRef.current = false;
    snapTargetPoleRef.current = null;
    downPoleRef.current = null;
    if (guideLineRef.current) {
      guideLineRef.current.remove();
      guideLineRef.current = null;
    }
    if (snapRingRef.current) {
      snapRingRef.current.remove();
      snapRingRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getContainer().classList.remove('cable-pulling-mode');
      const draggable = (mapInstanceRef.current.dragging as any)?._draggable;
      if (draggable) {
        draggable._moving = false;
        draggable._moved = false;
      }
      (L.Draggable as any)._dragging = false;
      if (!mapInstanceRef.current.dragging.enabled()) {
        mapInstanceRef.current.dragging.enable();
      }
    }
  }, []);

  // Initiate pulling/dragging cable from a specific pole
  const startDraggingCableFromPole = useCallback((pole: PoleData, isDragGesture: boolean = true) => {
    setIsPullingCable(true);
    isPullingCableRef.current = true;
    setCableSourcePole(pole);
    cableSourcePoleRef.current = pole;
    isDraggingCableRef.current = isDragGesture;
    downPoleRef.current = null;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getContainer().classList.add('cable-pulling-mode');
    }
  }, []);

  // Complete connection when dropped or clicked on target pole
  const finishConnectingCable = useCallback((targetPole: PoleData) => {
    const source = cableSourcePoleRef.current;
    if (!source || source.id.toLowerCase() === targetPole.id.toLowerCase()) {
      cancelCablePulling();
      return;
    }

    // Immediately terminate pulling/dragging mode so map is completely free & interactive
    isDraggingCableRef.current = false;
    isPullingCableRef.current = false;
    setIsPullingCable(false);
    downPoleRef.current = null;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.getContainer().classList.remove('cable-pulling-mode');
      const draggable = (mapInstanceRef.current.dragging as any)?._draggable;
      if (draggable) {
        draggable._moving = false;
        draggable._moved = false;
      }
      (L.Draggable as any)._dragging = false;
      if (!mapInstanceRef.current.dragging.enabled()) {
        mapInstanceRef.current.dragging.enable();
      }
    }
    if (guideLineRef.current) {
      guideLineRef.current.remove();
      guideLineRef.current = null;
    }
    if (snapRingRef.current) {
      snapRingRef.current.remove();
      snapRingRef.current = null;
    }
    setSnapTargetPole(null);
    snapTargetPoleRef.current = null;

    // Set poles to open NewCableModal
    setCableSourcePole(source);
    setCableTargetPole(targetPole);
  }, [cancelCablePulling]);

  // Spatial query: Auto-snap to closest pole within pixel tolerance
  const findNearbyPoleAtLatLng = useCallback((latlng: L.LatLng, maxPixelDist: number = 42): PoleData | null => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    const mousePoint = map.latLngToContainerPoint(latlng);
    let bestPole: PoleData | null = null;
    let minDistanceSq = maxPixelDist * maxPixelDist;

    for (const p of filteredPoles) {
      if (cableSourcePoleRef.current && p.id.toLowerCase() === cableSourcePoleRef.current.id.toLowerCase()) {
        continue;
      }
      const polePoint = map.latLngToContainerPoint([p.lat, p.lng]);
      const dx = mousePoint.x - polePoint.x;
      const dy = mousePoint.y - polePoint.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        bestPole = p;
      }
    }
    return bestPole;
  }, [filteredPoles]);

  // Cancel cable pulling on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPullingCableRef.current) {
        cancelCablePulling();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelCablePulling]);

  // Dynamic Guide Line, Auto-Snap & Global Mouse Events during Cable Drag/Draw
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      // Check drag-threshold: if mouse moved > 6px while holding down on a pole, start dragging cable automatically!
      if (downPoleRef.current && !isPullingCableRef.current) {
        const currentPt = map.latLngToContainerPoint(e.latlng);
        const dx = currentPt.x - downPoleRef.current.pt.x;
        const dy = currentPt.y - downPoleRef.current.pt.y;
        if (dx * dx + dy * dy > 36) {
          const startPole = downPoleRef.current.pole;
          downPoleRef.current = null;
          map.closePopup();
          startDraggingCableFromPole(startPole, true);
          return;
        }
      }

      const source = cableSourcePoleRef.current;
      if (!isPullingCableRef.current || !source) {
        if (snapRingRef.current) {
          snapRingRef.current.remove();
          snapRingRef.current = null;
        }
        return;
      }

      const nearbyPole = findNearbyPoleAtLatLng(e.latlng, 42);
      const targetLatLng = nearbyPole
        ? ([nearbyPole.lat, nearbyPole.lng] as [number, number])
        : ([e.latlng.lat, e.latlng.lng] as [number, number]);

      if (nearbyPole) {
        snapTargetPoleRef.current = nearbyPole;
        setSnapTargetPole(nearbyPole);

        if (!snapRingRef.current) {
          snapRingRef.current = L.circleMarker([nearbyPole.lat, nearbyPole.lng], {
            radius: 14,
            color: '#10B981',
            weight: 3.5,
            fillColor: '#34D399',
            fillOpacity: 0.45,
            interactive: false,
            renderer: canvasRendererRef.current || undefined
          }).addTo(map);
        } else {
          snapRingRef.current.setLatLng([nearbyPole.lat, nearbyPole.lng]);
        }
      } else {
        snapTargetPoleRef.current = null;
        setSnapTargetPole(null);
        if (snapRingRef.current) {
          snapRingRef.current.remove();
          snapRingRef.current = null;
        }
      }

      const isSnapped = !!nearbyPole;
      const lineColor = isSnapped ? '#10B981' : '#38BDF8'; // Emerald green when snapped, Sky blue when drafting
      const lineWeight = isSnapped ? 5 : 4;
      const dash = isSnapped ? undefined : '6, 8';

      if (!guideLineRef.current) {
        guideLineRef.current = L.polyline(
          [[source.lat, source.lng], targetLatLng],
          {
            color: lineColor,
            weight: lineWeight,
            dashArray: dash,
            opacity: 0.95,
            interactive: false, // MUST BE NON-INTERACTIVE so it doesn't intercept clicks/drops!
            renderer: canvasRendererRef.current || undefined
          }
        ).addTo(map);
      } else {
        guideLineRef.current.setLatLngs([[source.lat, source.lng], targetLatLng]);
        guideLineRef.current.setStyle({
          color: lineColor,
          weight: lineWeight,
          dashArray: dash
        });
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      downPoleRef.current = null;

      if (mapInstanceRef.current) {
        const draggable = (mapInstanceRef.current.dragging as any)?._draggable;
        if (draggable) {
          draggable._moving = false;
          draggable._moved = false;
        }
        (L.Draggable as any)._dragging = false;
        if (!mapInstanceRef.current.dragging.enabled()) {
          mapInstanceRef.current.dragging.enable();
        }
      }

      if (isDraggingCableRef.current && cableSourcePoleRef.current) {
        let target = snapTargetPoleRef.current;
        if (!target) {
          const containerPt = map.mouseEventToContainerPoint(e);
          const latlng = map.containerPointToLatLng(containerPt);
          target = findNearbyPoleAtLatLng(latlng, 48);
        }

        if (target && target.id.toLowerCase() !== cableSourcePoleRef.current.id.toLowerCase()) {
          finishConnectingCable(target);
        } else {
          // Released on empty space: cancel drag gesture cleanly!
          cancelCablePulling();
        }
      }
    };

    // Handle map clicks during cable pulling (both starting and connecting)
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isPullingCableRef.current) {
        if (mapInstanceRef.current && !mapInstanceRef.current.dragging.enabled()) {
          mapInstanceRef.current.dragging.enable();
        }
        return;
      }

      if (cableSourcePoleRef.current) {
        // Source is selected, click near or on target pole to connect
        const target = snapTargetPoleRef.current || findNearbyPoleAtLatLng(e.latlng, 48);
        if (target && target.id.toLowerCase() !== cableSourcePoleRef.current.id.toLowerCase()) {
          finishConnectingCable(target);
          return;
        }
      } else {
        // No source pole yet, click near a pole to start pulling
        const source = findNearbyPoleAtLatLng(e.latlng, 40);
        if (source) {
          startDraggingCableFromPole(source, false);
          return;
        }
      }
    };

    const handleMapMouseDown = (e: L.LeafletMouseEvent) => {
      if (isPullingCableRef.current) {
        L.DomEvent.stopPropagation(e);
      }
    };

    map.on('mousemove', handleMouseMove);
    map.on('click', handleMapClick);
    map.on('mousedown', handleMapMouseDown);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('click', handleMapClick);
      map.off('mousedown', handleMapMouseDown);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      if (snapRingRef.current) {
        snapRingRef.current.remove();
        snapRingRef.current = null;
      }
    };
  }, [findNearbyPoleAtLatLng, finishConnectingCable, startDraggingCableFromPole]);

  // Render Poles, Spans, and Clusters on Map with Viewport Culling & Hardware-Accelerated Canvas Rendering
  const renderMapLayers = useCallback(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    const linesGroup = linesLayerRef.current;
    const heatmapGroup = heatmapLayerRef.current;
    const canvasRenderer = canvasRendererRef.current || L.canvas({ padding: 0.5 });

    if (!map || !markersGroup || !linesGroup) return;

    markersGroup.clearLayers();
    linesGroup.clearLayers();
    if (heatmapGroup) heatmapGroup.clearLayers();

    const currentZoom = map.getZoom();
    const isZoomedOut = isClusterMode && currentZoom < 13 && !searchQuery;

    // Fast O(1) Lookup Maps (case-insensitive & whitespace-safe)
    const poleMap = new Map<string, PoleData>();
    poles.forEach(p => {
      if (p.id) {
        poleMap.set(p.id, p);
        poleMap.set(p.id.toLowerCase(), p);
        poleMap.set(p.id.trim(), p);
        poleMap.set(p.id.trim().toLowerCase(), p);
      }
      if (p.code) {
        poleMap.set(p.code, p);
        poleMap.set(p.code.toLowerCase(), p);
        poleMap.set(p.code.trim(), p);
        poleMap.set(p.code.trim().toLowerCase(), p);
      }
    });

    const findPole = (idOrCode?: string): PoleData | undefined => {
      if (!idOrCode) return undefined;
      const key = String(idOrCode).trim();
      return poleMap.get(key) || poleMap.get(key.toLowerCase());
    };

    // Build O(M) index for cable spans per pole so connected cable queries are instant O(1)
    const poleConnectedSpansMap = new Map<string, CableSpan[]>();
    spans.forEach(s => {
      const fromKey = (s.fromPoleId || '').trim().toLowerCase();
      const toKey = (s.toPoleId || '').trim().toLowerCase();
      if (!poleConnectedSpansMap.has(fromKey)) poleConnectedSpansMap.set(fromKey, []);
      poleConnectedSpansMap.get(fromKey)!.push(s);
      if (!poleConnectedSpansMap.has(toKey)) poleConnectedSpansMap.set(toKey, []);
      poleConnectedSpansMap.get(toKey)!.push(s);
    });

    const getPoleConnectedSpans = (p: PoleData): CableSpan[] => {
      const byId = poleConnectedSpansMap.get((p.id || '').toLowerCase()) || [];
      const byCode = p.code ? (poleConnectedSpansMap.get(p.code.toLowerCase()) || []) : [];
      if (byCode.length === 0) return byId;
      const seen = new Set<string>();
      const combined: CableSpan[] = [];
      byId.forEach(s => { seen.add(s.id); combined.push(s); });
      byCode.forEach(s => { if (!seen.has(s.id)) { seen.add(s.id); combined.push(s); } });
      return combined;
    };

    if (isZoomedOut) {
      // RENDER CLUSTER BUBBLES FOR MAXIMUM ZOOM-OUT PERFORMANCE (Zero Lag!)
      feederClusters.forEach(cluster => {
        if (!cluster.isActive || cluster.poleCount === 0) return;

        let bubbleColor = '#10B981';
        if (cableColorMode === 'byFeeder') {
          bubbleColor = feederColors[cluster.feederName] || getFeederColor(cluster.feederName);
        } else {
          if (cluster.criticalCount > 0) {
            bubbleColor = '#EF4444';
          } else if (cluster.rowCount > 0) {
            bubbleColor = '#F59E0B';
          } else {
            bubbleColor = '#10B981';
          }
        }

        const clusterIconHtml = `
          <div style="
            background: rgba(15, 23, 42, 0.98);
            border: 3px solid ${bubbleColor};
            color: white;
            border-radius: 20px;
            padding: 6px 12px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            font-family: sans-serif;
            cursor: pointer;
            -webkit-font-smoothing: antialiased;
          ">
            <span style="background:${bubbleColor}; color:#0f172a; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:11px;">
              ⚡
            </span>
            <div style="text-align:left;">
              <div style="font-weight:bold; font-size:12px; color:white;">${cluster.feederName}</div>
              <div style="font-size:10px; color:#cbd5e1;">${cluster.poleCount} Tiang ${cableColorMode === 'byClearance' && cluster.rowCount > 0 ? `· <b style="color:#f87171;">${cluster.rowCount} ROW &lt;3m</b>` : ''}</div>
            </div>
          </div>
        `;

        const clusterIcon = L.divIcon({
          html: clusterIconHtml,
          className: 'feeder-cluster-bubble',
          iconSize: [160, 40],
          iconAnchor: [80, 20]
        });

        const clusterMarker = L.marker([cluster.avgLat, cluster.avgLng], { icon: clusterIcon });
        clusterMarker.on('click', () => {
          focusOnCluster(cluster.poles);
        });

        clusterMarker.addTo(markersGroup);
      });
      return;
    }

    // ZOOMED IN (zoom >= 13 or search active): Viewport Culling & Hardware-Accelerated Canvas Rendering
    const bounds = map.getBounds().pad(0.35); // 35% margin beyond viewport for butter-smooth panning

    // 1. Filter visible poles within padded bounds
    const visiblePoles = filteredPoles.filter(p => bounds.contains([p.lat, p.lng]));

    // 2. Render Heatmap Overlay if active
    if (showHeatmap && heatmapGroup) {
      const criticalHazardPoles = visiblePoles.filter(p =>
        checkIsRowViolation(p.clearanceDistanceMeters, p.type) ||
        p.physicalCondition === 'Korosi Kritis' ||
        p.physicalCondition === 'Miring / Retak' ||
        p.clearanceStatus.includes('Bahaya Kritis')
      );

      criticalHazardPoles.forEach(p => {
        L.circle([p.lat, p.lng], {
          radius: 130,
          color: '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: 0.20,
          stroke: false,
          renderer: canvasRenderer
        }).addTo(heatmapGroup);

        L.circle([p.lat, p.lng], {
          radius: 65,
          color: '#F59E0B',
          fillColor: '#EF4444',
          fillOpacity: 0.38,
          stroke: false,
          renderer: canvasRenderer
        }).addTo(heatmapGroup);

        const coreCircle = L.circle([p.lat, p.lng], {
          radius: 25,
          color: '#B91C1C',
          fillColor: '#B91C1C',
          fillOpacity: 0.85,
          stroke: true,
          weight: 2,
          renderer: canvasRenderer
        });

        coreCircle.bindTooltip(
          `<div style="min-width:320px; max-width:420px; font-family:inherit;">` +
            `<div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1.5px solid #fecaca; padding-bottom:3px; margin-bottom:4px;">` +
              `<span style="font-size:13px; font-weight:900; color:#b91c1c;">🔥 ZONA BAHAYA KRITIS</span>` +
              `<span style="font-size:12px; font-weight:800; color:#090d16;">${p.id} (${p.code})</span>` +
            `</div>` +
            `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:11.5px; color:#1e293b; font-weight:700; margin-bottom:3px;">` +
              `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:210px;">📍 ${p.locationName}</span>` +
              `<span style="color:#b91c1c; font-weight:900; white-space:nowrap;">ROW: ${p.clearanceDistanceMeters}m</span>` +
            `</div>` +
            `<div style="font-size:11px; color:#64748b; font-weight:600;">` +
              `Kondisi Fisik: <b style="color:#0f172a;">${p.physicalCondition}</b>` +
            `</div>` +
          `</div>`,
          { sticky: true, direction: 'top', opacity: 1.0, className: 'custom-map-tooltip' }
        );
        coreCircle.addTo(heatmapGroup);
      });
    }

    // 3. Render Cable Spans (Lines between adjacent poles only within padded bounds)
    const visibleSpans = spans.filter(s => {
      const from = findPole(s.fromPoleId);
      const to = findPole(s.toPoleId);
      if (!from || !to) return false;
      return bounds.contains([from.lat, from.lng]) || bounds.contains([to.lat, to.lng]);
    });

    visibleSpans.forEach(span => {
      const fromPole = findPole(span.fromPoleId);
      const toPole = findPole(span.toPoleId);

      if (fromPole && toPole) {
        const isFromVisible = (activeFeedersMap[fromPole.feeder] !== false) && (feederVisibility[fromPole.feeder] !== false);
        const isToVisible = (activeFeedersMap[toPole.feeder] !== false) && (feederVisibility[toPole.feeder] !== false);
        if (!isFromVisible || !isToVisible) return;

        if (selectedFeeder !== 'ALL' && (fromPole.feeder !== selectedFeeder && toPole.feeder !== selectedFeeder)) return;
        if (showRowOnly && fromPole.clearanceDistanceMeters >= 3.0 && toPole.clearanceDistanceMeters >= 3.0 && span.clearanceMeters >= 3.0) return;

        const effectiveFeeder = span.feeder || fromPole.feeder || toPole.feeder || '';
        const treeDist = span.treeDistanceMeters !== undefined ? span.treeDistanceMeters : 99;
        const bldgDist = span.buildingDistanceMeters !== undefined ? span.buildingDistanceMeters : 99;
        const spanClear = span.clearanceMeters !== undefined ? span.clearanceMeters : 99;
        const minClearance = Math.min(fromPole.clearanceDistanceMeters, toPole.clearanceDistanceMeters, spanClear, treeDist, bldgDist);

        const cableCond = (span.cableCondition || 'Baik').toLowerCase();
        const isCableCrit = cableCond.includes('terkelupas') || cableCond.includes('rusak') || cableCond.includes('putus') || cableCond.includes('rentan') || cableCond.includes('korosi');
        const isCableWarn = cableCond.includes('kendor') || cableCond.includes('andongan');
        const isDistCrit = minClearance < 1.5 || treeDist < 1.5 || bldgDist < 1.5;
        const isDistViolation = minClearance < 3.0 || treeDist < 3.0 || bldgDist < 3.0 || span.hasViolation;
        const isCableCritical = isCableCrit || isDistCrit;
        const isCableViolation = isCableWarn || isDistViolation;

        let lineColor = '#10B981';
        let lineModeDesc = '';

        if (cableColorMode === 'byClearance') {
          if (isCableCritical) {
            lineColor = '#EF4444';
            lineModeDesc = `🔴 Kritis (Kondisi: ${span.cableCondition || 'Rusak'} | Jarak Terdekat: ${minClearance.toFixed(1)}m)`;
          } else if (isCableViolation) {
            lineColor = '#F59E0B';
            lineModeDesc = `🟡 Pelanggaran ROW (Kondisi: ${span.cableCondition || 'Kendor'} | Jarak Terdekat: ${minClearance.toFixed(1)}m)`;
          } else {
            lineColor = '#10B981';
            lineModeDesc = `🟢 Aman (Kondisi: Baik | Jarak Terdekat: ${minClearance.toFixed(1)}m)`;
          }
        } else {
          lineColor = feederColors[effectiveFeeder] || getFeederColor(effectiveFeeder);
          lineModeDesc = `⚡ Penyulang ${effectiveFeeder}`;
        }

        const line = L.polyline(
          [
            [fromPole.lat, fromPole.lng],
            [toPole.lat, toPole.lng]
          ],
          {
            color: lineColor,
            weight: cableColorMode === 'byClearance' ? (isCableViolation ? 4.5 : 3.5) : 4,
            dashArray: (cableColorMode === 'byClearance' && isCableViolation) ? '6, 6' : undefined,
            opacity: 0.95,
            renderer: canvasRenderer
          }
        );

        const treeInfo = treeDist < 90 ? `${treeDist}m` : '-';
        const bldgInfo = bldgDist < 90 ? `${bldgDist}m` : '-';
        const compactCableStatus = isCableCritical
          ? '🔴 Kritis'
          : isCableViolation
            ? '🟡 Pelanggaran ROW'
            : '🟢 Aman';

        const cableStatusText = cableColorMode === 'byFeeder' 
          ? `⚡ Feeder ${effectiveFeeder}` 
          : `${compactCableStatus} (${minClearance < 90 ? minClearance.toFixed(1) + 'm' : '<3m'})`;

        line.bindTooltip(
          `<div style="box-sizing:border-box; width:100%; min-width:320px; max-width:440px; font-family:inherit; overflow:hidden;">` +
            `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1.5px solid #e2e8f0; padding-bottom:4px; margin-bottom:5px;">` +
              `<div style="font-size:14px; font-weight:900; color:#090d16; letter-spacing:-0.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">` +
                `${fromPole.code} <span style="color:#0284c7; font-weight:800;">↔</span> ${toPole.code}` +
              `</div>` +
              `<div style="font-size:11px; font-weight:800; padding:2px 7px; border-radius:5px; background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; white-space:nowrap; flex-shrink:0;">` +
                `${span.conductorType} (${span.lengthMeters}m)` +
              `</div>` +
            `</div>` +
            `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; margin-bottom:5px;">` +
              `<div style="font-weight:800; color:${lineColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:210px;">` +
                `${cableStatusText}` +
              `</div>` +
              `<div style="font-size:11.5px; font-weight:700; color:#334155; white-space:nowrap; flex-shrink:0;">` +
                `Pohon: <b>${treeInfo}</b> · Bangunan: <b>${bldgInfo}</b>` +
              `</div>` +
            `</div>` +
            `<div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:800; color:#d97706; background:#fef3c7; border:1px solid #fcd34d; padding:3px 8px; border-radius:6px; overflow:hidden;">` +
              `<span style="white-space:nowrap; flex-shrink:0;">👉 Klik kabel untuk opsi edit / hapus</span>` +
              `<span style="color:#78350f; font-weight:700; white-space:nowrap; flex-shrink:0;">Fisik: ${span.cableCondition || 'Baik'}</span>` +
            `</div>` +
          `</div>`,
          { sticky: true, direction: 'top', opacity: 1.0, className: 'custom-map-tooltip' }
        );

        // Lazy popup creator: executed on-demand only when polyline is clicked
        line.bindPopup(() => {
          const cablePopupContent = document.createElement('div');
          cablePopupContent.className = 'custom-cable-popup p-3 text-slate-900 font-sans';
          cablePopupContent.style.width = '275px';
          cablePopupContent.style.maxWidth = 'min(285px, 84vw)';
          cablePopupContent.style.boxSizing = 'border-box';
          cablePopupContent.innerHTML = `
            <div style="display:inline-flex; align-items:center; gap:4px; background:#fef3c7; border:1px solid #fcd34d; color:#92400e; font-size:10px; font-weight:800; padding:1.5px 6px; border-radius:5px; text-transform:uppercase; letter-spacing:0.02em; margin-bottom:5px; max-width:calc(100% - 26px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ⚡ Kabel Distribusi · ${effectiveFeeder}
            </div>
            <div style="font-weight:900; font-size:14.5px; color:#090d16; line-height:1.2; margin-bottom:2px; letter-spacing:-0.01em; padding-right:16px;">
              ${fromPole.code} ↔ ${toPole.code}
            </div>
            <div style="font-size:11px; font-weight:700; color:#1e293b; margin-bottom:6px;">
              Panjang Bentangan: <b style="color:#0284c7; font-weight:800;">${span.lengthMeters} meter</b>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom:6px; font-size:10.5px;">
              <div style="background:#f1f5f9; padding:4px 6px; border-radius:6px; border:1px solid #cbd5e1; font-weight:600;">
                <span style="color:#64748b; font-size:9.5px; display:block;">Konduktor</span>
                <b style="color:#090d16; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${span.conductorType}</b>
              </div>
              <div style="background:#f1f5f9; padding:4px 6px; border-radius:6px; border:1px solid #cbd5e1; display:flex; flex-direction:column; justify-content:center; font-weight:600;">
                <span style="color:#64748b; font-size:9.5px; display:block;">Kondisi</span>
                <b style="color:#090d16; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${span.cableCondition || 'Baik'}</b>
              </div>
            </div>

            <div style="background:${isCableCritical ? '#fee2e2' : isCableViolation ? '#fef3c7' : '#f0fdf4'}; color:${isCableCritical ? '#991b1b' : isCableViolation ? '#78350f' : '#166534'}; padding:4px 7px; border-radius:6px; border:1px solid ${isCableCritical ? '#f87171' : isCableViolation ? '#fcd34d' : '#86efac'}; margin-bottom:6px;">
              <div style="font-weight:700; font-size:10px;">Pohon: <b>${span.treeDistanceMeters ?? 3.5}m</b> | Bgn: <b>${span.buildingDistanceMeters ?? 4.0}m</b></div>
              <div style="font-size:10.5px; font-weight:900; margin-top:1px;">
                ${isCableCritical ? '🔴 Bahaya Kritis (<1.5m)' : isCableViolation ? '🟡 Pelanggaran ROW (<3.0m)' : '✅ Sesuai Standar ROW (≥3.0m)'}
              </div>
            </div>

            <!-- Foto Kondisi Kabel Section -->
            <div class="cable-photo-box" style="margin-bottom:6px;">
              ${span.photoUrl ? `
                <div style="border-radius:6px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                  <div class="btn-zoom-cable-img" style="position:relative; width:100%; height:85px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                    <img src="${span.photoUrl}" alt="Kondisi Kabel" style="width:100%; height:100%; object-fit:cover;" />
                    <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding:2px 6px; color:white; font-size:9.5px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                      <span>📸 Foto Kabel</span>
                      <span style="font-size:9px; background:rgba(255,255,255,0.3); padding:1px 4px; border-radius:3px;">🔍 Zoom</span>
                    </div>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 8px; font-size:10.5px; background:#f1f5f9; border-top:1px solid #cbd5e1;">
                    <label style="color:#0284c7; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:3px;">
                      🔄 Ganti
                      <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                    </label>
                    <button class="btn-del-cable-photo" style="color:#dc2626; font-weight:800; background:none; border:none; cursor:pointer; font-size:10.5px;">
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              ` : `
                <label style="display:flex; align-items:center; justify-content:center; gap:5px; background:#f0f9ff; border:1px dashed #0284c7; border-radius:6px; padding:6px 8px; cursor:pointer; color:#0284c7; font-size:11px; font-weight:700;" class="dropzone-cable-photo">
                  <span>📷 Unggah Foto Kondisi Kabel</span>
                  <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                </label>
              `}
            </div>

            <!-- Navigasi ke Kabel: Primary Action -->
            <button type="button" class="btn-nav-to-cable" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; font-weight:900; padding:7px 10px; background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); border:1px solid #60a5fa; border-radius:7px; color:#ffffff; cursor:pointer; box-shadow:0 2px 6px rgba(37,99,235,0.35); text-align:center; margin-bottom:5px;">
              <span style="font-size:14px;">🧭</span>
              <span>Navigasi ke Kabel</span>
            </button>

            <!-- Secondary Actions: Ubah & Hapus Kabel in 2 columns -->
            <div class="cable-popup-actions">
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                <button type="button" class="btn-edit-cable-act" style="background:#f59e0b; color:#0f172a; font-size:10.5px; padding:6px 4px; border-radius:6px; border:1px solid #d97706; font-weight:900; cursor:pointer; text-align:center;">
                  ✏️ Ubah Info
                </button>
                <button type="button" class="btn-delete-cable-act" style="background:#fff1f2; color:#be123c; font-size:10.5px; padding:6px 4px; border-radius:6px; border:1px solid #fecdd3; font-weight:800; cursor:pointer; text-align:center;">
                  🗑️ Hapus Kabel
                </button>
              </div>
            </div>
          `;

          const bindCablePhotoEvents = () => {
            const zoomBtn = cablePopupContent.querySelector('.btn-zoom-cable-img');
            if (zoomBtn && span.photoUrl) {
              zoomBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                setPreviewPhoto({
                  url: span.photoUrl!,
                  title: `Kabel Bentangan ${fromPole.code} ↔ ${toPole.code}`,
                  subtitle: `${span.conductorType} · Spat ${span.lengthMeters}m · Kondisi: ${span.cableCondition || 'Baik'}`
                });
              });
            }

            const photoInputs = cablePopupContent.querySelectorAll('.input-cable-photo');
            photoInputs.forEach(input => {
              input.addEventListener('change', async (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const photoBox = cablePopupContent.querySelector('.cable-photo-box');
                if (photoBox) {
                  photoBox.innerHTML = '<div style="text-align:center; padding:10px; font-size:11px; color:#0284c7; font-weight:bold;">⏳ Mengunggah foto kondisi kabel...</div>';
                }
                try {
                  const base64 = await compressImageFile(file);
                  span.photoUrl = base64;
                  if (onUpdateSpan) {
                    onUpdateSpan({ ...span, photoUrl: base64 });
                  }
                  renderCablePhotoSection();
                } catch (err) {
                  console.error('Error uploading cable photo:', err);
                  renderCablePhotoSection();
                }
              });
            });

            const delBtn = cablePopupContent.querySelector('.btn-del-cable-photo');
            if (delBtn) {
              delBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                span.photoUrl = undefined;
                if (onUpdateSpan) {
                  onUpdateSpan({ ...span, photoUrl: undefined });
                }
                renderCablePhotoSection();
              });
            }
          };

          const renderCablePhotoSection = () => {
            const photoBox = cablePopupContent.querySelector('.cable-photo-box');
            if (!photoBox) return;
            if (span.photoUrl) {
              photoBox.innerHTML = `
                <div style="border-radius:6px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                  <div class="btn-zoom-cable-img" style="position:relative; width:100%; height:85px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                    <img src="${span.photoUrl}" alt="Kondisi Kabel" style="width:100%; height:100%; object-fit:cover;" />
                    <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:2px 6px; color:white; font-size:9.5px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                      <span>📸 Foto Kabel</span>
                      <span style="font-size:9px; background:rgba(255,255,255,0.25); padding:1px 4px; border-radius:3px;">🔍 Zoom</span>
                    </div>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 8px; font-size:10.5px; background:#f1f5f9; border-top:1px solid #cbd5e1;">
                    <label style="color:#0284c7; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;">
                      🔄 Ganti
                      <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                    </label>
                    <button class="btn-del-cable-photo" style="color:#ef4444; font-weight:700; background:none; border:none; cursor:pointer; font-size:10.5px;">
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              `;
            } else {
              photoBox.innerHTML = `
                <label style="display:flex; align-items:center; justify-content:center; gap:5px; background:#f0f9ff; border:1px dashed #0284c7; border-radius:6px; padding:6px 8px; cursor:pointer; color:#0369a1; font-size:11px; font-weight:700;" class="dropzone-cable-photo">
                  <span>📷 Unggah Foto Kondisi Kabel</span>
                  <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                </label>
              `;
            }
            bindCablePhotoEvents();
          };

          bindCablePhotoEvents();

          const editCableBtn = cablePopupContent.querySelector('.btn-edit-cable-act');
          if (editCableBtn) {
            editCableBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              map.closePopup();
              setSelectedSpanForEdit(span);
            });
          }

          const actionsContainer = cablePopupContent.querySelector('.cable-popup-actions') as HTMLElement | null;
          const deleteCableBtn = cablePopupContent.querySelector('.btn-delete-cable-act');
          if (deleteCableBtn && actionsContainer) {
            deleteCableBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              actionsContainer.innerHTML = `
                <div style="background:#fef2f2; border:1px solid #f87171; border-radius:6px; padding:6px; width:100%; text-align:center;">
                  <div style="font-size:10.5px; font-weight:bold; color:#991b1b; margin-bottom:5px;">
                    ⚠️ Hapus kabel ini dari sistem?
                  </div>
                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                    <button class="btn-do-delete-cable" style="background:#dc2626; color:white; font-size:10px; padding:5px; border-radius:5px; border:none; font-weight:bold; cursor:pointer;">
                      ✓ Ya, Hapus
                    </button>
                    <button class="btn-cancel-delete-cable" style="background:#64748b; color:white; font-size:10px; padding:5px; border-radius:5px; border:none; font-weight:bold; cursor:pointer;">
                      Batal
                    </button>
                  </div>
                </div>
              `;

              const doDeleteBtn = actionsContainer.querySelector('.btn-do-delete-cable');
              const cancelBtn = actionsContainer.querySelector('.btn-cancel-delete-cable');

              if (doDeleteBtn) {
                doDeleteBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  map.closePopup();
                  if (onDeleteSpan) {
                    onDeleteSpan(span.id, span.fromPoleId, span.toPoleId);
                  }
                });
              }

              if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  map.closePopup();
                });
              }
            });
          }

          const navCableBtn = cablePopupContent.querySelector('.btn-nav-to-cable');
          if (navCableBtn) {
            navCableBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              map.closePopup();

              // Start in-app GPS navigation directly on the map dashboard
              startNavigationToCable(span, fromPole, toPole);
            });
          }

          return cablePopupContent;
        }, { autoPan: true, autoPanPadding: [12, 65], maxWidth: 290, minWidth: 240 });

        line.on('click', (e) => {
          if (isPullingCableRef.current) return;
          line.openPopup(e.latlng);
        });

        line.addTo(linesGroup);
      }
    });

    // 4. Helper function to calculate pole visual attributes
    const getPoleVisualAttributes = (pole: PoleData) => {
      const feederColor = feederColors[pole.feeder] || getFeederColor(pole.feeder);

      if (cableColorMode === 'byFeeder') {
        return {
          color: feederColor,
          statusLabel: `Penyulang: ${pole.feeder}`,
          statusType: 'feeder' as const
        };
      }

      const cond = (pole.physicalCondition || 'Baik').toLowerCase();
      const dist = pole.clearanceDistanceMeters;
      const isPhysicallyCritical = cond.includes('korosi') || cond.includes('kritis') || cond.includes('patah');
      const isPhysicallyWarning = cond.includes('perbaikan') || cond.includes('miring') || cond.includes('retak');
      const isDistanceCritical = dist < 1.5;
      const isDistanceWarning = dist < 3.0;

      let color = '#10B981';
      let statusLabel = `🟢 Aman (ROW ${dist}m, Fisik ${pole.physicalCondition})`;
      let statusType: 'critical' | 'warning' | 'safe' = 'safe';

      if (isDistanceCritical || isPhysicallyCritical) {
        color = '#EF4444';
        statusType = 'critical';
        if (isDistanceCritical && isPhysicallyCritical) {
          statusLabel = `🔴 Kritis (Jarak ${dist}m & Fisik ${pole.physicalCondition})`;
        } else if (isDistanceCritical) {
          statusLabel = `🔴 Kritis (Jarak ${dist}m ke ${pole.clearanceObject})`;
        } else {
          statusLabel = `🔴 Kritis (Fisik Tiang: ${pole.physicalCondition})`;
        }
      } else if (isDistanceWarning || isPhysicallyWarning) {
        color = '#F59E0B';
        statusType = 'warning';
        if (isDistanceWarning && isPhysicallyWarning) {
          statusLabel = `🟡 Pelanggaran ROW (${dist}m & Fisik ${pole.physicalCondition})`;
        } else if (isDistanceWarning) {
          statusLabel = `🟡 Pelanggaran ROW (Jarak ${dist}m ke ${pole.clearanceObject})`;
        } else {
          statusLabel = `🟡 Perlu Perbaikan (Fisik Tiang: ${pole.physicalCondition})`;
        }
      }

      return { color, statusLabel, statusType };
    };

    // 5. Render visible poles (Hardware-Accelerated Canvas CircleMarkers for dot pin mode)
    visiblePoles.forEach(pole => {
      const { color: poleColor, statusType } = getPoleVisualAttributes(pole);

      let marker: L.CircleMarker | L.Marker;

      if (pinStyle === 'googleEarth') {
        // High-Performance Hardware-Accelerated Canvas CircleMarker
        marker = L.circleMarker([pole.lat, pole.lng], {
          radius: 6.5,
          fillColor: poleColor,
          fillOpacity: 0.95,
          color: '#000000',
          weight: 2,
          renderer: canvasRenderer
        });
      } else {
        const iconHtml = `
          <div style="
            background-color: ${poleColor};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid #FFFFFF;
            box-shadow: 0 3px 8px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 11px;
            font-family: sans-serif;
          ">
            ${pole.type === 'Gardu Trafo' ? 'G' : pole.type === 'TR' ? 'TR' : 'TM'}
          </div>
        `;
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-pole-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        marker = L.marker([pole.lat, pole.lng], { icon: customIcon });
      }

      const compactRowStatus = statusType === 'critical'
        ? '🔴 Kritis'
        : statusType === 'warning'
          ? '🟡 Pelanggaran ROW'
          : '🟢 Aman';

      const feederOrRowBadge = cableColorMode === 'byFeeder'
        ? `⚡ ${pole.feeder}`
        : `${compactRowStatus} (${pole.clearanceDistanceMeters}m)`;

      marker.bindTooltip(
        `<div style="box-sizing:border-box; width:100%; min-width:320px; max-width:440px; font-family:inherit; overflow:hidden;">` +
          `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; border-bottom:1.5px solid #e2e8f0; padding-bottom:4px; margin-bottom:5px;">` +
            `<div style="font-size:14px; font-weight:900; color:#090d16; letter-spacing:-0.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">` +
              `${pole.code} <span style="font-size:12px; font-weight:800; color:#0284c7;">(${pole.type})</span>` +
            `</div>` +
            `<div style="font-size:11px; font-weight:800; padding:2px 7px; border-radius:5px; background:#f1f5f9; border:1px solid #cbd5e1; color:${poleColor}; white-space:nowrap; flex-shrink:0;">` +
              `${feederOrRowBadge}` +
            `</div>` +
          `</div>` +
          `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; margin-bottom:5px;">` +
            `<div style="font-weight:700; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;" title="${pole.locationName}">` +
              `📍 ${pole.locationName}` +
            `</div>` +
            `<div style="font-size:11px; font-weight:800; color:${pole.physicalCondition === 'Baik' ? '#14532d' : '#991b1b'}; background:${pole.physicalCondition === 'Baik' ? '#dcfce7' : '#fee2e2'}; border:1px solid ${pole.physicalCondition === 'Baik' ? '#86efac' : '#fca5a5'}; padding:1.5px 7px; border-radius:5px; white-space:nowrap; flex-shrink:0;">` +
              `Fisik: ${pole.physicalCondition}` +
            `</div>` +
          `</div>` +
          `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11.5px; font-weight:700; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; padding:4px 8px; border-radius:6px; overflow:hidden;">` +
            `<span style="white-space:nowrap; flex-shrink:0;">Jarak ROW: <b style="color:#090d16; font-size:12px;">${pole.clearanceDistanceMeters}m</b></span>` +
            `<span style="color:#64748b; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; text-align:right;" title="${pole.clearanceObject}">Objek: <b style="color:#1e293b;">${pole.clearanceObject}</b></span>` +
          `</div>` +
        `</div>`,
        { sticky: true, direction: 'top', opacity: 1.0, className: 'custom-map-tooltip' }
      );

      const createPolePopup = () => {
        if (isPullingCableRef.current) {
          const dummy = document.createElement('div');
          dummy.style.display = 'none';
          return dummy;
        }

        const connectedSpansToPole = getPoleConnectedSpans(pole);

        let connectedCablesHtml = '';
        if (connectedSpansToPole.length > 0) {
          connectedCablesHtml = `
            <div style="margin-bottom:6px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:7px; overflow:hidden;">
              <div style="background:#e2e8f0; padding:3px 6px; font-size:10px; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:4px;">
                ⚡ Kabel Terhubung (${connectedSpansToPole.length}):
              </div>
              <div style="max-height:65px; overflow-y:auto; padding:2px;">
                ${connectedSpansToPole.map(s => {
                  const otherId = (s.fromPoleId.toLowerCase() === pole.id.toLowerCase() || s.fromPoleId.toLowerCase() === pole.code.toLowerCase())
                    ? s.toPoleId
                    : s.fromPoleId;
                  const otherPole = poleMap.get(otherId);
                  const otherCode = otherPole?.code || otherId;
                  return `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; font-size:10.5px; border-bottom:1px solid #e2e8f0; background:#ffffff;">
                      <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:${isPetugasRowRef.current ? '220px' : '130px'}; font-weight:700; color:#0f172a;">
                        <b>↔ ${otherCode}</b> (${s.lengthMeters}m)
                      </div>
                      ${!isPetugasRowRef.current ? `
                        <div style="display:flex; gap:3px;">
                          <button data-id="${s.id}" class="btn-pole-edit-span" style="background:#f59e0b; color:#0f172a; padding:2px 6px; border-radius:4px; border:1px solid #d97706; font-size:10px; font-weight:800; cursor:pointer;">Ubah</button>
                          <button data-id="${s.id}" class="btn-pole-del-span" style="background:#ef4444; color:#ffffff; padding:2px 6px; border-radius:4px; border:1px solid #dc2626; font-size:10px; font-weight:800; cursor:pointer;">Hapus</button>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        const popupContent = document.createElement('div');
        popupContent.className = 'custom-pole-popup p-3 text-slate-900 font-sans';
        popupContent.style.width = '275px';
        popupContent.style.maxWidth = 'min(285px, 84vw)';
        popupContent.style.boxSizing = 'border-box';
        popupContent.innerHTML = `
          <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px; padding-right:26px; flex-wrap:nowrap; overflow:hidden;">
            <div style="display:inline-flex; align-items:center; gap:4px; background:#fef3c7; border:1px solid #fcd34d; color:#92400e; font-size:10px; font-weight:800; padding:1.5px 6px; border-radius:5px; text-transform:uppercase; letter-spacing:0.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ⚡ ${pole.feeder} · ${pole.type}
            </div>
            <div style="display:inline-flex; align-items:center; font-size:10px; font-weight:700; color:#475569; background:#f1f5f9; border:1px solid #cbd5e1; padding:1.5px 6px; border-radius:5px; white-space:nowrap; flex-shrink:0;">
              Thn ${pole.installationYear}
            </div>
          </div>
          <div style="font-weight:900; font-size:14.5px; color:#090d16; line-height:1.2; margin-bottom:2px; letter-spacing:-0.01em; padding-right:16px;">
            ${pole.id} <span style="font-size:12.5px; font-weight:800; color:#0284c7;">(${pole.code})</span>
          </div>
          <div style="font-size:11px; font-weight:600; color:#475569; margin-bottom:6px; display:flex; align-items:center; gap:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${pole.locationName}">
            <span>📍</span> <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pole.locationName}</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-bottom:6px;">
            <div style="background:${pole.physicalCondition === 'Baik' ? '#dcfce7' : '#fee2e2'}; color:${pole.physicalCondition === 'Baik' ? '#14532d' : '#991b1b'}; font-size:10px; font-weight:800; padding:3px 6px; border-radius:6px; border:1px solid ${pole.physicalCondition === 'Baik' ? '#86efac' : '#f87171'}; text-align:center;">
              Fisik: ${pole.physicalCondition}
            </div>
            <div style="background:${pole.clearanceDistanceMeters >= 3.0 ? '#dbeafe' : '#fef3c7'}; color:${pole.clearanceDistanceMeters >= 3.0 ? '#1e40af' : '#78350f'}; font-size:10px; font-weight:800; padding:3px 6px; border-radius:6px; border:1px solid ${pole.clearanceDistanceMeters >= 3.0 ? '#93c5fd' : '#fcd34d'}; text-align:center;">
              ROW: ${pole.clearanceDistanceMeters}m
            </div>
          </div>

          <div style="background:${pole.clearanceDistanceMeters < 1.5 ? '#fee2e2' : pole.clearanceDistanceMeters < 3.0 ? '#fef3c7' : '#f0fdf4'}; color:${pole.clearanceDistanceMeters < 1.5 ? '#991b1b' : pole.clearanceDistanceMeters < 3.0 ? '#78350f' : '#166534'}; border:1px solid ${pole.clearanceDistanceMeters < 1.5 ? '#fca5a5' : pole.clearanceDistanceMeters < 3.0 ? '#fde68a' : '#bbf7d0'}; border-radius:6px; padding:3px 7px; font-size:10.5px; font-weight:800; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <span>${pole.clearanceStatus}</span>
            <span style="font-size:9.5px; font-weight:600; opacity:0.85;">Insp: ${pole.lastInspectionDate}</span>
          </div>

          ${connectedCablesHtml}

          <!-- Foto Kondisi Tiang Section (Compact) -->
          <div class="pole-photo-box" style="margin-bottom:6px;">
            ${pole.photoUrl ? `
              <div style="border-radius:6px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                <div class="btn-zoom-pole-img" style="position:relative; width:100%; height:85px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                  <img src="${pole.photoUrl}" alt="Kondisi Tiang ${pole.code}" style="width:100%; height:100%; object-fit:cover;" />
                  <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding:2px 6px; color:white; font-size:9.5px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                    <span>📸 Foto Tiang</span>
                    <span style="font-size:9px; background:rgba(255,255,255,0.3); padding:1px 4px; border-radius:3px;">🔍 Zoom</span>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 8px; font-size:10.5px; background:#f1f5f9; border-top:1px solid #cbd5e1;">
                  <label style="color:#0284c7; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:3px;">
                    🔄 Ganti
                    <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
                  </label>
                  <button class="btn-del-pole-photo" style="color:#dc2626; font-weight:800; background:none; border:none; cursor:pointer; font-size:10.5px;">
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            ` : `
              <label style="display:flex; align-items:center; justify-content:center; gap:5px; background:#f0f9ff; border:1px dashed #0284c7; border-radius:6px; padding:6px 8px; cursor:pointer; color:#0284c7; font-size:11px; font-weight:700;" class="dropzone-pole-photo">
                <span>📷 Unggah Foto Kondisi Tiang</span>
                <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
              </label>
            `}
          </div>

          <!-- Navigasi ke Tiang: Primary Action -->
          <button type="button" class="btn-nav-to-pole" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; font-weight:900; padding:7px 10px; background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); border:1px solid #60a5fa; border-radius:7px; color:#ffffff; cursor:pointer; box-shadow:0 2px 6px rgba(37,99,235,0.35); text-align:center; margin-bottom:5px;">
            <span style="font-size:14px;">🧭</span>
            <span>Navigasi ke Tiang</span>
          </button>

          ${!isPetugasRowRef.current ? `
            <!-- Secondary Actions: 3 Columns Grid -->
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:4px; margin-bottom:5px;">
              <button type="button" class="btn-cable-pull-act" style="background:#0284c7; color:#ffffff; font-size:10px; padding:6px 2px; border-radius:6px; border:1px solid #0369a1; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:2px; white-space:nowrap;">
                ⚡ Tarik Kabel
              </button>
              <button type="button" class="btn-inspect-act" style="background:#0f172a; color:#ffffff; font-size:10px; padding:6px 2px; border-radius:6px; border:1px solid #0f172a; font-weight:800; cursor:pointer; text-align:center; white-space:nowrap;">
                + Inspeksi
              </button>
              <button type="button" class="btn-spk-act" style="background:#f59e0b; color:#0f172a; font-size:10px; padding:6px 2px; border-radius:6px; border:1px solid #d97706; font-weight:900; cursor:pointer; text-align:center; white-space:nowrap;">
                + SPK Rabas
              </button>
            </div>

            <!-- Danger Action: Compact & Safe -->
            <button type="button" class="btn-delete-act" style="width:100%; background:#fff1f2; color:#be123c; font-size:10px; padding:4px 6px; border-radius:5px; border:1px solid #fecdd3; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
              🗑️ Hapus Titik Tiang Ini
            </button>
          ` : ''}
        `;

        const bindPolePhotoEvents = () => {
          const zoomBtn = popupContent.querySelector('.btn-zoom-pole-img');
          if (zoomBtn && pole.photoUrl) {
            zoomBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              setPreviewPhoto({
                url: pole.photoUrl!,
                title: `Tiang ${pole.id} (${pole.code})`,
                subtitle: `${pole.locationName} · ${pole.feeder} · Kondisi: ${pole.physicalCondition}`
              });
            });
          }

          const photoInputs = popupContent.querySelectorAll('.input-pole-photo');
          photoInputs.forEach(input => {
            input.addEventListener('change', async (ev) => {
              const file = (ev.target as HTMLInputElement).files?.[0];
              if (!file) return;
              const photoBox = popupContent.querySelector('.pole-photo-box');
              if (photoBox) {
                photoBox.innerHTML = '<div style="text-align:center; padding:10px; font-size:11px; color:#0284c7; font-weight:bold;">⏳ Mengunggah foto kondisi tiang...</div>';
              }
              try {
                const base64 = await compressImageFile(file);
                pole.photoUrl = base64;
                if (onUpdatePole) {
                  onUpdatePole({ ...pole, photoUrl: base64 });
                }
                renderPolePhotoSection();
              } catch (err) {
                console.error('Error uploading pole photo:', err);
                renderPolePhotoSection();
              }
            });
          });

          const delBtn = popupContent.querySelector('.btn-del-pole-photo');
          if (delBtn) {
            delBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              pole.photoUrl = undefined;
              if (onUpdatePole) {
                onUpdatePole({ ...pole, photoUrl: undefined });
              }
              renderPolePhotoSection();
            });
          }
        };

        const renderPolePhotoSection = () => {
          const photoBox = popupContent.querySelector('.pole-photo-box');
          if (!photoBox) return;
          if (pole.photoUrl) {
            photoBox.innerHTML = `
              <div style="border-radius:6px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                <div class="btn-zoom-pole-img" style="position:relative; width:100%; height:85px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                  <img src="${pole.photoUrl}" alt="Kondisi Tiang ${pole.code}" style="width:100%; height:100%; object-fit:cover;" />
                  <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:2px 6px; color:white; font-size:9.5px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                    <span>📸 Foto Tiang</span>
                    <span style="font-size:9px; background:rgba(255,255,255,0.25); padding:1px 4px; border-radius:3px;">🔍 Zoom</span>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 8px; font-size:10.5px; background:#f1f5f9; border-top:1px solid #cbd5e1;">
                  <label style="color:#0284c7; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;">
                    🔄 Ganti
                    <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
                  </label>
                  <button class="btn-del-pole-photo" style="color:#ef4444; font-weight:700; background:none; border:none; cursor:pointer; font-size:10.5px;">
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            `;
          } else {
            photoBox.innerHTML = `
              <label style="display:flex; align-items:center; justify-content:center; gap:5px; background:#f0f9ff; border:1px dashed #0284c7; border-radius:6px; padding:6px 8px; cursor:pointer; color:#0284c7; font-size:11px; font-weight:700;" class="dropzone-pole-photo">
                <span>📷 Unggah Foto Kondisi Tiang</span>
                <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
              </label>
            `;
          }
          bindPolePhotoEvents();
        };

        bindPolePhotoEvents();

        popupContent.querySelectorAll('.btn-pole-edit-span').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const sId = (btn as HTMLElement).dataset.id;
            const targetSpan = spans.find(s => s.id === sId);
            if (targetSpan) {
              marker.closePopup();
              setSelectedSpanForEdit(targetSpan);
            }
          });
        });

        popupContent.querySelectorAll('.btn-pole-del-span').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const sId = (btn as HTMLElement).dataset.id;
            const targetSpan = spans.find(s => s.id === sId);
            if (targetSpan) {
              const el = btn as HTMLElement;
              if (el.dataset.confirming === 'true') {
                marker.closePopup();
                if (onDeleteSpan) {
                  onDeleteSpan(targetSpan.id, targetSpan.fromPoleId, targetSpan.toPoleId);
                }
              } else {
                el.dataset.confirming = 'true';
                el.textContent = 'Yakin?';
                el.style.background = '#991b1b';
                setTimeout(() => {
                  if (el.dataset.confirming === 'true') {
                    el.dataset.confirming = 'false';
                    el.textContent = 'Hapus';
                    el.style.background = '#ef4444';
                  }
                }, 4000);
              }
            }
          });
        });

        const inspectBtn = popupContent.querySelector('.btn-inspect-act');
        if (inspectBtn) {
          inspectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onOpenAddInspection(pole);
          });
        }

        const spkBtn = popupContent.querySelector('.btn-spk-act');
        if (spkBtn) {
          spkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onCreateSpkForPole(pole);
          });
        }

        const pullBtn = popupContent.querySelector('.btn-cable-pull-act');
        if (pullBtn) {
          pullBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            marker.closePopup();
            startDraggingCableFromPole(pole, false);
          });
        }

        const deleteBtn = popupContent.querySelector('.btn-delete-act');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            marker.closePopup();
            if (onDeletePole) {
              onDeletePole(pole.id);
            }
          });
        }

        const navBtn = popupContent.querySelector('.btn-nav-to-pole');
        if (navBtn) {
          navBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            marker.closePopup();

            // Start real-time GPS tracking with watchPosition, draw in-app route polyline & show floating HUD card
            startNavigationToPole(pole);
          });
        }

        return popupContent;
      };

      marker.bindPopup(createPolePopup, { autoPan: true, autoPanPadding: [12, 65], maxWidth: 290, minWidth: 240 });

      // Suppress popup if opened while cable pulling mode is active
      marker.on('popupopen', () => {
        if (isPullingCableRef.current) {
          marker.closePopup();
        }
      });

      // Handle clicking, dragging, and dropping on this marker during cable pulling
      marker.on('click', (e) => {
        downPoleRef.current = null;
        if (isPullingCableRef.current) {
          L.DomEvent.stopPropagation(e);
          marker.closePopup();
          if (!cableSourcePoleRef.current) {
            startDraggingCableFromPole(pole, false);
            return;
          } else if (cableSourcePoleRef.current.id.toLowerCase() !== pole.id.toLowerCase()) {
            finishConnectingCable(pole);
            return;
          }
        } else {
          // Explicitly open popup on click so it never gets dropped or suppressed
          marker.openPopup();
        }
      });

      marker.on('mousedown', (e) => {
        const mouseEvt = e.originalEvent as MouseEvent;
        if (mouseEvt && mouseEvt.button !== 0) return;

        // CRITICAL: Stop propagation so Leaflet's map pan does not hijack this marker gesture!
        L.DomEvent.stopPropagation(e);

        if (isPullingCableRef.current) {
          marker.closePopup();
          if (!cableSourcePoleRef.current) {
            startDraggingCableFromPole(pole, true);
          }
        } else {
          // Record start position for natural click-and-drag detection
          const containerPt = e.containerPoint || (mapInstanceRef.current ? mapInstanceRef.current.latLngToContainerPoint([pole.lat, pole.lng]) : null);
          if (containerPt) {
            downPoleRef.current = { pole, pt: containerPt };
          }
        }
      });

      marker.on('mouseup', (e) => {
        downPoleRef.current = null;
        if (isPullingCableRef.current && cableSourcePoleRef.current) {
          if (cableSourcePoleRef.current.id.toLowerCase() !== pole.id.toLowerCase()) {
            L.DomEvent.stopPropagation(e);
            finishConnectingCable(pole);
          }
        }
      });

      marker.on('mouseover', () => {
        if (isPullingCableRef.current && cableSourcePoleRef.current && cableSourcePoleRef.current.id.toLowerCase() !== pole.id.toLowerCase()) {
          setSnapTargetPole(pole);
          snapTargetPoleRef.current = pole;
        }
      });

      marker.addTo(markersGroup);
    });
  }, [
    filteredPoles,
    spans,
    isClusterMode,
    activeFeedersMap,
    feederVisibility,
    showHeatmap,
    cableColorMode,
    pinStyle,
    selectedFeeder,
    selectedCondition,
    showRowOnly,
    searchQuery,
    feederColors,
    startDraggingCableFromPole,
    finishConnectingCable,
    onCreateSpkForPole,
    onDeletePole,
    onUpdatePole,
    onDeleteSpan,
    onUpdateSpan,
    onOpenAddInspection
  ]);

  // Hook renderMapLayers to moveend and zoomend with requestAnimationFrame
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let animFrameId: number | null = null;
    const handleMoveOrZoom = () => {
      // CRITICAL: Do NOT clear and destroy layers if a popup is currently open on the map
      // This prevents destroying active markers/lines and preserves mouse cursor responsiveness
      if (map.getContainer().querySelector('.leaflet-popup')) {
        return;
      }
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(() => {
        renderMapLayers();
      });
    };

    // When popup closes, re-verify map dragging and cursor
    const handlePopupClose = () => {
      if (!isPullingCableRef.current) {
        map.getContainer().classList.remove('cable-pulling-mode');
        const draggable = (map.dragging as any)?._draggable;
        if (draggable) {
          draggable._moving = false;
          draggable._moved = false;
        }
        (L.Draggable as any)._dragging = false;
        if (!map.dragging.enabled()) {
          map.dragging.enable();
        }
      }
    };

    // Initial render
    renderMapLayers();

    // Listen to moveend and zoomend so panning gestures run smoothly at 60 FPS
    map.on('moveend zoomend', handleMoveOrZoom);
    map.on('popupclose', handlePopupClose);

    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      map.off('moveend zoomend', handleMoveOrZoom);
      map.off('popupclose', handlePopupClose);
    };
  }, [renderMapLayers]);

  const clearMeasurement = () => {
    setMeasurePoints([]);
    setMeasuredDistance(null);
    setIsMeasuring(false);
  };

  const stopGpsTracking = useCallback(() => {
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    setIsGpsActive(false);
    isGpsActiveRef.current = false;
    setGpsStatus('idle');
    setGpsErrorMessage(null);
    setUserCoords(null);
    userCoordsRef.current = null;
    setIsFollowingUser(false);
    isFollowingUserRef.current = false;
    setActiveNavTarget(null);
    activeNavTargetRef.current = null;
    setActiveNavPole(null);
    activeNavPoleRef.current = null;
    setRouteGeometry(null);
    routeGeometryRef.current = null;
    setNavDistanceMeters(null);
    setCompassBearing(null);
    lastRouteFetchCoordsRef.current = null;
    if (gpsLayerRef.current) {
      gpsLayerRef.current.clearLayers();
    }
  }, []);

  // Bearing calculation & cardinal direction helpers for live GPS turn guidance
  const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number): number => {
    const startLatRad = (startLat * Math.PI) / 180;
    const startLngRad = (startLng * Math.PI) / 180;
    const destLatRad = (destLat * Math.PI) / 180;
    const destLngRad = (destLng * Math.PI) / 180;
    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  };

  const getCardinalDirection = (bearing: number): string => {
    const directions = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
    const idx = Math.round(bearing / 45) % 8;
    return directions[idx];
  };

  const startGpsTracking = useCallback((autoCenter: boolean = true) => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMessage('Perangkat Anda tidak mendukung fitur Geolocation / GPS.');
      return;
    }

    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }

    setIsGpsActive(true);
    isGpsActiveRef.current = true;
    setGpsStatus('searching');
    setGpsErrorMessage(null);

    let hasCentered = !autoCenter;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const newCoords = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 15,
          heading: heading ?? null,
          speed: speed ?? null
        };
        setUserCoords(newCoords);
        userCoordsRef.current = newCoords;
        setGpsStatus('locked');
        setGpsErrorMessage(null);

        try {
          localStorage.setItem('pln_geo_permission', 'granted');
        } catch {}

        // Center map on first GPS acquisition or follow user smoothly
        if (!hasCentered && mapInstanceRef.current) {
          hasCentered = true;
          mapInstanceRef.current.setView([latitude, longitude], 17, { animate: true });
        } else if (isFollowingUserRef.current && mapInstanceRef.current && activeNavTargetRef.current) {
          mapInstanceRef.current.panTo([latitude, longitude], { animate: true, duration: 0.5 });
        }
      },
      (err) => {
        console.warn('Geolocation watchPosition error:', err);
        let msg = 'Gagal memperoleh posisi GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Izin akses lokasi GPS ditolak oleh browser. Silakan aktifkan izin lokasi di peramban Anda.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Sinyal GPS tidak tersedia. Pastikan sensor lokasi perangkat telah aktif.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Waktu pencarian sinyal GPS habis. Memeriksa sinyal kembali...';
        }
        setGpsErrorMessage(msg);
        setGpsStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 1000
      }
    );

    gpsWatchIdRef.current = watchId;
  }, []);

  const handleToggleGps = useCallback(() => {
    if (isGpsActive || isGpsActiveRef.current) {
      stopGpsTracking();
    } else {
      startGpsTracking(true);
    }
  }, [isGpsActive, startGpsTracking, stopGpsTracking]);

  const handleMyLocation = handleToggleGps;

  const fetchRoadRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    setIsLoadingRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
          const latlngs: [number, number][] = data.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
          );
          setRouteGeometry(latlngs);
          routeGeometryRef.current = latlngs;
          if (data.routes[0].distance) {
            setNavDistanceMeters(Math.round(data.routes[0].distance));
          }
          return;
        }
      }
    } catch (err) {
      console.warn('OSRM routing fetch failed, fallback to straight line:', err);
    } finally {
      setIsLoadingRoute(false);
    }

    // Direct line fallback
    const fallback = [start, end] as [number, number][];
    setRouteGeometry(fallback);
    routeGeometryRef.current = fallback;
    const straight = calculateHaversineDistanceMeters(start[0], start[1], end[0], end[1]);
    setNavDistanceMeters(Math.round(straight));
  }, []);

  const startNavigationToTarget = useCallback((target: NavigationTarget) => {
    setActiveNavTarget(target);
    activeNavTargetRef.current = target;
    setIsFollowingUser(true);
    isFollowingUserRef.current = true;

    if (!isGpsActiveRef.current) {
      startGpsTracking(false);
    }

    if (userCoordsRef.current) {
      const start: [number, number] = [userCoordsRef.current.lat, userCoordsRef.current.lng];
      const end: [number, number] = [target.lat, target.lng];
      lastRouteFetchCoordsRef.current = { lat: userCoordsRef.current.lat, lng: userCoordsRef.current.lng };
      fetchRoadRoute(start, end);

      const brng = calculateBearing(start[0], start[1], end[0], end[1]);
      setCompassBearing(Math.round(brng));

      if (mapInstanceRef.current) {
        const bounds = L.latLngBounds([start, end]);
        mapInstanceRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
      }
    } else {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([target.lat, target.lng], 16, { animate: true });
      }
    }
  }, [startGpsTracking, fetchRoadRoute]);

  const startNavigationToPole = useCallback((pole: PoleData) => {
    const target: NavigationTarget = {
      type: 'pole',
      id: pole.id,
      code: pole.code || pole.id,
      name: `Tiang ${pole.code || pole.id}`,
      feeder: pole.feeder,
      lat: pole.lat,
      lng: pole.lng,
      pole: pole,
      locationName: pole.locationName,
      extraInfo: `ROW: ${pole.clearanceDistanceMeters}m · ${pole.physicalCondition}`
    };
    startNavigationToTarget(target);
  }, [startNavigationToTarget]);

  const startNavigationToCable = useCallback((span: CableSpan, fromPole: PoleData, toPole: PoleData) => {
    const midLat = (fromPole.lat + toPole.lat) / 2;
    const midLng = (fromPole.lng + toPole.lng) / 2;
    const target: NavigationTarget = {
      type: 'cable',
      id: span.id,
      code: `${fromPole.code} ↔ ${toPole.code}`,
      name: `Kabel ${fromPole.code} ↔ ${toPole.code}`,
      feeder: span.feeder || fromPole.feeder || 'Penyulang',
      lat: midLat,
      lng: midLng,
      span: span,
      fromPoleCode: fromPole.code,
      toPoleCode: toPole.code,
      locationName: `Bentangan spat ${span.lengthMeters}m (${fromPole.code} - ${toPole.code})`,
      extraInfo: `Konduktor: ${span.conductorType} · Kondisi: ${span.cableCondition || 'Baik'}`
    };
    startNavigationToTarget(target);
  }, [startNavigationToTarget]);

  const stopNavigation = useCallback(() => {
    setActiveNavTarget(null);
    activeNavTargetRef.current = null;
    setActiveNavPole(null);
    activeNavPoleRef.current = null;
    setRouteGeometry(null);
    routeGeometryRef.current = null;
    setNavDistanceMeters(null);
    setCompassBearing(null);
    lastRouteFetchCoordsRef.current = null;
  }, []);

  const focusRouteBounds = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (routeGeometryRef.current && routeGeometryRef.current.length > 0) {
      const bounds = L.latLngBounds(routeGeometryRef.current);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
    } else if (userCoordsRef.current && activeNavTargetRef.current) {
      const bounds = L.latLngBounds([
        [userCoordsRef.current.lat, userCoordsRef.current.lng],
        [activeNavTargetRef.current.lat, activeNavTargetRef.current.lng]
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
    } else if (userCoordsRef.current) {
      mapInstanceRef.current.setView([userCoordsRef.current.lat, userCoordsRef.current.lng], 17, { animate: true });
    }
  }, []);

  // Update distance, bearing, and dynamic road route recalculation as user moves
  useEffect(() => {
    if (activeNavTarget && userCoords) {
      const dist = calculateHaversineDistanceMeters(
        userCoords.lat,
        userCoords.lng,
        activeNavTarget.lat,
        activeNavTarget.lng
      );
      setNavDistanceMeters(Math.round(dist));

      const brng = calculateBearing(
        userCoords.lat,
        userCoords.lng,
        activeNavTarget.lat,
        activeNavTarget.lng
      );
      setCompassBearing(Math.round(brng));

      const lastFetch = lastRouteFetchCoordsRef.current;
      const movedDist = lastFetch
        ? calculateHaversineDistanceMeters(userCoords.lat, userCoords.lng, lastFetch.lat, lastFetch.lng)
        : Infinity;

      if (!routeGeometryRef.current || movedDist > 25) {
        lastRouteFetchCoordsRef.current = { lat: userCoords.lat, lng: userCoords.lng };
        fetchRoadRoute(
          [userCoords.lat, userCoords.lng],
          [activeNavTarget.lat, activeNavTarget.lng]
        );
      } else if (routeGeometryRef.current && routeGeometryRef.current.length > 0) {
        const updated: [number, number][] = [[userCoords.lat, userCoords.lng], ...routeGeometryRef.current.slice(1)];
        setRouteGeometry(updated);
        routeGeometryRef.current = updated;
      }
    }
  }, [userCoords, activeNavTarget, fetchRoadRoute]);

  // Render User GPS Marker, Accuracy Circle, and Navigation Route Line on Leaflet
  useEffect(() => {
    const layer = gpsLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (!userCoords) return;

    // 1. Accuracy Circle - rendered in 'gpsAccuracyPane' (z-index 350) with interactive: false so it never blocks clicks
    const accuracyCircle = L.circle([userCoords.lat, userCoords.lng], {
      radius: Math.max(userCoords.accuracy || 20, 8),
      color: '#2563eb',
      weight: 1.5,
      opacity: 0.75,
      fillColor: '#3b82f6',
      fillOpacity: 0.16,
      pane: 'gpsAccuracyPane',
      interactive: false
    });
    accuracyCircle.addTo(layer);

    // 2. User Marker with CSS Pulsing Radar Ring & Direction Indicator (in 'gpsUserPane' z-index 660)
    const userMarkerIcon = L.divIcon({
      className: 'user-gps-marker-container',
      html: `
        <div style="position:relative; width:38px; height:38px; display:flex; align-items:center; justify-content:center;">
          <div class="user-gps-radar-pulse" style="position:absolute; inset:0; border-radius:50%; background:rgba(37,99,235,0.35); animation:pln-gps-pulse 2s cubic-bezier(0.2,0,0.4,1) infinite; pointer-events:none;"></div>
          <div style="width:22px; height:22px; border-radius:50%; background:#ffffff; box-shadow:0 3px 10px rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:2; border:1px solid rgba(0,0,0,0.12); pointer-events:none;">
            <div style="width:12px; height:12px; border-radius:50%; background:#1d4ed8; box-shadow:inset 0 1px 2px rgba(0,0,0,0.2);"></div>
          </div>
          ${userCoords.heading !== null && userCoords.heading !== undefined ? `
            <div style="position:absolute; top:-7px; width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-bottom:8px solid #1d4ed8; transform:rotate(${userCoords.heading}deg); transform-origin:bottom center; pointer-events:none;"></div>
          ` : ''}
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const userMarker = L.marker([userCoords.lat, userCoords.lng], {
      icon: userMarkerIcon,
      pane: 'gpsUserPane',
      zIndexOffset: 1000
    });

    userMarker.bindPopup(`
      <div style="font-family:sans-serif; padding:5px; font-size:12px; color:#0f172a; line-height:1.4;">
        <div style="font-weight:900; font-size:13px; color:#1d4ed8; display:flex; align-items:center; gap:5px; margin-bottom:4px;">
          📍 Posisi Anda (Petugas PLN)
        </div>
        <div style="font-weight:700; color:#334155; margin-bottom:2px;">
          Akurasi GPS: <span style="color:#0284c7; font-weight:900;">±${Math.round(userCoords.accuracy)} meter</span>
        </div>
        <div style="font-size:10.5px; color:#64748b; background:#f1f5f9; padding:4px 6px; border-radius:4px; font-family:monospace; margin-top:4px;">
          ${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)}
        </div>
      </div>
    `, { autoPan: false });
    userMarker.addTo(layer);

    // 3. Navigation Route Polyline & Destination Pin
    const navTarget = activeNavTarget;
    if (navTarget) {
      const pts: [number, number][] = (routeGeometry && routeGeometry.length > 0)
        ? routeGeometry
        : [[userCoords.lat, userCoords.lng], [navTarget.lat, navTarget.lng]];

      // Outer glow line - in 'gpsRoutePane' (z-index 380, beneath canvas)
      L.polyline(pts, {
        color: '#0284c7',
        weight: 9,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'gpsRoutePane',
        interactive: false
      }).addTo(layer);

      // Core route polyline - in 'gpsRoutePane' (z-index 380, beneath canvas)
      L.polyline(pts, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        pane: 'gpsRoutePane',
        interactive: false
      }).addTo(layer);

      // Destination Target Pin Marker - in 'gpsUserPane' (interactive: false, pointer-events: none)
      const destIcon = L.divIcon({
        className: 'nav-dest-marker',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center; pointer-events:none;">
            <div style="width:34px; height:34px; background:${navTarget.type === 'cable' ? '#0284c7' : '#ef4444'}; border:3px solid #ffffff; border-radius:50% 50% 50% 0; transform:rotate(-45deg); box-shadow:0 4px 14px rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center;">
              <div style="width:11px; height:11px; background:#ffffff; border-radius:50%; transform:rotate(45deg);"></div>
            </div>
            <div style="margin-top:3px; background:#0f172a; color:#f8fafc; font-size:10px; font-weight:900; padding:2px 7px; border-radius:5px; border:1px solid #38bdf8; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.45);">
              ${navTarget.type === 'cable' ? '⚡ ' : '🎯 '}${navTarget.code}
            </div>
          </div>
        `,
        iconSize: [34, 48],
        iconAnchor: [17, 34]
      });

      L.marker([navTarget.lat, navTarget.lng], {
        icon: destIcon,
        pane: 'gpsUserPane',
        zIndexOffset: 999,
        interactive: false
      }).addTo(layer);
    }
  }, [userCoords, activeNavTarget, routeGeometry]);

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 select-none overflow-hidden">
      
      {/* Pop Out Floating Button (shown when toolbar is hidden / popped in) - Desktop Only */}
      {!isToolbarOpen && (
        <div className="hidden md:block absolute top-2.5 left-1/2 -translate-x-1/2 z-30 transition-all duration-300">
          <button
            onClick={() => setIsToolbarOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-900 via-emerald-800 to-teal-950 hover:from-teal-800 hover:to-emerald-700 text-amber-300 hover:text-white px-4 py-1.5 rounded-full border border-teal-400/40 shadow-2xl backdrop-blur-md text-xs font-black transition-all cursor-pointer group active:scale-95"
            title="Tampilkan Menu Toolbar (Pop Out)"
          >
            <Sliders className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform text-teal-300" />
            <span>Tampilkan Menu Toolbar</span>
            <ChevronDown className="w-3.5 h-3.5 text-teal-300" />
          </button>
        </div>
      )}

      {/* Top Single-Row Filter & Operations Toolbar with Pop In / Pop Out support - Desktop Only */}
      <div
        className={`hidden md:block relative z-20 shadow-md select-none transition-all duration-300 ease-in-out border-b border-teal-500/30 overflow-hidden ${
          isToolbarOpen
            ? 'max-h-16 opacity-100 py-1.5 px-3'
            : 'max-h-0 opacity-0 py-0 px-3 border-b-0 pointer-events-none'
        }`}
      >
        {/* Dynamic Geometric Emerald-Teal to Dark Motif Background */}
        <GeometricBlueHeaderBg variant="toolbar" />

        <div className="relative z-10 flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap w-full">
          
          {/* 1. Pencarian */}
          <div className="relative w-36 sm:w-44 lg:w-48 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-teal-300/70 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari ID, nomor, jalan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 backdrop-blur-md text-white pl-8 pr-6 h-8 rounded-lg border border-teal-500/30 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 text-xs font-medium placeholder-slate-400 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-800 cursor-pointer"
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* 3. Kelola Penyulang Drawer Button */}
          {onOpenFeederDrawer && (
            <button
              onClick={onOpenFeederDrawer}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-teal-500/30 bg-slate-950/80 backdrop-blur-md hover:bg-slate-900 text-slate-200 hover:text-white font-bold cursor-pointer shadow-inner text-xs shrink-0 btn-tactile"
              title="Buka Panel Pengelola Penyulang & Warna Kabel"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Kelola Penyulang</span>
              <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">{allFeeders.length}</span>
            </button>
          )}

          {/* 4. Segmented Control Mode ROW vs Mode Feeder */}
          <div className="flex items-center bg-slate-950/80 backdrop-blur-md p-0.5 rounded-lg border border-teal-500/30 shadow-inner shrink-0 h-8">
            <button
              onClick={() => setCableColorMode('byClearance')}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md cursor-pointer btn-tactile ${
                cableColorMode === 'byClearance'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-semibold'
              }`}
              title="Mode ROW: Pewarnaan tiang & kabel berdasarkan kondisi fisik serta jarak ke lingkungan sekitar"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Mode ROW</span>
            </button>
            <button
              onClick={() => setCableColorMode('byFeeder')}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md cursor-pointer btn-tactile ${
                cableColorMode === 'byFeeder'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-semibold'
              }`}
              title="Mode Feeder: Pewarnaan tiang & kabel berdasarkan penyulang masing-masing"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Mode Feeder</span>
            </button>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-teal-400/30 shrink-0 mx-0.5" />

          {/* 5. Tambah Tiang */}
          <button
            onClick={onAddCustomPole}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 px-3 h-8 rounded-lg font-black text-xs shadow-md cursor-pointer whitespace-nowrap btn-tactile shrink-0"
            title="Tambah Titik Tiang Baru secara manual"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah Tiang</span>
          </button>

          {/* 6. Empat (4) Menu Operasi: Tarik Kabel, Ukur ROW, ROW < 3m, Heatmap (Hanya untuk Admin/Supervisor) */}
          {!isPetugasRow && (
            <>
              {/* Divider */}
              <div className="h-5 w-px bg-teal-400/30 shrink-0 mx-0.5" />

              <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-0.5 rounded-lg border border-teal-500/30 shadow-inner h-8 shrink-0">
                <button
                  onClick={() => {
                    if (isPullingCable) {
                      cancelCablePulling();
                    } else {
                      setIsPullingCable(true);
                      isPullingCableRef.current = true;
                      setCableSourcePole(null);
                      cableSourcePoleRef.current = null;
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.getContainer().classList.add('cable-pulling-mode');
                      }
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold cursor-pointer btn-tactile ${
                    isPullingCable
                      ? 'bg-teal-500 text-slate-950 font-black shadow-xs'
                      : 'text-teal-400 hover:bg-slate-800/80'
                  }`}
                  title="Tarik dan pasang kabel baru antar tiang di peta (Drag & Drop atau Klik Antar Tiang)"
                >
                  <Cable className="w-3.5 h-3.5" />
                  <span>Tarik Kabel</span>
                </button>

                <button
                  onClick={() => {
                    if (isMeasuring) {
                      clearMeasurement();
                    } else {
                      setIsMeasuring(true);
                      setMeasurePoints([]);
                      setMeasuredDistance(null);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold cursor-pointer btn-tactile ${
                    isMeasuring
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                      : 'text-emerald-400 hover:bg-slate-800/80'
                  }`}
                  title="Ukur jarak langsung antara kabel ke pohon atau bangunan"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>{isMeasuring ? 'Batal Ukur' : 'Ukur ROW'}</span>
                </button>

                <button
                  onClick={() => setShowRowOnly(!showRowOnly)}
                  className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold cursor-pointer btn-tactile ${
                    showRowOnly
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-amber-400 hover:bg-slate-800/80'
                  }`}
                  title="Filter hanya menampilkan tiang & kabel dengan ROW < 3 meter"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>ROW &lt; 3m</span>
                </button>

                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold cursor-pointer btn-tactile ${
                    showHeatmap
                      ? 'bg-rose-600 text-white font-black shadow-xs'
                      : 'text-rose-400 hover:bg-slate-800/80'
                  }`}
                  title="Visualisasi Heatmap sebaran tiang berstatus bahaya kritis pada peta"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Heatmap</span>
                </button>
              </div>
            </>
          )}

          {/* Live Counter (Menampilkan:) */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-950/80 backdrop-blur-md px-2.5 h-8 rounded-lg border border-teal-500/30 text-slate-300 shadow-inner shrink-0">
            <span className="text-teal-200/80 font-medium">Menampilkan:</span>
            <span className="font-bold text-amber-400">{filteredPoles.length}</span>
            <span className="text-teal-200/80 font-medium">/ {poles.length} Tiang</span>
            {(searchQuery || selectedFeeder !== 'ALL' || showRowOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFeeder('ALL');
                  setShowRowOnly(false);
                }}
                className="ml-1 text-[11px] text-amber-300 hover:text-white underline cursor-pointer font-bold btn-tactile"
                title="Reset semua filter"
              >
                Reset
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-teal-400/30 shrink-0 mx-0.5" />

          {/* 8. Tombol Sembunyikan Menu (Pop In) */}
          <button
            onClick={() => setIsToolbarOpen(false)}
            className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-teal-500/30 bg-slate-950/80 backdrop-blur-md hover:bg-slate-900 text-teal-200 hover:text-amber-300 font-bold cursor-pointer shadow-inner text-xs shrink-0 btn-tactile"
            title="Sembunyikan Bilah Menu (Pop In)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span className="text-[11px]">Sembunyikan</span>
          </button>

        </div>
      </div>

      {/* Measurement Active Banner */}
      {isMeasuring && (
        <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between z-10 shadow-md">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 shrink-0" />
            <span>
              Mode Pengukuran Jarak Kabel Aktif: Klik 2 titik di peta untuk mengukur jarak langsung ke pohon atau ruko!
            </span>
          </div>
          {measuredDistance !== null && (
            <div className="bg-slate-950 text-amber-400 px-3 py-1 rounded-lg text-sm font-black flex items-center gap-2">
              <span>Hasil Ukur: {measuredDistance.toFixed(2)} Meter</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                measuredDistance < 3.0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {measuredDistance < 3.0 ? '⚠️ Melanggar Standar ROW <3m' : '✅ Aman ≥3m'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Map & Cluster Panel Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        
        {/* Leaflet Map - Forced absolute inset-0 ensures full dimensions on mobile WebKit and Chrome */}
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Real-time GPS Error / Permission Notification Toast */}
        {gpsErrorMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-24px)] bg-amber-950/95 backdrop-blur-md border border-amber-500/80 text-amber-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">{gpsErrorMessage}</span>
            </div>
            <button
              onClick={() => setGpsErrorMessage(null)}
              className="p-1 hover:bg-amber-900/60 text-amber-400 hover:text-amber-100 rounded-md cursor-pointer shrink-0"
              title="Tutup pesan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Field Turn-by-Turn In-App Navigation Floating Card */}
        {activeNavTarget && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[calc(100%-20px)] bg-slate-900/95 backdrop-blur-xl border-2 border-sky-400 text-white px-4 py-3 rounded-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-modal-pop">
            <div className="flex items-center gap-3 w-full md:w-auto min-w-0 flex-1">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                activeNavTarget.type === 'cable'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : 'bg-gradient-to-br from-blue-600 to-sky-500'
              }`}>
                {activeNavTarget.type === 'cable' ? (
                  <Cable className="w-5 h-5 text-white animate-pulse" />
                ) : (
                  <Navigation className="w-5 h-5 text-white animate-pulse" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    activeNavTarget.type === 'cable'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                  }`}>
                    {activeNavTarget.type === 'cable' ? '⚡ Navigasi Kabel' : '🎯 Navigasi Tiang'}
                  </span>
                  <span className="text-xs font-bold text-slate-300 truncate">
                    {activeNavTarget.code} · {activeNavTarget.feeder}
                  </span>
                  {navDistanceMeters !== null && navDistanceMeters <= 15 && (
                    <span className="bg-emerald-500 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-md">
                      🎉 Tiba di Sasaran!
                    </span>
                  )}
                </div>
                <div className="text-sm font-black text-white truncate mt-0.5">
                  {activeNavTarget.locationName || activeNavTarget.name}
                </div>
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-2 flex-wrap mt-0.5">
                  {navDistanceMeters !== null ? (
                    <>
                      <span>📏 <b>{navDistanceMeters < 1000 ? `${navDistanceMeters} m` : `${(navDistanceMeters / 1000).toFixed(2)} km`}</b></span>
                      <span>·</span>
                      <span>🚗 ~{Math.max(1, Math.round(navDistanceMeters / 8.3 / 60))} mnt</span>
                      <span>·</span>
                      <span>🚶 ~{Math.max(1, Math.round(navDistanceMeters / 1.3 / 60))} mnt jalan</span>
                      {compassBearing !== null && (
                        <>
                          <span>·</span>
                          <span className="text-sky-300 flex items-center gap-1 bg-sky-950/60 px-1.5 py-0.5 rounded-md border border-sky-500/30">
                            <ArrowUp
                              className="w-3 h-3 text-amber-300 transition-transform duration-300"
                              style={{ transform: `rotate(${compassBearing}deg)` }}
                            />
                            <span>{compassBearing}° {getCardinalDirection(compassBearing)}</span>
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      Menghubungkan GPS & kalkulasi rute...
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 md:border-l border-slate-700/80 pt-2 md:pt-0 md:pl-3 shrink-0">
              <a
                href={
                  userCoords
                    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${activeNavTarget.lat},${activeNavTarget.lng}&travelmode=driving`
                    : `https://www.google.com/maps/dir/?api=1&destination=${activeNavTarget.lat},${activeNavTarget.lng}&travelmode=driving`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-colors"
                title="Buka rute navigasi Google Maps atau aplikasi navigasi default perangkat"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Google Maps</span>
              </a>

              {/* Follow Me Auto-Center Toggle Button */}
              <button
                onClick={() => {
                  setIsFollowingUser(!isFollowingUser);
                  if (!isFollowingUser && userCoords && mapInstanceRef.current) {
                    mapInstanceRef.current.setView([userCoords.lat, userCoords.lng], 17, { animate: true });
                  }
                }}
                className={`p-2 rounded-xl cursor-pointer transition-all ${
                  isFollowingUser
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400/50 shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title={isFollowingUser ? "Mode Ikuti Saya Aktif (Klik untuk matikan)" : "Aktifkan Mode Ikuti Saya"}
              >
                <LocateFixed className="w-4 h-4" />
              </button>

              <button
                onClick={focusRouteBounds}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl cursor-pointer transition-colors"
                title="Pusatkan peta ke seluruh rute"
              >
                <Locate className="w-4 h-4" />
              </button>

              <button
                onClick={stopNavigation}
                className="p-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl cursor-pointer transition-colors"
                title="Akhiri Navigasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            GOOGLE MAPS MOBILE FLOATING CONTROLS
            1. Top Floating Search Bar + Horizontal Category Filter Chips
            2. Floating Action Buttons (FABs) on the bottom right
            ======================================================== */}
        <div className="md:hidden absolute top-2.5 inset-x-2.5 z-30 pointer-events-auto flex flex-col gap-1.5 select-none">
          {/* Floating Search Pill */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 shadow-2xl rounded-2xl px-3 py-2 flex items-center gap-2.5 text-slate-900 dark:text-white transition-colors">
            <div className="w-8 h-8 rounded-full bg-white p-0.5 flex items-center justify-center border border-teal-400/80 shadow-md shrink-0 overflow-hidden">
              <GisPlnLogo size={24} withBadge={false} />
            </div>

            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Telusuri No Tiang / Jalan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs w-4 h-4 flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="px-2 py-1 rounded-lg bg-teal-500/20 border border-teal-500/40 text-[10px] font-black text-teal-700 dark:text-teal-300 whitespace-nowrap shrink-0">
              {filteredPoles.length} Tiang
            </div>
          </div>

          {/* Horizontal Category Filter Chips (Google Maps Mobile UI) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5 scroll-smooth">
            {/* Quick GPS Toggle Chip */}
            <button
              onClick={handleToggleGps}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                isGpsActive
                  ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30 font-black'
                  : 'bg-white/90 dark:bg-slate-900/90 text-blue-600 dark:text-blue-300 border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isGpsActive ? "GPS Aktif: Klik untuk menonaktifkan GPS" : "Klik untuk mengaktifkan GPS Lapangan"}
            >
              <MapPin className={`w-3.5 h-3.5 ${gpsStatus === 'searching' ? 'animate-bounce text-amber-300' : ''}`} />
              <span>{isGpsActive ? (gpsStatus === 'locked' ? 'GPS Terkunci' : 'Mencari GPS...') : 'GPS Lapangan'}</span>
              {isGpsActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Chip 1: Semua Tiang */}
            <button
              onClick={() => {
                setSelectedFeeder('ALL');
                setShowRowOnly(false);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                selectedFeeder === 'ALL' && !showRowOnly && !searchQuery
                  ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20'
                  : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Semua Tiang</span>
              <span className="text-[10px] bg-slate-200 dark:bg-slate-950/60 px-1.5 py-0.2 rounded-full font-extrabold">{poles.length}</span>
            </button>

            {/* Chip 2: ROW Kritis (< 3m) */}
            <button
              onClick={() => setShowRowOnly(!showRowOnly)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                showRowOnly
                  ? 'bg-rose-600 text-white border-rose-400 shadow-rose-500/20'
                  : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>ROW Kritis</span>
              <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1.5 py-0.2 rounded-full font-black">
                {poles.filter(p => p.clearanceDistanceMeters < 3.0).length}
              </span>
            </button>

            {/* Chip 3: Selector Penyulang */}
            <div className="relative shrink-0 chip-interactive">
              <select
                value={selectedFeeder}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedFeeder(val);
                  if (val !== 'ALL') {
                    const targetPoles = poles.filter(p => p.feeder === val);
                    focusOnCluster(targetPoles);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all appearance-none pr-6 cursor-pointer focus:outline-none ${
                  selectedFeeder !== 'ALL'
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                    : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700/80'
                }`}
              >
                <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold">📍 Semua Penyulang</option>
                {allFeeders.map(f => (
                  <option key={f} value={f} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                    📍 {f} ({poles.filter(p => p.feeder === f).length})
                  </option>
                ))}
              </select>
              <ChevronDown className={`w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${selectedFeeder !== 'ALL' ? 'text-slate-950' : 'text-slate-400'}`} />
            </div>

            {/* Chip 4: Tarik Kabel (Hanya untuk Admin/Supervisor) */}
            {!isPetugasRow && (
              <button
                onClick={() => {
                  if (isPullingCable) cancelCablePulling();
                  else {
                    setIsPullingCable(true);
                    isPullingCableRef.current = true;
                    setCableSourcePole(null);
                    cableSourcePoleRef.current = null;
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.getContainer().classList.add('cable-pulling-mode');
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                  isPullingCable
                    ? 'bg-teal-500 text-slate-950 border-teal-300 font-black'
                    : 'bg-slate-900/90 text-teal-300 border-teal-500/40 hover:bg-slate-800'
                }`}
              >
                <Cable className="w-3.5 h-3.5" />
                <span>Tarik Kabel</span>
              </button>
            )}

            {/* Chip 5: Mode ROW vs Feeder */}
            <button
              onClick={() => setCableColorMode(cableColorMode === 'byClearance' ? 'byFeeder' : 'byClearance')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                cableColorMode === 'byClearance'
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-cyan-600 text-white border-cyan-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{cableColorMode === 'byClearance' ? 'Mode ROW' : 'Mode Feeder'}</span>
            </button>

            {/* Chip 6: Satelit vs Vektor */}
            <button
              onClick={() => setMapType(mapType === 'satellite' ? 'streets' : 'satellite')}
              className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border border-slate-700/80 bg-slate-900/90 text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer hover:bg-slate-800 chip-interactive"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{mapType === 'satellite' ? 'Satelit' : 'Vektor'}</span>
            </button>

            {/* Chip 7: Ukur Jarak (Hanya untuk Admin/Supervisor) */}
            {!isPetugasRow && (
              <button
                onClick={() => {
                  if (isMeasuring) clearMeasurement();
                  else {
                    setIsMeasuring(true);
                    setMeasurePoints([]);
                    setMeasuredDistance(null);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                  isMeasuring
                    ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black'
                    : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800'
                }`}
              >
                <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isMeasuring ? 'Batal Ukur' : 'Ukur ROW'}</span>
              </button>
            )}

            {/* Chip 8: Heatmap (Hanya untuk Admin/Supervisor) */}
            {!isPetugasRow && (
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md backdrop-blur-md border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer chip-interactive ${
                  showHeatmap
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-slate-900/90 text-rose-300 border-rose-500/40 hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Heatmap</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================
            GOOGLE MAPS FLOATING ACTION BUTTONS (FAB) on Bottom-Right
            Positioned at bottom-20 to clear bottom navigation bar
            ======================================================== */}
        <div className="md:hidden absolute bottom-20 right-3.5 z-30 flex flex-col items-end gap-2.5 pointer-events-auto select-none">
          {/* FAB 1: Layer Switcher */}
          <button
            onClick={() => setMapType(mapType === 'satellite' ? 'streets' : 'satellite')}
            className="w-11 h-11 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 text-cyan-400 rounded-full shadow-2xl flex items-center justify-center btn-tactile active:scale-90 hover:scale-105 transition-all cursor-pointer"
            title="Ganti Lapisan Peta (Satelit / Vektor)"
          >
            <Layers className="w-5 h-5" />
          </button>

          {/* FAB 2: Real-Time GPS Tracking Button matching image_cfb3c780.png */}
          <button
            onClick={handleToggleGps}
            className={`w-11 h-11 backdrop-blur-xl border rounded-full shadow-2xl flex items-center justify-center btn-tactile active:scale-90 hover:scale-105 transition-all cursor-pointer relative ${
              isGpsActive
                ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/50 ring-2 ring-blue-400/60'
                : 'bg-slate-900/95 border-slate-700/90 text-blue-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isGpsActive ? "GPS Aktif: Klik untuk menonaktifkan GPS" : "Klik untuk mengaktifkan GPS Lapangan"}
          >
            <MapPin className={`w-5 h-5 ${gpsStatus === 'searching' ? 'animate-bounce text-amber-300' : ''}`} />
            {isGpsActive && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
            )}
          </button>

          {/* FAB 3: Primary Action (+ Tiang Lapangan) */}
          <button
            onClick={onAddCustomPole}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black px-3.5 h-11 rounded-full shadow-2xl border border-amber-300 btn-tactile active:scale-90 hover:scale-105 transition-all cursor-pointer"
            title="Tambah Titik Tiang Baru"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs">Tiang</span>
          </button>
        </div>

        {/* Desktop Map Floating Action Buttons (Top-Right) */}
        <div className="hidden md:flex absolute top-4 right-4 z-20 flex-col items-end gap-2.5 pointer-events-auto select-none">
          {/* GPS Live Tracking Button matching image_cfb3c780.png */}
          <button
            onClick={handleToggleGps}
            className={`flex items-center gap-2 px-3.5 h-10 backdrop-blur-xl border rounded-full shadow-2xl btn-tactile active:scale-95 hover:scale-105 transition-all cursor-pointer ${
              isGpsActive
                ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/40 ring-2 ring-blue-400/50'
                : 'bg-slate-900/95 border-slate-700/90 text-blue-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isGpsActive ? "GPS Aktif: Klik untuk menonaktifkan GPS" : "Klik untuk mengaktifkan GPS Lapangan"}
          >
            <MapPin className={`w-4 h-4 ${gpsStatus === 'searching' ? 'animate-bounce text-amber-300' : ''}`} />
            <span className="text-xs font-bold">
              {isGpsActive ? (gpsStatus === 'locked' ? 'GPS Terkunci' : 'Mencari GPS...') : 'GPS Lapangan'}
            </span>
            {isGpsActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Layer Switcher */}
          <button
            onClick={() => setMapType(mapType === 'satellite' ? 'streets' : 'satellite')}
            className="w-10 h-10 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 text-cyan-400 rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-800 hover:text-white btn-tactile active:scale-95 hover:scale-105 transition-all cursor-pointer"
            title="Ganti Lapisan Peta (Satelit / Vektor)"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Legend - Dynamically adapts to Menu "ROW" vs Menu "Feeder" with toggle minimize */}
        <div className="absolute bottom-20 left-3 md:bottom-6 md:right-6 md:left-auto z-20 max-w-[260px] sm:max-w-xs select-none">
          {isLegendOpen ? (
            cableColorMode === 'byClearance' ? (
              // LEGENDA MODE ROW (Fisik Tiang/Kabel & Jarak Lingkungan Sekitar Pohon/Bangunan)
              <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-2.5">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-white">Legenda Mode ROW</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{filteredPoles.length} Tiang</span>
                    <button
                      onClick={() => setIsLegendOpen(false)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Sembunyikan Legenda"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {showHeatmap && (
                    <div className="flex items-center gap-2 p-1.5 bg-rose-950/80 rounded-lg border border-rose-500/50 mb-1">
                      <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 shrink-0 animate-pulse" />
                      <span className="font-bold text-rose-300">🔥 Heatmap Area Kritis Aktif</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 shadow-sm" />
                    <span><b>Aman (≥ 3.0m)</b> & Kondisi Fisik Baik</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0 shadow-sm" />
                    <span><b>Perlu Perbaikan</b> / ROW (&lt; 3.0m) / Kendor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 shadow-sm" />
                    <span><b>Bahaya Kritis (&lt; 1.5m)</b> / Korosi / Rusak</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[10.5px]">
                    <span className="w-6 h-0.5 bg-rose-500 border-t-2 border-dashed border-rose-300" />
                    <span className="text-slate-300">Kabel Kritis (Pohon/Bangunan)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px]">
                    <span className="w-6 h-0.5 bg-emerald-500" />
                    <span className="text-slate-300">Kabel ROW Aman & Kondisi Baik</span>
                  </div>
                </div>
              </div>
            ) : (
              // LEGENDA MODE FEEDER (Penyulang)
              <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-2.5 max-h-72 overflow-y-auto">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between border-b border-slate-800 pb-2 sticky top-0 bg-slate-900/95">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="font-bold text-white">Legenda Feeder</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-400 font-bold">{allFeeders.length} Jalur</span>
                    <button
                      onClick={() => setIsLegendOpen(false)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Sembunyikan Legenda"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-300 leading-tight">
                  Warna tiang & kabel mengikuti jalur suplai listrik masing-masing penyulang:
                </p>

                <div className="space-y-1.5 text-[11px] pt-1">
                  {allFeeders.slice(0, 8).map(fName => {
                    const color = feederColors[fName] || getFeederColor(fName);
                    const count = poles.filter(p => p.feeder === fName).length;
                    return (
                      <div key={fName} className="flex items-center justify-between gap-2 py-0.5">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-white/20"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate text-slate-200 font-medium">{fName}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">{count} T</span>
                      </div>
                    );
                  })}
                  {allFeeders.length > 8 && (
                    <div className="text-[10px] text-amber-400 text-center pt-1 border-t border-slate-800">
                      +{allFeeders.length - 8} penyulang lainnya (buka drawer)
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <button
              onClick={() => setIsLegendOpen(true)}
              className="bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border border-slate-700 shadow-xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer"
            >
              {cableColorMode === 'byClearance' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>Legenda Peta</span>
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Floating Cable Pulling Mode Banner */}
        {isPullingCable && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/95 backdrop-blur-md border-2 border-sky-400 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 max-w-xl w-auto animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0 animate-pulse">
              <Cable className="w-5 h-5 text-sky-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="font-black text-xs text-sky-300 flex items-center gap-1.5 flex-wrap">
                <span>MODE TARIK KABEL DISTRIBUSI</span>
                {cableSourcePole && (
                  <span className="bg-sky-500/30 text-sky-200 text-[10px] px-2 py-0.5 rounded-full border border-sky-400/50 font-bold">
                    Tiang Awal: {cableSourcePole.code}
                  </span>
                )}
                {snapTargetPole && cableSourcePole && (
                  <span className="bg-emerald-500/30 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/50 font-bold animate-pulse">
                    🎯 Target: {snapTargetPole.code} ({Math.round(calculateHaversineDistanceMeters(cableSourcePole.lat, cableSourcePole.lng, snapTargetPole.lat, snapTargetPole.lng))}m)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {snapTargetPole
                  ? `Lepaskan mouse atau klik untuk menghubungkan kabel ke ${snapTargetPole.code}.`
                  : cableSourcePole
                  ? 'Arahkan mouse dan lepaskan (drop) atau klik pada tiang tujuan.'
                  : 'Klik titik tiang pertama atau drag (tahan mouse) dari tiang ke tiang lain.'}
              </div>
            </div>
            <button
              onClick={cancelCablePulling}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl border border-slate-700 font-bold transition-all shrink-0 cursor-pointer"
              title="Batalkan penarikan kabel (Esc)"
            >
              Batal
            </button>
          </div>
        )}

      </div>

      {/* New Cable Connection Modal */}
      {cableSourcePole && cableTargetPole && (
        <NewCableModal
          fromPole={cableSourcePole}
          toPole={cableTargetPole}
          allFeeders={allFeeders}
          onClose={cancelCablePulling}
          onCreateSpan={(newSpan) => {
            if (onSaveSpan) onSaveSpan(newSpan);
            cancelCablePulling();
          }}
        />
      )}

      {/* Edit Cable Information Modal */}
      {selectedSpanForEdit && (
        <EditCableModal
          span={selectedSpanForEdit}
          fromPole={poles.find(p => p.id.toLowerCase() === selectedSpanForEdit.fromPoleId.toLowerCase() || (p.code && p.code.toLowerCase() === selectedSpanForEdit.fromPoleId.toLowerCase()))}
          toPole={poles.find(p => p.id.toLowerCase() === selectedSpanForEdit.toPoleId.toLowerCase() || (p.code && p.code.toLowerCase() === selectedSpanForEdit.toPoleId.toLowerCase()))}
          allFeeders={allFeeders}
          onClose={() => setSelectedSpanForEdit(null)}
          onSave={(updated) => {
            if (onUpdateSpan) onUpdateSpan(updated);
            setSelectedSpanForEdit(null);
          }}
          onDelete={(spanId, fromPoleId, toPoleId) => {
            if (onDeleteSpan) onDeleteSpan(spanId, fromPoleId, toPoleId);
            setSelectedSpanForEdit(null);
          }}
        />
      )}

      {/* Lightbox / High-Res Image Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80">
              <div>
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <span>📸</span>
                  <span>{previewPhoto.title}</span>
                </h3>
                {previewPhoto.subtitle && (
                  <p className="text-xs text-slate-400 mt-0.5">{previewPhoto.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPhoto.url}
                  download={`foto-kondisi-${Date.now()}.jpg`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  title="Unduh foto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh</span>
                </a>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-950/50 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* In-App Geographic Location Access Request Modal (matching user specification) */}
      <GeoLocationPermissionModal
        isOpen={showGeoModal}
        onClose={() => {
          setShowGeoModal(false);
          pendingNavPoleRef.current = null;
        }}
        onAllowSuccess={(coords) => {
          setShowGeoModal(false);
          const newCoords = {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy,
            heading: null,
            speed: null
          };
          setUserCoords(newCoords);
          userCoordsRef.current = newCoords;
          startGpsTracking(true);

          if (pendingNavPoleRef.current) {
            const pole = pendingNavPoleRef.current;
            pendingNavPoleRef.current = null;
            startNavigationToPole(pole);
          }
        }}
      />

    </div>
  );
};

