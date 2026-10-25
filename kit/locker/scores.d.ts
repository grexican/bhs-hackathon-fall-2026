// Types for scores.js, so a React + TypeScript game gets autocomplete and checks.
export interface ScoreRow {
  rank: number
  name: string
  score: number
  at: string
  /** true for this player's own row */
  me: boolean
}

export interface SubmitResult {
  score: number
  best: number
  isBest: boolean
  rank: number
  name: string
}

export function deviceId(): string
export function savedName(): string
export function startRun(board?: string): Promise<string>
export function submitScore(input: { board?: string; score?: number; name?: string; run?: string; meta?: unknown }): Promise<SubmitResult>
export function topScores(board?: string, options?: { period?: "all" | "week" | "today"; limit?: number }): Promise<{ board: string; period: string; scores: ScoreRow[]; me: { score: number; name: string; at: string; rank: number } | null }>
