#!/usr/bin/env python3
"""
Scrape the Supertalk ACRONYM® forum thread (818 pages, ~24,500 posts).
Extracts: post_id, author, timestamp, text content, image URLs, quoted text.
Saves to JSONL for downstream analysis.
"""

import re
import json
import time
import sys
import os
import html as html_module
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = "https://supertalk.superfuture.com/topic/116132-acronym/page/{page}/"
# Page 1 has a different URL pattern
PAGE_1_URL = "https://supertalk.superfuture.com/topic/116132-acronym/"
TOTAL_PAGES = 818
OUTPUT_DIR = Path(__file__).parent.parent / "supertalk_data"
OUTPUT_FILE = OUTPUT_DIR / "supertalk_acronym_posts.jsonl"
PROGRESS_FILE = OUTPUT_DIR / "scrape_progress.json"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
DELAY = 0.5  # seconds between requests


def strip_html(text: str) -> str:
    """Remove HTML tags and decode entities, preserving line breaks."""
    # Convert <br>, <p>, <li> to newlines
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</p>', '\n', text)
    text = re.sub(r'</li>', '\n', text)
    text = re.sub(r'</blockquote>', '\n', text)
    # Remove all other tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html_module.unescape(text)
    # Collapse whitespace but preserve newlines
    lines = text.split('\n')
    lines = [' '.join(line.split()) for line in lines]
    text = '\n'.join(line for line in lines if line.strip())
    return text.strip()


def extract_images(html_content: str) -> list[str]:
    """Extract image URLs from post content."""
    imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html_content)
    # Filter out avatars, emojis, and icons
    filtered = []
    for img in imgs:
        if any(skip in img.lower() for skip in ['emoji', 'avatar', 'icon', 'default_photo', 'smil', 'set_resources']):
            continue
        filtered.append(img)
    return filtered


def extract_quotes(html_content: str) -> list[dict]:
    """Extract quoted content with attribution."""
    quotes = []
    # Pattern: <blockquote ...data-ipsquote-username="NAME"...>...content...</blockquote>
    for match in re.finditer(r'<blockquote[^>]*data-ipsquote-username=["\']([^"\']*)["\'][^>]*>(.*?)</blockquote>', html_content, re.DOTALL):
        quotes.append({
            'quoted_user': match.group(1),
            'quoted_text': strip_html(match.group(2))[:500]  # cap length
        })
    return quotes


def parse_page(html: str) -> list[dict]:
    """Parse a single page of the forum thread."""
    posts = []

    # Split by article boundaries
    # Each post is wrapped in <article id="elComment_XXXXX" ...>...</article>
    article_pattern = re.compile(
        r'<article\s+id="elComment_(\d+)"(.*?)</article>',
        re.DOTALL
    )

    for match in article_pattern.finditer(html):
        post_id = match.group(1)
        article_html = match.group(2)

        # Author — extract from profile link within cAuthorPane_author
        author = None
        author_match = re.search(
            r'cAuthorPane_author.*?class="ipsType_break"[^>]*>(?:<span[^>]*>)?([^<]+)',
            article_html, re.DOTALL
        )
        if author_match:
            author = author_match.group(1).strip()
        if not author:
            # Fallback: look for profile link title
            author_match = re.search(r"Go to ([^'\"]+)'s profile", article_html)
            if author_match:
                author = author_match.group(1).strip()

        # Timestamp
        timestamp = None
        time_match = re.search(r"datetime='([^']+)'", article_html)
        if time_match:
            timestamp = time_match.group(1)

        # Post content — everything inside data-role="commentContent"
        content_html = ''
        content_match = re.search(
            r'data-role="commentContent"[^>]*>(.*?)(?:</div>\s*</div>\s*(?:<div\s+class="ipsItemControls"|<ul))',
            article_html, re.DOTALL
        )
        if content_match:
            content_html = content_match.group(1)
            # Remove reaction counts that leak into content
            content_html = re.sub(r'<div\s+data-controller=["\']core\.front\.core\.reaction["\'].*', '', content_html, flags=re.DOTALL)

        # Extract structured data before stripping HTML
        images = extract_images(content_html)
        quotes = extract_quotes(content_html)

        # Strip HTML for plain text
        text = strip_html(content_html)

        if not text and not images:
            continue

        post = {
            'post_id': int(post_id),
            'author': author,
            'timestamp': timestamp,
            'text': text,
        }
        if images:
            post['images'] = images
        if quotes:
            post['quotes'] = quotes

        posts.append(post)

    return posts


def fetch_page(page: int, retries: int = 3) -> str:
    """Fetch a single page with retries."""
    url = PAGE_1_URL if page == 1 else BASE_URL.format(page=page)
    for attempt in range(retries):
        try:
            req = Request(url, headers={'User-Agent': USER_AGENT})
            with urlopen(req, timeout=30) as resp:
                return resp.read().decode('utf-8', errors='replace')
        except (HTTPError, URLError, TimeoutError) as e:
            if attempt < retries - 1:
                wait = (attempt + 1) * 2
                print(f"  Retry {attempt+1} for page {page} after {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  FAILED page {page}: {e}")
                return ''


def load_progress() -> int:
    """Load last completed page from progress file."""
    if PROGRESS_FILE.exists():
        data = json.loads(PROGRESS_FILE.read_text())
        return data.get('last_page', 0)
    return 0


def save_progress(page: int, total_posts: int):
    """Save progress."""
    PROGRESS_FILE.write_text(json.dumps({
        'last_page': page,
        'total_posts': total_posts,
    }))


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    start_page = load_progress() + 1
    if start_page > 1:
        print(f"Resuming from page {start_page}")
        # Count existing posts
        if OUTPUT_FILE.exists():
            with open(OUTPUT_FILE) as f:
                total_posts = sum(1 for _ in f)
        else:
            total_posts = 0
            start_page = 1
    else:
        total_posts = 0

    # Open in append mode if resuming, write mode if starting fresh
    mode = 'a' if start_page > 1 else 'w'

    with open(OUTPUT_FILE, mode) as out:
        for page in range(start_page, TOTAL_PAGES + 1):
            html = fetch_page(page)
            if not html:
                print(f"Page {page}: EMPTY (skipping)")
                continue

            posts = parse_page(html)
            for post in posts:
                post['page'] = page
                out.write(json.dumps(post, ensure_ascii=False) + '\n')

            total_posts += len(posts)

            if page % 10 == 0 or page == TOTAL_PAGES:
                out.flush()
                save_progress(page, total_posts)

            # Progress
            pct = page / TOTAL_PAGES * 100
            print(f"Page {page}/{TOTAL_PAGES} ({pct:.1f}%) — {len(posts)} posts — {total_posts} total")

            time.sleep(DELAY)

    print(f"\nDone! {total_posts} posts saved to {OUTPUT_FILE}")
    save_progress(TOTAL_PAGES, total_posts)


if __name__ == '__main__':
    main()
