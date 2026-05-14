export type AdminRouteId = 'overview' | 'theme' | 'content' | 'images' | 'checks' | 'data';

export type AdminRouteDefinition = {
  id: AdminRouteId;
  href:
    | '/admin/'
    | '/admin/theme/'
    | '/admin/content/'
    | '/admin/images/'
    | '/admin/checks/'
    | '/admin/data/';
  label: string;
  description: string;
};

export const ADMIN_ROUTES = [
  {
    id: 'overview',
    href: '/admin/',
    label: 'Overview',
    description: '后台首页'
  },
  {
    id: 'theme',
    href: '/admin/theme/',
    label: 'Theme',
    description: '主题设置'
  },
  {
    id: 'content',
    href: '/admin/content/',
    label: 'Content',
    description: '内容管理'
  },
  {
    id: 'images',
    href: '/admin/images/',
    label: 'Images',
    description: '图片管理'
  },
  {
    id: 'checks',
    href: '/admin/checks/',
    label: 'Checks',
    description: '站点诊断'
  },
  {
    id: 'data',
    href: '/admin/data/',
    label: 'Data',
    description: '设置导入导出'
  }
] as const satisfies readonly AdminRouteDefinition[];

export const isAdminRouteId = (value: string): value is AdminRouteId =>
  ADMIN_ROUTES.some((route) => route.id === value);

export const getAdminRoute = (id: AdminRouteId): AdminRouteDefinition =>
  ADMIN_ROUTES.find((route) => route.id === id) ?? ADMIN_ROUTES[0];
