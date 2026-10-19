import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  serverTimestamp,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import { PoleData, CableSpan, MaintenanceWorkOrder } from '../types';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Connect to the specific database instance provisioned for GROW ULP Baguala
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export interface SyncStateDoc {
  version: number;
  updatedAt: string;
  origin: 'Google AI Studio' | 'Vercel' | 'Local Dev';
  action: string;
  details?: string;
  sourceTimestamp?: number;
}

export interface StoredPoleRecord extends Partial<PoleData> {
  id: string;
  _isDeleted?: boolean;
  _updatedAt?: string;
  _origin?: string;
}

export interface StoredSpanRecord extends Partial<CableSpan> {
  id: string;
  _isDeleted?: boolean;
  _updatedAt?: string;
  _origin?: string;
}

/**
 * Determine current platform origin (Vercel vs Google AI Studio)
 */
export function getCurrentPlatformOrigin(): 'Google AI Studio' | 'Vercel' | 'Local Dev' {
  if (typeof window === 'undefined') return 'Local Dev';
  const hostname = window.location.hostname;
  if (hostname.includes('vercel.app')) {
    return 'Vercel';
  }
  if (hostname.includes('run.app') || hostname.includes('google.com')) {
    return 'Google AI Studio';
  }
  return 'Local Dev';
}

/**
 * Touch the global sync heartbeat in Firestore to notify all connected dashboards
 */
export async function touchGlobalSyncState(action: string, details?: string) {
  try {
    const origin = getCurrentPlatformOrigin();
    const syncDocRef = doc(db, 'sync', 'state');
    const payload: SyncStateDoc = {
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      origin,
      action,
      details,
      sourceTimestamp: Date.now()
    };
    await setDoc(syncDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('[FirebaseSync] Could not touch global sync state:', err);
  }
}

/**
 * Real-time listener for global sync state changes (AI Studio <-> Vercel)
 */
export function subscribeToSyncHeartbeat(
  onUpdate: (syncState: SyncStateDoc) => void
): Unsubscribe {
  const syncDocRef = doc(db, 'sync', 'state');
  return onSnapshot(
    syncDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SyncStateDoc;
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('[FirebaseSync] Sync heartbeat listener error:', err);
    }
  );
}

/**
 * Real-time listener for Cable Spans (Tarik Kabel, Edit Kondisi Bentangan, Hapus Kabel)
 */
export function subscribeToRealtimeSpans(
  onSpansChange: (spansMap: Map<string, StoredSpanRecord>) => void
): Unsubscribe {
  const spansColRef = collection(db, 'spans_custom');
  return onSnapshot(
    spansColRef,
    (snapshot) => {
      const map = new Map<string, StoredSpanRecord>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoredSpanRecord;
        if (data && data.id) {
          map.set(data.id, data);
        }
      });
      onSpansChange(map);
    },
    (err) => {
      console.warn('[FirebaseSync] Spans listener error:', err);
    }
  );
}

/**
 * Real-time listener for Poles (Perubahan Kondisi Fisik, Jarak ROW, Inspeksi, Tambah/Hapus Tiang)
 */
export function subscribeToRealtimePoles(
  onPolesChange: (polesMap: Map<string, StoredPoleRecord>) => void
): Unsubscribe {
  const polesColRef = collection(db, 'poles_custom');
  return onSnapshot(
    polesColRef,
    (snapshot) => {
      const map = new Map<string, StoredPoleRecord>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StoredPoleRecord;
        if (data && data.id) {
          map.set(data.id, data);
        }
      });
      onPolesChange(map);
    },
    (err) => {
      console.warn('[FirebaseSync] Poles listener error:', err);
    }
  );
}

/**
 * Real-time listener for Maintenance Work Orders (SPK)
 */
export function subscribeToRealtimeSpks(
  onSpksChange: (spks: MaintenanceWorkOrder[]) => void
): Unsubscribe {
  const spksColRef = collection(db, 'spks');
  return onSnapshot(
    spksColRef,
    (snapshot) => {
      const spkList: MaintenanceWorkOrder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MaintenanceWorkOrder;
        if (data && data.id) {
          spkList.push(data);
        }
      });
      onSpksChange(spkList);
    },
    (err) => {
      console.warn('[FirebaseSync] SPK listener error:', err);
    }
  );
}

/**
 * Save or update a cable span to Firestore (two-way sync)
 */
export async function syncSaveCableSpan(span: CableSpan): Promise<void> {
  const origin = getCurrentPlatformOrigin();
  const safeId = encodeDocId(span.id);
  const docRef = doc(db, 'spans_custom', safeId);
  const payload: StoredSpanRecord = {
    ...span,
    _isDeleted: false,
    _updatedAt: new Date().toISOString(),
    _origin: origin
  };
  await setDoc(docRef, payload, { merge: true });
  await touchGlobalSyncState(
    'tarik_kabel',
    `Kabel ${span.fromPoleId} -> ${span.toPoleId} (${span.cableCondition || 'Baik'})`
  );
}

/**
 * Mark a cable span as deleted in Firestore (two-way sync)
 */
export async function syncDeleteCableSpan(spanId: string, fromPoleId?: string, toPoleId?: string): Promise<void> {
  const origin = getCurrentPlatformOrigin();
  const safeId = encodeDocId(spanId);
  const docRef = doc(db, 'spans_custom', safeId);
  const payload: StoredSpanRecord = {
    id: spanId,
    fromPoleId,
    toPoleId,
    _isDeleted: true,
    _updatedAt: new Date().toISOString(),
    _origin: origin
  };
  await setDoc(docRef, payload, { merge: true });
  await touchGlobalSyncState(
    'hapus_kabel',
    `Bentangan ${spanId} dihapus`
  );
}

/**
 * Save or update a pole to Firestore (two-way sync)
 */
export async function syncSavePole(pole: PoleData): Promise<void> {
  const origin = getCurrentPlatformOrigin();
  const safeId = encodeDocId(pole.id);
  const docRef = doc(db, 'poles_custom', safeId);
  const payload: StoredPoleRecord = {
    ...pole,
    _isDeleted: false,
    _updatedAt: new Date().toISOString(),
    _origin: origin
  };
  await setDoc(docRef, payload, { merge: true });
  await touchGlobalSyncState(
    'perubahan_tiang',
    `Tiang ${pole.code || pole.id}: Kondisi ${pole.physicalCondition}, ROW ${pole.clearanceDistanceMeters}m`
  );
}

/**
 * Mark a pole as deleted in Firestore (two-way sync)
 */
export async function syncDeletePole(poleId: string): Promise<void> {
  const origin = getCurrentPlatformOrigin();
  const safeId = encodeDocId(poleId);
  const docRef = doc(db, 'poles_custom', safeId);
  const payload: StoredPoleRecord = {
    id: poleId,
    _isDeleted: true,
    _updatedAt: new Date().toISOString(),
    _origin: origin
  };
  await setDoc(docRef, payload, { merge: true });
  await touchGlobalSyncState(
    'hapus_tiang',
    `Tiang ${poleId} dihapus`
  );
}

/**
 * Save or update an SPK to Firestore (two-way sync)
 */
export async function syncSaveSpk(spk: MaintenanceWorkOrder): Promise<void> {
  const safeId = encodeDocId(spk.id);
  const docRef = doc(db, 'spks', safeId);
  await setDoc(docRef, spk, { merge: true });
  await touchGlobalSyncState(
    'spk_baru',
    `SPK ${spk.spkNumber} untuk tiang ${spk.poleId}`
  );
}

/**
 * Helper to safely encode IDs for Firestore document keys
 */
export function encodeDocId(rawId: string): string {
  if (!rawId) return `id_${Date.now()}`;
  return rawId.replace(/[\/\\]/g, '_');
}
