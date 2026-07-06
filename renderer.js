const THEMES = [
  { name: 'green',   accent: '#00ff00', dim: '#0a1a0a', border: '#1a3a1a' },
  { name: 'cyan',    accent: '#00e5ff', dim: '#001a1f', border: '#003a45' },
  { name: 'blue',    accent: '#4da6ff', dim: '#001020', border: '#002040' },
  { name: 'purple',  accent: '#c084fc', dim: '#120a1f', border: '#2a1a40' },
  { name: 'red',     accent: '#ff4444', dim: '#1a0a0a', border: '#3a1a1a' },
  { name: 'amber',   accent: '#ffb300', dim: '#1a1200', border: '#3a2a00' },
  { name: 'white',   accent: '#e0e0e0', dim: '#141414', border: '#2a2a2a' },
];

function applyTheme(name) {
  const t = THEMES.find(t => t.name === name) || THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-dim', t.dim);
  root.style.setProperty('--accent-border', t.border);
  localStorage.setItem('theme', name);
}

applyTheme(localStorage.getItem('theme') || 'green');

const themeBtn = document.getElementById('theme-btn');
themeBtn.addEventListener('click', () => {
  modalTitle.textContent = 'color theme';
  modalBody.innerHTML = '';

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';

  THEMES.forEach(t => {
    const btn = document.createElement('button');
    btn.style.cssText = `padding:10px 4px;border:1px solid ${t.accent}33;background:#111;color:${t.accent};font-family:inherit;font-size:11px;cursor:pointer;border-radius:2px;`;
    btn.textContent = t.name;
    const current = localStorage.getItem('theme') || 'green';
    if (t.name === current) btn.style.borderColor = t.accent;
    btn.addEventListener('click', () => {
      applyTheme(t.name);
      modalOverlay.classList.remove('show');
    });
    grid.appendChild(btn);
  });

  modalBody.appendChild(grid);
  modalOverlay.classList.add('show');
});

const updateBar = document.getElementById('update-bar');
const updateMsg = document.getElementById('update-msg');
const updateBtn = document.getElementById('update-btn');

wa.onUpdateStatus((info) => {
  updateBar.classList.add('show');
  if (info.state === 'available') {
    updateMsg.textContent = `update v${info.version} available — downloading...`;
    updateBtn.style.display = 'none';
  } else if (info.state === 'downloading') {
    updateMsg.textContent = `downloading update... ${info.percent}%`;
    updateBtn.style.display = 'none';
  } else if (info.state === 'ready') {
    updateMsg.textContent = 'update ready to install';
    updateBtn.style.display = '';
  }
});

updateBtn.addEventListener('click', () => wa.installUpdate());

const qrScreen = document.getElementById('qr-screen');
const qrImg = document.getElementById('qr-img');
const chatEl = document.getElementById('chat');
const inputBar = document.getElementById('input-bar');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('title');
const input = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const winResizeBtn = document.getElementById('win-resize');
const winCloseBtn = document.getElementById('win-close');
const setupScreen = document.getElementById('setup-screen');
const setupInput = document.getElementById('setup-input');
const setupBtn = document.getElementById('setup-btn');
const setupMsg = document.getElementById('setup-msg');

function updateTitle(t) {
  const mask = titleEl.querySelector('.mask');
  const real = titleEl.querySelector('.real');
  mask.textContent = '•'.repeat(t.length);
  real.textContent = t;
}

wa.getTarget().then((t) => {
  if (!t) {
    setupScreen.style.display = 'flex';
    qrScreen.style.display = 'none';
    statusEl.textContent = 'setup required';
    return;
  }
  updateTitle(t);
});

async function submitSetup() {
  const value = setupInput.value.trim();
  if (!/^\+?[0-9 ()-]{6,}$/.test(value)) {
    setupMsg.textContent = 'enter a valid phone number with country code';
    return;
  }
  setupBtn.disabled = true;
  await wa.setTargetNumber(value);
  currentTarget = value;
  updateTitle(value);
  setupScreen.style.display = 'none';
  qrScreen.style.display = 'flex';
  statusEl.textContent = 'connecting...';
}

setupBtn.addEventListener('click', submitSetup);
setupInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitSetup();
});

winResizeBtn.addEventListener('click', () => wa.maximizeWindow());
winCloseBtn.addEventListener('click', () => wa.closeWindow());

titleEl.addEventListener('click', () => titleEl.classList.toggle('revealed'));

const IDLE_LOCK_MS = 8000;
let idleTimer = null;

function reMaskAll() {
  document.querySelectorAll('.line.revealed').forEach((el) => el.classList.remove('revealed'));
  titleEl.classList.remove('revealed');
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    reMaskAll();
    engageLock();
  }, IDLE_LOCK_MS);
}

['mousemove', 'keydown', 'mousedown', 'scroll'].forEach((evt) => {
  document.addEventListener(evt, resetIdleTimer);
});
resetIdleTimer();

const lockOverlay = document.getElementById('lock-overlay');
const lockAuth = document.getElementById('lock-auth');
const pinAuth = document.getElementById('pin-auth');
const pinDisplay = document.getElementById('pin-display');
const pinPad = document.getElementById('pin-pad');
const patternAuth = document.getElementById('pattern-auth');
const patternGrid = document.getElementById('pattern-grid');
const authError = document.getElementById('auth-error');
const lockSettingsBtn = document.getElementById('lock-settings-btn');

let lockStatus = { method: null, configured: false };
let enteredPin = '';
let enteredPattern = [];

wa.getLockStatus().then((status) => {
  lockStatus = status;
});

function engageLock() {
  document.body.classList.add('locked');
  if (lockStatus.configured) {
    document.body.classList.add('auth-pending');
    enteredPin = '';
    enteredPattern = [];
    authError.textContent = '';
    if (lockStatus.method === 'pin') {
      pinAuth.style.display = 'flex';
      patternAuth.style.display = 'none';
      buildPinPad();
      updatePinDisplay();
    } else {
      pinAuth.style.display = 'none';
      patternAuth.style.display = 'flex';
      buildPatternGrid();
    }
  }
}

function disengageLock() {
  document.body.classList.remove('locked', 'auth-pending');
  lockOverlay.classList.remove('has-activity');
}

wa.onLock((blurred) => {
  if (blurred) {
    engageLock();
  } else if (!lockStatus.configured) {
    disengageLock();
  }
});

lockOverlay.addEventListener('click', (e) => {
  if (!lockStatus.configured && e.target === lockOverlay) {
    disengageLock();
  }
});

function buildPinPad() {
  pinPad.innerHTML = '';
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'ok'];
  digits.forEach((d) => {
    const btn = document.createElement('button');
    btn.textContent = d === 'clr' ? '⌫' : d === 'ok' ? '✓' : d;
    btn.addEventListener('click', () => {
      if (d === 'clr') {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDisplay();
      } else if (d === 'ok') {
        tryUnlock(enteredPin);
      } else {
        enteredPin += d;
        updatePinDisplay();
      }
    });
    pinPad.appendChild(btn);
  });
}

function updatePinDisplay() {
  pinDisplay.textContent = '•'.repeat(enteredPin.length);
}

function buildPatternGrid() {
  patternGrid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement('div');
    dot.className = 'pattern-dot';
    dot.dataset.idx = i;
    dot.addEventListener('click', () => {
      if (enteredPattern.includes(i)) return;
      enteredPattern.push(i);
      dot.classList.add('active');
      if (enteredPattern.length >= 4) {
        setTimeout(() => tryUnlock(enteredPattern.join(',')), 150);
      }
    });
    patternGrid.appendChild(dot);
  }
}

async function tryUnlock(secret) {
  const ok = await wa.verifyLockSecret(secret);
  if (ok) {
    disengageLock();
  } else {
    authError.textContent = 'incorrect';
    enteredPin = '';
    enteredPattern = [];
    updatePinDisplay();
    document.querySelectorAll('.pattern-dot.active').forEach((d) => d.classList.remove('active'));
  }
}

// --- lock settings modal ---
const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

const editNumberBtn = document.getElementById('edit-number-btn');
const modalTitle = document.getElementById('modal-title');
let currentTarget = '';

wa.getTarget().then((t) => {
  currentTarget = t || '';
});

lockSettingsBtn.addEventListener('click', () => {
  modalTitle.textContent = 'lock settings';
  openLockSettingsModal();
});
editNumberBtn.addEventListener('click', () => {
  modalTitle.textContent = 'edit number';
  openEditNumberModal();
});
modalClose.addEventListener('click', () => modalOverlay.classList.remove('show'));

function openEditNumberModal() {
  modalBody.innerHTML = '';
  const msg = document.createElement('div');
  msg.id = 'modal-msg';
  msg.textContent = currentTarget ? `current: ${currentTarget}` : 'no number set';
  modalBody.appendChild(msg);

  const numInput = document.createElement('input');
  numInput.type = 'text';
  numInput.placeholder = '+1 555 0100';
  numInput.value = currentTarget;
  modalBody.appendChild(numInput);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'save';
  saveBtn.style.width = '100%';
  saveBtn.addEventListener('click', async () => {
    const value = numInput.value.trim();
    if (!/^\+?[0-9 ()-]{6,}$/.test(value)) {
      msg.textContent = 'enter a valid phone number with country code';
      return;
    }
    saveBtn.disabled = true;
    await wa.setTargetNumber(value);
    currentTarget = value;
    updateTitle(value);
    chatEl.innerHTML = '';
    setupScreen.style.display = 'none';
    qrScreen.style.display = 'none';
    chatEl.style.display = 'flex';
    inputBar.style.display = 'flex';
    modalOverlay.classList.remove('show');
  });
  modalBody.appendChild(saveBtn);

  modalOverlay.classList.add('show');
}

function openLockSettingsModal() {
  modalBody.innerHTML = '';
  const status = document.createElement('div');
  status.id = 'modal-msg';
  status.textContent = lockStatus.configured
    ? `current: ${lockStatus.method} lock enabled`
    : 'no lock configured';
  modalBody.appendChild(status);

  const row = document.createElement('div');
  row.className = 'row';
  const pinBtn = document.createElement('button');
  pinBtn.textContent = 'set PIN';
  pinBtn.addEventListener('click', () => showSetupForm('pin'));
  const patBtn = document.createElement('button');
  patBtn.textContent = 'set pattern';
  patBtn.addEventListener('click', () => showSetupForm('pattern'));
  row.appendChild(pinBtn);
  row.appendChild(patBtn);
  modalBody.appendChild(row);

  if (lockStatus.configured) {
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'remove lock';
    clearBtn.style.width = '100%';
    clearBtn.addEventListener('click', async () => {
      await wa.clearLockSecret();
      lockStatus = { method: null, configured: false };
      modalOverlay.classList.remove('show');
    });
    modalBody.appendChild(clearBtn);
  }

  modalOverlay.classList.add('show');
}

function showSetupForm(method) {
  modalBody.innerHTML = '';
  const msg = document.createElement('div');
  msg.id = 'modal-msg';
  modalBody.appendChild(msg);

  if (method === 'pin') {
    msg.textContent = 'enter a 4-6 digit PIN';
    const input1 = document.createElement('input');
    input1.type = 'password';
    input1.maxLength = 6;
    input1.placeholder = 'new PIN';
    const input2 = document.createElement('input');
    input2.type = 'password';
    input2.maxLength = 6;
    input2.placeholder = 'confirm PIN';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'save';
    saveBtn.style.width = '100%';
    saveBtn.addEventListener('click', async () => {
      if (input1.value.length < 4) {
        msg.textContent = 'PIN must be at least 4 digits';
        return;
      }
      if (input1.value !== input2.value) {
        msg.textContent = "PINs don't match";
        return;
      }
      await wa.setLockSecret('pin', input1.value);
      lockStatus = { method: 'pin', configured: true };
      modalOverlay.classList.remove('show');
    });
    modalBody.appendChild(input1);
    modalBody.appendChild(input2);
    modalBody.appendChild(saveBtn);
  } else {
    msg.textContent = 'draw a pattern (4+ dots), then confirm';
    let firstPattern = null;
    const grid = document.createElement('div');
    grid.className = 'pattern-grid';
    grid.style.margin = '8px auto';
    let current = [];
    function rebuild() {
      grid.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const dot = document.createElement('div');
        dot.className = 'pattern-dot';
        if (current.includes(i)) dot.classList.add('active');
        dot.addEventListener('click', () => {
          if (current.includes(i)) return;
          current.push(i);
          rebuild();
        });
        grid.appendChild(dot);
      }
    }
    rebuild();
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'confirm';
    confirmBtn.style.width = '100%';
    confirmBtn.addEventListener('click', async () => {
      if (current.length < 4) {
        msg.textContent = 'pattern must connect at least 4 dots';
        return;
      }
      if (!firstPattern) {
        firstPattern = current.join(',');
        current = [];
        rebuild();
        msg.textContent = 'draw it again to confirm';
        return;
      }
      const second = current.join(',');
      if (second !== firstPattern) {
        msg.textContent = "patterns don't match, try again";
        firstPattern = null;
        current = [];
        rebuild();
        return;
      }
      await wa.setLockSecret('pattern', firstPattern);
      lockStatus = { method: 'pattern', configured: true };
      modalOverlay.classList.remove('show');
    });
    modalBody.appendChild(grid);
    modalBody.appendChild(confirmBtn);
  }
}

wa.onQr((dataUrl) => {
  qrImg.src = dataUrl;
  statusEl.textContent = 'scan QR code';
});

wa.onStatus((status) => {
  statusEl.textContent = status;
  if (status === 'connected') {
    qrScreen.style.display = 'none';
    chatEl.style.display = 'flex';
    inputBar.style.display = 'flex';
  }
});

wa.onHistory((messages) => {
  chatEl.innerHTML = '';
  messages.forEach(addBubble);
  chatEl.scrollTop = chatEl.scrollHeight;
});

wa.onMessage((message) => {
  addBubble(message);
  chatEl.scrollTop = chatEl.scrollHeight;
  if (!message.fromMe) {
    playNotificationSound();
    if (document.body.classList.contains('locked')) {
      lockOverlay.classList.add('has-activity');
    }
  }
});

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch (_) {}
}

function addBubble(message) {
  const div = document.createElement('div');
  div.className = 'line ' + (message.fromMe ? 'me' : 'them');

  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = message.fromMe ? '>>' : '<<';
  div.appendChild(arrow);

  if (message.hasMedia && message.media && message.media.mimetype && message.media.mimetype.startsWith('image/')) {
    const wrap = document.createElement('span');
    wrap.className = 'img-wrap';

    const img = document.createElement('img');
    img.src = `data:${message.media.mimetype};base64,${message.media.data}`;
    wrap.appendChild(img);

    const imgMask = document.createElement('span');
    imgMask.className = 'img-mask';
    imgMask.textContent = '[hidden image]';
    wrap.appendChild(imgMask);

    div.appendChild(wrap);

    if (message.body) {
      const mask = document.createElement('span');
      mask.className = 'mask';
      mask.textContent = '•'.repeat(Math.max(message.body.length, 1));
      const real = document.createElement('span');
      real.className = 'real';
      real.textContent = message.body;
      div.appendChild(mask);
      div.appendChild(real);
    }
  } else {
    const mask = document.createElement('span');
    mask.className = 'mask';
    mask.textContent = '•'.repeat(Math.max((message.body || '').length, 1));

    const real = document.createElement('span');
    real.className = 'real';
    real.textContent = message.body || '';

    div.appendChild(mask);
    div.appendChild(real);
  }

  div.addEventListener('click', () => div.classList.toggle('revealed'));

  chatEl.appendChild(div);
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await wa.sendMessage(text);
  addBubble({ body: text, fromMe: true });
  chatEl.scrollTop = chatEl.scrollHeight;
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

const imgBtn = document.getElementById('img-btn');
imgBtn.addEventListener('click', async () => {
  const media = await wa.sendImage();
  if (media) {
    addBubble({ body: '', fromMe: true, hasMedia: true, media });
    chatEl.scrollTop = chatEl.scrollHeight;
  }
});

// --- scheduled send ---
const schedBtn = document.getElementById('sched-btn');
let scheduledJobs = []; // { id, label, timerId }

schedBtn.addEventListener('click', openScheduleModal);

function openScheduleModal() {
  modalTitle.textContent = 'schedule message';
  modalBody.innerHTML = '';

  const msg = document.createElement('div');
  msg.id = 'modal-msg';
  modalBody.appendChild(msg);

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'message to send...';
  textarea.rows = 3;
  textarea.style.cssText = 'width:100%;background:#0c0c0c;border:1px solid #333;color:#d4d4d4;font-family:inherit;font-size:13px;padding:8px;box-sizing:border-box;resize:vertical;margin-bottom:8px;';
  modalBody.appendChild(textarea);

  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;font-size:12px;color:#888;align-items:center;';

  const delayRadio = document.createElement('input');
  delayRadio.type = 'radio'; delayRadio.name = 'sched-mode'; delayRadio.value = 'delay'; delayRadio.id = 'r-delay'; delayRadio.checked = true;
  const delayLabel = document.createElement('label');
  delayLabel.htmlFor = 'r-delay'; delayLabel.textContent = 'in (mins)';

  const timeRadio = document.createElement('input');
  timeRadio.type = 'radio'; timeRadio.name = 'sched-mode'; timeRadio.value = 'time'; timeRadio.id = 'r-time';
  const timeLabel = document.createElement('label');
  timeLabel.htmlFor = 'r-time'; timeLabel.textContent = 'at time';

  modeRow.append(delayRadio, delayLabel, timeRadio, timeLabel);
  modalBody.appendChild(modeRow);

  const delayInput = document.createElement('input');
  delayInput.type = 'number'; delayInput.min = 1; delayInput.value = 5; delayInput.placeholder = 'minutes';
  delayInput.style.cssText = 'width:100%;padding:8px;background:#0c0c0c;border:1px solid #333;color:#d4d4d4;font-family:inherit;font-size:13px;box-sizing:border-box;margin-bottom:8px;';

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.style.cssText = 'width:100%;padding:8px;background:#0c0c0c;border:1px solid #333;color:#d4d4d4;font-family:inherit;font-size:13px;box-sizing:border-box;margin-bottom:8px;display:none;';

  modalBody.appendChild(delayInput);
  modalBody.appendChild(timeInput);

  [delayRadio, timeRadio].forEach(r => r.addEventListener('change', () => {
    delayInput.style.display = delayRadio.checked ? '' : 'none';
    timeInput.style.display = timeRadio.checked ? '' : 'none';
  }));

  const schedSubmit = document.createElement('button');
  schedSubmit.textContent = 'schedule';
  schedSubmit.style.width = '100%';
  schedSubmit.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) { msg.textContent = 'enter a message'; return; }

    let delayMs;
    if (delayRadio.checked) {
      const mins = parseFloat(delayInput.value);
      if (!mins || mins <= 0) { msg.textContent = 'enter a valid delay'; return; }
      delayMs = mins * 60 * 1000;
    } else {
      const [h, m] = timeInput.value.split(':').map(Number);
      if (isNaN(h)) { msg.textContent = 'pick a time'; return; }
      const now = new Date();
      const target = new Date(); target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      delayMs = target - now;
    }

    const fireAt = new Date(Date.now() + delayMs);
    const label = `"${text.slice(0, 24)}${text.length > 24 ? '…' : ''}" @ ${fireAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const timerId = setTimeout(async () => {
      await wa.sendMessage(text);
      addBubble({ body: text, fromMe: true });
      chatEl.scrollTop = chatEl.scrollHeight;
      scheduledJobs = scheduledJobs.filter(j => j.timerId !== timerId);
      renderScheduledList();
    }, delayMs);

    scheduledJobs.push({ id: Date.now(), label, timerId });
    renderScheduledList();
    msg.style.color = '#0f0';
    msg.textContent = `scheduled: ${label}`;
    textarea.value = '';
    schedSubmit.disabled = true;
    setTimeout(() => { schedSubmit.disabled = false; msg.textContent = ''; msg.style.color = ''; }, 1500);
  });
  modalBody.appendChild(schedSubmit);

  const listTitle = document.createElement('div');
  listTitle.style.cssText = 'margin-top:12px;font-size:11px;color:#555;margin-bottom:4px;';
  listTitle.textContent = 'pending';
  modalBody.appendChild(listTitle);

  const listEl = document.createElement('div');
  listEl.id = 'sched-list';
  listEl.style.cssText = 'font-size:11px;color:#888;display:flex;flex-direction:column;gap:4px;';
  modalBody.appendChild(listEl);

  renderScheduledList();
  modalOverlay.classList.add('show');
}

function renderScheduledList() {
  const listEl = document.getElementById('sched-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!scheduledJobs.length) {
    listEl.textContent = 'none';
    return;
  }
  scheduledJobs.forEach(job => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
    const lbl = document.createElement('span');
    lbl.textContent = job.label;
    const cancel = document.createElement('button');
    cancel.textContent = '✕';
    cancel.style.cssText = 'border:none;background:none;color:#c44;cursor:pointer;font-size:11px;padding:0;';
    cancel.addEventListener('click', () => {
      clearTimeout(job.timerId);
      scheduledJobs = scheduledJobs.filter(j => j.id !== job.id);
      renderScheduledList();
    });
    row.append(lbl, cancel);
    listEl.appendChild(row);
  });
}
