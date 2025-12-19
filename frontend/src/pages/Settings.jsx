import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import Spinner from '../components/ui/Spinner'
import { useBusiness } from '../context/BusinessContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '@/hooks/use-toast'
import api from '../services/api'
import BackupHistory from '../components/backups/BackupHistory'

const languages = [
  { value: 'EN', label: 'English' },
  { value: 'ES', label: 'Spanish' },
  { value: 'FR', label: 'French' },
  { value: 'PT', label: 'Portuguese' },
]

const cadenceOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

export default function Settings() {
  const { business, backupConfig, backupStatus, loadBackupConfig, status, refresh, updateBackupSchedule, updateBusiness } = useBusiness()
  const { theme, setTheme, resetTheme } = useTheme()
  const { toast } = useToast()
  const [isBackupLoading, setBackupLoading] = useState(false)
  const [isSavingSchedule, setSavingSchedule] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState(() => ({
    name: business?.name ?? '',
    support_email: business?.support_email ?? '',
    language: business?.language ?? 'EN',
  }))
  const [backupForm, setBackupForm] = useState(() => ({
    enabled: business?.backup_scheduler_enabled ?? false,
    cadence: business?.backup_cadence ?? 'daily',
    retention: business?.backup_retention_count ?? 5,
  }))

  useEffect(() => {
    setProfileForm({
      name: business?.name ?? '',
      support_email: business?.support_email ?? '',
      language: business?.language ?? 'EN',
    })
  }, [business?.name, business?.support_email, business?.language])

  useEffect(() => {
    setBackupForm({
      enabled: business?.backup_scheduler_enabled ?? false,
      cadence: business?.backup_cadence ?? 'daily',
      retention: business?.backup_retention_count ?? 5,
    })
  }, [business?.backup_cadence, business?.backup_retention_count, business?.backup_scheduler_enabled])

  useEffect(() => {
    if (!business) return
    if (backupConfig || backupStatus.loading) return
    loadBackupConfig()
  }, [backupConfig, backupStatus.loading, business, loadBackupConfig])

  const handleProfileChange = useCallback((field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const handleSaveProfile = useCallback(async () => {
    try {
      setIsSavingProfile(true)
      await updateBusiness({
        name: profileForm.name,
        support_email: profileForm.support_email,
        language: profileForm.language,
      })
      toast({
        title: 'Settings saved',
        description: 'Your business profile has been updated.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to save settings',
        description: error?.detail ?? 'Please try again in a moment.',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }, [profileForm, toast, updateBusiness])

  const handleManualBackup = useCallback(async () => {
    try {
      setBackupLoading(true)
      const response = await api.get('/api/settings/backup/manual', { responseType: 'blob' })
      const blob = response.data
      const filename = extractFilename(response.headers?.['content-disposition']) ?? `backup-${new Date().toISOString().slice(0, 10)}.zip`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Backup ready',
        description: `Downloaded ${filename}. Keep it in a safe location.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Backup failed',
        description: error?.detail ?? 'Unable to generate backup archive right now.',
      })
    } finally {
      setBackupLoading(false)
    }
  }, [toast])

  const handleAutomationModeChange = useCallback((event) => {
    const nextMode = event.target.value
    setBackupForm((prev) => ({
      ...prev,
      enabled: nextMode === 'automatic',
    }))
  }, [])

  const handleCadenceChange = useCallback((event) => {
    setBackupForm((prev) => ({
      ...prev,
      cadence: event.target.value,
    }))
  }, [])

  const handleRetentionChange = useCallback((event) => {
    setBackupForm((prev) => ({
      ...prev,
      retention: event.target.value,
    }))
  }, [])

  const handleSaveBackupSchedule = useCallback(async () => {
    try {
      setSavingSchedule(true)
      const payload = {
        enabled: backupForm.enabled,
        cadence: backupForm.enabled ? backupForm.cadence : null,
        retention_count: Math.max(1, Number(backupForm.retention) || 1),
      }
      await updateBackupSchedule(payload)
      toast({
        title: 'Backup schedule updated',
        description: backupForm.enabled
          ? `Backups will run on a ${backupForm.cadence} cadence.`
          : 'Automated backups have been turned off.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Unable to save backup settings',
        description: error?.detail ?? 'Please try again in a moment.',
      })
    } finally {
      setSavingSchedule(false)
    }
  }, [backupForm, toast, updateBackupSchedule])

  const lastRunLabel = useMemo(() => {
    if (!business?.backup_last_run_at) return 'No automated backups have run yet.'
    return `Last run ${formatDateTime(business.backup_last_run_at)}`
  }, [business?.backup_last_run_at])

  const nextRunLabel = useMemo(() => {
    if (!backupForm.enabled) return 'Automation disabled'
    if (!business?.backup_next_run_at) return 'Next run pending scheduling'
    return `Next run ${formatDateTime(business.backup_next_run_at)}`
  }, [backupForm.enabled, business?.backup_next_run_at])

  if (status.loading && !business) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  if (status.error && !business) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="w-full max-w-lg space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Unable to load settings</AlertTitle>
            <AlertDescription>{status.error.detail ?? 'Please try again later.'}</AlertDescription>
          </Alert>
          <Button onClick={refresh}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your organization profile, theme, and localization preferences.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
          <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </section>

      {status.error ? (
        <Alert variant="warning">
          <AlertTitle>Using cached settings</AlertTitle>
          <AlertDescription>
            We could not refresh settings from the server, showing the last known values instead.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Business profile" subtitle="These details appear across the dashboard and outgoing emails.">
          <div className="space-y-4">
            <Field label="Business name">
              <Input 
                value={profileForm.name}
                onChange={(e) => handleProfileChange('name', e.target.value)}
                placeholder="Studio name"
                disabled={isSavingProfile}
              />
            </Field>
            <Field label="Support email">
              <Input 
                value={profileForm.support_email}
                onChange={(e) => handleProfileChange('support_email', e.target.value)}
                placeholder="support@example.com"
                disabled={isSavingProfile}
              />
            </Field>
            <Field label="Language">
              <Select 
                value={profileForm.language}
                onChange={(e) => handleProfileChange('language', e.target.value)}
                disabled={isSavingProfile}
              >
                {languages.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
        <Card title="Theme" subtitle="Adjust branding colors to match your identity.">
          <div className="space-y-4">
            <Field label="Primary color">
              <Input
                type="color"
                value={theme.primaryColor}
                onChange={(event) =>
                  setTheme({ ...theme, primaryColor: event.target.value })
                }
                className="h-12 w-24 cursor-pointer"
              />
            </Field>
            <Field label="Secondary color">
              <Input
                type="color"
                value={theme.secondaryColor}
                onChange={(event) =>
                  setTheme({ ...theme, secondaryColor: event.target.value })
                }
                className="h-12 w-24 cursor-pointer"
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetTheme}>
                Reset theme
              </Button>
              <Button variant="secondary">Preview</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Backups" subtitle="Control automated data exports to keep your business safe.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Automation mode">
              <Select value={backupForm.enabled ? 'automatic' : 'manual'} onChange={handleAutomationModeChange}>
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
              </Select>
            </Field>
            <Field label="Cadence">
              <Select
                value={backupForm.cadence}
                onChange={handleCadenceChange}
                disabled={!backupForm.enabled}
              >
                {cadenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Retention (most recent archives)">
              <Input
                type="number"
                min="1"
                max="60"
                value={backupForm.retention}
                onChange={handleRetentionChange}
                disabled={!backupForm.enabled}
              />
            </Field>
            <div className="space-y-2 text-xs text-slate-500">
              <p>{lastRunLabel}</p>
              <p>{nextRunLabel}</p>
              {backupConfig?.environment?.scheduled_backup_dir ? (
                <p>
                  Files stored in <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                    {backupConfig.environment.scheduled_backup_dir}
                  </code>
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleManualBackup} disabled={isBackupLoading}>
              {isBackupLoading ? 'Generating…' : 'Download manual backup'}
            </Button>
            <p className="text-xs text-slate-500">
              Use this to grab a snapshot of your data whenever you need an offline copy.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveBackupSchedule} disabled={isSavingSchedule}>
              {isSavingSchedule ? 'Saving…' : 'Save backup schedule'}
            </Button>
            {!backupForm.enabled ? (
              <p className="text-xs text-slate-500">Automated backups are currently off.</p>
            ) : (
              <p className="text-xs text-slate-500">
                Up to {Number(backupForm.retention) || 1} archives will be kept.
              </p>
            )}
          </div>
          <div className="mt-6">
            <BackupHistory />
          </div>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function extractFilename(disposition) {
  if (!disposition) return null
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match ? match[1] : null
}

function formatDateTime(value) {
  if (!value) return 'unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'unknown'
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
