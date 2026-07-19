# دليل الاختبارات

## تقسيم الاختبارات

### ✅ اختبارات Engine (موثوقة 100%)
لا تحتاج متصفح، تعمل بـNode.js خالص، تغطي كل قوانين اللعبة:
- `test_engine.mjs` - قواعد السحب/الرمي/الالتزام/التصعيد
- `test_declare.mjs` - النزول، البيرات، دخول السباق
- `test_fixes_review.mjs` - إصلاحات حرجة (سقف 14، تكرار الورق)
- `test_khales_declare_review.mjs` - الخالص (بنوعيه)، السقف التراكمي، ثغرة الإضافة بدون سباق
- `test_joker_run_extension.mjs` - الجوكر بالتسلسل (داخلي وطرفي)
- `test_ending_methods.mjs` - 11 طريقة إنهاء (هند/لون/قرينق + جوكر/جوكرين)
- `test_ending.mjs` - نقاط الفائز والخصوم، شروط اللون والقرينق
- `test_joker_scoring_tier.mjs` - درجات النقاط حسب ورقة الإعلان (مش عداد النار)

### ⚠️ اختبارات UI (تغطية وظيفية فقط)
تعتمد على jsdom (محاكاة المتصفح)، **لا تعكس السلوك البصري الحقيقي**:
- `test_ui_smoke.mjs` - دورة لعب كاملة، أزرار السحب/الرمي، عداد الدستة
- `test_turn_order_seats.mjs` - ترتيب الأدوار ومقاعد اللاعبين
- `test_transient_ui.mjs` - ظهور/إخفاء الأزرار حسب الدور ومصدر السحب
- `test_drag_to_meld.mjs` - السحب والإفلات على بير مكشوف (يُماثل pointer events)
- `test_tier_preview.mjs` - معاينة تير الإنهاء على الزر ورسالة نهاية الجولة

### ❌ ما يغطيه الاختبار الحالي (يحتاج اختبار يدوي)
- تصغير البيرات التلقائي (transform:scale) - يحتاج قياس getBoundingClientRect حقيقي
- محاذاة أفاتار سالم/فهد - تعتمد على مكان عناصر DOM الفعلي
- الأصوات - Web Audio API غير مدعومة بـjsdom
- الكونفيتي والأنيميشن - CSS animations لا تُحسب بـjsdom
- أداء الـAI على مدى جولات كاملة - يحتاج test integration طويل

## تشغيل الاختبارات

```bash
npm install jsdom --no-save   # مرة واحدة لكل session
node test_engine.mjs
node test_declare.mjs
# ... إلخ
```
