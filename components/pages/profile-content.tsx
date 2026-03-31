'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { Button } from '@/components/ui/button'
import { useUser } from '@/lib/query/hooks'
import type { PageContentProps } from './index'

export function ProfilePageContent({ user }: PageContentProps) {
  // Use TanStack Query hook for user state management with auto-refresh
  const { user: userData } = useUser()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const handlePasswordChangeSuccess = () => {
    // TanStack Query automatically refetches user data via mutation
    setIsPasswordModalOpen(false)
    alert('Password changed successfully!')
  }

  const currentUser = userData || user

  return (
    <>
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-3xl font-bold"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            Profile
          </h1>
          <p
            className="mt-2"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            Manage your account information and settings
          </p>
        </div>

        {/* Profile Card */}
        <div
          className="mb-6 rounded-lg border p-6 shadow-sm"
          style={{
            backgroundColor: `rgb(var(--bg-primary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <div className="flex items-center mb-6">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
              style={{ backgroundColor: `rgb(var(--bg-tertiary))` }}
            >
              👤
            </div>
            <div className="ml-6">
              <h2
                className="text-2xl font-semibold"
                style={{ color: `rgb(var(--text-primary))` }}
              >
                {currentUser.email}
              </h2>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium mt-2"
                style={{
                  backgroundColor: `rgb(var(--accent-primary))`,
                  color: 'white',
                }}
              >
                {currentUser.is_superuser ? '👑 Superuser Admin' : 'User'}
              </span>
            </div>
          </div>

          <div
            className="border-t pt-6"
            style={{ borderColor: `rgb(var(--border-color))` }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: `rgb(var(--text-primary))` }}
            >
              Account Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  Email:
                </span>
                <span
                  className="text-sm"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  {currentUser.email}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  User ID:
                </span>
                <span
                  className="text-sm font-mono"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  {currentUser.id}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: `rgb(var(--text-secondary))` }}
                >
                  Account Type:
                </span>
                <span
                  className="text-sm"
                  style={{ color: `rgb(var(--text-primary))` }}
                >
                  {currentUser.is_superuser ? 'Superuser Administrator' : 'Standard User'}
                </span>
              </div>
              {currentUser.is_superuser && (
                <div className="flex items-center justify-between py-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: `rgb(var(--text-secondary))` }}
                  >
                    Password Changed:
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: `rgb(var(--text-primary))` }}
                  >
                    {currentUser.first_password_changed ? '✅ Yes' : '⚠️ Not yet'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Settings Card */}
        {currentUser.is_superuser && (
          <div
            className="mb-6 rounded-lg border p-6 shadow-sm"
            style={{
              backgroundColor: `rgb(var(--bg-primary))`,
              borderColor: `rgb(var(--border-color))`,
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: `rgb(var(--text-primary))` }}
            >
              Security Settings
            </h3>
            <p
              className="mb-4 text-sm"
              style={{ color: `rgb(var(--text-secondary))` }}
            >
              As a superuser admin, you have access to enhanced security features.
              Keep your account secure by regularly updating your password.
            </p>
            <Button onClick={() => setIsPasswordModalOpen(true)}>
              🔒 Change Password
            </Button>
          </div>
        )}

        {/* Preferences Card */}
        <div
          className="rounded-lg border p-6 shadow-sm"
          style={{
            backgroundColor: `rgb(var(--bg-primary))`,
            borderColor: `rgb(var(--border-color))`,
          }}
        >
          <h3
            className="text-lg font-semibold mb-4"
            style={{ color: `rgb(var(--text-primary))` }}
          >
            Preferences
          </h3>
          <p
            className="text-sm"
            style={{ color: `rgb(var(--text-secondary))` }}
          >
            Additional profile settings and preferences will be available here.
          </p>
        </div>
      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Password"
        dismissible={true}
      >
        <ChangePasswordForm
          onSuccess={handlePasswordChangeSuccess}
          onCancel={() => setIsPasswordModalOpen(false)}
          isForced={false}
        />
      </Modal>
    </>
  )
}
