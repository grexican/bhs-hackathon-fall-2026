// The hold-to-talk button for React (it wraps hold-to-talk.js). Copy it next to the other speech files.
//
//   <HoldToTalk engine="browser" language="es-ES" onResult={({ text }) => setText(text)} />
//   <HoldToTalk engine="vosk" language="es-ES" commands={["salta", "dispara", "pausa"]} onResult={({ command }) => act(command)} />
//
// Shows what it's doing on the button (listening, writing it down…) and any problem in plain words under it.
import { useEffect, useRef, useState } from "react"

import { holdToTalk } from "./hold-to-talk.js"
import type { Commands, SpeechResult, SpeechState } from "./listen.js"

type Props = {
  engine?: "auto" | "browser" | "cloud" | "vosk"
  language?: string
  commands?: Commands
  quality?: "fast" | "best"
  onResult?: (result: SpeechResult) => void
  onPartial?: (text: string) => void
  labels?: Partial<Record<SpeechState, string>>
  className?: string
}

const LABELS = { idle: "Hold to talk", loading: "Loading the voice model…", listening: "Listening… let go to stop", working: "Writing it down…" }

export function HoldToTalk({ engine = "auto", language = "es-ES", commands, quality, onResult, onPartial, labels, className = "" }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<SpeechState>("idle")
  const [problem, setProblem] = useState("")
  // The latest callbacks, so the button never needs rebuilding when the parent re-renders.
  const handlers = useRef({ onResult, onPartial })
  handlers.current = { onResult, onPartial }

  useEffect(() => {
    const button = holdToTalk(ref.current, {
      engine,
      language,
      commands,
      quality,
      labels: false, // React draws the label below
      onState: (next) => {
        setState(next)
        if (next === "listening") setProblem("")
      },
      onPartial: (text) => handlers.current.onPartial?.(text),
      onResult: (result) => handlers.current.onResult?.(result),
      onError: (err) => setProblem(err.message),
    })
    return () => button.destroy()
  }, [engine, language, quality, JSON.stringify(commands)])

  const text = { ...LABELS, ...labels }[state]
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        ref={ref}
        type="button"
        className={`min-h-14 rounded-full px-6 text-base font-semibold transition-colors select-none bg-primary text-primary-foreground data-[state=listening]:bg-red-600 data-[state=listening]:scale-105 data-[state=loading]:opacity-70 data-[state=working]:opacity-70 ${className}`}
      >
        {text}
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{problem}</p>
    </div>
  )
}
