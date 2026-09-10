'use strict';

const { normalizeEmail } = require('./email-security');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 10_000;

class EmailTransportError extends Error {
    constructor(code, retryable, status = null) {
        super('Email delivery failed');
        this.name = 'EmailTransportError';
        this.code = code;
        this.retryable = retryable;
        this.status = status;
    }
}

function extractConfiguredAddress(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 320) return null;
    const trimmed = value.trim();
    const displayMatch = /^(?:[^<>\r\n]{1,128}\s*)?<([^<>\s]+)>$/.exec(trimmed);
    const address = normalizeEmail(displayMatch ? displayMatch[1] : trimmed);
    return address ? trimmed : null;
}

function classifyProviderStatus(status) {
    if (status === 408 || status === 425 || status === 429 || status >= 500) {
        return { code: `EMAIL_PROVIDER_${status}`, retryable: true };
    }
    return { code: `EMAIL_PROVIDER_${status}`, retryable: false };
}

function createResendTransport({ apiKey, from, replyTo = null, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const configuredFrom = extractConfiguredAddress(from);
    const configuredReplyTo = replyTo ? extractConfiguredAddress(replyTo) : null;
    if (
        typeof apiKey !== 'string' || !apiKey.trim() ||
        !configuredFrom || (replyTo && !configuredReplyTo) ||
        typeof fetchImpl !== 'function' ||
        !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000
    ) {
        throw new EmailTransportError('EMAIL_TRANSPORT_CONFIG_INVALID', false);
    }

    return Object.freeze({
        provider: 'resend',
        async send({ to, subject, html = null, text = null } = {}) {
            const recipient = normalizeEmail(to);
            if (
                !recipient || typeof subject !== 'string' || !subject.trim() || subject.length > 200 ||
                (typeof html !== 'string' && typeof text !== 'string')
            ) {
                throw new EmailTransportError('EMAIL_MESSAGE_INVALID', false);
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            timeout.unref?.();
            let response;
            try {
                const body = { from: configuredFrom, to: [recipient], subject: subject.trim() };
                if (configuredReplyTo) body.reply_to = configuredReplyTo;
                if (typeof html === 'string') body.html = html;
                if (typeof text === 'string') body.text = text;
                response = await fetchImpl(RESEND_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
            } catch (err) {
                if (controller.signal.aborted || (err && err.name === 'AbortError')) {
                    throw new EmailTransportError('EMAIL_TIMEOUT', true);
                }
                throw new EmailTransportError('EMAIL_NETWORK_ERROR', true);
            } finally {
                clearTimeout(timeout);
            }

            if (!response || !response.ok) {
                const status = response && Number.isInteger(response.status) ? response.status : 503;
                const classified = classifyProviderStatus(status);
                throw new EmailTransportError(classified.code, classified.retryable, status);
            }

            let result;
            try { result = await response.json(); }
            catch (err) { throw new EmailTransportError('EMAIL_PROVIDER_RESPONSE_INVALID', true, response.status); }
            if (!result || typeof result.id !== 'string' || !result.id || result.id.length > 255) {
                throw new EmailTransportError('EMAIL_PROVIDER_RESPONSE_INVALID', true, response.status);
            }
            return { providerMessageId: result.id };
        }
    });
}

function createEmailTransport({ provider, ...options } = {}) {
    const normalizedProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : '';
    if (normalizedProvider !== 'resend') {
        throw new EmailTransportError('EMAIL_PROVIDER_UNSUPPORTED', false);
    }
    return createResendTransport(options);
}

function createEmailTransportFromEnv(env = process.env, options = {}) {
    return createEmailTransport({
        provider: env.EMAIL_PROVIDER,
        from: env.EMAIL_FROM,
        replyTo: env.EMAIL_REPLY_TO || null,
        apiKey: env.RESEND_API_KEY,
        ...options
    });
}

module.exports = {
    RESEND_ENDPOINT,
    EmailTransportError,
    extractConfiguredAddress,
    classifyProviderStatus,
    createResendTransport,
    createEmailTransport,
    createEmailTransportFromEnv
};
