/** Building projects and proposals from templates, and duplicating projects. */
import { emptyHub } from './defaults'
import { discoveryFrom } from './seed'
import { translate } from './i18n'
import { now, uid } from './store'
import type { Project, ProjectTemplate, Proposal, ProposalTemplate, State } from './types'

const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 864e5).toISOString().slice(0, 10)

export function proposalFromTemplate(tpl: ProposalTemplate | undefined, projectId: string, clientName: string): Proposal {
  const line = (i: { description: string; qty: number; price: number }) => ({ ...i, id: uid() })
  return {
    id: uid(),
    projectId,
    title: `A new chapter for ${clientName}`,
    intro: tpl?.intro ?? '',
    sections: (tpl?.sections ?? [{ title: 'The challenge', body: '' }, { title: 'Our approach', body: '' }, { title: 'Timeline', body: '' }]).map((s) => ({ ...s, id: uid() })),
    items: (tpl?.items ?? [{ description: '', qty: 1, price: 0 }]).map(line),
    packages: (tpl?.packages ?? []).map((p) => ({ ...p, id: uid(), items: p.items.map(line) })),
    addons: (tpl?.addons ?? []).map(line),
    paymentPlan: (tpl?.paymentPlan ?? [{ label: '50% at start', percent: 50, trigger: 'On signing' as const }, { label: '50% at delivery', percent: 50, trigger: 'At delivery' as const }]).map((p) => ({ ...p, id: uid() })),
    chosenAddonIds: [],
    status: 'Draft',
    createdAt: now(),
  }
}

/** A proposal saved as a reusable template. */
export function templateFromProposal(p: Proposal, name: string): ProposalTemplate {
  const strip = ({ description, qty, price }: { description: string; qty: number; price: number }) => ({ description, qty, price })
  return {
    id: uid(),
    name,
    intro: p.intro,
    sections: p.sections.map(({ title, body }) => ({ title, body })),
    items: p.items.map(strip),
    packages: p.packages.map((k) => ({ name: k.name, description: k.description, recommended: k.recommended, items: k.items.map(strip) })),
    addons: p.addons.map(strip),
    paymentPlan: p.paymentPlan.map(({ label, percent, trigger }) => ({ label, percent, trigger })),
  }
}

export function projectFromTemplate(
  tpl: ProjectTemplate | undefined,
  fields: Pick<Project, 'name' | 'clientId' | 'service' | 'startDate' | 'due' | 'cover' | 'memberIds'>,
): Project {
  return {
    id: uid(),
    ...fields,
    tagline: '',
    description: tpl?.description ?? '',
    stage: 0,
    tasks: (tpl?.tasks ?? []).map((t) => ({
      id: uid(),
      title: t.title,
      done: false,
      due: t.offsetDays !== undefined ? addDays(fields.startDate, t.offsetDays) : undefined,
    })),
    hub: emptyHub(),
    discovery: tpl ? { questions: tpl.questions.map((q) => ({ id: uid(), q: translate(q), a: '' })) } : discoveryFrom([], true),
    notes: '',
    budgetHours: tpl?.budgetHours,
    roundsIncluded: tpl?.roundsIncluded ?? 2,
    onboarding: { welcome: '' },
    updatedAt: now(),
  }
}

/** Copies a project's setup for a returning client — no files, feedback or history. */
export function duplicateProject(s: State, p: Project): { project: Project; proposal?: Proposal } {
  const project: Project = {
    ...p,
    id: uid(),
    name: `${p.name} (copy)`,
    stage: 0,
    startDate: now().slice(0, 10),
    due: undefined,
    tasks: p.tasks.map((t) => ({ ...t, id: uid(), done: false, due: undefined })),
    discovery: { questions: p.discovery.questions.map((q) => ({ ...q, id: uid(), a: '' })) },
    hub: { ...p.hub, access: {}, updatedAt: now() },
    onboarding: { welcome: p.onboarding.welcome },
    archived: false,
    caseStudy: undefined,
    sample: false,
    updatedAt: now(),
  }
  const old = s.proposals.find((x) => x.projectId === p.id)
  const proposal = old
    ? {
        ...old,
        id: uid(),
        projectId: project.id,
        status: 'Draft' as const,
        sentAt: undefined,
        respondedAt: undefined,
        respondedBy: undefined,
        chosenPackageId: undefined,
        chosenAddonIds: [],
        paymentPlan: old.paymentPlan.map((x) => ({ ...x, id: uid(), invoiceId: undefined })),
        createdAt: now(),
      }
    : undefined
  return { project, proposal }
}
