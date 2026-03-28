import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing page-fade-in">
      <div className="landing__bg-orb landing__bg-orb--1" />
      <div className="landing__bg-orb landing__bg-orb--2" />

      <div className="landing__content">
        <span className="landing__badge">✦ Premium Experience</span>

        <h1 className="landing__title">Your Perfect Mirror</h1>

        <p className="landing__subtitle">
          Step into a luxury virtual mirror experience — crafted with elegance,
          precision, and a touch of magic. See yourself in a whole new light.
        </p>

        <button className="landing__cta" onClick={() => navigate('/mirror')}>
          Click Me
          <span className="landing__cta-icon">→</span>
        </button>
      </div>

      <div className="landing__footer">
        <a href="/admin">Admin</a>
      </div>
    </div>
  );
}
