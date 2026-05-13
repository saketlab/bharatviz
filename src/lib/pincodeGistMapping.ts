import mapping from './pincode-gist-mapping.json';
import { ALL_INDIA_STATE } from './constants';

const gistMap = mapping as Record<string, string>;

export function getPincodeGeoJSONUrl(state: string): string | null {
  return gistMap[state] || null;
}

export function getPincodeGistStates(): string[] {
  return [ALL_INDIA_STATE, ...Object.keys(gistMap).sort()];
}

export function hasPincodeGists(): boolean {
  return Object.keys(gistMap).length > 0;
}
