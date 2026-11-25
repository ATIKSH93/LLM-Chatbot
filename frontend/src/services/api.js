const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  globalThis.process?.env?.VITE_API_BASE_URL ||
  'http://localhost:8000';

/**
 * Sends a chat message to the backend POST /chat endpoint.
 *
 * @param {Object} params
 * @param {string} params.sessionId Client-generated session UUID
 * @param {string} params.message Latest user message
 * @param {string} [params.systemPrompt] Optional system prompt
 * @returns {Promise<{session_id: string, reply: string, metadata: {resolution_source: string, model: string, latency_ms: number, input_tokens: number, output_tokens: number, key_id: string|null, fallback_attempts: number}}>}
 */
export async function sendChatMessage({ sessionId, message, systemPrompt }) {
  let response;
  try {
    const payload = {
      session_id: sessionId,
      message,
    };
    if (systemPrompt) {
      payload.system_prompt = systemPrompt;
    }

    response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(
      `Could not connect to the backend server. Please verify the backend is running at ${API_BASE_URL}. (${err.message})`,
      { cause: err }
    );
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        if (typeof errJson.detail === 'string') {
          errorDetail = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errorDetail = errJson.detail
            .map((item) => (item.msg ? `${item.loc ? item.loc.join('.') + ': ' : ''}${item.msg}` : JSON.stringify(item)))
            .join('; ');
        } else {
          errorDetail = JSON.stringify(errJson.detail);
        }
      }
    } catch {
      // response body was not valid JSON
    }

    if (response.status === 422) {
      throw new Error(errorDetail ? `Validation Error (422): ${errorDetail}` : 'Invalid request (422).');
    }
    if (response.status === 503) {
      throw new Error(
        errorDetail
          ? `Provider Unavailable (503): ${errorDetail}`
          : 'All AI model providers are currently unavailable. Please try again shortly.'
      );
    }
    throw new Error(errorDetail ? `Server Error (${response.status}): ${errorDetail}` : `Request failed with status ${response.status}.`);
  }

  return await response.json();
}
