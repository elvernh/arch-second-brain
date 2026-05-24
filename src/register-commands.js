require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    // ── Finance ──────────────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('expense')
        .setDescription('Log an expense to Google Sheets')
        .addNumberOption(o => o.setName('amount').setDescription('Amount in IDR').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('Item name e.g. Nasi Goreng, Grab').setRequired(true))
        .addStringOption(o => o.setName('category').setDescription('Expense category').setRequired(true)
            .addChoices(
                { name: 'Makanan', value: 'Makanan' },
                { name: 'Transport', value: 'Transport' },
                { name: 'Kesehatan', value: 'Kesehatan' },
                { name: 'Hiburan', value: 'Hiburan' },
                { name: 'Belanja', value: 'Belanja' },
                { name: 'Tagihan', value: 'Tagihan' },
                { name: 'Investasi', value: 'Investasi' },
                { name: 'Lainnya', value: 'Lainnya' },
            ))
        .addStringOption(o => o.setName('note').setDescription('Optional extra detail')),

    new SlashCommandBuilder()
        .setName('income')
        .setDescription('Log income to Google Sheets')
        .addNumberOption(o => o.setName('amount').setDescription('Amount in IDR').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('Item name e.g. Gaji, Freelance').setRequired(true))
        .addStringOption(o => o.setName('note').setDescription('Optional extra detail')),

    new SlashCommandBuilder()
        .setName('savings')
        .setDescription('Log savings to Google Sheets')
        .addNumberOption(o => o.setName('amount').setDescription('Amount in IDR').setRequired(true))
        .addStringOption(o => o.setName('name').setDescription('Item name e.g. Emergency Fund').setRequired(true))
        .addStringOption(o => o.setName('note').setDescription('Optional extra detail')),

    new SlashCommandBuilder()
        .setName('finance')
        .setDescription("Get this month's finance summary from Google Sheets"),

    new SlashCommandBuilder()
        .setName('budget')
        .setDescription("Set this month's budget in Google Sheets")
        .addNumberOption(o => o.setName('amount').setDescription('Budget in IDR').setRequired(true)),

    // ── Learning / Knowledge ─────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('learn')
        .setDescription('Save a learning note to Notion')
        .addStringOption(o => o.setName('topic').setDescription('What did you learn?').setRequired(true))
        .addStringOption(o => o.setName('category').setDescription('Subject area').setRequired(true)
            .addChoices(
                { name: 'iOS Engineering', value: 'iOS' },
                { name: 'SaaS / Business', value: 'SaaS' },
                { name: 'Blockchain', value: 'Blockchain' },
                { name: 'Research Methodology', value: 'Research Methodology' },
                { name: 'Microservices', value: 'Microservices' },
                { name: 'Software Testing', value: 'Software Testing' },
                { name: 'Mandarin', value: 'Mandarin' },
                { name: 'General', value: 'General' },
            ))
        .addStringOption(o => o.setName('note').setDescription('Key takeaway or details')),

    // ── Ideas ────────────────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('idea')
        .setDescription('Save an idea to Notion')
        .addStringOption(o => o.setName('title').setDescription('Idea title').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Describe the idea')),

    // ── Projects ─────────────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('project')
        .setDescription('Log a project update to Notion')
        .addStringOption(o => o.setName('name').setDescription('Project name').setRequired(true))
        .addStringOption(o => o.setName('status').setDescription('Current status').setRequired(true)
            .addChoices(
                { name: 'In Progress', value: 'In Progress' },
                { name: 'Done', value: 'Done' },
                { name: 'Blocked', value: 'Blocked' },
                { name: 'Planning', value: 'Planning' },
            ))
        .addStringOption(o => o.setName('note').setDescription('What happened or what changed?')),

    // ── Notes & Habits ───────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('note')
        .setDescription('Append a note to your daily vault log')
        .addStringOption(o => o.setName('text').setDescription('Your note').setRequired(true))
        .addStringOption(o => o.setName('tag').setDescription('Tag e.g. idea, reflection, task')),

    new SlashCommandBuilder()
        .setName('habit')
        .setDescription('Mark a daily habit pillar')
        .addStringOption(o => o.setName('name').setDescription('Habit pillar').setRequired(true)
            .addChoices(
                { name: 'Build', value: 'Build' },
                { name: 'Learn', value: 'Learn' },
                { name: 'Finance', value: 'Finance' },
                { name: 'Health', value: 'Health' },
                { name: 'Reflect', value: 'Reflect' },
            ))
        .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true)
            .addChoices(
                { name: 'Done ✓', value: 'done' },
                { name: 'Skipped', value: 'skip' },
            )),

    // ── Summarize YouTube (uses Claude + Notion) ─────────────────────────────
    new SlashCommandBuilder()
        .setName('summarize')
        .setDescription('Summarize a YouTube video and save to Notion Learning (category auto-detected)')
        .addStringOption(o => o.setName('url').setDescription('YouTube video URL').setRequired(true)),

    // ── Heartbeat toggle ─────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('heartbeat-toggle')
        .setDescription('Enable or disable habit nudge notifications in this channel'),

    // ── WhatsApp (read-only summary + recommendations) ───────────────────────
    new SlashCommandBuilder()
        .setName('whatsapp')
        .setDescription('Show unread WhatsApp messages, flag urgent ones, and get reply recommendations'),

    // ── Ask (uses Claude) ────────────────────────────────────────────────────
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask your second brain a question')
        .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),

].map(c => c.toJSON());

const rest = new REST().setToken(process.env.token);

(async () => {
    console.log('Registering slash commands...');
    await rest.put(
        Routes.applicationGuildCommands(process.env.ClientID, process.env.GUILD_ID),
        { body: commands }
    );
    console.log(`Done. ${commands.length} commands registered.`);
})();
