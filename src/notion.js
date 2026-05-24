const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

/**
 * Create a new subpage under a parent page.
 * Returns the new page URL.
 */
async function createSubpage(parentPageId, titleText, contentText) {
    const paragraphs = (contentText || '').split('\n\n').map(p => p.trim()).filter(Boolean);
    const children = paragraphs.slice(0, 100).map(p => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [{ type: 'text', text: { content: p.slice(0, 1999) } }]
        }
    }));

    const page = await notion.pages.create({
        parent: { page_id: parentPageId },
        properties: {
            title: { title: [{ text: { content: String(titleText) } }] }
        },
        children
    });

    return page.url;
}

// Kept for compatibility — helpers used elsewhere
function title(text) {
    return { title: [{ text: { content: String(text) } }] };
}

function richText(text) {
    return { rich_text: [{ text: { content: String(text) } }] };
}

function number(val) {
    return { number: Number(val) };
}

function date(isoString) {
    return { date: { start: isoString } };
}

function select(name) {
    return { select: { name: String(name) } };
}

function heading2Block(text) {
    return {
        object: 'block', type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }] }
    };
}

function bulletBlock(text) {
    return {
        object: 'block', type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }] }
    };
}

function paragraphBlock(text) {
    return {
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }] }
    };
}

async function createYoutubeSummaryPage(parentPageId, { videoTitle, url, category, summary, keyPoints, actionItems, savedAt }) {
    const children = [
        paragraphBlock(`Source: ${url}`),
        paragraphBlock(`Category: ${category} · Saved: ${savedAt}`),
        heading2Block('Summary'),
        paragraphBlock(summary),
        heading2Block('Key Points'),
        ...keyPoints.map(p => bulletBlock(p)),
        heading2Block('Action Items'),
        ...(actionItems.length ? actionItems.map(p => bulletBlock(p)) : [bulletBlock('None')]),
    ].slice(0, 100);

    const page = await notion.pages.create({
        parent: { page_id: parentPageId },
        properties: { title: { title: [{ text: { content: String(videoTitle) } }] } },
        children
    });

    return page.url;
}

module.exports = { createSubpage, createYoutubeSummaryPage, title, richText, number, date, select };
