import { useTripStore } from '@/store/trip'
import { ui, type ToolId } from '@/store/ui'

const TOOLS: { id: ToolId; kanji: string; label: string }[] = [
  { id: 'phrases', kanji: '言葉', label: 'מילון כיס' },
  { id: 'checklist', kanji: '持物', label: 'רשימות' },
  { id: 'emergency', kanji: '緊急', label: 'חירום' },
]

/** Three pocket tools, as kanji tiles. */
export function Toolkit() {
  const checklist = useTripStore((state) => state.checklist)
  const open = checklist.filter((item) => !item.done).length

  return (
    <div className="grid grid-cols-3 gap-3">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => ui.openTool(tool.id)}
          className="surface relative flex h-[5.6rem] flex-col justify-between overflow-hidden rounded-3xl p-3 text-start transition active:scale-[0.96]"
        >
          <span
            lang="ja"
            aria-hidden
            className={
              tool.id === 'emergency'
                ? 'font-jp text-[1.55rem] leading-none font-extrabold text-accent'
                : 'font-jp text-[1.55rem] leading-none font-extrabold text-fg/85'
            }
          >
            {tool.kanji}
          </span>
          <span className="flex items-center justify-between gap-1 text-sm font-semibold">
            {tool.label}
            {tool.id === 'checklist' && open > 0 && (
              <span className="rounded-full bg-fg/8 px-1.5 text-[11px] font-bold text-muted tabular-nums">{open}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
