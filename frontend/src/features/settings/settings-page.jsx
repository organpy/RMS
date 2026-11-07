import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { PageHeader } from '@/components/page'
import { useMe } from '@/features/auth/api'
import { useOrg } from '@/features/organization/api'
import { api } from '@/lib/api'

import { AccountSection } from './account-section'
import { AuditSection } from './audit-section'
import { BackupsSection } from './backups-section'
import { BrandingSection } from './branding-section'
import { BillingSection, OrganizationSection } from './organization-section'
import { MessagingSection } from './messaging-section'
import { NetworkSection } from './network-section'
import { RemindersSection } from './reminders-section'
import { StaffSection } from './staff-section'

export default function SettingsPage() {
  const { data: me } = useMe()
  const { data: org } = useOrg()
  const { hash } = useLocation()
  const admin = me?.role === 'admin'
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: () => api.get('/health'), staleTime: Infinity })

  useEffect(() => {
    if (org && hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [org, hash])

  return (
    <>
      <PageHeader title="Settings" description={admin ? 'Organization, billing, messaging, staff, network access and backups.' : 'Only admins can change organization settings.'} />
      {org && (
        <div className="max-w-4xl">
          {admin && (
            <>
              <OrganizationSection org={org} />
              <BrandingSection org={org} />
              <BillingSection org={org} />
              <MessagingSection />
              <RemindersSection org={org} />
              <StaffSection />
              <NetworkSection />
              <BackupsSection />
              <AuditSection />
            </>
          )}
          <AccountSection />
          {health && <p className="pb-4 text-xs text-muted-foreground">RMS {health.version === 'dev' ? 'development build' : `version ${health.version}`}</p>}
        </div>
      )}
    </>
  )
}
