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

export function getSpanPairKey(fromId: string, toId: string): string {
  const from = (fromId || '').trim().toLowerCase();
  const to = (toId || '').trim().toLowerCase();
  if (from < to) return `${from}<->${to}`;
  return `${to}<->${from}`;
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

  const isSpanDeleted = (span: CableSpan): boolean => {
    const sId = (span.id || '').trim().toLowerCase();
    if (deletedSpanIds.has(sId) || (span.id && deletedSpanIds.has(span.id))) {
      return true;
    }
    const from = (span.fromPoleId || '').trim().toLowerCase();
    const to = (span.toPoleId || '').trim().toLowerCase();
    if (from && to) {
      const pairKey = from < to ? `${from}<->${to}` : `${to}<->${from}`;
      if (deletedSpanIds.has(pairKey)) {
        return true;
      }
    }
    return false;
  };

  const getSpanKey = (s: CableSpan) => {
    return getSpanPairKey(s.fromPoleId || '', s.toPoleId || '');
  };

  // Add base spans (filter out explicitly deleted spans or deleted pairs)
  for (const span of baseSpans) {
    if (!isSpanDeleted(span)) {
      const pairKey = getSpanKey(span);
      spanMap.set(pairKey, span);
    }
  }

  // Override or add active cloud spans (filter out deleted spans/pairs)
  for (const span of cloudSpans) {
    if (!isSpanDeleted(span)) {
      const pairKey = getSpanKey(span);
      spanMap.set(pairKey, { ...spanMap.get(pairKey), ...span });
    }
  }

  return Array.from(spanMap.values());
}

