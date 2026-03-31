'use client'

import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useChangePassword } from '@/lib/query/hooks'

interface ChangePasswordFormProps {
  onSuccess: () => void
  onCancel?: () => void
  isForced?: boolean
}

export function ChangePasswordForm({
  onSuccess,
  onCancel,
  isForced = false,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  
  const changePasswordMutation = useChangePassword()

  const validatePassword = (password: string): string[] => {
    const errors: string[] = []

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setValidationErrors([])

    // Validate new password
    const errors = validatePassword(newPassword)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      setError('New password must be different from current password')
      return
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      })
      
      // Success - wait a moment then call onSuccess
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    }
  }

  if (changePasswordMutation.isSuccess) {
    return (
      <div className="rounded-lg bg-green-50 p-4 text-center">
        <div className="mb-2 text-green-800">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="font-medium text-green-800">
          Password changed successfully!
        </p>
        <p className="mt-1 text-sm text-green-700">
          Your password has been updated securely.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isForced && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Password Change Required
              </p>
              <p className="mt-1 text-sm text-yellow-700">
                For security reasons, you must change your initial password before continuing.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-yellow-50 p-3">
          <p className="mb-2 text-sm font-medium text-yellow-800">
            Password requirements:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <Input
        label="Current Password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        placeholder="Enter your current password"
        required
        autoComplete="current-password"
      />

      <Input
        label="New Password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Enter your new password"
        required
        autoComplete="new-password"
      />

      <Input
        label="Confirm New Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm your new password"
        required
        autoComplete="new-password"
      />

      <div className="rounded-lg bg-blue-50 p-3">
        <p className="text-xs text-blue-800">
          <strong>Security Requirements:</strong>
        </p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-blue-700">
          <li>At least 8 characters long</li>
          <li>Contains uppercase and lowercase letters</li>
          <li>Contains at least one number</li>
          <li>Different from your current password</li>
        </ul>
      </div>

      <div className="flex gap-3 pt-2">
        {!isForced && onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={changePasswordMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button 
          type="submit" 
          loading={changePasswordMutation.isPending} 
          className={isForced ? 'w-full' : 'flex-1'}
        >
          {isForced ? 'Set New Password' : 'Change Password'}
        </Button>
      </div>
    </form>
  )
}
