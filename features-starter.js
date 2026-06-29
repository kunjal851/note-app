// ═══════════════════════════════════════════════════════════════
// NoteFlow — Feature Implementation Starter Template
// ═══════════════════════════════════════════════════════════════

// ───── FEATURE: GOALS MANAGEMENT ─────

class GoalManager {
  constructor() {
    this.goals = [];
    this.init();
  }

  init() {
    // Load goals from storage
    this.loadGoals();
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    document.getElementById('newGoalBtn')?.addEventListener('click', () => this.openModal());
    document.getElementById('goalsEmptyNew')?.addEventListener('click', () => this.openModal());
    document.getElementById('goalModalSave')?.addEventListener('click', () => this.saveGoal());
    document.getElementById('goalModalCancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('goalModalClose')?.addEventListener('click', () => this.closeModal());
  }

  loadGoals() {
    const stored = localStorage.getItem('noteflow_goals');
    this.goals = stored ? JSON.parse(stored) : [];
    this.updateBadge();
  }

  saveGoal() {
    const title = document.getElementById('goalTitle').value;
    const description = document.getElementById('goalDescription').value;
    const category = document.getElementById('goalCategory').value;
    const deadline = document.getElementById('goalDeadline').value;
    const priority = document.getElementById('goalPriority').value;

    if (!title.trim()) {
      alert('Goal title is required');
      return;
    }

    const goal = {
      id: `goal-${Date.now()}`,
      title,
      description,
      category,
      deadline,
      priority,
      progress: 0,
      status: 'in-progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.goals.push(goal);
    this.persist();
    this.render();
    this.closeModal();
    this.showToast('✨ Goal created successfully!');
  }

  deleteGoal(id) {
    this.goals = this.goals.filter(g => g.id !== id);
    this.persist();
    this.render();
  }

  updateGoalProgress(id, progress) {
    const goal = this.goals.find(g => g.id === id);
    if (goal) {
      goal.progress = Math.min(100, Math.max(0, progress));
      if (goal.progress === 100) {
        goal.status = 'completed';
      }
      this.persist();
      this.render();
    }
  }

  persist() {
    localStorage.setItem('noteflow_goals', JSON.stringify(this.goals));
    this.updateBadge();
  }

  updateBadge() {
    const badge = document.getElementById('goalsBadge');
    const activeGoals = this.goals.filter(g => g.status === 'in-progress').length;
    if (badge) badge.textContent = activeGoals;
  }

  render() {
    const container = document.getElementById('goalsContainer');
    const empty = document.getElementById('goalsEmpty');

    if (!container) return;

    if (this.goals.length === 0) {
      container.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }

    container.classList.remove('hidden');
    empty?.classList.add('hidden');

    container.innerHTML = this.goals.map(goal => `
      <div class="goal-card" data-id="${goal.id}">
        <div class="goal-header">
          <h3>${goal.title}</h3>
          <span class="goal-priority ${goal.priority}">${goal.priority}</span>
        </div>
        <p class="goal-description">${goal.description}</p>
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${goal.progress}%"></div>
          </div>
          <span class="progress-text">${goal.progress}%</span>
        </div>
        <div class="goal-meta">
          <span class="goal-category">📁 ${goal.category}</span>
          <span class="goal-deadline">📅 ${goal.deadline || 'No deadline'}</span>
        </div>
        <div class="goal-actions">
          <button class="btn-small" onclick="goalManager.updateGoalProgress('${goal.id}', ${goal.progress + 10})">+10%</button>
          <button class="btn-danger-small" onclick="goalManager.deleteGoal('${goal.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  openModal() {
    document.getElementById('goalModalBackdrop')?.classList.remove('hidden');
    document.getElementById('goalTitle').value = '';
    document.getElementById('goalDescription').value = '';
  }

  closeModal() {
    document.getElementById('goalModalBackdrop')?.classList.add('hidden');
  }

  showToast(message) {
    // Use existing toast system from app.js
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('toastContainer')?.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// ───── FEATURE: HABIT TRACKING ─────

class HabitTracker {
  constructor() {
    this.habits = [];
    this.init();
  }

  init() {
    this.loadHabits();
    this.setupEventListeners();
    this.render();
    this.updateStreaks();
  }

  setupEventListeners() {
    document.getElementById('newHabitBtn')?.addEventListener('click', () => this.openModal());
    document.getElementById('habitsEmptyNew')?.addEventListener('click', () => this.openModal());
    document.getElementById('habitModalSave')?.addEventListener('click', () => this.saveHabit());
    document.getElementById('habitModalCancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('habitModalClose')?.addEventListener('click', () => this.closeModal());
  }

  loadHabits() {
    const stored = localStorage.getItem('noteflow_habits');
    this.habits = stored ? JSON.parse(stored) : [];
    this.updateBadge();
  }

  saveHabit() {
    const name = document.getElementById('habitName').value;
    const emoji = document.getElementById('habitEmoji').value || '⭐';
    const frequency = document.getElementById('habitFrequency').value;
    const startDate = document.getElementById('habitStartDate').value;
    const reminderEnabled = document.getElementById('habitReminder').checked;

    if (!name.trim()) {
      alert('Habit name is required');
      return;
    }

    const habit = {
      id: `habit-${Date.now()}`,
      name,
      emoji,
      frequency,
      startDate,
      streak: 0,
      longestStreak: 0,
      lastCheckedDate: null,
      reminderEnabled,
      reminderTime: '07:00',
      checkIns: [],
      createdAt: new Date().toISOString()
    };

    this.habits.push(habit);
    this.persist();
    this.render();
    this.closeModal();
    this.showToast(`✨ Habit "${name}" created!`);
  }

  checkIn(habitId) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    const today = new Date().toISOString().split('T')[0];
    const lastDate = habit.lastCheckedDate?.split('T')[0];

    if (lastDate === today) {
      // Already checked in today
      return;
    }

    // Check if yesterday was checked in (for streak)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastDate === yesterday) {
      habit.streak++;
      habit.longestStreak = Math.max(habit.streak, habit.longestStreak);
    } else if (lastDate !== today) {
      // Streak broken
      habit.streak = 1;
    }

    habit.checkIns.push({
      date: today,
      completed: true
    });
    habit.lastCheckedDate = new Date().toISOString();

    this.persist();
    this.render();
    this.showToast(`🔥 ${habit.emoji} ${habit.name} - Streak: ${habit.streak}`);
  }

  deleteHabit(id) {
    this.habits = this.habits.filter(h => h.id !== id);
    this.persist();
    this.render();
  }

  updateStreaks() {
    this.habits.forEach(habit => {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = habit.lastCheckedDate?.split('T')[0];

      if (lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (lastDate !== yesterday) {
          habit.streak = 0;
        }
      }
    });
  }

  persist() {
    localStorage.setItem('noteflow_habits', JSON.stringify(this.habits));
    this.updateBadge();
    this.updateStreakCard();
  }

  updateBadge() {
    const badge = document.getElementById('habitsBadge');
    if (badge) badge.textContent = this.habits.length;
  }

  updateStreakCard() {
    const streakCard = document.getElementById('streakCard');
    if (!streakCard) return;

    const longestStreak = Math.max(...this.habits.map(h => h.longestStreak || 0), 0);
    const streakCount = document.getElementById('streakCount');
    if (streakCount) streakCount.textContent = longestStreak;
  }

  render() {
    const container = document.getElementById('habitsContainer');
    const empty = document.getElementById('habitsEmpty');

    if (!container) return;

    if (this.habits.length === 0) {
      container.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }

    container.classList.remove('hidden');
    empty?.classList.add('hidden');

    container.innerHTML = this.habits.map(habit => {
      const today = new Date().toISOString().split('T')[0];
      const checkedInToday = habit.lastCheckedDate?.split('T')[0] === today;

      return `
        <div class="habit-card" data-id="${habit.id}">
          <div class="habit-header">
            <span class="habit-emoji">${habit.emoji}</span>
            <div class="habit-info">
              <h3>${habit.name}</h3>
              <p class="habit-frequency">${habit.frequency}</p>
            </div>
          </div>
          <div class="habit-stats">
            <div class="stat">
              <span class="stat-label">Streak</span>
              <span class="stat-value">🔥 ${habit.streak}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Best</span>
              <span class="stat-value">⭐ ${habit.longestStreak}</span>
            </div>
          </div>
          <button class="btn-checkin ${checkedInToday ? 'completed' : ''}" 
                  onclick="habitTracker.checkIn('${habit.id}')"
                  ${checkedInToday ? 'disabled' : ''}>
            ${checkedInToday ? '✓ Done today' : 'Check in'}
          </button>
          <button class="btn-danger-small" onclick="habitTracker.deleteHabit('${habit.id}')">Delete</button>
        </div>
      `;
    }).join('');
  }

  openModal() {
    document.getElementById('habitModalBackdrop')?.classList.remove('hidden');
    document.getElementById('habitName').value = '';
    document.getElementById('habitEmoji').value = '⭐';
    document.getElementById('habitStartDate').value = new Date().toISOString().split('T')[0];
  }

  closeModal() {
    document.getElementById('habitModalBackdrop')?.classList.add('hidden');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('toastContainer')?.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// ───── FEATURE: SETTINGS & NOTIFICATIONS ─────

class SettingsManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSettings();
  }

  setupEventListeners() {
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.openModal());
    document.getElementById('settingsModalClose')?.addEventListener('click', () => this.closeModal());
    document.getElementById('settingsModalClose2')?.addEventListener('click', () => this.closeModal());
    document.getElementById('notificationsEnabled')?.addEventListener('change', (e) => this.handleNotificationToggle(e));
    document.getElementById('emailReminders')?.addEventListener('change', (e) => this.handleEmailToggle(e));
    document.getElementById('syncNowBtn')?.addEventListener('click', () => this.syncNow());
    document.getElementById('installAppBtn')?.addEventListener('click', () => this.installApp());
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
    document.getElementById('backupBtn')?.addEventListener('click', () => this.createBackup());
    document.getElementById('restoreBtn')?.addEventListener('click', () => this.restoreBackup());
    document.getElementById('clearCacheBtn')?.addEventListener('click', () => this.clearCache());
    document.getElementById('deleteAllBtn')?.addEventListener('click', () => this.deleteAllData());
    document.getElementById('settingsModalBackdrop')?.addEventListener('click', (event) => {
      if (event.target.id === 'settingsModalBackdrop') this.closeModal();
    });
  }

  loadSettings() {
    const settings = JSON.parse(localStorage.getItem('noteflow_settings') || '{}');
    document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled !== false;
    document.getElementById('emailReminders').checked = settings.emailReminders || false;
    document.getElementById('reminderEmail').value = settings.reminderEmail || '';
    document.getElementById('reminderTime').value = settings.reminderTime || '09:00';
    document.getElementById('autoSync').checked = settings.autoSync !== false;
  }

  saveSettings() {
    const settings = {
      notificationsEnabled: document.getElementById('notificationsEnabled').checked,
      emailReminders: document.getElementById('emailReminders').checked,
      reminderEmail: document.getElementById('reminderEmail').value,
      reminderTime: document.getElementById('reminderTime').value,
      autoSync: document.getElementById('autoSync').checked
    };
    localStorage.setItem('noteflow_settings', JSON.stringify(settings));
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  handleNotificationToggle(e) {
    if (e.target.checked) {
      this.requestNotificationPermission();
    }
    this.saveSettings();
  }

  handleEmailToggle(e) {
    const emailInput = document.getElementById('reminderEmail');
    emailInput.disabled = !e.target.checked;
    this.saveSettings();
  }

  syncNow() {
    const statusEl = document.getElementById('syncStatus');
    if (statusEl) {
      statusEl.textContent = 'Syncing...';
    }

    // TODO: Implement Firebase sync
    setTimeout(() => {
      this.saveSettings();
      if (statusEl) {
        statusEl.textContent = 'Last synced: just now';
      }
    }, 1000);
  }

  installApp() {
    // TODO: Implement PWA install prompt
    alert('Install app functionality - implement deferredPrompt handling');
  }

  exportData() {
    const data = {
      notes: JSON.parse(localStorage.getItem('noteflow_notes') || '[]'),
      goals: JSON.parse(localStorage.getItem('noteflow_goals') || '[]'),
      habits: JSON.parse(localStorage.getItem('noteflow_habits') || '[]'),
      exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noteflow-export-${Date.now()}.json`;
    a.click();
  }

  createBackup() {
    this.exportData();
    this.showToast('📦 Backup created successfully!');
  }

  restoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          localStorage.setItem('noteflow_notes', JSON.stringify(data.notes || []));
          localStorage.setItem('noteflow_goals', JSON.stringify(data.goals || []));
          localStorage.setItem('noteflow_habits', JSON.stringify(data.habits || []));
          location.reload();
        } catch (err) {
          alert('Invalid backup file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  clearCache() {
    localStorage.removeItem('noteflow_settings');
    this.loadSettings();
    this.showToast('Cache cleared.');
  }

  deleteAllData() {
    if (!confirm('Delete all notes, goals, and habits on this device?')) return;
    localStorage.removeItem('noteflow_notes');
    localStorage.removeItem('noteflow_goals');
    localStorage.removeItem('noteflow_habits');
    localStorage.removeItem('noteflow_folders');
    location.reload();
  }

  openModal() {
    document.getElementById('settingsModalBackdrop')?.classList.remove('hidden');
    this.loadSettings();
  }

  closeModal() {
    document.getElementById('settingsModalBackdrop')?.classList.add('hidden');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('toastContainer')?.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

// Create global instances
window.goalManager = null;
window.habitTracker = null;
window.settingsManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.goalManager = new GoalManager();
  window.habitTracker = new HabitTracker();
  window.settingsManager = new SettingsManager();
});

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('✓ Service Worker registered'))
    .catch(err => console.log('✗ Service Worker failed:', err));
}
