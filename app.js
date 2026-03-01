/**
 * APP.JS — Main Application Router
 * Hash-based client-side SPA router.
 * Uses resolveRoute() for setup lock and auth guards.
 */

import { getStartRoute, resolveRoute } from './engine/flow-controller.js';
import { showToast } from './components/toast.js';
import { renderAuth } from './pages/auth.js';
import { renderStep1 } from './pages/setup/step1.js';
import { renderStep2 } from './pages/setup/step2.js';
import { renderStep3 } from './pages/setup/step3.js';
import { renderStep4 } from './pages/setup/step4.js';
import { renderDashboard } from './pages/main/dashboard.js';
import { renderPlan } from './pages/main/plan.js';
import { renderTrainer } from './pages/main/trainer.js';
import { renderTasks } from './pages/main/tasks.js';
import { renderInterview } from './pages/main/interview.js';
import { renderFeedback } from './pages/main/feedback.js';
import { renderReadiness } from './pages/main/readiness.js';
import { renderProgress } from './pages/main/progress.js';
import { renderShareCard } from './pages/main/share-card.js';
import { renderLeaderboard } from './pages/main/leaderboard.js';
import { renderRoles } from './pages/main/roles.js';
import { renderNotes } from './pages/main/notes.js';
import { renderNotesInput } from './pages/notes/notes-input.js';
import { renderNotesSummary } from './pages/notes/notes-summary.js';
import { renderNotesQuiz } from './pages/notes/notes-quiz.js';
import { renderNotesBuddy } from './pages/notes/notes-buddy.js';
import { renderNotesClassroom } from './pages/notes/notes-classroom.js';
import { renderPlacementIntel } from './pages/intelligence/placement-intel.js';
import { checkUpcomingVisits } from './engine/rule-engine.js';
import { PLACEMENTS_DB } from './data/placement-data.js';


// ── ROUTER ──
const Router = {
    navigate(route) {
        window.location.hash = '#' + route;
        this._render(route);
    },

    _render(rawRoute) {
        // Hide loader if visible
        const loader = document.getElementById('page-loader');
        if (loader) loader.classList.add('hidden');

        const r = this;
        window._router = r;

        // Resolve route through guards
        const route = resolveRoute(rawRoute);

        // Setup locked — redirect to dashboard with notification
        if (route === 'SETUP_LOCKED') {
            showToast('Setup is already complete. Use "Redo Onboarding" in your profile menu to restart.', 'info', 'Setup Locked 🔒');
            window.location.hash = '#dashboard';
            this._renderRoute('dashboard', r);
            return;
        }

        this._renderRoute(route, r);
    },

    _renderRoute(route, r) {
        switch (route) {
            case 'auth': renderAuth(r); break;
            case 'setup/1': renderStep1(r); break;
            case 'setup/2': renderStep2(r); break;
            case 'setup/3': renderStep3(r); break;
            case 'setup/4': renderStep4(r); break;
            case 'dashboard': renderDashboard(r); break;
            case 'plan': renderPlan(r); break;
            case 'trainer': renderTrainer(r); break;
            case 'tasks': renderTasks(r); break;
            case 'interview': renderInterview(r); break;
            case 'feedback': renderFeedback(r); break;
            case 'readiness': renderReadiness(r); break;
            case 'progress': renderProgress(r); break;
            case 'share-card': renderShareCard(r); break;
            case 'leaderboard': renderLeaderboard(r); break;
            case 'roles': renderRoles(r); break;
            case 'intel': renderPlacementIntel(r); break;
            // ── Notes Module (optional, no setup guard) ──
            case 'notes': renderNotes(r); break;
            case 'notes/input': renderNotesInput(r); break;
            case 'notes/summary': renderNotesSummary(r); break;
            case 'notes/quiz': renderNotesQuiz(r); break;
            case 'notes/buddy': renderNotesBuddy(r); break;
            case 'notes/classroom': renderNotesClassroom(r); break;

            default:
                this.navigate(getStartRoute());
        }
    },

    init() {
        const hash = window.location.hash.replace('#', '');
        this._render(hash || getStartRoute());
    }
};

// Handle browser back/forward
window.addEventListener('hashchange', () => {
    const route = window.location.hash.replace('#', '');
    if (route) Router._render(route);
});

// Boot app
document.addEventListener('DOMContentLoaded', () => {
    checkUpcomingVisits(PLACEMENTS_DB);
    Router.init();
});

export default Router;
