/** 公测六大职业导师专区。isWebsite 为 true 时点开 href；为 false 时站内展示 articleFile。 */
export type MentorEntry = {
  slug: string;
  name: string;
  route: string;
  image: string;
  /** 途径代表色，用于给白底剪影图标着色 */
  color: string;
  href: string;
  isWebsite: boolean;
  /** isWebsite 为 false 时，读取 src/lib/mentors-article 下的这篇 Markdown */
  articleFile?: string;
};

export const MENTORS: MentorEntry[] = [
  {
    slug: 'fool',
    name: '占卜家',
    route: '林友道',
    image: '/professions/1200003.png',
    color: '#c5ceda',
    href: '',
    isWebsite: true,
  },
  {
    slug: 'dreamer',
    name: '观众',
    route: '霜语',
    image: '/professions/1200002.png',
    color: '#B8DFFF',
    href: '',
    isWebsite: false,
    articleFile: '观众攻略.md',
  },
  {
    slug: 'hermit',
    name: '窥秘人',
    route: '沉烬',
    image: '/professions/1200007.png',
    color: '#c49bff',
    href: '',
    isWebsite: false,
    articleFile: '窥秘人_GVG与6V6攻略.md',
  },
  {
    slug: 'door',
    name: '学徒',
    route: '小呆',
    image: '/professions/1200005.png',
    color: '#6cb4ff',
    href: '',
    isWebsite: true,
  },
  {
    slug: 'giant',
    name: '战士',
    route: '泽森',
    image: '/professions/1200006.png',
    color: '#e0894a',
    href: 'https://docs.qq.com/doc/DYWxWUGFiQWJQa3FD',
    isWebsite: true,
  },
  {
    slug: 'sun',
    name: '歌颂者',
    route: '老洛',
    image: '/professions/1200001.png',
    color: '#f6c445',
    href: 'https://zephyr-eyes.com/',
    isWebsite: true,
  },
];
