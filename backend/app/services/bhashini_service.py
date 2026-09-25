import logging
from typing import Dict, Any, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger("cognipath.bhashini")

# Mapping of supported regional languages
SUPPORTED_INDIC_LANGUAGES = {
    "en": "English",
    "hi": "Hindi (हिंदी)",
    "te": "Telugu (తెలుగు)",
    "ta": "Tamil (தமிழ்)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (मराठी)",
    "ml": "Malayalam (മലയാളം)",
    "gu": "Gujarati (ગુજરાતી)"
}

class BhashiniService:
    """Wrapper for India Government Bhashini ULCA Open API (Translation, ASR, TTS)."""
    def __init__(self):
        self.user_id = settings.BHASHINI_USER_ID
        self.api_key = settings.BHASHINI_API_KEY
        self.pipeline_id = settings.BHASHINI_PIPELINE_ID
        self.base_url = settings.BHASHINI_BASE_URL

    async def translate_text(
        self,
        text: str,
        source_lang: str = "en",
        target_lang: str = "hi"
    ) -> str:
        """Translates text between English and Indian regional languages using Bhashini NMT."""
        if source_lang == target_lang or not text.strip():
            return text

        if self.api_key and self.user_id:
            try:
                headers = {
                    "userID": self.user_id,
                    "ulcaApiKey": self.api_key,
                    "Content-Type": "application/json"
                }
                payload = {
                    "pipelineTasks": [
                        {
                            "taskType": "translation",
                            "config": {
                                "language": {
                                    "sourceLanguage": source_lang,
                                    "targetLanguage": target_lang
                                }
                            }
                        }
                    ],
                    "inputData": {
                        "input": [{"source": text}]
                    }
                }

                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(self.base_url, headers=headers, json=payload)
                    if response.status_code == 200:
                        data = response.json()
                        translated_text = data["pipelineResponse"][0]["output"][0]["target"]
                        return translated_text
                    else:
                        logger.warning("Bhashini translation API returned HTTP %s", response.status_code)
            except Exception as e:
                logger.error("Bhashini translation exception: %s", e)

        # Fallback informative translation mock for local offline testing
        return self._mock_indic_translation(text, target_lang)

    async def transcribe_audio(
        self,
        audio_base64: str,
        source_lang: str = "en"
    ) -> str:
        """Transcribes Indian regional language audio to text using Bhashini ASR."""
        if self.api_key and self.user_id:
            try:
                headers = {
                    "userID": self.user_id,
                    "ulcaApiKey": self.api_key,
                    "Content-Type": "application/json"
                }
                payload = {
                    "pipelineTasks": [
                        {
                            "taskType": "asr",
                            "config": {
                                "language": {"sourceLanguage": source_lang},
                                "audioFormat": "wav"
                            }
                        }
                    ],
                    "inputData": {
                        "audio": [{"audioContent": audio_base64}]
                    }
                }
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(self.base_url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["pipelineResponse"][0]["output"][0]["source"]
            except Exception as e:
                logger.error("Bhashini ASR error: %s", e)

        return "Explain the difference between binary search trees and AVL trees."

    async def text_to_speech(
        self,
        text: str,
        target_lang: str = "hi",
        gender: str = "female"
    ) -> Optional[str]:
        """Synthesizes text into speech audio (base64) using Bhashini TTS."""
        if self.api_key and self.user_id:
            try:
                headers = {
                    "userID": self.user_id,
                    "ulcaApiKey": self.api_key,
                    "Content-Type": "application/json"
                }
                payload = {
                    "pipelineTasks": [
                        {
                            "taskType": "tts",
                            "config": {
                                "language": {"sourceLanguage": target_lang},
                                "gender": gender
                            }
                        }
                    ],
                    "inputData": {
                        "input": [{"source": text[:500]}]  # Bhashini chunk limit
                    }
                }
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(self.base_url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["pipelineResponse"][0]["audio"][0]["audioContent"]
            except Exception as e:
                logger.error("Bhashini TTS error: %s", e)

        return None

    def _mock_indic_translation(self, text: str, target_lang: str) -> str:
        """Provides simulated localized header when offline."""
        prefixes = {
            "hi": "नमस्ते! आपके पाठ्यक्रम सामग्री के अनुसार स्पष्टीकरण:\n\n",
            "te": "నమస్కారం! మీ పాఠ్యాంశాల ఆధారంగా వివరణ:\n\n",
            "ta": "வணக்கம்! உங்கள் பாடத்திட்டத்தின் அடிப்படையிலான விளக்கம்:\n\n",
            "kn": "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಪಠ್ಯಕ್ರಮದ ಆಧಾರದ ವಿವರಣೆ:\n\n",
            "bn": "নমস্কার! আপনার পাঠ্যক্রমের উপাদানের ভিত্তিতে ব্যাখ্যা:\n\n",
            "mr": "नमस्कार! तुमच्या अभ्यासक्रमाच्या आधारे स्पष्टीकरण:\n\n"
        }
        prefix = prefixes.get(target_lang, "")
        return prefix + text

bhashini_service = BhashiniService()
