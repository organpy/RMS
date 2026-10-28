import { Download, MoreHorizontal, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { EmptyState, PageHeader } from '@/components/page'
import { Pagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/dropdown'
import { Field, Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TD, TH, THead, TR } from '@/components/ui/table'
import { useDebounced } from '@/hooks/use-debounced'
import { useParamsState } from '@/hooks/use-params-state'
import { download } from '@/lib/download'
import { date, money, today } from '@/lib/format'

import { useDeleteExpense, useExpenseCategories, useExpenses, useSaveExpense } from './api'

const SIZE = 25
const METHODS = [
  ['cash', 'Cash'],
  ['card', 'Card'],
  ['transfer', 'Transfer'],
  ['other', 'Other'],
]
const METHOD = Object.fromEntries(METHODS)
const SUGGESTED = ['Rent', 'Salaries', 'Equipment', 'Supplies', 'Utilities', 'Marketing']

function ExpenseForm({ expense, onDone }) {
  const save = useSaveExpense()
  const { data: used = [] } = useExpenseCategories()
  const categories = [...new Set([...used, ...SUGGESTED])]
  const { register, handleSubmit } = useForm({
    defaultValues: {
      spent_on: expense?.spent_on ?? today(),
      category: expense?.category ?? '',
      description: expense?.description ?? '',
      amount: expense?.amount ?? '',
      method: expense?.method ?? 'cash',
    },
  })
  const submit = (v) =>
    save.mutate({ id: expense?.id, ...v, category: v.category.trim(), description: v.description.trim(), amount: Number(v.amount).toFixed(2) }, { onSuccess: onDone })

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Input autoFocus required list="expense-categories" {...register('category')} />
        </Field>
        <datalist id="expense-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Amount">
          <Input type="number" step="0.01" min="0.01" required {...register('amount')} />
        </Field>
      </div>
      <Field label="Description">
        <Input required placeholder="e.g. October rent, new mats" {...register('description')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" required max={today()} {...register('spent_on')} />
        </Field>
        <Field label="Paid by">
          <Select {...register('method')}>
            {METHODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={save.isPending}>
          {expense ? 'Save' : 'Add expense'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function ExpensesPage() {
  const [params, patch] = useParamsState()
  const [search, setSearch] = useState(params.q ?? '')
  const q = useDebounced(search.trim())
  const page = Number(params.page ?? 1)
  const filters = { q, category: params.category, from: params.from, to: params.to }
  const { data, isPending } = useExpenses({ ...filters, page, size: SIZE })
  const { data: categories = [] } = useExpenseCategories()
  const remove = useDeleteExpense()
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (q !== (params.q ?? '')) patch({ q, page: null })
  }, [q, params.q, patch])

  const filtered = Boolean(q || params.category || params.from || params.to)

  return (
    <>
      <PageHeader title="Expenses" description={data ? `${data.total.toLocaleString()} expense${data.total === 1 ? '' : 's'} · ${money(data.amount_total)} spent` : ' '}>
        <Button variant="outline" onClick={() => download('/expenses/export.csv', filters, 'expenses.csv')}>
          <Download /> Export
        </Button>
        <Button onClick={() => setEditing({})}>
          <Plus /> Add expense
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description or category" className="pl-9" />
        </div>
        <Select className="w-40" value={params.category ?? ''} onChange={(e) => patch({ category: e.target.value, page: null })} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Input type="date" className="w-40" value={params.from ?? ''} onChange={(e) => patch({ from: e.target.value, page: null })} aria-label="From" />
        <Input type="date" className="w-40" value={params.to ?? ''} onChange={(e) => patch({ to: e.target.value, page: null })} aria-label="To" />
      </div>

      <Card>
        {isPending ? (
          <div className="grid gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={Wallet} title={filtered ? 'No matching expenses' : 'No expenses yet'} description={filtered ? 'Try a different search or date range.' : 'Record rent, salaries and supplies to see your profit in Analytics.'}>
            {!filtered && <Button onClick={() => setEditing({})}>Add expense</Button>}
          </EmptyState>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Description</TH>
                  <TH className="hidden sm:table-cell">Category</TH>
                  <TH className="hidden md:table-cell">Paid by</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <tbody>
                {data.items.map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap tabular">{date(e.spent_on)}</TD>
                    <TD>
                      <p className="font-medium">{e.description}</p>
                      {e.staff_name && <p className="text-xs text-muted-foreground">Added by {e.staff_name}</p>}
                    </TD>
                    <TD className="hidden text-muted-foreground sm:table-cell">{e.category}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{METHOD[e.method]}</TD>
                    <TD className="text-right font-medium whitespace-nowrap tabular">{money(e.amount)}</TD>
                    <TD className="text-right">
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Expense actions">
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem onSelect={() => setEditing(e)}>
                            <Pencil /> Edit
                          </MenuItem>
                          <MenuItem danger onSelect={() => confirm(`Delete ${money(e.amount)} for “${e.description}”?`) && remove.mutate(e.id)}>
                            <Trash2 /> Delete
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} size={SIZE} total={data.total} onPage={(n) => patch({ page: n })} />
          </>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing?.id ? 'Edit expense' : 'Add expense'}>{editing && <ExpenseForm expense={editing.id ? editing : null} onDone={() => setEditing(null)} />}</DialogContent>
      </Dialog>
    </>
  )
}
