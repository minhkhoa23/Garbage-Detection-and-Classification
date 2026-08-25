type CategoryBadgeProps = {
  category: string
  color: string
}

export default function CategoryBadge({ category, color }: CategoryBadgeProps) {
  return (
    <span
      className="rounded-[2px] border px-1.5 py-px font-mono text-[9px] tracking-[0.12em] uppercase"
      style={{
        color,
        background: `${color}18`,
        borderColor: `${color}40`,
      }}
    >
      {category}
    </span>
  )
}
