import os
import requests
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, MessageEntity
from dotenv import load_dotenv

# Load Environment Variables
load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
PORT = os.getenv("PORT", "8000")
NODE_SERVER_URL = f"http://127.0.0.1:{PORT}"

bot = telebot.TeleBot(TELEGRAM_TOKEN)

# Telegram Premium Emoji IDs Map
EMOJI_IDS = {
    "WELCOME": "5936079934798696466",
    "PAIR": "6298356878573307709",
    "BOT": "5933521976831251008",
    "CODE": "5251386049585768540",
    "VERIFY": "5251671733630431622",
    "WARN": "5935864147051811401",
    "SUCCESS": "5222300011366200403",
    "INSTA": "5935888993437619556"
}

@bot.message_handler(commands=['start'])
def send_welcome(message):
    welcome_text = (
        "ZORO MD WHATSAPP PAIRCODE GENERATOR\n\n"
        "Welcome to Aadhixd WhatsApp Paircode Generator!\n\n"
        "How to pair your device:\n"
        "Send your phone number with country code:\n"
        "`/pair 918714387286`\n\n"
        "Powered by Aadhixd System"
    )

    # Premium Emoji Entity at index 0
    entity = MessageEntity(
        type="custom_emoji",
        offset=0,
        length=2,
        custom_emoji_id=EMOJI_IDS["WELCOME"]
    )

    # Clean Inline Buttons
    markup = InlineKeyboardMarkup()
    btn_developer = InlineKeyboardButton("Developer Support", url="https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==")
    btn_telegram = InlineKeyboardButton("Official Telegram", url="https://t.me/Aadhixdofc")
    markup.add(btn_developer)
    markup.add(btn_telegram)

    bot.send_message(
        message.chat.id,
        welcome_text,
        parse_mode="Markdown",
        reply_markup=markup,
        entities=[entity]
    )

@bot.message_handler(commands=['pair'])
def process_pair_code(message):
    args = message.text.split()
    if len(args) < 2:
        warn_text = "Please provide your phone number!\nUsage: `/pair 918714387286`"
        entity = MessageEntity(type="custom_emoji", offset=0, length=2, custom_emoji_id=EMOJI_IDS["WARN"])
        bot.send_message(message.chat.id, warn_text, parse_mode="Markdown", entities=[entity])
        return

    phone_number = args[1].replace("+", "").replace(" ", "")
    status_msg = bot.send_message(message.chat.id, "Generating Pairing Code... Please wait...")

    try:
        response = requests.post(
            f"{NODE_SERVER_URL}/pair",
            json={"phone": phone_number},
            timeout=30
        )
        data = response.json()

        if data.get("status"):
            raw_code = data.get("code")  # e.g., "ABCD-1234"
            clean_code = raw_code.replace("-", "") # Clean code for easy copy
            
            success_text = (
                "AADHIXD PAIRCODE GENERATED\n\n"
                f"YOUR CODE: `{raw_code}`\n\n"
                "Steps to link:\n"
                "1. Open WhatsApp > Settings > Linked Devices.\n"
                "2. Tap Link a Device > Link with phone number.\n"
                "3. Enter the pairing code above.\n\n"
                "Bot will auto activate after verification!"
            )
            entity = MessageEntity(type="custom_emoji", offset=0, length=2, custom_emoji_id=EMOJI_IDS["SUCCESS"])
            
            # Buttons: Pair Code Copy + Developer Support
            markup = InlineKeyboardMarkup()
            btn_copy = InlineKeyboardButton(f"📋 Pair Code: {raw_code}", switch_inline_query=clean_code)
            btn_dev = InlineKeyboardButton("Developer Support", url="https://www.instagram.com/aadhi.x._______________?igsh=MWd5a21oeGtpZzNqYw==")
            markup.add(btn_copy)
            markup.add(btn_dev)

            bot.edit_message_text(
                success_text,
                chat_id=message.chat.id,
                message_id=status_msg.message_id,
                parse_mode="Markdown",
                reply_markup=markup
            )
        else:
            bot.edit_message_text(f"Error: {data.get('error')}", chat_id=message.chat.id, message_id=status_msg.message_id)

    except Exception as e:
        bot.edit_message_text(f"Server Error: {str(e)}", chat_id=message.chat.id, message_id=status_msg.message_id)

if __name__ == '__main__':
    print("Telegram Paircode Bot Started...")
    bot.infinity_polling()
