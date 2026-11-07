import { Download, FileUp, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { useMutate } from '@/hooks/use-mutate'
import { api } from '@/lib/api'
import { download } from '@/lib/download'

const send = (file, dryRun) => {
  const body = new FormData()
  body.append('file', file)
  return api.post(`/members/import?dry_run=${dryRun}`, body)
}

function ImportFlow({ onDone }) {
  const input = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const check = useMutate((f) => send(f, true), { onSuccess: setPreview })
  const run = useMutate(() => send(file, false), {
    invalidate: ['members', 'dashboard', 'courses', 'audit'],
    success: (r) => `Imported ${r.created} member${r.created === 1 ? '' : 's'}`,
    onSuccess: onDone,
  })

  const pick = (f) => {
    if (!f) return
    setFile(f)
    setPreview(null)
    check.mutate(f)
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <FileUp className="size-5 shrink-0 text-muted-foreground" />
          <p className="truncate text-[13px]">{file ? file.name : 'Choose a CSV file with one member per row'}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={check.isPending}>
          <Upload /> {file ? 'Change' : 'Choose file'}
        </Button>
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => (pick(e.target.files[0]), (e.target.value = ''))} />
      </div>
      {!file && (
        <p className="text-xs text-muted-foreground">
          Columns: first name, last name, email, phone, course, group, plan, joined (YYYY-MM-DD), discount, guardian, guardian phone, guardian email, notes. Only first and last name are required;
          courses, groups and plans are matched by name.{' '}
          <button type="button" className="underline hover:text-foreground" onClick={() => download('/members/import/template.csv', {}, 'members-template.csv')}>
            <Download className="mr-0.5 inline size-3" />
            Download a template
          </button>
        </p>
      )}

      {check.isPending && <p className="text-[13px] text-muted-foreground">Checking the file…</p>}
      {preview && (
        <div className="grid gap-3 text-[13px]">
          <p>
            <span className="font-medium">{preview.valid}</span> of {preview.total} rows are ready to import
            {preview.errors.length > 0 && <span className="text-danger"> · {preview.errors.length} will be skipped</span>}.
          </p>
          {preview.preview.length > 0 && <p className="text-muted-foreground">e.g. {preview.preview.join(', ')}</p>}
          {preview.errors.length > 0 && (
            <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border">
              {preview.errors.slice(0, 50).map((e) => (
                <li key={e.row} className="flex gap-3 px-3 py-1.5">
                  <span className="tabular w-14 shrink-0 text-muted-foreground">Row {e.row}</span>
                  <span className="text-danger">{e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <DialogFooter>
        <Button type="button" onClick={() => run.mutate()} disabled={!preview?.valid || run.isPending}>
          {preview?.valid ? `Import ${preview.valid} member${preview.valid === 1 ? '' : 's'}` : 'Import'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ImportDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Import members" description="Upload a spreadsheet saved as CSV. Nothing is added until you confirm." className="sm:max-w-lg">
        {open && <ImportFlow onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
