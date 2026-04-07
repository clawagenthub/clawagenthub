/**
 * autoTicketConverterPrompt.ts
 * 
 * Builds a prompt for automatically converting text by selecting
 * the best format from ALL available formats. The AI decides which
 * format is most appropriate for the given text.
 */

export interface AutoTicketConverterPromptParams {
  targetText: string
  promptFormats: Array<{
    name: string
    description: string
  }>
}

/**
 * Default template for auto ticket converter prompt.
 * Variables: {$targetText}, {$promptFormats}
 */
export const DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE = `Target Text: {$targetText}

Formats:
{$promptFormats}

Analyze the target text and select the most appropriate format from the available formats above. Then convert the target text to match the selected format structure.`


/**
 * Build prompt for auto-converting text by letting AI select best format.
 */
export function buildAutoTicketConverterPrompt(
  params: AutoTicketConverterPromptParams,
  template: string = DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE
): string {
  const { targetText, promptFormats } = params
  
  const formatsText = promptFormats
    .map((format, index) => `${index + 1}. **${format.name}**
   ${format.description}`)
    .join('\n\n')

  return template
    .replace('{$targetText}', targetText)
    .replace('{$promptFormats}', formatsText)
}

/**
 * Get the default template string for configuration purposes.
 */
export function getDefaultAutoTicketConverterTemplate(): string {
  return DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE
}
