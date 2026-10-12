import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { PageHeader } from '@/components/page'
import { useMe } from '@/features/auth/api'
import { useOrg } from '@/features/organization/api'

import { AccountSection } from './account-section'
import { BackupsSection } from './backups-section'
import { BrandingSection } from './branding-section'
import { BillingSection, OrganizationSection } from './organization-section'
import { RemindersSection } from './reminders-section'
import { StaffSection } from './staff-section'

export default function SettingsPage() {
  const { data: me } = useMe()
  const { data: org } = useOrg()
  const { hash } = useLocation()
  const admin = me?.role === 'admin'

  useEffect(() => {
    if (org && hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [org, hash])

  return (
    <>
      <PageHeader title="Settings" description={admin ? 'Organization, billing, staff and backups.' : 'Only admins can change organization settings.'} />
      {org && (
        <div className="max-w-4xl">
          {admin && (
            <>
              <OrganizationSection org={org} />
              <BrandingSection org={org} />
              <BillingSection org={org} />
              <RemindersSection org={org} />
              <StaffSection />
              <BackupsSection />
            </>
          )}
          <AccountSection />
        </div>
      )}
    </>
  )
}
