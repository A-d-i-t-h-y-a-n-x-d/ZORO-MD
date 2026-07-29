const { Telegraf, Markup } = require('telegraf');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in environment variables');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Store active sockets per user: chatId -> socket instance
const activeSockets = new Map();

// Custom Premium Emojis
const em = {
    waLink: '<tg-emoji emoji-id="5334998226636390258">💬</tg-emoji>',
    phone: '<tg-emoji emoji-id="5935864147051811401">📱</tg-emoji>',
    settings: '<tg-emoji emoji-id="6220014823963363136">⚙️</tg-emoji>',
    pairingSuccess: '<tg-emoji emoji-id="5251386049585768540">🔑</tg-emoji>',
    generalFeature: '<tg-emoji emoji-id="6296218646284863141">✨</tg-emoji>',
    errorFormat: '<tg-emoji emoji-id="5251437048027442994">❌</tg-emoji>',
    connected: '<tg-emoji emoji-id="5936253382757979660">🟢</tg-emoji>',
    blueTick: '<tg-emoji emoji-id="5436053316715424756">☑️</tg-emoji>',
    indiaFlag: '🇮🇳'
};

// Helper: Clean up existing user socket & session files
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

bot.start((ctx) => {
    ctx.reply(
        `${em.generalFeature} <b>WELCOME TO AADHI-XD LINKER</b> ${em.generalFeature}\n\n` +
        `Link your WhatsApp account securely with our advanced bot.\n\n` +
        `👉 <b>Please send your WhatsApp number with country code</b> (e.g., <code>918136880986</code>) to generate your pairing code.`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`🚀 GET PAIRING CODE`, 'get_started')],
                [Markup.button.url(`🌐 DEVELOPER / SUPPORT`, 'https://t.me/Aadhixdofc')]
            ])
        }
    );
});

bot.action('get_started', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(`${em.phone} <b>Please type and send your WhatsApp number now with country code:</b>`, { parse_mode: 'HTML' });
});

bot.on('text', async (ctx) => {
    const text = ctx.text.trim();
    if (text.startsWith('/')) return;

    const phoneNumber = text.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.reply(`${em.errorFormat} <b>Invalid phone number!</b> Please send a valid WhatsApp number with country code (e.g., <code>918714387286</code>).`, { parse_mode: 'HTML' });
    }

    const chatId = ctx.chat.id;

    // Clean any prior dangling sessions for this Telegram user
    cleanupUserSession(chatId);

    const waitMsg = await ctx.reply(`⏳ <b>Settings:</b> Initializing Baileys Socket...\n${em.phone} <b>Phone Number:</b> <code>${phoneNumber}</code>\n⏳ Generating Pairing Code... Please wait.`, { parse_mode: 'HTML' });

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
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            }
        });

        activeSockets.set(chatId, sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                // index.js ഉപയോഗിക്കുന്ന പ്രധാന ./session ഫോൾഡറിലേക്ക് സെഷൻ ഫയലുകൾ കോപ്പി ചെയ്യുന്നു
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

                await ctx.reply(
                    `🎉 <b>${em.connected} CONNECTED SUCCESSFULLY!</b> ${em.blueTick}\n` +
                    `Your WhatsApp has been successfully linked! Modules extracting & starting bot... ${em.blueTick}`, 
                    { parse_mode: 'HTML' }
                );
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== DisconnectReason.loggedOut) {
                    // Reconnection logic
                }
            }
        });

        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    const originalPairingCode = await sock.requestPairingCode(phoneNumber);
                    
                    try { 
                        await ctx.telegram.deleteMessage(chatId, waitMsg.message_id); 
                    } catch (e) {}

                    await ctx.reply(
                        `┏━━ ${em.waLink} <b>WHATSAPP LINKING</b> ${em.indiaFlag} ${em.connected} ━━┓\n\n` +
                        `│ ${em.phone} <b>Phone Number:</b> <code>${phoneNumber}</code> ${em.blueTick}\n` +
                        `│ ${em.settings} <b>Settings:</b> Configured\n` +
                        `│ ${em.pairingSuccess} <b>Pairing Code:</b> <code>${originalPairingCode}</code>\n\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `📌 <b>Instructions:</b> ${em.generalFeature}\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Go to <b>Settings > Linked Devices</b>\n` +
                        `3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n` +
                        `4️⃣ Enter the code above to connect!`,
                        {
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback(`📋 Copy Code: ${originalPairingCode}`, `copy_${originalPairingCode}`)],
                                [Markup.button.callback('🔄 Change Number', 'get_started')]
                            ])
                        }
                    );
                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    cleanupUserSession(chatId);
                    await ctx.reply(`${em.errorFormat} <b>Error generating pairing code. Please try again with a valid number.</b>`, { parse_mode: 'HTML' });
                }
            }, 3000);
        }

    } catch (err) {
        console.error('An unexpected error occurred:', err);
        cleanupUserSession(chatId);
        await ctx.reply(`${em.errorFormat} <b>An unexpected error occurred.</b>`, { parse_mode: 'HTML' });
    }
});

bot.action(/^copy_(.+)$/, async (ctx) => {
    const actualCode = ctx.match[1];
    await ctx.answerCbQuery(`📋 Code: ${actualCode}`, { show_alert: true });
});

bot.launch().then(() => {
    console.log('🤖 AADHI-XD Linker Telegram Module started successfully!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
