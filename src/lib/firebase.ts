import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PoleData, CableSpan, MaintenanceWorkOrder, UserAccount } from '../types';

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
    const dataToSave = sanitizeForFirestore({
      ...span,
      id: cleanId,
      lengthMeters: Number(span.lengthMeters || 0),
      clearanceMeters: Number(span.clearanceMeters || 0),
      updatedAt: new Date().toISOString()
    });
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
