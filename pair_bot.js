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

const emoji = (id, symbol = "⚡") => `<tg-emoji emoji-id="${id}">${symbol}</tg-emoji>`;

// ==========================================
// 🛠️ GITHUB CONFIGURATION
// ==========================================
const GITHUB_OWNER = "Aadhixd777";
const GITHUB_REPO = "ZORO-MD";
const GITHUB_TOKEN = "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"; // 👈 ഇവിടെ 'ghp_' എന്ന് സ്മാൾ ലെറ്ററിലാണ് നൽകിയിരിക്കുന്നത്

const verifiedUsers = new Map();

async function checkGitHubStar(username) {
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/stargazers`;
        
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Node.js-Telegram-Bot',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`
            }
        });

        const stargazers = response.data;
        if (!stargazers || stargazers.length === 0) return false;

        return stargazers.some(user => user.login.toLowerCase() === username.toLowerCase());
    } catch (error) {
        console.error("GitHub API Error:", error.response ? error.response.data : error.message);
        return false;
    }
}

bot.start((ctx) => {
    const welcomeText = 
        `${emoji("5233354831984353090", "📱")} <b>ZORO MD WHATSAPP PAIRCODE GENERATOR</b> ${emoji("5251733667058840414", "✔️")}\n\n` +
        `Welcome to Aadhixd ${emoji("5233354831984353090", "📱")} WhatsApp Paircode Generator!\n\n` +
        `${emoji("5346181118884331907", "⚠️")} <b>Step 1: Verify GitHub Star</b>\n` +
        `Before pairing, you must Star our repository:\n` +
        `👉 <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}">https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}</a>\n\n` +
        `${emoji("5251671733630431622", "⚠️")} <b>Step 2: Send your GitHub Username:</b>\n` +
        `<code>/verify your_github_username</code>\n\n` +
        `Powered by Aadhixd System ${emoji("5251386049585768540", "✔")}`;

    ctx.replyWithHTML(welcomeText, {
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
            [Markup.button.url("Star Repository", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)]
        ])
    });
});

bot.command('verify', async (ctx) => {
    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        return ctx.replyWithHTML(`⚠️ Please provide your GitHub username!\n\nUsage: <code>/verify your_github_username</code>`);
    }

    const githubUsername = args[1].trim();
    const waitMsg = await ctx.reply(`🔍 Checking GitHub status for <b>${githubUsername}</b>... Please wait.`, { parse_mode: 'HTML' });

    const isStarred = await checkGitHubStar(githubUsername);

    if (isStarred) {
        verifiedUsers.set(ctx.from.id, githubUsername);

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            null,
            `${emoji("5251685816828194329", "✅")} <b>Verification Successful!</b>\n\n` +
            `Thank you for starring <code>${GITHUB_REPO}</code>! Your pairing section is now active.\n\n` +
            `Now generate your code using:\n<code>/pair your_phone_number</code>`,
            { parse_mode: 'HTML' }
        );
    } else {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            null,
            `❌ <b>Verification Failed!</b>\n\n` +
            `We couldn't find a star from <b>${githubUsername}</b> on <code>${GITHUB_OWNER}/${GITHUB_REPO}</code>.\n\n` +
            `Please Star the repository first and try again!`,
            { 
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.url("⭐ Star Repository Now", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)]
                ])
            }
        );
    }
});

bot.command('pair', async (ctx) => {
    if (!verifiedUsers.has(ctx.from.id)) {
        return ctx.replyWithHTML(`⚠️ You haven't verified your GitHub star yet! Send <code>/verify your_github_username</code> first.`);
    }

    const text = ctx.message.text.trim();
    const args = text.split(/\s+/);

    if (args.length < 2) {
        return ctx.replyWithHTML(`⚠️ Please provide your phone number!\nUsage: <code>/pair 918136880986</code>`);
    }

    const phoneNumber = args[1].replace(/[^0-9]/g, '');
    const statusMsg = await ctx.reply("Generating Pairing Code... Please wait...");

    try {
        const response = await axios.post(`${NODE_SERVER_URL}/pair`, { phone: phoneNumber }, { timeout: 30000 });
        const data = response.data;

        if (data && data.status) {
            const rawCode = data.code;
            const cleanCode = rawCode.replace(/-/g, '');

            await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                `📱 <b>AADHIXD PAIRCODE GENERATED</b>\n\nYOUR CODE: <code>${rawCode}</code>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.switchToCurrentChat(`📋 Pair Code: ${rawCode}`, cleanCode)]
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
    console.log("🤖 Bot started successfully...");
}).catch((err) => {
    console.error("❌ Launch Error:", err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
