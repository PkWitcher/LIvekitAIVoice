// Prompt variable helpers — supports {{variable_name}} tokens in system prompts / first messages

export interface PromptVariable {
  name: string;
  default_value: string;
}

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Extract unique {{variable}} names referenced in a block of text, in order of first appearance. */
export function extractVariableNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN);
  while ((match = re.exec(text || "")) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      names.push(match[1]);
    }
  }
  return names;
}

/** Merge newly-detected variable names into an existing variable list, preserving saved defaults. */
export function mergeVariables(existing: PromptVariable[], names: string[]): PromptVariable[] {
  const byName = new Map(existing.map((v) => [v.name, v]));
  return names.map((name) => byName.get(name) ?? { name, default_value: "" });
}

/** Replace {{variable}} tokens with the supplied values, leaving unknown/blank tokens untouched. */
export function substituteVariables(text: string, values: Record<string, string>): string {
  return (text || "").replace(VARIABLE_PATTERN, (match, key) =>
    key in values && values[key].trim() ? values[key] : match
  );
}
