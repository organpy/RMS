import { forwardRef } from 'react'

const baseStyles = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-50'

const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={`${baseStyles} ${className ?? ''}`} {...props}>
      {children}
    </select>
  )
})

export default Select
