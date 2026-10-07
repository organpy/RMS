import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function Pagination({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (total <= size) return null
  const from = (page - 1) * size + 1
  return (
    <div className="flex items-center justify-between border-t px-4 py-2.5 text-[13px] text-muted-foreground">
      <span className="tabular">
        {from}–{Math.min(page * size, total)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
