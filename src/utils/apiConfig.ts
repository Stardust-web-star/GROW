/**
 * API Configuration for Two-Way Real-time Sync
 * Bridges Google AI Studio Cloud Run backend and Vercel deployments.
 */

// Shared public Cloud Run backend URL for this AI Studio project
export const AI_STUDIO_BACKEND_URL = 'https://ais-pre-74jmiitypx4bs2tethf3uw-7378754124.asia-east1.run.app';

/**
 * Returns the resolved API URL.
 * - When running directly on AI Studio (run.app): uses relative /api path.
 * - When running on Vercel (*.vercel.app), localhost, or any external host:
 *   routes to the centralized AI Studio backend URL to ensure shared 2-way data persistence.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Allow custom override via Vite environment variable if provided
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    const custom = (import.meta.env.VITE_BACKEND_URL as string).replace(/\/$/, '');
    return `${custom}${cleanPath}`;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If running on Vercel, localhost (Vite dev server), or other external domain
    if (hostname.includes('vercel.app') || hostname.includes('localhost') || !hostname.includes('run.app')) {
      // Connect directly to the shared AI Studio production server
      return `${AI_STUDIO_BACKEND_URL}${cleanPath}`;
    }
  }

  // Same-origin relative path for AI Studio Cloud Run
  return cleanPath;
}
