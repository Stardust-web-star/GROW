import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { PoleData, CableSpan } from '../types';
import { Search, Filter, Layers, Navigation, AlertTriangle, Plus, ShieldCheck, Ruler, RefreshCw, ChevronRight, ChevronDown, ChevronUp, Grid, Eye, EyeOff, Zap, Sliders, Flame, Cable, Camera, Image as ImageIcon, Download, X } from 'lucide-react';
import { calculateHaversineDistanceMeters, checkIsRowViolation, getMinRowRequirement } from '../utils/kmzParser';
import { EditCableModal } from './EditCableModal';
import { NewCableModal } from './NewCableModal';
import { GeometricBlueHeaderBg } from './GeometricBlueHeaderBg';

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

interface MapViewerProps {
  poles: PoleData[];
  spans: CableSpan[];
  isActive?: boolean;
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
        zoomControl: true,
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

      // Create Layer Groups for markers, lines, and heatmap
      const markersGroup = L.layerGroup().addTo(map);
      const linesGroup = L.layerGroup().addTo(map);
      const heatmapGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = markersGroup;
      linesLayerRef.current = linesGroup;
      heatmapLayerRef.current = heatmapGroup;

      // Handle map click for measurement tool
      map.on('click', (e: L.LeafletMouseEvent) => {
        if ((window as any).isMeasuringActive) {
          const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
          (window as any).addMeasurePoint(latlng);
        }
      });
    }

    return () => {
      if (canvasRendererRef.current) {
        canvasRendererRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // When tab becomes active, invalidate map size to adjust to container instantly
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
      return () => clearTimeout(timer);
    }
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

    // Fast O(1) Lookup Maps
    const poleMap = new Map<string, PoleData>();
    poles.forEach(p => {
      poleMap.set(p.id, p);
      if (p.code) poleMap.set(p.code, p);
    });

    // Build O(M) index for cable spans per pole so connected cable queries are instant O(1)
    const poleConnectedSpansMap = new Map<string, CableSpan[]>();
    spans.forEach(s => {
      const fromKey = (s.fromPoleId || '').toLowerCase();
      const toKey = (s.toPoleId || '').toLowerCase();
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
          `<b>🔥 ZONA BAHAYA KRITIS</b><br/>ID: ${p.id} (${p.code})<br/>Lokasi: ${p.locationName}<br/>Kondisi: ${p.physicalCondition}<br/>ROW: ${p.clearanceDistanceMeters}m`,
          { sticky: true }
        );
        coreCircle.addTo(heatmapGroup);
      });
    }

    // 3. Render Cable Spans (Lines between adjacent poles only within padded bounds)
    const visibleSpans = spans.filter(s => {
      const from = poleMap.get(s.fromPoleId);
      const to = poleMap.get(s.toPoleId);
      if (!from || !to) return false;
      return bounds.contains([from.lat, from.lng]) || bounds.contains([to.lat, to.lng]);
    });

    visibleSpans.forEach(span => {
      const fromPole = poleMap.get(span.fromPoleId);
      const toPole = poleMap.get(span.toPoleId);

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

        const tooltipStatus = cableColorMode === 'byFeeder'
          ? `Penyulang: <b style="color:${lineColor}; font-weight:bold;">${effectiveFeeder}</b>`
          : `Mode ROW: <b style="color:${lineColor}; font-weight:bold;">${lineModeDesc}</b><br/>Jarak Pohon: <b>${treeDist < 90 ? treeDist + 'm' : '-'}</b> | Bangunan: <b>${bldgDist < 90 ? bldgDist + 'm' : '-'}</b> | Fisik: <b>${span.cableCondition || 'Baik'}</b>`;

        line.bindTooltip(
          `<b>${fromPole.code} ↔ ${toPole.code}</b><br/>${span.conductorType} (Spat: ${span.lengthMeters}m)<br/>${tooltipStatus}<br/><span style="color:#f59e0b; font-size:10px; font-weight:bold;">👉 Klik kabel untuk opsi edit / hapus</span>`,
          { sticky: true }
        );

        // Lazy popup creator: executed on-demand only when polyline is clicked
        line.bindPopup(() => {
          const cablePopupContent = document.createElement('div');
          cablePopupContent.className = 'p-3.5 max-w-xs text-slate-900 font-sans';
          cablePopupContent.innerHTML = `
            <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#b45309; margin-bottom:2px;">
              ⚡ Kabel Distribusi · ${effectiveFeeder}
            </div>
            <div style="font-weight:900; font-size:16px; color:#0f172a; margin-bottom:2px;">
              ${fromPole.code} ↔ ${toPole.code}
            </div>
            <div style="font-size:12px; font-weight:600; color:#475569; margin-bottom:8px;">
              Panjang Bentangan (Spat): <b>${span.lengthMeters} meter</b>
            </div>

            <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:10px; font-size:11.5px;">
              <div style="background:#f8fafc; padding:5px 8px; border-radius:6px; border:1px solid #cbd5e1; font-weight:600;">
                Konduktor: <b style="color:#0f172a;">${span.conductorType}</b>
              </div>
              <div style="background:#f8fafc; padding:5px 8px; border-radius:6px; border:1px solid #cbd5e1; display:flex; justify-content:space-between; font-weight:600;">
                <span>Kondisi Kabel:</span>
                <b style="color:#0f172a;">${span.cableCondition || 'Baik'}</b>
              </div>
              <div style="background:${isCableCritical ? '#fef2f2' : isCableViolation ? '#fffbeb' : '#f0fdf4'}; color:${isCableCritical ? '#991b1b' : isCableViolation ? '#92400e' : '#166534'}; padding:6px 8px; border-radius:6px; border:1px solid ${isCableCritical ? '#fecaca' : isCableViolation ? '#fde68a' : '#bbf7d0'};">
                <div style="font-weight:600;">Jarak Pohon: <b>${span.treeDistanceMeters ?? 3.5}m</b> | Bangunan: <b>${span.buildingDistanceMeters ?? 4.0}m</b></div>
                <div style="font-size:11px; font-weight:800; margin-top:2px;">
                  ${isCableCritical ? '🔴 Bahaya Kritis (<1.5m / Kabel Rusak)' : isCableViolation ? '🟡 Pelanggaran ROW (<3.0m / Kabel Kendor)' : '✅ Sesuai Standar ROW (≥3.0m)'}
                </div>
              </div>
            </div>

            <!-- Foto Kondisi Kabel Section -->
            <div class="cable-photo-box" style="margin-bottom:8px;">
              ${span.photoUrl ? `
                <div style="border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                  <div class="btn-zoom-cable-img" style="position:relative; width:100%; height:120px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                    <img src="${span.photoUrl}" alt="Kondisi Kabel" style="width:100%; height:100%; object-fit:cover;" />
                    <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:3px 8px; color:white; font-size:10px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                      <span>📸 Foto Kondisi Kabel</span>
                      <span style="font-size:9px; background:rgba(255,255,255,0.25); padding:1px 5px; border-radius:3px;">🔍 Perbesar</span>
                    </div>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:11px; background:#f1f5f9;">
                    <label style="color:#0284c7; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;">
                      🔄 Ganti Foto
                      <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                    </label>
                    <button class="btn-del-cable-photo" style="color:#ef4444; font-weight:700; background:none; border:none; cursor:pointer; font-size:11px;">
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              ` : `
                <label style="display:flex; align-items:center; justify-content:center; gap:6px; background:#f0f9ff; border:1.5px dashed #0284c7; border-radius:7px; padding:7px 10px; cursor:pointer; color:#0369a1; font-size:11.5px; font-weight:800; transition:all 0.2s;" class="dropzone-cable-photo">
                  <span>📷 Unggah Foto Kondisi Kabel</span>
                  <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                </label>
              `}
            </div>

            <div class="cable-popup-actions" style="margin-top:6px;">
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                <button class="btn-edit-cable-act" style="background:#f59e0b; color:#0f172a; font-size:12px; padding:8px; border-radius:7px; border:1px solid #d97706; font-weight:800; cursor:pointer;">
                  ✏️ Ubah Info
                </button>
                <button class="btn-delete-cable-act" style="background:#ef4444; color:#ffffff; font-size:12px; padding:8px; border-radius:7px; border:1px solid #dc2626; font-weight:800; cursor:pointer;">
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
                <div style="border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                  <div class="btn-zoom-cable-img" style="position:relative; width:100%; height:120px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                    <img src="${span.photoUrl}" alt="Kondisi Kabel" style="width:100%; height:100%; object-fit:cover;" />
                    <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:3px 8px; color:white; font-size:10px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                      <span>📸 Foto Kondisi Kabel</span>
                      <span style="font-size:9px; background:rgba(255,255,255,0.25); padding:1px 5px; border-radius:3px;">🔍 Perbesar</span>
                    </div>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:11px; background:#f1f5f9;">
                    <label style="color:#0284c7; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;">
                      🔄 Ganti Foto
                      <input type="file" accept="image/*" class="input-cable-photo" style="display:none;" />
                    </label>
                    <button class="btn-del-cable-photo" style="color:#ef4444; font-weight:700; background:none; border:none; cursor:pointer; font-size:11px;">
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              `;
            } else {
              photoBox.innerHTML = `
                <label style="display:flex; align-items:center; justify-content:center; gap:6px; background:#f0f9ff; border:1.5px dashed #0284c7; border-radius:7px; padding:7px 10px; cursor:pointer; color:#0369a1; font-size:11.5px; font-weight:800; transition:all 0.2s;" class="dropzone-cable-photo">
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
                <div style="background:#fef2f2; border:1px solid #f87171; border-radius:8px; padding:8px; width:100%; text-align:center;">
                  <div style="font-size:11px; font-weight:bold; color:#991b1b; margin-bottom:6px;">
                    ⚠️ Hapus kabel ini dari sistem GIS?
                  </div>
                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                    <button class="btn-do-delete-cable" style="background:#dc2626; color:white; font-size:11px; padding:6px; border-radius:6px; border:none; font-weight:bold; cursor:pointer;">
                      ✓ Ya, Hapus
                    </button>
                    <button class="btn-cancel-delete-cable" style="background:#64748b; color:white; font-size:11px; padding:6px; border-radius:6px; border:none; font-weight:bold; cursor:pointer;">
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

          return cablePopupContent;
        }, { autoPan: false });

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
      const { color: poleColor, statusLabel } = getPoleVisualAttributes(pole);

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

      const tooltipModeInfo = cableColorMode === 'byFeeder'
        ? `Penyulang: <b style="color:${poleColor}; font-weight:bold;">${pole.feeder}</b>`
        : `Mode ROW: <b style="color:${poleColor}; font-weight:bold;">${statusLabel}</b>`;

      marker.bindTooltip(
        `<b>${pole.code}</b> (${pole.type})<br/>${tooltipModeInfo}<br/>📍 ${pole.locationName}<br/>ROW Lingkungan: <b>${pole.clearanceDistanceMeters}m</b> (${pole.clearanceObject}) | Fisik: <b>${pole.physicalCondition}</b>`,
        { sticky: true, direction: 'top' }
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
            <div style="font-size:11px; font-weight:800; color:#0f172a; margin-top:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
              <span>⚡ Kabel Terhubung (${connectedSpansToPole.length}):</span>
            </div>
            <div style="max-height:90px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; padding:3px; margin-bottom:8px;">
              ${connectedSpansToPole.map(s => {
                const otherId = (s.fromPoleId.toLowerCase() === pole.id.toLowerCase() || s.fromPoleId.toLowerCase() === pole.code.toLowerCase())
                  ? s.toPoleId
                  : s.fromPoleId;
                const otherPole = poleMap.get(otherId);
                const otherCode = otherPole?.code || otherId;
                return `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:4px 6px; font-size:11px; border-bottom:1px solid #e2e8f0;">
                    <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px; font-weight:600; color:#1e293b;">
                      <b>↔ ${otherCode}</b> (${s.lengthMeters}m)
                    </div>
                    <div style="display:flex; gap:4px;">
                      <button data-id="${s.id}" class="btn-pole-edit-span" style="background:#f59e0b; color:#0f172a; padding:3px 7px; border-radius:4px; border:1px solid #d97706; font-size:10px; font-weight:800; cursor:pointer;">Ubah</button>
                      <button data-id="${s.id}" class="btn-pole-del-span" style="background:#ef4444; color:#ffffff; padding:3px 7px; border-radius:4px; border:1px solid #dc2626; font-size:10px; font-weight:800; cursor:pointer;">Hapus</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        const popupContent = document.createElement('div');
        popupContent.className = 'p-3.5 max-w-xs text-slate-900 font-sans';
        popupContent.innerHTML = `
          <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#b45309; margin-bottom:2px;">
            ⚡ ${pole.feeder} · ${pole.type}
          </div>
          <div style="font-weight:900; font-size:16px; color:#0f172a; line-height:1.2; margin-bottom:3px;">
            ${pole.id} <span style="font-size:13px; font-weight:700; color:#475569;">(${pole.code})</span>
          </div>
          <div style="font-size:12px; font-weight:600; color:#334155; margin-bottom:8px;">
            📍 ${pole.locationName}
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
            <span style="background:${pole.physicalCondition === 'Baik' ? '#ecfdf5' : '#fef2f2'}; color:${pole.physicalCondition === 'Baik' ? '#065f46' : '#991b1b'}; font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; border:1px solid ${pole.physicalCondition === 'Baik' ? '#a7f3d0' : '#fecaca'};">
              Kondisi: ${pole.physicalCondition}
            </span>
            <span style="background:${pole.clearanceDistanceMeters >= 3.0 ? '#eff6ff' : '#fffbeb'}; color:${pole.clearanceDistanceMeters >= 3.0 ? '#1e40af' : '#92400e'}; font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; border:1px solid ${pole.clearanceDistanceMeters >= 3.0 ? '#bfdbfe' : '#fde68a'};">
              ROW: ${pole.clearanceDistanceMeters}m (${pole.clearanceStatus})
            </span>
          </div>

          <div style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:10px; background:#f8fafc; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">
            Tahun Pasang: <b>${pole.installationYear}</b> | Inspeksi: <b>${pole.lastInspectionDate}</b>
          </div>

          ${connectedCablesHtml}

          <!-- Foto Kondisi Tiang Section -->
          <div class="pole-photo-box" style="margin-bottom:8px;">
            ${pole.photoUrl ? `
              <div style="border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                <div class="btn-zoom-pole-img" style="position:relative; width:100%; height:130px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                  <img src="${pole.photoUrl}" alt="Kondisi Tiang ${pole.code}" style="width:100%; height:100%; object-fit:cover;" />
                  <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:3px 8px; color:white; font-size:10px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                    <span>📸 Foto Kondisi Tiang</span>
                    <span style="font-size:9px; background:rgba(255,255,255,0.25); padding:1px 5px; border-radius:3px;">🔍 Perbesar</span>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:11px; background:#f1f5f9;">
                  <label style="color:#0284c7; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;">
                    🔄 Ganti Foto
                    <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
                  </label>
                  <button class="btn-del-pole-photo" style="color:#ef4444; font-weight:700; background:none; border:none; cursor:pointer; font-size:11px;">
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            ` : `
              <label style="display:flex; align-items:center; justify-content:center; gap:6px; background:#f0f9ff; border:1.5px dashed #0284c7; border-radius:7px; padding:7px 10px; cursor:pointer; color:#0369a1; font-size:11.5px; font-weight:800; transition:all 0.2s;" class="dropzone-pole-photo">
                <span>📷 Unggah Foto Kondisi Tiang</span>
                <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
              </label>
            `}
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-bottom:6px;">
            <button class="btn-inspect-act" style="background:#0f172a; color:#ffffff; font-size:12px; padding:7px; border-radius:7px; border:1px solid #1e293b; font-weight:800; cursor:pointer;">
              + Inspeksi
            </button>
            <button class="btn-spk-act" style="background:#f59e0b; color:#0f172a; font-size:12px; padding:7px; border-radius:7px; border:1px solid #d97706; font-weight:800; cursor:pointer;">
              + SPK Rabas
            </button>
          </div>
          <button class="btn-cable-pull-act" style="width:100%; background:#0284c7; color:#ffffff; font-size:12px; padding:8px; border-radius:7px; border:1px solid #0369a1; font-weight:800; cursor:pointer; margin-bottom:6px; display:flex; align-items:center; justify-content:center; gap:6px;">
            ⚡ Tarik Kabel dari Tiang Ini
          </button>
          <button class="btn-delete-act" style="width:100%; background:#ef4444; color:#ffffff; font-size:12px; padding:8px; border-radius:7px; border:1px solid #dc2626; font-weight:800; cursor:pointer; margin-bottom:6px;">
            🗑️ Hapus Titik Tiang Ini
          </button>
          <a href="https://maps.google.com/?q=${pole.lat},${pole.lng}" target="_blank" rel="noreferrer" style="display:block; text-align:center; font-size:12px; font-weight:700; margin-top:4px; color:#0284c7; text-decoration:none;">
            📍 Buka Navigasi GPS Field
          </a>
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
              <div style="border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; background:#f8fafc;">
                <div class="btn-zoom-pole-img" style="position:relative; width:100%; height:130px; cursor:pointer; background:#0f172a;" title="Klik untuk perbesar foto">
                  <img src="${pole.photoUrl}" alt="Kondisi Tiang ${pole.code}" style="width:100%; height:100%; object-fit:cover;" />
                  <div style="position:absolute; bottom:0; inset-x:0; background:linear-gradient(to top, rgba(0,0,0,0.75), transparent); padding:3px 8px; color:white; font-size:10px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
                    <span>📸 Foto Kondisi Tiang</span>
                    <span style="font-size:9px; background:rgba(255,255,255,0.25); padding:1px 5px; border-radius:3px;">🔍 Perbesar</span>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; font-size:11px; background:#f1f5f9;">
                  <label style="color:#0284c7; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;">
                    🔄 Ganti Foto
                    <input type="file" accept="image/*" class="input-pole-photo" style="display:none;" />
                  </label>
                  <button class="btn-del-pole-photo" style="color:#ef4444; font-weight:700; background:none; border:none; cursor:pointer; font-size:11px;">
                    🗑️ Hapus
                  </button>
                </div>
              </div>
            `;
          } else {
            photoBox.innerHTML = `
              <label style="display:flex; align-items:center; justify-content:center; gap:6px; background:#f0f9ff; border:1.5px dashed #0284c7; border-radius:7px; padding:7px 10px; cursor:pointer; color:#0369a1; font-size:11.5px; font-weight:800; transition:all 0.2s;" class="dropzone-pole-photo">
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

        return popupContent;
      };

      marker.bindPopup(createPolePopup, { autoPan: false });

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

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col bg-slate-950">
      
      {/* Pop Out Floating Button (shown when toolbar is hidden / popped in) */}
      {!isToolbarOpen && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 transition-all duration-300">
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

      {/* Top Single-Row Filter & Operations Toolbar with Pop In / Pop Out support */}
      <div
        className={`relative z-20 shadow-md select-none transition-all duration-300 ease-in-out border-b border-teal-500/30 overflow-hidden ${
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

          {/* 2. Feeder Dropdown Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2.5 h-8 rounded-lg border border-teal-500/30 shadow-inner shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer max-w-[125px] sm:max-w-[150px] truncate"
            >
              <option value="ALL" className="bg-slate-900 text-white font-bold">Semua Penyulang ({poles.length})</option>
              {allFeeders.map(fName => {
                const count = poles.filter(p => p.feeder === fName).length;
                return (
                  <option key={fName} value={fName} className="bg-slate-900 text-slate-100 font-semibold">
                    📍 {fName} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Kelola Penyulang Drawer Button */}
          {onOpenFeederDrawer && (
            <button
              onClick={onOpenFeederDrawer}
              className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-teal-500/30 bg-slate-950/80 backdrop-blur-md hover:bg-slate-900 text-slate-200 hover:text-white font-bold transition-all cursor-pointer shadow-inner text-xs shrink-0"
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
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md transition-all cursor-pointer ${
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
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 px-3 h-8 rounded-lg font-black text-xs shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95 shrink-0"
            title="Tambah Titik Tiang Baru secara manual"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Tambah Tiang</span>
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-teal-400/30 shrink-0 mx-0.5" />

          {/* 6. Empat (4) Menu Operasi: Tarik Kabel, Ukur ROW, ROW < 3m, Heatmap */}
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
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold transition-all cursor-pointer ${
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
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-bold transition-all cursor-pointer ${
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

          {/* Divider */}
          <div className="h-5 w-px bg-teal-400/30 shrink-0 mx-0.5" />

          {/* 7. Tiga (3) Tampilan Menu: Satelit, Pin KML, Menampilkan: */}
          <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-0.5 rounded-lg border border-teal-500/30 shadow-inner h-8 shrink-0">
            <button
              onClick={() => setMapType(mapType === 'satellite' ? 'streets' : 'satellite')}
              className={`px-2.5 h-7 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                mapType === 'satellite'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title={`Ganti tampilan peta ke ${mapType === 'satellite' ? 'Vektor Jalan' : 'Satelit'}`}
            >
              <span>{mapType === 'satellite' ? '🛰️ Satelit' : '🗺️ Vektor'}</span>
            </button>

            <button
              onClick={() => setPinStyle(pinStyle === 'googleEarth' ? 'badge' : 'googleEarth')}
              className={`px-2.5 h-7 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                pinStyle === 'googleEarth'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title={`Ganti gaya pin ke ${pinStyle === 'googleEarth' ? 'Badge Detail' : 'Pin KML'}`}
            >
              <span>{pinStyle === 'googleEarth' ? '📍 Pin KML' : '🏷️ Detail'}</span>
            </button>
          </div>

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
                className="ml-1 text-[11px] text-amber-300 hover:text-white underline cursor-pointer font-bold"
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
            className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-teal-500/30 bg-slate-950/80 backdrop-blur-md hover:bg-slate-900 text-teal-200 hover:text-amber-300 font-bold transition-all cursor-pointer shadow-inner text-xs shrink-0 active:scale-95"
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
        
        {/* Leaflet Map */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Legend - Dynamically adapts to Menu "ROW" vs Menu "Feeder" with toggle minimize */}
        <div className="absolute bottom-6 right-6 z-10 max-w-xs select-none">
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
          fromPole={poles.find(p => p.id === selectedSpanForEdit.fromPoleId)}
          toPole={poles.find(p => p.id === selectedSpanForEdit.toPoleId)}
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

    </div>
  );
};

