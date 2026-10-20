import { PoleData, CableSpan, MaintenanceWorkOrder, UserAccount } from '../types';
import {
  savePoleToCloud,
  deletePoleFromCloud,
  saveSpanToCloud,
  deleteSpanFromCloud,
  saveSpkToCloud,
  saveUserToCloud,
  deleteUserFromCloud,
  saveAppStateToCloud,
  subscribeToPoles,
  subscribeToSpans,
  subscribeToSpks,
  subscribeToUsers,
  subscribeToAppState,
  AppSyncState
} from './firebase';
import { INITIAL_USERS } from '../data/initialUsers';

export {
  savePoleToCloud,
  deletePoleFromCloud,
  saveSpanToCloud,
  deleteSpanFromCloud,
  saveSpkToCloud,
  saveUserToCloud,
  deleteUserFromCloud,
  saveAppStateToCloud,
  subscribeToPoles,
  subscribeToSpans,
  subscribeToSpks,
  subscribeToUsers,
  subscribeToAppState
};

/**
 * Merge base poles with live cloud updates and deletions.
 */
export function mergePolesWithCloud(
  basePoles: PoleData[],
  cloudPoles: PoleData[],
  deletedPoleIds: Set<string>
): PoleData[] {
  const poleMap = new Map<string, PoleData>();

  // Add base poles
  for (const pole of basePoles) {
    const idKey = pole.id.toLowerCase();
    if (!deletedPoleIds.has(idKey) && !deletedPoleIds.has(pole.id)) {
      poleMap.set(idKey, pole);
    }
  }

  // Override or add cloud poles
  for (const pole of cloudPoles) {
    const idKey = pole.id.toLowerCase();
    if (!deletedPoleIds.has(idKey) && !deletedPoleIds.has(pole.id)) {
      poleMap.set(idKey, { ...poleMap.get(idKey), ...pole });
    }
  }

  return Array.from(poleMap.values());
}

/**
 * Merge base spans with live cloud updates and deletions.
 */
export function mergeSpansWithCloud(
  baseSpans: CableSpan[],
  cloudSpans: CableSpan[],
  deletedSpanIds: Set<string>
): CableSpan[] {
  const spanMap = new Map<string, CableSpan>();

  const getSpanKey = (s: CableSpan) => {
    const from = (s.fromPoleId || '').trim().toLowerCase();
    const to = (s.toPoleId || '').trim().toLowerCase();
    if (from < to) return `${from}<->${to}`;
    return `${to}<->${from}`;
  };

  // Add base spans
  for (const span of baseSpans) {
    const sId = (span.id || '').trim().toLowerCase();
    const pairKey = getSpanKey(span);
    if (!deletedSpanIds.has(sId) && !deletedSpanIds.has(span.id) && !deletedSpanIds.has(pairKey)) {
      spanMap.set(pairKey, span);
    }
  }

  // Override or add cloud spans
  for (const span of cloudSpans) {
    const sId = (span.id || '').trim().toLowerCase();
    const pairKey = getSpanKey(span);
    if (!deletedSpanIds.has(sId) && !deletedSpanIds.has(span.id) && !deletedSpanIds.has(pairKey)) {
      spanMap.set(pairKey, { ...spanMap.get(pairKey), ...span });
    }
  }

  return Array.from(spanMap.values());
}
