import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface CoachClient {
  id: string | number
  auth_user_id?: string | null
  email: string
  full_name?: string | null
  client_code: string
  coach_id?: string | null
  main_goal?: string | null
  height_cm?: number | null
  initial_weight_kg?: number | null
  fitness_level?: string | null
  sporting_past?: string | null
  available_equipment?: string | null
  training_frequency?: string | null
  physical_issues?: string | null
  age?: number | null
  avatar_url?: string | null
  created_at?: string
}

export interface ClientFormInput {
  full_name: string
  email: string
  main_goal: string
  height_cm: string
  initial_weight_kg: string
  fitness_level: string
  sporting_past: string
  available_equipment: string
  training_frequency: string
  physical_issues: string
  age: string
}

interface UseCoachClientsReturn {
  clients: CoachClient[]
  loading: boolean
  saving: boolean
  error: string | null
  fetchClients: () => Promise<void>
  addClient: (payload: ClientFormInput) => Promise<{ client: CoachClient; clientCode: string }>
  updateClient: (clientId: string, payload: ClientFormInput) => Promise<CoachClient>
}

const CLIENT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generateClientCode = () => {
  const suffix = Array.from({ length: 8 }, () => CLIENT_CODE_CHARS[Math.floor(Math.random() * CLIENT_CODE_CHARS.length)]).join('')
  return `ID-${suffix}`
}

const parseNullableNumber = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parseNullableInteger = (value: string) => {
  const parsed = parseNullableNumber(value)
  return parsed === null ? null : Math.round(parsed)
}

const normalizeText = (value: string) => {
  const normalized = value.trim()
  return normalized ? normalized : null
}

const normalizeEmail = (value: string) => {
  const normalized = value.trim().toLowerCase()
  return normalized
}

export function useCoachClients(): UseCoachClientsReturn {
  const { user } = useAuth()
  const [clients, setClients] = useState<CoachClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    if (!user) {
      setClients([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })

      if (clientsError) throw clientsError
      setClients((data || []) as CoachClient[])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des clients'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const addClient = useCallback(
    async (payload: ClientFormInput) => {
      if (!user) {
        throw new Error('Coach non connecté')
      }

      setSaving(true)
      try {
        let createdClient: CoachClient | null = null
        let generatedCode = ''

        for (let attempt = 0; attempt < 5; attempt += 1) {
          generatedCode = generateClientCode()

          const insertPayload = {
            coach_id: user.id,
            client_code: generatedCode,
            full_name: payload.full_name.trim(),
            email: normalizeEmail(payload.email),
            main_goal: normalizeText(payload.main_goal),
            height_cm: parseNullableInteger(payload.height_cm),
            initial_weight_kg: parseNullableNumber(payload.initial_weight_kg),
            fitness_level: normalizeText(payload.fitness_level) || 'Débutant',
            sporting_past: normalizeText(payload.sporting_past),
            available_equipment: normalizeText(payload.available_equipment),
            training_frequency: normalizeText(payload.training_frequency),
            physical_issues: normalizeText(payload.physical_issues),
            age: parseNullableInteger(payload.age),
          }

          const { data, error: insertError } = await supabase
            .from('clients')
            .insert(insertPayload)
            .select('*')
            .single()

          if (!insertError) {
            createdClient = data as CoachClient
            break
          }

          if (insertError.code !== '23505' || !String(insertError.message || '').toLowerCase().includes('client_code')) {
            throw insertError
          }
        }

        if (!createdClient) {
          throw new Error("Impossible de générer un code client unique. Réessayez.")
        }

        setClients((prev) => [createdClient as CoachClient, ...prev])

        return { client: createdClient as CoachClient, clientCode: generatedCode }
      } finally {
        setSaving(false)
      }
    },
    [user]
  )

  const updateClient = useCallback(
    async (clientId: string, payload: ClientFormInput) => {
      if (!user) {
        throw new Error('Coach non connecté')
      }

      setSaving(true)
      try {
        const updatePayload = {
          full_name: payload.full_name.trim(),
          email: normalizeEmail(payload.email),
          main_goal: normalizeText(payload.main_goal),
          height_cm: parseNullableInteger(payload.height_cm),
          initial_weight_kg: parseNullableNumber(payload.initial_weight_kg),
          fitness_level: normalizeText(payload.fitness_level) || 'Débutant',
          sporting_past: normalizeText(payload.sporting_past),
          available_equipment: normalizeText(payload.available_equipment),
          training_frequency: normalizeText(payload.training_frequency),
          physical_issues: normalizeText(payload.physical_issues),
          age: parseNullableInteger(payload.age),
        }

        const { data, error: updateError } = await supabase
          .from('clients')
          .update(updatePayload)
          .eq('id', clientId)
          .eq('coach_id', user.id)
          .select('*')
          .single()

        if (updateError) throw updateError

        const updatedClient = data as CoachClient
        setClients((prev) => prev.map((client) => (String(client.id) === String(clientId) ? updatedClient : client)))

        return updatedClient
      } finally {
        setSaving(false)
      }
    },
    [user]
  )

  return {
    clients,
    loading,
    saving,
    error,
    fetchClients,
    addClient,
    updateClient,
  }
}
