'use client'

import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { useLogin } from '@/lib/query/hooks'

export default function LoginPage() {
  const router = useRouter()
  const loginMutation = useLogin()

  const handleLogin = async (email: string, password: string) => {
    console.log('\n🔐 [CLIENT LOGIN] Starting login process...')
    console.log(`   📧 Email: ${email}`)
    
    // Detect client-side origin
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:7777'
    console.log(`   🌐 Origin: ${origin}`)
    
    try {
      const result = await loginMutation.mutateAsync({ email, password, origin })
      
      console.log(`   ✅ Login successful!`)
      console.log(`   👤 User ID: ${result.user?.id}`)
      console.log(`   📧 Email: ${result.user?.email}`)
      
      // TanStack Query automatically refetches user data
      console.log(`   ↪️  Navigating to /dashboard...`)
      router.push('/dashboard')
    } catch (error) {
      console.log(`   ❌ Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to ClawAgentHub</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm onSubmit={handleLogin} />
        </CardContent>
      </Card>
    </div>
  )
}
