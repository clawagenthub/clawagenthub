import '@/app/globals.css'
import { ThemeProvider } from '@/lib/contexts/theme-context'
import { QueryProvider } from '@/lib/query/provider'

export const metadata = {
  title: 'ClawAgentHub - Authentication Dashboard',
  description: 'Secure authentication system with PocketBase-style setup',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('clawhub-theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
