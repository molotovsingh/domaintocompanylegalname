import requests
from bs4 import BeautifulSoup
import re

# Test URL
url = "https://apple.com"

# Make request
response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
soup = BeautifulSoup(response.text, 'html.parser')

# Extract text
text_content = soup.get_text(separator=' ', strip=True)
print(f"Text length: {len(text_content)}")
print(f"First 500 chars: {text_content[:500]}")

# Test entity patterns
entity_patterns = [
    r'\b[A-Z][A-Za-z0-9&\s]+(?:Inc|LLC|Ltd|Corporation|Corp|Company|Co|GmbH|SA|SAS|SpA|Pty|PLC|LP|LLP)\.?\b',
    r'©\s*\d{4}\s*([^\n\r.]+?)(?=\s*[|\n\r]|$)',
    r'Copyright\s*©?\s*\d{4}\s*([^\n\r.]+?)(?=\s*[|\n\r]|$)'
]

print("\nTesting entity patterns:")
for i, pattern in enumerate(entity_patterns):
    matches = re.findall(pattern, text_content, re.IGNORECASE)
    print(f"Pattern {i}: {matches[:5]}")  # First 5 matches

# Look for Apple Inc specifically
apple_pattern = r'Apple\s*Inc\.?'
apple_matches = re.findall(apple_pattern, text_content, re.IGNORECASE)
print(f"\nApple Inc matches: {apple_matches}")