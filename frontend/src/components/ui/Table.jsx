function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

const alignmentMap = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export default function Table({
  columns = [],
  data = [],
  emptyState,
  getRowKey,
  className,
}) {
  const keyForRow = getRowKey ?? ((row, index) => row.id ?? index)
  const hasData = Array.isArray(data) && data.length > 0
  const columnCount = columns.length || 1

  return (
    <div className={cx('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}>
      <div className="w-full overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/40">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
                  alignmentMap[column.align ?? 'left'],
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
          {hasData ? (
            data.map((row, index) => (
              <tr key={keyForRow(row, index)} className={row.rowClassName}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      'whitespace-nowrap px-4 py-3 text-sm text-foreground',
                      alignmentMap[column.align ?? 'left'],
                      column.cellClassName,
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-6 py-10 text-center text-sm text-muted-foreground" colSpan={columnCount}>
                {emptyState ? (
                  <div className="space-y-1">
                    {emptyState.title ? (
                      <p className="text-base font-semibold text-foreground">{emptyState.title}</p>
                    ) : null}
                    {emptyState.description ? <p>{emptyState.description}</p> : null}
                  </div>
                ) : (
                  'No data available.'
                )}
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TableContainer({ children, className }) {
  return (
    <div className={cx('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}>
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  )
}

export function THead({ children }) {
  return (
    <thead className="bg-muted/40">
      <tr>{children}</tr>
    </thead>
  )
}

export function TH({ children, align = 'left', className }) {
  return (
    <th
      scope="col"
      className={cx(
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
        alignmentMap[align],
        className,
      )}
    >
      {children}
    </th>
  )
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-border bg-card">{children}</tbody>
}

export function TR({ children, className }) {
  return <tr className={className}>{children}</tr>
}

export function TD({ children, align = 'left', className }) {
  return (
    <td className={cx('whitespace-nowrap px-4 py-3 text-sm text-foreground', alignmentMap[align], className)}>
      {children}
    </td>
  )
}
