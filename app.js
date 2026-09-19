/* ==========================================
   MHASpace Metaverse - Complete Core Logic
   Includes: Isolated Referrals (10k MHA Bonus), Visual VFX,
   Starfield, Global Progress, Splash Loader & Safe Firebase Persistence
   ========================================== */

// --- Firebase Setup ---
const firebaseConfig = {
  databaseURL: "https://mhaspace-97691-default-rtdb.europe-west1.firebasedatabase.app/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userWalletAddress = null;
let userWalletApp = null;
let score = 0.00;
let multiplier = 1;
let isPaused = false;
let isDataLoaded = false; 
const maxCap = 7500000;
const RECEIVER_WALLET = "UQAqK_qhqpc_lMlh2SVmaqjbR4XfmkIhPdPVoUukb1aYHTG9";
const MANIFEST_URL = 'https://mhaspace.hebishalex-fb0.workers.dev/tonconnect-manifest.json';

// --- Extract Telegram User ID & Referral Code ---
function getUserId() {
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (telegramUser && telegramUser.id) {
    return telegramUser.id.toString();
  }
  if (userWalletAddress) {
    return userWalletAddress;
  }
  return "GUEST_USER";
}

function getReferrerId() {
  const initData = window.Telegram?.WebApp?.initDataUnsafe;
  if (initData && initData.start_param) {
    return initData.start_param.toString();
  }
  return null;
}

// --- TON Connect UI Setup ---
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: MANIFEST_URL,
    buttonRootId: 'ton-connect-btn'
});

const welcomeTonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: MANIFEST_URL,
    buttonRootId: 'welcome-ton-btn'
});

// معالجة اتصال المحفظة وتفعيل مكافأة الإحالة الناجحة (10,000 MHA)
function handleWalletConnect(wallet) {
  if (wallet) {
    userWalletAddress = wallet.account.address;
    userWalletApp = wallet.device.appName || 'tonkeeper';

    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal) welcomeModal.style.display = 'none';
    
    const dbStatus = document.getElementById('db-status');
    if (dbStatus) dbStatus.innerText = `متصل عبر ${userWalletApp} 🔗`;

    // معالجة مكافأة الداعي مرة واحدة فقط عند توثيق المحفظة لأول مرة
    processReferralBonusOnConnect();
  } else {
    userWalletAddress = null;
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal) welcomeModal.style.display = 'flex';
    
    const dbStatus = document.getElementById('db-status');
    if (dbStatus) dbStatus.innerText = "غير متصل بالمحفظة";
  }
  saveToFirebase();
}

tonConnectUI.onStatusChange(handleWalletConnect);
welcomeTonConnectUI.onStatusChange(handleWalletConnect);

// --- Referral Processing (10,000 MHA for Successful Referral) ---
function processReferralBonusOnConnect() {
  const currentUserId = getUserId();
  const referrerId = getReferrerId();

  if (!referrerId || referrerId === currentUserId) return;

  const refCheckRef = db.ref('players/' + currentUserId + '/referredByProcessed');
  refCheckRef.once('value').then((snapshot) => {
    if (!snapshot.exists() || !snapshot.val()) {
      // تسليم 10,000 MHA للداعي في قائمة المكافآت المستقلة
      db.ref('players/' + referrerId + '/unclaimedRefBonus').transaction((currentBonus) => {
        return (currentBonus || 0) + 10000;
      });

      // زيادة عداد الإحالات الناجحة
      db.ref('players/' + referrerId + '/successfulRefsCount').transaction((count) => {
        return (count || 0) + 1;
      });

      // تعليم الحالة كمعالجة لمنع التكرار
      refCheckRef.set(true);
      db.ref('players/' + currentUserId + '/referredBy').set(referrerId);
    }
  });
}

// فحص واستلام مكافآت الإحالات المعلقة عند الدخول (Surprise Modal/Popup)
function checkPendingReferralBonuses(userId) {
  const bonusRef = db.ref('players/' + userId + '/unclaimedRefBonus');
  bonusRef.once('value').then((snapshot) => {
    const bonusAmount = snapshot.val();
    if (bonusAmount && bonusAmount > 0) {
      score = Math.min(maxCap, score + bonusAmount);
      bonusRef.remove(); // مسح المكافأة بعد إضافتها للرصيد
      updateUI();
      saveToFirebase();

      // تنبيه بالمفاجأة
      alert(`🎁 مفاجأة! لقد حصلت على ${bonusAmount.toLocaleString()} MHA مقابل إحالة ناجحة قامت بربط المحفظة!`);
    }
  });
}

// --- Firebase Read/Write ---
function saveToFirebase() {
  if (!isDataLoaded) return;

  const userId = getUserId();
  if (!userId || userId === "GUEST_USER") return;

  db.ref('players/' + userId).update({
    tonWallet: userWalletAddress || "",
    walletProvider: userWalletApp || "unknown",
    tonVerified: !!userWalletAddress,
    score: score,
    multiplier: multiplier,
    lastActive: Date.now()
  });
}

function loadUserDataFromFirebase() {
  const userId = getUserId();

  db.ref('players/' + userId).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      score = typeof data.score === 'number' ? data.score : 0.00;
      multiplier = data.multiplier || 1;
    }
    isDataLoaded = true;
    
    // إخفاء شاشة التحميل (Splash Loader)
    const splash = document.getElementById('splash-loader');
    if (splash) splash.style.display = 'none';

    updateUI();
    checkPendingReferralBonuses(userId);
  }).catch((error) => {
    console.error("خطأ في جلب البيانات:", error);
    isDataLoaded = true;
    const splash = document.getElementById('splash-loader');
    if (splash) splash.style.display = 'none';
  });
}

loadUserDataFromFirebase();

function updateUI() {
  const scoreEl = document.getElementById('score-val');
  if (scoreEl) scoreEl.innerText = score.toFixed(2);
  
  const rankEl = document.getElementById('rank-badge');
  if (rankEl) rankEl.innerText = `المضاعف (${multiplier}x)`;
  
  const percentage = Math.min(100, (score / maxCap) * 100).toFixed(4);
  const progText = document.getElementById('progress-text');
  if (progText) progText.innerText = percentage;

  const progFill = document.getElementById('progress-fill');
  if (progFill) progFill.style.width = Math.max(1, percentage) + '%';
}

// --- Pause System ---
function togglePause() {
  isPaused = !isPaused;
  const pauseModal = document.getElementById('pause-modal');
  if (pauseModal) pauseModal.style.display = isPaused ? 'flex' : 'none';
}

// --- TON Payment Transaction ---
async function buyMultiplier(multi, tonAmount) {
  if (!userWalletAddress) {
    alert("يرجى ربط محفظة TON أولاً لتأكيد المعاملة!");
    return;
  }
  const nanoTon = Math.floor(parseFloat(tonAmount) * 1000000000);
  const transaction = {
    validUntil: Math.floor(Date.now() / 1000) + 60,
    messages: [{ address: RECEIVER_WALLET, amount: nanoTon.toString() }]
  };
  try {
    await tonConnectUI.sendTransaction(transaction);
    multiplier = multi;
    updateUI();
    saveToFirebase();
    alert(`تم تفعيل مضاعف ${multi}x بنجاح!`);
  } catch (e) { console.error(e); }
}

// --- Three.js Engine & Advanced Visuals ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030712); // خلفية فضاء مظلمة وعميقة
scene.fog = new THREE.FogExp2(0x030712, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0x38bdf8, 1.5);
light.position.set(5, 12, 10);
scene.add(light);

// الشبكة الأرضية المضيئة
const grid = new THREE.GridHelper(100, 50, 0x38bdf8, 0x1e293b);
grid.position.y = -1;
scene.add(grid);

// 🌌 خلفية الغبار النجمي والنجوم (Starfield Dust)
const starGeo = new THREE.BufferGeometry();
const starCount = 1000;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i += 3) {
  starPositions[i] = (Math.random() - 0.5) * 100;
  starPositions[i + 1] = Math.random() * 40 - 5;
  starPositions[i + 2] = (Math.random() - 0.5) * 100;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.15, transparent: true, opacity: 0.8 });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

// المركبة
const shipGroup = new THREE.Group();
const bodyGeo = new THREE.ConeGeometry(0.6, 2, 4);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.6, roughness: 0.2 });
const shipBody = new THREE.Mesh(bodyGeo, bodyMat);
shipBody.rotation.x = Math.PI / 2;
shipGroup.add(shipBody);

const wingGeo = new THREE.BoxGeometry(2, 0.1, 0.8);
const wingMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.5 });
const wings = new THREE.Mesh(wingGeo, wingMat);
wings.position.z = 0.3;
shipGroup.add(wings);

shipGroup.position.set(0, 0, 4);
scene.add(shipGroup);

// المكعبات
const cubes = [];
function spawnCube(isBoss = false) {
  const size = isBoss ? 1.2 : 0.4;
  const color = isBoss ? 0xf59e0b : 0x0284c7;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  
  mesh.position.set((Math.random() - 0.5) * 16, 0, -30);
  mesh.userData = { isBoss: isBoss, speed: 0.15 + Math.random() * 0.1, floatOffset: Math.random() * Math.PI };
  scene.add(mesh);
  cubes.push(mesh);
}

setInterval(() => { if (!isPaused) spawnCube(false); }, 800);
setInterval(() => { if (!isPaused) spawnCube(true); }, 5000);

// 💥 نظام الجزيئات البصرية (Particle Explosion VFX)
const particles = [];
function createExplosion(position, colorHex) {
  const pCount = 15;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(pCount * 3);
  const velocities = [];

  for (let i = 0; i < pCount; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;

    velocities.push({
      x: (Math.random() - 0.5) * 0.3,
      y: (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * 0.3
    });
  }

  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({ color: colorHex, size: 0.2, transparent: true, opacity: 1 });
  const pSystem = new THREE.Points(pGeo, pMat);

  scene.add(pSystem);
  particles.push({ system: pSystem, velocities: velocities, life: 1.0 });
}

camera.position.set(0, 6, 10);
camera.lookAt(0, 0, 0);

// حركة الأسهم وميلان المركبة البصري (Tilt VFX)
let targetTilt = 0;
function moveShip(dx, dz) {
  if (isPaused) return;
  shipGroup.position.x = Math.max(-8, Math.min(8, shipGroup.position.x + dx));
  shipGroup.position.z = Math.max(-2, Math.min(6, shipGroup.position.z + dz));
  
  // إضافة ميلان بصري عند الحركة
  targetTilt = -dx * 0.6;
}

const bindBtn = (id, dx, dz) => {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = (e) => { e.preventDefault(); moveShip(dx, dz); };
  el.addEventListener('touchstart', handler, {passive: false});
  el.addEventListener('click', handler);
};

bindBtn('btn-up', 0, -0.5);
bindBtn('btn-down', 0, 0.5);
bindBtn('btn-left', -0.5, 0);
bindBtn('btn-right', 0.5, 0);

function showFloatingText(text) {
  const el = document.createElement('div');
  el.className = 'floating-text';
  el.innerText = text;
  el.style.left = (window.innerWidth / 2) + 'px';
  el.style.top = (window.innerHeight / 2) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation Loop
function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    grid.position.z += 0.1;
    if (grid.position.z > 2) grid.position.z = 0;

    // تدفق الغبار النجمي
    const positions = starField.geometry.attributes.position.array;
    for (let i = 2; i < starCount * 3; i += 3) {
      positions[i] += 0.2;
      if (positions[i] > 10) positions[i] = -90;
    }
    starField.geometry.attributes.position.needsUpdate = true;

    // تطبيق أثر الميلان البصري وتنعيمه
    shipGroup.rotation.z += (targetTilt - shipGroup.rotation.z) * 0.1;
    targetTilt *= 0.9;

    // تحديث الجزيئات والمؤثرات
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= 0.04;
      p.system.material.opacity = p.life;

      const pPos = p.system.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length; j++) {
        pPos[j * 3] += p.velocities[j].x;
        pPos[j * 3 + 1] += p.velocities[j].y;
        pPos[j * 3 + 2] += p.velocities[j].z;
      }
      p.system.geometry.attributes.position.needsUpdate = true;

      if (p.life <= 0) {
        scene.remove(p.system);
        particles.splice(i, 1);
      }
    }

    for (let i = cubes.length - 1; i >= 0; i--) {
      const c = cubes[i];
      c.position.z += c.userData.speed;
      c.rotation.x += 0.02;
      c.rotation.y += 0.02;

      if (c.userData.isBoss) {
        c.position.y = Math.sin(Date.now() * 0.005 + c.userData.floatOffset) * 0.3;
      }

      if (shipGroup.position.distanceTo(c.position) < 1.2) {
        const reward = c.userData.isBoss ? (1.0 * multiplier) : (0.01 * multiplier);
        score = Math.min(maxCap, score + reward);
        
        // إطلاق انفجار الجزيئات البصرية (VFX)
        createExplosion(c.position, c.userData.isBoss ? 0xf59e0b : 0x38bdf8);

        if (c.userData.isBoss) showFloatingText(`+${(1.0 * multiplier).toFixed(2)} MHA 🌟`);

        updateUI();
        saveToFirebase();

        scene.remove(c);
        cubes.splice(i, 1);
        continue;
      }

      if (c.position.z > 8) {
        scene.remove(c);
        cubes.splice(i, 1);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();
