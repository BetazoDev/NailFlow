const getPublicUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('blob:')) return url;
    
    if (url.startsWith('http') && !url.includes('cdn.diabolicalservices.tech') && !url.includes('api.diabolicalservices.tech')) {
        return url;
    }

    let cleanUrl = url;
    try {
        if (url.includes('/api/img/')) {
            const parts = url.split('/api/img/');
            if (parts.length === 2) {
                url = `https://cdn.diabolicalservices.tech/${parts[1]}`;
            }
        }
        
        const parsed = new URL(
            url.startsWith('http') ? url : `https://cdn.diabolicalservices.tech/${url}`
        );
        parsed.searchParams.delete('api_key');
        parsed.searchParams.delete('token');
        cleanUrl = parsed.toString();
    } catch {
        cleanUrl = url;
    }

    const CDN_BASE = 'https://cdn.diabolicalservices.tech/';
    
    if (cleanUrl.startsWith(CDN_BASE)) {
        return cleanUrl;
    }

    if (!cleanUrl.startsWith('http') && cleanUrl.length > 3) {
        const safePath = cleanUrl.startsWith('/') ? cleanUrl.substring(1) : cleanUrl;
        return `${CDN_BASE}nailssalon/${safePath}`;
    }

    return cleanUrl;
};

console.log('1.', getPublicUrl('67834b40adb425da58a8d2e0aff9245e.jpg'));
console.log('2.', getPublicUrl('https://api.diabolicalservices.tech/api/img/nailssalon/67834b40adb425da58a8d2e0aff9245e.jpg'));
console.log('3.', getPublicUrl('/api/img/nailssalon/67834b40adb425da58a8d2e0aff9245e.jpg'));
console.log('4.', getPublicUrl('https://cdn.diabolicalservices.tech/nailssalon/gemini-generated-image-1zrywe1zrywe1zry.png'));
console.log('5.', getPublicUrl('https://cdn.diabolicalservices.tech/nailssalon/gemini-generated-image.png?api_key=123'));
