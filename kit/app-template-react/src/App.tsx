// The starting page. /start replaces it with your real app.
// Built phone first: one column, big buttons at thumb height, nothing that needs a mouse.
import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

import SplitText from "@/components/SplitText"
import { AskBox } from "@/components/AskBox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Spotlight } from "@/components/ui/spotlight-new"

// The "Ask the AI" box (src/components/AskBox.tsx; the AI call is in server.js). Set this to true to turn it on.
// Before /connect it answers with a labelled simulated reply; online it uses the app's monthly AI budget.
const SHOW_ASK_THE_AI = false

export default function App() {
  const [count, setCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Load the saved count once, when the page opens.
  useEffect(() => {
    fetch("/api/taps")
      .then((r) => r.json())
      .then((d) => setCount(d.count))
      .catch(() => setCount(0))
  }, [])

  // Tap: the server saves it in the database and sends back the new total.
  async function tap() {
    setSaving(true)
    try {
      const r = await fetch("/api/taps", { method: "POST" })
      setCount((await r.json()).count)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <Spotlight />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit gap-1">
            <Sparkles className="size-3" /> Starter app
          </Badge>
          <SplitText text="{{name}}" tag="h1" splitType="chars" effect="rise" trigger="load" className="font-heading text-5xl font-semibold tracking-tight text-balance" textAlign="left" />
          <p className="text-base text-muted-foreground">
            Your app is running. Tap the button: the count is saved in the database, so it stays after a restart.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Taps so far</CardTitle>
            <CardDescription>Everyone who opens the app shares this number.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-6xl font-semibold tabular-nums">{count === null ? "…" : count === 0 ? "0" : <NumberTicker value={count} />}</p>
          </CardContent>
        </Card>

        {SHOW_ASK_THE_AI ? <AskBox /> : null}

        {/* A hint for you, the builder. Delete it when your real page is here. */}
        <p className="text-sm text-muted-foreground">
          Turn on: <b>Ask the AI</b> (src/App.tsx) · <b>Feedback button</b> (index.html)
        </p>

        {/* The main action sits low, where a thumb reaches it on a phone. */}
        <div className="mt-auto">
          <Button size="lg" className="h-14 w-full text-base" onClick={tap} disabled={saving}>
            Tap me
          </Button>
        </div>
      </main>
    </div>
  )
}
