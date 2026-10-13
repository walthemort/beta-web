/**
 * Upgrading saved data. These rules decide whether a studio keeps its work after an update,
 * so they're tested against old save formats.
 */
import { describe, expect, it } from 'vitest'
import { normalizeState } from '../data/defaults'
import { seed } from '../data/seed'
import type { State } from '../data/types'

/** Old saves don’t match today’s types – that’s the point – so they’re handled loosely here. */
type Raw = Record<string, any>
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))

/** A save from before setup/teams/stages existed. */
function oldSave(): Raw {
  const s: Raw = clone(seed)
  delete s.studio.setupDone
  delete s.studio.workflows
  delete s.team
  delete s.currentMemberId
  return s
}

describe('first-time setup flag', () => {
  it('a brand-new studio (the sample seed) is not set up yet', () => {
    expect(seed.studio.setupDone).toBe(false)
  })

  it('existing saves without the flag count as set up (they must not see the wizard)', () => {
    expect(normalizeState(oldSave() as State & Raw, seed).studio.setupDone).toBe(true)
  })

  it('an explicit “not set up yet” is kept', () => {
    const raw = oldSave()
    raw.studio.setupDone = false
    expect(normalizeState(raw as State & Raw, seed).studio.setupDone).toBe(false)
  })
})

describe('upgrading old saves', () => {
  it('fills in default stages when a save has none', () => {
    const s = normalizeState(oldSave() as State & Raw, seed)
    expect(s.studio.workflows).toHaveLength(1)
    expect(s.studio.workflows[0].stages.map((x) => x.name)).toEqual(['Onboarding', 'Discovery', 'Strategy', 'Design', 'Delivery', 'Complete'])
  })

  it('turns a save’s own list of stages into its first workflow, keeping every project in place', () => {
    const raw = oldSave()
    raw.studio.stages = [
      { id: 'a', name: 'Brief', colour: '#999999' },
      { id: 'b', name: 'Making', colour: '#1a4dff' },
      { id: 'c', name: 'Shipped', colour: '#2f7a4a' },
    ]
    raw.projects[0].stage = 1
    const s = normalizeState(raw as State & Raw, seed)
    expect(s.studio.workflows.map((w) => w.stages.map((x) => x.name))).toEqual([['Brief', 'Making', 'Shipped']])
    expect(s.projects[0].stage).toBe(1)
    expect('stages' in s.studio).toBe(false)
  })

  it('gives saves without a team the sample team, with the studio owner’s own name', () => {
    const raw = oldSave()
    raw.studio.owner = 'Ida Owner'
    const s = normalizeState(raw as State & Raw, seed)
    expect(s.team.find((m) => m.role === 'Owner')?.name).toBe('Ida Owner')
    expect(s.team.some((m) => m.id === s.currentMemberId)).toBe(true)
  })

  it('keeps a project’s stage inside the list of stages', () => {
    const raw = oldSave()
    const projects: State['projects'] = raw.projects
    projects[0].stage = 42
    const s = normalizeState(raw as State & Raw, seed)
    expect(s.projects[0].stage).toBe(s.studio.workflows[0].stages.length - 1)
  })

  it('never throws away the studio’s own projects and invoices', () => {
    const raw = oldSave()
    const s = normalizeState(raw as State & Raw, seed)
    expect(s.projects.map((p) => p.id)).toEqual((raw.projects as State['projects']).map((p) => p.id))
    expect(s.invoices.map((i) => i.number)).toEqual((raw.invoices as State['invoices']).map((i) => i.number))
  })

  it('adds new collections (decks, choices, notifications…) as empty lists', () => {
    const raw = oldSave()
    delete raw.decks
    delete raw.notifications
    delete raw.outbox
    const s = normalizeState(raw as State & Raw, seed)
    expect(s.decks).toEqual([])
    expect(s.notifications).toEqual([])
    expect(s.outbox).toEqual([])
  })
})
