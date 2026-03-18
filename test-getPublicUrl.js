const CDN_BASE = 'https://cdn.diabolicalservices.tech';
const clientSlug = 'nailssalon';
const SYSTEM_TOKEN = 'dmm_7tpONlAMTNtIMLjpr4gMSNqw9LGbgX6X';
const CLIENTS_TOKEN = 'dmm_XKnnaMPrgRWaRHQ21deaQ3Krz2B6iBW';

function getPublicUrl(url) {
    if (!url) return '';
    if (url.startsWith('blob:')) return url;
    
    if (url.startsWith('http') && !url.includes('cdn.diabolicalservices.tech') && !url.includes('api.diabolicalservices.tech') && !url.includes('api-nailflow.diabolicalservices.tech')) {
        return url;
    }

    let path = url;
    if (url.includes('/img/')) {
        path = url.split('/img/')[1];
    } else if (url.startsWith('http')) {
        try {
            const parsed = new URL(url);
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            
            if (url.includes('cdn.diabolicalservices.tech')) {
                if (pathParts.length >= 2 && pathParts[0] === clientSlug) {
                    path = pathParts.slice(1).join('/');
                } else {
                    path = pathParts.join('/');
                }
            } else {
                path = pathParts.join('/');
            }
        } catch {
            path = url;
        }
    }

    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const isClientPhoto = cleanPath.includes('clientas/') || cleanPath.includes('bookings/');
    const token = isClientPhoto ? CLIENTS_TOKEN : SYSTEM_TOKEN;
    const pathPart = cleanPath.startsWith(clientSlug) ? cleanPath : `${clientSlug}/${cleanPath}`;
    
    const finalUrl = new URL(`${CDN_BASE}/${pathPart}`);
    finalUrl.searchParams.set('api_key', token);
    
    return finalUrl.toString();
}

const testUrl = "https://api-nailflow.diabolicalservices.tech/api/img/nailssalon/642488738_18570479095041957_3052735995905134316_n.jpg";
console.log("Input:", testUrl);
console.log("Output:", getPublicUrl(testUrl));

const testUrl2 = "nailssalon/services/mani.png";
console.log("Input:", testUrl2);
console.log("Output:", getPublicUrl(testUrl2));

const testUrl3 = "clientas/ref1.png";
console.log("Input:", testUrl3);
console.log("Output:", getPublicUrl(testUrl3));
