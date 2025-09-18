// Database query result interfaces for type safety

export interface CountResult {
  total: number;
}

export interface TotalActiveResult {
  total: number;
  active: number;
}

export interface StatusCountResult {
  status: string;
  count: number;
}

export interface TypeCountResult {
  type: string;
  count: number;
}

export interface PhaseCountResult {
  phase: string;
  count: number;
}

export interface RecentCountResult {
  recent: number;
}

export interface VoteResult {
  decision: string;
  count: number;
  total_weight: number;
}

export interface DatabaseRow {
  [key: string]: any;
}
