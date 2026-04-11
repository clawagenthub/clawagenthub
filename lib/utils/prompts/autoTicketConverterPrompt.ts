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
    value: string
  }>
  selectedProject?: {
    name: string
    description: string | null
    value: string | null
  } | null
}

/**
 * Default template for auto ticket converter prompt.
 * Variables: {$targetText}, {$promptFormats}
 */
export const DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE = `
<auto_format_prompt version="1.0">
  <system_role>
    <statement>You are an autonomous data formatting agent. Your objective is to analyze target text, select the best matching format, and execute the conversion perfectly on the first attempt.</statement>
  </system_role>

  <task_input>
    <target_text><![CDATA[{$targetText}]]></target_text>
    <available_formats><![CDATA[{$promptFormats}]]></available_formats>
    <selected_project><![CDATA[{$selectedProject}]]></selected_project>
  </task_input>

  <mandatory_rules priority="highest">
    <rule order="1">Autonomous Execution: Do not ask for user opinions, clarifications, or permissions. Choose exactly one format and perform the conversion immediately.</rule>
    <rule order="2">No External Retrieval (Timeout Prevention): If the target text contains file paths, directories, URLs, or external example references, IGNORE THEM as external sources. DO NOT attempt to use tools to read, fetch, or resolve external files. Base your conversion strictly on the raw text provided in the <target_text> block.</rule>
    <rule order="3">Output Limitation: Provide ONLY the final XML result. Do not include conversational filler, greetings, explanations, or markdown formatting outside of the requested XML structure.</rule>
  </mandatory_rules>

  <response_format strict="true" output_type="xml">
    <instructions>Output your response strictly in the following XML structure. Enclose the converted text in CDATA to prevent XML parsing errors.</instructions>
    <template>
<conversion_result>
  <selected_format>Name of the chosen format</selected_format>
  <converted_data><![CDATA[
[Insert the fully converted text here based on the selected format structure]
  ]]></converted_data>
</conversion_result>
    </template>
  </response_format>
</auto_format_prompt>
`
/**
 * Build prompt for auto-converting text by letting AI select best format.
 */
export function buildAutoTicketConverterPrompt(
  params: AutoTicketConverterPromptParams,
  template: string = DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE
): string {
  const { targetText, promptFormats, selectedProject } = params

  // Serialize as JSON array with renamed keys (description -> desc)
  const formatsJson = JSON.stringify(
    promptFormats.map((format) => ({
      name: format.name,
      desc: format.description,
      value: format.value,
    }))
  )

  // Format selectedProject for display
  let selectedProjectJson = 'null'
  if (selectedProject) {
    selectedProjectJson = JSON.stringify({
      name: selectedProject.name,
      desc: selectedProject.description,
      value: selectedProject.value,
    })
  }

  return template
    .replace('{$targetText}', targetText)
    .replace('{$promptFormats}', formatsJson)
    .replace('{$selectedProject}', selectedProjectJson)
}

/**
 * Get the default template string for configuration purposes.
 */
export function getDefaultAutoTicketConverterTemplate(): string {
  return DEFAULT_AUTO_TICKET_CONVERTER_TEMPLATE
}
