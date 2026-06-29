(function () {
  "use strict";

  const Calendar = window.NoteCalendar;
  const STORAGE_KEYS = {
    notes: "noteflow_notes",
    folders: "noteflow_folders",
    theme: "noteflow_theme",
    users: "noteflow_auth_users",
    session: "noteflow_auth_session"
  };

  const defaultFolders = [
    { id: "personal", name: "Personal", emoji: "Personal", color: "#A8C5A0", order: 1 },
    { id: "work", name: "Work", emoji: "Work", color: "#A0B8C5", order: 2 },
    { id: "ideas", name: "Ideas", emoji: "Ideas", color: "#F4C6A0", order: 3 }
  ];

  const state = {
    notes: [],
    folders: [],
    activeView: "dashboard",
    selectedFolderId: null,
    editingNoteId: null,
    selectedCalendarDate: Calendar.toISODate(new Date()),
    calendarCursor: new Date(),
    sort: "newest",
    searchQuery: "",
    selectedFolderEmoji: "Folder",
    selectedFolderColor: "#E8A87C",
    pendingConfirm: null,
    currentTheme: "light",
    user: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const els = {};

  function init() {
    cacheElements();
    loadState();
    applyTheme(state.currentTheme);
    bindEvents();
    updateHero();
    render();
    finishLoading();
    setSyncStatus("Saved on this device");
  }

  function cacheElements() {
    Object.assign(els, {
      html: document.documentElement,
      appShell: $(".app-shell"),
      authBackdrop: $("#authBackdrop"),
      authForm: $("#authForm"),
      authNameField: $("#authNameField"),
      authName: $("#authName"),
      authEmail: $("#authEmail"),
      authPassword: $("#authPassword"),
      authSubmit: $("#authSubmit"),
      authToggle: $("#authToggle"),
      authTitle: $("#authTitle"),
      authSubtitle: $("#authSubtitle"),
      authError: $("#authError"),
      logoutBtn: $("#logoutBtn"),
      userChip: $("#userChip"),
      sidebar: $("#sidebar"),
      sidebarOverlay: $("#sidebarOverlay"),
      hamburgerBtn: $("#hamburgerBtn"),
      sidebarCloseBtn: $("#sidebarCloseBtn"),
      topbarTitle: $("#topbarTitle"),
      themeToggle: $("#themeToggle"),
      searchInput: $("#searchInput"),
      searchClear: $("#searchClear"),
      folderList: $("#folderList"),
      noteFolder: $("#noteFolder"),
      toastContainer: $("#toastContainer"),
      noteModalBackdrop: $("#noteModalBackdrop"),
      noteModalClose: $("#noteModalClose"),
      noteModalCancel: $("#noteModalCancel"),
      noteModalSave: $("#noteModalSave"),
      modalMode: $("#modalMode"),
      noteTitle: $("#noteTitle"),
      noteContent: $("#noteContent"),
      noteDate: $("#noteDate"),
      folderModalBackdrop: $("#folderModalBackdrop"),
      folderModalClose: $("#folderModalClose"),
      folderModalCancel: $("#folderModalCancel"),
      folderModalSave: $("#folderModalSave"),
      folderName: $("#folderName"),
      folderEmojiRow: $("#folderEmojiRow"),
      folderColorRow: $("#folderColorRow"),
      confirmBackdrop: $("#confirmBackdrop"),
      confirmCancel: $("#confirmCancel"),
      confirmOk: $("#confirmOk"),
      confirmMsg: $("#confirmMsg"),
      confirmIllo: $("#confirmIllo"),
      calGrid: $("#calGrid"),
      calMonthLabel: $("#calMonthLabel"),
      calPrev: $("#calPrev"),
      calNext: $("#calNext"),
      calDayTitle: $("#calDayTitle"),
      calDayNotes: $("#calDayNotes"),
      syncStatus: $("#syncStatus")
    });
  }

  function loadState() {
    state.user = readSessionUser();
    state.notes = readJSON(STORAGE_KEYS.notes, []).map(normalizeNote);
    state.folders = readJSON(STORAGE_KEYS.folders, []);
    if (!state.folders.length) {
      state.folders = defaultFolders.map((folder) => ({ ...folder }));
      persistFolders();
    }
    state.currentTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  }

  function bindEvents() {
    els.authForm?.addEventListener("submit", handleAuthSubmit);
    els.authToggle?.addEventListener("click", toggleAuthMode);
    els.logoutBtn?.addEventListener("click", handleLogout);

    $$(".nav-item").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
    $$(".see-all-btn").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
    $$(".sort-btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.sort = button.dataset.sort;
        $$(".sort-btn").forEach((item) => item.classList.toggle("active", item === button));
        renderAllNotes();
      });
    });

    on("#newNoteBtn", "click", () => openNoteModal());
    on("#allEmptyNew", "click", () => openNoteModal());
    on("#todayEmptyNew", "click", () => openNoteModal({ date: Calendar.toISODate(new Date()) }));
    on("#addTodayNote", "click", () => openNoteModal({ date: Calendar.toISODate(new Date()) }));
    on("#folderEmptyNew", "click", () => openNoteModal({ folderId: state.selectedFolderId }));
    on("#calDayNew", "click", () => openNoteModal({ date: state.selectedCalendarDate }));
    on("#addFolderBtn", "click", openFolderModal);
    on("#deleteFolderBtn", "click", requestDeleteFolder);

    els.noteModalClose?.addEventListener("click", closeNoteModal);
    els.noteModalCancel?.addEventListener("click", closeNoteModal);
    els.noteModalSave?.addEventListener("click", saveNoteFromModal);
    els.noteModalBackdrop?.addEventListener("click", (event) => {
      if (event.target === els.noteModalBackdrop) closeNoteModal();
    });

    els.folderModalClose?.addEventListener("click", closeFolderModal);
    els.folderModalCancel?.addEventListener("click", closeFolderModal);
    els.folderModalSave?.addEventListener("click", saveFolderFromModal);
    els.folderModalBackdrop?.addEventListener("click", (event) => {
      if (event.target === els.folderModalBackdrop) closeFolderModal();
    });

    els.confirmCancel?.addEventListener("click", closeConfirm);
    els.confirmOk?.addEventListener("click", runConfirm);
    els.confirmBackdrop?.addEventListener("click", (event) => {
      if (event.target === els.confirmBackdrop) closeConfirm();
    });

    els.themeToggle?.addEventListener("change", () => {
      applyTheme(els.themeToggle.checked ? "dark" : "light");
      localStorage.setItem(STORAGE_KEYS.theme, state.currentTheme);
    });

    els.searchInput?.addEventListener("input", () => {
      state.searchQuery = els.searchInput.value.trim();
      if (els.searchClear) els.searchClear.style.display = state.searchQuery ? "block" : "none";
      showView(state.searchQuery ? "search" : "dashboard", { keepSearch: true });
    });

    els.searchClear?.addEventListener("click", () => {
      els.searchInput.value = "";
      state.searchQuery = "";
      els.searchClear.style.display = "none";
      showView("dashboard", { keepSearch: true });
    });

    els.hamburgerBtn?.addEventListener("click", openSidebar);
    els.sidebarCloseBtn?.addEventListener("click", closeSidebar);
    els.sidebarOverlay?.addEventListener("click", closeSidebar);

    els.calPrev?.addEventListener("click", () => {
      state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
      renderCalendar();
    });
    els.calNext?.addEventListener("click", () => {
      state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
      renderCalendar();
    });

    els.folderEmojiRow?.addEventListener("click", selectFolderEmoji);
    els.folderColorRow?.addEventListener("click", selectFolderColor);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNoteModal();
        closeFolderModal();
        closeConfirm();
        closeSidebar();
      }
    });

    applyAuthState();
  }

  function handleAuthSubmit(event) {
    event.preventDefault();
    clearAuthError();

    const mode = els.authForm?.dataset.mode || "login";
    const name = els.authName?.value.trim() || "";
    const email = (els.authEmail?.value || "").trim().toLowerCase();
    const password = els.authPassword?.value || "";

    if (!email || password.length < 6) {
      showAuthError("Use a valid email and a password with at least 6 characters.");
      return;
    }

    const users = readJSON(STORAGE_KEYS.users, []);
    const existing = users.find((user) => user.email === email);

    if (mode === "signup") {
      if (existing) {
        showAuthError("An account with this email already exists.");
        return;
      }
      const user = {
        id: `user-${Date.now()}`,
        name: name || email.split("@")[0],
        email,
        password
      };
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
      setSession(user);
      showToast("Account created. Welcome to your dashboard.");
      return;
    }

    if (!existing || existing.password !== password) {
      showAuthError("Email or password is incorrect.");
      return;
    }

    setSession(existing);
    showToast("Logged in.");
  }

  function toggleAuthMode() {
    if (!els.authForm) return;
    const isSignup = els.authForm.dataset.mode === "signup";
    const nextMode = isSignup ? "login" : "signup";
    els.authForm.dataset.mode = nextMode;
    els.authNameField?.classList.toggle("hidden", nextMode !== "signup");
    if (els.authTitle) els.authTitle.textContent = nextMode === "signup" ? "Create account" : "Welcome back";
    if (els.authSubtitle) els.authSubtitle.textContent = nextMode === "signup" ? "Sign up to open your dashboard." : "Log in to open your dashboard.";
    if (els.authSubmit) els.authSubmit.textContent = nextMode === "signup" ? "Sign Up" : "Log In";
    if (els.authToggle) els.authToggle.textContent = nextMode === "signup" ? "I already have an account" : "Create an account";
    if (els.authPassword) els.authPassword.autocomplete = nextMode === "signup" ? "new-password" : "current-password";
    clearAuthError();
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEYS.session);
    state.user = null;
    closeSidebar();
    closeNoteModal();
    closeFolderModal();
    closeConfirm();
    applyAuthState();
    showToast("Logged out.");
  }

  function setSession(user) {
    const sessionUser = { id: user.id, name: user.name, email: user.email };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(sessionUser));
    state.user = sessionUser;
    els.authForm?.reset();
    showView("dashboard");
    applyAuthState();
  }

  function readSessionUser() {
    const session = readJSON(STORAGE_KEYS.session, null);
    if (!session?.email) return null;
    const users = readJSON(STORAGE_KEYS.users, []);
    const user = users.find((item) => item.email === session.email);
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  }

  function applyAuthState() {
    const isLoggedIn = Boolean(state.user);
    els.authBackdrop?.classList.toggle("hidden", isLoggedIn);
    els.appShell?.classList.toggle("auth-locked", !isLoggedIn);
    els.logoutBtn?.classList.toggle("hidden", !isLoggedIn);
    els.userChip?.classList.toggle("hidden", !isLoggedIn);
    if (els.userChip && state.user) els.userChip.textContent = state.user.name || state.user.email;
    if (!isLoggedIn) {
      showView("dashboard", { skipAuthCheck: true });
      setTimeout(() => els.authEmail?.focus(), 50);
    }
  }

  function showAuthError(message) {
    if (!els.authError) return;
    els.authError.textContent = message;
    els.authError.classList.remove("hidden");
  }

  function clearAuthError() {
    if (!els.authError) return;
    els.authError.textContent = "";
    els.authError.classList.add("hidden");
  }

  function showView(viewName, options) {
    if (!state.user && !options?.skipAuthCheck) {
      applyAuthState();
      return;
    }

    if (!options?.keepSearch && viewName !== "search") {
      if (els.searchInput) els.searchInput.value = "";
      state.searchQuery = "";
      if (els.searchClear) els.searchClear.style.display = "none";
    }

    state.activeView = viewName;
    if (viewName !== "folder") state.selectedFolderId = null;

    $$(".view").forEach((view) => view.classList.remove("active"));
    $(`#view-${viewName}`)?.classList.add("active");
    $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
    $$(".folder-item").forEach((item) => item.classList.toggle("active", item.dataset.folderId === state.selectedFolderId));

    const titles = {
      dashboard: "Dashboard",
      all: "All Notes",
      today: "Today",
      upcoming: "Upcoming",
      calendar: "Calendar",
      search: "Search Results",
      goals: "Goals",
      habits: "Habits & Streaks",
      analytics: "Analytics",
      folder: getFolder(state.selectedFolderId)?.name || "Folder"
    };
    if (els.topbarTitle) els.topbarTitle.textContent = titles[viewName] || "NoteFlow";
    closeSidebar();
    render();
  }

  function render() {
    renderFolders();
    renderFolderSelect();
    renderStats();
    renderWeekStrip();
    renderDashboardLists();
    renderAllNotes();
    renderTodayView();
    renderUpcomingView();
    renderFolderView();
    renderCalendar();
    renderSearch();
    renderAnalytics();
  }

  function updateHero() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    setText("#heroGreeting", greeting);
    setText("#heroDate", now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  }

  function renderStats() {
    const today = Calendar.toISODate(new Date());
    const todayCount = state.notes.filter((note) => note.date === today).length;
    const futureCount = state.notes.filter((note) => note.date && note.date > today).length;
    setText("#statTotal", state.notes.length);
    setText("#statToday", todayCount);
    setText("#statFolders", state.folders.length);
    setBadge("#allNotesBadge", state.notes.length);
    setBadge("#todayBadge", todayCount);
    setBadge("#upcomingBadge", futureCount);
  }

  function renderFolders() {
    if (!els.folderList) return;
    els.folderList.innerHTML = "";
    state.folders.forEach((folder) => {
      const item = document.createElement("li");
      item.className = "folder-item";
      item.dataset.folderId = folder.id;
      item.innerHTML = `
        <span class="folder-dot" style="background:${escapeAttribute(folder.color)}"></span>
        <span class="folder-emoji">${escapeHTML(folder.emoji)}</span>
        <span class="folder-name">${escapeHTML(folder.name)}</span>
        <span class="folder-count">${notesByFolder(folder.id).length}</span>
      `;
      item.classList.toggle("active", folder.id === state.selectedFolderId);
      item.addEventListener("click", () => {
        state.selectedFolderId = folder.id;
        showView("folder");
      });
      els.folderList.appendChild(item);
    });
  }

  function renderFolderSelect() {
    if (!els.noteFolder) return;
    els.noteFolder.innerHTML = "";
    state.folders.forEach((folder) => {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = `${folder.emoji} ${folder.name}`;
      els.noteFolder.appendChild(option);
    });
  }

  function renderWeekStrip() {
    const container = $("#weekStrip");
    if (!container) return;
    const today = new Date();
    container.innerHTML = "";
    Calendar.getWeekDates(today).forEach((date) => {
      const iso = Calendar.toISODate(date);
      const day = document.createElement("button");
      day.className = "week-day";
      day.classList.toggle("today", Calendar.isSameDay(date, today));
      day.classList.toggle("has-notes", state.notes.some((note) => note.date === iso));
      day.innerHTML = `<span class="week-day-name">${Calendar.dayNames[date.getDay()]}</span><span class="week-day-num">${date.getDate()}</span>`;
      day.addEventListener("click", () => {
        state.selectedCalendarDate = iso;
        state.calendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
        showView("calendar");
      });
      container.appendChild(day);
    });
  }

  function renderDashboardLists() {
    const today = Calendar.toISODate(new Date());
    const todayNotes = sortedNotes(state.notes.filter((note) => note.date === today)).slice(0, 4);
    const upcomingNotes = sortedNotes(state.notes.filter((note) => note.date && note.date > today)).slice(0, 4);
    renderNotesGrid($("#todayNotes"), todayNotes);
    toggleEmpty("#todayEmpty", todayNotes.length === 0);
    renderNotesGrid($("#upcomingNotes"), upcomingNotes);
    toggleEmpty("#upcomingEmpty", upcomingNotes.length === 0);
    setText("#streakCount", getActiveDays().length);
    const suggestions = $("#aiSuggestions");
    if (suggestions) suggestions.innerHTML = `<p class="text-muted">${escapeHTML(getSuggestion())}</p>`;
  }

  function renderAllNotes() {
    const notes = sortedNotes([...state.notes]);
    renderNotesGrid($("#allNotesGrid"), notes);
    toggleEmpty("#allEmpty", notes.length === 0);
  }

  function renderTodayView() {
    const today = Calendar.toISODate(new Date());
    const notes = sortedNotes(state.notes.filter((note) => note.date === today));
    renderNotesGrid($("#todayGrid"), notes);
    toggleEmpty("#todayGridEmpty", notes.length === 0);
  }

  function renderUpcomingView() {
    const today = Calendar.toISODate(new Date());
    const notes = sortedNotes(state.notes.filter((note) => note.date && note.date > today));
    renderNotesGrid($("#upcomingGrid"), notes);
    toggleEmpty("#upcomingGridEmpty", notes.length === 0);
  }

  function renderFolderView() {
    const folder = getFolder(state.selectedFolderId);
    setText("#folderViewTitle", folder ? `${folder.emoji} ${folder.name}` : "Folder");
    const notes = folder ? sortedNotes(notesByFolder(folder.id)) : [];
    renderNotesGrid($("#folderNotesGrid"), notes);
    toggleEmpty("#folderEmpty", notes.length === 0);
  }

  function renderCalendar() {
    if (!els.calGrid || !els.calMonthLabel) return;
    const year = state.calendarCursor.getFullYear();
    const month = state.calendarCursor.getMonth();
    const today = new Date();
    els.calMonthLabel.textContent = `${Calendar.monthNames[month]} ${year}`;
    els.calGrid.innerHTML = "";
    Calendar.dayNames.forEach((name) => {
      const label = document.createElement("div");
      label.className = "cal-dow";
      label.textContent = name;
      els.calGrid.appendChild(label);
    });
    Calendar.getMonthMatrix(year, month).forEach((cell) => {
      const button = document.createElement("button");
      button.className = "cal-cell";
      button.textContent = cell.date.getDate();
      button.classList.toggle("other-month", !cell.inMonth);
      button.classList.toggle("today", Calendar.isSameDay(cell.date, today));
      button.classList.toggle("selected", cell.iso === state.selectedCalendarDate);
      button.classList.toggle("has-notes", state.notes.some((note) => note.date === cell.iso));
      button.addEventListener("click", () => {
        state.selectedCalendarDate = cell.iso;
        state.calendarCursor = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1);
        renderCalendar();
      });
      els.calGrid.appendChild(button);
    });
    const selectedNotes = sortedNotes(state.notes.filter((note) => note.date === state.selectedCalendarDate));
    if (els.calDayTitle) els.calDayTitle.textContent = Calendar.formatLongDate(state.selectedCalendarDate);
    renderNotesGrid(els.calDayNotes, selectedNotes);
    toggleEmpty("#calDayEmpty", selectedNotes.length === 0);
  }

  function renderSearch() {
    const queryText = state.searchQuery.toLowerCase();
    const notes = queryText
      ? sortedNotes(state.notes.filter((note) => {
          const folder = getFolder(note.folderId);
          return [note.title, note.content, folder?.name].filter(Boolean).some((value) => value.toLowerCase().includes(queryText));
        }))
      : [];
    renderNotesGrid($("#searchGrid"), notes);
    toggleEmpty("#searchEmpty", queryText.length > 0 && notes.length === 0);
  }

  function renderAnalytics() {
    setText("#statNotesCreated", state.notes.length);
    setText("#statProductivity", state.notes.length ? "100%" : "0%");
    const activityLog = $("#activityLog");
    if (activityLog) {
      activityLog.innerHTML = sortedNotes([...state.notes]).slice(0, 6).map((note) => (
        `<div class="activity-item">${escapeHTML(note.title)} saved ${escapeHTML(Calendar.formatDisplayDate(note.updatedAt.slice(0, 10)))}</div>`
      )).join("") || `<p class="text-muted">No activity yet.</p>`;
    }
  }

  function renderNotesGrid(container, notes) {
    if (!container) return;
    container.innerHTML = "";
    notes.forEach((note) => container.appendChild(createNoteCard(note)));
  }

  function createNoteCard(note) {
    const folder = getFolder(note.folderId) || state.folders[0];
    const card = document.createElement("article");
    card.className = "note-card";
    card.tabIndex = 0;
    card.innerHTML = `
      <span class="note-card-accent" style="background:${escapeAttribute(folder?.color || "#FDEBD0")}"></span>
      <div class="note-card-actions">
        <button class="note-action-btn edit" aria-label="Edit note" type="button">E</button>
        <button class="note-action-btn delete" aria-label="Delete note" type="button">X</button>
      </div>
      <h3 class="note-card-title">${escapeHTML(note.title || "Untitled note")}</h3>
      <p class="note-card-body">${escapeHTML(note.content || "No extra details yet.")}</p>
      <div class="note-card-meta">
        <span class="note-card-date">${escapeHTML(Calendar.formatDisplayDate(note.date, { month: "short", day: "numeric" }))}</span>
        <span class="note-card-folder">${escapeHTML(folder ? `${folder.emoji} ${folder.name}` : "No folder")}</span>
      </div>
    `;
    card.addEventListener("click", () => openNoteModal({ noteId: note.id }));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openNoteModal({ noteId: note.id });
    });
    card.querySelector(".edit").addEventListener("click", (event) => {
      event.stopPropagation();
      openNoteModal({ noteId: note.id });
    });
    card.querySelector(".delete").addEventListener("click", (event) => {
      event.stopPropagation();
      requestDeleteNote(note.id);
    });
    return card;
  }

  function openNoteModal(options = {}) {
    const note = options.noteId ? state.notes.find((item) => item.id === options.noteId) : null;
    state.editingNoteId = note?.id || null;
    if (els.modalMode) els.modalMode.textContent = note ? "Edit Note" : "New Note";
    if (els.noteTitle) els.noteTitle.value = note?.title || "";
    if (els.noteContent) els.noteContent.value = note?.content || "";
    if (els.noteDate) els.noteDate.value = note?.date || options.date || Calendar.toISODate(new Date());
    if (els.noteFolder) els.noteFolder.value = note?.folderId || options.folderId || state.selectedFolderId || state.folders[0]?.id || "";
    els.noteModalBackdrop?.classList.remove("hidden");
    setTimeout(() => els.noteTitle?.focus(), 50);
  }

  function closeNoteModal() {
    els.noteModalBackdrop?.classList.add("hidden");
    state.editingNoteId = null;
  }

  function saveNoteFromModal() {
    const title = els.noteTitle?.value.trim() || "";
    const content = els.noteContent?.value.trim() || "";
    const folderId = els.noteFolder?.value || state.folders[0]?.id || "";
    const date = els.noteDate?.value || "";
    if (!title && !content) {
      showToast("Add a title or note body first.");
      return;
    }
    if (state.editingNoteId) {
      const note = state.notes.find((item) => item.id === state.editingNoteId);
      if (note) Object.assign(note, { title: title || "Untitled note", content, folderId, date, updatedAt: new Date().toISOString() });
      showToast("Note updated.");
    } else {
      state.notes.unshift({
        id: `note-${Date.now()}`,
        title: title || "Untitled note",
        content,
        folderId,
        date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      showToast("Note created.");
    }
    persistNotes();
    closeNoteModal();
    render();
  }

  function openFolderModal() {
    state.selectedFolderEmoji = "Folder";
    state.selectedFolderColor = "#E8A87C";
    if (els.folderName) els.folderName.value = "";
    $$(".emoji-opt").forEach((button) => button.classList.toggle("active", button.dataset.emoji === state.selectedFolderEmoji));
    $$(".color-opt").forEach((button) => button.classList.toggle("active", button.dataset.color === state.selectedFolderColor));
    els.folderModalBackdrop?.classList.remove("hidden");
    setTimeout(() => els.folderName?.focus(), 50);
  }

  function closeFolderModal() {
    els.folderModalBackdrop?.classList.add("hidden");
  }

  function selectFolderEmoji(event) {
    const button = event.target.closest(".emoji-opt");
    if (!button) return;
    state.selectedFolderEmoji = button.dataset.emoji;
    $$(".emoji-opt").forEach((item) => item.classList.toggle("active", item === button));
  }

  function selectFolderColor(event) {
    const button = event.target.closest(".color-opt");
    if (!button) return;
    state.selectedFolderColor = button.dataset.color;
    $$(".color-opt").forEach((item) => item.classList.toggle("active", item === button));
  }

  function saveFolderFromModal() {
    const name = els.folderName?.value.trim() || "";
    if (!name) {
      showToast("Give the folder a name first.");
      return;
    }
    state.folders.push({
      id: `folder-${Date.now()}`,
      name,
      emoji: state.selectedFolderEmoji,
      color: state.selectedFolderColor,
      order: Date.now()
    });
    persistFolders();
    closeFolderModal();
    render();
    showToast("Folder created.");
  }

  function requestDeleteNote(noteId) {
    const note = state.notes.find((item) => item.id === noteId);
    openConfirm({
      message: `Delete "${note?.title || "this note"}"?`,
      illo: "Delete",
      action: () => {
        state.notes = state.notes.filter((item) => item.id !== noteId);
        persistNotes();
        render();
        showToast("Note deleted.");
      }
    });
  }

  function requestDeleteFolder() {
    const folder = getFolder(state.selectedFolderId);
    if (!folder) return;
    openConfirm({
      message: `Delete "${folder.name}" and its notes?`,
      illo: "Folder",
      action: () => {
        state.notes = state.notes.filter((note) => note.folderId !== folder.id);
        state.folders = state.folders.filter((item) => item.id !== folder.id);
        state.selectedFolderId = null;
        persistNotes();
        persistFolders();
        showView("all");
        showToast("Folder deleted.");
      }
    });
  }

  function openConfirm({ message, illo, action }) {
    if (els.confirmMsg) els.confirmMsg.textContent = message;
    if (els.confirmIllo) els.confirmIllo.textContent = illo;
    state.pendingConfirm = action;
    els.confirmBackdrop?.classList.remove("hidden");
  }

  function closeConfirm() {
    els.confirmBackdrop?.classList.add("hidden");
    state.pendingConfirm = null;
  }

  function runConfirm() {
    if (typeof state.pendingConfirm === "function") state.pendingConfirm();
    closeConfirm();
  }

  function sortedNotes(notes) {
    return notes.sort((a, b) => {
      if (state.sort === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (state.sort === "az") return a.title.localeCompare(b.title);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function notesByFolder(folderId) {
    return state.notes.filter((note) => note.folderId === folderId);
  }

  function getFolder(folderId) {
    return state.folders.find((folder) => folder.id === folderId);
  }

  function getActiveDays() {
    return [...new Set(state.notes.map((note) => note.date).filter(Boolean))];
  }

  function getSuggestion() {
    const today = Calendar.toISODate(new Date());
    const dueToday = state.notes.filter((note) => note.date === today).length;
    if (dueToday) return `You have ${dueToday} note${dueToday === 1 ? "" : "s"} scheduled today.`;
    if (state.notes.some((note) => !note.date)) return "Add dates to undated notes so they show up in Today and Calendar.";
    return state.notes.length ? "Your schedule is clear today. Capture one idea while it is fresh." : "Create your first note to get suggestions.";
  }

  function persistNotes() {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(state.notes));
  }

  function persistFolders() {
    localStorage.setItem(STORAGE_KEYS.folders, JSON.stringify(state.folders));
  }

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function normalizeNote(note) {
    return {
      id: note.id || `note-${Date.now()}`,
      title: note.title || "Untitled note",
      content: note.content || "",
      folderId: note.folderId || "personal",
      date: note.date || "",
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: note.updatedAt || note.createdAt || new Date().toISOString()
    };
  }

  function on(selector, eventName, handler) {
    $(selector)?.addEventListener(eventName, handler);
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setBadge(selector, count) {
    const badge = $(selector);
    if (!badge) return;
    badge.textContent = count;
    badge.dataset.count = String(count);
  }

  function toggleEmpty(selector, shouldShow) {
    $(selector)?.classList.toggle("hidden", !shouldShow);
  }

  function openSidebar() {
    els.sidebar?.classList.add("open");
    els.sidebarOverlay?.classList.add("active");
  }

  function closeSidebar() {
    els.sidebar?.classList.remove("open");
    els.sidebarOverlay?.classList.remove("active");
  }

  function showToast(message) {
    if (!els.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("out"), 2400);
    setTimeout(() => toast.remove(), 2700);
  }

  function applyTheme(theme) {
    state.currentTheme = theme;
    els.html.dataset.theme = theme;
    if (els.themeToggle) els.themeToggle.checked = theme === "dark";
  }

  function setSyncStatus(message) {
    if (els.syncStatus) els.syncStatus.textContent = message;
  }

  function finishLoading() {
    const loadingScreen = $("#loadingScreen");
    if (!loadingScreen) return;
    loadingScreen.classList.add("loaded");
    window.setTimeout(() => loadingScreen.remove(), 250);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
