import {
  useStatuses,
  useWorkspaceMembers,
  useGatewayAgents,
  useTicketFlowConfig,
  useTicketFlowStatus,
  useStartTicketFlow,
  useStopTicketFlow,
  useWorkspacePrompts,
  useProjects,
  useCreateTicket,
  useUpdateTicket,
} from '@/lib/query/hooks'
import {
  useAssigneeOptions,
  useStatusOptions,
} from '../ticket-modal-form-utils'
import type { TicketModalInitialData } from '../ticket-modal.types'

export function useTicketModalQueries(initialData?: TicketModalInitialData) {
  const { data: statuses } = useStatuses()
  const { data: workspaceMembers } = useWorkspaceMembers()
  const { data: gatewayAgents } = useGatewayAgents()
  const editingTicketId =
    initialData?.id && initialData?.title ? initialData.id : null
  const { data: existingFlowConfigs } = useTicketFlowConfig(editingTicketId)
  const { data: flowRuntimeStatus } = useTicketFlowStatus(editingTicketId)
  const { mutateAsync: startFlow, isPending: isStartingFlow } =
    useStartTicketFlow()
  const { mutateAsync: stopFlow, isPending: isStoppingFlow } =
    useStopTicketFlow()
  const { data: workspacePrompts } = useWorkspacePrompts()
  const { data: projects } = useProjects()
  const { mutateAsync: createTicket } = useCreateTicket()
  const { mutateAsync: updateTicket } = useUpdateTicket()

  const statusOptions = useStatusOptions(statuses)
  const assigneeOptions = useAssigneeOptions(workspaceMembers)
  const projectOptions = projects
    ? [
        { value: '', label: 'No Project' },
        ...projects.map((project) => ({
          value: project.id,
          label: project.name,
        })),
      ]
    : []

  return {
    statuses,
    gatewayAgents,
    workspacePrompts,
    editingTicketId,
    existingFlowConfigs,
    flowRuntimeStatus,
    startFlow,
    stopFlow,
    isStartingFlow,
    isStoppingFlow,
    createTicket,
    updateTicket,
    statusOptions,
    assigneeOptions,
    projectOptions,
  }
}
