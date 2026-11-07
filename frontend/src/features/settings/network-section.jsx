import { Loader2 } from 'lucide-react'

import { useNetwork, useSetNetwork } from '@/features/network/api'
import { PhoneAccess } from '@/features/network/phone-access'

import { Section } from './section'

export function NetworkSection() {
  const { data } = useNetwork()
  const set = useSetNetwork()
  if (!data) return null
  const live = data.listening && data.listening !== '127.0.0.1'
  const pending = data.enabled !== Boolean(live) && !data.restart_supported

  return (
    <Section
      id="network"
      title="Network access"
      description="Use RMS from phones, tablets and other computers on the same Wi-Fi or office network. Nothing is opened to the internet."
    >
      <div className="grid gap-5">
        <label className="flex items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5 accent-accent"
            checked={data.enabled}
            disabled={data.managed_by_env || set.isPending}
            onChange={(e) => set.mutate(e.target.checked)}
          />
          <span className="grid gap-0.5">
            <span className="flex items-center gap-2 font-medium">
              Let other devices on this network use RMS
              {set.isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </span>
            <span className="text-muted-foreground">
              {data.managed_by_env
                ? 'Set by RMS_HOST in the .env file. Change it there and restart RMS.'
                : 'Everyone still has to sign in with their own account. Only turn this on at work or at home, not on public Wi-Fi.'}
            </span>
          </span>
        </label>

        {pending && <p className="text-[13px] text-warning">Restart RMS to apply this change.</p>}

        {live && (
          <>
            <PhoneAccess urls={data.urls} />
            <p className="rounded-lg border bg-surface px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Can’t connect from another device?</span> On Windows, the first time this is
              turned on a firewall window asks about Python: tick <span className="font-medium">Private networks</span> and click{' '}
              <span className="font-medium">Allow access</span>. Also make sure this computer’s network is set to Private, and that both
              devices are on the same Wi-Fi.
            </p>
          </>
        )}
      </div>
    </Section>
  )
}
