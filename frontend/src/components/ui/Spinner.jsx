export default function Spinner({ size = 'md', className }) {
  const dimension = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  }[size]

  return (
    <span
      className={`inline-block animate-spin rounded-full border-primary border-t-transparent ${dimension} ${className ?? ''}`.trim()}
      aria-hidden="true"
    />
  )
}
