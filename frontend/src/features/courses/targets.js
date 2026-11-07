/** Describe a course, a group or a plan as a place to add members to (see AddMembersMenu). */
export const courseTarget = (course, group) => ({
  label: group ? `${course.name} · ${group.name}` : course.name,
  courseName: course.name,
  defaults: { course_id: course.id, group_id: group?.id ?? '' },
  assign: { course_id: course.id, group_id: group?.id ?? null },
  filter: {},
  isIn: (m) => (group ? m.group_id === group.id : m.course_id === course.id),
})

export const planTarget = (plan) => ({
  label: plan.name,
  courseName: plan.course_name,
  defaults: { plan_id: plan.id, course_id: plan.course_id ?? '' },
  // A plan tied to a course only exists there, so members from elsewhere move into that course with it.
  assign: plan.course_id ? { plan_id: plan.id, course_id: plan.course_id } : { plan_id: plan.id },
  filter: {},
  isIn: (m) => m.plan_id === plan.id,
})
