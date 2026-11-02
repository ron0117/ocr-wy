'use client';

import type { CSSProperties } from 'react';
import { MENTORS } from '@/lib/mentors';

export function MentorSection() {
  return (
    <section className="home-section">
      <h2 className="home-section-title">导师专区</h2>
      <div className="home-mentor-grid">
        {MENTORS.map((mentor) => {
          const linked = mentor.href.trim().length > 0;
          return (
            <button
              key={mentor.slug}
              type="button"
              className="home-mentor-card"
              style={
                {
                  '--mentor-color': mentor.color,
                  '--mentor-icon': `url("${mentor.image}")`,
                } as CSSProperties
              }
              disabled={!linked}
              aria-label={linked ? `打开${mentor.name}导师专区` : `${mentor.name}导师专区，外链待配置`}
              onClick={() => {
                if (!linked) return;
                window.open(mentor.href, '_blank', 'noopener,noreferrer');
              }}
            >
              <span className="home-mentor-icon" aria-hidden>
                <span className="home-mentor-glyph" />
              </span>
              <span className="home-mentor-name">{mentor.name}</span>
              <span className="home-mentor-route">{mentor.route}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
