import { forwardRef } from 'react'

const baseStyles = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 ease-out focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:shadow-md disabled:cursor-not-allowed disabled:bg-muted/40'

const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={`${baseStyles} ${className ?? ''}`} {...props} />
})

export default Input
