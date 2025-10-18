import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet'
import { MemberForm } from './MemberForm'

export function MemberEditOverlay({
  open,
  isDesktop,
  onOpenChange,
  member,
  form,
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {member ? `Edit ${member.first_name} ${member.last_name}` : 'Edit member'}
            </DialogTitle>
            <DialogDescription>Update member profile details and status.</DialogDescription>
          </DialogHeader>
          <MemberForm
            form={form}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            submitLabel="Save changes"
            cancelLabel="Close"
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {member ? `Edit ${member.first_name} ${member.last_name}` : 'Edit member'}
          </SheetTitle>
          <SheetDescription>Make quick changes while staying on the members list.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <MemberForm
            form={form}
            onSubmit={onSubmit}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            submitLabel="Save changes"
            cancelLabel="Close"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
