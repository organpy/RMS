import Button from '../ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { MemberForm } from './MemberForm'

export function MemberCreateDialog({ open, onOpenChange, form, onSubmit, onCancel, isSubmitting }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>
            Capture the essentials and we&apos;ll sync the rest once the backend is ready.
          </DialogDescription>
        </DialogHeader>
        <MemberForm
          form={form}
          onSubmit={onSubmit}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitLabel="Create member"
        />
      </DialogContent>
    </Dialog>
  )
}
