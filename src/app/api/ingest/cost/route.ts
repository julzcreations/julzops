import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type ModelUsage = {
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  costUsd: number
}

type Payload = {
  projectSlug: string
  source: string
  workflowTitle: string
  startedAt: string
  endedAt?: string
  durationMs?: number
  status: 'success' | 'failure' | 'running'
  runUrl?: string
  metadata?: Record<string, unknown>
  usage: {
    totalUsd: number
    byModel: Record<string, ModelUsage>
  }
}

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.JULZOPS_INGEST_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized()

  let body: Payload
  try {
    body = (await req.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body?.projectSlug || !body?.source || !body?.usage?.byModel) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { slug: body.projectSlug } })
  if (!project) {
    return NextResponse.json({ error: 'unknown_project', slug: body.projectSlug }, { status: 404 })
  }

  const startedAt = new Date(body.startedAt)
  const endedAt = body.endedAt ? new Date(body.endedAt) : null

  // One CostSample per model used + one Event summarizing the run.
  const costRows = Object.entries(body.usage.byModel).map(([model, u]) => ({
    projectId: project.id,
    source: body.source,
    model,
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadTokens: u.cacheReadTokens ?? 0,
    cacheWriteTokens: u.cacheWriteTokens ?? 0,
    costUsd: u.costUsd,
    sampledAt: startedAt,
  }))

  const [costs, event] = await prisma.$transaction([
    prisma.costSample.createMany({ data: costRows }),
    prisma.event.create({
      data: {
        projectId: project.id,
        source: body.source,
        kind: 'workflow_run',
        status: body.status,
        title: body.workflowTitle,
        url: body.runUrl ?? null,
        metadata: {
          ...body.metadata,
          totalCostUsd: body.usage.totalUsd,
          modelsUsed: Object.keys(body.usage.byModel),
        },
        startedAt,
        endedAt,
        durationMs: body.durationMs ?? null,
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    costSamplesInserted: costs.count,
    totalUsd: body.usage.totalUsd,
  })
}
