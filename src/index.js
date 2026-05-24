require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { createSubpage, createYoutubeSummaryPage } = require('./notion');
const { logTransaction, getFinanceSummary, setBudget } = require('./sheets');
const { getVideoTitle, getTranscript } = require('./youtube');
const { getUrgentMessages } = require('./whatsapp');
const { getContext, appendToVaultFile, todayWIB, nowWIB } = require('./brain');
const { startWebhookServer, getStoredChats } = require('./webhook');

const HABITS_FILE = path.join(process.env.HOME, 'Second-Brain/HABITS.md');
const NOTIFY_STATE = path.join(process.env.HOME, '.claude/data/state/discord-notify.json');

function updateHabitCheckbox(name, checked) {
    try {
        const text = fs.readFileSync(HABITS_FILE, 'utf8');
        const mark = checked ? 'x' : ' ';
        const updated = text.replace(
            new RegExp(`(- \\[)[ x](\\] \\*\\*${name}\\*\\*)`),
            `$1${mark}$2`
        );
        if (updated !== text) {
            fs.writeFileSync(HABITS_FILE, updated, 'utf8');
            return true;
        }
    } catch { /* HABITS.md may not exist yet */ }
    return false;
}

function loadNotifyState() {
    try { return JSON.parse(fs.readFileSync(NOTIFY_STATE, 'utf8')); } catch { return { enabled: false }; }
}

function saveNotifyState(state) {
    fs.mkdirSync(path.dirname(NOTIFY_STATE), { recursive: true });
    fs.writeFileSync(NOTIFY_STATE, JSON.stringify(state, null, 2));
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.once('clientReady', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

client.on('error', (err) => {
    console.error('Discord client error:', err.message);
});

function safeErrorMessage(err) {
    // Strip long hex/alphanumeric tokens that may appear in API URLs before sending to Discord
    const msg = (err.message || String(err)).replace(/\/[A-Za-z0-9]{20,}/g, '/[REDACTED]');
    return `Something went wrong: ${msg}`.slice(0, 1990);
}

// ── Slash command handler ─────────────────────────────────────────────────────

const OWNER_ID = process.env.DISCORD_OWNER_ID;

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        await interaction.deferReply({ ephemeral: true });
    } catch {
        return;
    }

    if (OWNER_ID && interaction.user.id !== OWNER_ID) {
        await interaction.editReply('Not authorized.').catch(() => {});
        return;
    }

    const { commandName, options } = interaction;
    const ts = nowWIB();
    const today = todayWIB();

    try {
        if (commandName === 'expense') {
            const amount = options.getNumber('amount');
            const name = options.getString('name');
            const category = options.getString('category');
            const note = options.getString('note') || '';

            await logTransaction({
                kategori: 'Pengeluaran',
                nama: name,
                deskripsi: note || name,
                jumlah: amount,
                subKategori: category,
            });

            await interaction.editReply(
                `✓ Logged **${name}** — IDR ${amount.toLocaleString('id-ID')} (${category})${note ? `\n> ${note}` : ''}`
            );

        } else if (commandName === 'income') {
            const amount = options.getNumber('amount');
            const name = options.getString('name');
            const note = options.getString('note') || '';

            await logTransaction({
                kategori: 'Pemasukan',
                nama: name,
                deskripsi: note || name,
                jumlah: amount,
            });

            await interaction.editReply(
                `✓ Logged income **${name}** — IDR ${amount.toLocaleString('id-ID')}${note ? `\n> ${note}` : ''}`
            );

        } else if (commandName === 'savings') {
            const amount = options.getNumber('amount');
            const name = options.getString('name');
            const note = options.getString('note') || '';

            await logTransaction({
                kategori: 'Tabungan',
                nama: name,
                deskripsi: note || name,
                jumlah: amount,
            });

            await interaction.editReply(
                `✓ Logged savings **${name}** — IDR ${amount.toLocaleString('id-ID')}${note ? `\n> ${note}` : ''}`
            );

        } else if (commandName === 'budget') {
            const amount = options.getNumber('amount');
            await setBudget(amount);
            await interaction.editReply(
                `✓ Budget set to **IDR ${amount.toLocaleString('id-ID')}** for this month.`
            );

        } else if (commandName === 'finance') {
            const summary = await getFinanceSummary();
            await interaction.editReply(
                `**Finance — ${summary.month}**\n` +
                `Income:    ${summary.income}\n` +
                `Expenses:  ${summary.expenses}\n` +
                `Savings:   ${summary.savings}\n` +
                `Budget:    ${summary.budget}\n` +
                `Remaining: ${summary.sisa}`
            );

        } else if (commandName === 'learn') {
            const topic = options.getString('topic');
            const category = options.getString('category');
            const note = options.getString('note') || '';

            const content = [`Category: ${category}`, note, `Logged: ${ts}`].filter(Boolean).join('\n\n');
            const url = await createSubpage(process.env.NOTION_PAGE_LEARNING, topic, content);

            await interaction.editReply(`✓ Saved **${topic}** (${category}) to Notion Learning.\n${url}`);

        } else if (commandName === 'idea') {
            const title = options.getString('title');
            const description = options.getString('description') || '';

            const content = [description, `Logged: ${ts}`].filter(Boolean).join('\n\n');
            const url = await createSubpage(process.env.NOTION_PAGE_IDEAS, title, content);

            await interaction.editReply(`✓ Saved idea **${title}** to Notion.\n${url}`);

        } else if (commandName === 'project') {
            const name = options.getString('name');
            const status = options.getString('status');
            const note = options.getString('note') || '';

            const content = [`Status: ${status}`, note, `Updated: ${ts}`].filter(Boolean).join('\n\n');
            const url = await createSubpage(process.env.NOTION_PAGE_PROJECTS, name, content);

            await interaction.editReply(`✓ Logged **${name}** [${status}] to Notion Projects.\n${url}`);

        } else if (commandName === 'note') {
            const text = options.getString('text');
            const tag = options.getString('tag');

            appendToVaultFile(`daily/${today}.md`, `\n## ${ts}\n${tag ? `[${tag}] ` : ''}${text}`);

            await interaction.editReply(`✓ Added to today's log.${tag ? ` [${tag}]` : ''}`);

        } else if (commandName === 'habit') {
            const name = options.getString('name');
            const status = options.getString('status');
            const done = status === 'done';
            const check = done ? 'x' : ' ';

            // Update HABITS.md checkbox
            const updated = updateHabitCheckbox(name, done);
            // Also log to daily vault
            appendToVaultFile(`daily/${today}.md`, `\n## Habit — ${ts}\n[${check}] ${name}`);

            await interaction.editReply(
                done
                    ? `✓ **${name}** marked done${updated ? ' — HABITS.md updated' : ''}.`
                    : `Noted — **${name}** skipped today.`
            );

        } else if (commandName === 'heartbeat-toggle') {
            const state = loadNotifyState();
            const wasEnabled = state.enabled;
            const newState = {
                enabled: !wasEnabled,
                channel_id: interaction.channelId,
                user_id: interaction.user.id,
            };
            saveNotifyState(newState);

            await interaction.editReply(
                newState.enabled
                    ? `✓ Heartbeat notifications **enabled** in this channel.\nYou'll get a habit nudge every 30 min from 08:00–23:00 WIB.`
                    : `✓ Heartbeat notifications **disabled**.`
            );

        } else if (commandName === 'summarize') {
            const url = options.getString('url');

            const [videoTitle, transcript] = await Promise.all([
                getVideoTitle(url),
                getTranscript(url)
            ]);

            const VALID_CATEGORIES = ['iOS', 'SaaS', 'Blockchain', 'Research Methodology', 'Microservices', 'Software Testing', 'Mandarin', 'General'];

            const aiResponse = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                system: 'You are a concise learning assistant. Return ONLY valid JSON, no markdown.',
                messages: [{
                    role: 'user',
                    content: `Summarize this YouTube video into a structured learning note and classify it.\n\nVideo title: "${videoTitle}"\n\nReturn JSON with:\n- category: one of [${VALID_CATEGORIES.map(c => `"${c}"`).join(', ')}] — pick the best fit based on the content\n- summary: 2-3 sentence overview\n- keyPoints: array of 4-7 bullet strings (start each with a strong verb or noun)\n- actionItems: array of 0-3 concrete next-step strings\n\nTranscript:\n${transcript.slice(0, 12000)}`
                }]
            });

            let parsed;
            try {
                parsed = JSON.parse(aiResponse.content[0].text);
            } catch {
                const jsonMatch = aiResponse.content[0].text.match(/\{[\s\S]*\}/);
                parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: aiResponse.content[0].text, keyPoints: [], actionItems: [], category: 'General' };
            }

            const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'General';

            // Reply immediately, save to Notion in the background
            await interaction.editReply(
                `**${videoTitle}**\n` +
                `Category: ${category} *(auto-detected)*\n\n` +
                `**Summary:** ${parsed.summary}\n\n` +
                `_Saving to Notion..._`
            );

            createYoutubeSummaryPage(process.env.NOTION_PAGE_LEARNING, {
                videoTitle,
                url,
                category,
                summary: parsed.summary || '',
                keyPoints: parsed.keyPoints || [],
                actionItems: parsed.actionItems || [],
                savedAt: ts
            }).then(notionUrl => {
                interaction.editReply(
                    `**${videoTitle}**\n` +
                    `Category: ${category} *(auto-detected)*\n\n` +
                    `**Summary:** ${parsed.summary}\n\n` +
                    `Saved to Notion Learning: ${notionUrl}`
                ).catch(() => {});
            }).catch(err => {
                console.error('Notion save failed:', err.message);
            });

        } else if (commandName === 'whatsapp') {
            const storedChats = getStoredChats().slice(0, 5);

            let contextData, headerText;

            if (storedChats.length > 0) {
                // Use real-time webhook store
                const totalMessages = storedChats.reduce((s, c) => s + c.messages.length, 0);
                headerText = `**WhatsApp — ${ts} WIB** · ${totalMessages} messages across ${storedChats.length} chats *(live)*`;
                contextData = storedChats.map(c =>
                    `Chat: ${c.name}\n` +
                    c.messages.slice(-10).map(m => `  ${m.sender}: ${m.text}`).join('\n')
                ).join('\n\n');
            } else {
                // Fall back to GREEN-API polling
                const { unreadChats, results } = await getUrgentMessages();

                if (results.length === 0) {
                    await interaction.editReply('No unread WhatsApp messages right now.\n\n_Tip: make sure the webhook URL is set in your GREEN-API dashboard so messages are captured in real-time._');
                    return;
                }

                const totalUnread = unreadChats.reduce((s, c) => s + c.unread, 0);
                headerText = `**WhatsApp — ${ts} WIB** · ${totalUnread} unread across ${results.length} chats *(polled)*`;
                contextData = results.map(r =>
                    `Chat: ${r.chat} (${r.unread} unread)\n` +
                    r.messages.slice(-10).map(m => `  [${m.type}] ${m.sender}: ${m.text}`).join('\n')
                ).join('\n\n');
            }

            const aiResponse = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 1024,
                system: `You are Elvern's second brain. Analyse these WhatsApp messages and produce a structured report.
Current time: ${ts} WIB.
Rules:
- Urgent: direct questions, task assignments, mentions of deadlines or "tolong", "ASAP", "kapan", "minta"
- Important: group messages where Elvern is mentioned or tagged
- FYI: announcements, casual chat that needs no reply
- Recommendations: short draft reply for urgent items only (concise + friendly)
- NEVER say to send automatically — always "for your review"
- Reply in English`,
                messages: [{
                    role: 'user',
                    content: `<whatsapp_messages>\n${contextData}\n</whatsapp_messages>\n\nProduce the report with sections: Urgent, Important, FYI, and for each urgent item include a recommended reply draft.`
                }]
            });

            const report = aiResponse.content[0].text;
            const full = `${headerText}\n\n${report}`;
            await interaction.editReply(full.slice(0, 1990));

        } else if (commandName === 'ask') {
            const question = options.getString('question');
            const context = getContext();

            const response = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                system: `You are Elvern's second brain assistant. Answer concisely based on the context below.\n\n${context}\n\nNow: ${ts}`,
                messages: [{ role: 'user', content: question }]
            });

            const answer = response.content[0].text;
            await interaction.editReply(answer.slice(0, 1990));
        }

    } catch (err) {
        console.error(err.message || err);
        await interaction.editReply(safeErrorMessage(err)).catch(() => {});
    }
});

// ── DM / @mention fallback (natural language via Claude) ─────────────────────

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (OWNER_ID && message.author.id !== OWNER_ID) return;

    const mentioned = message.mentions.has(client.user);
    const isDM = message.channel.type === 1;
    if (!mentioned && !isDM) return;

    const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!prompt) {
        await message.reply('Use slash commands (type `/`) to log things, or ask me anything here.');
        return;
    }

    await message.channel.sendTyping();

    try {
        const context = getContext();
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: `You are Elvern's second brain assistant. Answer concisely based on the context below. Suggest using slash commands (e.g. /expense, /learn, /idea) for logging.\n\n${context}\n\nNow: ${nowWIB()}`,
            messages: [{ role: 'user', content: prompt }]
        });

        await message.reply(response.content[0].text.slice(0, 1990));
    } catch (err) {
        console.error(err.message || err);
        await message.reply(safeErrorMessage(err));
    }
});

client.login(process.env.token);
startWebhookServer();
