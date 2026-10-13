/** Plans: what each includes, limits, and studios that unlocked things before plans existed. */
import { describe, expect, it } from 'vitest'
import { seed } from '../data/seed'
import { PLANS, appSlots, canAdd, formatPrice, hasApp, hasFeature, isPlanId, planFor, planOf, usage } from '../data/plans'
import { APPS } from '../data/apps'
import type { State } from '../data/types'

const fresh = (plan?: State['studio']['plan']): State => {
  const s: State = JSON.parse(JSON.stringify(seed))
  s.studio.plan = plan
  return s
}

describe('plans', () => {
  it('start everyone on Free, and unlock more the higher you go', () => {
    expect(planOf(fresh()).id).toBe('free')
    expect(hasFeature(fresh(), 'contentMachine')).toBe(false)
    expect(hasFeature(fresh('studio'), 'contentMachine')).toBe(true)
    expect(hasFeature(fresh('pro'), 'whiteLabel')).toBe(false)
    expect(hasFeature(fresh('studio'), 'whiteLabel')).toBe(true)
    // Every higher plan includes everything the one below it has, and more room.
    for (let i = 1; i < PLANS.length; i++) {
      for (const f of PLANS[i - 1].features) expect(PLANS[i].features).toContain(f)
      expect(PLANS[i].limits.storageGb).toBeGreaterThan(PLANS[i - 1].limits.storageGb)
      expect(PLANS[i].limits.apps).toBeGreaterThan(PLANS[i - 1].limits.apps)
    }
  })

  it('give Free no apps, Pro the three it picks and Studio all of them', () => {
    expect(appSlots(fresh())).toMatchObject({ limit: 0, on: [], left: 0 })
    const pro = fresh('pro')
    expect(appSlots(pro).left).toBe(3)
    expect(hasApp(pro, 'mockups')).toBe(false)
    pro.studio.apps = ['mockups', 'contentMachine']
    expect(hasApp(pro, 'mockups')).toBe(true)
    expect(hasFeature(pro, 'contentMachine')).toBe(true)
    expect(hasApp(pro, 'pages')).toBe(false)
    expect(appSlots(pro).left).toBe(1)
    // More than the plan allows (after moving down from Studio): the first three count; unknown ids don't.
    pro.studio.apps = ['nope' as never, 'pages', 'audit', 'assistant', 'mockups']
    expect(appSlots(pro).on).toEqual(['pages', 'audit', 'assistant'])
    expect(hasApp(pro, 'mockups')).toBe(false)
    const studio = fresh('studio')
    for (const a of APPS) expect(hasApp(studio, a.id)).toBe(true)
    expect(appSlots(studio).left).toBe(Infinity)
  })

  it('offer the cheapest plan that has a feature', () => {
    expect(planFor('customDomain').id).toBe('pro')
    expect(planFor('hubHosting').id).toBe('studio')
  })

  it('keep the Content Machine for studios that unlocked it in the beta', () => {
    const s = fresh()
    s.studio.addons = { contentMachine: { since: '2026-09-25' } }
    expect(hasFeature(s, 'contentMachine')).toBe(true)
    expect(hasFeature(s, 'aiDrafts')).toBe(false)
  })

  it('count the studio’s own active projects against the plan – not the sample projects', () => {
    const s = fresh()
    s.projects = s.projects.map((p) => ({ ...p, sample: true }))
    expect(usage(s).activeProjects).toBe(0)
    const own = s.projects.slice(0, 3).map((p) => ({ ...p, id: p.id + '-own', sample: false, archived: false, stage: 1 }))
    s.projects = [...s.projects, ...own]
    expect(usage(s).activeProjects).toBe(3)
    expect(canAdd(s, 'activeProjects')).toBe(false) // Free has 3
    expect(canAdd({ ...s, studio: { ...s.studio, plan: 'pro' } }, 'activeProjects')).toBe(true)
    s.projects[s.projects.length - 1].archived = true
    expect(canAdd(s, 'activeProjects')).toBe(true)
    expect(canAdd(fresh('studio'), 'members')).toBe(true)
  })

  it('have a price in each currency, going up with each plan, and read a plan from a link', () => {
    for (const c of ['usd', 'dkk'] as const) {
      expect(PLANS[0].prices[c]).toBe(0)
      for (let i = 1; i < PLANS.length; i++) expect(PLANS[i].prices[c]).toBeGreaterThan(PLANS[i - 1].prices[c])
    }
    expect(formatPrice(39, 'usd')).toBe('$39')
    expect(formatPrice(249, 'dkk')).toBe('249 kr.')
    expect(isPlanId('pro')).toBe(true)
    expect(isPlanId('enterprise')).toBe(false)
  })
})
