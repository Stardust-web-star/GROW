import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDocs,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PoleData, CableSpan, MaintenanceWorkOrder, UserAccount, RowTreeInspection } from '../types';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test Connection on application boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Connected to Firestore database:', firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline. Please check your network and Firebase configuration.');
    } else {
      console.log('[Firebase] Connection validated.');
    }
  }
}
testConnection();

// Global App Sync State interface
export interface AppSyncState {
  id: string;
  masterName?: string;
  lastUpdated: string;
  lastAction?: string;
  lastSource?: string;
  totalPolesCount?: number;
  totalSpansCount?: number;
  deletedPoleIds?: string[];
  deletedSpanIds?: string[];
  feederColors?: string;
  baselineAllGreenV1?: boolean;
}

export type SystemMetaState = AppSyncState;

export function getCurrentEnvironmentTag(): string {
  if (typeof window === 'undefined') return 'Node Server';
  const host = window.location.hostname;
  if (host.includes('vercel.app')) return 'Dashboard Vercel';
  if (host.includes('run.app') || host.includes('aistudio')) return 'Dashboard Google AI Studio';
  if (host.includes('localhost') || host === '127.0.0.1') return 'Localhost / Dev Server';
  return `Host: ${host}`;
}

export async function touchSystemMeta(meta: Partial<SystemMetaState>) {
  return saveAppStateToCloud(meta);
}

// Real-time synchronization listeners
export function subscribeToPoles(onUpdate: (poles: PoleData[]) => void, onError?: (err: any) => void) {
  const path = 'poles';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const poles: PoleData[] = [];
      snapshot.forEach((d) => {
        poles.push(d.data() as PoleData);
      });
      onUpdate(poles);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToSpans(onUpdate: (spans: CableSpan[]) => void, onError?: (err: any) => void) {
  const path = 'spans';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const spans: CableSpan[] = [];
      snapshot.forEach((d) => {
        spans.push(d.data() as CableSpan);
      });
      onUpdate(spans);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToSpks(onUpdate: (spks: MaintenanceWorkOrder[]) => void, onError?: (err: any) => void) {
  const path = 'spks';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const spks: MaintenanceWorkOrder[] = [];
      snapshot.forEach((d) => {
        spks.push(d.data() as MaintenanceWorkOrder);
      });
      onUpdate(spks);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToUsers(onUpdate: (users: UserAccount[]) => void, onError?: (err: any) => void) {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const users: UserAccount[] = [];
      snapshot.forEach((d) => {
        users.push(d.data() as UserAccount);
      });
      onUpdate(users);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToRowTrees(onUpdate: (trees: RowTreeInspection[]) => void, onError?: (err: any) => void) {
  const path = 'row_trees';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const trees: RowTreeInspection[] = [];
      snapshot.forEach((d) => {
        trees.push(d.data() as RowTreeInspection);
      });
      // Sort newest first by updatedAt or waktu
      trees.sort((a, b) => (b.updatedAt || b.waktu || '').localeCompare(a.updatedAt || a.waktu || ''));
      onUpdate(trees);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToAppState(onUpdate: (state: AppSyncState | null) => void, onError?: (err: any) => void) {
  const path = 'app_state/global';
  return onSnapshot(
    doc(db, 'app_state', 'global'),
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as AppSyncState);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Recursively remove undefined values from objects/arrays so Firestore doesn't reject them.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Direct cloud mutation methods
export async function savePoleToCloud(pole: PoleData) {
  const cleanId = (pole.id || `POLE-${Date.now()}`).trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `poles/${cleanId}`;
  try {
    const dataToSave = sanitizeForFirestore({
      ...pole,
      id: cleanId,
      lat: Number(pole.lat),
      lng: Number(pole.lng),
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'poles', cleanId), dataToSave, { merge: true });
    console.log(`[Firestore Sync] ✅ Pole ${cleanId} saved to cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePoleFromCloud(poleId: string) {
  const cleanId = poleId.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `poles/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'poles', cleanId));
    console.log(`[Firestore Sync] 🗑️ Pole ${cleanId} deleted from cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSpanToCloud(span: CableSpan) {
  const cleanId = (span.id || `SPAN-${Date.now()}`).trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `spans/${cleanId}`;
  try {
    const dataToSave: Record<string, any> = sanitizeForFirestore({
      ...span,
      id: cleanId,
      lengthMeters: Number(span.lengthMeters || 0),
      clearanceMeters: Number(span.clearanceMeters || 0),
      updatedAt: new Date().toISOString()
    });
    if (!span.violationType) {
      dataToSave.violationType = deleteField();
    }
    await setDoc(doc(db, 'spans', cleanId), dataToSave, { merge: true });
    console.log(`[Firestore Sync] ✅ Cable Span ${cleanId} saved to cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSpanFromCloud(spanId: string) {
  const cleanId = spanId.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `spans/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'spans', cleanId));
    console.log(`[Firestore Sync] 🗑️ Cable Span ${cleanId} deleted from cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSpkToCloud(spk: MaintenanceWorkOrder) {
  const cleanId = spk.id.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `spks/${cleanId}`;
  try {
    const dataToSave = sanitizeForFirestore({
      ...spk,
      id: cleanId,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'spks', cleanId), dataToSave, { merge: true });
    console.log(`[Firestore Sync] ✅ SPK ${cleanId} saved to cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSpkFromCloud(spkId: string) {
  const cleanId = spkId.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `spks/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'spks', cleanId));
    console.log(`[Firestore Sync] 🗑️ SPK ${cleanId} deleted from cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveUserToCloud(user: UserAccount) {
  const cleanId = user.id.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `users/${cleanId}`;
  try {
    const dataToSave = sanitizeForFirestore(user);
    await setDoc(doc(db, 'users', cleanId), dataToSave, { merge: true });
    console.log(`[Firestore Sync] ✅ User ${cleanId} saved to cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserFromCloud(userId: string) {
  const cleanId = userId.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `users/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'users', cleanId));
    console.log(`[Firestore Sync] 🗑️ User ${cleanId} deleted from cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveRowTreeToCloud(tree: RowTreeInspection) {
  const cleanId = (tree.id || `TREE-${Date.now()}`).trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `row_trees/${cleanId}`;
  try {
    const nowIso = new Date().toISOString();
    const beforeList = (
      Array.isArray(tree.evidenSebelumList) && tree.evidenSebelumList.length > 0
        ? tree.evidenSebelumList
        : tree.evidenSebelum
          ? [tree.evidenSebelum]
          : []
    )
      .filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 160000)
      .slice(0, 5);

    const afterList = (
      Array.isArray(tree.evidenSesudahList) && tree.evidenSesudahList.length > 0
        ? tree.evidenSesudahList
        : tree.evidenSesudah
          ? [tree.evidenSesudah]
          : []
    )
      .filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 160000)
      .slice(0, 5);

    const { evidenSebelum: _legacyBefore, evidenSesudah: _legacyAfter, ...restTree } = tree;
    const dataToSave: Record<string, any> = sanitizeForFirestore({
      ...restTree,
      id: cleanId,
      waktu: String(tree.waktu || nowIso).slice(0, 64),
      penyulang: String(tree.penyulang || '-').slice(0, 128),
      section: String(tree.section || '-').slice(0, 256),
      pohon: String(tree.pohon || '-').slice(0, 128),
      lat: Number(tree.lat),
      lng: Number(tree.lng),
      evidenSebelumList: beforeList,
      evidenSesudahList: afterList,
      inspektor: String(tree.inspektor || 'Inspektor 1').slice(0, 64),
      eksekutor: String(tree.eksekutor || 'Tim Putih').slice(0, 64),
      keteranganEksekusi: tree.keteranganEksekusi === 'Sudah Eksekusi' ? 'Sudah Eksekusi' : 'Belum Eksekusi',
      createdAt: tree.createdAt || nowIso,
      updatedAt: nowIso
    });
    // Remove legacy single-string duplicates so 5+5 photos fit comfortably under Firestore's 1MB doc ceiling
    dataToSave.evidenSebelum = deleteField();
    dataToSave.evidenSesudah = deleteField();
    await setDoc(doc(db, 'row_trees', cleanId), dataToSave, { merge: true });
    console.log(`[Firestore Sync] 🌳 RowTree ${cleanId} saved to cloud (${beforeList.length} before, ${afterList.length} after).`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRowTreeFromCloud(treeId: string) {
  const cleanId = treeId.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const path = `row_trees/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'row_trees', cleanId));
    console.log(`[Firestore Sync] 🗑️ RowTree ${cleanId} deleted from cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAppStateToCloud(state: Partial<AppSyncState>) {
  const path = 'app_state/global';
  try {
    const dataToSave = sanitizeForFirestore({
      id: 'global',
      ...state,
      lastUpdated: new Date().toISOString()
    });
    await setDoc(doc(db, 'app_state', 'global'), dataToSave, { merge: true });
    console.log(`[Firestore Sync] 🔄 App state ledger updated in cloud.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * One-time baseline normalization so any stale pre-launch test statuses stored
 * in Cloud Firestore start cleanly in Baik / Aman (Hijau) condition until
 * field officers record real inspection changes.
 */
export async function ensureAllGreenBaselineInCloud(force: boolean = false): Promise<boolean> {
  const stateRef = doc(db, 'app_state', 'global');
  if (!force) {
    try {
      const stateSnap = await getDocFromServer(stateRef);
      if (stateSnap.exists() && stateSnap.data()?.baselineAllGreenV1 === true) {
        return false;
      }
    } catch {
      // Proceed to check/normalize or retry cleanly if offline
    }
  }

  const nowIso = new Date().toISOString();
  const [polesSnap, spansSnap, spksSnap] = await Promise.all([
    getDocs(collection(db, 'poles')),
    getDocs(collection(db, 'spans')),
    getDocs(collection(db, 'spks'))
  ]);

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  polesSnap.forEach((poleDoc) => {
    const data = poleDoc.data() as Partial<PoleData>;
    const clearanceStatus =
      data.type === 'TR'
        ? 'Aman JTR (≥1.0m)'
        : data.type === 'TT'
          ? 'Aman SUTT (≥5.0m)'
          : 'Aman JTM (≥3.0m)';

    ops.push((batch) => {
      batch.set(
        poleDoc.ref,
        {
          id: data.id || poleDoc.id,
          code: data.code || poleDoc.id,
          feeder: data.feeder || 'Penyulang Passo',
          lat: Number(data.lat ?? -3.6285),
          lng: Number(data.lng ?? 128.2321),
          physicalCondition: 'Baik',
          clearanceDistanceMeters: 5,
          clearanceStatus,
          clearanceObject: 'Bebas',
          spkStatus: 'Belum SPK',
          updatedAt: nowIso
        },
        { merge: true }
      );
    });
  });

  spansSnap.forEach((spanDoc) => {
    const data = spanDoc.data() as Partial<CableSpan>;
    ops.push((batch) => {
      batch.set(
        spanDoc.ref,
        {
          id: data.id || spanDoc.id,
          fromPoleId: data.fromPoleId || '',
          toPoleId: data.toPoleId || '',
          cableCondition: 'Baik',
          clearanceMeters: 5,
          treeDistanceMeters: 5,
          buildingDistanceMeters: 5,
          hasViolation: false,
          violationType: deleteField(),
          updatedAt: nowIso
        },
        { merge: true }
      );
    });
  });

  spksSnap.forEach((spkDoc) => {
    ops.push((batch) => {
      batch.delete(spkDoc.ref);
    });
  });

  const BATCH_LIMIT = 400;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    for (const applyOp of chunk) {
      applyOp(batch);
    }
    await batch.commit();
  }

  await setDoc(
    stateRef,
    {
      id: 'global',
      baselineAllGreenV1: true,
      lastUpdated: nowIso,
      lastAction: 'baseline_all_green_v1'
    },
    { merge: true }
  );

  console.log(
    `[Firestore Sync] ✅ Baseline all-green diterapkan (${polesSnap.size} tiang, ${spansSnap.size} kabel, ${spksSnap.size} spk).`
  );
  return true;
}
