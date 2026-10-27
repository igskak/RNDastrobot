"""Reviewed text blocks for the kundli tools, English and Hindi.

Reports are assembled from these blocks and never free-generated, so every sentence a visitor
can see was written once and checked once against ``b2c_safety_policy``. Adding a block means
adding its Hindi twin; ``test_vedic_content`` fails on any gap or any block the filter rejects.

REVIEW STATUS: the English blocks await review by a person who knows Jyotish, and the Hindi
blocks await review by a native Hindi speaker (see docs/marketing/india-b2c-pilot-plan.md).
Paid reports in a language stay off until its flag in ``REVIEWED_LOCALES`` is switched on.
"""
from __future__ import annotations

import os
from typing import Dict, Tuple

from app.services.vedic_service import DASHA_ORDER, KOOTA_ORDER, NAKSHATRA_KEYS, RASHI_KEYS

LOCALES = ("en", "hi")


def reviewed_locales() -> Tuple[str, ...]:
    """Locales whose text has had its human review. Env KUNDLI_REVIEWED_LOCALES, e.g. "en,hi"."""
    raw = os.getenv("KUNDLI_REVIEWED_LOCALES", "")
    return tuple(part.strip() for part in raw.split(",") if part.strip() in LOCALES)


def pick(block: Dict[str, str], locale: str) -> str:
    return block.get(locale) or block["en"]


RASHI_NAMES: Dict[str, Dict[str, str]] = {
    "en": dict(zip(RASHI_KEYS, ("Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
                                "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"))),
    "hi": dict(zip(RASHI_KEYS, ("मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या", "तुला",
                                "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन"))),
}

NAKSHATRA_NAMES: Dict[str, Dict[str, str]] = {
    "en": dict(zip(NAKSHATRA_KEYS, (
        "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya",
        "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati",
        "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
        "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"))),
    "hi": dict(zip(NAKSHATRA_KEYS, (
        "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु", "पुष्य",
        "आश्लेषा", "मघा", "पूर्वाफाल्गुनी", "उत्तराफाल्गुनी", "हस्त", "चित्रा", "स्वाति",
        "विशाखा", "अनुराधा", "ज्येष्ठा", "मूल", "पूर्वाषाढ़ा", "उत्तराषाढ़ा", "श्रवण",
        "धनिष्ठा", "शतभिषा", "पूर्वभाद्रपद", "उत्तरभाद्रपद", "रेवती"))),
}

NAKSHATRA_QUALITY: Dict[str, Dict[str, str]] = {
    "en": dict(zip(NAKSHATRA_KEYS, (
        "quick starts and a healing touch", "steadfast care and creative stamina",
        "clear focus and a sharpening, purifying energy", "growth, charm and a love of beauty",
        "gentle curiosity and the joy of searching", "renewal, depth and a powerful mind",
        "renewal, optimism and a return to the light", "nourishing care and steady support",
        "intuition, insight and quiet strategy", "dignity, heritage and natural leadership",
        "warmth, play and creative pleasure", "reliable friendship and generous support",
        "skilled hands and a talent for craft", "artistry, design and radiance",
        "independence, flexibility and graceful movement", "determination and a focus on goals",
        "devotion, friendship and teamwork", "seniority, protection and resourcefulness",
        "getting to the root of things and honest inquiry", "enthusiasm and an unbeatable spirit",
        "lasting achievement and principled effort", "listening, learning and connection",
        "rhythm, abundance and community spirit", "healing, independence and a love of mystery",
        "intensity, vision and transformation", "calm depth, compassion and wisdom",
        "kindness, guidance and safe journeys"))),
    "hi": dict(zip(NAKSHATRA_KEYS, (
        "तेज़ शुरुआत और उपचार का स्पर्श", "अटल देखभाल और रचनात्मक सहनशक्ति",
        "साफ़ ध्यान और निखारने वाली ऊर्जा", "विकास, आकर्षण और सुंदरता का प्रेम",
        "कोमल जिज्ञासा और खोज का आनंद", "नवीनीकरण, गहराई और प्रबल मन",
        "नवीनीकरण, आशावाद और उजाले की वापसी", "पोषण भरी देखभाल और स्थिर सहारा",
        "अंतर्ज्ञान, अंतर्दृष्टि और शांत रणनीति", "गरिमा, विरासत और स्वाभाविक नेतृत्व",
        "गर्मजोशी, खेल-भाव और रचनात्मक आनंद", "भरोसेमंद मित्रता और उदार सहयोग",
        "कुशल हाथ और शिल्प की प्रतिभा", "कलात्मकता, रचना और दीप्ति",
        "स्वतंत्रता, लचीलापन और सहज गति", "दृढ़ संकल्प और लक्ष्य पर ध्यान",
        "समर्पण, मित्रता और टीम-भावना", "वरिष्ठता, संरक्षण और सूझबूझ",
        "जड़ तक पहुंचने और ईमानदार जिज्ञासा", "उत्साह और अजेय भावना",
        "टिकाऊ उपलब्धि और सिद्धांतों वाला प्रयास", "सुनना, सीखना और जुड़ाव",
        "लय, समृद्धि और सामुदायिक भावना", "उपचार, स्वतंत्रता और रहस्य से लगाव",
        "तीव्रता, दृष्टि और रूपांतरण", "शांत गहराई, करुणा और विवेक",
        "दयालुता, मार्गदर्शन और सुरक्षित यात्राएं"))),
}

LORD_NAMES: Dict[str, Dict[str, str]] = {
    "en": {"sun": "Sun", "moon": "Moon", "mars": "Mars", "mercury": "Mercury", "jupiter": "Jupiter",
           "venus": "Venus", "saturn": "Saturn", "rahu": "Rahu", "ketu": "Ketu"},
    "hi": {"sun": "सूर्य", "moon": "चंद्र", "mars": "मंगल", "mercury": "बुध", "jupiter": "गुरु",
           "venus": "शुक्र", "saturn": "शनि", "rahu": "राहु", "ketu": "केतु"},
}

# theme: short noun phrase; season: what the period invites; practice: a free, gentle step.
LORD_BLOCKS: Dict[str, Dict[str, Dict[str, str]]] = {
    "sun": {
        "theme": {"en": "clarity, purpose and being seen", "hi": "स्पष्टता, उद्देश्य और पहचान"},
        "season": {"en": "A period that invites you to step forward with confidence and let your purpose become visible.",
                   "hi": "यह दौर आपको आत्मविश्वास के साथ आगे बढ़ने और अपने उद्देश्य को सामने लाने का निमंत्रण देता है।"},
        "practice": {"en": "Spend a few quiet minutes each morning naming one thing you want to move toward.",
                     "hi": "हर सुबह कुछ शांत मिनट निकालकर एक ऐसी बात सोचें जिसकी ओर आप बढ़ना चाहते हैं।"},
    },
    "moon": {
        "theme": {"en": "feelings, home and belonging", "hi": "भावनाएं, घर और अपनापन"},
        "season": {"en": "A period that turns attention toward emotional wellbeing, family and a sense of belonging.",
                   "hi": "यह दौर मन की भलाई, परिवार और अपनेपन की ओर ध्यान ले जाता है।"},
        "practice": {"en": "Keep a small evening habit of your own: a warm drink, a short walk, a few lines in a notebook.",
                     "hi": "शाम को अपनी एक छोटी आदत रखें: कोई गरम पेय, थोड़ी सैर या डायरी में कुछ पंक्तियां।"},
    },
    "mars": {
        "theme": {"en": "energy, courage and initiative", "hi": "ऊर्जा, साहस और पहल"},
        "season": {"en": "A period rich in drive, when starting things and building stamina comes more naturally.",
                   "hi": "यह दौर जोश से भरा है, जब नई शुरुआत करना और सहनशक्ति बढ़ाना सहज लगता है।"},
        "practice": {"en": "Give your energy a regular outlet, such as a brisk walk or a workout you enjoy.",
                     "hi": "अपनी ऊर्जा को नियमित रास्ता दें, जैसे तेज़ कदमों की सैर या पसंद की कोई कसरत।"},
    },
    "mercury": {
        "theme": {"en": "learning, communication and connection", "hi": "सीखना, संवाद और जुड़ाव"},
        "season": {"en": "A period that favours curiosity, conversation, study and practical skills.",
                   "hi": "यह दौर जिज्ञासा, बातचीत, पढ़ाई और व्यावहारिक कौशल के पक्ष में है।"},
        "practice": {"en": "Choose one thing to learn this month and share it with someone.",
                     "hi": "इस महीने कुछ एक नया सीखें और किसी के साथ साझा करें।"},
    },
    "jupiter": {
        "theme": {"en": "growth, wisdom and generosity", "hi": "विकास, विवेक और उदारता"},
        "season": {"en": "An expansive period that supports learning, guidance and the widening of your horizons.",
                   "hi": "यह विस्तार का दौर है, जो सीखने, मार्गदर्शन और नज़रिया बड़ा करने में साथ देता है।"},
        "practice": {"en": "Make time for a mentor, a teacher or a book that stretches you.",
                     "hi": "किसी मार्गदर्शक, शिक्षक या ऐसी किताब के लिए समय निकालें जो आपको आगे बढ़ाए।"},
    },
    "venus": {
        "theme": {"en": "harmony, beauty and relationships", "hi": "सामंजस्य, सौंदर्य और रिश्ते"},
        "season": {"en": "A period that brings attention to affection, creativity, comfort and the pleasure of beauty.",
                   "hi": "यह दौर स्नेह, रचनात्मकता, सुकून और सुंदरता के आनंद की ओर ध्यान लाता है।"},
        "practice": {"en": "Plan something that delights the senses and share it with someone you care about.",
                     "hi": "कुछ ऐसा योजना में रखें जो इंद्रियों को अच्छा लगे और उसे किसी अपने के साथ बांटें।"},
    },
    "saturn": {
        "theme": {"en": "patience, structure and lasting foundations", "hi": "धैर्य, व्यवस्था और टिकाऊ नींव"},
        "season": {"en": "A steady period that rewards patience, discipline and building things meant to last.",
                   "hi": "यह स्थिर दौर है, जो धैर्य, अनुशासन और टिकने वाली चीज़ें बनाने को सराहता है।"},
        "practice": {"en": "Pick one small commitment and keep it every day for a month.",
                     "hi": "एक छोटी सी प्रतिबद्धता चुनें और एक महीने तक रोज़ निभाएं।"},
    },
    "rahu": {
        "theme": {"en": "curiosity, change and new horizons", "hi": "जिज्ञासा, बदलाव और नए क्षितिज"},
        "season": {"en": "A period that draws you toward the unfamiliar, with room for fresh ideas and unusual paths.",
                   "hi": "यह दौर अनजानी राहों की ओर खींचता है, जहां नए विचारों और अलग रास्तों के लिए जगह है।"},
        "practice": {"en": "Try one new thing each week: a place, a skill, a conversation.",
                     "hi": "हर सप्ताह कुछ नया आज़माएं: कोई जगह, कोई कौशल या कोई बातचीत।"},
    },
    "ketu": {
        "theme": {"en": "simplicity, insight and inner depth", "hi": "सादगी, अंतर्दृष्टि और भीतर की गहराई"},
        "season": {"en": "A reflective period that favours simplifying, listening inwardly and valuing what truly matters.",
                   "hi": "यह चिंतन का दौर है, जो सरलता, भीतर सुनने और जो सचमुच मायने रखता है उसे पहचानने में साथ देता है।"},
        "practice": {"en": "Set aside a regular quiet hour without screens.",
                     "hi": "बिना स्क्रीन के एक नियमित शांत घंटा तय करें।"},
    },
}

# Week-ahead lines by the Moon's house counted from the natal Moon (1 = same sign).
MOON_DAY: Dict[int, Dict[str, str]] = {
    1: {"en": "A day of fresh starts and self-awareness.", "hi": "नई शुरुआत और खुद को समझने का दिन।"},
    2: {"en": "A day to attend to values, resources and kind words.", "hi": "मूल्यों, संसाधनों और मीठे बोलों पर ध्यान देने का दिन।"},
    3: {"en": "A day for initiative, short trips and conversations.", "hi": "पहल, छोटी यात्राओं और बातचीत का दिन।"},
    4: {"en": "A day for home, comfort and inner steadiness.", "hi": "घर, सुकून और भीतरी स्थिरता का दिन।"},
    5: {"en": "A day for creativity, play and learning.", "hi": "रचनात्मकता, खेल और सीखने का दिन।"},
    6: {"en": "A day for tidying, routines and caring for details.", "hi": "सलीके, दिनचर्या और बारीकियों का ध्यान रखने का दिन।"},
    7: {"en": "A day for partnership, listening and cooperation.", "hi": "साझेदारी, सुनने और सहयोग का दिन।"},
    8: {"en": "A day for rest, reflection and moving gently.", "hi": "आराम, चिंतन और धीमे चलने का दिन।"},
    9: {"en": "A day for learning, big ideas and optimism.", "hi": "सीखने, बड़े विचारों और आशावाद का दिन।"},
    10: {"en": "A day for purposeful work and visible progress.", "hi": "उद्देश्यपूर्ण काम और दिखती प्रगति का दिन।"},
    11: {"en": "A day for friends, community and shared goals.", "hi": "मित्रों, समुदाय और साझा लक्ष्यों का दिन।"},
    12: {"en": "A day for quiet, rest and recharging.", "hi": "शांति, आराम और ऊर्जा लौटाने का दिन।"},
}

SADE_SATI: Dict[str, Dict[str, str]] = {
    "intro": {
        "en": "Sade Sati is the traditional name for the roughly seven and a half years in which Saturn passes through "
              "the three signs around the natal Moon. Many people experience it as a season of maturity, focus and growth.",
        "hi": "साढ़े साती उन लगभग साढ़े सात वर्षों का पारंपरिक नाम है, जब शनि जन्म-चंद्र के आसपास की तीन राशियों से "
              "गुज़रता है। कई लोग इसे परिपक्वता, एकाग्रता और विकास के मौसम की तरह अनुभव करते हैं।",
    },
    "inactive": {
        "en": "Right now Saturn is outside the three signs around your Moon, so this particular season is not running.",
        "hi": "इस समय शनि आपके चंद्र के आसपास की तीन राशियों से बाहर है, इसलिए यह विशेष मौसम अभी चल नहीं रहा है।",
    },
    "rising": {
        "en": "Saturn is in the sign before your Moon sign. Traditionally this opens a long season of consolidation: "
              "a good time to simplify, build routines and lay careful foundations.",
        "hi": "शनि आपकी चंद्र राशि से पहले वाली राशि में है। परंपरा में यह मज़बूती के लंबे मौसम की शुरुआत है: "
              "सरल बनाने, दिनचर्या गढ़ने और सोच-समझकर नींव रखने का अच्छा समय।",
    },
    "peak": {
        "en": "Saturn is in your Moon sign. This is the centre of the season: a steady time for honesty with yourself, "
              "focus and patient work that lasts.",
        "hi": "शनि आपकी चंद्र राशि में है। यह मौसम का केंद्र है: खुद के साथ ईमानदारी, एकाग्रता और टिकने वाले "
              "धैर्यपूर्ण काम का स्थिर समय।",
    },
    "setting": {
        "en": "Saturn is in the sign after your Moon sign. The season is coming to its close, and the habits you have "
              "built tend to bear fruit.",
        "hi": "शनि आपकी चंद्र राशि के बाद वाली राशि में है। मौसम अपने समापन की ओर है, और जो आदतें आपने बनाई हैं "
              "उनके फल मिलने लगते हैं।",
    },
    "practice": {
        "en": "Choose one or two routines and keep them gently; steady habits are the best companion to this season.",
        "hi": "एक-दो दिनचर्याएं चुनें और उन्हें कोमलता से निभाएं; स्थिर आदतें इस मौसम की सबसे अच्छी साथी हैं।",
    },
    "next": {
        "en": "The next season begins around {date}.",
        "hi": "अगला मौसम लगभग {date} से शुरू होता है।",
    },
    "episode": {
        "en": "From {start} to {end}.",
        "hi": "{start} से {end} तक।",
    },
}

KOOTA_NAMES: Dict[str, Dict[str, str]] = {
    "en": {"varna": "Varna", "vashya": "Vashya", "tara": "Tara", "yoni": "Yoni",
           "graha_maitri": "Graha Maitri", "gana": "Gana", "bhakoot": "Bhakoot", "nadi": "Nadi"},
    "hi": {"varna": "वर्ण", "vashya": "वश्य", "tara": "तारा", "yoni": "योनि",
           "graha_maitri": "ग्रह मैत्री", "gana": "गण", "bhakoot": "भकूट", "nadi": "नाड़ी"},
}

# (looks_at, high, middle, lower) per koota. "lower" always carries a constructive, free step.
KOOTA_TEXT: Dict[str, Dict[str, Tuple[str, str, str, str]]] = {
    "en": {
        "varna": ("how your approaches to purpose and responsibility fit together",
                  "Your outlooks on purpose and responsibility line up naturally.",
                  "Your outlooks on purpose and responsibility line up naturally.",
                  "Your approaches to purpose may differ; talking openly about goals helps you move in step."),
        "vashya": ("how easily you influence and adapt to each other",
                   "There is an easy give and take between you.",
                   "You adapt to each other well with a little attention.",
                   "You may each like to lead at times; agreeing who decides what keeps things light."),
        "tara": ("how your birth stars support each other's rhythm",
                 "Your rhythms support one another.",
                 "Your rhythms match in one direction; shared routines help in the other.",
                 "Your daily rhythms can differ; building shared routines helps you meet in the middle."),
        "yoni": ("natural affinity and ease in closeness",
                 "There is a strong sense of natural affinity.",
                 "Affinity is present and grows with warmth and attention.",
                 "Your instincts differ; patience and open talk about needs builds closeness."),
        "graha_maitri": ("mental friendship and how you think together",
                         "You tend to understand how the other thinks.",
                         "A friendly understanding that deepens with conversation.",
                         "You may approach things differently; curiosity about each other's view turns this into a strength."),
        "gana": ("temperament and everyday style",
                 "Your temperaments sit comfortably together.",
                 "Your everyday styles complement each other with small adjustments.",
                 "Your styles of living can differ; making room for each other's pace helps."),
        "bhakoot": ("emotional bond and shared growth",
                    "A harmonious emotional flow and shared growth are supported.",
                    "A harmonious emotional flow and shared growth are supported.",
                    "This traditional lens points to a theme: being intentional about emotional closeness and shared "
                    "goals. Couples do this through regular, kind check-ins."),
        "nadi": ("energy rhythm and constitution",
                 "Your energy rhythms differ in a complementary way.",
                 "Your energy rhythms differ in a complementary way.",
                 "This traditional lens points to a theme: similar energy rhythms. Variety in routines and shared "
                 "rest can balance this."),
    },
    "hi": {
        "varna": ("उद्देश्य और ज़िम्मेदारी के प्रति आपके नज़रिये का मेल",
                  "उद्देश्य और ज़िम्मेदारी को लेकर आपका नज़रिया स्वाभाविक रूप से मेल खाता है।",
                  "उद्देश्य और ज़िम्मेदारी को लेकर आपका नज़रिया स्वाभाविक रूप से मेल खाता है।",
                  "उद्देश्य को लेकर आपके तरीके अलग हो सकते हैं; लक्ष्यों पर खुलकर बात करने से आप साथ-साथ चल पाते हैं।"),
        "vashya": ("आप एक-दूसरे को कितनी सहजता से प्रभावित करते और अपनाते हैं",
                   "आपके बीच सहज लेन-देन है।",
                   "थोड़े ध्यान से आप एक-दूसरे के अनुरूप ढल जाते हैं।",
                   "कभी-कभी दोनों नेतृत्व करना चाहें तो कौन किस बात का निर्णय लेगा, यह तय कर लेना माहौल हल्का रखता है।"),
        "tara": ("आपके जन्म-नक्षत्र एक-दूसरे की लय को कैसे सहारा देते हैं",
                 "आपकी लय एक-दूसरे का सहारा बनती है।",
                 "आपकी लय एक दिशा में मेल खाती है; साझा दिनचर्या दूसरी दिशा में मदद करती है।",
                 "आपकी रोज़ की लय अलग हो सकती है; साझा दिनचर्या बनाने से आप बीच में मिल पाते हैं।"),
        "yoni": ("स्वाभाविक अपनापन और निकटता की सहजता",
                 "स्वाभाविक अपनेपन का गहरा भाव है।",
                 "अपनापन मौजूद है और गर्मजोशी व ध्यान से बढ़ता है।",
                 "आपकी सहज प्रवृत्तियां अलग हैं; धैर्य और ज़रूरतों पर खुली बातचीत निकटता बढ़ाती है।"),
        "graha_maitri": ("मानसिक मित्रता और साथ सोचने का ढंग",
                         "आप एक-दूसरे के सोचने के ढंग को समझ पाते हैं।",
                         "मैत्रीपूर्ण समझ, जो बातचीत से और गहरी होती है।",
                         "आप चीज़ों को अलग ढंग से देख सकते हैं; एक-दूसरे के नज़रिये के प्रति जिज्ञासा इसे ताकत बना देती है।"),
        "gana": ("स्वभाव और रोज़मर्रा की शैली",
                 "आपके स्वभाव सहजता से साथ बैठते हैं।",
                 "छोटे-छोटे तालमेल से आपकी रोज़मर्रा की शैलियां एक-दूसरे की पूरक बनती हैं।",
                 "जीने के ढंग अलग हो सकते हैं; एक-दूसरे की गति के लिए जगह बनाना मदद करता है।"),
        "bhakoot": ("भावनात्मक बंधन और साझा विकास",
                    "सामंजस्यपूर्ण भावनात्मक प्रवाह और साझा विकास को सहारा मिलता है।",
                    "सामंजस्यपूर्ण भावनात्मक प्रवाह और साझा विकास को सहारा मिलता है।",
                    "यह पारंपरिक दृष्टि एक विषय की ओर इशारा करती है: भावनात्मक निकटता और साझा लक्ष्यों के प्रति सजग रहना। "
                    "जोड़े इसे नियमित, स्नेहभरी बातचीत से निभाते हैं।"),
        "nadi": ("ऊर्जा की लय और प्रकृति",
                 "आपकी ऊर्जा की लय एक-दूसरे की पूरक ढंग से अलग है।",
                 "आपकी ऊर्जा की लय एक-दूसरे की पूरक ढंग से अलग है।",
                 "यह पारंपरिक दृष्टि एक विषय की ओर इशारा करती है: मिलती-जुलती ऊर्जा की लय। दिनचर्या में विविधता और "
                 "साथ का आराम इसे संतुलित कर सकता है।"),
    },
}

MATCH_OVERALL: Dict[str, Dict[str, str]] = {
    "high": {
        "en": "A very harmonious reading in this tradition. Many strengths line up naturally; keep nurturing them with kindness and attention.",
        "hi": "इस परंपरा में यह बहुत सामंजस्यपूर्ण तस्वीर है। कई खूबियां स्वाभाविक रूप से मेल खाती हैं; उन्हें स्नेह और ध्यान से सींचते रहें।",
    },
    "middle": {
        "en": "A good foundation in this tradition. Several strengths are present, and the areas that ask for attention are the ones every couple grows through.",
        "hi": "इस परंपरा में यह एक अच्छी नींव है। कई खूबियां मौजूद हैं, और जिन पहलुओं पर ध्यान चाहिए उनसे हर जोड़ा साथ बढ़ता है।",
    },
    "lower": {
        "en": "This tradition's total sits below its usual reference point of 18, which simply means this lens highlights more "
              "areas to nurture. It is one lens among many, and your values, communication and commitment matter far more than any number.",
        "hi": "इस परंपरा का कुल अंक इसके सामान्य संदर्भ बिंदु 18 से कम है, जिसका अर्थ बस इतना है कि यह दृष्टि सींचने "
              "योग्य अधिक पहलू दिखाती है। यह कई दृष्टियों में से एक है, और आपके मूल्य, संवाद और प्रतिबद्धता किसी भी अंक से कहीं अधिक मायने रखते हैं।",
    },
    "intro": {
        "en": "Ashtakoota compares the Moon placements of two people across eight areas, for a total of 36 points. "
              "Treat it as a conversation starter, not a verdict.",
        "hi": "अष्टकूट दो लोगों के चंद्र स्थान को आठ पहलुओं पर परखकर कुल 36 अंक देता है। इसे बातचीत की शुरुआत "
              "समझें, निर्णय नहीं।",
    },
}

DASHA: Dict[str, Dict[str, str]] = {
    "intro": {
        "en": "Vimshottari dasha is the traditional timeline of life seasons, each led by a planet. It starts from the "
              "Moon's nakshatra at birth.",
        "hi": "विंशोत्तरी दशा जीवन के मौसमों की पारंपरिक समय-रेखा है, जिसका हर दौर एक ग्रह के नेतृत्व में चलता है। यह "
              "जन्म के समय चंद्रमा के नक्षत्र से शुरू होती है।",
    },
    "moon_line": {
        "en": "Your Moon is in {rashi} in the nakshatra {nakshatra}, pada {pada}, a placement associated with {quality}.",
        "hi": "आपका चंद्र {rashi} राशि में, {nakshatra} नक्षत्र के पद {pada} में है, जो {quality} से जुड़ा स्थान है।",
    },
    "now": {
        "en": "You are in the {md} period, with the {ad} sub-period running now. The larger season is about {md_theme}; "
              "the current chapter adds {ad_theme}.",
        "hi": "आप {md} के दौर में हैं, और अभी {ad} की उप-अवधि चल रही है। बड़ा मौसम {md_theme} का है; मौजूदा अध्याय में "
              "{ad_theme} जुड़ता है।",
    },
    "window": {
        "en": "{start} to {end}: the {ad} sub-period inside {md}, highlighting {ad_theme}.",
        "hi": "{start} से {end}: {md} के भीतर {ad} की उप-अवधि, जो {ad_theme} को उभारती है।",
    },
    "no_current": {
        "en": "The 120-year cycle has completed for this date; the timeline above shows every period.",
        "hi": "इस तारीख़ के लिए 120 वर्ष का चक्र पूरा हो चुका है; ऊपर की समय-रेखा में सभी दौर दिखते हैं।",
    },
}

WEEK: Dict[str, Dict[str, str]] = {
    "title": {"en": "Your week ahead", "hi": "आपका आने वाला सप्ताह"},
    "intro": {
        "en": "Each day below follows the Moon's journey around your own Moon sign, set within your current dasha season.",
        "hi": "नीचे का हर दिन आपकी अपनी चंद्र राशि के सापेक्ष चंद्रमा की यात्रा को दर्शाता है, आपके मौजूदा दशा-मौसम के भीतर।",
    },
}

TITLES: Dict[str, Dict[str, str]] = {
    "dasha": {"en": "Your dasha timeline", "hi": "आपकी दशा समय-रेखा"},
    "sade_sati": {"en": "Your Sade Sati season", "hi": "आपका साढ़े साती मौसम"},
    "matching": {"en": "Your Ashtakoota reading", "hi": "आपका अष्टकूट विश्लेषण"},
    "year": {"en": "Your next twelve months", "hi": "आपके अगले बारह महीने"},
    "practice": {"en": "A gentle practice", "hi": "एक कोमल अभ्यास"},
    "moon": {"en": "Your Moon", "hi": "आपका चंद्र"},
}

EMAIL: Dict[str, Dict[str, str]] = {
    "welcome_subject": {"en": "Your kundli report and weekly forecast are ready",
                        "hi": "आपकी कुंडली रिपोर्ट और साप्ताहिक पूर्वानुमान तैयार हैं"},
    "welcome_body": {
        "en": "Thank you for joining. Your personal report and your forecasts are ready at the link below.\n\n"
              "{link}\n\nKeep this link to yourself: anyone who has it can read your forecasts. "
              "You can manage or cancel your subscription at any time from the same page.",
        "hi": "जुड़ने के लिए धन्यवाद। आपकी निजी रिपोर्ट और पूर्वानुमान नीचे दिए लिंक पर तैयार हैं।\n\n"
              "{link}\n\nइस लिंक को अपने तक रखें: जिसके पास यह होगा वह आपके पूर्वानुमान पढ़ सकता है। "
              "आप उसी पेज से कभी भी अपनी सदस्यता संभाल या रद्द कर सकते हैं।",
    },
    "digest_subject": {"en": "Your forecast for the days ahead", "hi": "आने वाले दिनों का आपका पूर्वानुमान"},
    "digest_body": {
        "en": "Your forecast for the coming days is ready.\n\n{summary}\n\nRead it in full: {link}",
        "hi": "आने वाले दिनों का आपका पूर्वानुमान तैयार है।\n\n{summary}\n\nपूरा पढ़ें: {link}",
    },
    "footer": {
        "en": "Manage or cancel your subscription: {manage_link}",
        "hi": "अपनी सदस्यता संभालें या रद्द करें: {manage_link}",
    },
}

GREETING: Dict[str, str] = {"en": "Dear {name},", "hi": "प्रिय {name},"}


def all_blocks() -> Dict[str, Dict[str, str]]:
    """Flat view of every localized block, for the completeness and safety tests."""
    flat: Dict[str, Dict[str, str]] = {}
    for key, block in LORD_BLOCKS.items():
        for field, value in block.items():
            flat[f"lord.{key}.{field}"] = value
    for number, value in MOON_DAY.items():
        flat[f"moon_day.{number}"] = value
    for group_name, group in (("sade_sati", SADE_SATI), ("match_overall", MATCH_OVERALL), ("dasha", DASHA),
                              ("week", WEEK), ("titles", TITLES), ("email", EMAIL)):
        for key, value in group.items():
            flat[f"{group_name}.{key}"] = value
    for locale in LOCALES:
        for key in KOOTA_ORDER:
            for index, text in enumerate(KOOTA_TEXT[locale][key]):
                flat.setdefault(f"koota.{key}.{index}", {})[locale] = text
    for locale in LOCALES:
        for key, text in NAKSHATRA_QUALITY[locale].items():
            flat.setdefault(f"nakshatra_quality.{key}", {})[locale] = text
        for key, text in LORD_NAMES[locale].items():
            flat.setdefault(f"lord_name.{key}", {})[locale] = text
        for key, text in RASHI_NAMES[locale].items():
            flat.setdefault(f"rashi_name.{key}", {})[locale] = text
        for key, text in NAKSHATRA_NAMES[locale].items():
            flat.setdefault(f"nakshatra_name.{key}", {})[locale] = text
        for key, text in KOOTA_NAMES[locale].items():
            flat.setdefault(f"koota_name.{key}", {})[locale] = text
    assert set(DASHA_ORDER) == set(LORD_BLOCKS)
    return flat
