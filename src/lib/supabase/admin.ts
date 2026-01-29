import { createClient } from '@supabase/supabase-js'
import { createServer } from './server'

/**
 * Cria um cliente Supabase Admin com service role key
 * APENAS para uso server-side em API routes
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export interface UserProfile {
  id: string
  user_id: string
  email: string
  name: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

/**
 * Verifica se o usuário atual é admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    return profile?.role === 'admin'
  } catch (error) {
    console.error('[isCurrentUserAdmin] Error:', error)
    return false
  }
}

/**
 * Obtém o perfil do usuário atual
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return profile
  } catch (error) {
    console.error('[getCurrentUserProfile] Error:', error)
    return null
  }
}

/**
 * Lista todos os usuários (apenas para admins)
 */
export async function listAllUsers(): Promise<UserProfile[]> {
  try {
    const adminClient = createAdminClient()

    const { data: profiles, error } = await adminClient
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return profiles || []
  } catch (error) {
    console.error('[listAllUsers] Error:', error)
    return []
  }
}

export interface CreateUserInput {
  email: string
  password: string
  name: string
  role: 'admin' | 'user'
}

/**
 * Cria um novo usuário (apenas para admins)
 */
export async function createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  try {
    const adminClient = createAdminClient()

    // Cria o usuário no Supabase Auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // Auto-confirma o email
      user_metadata: {
        name: input.name,
        role: input.role
      }
    })

    if (authError) {
      console.error('[createUser] Auth error:', authError)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Usuário não foi criado' }
    }

    // O trigger no banco deve criar o profile automaticamente
    // Mas vamos verificar e criar manualmente se necessário
    const { data: existingProfile } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .single()

    if (!existingProfile) {
      // Cria o profile manualmente
      const { data: profile, error: profileError } = await adminClient
        .from('user_profiles')
        .insert({
          user_id: authData.user.id,
          email: input.email,
          name: input.name,
          role: input.role
        })
        .select()
        .single()

      if (profileError) {
        console.error('[createUser] Profile error:', profileError)
        // Tenta deletar o usuário auth criado
        await adminClient.auth.admin.deleteUser(authData.user.id)
        return { success: false, error: 'Erro ao criar perfil do usuário' }
      }

      return { success: true, user: profile }
    }

    return { success: true, user: existingProfile }
  } catch (error: any) {
    console.error('[createUser] Error:', error)
    return { success: false, error: error.message || 'Erro desconhecido' }
  }
}

/**
 * Deleta um usuário (apenas para admins)
 */
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()

    // Primeiro, obtém o user_id do auth a partir do profile
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('user_id')
      .eq('id', userId)
      .single()

    if (!profile) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    // Deleta o usuário do Supabase Auth (cascade vai deletar o profile)
    const { error } = await adminClient.auth.admin.deleteUser(profile.user_id)

    if (error) {
      console.error('[deleteUser] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[deleteUser] Error:', error)
    return { success: false, error: error.message || 'Erro desconhecido' }
  }
}

/**
 * Atualiza o role de um usuário (apenas para admins)
 */
export async function updateUserRole(userId: string, role: 'admin' | 'user'): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('user_profiles')
      .update({ role })
      .eq('id', userId)

    if (error) {
      console.error('[updateUserRole] Error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('[updateUserRole] Error:', error)
    return { success: false, error: error.message || 'Erro desconhecido' }
  }
}
