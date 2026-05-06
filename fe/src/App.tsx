import { HeartHandshake, MessageCircle, Radar, ShieldCheck } from 'lucide-react';
import './App.css';

const modules = [
  {
    copy: 'Auth, profile, preference, photo upload, verification state.',
    icon: ShieldCheck,
    title: 'Identity',
  },
  {
    copy: 'Discovery feed, swipe decision, reciprocal match transaction.',
    icon: HeartHandshake,
    title: 'Matching',
  },
  {
    copy: 'Socket.IO channels for chat, typing state, presence, receipts.',
    icon: MessageCircle,
    title: 'Realtime Chat',
  },
  {
    copy: 'Block, report, moderation queue, notification hooks.',
    icon: Radar,
    title: 'Safety Ops',
  },
];

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <HeartHandshake size={22} />
          </span>
          <div>
            <h1>Social Matchmaking</h1>
            <p>Spec-driven dating platform workspace</p>
          </div>
        </div>
        <span className="env-pill">React + NestJS + PostgreSQL</span>
      </header>

      <section className="workspace">
        <div>
          <div className="section-header">
            <h2>Product Modules</h2>
            <p className="section-copy">
              Frontend shell is ready for feature specs: discovery, matching,
              chat, safety, notifications, then later calls and AI coach.
            </p>
          </div>

          <div className="module-grid">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <article className="module-card" key={module.title}>
                  <span className="module-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3>{module.title}</h3>
                  <p>{module.copy}</p>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="status-panel" aria-label="Project status">
          <h2>Foundation</h2>
          <div className="status-list">
            <div className="status-item">
              <strong>API</strong>
              <span>http://localhost:3000/api</span>
            </div>
            <div className="status-item">
              <strong>Docs</strong>
              <span>http://localhost:3000/docs</span>
            </div>
            <div className="status-item">
              <strong>Socket namespace</strong>
              <span>http://localhost:3000/realtime</span>
            </div>
            <div className="status-item">
              <strong>Spec folder</strong>
              <span>./specs</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;
