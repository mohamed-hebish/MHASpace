/* ==========================================
   MHASpace Metaverse - Main Logic & TON Connect Integration
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
const maxCap = 7500000;
const RECEIVER_WALLET = "UQAqK_qhqpc_lMlh2SVmaqjbR4XfmkIhPdPVoUukb1aYHTG9";
const MANIFEST_URL = 'https://mhaspace.hebishalex-fb0.workers.dev/tonconnect-manifest.json';

// --- TON Connect UI Setup ---
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: MANIFEST_URL,
    buttonRootId: 'ton-connect-btn'
});

const welcomeTonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: MANIFEST_URL,
    buttonRootId: 'welcome-ton-btn'
});

// معالجة الاتصال بنجاح وتوجيه المستخدم
function handleWalletConnect(wallet) {
  if (wallet) {
    userWalletAddress = wallet.account.address;
    userWalletApp = wallet.device.appName || 'tonkeeper';

    document.getElementById('welcome-modal').style.display = 'none';
    document.getElementById('db-status').innerText = `متصل عبر ${userWalletApp} 🔗`;

    loadUserDataFromFirebase(userWalletAddress);
  } else {
    userWalletAddress = null;
    document.getElementById('welcome-modal').style.display = 'flex';
    document.getElementById('db-status').innerText = "غير متصل بالمحفظة";
  }
}

tonConnectUI.onStatusChange(handleWalletConnect);
welcomeTonConnectUI.onStatusChange(handleWalletConnect);

// --- Firebase Read/Write ---
function saveToFirebase() {
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const userId = telegramUser ? telegramUser.id : (userWalletAddress || "GUEST_USER");

  if (!userId) return;

  db.ref('players/' + userId).update({
    tonWallet: userWalletAddress || "",
    walletProvider: userWalletApp || "unknown",
    tonVerified: !!userWalletAddress,
    score: score,
    multiplier: multiplier,
    lastActive: Date.now()
  });
}

function loadUserDataFromFirebase(address) {
  const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const userId = telegramUser ? telegramUser.id : address;

  db.ref('players/' + userId).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      score = data.score || 0.00;
      multiplier = data.multiplier || 1;
      updateUI();
    }
  });
}

function updateUI() {
  document.getElementById('score-val').innerText = score.toFixed(2);
  document.getElementById('rank-badge').innerText = `المضاعف (${multiplier}x)`;
  
  const percentage = Math.min(100, (score / maxCap) * 100).toFixed(4);
  document.getElementById('progress-text').innerText = percentage;
  document.getElementById('progress-fill').style.width = Math.max(1, percentage) + '%';
}

// --- Pause System ---
function togglePause() {
  isPaused = !isPaused;
  document.getElementById('pause-modal').style.display = isPaused ? 'flex' : 'none';
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

// --- Three.js Engine ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8fafc);
scene.fog = new THREE.FogExp2(0xf8fafc, 0.025);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0x38bdf8, 1.2);
light.position.set(5, 12, 10);
scene.add(light);

// الشبكة الأرضية المضيئة
const grid = new THREE.GridHelper(100, 50, 0x38bdf8, 0xcbd5e1);
grid.position.y = -1;
scene.add(grid);

// المركبة
const shipGroup = new THREE.Group();
const bodyGeo = new THREE.ConeGeometry(0.6, 2, 4);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.1 });
const shipBody = new THREE.Mesh(bodyGeo, bodyMat);
shipBody.rotation.x = Math.PI / 2;
shipGroup.add(shipBody);

const wingGeo = new THREE.BoxGeometry(2, 0.1, 0.8);
const wingMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
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
  const mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  
  mesh.position.set((Math.random() - 0.5) * 16, 0, -30);
  mesh.userData = { isBoss: isBoss, speed: 0.15 + Math.random() * 0.1, floatOffset: Math.random() * Math.PI };
  scene.add(mesh);
  cubes.push(mesh);
}

setInterval(() => { if (!isPaused) spawnCube(false); }, 800);
setInterval(() => { if (!isPaused) spawnCube(true); }, 5000);

camera.position.set(0, 6, 10);
camera.lookAt(0, 0, 0);

// حركة الأسهم
function moveShip(dx, dz) {
  if (isPaused) return;
  shipGroup.position.x = Math.max(-8, Math.min(8, shipGroup.position.x + dx));
  shipGroup.position.z = Math.max(-2, Math.min(6, shipGroup.position.z + dz));
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
