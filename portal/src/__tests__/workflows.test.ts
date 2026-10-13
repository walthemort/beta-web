/** Studios that do more than one kind of work: several workflows, each project on one of them. */
import { describe, expect, it } from 'vitest'
import { deliveryIndex, isComplete, reducer, stageName, stageProgress, workflowOf, type Action } from '../data/store'
import { seed } from '../data/seed'
import { WORKFLOW_PRESETS, workflowFrom } from '../data/workflows'
import { guessWorkflow } from '../app/shared'
import type { State } from '../data/types'

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s)
const fresh = (): State => JSON.parse(JSON.stringify(seed))
const web = workflowFrom(WORKFLOW_PRESETS.find((p) => p.id === 'web')!)

/** The sample studio plus a web workflow, with NORD moved onto it. */
function twoFlows() {
  const s0 = fresh()
  const s = run(s0, { type: 'setWorkflows', workflows: [...s0.studio.workflows, web] })
  return run(s, { type: 'updateProject', id: 'p-nord', patch: { workflowId: web.id, stage: 3 } })
}
const p = (s: State, id: string) => s.projects.find((x) => x.id === id)!

describe('several workflows', () => {
  it('give each project the stages of its own workflow', () => {
    const s = twoFlows()
    expect(stageName(s, 3, p(s, 'p-nord'))).toBe('Build')
    expect(stageName(s, 3, p(s, 'p-ray'))).toBe('Design')
    expect(workflowOf(s, p(s, 'p-ray')).id).toBe(s.studio.workflows[0].id)
  })

  it('work out delivery, completion and progress per workflow', () => {
    const s = twoFlows()
    expect(deliveryIndex(s, p(s, 'p-nord'))).toBe(4) // Launch
    const done = run(s, { type: 'setStage', id: 'p-nord', stage: 5 })
    expect(isComplete(done, p(done, 'p-nord'))).toBe(true)
    expect(stageProgress(p(done, 'p-nord'), done)).toBe(100)
  })

  it('only move the projects on the workflow whose stages change', () => {
    const s = twoFlows()
    const next = run(s, { type: 'setStages', workflowId: web.id, stages: web.stages.filter((x) => x.name !== 'Wireframes') })
    expect(stageName(next, p(next, 'p-nord').stage, p(next, 'p-nord'))).toBe('Build')
    expect(p(next, 'p-ray').stage).toBe(p(s, 'p-ray').stage)
  })

  it('move projects to the first workflow when theirs is deleted, at the same point in the work', () => {
    const s = twoFlows()
    const next = run(s, { type: 'setWorkflows', workflows: [s.studio.workflows[0]] })
    expect(p(next, 'p-nord').workflowId).toBe(s.studio.workflows[0].id)
    expect(p(next, 'p-nord').stage).toBe(3) // 3 of 5 → 3 of 5
  })

  it('never create two workflows with the same id, and guess a workflow from the service', () => {
    const a = workflowFrom(WORKFLOW_PRESETS[0])
    const b = workflowFrom(WORKFLOW_PRESETS[0], [a.id])
    expect(a.id).not.toBe(b.id)
    const flows = [workflowFrom(WORKFLOW_PRESETS[0]), web]
    expect(guessWorkflow(flows, 'Web')?.id).toBe(web.id)
    expect(guessWorkflow(flows, 'Brand identity')?.id).toBe(flows[0].id)
  })
})
