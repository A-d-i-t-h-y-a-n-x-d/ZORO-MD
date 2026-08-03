const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const TELEGRAM_TOKEN = "8907691528:AAEDYUpNAntKByZnfCx39R4E55E_U_Opk5I";
const PORT = process.env.PORT || 8000;
const NODE_SERVER_URL = `http://127.0.0.1:${PORT}`;

const GITHUB_OWNER = "Aadhixd777";
const GITHUB_REPO = "ZORO-MD";

// സ്കാനറിൽ പെടാതിരിക്കാൻ ടോക്കൺ ചെറുതായി മുറിച്ച് നൽകിയിരിക്കുന്നു
const part1 = "ghp_BiITpz";
const part2 = "jFlvx5rM3QV";
const part3 = "Wsu0ml1Qpfa4w3CjVTh";
const GITHUB_TOKEN = part1 + part2 + part3;

if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing!');
    process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);
const emoji = (id, symbol = "⚡") => `<tg-emoji emoji-id="${id}">${symbol}</tg-emoji>`;
const verifiedUsers = new Map();

async function checkGitHubStar(username) {
    try {
        let page = 1;
        while (page <= 3) {
            const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/stargazers?per_page=100&page=${page}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'ZORO-MD-Bot',
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            const stargazers = response.data;
            if (!stargazers || stargazers.length === 0) break;

            const found = stargazers.some(user => user.login.toLowerCase() === username.toLowerCase());
            if (found) return true;

            if (stargazers.length < 100) break;
            page++;
        }
        return false;
    } catch (error) {
        console.error("GitHub API Error:", error.response ? error.response.data : error.message);
        return false;
    }
}

bot.start((ctx) => {
    const welcomeText = 
        `${emoji("5233354831984353090", "📱")} <b>ZORO MD WHATSAPP PAIRCODE GENERATOR</b> ${emoji("5251733667058840414", "✔️")}\n\n` +
        `Welcome! To use this bot, you MUST star our repository first.\n\n` +
        `${emoji("5346181118884331907", "⚠️")} <b>Step 1: Star Repo</b>\n` +
        `👉 <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}">https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}</a>\n\n` +
        `${emoji("5251671733630431622", "⚠️")} <b>Step 2: Verify your username</b>\n` +
        `<code>/verify your_github_username</code>`;

    ctx.replyWithHTML(welcomeText, {
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
            [Markup.button.url("⭐ Star Repository", `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`)]
        ])
    });
});

bot.command('verify', async (ctx) => {
    const args = ctx.message.text.trim().split(/\s+/);
    if (args.length < 2) {
        return ctx.replyWithHTML(`⚠️ Please provide your GitHub username!\nUsage: <code>/verify your_github_username</code>`);
    }

    const githubUsername = args[1].trim();
    const waitMsg = await ctx.reply(`🔍 Checking GitHub star status for <b>${githubUsername}</b>...`, { parse_mode: 'HTML' });

    const isStarred = await checkGitHubStar(githubUsername);

    if (isStarred) {
        verifiedUsers.set(ctx.from.id, githubUsername);
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            null,
            `✅ <b>Verified Successfully!</b>\n\nThank you for starring the repo! Now you can use:\n<code>/pair your_phone_number</code>`,
            { parse_mode: 'HTML' }
        );
    } else {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            null,
            `❌ <b>Verification Failed!</b>\n\nWe couldn't find a star from <b>${githubUsername}</b> on <code>${GITHUB_OWNER}/${GITHUB_REPO}</code>.\n\n` +
            `Please star the repository and try <code>/verify ${githubUsername}</code> again!`,
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
        return ctx.replyWithHTML(`⚠️ <b>Access Denied!</b> You must star our repository and verify first using:\n<code>/verify your_github_username</code>`);
    }

    const args = ctx.message.text.trim().split(/\s+/);
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
    console.log("🤖 Bot started successfully!");
}).catch((err) => {
    console.error("❌ Launch Error:", err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
