import { redirect } from 'next/navigation'

export default function GatewaysPage() {
  redirect('/settings?tab=gateway')
}