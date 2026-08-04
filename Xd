Const cluster = require('cluster');
Const fs = require('fs');
Const path = require('path');
Const axios = require('axios');
Const { execSync, spawn } = require('child_process');
Require('dotenv').config();

// ============================================
// AUTO RESTART SYSTEM (MASTER PROCESS)
// ============================================
If (cluster.isPrimary || cluster.isMaster) {
    Console.log('\n╔════════════════════════════════════╗');
    Console.log('║  🛡️ ZORO MD SYSTEM MONITOR ACTIVE    ║');
    Console.log('╚════════════════════════════════════╝\n');
    Console.log('✅ Auto-restart system is active...\n');
    
    Cluster.fork(); // Start the worker (the bot)

    Cluster.on('exit', (worker, code, signal) => {
        Console.log(`\n⚠️ Bot process stopped (Code: ${code}). Restarting in 2 seconds...\n`);
        SetTimeout(() => {
            Cluster.fork();
        }, 2000);
    });

} else {
    // ============================================
    // MODULE UPDATER - RUNS ONLY ON FIRST START
    // ============================================
    Async function downloadAndExtractModules() {
        Const settingsPath = path.join(__dirname, 'settings.js');
        Const modulesInstalledFlag = path.join(__dirname, '.modules_installed');
        
        If (fs.existsSync(modulesInstalledFlag)) {
            Console.log('✅ Modules already installed, skipping download');
            Return true;
        }
        
        If (!fs.existsSync(settingsPath)) {
            Console.log('⚠️ settings.js not found, skipping module update');
            Return false;
        }
        
        Const settings = require('./settings');
        Const zipUrl = settings.updateZipUrl;
        
        If (!zipUrl) {
            Console.log('⚠️ No updateZipUrl configured in settings.js');
            Return false;
        }

        Const TEMP_DIR = path.join(__dirname, 'temp_update');
        Const ZIP_FILE = path.join(TEMP_DIR, 'modules.zip');
        Const EXTRACT_DIR = path.join(TEMP_DIR, 'extracted');

        Console.log('📥 DOWNLOADING MODULES FROM REPOSITORY...');
        Console.log(`📍 URL: ${zipUrl}`);

        Try {
            If (!fs.existsSync(TEMP_DIR)) {
                Fs.mkdirSync(TEMP_DIR, { recursive: true });
            }

            Const response = await axios({
                Method: 'get',
                Url: zipUrl,
                ResponseType: 'arraybuffer',
                Timeout: 120000,
                Headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            Fs.writeFileSync(ZIP_FILE, response.data);
            Console.log('✅ DOWNLOAD COMPLETE!');

            If (fs.existsSync(EXTRACT_DIR)) {
                Fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
            }
            Fs.mkdirSync(EXTRACT_DIR, { recursive: true });

            Console.log('📦 EXTRACTING FILES...');
            ExecSync(`unzip -o "${ZIP_FILE}" -d "${EXTRACT_DIR}"`, { stdio: 'pipe' });

            Const extractedFolders = fs.readdirSync(EXTRACT_DIR);
            Const moduleFolder = extractedFolders.find(f => f.includes('ZORO-MD-MODULES'));
            
            If (!moduleFolder) {
                Console.log('❌ Could not find modules folder in extracted files');
                Return false;
            }

            Const sourcePath = path.join(EXTRACT_DIR, moduleFolder);
            Const basePath = __dirname;

            Const foldersToSync = ['lib', 'plugins', 'data', 'media'];
            Const filesToSync = ['main.js', 'config.js'];

            For (const folder of foldersToSync) {
                Const sourceFolder = path.join(sourcePath, folder);
                Const destFolder = path.join(basePath, folder);
                
                If (fs.existsSync(sourceFolder)) {
                    If (!fs.existsSync(destFolder)) {
                        Fs.mkdirSync(destFolder, { recursive: true });
                    }
                    
                    Fs.cpSync(sourceFolder, destFolder, { recursive: true, force: true });
                    Console.log(`✅ SYNCED FOLDER: ${folder}`);
                }
            }

            For (const file of filesToSync) {
                Const sourceFile = path.join(sourcePath, file);
                Const destFile = path.join(basePath, file);
                
                If (fs.existsSync(sourceFile)) {
                    Fs.copyFileSync(sourceFile, destFile);
                    Console.log(`✅ SYNCED FILE: ${file}`);
                }
            }

            Fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            Fs.writeFileSync(modulesInstalledFlag, new Date().toISOString());
            
            Console.log('🎉 MODULES UPDATED SUCCESSFULLY!');
            Return true;

        } catch (error) {
            Console.error('❌ Error updating modules:', error.message);
            If (fs.existsSync(TEMP_DIR)) {
                Fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            }
            Return false;
        }
    }

    // ============================================
    // FFMPEG CHECK AND AUTO-INSTALL
    // ============================================
    Async function checkAndInstallFFmpeg() {
        Console.log('🎬 CHECKING FFMPEG INSTALLATION...');
        
        Const ffmpegDir = path.join(__dirname, 'ffmpeg_bin');
        Const ffmpegPath = path.join(ffmpegDir, 'ffmpeg');
        Const ffprobePath = path.join(ffmpegDir, 'ffprobe');
        
        Try {
            Const result = execSync('ffmpeg -version', { stdio: 'pipe', encoding: 'utf8' });
            Const version = result.split('\n')[0];
            Console.log(`✅ FFMPEG FOUND IN SYSTEM: ${version.substring(0, 50)}...`);
            Return true;
        } catch (error) {
            Console.log('⚠️ FFmpeg not found in system PATH');
        }
        
        If (fs.existsSync(ffmpegPath)) {
            Try {
                Const result = execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe', encoding: 'utf8' });
                Const version = result.split('\n')[0];
                Console.log(`✅ FFMPEG FOUND LOCALLY: ${version.substring(0, 50)}...`);
                Process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
                Console.log('✅ ADDED FFMPEG TO PATH');
                Return true;
            } catch (error) {
                Console.log('⚠️ Local FFmpeg exists but not working, will re-download');
            }
        }
        
        Console.log('📥 DOWNLOADING FFMPEG AUTOMATICALLY...');
        
        Try {
            If (!fs.existsSync(ffmpegDir)) {
                Fs.mkdirSync(ffmpegDir, { recursive: true });
            }
            
            Const FFMPEG_URL = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
            Const tempFile = path.join(__dirname, 'ffmpeg_temp.tar.xz');
            Const extractDir = path.join(__dirname, 'ffmpeg_extract');
            
            Console.log('📍 DOWNLOADING FROM johnvansickle.com...');
            
            Const response = await axios({
                Method: 'get',
                Url: FFMPEG_URL,
                ResponseType: 'arraybuffer',
                Timeout: 300000,
                Headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            Fs.writeFileSync(tempFile, response.data);
            Console.log('✅ DOWNLOAD COMPLETE!');
            
            Console.log('📦 EXTRACTING FFMPEG...');
            If (fs.existsSync(extractDir)) {
                Fs.rmSync(extractDir, { recursive: true, force: true });
            }
            Fs.mkdirSync(extractDir, { recursive: true });
            
            ExecSync(`tar -xf "${tempFile}" -C "${extractDir}"`, { stdio: 'pipe' });
            
            Const extractedFolders = fs.readdirSync(extractDir);
            Const ffmpegFolder = extractedFolders.find(f => f.includes('ffmpeg'));
            
            If (ffmpegFolder) {
                Const srcFFmpeg = path.join(extractDir, ffmpegFolder, 'ffmpeg');
                Const srcFFprobe = path.join(extractDir, ffmpegFolder, 'ffprobe');
                
                If (fs.existsSync(srcFFmpeg)) {
                    Fs.copyFileSync(srcFFmpeg, ffmpegPath);
                    Fs.chmodSync(ffmpegPath, '755');
                    Console.log('✅ FFmpeg INSTALLED');
                }
                
                If (fs.existsSync(srcFFprobe)) {
                    Fs.copyFileSync(srcFFprobe, ffprobePath);
                    Fs.chmodSync(ffprobePath, '755');
                    Console.log('✅ FFprobe INSTALLED');
                }
            }
            
            Fs.unlinkSync(tempFile);
            Fs.rmSync(extractDir, { recursive: true, force: true });
            
            Process.env.PATH = `${ffmpegDir}:${process.env.PATH}`;
            Console.log('✅ ADDED FFMPEG TO PATH');
            
            Try {
                Const result = execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe', encoding: 'utf8' });
                Const version = result.split('\n')[0];
                Console.log(`🎉 FFMPEG INSTALLED SUCCESSFULLY: ${version.substring(0, 50)}...`);
                Return true;
            } catch (e) {
                Console.log('❌ FFMPEG INSTALLATION VERIFICATION FAILED');
                Return false;
            }
            
        } catch (error) {
            Console.error('❌ Failed to download FFmpeg:', error.message);
            Console.log('⚠️ Some features like stickers and audio effects may not work');
            Console.log('💡 Please install FFmpeg manually on your hosting panel');
            Return false;
        }
    }

    // ============================================
    // MAIN BOT STARTUP
    // ============================================
    Async function startBot() {
        Const express = require('express');
        Const app = express();
        App.use(express.json());

        Const port = process.env.PORT || 8000;
        
        // Express Endpoint for Telegram Pairing Integration
        App.post('/pair', async (req, res) => {
            Const { phone } = req.body;
            If (!phone) {
                Return res.status(400).json({ status: false, error: 'Phone number is required' });
            }

            Try {
                Let phoneNum = phone.replace(/[^0-9]/g, '');
                
                // Wait up to 10 seconds if WhatsApp instance is connecting
                Let retries = 0;
                While (!global.XeonBotIncInstance && retries < 10) {
                    Await new Promise(r => setTimeout(r, 1000));
                    Retries++;
                }

                If (global.XeonBotIncInstance) {
                    Let code = await global.XeonBotIncInstance.requestPairingCode(phoneNum);
                    Code = code?.match(/.{1,4}/g)?.join("-") || code;
                    Return res.json({ status: true, code: code });
                } else {
                    Return res.status(500).json({ status: false, error: 'WhatsApp is still connecting... Please try again in 5 seconds.' });
                }
            } catch (err) {
                Return res.status(500).json({ status: false, error: err.message });
            }
        });

        App.get('/', (req, res) => res.send('Bot is Alive!'));
        App.listen(port, () => console.log(`🚀 Keep-alive & Pairing server running on port ${port}`));

        // Spawn Telegram Pairing Bot ONLY in worker process to prevent duplicates
        If (cluster.isWorker && fs.existsSync(path.join(__dirname, 'pair_bot.js'))) {
            Try {
                Const telegramProcess = spawn('node', ['pair_bot.js']);
                TelegramProcess.stdout.on('data', (data) => console.log(`[Telegram Bot]: ${data.toString().trim()}`));
                TelegramProcess.stderr.on('data', (data) => console.error(`[Telegram Bot Error]: ${data.toString().trim()}`));
            } catch (err) {
                Console.error('❌ Failed to start pair_bot.js:', err.message);
            }
        }

        Console.log('\n╔════════════════════════════════════╗');
        Console.log('║    🚀 ZORO MD BOT STARTING...        ║');
        Console.log('╚════════════════════════════════════╝\n');
        
        Console.log('📥 CHECKING FOR MODULE UPDATES...');
        Try {
            Await downloadAndExtractModules();
        } catch (err) {
            Console.log('⚠️ Module update check failed, continuing with existing files...');
        }
        
        Await checkAndInstallFFmpeg();
        
        Console.log('\n🤖 LOADING BOT MODULES...\n');

        Require('./settings');
        Const { Boom } = require('@hapi/boom');
        Const chalk = require('chalk');
        Const FileType = require('file-type');
        Const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
        
        // Import Anti-Status Mention Plugin
        Const { handleAntiStatusMention, toggleAntiStatusMention } = require('./antiStatusMention');

        Const PhoneNumber = require('awesome-phonenumber');
        Const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif');
        Const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await: awaitFunc, sleep, reSize } = require('./lib/myfunc');
        Const {
            Default: makeWASocket,
            UseMultiFileAuthState,
            DisconnectReason,
            FetchLatestBaileysVersion,
            GenerateForwardMessageContent,
            PrepareWAMessageMedia,
            GenerateWAMessageFromContent,
            GenerateMessageID,
            DownloadContentFromMessage,
            JidDecode,
            Proto,
            JidNormalizedUser,
            MakeCacheableSignalKeyStore,
            Delay
        } = require("@whiskeysockets/baileys");
        Const NodeCache = require("node-cache");
        Const pino = require("pino");
        Const readline = require("readline");
        Const { parsePhoneNumber } = require("libphonenumber-js");
        Const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics');
        Const { rmSync, existsSync } = require('fs');
        Const { join } = require('path');

        Const store = require('./lib/lightweight_store');

        Store.readFromFile();
        Const settings = require('./settings');
        SetInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

        Const MessageQueue = require('./lib/messageQueue');
        Const messageQueue = new MessageQueue();

        SetInterval(() => {
            If (global.gc) {
                Global.gc();
                Console.log('🧹 Garbage collection completed');
            }
        }, 60_000);

        SetInterval(() => {
            Const used = process.memoryUsage().rss / 1024 / 1024;
            If (used > 400) {
                Console.log('⚠️ RAM too high (>400MB), restarting bot...');
                Process.exit(1);
            }
        }, 30_000);

        Let owner = JSON.parse(fs.readFileSync('./data/owner.json'));

        Global.botname = "ZORO BOT";
        Global.themeemoji = "•";

        Async function startXeonBotInc() {
            Let { version, isLatest } = await fetchLatestBaileysVersion();
            
            Const sessionDir = './session';
            If (!fs.existsSync(sessionDir)) {
                Fs.mkdirSync(sessionDir, { recursive: true });
            }
            
            If (process.env.SESSION_ID) {
                Try {
                    Let sessionId = process.env.SESSION_ID;
                    SessionId = sessionId.replace(/^["']|["']$/g, '');
                    If (sessionId.includes(':~')) {
                        SessionId = sessionId.split(':~')[1];
                    }
                    Const sessionData = Buffer.from(sessionId, 'base64').toString('utf-8');
                    Const credsPath = path.join(sessionDir, 'creds.json');
                    Fs.writeFileSync(credsPath, sessionData);
                    Console.log('✅ Session loaded from .env SESSION_ID');
                } catch (err) {
                    Console.log('⚠️ Could not decode SESSION_ID from .env:', err.message);
                }
            }
            
            Const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
            Const msgRetryCounterCache = new NodeCache();

            Const XeonBotInc = makeWASocket({
                Version,
                Logger: pino({ level: 'silent' }),
                PrintQRInTerminal: false,
                Browser: ["Ubuntu", "Chrome", "20.0.04"],
                Auth: {
                    Creds: state.creds,
                    Keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                MarkOnlineOnConnect: true,
                GenerateHighQualityLinkPreview: true,
                SyncFullHistory: true,
                GetMessage: async (key) => {
                    Let jid = jidNormalizedUser(key.remoteJid);
                    Let msg = await store.loadMessage(jid, key.id);
                    Return msg?.message || "";
                },
                MsgRetryCounterCache,
                DefaultQueryTimeoutMs: undefined,
            });

            // Store global instance for Telegram API route
            Global.XeonBotIncInstance = XeonBotInc;

            Store.bind(XeonBotInc.ev);

            Const { wrapSendMessage } = require('./lib/fontTransformer');
            WrapSendMessage(XeonBotInc);

            Const originalSendMessage = XeonBotInc.sendMessage;
            Const baseSendMessage = originalSendMessage;
            Let hasConnectedOnce = false;

            XeonBotInc.sendMessage = async function(jid, content, options = {}) {
                Try {
                    Return await originalSendMessage.call(this, jid, content, options);
                } catch (error) {
                    Console.log(`⚠️ Message send failed, queueing for retry: ${error.message}`);
                    MessageQueue.addMessage(jid, content, 1);
                    Throw error;
                }
            };

            XeonBotInc.sendMessageDirect = async function(jid, content, options = {}) {
                Return await baseSendMessage.call(this, jid, content, options);
            };

            XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
                Try {
                    Const mek = chatUpdate.messages[0];
                    If (!mek.message) return;
                    Mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;
                    
                    Const chatId = mek.key.remoteJid;
                    Const senderId = mek.key.participant || chatId;

                    If (chatId === 'status@broadcast') {
                        Await handleStatus(XeonBotInc, chatUpdate);
                        Return;
                    }
                    
                    // Handle Anti-Status Mention Check
                    Try {
                        Await handleAntiStatusMention(XeonBotInc, chatId, mek, senderId);
                    } catch (e) {
                        Console.error("Error in anti-status mention handler:", e);
                    }

                    If (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

                    If (XeonBotInc?.msgRetryCounterCache) {
                        XeonBotInc.msgRetryCounterCache.clear();
                    }

                    // Check for Anti-Status Toggle Command (e.g. .antistatus on/off)
                    Const messageText = mek.message.conversation || mek.message.extendedTextMessage?.text || '';
                    If (messageText.trim().toLowerCase().startsWith('.antistatus')) {
                        Let isGroupAdmin = false;
                        If (chatId.endsWith('@g.us')) {
                            Try {
                                Const metadata = await XeonBotInc.groupMetadata(chatId);
                                Const admins = metadata.participants.filter(v => v.admin !== null).map(v => v.id);
                                IsGroupAdmin = admins.includes(senderId);
                            } catch (err) {
                                IsGroupAdmin = false;
                            }
                        }
                        Await toggleAntiStatusMention(XeonBotInc, chatId, messageText, senderId, isGroupAdmin);
                        Return;
                    }

                    Try {
                        Await handleMessages(XeonBotInc, chatUpdate, true);
                    } catch (err) {
                        Console.error("Error in handleMessages:", err);
                        If (mek.key && mek.key.remoteJid) {
                            Await XeonBotInc.sendMessage(mek.key.remoteJid, {
                                Text: '❌ An error occurred while processing your message.',
                            }).catch(console.error);
                        }
                    }
                } catch (err) {
                    Console.error("Error in messages.upsert:", err);
                }
            });

            XeonBotInc.decodeJid = (jid) => {
                If (!jid) return jid;
                If (/:\d+@/gi.test(jid)) {
                    Let decode = jidDecode(jid) || {};
                    Return decode.user && decode.server && decode.user + '@' + decode.server || jid;
                } else return jid;
            };

            XeonBotInc.ev.on('contacts.update', update => {
                For (let contact of update) {
                    Let id = XeonBotInc.decodeJid(contact.id);
                    If (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
                }
            });

            XeonBotInc.getName = (jid, withoutContact = false) => {
                Let id = XeonBotInc.decodeJid(jid);
                WithoutContact = XeonBotInc.withoutContact || withoutContact;
                Let v;
                If (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                    V = store.contacts[id] || {};
                    If (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {};
                    Resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'));
                });
                Else v = id === '0@s.whatsapp.net' ? {
                    Id,
                    Name: 'WhatsApp'
                } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
                    XeonBotInc.user :
                    (store.contacts[id] || {});
                Return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
            };

            XeonBotInc.public = true;
            XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

            XeonBotInc.ev.on('connection.update', async (s) => {
                Const { connection, lastDisconnect } = s;
                If (connection == "open") {
                    Console.log(chalk.magenta(` `));
                    Console.log(chalk.yellow(`🦅 CONNECTED TO => ` + JSON.stringify(XeonBotInc.user, null, 2)));

                    MessageQueue.setConnected(true);
                    Await messageQueue.processQueue(XeonBotInc);

                    Const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    If (!hasConnectedOnce) {
                        HasConnectedOnce = true;
                        
                        Await XeonBotInc.sendMessageDirect(botNumber, {
                            Text: "✨ *Bot Successfully Updated & Restarted!* ✅"
                        }).catch(err => console.log('⚠️ Could not send update message:', err.message));

                        Await delay(2000);

                        Await XeonBotInc.sendMessageDirect(botNumber, {
                            Text: `
┏❐═⭔ *ZORO CONNECTED SUCCESSFULLY* ⭔═❐
┃⭔ *Bot:* ZORO MD 
┃⭔ *Time:* ${new Date().toLocaleString()}
┃⭔ *Status:* Active
┃⭔ *User:* ${botNumber}
┗❐═⭔════════⭔═❐

ᴘʟᴇᴀsᴇ ᴊᴏɪɴ ᴛʜᴇ ɢʀᴏᴜᴘ
https://chat.whatsapp.com/IUe14A04uicGJdIOfBuuvd?s=cl&p=a&ilr=1`,
                        }).catch(err => console.log('⚠️ Could not send connection message:', err.message));
                    }

                    SetInterval(() => messageQueue.processQueue(XeonBotInc), 10000);

                    Await delay(1999);
                    
                    Console.log(chalk.yellow(`\n\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮`));
                    Console.log(chalk.bold.blue(`│     🔥 ZORO MD BOT 🔥      │`));
                    Console.log(chalk.yellow(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`));
                    
                    Console.log(chalk.cyan(`╔════════════════════════════════════╗`));
                    Console.log(chalk.green(`║  ✅ ZORO CONNECTION SUCCESSFUL! ✅     ║`));
                    Console.log(chalk.cyan(`╠════════════════════════════════════╣`));
                    Console.log(chalk.magenta(`║ 👤 Owner: Aadhixd                  ║`));
                    Console.log(chalk.magenta(`║ 📱 Number: ${owner}                 ║`));
                    Console.log(chalk.magenta(`║ 💎 Version: ${settings.version || '3.0.0'}                     ║`));
                    Console.log(chalk.magenta(`║ ⏰ Time: ${new Date().toLocaleString()}  ║`));
                    Console.log(chalk.magenta(`║ 🔥 Status: ACTIVE                  ║`));
                    Console.log(chalk.cyan(`╚════════════════════════════════════╝\n`));
                    
                    Console.log(chalk.green(`${global.themeemoji || '•'} 🍁 ZORO MD IS ACTIVE 🔥`));
                    Console.log(chalk.blue(`${global.themeemoji || '•'} All systems operational!`));
                }
                If (connection === 'close') {
                    MessageQueue.setConnected(false);
                    Console.log(chalk.yellow('⚠️ Connection lost - messages will be queued for retry'));
                    Const statusCode = lastDisconnect?.error?.output?.statusCode;
                    If (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        Try {
                            RmSync('./session', { recursive: true, force: true });
                        } catch { }
                        Console.log(chalk.red('Session logged out. Please re-authenticate.'));
                        StartXeonBotInc();
                    } else {
                        Console.log(chalk.yellow('Reconnecting...'));
                        StartXeonBotInc();
                    }
                }
            });

            Const { handleCall } = require('./plugins/anticall-improved');
            XeonBotInc.ev.on('call', async (calls) => {
                Try {
                    For (const call of calls) {
                        Const callData = {
                            From: call.from || call.peerJid || call.chatId,
                            Id: call.id,
                            Status: call.status || 'offer'
                        };
                        Await handleCall(XeonBotInc, callData);
                    }
                } catch (e) {
                    Console.error('Error handling call:', e);
                }
            });

            XeonBotInc.ev.on('creds.update', saveCreds);
            XeonBotInc.ev.on('group-participants.update', async (update) => {
                Await handleGroupParticipantUpdate(XeonBotInc, update);
            });
            XeonBotInc.ev.on('messages.upsert', async (m) => {
                If (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
                    Await handleStatus(XeonBotInc, m);
                }
            });
            XeonBotInc.ev.on('status.update', async (status) => {
                Await handleStatus(XeonBotInc, status);
            });
            XeonBotInc.ev.on('messages.reaction', async (status) => {
                Await handleStatus(XeonBotInc, status);
            });

            Return XeonBotInc;
        }

        Console.log(chalk.green('\n🤖 STARTING WHATSAPP CONNECTION...\n'));
        Await startXeonBotInc();
    }

    StartBot().catch(error => {
        Console.error('Fatal error:', error);
        Process.exit(1);
    });

    Process.on('uncaughtException', (err) => {
        Console.error('Uncaught Exception:', err);
    });

    Process.on('unhandledRejection', (err) => {
        Console.error('Unhandled Rejection:', err);
    });

    Let file = require.resolve(__filename);
    Fs.watchFile(file, () => {
        Fs.unwatchFile(file);
        Console.log(`Update ${__filename}`);
        Delete require.cache[file];
        Require(file);
    });
}
