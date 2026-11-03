'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { MENTORS } from '@/lib/mentors';

export function MentorSection() {
  return (
    <section className="home-section">
      <h2 className="home-section-title">导师专区</h2>
      <div className="home-mentor-grid">
        {MENTORS.map((mentor) => {
          const external = mentor.isWebsite && mentor.href.trim().length > 0;
          const internal = !mentor.isWebsite && Boolean(mentor.articleFile?.trim());
          const style = {
            '--mentor-color': mentor.color,
            '--mentor-icon': `url("${mentor.image}")`,
          } as CSSProperties;
          const body = (
            <>
              <span className="home-mentor-icon" aria-hidden>
                <span className="home-mentor-glyph" />
              </span>
              <span className="home-mentor-name">{mentor.name}</span>
              <span className="home-mentor-route">{mentor.route}</span>
            </>
          );

          if (internal) {
            return (
              <Link
                key={mentor.slug}
                href={`/mentors/${mentor.slug}`}
                className="home-mentor-card"
                style={style}
                aria-label={`查看${mentor.name}攻略`}
              >
                {body}
              </Link>
            );
          }

          return (
            <button
              key={mentor.slug}
              type="button"
              className="home-mentor-card"
              style={style}
              disabled={!external}
              aria-label={
                external ? `打开${mentor.name}导师专区` : `${mentor.name}导师专区，外链待配置`
              }
              onClick={() => {
                if (!external) return;
                window.open(mentor.href, '_blank', 'noopener,noreferrer');
              }}
            >
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}
