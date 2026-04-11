# Fix: selectedProject not added to ticketJson

## Issue
When a ticket has a `project_id` set, the `ticketJson` in flow prompts was not resolving the project details. Agents couldn't tell which project the ticket referred to.

## Root Cause
`flow-helpers.ts` built `ticketJson` by spreading the ticket object directly, which only included `project_id` (the ID), not the project's `name`, `description`, and `value`.

## Fix Applied
Modified two files to fetch the project and add `selectedProject` to `ticketJson`:

### Files Modified
1. `/config/Desktop/projects/clawagenthub/app/api/tickets/[ticketId]/flow/lib/flow-helpers.ts`
2. `/config/Desktop/projects/clawagenthub/lib/flow/lib/flow-helpers.ts`

### Changes
1. Added `getProjectById` to imports
2. Added logic to fetch project when `ticket.project_id` exists:
   ```typescript
   let selectedProject: { name: string; description: string | null; value: string | null } | null = null
   if (ticket.project_id) {
     const project = getProjectById(db, ticket.project_id)
     if (project) {
       selectedProject = {
         name: project.name,
         description: project.description,
         value: project.value,
       }
     }
   }
   ```
3. Added `selectedProject` to the `ticketJson` object

## Result
`ticketJson` now includes:
```json
{
  "id": "...",
  "project_id": "...",
  "selectedProject": {
    "name": "LinkedIn Campaign",
    "description": "...",
    "value": "..."
  },
  ...
}
```

## Test
Create/select a ticket with a project in ClawAgentHub, trigger the flow, and verify `selectedProject` appears in `{$ticketJson}`.
