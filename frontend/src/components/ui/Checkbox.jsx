import { forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const baseStyles =
  'h-4 w-4 rounded border border-slate-300 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60'

const Checkbox = forwardRef(({ className, indeterminate, ...props }, ref) => {
  const internalRef = useRef(null)
  const resolvedRef = ref ?? internalRef

  useEffect(() => {
    if (resolvedRef.current) {
      resolvedRef.current.indeterminate = Boolean(indeterminate) && !props.checked
    }
  }, [resolvedRef, indeterminate, props.checked])

  return <input type="checkbox" ref={resolvedRef} className={cn(baseStyles, className)} {...props} />
})

Checkbox.displayName = 'Checkbox'

export default Checkbox
