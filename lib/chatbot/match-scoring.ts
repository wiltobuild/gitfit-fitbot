export function scoreTriggerFamily(message: string, triggerPatterns: RegExp[]): number { return triggerPatterns.some((pattern) => pattern.test(message)) ? 1 : 0; }
export function scoreEntity(message: string, entityPatterns: RegExp[]): number { return entityPatterns.some((pattern) => pattern.test(message)) ? 1 : 0; }
