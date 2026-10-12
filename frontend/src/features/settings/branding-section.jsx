import { ImageUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogo, useLogoVersion, useUpdateOrg } from '@/features/organization/api'
import { cn } from '@/lib/cn'
import { applyBrand } from '@/lib/theme'

import { Section } from './section'

const SWATCHES = ['#18181b', '#2563eb', '#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#0d9488']

export function BrandingSection({ org }) {
  const update = useUpdateOrg()
  const { upload, remove } = useLogo()
  const file = useRef(null)
  const version = useLogoVersion()
  const [color, setColor] = useState(org.primary_color)
  const valid = /^#[0-9a-f]{6}$/i.test(color)

  const pick = (value) => {
    setColor(value)
    if (/^#[0-9a-f]{6}$/i.test(value)) applyBrand(value)
  }
  const save = () => update.mutate({ primary_color: color.toLowerCase() }, { onSuccess: () => toast.success('Accent colour saved'), onError: (e) => toast.error(e.message) })
  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (f) upload.mutate(f, { onSuccess: () => toast.success('Logo updated'), onError: (err) => toast.error(err.message) })
    e.target.value = ''
  }

  return (
    <Section id="branding" title="Branding" description="Your logo appears in the sidebar and on invoices. The accent colour is used for buttons, charts and invoice stamps.">
      <div className="grid gap-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center overflow-hidden rounded-lg border bg-surface">
            {org.has_logo ? <img src={`/api/organization/logo?v=${version}`} alt="Logo" className="size-full object-contain" /> : <ImageUp className="size-5 text-muted-foreground" />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => file.current.click()} disabled={upload.isPending}>
              {org.has_logo ? 'Replace' : 'Upload logo'}
            </Button>
            {org.has_logo && (
              <Button variant="ghost" size="icon" aria-label="Remove logo" onClick={() => remove.mutate()}>
                <Trash2 />
              </Button>
            )}
          </div>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s}
                aria-label={`Use ${s}`}
                onClick={() => pick(s)}
                className={cn('size-7 rounded-full ring-offset-2 ring-offset-background', color.toLowerCase() === s && 'ring-2 ring-foreground')}
                style={{ background: s }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={valid ? color : '#000000'} onChange={(e) => pick(e.target.value)} className="size-9 cursor-pointer rounded-md border bg-transparent p-1" aria-label="Custom colour" />
            <Input value={color} onChange={(e) => pick(e.target.value)} className="w-28 font-mono" aria-label="Hex colour" />
            <Button className="ml-auto" disabled={!valid || color.toLowerCase() === org.primary_color || update.isPending} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}
