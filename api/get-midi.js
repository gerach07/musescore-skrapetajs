const { chromium: playwrightChromium } = require('playwright-core');
const chromium = require('@sparticuz/chromium');
let chromeAwsLambda = null;
try {
    chromeAwsLambda = require('chrome-aws-lambda');
} catch (e) {
    chromeAwsLambda = null;
}

function isMidiLikeUrl(url) {
    return /(\.mid|\.midi)(\?|$)/i.test(url) || /\/midi\//i.test(url) || /type=midi/i.test(url);
}

function isAllowedMidiHost(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return (
            host === 'musescore.com' ||
            host.endsWith('.musescore.com') ||
            host.endsWith('.ustatik.com')
        );
    } catch (e) {
        return false;
    }
}

function collectMidiUrlsFromHtml(html) {
    const matches = html.match(/https?:\/\/[^"'\s<>]+/gi) || [];
    return matches
        .map((u) => u.replace(/\\\//g, '/'))
        .filter((u) => isMidiLikeUrl(u));
}

function normalizeScoreUrl(input) {
    const parsed = new URL(input);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
}

function isServerlessRuntime() {
    return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

async function resolveExecutablePath() {
    if (process.env.CHROMIUM_PATH) {
        return process.env.CHROMIUM_PATH;
    }

    if (isServerlessRuntime()) {
        if (chromeAwsLambda) {
            const awsPath = await chromeAwsLambda.executablePath;
            if (awsPath) {
                return awsPath;
            }
        }
        return chromium.executablePath();
    }

    return null;
}

async function connectBrowser() {
    const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;
    const wsProtocol = (process.env.BROWSER_WS_PROTOCOL || 'playwright').toLowerCase();

    if (wsEndpoint) {
        if (wsProtocol === 'cdp') {
            return playwrightChromium.connectOverCDP(wsEndpoint);
        }
        return playwrightChromium.connect(wsEndpoint);
    }

    const executablePath = await resolveExecutablePath();
    if (!executablePath) {
        return null;
    }

    const inServerless = isServerlessRuntime();
    const launchArgs = inServerless
        ? (chromeAwsLambda?.args || chromium.args)
        : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

    return playwrightChromium.launch({
        args: launchArgs,
        executablePath,
        headless: true,
    });
}

function getBrowserMode() {
    return process.env.BROWSER_WS_ENDPOINT
        ? `remote-${(process.env.BROWSER_WS_PROTOCOL || 'playwright').toLowerCase()}`
        : 'local-chromium';
}

function extractFilenameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const tail = pathname.split('/').pop() || 'score.mid';
        return tail.endsWith('.mid') || tail.endsWith('.midi') ? tail : 'score.mid';
    } catch (e) {
        return 'score.mid';
    }
}

async function streamMidiToClient(res, midiUrl) {
    const response = await fetch(midiUrl, {
        redirect: 'follow',
        headers: {
            // Some sources block requests without a browser-like UA.
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
    });

    if (!response.ok) {
        throw new Error(`Neizdevās iegūt MIDI failu (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/midi');
    res.setHeader('Content-Disposition', `attachment; filename="${extractFilenameFromUrl(midiUrl)}"`);
    return res.status(200).send(fileBuffer);
}

async function attemptPlayback(page) {
    const selectors = [
        'button[aria-label*="Play" i]',
        'button[data-testid*="play" i]',
        '[class*="play" i][role="button"]',
        'button[class*="play" i]',
    ];

    for (const selector of selectors) {
        const element = page.locator(selector).first();
        const count = await element.count().catch(() => 0);
        if (count > 0) {
            await element.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(1500).catch(() => {});
            return;
        }
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metode nav atļauta' });
    }

    const scoreUrl = req.query?.scoreUrl;
    const shouldProxyDownload = req.query?.download === '1';
    const directMidiUrl = req.query?.midiUrl;

    if (shouldProxyDownload && directMidiUrl) {
        if (!isMidiLikeUrl(directMidiUrl) || !isAllowedMidiHost(directMidiUrl)) {
            return res.status(400).json({ error: 'Nederīgs midiUrl lejupielādei.' });
        }

        try {
            return await streamMidiToClient(res, directMidiUrl);
        } catch (error) {
            return res.status(502).json({
                error: 'Neizdevās iegūt MIDI failu no avota URL.',
                details: error.message,
            });
        }
    }

    if (!scoreUrl) {
        return res.status(400).json({ error: 'Trūkst scoreUrl parametra' });
    }

    let normalizedScoreUrl;
    try {
        normalizedScoreUrl = normalizeScoreUrl(scoreUrl);
    } catch (err) {
        return res.status(400).json({ error: 'Nederīgs scoreUrl' });
    }

    if (!(await resolveExecutablePath()) && !process.env.BROWSER_WS_ENDPOINT) {
        return res.status(500).json({
            error: 'Browser runtime not configured. Set CHROMIUM_PATH for local runs, deploy to Vercel/AWS Lambda, or set BROWSER_WS_ENDPOINT.',
        });
    }

    let browser;
    const requestStartedAt = Date.now();
    let browserReadyAt = null;
    try {
        browser = await connectBrowser();
        browserReadyAt = Date.now();

        if (!browser) {
            return res.status(500).json({ error: 'Failed to initialize browser runtime.' });
        }

        const context = await browser.newContext({
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();
        const foundUrls = new Set();
        let sawAntiBotChallenge = false;
        let timedOut = false;
        const startedAt = Date.now();
        const HARD_LIMIT_MS = 50000;
        const NAV_TIMEOUT_MS = 20000;
        const IDLE_TIMEOUT_MS = 6000;
        const candidateUrls = [normalizedScoreUrl, `${normalizedScoreUrl}/piano-tutorial`];

        page.on('response', async (response) => {
            const url = response.url();
            const ok = response.status() >= 200 && response.status() < 300;
            const isJmuse = /\/api\/jmuse\?/i.test(url);

            if (ok && !isJmuse && isMidiLikeUrl(url)) {
                foundUrls.add(url);
            }

            // jmuse responses can contain the real signed media URL in info.url.
            if (ok && isJmuse) {
                try {
                    const payload = await response.json();
                    const mediaUrl = payload?.info?.url;
                    if (mediaUrl && isMidiLikeUrl(mediaUrl)) {
                        foundUrls.add(mediaUrl);
                    }
                } catch (e) {
                    // Ignore non-JSON or malformed payloads.
                }
            }
        });

        for (const url of candidateUrls) {
            if (Date.now() - startedAt > HARD_LIMIT_MS) {
                timedOut = true;
                break;
            }

            try {
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: NAV_TIMEOUT_MS,
                });

                await page.waitForLoadState('networkidle', { timeout: IDLE_TIMEOUT_MS }).catch(() => {});
                await attemptPlayback(page).catch(() => {});

                const title = await page.title().catch(() => '');
                if (/just a moment/i.test(title)) {
                    sawAntiBotChallenge = true;
                    continue;
                }

                if (foundUrls.size > 0) {
                    break;
                }
            } catch (e) {
                // Try next candidate URL if one navigation path fails.
                continue;
            }
        }

        const midiUrl = [...foundUrls][0];
        if (!midiUrl) {
            if (sawAntiBotChallenge) {
                return res.status(403).json({
                    error: 'MuseScore anti-bot pārbaude bloķēja šo pieprasījumu. Mēģini vēlreiz vēlāk.',
                    meta: {
                        browserMode: getBrowserMode(),
                        totalMs: Date.now() - requestStartedAt,
                        browserSetupMs: browserReadyAt ? browserReadyAt - requestStartedAt : null,
                    },
                });
            }

            if (timedOut) {
                return res.status(504).json({
                    error: 'Pieprasījumam iestājās noilgums skenējot notu resursus. Lūdzu mēģini vēlreiz.',
                    meta: {
                        browserMode: getBrowserMode(),
                        totalMs: Date.now() - requestStartedAt,
                        browserSetupMs: browserReadyAt ? browserReadyAt - requestStartedAt : null,
                    },
                });
            }

            return res.status(404).json({
                error: 'Neizdevās atrast MIDI URL šajā lapā. Dažas notis ir aizsargātas vai prasa papildu mijiedarbību.',
                meta: {
                    browserMode: getBrowserMode(),
                    totalMs: Date.now() - requestStartedAt,
                    browserSetupMs: browserReadyAt ? browserReadyAt - requestStartedAt : null,
                },
            });
        }

        if (shouldProxyDownload) {
            return await streamMidiToClient(res, midiUrl);
        }

        return res.status(200).json({
            midiUrl,
            downloadUrl: `/api/get-midi?download=1&midiUrl=${encodeURIComponent(midiUrl)}`,
            meta: {
                browserMode: getBrowserMode(),
                totalMs: Date.now() - requestStartedAt,
                browserSetupMs: browserReadyAt ? browserReadyAt - requestStartedAt : null,
            },
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Neizdevās iegūt MIDI URL',
            details: error.message,
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};