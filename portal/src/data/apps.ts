/**
 * Aftryk's apps: extra tools that run on a client's brand hub. Pro picks three, Studio has them
 * all (see hasApp in plans.ts). Names and texts are English; they're translated where shown.
 */
import type { AppId } from './types'

export type AppCategory = 'make' | 'share' | 'clients'

export const APP_CATEGORIES: { id: AppCategory; name: string }[] = [
  { id: 'make', name: 'Make' },
  { id: 'share', name: 'Share & publish' },
  { id: 'clients', name: 'Win & keep clients' },
]

export type AppInfo = {
  id: AppId
  name: string
  category: AppCategory
  tagline: string
  /** Where the app opens. */
  to: string
  points: string[]
}

export const APPS: AppInfo[] = [
  {
    id: 'contentMachine',
    category: 'make',
    name: 'Content Machine',
    tagline: 'Posts, banners, print and motion on your clients’ brands',
    to: '/app/content',
    points: ['Every colour, font and logo from the brand hub', 'Print-ready PDFs with bleed and crop marks', 'Animated posts as MP4 for Reels and Stories'],
  },
  {
    id: 'mockups',
    category: 'make',
    name: 'Mockups',
    tagline: 'Show the work in 3D on business cards, posters, phones and mugs',
    to: '/app/mockups',
    points: ['Real 3D scenes – drag to turn, pick the light', 'Design it in the right size with the Content Machine', 'Or on your own photo – drag the corners into place'],
  },
  {
    id: 'presenter',
    category: 'make',
    name: 'Presenter',
    tagline: 'PowerPoint, Google Slides and Word templates from the brand hub',
    to: '/app/presenter',
    points: ['Slide layouts in the brand’s colours and fonts', 'A Word letterhead with the logo', 'Ready for the client’s whole team'],
  },
  {
    id: 'socialPlanner',
    category: 'share',
    name: 'Social Planner',
    tagline: 'Plan posts in the calendar and have the client approve them',
    to: '/app/calendar/social',
    points: ['Posts with design and caption, day by day', 'The client approves in their portal', 'Copy, download, mark as posted'],
  },
  {
    id: 'pages',
    category: 'share',
    name: 'Pages',
    tagline: 'Link-in-bio, coming-soon and campaign pages on the client’s brand',
    to: '/app/pages',
    points: ['Blocks for links, text, images, countdowns and sign-ups', 'Always in the brand’s colours and fonts', 'Online on its own address'],
  },
  {
    id: 'assistant',
    category: 'clients',
    name: 'Brand Assistant',
    tagline: 'An AI in the client portal that knows the brand inside out',
    to: '/app/assistant',
    points: ['Answers “can I…?” from the brand hub’s rules', 'Writes in the brand’s tone of voice', 'Less “quick question” email for the studio'],
  },
  {
    id: 'audit',
    category: 'clients',
    name: 'Brand Audit',
    tagline: 'How on-brand is a website? A report in a minute',
    to: '/app/audit',
    points: ['Colours, fonts, images and the basics checked', 'Compared with a client’s brand hub', 'A strong opener for new clients'],
  },
]

export const appInfo = (id: AppId) => APPS.find((a) => a.id === id)!
