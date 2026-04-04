export type UserRole = 'coach' | 'client'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  fullName?: string
  clientCode?: string
}
