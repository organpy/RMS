import { useQuery } from '@tanstack/react-query'
import { Download, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'
import { download } from '@/lib/download'
import { date } from '@/lib/format'

import { Section } from './section'

const size = (bytes) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`)
const KIND = { manual: 'Manual', scheduled: 'Scheduled', 'pre-restore': 'Before restore', 'pre-upgrade': 'Before update' }

function Schedule() {
  const { data } = useQuery({ queryKey: ['backups', 'schedule'], queryFn: () => api.get('/backups/schedule') })
  const save = useMutate((body) => api.put('/backups/schedule', body), { invalidate: ['backups'], success: 'Schedule saved' })
  const { register, handleSubmit, formState } = useForm({ values: data && { ...data, backup_enabled: data.backup_enabled ? 'on' : 'off' } })
  if (!data) return null
  return (
    <form className="grid grid-cols-[1fr_1fr_6rem_auto] items-end gap-3" onSubmit={handleSubmit((v) => save.mutate({ ...v, backup_enabled: v.backup_enabled === 'on', backup_keep: Number(v.backup_keep) }))}>
      <Field label="Automatic backups">
        <Select {...register('backup_enabled')}>
          <option value="off">Off</option>
          <option value="on">On</option>
        </Select>
      </Field>
      <Field label="Frequency">
        <Select {...register('backup_cadence')}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </Select>
      </Field>
      <Field label="Keep">
        <Input type="number" min={1} max={100} {...register('backup_keep')} />
      </Field>
      <Button type="submit" variant="outline" disabled={!formState.isDirty || save.isPending}>
        Save
      </Button>
      {data.backup_last_at && <p className="col-span-4 text-xs text-muted-foreground">Last automatic backup {date(data.backup_last_at)}</p>}
    </form>
  )
}

export function BackupsSection() {
  const { data: backups = [] } = useQuery({ queryKey: ['backups', 'list'], queryFn: () => api.get('/backups') })
  const create = useMutate(() => api.post('/backups'), { invalidate: ['backups'], success: 'Backup created' })
  const remove = useMutate((name) => api.del(`/backups/${name}`), { invalidate: ['backups'], success: 'Backup deleted' })
  const restore = useMutate(
    (file) => {
      const body = new FormData()
      body.append('file', file)
      return api.post('/backups/restore', body)
    },
    { onSuccess: () => (toast.success('Backup restored, reloading…'), setTimeout(() => window.location.reload(), 800)) },
  )
  const file = useRef(null)
  const onFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f && confirm('Restoring replaces ALL current data with the backup. A safety backup of the current data is taken first. Continue?')) restore.mutate(f)
  }

  return (
    <Section id="backups" title="Backups" description="Snapshots of the database and logo, stored in the data folder on this computer. Download them to keep a copy elsewhere.">
      <div className="grid gap-5">
        <Schedule />
        <div className="flex gap-2">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Back up now
          </Button>
          <Button variant="outline" onClick={() => file.current.click()} disabled={restore.isPending}>
            <Upload /> Restore from file
          </Button>
          <input ref={file} type="file" accept=".zip,application/zip" hidden onChange={onFile} />
        </div>
        {backups.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {backups.map((b) => (
              <li key={b.filename} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{date(b.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-muted-foreground">{size(b.size)}</p>
                </div>
                <Badge>{KIND[b.kind] ?? b.kind}</Badge>
                <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Download backup" onClick={() => download(`/backups/${b.filename}`, null, b.filename)}>
                  <Download />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Delete backup" onClick={() => confirm('Delete this backup?') && remove.mutate(b.filename)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}
