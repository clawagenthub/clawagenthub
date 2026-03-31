# Login Loading Issue - Visual Explanation

## Current Problem Flow

```mermaid
graph TD
    A[User opens /login page] --> B[LoginPage component renders]
    B --> C[Imports useUser from @/lib/query/hooks]
    C --> D[Module resolution conflict]
    D --> E[Old Jotai store code executes]
    E --> F[useRefreshUser with async atom]
    F --> G[React Error: Async Client Component]
    G --> H[Component fails to render]
    H --> I[Infinite loading spinner]
    
    style G fill:#ff6b6b
    style I fill:#ff6b6b
    style E fill:#ffd93d
```

## Root Cause: Dual State Management Systems

```mermaid
graph LR
    subgraph "Old System - Jotai"
        A1[lib/store/atoms/userAtom.ts]
        A2[lib/store/hooks/useUser.ts]
        A3[lib/store/provider.tsx]
        A1 --> A2
        A2 --> A4[useRefreshUser - CAUSES ERROR]
    end
    
    subgraph "New System - TanStack Query"
        B1[lib/query/hooks/useUser.ts]
        B2[lib/query/provider.tsx]
        B3[app/layout.tsx uses QueryProvider]
        B1 --> B3
    end
    
    subgraph "Application"
        C1[app/login/page.tsx]
        C2[Imports from @/lib/query/hooks]
    end
    
    C1 --> C2
    C2 -.Module Resolution Conflict.-> A2
    C2 --> B1
    
    style A4 fill:#ff6b6b
    style A1 fill:#ffd93d
    style A2 fill:#ffd93d
    style B1 fill:#51cf66
    style B2 fill:#51cf66
```

## The Fix

```mermaid
graph TD
    A[Remove lib/store directory] --> B[Clear .next cache]
    B --> C[Restart dev server]
    C --> D[Module resolution uses only TanStack Query]
    D --> E[LoginPage renders correctly]
    E --> F[Login form visible immediately]
    
    style A fill:#51cf66
    style B fill:#51cf66
    style C fill:#51cf66
    style F fill:#51cf66
```

## Before vs After

### Before (Current State)
```
lib/
├── query/          ✅ New TanStack Query (in use)
│   ├── hooks/
│   │   └── useUser.ts
│   └── provider.tsx
└── store/          ❌ Old Jotai (causing conflict)
    ├── atoms/
    │   └── userAtom.ts (async atom)
    ├── hooks/
    │   └── useUser.ts (useRefreshUser error)
    └── provider.tsx
```

### After (Fixed State)
```
lib/
└── query/          ✅ Only TanStack Query
    ├── hooks/
    │   └── useUser.ts
    └── provider.tsx
```

## Error Chain

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant LoginPage
    participant OldStore as Old Jotai Store
    participant React
    
    User->>Browser: Navigate to /login
    Browser->>LoginPage: Render component
    LoginPage->>OldStore: Module resolution picks up old code
    OldStore->>React: useRefreshUser() with async atom
    React->>React: Detect async client component
    React-->>Browser: Error: Async Client Component
    Browser-->>User: Infinite loading spinner
    
    Note over React,Browser: Component never completes render
```

## Solution Steps

1. **Archive old code**: `mv lib/store lib/store.old`
2. **Clear cache**: `rm -rf .next`
3. **Restart**: `npm run dev`
4. **Test**: Open http://localhost:3001/login

## Expected Result

```mermaid
graph LR
    A[User opens /login] --> B[LoginPage renders]
    B --> C[useUser from TanStack Query]
    C --> D[Fetch user data]
    D --> E[Show login form immediately]
    E --> F[User can login]
    
    style E fill:#51cf66
    style F fill:#51cf66
```
