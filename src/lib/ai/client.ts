/**
 * Minimal OpenAI-compatible Chat Completions client.
 *
 * Server-only: it is imported exclusively from src/server/** and route handlers. The key is read
 * from process.env on the server and never serialised to the browser. Works with OpenAI and any
 * provider exposing POST {baseUrl}/chat/completions (Azure-compatible gateways, local LLM servers…).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiClient {
  model: string;
  complete(messages: ChatMessage[], opts?: { json?: boolean; temperature?: number; maxTokens?: number }): Promise<string>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createAiClient(config: AiConfig): AiClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, "");
  return {
    model: config.model,
    async complete(messages, opts = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 45_000);
      try {
        const res = await fetchImpl(`${base}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.maxTokens ?? 1800,
            ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
        if (!res.ok) {
          // Never echo the provider's body to users: it can contain request details.
          throw new AiError(`AI provider returned HTTP ${res.status}`, res.status);
        }
        const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim() === "") throw new AiError("AI provider returned no content");
        return content;
      } catch (err) {
        if (err instanceof AiError) throw err;
        if ((err as { name?: string })?.name === "AbortError") throw new AiError("AI request timed out");
        throw new AiError("AI request failed");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Returns null when AI is not configured — callers must degrade gracefully. */
export function aiClientFromEnv(env: Record<string, string | undefined> = process.env): AiClient | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  return createAiClient({
    apiKey,
    baseUrl: env.AI_BASE_URL?.trim() || "https://api.openai.com/v1",
    model: env.AI_MODEL?.trim() || "gpt-4o-mini",
  });
}

export function isAiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.AI_API_KEY?.trim());
}
