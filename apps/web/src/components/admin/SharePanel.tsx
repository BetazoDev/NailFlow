'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * The salon's own link, and a QR she can print.
 *
 * This is the screen that turns the product into something she can hand to a
 * client, so both artefacts have to leave the browser: the link copies, and the
 * QR downloads as a file she can put on a card, a mirror or a window.
 *
 * The QR is drawn in the browser rather than fetched from an image service, so
 * no third party learns which salons exist or how often their codes are made.
 */
export function SharePanel({ domain }: { domain: string | undefined }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);

    // Prefer the address the owner is actually on: a salon reached through a
    // domain we do not know about would otherwise be handed a link that fails.
    const [origin, setOrigin] = useState('');
    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const url = origin || (domain ? `https://${domain}` : '');

    useEffect(() => {
        if (!url || !canvasRef.current) return;

        // Generous margin and high error correction: a printed code gets
        // scratched, curled and photographed at an angle.
        QRCode.toCanvas(canvasRef.current, url, {
            width: 520,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: { dark: '#2C2420', light: '#FFFFFF' },
        }).catch(() => setFailed(true));
    }, [url]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            setFailed(true);
        }
    };

    const download = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `qr-${domain ?? 'salon'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="t-title">Comparte tu salón</h2>
                <p className="t-label mt-1 opacity-70">
                    Tus clientas reservan desde aquí.
                </p>
            </div>

            <Card variant="raised" className="p-8 border-none shadow-soft space-y-6">
                <div>
                    <p className="t-label mb-2">Tu enlace</p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            readOnly
                            value={url}
                            onFocus={event => event.currentTarget.select()}
                            aria-label="Enlace de tu salón"
                            className="h-12 flex-1 rounded-xl border border-line bg-surface-sunken px-4 text-sm text-text-strong"
                        />
                        <Button variant="secondary" className="h-12 shrink-0" onClick={copy}>
                            {copied ? 'Copiado' : 'Copiar'}
                        </Button>
                    </div>
                    <p className="t-meta mt-2">
                        Pégalo en tu biografía de Instagram, en tu WhatsApp o donde te escriban.
                    </p>
                </div>

                <div className="rule" />

                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                    <div className="rounded-2xl border border-line bg-white p-4">
                        {/* Rendered at 520px and shown at 176 so a printed copy
                            stays sharp; the download carries the full size. */}
                        <canvas
                            ref={canvasRef}
                            className="size-44"
                            aria-label={`Código QR de ${domain ?? 'tu salón'}`}
                        />
                    </div>

                    <div className="flex-1 space-y-3 text-center sm:text-left">
                        <p className="t-body">
                            Imprímelo y ponlo en tu mostrador, en el espejo o en tus tarjetas.
                            Quien lo escanee llega directo a tu página de reservas.
                        </p>
                        <Button variant="primary" className="h-12" onClick={download}>
                            Descargar el QR
                        </Button>
                        {failed && (
                            <p role="alert" className="t-meta text-danger">
                                Algo falló. Recarga la página e inténtalo otra vez.
                            </p>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
