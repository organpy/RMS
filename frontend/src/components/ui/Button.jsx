const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary/90 focus-visible:outline-primary',
  secondary: 'bg-secondary text-white hover:bg-secondary/90 focus-visible:outline-secondary',
  ghost: 'bg-transparent text-secondary hover:bg-secondary/10 focus-visible:outline-secondary',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Button({
  as: Component = 'button',
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) {
  const commonProps = {
    className: cx(baseStyles, variants[variant], sizes[size], className),
    ...props,
  }

  if (Component === 'button' && commonProps.type === undefined) {
    commonProps.type = 'button'
  }

  return <Component {...commonProps}>{children}</Component>
}
