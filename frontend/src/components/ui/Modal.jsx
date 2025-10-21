export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './dialog'

import React from 'react'
import {
  Dialog as _Dialog,
  DialogContent as _DialogContent,
  DialogHeader as _DialogHeader,
  DialogFooter as _DialogFooter,
  DialogTitle as _DialogTitle,
  DialogDescription as _DialogDescription,
  DialogClose as _DialogClose,
} from './dialog'

// Default Modal wrapper for simple usage: <Modal open onClose title>children</Modal>
export default function Modal({ open = false, onClose = () => {}, title, children }) {
  return (
    <_Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <_DialogContent>
        <_DialogHeader>
          <_DialogTitle>{title}</_DialogTitle>
          {_DialogDescription ? <_DialogDescription /> : null}
        </_DialogHeader>
        <div>
          {children}
        </div>
        <_DialogFooter>
          <_DialogClose />
        </_DialogFooter>
      </_DialogContent>
    </_Dialog>
  )
}
