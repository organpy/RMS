import { createPortal } from 'react-dom'
import Button from './Button'

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) {
  if (!isOpen) return null

  const width = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  }[size]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
      <div className={cx('w-full rounded-2xl bg-white p-6 shadow-xl', width)}>
        <div className="flex items-start justify-between gap-4">
          {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </Button>
        </div>
        <div className="mt-4 space-y-4 text-sm text-slate-600">{children}</div>
        {footer && <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
