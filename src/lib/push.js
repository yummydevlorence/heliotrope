import { supabase } from '../supabase'

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// 'unsupported' | 'denied' | 'default' | 'granted'
export function pushStatus() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('unsupported')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(KEY),
    })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: subscription.endpoint, user_id: userId, sub: subscription.toJSON() })
  if (error) throw error
}