export async function onRequestPost({ request, env }) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { url } = await request.json();
        
        if (!url || (!url.includes('tiktok.com') && !url.includes('vm.tiktok.com') && !url.includes('vt.tiktok.com'))) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Invalid TikTok URL' 
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Get the ORIGINAL source video
        const videoData = await getOriginalVideo(url);
        
        // Ensure clean filename
        const cleanFilename = videoData.filename.replace(/[^\w.-]/g, '_');
        
        return new Response(JSON.stringify({
            success: true,
            downloadUrl: videoData.url,
            quality: videoData.quality,
            size: videoData.size,
            bitrate: videoData.bitrate,
            codec: videoData.codec,
            filename: cleanFilename
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
        
    } catch (error) {
        console.error('Download error:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to extract video. Please try again or check if the URL is valid.' 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

async function getOriginalVideo(url) {
    const videoId = extractVideoId(url);
    
    // Try multiple extraction methods in order of quality
    
    // Method 1: Direct API approach (highest success rate)
    try {
        // Use TikTok's internal API endpoint
        const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'com.zhiliaoapp.musically/2022600030 (Linux; U; Android 7.1.2; es_ES; SM-G988N; Build/NRD90M.G988NKSU1AQDC)'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.aweme_list && data.aweme_list[0]) {
                const video = data.aweme_list[0].video;
                
                // Get the highest quality available
                const urls = video.play_addr.url_list;
                const hdUrl = urls.find(u => !u.includes('watermark')) || urls[0];
                
                return {
                    url: hdUrl,
                    quality: `${video.width}x${video.height}`,
                    bitrate: `${(video.bit_rate / 1000000).toFixed(2)} Mbps`,
                    size: calculateSize(video.bit_rate, video.duration / 1000),
                    codec: 'h264',
                    filename: `tiktok_${videoId}_original_${video.width}x${video.height}.mp4`
                };
            }
        }
    } catch (e) {
        console.log('Method 1 failed:', e.message);
    }
    
    // Method 2: Web scraping approach
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });
        
        const html = await response.text();
        
        // Try to find video URL in the HTML
        const videoUrlMatch = html.match(/"playAddr":"([^"]+)"/);
        const widthMatch = html.match(/"width":(\d+)/);
        const heightMatch = html.match(/"height":(\d+)/);
        const bitrateMatch = html.match(/"bitrate":(\d+)/);
        
        if (videoUrlMatch) {
            const videoUrl = videoUrlMatch[1].replace(/\\u002F/g, '/');
            return {
                url: videoUrl,
                quality: widthMatch && heightMatch ? `${widthMatch[1]}x${heightMatch[1]}` : '1080x1920',
                bitrate: bitrateMatch ? `${(bitrateMatch[1] / 1000000).toFixed(2)} Mbps` : 'HD',
                size: 'Variable',
                codec: 'h264',
                filename: `tiktok_${videoId}_original.mp4`
            };
        }
    } catch (e) {
        console.log('Method 2 failed:', e.message);
    }
    
    // Method 3: Reliable third-party service fallback
    try {
        const apiUrl = 'https://api.tiklydown.eu.org/api/download/v3';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.result && data.result.video) {
                // Get the highest quality version
                const hdVideo = data.result.hdVideo || data.result.video;
                return {
                    url: hdVideo,
                    quality: data.result.quality || 'HD',
                    bitrate: 'Original',
                    size: data.result.size || 'Unknown',
                    codec: 'h264',
                    filename: `tiktok_${videoId}_original.mp4`
                };
            }
        }
    } catch (e) {
        console.log('Method 3 failed:', e.message);
    }
    
    throw new Error('All extraction methods failed. TikTok may have updated their system.');
}

function extractVideoId(url) {
    // Handle all TikTok URL formats
    const patterns = [
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
        /tiktok\.com\/v\/(\d+)/,
        /tiktok\.com\/video\/(\d+)/,
        /vm\.tiktok\.com\/([\w]+)/,
        /vt\.tiktok\.com\/([\w]+)/,
        /tiktok\.com\/t\/([\w]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    // Last resort: try to extract any long number
    const numberMatch = url.match(/(\d{15,})/);
    return numberMatch ? numberMatch[1] : Date.now().toString();
}

function calculateSize(bitrate, duration) {
    if (!bitrate || !duration) return 'Unknown';
    const sizeInMB = (bitrate * duration) / 8 / 1024 / 1024;
    return `${sizeInMB.toFixed(1)} MB`;
}

export async function onRequest(context) {
    return onRequestPost(context);
}