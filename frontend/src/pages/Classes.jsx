import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import ClassHierarchy from '../components/classes/ClassHierarchy'
import ClassCreateDialog from '../components/classes/ClassCreateDialog'
import GroupCreateDialog from '../components/classes/GroupCreateDialog'
import { useBusiness } from '../context/BusinessContext'
import { useClasses } from '../hooks/useClasses'

export default function Classes() {
  const { business, status } = useBusiness()
  const navigate = useNavigate()
  const [createClassDialogOpen, setCreateClassDialogOpen] = useState(false)
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false)
  const [selectedClassForGroup, setSelectedClassForGroup] = useState(null)

  const {
    classes = [],
    loading,
    isFetching,
    error,
    refresh,
  } = useClasses({
    businessId: business?.id,
    enabled: !status.loading && Boolean(business?.id),
  })

  const handleOpenClassMembers = useCallback(
    (classItem) => {
      if (!classItem?.id) return
      navigate('/members', {
        state: {
          focusClassId: classItem.id,
          focusClassName: classItem.name,
        },
      })
    },
    [navigate],
  )

  const handleOpenGroupMembers = useCallback(
    (group, classItem) => {
      if (!group?.id) return
      navigate('/members', {
        state: {
          focusGroupId: group.id,
          focusGroupName: group.name,
          focusClassId: classItem?.id,
          focusClassName: classItem?.name,
        },
      })
    },
    [navigate],
  )

  const handleCreateGroup = useCallback((classItem) => {
    if (!classItem) return
    setSelectedClassForGroup(classItem)
    setCreateGroupDialogOpen(true)
  }, [])

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your program hierarchy. Each class pulls live data from the scheduling API, including attached groups.
          </p>
        </div>
        <Button 
          onClick={() => setCreateClassDialogOpen(true)}
          disabled={!business?.id}
        >
          Create Class
        </Button>
      </section>

      <ClassCreateDialog 
        open={createClassDialogOpen}
        onOpenChange={setCreateClassDialogOpen}
        businessId={business?.id}
      />

      <GroupCreateDialog 
        open={createGroupDialogOpen}
        onOpenChange={setCreateGroupDialogOpen}
        classId={selectedClassForGroup?.id}
        className={selectedClassForGroup?.name}
      />

      <ClassHierarchy
        classes={classes}
        loading={loading}
        isFetching={isFetching}
        error={error}
        onRetry={refresh}
        onOpenClassMembers={handleOpenClassMembers}
        onOpenGroupMembers={handleOpenGroupMembers}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  )
}
