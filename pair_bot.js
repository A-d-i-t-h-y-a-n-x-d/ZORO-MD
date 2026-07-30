const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 8000;
const NODE_SERVER_URL = `http://127.0.0.1:${PORT}`;

if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing!');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);

// Python Engine പോലെ പെർഫെക്റ്റ് ആനിമേഷൻ കിട്ടാനുള്ള ഇമോജി ടാഗ്
const emoji = (id, symbol = "⚡") => `<tg-emoji emoji-id="${id}">${symbol}</tg-emoji>`;

// Command: /start
bot.start((ctx) => {
    const welcomeText = 
        `${emoji("5251671733630431622", "👑")} <b>ZORO MD WHATSAPP PAIRCODE GENERATOR</b>\n\n` +
        `${emoji("5251733667058840414", "✨")} Welcome to Aadhixd WhatsApp Paircode Generator!\n\n` +
        `${emoji("5935864147051811401", "⚠️")} How to pair your device:\n` +
        `Send your phone number with country code:\n` +
        `<code>/pair 918136880986</code>\n\n` +
        `${emoji("5251733667058840414", "✨")} Powered by Aadhixd System\n\n` +
        `${emoji("5935888993437619556", "👨‍💻")} Developer Support\n` +
        `${emoji("5251386049585768540", "📢")} Official Telegram`;

    ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard([
        [Markup.button.url("Developer Support", "https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==")],
        [Markup.button.url("Official Telegram", "https://t.me/Aadhixdofc")]
    ]));
});

// Command: /pair <number>
bot.command('pair', async (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        const warnText = `${emoji("5935864147051811401", "⚠️")} Please provide your phone number!\nUsage: <code>/pair 918136880986</code>`;
        return ctx.replyWithHTML(warnText);
    }

    const phoneNumber = args[1].replace(/[^0-9]/g, '');
    const statusMsg = await ctx.reply("Generating Pairing Code... Please wait...");

    try {
        const response = await axios.post(`${NODE_SERVER_URL}/pair`, { phone: phoneNumber }, { timeout: 30000 });
        const data = response.data;

        if (data && data.status) {
            const rawCode = data.code;
            const cleanCode = rawCode.replace(/-/g, '');

            const successText = 
                `${emoji("5936079934798696466", "🔥")} <b>AADHIXD PAIRCODE GENERATED</b>\n\n` +
                `YOUR CODE: <code>${rawCode}</code>\n\n` +
                `Steps to link:\n` +
                `1. ${emoji("5936079934798696466", "📱")} Open WhatsApp > ${emoji("5933521976831251008", "⚙️")} Settings > Linked Devices.\n` +
                `2. Tap Link a Device > Link with phone number.\n` +
                `3. Enter the pairing code above.\n\n` +
                `Bot will auto activate after verification!\n\n` +
                `${emoji("5935888993437619556", "👨‍💻")} Developer Support`;

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                successText,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.switchToCurrentChat(`📋 Pair Code: ${rawCode}`, cleanCode)],
                        [Markup.button.url("Developer Support", "https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==")]
                    ])
                }
            );
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Error: ${data.error || 'Failed to get code'}`);
        }
    } catch (err) {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `Server Error: ${err.message}`);
    }
});

bot.launch().then(() => {
    console.log("🤖 Telegram Pairing Bot started successfully...");
}).catch((err) => {
    console.error("❌ Telegraf Bot Launch Error:", err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
