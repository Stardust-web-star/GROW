import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  TreePine,
  Plus,
  Search,
  MapPin,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Edit3,
  Trash2,
  Eye,
  Crosshair,
  Map as MapIcon,
  Layers,
  X,
  Users,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ZoomIn,
  Upload,
  Check
} from 'lucide-react';
import { RowTreeInspection, PoleData, UserAccount } from '../types';

interface RowTreeInspectionManagerProps {
  rowTrees: RowTreeInspection[];
  poles: PoleData[];
  currentUser: UserAccount | null;
  onSaveTree: (tree: RowTreeInspection) => Promise<void> | void;
  onDeleteTree: (treeId: string) => Promise<void> | void;
  onFocusTreeOnMap: (tree: RowTreeInspection) => void;
  initialEditingTreeId?: string | null;
  onClearInitialEdit?: () => void;
}

const DEFAULT_FEEDER_OPTIONS = [
  'FEEDER PASSO',
  'FEEDER WAIHERU 1',
  'FEEDER WAIHERU 2',
  'FEEDER WAIHERU 3',
  'FEEDER LATERI 1',
  'FEEDER LATERI 2',
  'FEEDER LATERI 3',
  'FEEDER GALALA 1',
  'FEEDER GALALA 2',
  'FEEDER BANDARA 1',
  'FEEDER BANDARA 2',
  'FEEDER ALLANG',
  'FEEDER HUTUMURI',
  'FEEDER KARPAN 1',
  'FEEDER RIJALI',
  'FEEDER WAYAME 1',
  'FEEDER WAYAME 2',
  'Penyulang Passo',
  'Penyulang Waiheru',
  'Penyulang Lateri',
  'Penyulang Tulehu',
  'Penyulang Suli',
  'Penyulang Liang'
];

const QUICK_TREE_TYPES = [
  'Pohon Kelapa',
  'Pohon Mangga',
  'Pohon Pala',
  'Pohon Bambu',
  'Pohon Mahoni',
  'Pohon Beringin',
  'Pohon Jati / Kayu',
  'Semak / Ranting Lebat'
];

// Format local datetime for datetime-local input (YYYY-MM-DDTHH:mm)
function getNowLocalDateTimeInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function formatReadableDateTime(val?: string): string {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Compress image to max 900px and JPEG quality 0.72 so Base64 size stays ~80-150KB (< 450KB Firestore rule limit)
function compressTreeEvidenceImage(file: File, maxDim = 900, quality = 0.72): Promise<string> {
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
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let output = canvas.toDataURL('image/jpeg', quality);
        // Double-check against Firestore 450,000 char safety limit
        if (output.length > 420000) {
          output = canvas.toDataURL('image/jpeg', 0.55);
        }
        resolve(output);
      };
      img.src = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}

// Parse "lat, lng" string safely
function parseCoordinateString(input: string): { lat: number; lng: number } | null {
  const cleaned = input.trim().replace(/[()]/g, '');
  const parts = cleaned.split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

// Embedded Interactive Leaflet Coordinate Picker Modal with Custom Tree Pin
interface CoordinatePickerModalProps {
  initialLat: number;
  initialLng: number;
  poles: PoleData[];
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
}

const CoordinatePickerModal: React.FC<CoordinatePickerModalProps> = ({
  initialLat,
  initialLng,
  poles,
  onClose,
  onConfirm
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const treeMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng
  });
  const [layerMode, setLayerMode] = useState<'satellite' | 'streets'>('satellite');
  const [isLocating, setIsLocating] = useState(false);

  const createTreePinIcon = () =>
    L.divIcon({
      className: 'custom-tree-picker-pin',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform:translateY(-6px);">
          <div style="
            width: 40px; height: 40px; border-radius: 9999px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border: 3px solid #ffffff;
            box-shadow: 0 8px 20px rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
          ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/>
              <path d="M12 22v-3"/>
            </svg>
          </div>
          <div style="width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 9px solid #ffffff; margin-top: -2px;"></div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 45]
    });

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 17,
      zoomControl: false
    });
    mapRef.current = map;

    const sat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri Satellite', maxZoom: 19 }
    ).addTo(map);
    tileLayerRef.current = sat;

    // Reference utility poles (lightweight canvas dots so field officer sees nearby network lines)
    const renderer = L.canvas({ padding: 0.3 });
    poles.slice(0, 600).forEach((p) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 4.5,
        fillColor: '#38bdf8',
        fillOpacity: 0.75,
        color: '#0f172a',
        weight: 1.5,
        renderer
      })
        .bindTooltip(`${p.code} (${p.feeder})`, { direction: 'top' })
        .addTo(map);
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: createTreePinIcon(),
      draggable: true
    }).addTo(map);
    treeMarkerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setPickedCoords({ lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lng]);
      setPickedCoords({ lat, lng });
    });

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      treeMarkerRef.current = null;
    };
  }, [initialLat, initialLng, poles]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const url =
      layerMode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png';
    tileLayerRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(map);
  }, [layerMode]);

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setPickedCoords({ lat, lng });
        if (treeMarkerRef.current && mapRef.current) {
          treeMarkerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], 18, { animate: true });
        }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-modal-pop max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <TreePine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Tentukan Koordinat Pohon di Peta</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ketuk peta atau geser pin pohon untuk menentukan posisi tepat pohon
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative h-[340px] sm:h-[400px] w-full bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Map Layer & GPS Floating Controls */}
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setLayerMode((m) => (m === 'satellite' ? 'streets' : 'satellite'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white border border-slate-700 text-xs font-bold shadow-lg cursor-pointer hover:bg-slate-800"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{layerMode === 'satellite' ? 'Satelit' : 'Peta'}</span>
            </button>
            <button
              type="button"
              onClick={handleUseCurrentGps}
              disabled={isLocating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 text-xs font-bold shadow-lg cursor-pointer disabled:opacity-60"
            >
              <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Mencari...' : 'GPS Saya'}</span>
            </button>
          </div>

          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-emerald-500/40 text-xs font-mono shadow-lg flex items-center gap-2">
            <TreePine className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {pickedCoords.lat.toFixed(6)}, {pickedCoords.lng.toFixed(6)}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Titik biru menandakan posisi tiang PLN terdekat sebagai acuan.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => onConfirm(pickedCoords.lat, pickedCoords.lng)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5 btn-tactile"
            >
              <Check className="w-4 h-4" />
              <span>Gunakan Koordinat Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RowTreeInspectionManager: React.FC<RowTreeInspectionManagerProps> = ({
  rowTrees,
  poles,
  currentUser,
  onSaveTree,
  onDeleteTree,
  onFocusTreeOnMap,
  initialEditingTreeId,
  onClearInitialEdit
}) => {
  // List Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Belum Eksekusi' | 'Sudah Eksekusi'>('ALL');
  const [feederFilter, setFeederFilter] = useState<string>('ALL');
  const [eksekutorFilter, setEksekutorFilter] = useState<string>('ALL');

  // View State: 'list' vs 'form'
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTree, setEditingTree] = useState<RowTreeInspection | null>(null);

  // Confirm delete inline id
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Photo lightbox state
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Form Fields (matching the uploaded Form Peta Pohon screenshots)
  const [waktu, setWaktu] = useState<string>(getNowLocalDateTimeInput());
  const [penyulang, setPenyulang] = useState<string>('FEEDER PASSO');
  const [isFeederDropdownOpen, setIsFeederDropdownOpen] = useState(false);
  const feederDropdownRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<string>('');
  const [pohon, setPohon] = useState<string>('');
  const [coordText, setCoordText] = useState<string>('-3.628500, 128.232100');
  const [evidenSebelum, setEvidenSebelum] = useState<string | undefined>(undefined);
  const [evidenSesudah, setEvidenSesudah] = useState<string | undefined>(undefined);
  const [inspektor, setInspektor] = useState<string>('Inspektor 1');
  const [eksekutor, setEksekutor] = useState<string>('Tim Putih');
  const [keteranganEksekusi, setKeteranganEksekusi] = useState<'Belum Eksekusi' | 'Sudah Eksekusi'>('Belum Eksekusi');
  const [catatan, setCatatan] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [gpsFeedback, setGpsFeedback] = useState<string | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCoordPickerModal, setShowCoordPickerModal] = useState(false);

  // Unique Feeder Options from poles + saved trees + defaults
  const allFeederOptions = useMemo(() => {
    const set = new Set<string>();
    poles.forEach((p) => {
      if (p.feeder) set.add(p.feeder.trim());
    });
    rowTrees.forEach((t) => {
      if (t.penyulang) set.add(t.penyulang.trim());
    });
    DEFAULT_FEEDER_OPTIONS.forEach((f) => set.add(f));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [poles, rowTrees]);

  // Close feeder dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (feederDropdownRef.current && !feederDropdownRef.current.contains(e.target as Node)) {
        setIsFeederDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const openNewForm = () => {
    setEditingTree(null);
    setWaktu(getNowLocalDateTimeInput());
    setPenyulang(allFeederOptions[0] || 'FEEDER PASSO');
    setSection('');
    setPohon('');
    setCoordText('-3.628500, 128.232100');
    setEvidenSebelum(undefined);
    setEvidenSesudah(undefined);
    setInspektor('Inspektor 1');
    setEksekutor('Tim Putih');
    setKeteranganEksekusi('Belum Eksekusi');
    setCatatan('');
    setFormError(null);
    setGpsFeedback(null);
    setIsFormOpen(true);
  };

  const openEditForm = (tree: RowTreeInspection) => {
    setEditingTree(tree);
    // Normalize waktu for datetime-local if possible
    let waktuFormatted = tree.waktu || getNowLocalDateTimeInput();
    if (waktuFormatted.length > 16 && waktuFormatted.includes('T')) {
      waktuFormatted = waktuFormatted.slice(0, 16);
    }
    setWaktu(waktuFormatted);
    setPenyulang(tree.penyulang || '');
    setSection(tree.section || '');
    setPohon(tree.pohon || '');
    setCoordText(`${Number(tree.lat).toFixed(6)}, ${Number(tree.lng).toFixed(6)}`);
    setEvidenSebelum(tree.evidenSebelum);
    setEvidenSesudah(tree.evidenSesudah);
    setInspektor(tree.inspektor || 'Inspektor 1');
    setEksekutor(tree.eksekutor || 'Tim Putih');
    setKeteranganEksekusi(tree.keteranganEksekusi || 'Belum Eksekusi');
    setCatatan(tree.catatan || '');
    setFormError(null);
    setGpsFeedback(null);
    setIsFormOpen(true);
  };

  // Support external navigation to edit a tree from Map popup
  useEffect(() => {
    if (initialEditingTreeId) {
      const target = rowTrees.find((t) => t.id === initialEditingTreeId);
      if (target) {
        openEditForm(target);
      }
      if (onClearInitialEdit) {
        onClearInitialEdit();
      }
    }
  }, [initialEditingTreeId, rowTrees, onClearInitialEdit]);

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      setFormError('Perangkat/browser tidak mendukung akses lokasi GPS.');
      return;
    }
    setIsGettingGps(true);
    setGpsFeedback('Mengambil koordinat GPS terkini...');
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setCoordText(`${lat}, ${lng}`);
        setGpsFeedback(`GPS terkunci (±${Math.round(pos.coords.accuracy)} m)`);
        setIsGettingGps(false);
      },
      (err) => {
        setIsGettingGps(false);
        setGpsFeedback(null);
        setFormError(
          err.code === err.PERMISSION_DENIED
            ? 'Izin GPS ditolak browser. Anda tetap dapat mengetik koordinat atau memilih langsung di peta.'
            : 'Gagal memperoleh sinyal GPS. Gunakan tombol "Pilih di Peta" untuk menentukan lokasi pohon.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleEvidenceFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'sebelum' | 'sesudah'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    try {
      const base64 = await compressTreeEvidenceImage(file);
      if (target === 'sebelum') {
        setEvidenSebelum(base64);
      } else {
        setEvidenSesudah(base64);
      }
    } catch {
      setFormError('Gagal memproses file foto eviden. Pastikan file berformat gambar (JPG/PNG).');
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!waktu.trim()) {
      setFormError('Waktu inspeksi wajib diisi.');
      return;
    }
    if (!penyulang.trim()) {
      setFormError('Penyulang wajib dipilih atau diisi.');
      return;
    }
    if (!section.trim()) {
      setFormError('Section / lokasi segmen tiang wajib diisi.');
      return;
    }
    if (!pohon.trim()) {
      setFormError('Jenis / nama pohon wajib diisi.');
      return;
    }

    const parsedCoords = parseCoordinateString(coordText);
    if (!parsedCoords) {
      setFormError('Format Koordinat Pohon tidak valid. Gunakan format: Latitude, Longitude (contoh: -3.628500, 128.232100).');
      return;
    }

    if (!inspektor.trim() || !eksekutor.trim()) {
      setFormError('Inspektor dan Eksekutor wajib dipilih.');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const record: RowTreeInspection = {
        id:
          editingTree?.id ||
          `TREE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        waktu: waktu.trim(),
        penyulang: penyulang.trim(),
        section: section.trim(),
        pohon: pohon.trim(),
        lat: parsedCoords.lat,
        lng: parsedCoords.lng,
        evidenSebelum: evidenSebelum || undefined,
        evidenSesudah: evidenSesudah || undefined,
        inspektor,
        eksekutor,
        keteranganEksekusi,
        catatan: catatan.trim() || undefined,
        createdByUserId: editingTree?.createdByUserId || currentUser?.userId || 'petugasrow',
        createdAt: editingTree?.createdAt || nowIso,
        updatedAt: nowIso
      };

      await onSaveTree(record);
      setIsFormOpen(false);
      setEditingTree(null);
    } catch {
      setFormError('Terjadi kendala saat menyimpan data inspeksi pohon.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered list for Dashboard View
  const filteredTrees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rowTrees.filter((t) => {
      const matchesSearch =
        !q ||
        t.pohon.toLowerCase().includes(q) ||
        t.section.toLowerCase().includes(q) ||
        t.penyulang.toLowerCase().includes(q) ||
        t.inspektor.toLowerCase().includes(q) ||
        t.eksekutor.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'ALL' || t.keteranganEksekusi === statusFilter;
      const matchesFeeder = feederFilter === 'ALL' || t.penyulang === feederFilter;
      const matchesEksekutor = eksekutorFilter === 'ALL' || t.eksekutor === eksekutorFilter;
      return matchesSearch && matchesStatus && matchesFeeder && matchesEksekutor;
    });
  }, [rowTrees, searchQuery, statusFilter, feederFilter, eksekutorFilter]);

  const totalCount = rowTrees.length;
  const belumCount = rowTrees.filter((t) => t.keteranganEksekusi === 'Belum Eksekusi').length;
  const sudahCount = rowTrees.filter((t) => t.keteranganEksekusi === 'Sudah Eksekusi').length;

  const currentParsedCoords = parseCoordinateString(coordText) || { lat: -3.6285, lng: 128.2321 };

  // =========================================================================
  // FORM VIEW: "Form Peta Pohon" (Matching & Enhancing Uploaded Screenshots)
  // =========================================================================
  if (isFormOpen) {
    return (
      <div className="min-h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col animate-tab-fade-slide">
        {/* Clean Form Top Header Bar (with Back Button like Reference) */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingTree(null);
                }}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer btn-tactile"
                title="Kembali ke Daftar Peta Pohon"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <TreePine className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>{editingTree ? 'Edit Form Peta Pohon' : 'Form Peta Pohon'}</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Inspeksi ROW Sebelum &amp; Sesudah Pekerjaan Rabas Pohon
                </p>
              </div>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <Users className="w-3.5 h-3.5" />
              <span>{currentUser?.userId}</span>
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveForm} className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-28 space-y-5">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-modal-pop">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Waktu * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Waktu <span className="text-sky-500 font-black">*</span>
              </label>
              <button
                type="button"
                onClick={() => setWaktu(getNowLocalDateTimeInput())}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Gunakan Waktu Sekarang
              </button>
            </div>
            <div className="relative">
              <input
                type="datetime-local"
                value={waktu}
                onChange={(e) => setWaktu(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all"
              />
            </div>
          </div>

          {/* 2. Penyulang * */}
          <div
            ref={feederDropdownRef}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 relative"
          >
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              Penyulang <span className="text-sky-500 font-black">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={penyulang}
                onChange={(e) => setPenyulang(e.target.value)}
                onFocus={() => setIsFeederDropdownOpen(true)}
                placeholder="Pilih atau ketik nama penyulang..."
                required
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setIsFeederDropdownOpen((o) => !o)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                title="Buka daftar penyulang"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFeederDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
              </button>
            </div>
            {isFeederDropdownOpen && (
              <div className="absolute left-4 right-4 top-[calc(100%-8px)] z-30 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 divide-y divide-slate-100 dark:divide-slate-800 animate-dropdown">
                {allFeederOptions
                  .filter((f) => !penyulang.trim() || f.toLowerCase().includes(penyulang.toLowerCase()) || allFeederOptions.includes(penyulang))
                  .map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setPenyulang(opt);
                        setIsFeederDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2.5 text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                        opt === penyulang
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt}</span>
                      {opt === penyulang && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* 3. Section * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              Section <span className="text-sky-500 font-black">*</span>
            </label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Contoh: Section Passo - BGL-PSS-014 / Depan SMPN 14"
              required
              className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all"
            />
          </div>

          {/* 4. Pohon * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              Pohon <span className="text-sky-500 font-black">*</span>
            </label>
            <input
              type="text"
              value={pohon}
              onChange={(e) => setPohon(e.target.value)}
              placeholder="Masukkan jenis pohon (misal: Pohon Kelapa, Mangga, Bambu)"
              required
              className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {QUICK_TREE_TYPES.map((treeType) => (
                <button
                  key={treeType}
                  type="button"
                  onClick={() => setPohon(treeType)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer chip-interactive ${
                    pohon === treeType
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                  }`}
                >
                  {treeType}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Koordinat Pohon * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Koordinat Pohon <span className="text-sky-500 font-black">*</span>
              </label>
              {gpsFeedback && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {gpsFeedback}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={coordText}
                onChange={(e) => setCoordText(e.target.value)}
                placeholder="-3.628500, 128.232100"
                required
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-mono font-semibold text-slate-900 dark:text-white outline-none transition-all"
              />
              <MapPin className="w-4 h-4 text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleGetCurrentGps}
                disabled={isGettingGps}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 text-xs font-bold cursor-pointer transition-all btn-tactile disabled:opacity-60"
              >
                <Crosshair className={`w-4 h-4 ${isGettingGps ? 'animate-spin' : ''}`} />
                <span>{isGettingGps ? 'Mengambil GPS...' : 'Ambil GPS Saat Ini'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCoordPickerModal(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 text-xs font-bold cursor-pointer transition-all btn-tactile"
              >
                <MapIcon className="w-4 h-4" />
                <span>Pilih Titik di Peta</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Titik koordinat ini akan otomatis tampil di <b>Peta GIS</b> dengan ikon <b>Logo Pohon</b>.
            </p>
          </div>

          {/* 6 & 7. Eviden Sebelum & Eviden Sesudah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Eviden Sebelum */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Eviden Sebelum
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Sebelum Rabas
                </span>
              </div>

              {evidenSebelum ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
                  <div
                    onClick={() =>
                      setLightboxPhoto({
                        url: evidenSebelum,
                        title: `Eviden Sebelum - ${pohon || 'Pohon ROW'}`,
                        subtitle: `${penyulang} · ${section}`
                      })
                    }
                    className="relative h-40 w-full cursor-pointer group"
                  >
                    <img
                      src={evidenSebelum}
                      alt="Eviden Sebelum"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <ZoomIn className="w-3.5 h-3.5" /> Perbesar
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <label className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" /> Ganti Foto
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleEvidenceFileChange(e, 'sebelum')}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setEvidenSebelum(undefined)}
                      className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <label className="h-32 w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:text-emerald-500 flex items-center justify-center transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Unggah / Foto Kondisi Sebelum
                  </span>
                  <span className="text-[10px] text-slate-400">Ketuk untuk kamera atau galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleEvidenceFileChange(e, 'sebelum')}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Eviden Sesudah */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Eviden Sesudah
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Sesudah Rabas
                </span>
              </div>

              {evidenSesudah ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950">
                  <div
                    onClick={() =>
                      setLightboxPhoto({
                        url: evidenSesudah,
                        title: `Eviden Sesudah - ${pohon || 'Pohon ROW'}`,
                        subtitle: `${penyulang} · ${section}`
                      })
                    }
                    className="relative h-40 w-full cursor-pointer group"
                  >
                    <img
                      src={evidenSesudah}
                      alt="Eviden Sesudah"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <ZoomIn className="w-3.5 h-3.5" /> Perbesar
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs font-bold">
                    <label className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" /> Ganti Foto
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleEvidenceFileChange(e, 'sesudah')}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setEvidenSesudah(undefined)}
                      className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <label className="h-32 w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:text-emerald-500 flex items-center justify-center transition-colors">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Unggah / Foto Kondisi Sesudah
                  </span>
                  <span className="text-[10px] text-slate-400">Ketuk untuk kamera atau galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleEvidenceFileChange(e, 'sesudah')}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* 8. Inspektor * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              Inspektor <span className="text-sky-500 font-black">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['Inspektor 1', 'Inspektor 2'] as const).map((opt) => {
                const active = inspektor === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setInspektor(opt)}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer btn-tactile flex items-center justify-center gap-2 ${
                      active
                        ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-500/20'
                        : 'bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 9. Eksekutor * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              Eksekutor <span className="text-sky-500 font-black">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['Tim Putih', 'Tim Hitam'] as const).map((opt) => {
                const active = eksekutor === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setEksekutor(opt)}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer btn-tactile flex items-center justify-center gap-2 ${
                      active
                        ? opt === 'Tim Putih'
                          ? 'bg-teal-600 text-white border-teal-400 shadow-md shadow-teal-500/20'
                          : 'bg-slate-800 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-900 dark:border-amber-400 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-400'
                    }`}
                  >
                    {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10. Keterangan Eksekusi * */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">
              Keterangan Eksekusi <span className="text-sky-500 font-black">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setKeteranganEksekusi('Belum Eksekusi')}
                className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer btn-tactile flex items-center justify-center gap-2 ${
                  keteranganEksekusi === 'Belum Eksekusi'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black'
                    : 'bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>Belum Eksekusi</span>
              </button>

              <button
                type="button"
                onClick={() => setKeteranganEksekusi('Sudah Eksekusi')}
                className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all cursor-pointer btn-tactile flex items-center justify-center gap-2 ${
                  keteranganEksekusi === 'Sudah Eksekusi'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/20 font-black'
                    : 'bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Sudah Eksekusi</span>
              </button>
            </div>
          </div>

          {/* Catatan Lapangan Opsional */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan kondisi jaringan, jarak dahan ke konduktor, izin pemilik pohon, dll..."
              className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none transition-all"
            />
          </div>

          {/* Sticky Bottom Cancel | Save Action Bar matching Screenshot */}
          <div className="fixed bottom-14 md:bottom-0 inset-x-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
            <div className="max-w-2xl mx-auto grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingTree(null);
                }}
                className="py-3.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="py-3.5 text-sm font-black text-sky-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Save'}
              </button>
            </div>
          </div>
        </form>

        {/* Interactive Map Coordinate Picker Modal */}
        {showCoordPickerModal && (
          <CoordinatePickerModal
            initialLat={currentParsedCoords.lat}
            initialLng={currentParsedCoords.lng}
            poles={poles}
            onClose={() => setShowCoordPickerModal(false)}
            onConfirm={(lat, lng) => {
              setCoordText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              setShowCoordPickerModal(false);
              setGpsFeedback('Koordinat dipilih dari peta');
            }}
          />
        )}

        {/* Photo Lightbox */}
        {lightboxPhoto && (
          <div
            className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setLightboxPhoto(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-modal-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-black text-white">{lightboxPhoto.title}</h4>
                  {lightboxPhoto.subtitle && (
                    <p className="text-[11px] text-slate-400">{lightboxPhoto.subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-slate-950/70">
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.title}
                  className="max-h-[68vh] w-auto rounded-xl object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // LIST / DASHBOARD VIEW
  // =========================================================================
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 text-slate-900 dark:text-slate-100">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <TreePine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Form Peta Pohon (Inspeksi ROW)
              </h1>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Petugas ROW
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pencatatan inspeksi pohon sebelum &amp; sesudah pekerjaan rabas pohon — otomatis tertampil sebagai ikon pohon di Peta GIS.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openNewForm}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/25 cursor-pointer btn-tactile shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Input Form Peta Pohon</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
              Total Titik Pohon
            </span>
            <TreePine className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalCount}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
            Tampil di Peta GIS
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-3.5 sm:p-4 shadow-xs card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-amber-700 dark:text-amber-300">
              Belum Eksekusi
            </span>
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {belumCount}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-300/80 font-semibold mt-0.5">
            Menunggu rabas pohon
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 shadow-xs card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Sudah Eksekusi
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {sudahCount}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-300/80 font-semibold mt-0.5">
            Selesai &amp; ber-eviden
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari jenis pohon, section, penyulang, atau tim..."
            className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="Belum Eksekusi">Belum Eksekusi</option>
            <option value="Sudah Eksekusi">Sudah Eksekusi</option>
          </select>

          <select
            value={feederFilter}
            onChange={(e) => setFeederFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-[180px]"
          >
            <option value="ALL">Semua Penyulang</option>
            {allFeederOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={eksekutorFilter}
            onChange={(e) => setEksekutorFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">Semua Eksekutor</option>
            <option value="Tim Putih">Tim Putih</option>
            <option value="Tim Hitam">Tim Hitam</option>
          </select>
        </div>
      </div>

      {/* Tree Inspection Cards */}
      {filteredTrees.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
            <TreePine className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {rowTrees.length === 0 ? 'Belum Ada Data Inspeksi Pohon ROW' : 'Tidak Ada Data Sesuai Filter'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {rowTrees.length === 0
              ? 'Klik tombol "Input Form Peta Pohon" untuk mencatat koordinat pohon, foto eviden sebelum & sesudah rabas, serta tim inspektor dan eksekutor.'
              : 'Ubah kata kunci pencarian atau filter status untuk melihat data pohon lainnya.'}
          </p>
          {rowTrees.length === 0 && (
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer btn-tactile"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Inspeksi Pohon Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrees.map((tree) => {
            const isDone = tree.keteranganEksekusi === 'Sudah Eksekusi';
            return (
              <div
                key={tree.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col card-interactive"
              >
                {/* Card Top Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-0.5 rounded-full border ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{tree.keteranganEksekusi}</span>
                    </span>

                    <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatReadableDateTime(tree.waktu)}</span>
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 pt-0.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      <TreePine className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {tree.pohon}
                      </h3>
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400 truncate">
                        {tree.penyulang}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Section: <span className="font-semibold text-slate-700 dark:text-slate-300">{tree.section}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metadata & Evidence Photos */}
                <div className="p-4 space-y-3 flex-1">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Inspektor</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{tree.inspektor}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200/70 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Eksekutor</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{tree.eksekutor}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">
                      {Number(tree.lat).toFixed(6)}, {Number(tree.lng).toFixed(6)}
                    </span>
                  </div>

                  {/* Side-by-side Before / After Photos */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">
                        Eviden Sebelum
                      </span>
                      {tree.evidenSebelum ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              url: tree.evidenSebelum!,
                              title: `Eviden Sebelum - ${tree.pohon}`,
                              subtitle: `${tree.penyulang} · ${tree.section}`
                            })
                          }
                          className="w-full h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer relative group block"
                        >
                          <img
                            src={tree.evidenSebelum}
                            alt="Eviden Sebelum"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </button>
                      ) : (
                        <div className="h-24 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-center text-[10px] text-slate-400 font-medium">
                          Belum ada foto
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">
                        Eviden Sesudah
                      </span>
                      {tree.evidenSesudah ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              url: tree.evidenSesudah!,
                              title: `Eviden Sesudah - ${tree.pohon}`,
                              subtitle: `${tree.penyulang} · ${tree.section}`
                            })
                          }
                          className="w-full h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer relative group block"
                        >
                          <img
                            src={tree.evidenSesudah}
                            alt="Eviden Sesudah"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </button>
                      ) : (
                        <div className="h-24 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-center text-[10px] text-slate-400 font-medium text-center px-1">
                          {isDone ? 'Tidak ada foto' : 'Menunggu eksekusi'}
                        </div>
                      )}
                    </div>
                  </div>

                  {tree.catatan && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                      "{tree.catatan}"
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  {confirmDeleteId === tree.id ? (
                    <div className="flex items-center justify-between gap-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-500/40 p-2 rounded-xl text-xs">
                      <span className="font-bold text-rose-700 dark:text-rose-200">Hapus data ini?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteTree(tree.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                        >
                          Ya, Hapus
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onFocusTreeOnMap(tree)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer btn-tactile shadow-xs"
                        title="Lihat ikon pohon ini pada Peta GIS"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat di Peta</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditForm(tree)}
                        className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer btn-tactile shadow-xs"
                        title="Edit atau lengkapi Eviden Sesudah"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(tree.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/25 cursor-pointer transition-colors"
                        title="Hapus data inspeksi pohon"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl animate-modal-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-black text-white">{lightboxPhoto.title}</h4>
                {lightboxPhoto.subtitle && (
                  <p className="text-[11px] text-slate-400">{lightboxPhoto.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[75vh] overflow-auto bg-slate-950/70">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[68vh] w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
