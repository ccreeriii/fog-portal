'use strict';

const DEFAULT_PUBLIC_ORIGIN =
    'https://fogmin.site';

const TEMPLATE_MARKER =
    'data-fog-email-template="v1"';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizePublicOrigin(value) {
    const candidate =
        typeof value === 'string' &&
        value.trim()
            ? value.trim()
            : DEFAULT_PUBLIC_ORIGIN;

    try {
        const parsed =
            new URL(candidate);

        if (
            parsed.protocol !== 'https:' ||
            parsed.username ||
            parsed.password
        ) {
            return DEFAULT_PUBLIC_ORIGIN;
        }

        return parsed.origin;
    } catch (error) {
        return DEFAULT_PUBLIC_ORIGIN;
    }
}

function textToHtml(text) {
    const escaped =
        escapeHtml(text);

    return escaped
        .split(/\r?\n/)
        .map(line =>
            line.trim()
                ? line
                : '&nbsp;'
        )
        .map(line =>
            `<div style="margin:0 0 10px;">${line}</div>`
        )
        .join('');
}

function renderBrandedEmail({
    html = null,
    text = null,
    publicOrigin = null
} = {}) {
    if (
        typeof html === 'string' &&
        html.includes(TEMPLATE_MARKER)
    ) {
        return html;
    }

    const origin =
        normalizePublicOrigin(
            publicOrigin
        );

    const body =
        typeof html === 'string' &&
        html.trim()
            ? html
            : textToHtml(
                typeof text === 'string'
                    ? text
                    : ''
            );

    const logoUrl =
        `${origin}/img/logo.png`;

    const portalUrl =
        `${origin}/`;

    return [
        '<!doctype html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<meta name="color-scheme" content="light">',
        '<title>Fire Of God Ministries Community Portal</title>',
        '</head>',
        '<body style="margin:0;padding:0;background:#f4efe9;font-family:Arial,Helvetica,sans-serif;color:#3d332b;">',

        `<table ${TEMPLATE_MARKER} role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4efe9;margin:0;padding:0;">`,
        '<tr>',
        '<td align="center" style="padding:28px 14px;">',

        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #eadfd5;">',

        '<tr>',
        '<td style="background:#4b2f24;padding:24px 28px;">',
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">',
        '<tr>',

        '<td width="72" valign="middle" style="width:72px;padding-right:16px;">',
        `<img src="${escapeHtml(logoUrl)}" width="64" alt="Fire Of God Ministries" style="display:block;width:64px;height:auto;max-width:64px;border:0;">`,
        '</td>',

        '<td valign="middle">',
        '<div style="font-size:20px;line-height:1.2;font-weight:800;letter-spacing:.3px;color:#ffffff;">FIRE OF GOD MINISTRIES</div>',
        '<div style="margin-top:5px;font-size:14px;line-height:1.35;font-weight:600;color:#f5d7bd;">Community Portal</div>',
        '</td>',

        '</tr>',
        '</table>',
        '</td>',
        '</tr>',

        '<tr>',
        '<td style="height:5px;background:#d97735;font-size:0;line-height:0;">&nbsp;</td>',
        '</tr>',

        '<tr>',
        '<td style="padding:32px 30px;font-size:16px;line-height:1.65;color:#3d332b;">',
        body,
        '</td>',
        '</tr>',

        '<tr>',
        '<td style="padding:22px 30px;background:#fbf7f2;border-top:1px solid #eadfd5;text-align:center;">',
        '<div style="font-size:13px;line-height:1.6;color:#75675e;">',
        'Sent through the Fire Of God Ministries Community Portal',
        '</div>',
        `<div style="margin-top:7px;font-size:13px;line-height:1.6;"><a href="${escapeHtml(portalUrl)}" style="color:#a75324;text-decoration:none;font-weight:700;">fogmin.site</a> &nbsp;•&nbsp; <a href="mailto:support@fogmin.site" style="color:#a75324;text-decoration:none;">support@fogmin.site</a></div>`,
        '</td>',
        '</tr>',

        '</table>',

        '<div style="max-width:620px;margin:16px auto 0;font-size:11px;line-height:1.5;color:#998b81;text-align:center;">',
        'This message was sent by Fire Of God Ministries through its Community Portal.',
        '</div>',

        '</td>',
        '</tr>',
        '</table>',

        '</body>',
        '</html>'
    ].join('');
}

module.exports = Object.freeze({
    DEFAULT_PUBLIC_ORIGIN,
    TEMPLATE_MARKER,
    escapeHtml,
    normalizePublicOrigin,
    renderBrandedEmail
});
