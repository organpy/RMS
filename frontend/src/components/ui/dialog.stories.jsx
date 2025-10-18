import Button from './Button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './dialog'

export default {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
}

export const Basic = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate member</DialogTitle>
          <DialogDescription>
            This action will pause access for the selected member. You can reactivate them at any time.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          If the member is simply taking a break, consider moving them to the suspended state so outstanding balances
          remain visible.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="danger">Deactivate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
