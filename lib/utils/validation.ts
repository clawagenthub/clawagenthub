import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const setupSchema = z.object({
  token: z.string().min(1, 'Setup token is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SetupInput = z.infer<typeof setupSchema>

export function validateSetupPasswords(data: SetupInput): {
  valid: boolean
  error?: string
} {
  if (data.password !== data.confirmPassword) {
    return { valid: false, error: 'Passwords do not match' }
  }
  return { valid: true }
}
