const { Telegraf, Markup } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN is missing in environment variables');
    return;
}

const bot = new Telegraf(BOT_TOKEN);

// Premium Emoji Shortcuts
const em = {
    blueTick: '[✔](tg://emoji?id=5334998226636390258)',
    blackTick: '[✔](tg://emoji?id=5251386049585768540)',
    whatsapp: '[💬](tg://emoji?id=5251733667058840414)',
    loading: '[⏳](tg://emoji?id=6296218646284863141)',
    key: '[🔑](tg://emoji?id=6136551252781172945)',
    indiaFlag: '[🇮🇳](tg://emoji?id=6136551252781172945)',
    errorEmoji: '[❌](tg://emoji?id=5251437048027442994)' // താങ്കൾ പുതിയതായി തന്ന കോഡ് ഇവിടെ നൽകിയിരിക്കുന്നു
};

// /start command
bot.start((ctx) => {
    ctx.reply(
        `✨ *WELCOME TO AADHI-XD ${em.blueTick} LINKER* ✨\n\n` +
        `Link your WhatsApp account securely with our advanced bot ${em.blueTick}.\n\n` +
        `👉 *Please send your WhatsApp number with country code* (e.g., \`918714387286\`) to generate your pairing code.`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('⚡ GET PAIRING CODE', 'get_started')],
                [Markup.button.url(`🌐 DEVELOPER / SUPPORT ${em.blackTick}`, 'https://t.me/Aadhixd')]
            ])
        }
    );
});

bot.action('get_started', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(`📲 Please type and send your WhatsApp number now with country code ${em.whatsapp}:`);
});

// Handling Number and Pairing Code
bot.on('text', async (ctx) => {
    let text = ctx.text.trim();
    if (text.startsWith('/')) return;

    let phoneNumber = text.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.reply(`${em.errorEmoji} *Invalid number!* Please send a valid WhatsApp number with country code (e.g., \`918714387286\`).`, { parse_mode: 'Markdown' });
    }

    const waitMsg = await ctx.reply(`${em.loading} *Status:* Generating Pairing Code for *${phoneNumber}*... Please wait.`);

    try {
        const sessionDir = path.join(__dirname, 'session');
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
            }
        });

        if (!state.creds.registered) {
            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNumber);
                    let formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                    let last4 = formattedCode.slice(-4);
                    let finalCode = 'AAD1-' + (last4);
                    
                    try { await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id); } catch(e) {}

                    await ctx.reply(
                        `┏━━ ${em.whatsapp} *WHATSAPP LINKING* ${em.indiaFlag} ${em.blueTick} ━━┓\n\n` +
                        `│ 👤 *Number:* \`${phoneNumber}\`\n` +
                        `│ ${em.blueTick} *Status:* Ready to Link\n` +
                        `│ ${em.key} *Pairing Code:* \`${finalCode}\`\n\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `📌 *Instructions:*\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Go to **Settings > Linked Devices**\n` +
                        `3️⃣ Tap **Link a Device** -> **Link with phone number instead**\n` +
                        `4️⃣ Enter the code above to connect!`,
                        {
                            parse_mode: 'Markdown',
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback(`📋 Copy Code: ${finalCode}`, 'copy_code')],
                                [Markup.button.callback('🔄 Change Number', 'get_started')]
                            ])
                        }
                    );
                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    ctx.reply(`${em.errorEmoji} *Error generating pairing code. Please try again with a valid number.*`, { parse_mode: 'Markdown' });
                }
            }, 3000);
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') {
                ctx.reply(`🎉 *SUCCESS!* Your WhatsApp has been successfully linked to AADHI-XD ${em.blueTick} Bot! ✅`, { parse_mode: 'Markdown' });
            }
        });

    } catch (err) {
        console.error('An unexpected error occurred.', err);
        ctx.reply(`${em.errorEmoji} *An unexpected error occurred.*`, { parse_mode: 'Markdown' });
    }
});

bot.action('copy_code', async (ctx) => {
    await ctx.answerCbQuery('💡 Tip: Tap on the code block in the message to copy it directly!');
});

bot.launch();
console.log('🤖 AADHI-XD Linker Bot with Premium Emojis started successfully!');
