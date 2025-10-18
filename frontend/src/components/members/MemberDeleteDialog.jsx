import Button from '../ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

export function MemberDeleteDialog({ open, member, onCancel, onConfirm, isPending }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel()
        }
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove member?</DialogTitle>
          <DialogDescription>
            {member
              ? `This will archive ${member.first_name ?? ''} ${member.last_name ?? ''} and remove them from active views.`
              : 'This will archive the member and remove them from active views.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Removing…' : 'Remove member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
