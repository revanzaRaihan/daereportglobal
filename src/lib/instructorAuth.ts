import { createAdminClient } from '@/utils/supabase/admin'
import { User } from '@supabase/supabase-js'
import { reassignInstructorModules } from '@/lib/modules/moduleService'

export interface InstructorMember {
  id: string
  email: string
  name: string
  role: 'admin' | 'teacher'
  status: 'active' | 'pending'
  studentCount?: number
  reportCount?: number
  createdAt: string
  avatarUrl?: string
}

export interface PendingInvite {
  id: string
  email: string
  name: string
  role: 'admin' | 'teacher'
  invitedAt: string
  actionLink?: string
}

export interface InstructorOverviewResult {
  activeMembers: InstructorMember[]
  pendingInvites: PendingInvite[]
  stats: {
    totalActive: number
    totalPending: number
    totalAdmins: number
  }
}

/**
 * Validates whether the given user object has administrative privileges.
 * Verifies app_metadata (secure server-set) and fallback to user_metadata/known roles.
 */
export function isUserAdmin(user: User | null | undefined): boolean {
  if (!user) return false
  return user.app_metadata?.role === 'admin'
}

/**
 * Fallback storage helper for environments where the SQL migration for
 * table `instructor_invitations` has not yet been executed in Supabase.
 */
async function getFallbackWhitelist(): Promise<PendingInvite[]> {
  const adminClient = createAdminClient()
  if (!adminClient) return []
  try {
    const { data } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'instructor_whitelist')
      .maybeSingle()

    if (!data?.value) return []
    return JSON.parse(data.value) as PendingInvite[]
  } catch {
    return []
  }
}

async function saveFallbackWhitelist(invites: PendingInvite[]): Promise<void> {
  const adminClient = createAdminClient()
  if (!adminClient) return
  await adminClient
    .from('app_settings')
    .upsert({
      key: 'instructor_whitelist',
      value: JSON.stringify(invites),
      updated_at: new Date().toISOString()
    })
}

/**
 * Checks whether an email address is legitimately authorized in the system:
 * 1. An invited entry in `instructor_invitations` or fallback whitelist
 * 2. An admin account
 * 3. An established instructor with existing students or reports
 */
export async function isEmailWhitelisted(email: string): Promise<boolean> {
  // Public Demo mode: Whitelist disabled by default unless explicitly activated via ENABLE_WHITELIST=true
  if (process.env.ENABLE_WHITELIST !== 'true') {
    return true
  }

  const normalizedEmail = email.trim().toLowerCase()
  const adminClient = createAdminClient()
  if (!adminClient) return false

  // 1. Check in instructor_invitations table
  try {
    const { data: tableData, error } = await adminClient
      .from('instructor_invitations')
      .select('id, status')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!error && tableData) {
      return tableData.status !== 'revoked'
    }
  } catch {
    // Table may not exist yet, fallback below
  }

  // 2. Check in app_settings fallback whitelist
  const fallbackList = await getFallbackWhitelist()
  if (fallbackList.some(inv => inv.email.toLowerCase() === normalizedEmail)) {
    return true
  }

  // 3. Check if user is an existing admin or teacher with existing data
  try {
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const matchedUser = usersData?.users?.find(
      u => u.email?.trim().toLowerCase() === normalizedEmail
    )

    if (matchedUser) {
      // Allow if admin (strictly app_metadata)
      if (matchedUser.app_metadata?.role === 'admin') {
        return true
      }

      // Allow if existing teacher who already manages students or reports
      const [{ count: studentCount }, { count: reportCount }] = await Promise.all([
        adminClient.from('students').select('*', { count: 'exact', head: true }).eq('user_id', matchedUser.id),
        adminClient.from('reports').select('*', { count: 'exact', head: true }).eq('user_id', matchedUser.id)
      ])

      if ((studentCount && studentCount > 0) || (reportCount && reportCount > 0)) {
        return true
      }
    }
  } catch (err) {
    console.error('Error checking user history for whitelist:', err)
  }

  return false
}

/**
 * Fetches all active team members and pending invitations for the admin management page.
 */
export async function getInstructorsOverview(fallbackClient?: any): Promise<InstructorOverviewResult> {
  const adminClient = createAdminClient()
  if (!adminClient) {
    if (fallbackClient) {
      try {
        let teachers: any[] = []
        try {
          const teachersRes = await fallbackClient.rpc('get_history_teachers_overview')
          teachers = teachersRes.data || []
        } catch {
          // RPC might not be deployed yet
        }

        let tableInvites: any[] = []
        try {
          const invitesRes = await fallbackClient.from('instructor_invitations').select('*').eq('status', 'pending')
          tableInvites = invitesRes.data || []
        } catch {
          // Table might not exist yet
        }

        const activeMembers: InstructorMember[] = teachers.map((t: any) => ({
          id: t.teacher_id,
          email: t.email,
          name: t.name || t.email?.split('@')[0] || 'Guru',
          role: 'teacher',
          status: 'active',
          studentCount: Number(t.student_count || 0),
          reportCount: Number(t.report_count || 0),
          createdAt: new Date().toISOString()
        }))

        const pendingInvites: PendingInvite[] = tableInvites.map((i: any) => ({
          id: i.id,
          email: i.email,
          name: i.name || '',
          role: i.role || 'teacher',
          invitedAt: i.invited_at,
          actionLink: i.activation_token
        }))

        return {
          activeMembers,
          pendingInvites,
          stats: {
            totalActive: activeMembers.length,
            totalPending: pendingInvites.length,
            totalAdmins: 1
          }
        }
      } catch (fbErr) {
        console.warn('[getInstructorsOverview] Fallback query failed:', fbErr)
        return {
          activeMembers: [],
          pendingInvites: [],
          stats: {
            totalActive: 0,
            totalPending: 0,
            totalAdmins: 1
          }
        }
      }
    }

    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di server environment (.env.local atau Netlify/Vercel Environment Variables).')
  }

  // 1. Fetch all users from Supabase Auth
  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })

  if (usersError) {
    throw new Error(`Failed to list users: ${usersError.message}`)
  }

  // 2. Fetch student count grouped by user_id
  const { data: studentsData } = await adminClient
    .from('students')
    .select('user_id')
    .is('deleted_at', null)

  const studentCountMap = new Map<string, number>()
  if (studentsData) {
    studentsData.forEach(s => {
      if (s.user_id) {
        studentCountMap.set(s.user_id, (studentCountMap.get(s.user_id) || 0) + 1)
      }
    })
  }

  // 3. Fetch custom teacher names from app_settings
  const { data: settingsData } = await adminClient
    .from('app_settings')
    .select('key, value')
    .like('key', 'teacher_name_%')

  const customNamesMap = new Map<string, string>()
  if (settingsData) {
    settingsData.forEach(s => {
      const uid = s.key.replace('teacher_name_', '')
      customNamesMap.set(uid, s.value)
    })
  }

  // 4. Fetch pending invitations from DB table or fallback
  let pendingInvites: PendingInvite[] = []
  try {
    const { data: tableInvites, error: tableError } = await adminClient
      .from('instructor_invitations')
      .select('*')
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })

    if (!tableError && tableInvites) {
      pendingInvites = tableInvites.map(t => ({
        id: t.id,
        email: t.email,
        name: t.name || '',
        role: t.role || 'teacher',
        invitedAt: t.invited_at,
        actionLink: t.activation_token
      }))
    } else {
      pendingInvites = await getFallbackWhitelist()
    }
  } catch {
    pendingInvites = await getFallbackWhitelist()
  }

  // 5. Build active members list
  const activeMembers: InstructorMember[] = []
  const allUsers = usersData.users || []

  for (const user of allUsers) {
    // If the user was invited and hasn't confirmed email or never signed in, check if pending
    const isPendingInList = pendingInvites.some(
      p => p.email.toLowerCase() === (user.email || '').toLowerCase()
    )
    if (isPendingInList && !user.last_sign_in_at) {
      continue // Displayed in pending invitations section
    }

    const email = user.email || ''
    const role: 'admin' | 'teacher' =
      user.app_metadata?.role === 'admin' ? 'admin' : 'teacher'

    const name =
      customNamesMap.get(user.id) ||
      user.user_metadata?.teacher_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      email.split('@')[0] ||
      'Instruktur'

    activeMembers.push({
      id: user.id,
      email,
      name,
      role,
      status: 'active',
      studentCount: studentCountMap.get(user.id) || 0,
      createdAt: user.created_at,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture
    })
  }

  // Sort active members: Admins first, then by name
  activeMembers.sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (a.role !== 'admin' && b.role === 'admin') return 1
    return a.name.localeCompare(b.name)
  })

  const totalAdmins = activeMembers.filter(m => m.role === 'admin').length

  return {
    activeMembers,
    pendingInvites,
    stats: {
      totalActive: activeMembers.length,
      totalPending: pendingInvites.length,
      totalAdmins
    }
  }
}

/**
 * Invites a new instructor:
 * - Sends official activation link via Supabase Auth email.
 * - Generates direct action_link for instant clipboard copy / WhatsApp sharing.
 * - Persists invitation to DB / fallback.
 */
export async function inviteInstructor(params: {
  email: string
  name?: string
  role?: 'admin' | 'teacher'
  invitedBy?: string
  origin: string
}): Promise<{
  success: boolean
  message: string
  actionLink: string
  invite: PendingInvite
}> {
  const { email, name = '', role = 'teacher', invitedBy, origin } = params
  const normalizedEmail = email.trim().toLowerCase()

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di server environment (.env.local atau Vercel Environment Variables).')
  }

  // Check if already an active member
  const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = usersData?.users?.find(
    u => u.email?.trim().toLowerCase() === normalizedEmail
  )

  if (existingUser && existingUser.last_sign_in_at) {
    throw new Error(`Instruktur dengan email ${normalizedEmail} sudah terdaftar dan aktif.`)
  }

  const inviteToken = crypto.randomUUID()
  const redirectUrl = `${origin}/auth/activate?invited_email=${encodeURIComponent(normalizedEmail)}&token=${inviteToken}`

  // 1. Attempt to trigger email dispatch via Supabase Auth
  try {
    await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: redirectUrl,
      data: {
        teacher_name: name,
        full_name: name,
        role
      }
    })
  } catch (err) {
    console.warn('inviteUserByEmail notice (might proceed with generateLink):', err)
  }

  // 2. Generate direct action link
  const linkRes = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: normalizedEmail,
    options: {
      redirectTo: redirectUrl
    }
  })

  let actionLink = linkRes.data?.properties?.action_link || ''
  if (!actionLink) {
    // Fallback if generateLink was empty
    actionLink = redirectUrl
  }

  const inviteItem: PendingInvite = {
    id: linkRes.data?.user?.id || crypto.randomUUID(),
    email: normalizedEmail,
    name,
    role,
    invitedAt: new Date().toISOString(),
    actionLink
  }

  // Ensure app_metadata has role set on the user immediately
  const targetUserId = linkRes.data?.user?.id || existingUser?.id
  if (targetUserId) {
    try {
      await adminClient.auth.admin.updateUserById(targetUserId, {
        app_metadata: { role }
      })
    } catch (err) {
      console.warn('Failed to set app_metadata on invited user:', err)
    }
  }

  // 3. Persist to instructor_invitations table or fallback
  let savedToTable = false
  try {
    const { error } = await adminClient.from('instructor_invitations').upsert(
      {
        email: normalizedEmail,
        name,
        role,
        status: 'pending',
        activation_token: inviteToken,
        invited_by: invitedBy || null,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'email' }
    )
    if (!error) savedToTable = true
  } catch {
    savedToTable = false
  }

  if (!savedToTable) {
    const currentList = await getFallbackWhitelist()
    const filtered = currentList.filter(i => i.email.toLowerCase() !== normalizedEmail)
    filtered.unshift(inviteItem)
    await saveFallbackWhitelist(filtered)
  }

  return {
    success: true,
    message: `Undangan aktivasi telah dikirim ke ${normalizedEmail}.`,
    actionLink,
    invite: inviteItem
  }
}

/**
 * Resends activation invitation email and returns the refreshed activation link.
 */
export async function resendInvite(params: {
  email: string
  origin: string
}): Promise<{ success: boolean; message: string; actionLink: string }> {
  const { email, origin } = params
  const normalizedEmail = email.trim().toLowerCase()

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di server environment (.env.local atau Vercel Environment Variables).')
  }

  const inviteToken = crypto.randomUUID()
  const redirectUrl = `${origin}/auth/activate?invited_email=${encodeURIComponent(normalizedEmail)}&token=${inviteToken}`

  // Re-send via Supabase
  try {
    await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: redirectUrl
    })
  } catch (err) {
    console.warn('resend inviteUserByEmail notice:', err)
  }

  // Re-generate link
  const linkRes = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: normalizedEmail,
    options: {
      redirectTo: redirectUrl
    }
  })

  const actionLink = linkRes.data?.properties?.action_link || redirectUrl

  // Update in DB or fallback
  try {
    await adminClient
      .from('instructor_invitations')
      .update({
        activation_token: inviteToken,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('email', normalizedEmail)
  } catch {
    const currentList = await getFallbackWhitelist()
    const item = currentList.find(i => i.email.toLowerCase() === normalizedEmail)
    if (item) {
      item.actionLink = actionLink
      item.invitedAt = new Date().toISOString()
      await saveFallbackWhitelist(currentList)
    }
  }

  return {
    success: true,
    message: `Tautan aktivasi baru berhasil dikirim ulang ke ${normalizedEmail}.`,
    actionLink
  }
}

/**
 * Revokes a pending invitation and removes unactivated user from Auth.
 */
export async function revokeInvite(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const adminClient = createAdminClient()
  if (!adminClient) return

  // 1. Remove from table
  try {
    await adminClient.from('instructor_invitations').delete().eq('email', normalizedEmail)
  } catch {
    // Ignore if table missing
  }

  // 2. Remove from fallback
  const currentList = await getFallbackWhitelist()
  const filtered = currentList.filter(i => i.email.toLowerCase() !== normalizedEmail)
  await saveFallbackWhitelist(filtered)

  // 3. Delete unactivated user from auth if they have never signed in
  try {
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const user = usersData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail)
    if (user && !user.last_sign_in_at) {
      await adminClient.auth.admin.deleteUser(user.id)
    }
  } catch (err) {
    console.error('Error removing auth user during invite revocation:', err)
  }
}

/**
 * Removes an active instructor with safety checks against accidental student data loss.
 */
export async function removeInstructorMember(userId: string, currentAdminId: string): Promise<void> {
  if (userId === currentAdminId) {
    throw new Error('Anda tidak dapat menghapus akun Anda sendiri.')
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di server environment (.env.local atau Vercel Environment Variables).')
  }

  // 1. Fetch user to verify existence and retrieve email
  const { data: userData, error: fetchErr } = await adminClient.auth.admin.getUserById(userId)
  if (fetchErr || !userData?.user) {
    throw new Error('Data instruktur tidak ditemukan di sistem.')
  }
  const userEmail = userData.user.email?.toLowerCase()

  // 2. Safety Guard: Check if instructor still has active students
  const { count: studentCount } = await adminClient
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (studentCount && studentCount > 0) {
    throw new Error(
      `Instruktur ini masih mengampu ${studentCount} murid aktif. Harap pindahkan (transfer) seluruh murid ke pengajar lain terlebih dahulu sebelum menghapus akun ini.`
    )
  }

  // 2.5 Safe Offboarding: Reassign any learning curriculum modules to Admin
  try {
    await reassignInstructorModules(userId, currentAdminId)
  } catch (modErr) {
    console.error('Warning reassigning learning modules during offboarding:', modErr)
  }

  // 3. Delete from auth.users
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(`Gagal menghapus instruktur: ${error.message}`)
  }

  // 4. Clean up whitelist entry, fallback whitelist, and custom profile settings
  if (userEmail) {
    try {
      await adminClient.from('instructor_invitations').delete().eq('email', userEmail)
    } catch {
      // Ignore
    }

    try {
      const currentList = await getFallbackWhitelist()
      const filtered = currentList.filter(i => i.email.toLowerCase() !== userEmail)
      if (filtered.length !== currentList.length) {
        await saveFallbackWhitelist(filtered)
      }
    } catch {
      // Ignore
    }
  }

  try {
    await adminClient.from('app_settings').delete().eq('key', `teacher_name_${userId}`)
  } catch {
    // Ignore
  }
}
