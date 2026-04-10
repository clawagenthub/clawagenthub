'use client'

import { ProjectList } from '@/components/projects/project-list'
import type { PageContentProps } from './index'
import logger from "@/lib/logger/index.js"


export function ProjectsPageContent({ user: _user }: PageContentProps) {
  logger.info('[ProjectsPageContent] Rendering projects page')

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold"
          style={{ color: `rgb(var(--text-primary))` }}
        >
          Projects
        </h1>
        <p className="mt-2" style={{ color: `rgb(var(--text-secondary))` }}>
          Manage workspace projects to help organize and contextually tag tickets
        </p>
      </div>

      <ProjectList />
    </div>
  )
}