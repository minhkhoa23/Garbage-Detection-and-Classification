type AppFooterProps = {
  classCount: number
}

export default function AppFooter({ classCount }: AppFooterProps) {
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 font-mono text-[9px] tracking-[0.08em] text-text-dim sm:px-8">
      <span className="tracking-[0.1em]">
        GOD · Garbage Object Detection System
      </span>
      <span className="text-right">
        Backend-configured detector · {classCount} classes
      </span>
    </footer>
  )
}
