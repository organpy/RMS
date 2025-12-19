import { forwardRef } from 'react'

const baseStyles = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted/40'

const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`${baseStyles} ${className ?? ''}`} {...props} />
})

export default Textarea
