import { PoleData, CableSpan, MaintenanceWorkOrder } from '../types';
import masterData from './masterPoles.json';

// Master Data TITIK TIANG BGL.kml (2,980 Titik Tiang, 2,855 Bentangan Kabel)
export const INITIAL_POLES: PoleData[] = (masterData.poles as unknown as PoleData[]) || [];
export const INITIAL_SPANS: CableSpan[] = (masterData.spans as unknown as CableSpan[]) || [];

export const INITIAL_SPKS: MaintenanceWorkOrder[] = [];

