import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { QrCode } from '@/components/qr-code'
import { Dialog, DialogContent } from '@/components/ui/dialog'

import { useNetwork } from './api'

function CopyUrl({ url }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(url).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
      className="flex w-full items-center gap-2 rounded-md border bg-surface px-3 py-2 font-mono text-[13px] hover:bg-muted"
      title="Copy address"
    >
      <span className="flex-1 truncate text-left">{url}</span>
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4 text-muted-foreground" />}
    </button>
  )
}

/** Address and QR code that other devices on the network can use. */
export function PhoneAccess({ urls }) {
  if (!urls.length)
    return <p className="text-[13px] text-muted-foreground">This computer has no local network address right now. Check that it is connected to Wi-Fi or a cable.</p>
  return (
    <div className="flex flex-wrap items-center gap-5">
      <QrCode value={urls[0]} className="rounded-lg border" />
      <div className="grid min-w-0 flex-1 basis-56 gap-2">
        <p className="text-[13px] text-muted-foreground">Scan with the phone’s camera, or type the address in any browser on the same network:</p>
        {urls.map((u) => (
          <CopyUrl key={u} url={u} />
        ))}
        <p className="text-xs text-muted-foreground">On a phone, use “Add to Home Screen” to open RMS like an app.</p>
      </div>
    </div>
  )
}

export function PhoneDialog({ open, onOpenChange }) {
  const { data } = useNetwork()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Use RMS on your phone" description="Phones and computers on the same network can sign in here." className="max-w-lg">
        {data?.listening && data.listening !== '127.0.0.1' ? (
          <PhoneAccess urls={data.urls} />
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Network access is off, so only this computer can open RMS. An admin can turn it on in Settings → Network access.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
