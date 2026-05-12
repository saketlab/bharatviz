import mapping from './pincode-gist-mapping.json';

const gistMap = mapping as Record<string, string>;

export function getPincodeGeoJSONUrl(state: string): string | null {
  return gistMap[state] || null;
}

export function getPincodeGistStates(): string[] {
  return Object.keys(gistMap).sort();
}

export function hasPincodeGists(): boolean {
  return Object.keys(gistMap).length > 0;
}
