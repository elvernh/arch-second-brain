#!/usr/bin/env python3
"""
Fetches content from a URL for summarization.

Usage:
  python3 fetch_content.py <url>
  python3 fetch_content.py /path/to/file.pdf

Outputs extracted text to stdout.
"""
import sys, re, pathlib

def fetch_youtube(url: str) -> str:
    import os
    from youtube_transcript_api import YouTubeTranscriptApi
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match:
        raise ValueError("Could not extract YouTube video ID from URL.")
    video_id = match.group(1)

    proxy_user = os.environ.get("WEBSHARE_USERNAME")
    proxy_pass = os.environ.get("WEBSHARE_PASSWORD")
    if proxy_user and proxy_pass:
        from youtube_transcript_api.proxies import WebshareProxyConfig
        api = YouTubeTranscriptApi(proxy_config=WebshareProxyConfig(
            proxy_username=proxy_user,
            proxy_password=proxy_pass,
        ))
    else:
        api = YouTubeTranscriptApi()

    try:
        transcript = api.fetch(video_id)
    except Exception:
        transcript_list = api.list(video_id)
        transcript = transcript_list.find_generated_transcript(
            [t.language_code for t in transcript_list]
        ).fetch()
    text = " ".join(entry.text for entry in transcript)
    return f"[YouTube transcript — {url}]\n\n{text}"

def fetch_article(url: str) -> str:
    import requests
    from bs4 import BeautifulSoup
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    # Remove nav, footer, scripts, ads
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()
    # Try to find main content
    main = soup.find("article") or soup.find("main") or soup.find("body")
    text = main.get_text(separator="\n", strip=True) if main else soup.get_text()
    # Collapse blank lines
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return f"[Article — {url}]\n\n" + "\n".join(lines)

def fetch_pdf(path: str) -> str:
    import pypdf
    reader = pypdf.PdfReader(path)
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n\n".join(pages)
    return f"[PDF — {path}]\n\n{text}"

def main():
    if len(sys.argv) < 2:
        print("Usage: fetch_content.py <url-or-pdf-path>", file=sys.stderr)
        sys.exit(1)

    target = sys.argv[1]

    if pathlib.Path(target).exists() and target.endswith(".pdf"):
        print(fetch_pdf(target))
    elif "youtube.com" in target or "youtu.be" in target:
        print(fetch_youtube(target))
    else:
        print(fetch_article(target))

if __name__ == "__main__":
    main()
