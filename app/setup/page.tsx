'use client'

import { SetupForm } from '@/components/auth/setup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('No setup token provided')
      setValidating(false)
      return
    }

    // Validate token
    fetch(`/api/setup/check?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          setError('Invalid or expired setup token')
        }
        setValidating(false)
      })
      .catch(() => {
        setError('Failed to validate setup token')
        setValidating(false)
      })
  }, [token])

  const handleSetup = async (email: string, password: string, token: string) => {
    const response = await fetch('/api/setup/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, token }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Setup failed')
    }

    router.push('/login?setup=success')
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Validating setup token...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Setup Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error || 'Invalid setup link'}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>First-Time Setup</CardTitle>
          <CardDescription>
            Create your superuser account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm token={token} onSubmit={handleSetup} />
        </CardContent>
      </Card>
    </div>
  )
}
