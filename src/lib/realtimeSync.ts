import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CableSpan, PoleData, MaintenanceWorkOrder } from '../types';

export interface SyncEvent {
  id: string;
  action: 'tarik_kabel' | 'update_kabel' | 'hapus_kabel' | 'update_tiang' | 'tambah_spk' | 'bulk_sync';
  source: 'vercel' | 'google-ai-studio';
  timestamp: number;
  summary: string;
  itemKey?: string;
}

export function getCurrentClientSource(): 'vercel' | 'google-ai-studio' {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('vercel.app')) {
      return 'vercel';
    }
  }
  return 'google-ai-studio';
}

export function getClientLabel(source?: 'vercel' | 'google-ai-studio'): string {
  const s = source || getCurrentClientSource();
  return s === 'vercel' ? 'Dashboard Vercel' : 'Dashboard Google AI Studio';
}

/**
 * Real-time listener for Cable Spans (Tarik Kabel & Kondisi Kabel)
 */
export function listenToCableSpans(
  onSpansChange: (spansMap: Record<string, CableSpan>) => void,
  onError?: (err: any) => void
) {
  const spansCol = collection(db, 'spans');
  return onSnapshot(
    spansCol,
    (snapshot) => {
      const spansMap: Record<string, CableSpan> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CableSpan;
        if (data && data.id) {
          spansMap[data.id] = data;
        }
      });
      onSpansChange(spansMap);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'spans');
      if (onError) onError(error);
    }
  );
}

/**
 * Real-time listener for Pole Updates (Kondisi Tiang, Jarak Aman Clearance, Inspeksi)
 */
export function listenToPoleUpdates(
  onPoleUpdatesChange: (updatesMap: Record<string, Partial<PoleData>>) => void,
  onError?: (err: any) => void
) {
  const polesCol = collection(db, 'pole_updates');
  return onSnapshot(
    polesCol,
    (snapshot) => {
      const updatesMap: Record<string, Partial<PoleData>> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Partial<PoleData> & { id: string };
        if (data && data.id) {
          updatesMap[data.id] = data;
        }
      });
      onPoleUpdatesChange(updatesMap);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pole_updates');
      if (onError) onError(error);
    }
  );
}

/**
 * Real-time listener for SPK (Surat Perintah Kerja)
 */
export function listenToSpks(
  onSpksChange: (spks: MaintenanceWorkOrder[]) => void,
  onError?: (err: any) => void
) {
  const spksCol = collection(db, 'spks');
  return onSnapshot(
    spksCol,
    (snapshot) => {
      const list: MaintenanceWorkOrder[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as MaintenanceWorkOrder;
        if (data && data.id) {
          list.push(data);
        }
      });
      onSpksChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'spks');
      if (onError) onError(error);
    }
  );
}

/**
 * Real-time listener for Bidirectional Sync Broadcast Events
 */
export function listenToSyncEvents(
  onEventReceived: (event: SyncEvent) => void
) {
  const eventsCol = collection(db, 'sync_events');
  const q = query(eventsCol, orderBy('timestamp', 'desc'), limit(10));

  let initialLoad = true;
  return onSnapshot(
    q,
    (snapshot) => {
      // Avoid firing toast notifications on initial load for existing past events
      if (initialLoad) {
        initialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const ev = change.doc.data() as SyncEvent;
          if (ev) {
            onEventReceived(ev);
          }
        }
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sync_events');
    }
  );
}

/**
 * Broadcast an event across both dashboards (Vercel & Google AI Studio)
 */
export async function broadcastSyncEvent(
  action: SyncEvent['action'],
  summary: string,
  itemKey?: string
) {
  try {
    const currentSource = getCurrentClientSource();
    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const eventDoc = doc(db, 'sync_events', eventId);
    await setDoc(eventDoc, {
      id: eventId,
      action,
      source: currentSource,
      timestamp: Date.now(),
      summary: summary.slice(0, 250),
      ...(itemKey ? { itemKey } : {})
    });
  } catch (err) {
    console.error('Failed to broadcast sync event:', err);
  }
}

/**
 * Save or update cable span to Firestore (Interaksi Tarik Kabel / Perubahan Kondisi Kabel)
 */
export async function pushCableSpanToCloud(span: CableSpan, isNew: boolean = false) {
  try {
    const spanRef = doc(db, 'spans', span.id);
    const payload: any = {
      id: span.id,
      fromPoleId: span.fromPoleId,
      toPoleId: span.toPoleId,
      conductorType: span.conductorType || 'AACS 150 mm²',
      lengthMeters: Number(span.lengthMeters) || 0,
      clearanceMeters: Number(span.clearanceMeters) || 4.5,
      hasViolation: Boolean(span.hasViolation),
      violationType: span.violationType || 'Aman (≥3.0m)',
      feeder: span.feeder || 'Penyulang Baguala',
      cableCondition: span.cableCondition || 'Baik',
      treeDistanceMeters: Number(span.treeDistanceMeters ?? 4.5),
      buildingDistanceMeters: Number(span.buildingDistanceMeters ?? 5.0),
      notes: span.notes || '',
      updatedAt: new Date().toISOString(),
      source: getCurrentClientSource()
    };

    if (span.photoUrl) payload.photoUrl = span.photoUrl;

    await setDoc(spanRef, payload, { merge: true });

    const sourceLabel = getClientLabel();
    const actionDesc = isNew
      ? `Penarikan kabel baru (${span.fromPoleId} ⇄ ${span.toPoleId})`
      : `Update kondisi kabel (${span.conductorType || span.id} - ${span.cableCondition || 'Diperbarui'})`;

    await broadcastSyncEvent(
      isNew ? 'tarik_kabel' : 'update_kabel',
      `[${sourceLabel}] ${actionDesc}`,
      span.id
    );

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `spans/${span.id}`);
    return false;
  }
}

/**
 * Delete a cable span from Firestore
 */
export async function removeCableSpanFromCloud(spanId: string) {
  try {
    const spanRef = doc(db, 'spans', spanId);
    await deleteDoc(spanRef);

    const sourceLabel = getClientLabel();
    await broadcastSyncEvent(
      'hapus_kabel',
      `[${sourceLabel}] Bentangan kabel ${spanId} telah dihapus`,
      spanId
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `spans/${spanId}`);
    return false;
  }
}

/**
 * Update pole condition in Firestore (Kondisi Tiang, Clearance, Inspeksi)
 */
export async function pushPoleUpdateToCloud(
  poleId: string,
  updatedFields: Partial<PoleData>
) {
  try {
    const poleRef = doc(db, 'pole_updates', poleId);
    const payload: any = {
      id: poleId,
      updatedAt: new Date().toISOString(),
      source: getCurrentClientSource()
    };

    if (updatedFields.code !== undefined) payload.code = updatedFields.code;
    if (updatedFields.physicalCondition !== undefined) payload.physicalCondition = updatedFields.physicalCondition;
    if (updatedFields.clearanceDistanceMeters !== undefined) payload.clearanceDistanceMeters = Number(updatedFields.clearanceDistanceMeters);
    if (updatedFields.clearanceStatus !== undefined) payload.clearanceStatus = updatedFields.clearanceStatus;
    if (updatedFields.clearanceObject !== undefined) payload.clearanceObject = updatedFields.clearanceObject;
    if (updatedFields.lastInspectionDate !== undefined) payload.lastInspectionDate = updatedFields.lastInspectionDate;
    if (updatedFields.spkStatus !== undefined) payload.spkStatus = updatedFields.spkStatus;
    if (updatedFields.notes !== undefined) payload.notes = updatedFields.notes;
    if (updatedFields.photoUrl !== undefined) payload.photoUrl = updatedFields.photoUrl;

    await setDoc(poleRef, payload, { merge: true });

    const sourceLabel = getClientLabel();
    const condLabel = updatedFields.physicalCondition ? `Kondisi: ${updatedFields.physicalCondition}` : `Clearance: ${updatedFields.clearanceDistanceMeters}m`;

    await broadcastSyncEvent(
      'update_tiang',
      `[${sourceLabel}] Pembaruan tiang ${poleId} (${condLabel})`,
      poleId
    );

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `pole_updates/${poleId}`);
    return false;
  }
}

/**
 * Push SPK (Surat Perintah Kerja) to Firestore
 */
export async function pushSpkToCloud(spk: MaintenanceWorkOrder) {
  try {
    const spkRef = doc(db, 'spks', spk.id);
    await setDoc(spkRef, {
      ...spk,
      updatedAt: new Date().toISOString(),
      source: getCurrentClientSource()
    }, { merge: true });

    const sourceLabel = getClientLabel();
    await broadcastSyncEvent(
      'tambah_spk',
      `[${sourceLabel}] SPK baru diterbitkan: ${spk.spkNumber} untuk ${spk.poleId}`,
      spk.id
    );

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `spks/${spk.id}`);
    return false;
  }
}
