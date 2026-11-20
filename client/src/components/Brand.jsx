export default function Brand({ light = false }) {
  return <div className="flex items-center gap-3">
    <span className={`flex size-11 items-center justify-center rounded-xl ${light ? 'bg-white/15 text-white' : 'bg-green-700 text-white'}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" /></svg>
    </span>
    <span className={`text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-green-950'}`}>TGP Pharmacy</span>
  </div>
}
