# Arch's Second Brain — Discord Bot

![Claude AI](https://img.shields.io/badge/LLM-Claude%20by%20Anthropic-orange?logo=anthropic&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-commonjs-339933?logo=node.js&logoColor=white)

A personal Discord bot that acts as a second brain interface. Log finance, learning, ideas, and projects directly from Discord into Google Sheets and Notion. Powered by **Claude AI** (Anthropic) for natural language interaction, YouTube summarization, and WhatsApp triage.

## Features

- **Slash commands** for structured logging — finance, learning, ideas, projects, habits, notes
- **Google Sheets** integration for finance tracking (income, expenses, savings)
- **Notion** integration for learning notes, ideas, and project updates
- **YouTube summarizer** — paste a video URL, get a structured summary saved to Notion (category auto-detected by Claude)
- **WhatsApp inbox** — pull unread messages, flag urgent ones, get AI-generated reply drafts
- **Claude AI** fallback — mention the bot or DM it in plain language
- **Heartbeat** — optional habit nudge notifications every 30 min (08:00–23:00 WIB)

## Commands

### Finance (→ Google Sheets)
| Command | Description |
|---------|-------------|
| `/expense amount name category [note]` | Log an expense |
| `/income amount name [note]` | Log income |
| `/savings amount name [note]` | Log savings |
| `/finance` | View this month's summary |
| `/budget amount` | Set this month's budget |

### Knowledge (→ Notion)
| Command | Description |
|---------|-------------|
| `/learn topic category [note]` | Save a learning note |
| `/idea title [description]` | Save an idea |
| `/project name status [note]` | Log a project update |
| `/summarize url` | Summarize a YouTube video and save to Notion Learning |

### Personal (→ Local Vault)
| Command | Description |
|---------|-------------|
| `/note text [tag]` | Append to today's daily log |
| `/habit name status` | Mark a habit pillar done or skipped |
| `/heartbeat-toggle` | Enable or disable habit nudge notifications in this channel |

### Integrations
| Command | Description |
|---------|-------------|
| `/whatsapp` | Show unread WhatsApp messages, flag urgent ones, get reply drafts |

### AI
| Command | Description |
|---------|-------------|
| `/ask question` | Ask your second brain anything |
| `@bot <message>` | Natural language — Claude reads your vault context and responds |

## Setup

### 1. Clone & install
```bash
git clone <repo-url>
cd arch-second-brain
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable | Where to get it |
|----------|----------------|
| `ClientID` | Discord Developer Portal → your app → OAuth2 |
| `ClientSecret` | Discord Developer Portal → your app → OAuth2 |
| `token` | Discord Developer Portal → your app → Bot → Reset Token |
| `GUILD_ID` | Right-click your Discord server → Copy Server ID |
| `APP_URL` | Your server's public URL (use `http://localhost:1500` for local dev) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NOTION_TOKEN` | notion.so/my-integrations → New integration |
| `NOTION_PAGE_FINANCE` | Open Finance page in Notion → copy ID from URL |
| `NOTION_PAGE_LEARNING` | Open Learning page in Notion → copy ID from URL |
| `NOTION_PAGE_IDEAS` | Open Ideas page in Notion → copy ID from URL |
| `NOTION_PAGE_PROJECTS` | Open Projects page in Notion → copy ID from URL |
| `SPREADSHEET_ID` | Google Sheets URL → the long ID between `/d/` and `/edit` |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | Path to your service account JSON file |
| `WHATSAPP_INSTANCE_ID` | GREEN-API dashboard → your instance ID |
| `WHATSAPP_TOKEN` | GREEN-API dashboard → your instance API token |

### 3. Set up Google Sheets
1. Go to console.cloud.google.com → enable **Google Sheets API**
2. Create a service account → download the JSON key → save it locally (e.g. `~/.config/second-brain/google_service_account.json`)
3. Share your Google Sheet with the service account email (Editor access)
4. Set `GOOGLE_SERVICE_ACCOUNT_PATH` to that file's absolute path

### 4. Set up Notion
1. Go to notion.so/my-integrations → create integration → copy token
2. In each Notion page (Finance, Learning, Ideas, Projects): `...` → Connections → add your integration
3. Copy each page ID from the URL: `notion.so/workspace/PAGE-TITLE-**THIS_32_CHAR_ID**`

### 5. Set up WhatsApp (GREEN-API)
1. Register at green-api.com and create an instance
2. Scan the QR code to link your WhatsApp account
3. Copy the **Instance ID** and **API Token** from the dashboard into `.env`

### 6. Register slash commands (run once)
```bash
node src/register-commands.js
```

### 7. Start the bot
```bash
node src/index.js
```

You should see:
```
Bot logged in as Arch's Second Brain#XXXX
```

## Discord App Setup

In the Discord Developer Portal:
- **Bot** → enable **Message Content Intent** (required for DM/mention fallback)
- **OAuth2** → add redirect URI: `http://localhost:1500/api/auth/discord/redirect`
- **OAuth2 → URL Generator** → scopes: `bot` → invite bot to your server

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | [Claude by Anthropic](https://www.anthropic.com) (Sonnet for summarization & WhatsApp triage, Haiku for `/ask` and mentions) |
| Bot framework | [Discord.js v14](https://discord.js.org) |
| Knowledge base | [Notion API](https://developers.notion.com) |
| Finance tracking | [Google Sheets API](https://developers.google.com/sheets) |
| WhatsApp | [GREEN-API](https://green-api.com) |
| Runtime | Node.js |

## Project Structure

```
src/
├── index.js              # Bot entry point — slash commands + message handler
├── sheets.js             # Google Sheets integration (finance)
├── notion.js             # Notion integration (learning, ideas, projects)
├── brain.js              # Vault reader — loads SOUL.md, MEMORY.md, HABITS.md as context
├── whatsapp.js           # GREEN-API integration — fetch unread messages
├── youtube.js            # YouTube transcript fetcher + video title resolver
└── register-commands.js  # One-time slash command registration script
```

## Deploying to Oracle Cloud (free forever)

Oracle Cloud Always Free tier gives you a real Linux VM with 1GB RAM that never expires. Requires a credit card for identity verification only — Always Free resources are never charged.

### 1. Sign up & create a VM

1. Go to [cloud.oracle.com](https://cloud.oracle.com) → sign up
2. During sign-up, select home region: **ap-singapore-1** (closest to Indonesia)
3. Go to **Compute → Instances → Create Instance**
4. Set the following:
   - **Image:** Ubuntu 22.04
   - **Shape:** VM.Standard.A1.Flex (Arm) — Always Free, up to 4 OCPUs + 24GB RAM
   - **SSH keys:** Generate a key pair → download the private key (`.key` file)
5. Click **Create** — wait ~2 min for the instance to start
6. Copy the **Public IP address** from the instance details page

### 2. SSH into the server

```bash
chmod 400 ~/Downloads/your-key.key
ssh -i ~/Downloads/your-key.key ubuntu@<YOUR_PUBLIC_IP>
```

### 3. Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2
```

### 4. Clone the repo and install dependencies

```bash
git clone https://github.com/elvernh/arch-second-brain.git
cd arch-second-brain
npm install
```

### 5. Set up environment variables

```bash
cp .env.example .env
nano .env
```

Fill in all values. For the Google service account:

```bash
mkdir -p ~/.config/second-brain
nano ~/.config/second-brain/google_service_account.json
# paste your service account JSON, then Ctrl+O → Enter → Ctrl+X to save
```

Make sure `.env` has:
```
GOOGLE_SERVICE_ACCOUNT_PATH=/home/ubuntu/.config/second-brain/google_service_account.json
```

### 6. Register slash commands (run once)

```bash
node src/register-commands.js
```

### 7. Start the bot with PM2 (24/7, auto-restarts on crash)

```bash
pm2 start src/index.js --name arch-second-brain
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

### Useful PM2 commands

```bash
pm2 logs arch-second-brain    # live logs
pm2 status                    # check if running
pm2 restart arch-second-brain # restart
pm2 stop arch-second-brain    # stop
```

### Updating the bot

```bash
cd ~/arch-second-brain
git pull
pm2 restart arch-second-brain
```

## Environment Variables

See `.env.example` for the full list. Never commit `.env` — it is git-ignored.
