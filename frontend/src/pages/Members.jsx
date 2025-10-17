import { useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Table from '../components/ui/Table'
import { useMembers } from '../hooks/useMembers'

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

export default function Members() {
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')

  const { data, loading, error, refresh } = useMembers({ status: status === 'ALL' ? undefined : status })

  const filteredMembers = useMemo(() => {
    if (!data?.members) return []
    if (!query) return data.members

    return data.members.filter((member) => {
      const normalizedQuery = query.toLowerCase()
      return [member.first_name, member.last_name, member.email, member.membership_plan]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [data?.members, query])

  if (loading && !data) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        variant="danger"
        title="Unable to load members"
        description={error.detail ?? 'Please try again later.'}
        actions={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'Member',
      render: (member) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {member.first_name} {member.last_name}
          </p>
          <p className="text-xs text-slate-500">{member.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => <Badge variant={badgeVariantForStatus(member.status)}>{member.status}</Badge>,
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (member) => (
        <div>
          <p className="text-sm text-slate-900">{member.membership_plan ?? 'Not assigned'}</p>
          <p className="text-xs text-slate-500">Joined {formatDate(member.join_date)}</p>
        </div>
      ),
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (member) => (
        <div className="text-sm text-slate-900">Due {formatDate(member.next_payment_due)}</div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: () => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm">
            Details
          </Button>
          <Button size="sm">Log Payment</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Track member status, billing, and plan information.</p>
        </div>
        <Button>Add Member</Button>
      </section>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full flex-1 sm:w-auto">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          data={filteredMembers}
          emptyState={{ title: 'No members found', description: 'Try adjusting filters or add a new member.' }}
        />
      </Card>
    </div>
  )
}

function badgeVariantForStatus(status) {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'INACTIVE':
      return 'secondary'
    case 'SUSPENDED':
      return 'warning'
    default:
      return 'info'
  }
}

function formatDate(value) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return parsed.toLocaleDateString()
}
