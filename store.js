/**
 * STORE.JS — localStorage Data Abstraction Layer
 * All data reads/writes go through this module.
 * AI layer NEVER calls this directly — only app logic does.
 */

const Store = (() => {
  const PREFIX = 'kai_';

  const get = (key) => {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  };

  const set = (key, value) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }
  };

  const del = (key) => localStorage.removeItem(PREFIX + key);

  const clear = () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  };

  // ── USER AUTH (Gmail-only) ──
  const getUsers = () => get('users') || [];
  const saveUsers = (u) => set('users', u);
  const getAllUsers = () => getUsers();
  const getUserById = (id) => getUsers().find(u => u.id === id) || null;

  const getCurrentUser = () => get('current_user');
  const setCurrentUser = (u) => set('current_user', u);
  const clearCurrentUser = () => del('current_user');

  /** Gmail-style: find existing account OR create new one */
  const createOrFindUser = (name, email) => {
    const users = getUsers();
    let user = users.find(u => u.email === email);
    if (!user) {
      const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      user = { id, name, email, provider: 'google', createdAt: new Date().toISOString(), setupComplete: false };
      users.push(user);
      saveUsers(users);
    }
    setCurrentUser(user);
    return user;
  };

  /** Legacy password auth (kept for backward compat) */
  const createUser = (name, email, password) => {
    const users = getUsers();
    if (users.find(u => u.email === email)) return { error: 'Email already registered.' };
    const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const user = { id, name, email, password, createdAt: new Date().toISOString(), setupComplete: false };
    users.push(user);
    saveUsers(users);
    return { user };
  };

  const loginUser = (email, password) => {
    const user = getUsers().find(u => u.email === email && u.password === password);
    if (!user) return { error: 'Invalid email or password.' };
    setCurrentUser(user);
    return { user };
  };

  const updateUser = (updates) => {
    const cu = getCurrentUser();
    if (!cu) return;
    const users = getUsers();
    const idx = users.findIndex(u => u.id === cu.id);
    if (idx === -1) return;
    Object.assign(users[idx], updates);
    saveUsers(users);
    setCurrentUser(users[idx]);
    return users[idx];
  };

  const logout = () => { clearCurrentUser(); };

  // ── SETUP PROFILE ──
  const getProfile = () => get('profile_' + (getCurrentUser()?.id || ''));
  const saveProfile = (p) => set('profile_' + getCurrentUser().id, p);

  const getSkillProfile = () => get('skills_' + (getCurrentUser()?.id || ''));
  const saveSkillProfile = (s) => set('skills_' + getCurrentUser().id, s);

  const isSetupComplete = () => !!(getCurrentUser()?.setupComplete);

  const markSetupComplete = () => {
    updateUser({ setupComplete: true });
    const cu = getCurrentUser();
    if (cu) { cu.setupComplete = true; setCurrentUser(cu); }
  };

  /** Hard reset: wipe profile, skills, plan, sessions, readiness — keep account */
  const resetProfile = () => {
    const id = getCurrentUser()?.id;
    if (!id) return;
    ['profile_', 'skills_', 'plan_', 'readiness_', 'sessions_', 'trainer_', 'lb_optin_', 'setup_draft_']
      .forEach(k => del(k + id));
    updateUser({ setupComplete: false });
  };

  // ── SETUP DRAFT (abandonment recovery) ──
  const getSetupDraft = () => get('setup_draft_' + (getCurrentUser()?.id || '')) || {};
  const saveSetupDraft = (step, data) => {
    const draft = getSetupDraft();
    draft[step] = data;
    draft.lastStep = step;
    set('setup_draft_' + getCurrentUser().id, draft);
  };
  const clearSetupDraft = () => del('setup_draft_' + getCurrentUser().id);

  // ── ATTEMPT TRACKING (cooldowns, anti-gaming) ──
  const getAttemptData = (key) => get('attempt_' + (getCurrentUser()?.id || '') + '_' + key) || {};
  const setAttemptData = (key, data) => set('attempt_' + getCurrentUser().id + '_' + key, data);
  const getLastAttemptTime = (key) => getAttemptData(key).lastAttempt || null;
  const recordAttempt = (key) => {
    const prev = getAttemptData(key);
    setAttemptData(key, { ...prev, lastAttempt: Date.now(), count: (prev.count || 0) + 1 });
  };
  const isOnCooldown = (key, cooldownMs) => {
    const last = getLastAttemptTime(key);
    return last ? (Date.now() - last) < cooldownMs : false;
  };
  const cooldownRemaining = (key, cooldownMs) => {
    const last = getLastAttemptTime(key);
    return last ? Math.max(0, cooldownMs - (Date.now() - last)) : 0;
  };

  // ── READINESS ──
  const getReadiness = () => {
    const id = getCurrentUser()?.id;
    return id ? (get('readiness_' + id) || { score: 0, trend: 'Stagnant', history: [], breakdown: { skills: 0, interviews: 0, tasks: 0 } }) : null;
  };
  const saveReadiness = (r) => set('readiness_' + getCurrentUser().id, r);

  // ── PLAN ──
  const getPlan = () => get('plan_' + (getCurrentUser()?.id || ''));
  const savePlan = (p) => set('plan_' + getCurrentUser().id, p);

  // ── DAILY TASKS ──
  const getTodayKey = () => new Date().toISOString().slice(0, 10);
  const getDailyTasks = () => get('daily_' + getCurrentUser()?.id + '_' + getTodayKey()) || [];
  const saveDailyTasks = (t) => set('daily_' + getCurrentUser().id + '_' + getTodayKey(), t);

  // ── INTERVIEW SESSIONS ──
  const getSessions = () => get('sessions_' + (getCurrentUser()?.id || '')) || [];
  const saveSession = (s) => {
    const sessions = getSessions();
    const idx = sessions.findIndex(x => x.sessionId === s.sessionId);
    if (idx >= 0) sessions[idx] = s; else sessions.push(s);
    set('sessions_' + getCurrentUser().id, sessions);
  };
  const getLastSession = () => { const s = getSessions(); return s.length ? s[s.length - 1] : null; };

  // ── TRAINER ──
  const getTrainer = () => get('trainer_' + (getCurrentUser()?.id || ''));
  const saveTrainer = (t) => set('trainer_' + getCurrentUser().id, t);

  // ── LEADERBOARD ──
  const getLeaderboard = () => get('leaderboard') || [];
  const saveLeaderboard = (l) => set('leaderboard', l);
  const isLeaderboardOptIn = () => { const cu = getCurrentUser(); return cu ? (get('lb_optin_' + cu.id) || false) : false; };
  const setLeaderboardOptIn = (v) => set('lb_optin_' + getCurrentUser().id, v);

  // ── REMINDERS ──
  const getReminders = () => get('reminders_' + (getCurrentUser()?.id || '')) || [];
  const saveReminders = (r) => set('reminders_' + getCurrentUser().id, r);

  // ── NOTIFICATIONS ──
  const getNotifications = () => get('notifs_' + (getCurrentUser()?.id || '')) || [];
  const addNotification = (n) => {
    const notifs = getNotifications();
    notifs.unshift({ ...n, id: Date.now(), read: false, time: new Date().toISOString() });
    set('notifs_' + getCurrentUser().id, notifs.slice(0, 30));
  };
  const markNotifRead = (id) => {
    const notifs = getNotifications();
    const n = notifs.find(x => x.id === id);
    if (n) { n.read = true; set('notifs_' + getCurrentUser().id, notifs); }
  };
  const markAllNotifsRead = () => {
    set('notifs_' + getCurrentUser().id, getNotifications().map(n => ({ ...n, read: true })));
  };

  // ── GEMINI API KEY ──
  const getApiKey = () => localStorage.getItem('kai_gemini_key') || '';
  const saveApiKey = (k) => { localStorage.setItem('kai_gemini_key', k); };

  return {
    get, set, del, clear,
    // Auth
    getAllUsers, getUserById, getUsers, getCurrentUser, setCurrentUser, clearCurrentUser,
    createUser, createOrFindUser, loginUser, updateUser, logout,
    // Setup
    getProfile, saveProfile,
    getSkillProfile, saveSkillProfile,
    isSetupComplete, markSetupComplete, resetProfile,
    getSetupDraft, saveSetupDraft, clearSetupDraft,
    // Attempt tracking / cooldowns
    getAttemptData, setAttemptData, getLastAttemptTime, recordAttempt, isOnCooldown, cooldownRemaining,
    // Main data
    getReadiness, saveReadiness,
    getPlan, savePlan,
    getDailyTasks, saveDailyTasks,
    getSessions, saveSession, getLastSession,
    getTrainer, saveTrainer,
    getLeaderboard, saveLeaderboard, isLeaderboardOptIn, setLeaderboardOptIn,
    getReminders, saveReminders,
    getNotifications, addNotification, markNotifRead, markAllNotifsRead,
    getApiKey, saveApiKey,
    // ── Notes Module ──
    // Notes CRUD
    saveNote: (note) => { const notes = get('notes_list') || []; const idx = notes.findIndex(n => n.id === note.id); if (idx >= 0) notes[idx] = note; else notes.unshift(note); set('notes_list', notes); },
    getNoteById: (id) => { const notes = get('notes_list') || []; return notes.find(n => n.id === id) || null; },
    getNotesHistory: () => get('notes_list') || [],
    deleteNote: (id) => { const notes = (get('notes_list') || []).filter(n => n.id !== id); set('notes_list', notes); },
    updateNoteLastScore: (id, score) => { const notes = get('notes_list') || []; const n = notes.find(x => x.id === id); if (n) { n.lastScore = score; set('notes_list', notes); } },
    // Active note pointer
    setActiveNoteId: (id) => set('active_note_id', id),
    getActiveNoteId: () => get('active_note_id'),
    // Summary cache
    saveNoteSummary: (noteId, summary) => set('note_summary_' + noteId, summary),
    getNoteSummary: (noteId) => get('note_summary_' + noteId),
    // Quiz cache (per note)
    saveNoteQuiz: (noteId, questions) => set('note_quiz_' + noteId, questions),
    getNoteQuiz: (noteId) => get('note_quiz_' + noteId),
    clearNoteQuiz: (noteId) => { try { localStorage.removeItem('kai_note_quiz_' + noteId); } catch { } },
    // Quiz attempts
    saveQuizAttempt: (attempt) => { const key = 'note_attempts_' + attempt.noteId; const list = get(key) || []; list.push(attempt); set(key, list); },
    getQuizAttempts: (noteId) => get('note_attempts_' + noteId) || [],
    getQuizStats: () => {
      const allNotes = get('notes_list') || [];
      const allAttempts = allNotes.flatMap(n => get('note_attempts_' + n.id) || []);
      const scores = allAttempts.map(a => a.score).filter(Boolean);
      return { totalAttempts: allAttempts.length, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, bestScore: scores.length ? Math.max(...scores) : 0 };
    },
    // Classroom rooms
    saveClassroomRoom: (room) => { const all = get('classroom_rooms') || {}; all[room.code] = room; set('classroom_rooms', all); },
    getClassroomRoom: (code) => { const all = get('classroom_rooms') || {}; return all[code] || null; },
    getAllClassroomRooms: () => Object.values(get('classroom_rooms') || {}),
    saveClassroomResult: (result) => { const list = get('classroom_results') || []; list.push(result); set('classroom_results', list); },
    getClassroomResults: () => get('classroom_results') || [],
  };
})();

export default Store;
