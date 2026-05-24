#!/usr/bin/env python3
"""
Fetches content from a URL for summarization.

Usage:
  python3 fetch_content.py <url>
  python3 fetch_content.py /path/to/file.pdf

Outputs extracted text to stdout.
"""
import sys, re, pathlib, os


def fetch_youtube(url: str) -> str:
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match:
        raise ValueError("Could not extract YouTube video ID from URL.")

    # 1. Supadata API — reliable, no cookies needed (set SUPADATA_API_KEY)
    text = _supadata_transcript(url)
    if text:
        return f"[YouTube transcript — {url}]\n\n{text}"

    # 2. yt-dlp with browser cookies (set YOUTUBE_COOKIES_B64)
    text = _ytdlp_transcript(url)
    if text:
        return f"[YouTube transcript — {url}]\n\n{text}"

    # 3. youtube-transcript-api — works on non-datacenter IPs (local dev)
    return _ytta_transcript(url)


def _supadata_transcript(url: str) -> str | None:
    api_key = os.environ.get("SUPADATA_API_KEY")
    if not api_key:
        return None
    import requests
    try:
        resp = requests.get(
            "https://api.supadata.ai/v1/youtube/transcript",
            params={"url": url, "text": "true"},
            headers={"x-api-key": api_key},
            timeout=20,
        )
        if not resp.ok:
            print(f"Supadata HTTP {resp.status_code}", file=sys.stderr)
            return None
        data = resp.json()
        return data.get("content") or data.get("text") or None
    except Exception as e:
        print(f"Supadata failed: {e}", file=sys.stderr)
        return None


def _ytdlp_transcript(url: str) -> str | None:
    b64 = os.environ.get("YOUTUBE_COOKIES_B64")
    if not b64:
        return None  # yt-dlp without cookies always fails on cloud IPs

    try:
        import yt_dlp, requests, tempfile, base64
    except ImportError:
        return None

    cookie_file = None
    try:
        tf = tempfile.NamedTemporaryFile(mode='wb', suffix='.txt', delete=False)
        tf.write(base64.b64decode(b64))
        tf.close()
        cookie_file = tf.name

        ydl_opts = {
            "skip_download": True,
            "quiet": True,
            "no_warnings": True,
        }
        if cookie_file:
            ydl_opts["cookiefile"] = cookie_file

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
            except Exception as e:
                print(f"yt-dlp failed: {e}", file=sys.stderr)
                return None

        captions = info.get("automatic_captions") or info.get("subtitles") or {}
        if not captions:
            print("yt-dlp: no captions found", file=sys.stderr)
            return None

        lang = "en" if "en" in captions else next(iter(captions))
        formats = captions[lang]
        fmt = next(
            (f for f in formats if f.get("ext") == "json3"),
            next((f for f in formats if f.get("ext") == "vtt"), formats[0]),
        )

        resp = requests.get(fmt["url"], timeout=15)
        if not resp.ok:
            return None

        if fmt.get("ext") == "json3":
            texts = []
            for event in resp.json().get("events", []):
                for seg in event.get("segs", []):
                    t = seg.get("utf8", "").strip()
                    if t and t != "\n":
                        texts.append(t)
            return " ".join(texts) if texts else None

        lines = [
            l for l in resp.text.splitlines()
            if l and not l.startswith("WEBVTT") and
            not re.match(r"\d{2}:\d{2}", l) and
            not re.match(r"\d+$", l) and
            not l.startswith("NOTE")
        ]
        result = " ".join(lines)
        return result if result.strip() else None

    finally:
        if cookie_file:
            try:
                os.unlink(cookie_file)
            except OSError:
                pass


def _ytta_transcript(url: str) -> str:
    from youtube_transcript_api import YouTubeTranscriptApi
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    video_id = match.group(1)
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
