import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'

const demoClasses = [
  {
    id: 'class-1',
    name: 'Morning Yoga',
    instructor: 'Alex Morgan',
    schedule: 'Mon • Wed • Fri',
    capacity: 20,
    enrolled: 18,
    status: 'ACTIVE',
  },
  {
    id: 'class-2',
    name: 'Strength Training',
    instructor: 'Jordan Blake',
    schedule: 'Tue • Thu',
    capacity: 15,
    enrolled: 12,
    status: 'ACTIVE',
  },
  {
    id: 'class-3',
    name: 'Pilates Fundamentals',
    instructor: 'Taylor Lee',
    schedule: 'Sat',
    capacity: 12,
    enrolled: 9,
    status: 'PLANNED',
  },
]

export default function Classes() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Classes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage class schedules, capacity, and instructor assignments. Data is mocked until the scheduling API is ready.
          </p>
        </div>
        <Button>Create Class</Button>
      </section>

      <Card>
        <Table
          columns={[
            { key: 'name', header: 'Class', render: (row) => row.name },
            { key: 'instructor', header: 'Instructor', render: (row) => row.instructor },
            { key: 'schedule', header: 'Schedule', render: (row) => row.schedule },
            {
              key: 'capacity',
              header: 'Capacity',
              render: (row) => (
                <span className="text-sm text-slate-700">
                  {row.enrolled} / {row.capacity}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <Badge variant={row.status === 'ACTIVE' ? 'success' : 'secondary'}>{row.status}</Badge>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: () => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                  <Button size="sm">Publish</Button>
                </div>
              ),
            },
          ]}
          data={demoClasses}
          emptyState={{
            title: 'No classes yet',
            description: 'Schedule your first class to get started.',
          }}
        />
      </Card>
    </div>
  )
}
