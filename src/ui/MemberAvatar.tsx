import type { Member } from '../domain/types'

export function MemberAvatar({ member, size = 40 }: { member: Member; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[#1c3025]"
      style={{ backgroundColor: member.color, width: size, height: size, fontSize: size * 0.45 }}
    >
      {member.name.charAt(0).toUpperCase()}
    </span>
  )
}
