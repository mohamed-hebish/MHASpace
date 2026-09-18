/* ==========================================
   MHA Space - SVG Logo & Firebase Web3 Auth Component
   ========================================== */

// 1. عنصر اللوجو المبتكر بصيغة SVG
export function renderLogoContainer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="url(#grad-bg)" stroke="#38bdf8" stroke-width="2"/>
        <path d="M30 70 L30 30 L50 55 L70 30 L70 70" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="50" cy="55" r="5" fill="#f59e0b"/>
        <defs>
          <linearGradient id="grad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
        </defs>
      </svg>
      <span style="font-size: 20px; font-weight: bold; color: #0284c7;">MHA Space</span>
    </div>
  `;
}

// 2. منطق التوقيع والربط بـ Firebase Auth & Realtime Database
export async function connectAndAuthWallet() {
  if (!window.ethereum) {
    alert("يرجى فتح الصفحة من داخل محفظة Web3 مثل MetaMask أو Trust Wallet");
    return;
  }

  try {
    // أ. طلب الاتصال بالمحفظة
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();

    // ب. طلب توقيع آمن (Cryptographic Signature) لإثبات ملكية المحفظة
    const nonce = Date.now();
    const message = `تسجيل الدخول إلى MHA Space\nالعنوان: ${address}\nالرمز العشوائي: ${nonce}`;
    const signature = await signer.signMessage(message);

    // ج. الحصول على بيانات المستخدم من Telegram (إن وجد)
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const userId = telegramUser ? telegramUser.id : address;

    // د. حفظ بيانات التوثيق في Firebase Realtime Database
    if (window.db) {
      await window.db.ref('players/' + userId).update({
        polygonWallet: address,
        signature: signature,
        authNonce: nonce,
        isVerified: true,
        lastLogin: new Date().toISOString()
      });

      alert(`تم التوثيق والربط بنجاح للمحفظة:\n${address.substring(0, 6)}...${address.slice(-4)}`);
    }

    return { address, signature };

  } catch (error) {
    console.error("خطأ أثناء توثيق المحفظة:", error);
    alert("تم إلغاء عملية التوقيع والتوثيق.");
  }
}
