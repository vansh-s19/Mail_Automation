type MergeFields = Record<string, unknown>;

/**
 * Replaces {{tag}} placeholders with contact field values.
 * Unresolved tags are left as-is rather than silently dropped, so a bad
 * merge tag is visible instead of shipping a blank in the email body.
 */
export function renderMergeTags(template: string, fields: MergeFields): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = fields[key];
    return value === undefined || value === null ? match : String(value);
  });
}
