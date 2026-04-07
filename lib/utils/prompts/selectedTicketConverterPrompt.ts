/**
 * selectedTicketConverterPrompt.ts
 * 
 * Builds a prompt for converting text using a SPECIFIC selected format.
 * Used when user manually selects a format from the prompt templates.
 */

export interface SelectedTicketConverterPromptParams {
  targetText: string
  selectedFormat: {
    name: string
    description: string
  }
}

/**
 * Default template for selected ticket converter prompt.
 * Variables: {$targetText}, {$selectedFormat}
 */
export const DEFAULT_SELECTED_TICKET_CONVERTER_TEMPLATE = `Target Text: {$targetText}

Selected Format: {$selectedFormat}

Please convert the target text to match the selected format.`

/**
 * Build prompt for converting text with a specific selected format.
 */
export function buildSelectedTicketConverterPrompt(
  params: SelectedTicketConverterPromptParams,
  template: string = DEFAULT_SELECTED_TICKET_CONVERTER_TEMPLATE
): string {
  const { targetText, selectedFormat } = params
  
  const formatText = `**${selectedFormat.name}**
${selectedFormat.description}`

  return template
    .replace('{$targetText}', targetText)
    .replace('{$selectedFormat}', formatText)
}

/**
 * Get the default template string for configuration purposes.
 */
export function getDefaultSelectedTicketConverterTemplate(): string {
  return DEFAULT_SELECTED_TICKET_CONVERTER_TEMPLATE
}
