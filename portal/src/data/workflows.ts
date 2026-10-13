/**
 * Ready-made workflows. A studio picks one or more in setup and can add more in Settings → Workflow;
 * every project then follows one of them.
 */
import { DEFAULT_STAGES } from './defaults'
import type { StageDef, Workflow } from './types'

export type WorkflowPreset = { id: string; name: string; studio: string; hint: string; stages: StageDef[] }

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  { id: 'brand', name: 'Brand & design', studio: 'Brand & design studio', hint: 'Identity, packaging, campaigns', stages: DEFAULT_STAGES },
  {
    id: 'web',
    name: 'Web',
    studio: 'Web studio',
    hint: 'Websites and digital products',
    stages: [
      { id: 'st-kickoff', name: 'Kick-off', colour: '#9a9993' },
      { id: 'st-wireframes', name: 'Wireframes', colour: '#c08a2e' },
      { id: 'st-design', name: 'Design', colour: '#1a4dff' },
      { id: 'st-build', name: 'Build', colour: '#8a4fff' },
      { id: 'st-launch', name: 'Launch', colour: '#e0673a', delivery: true },
      { id: 'st-live', name: 'Live', colour: '#2f7a4a' },
    ],
  },
  {
    id: 'motion',
    name: 'Motion',
    studio: 'Motion studio',
    hint: 'Film, animation, social video',
    stages: [
      { id: 'st-brief', name: 'Brief', colour: '#9a9993' },
      { id: 'st-script', name: 'Script', colour: '#c08a2e' },
      { id: 'st-storyboard', name: 'Storyboard', colour: '#8a4fff' },
      { id: 'st-animation', name: 'Animation', colour: '#1a4dff' },
      { id: 'st-delivery', name: 'Delivery', colour: '#e0673a', delivery: true },
      { id: 'st-done', name: 'Done', colour: '#2f7a4a' },
    ],
  },
  {
    id: 'production',
    name: 'Sales & production',
    studio: 'Sales & production',
    hint: 'Graphics for things that are sold',
    stages: [
      { id: 'st-sold', name: 'Sold', colour: '#9a9993' },
      { id: 'st-brief', name: 'Brief received', colour: '#c08a2e' },
      { id: 'st-production', name: 'In production', colour: '#1a4dff' },
      { id: 'st-approval', name: 'Sent for approval', colour: '#8a4fff' },
      { id: 'st-approved', name: 'Approved', colour: '#e0673a', delivery: true },
      { id: 'st-delivered', name: 'Delivered', colour: '#2f7a4a' },
    ],
  },
]

/** For work that isn't any of the above: plain stages to rename. */
export const BLANK_STAGES: StageDef[] = [
  { id: 'st-start', name: 'Start', colour: '#9a9993' },
  { id: 'st-progress', name: 'In progress', colour: '#1a4dff' },
  { id: 'st-review', name: 'Review', colour: '#8a4fff' },
  { id: 'st-delivered', name: 'Delivered', colour: '#e0673a', delivery: true },
  { id: 'st-done', name: 'Done', colour: '#2f7a4a' },
]

const uid = () => Math.random().toString(36).slice(2, 8)

/** A new workflow from a preset (or blank, with its own name). Ids never clash with existing ones. */
export function workflowFrom(preset: WorkflowPreset | { name: string }, taken: string[] = []): Workflow {
  const base = 'id' in preset ? `wf-${preset.id}` : `wf-${uid()}`
  const id = taken.includes(base) ? `${base}-${uid()}` : base
  return { id, name: preset.name, stages: ('stages' in preset ? preset.stages : BLANK_STAGES).map((s) => ({ ...s })) }
}
