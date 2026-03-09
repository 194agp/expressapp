import 'dotenv/config';

const server = process.env.APIWA_SERVER!;
const key = process.env.APIWA_KEY!;

const possibleHosts = [
  'https://us.api-wa.me',
  'https://server.api-wa.me',
];

export async function resilientFetch(): Promise<Response> {
  const options: RequestInit = { method: 'GET' };
  const path = `/${key}/instance`;
  let lastError: Error | undefined;

  for (const base of possibleHosts) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(`⚠️ Falhou em ${url}: ${res.status} ${res.statusText}`);
      lastError = new Error(`Erro ${res.status} em ${url}`);
    } catch (err: any) {
      console.warn(`⚠️ Erro de rede em ${url}:`, err.message);
      lastError = err;
    }
  }
  throw lastError;
}

export async function sendMessage(to: string, text: string): Promise<unknown> {
  console.log('📤 Enviando mensagem para', to, '->', text);

  const url = `${server}/${key}/message/text`;
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, text }),
  };

  try {
    const res = await fetch(url, options);
    const raw = await res.text();
    const ct = res.headers.get('content-type') || '';

    let data: unknown;
    if (ct.includes('application/json')) {
      try { data = JSON.parse(raw); }
      catch { data = { _raw: raw }; }
    } else {
      data = raw;
    }

    if (!res.ok) {
      console.error(`❌ WhatsApp API erro HTTP ${res.status} ${res.statusText}`);
      console.error('Resposta:', data);
      throw new Error(`Falha ao enviar mensagem. Status ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    }

    console.log('✅ Mensagem enviada com sucesso:', data);
    return data;
  } catch (err) {
    console.error('💥 Erro na função sendMessage:', err);
    throw err;
  }
}

export async function sendImage(to: string, text: string, caption: string): Promise<unknown> {
  const url = `${server}/${key}/message/base64/image`;
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, base64: text, caption }),
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`sendImage falhou (${response.status}): ${err}`);
    }
    return await response.json();
  } catch (err) {
    console.error('💥 Erro na função sendImage:', err);
    throw err;
  }
}

export async function sendSurvey(to: string, name: string, opts: string[]): Promise<unknown> {
  const url = `${server}/${key}/message/survey`;
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, name, options: opts }),
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`sendSurvey falhou (${response.status}): ${err}`);
    }
    return await response.json();
  } catch (err) {
    console.error('💥 Erro na função sendSurvey:', err);
    throw err;
  }
}
