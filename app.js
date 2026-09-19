// تهيئة بيئة تليجرام للتطبيق المصغر
const tg = window.Telegram?.WebApp;

// التأكد من أن التطبيق يعمل داخل تليجرام وتمديد الشاشة
if (tg) {
  tg.ready();
  tg.expand();
}

/**
 * دالة استدعاء عملية الدفع بالنجوم
 */
async function buyWithStars() {
  const payBtn = document.getElementById('payStarsBtn');
  
  if (!tg) {
    alert("يرجى فتح التطبيق من داخل تليجرام فقط.");
    return;
  }

  try {
    // 1. تعطيل الزر مؤقتاً لحين معالجة الطلب
    payBtn.disabled = true;
    payBtn.innerText = "جاري تحضير الفاتورة...";

    // 2. إرسال طلب إلى السيرفر الخاص بك لتوليد رابط فاتورة النجوم (XTR)
    // غيّر الرابط أسفله إلى رابط السيرفر الخاص بك لاحقاً
    const response = await fetch('/api/create-stars-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: tg.initDataUnsafe?.user?.id || 0,
        initData: tg.initData // يُرسل للتحقق من هوية المستخدم في السيرفر
      })
    });

    const data = await response.json();

    // إرجاع حالة الزر عند اكتمال الطلب
    payBtn.disabled = false;
    payBtn.innerText = "شراء الميزة (50 ⭐)";

    if (!data.success || !data.invoiceLink) {
      tg.showAlert(data.message || "حدث خطأ أثناء إنشاء الفاتورة من السيرفر.");
      return;
    }

    // 3. فتح نافذة الدفع بالنجوم الرسمية من تليجرام
    tg.openInvoice(data.invoiceLink, (status) => {
      if (status === 'paid') {
        tg.showAlert("✨ تم الدفع بنجاح! تم تفعيل الميزة الترويجية بحسابك.");
        // يمكنك هنا إضافة كود لتحديث واجهة اللعبة تلقائياً
      } else if (status === 'cancelled') {
        console.log("قام المستخدم بإلغاء عملية الدفع.");
      } else {
        tg.showAlert("لم تكتمل عملية الدفع، يرجى المحاولة لاحقاً.");
      }
    });

  } catch (error) {
    console.error("Payment Error:", error);
    payBtn.disabled = false;
    payBtn.innerText = "شراء الميزة (50 ⭐)";
    tg.showAlert("تعذر الاتصال بالسيرفر، تأكد من اتصال الإنترنت.");
  }
}
