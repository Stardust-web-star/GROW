import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PoleData, CableSpan, MaintenanceWorkOrder, InspectionRecord, UserAccount } from './types';
import { INITIAL_POLES, INITIAL_SPANS, INITIAL_SPKS } from './data/initialPoles';
import { Navbar } from './components/Navbar';
import { MapViewer } from './components/MapViewer';
import { CableClearanceManager } from './components/CableClearanceManager';
import { AiPredictiveDashboard } from './components/AiPredictiveDashboard';
import { SpkManager } from './components/SpkManager';
import { KmzUploader } from './components/KmzUploader';
import { AddInspectionModal } from './components/AddInspectionModal';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { FeederManagerDrawer } from './components/FeederManagerDrawer';
import { LoginScreen } from './components/LoginScreen';
import { UserManagement } from './components/UserManagement';
import { Plus, X } from 'lucide-react';
import {
  savePoleToCloud,
  deletePoleFromCloud,
  saveSpanToCloud,
  deleteSpanFromCloud,
  saveSpkToCloud,
  saveAppStateToCloud,
  subscribeToPoles,
  subscribeToSpans,
  subscribeToSpks,
  subscribeToAppState,
  mergePolesWithCloud,
  mergeSpansWithCloud
} from './lib/syncManager';
import { SystemMetaState } from './lib/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'clearance' | 'ai' | 'spk' | 'kmz' | 'users'>('map');
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({ map: true });

  // 7 Menit Inactivity Timeout (7 * 60 * 1000 = 420,000 ms)
  const INACTIVITY_TIMEOUT_MS = 7 * 60 * 1000;

  // Session Expired Message (shown on LoginScreen when timed out)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  // Current Logged-in User Session (Stored in sessionStorage: auto-clears when tab/browser is closed)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      // Purge any legacy localStorage persistence to ensure closed-tab logs out
      localStorage.removeItem('grow_pln_user');

      const saved = sessionStorage.getItem('grow_pln_user');
      const lastActive = sessionStorage.getItem('grow_last_activity');
      if (saved) {
        if (lastActive) {
          const elapsed = Date.now() - parseInt(lastActive, 10);
          if (elapsed >= 7 * 60 * 1000) {
            sessionStorage.removeItem('grow_pln_user');
            sessionStorage.removeItem('grow_last_activity');
            return null;
          }
        }
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse saved user:', e);
    }
    return null;
  });

  // Logout Animation state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback((reason?: 'manual' | 'inactivity') => {
    setIsLoggingOut(true);
    setTimeout(() => {
      sessionStorage.removeItem('grow_pln_user');
      sessionStorage.removeItem('grow_last_activity');
      localStorage.removeItem('grow_pln_user');
      setCurrentUser(null);
      setIsLoggingOut(false);
      setActiveTab('map');
      if (reason === 'inactivity') {
        setSessionExpiredMessage('Sesi Anda telah berakhir otomatis karena tidak ada interaksi selama 7 menit. Silakan login kembali.');
      } else {
        setSessionExpiredMessage(null);
      }
    }, 280);
  }, []);

  // 7-Minute Inactivity Auto-Logout Tracker
  useEffect(() => {
    if (!currentUser) return;

    // Stamp current interaction timestamp
    sessionStorage.setItem('grow_last_activity', Date.now().toString());

    let timeoutId: any;

    const resetInactivityTimer = () => {
      sessionStorage.setItem('grow_last_activity', Date.now().toString());
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout('inactivity');
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Initialize timer
    timeoutId = setTimeout(() => {
      handleLogout('inactivity');
    }, INACTIVITY_TIMEOUT_MS);

    // Track user interactions
    const interactionEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel'
    ];

    let lastInteractionTimestamp = Date.now();
    const onUserInteraction = () => {
      const now = Date.now();
      // Throttle interaction event handling to max once per 2 seconds
      if (now - lastInteractionTimestamp > 2000) {
        lastInteractionTimestamp = now;
        resetInactivityTimer();
      }
    };

    interactionEvents.forEach(evt => {
      window.addEventListener(evt, onUserInteraction, { passive: true });
    });

    // Periodic check interval (handles tab sleep, backgrounding, or tab switching)
    const intervalId = setInterval(() => {
      const lastActive = sessionStorage.getItem('grow_last_activity');
      if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive, 10);
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          handleLogout('inactivity');
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      interactionEvents.forEach(evt => {
        window.removeEventListener(evt, onUserInteraction);
      });
    };
  }, [currentUser, handleLogout]);

  const handleSelectTab = (tab: 'map' | 'clearance' | 'ai' | 'spk' | 'kmz' | 'users') => {
    setVisitedTabs(prev => prev[tab] ? prev : { ...prev, [tab]: true });
    setActiveTab(tab);
  };

  const [poles, setPoles] = useState<PoleData[]>(INITIAL_POLES);
  const [spans, setSpans] = useState<CableSpan[]>(INITIAL_SPANS);
  const [spks, setSpks] = useState<MaintenanceWorkOrder[]>(INITIAL_SPKS);
  const [masterName, setMasterName] = useState<string>('TITIK TIANG BGL.kml');
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(true);
  const [systemMeta, setSystemMeta] = useState<SystemMetaState | null>(null);

  // Synchronization refs for instant live updates across AI Studio & Vercel
  const basePolesRef = useRef<PoleData[]>(INITIAL_POLES);
  const baseSpansRef = useRef<CableSpan[]>(INITIAL_SPANS);
  const cloudPolesRef = useRef<PoleData[]>([]);
  const cloudSpansRef = useRef<CableSpan[]>([]);
  const deletedPoleIdsRef = useRef<Set<string>>(new Set());
  const deletedSpanIdsRef = useRef<Set<string>>(new Set());

  const [inspectingPole, setInspectingPole] = useState<PoleData | null>(null);
  const [showAddPoleModal, setShowAddPoleModal] = useState<boolean>(false);
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [showFeederDrawer, setShowFeederDrawer] = useState<boolean>(false);

  // Feeder Custom Colors & Visibility state (matching user's reference)
  const [feederColors, setFeederColors] = useState<Record<string, string>>({
    'FEEDER ALLANG': '#EF4444',
    'FEEDER BANDARA 1': '#EAB308',
    'FEEDER BANDARA 2': '#A855F7',
    'FEEDER GALALA 1': '#EAB308',
    'FEEDER GALALA 2': '#06B6D4',
    'FEEDER HUTUMURI': '#84CC16',
    'FEEDER KARPAN 1': '#38BDF8',
    'FEEDER LATERI 1': '#22C55E',
    'FEEDER LATERI 2': '#A855F7',
    'FEEDER LATERI 3': '#EAB308',
    'FEEDER MVTIC 1': '#84CC16',
    'FEEDER MVTIC 2': '#06B6D4',
    'FEEDER PASSO': '#EF4444',
    'FEEDER RIJALI': '#22C55E',
    'FEEDER WAIHERU': '#EF4444',
    'FEEDER WAIHERU 1': '#06B6D4',
    'FEEDER WAIHERU 2': '#EAB308',
    'FEEDER WAIHERU 3': '#A855F7',
    'FEEDER WAYAME 1': '#3B82F6',
    'FEEDER WAYAME 2': '#EAB308',
    'Penyulang Passo': '#22C55E',
    'Penyulang Waiheru': '#EAB308',
    'Penyulang Lateri': '#A855F7',
    'Penyulang Tulehu': '#06B6D4',
    'Penyulang Suli': '#EC4899',
    'Penyulang Liang': '#F97316',
    'Penyulang Kota': '#84CC16'
  });

  const [feederVisibility, setFeederVisibility] = useState<Record<string, boolean>>({});

  const handleUpdateFeederColor = (feederName: string, newColor: string) => {
    setFeederColors(prev => {
      const updated = { ...prev, [feederName]: newColor };
      saveAppStateToCloud({ feederColors: JSON.stringify(updated) }).catch(() => {});
      return updated;
    });
  };

  const handleToggleFeederVisibility = (feederName: string) => {
    setFeederVisibility(prev => ({
      ...prev,
      [feederName]: prev[feederName] === undefined ? false : !prev[feederName]
    }));
  };

  const handleToggleAllFeeders = (visible: boolean) => {
    const allFeeders = Array.from(new Set(poles.map(p => p.feeder)));
    const updated: Record<string, boolean> = {};
    allFeeders.forEach(f => { updated[f] = visible; });
    setFeederVisibility(updated);
  };

  const handleDeleteFeeder = async (feederName: string) => {
    const targetPoles = poles.filter(p => p.feeder === feederName);
    for (const pole of targetPoles) {
      await handleDeletePole(pole.id);
    }
  };

  // New Custom Pole Form
  const [newPoleId, setNewPoleId] = useState('');
  const [newPoleFeeder, setNewPoleFeeder] = useState('Penyulang Passo');
  const [newPoleLat, setNewPoleLat] = useState(-3.6285);
  const [newPoleLng, setNewPoleLng] = useState(128.2321);
  const [newPoleLocation, setNewPoleLocation] = useState('Jl. Syaranualo, Passo, Ambon');
  const [newPoleClearance, setNewPoleClearance] = useState(3.5);

  const fetchPoles = async () => {
    try {
      const res = await fetch('/api/poles');
      if (res.ok) {
        const data = await res.json();
        if (data.poles && data.poles.length > 0) {
          basePolesRef.current = data.poles;
          setPoles(mergePolesWithCloud(data.poles, cloudPolesRef.current, deletedPoleIdsRef.current));
        }
        if (data.spans && data.spans.length > 0) {
          baseSpansRef.current = data.spans;
          setSpans(mergeSpansWithCloud(data.spans, cloudSpansRef.current, deletedSpanIdsRef.current));
        }
        if (data.masterName) setMasterName(data.masterName);
      }
    } catch (err) {
      // Backend not running (e.g. static on Vercel), handled by bundled data & Firestore
    }
  };

  const fetchSpks = async () => {
    try {
      const res = await fetch('/api/spk');
      if (res.ok) {
        const data = await res.json();
        if (data.spks && data.spks.length > 0) setSpks(data.spks);
      }
    } catch (err) {}
  };

  // Two-Way Real-Time Synchronization Listener Setup
  useEffect(() => {
    fetchPoles();
    fetchSpks();

    // 1. Subscribe to App State (deletion ledger & global settings)
    const unsubAppState = subscribeToAppState((appState) => {
      if (appState) {
        setSystemMeta(appState);
        if (appState.deletedPoleIds && Array.isArray(appState.deletedPoleIds)) {
          deletedPoleIdsRef.current = new Set(appState.deletedPoleIds.map(id => (id || '').toLowerCase()));
        }
        if (appState.deletedSpanIds && Array.isArray(appState.deletedSpanIds)) {
          deletedSpanIdsRef.current = new Set(appState.deletedSpanIds.map(id => (id || '').toLowerCase()));
        }
        if (appState.feederColors) {
          try {
            const parsed = JSON.parse(appState.feederColors);
            setFeederColors(prev => ({ ...prev, ...parsed }));
          } catch (e) {}
        }
        // Re-merge with active deletion ledger
        setPoles(mergePolesWithCloud(basePolesRef.current, cloudPolesRef.current, deletedPoleIdsRef.current));
        setSpans(mergeSpansWithCloud(baseSpansRef.current, cloudSpansRef.current, deletedSpanIdsRef.current));
      }
    });

    // 2. Subscribe to Real-Time Cloud Poles (updated or created on Vercel or AI Studio)
    const unsubPoles = subscribeToPoles((cloudPoles) => {
      cloudPolesRef.current = cloudPoles || [];
      setPoles(mergePolesWithCloud(basePolesRef.current, cloudPolesRef.current, deletedPoleIdsRef.current));
      setIsCloudSyncing(true);
    }, () => {
      setIsCloudSyncing(false);
    });

    // 3. Subscribe to Real-Time Cloud Cable Spans (tarik kabel, ubah kondisi di Vercel atau AI Studio)
    const unsubSpans = subscribeToSpans((cloudSpans) => {
      cloudSpansRef.current = cloudSpans || [];
      setSpans(mergeSpansWithCloud(baseSpansRef.current, cloudSpansRef.current, deletedSpanIdsRef.current));
      setIsCloudSyncing(true);
    }, () => {
      setIsCloudSyncing(false);
    });

    // 4. Subscribe to Real-Time Work Orders (SPK)
    const unsubSpks = subscribeToSpks((cloudSpks) => {
      if (cloudSpks && cloudSpks.length > 0) {
        setSpks(cloudSpks);
      }
    });

    return () => {
      unsubAppState();
      unsubPoles();
      unsubSpans();
      unsubSpks();
    };
  }, []);

  // Handlers with Two-Way Real-time Cloud Synchronization
  const handleRestoreMasterData = async () => {
    try {
      deletedPoleIdsRef.current.clear();
      deletedSpanIdsRef.current.clear();
      await saveAppStateToCloud({
        deletedPoleIds: [],
        deletedSpanIds: []
      });

      setPoles([...INITIAL_POLES]);
      setSpans([...INITIAL_SPANS]);

      try {
        await fetch('/api/master/restore', { method: 'POST' });
      } catch (e) {}

      setActiveTab('map');
    } catch (err) {
      console.error('Error restoring master data:', err);
    }
  };

  const handleImportKmzPoles = async (importedPoles: PoleData[], importedSpans: CableSpan[], replaceExisting: boolean) => {
    try {
      if (replaceExisting) {
        basePolesRef.current = [...importedPoles];
        baseSpansRef.current = [...importedSpans];
        setPoles([...importedPoles]);
        setSpans([...importedSpans]);
      } else {
        basePolesRef.current = [...importedPoles, ...basePolesRef.current];
        baseSpansRef.current = [...importedSpans, ...baseSpansRef.current];
        setPoles(prev => [...importedPoles, ...prev]);
        setSpans(prev => [...importedSpans, ...prev]);
      }

      // Save key new poles to Firestore
      for (const p of importedPoles.slice(0, 50)) {
        savePoleToCloud(p).catch(() => {});
      }
      for (const s of importedSpans.slice(0, 50)) {
        saveSpanToCloud(s).catch(() => {});
      }

      try {
        await fetch('/api/poles/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poles: importedPoles, spans: importedSpans, replaceExisting })
        });
      } catch (e) {}

      setActiveTab('map');
    } catch (err) {
      console.error('Error importing KMZ poles:', err);
    }
  };

  const handleCreateSpan = async (newSpan: CableSpan) => {
    // 1. Optimistic state update
    setSpans(prev => {
      const filtered = prev.filter(s =>
        !(s.fromPoleId === newSpan.fromPoleId && s.toPoleId === newSpan.toPoleId) &&
        !(s.fromPoleId === newSpan.toPoleId && s.toPoleId === newSpan.fromPoleId)
      );
      return [...filtered, newSpan];
    });

    // 2. Persist to Cloud Firestore (syncs across AI Studio and Vercel in real time)
    try {
      await saveSpanToCloud(newSpan);
    } catch (err) {
      console.error('Error saving span to Cloud Firestore:', err);
    }

    // 3. Notify local backend if running
    try {
      await fetch('/api/spans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSpan)
      });
    } catch (err) {}
  };

  const handleUpdateSpan = async (updatedSpan: CableSpan) => {
    // 1. Optimistic state update
    setSpans(prev => prev.map(s => s.id === updatedSpan.id ? updatedSpan : s));

    // 2. Persist to Cloud Firestore
    try {
      await saveSpanToCloud(updatedSpan);
    } catch (err) {
      console.error('Error updating span in Cloud Firestore:', err);
    }

    // 3. Notify local backend if running
    try {
      await fetch(`/api/spans/${encodeURIComponent(updatedSpan.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSpan)
      });
    } catch (err) {}
  };

  const handleDeleteSpan = async (spanId: string, fromPoleId?: string, toPoleId?: string) => {
    const targetId = (spanId || '').trim().toLowerCase();
    const pFrom = (fromPoleId || '').trim().toLowerCase();
    const pTo = (toPoleId || '').trim().toLowerCase();

    // 1. Optimistic state update
    setSpans(prev => prev.filter(s => {
      const sId = (s.id || '').trim().toLowerCase();
      if (sId === targetId) return false;
      if (pFrom && pTo) {
        const sFrom = (s.fromPoleId || '').trim().toLowerCase();
        const sTo = (s.toPoleId || '').trim().toLowerCase();
        if ((sFrom === pFrom && sTo === pTo) || (sFrom === pTo && sTo === pFrom)) {
          return false;
        }
      }
      return true;
    }));

    // 2. Add to deletion ledger
    deletedSpanIdsRef.current.add(targetId);
    if (spanId) deletedSpanIdsRef.current.add(spanId);
    if (pFrom && pTo) {
      const pair = pFrom < pTo ? `${pFrom}<->${pTo}` : `${pTo}<->${pFrom}`;
      deletedSpanIdsRef.current.add(pair);
    }

    // 3. Persist deletion to Cloud Firestore
    try {
      await deleteSpanFromCloud(spanId);
      await saveAppStateToCloud({
        deletedSpanIds: Array.from(deletedSpanIdsRef.current)
      });
    } catch (err) {
      console.error('Error deleting span in Cloud Firestore:', err);
    }

    // 4. Notify local backend
    try {
      const url = fromPoleId && toPoleId
        ? `/api/spans/${encodeURIComponent(spanId)}?from=${encodeURIComponent(fromPoleId)}&to=${encodeURIComponent(toPoleId)}`
        : `/api/spans/${encodeURIComponent(spanId)}`;
      await fetch(url, { method: 'DELETE' });
    } catch (err) {}
  };

  const handleDeletePole = async (poleId: string) => {
    const cleanId = poleId.trim().toLowerCase();

    // 1. Optimistically update local state immediately
    setPoles(prevPoles => prevPoles.filter(p => p.id.toLowerCase() !== cleanId && p.code.toLowerCase() !== cleanId));
    setSpans(prevSpans => prevSpans.filter(s => s.fromPoleId.toLowerCase() !== cleanId && s.toPoleId.toLowerCase() !== cleanId));

    // 2. Add to deletion ledger
    deletedPoleIdsRef.current.add(cleanId);
    deletedPoleIdsRef.current.add(poleId);

    // 3. Persist deletion to Cloud Firestore
    try {
      await deletePoleFromCloud(poleId);
      await saveAppStateToCloud({
        deletedPoleIds: Array.from(deletedPoleIdsRef.current)
      });
    } catch (err) {
      console.error('Error deleting pole in Cloud Firestore:', err);
    }

    // 4. Notify local backend
    try {
      await fetch(`/api/poles/${encodeURIComponent(poleId)}`, { method: 'DELETE' });
    } catch (err) {}
  };

  const handleUpdatePole = async (updatedPole: PoleData) => {
    // 1. Optimistic state update
    setPoles(prev => prev.map(p => p.id === updatedPole.id ? updatedPole : p));

    // 2. Persist to Cloud Firestore
    try {
      await savePoleToCloud(updatedPole);
    } catch (err) {
      console.error('Error updating pole in Cloud Firestore:', err);
    }

    // 3. Notify local backend
    try {
      await fetch(`/api/poles/${encodeURIComponent(updatedPole.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPole)
      });
    } catch (err) {}
  };

  const handleUpdateClearance = async (poleId: string, newDistance: number) => {
    const pole = poles.find(p => p.id === poleId);
    if (!pole) return;

    const updatedStatus = newDistance < 1.5
      ? 'Bahaya Kritis (<1.5m)'
      : newDistance < 3.0
        ? 'Pelanggaran ROW Pohon (<3.0m)'
        : 'Aman (≥3.0m)';

    const updatedPole: PoleData = {
      ...pole,
      clearanceDistanceMeters: newDistance,
      clearanceStatus: updatedStatus
    };

    setPoles(prev => prev.map(p => p.id === poleId ? updatedPole : p));

    try {
      await savePoleToCloud(updatedPole);
    } catch (err) {
      console.error('Error updating clearance in Cloud Firestore:', err);
    }

    try {
      await fetch(`/api/poles/${poleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearanceDistanceMeters: newDistance,
          clearanceStatus: updatedStatus
        })
      });
    } catch (err) {}
  };

  const handleSubmitInspection = async (poleId: string, inspection: InspectionRecord) => {
    const pole = poles.find(p => p.id === poleId);
    if (!pole) return;

    const updatedPole: PoleData = {
      ...pole,
      lastInspectionDate: inspection.date || new Date().toISOString().split('T')[0],
      physicalCondition: inspection.condition || pole.physicalCondition,
      clearanceDistanceMeters: inspection.cableClearanceMeters ?? pole.clearanceDistanceMeters,
      clearanceStatus: inspection.cableClearanceMeters !== undefined
        ? (inspection.cableClearanceMeters < 1.5 ? 'Bahaya Kritis (<1.5m)' : inspection.cableClearanceMeters < 3.0 ? 'Pelanggaran ROW Pohon (<3.0m)' : 'Aman (≥3.0m)')
        : pole.clearanceStatus,
      clearanceObject: inspection.clearanceObject || pole.clearanceObject,
      inspectionHistory: [inspection, ...(pole.inspectionHistory || [])]
    };

    setPoles(prev => prev.map(p => p.id === poleId ? updatedPole : p));

    try {
      await savePoleToCloud(updatedPole);
    } catch (err) {
      console.error('Error submitting inspection to Cloud Firestore:', err);
    }

    try {
      await fetch(`/api/poles/${poleId}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inspection)
      });
    } catch (err) {}
  };

  const handleCreateSpk = async (newSpk: MaintenanceWorkOrder) => {
    setSpks(prev => [newSpk, ...prev]);

    // Update target pole spkStatus
    if (newSpk.poleId) {
      setPoles(prev => prev.map(p => {
        if (p.id === newSpk.poleId) {
          const updated = { ...p, spkStatus: 'SPK Diterbitkan' as const };
          savePoleToCloud(updated).catch(() => {});
          return updated;
        }
        return p;
      }));
    }

    try {
      await saveSpkToCloud(newSpk);
    } catch (err) {
      console.error('Error saving SPK to Cloud Firestore:', err);
    }

    try {
      await fetch('/api/spk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSpk)
      });
    } catch (err) {}

    setActiveTab('spk');
  };

  const handleAutoGenerateSpksFromAi = async (spkDrafts: Partial<MaintenanceWorkOrder>[]) => {
    for (const draft of spkDrafts) {
      if (draft.poleId) {
        const fullSpk: MaintenanceWorkOrder = {
          id: `SPK-${Date.now()}-${Math.random().toString().slice(2, 5)}`,
          spkNumber: `SPK/ULP-BGL/2026/${Math.floor(100 + Math.random() * 899)}`,
          poleId: draft.poleId,
          locationName: draft.locationName || 'Lokasi ULP Baguala',
          issueType: draft.issueType || 'Rabas Pohon (ROW < 3m)',
          priority: (draft.priority as any) || 'Tinggi',
          assignedTeam: draft.assignedTeam || 'Tim Yantek Regu A Passo',
          scheduledDate: new Date().toISOString().split('T')[0],
          status: 'Disetujui',
          aiRecommendation: draft.aiRecommendation,
          createdAt: new Date().toISOString().split('T')[0]
        };
        await handleCreateSpk(fullSpk);
      }
    }
  };

  const handleSaveNewPole = async (e: React.FormEvent) => {
    e.preventDefault();
    const poleId = newPoleId || `BGL-NEW-${String(poles.length + 1).padStart(3, '0')}`;
    const newPole: PoleData = {
      id: poleId,
      code: `${newPoleFeeder.substring(10, 13).toUpperCase()}-TM-${String(poles.length + 1).padStart(3, '0')}`,
      feeder: newPoleFeeder,
      type: 'TM',
      lat: newPoleLat,
      lng: newPoleLng,
      locationName: newPoleLocation,
      material: 'Beton',
      heightMeters: 12,
      physicalCondition: 'Baik',
      installationYear: 2026,
      lastInspectionDate: new Date().toISOString().split('T')[0],
      clearanceDistanceMeters: newPoleClearance,
      clearanceStatus: newPoleClearance < 3.0 ? 'Pelanggaran ROW Pohon (<3.0m)' : 'Aman (≥3.0m)',
      clearanceObject: newPoleClearance < 3.0 ? 'Pohon Kelapa/Pala' : 'Bebas',
      spkStatus: 'Belum SPK',
      inspectionHistory: []
    };

    setPoles(prev => [newPole, ...prev]);

    try {
      await savePoleToCloud(newPole);
    } catch (err) {
      console.error('Error saving new pole to Cloud Firestore:', err);
    }

    try {
      await fetch('/api/poles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPole)
      });
    } catch (err) {}

    setShowAddPoleModal(false);
    setActiveTab('map');
  };

  const rowViolations = poles.filter(p => p.clearanceDistanceMeters < 3.0).length;
  const criticalPoles = poles.filter(p => p.clearanceDistanceMeters < 1.5 || p.physicalCondition === 'Korosi Kritis').length;

  // If not logged in, render the dedicated PLN GROW Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setSessionExpiredMessage(null);
          setCurrentUser(user);
        }}
        sessionExpiredMessage={sessionExpiredMessage}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col ${isLoggingOut ? 'animate-dashboard-exit pointer-events-none' : 'animate-dashboard-enter'}`}>
      
      {/* Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        totalPoles={poles.length}
        totalSpans={spans.length}
        rowViolations={rowViolations}
        criticalPoles={criticalPoles}
        onOpenAiAssistant={() => setShowAiAssistant(true)}
        masterName={masterName}
        currentUser={currentUser}
        onLogout={handleLogout}
        isCloudConnected={isCloudSyncing}
        systemMeta={systemMeta}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-y-auto relative">
        {/* Map Tab - Kept mounted to preserve Leaflet instance & prevent reinitialization freeze */}
        <div className={`w-full h-full flex flex-col ${activeTab === 'map' ? 'block animate-tab-fade-slide' : 'hidden'}`}>
          <MapViewer
            poles={poles}
            spans={spans}
            isActive={activeTab === 'map'}
            feederColors={feederColors}
            feederVisibility={feederVisibility}
            onSelectPole={(pole) => setInspectingPole(pole)}
            onOpenAddInspection={(pole) => setInspectingPole(pole)}
            onCreateSpkForPole={(pole) => {
              handleCreateSpk({
                id: `SPK-${Date.now()}`,
                spkNumber: `SPK/ULP-BGL/2026/${String(spks.length + 101).padStart(3, '0')}`,
                poleId: pole.id,
                locationName: pole.locationName,
                issueType: `Rabas Pohon & Perbaikan (${pole.clearanceStatus})`,
                priority: pole.clearanceDistanceMeters < 1.5 ? 'Kritis' : 'Tinggi',
                assignedTeam: 'Tim Yantek Regu A Passo',
                scheduledDate: new Date().toISOString().split('T')[0],
                status: 'Disetujui',
                createdAt: new Date().toISOString().split('T')[0]
              });
            }}
            onDeletePole={handleDeletePole}
            onUpdatePole={handleUpdatePole}
            onAddCustomPole={() => setShowAddPoleModal(true)}
            onOpenFeederDrawer={() => setShowFeederDrawer(true)}
            onSaveSpan={handleCreateSpan}
            onUpdateSpan={handleUpdateSpan}
            onDeleteSpan={handleDeleteSpan}
          />
        </div>

        {visitedTabs['clearance'] && (
          <div className={`w-full min-h-full ${activeTab === 'clearance' ? 'block animate-tab-fade-slide' : 'hidden'}`}>
            <CableClearanceManager
              poles={poles}
              spans={spans}
              onOpenMapAtPole={(pole) => handleSelectTab('map')}
              onCreateSpkForPole={(pole) => {
                handleCreateSpk({
                  id: `SPK-${Date.now()}`,
                  spkNumber: `SPK/ULP-BGL/2026/${String(spks.length + 101).padStart(3, '0')}`,
                  poleId: pole.id,
                  locationName: pole.locationName,
                  issueType: `Rabas Pohon (Pelanggaran ROW ${pole.clearanceDistanceMeters}m)`,
                  priority: pole.clearanceDistanceMeters < 1.5 ? 'Kritis' : 'Tinggi',
                  assignedTeam: 'Tim Yantek Regu A Passo',
                  scheduledDate: new Date().toISOString().split('T')[0],
                  status: 'Disetujui',
                  createdAt: new Date().toISOString().split('T')[0]
                });
              }}
              onUpdateClearanceDistance={handleUpdateClearance}
              onDeletePole={handleDeletePole}
              onUpdateSpan={handleUpdateSpan}
              onDeleteSpan={handleDeleteSpan}
            />
          </div>
        )}

        {visitedTabs['ai'] && (
          <div className={`w-full min-h-full ${activeTab === 'ai' ? 'block animate-tab-fade-slide' : 'hidden'}`}>
            <AiPredictiveDashboard
              poles={poles}
              onAutoGenerateSpks={handleAutoGenerateSpksFromAi}
            />
          </div>
        )}

        {visitedTabs['spk'] && (
          <div className={`w-full min-h-full ${activeTab === 'spk' ? 'block animate-tab-fade-slide' : 'hidden'}`}>
            <SpkManager
              spks={spks}
              poles={poles}
              onCreateSpk={handleCreateSpk}
            />
          </div>
        )}

        {visitedTabs['kmz'] && (
          <div className={`w-full min-h-full ${activeTab === 'kmz' ? 'block animate-tab-fade-slide' : 'hidden'}`}>
            <KmzUploader
              onImportSuccess={handleImportKmzPoles}
              onLoadSampleKmz={() => {
                fetchPoles();
                handleSelectTab('map');
              }}
              onRestoreMasterData={handleRestoreMasterData}
              masterName={masterName}
              totalMasterPoles={poles.length}
            />
          </div>
        )}

        {visitedTabs['users'] && (
          <div className={`w-full min-h-full ${activeTab === 'users' ? 'block animate-tab-fade-slide' : 'hidden'}`}>
            <UserManagement currentUser={currentUser} />
          </div>
        )}
      </main>

      {/* Inspection Modal */}
      {inspectingPole && (
        <AddInspectionModal
          pole={inspectingPole}
          onClose={() => setInspectingPole(null)}
          onSubmitInspection={handleSubmitInspection}
        />
      )}

      {/* Manual Add Pole Modal */}
      {showAddPoleModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">Tambah Titik Tiang Listrik Baru</h3>
              <button onClick={() => setShowAddPoleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPole} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">ID Tiang Unik</label>
                <input
                  type="text"
                  value={newPoleId}
                  onChange={(e) => setNewPoleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl"
                  placeholder="Contoh: BGL-PSS-099"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Penyulang</label>
                <select
                  value={newPoleFeeder}
                  onChange={(e) => setNewPoleFeeder(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl"
                >
                  <option value="Penyulang Passo">Penyulang Passo</option>
                  <option value="Penyulang Lateri">Penyulang Lateri</option>
                  <option value="Penyulang Waiheru">Penyulang Waiheru</option>
                  <option value="Penyulang Tulehu">Penyulang Tulehu</option>
                  <option value="Penyulang Suli">Penyulang Suli</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Latitude GPS</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newPoleLat}
                    onChange={(e) => setNewPoleLat(parseFloat(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Longitude GPS</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newPoleLng}
                    onChange={(e) => setNewPoleLng(parseFloat(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Nama Lokasi / Jalan</label>
                <input
                  type="text"
                  value={newPoleLocation}
                  onChange={(e) => setNewPoleLocation(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Jarak Kabel ke Objek Terdekat (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newPoleClearance}
                  onChange={(e) => setNewPoleClearance(parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPoleModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md"
                >
                  Simpan Tiang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Consultation Drawer */}
      <AiAssistantDrawer
        isOpen={showAiAssistant}
        onClose={() => setShowAiAssistant(false)}
      />

      {/* Feeder & Cable Color Management Drawer */}
      <FeederManagerDrawer
        isOpen={showFeederDrawer}
        onClose={() => setShowFeederDrawer(false)}
        poles={poles}
        feederColors={feederColors}
        feederVisibility={feederVisibility}
        onUpdateFeederColor={handleUpdateFeederColor}
        onToggleFeederVisibility={handleToggleFeederVisibility}
        onToggleAllFeeders={handleToggleAllFeeders}
        onFocusFeederOnMap={(feederName) => {
          setActiveTab('map');
          setShowFeederDrawer(false);
        }}
        onDeleteFeeder={handleDeleteFeeder}
        onOpenKmzUploader={() => {
          setShowFeederDrawer(false);
          setActiveTab('kmz');
        }}
      />

    </div>
  );
}
