import type { Member } from '../domain/types'

export function MemberAvatar({ member, size = 40 }: { member: Member; size?: number }) {
  const hex = member.color.replace('#', '')
  const rgb = /^[0-9a-f]{6}$/i.test(hex) ? [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255) : [1, 1, 1]
  const luminance = rgb.reduce((sum, value, index) => sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]!, 0)
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[#1c3025]"
      style={{ backgroundColor: member.color, color: luminance < 0.3 ? '#ffffff' : '#0b1c30', width: size, height: size, fontSize: size * 0.45 }}
    >
      {member.name.charAt(0).toUpperCase()}
    </span>
  )
}
