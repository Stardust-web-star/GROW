import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch,
  query,
  limit
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfigRaw from '../../firebase-applet-config.json';
import { PoleData, CableSpan, MaintenanceWorkOrder, UserAccount } from '../types';

// Support both config file and VITE_ env overrides for Vercel deployments
export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigRaw.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigRaw.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigRaw.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigRaw.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigRaw.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigRaw.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigRaw.messagingSenderId,
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore with dedicated Database ID (CRITICAL: Required for AI Studio Firestore)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling helper required by Firebase Integration
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test at boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_meta', 'connection_test'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: Client is offline or initializing.');
    }
    return false;
  }
}

// Detect current environment client origin
export function getCurrentEnvironmentTag(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('vercel.app')) {
      return 'Vercel Deployment';
    }
    if (host.includes('run.app') || host.includes('aistudio')) {
      return 'Google AI Studio';
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'Localhost / Dev';
    }
    return host;
  }
  return 'Cloud Environment';
}

// -------------------------------------------------------------
// Two-Way Realtime Sync Helpers for Poles, Spans, SPK, System
// -------------------------------------------------------------

export interface SystemMetaState {
  masterName?: string;
  lastUpdated?: string;
  lastSource?: string;
  lastAction?: string;
  polesCount?: number;
  spansCount?: number;
  feederColors?: Record<string, string>;
}

/**
 * Real-time listener for Poles
 */
export function subscribeToPoles(
  onData: (poles: PoleData[]) => void,
  onError?: (err: Error) => void
) {
  const polesColl = collection(db, 'poles');
  return onSnapshot(
    polesColl,
    (snapshot) => {
      const polesList: PoleData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as PoleData;
        polesList.push(data);
      });
      onData(polesList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'poles');
    }
  );
}

/**
 * Real-time listener for Spans (Cable connections)
 */
export function subscribeToSpans(
  onData: (spans: CableSpan[]) => void,
  onError?: (err: Error) => void
) {
  const spansColl = collection(db, 'spans');
  return onSnapshot(
    spansColl,
    (snapshot) => {
      const spansList: CableSpan[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CableSpan;
        spansList.push(data);
      });
      onData(spansList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'spans');
    }
  );
}

/**
 * Real-time listener for SPKs (Work Orders)
 */
export function subscribeToSpks(
  onData: (spks: MaintenanceWorkOrder[]) => void,
  onError?: (err: Error) => void
) {
  const spksColl = collection(db, 'spks');
  return onSnapshot(
    spksColl,
    (snapshot) => {
      const spksList: MaintenanceWorkOrder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MaintenanceWorkOrder;
        spksList.push(data);
      });
      onData(spksList);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'spks');
    }
  );
}

/**
 * Real-time listener for System Meta (Colors, Master info, Last Action)
 */
export function subscribeToSystemMeta(
  onData: (meta: SystemMetaState) => void,
  onError?: (err: Error) => void
) {
  const metaDoc = doc(db, 'system_meta', 'sync_state');
  return onSnapshot(
    metaDoc,
    (docSnap) => {
      if (docSnap.exists()) {
        onData(docSnap.data() as SystemMetaState);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, 'system_meta/sync_state');
    }
  );
}

/**
 * Write / Update a single pole to Firestore
 */
export async function syncPoleToCloud(pole: PoleData, actionDesc = 'Perubahan Kondisi Tiang') {
  const path = `poles/${pole.id}`;
  try {
    const poleRef = doc(db, 'poles', pole.id);
    const sanitizedPole: PoleData = {
      ...pole,
      updatedAt: new Date().toISOString(),
      updatedBy: getCurrentEnvironmentTag()
    };
    await setDoc(poleRef, sanitizedPole, { merge: true });

    // Touch system meta for activity tracking
    await touchSystemMeta({
      lastAction: `${actionDesc}: ${pole.code || pole.id}`,
      lastSource: getCurrentEnvironmentTag(),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a pole from Firestore
 */
export async function deletePoleFromCloud(poleId: string) {
  const path = `poles/${poleId}`;
  try {
    const poleRef = doc(db, 'poles', poleId);
    await deleteDoc(poleRef);

    await touchSystemMeta({
      lastAction: `Hapus Tiang: ${poleId}`,
      lastSource: getCurrentEnvironmentTag(),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Write / Update a Cable Span (tarik kabel) to Firestore
 */
export async function syncSpanToCloud(span: CableSpan, actionDesc = 'Pemasangan / Tarik Kabel Baru') {
  const path = `spans/${span.id}`;
  try {
    const spanRef = doc(db, 'spans', span.id);
    const sanitizedSpan: CableSpan = {
      ...span,
      updatedAt: new Date().toISOString(),
      updatedBy: getCurrentEnvironmentTag()
    };
    await setDoc(spanRef, sanitizedSpan, { merge: true });

    await touchSystemMeta({
      lastAction: `${actionDesc}: ${span.fromPoleId} ⇄ ${span.toPoleId} (${span.feeder})`,
      lastSource: getCurrentEnvironmentTag(),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a Cable Span from Firestore
 */
export async function deleteSpanFromCloud(spanId: string) {
  const path = `spans/${spanId}`;
  try {
    const spanRef = doc(db, 'spans', spanId);
    await deleteDoc(spanRef);

    await touchSystemMeta({
      lastAction: `Hapus Bentangan Kabel: ${spanId}`,
      lastSource: getCurrentEnvironmentTag(),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Write / Update SPK to Firestore
 */
export async function syncSpkToCloud(spk: MaintenanceWorkOrder) {
  const path = `spks/${spk.id}`;
  try {
    const spkRef = doc(db, 'spks', spk.id);
    await setDoc(spkRef, spk, { merge: true });

    await touchSystemMeta({
      lastAction: `SPK Baru Dibuat: ${spk.spkNumber} (${spk.poleId})`,
      lastSource: getCurrentEnvironmentTag(),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Update system meta state
 */
export async function touchSystemMeta(patch: Partial<SystemMetaState>) {
  try {
    const metaRef = doc(db, 'system_meta', 'sync_state');
    await setDoc(metaRef, {
      ...patch,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not touch system meta:', err);
  }
}

/**
 * Check if Cloud Firestore is initialized with poles. If empty, seeds initial data.
 */
export async function seedInitialDataIfEmpty(
  initialPoles: PoleData[],
  initialSpans: CableSpan[],
  initialSpks: MaintenanceWorkOrder[]
): Promise<boolean> {
  try {
    const polesColl = collection(db, 'poles');
    const q = query(polesColl, limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty && initialPoles.length > 0) {
      console.log(`[Firestore Seed] Database kosong, memigrasikan ${initialPoles.length} tiang dan ${initialSpans.length} bentangan kabel ke Cloud Firestore...`);
      
      // Batch write poles in chunks of 450 (Firestore limit is 500 operations per batch)
      const chunkSize = 400;
      for (let i = 0; i < initialPoles.length; i += chunkSize) {
        const chunk = initialPoles.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((p) => {
          const ref = doc(db, 'poles', p.id);
          batch.set(ref, {
            ...p,
            updatedAt: new Date().toISOString(),
            updatedBy: 'System Master Initializer'
          });
        });
        await batch.commit();
      }

      // Batch write spans
      if (initialSpans.length > 0) {
        for (let i = 0; i < initialSpans.length; i += chunkSize) {
          const chunk = initialSpans.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((s) => {
            const ref = doc(db, 'spans', s.id);
            batch.set(ref, {
              ...s,
              updatedAt: new Date().toISOString(),
              updatedBy: 'System Master Initializer'
            });
          });
          await batch.commit();
        }
      }

      // Batch write SPKs
      if (initialSpks.length > 0) {
        const batch = writeBatch(db);
        initialSpks.forEach((spk) => {
          const ref = doc(db, 'spks', spk.id);
          batch.set(ref, spk);
        });
        await batch.commit();
      }

      // Write system meta
      await setDoc(doc(db, 'system_meta', 'sync_state'), {
        masterName: 'TITIK TIANG BGL.kml',
        lastUpdated: new Date().toISOString(),
        lastSource: getCurrentEnvironmentTag(),
        lastAction: 'Inisialisasi Master Data Cloud Dua Arah (TITIK TIANG BGL.kml)',
        polesCount: initialPoles.length,
        spansCount: initialSpans.length
      });

      console.log('[Firestore Seed] Berhasil memigrasi seluruh master data ke Cloud Firestore!');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Firestore Seed] Error initializing cloud data:', err);
    return false;
  }
}
