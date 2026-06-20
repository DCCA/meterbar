import type { ProviderId, UsageSnapshot } from '../shared/types';

export type CollectionStrategy =
  | { strategy: 'fetch'; endpoint: string; init?: RequestInit }
  | { strategy: 'content'; matches: string[] };

export interface ProviderAdapter {
  provider: ProviderId;
  label: string;
  collection: CollectionStrategy;
  /** Pure + deterministic: same raw + now → same snapshots. No I/O. */
  parse(raw: unknown, now?: Date): UsageSnapshot[];
}
