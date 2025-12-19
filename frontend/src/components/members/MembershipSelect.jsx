import { useMemo, useState, useCallback } from 'react'
import { useMembers } from '../../hooks/useMembers'
import Input from '../ui/Input'
import Button from '../ui/Button'

export function MembershipSelect({
  value,
  onChange,
  disabled = false,
  businessId,
}) {
  const [showAddNew, setShowAddNew] = useState(false)
  const [newValue, setNewValue] = useState('')

  // Fetch all members to infer existing membership plans
  const { members = [] } = useMembers({
    businessId,
    pageSize: 100,
  })

  // Extract unique membership plans from members
  const membershipPlans = useMemo(() => {
    const plans = new Set()
    members.forEach((m) => {
      if (m.membership_plan) {
        plans.add(m.membership_plan)
      }
    })
    return Array.from(plans).sort()
  }, [members])

  const handleAddNew = useCallback(() => {
    if (newValue.trim()) {
      onChange(newValue.trim())
      setNewValue('')
      setShowAddNew(false)
    }
  }, [newValue, onChange])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddNew()
      } else if (e.key === 'Escape') {
        setShowAddNew(false)
      }
    },
    [handleAddNew],
  )

  if (showAddNew) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Enter membership plan"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAddNew(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleAddNew}
            disabled={disabled || !newValue.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
        {membershipPlans.length === 0 ? (
          <p className="col-span-full text-xs text-slate-500">No existing plans. Click "Add new" to create one.</p>
        ) : (
          membershipPlans.map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => onChange(plan)}
              disabled={disabled}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                value === plan
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              } disabled:opacity-50`}
            >
              {plan}
            </button>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowAddNew(true)}
          disabled={disabled}
        >
          + Add new membership
        </Button>
        {value && membershipPlans.indexOf(value) === -1 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange('')}
            disabled={disabled}
          >
            Clear custom value
          </Button>
        )}
      </div>
    </div>
  )
}

export default MembershipSelect
