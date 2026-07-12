"""
Single source of truth for every dropdown option list used in the Add/Edit
Book form (Genre, Publisher, Language, Translation status, Condition).

To add, rename, or remove an option: edit the list below and restart the
app. See README.md, "Customizing the dropdown lists", for a walkthrough.
"""

OPTION_FIELDS = {
    "genre": {
        "allowOther": True,
        "options": [
            {"value": "Tafsir", "label": "Tafsīr"},
            {"value": "Hadith", "label": "Ḥadīth"},
            {"value": "Fiqh", "label": "Fiqh"},
            {"value": "Usul al-Fiqh", "label": "Uṣūl al-Fiqh"},
            {"value": "Aqidah", "label": "ʿAqīdah"},
            {"value": "Seerah", "label": "Sīrah / Biography"},
            {"value": "Sharh al-Hadith", "label": "Sharḥ al-Ḥadīth (Commentary)"},
            {"value": "Tarikh", "label": "Tārīkh (History)"},
            {"value": "Tasawwuf", "label": "Tāsawwuf"},
            {"value": "Poetry", "label": "Poetry"},
            {"value": "Ilm al-Hay'ah", "label": "Ilm al-Hay'ah"},
            {"value": "Tibb", "label": "Tibb"},
            {"value": "Arabic Language", "label": "Arabic Language"},
        ],
    },
    "publisher": {
        "allowOther": True,
        "options": [{"value": v, "label": v} for v in [
            "دار الكتب العلمية", "دار ابن حزم", "دار ابن كثير", "دار الفكر",
            "دار السلام", "مؤسسة الرسالة", "مكتبة المعارف", "دار طيبة",
            "شبیر برادرز", "دار المأمون", "دار القلم", "دار المنهاج", "دار ابن الجوزي",
            "ضیاء القرآن پبلی کیشنز", "فرید بک اسٹال", 
        ]],
    },
    "language": {
        "allowOther": True,
        "options": [{"value": v, "label": v} for v in ["Arabic", "Persian", "Urdu"]],
    },
    "isTranslation": {
        "allowOther": False,
        "options": [
            {"value": "Original", "label": "Original"},
            {"value": "Translation", "label": "Translation"},
        ],
    },
    "copyType": {
        "allowOther": False,
        "options": [
            {"value": "Published", "label": "Published"},
            {"value": "Photocopy", "label": "Photocopy"},
        ],
    },
    "shelfPosition": {
        "allowOther": False,
        "options": [
            {"value": "Front", "label": "Front"},
            {"value": "Back", "label": "Back"},
        ],
    },
    "shelfSide": {
        "allowOther": False,
        "options": [
            {"value": "East", "label": "East"},
            {"value": "Middle", "label": "Middle"},
            {"value": "West", "label": "West"},
        ],
    },
}
