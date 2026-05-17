// ============================================================================
// supabase/functions/notify/index.ts — VERSION COMPLÈTE V2
// ============================================================================
// À copier-coller intégralement dans Dashboard Supabase → Edge Functions
// → notify → Code, puis Deploy.
//
// Ajouts par rapport à V1 :
//   * Handler `coach_packages` (INSERT)  → notif au client : nouveau forfait
//   * Handler `coach_package_sessions` (INSERT) → notif au client : séance cochée
//                                                + alerte coach si stock bas
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, any>
  old_record?: Record<string, any>
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev'
const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const trim = (text: string, max = 140) =>
  text.length > max ? text.slice(0, max).trim() + '…' : text

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ))
}
function escapeAttr(s: string): string { return escapeHtml(s) }

function formatLongDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

async function getUserDisplayName(userId: string): Promise<string> {
  const { data: coach } = await supabase
    .from('coaches')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()
  if (coach?.full_name) return coach.full_name

  const { data: client } = await supabase
    .from('clients')
    .select('full_name')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (client?.full_name) return client.full_name

  return "Quelqu'un"
}

async function getClientById(clientId: string | number) {
  const { data } = await supabase
    .from('clients')
    .select('id, full_name, coach_id, auth_user_id')
    .eq('id', clientId)
    .maybeSingle()
  return data
}

async function getProgramName(programId: string | number): Promise<string> {
  const { data } = await supabase
    .from('programs')
    .select('name')
    .eq('id', programId)
    .maybeSingle()
  return data?.name ?? 'Programme'
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user?.email) return null
  return data.user.email
}

// ────────────────────────────────────────────────
// Email templates
// ────────────────────────────────────────────────

interface EmailContext {
  userId: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  actorName?: string | null
  meta?: Record<string, any>
}

function buildEmailContent(ctx: EmailContext): {
  tag: string
  tagColor: string
  intro: string
  innerHtml: string
  ctaLabel: string
} {
  const { type, body, actorName, meta } = ctx
  const safeBody = body ? escapeHtml(body) : ''

  switch (type) {
    case 'message':
      return {
        tag: 'Nouveau message', tagColor: '#3b82f6',
        intro: actorName ? `${escapeHtml(actorName)} vient de t'envoyer un message :` : 'Tu as un nouveau message :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f1f5f9;border-radius:14px;border-left:4px solid #3b82f6;"><tr><td style="padding:14px 16px;color:#0f172a;font-size:14px;line-height:1.55;font-style:italic;">${safeBody || '—'}</td></tr></table>`,
        ctaLabel: 'Répondre maintenant',
      }

    case 'program_request':
      return {
        tag: 'Demande de programme', tagColor: '#f59e0b',
        intro: actorName ? `${escapeHtml(actorName)} te demande un nouveau programme :` : 'Un client te demande un nouveau programme :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#fffbeb;border-radius:14px;border-left:4px solid #f59e0b;"><tr><td style="padding:14px 16px;color:#78350f;font-size:14px;line-height:1.55;">📋 ${safeBody || 'Aucune précision fournie.'}</td></tr></table>`,
        ctaLabel: 'Voir la demande',
      }

    case 'appointment_request':
      return {
        tag: 'Demande de RDV', tagColor: '#f59e0b',
        intro: actorName ? `${escapeHtml(actorName)} te demande un rendez-vous :` : 'Un client te demande un rendez-vous :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#fffbeb;border-radius:14px;border-left:4px solid #f59e0b;"><tr><td style="padding:14px 16px;color:#78350f;font-size:14px;line-height:1.55;">📅 ${safeBody || 'Aucune précision sur les disponibilités.'}</td></tr></table>`,
        ctaLabel: 'Proposer un créneau',
      }

    case 'workout_completed': {
      const duration = meta?.duration ? `${meta.duration} min` : null
      const rating = typeof meta?.rating === 'number' ? meta.rating : null
      const ratingEmoji = rating ? (rating <= 2 ? '😎' : rating === 3 ? '🙂' : rating === 4 ? '😟' : '😩') : null
      const ratingLabel = rating ? (rating === 1 ? 'Très facile' : rating === 2 ? 'Facile' : rating === 3 ? 'Normal' : rating === 4 ? 'Difficile' : 'Très difficile') : null
      const programName = meta?.programName ? escapeHtml(meta.programName) : 'sa séance'

      const statsRow = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr>
        ${duration ? `<td style="padding:6px;width:50%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border-radius:14px;"><tr><td style="padding:14px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#047857;">Durée</p><p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#065f46;">${duration}</p></td></tr></table></td>` : ''}
        ${rating ? `<td style="padding:6px;width:50%;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border-radius:14px;"><tr><td style="padding:14px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#047857;">Ressenti</p><p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#065f46;">${ratingEmoji} ${rating}/5</p><p style="margin:2px 0 0;font-size:11px;color:#047857;">${ratingLabel}</p></td></tr></table></td>` : ''}
      </tr></table>`

      return {
        tag: 'Séance terminée', tagColor: '#10b981',
        intro: actorName ? `${escapeHtml(actorName)} vient de terminer ${programName}. Voici le résumé :` : `Un client vient de terminer ${programName}. Voici le résumé :`,
        innerHtml: statsRow,
        ctaLabel: 'Voir le client',
      }
    }

    case 'program_assigned': {
      const programName = meta?.programName ? escapeHtml(meta.programName) : 'un nouveau programme'
      return {
        tag: 'Nouveau programme', tagColor: '#10b981',
        intro: actorName ? `${escapeHtml(actorName)} vient de te confier un nouveau programme :` : 'Tu as un nouveau programme à découvrir :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:18px;"><tr><td style="padding:24px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#047857;">Programme</p><p style="margin:8px 0 0;font-size:22px;font-weight:900;color:#064e3b;line-height:1.2;">${programName}</p></td></tr></table>`,
        ctaLabel: 'Démarrer ma séance',
      }
    }

    case 'session_scheduled': {
      const programName = meta?.programName ? escapeHtml(meta.programName) : 'ta séance'
      const scheduledFor = meta?.scheduledDate ? escapeHtml(formatLongDate(meta.scheduledDate)) : ''
      return {
        tag: 'Séance planifiée', tagColor: '#0ea5e9',
        intro: actorName ? `${escapeHtml(actorName)} vient de planifier une séance pour toi :` : "Une séance vient d'être planifiée pour toi :",
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:linear-gradient(135deg,#f0f9ff,#dbeafe);border-radius:18px;"><tr><td style="padding:22px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0369a1;">${scheduledFor || 'Date à venir'}</p><p style="margin:8px 0 0;font-size:20px;font-weight:900;color:#0c4a6e;line-height:1.25;">${programName}</p></td></tr></table>`,
        ctaLabel: 'Voir mon planning',
      }
    }

    case 'session_rescheduled': {
      const programName = meta?.programName ? escapeHtml(meta.programName) : 'la séance'
      const oldDate = meta?.oldDate ? escapeHtml(formatLongDate(meta.oldDate)) : ''
      const newDate = meta?.newDate ? escapeHtml(formatLongDate(meta.newDate)) : ''
      return {
        tag: 'Séance déplacée', tagColor: '#f59e0b',
        intro: actorName ? `${escapeHtml(actorName)} a déplacé une séance :` : 'Une séance a été déplacée :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#fffbeb;border-radius:14px;border-left:4px solid #f59e0b;"><tr><td style="padding:14px 16px;color:#78350f;font-size:14px;line-height:1.55;"><p style="margin:0;font-weight:700;">${programName}</p>${oldDate ? `<p style="margin:6px 0 0;font-size:12px;color:#92400e;text-decoration:line-through;">${oldDate}</p>` : ''}${newDate ? `<p style="margin:4px 0 0;font-size:14px;font-weight:800;color:#78350f;">→ ${newDate}</p>` : ''}</td></tr></table>`,
        ctaLabel: 'Voir le client',
      }
    }

    // ──────── NOUVEAU : Forfait créé ────────
    case 'package_created': {
      const total = meta?.totalSessions ?? '—'
      const price = meta?.priceEur != null ? Number(meta.priceEur).toFixed(2) + '€' : ''
      return {
        tag: 'Nouveau forfait', tagColor: '#10b981',
        intro: actorName ? `${escapeHtml(actorName)} vient d'enregistrer un forfait pour toi :` : 'Un forfait vient d\'être enregistré :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:18px;"><tr><td style="padding:24px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#047857;">Forfait</p><p style="margin:8px 0 0;font-size:28px;font-weight:900;color:#064e3b;line-height:1.2;">${total} séance${Number(total) > 1 ? 's' : ''}</p>${price ? `<p style="margin:6px 0 0;font-size:14px;font-weight:700;color:#047857;">${price}</p>` : ''}</td></tr></table>`,
        ctaLabel: 'Voir mon forfait',
      }
    }

    // ──────── NOUVEAU : Séance cochée (notif client) ────────
    case 'package_session_logged': {
      const date = meta?.sessionDate ? escapeHtml(formatLongDate(meta.sessionDate)) : ''
      const sType = meta?.sessionType ? escapeHtml(meta.sessionType) : ''
      const remaining = meta?.remaining
      return {
        tag: 'Séance enregistrée', tagColor: '#10b981',
        intro: actorName ? `${escapeHtml(actorName)} vient de valider ta séance :` : 'Une séance vient d\'être validée sur ton forfait :',
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#ecfdf5;border-radius:14px;border-left:4px solid #10b981;"><tr><td style="padding:14px 16px;color:#064e3b;font-size:14px;line-height:1.55;"><p style="margin:0;font-weight:700;">${date}${sType ? ` · ${sType}` : ''}</p>${remaining != null ? `<p style="margin:6px 0 0;font-size:13px;color:#047857;">Il te reste <strong>${remaining}</strong> séance${remaining > 1 ? 's' : ''}.</p>` : ''}</td></tr></table>`,
        ctaLabel: 'Voir mon forfait',
      }
    }

    // ──────── NOUVEAU : Alerte stock bas (notif coach) ────────
    case 'package_low_stock': {
      const remaining = meta?.remaining ?? 0
      const clientName = meta?.clientName ?? 'Un client'
      return {
        tag: 'Forfait bientôt épuisé', tagColor: '#f59e0b',
        intro: `Le forfait de ${escapeHtml(clientName)} touche à sa fin :`,
        innerHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#fffbeb;border-radius:14px;border-left:4px solid #f59e0b;"><tr><td style="padding:14px 16px;color:#78350f;font-size:14px;line-height:1.55;"><p style="margin:0;font-weight:700;font-size:18px;">${remaining} séance${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}</p><p style="margin:6px 0 0;font-size:12px;color:#92400e;">Pense à proposer un renouvellement.</p></td></tr></table>`,
        ctaLabel: 'Voir le client',
      }
    }

    case 'program_unassigned':
      return {
        tag: 'Programme retiré', tagColor: '#f43f5e',
        intro: 'Un programme a été désassigné de ton compte.',
        innerHtml: safeBody ? `<p style="margin:18px 0;color:#475569;font-size:14px;">${safeBody}</p>` : '',
        ctaLabel: 'Voir mes programmes',
      }

    default:
      return {
        tag: 'Notification', tagColor: '#10b981',
        intro: ctx.title,
        innerHtml: safeBody ? `<p style="margin:18px 0;color:#475569;font-size:14px;">${safeBody}</p>` : '',
        ctaLabel: "Ouvrir l'app",
      }
  }
}

async function sendEmail(ctx: EmailContext) {
  if (!RESEND_API_KEY) {
    console.log('[notify] RESEND_API_KEY missing — skipping email')
    return
  }
  const to = await getUserEmail(ctx.userId)
  if (!to) {
    console.log('[notify] no email found for user', ctx.userId)
    return
  }

  const { tag, tagColor, intro, innerHtml, ctaLabel } = buildEmailContent(ctx)
  const ctaUrl = ctx.link && APP_URL ? `${APP_URL}${ctx.link}` : APP_URL || '#'

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="color-scheme" content="light" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,0.06);">
      <tr><td style="background:linear-gradient(135deg,#10b981 0%,#0d9488 100%);padding:24px 28px;color:#fff;">
        <span style="display:inline-block;background:${tagColor};color:#fff;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;padding:5px 10px;border-radius:999px;margin-bottom:12px;">${tag}</span>
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:.85;">Alto Fitness</p>
        <p style="margin:6px 0 0;font-size:22px;font-weight:800;line-height:1.25;">${escapeHtml(ctx.title)}</p>
      </td></tr>
      <tr><td style="padding:24px 28px;color:#0f172a;font-size:14px;line-height:1.6;">
        <p style="margin:0;color:#475569;">${intro}</p>${innerHtml}
        <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:12px;">${ctaLabel}</a>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Tu reçois ce mail car tu as une notification active sur Alto Fitness.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Alto Fitness <${EMAIL_FROM}>`, to: [to], subject: ctx.title, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[notify] Resend error', res.status, err)
  }
}

async function createNotification(params: {
  user_id: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  actor_id?: string | null
  actor_name?: string | null
  entity_id?: string | null
  meta?: Record<string, any>
}) {
  await supabase.from('notifications').insert({
    user_id: params.user_id, type: params.type, title: params.title,
    body: params.body ?? null, link: params.link ?? null,
    actor_id: params.actor_id ?? null, actor_name: params.actor_name ?? null,
    entity_id: params.entity_id ?? null,
  })
  try {
    await sendEmail({
      userId: params.user_id, type: params.type, title: params.title,
      body: params.body, link: params.link,
      actorName: params.actor_name, meta: params.meta,
    })
  } catch (err) {
    console.error('[notify] sendEmail failed', err)
  }
}

// ────────────────────────────────────────────────
// Handlers existants (inchangés)
// ────────────────────────────────────────────────

async function handleNewMessage(record: any) {
  const { sender_id, receiver_id, content, id: messageId } = record
  if (!sender_id || !receiver_id) return
  const senderName = await getUserDisplayName(sender_id)
  const isProgramRequest = String(content || '').startsWith('📋 Demande de programme')
  const isAppointmentRequest = String(content || '').startsWith('📅 Demande de RDV')
  const { data: receiverIsCoach } = await supabase.from('coaches').select('id').eq('id', receiver_id).maybeSingle()
  const link = receiverIsCoach ? '/coach/messages' : '/client/messages'
  let type: 'message' | 'program_request' | 'appointment_request' = 'message'
  let title = `Nouveau message de ${senderName}`
  if (isProgramRequest) { type = 'program_request'; title = `${senderName} demande un programme` }
  else if (isAppointmentRequest) { type = 'appointment_request'; title = `${senderName} demande un RDV` }
  await createNotification({
    user_id: receiver_id, type, title, body: trim(String(content || '')),
    link, actor_id: sender_id, actor_name: senderName, entity_id: String(messageId),
  })
}

async function handleProgramAssigned(record: any) {
  const { client_id, program_id, id: assignmentId } = record
  const client = await getClientById(client_id)
  if (!client?.auth_user_id) return
  const programName = await getProgramName(program_id)
  const coachName = client.coach_id ? await getUserDisplayName(client.coach_id) : 'Ton coach'
  await createNotification({
    user_id: client.auth_user_id, type: 'program_assigned',
    title: 'Nouveau programme assigné',
    body: `${coachName} vient de te confier le programme « ${programName} »`,
    link: `/client/workout/${program_id}`,
    actor_id: client.coach_id ?? null, actor_name: coachName, entity_id: String(assignmentId),
    meta: { programName, coachName },
  })
}

async function handleWorkoutCompleted(record: any) {
  const { client_id, program_id, duration_minutes, rating, session_type, external_name, id: logId } = record
  const client = await getClientById(client_id)
  if (!client?.coach_id) return
  const clientName = client.full_name || 'Un client'
  const isExternal = session_type === 'external'
  let programName: string | null = null
  if (isExternal && external_name) programName = external_name
  else if (program_id) programName = await getProgramName(program_id)
  const programLabel = programName ? `« ${programName} »` : 'une séance'
  const ratingPart = typeof rating === 'number' ? ` · ressenti ${rating}/5` : ''
  const durationPart = duration_minutes ? ` · ${duration_minutes} min` : ''
  await createNotification({
    user_id: client.coach_id, type: 'workout_completed',
    title: `${clientName} a terminé une séance`,
    body: `${programLabel}${durationPart}${ratingPart}`,
    link: `/coach/clients/${client.id}`,
    actor_id: client.auth_user_id ?? null, actor_name: clientName, entity_id: String(logId),
    meta: { programName, duration: duration_minutes, rating },
  })
}

async function handleSessionScheduled(record: any) {
  const { id: sessionId, client_id, program_id, scheduled_date, program_name } = record
  const client = await getClientById(client_id)
  if (!client?.auth_user_id) return
  const programName = program_name || (program_id ? await getProgramName(program_id) : 'Programme')
  const coachName = client.coach_id ? await getUserDisplayName(client.coach_id) : 'Ton coach'
  const longDate = formatLongDate(scheduled_date)
  await createNotification({
    user_id: client.auth_user_id, type: 'session_scheduled',
    title: `Séance planifiée le ${longDate}`,
    body: `${coachName} a planifié « ${programName} » le ${longDate}.`,
    link: '/client/planning',
    actor_id: client.coach_id ?? null, actor_name: coachName, entity_id: String(sessionId),
    meta: { programName, scheduledDate: scheduled_date, coachName },
  })
}

async function handleSessionUpdated(record: any, oldRecord: Record<string, any>) {
  const newDate = record.scheduled_date
  const oldDate = oldRecord.scheduled_date
  if (!newDate || !oldDate || newDate === oldDate) return
  const newStatus = String(record.status || '').toLowerCase()
  if (newStatus === 'cancelled' || newStatus === 'completed' || newStatus === 'skipped') return
  const coachDateChanged = record.coach_scheduled_date !== oldRecord.coach_scheduled_date
  const { id: sessionId, client_id, program_id, program_name } = record
  const client = await getClientById(client_id)
  if (!client) return
  const programName = program_name || (program_id ? await getProgramName(program_id) : 'Programme')
  if (coachDateChanged) {
    if (!client.auth_user_id) return
    const coachName = client.coach_id ? await getUserDisplayName(client.coach_id) : 'Ton coach'
    await createNotification({
      user_id: client.auth_user_id, type: 'session_rescheduled',
      title: `Séance déplacée au ${formatLongDate(newDate)}`,
      body: `${coachName} a déplacé « ${programName} ».`,
      link: '/client/planning',
      actor_id: client.coach_id ?? null, actor_name: coachName, entity_id: String(sessionId),
      meta: { programName, oldDate, newDate },
    })
  } else {
    if (!client.coach_id) return
    const clientName = client.full_name || 'Un client'
    await createNotification({
      user_id: client.coach_id, type: 'session_rescheduled',
      title: `${clientName} a déplacé sa séance`,
      body: `« ${programName} » : ${formatLongDate(oldDate)} → ${formatLongDate(newDate)}.`,
      link: `/coach/clients/${client.id}`,
      actor_id: client.auth_user_id ?? null, actor_name: clientName, entity_id: String(sessionId),
      meta: { programName, oldDate, newDate },
    })
  }
}

// ────────────────────────────────────────────────
// NOUVEAUX handlers : forfait
// ────────────────────────────────────────────────

async function handlePackageCreated(record: any) {
  const { client_id, coach_id, total_sessions, price_eur, id: packageId } = record
  const client = await getClientById(client_id)
  if (!client?.auth_user_id) return
  const coachName = coach_id ? await getUserDisplayName(coach_id) : 'Ton coach'
  await createNotification({
    user_id: client.auth_user_id, type: 'package_created',
    title: 'Nouveau forfait enregistré',
    body: `${coachName} a enregistré un forfait de ${total_sessions} séances.`,
    link: '/client/stats',
    actor_id: coach_id ?? null, actor_name: coachName, entity_id: String(packageId),
    meta: { totalSessions: total_sessions, priceEur: price_eur, coachName },
  })
}

async function handlePackageSessionLogged(record: any) {
  const { package_id, client_id, coach_id, session_date, session_type, id: sessionId } = record
  const client = await getClientById(client_id)
  if (!client?.auth_user_id) return

  // Compute remaining sessions on this package
  const { data: pkg } = await supabase
    .from('coach_packages').select('total_sessions').eq('id', package_id).maybeSingle()
  const { count } = await supabase
    .from('coach_package_sessions').select('*', { count: 'exact', head: true }).eq('package_id', package_id)
  const total = Number(pkg?.total_sessions ?? 0)
  const used = Number(count ?? 0)
  const remaining = Math.max(total - used, 0)

  const coachName = coach_id ? await getUserDisplayName(coach_id) : 'Ton coach'

  // 1) Notif client
  await createNotification({
    user_id: client.auth_user_id, type: 'package_session_logged',
    title: `Séance validée — ${remaining} restante${remaining > 1 ? 's' : ''}`,
    body: `${coachName} a coché ta séance du ${formatLongDate(session_date)}.`,
    link: '/client/stats',
    actor_id: coach_id ?? null, actor_name: coachName, entity_id: String(sessionId),
    meta: { sessionDate: session_date, sessionType: session_type, remaining, coachName },
  })

  // 2) Notif coach si stock bas (≤ 2 et > 0)
  if (remaining > 0 && remaining <= 2 && coach_id) {
    await createNotification({
      user_id: coach_id, type: 'package_low_stock',
      title: `Forfait de ${client.full_name || 'ton client'} bientôt épuisé`,
      body: `Plus que ${remaining} séance${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
      link: `/coach/clients/${client.id}`,
      actor_id: null, actor_name: null, entity_id: String(package_id),
      meta: { remaining, clientName: client.full_name, packageId: package_id },
    })
  }
}

// ────────────────────────────────────────────────
// HTTP entry point
// ────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const payload = (await req.json()) as WebhookPayload

    if (payload.type === 'INSERT' && payload.record) {
      switch (payload.table) {
        case 'messages':                 await handleNewMessage(payload.record); break
        case 'client_programs':          await handleProgramAssigned(payload.record); break
        case 'workout_logs':             await handleWorkoutCompleted(payload.record); break
        case 'scheduled_sessions':       await handleSessionScheduled(payload.record); break
        case 'coach_packages':           await handlePackageCreated(payload.record); break
        case 'coach_package_sessions':   await handlePackageSessionLogged(payload.record); break
      }
    } else if (payload.type === 'UPDATE' && payload.record && payload.old_record) {
      if (payload.table === 'scheduled_sessions') {
        await handleSessionUpdated(payload.record, payload.old_record)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('notify edge error', err)
    return new Response(
      JSON.stringify({ ok: false, error: String((err as Error).message ?? err) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})
