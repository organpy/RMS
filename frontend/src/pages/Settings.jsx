import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert'
import Spinner from '../components/ui/Spinner'
import { useBusiness } from '../context/BusinessContext'
import { useTheme } from '../context/ThemeContext'

const languages = [
  { value: 'EN', label: 'English' },
  { value: 'ES', label: 'Spanish' },
  { value: 'FR', label: 'French' },
  { value: 'PT', label: 'Portuguese' },
]

export default function Settings() {
  const { business, status, refresh } = useBusiness()
  const { theme, setTheme, resetTheme } = useTheme()

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
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your organization profile, theme, and localization preferences.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
          <Button>Save changes</Button>
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
              <Input defaultValue={business?.name ?? ''} placeholder="Studio name" />
            </Field>
            <Field label="Support email">
              <Input defaultValue={business?.support_email ?? ''} placeholder="support@example.com" />
            </Field>
            <Field label="Language">
              <Select defaultValue={business?.language ?? 'EN'}>
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
          <p className="text-sm text-slate-600">
            Current mode: <strong>{status.error ? 'Unknown' : business?.backup_mode ?? 'Manual'}</strong>
          </p>
          <p className="text-xs text-slate-500">
            Backup configuration editing will be implemented alongside the import/export workflows in a later phase.
          </p>
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
