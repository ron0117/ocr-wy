import { BackNavLink } from '@/components/back-nav-link';

export default function NotFound() {
  return (
    <div>
      <h1>404</h1>
      <p>页面不存在</p>
      <BackNavLink href="/">返回首页</BackNavLink>
    </div>
  );
}
