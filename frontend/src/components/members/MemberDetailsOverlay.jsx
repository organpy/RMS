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
import { MemberDetailsPanel } from './MemberDetailsPanel'

export function MemberDetailsOverlay({
  open,
  isDesktop,
  member,
  payments,
  paymentsLoading,
  onOpenChange,
  onEdit,
  onRecordPayment,
  onSendReminder,
  onChangeStatus,
  onRequestDelete,
  onRefreshPayments,
  isUpdatingStatus,
  isDeleting,
}) {
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {member ? `${member.first_name} ${member.last_name}` : 'Member details'}
            </DialogTitle>
            <DialogDescription>Review recent activity and member insights.</DialogDescription>
          </DialogHeader>
          <MemberDetailsPanel
            member={member}
            payments={payments}
            paymentsLoading={paymentsLoading}
            onEdit={onEdit}
            onRecordPayment={onRecordPayment}
            onSendReminder={onSendReminder}
            onChangeStatus={onChangeStatus}
            onRequestDelete={onRequestDelete}
            onRefreshPayments={onRefreshPayments}
            isUpdatingStatus={isUpdatingStatus}
            isDeleting={isDeleting}
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
            {member ? `${member.first_name} ${member.last_name}` : 'Member details'}
          </SheetTitle>
          <SheetDescription>Review recent activity and member insights.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <MemberDetailsPanel
            member={member}
            payments={payments}
            paymentsLoading={paymentsLoading}
            onEdit={onEdit}
            onRecordPayment={onRecordPayment}
            onSendReminder={onSendReminder}
            onChangeStatus={onChangeStatus}
            onRequestDelete={onRequestDelete}
            onRefreshPayments={onRefreshPayments}
            isUpdatingStatus={isUpdatingStatus}
            isDeleting={isDeleting}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
