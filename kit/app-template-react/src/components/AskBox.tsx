// The "Ask the AI" box: a working AI example. It sends the question to YOUR server (POST /api/ask),
// which calls the AI with the app's own key. Build your own AI features the same way: the page asks
// your server, never the AI directly. Turn it on in src/App.tsx.
import { useState, type FormEvent } from "react"

import { Markdown } from "@/components/Markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function AskBox() {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")

  async function ask(event: FormEvent) {
    event.preventDefault()
    setAnswer("Thinking…")
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    })
    const json = await res.json()
    // Errors (like "the AI budget is used up") come back as { error }: show them, don't break.
    setAnswer(json.error ?? (json.note ? `${json.answer} (${json.note})` : json.answer))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask the AI anything</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={ask} className="flex gap-2">
          {/* 16px text so phones don't zoom in when you tap the box. */}
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="What should I eat for lunch?" className="h-12 text-base" />
          <Button type="submit" className="h-12 px-5">Ask</Button>
        </form>
        {/* AI answers come back in Markdown (**bold**, lists, links): show them formatted, never as raw stars. */}
        <div role="status" className="mt-3 text-muted-foreground"><Markdown>{answer}</Markdown></div>
      </CardContent>
    </Card>
  )
}
