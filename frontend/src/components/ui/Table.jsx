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
    <div className={cx('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500',
                  alignmentMap[column.align ?? 'left'],
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {hasData ? (
            data.map((row, index) => (
              <tr key={keyForRow(row, index)} className={row.rowClassName}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      'whitespace-nowrap px-4 py-3 text-sm text-slate-700',
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
              <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={columnCount}>
                {emptyState ? (
                  <div className="space-y-1">
                    {emptyState.title ? (
                      <p className="text-base font-semibold text-slate-700">{emptyState.title}</p>
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
  )
}

export function TableContainer({ children, className }) {
  return (
    <div className={cx('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  )
}

export function THead({ children }) {
  return (
    <thead className="bg-slate-50">
      <tr>{children}</tr>
    </thead>
  )
}

export function TH({ children, align = 'left', className }) {
  return (
    <th
      scope="col"
      className={cx(
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500',
        alignmentMap[align],
        className,
      )}
    >
      {children}
    </th>
  )
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
}

export function TR({ children, className }) {
  return <tr className={className}>{children}</tr>
}

export function TD({ children, align = 'left', className }) {
  return (
    <td className={cx('whitespace-nowrap px-4 py-3 text-sm text-slate-700', alignmentMap[align], className)}>
      {children}
    </td>
  )
}
