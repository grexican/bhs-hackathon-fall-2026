// Types for listen.js, so a React + TypeScript app gets autocomplete and checks.
export type Engine = "auto" | "browser" | "cloud" | "vosk"
export type SpeechState = "idle" | "loading" | "listening" | "working"
export type Commands = string[] | Record<string, string | string[]>

export interface ListenOptions {
  engine?: Engine
  /** "es-ES", "ca-ES", "en-US"… */
  language?: string
  commands?: Commands
  onPartial?: (text: string) => void
  onState?: (state: SpeechState) => void
  /** cloud: "fast" (default) or "best" */
  quality?: "fast" | "best"
  /** cloud: your server's route (default "/api/transcribe") */
  endpoint?: string
  /** cloud: the recorder stops itself after this many seconds (default 120) */
  maxSeconds?: number
  /** vosk: your own model address instead of the kit's */
  modelUrl?: string
}

export interface SpeechResult {
  text: string
  /** The matching key from `commands`, or null */
  command: string | null
  engine: Exclude<Engine, "auto">
  simulated: boolean
  note?: string
}

export interface ListenSession {
  engine: Exclude<Engine, "auto">
  stop(): Promise<SpeechResult>
  cancel(): void
}

export class SpeechError extends Error {
  code: string
}

export const LANGUAGES: { code: string; label: string }[]
export const VOSK_MODELS: Record<string, { file: string; mb: number }>
export function listen(options?: ListenOptions): Promise<ListenSession>
export function speechSupport(): { browser: boolean; cloud: boolean; vosk: boolean; secure: boolean }
export function pickEngine(engine?: Engine): Exclude<Engine, "auto"> | null
export function preloadVosk(options?: { language?: string; modelUrl?: string }): Promise<unknown>
export function matchCommand(text: string, commands: Commands): { command: string; heard: string } | null
