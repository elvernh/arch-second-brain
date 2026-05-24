#!/usr/bin/env python3
"""
Fetches content from a URL for summarization.

Usage:
  python3 fetch_content.py <url>
  python3 fetch_content.py /path/to/file.pdf

Outputs extracted text to stdout.
"""
import sys, re, pathlib


def _innertube_transcript(video_id: str):
    """Fetch transcript via YouTube iOS InnerTube API (bypasses cloud IP blocks)."""
    import requests

    resp = requests.post(
        "https://www.youtube.com/youtubei/v1/player",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": "AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc",
            "User-Agent": "com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
        },
        json={
            "context": {
                "client": {
                    "clientName": "IOS",
                    "clientVersion": "19.09.3",
                    "deviceModel": "iPhone16,2",
                    "hl": "en",
                    "gl": "US",
                }
            },
            "videoId": video_id,
        },
        timeout=15,
    )
    if not resp.ok:
        return None

    tracks = (
        resp.json()
        .get("captions", {})
        .get("playerCaptionsTracklistRenderer", {})
        .get("captionTracks", [])
    )
    if not tracks:
        return None

    track = next((t for t in tracks if t.get("languageCode", "").startswith("en")), tracks[0])
    cap = requests.get(track["baseUrl"] + "&fmt=json3", timeout=15)
    if not cap.ok:
        return None

    texts = []
    for event in cap.json().get("events", []):
        for seg in event.get("segs", []):
            t = seg.get("utf8", "").strip()
            if t and t != "\n":
                texts.append(t)

    return " ".join(texts) if texts else None


def fetch_youtube(url: str) -> str:
    import os
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match:
        raise ValueError("Could not extract YouTube video ID from URL.")
    video_id = match.group(1)

    # Primary: iOS InnerTube (no proxy needed, works from cloud IPs)
    text = _innertube_transcript(video_id)
    if text:
        return f"[YouTube transcript — {url}]\n\n{text}"

    # Fallback: youtube-transcript-api (works locally; proxy for cloud)
    from youtube_transcript_api import YouTubeTranscriptApi

    username = os.environ.get("WEBSHARE_USERNAME")
    password = os.environ.get("WEBSHARE_PASSWORD")
    if username and password:
        from youtube_transcript_api.proxies import WebshareProxyConfig
        api = YouTubeTranscriptApi(proxy_config=WebshareProxyConfig(
            proxy_username=username,
            proxy_password=password,
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
    return f"[YouTube transcript — {url}]\n\n{' '.join(e.text for e in transcript)}"


def fetch_article(url: str) -> str:
    import requests
    from bs4 import BeautifulSoup
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()
    main = soup.find("article") or soup.find("main") or soup.find("body")
    text = main.get_text(separator="\n", strip=True) if main else soup.get_text()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return f"[Article — {url}]\n\n" + "\n".join(lines)


def fetch_pdf(path: str) -> str:
    import pypdf
    reader = pypdf.PdfReader(path)
    pages = [page.extract_text() or "" for page in reader.pages]
    return f"[PDF — {path}]\n\n" + "\n\n".join(pages)


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
