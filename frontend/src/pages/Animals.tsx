import { PawPrint, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../api/client'
import { animalApi } from '../api/endpoints'
import type { Animal } from '../api/types'
import { Button } from '../components/ui/Button'
import { Card, PageHeader } from '../components/ui/Card'
import { control, Input, Textarea } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { Table, Td, Th } from '../components/ui/Table'
import { useWorkspace } from '../context/workspace'
import { useAsync } from '../hooks/useAsync'

function formatAge(months: number | null) {
  if (months === null) return '—'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} mo`
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`
}

export default function Animals() {
  const { workspace, isAdmin } = useWorkspace()
  const { data, error, loading, reload } = useAsync(() => animalApi.list(workspace.id), [workspace.id])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Animal | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Animal | null>(null)

  const q = search.trim().toLowerCase()
  const rows = data?.filter((a) => !q || [a.tag_id, a.name, a.breed].some((v) => v?.toLowerCase().includes(q))) ?? []

  return (
    <div>
      <PageHeader
        title="Animals"
        description="A simple register of your animals. Records are kept by hand; cows are not identified individually from video."
        actions={
          isAdmin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
              Add animal
            </Button>
          )
        }
      />
      <Card>
        {data && data.length > 0 && (
          <div className="px-6 py-4">
            <label htmlFor="animal-search" className="sr-only">
              Search animals
            </label>
            <div className="relative max-w-narrow">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
              <input
                id="animal-search"
                type="search"
                placeholder="Search tag, name or breed"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${control} h-9 pl-9`}
              />
            </div>
          </div>
        )}
        {loading ? (
          <Loading />
        ) : !data ? (
          <ErrorState message={error ?? ''} onRetry={reload} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="No animals registered"
            description={isAdmin ? 'Add your animals to keep their details in one place.' : 'A workspace admin can add animals.'}
            action={isAdmin && <Button onClick={() => setEditing('new')}>Add animal</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No matches" description="No animal matches your search." />
        ) : (
          <Table label="Animals">
            <thead>
              <tr>
                <Th>Tag ID</Th>
                <Th>Name</Th>
                <Th>Breed</Th>
                <Th>Age</Th>
                <Th>Notes</Th>
                {isAdmin && (
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <Td className="numeric text-xs">{a.tag_id}</Td>
                  <Td>{a.name ?? '—'}</Td>
                  <Td>{a.breed ?? '—'}</Td>
                  <Td className="whitespace-nowrap">{formatAge(a.age_months)}</Td>
                  <Td className="max-w-72 min-w-40 truncate text-secondary" title={a.notes ?? undefined}>
                    {a.notes ?? '—'}
                  </Td>
                  {isAdmin && (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" aria-label={`Edit ${a.tag_id}`} onClick={() => setEditing(a)}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={`Delete ${a.tag_id}`} onClick={() => setDeleting(a)}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && (
        <AnimalForm
          animal={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {deleting && (
        <DeleteAnimal
          animal={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function AnimalForm({ animal, onClose, onSaved }: { animal: Animal | null; onClose: () => void; onSaved: () => void }) {
  const { workspace } = useWorkspace()
  const [form, setForm] = useState({
    tag_id: animal?.tag_id ?? '',
    name: animal?.name ?? '',
    breed: animal?.breed ?? '',
    age_months: animal?.age_months?.toString() ?? '',
    notes: animal?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const age = form.age_months.trim() === '' ? null : Number(form.age_months)
    if (age !== null && (!Number.isInteger(age) || age < 0)) return setError('Age must be a whole number of months.')
    const body = {
      tag_id: form.tag_id.trim(),
      name: form.name.trim() || null,
      breed: form.breed.trim() || null,
      age_months: age,
      notes: form.notes.trim() || null,
    }
    setBusy(true)
    setError(null)
    try {
      if (animal) await animalApi.update(animal.id, body)
      else await animalApi.create(workspace.id, body)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={animal ? 'Edit animal' : 'Add animal'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="animal-form" loading={busy} disabled={!form.tag_id.trim()}>
            {animal ? 'Save changes' : 'Add animal'}
          </Button>
        </>
      }
    >
      <form id="animal-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="sm:col-span-2">
            <Notice>{error}</Notice>
          </div>
        )}
        <Input label="Tag ID" required maxLength={60} value={form.tag_id} onChange={set('tag_id')} placeholder="e.g. PK-0142" />
        <Input label="Name (optional)" maxLength={120} value={form.name} onChange={set('name')} />
        <Input label="Breed (optional)" maxLength={120} value={form.breed} onChange={set('breed')} placeholder="e.g. Sahiwal" />
        <Input label="Age in months (optional)" type="number" min={0} max={600} value={form.age_months} onChange={set('age_months')} />
        <Textarea label="Notes (optional)" wrapperClassName="sm:col-span-2" maxLength={2000} value={form.notes} onChange={set('notes')} />
      </form>
    </Modal>
  )
}

function DeleteAnimal({ animal, onClose, onDeleted }: { animal: Animal; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      open
      title="Delete animal"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await animalApi.remove(animal.id)
                onDeleted()
              } catch (e) {
                setError(errorMessage(e))
                setBusy(false)
              }
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Notice>{error}</Notice>
        </div>
      )}
      <p>
        Delete <strong>{animal.tag_id}</strong>
        {animal.name ? ` (${animal.name})` : ''} from the register? This can’t be undone.
      </p>
    </Modal>
  )
}
