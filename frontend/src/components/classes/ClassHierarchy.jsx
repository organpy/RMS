import { useEffect, useMemo, useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { Skeleton } from '../ui/skeleton'

function summarizeClass(classItem) {
  const groupCount = classItem.groups?.length ?? 0
  const scheduleRange = [classItem.start_date, classItem.end_date].filter(Boolean)
  const label = scheduleRange.length === 2 ? `${scheduleRange[0]} → ${scheduleRange[1]}` : scheduleRange[0]
  const memberCount = classItem.member_count ?? 0
  return {
    groupCount,
    scheduleLabel: label,
    memberCount,
  }
}

export function ClassHierarchy({
  classes,
  loading,
  isFetching,
  error,
  onRetry,
  onOpenClassMembers,
  onOpenGroupMembers,
  onCreateClass,
  onCreateGroup,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)

  const sortedClasses = useMemo(() => {
    if (!Array.isArray(classes)) return []
    return [...classes].sort((a, b) => a.name.localeCompare(b.name))
  }, [classes])

  useEffect(() => {
    // Auto-expand the first class only once after the initial load.
    if (!loading && !hasAutoExpanded && sortedClasses.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set([sortedClasses[0].id]))
      setHasAutoExpanded(true)
    }
  }, [loading, hasAutoExpanded, sortedClasses, expandedIds.size])

  const toggleExpanded = (classId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(classId)) {
        next.delete(classId)
      } else {
        next.add(classId)
      }
      return next
    })
  }

  if (loading && !sortedClasses.length) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card title="Unable to load classes" subtitle={error.detail ?? 'Please try again shortly.'}>
        <Button onClick={onRetry}>Retry</Button>
      </Card>
    )
  }

  if (!sortedClasses.length) {
    return (
      <Card
        title="No classes yet"
        subtitle="Create your first class to start organizing members into groups."
        footer="Classes connect to members and payments, so setting them up early keeps everything in sync."
      >
        <Button variant="primary" onClick={onCreateClass} disabled={!onCreateClass}>
          Create class
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sortedClasses.map((classItem) => {
        const { groupCount, scheduleLabel, memberCount } = summarizeClass(classItem)
        const isExpanded = expandedIds.has(classItem.id)
        const groupPlural = groupCount === 1 ? 'group' : 'groups'
        const memberPlural = memberCount === 1 ? 'member' : 'members'

        return (
          <Card
            key={classItem.id}
            header={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{classItem.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    {scheduleLabel ? <span>{scheduleLabel}</span> : null}
                    {classItem.grouping_type ? <Badge variant="secondary">{classItem.grouping_type}</Badge> : null}
                    <span>
                      {groupCount} {groupPlural}
                    </span>
                    <span>
                      {memberCount} {memberPlural}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleExpanded(classItem.id)}>
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenClassMembers?.(classItem)}
                    disabled={!onOpenClassMembers}
                  >
                    View members
                  </Button>
                </div>
              </div>
            }
          >
            {isExpanded ? (
              <div className="space-y-3">
                {classItem.description ? <p className="text-sm text-slate-600">{classItem.description}</p> : null}
                {groupCount > 0 ? (
                  <ul className="space-y-2">
                    {classItem.groups.map((group) => (
                      <li key={group.id} className="flex items-start justify-between rounded-lg border border-slate-200 px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-800">{group.name}</span>
                          <span className="text-sm text-slate-500">
                            {group.member_count ?? 0} {(group.member_count ?? 0) === 1 ? 'member' : 'members'}
                          </span>
                          {group.description ? <span className="text-sm text-slate-500">{group.description}</span> : null}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenGroupMembers?.(group, classItem)}
                          disabled={!onOpenGroupMembers}
                        >
                          Open group
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No groups yet. Add one to organize members within this class.</p>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onCreateGroup?.(classItem)}
                  disabled={!onCreateGroup}
                >
                  + Add group
                </Button>
              </div>
            ) : null}

            {isFetching && <p className="text-xs text-slate-400">Refreshing…</p>}
          </Card>
        )
      })}
    </div>
  )
}

export default ClassHierarchy
