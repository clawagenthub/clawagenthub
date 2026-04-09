import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ensureDatabase } from '@/lib/db/middleware.js'
import { getUserFromSession } from '@/lib/auth/session.js'
import { getDatabase } from '@/lib/db/index.js'
import logger, { logCategories } from '@/lib/logger/index.js'


// SkillsMP API client
const SKILLS_MP_API_BASE = 'https://skillsmp.com/api/v1'

// Console logging prefix for SkillsMP operations
const SKILLSMP_LOG_PREFIX = '[SkillsMP]'

interface SkillsMPSkill {
  id: string
  name: string
  description: string
  content?: string
  tags?: string[]
  url?: string
  author?: string
  updated_at?: string
  githubUrl?: string
  skillUrl?: string
  stars?: number
  updatedAt?: string
}

interface SkillsMPApiResponse {
  success: boolean
  data: {
    skills: SkillsMPSkill[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
      totalIsExact: boolean
    }
    filters?: {
      search: string
      sortBy: string
    }
  }
  meta?: {
    requestId: string
    responseTimeMs: number
  }
}

/**
 * Parse GitHub URL to extract owner, repo, branch, and path
 */
function parseGitHubUrl(githubUrl: string): {
  owner: string
  repo: string
  branch: string
  path: string
} {
  try {
    const url = new URL(githubUrl)
    const parts = url.pathname.split('/').filter(Boolean)
    
    let owner = ''
    let repo = ''
    let branch = 'main'
    let path = ''
    
    if (parts.length >= 2) {
      owner = parts[0]
      repo = parts[1]
    }
    
    const treeIndex = parts.indexOf('tree')
    const blobIndex = parts.indexOf('blob')
    
    if (treeIndex >= 0 && parts.length > treeIndex + 2) {
      branch = parts[treeIndex + 1]
      path = parts.slice(treeIndex + 2).join('/')
    } else if (blobIndex >= 0 && parts.length > blobIndex + 2) {
      branch = parts[blobIndex + 1]
      path = parts.slice(blobIndex + 2).join('/')
    }
    
    return { owner, repo, branch, path }
  } catch (error) {
    logger.error('Error parsing GitHub URL:', error)
    return { owner: '', repo: '', branch: 'main', path: '' }
  }
}

/**
 * Download a folder from GitHub recursively using the Contents API
 */
async function downloadGitHubFolder(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  localBasePath: string
): Promise<number> {
  const { mkdir, writeFile } = await import('fs/promises')
  const { join } = await import('path')
  
  let filesDownloaded = 0
  
  // Construct GitHub API URL
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  
  logger.debug(`${SKILLSMP_LOG_PREFIX} Fetching contents from: ${apiUrl}`)
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ClawAgentHub-SkillsMP-Importer',
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    
    if (!response.ok) {
      logger.warn(`${SKILLSMP_LOG_PREFIX} GitHub API error: ${response.status} ${response.statusText}`)
      return 0
    }
    
    const contents = await response.json()
    
    // Handle single file response
    if (!Array.isArray(contents)) {
      if (contents.type === 'file' && contents.download_url) {
        const fileResponse = await fetch(contents.download_url)
        if (fileResponse.ok) {
          const content = await fileResponse.text()
          const filePath = join(localBasePath, contents.name)
          await writeFile(filePath, content, 'utf-8')
          logger.debug(`${SKILLSMP_LOG_PREFIX} Downloaded file: ${contents.name} (${content.length} bytes)`)
          return 1
        }
      }
      return 0
    }
    
    // Process each item in the directory
    for (const item of contents) {
      if (item.type === 'file' && item.download_url) {
        // Download file
        try {
          const fileResponse = await fetch(item.download_url)
          if (fileResponse.ok) {
            const content = await fileResponse.text()
            const filePath = join(localBasePath, item.name)
            await writeFile(filePath, content, 'utf-8')
            logger.debug(`${SKILLSMP_LOG_PREFIX} Downloaded: ${item.path} (${content.length} bytes)`)
            filesDownloaded++
          } else {
            logger.warn(`${SKILLSMP_LOG_PREFIX} Failed to download file: ${item.path} (${fileResponse.status})`)
          }
        } catch (error) {
          logger.error(`${SKILLSMP_LOG_PREFIX} Error downloading file ${item.path}:`, error)
        }
      } else if (item.type === 'dir') {
        // Recursively download subdirectory
        try {
          const subDirPath = join(localBasePath, item.name)
          await mkdir(subDirPath, { recursive: true })
          
          const subFilesDownloaded = await downloadGitHubFolder(
            owner,
            repo,
            branch,
            item.path,
            subDirPath
          )
          filesDownloaded += subFilesDownloaded
        } catch (error) {
          logger.error(`${SKILLSMP_LOG_PREFIX} Error downloading directory ${item.path}:`, error)
        }
      }
    }
    
    return filesDownloaded
  } catch (error) {
    logger.error(`${SKILLSMP_LOG_PREFIX} Error fetching GitHub contents:`, error)
    return 0
  }
}

/**
 * GET /api/skills/marketplace/search
 * Search SkillsMP marketplace for skills
 * Query params: q (search query), page (default: 1), limit (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    await ensureDatabase()

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Fetch SkillsMP API key from workspace settings
    const apiKeySetting = db.prepare(
      'SELECT setting_value FROM workspace_settings WHERE workspace_id = ? AND setting_key = ?'
    ).get(session.current_workspace_id, 'skillsmp_api_key') as { setting_value: string } | undefined

    const apiKey = apiKeySetting?.setting_value

    logger.debug(`${SKILLSMP_LOG_PREFIX} Search query: "${query}"`)
    logger.debug(`${SKILLSMP_LOG_PREFIX} Workspace ID: ${session.current_workspace_id}`)
    logger.debug(`${SKILLSMP_LOG_PREFIX} API Key configured: ${!!apiKey}`)

    if (!apiKey) {
      logger.warn(`${SKILLSMP_LOG_PREFIX} API key not found in workspace settings`)
      return NextResponse.json({
        skills: [],
        total: 0,
        page,
        limit,
        message: 'SkillsMP API key not configured. Please add it in Settings > SkillsMP'
      }, { status: 400 })
    }

    // Search SkillsMP marketplace
    try {
      const searchUrl = `${SKILLS_MP_API_BASE}/skills/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}&sortBy=stars`
      
      logger.debug(`${SKILLSMP_LOG_PREFIX} Fetching from: ${searchUrl}`)

      const response = await fetch(searchUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      logger.debug(`${SKILLSMP_LOG_PREFIX} Response status: ${response.status}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        logger.warn(`${SKILLSMP_LOG_PREFIX} API error:`, errorData)
        
        // If SkillsMP API returns an error, return empty results with message
        return NextResponse.json({
          skills: [],
          total: 0,
          page,
          limit,
          message: errorData.error?.message || 'Marketplace temporarily unavailable'
        })
      }

      const apiResponse: SkillsMPApiResponse = await response.json()
      
      logger.debug(`${SKILLSMP_LOG_PREFIX} API Response:`, JSON.stringify(apiResponse, null, 2))

      // Extract skills from the nested data structure
      const skills = apiResponse.data?.skills || []
      const pagination = apiResponse.data?.pagination || { total: 0, page: 1, limit: 20 }

      return NextResponse.json({
        skills: skills.map(skill => ({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          content: skill.content || skill.description || '',
          tags: skill.tags || [],
          source: 'skillsmp',
          url: skill.skillUrl || skill.url || '',
          author: skill.author || 'Unknown',
          updated_at: skill.updatedAt || skill.updated_at,
          githubUrl: skill.githubUrl,
          stars: skill.stars,
        })),
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
      })
    } catch (fetchError) {
      // If fetch fails, return empty results
      logger.error(`${SKILLSMP_LOG_PREFIX} Fetch error:`, fetchError)
      return NextResponse.json({
        skills: [],
        total: 0,
        page,
        limit,
        message: 'Marketplace temporarily unavailable'
      })
    }
  } catch (error) {
    logger.error(`${SKILLSMP_LOG_PREFIX} Unexpected error:`, error)
    return NextResponse.json({ error: 'Failed to search marketplace' }, { status: 500 })
  }
}

/**
 * POST /api/skills/marketplace/import
 * Import a skill from SkillsMP marketplace
 * Body: { external_id, skill_name, skill_description, skill_data, tags }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureDatabase()

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session_token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    const user = getUserFromSession(sessionToken)

    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid session' },
        { status: 401 }
      )
    }

    const db = getDatabase()

    // Get user's current workspace
    const session = db
      .prepare('SELECT current_workspace_id FROM sessions WHERE token = ?')
      .get(sessionToken) as { current_workspace_id: string | null } | undefined

    if (!session?.current_workspace_id) {
      return NextResponse.json(
        { message: 'No workspace selected' },
        { status: 400 }
      )
    }

    // Verify workspace membership
    const member = db
      .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(session.current_workspace_id, user.id)

    if (!member) {
      return NextResponse.json(
        { message: 'Forbidden - Not a workspace member' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { external_id, skill_name, skill_description, skill_data, tags, github_url, skill_url } = body

    // Validate required fields
    if (!external_id || !skill_name) {
      return NextResponse.json(
        { error: 'external_id and skill_name are required' },
        { status: 400 }
      )
    }

    // Check if skill already imported (only check active skills)
    const existing = db.prepare('SELECT * FROM skills WHERE external_id = ? AND workspace_id = ? AND is_active = 1')
      .get(external_id, session.current_workspace_id)

    if (existing) {
      return NextResponse.json(
        { error: 'Skill already imported' },
        { status: 409 }
      )
    }

    // Generate ID
    const skillId = `skill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Prepare content and path
    let finalSkillData = skill_data || `${skill_name}\n\n${skill_description || ''}`
    let skillPath: string | null = null
    let isContentFromPath = false

    // If GitHub URL is provided, download the entire folder recursively
    if (github_url) {
      try {
        logger.debug(`${SKILLSMP_LOG_PREFIX} Downloading skill folder from GitHub: ${github_url}`)
        
        // Parse GitHub URL to extract owner, repo, branch, and path
        const { owner, repo, branch, path } = parseGitHubUrl(github_url)
        
        if (!owner || !repo) {
          logger.warn(`${SKILLSMP_LOG_PREFIX} Invalid GitHub URL format, using provided content`)
        } else {
          logger.debug(`${SKILLSMP_LOG_PREFIX} Parsed: owner=${owner}, repo=${repo}, branch=${branch}, path=${path}`)
          
          // Create local directory structure
          const { mkdir } = await import('fs/promises')
          const { join } = await import('path')
          
          const folderName = `${session.current_workspace_id}_${external_id}`
          const localBasePath = join(process.cwd(), `downloaded_skills/${folderName}`)
          
          // Create base directory
          await mkdir(localBasePath, { recursive: true })
          
          // Download folder contents recursively
          const downloadedFiles = await downloadGitHubFolder(
            owner,
            repo,
            branch,
            path,
            localBasePath
          )
          
          if (downloadedFiles > 0) {
            logger.debug(`${SKILLSMP_LOG_PREFIX} Successfully downloaded ${downloadedFiles} files to: downloaded_skills/${folderName}`)
            
            skillPath = `downloaded_skills/${session.current_workspace_id}_${external_id}/SKILL.md`
            isContentFromPath = true
            finalSkillData = `${skill_name}\n\n${skill_description || ''}` // Fallback content
          } else {
            logger.warn(`${SKILLSMP_LOG_PREFIX} No files downloaded, using provided content`)
          }
        }
      } catch (error) {
        logger.error(`${SKILLSMP_LOG_PREFIX} Error downloading from GitHub:`, error)
        // Continue with provided content
      }
    }

    // Insert imported skill
    const stmt = db.prepare(`
      INSERT INTO skills (
        id, workspace_id, skill_name, skill_description, skill_data,
        source, external_id, tags, path, is_content_from_path,
        github_url, skill_url, is_active, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : tags

    stmt.run(
      skillId,
      session.current_workspace_id,
      skill_name,
      skill_description || null,
      finalSkillData,
      'skillsmp',
      external_id,
      tagsJson || null,
      skillPath,
      isContentFromPath ? 1 : 0,
      github_url || null,
      skill_url || null,
      1,
      user.id
    )

    // Fetch created skill
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId) as any

    return NextResponse.json({
      skill: {
        id: skill.id,
        workspace_id: skill.workspace_id,
        skill_name: skill.skill_name,
        skill_description: skill.skill_description,
        skill_data: skill.skill_data,
        source: skill.source,
        external_id: skill.external_id,
        tags: skill.tags,
        path: skill.path,
        is_content_from_path: skill.is_content_from_path === 1,
        github_url: skill.github_url,
        skill_url: skill.skill_url,
        is_active: skill.is_active === 1,
        created_at: skill.created_at,
        updated_at: skill.updated_at,
        created_by: skill.created_by,
      }
    }, { status: 201 })
  } catch (error) {
    logger.error('Error importing skill:', error)
    return NextResponse.json({ error: 'Failed to import skill' }, { status: 500 })
  }
}