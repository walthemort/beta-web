import { ListChecks } from 'lucide-react'
import { uid, useCurrentMember, useStore } from '../data/store'
import type { Comment, Project } from '../data/types'
import { useT } from '../data/i18n'

/**
 * Turns a round of client comments into a checklist on the project, assigned to whoever
 * is working. Ticking a task off later resolves the comment it came from.
 */
export function FeedbackToTasks({ project, comments, source }: { project: Project; comments: Comment[]; source: string }) {
  const t = useT()
  const { dispatch } = useStore()
  const me = useCurrentMember()
  const taken = new Set(project.tasks.map((x) => x.fromCommentId).filter(Boolean))
  const open = comments.filter((c) => c.fromClient && !c.resolved && !c.parentId && !taken.has(c.id) && c.text.trim())
  if (!open.length) return null
  const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
  function make() {
    for (const c of open) {
      const text = c.text.trim().replace(/\s+/g, ' ')
      dispatch({
        type: 'addTask',
        projectId: project.id,
        task: { id: uid(), title: `${source}: ${text.length > 90 ? text.slice(0, 88) + '…' : text}`, done: false, due, assigneeId: me.id, fromCommentId: c.id },
      })
    }
    dispatch({ type: 'log', log: { text: `${open.length} client comment${open.length > 1 ? 's' : ''} on ${source} turned into tasks`, projectId: project.id } })
  }
  return (
    <button className="btn btn-sm" onClick={make} title={t('Each open client comment becomes a task for you, due in 3 days. Finishing a task resolves its comment.')}>
      <ListChecks size={14} /> {open.length === 1 ? t('Turn 1 comment into a task') : t('Turn {n} comments into tasks', { n: open.length })}
    </button>
  )
}
