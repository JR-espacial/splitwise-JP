import type { Member } from '../domain/types'
import { MemberAvatar } from '../ui/MemberAvatar'

export function IdentityScreen({
  members,
  onSelect,
}: {
  members: Member[]
  onSelect: (memberId: string) => void
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Roadtrip Europa 2026</h1>
        <p className="mt-2 text-slate-600">¿Quién eres?</p>
      </div>
      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => onSelect(member.id)}
              className="flex min-h-14 w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 text-lg font-semibold text-slate-900 shadow-sm active:bg-slate-100"
            >
              <MemberAvatar member={member} />
              {member.name}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
