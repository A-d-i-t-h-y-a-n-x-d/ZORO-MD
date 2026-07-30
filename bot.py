import asyncio
import os
import re
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, CopyTextButton
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

# ==================== CONFIGURATION ====================
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")

# Store active sessions mapping (chat_id -> status)
active_sessions = {}

# ==================== PREMIUM EMOJI MAPPING ====================
EM = {
    "waLink": '<tg-emoji emoji-id="5334998226636390258">💬</tg-emoji>',
    "phone": '<tg-emoji emoji-id="5935864147051811401">📱</tg-emoji>',
    "settings": '<tg-emoji emoji-id="6220014823963363136">⚙️</tg-emoji>',
    "pairingSuccess": '<tg-emoji emoji-id="5251386049585768540">🔑</tg-emoji>',
    "generalFeature": '<tg-emoji emoji-id="6296218646284863141">✨</tg-emoji>',
    "errorFormat": '<tg-emoji emoji-id="5251437048027442994">❌</tg-emoji>',
    "connected": '<tg-emoji emoji-id="5936253382757979660">🟢</tg-emoji>',
    "blueTick": '<tg-emoji emoji-id="5436053316715424756">☑️</tg-emoji>',
    "indiaFlag": "🇮🇳"
}

# ==================== HELPER FUNCTIONS ====================
def cleanup_user_session(chat_id):
    """Clean up user session directory"""
    session_dir = f"sessions/user_{chat_id}"
    if os.path.exists(session_dir):
        import shutil
        try:
            shutil.rmtree(session_dir)
        except Exception as e:
            print(f"Cleanup error for {chat_id}: {e}")
    if chat_id in active_sessions:
        del active_sessions[chat_id]

# ==================== BOT HANDLERS ====================
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = (
        f"{EM['generalFeature']} <b>WELCOME TO AADHI-XD LINKER</b> {EM['generalFeature']}\n\n"
        f"Link your WhatsApp account securely with our advanced bot.\n\n"
        f"👉 <b>Please send your WhatsApp number with country code</b> "
        f"(e.g., <code>918136880986</code>) to generate your pairing code."
    )
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🚀 GET PAIRING CODE", callback_data="get_started")],
        [InlineKeyboardButton("🌐 DEVELOPER / SUPPORT", url="https://t.me/Aadhixdofc")]
    ])
    await update.message.reply_text(welcome_text, parse_mode="HTML", reply_markup=keyboard)

async def get_started_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.message.reply_text(
        f"{EM['phone']} <b>Please type and send your WhatsApp number now with country code:</b>",
        parse_mode="HTML"
    )

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text.startswith('/'):
        return

    # Extract digits only
    phone_number = re.sub(r'[^0-9]', '', text)
    if len(phone_number) < 10:
        await update.message.reply_text(
            f"{EM['errorFormat']} <b>Invalid phone number!</b> Please send a valid WhatsApp number "
            f"with country code (e.g., <code>918714387286</code>).",
            parse_mode="HTML"
        )
        return

    chat_id = update.effective_chat.id
    cleanup_user_session(chat_id)

    wait_msg = await update.message.reply_text(
        f"⏳ <b>Settings:</b> Initializing Python Session...\n"
        f"{EM['phone']} <b>Phone Number:</b> <code>{phone_number}</code>\n"
        f"⏳ Generating Pairing Code... Please wait.",
        parse_mode="HTML"
    )

    # Simulate Pairing Code Generation
    await asyncio.sleep(2)
    
    sample_code = "1234-5678"
    clean_code = "12345678"

    try:
        await wait_msg.delete()
    except Exception:
        pass

    response_text = (
        f"┏━━ {EM['waLink']} <b>WHATSAPP LINKING</b> {EM['indiaFlag']} {EM['connected']} ━━┓\n\n"
        f"│ {EM['phone']} <b>Phone Number:</b> <code>{phone_number}</code> {EM['blueTick']}\n"
        f"│ {EM['settings']} <b>Settings:</b> Configured\n"
        f"│ {EM['pairingSuccess']} <b>Pairing Code:</b> <code>{sample_code}</code>\n\n"
        f"┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n"
        f"📌 <b>Instructions:</b> {EM['generalFeature']}\n"
        f"1️⃣ Open WhatsApp on your phone\n"
        f"2️⃣ Go to <b>Settings > Linked Devices</b>\n"
        f"3️⃣ Tap <b>Link a Device</b> -> <b>Link with phone number instead</b>\n"
        f"4️⃣ Enter the code above to connect!"
    )

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"📋 Copy Code: {sample_code}", callback_data=f"copy_{clean_code}")],
        [InlineKeyboardButton("🔄 Change Number", callback_data="get_started")]
    ])

    await update.message.reply_text(response_text, parse_mode="HTML", reply_markup=keyboard)

async def copy_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    code = query.data.replace("copy_", "")
    await query.answer(f"📋 Code copied: {code}", show_alert=True)

# ==================== MAIN APP SETUP ====================
def main():
    if not BOT_TOKEN or BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("❌ TELEGRAM_BOT_TOKEN is missing!")
        return

    application = ApplicationBuilder().token(BOT_TOKEN).build()

    # Handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CallbackQueryHandler(get_started_callback, pattern="^get_started$"))
    application.add_handler(CallbackQueryHandler(copy_callback, pattern="^copy_"))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    print("🤖 AADHI-XD Python Telegram Bot started successfully with Premium Emojis!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
