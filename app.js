import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, USE_LOCAL_AUTH } from "./firebase-config.js";

(function () {
  "use strict";

  const Calendar = window.NoteCalendar;
  const THEME_LIGHT = "light";
  const THEME_DARK = "dark";

  const defaultFolders = [
    { id: "personal", name: "Personal", emoji: "🌿", color: "#A8C5A0", order: 1 },
    { id: "work", name: "Work", emoji: "💼", color: "#A0B8C5", order: 2 },
    { id: "ideas", name: "Ideas", emoji: "💡", color: "#F4C6A0", order: 3 }
  ];

  let app = null;
  let auth = null;
  let db = null;

  const useLocalAuth = Boolean(USE_LOCAL_AUTH);

  if (!useLocalAuth) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    // Local auth shim using localStorage for quick testing without Firebase.
    db = null;
    const LOCAL_KEY = "noteflow_local_user";
    const listeners = new Set();

    auth = {
      currentUser: JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"),
      _emit(user) {
        this.currentUser = user;
        listeners.forEach((cb) => cb(user));
      }
    };

    window.__LocalAuth = {
      onAuthStateChanged: (cb) => {
        listeners.add(cb);
        // call immediately with current state
        cb(auth.currentUser);
        return () => listeners.delete(cb);
      },
      createUserWithEmailAndPassword: async (_auth, email, password) => {
        // naive creation: store in localStorage
        const user = { uid: `local_${Date.now()}`, email, displayName: null };
        localStorage.setItem(LOCAL_KEY, JSON.stringify(user));
        auth._emit(user);
        return { user };
      },
      signInWithEmailAndPassword: async (_auth, email, password) => {
        const user = { uid: `local_${Date.now()}`, email, displayName: null };
        localStorage.setItem(LOCAL_KEY, JSON.stringify(user));
        auth._emit(user);
        return { user };
      },
      signOut: async () => {
        localStorage.removeItem(LOCAL_KEY);
        auth._emit(null);
      },
      updateProfile: async (_user, { displayName }) => {
        const u = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        if (u) {
          u.displayName = displayName;
          localStorage.setItem(LOCAL_KEY, JSON.stringify(u));
          auth._emit(u);
        }
      }
    };
  }

  const state = {
    user: null,
    notes: [],
    folders: [],
    activeView: "dashboard",
    selectedFolderId: null,
    editingNoteId: null,
    selectedCalendarDate: Calendar.toISODate(new Date()),
    calendarCursor: new Date(),
    sort: "newest",
    searchQuery: "",
    selectedFolderEmoji: "📁",
    selectedFolderColor: "#E8A87C",
    pendingConfirm: null,
    unsubscribers: [],
    isSyncing: false,
    currentTheme: THEME_LIGHT
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    html: document.documentElement,
    appShell: $(".app-shell"),
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
    calDayEmpty: $("#calDayEmpty"),
    authBackdrop: $("#authBackdrop"),
    authForm: $("#authForm"),
    authNameField: $("#authNameField"),
    authName: $("#authName"),
    authEmail: $("#authEmail"),
    authPassword: $("#authPassword"),
    authSubmit: $("#authSubmit"),
    authToggle: $("#authToggle"),
    authModeLabel: $("#authModeLabel"),
    authError: $("#authError"),
    logoutBtn: $("#logoutBtn"),
    userChip: $("#userChip"),
    syncStatus: $("#syncStatus")
  };

  function init() {
    applyTheme(THEME_LIGHT);
    bindEvents();
    updateHero();
    render();
    finishLoading();
    watchAuth();
  }

  function bindEvents() {
    $$(".nav-item").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    $$(".see-all-btn").forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });

    $$(".sort-btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.sort = button.dataset.sort;
        $$(".sort-btn").forEach((item) => item.classList.toggle("active", item === button));
        renderAllNotes();
      });
    });

    $("#newNoteBtn").addEventListener("click", () => openNoteModal());
    $("#allEmptyNew").addEventListener("click", () => openNoteModal());
    $("#todayEmptyNew").addEventListener("click", () => openNoteModal({ date: Calendar.toISODate(new Date()) }));
    $("#addTodayNote").addEventListener("click", () => openNoteModal({ date: Calendar.toISODate(new Date()) }));
    $("#folderEmptyNew").addEventListener("click", () => openNoteModal({ folderId: state.selectedFolderId }));
    $("#calDayNew").addEventListener("click", () => openNoteModal({ date: state.selectedCalendarDate }));
    $("#addFolderBtn").addEventListener("click", openFolderModal);
    $("#deleteFolderBtn").addEventListener("click", requestDeleteFolder);

    els.noteModalClose.addEventListener("click", closeNoteModal);
    els.noteModalCancel.addEventListener("click", closeNoteModal);
    els.noteModalSave.addEventListener("click", saveNoteFromModal);
    els.noteModalBackdrop.addEventListener("click", (event) => {
      if (event.target === els.noteModalBackdrop) closeNoteModal();
    });

    els.folderModalClose.addEventListener("click", closeFolderModal);
    els.folderModalCancel.addEventListener("click", closeFolderModal);
    els.folderModalSave.addEventListener("click", saveFolderFromModal);
    els.folderModalBackdrop.addEventListener("click", (event) => {
      if (event.target === els.folderModalBackdrop) closeFolderModal();
    });

    els.confirmCancel.addEventListener("click", closeConfirm);
    els.confirmOk.addEventListener("click", runConfirm);
    els.confirmBackdrop.addEventListener("click", (event) => {
      if (event.target === els.confirmBackdrop) closeConfirm();
    });

    els.themeToggle.addEventListener("change", async () => {
      const theme = els.themeToggle.checked ? THEME_DARK : THEME_LIGHT;
      applyTheme(theme);
      if (state.user) {
        if (useLocalAuth) {
          // persist theme in local payload
          persistLocalData();
        } else {
          await setDoc(userSettingsRef(), { theme, updatedAt: serverTimestamp() }, { merge: true });
        }
      }
    });

    els.searchInput.addEventListener("input", () => {
      state.searchQuery = els.searchInput.value.trim();
      els.searchClear.style.display = state.searchQuery ? "block" : "none";
      if (state.searchQuery) {
        showView("search", { keepSearch: true });
      } else if (state.activeView === "search") {
        showView("dashboard", { keepSearch: true });
      }
      renderSearch();
    });

    els.searchClear.addEventListener("click", () => {
      els.searchInput.value = "";
      state.searchQuery = "";
      els.searchClear.style.display = "none";
      showView("dashboard", { keepSearch: true });
    });

    els.hamburgerBtn.addEventListener("click", openSidebar);
    els.sidebarCloseBtn.addEventListener("click", closeSidebar);
    els.sidebarOverlay.addEventListener("click", closeSidebar);

    els.calPrev.addEventListener("click", () => {
      state.calendarCursor = new Date(
        state.calendarCursor.getFullYear(),
        state.calendarCursor.getMonth() - 1,
        1
      );
      renderCalendar();
    });
    els.calNext.addEventListener("click", () => {
      state.calendarCursor = new Date(
        state.calendarCursor.getFullYear(),
        state.calendarCursor.getMonth() + 1,
        1
      );
      renderCalendar();
    });

    els.folderEmojiRow.addEventListener("click", selectFolderEmoji);
    els.folderColorRow.addEventListener("click", selectFolderColor);
    els.authForm.addEventListener("submit", handleAuthSubmit);
    els.authToggle.addEventListener("click", toggleAuthMode);
    els.logoutBtn.addEventListener("click", handleLogout);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNoteModal();
        closeFolderModal();
        closeConfirm();
        closeSidebar();
      }
    });
  }

  function watchAuth() {
    const onAuthStateChangedFn = useLocalAuth ? window.__LocalAuth.onAuthStateChanged : onAuthStateChanged;
    onAuthStateChangedFn(auth, async (user) => {
      cleanupRealtimeListeners();
      state.user = user;
      state.notes = [];
      state.folders = [];
      state.selectedFolderId = null;
      state.editingNoteId = null;

      if (!user) {
        setSignedOutUI();
        render();
        return;
      }

      setSignedInUI(user);
      if (useLocalAuth) {
        // Load folders/notes from localStorage for local testing
        const payload = JSON.parse(localStorage.getItem(`noteflow_data_${user.uid}`) || "null");
        if (payload) {
          state.folders = payload.folders || [];
          state.notes = (payload.notes || []).map((n) => normalizeNote(n.id, n));
        } else {
          state.folders = defaultFolders.slice();
          state.notes = [];
        }
        state.isSyncing = false;
        setSyncStatus("Local mode");
        render();
      } else {
        setSyncStatus("Syncing...");
        state.isSyncing = true;
        await ensureDefaultFolders();
        startRealtimeSync();
      }
    });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    const mode = els.authForm.dataset.mode || "login";
    const email = els.authEmail.value.trim();
    const password = els.authPassword.value;
    const displayName = els.authName.value.trim();

    if (!email || !password || (mode === "signup" && !displayName)) {
      setAuthError("Please fill in all required fields.");
      return;
    }

    setAuthBusy(true);
    try {
      if (mode === "signup") {
        if (useLocalAuth) {
          const credential = await window.__LocalAuth.createUserWithEmailAndPassword(auth, email, password);
          await window.__LocalAuth.updateProfile(credential.user, { displayName });
        } else {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(credential.user, { displayName });
          await setDoc(doc(db, "users", credential.user.uid), {
            displayName,
            email,
            createdAt: serverTimestamp()
          }, { merge: true });
          await setDoc(doc(db, "users", credential.user.uid, "settings", "profile"), {
            theme: state.currentTheme,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } else {
        if (useLocalAuth) {
          await window.__LocalAuth.signInWithEmailAndPassword(auth, email, password);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
      }
      els.authForm.reset();
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function toggleAuthMode() {
    const isSignup = els.authForm.dataset.mode === "signup";
    els.authForm.dataset.mode = isSignup ? "login" : "signup";
    els.authNameField.classList.toggle("hidden", isSignup);
    els.authModeLabel.textContent = isSignup ? "Log in" : "Create account";
    els.authSubmit.textContent = isSignup ? "Log In" : "Sign Up";
    els.authToggle.textContent = isSignup ? "Create an account" : "I already have an account";
    setAuthError("");
  }

  async function handleLogout() {
    if (useLocalAuth) {
      await window.__LocalAuth.signOut();
    } else {
      await signOut(auth);
    }
    showToast("Logged out.");
  }

  function setSignedInUI(user) {
    els.authBackdrop.classList.add("hidden");
    els.appShell.classList.remove("auth-locked");
    els.logoutBtn.classList.remove("hidden");
    els.userChip.classList.remove("hidden");
    els.userChip.textContent = user.displayName || user.email;
  }

  function setSignedOutUI() {
    els.authBackdrop.classList.remove("hidden");
    els.appShell.classList.add("auth-locked");
    els.logoutBtn.classList.add("hidden");
    els.userChip.classList.add("hidden");
    setSyncStatus("Offline");
    applyTheme(THEME_LIGHT);
  }

  function setAuthBusy(isBusy) {
    els.authSubmit.disabled = isBusy;
    els.authSubmit.textContent = isBusy ? "Please wait..." : (els.authForm.dataset.mode === "signup" ? "Sign Up" : "Log In");
  }

  function setAuthError(message) {
    els.authError.textContent = message;
    els.authError.classList.toggle("hidden", !message);
  }

  function getFriendlyAuthError(error) {
    const code = error?.code || "";
    if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Email or password is incorrect.";
    if (code.includes("email-already-in-use")) return "That email already has an account.";
    if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
    if (code.includes("invalid-email")) return "Enter a valid email address.";
    return "Authentication failed. Check Firebase setup and try again.";
  }

  function startRealtimeSync() {
    const foldersQuery = query(collection(db, "users", state.user.uid, "folders"), orderBy("order", "asc"));
    const notesQuery = query(collection(db, "users", state.user.uid, "notes"), orderBy("createdAt", "desc"));

    const unsubscribeFolders = onSnapshot(foldersQuery, (snapshot) => {
      state.folders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      render();
    }, (error) => handleFirestoreError(error));

    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      state.notes = snapshot.docs.map((item) => normalizeNote(item.id, item.data()));
      state.isSyncing = false;
      setSyncStatus("Live sync on");
      render();
    }, (error) => handleFirestoreError(error));

    const unsubscribeSettings = onSnapshot(userSettingsRef(), (snapshot) => {
      const theme = snapshot.data()?.theme || THEME_LIGHT;
      applyTheme(theme);
    }, (error) => handleFirestoreError(error));

    state.unsubscribers = [unsubscribeFolders, unsubscribeNotes, unsubscribeSettings];
  }

  function cleanupRealtimeListeners() {
    state.unsubscribers.forEach((unsubscribe) => unsubscribe());
    state.unsubscribers = [];
  }

  async function ensureDefaultFolders() {
    const folders = await getDocs(collection(db, "users", state.user.uid, "folders"));
    if (!folders.empty) return;

    await Promise.all(defaultFolders.map((folder) => {
      const { id, ...folderData } = folder;
      return setDoc(doc(db, "users", state.user.uid, "folders", id), {
        ...folderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }));
  }

  function handleFirestoreError(error) {
    console.error(error);
    setSyncStatus("Sync error");
    showToast("Firestore sync failed. Check rules and config.");
  }

  function normalizeNote(id, data) {
    return {
      id,
      title: data.title || "Untitled note",
      content: data.content || "",
      folderId: data.folderId || state.folders[0]?.id || "",
      date: data.date || "",
      createdAt: timestampToSortValue(data.createdAt),
      updatedAt: timestampToSortValue(data.updatedAt)
    };
  }

  function timestampToSortValue(value) {
    if (!value) return new Date(0).toISOString();
    if (typeof value === "string") return value;
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return new Date(value).toISOString();
  }

  function showView(viewName, options) {
    if (!state.user) return;

    if (!options?.keepSearch && viewName !== "search") {
      els.searchInput.value = "";
      state.searchQuery = "";
      els.searchClear.style.display = "none";
    }

    state.activeView = viewName;
    if (viewName !== "folder") state.selectedFolderId = null;

    $$(".view").forEach((view) => view.classList.remove("active"));
    const active = $(`#view-${viewName}`);
    if (active) active.classList.add("active");

    $$(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });
    $$(".folder-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.folderId === state.selectedFolderId);
    });

    const titles = {
      dashboard: "Dashboard",
      all: "All Notes",
      today: "Today",
      upcoming: "Upcoming",
      calendar: "Calendar",
      search: "Search Results",
      folder: getFolder(state.selectedFolderId)?.name || "Folder"
    };
    els.topbarTitle.textContent = titles[viewName] || "NoteFlow";
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
  }

  function updateHero() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("#heroGreeting").textContent = greeting;
    $("#heroDate").textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }

  function renderStats() {
    const today = Calendar.toISODate(new Date());
    const future = state.notes.filter((note) => note.date && note.date > today).length;
    const todayCount = state.notes.filter((note) => note.date === today).length;

    setText("#statTotal", state.notes.length);
    setText("#statToday", todayCount);
    setText("#statFolders", state.folders.length);
    setBadge("#allNotesBadge", state.notes.length);
    setBadge("#todayBadge", todayCount);
    setBadge("#upcomingBadge", future);
  }

  function setText(selector, value) {
    $(selector).textContent = value;
  }

  function setBadge(selector, count) {
    const badge = $(selector);
    badge.textContent = count;
    badge.dataset.count = String(count);
  }

  function renderFolders() {
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
    els.noteFolder.innerHTML = "";
    state.folders.forEach((folder) => {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = `${folder.emoji} ${folder.name}`;
      els.noteFolder.appendChild(option);
    });
  }

  function renderWeekStrip() {
    const today = new Date();
    const dates = Calendar.getWeekDates(today);
    const container = $("#weekStrip");
    container.innerHTML = "";

    dates.forEach((date) => {
      const iso = Calendar.toISODate(date);
      const day = document.createElement("button");
      day.className = "week-day";
      day.classList.toggle("today", Calendar.isSameDay(date, today));
      day.classList.toggle("has-notes", state.notes.some((note) => note.date === iso));
      day.innerHTML = `
        <span class="week-day-name">${Calendar.dayNames[date.getDay()]}</span>
        <span class="week-day-num">${date.getDate()}</span>
      `;
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
    toggleEmpty("#todayEmpty", todayNotes.length === 0 && !state.isSyncing);

    renderNotesGrid($("#upcomingNotes"), upcomingNotes);
    toggleEmpty("#upcomingEmpty", upcomingNotes.length === 0 && !state.isSyncing);
  }

  function renderAllNotes() {
    const notes = sortedNotes([...state.notes]);
    renderNotesGrid($("#allNotesGrid"), notes);
    toggleEmpty("#allEmpty", notes.length === 0 && !state.isSyncing);
  }

  function renderTodayView() {
    const today = Calendar.toISODate(new Date());
    const notes = sortedNotes(state.notes.filter((note) => note.date === today));
    renderNotesGrid($("#todayGrid"), notes);
    toggleEmpty("#todayGridEmpty", notes.length === 0 && !state.isSyncing);
  }

  function renderUpcomingView() {
    const today = Calendar.toISODate(new Date());
    const notes = sortedNotes(state.notes.filter((note) => note.date && note.date > today));
    renderNotesGrid($("#upcomingGrid"), notes);
    toggleEmpty("#upcomingGridEmpty", notes.length === 0 && !state.isSyncing);
  }

  function renderFolderView() {
    const folder = getFolder(state.selectedFolderId);
    $("#folderViewTitle").textContent = folder ? `${folder.emoji} ${folder.name}` : "Folder";
    const notes = folder ? sortedNotes(notesByFolder(folder.id)) : [];
    renderNotesGrid($("#folderNotesGrid"), notes);
    toggleEmpty("#folderEmpty", notes.length === 0 && !state.isSyncing);
  }

  function renderCalendar() {
    const year = state.calendarCursor.getFullYear();
    const month = state.calendarCursor.getMonth();
    const today = new Date();
    const cells = Calendar.getMonthMatrix(year, month);
    els.calMonthLabel.textContent = `${Calendar.monthNames[month]} ${year}`;
    els.calGrid.innerHTML = "";

    Calendar.dayNames.forEach((name) => {
      const label = document.createElement("div");
      label.className = "cal-dow";
      label.textContent = name;
      els.calGrid.appendChild(label);
    });

    cells.forEach((cell) => {
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
    els.calDayTitle.textContent = Calendar.formatLongDate(state.selectedCalendarDate);
    renderNotesGrid(els.calDayNotes, selectedNotes);
    toggleEmpty("#calDayEmpty", selectedNotes.length === 0 && !state.isSyncing);
  }

  function renderSearch() {
    const queryText = state.searchQuery.toLowerCase();
    const notes = queryText
      ? sortedNotes(state.notes.filter((note) => {
          const folder = getFolder(note.folderId);
          return [note.title, note.content, folder?.name]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(queryText));
        }))
      : [];

    renderNotesGrid($("#searchGrid"), notes);
    toggleEmpty("#searchEmpty", queryText.length > 0 && notes.length === 0);
  }

  function renderNotesGrid(container, notes) {
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
        <button class="note-action-btn edit" aria-label="Edit note" type="button">✎</button>
        <button class="note-action-btn delete" aria-label="Delete note" type="button">✕</button>
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
    if (!state.user) return;
    if (!state.folders.length) {
      showToast("Folders are still syncing. Try again in a moment.");
      return;
    }

    const note = options.noteId ? state.notes.find((item) => item.id === options.noteId) : null;
    state.editingNoteId = note?.id || null;
    els.modalMode.textContent = note ? "Edit Note" : "New Note";
    els.noteTitle.value = note?.title || "";
    els.noteContent.value = note?.content || "";
    els.noteDate.value = note?.date || options.date || Calendar.toISODate(new Date());
    els.noteFolder.value = note?.folderId || options.folderId || state.selectedFolderId || state.folders[0]?.id || "";
    els.noteModalBackdrop.classList.remove("hidden");
    setTimeout(() => els.noteTitle.focus(), 50);
  }

  function closeNoteModal() {
    els.noteModalBackdrop.classList.add("hidden");
    state.editingNoteId = null;
  }

  async function saveNoteFromModal() {
    const title = els.noteTitle.value.trim();
    const content = els.noteContent.value.trim();
    const folderId = els.noteFolder.value || state.folders[0]?.id;
    const date = els.noteDate.value;

    if (!title && !content) {
      showToast("Add a title or note body first.");
      return;
    }

    const noteData = {
      title: title || "Untitled note",
      content,
      folderId,
      date,
      updatedAt: serverTimestamp()
    };

    try {
      if (useLocalAuth) {
        if (state.editingNoteId) {
          const idx = state.notes.findIndex((n) => n.id === state.editingNoteId);
          if (idx > -1) {
            state.notes[idx] = { ...state.notes[idx], ...noteData, updatedAt: new Date().toISOString() };
            persistLocalData();
            showToast("Note updated.");
          }
        } else {
          const id = `local_note_${Date.now()}`;
          const newNote = { id, ...noteData, createdAt: new Date().toISOString() };
          state.notes.unshift(normalizeNote(id, newNote));
          persistLocalData();
          showToast("Note created.");
        }
      } else {
        if (state.editingNoteId) {
          await updateDoc(noteRef(state.editingNoteId), noteData);
          showToast("Note updated.");
        } else {
          await addDoc(collection(db, "users", state.user.uid, "notes"), {
            ...noteData,
            createdAt: serverTimestamp()
          });
          showToast("Note created.");
        }
      }
      closeNoteModal();
    } catch (error) {
      handleFirestoreError(error);
    }
  }

  function openFolderModal() {
    if (!state.user) return;
    state.selectedFolderEmoji = "📁";
    state.selectedFolderColor = "#E8A87C";
    els.folderName.value = "";
    $$(".emoji-opt").forEach((button) => {
      button.classList.toggle("active", button.dataset.emoji === state.selectedFolderEmoji);
    });
    $$(".color-opt").forEach((button) => {
      button.classList.toggle("active", button.dataset.color === state.selectedFolderColor);
    });
    els.folderModalBackdrop.classList.remove("hidden");
    setTimeout(() => els.folderName.focus(), 50);
  }

  function closeFolderModal() {
    els.folderModalBackdrop.classList.add("hidden");
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

  async function saveFolderFromModal() {
    const name = els.folderName.value.trim();
    if (!name) {
      showToast("Give the folder a name first.");
      return;
    }

    try {
      if (useLocalAuth) {
        const id = `local_folder_${Date.now()}`;
        const folder = {
          id,
          name,
          emoji: state.selectedFolderEmoji,
          color: state.selectedFolderColor,
          order: Date.now()
        };
        state.folders.push(folder);
        persistLocalData();
        closeFolderModal();
        showToast("Folder created.");
      } else {
        await addDoc(collection(db, "users", state.user.uid, "folders"), {
          name,
          emoji: state.selectedFolderEmoji,
          color: state.selectedFolderColor,
          order: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        closeFolderModal();
        showToast("Folder created.");
      }
    } catch (error) {
      handleFirestoreError(error);
    }
  }

  function requestDeleteNote(noteId) {
    const note = state.notes.find((item) => item.id === noteId);
    openConfirm({
      message: `Delete "${note?.title || "this note"}"?`,
      illo: "🗑️",
      action: async () => {
        if (useLocalAuth) {
          state.notes = state.notes.filter((n) => n.id !== noteId);
          persistLocalData();
          showToast("Note deleted.");
        } else {
          await deleteDoc(noteRef(noteId));
          showToast("Note deleted.");
        }
      }
    });
  }

  function requestDeleteFolder() {
    const folder = getFolder(state.selectedFolderId);
    if (!folder) return;
    openConfirm({
      message: `Delete "${folder.name}" and its notes?`,
      illo: "📁",
      action: async () => {
        if (useLocalAuth) {
          state.notes = state.notes.filter((note) => note.folderId !== folder.id);
          state.folders = state.folders.filter((f) => f.id !== folder.id);
          persistLocalData();
          state.selectedFolderId = null;
          showView("all");
          showToast("Folder deleted.");
        } else {
          const notesToDelete = state.notes.filter((note) => note.folderId === folder.id);
          await Promise.all([
            ...notesToDelete.map((note) => deleteDoc(noteRef(note.id))),
            deleteDoc(folderRef(folder.id))
          ]);
          state.selectedFolderId = null;
          showView("all");
          showToast("Folder deleted.");
        }
      }
    });
  }

  function openConfirm({ message, illo, action }) {
    els.confirmMsg.textContent = message;
    els.confirmIllo.textContent = illo;
    state.pendingConfirm = action;
    els.confirmBackdrop.classList.remove("hidden");
  }

  function closeConfirm() {
    els.confirmBackdrop.classList.add("hidden");
    state.pendingConfirm = null;
  }

  async function runConfirm() {
    try {
      if (typeof state.pendingConfirm === "function") await state.pendingConfirm();
    } catch (error) {
      handleFirestoreError(error);
    } finally {
      closeConfirm();
    }
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

  function toggleEmpty(selector, shouldShow) {
    $(selector).classList.toggle("hidden", !shouldShow);
  }

  function openSidebar() {
    els.sidebar.classList.add("open");
    els.sidebarOverlay.classList.add("active");
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.sidebarOverlay.classList.remove("active");
  }

  function showToast(message) {
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
    els.themeToggle.checked = theme === THEME_DARK;
  }

  function setSyncStatus(message) {
    els.syncStatus.textContent = message;
  }

  function userSettingsRef() {
    return doc(db, "users", state.user.uid, "settings", "profile");
  }

  function persistLocalData() {
    if (!useLocalAuth || !state.user) return;
    const key = `noteflow_data_${state.user.uid}`;
    const payload = {
      folders: state.folders,
      notes: state.notes.map((n) => ({ id: n.id, title: n.title, content: n.content, folderId: n.folderId, date: n.date, createdAt: n.createdAt, updatedAt: n.updatedAt }))
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }

  function noteRef(noteId) {
    return doc(db, "users", state.user.uid, "notes", noteId);
  }

  function folderRef(folderId) {
    return doc(db, "users", state.user.uid, "folders", folderId);
  }

  function finishLoading() {
    const loadingScreen = document.getElementById("loadingScreen");
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
