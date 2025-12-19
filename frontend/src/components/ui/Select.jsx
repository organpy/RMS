import { forwardRef } from 'react'

const baseStyles = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 ease-out focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:shadow-md disabled:cursor-not-allowed disabled:bg-muted/40'

const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={`${baseStyles} ${className ?? ''}`} {...props}>
      {children}
    </select>
  )
})

export default Select
