import { useEffect, useState } from 'react'
import Table from '../ui/Table'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import api, { get, del, getFile, post } from '../../services/api'
import { useToast } from '@/hooks/use-toast'

export default function BackupHistory() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await get('/api/backups')
      setBackups(data)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Unable to load backups', description: err.detail })
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload(item) {
    try {
      const blob = await getFile(`/api/backups/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.path.split('/').pop()
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Download started', description: item.path })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Download failed', description: err.detail })
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete backup ${item.path}? This action cannot be undone.`)) return
    try {
      await del(`/api/backups/${item.id}`)
      toast({ title: 'Deleted', description: item.path })
      load()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.detail })
    }
  }

  async function handleRestore(item) {
    setSelected(item)
    setShowRestoreModal(true)
    setConfirmText('')
  }

  async function confirmRestore() {
    if (confirmText !== 'RESTORE') {
      toast({ variant: 'destructive', title: 'Confirmation mismatch', description: 'Type RESTORE to confirm.' })
      return
    }

    try {
      // Download the archive from server and post to restore endpoint
      const blob = await getFile(`/api/backups/${selected.id}/download`)
      const form = new FormData()
      form.append('file', new File([blob], selected.path.split('/').pop(), { type: 'application/zip' }))
      const res = await api.post(`/api/backup/restore?dry_run=false`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast({ title: 'Restore started', description: res?.detail ?? 'Restore completed' })
      setShowRestoreModal(false)
      load()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Restore failed', description: err.detail })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Backup history</h3>
        <Button onClick={load} variant="secondary">Refresh</Button>
      </div>
      <div className="mt-4">
        <Table isLoading={loading} columns={["timestamp", "size", "status", "actions"]}>
          {backups.map((b) => (
            <tr key={b.id}>
              <td>{new Date(b.created_at).toLocaleString()}</td>
              <td>{b.size}</td>
              <td>{b.status}</td>
              <td className="flex gap-2">
                <Button size="sm" onClick={() => handleDownload(b)}>Download</Button>
                <Button size="sm" onClick={() => handleRestore(b)}>Restore</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(b)}>Delete</Button>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      <Modal open={showRestoreModal} onClose={() => setShowRestoreModal(false)} title="Confirm restore">
        <div className="space-y-4">
          <p className="text-sm">Restoring will overwrite current data. This action is destructive and cannot be undone.</p>
          <p className="text-sm font-medium">Type <code>RESTORE</code> to confirm.</p>
          <input className="w-full border rounded px-2 py-1" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowRestoreModal(false)}>Cancel</Button>
            <Button onClick={confirmRestore}>Confirm restore</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
