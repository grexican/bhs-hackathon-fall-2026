// Types for hold-to-talk.js.
import type { ListenOptions, SpeechResult, SpeechState } from "./listen.js"

export interface HoldToTalkOptions extends ListenOptions {
  onResult?: (result: SpeechResult) => void
  onError?: (error: Error & { code?: string }) => void
  /** The button's text for each state, or false to leave the text alone (React draws it). */
  labels?: Partial<Record<SpeechState, string>> | false
}

export function holdToTalk(button: HTMLButtonElement | null, options?: HoldToTalkOptions): { destroy(): void }
