const { Telegraf, Markup } = require('telegraf');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env!');
    process.exit(1);
}

const bot = new Telegraf(botToken);

const activeSockets = new Map();

// Custom Premium Emoji Mapping
const em = {
    welcomeHeaderEmoji: '<tg-emoji emoji-id="6298356878573307709">✨</tg-emoji>', // പുതിയ പ്രീമിയം ഇമോജി
    waLogo: '<tg-emoji emoji-id="5936079934798696466">🟢</tg-emoji>', // വാട്സാപ്പ് ലോഗോ
    blueTick: '<tg-emoji emoji-id="5436053316715424756">☑️</tg-emoji>', // ബ്ലൂ വെരിഫിക്കേഷൻ ബാഡ്ജ്
    phone: '<tg-emoji emoji-id="5936079934798696466">📱</tg-emoji>',
    settings: '<tg-emoji emoji-id="5933521976831251008">⚙️</tg-emoji>',
    keyEmoji: '🔑',
    generalFeature: '✨',
    errorFormat: '❌',
    connected: '🟢'
};

const cleanupUserSession = (chatId) => {
    if (activeSockets.has(chatId)) {
        try {
            activeSockets.get(chatId).end(undefined);
        } catch (e) {}
        activeSockets.delete(chatId);
    }

    const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
    if (fs.existsSync(userSessionDir)) {
        fs.rmSync(userSessionDir, { recursive: true, force: true });
    }
};

bot.start(async (ctx) => {
    // വെൽക്കം മെസ്സേജിന്റെ ഹെഡിംഗ് അപ്ഡേറ്റ് ചെയ്തു
    const welcomeText = `${em.welcomeHeaderEmoji} <b>WELCOME TO AADHI-XD LINKER</b> ${em.blueTick}\n\n` +
                        `Link your WhatsApp account securely with our bot.\n\n` +
                        `👉 <b>Please send your WhatsApp number with country code</b> (e.g., <code>918136880986</code>) to generate your pairing code.`;

    await ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard([
        [Markup.button.callback('🚀 GET PAIRING CODE', 'get_started')],
        [Markup.button.url('🌐 DEVELOPER / SUPPORT', 'https://t.me/Aadhixdofc')]
    ]));
});

bot.action('get_started', async (ctx) => {
    await ctx.answerCbQuery('Starting process...');
    // ഫോൺ ഐക്കണിന് പകരം വാട്സാപ്പ് ലോഗോ മാറ്റി
    await ctx.replyWithHTML(`${em.waLogo} <b>Please type and send your WhatsApp number now with country code:</b>`);
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    const chatId = ctx.chat.id;

    if (text.startsWith('/')) return;

    const phoneNumber = text.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.replyWithHTML(`${em.errorFormat} <b>Invalid phone number!</b> Please send a valid WhatsApp number with country code (e.g., <code>918714387286</code>).`);
    }

    cleanupUserSession(chatId);

    const waitMsg = await ctx.replyWithHTML(`⏳ <b>Settings:</b> Initializing Baileys Socket...\n${em.waLogo} <b>Phone Number:</b> <code>${phoneNumber}</code>\n⏳ Generating Pairing Code... Please wait.`);

    try {
        const userSessionDir = path.join(__dirname, 'sessions', `user_${chatId}`);
        if (!fs.existsSync(userSessionDir)) {
            fs.mkdirSync(userSessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Mac OS", "Chrome", "121.0.0"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        activeSockets.set(chatId, sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;

            if (connection === 'open') {
                try {
                    const mainSessionDir = path.join(__dirname, 'session');
                    if (!fs.existsSync(mainSessionDir)) {
                        fs.mkdirSync(mainSessionDir, { recursive: true });
                    }
                    fs.cpSync(userSessionDir, mainSessionDir, { recursive: true, force: true });
                    console.log(`✅ Session copied to main ./session folder for user ${chatId}`);
                } catch (cpErr) {
                    console.error('❌ Failed to copy session to main folder:', cpErr);
                }

                await ctx.replyWithHTML(`🎉 <b>PAIRING SUCCESSFUL!</b> ${em.connected}\n\nYour WhatsApp has been successfully linked and verified! ${em.blueTick}`);
            }
        });

        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

                    try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

                    const textMessage = 
                        `┏━━ ${em.waLogo} <b>AADHI XD LINKING</b> ${em.blueTick} ━━┓\n\n` +
                        `│ ${em.phone} <b>Phone Number:</b> <code>${phoneNumber}</code> ${em.blueTick}\n` +
                        `│ ${em.settings} <b>Settings:</b> Configured\n` +
                        `│ ${em.keyEmoji} <b>Pairing Code:</b> <code>${formattedCode}</code>\n\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `📌 <b>Instructions:</b> ${em.generalFeature}\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Go to <b>Settings > Linked Devices</b>\n` +
                        `3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n` +
                        `4️⃣ Enter the code above to connect!`;

                    const cleanCode = String(formattedCode).replace(/[^a-zA-Z0-9]/g, '');

                    await ctx.replyWithHTML(textMessage, Markup.inlineKeyboard([
                        [Markup.button.callback(`📋 Copy Code: ${formattedCode}`, `copy_${cleanCode}`)],
                        [Markup.button.callback('🔄 Change Number', 'get_started')]
                    ]));

                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    cleanupUserSession(chatId);
                    await ctx.replyWithHTML(`${em.errorFormat} <b>Error generating pairing code. Please try again with a valid number.</b>`);
                }
            }, 2000);
        }

    } catch (err) {
        console.error('An unexpected error occurred:', err);
        cleanupUserSession(chatId);
        await ctx.replyWithHTML(`${em.errorFormat} <b>An unexpected error occurred.</b>`);
    }
});

bot.action(/^copy_(.+)$/, async (ctx) => {
    const code = ctx.match[1];
    await ctx.answerCbQuery(`📋 Code: ${code}`, { show_alert: true });
});

bot.launch().then(() => {
    console.log('🤖 Telegram Bot API Module started successfully!');
}).catch((err) => {
    console.error('❌ Failed to launch Telegram Bot:', err.message);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
