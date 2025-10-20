import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'

export function MemberFilters({
  searchTerm,
  onSearchChange,
  status,
  statusOptions,
  onStatusChange,
  classFilter,
  classOptions,
  onClassChange,
  groupFilter,
  groupSelectOptions,
  groupSelectPlaceholder,
  onGroupChange,
  filtersLoading,
  hasGroupOptions,
  onRefresh,
  isRefreshing,
  onExportAll,
  isExporting,
}) {
  return (
    <>
      <Input
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search members"
        className="w-full sm:w-64"
      />
      <Select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        className="w-full sm:w-48"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={classFilter}
        onChange={(event) => onClassChange(event.target.value)}
        className="w-full sm:w-48"
        disabled={filtersLoading}
      >
        <option value="ALL">All classes</option>
        {classOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={groupFilter}
        onChange={(event) => onGroupChange(event.target.value)}
        className="w-full sm:w-56"
        disabled={filtersLoading || (!hasGroupOptions && groupFilter === 'ALL')}
      >
        <option value="ALL">{groupSelectPlaceholder}</option>
        {groupSelectOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.displayLabel}
          </option>
        ))}
      </Select>
      <Button variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
        Refresh
      </Button>
      {onExportAll ? (
        <Button variant="outline" onClick={onExportAll} disabled={isExporting}>
          {isExporting ? 'Exporting…' : 'Export all CSV'}
        </Button>
      ) : null}
    </>
  )
}
