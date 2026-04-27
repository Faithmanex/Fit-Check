import re

with open('services/geminiService.ts', 'r') as f:
    content = f.read()

# Replace ai instance to use GEMINI_API_KEY if process.env.API_KEY is not defined
content = content.replace("const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '' });",
"""
// Initialize with a dummy key if none is provided, or initialize lazily
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || 'DUMMY_KEY_TO_PREVENT_CRASH_ON_LOAD';
const ai = new GoogleGenAI({ apiKey });
""")

with open('services/geminiService.ts', 'w') as f:
    f.write(content)
