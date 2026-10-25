// "Turn on notifications": asks for permission only when the person taps, then sends this device's
// subscription to YOUR server (locker/push.mjs), which passes it on to the hub. Once it's on, the same
// button sends a test. Send real ones from server.js with sendPush (the push-notifications skill).
// Turn it on in src/App.tsx.
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Status = "on" | "off" | "denied" | "unsupported" | "ios-home-screen"
type LockerPush = {
  status(): Promise<Status>
  turnOn(): Promise<{ user: string; simulated?: boolean }>
  turnOff(): Promise<void>
  test(): Promise<{ sent?: number; simulated?: boolean }>
  deviceId: string
}
declare global {
  interface Window { lockerPush?: LockerPush }
}

// The browser half lives in locker/push.js (served by the server), shared with plain-HTML apps.
function loadLockerPush(): Promise<LockerPush> {
  if (window.lockerPush) return Promise.resolve(window.lockerPush)
  return new Promise((resolve, reject) => {
    const tag = document.createElement("script")
    tag.src = "/locker/push.js"
    tag.onload = () => (window.lockerPush ? resolve(window.lockerPush) : reject(new Error("push.js didn't load")))
    tag.onerror = () => reject(new Error("push.js didn't load"))
    document.head.append(tag)
  })
}

const LABEL: Record<Status, string> = {
  off: "Turn on notifications",
  on: "Send me a test",
  denied: "Notifications are blocked",
  unsupported: "Not in this browser",
  "ios-home-screen": "Turn on notifications",
}
const HINT: Partial<Record<Status, string>> = {
  denied: "Turn them on in the browser's settings for this site.",
  "ios-home-screen": "On iPhone: tap Share, then Add to Home Screen. Open the app from your Home Screen and tap this again.",
}

export function PushButton() {
  const [push, setPush] = useState<LockerPush | null>(null)
  const [status, setStatus] = useState<Status>("off")
  const [note, setNote] = useState("")

  useEffect(() => {
    loadLockerPush()
      .then(async (p) => {
        setPush(p)
        setStatus(await p.status())
      })
      .catch(() => setStatus("unsupported"))
  }, [])

  // Nothing is awaited before turnOn(): the browser only shows the permission question straight after a tap.
  async function tap() {
    if (!push) return
    try {
      if (status === "ios-home-screen") return setNote(HINT[status]!)
      if (status === "on") {
        const r = await push.test()
        setNote(r.simulated ? "Simulated on this laptop (it's in the terminal too). After /connect it really sends." : r.sent ? "Sent! It should pop up in a moment." : "Sent, but no device got it. Try turning it on again.")
        return
      }
      const r = await push.turnOn()
      setNote(r.simulated ? "On (simulated until the app is connected)." : "Notifications are on.")
    } catch (err) {
      setNote((err as Error).message)
    }
    setStatus(await push.status())
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button size="lg" className="h-12 gap-2 text-base" onClick={tap} disabled={!push || status === "denied" || status === "unsupported"}>
          <Bell className="size-4" /> {LABEL[status]}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">{note || HINT[status] || ""}</p>
      </CardContent>
    </Card>
  )
}
