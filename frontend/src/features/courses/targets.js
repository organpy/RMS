/** Describe a course, a group or a plan as a place to add members to (see AddMembersMenu). */
export const courseTarget = (course, group) => ({
  label: group ? `${course.name} · ${group.name}` : course.name,
  defaults: { course_id: course.id, group_id: group?.id ?? '' },
  assign: { course_id: course.id, group_id: group?.id ?? null },
  filter: {},
  isIn: (m) => (group ? m.group_id === group.id : m.course_id === course.id),
})

export const planTarget = (plan) => ({
  label: plan.name,
  defaults: { plan_id: plan.id, course_id: plan.course_id ?? '' },
  assign: { plan_id: plan.id },
  // A plan tied to a course can only be given to members of that course.
  filter: plan.course_id ? { course_id: plan.course_id } : {},
  isIn: (m) => m.plan_id === plan.id,
})
