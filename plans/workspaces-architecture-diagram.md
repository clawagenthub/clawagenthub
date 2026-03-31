# Workspaces Feature - Architecture Diagrams

## Database Schema Relationships

```mermaid
erDiagram
    users ||--o{ workspaces : owns
    users ||--o{ workspace_members : belongs_to
    workspaces ||--o{ workspace_members : has
    users ||--o{ sessions : has
    sessions }o--|| workspaces : current_workspace

    users {
        string id PK
        string email
        string password_hash
        boolean is_superuser
        boolean first_password_changed
        datetime created_at
        datetime updated_at
    }

    workspaces {
        string id PK
        string name
        string owner_id FK
        datetime created_at
        datetime updated_at
    }

    workspace_members {
        string id PK
        string workspace_id FK
        string user_id FK
        string role
        datetime joined_at
    }

    sessions {
        string id PK
        string user_id FK
        string token
        string current_workspace_id FK
        datetime expires_at
        datetime created_at
    }
```

## Component Hierarchy

```mermaid
graph TD
    A[Dashboard Page] --> B[DashboardLayout]
    B --> C[Sidebar]
    B --> D[Main Content Area]
    
    C --> E[WorkspaceSelector]
    C --> F[Navigation Menu]
    C --> G[User Profile Section]
    
    E --> H[Dropdown Component]
    H --> I[Workspace List]
    H --> J[Create New Workspace Button]
    
    J --> K[Create Workspace Modal]
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#ffe1e1
    style E fill:#e1ffe1
```

## User Flow - Workspace Switching

```mermaid
sequenceDiagram
    actor User
    participant UI as Workspace Dropdown
    participant API as /api/workspaces/switch
    participant Session as Session Store
    participant DB as Database
    
    User->>UI: Click workspace dropdown
    UI->>User: Show workspace list
    User->>UI: Select workspace
    UI->>API: POST switch request
    API->>Session: Verify user access
    Session->>DB: Check workspace_members
    DB-->>Session: Access confirmed
    API->>DB: Update session.current_workspace_id
    DB-->>API: Success
    API-->>UI: Workspace switched
    UI->>UI: Refresh page content
    UI-->>User: Show new workspace
```

## User Flow - Create Workspace

```mermaid
sequenceDiagram
    actor User
    participant UI as Workspace Dropdown
    participant Modal as Create Modal
    participant API as /api/workspaces/create
    participant DB as Database
    
    User->>UI: Click Create New Workspace
    UI->>Modal: Open modal
    Modal->>User: Show name input
    User->>Modal: Enter workspace name
    Modal->>API: POST create request
    API->>DB: INSERT into workspaces
    DB-->>API: Workspace created
    API->>DB: INSERT into workspace_members
    DB-->>API: Member added as owner
    API->>DB: UPDATE session.current_workspace_id
    DB-->>API: Session updated
    API-->>Modal: Success response
    Modal->>UI: Close modal
    UI->>UI: Refresh workspace list
    UI-->>User: Show new workspace as current
```

## Application Architecture Layers

```mermaid
graph TB
    subgraph Client Layer
        A[Dashboard Page]
        B[Sidebar Component]
        C[WorkspaceSelector]
        D[Dropdown Component]
    end
    
    subgraph State Management
        E[WorkspaceContext]
        F[React State]
    end
    
    subgraph API Layer
        G[GET /api/workspaces]
        H[POST /api/workspaces/create]
        I[POST /api/workspaces/switch]
        J[GET /api/workspaces/current]
    end
    
    subgraph Database Layer
        K[workspaces table]
        L[workspace_members table]
        M[sessions table]
        N[users table]
    end
    
    A --> B
    B --> C
    C --> D
    C --> E
    E --> F
    
    E --> G
    E --> H
    E --> I
    E --> J
    
    G --> K
    G --> L
    H --> K
    H --> L
    I --> M
    J --> K
    J --> L
    
    K --> N
    L --> N
    L --> K
    M --> N
    M --> K
    
    style Client Layer fill:#e1f5ff
    style State Management fill:#fff4e1
    style API Layer fill:#ffe1e1
    style Database Layer fill:#e1ffe1
```

## Sidebar Layout Structure

```mermaid
graph TD
    A[Sidebar Container] --> B[Top Section]
    A --> C[Middle Section]
    A --> D[Bottom Section]
    
    B --> E[WorkspaceSelector Dropdown]
    E --> F[Current Workspace Display]
    E --> G[Dropdown Menu]
    
    G --> H[Workspace List Items]
    G --> I[Divider]
    G --> J[Create New Workspace]
    
    C --> K[Navigation Links]
    K --> L[Dashboard]
    K --> M[Settings]
    K --> N[Other Pages]
    
    D --> O[User Profile Info]
    D --> P[Logout Button]
    
    style A fill:#f0f0f0
    style B fill:#e1f5ff
    style C fill:#fff4e1
    style D fill:#ffe1e1
```

## Implementation Flow

```mermaid
graph LR
    A[Phase 1: Database] --> B[Phase 2: Seeding]
    B --> C[Phase 3: API Layer]
    C --> D[Phase 4: UI Components]
    D --> E[Phase 5: Integration]
    E --> F[Phase 6: Testing]
    
    A1[Create Migration] --> A
    A2[Update Schema Types] --> A
    
    B1[Update db-seed.ts] --> B
    B2[Create Admin Workspace] --> B
    
    C1[Workspace Routes] --> C
    C2[Create/Switch APIs] --> C
    
    D1[Dropdown Component] --> D
    D2[Sidebar Component] --> D
    D3[WorkspaceSelector] --> D
    
    E1[Add Context] --> E
    E2[Update Dashboard] --> E
    
    F1[Test Flows] --> F
    F2[Polish UI] --> F
    
    style A fill:#ff9999
    style B fill:#ffcc99
    style C fill:#ffff99
    style D fill:#99ff99
    style E fill:#99ccff
    style F fill:#cc99ff
```
