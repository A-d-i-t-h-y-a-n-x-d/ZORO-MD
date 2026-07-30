const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 8000;
const NODE_SERVER_URL = `http://127.0.0.1:${PORT}`;

if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing!');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Command: /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    const welcomeText = 
        "🔹 ZORO MD WHATSAPP PAIRCODE GENERATOR\n\n" +
        "🔹 Welcome to Aadhixd WhatsApp Paircode Generator!\n\n" +
        "🔹 How to pair your device:\n" +
        "Send your phone number with country code:\n" +
        "`/pair 918714387286`\n\n" +
        "🔹 Powered by Aadhixd System\n\n" +
        "🔹 Developer Support\n" +
        "🔹 Official Telegram";

    const options = {
        parse_mode: 'Markdown',
        entities: [
            { type: 'custom_emoji', offset: 0, length: 2, custom_emoji_id: "5251671733630431622" },   // ZORO MD HEADER
            { type: 'custom_emoji', offset: 41, length: 2, custom_emoji_id: "5251733667058840414" },  // Welcome to...
            { type: 'custom_emoji', offset: 95, length: 2, custom_emoji_id: "5935864147051811401" },  // How to pair...
            { type: 'custom_emoji', offset: 202, length: 2, custom_emoji_id: "5251733667058840414" }, // Powered by...
            { type: 'custom_emoji', offset: 233, length: 2, custom_emoji_id: "5935888993437619556" }, // Developer Support
            { type: 'custom_emoji', offset: 255, length: 2, custom_emoji_id: "5251386049585768540" }  // Official Telegram
        ],
        reply_markup: {
            inline_keyboard: [
                [{ text: "Developer Support", url: "https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==" }],
                [{ text: "Official Telegram", url: "https://t.me/Aadhixdofc" }]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeText, options);
});

// Command: /pair <number>
bot.onText(/\/pair(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1];

    if (!input) {
        const warnText = "🔹 Please provide your phone number!\nUsage: `/pair 918714387286`";
        return bot.sendMessage(chatId, warnText, {
            parse_mode: 'Markdown',
            entities: [{ type: 'custom_emoji', offset: 0, length: 2, custom_emoji_id: "5935864147051811401" }]
        });
    }

    const phoneNumber = input.replace(/[^0-9]/g, '');
    const statusMsg = await bot.sendMessage(chatId, "Generating Pairing Code... Please wait...");

    try {
        const response = await axios.post(`${NODE_SERVER_URL}/pair`, { phone: phoneNumber }, { timeout: 30000 });
        const data = response.data;

        if (data && data.status) {
            const rawCode = data.code;
            const cleanCode = rawCode.replace(/-/g, '');

            const successText = 
                "🔹 AADHIXD PAIRCODE GENERATED\n\n" +
                `YOUR CODE: \`${rawCode}\`\n\n` +
                "Steps to link:\n" +
                "1. 🔹 Open WhatsApp > 🔹 Settings > Linked Devices.\n" +
                "2. Tap Link a Device > Link with phone number.\n" +
                "3. Enter the pairing code above.\n\n" +
                "Bot will auto activate after verification!\n\n" +
                "🔹 Developer Support";

            const options = {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: 'Markdown',
                entities: [
                    { type: 'custom_emoji', offset: 0, length: 2, custom_emoji_id: "5936079934798696466" },   // AADHIXD PAIRCODE GENERATED
                    { type: 'custom_emoji', offset: 83, length: 2, custom_emoji_id: "5936079934798696466" },  // Open WhatsApp >
                    { type: 'custom_emoji', offset: 101, length: 2, custom_emoji_id: "5933521976831251008" }, // Settings >
                    { type: 'custom_emoji', offset: 232, length: 2, custom_emoji_id: "5935888993437619556" }  // Developer Support
                ],
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `📋 Pair Code: ${rawCode}`, switch_inline_query: cleanCode }],
                        [{ text: "Developer Support", url: "https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==" }]
                    ]
                }
            };

            bot.editMessageText(successText, options);
        } else {
            bot.editMessageText(`Error: ${data.error || 'Failed to get code'}`, { chat_id: chatId, message_id: statusMsg.message_id });
        }
    } catch (err) {
        bot.editMessageText(`Server Error: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
    }
});

console.log("🤖 Telegram Pairing Bot started successfully (Node.js)...");
