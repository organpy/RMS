const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60'

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md focus-visible:outline-ring',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:shadow-sm focus-visible:outline-ring',
  outline: 'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm focus-visible:outline-ring',
  ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md focus-visible:outline-ring',
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
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
