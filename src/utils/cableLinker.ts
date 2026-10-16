import { PoleData, CableSpan } from '../types';
import { calculateHaversineDistanceMeters } from './kmzParser';

/**
 * Builds adjacent cable spans strictly between nearest neighboring poles within the SAME feeder.
 * Rules:
 * 1. Only connect poles belonging to the EXACT SAME feeder.
 * 2. Connect each pole ONLY to its closest neighboring pole (Minimum Spanning Tree / Nearest Neighbor Chain).
 * 3. Never connect one pole to all other poles (no mesh/star network).
 * 4. Dynamically compute cable length and ROW clearance distance.
 */
export function buildAdjacentCableSpans(
  poles: PoleData[],
  existingSpans: CableSpan[]
): CableSpan[] {
  // Map existing explicit spans by sorted pole ID pair
  const spanMap = new Map<string, CableSpan>();
  existingSpans.forEach(s => {
    const key = [s.fromPoleId, s.toPoleId].sort().join('___');
    spanMap.set(key, s);
  });

  const finalSpans: CableSpan[] = [];

  // Group poles strictly by feeder
  const feederGroups = new Map<string, PoleData[]>();
  poles.forEach(pole => {
    const group = feederGroups.get(pole.feeder) || [];
    group.push(pole);
    feederGroups.set(pole.feeder, group);
  });

  // For each feeder group, connect nearest adjacent poles
  feederGroups.forEach((feederPoles) => {
    if (feederPoles.length < 2) return;

    const visited = new Set<string>();
    const unvisited = [...feederPoles];

    // Start with the first pole in the feeder
    const startPole = unvisited.shift()!;
    visited.add(startPole.id);

    while (unvisited.length > 0) {
      let minDistance = Infinity;
      let closestVisitedPole: PoleData | null = null;
      let closestUnvisitedPole: PoleData | null = null;
      let closestIndex = -1;

      // Find the pair of (visited, unvisited) with the smallest geographic distance
      visited.forEach(visitedId => {
        const vPole = poles.find(p => p.id === visitedId);
        if (!vPole) return;

        unvisited.forEach((uPole, idx) => {
          const dist = calculateHaversineDistanceMeters(vPole.lat, vPole.lng, uPole.lat, uPole.lng);
          // Only connect if distance is reasonable for overhead cable spans (< 2500m)
          if (dist < minDistance && dist < 2500) {
            minDistance = dist;
            closestVisitedPole = vPole;
            closestUnvisitedPole = uPole;
            closestIndex = idx;
          }
        });
      });

      if (closestVisitedPole && closestUnvisitedPole && closestIndex !== -1) {
        const pA = closestVisitedPole as PoleData;
        const pB = closestUnvisitedPole as PoleData;

        visited.add(pB.id);
        unvisited.splice(closestIndex, 1);

        const key = [pA.id, pB.id].sort().join('___');
        const existing = spanMap.get(key);

        if (existing) {
          finalSpans.push(existing);
        } else {
          // Dynamic clearance calculated from minimum of connected poles
          const minClearance = Math.min(pA.clearanceDistanceMeters, pB.clearanceDistanceMeters);
          const hasViolation = minClearance < 3.0;

          finalSpans.push({
            id: `AUTO-SPAN-${pA.id}-${pB.id}`,
            fromPoleId: pA.id,
            toPoleId: pB.id,
            conductorType: pA.type === 'TR' || pB.type === 'TR' ? 'TIC 3x70+1x50 mm²' : 'AACS 150 mm²',
            lengthMeters: Math.round(minDistance),
            clearanceMeters: Number(minClearance.toFixed(1)),
            hasViolation: hasViolation,
            violationType: hasViolation ? (minClearance < 1.5 ? 'Bahaya Kritis (<1.5m)' : 'ROW Pohon/Bangunan (<3m)') : undefined
          });
        }
      } else {
        // If remaining unvisited poles are too far, pick one to start a new branch within same feeder
        const nextPole = unvisited.shift();
        if (nextPole) {
          visited.add(nextPole.id);
        }
      }
    }
  });

  return finalSpans;
}

/**
 * Returns color hex code for cable based on safety distance (ROW Clearance)
 */
export function getCableSafetyColor(clearanceMeters: number): {
  color: string;
  statusLabel: string;
  statusBadgeClass: string;
  dashArray?: string;
  weight: number;
} {
  if (clearanceMeters >= 3.0) {
    return {
      color: '#10B981', // Emerald Green (Aman)
      statusLabel: '✅ Aman (≥ 3.0m)',
      statusBadgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      weight: 4
    };
  } else if (clearanceMeters >= 1.5) {
    return {
      color: '#F59E0B', // Amber Yellow (Waspada/Melanggar ROW <3m)
      statusLabel: '⚠️ Pelanggaran ROW (< 3.0m)',
      statusBadgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      dashArray: '6, 6',
      weight: 4
    };
  } else {
    return {
      color: '#EF4444', // Red (Bahaya Kritis < 1.5m)
      statusLabel: '🚨 Bahaya Kritis (< 1.5m)',
      statusBadgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      dashArray: '8, 6',
      weight: 5
    };
  }
}
