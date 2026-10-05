import { cn } from '@/lib/cn'

export const Table = ({ className, ...p }) => (
  <div className="overflow-x-auto">
    <table className={cn('w-full border-collapse text-left', className)} {...p} />
  </div>
)
export const THead = (p) => <thead className="text-xs text-muted-foreground" {...p} />
export const TR = ({ className, ...p }) => <tr className={cn('border-b last:border-0', className)} {...p} />
export const TH = ({ className, ...p }) => <th className={cn('h-9 px-4 font-medium whitespace-nowrap', className)} {...p} />
export const TD = ({ className, ...p }) => <td className={cn('h-12 px-4', className)} {...p} />
