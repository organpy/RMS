import { downloadCsv } from '@/utils/export'
import { formatMemberDate } from '@/utils/members'
import { get } from '@/services/api'

const MEMBERS_ENDPOINT = '/api/members'

function buildParams({ status, search, classId, groupId, skip, limit }) {
  const params = new URLSearchParams()

  const normalizedStatus = typeof status === 'string' && status.toUpperCase() !== 'ALL'
    ? status.toUpperCase()
    : undefined
  if (normalizedStatus) params.set('status', normalizedStatus)

  const trimmedSearch = (search ?? '').toString().trim()
  if (trimmedSearch) params.set('search', trimmedSearch)

  const normClassId = classId == null || Number.isNaN(Number(classId)) ? undefined : Number(classId)
  const normGroupId = groupId == null || Number.isNaN(Number(groupId)) ? undefined : Number(groupId)
  if (normClassId) params.set('class_id', String(normClassId))
  if (normGroupId) params.set('group_id', String(normGroupId))

  if (Number.isFinite(skip) && skip > 0) params.set('skip', String(skip))
  if (Number.isFinite(limit) && limit > 0) params.set('limit', String(limit))

  return params.toString()
}

async function fetchMembersPage(filters) {
  const params = buildParams(filters)
  const raw = await get(`${MEMBERS_ENDPOINT}${params ? `?${params}` : ''}`)
  const members = Array.isArray(raw?.members) ? raw.members : Array.isArray(raw?.data) ? raw.data : []
  const meta = raw?.meta ?? {
    total: members.length,
    skip: filters.skip ?? 0,
    limit: filters.limit ?? members.length,
  }
  return { members, meta }
}

export function buildMemberExportHeaders() {
  return [
    { key: 'name', label: 'Member Name', transform: (m) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'membership_plan', label: 'Membership Plan' },
    { key: 'join_date', label: 'Join Date', transform: (m) => formatMemberDate(m.join_date) },
    { key: 'next_payment_due', label: 'Next Payment Due', transform: (m) => formatMemberDate(m.next_payment_due) },
  ]
}

export async function exportAllMembersCsv({ status, search, classId, groupId }, { filename = 'members-export.csv', batchSize = 500 } = {}) {
  // First page to get total
  const first = await fetchMembersPage({ status, search, classId, groupId, skip: 0, limit: batchSize })
  let all = first.members
  const total = Number(first.meta?.total ?? all.length)

  if (total > all.length) {
    for (let skip = all.length; skip < total; skip += batchSize) {
      const next = await fetchMembersPage({ status, search, classId, groupId, skip, limit: batchSize })
      if (next.members?.length) {
        all = all.concat(next.members)
      } else {
        break
      }
    }
  }

  const headers = buildMemberExportHeaders()
  downloadCsv(filename, all, headers)
  return { count: all.length, total }
}

export default {
  exportAllMembersCsv,
  buildMemberExportHeaders,
}
