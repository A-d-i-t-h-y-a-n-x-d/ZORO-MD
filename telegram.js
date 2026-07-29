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

// Premium Emoji helper configuration
const em = {
    blueTick: '<emoji id="5334998226636390258">✔</emoji>',
    blackTick: '<emoji id="5251386049585768540">✔</emoji>',
    whatsapp: '<emoji id="5251733667058840414">💬</emoji>',
    loading: '<emoji id="6296218646284863141">⏳</emoji>',
    key: '<emoji id="6136551252781172945">🔑</emoji>',
    indiaFlag: '<emoji id="6136551252781172945">🇮🇳</emoji>',
    errorEmoji: '<emoji id="5251437048027442994">❌</emoji>',
    rocket: '<emoji id="5346042941196507141">🚀</emoji>'
};

// Start command
bot.start((ctx) => {
    ctx.reply(
        `✨ <b>WELCOME TO AADHI-XD ${em.blueTick} LINKER</b> ✨\n\n` +
        `Link your WhatsApp account securely with our advanced bot ${em.blueTick}.\n\n` +
        `👉 <b>Please send your WhatsApp number with country code</b> (e.g., <code>918136880986</code>) to generate your pairing code.`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`${em.rocket} GET PAIRING CODE`, 'get_started')],
                [Markup.button.url(`🌐 DEVELOPER / SUPPORT ${em.blackTick}`, 'https://t.me/Aadhixdofc')]
            ])
        }
    );
});

bot.action('get_started', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(`📲 Please type and send your WhatsApp number now with country code ${em.whatsapp}:`, { parse_mode: 'HTML' });
});

// Handling Number and Pairing Code Generation
bot.on('text', async (ctx) => {
    let text = ctx.text.trim();
    if (text.startsWith('/')) return;

    let phoneNumber = text.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) {
        return ctx.reply(`${em.errorEmoji} <b>Invalid number!</b> Please send a valid WhatsApp number with country code (e.g., <code>918714387286</code>).`, { parse_mode: 'HTML' });
    }

    const waitMsg = await ctx.reply(`${em.loading} <b>Status:</b> Generating Pairing Code for <b>${phoneNumber}</b>... Please wait.`, { parse_mode: 'HTML' });

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
                    let finalCode = 'AADHI-' + (last4);
                    
                    try { await ctx.telegram.deleteMessage(ctx.chat.id, waitMsg.message_id); } catch(e) {}

                    await ctx.reply(
                        `┏━━ ${em.whatsapp} <b>WHATSAPP LINKING</b> ${em.indiaFlag} ${em.blueTick} ━━┓\n\n` +
                        `│ 👤 <b>Number:</b> <code>${phoneNumber}</code>\n` +
                        `│ ${em.blueTick} <b>Status:</b> Ready to Link\n` +
                        `│ ${em.key} <b>Pairing Code:</b> <code>${finalCode}</code>\n\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `📌 <b>Instructions:</b>\n` +
                        `1️⃣ Open WhatsApp on your phone\n` +
                        `2️⃣ Go to <b>Settings > Linked Devices</b>\n` +
                        `3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n` +
                        `4️⃣ Enter the code above to connect!`,
                        {
                            parse_mode: 'HTML',
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback(`📋 Copy Code: ${finalCode}`, 'copy_code')],
                                [Markup.button.callback('🔄 Change Number', 'get_started')]
                            ])
                        }
                    );
                } catch (err) {
                    console.error('Error generating pairing code:', err);
                    ctx.reply(`${em.errorEmoji} <b>Error generating pairing code. Please try again with a valid number.</b>`, { parse_mode: 'HTML' });
                }
            }, 3000);
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            const { connection } = update;
            if (connection === 'open') {
                ctx.reply(`🎉 <b>SUCCESS!</b> Your WhatsApp has been successfully linked to AADHI-XD ${em.blueTick} Bot! ✅`, { parse_mode: 'HTML' });
            }
        });

    } catch (err) {
        console.error('An unexpected error occurred.', err);
        ctx.reply(`${em.errorEmoji} <b>An unexpected error occurred.</b>`, { parse_mode: 'HTML' });
    }
});

bot.action('copy_code', async (ctx) => {
    await ctx.answerCbQuery('💡 Tip: Tap on the code block in the message to copy it directly!');
});

bot.launch();
console.log('🤖 AADHI-XD Linker Bot started successfully with zero errors!');
