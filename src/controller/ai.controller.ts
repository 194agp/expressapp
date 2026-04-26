import type { Request, Response } from 'express';

type AIImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

interface AIImage {
  base64: string;
  mimeType: AIImageMimeType;
}

interface AIRequest {
  provider: 'gemini' | 'openai';
  prompt: string;
  model?: string;
  systemPrompt?: string;
  image?: AIImage;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT = 'gemini-2.0-flash';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_DEFAULT = 'gpt-4o-mini';

async function callGemini(req: AIRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não definida no ambiente.');

  const model = req.model || process.env.GEMINI_DEFAULT_MODEL || GEMINI_DEFAULT;
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const parts: unknown[] = [];
  if (req.image) parts.push({ inlineData: { mimeType: req.image.mimeType, data: req.image.base64 } });
  parts.push({ text: req.prompt });

  const body: Record<string, unknown> = { contents: [{ role: 'user', parts }] };
  if (req.systemPrompt) body.systemInstruction = { parts: [{ text: req.systemPrompt }] };

  const genConfig: Record<string, unknown> = {};
  if (req.maxTokens) genConfig.maxOutputTokens = req.maxTokens;
  if (req.temperature !== undefined) genConfig.temperature = req.temperature;
  if (req.jsonMode) genConfig.responseMimeType = 'application/json';
  if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;

  const start = Date.now();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json() as any;
  const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  const meta = data.usageMetadata;

  return {
    provider: 'gemini', content, model,
    usage: meta ? { promptTokens: meta.promptTokenCount ?? 0, completionTokens: meta.candidatesTokenCount ?? 0, totalTokens: meta.totalTokenCount ?? 0 } : undefined,
    durationMs: Date.now() - start,
  };
}

async function callOpenAI(req: AIRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não definida no ambiente.');

  const model = req.model || process.env.OPENAI_DEFAULT_MODEL || OPENAI_DEFAULT;

  type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
  const userContent: Part[] = [];
  if (req.image) userContent.push({ type: 'image_url', image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } });
  userContent.push({ type: 'text', text: req.prompt });

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.image ? userContent : req.prompt });

  const start = Date.now();
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, messages,
      ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const data = await res.json() as any;
  return {
    provider: 'openai', content: data.choices?.[0]?.message?.content ?? '',
    model: data.model ?? model,
    usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } : undefined,
    durationMs: Date.now() - start,
  };
}

export async function complete(req: Request, res: Response) {
  const body = req.body as Partial<AIRequest>;

  if (!body.provider || !['gemini', 'openai'].includes(body.provider)) {
    return res.status(400).json({ message: 'provider inválido. Use: gemini, openai.' });
  }
  if (!body.prompt?.trim()) {
    return res.status(400).json({ message: 'prompt é obrigatório.' });
  }

  try {
    const result = body.provider === 'gemini'
      ? await callGemini(body as AIRequest)
      : await callOpenAI(body as AIRequest);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[ai.controller]', err);
    return res.status(500).json({ message: 'Erro ao processar requisição de IA.', error: String(err) });
  }
}
