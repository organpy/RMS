import { forwardRef } from 'react'

const baseStyles = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50'

const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={`${baseStyles} ${className ?? ''}`} {...props} />
})

export default Input
