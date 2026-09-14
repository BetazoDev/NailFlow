import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { createLogger, errorContext } from '../lib/logger';

const log = createLogger('mail');

/**
 * Outgoing mail, for the one message that cannot arrive late.
 *
 * A salon owner cannot open her panel until she has been told where it is and
 * given a link to set a password. Until now that was handed over by hand, which
 * works for the first few salons and stops working the moment two are created
 * in a week.
 *
 * Everything a *client* receives still goes through the automation webhook.
 * Those can be delayed, retried or reworded without anyone being locked out of
 * anything, and they belong where their templates can be edited without a
 * deploy. This one is different: it is the front door.
 *
 * Optional by design. With nothing configured every function reports that it is
 * unavailable and the panel falls back to showing the link for the operator to
 * send — which is exactly the behaviour before any of this existed.
 */

export type MailOutcome =
    | { ok: true; detail: string }
    | { ok: false; reason: 'unconfigured' | 'rejected' | 'unreachable'; detail: string };

export function mailEnabled(): boolean {
    return Boolean(env.smtp.host && env.smtp.from);
}

let cached: Transporter | null = null;

function transport(): Transporter | null {
    if (!mailEnabled()) return null;
    if (cached) return cached;

    cached = nodemailer.createTransport({
        host: env.smtp.host!,
        port: env.smtp.port,
        // 465 is TLS from the first byte; 587 opens in the clear and upgrades.
        // Getting this backwards is the usual reason a working mailbox refuses
        // to send, so it is derived from the port rather than configured twice.
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password ?? '' } : undefined,
        // A salon is being created while this runs; the operator is watching.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    });

    return cached;
}

/** Drops the cached connection pool, so changed settings take effect. */
export function resetTransport(): void {
    cached?.close();
    cached = null;
}

/**
 * Turns a failed send into something the operator can act on.
 *
 * "No se pudo enviar" sends him to look in the wrong place. A refused password
 * and an unreachable server are fixed in different places, and the error
 * already knows which happened.
 */
function explain(error: unknown): MailOutcome {
    const code = (error as { code?: string })?.code ?? '';
    const response = (error as { response?: string })?.response ?? '';

    if (code === 'EAUTH' || /535|534|530/.test(response)) {
        return {
            ok: false,
            reason: 'rejected',
            detail: 'El servidor de correo rechazó el usuario o la contraseña. Revisa SMTP_USER y SMTP_PASSWORD.',
        };
    }

    if (['ECONNREFUSED', 'ETIMEDOUT', 'ECONNECTION', 'EDNS', 'ENOTFOUND'].includes(code)) {
        return {
            ok: false,
            reason: 'unreachable',
            detail: `No pudimos contactar con ${env.smtp.host}:${env.smtp.port}. Comprueba el host, el puerto y que el cortafuegos lo deje salir.`,
        };
    }

    if (/550|553|554/.test(response)) {
        return {
            ok: false,
            reason: 'rejected',
            detail: `El servidor rechazó el envío: ${response.slice(0, 160)}. Suele ser que MAIL_FROM no es un buzón que este servidor pueda usar.`,
        };
    }

    return {
        ok: false,
        reason: 'rejected',
        detail: response ? response.slice(0, 200) : 'El servidor de correo rechazó el mensaje.',
    };
}

interface Message {
    to: string;
    subject: string;
    html: string;
    text: string;
}

async function send(message: Message): Promise<MailOutcome> {
    const mailer = transport();
    if (!mailer) {
        return {
            ok: false,
            reason: 'unconfigured',
            detail: 'El envío de correo no está configurado en este servidor.',
        };
    }

    try {
        await mailer.sendMail({
            from: env.smtp.from!,
            replyTo: env.smtp.replyTo ?? undefined,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
        });

        log.info('Mail sent', { to: message.to, subject: message.subject });
        return { ok: true, detail: `Enviado a ${message.to}.` };
    } catch (error) {
        const outcome = explain(error);
        log.error('Could not send mail', {
            to: message.to,
            detail: outcome.detail,
            ...errorContext(error),
        });
        return outcome;
    }
}

/**
 * Confirms the mailbox works before a salon depends on it.
 *
 * Worth its own call: finding out the password is wrong while creating a salon
 * means finding out in front of a customer, holding a link that was supposed to
 * have been sent already.
 */
export async function checkMail(): Promise<MailOutcome> {
    const mailer = transport();
    if (!mailer) {
        return {
            ok: false,
            reason: 'unconfigured',
            detail: 'Faltan SMTP_HOST o MAIL_FROM en la API.',
        };
    }

    try {
        await mailer.verify();
        return {
            ok: true,
            detail: `Conectado a ${env.smtp.host}:${env.smtp.port} como ${env.smtp.from}.`,
        };
    } catch (error) {
        const outcome = explain(error);
        log.warn('Mail check failed', { detail: outcome.detail, ...errorContext(error) });
        return outcome;
    }
}

// ── La carta de acceso ───────────────────────────────────────────────────────

const INK = '#2C2420';
const MUTED = '#5A4E48';
const SURFACE = '#FDFBF7';
const LINE = '#F0E9DF';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export interface InviteMail {
    to: string;
    salonName: string;
    /** Where her panel lives, e.g. "bella.salones.example.com". */
    domain: string;
    /** The one-time link that lets her choose a password. */
    link: string;
}

/**
 * The message a salon owner gets when her salon is created.
 *
 * It carries no password, because there is none: the link is how she chooses
 * one, and it expires. A password written into an email would outlive every
 * rotation, sitting in her inbox and in the logs of every server that relayed
 * it — and it would be the credential to a panel holding her clients' names and
 * phone numbers.
 *
 * Written as plain HTML with inline styles on purpose. Mail clients strip
 * stylesheets, ignore custom properties and reflow anything clever, and this is
 * the one message that has to render in whatever she opens it in.
 */
export async function sendInvite(invite: InviteMail): Promise<MailOutcome> {
    const salon = escapeHtml(invite.salonName);
    const panel = `https://${invite.domain}`;

    const text = [
        `Hola,`,
        ``,
        `Tu panel de ${invite.salonName} ya está listo.`,
        ``,
        `Tu usuario es tu correo: ${invite.to}`,
        `Elige tu contraseña aquí: ${invite.link}`,
        ``,
        `Después entra en ${panel}`,
        ``,
        `El enlace caduca, así que úsalo pronto. Si caduca, escríbenos y te`,
        `mandamos otro. Nadie más que tú sabrá tu contraseña: no la guardamos.`,
    ].join('\n');

    const html = `
<div style="margin:0;padding:32px 16px;background:${SURFACE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid ${LINE};border-radius:20px;padding:36px 32px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED}">
      Tu panel ya está listo
    </p>
    <h1 style="margin:0 0 24px;font-size:26px;line-height:1.25;color:${INK};font-weight:700">
      ${salon}
    </h1>

    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${INK}">
      Tu usuario es tu correo:
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK};font-weight:700">
      ${escapeHtml(invite.to)}
    </p>

    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${INK}">
      Elige tu contraseña con este botón. Solo la sabrás tú: no la guardamos.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      <tr><td style="border-radius:999px;background:#E8A0B4">
        <a href="${invite.link}"
           style="display:inline-block;padding:15px 30px;font-size:15px;font-weight:700;color:${INK};text-decoration:none">
          Elegir mi contraseña
        </a>
      </td></tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${MUTED}">
      Después entra en <a href="${panel}" style="color:${INK}">${escapeHtml(invite.domain)}</a>.
    </p>

    <div style="height:1px;background:${LINE};margin:0 0 20px"></div>

    <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">
      El enlace caduca, así que úsalo pronto. Si te caduca, pídenos otro y te lo
      mandamos. Si el botón no funciona, copia esta dirección en tu navegador:
    </p>
    <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all">
      ${escapeHtml(invite.link)}
    </p>
  </div>
</div>`.trim();

    return send({
        to: invite.to,
        subject: `Tu panel de ${invite.salonName} ya está listo`,
        text,
        html,
    });
}
